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

export type ViewMode = "sheet" | "instrument";

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
  children: ReactNode;
}) {
  const notes = doc.events.filter((e) => e.kind === "note").length;
  return (
    // ⚠ No edit-mode variant of this class any more (owner, 2026-09-03). The palette used to be a
    // column inside this card, so the card — and the page — had to grow while editing. It is now a
    // floating `.kv-toolbox` rendered from App, outside the card entirely, and the score keeps its
    // full width whether you are editing or not.
    <section className="kv-card">
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
            // ⚠ ONE instrument tab, not one per instrument (owner, 2026-08-29): from the outside
            // there is a single question — where do I play this — and the instrument is an answer
            // to it, chosen by the picker inside. The piano roll was removed the same day.
            { value: "instrument", label: TR.card.viewInstrument, id: "view-instrument" },
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

      </header>

      {/* ⚠ Nothing may nest inside `.kv-score`: that container is screenshotted by rect for
          training strips, so nothing may set a font in it or transform it. The edit toolbox is
          not here at all — it floats over the page from App. */}
      <div className="kv-score">{children}</div>

      <p className="kv-hint">
        {viewMode === "sheet"
          ? editMode
            ? TR.card.hintSheetEditing
            : TR.card.hintSheet
          : TR.card.hintInstrument}
      </p>
    </section>
  );
}
