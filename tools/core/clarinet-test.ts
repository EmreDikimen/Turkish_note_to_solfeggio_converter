/**
 * Sol klarnet fingering verification (Node-only) for `packages/core/src/clarinet.ts`. Five parts:
 *
 *  1. **The table is DATA a human transcribed from diagrams**, so it is re-derived here: every
 *     fingering must sit on the 53-TET chromatic ladder, in order, with no repeats. This is the
 *     same guard `fingering-test.ts` puts on the open strings and `kanun-test.ts` on the courses,
 *     and for the same reason — a typo in a pitch table is invisible in the picture and wrong
 *     everywhere.
 *  2. **THE CLAIM THE WHOLE DESIGN RESTS ON**: every step in the table is within one lip. If any
 *     gap exceeds `LIP_REACH_KOMA` there is a note the view cannot honestly draw, and the feature
 *     is broken in a way no screenshot would show.
 *  3. **The sourced fingerings themselves** — the ones read off the published diagrams, including
 *     the two that look like mistakes and are not (Si is a fork; Fa♯ opens the thumb).
 *  4. **The bend** — direction, size, the exact-note case, and the out-of-reach case that must
 *     stay `null` rather than clamp.
 *  5. **A real score.** The written range of the shipped pieces must be playable end to end; a
 *     table that is right in the abstract and unreachable on actual music is not right.
 *
 * Run: npx --yes tsx tools/core/clarinet-test.ts
 */

