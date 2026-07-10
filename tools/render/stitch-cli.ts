/**
 * CLI for the stage-8 stitcher (Node-only): a page's decoded strip tokens → note-model JSON.
 *
 * Input is what `src/vision/decode_page.py` writes (`<page>_decode.json`); output is a
 * schemaVersion-1 `NoteModelDocument` the web harness loads directly — via its "load JSON"
 * file picker, or by writing into `apps/web/public/` and opening `/?score=/decoded.json`.
 * This is the Rung-4 "editor feed-in": the decoded page lands in the editor, corrections
 * there become Rung-3 training labels.
 *
 * Run:  npx --yes tsx tools/render/stitch-cli.ts data/real/strips/<page>/<page>_decode.json \
 *           [-o apps/web/public/decoded.json] [--no-expand]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { stitchStrips, type DecodedStrip } from "./stitch";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("-"));
const outIdx = args.indexOf("-o");
const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
const expand = !args.includes("--no-expand");

if (!input) {
  console.error("usage: stitch-cli.ts <page_decode.json> [-o out.json] [--no-expand]");
  process.exit(2);
}

const parsed = JSON.parse(readFileSync(input, "utf8")) as {
  page?: string;
  strips: DecodedStrip[];
};
const name = basename(parsed.page ?? input).replace(/\.[^.]+$/, "");
const { doc, warnings, writtenMeasures, playedMeasures } = stitchStrips(parsed.strips, {
  name,
  expand,
});

const notes = doc.events.filter((e) => e.kind === "note").length;
const rests = doc.events.filter((e) => e.kind === "rest").length;
const graces = doc.events.filter((e) => e.kind === "grace").length;
console.log(`stitched ${parsed.strips.length} strips -> ${writtenMeasures} written measures` +
  (playedMeasures !== writtenMeasures ? ` (${playedMeasures} after repeat/da-capo expansion)` : "") +
  `, ${notes} notes / ${rests} rests / ${graces} graces`);

for (const w of warnings) console.log(`  warn: ${w}`);

// Readable per-bar dump, for eyeballing against the printed page.
let bar = 0;
const line: string[] = [];
for (const e of doc.events) {
  if (e.bar !== bar) {
    if (line.length) console.log(`  m${String(bar).padStart(3)}: ${line.join("  ")}`);
    line.length = 0;
    bar = e.bar!;
  }
  const dur = `${e.durationBeats.num}/${e.durationBeats.den}`;
  line.push(e.kind === "rest" ? `rest(${dur})` : e.kind === "grace" ? `g»${e.noteName}` : `${e.noteName}(${dur})`);
}
if (line.length) console.log(`  m${String(bar).padStart(3)}: ${line.join("  ")}`);

if (out) {
  writeFileSync(out, JSON.stringify(doc, null, 1));
  console.log(`\nwrote ${out} — load it in the harness (file picker, or /?score=/${basename(out)})`);
}
