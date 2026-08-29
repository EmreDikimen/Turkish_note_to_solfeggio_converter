import { useEffect, useMemo, useRef } from "react";
import {
  CLARINET_FINGERINGS,
  LIP_REACH_KOMA,
  assignClarinet,
  parseNoteName,
  type ClarinetKeyId,
  type NoteModelDocument,
  type Timeline,
} from "@turkish-omr/core";
import {
  BACK_INSET,
  HOLES,
  IMAGE,
  LIP_BAR,
  MARKERS,
  VIEW_H,
  VIEW_W,
  VIEW_X,
} from "./ui/clarinetArt";
import { TR } from "./ui/strings";

/**
 * The sol klarnet view (feature F3, third instrument) — which holes are covered, and how far the
 * lip has to relax, as the piece plays.
 *
 * ⚠ **It is neither of the other two views with a different picture, and all three differ for
 * reasons in the instruments.** A violin position is a formula and needs a marker on an exact pixel
 * of a photograph. A kanun mandal **stays where it is put**, so that view is a state machine over
 * the whole piece. A clarinet fingering is a **lookup that is released the moment the note ends** —
 * so this view, like the violin's, draws the current frame from the current note and nothing else,
 * but what it draws is a *set of keys*, not a position.
 *
 * ⭐ **THE LIP BAR IS THE POINT OF THIS VIEW** (owner, 2026-08-29). A printed fingering chart holds
 * twelve notes to the octave and makam music does not live on twelve, which is why winds sat parked
 * as design for two weeks. The answer is that a clarinettist reaches a koma by **relaxing the lip**:
 * the schematic shows the nearest standard fingering, and the bar shows how far down to bend from
 * it. Neither half snaps a microtone onto the twelve-tone grid.
 *
 * How it's organized:
 *   * `packages/core/src/clarinet.ts` owns the fingerings, the lip reach and the matcher.
 *   * `ui/clarinetArt.ts` owns every pixel — our own drawing, of an ALBERT-system instrument.
 *   * this file owns the drawing and the clock, and nothing else.
 *
 * ⚠ **ONE CLOCK.** The animation is driven by `getPositionMs()` — the audio clock the sheet's
 * playhead already follows — so it cannot drift from the sound. Never add a second timing source.
 *
 * ⚠ **THE PITCHES COME FROM THE DOCUMENT, NOT FROM `timeline.freqHz`** — the same choice `Kanun.tsx`
 * makes and the opposite of `Fingerboard.tsx`, for the same reason. A fingering is named for the
 * note **on the page**: the owner reads Turkish notation and plays the fingering of that name, the
 * G instrument's transposition and the notation's fourth cancelling out. Under the ahenk transpose
 * every `freqHz` moves while the page does not, and a player's fingers would not. The makam's
 * deltas ARE added, because those are exactly what the lip bends.
 */

/** How the bar reports a bend that is not a bend at all. */
const NO_BEND = "0.00";

