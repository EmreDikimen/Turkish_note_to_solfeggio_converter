/**
 * Barline detection — `_longest_vertical_run` (L474), `_is_thin_stroke` (L485), `_cluster_cols`
 * (L521), `_terminal_overshoot` (L544), `detect_barlines` (L592), `_has_notehead` (L679).
 *
 * A barline is what survives three tests that a stem, a notehead or a G-clef fails: it runs
 * unbroken from the top staff line to the bottom one (CONTINUITY), it is thin at every height
 * inside the staff (THINNESS), and it stops at or just past the outer lines with nothing fat
 * attached (TERMINATION). The long docstrings on the Python functions explain why each gate is
 * shaped the way it is; they are not repeated here, only pointed at.
 *
 * Transliterated line by line. Do not restructure — see docs/mvp/slicer-port.md, which names the
 * hazards in here specifically: `_is_thin_stroke`'s staff-row `continue` that does NOT reset the
 * run, `_terminal_overshoot`'s four-variable inner walk, the per-ROW `binarize_ink` calls that must
 * not be hoisted, and `pyRound` at every rounding site (`30 * 0.35` and `30 * 0.75` are exactly
 * 10.5 and 22.5, where `Math.round` would silently retune gates 1 and 2).
 */
import {
  BAR_FADE_SP,
  EXT_SP,
  OV_TOL_SP,
  STAFF_SPAN,
  TARGET_SPACING,
  TOP_LINE_Y,
  WIDE_BEYOND_SP,
  WIDE_NEAR_SP,
  BLOB_SKIP_LINE,
  BLOB_LINE_FILL,
  STAFF_ROW_POS_SP,
  WIDE_RUN_SP,
  pyRound,
} from "./constants";
import { binarizeInk, type Gray } from "./cvOps";
import type { Staff } from "./staves";

