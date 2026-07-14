/**
 * Stage-8 stitcher verification (Node-only). Two parts:
 *
 *  1. **Structure unit tests** — hand-built token streams covering `\sig` resolution, ties,
 *     triplets, graces, repeats, voltas, and da-capo/fine/coda expansion, each checked against
 *     its expected flattened note sequence.
 *  2. **Round-trip over every bundled score** — serialize each score with the SAME serializer
 *     that makes the training labels (`docToStrips`), stitch the labels back, and compare the
 *     resulting events with the original (kind + koma + exact duration, bar by bar).
 *
 * Known, accepted round-trip diffs (the serializer is deliberately lossy there):
 *  - a long REST splits into side-by-side rests with no tie (rests are never tied), so both
 *    sides are normalized by merging consecutive in-bar rests before comparing;
 *  - a measure-final dangling grace is dropped by the serializer (VexFlow can't draw a grace
 *    without a host), so it is dropped from the original too;
 *  - a tuplet run that never sums to a plain value keeps the legacy nearest-value duration
 *    snap — those events compare by written (snapped) duration instead of the exact original.
 *
 * Run: npx --yes tsx tools/render/stitch-test.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  assignBars,
  deriveKeySignature,
  eventBeats,
  groupMeasures,
  komaOf,
  parseNoteName,
  toAeuAlter,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { docToStrips, lilyDuration, serializeMeasures, serializeSignature } from "./lilypond";
import { tupletGroupsIn, tieSplitBeats } from "./rhythm";
import { stitchTokenRows } from "./stitch";

let failures = 0;

function check(name: string, got: string, want: string) {
  if (got === want) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${want}\n    got : ${got}`);
  }
}

// ---------------------------------------------------------------------------------------------
// 1. Structure unit tests

/** Compact form of a stitched doc: bar-grouped `name:num/den` (rests `r`, graces `g:name`). */
function compact(doc: NoteModelDocument): string {
  const bars = new Map<number, string[]>();
  for (const e of doc.events) {
    const label =
      e.kind === "rest" ? `r:${e.durationBeats.num}/${e.durationBeats.den}`
      : e.kind === "grace" ? `g:${e.noteName}`
      : `${e.noteName}:${e.durationBeats.num}/${e.durationBeats.den}`;
    const bar = bars.get(e.bar ?? 0) ?? [];
    bar.push(label);
    bars.set(e.bar ?? 0, bar);
  }
  return [...bars.keys()].sort((a, b) => a - b).map((b) => bars.get(b)!.join(" ")).join(" | ");
}

