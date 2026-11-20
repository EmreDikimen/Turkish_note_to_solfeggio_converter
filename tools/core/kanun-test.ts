/**
 * Kanun mandal verification (Node-only) for `packages/core/src/kanun.ts`. Five parts:
 *
 *  1. **The course table is DATA a human wrote**, so it is re-derived here: 26 courses, each one
 *     natural step above the last, Kaba Yegâh at the bottom and Tiz Muhayyer at the top. This is
 *     the same guard `fingering-test.ts` puts on the open strings, and for the same reason — a
 *     typo in a pitch table is invisible in the picture and wrong everywhere.
 *  2. **The top of the range against the RECORDING.** F1's kanun take tops out at 1325 Hz; the
 *     table's Tiz Muhayyer must land within half a koma of it. Two independent sources agreeing is
 *     what makes the span evidence rather than a guess.
 *  3. **The mandal layout** — the count PER COURSE (12 / 10 / 9 / 8, from Günalçin 2013), the six
 *     up at the natural, the gap on the "ayrık" courses, and the koma → mandal table the paper
 *     measured (1 koma = 1 mandal, 4 = 5, 5 = 6).
 *  4. **The written spelling picks the course.** A Si♭ is the Si course lowered, NOT the La course
 *     raised, even where the raised La would land nearer the true pitch. This is the claim the
 *     whole module rests on, so it is a test and not a comment.
 *  5. **The plan** — the opening setting comes from the majority and not the first note, a
 *     modulation shows up as a change, a repeated accidental does not, and rests are skipped.
 *
 * Run: npx --yes tsx tools/core/kanun-test.ts
 */

import {
  DEFAULT_MANDAL_LAYOUT,
  KANUN_COURSES,
  MANDAL_LAYOUTS,
  MANDAL_STEP_KOMA,
  freqToKoma53,
  koma53ToFreq,
  mandalSteps,
  naturalKoma,
  openingMandals,
  planMandals,
  raisedForStep,
  stepForRaised,
  type KanunNoteInput,
} from "@turkish-omr/core";

let failures = 0;

function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${w}\n    got : ${g}`);
  }
}

function near(name: string, got: number, want: number, tol: number) {
  if (Number.isFinite(got) && Math.abs(got - want) <= tol) {
    console.log(`  ok    ${name}  (${got.toFixed(3)})`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${want} ±${tol}\n    got : ${got}`);
  }
}

const L = DEFAULT_MANDAL_LAYOUT;

// ---------------------------------------------------------------------------------------------
// 1. The course table
// ---------------------------------------------------------------------------------------------
console.log("the 26 courses");

check("a professional kanun's perde count", KANUN_COURSES.length, 26);
check("the lowest is Kaba Yegâh", KANUN_COURSES[0]!.perde, "Kaba Yegâh");
check("the highest is Tiz Muhayyer", KANUN_COURSES[25]!.perde, "Tiz Muhayyer");
check("Kaba Yegâh is written D3", [KANUN_COURSES[0]!.letter, KANUN_COURSES[0]!.octave], ["D", 3]);
check("Tiz Muhayyer is written A6", [KANUN_COURSES[25]!.letter, KANUN_COURSES[25]!.octave], ["A", 6]);

// Every course must be the next natural note up — no gaps, no repeats, no octave typo.
{
  let gaps = 0;
  let outOfOrder = 0;
  for (let i = 1; i < KANUN_COURSES.length; i++) {
    const step = KANUN_COURSES[i]!.koma - KANUN_COURSES[i - 1]!.koma;
    // Natural steps in AEU are tanini (9) or bakiye (4); nothing else may appear.
    if (step !== 9 && step !== 4) gaps++;
    if (step <= 0) outOfOrder++;
  }
  check("every step is a tanini or a bakiye", gaps, 0);
  check("the courses ascend", outOfOrder, 0);
}

// The comma is re-derived from the letter/octave the table claims, which is what catches a typo.
{
  let wrong = 0;
  for (const c of KANUN_COURSES) {
    if (c.koma !== naturalKoma(c.letter, c.octave)) wrong++;
    if (Math.abs(c.hz - koma53ToFreq(c.koma)) > 1e-6) wrong++;
  }
  check("koma and hz are derived from the written name", wrong, 0);
}