/** A boolean image — numpy's `mask > 0`. 1 = ink, and `data[y * width + x]`. */
export interface Mask {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * `binarize_ink(row)[y0:y1] > 0`.
 *
 * Bounds are clamped, which matches numpy for the upper end and is unreachable at the lower end:
 * `top_y` is 99..138 across the whole adaptive placement range and `ext` is 75, so `top - ext` is
 * 24..63. (A negative start would WRAP in numpy rather than clamp, so this is worth knowing if
 * `EXT_SP` or `VPLACE_MIN_HEAD_SP` is ever changed — the constant's own comment at L88 makes the
 * same argument from the other end.)
 */
export function inkMask(
  gray: Gray,
  y0: number,
  y1: number,
  binarize: (g: Gray) => Gray = binarizeInk
): Mask {
  const ink = binarize(gray);
  const a = Math.max(0, Math.min(gray.height, y0));
  const b = Math.max(a, Math.min(gray.height, y1));
  const w = gray.width;
  const data = new Uint8Array((b - a) * w);
  for (let i = 0, src = a * w; src < b * w; i++, src++) data[i] = ink.data[src] ? 1 : 0;
  return { data, width: w, height: b - a };
}

/** `mask[y0:y1]` — a row range. Shares the buffer, like the numpy view it stands for. */
function maskRows(m: Mask, y0: number, y1: number): Mask {
  const a = Math.max(0, Math.min(m.height, y0));
  const b = Math.max(a, Math.min(m.height, y1));
  return { data: m.data.subarray(a * m.width, b * m.width), width: m.width, height: b - a };
}

/** `_longest_vertical_run` (L474): per column, the longest UNBROKEN run of ink. */
export function longestVerticalRun(band: Mask): Int32Array {
  return longestVerticalRunWithEnds(band).best;
}

/**
 * `_longest_vertical_run(..., with_ends=True)` (L474): the same run, plus the first and last row it
 * occupies — what `BAR_FADE_SP` needs to ask WHERE a stroke sits rather than only how long it is.
 *
 * ⚠ `start`/`end` update only where the run is STRICTLY longer than the best so far, matching the
 * numpy `run > best`. On a tie the FIRST such run keeps the ends, and a faded barline's two halves
 * are often exactly equal in length — swapping this to `>=` silently picks the lower half and moves
 * the candidate.
 */
export function longestVerticalRunWithEnds(band: Mask): {
  best: Int32Array;
  start: Int32Array;
  end: Int32Array;
} {
  const w = band.width;
  const run = new Int32Array(w);
  const best = new Int32Array(w);
  const start = new Int32Array(w);
  const end = new Int32Array(w);
  for (let y = 0; y < band.height; y++) {
    const off = y * w;
    for (let x = 0; x < w; x++) {
      const r = band.data[off + x] ? run[x]! + 1 : 0; // reset to 0 where there's no ink
      run[x] = r;
      if (r > best[x]!) {
        best[x] = r;
        end[x] = y;
        start[x] = y - r + 1;
      }
    }
  }
  return { best, start, end };
}

/**
 * `_is_thin_stroke` (L485): true if the vertical stroke at column `x` is a BARLINE, not a note.
 *
 * ⚠ `skipRows` marks the horizontal STAFF-LINE rows, and they are `continue`d over **without
 * resetting `run`** — they neither count as fat nor break a run. Getting that wrong silently
 * changes what counts as a barline.
 */
export function isThinStroke(
  band: Mask,
  x: number,
  fatW: number,
  fatRun: number,
  skipRows: Uint8Array
): boolean {
  const r = Math.trunc(TARGET_SPACING); // search ±1 line-space horizontally
  const lo = Math.max(0, x - r);
  const hi = Math.min(band.width, x + r + 1); // numpy clamps the slice; so do we
  const subW = hi - lo;
  const c = x - lo; // center column within the window
  let run = 0;
  for (let y = 0; y < band.height; y++) {
    if (skipRows[y]) continue; // staff line: ignore, don't reset the run
    const off = y * band.width;
    if (!band.data[off + lo + c]) {
      run = 0;
      continue;
    }
    let l = c;
    while (l > 0 && band.data[off + lo + l - 1]) l--;
    let rt = c;
    while (rt < subW - 1 && band.data[off + lo + rt + 1]) rt++;
    run = rt - l + 1 >= fatW ? run + 1 : 0;
    if (run >= fatRun) return false; // a notehead-tall fat blob is attached
  }
  return true;
}

/**
 * `_cluster_cols` (L521): cluster nearby candidate columns; `[center, testCol]` per cluster.
 *
 * A double/thick barline's cluster CENTER can land in the blank gap between its strokes, so gate 3
 * runs on `testCol` — the member column with the longest vertical run.
 */
export function clusterCols(
  xs: ArrayLike<number>,
  longest: Int32Array,
  gap: number
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (xs.length === 0) return out;
  // Python's `max(members, key=...)` keeps the FIRST maximum on a tie; a strict `>` does the same.
  const bestOf = (members: number[]) => {
    let b = members[0]!;
    for (const c of members) if (longest[c]! > longest[b]!) b = c;
    return b;
  };
  let start = xs[0]!;
  let prev = xs[0]!;
  let members: number[] = [xs[0]!];
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i]!;
    if (x - prev > gap) {
      out.push([Math.floor((start + prev) / 2), bestOf(members)]);
      start = x;
      members = [];
    }
    members.push(x);
    prev = x;
  }
  out.push([Math.floor((start + prev) / 2), bestOf(members)]);
  return out;
}

/**
 * `_terminal_overshoot` (L544): how far the stroke at column `x` continues PAST the outer staff
 * lines, and whether the overshoot carries anything wide.
 *
 * ⚠ The inner walk carries four state variables with four different reset rules — `ov` updates only
 * on inked rows, `run` resets on a blank row, `gapRows > 1` breaks, and `isWide` LATCHES once set.
 * docs/mvp/slicer-port.md calls it the fiddliest 46 lines in the file, and it is what separates a
 * barline from a G-clef.
 *
 * Returns `[ovTop, ovBot, wideBeyond]`.
 */
