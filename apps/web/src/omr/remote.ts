/**
 * Decode on the server, and fall back to the browser when that does not work (MVP W9, step 3).
 *
 * The client's half of the contract in `apps/server/src/index.ts`: preprocess each crop exactly as
 * the in-browser path does, POST the finished 409×583 PNGs, get tokens back. The seam and why it
 * sits after preprocessing rather than before are written up in `./pixels`.
 *
 * **The fallback is the load-bearing part of this file, not a nicety.** Cloud Run scales to zero
 * and a ~1 GB container costs 10–30 s to wake; a friend who cannot debug anything must never see
 * "the app is broken" because a free-tier container was asleep or a deploy was mid-flight. So any
 * failure — offline, 5xx, 429, timeout, malformed reply — routes to `decodeStrips` and the user is
 * told their own machine is doing it this time. That is also why `docs/mvp/deploy.md` forbids
 * deleting the in-browser path: it is the reference the server is checked against AND the live
 * fallback.
 *
 * Consequence worth stating: the weights are fetched **lazily, only if the fallback fires**. On
 * the normal path the browser never downloads the ~211 MB.
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
    throw new Error(`server ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
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
 * Decode a page's strips wherever they can be decoded: server first when one is configured, this
 * machine otherwise — or when the server does not answer.
 *
 * A user's own abort is NOT a fallback trigger. If someone picks a different file mid-decode,
 * starting a 25-second local decode of the file they abandoned would be the opposite of helpful.
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
      const decoded = await postStrips(url, meta, strips, opts);
      opts.onProgress?.(strips.length, strips.length);
      return { strips: decoded, where: "server" };
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      fellBackBecause = err instanceof Error ? err.message : String(err);
      console.warn("decode server unavailable, falling back to this browser:", err);
    }
  }

  const { sessions, meta } = await getModel();
  const decoded = await decodeStrips(sessions, meta, strips, opts);
  return { strips: decoded, where: "browser", fellBackBecause };
}
