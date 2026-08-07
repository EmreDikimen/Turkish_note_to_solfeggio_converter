/**
 * What KIND of thing went wrong, kept apart from the sentence that says so.
 *
 * Same reasoning as ui/status.ts: the message is user-facing copy and will be reworded and
 * translated, so the deploy checks must not depend on its words. `kind` is rendered onto
 * `#omr-error` as `data-error-kind` and is also what decides which recovery the UI offers —
 * a page with no staves wants photo advice and a retry, a dead model wants the technical detail.
 */

export type ErrorKind =
  /** The slicer found no staves — almost always the photo, not the app. */
  | "no-staves"
  /** The model or the network failed on both the server and the fallback. */
  | "read-failed"
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

/** Classify anything thrown inside a read; `fallback` is what an unlabelled failure counts as. */
export function toAppError(err: unknown, fallback: ErrorKind): AppError {
  return { text: String(err), kind: err instanceof ReadError ? err.kind : fallback };
}
