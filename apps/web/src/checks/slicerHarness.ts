/**
 * Headless entry point for the ported slicer — driven by `tools/vision/parity/slicer-parity.ts`.
 *
 * It runs the real port (`apps/web/src/omr/slicer/`) on a whole page and returns only what a
 * parity check needs: the per-system geometry, never the pixels. A 10-system page normalizes to
 * ~10 MB of row images and serializing those over CDP would dominate the run.
 *
 * Pages arrive as data URLs, matching `stripsHarness.ts`: Node keeps all file I/O and the dev
 * server never gets `data/real/` opened to it.
 */
import {
  binarizeInk,
  decodeGray,
  grayToCanvas,
  initCv,
  openHorizontal,
  resizeScale,
  rotate,
  type Gray,
} from "../omr/slicer/cvOps";
import { qualifyingLineRows } from "../omr/slicer/prepPage";
import { clusterRows } from "../omr/slicer/staves";
import { cropStrip, sliceStage3, stripName, type Strip } from "../omr/slicer/slicer";
import { staffBottom, staffSpacing, staffTop } from "../omr/slicer/staves";

export interface HarnessSystem {
  system: number;
  /** page coords */
  lines: number[];
  x0: number;
  x1: number;
  spacing: number;
  top: number;
  bottom: number;
  /** normalize_row outputs */
  scale: number;
  scale3: number; // rounded to 3 dp, the manifest's own precision
  topLineY: number;
  rowW: number;
  rowH: number;
  bandTop: number;
  bandBot: number;
  padTop: number;
  padBottom: number;
  headSp: number;
  belowSp: number;
  /** cheap regression signature over the normalized row's pixels */
  rowSum: number;
  /** detect_barlines (W5) — measure boundaries in row coords, ends included */
  bars: number[];
  /** rejected candidates by reason, only when the caller asks for them */
  rejects: Array<[number, string]> | null;
}

export interface HarnessPage {
  width: number;
  height: number;
  nStaves: number;
  /** prep_page's own outputs — the parity harness joins these against Python's */
  cropped: boolean;
  skewDeg: number;
  systems: HarnessSystem[];
  /** window_measures + the driver's pad/trim (W6) — the manifest, in manifest order */
  strips: Strip[];
  /**
   * ⚠ BUDGET-RAIL PARITY only — `Window.est_tokens`, index-aligned with `strips` (the driver emits
   * exactly one strip per window). All-`null` unless `stage1` was given a `tokenBudget`, because
   * the port computes the cost features only where they are used. It is reported separately rather
   * than folded into `Strip` so the shipped manifest shape stays exactly Python's minus the
   * emitter's keys.
   */
  estTokens: Array<number | null>;
  ms: number;
}

/** One crop's pixels, for the arm-A decode comparison. Kept out of `stage1` on purpose. */
export interface HarnessCrop {
  name: string;
  system: number;
  window: number;
  width: number;
  dataUrl: string;
}

async function stage1(
  pageDataUrl: string,
  skewDeg?: number,
  wantRejects = false,
  /** ⚠ opt-in: run the label-budget rail (`?dense=`) instead of the shipped measures+width rule. */
  tokenBudget?: number
): Promise<HarnessPage> {
  const t0 = performance.now();
  const gray = await decodeGray(pageDataUrl);
  const res = sliceStage3(gray, {
    ...(skewDeg === undefined ? {} : { skewDeg }),
    ...(wantRejects ? { rejects: true } : {}),
    ...(tokenBudget === undefined ? {} : { tokenBudget }),
  });
  const systems: HarnessSystem[] = res.rows.map(({ system, staff, normalized, bars, rejects }) => {
    let rowSum = 0;
    const d = normalized.row.data;
    for (let i = 0; i < d.length; i++) rowSum += d[i]!;
    return {
      system,
      lines: staff.lines,
      x0: staff.x0,
      x1: staff.x1,
      spacing: staffSpacing(staff),
      top: staffTop(staff),
      bottom: staffBottom(staff),
      scale: normalized.scale,
      scale3: Math.round(normalized.scale * 1000) / 1000,
      topLineY: normalized.topLineY,
      rowW: normalized.row.width,
      rowH: normalized.row.height,
      bandTop: normalized.bandTop,
      bandBot: normalized.bandBot,
      padTop: normalized.padTop,
      padBottom: normalized.padBottom,
      headSp: normalized.headSp,
      belowSp: normalized.belowSp,
      rowSum,
      bars,
      rejects,
    };
  });
  return {
    width: gray.width,
    height: gray.height,
    nStaves: res.staves.length,
    cropped: res.cropped,
    skewDeg: res.skewDeg,
    systems,
    strips: res.strips,
    // same flattening order as `res.strips`, so index i of one describes index i of the other
    estTokens: res.rows.flatMap((r) => r.windows.map((w) => w.estTokens)),
    ms: performance.now() - t0,
  };
}

