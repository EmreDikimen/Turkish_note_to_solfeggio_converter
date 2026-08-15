/**
 * Violin fingering — where the finger goes for a given sounding frequency (feature F3).
 *
 * What/why: on a FRETLESS string the stopping point is an exact formula, not a lookup table:
 *
 *     ratio = 1 − openHz / noteHz          (0 = open string, 0.5 = the octave)
 *
 * It accepts *any* frequency, so all 53 commas land exactly. That is the whole reason this
 * feature exists — a twelve-tone app cannot draw a koma position at all, because it only knows
 * twelve frets. See docs/features/README.md ("F3 — the fingerboard tab").
 *
 * How it's organized:
 *   * `VIOLIN_TUNINGS` — the open strings, as DATA. Swapping in a Turkish scordatura is a row
 *     here and touches no geometry (docs/DECISIONS.md, 2026-08-15).
 *   * `positionOnString` — the formula above, for one string.
 *   * `assignFingering` — the greedy "stay near where the hand just was" rule, run once over a
 *     whole piece.
 *
 * This is pure data + maths, so it lives in core and ports to mobile unchanged — the same
 * reasoning that put `usul.ts` here. Nothing about pixels, artwork or the DOM belongs in this
 * file; the image calibration lives in `apps/web/src/ui/fingerboardGeometry.ts`.
 */

import { koma53ToFreq } from "./tuning";

/** One open string. `openHz` is CONCERT Hz, the same space `ScheduledNote.freqHz` is in. */
export interface OpenString {
  /** Stable id for data attributes and tests. */
  id: string;
  /** What a player calls it. Not translated — a string is named the same in every language. */
  label: string;
  /**
   * The string's pitch as an absolute comma in this project's 53-TET grid, where comma 327 is
   * concert 440 Hz (`tuning.ts`). ⚠ This is a CONCERT comma, not a written one: Turkish notation
   * transposes down a fourth, so a written koma is 22 lower than the concert koma that sounds it.
   * Kept beside `openHz` so the derivation is checkable rather than a magic number.
   */
  concertKoma: number;
  /** `koma53ToFreq(concertKoma)`, written out. Pinned by `tools/core/fingering-test.ts`. */
  openHz: number;
}

export interface ViolinTuning {
  id: string;
  label: string;
  /** Lowest string first. The fingerboard draws them in this order. */
  strings: readonly OpenString[];
}

/**
 * The open strings, in fifths from concert A = 440 Hz.
 *
 * ⚠ Derived on THIS project's 53-TET grid, not from twelve-tone equal temperament: a fifth here
 * is 31 commas = 701.89 cents. The values therefore differ from a chromatic tuner's by up to
 * ~4 cents (G3 195.57 rather than 196.00). That is deliberate and it matters — 4 cents is a fifth
 * of a koma, which is exactly the scale of thing this view exists to show, and it makes an open
 * string land at ratio 0 *exactly* for the note that should be played open.
 *
 * Owner decision 2026-08-15: ship standard tuning, keep the table open. Turkish violinists do not
 * universally use the Western tuning, but naming a scordatura is a repertoire question, so a
 * second entry waits for the owner rather than being guessed. Everything downstream takes this
 * as data, so adding one costs no code.
 */
export const VIOLIN_TUNINGS: readonly ViolinTuning[] = [
  {
    id: "standard",
    label: "Sol–Re–La–Mi",
    strings: [
      { id: "g", label: "Sol", concertKoma: 265, openHz: koma53ToFreq(265) },
      { id: "d", label: "Re", concertKoma: 296, openHz: koma53ToFreq(296) },
      { id: "a", label: "La", concertKoma: 327, openHz: koma53ToFreq(327) },
      { id: "e", label: "Mi", concertKoma: 358, openHz: koma53ToFreq(358) },
    ],
  },
];

export const DEFAULT_VIOLIN_TUNING = VIOLIN_TUNINGS[0]!;

