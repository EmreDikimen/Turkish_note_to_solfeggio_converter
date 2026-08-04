/**
 * The slicer driver — `page_to_strips` (L961), minus every filesystem write and the debug overlay.
 *
 * W4 builds the first half of it: page -> ink -> label map -> staves -> normalized rows. Barlines
 * (W5) and windowing (W6) plug into the loop below, which is why the page-level work is already
 * factored the way Python has it: ONE `binarize_ink` and ONE `connectedComponents` for the whole
 * page, reused by every row.
 */
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
