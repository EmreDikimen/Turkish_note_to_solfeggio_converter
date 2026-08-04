/**
 * Row normalization — `row_music_extent` (L400), `place_band` (L423), `normalize_row` (L446).
 *
 * The model was fine-tuned on strips at ONE geometry: 336 px tall, 30 px line spacing, the staff
 * placed at a fixed height in the frame. This crops a band around each detected staff and rescales
 * it to exactly that. The scale is the axis the model is genuinely sensitive to (12-15% edits per
 * 1%); where the staff sits inside the frame is nearly free (+0.4% per 1%), which is what lets
 * `place_band` spend the slack downward and stop clipping low beams.
 *
 * Transliterated line by line. Do not restructure — see docs/mvp/slicer-port.md.
 */
import {
  BELOW_SP,
  HEADROOM_SP,
  STRIP_H,
  TARGET_SPACING,
  VPLACE_ADAPTIVE,
  VPLACE_MARGIN_SP,
  VPLACE_MIN_HEAD_SP,
  pyRound,
} from "./constants";
import { copyMakeBorderTB, resizeArea, subRows, type Gray, type Labels } from "./cvOps";
import { staffBottom, staffSpacing, staffTop, type Staff } from "./staves";

/**
 * `row_music_extent` (L400): how far THIS row's music reaches past its outer staff lines, in
 * line-spaces, counting only ink CONNECTED to the staff band.
 *
 * The connectivity test is the whole point: without it a neighbouring system or a page header
 * inside the same vertical reach would masquerade as this row's content.
 */
export function rowMusicExtent(lab: Labels, staff: Staff): [number, number] {
  const sp = staffSpacing(staff);
  const reach = Math.trunc(6 * sp);
  const { x0, x1 } = staff;
  const top = staffTop(staff);
  const bottom = staffBottom(staff);
  const W = lab.width;

  // `mine` — the label ids present in the staff band. A Uint8 membership table stands in for
  // Python's `set(np.unique(...)) - {0}` plus `np.isin`, and is exact for the same reason.
  const mine = new Uint8Array(lab.count);
  let any = false;
  for (let y = top; y <= bottom; y++) {
    const off = y * W;
    for (let x = x0; x < x1; x++) {
      const l = lab.data[off + x]!;
      if (l) {
        mine[l] = 1;
        any = true;
      }
    }
  }
  if (!any) return [0, 0];

  // below: last row of the band that carries any of this staff's ink (`ys.max()`)
  const bTop = bottom + 1;
  const bBot = Math.min(lab.height, bottom + reach);
  let lastBelow = -1;
  for (let y = bTop; y < bBot; y++) {
    const off = y * W;
    for (let x = x0; x < x1; x++) {
      if (mine[lab.data[off + x]!]) {
        lastBelow = y - bTop;
        break;
      }
    }
  }
  const below = lastBelow >= 0 ? (lastBelow + 1) / sp : 0.0;

  // above: first row of the band that carries any of this staff's ink (`ys2.min()`)
  const tTop = Math.max(0, top - reach);
  const tRows = top - tTop;
  let firstAbove = -1;
  for (let y = tTop; y < top; y++) {
    const off = y * W;
    let hit = false;
    for (let x = x0; x < x1; x++) {
      if (mine[lab.data[off + x]!]) {
        hit = true;
        break;
      }
    }
    if (hit) {
      firstAbove = y - tTop;
      break;
    }
  }
  const above = firstAbove >= 0 ? (tRows - firstAbove) / sp : 0.0;

  return [above, below];
}

/**
 * `place_band` (L423): split the frame's 7.2 line-spaces of non-staff height between headroom and
 * underroom.
 *
 * The frame height and the 30 px spacing are fixed by training and are NOT touched here — only
 * where the staff sits inside them. The trained default (4.60 above / 2.60 below) is generous
 * above and too tight below for real engraving: music reaches 2.68 sp below at p90, so 11.6% of
 * real staff rows had beams cut off.
 */
export function placeBand(above: number, below: number): [number, number] {
  const total = HEADROOM_SP + BELOW_SP; // 7.2 sp of non-staff height
  let wantB = Math.min(below + VPLACE_MARGIN_SP, total - VPLACE_MIN_HEAD_SP);
  wantB = Math.max(wantB, BELOW_SP); // never tighter than the trained default
  let head = total - wantB;
  if (head < above + VPLACE_MARGIN_SP) {
    // cannot fit both: keep the staff nearer
    head = Math.min(HEADROOM_SP, Math.max(VPLACE_MIN_HEAD_SP, above + VPLACE_MARGIN_SP));
  }
  head = Math.min(HEADROOM_SP, Math.max(VPLACE_MIN_HEAD_SP, head));
  return [head, total - head];
}

export interface NormalizedRow {
  row: Gray; // STRIP_H tall, the full page width rescaled
  scale: number; // TARGET_SPACING / staff spacing
  topLineY: number; // y of the top staff line inside `row`
  /** Diagnostics — not in the Python return, used by the W4 parity harness. */
  bandTop: number;
  bandBot: number;
  padTop: number;
  padBottom: number;
  headSp: number;
  belowSp: number;
}

/**
 * `normalize_row` (L446): crop the band around a staff and rescale so line spacing == 30 px.
 *
 * With `lab` the staff is placed adaptively inside the fixed frame (VPLACE_ADAPTIVE, on by
 * default); without it the fixed training placement is used.
 */
export function normalizeRow(gray: Gray, staff: Staff, lab: Labels | null = null): NormalizedRow {
  const sp = staffSpacing(staff);
  const scale = TARGET_SPACING / sp;
  let headSp = HEADROOM_SP;
  let belowSp = BELOW_SP;
  if (lab !== null && VPLACE_ADAPTIVE) {
    const [above, below] = rowMusicExtent(lab, staff);
    [headSp, belowSp] = placeBand(above, below);
  }
  // band in page coords that maps to the 336-tall strip with the staff placed like training
  const bandTop = pyRound(staffTop(staff) - headSp * sp);
  const bandBot = pyRound(staffBottom(staff) + belowSp * sp);
  const bandTopC = Math.max(0, bandTop);
  const bandBotC = Math.min(gray.height, bandBot);
  let crop = subRows(gray, bandTopC, bandBotC);
  // pad if the band ran off the page edge (keep the staff at the right vertical offset)
  const padT = bandTopC - bandTop;
  const padB = bandBot - bandBotC;
  if (padT || padB) crop = copyMakeBorderTB(crop, padT, padB, 255);
  const newW = Math.max(1, pyRound(crop.width * scale));
  const row = resizeArea(crop, newW, STRIP_H);
  const topLineY = pyRound(headSp * TARGET_SPACING);
  return {
    row,
    scale,
    topLineY,
    bandTop,
    bandBot,
    padTop: padT,
    padBottom: padB,
    headSp,
    belowSp,
  };
}
