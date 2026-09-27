/**
 * ⚠ **A TEMPORARY DIAGNOSTIC, BEHIND `?tapdebug=1`, AND IT SHOULD BE DELETED WHEN ITS QUESTION IS
 * ANSWERED** (2026-09-27).
 *
 * The owner reports that returning from the instrument view to the score needs several taps. It
 * could not be reproduced here at any scroll depth, with real touch, on a scaled page, or with the
 * CPU throttled 8×, so the next honest step is to measure on the device that has the fault instead
 * of guessing at it again.
 *
 * It prints, for every touch: where the finger landed, which element is actually on top at that
 * point, and whether a `click` followed. A tap that reports the wrong element is a covering bug; a
 * tap with no `click` line is the browser swallowing the gesture; the right element plus a click is
 * the app's own logic.
 *
 * ⚠ Off unless asked for. It attaches nothing and renders nothing without the parameter, so no
 * visitor and no check can meet it.
 */
export function initTapDebug(): void {
  if (!new URLSearchParams(location.search).has("tapdebug")) return;

  const box = document.createElement("div");
  box.setAttribute("data-omr", "tap-debug");
  box.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:38vh;overflow:auto;" +
    "background:rgba(0,0,0,.86);color:#0f0;font:11px/1.35 ui-monospace,monospace;padding:6px 8px;" +
    "pointer-events:none;white-space:pre-wrap";
  document.body.appendChild(box);

  let n = 0;
  const name = (el: Element | null): string => {
    if (!el) return "(hiçbir şey)";
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className ? `.${el.className.split(" ")[0]}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const line = (text: string) => {
    box.textContent = `${++n}. ${text}\n${box.textContent}`.split("\n").slice(0, 14).join("\n");
  };

  addEventListener(
    "pointerdown",
    (e) => {
      const top = document.elementFromPoint(e.clientX, e.clientY);
      // ⚠ `composedPath()[0]` is what the event actually hit; `elementFromPoint` is what is on top.
      // When they disagree, something is covering the control.
      const hit = (e.composedPath()[0] as Element) ?? null;
      line(
        `${Math.round(e.clientX)},${Math.round(e.clientY)} ${e.pointerType} | hedef ${name(hit)} | üstte ${name(top)}` +
          (name(hit) === name(top) ? "" : "  ⚠ FARKLI"),
      );
    },
    { capture: true, passive: true },
  );

  addEventListener(
    "click",
    (e) => line(`   ↳ click -> ${name(e.target as Element)}`),
    { capture: true },
  );
}
