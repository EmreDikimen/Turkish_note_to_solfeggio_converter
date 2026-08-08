/**
 * Event-level edit primitives — the ONE place a note's pitch or duration is rewritten.
 *
 * Why this module exists: the app grew two disjoint edit vocabularies over the same document.
 * The piano-roll patched `koma53` + `freqHz` and left `noteName` alone, while `MeasureEditModal`
 * rebuilt the whole event from an explicit `{letter, octave, alter}` spelling. Since the sheet
 * reads its staff position from `parseNoteName(ev.noteName)`, the roll's edits moved the SOUND
 * and not the NOTEHEAD. These functions compose the existing core helpers (`komaOf`, `spellNote`,
 * `komaToName`, `freqFromTuning`, `beatsToMs`) so a pitch edit can no longer half-apply, whoever
 * makes it.
 *
 * Everything here is pure: an event (or a document) in, a new one out. Nothing mutates.
 */

import { beatsToMs } from "./tempo";
import { assignBars, groupMeasures } from "./measures";
import { komaOf, komaToName, parseNoteName, spellNote } from "./notation";
import { freqFromTuning } from "./tuning";
import type { DurationBeats, NoteEvent, NoteModelDocument, TuningParams } from "./types";

/** Diatonic letters in staff order; `nudgePitch` walks this and wraps the octave at the seam. */
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

/**
 * A note's pitch as the document actually stores it: staff position (letter + octave) and the
 * comma alteration, kept SEPARATE. Keeping them apart is what makes "move the note up a step and
 * keep its accidental" an ordinary operation rather than a special case.
 */
export interface Spelling {
  letter: string;
  octave: number;
  alter: number;
}

/** Read an event's spelling back out of its `noteName`. Null for rests, graces without a name,
 *  and anything unparseable — callers skip those rather than guessing. */
export function spellingOf(ev: NoteEvent): Spelling | null {
  const p = parseNoteName(ev.noteName);
  return p ? { letter: p.letter, octave: p.octave, alter: p.alterCommas } : null;
}

/**
 * Re-pitch an event from an explicit spelling, rewriting every derived field together:
 * `koma53` (sounding pitch), `noteName` (which is what the staff reads for its notehead),
 * `noteAE` and `freqHz`.
 *
 * The spelling is preserved exactly — picking Fa5 +5 commas yields "Fa5#5", never the enharmonic
 * "Sol5b4" — which is the whole reason the editor stores letter/octave/alter instead of a koma.
 *
 * ⚠ `noteAE` carries the EXACT alteration here, matching `tools/render/stitch.ts` (the producer of
 * every decoded page) and what `MeasureEditModal` always wrote. The Python exporter instead
 * AEU-SNAPS it, so a bundled SymbTr score can hold `noteName "Si4b2"` next to `noteAE "B4b1"`
 * (152 of 2,297 notes in the bundled scores, every one explained by that snap). Nothing in the app
 * reads `noteAE` except the piano-roll's hover label, so the divergence is cosmetic — but it is
 * real, it predates this module, and unifying it is a separate decision.
 */
export function withPitch(ev: NoteEvent, s: Spelling, tuning: TuningParams): NoteEvent {
  const koma = komaOf(s.letter, s.octave, s.alter);
  return {
    ...ev,
    koma53: koma,
    noteName: spellNote(s.letter, s.octave, s.alter, "solfege"),
    noteAE: spellNote(s.letter, s.octave, s.alter, "western"),
    freqHz: Math.round(freqFromTuning(koma, tuning) * 1e4) / 1e4,
  };
}

/**
 * Set an event's ALTERATION, leaving its staff position (letter + octave) where it is — the
 * palette's accidental tool: arm koma-bemol, click a note, that note is now koma-flat.
 *
 * The mirror image of {@link nudgePitch}, which moves the position and carries the alteration.
 * Rests and anything unspellable come back untouched, so a click that lands on one is a no-op
 * rather than an invention.
 */
