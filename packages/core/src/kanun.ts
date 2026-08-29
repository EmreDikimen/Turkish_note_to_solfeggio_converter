/**
 * Kanun mandals — which course is plucked, and where its mandals must stand (feature F3).
 *
 * What/why: the violin half of this feature answers *where does the finger go*, and every note is
 * an independent question. **A kanun is not like that, and that difference is the whole design.**
 * A mandal is a small lever under one course; raising it shortens the strings by one koma, and it
 * **stays where it is put** until the player moves it again. So a picture of a kanun "right now" is
 * not a function of the note being played — it is a function of every mandal move made since the
 * piece began. That makes this a small state machine over the whole piece, not a lookup.
 *
 * It is also what a kanun player actually does: the mandals for the makam are set BEFORE playing,
 * like tuning, and are then moved only where the music leaves that makam. `planMandals` is written
 * in exactly those two steps — an opening setting, then the changes — because the intermediate
 * result (what the mandals must be set to before the first note) is itself worth showing.
 *
 * How it's organized:
 *   * `KANUN_COURSES` — the 26 courses as DATA, derived from the perde names.
 *   * `MANDAL_LAYOUTS` — how many mandals a course carries and where its natural sits, as DATA.
 *   * `planMandals` — the two-pass walk: the makam's opening setting, then the changes.
 *
 * ⚠ **THE COURSE IS THE WRITTEN NOTE, NOT THE SOUNDING PITCH, AND THAT IS NOT A SHORTCUT.** A
 * kanun player reading a B♭ lowers the Si course; they do not play it on the La course raised,
 * even though the two produce the same pitch. So `planMandals` takes the note's written letter as
 * well as what it must sound, and only falls back to searching the neighbours when the written
 * course genuinely cannot reach (a very wide accidental, or a note off the end of the instrument).
 * The violin has no equivalent — a fingerboard does not care how a note is spelled.
 *
 * This is pure data + maths, so it lives in core and ports to mobile unchanged — the same
 * reasoning that put `usul.ts` and `fingering.ts` here. Nothing about pixels or the DOM belongs in
 * this file; the drawing lives in `apps/web/src/ui/kanunGeometry.ts`.
 */

import { naturalKoma } from "./notation";
import { koma53ToFreq } from "./tuning";

/**
 * How many mandals one course carries, and which of them is the natural.
 *
 * ⚠ **DATA, because the real answer is "it depends on the maker".** The sources disagree, and they
 * disagree honestly: some makers fit 5, some 6, 7, 8 or 9, and a modern professional instrument
 * carries **9–12 per whole tone**, each worth one koma. 12 with the natural sixth from the bottom
 * is the owner's own instrument (2026-08-29) and is what ships; changing it is a row here and
 * touches no geometry and no drawing code, exactly like `VIOLIN_TUNINGS`.
 *
 * ⚠ The asymmetry is deliberate and it is not arbitrary: **the largest flat in makam music is 5
 * komas**, so five mandals below the natural is enough to reach every written bemol, while the
 * sharps need one more.
 */
export interface MandalLayout {
  id: string;
  label: string;
  /** Total mandals on one course. */
  count: number;
  /** Which mandal (0-based, counting up from the flattest) sounds the natural. */
  naturalIndex: number;
}

export const MANDAL_LAYOUTS: readonly MandalLayout[] = [
  { id: "12", label: "12 mandal", count: 12, naturalIndex: 5 },
];

export const DEFAULT_MANDAL_LAYOUT = MANDAL_LAYOUTS[0]!;

/** How far from the natural a mandal stands, in komas. Negative is flat. */
export function mandalOffset(mandal: number, layout: MandalLayout = DEFAULT_MANDAL_LAYOUT): number {
  return mandal - layout.naturalIndex;
}

/** The mandal that stands `offset` komas from the natural, or `null` if the course cannot. */
export function mandalForOffset(
  offset: number,
  layout: MandalLayout = DEFAULT_MANDAL_LAYOUT,
): number | null {
  const m = offset + layout.naturalIndex;
  return m >= 0 && m < layout.count ? m : null;
}

