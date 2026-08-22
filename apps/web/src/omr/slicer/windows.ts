/**
 * Windowing — `_span_cap` (L776), `_split_wide` (L786), `window_measures` (L867).
 *
 * A row's barlines give measure spans; this groups consecutive measures into the windows that
 * become strips. Three rails shape the result: at most MEASURES_PER_STRIP measures, never wider
 * than the width cap, never narrower than the sliver floor. The long Python docstrings explain why
 * each rail is there and what it cost to learn; they are pointed at, not repeated.
 *
 * Transliterated line by line. Do not restructure — see docs/mvp/slicer-port.md, which names the
 * hazards in here: `_split_wide`'s `sorted(set(cuts))` collapsing two targets onto one gutter
 * (the escalation loop depends on it), Python's `min(near)` comparing TUPLES, and `binarize_ink`
 * running on the ROW again here rather than being hoisted.
 *
 * **Budget mode is not ported** (docs/mvp/slicer-port.md): it ships OFF as a measured wash, and
 * dropping it removes `window_measures`' whole `cost()` threading — `est_tokens`/`budget_risk` are
 * manifest bookkeeping for the Rung-3 emitter and never move a crop boundary in legacy mode.
 */
import {
  COST_PER_INK_COL,
  COST_PER_STEM,
  COST_ROW_START,
  MAX_STRIP_W,
  MEASURES_PER_STRIP,
  MIN_STRIP_W,
  STAFF_SPAN,
  TARGET_SPACING,
  TOP_LINE_Y,
  pyRound,
} from "./constants";
import { hasNotehead, inkMask } from "./barlines";
import type { Gray } from "./cvOps";

/** `Window` (L850): a strip window's pixel span plus the row-local measures it covers. */
export interface Window {
  x0: number;
  x1: number;
  /** 0-based inclusive indices into the row's bar-to-bar spans. */
  mFrom: number;
  mTo: number;
  /** a FRAGMENT of one over-wide measure, cut at a whitespace gutter. */
  splitWide: boolean;
}

/**
 * `_span_cap` (L776): the width budget for a window SPAN, leaving room for the pad the driver adds
 * on its left. The cap has to hold on the emitted crop, not on the pre-pad span.
 */
export function spanCap(): number {
  return MAX_STRIP_W - pyRound(TARGET_SPACING * 0.5);
}

/**
 * `_split_wide` (L786): split an over-wide span at whitespace GUTTERS only.
 *
 * Cuts may only land on columns with zero symbol ink — a cut through a notehead or beam puts half
 * the symbol in each neighbouring strip and the model decodes it twice.
 */
