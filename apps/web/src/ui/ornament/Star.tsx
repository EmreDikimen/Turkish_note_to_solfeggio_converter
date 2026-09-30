/**
 * The eight-pointed star (sekiz köşeli yıldız) — two squares, one turned 45°, the commonest knot in
 * Ottoman illumination and tile work. Every ornament in the app is built from this one shape, so
 * the page speaks one decorative language. Drawn, not a glyph: no font can be relied on for it.
 *
 * ⚠ Decoration only: `aria-hidden`, `currentColor` (the caller sets gold), never inside `.kv-score`.
 */
export function Star({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-12 -12 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <rect x="-7.5" y="-7.5" width="15" height="15" />
        <rect x="-7.5" y="-7.5" width="15" height="15" transform="rotate(45)" />
      </g>
      <circle r="2.2" fill="currentColor" />
    </svg>
  );
}
