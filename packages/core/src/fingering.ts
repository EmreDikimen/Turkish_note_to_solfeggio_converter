/**
 * Violin fingering — where the finger goes for a given sounding frequency (feature F3).
 *
 * What/why: on a FRETLESS string the stopping point is an exact formula, not a lookup table:
 *
 *     ratio = 1 − openHz / noteHz          (0 = open string, 0.5 = the octave)
 *
 * It accepts *any* frequency, so all 53 commas land exactly. That is the whole reason this
 * feature exists — a twelve-tone app cannot draw a koma position at all, because it only knows
 * twelve frets. See docs/features/fingerboard.md.
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

/**
 * The twelve Western note names, as commas above Do on this project's 53-TET grid.
 *
 * ⭐ WHY TWELVE AND NOT FIFTY-THREE (owner, 2026-09-27): *"there is no need for a match between a
 * koma and a note — let it be tunable to the twelve tones of Western music"*, because *"tuning by
 * koma is much too advanced a feature, beginners will use this app"*. A violinist retunes a string
 * to a NOTE — Fa, Sol♯ — and a chromatic tuner is what they have in their hand. So the choices a
 * person sees are twelve names, and every comma in this file stays behind them. The 53-comma grid
 * is what the music is PLAYED on; it is not what a string is tuned by.
 *
 * ⚠ These are the 53-TET positions of those twelve names, not twelve-tone equal temperament: a
 * fifth here is 31 commas, so Do sits ~5 cents under a tuner's C. That is deliberate and it is the
 * same grid the standard tuning was already written on — Sol 265, Re 296, La 327 and Mi 358 are
 * four of these very points — so retuning can never knock an open string off ratio 0.
 *
 * ⚠ Sharps and flats are the SAME twelve steps a piano has, deliberately: this list is a tuner,
 * not a makam. A koma-altered open string is not offered and must not be added here — that is the
 * advanced feature the owner declined.
 */
const CHROMATIC: readonly { label: string; ascii: string; commasAboveDo: number }[] = [
  { label: "Do", ascii: "do", commasAboveDo: 0 },
  { label: "Do♯", ascii: "do-sharp", commasAboveDo: 5 },
  { label: "Re", ascii: "re", commasAboveDo: 9 },
  { label: "Mi♭", ascii: "mi-flat", commasAboveDo: 13 },
  { label: "Mi", ascii: "mi", commasAboveDo: 18 },
  { label: "Fa", ascii: "fa", commasAboveDo: 22 },
  { label: "Fa♯", ascii: "fa-sharp", commasAboveDo: 27 },
  { label: "Sol", ascii: "sol", commasAboveDo: 31 },
  { label: "Sol♯", ascii: "sol-sharp", commasAboveDo: 36 },
  { label: "La", ascii: "la", commasAboveDo: 40 },
  { label: "Si♭", ascii: "si-flat", commasAboveDo: 44 },
  { label: "Si", ascii: "si", commasAboveDo: 49 },
];

/**
 * The concert comma of Do4, derived rather than measured: concert La4 is comma 327 by definition
 * (`tuning.ts`), and La is 40 commas above Do, so Do4 is 287. Pinned by `fingering-test.ts`, which
 * also checks that the four standard strings fall on this table exactly.
 *
 * ⚠ CONCERT, not written. `komaToName` in `notation.ts` names a WRITTEN koma, and Turkish notation
 * transposes down a fourth, so the two spaces are 22 commas apart and their names disagree by a
 * fourth. Nothing in this file may borrow that function: a string is named by what it SOUNDS.
 */
const DO4_CONCERT_KOMA = 287;

const SEMITONES_PER_OCTAVE = 12;
const COMMAS_PER_OCTAVE = 53;

