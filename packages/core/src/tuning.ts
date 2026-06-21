/**
 * 53-TET (Arel-Ezgi-Uzdilek) tuning — port of `src/audio/tuning.py`.
 *
 * SymbTr's Koma53 is an absolute Holdrian comma value (octave = 53 commas), so
 *   frequency = refFreqHz * 2 ** ((koma - refKoma) / commasPerOctave)
 * Anchored at A4 = 440 Hz (comma 305).
 */

import type { TuningParams } from "./types";

export const COMMAS_PER_OCTAVE = 53;
export const DEFAULT_REF_KOMA = 305;
export const DEFAULT_REF_FREQ = 440.0;

export const DEFAULT_TUNING: TuningParams = {
  system: "53tet",
  refFreqHz: DEFAULT_REF_FREQ,
  refKoma: DEFAULT_REF_KOMA,
  commasPerOctave: COMMAS_PER_OCTAVE,
};

/**
 * Convert an absolute Holdrian comma value to a frequency in Hz.
 *
 * What/why: the TypeScript twin of Python's `koma53_to_freq` — the app needs the exact
 * same tuning the audio file used, so this is a line-for-line port. Verified to match the
 * Python output to within 4e-5 Hz, so web/mobile and the reference WAVs agree.
 * How it works: pitch is logarithmic — one octave (53 commas) = doubling the frequency —
 * so freq = refFreq * 2 ** ((koma - refKoma) / 53). `2 ** x` is JS exponentiation.
 * Important: the microtonal intervals come from the comma differences (exact); refFreq/
 * refKoma only set absolute height, so changing the anchor transposes without distorting.
 */
export function koma53ToFreq(
  koma: number,
  refFreq: number = DEFAULT_REF_FREQ,
  refKoma: number = DEFAULT_REF_KOMA,
  commasPerOctave: number = COMMAS_PER_OCTAVE,
): number {
  return refFreq * 2 ** ((koma - refKoma) / commasPerOctave);
}

/**
 * Compute a frequency using a document's own `tuning` block.
 *
 * What/why: every NoteModelDocument carries its tuning anchor (so it travels with the
 * data). This is the convenient form callers actually use — pass the comma and the doc's
 * tuning, and it forwards the fields to `koma53ToFreq` so nobody re-reads them by hand.
 */
export function freqFromTuning(koma: number, t: TuningParams): number {
  return koma53ToFreq(koma, t.refFreqHz, t.refKoma, t.commasPerOctave);
}

/**
 * Interval from the reference to `koma`, in cents (1200 cents = 1 octave).
 *
 * What/why: cents are the universal unit for comparing pitches (100 cents = a piano
 * semitone), so this is used for UI labels / sanity checks. Each comma ≈ 22.6 cents.
 */
export function centsAboveRef(
  koma: number,
  refKoma: number = DEFAULT_REF_KOMA,
  commasPerOctave: number = COMMAS_PER_OCTAVE,
): number {
  return ((koma - refKoma) / commasPerOctave) * 1200;
}
