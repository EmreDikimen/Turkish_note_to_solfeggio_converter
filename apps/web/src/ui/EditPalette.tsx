/**
 * The editor's armed-tool palette — Mus2's model, which is the one the owner already uses.
 *
 * You ARM a tool (a note value or an accidental) and then click the score; the click applies the
 * armed tool to the note it lands on. With nothing armed, a click selects and a drag moves the
 * pitch, exactly as before the palette existed. `Esc` disarms, and so does the Seçim button.
 *
 * ⚠ It renders OUTSIDE the score card entirely — a `position: fixed` toolbox floating over the
 * page, not a column in the score's row (owner, 2026-09-03). Two reasons. `.kv-score` is
 * screenshotted by rect to cut training strips, so nothing of ours may nest in it, set a font in
 * it or transform it; and a palette that took width from that row forced the whole page wider
 * while editing, which is what the owner asked to end. Floating it gives the sheet its full width
 * back in edit mode, so entering edit mode no longer moves the music.
 *
 * ⚠ It is `fixed`, not `sticky`: sticky still travels with the row it sits in, so the palette
 * slid away as you scrolled down a long page. Fixed keeps it exactly where the user parked it.
 * The user parks it by DRAGGING its title bar, and folds it down to that bar alone with the
 * button on the right. Both the spot and the folded state are remembered in `localStorage` —
 * a convenience, never a requirement: every read and write is wrapped, because storage throws in
 * a private window and returns nothing after cleared site data.
 *
 * It also carries its own Çal/Dur, which plays from the LAST EDITED BAR. That is not a duplicate of
 * the transport above: in edit mode a click on the sheet selects or inserts, so click-a-bar-to-play
 * is switched off, and this is what replaces it — fix a note, press Çal, hear the bar.
 *
 * The deploy checks read state, never copy (CLAUDE.md): `#edit-palette` carries `data-armed` with
 * the armed tool's id and `data-play-from` with the bar Çal would start from, and every button
 * carries `data-tool` + `aria-pressed`.
 * ⚠ `#palette-play` carries `data-play-state`, which the transport's `#play` ALSO carries — the
 * same two-elements trap `data-edit-mode` has. A check must name the one it means by id.
 * The toolbox shell adds `#edit-palette[data-collapsed]` and `#palette-fold[data-collapsed]`;
 * ⚠ folded UNMOUNTS every tool, so a check that arms one must unfold first (or simply not fold —
 * the toolbox opens unfolded unless the user folded it last time).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ACCIDENTAL_VALUES, accidentalCp, accidentalLongLabel } from "./accidentals";
import type { RefusalReason, SignTool } from "../../../../tools/render/structure-edit";
import { TR } from "./strings";

/** What a click on a note does while this tool is armed.
 *
 *  A REST is the same tool as a note value with `rest: true`, not a separate kind: it inserts and
 *  re-values through exactly the same paths, and the only difference is which shape of event comes
 *  out. That keeps "arm a thing, click a target" true of the whole palette. */
export type Tool =
  | { kind: "duration"; num: number; den: number; rest?: boolean }
  | { kind: "accidental"; alter: number }
  | { kind: "tuplet" }
  /** A structure SIGN (`‖:` `:‖` 1./2. 𝄋 ⊕ "D.C." "Son"). Armed, a click anywhere in a bar puts
   *  the sign on that bar — the sign belongs to the BAR, not to a note, so unlike every other tool
   *  here it never needs a target under the pointer. */
  | { kind: "structure"; mark: SignTool };

/** The tool's stable id — what `data-tool` carries and what the smoke check arms by name. */
export function toolId(t: Tool): string {
  if (t.kind === "duration") return `${t.rest ? "rest" : "dur"}:${t.num}/${t.den}`;
  if (t.kind === "accidental") return `acc:${t.alter}`;
  if (t.kind === "structure") return `sign:${t.mark}`;
  return "tuplet";
}

/** SMuFL `tuplet3` — the same italic 3 the engraver draws over a triplet, so the button shows
 *  exactly what the tool produces. */
const TUPLET_CP = 0xe883;