export function withAlter(ev: NoteEvent, alter: number, tuning: TuningParams): NoteEvent {
  const s = spellingOf(ev);
  if (!s || ev.kind === "rest") return ev;
  if (s.alter === alter) return ev; // no-op edits must not become undo entries
  return withPitch(ev, { ...s, alter }, tuning);
}

/**
 * Re-pitch from an ABSOLUTE comma value, choosing the most natural spelling for it
 * (`komaToName` picks the smallest alteration). This is the piano-roll's operation: a vertical
 * drag knows a koma, not a spelling. Unparseable komas leave the event untouched.
 */
export function withKoma(ev: NoteEvent, koma: number, tuning: TuningParams): NoteEvent {
  const p = parseNoteName(komaToName(koma, "solfege"));
  if (!p) return ev;
  return withPitch(ev, { letter: p.letter, octave: p.octave, alter: p.alterCommas }, tuning);
}

/** Set an event's note-value, keeping `durationMs` (playback) and `durationBeats` (engraving)
 *  in step. The piece's own tempo supplies the conversion. */
export function withDurationBeats(ev: NoteEvent, d: DurationBeats, doc: NoteModelDocument): NoteEvent {
  return { ...ev, durationBeats: { num: d.num, den: d.den }, durationMs: beatsToMs(d.num, d.den, doc) };
}

/**
 * Turn an event into a REST of the given value — the palette's rest tools (editor step 9b).
 *
 * A rest is not a note with the sound switched off: the exporter writes `kind: "rest"` with
 * `koma53: -1`, `noteName`/`noteAE` "Es" and a null `freqHz`, and everything downstream keys off
 * that shape (`buildTimeline` skips it, the engraver draws a rest glyph, the label serializer emits
 * a rest token). So the whole pitch side is cleared here rather than left behind to confuse a later
 * reader — a rest carrying a stale `noteName` would engrave as a rest and sound as silence while
 * still claiming to be Do5.
 *
 * The lyric goes with it: a syllable is sung on a note, and nothing sings on a rest.
 */
export function toRest(ev: NoteEvent, d: DurationBeats, doc: NoteModelDocument): NoteEvent {
  return withDurationBeats(
    { ...ev, kind: "rest", koma53: -1, noteName: "Es", noteAE: "Es", freqHz: null, lyric: "" },
    d,
    doc,
  );
}

/**
 * Turn an event into a NOTE at an explicit spelling and value — the inverse of {@link toRest}, for
 * the case the model read a note as a rest.
 *
 * The pitch has to be supplied because a rest does not carry one: the editor takes it from the
 * HEIGHT of the click that lands on the rest, the same mapping the insert tool uses, so the note
 * appears where the pointer was.
 */
export function toNote(
  ev: NoteEvent,
  s: Spelling,
  d: DurationBeats,
  doc: NoteModelDocument,
): NoteEvent {
  return withPitch(withDurationBeats({ ...ev, kind: "note" }, d, doc), s, doc.tuning);
}

/** Greatest common divisor, so a scaled duration comes out reduced (2/24 → 1/12). */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Multiply the named events' durations by a fraction, in one edit — the editor's tuplet tool
 * (step 7). Making a triplet is `{num: 2, den: 3}` on three equal notes (a 1/8 becomes a 1/12);
 * undoing one is `{num: 3, den: 2}` on the same three.
 *
 * `\tup3` is not an object anywhere in this codebase — it is arithmetic. Nothing is stored: the
 * bracket and the italic 3 are drawn because `tupletGroupsIn` finds a run of tuplet fractions
 * summing to a plain value, and the label serializer writes `\tup3` for the same reason. So the
 * whole edit is these durations, and there is no schema change.
 *
 * Which events to name is `tupletRunFrom` / `closedTupletAt` in `tools/render/rhythm.ts` — the
 * module that draws the bracket. This function asks no questions about validity; hand it three
 * equal plain values or it will happily produce something unengravable.
 *
 * The result is REDUCED, so `isTupletMember` (which reduces before testing) and anything reading
 * the raw fraction agree. `durationMs` moves with `durationBeats` through `withDurationBeats`, so
 * the sheet and the playback timeline cannot drift apart — the bug shape this module exists for.
 *
 * The bar is left SHORT (or long) on purpose: three 1/8s become 3/12 = 1/4 where 3/8 stood. Edits
 * absorb into their bar and bar lines never move; the indicator for that is the editor's own
 * off-meter mark.
 */
