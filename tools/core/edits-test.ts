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
  groupMeasures,
  insertInMeasure,
  komaOf,
  measureBeats,
  measureOfEvent,
  nudgePitch,
  renumber,
  scaleDurations,
  spellingOf,
  toNote,
  toRest,
  withAlter,
  withDurationBeats,
  withKoma,
  withPitch,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { closedTupletAt, drawnTupletAt, memberPositions, plainTupletBase, tupletGroupsIn, tupletRunFrom, tupletEdgeTo } from "../render/rhythm";

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
// 4c. Which bar an edit landed in — what the editor's Çal-from-last-edit starts from

console.log("\nmeasureOfEvent");

{
  // Eight quarter notes, no usable `offset` (they are all 0), so grouping falls back to whole-note
  // accumulation: four to a bar. Indices 1–4 are bar 1, 5–8 are bar 2.
  const d = doc([1, 2, 3, 4, 5, 6, 7, 8].map((i) => note({ index: i })));
  check("the first note is in bar 1", String(measureOfEvent(d, 1)), "1");
  check("the last note of bar 1", String(measureOfEvent(d, 4)), "1");
  check("a note in the next bar", String(measureOfEvent(d, 6)), "2");
  check("an unknown index has no bar", String(measureOfEvent(d, 99)), "null");
  check("a meta event has no bar", String(measureOfEvent(doc([note({ index: 1, kind: "meta" })]), 1)), "null");

  // The editor plays from `Measure.startMs`, so a later bar must have a real offset into the piece
  // — a lookup that always returned 0 would make Çal-from-last-edit silently start at the top.
  const bar2 = groupMeasures(d).find((m) => m.index === 2)!;
  check("a later bar starts later than the top", String(bar2.startMs), "2000");
}

// ---------------------------------------------------------------------------------------------
// 4d. Inserting: the bar ABSORBS the new note and bar lines never move (editor step 6)

console.log("\ninsertInMeasure");

{
  // Eight quarters → four to a bar, as above. The new note is a 1/4 Sol5.
  const d = doc([1, 2, 3, 4, 5, 6, 7, 8].map((i) => note({ index: i, noteName: "Do5" })));
  const fresh = note({ index: -1, noteName: "Sol5" });
  const names = (x: NoteModelDocument, bar: number) =>
    groupMeasures(x).find((m) => m.index === bar)!.events.map((e) => e.noteName).join(" ");

  const mid = insertInMeasure(d, fresh, 1, 3); // before the third note of bar 1
  check("the note lands where it was asked for", names(mid, 1), "Do5 Do5 Sol5 Do5 Do5");
  check("it is stamped with the bar's number", String(groupMeasures(mid)[0]!.events[2]!.bar), "1");
  check("indices are renumbered contiguously", mid.events.map((e) => e.index).join(","), "1,2,3,4,5,6,7,8,9");
  check("the following bar is untouched", names(mid, 2), "Do5 Do5 Do5 Do5");

  // The whole point of "absorb": the bar is now OVER its length and there are still two bars.
  check("BAR LINES NEVER MOVE — the bar count is unchanged", String(groupMeasures(mid).length), "2");
  check("the bar is left over its length", String(measureBeats(groupMeasures(mid)[0]!.events)), "1.25");

  const end = insertInMeasure(d, fresh, 1, null); // append to bar 1
  check("a null target appends to the bar", names(end, 1), "Do5 Do5 Do5 Do5 Sol5");
  check("appending does not leak into the next bar", names(end, 2), "Do5 Do5 Do5 Do5");
  check("appending keeps the bar count", String(groupMeasures(end).length), "2");

  const second = insertInMeasure(d, fresh, 2, 5); // before the first note of bar 2
  check("inserting at a bar's head stays in that bar", names(second, 2), "Sol5 Do5 Do5 Do5 Do5");
  check("...and leaves the bar before it alone", names(second, 1), "Do5 Do5 Do5 Do5");

  check("an unknown measure is a no-op", String(insertInMeasure(d, fresh, 99, null) === d), "true");
  check("a target from ANOTHER bar is a no-op", String(insertInMeasure(d, fresh, 1, 6) === d), "true");
  check("an unknown target index is a no-op", String(insertInMeasure(d, fresh, 1, 99) === d), "true");
}

