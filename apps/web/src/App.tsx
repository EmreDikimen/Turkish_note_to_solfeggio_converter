import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assignBars,
  beatMsOf,
  buildMetronomeTrack,
  buildPercussionTrack,
  buildTimeline,
  centsAboveRef,
  deleteEvent,
  deriveTimeSignature,
  estimateBpm,
  detectMakam,
  findUsul,
  groupMeasures,
  insertIndexIn,
  insertInMeasure,
  makamDisplay,
  makamKomaDeltas,
  makamOptions,
  measureOfEvent,
  nudgePitch,
  resolveMakam,
  scaleDurations,
  spellingOf,
  toNote,
  toRest,
  transpose as transposeDoc,
  USULS,
  withAlter,
  withDurationBeats,
  withKoma,
  withKomaDeltas,
  withPitch,
  type MakamDetection,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { closedTupletAt, memberPositions, tupletRunFrom } from "../../../tools/render/rhythm";
import { useDocHistory } from "./useDocHistory";
import { WebAudioBackend, type PlayOptions } from "./webAudioBackend";
import { PianoRoll, type PitchRange } from "./PianoRoll";
import { SheetView, type AccidentalMode } from "./SheetView";
import { MakamModal } from "./MakamModal";
import { buildStrips, type ExportStrip } from "./stripExport";
import { decodeStripsRouted, warmDecodeServer } from "./omr/remote";
import type { RawDecode } from "./ui/DecodePanel";
import { positionFromName, stitchDecoded, type StripInput } from "./omr/pipeline";
import { loadImage } from "./omr/preprocess";
import { UploadHero } from "./ui/UploadHero";
import { TransportBar } from "./ui/TransportBar";
import { ScoreCard } from "./ui/ScoreCard";
import { EditPalette, type Tool } from "./ui/EditPalette";
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

// The look-ahead scheduler's progress, for the headless checks only (tools/browser/editor-smoke.ts),
// alongside the `window.__omr*` hooks further down. It has to be read from the backend rather than
// from the screen: the playhead is driven by the audio clock, so it keeps moving even if the
// scheduler stalled and the page fell silent — only this counter can tell those two apart.
(window as unknown as { __omrAudio?: () => { scheduled: number; total: number } }).__omrAudio = () =>
  backend.scheduleProgress();

// Every makam the app can play, built once at module load — the list is static.
const MAKAM_OPTIONS = makamOptions();

// EMPTY ON PURPOSE, and it must stay empty (owner decision 2026-08-08, the copyright pass).
//
// Every score we had to hand is derived from SymbTr, which is **CC BY-NC-SA 4.0**: shipping one
// would carry an attribution duty, a ShareAlike duty on the derived file, and — the reason the
// owner chose removal over attribution — a NonCommercial clause binding this app forever. Two of
// them were also still-protected compositions under FSEK 5846 (life + 70): "safalar getirdiniz"
// (Avni Anıl, d. 2008) and "delisin deli" (Selahattin Pınar, d. 1960). So the deployed app ships
// no third-party score at all and opens empty — see docs/THIRD-PARTY.md.
//
// ⚠ The files still exist in apps/web/public/ for LOCAL work — gitignored, and dropped from the
// build by tools/prune-dist.mjs. `npm test`'s round-trip corpus, `smoke:editor`'s grace-note
// geometry section and the manual checks all read them through `?score=…`, which still works on a
// dev server and is the only way in now that the dropdown is gone. Local use is not distribution;
// re-adding an entry here would be.
const SAMPLES: { label: string; file: string }[] = [];

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
// The same-direction accidental tolerance (`sigTolerant` — see SheetView's `applyAccidental`):
// ON for a renderer-driven page, OFF for a human (owner decision 2026-08-09). A synthetic page has
// to imitate a real printed edition, which writes an intonation refinement BARE under the donanım;
// the app instead has to show what it PLAYS, and it was showing a koma bemol as a küçük bemol
// wherever the two pointed the same way (134 of the 213 bundled scores have at least one such
// letter). Both the draw path (SheetView) and the label path (buildStrips) read this ONE flag, so
// pixels still equal labels on either setting.
// Why "the mode came from the URL" IS "this is a render job": every render job's URL carries
// `mode` (render.ts `jobUrl`, and verify-labels' manifest replay), and the tolerance only ever
// applies in measure mode — so no existing corpus job or replay changes.
const SIG_TOLERANT = URL_MODE != null;
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
 * What the transposition dropdown offers, and how each step is named.
 *
 * The unit is the KOMA, because that is what the app is about and what the number in the URL
 * parameter means. Small steps are named in commas alone (an accidental's worth of movement: koma
 * 1, bakiye 4, küçük mücennep 5, büyük mücennep 8). Anything that lands on a scale degree is named
 * as the degree FIRST, with the comma count after it — "4 ses (22 koma)" — because a player thinks
 * "up a fourth", not "up twenty-two commas", and the comma count is what the app then does.
 *
 * The degrees are the çargâh (major) scale in AEU, which is where these comma counts come from:
 * 9 + 9 + 4 + 9 + 9 + 9 + 4 = 53. So 2 ses = 9, 3 ses = 18, 4 ses = 22, 5 ses = 31, 6 ses = 40,
 * 7 ses = 49, 8 ses (the octave) = 53.
 *
 * ⚠ The labels are copy and free to change; the NUMBERS are the contract (`transposeDoc` takes
 * commas, and `?transpose=` in the render automation is the same unit).
 */
