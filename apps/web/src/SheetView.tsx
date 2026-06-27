import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Accidental, Dot, Formatter, Renderer, Stave, StaveNote } from "vexflow";
import {
  accidentalGlyph,
  accidentalLabel,
  deriveKeySignature,
  deriveTimeSignature,
  eventBeats,
  groupMeasures,
  parseNoteName,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";

// --- layout constants -------------------------------------------------------
const LEFT = 10;
const CONTENT_WIDTH = 1000; // staff content area (rows wrap within this)
const ROW_HEIGHT = 130; // vertical pitch of each staff system
const STAVE_TOP_PAD = 40; // headroom above each stave for high notes / beams
const CLEF_W = 50; // extra width the leading clef costs on the first stave of a row
const SVG_WIDTH = LEFT * 2 + CONTENT_WIDTH;
const CURSOR_MARGIN = 8; // playhead bar extends this far above/below the staff lines
const SIG_GLYPH_ADVANCE = 13; // horizontal space each key-signature accidental occupies
// Staff line each signature accidental sits on (VexFlow treble: F5=line0, B4=line2, E4=line4),
// choosing an octave that keeps every letter on the staff.
const SIG_LINE: Record<string, number> = { C: 1.5, D: 1, E: 0.5, F: 0, G: 3, A: 2.5, B: 2 };

// VexFlow duration codes paired with their value as a fraction of a whole note.
const DUR: ReadonlyArray<readonly [string, number]> = [
  ["w", 1],
  ["h", 1 / 2],
  ["q", 1 / 4],
  ["8", 1 / 8],
  ["16", 1 / 16],
  ["32", 1 / 32],
  ["64", 1 / 64],
];

/**
 * Map a note-value (fraction of a whole note) to a VexFlow duration code + dot count.
 * SymbTr durations are exact base/dotted values (verified: the sample uses only 1/4, 1/8,
 * 1/16, 1/32 and the dotted 3/16, 3/32). We match the base value, then test for a single or
 * double augmentation dot (×1.5 / ×1.75). Anything unexpected (e.g. a tuplet fraction) falls
 * back to the nearest base value so the sheet still draws — playback uses durationMs anyway.
 */
function vexDuration(beats: number): { duration: string; dots: number } {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
  for (const [code, val] of DUR) {
    if (near(beats, val)) return { duration: code, dots: 0 };
    if (near(beats, val * 1.5)) return { duration: code, dots: 1 };
    if (near(beats, val * 1.75)) return { duration: code, dots: 2 };
  }
  let best = DUR[2]!; // default to a quarter
  for (const d of DUR) if (Math.abs(d[1] - beats) < Math.abs(best[1] - beats)) best = d;
  return { duration: best[0], dots: 0 };
}

/**
 * How accidentals are displayed on the staff:
 * - `"every"`   — draw every note's accidental inline (no suppression).
 * - `"keysig"`  — draw the makam key signature once per row and inline-mark only notes that
 *                 deviate from it (every deviating occurrence, no measure memory).
 * - `"measure"` — standard engraving: key signature at the row start PLUS the measure-scoped
 *                 carry rule — an accidental prints on the first note (per staff position) that
 *                 breaks the alteration in effect, then carries to later same-position notes in
 *                 the measure; a cancel (natural, or the signature's glyph) prints on return.
 *                 This matches how real note sheets are engraved.
 */
export type AccidentalMode = "every" | "keysig" | "measure";

/**
 * Build the VexFlow StaveNotes for one measure (parallel `evs` keeps the source event).
 * `signatureMap` is the makam key signature (alteration per letter); it's consulted in the
 * `"keysig"` and `"measure"` modes and ignored in `"every"`.
 */
function buildStaveNotes(
  measure: Measure,
  mode: AccidentalMode,
  signatureMap: Map<string, number>,
): { notes: StaveNote[]; evs: NoteEvent[] } {
  const notes: StaveNote[] = [];
  const evs: NoteEvent[] = [];
  // "measure" mode only: the alteration currently in effect for each staff position
  // (letter+octave) within THIS measure. Seeded lazily from the key signature; set by a printed
  // accidental and carried until it changes. It's local to one measure, so it naturally resets
  // at every barline — exactly the standard convention.
  const active = new Map<string, number>();

  for (const ev of measure.events) {
    const { duration, dots } = vexDuration(eventBeats(ev));
    const parsed = ev.kind === "note" ? parseNoteName(ev.noteName) : null;

    // Rests (and any unparseable note) render as a rest on the middle line.
    if (!parsed) {
      const r = new StaveNote({ keys: ["b/4"], duration: `${duration}r` });
      for (let i = 0; i < dots; i++) Dot.buildAndAttach([r], { all: true });
      notes.push(r);
      evs.push(ev);
      continue;
    }

    // Staff position comes from letter+octave only (Turkish accidentals don't shift the
    // line); octave numbering already matches VexFlow's scientific pitch (Do5 = c/5 = C5).
    const n = new StaveNote({ keys: [`${parsed.letter.toLowerCase()}/${parsed.octave}`], duration });
    const alter = parsed.alterCommas;

    if (mode === "every") {
      // Show every alteration inline.
      if (alter !== 0) addAccidental(n, alter);
    } else if (mode === "keysig") {
      // Mark only notes that deviate from the signature (each occurrence). A natural under an
      // altered signature needs an explicit natural sign; otherwise draw the note's glyph.
      const sigAlter = signatureMap.get(parsed.letter) ?? 0;
      if (alter !== sigAlter) {
        if (alter === 0) n.addModifier(new Accidental("n"), 0);
        else addAccidental(n, alter);
      }
    } else {
      // Standard measure-scoped carry. The alteration in effect for this position starts at the
      // key signature and updates whenever an accidental is printed. Print one only when the
      // note breaks the effect; then remember it for the rest of the measure.
      const posKey = `${parsed.letter}${parsed.octave}`;
      const sigAlter = signatureMap.get(parsed.letter) ?? 0;
      const effective = active.has(posKey) ? active.get(posKey)! : sigAlter;
      if (alter !== effective) {
        if (alter === 0) n.addModifier(new Accidental("n"), 0); // cancel back to natural
        else addAccidental(n, alter);
        active.set(posKey, alter);
      }
    }
    for (let i = 0; i < dots; i++) Dot.buildAndAttach([n], { all: true });
    notes.push(n);
    evs.push(ev);
  }
  return { notes, evs };
}

/**
 * Attach a Turkish accidental to a note. Pass the SMuFL glyph CHARACTER as the accidental type:
 * VexFlow renders unknown codes verbatim in the (Bravura) music font, so every koma/bakiye/
 * mücennep glyph works and VexFlow still reserves horizontal space for it.
 */
function addAccidental(n: StaveNote, alterCommas: number) {
  const g = accidentalGlyph(alterCommas);
  if (g) n.addModifier(new Accidental(String.fromCodePoint(g.codepoint)), 0);
}

/** After drawing, attach an SVG <title> to each note so hovering shows pitch/freq/duration. */
function attachTitles(notes: StaveNote[], evs: NoteEvent[]) {
  notes.forEach((n, i) => {
    const ev = evs[i]!;
    let el: SVGElement | undefined;
    try {
      el = n.getSVGElement() as SVGElement | undefined;
    } catch {
      el = undefined;
    }
    if (!el) return;
    const p = ev.kind === "note" ? parseNoteName(ev.noteName) : null;
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent =
      ev.kind === "rest" || !p
        ? `rest · ${ev.durationMs} ms`
        : `${ev.noteName} · ${(ev.freqHz ?? 0).toFixed(1)} Hz · ${ev.durationMs} ms` +
          (p.alterCommas !== 0 ? ` · ${accidentalLabel(p.alterCommas)}` : "");
    el.appendChild(title);
  });
}

/**
 * Draw the score's key signature into the gap reserved after the clef on one stave. Glyphs are
 * appended as Bravura <text> nodes (the same approach the per-note titles use) at the staff line
 * for each letter. `startX` is where the signature begins (just after the clef).
 */
function drawSignature(
  svg: SVGSVGElement,
  stave: Stave,
  signature: { letter: string; alterCommas: number }[],
  startX: number,
) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  signature.forEach((entry, i) => {
    const g = accidentalGlyph(entry.alterCommas);
    if (!g) return;
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(startX + i * SIG_GLYPH_ADVANCE));
    text.setAttribute("y", String(stave.getYForLine(SIG_LINE[entry.letter] ?? 2)));
    text.setAttribute("font-family", "Bravura");
    text.setAttribute("font-size", "36"); // Bravura glyphs are designed on a 4-space (≈40px) em
    text.setAttribute("dominant-baseline", "alphabetic");
    text.setAttribute("fill", "#222");
    text.textContent = String.fromCodePoint(g.codepoint);
    svg.appendChild(text);
  });
}

