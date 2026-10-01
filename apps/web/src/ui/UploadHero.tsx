/**
 * The upload area — the first thing a friend sees, and the whole product in one gesture.
 *
 * Three ways in, one way through: the picker, drag-and-drop, and paste (⌘/Ctrl+V, which is the
 * natural gesture for someone screenshotting a PDF). All three call `onFile`, so there is exactly
 * one read path to reason about.
 *
 * After a read it collapses (`is-compact`) to a slim strip so the score gets the page; the
 * finished status line sits under it either way.
 *
 * ⚠ `#page-input` stays a real <input type=file> in the DOM, hidden with the clip pattern rather
 * than `display:none` — the deploy checks call setInputFiles on it, and `display:none` would also
 * drop it from the accessibility tree. `#omr-status` and `#omr-error` each have exactly ONE mount
 * point below, in every state, because the checks poll them by id.
 */

import { useEffect, useState } from "react";
import { ReadProgress } from "./ReadProgress";
import { StatusLine } from "./StatusLine";
import { ErrorNote } from "./ErrorNote";
import type { OmrStatus } from "./status";
import type { AppError } from "./errors";
import { TR } from "./strings";
import { useViewport } from "../usePhone";
import { TezhipPattern } from "./ornament/TezhipPattern";

/**
 * ⚠ The touch copy is decided by `useViewport().coarse`, NOT by the width.
 *
 * The three ways in are not three ways in on a phone: there is nothing to drag a file from, and no
 * ⌘/Ctrl to paste with. Saying so anyway is not merely noise — it is an instruction a friend cannot
 * follow, printed under the one button that works. So the copy asks the pointer, which is also true
 * of a touchscreen laptop at full width.
 *
 * ⚠ It used to be a SECOND hook living in this file; it moved to `usePhone.ts` on 2026-09-19 so the
 * app has one answer to "is a finger on this?" rather than two that could drift.
 * ⚠ It changes COPY and nothing else. No `data-*` attribute moves with it, so every deploy check is
 * blind to which wording is up — the standing rule for user-facing strings (status.ts).
 */
export function UploadHero({
  compact,
  busy,
  status,
  error,
  startedAt,
  onFile,
}: {
  compact: boolean;
  busy: boolean;
  status: OmrStatus | null;
  error: AppError | null;
  /** When the current read began, for the elapsed clock. Null when nothing is running. */
  startedAt: number | null;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const { coarse: touch } = useViewport();

  // Paste is a window-level gesture: a friend hits ⌘V without focusing anything first.
  useEffect(() => {
    if (busy) return;
    function onPaste(e: ClipboardEvent) {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        onFile(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, onFile]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (file) onFile(file);
  }

  return (
    <section className={`kv-hero${compact ? " is-compact" : ""}`}>
      {/* No title over the box (owner, 2026-10-01): the box already says what to do.
          ⚠ ONE BUTTON, AND IT IS THE GALLERY (owner, 2026-10-01). A camera button (`capture`) sat
          beside it for a day; it went because the model still reads camera photos poorly, and
          because one button cannot offer both on newer Android pickers — the phone decides. */}
      <label
        htmlFor="page-input"
        className={`kv-drop${dragging ? " is-dragover" : ""}${busy ? " is-busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          id="page-input"
          className="kv-visually-hidden"
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // re-picking the same file must fire change again
            if (file) onFile(file);
          }}
        />
        {/* The tiled ground — only on the full-size box, never on the slim strip a read leaves. */}
        {!compact && <TezhipPattern className="text-gold opacity-[0.09]" />}

        {busy && status ? (
          <>
            <span className="kv-drop__lead">{status.text}</span>
            {startedAt != null && <ReadProgress status={status} startedAt={startedAt} />}
          </>
        ) : (
          <>
            <span className="kv-drop__lead">
              {compact ? TR.hero.leadCompact : touch ? TR.hero.leadTouch : TR.hero.lead}
            </span>
            {!compact && (
              <span className="kv-btn kv-btn--primary">{touch ? TR.hero.pickTouch : TR.hero.pick}</span>
            )}
            {/* ⚠ On a touch device the paste half is DROPPED rather than reworded. There is no
                third gesture to name — the button above already says both of the two that exist —
                and what is left is the one line that is true everywhere: what the file must be and
                how long it will take. */}
            <span className="kv-drop__hint">
              {compact || touch ? TR.hero.hint : `${TR.hero.hintPaste} · ${TR.hero.hint}`}
            </span>
          </>
        )}
      </label>

      {/* One mount point each, in every state. While a read runs the dropzone shows the same
          phase text visually, so this is hidden from sight but never from the DOM. */}
      <StatusLine status={status} visuallyHidden={busy} />
      <ErrorNote error={error} />
    </section>
  );
}
