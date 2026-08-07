/**
 * `#omr-status` — the progress/summary line for a read.
 *
 * Renders the sentence for the person, and the facts as data attributes for the deploy checks
 * (the contract is documented in ui/status.ts, which is the only place that produces them).
 *
 * ⚠ Nothing that ticks on a timer may render inside this element. `tools/browser/page-smoke.ts`
 * counts DISTINCT textContent values to prove the phase actually advanced during a read; an
 * elapsed-seconds counter in here would make that check pass for free. Put tickers in a sibling.
 */

import type { OmrStatus } from "./status";

export function StatusLine({ status }: { status: OmrStatus | null }) {
  if (!status) return null;
  const busy = status.state === "busy";
  const c = status.counts;
  return (
    <p
      id="omr-status"
      data-state={status.state}
      data-kind={status.kind}
      data-phase={status.phase}
      data-where={status.where}
      data-staves={c?.staves}
      data-strips={c?.strips}
      data-notes={c?.notes}
      data-measures={c?.measures}
      data-warnings={status.warnings}
      style={{ color: busy ? "#0a58ca" : "#666", margin: "8px 0" }}
    >
      {busy ? "⏳ " : "✓ "}
      {status.text}
    </p>
  );
}