// SMuFL time-signature digits live at U+E080 (0) … U+E089 (9) in the music font.
const timeSigGlyphs = (n: number): string =>
  [...String(n)].map((d) => String.fromCodePoint(0xe080 + Number(d))).join("");

/**
 * Draw the meter (e.g. 9/8) as stacked Bravura digits centered on `centerX`: numerator in the
 * upper half of the staff, denominator in the lower half. Drawn ourselves (not via VexFlow's
 * `addTimeSignature`, which always sits right after the clef) so it can follow the key signature.
 */
function drawTimeSignature(svg: SVGSVGElement, stave: Stave, centerX: number, ts: { num: number; den: number }) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const space = stave.getYForLine(1) - stave.getYForLine(0); // px per staff space
  // Center the stack on the middle line, nudged up slightly: Bravura's digit baseline renders a
  // touch low, so this small lift makes the meter read vertically centered on the staff.
  const mid = stave.getYForLine(2) - space * 0.35;
  const digit = (value: number, y: number) => {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(centerX));
    text.setAttribute("y", String(y));
    text.setAttribute("font-family", "Bravura");
    text.setAttribute("font-size", "39"); // ~4-space em; each digit spans ~2 staff spaces
    text.setAttribute("text-anchor", "middle"); // auto-centers multi-digit numbers (e.g. "10")
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "#222");
    text.textContent = timeSigGlyphs(value);
    svg.appendChild(text);
  };
  digit(ts.num, mid - space); // numerator one space above the middle line
  digit(ts.den, mid + space); // denominator one space below the middle line
}

