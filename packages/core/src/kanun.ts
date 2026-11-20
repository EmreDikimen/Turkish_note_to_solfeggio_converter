/**
 * Kanun mandals — which course is plucked, and where its mandals must stand (feature F3).
 *
 * What/why: the violin half of this feature answers *where does the finger go*, and every note is
 * an independent question. **A kanun is not like that, and that difference is the whole design.**
 * A mandal is a small lever under one course; raising it shortens the strings by one MANDAL STEP
 * (16.67 cents — a sixth of a tempered semitone, NOT a koma), and it
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
 *   * `MANDAL_LAYOUTS` — how many mandals EACH course carries (it differs by note name) and
 *     which pitch each one gives, as DATA.
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
 * One mandal step, in Holdrian komas.
 *
 * ⚠ **A MANDAL IS NOT A KOMA** (2026-11-11 — until then this file said it was). Kanun makers fit
 * the levers 16.67 cents apart, six to a tempered semitone, which makes the kanun a **72-tone
 * equal** instrument sitting under a 53-comma notation. So one koma is one mandal (6.8 cents
 * flat of true), but a 4-koma bakiye is the **5th** mandal and a 5-koma küçük mücenneb is the
 * **6th** — the full semitone, 13.7 cents flat of true. Source: Günalçin, *Kanunda Ses Sistemi
 * Sorunları Üzerine Bir Araştırma*, Rast Müzikoloji Dergisi I/2 (2013), Şekil 1 and Tablo 7.
 */
export const MANDAL_STEPS_PER_OCTAVE = 72;
export const MANDAL_STEP_KOMA = 53 / MANDAL_STEPS_PER_OCTAVE;

/**
 * How many mandals each course carries, and what each one gives.
 *
 * ⚠ **THE COUNT DIFFERS FROM COURSE TO COURSE, BY NOTE NAME** — every course was 12 here until
 * 2026-11-11, which no real kanun is. Günalçin (2013, Tablo 1) counted nine Turkish makers'
 * instruments. On all nine:
 *
 *   * **the six mandals nearest the nut are UP when the course sounds its natural**, so lowering
 *     them one by one flattens it a step at a time, and all six down is the open string — a
 *     tempered semitone flat. That half is the same on every course;
 *   * **Do and Fa carry six more, with no gap** ("bitişik", 12 in all): every step up to a
 *     semitone sharp;
 *   * **every other course carries only two to four more, set apart behind a gap** ("ayrık"):
 *     they are the TOP steps of the sharp semitone, so the small sharps simply do not exist there.
 *
 * ⚠ **THE ROW THAT SHIPS IS ONE REAL INSTRUMENT, COUNTED BY THE OWNER** (2026-11-12), not the
 * paper's majority: Do 12, Re 9, Mi 8, Fa 12, **Sol 9, La 8**, Si 8 — the paper's majority has
 * Sol 10 and La 9, and its makers do differ by a lever there. The owner's counts agree with a
 * 108-megapixel photo of the same instrument on fourteen courses in a row. Numbers and sources:
 * docs/features/kanun.md.
 *
 * ⚠ **THE TWO ENDS ARE NOT THE MIDDLE, SO THE COUNT IS PER COURSE WHERE IT HAS TO BE** (`courses`
 * below). The mandal board narrows at the top and the lowest strings carry almost nothing: the
 * owner counted 2, 4 and 6 levers on the top three courses and 3 on the lowest. ⚠ A TOTAL is what
 * was counted; **how it splits into up-at-natural and down, and which step a lone lever gives, is
 * a GUESS from the photo** on every override — marked in the table. Nothing in the planner or the
 * drawing counts levers on its own, so correcting a guess is a one-line edit.
 */
/** What one course carries: levers up at its natural, and the sharp steps that have a lever. */
export interface CourseMandals {
  naturalRaised: number;
  sharpSteps: readonly number[];
}

/** A course as the layout needs it — or a bare letter, which means "the middle octaves". */
export type CourseRef = string | { letter: string; octave: number };

export interface MandalLayout {
  id: string;
  label: string;
  /**
   * How many mandals stand UP when a course sounds its natural. It is also how many steps the open
   * string (every mandal down) sits below the natural. ⚠ The regular value — a course listed in
   * `courses` has its own; ask `naturalRaisedOf`, do not read this field for a given course.
   */
  naturalRaised: number;
  /**
   * Per WRITTEN letter: the steps above the natural that have a mandal, ascending. A missing step
   * is a pitch that course cannot make.
   */
  sharpSteps: Readonly<Record<string, readonly number[]>>;
  /**
   * The courses that do NOT follow their letter, keyed by written letter + octave ("D3"). A course
   * that is absent here is regular.
   */
  courses?: Readonly<Record<string, CourseMandals>>;
}

