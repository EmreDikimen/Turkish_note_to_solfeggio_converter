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

import type { ReactNode } from "react";
import type { NoteModelDocument } from "@turkish-omr/core";
import { Segmented } from "./Segmented";
import { TR } from "./strings";

export type ViewMode = "roll" | "sheet" | "fingerboard";

function duration(totalMs: number): string {
  const s = Math.round(totalMs / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ScoreCard({
  doc,
  totalMs,
  viewMode,
  onViewMode,
  showLyrics,
  onShowLyrics,
  editMode,
  onEditMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  palette,
  children,
}: {
  doc: NoteModelDocument;
  totalMs: number | null;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  showLyrics: boolean;
  onShowLyrics: (v: boolean) => void;
  editMode: boolean;
  onEditMode: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  /** The edit palette, shown BESIDE the score in edit mode. Passed in (rather than built here)
   *  so the armed tool stays with the edit state in App. Null outside edit mode. */
  palette?: ReactNode;
  children: ReactNode;
}) {
  const notes = doc.events.filter((e) => e.kind === "note").length;
  return (
    // `kv-card--editing` is what the page shell keys its extra width off (styles/app.css): the
    // palette takes room from the row the score is in, and the sheet's engraved width is fixed.
    <section className={`kv-card${palette ? " kv-card--editing" : ""}`}>
      <header className="kv-card__head">
        <h2 className="kv-card__title">
          {doc.title || doc.name}
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

        <Segmented
          value={viewMode}
          onChange={onViewMode}
          items={[
            { value: "sheet", label: TR.card.viewSheet, id: "view-sheet" },
            { value: "roll", label: TR.card.viewRoll, id: "view-roll" },
            { value: "fingerboard", label: TR.card.viewFingerboard, id: "view-fingerboard" },
          ]}
        />

        {viewMode === "sheet" && (
          <>
            <label className="kv-field" title={TR.card.lyricsTitle}>
              <input
                type="checkbox"
                checked={showLyrics}
                onChange={(e) => onShowLyrics(e.target.checked)}
              />
              <span>{TR.card.lyrics}</span>
            </label>
            <button
              id="edit-toggle"
              data-edit-mode={editMode ? "on" : "off"}
              type="button"
              className={`kv-btn${editMode ? " is-on" : ""}`}
              onClick={() => onEditMode(!editMode)}
            >
              {editMode ? TR.card.editing : TR.card.edit}
            </button>
            {/* Undo/redo ship WITH direct editing, not after it: clicking a note and pressing ✕
                with no way back is worse than the modal this replaces, which had Cancel. */}
            {editMode && (
              <>
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
              </>
            )}
          </>
        )}

        <button
          id="save-json"
          type="button"
          className="kv-btn kv-btn--ghost"
          onClick={onSave}
          title={TR.card.saveTitle}
        >
          {TR.card.save}
        </button>
      </header>

      {/* The palette is a SIBLING of .kv-score, never a child: that container is screenshotted
          by rect for training strips, so nothing may nest inside it, set a font in it, or
          transform it. A flex row around it is safe. */}
      <div className="kv-score-row">
        {palette}
        <div className="kv-score">{children}</div>
      </div>

      <p className="kv-hint">
        {viewMode === "sheet"
          ? editMode
            ? TR.card.hintSheetEditing
            : TR.card.hintSheet
          : viewMode === "fingerboard"
            ? TR.card.hintFingerboard
            : TR.card.hintRoll}
      </p>
    </section>
  );
}