export function terminalOvershoot(bandExt: Mask, x: number, ext: number): [number, number, boolean] {
  const h = bandExt.height;
  const w = bandExt.width;
  const lo = Math.max(0, x - 3);
  const hi = Math.min(w, x + 4);
  const topI = ext;
  const botI = ext + STAFF_SPAN; // outer staff-line rows in bandExt
  const wide = pyRound(TARGET_SPACING * WIDE_BEYOND_SP);
  const wideRun = Math.max(2, pyRound(TARGET_SPACING * WIDE_RUN_SP));
  const wideNear = pyRound(TARGET_SPACING * WIDE_NEAR_SP);
  // rows that ARE the staff line — looked through, never counted as an attachment. See
  // BLOB_SKIP_LINE; this is gate 2's staff-row test at the same fill, on the wider band.
  const lineRows = new Uint8Array(h);
  if (BLOB_SKIP_LINE) {
    for (let y = 0; y < h; y++) {
      const off = y * w;
      let s = 0;
      for (let i = 0; i < w; i++) s += bandExt.data[off + i]!;
      lineRows[y] = s > w * BLOB_LINE_FILL ? 1 : 0;
    }
  }

  const walk = (yStart: number, step: number, yEnd: number): [number, boolean] => {
    let ov = 0;
    let gapRows = 0;
    let run = 0;
    let isWide = false;
    let y = yStart + step;
    while (y !== yEnd) {
      const off = y * w;
      let first = -1; // `lo + np.argmax(seg)` — the first inked column of the window
      for (let i = lo; i < hi; i++) {
        if (bandExt.data[off + i]) {
          first = i;
          break;
        }
      }
      if (first >= 0 && lineRows[y]) {
        ov = Math.abs(y - yStart); // the staff line — look straight through it
        gapRows = 0;
      } else if (first >= 0) {
        ov = Math.abs(y - yStart);
        gapRows = 0;
        // connected horizontal width through the stroke at this overshoot row
        let l = first;
        while (l > 0 && bandExt.data[off + l - 1]) l--;
        let rt = first;
        while (rt < w - 1 && bandExt.data[off + rt + 1]) rt++;
        run = rt - l + 1 >= wide ? run + 1 : 0;
        if (run >= wideRun && ov <= wideNear) isWide = true;
      } else {
        gapRows++;
        run = 0;
        if (gapRows > 1) break;
      }
      y += step;
    }
    return [ov, isWide];
  };

  const [ovTop, wideTop] = walk(topI, -1, -1);
  const [ovBot, wideBot] = walk(botI, +1, h);
  return [ovTop, ovBot, wideTop || wideBot];
}

/** Rejected candidates, `(x, reason)` — what the `_debug.png` overlay colour-codes. */
export interface BarlineDebug {
  rejects: Array<[number, string]>;
}

/**
 * `detect_barlines` (L592): real barlines by CONTINUITY + THINNESS + CLEAN TERMINATION.
 *
 * Gate 2 tests the cluster CENTER (a smudged bar's longest-run column can sit inside the smudge and
 * read fat); gate 3 tests the longest-run member column, since the walk needs actual stroke ink.
 * Returns barline x's in row coordinates, always including the staff's own two ends.
 */