export function scaleDurations(
  doc: NoteModelDocument,
  indices: readonly number[],
  mul: DurationBeats,
): NoteModelDocument {
  const want = new Set(indices);
  if (want.size === 0) return doc;
  const events = doc.events.map((ev) => {
    if (!want.has(ev.index)) return ev;
    const num = ev.durationBeats.num * mul.num;
    const den = ev.durationBeats.den * mul.den;
    const g = gcd(num, den) || 1;
    return withDurationBeats(ev, { num: num / g, den: den / g }, doc);
  });
  return { ...doc, events };
}

/**
 * Move a note up or down the staff by whole diatonic steps, CARRYING its accidental. A note
 * spelled Si4 koma-flat scrolled up one step becomes Do5 koma-flat: the staff position moves,
 * the alteration does not. `steps` may be any integer; the octave wraps at the B–C seam.
 */
export function nudgePitch(s: Spelling, steps: number): Spelling {
  const at = LETTERS.indexOf(s.letter);
  if (at < 0) return s;
  const abs = at + steps;
  // Floor division so negative steps wrap downward correctly (-1 → octave below, letter B).
  const octaveShift = Math.floor(abs / LETTERS.length);
  const letter = LETTERS[((abs % LETTERS.length) + LETTERS.length) % LETTERS.length]!;
  return { letter, octave: s.octave + octaveShift, alter: s.alter };
}

/**
 * Renumber events 1..N so `index` stays a usable handle after an insert or delete.
 *
 * ⚠ Indices are POSITIONS, not identities: after this runs, an index held from before the edit
 * may name a different event. Callers holding a selection must re-derive it (the editor clears
 * the selection on undo/redo for exactly this reason).
 */
export function renumber(events: NoteEvent[]): NoteEvent[] {
  return events.map((ev, i) => ({ ...ev, index: i + 1 }));
}

/**
 * Delete one event by index, and with it any grace notes (çarpma) that lead into it.
 *
 * A grace occupies no time and belongs to the note that FOLLOWS it, so a grace whose host is
 * gone has nothing to attach to and would engrave as a zero-length real note. Dropping it with
 * the host is what `MeasureEditModal` already did in effect (a grace whose `hostIndex` matched
 * no surviving row was silently discarded on save) — here it is explicit and testable.
 *
 * Bar numbers are untouched: a deletion leaves its bar SHORT and bar lines never move.
 */
export function deleteEvent(doc: NoteModelDocument, index: number): NoteModelDocument {
  const at = doc.events.findIndex((ev) => ev.index === index);
  if (at < 0) return doc;
  // Walk back over the unbroken run of graces immediately before the host — those are its.
  let from = at;
  while (from > 0 && doc.events[from - 1]!.kind === "grace") from--;
  const events = [...doc.events.slice(0, from), ...doc.events.slice(at + 1)];
  return { ...doc, events: renumber(events) };
}