/** SMuFL for the structure signs, so each button shows the ink it puts on the page: `repeatLeft`,
 *  `repeatRight`, `segno`, `coda`. ⚠ "D.C." and "Son" are TEXT on a printed page, not glyphs (see
 *  `NAV_TEXT` in SheetView), and the volta is a drawn bracket — those three buttons carry the same
 *  thing the sheet draws rather than a glyph that does not exist. */
const SIGN_CP = { repeat: 0xe042, segno: 0xe047, coda: 0xe048 } as const;

/**
 * Note values, longest → shortest, with the SMuFL codepoint each is drawn with (Bravura's
 * "individual notes" range: noteWhole, noteHalfUp, noteQuarterUp, note8thUp, note16thUp,
 * note32ndUp). The glyph is the label — a musician reads the notehead faster than "1/8".
 */
const DURATIONS: { num: number; den: number; cp: number; rest: number }[] = [
  { num: 1, den: 1, cp: 0xe1d2, rest: 0xe4e3 },
  { num: 1, den: 2, cp: 0xe1d3, rest: 0xe4e4 },
  { num: 1, den: 4, cp: 0xe1d5, rest: 0xe4e5 },
  { num: 1, den: 8, cp: 0xe1d7, rest: 0xe4e6 },
  { num: 1, den: 16, cp: 0xe1d9, rest: 0xe4e7 },
  { num: 1, den: 32, cp: 0xe1db, rest: 0xe4e8 },
];

/**
 * How far each glyph's INK sits above its baseline, and how far below — measured from the shipped
 * Bravura with `TextMetrics.actualBoundingBox*` at `font-size: 100px`.
 *
 * Why this table exists: centring a glyph the ordinary way centres its *line box*, and a music
 * glyph's ink is nowhere near its baseline. A stemmed note draws **87–102 units up and 14 down**,
 * so flex-centring pushed the stems clean out through the top of the button while the space under
 * the notehead sat empty. (The ink itself is small enough to fit: ~30 px inside a 38 px box.) With
 * `line-height: 0` the baseline lands at the button's centre, so shifting the glyph down by half
 * its ink imbalance centres what you can actually see. Codepoints not listed fall back to no shift.
 */
const INK: Record<number, { up: number; down: number }> = {
  0xe1d2: { up: 13.6, down: 13.7 },   // noteWhole — an oval on the line, already balanced
  0xe1d3: { up: 87.5, down: 14.5 },   // noteHalfUp
  0xe1d5: { up: 87.5, down: 14.1 },   // noteQuarterUp
  0xe1d7: { up: 87.3, down: 13.8 },   // note8thUp
  0xe1d9: { up: 87.3, down: 13.8 },   // note16thUp
  0xe1db: { up: 102.3, down: 13.8 },  // note32ndUp — the tallest, and the one that broke out first
  0xe260: { up: 43.9, down: 17.5 },   // accidentalFlat
  0xe261: { up: 34.1, down: 33.5 },   // accidentalNatural
  0xe440: { up: 43.8, down: 17.4 },   // accidentalBuyukMucennebFlat
  0xe441: { up: 43.9, down: 17.5 },   // accidentalKucukMucennebFlat
  0xe442: { up: 43.9, down: 17.5 },   // accidentalBakiyeFlat
  0xe443: { up: 43.9, down: 17.5 },   // accidentalKomaFlat
  0xe444: { up: 32.2, down: 33.7 },   // accidentalKomaSharp
  0xe445: { up: 35.0, down: 34.8 },   // accidentalBakiyeSharp
  0xe446: { up: 32.1, down: 33.8 },   // accidentalKucukMucennebSharp
  0xe447: { up: 34.8, down: 35.0 },   // accidentalBuyukMucennebSharp
  0xe451: { up: 51.8, down: 34.8 },   // accidental2CommaSharp — the widest sign in the row, too
  0xe452: { up: 51.1, down: 34.8 },   // accidental3CommaSharp
  0xe455: { up: 48.7, down: 17.5 },   // accidental2CommaFlat
  0xe456: { up: 47.8, down: 17.5 },   // accidental3CommaFlat
  0xe4e3: { up: 0.9, down: 13.5 },    // restWhole — a bar hanging UNDER the line, all ink down
  0xe4e4: { up: 14.2, down: 0.2 },    // restHalf — the same bar sitting ON it
  0xe4e5: { up: 37.3, down: 37.5 },   // restQuarter
  0xe4e6: { up: 17.4, down: 25.1 },   // rest8th
  0xe4e7: { up: 17.9, down: 50.0 },   // rest16th
  0xe4e8: { up: 42.6, down: 50.0 },   // rest32nd — the tallest rest
  0xe883: { up: 37.5, down: 0.8 },    // tuplet3 — a digit sits ON the baseline, so it is all ink up
  0xe042: { up: 100.0, down: 0.0 },   // repeatRightLeft :‖: — a barline: ALL ink up, none below
  0xe047: { up: 75.9, down: 2.7 },    // segno 𝄋
  0xe048: { up: 89.8, down: 15.8 },   // coda ⊕ — the widest of the four
};

