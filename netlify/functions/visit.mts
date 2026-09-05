/**
 * Record one visit. The whole write side of the counter.
 *
 * `POST /.netlify/functions/visit` with `{ "kind": "open" | "read" }`. Everything else in the row is
 * derived here from the request itself — the country from Netlify's edge geo, the device from the
 * user-agent, the anonymous id from a salted hash of the IP (netlify/shared/visits.ts explains why
 * that hash expires daily and why the raw IP is never stored).
 *
 * ⚠ **It answers 204 to everything, always.** A bad body, an unset salt, a storage failure: all 204,
 * no message. Two reasons. The caller is a fire-and-forget beacon that cannot act on an error, so a
 * status code would only ever be read by somebody probing this endpoint; and a counter must never be
 * able to break the app it counts. The place a failure IS visible is the owner's dashboard, which
 * says out loud when the salt is missing.
 *
 * ⚠ **Two visits by the SAME device at the same instant can lose one count.** The row is a
 * read-modify-write of one blob and Netlify Blobs has no transaction. Different devices never
 * collide (they are different keys), so this costs at most one opening from one phone that
 * double-fired, against a traffic level of single digits a day. It is a counter, not a ledger.
 */
import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";
import {
  foldVisit,
  istanbulDate,
  keyFor,
  readUA,
  refHost,
  STORE,
  visitorId,
  type VisitBody,
  type VisitorDay,
} from "../shared/visits";

/** Longer than any real body; a beacon sends ~40 bytes. */
const MAX_BODY = 2_000;

const NO_CONTENT = (): Response => new Response(null, { status: 204 });

export default async (req: Request, context: Context): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  // No salt, no counting — see netlify/shared/visits.ts. This is the one branch that is a decision
  // rather than a failure, so it is first and it is silent.
  const salt = process.env.STATS_SALT;
  if (!salt) return NO_CONTENT();

  try {
    const text = (await req.text()).slice(0, MAX_BODY);
    const body = JSON.parse(text) as Partial<VisitBody>;
    const kind = body.kind === "read" ? "read" : body.kind === "open" ? "open" : null;
    if (!kind) return NO_CONTENT();

    const now = Date.now();
    const date = istanbulDate(now);
    const ua = req.headers.get("user-agent") ?? "";
    const id = await visitorId(salt, date, context.ip ?? "", ua);

    const store = getStore(STORE);
    const key = keyFor(date, id);
    const prev = (await store.get(key, { type: "json" })) as VisitorDay | null;
    const row = foldVisit(
      prev,
      now,
      date,
      kind,
      readUA(ua),
      context.geo?.country?.code ?? "??",
      refHost(body.ref)
    );
    await store.setJSON(key, row);
  } catch {
    // Deliberately swallowed. See the header: this endpoint has no way to usefully report anything
    // to a beacon, and a counter that can raise is a counter that can take the app down with it.
  }
  return NO_CONTENT();
};
