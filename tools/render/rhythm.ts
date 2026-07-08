/**
 * Rhythm-sign recovery from exact durations (Phase 2, strips_v2_2): triplet groups and
 * tied written pairs. Companion of repeats.ts/navmarks.ts, but purely DETECTED — these signs
 * are real data recovered from `durationBeats`, never injected, and (unlike repeat spans)
 * they are strictly intra-measure, so everything here is a pure function of one measure's
 * events. SheetView (drawing) and lilypond.ts (labels) call the SAME functions, so a strip's
 * pixels and label can't disagree.
 *
 *  - **Triplets (çarpma is separate — see EventKind "grace"):** SymbTr stores a triplet 8th as
 *    the exact fraction 1/12 (16th → 1/24, 32nd → 1/48). A run of such events summing to a
 *    plain value is one bracketed group: drawn with a VexFlow `Tuplet` ("3" bracket), labeled
 *    `\tup3 … \tupend`, and every member's WRITTEN duration is its actual value × 3/2
 *    (1/12 → an 8th under the bracket). A run that never sums plain keeps the old nearest-value
 *    snap — a graceful, rare fallback.
 *  - **Ties (long held values):** SymbTr writes 5/8, 5/4, 9/8, 5/16 … as ONE event, but the
 *    engraved form is a tied pair (5/8 = half + tied 8th). `tieSplitBeats` decomposes such a
 *    duration into drawable written values (greedy, largest first — all corpus cases split into
 *    exactly two). Notes get a tie arc + the `\tie` token between the written pair; RESTS are
 *    split too but never tied (rests aren't tied in engraving — they just sit side by side).
 *    The note model keeps the single event untouched (audio/`koma53` stays the source of
 *    truth); the decoder merges `x \tie x` back into one event.
 *
 * Everything works on the exact `durationBeats {num, den}` rational — never on the float
 * `eventBeats` value — because 3/12 must reduce to a plain 1/4 (NOT a tuplet member) and float
 * comparison can't tell 1/12 + 1/24 sums apart reliably.
 */

import type { NoteEvent } from "@turkish-omr/core";

/** A greatest-common-divisor for the exact fraction math below. */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** An exact duration as a reduced fraction of a whole note. */
interface Frac {
  n: number;
  d: number;
}

function reduce(n: number, d: number): Frac {
  if (d === 0 || n === 0) return { n: 0, d: 1 };
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function add(a: Frac, b: Frac): Frac {
  return reduce(a.n * b.d + b.n * a.d, a.d * b.d);
}

function fracOf(ev: NoteEvent): Frac {
  return reduce(ev.durationBeats.num, ev.durationBeats.den);
}

/**
 * Can a single written note/rest draw this reduced duration? True for the plain (1/2^k),
 * dotted (3/2^k) and double-dotted (7/2^k) values our DUR tables map, up to a whole note
 * (dotted/double-dotted whole included — both mappers emit "1."/"1..").
 */
function isDrawable(f: Frac): boolean {
  if (f.n <= 0) return false;
  if ((f.d & (f.d - 1)) !== 0) return false; // denominator must be a power of two
  return (f.n === 1 || f.n === 3 || f.n === 7) && f.n / f.d <= 1.75;
}

/** Is this event's duration a tuplet fraction (reduced denominator divisible by 3)? */
export function isTupletMember(ev: NoteEvent): boolean {
  if (ev.kind !== "note" && ev.kind !== "rest") return false;
  const f = fracOf(ev);
  return f.n > 0 && f.d % 3 === 0;
}

/**
 * The WRITTEN duration (in whole-note units) of a note inside a 3-bracket: its actual value
 * × 3/2, so a sounding 1/12 draws as a plain 8th under the bracket. Only meaningful for
 * events inside a detected group.
 */
export function tupletWrittenBeats(ev: NoteEvent): number {
  return (ev.durationBeats.num * 3) / (ev.durationBeats.den * 2);
}

/** One triplet group, as 0-based positions into the measure's `events` array (inclusive). */
export interface TupletGroup {
  from: number;
  to: number;
}

/**
 * Find the triplet groups in one measure's events. A group is a maximal run of consecutive
 * tuplet-fraction notes/rests that closes as soon as its exact sum is a plain power-of-two
 * value (3 × 1/12 = 1/4 → a group of three). Grace notes inside a run are tolerated as
 * members-by-position (they add no time and are drawn attached to their main note). A run
 * that ends — at a non-member or the measure's end — without summing plain yields NO group:
 * those events keep the legacy nearest-value snap.
 */
export function tupletGroupsIn(events: readonly NoteEvent[]): TupletGroup[] {
  const groups: TupletGroup[] = [];
  let start = -1;
  let sum: Frac = { n: 0, d: 1 };
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    // Grace notes take no time: inside an open run they ride along (drawn attached to their
    // main note); outside one they can neither open nor break a run.
    if (ev.kind === "grace") continue;
    if (isTupletMember(ev)) {
      if (start < 0) {
        start = i;
        sum = { n: 0, d: 1 };
      }
      sum = add(sum, fracOf(ev));
      // A group closes the moment its sum lands on a plain value.
      if (sum.n === 1 && (sum.d & (sum.d - 1)) === 0) {
        groups.push({ from: start, to: i });
        start = -1;
      }
    } else if (start >= 0) {
      // Run broken before summing plain: discard (snap fallback), resume normal scanning.
      start = -1;
    }
  }
  return groups;
}

