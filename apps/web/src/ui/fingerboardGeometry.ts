/**
 * Where the violin photo's strings actually are — the calibration for F3's fingerboard tab.
 *
 * What/why: every number here was MEASURED off `public/instruments/violin-vl100.png`, never
 * guessed, the same discipline that produced the measured `hz` values in `audio/instruments.ts`.
 * Because the photo is a straight-on front view with the nut AND the bridge in frame, each string
 * is a straight line between two points, so a position is a plain lerp — no projective correction
 * (docs/features/fingerboard.md).
 *
 * How it was measured (reproducible): each string was tracked down the image as the brightness
 * peak in a ±3 px window, row by row, and a line was fitted with outlier rejection. Fit residuals
 * came out at 0.06–0.10 px over 348–432 rows, so these lines are far more accurate than the ~7 px
 * a koma occupies near the nut. The nut (171.5) and bridge (659.0) are the pale ridges in the
 * luminance profile between the strings.
 *
 * Two independent sanity checks that this is a real 4/4 violin, and therefore that the numbers are
 * not self-consistent nonsense: the nut→bridge run of 487.5 px scales to 328.1 mm at the image's
 * own px/mm (a 4/4 vibrating length is 328 mm), and the string spread comes out 17.2 mm at the nut
 * and 34.2 mm at the bridge (real: ~16.3 and ~33.5).
 *
 * ⚠ SWAPPING THE PHOTO IS A DATA CHANGE, NOT A CODE CHANGE. A higher-resolution bare-neck image is
 * the known upgrade — the current one gives only ~7 px per koma near the nut and less further up,
 * which is thin in the high positions. Re-measure and replace this file's constants; nothing in
 * `Fingerboard.tsx` reads pixel positions of its own.
 */

/** The image, as shipped. Referenced root-absolute like `/audio/…` — no env var, it rides with the app. */
export const VIOLIN_IMAGE = {
  href: "/instruments/violin-vl100.png",
  width: 700,
  height: 951,
} as const;

/** Image y of the nut and the bridge — the two ends of the vibrating length. */
export const NUT_Y = 171.5;
export const BRIDGE_Y = 659.0;

/** Image y where the ebony fingerboard stops over the belly. Nothing can be stopped past it. */
export const FINGERBOARD_END_Y = 580;

/**
 * The same limit as a fraction of the vibrating length — what `assignFingering` needs.
 *
 * ⚠ DERIVED, not written down a second time. Core carries a `FINGERBOARD_END_RATIO` default for
 * callers with no picture, but the view passes THIS one, so a re-measure of the photo cannot leave
 * the maths pointing at a stale number. It comes out ≈0.838, about two and a half octaves above
 * the open string, which is what a violin fingerboard actually reaches.
 */
export const IMAGE_FINGERBOARD_END_RATIO = (FINGERBOARD_END_Y - NUT_Y) / (BRIDGE_Y - NUT_Y);

/** Image x of each string at the nut and at the bridge, lowest string first — same order as `OpenString[]`. */
export const STRING_LINES: readonly { nutX: number; bridgeX: number }[] = [
  { nutX: 200.74, bridgeX: 185.0 }, // Sol
  { nutX: 208.98, bridgeX: 201.07 }, // Re
  { nutX: 218.19, bridgeX: 218.79 }, // La
  { nutX: 226.31, bridgeX: 235.89 }, // Mi
];

/**
 * The crop: the violin STANDING UP, scroll to mid-body (owner, 2026-08-27).
 *
 * ⚠ THIS REPLACED A QUARTER-TURN ROTATION, AND THE REASON THE ROTATION EXISTED IS STILL TRUE.
 * The neck alone is a 6:1 vertical sliver, so laying it down was the only way to make a *neck*
 * fill a card. What the owner asked for instead is not a neck but an INSTRUMENT: upright, with
 * about half the body in frame, because a lying-down sliver of ebony does not read as a violin to
 * the person holding one. So the crop got wider rather than the picture turning: x spans the
 * whole front view (the side view in the same file starts at x=478 and is cropped away), y runs
 * from the scroll to just past the bridge.
 *
 * Measured on the file's ALPHA channel, not guessed: for y ≤ 700 the front view occupies
 * x 72..367 and starts at y=34, so these bounds clear it by ~6 px on every side. The body runs
 * y 370..922, so cutting at 700 shows 60% of it — "half the body", with the bridge included
 * because the bridge is where every string ends.
 *
 * The SVG stays in IMAGE pixel coordinates throughout: the photo is placed at
 * `(-CROP.x0, -CROP.y0)` and everything else goes through `toDisplay()`, which is now a plain
 * translation. That is what keeps this file the only place that knows about pixels. ⚠ There is no
 * transform on any container: `.kv-score` is screenshotted by rect for training strips and must
 * not be transformed (see ScoreCard.tsx).
 */
export const CROP = { x0: 64, x1: 375, y0: 26, y1: 700 } as const;

/** Display width/height of the crop, in image pixels. */
export const VIEW_W = CROP.x1 - CROP.x0; // 311
export const VIEW_H = CROP.y1 - CROP.y0; // 674

/** Display y of the nut — the zero of every position. */
export const NUT_Y_DISPLAY = NUT_Y - CROP.y0; // 145.5

/** Where the photo is drawn so that image (CROP.x0, CROP.y0) lands on the view's origin. */
export const IMAGE_ORIGIN = { x: -CROP.x0, y: -CROP.y0 } as const;

