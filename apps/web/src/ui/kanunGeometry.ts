/**
 * Every pixel of the kanun view (feature F3) — the shape, the courses and the mandal grid.
 *
 * What/why: the violin is a licensed PHOTOGRAPH, so its geometry file is a calibration — measured
 * points on someone else's image ([fingerboardGeometry.ts](./fingerboardGeometry.ts)). This one is
 * the opposite: the kanun is **drawn**, so the geometry is generated and there is nothing to
 * measure. That is not laziness, it is the better choice here for three separate reasons — the
 * mandals are the whole point and are unreadably small in any photograph of a whole kanun; there is
 * no licence chain to follow; and a drawing can put 26 courses on a phone screen where a photograph
 * cannot.
 *
 * ⚠ **THE SHAPE IS SCHEMATIC AND SAYS SO.** A real kanun's string lengths do not follow 1/frequency
 * — three and a half octaves would need an 11:1 trapezoid, and a real instrument is nowhere near
 * that because the maker compensates with string gauge instead. So the taper here is a chosen ratio
 * (about 2.3:1), not a derived one. Everything that carries MEANING is derived — which course, which
 * mandal, what is lit — and the outline is a picture of a kanun rather than a scale drawing of one.
 * Do not "fix" the taper by deriving it from the tuning; that would make it wrong and look wrong.
 *
 * How it's organized: a viewBox-sized coordinate space, one function per thing that has a place in
 * it, and two windows (whole instrument / the mandals close up). `packages/core/src/kanun.ts` owns
 * which course and which mandal; `apps/web/src/Kanun.tsx` owns only the drawing and the clock.
 */

/** The drawing's own coordinate space. The SVG viewBox is a window onto this. */
export const VIEW_W = 1100;
export const VIEW_H = 600;

/** Where the bridge stands — every course ends here, so the right edge is straight. */
export const BRIDGE_X = 1060;

/**
 * The nut/mandal line runs on a DIAGONAL, and that diagonal is what makes a kanun a trapezoid: the
 * lowest course starts furthest left and so is the longest, the highest starts furthest right.
 */
const NUT_LEFT = 245;
const NUT_SPAN = 480;

/** The courses, spread evenly down the soundboard. */
const TOP_Y = 42;
const COURSE_GAP = 20;

/**
 * A course is **three strings tuned in unison**, not one (owner, 2026-08-29) — that is what a perde
 * physically is on a kanun, and one line was a summary that lost it. They share a single mandal,
 * because the lever stops the whole course at once.
 *
 * ⚠ `STRING_GAP * 2` must stay well under `MANDAL_H`, or the outer strings of a course leave its
 * own lever and look like they belong to the row above.
 */
export const STRINGS_PER_COURSE = 3;
// ⚠ Set by looking, not by taste: at 2.4 the three strokes merged into one grey band at full
// zoom, which is the one thing drawing three strings was meant to avoid.
const STRING_GAP = 3.2;

/** The three strings of a course, as offsets from its centre line. */
export function stringOffsets(): number[] {
  const mid = (STRINGS_PER_COURSE - 1) / 2;
  return Array.from({ length: STRINGS_PER_COURSE }, (_, i) => (i - mid) * STRING_GAP);
}

/** One mandal box. ⚠ `MANDAL_H` must stay under `COURSE_GAP` or neighbouring rows touch. */
const MANDAL_W = 13;
export const MANDAL_H = 14;

/** How far past the outermost course and the bridge the soundboard reaches. */
const BODY_PAD = 26;
/**
 * How far past the levers the soundboard's LEFT edge reaches.
 *
 * ⚠ **Small on purpose, and it must stay small** (owner, 2026-08-29: *"sol tarafın eğimi perdelerin
 * kısalmasıyla aynı olsun, perde isimleri dışta kalsın"*). Every course's lever block is the same
 * width, so a constant margin makes the left edge exactly parallel to the diagonal the courses
 * shorten along — which is what a kanun's frame actually does. It was briefly widened to 70 to fit
 * the perde names inside the wood; the names now sit **outside** it instead, which is both what the
 * instrument looks like and what keeps the slope honest.
 */
const BODY_LEFT_PAD = 14;
/** Room reserved for a perde name, and its distance from the body's edge. */
export const LABEL_GAP = 10;
const LABEL_ROOM = 40;

/** Where a course's perde name is written — to the LEFT of the soundboard, on the page. */
export function labelX(index: number, count: number, mandalCount: number): number {
  return nutX(index, count) - mandalBlockWidth(mandalCount) - BODY_LEFT_PAD - LABEL_GAP;
}

/**
 * Where a course sits vertically.
 *
 * ⚠ Course 0 is the LOWEST pitch and is drawn at the BOTTOM — higher notes go up, the same
 * direction the sheet and the piano roll use. A kanun sits the other way round under the player's
 * hands, and matching the app is worth more here than matching the posture.
 */
export function courseY(index: number, count: number): number {
  return TOP_Y + (count - 1 - index) * COURSE_GAP;
}

/** Where a course's speaking length begins — its point on the diagonal. */
export function nutX(index: number, count: number): number {
  return NUT_LEFT + (count > 1 ? (index / (count - 1)) * NUT_SPAN : 0);
}

/** How wide the whole mandal block of one course is. */
export function mandalBlockWidth(mandalCount: number): number {
  return mandalCount * MANDAL_W;
}

