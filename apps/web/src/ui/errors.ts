/**
 * What KIND of thing went wrong, kept apart from the sentence that says so.
 *
 * Same reasoning as ui/status.ts: the message is user-facing copy and will be reworded and
 * translated, so the deploy checks must not depend on its words. `kind` is rendered onto
 * `#omr-error` as `data-error-kind` and is also what decides which recovery the UI offers —
 * a page with no staves wants photo advice and a retry, a dead model wants the technical detail.
 */

import { LocalDecodeRefusedError } from "../omr/remote";

export type ErrorKind =
  /** The slicer found no staves — almost always the photo, not the app. */
  | "no-staves"
  /** The model or the network failed on both the server and the fallback. */
  | "read-failed"
  /**
   * The decode server did not answer and reading on this machine is off by policy (owner,
   * 2026-09-04). Deliberately NOT `read-failed`: nothing is broken, the app declined to use the
   * visitor's own CPU and 211 MB of their data, and the recovery is to wait rather than to
   * check anything. `omr/remote.ts` is where that decision is made.
   */
  | "server-unavailable"
  /** A file the user supplied could not be used (bad JSON, wrong schema, missing sample). */
  | "file";

export type AppError = { text: string; kind: ErrorKind };

/** An error that already knows what kind it is. */
export class ReadError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string
  ) {
    super(message);
    this.name = "ReadError";
  }
}

/**
 * Classify anything thrown inside a read; `fallback` is what an unlabelled failure counts as.
 *
 * The one thing classified by TYPE rather than by label is the refused local decode: it is thrown
 * deep in `omr/remote.ts`, which cannot import this module (ui → omr is the allowed direction, as
 * in ui/status.ts), so the mapping lands here instead of being repeated at every catch site.
 */
export function toAppError(err: unknown, fallback: ErrorKind): AppError {
  // `text` stays the raw message on purpose: ErrorNote shows the friendly lead and folds this into
  // its <details>, which is where the server's actual reason has to survive to be debuggable.
  if (err instanceof LocalDecodeRefusedError)
    return { text: String(err), kind: "server-unavailable" };
  return { text: String(err), kind: err instanceof ReadError ? err.kind : fallback };
}
