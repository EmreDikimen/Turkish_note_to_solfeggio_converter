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
 *    exactly two). Notes get a tie ARC drawn between the written pair; RESTS are split too but
 *    never tied (rests aren't tied in engraving — they just sit side by side).
 *    ⛔ The arc carries NO token: `\tie` is retired (owner, 2026-08-22) and the pair labels as
 *    two plain notes, so an arc is label-free ink exactly like a slur. Pitches and the summed
 *    duration are unchanged, so bar arithmetic is untouched; what is lost is playback holding
 *    the note (the app re-strikes where the page holds), which the owner accepted.
 *    The note model keeps the single event untouched (audio/`koma53` stays the source of
 *    truth); the decoder still merges a `x \tie x` written BEFORE the retirement back into one
 *    event, because old labels and old checkpoints must stay readable.
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
 * members-by-position (they add no time and are drawn attached to their main note).
 *
 * A run that ends — at a non-member or the measure's end — WITHOUT summing plain still yields a
 * group, over the members it does have. It used to yield none, and that was wrong in the one place
 * it matters: OMR output. A `\tup3` the model reads but cannot close (a dropped member, a stray
 * `\tupend`) left its notes on a 1/12-type duration with no group, so `vexDuration` snapped each to
 * the nearest plain value — the page then showed a rhythm that was definitely wrong, with no mark
 * saying so. Measured over the 1,704 decode caches on disk: **1,287 notes**, and 22.9% of
 * `\tup3`-bearing pages losing at least one. Drawing the incomplete group is not a guess at the
 * true rhythm — it is refusing to overwrite what the model actually read, and it puts a visible "3"
 * where a correction is needed.
 *
 * ⚠ This function is shared with the label serializer on purpose (CLAUDE.md: pixels and labels come
 * from one code path), so the change moves BOTH — a synthetic page that draws the bracket now also
 * labels it. On the synthetic side that is 10 runs in 219 bundled scores / 13,683 measures, and the
 * 217-score round-trip is what holds it honest.
 */
export function tupletGroupsIn(events: readonly NoteEvent[]): TupletGroup[] {
  const groups: TupletGroup[] = [];
  let start = -1;
  let last = -1; // last real (non-grace) member of the open run
  let sum: Frac = { n: 0, d: 1 };
  // A run that never sums plain still gets its bracket — see the note below on why discarding it
  // was worse than keeping it.
  const closeOpenRun = () => {
    if (start >= 0 && last >= start) groups.push({ from: start, to: last });
    start = -1;
  };
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
      last = i;
      sum = add(sum, fracOf(ev));
      // A group closes the moment its sum lands on a plain value.
      if (sum.n === 1 && (sum.d & (sum.d - 1)) === 0) {
        groups.push({ from: start, to: i });
        start = -1;
      }
    } else if (start >= 0) {
      closeOpenRun(); // broken by a non-member
    }
  }
  closeOpenRun(); // still open at the end of the measure
  return groups;
}

/** Fast membership lookup built from `tupletGroupsIn` — event position → its group, if any. */
export function tupletGroupAt(groups: readonly TupletGroup[], pos: number): TupletGroup | undefined {
  return groups.find((g) => pos >= g.from && pos <= g.to);
}

/* ── The editor's tuplet tool (editor step 7) ──────────────────────────────────────────────────
 *
 * Everything below answers "which notes", never "what happens to them" — the rewrite itself is
 * core's `scaleDurations`. It lives HERE, beside `tupletGroupsIn`/`isTupletMember`, so the tool's
 * idea of a triplet is literally the code that draws the bracket and writes the `\tup3` label. A
 * second copy in the app could disagree with the page, which is the failure mode CLAUDE.md's
 * "pixels and labels come from one code path" rule exists to prevent.
 *
 * ⚠ Nothing above this line changed. These are additions: a rendered strip and its label cannot
 * move because the editor grew a button.
 */

