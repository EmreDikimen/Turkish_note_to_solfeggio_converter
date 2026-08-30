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
 *  - a long NOTE now behaves the same way: `\tie` is retired (owner, 2026-08-22), so a 5/8 is
 *    written as two plain notes and stitches back as two events. The ORIGINAL side is expanded
 *    by `tieSplitBeats` to match — pitches and the summed duration are what must survive, and
 *    they do. (The stitcher still MERGES a `\tie` it is given; see the legacy unit tests.);
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
  MAKAM_SIGNATURES,
  parseNoteName,
  signatureKey,
  unfoldDoc,
  toAeuAlter,
  type NoteModelDocument,
} from "@turkish-omr/core";
import {
  docToStrips,
  lilyDuration,
  parseSignatureBody,
  serializeMeasures,
  serializeSignature,
} from "./lilypond";
import { tupletGroupsIn, tieSplitBeats } from "./rhythm";
import { repeatMarksAt } from "./repeats";
import { stitchTokenRows } from "./stitch";
import { repeatSpansFromStructure } from "./structure-view";

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
  // ⚠ LEGACY LABELS: nothing emits `\tie` since 2026-08-22, but old pools, the frozen exam v2
  // gold and `round2-stage2-best`'s own decodes still contain it, so the stitcher must keep
  // merging it. These two checks guard that tolerance, not the serializer.
  check("legacy `\\tie` still merges into one event", t(["c''2 \\tie c''8"]), "Do5:5/8");
  check(
    "retired form: the same pair without the token is two plain notes",
    t(["c''2 c''8"]),
    "Do5:1/2 Do5:1/8",
  );
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

  // --- the WRITTEN score + its structure (what the app draws and plays) -----------------------
  //
  // With `expand: false` the doc is the page as printed and the repeat lives in `structure`: which
  // bars carry which signs, and the order those signs make the bars sound in.
  const marksOf = (rows: string[]): string => {
    const { bars } = stitchTokenRows(rows, { expand: false }).structure;
    return bars
      .map((b) =>
        `${b.bar}:` +
        Object.entries(b)
          .filter(([k]) => k !== "bar")
          .map(([k, v]) => (v === true ? k : `${k}=${v}`))
          .join(","),
      )
      .join(" ");
  };
  const playOf = (rows: string[]): string =>
    stitchTokenRows(rows, { expand: false }).structure.playBars.join("-");

  check(
    "structure: the repeat signs land on the bars that carry them",
    marksOf(["\\repstart c''4 | d''4 \\repend e''4"]),
    "1:repStart 2:repEnd",
  );
  check(
    "structure: a repeat's playing order names the same bars twice",
    playOf(["\\repstart c''4 | d''4 \\repend e''4"]),
    "1-2-1-2-3",
  );
  check(
    "structure: voltas mark their own bars, pass 2 skips the 1. ending",
    marksOf(["\\repstart c''4 | \\volta1 d''4 \\repend \\volta2 e''4 | f''4"]) +
      " → " +
      playOf(["\\repstart c''4 | \\volta1 d''4 \\repend \\volta2 e''4 | f''4"]),
    "1:repStart 2:volta1,repEnd 3:volta2 → 1-2-1-3-4",
  );
  check(
    "structure: D.C. al Fine replays from the top and stops at Son",
    marksOf(["c''4 \\fine | d''4 \\dc"]) + " → " + playOf(["c''4 \\fine | d''4 \\dc"]),
    "1:fine 2:dc → 1-2-1",
  );
  check(
    "structure: the ⊕ pair is ordered (0 = jump from, 1 = jump to)",
    marksOf(["c''4 \\coda | d''4 | \\coda e''4 | f''4 \\dc"]),
    "1:codaOrder=0 3:codaOrder=1 4:dc",
  );
  check(
    "structure: a segno is where the D.S. pass restarts",
    playOf(["c''4 | \\segno d''4 | e''4 \\dc"]),
    "1-2-3-2-3",
  );

  // --- the first ending is a RUN (owner, 2026-08-30) ------------------------------------------
  //
  // "2. dönüşte ilk volta çalmamalı, direkt 2. voltaya geçmeli." A "1." bracket that opens BEFORE
  // the `:‖` covers every bar up to it, and the second pass skips them all. Until 2026-08-30 only
  // the bar carrying the mark was skipped, so a two-bar first ending played its tail twice — the
  // shape of 37.9% of real first endings.
  const twoBar = ["\\repstart c''4 | \\volta1 d''4 | e''4 \\repend \\volta2 f''4 | g''4"];
  check(
    "a TWO-bar first ending is skipped whole on the second pass",
    playOf(twoBar),
    "1-2-3-1-4-5",
  );
  check(
    "…and that is what sounds: pass 2 goes c → f, never through d or e again",
    t(twoBar),
    "Do5:1/4 | Re5:1/4 | Mi5:1/4 | Do5:1/4 | Fa5:1/4 | Sol5:1/4",
  );
  check(
    "…the ending is reported as the bars it covers",
    stitchTokenRows(twoBar, { expand: false }).structure.firstEndings.map((e) => `${e.from}-${e.to}`).join(" "),
    "2-3",
  );
  check(
    "the one-bar case still reports itself, and still skips one bar",
    stitchTokenRows(["\\repstart c''4 | \\volta1 d''4 \\repend \\volta2 e''4"], { expand: false })
      .structure.firstEndings.map((e) => `${e.from}-${e.to}`).join(" "),
    "2-2",
  );
  {
    // ⚠ A "1." far from its `:‖` is a stray token, not a long first ending. Obeying it would DELETE
    // real music from the second pass; ignoring it only replays what was going to be played anyway.
    const far = ["\\repstart \\volta1 c''4 | d''4 | e''4 | f''4 | g''4 \\repend a''4"];
    const res = stitchTokenRows(far, { expand: false });
    check("a \\volta1 too far from its :‖ is ignored", res.structure.firstEndings.length.toString(), "0");
    check("…the whole span repeats instead", res.structure.playBars.join("-"), "1-2-3-4-5-1-2-3-4-5-6");
    check("…and it says so", String(res.warnings.some((w) => w.includes("too long for a first ending"))), "true");
  }

  // The DRAWN bracket must sit on the bar the skip starts at, or the sheet and the sound disagree
  // about where the first ending begins. `repeatSpansFromStructure` + `repeatMarksAt` are what the
  // app and the strip labels both go through.
  {
    const st = stitchTokenRows(twoBar, { expand: false });
    const spans = repeatSpansFromStructure(st.structure, groupMeasures(st.doc).length);
    const drawn = [1, 2, 3, 4, 5]
      .map((bar) => {
        const m = repeatMarksAt(bar, spans);
        const ink = [m.repStart && "‖:", m.volta1 && "1.", m.volta2 && "2.", m.repEnd && ":‖"].filter(Boolean);
        return ink.length ? `${bar}:${ink.join("+")}` : "";
      })
      .filter(Boolean)
      .join(" ");
    check("the 1. is drawn where the ending STARTS, not on the :‖ bar", drawn, "1:‖: 2:1. 3::‖ 4:2.");
  }

  // ⭐ THE SAFETY CLAIM OF THE WHOLE FOLD: unfolding the written score along `playBars` gives back
  // exactly what the old flattening produced. Same notes, same order, same durations — so keeping
  // the signs on the page cannot change a single sound. Checked on every structural case above.
  console.log("  -- written + playBars == the old flattened doc:");
  for (const rows of [
    ["\\repstart c''4 | d''4 \\repend e''4"],
    ["\\repstart c''4 | \\volta1 d''4 \\repend \\volta2 e''4 | f''4"],
    ["\\repstart c''4 | \\volta1 d''4 | e''4 \\repend \\volta2 f''4 | g''4"],
    ["c''4 | d''4 \\repend e''4"],
    ["c''4 \\fine | d''4 \\dc"],
    ["c''4 \\coda | d''4 | \\coda e''4 | f''4 \\dc"],
    ["c''4 | \\segno d''4 | e''4 \\dc"],
    ["\\grace d''8 c''4 \\repend e''4"],
    ["\\tup3 c''8 d''8 e''8 \\tupend \\repend f''4"],
  ]) {
    const written = stitchTokenRows(rows, { expand: false });
    const unfolded = unfoldDoc(written.doc, written.structure.playBars).doc;
    check(rows.join(" ⏎ "), compact(unfolded), compact(stitchTokenRows(rows).doc));
  }
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
    "legacy carry through a `\\tie`: the pair is one event; a later bare note keeps the alteration",
    c(["\\bakiyeSharp f''2 \\tie f''8 f''8"]),
    "Fa5#4:5/8 Fa5#4:1/8",
  );
  check(
    // THE safety claim of the tie retirement: the tail is spelled BARE, so its pitch comes from
    // the measure-scoped carry. Same three sounding pitches as the legacy row above.
    "retired form: a bare tie-tail keeps the alteration through the carry",
    c(["\\bakiyeSharp f''2 f''8 f''8"]),
    "Fa5#4:1/2 Fa5#4:1/8 Fa5#4:1/8",
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
      const split = e.kind === "note" || e.kind === "rest" ? tieSplitBeats(e) : null;
      if (e.kind === "note" || e.kind === "rest") {
        const inGroup = groups.some((g) => i >= g.from && i <= g.to);
        // Outside a closed tuplet group and not tie-split, the label carries whatever
        // `lilyDuration` wrote — exact for drawable values, nearest-snapped otherwise.
        if (!inGroup && split === null) beats = snapToWritten(beats);
      }
      // Compare the WRITTEN pitch: the page draws the AEU-snapped sign (a 2-comma flat is
      // engraved as a koma flat), and recovering that written form is stage 8's contract —
      // the exact sounding koma is Phase 4's makam layer, not the stitcher's.
      let koma = -1;
      if (e.kind !== "rest") {
        const p = parseNoteName(e.noteName);
        koma = p ? komaOf(p.letter, p.octave, toAeuAlter(p.alterCommas)) : e.koma53;
      }
      // A tie-split long value is WRITTEN as separate notes and, since `\tie` retired, joined by
      // nothing — so the stitched side returns one event per written part. Expand to match.
      if (split) for (const part of split) out.push({ kind: e.kind, koma, beats: part, bar: m.index });
      else out.push({ kind: e.kind, koma, beats, bar: m.index });
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

// Makam-detection signature vocabulary. `packages/core/src/makam.ts` spells signatures with its
// own `SIG_TOKEN_BY_ALTER` rather than importing `AEU_TOKEN` from here (core must not depend on
// tools/, and the label path is load-bearing enough not to move). That is a deliberate second
// copy, so pin it: every signature in the generated table must survive this file's parser and
// come back byte-identical through core's formatter. If the two vocabularies ever drift, makam
// detection would silently stop matching anything — this fails instead.
console.log("\nmakam signature vocabulary (core vs the label serializer):");
let sPass = 0;
let sFail = 0;
for (const [slug, entry] of Object.entries(MAKAM_SIGNATURES)) {
  for (const v of entry.variants) {
    let back = "";
    try {
      back = signatureKey(parseSignatureBody(v.sig));
    } catch (err) {
      back = `THREW: ${String(err)}`;
    }
    if (back === v.sig) {
      sPass++;
    } else {
      sFail++;
      failures++;
      console.log(`  FAIL ${slug}: "${v.sig}" -> "${back}"`);
    }
  }
}
console.log(`  ${sPass}/${sPass + sFail} signature variants round-trip exactly`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
