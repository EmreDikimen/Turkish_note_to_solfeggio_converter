/**
 * The engraved, editable score — the one React component that draws the page and handles every
 * click, drag and key on it. Its helpers live beside it: vexNotes.ts (events → VexFlow notes),
 * drawMarks.ts (hand-drawn marks), hitTest.ts (click geometry), layout.ts (page geometry).
 */
import { type AccidentalMode, USUL_BEAM_GROUPS } from "./vexNotes";
import {
  BAR_WARN_W,
  DRAG_PX_PER_STEP,
  GHOST_H,
  GHOST_W,
  MARK_HIT_PAD,
  type MeasureBox,
  NAV_HIT_H,
  NAV_HIT_W,
  NOTE_HIT_PAD,
  type NoteBox,
  type NotePos,
  type PlayStep,
  SIGN_HIT_PAD,
  SIGN_HIT_W,
  TUPLET_HANDLE_W,
  type TupletMarkBox,
  markBoxOf,
  pitchAtHeight,
} from "./hitTest";
import { Tuplet } from "vexflow";
import {
  CONTENT_WIDTH,
  DEFAULT_SVG_WIDTH,
  LEFT,
  NARROW_HEADER_W,
  ROW_HEIGHT,
  STAFF_LINE_WIDTH,
  STAVE_TOP_PAD,
  STEP_BTN,
  STEP_BTN_TOUCH,
  STEP_GAP,
  followCursorIntoView,
} from "./layout";
import { Legend } from "./Legend";
import {
  STAFF_SPACE,
  VOLTA_ABOVE,
  drawSlurArc,
  drawStaccatoDot,
  drawThinSharps,
  drawTupletArcConcave,
  drawTupletArcLegacy,
  drawUsulBars,
} from "./drawMarks";
import type { MarkTarget, SignTool, StructureMark } from "@turkish-omr/core/labels/structure-edit";
import {
  type Measure,
  type NoteModelDocument,
  deriveKeySignature,
  deriveTimeSignature,
  estimateBpm,
  groupMeasures,
  measureBeats,
  parseNoteName,
  scoreHeader,
  toAeuAlter,
} from "@turkish-omr/core";
import { type NavMark } from "@turkish-omr/core/labels/navmarks";
import { type RepeatSpan } from "@turkish-omr/core/labels/repeats";
import { TR } from "../ui/strings";
import {
  closedTupletAt,
  drawnTupletAt,
  memberPositions,
  tupletEdgeTo,
  tupletRunFrom,
} from "@turkish-omr/core/labels/rhythm";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useViewport } from "../browser/usePhone";
import { engraveScore } from "./engrave";


/**
 * Sheet-music (notation) view, engraved with VexFlow: real stems, flags, beams, dots and
 * duration-correct noteheads/rests. Turkish (AEU) microtonal accidentals are rendered from
 * the Bravura font via the project's verified SMuFL glyph map. In edit mode, an HTML overlay
 * makes each measure clickable to open the per-measure editor.
 */