{
  // g2 g3 lead into n4. Inserting before n4 must go before its graces, or the new note steals them.
  const d = doc([
    note({ index: 1, noteName: "Do5", bar: 1 }),
    note({ index: 2, kind: "grace", noteName: "Re5", bar: 1 }),
    note({ index: 3, kind: "grace", noteName: "Mi5", bar: 1 }),
    note({ index: 4, noteName: "Fa5", bar: 1 }),
  ]);
  const out = insertInMeasure(d, note({ index: -1, noteName: "Sol5" }), 1, 4);
  check(
    "a grace run stays with its host",
    out.events.map((e) => e.noteName).join(" "),
    "Do5 Sol5 Re5 Mi5 Fa5",
  );

  // ...and when the grace run reaches the bar's own head, the new note becomes the bar's first
  // event rather than being pushed back into the PREVIOUS bar — the walk-back stops at firstAt.
  // (`assignBars` puts a barline grace with the note it ornaments, so bar 2 really can open on one.)
  const d2 = doc([
    note({ index: 1, noteName: "Do5", bar: 1 }),
    note({ index: 2, kind: "grace", noteName: "Re5", bar: 2 }),
    note({ index: 3, noteName: "Mi5", bar: 2 }),
  ]);
  const out2 = insertInMeasure(d2, note({ index: -1, noteName: "Sol5" }), 2, 3);
  check("the walk-back stops at the bar's own head", out2.events.map((e) => e.noteName).join(" "), "Do5 Sol5 Re5 Mi5");
  check("...the grace still leads into ITS host", String(groupMeasures(out2)[1]!.events.map((e) => e.noteName).join(" ")), "Sol5 Re5 Mi5");
  check("...so the bar count is still what it was", String(groupMeasures(out2).length), "2");
}

// ---------------------------------------------------------------------------------------------
// 4b. Rests: note → rest → note (the palette's rest tools, 2026-08-08)

console.log("\nRests");

{
  const d = doc([note({ index: 1, noteName: "Do5", noteAE: "C5", koma53: 318, lyric: "Al" })]);
  const rest = toRest(d.events[0]!, { num: 1, den: 8 }, d);
  check("kind becomes rest", rest.kind, "rest");
  check("the value is the tool's", `${rest.durationBeats.num}/${rest.durationBeats.den}`, "1/8");
  check("durationMs came with it", String(rest.durationMs > 0), "true");
  // The whole pitch side must go: a rest that still says Do5 engraves as silence and reads as a
  // note to anything that inspects the document.
  check("noteName is cleared", rest.noteName, "Es");
  check("noteAE is cleared", rest.noteAE, "Es");
  check("koma is cleared", String(rest.koma53), "-1");
  check("freqHz is cleared", String(rest.freqHz), "null");
  check("the lyric goes too — nothing sings on a rest", rest.lyric, "");

  const back = toNote(rest, { letter: "F", octave: 5, alter: -1 }, { num: 1, den: 4 }, d);
  check("kind becomes note again", back.kind, "note");
  check("the supplied spelling is used exactly", back.noteName, "Fa5b1");
  check("a sounding koma is derived", String(back.koma53 > 0), "true");
  check("...and a frequency with it", String(back.freqHz != null), "true");
  check("the new value applies", `${back.durationBeats.num}/${back.durationBeats.den}`, "1/4");
}

// ---------------------------------------------------------------------------------------------
// 5. The tuplet tool (editor step 7): which notes, and the arithmetic on them
//
// The selection rules live in tools/render/rhythm.ts, beside the functions that DRAW the bracket
// and write the `\tup3` label, so the editor cannot offer a triplet the engraver would refuse.
// They are tested here, with the edit they serve.

console.log("\nTuplets");

