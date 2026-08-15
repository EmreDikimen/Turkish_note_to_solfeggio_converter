import { useEffect, useMemo, useRef } from "react";
import {
  assignFingering,
  DEFAULT_VIOLIN_TUNING,
  VIOLIN_TUNINGS,
  type Timeline,
} from "@turkish-omr/core";
import {
  IMAGE_FINGERBOARD_END_RATIO,
  NUT_X_DISPLAY,
  ROTATE_TRANSFORM,
  fingerboardOutline,
  toDisplay,
  VIEW_H,
  VIEW_W,
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
 * it is why the ticks are drawn from the loaded score's OWN pitches rather than from a fixed
 * chart — the spacing on screen is the spacing of the music in front of you.
 *
 * How it's organized:
 *   * `packages/core/src/fingering.ts` owns the maths (which string, how far along).
 *   * `ui/fingerboardGeometry.ts` owns the pixels (where the photo's strings are).
 *   * this file owns only the drawing and the clock.
 *
 * ⚠ TWO RULES THIS FILE EXISTS INSIDE OF.
 *
 * 1. **One clock.** The marker is driven by `getPositionMs()` — the audio clock the sheet's
 *    playhead already follows — so it cannot drift from the sound. Never add a second timing
 *    source (docs/features/README.md).
 * 2. **Take the timeline, never rebuild it.** `props.timeline` has the makam bend and the
 *    transpose already resolved into `freqHz`. `PianoRoll.tsx` calls `buildTimeline(doc)` itself
 *    and therefore draws WRITTEN pitches; that is harmless for a roll and wrong here, where the
 *    bent koma is exactly what the view claims to show. For the same reason nothing here is
 *    labelled with `NoteEvent.noteName`: `withKomaDeltas` leaves that field stale on purpose.
 */

/** Marker radius, in viewBox units (the view is 70 units across, so this is a small dot). */
const DOT_R = 3.2;
/** Half-length of a tick, across the string. */
const TICK = 2.6;

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

  // Fingering for the whole piece, once. The animation frame then only indexes an array — the
  // greedy rule is a walk over the notes in order, so it cannot be done per-frame anyway.
  const { fingering, ticks } = useMemo(() => {
    const fing = assignFingering(
      timeline.notes.map((n) => n.freqHz),
      tuning.strings,
      IMAGE_FINGERBOARD_END_RATIO,
    );
    // One tick per distinct position the piece actually uses. Deduped on the drawn position
    // rather than on the pitch, because two spellings that sound the same are one place to put a
    // finger. 1e-4 of the string is well under a pixel at any size this is drawn.
    const byString = tuning.strings.map(() => new Set<number>());
    for (const f of fing) {
      if (f && f.ratio > 0) byString[f.stringIndex]!.add(Math.round(f.ratio * 1e4) / 1e4);
    }
    return {
      fingering: fing,
      ticks: byString.map((s) => [...s].sort((a, b) => a - b)),
    };
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

  /** Display y of each string where it leaves the nut — the anchor for its name and the nut line. */
  const nutYs = tuning.strings.map((_, i) => {
    const p = pointOnString(i, 0);
    return toDisplay(p.x, p.y).y;
  });

  return (
    <div
      id="fingerboard"
      className="kv-fingerboard"
      data-omr="fingerboard"
      data-tuning={tuning.id}
      data-strings={tuning.strings.length}
    >
      {/* The picker is built but hidden while only one tuning exists: the seam, the data table and
          the attribute are all real, so adding a Turkish scordatura is a row in VIOLIN_TUNINGS —
          but a select with one option is dead UI, and inventing a second tuning to fill it is a
          repertoire claim this project has not made (docs/features/README.md). */}
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

      <svg
        className="kv-fingerboard__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={TR.fingerboard.alt}
      >
        <defs>
          {/* The photo is masked to the fingerboard itself, starting at the nut: everything left
              of it is margin for the string names, and the shape (rather than a rectangle) is what
              keeps a tuning peg out of frame — see fingerboardOutline(). */}
          <clipPath id="kv-fb-clip">
            <polygon points={fingerboardOutline().map((p) => `${p.x},${p.y}`).join(" ")} />
          </clipPath>
        </defs>

        {/* The instrument is a picture; everything over it is vector, so it stays sharp and can be
            placed exactly. The rotation lives HERE, on an inner group, and never as a CSS
            transform on a container — `.kv-score` is screenshotted by rect for training strips. */}
        <g clipPath="url(#kv-fb-clip)">
          <g transform={ROTATE_TRANSFORM}>
            <image
              href={VIOLIN_IMAGE.href}
              x={0}
              y={0}
              width={VIOLIN_IMAGE.width}
              height={VIOLIN_IMAGE.height}
            />
          </g>
        </g>

        {/* The nut itself — the line every position is measured from. */}
        <line
          className="kv-fingerboard__nut"
          x1={NUT_X_DISPLAY}
          x2={NUT_X_DISPLAY}
          y1={Math.min(...nutYs) - 4}
          y2={Math.max(...nutYs) + 4}
        />

        {/* One tick per position the piece uses. On a fretless instrument these are not frets —
            they are this score's own notes, which is why their spacing is uneven and why two
            microtonal neighbours sit visibly close together. */}
        <g className="kv-fingerboard__ticks">
          {ticks.map((rs, si) =>
            rs.map((r) => {
              const p = pointOnString(si, r);
              const d = toDisplay(p.x, p.y);
              return (
                <line
                  key={`${si}-${r}`}
                  data-omr="fingerboard-tick"
                  data-string={tuning.strings[si]!.id}
                  data-ratio={r.toFixed(4)}
                  x1={d.x}
                  x2={d.x}
                  y1={d.y - TICK}
                  y2={d.y + TICK}
                />
              );
            }),
          )}
        </g>

        {/* String names, in the margin the clip left free. Not translated — a string is called the
            same thing in every language, the same rule the instrument voices follow.
            ⚠ `fontSize` is a presentation ATTRIBUTE, not CSS: no selector under `.kv-score` may
            set a font (see styles/app.css and ScoreCard.tsx). */}
        <g className="kv-fingerboard__labels">
          {tuning.strings.map((s, i) => (
            <text
              key={s.id}
              x={NUT_X_DISPLAY - 5}
              y={nutYs[i]! + 2.4}
              textAnchor="end"
              fontSize={6.5}
            >
              {s.label}
            </text>
          ))}
        </g>

        <circle
          ref={dotRef}
          className="kv-fingerboard__dot"
          data-omr="finger-marker"
          data-finger-state="idle"
          r={DOT_R}
          cx={0}
          cy={0}
          style={{ display: "none" }}
        />
      </svg>
    </div>
  );
}
