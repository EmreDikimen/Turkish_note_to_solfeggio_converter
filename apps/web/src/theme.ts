/**
 * Light or dark — one answer, on `<html data-theme>`. (Owner, 2026-10-01: *"dark mode light mode
 * geçişini yapan bir switch olsun"*.)
 *
 * Until the reader touches the switch, the app follows the system (`prefers-color-scheme`), as it
 * did before. Touching it stores an explicit choice in this browser, which then wins.
 *
 * ⚠ THE FIRST PAINT IS DECIDED BY AN INLINE SCRIPT IN `index.html`, NOT HERE. A module loads after
 * the stylesheet is applied, so deciding the theme in React would flash the light page on every
 * dark visit. That script and `resolveTheme` below must agree — same key, same rule.
 * ⚠ A RENDER JOB (the URL carries `mode`) is ALWAYS light, whatever is stored: training strips are
 * cut from the light page (docs/features/look.md).
 * ⚠ Every storage access is wrapped: in a private window the accessor itself throws, and a page
 * that would not open because it could not remember a colour is the worse bug.
 * ⚠ The CSS reads ONLY `:root[data-theme="dark"]` — never `prefers-color-scheme` — so there is one
 * source of truth and the switch cannot fight a media query.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export const THEME_KEY = "kv.theme";
const BROWSER_BAR = { light: "#f7f4ec", dark: "#12151f" } as const; // tokens.css --paper

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function renderJob(): boolean {
  return new URLSearchParams(location.search).has("mode");
}

export function resolveTheme(): Theme {
  if (renderJob()) return "light";
  return stored() ?? system();
}

/** Put the theme on the page: the attribute the CSS reads, and the browser's own bar colour. */
export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = BROWSER_BAR[t];
    m.removeAttribute("media");
  });
}

/** The current theme, a setter that remembers it, and live tracking of the system until then. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(resolveTheme);

  useEffect(() => applyTheme(theme), [theme]);

  // Follow the system only while the reader has not chosen.
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!stored() && !renderJob()) setThemeState(system());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* remembering the choice is a convenience, never a requirement */
    }
    setThemeState(t);
  }, []);

  return [theme, setTheme];
}