/**
 * One mandal box, in drawing coordinates.
 *
 * The boxes run left-to-right in pitch order — the flattest mandal furthest from the string's
 * speaking length, the sharpest nearest it — so "further right" means "higher", which is the same
 * direction the courses themselves rise in. Reversing one of the two would be a picture that
 * contradicts itself.
 */
export function mandalRect(
  courseIndex: number,
  mandal: number,
  count: number,
  mandalCount: number,
): { x: number; y: number; w: number; h: number } {
  const right = nutX(courseIndex, count);
  return {
    x: right - (mandalCount - mandal) * MANDAL_W,
    y: courseY(courseIndex, count) - MANDAL_H / 2,
    w: MANDAL_W - 2,
    h: MANDAL_H - 2,
  };
}

/**
 * The soundboard outline: a right trapezoid, straight at the bridge and slanted at the mandals.
 *
 * ⚠ **The left edge is the nut diagonal EXTRAPOLATED, not the line between the two end courses'
 * own x positions** — and getting that wrong is a visible bug, not a rounding detail. The body
 * reaches `BODY_PAD` above the top course and below the bottom one; on a slanted edge those two
 * extra strips move the edge sideways as well, so joining the end courses' x values tilts the edge
 * *inside* the instrument at the top and *outside* it at the bottom. Measured on the first attempt:
 * the top courses' perde names landed **on the wood** (they must sit off it) and the bottom courses'
 * levers **stuck out past the body**. Extending along the diagonal's own slope keeps the edge
 * exactly `BODY_LEFT_PAD` from every course's levers, which is what makes its slope the same as the
 * courses' shortening (owner, 2026-08-29).
 */
export function bodyOutline(count: number, mandalCount: number): string {
  const top = courseY(count - 1, count) - BODY_PAD;
  const bottom = courseY(0, count) + BODY_PAD;
  const edge = (y: number) => leftEdgeX(y, count, mandalCount);
  const right = BRIDGE_X + BODY_PAD;
  return `${edge(top)},${top} ${right},${top} ${right},${bottom} ${edge(bottom)},${bottom}`;
}

/** Where the soundboard's slanted left edge stands at a given height. */
function leftEdgeX(y: number, count: number, mandalCount: number): number {
  const block = mandalBlockWidth(mandalCount);
  const yTop = courseY(count - 1, count);
  const yBottom = courseY(0, count);
  const xTop = nutX(count - 1, count) - block - BODY_LEFT_PAD;
  const xBottom = nutX(0, count) - block - BODY_LEFT_PAD;
  const t = (y - yTop) / (yBottom - yTop);
  return xTop + t * (xBottom - xTop);
}

export interface Window {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The whole instrument. */
export const FULL_WINDOW: Window = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };

/**
 * The mandals close up: the band of levers, cropped to the courses this piece actually touches.
 *
 * ⚠ **This is not a nicety, it is what makes the feature usable on a phone.** 26 courses × 12
 * mandals is 312 boxes; at full width each is about four screen pixels across on a handset, which
 * is a texture rather than a control you can read. Cropping BOTH ways — the long string tails go,
 * and so do the courses the piece never plays — is what buys the size back. A typical piece uses a
 * dozen or so courses, so it is usually a 3-4× magnification.
 *
 * ⚠ The window is fitted to the piece, for the same reason the violin's neck zoom is: a fixed crop
 * must either cut off a piece that ranges wide — and a course drawn outside the viewBox is simply
 * **invisible**, which reads as a bug — or waste the frame on courses nothing touches.
 */
export function mandalWindow(
  loCourse: number,
  hiCourse: number,
  count: number,
  mandalCount: number,
): Window {
  // Two courses of air above and below, so the edge rows are not flush against the frame.
  const lo = Math.max(0, Math.min(loCourse, hiCourse) - 2);
  const hi = Math.min(count - 1, Math.max(loCourse, hiCourse) + 2);
  const y = courseY(hi, count) - COURSE_GAP - MANDAL_H;
  const h = courseY(lo, count) - courseY(hi, count) + (COURSE_GAP + MANDAL_H) * 2;

  // Horizontally: from the leftmost mandal of the lowest visible course to a stub of string past
  // the highest one's nut, so it still reads as levers under strings rather than as a bare grid.
  const block = mandalBlockWidth(mandalCount);
  const x = nutX(lo, count) - block - BODY_LEFT_PAD - LABEL_GAP - LABEL_ROOM - 8;
  const w = nutX(hi, count) + 120 - x;
  return fitAspect({ x, y, w, h });
}

/**
 * Grow a window until it has the same shape as the full view, keeping its centre.
 *
 * ⚠ **Not cosmetic — without it the close-up crops rows off.** An `<svg>` fits its viewBox inside
 * whatever box CSS gives it and pads the leftover dimension, so a window that is a different shape
 * from the element ends up letterboxed: half the frame becomes empty soundboard, and the rows at
 * the very top and bottom of the crop get cut through the middle. Matching the shape means the
 * close-up is a pure magnification of the full view — same element shape, fewer courses in it.
 */
function fitAspect(w: Window): Window {
  const want = VIEW_W / VIEW_H;
  const have = w.w / w.h;
  if (Math.abs(have - want) < 1e-6) return w;
  if (have < want) {
    const grown = w.h * want;
    return { ...w, x: w.x - (grown - w.w) / 2, w: grown };
  }
  const grown = w.w / want;
  return { ...w, y: w.y - (grown - w.h) / 2, h: grown };
}
