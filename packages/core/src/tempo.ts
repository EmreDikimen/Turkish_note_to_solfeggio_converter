/**
 * Tempo helpers: convert between musical note-values (beats) and milliseconds.
 *
 * Why this exists: playback uses `durationMs` ([scheduling.ts](./scheduling.ts)), but the
 * editor edits note-values (`durationBeats`). When a value changes we must recompute its ms
 * so playback stays in sync. SymbTr doesn't store a tempo, so we estimate one "whole-note
 * duration in ms" from the existing data (ms ÷ beats is ~constant within a piece).
 */

import type { NoteModelDocument } from "./types";
import { eventBeats } from "./measures";

/**
 * Estimate the duration of a whole note (in ms) for a piece: the median of
 * `durationMs ÷ beats` across its notes. Median (not mean) ignores the odd rounding outlier.
 */
export function estimateWholeNoteMs(doc: NoteModelDocument): number {
  const ratios: number[] = [];
  for (const ev of doc.events) {
    if (ev.kind !== "note") continue;
    const b = eventBeats(ev);
    if (b > 0 && ev.durationMs > 0) ratios.push(ev.durationMs / b);
  }
  if (ratios.length === 0) return 2000; // harmless fallback
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  return ratios.length % 2 ? ratios[mid]! : (ratios[mid - 1]! + ratios[mid]!) / 2;
}

/** Convert a note-value (num/den of a whole note) to milliseconds for the given piece. */
export function beatsToMs(num: number, den: number, doc: NoteModelDocument): number {
  if (den === 0) return 0;
  return Math.round((num / den) * estimateWholeNoteMs(doc));
}