console.log("structure unit tests:");
{
  const t = (rows: string[], opts = {}) => compact(stitchTokenRows(rows, opts).doc);

  check(
    "signature resolution + overrides",
    t(["\\sig \\komaFlat b \\sigend b'4 \\natural b'4 \\bakiyeSharp f''4 f''4"]),
    "Si4b1:1/4 Si4:1/4 Fa5#4:1/4 Fa5:1/4",
  );
  check(
    "signature persists to a sig-less row; empty \\sig keeps it",
    t(["\\sig \\komaFlat b \\sigend b'4", "b'4", "\\sig \\sigend b'4"]),
    "Si4b1:1/4 | Si4b1:1/4 | Si4b1:1/4",
  );
  check("tie merges into one event", t(["c''2 \\tie c''8"]), "Do5:5/8");
  check(
    "triplet members sound at written × 2/3",
    t(["\\tup3 c''8 d''8 e''8 \\tupend f''4"]),
    "Do5:1/12 Re5:1/12 Mi5:1/12 Fa5:1/4",
  );
  check("grace attaches with zero duration", t(["\\grace d''8 c''4"]), "g:Re5 Do5:1/4");
  check(
    "plain repeat plays twice",
    t(["\\repstart c''4 | d''4 \\repend e''4"]),
    "Do5:1/4 | Re5:1/4 | Do5:1/4 | Re5:1/4 | Mi5:1/4",
  );
  check(
    "volta: pass 2 skips the 1. ending, 2. follows",
    t(["\\repstart c''4 | \\volta1 d''4 \\repend \\volta2 e''4 | f''4"]),
    "Do5:1/4 | Re5:1/4 | Do5:1/4 | Mi5:1/4 | Fa5:1/4",
  );
  check(
    "unmatched \\repend repeats from the top",
    t(["c''4 | d''4 \\repend e''4"]),
    "Do5:1/4 | Re5:1/4 | Do5:1/4 | Re5:1/4 | Mi5:1/4",
  );
  check(
    "D.C. al Fine",
    t(["c''4 \\fine | d''4 \\dc"]),
    "Do5:1/4 | Re5:1/4 | Do5:1/4",
  );
  check(
    "D.C. with coda jump",
    t(["c''4 \\coda | d''4 | \\coda e''4 | f''4 \\dc"]),
    "Do5:1/4 | Re5:1/4 | Mi5:1/4 | Fa5:1/4 | Do5:1/4 | Mi5:1/4 | Fa5:1/4",
  );
  check(
    "expand: false keeps the written form",
    t(["\\repstart c''4 | d''4 \\repend e''4"], { expand: false }),
    "Do5:1/4 | Re5:1/4 | Mi5:1/4",
  );
  check(
    "hallucinated mid-piece D.C. is ignored (real pages produced one)",
    t(["c''4 \\dc | d''4 | e''4 | f''4"]),
    "Do5:1/4 | Re5:1/4 | Mi5:1/4 | Fa5:1/4",
  );
  check(
    "raw-decode split duration re-glues (`f'' 32` → f''32)",
    t(["g''16. f'' 32 e''4"]),
    "Sol5:3/32 Fa5:1/32 Mi5:1/4",
  );

  // --- accidentals: "carry" (real printed pages — measure-scoped carry rule) -------------------
  const c = (rows: string[], opts = {}) =>
    compact(stitchTokenRows(rows, { accidentals: "carry", ...opts }).doc);

  check(
    "carry: accidental binds its position to the barline, then the signature returns",
    c(["\\sig \\komaFlat b \\sigend \\bakiyeSharp f''4 f''4 | f''4"]),
    "Fa5#4:1/4 Fa5#4:1/4 | Fa5:1/4",
  );
  check(
    "carry: \\natural cancel also carries (keysig mode would re-flatten the third note)",
    c(["\\sig \\komaFlat b \\sigend b'4 \\natural b'4 b'4"]),
    "Si4b1:1/4 Si4:1/4 Si4:1/4",
  );
  check(
    "carry is per staff position: a different octave is NOT carried",
    c(["\\bakiyeSharp f''4 f'4"]),
    "Fa5#4:1/4 Fa4:1/4",
  );
  check(
    "carry: repeat barline resets like a plain barline",
    c(["\\bakiyeSharp f''4 \\repend f''4"], { expand: false }),
    "Fa5#4:1/4 | Fa5:1/4",
  );
  check(
    "carry: a grace's accidental never binds the measure",
    c(["\\grace \\bakiyeSharp f''8 c''4 f''4"]),
    "g:Fa5#4 Do5:1/4 Fa5:1/4",
  );
  check(
    "carry through a tie: the pair is one event; a later bare note keeps the alteration",
    c(["\\bakiyeSharp f''2 \\tie f''8 f''8"]),
    "Fa5#4:5/8 Fa5#4:1/8",
  );
  check(
    "default (keysig) mode is unchanged: bare always means the signature pitch",
    t(["\\sig \\komaFlat b \\sigend b'4 \\natural b'4 b'4"]),
    "Si4b1:1/4 Si4:1/4 Si4b1:1/4",
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Round-trip over the bundled scores

/** Normalized comparable event. */
interface Norm {
  kind: string;
  koma: number;
  beats: number; // float is fine for COMPARING — both sides derive from the same exact fractions
  bar: number;
}

/** Original doc → normalized sounding events, mirroring the serializer's documented losses. */
function normalizeOriginal(doc: NoteModelDocument): Norm[] {
  const out: Norm[] = [];
  for (const m of groupMeasures(doc)) {
    const groups = tupletGroupsIn(m.events);
    const events = m.events.filter(
      (e, i) =>
        // Serializer drops a measure-final dangling grace (no host to attach to).
        !(e.kind === "grace" && i === m.events.length - 1),
    );
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      let beats = eventBeats(e);
      if (e.kind === "note" || e.kind === "rest") {
        const inGroup = groups.some((g) => i >= g.from && i <= g.to);
        // Outside a closed tuplet group and not tie-split, the label carries whatever
        // `lilyDuration` wrote — exact for drawable values, nearest-snapped otherwise.
        if (!inGroup && tieSplitBeats(e) === null) beats = snapToWritten(beats);
      }
      // Compare the WRITTEN pitch: the page draws the AEU-snapped sign (a 2-comma flat is
      // engraved as a koma flat), and recovering that written form is stage 8's contract —
      // the exact sounding koma is Phase 4's makam layer, not the stitcher's.
      let koma = -1;
      if (e.kind !== "rest") {
        const p = parseNoteName(e.noteName);
        koma = p ? komaOf(p.letter, p.octave, toAeuAlter(p.alterCommas)) : e.koma53;
      }
      out.push({ kind: e.kind, koma, beats, bar: m.index });
    }
  }
  return mergeRests(out);
}

/** Does this event's duration spell exactly (drawable or handled by tuplet/tie machinery)? */
function isExactlyWritable(e: { durationBeats: { num: number; den: number } }): boolean {
  const { num, den } = e.durationBeats;
  if (den === 0 || num === 0) return true;
  const g = ((a: number, b: number) => {
    while (b) [a, b] = [b, a % b];
    return a;
  })(num, den);
  const d = den / g;
  return d % 3 !== 0; // reduced denominator divisible by 3 = tuplet fraction
}

/** What `lilyDuration` writes for this value, read back as beats (the snap the label carries). */
function snapToWritten(beats: number): number {
  const code = lilyDuration(beats);
  const den = parseInt(code, 10);
  const dots = (code.match(/\.+$/)?.[0] ?? "").length;
  return dots === 2 ? 7 / (den * 4) : dots === 1 ? 3 / (den * 2) : 1 / den;
}

/** Stitched doc → normalized events. */
function normalizeStitched(doc: NoteModelDocument): Norm[] {
  const out: Norm[] = doc.events.map((e) => ({
    kind: e.kind,
    koma: e.kind === "rest" ? -1 : e.koma53,
    beats: eventBeats(e),
    bar: e.bar ?? 0,
  }));
  return mergeRests(out);
}

/** Merge consecutive rests within a bar (the serializer splits long rests with no tie). */
function mergeRests(events: Norm[]): Norm[] {
  const out: Norm[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (last && last.kind === "rest" && e.kind === "rest" && last.bar === e.bar) last.beats += e.beats;
    else out.push({ ...e });
  }
  return out;
}

function fmtNorm(n: Norm): string {
  return `${n.kind}@${n.koma}:${n.beats.toFixed(5)}`;
}

console.log("\nround-trip over bundled scores:");
const pub = "apps/web/public";
const files = [
  ...["sample.json", "gamzedeyim-deva.json", "beyati-delisin.json", "safalar-getirdiniz.json"].map(
    (f) => join(pub, f),
  ),
  ...readdirSync(join(pub, "scores")).filter((f) => f.endsWith(".json")).map((f) => join(pub, "scores", f)),
];

/** Compare two normalized event lists; -1 = identical, else the first differing index. */
function firstDiffAt(a: Norm[], b: Norm[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y || x.kind !== y.kind || x.koma !== y.koma || Math.abs(x.beats - y.beats) > 1e-6) {
      return i;
    }
  }
  return -1;
}

