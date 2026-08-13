/**
 * Fetch and decode one instrument voice's samples.
 *
 * Shaped after `omr/session.ts` rather than after its neighbour `loadStrokeKit.ts`, and the three
 * places it differs from that neighbour are all consequences of size — a drum kit is 660 KB, a voice
 * is 20–35 MB. They are commented where they occur, because each one looks like a bug against the
 * file next door.
 *
 * ⚠ **Its base URL is its own, deliberately not shared with the drums** (owner, 2026-08-12). The
 * drums are essential to playback and keep shipping with the app from `/audio/`; only the voices
 * come from a Hugging Face dataset repo. `loadStrokeKit.ts` resolves `VITE_AUDIO_URL` for the whole
 * `audio/` tree, so pointing THAT at the voices' repo would move the percussion off the app with it
 * and regress it to synthesis — silently, because the fallback still makes a sound. Two variables,
 * two homes, two independent failure modes. Do not merge them back into one.
 */
import { findVoice, type VoiceId } from "./instruments";

/**
 * The Hub repo the voices are served from. Unset in dev and in any build that has not been given
 * one — and unlike the drums there is deliberately **no local fallback path**, because nothing under
 * `public/` holds these files and never will (`prune-dist.mjs` caps the app's audio at 1 MB). Unset
 * therefore means "voices unavailable", which the picker reports and playback survives.
 */
const VOICES_BASE = ((import.meta.env.VITE_VOICES_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/$/, "");

export function voicesAvailable(): boolean {
  return VOICES_BASE.length > 0;
}

/**
 * Join the base to a manifest path, escaping each segment.
 *
 * ⚠ **Not cosmetic, and not something `loadStrokeKit` needs.** These filenames are the library's
 * originals, and a sampled instrument has sharps in its pitch names — `DCClar_susLong_A#2_...wav`.
 * `#` begins a URL fragment, so pasting the path in raw truncates the request to
 * `…/clarinet/DCClar_susLong_A` and fetches a 404 while looking completely correct in the source.
 * Measured: it took out 3 of the clarinet's 11 samples. The drums never hit this because their names
 * are generated (`dum-rr1.wav`); these are not, deliberately, because the name is the provenance.
 */
function voiceUrl(rel: string): string {
  return `${VOICES_BASE}/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

/** Bump when a voice's file list changes, so a stale cached copy cannot outlive the manifest. */
const CACHE_NAME = "omr-voices-v1";

/** One decoded sample, with the pitch it was recorded at. Ascending by `hz`, like the manifest. */
export interface VoiceBuffer {
  hz: number;
  buffer: AudioBuffer;
}

/**
 * ⚠ Only in-flight loads live here, and each entry is deleted once it settles — the opposite of
 * `loadStrokeKit`'s memo, which keeps its resolved promises for the life of the page.
 *
 * That is right for six small drums and wrong here: holding both voices resolved would pin ~47 MB of
 * decoded violin in memory after the user has switched back to the clarinet. The backend owns the
 * decoded buffers and deliberately keeps exactly one voice; this map exists only so two concurrent
 * requests for the same voice share one download. Cache Storage is what makes switching back cheap.
 */
const pending = new Map<VoiceId, Promise<VoiceBuffer[]>>();

/**
 * One sample's bytes, from the Cache Storage copy when there is one.
 *
 * ⚠ `loadStrokeKit.ts` says Cache Storage is deliberately absent, and that reasoning does not
 * survive the size change: 660 KB behind an ordinary HTTP cache is cheap to re-fetch, 20–35 MB over
 * a phone connection is not. So this copies `graphBytes` in `omr/session.ts` — including its two
 * non-obvious moves: clone before reading the body (`put` consumes it), and never let a cache write
 * break the load, since quota is finite.
 */
async function sampleBytes(url: string): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  try {
    cache = typeof caches !== "undefined" ? await caches.open(CACHE_NAME) : null;
  } catch {
    cache = null;
  }

  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) return hit.arrayBuffer();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`voice sample ${res.status} from ${url}`);
  const forCache = res.clone();
  const bytes = await res.arrayBuffer();
  cache?.put(url, forCache).catch(() => undefined);
  return bytes;
}

/**
 * Load every sample of one voice. Concurrent callers share one load; a failure resets, so one bad
 * attempt does not poison every later one.
 *
 * `onProgress` reports whole files rather than bytes, which is why the fetches are SEQUENTIAL —
 * the same reasoning `session.ts` gives for loading its graphs one at a time. Fifteen simultaneous
 * decodes of a 2–3 MB stereo wav spike memory for no wall-clock gain on a bandwidth-bound download,
 * and "5 / 15" is an honest thing to put in front of someone waiting.
 */
export function loadInstrument(
  ctx: AudioContext,
  id: VoiceId,
  onProgress?: (done: number, total: number) => void,
): Promise<VoiceBuffer[]> {
  const existing = pending.get(id);
  if (existing) return existing;

  const voice = findVoice(id);
  if (!voice) return Promise.reject(new Error(`unknown voice ${id}`));
  if (!voice.samples.length) return Promise.resolve([]);
  if (!VOICES_BASE) {
    return Promise.reject(new Error("no voice host configured (VITE_VOICES_URL is unset)"));
  }

  const run = (async () => {
    const out: VoiceBuffer[] = [];
    for (const s of voice.samples) {
      const bytes = await sampleBytes(voiceUrl(s.rel));
      // `decodeAudioData` takes ownership of the ArrayBuffer, so nothing may reuse it afterwards.
      out.push({ hz: s.hz, buffer: await ctx.decodeAudioData(bytes) });
      onProgress?.(out.length, voice.samples.length);
    }
    return out;
  })();

  pending.set(id, run);
  // Settled either way: see the note on `pending`. A resolved entry kept here would be a leak.
  void run.then(
    () => pending.delete(id),
    () => pending.delete(id),
  );
  return run;
}
