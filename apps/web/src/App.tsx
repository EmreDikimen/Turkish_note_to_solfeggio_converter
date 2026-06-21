import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildTimeline,
  centsAboveRef,
  freqFromTuning,
  groupMeasures,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { WebAudioBackend } from "./webAudioBackend";
import { PianoRoll, type PitchRange } from "./PianoRoll";
import { SheetView } from "./SheetView";
import { MeasureEditModal } from "./MeasureEditModal";

type ViewMode = "roll" | "sheet";

// What a single drag can change on a note: its pitch (comma) and/or its duration.
export type NoteEdit = Partial<Pick<NoteEvent, "koma53" | "durationMs">>;

// One shared audio backend for the whole app. Created once at module load (not per render)
// so Play/Stop always talk to the same instance.
const backend = new WebAudioBackend();

/**
 * The whole web harness UI, as one React component.
 *
 * What/why: this is the "shell" — it owns the loaded score and wires the buttons to the
 * core (build a timeline) and the backend (play it). Deliberately small: real logic lives
 * in @turkish-omr/core; this just holds state and renders.
 * Mental model of the state:
 *   * `doc`      — the loaded note-model (null until a file/sample loads).
 *   * `timeline` — derived from `doc` via the core's buildTimeline (recomputed only when
 *                  `doc` changes, thanks to useMemo).
 *   * `playing`  — drives the enabled/disabled state of the buttons.
 *   * `playToken`— a counter used to ignore a finished play() if the user already moved on
 *                  (started another piece / hit Stop). Prevents stale UI updates.
 * React notes for newcomers: `useState` = a value that re-renders the UI when it changes;
 * `useEffect` = run a side-effect (here: fetch the sample once on mount); `useRef` = a
 * mutable box that does NOT trigger re-renders.
 */
