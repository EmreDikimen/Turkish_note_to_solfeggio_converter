/**
 * The phone's bottom tab bar — four sections, one on screen at a time.
 *
 * WHY it exists (owner, 2026-09-11). On a phone the desktop layout simply stacks: at 375px the
 * whole first screen was the upload box plus the playback and rhythm settings, and the music —
 * the thing the app is for — started below the fold. Worse, edit mode's floating toolbox is
 * `position: fixed` and took the bottom 307px of a 667px screen, i.e. it COVERED the notes it was
 * there to edit. Tabs answer both: the score gets the whole screen, and the tools get their own.
 *
 * ⚠ **It hides nothing by itself.** This component only says which tab is current; every section
 * is hidden and re-flowed by `#app[data-mtab]` rules inside the `(max-width: 700px)` block at the
 * end of `app.css`. That split is deliberate — the sections stay MOUNTED when a tab is not
 * showing, so switching tabs costs no re-engrave and loses no scroll position or selection.
 *
 * ⚠ **Phone only, and that is what keeps every existing browser check valid**: `smoke:editor`,
 * `smoke:app`, `smoke:page` and the gate all run at 1280×720 with a mouse, where `useIsPhone()` is
 * false and this never renders. Same reasoning as the phone CSS living at the end of the
 * stylesheet (docs/APP-RULES.md).
 *
 * ⚠ The icons are INLINE SVG, not glyphs from Bravura. The music font is loaded for the score and
 * a tab bar that borrows it would break the moment the score's font rules changed — and `currentColor`
 * is what lets one icon be right in both themes.
 *
 * The contract a check may read: `#mobile-tabs[data-tab]` and, per button, `[data-tab-id]`.
 * The labels are copy and live in `strings.ts` (docs/DOM-CONTRACT.md).
 */
import { TR } from "./strings";

/** ⚠ **THERE IS NO ÇAL TAB** (owner, 2026-09-26: *"Çal tabını direkt kapatalım ve oradaki her şeyi
 *  Nota tabındaki daha fazla göster kısmında gösterelim"*). It was a settings SCREEN — usul, drums,
 *  makam, transposition, the accidental mode, the voice — reached by leaving the music. All of it
 *  is now the fold under Çal/Dur on the Nota tab, where the score is still on screen behind it. */
export type MobileTab = "nota" | "duzenle" | "pages";

/** The tabs, in the order they are drawn. */
export const MOBILE_TABS: MobileTab[] = ["nota", "duzenle", "pages"];

function Icon({ tab }: { tab: MobileTab }) {
  // 24×24, 1.6px strokes, `currentColor` — so the active/inactive colour is decided by CSS and the
  // icon follows the theme without a second copy.
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (tab === "nota")
    // A quaver: notehead, stem, flag — the least ambiguous "this is the music" mark there is.
    return (
      <svg {...common}>
        <circle cx="8" cy="17.5" r="3" />
        <path d="M11 17.5V5l6 2.2" />
        <path d="M11 9.5l6 2.2" />
      </svg>
    );
  if (tab === "duzenle")
    // A pencil.
    return (
      <svg {...common}>
        <path d="M4 20l1-4L16.2 4.8a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19l-4 1z" />
        <path d="M15 6l3 3" />
      </svg>
    );
  // A stack of pages.
  return (
    <svg {...common}>
      <rect x="4" y="6" width="12" height="14" rx="1.6" />
      <path d="M8 3h10a2 2 0 0 1 2 2v12" />
    </svg>
  );
}

export function MobileTabs({
  tab,
  onTab,
}: {
  tab: MobileTab;
  onTab: (next: MobileTab) => void;
}) {
  return (
    <nav id="mobile-tabs" className="kv-mtabs" data-tab={tab} aria-label={TR.mobile.navLabel}>
      {MOBILE_TABS.map((t) => (
        <button
          key={t}
          type="button"
          className={`kv-mtabs__tab${t === tab ? " is-active" : ""}`}
          data-tab-id={t}
          // `aria-current` rather than `aria-selected`: these are navigation buttons, not the
          // children of a `role="tablist"`, and claiming the tablist pattern would promise
          // arrow-key traversal the bar does not implement.
          aria-current={t === tab ? "page" : undefined}
          onClick={() => onTab(t)}
        >
          <Icon tab={t} />
          <span className="kv-mtabs__label">{TR.mobile.tabs[t]}</span>
        </button>
      ))}
    </nav>
  );
}