export function Clarinet({
  doc,
  timeline,
  makamDeltas,
  playing,
  getPositionMs,
}: {
  doc: NoteModelDocument;
  timeline: Timeline;
  makamDeltas: ReadonlyMap<number, number>;
  playing: boolean;
  getPositionMs: () => number | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const keyRefs = useRef(new Map<ClarinetKeyId, SVGElement>());
  const lipRef = useRef<SVGRectElement>(null);
  const labelRef = useRef<SVGTextElement>(null);

  // The whole piece is resolved once. Unlike the kanun there is no state to carry — a fingering is
  // released when its note ends — so this is a plain map, and it is done up front only to keep the
  // animation frame free of allocation.
  const positions = useMemo(() => {
    const byIndex = new Map(doc.events.map((ev) => [ev.index, ev]));
    const komas = timeline.notes.map((n) => {
      const ev = byIndex.get(n.index);
      if (!ev || n.isRest || !parseNoteName(ev.noteAE)) return Number.NaN;
      return ev.koma53 + (makamDeltas.get(ev.index) ?? 0);
    });
    return assignClarinet(komas);
  }, [doc, timeline, makamDeltas]);

  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  useEffect(() => {
    const root = rootRef.current;
    const lip = lipRef.current;
    const label = labelRef.current;
    if (!root || !lip || !label) return;

    const setKeys = (down: ReadonlySet<ClarinetKeyId> | null) => {
      for (const [id, el] of keyRefs.current) {
        el.setAttribute("data-key-state", down?.has(id) ? "down" : "up");
      }
    };

    const idle = (state: string) => {
      root.setAttribute("data-note-state", state);
      root.setAttribute("data-bend", NO_BEND);
      setKeys(null);
      lip.setAttribute("height", "0");
      lip.setAttribute("data-bend-koma", NO_BEND);
      label.textContent = "";
    };

    if (!playing) {
      idle("idle");
      return;
    }

    let raf = 0;
    const tick = () => {
      const pos = getPositionMs();
      const notes = timelineRef.current.notes;
      if (pos != null && pos >= 0 && notes.length > 0) {
        // First event whose end is still ahead of the clock is the one sounding now — the same rule
        // the sheet's playhead and the other two instrument views use, so none of them can disagree
        // about "now".
        let i = notes.findIndex((n) => pos < n.startMs + n.durationMs);
        if (i < 0) i = notes.length - 1;
        const at = positionsRef.current[i] ?? null;

        if (at) {
          const fing = CLARINET_FINGERINGS[at.fingeringIndex]!;
          setKeys(new Set(fing.keys));
          const bend = at.bendKoma.toFixed(2);
          root.setAttribute("data-note-state", "playing");
          root.setAttribute("data-bend", bend);
          // ⚠ The bar grows DOWNWARD from the top of its track, because relaxing the lip lowers the
          // pitch. Every other pitch in this app runs up the page, so a bend that grew upward would
          // read as the opposite of what it is.
          lip.setAttribute(
            "height",
            ((Math.min(at.bendKoma, LIP_REACH_KOMA) / LIP_REACH_KOMA) * LIP_BAR.h).toFixed(2),
          );
          lip.setAttribute("data-bend-koma", bend);
          label.textContent = fing.label;
        } else {
          // ⚠ Nothing is drawn, and the two reasons are told apart rather than merged: a rest is
          // silence, an out-of-range note is a real note this clarinet cannot play. Showing a
          // fingering for the second would be a lie about the music, which is the one thing an
          // instrument view may not do.
          idle(notes[i]!.isRest ? "rest" : "out-of-range");
        }
      } else {
        idle("idle");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getPositionMs]);

  return (
    <div
      id="clarinet"
      className="kv-clarinet"
      ref={rootRef}
      data-omr="clarinet"
      data-system="albert"
      data-holes={HOLES.length}
      data-keys={MARKERS.length}
      data-lip-reach={LIP_REACH_KOMA}
      data-note-state="idle"
      data-bend={NO_BEND}
    >
      <svg
        className="kv-clarinet__svg"
        viewBox={`${VIEW_X} 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={TR.instrument.hintClarinetAlt}
      >
        {/* --- the lip meter, down the left margin ------------------------------------------- */}
        <g data-omr="clarinet-lip-track">
          <rect
            x={LIP_BAR.x}
            y={LIP_BAR.y}
            width={LIP_BAR.w}
            height={LIP_BAR.h}
            rx={LIP_BAR.w / 2}
            className="kv-clarinet__lip-track"
          />
          <rect
            ref={lipRef}
            x={LIP_BAR.x}
            y={LIP_BAR.y}
            width={LIP_BAR.w}
            height={0}
            rx={LIP_BAR.w / 2}
            className="kv-clarinet__lip-fill"
            data-omr="clarinet-lip"
            data-bend-koma={NO_BEND}
          />
          {/* One tick per koma of reach, so the bar is readable as a quantity and not just a blob. */}
          {Array.from({ length: LIP_REACH_KOMA }, (_, k) => (
            <line
              key={k}
              x1={LIP_BAR.x}
              x2={LIP_BAR.x + LIP_BAR.w}
              y1={LIP_BAR.y + ((k + 1) / LIP_REACH_KOMA) * LIP_BAR.h}
              y2={LIP_BAR.y + ((k + 1) / LIP_REACH_KOMA) * LIP_BAR.h}
              className="kv-clarinet__lip-tick"
              data-omr="clarinet-lip-tick"
              data-koma={k + 1}
            />
          ))}
        </g>

        {/* --- the instrument, photographed --------------------------------------------------
            ⚠ An <image>, not an <img> beside the SVG: the markers have to sit in the same
            coordinate space as the photo or they drift the moment the card is resized. The
            viewBox IS the photo's pixel grid, which is what makes every number in clarinetArt.ts
            re-measurable against the file itself. */}
        <image href={IMAGE.src} x={0} y={0} width={IMAGE.w} height={IMAGE.h} />

        {/* The thumb hole and register key live on the BACK of the instrument, so no front photo
            can show them. Drawn beside it, the way every printed clarinet chart does. */}
        <g data-omr="clarinet-back">
          <line
            x1={BACK_INSET[0]!.cx}
            y1={BACK_INSET[0]!.cy - 26}
            x2={BACK_INSET[1]!.cx}
            y2={BACK_INSET[1]!.cy + 26}
            className="kv-clarinet__back-stem"
          />
          <text
            x={BACK_INSET[1]!.cx}
            y={BACK_INSET[1]!.cy + 44}
            textAnchor="middle"
            className="kv-clarinet__back-label"
          >
            {TR.instrument.clarinetBack}
          </text>
        </g>

        {MARKERS.map((m) => (
          <circle
            key={m.id}
            ref={(el) => {
              if (el) keyRefs.current.set(m.id, el);
            }}
            cx={m.cx}
            cy={m.cy}
            r={m.r}
            className="kv-clarinet__marker"
            data-omr="clarinet-key"
            data-key={m.id}
            data-key-kind={m.id === "thumb" || m.r >= 18 ? "hole" : "key"}
            data-source={m.source}
            data-key-state="up"
          />
        ))}

        {/* The note the fingering is for. Text, because a fingering has a name and the name is the
            quickest way for a player to check the picture against the page. */}
        <text
          ref={labelRef}
          x={VIEW_X + 8}
          y={44}
          textAnchor="start"
          className="kv-clarinet__label"
          data-omr="clarinet-note"
        />
      </svg>
    </div>
  );
}
