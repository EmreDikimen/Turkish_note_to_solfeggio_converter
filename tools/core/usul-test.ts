/**
 * Usul verification (Node-only) for `packages/core/src/usul.ts`. Three parts:
 *
 *  1. **The stroke tables** — every usul's `strokes` must sit inside its own cycle, ascend, and
 *     open on a düm. These are checks on DATA that a human drafted, so they catch the transcription
 *     slips (a stroke at `at: 9` in a 9/8, two strokes swapped) — they cannot catch a *musically*
 *     wrong pattern, and nothing here claims to. That is the owner's ear, docs/MANUAL_CHECKS.md.
 *  2. **`buildPercussionTrack`** — hits land on the bar, the partial-bar rule drops what runs over
 *     the barline, and a usul with no table produces silence rather than an invented rhythm.
 *  3. **Against `buildMetronomeTrack`** — both tracks are built from the same bars, so a stroke and
 *     a click that share a position in the cycle must land on the SAME millisecond. That is what
 *     stops the two builders drifting apart if one of them is ever rewritten.
 *  4. **Which DOCUMENT they are built over** — the performance (`unfoldDoc`), never the written
 *     page. Both builders walk bars, so a repeat left the usul stopping partway through the piece
 *     and never coming back (2026-09-05). That is an app-level wiring rule, pinned here because
 *     nothing in either builder can defend itself against being handed the wrong document.
 *
 * Run: npx --yes tsx tools/core/usul-test.ts
 */

