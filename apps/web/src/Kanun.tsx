import { useEffect, useMemo, useRef, useState } from "react";
import {
  KANUN_COURSES,
  DEFAULT_MANDAL_LAYOUT,
  openingMandals,
  planMandals,
  naturalKoma,
  parseNoteName,
  spellNote,
  type KanunNoteInput,
  type NoteModelDocument,
  type Timeline,
} from "@turkish-omr/core";
import {
  BRIDGE_X,
  FULL_WINDOW,
  VIEW_H,
  bodyOutline,
  courseY,
  labelX,
  stringOffsets,
  mandalRect,
  mandalWindow,
  nutX,
} from "./ui/kanunGeometry";
import { TR } from "./ui/strings";

/**
 * The kanun tab (feature F3) — which course is plucked, and where the mandals stand, as the piece
 * plays.
 *
 * ⚠ **THIS IS NOT THE VIOLIN VIEW WITH A DIFFERENT PICTURE, AND THE DIFFERENCE IS THE WHOLE POINT.**
 * A violin position is a fact about one note: the finger goes there, the note ends, the finger
 * leaves. A mandal is a fact about the whole piece: it is a small lever that **stays where it is
 * put**. So this view cannot be drawn by looking up the current note — it has to carry the mandal
 * state along the piece, note by note, which is what `planMandals` in core does and what the loop
 * below replays.
 *
 * Two things follow that the violin has no version of:
 *
 * 1. **There is something to show before a note is played.** The opening setting — the mandals a
 *    player prepares for the makam, like tuning — is the picture this view starts on, and it is
 *    also listed in words above the instrument.
 * 2. **A change is an EVENT, not a state**, so it is drawn as a flash that fades (owner,
 *    2026-08-29). Which mandal is up is already readable from the filled box; red is reserved for
 *    *something just moved*.
 *
 * How it's organized:
 *   * `packages/core/src/kanun.ts` owns the courses, the mandals and the plan.
 *   * `ui/kanunGeometry.ts` owns every pixel.
 *   * this file owns the drawing and the clock, and nothing else.
 *
 * ⚠ **ONE CLOCK.** The animation is driven by `getPositionMs()` — the audio clock the sheet's
 * playhead already follows — so it cannot drift from the sound. Never add a second timing source.
 *
 * ⚠ **THE PITCHES COME FROM THE DOCUMENT, NOT FROM `timeline.freqHz`, AND THAT IS THE OPPOSITE OF
 * WHAT `Fingerboard.tsx` DOES.** It is not an inconsistency. A fingerboard cares only what a note
 * sounds; a kanun course is a WRITTEN note, and the two part company under the ahenk transpose:
 * with "keep the sheet" on, `App.tsx` shifts the tuning anchor instead of the notation, so every
 * `freqHz` moves while the page does not — and a kanun player transposing by ahenk retunes the
 * instrument and leaves the mandals exactly where the notation says. Reading the written koma is
 * therefore both simpler and more correct here. The makam's deltas are added on top, because those
 * DO move the mandals: that is the one bend a kanun expresses with a lever.
 */

/** How long a mandal change stays lit, at minimum, so a fast note is still visible. */
const MIN_FLASH_MS = 700;

/** Perde labels, in viewBox units at full zoom. Scaled by the window so they hold size on screen. */
const LABEL_SIZE = 13;

