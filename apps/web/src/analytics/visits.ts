/**
 * Tell the site's own counter that somebody arrived, or read a page. The entire client side.
 *
 * Two events and no more: `open` when the app mounts, `read` when a page has actually been decoded.
 * The second is the one that means a human used the product — docs/METRICS-USAGE.md is a long
 * argument with a request log about exactly that distinction, because robots open a page constantly
 * and never upload sheet music.
 *
 * ⚠ **Nothing identifying is sent from here, and nothing here can identify anybody.** The body is a
 * word and, at most, the host the visitor came from. The country and the device are derived on the
 * server from headers the browser sends anyway, and the anonymous per-day id is a salted hash of an
 * IP this module never sees. netlify/shared/visits.ts owns that reasoning.
 *
 * ⚠ **The counter must never be able to break the app.** Every call is fire-and-forget inside a
 * try/catch, the response is not read, and a failure is not retried and not reported. A missing
 * endpoint (a build with no functions behind it) is simply a 404 nobody looks at.
 */

/** Netlify's default path for `netlify/functions/visit.mts`. Same origin, so no CORS is involved. */
const ENDPOINT = "/.netlify/functions/visit";

/** `localStorage.omrNoStats === "1"` switches this device off. See `countingAllowed`. */
const OPT_OUT_KEY = "omrNoStats";

/** ⚠ Swallows everything: `localStorage` throws outright in some privacy modes, it is not merely
 *  empty (the same note App.tsx, EditPalette.tsx and recentPages.ts carry). A device that cannot
 *  remember the opt-out must still be able to use the app. */
function optedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function setOptOut(on: boolean): void {
  try {
    if (on) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* nothing to do — see `optedOut` */
  }
}

/**
 * `?nostats=1` switches this browser off permanently, `?nostats=0` back on.
 *
 * ⭐ This is not a nicety, it is the fix for a measured mistake: docs/METRICS-USAGE.md recorded
 * three page reads as visitors and one of them turned out to be the OWNER'S OWN PHONE, which had to
 * be subtracted by hand afterwards. Run the link once on the owner's devices and the counter stops
 * counting the person reading it.
 */
function readOptOutFlag(): void {
  try {
    const flag = new URLSearchParams(location.search).get("nostats");
    if (flag === "1") setOptOut(true);
    else if (flag === "0") setOptOut(false);
  } catch {
    /* a URL we cannot parse is not a reason to do anything */
  }
}

/**
 * Who is NOT counted, and why each one is on the list.
 *
 * - the dev server: there is no function behind it, and a developer is not a visitor;
 * - `navigator.webdriver`: every browser check in tools/browser/ runs under Playwright, which sets
 *   this. ⚠ **Load-bearing.** `smoke:live` and `smoke:build` drive the REAL deployed site, several
 *   page reads at a time, so without this line the friends-release numbers would be mostly our own
 *   test runs — the same contamination the owner's phone caused once already;
 * - `localhost` / `127.0.0.1` / `[::1]`: a local `vite preview` of a production build;
 * - the opt-out above.
 */
function countingAllowed(): boolean {
  if (import.meta.env.DEV) return false;
  try {
    if (navigator.webdriver) return false;
    const host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "") return false;
  } catch {
    return false;
  }
  return !optedOut();
}

/**
 * Send one event. Returns immediately; the request outlives this call and nobody waits for it.
 *
 * `keepalive` is what lets the beacon survive the page it was fired from — an `open` sent while the
 * app is still mounting would otherwise be cancelled by a visitor who bounces straight back out,
 * which is precisely the visit worth knowing about.
 */
export function noteVisit(kind: "open" | "read"): void {
  readOptOutFlag();
  if (!countingAllowed()) return;
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, ref: document.referrer || undefined }),
      keepalive: true,
      credentials: "omit",
      cache: "no-store",
    }).catch(() => {
      /* see the header: a counter that can raise is a counter that can take the app down */
    });
  } catch {
    /* likewise */
  }
}
