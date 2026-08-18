/**
 * Pixels-vs-labels verifier for the LILYPOND arm — the gate a second engraver has to pass before
 * anything it produced may be trained on.
 *
 * WHY: the same reason `verify-labels.ts` exists. On 2026-07-26 the VexFlow renderer and the label
 * serializer were found to disagree on 18.8% of one pool's signature-bearing strips, and nothing
 * caught it because nothing had ever compared what is DRAWN with what is LABELLED. A new engraver
 * re-opens exactly that risk: LilyPond decides for itself where accidentals belong, and
 * `ly-engrave.ts` exists to overrule it. This file is the check that the overruling worked.
 *
 * WHAT IT DOES: re-engraves every strip in the pool straight from its manifest label (the render is
 * deterministic — same label, same LilyPond source, same page), reads the accidental glyphs out of
 * the resulting SVG **by font outline**, and compares that sequence — in reading order, signature
 * block included — against the accidental tokens in the label. It then checks the PNG on disk has
 * the corpus geometry (336 px tall) and the width the crop should have produced.
 *
 * Glyph identity does not come from the code under test: `calibrate()` re-derives the outline table
 * by rendering the nine signs afresh (ly-svg.ts), so a font or version change re-derives rather than
 * silently mismatching.
 *
 * Run: npx --yes tsx tools/render/verify-labels-ly.ts --strips data/synthetic/_pilot_ly
 *          [--limit 50] [--out report.json] [--lilypond /opt/homebrew/bin/lilypond]
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lilyDocument, parseLabel, stripToScore } from "./ly-engrave";
import { accidentalsInSvg, calibrate, parseLySvg } from "./ly-svg";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const STRIPS = arg("strips") ?? "data/synthetic/_pilot_ly";
const LILYPOND = arg("lilypond") ?? "/opt/homebrew/bin/lilypond";
const LIMIT = arg("limit") != null ? Number(arg("limit")) : Infinity;
const OUT = arg("out") ?? `${STRIPS}/verify_labels_ly.json`;
const EXPECTED_HEIGHT = 336; // the corpus's strip height in pixels (measured on strips_v4)

interface Row { image: string; label: string; piece: string; from: number; to: number; meter: string | null }
interface Failure { image: string; reason: string }

/** PNG width/height straight from the IHDR chunk — no image library, and it cannot be fooled by a
 *  file that merely exists. */
function pngSize(path: string): { w: number; h: number } {
  const buf = readFileSync(path);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function main(): void {
  const rows = readFileSync(join(STRIPS, "manifest.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row)
    .slice(0, LIMIT);

  const work = join(STRIPS, "_verify");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const table = calibrate(LILYPOND, work);

  // One LilyPond run for the whole pool: every strip is its own page, in manifest order.
  // The meter rides in the manifest because LilyPond BEAMS by it: replaying a strip at the wrong
  // one re-engraves it at a different width, which this file would then report as a geometry fault.
  const scores = rows.map((r) => {
    const parsed = parseLabel(r.label);
    const m = r.meter ? /^(\d+)\/(\d+)$/.exec(r.meter) : null;
    return stripToScore(parsed, {
      drawClef: parsed.sig !== null && parsed.sig.length > 0,
      meter: m ? { num: Number(m[1]), den: Number(m[2]) } : null,
    });
  });
  const src = join(work, "all.ly");
  writeFileSync(src, lilyDocument(scores));
  const run = spawnSync(LILYPOND, ["-dbackend=svg", "-dno-point-and-click", "-o", join(work, "v"), src], {
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(`LilyPond exited ${run.status}\n${run.stderr}`);
  const complaints = (run.stderr ?? "").split("\n").filter((l) => /barcheck failed|error:|programming error/i.test(l));

  const pages = readdirSync(work)
    .filter((f) => /^v-\d+\.svg$/.test(f))
    .sort((a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]));
  if (pages.length !== rows.length) throw new Error(`${rows.length} strips but ${pages.length} pages`);

  const failures: Failure[] = [];
  let accidentalsChecked = 0;

  rows.forEach((row, i) => {
    const svg = parseLySvg(readFileSync(join(work, pages[i]!), "utf8"));
    const drawn = accidentalsInSvg(svg, table).map((a) => a.token);
    const wanted = parseLabel(row.label).accidentals;
    accidentalsChecked += wanted.length;
    if (drawn.length !== wanted.length || drawn.some((t, k) => t !== wanted[k])) {
      failures.push({ image: row.image, reason: `drew [${drawn.join(" ")}], label says [${wanted.join(" ")}]` });
      return;
    }
    // Geometry: the PNG must be the corpus's strip height, and as wide as the staff span implies.
    const path = join(STRIPS, row.image);
    try {
      statSync(path);
    } catch {
      failures.push({ image: row.image, reason: "PNG missing" });
      return;
    }
    const { w, h } = pngSize(path);
    if (h !== EXPECTED_HEIGHT) {
      failures.push({ image: row.image, reason: `height ${h}px, expected ${EXPECTED_HEIGHT}px` });
      return;
    }
    if (svg.staffSpan) {
      const expected = Math.round((svg.staffSpan.x2 - svg.staffSpan.x1) * 10 * 3);
      if (Math.abs(expected - w) > 3) {
        failures.push({ image: row.image, reason: `width ${w}px, staff span implies ${expected}px` });
      }
    }
    if (svg.staffLines.length === 5) {
      const gaps = svg.staffLines.slice(1).map((y, k) => y - svg.staffLines[k]!);
      if (gaps.some((g) => Math.abs(g - 1) > 0.01)) {
        failures.push({ image: row.image, reason: `staff lines not 1.0 apart: ${gaps.join(", ")}` });
      }
    }
  });

  const report = {
    strips: rows.length,
    accidentalsChecked,
    failures,
    lilypondComplaints: complaints,
    pass: failures.length === 0 && complaints.length === 0,
  };
  writeFileSync(OUT, JSON.stringify(report, null, 1) + "\n");
  rmSync(work, { recursive: true, force: true });

  console.log(
    `${report.pass ? "PASS" : "FAIL"} ${rows.length - failures.length}/${rows.length} strips, ` +
      `${accidentalsChecked} accidentals checked -> ${OUT}`,
  );
  for (const f of failures.slice(0, 20)) console.log(`  ${f.image}: ${f.reason}`);
  for (const c of complaints.slice(0, 10)) console.log(`  lilypond: ${c}`);
  if (!report.pass) process.exit(1);
}

main();
