import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { groupMeasures, type Measure, type NoteModelDocument, type Timeline } from "@turkish-omr/core";
import { SHEET_SIDE_MARGIN, type PlayStep } from "./SheetView";
import { TR } from "./ui/strings";

/**
 * One bar of the score, engraved on its own, beside the instrument (owner, 2026-09-04:
 * *"sol tarafta enstrüman sağ tarafta nota ölçüsü"*) — and **editable in place** (owner, 2026-09-05,
 * reversing the first version's edit path one day later: *"ölçü düzenlemesi için ayrı bir editör
 * yapar mısın, nota tabına atmasın. Normal edit tool çantası çıksın yine … Edit tabi nota tabına da
 * yansısın ikisi ayrı olmasın"*).
 *
 * ⭐ **What it is for.** The instrument views answer *where do I put my fingers now*; they say
 * nothing about *what am I playing now*. A player looking at a clarinet photograph has to hold the
 * music in their head, and the page already knows it. So this draws the ONE bar that is sounding,
 * with its own controls: step back, step forward, play just this bar, and edit it.
 *
 * ⭐ **THE BAR IS DRAWN BY `SheetView` ITSELF — THE SAME COMPONENT THE NOTA PAGE MOUNTS**, given
 * `onlyMeasure`. That is the whole design, and it is what makes *"ikisi ayrı olmasın"* literally
 * true rather than a promise: the note targets, the pitch drag, the insert ghost, the tuplet
 * handles, the sign targets, the off-meter badge, the playhead and the undo stack are not
 * reimplemented here — they ARE the page's, and an edit made here goes through the same App
 * callbacks onto the same document. Six optional props were added to `SheetView` for it
 * (`onlyMeasure`, `contentWidth`, `justify`, `chrome`, `surfaceId`, `svgMarker`) and every default
 * reproduces the page exactly, so the render harness and the strip exporter are untouched.
 *
 * ⚠ **This file therefore engraves NOTHING.** It owns three things and no more: **which bar** is on
 * screen, **how wide** the drawing may be, and the **card around it**. If you find yourself writing
 * VexFlow here, the answer is a prop on `SheetView`.
 *
 * ⚠ **The document is NOT sliced, and that is deliberate.** `onlyMeasure` filters the drawn bars
 * without renumbering them, so bar 7 is still called seven on both sides and `repeatSpans`,
 * `navMarks`, `signTargets`, `openRepeat`, `repeatAnchor` and the insert's `measureIndex` go in
 * untouched. A one-bar document would have traded that one filter for six mappings that must agree,
 * in the one place where being wrong means an edit lands on another bar. See `renderBar` in App.
 *
 * ⚠ **ONE CLOCK**, the same one the instrument beside it follows: `getPositionMs()`. Never add a
 * timer — the picture, the sound and the fingering would drift apart silently.
 */

/** How narrow the engraved area may get before the box scrolls sideways instead.
 *
 * ⚠ Measured, not chosen by eye: a phone gives this card ~250px of column, and a 13-note bar
 * squeezed into that renders its staff ~17px tall — small enough that koma and küçük stop being
 * tellable apart, which is the one thing this app exists to show. Below the floor the reader
 * scrolls the bar. */
const MIN_CONTENT_W = 320;
/** What to engrave at before the box has been measured (one frame, and every headless run that
 *  mounts the card without laying it out). */
const FALLBACK_CONTENT_W = 460;