/** Where the hand is: which string, and how far along it (0 = open, 0.5 = the octave). */
export interface FingerPos {
  stringIndex: number;
  ratio: number;
}

/**
 * How far along a string a note is stopped, as a fraction of the vibrating length.
 *
 * Returns `null` when the note is BELOW the open string, because no finger can lower a string's
 * pitch — that note has to be found on a lower string, or nowhere.
 */
export function positionOnString(openHz: number, noteHz: number): number | null {
  if (!Number.isFinite(openHz) || !Number.isFinite(noteHz) || openHz <= 0 || noteHz <= 0) {
    return null;
  }
  if (noteHz < openHz) return null;
  return 1 - openHz / noteHz;
}

/**
 * How far up the string the fingerboard reaches, past which nothing can be stopped.
 *
 * Measured off the shipped photo (docs/features/README.md): the ebony ends 0.838 of the way from
 * nut to bridge, which is about two and a half octaves above the open string. It is a property of
 * a violin rather than of the picture, so it lives here with the rest of the physics.
 */
export const FINGERBOARD_END_RATIO = 0.8379;

/**
 * Cost of moving the hand to a different string, in the same units as `ratio`.
 *
 * Why it exists: without it, a melody that alternates by a fifth would flip strings on every note.
 * 0.05 of the string is roughly a minor third down at the nut — enough to prefer staying put for
 * small steps, small enough that a real string change (which saves a big shift) still wins.
 */
const STRING_CHANGE_COST = 0.05;

/**
 * Mild preference for playing nearer the nut.
 *
 * Why it exists: every note above the open G is playable on the G string somewhere, so a rule
 * that only minimises hand movement will happily climb into sixth position and stay there. This
 * pulls it back down without ever overriding a genuinely closer position.
 */
const HIGH_POSITION_COST = 0.15;

/**
 * Choose a string and a position for every note of a piece, in one pass.
 *
 * `freqsHz` is one sounding frequency per note, in order, with `NaN` for rests (which is exactly
 * what `Timeline.notes[].freqHz` gives). The result is aligned 1:1 with it; an entry is `null`
 * for a rest, and also for a note that no string can reach — below the lowest open string, or
 * past the end of the fingerboard. Those are reported as unplayable rather than clamped onto a
 * position the note is not at.
 *
 * The rule (docs/features/README.md calls this "the one genuinely tricky part"): a pitch is
 * playable in several places, so prefer the candidate nearest to where the hand just was, with a
 * small penalty for changing string and a small pull towards the nut. With no history — the first
 * note, or the first after an unreachable one — the lowest position wins, which is what puts a
 * piece in first position on the highest usable string.
 *
 * Rests do not move the hand: the previous position carries across them.
 */
export function assignFingering(
  freqsHz: readonly number[],
  strings: readonly OpenString[],
  maxRatio: number = FINGERBOARD_END_RATIO,
): (FingerPos | null)[] {
  const out: (FingerPos | null)[] = [];
  let prev: FingerPos | null = null;

  for (const hz of freqsHz) {
    if (!Number.isFinite(hz) || hz <= 0) {
      out.push(null); // a rest — the hand stays where it was
      continue;
    }

    let best: FingerPos | null = null;
    let bestCost = Infinity;

    for (let i = 0; i < strings.length; i++) {
      const ratio = positionOnString(strings[i]!.openHz, hz);
      if (ratio === null || ratio > maxRatio) continue;

      const cost =
        (prev === null ? 0 : Math.abs(ratio - prev.ratio)) +
        (prev !== null && prev.stringIndex !== i ? STRING_CHANGE_COST : 0) +
        HIGH_POSITION_COST * ratio;

      if (cost < bestCost) {
        bestCost = cost;
        best = { stringIndex: i, ratio };
      }
    }

    out.push(best);
    if (best) prev = best;
  }

  return out;
}