/**
 * Can this event START or JOIN a triplet the tool makes? Only a PLAIN 1/2^k value can — not a
 * dotted or double-dotted one, not a tie-split (5/8, 9/8 …), and not something already inside a
 * tuplet.
 *
 * This is arithmetic, not taste. Applying the tool multiplies each of three equal members by ⅔, so
 * the group sums to 3 × (⅔v) = 2v — and `tupletGroupsIn` closes a group only when its sum lands on
 * a plain power-of-two value. 2v is plain exactly when v is. A run of three dotted 8ths would sum
 * to 9/16, never close, and draw the "incomplete group" bracket that exists to flag a MODEL
 * mistake. Refusing it up front is what keeps that bracket meaningful.
 */
export function plainTupletBase(ev: NoteEvent): boolean {
  if (ev.kind !== "note" && ev.kind !== "rest") return false;
  const f = fracOf(ev);
  return f.n === 1 && f.d > 0 && (f.d & (f.d - 1)) === 0;
}

/**
 * The run the tuplet tool would make, starting at position `pos` in ONE MEASURE's events: that
 * event plus the next two real (non-grace) note/rest positions, when all three are
 * {@link plainTupletBase} and share one duration. Null when no valid run starts there — which is
 * what the palette dims and un-clicks, rather than popping an error.
 *
 * Three positions, because the drawn digit is hardcoded "3" (SheetView): a six-member run would
 * also sum plain, and would draw a bracket that lies about the rhythm.
 *
 * ⚠ `events` must be one measure's array (`Measure.events`), not the whole document — a tuplet is
 * strictly intra-measure, and passing the document would happily span a bar line.
 *
 * Grace notes take no time and are drawn attached to the note that follows them, so they are
 * skipped when counting members and left untouched by the edit — the same treatment they get
 * inside `tupletGroupsIn`.
 */
export function tupletRunFrom(events: readonly NoteEvent[], pos: number): number[] | null {
  const first = events[pos];
  if (!first || !plainTupletBase(first)) return null;
  const run = [pos];
  const want = fracOf(first);
  for (let i = pos + 1; i < events.length && run.length < 3; i++) {
    const ev = events[i]!;
    if (ev.kind === "grace") continue; // rides along, is not a member
    if (!plainTupletBase(ev)) return null;
    const f = fracOf(ev);
    if (f.n !== want.n || f.d !== want.d) return null; // every member has the same duration
    run.push(i);
  }
  return run.length === 3 ? run : null; // ran out of bar before three
}

/**
 * The CLOSED three-member group containing position `pos`, or null. This is what the tool removes:
 * clicking any member with the tuplet armed multiplies that group's durations back by ³⁄₂.
 *
 * Deliberately narrower than `tupletGroupsIn`, which also yields runs that never sum plain. Those
 * are the model's unclosed `\tup3`s — drawn with a bracket precisely because they are WRONG and
 * need a correction. Multiplying one back by ³⁄₂ would not restore anything; it would invent a
 * rhythm nobody read. Leave them to the note-value tools.
 */
export function closedTupletAt(events: readonly NoteEvent[], pos: number): TupletGroup | null {
  const g = tupletGroupAt(tupletGroupsIn(events), pos);
  if (!g) return null;
  const members = memberPositions(events, g);
  if (members.length !== 3) return null;
  // A closed group sums to a plain value by construction; check it anyway, because `tupletGroupsIn`
  // also emits runs that merely ENDED (see its doc), and one of those can hold three members.
  let sum: Frac = { n: 0, d: 1 };
  for (const i of members) sum = add(sum, fracOf(events[i]!));
  return sum.n === 1 && (sum.d & (sum.d - 1)) === 0 ? g : null;
}

/** The real (non-grace) member positions of a group, in order. */
export function memberPositions(events: readonly NoteEvent[], g: TupletGroup): number[] {
  const out: number[] = [];
  for (let i = g.from; i <= g.to; i++) {
    if (events[i]?.kind !== "grace") out.push(i);
  }
  return out;
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
