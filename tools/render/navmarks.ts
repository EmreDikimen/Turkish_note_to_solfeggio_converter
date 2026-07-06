/**
 * Navigation-mark injection for Rung-2 training coverage (Phase 2).
 *
 * Real Turkish scores routinely carry da-capo navigation: the coda/segno glyphs (⊕ 𝄋), "D.C.",
 * and "Son" (the Turkish Fine) — see e.g. the neyzen.com engravings. SymbTr has NONE of them
 * (validated 2026-07-02: zero in all 2,200 files — same story as the repeat signs), so, exactly
 * like `injectRepeats`, we synthesize them: seeded random marks drawn onto a fraction of renders
 * with self-generated label tokens (`\segno` `\coda` `\dc` `\fine`). The injected marks are
 * visually correct engraving but musically arbitrary — fine for training, which only maps drawn
 * symbols to tokens; Phase-4 semantics never consumes these synthetic strips.
 *
 * Faithful scheme, like every other symbol: a mark sits on ONE measure edge, its token is emitted
 * at that drawn position (start-edge marks before the measure's notes, end-edge marks after), so
 * a crop showing the mark always carries the token and one that doesn't, doesn't.
 */

import { groupMeasures, type NoteModelDocument } from "@turkish-omr/core";
import { mulberry32 } from "./rng";
import type { RepeatSpan } from "./repeats";

/** One drawn navigation mark, in 1-based `Measure.index` numbering. */
export interface NavMark {
  type: "segno" | "coda" | "dc" | "fine";
  measure: number;
  /** Which edge of the measure the mark is drawn on: `start` = above the first note (like the
   *  ⊕ opening a coda section), `end` = at the right barline (like "D.C." / "Son"). */
  at: "start" | "end";
  /** Text marks (`dc`/`fine`) only: draw below the staff instead of above — real prints show
   *  both placements, so training should too. Glyph marks (⊕ 𝄋) always sit above. */
  below?: boolean;
}

/**
 * Seeded random navigation marks for one render. Deterministic per seed (fixed PRNG call
 * sequence — rejected candidates still consume their draws), so the same
 * `hashStr("{slug}:{t}:nav")` seed always yields the same marks.
 *
 * `repeatSpans` (detected + injected, the SAME ones the sheet draws) are excluded ±1 measure:
 * volta brackets and nav marks share the above-staff band, and stacking them would draw
 * colliding ink real engravers avoid.
 */
export function injectNavMarks(
  doc: NoteModelDocument,
  seed: number,
  repeatSpans: readonly RepeatSpan[] = [],
): NavMark[] {
  const indices = groupMeasures(doc).map((m) => m.index);
  if (indices.length < 4) return [];

  // Measures whose above-staff band is taken (repeat spans ±1, then each placed mark).
  const covered = new Set<number>();
  for (const s of repeatSpans) {
    for (let i = s.start - 1; i <= (s.volta2 ?? s.end) + 1; i++) covered.add(i);
  }

  const rand = mulberry32(seed);
  const marks: NavMark[] = [];
  const place = (m: NavMark) => {
    marks.push(m);
    covered.add(m.measure);
  };

  // 4–6 candidates — denser than a real page (which carries ~2–4 marks), deliberately: each type
  // gets only ~1/4 of attempts and the val split is just 20 pieces, so at 2–4 attempts the rarer
  // tokens (\segno \dc \fine) land under the audit floors (simulated 2026-07-06: val 6–8 < 10).
  const attempts = 4 + Math.floor(rand() * 3);
  for (let n = 0; n < attempts; n++) {
    const kind = Math.floor(rand() * 4); // 0 coda-pair, 1 dc, 2 fine, 3 segno
    if (kind === 0) {
      // Coda jump pair: ⊕ at the end of one measure, ⊕ at the start of a LATER one (the photo
      // pattern: "jump from here … to here"). Needs two free measures with a gap between them.
      const i = Math.floor(rand() * (indices.length - 2));
      const j = i + 2 + Math.floor(rand() * (indices.length - i - 2));
      if (covered.has(indices[i]!) || covered.has(indices[j]!)) continue;
      place({ type: "coda", measure: indices[i]!, at: "end" });
      place({ type: "coda", measure: indices[j]!, at: "start" });
    } else if (kind === 3) {
      // Segno 𝄋 above the start of a measure (the D.S. jump target).
      const i = Math.floor(rand() * indices.length);
      if (covered.has(indices[i]!)) continue;
      place({ type: "segno", measure: indices[i]!, at: "start" });
    } else {
      // "D.C." / "Son" text at a measure's right barline, above or below the staff.
      const i = Math.floor(rand() * indices.length);
      const below = rand() < 0.5;
      if (covered.has(indices[i]!)) continue;
      place({ type: kind === 1 ? "dc" : "fine", measure: indices[i]!, at: "end", below });
    }
  }
  return marks.sort((a, b) => a.measure - b.measure);
}

/** The marks drawn on one measure, split by edge (for draw + label emission — same order both
 *  sides, so a strip's pixels and label can't disagree). */
export function navMarksAt(index: number, marks: readonly NavMark[] | undefined) {
  const at = (edge: "start" | "end") => (marks ?? []).filter((m) => m.measure === index && m.at === edge);
  return { start: at("start"), end: at("end") };
}
