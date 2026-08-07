import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignBars,
  beatMsOf,
  buildMetronomeTrack,
  buildTimeline,
  centsAboveRef,
  deriveTimeSignature,
  estimateBpm,
  detectMakam,
  findUsul,
  freqFromTuning,
  groupMeasures,
  makamDisplay,
  makamKomaDeltas,
  makamOptions,
  resolveMakam,
  transpose as transposeDoc,
  USULS,
  withKomaDeltas,
  type MakamDetection,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { WebAudioBackend, type PlayOptions } from "./webAudioBackend";
import { PianoRoll, type PitchRange } from "./PianoRoll";
import { SheetView, type AccidentalMode } from "./SheetView";
import { MeasureEditModal } from "./MeasureEditModal";
import { MakamModal } from "./MakamModal";
import { buildStrips, type ExportStrip } from "./stripExport";
import { decodeStripsRouted } from "./omr/remote";
import { positionFromName, stitchDecoded, type StripInput } from "./omr/pipeline";
import { loadImage } from "./omr/preprocess";
import { UploadHero } from "./ui/UploadHero";
import { TransportBar } from "./ui/TransportBar";
import { ScoreCard } from "./ui/ScoreCard";
import { AdvancedPanel } from "./ui/AdvancedPanel";
import { TR } from "./ui/strings";
import { ReadError, toAppError, type AppError } from "./ui/errors";
import {
  busy as busyStatus,
  makamSuffix,
  pageSummary,
  readingStatus,
  stripsSummary,
  whereOf,
  type OmrStatus,
} from "./ui/status";
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