interface MeasureBox {
  index: number;
  measure: Measure;
  x: number;
  y: number;
  width: number;
}

/** Where a single timed event sits on screen, so the playhead can follow playback. */
interface NotePos {
  startMs: number;
  endMs: number;
  /** Left x of the note within the SVG (same coordinate space as the overlay). */
  x: number;
  /** Top y of the playhead bar for this note's row (just above the top staff line). */
  top: number;
  /** Height of the playhead bar (staff height plus a small margin each side). */
  height: number;
}

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
  playing,
  getPositionMs,
  onMeasureClick,
  onSeekToMeasure,
}: {
  doc: NoteModelDocument;
  editMode: boolean;
  /** How accidentals are displayed (see {@link AccidentalMode}). The key signature is drawn at
   *  each row start in `"keysig"` and `"measure"` modes. */
  accidentalMode: AccidentalMode;
  /** True while there's an active (playing or paused) position — drives the playhead. */
  playing: boolean;
  /** Current playback position in ms (from the audio backend), or null when stopped. */
  getPositionMs: () => number | null;
  /** Edit mode: open the editor for a measure. */
  onMeasureClick: (m: Measure) => void;
  /** Non-edit mode: seek/play from the clicked measure. */
  onSeekToMeasure: (m: Measure) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  // On-screen position of every timed event, in playback order. A ref (not state) because the
  // playhead animation reads it every frame and must not trigger re-renders.
  const positionsRef = useRef<NotePos[]>([]);
  const [boxes, setBoxes] = useState<MeasureBox[]>([]);
  const [svgHeight, setSvgHeight] = useState(ROW_HEIGHT + 20);
  const [hover, setHover] = useState<number | null>(null);

  // Distinct accidentals used, for the legend.
  const usedAccidentals = useMemo(() => {
    const set = new Set<number>();
    for (const ev of doc.events) {
      if (ev.kind !== "note") continue;
      const p = parseNoteName(ev.noteName);
      if (p && p.alterCommas !== 0) set.add(p.alterCommas);
    }
    return [...set].sort((a, b) => a - b);
  }, [doc]);

  // The score's derived key signature (prevailing accidental per letter), and a lookup map.
  const signature = useMemo(() => deriveKeySignature(doc), [doc]);
  const signatureMap = useMemo(() => new Map(signature.map((s) => [s.letter, s.alterCommas])), [signature]);

  // The usul meter (e.g. 9/8 for aksak), printed once at the start of the first staff.
  const timeSig = useMemo(() => deriveTimeSignature(doc), [doc]);

  // Draw the score with VexFlow whenever the document changes. (Edit mode only toggles the
  // HTML overlay below, so it deliberately isn't a dependency — no need to re-engrave.)
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = ""; // clear any previous render (also handles React 18 double-invoke)

    // The key signature is drawn whenever accidentals aren't shown on every note.
    const showSignature = accidentalMode !== "every";
    // Width the key signature needs after the clef on each row's first stave (0 when off).
    const sigWidth = showSignature && signature.length ? signature.length * SIG_GLYPH_ADVANCE + 10 : 0;
    // The clef + (optional) signature both repeat on the first stave of every row.
    const leadWidth = CLEF_W + sigWidth;
    // Extra room the meter (e.g. 9/8) needs — only on the very first stave of the piece.
    // Scales with the widest of numerator/denominator so multi-digit meters (10/8) still fit.
    const timeSigWidth = timeSig
      ? Math.max(String(timeSig.num).length, String(timeSig.den).length) * 16 + 10
      : 0;

    // Pack measures into rows (greedy wrap). The first stave of each row pays for the clef;
    // the very first measure additionally pays for the one-time time signature.
    const measures = groupMeasures(doc);
    type Cell = { m: Measure; width: number; firstInRow: boolean };
    const rows: Cell[][] = [];
    let cur: Cell[] = [];
    let used = 0;
    let firstMeasure = true;
    for (const m of measures) {
      const extra = firstMeasure ? timeSigWidth : 0;
      const base = Math.max(130, Math.min(420, m.events.length * 28 + 24));
      const isFirst = cur.length === 0;
      const width = base + (isFirst ? leadWidth : 0) + extra;
      if (!isFirst && used + width > CONTENT_WIDTH) {
        rows.push(cur);
        cur = [{ m, width: base + leadWidth, firstInRow: true }];
        used = base + leadWidth;
      } else {
        cur.push({ m, width, firstInRow: isFirst });
        used += width;
      }
      firstMeasure = false;
    }
    if (cur.length) rows.push(cur);

    const height = rows.length * ROW_HEIGHT + 20;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(SVG_WIDTH, height);
    const ctx = renderer.getContext();
    const svg = host.querySelector("svg") as SVGSVGElement | null;

    const collected: MeasureBox[] = [];
    const positions: NotePos[] = [];
    let tMs = 0; // running playback clock, matches buildTimeline's accumulation order
    rows.forEach((cells, r) => {
      const y = STAVE_TOP_PAD + r * ROW_HEIGHT;
      let x = LEFT;
      for (const cell of cells) {
        const stave = new Stave(x, y, cell.width);
        if (cell.firstInRow) stave.addClef("treble");
        // Lay out the leading symbols left→right: clef, then the makam key signature, then the
        // meter (clef → flats → 9/8, matching engraved Turkish scores). We draw the key sig and
        // meter as Bravura glyphs ourselves (VexFlow's native versions don't fit either case),
        // so we just reserve horizontal space here and remember each one's start x.
        const clefEnd = stave.getNoteStartX();
        const drawSig = showSignature && cell.firstInRow && signature.length > 0;
        const drawTime = r === 0 && cell.firstInRow && timeSig != null;
        const sigStartX = clefEnd;
        const timeStartX = clefEnd + (drawSig ? sigWidth : 0);
        const reserved = (drawSig ? sigWidth : 0) + (drawTime ? timeSigWidth : 0);
        if (reserved > 0) stave.setNoteStartX(clefEnd + reserved);
        stave.setContext(ctx).draw();
        // Playhead extent for this row, from the actual staff-line positions (the Stave's y
        // param is its bounding-box top, which sits well above the first staff line).
        const barTop = stave.getYForLine(0) - CURSOR_MARGIN;
        const barHeight = stave.getYForLine(4) - stave.getYForLine(0) + 2 * CURSOR_MARGIN;
        try {
          const { notes, evs } = buildStaveNotes(cell.m, accidentalMode, signatureMap);
          if (notes.length > 0) {
            Formatter.FormatAndDraw(ctx, stave, notes, { autoBeam: true, alignRests: true });
            attachTitles(notes, evs);
            // Record each event's drawn x + row so the playhead can follow it. getAbsoluteX is
            // only valid after FormatAndDraw has positioned the notes.
            notes.forEach((n, i) => {
              const ev = evs[i]!;
              positions.push({ startMs: tMs, endMs: tMs + ev.durationMs, x: n.getAbsoluteX(), top: barTop, height: barHeight });
              tMs += ev.durationMs;
            });
          }
          if (drawSig && svg) drawSignature(svg, stave, signature, sigStartX + 2);
          if (drawTime && svg && timeSig) drawTimeSignature(svg, stave, timeStartX + timeSigWidth / 2, timeSig);
        } catch (e) {
          console.warn(`sheet: failed to render measure ${cell.m.index}`, e);
        }
        collected.push({ index: cell.m.index, measure: cell.m, x, y, width: cell.width });
        x += cell.width;
      }
    });

    setSvgHeight(height);
    setBoxes(collected);
    positionsRef.current = positions;

    return () => {
      host.innerHTML = "";
    };
  }, [doc, accidentalMode, signature, signatureMap, timeSig]);

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
    let raf = 0;
    const tick = () => {
      const pos = getPositionMs();
      const ps = positionsRef.current;
      if (pos != null && pos >= 0 && ps.length > 0) {
        // First event whose end is still ahead of the clock is the one sounding now.
        const active = ps.find((p) => pos < p.endMs) ?? ps[ps.length - 1]!;
        cursor.style.display = "block";
        cursor.style.height = `${active.height}px`;
        cursor.style.transform = `translate(${active.x - 2}px, ${active.top}px)`;
      } else {
        cursor.style.display = "none";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getPositionMs]);

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

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, overflowX: "auto", background: "#fff" }}>
      <div
        ref={containerRef}
        style={{ position: "relative", width: SVG_WIDTH, height: svgHeight, cursor: editMode ? "default" : "pointer" }}
        onClick={editMode ? undefined : (e) => { const m = measureAt(e); if (m) onSeekToMeasure(m.measure); }}
        onMouseMove={editMode ? undefined : (e) => setHover(measureAt(e)?.index ?? null)}
        onMouseLeave={editMode ? undefined : () => setHover(null)}
      >
        <div ref={hostRef} />
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
                  background: "rgba(20,184,166,0.07)",
                  border: "1px solid rgba(20,184,166,0.5)",
                }}
              />
            );
          })()}
        {/* Playhead: a teal bar that tracks the currently-playing note (positioned via transform). */}
        <div
          ref={cursorRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 2.5,
            height: 0, // set per-row during playback (see the rAF loop)
            background: "#14b8a6",
            borderRadius: 2,
            boxShadow: "0 0 3px rgba(20,184,166,0.7)",
            pointerEvents: "none",
            display: "none",
            willChange: "transform",
          }}
        />
        {editMode && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {boxes.map((b) => (
              <div
                key={b.index}
                onMouseEnter={() => setHover(b.index)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onMeasureClick(b.measure)}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y - 30,
                  width: b.width,
                  height: ROW_HEIGHT - 16,
                  pointerEvents: "auto",
                  cursor: "pointer",
                  boxSizing: "border-box",
                  borderRadius: 4,
                  background: hover === b.index ? "rgba(59,130,246,0.08)" : "transparent",
                  border: hover === b.index ? "1px solid #3b82f6" : "1px solid transparent",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Legend used={usedAccidentals} />
    </div>
  );
}

function Legend({ used }: { used: number[] }) {
  if (used.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 12px", borderTop: "1px solid #eee", color: "#555", fontSize: 13 }}>
      <span style={{ color: "#999" }}>Accidentals:</span>
      {used.map((commas) => {
        const g = accidentalGlyph(commas);
        return (
          <span key={commas} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {g && <span style={{ fontFamily: "Bravura", fontSize: 22, lineHeight: 1 }}>{String.fromCodePoint(g.codepoint)}</span>}
            {accidentalLabel(commas)} ({commas > 0 ? `+${commas}` : commas} koma)
          </span>
        );
      })}
    </div>
  );
}
