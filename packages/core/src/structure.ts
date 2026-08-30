/**
 * Written score → playing order. The one place that knows a bar can sound more than once.
 *
 * A printed page writes a repeated passage ONCE, between `‖:` and `:‖`. The old pipeline threw
 * that away: the stitcher expanded every repeat, so the sheet showed the music twice and no sign
 * anywhere. Now the document keeps the WRITTEN score — what a person reads and edits — and the
 * performance is a separate, derived thing: a list of bar numbers in the order they sound
 * (`playBars`, produced by the stitcher).
 *
 * `unfoldDoc` turns that list back into an ordinary flat document, which is all the audio side
 * ever wanted: `buildTimeline`, the metronome, the usul strokes and the transpose/makam paths are
 * untouched, because they still receive a plain document whose events run start to finish.
 *
 * The one extra thing it returns is `srcOf`: for every event of the unfolded document, WHICH
 * written event it came from. That is what keeps sound and picture together — the playhead reads
 * the clock against the unfolded timeline, looks the sounding event up in `srcOf`, and puts the
 * cursor on the one written note that is drawn on the page. On the second pass through a repeat
 * the same written notes come round again, so the cursor jumps back to the `‖:` on its own.
 *
 * Unfolding is a pure re-ordering: nothing is transposed, re-spelled or re-timed, and unfolding a
 * score whose `playBars` is simply 1..N returns the same music in the same order. So the sound
 * cannot drift from what the old flattened pipeline produced.
 */

import { groupMeasures } from "./measures";
import type { NoteEvent, NoteModelDocument } from "./types";

export interface UnfoldedScore {
  /** The performance as a flat document — bars renumbered 1..N in playing order. */
  doc: NoteModelDocument;
  /** Unfolded event `index` → the WRITTEN event `index` it was copied from. */
  srcOf: Map<number, number>;
  /** Written bar number → the ms at which it FIRST sounds. What "play from this bar" needs:
   *  a bar inside a repeat has two start times, and the first one is the one a click means. */
  firstStartMs: Map<number, number>;
  /** True when the playing order actually differs from the written order. */
  folded: boolean;
}

/**
 * Expand a written document into its performance.
 *
 * `playBars` holds WRITTEN bar numbers (1-based, as `groupMeasures` numbers them) in playing
 * order; a bar that plays twice appears twice. Pass `null`/`undefined` for a score with no
 * structure — the document comes back untouched, with the identity mapping, so callers need no
 * branch of their own.
 *
 * Bar numbers that name nothing are skipped with no fuss: the structure comes from a MODEL
 * reading a photograph, so it can point at a bar that the same decode dropped, and a missing bar
 * is a reason to play less music, never to fail.
 */
export function unfoldDoc(
  doc: NoteModelDocument,
  playBars: readonly number[] | null | undefined,
): UnfoldedScore {
  const measures = groupMeasures(doc);
  const byBar = new Map(measures.map((m) => [m.index, m]));
  const order = (playBars ?? measures.map((m) => m.index)).filter((b) => byBar.has(b));

  const srcOf = new Map<number, number>();
  const firstStartMs = new Map<number, number>();
  const events: NoteEvent[] = [];
  let bar = 0;
  let ms = 0;
  let folded = false;

  for (const [at, barNo] of order.entries()) {
    if (barNo !== measures[at]?.index) folded = true; // playing order left the written order
    const m = byBar.get(barNo)!;
    if (!firstStartMs.has(barNo)) firstStartMs.set(barNo, ms);
    bar++;
    // `offset` is the barline encoding `assignBars` reads back (integer = one barline), so it is
    // rebuilt per copy — carrying the written value over would put every repeated bar back where
    // it was first written and collapse the whole performance into one bar's worth of numbering.
    const barBeats = m.lengthBeats;
    let cum = 0;
    for (const ev of m.events) {
      const beats = ev.durationBeats.den === 0 ? 0 : ev.durationBeats.num / ev.durationBeats.den;
      const index = events.length + 1;
      srcOf.set(index, ev.index);
      events.push({
        ...ev,
        index,
        bar,
        offset:
          barBeats > 0
            ? bar - 1 + (ev.kind === "grace" ? cum : cum + beats) / barBeats
            : bar - 1,
      });
      if (ev.kind !== "grace") {
        cum += beats;
        ms += ev.durationMs;
      }
    }
  }
  if (order.length !== measures.length) folded = true;

  return { doc: { ...doc, events }, srcOf, firstStartMs, folded };
}