/** One choice in the tuning picker: a Western twelve-tone pitch, placed on this project's grid. */
export interface TuningChoice {
  /** Stable, ASCII, safe in a `data-` attribute and a `<select value>`: `"sol-sharp3"`. */
  id: string;
  /** What the person reads in the list, octave included: `"Sol♯3"`. */
  label: string;
  /** The same name WITHOUT the octave: what the fingerboard writes beside the string. */
  noteLabel: string;
  concertKoma: number;
  openHz: number;
}

/** Semitone number of a comma on the twelve-tone ladder, 0 = Do4. `null` off the ladder. */
function semitoneOf(concertKoma: number): number | null {
  const rel = concertKoma - DO4_CONCERT_KOMA;
  const octave = Math.floor(rel / COMMAS_PER_OCTAVE);
  const within = rel - octave * COMMAS_PER_OCTAVE;
  const pc = CHROMATIC.findIndex((c) => c.commasAboveDo === within);
  return pc < 0 ? null : octave * SEMITONES_PER_OCTAVE + pc;
}

/** The choice at a semitone number, 0 = Do4. Negative numbers go below it. */
function choiceAt(semitone: number): TuningChoice {
  const octave = Math.floor(semitone / SEMITONES_PER_OCTAVE);
  const step = CHROMATIC[semitone - octave * SEMITONES_PER_OCTAVE]!;
  const concertKoma = DO4_CONCERT_KOMA + octave * COMMAS_PER_OCTAVE + step.commasAboveDo;
  const octaveNumber = 4 + octave;
  return {
    id: `${step.ascii}${octaveNumber}`,
    label: `${step.label}${octaveNumber}`,
    noteLabel: step.label,
    concertKoma,
    openHz: koma53ToFreq(concertKoma),
  };
}

/**
 * How far either way a string may be retuned, in Western semitones. A fourth: it covers every
 * scordatura a Turkish violinist actually uses (the Sol string down to Fa, the Mi string down to
 * Re) with room left over, and it keeps the list at nine names instead of the fifty a whole octave
 * would give — a list nobody scrolls is not a choice.
 */
export const TUNING_SPAN_SEMITONES = 4;

/**
 * The notes one string may be tuned to: `TUNING_SPAN_SEMITONES` semitones either side of where the
 * STANDARD tuning puts it, lowest first. Anchored to the standard rather than to the string's
 * current pitch on purpose — a list that slides as you use it can walk a string anywhere, and the
 * person loses the one landmark they had.
 *
 * Returns the standard pitch alone if that pitch is not on the twelve-tone ladder, which cannot
 * happen for a shipped tuning and is checked by `fingering-test.ts`.
 */
export function tuningChoices(stringId: string): readonly TuningChoice[] {
  const std = DEFAULT_VIOLIN_TUNING.strings.find((s) => s.id === stringId);
  if (!std) return [];
  const centre = semitoneOf(std.concertKoma);
  if (centre == null) return [choiceAt(0)];
  const out: TuningChoice[] = [];
  for (let s = centre - TUNING_SPAN_SEMITONES; s <= centre + TUNING_SPAN_SEMITONES; s++) {
    out.push(choiceAt(s));
  }
  return out;
}

/** The choice a string is currently sitting on, or `null` if it is off the twelve-tone ladder. */
export function choiceOfString(s: OpenString): TuningChoice | null {
  const semi = semitoneOf(s.concertKoma);
  return semi == null ? null : choiceAt(semi);
}

/**
 * `tuning` with one string moved to `choiceId`. Everything downstream — `assignFingering`, the
 * geometry, the dot — takes the strings as data, so this is the whole of retuning.
 *
 * ⚠ IT RETURNS THE SHIPPED `DEFAULT_VIOLIN_TUNING` OBJECT, id `"standard"`, WHENEVER THE FOUR
 * PITCHES ARE BACK WHERE THEY STARTED. `#fingerboard[data-tuning]` is read by
 * `tools/browser/editor-smoke.ts`, and a tuning that says `"custom"` while sounding standard would
 * be a lie in the DOM as well as a failed check. Any other set of pitches is `"custom"`.
 *
 * ⚠ The string's `label` moves with its pitch. A string still labelled "Sol" while sounding Fa is
 * the one mistake this feature can make that nothing else would catch — the fingerboard writes
 * that label next to the peg the person just turned.
 */
