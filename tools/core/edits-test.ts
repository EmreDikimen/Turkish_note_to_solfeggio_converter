/**
 * Edit-primitive verification (Node-only) for `packages/core/src/edits.ts`. Two parts:
 *
 *  1. **Unit tests** — hand-built events covering the pitch rewrite, the wheel's diatonic nudge
 *     (including the octave seam), and deleting a note with its grace notes.
 *  2. **Round-trip over every bundled score** — for all ~2,300 notes, read the spelling back out
 *     of the event and re-apply it; `noteName` and `koma53` must come out unchanged. That pins
 *     the primitives against real exporter output rather than against hand-written expectations.
 *
 * Known, accepted round-trip diff (documented in edits.ts, not a bug here):
 *  - `noteAE` is AEU-SNAPPED by the Python exporter but exact in `withPitch` (matching
 *    tools/render/stitch.ts and what MeasureEditModal always wrote), so it is not compared.
 *  - `durationMs` is not compared either: `beatsToMs` derives it from the piece's MEDIAN
 *    whole-note length, which is ±1 ms off SymbTr's own per-event timing.
 *
 * Run: npx --yes tsx tools/core/edits-test.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  deleteEvent,
  komaOf,
  nudgePitch,
  renumber,
  spellingOf,
  withAlter,
  withDurationBeats,
  withKoma,
  withPitch,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";

let failures = 0;

function check(name: string, got: string, want: string) {
  if (got === want) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${want}\n    got : ${got}`);
  }
}

const TUNING = { system: "53tet", refFreqHz: 440, refKoma: 353, commasPerOctave: 53 };

/** A minimal note event; `over` fills in whatever the test cares about. */
function note(over: Partial<NoteEvent> = {}): NoteEvent {
  return {
    index: 1, kind: "note", koma53: 318, noteName: "Do5", noteAE: "C5",
    durationMs: 500, durationBeats: { num: 1, den: 4 }, freqHz: 523.2,
    lyric: "", offset: 0, ...over,
  };
}

function doc(events: NoteEvent[]): NoteModelDocument {
  return {
    schemaVersion: 1, name: "t", makam: "", form: "", usul: "", title: "", composer: "",
    tuning: TUNING, events,
  };
}

// ---------------------------------------------------------------------------------------------
// 1. Pitch: every derived field moves together

console.log("\nPitch");

{
  // THE ROLL BUG, pinned: before edits.ts, a koma-only patch left `noteName` behind — and the
  // sheet reads its staff position from noteName, so the sound moved and the notehead did not.
  const before = note({ koma53: 318, noteName: "Do5", noteAE: "C5" });
  const after = withKoma(before, 327, TUNING); // 318 + 9 commas = one whole tone up
  check("withKoma moves noteName", after.noteName, "Re5");
  check("withKoma moves noteAE", after.noteAE, "D5");
  check("withKoma moves koma53", String(after.koma53), "327");
  check("withKoma moves freqHz", String(after.freqHz !== before.freqHz), "true");
  check("withKoma leaves duration alone", String(after.durationMs), "500");
}

{
  // The spelling the user picked is preserved exactly — Fa5#5, never the enharmonic Sol5b4.
  const after = withPitch(note(), { letter: "F", octave: 5, alter: 5 }, TUNING);
  check("withPitch keeps the chosen spelling", after.noteName, "Fa5#5");
  check("withPitch koma matches the spelling", String(after.koma53), String(komaOf("F", 5, 5)));
  const back = spellingOf(after);
  check("spellingOf round-trips", JSON.stringify(back), JSON.stringify({ letter: "F", octave: 5, alter: 5 }));
}

{
  // There is no koma `komaToName` refuses — it searches the octaves around the value, so even an
  // absurd one spells. What matters is that the event stays SELF-CONSISTENT rather than ending up
  // with a name and a koma that disagree.
  const after = withKoma(note(), 999999, TUNING);
  const s = spellingOf(after)!;
  check("an extreme koma still spells consistently", String(komaOf(s.letter, s.octave, s.alter)), String(after.koma53));
}

// ---------------------------------------------------------------------------------------------
// 2. The wheel: diatonic steps that carry the accidental

console.log("\nnudgePitch");

