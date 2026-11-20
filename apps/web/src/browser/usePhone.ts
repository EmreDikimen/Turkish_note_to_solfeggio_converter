/**
 * What shape is this window, and is a finger on it? — the ONE place either question is asked.
 *
 * ⚠ **TWO QUESTIONS, NOT ONE, AND THEY MUST NOT BE MERGED** (docs/APP-RULES.md, owner 2026-09-04):
 *
 *   `isPhone`  — "is this narrow?"        → LAYOUT. Which shell renders, what is on screen.
 *   `coarse`   — "is this being touched?" → SIZES.  44px targets, 16px form fields.
 *
 * They disagree constantly and both answers are right: a touchscreen laptop is `coarse` and not a
 * phone, and a desktop window dragged narrow — which is how this layout is actually reviewed on the
 * Mac — is a phone and not `coarse`. A finger is a finger at any width; a narrow window is narrow
 * with any pointer.
 *
 * ⚠ **This file replaced a SECOND copy of the coarse question** (2026-09-19). `UploadHero` carried
 * its own `useCoarsePointer()`, so the app had two hooks that never agreed on a tablet and could be
 * changed apart. One hook, two booleans.
 *
 * ⚠ 700px is not a free choice: it is the width below which the Perde row's transpose group (433px,
 * measured, and it cannot shrink) stops fitting on one line. An iPad mini at 744px measured clean.
 *
 * ⚠ It WATCHES, it does not read once. A phone that turns sideways crosses the line, and so does a
 * window being dragged.
 *
 * ⚠ `coarse` starts `false` and flips in an effect, deliberately: the first paint is the desktop
 * wording everywhere, and a mouse reading the touch copy for one frame has lost nothing where a
 * phone stuck with the drag-and-drop wording would have lost the instruction. `isPhone` is read
 * synchronously instead — a phone that painted the desktop shell for a frame would flash the whole
 * layout.
 */
import { useEffect, useState } from "react";

export const PHONE_MAX_WIDTH = 700;

const PHONE_MQ = `(max-width: ${PHONE_MAX_WIDTH}px)`;
const COARSE_MQ = "(pointer: coarse)";
/**
 * "Is this a phone-SHAPED screen, whichever way up it is?" — true when the SHORT side is phone-sized.
 *
 * ⚠ A third question, and it exists because `isPhone` could not answer it (2026-09-19). A phone
 * turned sideways is **844×390**: past the 700px line, so `isPhone` goes false and every phone rule
 * switches off at exactly the moment the owner asked them to keep working
 * (*"yan çevirmesi de dahil"*). Measured before the fix: the sheet hid **242px** in landscape while
 * fitting perfectly in portrait.
 *
 * ⚠ It is NOT a replacement for `isPhone`. Layout still asks "is this narrow?", because a landscape
 * phone really is wide and a bottom tab bar over 390px of height would be most of the screen. This
 * answers the different question of whether the DEVICE is a handset, which is what the score's
 * fit-to-box wants to know.
 *
 * ⚠ It deliberately excludes a tablet: an iPad mini is 744×1133, short side 744, over the line —
 * which is the owner's 2026-09-19 call that the tablet keeps the desktop layout.
 */
const PHONE_SHAPED_MQ = `(max-width: ${PHONE_MAX_WIDTH}px), (max-height: ${PHONE_MAX_WIDTH}px)`;

export type Viewport = {
  /** Narrow enough for the phone shell. Drives LAYOUT and nothing else. */
  isPhone: boolean;
  /** A finger, not a pointer. Drives SIZES and copy, at any width. */
  coarse: boolean;
  /** A handset-sized SCREEN in either orientation — see `PHONE_SHAPED_MQ`. Drives the score's fit. */
  phoneShaped: boolean;
};

/** Subscribe to one media query. Returns its current value, and re-reads on subscribe. */
function useMedia(query: string, initial: (mq: MediaQueryList) => boolean): boolean {
  const [on, setOn] = useState(() => {
    if (typeof matchMedia !== "function") return false;
    return initial(matchMedia(query));
  });

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(query);
    const read = () => setOn(mq.matches);
    // ⚠ Re-read on subscribe. Between the first render and this effect the window can already have
    // been resized, and a stale `false` here means a phone drawing the desktop shell.
    read();
    // A tablet with a keyboard folio attached and detached changes the coarse answer while the page
    // is open; a rotation changes the width answer.
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, [query]);

  return on;
}

export function useViewport(): Viewport {
  const isPhone = useMedia(PHONE_MQ, (mq) => mq.matches);
  // Starts false on purpose — see the header.
  const coarse = useMedia(COARSE_MQ, () => false);
  const phoneShaped = useMedia(PHONE_SHAPED_MQ, (mq) => mq.matches);
  return { isPhone, coarse, phoneShaped };
}

/** Layout only. Sugar over `useViewport().isPhone` for the callers that need just the one. */
export function useIsPhone(): boolean {
  return useMedia(PHONE_MQ, (mq) => mq.matches);
}
