/**
 * Usul (rhythmic cycle) definitions and a usul-aware metronome track.
 *
 * The generic metronome clicks on a fixed quarter-note grid, which drifts against non-integer
 * usuls (a 9/8 aksak bar isn't four even beats). Here each usul carries its meter and its beat
 * GROUPING — e.g. aksak = 2+2+2+3 eighths — so the metronome can click on the felt beats and
 * accent the downbeat, locked to the bars (`groupMeasures`, derived from the score's offsets).
 *
 * This is the click-track slice of the larger "usul-based rhythm" idea (a real darbuka pattern
 * is future work; see ROADMAP). It's pure data + scheduling math, so it lives in the core and
 * ports to mobile unchanged.
 */

import type { NoteModelDocument } from "./types";
import { groupMeasures } from "./measures";

export interface Usul {
  /** Normalized key, matched against the score's `usul` field (lowercase, no diacritics). */
  name: string;
  /** Display name (with diacritics) for the dropdown. */
  label: string;
  /** Meter numerator / denominator, e.g. 9 / 8. */
  num: number;
  den: number;
  /**
   * Beat groupings within one cycle, in `den` units (so they sum to `num`). The metronome
   * clicks at the start of each group; e.g. aksak [2,2,2,3] → clicks at 0, 2, 4, 6 eighths.
   */
  pattern: number[];
}

/** Common usuls, smallest cycle first. Patterns are the conventional beat groupings. */
export const USULS: Usul[] = [
  { name: "nimsofyan", label: "Nîm Sofyan", num: 2, den: 4, pattern: [1, 1] },
  { name: "sofyan", label: "Sofyan", num: 4, den: 4, pattern: [2, 2] },
  { name: "turkaksagi", label: "Türk Aksağı", num: 5, den: 8, pattern: [2, 3] },
  { name: "yuruksemai", label: "Yürük Semâi", num: 6, den: 8, pattern: [3, 3] },
  { name: "devrihindi", label: "Devr-i Hindî", num: 7, den: 8, pattern: [3, 2, 2] },
  { name: "duyek", label: "Düyek", num: 8, den: 8, pattern: [2, 2, 2, 2] },
  { name: "aksak", label: "Aksak", num: 9, den: 8, pattern: [2, 2, 2, 3] },
  { name: "agiraksak", label: "Ağır Aksak", num: 9, den: 4, pattern: [2, 2, 2, 3] },
  { name: "curcuna", label: "Curcuna", num: 10, den: 8, pattern: [3, 2, 2, 3] },
  { name: "aksaksemai", label: "Aksak Semâi", num: 10, den: 8, pattern: [3, 2, 2, 3] },
];

/** Look up a usul by the score's (raw) usul name. */
export function findUsul(name: string): Usul | undefined {
  const key = (name || "").trim().toLowerCase();
  return USULS.find((u) => u.name === key);
}

export interface MetronomeClick {
  /** Click time in musical milliseconds (at the natural tempo; the backend scales for speed). */
  ms: number;
  /** True on a measure's downbeat (the first group), so the backend can accent it. */
  accent: boolean;
}

/**
 * Build the metronome click track for a piece under a chosen usul: walk the bars and, in each,
 * place a click at the start of every beat group (downbeat accented). Clicks that would fall
 * past a short/partial bar's length are skipped, so the track stays aligned to the actual bars.
 *
 * @param wholeNoteMs duration of a whole note in ms at the natural tempo (one bar = lengthBeats × this).
 */
export function buildMetronomeTrack(doc: NoteModelDocument, usul: Usul, wholeNoteMs: number): MetronomeClick[] {
  const clicks: MetronomeClick[] = [];
  for (const m of groupMeasures(doc)) {
    let acc = 0; // position within the cycle, in `den` units
    let first = true;
    for (const group of usul.pattern) {
      const offsetWhole = acc / usul.den; // group start, in whole-note units
      if (offsetWhole > m.lengthBeats + 1e-6) break; // past this (possibly short) bar
      clicks.push({ ms: m.startMs + offsetWhole * wholeNoteMs, accent: first });
      acc += group;
      first = false;
    }
  }
  return clicks;
}