import {
  BASE_FINGERINGS,
  CLARINET_FINGERINGS,
  CLARINET_HIGHEST_KOMA,
  CLARINET_LOWEST_KOMA,
  LIP_REACH_KOMA,
  REGISTER_TWELFTH,
  assignClarinet,
  fingerClarinet,
  naturalKoma,
  type ClarinetKeyId,
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

function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? `\n    ${detail}` : ""}`);
  }
}

/** The fingering whose label is `label`, or a hard failure — the tests below name notes, not rows. */
function byLabel(label: string) {
  const f = CLARINET_FINGERINGS.find((x) => x.label === label);
  if (!f) throw new Error(`no fingering labelled ${label}`);
  return f;
}

/** Set-compare a fingering's keys, since the order they are written in carries no meaning. */
function keysOf(label: string): string[] {
  return [...byLabel(label).keys].sort();
}

function sorted(keys: ClarinetKeyId[]): string[] {
  return [...keys].sort();
}

// ---------------------------------------------------------------------------------------------
// 1. The table is well-formed
// ---------------------------------------------------------------------------------------------
console.log("the fingering table");

// 19 notes: Mi3 up to Si♭4, which is exactly the span of the source chart's chalumeau page.
check("the base register is 19 fingerings", BASE_FINGERINGS.length, 19);
check("a twelfth is an octave plus a fifth", REGISTER_TWELFTH, 53 + 31);

// The clarion is the chalumeau rows only — the throat notes must NOT be overblown.
check(
  "the clarion has one row per chalumeau fingering",
  CLARINET_FINGERINGS.filter((f) => f.clarion).length,
  BASE_FINGERINGS.filter((f) => f.koma <= 287).length,
);
ok(
  "no throat note is overblown",
  !CLARINET_FINGERINGS.some((f) => f.clarion && f.koma - REGISTER_TWELFTH > 287),
);
ok(
  "every clarion fingering carries the register key",
  CLARINET_FINGERINGS.filter((f) => f.clarion).every((f) => f.keys.includes("register")),
);
// ⚠ Exactly ONE non-clarion fingering carries the register key — the throat Si♭ vents with it.
// Asserting "none" would be wrong; asserting the count pins the real shape.
check(
  "only the throat Si♭ uses the register key outside the clarion",
  CLARINET_FINGERINGS.filter((f) => !f.clarion && f.keys.includes("register")).map((f) => f.label),
  ["Si4b4"],
);

// Strictly ascending, no repeats — a duplicated koma would silently shadow a fingering.
{
  let outOfOrder = 0;
  for (let i = 1; i < CLARINET_FINGERINGS.length; i++) {
    if (CLARINET_FINGERINGS[i]!.koma <= CLARINET_FINGERINGS[i - 1]!.koma) outOfOrder++;
  }
  check("the table ascends with no repeats", outOfOrder, 0);
}

// Every BASE fingering must land on the project's own chromatic ladder, in some octave. A note
// that does not is a transcription slip, and it would look perfectly reasonable in the source.
// ⚠ Only the base rows are hand-written; the clarion is derived, and a derived row is allowed to
// land off the ladder because a true twelfth above a FLAT-spelled note is not itself a spelled
// note on this grid. Testing the derivation instead is what the next check does.
{
  const NATURALS = [0, 9, 18, 22, 31, 40, 49];
  const FLATS = [5, 14, 27, 36, 45];
  const SHARPS = [4, 13, 26, 35, 44];
  const LADDER = [...NATURALS, ...FLATS, ...SHARPS];
  const off = BASE_FINGERINGS.filter((f) => !LADDER.includes(((f.koma % 53) + 53) % 53));
  check("every base fingering is on the 53-TET chromatic ladder", off.map((f) => f.label), []);
}

// The clarion is derived, so what must hold is the derivation: each clarion row carries its base
// fingering's keys plus the register, and sits a twelfth above it — give or take the one comma the
// spelling snap is allowed to move it.
{
  let badKeys = 0;
  let worstSnap = 0;
  for (const f of CLARINET_FINGERINGS.filter((x) => x.clarion)) {
    const base = BASE_FINGERINGS.find((b) => b.label === f.fingeredAs);
    if (!base) { badKeys++; continue; }
    const want = [...new Set([...base.keys, "register"])].sort().join();
    if ([...f.keys].sort().join() !== want) badKeys++;
    worstSnap = Math.max(worstSnap, Math.abs(f.koma - base.koma - REGISTER_TWELFTH));
  }
  check("every clarion row is its base fingering plus the register key", badKeys, 0);
  // ⛔ THE BUG THIS REPLACED. `Si3b4 + 84` landed on 341, one comma above Fa5 — a pitch nobody
  // writes, and the only row of the thirty-three that was off the ladder. The snap may move a row
  // by at most one comma, and must move NOTHING further.
  check("the spelling snap never moves a row more than one comma", worstSnap, 1);
}

// Every fingering, clarion included, must now name a note the app can actually spell. This is the
// check that would have caught the 341 bug on the day it was written.
{
  const NATURALS = [0, 9, 18, 22, 31, 40, 49];
  const FLATS = [5, 14, 27, 36, 45];
  const SHARPS = [4, 13, 26, 35, 44];
  const LADDER = [...NATURALS, ...FLATS, ...SHARPS];
  const off = CLARINET_FINGERINGS.filter((f) => !LADDER.includes(((f.koma % 53) + 53) % 53));
  check("every fingering names a spellable note", off.map((f) => f.label), []);
}

// The label is the note that SOUNDS, not the fingering's identity — the confusion that made the
// view look wrong to the owner. A clarion row must therefore disagree with its own fingering name.
{
  const same = CLARINET_FINGERINGS.filter((f) => f.clarion && f.label === f.fingeredAs);
  check("a clarion row is labelled by what it sounds, not what it is fingered as", same.map((f) => f.label), []);
  check("Sol5 is played with the Do4 fingering", byLabel("Sol5").fingeredAs, "Do4");
  check("…and Fa5 with the Si3b4 one", byLabel("Fa5").fingeredAs, "Si3b4");
  check("a chalumeau row has no borrowed fingering", byLabel("Sol3").fingeredAs, null);
}

// No fingering may ask for two of anything, which is what a copy-paste slip produces.
{
  const dupes = CLARINET_FINGERINGS.filter((f) => new Set(f.keys).size !== f.keys.length);
  check("no fingering repeats a key", dupes.map((f) => f.label), []);
}

// ---------------------------------------------------------------------------------------------
// 2. THE CLAIM THE DESIGN RESTS ON: every gap is inside one lip
// ---------------------------------------------------------------------------------------------
console.log("\nevery gap is within one lip");

check("the lip reaches 5 commas", LIP_REACH_KOMA, 5);

{
  const gaps: { from: string; to: string; gap: number }[] = [];
  for (let i = 1; i < CLARINET_FINGERINGS.length; i++) {
    const gap = CLARINET_FINGERINGS[i]!.koma - CLARINET_FINGERINGS[i - 1]!.koma;
    if (gap > LIP_REACH_KOMA) {
      gaps.push({ from: CLARINET_FINGERINGS[i - 1]!.label, to: CLARINET_FINGERINGS[i]!.label, gap });
    }
  }
  check("no gap in the table exceeds the lip's reach", gaps, []);
}

// The stronger form of the same claim, stated the way the view needs it: EVERY comma across the
// instrument's whole span resolves to a fingering. A gap test alone would pass on a table whose
// first entry sat above the range we then ask about.
{
  let unreachable = 0;
  for (let k = CLARINET_LOWEST_KOMA; k <= CLARINET_HIGHEST_KOMA; k++) {
    if (fingerClarinet(k) === null) unreachable++;
  }
  check("every comma in range is playable", unreachable, 0);
}

// ---------------------------------------------------------------------------------------------
// 3. The sourced fingerings
// ---------------------------------------------------------------------------------------------
console.log("\nthe fingerings read off the published diagrams");

const ALL_SEVEN: ClarinetKeyId[] = ["thumb", "lh1", "lh2", "lh3", "rh1", "rh2", "rh3"];

check("everything closed sounds Sol3", keysOf("Sol3"), sorted(ALL_SEVEN));
check("Sol3 is where the owner said it is", byLabel("Sol3").koma, naturalKoma("G", 3));
check("La3 lifts the bell-most hole", keysOf("La3"), sorted(["thumb", "lh1", "lh2", "lh3", "rh1", "rh2"]));

// ⭐ THE TWO THE BOEHM SOURCES GOT WRONG. Both are pinned by name, because both look like a
// pattern anyone would "correct" by eye, and both cost a semitone if they are.
check(
  "Si3 is one MORE hole open than Si3b4 — not a fork",
  keysOf("Si3"),
  sorted(["thumb", "lh1", "lh2", "lh3", "rh1"]),
);
check(
  "Si3b4 is La3 plus one key, not a hole change",
  keysOf("Si3b4"),
  sorted(["thumb", "lh1", "lh2", "lh3", "rh1", "rh2", "key_bes"]),
);
ok(
  "…so Si3b4 and Si3 differ by a hole, in the Albert direction",
  keysOf("Si3").length === keysOf("Si3b4").filter((k) => k !== "key_bes").length - 1,
);

// ⚠ Each of these five keys is pressed on EXACTLY ONE note, which is what the owner's own table
// says and what makes the id meaningful. If a future edit reuses one somewhere else, the id stops
// describing anything and this catches it.
{
  const soleUse: Record<string, string> = {
    key_e: "Mi3", key_fis: "Sol3b4", key_gis3: "La3b4", key_bes: "Si3b4",
    key_cis: "Re4b4", key_dis: "Mi4b4", key_f4: "Fa4", key_gis4: "La4b4",
  };
  const wrong: string[] = [];
  for (const [key, note] of Object.entries(soleUse)) {
    const users = BASE_FINGERINGS.filter((f) => f.keys.includes(key as ClarinetKeyId)).map((f) => f.label);
    if (users.join() !== note) wrong.push(`${key}: ${users.join("/") || "unused"}`);
  }
  check("each single-note key is used on exactly its own note", wrong, []);
}

// ⭐ The one key shared by more than one fingering: down for all three of the lowest notes.
check(
  "key_low is the only shared key, and it covers the bottom three",
  BASE_FINGERINGS.filter((f) => f.keys.includes("key_low")).map((f) => f.label),
  ["Mi3", "Fa3", "Sol3b4"],
);

check("Mi3 adds its own key on top of key_low", keysOf("Mi3"), sorted([...ALL_SEVEN, "key_low", "key_e"]));
check("Fa3 is key_low alone", keysOf("Fa3"), sorted([...ALL_SEVEN, "key_low"]));
check("Mi4b4 uses key_dis", keysOf("Mi4b4"), sorted(["thumb", "lh1", "lh2", "key_dis"]));
check("Fa4 is the left index plus its own key", keysOf("Fa4"), sorted(["thumb", "lh1", "key_f4"]));
check("La4 is the throat key", keysOf("La4"), ["key_a4"]);
check("La4b4 has a key of its own, not the throat one", keysOf("La4b4"), ["key_gis4"]);

check("Sol4 opens the thumb too", keysOf("Sol4"), []);
// ⚠ The throat Si♭ vents with the REGISTER key on an Albert, and it shares its other key with La4.
check("Si4b4 vents with the register key", keysOf("Si4b4"), sorted(["register", "key_a4"]));

// The register key doubles the whole chalumeau up a twelfth, and the source chart agrees with the
// arithmetic in two independent places: its clarion B4 is the Mi3 fingering, its C6 the Fa4.
check("Mi3 overblown is Si4", byLabel("Mi3").koma + REGISTER_TWELFTH, naturalKoma("B", 4));
check("Fa4 overblown is Do6", byLabel("Fa4").koma + REGISTER_TWELFTH, naturalKoma("C", 6));
check("Sol3 overblown is Re5", byLabel("Sol3").koma + REGISTER_TWELFTH, naturalKoma("D", 5));

// The chart spells the black notes as flats, and on this grid that is a comma away from the sharp.
// It is asserted so nobody "tidies" the table onto sharps and moves every one of them.
check("Re♭4 is the lowered spelling", byLabel("Re4b4").koma, naturalKoma("D", 4) - 4);
check("Mi♭4 is the lowered spelling", byLabel("Mi4b4").koma, naturalKoma("E", 4) - 4);

// ---------------------------------------------------------------------------------------------
// 4. The bend
// ---------------------------------------------------------------------------------------------
console.log("\nthe lip bend");

{
  const exact = fingerClarinet(naturalKoma("G", 3));
  check("an ordinary note bends nothing", exact?.bendKoma, 0);
  check("…and uses its own fingering", CLARINET_FINGERINGS[exact!.fingeringIndex]!.label, "Sol3");
}

{
  // A koma-flattened Do4: one comma below the fingering, so one comma of lip.
  const p = fingerClarinet(naturalKoma("C", 4) - 1);
  check("a koma below Do4 takes the Do4 fingering", CLARINET_FINGERINGS[p!.fingeringIndex]!.label, "Do4");
  check("…and one comma of lip", p!.bendKoma, 1);
}

{
  // The bend always runs DOWN, so the fingering chosen is never below the note.
  let below = 0;
  for (let k = CLARINET_LOWEST_KOMA; k <= CLARINET_HIGHEST_KOMA; k++) {
    const p = fingerClarinet(k);
    if (p && CLARINET_FINGERINGS[p.fingeringIndex]!.koma < k) below++;
  }
  check("the fingering is never below the note", below, 0);
}

{
  let negative = 0;
  for (let k = CLARINET_LOWEST_KOMA; k <= CLARINET_HIGHEST_KOMA; k++) {
    const p = fingerClarinet(k);
    if (p && p.bendKoma < 0) negative++;
  }
  check("the lip never tightens upward", negative, 0);
}

// Out of range must be null, never a clamp onto a note that is not there.
// ⚠ "Below the lowest fingering" is NOT out of range: the lip reaches down, so the floor sits a
// whole reach under the lowest fingering. Getting this backwards was a bug in this test, not in
// the module — the first version asserted null one comma below and the module was right.
ok("one comma under the lowest fingering is still playable", fingerClarinet(CLARINET_LOWEST_KOMA - 1) !== null);
check("a full lip under it is still playable",
  fingerClarinet(CLARINET_LOWEST_KOMA - LIP_REACH_KOMA)?.bendKoma, LIP_REACH_KOMA);
check("past the lip, below the lowest fingering is unplayable",
  fingerClarinet(CLARINET_LOWEST_KOMA - LIP_REACH_KOMA - 1), null);
check("above the highest is unplayable", fingerClarinet(CLARINET_HIGHEST_KOMA + 1), null);
check("a rest is unplayable", fingerClarinet(Number.NaN), null);

// The out-of-reach case, forced with a deliberately sparse table: a lip that cannot get there must
// report nothing rather than draw a bend the player cannot make.
{
  const sparse = [
    { koma: 100, label: "low", keys: [], clarion: false },
    { koma: 120, label: "high", keys: [], clarion: false },
  ];
  check("6 commas below is out of reach at reach 5", fingerClarinet(114, 5, sparse), null);
  check("…while 5 commas below is not", fingerClarinet(115, 5, sparse)?.bendKoma, 5);
}

// ---------------------------------------------------------------------------------------------
// 5. A real score's range
// ---------------------------------------------------------------------------------------------
console.log("\nthe shipped scores are playable");

{
  // The written span the four scores on disk actually use, measured 2026-08-29: G4 up to C6.
  const lo = naturalKoma("G", 4);
  const hi = naturalKoma("C", 6);
  let unplayable = 0;
  for (let k = lo; k <= hi; k++) if (fingerClarinet(k) === null) unplayable++;
  check("every written comma from Sol4 to Do6 is playable", unplayable, 0);
  ok("…and the top of that span is in the clarion", CLARINET_FINGERINGS[fingerClarinet(hi)!.fingeringIndex]!.clarion);
}

{
  // Rests carry through as null and do not shift the alignment — the property the view relies on.
  const out = assignClarinet([naturalKoma("G", 4), Number.NaN, naturalKoma("A", 4)]);
  check("the result is aligned 1:1 with the input", out.length, 3);
  check("a rest is null", out[1], null);
  ok("the notes around it still resolve", out[0] !== null && out[2] !== null);
}

// ---------------------------------------------------------------------------------------------
console.log(failures === 0 ? "\nAll clarinet checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
