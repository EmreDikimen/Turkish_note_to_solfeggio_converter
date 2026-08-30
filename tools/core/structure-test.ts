/**
 * Written score → performance verification (Node-only) for `packages/core/src/structure.ts`.
 *
 * A folded score writes a repeated passage once and plays it twice, so two things have to hold or
 * the sheet and the sound come apart:
 *
 *  1. the PERFORMANCE is the written bars in `playBars` order — same notes, same durations, and
 *     the clock runs over all of them (`unfoldDoc` is a re-ordering, never a rewrite);
 *  2. every sounding event can be traced back to the ONE written note that is drawn for it
 *     (`srcOf`), and every written bar knows when it FIRST sounds (`firstStartMs`) — those two
 *     maps are what move the blue playhead and what "play from this bar" reads.
 *
 * The note-for-note equality against the old flattened stitcher output is checked in
 * `tools/render/stitch-test.ts`, on real token streams. This file checks the maps.
 *
 * Run: npx --yes tsx tools/core/structure-test.ts
 */

import { assignBars, groupMeasures, unfoldDoc, type NoteEvent, type NoteModelDocument } from "@turkish-omr/core";

let failures = 0;

function check(name: string, got: string, want: string) {
  if (got === want) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${want}\n    got : ${got}`);
  }
}

/** A score of `bars` one-note bars, note n of bar b named `b.n`, every note a quarter (500 ms). */
function score(bars: number, perBar = 2): NoteModelDocument {
  const events: NoteEvent[] = [];
  for (let b = 1; b <= bars; b++) {
    for (let n = 1; n <= perBar; n++) {
      events.push({
        index: events.length + 1,
        kind: "note",
        koma53: 40 + b,
        noteName: `${b}.${n}`,
        noteAE: `${b}.${n}`,
        durationMs: 500,
        durationBeats: { num: 1, den: perBar },
        freqHz: 440,
        lyric: "",
        offset: b - 1 + n / perBar,
      });
    }
  }
  return assignBars({
    schemaVersion: 1,
    name: "t",
    makam: "",
    form: "",
    usul: "",
    title: "t",
    composer: "",
    tuning: { system: "53tet", refFreqHz: 440, refKoma: 40, commasPerOctave: 53 },
    events,
  });
}

const names = (doc: NoteModelDocument) => doc.events.map((e) => e.noteName).join(" ");

console.log("unfold: playing order");
{
  const doc = score(3);
  // Bars 1–2 between `‖:` and `:‖`, then bar 3 — the plainest repeat there is.
  const played = unfoldDoc(doc, [1, 2, 1, 2, 3]);
  check("the repeated bars sound twice, in order", names(played.doc), "1.1 1.2 2.1 2.2 1.1 1.2 2.1 2.2 3.1 3.2");
  check("bars are renumbered along the performance", played.doc.events.map((e) => e.bar).join(""), "1122334455");
  check("the fold is reported as a fold", String(played.folded), "true");

  // srcOf is the link the playhead follows: the 5th sounding event is bar 1's first note again.
  check("second pass points back at the FIRST pass's notes", String(played.srcOf.get(5)), "1");
  check("…and the written note it names is the drawn one", doc.events[0]!.noteName, "1.1");
  const traced = played.doc.events.map((e) => doc.events.find((w) => w.index === played.srcOf.get(e.index))!.noteName);
  check("every sounding event traces back to a written note", traced.join(" "), names(played.doc));

  // firstStartMs is what "play from this bar" reads. Each bar is 1000 ms, so bar 1 sounds at 0 and
  // again at 2000; a click on it means the first one. Bar 3 plays fifth, at 4000 — which is exactly
  // what `Measure.startMs` (2000, its place on the PAGE) would have got wrong.
  check("bar start times are the FIRST time each bar sounds", [1, 2, 3].map((b) => played.firstStartMs.get(b)).join(" "), "0 1000 4000");
  check("the performance is longer than the page", String(played.doc.events.length), "10");
}

console.log("\nunfold: nothing to fold");
{
  const doc = score(3);
  const played = unfoldDoc(doc, null);
  check("no structure → the same music, in the same order", names(played.doc), names(doc));
  check("…and it says so", String(played.folded), "false");
  check("…with an identity trace", [...played.srcOf.entries()].every(([k, v]) => k === v) ? "identity" : "moved", "identity");
}

console.log("\nunfold: a structure that names a bar the decode dropped");
{
  // The signs come from a MODEL reading a photograph, so `playBars` can point at a bar that is not
  // there. Playing less music is the right answer; failing is not.
  const doc = score(2);
  const played = unfoldDoc(doc, [1, 9, 2]);
  check("the missing bar is skipped", names(played.doc), "1.1 1.2 2.1 2.2");
  check("…and the rest still lines up", groupMeasures(played.doc).length.toString(), "2");
}

console.log("\nunfold: the barline encoding survives");
{
  // `offset` is how `assignBars` re-derives barlines. Carrying the WRITTEN offsets over would put
  // every repeated bar back where it was first written and collapse the performance.
  const played = unfoldDoc(score(2), [1, 2, 1, 2]);
  const regrouped = assignBars({ ...played.doc, events: played.doc.events.map((e) => ({ ...e, bar: undefined })) });
  check("bars re-derive from offset alone", groupMeasures(regrouped).length.toString(), "4");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
