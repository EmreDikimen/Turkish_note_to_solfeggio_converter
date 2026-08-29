import { useEffect, useMemo, useRef, useState } from "react";
import {
  assignFingering,
  commasToRatio,
  firstPositionFinger,
  DEFAULT_VIOLIN_TUNING,
  FIRST_POSITION_NOTES,
  VIOLIN_TUNINGS,
  type Timeline,
} from "@turkish-omr/core";
import {
  FULL_WINDOW,
  IMAGE_FINGERBOARD_END_RATIO,
  IMAGE_ORIGIN,
  fingerboardLineAt,
  neckWindow,
  toDisplay,
  VIEW_H,
  VIOLIN_IMAGE,
  pointOnString,
} from "./ui/fingerboardGeometry";
import { TR } from "./ui/strings";

/**
 * The fingerboard tab (feature F3) — where the finger goes on a violin, as the piece plays.
 *
 * What/why: a fretless position is an exact formula, so all 53 commas land where they really are.
 * A twelve-tone app cannot draw a koma position at all; this one can show that a koma sharp and a
 * küçük sharp sit a couple of millimetres apart on the string. That is the point of the view, and
 * it is what the two layers on the photo are for: **fixed lines where a violinist's fingers
 * normally go, and a dot at the exact place this music asks for**. The gap between them IS the
 * koma.
 *
 * How it's organized:
 *   * `packages/core/src/fingering.ts` owns the maths (which string, how far along, which band).
 *   * `ui/fingerboardGeometry.ts` owns the pixels (where the photo's strings are).
 *   * this file owns only the drawing and the clock.
 *
 * ⚠ THE VIEW STANDS UP, AND THE LINES CROSS THE NECK (owner, 2026-08-27). It used to be a neck
 * laid on its side with a few short notches on each string. Two things were wrong with that for
 * the person holding a violin: it did not look like a violin, and a notch that stops at one string
 * is not how a learner's instrument is marked. So the photo is now the upright instrument down to
 * mid-body, and a position is one line laid across all four strings, like tape.
 *
 * ⚠ THE LINES ARE A FIXED CHART, NOT THIS PIECE'S NOTES (owner, same day, reversing the first
 * version: *"the lines will show standard violin notes, they will not be arranged by koma"*). They
 * are `FIRST_POSITION_NOTES` — the seven ordinary places a first-position hand stops a string —
 * so the chart is the same for every score, which is what a reference has to be. ⚠ The line is a
 * REFERENCE, not a fret: the moving dot is placed at its own exact ratio and lands between two
 * lines whenever the music does — which on koma-heavy makam music is often, and is the whole
 * point. Nothing may ever snap the dot to a line.
 *
 * ⚠ TWO RULES THIS FILE EXISTS INSIDE OF.
 *
 * 1. **One clock.** The marker is driven by `getPositionMs()` — the audio clock the sheet's
 *    playhead already follows — so it cannot drift from the sound. Never add a second timing
 *    source (docs/features/fingerboard.md).
 * 2. **Take the timeline, never rebuild it.** `props.timeline` has the makam bend and the
 *    transpose already resolved into `freqHz`. `PianoRoll.tsx` calls `buildTimeline(doc)` itself
 *    and therefore draws WRITTEN pitches; that is harmless for a roll and wrong here, where the
 *    bent koma is exactly what the view claims to show. For the same reason nothing here is
 *    labelled with `NoteEvent.noteName`: `withKomaDeltas` leaves that field stale on purpose.
 */

/**
 * Marker radius and string-name size, in viewBox units at the FULL zoom level.
 *
 * ⚠ Both are multiplied by the zoom's own scale so they keep a constant size on SCREEN. Without
 * that, zooming the neck to 2.4× would draw a dot 2.4× wider than the string spacing it is meant to
 * point at — the picture gets closer, the marks should not get fatter. The lines and the nut do the
 * same job with `vector-effect: non-scaling-stroke` in the stylesheet, which is the CSS spelling of
 * the same rule.
 */
const DOT_R = 5.5;
const LABEL_SIZE = 8;

/** One line of the fixed chart: where it falls, what it is, and which finger plays it. */
interface PositionLine {
  commas: number;
  ratio: number;
  finger: 1 | 2 | 3 | 4 | null;
}

/**
 * The chart, built once for the whole app — it does not depend on the score.
 *
 * ⚠ Deliberately module-level rather than inside the component: it is a property of a violin, and
 * computing it per render would invite someone to make it depend on the music again.
 */
