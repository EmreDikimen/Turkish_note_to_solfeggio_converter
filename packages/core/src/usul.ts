/**
 * Usul (rhythmic cycle) definitions and a usul-aware metronome track.
 *
 * The generic metronome clicks on a fixed quarter-note grid, which drifts against non-integer
 * usuls (a 9/8 aksak bar isn't four even beats). Here each usul carries its meter and its beat
 * GROUPING — e.g. aksak = 2+2+2+3 eighths — so the metronome can click on the felt beats and
 * accent the downbeat, locked to the bars (`groupMeasures`, derived from the score's offsets).
 *
 * Two tracks come out of one usul, and they are different things:
 *   - `buildMetronomeTrack` — a click on each felt BEAT. What a metronome does.
 *   - `buildPercussionTrack` — the usul's actual hand STROKES (düm / tek / ke), which is what a
 *     percussionist plays and what the piece is built on. Feature track F2, 2026-08-10.
 *
 * Both are pure data + scheduling math, so they live in the core and port to mobile unchanged;
 * only the sound-making is platform code.
 */

import type { NoteModelDocument } from "./types";
import { groupMeasures } from "./measures";

/**
 * One hand stroke of a usul.
 *   - `dum` — the low, open, strong-hand stroke (the drum's centre).
 *   - `tek` — the high, sharp stroke on the rim.
 *   - `ka`  — the weak-hand rim stroke, quieter than a `tek`. Also written "ke".
 */
export type Stroke = "dum" | "tek" | "ka";

/** A stroke and where it falls in the cycle. */
export interface UsulStroke {
  /** Position from the downbeat, in `den` units (so it is always < `num`). */
  at: number;
  stroke: Stroke;
}

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
  /**
   * The usul's hand strokes through one cycle, ascending by `at`. **Optional on purpose**: a usul
   * whose pattern has not been verified must fall back to the metronome rather than have one
   * invented for it. The UI reads the absence and disables percussion for that usul.
   *
   * ⚠ Not derivable from `pattern`. A beat grouping says where the pulses are; a usul says which
   * HAND plays each one, and düyek's `düm te-ke düm tek` puts two strokes inside one 2-unit group.
   */
  strokes?: UsulStroke[];
}

/**
 * Common usuls, smallest cycle first. Patterns are the conventional beat groupings.
 *
 * ## The `strokes` tables — VERIFIED BY EAR 2026-08-11, and how to keep them that way
 *
 * These are the *sade* (simple, unornamented) forms — the velvele, which subdivides the strokes
 * for a fuller sound, is deliberately not here. The risk in this file is **data, not code**: a
 * wrong Düyek is immediately obvious to anyone who knows the repertoire, and no test can catch it.
 * Each row below is marked with how much weight it will bear:
 *
 *   [standard] — the form cited the same way across the usual references. Change only with a
 *                source.
 *   [derived]  — the stroke placement is a reduction of this usul's own beat grouping (düm on the
 *                downbeat, tek on every other group). Rhythmically defensible, but it is our
 *                reading rather than a quoted pattern. **These are the ones to check first.**
 *
 * Source for the [standard] rows: the conventional simple forms as taught for TRT/AEU repertoire
 * (İ. H. Özkan, *Türk Mûsikîsi Nazariyatı ve Usûlleri*, the usul tables).
 *
 * ✅ **All ten were checked by the owner's ear on 2026-08-11 and accepted**, once the real drum
 * samples landed — the check waited for them on purpose, because judging a pattern through a drum
 * you dislike conflates two questions. Walkthrough: check 23 in docs/MANUAL_CHECKS.md.
 *
 * ⚠ **What that verdict is and is not.** It is one musician's ear, which is the only standard that
 * exists for this and is stronger than anything automatable — `tools/core/usul-test.ts` proves a
 * table is well-formed (inside the cycle, ascending, opening on a düm) and can never prove it is
 * musically right. It is **not** a citation. So: adding or editing a `strokes` array re-opens the
 * question and needs check 23 run again, and if a pattern is ever disputed, settle it with a source
 * rather than re-deriving it — re-deriving would only reproduce whatever the first reading got wrong.
 */
