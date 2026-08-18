/**
 * Round-3 Lever 4: the LILYPOND strip renderer — the second engraver's corpus arm.
 *
 * Same job as `render.ts`, different engraver. `render.ts` drives the web harness and crops strips
 * out of a VexFlow page; this one asks `labels-cli.ts` for the labels, translates each into real
 * LilyPond source (`ly-engrave.ts`), runs LilyPond once per piece, and screenshots each resulting
 * one-line SVG page at the corpus's own geometry. The labels come from the SAME serializer the
 * corpus uses, so this adds a second set of PIXELS and no new labelling — which is the whole point
 * of the lever ([docs/rung3/levers.md](../../docs/rung3/levers.md)).
 *
 * GEOMETRY IS MATCHED ON PURPOSE. Measured on `strips_v4`: every strip is 336 px tall with its staff
 * lines exactly 30 px apart and the top line at y = 138. LilyPond's SVG viewBox is in staff-spaces
 * (consecutive staff lines are 1.0 apart), so rendering at 10 CSS px per unit with Playwright's
 * deviceScaleFactor 3 reproduces that exactly. If the engraver's own spacing were also allowed to
 * change the image SIZE, this pilot would be measuring two variables at once — and Lever 1 already
 * proved size moves the edit budget (docs/METRICS-GEOMETRY.md).
 *
 * ⚠ WHAT THIS ARM DELIBERATELY DOES NOT DRAW, and why the comparison must say so: lyrics, repeat
 * signs, volta brackets, navigation marks and distractor text. `render.ts` draws all of them on a
 * seeded share of its jobs. They are ink-outside-the-staff and token-rate differences that have
 * nothing to do with the engraver, so `domain_gap.py`'s `ink` and per-100-note token columns are NOT
 * comparable between this arm and a VexFlow arm; the geometry, spacing, beam and density columns are.
 *
 * Run:
 *   npx --yes tsx tools/render/render-ly.ts --pieces data/pieces_geom_pilot.json \
 *       --out data/synthetic/_pilot_ly [--clean] [--limit 40] [--lilypond /opt/homebrew/bin/lilypond]
 *
 * Resumable exactly like render.ts: per-piece manifest shards plus a `.done` marker, so Ctrl-C is
 * safe on a fanless machine and a re-run skips finished pieces.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { deriveTimeSignature, groupMeasures, type NoteModelDocument } from "@turkish-omr/core";
import { STRIP_BUDGET, parseSignatureBody, serializeMeasure, type SignatureMap } from "./lilypond";
import { hashStr, mulberry32 } from "./rng";
import { lilyDocument, parseLabel, stripToScore } from "./ly-engrave";
import { accidentalsInSvg, calibrate, parseLySvg, type GlyphTable } from "./ly-svg";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const PIECES_PATH = arg("pieces") ?? "data/pieces_geom_pilot.json";
const OUT = arg("out") ?? "data/synthetic/_pilot_ly";
const LILYPOND = arg("lilypond") ?? "/opt/homebrew/bin/lilypond";
const SIGS_PATH = arg("sigs") ?? "data/makam_signatures.json";
const LIMIT = arg("limit") != null ? Number(arg("limit")) : Infinity;

// The corpus's own share of signature-bearing (row-start) strips, measured on strips_v4:
// 11,405 of 30,847 carry-mode strips = 37.0%. A LilyPond strip has no "row" to start, so the
// signature is a seeded coin at that rate instead — same label mix, no layout to imitate.
const SIG_SHARE = Number(arg("sig-share") ?? 0.37);

// Corpus geometry, measured (see the header). CSS px; Playwright's deviceScaleFactor triples them.
const PX_PER_STAFF_SPACE = 10;
const CROP_H = 112;
const CROP_TOP_ABOVE_STAFF = 46;
const DEVICE_SCALE = 3;
// The SVG is placed at this offset inside the page so a crop can never run off the top-left.
const PAGE_PAD = 120;

interface PieceEntry {
  slug: string;
  file: string; // /scores/<slug>.json under apps/web/public
  makam: string;
}

interface PlannedStrip {
  id: string; // m<from>-<to>
  from: number;
  to: number;
  measures: number[];
  rowStart: boolean;
}

interface PlannedPiece {
  piece: PieceEntry;
  scorePath: string;
  sigBody: string | null;
  sigEntries: { letter: string; alterCommas: number }[];
  /** The piece's printed meter — LilyPond beams by it, so it is stored per strip and replayed by
   *  the gate. See `timeSignature` in ly-engrave.ts. */
  meter: { num: number; den: number } | null;
  strips: PlannedStrip[];
}