/** One course: three strings tuned in unison, sounding one perde. */
export interface KanunCourse {
  /** 0 = the lowest course. */
  index: number;
  /** Its perde name, which is what a player calls it. */
  perde: string;
  /** The WRITTEN letter and octave the player reads for this course. */
  letter: string;
  octave: number;
  /** The written-absolute Holdrian comma of the course with its mandals at the natural. */
  koma: number;
  /** What that sounds, in Hz. Written out so a typo in the table is checkable, not invisible. */
  hz: number;
}

/**
 * THE 26 PERDE, LOWEST FIRST — the one table in this file a human wrote.
 *
 * ⚠ Two independent checks say this span is right, and they were run rather than assumed:
 *
 * 1. **The count falls out of it.** Kaba Yegâh is written D3 and Tiz Muhayyer written A6; the
 *    natural notes between them, inclusive, number **exactly 26** — which is the professional
 *    kanun's perde count. Nothing was padded to make that true.
 * 2. **The top matches the recording.** Tiz Muhayyer sounds 1319 Hz on this project's grid, and the
 *    top note of F1's kanun take is **1325 Hz** (`kanun_02_E6.wav`, `audio/instruments.ts`). Six Hz
 *    is under half a koma. The bottom does not match — the take starts well above Kaba Yegâh — but
 *    a recording may stop early where an instrument may not, so only the top is evidence.
 *
 * ⚠ These are WRITTEN names. Turkish notation's fourth is already inside this project's tuning
 * anchor (comma 327 = written D5 = **sounding** 440 Hz, `tuning.ts`), so `naturalKoma` on a written
 * name gives a comma that `koma53ToFreq` turns into the concert Hz it really sounds. Do not
 * "correct" for the fourth a second time.
 */
const PERDE: readonly (readonly [string, string, number])[] = [
  ["Kaba Yegâh", "D", 3],
  ["Kaba Hüseynî-aşîran", "E", 3],
  ["Kaba Acem-aşîran", "F", 3],
  ["Kaba Rast", "G", 3],
  ["Kaba Dügâh", "A", 3],
  ["Kaba Segâh", "B", 3],
  ["Kaba Çârgâh", "C", 4],
  ["Yegâh", "D", 4],
  ["Hüseynî-aşîran", "E", 4],
  ["Acem-aşîran", "F", 4],
  ["Rast", "G", 4],
  ["Dügâh", "A", 4],
  ["Segâh", "B", 4],
  ["Çârgâh", "C", 5],
  ["Nevâ", "D", 5],
  ["Hüseynî", "E", 5],
  ["Acem", "F", 5],
  ["Gerdâniye", "G", 5],
  ["Muhayyer", "A", 5],
  ["Tiz Segâh", "B", 5],
  ["Tiz Çârgâh", "C", 6],
  ["Tiz Nevâ", "D", 6],
  ["Tiz Hüseynî", "E", 6],
  ["Tiz Acem", "F", 6],
  ["Tiz Gerdâniye", "G", 6],
  ["Tiz Muhayyer", "A", 6],
];

export const KANUN_COURSES: readonly KanunCourse[] = PERDE.map(([perde, letter, octave], index) => {
  const koma = naturalKoma(letter, octave);
  return { index, perde, letter, octave, koma, hz: koma53ToFreq(koma) };
});

/** Written natural comma → the course that reads it. */
function byKoma(courses: readonly KanunCourse[]): Map<number, KanunCourse> {
  return new Map(courses.map((c) => [c.koma, c]));
}

/** One note, as `planMandals` needs it. */
export interface KanunNoteInput {
  /**
   * The natural comma of the note's WRITTEN letter and octave — i.e. which course the player reads
   * it on, before any accidental. `null` for a rest, or for an event with no readable spelling.
   */
  courseKoma: number | null;
  /**
   * What the note must actually sound, in commas. ⚠ **May be fractional**: a makam deviation is
   * measured in real intervals, and `makam.ts` carries entries like −1.5 komas. A mandal is a whole
   * koma, so a kanun physically cannot play those — see `residual` below.
   */
  soundingKoma: number;
}

