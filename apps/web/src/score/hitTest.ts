/**
 * Click and drag geometry for the editor: the boxes a click is tested against, measured off the real
 * ink (never a group's getBBox() — docs/APP-RULES.md), plus the drag and insert constants. Split out
 * of SheetView.tsx on 2026-11-20, unchanged.
 */
import { type Measure, nudgePitch } from "@turkish-omr/core";
import { STAFF_SPACE } from "./drawMarks";
import { StaveNote } from "vexflow";

/** Delete-target geometry for the structure signs. A repeat barline's target is NARROW on purpose:
 *  it straddles the barline, where no notehead sits, so what it takes from a note target is stem
 *  and beam. The nav marks' boxes sit entirely above the top staff line, where the glyphs are
 *  drawn — they overlap nothing. */
export const SIGN_HIT_W = 16;
export const SIGN_HIT_PAD = 6;
export const NAV_HIT_W = 30;
export const NAV_HIT_H = 22;
/** The strip at a bar's right edge the off-meter badge owns (`.kv-bar-warn`, 16px + its offset). */
export const BAR_WARN_W = 24;

export interface MeasureBox {
  index: number;
  measure: Measure;
  x: number;
  y: number;
  width: number;
  /** y of this row's TOP staff line — the origin the insert tool reads a pitch from. Not the same
   *  as `y`, which is the stave's bounding-box top and sits well above the first line. */
  topLineY: number;
}

/**
 * Where one DRAWN note sits on screen, so edit mode can hit-test a click against it.
 *
 * Kept deliberately inside SheetView rather than pushed out through `onLayout`: that payload is
 * a contract shared with stripExport.ts and tools/render/render.ts, which crop training strips by
 * those measure rects, and the only consumer of per-note geometry is the overlay a few lines
 * below. (`onLayout` is also an engrave dependency, so a second callback prop would have to be
 * stable in the parent or re-engrave forever.)
 *
 * Two known holes, both documented rather than papered over:
 *  - a tie-split event draws TWO StaveNotes, so it gets two boxes with the same `evIndex`;
 *  - grace notes (çarpma) are modifiers on the following note, never entries in `notes[]`, so
 *    they get no box and cannot be selected. Deleting their host takes them with it.
 */
export interface NoteBox {
  /** `NoteEvent.index` — the same 1-based handle updateEvent and the edit primitives match on. */
  evIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The box of one drawn triplet mark's INK, for its click target.
 *
 * ⚠ **`getBBox()` on the wrapping group is NOT the ink, and using it produced a target four times
 * too tall** (measured 2026-08-30 on a bracket-style page): a group's box is the union of its
 * children's, and two children lie about theirs.
 *
 *  - **A `<text>` reports its FONT's em box, not its glyph.** The bracket's "3" measured
 *    **12 × 160 px** — 12 px of digit inside the em box of a music font whose ascent and descent
 *    are enormous. The digit always sits in the mark's own gap, between the strokes, so the strokes
 *    already bound it: text children are skipped rather than measured.
 *  - **VexFlow emits a zero-height `<rect>` at the SVG ORIGIN inside its tuplet group** (0,0,95,0).
 *    Any box reaching x ≤ 0 or y ≤ 0 is rejected, the same rule and the same reason as `noteBoxOf`
 *    above: a drawn mark is never at the origin, so only an unpositioned element can claim to be.
 *
 * Falls back to the group's own box when nothing survives — a loose target beats no target, and the
 * caller has no other way to find the mark.
 */
export function markBoxOf(el: SVGGraphicsElement): { x: number; y: number; width: number; height: number } | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const kid of Array.from(el.querySelectorAll<SVGGraphicsElement>("path, rect, line, polygon, polyline"))) {
    let b: DOMRect;
    try {
      b = kid.getBBox();
    } catch {
      continue;
    }
    if (b.width <= 0 && b.height <= 0) continue;
    if (b.x <= 0 || b.y <= 0) continue; // unpositioned — see the note above
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.width);
    y2 = Math.max(y2, b.y + b.height);
  }
  if (x1 < x2 && y1 < y2) return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  try {
    const b = el.getBBox();
    return b.width > 0 ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
  } catch {
    return null;
  }
}

