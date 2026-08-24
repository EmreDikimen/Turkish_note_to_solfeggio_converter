/**
 * The `_debug.png` overlay — `page_to_strips`' `--debug` branch (L1157-1177), ported.
 *
 * The one thing the slicer port deliberately left out ("minus every filesystem write and the debug
 * overlay", `slicer.ts`). It is drawn here instead of there for the same reason it is a branch in
 * Python: nothing in it may change what the slicer computes. This module only READS a finished
 * `Stage3Result` and paints on a copy of the page, so a page sliced with the overlay on and one
 * sliced with it off produce byte-identical crops.
 *
 * What the colours mean — the same code Python uses, so a browser overlay and a
 * `page_to_strips.py --debug` overlay of the same page can be put side by side:
 *
 *   green   the five staff lines the detector found, drawn over the row's own x-extent
 *   blue    every ACCEPTED barline — this is where you check the row for a missing measure
 *   red     the PADDED crop boxes: exactly the pixels each strip holds
 *   orange  a rejected barline candidate: too fat (a smudge, a stem cluster)   — gate2_fat
 *   purple  rejected: the stroke runs on past the staff, so it reads as a clef — gate3_clef
 *   yellow  rejected: a notehead, flag or beam crossing a staff line           — gate3_blob
 *   grey    rejected: outside the staff's measured x-extent                    — xrange
 *
 * Coordinates: `staff` is already in page pixels, while barlines and crop spans are in ROW
 * coordinates (the row is rescaled so line spacing is 30 px), so both are divided by the row's
 * `scale` to land back on the page — `int(b / scale)` at L1163.
 */
import { staffBottom, staffTop } from "./staves";
import { grayToCanvas } from "./cvOps";
import type { Stage3Result } from "./slicer";

/** L1170-1171 — why a candidate was thrown away, in the colour the overlay draws it. */
const REJECT_COLOR: Record<string, string> = {
  gate2_fat: "rgb(255,140,0)",
  gate3_clef: "rgb(180,0,200)",
  gate3_blob: "rgb(220,220,0)",
  xrange: "rgb(160,160,160)",
};
const REJECT_FALLBACK = "rgb(128,128,128)";

const STAFF_COLOR = "rgb(0,160,0)";
const BAR_COLOR = "rgb(0,120,220)";
const CROP_COLOR = "rgb(220,0,0)";

/**
 * Paint the slicer's decisions onto the page it sliced. Returns a NEW canvas; the result's own
 * pixels are untouched.
 *
 * `res` must come from `sliceStage3(gray, { rejects: true })` — without it the rejected candidates
 * are simply not collected and the overlay draws everything else.
 */
export function drawDebugOverlay(res: Stage3Result): HTMLCanvasElement {
  // The DESKEWED, cropped page — the image the staves were actually found in, not the upload.
  const canvas = grayToCanvas(res.page);
  const ctx = canvas.getContext("2d")!;
  ctx.lineWidth = 1;

  for (const row of res.rows) {
    const { staff, normalized } = row;
    const { scale } = normalized;
    const top = staffTop(staff);
    const bottom = staffBottom(staff);

    ctx.strokeStyle = STAFF_COLOR;
    for (const y of staff.lines) hline(ctx, staff.x0, staff.x1, y, 1);

    // every accepted barline — check the row for completeness here
    ctx.strokeStyle = BAR_COLOR;
    for (const b of row.bars) vline(ctx, Math.trunc(b / scale), top - 12, bottom + 12, 2);

    // rejected candidates, colour-coded by WHY (null when `rejects` was not asked for)
    for (const [rx, why] of row.rejects ?? []) {
      ctx.strokeStyle = REJECT_COLOR[why] ?? REJECT_FALLBACK;
      vline(ctx, Math.trunc(rx / scale), top - 24, bottom + 24, 2);
    }

    // the padded strip crops, mapped back to page coordinates
    ctx.strokeStyle = CROP_COLOR;
    ctx.lineWidth = 2;
    for (const s of row.strips) {
      const px0 = Math.trunc(s.rowX0 / scale);
      const px1 = Math.trunc(s.rowX1 / scale);
      ctx.strokeRect(px0 + 1, top - 20 + 1, px1 - px0 - 2, bottom + 20 - (top - 20) - 2);
    }
    ctx.lineWidth = 1;
  }
  return canvas;
}

/** A crisp 1-px-grid line: canvas strokes straddle the coordinate, so integers need the half. */
function hline(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, w: number) {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y + 0.5);
  ctx.lineTo(x1, y + 0.5);
  ctx.stroke();
}

function vline(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number) {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y0);
  ctx.lineTo(x + 0.5, y1);
  ctx.stroke();
}
