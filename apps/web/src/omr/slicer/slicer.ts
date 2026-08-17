/**
 * The slicer driver — `page_to_strips` (L961), minus every filesystem write and the debug overlay.
 *
 * W4 built the first half of it: page -> ink -> label map -> staves -> normalized rows. W5 added
 * per-row barlines, W6 the windowing and the crop spans. The page-level work is factored the way
 * Python has it: ONE `binarize_ink` and ONE `connectedComponents` for the whole page, reused by
 * every row.
 *
 * Crops are returned as spans, not pixels — `cropStrip` cuts one when a caller actually wants it.
 * A 10-system page is ~10 MB of normalized rows, and the parity harness only ever needs geometry.
 */
import { detectBarlines, type BarlineDebug } from "./barlines";
import {
  MIN_STRIP_W,
  PAD_PX,
  TARGET_SPACING,
  TRIM_SHARED_EDGE,
  VPLACE_ADAPTIVE,
  pyRound,
} from "./constants";
import { connectedComponents, subCols, type Gray, type Labels } from "./cvOps";
import { prepPage, prepPageWithAngle } from "./prepPage";
import { normalizeRow, type NormalizedRow } from "./rows";
import { binarizePageInk, detectStaves, type Staff } from "./staves";
import { windowMeasures, type Window } from "./windows";

export interface Stage1Row {
  system: number;
  staff: Staff;
  normalized: NormalizedRow;
}

export interface Stage2Row extends Stage1Row {
  /** `detect_barlines` output — measure boundaries in row coordinates. */
  bars: number[];
  /** Rejected candidates by reason, matching the `_debug.png` overlay. Only when asked for. */
  rejects: Array<[number, string]> | null;
}

export interface Stage1Result {
  page: Gray;
  ink: Gray;
  lab: Labels | null;
  staves: Staff[];
  rows: Stage1Row[];
  cropped: boolean;
  skewDeg: number;
}

export interface Stage1Options {
  /**
   * Skip `estimate_skew`'s 41-rotation sweep and rotate by this angle instead.
   *
   * Two callers, for two different reasons.
   *
   * The parity harness feeds it the angle Python already found: the sweep is ~35 of the ~37 s a
   * page costs in the browser, which puts a full-corpus run at ~18 h on this machine, so
   * short-circuiting it lets staff detection and row normalization be checked over all 1,704 pages
   * with the estimator validated separately on a sample. That one IS a short-circuit.
   *
   * The app (`omr/page.ts`, W7) feeds it the angle THIS code found — `estimateSkewAsync` +
   * `guardedAngle`, the same search and the same two guards, run a step at a time so the tab does
   * not freeze for 35 s. Nothing is skipped and the result is identical; the estimate simply
   * happens before the call instead of inside it.
   */
  skewDeg?: number;
  /** Collect `detect_barlines`' rejected candidates (W5 diagnosis; Python's `--debug` branch). */
  rejects?: boolean;
}

export interface Stage2Result extends Omit<Stage1Result, "rows"> {
  rows: Stage2Row[];
}

/** Everything `page_to_strips` does before `detect_barlines` (L962-980). */
export function sliceStage1(gray: Gray, opts: Stage1Options = {}): Stage1Result {
  const { gray: page, cropped, skewDeg } =
    opts.skewDeg === undefined ? prepPage(gray) : prepPageWithAngle(gray, opts.skewDeg);
  const ink = binarizePageInk(page);
  // one page-level labelling, reused by every row: it is how normalize_row tells THIS row's music
  // (connected to its staff) from a neighbouring system or page furniture
  const lab = VPLACE_ADAPTIVE ? connectedComponents(ink) : null;
  const staves = detectStaves(ink);
  const rows = staves.map((staff, system) => ({
    system,
    staff,
    normalized: normalizeRow(page, staff, lab),
  }));
  return { page, ink, lab, staves, rows, cropped, skewDeg };
}