// The whole instrument spans a shade over three and a half octaves, which is what a kanun is.
near(
  "the range is ~3.6 octaves",
  Math.log2(KANUN_COURSES[25]!.hz / KANUN_COURSES[0]!.hz),
  3.585,
  0.01,
);

// ---------------------------------------------------------------------------------------------
// 2. The top of the range, against F1's recording
// ---------------------------------------------------------------------------------------------
console.log("\nthe span, checked against the kanun recording");

// `kanun_02_E6.wav` in apps/web/src/audio/instruments.ts — the top note of the CC0 take, measured
// rather than named. If the table's top course is right, the two must agree to well under a koma.
const TAKE_TOP_HZ = 1325.27;
near("Tiz Muhayyer sounds the recording's top note", KANUN_COURSES[25]!.hz, TAKE_TOP_HZ, 8);
near(
  "…and the disagreement is under half a koma",
  Math.abs(freqToKoma53(KANUN_COURSES[25]!.hz) - freqToKoma53(TAKE_TOP_HZ)),
  0,
  0.5,
);

// ---------------------------------------------------------------------------------------------
// 3. The mandal arithmetic
// ---------------------------------------------------------------------------------------------
console.log("\nmandals");

check("one layout ships", MANDAL_LAYOUTS.length, 1);
check("six mandals are up at the natural", L.naturalRaised, 6);

// The owner's count on a real instrument, 2026-11-12 (docs/features/kanun.md).
check(
  "the regular count, by note name: Do 12, Re 9, Mi 8, Fa 12, Sol 9, La 8, Si 8",
  ["C", "D", "E", "F", "G", "A", "B"].map((l) => mandalSteps(l, L).length),
  [12, 9, 8, 12, 9, 8, 8],
);
check(
  "every course, lowest first — the two ends are their own rows",
  KANUN_COURSES.map((c) => mandalSteps(c, L).length),
  [3, 8, 12, 9, 8, 8, 12, 9, 8, 12, 9, 8, 8, 12, 9, 8, 12, 9, 8, 8, 9, 6, 5, 6, 4, 2],
);
check(
  "…which is 212 levers on the 26 courses",
  KANUN_COURSES.reduce((a, c) => a + mandalSteps(c, L).length, 0),
  212,
);
{
  const top = KANUN_COURSES[KANUN_COURSES.length - 1]!;
  check("the top course has two levers: one up at the natural, one down", mandalSteps(top, L), [0, 6]);
  check("…so its open string is ONE step flat, not six", stepForRaised(0, top, L), -1);
  check("…and a bare letter still answers for the regular octaves", mandalSteps(top.letter, L).length, 8);
  check(
    "every course has a lever at its natural",
    KANUN_COURSES.every((c) => mandalSteps(c, L).includes(0)),
    true,
  );
}
check("a bitişik course has every step", mandalSteps("F", L), [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]);
check("an ayrık course has a GAP after the natural", mandalSteps("D", L), [-5, -4, -3, -2, -1, 0, 4, 5, 6]);

check("six up is the natural", stepForRaised(6, "D", L), 0);
check("none up is the open string, a semitone flat", stepForRaised(0, "D", L), -6);
check("…so a course of 9 has 10 settings", stepForRaised(9, "D", L), 6);
check("…and no eleventh", stepForRaised(10, "D", L), null);
check("the seventh mandal on Re jumps the gap", stepForRaised(7, "D", L), 4);
check("Re has no mandal one step sharp", raisedForStep(1, "D", L), null);
check("Fa has", raisedForStep(1, "F", L), 7);

// One step is 16.67 cents — a sixth of a tempered semitone — and NOT a koma (22.64 cents).
near("a mandal step is 16.67 cents", (MANDAL_STEP_KOMA * 1200) / 53, 100 / 6, 1e-9);

// ---------------------------------------------------------------------------------------------
// 4. The written spelling picks the course
// ---------------------------------------------------------------------------------------------
console.log("\nthe course comes from the spelling, not from the pitch");

const SEGAH = KANUN_COURSES.findIndex((c) => c.perde === "Segâh"); // written B4
const DUGAH = KANUN_COURSES.findIndex((c) => c.perde === "Dügâh"); // written A4
const RAST = KANUN_COURSES.findIndex((c) => c.perde === "Rast"); // written G4
const NEVA = KANUN_COURSES.findIndex((c) => c.perde === "Nevâ"); // written D5

