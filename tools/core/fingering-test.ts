/**
 * Violin fingering verification (Node-only) for `packages/core/src/fingering.ts`. Four parts:
 *
 *  1. **The open-string table is DATA a human wrote**, so `openHz` is re-derived from
 *     `concertKoma` here. That is the only thing standing between a typo and a fingerboard that
 *     is silently a semitone out everywhere — the same class of bug that cost F1 four rounds of
 *     ear feedback (docs/features/audio-sources.md).
 *  2. **The formula** — open, the octave, the double octave, and the two ways a note can be
 *     unreachable (below the string, past the end of the fingerboard).
 *  3. **The microtones** — a koma sharp and a küçük sharp on the same degree must land on
 *     DIFFERENT positions. This is the feature's entire claim, so it is a test and not a comment.
 *  4. **The string-choice rule** — first position by default, no thrashing on stepwise motion,
 *     a shift when the melody genuinely leaves the string, and rests that do not move the hand.
 *
 * Run: npx --yes tsx tools/core/fingering-test.ts
 */

import {
  assignFingering,
  koma53ToFreq,
  positionOnString,
  ratioToCommas,
  commasToRatio,
  firstPositionFinger,
  FIRST_POSITION_NOTES,
  DEFAULT_VIOLIN_TUNING,
  FINGERBOARD_END_RATIO,
  VIOLIN_TUNINGS,
  type FingerPos,
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
    console.log(`  ok    ${name}  (${got.toFixed(4)})`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${want} ±${tol}\n    got : ${got}`);
  }
}

const STRINGS = DEFAULT_VIOLIN_TUNING.strings;
const [G, D, A, E] = STRINGS as [(typeof STRINGS)[number], (typeof STRINGS)[number], (typeof STRINGS)[number], (typeof STRINGS)[number]];

// ---------------------------------------------------------------------------------------------
// 1. The tuning table
// ---------------------------------------------------------------------------------------------
console.log("open strings");

check("one tuning ships; the table is the seam for a second", VIOLIN_TUNINGS.length, 1);
check("four strings, lowest first", STRINGS.map((s) => s.id), ["g", "d", "a", "e"]);
check(
  "strings ascend",
  STRINGS.every((s, i) => i === 0 || s.openHz > STRINGS[i - 1]!.openHz),
  true,
);
for (const s of STRINGS) {
  near(`${s.label}: openHz is koma53ToFreq(${s.concertKoma})`, s.openHz, koma53ToFreq(s.concertKoma), 1e-9);
}
// The anchor itself: concert comma 327 IS 440 Hz by definition (tuning.ts), so a mistake in the
// fifth-stack shows up here rather than as a uniformly wrong-but-plausible fingerboard.
near("La is concert A 440", A.openHz, 440, 1e-9);
check("strings are a fifth (31 commas) apart", STRINGS.map((s) => s.concertKoma - 327), [-62, -31, 0, 31]);
// ⚠ Not twelve-tone: a 53-TET fifth is 701.89 cents, so Sol sits ~3.8 cents under a tuner's G3.
near("Sol is close to, and NOT equal to, 12-TET G3 196.00", G.openHz, 196.0, 0.5);

// ---------------------------------------------------------------------------------------------
// 2. The formula
// ---------------------------------------------------------------------------------------------
console.log("\nposition on a string");

check("the open string is ratio 0", positionOnString(440, 440), 0);
near("the octave is exactly half the string", positionOnString(440, 880)!, 0.5, 1e-12);
near("two octaves is three quarters", positionOnString(440, 1760)!, 0.75, 1e-12);
near("a fifth up is a third of the way", positionOnString(440, 660)!, 1 / 3, 1e-12);
check("below the open string is unreachable", positionOnString(440, 439), null);
check("a rest (NaN) is unreachable", positionOnString(440, NaN), null);
check("nonsense input is unreachable, not NaN", positionOnString(0, 440), null);

// ---------------------------------------------------------------------------------------------
// 3. The microtones — the claim the whole feature rests on
// ---------------------------------------------------------------------------------------------
console.log("\nkomas are distinguishable");

// Written Do5 = comma 318 in this project's grid; a koma sharp is +1 and a küçük sharp is +4.
// Sounding frequencies come out of the same tuning the app plays (tuning.ts).
const natural = koma53ToFreq(318);
const komaSharp = koma53ToFreq(319);
const kucukSharp = koma53ToFreq(322);
const rNat = positionOnString(D.openHz, natural)!;
const rKoma = positionOnString(D.openHz, komaSharp)!;
const rKucuk = positionOnString(D.openHz, kucukSharp)!;

check("all three are on the string", [rNat, rKoma, rKucuk].every((r) => r > 0 && r < 1), true);
check("they are strictly ordered, not rounded together", rNat < rKoma && rKoma < rKucuk, true);
// A koma is ~22.6 cents, so one comma is a real distance but a small one. On the shipped photo the
// nut→bridge run is 487.5 px, which is what turns these ratios into the ~7 px/koma of
// docs/features/fingerboard.md — the known limit of the artwork, asserted here so a future image swap
// that quietly halves the resolution is visible.
const PX = 487.5;
near("one koma is several pixels, not a fraction of one", (rKoma - rNat) * PX, 5, 3);
near("koma sharp and küçük sharp are ~3 komas apart on the string", (rKucuk - rKoma) * PX, 15, 8);

// ---------------------------------------------------------------------------------------------
// 4. The string-choice rule
// ---------------------------------------------------------------------------------------------
console.log("\nchoosing a string");

const at = (r: (FingerPos | null)[], i: number) => r[i];

// A note that is an open string should be played open, not stopped high on a lower string.
check(
  "an open-string pitch, cold, is played open",
  at(assignFingering([A.openHz], STRINGS), 0),
  { stringIndex: 2, ratio: 0 },
);
check(
  "the lowest note has only one home",
  at(assignFingering([G.openHz], STRINGS), 0)?.stringIndex,
  0,
);

// Below the G string, and past the end of the fingerboard: both unplayable, and both must say so
// rather than being clamped. ⚠ The low case is NOT an edge case in this repertoire — Turkish
// notation transposes down a fourth, so a written G3 sounds D3, well under a standard violin.
check("below the lowest string is null", at(assignFingering([G.openHz / 2], STRINGS), 0), null);
check(
  "past the end of the fingerboard is null",
  at(assignFingering([E.openHz / (1 - FINGERBOARD_END_RATIO) + 500], STRINGS), 0),
  null,
);
check(
  "a note just inside the fingerboard's end is still placed",
  at(assignFingering([E.openHz / (1 - (FINGERBOARD_END_RATIO - 0.01))], STRINGS), 0) !== null,
  true,
);

// A stepwise passage inside one string's comfortable range must not hop strings on every note.
const scale = [0, 9, 17, 22, 31, 40, 48, 53].map((c) => koma53ToFreq(327 + c)); // A4 up an octave
const scaleFing = assignFingering(scale, STRINGS);
check("a scale from an open string is fully placeable", scaleFing.every((f) => f !== null), true);
check(
  "…and it does not thrash between strings",
  new Set(scaleFing.map((f) => f!.stringIndex)).size <= 2,
  true,
);
check("…starting open on La", scaleFing[0], { stringIndex: 2, ratio: 0 });
check(
  "…and ascending along the piece",
  scaleFing.every((f, i) => i === 0 || f!.stringIndex > scaleFing[i - 1]!.stringIndex || f!.ratio >= scaleFing[i - 1]!.ratio - 1e-9),
  true,
);

// Left alone, the rule must not climb: a melody that fits under one hand should stay there
// instead of wandering up a lower string, which is what a pure "nearest to last" rule would do.
const lowTune = [296, 300, 305, 309, 305, 300, 296].map((k) => koma53ToFreq(k));
const lowFing = assignFingering(lowTune, STRINGS);
check("a melody inside one string's first position stays on it", new Set(lowFing.map((f) => f!.stringIndex)).size, 1);
check("…and never climbs the neck", lowFing.every((f) => f !== null && f.ratio < 0.25), true);

// The other half of the same rule, and the reason it is greedy rather than per-note: once the
// music has FORCED a shift, the hand stays in the new position for notes it can now reach there.
// A violinist coming down to the Sol string for a low note plays the next D there too, rather
// than jumping straight back to the open Re — so the run below must not bounce between strings.
const dip = [296, 292, 296].map((k) => koma53ToFreq(k));
const dipFing = assignFingering(dip, STRINGS);
check("a dip below the string forces a shift down", dipFing[1]?.stringIndex, 0);
check("…and the hand stays there rather than jumping back", dipFing[2]?.stringIndex, 0);

// Rests must not move the hand: the note after a rest is fingered as if the rest were not there.
const withRest = assignFingering([koma53ToFreq(340), NaN, koma53ToFreq(341)], STRINGS);
const without = assignFingering([koma53ToFreq(340), koma53ToFreq(341)], STRINGS);
check("a rest is null", withRest[1], null);
check("a rest does not move the hand", withRest[2], without[1]);

// ---------------------------------------------------------------------------------------------
// 4b. The hand, as a place on the neck (2026-08-27) — the rule this model replaced got these wrong
// ---------------------------------------------------------------------------------------------
//
// The old cost was `|Δratio|` with no notion of a hand, so an ascending line always found it
// cheaper to slide one more note up the string it was on than to cross to a higher one. The app
// showed the result: `meltem_notes.json` put 22 of 83 notes above the octave, the top one over two
// octaves up the SOL string. These four cases are that failure, written down so it cannot return.
console.log("\nthe hand as a place on the neck");

// Two octaves up from the open Sol. A violinist walks up the strings; the old rule walked up one.
const climbCommas = [0, 9, 17, 22, 31, 40, 48, 53, 62, 70, 75, 84, 93, 101, 106];
const climb = assignFingering(climbCommas.map((c) => koma53ToFreq(265 + c)), STRINGS);
check("a two-octave climb is fully placeable", climb.every((f) => f !== null), true);
check(
  "…and it walks up the STRINGS, not up one string",
  climb.map((f) => f!.stringIndex),
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3],
);
check(
  "…so the hand never leaves first position",
  climb.every((f) => f!.ratio <= 0.35),
  true,
);

// The same climb, but starting on a note only the Sol string can play — the exact shape that
// trapped the old rule, because it forces the hand down before the music goes up.
const forcedLow = [265, 270, 296, 305, 313, 318, 327, 335, 340, 349, 358, 366, 371];
const afterDip = assignFingering(forcedLow.map((k) => koma53ToFreq(k)), STRINGS);
check("a forced low start is on the Sol string", afterDip[0]!.stringIndex, 0);
check(
  "…and the climb after it leaves that string rather than riding it up",
  afterDip[afterDip.length - 1]!.stringIndex > 0,
  true,
);
check(
  "…with nothing placed above the octave",
  afterDip.every((f) => f!.ratio < 0.5),
  true,
);

// The other half: a shift must still happen when there is no string left to cross to. Above what
// first position reaches on the Mi string, the hand HAS to travel — a model that never shifts is
// as wrong as one that never crosses.
const tooHigh = assignFingering([1400], STRINGS);
check("a note past first position is still placed", tooHigh[0] !== null, true);
check("…on the top string, since there is nothing higher", tooHigh[0]!.stringIndex, 3);
near("…and the hand shifts to reach it", ratioToCommas(tooHigh[0]!.ratio), 58, 1);

// A genuine leap should shift string rather than stretch impossibly far up the current one.
const leap = assignFingering([G.openHz, koma53ToFreq(358)], STRINGS); // open Sol, then Mi5
check("a big leap changes string", leap[1]?.stringIndex, 3);
check("…landing open", leap[1]?.ratio, 0);

// ---------------------------------------------------------------------------------------------
// 5. Naming a position: commas above the open string, and the first-position finger band
// ---------------------------------------------------------------------------------------------
//
// `ratioToCommas` is the inverse of `positionOnString`, and it is what lets the fingerboard's
// position lines be COLOURED by finger rather than left as anonymous marks. Checked against the
// intervals a violinist would name: the fourth is a quarter of the string, the fifth a third of
// it, the octave a half — those three are arithmetic, not opinion, so a wrong formula cannot hide.
console.log("\nnaming a position");

const upG = (commas: number) => positionOnString(G.openHz, koma53ToFreq(265 + commas))!;

// ⚠ The fourth and the fifth are the 53-TET ones, so they are NEAR a quarter and a third of the
// string, not exactly on them — 53-TET's fifth is 701.89 cents against a pure 701.96, which is
// 3e-5 of the string here. The octave IS exact, because it is a power of two in any equal
// division. A tolerance tighter than this would be testing the wrong music.
near("a fourth up is about a quarter of the string", upG(22), 0.25, 5e-5);
near("a fifth up is about a third of it", upG(31), 1 / 3, 5e-5);
near("the octave is exactly half of it", upG(53), 0.5, 1e-12);
near("…and the distance reads back as its interval", ratioToCommas(upG(22)), 22, 1e-6);
near("…at the octave too", ratioToCommas(upG(53)), 53, 1e-6);

// The bands are a first-position guide, so what matters is that each standard placement lands on
// the finger a player would use for it — and that anything past a fifth above the open string
// claims no finger at all rather than a wrong one.
check("the open string is no finger", firstPositionFinger(0), null);
check("a semitone up is the first finger", firstPositionFinger(upG(4)), 1);
check("a whole tone up is the first finger", firstPositionFinger(upG(9)), 1);
check("a minor third is the second", firstPositionFinger(upG(13)), 2);
check("a major third is the second", firstPositionFinger(upG(17)), 2);
check("a fourth is the third", firstPositionFinger(upG(22)), 3);
check("a fifth is the fourth", firstPositionFinger(upG(31)), 4);
check("past first position, no finger is claimed", firstPositionFinger(upG(40)), null);

// The fixed chart the fingerboard draws (owner, 2026-08-27: the lines show standard violin notes
// and are NOT arranged by the piece's komas). Two properties carry the whole design:
//   * an UNALTERED note lands exactly on a line — which is only true because the chart is written
//     on this project's 53-TET grid (naturals spaced 9/4 commas) and not in twelve-tone;
//   * everything a makam adds lands BETWEEN two lines, which is what the view exists to show.
check("seven places, one per finger-stop in first position", FIRST_POSITION_NOTES.length, 7);
check(
  "…the ordinary semitone steps, on the AEU grid",
  [...FIRST_POSITION_NOTES],
  [4, 9, 13, 18, 22, 26, 31],
);
check(
  "…each on the finger that plays it",
  FIRST_POSITION_NOTES.map((c) => firstPositionFinger(commasToRatio(c))),
  [1, 1, 2, 2, 3, 3, 4],
);
check(
  "…and none past what a first-position hand reaches",
  FIRST_POSITION_NOTES.every((c) => c <= 31),
  true,
);
// `commasToRatio` is the inverse of `ratioToCommas`, and the chart is drawn through it — a drift
// between the two would move every line off the note it names.
check(
  "the chart round-trips through the position formula",
  FIRST_POSITION_NOTES.every((c) => Math.abs(ratioToCommas(commasToRatio(c)) - c) < 1e-9),
  true,
);
// The whole claim, in one line: a koma-flattened third is NOT on the major-third line, and the gap
// is a comma — visible on the shipped photo, where a comma is several pixels near the nut.
const segah = commasToRatio(17);
const majorThird = commasToRatio(18);
check("a koma-flattened third misses the line", segah !== majorThird, true);
near("…by about one comma of string", (majorThird - segah) * 487.5, 4, 2);

// The feature's own claim, restated in the language the lines are drawn in: a koma sharp and a
// küçük sharp are NOT the same line, so colouring by band must not quietly merge them.
check("a koma and a küçük above the same degree stay apart", upG(18) === upG(17), false);

check("length is preserved", assignFingering([440, NaN, 880, 1], STRINGS).length, 4);
check("an empty piece is empty", assignFingering([], STRINGS), []);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