/** Centre a glyph on its INK rather than on its baseline. `size` is the font-size in px. */
function inkCentred(cp: number, size: number): React.CSSProperties {
  const ink = INK[cp];
  const dy = ink ? ((ink.up - ink.down) / 2) * (size / 100) : 0;
  return { fontSize: size, lineHeight: 0, display: "block", transform: `translateY(${dy.toFixed(1)}px)` };
}

/** Where the toolbox is parked, in VIEWPORT pixels — it is `position: fixed`, so these are not
 *  page coordinates and scrolling never changes them. */
type Spot = { x: number; y: number };

/** How close to an edge the toolbox may be parked, and where it opens if nothing is remembered. */
const EDGE = 12;
const DEFAULT_TOP = 88;

/** One key holds the spot and the folded state together — they are one "how I left my toolbox". */
const STORE_KEY = "kv.toolbox";

type Stored = { x: number; y: number; folded: boolean };

/** ⚠ Both of these swallow everything. `localStorage` is not merely empty in a private window or
 *  after cleared site data — the accessor itself throws — and a toolbox that fails to open because
 *  it could not remember where it was last time is worse than one that opens in the default spot. */
function readStored(): Partial<Stored> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? (v as Partial<Stored>) : {};
  } catch {
    return {};
  }
}
function writeStored(v: Stored): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    /* remembering the spot is a convenience, never a requirement */
  }
}

/** Keep the whole toolbox on screen. Runs on every drag step, on resize, and after folding —
 *  folding makes it shorter, and a box parked against the bottom would otherwise leave a gap, but
 *  UNfolding makes it taller, which is the case that would push its tools off the screen. */
function onScreen(p: Spot, el: HTMLElement): Spot {
  const maxX = Math.max(EDGE, window.innerWidth - el.offsetWidth - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - el.offsetHeight - EDGE);
  return {
    x: Math.min(Math.max(p.x, EDGE), maxX),
    y: Math.min(Math.max(p.y, EDGE), maxY),
  };
}

/** Where it opens the first time: in the margin to the LEFT of the score card, so it covers no
 *  music on a wide window. On a narrow one there is no margin to hide in and `onScreen` pins it to
 *  the left edge, where it overlaps the card's padding and the clef — never a notehead. */
function defaultSpot(el: HTMLElement): Spot {
  const card = document.querySelector(".kv-card");
  const left = card ? card.getBoundingClientRect().left : window.innerWidth;
  return onScreen({ x: left - el.offsetWidth - EDGE, y: DEFAULT_TOP }, el);
}

