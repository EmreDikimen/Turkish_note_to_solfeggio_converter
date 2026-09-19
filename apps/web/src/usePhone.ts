/**
 * Is the window phone-shaped? — the ONE place the phone breakpoint is a number in TypeScript.
 *
 * The phone layout is a SPLIT job: `styles/app.css` hides and re-flows the sections, React draws
 * the bottom tab bar that says which section is showing. The two therefore have to agree on where
 * "phone" starts, and a disagreement is invisible in review — it shows up on a device as a tab bar
 * with nothing under it, or as a page whose sections are hidden with no tab bar to bring them back.
 *
 * ⚠ 700px is not a free choice. It is the `@media (max-width: 700px)` block at the END of
 * `app.css`, which owns LAYOUT on a phone; the `(pointer: coarse)` block beside it owns SIZES and
 * answers a different question (docs/APP-RULES.md). Change one and the other must move with it.
 *
 * ⚠ It watches, it does not read once. A phone that turns sideways crosses this line, and so does
 * a desktop window dragged narrow — which is how this layout is actually reviewed on the Mac.
 */
export const PHONE_MAX_WIDTH = 700;

import { useEffect, useState } from "react";

export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(
    () => window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    const onChange = () => setIsPhone(mq.matches);
    // Re-read on subscribe: between the first render and this effect the window can already have
    // been resized, and a stale `false` here means a phone with no tab bar.
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isPhone;
}