/** Where one note is played: which course, and where that course's mandal must stand. */
export interface MandalPos {
  courseIndex: number;
  /** 0-based, counting up from the flattest mandal. */
  mandal: number;
  /** Komas from the natural. Negative is flat. */
  offset: number;
  /**
   * How far the wanted pitch is from what this mandal actually gives, in komas — signed, and
   * always within half a koma.
   *
   * ⚠ **It is not a rounding convenience, it is a fact about the instrument.** A makam deviation of
   * −1.5 komas cannot be set on a mandal, so a kanun plays the nearest koma and the player bends
   * nothing. Reporting it is the honest thing; hiding it would claim the instrument can do
   * something it cannot. Zero for every ordinary note.
   */
  residual: number;
  /**
   * True when the written course could not reach and a neighbouring course was used instead.
   *
   * ⚠ Rare and real: it is what happens on a very wide accidental (a note 8 komas sharp is a
   * neighbour's course lowered, and that is how a kanun player plays it too).
   */
  respelled: boolean;
}

/** One mandal move, at the note that forced it. */
export interface MandalChange {
  /** Index into the note array — the note this move was made for. */
  noteIndex: number;
  courseIndex: number;
  from: number;
  to: number;
}

export interface KanunPlan {
  /** Aligned 1:1 with the input. `null` = a rest, or a note this kanun cannot reach at all. */
  perNote: (MandalPos | null)[];
  /**
   * The mandal each course must be set to BEFORE the first note — the makam's setting, one entry
   * per course. This is what a player prepares, and it is worth showing on its own.
   */
  opening: number[];
  /** Every mandal move, in playing order. */
  changes: readonly MandalChange[];
}

/**
 * Choose a course and a mandal for every note of a piece, then say what has to move and when.
 *
 * The two passes, and why there are two:
 *
 * 1. **Place every note.** The written spelling names the course, so there is no search and no
 *    thrashing to guard against — the ambiguity the violin's string-choice rule had to solve does
 *    not exist here, because the notation already answered it. The only search is the fallback for
 *    a note the written course cannot reach.
 * 2. **Read the opening setting off pass 1, then walk.** Each course opens at the mandal it uses
 *    MOST across the piece; an unused course opens at its natural. That is the makam's setting, and
 *    taking the majority rather than the first note is what stops one passing accidental at bar 2
 *    from being mistaken for the piece's key.
 *
 * ⚠ The changes are recorded at the note that needs them. A real player moves the mandal slightly
 * BEFORE that note, with the free hand; nothing here models that, and a view built on this should
 * not claim it does.
 */
export function planMandals(
  notes: readonly KanunNoteInput[],
  courses: readonly KanunCourse[] = KANUN_COURSES,
  layout: MandalLayout = DEFAULT_MANDAL_LAYOUT,
): KanunPlan {
  const perNote: (MandalPos | null)[] = [];

  // --- pass 1: place every note -----------------------------------------------------------
  // ⚠ The lookup is built from the courses this call was GIVEN, not from `KANUN_COURSES`. A
  // module-level map would silently index the default table when a test or a future second
  // instrument passes its own.
  const written = byKoma(courses);
  for (const n of notes) {
    perNote.push(place(n, courses, written, layout));
  }

  // --- pass 2a: the opening setting, by majority ------------------------------------------
  const votes = courses.map(() => new Map<number, number>());
  for (const p of perNote) {
    if (!p) continue;
    const tally = votes[p.courseIndex]!;
    tally.set(p.mandal, (tally.get(p.mandal) ?? 0) + 1);
  }
  const opening = courses.map((_, i) => {
    let best = layout.naturalIndex;
    let bestN = 0;
    for (const [mandal, n] of votes[i]!) {
      // ⚠ Ties go to the mandal NEAREST THE NATURAL, not to whichever the Map happened to yield
      // first. Map order is insertion order, which is playing order — so without this the opening
      // setting would depend on which of two equally-used mandals the piece happened to touch
      // first, and the same makam would open differently in two scores.
      if (n > bestN || (n === bestN && Math.abs(mandal - layout.naturalIndex) < Math.abs(best - layout.naturalIndex))) {
        best = mandal;
        bestN = n;
      }
    }
    return best;
  });

  // --- pass 2b: the changes ----------------------------------------------------------------
  const state = opening.slice();
  const changes: MandalChange[] = [];
  for (let i = 0; i < perNote.length; i++) {
    const p = perNote[i];
    if (!p) continue;
    const from = state[p.courseIndex]!;
    if (from !== p.mandal) {
      changes.push({ noteIndex: i, courseIndex: p.courseIndex, from, to: p.mandal });
      state[p.courseIndex] = p.mandal;
    }
  }

  return { perNote, opening, changes };
}

