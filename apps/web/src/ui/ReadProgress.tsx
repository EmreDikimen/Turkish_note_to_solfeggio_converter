/**
 * The bar and the clock during a read.
 *
 * Honesty rule, inherited from the status line it sits under: the bar only shows a PERCENTAGE
 * where a real count exists. Two phases have one — the deskew sweep (41 rotations) and the
 * browser's per-strip decode — and both arrive already counted. The server decode is a single
 * batched request with no progress to report, so it gets a moving stripe and an elapsed clock,
 * never an invented percentage.
 *
 * ⚠ The clock lives HERE and not inside `#omr-status`: page-smoke counts distinct status texts to
 * prove the read actually advanced, and a ticking second counter would satisfy that for free.
 */

import { useEffect, useState } from "react";
import type { OmrStatus } from "./status";
import { TR } from "./strings";

/** A trailing "12/41" in the phase text is a real count, and the only place one comes from. */
/**
 * How long a server read of `strips` strips usually takes, rounded UP to 5 s (UI review item 13,
 * 2026-11-25). Measured that day on the live service, warm: 22 strips in 45.1 s of server time
 * (2.05 s a strip) and 47–49 s upload-to-notes, so ~4 s on top. n=2 — a lead, re-measure if the
 * model or the container shape changes. A cold start is NOT in it: the waking line says that.
 */
const SECONDS_PER_STRIP = 2.05;
const OVERHEAD_S = 4;
export function expectedSeconds(strips: number): number {
  return Math.ceil((strips * SECONDS_PER_STRIP + OVERHEAD_S) / 5) * 5;
}

function fraction(text: string): number | null {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(text);
  if (!m) return null;
  const [done, total] = [Number(m[1]), Number(m[2])];
  return total > 0 ? Math.min(1, done / total) : null;
}

export function ReadProgress({ status, startedAt }: { status: OmrStatus; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));
  const pct = fraction(status.text);
  // A server decode is one request: no count, so no percentage. Say how long it usually takes
  // instead — an expectation is more use than a bar that cannot move.
  const onServer = status.phase === "decode" && /sunucu/.test(status.text);

  return (
    <div className="kv-progress">
      <div className="kv-progress__track">
        <div
          className={`kv-progress__bar${pct == null ? " is-indeterminate" : ""}`}
          style={pct == null ? undefined : { width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <p className="kv-progress__elapsed">
        {TR.status.elapsed(elapsed)}
        {onServer
          ? ` · ${status.counts?.strips ? TR.status.expectServerN(expectedSeconds(status.counts.strips)) : TR.status.expectServer}`
          : ""}
        {status.phase === "decode" && !onServer ? ` · ${TR.status.expectLocal}` : ""}
      </p>
      {onServer && elapsed >= 15 && <p className="kv-progress__elapsed">{TR.status.coldStart}</p>}
    </div>
  );
}