// ---------------------------------------------------------------------------------------------
// Planning: which measures go in which strip, and which strips show the signature.

/** Seeded weighted pick of a makam's conventional printed signature. Mirrors `pickSignature` in
 *  render.ts — deliberately a copy rather than an import, because the corpus renderer is not going
 *  to be edited for a pilot. The TABLE is the same file, which is what has to match. */
const SIG_TABLE: Record<string, { variants: { sig: string; weight: number }[] }> = JSON.parse(
  readFileSync(SIGS_PATH, "utf8"),
);
const normMakam = (m: string) => m.toLowerCase().replace(/[^a-z0-9]/g, "");
function pickSignature(makam: string, seed: number): string | null {
  const entry = SIG_TABLE[normMakam(makam)];
  if (!entry?.variants.length) return null;
  const r = mulberry32(seed)();
  let acc = 0;
  for (const v of entry.variants) {
    acc += v.weight;
    if (r <= acc) return v.sig;
  }
  return entry.variants[entry.variants.length - 1]!.sig;
}

/** Pack a piece's measures into strips under the corpus budget (STRIP_BUDGET), whole measures only.
 *  Token cost comes from `serializeMeasure` — the same serializer that writes the label — so the
 *  packing rail is the corpus's, not a second opinion. */
function planStrips(
  doc: NoteModelDocument,
  sigMap: SignatureMap,
  sigTokens: number,
  slug: string,
): PlannedStrip[] {
  const measures = groupMeasures(doc);
  const out: PlannedStrip[] = [];
  let cur: number[] = [];
  let tokens = 0;

  const flush = () => {
    if (cur.length === 0) return;
    const from = cur[0]!;
    const to = cur[cur.length - 1]!;
    // The signature coin, seeded per strip. A strip that cannot fit the prefix within the decoder
    // budget simply does not show one — the corpus drops those chunks for the same reason.
    const fits = tokens + sigTokens <= STRIP_BUDGET.maxTokens;
    const rowStart = fits && sigTokens > 0 && mulberry32(hashStr(`${slug}:${from}:sig`))() < SIG_SHARE;
    out.push({ id: `m${from}-${to}`, from, to, measures: [...cur], rowStart });
    cur = [];
    tokens = 0;
  };

  for (const m of measures) {
    const body = serializeMeasure(m, sigMap, true, true).tokens;
    const withBar = () => body + (cur.length > 0 ? 1 : 0); // +1 for the `|` this measure would add
    if (cur.length > 0 && (cur.length >= STRIP_BUDGET.maxMeasures || tokens + withBar() > STRIP_BUDGET.maxTokens)) {
      flush();
    }
    tokens += withBar();
    cur.push(m.index);
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------------------------
// Labels: one call into labels-cli.ts, the same back end the real-page emitter uses.

function fetchLabels(plan: PlannedPiece[], workDir: string): Map<string, string> {
  const reqPath = join(workDir, "label_request.json");
  const resPath = join(workDir, "label_response.json");
  const request = plan.map((p) => ({
    score: p.scorePath,
    ...(p.sigEntries.length > 0 ? { signature: p.sigEntries } : {}),
    strips: p.strips.map((s) => ({
      id: `${p.piece.slug}::${s.id}`,
      measures: s.measures,
      rowStart: s.rowStart,
    })),
  }));
  writeFileSync(reqPath, JSON.stringify(request, null, 1));
  execFileSync("npx", ["--yes", "tsx", "tools/render/labels-cli.ts", "--ranges", reqPath, "--out", resPath], {
    stdio: "inherit",
  });
  const responses = JSON.parse(readFileSync(resPath, "utf8")) as {
    id: string; label?: string; error?: string; check?: { errors: string[] };
  }[];
  const byId = new Map<string, string>();
  for (const r of responses) {
    if (r.error || !r.label) throw new Error(`label back end failed for ${r.id}: ${r.error}`);
    if (r.check && r.check.errors.length > 0) {
      throw new Error(`label round-trip failed for ${r.id}: ${r.check.errors.join("; ")}`);
    }
    byId.set(r.id, r.label);
  }
  return byId;
}

// ---------------------------------------------------------------------------------------------
// Rendering

/** Screenshot one one-line SVG page at the corpus geometry. Returns the strip's pixel size. */
async function shootStrip(page: Page, svgText: string, outPath: string): Promise<{ w: number; h: number }> {
  const svg = parseLySvg(svgText);
  if (svg.staffLines.length !== 5 || !svg.staffSpan) {
    throw new Error(`expected 5 staff lines, found ${svg.staffLines.length}`);
  }
  const scale = PX_PER_STAFF_SPACE;
  const pageW = Math.ceil(svg.box.w * scale) + 2 * PAGE_PAD;
  const pageH = Math.ceil(svg.box.h * scale) + 2 * PAGE_PAD;
  await page.setViewportSize({ width: pageW, height: pageH });
  const sized = svgText
    .replace(/\swidth="[^"]*"/, ` width="${svg.box.w * scale}"`)
    .replace(/\sheight="[^"]*"/, ` height="${svg.box.h * scale}"`);
  await page.setContent(
    `<body style="margin:0;background:#fff"><div style="position:absolute;left:${PAGE_PAD}px;top:${PAGE_PAD}px">${sized}</div></body>`,
  );
  const clip = {
    x: PAGE_PAD + (svg.staffSpan.x1 - svg.box.x) * scale,
    y: PAGE_PAD + (svg.staffLines[0]! - svg.box.y) * scale - CROP_TOP_ABOVE_STAFF,
    width: (svg.staffSpan.x2 - svg.staffSpan.x1) * scale,
    height: CROP_H,
  };
  await page.screenshot({ path: outPath, clip });
  return { w: Math.round(clip.width * DEVICE_SCALE), h: CROP_H * DEVICE_SCALE };
}

/** What LilyPond actually drew, so a strip cannot be written when the picture disagrees with the
 *  label. This is the same comparison `verify-labels-ly.ts` makes; doing it here as well means a
 *  bad strip never reaches the corpus in the first place. */
function checkAccidentals(svgText: string, label: string, table: GlyphTable, id: string): void {
  const drawn = accidentalsInSvg(parseLySvg(svgText), table).map((a) => a.token);
  const wanted = parseLabel(label).accidentals;
  if (drawn.length !== wanted.length || drawn.some((t, i) => t !== wanted[i])) {
    throw new Error(`${id}: drew [${drawn.join(" ")}] but the label says [${wanted.join(" ")}]`);
  }
}

async function renderPiece(
  page: Page,
  p: PlannedPiece,
  labels: Map<string, string>,
  table: GlyphTable,
  workDir: string,
  shardPath: string,
): Promise<number> {
  const scores: string[] = [];
  const kept: { strip: PlannedStrip; label: string }[] = [];
  for (const s of p.strips) {
    const label = labels.get(`${p.piece.slug}::${s.id}`);
    if (!label) throw new Error(`no label for ${p.piece.slug} ${s.id}`);
    const parsed = parseLabel(label);
    scores.push(
      stripToScore(parsed, { drawClef: parsed.sig !== null && parsed.sig.length > 0, meter: p.meter }),
    );
    kept.push({ strip: s, label });
  }
  if (kept.length === 0) return 0;

  const dir = join(workDir, p.piece.slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const src = join(dir, "piece.ly");
  writeFileSync(src, lilyDocument(scores));
  const run = spawnSync(LILYPOND, ["-dbackend=svg", "-dno-point-and-click", "-o", join(dir, "s"), src], {
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(`${p.piece.slug}: LilyPond exited ${run.status}\n${run.stderr}`);
  // A bar check that fails means the `\time` ly-engrave computed from the label's own durations does
  // not match what LilyPond read — the one arithmetic error that would otherwise pass silently.
  if (/barcheck failed|programming error|Unbound variable|error:/i.test(run.stderr ?? "")) {
    throw new Error(`${p.piece.slug}: LilyPond complained —\n${run.stderr}`);
  }

  const pages = readdirSync(dir)
    .filter((f) => /^s-\d+\.svg$/.test(f))
    .sort((a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]));
  if (pages.length !== kept.length) {
    throw new Error(`${p.piece.slug}: ${kept.length} strips but ${pages.length} SVG pages`);
  }

  let count = 0;
  for (let i = 0; i < kept.length; i++) {
    const { strip, label } = kept[i]!;
    const svgText = readFileSync(join(dir, pages[i]!), "utf8");
    const id = `${p.piece.slug} ${strip.id}`;
    checkAccidentals(svgText, label, table, id);
    const image = `${p.piece.slug}_ly_measure_${strip.id}.png`;
    const size = await shootStrip(page, svgText, join(OUT, image));
    appendFileSync(
      shardPath,
      JSON.stringify({
        image,
        label,
        mode: "measure",
        makam: p.piece.makam,
        sig: p.sigBody,
        piece: p.piece.slug,
        transpose: 0,
        lyrics: false,
        repseed: null,
        navseed: null,
        textseed: null,
        respellseed: null,
        slurseed: null,
        from: strip.from,
        to: strip.to,
        engraver: "lilypond",
        meter: p.meter ? `${p.meter.num}/${p.meter.den}` : null,
        width: size.w,
      }) + "\n",
    );
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  if (has("clean")) rmSync(OUT, { recursive: true, force: true });
  const workDir = join(OUT, "_work");
  const shardDir = join(OUT, "manifests");
  mkdirSync(OUT, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(shardDir, { recursive: true });

  const version = execFileSync(LILYPOND, ["--version"], { encoding: "utf8" }).split("\n")[0]!;
  console.log(version);

  const pieces = (JSON.parse(readFileSync(PIECES_PATH, "utf8")).pieces as PieceEntry[]).slice(0, LIMIT);

  // Plan every piece first, then ask for all the labels in one call.
  const plan: PlannedPiece[] = pieces.map((piece) => {
    const scorePath = join("apps/web/public", piece.file.replace(/^\//, ""));
    const doc = JSON.parse(readFileSync(scorePath, "utf8")) as NoteModelDocument;
    // ⚠ The seed is render.ts's FIRST carry pass (`c0`), not a new namespace of our own. A control
    // arm rendered with `--carry-passes 1` wears exactly that signature variant, and a makam's
    // variants differ in how many alterations they cover — picking a different one moved the
    // measured accidental rate by 3.6× on the first run, which would have been read as an engraver
    // effect. Same seed, same signature, one variable.
    const sigBody = pickSignature(piece.makam, hashStr(`${piece.slug}:c0:sig`));
    const sigEntries = sigBody ? parseSignatureBody(sigBody) : [];
    const sigMap: SignatureMap = new Map(sigEntries.map((e) => [e.letter, e.alterCommas]));
    const sigTokens = sigEntries.length > 0 ? sigEntries.length * 2 + 2 : 0;
    return {
      piece,
      scorePath,
      sigBody,
      sigEntries,
      meter: deriveTimeSignature(doc),
      strips: planStrips(doc, sigMap, sigTokens, piece.slug),
    };
  });
  console.log(`${plan.length} pieces, ${plan.reduce((n, p) => n + p.strips.length, 0)} strips planned`);

  const labels = fetchLabels(plan, workDir);
  const table = calibrate(LILYPOND, workDir);
  writeFileSync(join(OUT, "glyph_table.json"), JSON.stringify(table, null, 1));
  console.log(`glyph table: ${Object.keys(table).length} outlines calibrated`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: DEVICE_SCALE });
  let total = 0;
  try {
    for (const p of plan) {
      const shardPath = join(shardDir, `${p.piece.slug}.jsonl`);
      const donePath = join(shardDir, `${p.piece.slug}.done`);
      if (existsSync(donePath)) {
        console.log(`skip ${p.piece.slug} (done)`);
        continue;
      }
      rmSync(shardPath, { force: true });
      const n = await renderPiece(page, p, labels, table, workDir, shardPath);
      writeFileSync(donePath, "");
      total += n;
      console.log(`${p.piece.slug}: ${n} strips`);
    }
  } finally {
    await browser.close();
  }

  // Finalize: one manifest, plus the config that says what this pool is.
  const rows = readdirSync(shardDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .flatMap((f) => readFileSync(join(shardDir, f), "utf8").split("\n").filter(Boolean));
  writeFileSync(join(OUT, "manifest.jsonl"), rows.join("\n") + "\n");
  writeFileSync(
    join(OUT, "render_config.json"),
    JSON.stringify(
      {
        engraver: "lilypond",
        lilypond: version,
        pieces: PIECES_PATH,
        sigShare: SIG_SHARE,
        maxMeasures: STRIP_BUDGET.maxMeasures,
        maxTokens: STRIP_BUDGET.maxTokens,
        pxPerStaffSpace: PX_PER_STAFF_SPACE,
        cropHeight: CROP_H,
        deviceScale: DEVICE_SCALE,
        draws: { lyrics: false, repeats: false, navMarks: false, distractorText: false },
        finished: new Date().toISOString(),
      },
      null,
      1,
    ) + "\n",
  );
  console.log(`\n${rows.length} strips -> ${OUT}/manifest.jsonl (${total} rendered this run)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