export function splitWide(
  row: Gray,
  x0: number,
  x1: number,
  topY: number = TOP_LINE_Y
): Array<[number, number]> {
  const cap = spanCap();
  if (x1 - x0 <= cap) return [[x0, x1]];
  const sp = TARGET_SPACING;
  const y0 = Math.max(0, Math.trunc(topY - 2.0 * sp)); // cover ledger notes above ...
  const y1 = Math.min(row.height, Math.trunc(topY + STAFF_SPAN + 2.0 * sp)); // ... and beams below
  // ⚠ this is the row's OWN Otsu — a third `binarize_ink` call, not the one detect_barlines ran
  const band = inkMask(row, y0, y1);
  const w = band.width;
  // per-column ink with the full-width staff-line rows excluded (`band[~staff_rows].sum(axis=0)`)
  const ink = new Int32Array(w);
  for (let y = 0; y < band.height; y++) {
    const off = y * w;
    let rowSum = 0;
    for (let x = 0; x < w; x++) rowSum += band.data[off + x]!;
    if (rowSum > w * 0.4) continue; // staff lines ink every column
    for (let x = 0; x < w; x++) if (band.data[off + x]) ink[x]!++;
  }

  // maximal zero-ink runs (gutters) strictly inside the span
  const margin = Math.trunc(2 * sp);
  const gutters: Array<[number, number]> = []; // (center, width)
  let g0: number | null = null;
  for (let x = x0 + margin; x < x1 - margin; x++) {
    if (ink[x] === 0) {
      if (g0 === null) g0 = x;
    } else if (g0 !== null) {
      gutters.push([Math.floor((g0 + x - 1) / 2), x - g0]);
      g0 = null;
    }
  }
  if (g0 !== null) gutters.push([Math.floor((g0 + x1 - margin - 1) / 2), x1 - margin - g0]);

  const cutInto = (n: number): Array<[number, number]> => {
    const cuts: number[] = [x0];
    for (let k = 1; k < n; k++) {
      const target = x0 + Math.floor(((x1 - x0) * k) / n);
      // Python's `min(near)` compares the (score, column) TUPLES, so a score tie is broken by the
      // smaller column — JS needs that second key written out.
      let best: [number, number] | null = null;
      for (const [c, gw] of gutters) {
        if (Math.abs(c - target) >= (x1 - x0) / (2 * n)) continue; // stay near the even split
        const score = Math.abs(c - target) - 2 * gw; // closest, wide gutters preferred
        if (best === null || score < best[0] || (score === best[0] && c < best[1])) best = [score, c];
      }
      if (best !== null) {
        cuts.push(best[1]);
      } else {
        // no gutter: least-ink column
        const ww = Math.trunc(sp * 3);
        const lo = Math.max(x0 + 5, target - ww);
        const hi = Math.min(x1 - 5, target + ww);
        if (hi > lo) {
          let bi = lo; // `np.argmin` keeps the FIRST minimum
          for (let x = lo + 1; x < hi; x++) if (ink[x]! < ink[bi]!) bi = x;
          cuts.push(bi);
        } else {
          cuts.push(target);
        }
      }
    }
    // two targets can pick one gutter, which yields FEWER pieces than n — the escalation loop
    // below depends on that happening rather than being papered over
    const uniq = Array.from(new Set(cuts)).sort((a, b) => a - b);
    uniq.push(x1);
    const out: Array<[number, number]> = [];
    for (let i = 0; i + 1 < uniq.length; i++) out.push([uniq[i]!, uniq[i + 1]!]);
    return out;
  };

  const n0 = Math.ceil((x1 - x0) / cap);
  let pieces = cutInto(n0);
  for (let n = n0 + 1; n < n0 + 4; n++) {
    // gutter-shifted cuts can still overrun: check what we have, then try one more piece
    let widest = 0;
    for (const [a, b] of pieces) if (b - a > widest) widest = b - a;
    if (widest <= cap) break;
    pieces = cutInto(n);
  }
  return pieces;
}

/* ---- DENSE-PAGE EXPERIMENT (opt-in) -------------------------------------------------------
 * `row_cost_features` (L821) + `estimate_tokens` (L851): the per-column label-cost features the
 * Python slicer records as `est_tokens`, and the span estimate built from their prefix sums.
 *
 * ⚠ NOT the shipped packing rule. Reached only when `windowMeasures` is given a `tokenBudget`,
 * which only `?dense=` sets. To remove the experiment, delete this block, the `tokenBudget`
 * parameter and its rail — nothing else refers to them.
 */
export interface RowCost {
  /** prefix sums, length width+1: `cum[i]` = the total over columns [0, i). */
  cumStems: Int32Array;
  cumInk: Int32Array;
}

export function rowCostFeatures(row: Gray, topY: number = TOP_LINE_Y): RowCost {
  const sp = TARGET_SPACING;
  const y0 = Math.max(0, Math.trunc(topY - 2.0 * sp)); // ledger notes above ...
  const y1 = Math.min(row.height, Math.trunc(topY + STAFF_SPAN + 2.0 * sp)); // ... beams below
  const band = inkMask(row, y0, y1);
  const w = band.width;

  // longest UNBROKEN vertical ink run per column (`_longest_vertical_run`, L589). Staff rows are
  // deliberately INCLUDED here: a stem is what crosses them unbroken.
  const run = new Int32Array(w);
  const best = new Int32Array(w);
  for (let y = 0; y < band.height; y++) {
    const off = y * w;
    for (let x = 0; x < w; x++) {
      const r = band.data[off + x] ? run[x]! + 1 : 0;
      run[x] = r;
      if (r > best[x]!) best[x] = r;
    }
  }

  // columns carrying non-staff-line ink — what has no stem (rests, dots, accidentals, wholes)
  const inkCol = new Uint8Array(w);
  for (let y = 0; y < band.height; y++) {
    const off = y * w;
    let rowSum = 0;
    for (let x = 0; x < w; x++) rowSum += band.data[off + x]!;
    if (rowSum > w * 0.4) continue; // staff lines ink every column
    for (let x = 0; x < w; x++) if (band.data[off + x]) inkCol[x] = 1;
  }

  const stemMin = Math.trunc(2.0 * sp);
  const cumStems = new Int32Array(w + 1);
  const cumInk = new Int32Array(w + 1);
  let prevStem = false;
  for (let x = 0; x < w; x++) {
    const isStem = best[x]! >= stemMin;
    // rising edge only: one stem counts once however many columns thick it is
    cumStems[x + 1] = cumStems[x]! + (isStem && !prevStem ? 1 : 0);
    cumInk[x + 1] = cumInk[x]! + inkCol[x]!;
    prevStem = isStem;
  }
  return { cumStems, cumInk };
}