const CHART: PositionLine[] = FIRST_POSITION_NOTES.map((commas) => {
  const ratio = commasToRatio(commas);
  return { commas, ratio, finger: firstPositionFinger(ratio) };
});

/** How far down the neck the chart itself reaches — the zoom may never crop a line away. */
const CHART_BOTTOM = CHART[CHART.length - 1]!.ratio;

export function Fingerboard({
  timeline,
  playing,
  getPositionMs,
}: {
  timeline: Timeline;
  playing: boolean;
  getPositionMs: () => number | null;
}) {
  const dotRef = useRef<SVGCircleElement>(null);
  const tuning = DEFAULT_VIOLIN_TUNING;
  // The lines are a reference the player may not want: on a piece that uses many positions they
  // crowd the neck, and a violin has no lines on it. Shown by default because a first look with
  // nothing on the ebony explains nothing (owner, 2026-08-27).
  const [showLines, setShowLines] = useState(true);
  // The zoom the owner asked for (2026-08-27): the neck on its own, fitted to this piece. Off by
  // default — the full instrument is what tells a player which instrument this is, and the close-up
  // is what you switch to once you are reading positions off it.
  const [zoom, setZoom] = useState(false);

  // Fingering for the whole piece, once. The animation frame then only indexes an array — the
  // walk carries a hand along the neck in note order, so it cannot be done per-frame anyway.
  const { fingering, maxRatio } = useMemo(() => {
    const fing = assignFingering(
      timeline.notes.map((n) => n.freqHz),
      tuning.strings,
      IMAGE_FINGERBOARD_END_RATIO,
    );
    // The highest position the piece reaches. The LINES no longer depend on the music, but the
    // zoom still does: it may not crop away a place the dot is going to visit.
    let top = 0;
    for (const f of fing) if (f && f.ratio > top) top = f.ratio;
    return { fingering: fing, maxRatio: top };
  }, [timeline, tuning]);

  // Keep the positions out of the render path: the rAF loop reads this ref every frame and must
  // never trigger a re-render (the same reasoning as the sheet's playhead).
  const fingeringRef = useRef(fingering);
  fingeringRef.current = fingering;
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    const idle = () => {
      dot.style.display = "none";
      dot.setAttribute("data-finger-state", "idle");
      dot.removeAttribute("data-string");
      dot.removeAttribute("data-ratio");
    };

    if (!playing) {
      idle();
      return;
    }

    let raf = 0;
    const tick = () => {
      const pos = getPositionMs();
      const notes = timelineRef.current.notes;
      if (pos != null && pos >= 0 && notes.length > 0) {
        // First event whose end is still ahead of the clock is the one sounding now — the same
        // rule the sheet's playhead uses, so the two views can never disagree about "now".
        let i = notes.findIndex((n) => pos < n.startMs + n.durationMs);
        if (i < 0) i = notes.length - 1;
        const at = fingeringRef.current[i] ?? null;
        if (at) {
          const p = pointOnString(at.stringIndex, at.ratio);
          const d = toDisplay(p.x, p.y);
          dot.setAttribute("cx", d.x.toFixed(2));
          dot.setAttribute("cy", d.y.toFixed(2));
          dot.style.display = "block";
          dot.setAttribute("data-finger-state", at.ratio === 0 ? "open" : "stopped");
          dot.setAttribute("data-string", tuning.strings[at.stringIndex]!.id);
          dot.setAttribute("data-ratio", at.ratio.toFixed(4));
        } else {
          // Nothing is drawn, and the reason is stated rather than guessed at: a rest is silence,
          // but an unreachable note is a real note this violin cannot play. ⚠ The second is not
          // rare here — Turkish notation transposes down a fourth, so a low written passage sounds
          // under the open Sol string. Faking a position for it would be a lie about the music.
          dot.style.display = "none";
          dot.setAttribute("data-finger-state", notes[i]!.isRest ? "rest" : "out-of-range");
          dot.removeAttribute("data-string");
          dot.removeAttribute("data-ratio");
        }
      } else {
        idle();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getPositionMs, tuning]);

  /** The nut, drawn across the ebony — the line every position is measured from. */
  const nut = fingerboardLineAt(0, 2.5);

  // The visible window, and how much bigger everything in it is drawn than at full zoom. `k` is the
  // inverse of that, so multiplying a size by it holds the size steady on screen.
  const win = zoom ? neckWindow(Math.max(maxRatio, CHART_BOTTOM)) : FULL_WINDOW;
  const k = win.h / VIEW_H;

  return (
    <div
      id="fingerboard"
      className="kv-fingerboard"
      data-omr="fingerboard"
      data-tuning={tuning.id}
      data-strings={tuning.strings.length}
      data-lines={showLines ? "on" : "off"}
      data-zoom={zoom ? "neck" : "full"}
    >
      <div className="kv-fingerboard__controls">
        {/* The picker is built but hidden while only one tuning exists: the seam, the data table and
            the attribute are all real, so adding a Turkish scordatura is a row in VIOLIN_TUNINGS —
            but a select with one option is dead UI, and inventing a second tuning to fill it is a
            repertoire claim this project has not made (docs/features/fingerboard.md). */}
        {VIOLIN_TUNINGS.length > 1 && (
          <label className="kv-field" htmlFor="fingerboard-tuning">
            <span>{TR.fingerboard.tuning}</span>
            <select id="fingerboard-tuning" data-tuning={tuning.id} defaultValue={tuning.id}>
              {VIOLIN_TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="kv-field" title={TR.fingerboard.linesTitle}>
          <input
            id="fingerboard-lines"
            type="checkbox"
            checked={showLines}
            onChange={(e) => setShowLines(e.target.checked)}
          />
          <span>{TR.fingerboard.lines}</span>
        </label>

        <label className="kv-field" title={TR.fingerboard.zoomTitle}>
          <input
            id="fingerboard-zoom"
            type="checkbox"
            checked={zoom}
            onChange={(e) => setZoom(e.target.checked)}
          />
          <span>{TR.fingerboard.zoom}</span>
        </label>
      </div>

      <svg
        className="kv-fingerboard__svg"
        viewBox={`${win.x} ${win.y} ${win.w} ${win.h}`}
        role="img"
        aria-label={TR.fingerboard.alt}
      >
        {/* The instrument is a picture, cropped by the viewBox alone — the file's background is
            transparent, so the violin stands on the page rather than in a white box. Everything
            over it is vector, so it stays sharp and can be placed exactly. ⚠ No transform lives on
            any container here: `.kv-score` is screenshotted by rect for training strips. */}
        <image
          href={VIOLIN_IMAGE.href}
          x={IMAGE_ORIGIN.x}
          y={IMAGE_ORIGIN.y}
          width={VIOLIN_IMAGE.width}
          height={VIOLIN_IMAGE.height}
        />

        {/* The nut itself — the zero of every position. */}
        <line
          className="kv-fingerboard__nut"
          x1={nut.x1}
          x2={nut.x2}
          y1={nut.y}
          y2={nut.y}
        />

        {/* The chart: the seven places a first-position hand normally stops a string, laid across
            the neck like a learner's tape. The same seven for every score — that is what makes it
            a reference. On a fretless instrument they are NOT frets, and the dot is under no
            obligation to land on one: a koma-altered note sits BETWEEN two lines, which is the one
            thing this view exists to show. The colour is the finger that plays the line. */}
        {showLines && (
          <g className="kv-fingerboard__lines">
            {CHART.map((l) => {
              const g = fingerboardLineAt(l.ratio);
              return (
                <line
                  key={l.commas}
                  data-omr="fingerboard-tick"
                  data-commas={l.commas}
                  data-ratio={l.ratio.toFixed(4)}
                  data-finger={l.finger ?? ""}
                  x1={g.x1}
                  x2={g.x2}
                  y1={g.y}
                  y2={g.y}
                />
              );
            })}
          </g>
        )}

        {/* String names, written up the pegbox above the nut where each string arrives — the only
            place on an upright violin with room for them, since the four strings are barely 9 px
            apart at the nut. Not translated: a string is called the same thing in every language,
            the same rule the instrument voices follow.
            ⚠ `fontSize` is a presentation ATTRIBUTE, not CSS: no selector under `.kv-score` may
            set a font (see styles/app.css and ScoreCard.tsx). */}
        <g className="kv-fingerboard__labels">
          {tuning.strings.map((s, i) => {
            const p = pointOnString(i, 0);
            const d = toDisplay(p.x, p.y);
            const y = d.y - 6 * k;
            return (
              <text
                key={s.id}
                x={d.x}
                y={y}
                transform={`rotate(-90 ${d.x} ${y})`}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={LABEL_SIZE * k}
              >
                {s.label}
              </text>
            );
          })}
        </g>

        <circle
          ref={dotRef}
          className="kv-fingerboard__dot"
          data-omr="finger-marker"
          data-finger-state="idle"
          r={DOT_R * k}
          cx={0}
          cy={0}
          style={{ display: "none" }}
        />
      </svg>
    </div>
  );
}
