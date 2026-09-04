/**
 * Decode on the server, and fall back to the browser when that does not work (MVP W9, step 3).
 *
 * The client's half of the contract in `apps/server/src/index.ts`: preprocess each crop exactly as
 * the in-browser path does, POST the finished 409×583 PNGs, get tokens back. The seam and why it
 * sits after preprocessing rather than before are written up in `./pixels`.
 *
 * ⛔ **THE FALLBACK IS OFF WHERE A SERVER IS CONFIGURED (owner, 2026-09-04): "ne olursa olsun
 * kullanıcının bilgisayarında okunmasını istemiyorum."** A configured server that does not answer
 * now produces an honest error, not a silent 211 MB download and a decode on someone's phone.
 * That download was the reason: on a laptop it is a slow read, on mobile data it is the worst
 * outcome the system can produce, and it lands on whoever the app most wanted to impress.
 *
 * ⚠ **The in-browser path is NOT deleted and must not be** — `gate:browser`, `parity:armb`,
 * `parity:arma`, `smoke:page` and the W3 browser-vs-gold result all decode through it, and it is
 * the ONLY path in a build with no `VITE_DECODE_URL`. What changed is one decision: whether a
 * SERVER failure may quietly become a local read. It may not, unless `localDecodeAllowed()` says
 * so — which is a deliberate opt-in nothing in a deploy sets.
 *
 * Consequence worth stating twice, because it is the point: on the deployed app the browser never
 * downloads the ~211 MB of graphs at all. `getMeta()`'s ~12 KB `model.json` is still fetched on
 * every path, so the Hub copy stays load-bearing even with local decode off.
 */
import { decodeStrips, type DecodedStripResult, type DecodeOptions, type StripInput } from "./pipeline";
import { preprocessToCanvas } from "./preprocess";
import { getMeta, getModel } from "./session";
import type { ModelMeta } from "./types";

/** Where the decode ran, so the UI can say so and a test can assert on it. */
export type DecodedWhere = "server" | "browser";

export interface RoutedResult {
  strips: DecodedStripResult[];
  where: DecodedWhere;
  /** Set when the server was configured but did not serve — the reason, in a user-readable form. */
  fellBackBecause?: string;
}

/**
 * How long to wait on the server before deciding the user is better served by their own CPU.
 *
 * Generous on purpose: a cold Cloud Run container is 10–30 s before it even starts, and the decode
 * itself is tens of seconds on a shared vCPU (deploy.md expects no speedup, only a cool laptop).
 * Cutting this short would fall back on exactly the requests the server exists to handle.
 */
const TIMEOUT_MS = 180_000;

/**
 * How long to wait for a container that is WARMING UP before handing the page to the browser.
 *
 * A cold Cloud Run container accepts connections ~9.5 s before its graphs are loaded, and answers
 * `/decode` with a truthful 503 in that window (`apps/server/src/index.ts`: "listen first, load
 * after"). Until 2026-08-08 this file treated that 503 like a dead server and fell back — so the
 * first upload after any idle period was read on the user's own machine, pulling 211 MB of weights,
 * which is precisely the outcome the server exists to prevent. Measured, not theorised:
 * `docs/METRICS.md`, and it is why `smoke:live` failed its first run that day.
 *
 * Waiting is nearly free: the budget above already allows 180 s. The wait is still bounded, because
 * a container that never becomes ready must not leave someone staring at a spinner forever.
 *
 * ⚠ **40 s until 2026-09-04, and that was 2 seconds from breaking.** A cold start measured
 * **`loadMs` 38,178 ms** on the revision deployed that day — against the ~9.5 s this file was
 * written for, and the 25.9 s seen on 2026-08-06. All three are FIRST pulls of a freshly pushed
 * image, whose layers Cloud Run streams lazily, so a bad cold start is not the exception: it is
 * exactly the state the service is in right after a deploy, which is also when a link gets shared.
 * ⭐ Waiting longer used to be a nicety because the fallback caught the overrun; with local decode
 * off it is the ONLY good outcome, so the budget buys what it is now worth (owner, 2026-09-04:
 * *"server coldsa da sadece warning çıkması gerekmez mi"* — and it does, `wakingServer`).
 */
const WARMUP_WAIT_MS = 120_000;

/** How often to ask a warming server whether it is ready yet. `/health` is cheap by contract. */
const WARMUP_POLL_MS = 1_000;