import {
  buildMetronomeTrack,
  buildPercussionTrack,
  buildTimeline,
  findUsul,
  groupMeasures,
  unfoldDoc,
  USULS,
  type NoteEvent,
  type NoteModelDocument,
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

const TUNING = { system: "53tet", refFreqHz: 440, refKoma: 353, commasPerOctave: 53 };

/** A document of `bars` whole-note bars, each `perBar` events long. Content is irrelevant here —
 *  only the durations matter, because that is all `groupMeasures` and the two builders read. */
function doc(bars: number, perBar = 4, lastBarEvents = perBar): NoteModelDocument {
  const events: NoteEvent[] = [];
  let index = 0;
  for (let b = 0; b < bars; b++) {
    const n = b === bars - 1 ? lastBarEvents : perBar;
    for (let i = 0; i < n; i++) {
      events.push({
        index: index++, kind: "note", koma53: 318, noteName: "Do5", noteAE: "C5",
        durationMs: 1000 / perBar, durationBeats: { num: 1, den: perBar }, freqHz: 523.2,
        offset: 0, bar: b + 1,
      } as NoteEvent);
    }
  }
  return { schemaVersion: 1, name: "t", makam: "", usul: "", tuning: TUNING, events } as NoteModelDocument;
}

// ---------------------------------------------------------------------------------------------
console.log("the drafted stroke tables");

const withStrokes = USULS.filter((u) => u.strokes?.length);
check("every usul in the list has a drafted pattern", withStrokes.length, USULS.length);

for (const u of USULS) {
  const s = u.strokes ?? [];
  const inRange = s.every((x) => x.at >= 0 && x.at < u.num);
  const ascending = s.every((x, i) => i === 0 || x.at > s[i - 1]!.at);
  check(`${u.name}: every stroke is inside the ${u.num}/${u.den} cycle`, inRange, true);
  // buildPercussionTrack's partial-bar `break` assumes this ordering; out of order, it would stop
  // early on a short bar and drop strokes that should have sounded.
  check(`${u.name}: strokes ascend`, ascending, true);
  check(`${u.name}: the cycle opens on a düm`, s[0]?.at === 0 && s[0]?.stroke === "dum", true);
}

// ---------------------------------------------------------------------------------------------
console.log("\nbuildPercussionTrack");

const sofyan = findUsul("sofyan")!;
const d3 = doc(3);
const hits = buildPercussionTrack(d3, sofyan, 1000);

check("three full bars of a 3-stroke usul give 9 hits", hits.length, 9);
check("the strokes repeat every bar", hits.map((h) => h.stroke).join(","),
  "dum,tek,tek,dum,tek,tek,dum,tek,tek");
// Sofyan is düm(0) tek(2) tek(3) in quarters, so at wholeNoteMs = 1000 that is 0, 500, 750 ms.
check("hits land where the cycle says", hits.slice(0, 3).map((h) => h.ms), [0, 500, 750]);
check("bar 2 is one whole note later", hits[3]!.ms, 1000);

const bars = groupMeasures(d3);
check("every bar's downbeat is a düm on the bar's own startMs",
  bars.every((m) => hits.some((h) => Math.abs(h.ms - m.startMs) < 1e-6 && h.stroke === "dum")), true);

// A last bar of one quarter note is 0.25 whole notes long, so only the düm at offset 0 fits;
// tek at 2/4 = 0.5 and tek at 3/4 = 0.75 both run past the barline and must be dropped.
const shortTail = buildPercussionTrack(doc(3, 4, 1), sofyan, 1000);
check("a short final bar drops the strokes that run past it", shortTail.length, 7);
check("...and what survives there is the düm", shortTail[6]!.stroke, "dum");

check("a usul with no drafted pattern is silent, not invented",
  buildPercussionTrack(d3, { ...sofyan, strokes: undefined }, 1000).length, 0);

// ---------------------------------------------------------------------------------------------
console.log("\nagainst the metronome track");

// Both builders walk the same bars off the same whole-note length, so wherever a stroke and a
// click name the same position in the cycle they must agree to the millisecond. Sofyan's beat
// groups are [2,2] → clicks at 0 and 2 quarters; its strokes are at 0, 2 and 3.
const clicks = buildMetronomeTrack(d3, sofyan, 1000);
const shared = clicks.filter((c) => hits.some((h) => Math.abs(h.ms - c.ms) < 1e-6));
check("the beats that carry a stroke line up exactly", shared.length, clicks.length);
check("...and there are strokes off the beat too, or this would prove nothing",
  hits.length > clicks.length, true);

// The accented click and the düm are the same event seen twice — the downbeat.
check("every accented click is a düm",
  clicks.filter((c) => c.accent).every((c) =>
    hits.some((h) => Math.abs(h.ms - c.ms) < 1e-6 && h.stroke === "dum")), true);

// ---------------------------------------------------------------------------------------------
console.log("\nthe tracks cover the PERFORMANCE — the 2026-09-05 bug");
{
  // ⛔ The app built both tracks from the WRITTEN document while the timeline came from
  // `unfoldDoc`. A repeat makes the performance longer than the page, and both builders walk BARS
  // — so the strokes ran out at the written total and the rest of the piece played with no usul.
  // Nothing threw: the tail is simply silent, which is why only the owner's ear caught it
  // ("usul vuruşu bazen kesiliyor ve geri gelmiyor"). The same shape as the makam-delta bug of the
  // same day, from the same cause — the unfold moved the clock and these two were left behind.
  const written = doc(4);
  const played = unfoldDoc(written, [1, 2, 1, 2, 3, 4]); // ‖: bars 1–2 :‖
  const totalMs = buildTimeline(played.doc).totalMs;
  check("the repeat makes the performance longer than the page", totalMs > 4000, true);

  const fromWritten = buildPercussionTrack(written, sofyan, 1000);
  const fromPerf = buildPercussionTrack(played.doc, sofyan, 1000);

  // A stroke track "covers" the piece when its last düm is inside the final bar.
  const lastDum = (t: { ms: number; stroke: string }[]) =>
    t.filter((h) => h.stroke === "dum").at(-1)!.ms;
  check("⛔ built from the WRITTEN score the usul stops early", lastDum(fromWritten), 3000);
  check("…leaving the last bars of the playback silent", totalMs - lastDum(fromWritten), 3000);
  check("⭐ built from the PERFORMANCE it plays to the end", lastDum(fromPerf), totalMs - 1000);
  check("…one cycle per SOUNDING bar", fromPerf.length, sofyan.strokes!.length * 6);

  // The metronome is built the same way off the same bars, so it carries the identical bug.
  check("⭐ the metronome covers the performance too",
    buildMetronomeTrack(played.doc, sofyan, 1000).filter((c) => c.accent).length, 6);

  // ⚠ An unfolded page must be untouched by the change: `unfoldDoc` over the identity order is a
  // re-ordering that re-orders nothing, and `groupMeasures` skips `meta` on both sides — so a page
  // that plays as it is written gets byte-identical tracks either way.
  const flat = unfoldDoc(written, null);
  check("a page with no repeat is unchanged by going through the unfold",
    JSON.stringify(buildPercussionTrack(flat.doc, sofyan, 1000)),
    JSON.stringify(buildPercussionTrack(written, sofyan, 1000)));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