// Every makam the app can play, built once at module load — the list is static.
const MAKAM_OPTIONS = makamOptions();

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
// Round-3 print realism: seeded staff-line weight + usul beam grouping (see SheetView's
// STAFF_LINE_WIDTH / USUL_BEAM_GROUPS). Absent → VexFlow's defaults, i.e. every pre-Round-3 strip.
const URL_PRINTSEED = RENDER_PARAMS.has("printseed") ? Number(RENDER_PARAMS.get("printseed")) : null;
// Round-2: draw the four AEU sharps with real-print bar weight (see SheetView's drawThinSharps).
// Render-automation only; absent → Bravura's glyphs, as before.
const URL_THIN_SHARPS = RENDER_PARAMS.get("thinsharps") === "1";
// Stable object identity (SheetView's engrave effect depends on it; an inline literal would
// re-engrave on every render). Constant per page load, like all render params.
const TEXT_NOISE = URL_TEXTSEED != null ? { seed: URL_TEXTSEED } : undefined;
const SLUR_NOISE = URL_SLURSEED != null ? { seed: URL_SLURSEED } : undefined;
const PRINT_NOISE = URL_PRINTSEED != null ? { seed: URL_PRINTSEED } : undefined;

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
  const [error, setError] = useState<AppError | null>(null);
  // Transport state: "stopped" → Play; "playing" → Pause; "paused" → Resume. Stop resets it.
  const [playState, setPlayState] = useState<"stopped" | "playing" | "paused">("stopped");
  // Which view is shown, whether the sheet is in edit mode, and which measure's modal is open.
  // The engraved sheet is the product; the piano-roll is a diagnostic. Sheet by default now,
  // where the harness opened on the roll. (Render automation always wanted sheet anyway.)
  const [viewMode, setViewMode] = useState<ViewMode>("sheet");
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
  // In-browser OMR: the model reads strip images and the result loads as a score. `omrStatus` is
  // the user-visible progress line — a page is ~20 strips at ~1 s each, so silence would read as
  // a hang — plus the structured facts the deploy checks assert on (see ui/status.ts).
  // `omrBusy` disables the picker mid-read.
  const [omrStatus, setOmrStatus] = useState<OmrStatus | null>(null);
  const [omrBusy, setOmrBusy] = useState(false);
  // When the current read began — the elapsed clock's only input. Null when nothing is running.
  const [readStartedAt, setReadStartedAt] = useState<number | null>(null);
  // Playback tempo (quarter-note BPM; defaults to the piece's natural tempo) and metronome.
  const [bpm, setBpm] = useState(120);
  const [metronome, setMetronome] = useState(false);
  // Which usul drives the metronome pattern (name key; defaults to the loaded piece's usul).
  const [usulName, setUsulName] = useState<string>(USULS[0]!.name);
  // Which makam's PERFORMED intonation playback uses. "" = none, i.e. sound the notes exactly as
  // the staff spells them (the old behaviour, and the safe default). Set from the score's own
  // metadata when it has any, guessed from the notes after a decode, always user-editable.
  const [makamSlug, setMakamSlug] = useState("");
  // The post-decode prompt: non-null while the modal is up. Only a decode raises it — a loaded
  // sample already knows its makam and has nothing to ask.
  const [makamPrompt, setMakamPrompt] = useState<MakamDetection | null>(null);
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
    printseed: URL_PRINTSEED,
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
    [-53, "−Sekizli (−53)"], [-31, "−Beşli (−31)"], [-22, "−Dörtlü (−22)"], [-9, "−Tanini (−9)"],
    [-5, "−5 koma"], [-4, "−Bakiye (−4)"], [-1, "−1 koma"], [0, "Özgün hâli"], [1, "+1 koma"],
    [4, "+Bakiye (+4)"], [5, "+5 koma"], [9, "+Tanini (+9)"], [22, "+Dörtlü (+22)"],
    [31, "+Beşli (+31)"], [53, "+Sekizli (+53)"],
  ];

  // Install a freshly loaded score: set the doc AND derive a stable pitch range (padded a
  // few commas above/below the notes used). Both load paths (sample + file) go through here.
  // `detected` is passed only by the decode paths, whose scores carry no metadata at all.
  function loadDoc(raw: NoteModelDocument, detected?: MakamDetection) {
    // Assign each event a stable bar number from SymbTr's offset column up front, so measure
    // grouping is correct for every usul and survives edits (which would otherwise lose it).
    const d = assignBars(raw);
    const komas = d.events.filter((e) => e.kind === "note").map((e) => e.koma53);
    const pad = 3;
    // A decoded page can legitimately contain no notes (a blank crop, a failed read). Math.min of
    // an empty spread is Infinity, which produces a dead PitchRange and an unreadable roll — so
    // fall back to a middle octave rather than propagating it.
    setPitchRange(
      komas.length
        ? { minKoma: Math.min(...komas) - pad, maxKoma: Math.max(...komas) + pad }
        : { minKoma: 0, maxKoma: 53 }
    );
    setBpm(estimateBpm(d)); // start each piece at its own natural tempo
    // Default the metronome's usul to the piece's own usul; if it isn't a known one, pick the
    // usul whose meter matches the derived time signature, else fall back to the first.
    const ts = deriveTimeSignature(d);
    const matched =
      findUsul(d.usul) ?? USULS.find((u) => ts != null && u.num === ts.num && u.den === ts.den) ?? USULS[0]!;
    setUsulName(matched.name);
    // Same idea for the makam: a score that knows its own (samples, SymbTr JSON) keeps it, resolved
    // to a table key so the dropdown can show it; a decoded page never does (stitch.ts writes
    // `makam: ""`), so the decode paths hand in a guess. Only the guess is written back onto the
    // doc — a sample's own spelling is left alone, since resolving it could only lose information.
    const slug = detected ? detected.slug ?? "" : resolveMakam(d.makam);
    setMakamSlug(slug);
    setTranspose(0); // a freshly loaded score starts untransposed
    setDoc(detected ? { ...d, makam: slug } : d);
  }

  // Apply a makam choice: stop first (a running playback does not pick up a new timeline — the
  // same rule updateEvent/applyTranspose/onSaveMeasure follow), then store it on the doc so the
  // engraved header and the saved JSON agree with what is sounding.
  function applyMakam(slug: string) {
    onStop();
    setMakamSlug(slug);
    setDoc((prev) => (prev && prev.makam !== slug ? { ...prev, makam: slug } : prev));
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
      .catch((err) => setError(toAppError(err, "file")));
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

  // Which notes the selected makam bends, and by how many commas. Read from the BASE doc's
  // written spelling — the rules match a written letter+accidental, and `transposeDoc` respells
  // every note from its koma, so by then the letters they key on are gone. Keyed by event index
  // so the result survives a transpose and can be applied on the far side of it.
  const makamDeltas = useMemo(() => makamKomaDeltas(doc, makamSlug), [doc, makamSlug]);

  // The playable timeline. The SOUND shifts by `transpose` in BOTH modes: when the staff is
  // rewritten, displayDoc already carries the shifted komas; when keeping the sheet, we instead
  // nudge the tuning anchor so only the frequencies move. Both yield identical sounding pitches.
  // The makam's deltas go on LAST, so their fractional komas reach buildTimeline (which recomputes
  // frequency from koma53) and nothing that spells a note name.
  const timeline = useMemo(() => {
    if (!doc) return null;
    if (keepSheet && transpose !== 0) {
      const tuned = { ...doc, tuning: { ...doc.tuning, refKoma: doc.tuning.refKoma - transpose } };
      return buildTimeline(withKomaDeltas(tuned, makamDeltas));
    }
    return displayDoc ? buildTimeline(withKomaDeltas(displayDoc, makamDeltas)) : null;
  }, [doc, displayDoc, keepSheet, transpose, makamDeltas]);

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
        printseed: number | null;
        applied: boolean;
      };
    };
    w.__omrStrips = strips;
    if (doc) w.__omrMeta = { makam: doc.makam, name: doc.name };
    w.__omrConfig = {
      score: sampleFile, mode: accidentalMode, lyrics: showLyrics, transpose, sig: URL_SIG ?? null,
      repseed: URL_REPSEED, navseed: URL_NAVSEED, textseed: URL_TEXTSEED, respellseed: URL_RESPELLSEED, slurseed: URL_SLURSEED,
      printseed: URL_PRINTSEED,
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
      .catch((err) => setError(toAppError(err, "file")));
  }

  /**
   * Read strip images with the OMR model and load the result as a score.
   *
   * This is the product path end to end, minus the slicer (which arrives at W6): the same
   * `preprocessCanvas` + `greedyDecode` the browser gate validates, then `stitchStrips`, then the
   * ordinary `loadDoc`. Pick the `*_sNN_wNN.png` crops of one page and the whole page is read.
   *
   * Strips are ordered by their filename's row/crop suffix rather than by pick order, because a
   * file input's order is the OS's, not the page's — and the stitcher builds the music from
   * `system`/`window`.
   */
  function onStrips(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ""; // re-picking the same folder must fire change again
    if (!files.length) return;

    files.sort((a, b) => a.name.localeCompare(b.name));
    setError(null);
    setOmrBusy(true);
    setReadStartedAt(Date.now());
    setOmrStatus(busyStatus("strips", "model", TR.status.loadingModel));

    void (async () => {
      const urls: string[] = [];
      try {
        setOmrStatus(busyStatus("strips", "decode", TR.status.readingStrips(files.length)));
        const strips: StripInput[] = [];
        for (const [i, f] of files.entries()) {
          const url = URL.createObjectURL(f);
          urls.push(url);
          strips.push({ ...positionFromName(f.name, i), image: await loadImage(url), name: f.name });
        }

        const pageName = files[0]!.name.replace(/_s\d+_w\d+\.\w+$/, "") || "decoded-page";
        const t0 = performance.now();
        const routed = await decodeStripsRouted(strips, {
          onProgress: (done, total, current) =>
            setOmrStatus(readingStatus("strips", done, total, current)),
        });
        const totalMs = performance.now() - t0;
        const result = stitchDecoded(routed.strips, pageName);

        const notes = result.doc.events.filter((ev) => ev.kind === "note").length;
        if (!result.doc.events.length)
          throw new ReadError("read-failed", TR.errors.nothingReadStrips);

        // Nothing decoded carries metadata, so the makam is guessed from the notes themselves and
        // then confirmed by the user — it decides how the piece SOUNDS, not just how it is filed.
        const detected = detectMakam(result.doc);
        onStop();
        loadDoc(result.doc, detected);
        setMakamPrompt(detected);
        setSampleFile("");
        setOmrStatus(
          stripsSummary({
            strips: strips.length,
            notes,
            measures: result.writtenMeasures,
            totalMs,
            detected,
            where: whereOf(routed),
            warnings: result.warnings.length,
          })
        );
        // Warnings are the stitcher's "this construct was malformed" notes; a mostly-right score in
        // the editor IS the point, so they inform rather than block.
        if (result.warnings.length) console.warn("stitch warnings:", result.warnings);
      } catch (err) {
        setError(toAppError(err, "read-failed"));
        setOmrStatus(null);
      } finally {
        urls.forEach(URL.revokeObjectURL);
        setOmrBusy(false);
        setReadStartedAt(null);
      }
    })();
  }

  /**
   * Read a WHOLE PAGE: slice it in the browser, then read every strip it cut (MVP W7).
   *
   * This is the product path with nothing left out — the same slicer W6 checked against Python over
   * the corpus, feeding the same `decodeStripsToDoc` "Read strips" uses. It shares that handler's
   * shape on purpose; what it adds is the slice, and the honest wait in front of it.
   *
   * ⚠ It is SLOW, and knowingly so: the deskew sweep is 41 full-page rotations (~35 s), then ~1.1 s
   * a strip. The sweep yields between rotations so the tab stays alive and the count keeps moving,
   * but a straight screenshot still pays the whole search to learn it is straight — the latency
   * work is written up in docs/STATUS.md and is a behaviour change with its own measurement.
   *
   * The slicer is imported lazily so opening the harness does not download opencv.js.
   */
  function readPageFile(file: File) {
    setError(null);
    setOmrBusy(true);
    setReadStartedAt(Date.now());
    setOmrStatus(busyStatus("page", "model", TR.status.loadingModel));

    void (async () => {
      const url = URL.createObjectURL(file);
      try {
        const { slicePage } = await import("./omr/page");

        const stem = file.name.replace(/\.[^.]+$/, "") || "page";
        setOmrStatus(busyStatus("page", "slice", TR.status.slicing));
        const sliced = await slicePage(url, stem, {
          onProgress: (phase, done, total) => {
            // The slicer reports its phases in English; the UI names them in Turkish.
            const name = TR.phases[phase] ?? phase;
            setOmrStatus(
              busyStatus("page", "slice", done != null ? `${name}… ${done}/${total}` : `${name}…`)
            );
          },
        });
        if (!sliced.strips.length) throw new ReadError("no-staves", TR.errors.noStaves);

        const t0 = performance.now();
        const routed = await decodeStripsRouted(sliced.strips, {
          onProgress: (done, total, current) =>
            setOmrStatus(readingStatus("page", done, total, current)),
        });
        const decodeMs = performance.now() - t0;
        const result = stitchDecoded(routed.strips, stem);

        const notes = result.doc.events.filter((ev) => ev.kind === "note").length;
        if (!result.doc.events.length)
          throw new ReadError("read-failed", TR.errors.nothingRead);

        const detected = detectMakam(result.doc);
        onStop();
        loadDoc(result.doc, detected);
        setMakamPrompt(detected);
        setSampleFile("");
        setOmrStatus(
          pageSummary({
            staves: sliced.nStaves,
            strips: sliced.strips.length,
            notes,
            measures: result.writtenMeasures,
            sliceMs: sliced.totalMs,
            skewDeg: sliced.skewDeg,
            decodeMs,
            detected,
            where: whereOf(routed),
            warnings: result.warnings.length,
          })
        );
        if (result.warnings.length) console.warn("stitch warnings:", result.warnings);
      } catch (err) {
        setError(toAppError(err, "read-failed"));
        setOmrStatus(null);
      } finally {
        URL.revokeObjectURL(url);
        setOmrBusy(false);
        setReadStartedAt(null);
      }
    })();
  }

  return (
    <div
      id="app"
      className="kv-page"
      // `data-ready` is what the deploy checks wait for instead of matching the page's title text
      // — the title is copy and will change; "a score is installed" is the fact they need.
      data-ready={doc ? "1" : undefined}
    >
      <header className="kv-header">
        <h1 className="kv-brand">
          <span className="kv-brand__mark" aria-hidden="true">
            &#xE282;
          </span>
          {TR.brand}
        </h1>
        <p className="kv-tagline">{TR.tagline}</p>
      </header>

      <UploadHero
        // The hero shrinks once the score on screen came from a read or a loaded file, which is
        // exactly when `sampleFile` is empty — no extra state to keep in step.
        compact={omrBusy || sampleFile === ""}
        busy={omrBusy}
        status={omrStatus}
        error={error}
        startedAt={readStartedAt}
        onFile={readPageFile}
      />

      {doc && (
        <>
          <TransportBar
            canPlay={!!timeline}
            playState={playState}
            onPlayPause={onPlayPause}
            onStop={onStop}
            bpm={bpm}
            naturalBpm={naturalBpm}
            onBpm={(v) => applyPlayback(v, metronome, usulName)}
            metronome={metronome}
            onMetronome={(v) => applyPlayback(bpm, v, usulName)}
            usulName={usulName}
            onUsul={(v) => applyPlayback(bpm, metronome, v)}
            makamSlug={makamSlug}
            onMakam={applyMakam}
            makamOptions={MAKAM_OPTIONS}
          />

          <ScoreCard
            doc={doc}
            totalMs={timeline?.totalMs ?? null}
            viewMode={viewMode}
            onViewMode={setViewMode}
            showLyrics={showLyrics}
            onShowLyrics={setShowLyrics}
            editMode={editMode}
            onEditMode={setEditMode}
            onSave={onDownload}
          >
            {viewMode === "roll" ? (
              pitchRange && (
                <PianoRoll doc={displayDoc ?? doc} pitchRange={pitchRange} onEditNote={updateEvent} />
              )
            ) : (
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
                thinSharps={URL_THIN_SHARPS}
                printNoise={PRINT_NOISE}
              />
            )}
          </ScoreCard>
        </>
      )}

      <AdvancedPanel
        doc={doc}
        samples={SAMPLES}
        sampleFile={sampleFile}
        onSample={loadSample}
        onLoadJson={onFile}
        onStrips={onStrips}
        omrBusy={omrBusy}
        transpose={transpose}
        transposeOptions={TRANSPOSE_OPTIONS}
        onTranspose={(c) => applyTranspose(c, keepSheet)}
        keepSheet={keepSheet}
        onKeepSheet={(v) => applyTranspose(transpose, v)}
        accidentalMode={accidentalMode}
        onAccidentalMode={setAccidentalMode}
        showLyrics={showLyrics}
        lyricHyphens={lyricHyphens}
        onLyricHyphens={setLyricHyphens}
        showRepeats={showRepeats}
        onShowRepeats={setShowRepeats}
        sheetView={viewMode === "sheet"}
        strips={strips}
        selectedStripId={selectedStripId}
        onSelectStrip={setSelectedStripId}
      />

      {editing && doc && (
        <MeasureEditModal
          measure={editing}
          doc={doc}
          onSave={(events) => onSaveMeasure(editing.index, events)}
          onCancel={() => setEditing(null)}
        />
      )}
      {makamPrompt && (
        <MakamModal
          detection={makamPrompt}
          onConfirm={(slug) => {
            applyMakam(slug);
            setMakamPrompt(null);
          }}
          // Dismissed without choosing: the detected makam is already applied, so this keeps it.
          onDismiss={() => setMakamPrompt(null)}
        />
      )}
    </div>
  );
}

