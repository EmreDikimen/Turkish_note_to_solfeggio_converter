/**
 * Seeded AEU-enharmonic respelling (Rung-2 dataset balancing).
 *
 * Problem: the headline metric is per-class accuracy over all 8 AEU accidentals, but the corpus
 * can't supply two of them — the whole of SymbTr contains ~47 notes at ≥6 commas, and
 * smallest-alteration respelling never exceeds ±5 (adjacent letters sit 4 or 9 commas apart), so
 * `\buyukSharp`/`\buyukFlat` would have ~zero training examples.
 *
 * Fix: every koma-level accidental has an EXACT enharmonic on the adjacent letter when the letter
 * gap is 9 commas — e.g. Re♯¹ (koma sharp) is the same pitch as Mi♭⁸ (büyük mücennep flat). This
 * transform flips a seeded fraction of eligible notes to that enharmonic spelling. Only
 * `noteName` changes: the pitch (`koma53`, audio) is untouched, and since BOTH the engraver
 * (SheetView) and the labeler (noteToLily) read `noteName`, pixels and labels stay consistent by
 * construction — the strip simply shows (and is labeled with) the other, equally-valid AEU sign.
 *
 * How much is deliberately MODEST (decision 2026-07-05): büyük is rare in real photos too, so
 * force-balancing it to thousands of examples would distort the training distribution toward a
 * sign users may never upload, and risk false-büyük readings on ambiguous ink. But ZERO examples
 * is worse: a seq2seq decoder can never emit a token it never trained on, so an unseen büyük in a
 * real photo would be silently misread as a neighbouring sign — a confident 7-comma pitch error.
 * The flip rates below therefore target only a few hundred occurrences (~2% of accidentals):
 * enough to learn the glyph, too few to matter statistically. Common classes stay untouched
 * (no bakiye→kucuk flips — kucuk occurs naturally; accuracy on common signs is the priority).
 *
 * Flip table (drawn sign → enharmonic drawn sign):
 *   komaSharp (+1) → buyukFlat (−8)      komaFlat (−1) → buyukSharp (+8)
 */

import {
  naturalKoma,
  parseNoteName,
  spellNote,
  toAeuAlter,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { mulberry32 } from "./rng";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;

/** Flip probability per DRAWN sign (toAeuAlter of the exact alteration). Low on purpose — see
 *  the header: ~0.15 × ~3.6k komaSharps ≈ 540 büyükFlats, ~0.08 × ~9.7k komaFlats ≈ 780
 *  büyükSharps across the selected set — glyph-recognition coverage, not class rebalancing. */
const FLIP_P: Record<number, number> = { 1: 0.15, [-1]: 0.08 };

/**
 * Respell a seeded fraction of eligible notes to their AEU enharmonic. Deterministic: one PRNG
 * draw per note event (in document order) regardless of eligibility, so the same seed always
 * flips the same notes. Returns a new document; the input is never mutated.
 */
export function respellAeu(doc: NoteModelDocument, seed: number): NoteModelDocument {
  const rand = mulberry32(seed);
  const events = doc.events.map((ev) => {
    if (ev.kind !== "note") return ev;
    const r = rand(); // always drawn, so eligibility can't shift later notes' randomness
    const parsed = parseNoteName(ev.noteName);
    if (!parsed) return ev;
    const drawn = toAeuAlter(parsed.alterCommas);
    const p = FLIP_P[drawn];
    if (!p || r >= p) return ev;

    // Enharmonic target: sharps respell one letter UP (alter − gap), flats one letter DOWN
    // (alter + gap) — valid only where the letter gap is 9 commas (excludes E–F and B–C).
    const idx = LETTERS.indexOf(parsed.letter as (typeof LETTERS)[number]);
    if (idx < 0) return ev;
    const up = drawn > 0;
    const nIdx = idx + (up ? 1 : -1);
    if (nIdx < 0 || nIdx >= LETTERS.length) return ev; // B→C / C→B carry cases are gap-4 anyway
    const newLetter = LETTERS[nIdx]!;
    const gap = naturalKoma(newLetter, parsed.octave) - naturalKoma(parsed.letter, parsed.octave);
    if (Math.abs(gap) !== 9) return ev;
    const newAlter = parsed.alterCommas - gap;
    // Same pitch, different sign class — sanity-check the drawn result actually lands in the
    // intended (opposite-sign) class; if snapping says otherwise, leave the note alone.
    const newDrawn = toAeuAlter(newAlter);
    if (Math.sign(newDrawn) === Math.sign(drawn) || Math.abs(newDrawn) < 5) return ev;
    return { ...ev, noteName: spellNote(newLetter, parsed.octave, newAlter) };
  });
  return { ...doc, events };
}