{
  const eighths = [1, 2, 3, 4].map((i) => note({ index: i, durationBeats: { num: 1, den: 8 } }));

  const run = tupletRunFrom(eighths, 0);
  check("three equal eighths make a run", String(run?.join(",")), "0,1,2");
  check("a run needs three notes, not two", String(tupletRunFrom(eighths, 2)), "null");

  // Mixed values: a bracket over notes of different lengths would draw a "3" over a rhythm the
  // ×2/3 does not produce.
  const mixed = [
    note({ index: 1, durationBeats: { num: 1, den: 8 } }),
    note({ index: 2, durationBeats: { num: 1, den: 4 } }),
    note({ index: 3, durationBeats: { num: 1, den: 8 } }),
  ];
  check("mixed durations are refused", String(tupletRunFrom(mixed, 0)), "null");

  // Dotted: three dotted 8ths at ×2/3 sum to 9/16, which never lands on a plain value, so
  // `tupletGroupsIn` could not close the group and the bracket would be a lie.
  const dotted = [1, 2, 3].map((i) => note({ index: i, durationBeats: { num: 3, den: 16 } }));
  check("a dotted value cannot start a tuplet", String(plainTupletBase(dotted[0]!)), "false");
  check("...so the run is refused", String(tupletRunFrom(dotted, 0)), "null");

  // Already a triplet: 1/12 × 2/3 = 1/18 is not a rhythm anyone read.
  const already = [1, 2, 3].map((i) => note({ index: i, durationBeats: { num: 1, den: 12 } }));
  check("an existing tuplet member cannot start one", String(tupletRunFrom(already, 0)), "null");

  // Graces take no time and are drawn on the note that follows them — they ride along, exactly as
  // `tupletGroupsIn` already treats them, and are not counted as members.
  const withGrace = [
    note({ index: 1, durationBeats: { num: 1, den: 8 } }),
    note({ index: 2, kind: "grace", durationBeats: { num: 0, den: 1 } }),
    note({ index: 3, durationBeats: { num: 1, den: 8 } }),
    note({ index: 4, durationBeats: { num: 1, den: 8 } }),
  ];
  check("a grace is skipped, not counted", String(tupletRunFrom(withGrace, 0)?.join(",")), "0,2,3");

  // The edit itself, and back again.
  const d = doc(eighths.map((e) => ({ ...e, bar: 1 })));
  const trip = scaleDurations(d, [1, 2, 3], { num: 2, den: 3 });
  check(
    "each member is now a twelfth",
    trip.events.slice(0, 3).map((e) => `${e.durationBeats.num}/${e.durationBeats.den}`).join(" "),
    "1/12 1/12 1/12",
  );
  check("the fraction comes out REDUCED (2/24 would not match isTupletMember's raw reader)",
    String(trip.events[0]!.durationBeats.num), "1");
  check("the untouched note is untouched", `${trip.events[3]!.durationBeats.num}/${trip.events[3]!.durationBeats.den}`, "1/8");
  // durationMs is re-derived from the piece's tempo, not scaled from the old value, so it lands
  // within rounding of two thirds — the point being that it MOVED with the beats at all.
  check("durationMs followed the beats",
    String(Math.abs(trip.events[0]!.durationMs - (eighths[0]!.durationMs * 2) / 3) < 1), "true");

  // The bar is left SHORT on purpose: 3/8 became 1/4. Edits absorb, bar lines never move.
  check("the bar absorbs the change", String(measureBeats(trip.events.slice(0, 3))), String(0.25));

  // The engraver now sees it as a group, which is the whole point: nothing is stored.
  const groups = tupletGroupsIn(trip.events);
  check("the engraver finds exactly one group", String(groups.length), "1");
  check("...covering the three members", `${groups[0]!.from}-${groups[0]!.to}`, "0-2");
  check("closedTupletAt finds it from any member", String(closedTupletAt(trip.events, 1) != null), "true");

  const back = scaleDurations(trip, [1, 2, 3], { num: 3, den: 2 });
  check(
    "×3/2 is the exact inverse",
    JSON.stringify(back.events.map((e) => e.durationBeats)),
    JSON.stringify(d.events.map((e) => e.durationBeats)),
  );
  check("...including durationMs", JSON.stringify(back.events.map((e) => e.durationMs)),
    JSON.stringify(d.events.map((e) => e.durationMs)));

  // An UNCLOSED run is the model's mistake, drawn with a bracket precisely because it is wrong.
  // Multiplying it back by 3/2 would invent a rhythm, so the tool must not offer to remove it.
  const unclosed = [
    note({ index: 1, durationBeats: { num: 1, den: 12 } }),
    note({ index: 2, durationBeats: { num: 1, den: 12 } }),
    note({ index: 3, durationBeats: { num: 1, den: 4 } }),
  ];
  check("an unclosed run still draws a bracket", String(tupletGroupsIn(unclosed).length), "1");
  check("...but is NOT removable", String(closedTupletAt(unclosed, 0)), "null");
}

