/**
 * The one text box the app has for renaming a stored page (owner, 2026-09-05).
 *
 * Two places rename: the row in `#recent` and the score card's own heading. They look nothing alike
 * — one is a list row, the other is a card title — so what is shared is this box and its keyboard
 * rules, not the chrome around it. Each caller owns whether it is editing; this owns what the keys
 * do.
 *
 * The rules, and each is a decision:
 *   * **Enter commits, Esc cancels, and blur commits.** Blur-commits because clicking away from a
 *     box you have just typed into means the typing, not a discard; Esc is the deliberate way out.
 *     ⚠ Esc must therefore suppress the blur that follows it, which is what `cancelled` is for.
 *   * **An empty name is a cancel, not a rename.** `renamePage` refuses it too — the store is the
 *     authority — but refusing it here as well means the box does not close on a name that was not
 *     taken.
 *   * **It selects its whole contents on mount.** A rename is usually a replacement, and the
 *     default name is a file stem nobody wants to keep.
 *
 * ⚠ It carries `[data-omr="rename-input"]` with the record's id, so a check can rename without
 * matching any of the copy around it.
 */

import { useEffect, useRef, useState } from "react";
import { MAX_NAME } from "../recentPages";
import { TR } from "./strings";

export function RenameField({
  id,
  value,
  onCommit,
  onCancel,
}: {
  /** The record being renamed — published as `data-page-id` so a check can aim at it. */
  id: string;
  value: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const cancelled = useRef(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function commit() {
    if (cancelled.current) return;
    const clean = text.trim();
    if (!clean || clean === value) onCancel();
    else onCommit(clean);
  }

  return (
    <input
      ref={ref}
      className="kv-rename"
      type="text"
      data-omr="rename-input"
      data-page-id={id}
      aria-label={TR.recent.renameTitle(value)}
      maxLength={MAX_NAME}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelled.current = true;
          onCancel();
        }
        // ⚠ The score card listens for Ctrl/⌘+Z and the sheet for arrow keys and Delete; neither
        // may reach a box someone is typing a page name into.
        e.stopPropagation();
      }}
      // A row's own click opens the page. A click inside the box must not.
      onClick={(e) => e.stopPropagation()}
    />
  );
}