export function retuneString(
  tuning: ViolinTuning,
  stringId: string,
  choiceId: string,
): ViolinTuning {
  const choice = tuningChoices(stringId).find((c) => c.id === choiceId);
  if (!choice) return tuning;
  const strings = tuning.strings.map((s) =>
    s.id === stringId
      ? { ...s, label: choice.noteLabel, concertKoma: choice.concertKoma, openHz: choice.openHz }
      : s,
  );
  const standard = strings.every(
    (s, i) => s.concertKoma === DEFAULT_VIOLIN_TUNING.strings[i]!.concertKoma,
  );
  if (standard) return DEFAULT_VIOLIN_TUNING;
  return { id: "custom", label: strings.map((s) => s.label).join("–"), strings };
}

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
 * Measured off the shipped photo (docs/features/fingerboard.md): the ebony ends 0.838 of the way from
 * nut to bridge, which is about two and a half octaves above the open string. It is a property of
 * a violin rather than of the picture, so it lives here with the rest of the physics.
 */
export const FINGERBOARD_END_RATIO = 0.8379;

/**
 * THE HAND, AS A PLACE ON THE NECK — the model `assignFingering` walks (owner, 2026-08-27).
 *
 * ⚠ THIS REPLACED A "STAY NEAREST TO WHERE THE HAND WAS" RULE THAT PRICED A STRING CROSSING WRONG,
 * and the failure was visible in the app: on `meltem_notes.json` **22 of 83 notes were placed above
 * the octave**, the highest being La5 (880 Hz) at **0.778 of the Sol string** — over two octaves up,
 * near the end of the fingerboard — where the La string offers the same pitch at 0.5 and the Mi
 * string at 0.25. On `safalar-getirdiniz.json` it was 378 of 816. No violinist plays that.
 *
 * ⭐ The mechanism, because it is a trap worth naming: the old cost was `|Δratio|`, and for an
 * ASCENDING line, sliding one more note up the string you are on is always a small Δratio, while
 * crossing to a higher string means dropping back down the neck — a *large* Δratio. So every step
 * up was locally cheap and the hand never came back. The rule had no notion of a hand at all.
 *
 * ✅ What is modelled now is what a violinist actually has: a hand that SITS somewhere on the neck
 * and reaches a fixed span from there. Two consequences fall straight out, and they are the whole
 * fix — **crossing strings with the hand where it is costs almost nothing** (all four strings offer
 * the same span at the same place), while **leaving that span is a shift** and is priced by how far
 * the hand travels.
 *
 * The hand's place is written as the interval in COMMAS where the **first finger** sits above the
 * open string it is on. That is the musician's own unit, and it is string-independent — which is
 * exactly what makes a crossing free to describe.
 *
 * ⚠ Simplifications, stated rather than hidden: the frame is a constant number of commas, where a
 * real hand's frame widens a little in high positions; a shift is priced in commas rather than in
 * millimetres, which slightly over-prices shifts high on the neck; and the walk is still greedy, so
 * it cannot plan a crossing several notes ahead the way a player reading ahead would. None of the
 * three can bring back the failure above, because all of them price climbing HIGHER, not lower.
 */

/** First finger to fourth finger: a perfect fourth. This is the "frame" a player talks about. */
const HAND_FRAME = 22;
/** The fourth finger extends about a semitone past the frame, and the first reaches back one. */
const REACH_UP = 4;
const REACH_BACK = 5;
/** Where the first finger sits in first position: a whole tone above the open string. */
const FIRST_POSITION = 9;