export function SheetView({
  doc,
  editMode,
  accidentalMode,
  sigTolerant,
  showLyrics,
  lyricHyphens,
  playing,
  getPositionMs,
  playPlan,
  followPlayhead = false,
  onSeekToMeasure,
  selectedNote,
  onSelectNote,
  onDeleteNote,
  onNudgePitch,
  armedTool,
  armedRest = false,
  armedSign = null,
  signTargets,
  openRepeat = null,
  repeatAnchor = null,
  onPlaceMark,
  onRepeatEdge,
  onRepeatCancel,
  onRemoveMark,
  onApplyTool,
  onInsertNote,
  tupletAnchor = null,
  onTupletPick,
  selectedTuplet = null,
  onTupletEdge,
  onTupletRemove,
  onLayout,
  highlightRect,
  repeatSpans,
  navMarks,
  textNoise,
  slurNoise,
  staccatoNoise,
  usulBarNoise,
  thinSharps,
  printNoise,
  legacyTupletMark,
  concaveTuplet,
  signatureOverride,
  contentWidth,
  justify = false,
  chrome = true,
  heading,
  surfaceId = "sheet-surface",
  svgMarker = "sheet-svg",
  onlyMeasure,
}: {
  doc: NoteModelDocument;
  editMode: boolean;
  /** How accidentals are displayed (see {@link AccidentalMode}). The key signature is drawn at
   *  each row start in `"keysig"` and `"measure"` modes. */
  accidentalMode: AccidentalMode;
  /** `"measure"` mode only: write a same-direction intonation refinement BARE under the signature
   *  (a 5-comma F♯ under a koma-sharp-F donanım), the real printed-page convention — or print its
   *  own sign whenever the alteration differs at all, so the staff matches the sound. Required, not
   *  optional: the renderer and the app want opposite answers, and a caller that forgets would
   *  silently change what the corpus draws. The strip labels must be built with the SAME value
   *  (`buildStrips`' `sigTolerant`) or pixels stop equalling labels. See `SIG_TOLERANT` in lib/urlParams.ts. */
  sigTolerant: boolean;
  /**
   * ⭐ **THE SIX PROPS BELOW EXIST SO THIS COMPONENT CAN BE THE MEASURE CARD TOO** (owner,
   * 2026-09-04: the instrument tab's bar is edited in place, with the same toolbox, and the edit
   * has to be the same edit). ⚠ **Every default reproduces the page's score exactly**, so the
   * render harness, the strip exporter and every existing check are untouched — a caller that
   * passes none of them gets byte-identical output.
   *
   * ⚠ **The alternative was rebuilding the overlay** — the note targets, the pitch drag, the insert
   * ghost, the tuplet handles and the sign targets — beside a second engraver. That is ~700 lines
   * of duplicated rules over one document, and the first thing to drift would be which click means
   * what. Mounting this view twice is what makes "ikisi ayrı olmasın" literally true.
   */
  /** Staff content width in SVG units — the box rows wrap inside. Default {@link CONTENT_WIDTH}.
   *  ⚠ The SVG is sized from it, so the card resizes the ENGRAVING to its column rather than
   *  scaling the finished drawing: everything in the overlay stays 1:1 with the notes, which is
   *  what lets one hit-testing implementation serve both mountings. */
  contentWidth?: number;
  /** Justify the LAST row to the full width too. Off for the page (a short final system is normal
   *  engraving, and stretching a near-empty one blows its spacing apart); on for the card, where
   *  the one row IS the last row and a bar drawn at its natural width would leave the card ragged. */
  justify?: boolean;
  /**
   * Draw the PAGE FURNITURE around the staff: the engraved title block above (makam / form / usul /
   * composer / tempo) and the accidental legend below.
   *
   * Off for the measure card. Both are about the whole score — the card's own head already names
   * the bar, and a legend of every sign the PIECE uses under a single measure doubles the card's
   * height to explain signs that bar may not even contain. The page keeps both.
   */
  chrome?: boolean;
  /**
   * What the header's title says, when the page knows better than the document (owner,
   * 2026-11-23): the name the reader gave the page on top, then how far the staff is transposed.
   * ⚠ This header is ALSO the caption of a saved PNG/PDF — `exportScore.ts` reads it back — so the
   * screen and the saved file say the same thing. Without it the header is the document's own
   * (`render.ts` passes none), and on a read page that title is only the upload's file name.
   */
  heading?: { name: string; transposed: string | null };
  /** `id` of the positioned surface, and the `data-omr` marker on the SVG. ⚠ Both are overridden by
   *  the card rather than shared: two elements answering to one id is exactly what the DOM-state
   *  contract in CLAUDE.md exists to keep out, and `sheet-svg` must keep meaning THE PAGE'S SCORE —
   *  `render.ts` and `verify-labels.ts` take the first match. */
  surfaceId?: string;
  svgMarker?: string;
  /**
   * Draw ONLY this bar (1-based `Measure.index`); everything else is dropped before the rows are
   * packed. Undefined → the whole score, as always.
   *
   * ⚠ **It filters, it does NOT re-number**, and that is the entire reason this prop exists instead
   * of the caller handing in a one-bar document. Bar numbers are the currency between this view and
   * App: the repeat spans, the nav marks, the sign targets, the pending `‖:`, the repeat anchor and
   * the insert tool's `measureIndex` are all bar-indexed. Slice the document and every one of them
   * needs shifting on the way in and unshifting on the way out — six mappings that must agree, in
   * a place where being wrong means an edit lands on another bar. Filtering here keeps bar 7 called
   * seven on both sides, and the card passes App's own memoized props through untouched.
   *
   * ⚠ Consequence worth knowing: the drawn bar is `firstInRow` of row 0, so it carries the clef,
   * the key signature AND the meter — which the page draws once at the top. That is right for a
   * card: a bar shown out of context has no earlier bar on screen to have carried the usul.
   */
  onlyMeasure?: number;
  /** CONVENTIONAL printed-signature override (drawn-order entries). When set, replaces the
   *  content-derived `deriveKeySignature` for BOTH the drawn glyphs and the mode's accidental
   *  decisions, so the makam's real PRINTED signature is engraved. Must be the SAME entries the
   *  strip exporter gets (faithful scheme: pixels == labels). Undefined → derive from the doc. */
  signatureOverride?: { letter: string; alterCommas: number }[];
  /** Draw lyric syllables under the notes (skipping the "." melisma placeholders). */
  showLyrics: boolean;
  /** Draw a hyphen between a word's syllables (e.g. "Gam-ze-de"). Most sheets omit these. */
  lyricHyphens: boolean;
  /** True while there's an active (playing or paused) position — drives the playhead. */
  playing: boolean;
  /** Current playback position in ms (from the audio backend), or null when stopped. */
  getPositionMs: () => number | null;
  /** The performance, when it differs from what is written: one step per sounding event, naming
   *  the drawn note it belongs to (see {@link PlayStep}). Undefined for a score that plays exactly
   *  as it is written — then the playhead walks the drawn notes, as it always did. */
  playPlan?: readonly PlayStep[];
  /** Scroll the page to the playhead when the playhead leaves the screen (owner, 2026-09-03).
   *
   *  The reader's setting, and it defaults to OFF here on purpose: the app turns it on (see
   *  `followPlayhead` in App.tsx), while the render harness — which mounts this view to cut
   *  training strips — must never move the score under the screenshot. Nothing happens while
   *  `playing` is false either way. */
  followPlayhead?: boolean;
  /** Non-edit mode: seek/play from the clicked measure. */
  onSeekToMeasure: (m: Measure) => void;
  /** Edit mode: which event (`NoteEvent.index`) is selected, or null. */
  selectedNote?: number | null;
  /** Edit mode: a note was clicked (null when a click landed on nothing selectable). */
  onSelectNote?: (index: number | null) => void;
  /** Edit mode: the selected note's ✕ was pressed. */
  onDeleteNote?: (index: number) => void;
  /** Edit mode: the note was dragged up or down — ±1 diatonic step per half staff space,
   *  accidental carried. Signed steps, not a delta in pixels. */
  onNudgePitch?: (index: number, steps: number) => void;
  /** Edit mode: which KIND of palette tool is armed, or null for plain selection.
   *
   *  A click on a NOTE routes to `onApplyTool`, except for the tuplet, which has its own two-click
   *  gesture (`onTupletPick`). The kind also decides what EMPTY space does: a note value inserts
   *  there (step 6), while an accidental or the tuplet has nothing to attach to and does nothing —
   *  opening the measure modal on an armed click would be a surprise. */
  armedTool?: "duration" | "accidental" | "tuplet" | "structure" | "dot" | null;
  /** True when the armed note value is a REST tool. Only the preview cares: a rest has no pitch, so
   *  the ghost parks mid-staff and stops naming one. The insert/apply paths are the same. */
  armedRest?: boolean;
  /** Edit mode: a note was clicked while a tool was armed. Fires once per click, even for a
   *  tie-split event (two boxes, one `evIndex`). */
  /**
   * Edit mode: the structure signs a click can DELETE, with the bar and edge each one is drawn on.
   * Undefined outside edit mode and while the score is written out long.
   *
   * ⚠ Positions come from the caller, not from `repeatSpans`, and the two are not the same list —
   * see `App`'s `signTargets`. This component only paints a target where it is told to.
   */
  signTargets?: MarkTarget[];
  /**
   * Edit mode: a bar carrying a `‖:` that nothing closes yet, or null.
   *
   * ⚠ This sign is NOT on the engraved staff and must not be — `repeatSpansFromStructure` refuses
   * to draw a repeat the music does not take. It is drawn here, in the overlay, marked incomplete:
   * a score is marked up left to right, so a `‖:` is unfinished for as long as it takes to place
   * its `:‖`, and a tool whose click leaves no trace reads as broken. Same idiom as a broken
   * tuplet mark.
   */
  openRepeat?: number | null;
  /** Which SIGN is armed, when `armedTool` is `"structure"`. The repeat is the one that is not
   *  placed on a bar, so the sheet has to tell them apart. */
  armedSign?: SignTool | null;
  /** The repeat gesture's first click: the bar whose opening barline carries the pending `‖:`,
   *  or null. ⚠ Nothing is in the document yet — this is a preview, not a placed sign. */
  repeatAnchor?: number | null;
  /** A structure tool is armed and a bar was clicked: put the sign on that bar. */
  onPlaceMark?: (bar: number) => void;
  /** A barline was clicked while the repeat tool is armed. `edge` says which line of the bar:
   *  `"start"` opens the repeat (first click), `"end"` closes it (second). */
  onRepeatEdge?: (bar: number, edge: "start" | "end") => void;
  /** The pending `‖:` was clicked again — take the gesture back. */
  onRepeatCancel?: () => void;
  /** A drawn sign was clicked in Seçim: take it off. */
  onRemoveMark?: (bar: number, mark: StructureMark) => void;
  onApplyTool?: (index: number, pitchAt?: { letter: string; octave: number; alter: number }) => void;
  /** Edit mode, a note value armed: empty staff was clicked, so insert a note there. Everything
   *  is already resolved from the geometry — which bar, which event to go in front of (null =
   *  the end of that bar), and the staff position the click's HEIGHT names. The spelling is in
   *  DISPLAY space: the sheet draws `displayDoc`, so a transposed score needs it mapped back. */
  onInsertNote?: (at: {
    measureIndex: number;
    beforeEventIndex: number | null;
    letter: string;
    octave: number;
    alter: number;
  }) => void;
  /** Edit mode, the tuplet armed: the first note of the run, or null when none is picked yet.
   *  Drives which targets stay clickable — see `tupletStates`. */
  tupletAnchor?: number | null;
  /** Edit mode, the tuplet armed: a clickable note was clicked. The sheet only refuses what it has
   *  dimmed; deciding what the click MEANS (anchor, apply, select, cancel) is App's. */
  onTupletPick?: (index: number) => void;
  /** Edit mode, the tuplet armed: a whole triplet is HELD, named by its first member's
   *  `NoteEvent.index`. The group itself is re-derived here with `closedTupletAt` — nothing about a
   *  tuplet is ever stored — and drives the frame, the two handles and the ✕. */
  selectedTuplet?: number | null;
  /** Edit mode: a handle of the held triplet was dragged onto a note. The sheet resolves the
   *  geometry (which note is under the pointer) and hands over an intent; whether the move is legal
   *  is `tupletEdgeTo`'s answer, which both sides read. */
  onTupletEdge?: (edge: "start" | "end", targetIndex: number) => void;
  /** Edit mode: the held triplet's ✕ was pressed — take the bracket off, keep the notes. */
  onTupletRemove?: () => void;
  /** Fired after each engrave with every measure's on-screen rectangle (1-based `index`, `x`, `y`,
   *  `width`) and the SVG size. Used by the Step-2c strip exporter to compute crop rectangles. */
  onLayout?: (layout: { boxes: { index: number; x: number; y: number; width: number }[]; svgWidth: number; svgHeight: number; rowHeight: number }) => void;
  /** Step-2c: draw a translucent rectangle over a strip's crop region (SVG coordinate space). */
  highlightRect?: { x: number; y: number; width: number; height: number } | null;
  /** Phase-2 preview: repeat barlines + volta brackets to draw (SymbTr has none, so these are
   *  synthesized — see repeats.ts). Empty/undefined → the default engraving, untouched. */
  repeatSpans?: RepeatSpan[];
  /** Rung-2: navigation marks (segno/coda/D.C./Son) to draw — injected, SymbTr has none
   *  (see navmarks.ts). Empty/undefined → none drawn. */
  navMarks?: NavMark[];
  /** Rung-2 distractor text drawn INSIDE the SVG (so strip crops capture it) — see textNoise.ts.
   *  Pixels only; labels never see it. Undefined → no noise (interactive use). */
  textNoise?: { seed: number } | null;
  /** Round-1 phrase-slur distractors: label-free arcs over non-triplet note runs (see drawSlurArc)
   *  so the model stops reading every arc as a `\tup3`. Pixels only. Undefined → none. */
  slurNoise?: { seed: number } | null;
  /** Round-3 staccato distractors: label-free dots on the notehead side (see drawStaccatoDot), so
   *  the model learns that a dot means "longer" only BESIDE the notehead, not above or below it.
   *  Pixels only. Undefined → none, which is every strip rendered before 2026-08-15. */
  staccatoNoise?: { seed: number } | null;
  /** Round-3: label-free DOTTED (usul) BARLINES inside the bar, on the usul's beat-group
   *  boundaries (see drawUsulBars). The symbol has never been drawn, so the model reads a real one
   *  as `\repstart`. Pixels only. Undefined → none, i.e. every strip rendered before 2026-08-30. */
  usulBarNoise?: { seed: number } | null;
  /** Round-2: redraw the AEU sharps with real-print bar weight so the three bars of a küçük/büyük
   *  mücennep stay separated after downscaling (see drawThinSharps). Pixels only. → Bravura. */
  thinSharps?: boolean;
  /** Round-3 print realism: seeded staff-line weight + usul beam grouping, so the corpus varies
   *  the way real editions do (see STAFF_LINE_WIDTH / USUL_BEAM_GROUPS). Pixels only — the labels
   *  come from the note model and are identical with and without it. Undefined → VexFlow's
   *  defaults, i.e. every strip rendered before Round 3. */
  printNoise?: { seed: number } | null;
  /** The tuplet A/B's CONTROL arm: draw the pre-2026-08-12 continuous arc with the digit floating
   *  above it (see drawTupletArcLegacy). Pixels only — the `\tup3` token is identical either way.
   *  Corpus rendering only; the app never sets it. docs/archive/rounds.md */
  legacyTupletMark?: boolean;
  /** OPT-IN (2026-08-19): let a share of pieces draw the CONCAVE mark — a continuous arc with the
   *  "3" hanging inside it (see drawTupletArcConcave). Pixels only; the `\tup3` token is identical.
   *  ⚠ OFF by default and it must stay that way: it changes a share of every rendered piece, so a
   *  corpus rendered with it on is not comparable to one rendered with it off. That is precisely how
   *  `--print-noise` once shipped USUL_BEAM_GROUPS into ~40k strips by riding along unconditionally.
   *  docs/archive/rounds.md */
  concaveTuplet?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  // The row the follow has already answered for (its top in sheet coordinates), so the question is
  // asked once per row. A ref, like everything else the playhead frame touches: it must not
  // re-render anything. Null = nothing followed yet, which is why the FIRST row of a playback is a
  // change and gets its scroll — that is what takes you to the bar Çal was aimed at.
  const followRowRef = useRef<number | null>(null);
  // An in-progress pitch drag: which event, where the pointer went down, and how many steps have
  // already been applied. A ref, not state — every applied step re-engraves the score, and the
  // drag has to survive those re-renders unchanged.
  const dragRef = useRef<{ index: number; startY: number; applied: number } | null>(null);
  // An in-progress TUPLET-HANDLE drag: which end of the held triplet is following the pointer.
  // A ref for the same reason `dragRef` is one — every step of the drag rewrites two durations and
  // re-engraves the score, and the gesture has to survive those re-renders.
  const tupletDragRef = useRef<{ edge: "start" | "end" } | null>(null);
  // On-screen position of every timed event, in playback order. A ref (not state) because the
  // playhead animation reads it every frame and must not trigger re-renders.
  const positionsRef = useRef<NotePos[]>([]);
  // The same positions keyed by `NoteEvent.index` — see the write in the draw effect.
  const posByEvRef = useRef<Map<number, NotePos>>(new Map());
  const [boxes, setBoxes] = useState<MeasureBox[]>([]);
  // Per-note click targets for edit mode. State (not a ref like `positionsRef`) because the
  // overlay renders from them; they change only on a re-engrave, so this costs nothing.
  const [noteBoxes, setNoteBoxes] = useState<NoteBox[]>([]);
  // The drawn triplet marks that the editor may HOLD, with the box of their real ink. State, like
  // `noteBoxes`, because the overlay renders from them and they change only on a re-engrave.
  const [tupletMarks, setTupletMarks] = useState<TupletMarkBox[]>([]);
  const [svgHeight, setSvgHeight] = useState(ROW_HEIGHT + 20);
  /** The scale the drawing ended up at, 1 when it was not shrunk.
   *
   *  ⚠ `#sheet-surface` is the overlay's coordinate box and it is sized in the SAME units the SVG
   *  is DISPLAYED in, not the ones it was laid out in. Left at the logical size it made the box
   *  22px wider than the SVG inside it — a sideways scrollbar on a page that visibly fits — and
   *  as much slack again under the last system. */
  const [fitScale, setFitScale] = useState(1);
  const [hover, setHover] = useState<number | null>(null);
  // The insert preview: a ghost notehead at the staff position an empty click would use. Moved by
  // mutating the element directly (like the playhead above), never through state — a preview that
  // re-rendered the overlay on every mouse-move is exactly the cost that got the measure hover
  // highlight removed in slice 1.
  const ghostRef = useRef<HTMLDivElement>(null);

  /** Is any tool armed? The note-hit path only cares about this; the empty-space path needs the
   *  kind, because only a note value can be inserted into blank staff. */
  const armed = armedTool != null;

  /**
   * Can a drawn tuplet mark be picked up right now? With the TUPLET armed, and also with **nothing**
   * armed — plain Seçim (owner, 2026-08-30: *"tupletleri seçmek için toolkitten ille de tupleti
   * seçmem gerekmesin. Seçim seçiliyken de tupletleri seçip silebileyim"*).
   *
   * ⚠ Not with a note value or an accidental armed: those apply to a NOTE, and a mark is not one.
   * A click on a mark while they are armed falls through, exactly as a click on blank staff does.
   *
   * In Seçim the two selections are mutually exclusive — App clears the note when a mark is picked
   * and the mark when a note is — so the page never shows two things selected at once.
   */
  const tupletPickable = editMode && (armedTool == null || armedTool === "tuplet");

  // Distinct accidentals used, for the legend.
  const usedAccidentals = useMemo(() => {
    const set = new Set<number>();
    for (const ev of doc.events) {
      if (ev.kind !== "note") continue;
      const p = parseNoteName(ev.noteName);
      if (!p) continue;
      const a = toAeuAlter(p.alterCommas); // legend lists the AEU signs actually drawn
      if (a !== 0) set.add(a);
    }
    return [...set].sort((a, b) => a - b);
  }, [doc]);

  // The key signature (prevailing accidental per letter), and a lookup map. A caller-supplied
  // override (the makam's conventional PRINTED signature) wins over the doc-derived one — the render
  // pipeline passes it so synthetic pages wear the real printed signature (see stripExport.ts).
  const signature = useMemo(() => signatureOverride ?? deriveKeySignature(doc), [doc, signatureOverride]);
  const signatureMap = useMemo(() => new Map(signature.map((s) => [s.letter, s.alterCommas])), [signature]);

  // The usul meter (e.g. 9/8 for aksak), printed once at the start of the first staff.
  const timeSig = useMemo(() => deriveTimeSignature(doc), [doc]);

  // The drawing's own size. Defaults ARE the page's constants, so nothing that does not ask for a
  // width can notice these exist. Both are engrave dependencies — changing the column width
  // re-engraves, which is the point: the card fits the music to its box instead of scaling it.
  // ── Fitting a dense page into a narrow box: WIDEN THE LAYOUT, THEN SHRINK THE DRAWING ────────
  //
  // ⚠ **SCALING ALONE DOES NOT WORK, AND THAT WAS THE FIRST ATTEMPT** (2026-09-26). A row's width
  // is packed from an ESTIMATE — `events.length * 28 + 24` — that knows nothing about accidentals,
  // dots, beams or tuplet marks, and VexFlow draws a measure at its own minimum spacing whatever
  // stave width it is handed. So the notes overrun THEIR OWN STAVE, and shrinking the finished
  // picture shrinks the overrun with everything else: measured on `meltem_notes` at 393px, the
  // stave ended 49px short of the box and its notes still hung 22px past the barline.
  //
  // ⭐ So the layout is widened first — `fitExtra` is how much more room the drawing asked for than
  // it was given — and only then is the whole thing scaled down to the box. Wider staves mean the
  // notes are INSIDE them; the scale then makes the stave span the box exactly.
  //
  // ⚠ It settles in one extra pass: draw, measure what was really drawn, widen by the difference,
  // draw again. The key resets the measurement whenever the document or the box changes, so a
  // stale widening cannot survive into a different page — and the widening is capped at the box's
  // own width, which is the loop's bound.
  const boxContentW = contentWidth ?? CONTENT_WIDTH;
  const fitKey = `${contentWidth ?? "d"}|${doc.name ?? ""}|${doc.events.length}|${onlyMeasure ?? -1}`;
  const [fit, setFit] = useState<{ key: string; extra: number }>({ key: fitKey, extra: 0 });
  const fitExtra = fit.key === fitKey ? fit.extra : 0;
  const contentW = boxContentW + (contentWidth != null ? fitExtra : 0);
  /** The width the drawing has to END UP at — the box, not the widened layout. */
  const fitBoxW = contentWidth != null ? LEFT * 2 + contentWidth : null;
  // ⚠ Below this the engraved header stacks instead of running three columns across — see the
  // header's own comment. 520 is where "Sofyan ♩ = 80" and "Beste: <a real Turkish name>" stop
  // fitting either side of a centred title; every phone and every landscape phone is under it, and
  // no default (1000) or measure card is anywhere near it.
  const narrowHeader = boxContentW < NARROW_HEADER_W;
  const svgW = contentWidth == null ? DEFAULT_SVG_WIDTH : LEFT * 2 + contentW;

  /**
   * Edit mode, the tuplet armed: what a click on each note would do (editor step 7).
   *
   *  - `start`  — a legal run begins here (nothing anchored yet);
   *  - `member` — inside an existing closed triplet. ⚠ Since 2026-08-30 this is INFORMATION, not a
   *    target: a member is not clickable, because the group is picked up by clicking its drawn "3"
   *    (owner). The state is still published, so a check can still see where the triplets are;
   *  - `anchor` — the run's first note, already picked; clicking it again backs out;
   *  - `end`    — the one note that closes the run from the anchor;
   *  - `blocked` — everything else. Rendered dim and with `pointer-events: none`, which is what
   *    makes an invalid target literally unclickable rather than merely unresponsive (the brief:
   *    dim them, do not pop an error).
   *
   * Once a run is open only its own two ends stay live — an existing triplet elsewhere on the page
   * would otherwise silently abandon the anchor when clicked.
   *
   * All of it comes from `packages/core/src/labels/rhythm.ts`, the module that draws the bracket, so the sheet
   * cannot offer a triplet the engraver would refuse to draw. Empty when the tool is not armed, so
   * nothing here costs anything in the other modes.
   */
  const tupletStates = useMemo(() => {
    const out = new Map<number, "start" | "member" | "anchor" | "end" | "blocked">();
    if (armedTool !== "tuplet") return out;
    for (const m of groupMeasures(doc)) {
      const anchorPos = tupletAnchor == null ? -1 : m.events.findIndex((e) => e.index === tupletAnchor);
      const endPos = anchorPos < 0 ? null : tupletRunFrom(m.events, anchorPos)?.[2] ?? null;
      m.events.forEach((ev, pos) => {
        const state =
          tupletAnchor != null
            ? ev.index === tupletAnchor ? "anchor" : pos === endPos ? "end" : "blocked"
            : drawnTupletAt(m.events, pos) ? "member"
              : tupletRunFrom(m.events, pos) ? "start"
                : "blocked";
        out.set(ev.index, state);
      });
    }
    return out;
  }, [doc, armedTool, tupletAnchor]);

  /**
   * Edit mode, the tuplet armed and a whole triplet HELD: its three members and where each handle
   * may legally land (editor step 7b).
   *
   * Nothing about a tuplet is stored, here least of all: `selectedTuplet` is one event index and the
   * group is re-derived from the document every time with `closedTupletAt` — the same function that
   * decides whether a bracket gets drawn at all. So a triplet that stops being one (an undo, a
   * re-valued member) simply loses its handles, and no stale geometry can outlive it.
   *
   * The landing sets come from `tupletEdgeTo`, which is also what App calls to make the move — the
   * sheet cannot offer a handle position the edit would then refuse. Null whenever nothing is held,
   * so this costs nothing in every other mode.
   */
  const tupletSel = useMemo(() => {
    if (!tupletPickable || selectedTuplet == null) return null;
    for (const m of groupMeasures(doc)) {
      const pos = m.events.findIndex((e) => e.index === selectedTuplet);
      if (pos < 0) continue;
      const g = drawnTupletAt(m.events, pos);
      if (!g) return null;
      const members = memberPositions(m.events, g).map((p) => m.events[p]!.index);
      if (members.length === 0) return null;
      const closedNow = closedTupletAt(m.events, pos) != null;
      const start: number[] = [];
      const end: number[] = [];
      // Landings that would COMPLETE a broken mark — drop the handle here and it becomes a real
      // triplet. Worth its own mark: on a decoded page most of what you do with these is repair
      // them, and the page can say where the repair is rather than leaving it to be discovered.
      const fixes = new Set<number>();
      m.events.forEach((ev, p) => {
        const a = tupletEdgeTo(m.events, g, "start", p);
        const b = tupletEdgeTo(m.events, g, "end", p);
        if (a) start.push(ev.index);
        if (b) end.push(ev.index);
        if ((a?.closes || b?.closes) && !closedNow) fixes.add(ev.index);
      });
      // Every legal landing, and WHICH handle can reach it — a note can be a landing for one end,
      // the other, or both, and a check that drags the wrong handle onto it would look like a bug
      // in the move rather than in the check.
      const all = new Map<number, "start" | "end" | "both">();
      for (const i of start) all.set(i, "start");
      for (const i of end) all.set(i, all.has(i) ? "both" : "end");
      return {
        members,
        /** Does the held mark close as a real triplet? A broken one is repaired rather than slid,
         *  and it is drawn differently, so the sheet has to know which it is holding. */
        closes: closedNow,
        fixes,
        /** The event each handle currently sits on — a candidate too, and the one that means
         *  "stay where you are", so a small wobble does not jump the group. ⚠ A broken mark can
         *  cover ONE note, and then both handles sit on the same event. */
        edge: { start: members[0]!, end: members[members.length - 1]! },
        targets: { start, end },
        all,
      };
    }
    return null;
  }, [doc, tupletPickable, selectedTuplet]);

  /**
   * Edit mode: which bars do not add up, and in which direction (editor step 8).
   *
   * ⚠ The reference is the DERIVED METER, never `Measure.lengthBeats` — that is computed from the
   * bar's own contents (`measureBeats`), so `isMeasureValid` against it is true by construction and
   * can only ever mean "you changed this bar since it was measured". A musician means something
   * else by "this bar is too long", and so does a model that misread a duration.
   *
   * The first and last bar warn only when OVER: a pickup and a closing bar are legitimately short,
   * an overfull one never is.
   */
  const barFill = useMemo(() => {
    const out = new Map<number, "over" | "under">();
    if (!editMode || !timeSig) return out;
    const meterWhole = timeSig.num / timeSig.den;
    const measures = groupMeasures(doc);
    measures.forEach((m, i) => {
      const d = measureBeats(m.events) - meterWhole;
      if (Math.abs(d) < 1e-4) return;
      const edge = i === 0 || i === measures.length - 1;
      if (d < 0 && edge) return;
      out.set(m.index, d > 0 ? "over" : "under");
    });
    return out;
  }, [doc, editMode, timeSig]);

  // Printed-header metadata extracted from the score (makam, form, usul, composer) + its notated
  // tempo (we estimate it; SymbTr stores none). Rendered as an engraved-style header above the staff.
  const header = useMemo(() => scoreHeader(doc), [doc]);
  const headerBpm = useMemo(() => estimateBpm(doc), [doc]);

  // Draw the score with VexFlow whenever the document changes. (Edit mode only toggles the
  // HTML overlay below, so it deliberately isn't a dependency — no need to re-engrave.)
  useLayoutEffect(() => engraveScore({
      accidentalMode,
      boxContentW,
      concaveTuplet,
      contentW,
      doc,
      fitBoxW,
      fitExtra,
      fitKey,
      hostRef,
      justify,
      legacyTupletMark,
      lyricHyphens,
      navMarks,
      onLayout,
      onlyMeasure,
      posByEvRef,
      positionsRef,
      printNoise,
      repeatSpans,
      setBoxes,
      setFit,
      setFitScale,
      setNoteBoxes,
      setSvgHeight,
      setTupletMarks,
      showLyrics,
      signature,
      signatureMap,
      sigTolerant,
      slurNoise,
      staccatoNoise,
      svgMarker,
      svgW,
      textNoise,
      thinSharps,
      timeSig,
      usulBarNoise,
    }), [doc, accidentalMode, sigTolerant, showLyrics, lyricHyphens, signature, signatureMap, timeSig, onLayout, repeatSpans, navMarks, textNoise, slurNoise, staccatoNoise, usulBarNoise, thinSharps, printNoise, legacyTupletMark, concaveTuplet, contentW, contentWidth, svgW, justify, svgMarker, onlyMeasure, fitBoxW, fitExtra, fitKey, boxContentW]);

  // Drive the playhead: while playing, each animation frame reads the audio clock, finds the
  // currently-sounding event, and moves the cursor bar onto it. We mutate the cursor's style
  // directly (via ref) rather than React state so 60fps updates don't re-render the component.
  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    if (!playing) {
      cursor.style.display = "none";
      return;
    }
    // A fresh playback answers for its first row again — it may start anywhere on the page.
    followRowRef.current = null;
    let raf = 0;
    const tick = () => {
      const pos = getPositionMs();
      const ps = positionsRef.current;
      // Two paths, and the plain one is unchanged. Without a `playPlan` the drawn order IS the
      // playing order, so the positions recorded during the draw are read straight off — including
      // the case of one event drawn as two noteheads, where the second box must not stand in for
      // the first. A folded score cannot do that: it plays bars the page does not write out in
      // order, so the clock is read against the PERFORMANCE and the cursor then looks up where that
      // written note is drawn.
      let active: NotePos | undefined;
      if (pos != null && pos >= 0) {
        if (playPlan) {
          if (playPlan.length > 0) {
            const step = playPlan.find((p) => pos < p.endMs) ?? playPlan[playPlan.length - 1]!;
            // Missing = the performance names a note this view did not draw (a structure mark
            // pointing at a bar the same decode dropped). The cursor then stays where it was,
            // rather than flicking to the top of the page.
            active = posByEvRef.current.get(step.evIndex);
          }
        } else if (ps.length > 0) {
          // First event whose end is still ahead of the clock is the one sounding now.
          active = ps.find((p) => pos < p.endMs) ?? ps[ps.length - 1]!;
        }
      }
      if (active) {
        cursor.style.display = "block";
        // ⚠ Already RENDERED units — the draw converts every array it publishes in one place.
        cursor.style.height = `${active.height}px`;
        cursor.style.transform = `translate(${active.x - 2}px, ${active.top}px)`;
        // ⚠ AFTER the transform, never before: the box is read from the DOM, so it has to be the
        // position this frame just wrote. And only when the ROW changed — see the FOLLOW_* block.
        if (followPlayhead && active.top !== followRowRef.current) {
          followRowRef.current = active.top;
          followCursorIntoView(cursor);
        }
      } else if (!playPlan || pos == null || pos < 0) {
        cursor.style.display = "none";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getPositionMs, playPlan, followPlayhead]);

  // A finger or a mouse — sizes only, never layout (APP-RULES: the three viewport questions). Read
  // by the ▲/▼ step arrows, which a thumb needs bigger than a cursor does.
  const { coarse } = useViewport();
  /** What pressed the note last — a finger's press is decided on RELEASE, a mouse's on press. */
  const lastPointerRef = useRef<string>("mouse");

  // Drag a note up and down to change its pitch (owner, 2026-08-07 — this replaces an earlier
  // scroll-wheel version, which fought the page's own scrolling and moved the note in jumps).
  //
  // Pointer events, not mouse events, so a trackpad, a mouse and a touchscreen all behave the
  // same. Three details carry the whole gesture:
  //  - `setPointerCapture` on pointerdown, so the drag keeps working once the pointer leaves the
  //    note's small box — which it does immediately, because the note moves out from under it;
  //  - steps are measured from where the pointer WENT DOWN, not from the previous event, so
  //    rounding cannot accumulate drift over a long drag;
  //  - `applied` remembers how far the note has already moved, and only the difference is sent,
  //    because `onNudgePitch` is relative.
  function onPitchDragStart(e: React.PointerEvent<HTMLDivElement>, index: number) {
    lastPointerRef.current = e.pointerType;
    // ⭐ A FINGER IS NOT A MOUSE (owner, 2026-09-28: *"aşağı kaydırırken editleyebiliyoruz
    // yanlışlıkla"*). On a phone the finger that scrolls the page lands on notes all the time, and
    // this press used to select, drag and even apply the armed tool before the browser knew a
    // scroll was meant. So a touch decides nothing here: selecting, applying a tool and picking a
    // tuplet happen on the TAP (`onNoteTap`), which a scroll never produces. The one thing a touch
    // may start on press is the drag — and only on the note that is ALREADY selected, which is the
    // only note whose target blocks panning (`touchAction` below). First tap selects, the next
    // press moves it. ⚠ A mouse keeps the old press-to-act path unchanged: desktop and every
    // `smoke:editor` click go through it.
    if (e.pointerType !== "mouse") {
      e.stopPropagation();
      if (index !== selectedNote || armed || !onNudgePitch) return; // `armed` covers the tuplet tool too
      e.preventDefault();
      dragRef.current = { index, startY: e.clientY, applied: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    e.stopPropagation();
    e.preventDefault(); // no text selection, no native image drag
    // The tuplet is a two-click gesture and its own path: it never selects, because the selection
    // highlight beside an anchor highlight would say there are two marked notes when there is one.
    if (armedTool === "tuplet") {
      onTupletPick?.(index);
      return;
    }
    onSelectNote?.(index);
    // A tool is armed: this click APPLIES it. Deliberately no drag — a click that both re-values a
    // note and nudges its pitch by whatever the pointer wobbled is not one edit, it is two.
    if (armed) {
      // The click's HEIGHT rides along, because one case needs it: a note value dropped on a REST
      // turns it back into a note, and a rest carries no pitch to keep. Same mapping as the insert
      // ghost, so a rest clicked at a given height becomes the note that height names. App ignores
      // it for every other target.
      onApplyTool?.(index, armedTool === "duration" ? pitchAtNote(e, index) : undefined);
      return;
    }
    if (!onNudgePitch) return;
    dragRef.current = { index, startY: e.clientY, applied: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  /**
   * A finger's tap on a note — the touch half of `onPitchDragStart`. A `click` only fires for a
   * press that did not become a scroll, which is the whole point. Same order as the mouse path:
   * the tuplet tool has its own gesture, otherwise select, then apply what is armed.
   */
  function onNoteTap(e: React.MouseEvent<HTMLDivElement>, index: number) {
    e.stopPropagation(); // the measure box underneath must not see it
    if (lastPointerRef.current === "mouse") return; // already handled on press
    if (armedTool === "tuplet") {
      onTupletPick?.(index);
      return;
    }
    onSelectNote?.(index);
    if (armed) onApplyTool?.(index, armedTool === "duration" ? pitchAtNote(e, index) : undefined);
  }

  function onPitchDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || !onNudgePitch) return;
    // Down the screen is a lower pitch, so the sign flips.
    const want = -Math.round((e.clientY - d.startY) / DRAG_PX_PER_STEP);
    if (want === d.applied) return;
    onNudgePitch(d.index, want - d.applied);
    d.applied = want;
  }

  function onPitchDragEnd(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // --- the tuplet handles (editor step 7b) ------------------------------------------------------
  //
  // Grab either end of a held triplet and drag it along its bar. The group keeps exactly three
  // members, so the handle SLIDES it — one member drops back to its plain value and the neighbour
  // the handle passed over joins. Why three is the only honest length is arithmetic and lives with
  // `tupletEdgeTo`, not here; the sheet only resolves geometry into "which note is under the
  // pointer" and hands that over.

  /** The drawn box of an event. A triplet member can never be tie-split (its duration is a tuplet
   *  fraction, which `needsTieSplit` excludes), so one member is always exactly one box. */
  function boxOf(evIndex: number): NoteBox | null {
    return noteBoxes.find((b) => b.evIndex === evIndex) ?? null;
  }

  function onHandleDown(e: React.PointerEvent<HTMLDivElement>, edge: "start" | "end") {
    e.stopPropagation();
    e.preventDefault();
    tupletDragRef.current = { edge };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  /**
   * The handle moved: slide the group so its end lands on the nearest note the pointer is over.
   *
   * The candidates are the legal landings PLUS the note the handle is already on, and the nearest
   * centre wins. Including the current one is what makes the gesture stable — without it the
   * nearest candidate is always a different note, and the group would jump on the first pixel of
   * movement rather than when the pointer actually reaches the next note.
   *
   * Dragging away vertically does nothing: a tuplet is strictly intra-measure and a measure sits on
   * one row, so a pointer that has left the row is no longer aiming at any of these notes.
   */
  function onHandleMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = tupletDragRef.current;
    if (!d || !tupletSel || !onTupletEdge) return;
    const at = localXY(e);
    if (!at) return;
    const held = boxOf(tupletSel.edge[d.edge]);
    if (!held) return;
    if (Math.abs(at.y - (held.y + held.height / 2)) > ROW_HEIGHT) return; // off this row
    // "Stay put" first, then every legal landing.
    const cands = [
      { evIndex: tupletSel.edge[d.edge], legal: false },
      ...tupletSel.targets[d.edge].map((evIndex) => ({ evIndex, legal: true })),
    ];
    let best: { evIndex: number; legal: boolean } | null = null;
    let bestDx = Infinity;
    for (const c of cands) {
      const b = boxOf(c.evIndex);
      if (!b) continue;
      const dx = Math.abs(b.x + b.width / 2 - at.x);
      if (dx < bestDx) {
        bestDx = dx;
        best = c;
      }
    }
    if (best?.legal) onTupletEdge(d.edge, best.evIndex);
  }

  function onHandleUp(e: React.PointerEvent<HTMLDivElement>) {
    tupletDragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // Map a mouse event to the measure under it, by hit-testing against the recorded boxes. Used
  // for non-edit "click to play from here" (and its hover highlight). Coordinates are relative
  // to the positioned container, matching the SVG's own coordinate space.
  function measureAt(e: React.MouseEvent): MeasureBox | null {
    const cont = containerRef.current;
    if (!cont) return null;
    const rect = cont.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return (
      boxes.find(
        (b) => px >= b.x && px <= b.x + b.width && py >= b.y - 30 && py <= b.y - 30 + (ROW_HEIGHT - 16),
      ) ?? null
    );
  }

  // Disarming (or switching to an accidental) must take the ghost with it — nothing else clears
  // it, because the pointer may never leave the bar it was last drawn over.
  useEffect(() => {
    if (armedTool !== "duration") hideGhost();
  }, [armedTool]);

  // --- insert on empty space (editor step 6) ------------------------------------------------
  //
  // The sheet owns all of the geometry and hands `App` a resolved intent, never pixels: which bar,
  // which event the new note goes in front of, and the staff position the click's height names.

  /** A pointer position in the container's (= the SVG's) coordinate space. */
  function localXY(e: React.MouseEvent): { x: number; y: number } | null {
    const cont = containerRef.current;
    if (!cont) return null;
    const r = cont.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /**
   * What an empty click inside measure `b` would insert: the pitch from its height, and the event
   * it goes in FRONT of from its x — the first note of that bar whose centre lies to the right,
   * or null to append at the end of the bar.
   *
   * ⚠ A tie-split event owns two boxes sharing one `evIndex`; first match wins, which is the right
   * answer (the split is one event, and it starts at the first box).
   */
  function insertAt(b: MeasureBox, at: { x: number; y: number }) {
    const own = new Set(b.measure.events.map((ev) => ev.index));
    let before: number | null = null;
    let bestX = Infinity;
    for (const nb of noteBoxes) {
      if (!own.has(nb.evIndex)) continue;
      const cx = nb.x + nb.width / 2;
      if (cx > at.x && cx < bestX) {
        bestX = cx;
        before = nb.evIndex;
      }
    }
    return { ...pitchAtHeight(at.y, b.topLineY, signatureMap), measureIndex: b.index, beforeEventIndex: before };
  }

  /** The staff position a click on an existing note is pointing at — the rest→note case. Needs the
   *  note's own bar, because the origin (`topLineY`) is per row. Null when the event is not on a
   *  laid-out bar, which a stale click can be. */
  function pitchAtNote(e: React.MouseEvent, index: number) {
    const at = localXY(e);
    const b = boxes.find((bx) => bx.measure.events.some((ev) => ev.index === index));
    if (!at || !b) return undefined;
    const p = pitchAtHeight(at.y, b.topLineY, signatureMap);
    return { letter: p.letter, octave: p.octave, alter: p.alter };
  }

  /** Move the ghost notehead to the position an insert would use, and label it with the pitch it
   *  would produce. `data-insert-pitch` is the contract `smoke:editor` reads: the preview and the
   *  insert must come out of the same mapping, and an attribute is how that is provable. */
  function moveGhost(b: MeasureBox, e: React.MouseEvent) {
    const g = ghostRef.current;
    const at = localXY(e);
    if (!g || !at) return;
    const spot = insertAt(b, at);
    g.style.display = "block";
    if (armedRest) {
      // A rest has no pitch: it goes where the engraver puts it, in the middle of the staff, and
      // the preview must not promise otherwise by following the pointer up and down. Drawn as a
      // squat bar rather than an oval, because that is what a rest looks like.
      g.style.borderRadius = "1px";
      g.style.transform =
        `translate(${at.x - GHOST_W / 2}px, ${b.topLineY + 4 * DRAG_PX_PER_STEP - GHOST_H / 2}px)`;
      g.setAttribute("data-insert-pitch", "es");
      return;
    }
    g.style.borderRadius = "50%";
    // The rotation rides along in the same property — assigning `transform` replaces all of it.
    g.style.transform =
      `translate(${at.x - GHOST_W / 2}px, ${b.topLineY + spot.steps * DRAG_PX_PER_STEP - GHOST_H / 2}px) rotate(-20deg)`;
    g.setAttribute("data-insert-pitch", `${spot.letter}${spot.octave}`);
  }

  function hideGhost() {
    const g = ghostRef.current;
    if (!g) return;
    g.style.display = "none";
    g.removeAttribute("data-insert-pitch");
  }

  // The title block, in both header forms. With a `heading`: the reader's name, the transposition,
  // then the makam and form; without one, exactly as before.
  const titleLines = heading ? (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, fontStyle: "italic" }}>{heading.name}</div>
      {heading.transposed && <div style={{ fontSize: 13, fontStyle: "italic" }}>{heading.transposed}</div>}
      {header.makamForm && <div style={{ fontSize: 15, fontStyle: "italic" }}>{header.makamForm}</div>}
    </>
  ) : (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, fontStyle: "italic" }}>{header.makamForm}</div>
      {header.title && <div style={{ fontSize: 15, fontStyle: "italic" }}>{header.title}</div>}
    </>
  );

  return (
    // No frame of its own: this sits inside the score card (.kv-score), which supplies the paper,
    // the border and the horizontal scroll. A second border here would double-frame the sheet.
    <div>
      {/* Engraved-style header: the makam/form/usul/composer/tempo extracted from the score.
          ⚠ Off in the measure card — the card's own head already names the bar, and a
          makam/usul/composer line over a single measure is the PAGE's furniture, not the bar's. */}
      {chrome && (narrowHeader ? (
        /* ⚠ THE NARROW HEADER (2026-09-19). Three columns do not go into a phone's ~340px: with
           `whiteSpace: nowrap` they overflowed the sheet's box, and letting them ellipsis instead
           truncated "Sofyan ♩ = 80" to "Sofyan …" — the tempo is information, and clipping it is
           not a fix. Stacked, everything fits and nothing is lost: the title keeps its own two
           lines, and the usul, the tempo and the composer join one small line that may WRAP.
           ⚠ Decided from `contentW`, the prop that already fits the engraving to its box, so this
           needs no media query and no selector reaching inside `.kv-score`. */
        <div
          style={{
            padding: "10px 16px 4px", fontFamily: "var(--font-display)", color: "var(--ink)",
            textAlign: "center", lineHeight: 1.3,
          }}
        >
          {titleLines}
          <div style={{ fontSize: 12, fontStyle: "italic", marginTop: 2 }}>
            {header.usul} &nbsp;♩ = {headerBpm}
            {header.composer && <> · Beste: {header.composer}</>}
          </div>
        </div>
      ) : (
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px 4px",
          fontFamily: "var(--font-display)", color: "var(--ink)",
        }}
      >
        {/* ⚠ `minWidth: 0` on all three, and an ellipsis on the two `nowrap` ones (2026-09-19). A
            flex item's `min-width` is `auto` — "never shrink below your content" — so with
            `whiteSpace: nowrap` these columns held their full text width whatever the box did, and
            on a 375px phone "Beste: Tatyos Efendi" hung **11px past the sheet's own box**: the
            staves fitted exactly and the header was the only thing still overflowing. Same mistake
            `.kv-recent__item` paid for once (390px of phone pushed to 623px). Below `NARROW_HEADER`
            the stacked form above takes over instead, because an ellipsis here loses the tempo. */}
        <div
          style={{
            flex: "1 1 0", minWidth: 0, fontSize: 13, fontStyle: "italic",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {header.usul} &nbsp;♩ = {headerBpm}
        </div>
        <div style={{ flex: "2 1 0", minWidth: 0, textAlign: "center", lineHeight: 1.3 }}>
          {titleLines}
        </div>
        <div
          style={{
            flex: "1 1 0", minWidth: 0, fontSize: 13, textAlign: "right",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {header.composer && <>Beste: {header.composer}</>}
        </div>
      </div>
      ))}
      <div
        ref={containerRef}
        // The deploy checks read state, never copy: edit mode and the selection are attributes.
        // The id matters — `#edit-toggle` also carries `data-edit-mode`, so a check that wants the
        // SHEET's state has to name this element rather than match the attribute alone.
        id={surfaceId}
        data-edit-mode={editMode ? "on" : "off"}
        data-selected-note={editMode && selectedNote != null ? selectedNote : undefined}
        data-tuplet-anchor={editMode && tupletAnchor != null ? tupletAnchor : undefined}
        data-repeat-anchor={editMode && repeatAnchor != null ? repeatAnchor : undefined}
        data-tuplet-selected={tupletSel ? tupletSel.members[0] : undefined}
        // Whether the page chases the playhead. On the SHEET as well as on the checkbox, because
        // the checkbox only proves the control was clicked — this says what the sheet will do.
        data-follow={followPlayhead ? "on" : "off"}
        style={{ position: "relative", width: svgW * fitScale, height: svgHeight * fitScale, cursor: editMode ? "default" : "pointer" }}
        onClick={editMode ? undefined : (e) => { const m = measureAt(e); if (m) onSeekToMeasure(m.measure); }}
        onMouseMove={editMode ? undefined : (e) => setHover(measureAt(e)?.index ?? null)}
        onMouseLeave={editMode ? undefined : () => setHover(null)}
      >
        <div ref={hostRef} />
        {/* Step-2c: the selected strip's crop region (what a training PNG will capture). */}
        {highlightRect && (
          <div
            style={{
              position: "absolute",
              left: highlightRect.x,
              top: highlightRect.y,
              width: highlightRect.width,
              height: highlightRect.height,
              pointerEvents: "none",
              boxSizing: "border-box",
              border: "2px solid #f59e0b",
              background: "rgba(245,158,11,0.12)",
              borderRadius: 3,
            }}
          />
        )}
        {/* Non-edit hover highlight: shows which measure a click will play from. */}
        {!editMode &&
          hover != null &&
          (() => {
            const b = boxes.find((bx) => bx.index === hover);
            if (!b) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y - 30,
                  width: b.width,
                  height: ROW_HEIGHT - 16,
                  pointerEvents: "none",
                  boxSizing: "border-box",
                  borderRadius: 4,
                  background: "color-mix(in srgb, var(--iznik-cobalt) 7%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--iznik-cobalt) 50%, transparent)",
                }}
              />
            );
          })()}
        {/* Playhead: an İznik-red bar that tracks the currently-playing note (positioned via transform).
            `data-omr` so a check can read WHERE playback started — an attribute saying which bar
            Çal aims at cannot prove the audio actually began there. */}
        <div
          ref={cursorRef}
          data-omr="playhead"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 2.5,
            height: 0, // set per-row during playback (see the rAF loop)
            background: "var(--iznik-red)",
            borderRadius: 2,
            boxShadow: "0 0 3px color-mix(in srgb, var(--iznik-red) 70%, transparent)",
            pointerEvents: "none",
            display: "none",
            willChange: "transform",
          }}
        />
        {editMode && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} data-omr="edit-overlay">
            {/* Measure targets, underneath the note targets. What an empty click does depends on
                what is armed: a NOTE VALUE inserts a note right there (step 6 — pitch from the
                click's height, duration from the tool); an ACCIDENTAL or the TUPLET does nothing,
                because neither has anything to attach to; with nothing armed it clears the
                selection. ⚠ It used to open the per-measure modal — deleted 2026-08-08, so a click
                on blank staff can no longer produce a window over the score.
                ⚠ NO hover highlight here (owner, 2026-08-07). Editing is whole-score, so framing a
                measure says the wrong thing about what a click does — and it also cost a re-render
                per mouse-move across the sheet. The note boxes below carry the only hover state
                edit mode has; the insert ghost moves without one. */}
            {boxes.map((b) => (
              <div
                key={b.index}
                onClick={(e) => {
                  if (armedTool === "duration") {
                    const at = localXY(e);
                    if (at) onInsertNote?.(insertAt(b, at));
                    return;
                  }
                  // A SIGN belongs to the BAR, so anywhere in it will do — including on top of a
                  // note, which is why the note targets go pointer-transparent while one is armed.
                  // ⚠ Except the REPEAT: its two signs sit ON barlines, so it has its own targets
                  // and a click in the middle of a bar means nothing to it.
                  if (armedTool === "structure") {
                    if (armedSign !== "repeat") onPlaceMark?.(b.index);
                    return;
                  }
                  if (armedTool) return; // an accidental (or the tuplet) needs a note
                  onSelectNote?.(null);
                }}
                onMouseMove={armedTool === "duration" ? (e) => moveGhost(b, e) : undefined}
                onMouseLeave={armedTool === "duration" ? hideGhost : undefined}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y - 30,
                  width: b.width,
                  height: ROW_HEIGHT - 16,
                  pointerEvents: "auto",
                  cursor: armedTool === "duration" ? "copy" : "default",
                  boxSizing: "border-box",
                }}
              />
            ))}
            {/* Bars that do not add up (editor step 8). An INDICATOR, never a block: an edit
                absorbs into its bar and bar lines never move, so over- and under-full bars are
                ordinary, reachable states of the document — a triplet makes one every time.
                ⚠ The reference is the DERIVED METER (see `barFill`), not `Measure.lengthBeats`.
                Drawn in the overlay, never in the SVG: the engraving may not move. */}
            {boxes.map((b) => {
              const fill = barFill.get(b.index);
              if (!fill) return null;
              const beats = measureBeats(b.measure.events);
              const meter = timeSig ? `${timeSig.num}/${timeSig.den}` : "";
              return (
                <div
                  key={`fill_${b.index}`}
                  data-omr="bar-warning"
                  data-bar={b.index}
                  data-bar-fill={fill}
                  className={`kv-bar-warn kv-bar-warn--${fill}`}
                  title={
                    fill === "over"
                      ? TR.bar.over(beats.toFixed(3), meter)
                      : TR.bar.under(beats.toFixed(3), meter)
                  }
                  // Just above the top staff line at the bar's right edge — `b.y` is the stave's
                  // bounding box, which starts a whole STAVE_TOP_PAD higher and reads as floating
                  // over the system rather than belonging to the bar.
                  style={{ position: "absolute", left: b.x + b.width - 20, top: b.topLineY - 24 }}
                >
                  {fill === "over" ? "+" : "−"}
                </div>
              );
            })}
            {/* The insert preview. One element for the whole sheet, parked until a note value is
                armed and the pointer is over a bar; `moveGhost` positions it and names the pitch
                it would produce. */}
            <div
              ref={ghostRef}
              data-omr="insert-ghost"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: GHOST_W,
                height: GHOST_H,
                borderRadius: "50%",
                background: "rgba(20,184,166,0.45)",
                border: "1px solid #14b8a6",
                boxSizing: "border-box",
                transform: "rotate(-20deg)", // a notehead leans, and it reads as one at this size
                pointerEvents: "none",
                display: "none",
                willChange: "transform",
              }}
            />
            {/* Note targets. A tie-split event has two boxes sharing one evIndex; both highlight
                when it is selected, and either one selects it. */}
            {noteBoxes.map((nb, i) => {
              const on = selectedNote != null && nb.evIndex === selectedNote;
              // Tuplet armed: what this note would do, and whether it can be clicked at all. A
              // tie-split event owns two boxes sharing one evIndex; both read the same state.
              const tup = tupletStates.get(nb.evIndex);
              // A note inside a triplet is not a target: the SIGN above it is (owner, 2026-08-30).
              // It keeps its `member` state so the DOM still says where the triplets are.
              // A held triplet marks its own three notes, and every note either handle could be
              // dragged onto. A landing is shown but NOT made clickable: the handles do the moving,
              // and a click that also moved the group would make "which end?" ambiguous.
              const heldMember = tupletSel?.members.includes(nb.evIndex) === true;
              const landing = tupletSel?.all.get(nb.evIndex);
              const isFix = tupletSel?.fixes.has(nb.evIndex) === true;
              // ⚠ TWO SEPARATE THINGS, and merging them was a live bug. `refused` is the TUPLET
              // tool saying "not this note" — it greys the note, which is how the page refuses
              // instead of popping an error. `dead` is only about pointer-events, and a SIGN tool
              // makes every note pointer-transparent because a sign goes on a BAR: the click has to
              // reach the measure box underneath, wherever in the bar it lands. Written as one
              // flag, arming any sign greyed out the whole score.
              const refused = tup === "blocked" || tup === "member";
              const dead = refused || armedTool === "structure";
              return (
                <div
                  key={`${nb.evIndex}_${i}`}
                  className={
                    `kv-note-hit${on ? " is-selected" : ""}${armed ? " is-armed" : ""}` +
                    `${refused ? " is-dim" : ""}${tup === "anchor" ? " is-anchor" : ""}` +
                    `${heldMember ? " is-tuplet-held" : ""}${landing ? " is-tuplet-landing" : ""}` +
                    `${isFix ? " is-tuplet-fix" : ""}`
                  }
                  data-omr-note={nb.evIndex}
                  data-selected={on ? "1" : undefined}
                  data-tuplet={tup}
                  data-tuplet-held={heldMember ? "1" : undefined}
                  data-tuplet-landing={landing}
                  data-tuplet-fix={isFix ? "1" : undefined}
                  onPointerDown={(e) => onPitchDragStart(e, nb.evIndex)}
                  onPointerMove={onPitchDragMove}
                  onPointerUp={onPitchDragEnd}
                  onPointerCancel={onPitchDragEnd}
                  // A mouse acted on press; a finger acts here, on the tap (see `onNoteTap`).
                  onClick={(e) => onNoteTap(e, nb.evIndex)}
                  style={{
                    position: "absolute",
                    left: nb.x - NOTE_HIT_PAD,
                    top: nb.y - NOTE_HIT_PAD,
                    width: nb.width + 2 * NOTE_HIT_PAD,
                    height: nb.height + 2 * NOTE_HIT_PAD,
                    // A note the tuplet tool would refuse is not a target at all — the click falls
                    // through to the measure box below, which with a tool armed does nothing.
                    pointerEvents: dead ? "none" : "auto",
                    cursor: armed ? "copy" : "grab",
                    // ⚠ Only the SELECTED note blocks panning — it is the only one a finger may drag
                    // (2026-09-28). Every other note lets the page scroll under the finger, and
                    // `manipulation` also drops the double-tap zoom between two quick taps.
                    touchAction: on && !armed ? "none" : "manipulation",
                  }}
                />
              );
            })}
            {/* The drawn "3" marks, as click targets (owner, 2026-08-30: *"direkt olarak 3'leme
                işaretinin tıklanabilir olmasını istiyorum. notalarına tıklamak istemiyorum"*).
                Clicking the SIGN holds its tuplet. Every drawn mark gets one, a broken mark included
                — that is the one most in need of a correction. The box is measured off the ink that
                was engraved (see `markBoxOf`), so it lands on the mark a reader sees whichever of the
                four styles this piece drew.
                ⚠ These render in plain **Seçim** as well as with the tuplet armed (see
                `tupletPickable`), and they are painted AFTER the note targets on purpose — a later
                sibling wins an overlapping click. They started out before them, and in Seçim (where
                a note IS clickable, unlike under the tuplet tool) a note's box swallowed the mark
                outright: VexFlow's box reaches along the stem, past the noteheads, into the strip of
                staff the mark is drawn in. The mark wins there because it is the smaller, more
                specific target and it sits on the NOTEHEAD side, opposite the stems — so the region
                they fight over is stem, never notehead. `smoke:editor` holds the other half of that
                bargain: no note's CENTRE may fall inside a mark's box. */}
            {tupletPickable &&
              tupletMarks.map((mk) => (
                <div
                  key={`tupmark_${mk.evIndex}`}
                  data-omr="tuplet-mark-hit"
                  data-tuplet-group={mk.evIndex}
                  data-tuplet-mark={mk.closes ? "closed" : "broken"}
                  data-held={selectedTuplet === mk.evIndex ? "1" : undefined}
                  className={
                    `kv-tuplet-mark-hit${mk.closes ? "" : " is-broken"}` +
                    `${selectedTuplet === mk.evIndex ? " is-held" : ""}`
                  }
                  title={mk.closes ? TR.sheet.pickTuplet : TR.sheet.pickBrokenTuplet}
                  onClick={(e) => { e.stopPropagation(); onTupletPick?.(mk.evIndex); }}
                  style={{
                    position: "absolute",
                    left: mk.x - MARK_HIT_PAD,
                    top: mk.y - MARK_HIT_PAD,
                    width: mk.width + 2 * MARK_HIT_PAD,
                    height: mk.height + 2 * MARK_HIT_PAD,
                    pointerEvents: "auto",
                    cursor: "pointer",
                  }}
                />
              ))}
            {/* THE STRUCTURE SIGNS (owner, 2026-09-03). Two kinds of ink, and one of them is not on
                the staff at all.

                ⚠ These are DELETE targets, live only in Seçim. With a sign tool armed every click
                places one — "armed places, Seçim removes" — so a target here would make clicking an
                existing `‖:` mean two different things depending on what is in your hand.

                ⚠ Painted after the note targets for the same reason the tuplet marks are: a later
                sibling wins the overlap, and a repeat barline sits exactly where a note's box
                reaches. They are narrow and sit ON the barline, so what they take from a note is
                the sliver of staff no notehead occupies.

                ⚠ `openRepeat` is the odd one: a `‖:` with nothing closing it is deliberately absent
                from the engraved staff (`repeatSpansFromStructure` will not promise a repeat the
                music does not take), so edit mode draws it here, dashed. Outside edit mode it is
                invisible and the page is unchanged — which is the whole point. */}
            {armedTool == null &&
              signTargets?.map((t) => {
                const b = boxes.find((bx) => bx.index === t.bar);
                if (!b) return null;
                const bar = t.mark === "repStart" || t.mark === "repEnd";
                const box = bar
                  ? {
                      left: (t.at === "end" ? b.x + b.width : b.x) - SIGN_HIT_W / 2,
                      top: b.topLineY - SIGN_HIT_PAD,
                      width: SIGN_HIT_W,
                      height: 4 * STAFF_SPACE + 2 * SIGN_HIT_PAD,
                    }
                  : t.at === "above"
                    // ⚠ Short of the bar's right edge by `BAR_WARN_W`: the off-meter `+`/`−` badge
                    // sits there, in the same band, and this target paints later — taking the whole
                    // width would swallow the one tooltip that explains a bar that does not add up.
                    ? { left: b.x, top: b.topLineY - VOLTA_ABOVE - 4, width: Math.max(20, b.width - BAR_WARN_W), height: 20 }
                    : {
                        left: t.at === "end" ? b.x + b.width - NAV_HIT_W : b.x,
                        top: b.topLineY - NAV_HIT_H - 4,
                        width: NAV_HIT_W,
                        height: NAV_HIT_H,
                      };
                return (
                  <div
                    key={`sign_${t.bar}_${t.mark}`}
                    data-omr="sign-hit"
                    data-bar={t.bar}
                    data-sign={t.mark}
                    className="kv-sign-hit"
                    title={TR.sheet.removeSign}
                    onClick={(e) => { e.stopPropagation(); onRemoveMark?.(t.bar, t.mark); }}
                    style={{ position: "absolute", ...box, pointerEvents: "auto", cursor: "pointer" }}
                  />
                );
              })}
            {/* THE REPEAT'S BARLINE TARGETS (owner, 2026-09-03: *"ölçüye değil de barline lara
                tıklayabilsin kullanıcı"*). Two clicks, and they are on the two lines a repeat is
                actually printed on: a bar's OPENING line carries `‖:`, its CLOSING line carries
                `:‖`. That is also what makes the gesture unambiguous — the phases target different
                lines, so "the same place twice" is not a state that has to be given a meaning.

                ⚠ Unlike the delete chips these are VISIBLE while the tool is armed: an invisible
                target teaches nothing, and the user has to see which lines are on offer. Phase 2
                dims every line at or before the anchor (`data-repeat-edge-state="blocked"`) and
                makes it inert — a repeat cannot close where it opened or earlier. */}
            {armedTool === "structure" && armedSign === "repeat" &&
              boxes.map((b) => {
                const opening = repeatAnchor == null;
                const blocked = !opening && b.index < repeatAnchor!;
                return (
                  <div
                    key={`repedge_${b.index}`}
                    data-omr="repeat-edge"
                    data-bar={b.index}
                    data-edge={opening ? "start" : "end"}
                    data-repeat-edge-state={blocked ? "blocked" : "open"}
                    className={`kv-repeat-edge${blocked ? " is-blocked" : ""}`}
                    title={opening ? TR.sheet.repeatFrom : TR.sheet.repeatTo}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!blocked) onRepeatEdge?.(b.index, opening ? "start" : "end");
                    }}
                    style={{
                      position: "absolute",
                      // The opening line is the bar's left edge, the closing line its right — the
                      // same two places VexFlow puts `‖:` and `:‖`.
                      left: (opening ? b.x : b.x + b.width) - SIGN_HIT_W / 2,
                      top: b.topLineY - SIGN_HIT_PAD,
                      width: SIGN_HIT_W,
                      height: 4 * STAFF_SPACE + 2 * SIGN_HIT_PAD,
                      pointerEvents: blocked ? "none" : "auto",
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            {/* The pending `‖:`. Dashed, because nothing is in the document yet — the repeat is
                committed only by the second click. Clicking it takes the gesture back. */}
            {(() => {
              if (repeatAnchor == null) return null;
              const b = boxes.find((bx) => bx.index === repeatAnchor);
              if (!b) return null;
              return (
                <div
                  data-omr="repeat-anchor"
                  data-bar={repeatAnchor}
                  className="kv-open-repeat is-anchor"
                  title={TR.sheet.repeatCancel}
                  onClick={(e) => { e.stopPropagation(); onRepeatCancel?.(); }}
                  style={{
                    position: "absolute",
                    left: b.x - 2,
                    top: b.topLineY - SIGN_HIT_PAD,
                    width: 4,
                    height: 4 * STAFF_SPACE + 2 * SIGN_HIT_PAD,
                    pointerEvents: "auto",
                    cursor: "pointer",
                  }}
                />
              );
            })()}
            {(() => {
              if (openRepeat == null) return null;
              const b = boxes.find((bx) => bx.index === openRepeat);
              if (!b) return null;
              return (
                <div
                  data-omr="open-repeat"
                  data-bar={openRepeat}
                  className="kv-open-repeat"
                  title={TR.sheet.openRepeat}
                  onClick={(e) => { e.stopPropagation(); if (armedTool == null) onRemoveMark?.(openRepeat, "repStart"); }}
                  style={{
                    position: "absolute",
                    left: b.x - 2,
                    top: b.topLineY - SIGN_HIT_PAD,
                    width: 4,
                    height: 4 * STAFF_SPACE + 2 * SIGN_HIT_PAD,
                    pointerEvents: armedTool == null ? "auto" : "none",
                    cursor: armedTool == null ? "pointer" : "default",
                  }}
                />
              );
            })()}
            {/* The held triplet (editor step 7b): a frame round its three notes, a handle at each
                end, and the ✕ that takes the bracket off.
                ⚠ Nothing here is stored — `tupletSel` re-derives the group from the document every
                render — so an undo or a re-valued member simply stops drawing all of it.
                On a REAL triplet the handles slide the group without ever growing it, because the
                drawn digit is a hardcoded "3" and the label token is `\tup3`; on a BROKEN mark they
                repair it — the grabbed end moves and the other stays. `tupletEdgeTo` owns both. */}
            {(() => {
              if (!tupletSel || !onTupletEdge) return null;
              const held = tupletSel.members.map(boxOf).filter((b): b is NoteBox => b != null);
              // ⚠ Every member must have a box, and there may be ONE of them: a broken mark can
              // cover a single note. Testing for three here left every broken mark frameless and
              // handleless — held, with nothing on screen to say so.
              if (held.length === 0 || held.length !== tupletSel.members.length) return null;
              const first = held[0]!;
              const last = held[held.length - 1]!;
              const top = Math.min(...held.map((b) => b.y)) - NOTE_HIT_PAD;
              const bottom = Math.max(...held.map((b) => b.y + b.height)) + NOTE_HIT_PAD;
              const left = first.x - NOTE_HIT_PAD;
              const right = last.x + last.width + NOTE_HIT_PAD;
              const handle = (edge: "start" | "end") => (
                <div
                  key={`tuplet-handle-${edge}`}
                  data-omr="tuplet-handle"
                  data-edge={edge}
                  data-can-move={tupletSel.targets[edge].length > 0 ? "1" : "0"}
                  className="kv-tuplet-handle"
                  title={tupletSel.closes ? TR.sheet.tupletHandle : TR.sheet.tupletHandleFix}
                  aria-label={tupletSel.closes ? TR.sheet.tupletHandle : TR.sheet.tupletHandleFix}
                  onPointerDown={(e) => onHandleDown(e, edge)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={onHandleUp}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    left: edge === "start" ? left - TUPLET_HANDLE_W - 1 : right + 1,
                    top,
                    width: TUPLET_HANDLE_W,
                    height: bottom - top,
                    pointerEvents: "auto",
                    // Inline, not CSS: an inline cursor would win over the class either way, so
                    // the disabled state has to be decided in the same place.
                    cursor: tupletSel.targets[edge].length > 0 ? "ew-resize" : "not-allowed",
                    touchAction: "none", // or the browser pans the page instead of dragging
                  }}
                />
              );
              return (
                <>
                  <div
                    data-omr="tuplet-frame"
                    data-tuplet-mark={tupletSel.closes ? "closed" : "broken"}
                    className={`kv-tuplet-frame${tupletSel.closes ? "" : " is-broken"}`}
                    style={{ position: "absolute", left, top, width: right - left, height: bottom - top }}
                  />
                  {handle("start")}
                  {handle("end")}
                  {onTupletRemove && (
                    <button
                      id="tuplet-remove"
                      type="button"
                      title={TR.sheet.removeTuplet}
                      aria-label={TR.sheet.removeTuplet}
                      onClick={(e) => { e.stopPropagation(); onTupletRemove(); }}
                      style={{
                        position: "absolute",
                        left: (left + right) / 2 - 10,
                        top: top - 24,
                        width: 20,
                        height: 20,
                        lineHeight: "18px",
                        padding: 0,
                        pointerEvents: "auto",
                        cursor: "pointer",
                        borderRadius: "50%",
                        border: "1px solid #b91c1c",
                        background: "#fff",
                        color: "#b91c1c",
                        fontSize: 13,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </>
              );
            })()}
            {/* The ✕, on the FIRST box of the selected event (a tie-split has two) so a split
                note doesn't sprout two delete buttons. */}
            {(() => {
              if (selectedNote == null || !onDeleteNote) return null;
              const nb = noteBoxes.find((b) => b.evIndex === selectedNote);
              if (!nb) return null;
              return (
                <button
                  id="note-delete"
                  type="button"
                  title={TR.sheet.deleteNote}
                  aria-label={TR.sheet.deleteNote}
                  onClick={(e) => { e.stopPropagation(); onDeleteNote(selectedNote); }}
                  style={{
                    position: "absolute",
                    left: nb.x + nb.width + NOTE_HIT_PAD - 2,
                    top: nb.y - NOTE_HIT_PAD - 16,
                    width: 20,
                    height: 20,
                    lineHeight: "18px",
                    padding: 0,
                    pointerEvents: "auto",
                    cursor: "pointer",
                    borderRadius: "50%",
                    border: "1px solid #b91c1c",
                    background: "#fff",
                    color: "#b91c1c",
                    fontSize: 13,
                  }}
                >
                  ✕
                </button>
              );
            })()}
            {/* ⭐ THE STEP ARROWS (owner, 2026-09-28: *"sürükleyerek nota değerini değiştirme mantığı
                mobilde pek etkili değil"*). A drag moves a note by `DRAG_PX_PER_STEP` of finger
                travel, and on a phone the finger covers the very notehead it is moving. One tap on ▲
                or ▼ is ONE step — exactly what one drag step does, through the same `onNudgePitch`,
                so there is still one rule for what a step is. The drag stays; these only help.
                ⚠ Only for a NOTE (a rest has no pitch to move) and only with nothing armed, which is
                also when the drag works.
                ⚠ Placed off the note's measured box — never `getBBox()` (APP-RULES) — both on one
                vertical line, `STEP_GAP` clear of it, which also keeps the ▲ above the ✕.
                ⚠ Drawn with inline SVG, not a text glyph: nothing under `.kv-score` may set a font. */}
            {(() => {
              if (selectedNote == null || !onNudgePitch || armedTool != null) return null;
              const ev = doc.events.find((e) => e.index === selectedNote);
              if (!ev || ev.kind !== "note") return null;
              const nb = noteBoxes.find((b) => b.evIndex === selectedNote);
              if (!nb) return null;
              const S = coarse ? STEP_BTN_TOUCH : STEP_BTN;
              const cx = nb.x + nb.width / 2;
              const boxTop = nb.y - NOTE_HIT_PAD;
              const boxBottom = nb.y + nb.height + NOTE_HIT_PAD;
              // ⚠ Both arrows sit on ONE vertical line through the note (owner, 2026-09-28, with a
              // photo: the ▲ used to step left to dodge the ✕ and the pair looked crooked). They are
              // held `STEP_GAP` off the box instead, and that gap is chosen LARGER than the ✕'s reach
              // above the box (its top is 16px above it), so the ▲ clears the ✕ by height alone.
              const upTop = boxTop - STEP_GAP - S;
              const upLeft = cx - S / 2;
              const arrow = (dir: 1 | -1) => (
                <button
                  key={dir}
                  id={dir === 1 ? "note-step-up" : "note-step-down"}
                  type="button"
                  data-omr="note-step"
                  data-dir={dir === 1 ? "up" : "down"}
                  title={dir === 1 ? TR.sheet.stepUp : TR.sheet.stepDown}
                  aria-label={dir === 1 ? TR.sheet.stepUp : TR.sheet.stepDown}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onNudgePitch(selectedNote, dir); }}
                  style={{
                    position: "absolute",
                    left: dir === 1 ? upLeft : cx - S / 2,
                    top: dir === 1 ? upTop : boxBottom + STEP_GAP,
                    width: S,
                    height: S,
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "auto",
                    cursor: "pointer",
                    borderRadius: "50%",
                    border: "1px solid #0f766e",
                    background: "#fff",
                    color: "#0f766e",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                    touchAction: "manipulation", // no double-tap zoom between two quick taps
                  }}
                >
                  <svg width={S * 0.5} height={S * 0.5} viewBox="0 0 10 10" aria-hidden="true">
                    <path
                      d={dir === 1 ? "M1.5 7 L5 3 L8.5 7" : "M1.5 3 L5 7 L8.5 3"}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              );
              return (
                <>
                  {arrow(1)}
                  {arrow(-1)}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {chrome && <Legend used={usedAccidentals} />}
    </div>
  );
}