export function detectBarlines(
  row: Gray,
  staff: Staff,
  scale: number,
  debugInfo: BarlineDebug | null = null,
  topY: number = TOP_LINE_Y,
  binarize: (g: Gray) => Gray = binarizeInk
): number[] {
  const top = topY;
  const bot = topY + STAFF_SPAN;
  const tol = Math.max(3, pyRound(TARGET_SPACING * 0.35)); // ~1/3 line-space slack
  const ext = pyRound(TARGET_SPACING * EXT_SP);
  const bandExt = inkMask(row, top - ext, bot + ext, binarize); // staff ± EXT_SP (gate 3)
  const band = maskRows(bandExt, ext - tol, ext + STAFF_SPAN + tol); // staff ± tol (gates 1-2)
  const span = band.height;
  const w = band.width;

  const { best: longest, start: runTop, end: runBot } = longestVerticalRunWithEnds(band);
  // ink at/above the top staff line, and at/below the bottom one
  const touchesTop = new Uint8Array(w);
  const touchesBot = new Uint8Array(w);
  for (let y = 0; y < Math.min(2 * tol, span); y++) {
    const off = y * w;
    for (let x = 0; x < w; x++) if (band.data[off + x]) touchesTop[x] = 1;
  }
  for (let y = Math.max(0, span - 2 * tol); y < span; y++) {
    const off = y * w;
    for (let x = 0; x < w; x++) if (band.data[off + x]) touchesBot[x] = 1;
  }
  // `longest >= span * 0.85` compares an int run length against a FLOAT — keep it a float compare
  const minRun = span * 0.85;
  // ... OR a stroke that RUNS BETWEEN the two staff lines but has faded at one end. The staff lines
  // sit at band rows `tol` and `tol + STAFF_SPAN`; a fade may eat BAR_FADE_SP of a line-space off
  // either end. See BAR_FADE_SP — this only ADDS candidates.
  const fade = BAR_FADE_SP > 0 ? pyRound(TARGET_SPACING * BAR_FADE_SP) : 0;
  const xs: number[] = [];
  for (let x = 0; x < w; x++) {
    let isBar = longest[x]! >= minRun && touchesTop[x] !== 0 && touchesBot[x] !== 0;
    if (!isBar && BAR_FADE_SP > 0) {
      isBar =
        longest[x]! >= STAFF_SPAN - 2 * fade &&
        runTop[x]! <= tol + fade &&
        runBot[x]! >= tol + STAFF_SPAN - fade;
    }
    if (isBar) xs.push(x);
  }
  const clusters = clusterCols(xs, longest, Math.max(4, Math.trunc(TARGET_SPACING * 0.6)));
  const rejects: Array<[number, string]> | null = debugInfo !== null ? [] : null;

  // gate 2: reject any candidate carrying a NOTEHEAD-tall fat blob inside the staff band, keeping
  // thick/repeat barlines and lines notes merely touch. Staff-line rows ink every column and are
  // skipped.
  const staffRows = new Uint8Array(span);
  for (let y = 0; y < span; y++) {
    const off = y * w;
    let s = 0;
    for (let x = 0; x < w; x++) s += band.data[off + x]!;
    staffRows[y] = s > w * 0.4 ? 1 : 0;
  }
  if (STAFF_ROW_POS_SP > 0) {
    // ... and a staff row must sit ON a staff line. See STAFF_ROW_POS_SP.
    const th = Math.max(2, pyRound(TARGET_SPACING * STAFF_ROW_POS_SP));
    const onLine = new Uint8Array(span);
    for (let k = 0; k < 5; k++) {
      const c0 = tol + Math.trunc(STAFF_SPAN / 4) * k;
      for (let y = Math.max(0, c0 - th); y <= Math.min(span - 1, c0 + th); y++) onLine[y] = 1;
    }
    for (let y = 0; y < span; y++) if (!onLine[y]) staffRows[y] = 0;
  }
  const fatW = pyRound(TARGET_SPACING * 0.75); // wider than a thick barline core
  const fatRun = pyRound(TARGET_SPACING * 0.5); // ~a notehead's height
  const ovTolPx = pyRound(TARGET_SPACING * OV_TOL_SP);
  let bars: number[] = [];
  for (const [center, testCol] of clusters) {
    if (!isThinStroke(band, center, fatW, fatRun, staffRows)) {
      rejects?.push([center, "gate2_fat"]);
      continue;
    }
    const [ovTop, ovBot, wideBeyond] = terminalOvershoot(bandExt, testCol, ext);
    if (ovTop > ovTolPx && ovBot > ovTolPx) {
      rejects?.push([center, "gate3_clef"]); // extends both ways: clef
      continue;
    }
    // A NOTEHEAD ATTACHED PAST A STAFF LINE MEANS STEM, however little the stroke overshoots
    // (owner, 2026-08-24). `wideBeyond` always found it; the gate used to ignore it unless the
    // overshoot also passed OV_TOL_SP, so a stem clearing the line by 14 px against a 15 px
    // tolerance was taken as a barline — and on the Meltem page the REAL barline was rejected
    // while the stem beside it was kept. Measured against SymbTr truth (score_slicer, 124 rows):
    // rows whose measure count matches the print go 73 -> 86, regressed unchanged at 11. The cost
    // is a real barline a notehead merely TOUCHES, which the ±3 px walk cannot tell from an
    // attachment — rare, and a trade the owner took deliberately. docs/METRICS-SLICER.md.
    if ((ovTop > 0 || ovBot > 0) && wideBeyond) {
      rejects?.push([center, "gate3_blob"]); // head/flag/beam past a line
      continue;
    }
    bars.push(center);
  }

  const x0 = Math.trunc(staff.x0 * scale);
  const x1 = Math.trunc(staff.x1 * scale);
  if (rejects !== null) {
    for (const b of bars) if (!(x0 - 5 <= b && b <= x1 + 5)) rejects.push([b, "xrange"]);
  }
  bars = bars.filter((b) => x0 - 5 <= b && b <= x1 + 5);
  // the staff's own left/right ends are measure boundaries even if unlined. SNAP a detected bar
  // near an end onto the end itself (never leave the clef/signature left of measure 0, nor a
  // sliver); otherwise add the end as a synthetic boundary.
  const endTol = pyRound(TARGET_SPACING * 0.7);
  if (bars.length && bars[0]! <= x0 + endTol) {
    bars[0] = Math.min(bars[0]!, x0);
  } else {
    bars = [x0, ...bars];
  }
  if (bars[bars.length - 1]! >= x1 - endTol) {
    bars[bars.length - 1] = Math.max(bars[bars.length - 1]!, x1);
  } else {
    bars = [...bars, x1];
  }
  if (debugInfo !== null) debugInfo.rejects = rejects!;
  return bars;
}

