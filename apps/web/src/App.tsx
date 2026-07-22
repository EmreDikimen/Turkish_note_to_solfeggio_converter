import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { buildStrips, type ExportStrip } from "./stripExport";
import { detectRepeats, injectRepeats, type RepeatSpan } from "../../../tools/render/repeats";
import { injectNavMarks, type NavMark } from "../../../tools/render/navmarks";
import { respellAeu } from "../../../tools/render/respell";
import { parseSignatureBody } from "../../../tools/render/lilypond";

type ViewMode = "roll" | "sheet";
// SheetView's per-engrave layout payload (measure rectangles + svg size), used by the strip exporter.
type SheetLayout = { boxes: { index: number; x: number; y: number; width: number }[]; svgWidth: number; svgHeight: number; rowHeight: number };

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

// Render-automation parameters: the batch renderer (tools/render/render.ts) drives the harness
// with one page.goto per job instead of UI clicks, e.g.
//   /?score=/scores/foo.json&mode=keysig&lyrics=0&transpose=-4&repseed=123&navseed=789&textseed=456
// Read once at load (each render job is a fresh page); all absent in interactive use.
const RENDER_PARAMS = new URLSearchParams(window.location.search);
const URL_SCORE = RENDER_PARAMS.get("score"); // path under apps/web/public/
const URL_MODE = RENDER_PARAMS.get("mode") as AccidentalMode | null; // "every" | "keysig" | "measure"
const URL_LYRICS = RENDER_PARAMS.get("lyrics"); // "1" | "0"
// Conventional PRINTED-signature override body (drawn order, e.g. "\bakiyeFlat b \bakiyeSharp c"),
// the makam variant render.ts sampled from data/makam_signatures.json. Parsed once; fed to BOTH the
// draw path (SheetView) and the label path (buildStrips) so synthetic carry pages wear the real
// printed signature. Absent in interactive use → each derives the signature from the doc.
const URL_SIG = RENDER_PARAMS.get("sig");
const SIG_OVERRIDE = URL_SIG ? parseSignatureBody(URL_SIG) : undefined;
const URL_TRANSPOSE = Number(RENDER_PARAMS.get("transpose") ?? 0) || 0; // commas
const URL_REPSEED = RENDER_PARAMS.has("repseed") ? Number(RENDER_PARAMS.get("repseed")) : null;
const URL_NAVSEED = RENDER_PARAMS.has("navseed") ? Number(RENDER_PARAMS.get("navseed")) : null;
const URL_RESPELLSEED = RENDER_PARAMS.has("respellseed") ? Number(RENDER_PARAMS.get("respellseed")) : null;
const URL_TEXTSEED = RENDER_PARAMS.has("textseed") ? Number(RENDER_PARAMS.get("textseed")) : null;
const URL_SLURSEED = RENDER_PARAMS.has("slurseed") ? Number(RENDER_PARAMS.get("slurseed")) : null;
// Stable object identity (SheetView's engrave effect depends on it; an inline literal would
// re-engrave on every render). Constant per page load, like all render params.
const TEXT_NOISE = URL_TEXTSEED != null ? { seed: URL_TEXTSEED } : undefined;
const SLUR_NOISE = URL_SLURSEED != null ? { seed: URL_SLURSEED } : undefined;

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
  const [viewMode, setViewMode] = useState<ViewMode>(URL_SCORE ? "sheet" : "roll");
  const [editMode, setEditMode] = useState(false);
  // Sheet: draw the score's accidentals once per row (key signature) instead of on every note.
  const [accidentalMode, setAccidentalMode] = useState<AccidentalMode>(URL_MODE ?? "every");
  // Sheet: draw lyric syllables under the notes (vocal scores). Off → instrumental-style sheet.
  const [showLyrics, setShowLyrics] = useState(URL_LYRICS != null ? URL_LYRICS === "1" : true);
  // Draw a hyphen between a word's syllables ("Gam-ze-de"). Most sheets omit these → default off.
  const [lyricHyphens, setLyricHyphens] = useState(false);
  // Phase-2: draw detected repeat barlines + voltas on the sheet. SymbTr flattens repeats (a
  // repeated passage appears twice in a row), so detectRepeats finds where the signs belong; the
  // strip labels then carry the matching repeat tokens. Purely visual + labels — the doc, layout,
  // playback, and playhead are untouched.
  const [showRepeats, setShowRepeats] = useState(false);
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
  // Step-2c strip export: SheetView reports its measure geometry here; the panel previews one strip.
  const [layout, setLayout] = useState<SheetLayout | null>(null);
  const [selectedStripId, setSelectedStripId] = useState<string | null>(null);
  // Render automation: which configuration the CURRENT layout was engraved under. SheetView calls
  // onLayout after every engrave; stamping the tag then (and comparing it to the live tag when
  // publishing __omrConfig) closes the race where strips are briefly computed from a new doc but
  // a stale layout — the renderer waits for `applied` instead of sleeping a fixed 300 ms.
  const renderTag = JSON.stringify({
    score: sampleFile, mode: accidentalMode, lyrics: showLyrics, transpose,
    repseed: URL_REPSEED, navseed: URL_NAVSEED, textseed: URL_TEXTSEED, respellseed: URL_RESPELLSEED, slurseed: URL_SLURSEED,
  });
  const renderTagRef = useRef(renderTag);
  renderTagRef.current = renderTag;
  const [layoutTag, setLayoutTag] = useState<string | null>(null);
  const onLayout = useCallback((l: SheetLayout) => {
    setLayout(l);
    setLayoutTag(renderTagRef.current);
  }, []);
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

  // Fetch a bundled/exported score by URL and install it (stops any playback first).
  function loadSample(file: string) {
    onStop();
    return fetch(file)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`could not load ${file}`))))
      .then((d: NoteModelDocument) => {
        loadDoc(d);
        setSampleFile(file);
        setError(null);
      })
      .catch((err) => setError(String(err)));
  }

  // Load the URL-requested score (render automation) or the first bundled sample on first render.
  // The transpose must be applied AFTER the load — loadDoc resets it to 0.
  useEffect(() => {
    loadSample(URL_SCORE ?? SAMPLES[0]!.file).then(() => {
      if (URL_SCORE && URL_TRANSPOSE !== 0) setTranspose(URL_TRANSPOSE);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the views draw: the stored score, optionally rewritten by the transpose — unless we're
  // keeping the sheet as-is (transposing-instrument case). Never mutates `doc`.
  const displayDoc = useMemo(() => {
    let d = doc && !keepSheet && transpose !== 0 ? transposeDoc(doc, transpose) : doc;
    // Render automation: seeded AEU-enharmonic respell so the rare büyük glyphs appear at all in
    // training (a decoder can't emit a token it never saw). Deliberately low-rate — common signs
    // keep their natural distribution; see tools/render/respell.ts for the full rationale.
    if (d && URL_RESPELLSEED != null) d = respellAeu(d, URL_RESPELLSEED);
    return d;
  }, [doc, transpose, keepSheet]);

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

  // Detected repeat spans for the drawn score (doc unmodified — signs are drawn onto the same
  // engraving). SheetView draws them and the strip labels get the matching tokens from the SAME
  // spans, so a strip's pixels and label always agree.
  const repeatSpans = useMemo<RepeatSpan[] | undefined>(() => {
    const drawn = displayDoc ?? doc;
    if (!drawn) return undefined;
    // Render automation: a repseed adds seeded random spans on top of the detected ones (Rung-2
    // repeat-token coverage — SymbTr itself has no repeats). Interactive: the Repeats toggle.
    if (URL_REPSEED != null) return injectRepeats(drawn, URL_REPSEED, detectRepeats(drawn));
    return showRepeats ? detectRepeats(drawn) : undefined;
  }, [showRepeats, displayDoc, doc]);

  // Injected navigation marks (segno/coda/D.C./Son — Rung-2 coverage; SymbTr has none, so there
  // is nothing to detect). URL-driven only, like the other render-automation seeds. Depends on
  // the repeat spans: injection keeps nav marks off repeat/volta measures (shared drawing band).
  const navMarks = useMemo<NavMark[] | undefined>(() => {
    const drawn = displayDoc ?? doc;
    if (!drawn || URL_NAVSEED == null) return undefined;
    return injectNavMarks(drawn, URL_NAVSEED, repeatSpans ?? []);
  }, [displayDoc, doc, repeatSpans]);

  // The piece's natural tempo (speed = 1) and its beat grid, for the speed control + metronome.
  const naturalBpm = useMemo(() => (doc ? estimateBpm(doc) : 0), [doc]);
  const beatMs = useMemo(() => (doc ? beatMsOf(doc) : 0), [doc]);

  // Step-2c: the training strips for the currently-drawn score + accidental mode, and the selected
  // one. Uses the SAME doc + repeat spans SheetView draws, so crop geometry and labels match pixels.
  const strips = useMemo<ExportStrip[]>(() => {
    const drawn = displayDoc ?? doc;
    // Pass the real mode (incl. "measure"/carry) and the same conventional-signature override
    // SheetView draws with, so carry labels equal the drawn signature (faithful scheme).
    return drawn && layout
      ? buildStrips(drawn, layout.boxes, accidentalMode, repeatSpans, navMarks, SIG_OVERRIDE)
      : [];
  }, [repeatSpans, navMarks, displayDoc, doc, layout, accidentalMode]);
  const selectedStrip = useMemo(() => strips.find((s) => s.id === selectedStripId) ?? null, [strips, selectedStripId]);
  // Expose the strips + score meta + applied render config for the Playwright batch exporter
  // (tools/render/render.ts). `applied` is true only once the engraved layout matches the
  // currently-requested configuration, i.e. the strips' crop rects and labels agree.
  useEffect(() => {
    const w = window as unknown as {
      __omrStrips?: ExportStrip[];
      __omrMeta?: { makam: string; name: string };
      __omrConfig?: {
        score: string; mode: AccidentalMode; lyrics: boolean; transpose: number; sig: string | null;
        repseed: number | null; navseed: number | null; textseed: number | null; respellseed: number | null; slurseed: number | null;
        applied: boolean;
      };
    };
    w.__omrStrips = strips;
    if (doc) w.__omrMeta = { makam: doc.makam, name: doc.name };
    w.__omrConfig = {
      score: sampleFile, mode: accidentalMode, lyrics: showLyrics, transpose, sig: URL_SIG ?? null,
      repseed: URL_REPSEED, navseed: URL_NAVSEED, textseed: URL_TEXTSEED, respellseed: URL_RESPELLSEED, slurseed: URL_SLURSEED,
      applied: layoutTag === renderTag,
    };
  }, [strips, doc, sampleFile, accidentalMode, showLyrics, transpose, layoutTag, renderTag]);

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

  // Download the current (possibly edited) score as note-model JSON. This is the output side of
  // the Rung-3 model-assisted labeling loop: a stitched page is loaded, corrected in the editor,
  // saved here — and the corrected file serializes to training labels via the SAME serializer
  // that made the synthetic set (tools/render/lilypond.ts).
  function onDownload() {
    if (!doc) return;
    const blob = new Blob([JSON.stringify(doc, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.name || "score"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
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
        <button onClick={onDownload} disabled={!doc} title="Download the current score (with your edits) as note-model JSON — the Rung-3 labeling loop's output">
          ⬇ Save JSON
        </button>
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
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
              title="Phase-2: draw repeat barlines + volta brackets where a repeated passage is detected (SymbTr writes repeats out twice). Visual + strip-label tokens only — layout, playback and playhead are unchanged."
            >
              <input type="checkbox" checked={showRepeats} onChange={(e) => setShowRepeats(e.target.checked)} />
              <span>Repeats</span>
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
                signatureOverride={SIG_OVERRIDE}
                showLyrics={showLyrics}
                lyricHyphens={lyricHyphens}
                playing={playState !== "stopped"}
                getPositionMs={getPositionMs}
                onMeasureClick={setEditing}
                onSeekToMeasure={(m) => onSeekMs(m.startMs)}
                onLayout={onLayout}
                highlightRect={selectedStrip?.rect ?? null}
                repeatSpans={repeatSpans}
                navMarks={navMarks}
                textNoise={TEXT_NOISE}
                slurNoise={SLUR_NOISE}
              />
              <StripPanel
                strips={strips}
                selectedId={selectedStripId}
                onSelect={setSelectedStripId}
                mode={accidentalMode === "keysig" ? "keysig" : "every"}
                onMode={(m) => { setAccidentalMode(m); setSelectedStripId(null); }}
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

/**
 * Step-2c Strip panel: lists the training strips for the current score + mode, highlights the
 * selected strip's crop rectangle on the live sheet (via `highlightRect`), and shows its LilyPond
 * label + decoded notes — the manual image-vs-label check. The actual PNG files are produced by the
 * Playwright batch exporter (`tools/render/render.ts`), which reads `window.__omrStrips`.
 */
function StripPanel({
  strips,
  selectedId,
  onSelect,
  mode,
  onMode,
}: {
  strips: ExportStrip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: "every" | "keysig";
  onMode: (m: "every" | "keysig") => void;
}) {
  const sel = strips.find((s) => s.id === selectedId) ?? null;
  return (
    <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fafafa" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Strip export (Step 2c)</strong>
        <span style={{ display: "inline-flex", border: "1px solid #ccc", borderRadius: 6, overflow: "hidden" }}>
          <ModeButton active={mode === "every"} onClick={() => onMode("every")}>every-note</ModeButton>
          <ModeButton active={mode === "keysig"} onClick={() => onMode("keysig")}>key-signature</ModeButton>
        </span>
        <span style={{ color: "#666", fontSize: 13 }}>{strips.length} strips · select one to highlight its crop</span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 120, overflowY: "auto", flex: "0 0 320px" }}>
          {strips.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                fontSize: 12, padding: "2px 6px",
                background: s.id === selectedId ? "#fde68a" : "#fff",
                border: s.id === selectedId ? "1px solid #f59e0b" : "1px solid #ddd",
                borderRadius: 4, cursor: "pointer",
              }}
            >
              {s.id}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
          {sel ? (
            <>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#888" }}>label: </span>
                <code style={{ wordBreak: "break-word" }}>{sel.label}</code>
              </div>
              <div>
                <span style={{ color: "#888" }}>decoded: </span>
                {sel.decoded}
              </div>
            </>
          ) : (
            <span style={{ color: "#999" }}>Select a strip to see its label + decoded notes; the orange box on the sheet is its crop region.</span>
          )}
        </div>
      </div>
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
