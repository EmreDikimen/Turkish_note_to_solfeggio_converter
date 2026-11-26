/**
 * The strip that tells an iPhone reader how to put the app on the home screen (owner, 2026-11-06).
 *
 * ⭐ WHY. Android Chrome reads `manifest.webmanifest` and offers "Uygulamayı yükle" on its own — the
 * app has no install button of its own and needs none there. Safari on iOS never offers anything:
 * there is no `beforeinstallprompt`, and the only way in is Paylaş → Ana Ekrana Ekle, which a
 * beginner does not know exists. The `apple-*` tags in `index.html` already make the result look
 * right; this strip only names the two taps.
 *
 * ⚠ Shown only when ALL hold:
 *   - the device is iOS — an iPadOS Safari says "Macintosh", so a touch Mac is counted as an iPad;
 *   - the page is not already running from the home screen (`navigator.standalone`);
 *   - it is not an in-app browser (LinkedIn, Instagram, Facebook): those have no Ana Ekrana Ekle,
 *     and the owner's link went out on LinkedIn, so that is a real case;
 *   - the reader has not closed it before (`localStorage`, wrapped — a private window THROWS).
 * ⚠ Never over the music (UI review item 12, 2026-11-25): CSS hides it whenever a score is on
 *   screen, except on the phone's Sayfalar tab — so it shows on the upload screen and Sayfalar only.
 *
 * DOM contract: `#ios-install-hint[data-omr="ios-install"]`; the close button is
 * `#ios-install-hint-close`.
 */
import { useState } from "react";
import { TR } from "./strings";

const KEY = "omrIosHintClosed";

function shouldShow(): boolean {
  try {
    const ua = navigator.userAgent;
    const ios =
      /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!ios) return false;
    const standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) return false;
    if (/FBAN|FBAV|Instagram|LinkedInApp/.test(ua)) return false;
    return localStorage.getItem(KEY) !== "1";
  } catch {
    return false;
  }
}

/** iOS's own share glyph: a box with an arrow leaving it upwards. */
function ShareGlyph() {
  return (
    <svg
      className="kv-ios-hint__share"
      viewBox="0 0 16 20"
      width="14"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 1v11M4.5 4.5 8 1l3.5 3.5M5.5 8H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IosInstallHint() {
  const [open, setOpen] = useState(shouldShow);
  if (!open) return null;
  return (
    <div id="ios-install-hint" className="kv-ios-hint" data-omr="ios-install" role="note">
      <p className="kv-ios-hint__text">
        {TR.mobile.iosHintLead}{" "}
        <span className="kv-ios-hint__step">
          <ShareGlyph />
          <strong>{TR.mobile.iosHintShare}</strong>
        </span>{" "}
        <strong>{TR.mobile.iosHintAdd}</strong>
        <small className="kv-ios-hint__menu">{TR.mobile.iosHintMenu}</small>
      </p>
      <button
        type="button"
        id="ios-install-hint-close"
        className="kv-ios-hint__close"
        title={TR.mobile.iosHintDismiss}
        aria-label={TR.mobile.iosHintDismiss}
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // A private window: closed for this visit only, which is all it can be.
          }
          setOpen(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