export const MANDAL_LAYOUTS: readonly MandalLayout[] = [
  {
    id: "owner-2026-11-12",
    label: "12 / 9 / 8 mandal",
    naturalRaised: 6,
    sharpSteps: {
      C: [1, 2, 3, 4, 5, 6],
      D: [4, 5, 6],
      E: [5, 6],
      F: [1, 2, 3, 4, 5, 6],
      G: [4, 5, 6],
      A: [5, 6],
      B: [5, 6],
    },
    courses: {
      // TOTAL counted by the owner; the split and the step are GUESSES from the photo.
      D3: { naturalRaised: 2, sharpSteps: [6] }, // 3
      F6: { naturalRaised: 3, sharpSteps: [1, 2, 3] }, // 6
      G6: { naturalRaised: 3, sharpSteps: [6] }, // 4
      A6: { naturalRaised: 1, sharpSteps: [6] }, // 2
      // NOT counted by the owner — the photo alone, low end of its range. Guesses throughout.
      C6: { naturalRaised: 5, sharpSteps: [1, 2, 3, 4] }, // 9
      D6: { naturalRaised: 4, sharpSteps: [5, 6] }, // 6
      E6: { naturalRaised: 4, sharpSteps: [6] }, // 5
      // ⚠ E3 and F3 are deliberately absent: the owner called the second course "odd, keep what
      // the app draws", and gave no number for the third. They stay regular (8 and 12) — unknown.
    },
  },
];

export const DEFAULT_MANDAL_LAYOUT = MANDAL_LAYOUTS[0]!;

/** What one course carries under a layout — its own row if it has one, else its letter's. */
export function courseMandals(ref: CourseRef, layout: MandalLayout = DEFAULT_MANDAL_LAYOUT): CourseMandals {
  if (typeof ref !== "string") {
    const own = layout.courses?.[`${ref.letter}${ref.octave}`];
    if (own) return own;
  }
  const letter = typeof ref === "string" ? ref : ref.letter;
  return { naturalRaised: layout.naturalRaised, sharpSteps: layout.sharpSteps[letter] ?? [] };
}

/** How many mandals are up when this course sounds its natural. */
export function naturalRaisedOf(ref: CourseRef, layout: MandalLayout = DEFAULT_MANDAL_LAYOUT): number {
  return courseMandals(ref, layout).naturalRaised;
}

/**
 * The step each mandal of one course gives when it is the LAST one standing up, nut side first.
 * Its length is how many mandals the course has.
 *
 * ⚠ Pass the COURSE wherever there is one. A bare letter answers for the regular octaves only and
 * is blind to the per-course rows at the two ends of the instrument.
 */
export function mandalSteps(ref: CourseRef, layout: MandalLayout = DEFAULT_MANDAL_LAYOUT): number[] {
  const m = courseMandals(ref, layout);
  const flats = Array.from({ length: m.naturalRaised }, (_, i) => i + 1 - m.naturalRaised);
  return [...flats, ...m.sharpSteps];
}

/**
 * What a course sounds with its first `raised` mandals up, in steps from the natural.
 *
 * ⚠ `raised` runs from **0**, and 0 is a real setting: every mandal down is the open string, the
 * flattest the course goes. A course of N mandals therefore has N + 1 settings, not N.
 */
export function stepForRaised(
  raised: number,
  ref: CourseRef,
  layout: MandalLayout = DEFAULT_MANDAL_LAYOUT,
): number | null {
  if (raised === 0) return -naturalRaisedOf(ref, layout);
  return mandalSteps(ref, layout)[raised - 1] ?? null;
}

/** How many mandals must be up for a course to sound `step`, or `null` if it has none there. */
export function raisedForStep(
  step: number,
  ref: CourseRef,
  layout: MandalLayout = DEFAULT_MANDAL_LAYOUT,
): number | null {
  if (step === -naturalRaisedOf(ref, layout)) return 0;
  const i = mandalSteps(ref, layout).indexOf(step);
  return i < 0 ? null : i + 1;
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
   * measured in real intervals, and `makam.ts` carries entries like −1.5 komas. A mandal is a fixed
   * step, so a kanun cannot play most of them exactly — see `residual` below.
   */
  soundingKoma: number;
}

