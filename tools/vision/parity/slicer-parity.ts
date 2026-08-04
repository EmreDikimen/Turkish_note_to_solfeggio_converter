/**
 * Slicer port parity — the ported TypeScript slicer against Python's own (MVP W4-W6).
 *
 * ⚠ The control is LOCAL PYTHON, not the manifests on disk. The first version of this harness
 * scored the port against `data/real/strips_v2/*_manifest.json` and read 86.7%; it turned out to
 * be measuring two things at once, because the current `page_to_strips.py` does not reproduce
 * every one of those manifests either (1,578 of the 1,781 page dirs were sliced on Colab). One
 * page the port was failed on — `gozumden_gonlumden_hayali_gitmez_nota_p1` — matched local Python
 * line for line, 7 staves against the manifest's 5. Same lesson as the arm-B ceiling at W3:
 * agreement with an artifact is not correctness, so measure against the thing you are porting.
 *
 * So `scripts/slicer_ref.py` runs stage 1 in Python and writes the reference, and THAT file also
 * defines the sample — this tool runs exactly the pages in it, so the two sides cannot drift apart
 * on which pages they ran. Manifest agreement is still reported, as the weaker second reference.
 *
 * W4 acceptance (docs/mvp/slicer-port.md), all against local Python:
 *   - staff count exact on >= 99.5% of eligible pages
 *   - the manifest-zero pages match Python's staff count — 100% (the bar was written as "yield zero
 *     staves"; Python now finds one on one of them, so it is held against the control like the rest)
 *   - per-system `scale` within 0.002 on >= 99.5% of systems
 *
 * W5 acceptance, added on top and reported alongside — a count difference shifts every downstream
 * window and measure index, so it gets no tolerance:
 *   - bar COUNT per row exactly equal on >= 99.0% of rows
 *   - among count-matching rows, per-bar |Δx| <= 1 px on >= 99.9% and == 0 on >= 95%
 *
 *   .venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out ref.json
 *   npx tsx tools/vision/parity/slicer-parity.ts --ref ref.json
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const IMAGES = path.join(ROOT, "data/real/images");

/** W4 bars, from docs/mvp/slicer-port.md. */
const BAR_STAFF_COUNT = 0.995;
const BAR_SCALE = 0.995;
const SCALE_TOL = 0.002;
/** W5 bars, same source. */
const BAR_BARCOUNT = 0.99;
const BAR_BARX_1PX = 0.999;
const BAR_BARX_EXACT = 0.95;

/** One system as `scripts/slicer_ref.py` records it. */
interface RefStaff {
  system: number;
  lines: number[];
  x0: number;
  x1: number;
  spacing: number;
  scale: number;
  top_line_y: number;
  row_w: number;
  row_h: number;
  row_sum: number;
  bars: number[];
  rejects: Array<[number, string]>;
}
interface RefPage {
  kind: "eligible" | "zero";
  page_w: number;
  page_h: number;
  cropped: boolean;
  skew_deg: number;
  n_staves: number;
  staves: RefStaff[];
  manifest_n_staves: number;
  manifest_scales: Record<string, number>;
  manifest_bars?: Record<string, number[]>;
}

interface HarnessSystem {
  system: number;
  lines: number[];
  x0: number;
  x1: number;
  spacing: number;
  scale: number;
  scale3: number;
  topLineY: number;
  rowW: number;
  rowH: number;
  bandTop: number;
  bandBot: number;
  padTop: number;
  padBottom: number;
  headSp: number;
  belowSp: number;
  rowSum: number;
  bars: number[];
  rejects: Array<[number, string]> | null;
}
interface HarnessPage {
  width: number;
  height: number;
  nStaves: number;
  cropped: boolean;
  skewDeg: number;
  systems: HarnessSystem[];
  ms: number;
}

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