const TRANSPOSE_STEPS: ReadonlyArray<readonly [number, string]> = (() => {
  const steps: [number, string][] = [
    [1, "1 koma"], [4, "4 koma"], [5, "5 koma"], [8, "8 koma"],
    [9, "2 ses (9 koma)"], [18, "3 ses (18 koma)"], [22, "4 ses (22 koma)"],
    [31, "5 ses (31 koma)"], [40, "6 ses (40 koma)"], [49, "7 ses (49 koma)"],
    [53, "8 ses — sekizli (53 koma)"],
  ];
  return [
    ...[...steps].reverse().map(([n, label]) => [-n, `−${label}`] as const),
    [0, "Özgün hâli"] as const,
    ...steps.map(([n, label]) => [n, `+${label}`] as const),
  ];
})();

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
  // The score, with undo/redo. Every write goes through `history.apply` (or `history.reset` for a
  // freshly loaded file) — there is no bare setter, so nothing can edit the doc off the stack.
  const history = useDocHistory();
  const doc = history.doc;
  // The piano-roll's vertical pitch range. Computed ONCE per loaded score (not on every
  // edit) so dragging a note doesn't make the whole view jump/rescale under the cursor.
  const [pitchRange, setPitchRange] = useState<PitchRange | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  // Transport state: "stopped" → Play; "playing" → Pause; "paused" → Resume. Stop resets it.
  const [playState, setPlayState] = useState<"stopped" | "playing" | "paused">("stopped");
  // Which view is shown, and whether the sheet is in edit mode.
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
  // Edit mode: which event (`NoteEvent.index`) is selected on the sheet, or null. A selection is
  // a POSITION, not an identity — deletes renumber — so it is cleared on load, on leaving edit
  // mode, and on undo/redo rather than being translated across those.
  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  // Edit mode: the ARMED palette tool, or null for plain selection (click selects, drag moves the
  // pitch). Armed, a click on a note applies the tool instead — the Mus2 model. Cleared with the
  // edit toggle so a friend cannot leave a tool armed and come back to it.
  const [armed, setArmed] = useState<Tool | null>(null);
  // Tuplet tool only: the FIRST note of the run, waiting for its end. The one two-click gesture in
  // the palette, so it is the one tool with a state between clicks. Like the selection this is a
  // position, not an identity, so it is dropped rather than translated whenever the document or
  // the tool changes — see `armTool` and the undo/redo handlers.
  const [tupletAnchor, setTupletAnchor] = useState<number | null>(null);
  // Edit mode: the 1-based measure the most recent edit landed in, and the whole of what the
  // palette's Çal needs. In edit mode a click means select or insert, so the sheet's click-to-seek
  // is off — this is what replaces it: fix a note, press Çal, hear the bar.
  //
  // A MEASURE number, not an event index, because a delete renumbers every event. Cleared when a
  // score loads (nothing edited yet → Çal starts at the top) and deliberately NOT touched by
  // undo/redo: the bar you were working in is still the bar you want to hear, and threading it
  // through useDocHistory's two stacks would buy nothing.
  const [lastEditMeasure, setLastEditMeasure] = useState<number | null>(null);
  // Which bundled sample is loaded (its file path), or "" when a user-picked file is loaded.
  // Starts "" now that SAMPLES is empty — the app opens with no score.
  const [sampleFile, setSampleFile] = useState<string>("");
  // In-browser OMR: the model reads strip images and the result loads as a score. `omrStatus` is
  // the user-visible progress line — a page is ~20 strips at ~1 s each, so silence would read as
  // a hang — plus the structured facts the deploy checks assert on (see ui/status.ts).
  // `omrBusy` disables the picker mid-read.
  const [omrStatus, setOmrStatus] = useState<OmrStatus | null>(null);
  const [omrBusy, setOmrBusy] = useState(false);
  // When the current read began — the elapsed clock's only input. Null when nothing is running.
  const [readStartedAt, setReadStartedAt] = useState<number | null>(null);
  // The last page's RAW decode — every token the model produced, before `stitchDecoded` merged the
  // strips and before any edit. Nothing else keeps it (the stitcher takes `tokens` and returns a
  // document), so without this the model's own output is invisible to the person reading the page.
  // Developer view only: ui/DecodePanel.tsx, inside Gelişmiş. Cleared when a score arrives from
  // anywhere else, because it would then describe a different piece than the one on screen.
  const [rawDecode, setRawDecode] = useState<RawDecode | null>(null);
  // Playback tempo (quarter-note BPM; defaults to the piece's natural tempo) and metronome.
  const [bpm, setBpm] = useState(120);
  const [metronome, setMetronome] = useState(false);
  // Play the usul's own düm/tek/ke strokes (feature track F2). Deliberately separate from the
  // metronome rather than a mode of it: one marks the beats, the other plays a rhythm, and wanting
  // both at once (learning a usul against a steady pulse) is a normal thing to want.
  const [percussion, setPercussion] = useState(false);
  // How loud the strokes are against the notes; 1 = the default balance. ⚠ This one does NOT go
  // through `applyPlayback`: it rides a gain node in the backend, so dragging the slider changes
  // the level of already-scheduled strokes without restarting the audio. Re-scheduling per pixel
  // is what the alternative would cost.
  const [percussionVolume, setPercussionVolume] = useState(1);
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
  const TRANSPOSE_OPTIONS = TRANSPOSE_STEPS;

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
    setSelectedNote(null);
    setTupletAnchor(null); // a half-finished tuplet names a note in the score being replaced
    setLastEditMeasure(null); // nothing edited yet → the palette's Çal starts at the top
    history.reset(detected ? { ...d, makam: slug } : d);
  }

  // Apply a makam choice: stop first (a running playback does not pick up a new timeline — the
  // same rule updateEvent/applyTranspose follow), then store it on the doc so the
  // engraved header and the saved JSON agree with what is sounding.
  function applyMakam(slug: string) {
    onStop();
    setMakamSlug(slug);
    history.apply((prev) => (prev.makam !== slug ? { ...prev, makam: slug } : prev));
  }

  // Fetch a bundled/exported score by URL and install it (stops any playback first).
  function loadSample(file: string) {
    onStop();
    return fetch(file)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`could not load ${file}`))))
      .then((d: NoteModelDocument) => {
        loadDoc(d);
        setRawDecode(null); // a bundled/URL score, not a model read
        setSampleFile(file);
        setError(null);
      })
      .catch((err) => setError(toAppError(err, "file")));
  }

  // Load the URL-requested score (render automation, the manual checks, the browser smokes) — and
  // nothing otherwise. There is no bundled sample to fall back to any more, so a plain visit opens
  // on the upload prompt and `#app` never gets `data-ready`, which is the honest reading of that
  // attribute: no score is loaded. Anything that needs one starts at `?score=…`.
  // The transpose must be applied AFTER the load — loadDoc resets it to 0.
  useEffect(() => {
    if (URL_SCORE) {
      loadSample(URL_SCORE).then(() => {
        if (URL_TRANSPOSE !== 0) setTranspose(URL_TRANSPOSE);
      });
    }
    // Start the decode server waking while the user is still choosing a file: a cold container is
    // ~10 s from ready, and picking a file takes longer than that. Costs one cheap GET and cannot
    // fail visibly (omr/remote.ts).
    warmDecodeServer();
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
    // Pass the real mode (incl. "measure"/carry), the same conventional-signature override
    // SheetView draws with, and the same accidental tolerance it draws with, so carry labels equal
    // the drawn signature AND the drawn accidentals (faithful scheme).
    return drawn && layout
      ? buildStrips(drawn, layout.boxes, accidentalMode, repeatSpans, navMarks, SIG_OVERRIDE, SIG_TOLERANT)
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

  // Translate the current tempo/metronome/percussion/usul UI state into backend PlayOptions. Speed
  // is the chosen BPM over the natural BPM; the clicks are the selected usul's beat pattern and the
  // strokes are its düm/tek/ke pattern (both built in core, in musical ms, off the same whole-note
  // length), so they stay aligned to the bars at any tempo.
  const buildPlayOptions = useCallback(
    (targetBpm: number, metro: boolean, uName: string, perc: boolean): PlayOptions => {
      const u = findUsul(uName);
      const clicks = metro && doc && u ? buildMetronomeTrack(doc, u, beatMs * 4) : undefined;
      const strokes = perc && doc && u ? buildPercussionTrack(doc, u, beatMs * 4) : undefined;
      return {
        speed: naturalBpm > 0 ? targetBpm / naturalBpm : 1,
        clicks,
        percussion: strokes,
        percussionVolume,
      };
    },
    [doc, naturalBpm, beatMs, percussionVolume],
  );

  // The slider's handler. Straight to the backend, deliberately not through `applyPlayback`.
  function applyPercussionVolume(v: number) {
    setPercussionVolume(v);
    backend.setPercussionVolume(v);
  }

  // Stable accessor for the live playback position (ms), read each frame by the sheet's
  // playhead. Stable identity (the backend is a module constant) keeps the rAF effect steady.
  const getPositionMs = useCallback(() => backend.getPositionMs(), []);

  // Undo/redo from the keyboard, the way every editor does it. Skipped while the focus is in a
  // text field (the browser's own undo belongs to that field) and outside edit mode.
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) onRedo();
      else onUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // No dependency array on purpose: onUndo/onRedo are plain functions rebuilt each render, so
    // re-binding a single keydown listener per render is cheaper than memoising the whole chain.
  });

  // When the piece finishes on its own, reset the transport to "stopped" so the UI shows Play.
  useEffect(() => {
    backend.setOnEnded(() => setPlayState("stopped"));
    return () => backend.setOnEnded(null);
  }, []);

  // Apply one note edit from the piano-roll. This is the heart of "correct OMR mistakes".
  // What/why: edits must flow back into `doc` so that BOTH the view and playback reflect
  // them. We update immutably (build a new doc) so React re-renders; the timeline + redraw
  // recompute automatically. Editing also stops any current playback, since the old scheduled
  // audio no longer matches what's on screen.
  //
  // A pitch drag goes through core's `withKoma`, which rewrites `noteName`/`noteAE` alongside
  // `koma53`/`freqHz`. Before that, this function patched the koma only — and since the sheet
  // reads its staff position from `parseNoteName(ev.noteName)`, a roll drag moved the SOUND and
  // left the notehead behind. ⚠ The duration drag still writes `durationMs` alone and leaves
  // `durationBeats` (what the sheet engraves) stale; fixing that means snapping a continuous
  // drag to a note value, which is the palette's job, not this one.
  /**
   * Remember which bar an edit landed in, so the palette's Çal can start there.
   *
   * Read from `doc` as it is BEFORE the edit, on purpose: for a delete the bar is only knowable
   * beforehand, and a duration/accidental/pitch change never moves a note into another bar. An
   * index we cannot place leaves the pointer where it was rather than resetting it to the top.
   */
  function markEdited(index: number) {
    if (!doc) return;
    const m = measureOfEvent(doc, index);
    if (m != null) setLastEditMeasure(m);
  }

  function updateEvent(index: number, patch: NoteEdit) {
    onStop();
    markEdited(index);
    // Edits arrive in the DISPLAYED pitch space. When the staff is rewritten by the transpose,
    // map the dragged pitch back to the stored (base) score before applying.
    const shift = !keepSheet && transpose !== 0 ? transpose : 0;
    // One drag = one undo entry: a pointer-move emits an edit per frame (see PianoRoll), and
    // stepping back through forty of them is not undo.
    history.apply(
      (prev) => {
        const events = prev.events.map((ev) => {
          if (ev.index !== index) return ev;
          const next: NoteEvent = patch.durationMs !== undefined ? { ...ev, durationMs: patch.durationMs } : ev;
          if (patch.koma53 === undefined || next.kind !== "note") return next;
          return withKoma(next, patch.koma53 - shift, prev.tuning);
        });
        return { ...prev, events };
      },
      { coalesce: `roll:${index}:${patch.koma53 !== undefined ? "pitch" : "duration"}` },
    );
  }

  /** Edit mode: move the selected note up (+1) or down (−1) diatonic steps, keeping its
   *  accidental. The doc stores pitch as letter+octave+alter separately, so carrying the
   *  alteration is the ordinary operation — see core's `nudgePitch`. */
  function onNudgePitch(index: number, steps: number) {
    onStop();
    markEdited(index);
    history.apply(
      (prev) => {
        const events = prev.events.map((ev) => {
          if (ev.index !== index || ev.kind !== "note") return ev;
          const s = spellingOf(ev);
          return s ? withPitch(ev, nudgePitch(s, steps), prev.tuning) : ev;
        });
        return { ...prev, events };
      },
      { coalesce: `nudge:${index}` }, // one wheel gesture, one undo
    );
  }

  /**
   * Edit mode: apply the ARMED palette tool to the clicked note.
   *
   * A note value goes through `withDurationBeats`, which moves `durationMs` and `durationBeats`
   * together — the sheet engraves the beats and playback reads the ms, and an edit that moved only
   * one of them is exactly the bug shape `edits.ts` exists to prevent. An accidental goes through
   * `withAlter`: the staff position stays, the alteration changes.
   *
   * The bar is left OVER or UNDER its length on purpose — an edit absorbs into its bar and bar
   * lines never move. The warning for that is step 8, and it needs the derived meter, not
   * `Measure.lengthBeats` (which is computed from the bar's own contents and so is true by
   * construction).
   *
   * ⚠ Transpose: the sheet draws `displayDoc`, so an alteration picked on screen is not the stored
   * one when the staff has been rewritten. The edit is built in DISPLAY space and mapped back with
   * the same `transposeDoc(…, -transpose)` round-trip `onInsertNote` uses. A duration needs none
   * of it, and `onNudgePitch` escapes it only because a nudge is relative.
   */
  function onApplyTool(index: number, pitchAt?: { letter: string; octave: number; alter: number }) {
    // The tuplet has its own two-click gesture (`onTupletPick`) and never comes through here.
    if (!armed || armed.kind === "tuplet" || !doc) return;
    onStop();
    markEdited(index);
    const shift = !keepSheet && transpose !== 0 ? transpose : 0;
    history.apply((prev) => {
      const at = prev.events.findIndex((ev) => ev.index === index);
      if (at < 0) return prev;
      const stored = prev.events[at]!;
      let next: NoteEvent;
      if (armed.kind === "duration") {
        const value = { num: armed.num, den: armed.den };
        if (armed.rest) {
          // A rest tool over anything makes a rest of that value — the pitch side is cleared by
          // the primitive, not left behind to claim a note nobody can hear.
          next = toRest(stored, value, prev);
        } else if (stored.kind === "rest") {
          // The inverse, for a rest the model read where a note belongs. A rest carries no pitch,
          // so it comes from the HEIGHT of the click — the same mapping the insert tool uses, in
          // DISPLAY space, so the finished event is mapped back like every other spelling here.
          if (!pitchAt) return prev;
          const shown = toNote(stored, pitchAt, value, prev);
          next = shift ? transposeDoc({ ...prev, events: [shown] }, -shift).events[0]! : shown;
        } else {
          next = withDurationBeats(stored, value, prev);
        }
      } else {
        if (stored.kind === "rest") return prev; // a rest takes no accidental
        // Alter in the space the user is looking at, then map the single event back.
        const shown = shift ? transposeDoc({ ...prev, events: [stored] }, shift).events[0]! : stored;
        const altered = withAlter(shown, armed.alter, prev.tuning);
        if (altered === shown) return prev; // already that accidental — not an undo entry
        next = shift ? transposeDoc({ ...prev, events: [altered] }, -shift).events[0]! : altered;
      }
      if (next === stored) return prev;
      const events = [...prev.events];
      events[at] = next;
      return { ...prev, events };
    });
  }

  /**
   * Edit mode: a note value is armed and empty staff was clicked — put a note there (step 6).
   *
   * The sheet has already resolved the geometry into an intent (which bar, which event to go in
   * front of, and the staff position the click's HEIGHT names); this builds the event and splices
   * it in. The bar ends up OVER its length on purpose — an edit absorbs into its bar and bar lines
   * never move, which is what `insertInMeasure` is careful about.
   *
   * The event is built from an empty shell through `withDurationBeats` (ms and beats together) and
   * then `withPitch` (every derived pitch field together), so nothing derived can be left stale.
   * `bar` is stamped by the core primitive, from the bar it lands in.
   *
   * ⚠ Same transpose trap as `onApplyTool`, and worse here: a spelling read off the drawn staff is
   * a DISPLAY spelling, so the finished event is mapped back with `transposeDoc(…, -transpose)`.
   * The tool stays armed afterwards — inserting several notes in a row is the point of a palette.
   */
  function onInsertNote(at: {
    measureIndex: number;
    beforeEventIndex: number | null;
    letter: string;
    octave: number;
    alter: number;
  }) {
    if (!armed || armed.kind !== "duration" || !doc) return;
    onStop();
    setLastEditMeasure(at.measureIndex); // the sheet names the bar outright
    const shift = !keepSheet && transpose !== 0 ? transpose : 0;
    const value = { num: armed.num, den: armed.den };
    const rest = armed.rest === true;
    history.apply((prev) => {
      const blank: NoteEvent = {
        index: -1, kind: "note", koma53: -1, noteName: "Es", noteAE: "Es",
        durationMs: 0, durationBeats: value, freqHz: null, lyric: "", offset: 0,
      };
      // A rest ignores the click's height — it has no pitch, and the engraver puts it mid-staff.
      const shown = rest
        ? toRest(blank, value, prev)
        : withPitch(withDurationBeats(blank, value, prev), at, prev.tuning);
      // Map the single event back to the stored score before splicing it in.
      const stored = !rest && shift ? transposeDoc({ ...prev, events: [shown] }, -shift).events[0]! : shown;
      const next = insertInMeasure(prev, stored, at.measureIndex, at.beforeEventIndex);
      if (next === prev) return prev;
      // Select what was just inserted, so the ✕ and the accidental tools land on it without
      // hunting for it again. The index has to be ASKED for: `renumber` rebuilds every event, so
      // the object we spliced in cannot be found again by identity.
      setSelectedNote(insertIndexIn(prev, at.measureIndex, at.beforeEventIndex));
      return next;
    });
  }

  /**
   * Edit mode: the tuplet tool's click (step 7). One tool, both directions.
   *
   * The order of the three cases IS the gesture:
   *  1. the note is inside a CLOSED three-member triplet → take that triplet apart (×3/2). Clicking
   *     a member can mean nothing else: it cannot start a new run, because a tuplet fraction is not
   *     a plain value (see `plainTupletBase`);
   *  2. nothing anchored → this note is the run's first, remember it (no document change);
   *  3. anchored → apply (×2/3) if this is the run's third note; clicking the anchor again cancels.
   *
   * Which notes make a legal run is `tupletRunFrom` in `tools/render/rhythm.ts` — the same module
   * that draws the bracket, so the tool cannot promise a triplet the engraver would not draw. The
   * sheet dims and un-clicks everything this would refuse, so case 3's "not the end note" is
   * unreachable through the UI; it is still handled, because a stale click must not invent one.
   *
   * ⚠ No transpose round-trip, unlike the accidental tool: a duration means the same thing in
   * display space and stored space, and `tupletRunFrom` reads durations only.
   */
  function onTupletPick(index: number) {
    if (!doc) return;
    const m = groupMeasures(doc).find((mm) => mm.events.some((e) => e.index === index));
    if (!m) return;
    const pos = m.events.findIndex((e) => e.index === index);

    const closed = closedTupletAt(m.events, pos);
    if (closed) {
      const idx = memberPositions(m.events, closed).map((p) => m.events[p]!.index);
      onStop();
      markEdited(index);
      setTupletAnchor(null);
      history.apply((prev) => scaleDurations(prev, idx, { num: 3, den: 2 }));
      return;
    }

    if (tupletAnchor == null) {
      if (tupletRunFrom(m.events, pos)) setTupletAnchor(index);
      return;
    }
    if (tupletAnchor === index) {
      setTupletAnchor(null); // clicking the anchor again backs out
      return;
    }
    const from = m.events.findIndex((e) => e.index === tupletAnchor);
    const run = from < 0 ? null : tupletRunFrom(m.events, from);
    if (!run || m.events[run[2]!]!.index !== index) return; // not this run's end note
    const idx = run.map((p) => m.events[p]!.index);
    onStop();
    markEdited(index);
    setTupletAnchor(null);
    history.apply((prev) => scaleDurations(prev, idx, { num: 2, den: 3 }));
  }

  /** Edit mode: delete the selected note (and any grace notes leading into it). The bar is left
   *  SHORT on purpose — an edit absorbs into its bar and bar lines never move. */
  function onDeleteNote(index: number) {
    onStop();
    markEdited(index);
    setSelectedNote(null);
    history.apply((prev) => deleteEvent(prev, index));
  }

  // Undo/redo drop the selection: a delete renumbers every event, so an index held across one
  // can name a different note. Clearing is cheap and cannot be subtly wrong.
  function onUndo() {
    onStop();
    setSelectedNote(null);
    setTupletAnchor(null);
    history.undo();
  }
  function onRedo() {
    onStop();
    setSelectedNote(null);
    setTupletAnchor(null);
    history.redo();
  }

  /** Arm a tool (or disarm — the palette's Seçim and Esc both come through here). A half-finished
   *  tuplet cannot survive a tool change: its anchor names a note in a run the next tool knows
   *  nothing about. */
  function armTool(t: Tool | null) {
    setArmed(t);
    setTupletAnchor(null);
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
      void backend.play(timeline, 0, buildPlayOptions(bpm, metronome, usulName, percussion));
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
    void backend.play(timeline, ms, buildPlayOptions(bpm, metronome, usulName, percussion));
    setPlayState("playing");
  }

  // Where the palette's Çal starts: the top of the last edited bar, or the top of the piece before
  // any edit. `Measure.startMs` is musical ms (a running sum of durationMs) — the same thing the
  // sheet's click-to-seek hands to onSeekMs, so tempo/metronome/makam all follow from there.
  // ⚠ The `?? 0` is a real case, not defensiveness: deleting a bar's last note removes that
  // measure, so a remembered index can outrun the score. Falling back to the top is the safe read.
  const editStartMs = useMemo(() => {
    if (!doc || lastEditMeasure == null) return 0;
    return groupMeasures(doc).find((m) => m.index === lastEditMeasure)?.startMs ?? 0;
  }, [doc, lastEditMeasure]);

  // The palette's Çal. Always (re)starts from the last edited bar — pause and resume stay in the
  // transport above, which is still on screen in edit mode (owner, 2026-08-08). Pressing it again
  // mid-playback replays the same bar, which is what checking a fix by ear actually looks like.
  function onPlayFromEdit() {
    onSeekMs(editStartMs);
  }

  // Apply a tempo / metronome / percussion / usul change. If something is playing or paused,
  // re-schedule from the current position so the change is heard immediately (position is musical
  // ms, so it's tempo-independent); otherwise it just takes effect on the next Play.
  // ⚠ Every argument needs its setter here, not just the one the caller changed: the controls are
  // React-controlled, so a missing setter leaves the box un-ticked and the change silently reverts.
  function applyPlayback(nextBpm: number, nextMetro: boolean, nextUsul: string, nextPerc: boolean) {
    setBpm(nextBpm);
    setMetronome(nextMetro);
    setUsulName(nextUsul);
    setPercussion(nextPerc);
    if (!timeline || playState === "stopped") return;
    const pos = Math.max(0, backend.getPositionMs() ?? 0);
    const wasPaused = playState === "paused";
    void backend.play(timeline, pos, buildPlayOptions(nextBpm, nextMetro, nextUsul, nextPerc)).then(() => {
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
        setRawDecode(null); // this score did not come from the model — see the state's comment
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
        setRawDecode({
          name: pageName,
          where: routed.where,
          strips: routed.strips,
          warnings: result.warnings,
        });

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
        setRawDecode({
          name: stem,
          where: routed.where,
          strips: routed.strips,
          warnings: result.warnings,
        });

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
        // The hero shrinks once a score is on screen. ⚠ This used to read `sampleFile === ""`,
        // which meant the same thing only while a bundled sample auto-loaded: with SAMPLES empty
        // `sampleFile` is ALWAYS "", so that test would open the app in the compact state with
        // nothing on screen — the opposite of what a first-time visitor needs. `doc` is the fact.
        compact={omrBusy || !!doc}
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
            onBpm={(v) => applyPlayback(v, metronome, usulName, percussion)}
            metronome={metronome}
            onMetronome={(v) => applyPlayback(bpm, v, usulName, percussion)}
            percussion={percussion}
            onPercussion={(v) => applyPlayback(bpm, metronome, usulName, v)}
            percussionVolume={percussionVolume}
            onPercussionVolume={applyPercussionVolume}
            usulName={usulName}
            onUsul={(v) => applyPlayback(bpm, metronome, v, percussion)}
            makamSlug={makamSlug}
            onMakam={applyMakam}
            makamOptions={MAKAM_OPTIONS}
            transpose={transpose}
            transposeOptions={TRANSPOSE_OPTIONS}
            onTranspose={(v) => applyTranspose(v, keepSheet)}
            keepSheet={keepSheet}
            onKeepSheet={(v) => applyTranspose(transpose, v)}
            accidentalMode={accidentalMode}
            onAccidentalMode={setAccidentalMode}
          />

          <ScoreCard
            doc={doc}
            totalMs={timeline?.totalMs ?? null}
            viewMode={viewMode}
            onViewMode={setViewMode}
            showLyrics={showLyrics}
            onShowLyrics={setShowLyrics}
            editMode={editMode}
            onEditMode={(v) => { setEditMode(v); if (!v) { setSelectedNote(null); armTool(null); } }}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onSave={onDownload}
            palette={
              editMode && viewMode === "sheet" ? (
                <EditPalette
                  armed={armed}
                  onArm={armTool}
                  canPlay={!!timeline}
                  playState={playState}
                  fromMeasure={lastEditMeasure}
                  anchored={tupletAnchor != null}
                  onPlay={onPlayFromEdit}
                  onStop={onStop}
                />
              ) : null
            }
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
                sigTolerant={SIG_TOLERANT}
                showLyrics={showLyrics}
                lyricHyphens={lyricHyphens}
                playing={playState !== "stopped"}
                getPositionMs={getPositionMs}
                onSeekToMeasure={(m) => onSeekMs(m.startMs)}
                selectedNote={selectedNote}
                onSelectNote={setSelectedNote}
                onDeleteNote={onDeleteNote}
                onNudgePitch={onNudgePitch}
                armedTool={armed?.kind ?? null}
                armedRest={armed?.kind === "duration" && armed.rest === true}
                onApplyTool={onApplyTool}
                onInsertNote={onInsertNote}
                tupletAnchor={tupletAnchor}
                onTupletPick={onTupletPick}
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
        rawDecode={rawDecode}
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

      {/* Always rendered, score or no score — the upload promise and the takedown route are what a
          first-time visitor needs most, and that is exactly the empty state. */}
      <footer className="kv-footer" id="legal">
        <p>{TR.footer.privacy}</p>
        <p>{TR.footer.rights}</p>
        <p>
          {TR.footer.contactLabel}{" "}
          <a href={TR.footer.contactHref} target="_blank" rel="noreferrer noopener">
            {TR.footer.contactText}
          </a>
          {" · "}
          <a href={TR.footer.noticesHref} target="_blank" rel="noreferrer noopener">
            {TR.footer.noticesText}
          </a>
        </p>
      </footer>
    </div>
  );
}

