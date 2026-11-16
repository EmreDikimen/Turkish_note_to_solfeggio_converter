/**
 * The photo/scan preparation stage — `prep_page` (L280) and the deskew it wraps (L211-277).
 *
 * ⚠ This file was planned as a NO-OP seam, on the documented ground that the camera path is
 * inert on clean input. That is TRUE of the perspective crop and FALSE of the deskew, and the
 * difference was found by measuring the port against the corpus rather than by reading the code:
 * scanned pages in `data/real/strips_v2` carry a real 0.3-1° scanner skew, and skipping the
 * rotation cost whole systems (one page went 10 staves -> 0). See docs/archive/phases/slicer-port.md.
 *
 * So the deskew IS ported and the perspective crop is not:
 *
 *   - `crop_to_page` / `detect_page_quad` — guarded to a no-op whenever the page already fills the
 *     frame, which every screenshot and flat scan does. Still the camera seam; slots in below.
 *   - `estimate_skew` / `deskew` — ported in full. Guarded by a 0.3° deadband and a "must buy >= 3
 *     more staff-line rows" gate, so an axis-aligned screenshot still passes through untouched;
 *     it just is not the corpus we validate against.
 *
 * Transliterated line by line. Do not restructure — see docs/archive/phases/slicer-port.md.
 */
