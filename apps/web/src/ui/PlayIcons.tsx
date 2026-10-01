/**
 * Play / pause / stop as drawn SVG, never as the ▶ ⏸ ■ characters (owner, 2026-10-01). Android
 * draws ⏸ as an EMOJI — an orange tile — whatever the font says, so the pause button wore an
 * orange square. A drawn icon takes `currentColor` like the label beside it, on every phone.
 */
const box = { width: "0.8em", height: "0.8em", viewBox: "0 0 16 16", "aria-hidden": true, focusable: false } as const;

export function PlayIcon() {
  return (
    <svg className="kv-icon" {...box}>
      <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg className="kv-icon" {...box}>
      <rect x="3" y="2.5" width="3.5" height="11" rx="0.8" fill="currentColor" />
      <rect x="9.5" y="2.5" width="3.5" height="11" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg className="kv-icon" {...box}>
      <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  );
}
