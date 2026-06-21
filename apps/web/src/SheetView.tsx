import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Accidental, Dot, Formatter, Renderer, Stave, StaveNote } from "vexflow";
import {
  accidentalGlyph,
  accidentalLabel,
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

/** Build the VexFlow StaveNotes for one measure (parallel `evs` keeps the source event). */
function buildStaveNotes(measure: Measure): { notes: StaveNote[]; evs: NoteEvent[] } {
  const notes: StaveNote[] = [];
  const evs: NoteEvent[] = [];
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
    if (parsed.alterCommas !== 0) {
      const g = accidentalGlyph(parsed.alterCommas);
      // Pass the SMuFL glyph CHARACTER as the accidental type: VexFlow renders unknown codes
      // verbatim in the (Bravura) music font, so every Turkish koma/bakiye/mücennep glyph
      // works and VexFlow still reserves horizontal space for it.
      if (g) n.addModifier(new Accidental(String.fromCodePoint(g.codepoint)), 0);
    }
    for (let i = 0; i < dots; i++) Dot.buildAndAttach([n], { all: true });
    notes.push(n);
    evs.push(ev);
  }
  return { notes, evs };
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
  playing,
  getPositionMs,
  onMeasureClick,
  onSeekToMeasure,
}: {
  doc: NoteModelDocument;
  editMode: boolean;
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

  // Draw the score with VexFlow whenever the document changes. (Edit mode only toggles the
  // HTML overlay below, so it deliberately isn't a dependency — no need to re-engrave.)
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = ""; // clear any previous render (also handles React 18 double-invoke)

    // Pack measures into rows (greedy wrap). The first stave of each row pays for the clef.
    const measures = groupMeasures(doc);
    type Cell = { m: Measure; width: number; firstInRow: boolean };
    const rows: Cell[][] = [];
    let cur: Cell[] = [];
    let used = 0;
    for (const m of measures) {
      const base = Math.max(130, Math.min(420, m.events.length * 28 + 24));
      const isFirst = cur.length === 0;
      const width = base + (isFirst ? CLEF_W : 0);
      if (!isFirst && used + width > CONTENT_WIDTH) {
        rows.push(cur);
        cur = [{ m, width: base + CLEF_W, firstInRow: true }];
        used = base + CLEF_W;
      } else {
        cur.push({ m, width, firstInRow: isFirst });
        used += width;
      }
    }
    if (cur.length) rows.push(cur);

    const height = rows.length * ROW_HEIGHT + 20;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(SVG_WIDTH, height);
    const ctx = renderer.getContext();

    const collected: MeasureBox[] = [];
    const positions: NotePos[] = [];
    let tMs = 0; // running playback clock, matches buildTimeline's accumulation order
    rows.forEach((cells, r) => {
      const y = STAVE_TOP_PAD + r * ROW_HEIGHT;
      let x = LEFT;
      for (const cell of cells) {
        const stave = new Stave(x, y, cell.width);
        if (cell.firstInRow) stave.addClef("treble");
        stave.setContext(ctx).draw();
        // Playhead extent for this row, from the actual staff-line positions (the Stave's y
        // param is its bounding-box top, which sits well above the first staff line).
        const barTop = stave.getYForLine(0) - CURSOR_MARGIN;
        const barHeight = stave.getYForLine(4) - stave.getYForLine(0) + 2 * CURSOR_MARGIN;
        try {
          const { notes, evs } = buildStaveNotes(cell.m);
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
  }, [doc]);

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