export function MeasureCard({
  doc,
  timeline,
  playPlan,
  playing,
  getPositionMs,
  canPlay,
  editMode,
  onPlayMeasure,
  onEditMeasure,
  renderBar,
}: {
  /** The WRITTEN score — the same document the sheet draws. */
  doc: NoteModelDocument;
  /** The performance, for the no-`playPlan` case: its notes name written events directly. */
  timeline: Timeline;
  /**
   * One step per sounding event, naming the WRITTEN note it belongs to.
   *
   * ⚠ **Always passed, folded score or not** — unlike `SheetView`'s own optional copy. The card
   * draws a SLICE, whose internal clock starts at zero, so "which note is sounding" can only be
   * answered against the performance and mapped back. Without it the seventh bar would light its
   * first note whenever the piece's first bar played.
   */
  playPlan: readonly PlayStep[];
  /** True while there is a live (playing or paused) position. */
  playing: boolean;
  getPositionMs: () => number | null;
  /** False when there is nothing to play (no timeline yet) — the bar transport goes dead. */
  canPlay: boolean;
  /** Whether the page is in edit mode. The card only reflects it; the toggle lives in the card head
   *  above, shared with the Nota page, because it is ONE mode over ONE document. */
  editMode: boolean;
  /** Play ONLY this bar, from its first sounding, stopping at its barline. */
  onPlayMeasure: (m: Measure) => void;
  /** Turn edit mode on (or off) with this bar as the one being worked on. ⚠ It does NOT leave the
   *  instrument tab — the first version did, and the owner reversed that the next day. */
  onEditMeasure: (m: Measure, on: boolean) => void;
  /**
   * Draw the bar. Supplied by App, and it returns a `SheetView` — see the ⭐ at the top of this
   * file for why that is the design rather than an indirection.
   *
   * `contentWidth` is the staff area this card can give it, already floored; `showCursor` says
   * whether the playhead belongs to the bar on screen at all.
   */
  renderBar: (m: Measure, opts: { contentWidth: number; showCursor: boolean }) => ReactNode;
}) {
  const measures = useMemo(() => groupMeasures(doc), [doc]);
  const total = measures.length;

  // Written event index → the 1-based bar it is drawn in. Built once per document, because the
  // alternative is `measureOfEvent` (a scan over every bar) inside an animation frame.
  const measureOf = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of measures) for (const ev of m.events) map.set(ev.index, m.index);
    return map;
  }, [measures]);

  // ⭐ Two ways to be on a bar, and they are deliberately different states rather than one index.
  // `follow` is the default: the card shows whatever is sounding, so opening the tab and pressing
  // Çal needs no further clicks. An arrow PINS — the reader is looking at something, and music
  // moving the page under them is the thing that makes a page unusable. `Çalınanı izle` gives the
  // follow back, and its `data-follow` is what a check reads (a pinned card and a following card
  // are the same DOM otherwise).
  const [follow, setFollow] = useState(true);
  const [pinned, setPinned] = useState(1);
  const [live, setLive] = useState(1);

  const shown = Math.min(Math.max(follow ? live : pinned, 1), Math.max(total, 1));
  const measure = measures[shown - 1] ?? null;

  const playPlanRef = useRef(playPlan);
  playPlanRef.current = playPlan;
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const measureOfRef = useRef(measureOf);
  measureOfRef.current = measureOf;

  const cardRef = useRef<HTMLElement>(null);
  // ── how wide the bar may be drawn ─────────────────────────────────────────────────────────────
  // ⚠ The card FITS THE ENGRAVING to its column; it does not scale a finished drawing. That is what
  // keeps every coordinate in `SheetView`'s overlay 1:1 with the notes — a scaled surface would
  // need the hit-testing to divide by a factor, in the shared code, for one of its two callers.
  const frameRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      // Rounded, so a sub-pixel layout wobble cannot re-engrave the bar every frame.
      setBoxW((prev) => (Math.abs(prev - w) < 1 ? prev : Math.round(w)));
    });
    ro.observe(el);
    setBoxW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const contentWidth = Math.max(
    MIN_CONTENT_W,
    (boxW > 0 ? boxW : FALLBACK_CONTENT_W) - 2 * SHEET_SIDE_MARGIN,
  );

  // ── the clock: which bar is sounding ──────────────────────────────────────────────────────────
  // ⚠ Only the FOLLOW is decided here. The playhead itself is drawn by the nested `SheetView`, off
  // the same `getPositionMs`, so there is no second cursor to keep in step. `setLive` returns the
  // previous value unchanged when nothing moved, so React re-renders once per BAR, not per frame.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const pos = getPositionMs();
      if (pos != null && pos >= 0) {
        const plan = playPlanRef.current;
        let ev: number | null = null;
        if (plan.length > 0) {
          ev = (plan.find((p) => pos < p.endMs) ?? plan[plan.length - 1]!).evIndex;
        } else {
          const ns = timelineRef.current.notes;
          if (ns.length > 0) {
            ev = (ns.find((n) => pos < n.startMs + n.durationMs) ?? ns[ns.length - 1]!).index;
          }
        }
        const bar = ev != null ? measureOfRef.current.get(ev) ?? null : null;
        if (bar != null) setLive((prev) => (prev === bar ? prev : bar));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getPositionMs]);

  /**
   * Bring the card above the docked toolbox when edit mode opens.
   *
   * ⚠ **On a phone the toolbox docks to the bottom as a sheet up to `min(46dvh, 420px)` tall**, and
   * the card sits directly under the tab picker — so turning editing on covered the very bar it was
   * turned on for. The page can be scrolled past it, but a first tap that hides the thing you asked
   * to edit reads as broken.
   * ⚠ `block: "nearest"` plus a `scroll-margin-bottom` on `.kv-measure` (in the phone query, sized
   * to the docked sheet) does the whole job: on a wide window the margin is zero and the card is
   * already visible, so this scrolls NOTHING. Never use `"center"` or `"end"` here — they would
   * yank a perfectly visible card around on the desktop.
   */
  const revealCard = () => {
    requestAnimationFrame(() => {
      const behavior: ScrollBehavior =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      cardRef.current?.scrollIntoView({ block: "nearest", behavior });
    });
  };

  const step = (delta: number) => {
    setPinned(Math.min(Math.max(shown + delta, 1), total));
    setFollow(false);
  };

  return (
    <section
      id="measure-card"
      ref={cardRef}
      className="kv-measure"
      data-omr="measure-card"
      data-measure={measure ? shown : 0}
      data-total={total}
      data-notes={measure?.events.length ?? 0}
      data-follow={follow ? "1" : "0"}
      data-edit-mode={editMode ? "on" : "off"}
    >
      <header className="kv-measure__head">
        <h3 className="kv-measure__title">{TR.measure.title(measure ? shown : 0, total)}</h3>
        <div className="kv-measure__tools">
          <button
            id="measure-play"
            type="button"
            className="kv-btn kv-btn--primary"
            title={TR.measure.playTitle}
            disabled={!measure || !canPlay}
            onClick={() => {
              if (!measure) return;
              // Pressing play PINS the bar. Following would take the card off it at the first
              // frame past the barline, which is the one moment the reader is looking hardest.
              setPinned(shown);
              setFollow(false);
              onPlayMeasure(measure);
            }}
          >
            {TR.measure.play}
          </button>
          {/* ⚠ A TOGGLE, not a jump. It used to send the reader to the Nota page; the owner
              replaced that the same day, so this turns the SAME edit mode on where they already
              are. `#edit-toggle` in the card head above is the other face of the one switch. */}
          <button
            id="measure-edit"
            type="button"
            className={`kv-btn${editMode ? " is-on" : ""}`}
            data-edit-mode={editMode ? "on" : "off"}
            title={TR.measure.editTitle}
            disabled={!measure}
            onClick={() => {
              if (!measure) return;
              setPinned(shown);
              setFollow(false);
              onEditMeasure(measure, !editMode);
              if (!editMode) revealCard();
            }}
          >
            {editMode ? TR.measure.editing : TR.measure.edit}
          </button>
        </div>
      </header>

      <div className="kv-measure__row">
        <button
          id="measure-prev"
          type="button"
          className="kv-measure__arrow"
          title={TR.measure.prev}
          aria-label={TR.measure.prev}
          disabled={!measure || shown <= 1}
          onClick={() => step(-1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className="kv-measure__sheet" ref={frameRef}>
          {measure && renderBar(measure, { contentWidth, showCursor: playing && live === shown })}
        </div>
        <button
          id="measure-next"
          type="button"
          className="kv-measure__arrow"
          title={TR.measure.next}
          aria-label={TR.measure.next}
          disabled={!measure || shown >= total}
          onClick={() => step(1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <footer className="kv-measure__foot">
        <button
          id="measure-follow"
          type="button"
          className={`kv-btn kv-btn--tiny${follow ? " is-on" : ""}`}
          title={TR.measure.followTitle}
          aria-pressed={follow}
          onClick={() => {
            // Turning follow OFF keeps the bar on screen rather than jumping anywhere.
            setPinned(shown);
            setFollow((v) => !v);
          }}
        >
          {TR.measure.follow}
        </button>
        {!measure && <p className="kv-measure__empty">{TR.measure.empty}</p>}
      </footer>
    </section>
  );
}