/** stem -> absolute page image path, over the whole real-page image tree. */
function indexImages(): Map<string, string> {
  const idx = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(png|jpe?g)$/i.test(e)) {
        const stem = e.replace(/\.[^.]+$/, "");
        if (!idx.has(stem)) idx.set(stem, p);
      }
    }
  };
  walk(IMAGES);
  return idx;
}

interface PageResult {
  stem: string;
  kind: "eligible" | "zero";
  /** vs local Python (the control) */
  refStaves: number;
  gotStaves: number;
  staffOk: boolean;
  skewRef: number;
  skewGot: number;
  skewOk: boolean;
  systemsChecked: number;
  scaleOk: number;
  linesOk: number;
  geomOk: number;
  extentOk: number;
  rowWOk: number;
  worstScaleDelta: number;
  maxRowSumDriftPpm: number;
  /** W5 — barlines, per row of this page */
  barCountOk: number;
  barsN: number; // bars compared (count-matching rows only)
  barsExact: number;
  bars1px: number;
  worstBarDelta: number;
  rejectsOk: number; // rows where the REJECTED candidates agree too, reason for reason
  /** vs the manifest on disk (the weaker second reference) */
  manifestStaves: number;
  pyMatchesManifest: boolean;
  gotMatchesManifest: boolean;
  manifestBarRows: number;
  pyBarsMatchManifest: number;
  gotBarsMatchManifest: number;
  ms: number;
  error?: string;
}