/** Where one note is played: which course, and where that course's mandals must stand. */
export interface MandalPos {
  courseIndex: number;
  /** How many of the course's mandals are up, counting from the nut. 0 = the open string. */
  raised: number;
  /** What that sounds, in mandal steps from the natural. Negative is flat. */
  step: number;
  /**
   * How many mandals this is away from the natural setting — `raised` minus the layout's
   * `naturalRaised`. It is what a player DOES ("two more up"), and it is not `step`: on a course
   * with a gap, two more mandals up is five steps sharp.
   */
  offset: number;
  /**
   * How far the wanted pitch is from what this setting actually gives, in **komas** — signed.
   *
   * ⚠ **It is not a rounding convenience, it is a fact about the instrument.** The notation counts
   * in komas (22.6 cents) and the mandals in steps of 16.67, so almost nothing lands exactly: one
   * koma is 0.30 of a koma off, a 5-koma flat 0.60. Reporting it is the honest thing; hiding it
   * would claim the instrument can do something it cannot. Zero only for a natural.
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

/** One mandal move, at the note that forced it. `from` / `to` are counts of mandals up. */
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
   * How many mandals each course must have up BEFORE the first note — the makam's setting, one
   * entry per course. This is what a player prepares, and it is worth showing on its own.
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
 * 2. **Read the opening setting off pass 1, then walk.** Each course opens at the setting it uses
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
    tally.set(p.raised, (tally.get(p.raised) ?? 0) + 1);
  }
  const opening = courses.map((_c, i) => {
    const natural = naturalRaisedOf(courses[i]!, layout);
    let best = natural;
    let bestN = 0;
    for (const [raised, n] of votes[i]!) {
      // ⚠ Ties go to the setting NEAREST THE NATURAL, not to whichever the Map happened to yield
      // first. Map order is insertion order, which is playing order — so without this the opening
      // setting would depend on which of two equally-used settings the piece happened to touch
      // first, and the same makam would open differently in two scores.
      if (n > bestN || (n === bestN && Math.abs(raised - natural) < Math.abs(best - natural))) {
        best = raised;
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
    if (from !== p.raised) {
      changes.push({ noteIndex: i, courseIndex: p.courseIndex, from, to: p.raised });
      state[p.courseIndex] = p.raised;
    }
  }

  return { perNote, opening, changes };
}

/**
 * How far a wanted pitch may sit from the nearest mandal and still be played on it, in steps.
 *
 * ⚠ **One whole step, and the number is read off the instrument rather than chosen.** A 5-koma
 * flat wants 6.79 steps and the course has only 6, so it is played 0.79 of a step flat of true —
 * and that is what every kanun does: the paper measures exactly this 13.7 cents and calls the full
 * semitone the instrument's küçük mücenneb. So half a step would wrongly refuse the commonest flat
 * in the repertoire. Anything looser than one step would start hiding real gaps: a 1-koma sharp on
 * Re wants 1.36 steps, Re has no mandal before step 4, and the honest answer there is that this
 * course cannot play it — not that its natural is close enough.
 */
const REACH_STEPS = 1;

/**
 * One note → one place on the instrument, or `null`.
 *
 * The written course is tried first and almost always answers. The fallback walks every course and
 * takes the one that lands NEAREST the wanted pitch, which is the same thing a player does when an
 * accidental is too wide for the course it is written on.
 *
 * ⚠ **The nearest mandal is searched, not rounded to**, because a course's steps are no longer a
 * plain run of integers — Re has a mandal at 0 and the next at +4. An exact tie between two
 * mandals goes to the one NEARER THE NATURAL: `Math.round` would break it towards +∞, so the same
 * interval would lean one way written as a flat and the other way written as a sharp.
 */
function place(
  n: KanunNoteInput,
  courses: readonly KanunCourse[],
  written: Map<number, KanunCourse>,
  layout: MandalLayout,
): MandalPos | null {
  if (n.courseKoma === null || !Number.isFinite(n.soundingKoma)) return null;

  const at = (c: KanunCourse, respelled: boolean): MandalPos | null => {
    const want = (n.soundingKoma - c.koma) / MANDAL_STEP_KOMA;
    const natural = naturalRaisedOf(c, layout);
    const steps = [-natural, ...mandalSteps(c, layout)];
    let raised = 0;
    for (let r = 1; r < steps.length; r++) {
      const d = Math.abs(steps[r]! - want);
      const best = Math.abs(steps[raised]! - want);
      if (d < best - 1e-9 || (Math.abs(d - best) <= 1e-9 && Math.abs(steps[r]!) < Math.abs(steps[raised]!))) {
        raised = r;
      }
    }
    const step = steps[raised]!;
    if (Math.abs(step - want) > REACH_STEPS + 1e-9) return null;
    return {
      courseIndex: c.index,
      raised,
      step,
      offset: raised - natural,
      residual: n.soundingKoma - (c.koma + step * MANDAL_STEP_KOMA),
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
    if (!p) continue;
    if (
      best === null ||
      Math.abs(p.residual) < Math.abs(best.residual) - 1e-9 ||
      (Math.abs(Math.abs(p.residual) - Math.abs(best.residual)) <= 1e-9 && Math.abs(p.step) < Math.abs(best.step))
    ) {
      best = p;
    }
  }
  return best;
}

/**
 * The courses whose opening setting is not the natural — the "set these before you play" list.
 *
 * Returned in course order and NOT formatted: the caller owns the wording, because every
 * user-visible string in this project lives in `apps/web/src/ui/strings.ts`.
 *
 * ⚠ `offset` is in MANDALS from the natural setting — how many more to raise, or to lower — and
 * `step` is what that sounds. They differ on a course with a gap.
 */
export function openingMandals(
  plan: KanunPlan,
  courses: readonly KanunCourse[] = KANUN_COURSES,
  layout: MandalLayout = DEFAULT_MANDAL_LAYOUT,
): { course: KanunCourse; raised: number; offset: number; step: number }[] {
  const out: { course: KanunCourse; raised: number; offset: number; step: number }[] = [];
  for (let i = 0; i < plan.opening.length; i++) {
    const raised = plan.opening[i]!;
    const course = courses[i];
    if (!course) continue;
    const natural = naturalRaisedOf(course, layout);
    if (raised === natural) continue;
    const step = stepForRaised(raised, course, layout);
    if (step !== null) out.push({ course, raised, offset: raised - natural, step });
  }
  return out;
}
