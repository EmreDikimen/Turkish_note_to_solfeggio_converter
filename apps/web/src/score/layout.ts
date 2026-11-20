/**
 * Page geometry for the engraved score: margins, row pitch, the fixed bottom bars, and the scroll
 * helpers that keep the playhead in view. Split out of SheetView.tsx on 2026-11-20, unchanged.
 */
// --- layout constants -------------------------------------------------------
export const LEFT = 10;
/** The side margin between the SVG's edge and the staff, exported so a caller sizing the drawing to
 *  its own box (the measure card) can ask for the right `contentWidth` instead of guessing 20. */
export const SHEET_SIDE_MARGIN = LEFT;
/** The default staff content area — rows wrap inside this. Exported so a caller that fits the
 *  engraving to a box can tell whether its box is NARROWER than the default and therefore worth
 *  fitting at all; widening past it would re-engrave every wide window for no gain. */
export const SHEET_CONTENT_WIDTH = 1000;
export const NARROW_HEADER_W = 520; // under this the engraved header stacks — see `narrowHeader`
/** How far the fit-to-box scale may shrink the engraving before it gives up and lets the row
 *  scroll instead. 0.65 is where a koma accidental stops being separable from a bakiye at arm's
 *  length; past that a "fitted" page is one nobody can read. */
export const MIN_FIT_SCALE = 0.65;
export const CONTENT_WIDTH = SHEET_CONTENT_WIDTH; // staff content area (rows wrap within this)
export const ROW_HEIGHT = 130; // vertical pitch of each staff system
export const STAVE_TOP_PAD = 40; // headroom above each stave for high notes / beams
export const CLEF_W = 50; // extra width the leading clef costs on the first stave of a row
// ⚠ Kept as the DEFAULT only. The drawing's real size is `svgW` inside the component, derived from
// the `contentWidth` prop — the measure card fits the engraving to its column. Nothing else reads
// this, and a caller that passes no width still gets exactly these numbers.
export const DEFAULT_SVG_WIDTH = LEFT * 2 + CONTENT_WIDTH;
export const CURSOR_MARGIN = 8; // playhead bar extends this far above/below the staff lines
/** The ▲/▼ that step a selected note's pitch — see the render. Bigger under a finger: 32px is the
 *  smallest round target that a thumb hits without also hitting the notehead it sits beside. */
export const STEP_BTN = 22;
export const STEP_BTN_TOUCH = 32;
/** How far each arrow stands off the note's box — the same above and below, so the pair is
 *  symmetric. ⚠ Must stay above 16: that is how far the ✕ reaches above the box, and the ▲ clears
 *  it by height rather than by stepping sideways. */
export const STEP_GAP = 20;

// --- following the playhead (owner, 2026-09-03) -----------------------------
//
// While the piece plays, the cursor walks down a sheet that is taller than the window, so it
// leaves the screen and the reader has to chase it by hand. With `followPlayhead` on, the page
// goes to the cursor instead.
//
// ⚠ ONCE PER ROW, AND ONLY WHEN THE ROW IS OFF THE SCREEN (owner, 2026-09-03: *"sadece row
// değiştiğinde tetiklensin"*). The trigger is the cursor moving to a NEW staff row, not the clock:
// inside a row the page never moves, whatever the reader does with it, so nothing can shift under
// a pointer mid-bar and a reader who scrolls away to look at something else is left alone until the
// music turns the corner. It also costs nothing — one box read per row instead of one per frame,
// and no cooldown, because a scroll that is asked for once cannot restart its own animation.
// ⚠ Consequence, and it is deliberate: on a window too narrow for the sheet the SIDEWAYS follow
// also fires only at a row change, so a cursor crossing a wide row leaves the box until then.
export const FOLLOW_MARGIN = 32; // px of the window's edge that counts as already "off the page"
export const FOLLOW_AIM = 0.35; // after a scroll the cursor's row sits this far down the window
// How much hidden width a sideways scroller must have before this axis is followed at all. On a
// wide window the 1020 px sheet overruns `.kv-score`'s content box by about 2 px — absorbed by its
// own padding, invisible to anyone — and yet a cursor near the end of a row reads as past the right
// margin, so the sheet would twitch sideways in the middle of playback for no reader's benefit.
// Below this the box counts as fitting; above it (a narrow window, a phone) the cursor really can
// be off to the right, which is the case this axis exists for.
export const FOLLOW_SIDE_MIN = 48;
// The Çalma row is pinned to the top of the window (owner, 2026-09-05), so the top of the screen is
// not the top of the READABLE area: a row parked at y = 40 is on screen and behind the bar. Its
// live box is read rather than its height, and that is what makes the same number right in both
// states — stuck, `bottom` is the bar's height; unstuck, it is wherever the bar sits down the page,
// and the score below it is lower still, so nothing is triggered that was not triggered before.
// Returns 0 where there is no bar at all (the render harness mounts this view on its own).
export function pinnedBottom(): number {
  const el = typeof document === "undefined" ? null : document.getElementById("transport-pinned");
  return el ? Math.max(0, el.getBoundingClientRect().bottom) : 0;
}

/**
 * The top of whatever is fixed across the BOTTOM of the window, or the window's own floor.
 *
 * ⚠ The mirror of `pinnedBottom()`, and it exists for the same reason (2026-09-19): the readable
 * band is the window MINUS its furniture, at both ends. On a phone a bar is fixed to the bottom —
 * 56px of tab bar plus the home indicator — so a cursor "on screen" by `window.innerHeight` can be
 * completely behind it, and the follow would decline to scroll a row the reader cannot see.
 *
 * ⚠ Measured off the real box, never from a constant: the bar's height changes with the safe-area
 * inset, and the height of a thing is the thing's business. Ids rather than a class so the phone
 * shell can replace the bar without the follow noticing; an id that is absent contributes nothing.
 */
