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
