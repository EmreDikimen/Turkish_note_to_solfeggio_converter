/**
 * `#omr-error` — what went wrong, with `data-error-kind` for the deploy checks.
 *
 * Kept as a separate element from `#omr-status` (rather than a status variant) because the checks
 * treat "an error appeared" as a terminal condition and poll for it independently.
 */

import type { AppError } from "./errors";

export function ErrorNote({ error }: { error: AppError | null }) {
  if (!error) return null;
  return (
    <p id="omr-error" data-error-kind={error.kind} style={{ color: "crimson" }}>
      Error: {error.text}
    </p>
  );
}
