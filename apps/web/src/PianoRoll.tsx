import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildTimeline, type NoteModelDocument } from "@turkish-omr/core";
import type { NoteEdit } from "./App";

const HEIGHT = 360;
const PAD = 24;
const PX_PER_SECOND = 90;
const NOTE_H = 8; // drawn bar thickness
const GRAB_Y = 9; // how close (px) vertically you must be to grab a note
const EDGE_PX = 6; // width of the right-edge "resize" zone
const MIN_DURATION_MS = 40;

/** Stable vertical range for the roll (set once per loaded score by App). */
export interface PitchRange {
  minKoma: number;
  maxKoma: number;
}

interface Hover {
  x: number;
  y: number;
  label: string;
}

// A drag in progress. `mode` decides what the motion changes; `startMs` is the dragged
// note's fixed start time (depends only on earlier notes, so it's safe to cache here).
type Drag = { index: number; mode: "pitch" | "duration"; startMs: number } | null;

/**
 * Piano-roll view + editor: x = time, y = pitch (53-TET comma). Each note is a bar; rests
 * are gaps. Drag a bar up/down to change pitch; drag its right edge to change duration.
 *
 * What/why: a piano-roll is the natural surface for correcting OMR mistakes (the user's
 * goal). We draw on a `<canvas>` (fast for many notes) and do our own hit-testing, because
 * canvas has no clickable note objects. Edits don't mutate here — we call `onEditNote` and
 * let App rebuild the document (single source of truth), which re-renders us.
 * How it's organized:
 *   * `xOf`/`yOf` (+ inverse `yToKoma`) map between musical values and pixels.
 *   * `noteRects` precomputes each note's on-screen rectangle (used by draw AND hit-test).
 *   * pointer handlers implement hover, cursor feedback, and dragging.
 */