/** Cost of moving the hand, per comma of travel. Everything else is priced in these units. */
const SHIFT_COST = 1;
/**
 * Cost of crossing to another string without moving the hand.
 *
 * Small on purpose — it is the bow's problem, not the hand's. It has to stay well under the cost of
 * a real shift, or the old climbing behaviour comes back; it has to be more than nothing, or a
 * stepwise melody that fits comfortably under the hand would hop strings for no reason.
 */
const STRING_CHANGE_COST = 2;
/**
 * Pull towards the nut, per comma of hand position.
 *
 * Why it exists: every note above the open Sol is playable somewhere on the Sol string, so a rule
 * that only minimised movement would happily sit in seventh position forever. ⚠ It only ever
 * decides between candidates that need DIFFERENT hand positions — two placements that both work
 * from where the hand already is carry the same pull, so it can never override a real preference.
 */
const LOW_POSITION_PULL = 0.3;

/**
 * Where the hand must be to play a note `commas` above the open string, moving as little as
 * possible from where it is.
 *
 * `null` means the hand has not been placed yet (the piece has not started, or everything so far
 * was an open string): it then starts in first position, and leaves it only for a note that first
 * position cannot reach.
 */
function handFor(commas: number, hand: number | null): number {
  const lowest = commas - HAND_FRAME - REACH_UP; // the note under a stretched fourth finger
  if (hand === null) return Math.max(FIRST_POSITION, lowest);
  if (commas > hand + HAND_FRAME + REACH_UP) return lowest;
  if (commas < hand - REACH_BACK) return commas + REACH_BACK; // the note under a low first finger
  return hand; // already under the hand: no shift at all
}

/**
 * Choose a string and a position for every note of a piece, in one pass.
 *
 * `freqsHz` is one sounding frequency per note, in order, with `NaN` for rests (which is exactly
 * what `Timeline.notes[].freqHz` gives). The result is aligned 1:1 with it; an entry is `null`
 * for a rest, and also for a note that no string can reach — below the lowest open string, or
 * past the end of the fingerboard. Those are reported as unplayable rather than clamped onto a
 * position the note is not at.
 *
 * The rule: carry the hand along the neck (see the block above), and for each note take the
 * placement that costs least — how far the hand must travel to reach it, whether the bow has to
 * cross, and a mild pull back towards the nut. **An open string is free from anywhere**, because it
 * needs no finger, and it leaves the hand where it was.
 *
 * Rests do not move the hand, and neither does an unreachable note: the hand carries across both.
 */
export function assignFingering(
  freqsHz: readonly number[],
  strings: readonly OpenString[],
  maxRatio: number = FINGERBOARD_END_RATIO,
): (FingerPos | null)[] {
  const out: (FingerPos | null)[] = [];
  let hand: number | null = null;
  let onString: number | null = null;

  for (const hz of freqsHz) {
    if (!Number.isFinite(hz) || hz <= 0) {
      out.push(null); // a rest — the hand stays where it was
      continue;
    }

    let best: FingerPos | null = null;
    let bestHand: number | null = null;
    let bestCost = Infinity;

    for (let i = 0; i < strings.length; i++) {
      const ratio = positionOnString(strings[i]!.openHz, hz);
      if (ratio === null || ratio > maxRatio) continue;

      // An open string asks nothing of the hand, so it is priced without one and leaves the hand
      // untouched — which is why a passage that dips onto an open string does not lose its place.
      const open = ratio === 0;
      const moved: number | null = open ? hand : handFor(ratioToCommas(ratio), hand);
      const shift = open || hand === null || moved === null ? 0 : Math.abs(moved - hand);

      // ⚠ The pull is on where the hand ENDS UP, and an open string leaves it where it is — so an
      // open string carries no position cost at all before the hand has been placed. That is what
      // makes an open-string pitch, cold, come out open rather than stopped on a lower string.
      const cost =
        SHIFT_COST * shift +
        (onString !== null && onString !== i ? STRING_CHANGE_COST : 0) +
        LOW_POSITION_PULL * (moved ?? 0);

      if (cost < bestCost) {
        bestCost = cost;
        best = { stringIndex: i, ratio };
        bestHand = moved;
      }
    }

    out.push(best);
    if (best) {
      hand = bestHand;
      onString = best.stringIndex;
    }
  }

  return out;
}

