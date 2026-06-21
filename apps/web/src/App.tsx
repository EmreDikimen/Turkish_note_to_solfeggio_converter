import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTimeline,
  centsAboveRef,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { WebAudioBackend } from "./webAudioBackend";
import { PianoRoll } from "./PianoRoll";

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
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const playToken = useRef(0);

  // Try to load a bundled sample on first render (optional convenience).
  useEffect(() => {
    fetch("/sample.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no sample.json"))))
      .then((d: NoteModelDocument) => setDoc(d))
      .catch(() => void 0);
  }, []);

  const timeline = useMemo(() => (doc ? buildTimeline(doc) : null), [doc]);

  // Start playback. Grabs a fresh token first; when play() resolves (piece ended) we only
  // flip `playing` back to false if THIS play is still the current one — if the user hit
  // Stop or loaded another piece meanwhile, the token won't match and we leave the UI alone.
  async function onPlay() {
    if (!timeline) return;
    const token = ++playToken.current;
    setPlaying(true);
    await backend.play(timeline);
    if (playToken.current === token) setPlaying(false);
  }

  // Stop playback. Bumping the token invalidates any in-flight onPlay (see above), then we
  // silence the backend and reset the button state immediately.
  function onStop() {
    playToken.current++;
    backend.stop();
    setPlaying(false);
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
        setDoc(parsed);
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
        <button onClick={onPlay} disabled={!timeline || playing}>▶ Play</button>
        <button onClick={onStop} disabled={!playing}>■ Stop</button>
        <label style={{ marginLeft: 12 }}>
          Load JSON:{" "}
          <input type="file" accept="application/json,.json" onChange={onFile} />
        </label>
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
          <PianoRoll doc={doc} />
          <p style={{ color: "#888", fontSize: 12 }}>
            Pitch axis is 53-TET commas (microtonal). Hover a note for details. Drag-to-edit
            comes next.
          </p>
        </>
      ) : (
        <p style={{ color: "#888" }}>
          No score loaded. Export one with{" "}
          <code>python scripts/symbtr_to_json.py &lt;file.txt&gt;</code> and load the JSON, or
          drop a <code>sample.json</code> in <code>apps/web/public/</code>.
        </p>
      )}

      <Legend doc={doc} />
    </div>
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
