/**
 * The paper card the score sits on — the one object on the page that matters.
 *
 * Its head carries only what is about THIS score on screen: which view, whether the güfte is
 * drawn, edit mode, and downloading it. Playback lives in the transport above; developer settings
 * live in Gelişmiş below.
 *
 * ⚠ `.kv-score` must never get a transform, and no selector inside it may set a font — the
 * training-strip exporter screenshots that SVG by rect. See styles/app.css.
 */

import { useState, type ReactNode } from "react";
import type { NoteModelDocument } from "@turkish-omr/core";
import { RenameField } from "./RenameField";
import { Segmented } from "./Segmented";
import { TR } from "./strings";

export type ViewMode = "sheet" | "instrument";

function duration(totalMs: number): string {
  const s = Math.round(totalMs / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ScoreCard({
  doc,
  pageId,
  pageName,
  onRename,
  totalMs,
  viewMode,
  onViewMode,
  showLyrics,
  onShowLyrics,
  followPlayhead,
  onFollowPlayhead,
  editMode,
  onEditMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  children,
}: {
  doc: NoteModelDocument;
  /**
   * The stored record this score IS, when it is one, and the name the reader gave it.
   *
   * ⚠ **The heading shows this in preference to `doc.name`, and that is what stops a rename
   * drifting** (owner, 2026-09-05): renaming through the DOCUMENT was the other option and is a
   * trap — `doc.name` seeds a per-piece hash that decides whether `SheetView` draws a tuplet as a
   * bracket or as a curved arc, so a rename would silently re-engrave the triplets. Null for every
   * score that is not a stored page (a `?score=` fixture, a hand-loaded JSON), which then falls
   * back to the document exactly as before.
   */
  pageId: string | null;
  pageName: string | null;
  onRename: (id: string, name: string) => void;
  totalMs: number | null;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  showLyrics: boolean;
  onShowLyrics: (v: boolean) => void;
  /** Scroll the page to the playhead when it leaves the screen. Lives here, beside Güfte, because
   *  it is a question about the SHEET on screen — where the eye is — and not about the sound; the
   *  transport above owns everything that changes what is played. */
  followPlayhead: boolean;
  onFollowPlayhead: (v: boolean) => void;
  editMode: boolean;
  onEditMode: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  children: ReactNode;
}) {
  const notes = doc.events.filter((e) => e.kind === "note").length;
  // Renaming the page ON SCREEN. The same box the list uses (`RenameField`), because there is one
  // rename and it should behave the same in both places.
  const [renaming, setRenaming] = useState(false);
  return (
    // ⚠ No edit-mode variant of this class any more (owner, 2026-09-03). The palette used to be a
    // column inside this card, so the card — and the page — had to grow while editing. It is now a
    // floating `.kv-toolbox` rendered from App, outside the card entirely, and the score keeps its
    // full width whether you are editing or not.
    <section className="kv-card">
      <header className="kv-card__head">
        <h2 className="kv-card__title">
          {pageId && renaming ? (
            <RenameField
              id={pageId}
              value={pageName ?? doc.name}
              onCommit={(name) => {
                setRenaming(false);
                onRename(pageId, name);
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <>
              <span data-omr="score-name">{pageName || doc.title || doc.name}</span>
              {/* ⚠ Only a STORED page can be renamed, so the pencil is absent — not disabled — on
                  anything else. A disabled control invites a click that can never work. */}
              {pageId && (
                <button
                  id="score-rename"
                  type="button"
                  className="kv-card__rename"
                  title={TR.recent.renameTitle(pageName ?? doc.name)}
                  aria-label={TR.recent.renameTitle(pageName ?? doc.name)}
                  onClick={() => setRenaming(true)}
                >
                  {TR.recent.rename}
                </button>
              )}
            </>
          )}
          <span className="kv-card__meta">
            {TR.card.meta(
              doc.makam,
              doc.usul,
              doc.composer,
              notes,
              totalMs == null ? "—" : duration(totalMs)
            )}
          </span>
        </h2>

        {/* ⚠ EVERY control in the head is ONE wrapping unit, not six loose children of it
            (2026-09-03). Loose, they broke wherever the head ran out of room: on the first
            keystroke of edit mode "Yinele" was pushed onto a line of its own, alone under a row of
            five, which reads as a layout fault rather than a control. Grouped, the head wraps as
            title / controls, and the two undo buttons wrap together or not at all.
            ⚠ The view picker belongs INSIDE it, even though it is the one control that shows in
            both view modes: the title claims the free space to its right and this group claims the
            free space to its left, so a picker left outside would be pushed to the middle of the
            head with a gap on either side of it. */}
        <div className="kv-card__tools">
        <Segmented
          value={viewMode}
          onChange={onViewMode}
          items={[
            { value: "sheet", label: TR.card.viewSheet, id: "view-sheet" },
            // ⚠ ONE instrument tab, not one per instrument (owner, 2026-08-29): from the outside
            // there is a single question — where do I play this — and the instrument is an answer
            // to it, chosen by the picker inside. The piano roll was removed the same day.
            { value: "instrument", label: TR.card.viewInstrument, id: "view-instrument" },
          ]}
        />

        {/* ⚠ Güfte and İmleci takip et are about the SHEET on screen — the page's lyrics, the
            page's scrolling — so they stay sheet-only. Düzenle and its undo pair do NOT: since
            2026-09-04 the instrument tab edits its own bar in place with the same toolbox over the
            same document, and a second toggle for the same mode is exactly the split the owner
            asked to remove (*"ikisi ayrı olmasın"*). One switch, both views. */}
        {viewMode === "sheet" && (
          <>
            <label className="kv-toggle" title={TR.card.lyricsTitle}>
              <input
                type="checkbox"
                className="kv-toggle__input"
                checked={showLyrics}
                onChange={(e) => onShowLyrics(e.target.checked)}
              />
              <span>{TR.card.lyrics}</span>
            </label>
            <label className="kv-toggle" title={TR.card.followTitle}>
              <input
                id="follow-playhead"
                type="checkbox"
                className="kv-toggle__input"
                data-follow={followPlayhead ? "on" : "off"}
                checked={followPlayhead}
                onChange={(e) => onFollowPlayhead(e.target.checked)}
              />
              <span>{TR.card.follow}</span>
            </label>
          </>
        )}

        <button
          id="edit-toggle"
          data-edit-mode={editMode ? "on" : "off"}
          type="button"
          className={`kv-btn${editMode ? " is-on" : ""}`}
          onClick={() => onEditMode(!editMode)}
        >
          {editMode ? TR.card.editing : TR.card.edit}
        </button>
        {/* Undo/redo ship WITH direct editing, not after it: clicking a note and pressing ✕ with
            no way back is worse than the modal this replaces, which had Cancel. */}
        {editMode && (
          <div className="kv-card__undo">
            <button
              id="undo"
              type="button"
              className="kv-btn kv-btn--ghost"
              onClick={onUndo}
              disabled={!canUndo}
              title={TR.card.undoTitle}
            >
              {TR.card.undo}
            </button>
            <button
              id="redo"
              type="button"
              className="kv-btn kv-btn--ghost"
              onClick={onRedo}
              disabled={!canRedo}
              title={TR.card.redoTitle}
            >
              {TR.card.redo}
            </button>
          </div>
        )}
        </div>

      </header>

      {/* ⚠ Nothing may nest inside `.kv-score`: that container is screenshotted by rect for
          training strips, so nothing may set a font in it or transform it. The edit toolbox is
          not here at all — it floats over the page from App. */}
      <div className="kv-score">{children}</div>

      {/* ⚠ Edit mode's instructions are a LEAD plus a closed list, never the ten-line paragraph
          they used to be (2026-09-03). Six rules run together under the score is the shape nobody
          reads — the one thing a first-time editor needs, "click a note", was in the middle of it.
          Nothing was dropped; the rest is one click away. */}
      {editMode ? (
        <div className="kv-hint">
          <p>{viewMode === "sheet" ? TR.card.hintSheetEditing : TR.card.hintMeasureEditing}</p>
          <details className="kv-hint__more">
            <summary>{TR.card.hintSheetEditingMore}</summary>
            <ul>
              {TR.card.hintSheetEditingSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        </div>
      ) : (
        <p className="kv-hint">
          {viewMode === "sheet" ? TR.card.hintSheet : TR.card.hintInstrument}
        </p>
      )}
    </section>
  );
}