/**
 * The decode server's URL, or "" for the all-browser build.
 *
 * `VITE_DECODE_URL` is the build-time flag the ladder calls for — the swap is behind a flag so the
 * browser path stays live and switchable. `localStorage.omrDecodeUrl` overrides it at runtime,
 * which is how a deployed build gets pointed at a local server without a rebuild.
 */
export function decodeUrl(): string {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("omrDecodeUrl") : null;
  const url = (stored ?? import.meta.env.VITE_DECODE_URL ?? "") as string;
  return url.trim().replace(/\/$/, "");
}

/**
 * May this machine run the model when a server was configured and did not answer?
 *
 * The default is NO (owner, 2026-09-04). Three things follow, and the third is why this is a
 * function rather than a deleted branch:
 *
 *  - A build with no `VITE_DECODE_URL` never reaches this question. There the browser is not a
 *    fallback, it IS the pipeline — `dev:web`, `gate:browser`, `smoke:page` and the parity checks
 *    all live there and are untouched.
 *  - A deploy sets neither flag, so a dead or cold server is an error the user can act on.
 *  - `smoke:build` still has to prove the BUILT bundle can decode locally — that is what catches
 *    the inlined-worker-glue class of bug — so it opts in explicitly.
 *
 * `localStorage` mirrors `omrDecodeUrl` above: a runtime override, so a harness (or we) can turn
 * it on against an already-deployed build without a rebuild.
 */
export function localDecodeAllowed(): boolean {
  const stored =
    typeof localStorage !== "undefined" ? localStorage.getItem("omrAllowLocalDecode") : null;
  const flag = (stored ?? import.meta.env.VITE_ALLOW_LOCAL_DECODE ?? "") as string;
  return flag.trim() === "1";
}

/**
 * The server was configured, it did not serve, and reading on this machine is not allowed.
 *
 * A distinct type because it is a distinct FACT: not "the read failed" but "the read was refused
 * on purpose". `ui/errors.ts` maps it to its own `data-error-kind`, so a check can tell the policy
 * holding from the model breaking — and `.cause` keeps what the server actually did.
 */
export class LocalDecodeRefusedError extends Error {
  constructor(readonly because: string) {
    super(`decode server unavailable and local decode is off: ${because}`);
    this.name = "LocalDecodeRefusedError";
  }
}

/**
 * A 503 that means "loading, ask again" rather than "broken".
 *
 * The distinction is the whole fix: every OTHER failure — offline, CORS, 500, 413, 429, a malformed
 * reply — must still fall back immediately, because none of them get better by waiting.
 */
class ServerWarmingError extends Error {}

/** The subset of `/health` this file acts on. `ready` is the fact; `error` means a load FAILED. */
interface HealthReply {
  ready?: boolean;
  error?: string;
}

async function health(url: string, signal?: AbortSignal): Promise<HealthReply | null> {
  try {
    const res = await fetch(`${url}/health`, { signal });
    // A 503 here is `loadError` — a genuine failure, and the body says so.
    return (await res.json()) as HealthReply;
  } catch {
    return null;
  }
}

/**
 * Wake the decode server, without waiting for it.
 *
 * Called once when the app opens: by the time a user has picked a file, a container that was asleep
 * is already loading its graphs, so the upload finds it ready and never pays the wait above. This
 * is option 1 of `docs/mvp/latency.md`, and it is a companion to the retry rather than a substitute
 * — someone who drops a file in immediately still needs the retry to hold the page.
 *
 * Deliberately fire-and-forget: it must never delay first paint, and a server that is down is not
 * this function's problem — the upload path already handles that.
 */
export function warmDecodeServer(): void {
  const url = decodeUrl();
  if (!url) return;
  void health(url);
}

/**
 * Wait until the server reports `ready`, or until the budget runs out.
 *
 * Returns true if it became ready. A load that has actually FAILED (`error` set) returns false at
 * once — retrying a broken container is just a slower way to fall back.
 */
async function waitForReady(url: string, budgetMs: number, signal?: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return false;
    const h = await health(url, signal);
    if (h?.error) return false;
    if (h?.ready) return true;
    await new Promise((r) => setTimeout(r, WARMUP_POLL_MS));
  }
  return false;
}

