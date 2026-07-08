/**
 * Synthesis scheduling — platform-agnostic. Turns a NoteModelDocument into a flat
 * timeline of timed notes/rests. An `AudioBackend` adapter (Web Audio on web, a
 * native module on mobile) actually produces sound; the core never touches a
 * platform audio API.
 */

import type { NoteModelDocument } from "./types";
import { freqFromTuning } from "./tuning";

export interface ScheduledNote {
  /** Original event index (links back to the editable note model). */
  index: number;
  /** Start time relative to the timeline origin, in milliseconds. */
  startMs: number;
  durationMs: number;
  /** Frequency in Hz. NaN for rests (which produce silence). */
  freqHz: number;
  isRest: boolean;
}

export interface Timeline {
  notes: ScheduledNote[];
  totalMs: number;
}

/**
 * Build a playable timeline: turn the list of events into notes that each know WHEN they
 * start and at WHAT frequency.
 *
 * What/why: the note model stores *durations* but not absolute *start times* — note 5
 * doesn't say "I begin at 3.2s". Both playback (schedule each note) and the piano-roll
 * (place each note on the x/time axis) need start times, so we compute them once, here, in
 * the shared core — not duplicated in the audio code and the drawing code.
 * How it works: walk the events in order keeping a running `cursorMs` clock. For each
 * sounding event, emit a note starting at the current cursor, then advance the cursor by
 * that event's duration. Rests advance the clock but produce silence (freq = NaN). Meta
 * events are skipped entirely, and so are grace notes — they occupy no time and stay
 * silent until ornament synthesis exists. `totalMs` ends up as the full piece length.
 * Important: this is the bridge from "musical data" to "timed events"; the AudioBackend
 * below only ever sees this timeline, never the raw document.
 */
export function buildTimeline(doc: NoteModelDocument): Timeline {
  const notes: ScheduledNote[] = [];
  let cursorMs = 0;
  for (const ev of doc.events) {
    if (ev.kind === "meta" || ev.kind === "grace") continue;
    const isRest = ev.kind === "rest";
    notes.push({
      index: ev.index,
      startMs: cursorMs,
      durationMs: ev.durationMs,
      freqHz: isRest ? Number.NaN : freqFromTuning(ev.koma53, doc.tuning),
      isRest,
    });
    cursorMs += ev.durationMs;
  }
  return { notes, totalMs: cursorMs };
}

/**
 * Platform audio adapter. The core hands it a timeline; the implementation
 * schedules and renders it. Web uses Web Audio; mobile uses a native backend.
 */
export interface AudioBackend {
  /** Schedule and start playback of a timeline. Resolves when playback ends. */
  play(timeline: Timeline): Promise<void>;
  /** Stop playback immediately. */
  stop(): void;
}
