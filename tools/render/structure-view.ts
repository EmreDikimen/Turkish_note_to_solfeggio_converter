/**
 * Decoded page structure → the shapes the sheet already knows how to draw.
 *
 * `stitch.ts` reports what signs the model read as per-bar flags (`ScoreStructure`). The sheet
 * draws repeats as `RepeatSpan`s (repeats.ts) and navigation marks as `NavMark`s (navmarks.ts) —
 * shapes that already exist, are already engraved by SheetView, and are already turned into
 * `\repstart` / `\volta1` / `\segno` … tokens by the strip serializer. Converting here means the
 * decoded page reuses ALL of that: no second drawing path, and the signs on a decoded page's
 * strips still carry the same tokens the same ink would carry on a synthetic one.
 *
 * Nothing here decides musical behaviour. What the signs make the music DO is `playBars`, which
 * the stitcher resolved once; this file only says where the ink goes.
 */

import type { RepeatSpan } from "./repeats";
import type { NavMark } from "./navmarks";
import type { ScoreStructure } from "./stitch";

/**
 * Repeat spans for the sheet, from the per-bar flags.
 *
 * Same pairing rule as the stitcher's own expansion, so the drawn `‖:` is always the one the
 * playback jumped back to: an unmatched `:‖` belongs to a span that opened where the previous
 * one ended (the engraving convention — a piece may simply repeat from the top).
 *
 * ⚠ An unmatched `‖:` draws NOTHING, on purpose. The stitcher plays that passage once (there is no
 * `:‖` telling it to come back), and a `‖:` on the staff with nothing closing it would promise a
 * repeat the music does not take — the sheet would then disagree with the sound, which is the one
 * thing this whole path exists to prevent. 7.7% of pages carrying repeat tokens are in this state
 * (docs/METRICS.md).
 *
 * ⚠ The "1." is drawn where the stitcher resolved the first ending to START, which is not always the
 * `:‖` bar — a two-bar first ending opens one bar earlier, and 26.7% of real ones do. ⚠ Its BRACKET
 * is still one bar wide (the line does not stretch over the whole ending): the drawn position and
 * the playback agree, the drawn LENGTH is cosmetic and is left alone because `repeatMarksAt` also
 * emits the strip labels, where a token belongs to exactly one measure.
 *
 * ⚠ The volta pair is drawn whenever EITHER bracket was read. `repeatMarksAt` derives "1." from
 * the presence of a "2.", so a page whose faint "1." the model missed would otherwise lose both.
 * Real engraving never prints one bracket alone, and the brackets change no sound — `playBars`
 * already carries what the volta does.
 */
export function repeatSpansFromStructure(structure: ScoreStructure, lastBar: number): RepeatSpan[] {
  const marks = new Map(structure.bars.map((b) => [b.bar, b]));
  const spans: RepeatSpan[] = [];
  let openStart: number | null = null;
  let passStart = 1;

  for (const b of [...structure.bars].sort((x, y) => x.bar - y.bar)) {
    if (b.repStart) openStart = b.bar;
    if (!b.repEnd) continue;
    const start = openStart ?? passStart;
    const end = b.bar;
    // The stitcher already decided which bars the first ending covers (and threw out a "1." too far
    // from its `:‖` to be one). Reading its answer rather than re-deriving it is what keeps the
    // drawn bracket over the bars the second pass actually skips.
    const ending = structure.firstEndings.find((e) => e.to === end);
    const hasVolta = ending != null || (marks.get(end + 1)?.volta2 ?? false);
    spans.push(
      hasVolta && end < lastBar
        ? { start, end, volta2: end + 1, ...(ending && ending.from !== end ? { volta1: ending.from } : {}) }
        : { start, end },
    );
    openStart = null;
    passStart = end + 1;
  }
  return spans;
}

/** Navigation marks for the sheet, from the per-bar flags. Edges match the injection convention
 *  (navmarks.ts): 𝄋 and the coda DESTINATION open a bar, "D.C." / "Son" and the coda JUMP POINT
 *  close one — which is where a printed page puts them. */
export function navMarksFromStructure(structure: ScoreStructure): NavMark[] {
  const marks: NavMark[] = [];
  for (const b of structure.bars) {
    if (b.segno) marks.push({ type: "segno", measure: b.bar, at: "start" });
    if (b.codaOrder != null) marks.push({ type: "coda", measure: b.bar, at: b.codaOrder === 0 ? "end" : "start" });
    if (b.dc) marks.push({ type: "dc", measure: b.bar, at: "end" });
    if (b.fine) marks.push({ type: "fine", measure: b.bar, at: "end" });
  }
  return marks.sort((a, b) => a.measure - b.measure);
}
