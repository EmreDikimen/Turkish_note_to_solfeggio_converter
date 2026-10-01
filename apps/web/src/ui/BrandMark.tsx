import { LOGO_INK_VIEWBOX, LOGO_MARKS } from "./logoMarks";

/**
 * The logo's three marks beside the wordmark — no tile (owner, 2026-10-01). Each mark is coloured
 * by a theme token (`.kv-brand__mark--<role>` in app.css), never its fixed icon `fill`, so the
 * night palette lightens them with everything else.
 */
export function BrandMark() {
  return (
    <svg className="kv-brand__mark" viewBox={LOGO_INK_VIEWBOX} aria-hidden="true" focusable="false">
      {LOGO_MARKS.map((m) => (
        <path key={m.role} className={`kv-brand__mark--${m.role}`} transform={m.transform} d={m.d} />
      ))}
    </svg>
  );
}
