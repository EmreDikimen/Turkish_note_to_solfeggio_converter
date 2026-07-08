/**
 * Repeat-sign recovery for the flattened SymbTr scores (Phase 2).
 *
 * SymbTr has no repeat markers — repeats are FLATTENED, so a repeated passage appears twice in a
 * row in the data. That makes the original structure recoverable: find adjacent duplicate measure
 * runs and fold the second pass back into repeat signs, which puts the signs where the original
 * engraver had them (verified against the printed gamzedeyim score: bars 5–6 = its aranağme
 * repeat, 15–18 = its printed 1./2. voltas). Folding is the inverse of the Phase-4 decoder step
 * that expands recognized repeats back out.
 *
 * DETECTION ONLY — the document is never modified. The rendered sheet keeps the full flattened
 * score (so layout, playback, and the playhead stay untouched); the detected spans only say where
 * to DRAW the signs (SheetView) and where the strip labels get the matching tokens (serializer) —
 * same spans on both sides, so a strip's pixels and label can't disagree. The duplicate second
 * pass stays on the page without signs; strips are 1–3 measures, so that's invisible to training.
 * (Random injection for token coverage is a separate Rung-2 renderer step.)
 */

import { eventBeats, groupMeasures, type Measure, type NoteModelDocument } from "@turkish-omr/core";
import { mulberry32 } from "./rng";

/** One detected repeat span, in 1-based `Measure.index` numbering (the doc is unmodified, so
 *  these are exactly the indices SheetView draws and the strip exporter sees). */
export interface RepeatSpan {
  /** First measure inside the repeat — the `‖:` begin barline draws at its left edge. */
  start: number;
  /** Last measure of the first pass — the `:‖` end barline draws at its right edge. */
  end: number;
  /** Volta case (the passes differ in their final measure): the bar carrying the "2." bracket —
   *  the measure right after the `:‖`, as engraved ("2." always starts at the repeat-end barline).
   *  `end` then carries the "1." bracket. Since the doc keeps the flattened second pass, the notes
   *  under the bracket are the duplicate head, not the true second ending (which stays unmarked at
   *  the pass's end) — drawn positions only, same as everything else here. */
  volta2?: number;
}

/** Runs shorter than this don't fold: two identical bars in a row are often genuinely played
 *  twice as written, and engravers rarely fold a single bar. */
const MIN_RUN = 2;
const MAX_RUN = 12;

/** Musical fingerprint of a measure: pitch + duration of every event (grace notes by pitch
 *  with the "g" tag so passes differing only in an ornament don't fold). Lyrics are
 *  deliberately ignored — verses differ between passes of the same repeated music. */
function fingerprint(m: Measure): string {
  return m.events
    .map((e) => {
      const head =
        e.kind === "note" ? `${e.noteName}@${e.koma53}`
        : e.kind === "grace" ? `g${e.noteName}@${e.koma53}`
        : "r";
      return `${head}:${eventBeats(e).toFixed(4)}`;
    })
    .join("|");
}

/**
 * Detect adjacent duplicate measure runs — the flattened form of a repeat — and return the spans
 * where the signs are drawn: `‖:`/`:‖` around the FIRST pass, voltas when only the final measure
 * differs. Greedy left-to-right, longest run first. The doc itself is untouched; the duplicate
 * second pass stays rendered (removing it would re-flow the sheet and desync the playhead).
 */
export function detectRepeats(doc: NoteModelDocument): RepeatSpan[] {
  const measures = groupMeasures(doc);
  const keys = measures.map(fingerprint);
  const spans: RepeatSpan[] = [];

  for (let i = 0; i < measures.length; ) {
    let advanced = false;
    for (let L = Math.min(MAX_RUN, Math.floor((measures.length - i) / 2)); L >= MIN_RUN && !advanced; L--) {
      let same = 0;
      for (let k = 0; k < L; k++) if (keys[i + k] === keys[i + L + k]) same++;
      if (same === L) {
        // Exact repeat: signs wrap the first pass.
        spans.push({ start: measures[i]!.index, end: measures[i + L - 1]!.index });
        i += 2 * L;
        advanced = true;
      } else if (same === L - 1 && keys[i + L - 1] !== keys[i + 2 * L - 1]) {
        // Same head, different final measure → 1./2. endings: "1." over the first pass's last
        // measure, "2." on the measure immediately after the `:‖` — real engraving never separates
        // the "2." bracket from the repeat-end barline. (That measure holds the duplicate head, not
        // the differing ending, but only the drawn position matters — see RepeatSpan.volta2.)
        let headMatches = true;
        for (let k = 0; k < L - 1; k++) if (keys[i + k] !== keys[i + L + k]) headMatches = false;
        if (headMatches) {
          spans.push({
            start: measures[i]!.index,
            end: measures[i + L - 1]!.index,
            volta2: measures[i + L]!.index,
          });
          i += 2 * L;
          advanced = true;
        }
      }
    }
    if (!advanced) i++;
  }
  return spans;
}

