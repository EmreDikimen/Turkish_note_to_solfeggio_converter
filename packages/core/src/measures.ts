/**
 * Measure grouping — split a score into bars for the sheet view and the per-measure editor.
 *
 * How measures are found: SymbTr's `offset` column is the engraver's own barline encoding —
 * an integer `offset` marks one printed barline (one usul cycle), so a 9/8 aksak bar ends at
 * offset 1.0, 2.0, … just like an 8/8 düyek bar does. We assign each event a stable `bar`
 * number from that (`assignBars`) once at load and group by it, so grouping is correct for
 * EVERY usul (not just whole-note ones) and survives edits (which zero out `offset`).
 *
 * A "accumulate durations to the next whole note" rule is used only as a fallback for data
 * whose `offset` is missing or unusable; it splits bars correctly only for whole-note usuls
 * (düyek), not for non-integer ones like aksak.
 */

import type { NoteEvent, NoteModelDocument } from "./types";

/** Tolerance for treating an `offset` as landing on an integer barline. */
const BAR_EPS = 1e-4;

export interface Measure {
  /** 1-based measure number. */
  index: number;
  /** The events in this measure (notes + rests; meta events are dropped). */
  events: NoteEvent[];
  /** Total length in whole-note units (e.g. 1.0). The editor must preserve this. */
  lengthBeats: number;
  /** Start time of the measure in ms (sum of all earlier durations). */
  startMs: number;
}

/** A single event's duration as a fraction of a whole note. */
export function eventBeats(ev: NoteEvent): number {
  return ev.durationBeats.den === 0 ? 0 : ev.durationBeats.num / ev.durationBeats.den;
}

/** Sum of a set of events' durations, in whole-note units. */
export function measureBeats(events: NoteEvent[]): number {
  return events.reduce((sum, ev) => sum + eventBeats(ev), 0);
}

/**
 * Is a document's `offset` column usable as a barline source? It must be present (max > 0)
 * and non-decreasing across the sounding events. Freshly-parsed SymbTr JSON satisfies this;
 * edited data (new notes get `offset` 0) does not — but by then bars are already assigned, so
 * `groupMeasures` uses the stored `bar` and never re-derives from the stale offsets.
 */
export function hasUsableOffsets(doc: NoteModelDocument): boolean {
  let prev = -Infinity;
  let max = 0;
  let count = 0;
  for (const ev of doc.events) {
    if (ev.kind === "meta") continue;
    count++;
    if (ev.offset < prev - BAR_EPS) return false; // not monotonic
    prev = ev.offset;
    if (ev.offset > max) max = ev.offset;
  }
  return count > 0 && max > BAR_EPS;
}

/**
 * Assign every event a stable 1-based `bar` number and return a new document.
 *
 * Primary source is SymbTr's `offset` (integer offset = one printed barline): an event that
 * ends at `offset` belongs to bar `floor(offset - ε) + 1`, so an event landing exactly on the
 * barline counts as the last event of the bar it fills. This automatically accounts for the
 * time meta/ornament rows occupy (they advance `offset` too), which the duration-sum fallback
 * cannot see. When `offset` is unusable, falls back to integer whole-note accumulation,
 * correct for whole-note usuls. Meta events inherit the current bar.
 *
 * Call this once when a document loads; thereafter the `bar` travels with each event through
 * edits, so measure grouping never has to re-read the (now stale) offsets.
 */
export function assignBars(doc: NoteModelDocument): NoteModelDocument {
  const useOffset = hasUsableOffsets(doc);
  const events: NoteEvent[] = [];
  let cumBeats = 0; // for the fallback path only
  let lastBar = 1;
  for (const ev of doc.events) {
    if (ev.kind === "meta") {
      events.push({ ...ev, bar: lastBar });
      continue;
    }
    let bar: number;
    if (useOffset) {
      bar = Math.max(1, Math.floor(ev.offset - BAR_EPS) + 1);
    } else {
      bar = Math.floor(cumBeats + BAR_EPS) + 1;
      cumBeats += eventBeats(ev);
    }
    lastBar = bar;
    events.push({ ...ev, bar });
  }
  return { ...doc, events };
}

