/**
 * Measure grouping — split a score into bars for the sheet view and the per-measure editor.
 *
 * How measures are found: SymbTr durations are fractions of a whole note (`durationBeats`).
 * A measure boundary falls where the running sum of those fractions reaches an integer
 * (verified: the sample has 32 measures of ~1.0 whole-note each). We accumulate beats
 * ourselves rather than trust the stored `offset`, so grouping stays correct after edits.
 */

import type { NoteEvent, NoteModelDocument } from "./types";

const EPS = 1e-6;

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
 * Group a document's sounding events (notes + rests) into measures by integer beat-boundary.
 * Meta events are skipped. A trailing partial group (no closing integer boundary) is still
 * returned as a final measure so nothing is lost.
 */
export function groupMeasures(doc: NoteModelDocument): Measure[] {
  const measures: Measure[] = [];
  let current: NoteEvent[] = [];
  let beatsInMeasure = 0;
  let cumulativeBeats = 0;
  let startMs = 0;
  let runningMs = 0;

  for (const ev of doc.events) {
    if (ev.kind === "meta") continue;
    current.push(ev);
    const b = eventBeats(ev);
    beatsInMeasure += b;
    cumulativeBeats += b;
    runningMs += ev.durationMs;

    // Boundary: cumulative duration landed on a whole number of whole-notes.
    if (Math.abs(cumulativeBeats - Math.round(cumulativeBeats)) < EPS) {
      measures.push({
        index: measures.length + 1,
        events: current,
        lengthBeats: Math.round(beatsInMeasure * 1e6) / 1e6,
        startMs,
      });
      current = [];
      beatsInMeasure = 0;
      startMs = runningMs;
    }
  }

  if (current.length > 0) {
    measures.push({
      index: measures.length + 1,
      events: current,
      lengthBeats: Math.round(beatsInMeasure * 1e6) / 1e6,
      startMs,
    });
  }
  return measures;
}

/**
 * Is an edited set of events still a valid measure? True when its total duration equals the
 * measure's required length (within epsilon). Drives the modal's Save-enabled / warning state.
 */
export function isMeasureValid(events: NoteEvent[], lengthBeats: number, eps = 1e-4): boolean {
  return Math.abs(measureBeats(events) - lengthBeats) < eps;
}