// ---------------------------------------------------------------------------------------------
// 5b. The tuplet HANDLES (editor step 7b): sliding a held triplet along its bar
//
// The group keeps exactly three members — the drawn digit is a hardcoded "3" and the label token is
// `\tup3`, so a wider group would draw and label a rhythm nobody wrote. So a handle SLIDES the
// group, and the question `tupletEdgeTo` answers is which notes leave and which join.

console.log("\nTuplet handles");

{
  /** Five eighths with the first three made a triplet — the shape the handles work on. */
  const bar = () => {
    const evs = [1, 2, 3, 4, 5].map((i) => note({ index: i, durationBeats: { num: 1, den: 8 } }));
    const d = scaleDurations(doc(evs.map((e) => ({ ...e, bar: 1 }))), [1, 2, 3], { num: 2, den: 3 });
    return d.events;
  };
  const evs = bar();
  const g = closedTupletAt(evs, 0)!;
  check("the fixture holds one closed triplet", `${g.from}-${g.to}`, "0-2");

  // Right handle onto the fourth note: the first member hands its eighth back, the fourth joins.
  const right = tupletEdgeTo(evs, g, "end", 3);
  check("the right handle can reach the next note", right != null, true);
  check("...the first member leaves", String(right?.leaving.join(",")), "0");
  check("...the next note joins", String(right?.joining.join(",")), "3");
  check("...and the group lands on 1-3", `${right?.group.from}-${right?.group.to}`, "1-3");

  // The move is exactly two scalings, and it holds up in the DRAWING code, which is the only
  // definition of a triplet there is.
  {
    const moved = scaleDurations(
      scaleDurations(doc(evs), [1], { num: 3, den: 2 }),
      [4],
      { num: 2, den: 3 },
    );
    const gs = tupletGroupsIn(moved.events);
    check("the engraver finds one group after the slide", String(gs.length), "1");
    check("...over the notes the handle named", `${gs[0]!.from}-${gs[0]!.to}`, "1-3");
    check("the note that left is a plain eighth again",
      `${moved.events[0]!.durationBeats.num}/${moved.events[0]!.durationBeats.den}`, "1/8");
    check("the note that joined is a twelfth",
      `${moved.events[3]!.durationBeats.num}/${moved.events[3]!.durationBeats.den}`, "1/12");
    // A slide is length-neutral by construction: one member gives back exactly what the newcomer
    // takes. Compared with a tolerance because `measureBeats` sums floats — the exact rationals are
    // equal, and 3 × 1/12 is what a float cannot represent.
    check("the bar length is unchanged by a slide",
      String(Math.abs(measureBeats(moved.events) - measureBeats(evs)) < 1e-9), "true");
  }

  // Standing still is not a move: without this the handle would jump on the first pixel of a drag.
  check("landing where it already is is refused", String(tupletEdgeTo(evs, g, "end", 2)), "null");
  check("...and so is the other end", String(tupletEdgeTo(evs, g, "start", 0)), "null");

  // Off the end of the bar: a tuplet is strictly intra-measure, and `events` is one measure.
  check("the right handle cannot run past the last note", String(tupletEdgeTo(evs, g, "end", 5)), "null");
  check("the left handle cannot run before the first", String(tupletEdgeTo(evs, g, "start", 3)), "null");

  // A neighbour of a different length cannot join: the three members must end up on ONE plain
  // value, or `tupletGroupsIn` could not close the group.
  {
    const mixed = bar();
    mixed[3] = { ...mixed[3]!, durationBeats: { num: 1, den: 4 } };
    check("a quarter next door cannot join the triplet", String(tupletEdgeTo(mixed, g, "end", 3)), "null");
  }
  {
    const dotted = bar();
    dotted[3] = { ...dotted[3]!, durationBeats: { num: 3, den: 16 } };
    check("nor can a dotted eighth", String(tupletEdgeTo(dotted, g, "end", 3)), "null");
  }

  // The triplet next door: its members are 1/12, which is not a plain value, so they are refused
  // without any rule about groups being written down.
  {
    const two = doc([1, 2, 3, 4, 5, 6].map((i) => ({ ...note({ index: i, durationBeats: { num: 1, den: 8 } }), bar: 1 })));
    const both = scaleDurations(scaleDurations(two, [1, 2, 3], { num: 2, den: 3 }), [4, 5, 6], { num: 2, den: 3 });
    const g1 = closedTupletAt(both.events, 0)!;
    check("two triplets sit side by side", String(tupletGroupsIn(both.events).length), "2");
    check("one cannot eat the other's notes", String(tupletEdgeTo(both.events, g1, "end", 3)), "null");
  }

  // Graces take no time: they ride along and are neither members nor landings, exactly as
  // `tupletRunFrom` and `tupletGroupsIn` already treat them.
  {
    const withGrace = [
      ...bar().slice(0, 3),
      { ...note({ index: 9, kind: "grace", durationBeats: { num: 0, den: 1 } }), bar: 1 },
      ...bar().slice(3),
    ];
    const gg = closedTupletAt(withGrace, 0)!;
    const move = tupletEdgeTo(withGrace, gg, "end", 4);
    check("a grace is not a landing", String(tupletEdgeTo(withGrace, gg, "end", 3)), "null");
    check("...and the note after it is", String(move?.joining.join(",")), "4");
  }

  // A stray unclosed tuplet fraction just before the window would make `tupletGroupsIn` open its
  // run early and close a bracket over the WRONG three notes. The simulation inside `tupletEdgeTo`
  // is what catches that — no rule states it.
  {
    const stray = [
      { ...note({ index: 1, durationBeats: { num: 1, den: 12 } }), bar: 1 },
      ...[2, 3, 4, 5].map((i) => ({ ...note({ index: i, durationBeats: { num: 1, den: 8 } }), bar: 1 })),
    ];
    const made = scaleDurations(doc(stray), [2, 3, 4], { num: 2, den: 3 }).events;
    // Positions 0..3 are now all twelfths: 1/12 × 4 sums plain at position 2, so the drawn group is
    // 0-2, not the 1-3 the tool made. That is the state the guard exists for.
    const gs = tupletGroupsIn(made);
    check("a stray fraction shifts what the engraver draws", `${gs[0]!.from}-${gs[0]!.to}`, "0-2");
    const held = closedTupletAt(made, 0)!;
    const bad = tupletEdgeTo(made, held, "end", 4);
    check("a slide that would draw a bracket over other notes is refused", String(bad), "null");
  }
}

