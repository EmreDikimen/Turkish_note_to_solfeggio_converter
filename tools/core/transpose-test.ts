/**
 * Transposition spelling, pinned (packages/core/src/transpose.ts).
 *
 * The owner's rule (2026-10-16): *"farklı notalar aynısının arızalısı olarak gösterilmemeli"* — two
 * different letters before a transposition are two different letters after it. si–do a whole tone
 * down is la–si♭, never la–la#. The SOUND must not care which spelling was chosen, and render jobs
 * keep the old "nearest" spelling so no synthetic corpus moves.
 *
 * Run: npx tsx tools/core/transpose-test.ts
 */
import { letterSteps, naturalKoma, transpose, type NoteEvent, type NoteModelDocument } from "../../packages/core/src/index";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) console.log(`  ok    ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${w}\n    got : ${g}`);
  }
}

const TUNING = { system: "53tet", refFreqHz: 440, refKoma: 353, commasPerOctave: 53 };
let idx = 0;
/** A note spelled `ae` (e.g. "B4", "B4b5"), its koma derived from that spelling. */
function n(ae: string): NoteEvent {
  const m = /^([A-G])(\d+)(?:([#b])(\d))?$/.exec(ae)!;
  const alter = m[3] ? (m[3] === "#" ? 1 : -1) * Number(m[4]) : 0;
  return {
    index: ++idx, kind: "note", koma53: naturalKoma(m[1]!, Number(m[2])) + alter, noteName: "", noteAE: ae,
    durationMs: 500, durationBeats: { num: 1, den: 4 }, freqHz: 0, lyric: "", offset: 0,
  };
}
const doc = (aes: string[]): NoteModelDocument => ({
  schemaVersion: 1, name: "t", makam: "", form: "", usul: "", title: "", composer: "",
  tuning: TUNING, events: aes.map(n),
} as NoteModelDocument);
const names = (d: NoteModelDocument) => d.events.map((e) => e.noteAE);

console.log("letter steps");
check("an accidental's worth keeps the letter", [1, 4, 5, 8].map(letterSteps), [0, 0, 0, 0]);
check("tones move letters", [9, 13, 18, 22, 31, 40, 49, 53].map(letterSteps), [1, 2, 2, 3, 4, 5, 6, 7]);
check("symmetric in sign", [-9, -13, -22].map(letterSteps), [-1, -2, -3]);

console.log("\nthe owner's rule");
const siDo = doc(["B4", "C5"]);
check("⭐ si–do a whole tone DOWN is la–si♭, not la–la#", names(transpose(siDo, -9, "letters")), ["A4", "B4b5"]);
check("…where the old spelling made two letters one", names(transpose(siDo, -9, "nearest")), ["A4", "A4#4"]);
check("⭐ sol + 1,5 tones is si♭, not la#", names(transpose(doc(["G4"]), 13, "letters")), ["B4b5"]);
check("la–do + 1,5 tones is do–mi♭", names(transpose(doc(["A4", "C5"]), 13, "letters")), ["C5", "E5b5"]);
const scale = doc(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]);
const up4 = transpose(scale, 22, "letters");
check(
  "⭐ a scale stays eight different letters, at every step of the list",
  [9, 13, 18, 22, 31, 40, 49].every((t) => {
    const letters = transpose(scale, t, "letters").events.map((e) => e.noteAE[0]! + e.noteAE.replace(/[^\d]/g, "")[0]);
    return new Set(letters).size === letters.length;
  }),
  true
);
check("the octave wraps letter and number: si + 1 tone is do# (si→do is 4 commas)", names(transpose(doc(["B4"]), 9, "letters")), ["C5#5"]);

console.log("\nthe sound does not care");
check(
  "same komas under both spellings",
  transpose(scale, 13, "letters").events.map((e) => e.koma53),
  transpose(scale, 13, "nearest").events.map((e) => e.koma53)
);
check("…and the same frequencies", up4.events.map((e) => e.freqHz), transpose(scale, 22, "nearest").events.map((e) => e.freqHz));

console.log("\nround trip (the edit path in App.tsx)");
const odd = doc(["B4", "C5", "F4#4", "E4b5", "G4"]);
for (const t of [-13, -9, 9, 13, 22, 31]) {
  check(`there and back by ${t} restores every spelling`, names(transpose(transpose(odd, t, "letters"), -t, "letters")), names(odd));
}

console.log("\nfallback");
check(
  "a sign the staff cannot draw falls back to the nearest spelling — that note only",
  names(transpose(doc(["F4#8", "C5"]), 13, "letters")),
  [transpose(doc(["F4#8"]), 13, "nearest").events[0]!.noteAE, "E5b5"]
);
check("the default is still 'nearest' (every other caller, render jobs included)", names(transpose(siDo, -9)), ["A4", "A4#4"]);

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
