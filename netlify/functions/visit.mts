/**
 * Record one visit. The whole write side of the counter.
 *
 * `POST /.netlify/functions/visit` with `{ "kind": "open" | "read" }`. The only other input is the
 * user-agent, reduced to four coarse facts that pick the day's bucket. ⚠ **Since 2026-10-14 the
 * request's IP and its geo are never read** — not hashed, not stored, not looked at
 * (netlify/shared/visits.ts says why, and what was given up).
 *
 * ⚠ **It answers 204 to everything, always.** A bad body, an unset salt, a storage failure: all 204,
 * no message. Two reasons. The caller is a fire-and-forget beacon that cannot act on an error, so a
 * status code would only ever be read by somebody probing this endpoint; and a counter must never be
 * able to break the app it counts. The place a failure IS visible is the owner's dashboard, which
 * says out loud when the salt is missing.
 *
 * ⚠ **Two visits in the SAME bucket at the same instant can lose one count.** A bucket is a
 * read-modify-write of one blob and Netlify Blobs has no transaction; two phones of the same kind
 * opening the app in the same few milliseconds now share that blob. Against a traffic level of a
 * few dozen a day, that is a counter's error, not a ledger's.
 */
import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";
import {
  bucketKey,
  foldVisit,
  istanbulDate,
  readUA,
  refHost,
  STORE,
  type VisitBody,
  type VisitBucket,
} from "../shared/visits";

/** Longer than any real body; a beacon sends ~40 bytes. */
const MAX_BODY = 2_000;

const NO_CONTENT = (): Response => new Response(null, { status: 204 });

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  // The on-switch — `STATS_SALT`'s PRESENCE, its value unused since 2026-10-14 (shared/visits.ts).
  // This is the one branch that is a decision rather than a failure, so it is first and silent.
  if (!process.env.STATS_SALT) return NO_CONTENT();

  try {
    const text = (await req.text()).slice(0, MAX_BODY);
    const body = JSON.parse(text) as Partial<VisitBody>;
    const kind = body.kind === "read" ? "read" : body.kind === "open" ? "open" : null;
    if (!kind) return NO_CONTENT();

    const date = istanbulDate(Date.now());
    const ua = readUA(req.headers.get("user-agent") ?? "");

    const store = getStore(STORE);
    const key = bucketKey(date, ua);
    const prev = (await store.get(key, { type: "json" })) as VisitBucket | null;
    await store.setJSON(key, foldVisit(prev, date, kind, ua, refHost(body.ref)));
  } catch {
    // Deliberately swallowed. See the header: this endpoint has no way to usefully report anything
    // to a beacon, and a counter that can raise is a counter that can take the app down with it.
  }
  return NO_CONTENT();
};
