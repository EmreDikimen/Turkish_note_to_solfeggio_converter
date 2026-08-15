/**
 * Where the violin photo's strings actually are — the calibration for F3's fingerboard tab.
 *
 * What/why: every number here was MEASURED off `public/instruments/violin-vl100.png`, never
 * guessed, the same discipline that produced the measured `hz` values in `audio/instruments.ts`.
 * Because the photo is a straight-on front view with the nut AND the bridge in frame, each string
 * is a straight line between two points, so a position is a plain lerp — no projective correction
 * (docs/features/README.md).
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
 * The crop, and the rotation that lays the neck down.
 *
 * The violin stands upright in the photo, so the neck is a 6:1 vertical sliver — unreadable on a
 * phone, and every human who has opened the deployed app so far was on one (docs/METRICS-USAGE.md).
 * Rotating it a quarter turn anticlockwise puts the nut on the left and the bridge on the right,
 * which is the shape a fingerboard chart is normally drawn in and which fits under the score.
 *
 * ⚠ It is a true rotation, not a transpose, so the photo is never mirrored: the low Sol string
 * ends up at the BOTTOM and Mi at the top, the same way round as guitar tab.
 *
 * The SVG stays in IMAGE pixel coordinates throughout — the group carries
 * `rotate(-90) translate(-CROP.x1, -CROP.y0)` and everything inside is placed at raw image (x, y).
 * That is what keeps this file the only place that knows about pixels. ⚠ The rotation lives on an
 * inner `<g>`, never as a CSS transform on a container: `.kv-score` is screenshotted by rect for
 * training strips and must not be transformed (see ScoreCard.tsx).
 */
export const CROP = { x0: 180, x1: 250, y0: 136, y1: 600 } as const;

/** Display width/height after the rotation: the crop's height becomes the width. */
export const VIEW_W = CROP.y1 - CROP.y0; // 464
export const VIEW_H = CROP.x1 - CROP.x0; // 70

/**
 * Where the nut lands in display coordinates, and therefore where the photo starts.
 *
 * The photo is masked to begin here rather than at the crop edge, which leaves a clean margin on
 * the left for the string names. Cutting at the nut is not a compromise: the nut IS where a string
 * begins, so the left edge of the picture and the zero of every position are the same line.
 */
export const NUT_X_DISPLAY = NUT_Y - CROP.y0; // 35.5

/**
 * The ebony's own side edges, measured two rows apart where nothing else in frame is dark.
 *
 * ⚠ Only rows near the neck are usable: further down, the f-holes, the fingerboard's shadow and
 * the dark parts of the body all pass a "darker than the belly" test, so a naive scan reads the
 * fingerboard as 109 px wide by the time it reaches the body. These two rows are clean, and the
 * taper is straight, so the edges extrapolate.
 */
const EDGE_A = { y: 178, left: 197, right: 231 };
const EDGE_B = { y: 300, left: 193, right: 235 };
const EDGE_SLOPE = (EDGE_B.left - EDGE_A.left) / (EDGE_B.y - EDGE_A.y); // −0.0328 px per row, each side

/** Image x of the fingerboard's two edges at a given image y. */
export function fingerboardEdgesAt(y: number): { left: number; right: number } {
  const d = EDGE_SLOPE * (y - EDGE_A.y);
  return { left: EDGE_A.left + d, right: EDGE_A.right - d };
}

/** The transform that carries image (x, y) into the rotated display box. */
export const ROTATE_TRANSFORM = `rotate(-90) translate(${-CROP.x1} ${-CROP.y0})`;

/** Display coordinates of an image point, for anything that has to be placed OUTSIDE the rotated group. */
export function toDisplay(x: number, y: number): { x: number; y: number } {
  return { x: y - CROP.y0, y: CROP.x1 - x };
}

/**
 * The outline the photo is masked to: the fingerboard itself, nut to crop edge.
 *
 * Why a shape rather than a rectangle. A rectangle starting at the nut catches the tip of a TUNING
 * PEG, which sticks out sideways across image rows 172–176 — just past the nut — and renders as a
 * grey smudge floating under the Sol string. Masking to the ebony's own edges removes it, and it
 * also gives the picture its true taper: narrow at the nut, wide where it meets the body, which is
 * what a neck actually looks like.
 */
export function fingerboardOutline(): { x: number; y: number }[] {
  const a = fingerboardEdgesAt(NUT_Y);
  const b = fingerboardEdgesAt(CROP.y1);
  return [
    toDisplay(a.right, NUT_Y),
    toDisplay(b.right, CROP.y1),
    toDisplay(b.left, CROP.y1),
    toDisplay(a.left, NUT_Y),
  ];
}

/**
 * Image point for a position on a string. `ratio` is what core's `positionOnString` returns, so
 * 0 is the nut and 0.5 the octave; the fanning-out of the strings comes free from the lerp.
 */
export function pointOnString(stringIndex: number, ratio: number): { x: number; y: number } {
  const line = STRING_LINES[stringIndex]!;
  return {
    x: line.nutX + (line.bridgeX - line.nutX) * ratio,
    y: NUT_Y + (BRIDGE_Y - NUT_Y) * ratio,
  };
}
