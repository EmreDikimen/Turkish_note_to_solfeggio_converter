import type { AccidentalMode } from "./score/vexNotes";
import { AdvancedPanel } from "./ui/AdvancedPanel";
import { type AppError, toAppError } from "./ui/errors";
import { Backdrop } from "./ui/ornament/Backdrop";
import { BrandMark } from "./ui/BrandMark";
import { DEFAULT_KIT, type KitId } from "./audio/strokeKits";
import {
  DEFAULT_VIOLIN_TUNING,
  type MakamDetection,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
  USULS,
  type ViolinTuning,
  assignBars,
  beatMsOf,
  buildTimeline,
  deriveTimeSignature,
  estimateBpm,
  findUsul,
  groupMeasures,
  makamKomaDeltas,
  makamOptions,
  makamRuleUsage,
  measureOfEvent,
  remapKomaDeltas,
  resolveMakam,
  transpose as transposeDoc,
  unfoldDoc,
  withKomaDeltas,
} from "@turkish-omr/core";
import { DEFAULT_VOICE, type VoiceId, findVoice } from "./audio/instruments";
import {
  PRINT_NOISE,
  SIG_OVERRIDE,
  SIG_TOLERANT,
  SLUR_NOISE,
  STACCATO_NOISE,
  STRIP_BUDGET_OVERRIDE,
  TEXT_NOISE,
  TRANSPOSE_SPELLING,
  URL_CONCAVE_TUPLET,
  URL_LEGACY_TUPLET,
  URL_LYRICS,
  URL_MAX_MEASURES,
  URL_MODE,
  URL_NAVSEED,
  URL_PRINTSEED,
  URL_REPSEED,
  URL_RESPELLSEED,
  URL_SCORE,
  URL_SIG,
  URL_SLURSEED,
  URL_STACCATOSEED,
  URL_TEXTSEED,
  URL_THIN_SHARPS,
  URL_TRANSPOSE,
  URL_USULBARSEED,
  USUL_BAR_NOISE,
  readFollow,
  writeFollow,
} from "./browser/urlParams";
import {
  EXPORT_STAGE_ID,
  exportScorePdf,
  exportScorePng,
  waitForStage,
} from "./export/exportScore";
import { EditPalette, type PaletteRefusal, type Tool } from "./ui/EditPalette";
import { type ExportStrip, buildStrips } from "./score/stripExport";
import { FullScreenBar } from "./ui/FullScreen";
import { GoldRule } from "./ui/ornament/GoldRule";
import {
  type InstrumentId,
  InstrumentView,
  instrumentForVoice,
  voiceForInstrument,
} from "./instruments/InstrumentView";
import { IosInstallHint } from "./ui/IosInstallHint";
import { MakamModal } from "./ui/modals/MakamModal";
import { type MobileTab, MobileTabs } from "./ui/MobileTabs";
import { type NavMark, injectNavMarks } from "@turkish-omr/core/labels/navmarks";
import { type OmrStatus } from "./ui/status";
import { type VoiceStatus } from "./audio/webAudioBackend";
import type { RawDecode } from "./ui/DecodePanel";
import { RecentPages } from "./ui/RecentPages";
import { type RepeatSpan, detectRepeats, injectRepeats } from "@turkish-omr/core/labels/repeats";
import { SHEET_CONTENT_WIDTH, SHEET_SIDE_MARGIN } from "./score/layout";
import { ScoreCard } from "./ui/ScoreCard";
import type { ScoreStructure } from "@turkish-omr/core/labels/stitch";
import { SheetView } from "./score/SheetView";
import { markTargets, openRepeatBar } from "@turkish-omr/core/labels/structure-edit";
import { stitchDecoded } from "./omr/pipeline";
import { TR } from "./ui/strings";
import { ThemeSwitch } from "./ui/ThemeSwitch";
import { TransportBar } from "./ui/TransportBar";
import { TransposeModal } from "./ui/modals/TransposeModal";
import { UploadHero } from "./ui/UploadHero";
import { VoiceDownloadModal } from "./ui/modals/VoiceDownloadModal";
import { VoiceSwitchNotice } from "./ui/VoiceSwitchNotice";
import { warmDecodeServer } from "./omr/remote";
import { devMode } from "./browser/devMode";
import { navMarksFromStructure, repeatSpansFromStructure } from "@turkish-omr/core/labels/structure-view";
import { noteVisit } from "./browser/visits";
import { respellAeu } from "@turkish-omr/core/labels/respell";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDocHistory } from "./score/useDocHistory";
import { useTheme } from "./browser/theme";
import { useViewport } from "./browser/usePhone";
import { useRecentPages } from "./browser/useRecentPages";
import { useReadPage } from "./omr/useReadPage";
import { useEditing } from "./score/useEditing";
import { backend } from "./audio/backend";
import { usePlayback } from "./audio/usePlayback";


/** The "Gelişmiş" developer panel: dev server, or a device that opted in with `?dev=1` (devMode.ts). */
const SHOW_DEV_PANEL = devMode();

type ViewMode = "sheet" | "instrument";
// SheetView's per-engrave layout payload (measure rectangles + svg size), used by the strip exporter.
type SheetLayout = { boxes: { index: number; x: number; y: number; width: number }[]; svgWidth: number; svgHeight: number; rowHeight: number };


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

/**
 * What the transposition dropdown offers, and how each step is named.
 *
 * The unit is the KOMA, because that is what the app is about and what the number in the URL
 * parameter means. Small steps are named in commas alone (an accidental's worth of movement: koma
 * 1, bakiye 4, küçük mücennep 5, büyük mücennep 8). Anything larger is named in WHOLE TONES first
 * (owner, 2026-10-16: *"1 tam ses, 1,5 tam ses şeklinde yaz"*), the comma count after it, and for the
 * fourth and the fifth the everyday name too — "2,5 tam ses (22 koma) (yaygın: 4 ses)" — because
 * players say "4 ses" for a fourth. Until then the list was named by interval ("2 ses (9 koma)" for
 * ONE tone), which read as twice the distance to anyone counting tones.
 *
 * The counts are the çargâh (major) scale in AEU, 9 + 9 + 4 + 9 + 9 + 9 + 4 = 53, plus the minor
 * third 9 + 4 = 13 (la→do), added the same day because some pieces are played 1,5 tones away and
 * the list had no step for it: 1 tam ses = 9, 1,5 = 13, 2 = 18, 2,5 = 22, 3,5 = 31, 4,5 = 40,
 * 5,5 = 49, 6 (the octave) = 53.
 *
 * ⚠ The labels are copy and free to change; the NUMBERS are the contract (`transposeDoc` takes
 * commas, and `?transpose=` in the render automation is the same unit).
 */
const TRANSPOSE_STEPS: ReadonlyArray<readonly [number, string]> = (() => {
  const steps: [number, string][] = [
    [1, "1 koma"], [4, "4 koma"], [5, "5 koma"], [8, "8 koma"],
    [9, "1 tam ses (9 koma)"], [13, "1,5 tam ses (13 koma)"], [18, "2 tam ses (18 koma)"],
    [22, "2,5 tam ses (22 koma) (yaygın: 4 ses)"], [31, "3,5 tam ses (31 koma) (yaygın: 5 ses)"],
    [40, "4,5 tam ses (40 koma)"], [49, "5,5 tam ses (49 koma)"],
    [53, "6 tam ses — sekizli (53 koma)"],
  ];
  return [
    ...[...steps].reverse().map(([n, label]) => [-n, `−${label}`] as const),
    [0, "Özgün hâli"] as const,
    ...steps.map(([n, label]) => [n, `+${label}`] as const),
  ];
})();

/**
 * The name of a staff transposition, as the dropdown says it, or null when the score is not
 * transposed. A value the list has no step for (a `?transpose=` from the URL) is named in commas.
 */
