/**
 * Fetch and decode one drum kit's six samples.
 *
 * Shaped after `omr/session.ts`, which does the same job for the model weights: a base URL resolved
 * from an env var, and a memoised promise that resets on failure so one bad attempt does not poison
 * every later one.
 *
 * ⚠ **Why the base URL is indirected today when nothing needs it.** The kits are ~660 KB and ship
 * from `public/audio/`, which is why `VITE_AUDIO_URL` is unset. F1's instrument voices are the
 * reason it exists anyway: a sampled instrument is ~25 notes at ~4 MB, and four of them would not
 * fit under `prune-dist.mjs`'s budget. When that happens the fix is to point this at a Hub repo and
 * upload — no call site changes. Adding the indirection after the fact would have meant changing
 * every caller and re-arguing a settled decision (docs/DECISIONS.md, 2026-08-11).
 */
import type { Stroke } from "@turkish-omr/core";
import { findKit, type KitId } from "./strokeKits";

/** Unset in dev and in today's deployed build; a Hub URL once the audio outgrows the app. */
const AUDIO_BASE = ((import.meta.env.VITE_AUDIO_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/$/, "");

const fileUrl = (rel: string) => (AUDIO_BASE ? `${AUDIO_BASE}/${rel}` : `/audio/${rel}`);

export type StrokeBuffers = Map<Stroke, AudioBuffer[]>;

const pending = new Map<KitId, Promise<StrokeBuffers>>();

/**
 * ⚠ No Cache Storage here, deliberately, though `session.ts` uses it. That exists because 211 MB is
 * not something to re-download; 660 KB behind an ordinary HTTP cache is, and a second caching layer
 * would be a second thing to invalidate when a kit is re-cut.
 *
 * The buffers belong to `ctx` and are only valid for it — which is safe because the backend keeps
 * ONE context for the life of the page (the F0 refactor). If that ever stops being true, this
 * memo has to be keyed by context too.
 */
export function loadStrokeKit(ctx: AudioContext, id: KitId): Promise<StrokeBuffers> {
  const existing = pending.get(id);
  if (existing) return existing;

  const kit = findKit(id);
  if (!kit) return Promise.reject(new Error(`unknown percussion kit ${id}`));

  const run = (async () => {
    const strokes = Object.keys(kit.files) as Stroke[];
    const decoded = await Promise.all(
      strokes.map(async (stroke) => {
        const takes = await Promise.all(
          kit.files[stroke].map(async (rel) => {
            const url = fileUrl(rel);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`percussion sample ${res.status} from ${url}`);
            // `decodeAudioData` takes ownership of the ArrayBuffer, so each take needs its own.
            return ctx.decodeAudioData(await res.arrayBuffer());
          }),
        );
        return [stroke, takes] as const;
      }),
    );
    return new Map(decoded) as StrokeBuffers;
  })();

  pending.set(id, run);
  run.catch(() => pending.delete(id));
  return run;
}
