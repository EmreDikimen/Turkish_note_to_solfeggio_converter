/**
 * Staff detection — `detect_staves` (L310), `_cluster_rows` (L341), `_emit_staff` (L355).
 *
 * A horizontal opening keeps only ink that runs continuously for STAFF_HOR_FRAC of the page width,
 * which leaves staff lines and little else. Their row projection gives candidate line rows; rows
 * within a few pixels collapse to one line; lines closer than 2.2 spacings belong to one system.
 *
 * Transliterated line by line. Do not restructure — see docs/mvp/slicer-port.md.
 */
import { STAFF_HOR_FRAC, TARGET_SPACING, diff, median, pyRound } from "./constants";
import { openHorizontal, type Gray } from "./cvOps";

/** `Staff` (L105): the y of each staff line in page coords, plus the staff's x-extent. */
export interface Staff {
  lines: number[];
  x0: number;
  x1: number;
}

/** `Staff.spacing` (L111). */
export function staffSpacing(s: Staff): number {
  const d = diff(s.lines);
  return d.length ? median(d) : TARGET_SPACING;
}

/** `Staff.top` (L116). */
export function staffTop(s: Staff): number {
  return s.lines[0]!;
}

/** `Staff.bottom` (L120). */
export function staffBottom(s: Staff): number {
  return s.lines[s.lines.length - 1]!;
}

/** `detect_staves` (L310): find 5-line systems via horizontal opening + row projection. */
export function detectStaves(ink: Gray): Staff[] {
  const h = ink.height;
  const w = ink.width;
  // keep only long horizontal structures (staff lines), drop noteheads/stems/text
  const horLen = Math.max(20, Math.trunc(w * STAFF_HOR_FRAC));
  const horiz = openHorizontal(ink, horLen);

  const rowInk = new Float64Array(h);
  let maxRow = 0;
  for (let y = 0; y < h; y++) {
    let s = 0;
    const off = y * w;
    for (let x = 0; x < w; x++) s += horiz.data[off + x]!;
    rowInk[y] = s / 255;
    if (rowInk[y]! > maxRow) maxRow = rowInk[y]!;
  }
  if (maxRow < 1) return [];

  // candidate staff-line rows: strong horizontal ink
  const thr = Math.max(maxRow * 0.3, w * 0.2);
  const hits: number[] = [];
  for (let y = 0; y < h; y++) if (rowInk[y]! > thr) hits.push(y);
  const lineRows = clusterRows(hits);
  if (lineRows.length < 2) return [];

  // group consecutive lines into systems: a gap >> median spacing starts a new system
  const sp = median(diff(lineRows));
  const staves: Staff[] = [];
  let group: number[] = [lineRows[0]!];
  for (let i = 1; i < lineRows.length; i++) {
    const prev = lineRows[i - 1]!;
    const cur = lineRows[i]!;
    if (cur - prev <= sp * 2.2) {
      group.push(cur); // same staff
    } else {
      emitStaff(group, ink, staves); // new system
      group = [cur];
    }
  }
  emitStaff(group, ink, staves);
  return staves;
}

/** `_cluster_rows` (L341): collapse runs of adjacent row indices to their centers. */
export function clusterRows(rows: ArrayLike<number>, gap = 3): number[] {
  if (rows.length === 0) return [];
  const out: number[] = [];
  let start = rows[0]!;
  let prev = rows[0]!;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    if (r - prev > gap) {
      out.push(Math.floor((start + prev) / 2));
      start = r;
    }
    prev = r;
  }
  out.push(Math.floor((start + prev) / 2));
  return out;
}

/** `_emit_staff` (L355): accept a group as a staff if it is ~5 evenly-spaced lines. */
export function emitStaff(group: number[], ink: Gray, out: Staff[]): void {
  if (!(group.length >= 4 && group.length <= 7)) return;
  if (group.length > 5) {
    // extra long horizontals (a VOLTA bracket above, an ottava/lyric rule below) can ride along
    // in the cluster — keep the most evenly-spaced consecutive 5-line window
    let best: number[] | null = null;
    let bestSpread: number | null = null;
    for (let k = 0; k < group.length - 4; k++) {
      const win = group.slice(k, k + 5);
      const gaps = diff(win);
      const spread = Math.max(...gaps) - Math.min(...gaps);
      if (bestSpread === null || spread < bestSpread) {
        best = win;
        bestSpread = spread;
      }
    }
    group = best!;
  }

  // x-extent from the RAW ink at the detected line rows — NOT the opened image: on a slightly
  // skewed scan a staff line drifts across pixel rows, splitting each row into runs shorter than
  // the opening kernel, so the opened image loses the line's left/right portions (measured: x0
  // pushed 70..490 px right, cutting the clef or whole measures).
  // A column counts when a MAJORITY of the group's lines carry ink within ±tol rows.
  const sp = median(diff(group));
  const tol = Math.max(2, pyRound(sp * 0.2));
  const w = ink.width;
  const count = new Int32Array(w);
  const colAny = new Uint8Array(w);
  for (const y of group) {
    const y0 = Math.max(0, y - tol);
    const y1 = Math.min(ink.height, y + tol + 1);
    colAny.fill(0);
    for (let yy = y0; yy < y1; yy++) {
      const off = yy * w;
      for (let x = 0; x < w; x++) if (ink.data[off + x]!) colAny[x] = 1;
    }
    for (let x = 0; x < w; x++) count[x]! += colAny[x]!;
  }
  const need = Math.max(3, Math.floor((group.length + 1) / 2));
  const xs: number[] = [];
  for (let x = 0; x < w; x++) if (count[x]! >= need) xs.push(x);
  if (xs.length === 0) return;

  // keep the longest gap-tolerant run of qualifying columns: stray blobs and scan-border
  // artifacts far from the staff must not stretch the extent
  const gapTol = Math.trunc(3 * sp);
  const runs: Array<[number, number]> = [];
  let start = xs[0]!;
  let prev = xs[0]!;
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i]!;
    if (x - prev > gapTol) {
      runs.push([start, prev]);
      start = x;
    }
    prev = x;
  }
  runs.push([start, prev]);
  // Python's `max()` keeps the FIRST maximum on a tie; a strict `>` here does the same.
  let bestRun = runs[0]!;
  for (const r of runs) if (r[1] - r[0] > bestRun[1] - bestRun[0]) bestRun = r;

  out.push({ lines: group, x0: bestRun[0], x1: bestRun[1] });
}