/**
 * Insert an event INTO a bar — before the event `beforeEventIndex` names, or at the end of the bar
 * when that is null. The palette's insert-on-empty-space (editor step 6).
 *
 * The bar is left OVER its length, exactly as `deleteEvent` leaves one short: an edit absorbs into
 * its bar and bar lines never move. Nothing here checks a total.
 *
 * Three rules make the splice safe, and each is a way this could go quietly wrong:
 *
 *  1. **The position is resolved inside the target measure only.** `groupMeasures` starts a new
 *     measure whenever the `bar` number CHANGES, so a note stamped bar 7 spliced anywhere outside
 *     bar 7's own run would cut one bar into two on the page — bar lines moving, which is the one
 *     thing the whole absorb rule exists to prevent.
 *  2. **A leading grace run belongs to the note that follows it**, so inserting before a note means
 *     inserting before its graces too (the mirror of `deleteEvent`'s walk-back) — but never past the
 *     measure's own first event, or rule 1 breaks.
 *  3. **The new event takes the bar's number**, not one derived from its position, because `offset`
 *     is stale the moment anything is edited (see `assignBars`). ⚠ That is also why a document
 *     whose events carry no `bar` yet is run through `assignBars` FIRST: `groupMeasures` derives
 *     bars on the fly but throws the copies away, so stamping the new event alone would leave one
 *     numbered event in an unnumbered array — and grouping, which flushes on every change, would
 *     then cut a bar at the insert. The app assigns bars at load; this keeps the primitive safe on
 *     its own.
 *
 * Unknown measure or unknown `beforeEventIndex` → the document comes back untouched, so a stale
 * click cannot invent a note in the wrong bar.
 */
export function insertInMeasure(
  doc: NoteModelDocument,
  ev: NoteEvent,
  measureIndex: number,
  beforeEventIndex: number | null,
): NoteModelDocument {
  const based = withBars(doc);
  const at = splicePositionIn(based, measureIndex, beforeEventIndex);
  if (at == null) return doc;
  const bar = groupMeasures(based).find((m) => m.index === measureIndex)!.events.find((e) => e.bar != null)?.bar;
  const events = [...based.events];
  events.splice(at, 0, { ...ev, bar });
  return { ...based, events: renumber(events) };
}

/**
 * The `index` the event {@link insertInMeasure} inserts will END UP with, or null when the insert
 * would be refused — so a caller can select what it just added.
 *
 * It has to be asked separately because `renumber` rebuilds every event, so the inserted object
 * cannot be found again by identity afterwards. Both functions read the position from the same
 * {@link splicePositionIn}, so the answer cannot drift from what actually happens.
 */
export function insertIndexIn(
  doc: NoteModelDocument,
  measureIndex: number,
  beforeEventIndex: number | null,
): number | null {
  const at = splicePositionIn(withBars(doc), measureIndex, beforeEventIndex);
  return at == null ? null : at + 1; // renumber makes `index` the 1-based array position
}

/** Bars assigned if they are not already — see rule 3 on {@link insertInMeasure}. */
function withBars(doc: NoteModelDocument): NoteModelDocument {
  return doc.events.some((e) => e.kind !== "meta" && e.bar != null) ? doc : assignBars(doc);
}

/** Where in `doc.events` an insert into this bar lands, applying rules 1 and 2 above. Null when
 *  the measure or the target is not there. */
function splicePositionIn(
  doc: NoteModelDocument,
  measureIndex: number,
  beforeEventIndex: number | null,
): number | null {
  const measure = groupMeasures(doc).find((m) => m.index === measureIndex);
  if (!measure || measure.events.length === 0) return null;

  const firstAt = doc.events.findIndex((e) => e.index === measure.events[0]!.index);
  if (firstAt < 0) return null;

  if (beforeEventIndex == null) {
    // End of the bar: just past its last event.
    const last = measure.events[measure.events.length - 1]!;
    return doc.events.findIndex((e) => e.index === last.index) + 1;
  }
  if (!measure.events.some((e) => e.index === beforeEventIndex)) return null; // not this bar's
  let at = doc.events.findIndex((e) => e.index === beforeEventIndex);
  if (at < 0) return null;
  // Rule 2: step back over the graces leading into that note, but not out of the measure.
  while (at > firstAt && doc.events[at - 1]!.kind === "grace") at--;
  return at;
}
