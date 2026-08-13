/**
 * Fetch and decode one drum kit's six samples.
 *
 * Shaped after `omr/session.ts`, which does the same job for the model weights: a base URL resolved
 * from an env var, and a memoised promise that resets on failure so one bad attempt does not poison
 * every later one.
 *
 * ⚠ **The prediction this header used to make came true and was answered differently, so read the
 * answer rather than re-deriving it.** It said F1's instrument voices would outgrow
 * `prune-dist.mjs`'s budget and the fix would be to point `VITE_AUDIO_URL` at a Hub repo — "no call
 * site changes". F1 arrived at 20–35 MB per voice, and the owner ruled on 2026-08-12 that **the
 * drums stay with the app**: percussion is essential to playback and must not depend on a second
 * host, and 660 KB fits under the budget with room to spare.
 *
 * So the voices got **their own** variable (`VITE_VOICES_URL`, in `loadInstrument.ts`) and this one
 * stays unset. ⚠ **Do not set `VITE_AUDIO_URL` in a deploy.** It is the base for the whole `audio/`
 * tree, so pointing it at the voices' repo would take the drums with it, 404 them, and drop
 * percussion back to the synthesis the owner rejected by ear — silently, because the fallback still
 * makes a sound. The indirection stays because it costs nothing and a third kit might yet need it.
 *
 * A consequence worth keeping: `MAX_AUDIO_MB = 1` in `prune-dist.mjs` is therefore a PERMANENT guard
 * on these files rather than a trigger that has now fired. (docs/DECISIONS.md, 2026-08-11/12.)
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
