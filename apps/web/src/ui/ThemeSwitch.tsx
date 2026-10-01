/**
 * The light / dark switch (owner, 2026-10-01). A sun-and-moon track, and NO visible words — the
 * owner asked for the caption to go: the sun and the moon say it. (The general rule that a toggle
 * speaks in words stands for the playback toggles; this one is the owner's exception.) The words
 * are kept for screen readers.
 *
 * ⚠ A REAL `<input type="checkbox">` laid over the whole label at opacity 0, the same pattern as
 * `.kv-toggle`: Playwright's `.check()` and a screen reader both get a genuine checkbox.
 * DOM contract: `#theme-switch[data-theme]` (checked = dark).
 */
import { Moon, Sun } from "lucide-react";
import type { Theme } from "../theme";
import { TR } from "./strings";

export function ThemeSwitch({
  theme,
  onTheme,
  className = "",
}: {
  /** Owned by App (`useTheme`), so the theme keeps tracking the system while no switch is drawn. */
  theme: Theme;
  onTheme: (t: Theme) => void;
  className?: string;
}) {
  const setTheme = onTheme;
  const dark = theme === "dark";
  return (
    <label
      className={`kv-theme-switch relative inline-flex cursor-pointer items-center gap-2 text-(length:--text-sm) text-ink-soft select-none ${className}`}
      title={dark ? TR.theme.toLight : TR.theme.toDark}
    >
      <input
        id="theme-switch"
        type="checkbox"
        role="switch"
        data-theme={theme}
        checked={dark}
        onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
      />
      <span
        aria-hidden="true"
        className="relative inline-flex h-7 w-[52px] shrink-0 items-center justify-between rounded-full border border-rule-strong bg-sunken px-1.5 text-ink-faint transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
      >
        <Sun size={13} />
        <Moon size={13} />
        <span
          className={
            "absolute top-0.5 left-0.5 grid size-[22px] place-items-center rounded-full bg-raised text-gold shadow-(--shadow-card) ring-1 ring-gold/50 transition-transform duration-200 " +
            (dark ? "translate-x-6" : "translate-x-0")
          }
        >
          {dark ? <Moon size={13} /> : <Sun size={13} />}
        </span>
      </span>
      {/* The track says it all (owner, 2026-10-01: "işaret belirtiyor zaten") — the words stay for a
          screen reader only. */}
      <span className="kv-visually-hidden">{TR.theme.label}</span>
    </label>
  );
}
