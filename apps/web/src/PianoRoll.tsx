import { useLayoutEffect, useRef, useState } from "react";
import { buildTimeline, type NoteModelDocument } from "@turkish-omr/core";

const HEIGHT = 360;
const PAD = 24;
const PX_PER_SECOND = 90;

interface Hover {
  x: number;
  y: number;
  label: string;
}

/**
 * Minimal piano-roll view: x = time, y = pitch (53-TET comma). Each note is a blue bar;
 * rests are simply gaps. This will become the editing surface (drag a bar to change its
 * time/pitch) in the next increment.
 *
 * What/why: a piano-roll is the most natural way to *edit* time and pitch (the user's goal:
 * fix OMR mistakes), and far simpler than rendering true microtonal notation. We draw it on
 * an HTML `<canvas>` because we may have hundreds of notes — drawing each as a DOM element
 * would be slow; one canvas redraw is cheap.
 * How it's organized:
 *   * `xOf`/`yOf` map musical values → pixel coordinates (the heart of any roll).
 *   * a `useLayoutEffect` does the actual drawing whenever the score changes.
 *   * `onMove` does hit-testing for the hover tooltip.
 */
export function PianoRoll({ doc }: { doc: NoteModelDocument }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const timeline = buildTimeline(doc);
  const notes = doc.events.filter((e) => e.kind === "note");
  const komas = notes.map((n) => n.koma53);
  const minKoma = Math.min(...komas) - 1;
  const maxKoma = Math.max(...komas) + 1;
  const width = Math.max(800, Math.ceil((timeline.totalMs / 1000) * PX_PER_SECOND) + PAD * 2);

  // Map a time in milliseconds to a horizontal pixel position: later notes sit further
  // right. PX_PER_SECOND sets the zoom; PAD leaves a margin for the pitch labels.
  const xOf = (ms: number) => PAD + (ms / 1000) * PX_PER_SECOND;
  // Map a pitch (comma) to a vertical pixel position. Note the `1 - ...`: canvas y grows
  // DOWNWARD, but higher pitches should appear HIGHER, so we flip. We scale the piece's own
  // [minKoma, maxKoma] range to fill the height, so any register looks reasonable.
  const yOf = (koma: number) =>
    PAD + (1 - (koma - minKoma) / (maxKoma - minKoma)) * (HEIGHT - PAD * 2);

  // Draw the whole roll. Runs after render and whenever `doc`/`width` change.
  // What/why: canvas drawing is an imperative side-effect (it pokes pixels), which doesn't
  // belong in the JSX return; useLayoutEffect is the React hook for "do this against the
  // real DOM node right after it's on screen." We redraw from scratch each time — simplest
  // and plenty fast for this many notes.
  // How it works: (1) size the canvas for the screen's pixel density (`dpr`) so it's crisp
  // on retina displays; (2) paint the background; (3) draw a faint gridline + name label for
  // each distinct pitch used; (4) draw every note as a blue bar at xOf(start)/yOf(pitch).
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

    // horizontal gridlines per comma that an actual note uses
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

    // note blocks
    for (const sn of timeline.notes) {
      if (sn.isRest) continue;
      const ev = notes.find((n) => n.index === sn.index)!;
      const x = xOf(sn.startMs);
      const w = Math.max(2, (sn.durationMs / 1000) * PX_PER_SECOND - 1);
      const y = yOf(ev.koma53) - 4;
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x, y, w, 8);
    }
  }, [doc, width]);

  // Find which note (if any) the mouse is over, to show a tooltip ("hit-testing").
  // What/why: the canvas is just pixels — it has no clickable note objects like the DOM
  // would — so when the mouse moves we manually check the cursor against each note's
  // rectangle and pick the closest one vertically within the bar's time span. This same
  // hit-testing is what dragging-to-edit will build on next.
  // How it works: convert the mouse position to canvas coordinates, then loop notes; for any
  // whose x-span contains the cursor, keep the one whose y is nearest (within a threshold).
  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: Hover | null = null;
    let bestDist = 14;
    for (const sn of timeline.notes) {
      if (sn.isRest) continue;
      const ev = notes.find((n) => n.index === sn.index)!;
      const x = xOf(sn.startMs);
      const w = Math.max(2, (sn.durationMs / 1000) * PX_PER_SECOND - 1);
      const y = yOf(ev.koma53);
      if (mx >= x && mx <= x + w) {
        const d = Math.abs(my - y);
        if (d < bestDist) {
          bestDist = d;
          best = {
            x: mx,
            y: my,
            label: `${ev.noteName} (${ev.noteAE}) · ${sn.freqHz.toFixed(1)} Hz · ${ev.durationMs} ms${ev.lyric ? ` · "${ev.lyric}"` : ""}`,
          };
        }
      }
    }
    setHover(best);
  }

  return (
    <div style={{ position: "relative", overflowX: "auto", border: "1px solid #ddd", borderRadius: 6 }}>
      <canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {hover && (
        <div
          style={{
            position: "absolute",
            left: Math.min(hover.x + 12, 1),
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
