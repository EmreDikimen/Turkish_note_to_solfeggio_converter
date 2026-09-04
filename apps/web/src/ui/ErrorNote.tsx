/**
 * `#omr-error` — what went wrong, and what to do about it.
 *
 * Kept as a separate element from `#omr-status` (rather than a status variant) because the deploy
 * checks treat "an error appeared" as a terminal condition and poll for it independently.
 *
 * The kind decides the recovery: a page with no staves gets photo advice, because that failure is
 * almost always the photograph rather than the app; a dead model gets the raw error folded into a
 * <details>, where it is available to us and out of the way of everyone else.
 */

import type { AppError } from "./errors";
import { TR } from "./strings";

/** The friendly lead for each kind; the raw text goes in the details tail. */
function lead(error: AppError): string {
  if (error.kind === "no-staves") return TR.errors.noStaves;
  if (error.kind === "read-failed") return TR.errors.readFailed;
  if (error.kind === "server-unavailable") return TR.errors.serverUnavailable;
  return error.text;
}

/** The tips under the lead, for the two kinds where a person can act on something. */
function tips(error: AppError): readonly string[] | null {
  if (error.kind === "no-staves") return TR.errors.noStavesTips;
  if (error.kind === "server-unavailable") return TR.errors.serverUnavailableTips;
  return null;
}

export function ErrorNote({ error }: { error: AppError | null }) {
  if (!error) return null;
  const showRaw = error.kind !== "file" && error.text !== lead(error);
  return (
    <div id="omr-error" data-error-kind={error.kind} className="kv-error" role="alert">
      <strong>
        {TR.errors.lead} {lead(error)}
      </strong>

      {tips(error) && (
        <ul className="kv-error__tips">
          {tips(error)!.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      {showRaw && (
        <details>
          <summary>{TR.errors.detail}</summary>
          <code>{error.text}</code>
        </details>
      )}
    </div>
  );
}