/**
 * Round to the nearest whole mandal, and on an exact tie take the one NEARER THE NATURAL.
 *
 * ⚠ The tie is not hypothetical, and `Math.round` gets it wrong for this job. `makam.ts` carries
 * deviations of ±1.5 komas — uşşak's segâh is one — which sit exactly halfway between two mandals.
 * `Math.round` breaks such a tie towards +∞, so the same interval would round *down* when it is
 * written as a flat and *up* when it is written as a sharp: an instrument that leans sharp in one
 * makam and flat in another for no reason but the sign of the number. Leaning towards the natural
 * instead is the conservative choice, is symmetric, and is the same rule the opening setting uses.
 */
function roundToMandal(offset: number): number {
  const lo = Math.floor(offset);
  const hi = Math.ceil(offset);
  if (offset - lo < hi - offset) return lo;
  if (hi - offset < offset - lo) return hi;
  return Math.abs(lo) <= Math.abs(hi) ? lo : hi;
}

/**
 * One note → one place on the instrument, or `null`.
 *
 * The written course is tried first and almost always answers. The fallback walks the neighbours
 * and takes the one whose mandal sits nearest its natural, which is the same thing a player does
 * when an accidental is too wide for the course it is written on.
 *
 * ⚠ The rounding happens **per course**, on the offset from that course's natural — not once on
 * the sounding comma. It has to: the tie rule above is defined relative to the natural, so it
 * cannot be applied before the course is known.
 */
function place(
  n: KanunNoteInput,
  courses: readonly KanunCourse[],
  written: Map<number, KanunCourse>,
  layout: MandalLayout,
): MandalPos | null {
  if (n.courseKoma === null || !Number.isFinite(n.soundingKoma)) return null;

  const at = (c: KanunCourse, respelled: boolean): MandalPos | null => {
    const offset = roundToMandal(n.soundingKoma - c.koma);
    const mandal = mandalForOffset(offset, layout);
    if (mandal === null) return null;
    return {
      courseIndex: c.index,
      mandal,
      offset,
      residual: n.soundingKoma - (c.koma + offset),
      respelled,
    };
  };

  const spelled = written.get(n.courseKoma);
  if (spelled) {
    const p = at(spelled, false);
    if (p) return p;
  }

  let best: MandalPos | null = null;
  for (const c of courses) {
    const p = at(c, true);
    if (p && (best === null || Math.abs(p.offset) < Math.abs(best.offset))) best = p;
  }
  return best;
}

/**
 * The courses whose opening setting is not the natural — the "set these before you play" list.
 *
 * Returned in course order and NOT formatted: the caller owns the wording, because every
 * user-visible string in this project lives in `apps/web/src/ui/strings.ts`.
 */
export function openingMandals(
  plan: KanunPlan,
  courses: readonly KanunCourse[] = KANUN_COURSES,
  layout: MandalLayout = DEFAULT_MANDAL_LAYOUT,
): { course: KanunCourse; mandal: number; offset: number }[] {
  const out: { course: KanunCourse; mandal: number; offset: number }[] = [];
  for (let i = 0; i < plan.opening.length; i++) {
    const mandal = plan.opening[i]!;
    if (mandal === layout.naturalIndex) continue;
    const course = courses[i];
    if (course) out.push({ course, mandal, offset: mandalOffset(mandal, layout) });
  }
  return out;
}