function transposeLabel(commas: number): string | null {
  if (commas === 0) return null;
  const step = TRANSPOSE_STEPS.find(([n]) => n === commas);
  return step ? step[1] : `${commas > 0 ? "+" : "−"}${Math.abs(commas)} koma`;
}

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
  const [error, setError] = useState<AppError | null>(null);
  // Transport state: "stopped" → Play; "playing" → Pause; "paused" → Resume. Stop resets it.
  const [playState, setPlayState] = useState<"stopped" | "playing" | "paused">("stopped");
  // Which view is shown, and whether the sheet is in edit mode.
  // The engraved sheet is the product; the piano-roll is a diagnostic. Sheet by default now,
  // where the harness opened on the roll. (Render automation always wanted sheet anyway.)
  const [viewMode, setViewMode] = useState<ViewMode>("sheet");
  // Watches `(max-width: 700px)`, the same line `app.css` draws the phone layout at.
  const { isPhone, phoneShaped, coarse } = useViewport();
  /** The `contentWidth` the sheet is re-engraved at, or null for the default 1000px.
   *  Set on every PHONE and in full screen at any width — see the effect below. */
  const [fitContentW, setFitContentW] = useState<number | null>(null);
  // ⚠ PHONE ONLY — which of the four bottom tabs is showing. On a wide window `isPhone` is
  // false, `MobileTabs` never renders and `data-mtab` selects nothing, so the desktop layout is
  // untouched by every line this state reaches. See ui/MobileTabs.tsx and usePhone.ts.
  const [mobileTab, setMobileTab] = useState<MobileTab>("nota");
  // ⚠ PHONE ONLY — the score alone, re-engraved to the screen's width. See ui/FullScreen.tsx.
  const [fullScreen, setFullScreen] = useState(false);
  // ⚠ PHONE ONLY — is the Perde sheet open over the Nota tab? Makam, transposition and the
  // accidental mode decide what the page says and sounds, so the owner asked for them beside the
  // score (2026-09-26). Inline they cost 314px of a 800px screen and left 32px of music, measured;
  // as a sheet they cost the 44px of the button that opens them.
  const [pitchOpen, setPitchOpen] = useState(false);
  // Light / dark (owner, 2026-10-01). Held HERE, not in the switch, so the page keeps following the
  // system while no switch is on screen (full screen, a phone's Nota tab).
  const [theme, setTheme] = useTheme();
  /**
   * Which export is in flight, and the flag that mounts the hidden PAPER-WIDTH engraving.
   *
   * ⚠ **The export must not be a photograph of the phone** (owner, 2026-09-27: *"genişlik normal
   * nota kağıdı genişliğinde olmalı… dikeylemesine çok uzun ve bulanık"*). On a 393px screen the
   * score is engraved 324px wide with two bars to a system, so saving what is on screen gives a
   * 324×7820 ribbon: right for a thumb, wrong for a sheet of paper. The stage below draws the SAME
   * document at the engraver's own default width — four bars to a system, the desktop look, which
   * is what sheet music looks like — and the export reads that instead.
   * ⚠ Hidden, never shown: the reader's screen must not flicker through a re-engrave.
   */
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  /** True for the one frame between a view switch being asked for and the new view being mounted. */
  const [viewSwapping, setViewSwapping] = useState(false);
  const [editMode, setEditMode] = useState(false);
  /**
   * Which accidentals the staff prints: on every note, once at the row start, or once per measure
   * and carried to the end of it.
   *
   * ⚠ **`"measure"` IS THE HUMAN DEFAULT** (owner, 2026-09-27: *"make the accidental dropdown's
   * default option Standart (ölçü boyunca)"*). It is what a printed edition does and therefore what
   * a person expects to read; `"every"` was the old default and it prints an accidental the page
   * would not have, on every repetition of a note.
   *
   * ⚠ `URL_MODE` STILL WINS, AND THAT IS LOAD-BEARING. A renderer-driven page is exactly one that
   * passes `?mode=`, `tools/render/render.ts` sets it on every job and re-checks it against each
   * cache entry, so the corpus never sees this default. Changing it therefore changes what a human
   * reads and nothing about pixels-equal-labels.
   */
  const [accidentalMode, setAccidentalMode] = useState<AccidentalMode>(URL_MODE ?? "measure");
  // Sheet: draw lyric syllables under the notes (vocal scores). Off → instrumental-style sheet.
  // ⚠ **FALSE is the human default now** (owner, 2026-09-26). It was `true`, which only worked
  // while a switch existed to turn it off; the switch is gone because the model does not read
  // lyrics off a page yet, so a decoded score has none to draw. ⛔ The render automation is
  // untouched: `?lyrics=` still wins, and `tools/render/render.ts` ALWAYS passes it (`"1"` or
  // `"0"`), so no corpus render has ever depended on this fallback.
  const [showLyrics, setShowLyrics] = useState(URL_LYRICS != null ? URL_LYRICS === "1" : false);
  // Draw a hyphen between a word's syllables ("Gam-ze-de"). Most sheets omit these → default off.
  const [lyricHyphens, setLyricHyphens] = useState(false);
  // Sheet: follow the playhead down the page while it plays (see `readFollow` above for the
  // default and where it is remembered).
  const [followPlayhead, setFollowPlayhead] = useState(readFollow);
  // Phase-2: draw detected repeat barlines + voltas on the sheet. SymbTr flattens repeats (a
  // repeated passage appears twice in a row), so detectRepeats finds where the signs belong; the
  // strip labels then carry the matching repeat tokens. Purely visual + labels — the doc, layout,
  // playback, and playhead are untouched.
  const [showRepeats, setShowRepeats] = useState(false);
  // A DECODED page's own structure: which bars carry `‖:` `:‖` 1./2. 𝄋 ⊕ "D.C." "Son", and the
  // order those signs make the bars play in (`playBars`). The model reads these signs off the
  // photograph, so the score is kept as WRITTEN — a repeated passage appears once, with its signs
  // — and the repeat is taken at playback time instead. Null for a score that has no structure
  // (a SymbTr sample, a loaded JSON): then written order IS playing order and nothing below fires.
  const structure = history.structure;
  // Escape hatch for the folded sheet: write the performance out long, every repeat taken, the way
  // the app did before the signs existed. VIEW ONLY — the document stays written, so this is not an
  // edit and cannot be undone into; edit mode is closed while it is on (the long score's notes are
  // copies, and an edit aimed at a copy would land on the wrong note).
  const [writeOut, setWriteOut] = useState(false);
  // Edit mode: which event (`NoteEvent.index`) is selected on the sheet, or null. A selection is
  // a POSITION, not an identity — deletes renumber — so it is cleared on load, on leaving edit
  // mode, and on undo/redo rather than being translated across those.
  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  // Edit mode: the ARMED palette tool, or null for plain selection (click selects, drag moves the
  // pitch). Armed, a click on a note applies the tool instead — the Mus2 model. Cleared with the
  // edit toggle so a friend cannot leave a tool armed and come back to it.
  const [armed, setArmed] = useState<Tool | null>(null);
  // Why the last SIGN placement was rejected, or null. A refusal has nowhere else to show itself —
  // the sheet cannot draw a sign that was not placed — so it takes over the palette's hint line
  // until the next click or the next armed tool. See `structure-edit.ts` for what refuses.
  const [refused, setRefused] = useState<PaletteRefusal | null>(null);
  // The repeat tool's first click: the bar its `‖:` will open on, with the closing barline still
  // awaited. ⚠ It is NOT in the document — nothing is committed until the second click, which is
  // the whole reason the tool asks for both ends (owner, 2026-09-03). Cleared by Esc, by arming
  // anything else, and by clicking the dashed marker again.
  const [repeatAnchor, setRepeatAnchor] = useState<number | null>(null);
  // Tuplet tool only: the FIRST note of the run, waiting for its end. The one two-click gesture in
  // the palette, so it is the one tool with a state between clicks. Like the selection this is a
  // position, not an identity, so it is dropped rather than translated whenever the document or
  // the tool changes — see `armTool` and the undo/redo handlers.
  const [tupletAnchor, setTupletAnchor] = useState<number | null>(null);
  // Tuplet tool only: a WHOLE triplet is selected, named by its first member's `NoteEvent.index`.
  // The group itself is never stored — nothing about a tuplet ever is — so this is re-derived from
  // the document with `closedTupletAt` wherever it is needed; holding the three positions instead
  // would go stale the moment the handles moved them. Same position-not-identity rule as the
  // selection above: cleared on load, on a tool change and on undo/redo.
  const [selectedTuplet, setSelectedTuplet] = useState<number | null>(null);
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
  // Which drum plays them. Unlike the volume this DOES go through `applyPlayback`, because the
  // buffers are chosen as each stroke is scheduled — a change has to re-schedule to be heard.
  const [percussionKit, setPercussionKit] = useState<KitId>(DEFAULT_KIT);
  // Which instrument sounds the NOTES (feature track F1 — what W10's friends asked for). Goes
  // through `applyPlayback` for the same reason the kit does: the buffer is chosen as each note is
  // scheduled. The default is the synthesised tone, which is the only voice that needs no download.
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE);
  /**
   * Which instrument the "Enstrüman üzerinde" page draws (owner, 2026-08-29).
   *
   * ⚠ It opens on whatever the voice already is, when that is an instrument we can draw, so someone
   * who chose Kanun in the transport does not find a violin here. It is deliberately NOT a live
   * two-way binding: choosing Klarnet in the transport must not blank this page.
   */
  const [instrument, setInstrument] = useState<InstrumentId>(
    () => instrumentForVoice(DEFAULT_VOICE) ?? "violin",
  );
  /**
   * The violin's open strings (owner, 2026-09-27: *"let the tuning of the strings be changeable"*).
   *
   * ⚠ IT LIVES HERE AND NOT IN `Fingerboard`, WHICH IS WHERE IT IS USED. The instrument page
   * unmounts every time the person goes back to the Nota tab, so state held down there would put
   * the pegs back on a tab switch — and silently, with the picture redrawing correctly for the
   * wrong tuning. The same reasoning that keeps `instrument` up here.
   *
   * ⚠ It is NOT part of `doc` and must never be written into one: an accord is a property of the
   * player's instrument, not of the page they are reading, and a score saved with someone's
   * scordatura baked in would come back wrong on a normal violin.
   */
  const [tuning, setTuning] = useState<ViolinTuning>(DEFAULT_VIOLIN_TUNING);
  /**
   * The download question that is on screen, if any (owner, 2026-09-27: ask before downloading a
   * voice). `go` is what a "yes" does; `no` is what a "no" does besides closing.
   */
  const [voiceAsk, setVoiceAsk] = useState<null | { voice: VoiceId; go: () => void; no?: () => void }>(
    null,
  );
  /** Voices the reader said yes to in THIS visit — asked once each, not on every switch back.
   *  ⚠ Per visit on purpose: a later visit may really download again, so it asks again. */
  const voicesApproved = useRef(new Set<VoiceId>());
  /** Voices the reader said no to when merely OPENING the instrument tab — so going back and forth
   *  between the tabs does not ask again every time. An explicit pick from a list always asks. */
  const voicesDeclinedOnOpen = useRef(new Set<VoiceId>());
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(() => backend.voiceInfo());
  // Which usul drives the metronome pattern (name key; defaults to the loaded piece's usul).
  const [usulName, setUsulName] = useState<string>(USULS[0]!.name);
  // Which makam's PERFORMED intonation playback uses. "" = none, i.e. sound the notes exactly as
  // the staff spells them (the old behaviour, and the safe default). Set from the score's own
  // metadata when it has any, guessed from the notes after a decode, always user-editable.
  const [makamSlug, setMakamSlug] = useState("");
  // The post-decode prompt: non-null while the modal is up. Only a decode raises it — a loaded
  // sample already knows its makam and has nothing to ask.
  const [makamPrompt, setMakamPrompt] = useState<MakamDetection | null>(null);
  const {
    clearRecent,
    openRecent,
    recent,
    recentOpen,
    removeRecent,
    renameRecent,
    saved,
    setRecentOpen,
    setSaved,
  } = useRecentPages({
    bpm,
    doc,
    loadDoc,
    makamSlug,
    onStop,
    setBpm,
    setError,
    setOmrStatus,
    setRawDecode,
    setSampleFile,
    structure,
  });

  /**
   * ⭐ THE ONE-TIME NOTE ON THE NOTA TAB AFTER A READ (owner, 2026-11-25, UI review item 5). The
   * status line lives on the Sayfalar tab, but a phone lands on Nota after a read — so the reader
   * never saw that it worked, nor that wrong notes can be fixed. Tied to the RECORD the read opened
   * (`saved.id`): opening another page hides it, a new read replaces it, ✕ or entering edit mode
   * (the advice taken) closes it.
   */
  const [readNote, setReadNote] = useState<{ id: string; notes: number } | null>(null);
  useEffect(() => {
    if (omrStatus?.state === "done" && omrStatus.kind === "page" && saved)
      setReadNote({ id: saved.id, notes: omrStatus.counts?.notes ?? 0 });
    // Only a NEW finished status opens it; `saved` changing on its own (a rename) must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [omrStatus]);
  useEffect(() => {
    if (editMode) setReadNote(null);
  }, [editMode]);
  // Currently-applied chromatic transposition, in commas (0 = original). A test control for the
  // core `transpose`; later this becomes the ahenk selector (each ahenk is a fixed comma offset).
  const [transpose, setTranspose] = useState(0);
  // ⭐ The SOUND's shift, apart from the staff's `transpose` (owner, 2026-10-27). Equal to it
  // unless a player set them apart in the "Gelişmiş" dialog — a transposing instrument (a "4 ses"
  // ney, kız or mansur ney) reads one note and sounds another. Sound-only, the old `keepSheet`, is
  // the case `transpose === 0`. The stored score (`doc`) is never mutated by either.
  const [soundTranspose, setSoundTranspose] = useState(0);
  const [transposeOpen, setTransposeOpen] = useState(false);
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
    staccatoseed: URL_STACCATOSEED,
    usulbarseed: URL_USULBARSEED,
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
  function loadDoc(raw: NoteModelDocument, detected?: MakamDetection, structure?: ScoreStructure) {
    // Assign each event a stable bar number from SymbTr's offset column up front, so measure
    // grouping is correct for every usul and survives edits (which would otherwise lose it).
    const d = assignBars(raw);
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
    setSoundTranspose(0);
    setSelectedNote(null);
    setTupletAnchor(null); // a half-finished tuplet names a note in the score being replaced
    setSelectedTuplet(null); // and so does a selected one
    setLastEditMeasure(null); // nothing edited yet → the palette's Çal starts at the top
    setWriteOut(false);
    // The list is a way back, not the destination: once there is a score on screen it folds away.
    setRecentOpen(false);
    // ⚠ PHONE ONLY, and a wide window sees none of it: a new score arrives on the READING tab.
    // The editing tab's armed tool and selection point at a document that has just been replaced,
    // and on a phone the tab bar is the only thing that says which section you are looking at.
    if (isPhone) {
      setMobileTab("nota");
      if (editMode) applyEditMode(false);
    }
    // ⚠ The signs go in with the document, in ONE `reset`. Only a decoded page brings a structure;
    // every other source plays exactly as it is written, so this CLEARS as often as it sets — a
    // leftover from the previous page would fold the next score along bar numbers that mean
    // nothing in it. They share the undo stack (see `useDocHistory`'s `ScoreState`), which is why
    // there is no `setStructure` any more.
    history.reset(detected ? { ...d, makam: slug } : d, structure ?? null);
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
        setSaved(null); // …and so it is not remembered: the list is pages READ, not scores opened
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
        if (URL_TRANSPOSE !== 0) {
          setTranspose(URL_TRANSPOSE);
          setSoundTranspose(URL_TRANSPOSE);
        }
      });
    }
    // Start the decode server waking while the user is still choosing a file: a cold container is
    // ~10 s from ready, and picking a file takes longer than that. Costs one cheap GET and cannot
    // fail visibly (omr/remote.ts).
    warmDecodeServer();
    // Somebody opened the app. Anonymous, and it counts nothing on a dev server, under Playwright
    // or on a device that has opted out — analytics/visits.ts.
    noteVisit("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the views draw: the stored score, optionally rewritten by the transpose — unless we're
  // keeping the sheet as-is (transposing-instrument case). Never mutates `doc`.
  const displayDoc = useMemo(() => {
    let d = doc && transpose !== 0 ? transposeDoc(doc, transpose, TRANSPOSE_SPELLING) : doc;
    // Render automation: seeded AEU-enharmonic respell so the rare büyük glyphs appear at all in
    // training (a decoder can't emit a token it never saw). Deliberately low-rate — common signs
    // keep their natural distribution; see packages/core/src/labels/respell.ts for the full rationale.
    if (d && URL_RESPELLSEED != null) d = respellAeu(d, URL_RESPELLSEED);
    return d;
  }, [doc, transpose]);

  // Which notes the selected makam bends, and by how many commas. Read from the BASE doc's
  // written spelling — the rules match a written letter+accidental, and `transposeDoc` respells
  // every note from its koma, so by then the letters they key on are gone. Keyed by event index
  // so the result survives a transpose and can be applied on the far side of it.
  const makamDeltas = useMemo(() => makamKomaDeltas(doc, makamSlug), [doc, makamSlug]);

  // The same answer, per RULE rather than per note, for the line beside the picker: which written
  // perde the makam moves, and how many of this score's notes that reaches. One matcher feeds both
  // (`eachRuleMatch` in core), so the number on screen cannot drift from the pitches that bend.
  const makamUsage = useMemo(() => makamRuleUsage(doc, makamSlug), [doc, makamSlug]);

  // The playable timeline. The SOUND shifts by `transpose` in BOTH modes: when the staff is
  // rewritten, displayDoc already carries the shifted komas; when keeping the sheet, we instead
  // nudge the tuning anchor so only the frequencies move. Both yield identical sounding pitches.
  // The makam's deltas go on LAST, so their fractional komas reach buildTimeline (which recomputes
  // frequency from koma53) and nothing that spells a note name.
  //
  // ⚠ The document is the WRITTEN score, which a repeat sign makes shorter than the performance,
  // so the timing is built from `unfoldDoc` — the written bars in playing order. Everything the
  // audio side sees is therefore an ordinary flat document, exactly as before the signs existed.
  const perf = useMemo(() => {
    if (!doc) return null;
    // The staff's shift is already in `displayDoc`'s komas; whatever the SOUND moves beyond it goes
    // on the tuning anchor, so only the frequencies move (sound-only is the case transpose = 0).
    const soundOnly = soundTranspose - transpose;
    const base =
      soundOnly !== 0 && displayDoc
        ? { ...displayDoc, tuning: { ...displayDoc.tuning, refKoma: displayDoc.tuning.refKoma - soundOnly } }
        : displayDoc;
    if (!base) return null;
    const played = unfoldDoc(base, structure?.playBars);
    // ⛔ **`makamDeltas` is keyed by the WRITTEN document and `unfoldDoc` renumbers**, so it has to be
    // re-keyed onto the performance or the bend lands on the wrong note — silently, because every
    // index still exists. It is not only a repeat that moves them: the unfolder drops `meta` events,
    // which shifts every later index on an ordinary page. Fixed 2026-09-05, after the owner heard it
    // ("bazen la farklı çalıyor, bazen re, bazen mi"); it was 19 wrong notes out of 22 on
    // `gamzedeyim-deva` under uşşak. ⚠ The bend goes ONLY into the timeline — `perf.doc` below stays
    // the written performance, because the kanun view looks a course up by an exact written koma.
    const timeline = buildTimeline(
      withKomaDeltas(played.doc, remapKomaDeltas(makamDeltas, played.srcOf)),
    );
    // One step per sounding event, each naming the WRITTEN note the sheet drew for it. This is the
    // whole of "sound and picture match": on the second pass the steps name the first pass's notes
    // again, so the cursor walks back to the `‖:` by itself.
    const playPlan = timeline.notes.map((n) => ({
      evIndex: played.srcOf.get(n.index) ?? n.index,
      startMs: n.startMs,
      endMs: n.startMs + n.durationMs,
    }));
    return {
      timeline,
      // The performance as a document: same events as the timeline, in the same order. The
      // instrument views pair `timeline.notes[i].index` with an event, so they need THIS doc — on
      // a folded score the written one has no event under a second-pass index.
      doc: played.doc,
      // Undefined when the page plays as it is written (and when it is written out long, where the
      // drawn order IS the playing order): then the playhead's own drawn positions are correct and
      // nothing has to be mapped.
      playPlan: played.folded && !writeOut ? playPlan : undefined,
      // ⚠ The SAME steps, always defined. The measure card draws ONE bar as a slice, and a slice's
      // own clock starts at zero — so "which note is sounding" can only be answered against the
      // performance and mapped back, folded or not. The sheet can do without it because it draws
      // the whole page in order; the card cannot.
      steps: playPlan,
      firstStartMs: played.firstStartMs,
    };
  }, [doc, displayDoc, soundTranspose, transpose, makamDeltas, structure, writeOut]);
  const timeline = perf?.timeline ?? null;

  // What the sheet DRAWS. Normally the written score itself; with the escape hatch on, the
  // performance written out long (see `writeOut`), which is what the app showed before it could
  // draw a repeat sign.
  // The score's title, as the page header above the notes AND the saved PNG/PDF both say it: the
  // reader's name for the page (else the score's own title), then the staff transposition.
  // ⚠ NONE in a render job: the header sits above the SVG, so a different title block moves the
  // staves and changes the training strips (measured 2026-11-23: 117 of 232 files) — the render pin.
  const heading = useMemo(() => {
    if (!doc || SIG_TOLERANT) return undefined;
    const label = transposeLabel(transpose);
    return {
      name: saved?.name || doc.title || doc.name || "nota",
      transposed: label ? TR.card.transposed(label) : null,
    };
  }, [doc, saved?.name, transpose]);

  const drawnDoc = useMemo(() => {
    const written = displayDoc ?? doc;
    if (!written || !structure || !writeOut) return written;
    return unfoldDoc(written, structure.playBars).doc;
  }, [displayDoc, doc, structure, writeOut]);

  // The repeat signs to draw. SheetView draws them and the strip labels get the matching tokens
  // from the SAME spans, so a strip's pixels and label always agree.
  const repeatSpans = useMemo<RepeatSpan[] | undefined>(() => {
    const drawn = drawnDoc;
    if (!drawn) return undefined;
    // A DECODED page draws the signs the model actually read off the photograph — never signs
    // guessed by matching duplicate bars, which is a different question with a different answer.
    // Written out long, it draws none: the repeat has already been taken, and a `:‖` would be an
    // instruction to take it a second time.
    if (structure)
      return writeOut ? undefined : repeatSpansFromStructure(structure, groupMeasures(drawn).length);
    // Render automation: a repseed adds seeded random spans on top of the detected ones (Rung-2
    // repeat-token coverage — SymbTr itself has no repeats). Interactive: the Repeats toggle.
    if (URL_REPSEED != null) return injectRepeats(drawn, URL_REPSEED, detectRepeats(drawn));
    return showRepeats ? detectRepeats(drawn) : undefined;
  }, [showRepeats, drawnDoc, structure, writeOut]);

  // Injected navigation marks (segno/coda/D.C./Son — Rung-2 coverage; SymbTr has none, so there
  // is nothing to detect). URL-driven only, like the other render-automation seeds. Depends on
  // the repeat spans: injection keeps nav marks off repeat/volta measures (shared drawing band).
  const navMarks = useMemo<NavMark[] | undefined>(() => {
    // A decoded page's 𝄋 / ⊕ / "D.C." / "Son" are read, not injected — and, like the repeat signs,
    // they are not drawn over a score that has already been written out long.
    if (structure) return writeOut ? undefined : navMarksFromStructure(structure);
    const drawn = drawnDoc;
    if (!drawn || URL_NAVSEED == null) return undefined;
    return injectNavMarks(drawn, URL_NAVSEED, repeatSpans ?? []);
  }, [drawnDoc, repeatSpans, structure, writeOut]);

  /**
   * The signs a click can delete, and the `‖:` that nothing closes yet.
   *
   * ⚠ Both come from the FLAGS, never from `repeatSpans`. The drawn spans include a `‖:` the page
   * does not carry (an unmatched `:‖` is drawn as repeating from the top — the engraving
   * convention), and offering to delete that would be a button that does nothing. `openRepeat` is
   * the opposite case: a flag the engraved staff deliberately does NOT draw, which edit mode has
   * to show or the tool looks broken.
   */
  const signTargets = useMemo(
    () =>
      editMode && !writeOut && structure && drawnDoc
        ? markTargets(structure, groupMeasures(drawnDoc).length)
        : undefined,
    [editMode, writeOut, structure, drawnDoc],
  );
  const openRepeat = useMemo(
    () =>
      editMode && !writeOut && structure && drawnDoc
        ? openRepeatBar(structure, groupMeasures(drawnDoc).length)
        : null,
    [editMode, writeOut, structure, drawnDoc],
  );

  // The piece's natural tempo (speed = 1) and its beat grid, for the speed control + metronome.
  const naturalBpm = useMemo(() => (doc ? estimateBpm(doc) : 0), [doc]);
  const beatMs = useMemo(() => (doc ? beatMsOf(doc) : 0), [doc]);

  // Step-2c: the training strips for the currently-drawn score + accidental mode, and the selected
  // one. Uses the SAME doc + repeat spans SheetView draws, so crop geometry and labels match pixels.
  const strips = useMemo<ExportStrip[]>(() => {
    const drawn = drawnDoc;
    // Pass the real mode (incl. "measure"/carry), the same conventional-signature override
    // SheetView draws with, and the same accidental tolerance it draws with, so carry labels equal
    // the drawn signature AND the drawn accidentals (faithful scheme).
    return drawn && layout
      ? buildStrips(
          drawn, layout.boxes, accidentalMode, repeatSpans, navMarks, SIG_OVERRIDE, SIG_TOLERANT,
          // Absent in interactive use and in every pre-2026-08-17 render job, so the default
          // STRIP_BUDGET applies and the corpus recipe is unchanged. See URL_MAX_MEASURES.
          STRIP_BUDGET_OVERRIDE,
        )
      : [];
  }, [repeatSpans, navMarks, drawnDoc, layout, accidentalMode]);
  const selectedStrip = useMemo(() => strips.find((s) => s.id === selectedStripId) ?? null, [strips, selectedStripId]);
  // Expose the strips + score meta + applied render config for the Playwright batch exporter
  // (tools/render/render.ts). `applied` is true only once the engraved layout matches the
  // currently-requested configuration, i.e. the strips' crop rects and labels agree.
  useEffect(() => {
    const w = window as unknown as {
      __omrStrips?: ExportStrip[];
      __omrMeta?: { makam: string; name: string };
      /** The live document — the WRITTEN score, edits included. This is how the browser checks read
       *  the note model back (`smoke:app`, `smoke:editor`); the app itself has no export button. */
      __omrDoc?: NoteModelDocument | null;
      /** A decoded page's signs and playing order, so a check can see that the page is FOLDED —
       *  written shorter than it sounds — without reading a single word off the screen. */
      __omrStructure?: ScoreStructure | null;
      __omrConfig?: {
        score: string; mode: AccidentalMode; lyrics: boolean; transpose: number; sig: string | null;
        repseed: number | null; navseed: number | null; textseed: number | null; respellseed: number | null; slurseed: number | null;
        staccatoseed: number | null;
        usulbarseed: number | null;
        printseed: number | null;
        /** Which tuplet mark this page drew — the A/B arm, so a renderer can assert it once
         *  instead of discovering a mis-set flag after 40k strips. */
        legacyTuplet: boolean;
        /** The strip-packing measure rail this page cut with — `null` = STRIP_BUDGET's default.
         *  Exposed for the same reason `legacyTuplet` is: a renderer can assert the geometry it
         *  asked for was actually applied, rather than finding out after a whole pilot arm. */
        maxmeasures: number | null;
        applied: boolean;
      };
    };
    w.__omrStrips = strips;
    w.__omrDoc = doc;
    w.__omrStructure = structure;
    if (doc) w.__omrMeta = { makam: doc.makam, name: doc.name };
    w.__omrConfig = {
      score: sampleFile, mode: accidentalMode, lyrics: showLyrics, transpose, sig: URL_SIG ?? null,
      repseed: URL_REPSEED, navseed: URL_NAVSEED, textseed: URL_TEXTSEED, respellseed: URL_RESPELLSEED, slurseed: URL_SLURSEED,
      staccatoseed: URL_STACCATOSEED,
      usulbarseed: URL_USULBARSEED,
      printseed: URL_PRINTSEED,
      legacyTuplet: URL_LEGACY_TUPLET,
      maxmeasures: URL_MAX_MEASURES,
      applied: layoutTag === renderTag,
    };
  }, [strips, doc, structure, sampleFile, accidentalMode, showLyrics, transpose, layoutTag, renderTag]);

  /**
   * The tab switch — and **opening "Enstrüman üzerinde" now picks its sound too** (owner,
   * 2026-09-04: *"nota dan enstrüman üzerinde tab ına geçtiğimizde çalgı sesi değişiminin
   * tetiklenmesini sağlar mısın"*).
   *
   * ⚠ **This reverses the "only on an explicit change" rule this handler used to carry.** The old
   * reason was real and has not gone away: a sampled voice is a 20–35 MB download from the Hub, so
   * the tab used to draw a violin while the default tone still played, and only touching the picker
   * resolved it. The owner priced that split — you see one instrument and hear another until you
   * find a control you were not told about — as the worse of the two, so the download is now the
   * cost of opening the page.
   *
   * ⚠ The voice comes from **whatever the picker already shows**, not from a fixed instrument: the
   * page and the sound agree the moment the page appears. Leaving the tab changes nothing — the
   * chosen voice stays, exactly as it does when it is chosen from the transport.
   *
   * ⚠ Guarded on `voice`, so re-entering the tab does not re-schedule playback (`applyVoice` calls
   * `applyPlayback`) for a voice that is already the one sounding. `ensureVoice` would be a no-op
   * on its own; the re-schedule would not.
   */
  /**
   * Switch between the score and the instrument page.
   *
   * ⭐ **THE SWAP PAINTS A PLACEHOLDER FIRST, AND THAT IS NOT A NICETY** (owner, 2026-09-27:
   * *"enstrüman üzerinden nota tabına geçmek için birkaç kez basmam gerekiyor"*). `SheetView` draws
   * in a `useLayoutEffect`, which runs BEFORE the browser paints — deliberately, so an edit never
   * flashes an empty stave. The cost is that mounting the score blocks the frame for the whole
   * engraving: measured at 6× CPU throttling, **246 ms** on an 83-note page, **606 ms** on 511
   * notes and **931 ms** on the largest here, and longer on a real phone. For that whole time
   * NOTHING on screen changes — not even the segmented control's own highlight, because the commit
   * that would move it is the commit that blocks. A tap that changes nothing reads as a tap that
   * was missed, so the reader taps again.
   *
   * ⚠ So the view is swapped in TWO commits: the first paints the switch and a line saying the page
   * is being drawn, the second mounts it and blocks. `requestAnimationFrame` twice, because one
   * frame only guarantees the layout, not that it reached the screen.
   */
  function applyViewMode(v: ViewMode) {
    setViewMode(v);
    setViewSwapping(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setViewSwapping(false)));
    if (v !== "instrument") return;
    const want = voiceForInstrument(instrument);
    // ⚠ A "no" given on OPENING the tab is remembered, or every trip Nota → Enstrüman would ask
    // again. The picker on the page still asks, because picking is asking.
    if (want === voice || voicesDeclinedOnOpen.current.has(want)) return;
    requestVoice(
      want,
      () => {
        void backend.ensureVoice(want);
        applyPlayback(bpm, metronome, usulName, percussion, percussionKit, want);
      },
      () => voicesDeclinedOnOpen.current.add(want),
    );
  }

  /**
   * Turn edit mode on or off — the ONE place that does, so the phone's tab cannot drift from it.
   *
   * Entering folds the score back to what is WRITTEN (`writeOut` off): you edit the one bar the
   * page carries and the repeat follows it. Leaving drops everything that names a note in a score
   * you are no longer editing — the selection, a half-finished tuplet, the armed tool.
   *
   * ⚠ On a phone this is the same fact as "the Düzenle tab is open", so the two move together.
   * Written as a functional update because `onMobileTab` below may have queued a tab change in the
   * same click: it must not be overwritten by a stale read of `mobileTab`.
   */
  function applyEditMode(v: boolean) {
    setEditMode(v);
    if (v) setWriteOut(false);
    if (!v) {
      setSelectedNote(null);
      setSelectedTuplet(null);
      armTool(null);
    }
    if (isPhone) setMobileTab((cur) => (v ? "duzenle" : cur === "duzenle" ? "nota" : cur));
  }

  /**
   * The phone's bottom tab bar changed tab.
   *
   * ⚠ Düzenle IS edit mode here — there is no second switch to leave behind. The card's own
   * `#edit-toggle` still works and still exists (`smoke:phone` clicks it, and hiding a control a
   * check drives is how a probe starts throwing); it simply routes through `applyEditMode`, which
   * moves the tab. Both roads, one state.
   */
  function onMobileTab(next: MobileTab) {
    setMobileTab(next);
    // A sheet belongs to the screen it was opened on.
    setPitchOpen(false);
    if (next === "duzenle") {
      if (!editMode) applyEditMode(true);
    } else if (editMode) {
      applyEditMode(false);
    }
  }

  /**
   * Enter / leave full screen (phone only).
   *
   * ⚠ Entering also moves to the Nota tab. BOTH attributes sit on `#app` and both hide sections:
   * arriving from the Çal tab, `[data-mtab="cal"]` would still be hiding `.kv-card` and full screen
   * would be a blank screen.
   */
  function applyFullScreen(v: boolean) {
    setFullScreen(v);
    if (v) setPitchOpen(false);
    // ⚠ Entering LEAVES EDIT MODE, and that is not tidiness (2026-09-26). The way in moved to the
    // card's own tools, which are on screen while editing too — and full screen hides the toolbox
    // without clearing `editMode`, so coming back out landed on the Nota tab in edit mode with no
    // tools and a button reading "Düzenleniyor". Reading is reading. `applyEditMode(false)` also
    // moves the tab off Düzenle, which is where the line below would have put it anyway.
    if (v && editMode) applyEditMode(false);
    if (v) setMobileTab("nota");
    // ⚠ Both directions, and it is not a nicety. Either way the page is RE-ENGRAVED at a different
    // width, so its height changes by thousands of pixels and the scroll offset it kept points at
    // a different bar than the one that was on screen. Entering from the Çal tab it landed halfway
    // down the piece. The top is the one position that means the same thing in both layouts.
    window.scrollTo(0, 0);
  }

  /**
   * Fit the engraving to the screen: on every PHONE, and in full screen at any width.
   *
   * ⚠ **THIS IS A RE-ENGRAVE, NOT A ZOOM** — fewer bars per system at the same note size.
   * `.kv-score` may never be scaled: that SVG is the training-strip source and `tools/render/
   * render.ts` cuts strips out of it by rect (docs/APP-RULES.md).
   *
   * ⚠ **The phone arm is the whole point** (2026-09-19). Before it, only full screen fitted, so the
   * default phone screen engraved a 1000px page inside a ~343px box and the reader dragged the
   * sheet sideways with one hand while it played. Full screen read well and was hidden behind a
   * button — the right answer was in the code and was not the default.
   *
   * ⚠ Measured off the REAL box, never off `window.innerWidth`: the card's padding and
   * `.kv-score`'s own both come off the top, and a guess there leaves the sheet wider than the
   * screen — a sideways drag in the very mode built to remove it.
   *
   * ⚠ A ResizeObserver is also why turning the phone sideways needs no orientation code of its own:
   * landscape is just a new box width, and the page is re-engraved at it.
   *
   * ⚠ **Quantised to 8px.** A re-engrave is a full VexFlow re-layout of a 500-note page, and on a
   * phone the box width twitches constantly — the URL bar sliding, the keyboard opening, a
   * scrollbar appearing. Rounding to the nearest 8px keeps the layout stable through the twitch
   * and still tracks a rotation, which moves it by hundreds.
   *
   * ⚠ `hasDoc` is in the deps and is load-bearing: `.kv-score` does not exist until a score is
   * installed, so without it the observer would never attach on a phone that arrives empty — which
   * is every first visit.
   *
   * ⚠ No feedback loop: `.kv-score` takes its width from the page, not from the SVG inside it, so
   * a wider drawing never widens the box that decided the drawing's width.
   */
  const hasDoc = !!doc;
  useEffect(() => {
    // ⚠ `phoneShaped`, NOT `isPhone`. A phone turned sideways is 844px wide and `isPhone` is false
    // there, so a fit gated on it switched off in landscape — measured at 844×390: the sheet hid
    // **242px** while portrait fitted exactly. Fitting is a question about the DEVICE, not about
    // how wide the window happens to be. Full screen keeps its own arm at any width and any device.
    if (!hasDoc || (!phoneShaped && !fullScreen)) {
      setFitContentW(null);
      return;
    }
    const el = document.querySelector(".kv-score");
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      const w = e.contentBoxSize?.[0]?.inlineSize ?? e.contentRect.width;
      // The floor keeps a pathological box (a phone mid-rotation reports 0) from engraving a
      // one-note-wide page that then has to be re-laid out a frame later.
      if (w > 0) {
        const fit = Math.max(240, Math.round(w) - SHEET_SIDE_MARGIN * 2);
        // ⚠ Only ever NARROWER than the default. A short-but-wide window (a 1280×600 desktop) is
        // `phoneShaped` by the short side and has nothing to fit — re-engraving it at 1050 instead
        // of 1000 would change a wide window's drawing for no gain. `null` = the default.
        setFitContentW(fit >= SHEET_CONTENT_WIDTH ? null : Math.round(fit / 8) * 8);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasDoc, phoneShaped, fullScreen]);

  /**
   * Mount the paper-width stage, wait for it to be drawn, then hand it to the exporter.
   *
   * ⚠ The wait is a POLL, not a timeout: the engraving is a VexFlow layout of a few hundred notes
   * and how long it takes is the reader's machine's business, not a number guessed here. It gives
   * up after two seconds so a failure is reported rather than hung.
   */
  async function runExport(kind: "png" | "pdf"): Promise<void> {
    setExporting(kind);
    try {
      const stage = await waitForStage();
      const name = heading?.name || "nota";
      // ⚠ The STAFF's shift, not the sound's: the saved paper shows `drawnDoc`, which only
      // `transpose` moves (owner, 2026-11-23).
      // The caption itself is read off the stage's header, which carries `heading` below.
      const fileTag = transpose !== 0 ? TR.card.transposedFile(transpose) : null;
      if (kind === "png") await exportScorePng(stage, name, fileTag);
      else await exportScorePdf(stage, name, fileTag);
    } finally {
      setExporting(null);
    }
  }
  const {
    armTool,
    onApplyTool,
    onDeleteNote,
    onInsertNote,
    onNudgePitch,
    onPlaceMark,
    onRedo,
    onRemoveMark,
    onRepeatEdge,
    onSelectNote,
    onTupletEdge,
    onTupletPick,
    onTupletRemove,
    onUndo,
  } = useEditing({
    armed,
    doc,
    editMode,
    history,
    onStop,
    repeatAnchor,
    selectedTuplet,
    setArmed,
    setLastEditMeasure,
    setRefused,
    setRepeatAnchor,
    setSelectedNote,
    setSelectedTuplet,
    setTupletAnchor,
    structure,
    transpose,
    tupletAnchor,
  });
  const {
    applyInstrument,
    applyPercussionVolume,
    applyPlayback,
    applyVoice,
    getPositionMs,
    onPlayFromEdit,
    onPlayMeasure,
    onPlayPause,
    onSeekMs,
    playStartMs,
    requestVoice,
  } = usePlayback({
    beatMs,
    bpm,
    doc,
    lastEditMeasure,
    metronome,
    naturalBpm,
    percussion,
    percussionKit,
    percussionVolume,
    perf,
    playState,
    setBpm,
    setInstrument,
    setMetronome,
    setPercussion,
    setPercussionKit,
    setPercussionVolume,
    setPlayState,
    setUsulName,
    setVoice,
    setVoiceAsk,
    setVoiceStatus,
    timeline,
    usulName,
    voice,
    voicesApproved,
    writeOut,
  });

  // Apply a transposition. The stored `doc` is NOT mutated — `transpose`/`soundTranspose` are applied
  // when deriving `displayDoc` (what's drawn) and the playback timeline. We recompute the
  // piano-roll range from the displayed notes and stop playback so the new pitch takes effect.
  function applyTranspose(sheet: number, sound: number) {
    if (!doc) return;
    onStop();
    setTranspose(sheet);
    setSoundTranspose(sound);
  }

  // Stop playback and reset to the top: silence the backend and show Play again.
  function onStop() {
    backend.stop();
    setPlayState("stopped");
  }

  /**
   * The instrument page's **Ölçüyü düzenle**: turn edit mode on, ON THE INSTRUMENT TAB.
   *
   * ⭐ **It does not leave the tab** (owner, 2026-09-04, revising the first version the same day:
   * *"nota tabına atmasın. Normal edit tool çantası çıksın yine … Edit tabi nota tabına da yansısın
   * ikisi ayrı olmasın"*). There is still exactly ONE editor — the card mounts `SheetView`, the
   * toolbox is the same `EditPalette`, and every edit goes through the callbacks below onto the
   * same document and the same undo stack. What changed is only WHERE the one editor is shown.
   *
   * ⚠ It sets `lastEditMeasure` from the bar itself, so the toolbox's Çal plays the bar you are
   * looking at before you have edited anything — on the page that pointer only ever came from an
   * actual edit, because the page had no "which bar am I on".
   */
  function onEditMeasure(m: Measure, on: boolean) {
    setEditMode(on);
    setSelectedTuplet(null);
    armTool(null);
    if (!on) {
      setSelectedNote(null);
      return;
    }
    // Written out long, the drawn bars are COPIES whose indices the stored score has never heard
    // of, so the pointer would name another bar. Edit mode turns `writeOut` off anyway; this is the
    // same honesty the sheet's own `markEdited` keeps — an index we cannot place leaves the pointer
    // where it was rather than guessing.
    setWriteOut(false);
    const first = m.events[0]?.index ?? null;
    const bar = first != null && doc ? measureOfEvent(doc, first) : null;
    if (bar != null) setLastEditMeasure(bar);
  }

  /**
   * Draw ONE bar for the instrument tab's measure card — **with `SheetView`, the page's own view**.
   *
   * ⭐ **This is what "ikisi ayrı olmasın" means in code** (owner, 2026-09-04). The card is not a
   * second engraver with a second overlay: it mounts the same component, with `onlyMeasure` set, and
   * hands it the same document and the same callbacks. So the note targets, the pitch drag, the
   * insert ghost, the tuplet handles, the sign targets, the off-meter badge and the undo stack are
   * not *equivalent to* the page's — they ARE the page's.
   *
   * ⚠ **Everything bar-indexed goes in untouched, and that is `onlyMeasure`'s whole point**: it
   * filters the drawn bars without renumbering them, so `repeatSpans`, `navMarks`, `signTargets`,
   * `openRepeat`, `repeatAnchor` and the insert's `measureIndex` still mean the same bar on both
   * sides. Handing in a one-bar document instead would have needed six mappings that must agree,
   * in the one place where being wrong means an edit lands on another bar.
   *
   * ⚠ **Every prop here must be the SAME REFERENCE the sheet gets**, not a fresh array: `SheetView`
   * re-engraves when `repeatSpans`, `navMarks`, `signature` or `onLayout` change identity, and an
   * engrave in the middle of a pointer drag would drop the note being dragged. That is why nothing
   * is filtered or rebuilt in this function.
   *
   * ⚠ `playing` is not the transport's — it is "the playhead belongs to the bar on screen". The card
   * decides that (it knows which bar is sounding) and passes it in as `showCursor`; a pinned bar two
   * systems away must not show a cursor frozen on its last note.
   */
  function renderBar(m: Measure, opts: { contentWidth: number; showCursor: boolean }) {
    if (!drawnDoc) return null;
    return (
      <SheetView
        doc={drawnDoc}
        onlyMeasure={m.index}
        contentWidth={opts.contentWidth}
        justify
        chrome={false}
        // ⚠ Its OWN id and marker. `#sheet-surface` and `data-omr="sheet-svg"` must keep meaning
        // the page's score — `render.ts` and `verify-labels.ts` take the first match, and two
        // elements answering to one id is what the DOM-state contract exists to keep out.
        surfaceId="measure-surface"
        svgMarker="measure-svg"
        editMode={editMode}
        accidentalMode={accidentalMode}
        signatureOverride={SIG_OVERRIDE}
        sigTolerant={SIG_TOLERANT}
        showLyrics={showLyrics}
        lyricHyphens={lyricHyphens}
        playing={opts.showCursor}
        getPositionMs={getPositionMs}
        // ⚠ ALWAYS the steps, folded or not: one drawn bar has no drawn order to read a clock
        // against, so the cursor can only be found by asking which WRITTEN note is sounding.
        playPlan={perf?.steps}
        onSeekToMeasure={(mm) => onSeekMs(playStartMs(mm))}
        selectedNote={selectedNote}
        onSelectNote={onSelectNote}
        onDeleteNote={onDeleteNote}
        onNudgePitch={onNudgePitch}
        armedTool={armed?.kind ?? null}
        armedRest={armed?.kind === "duration" && armed.rest === true}
        armedSign={armed?.kind === "structure" ? armed.mark : null}
        signTargets={signTargets}
        openRepeat={openRepeat}
        repeatAnchor={repeatAnchor}
        onPlaceMark={(bar) => {
          if (armed?.kind === "structure" && armed.mark !== "repeat") onPlaceMark(bar, armed.mark);
        }}
        onRepeatEdge={onRepeatEdge}
        onRepeatCancel={() => setRepeatAnchor(null)}
        onRemoveMark={onRemoveMark}
        onApplyTool={onApplyTool}
        onInsertNote={onInsertNote}
        tupletAnchor={tupletAnchor}
        onTupletPick={onTupletPick}
        selectedTuplet={selectedTuplet}
        onTupletEdge={onTupletEdge}
        onTupletRemove={onTupletRemove}
        repeatSpans={repeatSpans}
        navMarks={navMarks}
        thinSharps={URL_THIN_SHARPS}
        legacyTupletMark={URL_LEGACY_TUPLET}
        concaveTuplet={URL_CONCAVE_TUPLET}
      />
    );
  }
  const {
    onFile,
    onStrips,
    readPageFile,
  } = useReadPage({
    loadDoc,
    onStop,
    setError,
    setMakamPrompt,
    setOmrBusy,
    setOmrStatus,
    setRawDecode,
    setReadStartedAt,
    setSampleFile,
    setSaved,
  });

  return (
    <div
      id="app"
      className="kv-page"
      // `data-ready` is what the deploy checks wait for instead of matching the page's title text
      // — the title is copy and will change; "a score is installed" is the fact they need.
      data-ready={doc ? "1" : undefined}
      // ⚠ PHONE ONLY — the attribute the `(max-width: 700px)` block reads to decide which sections
      // are on screen. Absent on a wide window and before a score is installed, which is why the
      // desktop layout and the first-visit upload page are untouched by the tab rules.
      data-mtab={isPhone && doc ? mobileTab : undefined}
      // ⚠ NOT gated on `isPhone`, and that is the whole landscape story. A phone turned sideways is
      // 844px wide — past the 700px line — so a full screen that asked `isPhone` would switch
      // itself off mid-read, at exactly the moment the owner asked it to keep working. Full screen
      // is a MODE, not a width: its rules live outside the phone media query and hide every
      // section themselves rather than leaning on the tab rules, which do disappear up there.
      data-fullscreen={doc && fullScreen ? "1" : undefined}
      // ⚠ Phone only, and only on the Nota tab — `app.css` turns `#transport-settings` into a
      // bottom sheet there. Everywhere else the settings box is an ordinary part of the page.
      // ⚠ DERIVED, not just stored: the sheet belongs to the Nota tab while READING, and deriving
      // that here means it cannot be left open behind edit mode or another tab by a path that
      // forgot to close it. `onMobileTab` still clears the intent so it does not spring back.
      data-pitch={isPhone && doc && pitchOpen && mobileTab === "nota" && !editMode ? "open" : undefined}
      // ⚠ Which view the card is showing, so the stylesheet can treat the instrument page
      // differently from the score page — see the sticky head in the phone block.
      data-view={doc ? viewMode : undefined}
      // ⚠ A RENDER JOB (the URL carries `mode`, the same test as SIG_TOLERANT). contract.css then
      // hides every piece of chrome and pins the score's position on the page in fixed pixels, so
      // the strips render.ts cuts are independent of the app's design: a new font above the score
      // used to move the sheet by a fraction of a pixel and change every strip's antialiasing
      // (measured 2026-09-30: 147 of 302 strips). Owner decision the same day.
      data-render={SIG_TOLERANT ? "1" : undefined}
    >
      <Backdrop />
      <header className="kv-header relative">
        <div className="absolute top-2 right-0">
          <ThemeSwitch theme={theme} onTheme={setTheme} />
        </div>
        <h1 className="kv-brand">
          <BrandMark />
          {TR.brand}
        </h1>
        <p className="kv-tagline">{TR.tagline}</p>
        {/* The illuminator's ruled line under the title — the one ornament every screen carries. */}
        <GoldRule align="start" className="kv-header__rule mt-5" />
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

      {/* ⚠ Between the upload box and the score, and it draws NOTHING when the store is empty —
          so a first-time visitor sees exactly what they saw before this existed. It sits above the
          score rather than below it because it is a way IN: on arrival there is no score, and this
          is then the only thing on the page a returning reader wants. */}
      <RecentPages
        items={recent}
        currentId={saved?.id ?? null}
        // A read in flight owns the document; opening a stored page under it would race the decode
        // that is about to call `loadDoc`.
        busy={omrBusy}
        open={recentOpen}
        onToggle={() => setRecentOpen((v) => !v)}
        onOpen={openRecent}
        onRemove={removeRecent}
        onRename={renameRecent}
        onClear={clearRecent}
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
            percussionKit={percussionKit}
            onPercussionKit={(v) => applyPlayback(bpm, metronome, usulName, percussion, v)}
            voice={voice}
            onVoice={applyVoice}
            voiceStatus={voiceStatus}
            usulName={usulName}
            onUsul={(v) => applyPlayback(bpm, metronome, v, percussion)}
            makamSlug={makamSlug}
            onMakam={applyMakam}
            makamOptions={MAKAM_OPTIONS}
            makamUsage={makamUsage}
            transpose={transpose}
            transposeOptions={TRANSPOSE_OPTIONS}
            onTranspose={(v) => applyTranspose(v, v)}
            transposeLinked={transpose === soundTranspose}
            onTransposeAdvanced={() => setTransposeOpen(true)}
            accidentalMode={accidentalMode}
            onAccidentalMode={setAccidentalMode}
            // ⚠ The fold exists on the PHONE'S NOTA TAB and nowhere else. The Çal tab's whole
            // content is these settings, and a wide window has room for them — passing `undefined`
            // there is what keeps both rendering exactly as they did.
            pitchOpen={isPhone && !fullScreen && mobileTab === "nota" && !editMode ? pitchOpen : undefined}
            onPitch={
              isPhone && !fullScreen && mobileTab === "nota" && !editMode
                ? () => setPitchOpen((v) => !v)
                : undefined
            }
            // ⚠ The same condition as the card's `followInPinned` below — one of the two draws the
            // toggle, never both, never neither (in the sheet view).
            follow={
              isPhone && viewMode === "sheet"
                ? { on: followPlayhead, onChange: (v) => { setFollowPlayhead(v); writeFollow(v); } }
                : undefined
            }
            // ⭐ The phone's Nota tab docks the bar at the bottom (UI review item 1, 2026-11-25) —
            // the same condition as the fold, so ⚙ and the sheet exist exactly where the fold did.
            dock={isPhone && !fullScreen && mobileTab === "nota" && !editMode}
            // ⭐ On a phone the light / dark switch lives at the bottom of the ⚙ sheet (UI review
            // item 8, 2026-11-25) — it was also in the card's corner, crowding the title.
            sheetExtra={<ThemeSwitch theme={theme} onTheme={setTheme} withLabel />}
          />

          {isPhone && readNote && saved?.id === readNote.id && !editMode && !fullScreen && (
            <div className="kv-readnote" role="status" data-omr="read-note">
              <div>
                <strong>{TR.status.readNoteTitle(readNote.notes)}</strong> {TR.status.readNoteBody}
              </div>
              <button
                type="button"
                className="kv-readnote__close"
                aria-label={TR.status.readNoteClose}
                title={TR.status.readNoteClose}
                onClick={() => setReadNote(null)}
              >
                ✕
              </button>
            </div>
          )}

          <ScoreCard
            doc={doc}
            makamSlug={makamSlug}
            // The heading shows the name the reader gave this page, and offers to change it. Null
            // for anything that is not a stored page, which then reads the document as it always did.
            pageId={saved?.id ?? null}
            pageName={saved?.name ?? null}
            onRename={renameRecent}
            totalMs={timeline?.totalMs ?? null}
            viewMode={viewMode}
            // ⚠ NOT the bare setter: opening the instrument tab also switches the SOUND to the
            // instrument the page draws (owner, 2026-09-04). See `applyViewMode`.
            onViewMode={applyViewMode}
            followPlayhead={followPlayhead}
            // Remembered as it is set, not on unload: a reader who closes the tab straight after
            // clicking still gets the answer they chose next time.
            onFollowPlayhead={(v) => { setFollowPlayhead(v); writeFollow(v); }}
            followInPinned={isPhone}
            editMode={editMode}
            // ⚠ The ONLY way in and out of edit mode — see `applyEditMode`, which also carries the
            // phone's Düzenle tab. A second inline handler here would let the two drift apart.
            onEditMode={applyEditMode}
            // ⚠ Phone only, and only when full screen is OFF — the button is the way IN, and the
            // way OUT is `#fs-exit` on the floating bar. Undefined elsewhere, so the card renders
            // nothing new for any check at 1280×720.
            // ⚠ A phone turned SIDEWAYS counts (owner, 2026-10-01: the button vanished in
            // landscape): it is 844px wide, so `isPhone` is false there. `phoneShaped && coarse`
            // catches it — a short handset screen under a finger — without offering the button to
            // a laptop whose window happens to be under 700px tall.
            onFullScreen={(isPhone || (phoneShaped && coarse)) && !fullScreen ? () => applyFullScreen(true) : undefined}
            // The light / dark switch on the Nota tab too — on a phone the page header (where the
            // switch lives on a wide window) is only on the Sayfalar tab.
            cornerExtra={undefined}
            onExport={runExport}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          >
            {viewSwapping ? (
              // ⚠ Same box, so the swap does not jump: it is the SCORE AREA that is being replaced.
              <div className="kv-swap" role="status">
                {TR.card.swapping}
              </div>
            ) : viewMode === "instrument" ? (
              // ⚠ Both the document AND the timeline go in, and each view uses the one it needs:
              // the violin takes `timeline`, because a fingerboard cares only what a note SOUNDS and
              // that is the one place the makam bend and the transpose are already in `freqHz`; the
              // kanun takes the document, because a course is a WRITTEN note. `makamDeltas` rides
              // along for the kanun, which is the one bend a mandal can express. Neither view ever
              // calls `buildTimeline` itself. Full reasoning in the two files' headers.
              timeline && perf && drawnDoc && (
                <InstrumentView
                  doc={perf.doc}
                  // ⚠ The WRITTEN score, for the measure card only — the same document the sheet
                  // draws, so a bar inside a repeat is ONE bar there however often it sounds. The
                  // performance above is what the three instrument drawings read. Swapping the two
                  // would draw the right notes on the wrong side of every repeat.
                  sheetDoc={drawnDoc}
                  timeline={timeline}
                  playPlan={perf.steps}
                  makamDeltas={makamDeltas}
                  playing={playState !== "stopped"}
                  getPositionMs={getPositionMs}
                  instrument={instrument}
                  onInstrument={applyInstrument}
                  voiceStatus={voiceStatus}
                  canPlay={!!timeline}
                  editMode={editMode}
                  onPlayMeasure={onPlayMeasure}
                  onEditMeasure={onEditMeasure}
                  renderBar={renderBar}
                  tuning={tuning}
                  onTuning={setTuning}
                />
              )
            ) : (
              drawnDoc && (
              <SheetView
                heading={heading}
                doc={drawnDoc}
                // ⚠ The ONLY way the drawing is resized, and it is a re-engrave, not a zoom: fewer
                // bars per system at the same note size. `.kv-score` may never be scaled — that
                // SVG is the training-strip source (docs/APP-RULES.md). `undefined` = the default
                // 1000px content area, which is every case but full screen.
                contentWidth={fitContentW ?? undefined}
                editMode={editMode}
                accidentalMode={accidentalMode}
                signatureOverride={SIG_OVERRIDE}
                sigTolerant={SIG_TOLERANT}
                showLyrics={showLyrics}
                lyricHyphens={lyricHyphens}
                playing={playState !== "stopped"}
                getPositionMs={getPositionMs}
                playPlan={perf?.playPlan}
                followPlayhead={followPlayhead}
                onSeekToMeasure={(m) => onSeekMs(playStartMs(m))}
                selectedNote={selectedNote}
                onSelectNote={onSelectNote}
                onDeleteNote={onDeleteNote}
                onNudgePitch={onNudgePitch}
                armedTool={armed?.kind ?? null}
                signTargets={signTargets}
                openRepeat={openRepeat}
                armedSign={armed?.kind === "structure" ? armed.mark : null}
                repeatAnchor={repeatAnchor}
                // A repeat is drawn on the BARLINES and has its own two-click path; every other
                // sign belongs to a bar and lands wherever in it the click fell.
                onPlaceMark={(bar) => {
                  if (armed?.kind === "structure" && armed.mark !== "repeat") onPlaceMark(bar, armed.mark);
                }}
                onRepeatEdge={onRepeatEdge}
                onRepeatCancel={() => setRepeatAnchor(null)}
                onRemoveMark={onRemoveMark}
                armedRest={armed?.kind === "duration" && armed.rest === true}
                onApplyTool={onApplyTool}
                onInsertNote={onInsertNote}
                tupletAnchor={tupletAnchor}
                onTupletPick={onTupletPick}
                selectedTuplet={selectedTuplet}
                onTupletEdge={onTupletEdge}
                onTupletRemove={onTupletRemove}
                onLayout={onLayout}
                highlightRect={selectedStrip?.rect ?? null}
                repeatSpans={repeatSpans}
                navMarks={navMarks}
                textNoise={TEXT_NOISE}
                slurNoise={SLUR_NOISE}
                staccatoNoise={STACCATO_NOISE}
                usulBarNoise={USUL_BAR_NOISE}
                thinSharps={URL_THIN_SHARPS}
                printNoise={PRINT_NOISE}
                legacyTupletMark={URL_LEGACY_TUPLET}
                concaveTuplet={URL_CONCAVE_TUPLET}
              />
              )
            )}
          </ScoreCard>

          {/* ⚠ The edit toolbox is rendered HERE, outside the score card, not inside it (owner,
              2026-09-03). It is `position: fixed` and floats over the page, so where it sits in
              the DOM is only about what could ever clip it: `.kv-card` sets `overflow: hidden`,
              and a card that gained a transform or a filter would become the containing block for
              anything fixed inside it. Out here nothing can. The armed tool still lives in App's
              state, which is why the props are unchanged. */}
          {/* ⚠ **Both views, one toolbox** (owner, 2026-09-04). It used to be sheet-only; the
              instrument tab now edits its bar in place with the SAME palette over the SAME
              document, so gating it on the view would have meant a second one. Nothing about the
              palette knows which view is under it — it arms a tool, and whichever `SheetView` is
              mounted reads the armed tool from App. */}
          {editMode && (
            <EditPalette
              armed={armed}
              onArm={armTool}
              canPlay={!!timeline}
              playState={playState}
              fromMeasure={lastEditMeasure}
              anchored={tupletAnchor != null}
              repeatAnchor={repeatAnchor}
              refused={refused}
              onPlay={onPlayFromEdit}
              onStop={onStop}
              // ⚠ The SAME handlers the card's pair uses, so both roads share one stack — App's
              // `onUndo` also stops playback and clears the selection, which an undo must do
              // wherever it is pressed (a held index can name a different note after a delete).
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
            />
          )}
        </>
      )}

      {/* ⚠ **THE EXPORT STAGE.** The same document, engraved at the default width — see `exporting`.
          It is mounted only while a save is running and is never visible; `app.css` parks it off
          screen rather than hiding it, because a `display: none` element has no layout and VexFlow
          would measure every box as zero. */}
      {exporting && drawnDoc && (
        <div id={EXPORT_STAGE_ID} aria-hidden="true">
          <SheetView
            heading={heading}
            doc={drawnDoc}
            accidentalMode={accidentalMode}
            signatureOverride={SIG_OVERRIDE}
            sigTolerant={SIG_TOLERANT}
            showLyrics={showLyrics}
            lyricHyphens={lyricHyphens}
            repeatSpans={repeatSpans}
            navMarks={navMarks}
            svgMarker="export-svg"
            // ⚠ Inert: the stage is a drawing, never a surface anyone touches. No edit overlay, no
            // clock, and no seek — it exists for the length of one save.
            editMode={false}
            playing={false}
            getPositionMs={getPositionMs}
            onSeekToMeasure={() => {}}
          />
        </div>
      )}

      {/* ⚠ Fixed, and rendered here for the same reason the toolbox above is: out of every
          `.kv-card`, which sets `overflow: hidden` and would clip it the moment the card gained a
          transform. Outside the `{doc && …}` block too — a switch started on one score must keep
          reporting itself if the reader loads another mid-download. Its own state decides whether
          it draws anything at all. */}
      <VoiceSwitchNotice status={voiceStatus} />
      <IosInstallHint />

      {SHOW_DEV_PANEL && (
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
        canWriteOut={structure != null}
        writeOut={writeOut}
        // Writing the score out long makes every repeated bar a COPY, and an edit aimed at a copy
        // would land on the wrong note — so the view and edit mode are mutually exclusive.
        onWriteOut={(v) => {
          setWriteOut(v);
          if (v) {
            setEditMode(false);
            setSelectedNote(null);
            armTool(null);
          }
        }}
        sheetView={viewMode === "sheet"}
        strips={strips}
        selectedStripId={selectedStripId}
        onSelectStrip={setSelectedStripId}
      />
      )}

      {/* ⚠ PHONE ONLY, and fixed to the bottom of the viewport — so like the edit toolbox above it
          is rendered OUT of every `.kv-card`, which sets `overflow: hidden` and would clip it. It
          draws only once a score is installed: with nothing loaded the page is the upload prompt
          plus the stored-page list, which is one screen and needs no sections. */}
      {doc && fullScreen && (
        <FullScreenBar
          playState={playState}
          canPlay={!!timeline}
          onPlayPause={onPlayPause}
          onStop={onStop}
          onExit={() => applyFullScreen(false)}
        />
      )}
      {isPhone && doc && !fullScreen && <MobileTabs tab={mobileTab} onTab={onMobileTab} />}


      {transposeOpen && (
        <TransposeModal
          sheet={transpose}
          sound={soundTranspose}
          options={TRANSPOSE_OPTIONS}
          onChange={applyTranspose}
          onClose={() => setTransposeOpen(false)}
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

      {voiceAsk && (
        <VoiceDownloadModal
          voice={voiceAsk.voice}
          label={findVoice(voiceAsk.voice)?.label ?? voiceAsk.voice}
          onConfirm={() => {
            voicesApproved.current.add(voiceAsk.voice);
            voicesDeclinedOnOpen.current.delete(voiceAsk.voice);
            setVoiceAsk(null);
            voiceAsk.go();
          }}
          onCancel={() => {
            setVoiceAsk(null);
            voiceAsk.no?.();
          }}
        />
      )}

      {/* Always rendered, score or no score — the upload promise and the takedown route are what a
          first-time visitor needs most, and that is exactly the empty state. */}
      <footer className="kv-footer" id="legal">
        <GoldRule className="kv-footer__rule mb-5" />
        <p>{TR.footer.privacy}</p>
        <p>{TR.footer.counting}</p>
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