// ---------------------------------------------------------------------------------------------
// 5c. BROKEN marks: a bracket over one or two notes, and repairing it
//
// `tupletGroupsIn` draws a mark over a run that never sums to a plain value — the model's misread,
// drawn on purpose so a person can see it. Those marks are common on decoded pages (`decoded.json`
// carries five), and the owner asked to be able to clear or complete them (2026-08-30). A real
// triplet SLIDES; a broken mark is REPAIRED — the grabbed end moves, the other stays.

console.log("\nBroken tuplet marks");

{
  /** Two twelfths then plain eighths: the shape a dropped `\tup3` member leaves behind. */
  const brokenBar = () => {
    const evs = [1, 2, 3, 4, 5].map((i) => ({
      ...note({ index: i, durationBeats: { num: 1, den: 8 } }),
      bar: 1,
    }));
    return scaleDurations(doc(evs), [1, 2], { num: 2, den: 3 }).events;
  };
  const evs = brokenBar();
  const g = drawnTupletAt(evs, 0)!;
  check("the engraver draws a mark over the two", `${g.from}-${g.to}`, "0-1");
  check("...but it is NOT a real triplet", String(closedTupletAt(evs, 0)), "null");
  check("...and drawnTupletAt finds it where closedTupletAt cannot", String(drawnTupletAt(evs, 1) != null), "true");

  // THE REPAIR: pull the right end onto the next plain eighth and the group closes.
  const fix = tupletEdgeTo(evs, g, "end", 2);
  check("the right handle can complete it", fix != null, true);
  check("...nothing leaves", String(fix?.leaving.length), "0");
  check("...the next note joins", String(fix?.joining.join(",")), "2");
  check("...and the result is a REAL triplet", String(fix?.closes), "true");
  {
    const fixed = scaleDurations(doc(evs), [3], { num: 2, den: 3 }).events;
    check("the engraver now draws one closed group", String(closedTupletAt(fixed, 0) != null), "true");
    check("...over all three", memberPositions(fixed, drawnTupletAt(fixed, 0)!).join(","), "0,1,2");
  }

  // A one-note mark — the leftover the owner named. Both handles sit on the same note.
  {
    // Built from PLAIN eighths and scaling only the first — `brokenBar()` has already scaled two,
    // and scaling one of those again would make a 1/18, which is not a rhythm anyone reads.
    const plain = [1, 2, 3, 4, 5].map((i) => ({
      ...note({ index: i, durationBeats: { num: 1, den: 8 } }),
      bar: 1,
    }));
    const one = scaleDurations(doc(plain), [1], { num: 2, den: 3 }).events;
    const g1 = drawnTupletAt(one, 0)!;
    check("a mark can cover a SINGLE note", `${g1.from}-${g1.to}`, "0-0");
    const grow = tupletEdgeTo(one, g1, "end", 2);
    check("...and its right handle can reach two notes on to close it", String(grow?.closes), "true");
    check("...taking both notes in", String(grow?.joining.join(",")), "1,2");
    check("...growing by only ONE is refused, because it would not close",
      String(tupletEdgeTo(one, g1, "end", 1)), "null");
  }

  // Growing a broken mark past three is refused whatever it would sum to — the digit is a "3".
  check("a broken mark cannot grow to four", String(tupletEdgeTo(evs, g, "end", 3)), "null");

  // The RETREAT: shrinking a broken mark is always allowed, even though it stays broken.
  {
    const shrink = tupletEdgeTo(evs, g, "end", 0);
    check("a broken mark can be shrunk toward nothing", shrink != null, true);
    check("...the second member leaves", String(shrink?.leaving.join(",")), "1");
    check("...and it is still broken afterwards", String(shrink?.closes), "false");
  }

  // A real triplet may NOT be shrunk into a broken one — that would spoil a correct mark.
  {
    const good = scaleDurations(doc(brokenBar()), [3], { num: 2, den: 3 }).events;
    const gg = closedTupletAt(good, 0)!;
    check("a real triplet cannot be shrunk", String(tupletEdgeTo(good, gg, "end", 1)), "null");
  }

  // The ✕: every member back to a plain value, whatever the mark's size.
  {
    const cleared = scaleDurations(doc(evs), [1, 2], { num: 3, den: 2 });
    check("clearing a broken mark restores plain values",
      cleared.events.slice(0, 2).map((e) => `${e.durationBeats.num}/${e.durationBeats.den}`).join(" "),
      "1/8 1/8");
    check("...and the mark is gone", String(tupletGroupsIn(cleared.events).length), "0");
  }
}

// ---------------------------------------------------------------------------------------------
// 6. Round-trip over every bundled score

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
