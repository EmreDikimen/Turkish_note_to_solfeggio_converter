/**
 * Whether the developer controls (the "Gelişmiş — geliştirici ayarları" panel) are shown.
 *
 * ⭐ WHY (owner, 2026-10-27, after a closed-test tester asked what that panel was). JSON load, the
 * strip reader, the slice inspector and the raw model output serve the PROJECT, not a reader, so a
 * deployed build hides them. Shown when:
 *   - the dev server is running (`import.meta.env.DEV`) — `tools/checks/app-smoke.ts` opens
 *     `#advanced` there, and it is the panel's only coverage;
 *   - or the device opted in with `?dev=1`, remembered in `localStorage` until `?dev=0` — the same
 *     shape as the visit counter's `?nostats=1`, so the owner can reach the tools on the live site.
 *
 * ⚠ Hece çizgisi and Tekrarlar live in the panel and are hidden with it (owner's choice that day).
 * ⚠ Every storage access is wrapped: in a private window the accessor itself throws.
 */

const KEY = "omrDev";

export function devMode(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    const flag = new URLSearchParams(window.location.search).get("dev");
    if (flag === "1") localStorage.setItem(KEY, "1");
    else if (flag === "0") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