export function Kanun({
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
  const gridRef = useRef<SVGGElement>(null);
  const linesRef = useRef<SVGGElement>(null);

  const courses = KANUN_COURSES;
  const layout = DEFAULT_MANDAL_LAYOUT;

  // The whole piece is planned once. It cannot be done per frame in any case — the mandal state at
  // a given note depends on every note before it.
  const { plan, opening, flashes, lo, hi } = useMemo(() => {
    const byIndex = new Map(doc.events.map((ev) => [ev.index, ev]));
    const inputs: KanunNoteInput[] = timeline.notes.map((n) => {
      const ev = byIndex.get(n.index);
      const p = ev && !n.isRest ? parseNoteName(ev.noteAE) : null;
      if (!ev || !p) return { courseKoma: null, soundingKoma: Number.NaN };
      // ⚠ The spelling gives the LETTER AND OCTAVE only — the course. The alteration is taken from
      // `koma53` instead, and the two genuinely disagree in the shipped scores: `ui/accidentals.ts`
      // stores ±2 and ±3 comma alterations exactly but the engraver prints the nearest standard AEU
      // sign, so a note drawn with a koma-bemol can be stored two komas flat. `beyati-delisin` has
      // 36 of them. The stored comma is what the app SOUNDS, and a mandal is a thing that makes a
      // sound, so this view follows the comma — which makes it more precise than the page it came
      // from, not inconsistent with it.
      return {
        courseKoma: naturalKoma(p.letter, p.octave),
        soundingKoma: ev.koma53 + (makamDeltas.get(ev.index) ?? 0),
      };
    });

    const plan = planMandals(inputs, courses, layout);

    // When each change is lit, in ms. A change is shown for as long as the note that forced it
    // sounds, but never for less than `MIN_FLASH_MS` — a mandal moving on a sixteenth note is
    // still a mandal moving, and a 90 ms flash is one the eye does not catch.
    const flashes = plan.changes.map((ch) => {
      const n = timeline.notes[ch.noteIndex]!;
      return {
        courseIndex: ch.courseIndex,
        from: ch.from,
        to: ch.to,
        fromMs: n.startMs,
        toMs: n.startMs + Math.max(n.durationMs, MIN_FLASH_MS),
      };
    });

    // Which courses the piece actually touches — what the close-up crops to.
    let lo = courses.length - 1;
    let hi = 0;
    for (const p of plan.perNote) {
      if (!p) continue;
      if (p.courseIndex < lo) lo = p.courseIndex;
      if (p.courseIndex > hi) hi = p.courseIndex;
    }
    if (lo > hi) {
      lo = 0;
      hi = courses.length - 1;
    }

    return { plan, opening: openingMandals(plan, courses, layout), flashes, lo, hi };
  }, [doc, timeline, makamDeltas, courses, layout]);

  // The close-up the owner will need on a phone: 26 courses x 12 mandals is 312 boxes, and at full
  // width each is about four screen pixels across on a handset. Off by default, because the whole
  // instrument is what tells you which instrument this is — the same reasoning as the violin's
  // neck zoom.
  const [zoom, setZoom] = useState(false);

  const planRef = useRef(plan);
  planRef.current = plan;
  const flashRef = useRef(flashes);
  flashRef.current = flashes;
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  useEffect(() => {
    const grid = gridRef.current;
    const lines = linesRef.current;
    const root = rootRef.current;
    if (!grid || !lines || !root) return;

    const mandalCount = layout.count;
    const box = (c: number, m: number) => grid.children[c * mandalCount + m] as SVGRectElement | undefined;
    const line = (c: number) => lines.children[c] as SVGGElement | undefined;

    const p = planRef.current;

    /** Draw the opening setting: exactly one filled box per course, and nothing lit. */
    const reset = () => {
      for (let c = 0; c < courses.length; c++) {
        for (let m = 0; m < mandalCount; m++) {
          const b = box(c, m);
          if (!b) continue;
          b.setAttribute("data-mandal-state", m === p.opening[c] ? "up" : "down");
          b.removeAttribute("data-changed");
        }
        line(c)?.setAttribute("data-course-state", "idle");
      }
    };

    reset();

    if (!playing) {
      root.setAttribute("data-note-state", "idle");
      return;
    }

    // Where the replay has got to. `applied` is how many of the plan's changes have been drawn;
    // `lastNote` is what detects a seek backwards, which is the only case that needs a full redraw.
    let applied = 0;
    let lastNote = -1;
    let litCourse = -1;
    const flashed = new Set<number>();

    let raf = 0;
    const tick = () => {
      const pos = getPositionMs();
      const notes = timelineRef.current.notes;
      const plan = planRef.current;
      const flashes = flashRef.current;

      if (pos == null || pos < 0 || notes.length === 0) {
        root.setAttribute("data-note-state", "idle");
        raf = requestAnimationFrame(tick);
        return;
      }

      // The first event whose end is still ahead of the clock is the one sounding now — the same
      // rule the sheet's playhead and the violin view use, so the three cannot disagree about
      // "now".
      let i = notes.findIndex((n) => pos < n.startMs + n.durationMs);
      if (i < 0) i = notes.length - 1;

      if (i < lastNote) {
        reset();
        applied = 0;
        litCourse = -1;
        flashed.clear();
      }
      lastNote = i;

      // Advance the mandals to where they stand at this note. Only the boxes that actually move
      // are touched — repainting 312 rects every frame would be the one expensive thing here.
      while (applied < plan.changes.length && plan.changes[applied]!.noteIndex <= i) {
        const ch = plan.changes[applied]!;
        box(ch.courseIndex, ch.from)?.setAttribute("data-mandal-state", "down");
        box(ch.courseIndex, ch.to)?.setAttribute("data-mandal-state", "up");
        applied++;
      }

      // The flash. ⚠ Lit by TIME, not by note index: a change stays visible after its note has
      // passed, which is the point of a fade, so it cannot be driven off the same pointer as the
      // state above.
      for (let k = 0; k < flashes.length; k++) {
        const f = flashes[k]!;
        const on = pos >= f.fromMs && pos <= f.toMs;
        if (on === flashed.has(k)) continue;
        if (on) {
          flashed.add(k);
          box(f.courseIndex, f.to)?.setAttribute("data-changed", "to");
          box(f.courseIndex, f.from)?.setAttribute("data-changed", "from");
        } else {
          flashed.delete(k);
          box(f.courseIndex, f.to)?.removeAttribute("data-changed");
          box(f.courseIndex, f.from)?.removeAttribute("data-changed");
        }
      }

      // The sounding course.
      const at = plan.perNote[i] ?? null;
      const c = at ? at.courseIndex : -1;
      if (c !== litCourse) {
        if (litCourse >= 0) line(litCourse)?.setAttribute("data-course-state", "idle");
        if (c >= 0) line(c)?.setAttribute("data-course-state", "playing");
        litCourse = c;
      }
      // Nothing is drawn for a rest or for a note off the end of the instrument, and the two are
      // told apart rather than lumped together — an unreachable note is a real note this kanun
      // cannot play, which is worth saying.
      root.setAttribute(
        "data-note-state",
        at ? "playing" : notes[i]!.isRest ? "rest" : "out-of-range",
      );

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getPositionMs, courses, layout, plan]);

  const win = zoom ? mandalWindow(lo, hi, courses.length, layout.count) : FULL_WINDOW;
  // How much bigger everything in the window is drawn than at full zoom. Multiplying a size by
  // this holds it steady on screen, the same trick `Fingerboard.tsx` uses.
  const k = win.h / VIEW_H;

  return (
    <div
      id="kanun"
      className="kv-kanun"
      ref={rootRef}
      data-omr="kanun"
      data-courses={courses.length}
      data-mandals={layout.count}
      data-zoom={zoom ? "mandal" : "full"}
      data-note-state="idle"
    >
      <div className="kv-kanun__controls">
        <label className="kv-field" title={TR.kanun.zoomTitle}>
          <input
            id="kanun-zoom"
            type="checkbox"
            checked={zoom}
            onChange={(e) => setZoom(e.target.checked)}
          />
          <span>{TR.kanun.zoom}</span>
        </label>
      </div>

      {/* What to set before playing a note. This is the makam's mandal setting, and a kanun player
          prepares it the way a violinist tunes — so it belongs in words, not only in the picture.
          It is static for a given score, so it renders normally; nothing here is touched by the
          animation frame. */}
      <p id="kanun-opening" className="kv-kanun__opening" data-omr="kanun-opening" data-count={opening.length}>
        <span className="kv-kanun__opening-label">{TR.kanun.opening}</span>{" "}
        {opening.length === 0 ? (
          <span data-omr="kanun-opening-none">{TR.kanun.openingNone}</span>
        ) : (
          opening.map((o, n) => (
            <span
              key={o.course.index}
              data-omr="kanun-opening-item"
              data-course={o.course.index}
              data-perde={o.course.perde}
              data-offset={o.offset}
            >
              {n > 0 ? ", " : ""}
              {o.course.perde} {o.offset > 0 ? `+${o.offset}` : o.offset}
            </span>
          ))
        )}
      </p>

      <svg
        className="kv-kanun__svg"
        viewBox={`${win.x} ${win.y} ${win.w} ${win.h}`}
        role="img"
        aria-label={TR.kanun.alt}
      >
        {/* The soundboard. ⚠ Schematic: the taper is a chosen ratio, not one derived from the
            tuning — see the header of kanunGeometry.ts for why deriving it would be wrong. */}
        <polygon className="kv-kanun__body" points={bodyOutline(courses.length, layout.count)} />

        <line
          className="kv-kanun__bridge"
          x1={BRIDGE_X}
          x2={BRIDGE_X}
          y1={courseY(courses.length - 1, courses.length) - 10}
          y2={courseY(0, courses.length) + 10}
        />

        {/* The courses. ⚠ **Three strings each, not one** (owner, 2026-08-29) — that is what a perde
            physically is, and one line was a summary that lost it. They share a single lever,
            because the mandal stops the whole course at once, and they light together for the same
            reason: a player plucks a course, never one of its strings.
            ⚠ The <g> is the addressable element, not the lines — the animation frame sets
            `data-course-state` on it and the stylesheet reaches the three strings through it. */}
        <g className="kv-kanun__courses" ref={linesRef}>
          {courses.map((c) => {
            const y = courseY(c.index, courses.length);
            const x = nutX(c.index, courses.length);
            return (
              <g
                key={c.index}
                data-omr="kanun-course"
                data-course={c.index}
                data-perde={c.perde}
                data-course-state="idle"
              >
                {stringOffsets().map((dy, n) => (
                  <line key={n} x1={x} x2={BRIDGE_X} y1={y + dy} y2={y + dy} />
                ))}
              </g>
            );
          })}
        </g>

        {/* The mandals: one row of levers per course, laid along the diagonal exactly as they sit
            on the instrument. ⚠ **Exactly one box per course is filled** — the lever that is
            actually setting the pitch. On a real kanun several levers can be physically raised at
            once and only the one nearest the bridge counts, so drawing the effective one is the
            truthful summary rather than a simplification of the sound. ⚠ Box 0 means every lever
            down, which is the course at its flattest, not "no setting".
            ⚠ The order of these children IS the index the animation frame addresses them by
            (`course * mandalCount + mandal`). Do not reorder or filter them. */}
        <g className="kv-kanun__mandals" ref={gridRef}>
          {courses.flatMap((c) =>
            Array.from({ length: layout.count }, (_, m) => {
              const r = mandalRect(c.index, m, courses.length, layout.count);
              const offset = m - layout.naturalIndex;
              return (
                <rect
                  key={`${c.index}:${m}`}
                  data-omr="kanun-mandal"
                  data-course={c.index}
                  data-mandal={m}
                  data-offset={offset}
                  data-natural={offset === 0 ? "1" : undefined}
                  data-mandal-state="down"
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  rx={2}
                />
              );
            }),
          )}
        </g>

        {/* Perde names, ⚠ **OUTSIDE the soundboard** (owner, 2026-08-29). Keeping them off the wood
            is what lets the body's left edge hug the levers, so its slope is exactly the diagonal
            the courses shorten along — which is what the instrument actually looks like.
            ⚠ Consequence: they sit on the PAGE, not on wood, so they take the theme's own colour
            (see app.css) instead of the white-with-a-dark-outline the violin's string names need.
            The written note name is the label because that is what is on the page in front of the
            player; the perde name a kanuncu would say is on the element and in the tooltip. */}
        <g className="kv-kanun__labels">
          {courses.map((c) => (
            <text
              key={c.index}
              x={labelX(c.index, courses.length, layout.count)}
              y={courseY(c.index, courses.length)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={LABEL_SIZE * k}
            >
              <title>{c.perde}</title>
              {spellNote(c.letter, c.octave, 0)}
            </text>
          ))}
        </g>
      </svg>

    </div>
  );
}