export const BOTTOM_BARS = ["mobile-tabs", "phone-bar"];

export function fixedBottomTop(): number {
  const floor = typeof window === "undefined" ? 0 : window.innerHeight;
  if (typeof document === "undefined") return floor;
  let top = floor;
  for (const id of BOTTOM_BARS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const box = el.getBoundingClientRect();
    // Only a bar that is actually ON the floor counts. A hidden one reports a zero-height box, and
    // one scrolled out of the way is not an obstruction.
    if (box.height > 0 && box.bottom >= floor - 1) top = Math.min(top, box.top);
  }
  return top;
}
export const SIG_GLYPH_ADVANCE = 13; // horizontal space each key-signature accidental occupies
// Baseline of the lyric line below the bottom staff line. MUST stay inside the strip crop, which
// ends 106 px below the stave top = 26 px below the bottom staff line (stripExport's PAD_TOP +
// STAFF_H). At the old value of 30 the baseline fell 4 px BELOW the crop, so training strips
// caught only the ascender tips of each syllable while real crops carry whole letterforms
// (measured: 11% of synthetic strips had ink outside the staff band vs 42-52% of real ones).
export const LYRIC_DY = 24;
// Staff line each signature accidental sits on (VexFlow treble: F5=line0, B4=line2, E4=line4),
// choosing an octave that keeps every letter on the staff.
export const SIG_LINE: Record<string, number> = { C: 1.5, D: 1, E: 0.5, F: 0, G: 3, A: 2.5, B: 2 };

// --- print realism (render automation only; pixels, never labels) ------------
//
// Real printed staff lines are FATTER relative to the staff than ours, and their weight varies
// between editions and scans. Measured on strips normalised to a 30 px staff space
// (ml/labels/domain_gap.py): thickness/spacing was 0.100 for every synthetic strip (SD 0.02 —
// literally constant) against 0.128-0.159 across the three real pools. VexFlow strokes staff
// lines at lineWidth 1 on a 10 px staff space; this range straddles the real mean and gives the
// per-render variation the corpus had none of.
export const STAFF_LINE_WIDTH = { min: 1.0, max: 1.75 } as const;

/**
 * The nearest ancestor that can actually scroll SIDEWAYS, or null when nothing can.
 *
 * Found by MEASUREMENT, not by class name: the sheet's sideways scroll belongs to `.kv-score`
 * today (styles/app.css), but this view is also mounted by the render harness, and "there is more
 * content here than box" is true wherever the container ends up. ⚠ The vertical axis is
 * deliberately not looked for — `.kv-score` is `overflow-y: clip` on purpose (the sheet must not
 * grow a second scrollbar), so the only thing that scrolls up and down is the page itself.
 *
 * ⚠ BOTH tests are needed, and the overflow one is the trap. A box can hold more content than it
 * shows and still not scroll: on a narrow window the sheet's own wrapper is 1020 px wide inside a
 * ~600 px column with `overflow: visible`, so it reports 420 px of hidden width — and setting its
 * `scrollLeft` does exactly nothing. It sits INSIDE `.kv-score`, so it was found first and the
 * sideways follow was dead on every window narrow enough to need it. `smoke:editor` caught it.
 */
export function sideScrollerOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.scrollWidth <= p.clientWidth + FOLLOW_SIDE_MIN) continue;
    const overflow = getComputedStyle(p).overflowX;
    if (overflow === "auto" || overflow === "scroll") return p;
  }
  return null;
}

/**
 * Bring the playhead back on screen if it has left it. Called once per staff row — see FOLLOW_*.
 *
 * Two different scrollers, because the sheet has two axes and they are not the same object: down
 * the PAGE (the window), and across the sheet's own box (`sideScrollerOf`). Each axis is touched
 * only when the cursor is really outside the readable band, so a new row that is already on screen
 * moves nothing.
 */
export function followCursorIntoView(cursor: HTMLElement): void {
  const box = cursor.getBoundingClientRect();
  if (box.height === 0) return; // hidden — there is nothing to follow yet
  // Obey the reader's own OS setting: same jump, no animation.
  const behavior: ScrollBehavior =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  const topEdge = pinnedBottom() + FOLLOW_MARGIN;
  // ⚠ The floor is the bottom BAR, not the window — see `fixedBottomTop`. On a phone the two differ
  // by the height of the tab bar, and a row hidden behind it used to count as "already on screen".
  const bottomEdge = fixedBottomTop() - FOLLOW_MARGIN;
  if (box.top < topEdge || box.bottom > bottomEdge) {
    // Park the row a third of the way down the window, so there is music AHEAD of the cursor and
    // not only behind it. The browser clamps this at both ends of the document. ⚠ 35% of the window
    // is well below the pinned bar and well above the bottom one, so the landing spot needs no
    // correction of its own at either end.
    window.scrollTo({ top: Math.max(0, window.scrollY + box.top - window.innerHeight * FOLLOW_AIM), behavior });
  }

  const scroller = sideScrollerOf(cursor);
  if (scroller) {
    const left = box.left - scroller.getBoundingClientRect().left;
    const width = scroller.clientWidth;
    if (left < FOLLOW_MARGIN || left > width - FOLLOW_MARGIN) {
      scroller.scrollTo({ left: Math.max(0, scroller.scrollLeft + left - width / 2), behavior });
    }
  }
}