const eq = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  const refFile = arg("--ref");
  if (!refFile || !existsSync(refFile)) {
    console.error(
      "--ref <file> is required. Build it first:\n" +
        "  .venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out ref.json"
    );
    process.exit(2);
  }
  const ref = JSON.parse(readFileSync(refFile, "utf8")) as Record<string, RefPage>;
  const only = arg("--page");
  const images = indexImages();

  let stems = Object.keys(ref).sort();
  if (only) stems = stems.filter((s) => s === only);
  stems = stems.filter((s) => images.has(s));
  if (!stems.length) {
    console.error("no pages to run");
    process.exit(2);
  }
  const nEl = stems.filter((s) => ref[s]!.kind === "eligible").length;
  console.log(
    `slicer parity (W4+W5) — ${stems.length} pages from ${path.basename(refFile)} ` +
      `(${nEl} eligible + ${stems.length - nEl} zero-staff)\n`
  );

  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  await page.goto(`${base}/slicer-harness.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).__slicer?.ready === true, null, {
    timeout: 120000,
  });

  // `--inject-skew` feeds Python's angle in and skips the 41-rotation sweep, which is ~35 of the
  // ~37 s a page costs. It makes a full-corpus run of everything DOWNSTREAM of the estimator
  // affordable; the estimator itself is then only validated by runs without this flag.
  const injectSkew = process.argv.includes("--inject-skew");
  const results: PageResult[] = [];
  const dumpFile = arg("--dump");
  const dump: Record<string, { got: HarnessPage; ref: RefPage }> = {};
  let done = 0;

  for (const stem of stems) {
    const r = ref[stem]!;
    done++;
    const dataUrl = "data:image/png;base64," + readFileSync(images.get(stem)!).toString("base64");
    let got: HarnessPage;
    try {
      got = (await page.evaluate(
        ([url, skew]) => (window as any).__slicer.stage1(url, skew ?? undefined, true),
        [dataUrl, injectSkew ? r.skew_deg : null] as const
      )) as HarnessPage;
    } catch (e) {
      results.push({
        stem,
        kind: r.kind,
        refStaves: r.n_staves,
        gotStaves: -1,
        staffOk: false,
        skewRef: r.skew_deg,
        skewGot: NaN,
        skewOk: false,
        systemsChecked: 0,
        scaleOk: 0,
        linesOk: 0,
        geomOk: 0,
        extentOk: 0,
        rowWOk: 0,
        worstScaleDelta: NaN,
        maxRowSumDriftPpm: NaN,
        barCountOk: 0,
        barsN: 0,
        barsExact: 0,
        bars1px: 0,
        worstBarDelta: NaN,
        rejectsOk: 0,
        manifestStaves: r.manifest_n_staves,
        pyMatchesManifest: r.n_staves === r.manifest_n_staves,
        gotMatchesManifest: false,
        manifestBarRows: 0,
        pyBarsMatchManifest: 0,
        gotBarsMatchManifest: 0,
        ms: 0,
        error: String((e as Error).message).slice(0, 200),
      });
      continue;
    }
    if (dumpFile) dump[stem] = { got, ref: r };

    let scaleOk = 0;
    let linesOk = 0;
    let geomOk = 0;
    let extentOk = 0;
    let rowWOk = 0;
    let worst = 0;
    let drift = 0;
    let barCountOk = 0;
    let barsN = 0;
    let barsExact = 0;
    let bars1px = 0;
    let worstBar = 0;
    let rejectsOk = 0;
    let manBarRows = 0;
    let pyBarsMan = 0;
    let gotBarsMan = 0;
    const n = Math.min(r.staves.length, got.systems.length);
    for (let i = 0; i < n; i++) {
      const a = r.staves[i]!;
      const b = got.systems[i]!;
      // W5. The count gets no tolerance — one extra or missing bar shifts every window and measure
      // index downstream of it. Positions are only compared where the counts agree, because a
      // count mismatch makes a positional pairing meaningless rather than merely wrong.
      if (a.bars.length === b.bars.length) {
        barCountOk++;
        for (let k = 0; k < a.bars.length; k++) {
          const d = Math.abs(a.bars[k]! - b.bars[k]!);
          barsN++;
          if (d === 0) barsExact++;
          if (d <= 1) bars1px++;
          if (d > worstBar) worstBar = d;
        }
      }
      // Stricter than the bar list and free: two ports can agree on the surviving bars while
      // disagreeing about which candidates each gate threw out. A difference here with identical
      // bars is latent fragility, not a pass.
      const rj = (l: Array<[number, string]>) => l.map(([x, why]) => `${x}:${why}`).join(",");
      if (rj(a.rejects ?? []) === rj(b.rejects ?? [])) rejectsOk++;

      const manBars = r.manifest_bars?.[String(a.system)];
      if (manBars) {
        manBarRows++;
        if (eq(manBars, a.bars)) pyBarsMan++;
        if (eq(manBars, b.bars)) gotBarsMan++;
      }
      const d = Math.abs(a.scale - b.scale);
      if (d <= SCALE_TOL) scaleOk++;
      if (d > worst) worst = d;
      if (eq(a.lines, b.lines)) linesOk++;
      // What `normalize_row` actually reads: the OUTER lines and the median spacing. An interior
      // line's cluster centre can move 1 px under the ±1 grayscale gap without any of these moving,
      // and then the crop is geometrically identical — so this is the check that carries meaning.
      if (
        a.lines[0] === b.lines[0] &&
        a.lines[a.lines.length - 1] === b.lines[b.lines.length - 1] &&
        a.spacing === b.spacing
      )
        geomOk++;
      if (a.x0 === b.x0 && a.x1 === b.x1) extentOk++;
      if (a.row_w === b.rowW) rowWOk++;
      if (a.row_sum > 0)
        drift = Math.max(drift, (1e6 * Math.abs(a.row_sum - b.rowSum)) / a.row_sum);
    }

    results.push({
      stem,
      kind: r.kind,
      refStaves: r.n_staves,
      gotStaves: got.nStaves,
      staffOk: got.nStaves === r.n_staves,
      skewRef: r.skew_deg,
      skewGot: got.skewDeg,
      skewOk: Math.abs(r.skew_deg - got.skewDeg) < 1e-9,
      systemsChecked: n,
      scaleOk,
      linesOk,
      geomOk,
      extentOk,
      rowWOk,
      worstScaleDelta: worst,
      maxRowSumDriftPpm: drift,
      barCountOk,
      barsN,
      barsExact,
      bars1px,
      worstBarDelta: worstBar,
      rejectsOk,
      manifestStaves: r.manifest_n_staves,
      pyMatchesManifest: r.n_staves === r.manifest_n_staves,
      gotMatchesManifest: got.nStaves === r.manifest_n_staves,
      manifestBarRows: manBarRows,
      pyBarsMatchManifest: pyBarsMan,
      gotBarsMatchManifest: gotBarsMan,
      ms: got.ms,
    });

    if (done % 10 === 0 || done === stems.length)
      process.stdout.write(`  ${done}/${stems.length} pages\r`);
  }
  process.stdout.write("\n");

  await browser.close();
  await server.close();

  // ---- report ----------------------------------------------------------------------------------
  const el = results.filter((r) => r.kind === "eligible");
  const ze = results.filter((r) => r.kind === "zero");
  const sum = (rs: PageResult[], f: (r: PageResult) => number) => rs.reduce((a, r) => a + f(r), 0);
  const pct = (a: number, b: number) => (b ? (100 * a) / b : 0);
  const mark = (ok: boolean) => (ok ? "PASS" : "FAIL");

  const elOk = el.filter((r) => r.staffOk).length;
  // ⚠ The bar as written was "the zero-staff pages yield zero staves". Those pages are identified
  // by an EMPTY MANIFEST, and the manifests are not reproducible (see the header) — local Python
  // now finds a staff on one of them, which failed a port that agreed with Python exactly. The bar
  // is therefore held against the control like every other check: the port must not invent a staff
  // Python does not find. `pyFindsStaves` below discloses how far the manifest has drifted.
  const zeOk = ze.filter((r) => r.staffOk).length;
  const pyFindsStaves = ze.filter((r) => r.refStaves > 0).length;
  const sysN = sum(el, (r) => r.systemsChecked);
  const scaleOk = sum(el, (r) => r.scaleOk);
  const errors = results.filter((r) => r.error);

  const staffPass = pct(elOk, el.length) >= BAR_STAFF_COUNT * 100;
  const zeroPass = ze.length === 0 || zeOk === ze.length;
  const scalePass = pct(scaleOk, sysN) >= BAR_SCALE * 100;

  // W5 — over ALL rows checked, eligible and zero-staff alike
  const rowsN = sum(results, (r) => r.systemsChecked);
  const barCountOk = sum(results, (r) => r.barCountOk);
  const barsN = sum(results, (r) => r.barsN);
  const barsExact = sum(results, (r) => r.barsExact);
  const bars1px = sum(results, (r) => r.bars1px);
  const worstBar = Math.max(0, ...results.map((r) => r.worstBarDelta).filter(Number.isFinite));
  const barCountPass = rowsN === 0 || pct(barCountOk, rowsN) >= BAR_BARCOUNT * 100;
  const barX1Pass = barsN === 0 || pct(bars1px, barsN) >= BAR_BARX_1PX * 100;
  const barXExactPass = barsN === 0 || pct(barsExact, barsN) >= BAR_BARX_EXACT * 100;

  const pass =
    staffPass &&
    zeroPass &&
    scalePass &&
    barCountPass &&
    barX1Pass &&
    barXExactPass &&
    !errors.length;

  console.log(
    "== W4 acceptance — port vs LOCAL PYTHON" +
      (injectSkew ? "   [--inject-skew: the deskew ANGLE is Python's, not the port's]" : "")
  );
  console.log(
    `  staff count exact              ${mark(staffPass)}  ${elOk}/${el.length} pages ` +
      `(${pct(elOk, el.length).toFixed(2)}%, bar 99.50%)`
  );
  console.log(
    `  manifest-zero pages match py   ${mark(zeroPass)}  ${zeOk}/${ze.length} pages ` +
      `(${pct(zeOk, ze.length).toFixed(2)}%, bar 100%)` +
      (pyFindsStaves
        ? `   [local python finds staves on ${pyFindsStaves} of them — manifest drift, not the port]`
        : "")
  );
  console.log(
    `  scale within ${SCALE_TOL}             ${mark(scalePass)}  ${scaleOk}/${sysN} systems ` +
      `(${pct(scaleOk, sysN).toFixed(2)}%, bar 99.50%)`
  );

  console.log("\n== W5 acceptance — barlines, port vs LOCAL PYTHON");
  console.log(
    `  bar count exact per row        ${mark(barCountPass)}  ${barCountOk}/${rowsN} rows ` +
      `(${pct(barCountOk, rowsN).toFixed(2)}%, bar 99.00%)`
  );
  console.log(
    `  bar x within 1 px              ${mark(barX1Pass)}  ${bars1px}/${barsN} bars ` +
      `(${pct(bars1px, barsN).toFixed(2)}%, bar 99.90%)   [count-matching rows only]`
  );
  console.log(
    `  bar x exact                    ${mark(barXExactPass)}  ${barsExact}/${barsN} bars ` +
      `(${pct(barsExact, barsN).toFixed(2)}%, bar 95.00%)   worst Δ ${worstBar} px`
  );

  const rejectsOk = sum(results, (r) => r.rejectsOk);
  console.log(
    `  rejected candidates identical  ${rejectsOk}/${rowsN} rows ` +
      `(${pct(rejectsOk, rowsN).toFixed(2)}%)   <- stricter than the bar list, reported not gated`
  );

  console.log("\n-- stronger checks, reported not gated (W4's bars only ask for count + scale)");
  const linesOk = sum(results, (r) => r.linesOk);
  const extentOk = sum(results, (r) => r.extentOk);
  const rowWOk = sum(results, (r) => r.rowWOk);
  const sysAll = sum(results, (r) => r.systemsChecked);
  const skewOk = results.filter((r) => r.skewOk).length;
  const maxDrift = Math.max(0, ...results.map((r) => r.maxRowSumDriftPpm).filter(Number.isFinite));
  const geomOkT = sum(results, (r) => r.geomOk);
  console.log(`  staff line y's identical       ${linesOk}/${sysAll} (${pct(linesOk, sysAll).toFixed(2)}%)`);
  console.log(
    `  outer lines + spacing identical ${geomOkT}/${sysAll} (${pct(geomOkT, sysAll).toFixed(2)}%)` +
      `  <- what normalize_row actually reads`
  );
  console.log(`  staff x-extent identical       ${extentOk}/${sysAll} (${pct(extentOk, sysAll).toFixed(2)}%)`);
  console.log(`  normalized row width identical ${rowWOk}/${sysAll} (${pct(rowWOk, sysAll).toFixed(2)}%)`);
  console.log(
    `  deskew angle identical         ${skewOk}/${results.length} (${pct(skewOk, results.length).toFixed(2)}%)` +
      (injectSkew ? "   ⚠ MEANINGLESS under --inject-skew: the angle WAS Python's" : "")
  );
  console.log(
    `  row pixel-sum drift            max ${maxDrift.toFixed(1)} ppm ` +
      `(never 0: the browser's grayscale differs by ±1 by construction)`
  );

  console.log("\n-- the manifests on disk, as a second reference (NOT the bar)");
  const pyMan = el.filter((r) => r.pyMatchesManifest).length;
  const gotMan = el.filter((r) => r.gotMatchesManifest).length;
  console.log(
    `  local python == manifest       ${pyMan}/${el.length} (${pct(pyMan, el.length).toFixed(2)}%)  ` +
      `<- the ceiling any port could reach against the manifest`
  );
  console.log(`  port         == manifest       ${gotMan}/${el.length} (${pct(gotMan, el.length).toFixed(2)}%)`);
  const manBarRows = sum(results, (r) => r.manifestBarRows);
  if (manBarRows) {
    const pyBarsMan = sum(results, (r) => r.pyBarsMatchManifest);
    const gotBarsMan = sum(results, (r) => r.gotBarsMatchManifest);
    console.log(
      `  local python bars == manifest  ${pyBarsMan}/${manBarRows} rows ` +
        `(${pct(pyBarsMan, manBarRows).toFixed(2)}%)  <- W5's ceiling against the manifest`
    );
    console.log(
      `  port         bars == manifest  ${gotBarsMan}/${manBarRows} rows ` +
        `(${pct(gotBarsMan, manBarRows).toFixed(2)}%)`
    );
  }

  const deskewed = results.filter((r) => r.skewRef !== 0).length;
  console.log(
    `\n  ${(sum(results, (r) => r.ms) / Math.max(1, results.length) / 1000).toFixed(1)} s/page in-browser` +
      `   ${deskewed}/${results.length} pages needed a deskew` +
      (errors.length ? `   ${errors.length} page(s) THREW` : "")
  );

  const bad = results.filter(
    (r) =>
      r.error ||
      !r.staffOk ||
      !r.skewOk ||
      r.scaleOk < r.systemsChecked ||
      r.linesOk < r.systemsChecked ||
      r.geomOk < r.systemsChecked ||
      r.barCountOk < r.systemsChecked ||
      r.barsExact < r.barsN
  );
  if (bad.length) {
    console.log(`\n  pages differing from local python (${bad.length}):`);
    for (const r of bad.slice(0, 25))
      console.log(
        `    ${r.stem.slice(0, 50).padEnd(50)} staves ${r.gotStaves}/${r.refStaves}` +
          `  skew ${r.skewGot}/${r.skewRef}` +
          `  lines ${r.linesOk}/${r.systemsChecked}  geom ${r.geomOk}/${r.systemsChecked}` +
          `  scale ${r.scaleOk}/${r.systemsChecked}` +
          `  barN ${r.barCountOk}/${r.systemsChecked}  barX ${r.barsExact}/${r.barsN}` +
          (r.worstBarDelta ? ` (worst Δ ${r.worstBarDelta}px)` : "") +
          (r.worstScaleDelta ? ` (worst scale Δ ${r.worstScaleDelta.toFixed(4)})` : "") +
          (r.error ? `  ERROR ${r.error}` : "")
      );
    // W5's own worst-10 list — barline differences, ranked by how much they move, for the
    // hand-inspection step against the `_debug.png` overlays already on disk.
    const barBad = results
      .filter((r) => r.barCountOk < r.systemsChecked || r.barsExact < r.barsN)
      .sort(
        (a, b) =>
          b.systemsChecked - b.barCountOk - (a.systemsChecked - a.barCountOk) ||
          b.worstBarDelta - a.worstBarDelta
      );
    if (barBad.length) {
      console.log(`\n  worst barline pages (${barBad.length}) — inspect against their _debug.png:`);
      for (const r of barBad.slice(0, 10))
        console.log(
          `    ${r.stem.slice(0, 50).padEnd(50)} rows w/ wrong bar count ` +
            `${r.systemsChecked - r.barCountOk}/${r.systemsChecked}` +
            `  bars off ${r.barsN - r.barsExact}/${r.barsN}  worst Δ ${r.worstBarDelta}px`
        );
    }
  }

  if (dumpFile) {
    writeFileSync(dumpFile, JSON.stringify(dump, null, 1));
    console.log(`\nwrote ${dumpFile} (raw harness output for ${Object.keys(dump).length} pages)`);
  }
  const jsonOut = arg("--json");
  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(results, null, 1));
    console.log(`wrote ${jsonOut} (${results.length} pages)`);
  }

  console.log(
    `\n== W4 ${staffPass && zeroPass && scalePass && !errors.length ? "PASS" : "FAIL"}` +
      `   W5 ${barCountPass && barX1Pass && barXExactPass && !errors.length ? "PASS" : "FAIL"}`
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