/**
 * Group a document's sounding events (notes + rests) into measures. Meta events are skipped.
 * Grouping is by each event's stable `bar` number (see `assignBars`); if the document hasn't
 * had bars assigned yet, they're derived on the fly. Measures are renumbered sequentially, so
 * `Measure.index` is contiguous 1..N even if a bar number is skipped in the source.
 */
export function groupMeasures(doc: NoteModelDocument): Measure[] {
  const haveBars = doc.events.some((e) => e.kind !== "meta" && e.bar != null);
  const events = (haveBars ? doc : assignBars(doc)).events;

  const measures: Measure[] = [];
  let current: NoteEvent[] = [];
  let curBar: number | null = null;
  let startMs = 0;
  let runningMs = 0;

  const flush = () => {
    if (current.length === 0) return;
    measures.push({
      index: measures.length + 1,
      events: current,
      lengthBeats: Math.round(measureBeats(current) * 1e6) / 1e6,
      startMs,
    });
    current = [];
    startMs = runningMs;
  };

  for (const ev of events) {
    if (ev.kind === "meta") continue;
    if (curBar !== null && ev.bar !== curBar) flush();
    curBar = ev.bar ?? curBar;
    current.push(ev);
    runningMs += ev.durationMs;
  }
  flush();
  return measures;
}

/**
 * Is an edited set of events still a valid measure? True when its total duration equals the
 * measure's required length (within epsilon). Drives the modal's Save-enabled / warning state.
 */
export function isMeasureValid(events: NoteEvent[], lengthBeats: number, eps = 1e-4): boolean {
  return Math.abs(measureBeats(events) - lengthBeats) < eps;
}

export interface TimeSignature {
  /** Beats per bar (the top number). */
  num: number;
  /** Beat unit as a power-of-two note value (the bottom number; 8 = eighth-note beats). */
  den: number;
}

/**
 * Conventional meter for common usuls where a purely length-derived signature would be wrong
 * or ugly (e.g. sofyan reads 4/4, not 8/8; ağır aksak reads 9/4, not 18/8). Keyed by SymbTr's
 * normalized usul name. Anything not listed falls back to deriving the meter from the data.
 */
const USUL_SIGNATURES: Record<string, [number, number]> = {
  sofyan: [4, 4],
  nimsofyan: [2, 4],
  duyek: [8, 8],
  aksak: [9, 8],
  curcuna: [10, 8],
  aksaksemai: [10, 8],
  yuruksemai: [6, 8],
  agiraksak: [9, 4],
};

/**
 * Derive the meter (time signature) to print at the start of the staff.
 *
 * Primary source is the usul name (a known usul has a fixed conventional meter). For anything
 * else, fall back to the data: take the most common bar length (in whole-notes, from
 * `groupMeasures`) and express it as num/den over a power-of-two beat unit, preferring eighth
 * beats — so a 1.125-whole-note aksak bar reads 9/8 and a 1.25 curcuna bar reads 10/8.
 * Returns null when there are no measures to measure.
 */
export function deriveTimeSignature(doc: NoteModelDocument): TimeSignature | null {
  const key = (doc.usul || "").trim().toLowerCase();
  const known = USUL_SIGNATURES[key];
  if (known) return { num: known[0], den: known[1] };

  const measures = groupMeasures(doc);
  if (measures.length === 0) return null;
  const counts = new Map<number, number>();
  for (const m of measures) counts.set(m.lengthBeats, (counts.get(m.lengthBeats) ?? 0) + 1);
  let lenWhole = 0;
  let best = -1;
  for (const [len, c] of counts) {
    if (c > best) {
      best = c;
      lenWhole = len;
    }
  }
  if (!(lenWhole > 0)) return null;

  // Express the bar length (in whole-notes) as num/den; prefer eighth-note beats.
  for (const den of [8, 4, 16, 2, 32]) {
    const num = lenWhole * den;
    if (Math.abs(num - Math.round(num)) < 1e-4) return { num: Math.round(num), den };
  }
  return null;
}