export function PianoRoll({
  doc,
  pitchRange,
  onEditNote,
}: {
  doc: NoteModelDocument;
  pitchRange: PitchRange;
  onEditNote: (index: number, patch: NoteEdit) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const drag = useRef<Drag>(null);

  const timeline = buildTimeline(doc);
  const notes = doc.events.filter((e) => e.kind === "note");
  const { minKoma, maxKoma } = pitchRange;
  const width = Math.max(800, Math.ceil((timeline.totalMs / 1000) * PX_PER_SECOND) + PAD * 2);

  // Map a time (ms) to a horizontal pixel position; later notes sit further right.
  const xOf = (ms: number) => PAD + (ms / 1000) * PX_PER_SECOND;
  // Map a pitch (comma) to a vertical pixel; flipped because canvas y grows downward.
  const yOf = (koma: number) =>
    PAD + (1 - (koma - minKoma) / (maxKoma - minKoma)) * (HEIGHT - PAD * 2);
  // Inverse of yOf: a pixel y back to a (fractional) comma. Used while dragging pitch.
  const yToKoma = (y: number) =>
    minKoma + (1 - (y - PAD) / (HEIGHT - PAD * 2)) * (maxKoma - minKoma);

  // Precompute each note's rectangle once. Recomputed every render (cheap), so it always
  // reflects the latest edited doc. Shared by drawing and hit-testing so they never disagree.
  const noteRects = useMemo(
    () =>
      timeline.notes
        .filter((sn) => !sn.isRest)
        .map((sn) => {
          const ev = notes.find((n) => n.index === sn.index)!;
          return {
            sn,
            ev,
            x: xOf(sn.startMs),
            w: Math.max(2, (sn.durationMs / 1000) * PX_PER_SECOND - 1),
            yCenter: yOf(ev.koma53),
          };
        }),
    [doc, minKoma, maxKoma],
  );

  // Hit-test: which note (if any) is under the cursor, and is the cursor on its right edge?
  function hitTest(mx: number, my: number) {
    let best: (typeof noteRects)[number] | null = null;
    let bestDy = GRAB_Y;
    for (const r of noteRects) {
      if (mx < r.x || mx > r.x + r.w + EDGE_PX) continue;
      const dy = Math.abs(my - r.yCenter);
      if (dy < bestDy) {
        bestDy = dy;
        best = r;
      }
    }
    if (!best) return null;
    const nearRightEdge = best.w >= 10 && Math.abs(mx - (best.x + best.w)) <= EDGE_PX;
    return { rect: best, nearRightEdge };
  }

  // Draw the roll. Redraws whenever the doc, size, range, or the active (dragged) note change.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${HEIGHT}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, width, HEIGHT);

    // faint gridline + name label for each distinct pitch currently used
    ctx.strokeStyle = "#eee";
    ctx.fillStyle = "#bbb";
    ctx.font = "10px system-ui";
    const seen = new Set<number>();
    for (const n of notes) {
      if (seen.has(n.koma53)) continue;
      seen.add(n.koma53);
      const y = yOf(n.koma53);
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(width - PAD, y);
      ctx.stroke();
      ctx.fillText(n.noteName, 2, y + 3);
    }

    // note bars (the one being dragged is highlighted)
    for (const r of noteRects) {
      ctx.fillStyle = r.ev.index === activeIndex ? "#f59e0b" : "#3b82f6";
      ctx.fillRect(r.x, r.yCenter - NOTE_H / 2, r.w, NOTE_H);
    }
  }, [doc, width, minKoma, maxKoma, activeIndex]);

  // Pointer down: decide whether we're starting a pitch-drag or a duration-resize.
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const { mx, my } = toLocal(e);
    const hit = hitTest(mx, my);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId); // keep receiving moves even off-canvas
    drag.current = {
      index: hit.rect.ev.index,
      mode: hit.nearRightEdge ? "duration" : "pitch",
      startMs: hit.rect.sn.startMs,
    };
    setActiveIndex(hit.rect.ev.index);
  }

  // Pointer move: if dragging, translate motion into an edit; otherwise update hover+cursor.
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const { mx, my } = toLocal(e);
    const d = drag.current;
    if (d) {
      if (d.mode === "pitch") {
        const koma = Math.max(minKoma, Math.min(maxKoma, Math.round(yToKoma(my))));
        onEditNote(d.index, { koma53: koma });
        setHover({ x: mx, y: my, label: `comma ${koma}` });
      } else {
        const durationMs = Math.max(MIN_DURATION_MS, Math.round(((mx - xOf(d.startMs)) * 1000) / PX_PER_SECOND));
        onEditNote(d.index, { durationMs });
        setHover({ x: mx, y: my, label: `${durationMs} ms` });
      }
      return;
    }
    // not dragging: hover tooltip + cursor affordance
    const hit = hitTest(mx, my);
    e.currentTarget.style.cursor = hit ? (hit.nearRightEdge ? "ew-resize" : "grab") : "default";
    if (hit) {
      const { ev, sn } = hit.rect;
      setHover({
        x: mx,
        y: my,
        label: `${ev.noteName} (${ev.noteAE}) · ${sn.freqHz.toFixed(1)} Hz · ${ev.durationMs} ms${ev.lyric ? ` · "${ev.lyric}"` : ""}`,
      });
    } else {
      setHover(null);
    }
  }

  function endDrag() {
    drag.current = null;
    setActiveIndex(null);
  }

  return (
    <div style={{ position: "relative", overflowX: "auto", border: "1px solid #ddd", borderRadius: 6 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseLeave={() => !drag.current && setHover(null)}
      />
      {hover && (
        <div
          style={{
            position: "absolute",
            left: hover.x + 12,
            top: hover.y + 12,
            background: "#111",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {hover.label}
        </div>
      )}
    </div>
  );
}

// Convert a pointer event to canvas-local pixel coordinates.
function toLocal(e: React.PointerEvent<HTMLCanvasElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
}