/** Fast membership lookup built from `tupletGroupsIn` — event position → its group, if any. */
export function tupletGroupAt(groups: readonly TupletGroup[], pos: number): TupletGroup | undefined {
  return groups.find((g) => pos >= g.from && pos <= g.to);
}

/**
 * Does this event need a tied written pair? True for a note/rest whose duration is neither
 * drawable as one written value nor a tuplet fraction (those belong to `tupletGroupsIn`).
 */
export function needsTieSplit(ev: NoteEvent): boolean {
  if (ev.kind !== "note" && ev.kind !== "rest") return false;
  const f = fracOf(ev);
  return f.n > 0 && f.d % 3 !== 0 && !isDrawable(f);
}

/** Every value one written note can draw, largest first, for the greedy decomposition:
 *  for each base 1/2^k (whole … 1/64) its plain, dotted (3/2^(k+1)) and double-dotted
 *  (7/2^(k+2)) forms — the same family the DUR tables map. */
const DRAWABLE_DESC: Frac[] = (() => {
  const out: Frac[] = [];
  for (let k = 0; k <= 6; k++) {
    const d = 2 ** k;
    out.push({ n: 1, d }, { n: 3, d: d * 2 }, { n: 7, d: d * 4 });
  }
  return out.sort((a, b) => b.n / b.d - a.n / a.d);
})();

/**
 * Decompose an undrawable duration into written values (whole-note units), greedy largest
 * first — 5/8 → [1/2, 1/8], 9/8 → [1, 1/8], 5/16 → [1/4, 1/16], 5/4 → [1, 1/4]. Returns null
 * if it doesn't resolve within 3 written notes (keep the legacy snap then). Callers draw the
 * parts as tied notes (or adjacent rests) — see the module doc.
 */
export function tieSplitBeats(ev: NoteEvent): number[] | null {
  if (!needsTieSplit(ev)) return null;
  let rest = fracOf(ev);
  const parts: number[] = [];
  while (rest.n > 0 && parts.length < 3) {
    const pick = DRAWABLE_DESC.find((c) => c.n * rest.d <= rest.n * c.d); // c <= rest
    if (!pick) return null;
    parts.push(pick.n / pick.d);
    rest = reduce(rest.n * pick.d - pick.n * rest.d, rest.d * pick.d);
  }
  return rest.n === 0 && parts.length >= 2 ? parts : null;
}