/**
 * The same slice, returning the CROPS — what `tools/vision/parity/arm-a.ts` decodes.
 *
 * Separate from `stage1` because pixels are expensive over CDP and the geometry parity run (a
 * whole corpus of pages) never wants them.
 */
async function crops(
  pageDataUrl: string,
  stem: string,
  skewDeg?: number
): Promise<{ crops: HarnessCrop[]; nStaves: number; ms: number }> {
  const t0 = performance.now();
  const gray = await decodeGray(pageDataUrl);
  const res = sliceStage3(gray, skewDeg === undefined ? {} : { skewDeg });
  const out: HarnessCrop[] = [];
  for (const r of res.rows)
    for (const s of r.strips)
      out.push({
        name: stripName(stem, s.system, s.window),
        system: s.system,
        window: s.window,
        width: s.width,
        dataUrl: grayToCanvas(cropStrip(r.normalized.row, s)).toDataURL("image/png"),
      });
  return { crops: out, nStaves: res.staves.length, ms: performance.now() - t0 };
}


// ---------------------------------------------------------------------------------------------
// Deskew: is the morphology-free row sum EXACTLY the morphology, and how much time does it save?

export interface DeskewAngle {
  angle: number;
  morph: number;
  fast: number;
}

export interface DeskewCheck {
  width: number;
  height: number;
  angles: DeskewAngle[];
  mismatches: DeskewAngle[];
  /** time for the row-sum stage alone, summed over every angle */
  msMorph: number;
  msFast: number;
  /** end-to-end cost of ONE `qualifyingLineRows` call, averaged over the angles */
  msPerCallMorph: number;
  msPerCallFast: number;
}

/**
 * `qualifyingLineRows` as it was BEFORE the substitution — the oracle, not the product.
 *
 * Deliberately a verbatim copy of the old body: a check that shares code with the thing it checks
 * proves nothing. It is the only place `openHorizontal` is still called on this path.
 */
function qualifyingLineRowsViaMorphology(gray: Gray): number {
  const ink = binarizeInk(gray);
  const horLen = Math.max(20, Math.floor(gray.width / 4));
  const horiz = openHorizontal(ink, horLen);
  const h = gray.height;
  const w = gray.width;
  const rowInk = new Float64Array(h);
  let maxRow = 0;
  for (let y = 0; y < h; y++) {
    let s = 0;
    const off = y * w;
    for (let x = 0; x < w; x++) s += horiz.data[off + x]!;
    rowInk[y] = s / 255;
    if (rowInk[y]! > maxRow) maxRow = rowInk[y]!;
  }
  if (maxRow < 1) return 0;
  const thr = Math.max(maxRow * 0.3, w * 0.2);
  const hits: number[] = [];
  for (let y = 0; y < h; y++) if (rowInk[y]! > thr) hits.push(y);
  return clusterRows(hits).length;
}

async function deskewCheck(pageDataUrl: string): Promise<DeskewCheck> {
  const gray = await decodeGray(pageDataUrl);
  // the same shrink `skewSearch` applies, so the check runs on the pixels the sweep really sees
  const small = gray.width > 2400 ? resizeScale(gray, 1600.0 / gray.width, 1600.0 / gray.width) : gray;

  // every angle the coarse pass evaluates, plus a fine-step sample either side of straight
  const angles = [0.0];
  for (let a = -7.0; a <= 7.001; a += 0.5) angles.push(Math.round(a * 100) / 100);
  for (let a = -0.5; a <= 0.501; a += 0.1) angles.push(Math.round(a * 100) / 100);

  const out: DeskewAngle[] = [];
  let msMorph = 0;
  let msFast = 0;
  for (const angle of angles) {
    const img = angle === 0.0 ? small : rotate(small, angle);
    const t0 = performance.now();
    const morph = qualifyingLineRowsViaMorphology(img);
    const t1 = performance.now();
    const fast = qualifyingLineRows(img);
    const t2 = performance.now();
    msMorph += t1 - t0;
    msFast += t2 - t1;
    out.push({ angle, morph, fast });
  }
  return {
    width: gray.width,
    height: gray.height,
    angles: out,
    mismatches: out.filter((a) => a.morph !== a.fast),
    msMorph,
    msFast,
    msPerCallMorph: msMorph / out.length,
    msPerCallFast: msFast / out.length,
  };
}

async function main() {
  await initCv();
  (window as unknown as { __slicer: unknown }).__slicer = { stage1, crops, deskewCheck, ready: true };
}

main().catch((e) => {
  (window as unknown as { __slicer: unknown }).__slicer = { ready: false, error: String(e?.stack ?? e) };
});
