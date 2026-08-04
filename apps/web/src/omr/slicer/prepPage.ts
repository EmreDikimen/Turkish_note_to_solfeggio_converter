/**
 * The photo/scan preparation stage — `prep_page` (L280) and the deskew it wraps (L211-277).
 *
 * ⚠ This file was planned as a NO-OP seam, on the documented ground that the camera path is
 * inert on clean input. That is TRUE of the perspective crop and FALSE of the deskew, and the
 * difference was found by measuring the port against the corpus rather than by reading the code:
 * scanned pages in `data/real/strips_v2` carry a real 0.3-1° scanner skew, and skipping the
 * rotation cost whole systems (one page went 10 staves -> 0). See docs/mvp/slicer-port.md.
 *
 * So the deskew IS ported and the perspective crop is not:
 *
 *   - `crop_to_page` / `detect_page_quad` — guarded to a no-op whenever the page already fills the
 *     frame, which every screenshot and flat scan does. Still the camera seam; slots in below.
 *   - `estimate_skew` / `deskew` — ported in full. Guarded by a 0.3° deadband and a "must buy >= 3
 *     more staff-line rows" gate, so an axis-aligned screenshot still passes through untouched;
 *     it just is not the corpus we validate against.
 *
 * Transliterated line by line. Do not restructure — see docs/mvp/slicer-port.md.
 */
import { pyRound } from "./constants";
import { binarizeInk, openHorizontal, resizeScale, rotate, type Gray } from "./cvOps";
import { clusterRows } from "./staves";

// ---- deskew (L219-221) -------------------------------------------------------------------------
export const SKEW_MAX_DEG = 7.0; // search range; beyond this it is perspective/curl
export const SKEW_DEADBAND_DEG = 0.3; // don't rotate an essentially-straight page
export const SKEW_MIN_GAIN = 3; // ... and only if it buys >= this many more staff-line rows

/**
 * `_qualifying_line_rows` (L223): how many clustered staff-line rows `detect_staves` would see.
 *
 * Its `len < 2` gate is the 0-staff cliff, so this is the exact signal the skew search maximises —
 * not a proxy for it. Note the kernel is the OLD long `w // 4`, deliberately: here intolerance
 * sharpens the angle peak, where `detect_staves` wants sensitivity and uses STAFF_HOR_FRAC.
 */
export function qualifyingLineRows(gray: Gray): number {
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

/** `np.arange(start, stop, step)` — value i is `start + i * step`, count from the half-open range. */
function arange(start: number, stop: number, step: number): number[] {
  const n = Math.max(0, Math.ceil((stop - start) / step));
  return Array.from({ length: n }, (_, i) => start + i * step);
}

export interface SkewEstimate {
  angle: number;
  rowsAtBest: number;
  rowsAtZero: number;
}

/**
 * `estimate_skew` (L237): the angle maximizing the qualifying-staff-line-row count.
 *
 * Estimated NEAR full resolution on purpose (L240-243): staff lines are ~1 px thin, so aggressive
 * downscaling blurs them below the opening threshold and the signal collapses — a 1500 -> 1000 px
 * shrink turned a clean +0.5°/8-row estimate into a garbage +7.5°/2-row one. Only genuinely large
 * uploads are shrunk, capped at 1600 px wide.
 */
export function estimateSkew(gray: Gray): SkewEstimate {
  let small = gray;
  if (gray.width > 2400) {
    const s = 1600.0 / gray.width;
    small = resizeScale(gray, s, s);
  }

  const rowsAt = (a: number): number =>
    a === 0.0 ? qualifyingLineRows(small) : qualifyingLineRows(rotate(small, a));

  // Python compares (rows, angle) TUPLES, so ties on the row count are broken by the larger angle,
  // and `max` keeps the first strictly-greater item. Both details are reproduced here.
  const better = (n: number, a: number, bn: number, ba: number) => n > bn || (n === bn && a > ba);

  const rows0 = rowsAt(0.0);
  let bestN = -1;
  let bestA = -Infinity;
  for (const a of arange(-SKEW_MAX_DEG, SKEW_MAX_DEG + 0.01, 0.5)) {
    const n = rowsAt(a);
    if (better(n, a, bestN, bestA)) {
      bestN = n;
      bestA = a;
    }
  }
  let fineN = bestN;
  let fineA = bestA;
  for (const a of arange(bestA - 0.5, bestA + 0.501, 0.1)) {
    const n = rowsAt(a);
    if (better(n, a, fineN, fineA)) {
      fineN = n;
      fineA = a;
    }
  }
  // `max(fine + [(best_n, best_a)])` — the coarse winner is re-added and can win a tie on angle
  if (better(bestN, bestA, fineN, fineA)) {
    fineN = bestN;
    fineA = bestA;
  }
  return { angle: pyRound(fineA * 100) / 100, rowsAtBest: fineN, rowsAtZero: rows0 };
}

/**
 * `deskew` (L266): rotate so the staves are axis-aligned, or return the page untouched.
 *
 * A clean scan or screenshot falls through both guards, which is why an axis-aligned upload is
 * bit-identical with and without this stage.
 */
export function deskew(gray: Gray, est: SkewEstimate): { gray: Gray; angle: number } {
  const { angle, rowsAtBest, rowsAtZero } = est;
  if (Math.abs(angle) < SKEW_DEADBAND_DEG || rowsAtBest < rowsAtZero + SKEW_MIN_GAIN)
    return { gray, angle: 0.0 };
  return { gray: rotate(gray, angle), angle };
}

export interface PrepResult {
  gray: Gray;
  cropped: boolean;
  skewDeg: number;
}

/**
 * `prep_page` (L280) restricted to the inputs the MVP accepts: perspective crop skipped, deskew run.
 *
 * Python's crop-then-compare branch (L286-294) collapses to the `did_crop = False` arm, so the
 * estimate is taken on the page itself — exactly what the Python does when `crop_to_page` no-ops.
 */
export function prepPage(gray: Gray): PrepResult {
  const est = estimateSkew(gray);
  const { gray: page, angle } = deskew(gray, est);
  return { gray: page, cropped: false, skewDeg: angle };
}

/**
 * `prep_page` with the angle supplied instead of searched for — PARITY HARNESS ONLY.
 *
 * `estimate_skew` is ~35 of the ~37 s a page costs in the browser (41 rotations, each with a
 * page-wide morphological opening), which would put a full-corpus parity run at ~18 h. Passing in
 * the angle Python already found lets everything downstream of it be checked over all 1,704 pages,
 * with the estimator validated separately on a sample. It short-circuits a MEASUREMENT, not the
 * product: `prepPage` above is what the app calls.
 */
export function prepPageWithAngle(gray: Gray, angle: number): PrepResult {
  if (angle === 0) return { gray, cropped: false, skewDeg: 0 };
  return { gray: rotate(gray, angle), cropped: false, skewDeg: angle };
}
