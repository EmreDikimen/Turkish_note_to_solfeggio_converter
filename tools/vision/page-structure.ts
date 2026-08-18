/**
 * Per-page STRUCTURE stats for the review-UI-2 page queue (`scripts/rung3/build_page_queue.py`).
 *
 * Why this is TypeScript and not part of the Python ranker: every number here comes from the
 * SHIPPED stitcher and the SHIPPED core helpers — `stitchStrips`, `deriveTimeSignature`,
 * `measureBeats`. Re-deriving "is this bar off-meter" in Python would be a second implementation
 * of a rule the editor draws, and this repo has paid for that kind of duplication before
 * (docs/METRICS.md, the carry/sigTolerant split that cost Round 1). So the rule stays in one
 * place and the ranker consumes this file.
 *
 *   npx tsx tools/vision/page-structure.ts [--strips data/real/strips_v2] [--out <json>]
 *
 * Reads every `*_decode.json` under the strips root and writes one row per page.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { stitchStrips, type DecodedStrip } from "../render/stitch";
import { groupMeasures, measureBeats, deriveTimeSignature } from "@turkish-omr/core";

interface PageStructure {
  stem: string;
  systems: number;
  strips: number;
  /** written measures (expand:false — see the note on repeats below) */
  measures: number;
  notes: number;
  rests: number;
  /** interior bars (excluding the first and last, which are legitimately short) */
  interiorBars: number;
  /** interior bars whose contents do not sum to the derived meter — the editor's off-meter mark */
  offMeterBars: number;
  /** the derived meter, as the editor derives it; null when it cannot be derived */
  meter: string | null;
  /**
   * Share of interior bars that actually sit AT the derived meter. `deriveTimeSignature` takes the
   * modal bar length, so on a badly decoded page the "mode" can be a coin flip — and then the
   * off-meter count measures the derivation failing, not the page. A ranker must be able to tell
   * those apart, so the support for the mode is reported beside it.
   */
  modeShare: number;
  /** stitch warnings: unbalanced \sig, unclosed \tup3, dangling \tie, unknown tokens … */
  warnings: number;
  /** the stitch produced nothing usable — a lyrics page, a failed slice, a degenerate decode */
  degenerate: boolean;
}

function argOf(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Every `*_decode.json` under `root`, one level down (root/<page>/<page>_decode.json). */
function decodeFiles(root: string): string[] {
  const out: string[] = [];
  let dirs: string[];
  try {
    dirs = readdirSync(root);
  } catch {
    return out;
  }
  for (const d of dirs) {
    const p = join(root, d);
    try {
      if (!statSync(p).isDirectory()) continue;
      for (const f of readdirSync(p)) if (f.endsWith("_decode.json")) out.push(join(p, f));
    } catch {
      /* unreadable page dir — skip, the ranker treats a missing row as unrankable */
    }
  }
  return out.sort();
}

function structureOf(file: string): PageStructure | null {
  let o: { strips?: unknown[] };
  try {
    o = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  const raw = (o.strips ?? []) as Record<string, unknown>[];
  const strips: DecodedStrip[] = raw
    .filter((s) => typeof s.tokens === "string" && (s.tokens as string).trim().length > 0)
    .map((s) => ({
      system: Number(s.system ?? 0),
      window: Number(s.window ?? 0),
      tokens: s.tokens as string,
    }));
  const stem = basename(file).replace(/_decode\.json$/, "");
  const systems = new Set(strips.map((s) => s.system)).size;

  const empty: PageStructure = {
    stem,
    systems,
    strips: strips.length,
    measures: 0,
    notes: 0,
    rests: 0,
    interiorBars: 0,
    offMeterBars: 0,
    meter: null,
    modeShare: 0,
    warnings: 0,
    degenerate: true,
  };
  if (strips.length === 0) return empty;

  // `expand: false` — WRITTEN form. The review UI edits written measures so a doc edit maps back
  // to one token position; unfolding a repeat renders a bar twice from one token and the edit
  // could not be attributed (docs/mvp/editor.md, "tokens are NOT the edit surface").
  // `accidentals: "carry"` is what a real printed page uses (stitch-cli passes it for page decodes).
  let res;
  try {
    res = stitchStrips(strips, { accidentals: "carry", expand: false });
  } catch {
    return empty;
  }
  const doc = res.doc;
  const measures = groupMeasures(doc);
  const notes = doc.events.filter((e) => e.kind === "note").length;
  const rests = doc.events.filter((e) => e.kind === "rest").length;
  if (measures.length < 3) {
    return { ...empty, measures: measures.length, notes, rests, warnings: res.warnings.length };
  }

  const ts = deriveTimeSignature(doc);
  const inner = measures.slice(1, -1);
  let offMeter = 0;
  if (ts) {
    const target = ts.num / ts.den; // whole-note units, the same unit measureBeats returns
    for (const m of inner) if (Math.abs(measureBeats(m.events) - target) > 1e-9) offMeter++;
  }
  return {
    stem,
    systems,
    strips: strips.length,
    measures: measures.length,
    notes,
    rests,
    interiorBars: inner.length,
    offMeterBars: ts ? offMeter : 0,
    meter: ts ? `${ts.num}/${ts.den}` : null,
    modeShare: ts && inner.length ? (inner.length - offMeter) / inner.length : 0,
    warnings: res.warnings.length,
    degenerate: notes < 8,
  };
}

const stripsRoot = argOf("--strips", "data/real/strips_v2");
const outPath = argOf("--out", "data/real/rung3/_pagequeue/page_structure.json");

const files = decodeFiles(stripsRoot);
if (files.length === 0) {
  console.error(`no *_decode.json under ${stripsRoot} — is the re-slice on this machine?`);
  process.exit(1);
}
const rows: PageStructure[] = [];
for (const f of files) {
  const s = structureOf(f);
  if (s) rows.push(s);
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ stripsRoot, generated: new Date().toISOString(), pages: rows }, null, 1));

const usable = rows.filter((r) => !r.degenerate);
const bars = usable.reduce((s, r) => s + r.interiorBars, 0);
const off = usable.reduce((s, r) => s + r.offMeterBars, 0);
console.log(`pages          ${rows.length}  (${usable.length} usable, ${rows.length - usable.length} degenerate)`);
console.log(`interior bars  ${bars}`);
console.log(`off-meter      ${off} = ${bars ? ((100 * off) / bars).toFixed(1) : "0"}%`);
console.log(`wrote          ${outPath}`);
