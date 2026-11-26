/**
 * `#recent` — the pages this browser has already read, offered back by name.
 *
 * The list a reader lands on when they come back: one row per stored page, click to open, ✕ to
 * forget. What is behind it, and why it is a cache rather than a save, is written up in
 * `apps/web/src/browser/recentPages.ts`; this file only draws it.
 *
 * ⚠ It renders NOTHING when the store is empty — no heading, no empty state. A first-time visitor
 * has one thing to do (upload a page) and an empty box above the fold competes with it for no gain;
 * the list appears the moment there is something in it, which is also when it becomes useful.
 *
 * ⚠ The deploy checks read `data-*`, never this copy (the standing rule, ui/status.ts):
 * `#recent[data-count]` is how many pages are stored, `[data-open]` whether the list is unfolded,
 * `[data-current]` the id of the page on screen, and each row carries
 * `[data-omr="recent-item"][data-page-id][data-page-name][data-page-makam]` with
 * `[data-omr="recent-open"]` / `"recent-remove"` / `"recent-rename"` inside it. `data-count` is the
 * load-bearing one: it is the only proof a page was stored at all, and `data-page-name` is what a
 * rename is asserted on — the visible name is user DATA, not copy, so reading it off an attribute
 * rather than a text node is the same rule, not an exception to it.
 */

import { useState } from "react";
import type { RecentMeta } from "../browser/recentPages";
import { RenameField } from "./RenameField";
import { TR } from "./strings";

/** "5 Eylül 2026 14:32" in the reader's own locale conventions, Turkish first. */
function when(ts: number): string {
  try {
    return new Date(ts).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function RecentPages({
  items,
  currentId,
  busy,
  onOpen,
  onRemove,
  onRename,
  onClear,
}: {
  items: readonly RecentMeta[];
  /** The stored page currently on screen, so the list can mark it. Null for any other score. */
  currentId: string | null;
  /** A read is running: opening a stored page mid-read would race the decode that is finishing. */
  busy: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onClear: () => void;
}) {
  // Which row is being renamed, or null. ⚠ A POSITION in the store, not in the list: the list
  // re-sorts under it (a save moves a page to the top), and an index would then rename the wrong
  // page. It is dropped whenever the rename ends, however it ends.
  const [renaming, setRenaming] = useState<string | null>(null);

  if (!items.length) return null;

  return (
    <section
      id="recent"
      className="kv-recent"
      data-omr="recent"
      data-count={items.length}
      data-current={currentId ?? undefined}
    >
      <div className="kv-recent__head">
        <h2 className="kv-recent__title">{TR.recent.title}</h2>
        <span className="kv-recent__count">{TR.recent.count(items.length)}</span>
      </div>

      {/* ⭐ ALWAYS OPEN (owner, 2026-11-25, UI review item 11): Sayfalar IS this list's tab, so a
          fold there cost a tap and saved nothing. It used to fold away once a score was loaded. */}
      {(
        <>
          <ul className="kv-recent__list" id="recent-list">
            {items.map((it) => (
              <li
                key={it.id}
                className="kv-recent__item"
                data-omr="recent-item"
                data-page-id={it.id}
                data-page-name={it.name}
                data-page-makam={it.makam || undefined}
                data-current={it.id === currentId ? "1" : undefined}
              >
                {renaming === it.id ? (
                  <div className="kv-recent__editing">
                    <RenameField
                      id={it.id}
                      value={it.name}
                      onCommit={(name) => {
                        setRenaming(null);
                        onRename(it.id, name);
                      }}
                      onCancel={() => setRenaming(null)}
                    />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="kv-recent__open"
                      data-omr="recent-open"
                      title={TR.recent.openTitle(it.name)}
                      disabled={busy}
                      onClick={() => onOpen(it.id)}
                    >
                      <span className="kv-recent__name">
                        {/* ⚠ The makam is its own element, drawn BEFORE the name and never merged
                            into it: it is re-read from the score on every save, so it stays right
                            through a rename and through the reader changing the makam later. */}
                        {it.makam && <span className="kv-recent__makam">{it.makam}</span>}
                        <span className="kv-recent__stem">{it.name}</span>
                      </span>
                      <span className="kv-recent__meta">
                        {TR.recent.summary(it.notes, it.measures)} · {when(it.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="kv-recent__icon"
                      data-omr="recent-rename"
                      title={TR.recent.renameTitle(it.name)}
                      aria-label={TR.recent.renameTitle(it.name)}
                      onClick={() => setRenaming(it.id)}
                    >
                      {TR.recent.rename}
                    </button>
                    <button
                      type="button"
                      className="kv-recent__icon kv-recent__remove"
                      data-omr="recent-remove"
                      title={TR.recent.removeTitle(it.name)}
                      aria-label={TR.recent.removeTitle(it.name)}
                      onClick={() => onRemove(it.id)}
                    >
                      {TR.recent.remove}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="kv-recent__foot">
            <p className="kv-recent__note">{TR.recent.note}</p>
            <button
              id="recent-clear"
              type="button"
              className="kv-btn kv-btn--ghost"
              onClick={() => {
                // ⚠ The one confirm in the app. Every other destructive action here is undoable
                // (the editor's ✕ is on the undo stack); this one is not, and it takes every page
                // at once.
                if (typeof confirm !== "function" || confirm(TR.recent.clearConfirm)) onClear();
              }}
            >
              {TR.recent.clearAll}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