/**
 * The ebony's own side edges, measured two rows apart where nothing else in frame is dark.
 *
 * ⚠ Only rows near the neck are usable: further down, the f-holes, the fingerboard's shadow and
 * the dark parts of the body all pass a "darker than the belly" test, so a naive scan reads the
 * fingerboard as 109 px wide by the time it reaches the body. These two rows are clean, and the
 * taper is straight, so the edges extrapolate. Checked against a real instrument at the far end:
 * the extrapolation gives 60 px at the fingerboard's end, and 42 mm (a violin's end width) is
 * 62 px at this image's px/mm.
 */
const EDGE_A = { y: 178, left: 197, right: 231 };
const EDGE_B = { y: 300, left: 193, right: 235 };
const EDGE_SLOPE = (EDGE_B.left - EDGE_A.left) / (EDGE_B.y - EDGE_A.y); // −0.0328 px per row, each side

/** Image x of the fingerboard's two edges at a given image y. */
export function fingerboardEdgesAt(y: number): { left: number; right: number } {
  const d = EDGE_SLOPE * (y - EDGE_A.y);
  return { left: EDGE_A.left + d, right: EDGE_A.right - d };
}

/** Display coordinates of an image point. A translation only — the view is not rotated. */
export function toDisplay(x: number, y: number): { x: number; y: number } {
  return { x: x - CROP.x0, y: y - CROP.y0 };
}

/**
 * Image y for a position along the vibrating length. `ratio` is what core's `positionOnString`
 * returns, so 0 is the nut and 0.5 the octave.
 */
export function ratioToImageY(ratio: number): number {
  return NUT_Y + (BRIDGE_Y - NUT_Y) * ratio;
}

/**
 * A line ACROSS the fingerboard at one position, in display coordinates.
 *
 * Why across rather than one notch per string (owner, 2026-08-27): this is how a learner's violin
 * is actually marked — a strip of tape laid over all four strings. A ratio is a ratio of each
 * string's own length, so one line really is the same place on every string; what differs is the
 * pitch it produces there. `pad` widens it a little past the ebony so the line reads as laid ON
 * the neck rather than inlaid into it.
 */
export function fingerboardLineAt(ratio: number, pad = 1.5): { x1: number; x2: number; y: number } {
  const y = ratioToImageY(ratio);
  const e = fingerboardEdgesAt(y);
  const a = toDisplay(e.left - pad, y);
  const b = toDisplay(e.right + pad, y);
  return { x1: a.x, x2: b.x, y: a.y };
}

/**
 * The viewBox for one of the two zoom levels, in display coordinates.
 *
 * `FULL` is the whole crop: the instrument, so the player can see WHICH instrument this is and
 * roughly where on it the hand goes. It is the default because a close-up with no violin around it
 * is the sliver problem again, one axis over.
 *
 * `NECK` is the fingerboard on its own, and it is fitted to THIS PIECE rather than fixed
 * (owner asked for a zoom, 2026-08-27). Fitting matters: a fixed close-up would either cut off the
 * high notes of a piece that climbs, or waste half the box on empty ebony for one that stays in
 * first position — and a note drawn outside the box is invisible, which reads as a bug rather than
 * as a crop. So the window runs from just above the nut (leaving room for the string names) down to
 * the highest position the piece actually uses, plus a margin.
 *
 * ⚠ THE PHOTO IS THE LIMIT, NOT THE MATHS. The neck is only ~70 px wide in the source image, so a
 * close-up magnifies real pixels: `MIN_SPAN` stops the zoom before the wood turns to mush on a
 * first-position piece. The marks stay vector and stay sharp either way. A higher-resolution
 * bare-neck photo is the upgrade, and it is a data change (docs/features/fingerboard.md).
 */
const NECK_TOP_Y = NUT_Y - 34; // the string names sit above the nut and must stay in frame
const NECK_PAD_X = 11;
/** Never zoom closer than this much of the string, however low the piece stays. */
const MIN_SPAN_RATIO = 0.34;
/** Room below the highest position used, so its line is not on the frame edge. */
const SPAN_MARGIN_RATIO = 0.05;

export interface ViewWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The whole crop — the instrument. */
export const FULL_WINDOW: ViewWindow = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };

/**
 * The fingerboard alone, fitted to the highest position `maxRatio` the piece reaches.
 *
 * Pass the piece's own maximum; anything below `MIN_SPAN_RATIO` is treated as that, and nothing
 * ever runs past the end of the ebony.
 */
export function neckWindow(maxRatio: number): ViewWindow {
  const span = Math.min(
    Math.max(maxRatio + SPAN_MARGIN_RATIO, MIN_SPAN_RATIO),
    IMAGE_FINGERBOARD_END_RATIO,
  );
  const bottomY = ratioToImageY(span);
  // The neck widens downwards, so its widest row is the bottom one: measure there and the whole
  // wedge fits.
  const e = fingerboardEdgesAt(bottomY);
  const topLeft = toDisplay(e.left - NECK_PAD_X, NECK_TOP_Y);
  const bottomRight = toDisplay(e.right + NECK_PAD_X, bottomY);
  return {
    x: topLeft.x,
    y: topLeft.y,
    w: bottomRight.x - topLeft.x,
    h: bottomRight.y - topLeft.y,
  };
}

/**
 * Image point for a position on a string — where the finger actually goes.
 *
 * The fanning-out of the strings comes free from the lerp: a position near the bridge is both
 * further down AND further out than the same position near the nut.
 */
export function pointOnString(stringIndex: number, ratio: number): { x: number; y: number } {
  const line = STRING_LINES[stringIndex]!;
  return {
    x: line.nutX + (line.bridgeX - line.nutX) * ratio,
    y: ratioToImageY(ratio),
  };
}