interface ServerStripReply {
  system: number;
  window: number;
  name?: string;
  ids: number[];
  logprobs: number[];
  tokens: string;
  hitCap: boolean;
  minLogprob: number;
  meanLogprob: number;
}

/**
 * POST a page's strips and return what the server read.
 *
 * One request for the whole page, deliberately: batching the encoder across the page is the
 * structural reason the server is faster than a browser at all, and chunking would give that back
 * for a progress bar. The wait is reported by elapsed time instead.
 */
async function postStrips(
  url: string,
  meta: ModelMeta,
  strips: readonly StripInput[],
  opts: DecodeOptions
): Promise<DecodedStripResult[]> {
  const { width, height } = meta.preprocess.size;
  const payload = strips.map((s) => ({
    system: s.system,
    window: s.window,
    name: s.name,
    png: preprocessToCanvas(s.image, width, height).toDataURL("image/png").split(",")[1]!,
  }));

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  const res = await fetch(`${url}/decode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ strips: payload }),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const message = `server ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`;
    // 503 is the server's readiness answer. It says which kind it is in the body — "model still
    // loading" is worth waiting for, "model failed to load" is not. Matching the text is safe
    // because both strings are produced by `apps/server/src/index.ts` in this repo, and the
    // no-match case simply falls back as before.
    if (res.status === 503 && !/failed to load/i.test(detail)) throw new ServerWarmingError(message);
    throw new Error(message);
  }

  const reply = (await res.json()) as { strips?: ServerStripReply[] };
  if (!Array.isArray(reply.strips) || reply.strips.length !== strips.length)
    throw new Error(`server returned ${reply.strips?.length ?? 0} strips for ${strips.length}`);

  return reply.strips.map((d, i) => ({
    ids: d.ids,
    logprobs: d.logprobs,
    tokens: d.tokens,
    hitCap: d.hitCap,
    minLogprob: d.minLogprob,
    meanLogprob: d.meanLogprob,
    // Timing fields belong to the client's own clock; the server's are in its reply and are not
    // what the UI means by "how long did this take me".
    encoderMs: 0,
    decodeMs: 0,
    system: strips[i]!.system,
    window: strips[i]!.window,
    name: strips[i]!.name,
  }));
}

/**
 * Decode a page's strips: on the server when one is configured, on this machine when one is not.
 *
 * ⚠ Those are the only two normal outcomes. A configured server that fails throws
 * `LocalDecodeRefusedError` rather than quietly becoming the third — see `localDecodeAllowed()`.
 *
 * A user's own abort is NOT a failure. If someone picks a different file mid-decode, neither an
 * error about the file they abandoned nor a local decode of it would be of any help.
 */
export async function decodeStripsRouted(
  strips: readonly StripInput[],
  opts: DecodeOptions = {}
): Promise<RoutedResult> {
  const url = decodeUrl();
  let fellBackBecause: string | undefined;

  if (url) {
    try {
      opts.onProgress?.(0, strips.length, "server");
      const meta = await getMeta();
      let decoded: DecodedStripResult[];
      try {
        decoded = await postStrips(url, meta, strips, opts);
      } catch (err) {
        if (!(err instanceof ServerWarmingError) || opts.signal?.aborted) throw err;
        // The container is booting. Say so — a wait nobody explained looks like a hang — then ask
        // again once it is ready. One retry: if a server that just told us it was ready fails the
        // second attempt, that is a real failure and the fallback is the right answer.
        opts.onProgress?.(0, strips.length, "waking");
        if (!(await waitForReady(url, WARMUP_WAIT_MS, opts.signal))) throw err;
        opts.onProgress?.(0, strips.length, "server");
        decoded = await postStrips(url, meta, strips, opts);
      }
      opts.onProgress?.(strips.length, strips.length);
      return { strips: decoded, where: "server" };
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      fellBackBecause = err instanceof Error ? err.message : String(err);
      // The policy, not a failure path: a configured server that misses is an error the user is
      // told about, unless someone has deliberately asked for the local read.
      if (!localDecodeAllowed()) throw new LocalDecodeRefusedError(fellBackBecause);
      console.warn("decode server unavailable, falling back to this browser:", err);
    }
  }

  const { sessions, meta } = await getModel();
  const decoded = await decodeStrips(sessions, meta, strips, opts);
  return { strips: decoded, where: "browser", fellBackBecause };
}