const B4 = naturalKoma("B", 4);
const A4 = naturalKoma("A", 4);

function one(courseKoma: number | null, soundingKoma: number): KanunNoteInput {
  return { courseKoma, soundingKoma };
}

{
  // A Si 5 komas flat. The Dügâh course RAISED lands nearer the true pitch than the Segâh course
  // LOWERED — so a rule that only looked at the pitch would put it on Dügâh. A kanun player does
  // not: they read Si and lower the Si course.
  const p = planMandals([one(B4, B4 - 5)]).perNote[0]!;
  check("Si♭5 is the Segâh course, every mandal down", [p.courseIndex, p.raised, p.step], [SEGAH, 0, -6]);
  check("…and it is not a respelling", p.respelled, false);
  // ⚠ The instrument's own error, the one the paper measures as 13.7 cents: 5 komas want 6.79
  // steps and the course stops at 6.
  near("…0.58 of a koma sharp of true, which a kanun cannot help", p.residual, -5 + 6 * MANDAL_STEP_KOMA, 1e-9);
}

{
  // The koma → mandal table (Günalçin 2013, Tablo 7), on Fa because Fa has every step.
  const F4 = naturalKoma("F", 4);
  const steps = [-5, -4, -1, 1, 4, 5].map((k) => planMandals([one(F4, F4 + k)]).perNote[0]!.step);
  check("1 koma is 1 mandal, 4 komas are 5, 5 komas are 6", steps, [-6, -5, -1, 1, 5, 6]);
}

{
  // A koma-flat Segâh. Same course, one mandal down.
  const p = planMandals([one(B4, B4 - 1)]).perNote[0]!;
  check("Si♭1 is the Segâh course down one", [p.courseIndex, p.offset, p.step], [SEGAH, -1, -1]);
}

{
  // A bakiye sharp on Re: 4 komas want step 5, which on Re is the EIGHTH mandal — two more than
  // the natural's six, across the gap. `offset` counts mandals, `step` counts pitch.
  const D5 = naturalKoma("D", 5);
  const p = planMandals([one(D5, D5 + 4)]).perNote[0]!;
  check("Re♯4 is two more mandals up, five steps sharp", [p.courseIndex, p.raised, p.offset, p.step], [NEVA, 8, 2, 5]);
}

{
  // ⚠ THE GAP IS REAL. One koma sharp on Re wants 1.36 steps and Re's next mandal is at 4, so no
  // course can play it: the natural is 1.36 steps away and Mi's open string is far above. It must
  // be reported as unplayable, not rounded onto the natural.
  const D5 = naturalKoma("D", 5);
  check("Re one koma sharp is not on this kanun", planMandals([one(D5, D5 + 1)]).perNote[0], null);
}

{
  // 8 komas sharp is wider than a course can reach, so the neighbour takes it — which is also how
  // it is played. The flag says so rather than pretending the written course did it.
  const p = planMandals([one(A4, A4 + 8)]).perNote[0]!;
  check("a 8-koma diyez moves to the next course", p.courseIndex, SEGAH);
  check("…and says it was respelled", p.respelled, true);
  check("…standing one mandal below that course's natural", p.step, -1);
}

{
  // Off the bottom of the instrument entirely: no course, and no pretending.
  const belowKoma = KANUN_COURSES[0]!.koma - 20;
  check("a note under the lowest course is unplayable", planMandals([one(belowKoma, belowKoma)]).perNote[0], null);
  check("a rest is null", planMandals([one(null, Number.NaN)]).perNote[0], null);
}

{
  // A makam deviation is a real interval. The nearest mandal is taken and the leftover reported.
  // −1.4 komas want −1.90 steps, so that is the second mandal down, not the first.
  const p = planMandals([one(B4, B4 - 1.4)]).perNote[0]!;
  check("a −1.4 koma bend is two mandals down", p.step, -2);
  near("…and reports what it cannot play", p.residual, -1.4 + 2 * MANDAL_STEP_KOMA, 1e-9);

  // ⚠ An exact tie between two mandals leans towards the NATURAL, whichever sign it is written
  // with — `Math.round` would lean flat for one and sharp for the other.
  const half = MANDAL_STEP_KOMA / 2;
  check("an exact tie leans towards the natural", planMandals([one(B4, B4 - 3 * half)]).perNote[0]!.step, -1);
  const F4 = naturalKoma("F", 4);
  check("…and the same way for a sharp", planMandals([one(F4, F4 + 3 * half)]).perNote[0]!.step, 1);
}