/**
 * `_has_notehead` (L679): any notehead-fat blob in columns `[xa, xb)`?
 *
 * Same fat semantics as `isThinStroke` — a connected horizontal run >= 0.75 sp wide sustained over
 * >= 0.5 sp of consecutive rows. Signature accidentals stay under it (a flat's bowl is ~0.55 sp),
 * repeat dots far under. Consumed by `window_measures` (W6), which is what decides whether a row's
 * clef+signature prefix is music or furniture.
 *
 * ⚠ `binarize_ink` runs on the WHOLE row here and the slice is taken afterwards — a different Otsu
 * from `detectBarlines`' own. Do not hoist the two into one.
 */
export function hasNotehead(
  row: Gray,
  xa: number,
  xb: number,
  topY: number = TOP_LINE_Y,
  binarize: (g: Gray) => Gray = binarizeInk
): boolean {
  const sp = TARGET_SPACING;
  const fatW = pyRound(sp * 0.75);
  const fatRun = pyRound(sp * 0.5);
  if (xb - xa < fatW) return false;
  const y0 = Math.max(0, Math.trunc(topY - 1.5 * sp));
  const y1 = Math.min(row.height, Math.trunc(topY + STAFF_SPAN + 1.5 * sp));
  const full = inkMask(row, y0, y1, binarize);
  const ca = Math.max(0, Math.min(row.width, xa));
  const cb = Math.max(ca, Math.min(row.width, xb));
  const bw = cb - ca;
  if (bw <= 0) return false;
  let run = 0;
  for (let y = 0; y < full.height; y++) {
    const off = y * full.width + ca;
    let s = 0;
    for (let x = 0; x < bw; x++) s += full.data[off + x]!;
    if (s > bw * 0.9) continue; // staff lines ink the whole slice
    let best = 0;
    let cur = 0;
    for (let x = 0; x < bw; x++) {
      cur = full.data[off + x] ? cur + 1 : 0;
      if (cur > best) best = cur;
    }
    run = best >= fatW ? run + 1 : 0;
    if (run >= fatRun) return true;
  }
  return false;
}