/** Stage 1 plus `detect_barlines` per row (L982) — everything before `window_measures`. */
export function sliceStage2(gray: Gray, opts: Stage1Options = {}): Stage2Result {
  const s1 = sliceStage1(gray, opts);
  const rows = s1.rows.map((r) => {
    const dbg: BarlineDebug | null = opts.rejects ? { rejects: [] } : null;
    const bars = detectBarlines(
      r.normalized.row,
      r.staff,
      r.normalized.scale,
      dbg,
      r.normalized.topLineY
    );
    return { ...r, bars, rejects: dbg ? dbg.rejects : null };
  });
  return { ...s1, rows };
}

/** One emitted strip: the manifest entry Python writes (L1013-1035), minus the emitter's own keys. */
export interface Strip {
  system: number;
  window: number;
  /** the PADDED crop span in row coordinates — what the PNG actually holds */
  rowX0: number;
  rowX1: number;
  width: number;
  /** [left, right] margin around the measure span; right is NEGATIVE where the edge trim bit */
  pad: [number, number];
  scale: number;
  isRowStart: boolean;
  splitWide: boolean;
  /** row-local 0-based measure indices this strip covers */
  measFrom: number;
  measTo: number;
  nMeasures: number;
  rowMeasures: number;
}

export interface Stage3Row extends Stage2Row {
  windows: Window[];
  strips: Strip[];
}

export interface Stage3Result extends Omit<Stage2Result, "rows"> {
  rows: Stage3Row[];
  strips: Strip[];
}

/**
 * The whole slicer: `page_to_strips` (L961-1041) without the writes and the debug overlay.
 *
 * The pad/trim block is the driver's own and is transliterated with it — the LEFT pad reaches past
 * the enclosing barline so a cut never shaves a stem, and the RIGHT trim gives back exactly what
 * the next strip takes as its left pad, so the two never carry the same pixels (that trim is what
 * closed a measured ~60 pp domain gap on edge barlines). Both reasons are written out at L995-1009.
 */
export function sliceStage3(gray: Gray, opts: Stage1Options = {}): Stage3Result {
  const s2 = sliceStage2(gray, opts);
  const rows: Stage3Row[] = s2.rows.map((r) => {
    const { row, scale, topLineY } = r.normalized;
    const windows = windowMeasures(r.bars, row, topLineY);
    // total measures the row's windows cover (a trimmed clef+sig prefix span is no measure)
    const rowMeasures = windows.length ? Math.max(...windows.map((w) => w.mTo)) + 1 : 0;
    const barSet = new Set(r.bars);
    // w00 gets extra left margin: the clef's leftmost ink can start a few px left of staff.x0.
    // Gutter cuts from _split_wide get NO pad — a pad could re-enter the ink the gutter avoided.
    const pads = windows.map((w, wi) =>
      wi === 0 ? pyRound(TARGET_SPACING * 0.5) : barSet.has(w.x0) ? PAD_PX : 0
    );
    const strips = windows.map((w, wi) => {
      const pl = pads[wi]!;
      let trim =
        TRIM_SHARED_EDGE && wi + 1 < windows.length && windows[wi + 1]!.x0 === w.x1
          ? pads[wi + 1]!
          : 0;
      if (w.x1 - trim - (w.x0 - pl) < MIN_STRIP_W) trim = 0; // never trim below the sliver floor
      const cx0 = Math.max(0, w.x0 - pl);
      const cx1 = Math.min(row.width, w.x1 - trim);
      return {
        system: r.system,
        window: wi,
        rowX0: cx0,
        rowX1: cx1,
        width: cx1 - cx0,
        pad: [w.x0 - cx0, cx1 - w.x1] as [number, number],
        scale,
        isRowStart: wi === 0,
        splitWide: w.splitWide,
        measFrom: w.mFrom,
        measTo: w.mTo,
        nMeasures: w.mTo - w.mFrom + 1,
        rowMeasures,
      };
    });
    return { ...r, windows, strips };
  });
  return { ...s2, rows, strips: rows.flatMap((r) => r.strips) };
}

/** Cut one strip's pixels out of its normalized row — `row[:, cx0:cx1]` (L1011). */
export function cropStrip(row: Gray, s: Strip): Gray {
  return subCols(row, s.rowX0, s.rowX1);
}

/** `f"{stem}_s{si:02d}_w{wi:02d}.png"` (L1012) — the name the stitcher reads positions from. */
export function stripName(stem: string, system: number, window: number): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${stem}_s${pad2(system)}_w${pad2(window)}.png`;
}