/**
 * How far above the open string a position sounds, in commas of this project's 53-TET grid.
 *
 * The inverse of `positionOnString`: stopping at `ratio` shortens the string to `1 − ratio` of its
 * length, so it sounds `1 / (1 − ratio)` times higher. Written here rather than in the view because
 * it is tuning maths, and because it is what turns a *distance* back into an *interval* — the only
 * language in which a finger position can be named.
 */
export function ratioToCommas(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) return 0;
  return 53 * Math.log2(1 / (1 - ratio));
}

/**
 * Which FIRST-POSITION finger a place on the string is nearest to, or `null` for anything past
 * first position.
 *
 * ⚠ WHAT THIS IS AND IS NOT. It is a rough band, not a fingering decision: `assignFingering` says
 * which string and where, and it is free to send the hand up the neck, where these bands do not
 * apply and this returns `null`. It exists only so the position lines drawn over the photo can be
 * coloured the way a learner's tapes are — and a learner's tapes ARE the four first-position
 * fingers. Naming the band is honest; claiming it is the finger the player will use is not.
 *
 * The bands are the midpoints between the standard first-position placements on the 53-TET grid:
 * m2 = 4, M2 = 9, m3 = 13, M3 = 18, P4 = 22, tritone = 26, P5 = 31 commas. So finger 1 owns 2–11,
 * finger 2 owns 11–20, finger 3 owns 20–28 (both the fourth and the tritone above it — a high third
 * finger, which is what a player uses there), finger 4 owns 28–35, and a fifth above the open
 * string is as far as a first-position hand reaches.
 */
export function firstPositionFinger(ratio: number): 1 | 2 | 3 | 4 | null {
  const c = ratioToCommas(ratio);
  if (c < 2) return null; // the open string itself, or a hair above it
  if (c < 11) return 1;
  if (c < 20) return 2;
  if (c < 28) return 3;
  if (c < 35) return 4;
  return null; // the hand has left first position
}

/** The inverse of `ratioToCommas`: where a given interval above the open string falls. */
export function commasToRatio(commas: number): number {
  return 1 - Math.pow(2, -commas / 53);
}

/**
 * WHERE A VIOLINIST'S FINGERS NORMALLY GO — the fixed reference the fingerboard draws (owner,
 * 2026-08-27, replacing lines built from the loaded piece: *"the lines will show standard violin
 * notes, they will not be arranged by koma"*).
 *
 * The seven places a hand in first position stops a string, in commas above the open string. They
 * are the ordinary Western semitone steps, written on THIS project's 53-TET grid rather than in
 * twelve-tone equal temperament — which matters and is not pedantry: the app's own natural notes
 * are spaced by tanini (9) and bakiye (4) commas (`PC_COMMA` in `notation.ts`), so an unaltered
 * note lands **exactly** on its line. On a 12-TET reference the same note would sit a few cents
 * off its own line and read as a drawing error.
 *
 *     4 = m2 · 9 = M2 · 13 = m3 · 18 = M3 · 22 = P4 · 26 = tritone · 31 = P5
 *
 * ⭐ Everything a makam adds falls BETWEEN them, and that is the entire point of drawing them: a
 * koma-flattened third sounds at 17 commas, one koma below the M3 line, and you can see it.
 *
 * ⚠ One spelling ambiguity, stated rather than hidden: AEU distinguishes a raised note from a
 * lowered one, so a D♯ is 13 commas above C while an E♭ is 14 (E minus a bakiye). The lines take
 * the RAISED spelling, so a flat-spelled note sits one comma above its nearest line. One comma is
 * about 7 px near the nut on the shipped photo — visible, and correct.
 */
export const FIRST_POSITION_NOTES: readonly number[] = [4, 9, 13, 18, 22, 26, 31];