export const USULS: Usul[] = [
  // [standard] Düm Tek.
  { name: "nimsofyan", label: "Nîm Sofyan", num: 2, den: 4, pattern: [1, 1],
    strokes: [{ at: 0, stroke: "dum" }, { at: 1, stroke: "tek" }] },
  // [standard] Düm (2) Tek Tek.
  { name: "sofyan", label: "Sofyan", num: 4, den: 4, pattern: [2, 2],
    strokes: [{ at: 0, stroke: "dum" }, { at: 2, stroke: "tek" }, { at: 3, stroke: "tek" }] },
  // [standard] Düm (2) Tek (2) Tek (1). ⚠ Note this reads 2+2+1 while `pattern` groups 2+3 — the
  // strokes and the felt beats genuinely differ here, which is why the two tracks are separate.
  { name: "turkaksagi", label: "Türk Aksağı", num: 5, den: 8, pattern: [2, 3],
    strokes: [{ at: 0, stroke: "dum" }, { at: 2, stroke: "tek" }, { at: 4, stroke: "tek" }] },
  // [standard] Düm Tek Tek, in even pairs.
  { name: "yuruksemai", label: "Yürük Semâi", num: 6, den: 8, pattern: [3, 3],
    strokes: [{ at: 0, stroke: "dum" }, { at: 2, stroke: "tek" }, { at: 4, stroke: "tek" }] },
  // [derived] from the 3+2+2 grouping.
  { name: "devrihindi", label: "Devr-i Hindî", num: 7, den: 8, pattern: [3, 2, 2],
    strokes: [{ at: 0, stroke: "dum" }, { at: 3, stroke: "tek" }, { at: 5, stroke: "tek" }] },
  // [standard] Düm Te-ke Düm Tek — the te-ke pair is the whole character of düyek.
  { name: "duyek", label: "Düyek", num: 8, den: 8, pattern: [2, 2, 2, 2],
    strokes: [{ at: 0, stroke: "dum" }, { at: 2, stroke: "tek" }, { at: 3, stroke: "ka" },
              { at: 4, stroke: "dum" }, { at: 6, stroke: "tek" }] },
  // [standard] Düm Tek Düm Tek Tek (2+2+2+1+2).
  { name: "aksak", label: "Aksak", num: 9, den: 8, pattern: [2, 2, 2, 3],
    strokes: [{ at: 0, stroke: "dum" }, { at: 2, stroke: "tek" }, { at: 4, stroke: "dum" },
              { at: 6, stroke: "tek" }, { at: 7, stroke: "tek" }] },
  // [standard] Aksak's strokes at half speed — same shape, `den` 4 instead of 8.
  { name: "agiraksak", label: "Ağır Aksak", num: 9, den: 4, pattern: [2, 2, 2, 3],
    strokes: [{ at: 0, stroke: "dum" }, { at: 2, stroke: "tek" }, { at: 4, stroke: "dum" },
              { at: 6, stroke: "tek" }, { at: 7, stroke: "tek" }] },
  // [derived] from the 3+2+2+3 grouping, with the second half opening on a düm.
  { name: "curcuna", label: "Curcuna", num: 10, den: 8, pattern: [3, 2, 2, 3],
    strokes: [{ at: 0, stroke: "dum" }, { at: 3, stroke: "tek" }, { at: 5, stroke: "dum" },
              { at: 7, stroke: "tek" }] },
  // [derived] same grouping as curcuna, same reduction. ⚠ Aksak Semâi and Curcuna are NOT the same
  // usul despite sharing a meter here; if one of these two gets a real pattern, the other still needs its own.
  { name: "aksaksemai", label: "Aksak Semâi", num: 10, den: 8, pattern: [3, 2, 2, 3],
    strokes: [{ at: 0, stroke: "dum" }, { at: 3, stroke: "tek" }, { at: 5, stroke: "dum" },
              { at: 7, stroke: "tek" }] },
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

export interface PercussionHit {
  /** Hit time in musical milliseconds (at the natural tempo; the backend scales for speed). */
  ms: number;
  stroke: Stroke;
}

/**
 * Build the percussion track for a piece under a chosen usul: walk the bars and, in each, place
 * the usul's strokes at their positions in the cycle.
 *
 * This is `buildMetronomeTrack` with strokes in place of accents, on purpose — same bar walking,
 * same partial-bar rule (a stroke past the end of a short bar is dropped, so the pattern stays
 * locked to the actual bars instead of running over the barline). Where a piece's last bar is a
 * pickup or is cut short, both tracks thin out together.
 *
 * Returns an empty track for a usul with no verified `strokes`; the caller should offer the
 * metronome instead rather than invent a rhythm.
 *
 * @param wholeNoteMs duration of a whole note in ms at the natural tempo (one bar = lengthBeats × this).
 */
export function buildPercussionTrack(
  doc: NoteModelDocument,
  usul: Usul,
  wholeNoteMs: number
): PercussionHit[] {
  if (!usul.strokes?.length) return [];
  const hits: PercussionHit[] = [];
  for (const m of groupMeasures(doc)) {
    for (const s of usul.strokes) {
      const offsetWhole = s.at / usul.den; // stroke position, in whole-note units
      if (offsetWhole > m.lengthBeats + 1e-6) break; // past this (possibly short) bar
      hits.push({ ms: m.startMs + offsetWhole * wholeNoteMs, stroke: s.stroke });
    }
  }
  return hits;
}