function reportDiff(name: string, a: Norm[], b: Norm[], at: number, warnings: string[]): void {
  const x = a[at];
  const y = b[at];
  console.log(
    `  FAIL  ${name}: first diff at event ${at} (bar ${x?.bar ?? "?"}) — ` +
      `original ${x ? fmtNorm(x) : "<none>"} vs stitched ${y ? fmtNorm(y) : "<none>"}` +
      (warnings.length ? `  [warnings: ${warnings.slice(0, 3).join("; ")}]` : ""),
  );
}

let rtPass = 0;
let rtFail = 0;
for (const file of files) {
  const doc = assignBars(JSON.parse(readFileSync(file, "utf8")) as NoteModelDocument);
  const strips = docToStrips(doc);
  // Rebuild the page stream the way a slicer would see it: strips are consecutive crops, so the
  // boundary is a barline — unless the SAME measure continues (a dense measure spilled).
  const parts: string[] = [];
  strips.forEach((s, i) => {
    if (i > 0) parts.push(strips[i - 1]!.toMeasure === s.fromMeasure ? " " : " | ");
    parts.push(s.label);
  });
  const { doc: stitched, warnings } = stitchTokenRows([parts.join("")]);

  const a = normalizeOriginal(doc);
  const b = normalizeStitched(stitched);
  const at = firstDiffAt(a, b);
  if (at < 0) {
    rtPass++;
  } else {
    rtFail++;
    failures++;
    reportDiff(file.split("/").pop()!, a, b, at, warnings);
  }
}
console.log(`  ${rtPass}/${rtPass + rtFail} scores round-trip exactly`);

// Carry-mode round-trip: serialize every score in "measure" (carry) mode — signature prefix +
// carry-suppressed accidentals — and stitch it back with carry resolution. Identity on the
// written notes proves the serializer's carry decision and the parser's carry resolution are
// exact inverses over the whole repertoire (tuplets, ties, graces included).
console.log("\ncarry-mode round-trip over bundled scores:");
let cPass = 0;
let cFail = 0;
for (const file of files) {
  const doc = assignBars(JSON.parse(readFileSync(file, "utf8")) as NoteModelDocument);
  const measures = groupMeasures(doc);
  const sigEntries = deriveKeySignature(doc);
  const sigMap = new Map(sigEntries.map((e) => [e.letter, e.alterCommas]));
  const body = serializeMeasures(measures, sigMap, undefined, undefined, /* carry */ true);
  const label =
    sigEntries.length > 0 ? `${serializeSignature(sigEntries).label} ${body.label}` : body.label;
  const { doc: stitched, warnings } = stitchTokenRows([label], { accidentals: "carry" });

  const a = normalizeOriginal(doc);
  const b = normalizeStitched(stitched);
  const at = firstDiffAt(a, b);
  if (at < 0) {
    cPass++;
  } else {
    cFail++;
    failures++;
    reportDiff(file.split("/").pop()!, a, b, at, warnings);
  }
}
console.log(`  ${cPass}/${cPass + cFail} scores round-trip exactly (carry mode)`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
