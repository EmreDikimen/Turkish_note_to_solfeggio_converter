/**
 * Recover a page that outlived its own deploy.
 *
 * ⭐ WHY (owner, 2026-10-16). Netlify serves only the CURRENT deploy's files, and Vite names every
 * chunk by its content hash. A reader who opened the app before a deploy and reads their first
 * page after it asks for the OLD lazy chunk (`omr/page`, the slicer — measured that day:
 * `page-D2y8mu7_.js` became `page-Co_w4ZoF.js`) and gets a 404, so the read fails until they
 * reload. Nothing else is at risk — saved pages live in IndexedDB and the decode server did not
 * change — but the failed read looked like a broken app.
 *
 * The cure is the one Vite documents: on a chunk that will not load, say so and reload once.
 *
 * ⚠ ONCE per minute, remembered in `sessionStorage`. A chunk missing for some OTHER reason (the
 * network, a broken deploy) would otherwise reload forever. If storage itself throws (private
 * modes do), the guard does nothing and the ordinary error shows — never a loop.
 * ⚠ It only helps pages opened AFTER the deploy that shipped it; a page already open runs the code
 * it loaded.
 */

const KEY = "omrStaleReloadAt";
const ONCE_PER_MS = 60_000;

/** The messages browsers give for a dynamic import that could not be fetched (Chrome, Firefox, Safari). */
const STALE_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return STALE_RE.test(msg);
}

/** True when this tab may reload now (and records that it did); false inside the one-minute window. */
export function claimReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < ONCE_PER_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Vite's own signal for a chunk whose preload failed. Installed once, from `main.tsx`. */
export function installStaleBuildGuard(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (!claimReload()) return;
    event.preventDefault();
    window.location.reload();
  });
}