export function App() {
  const [doc, setDoc] = useState<NoteModelDocument | null>(null);
  // The piano-roll's vertical pitch range. Computed ONCE per loaded score (not on every
  // edit) so dragging a note doesn't make the whole view jump/rescale under the cursor.
  const [pitchRange, setPitchRange] = useState<PitchRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Transport state: "stopped" → Play; "playing" → Pause; "paused" → Resume. Stop resets it.
  const [playState, setPlayState] = useState<"stopped" | "playing" | "paused">("stopped");
  // Which view is shown, whether the sheet is in edit mode, and which measure's modal is open.
  const [viewMode, setViewMode] = useState<ViewMode>("roll");
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState<Measure | null>(null);

  // Install a freshly loaded score: set the doc AND derive a stable pitch range (padded a
  // few commas above/below the notes used). Both load paths (sample + file) go through here.
  function loadDoc(d: NoteModelDocument) {
    const komas = d.events.filter((e) => e.kind === "note").map((e) => e.koma53);
    const pad = 3;
    setPitchRange({ minKoma: Math.min(...komas) - pad, maxKoma: Math.max(...komas) + pad });
    setDoc(d);
  }

  // Try to load a bundled sample on first render (optional convenience).
  useEffect(() => {
    fetch("/sample.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no sample.json"))))
      .then((d: NoteModelDocument) => loadDoc(d))
      .catch(() => void 0);
  }, []);

  const timeline = useMemo(() => (doc ? buildTimeline(doc) : null), [doc]);

  // Stable accessor for the live playback position (ms), read each frame by the sheet's
  // playhead. Stable identity (the backend is a module constant) keeps the rAF effect steady.
  const getPositionMs = useCallback(() => backend.getPositionMs(), []);

  // When the piece finishes on its own, reset the transport to "stopped" so the UI shows Play.
  useEffect(() => {
    backend.setOnEnded(() => setPlayState("stopped"));
    return () => backend.setOnEnded(null);
  }, []);

  // Apply one note edit from the piano-roll. This is the heart of "correct OMR mistakes".
  // What/why: edits must flow back into `doc` so that BOTH the view and playback reflect
  // them. We update immutably (build a new doc) so React re-renders; the timeline + redraw
  // recompute automatically. If pitch changed, recompute the cached `freqHz` so the next
  // playback uses the corrected frequency. Editing also stops any current playback, since
  // the old scheduled audio no longer matches what's on screen.
  function updateEvent(index: number, patch: NoteEdit) {
    onStop();
    setDoc((prev) => {
      if (!prev) return prev;
      const events = prev.events.map((ev) => {
        if (ev.index !== index) return ev;
        const next: NoteEvent = { ...ev, ...patch };
        if (patch.koma53 !== undefined && next.kind === "note") {
          next.freqHz = Math.round(freqFromTuning(next.koma53, prev.tuning) * 1e4) / 1e4;
        }
        return next;
      });
      return { ...prev, events };
    });
  }

  // Replace a whole measure's events with the edited set from the modal. We splice the new
  // events in place of the measure's old ones (located by identity from groupMeasures), then
  // renumber every event's `index` sequentially so indices stay unique (new notes had -1).
  // Playback stops because timing changed.
  function onSaveMeasure(measureIndex: number, newEvents: NoteEvent[]) {
    onStop();
    setEditing(null);
    setDoc((prev) => {
      if (!prev) return prev;
      const target = groupMeasures(prev).find((m) => m.index === measureIndex);
      if (!target || target.events.length === 0) return prev;
      const oldIds = new Set(target.events.map((e) => e.index));
      // Single pass: where the measure's first old event sat, drop the whole measure and
      // splice in the new events; keep everything else (incl. meta) in place.
      const merged: NoteEvent[] = [];
      let inserted = false;
      for (const e of prev.events) {
        if (oldIds.has(e.index)) {
          if (!inserted) { merged.push(...newEvents); inserted = true; }
        } else {
          merged.push(e);
        }
      }
      const renumbered = merged.map((e, i) => ({ ...e, index: i + 1 }));
      return { ...prev, events: renumbered };
    });
  }

  // The single Play/Pause/Resume control. From stopped it starts from the top; while playing
  // it pauses (keeping position); while paused it resumes. Audio end is handled by setOnEnded.
  function onPlayPause() {
    if (!timeline) return;
    if (playState === "playing") {
      backend.pause();
      setPlayState("paused");
    } else if (playState === "paused") {
      backend.resume();
      setPlayState("playing");
    } else {
      void backend.play(timeline, 0);
      setPlayState("playing");
    }
  }

  // Stop playback and reset to the top: silence the backend and show Play again.
  function onStop() {
    backend.stop();
    setPlayState("stopped");
  }

  // Seek: start playback from a given position (ms). Used by clicking a measure (non-edit
  // mode) to "play from here". The click is the user gesture the AudioContext needs.
  function onSeekMs(ms: number) {
    if (!timeline) return;
    void backend.play(timeline, ms);
    setPlayState("playing");
  }

  // Load a note-model JSON the user picked from disk. Reads the file as text, parses it,
  // checks the schema version (so we fail clearly on an incompatible format), stops any
  // current playback, and swaps in the new score. Any error is shown instead of crashing.
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((t) => {
        const parsed = JSON.parse(t) as NoteModelDocument;
        if (parsed.schemaVersion !== 1) throw new Error(`unsupported schemaVersion ${parsed.schemaVersion}`);
        onStop();
        loadDoc(parsed);
        setError(null);
      })
      .catch((err) => setError(String(err)));
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>Turkish OMR — Web Harness</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Phase 1 testing tool. Loads note-model JSON (from the Python exporter), shows a
        piano-roll, and plays it back at 53-TET frequencies via Web Audio.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "16px 0" }}>
        <button onClick={onPlayPause} disabled={!timeline}>
          {playState === "playing" ? "⏸ Pause" : playState === "paused" ? "▶ Resume" : "▶ Play"}
        </button>
        <button onClick={onStop} disabled={playState === "stopped"}>■ Stop</button>
        <span style={{ marginLeft: 12, display: "inline-flex", border: "1px solid #ccc", borderRadius: 6, overflow: "hidden" }}>
          <ModeButton active={viewMode === "roll"} onClick={() => setViewMode("roll")}>Piano-roll</ModeButton>
          <ModeButton active={viewMode === "sheet"} onClick={() => setViewMode("sheet")}>Sheet</ModeButton>
        </span>
        <label style={{ marginLeft: 12 }}>
          Load JSON:{" "}
          <input type="file" accept="application/json,.json" onChange={onFile} />
        </label>
        {viewMode === "sheet" && (
          <button
            onClick={() => setEditMode((v) => !v)}
            style={{ marginLeft: "auto", fontWeight: 600, background: editMode ? "#3b82f6" : undefined, color: editMode ? "#fff" : undefined }}
          >
            {editMode ? "✓ Editing" : "✎ Edit"}
          </button>
        )}
      </div>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {doc ? (
        <>
          <div style={{ color: "#444", marginBottom: 8 }}>
            <strong>{doc.title || doc.name}</strong> — makam <em>{doc.makam}</em>, usul{" "}
            <em>{doc.usul}</em>
            {doc.composer ? <> · {doc.composer}</> : null} · {doc.events.length} events ·{" "}
            {timeline ? `${(timeline.totalMs / 1000).toFixed(1)}s` : ""}
          </div>
          {viewMode === "roll" ? (
            <>
              {pitchRange && <PianoRoll doc={doc} pitchRange={pitchRange} onEditNote={updateEvent} />}
              <p style={{ color: "#888", fontSize: 12 }}>
                Pitch axis is 53-TET commas (microtonal). Hover for details. <strong>Drag a note
                up/down</strong> to change its pitch; <strong>drag its right edge</strong> to change
                its duration. Edits update playback.
              </p>
            </>
          ) : (
            <>
              <SheetView
                doc={doc}
                editMode={editMode}
                playing={playState !== "stopped"}
                getPositionMs={getPositionMs}
                onMeasureClick={setEditing}
                onSeekToMeasure={(m) => onSeekMs(m.startMs)}
              />
              <p style={{ color: "#888", fontSize: 12 }}>
                Western staff with Turkish (AEU) accidental glyphs from the Bravura font.
                {editMode
                  ? " Edit is on — click a measure to edit its notes."
                  : " Click a measure to play from there. Click ✎ Edit to edit notes instead."}
              </p>
            </>
          )}
        </>
      ) : (
        <p style={{ color: "#888" }}>
          No score loaded. Export one with{" "}
          <code>python scripts/symbtr_to_json.py &lt;file.txt&gt;</code> and load the JSON, or
          drop a <code>sample.json</code> in <code>apps/web/public/</code>.
        </p>
      )}

      <Legend doc={doc} />

      {editing && doc && (
        <MeasureEditModal
          measure={editing}
          doc={doc}
          onSave={(events) => onSaveMeasure(editing.index, events)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// A segmented-control button for the Piano-roll / Sheet toggle.
function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        padding: "6px 12px",
        background: active ? "#3b82f6" : "#fff",
        color: active ? "#fff" : "#333",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Small read-out of the piece's pitch span (lowest to highest comma), shown under the roll.
// What/why: a quick orientation aid while learning — confirms the data covers the range you
// expect. A separate tiny component keeps App's render readable.
function Legend({ doc }: { doc: NoteModelDocument | null }) {
  if (!doc) return null;
  const notes = doc.events.filter((e) => e.kind === "note");
  const komas = notes.map((n) => n.koma53);
  const lo = Math.min(...komas);
  const hi = Math.max(...komas);
  return (
    <div style={{ color: "#999", fontSize: 12, marginTop: 8 }}>
      pitch range: comma {lo}–{hi} (
      {centsAboveRef(hi - lo + doc.tuning.refKoma, doc.tuning.refKoma, doc.tuning.commasPerOctave).toFixed(0)} cents span)
    </div>
  );
}
