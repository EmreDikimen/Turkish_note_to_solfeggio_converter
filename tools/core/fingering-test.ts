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
// docs/features/README.md — the known limit of the artwork, asserted here so a future image swap
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

// A genuine leap should shift string rather than stretch impossibly far up the current one.
const leap = assignFingering([G.openHz, koma53ToFreq(358)], STRINGS); // open Sol, then Mi5
check("a big leap changes string", leap[1]?.stringIndex, 3);
check("…landing open", leap[1]?.ratio, 0);

check("length is preserved", assignFingering([440, NaN, 880, 1], STRINGS).length, 4);
check("an empty piece is empty", assignFingering([], STRINGS), []);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
