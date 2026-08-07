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

export type ViewMode = "roll" | "sheet";

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
  onSave,
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
  onSave: () => void;
  children: ReactNode;
}) {
  const notes = doc.events.filter((e) => e.kind === "note").length;
  return (
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
            { value: "roll", label: TR.card.viewRoll, id: "view-roll" },
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
              type="button"
              className={`kv-btn${editMode ? " is-on" : ""}`}
              onClick={() => onEditMode(!editMode)}
            >
              {editMode ? TR.card.editing : TR.card.edit}
            </button>
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

      <div className="kv-score">{children}</div>

      <p className="kv-hint">
        {viewMode === "sheet"
          ? editMode
            ? TR.card.hintSheetEditing
            : TR.card.hintSheet
          : TR.card.hintRoll}
      </p>
    </section>
  );
}
