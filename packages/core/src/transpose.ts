/**
 * Transposition of a whole score.
 *
 * Shifts every pitched event (notes AND grace notes) by `commas` Holdrian commas (53 = one
 * octave) and re-derives its written name + frequency. Rests and meta events pass through
 * unchanged. The SOUND is the same under both spellings below — only the written name differs.
 *
 * Two ways to spell the result:
 *
 *  - **"letters"** (the app, since 2026-10-16 — owner: *"farklı notalar aynısının arızalısı olarak
 *    gösterilmemeli"*). Every note moves by the same number of LETTERS, the way a musician
 *    transposes: si–do down one tone is la–si♭, never la–la#. Two different letters before a
 *    transposition are two different letters after it. The letter count comes from the comma
 *    distance (`letterSteps`); the accidental is whatever the new letter needs to reach the shifted
 *    koma. ⚠ When that accidental is not an AEU sign (koma 1, bakiye 4, küçük 5, büyük mücennep 8),
 *    the staff could not draw it truthfully — `toAeuAlter` would snap it — so that ONE note falls
 *    back to the nearest spelling. It only happens to a note that already carried an unusual
 *    accidental.
 *  - **"nearest"** — the smallest-alteration enharmonic (`komaToName`, the edit modal's rule). This
 *    was the only behaviour until 2026-10-16, and it stays the default for RENDER jobs: the
 *    synthetic training corpora were rendered with it, and the product track must not change what
 *    the model track generates (CLAUDE.md, the two tracks). `App.tsx` picks by `?mode=`.
 *
 * The named ahenks (Bolahenk, Mansur, Kız, …) are just fixed comma offsets, so a name→offset table
 * can sit on top of this without changing the math. Pure data, mobile-reusable.
 */

import type { NoteModelDocument, NoteEvent } from "./types";
import { komaToName, naturalKoma, parseNoteName, spellNote } from "./notation";
import { freqFromTuning } from "./tuning";

export type TransposeSpelling = "letters" | "nearest";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
/** The signs the staff can draw (`toAeuAlter` snaps anything else). */
const AEU_ALTERS = new Set([0, 1, 4, 5, 8, -1, -4, -5, -8]);

/**
 * How many letters a shift of `commas` moves a note.
 *
 * Under a whole tone (9) a shift is an accidental's worth — the letter stays and the accidental
 * changes. From a tone up it is the comma distance in 53rds of an octave times its 7 letters,
 * rounded: 9→1, 13 (la→do)→2, 18→2, 22→3, 31→4, 40→5, 49→6, 53→7. Symmetric in sign, so
 * `transpose(transpose(d, t), -t)` lands back on the original spelling — the edit round-trip in
 * `App.tsx` depends on that.
 */
export function letterSteps(commas: number): number {
  const a = Math.abs(commas);
  if (a < 9) return 0;
  return Math.sign(commas) * Math.round((a * 7) / 53);
}

/** Spell `koma53` on the letter `steps` away from the note's own, or null if no AEU sign fits. */
function spellByLetters(ev: NoteEvent, koma53: number, steps: number): { solfege: string; western: string } | null {
  const p = parseNoteName(ev.noteAE) ?? parseNoteName(ev.noteName);
  if (!p) return null;
  const idx = LETTERS.indexOf(p.letter) + steps;
  if (LETTERS.indexOf(p.letter) < 0) return null;
  const letter = LETTERS[((idx % 7) + 7) % 7]!;
  const octave = p.octave + Math.floor(idx / 7);
  const alter = koma53 - naturalKoma(letter, octave);
  if (!AEU_ALTERS.has(alter)) return null;
  return { solfege: spellNote(letter, octave, alter, "solfege"), western: spellNote(letter, octave, alter, "western") };
}

/** Return a new document with every note shifted by `commas` (0 → returned unchanged). */
export function transpose(
  doc: NoteModelDocument,
  commas: number,
  spelling: TransposeSpelling = "nearest"
): NoteModelDocument {
  if (commas === 0) return doc;
  const steps = letterSteps(commas);
  const events: NoteEvent[] = doc.events.map((ev) => {
    if (ev.kind !== "note" && ev.kind !== "grace") return ev;
    const koma53 = ev.koma53 + commas;
    const byLetters = spelling === "letters" ? spellByLetters(ev, koma53, steps) : null;
    return {
      ...ev,
      koma53,
      noteName: byLetters?.solfege ?? komaToName(koma53, "solfege"),
      noteAE: byLetters?.western ?? komaToName(koma53, "western"),
      // Match updateEvent's 4-dp rounding so transposed/edited notes stay byte-comparable.
      freqHz: Math.round(freqFromTuning(koma53, doc.tuning) * 1e4) / 1e4,
    };
  });
  return { ...doc, events };
}