export function estimateTokens(c: RowCost, x0: number, x1: number, isRowStart: boolean): number {
  const n = c.cumStems.length - 1;
  const a = Math.max(0, Math.min(x0, n));
  const b = Math.max(a, Math.min(x1, n));
  return (
    COST_PER_STEM * (c.cumStems[b]! - c.cumStems[a]!) +
    COST_PER_INK_COL * (c.cumInk[b]! - c.cumInk[a]!) +
    (isRowStart ? COST_ROW_START : 0)
  );
}

/**
 * `window_measures` (L867): group consecutive measures into windows that fit the rails.
 *
 * The first window keeps the row's left prefix (clef + key signature — the `\sig` carrier). A
 * leading span with no notehead past the clef zone is that prefix rather than a measure, so it
 * stays in the crop but is excluded from measure indexing.
 *
 * `row` is required here where Python allows `None`: the driver always has it, and the None path
 * only exists for callers that want spans without pixels (it disables `_split_wide` and the lead
 * trim, so it is not a mode the app can ever be in).
 */
export function windowMeasures(
  bars: number[],
  row: Gray,
  topY: number = TOP_LINE_Y,
  /** ⚠ EXPERIMENT (`?dense=`): when set, stop adding measures once the estimated label cost
   *  passes this many ids. Unset = the shipped rule, which packs on measures and width only. */
  tokenBudget?: number
): Window[] {
  let lead: number | null = null;
  let bs = bars;
  if (
    bs.length >= 3 &&
    bs[1]! - bs[0]! <= Math.trunc(10 * TARGET_SPACING) &&
    // clef ~3.5 sp: scan for music beyond it
    !hasNotehead(row, bs[0]! + Math.trunc(4 * TARGET_SPACING), bs[1]! - 2, topY)
  ) {
    lead = bs[0]!;
    bs = bs.slice(1);
  }
  const spans: Array<[number, number]> = []; // each = one measure
  for (let i = 0; i + 1 < bs.length; i++) spans.push([bs[i]!, bs[i + 1]!]);
  if (!spans.length) return [];
  const cap = spanCap();
  const cost = tokenBudget === undefined ? null : rowCostFeatures(row, topY);
  // the first window starts at the clef prefix when there is one, so the caps below see the crop's
  // TRUE extent (re-extending it afterwards is what broke the width cap on 22 strips)
  const winX0 = (i: number) => (i === 0 && lead !== null ? lead : spans[i]![0]);

  const windows: Window[] = [];
  let i = 0;
  while (i < spans.length) {
    const x0 = winX0(i);
    let j = i + 1; // always take at least one measure
    while (j < spans.length && j - i < MEASURES_PER_STRIP) {
      const nx1 = spans[j]![1];
      if (nx1 - x0 > cap) break; // width rail
      // label-budget rail — the one that decides whether the model can express the strip at all
      if (cost !== null && estimateTokens(cost, x0, nx1, i === 0) > tokenBudget!) break;
      j++;
    }
    const x1 = spans[j - 1]![1];
    if (x1 - x0 > cap) {
      // over-wide single measure
      for (const [a, b] of splitWide(row, x0, x1, topY))
        windows.push({ x0: a, x1: b, mFrom: i, mTo: j - 1, splitWide: true });
    } else if (x1 - x0 < MIN_STRIP_W) {
      // never silently DROP content: a sliver merges into the previous window when the result stays
      // within the trained width AND the measure cap; else it is emitted on its own.
      const prev = windows.length ? windows[windows.length - 1]! : null;
      if (
        prev !== null &&
        !prev.splitWide &&
        x1 - prev.x0 <= cap &&
        j - 1 - prev.mFrom + 1 <= MEASURES_PER_STRIP
      ) {
        prev.x1 = x1;
        prev.mTo = j - 1;
      } else {
        windows.push({ x0, x1, mFrom: i, mTo: j - 1, splitWide: false });
      }
    } else {
      windows.push({ x0, x1, mFrom: i, mTo: j - 1, splitWide: false });
    }
    i = j;
  }
  return windows;
}