import {
  FRAME_BAND,
  FRAME_GROW_PX,
  FRAME_MIN_FULL_PX,
  FRAME_MIN_RING,
  FRAME_SIDE_MIN,
  FRAME_SLACK_PX,
  FRAME_STRAIGHT,
  FRAME_WHITEN,
  pyRound,
} from "./constants";
import {
  binarizeInk,
  dilateSquare,
  openHorizontalRowSums,
  otsuLevel,
  resizeScale,
  rotate,
  type Gray,
} from "./cvOps";
import { clusterRows, pageBinarizer } from "./staves";

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
export function qualifyingLineRows(gray: Gray, binarize: (g: Gray) => Gray = binarizeInk): number {
  const ink = binarize(gray);
  const horLen = Math.max(20, Math.floor(gray.width / 4));
  // The row sums of `openHorizontal(ink, horLen)`, computed in closed form instead of by running
  // the morphology — an exact substitution that removes the single most expensive call in the
  // 41-rotation sweep. Why it is exact, and the border rule that makes it non-obvious, are in
  // `openHorizontalRowSums`; `npm run check:deskew` holds the two to being identical.
  const rowInk = openHorizontalRowSums(ink, horLen);
  const h = gray.height;
  const w = gray.width;
  let maxRow = 0;
  for (let y = 0; y < h; y++) if (rowInk[y]! > maxRow) maxRow = rowInk[y]!;
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

/** `qualifyingLineRows` evaluations one estimate costs: 1 at zero + 29 coarse + 11 fine. */
export const SKEW_SWEEP_STEPS = 41;

/**
 * `estimate_skew` (L237): the angle maximizing the qualifying-staff-line-row count.
 *
 * Estimated NEAR full resolution on purpose (L240-243): staff lines are ~1 px thin, so aggressive
 * downscaling blurs them below the opening threshold and the signal collapses — a 1500 -> 1000 px
 * shrink turned a clean +0.5°/8-row estimate into a garbage +7.5°/2-row one. Only genuinely large
 * uploads are shrunk, capped at 1600 px wide.
 *
 * ⚠ It is a **generator**, and that is the one structural liberty taken with this file. Each
 * `yield` sits immediately after a `rowsAt` call, so the loops still read line for line against the
 * Python. The reason is W7: the sweep is ~35 s of unbroken main-thread work, which freezes the tab
 * and paints no progress. `estimateSkew` below drives it to completion synchronously (what the
 * parity harness measures), `estimateSkewAsync` drives it a step at a time and hands the event loop
 * back between rotations. ONE search, two drivers — an async copy of this code is exactly the
 * duplication CLAUDE.md warns about, and the two would drift under a retune.
 */
function* skewSearch(gray: Gray): Generator<number, SkewEstimate, void> {
  let small = gray;
  if (gray.width > 2400) {
    const s = 1600.0 / gray.width;
    small = resizeScale(gray, s, s);
  }

  // decided once; the choice is a property of the page, not of the rotation (see `pageBinarizer`)
  const binz = pageBinarizer(small);
  const rowsAt = (a: number): number =>
    a === 0.0 ? qualifyingLineRows(small, binz) : qualifyingLineRows(rotate(small, a), binz);

  // Python compares (rows, angle) TUPLES, so ties on the row count are broken by the larger angle,
  // and `max` keeps the first strictly-greater item. Both details are reproduced here.
  const better = (n: number, a: number, bn: number, ba: number) => n > bn || (n === bn && a > ba);

  let step = 0;
  const rows0 = rowsAt(0.0);
  yield ++step;
  let bestN = -1;
  let bestA = -Infinity;
  for (const a of arange(-SKEW_MAX_DEG, SKEW_MAX_DEG + 0.01, 0.5)) {
    const n = rowsAt(a);
    yield ++step;
    if (better(n, a, bestN, bestA)) {
      bestN = n;
      bestA = a;
    }
  }
  let fineN = bestN;
  let fineA = bestA;
  for (const a of arange(bestA - 0.5, bestA + 0.501, 0.1)) {
    const n = rowsAt(a);
    yield ++step;
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

/** The sweep, run to completion on this thread — `estimate_skew`'s own signature. */
export function estimateSkew(gray: Gray): SkewEstimate {
  const it = skewSearch(gray);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/**
 * The same sweep, yielding to the event loop between rotations so the UI paints (W7).
 *
 * Identical output by construction — same generator, driven differently. The `setTimeout(0)` per
 * step costs ~4 ms under the browser's nested-timer clamp, i.e. ~0.2 s on a ~35 s search, and it is
 * what turns a frozen tab into a progress line.
 */
export async function estimateSkewAsync(
  gray: Gray,
  onStep?: (done: number, total: number) => void
): Promise<SkewEstimate> {
  const it = skewSearch(gray);
  for (let r = it.next(); ; r = it.next()) {
    if (r.done) return r.value;
    onStep?.(r.value, SKEW_SWEEP_STEPS);
    await new Promise((res) => setTimeout(res, 0));
  }
}

/**
 * `deskew`'s two guards (L267-269), without the rotation: the angle that will actually be applied.
 *
 * Split out so a caller that estimates ahead of time (the app, via `estimateSkewAsync`) reaches the
 * same decision as `deskew` rather than re-deriving it. Zero means "leave the page alone".
 */
export function guardedAngle(est: SkewEstimate): number {
  const { angle, rowsAtBest, rowsAtZero } = est;
  if (Math.abs(angle) < SKEW_DEADBAND_DEG || rowsAtBest < rowsAtZero + SKEW_MIN_GAIN) return 0.0;
  return angle;
}

/**
 * `deskew` (L266): rotate so the staves are axis-aligned, or return the page untouched.
 *
 * A clean scan or screenshot falls through both guards, which is why an axis-aligned upload is
 * bit-identical with and without this stage.
 */
export function deskew(gray: Gray, est: SkewEstimate): { gray: Gray; angle: number } {
  const angle = guardedAngle(est);
  if (angle === 0.0) return { gray, angle: 0.0 };
  return { gray: rotate(gray, angle), angle };
}

// ---- the viewer frame of a screenshot — `whiten_frame` -----------------------------------------

/**
 * `_frame_side`: one side's edge runs -> how far to paint on each row; null = not a screenshot.
 *
 * A side with ink at the edge on under FRAME_SIDE_MIN of its rows has no frame (zeros — neither
 * painted nor a veto); a side that has one must have a STRAIGHT one; and an edge-to-edge frame
 * row is painted whole only inside a block of FRAME_MIN_FULL_PX such rows, because a single one
 * can be a staff line. The reasons are beside the Python original.
 */
function frameSide(runs: Int32Array, full: number): Int32Array | null {
  const n = runs.length;
  const out = new Int32Array(n);
  let nonZero = 0;
  for (const r of runs) if (r > 0) nonZero++;
  if (nonZero < FRAME_SIDE_MIN * n) return out;
  const thick = new Uint8Array(n);
  for (let i = 0; i < n; ) {
    if (runs[i]! < full) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && runs[j]! >= full) j++;
    if (j - i >= FRAME_MIN_FULL_PX) thick.fill(1, i, j);
    i = j;
  }
  const part: number[] = [];
  for (const r of runs) if (r > 0 && r < full) part.push(r);
  if (part.length === 0) {
    for (let i = 0; i < n; i++) out[i] = thick[i] ? full : 0;
    return out;
  }
  part.sort((a, b) => a - b);
  const med = part[part.length >> 1]!;
  let near = 0;
  for (const r of part) if (Math.abs(r - med) <= FRAME_SLACK_PX) near++;
  if (near < FRAME_STRAIGHT * part.length) return null;
  for (let i = 0; i < n; i++) out[i] = thick[i] ? full : Math.min(runs[i]!, med + FRAME_SLACK_PX);
  return out;
}

/**
 * `whiten_frame`: paint a screenshot's flat dark viewer frame white. Returns `gray` ITSELF when
 * there is no such frame — which is every scan and every photo, so those stay bit-identical.
 *
 * Why, and why each of the three tests is there, is written once beside the Python original and
 * summarised at `FRAME_WHITEN` in `constants.ts`.
 */
export function whitenFrame(gray: Gray): Gray {
  const { data, width: w, height: h } = gray;
  if (!FRAME_WHITEN || h < 3 || w < 3) return gray;

  const hist = new Int32Array(256);
  for (let x = 0; x < w; x++) {
    hist[data[x]!]!++;
    hist[data[(h - 1) * w + x]!]!++;
  }
  for (let y = 1; y < h - 1; y++) {
    hist[data[y * w]!]!++;
    hist[data[y * w + w - 1]!]!++;
  }
  const ringSize = 2 * w + 2 * (h - 2);

  // 1. the frame colour is the ring's commonest level ON THE INK SIDE of Otsu — a frame on one
  //    side only covers under half the ring, so the outright mode would be the white paper
  const top0 = Math.min(255, Math.floor(otsuLevel(gray)));
  let mode = 0;
  let darkSum = hist[0]!;
  for (let v = 1; v <= top0; v++) {
    darkSum += hist[v]!;
    if (hist[v]! > hist[mode]!) mode = v; // first max, as np.argmax
  }
  if (darkSum === 0) return gray;

  // 2. ... and a real share of the ring is that ONE level
  const lo = Math.max(0, mode - FRAME_BAND);
  const hi = Math.min(255, mode + FRAME_BAND);
  let inBand = 0;
  for (let v = lo; v <= hi; v++) inBand += hist[v]!;
  if (inBand < FRAME_MIN_RING * ringSize) return gray;

  // 3. ... and its inner edge is straight on every side (a photo's desk is not)
  const isBand = (i: number) => data[i]! >= lo && data[i]! <= hi;
  const leftR = new Int32Array(h);
  const rightR = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let a = 0;
    while (a < w && isBand(y * w + a)) a++;
    leftR[y] = a;
    let b = 0;
    while (b < w && isBand(y * w + w - 1 - b)) b++;
    rightR[y] = b;
  }
  const topR = new Int32Array(w);
  const bottomR = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    let a = 0;
    while (a < h && isBand(a * w + x)) a++;
    topR[x] = a;
    let b = 0;
    while (b < h && isBand((h - 1 - b) * w + x)) b++;
    bottomR[x] = b;
  }
  const left = frameSide(leftR, w);
  const right = frameSide(rightR, w);
  const top = frameSide(topR, h);
  const bottom = frameSide(bottomR, h);
  if (!left || !right || !top || !bottom) return gray;

  // only runs that START at an image edge, each capped at its side's median
  const mask = new Uint8Array(w * h);
  let any = false;
  for (let y = 0; y < h; y++) {
    const l = left[y]!;
    const r = right[y]!;
    for (let x = 0; x < l; x++) mask[y * w + x] = 255;
    for (let x = w - r; x < w; x++) mask[y * w + x] = 255;
    if (l > 0 || r > 0) any = true;
  }
  for (let x = 0; x < w; x++) {
    const t = top[x]!;
    const b = bottom[x]!;
    for (let y = 0; y < t; y++) mask[y * w + x] = 255;
    for (let y = h - b; y < h; y++) mask[y * w + x] = 255;
    if (t > 0 || b > 0) any = true;
  }
  if (!any) return gray;

  const grown = dilateSquare({ data: mask, width: w, height: h }, 2 * FRAME_GROW_PX + 1);
  const out = new Uint8Array(data);
  for (let i = 0; i < out.length; i++) if (grown.data[i]! > 0) out[i] = 255;
  return { data: out, width: w, height: h };
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
  // last, as in Python: a rotated page is padded with white and so can never read as framed
  return { gray: whitenFrame(page), cropped: false, skewDeg: angle };
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
  if (angle === 0) return { gray: whitenFrame(gray), cropped: false, skewDeg: 0 };
  return { gray: whitenFrame(rotate(gray, angle)), cropped: false, skewDeg: angle };
}
