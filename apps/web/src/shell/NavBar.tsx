/**
 * The phone's tab bar: Kütüphane · Nota · Düzenle. (UI rebuild, 2026-09-30.)
 *
 * The same three places the old bar had — the library is first now, because it is where every
 * visit starts (upload, or a page read before). Düzenle IS edit mode, as before (`onMobileTab`).
 *
 * ⚠ The DOM contract is unchanged: `#mobile-tabs[data-tab]`, one `[data-tab-id]` per button,
 * `aria-current="page"` on the open one — navigation buttons, not a `role="tablist"`, because the
 * bar does not implement arrow-key traversal and claiming the pattern would promise it.
 * ⚠ It sets `--tabs-h` on <html> so the player bar can sit on top of it.
 */
import { useEffect, useRef } from "react";
import { Library, Music2, PencilLine } from "lucide-react";
import type { MobileTab } from "../ui/MobileTabs";
import { TR } from "../ui/strings";

const ORDER: MobileTab[] = ["pages", "nota", "duzenle"];
const ICON = { pages: Library, nota: Music2, duzenle: PencilLine } as const;

export function NavBar({ tab, onTab }: { tab: MobileTab; onTab: (next: MobileTab) => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const write = () => document.documentElement.style.setProperty("--tabs-h", `${Math.round(el.offsetHeight)}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--tabs-h");
    };
  }, []);

  return (
    <nav
      ref={ref}
      id="mobile-tabs"
      data-tab={tab}
      aria-label={TR.mobile.navLabel}
      className="fixed inset-x-0 bottom-0 z-[55] flex border-t border-rule bg-raised pb-[env(safe-area-inset-bottom,0px)]"
    >
      {ORDER.map((t) => {
        const Icon = ICON[t];
        const on = t === tab;
        return (
          <button
            key={t}
            type="button"
            data-tab-id={t}
            aria-current={on ? "page" : undefined}
            onClick={() => onTab(t)}
            className={
              "relative flex h-14 flex-1 touch-manipulation appearance-none border-0 bg-transparent p-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium tracking-wide transition-colors [-webkit-tap-highlight-color:transparent] " +
              (on ? "text-accent" : "text-ink-faint")
            }
          >
            {/* the open tab is marked with a gold rule over it, like a ribbon marker in a book */}
            {on && <span aria-hidden="true" className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold" />}
            <Icon size={22} strokeWidth={on ? 2 : 1.6} aria-hidden="true" />
            <span>{TR.mobile.tabs[t]}</span>
          </button>
        );
      })}
    </nav>
  );
}
