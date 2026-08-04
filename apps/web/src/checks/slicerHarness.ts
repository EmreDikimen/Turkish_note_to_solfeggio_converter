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
import { initCv, decodeGray } from "../omr/slicer/cvOps";
import { sliceStage2 } from "../omr/slicer/slicer";
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
  ms: number;
}

async function stage1(
  pageDataUrl: string,
  skewDeg?: number,
  wantRejects = false
): Promise<HarnessPage> {
  const t0 = performance.now();
  const gray = await decodeGray(pageDataUrl);
  const res = sliceStage2(gray, {
    ...(skewDeg === undefined ? {} : { skewDeg }),
    ...(wantRejects ? { rejects: true } : {}),
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
    ms: performance.now() - t0,
  };
}

async function main() {
  await initCv();
  (window as unknown as { __slicer: unknown }).__slicer = { stage1, ready: true };
}

main().catch((e) => {
  (window as unknown as { __slicer: unknown }).__slicer = { ready: false, error: String(e?.stack ?? e) };
});
