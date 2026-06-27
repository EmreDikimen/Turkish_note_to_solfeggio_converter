/**
 * Chromatic transposition of a whole score.
 *
 * Shifts every NOTE by `commas` Holdrian commas (53 = one octave) and re-derives its written
 * name + frequency from the shifted comma value. Re-spelling goes through `komaToName` (the same
 * smallest-alteration enharmonic the edit modal uses), so names stay sensible instead of turning
 * into odd enharmonics. Rests and meta events pass through unchanged.
 *
 * This is "chromatic" by design — a fixed comma shift, not a diatonic/interval-preserving move.
 * The named ahenks (Bolahenk, Mansur, Kız, …) are just fixed comma offsets, so a name→offset
 * table can sit on top of this without changing the math. Pure data, mobile-reusable, and the
 * Phase-2 pitch-augmentation primitive (render each piece at several transpositions).
 */

import type { NoteModelDocument, NoteEvent } from "./types";
import { komaToName } from "./notation";
import { freqFromTuning } from "./tuning";

/** Return a new document with every note shifted by `commas` (0 → returned unchanged). */
export function transpose(doc: NoteModelDocument, commas: number): NoteModelDocument {
  if (commas === 0) return doc;
  const events: NoteEvent[] = doc.events.map((ev) => {
    if (ev.kind !== "note") return ev;
    const koma53 = ev.koma53 + commas;
    return {
      ...ev,
      koma53,
      noteName: komaToName(koma53, "solfege"),
      noteAE: komaToName(koma53, "western"),
      // Match updateEvent's 4-dp rounding so transposed/edited notes stay byte-comparable.
      freqHz: Math.round(freqFromTuning(koma53, doc.tuning) * 1e4) / 1e4,
    };
  });
  return { ...doc, events };
}
