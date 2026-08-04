/**
 * The slicer driver — `page_to_strips` (L961), minus every filesystem write and the debug overlay.
 *
 * W4 built the first half of it: page -> ink -> label map -> staves -> normalized rows. W5 adds
 * per-row barlines. Windowing (W6) plugs into the same loop, which is why the page-level work is
 * already factored the way Python has it: ONE `binarize_ink` and ONE `connectedComponents` for the
 * whole page, reused by every row.
 */
import { detectBarlines, type BarlineDebug } from "./barlines";
import { VPLACE_ADAPTIVE } from "./constants";
import { binarizeInk, connectedComponents, type Gray, type Labels } from "./cvOps";
import { prepPage, prepPageWithAngle } from "./prepPage";
import { normalizeRow, type NormalizedRow } from "./rows";
import { detectStaves, type Staff } from "./staves";

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
   * Parity-harness only, and it exists for a measurement reason: the sweep is ~35 of the ~37 s a
   * page costs in the browser, which puts a full-corpus run at ~18 h on this machine. Feeding it
   * the angle Python already found lets staff detection and row normalization be checked over all
   * 1,704 pages, with the estimator itself validated separately on a sample. Never set in the app.
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
  const ink = binarizeInk(page);
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