check(
  "up one step carries the alteration",
  JSON.stringify(nudgePitch({ letter: "A", octave: 4, alter: -1 }, 1)),
  JSON.stringify({ letter: "B", octave: 4, alter: -1 }),
);
check(
  "up across the B–C seam bumps the octave",
  JSON.stringify(nudgePitch({ letter: "B", octave: 4, alter: -1 }, 1)),
  JSON.stringify({ letter: "C", octave: 5, alter: -1 }),
);
check(
  "down across the C–B seam drops the octave",
  JSON.stringify(nudgePitch({ letter: "C", octave: 5, alter: 4 }, -1)),
  JSON.stringify({ letter: "B", octave: 4, alter: 4 }),
);
check(
  "seven steps is exactly an octave",
  JSON.stringify(nudgePitch({ letter: "G", octave: 3, alter: 8 }, 7)),
  JSON.stringify({ letter: "G", octave: 4, alter: 8 }),
);
check(
  "minus seven steps is an octave down",
  JSON.stringify(nudgePitch({ letter: "G", octave: 3, alter: 0 }, -7)),
  JSON.stringify({ letter: "G", octave: 2, alter: 0 }),
);
{
  // The staff position moves; the sounding pitch moves with it and the accidental rides along.
  const ev = withPitch(note(), { letter: "B", octave: 4, alter: -1 }, TUNING);
  const up = withPitch(ev, nudgePitch(spellingOf(ev)!, 1), TUNING);
  check("a nudged note keeps its koma flat", up.noteName, "Do5b1");
}

// ---------------------------------------------------------------------------------------------
// 3. Deleting: graces go with their host, and indices stay contiguous

console.log("\ndeleteEvent");

{
  // g1 g2 belong to n3 (a grace attaches to the note that FOLLOWS it); n4 has none.
  const d = doc([
    note({ index: 1, noteName: "Do5" }),
    note({ index: 2, kind: "grace", noteName: "Re5" }),
    note({ index: 3, kind: "grace", noteName: "Mi5" }),
    note({ index: 4, noteName: "Fa5" }),
    note({ index: 5, noteName: "Sol5" }),
  ]);
  const out = deleteEvent(d, 4);
  check("deleting a host takes its graces", out.events.map((e) => e.noteName).join(" "), "Do5 Sol5");
  check("indices stay contiguous", out.events.map((e) => e.index).join(","), "1,2");

  const out2 = deleteEvent(d, 5);
  check(
    "deleting a note with no graces leaves the others",
    out2.events.map((e) => e.noteName).join(" "),
    "Do5 Re5 Mi5 Fa5",
  );
  check("deleting an unknown index is a no-op", String(deleteEvent(d, 99) === d), "true");
}

{
  const out = renumber([note({ index: 7 }), note({ index: 3 }), note({ index: 9 })]);
  check("renumber is 1..N in order", out.map((e) => e.index).join(","), "1,2,3");
}

// ---------------------------------------------------------------------------------------------
// 4. Duration

console.log("\nwithDurationBeats");

{
  const d = doc([note({ durationBeats: { num: 1, den: 4 }, durationMs: 500 })]);
  const out = withDurationBeats(d.events[0]!, { num: 1, den: 8 }, d);
  check("beats are set", JSON.stringify(out.durationBeats), JSON.stringify({ num: 1, den: 8 }));
  check("ms follows the beats (half the value → half the time)", String(out.durationMs), "250");
}

// ---------------------------------------------------------------------------------------------
// 4b. The palette's accidental tool: the alteration moves, the staff position does not

console.log("\nwithAlter");

{
  const ev = withPitch(note(), { letter: "B", octave: 4, alter: 0 }, TUNING);
  const flat = withAlter(ev, -1, TUNING);
  check("the alteration is applied", flat.noteName, "Si4b1");
  check("the staff position stays put", JSON.stringify(spellingOf(flat)!.letter + spellingOf(flat)!.octave), JSON.stringify("B4"));
  check("the sounding koma follows", String(flat.koma53), String(komaOf("B", 4, -1)));
  check("re-applying the same alteration is a no-op", String(withAlter(flat, -1, TUNING) === flat), "true");
  check("a rest is left alone", String(withAlter(note({ kind: "rest" }), -1, TUNING).kind), "rest");
  check("duration is untouched", String(flat.durationBeats.den), "4");
}

// ---------------------------------------------------------------------------------------------
// 5. Round-trip over every bundled score

console.log("\nRound-trip over the bundled scores");

{
  const dir = join(process.cwd(), "apps/web/public");
  let notes = 0;
  let nameBad = 0;
  let komaBad = 0;
  let files = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(join(dir, f), "utf8")) as NoteModelDocument;
    if (!Array.isArray(d.events)) continue;
    files++;
    for (const ev of d.events) {
      if (ev.kind !== "note") continue;
      const s = spellingOf(ev);
      if (!s) continue;
      notes++;
      const re = withPitch(ev, s, d.tuning);
      if (re.noteName !== ev.noteName) nameBad++;
      if (re.koma53 !== ev.koma53) komaBad++;
    }
  }
  console.log(`  (${files} scores, ${notes} notes)`);
  check("noteName survives a spelling round-trip", String(nameBad), "0");
  check("koma53 survives a spelling round-trip", String(komaBad), "0");
  check("the corpus is not empty", String(notes > 1000), "true");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