export function EditPalette({
  armed,
  onArm,
  canPlay,
  playState,
  fromMeasure,
  anchored,
  repeatAnchor,
  refused,
  onPlay,
  onStop,
}: {
  armed: Tool | null;
  onArm: (t: Tool | null) => void;
  canPlay: boolean;
  playState: "stopped" | "playing" | "paused";
  /** The bar Çal starts from, or null before anything has been edited (→ the top of the piece). */
  fromMeasure: number | null;
  /** Tuplet tool only: the first note of the run has been picked and the end is awaited. Changes
   *  nothing but the hint — the sheet owns the gesture. */
  anchored: boolean;
  /** Repeat tool only: the bar its `‖:` has been put on, with the closing barline still awaited.
   *  Like `anchored`, this changes nothing but the hint — the sheet owns the gesture. */
  repeatAnchor: number | null;
  /** Why the LAST sign placement was rejected, or null. Owned by App, because the rejection comes
   *  from re-resolving the page and this component knows nothing about structure. */
  refused: RefusalReason | null;
  onPlay: () => void;
  onStop: () => void;
}) {
  const boxRef = useRef<HTMLElement | null>(null);
  // `null` means "not placed yet" — the first layout pass measures the box and picks the spot, so
  // the toolbox is never painted at 0,0 before jumping to where it belongs.
  const [spot, setSpot] = useState<Spot | null>(null);
  const [folded, setFolded] = useState(() => readStored().folded === true);

  // Esc disarms. Bound while the palette is mounted, i.e. only in edit mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onArm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onArm]);

  // Place it before the browser paints: `useLayoutEffect`, not `useEffect`, or the toolbox is
  // visibly drawn in the wrong place for one frame every time edit mode opens.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const saved = readStored();
    setSpot(
      typeof saved.x === "number" && typeof saved.y === "number"
        ? onScreen({ x: saved.x, y: saved.y }, el)
        : defaultSpot(el),
    );
  }, []);

  // Folding changes the height, so the parked spot has to be re-checked against the screen.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setSpot((p) => (p ? onScreen(p, el) : p));
  }, [folded]);

  // A window the user shrinks must not take the toolbox with it.
  useEffect(() => {
    const onResize = () => {
      const el = boxRef.current;
      if (el) setSpot((p) => (p ? onScreen(p, el) : p));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (spot) writeStored({ x: spot.x, y: spot.y, folded });
  }, [spot, folded]);

  // Dragging by the title bar. Pointer CAPTURE is what makes this survive a fast drag: without it
  // the pointer leaves the bar between two frames and the box is dropped mid-move.
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    // The fold button lives in the bar; a click on it is a click, not the start of a drag.
    if ((e.target as HTMLElement).closest("button")) return;
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault(); // no text selection while dragging
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const g = grab.current;
    const el = boxRef.current;
    if (!g || !el) return;
    setSpot(onScreen({ x: e.clientX - g.dx, y: e.clientY - g.dy }, el));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!grab.current) return;
    grab.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const armedId = armed ? toolId(armed) : null;

  /** The shell every tool button shares — `data-tool` + `aria-pressed` are what the deploy checks
   *  read, so a glyph button and a drawn one are indistinguishable to them. */
  const button = (t: Tool, title: string, body: React.ReactNode, wide = false) => {
    const id = toolId(t);
    const on = id === armedId;
    return (
      <button
        key={id}
        type="button"
        data-tool={id}
        aria-pressed={on}
        title={title}
        className={`kv-tool${wide ? " kv-tool--wide" : ""}${on ? " is-armed" : ""}`}
        // Toggle: clicking the armed tool disarms it, so there is always a way back to selection.
        onClick={() => onArm(on ? null : t)}
      >
        {body}
      </button>
    );
  };

  const tool = (t: Tool, cp: number, title: string, fontSize: number) =>
    button(t, title, (
      <span className="kv-glyph" style={inkCentred(cp, fontSize)}>{String.fromCodePoint(cp)}</span>
    ));

  /** A sign whose ink is not a font glyph: the printed words "D.C." / "Son". ⚠ Deliberately NOT
   *  `.kv-glyph` — that class means Bravura, and `smoke:editor`'s ink-inside-the-button check
   *  measures against the music font. */
  const textSign = (mark: SignTool, label: string, title: string) =>
    button({ kind: "structure", mark }, title, <span className="kv-tool__text">{label}</span>);

  return (
    <aside
      ref={boxRef}
      id="edit-palette"
      data-armed={armedId ?? undefined}
      data-play-from={fromMeasure ?? undefined}
      data-collapsed={folded ? "1" : "0"}
      className={`kv-toolbox${folded ? " is-folded" : ""}`}
      // ⚠ Left/top, never a transform: the box floats over the score card, and a transformed
      // ancestor would turn `position: fixed` inside it into "fixed to this box" for anything
      // that ever lands here. `visibility` (not `display`) hides the unplaced first frame, so the
      // box is still measurable — `defaultSpot` needs its width before it can be placed.
      style={{ left: spot?.x ?? 0, top: spot?.y ?? 0, visibility: spot ? "visible" : "hidden" }}
    >
      <header
        className="kv-toolbox__bar"
        title={TR.palette.dragTitle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="kv-toolbox__grip" aria-hidden="true">⠿</span>
        <span className="kv-toolbox__title">{TR.palette.title}</span>
        <button
          id="palette-fold"
          type="button"
          data-collapsed={folded ? "1" : "0"}
          aria-expanded={!folded}
          className="kv-toolbox__fold"
          title={folded ? TR.palette.expand : TR.palette.collapse}
          onClick={() => setFolded((v) => !v)}
        >
          {folded ? "▢" : "—"}
        </button>
      </header>

      {/* Folded is folded: the tools are UNMOUNTED, not hidden, so nothing under a folded toolbox
          can be clicked by accident and no check can arm a tool it cannot see. */}
      {!folded && (
      <div className="kv-toolbox__body">
      {/* Çal starts at the last edited bar (the top of the piece before any edit), and pressing it
          again while playing replays that same bar. Pause/resume is not duplicated here — the
          transport above is still on screen in edit mode (owner, 2026-08-08). */}
      <div className="kv-toolbox__group">
        <span className="kv-toolbox__label">{TR.palette.playback}</span>
        <div className="kv-toolbox__transport">
          <button
            id="palette-play"
            type="button"
            data-play-state={playState}
            className="kv-btn kv-btn--primary"
            onClick={onPlay}
            disabled={!canPlay}
            title={fromMeasure == null ? TR.palette.playFromTopTitle : TR.palette.playFromTitle(fromMeasure)}
          >
            {TR.palette.play}
          </button>
          <button
            id="palette-stop"
            type="button"
            className="kv-btn"
            onClick={onStop}
            disabled={playState === "stopped"}
            title={TR.palette.stopTitle}
          >
            {TR.palette.stop}
          </button>
        </div>
      </div>

      <div className="kv-toolbox__group">
        <span className="kv-toolbox__label">{TR.palette.durations}</span>
        <div className="kv-toolbox__row">
          {DURATIONS.map((d) =>
            tool({ kind: "duration", num: d.num, den: d.den }, d.cp, TR.palette.durationTitle(`${d.num}/${d.den}`), 26),
          )}
        </div>
      </div>

      {/* Rests, mirroring the note values above. Same tool, `rest: true` — arm one and click blank
          staff to put a rest there, or click a note to turn it into one. */}
      <div className="kv-toolbox__group">
        <span className="kv-toolbox__label">{TR.palette.rests}</span>
        <div className="kv-toolbox__row">
          {DURATIONS.map((d) =>
            tool(
              { kind: "duration", num: d.num, den: d.den, rest: true },
              d.rest,
              TR.palette.restTitle(`${d.num}/${d.den}`),
              26,
            ),
          )}
        </div>
      </div>

      {/* Every alteration the editor can store, each with its own Bravura sign — including the
          numbered ±2/±3, which used to be reachable only from the deleted measure modal. */}
      <div className="kv-toolbox__group">
        <span className="kv-toolbox__label">{TR.palette.accidentals}</span>
        <div className="kv-toolbox__row">
          {ACCIDENTAL_VALUES.map((a) =>
            tool({ kind: "accidental", alter: a }, accidentalCp(a), TR.palette.accidentalTitle(accidentalLongLabel(a)), 24),
          )}
        </div>
      </div>

      {/* One tool, both directions (owner, 2026-08-08): click a note then the note two on to make
          a triplet, or click any member of one to take it apart again. */}
      <div className="kv-toolbox__group">
        <span className="kv-toolbox__label">{TR.palette.tuplets}</span>
        <div className="kv-toolbox__row">
          {tool({ kind: "tuplet" }, TUPLET_CP, TR.palette.tupletTitle, 24)}
        </div>
      </div>

      {/* The SIGNS (owner, 2026-09-03). These do not touch a note: armed, a click anywhere in a bar
          puts the sign on that bar, and a click on a drawn sign in Seçim takes it away again.
          ⚠ A placement can be REFUSED — the page is re-resolved and rejected if the sign would draw
          one thing and sound another (`structure-edit.ts`); the hint below says which. */}
      <div className="kv-toolbox__group">
        <span className="kv-toolbox__label">{TR.palette.repeats}</span>
        <div className="kv-toolbox__row">
          {/* ⭐ ONE tool for the whole repeat (owner, 2026-09-03), not a `‖:` and a `:‖` to be
              matched up by hand: arm it, click the barline it OPENS on, then the one it CLOSES on.
              The button shows `repeatRightLeft`, the both-ways sign — the only glyph that says
              "a repeat" rather than one of its two ends. */}
          {tool({ kind: "structure", mark: "repeat" }, SIGN_CP.repeat, TR.palette.repeatTitle, 24)}
          {/* The volta has no SMuFL glyph, so the button draws the bracket the sheet draws. */}
          {button({ kind: "structure", mark: "volta" }, TR.palette.voltaTitle, (
            <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true" focusable="false">
              <path d="M 2 15 V 3 H 24 V 15" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <text x="4.5" y="14" fontFamily="Georgia, 'Times New Roman', serif" fontSize="9" fill="currentColor">1.</text>
            </svg>
          ))}
        </div>
      </div>

      <div className="kv-toolbox__group">
        <span className="kv-toolbox__label">{TR.palette.navigation}</span>
        <div className="kv-toolbox__row">
          {tool({ kind: "structure", mark: "segno" }, SIGN_CP.segno, TR.palette.segnoTitle, 22)}
          {tool({ kind: "structure", mark: "coda" }, SIGN_CP.coda, TR.palette.codaTitle, 22)}
          {textSign("dc", TR.palette.dc, TR.palette.dcTitle)}
          {textSign("fine", TR.palette.fine, TR.palette.fineTitle)}
        </div>
      </div>

      <button
        id="palette-select"
        type="button"
        data-tool="none"
        aria-pressed={armed === null}
        className={`kv-tool kv-tool--wide${armed === null ? " is-armed" : ""}`}
        title={TR.palette.selectTitle}
        onClick={() => onArm(null)}
      >
        {TR.palette.select}
      </button>

      {/* The hint splits by KIND, because the tools do different things off a note: a note value
          also inserts on empty staff (step 6), an accidental has nothing to attach to, and the
          tuplet is the only two-click gesture — so it says which click is next. */}
      {/* ⚠ A REFUSAL wins the hint. It is the only feedback a rejected placement gives — the sheet
          cannot show a sign that was not placed — so it has to say why, in words, right where the
          user just clicked. It clears the moment another tool is armed (see `App.armTool`). */}
      <p className="kv-toolbox__hint" data-refused={refused ?? undefined}>
        {refused
          ? (TR.palette.refused as Record<RefusalReason, string>)[refused]
          : armed == null
          ? TR.palette.hintIdle
          : armed.kind === "duration"
            ? armed.rest
              ? TR.palette.hintArmedRest
              : TR.palette.hintArmedDuration
            : armed.kind === "accidental"
              ? TR.palette.hintArmedAccidental
              : armed.kind === "structure"
                ? armed.mark !== "repeat"
                  ? TR.palette.hintArmedSign
                  : repeatAnchor == null
                    ? TR.palette.hintRepeatStart
                    : TR.palette.hintRepeatEnd(repeatAnchor)
                : anchored
                  ? TR.palette.hintTupletEnd
                  : TR.palette.hintTupletStart}
      </p>
      </div>
      )}
    </aside>
  );
}