/**
 * Rung-2 dataset coverage: SymbTr itself contains zero repeats, and `detectRepeats` fires only on
 * flattened duplicates — far too rare to teach the repeat tokens. This adds SEEDED RANDOM spans on
 * top of the detected ones, so a chosen fraction of renders carries repeat signs. The injected
 * signs are visually correct engraving but musically arbitrary (the "repeated" music isn't really
 * a repetition) — fine for training, which only maps drawn symbols to tokens; Phase-4 semantics
 * never consumes these synthetic strips.
 *
 * Same `RepeatSpan` shape as detection, so drawing (SheetView), labeling (`serializeMeasures`) and
 * the faithful one-visible-end-only crop rule all work unchanged. Deterministic per seed: the PRNG
 * call sequence is fixed (rejected candidates still consume their draws), so the same
 * `hashStr("{slug}:{transpose}")` seed always yields the same spans.
 */
export function injectRepeats(
  doc: NoteModelDocument,
  seed: number,
  detected: readonly RepeatSpan[] = [],
): RepeatSpan[] {
  const indices = groupMeasures(doc).map((m) => m.index);
  const spans: RepeatSpan[] = [...detected];
  if (indices.length < 3) return spans;

  // Measures already carrying signs, ±1 buffer — an injected `‖:` must never share a barline
  // (or sit ambiguously adjacent) with an existing `:‖`.
  const covered = new Set<number>();
  const cover = (s: RepeatSpan) => {
    for (let i = s.start - 1; i <= (s.volta2 ?? s.end) + 1; i++) covered.add(i);
  };
  detected.forEach(cover);

  const rand = mulberry32(seed);
  const attempts = 2 + Math.floor(rand() * 3); // 2–4 candidate spans per render
  for (let n = 0; n < attempts; n++) {
    const len = 2 + Math.floor(rand() * 3); // 2–4 measures, like real short repeats
    const lastPos = indices.length - len;
    if (lastPos < 0) continue;
    const pos = Math.floor(rand() * (lastPos + 1));
    // ~30% get 1./2. voltas, when a measure exists after the span to carry the "2." bracket.
    const withVolta = rand() < 0.3 && pos + len < indices.length;
    const span: RepeatSpan = withVolta
      ? { start: indices[pos]!, end: indices[pos + len - 1]!, volta2: indices[pos + len]! }
      : { start: indices[pos]!, end: indices[pos + len - 1]! };
    let free = true;
    for (let i = span.start - 1; i <= (span.volta2 ?? span.end) + 1; i++) {
      if (covered.has(i)) free = false;
    }
    if (!free) continue; // overlap → drop the candidate (draws stay consumed for determinism)
    spans.push(span);
    cover(span);
  }
  return spans.sort((a, b) => a.start - b.start);
}

/** The spans touching one measure, resolved to what is drawn on it (for draw + label emission). */
export function repeatMarksAt(index: number, spans: readonly RepeatSpan[] | undefined) {
  const starts = spans?.some((s) => s.start === index) ?? false;
  const ending = spans?.find((s) => s.end === index);
  return {
    /** `‖:` at this measure's left edge. */
    repStart: starts,
    /** `:‖` at this measure's right edge. */
    repEnd: ending != null,
    /** "1." bracket over this measure. */
    volta1: ending?.volta2 != null,
    /** "2." bracket over this measure. */
    volta2: spans?.some((s) => s.volta2 === index) ?? false,
  };
}
