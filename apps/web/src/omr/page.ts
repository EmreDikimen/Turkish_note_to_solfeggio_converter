/**
 * page image → crops the decoder can read. The last missing link of the product path (MVP W7).
 *
 * W2 wired crops → editor and W6 finished the slicer port; this is the twenty lines between them,
 * plus the two things a UI needs and a parity harness does not: progress, and a main thread that
 * still paints. `tools/vision/parity/arm-a.ts` drives the same slicer through
 * `checks/slicerHarness.ts` and may block as long as it likes — an upload may not.
 *
 * Everything here is deliberately thin. Nothing in it may change what the slicer computes: the
 * crops this returns are the same pixels arm A decoded at W6, and if that stops being true the
 * paired parity result stops applying to the app.
 *
 * Import it LAZILY (`await import("./omr/page")`). It pulls in opencv.js, ~13 MB of wasm nobody
 * loading a sample score should pay for.
 */
import { decodeGray, grayToCanvas, initCv, type Gray } from "./slicer/cvOps";
import { estimateSkewAsync, guardedAngle, SKEW_SWEEP_STEPS } from "./slicer/prepPage";
import { cropStrip, sliceStage3, stripName, type Strip } from "./slicer/slicer";
import type { StripInput } from "./pipeline";

/** Per-row vertical placement, so a caller can say WHY a crop lost its beams. */
export interface RowPlacement {
  system: number;
  headSp: number;
  belowSp: number;
  musicAbove: number;
  musicBelow: number;
  /** the row's music reaches further than the frame gave it — this is what a clipped crop is */
  clippedBelow: boolean;
  clippedAbove: boolean;
}

export interface SlicedPage {
  /** In manifest order (system, then window) — exactly what `decodeStripsToDoc` wants. */
  strips: StripInput[];
  /** The manifest rows behind them, for anything that wants geometry (W8's highlighting). */
  geometry: Strip[];
  /** one entry per staff row, indexed by `system` */
  placement: RowPlacement[];
  nStaves: number;
  /** The rotation actually applied, in degrees; 0 when both deskew guards declined. */
  skewDeg: number;
  pageWidth: number;
  pageHeight: number;
  skewMs: number;
  totalMs: number;
}

export interface SlicePageOptions {
  /** `phase` is human-readable; `done`/`total` are the skew sweep's steps, absent elsewhere. */
  onProgress?: (phase: string, done?: number, total?: number) => void;
  /**
   * ⚠ DENSE-PAGE EXPERIMENT — set only by `?dense=` in `App.tsx`. Cut a row into more, shorter
   * strips once the estimated label cost passes this many ids. A dense strip whose label needs
   * more ids than the model can emit comes back as silently wrong notes; splitting it costs
   * decode time and nothing else. Delete with the block in `slicer/windows.ts`.
   */
  tokenBudget?: number;
}

let cvReady: Promise<void> | null = null;

/** opencv.js, loaded once per session and only when a page is actually sliced. */
export function ensureCv(): Promise<void> {
  cvReady ??= initCv();
  return cvReady;
}

/**
 * Slice a page image into the crops the model reads.
 *
 * The skew estimate is taken first and separately, then handed to `sliceStage3`. That is not a
 * shortcut around `prepPage` — it is `prepPage`'s own two steps with the event loop let in between
 * (see `slicer.ts`'s `skewDeg` note). It costs one extra full-page rotation on the ~15% of pages
 * that genuinely rotate, against 41 page-wide openings, so it does not show up in the timing.
 */
export async function slicePage(
  url: string,
  stem: string,
  opts: SlicePageOptions = {}
): Promise<SlicedPage> {
  const t0 = performance.now();
  await ensureCv();

  opts.onProgress?.("reading the image");
  const gray = await decodeGray(url);

  const tSkew = performance.now();
  const est = await estimateSkewAsync(gray, (done, total) =>
    opts.onProgress?.("checking the page angle", done, total)
  );
  const skewMs = performance.now() - tSkew;
  const skewDeg = guardedAngle(est);

  // One synchronous block: ink, connected components, staves, rows, barlines, windows. ~1-2 s on a
  // corpus page against the sweep's ~35, so it is not worth splitting — see METRICS-SLICER-PORT.md.
  opts.onProgress?.("finding the staves");
  await paint();
  const res = sliceStage3(gray, { skewDeg, tokenBudget: opts.tokenBudget });

  opts.onProgress?.("cutting the strips");
  await paint();
  const strips: StripInput[] = [];
  for (const r of res.rows)
    for (const s of r.strips)
      strips.push({
        system: s.system,
        window: s.window,
        image: grayToCanvas(cropStrip(r.normalized.row, s)),
        name: stripName(stem, s.system, s.window),
      });

  const placement: RowPlacement[] = res.rows.map((r) => ({
    system: r.system,
    headSp: r.normalized.headSp,
    belowSp: r.normalized.belowSp,
    musicAbove: r.normalized.musicAbove,
    musicBelow: r.normalized.musicBelow,
    clippedBelow: r.normalized.musicBelow > r.normalized.belowSp + 1e-9,
    clippedAbove: r.normalized.musicAbove > r.normalized.headSp + 1e-9,
  }));

  return {
    strips,
    geometry: res.strips,
    placement,
    nStaves: res.staves.length,
    skewDeg: res.skewDeg,
    pageWidth: gray.width,
    pageHeight: gray.height,
    skewMs,
    totalMs: performance.now() - t0,
  };
}

/** Let the browser paint the status line before the next long synchronous stretch. */
function paint(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/** The sweep's step count, re-exported so the UI can size its progress text without the slicer. */
export { SKEW_SWEEP_STEPS };
export type { Gray };
