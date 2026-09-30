import { useId } from "react";

/**
 * A girih-style lattice of eight-pointed stars joined by their points — the ground of a tiled
 * panel, drawn as a repeating SVG <pattern>. It fills its positioned parent and sits BEHIND the
 * content at a whisper of opacity, so it is felt rather than read.
 *
 * Only on the empty upload screen (owner, 2026-09-30: ornament "ince ve ölçülü" — subtle). Never
 * under the score: `.kv-score` is the training-strip source and gets nothing drawn into it.
 */
export function TezhipPattern({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" focusable="false" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <pattern id={`tz-${id}`} width="56" height="56" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
            {/* the star at the tile's centre */}
            <rect x="18" y="18" width="20" height="20" />
            <rect x="18" y="18" width="20" height="20" transform="rotate(45 28 28)" />
            {/* the four quarter-stars at the corners, which join into whole stars across tiles */}
            <path d="M0 -10 L10 0 L0 10 L-10 0 Z" />
            <path d="M56 -10 L66 0 L56 10 L46 0 Z" />
            <path d="M0 46 L10 56 L0 66 L-10 56 Z" />
            <path d="M56 46 L66 56 L56 66 L46 56 Z" />
            {/* the strapwork that ties each star to its neighbours */}
            <path d="M10 0 L18 18 M46 0 L38 18 M10 56 L18 38 M46 56 L38 38" />
          </g>
          <circle cx="28" cy="28" r="2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#tz-${id})`} />
    </svg>
  );
}