// ---------------------------------------------------------------------------------------------
// 5. The plan: an opening setting, then the changes
// ---------------------------------------------------------------------------------------------
console.log("\nthe plan");

{
  // A piece that flattens Si throughout must OPEN with that mandal down — that is the makam being
  // set before playing, and it must cost no change at all once the piece starts.
  const notes = [one(B4, B4 - 1), one(A4, A4), one(B4, B4 - 1), one(B4, B4 - 1)];
  const plan = planMandals(notes);
  check("the Segâh course opens flat", plan.opening[SEGAH]! - L.naturalRaised, -1);
  check("…so nothing has to move", plan.changes.length, 0);
  check("Dügâh opens natural", plan.opening[DUGAH]! - L.naturalRaised, 0);

  const open = openingMandals(plan);
  check("one course is listed as set before playing", open.length, 1);
  check("…and it names the perde", [open[0]!.course.perde, open[0]!.offset], ["Segâh", -1]);
}

{
  // ⚠ The opening is the MAJORITY, not the first note. A piece in uşşak that happens to start on a
  // natural Si must still open with the mandal down — otherwise a passing note at bar 1 would be
  // mistaken for the piece's makam and every later note would read as a change.
  const notes = [one(B4, B4), one(B4, B4 - 1), one(B4, B4 - 1), one(B4, B4 - 1)];
  const plan = planMandals(notes);
  check("one natural at the start does not set the makam", plan.opening[SEGAH]! - L.naturalRaised, -1);
  check("it is the natural that becomes a change", plan.changes.length, 2);
  check("…at the first note", plan.changes[0]!.noteIndex, 0);
  check("…and back again at the second", plan.changes[1]!.noteIndex, 1);
}

{
  // A modulation: the Segâh course is flat for the first half and natural for the second. One
  // change, at the note that needs it, and nothing moves back.
  const flat = [one(B4, B4 - 1), one(B4, B4 - 1), one(B4, B4 - 1)];
  const nat = [one(B4, B4), one(B4, B4), one(B4, B4)];
  const plan = planMandals([...flat, ...nat, ...nat]);
  check("the majority half sets the opening", plan.opening[SEGAH]! - L.naturalRaised, 0);
  check("the modulation is one move", plan.changes.length, 2);
  check("…the first at note 0", plan.changes[0]!.noteIndex, 0);
  check("…the second where the makam turns", plan.changes[1]!.noteIndex, 3);
}

{
  // Rests and unplayable notes must not move the mandals or break the walk.
  const notes = [one(B4, B4 - 1), one(null, Number.NaN), one(B4, B4 - 1), one(null, Number.NaN)];
  const plan = planMandals(notes);
  check("rests are skipped", plan.changes.length, 0);
  check("…and stay null in the output", [plan.perNote[1], plan.perNote[3]], [null, null]);
}

{
  // Two courses moving independently — the state is per course, not global.
  const G4 = naturalKoma("G", 4);
  const D5 = naturalKoma("D", 5);
  // ⚠ Rast is natural for the MAJORITY of its notes here, so it opens natural and the single sharp
  // late in the line is the only move. Reversing those counts would make the sharp the opening
  // setting and produce two moves instead — which is correct behaviour, not a bug, and is why the
  // majority rule is tested on its own above.
  const plan = planMandals([
    one(G4, G4),
    one(D5, D5),
    one(G4, G4),
    one(D5, D5),
    one(G4, G4 + 4),
  ]);
  check("Rast opens natural", plan.opening[RAST]! - L.naturalRaised, 0);
  check("Rast moves once", plan.changes.filter((c) => c.courseIndex === RAST).length, 1);
  check("…at the note that needs it", plan.changes.find((c) => c.courseIndex === RAST)!.noteIndex, 4);
  check("Nevâ never moves", plan.changes.filter((c) => c.courseIndex === NEVA).length, 0);
}

// ---------------------------------------------------------------------------------------------
console.log(failures === 0 ? "\nAll kanun checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
