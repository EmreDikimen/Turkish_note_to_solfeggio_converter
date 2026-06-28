import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignBars,
  beatMsOf,
  buildMetronomeTrack,
  buildTimeline,
  centsAboveRef,
  deriveTimeSignature,
  estimateBpm,
  findUsul,
  freqFromTuning,
  groupMeasures,
  transpose as transposeDoc,
  USULS,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { WebAudioBackend, type PlayOptions } from "./webAudioBackend";
import { PianoRoll, type PitchRange } from "./PianoRoll";
import { SheetView, type AccidentalMode } from "./SheetView";
import { MeasureEditModal } from "./MeasureEditModal";

type ViewMode = "roll" | "sheet";

// What a single drag can change on a note: its pitch (comma) and/or its duration.
export type NoteEdit = Partial<Pick<NoteEvent, "koma53" | "durationMs">>;

// One shared audio backend for the whole app. Created once at module load (not per render)
// so Play/Stop always talk to the same instance.
const backend = new WebAudioBackend();

// Example scores bundled in apps/web/public/ (exported from SymbTr via scripts/symbtr_to_json.py).
// The first entry auto-loads on startup; the rest are selectable from the Sample dropdown.
const SAMPLES: { label: string; file: string }[] = [
  { label: "aldanma dünya — acem · düyek (zekai dede)", file: "/sample.json" },
  { label: "safalar getirdiniz — kürdilihicazkâr · aksak (avni anıl)", file: "/safalar-getirdiniz.json" },
  { label: "gamzedeyim deva — uşşak · sofyan (tatyos efendi)", file: "/gamzedeyim-deva.json" },
];

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
 *   * `playState`— "stopped" | "playing" | "paused"; drives the transport buttons.
 * React notes for newcomers: `useState` = a value that re-renders the UI when it changes;
 * `useEffect` = run a side-effect (here: fetch the sample once on mount).
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
  // Sheet: draw the score's accidentals once per row (key signature) instead of on every note.
  const [accidentalMode, setAccidentalMode] = useState<AccidentalMode>("every");
  // Sheet: draw lyric syllables under the notes (vocal scores). Off → instrumental-style sheet.
  const [showLyrics, setShowLyrics] = useState(true);
  // Draw a hyphen between a word's syllables ("Gam-ze-de"). Most sheets omit these → default off.
  const [lyricHyphens, setLyricHyphens] = useState(false);
  const [editing, setEditing] = useState<Measure | null>(null);
  // Which bundled sample is loaded (its file path), or "" when a user-picked file is loaded.
  const [sampleFile, setSampleFile] = useState<string>(SAMPLES[0]!.file);
  // Playback tempo (quarter-note BPM; defaults to the piece's natural tempo) and metronome.
  const [bpm, setBpm] = useState(120);
  const [metronome, setMetronome] = useState(false);
  // Which usul drives the metronome pattern (name key; defaults to the loaded piece's usul).
  const [usulName, setUsulName] = useState<string>(USULS[0]!.name);
  // Currently-applied chromatic transposition, in commas (0 = original). A test control for the
  // core `transpose`; later this becomes the ahenk selector (each ahenk is a fixed comma offset).
  const [transpose, setTranspose] = useState(0);
  // When true, the transpose shifts only the SOUND and leaves the notation as written — the
  // transposing-instrument case (kız/mansur ney read the same sheet but sound transposed). When
  // false, the staff is rewritten too. Either way the stored score (`doc`) is never mutated.
  const [keepSheet, setKeepSheet] = useState(false);
  // Test offsets for the transpose dropdown [commas, label]: small comma steps exercise the
  // accidental re-spelling; the larger AEU intervals (whole tone 9, fourth 22, fifth 31, octave
  // 53) check octave/range + naming. (53-TET: 53 commas = one octave.)
  const TRANSPOSE_OPTIONS: ReadonlyArray<readonly [number, string]> = [
    [-53, "−Octave (−53)"], [-31, "−Fifth (−31)"], [-22, "−Fourth (−22)"], [-9, "−Whole tone (−9)"],
    [-5, "−5 koma"], [-4, "−Bakiye (−4)"], [-1, "−1 koma"], [0, "Original"], [1, "+1 koma"],
    [4, "+Bakiye (+4)"], [5, "+5 koma"], [9, "+Whole tone (+9)"], [22, "+Fourth (+22)"],
    [31, "+Fifth (+31)"], [53, "+Octave (+53)"],
  ];

  // Install a freshly loaded score: set the doc AND derive a stable pitch range (padded a
  // few commas above/below the notes used). Both load paths (sample + file) go through here.
  function loadDoc(raw: NoteModelDocument) {
    // Assign each event a stable bar number from SymbTr's offset column up front, so measure
    // grouping is correct for every usul and survives edits (which would otherwise lose it).
    const d = assignBars(raw);
    const komas = d.events.filter((e) => e.kind === "note").map((e) => e.koma53);
    const pad = 3;
    setPitchRange({ minKoma: Math.min(...komas) - pad, maxKoma: Math.max(...komas) + pad });
    setBpm(estimateBpm(d)); // start each piece at its own natural tempo
    // Default the metronome's usul to the piece's own usul; if it isn't a known one, pick the
    // usul whose meter matches the derived time signature, else fall back to the first.
    const ts = deriveTimeSignature(d);
    const matched =
      findUsul(d.usul) ?? USULS.find((u) => ts != null && u.num === ts.num && u.den === ts.den) ?? USULS[0]!;
    setUsulName(matched.name);
    setTranspose(0); // a freshly loaded score starts untransposed
    setDoc(d);
  }

  // Fetch one of the bundled sample scores by URL and install it (stops any playback first).
  function loadSample(file: string) {
    onStop();
    fetch(file)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`could not load ${file}`))))
      .then((d: NoteModelDocument) => {
        loadDoc(d);
        setSampleFile(file);
        setError(null);
      })
      .catch((err) => setError(String(err)));
  }

  // Load the first bundled sample on first render (optional convenience).
  useEffect(() => {
    loadSample(SAMPLES[0]!.file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the views draw: the stored score, optionally rewritten by the transpose — unless we're
  // keeping the sheet as-is (transposing-instrument case). Never mutates `doc`.
  const displayDoc = useMemo(
    () => (doc && !keepSheet && transpose !== 0 ? transposeDoc(doc, transpose) : doc),
    [doc, transpose, keepSheet],
  );

  // The playable timeline. The SOUND shifts by `transpose` in BOTH modes: when the staff is
  // rewritten, displayDoc already carries the shifted komas; when keeping the sheet, we instead
  // nudge the tuning anchor so only the frequencies move. Both yield identical sounding pitches.
  const timeline = useMemo(() => {
    if (!doc) return null;
    if (keepSheet && transpose !== 0) {
      const tuned = { ...doc, tuning: { ...doc.tuning, refKoma: doc.tuning.refKoma - transpose } };
      return buildTimeline(tuned);
    }
    return displayDoc ? buildTimeline(displayDoc) : null;
  }, [doc, displayDoc, keepSheet, transpose]);

  // The piece's natural tempo (speed = 1) and its beat grid, for the speed control + metronome.
  const naturalBpm = useMemo(() => (doc ? estimateBpm(doc) : 0), [doc]);
  const beatMs = useMemo(() => (doc ? beatMsOf(doc) : 0), [doc]);

  // Translate the current tempo/metronome/usul UI state into backend PlayOptions. Speed is the
  // chosen BPM over the natural BPM; the metronome clicks are the selected usul's beat pattern
  // (built in core, in musical ms), so they stay aligned to the bars at any tempo.
  const buildPlayOptions = useCallback(
    (targetBpm: number, metro: boolean, uName: string): PlayOptions => {
      const u = findUsul(uName);
      const clicks = metro && doc && u ? buildMetronomeTrack(doc, u, beatMs * 4) : undefined;
      return { speed: naturalBpm > 0 ? targetBpm / naturalBpm : 1, clicks };
    },
    [doc, naturalBpm, beatMs],
  );

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
    // Edits arrive in the DISPLAYED pitch space. When the staff is rewritten by the transpose,
    // map the dragged pitch back to the stored (base) score before applying.
    const shift = !keepSheet && transpose !== 0 ? transpose : 0;
    const adj: NoteEdit =
      shift && patch.koma53 !== undefined ? { ...patch, koma53: patch.koma53 - shift } : patch;
    setDoc((prev) => {
      if (!prev) return prev;
      const events = prev.events.map((ev) => {
        if (ev.index !== index) return ev;
        const next: NoteEvent = { ...ev, ...adj };
        if (patch.koma53 !== undefined && next.kind === "note") {
          next.freqHz = Math.round(freqFromTuning(next.koma53, prev.tuning) * 1e4) / 1e4;
        }
        return next;
      });
      return { ...prev, events };
    });
  }

  // Apply a transposition. The stored `doc` is NOT mutated — `transpose`/`keepSheet` are applied
  // when deriving `displayDoc` (what's drawn) and the playback timeline. We recompute the
  // piano-roll range from the displayed notes and stop playback so the new pitch takes effect.
  function applyTranspose(target: number, keep: boolean) {
    if (!doc) return;
    onStop();
    const shown = keep || target === 0 ? doc : transposeDoc(doc, target);
    const komas = shown.events.filter((e) => e.kind === "note").map((e) => e.koma53);
    if (komas.length) setPitchRange({ minKoma: Math.min(...komas) - 3, maxKoma: Math.max(...komas) + 3 });
    setTranspose(target);
    setKeepSheet(keep);
  }

  // Replace a whole measure's events with the edited set from the modal. We splice the new
  // events in place of the measure's old ones (located by identity from groupMeasures), then
  // renumber every event's `index` sequentially so indices stay unique (new notes had -1).
  // Playback stops because timing changed.
  function onSaveMeasure(measureIndex: number, newEvents: NoteEvent[]) {
    onStop();
    setEditing(null);
    // The modal edits the DISPLAYED notes; when the staff is rewritten by the transpose, map the
    // new events back to the stored (base) score before splicing.
    const baseEvents =
      !keepSheet && transpose !== 0 && doc
        ? transposeDoc({ ...doc, events: newEvents }, -transpose).events
        : newEvents;
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
          if (!inserted) { merged.push(...baseEvents); inserted = true; }
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
      void backend.play(timeline, 0, buildPlayOptions(bpm, metronome, usulName));
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
    void backend.play(timeline, ms, buildPlayOptions(bpm, metronome, usulName));
    setPlayState("playing");
  }

  // Apply a tempo / metronome / usul change. If something is playing or paused, re-schedule from
  // the current position so the change is heard immediately (position is musical ms, so it's
  // tempo-independent); otherwise it just takes effect on the next Play.
  function applyPlayback(nextBpm: number, nextMetro: boolean, nextUsul: string) {
    setBpm(nextBpm);
    setMetronome(nextMetro);
    setUsulName(nextUsul);
    if (!timeline || playState === "stopped") return;
    const pos = Math.max(0, backend.getPositionMs() ?? 0);
    const wasPaused = playState === "paused";
    void backend.play(timeline, pos, buildPlayOptions(nextBpm, nextMetro, nextUsul)).then(() => {
      if (wasPaused) backend.pause(); // keep the paused state after re-scheduling
    });
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
        setSampleFile(""); // a user-picked file isn't one of the bundled samples
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", margin: "16px 0" }}>
        <button onClick={onPlayPause} disabled={!timeline}>
          {playState === "playing" ? "⏸ Pause" : playState === "paused" ? "▶ Resume" : "▶ Play"}
        </button>
        <button onClick={onStop} disabled={playState === "stopped"}>■ Stop</button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={naturalBpm ? `natural tempo ≈ ${naturalBpm} BPM` : undefined}>
          <span role="img" aria-label="tempo">🎚️</span>
          <input
            type="number"
            min={20}
            max={400}
            value={bpm}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value));
              if (Number.isFinite(v) && v >= 20 && v <= 400) applyPlayback(v, metronome, usulName);
            }}
            disabled={!timeline}
            style={{ width: 56 }}
          />
          BPM
          {naturalBpm > 0 && bpm !== naturalBpm && (
            <button
              onClick={() => applyPlayback(naturalBpm, metronome, usulName)}
              title={`reset to natural tempo (${naturalBpm} BPM)`}
              style={{ fontSize: 11, padding: "0 4px" }}
            >
              ⟲
            </button>
          )}
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={metronome} onChange={(e) => applyPlayback(bpm, e.target.checked, usulName)} disabled={!timeline} />
          Metronome
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title="Usul — sets the metronome's beat pattern (editable; OMR can misread it)">
          <span>Usul:</span>
          <select
            value={usulName}
            onChange={(e) => applyPlayback(bpm, metronome, e.target.value)}
            disabled={!timeline}
          >
            {USULS.map((u) => (
              <option key={u.name} value={u.name}>
                {u.label} ({u.num}/{u.den})
              </option>
            ))}
          </select>
        </label>
        <span style={{ marginLeft: 12, display: "inline-flex", border: "1px solid #ccc", borderRadius: 6, overflow: "hidden" }}>
          <ModeButton active={viewMode === "roll"} onClick={() => setViewMode("roll")}>Piano-roll</ModeButton>
          <ModeButton active={viewMode === "sheet"} onClick={() => setViewMode("sheet")}>Sheet</ModeButton>
        </span>
        <label style={{ marginLeft: 12 }}>
          Sample:{" "}
          <select value={sampleFile} onChange={(e) => e.target.value && loadSample(e.target.value)}>
            <option value="" disabled>
              (loaded file)
            </option>
            {SAMPLES.map((s) => (
              <option key={s.file} value={s.file}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Load JSON:{" "}
          <input type="file" accept="application/json,.json" onChange={onFile} />
        </label>
        <label
          style={{ marginLeft: 12, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
          title="Transpose: shifts pitch by the chosen number of commas"
        >
          <span>Transpose:</span>
          <select
            value={transpose}
            onChange={(e) => applyTranspose(Number(e.target.value), keepSheet)}
            style={{ fontWeight: 600 }}
          >
            {TRANSPOSE_OPTIONS.map(([commas, label]) => (
              <option key={commas} value={commas}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
          title="Transpose the SOUND only and keep the notation as written — for transposing instruments (kız/mansur ney)"
        >
          <input type="checkbox" checked={keepSheet} onChange={(e) => applyTranspose(transpose, e.target.checked)} />
          <span>Keep sheet (sound only)</span>
        </label>
        {viewMode === "sheet" && (
          <>
            <label
              style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
              title="How accidentals are displayed on the staff"
            >
              <span>Accidentals:</span>
              <select
                value={accidentalMode}
                onChange={(e) => setAccidentalMode(e.target.value as AccidentalMode)}
                style={{ fontWeight: 600 }}
              >
                <option value="every">On every note</option>
                <option value="keysig">Key signature (row start)</option>
                <option value="measure">Standard (per measure)</option>
              </select>
            </label>
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
              title="Draw lyric syllables under the notes (vocal scores)"
            >
              <input type="checkbox" checked={showLyrics} onChange={(e) => setShowLyrics(e.target.checked)} />
              <span>Lyrics</span>
            </label>
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, opacity: showLyrics ? 1 : 0.5 }}
              title="Draw a hyphen between a word's syllables (Gam-ze-de). Most sheets omit these."
            >
              <input
                type="checkbox"
                checked={lyricHyphens}
                disabled={!showLyrics}
                onChange={(e) => setLyricHyphens(e.target.checked)}
              />
              <span>Hyphens</span>
            </label>
            <button
              onClick={() => setEditMode((v) => !v)}
              style={{ fontWeight: 600, background: editMode ? "#3b82f6" : undefined, color: editMode ? "#fff" : undefined }}
            >
              {editMode ? "✓ Editing" : "✎ Edit"}
            </button>
          </>
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
              {pitchRange && <PianoRoll doc={displayDoc ?? doc} pitchRange={pitchRange} onEditNote={updateEvent} />}
              <p style={{ color: "#888", fontSize: 12 }}>
                Pitch axis is 53-TET commas (microtonal). Hover for details. <strong>Drag a note
                up/down</strong> to change its pitch; <strong>drag its right edge</strong> to change
                its duration. Edits update playback.
              </p>
            </>
          ) : (
            <>
              <SheetView
                doc={displayDoc ?? doc}
                editMode={editMode}
                accidentalMode={accidentalMode}
                showLyrics={showLyrics}
                lyricHyphens={lyricHyphens}
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
                {" "}
                The <strong>Accidentals</strong> selector switches between showing one on every
                note, the makam key signature at each row start (deviations marked), and standard
                per-measure notation (an accidental carries to the rest of its measure).{" "}
                <strong>Transpose</strong> shifts pitch; tick <strong>Keep sheet (sound only)</strong>
                {" "}to move only the sound and leave the notation as written — for transposing
                instruments like kız/mansur ney.
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