/**
 * One drawn triplet mark — the arc-and-"3" (or VexFlow bracket) over a group — as a click target.
 *
 * ⚠ It names the group by its FIRST MEMBER's `NoteEvent.index`, not by anything about the mark:
 * nothing about a tuplet is stored, so the mark is only ever a handle onto three ordinary notes.
 * Only groups `closedTupletAt` accepts get one — an unclosed run's bracket is the flag that the
 * MODEL misread something, and holding it could not mean anything.
 */
export interface TupletMarkBox {
  evIndex: number;
  /** True for a real three-member triplet; false for a mark the arithmetic never closed — the
   *  model's misread, which the sheet flags and the editor can repair or clear. */
  closes: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fallback half-width for a note whose bounding box VexFlow won't give us. */
export const NOTE_FALLBACK_W = 14;
/** Slack around a note's box so a click near the notehead still lands on it. */
export const NOTE_HIT_PAD = 3;
/** Slack around a drawn triplet mark so the "3" is comfortable to hit — the arc itself is a hairline
 *  and the digit is small, so the ink's own box is a poor target. */
export const MARK_HIT_PAD = 5;
/** Width of a held triplet's drag handle. Wide enough to grab without covering the note beside it
 *  — the handles sit OUTSIDE the group's frame, so a fat one would sit on the neighbour a drag is
 *  aiming at. */
export const TUPLET_HANDLE_W = 8;
/** Vertical drag (px) that moves a note one diatonic step — half a staff space, i.e. the real
 *  distance between a line and the space above it, so the note tracks the pointer. */
export const DRAG_PX_PER_STEP = STAFF_SPACE / 2;

/** The pitch of the TOP staff line in treble clef — the origin every insert height is measured
 *  from. VexFlow's `getYForLine(0)` is this line, and each further diatonic step down is
 *  {@link DRAG_PX_PER_STEP} px lower. */
export const TOP_LINE_PITCH = { letter: "F", octave: 5, alter: 0 } as const;
/** How far above the top line / below the bottom line an insert may be aimed, in diatonic steps —
 *  three ledger lines each way. The measure's click band is taller than that, and a click in its
 *  far corner should land on a readable note rather than four octaves out. (Line 0 is step 0 and
 *  line 4 is step 8, so the staff itself is 0..8.) */
export const INSERT_STEP_RANGE = { min: -6, max: 14 };
/** The ghost notehead's size, in SVG units — one staff space tall and a little wider, which is
 *  roughly a real notehead. ⚠ It is a plain oval, NOT a Bravura glyph: nothing inside `.kv-score`
 *  may set a font (CLAUDE.md), because the renderer crops training strips out of that container. */
export const GHOST_W = 12;
export const GHOST_H = 9;

/**
 * Which staff position a click at height `y` is aiming at, as a spelling — the insert tool's
 * pitch-from-height. `alter` comes from the drawn key signature, so a note inserted on Si under a
 * koma-bemol-Si signature is born koma-flat and the engraver prints nothing on it: the note looks
 * exactly like the place that was clicked. The palette's accidental tool changes it afterwards.
 */
export function pitchAtHeight(y: number, topLineY: number, signatureMap: Map<string, number>) {
  const raw = Math.round((y - topLineY) / DRAG_PX_PER_STEP);
  const steps = Math.max(INSERT_STEP_RANGE.min, Math.min(INSERT_STEP_RANGE.max, raw));
  const at = nudgePitch(TOP_LINE_PITCH, -steps); // down the screen is a lower pitch
  return { letter: at.letter, octave: at.octave, alter: signatureMap.get(at.letter) ?? 0, steps };
}

/**
 * The note's OWN ink — noteheads plus stem, and nothing a modifier claims.
 *
 * Built from public accessors that report real, positioned geometry, so it is immune to the
 * modifier-merge bug documented on `noteBoxOf`. Returns null when VexFlow has not formatted the note
 * far enough to answer (a rest has no stem, an unformatted note has no heads).
 */
export function inkBoxOf(n: StaveNote, evIndex: number): NoteBox | null {
  try {
    const { yTop, yBottom } = n.getNoteHeadBounds();
    if (!Number.isFinite(yTop) || !Number.isFinite(yBottom)) return null;
    let top = yTop;
    let bottom = yBottom;
    if (!n.isRest() && n.hasStem()) {
      const { topY, baseY } = n.getStemExtents();
      if (Number.isFinite(topY) && Number.isFinite(baseY)) {
        top = Math.min(top, topY, baseY);
        bottom = Math.max(bottom, topY, baseY);
      }
    }
    const width = n.getGlyphWidth();
    if (!Number.isFinite(width) || width <= 0) return null;
    return { evIndex, x: n.getAbsoluteX(), y: top, width, height: bottom - top };
  } catch {
    return null;
  }
}

/**
 * The clickable box of one drawn note, in the SVG's coordinate space (which is the overlay's too
 * — the container is never transformed; see the .kv-score rule in CLAUDE.md).
 *
 * ⚠ **VexFlow's own box cannot be trusted on a note that carries a grace group.**
 * `StaveNote.getBoundingBox()` is a MERGE over the note's modifiers, and `GraceNoteGroup` never
 * overrides `Element.getBoundingBox()` — which reads `this.x`/`this.y`, still **0** because the group
 * positions its inner notes and never itself. Merging a box at the SVG origin stretches the note's
 * box from the top-left of the score all the way to the note: measured on `beyati-delisin.json`,
 * 14 boxes (exactly its 14 grace notes) up to **949×1805 px**, each one starting at (0,0).
 *
 * Owner-reported 2026-08-08 as "one giant note I have to delete before I can edit", and that is
 * what it looks like: the box is a click target AND the tinted selection overlay, so the topmost
 * such box swallows every click over a third of the page. Nothing was wrong with the score — the
 * notes people deleted to escape it were real.
 *
 * So a box that reaches the origin is rejected in favour of the note's own ink. The test needs no
 * tuning and encodes the mechanism exactly: a drawn note is never at x ≤ 0 (the clef is left of it)
 * nor y ≤ 0 (the title is above it), so only an unpositioned modifier can put it there. If VexFlow
 * ever fixes `GraceNoteGroup`, this simply stops firing.
 */
export function noteBoxOf(n: StaveNote, evIndex: number, barTop: number, barHeight: number): NoteBox {
  try {
    const bb = n.getBoundingBox();
    const reachesOrigin = bb && (bb.getX() <= 0 || bb.getY() <= 0);
    if (bb && Number.isFinite(bb.getW()) && bb.getW() > 0 && !reachesOrigin) {
      return { evIndex, x: bb.getX(), y: bb.getY(), width: bb.getW(), height: bb.getH() };
    }
    const ink = inkBoxOf(n, evIndex);
    if (ink) return ink;
  } catch {
    // fall through to the stave-height fallback below
  }
  return { evIndex, x: n.getAbsoluteX() - NOTE_FALLBACK_W / 2, y: barTop, width: NOTE_FALLBACK_W, height: barHeight };
}

/** Where a single timed event sits on screen, so the playhead can follow playback. */
export interface NotePos {
  startMs: number;
  endMs: number;
  /** Which event is drawn here (`NoteEvent.index`) — the link a folded score needs, where the
   *  clock runs over a performance the page does not write out in order. */
  evIndex: number;
  /** Left x of the note within the SVG (same coordinate space as the overlay). */
  x: number;
  /** Top y of the playhead bar for this note's row (just above the top staff line). */
  top: number;
  /** Height of the playhead bar (staff height plus a small margin each side). */
  height: number;
}

/**
 * One sounding event of the PERFORMANCE, pointing at the written note that is drawn for it.
 *
 * A folded score writes a repeated bar once and plays it twice, so the drawn order is no longer
 * the playing order and the playhead cannot simply walk the notes it drew. The player hands over
 * this list instead — the clock's own order — and each step names the drawn note to sit on. The
 * cursor jumping back to the `‖:` is nothing more than two steps naming the same note.
 */
export interface PlayStep {
  /** `NoteEvent.index` in the WRITTEN document — the one this view drew. */
  evIndex: number;
  startMs: number;
  endMs: number;
}
