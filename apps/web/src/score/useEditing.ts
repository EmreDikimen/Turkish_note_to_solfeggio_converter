/**
 * Editing the written score: every tool and gesture of the editor (pitch, insert, delete, tuplets,
 * repeat and navigation signs, undo/redo, the armed palette) and the keyboard shortcuts. Each one
 * edits `doc` through `history`, so undo covers all of them. Moved out of App.tsx on 2026-11-20;
 * the statements are unchanged.
 */
import type { DocHistory } from "./useDocHistory";
import { useEffect, type SetStateAction } from "react";
import {
  measureOfEvent,
  type NoteEvent,
  withKoma,
  spellingOf,
  withPitch,
  nudgePitch,
  toggleDot,
  withDurationBeats,
  toRest,
  toNote,
  transpose as transposeDoc,
  withAlter,
  insertInMeasure,
  insertIndexIn,
  groupMeasures,
  scaleDurations,
  deleteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { TRANSPOSE_SPELLING } from "../browser/urlParams";
import { drawnTupletAt, memberPositions, tupletRunFrom, tupletEdgeTo } from "@turkish-omr/core/labels/rhythm";
import {
  type SignTool,
  placeMark,
  placeRepeat,
  type StructureMark,
  removeMark,
} from "@turkish-omr/core/labels/structure-edit";
import type { Tool, PaletteRefusal } from "../ui/EditPalette";
import type { ScoreStructure } from "@turkish-omr/core/labels/stitch";

// What a single drag can change on a note: its pitch (comma) and/or its duration.
export type NoteEdit = Partial<Pick<NoteEvent, "koma53" | "durationMs">>;

export function useEditing({
  armed,
  doc,
  editMode,
  history,
  onStop,
  repeatAnchor,
  selectedTuplet,
  setArmed,
  setLastEditMeasure,
  setRefused,
  setRepeatAnchor,
  setSelectedNote,
  setSelectedTuplet,
  setTupletAnchor,
  structure,
  transpose,
  tupletAnchor,
}: {
  armed: Tool | null;
  doc: NoteModelDocument | null;
  editMode: boolean;
  history: DocHistory;
  onStop: () => void;
  repeatAnchor: number | null;
  selectedTuplet: number | null;
  setArmed: (value: SetStateAction<Tool | null>) => void;
  setLastEditMeasure: (value: SetStateAction<number | null>) => void;
  setRefused: (value: SetStateAction<PaletteRefusal | null>) => void;
  setRepeatAnchor: (value: SetStateAction<number | null>) => void;
  setSelectedNote: (value: SetStateAction<number | null>) => void;
  setSelectedTuplet: (value: SetStateAction<number | null>) => void;
  setTupletAnchor: (value: SetStateAction<number | null>) => void;
  structure: ScoreStructure | null;
  transpose: number;
  tupletAnchor: number | null;
}) {

  // Undo/redo from the keyboard, the way every editor does it. Skipped while the focus is in a
  // text field (the browser's own undo belongs to that field) and outside edit mode.
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) onRedo();
      else onUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // No dependency array on purpose: onUndo/onRedo are plain functions rebuilt each render, so
    // re-binding a single keydown listener per render is cheaper than memoising the whole chain.
  });

  // Apply one note edit from the piano-roll. This is the heart of "correct OMR mistakes".
  // What/why: edits must flow back into `doc` so that BOTH the view and playback reflect
  // them. We update immutably (build a new doc) so React re-renders; the timeline + redraw
  // recompute automatically. Editing also stops any current playback, since the old scheduled
  // audio no longer matches what's on screen.
  //
  // A pitch drag goes through core's `withKoma`, which rewrites `noteName`/`noteAE` alongside
  // `koma53`/`freqHz`. Before that, this function patched the koma only — and since the sheet
  // reads its staff position from `parseNoteName(ev.noteName)`, a roll drag moved the SOUND and
  // left the notehead behind. ⚠ The duration drag still writes `durationMs` alone and leaves
  // `durationBeats` (what the sheet engraves) stale; fixing that means snapping a continuous
  // drag to a note value, which is the palette's job, not this one.
  /**
   * Remember which bar an edit landed in, so the palette's Çal can start there.
   *
   * Read from `doc` as it is BEFORE the edit, on purpose: for a delete the bar is only knowable
   * beforehand, and a duration/accidental/pitch change never moves a note into another bar. An
   * index we cannot place leaves the pointer where it was rather than resetting it to the top.
   */
  function markEdited(index: number) {
    if (!doc) return;
    const m = measureOfEvent(doc, index);
    if (m != null) setLastEditMeasure(m);
  }

  function updateEvent(index: number, patch: NoteEdit) {
    onStop();
    markEdited(index);
    // Edits arrive in the DISPLAYED pitch space. When the staff is rewritten by the transpose,
    // map the dragged pitch back to the stored (base) score before applying.
    const shift = transpose;
    // One drag = one undo entry: a pointer-move emits an edit per frame, and
    // stepping back through forty of them is not undo.
    history.apply(
      (prev) => {
        const events = prev.events.map((ev) => {
          if (ev.index !== index) return ev;
          const next: NoteEvent = patch.durationMs !== undefined ? { ...ev, durationMs: patch.durationMs } : ev;
          if (patch.koma53 === undefined || next.kind !== "note") return next;
          return withKoma(next, patch.koma53 - shift, prev.tuning);
        });
        return { ...prev, events };
      },
      { coalesce: `roll:${index}:${patch.koma53 !== undefined ? "pitch" : "duration"}` },
    );
  }

  /** Edit mode: move the selected note up (+1) or down (−1) diatonic steps, keeping its
   *  accidental. The doc stores pitch as letter+octave+alter separately, so carrying the
   *  alteration is the ordinary operation — see core's `nudgePitch`. */
  function onNudgePitch(index: number, steps: number) {
    onStop();
    markEdited(index);
    history.apply(
      (prev) => {
        const events = prev.events.map((ev) => {
          if (ev.index !== index || ev.kind !== "note") return ev;
          const s = spellingOf(ev);
          return s ? withPitch(ev, nudgePitch(s, steps), prev.tuning) : ev;
        });
        return { ...prev, events };
      },
      { coalesce: `nudge:${index}` }, // one wheel gesture, one undo
    );
  }

  /**
   * Edit mode: apply the ARMED palette tool to the clicked note.
   *
   * A note value goes through `withDurationBeats`, which moves `durationMs` and `durationBeats`
   * together — the sheet engraves the beats and playback reads the ms, and an edit that moved only
   * one of them is exactly the bug shape `edits.ts` exists to prevent. An accidental goes through
   * `withAlter`: the staff position stays, the alteration changes.
   *
   * The bar is left OVER or UNDER its length on purpose — an edit absorbs into its bar and bar
   * lines never move. The warning for that is step 8, and it needs the derived meter, not
   * `Measure.lengthBeats` (which is computed from the bar's own contents and so is true by
   * construction).
   *
   * ⚠ Transpose: the sheet draws `displayDoc`, so an alteration picked on screen is not the stored
   * one when the staff has been rewritten. The edit is built in DISPLAY space and mapped back with
   * the same `transposeDoc(…, -transpose)` round-trip `onInsertNote` uses. A duration needs none
   * of it, and `onNudgePitch` escapes it only because a nudge is relative.
   */
  function onApplyTool(index: number, pitchAt?: { letter: string; octave: number; alter: number }) {
    // The tuplet has its own two-click gesture (`onTupletPick`), and a SIGN belongs to a bar
    // rather than to a note (`onPlaceMark`) — neither comes through here.
    if (!armed || armed.kind === "tuplet" || armed.kind === "structure" || !doc) return;
    // ⭐ The DOT (owner, 2026-09-28). Decided before anything moves, because a refusal is the one
    // outcome that must say WHY in the hint line — a triplet member or a double-dotted note has no
    // single dot to add or remove, and a click that silently did nothing would teach nothing.
    // Works on a rest too: a dotted rest is as ordinary as a dotted note.
    if (armed.kind === "dot") {
      const ev = doc.events.find((e) => e.index === index);
      const dotted = ev ? toggleDot(ev.durationBeats) : null;
      if (!dotted) {
        setRefused("notDottable");
        return;
      }
      setRefused(null);
      onStop();
      markEdited(index);
      history.apply((prev) => {
        const at = prev.events.findIndex((e) => e.index === index);
        if (at < 0) return prev;
        const events = [...prev.events];
        events[at] = withDurationBeats(prev.events[at]!, dotted, prev);
        return { ...prev, events };
      });
      return;
    }
    onStop();
    markEdited(index);
    const shift = transpose;
    history.apply((prev) => {
      const at = prev.events.findIndex((ev) => ev.index === index);
      if (at < 0) return prev;
      const stored = prev.events[at]!;
      let next: NoteEvent;
      if (armed.kind === "duration") {
        const value = { num: armed.num, den: armed.den };
        if (armed.rest) {
          // A rest tool over anything makes a rest of that value — the pitch side is cleared by
          // the primitive, not left behind to claim a note nobody can hear.
          next = toRest(stored, value, prev);
        } else if (stored.kind === "rest") {
          // The inverse, for a rest the model read where a note belongs. A rest carries no pitch,
          // so it comes from the HEIGHT of the click — the same mapping the insert tool uses, in
          // DISPLAY space, so the finished event is mapped back like every other spelling here.
          if (!pitchAt) return prev;
          const shown = toNote(stored, pitchAt, value, prev);
          next = shift ? transposeDoc({ ...prev, events: [shown] }, -shift, TRANSPOSE_SPELLING).events[0]! : shown;
        } else {
          next = withDurationBeats(stored, value, prev);
        }
      } else {
        if (stored.kind === "rest") return prev; // a rest takes no accidental
        // Alter in the space the user is looking at, then map the single event back.
        const shown = shift ? transposeDoc({ ...prev, events: [stored] }, shift, TRANSPOSE_SPELLING).events[0]! : stored;
        const altered = withAlter(shown, armed.alter, prev.tuning);
        if (altered === shown) return prev; // already that accidental — not an undo entry
        next = shift ? transposeDoc({ ...prev, events: [altered] }, -shift, TRANSPOSE_SPELLING).events[0]! : altered;
      }
      if (next === stored) return prev;
      const events = [...prev.events];
      events[at] = next;
      return { ...prev, events };
    });
  }

  /**
   * Edit mode: a note value is armed and empty staff was clicked — put a note there (step 6).
   *
   * The sheet has already resolved the geometry into an intent (which bar, which event to go in
   * front of, and the staff position the click's HEIGHT names); this builds the event and splices
   * it in. The bar ends up OVER its length on purpose — an edit absorbs into its bar and bar lines
   * never move, which is what `insertInMeasure` is careful about.
   *
   * The event is built from an empty shell through `withDurationBeats` (ms and beats together) and
   * then `withPitch` (every derived pitch field together), so nothing derived can be left stale.
   * `bar` is stamped by the core primitive, from the bar it lands in.
   *
   * ⚠ Same transpose trap as `onApplyTool`, and worse here: a spelling read off the drawn staff is
   * a DISPLAY spelling, so the finished event is mapped back with `transposeDoc(…, -transpose)`.
   * The tool stays armed afterwards — inserting several notes in a row is the point of a palette.
   */
  function onInsertNote(at: {
    measureIndex: number;
    beforeEventIndex: number | null;
    letter: string;
    octave: number;
    alter: number;
  }) {
    if (!armed || armed.kind !== "duration" || !doc) return;
    onStop();
    setLastEditMeasure(at.measureIndex); // the sheet names the bar outright
    const shift = transpose;
    const value = { num: armed.num, den: armed.den };
    const rest = armed.rest === true;
    history.apply((prev) => {
      const blank: NoteEvent = {
        index: -1, kind: "note", koma53: -1, noteName: "Es", noteAE: "Es",
        durationMs: 0, durationBeats: value, freqHz: null, lyric: "", offset: 0,
      };
      // A rest ignores the click's height — it has no pitch, and the engraver puts it mid-staff.
      const shown = rest
        ? toRest(blank, value, prev)
        : withPitch(withDurationBeats(blank, value, prev), at, prev.tuning);
      // Map the single event back to the stored score before splicing it in.
      const stored = !rest && shift ? transposeDoc({ ...prev, events: [shown] }, -shift, TRANSPOSE_SPELLING).events[0]! : shown;
      const next = insertInMeasure(prev, stored, at.measureIndex, at.beforeEventIndex);
      if (next === prev) return prev;
      // Select what was just inserted, so the ✕ and the accidental tools land on it without
      // hunting for it again. The index has to be ASKED for: `renumber` rebuilds every event, so
      // the object we spliced in cannot be found again by identity.
      setSelectedNote(insertIndexIn(prev, at.measureIndex, at.beforeEventIndex));
      return next;
    });
  }

  /** The measure holding `index`, and where in it that event sits. Null when the document does not
   *  hold it — a stale click, which must never be allowed to name a bar it isn't in. Shared by all
   *  three tuplet handlers below, because a tuplet is strictly intra-measure and every one of them
   *  starts by finding its bar. */
  function measureOf(index: number) {
    if (!doc) return null;
    const m = groupMeasures(doc).find((mm) => mm.events.some((e) => e.index === index));
    if (!m) return null;
    return { m, pos: m.events.findIndex((e) => e.index === index) };
  }

  /**
   * Edit mode: the tuplet tool's click (step 7). One tool, both directions.
   *
   * The order of the three cases IS the gesture:
   *  1. the event is inside a CLOSED three-member triplet → SELECT that triplet, so its two handles
   *     and its ✕ appear. Clicking the already-selected group again lets it go;
   *  2. nothing anchored → this note is the run's first, remember it (no document change);
   *  3. anchored → apply (×2/3) if this is the run's third note; clicking the anchor again cancels.
   *
   * ⚠ **Case 1 arrives from the drawn "3", not from a note** (owner, 2026-08-30: *"direkt olarak
   * 3'leme işaretinin tıklanabilir olmasını istiyorum. notalarına tıklamak istemiyorum"*). The sheet
   * makes the engraved mark a click target and its three notes inert, and hands the group's first
   * member here. The case is still written against an event index rather than a mark, because
   * nothing about a tuplet is stored — a mark is only ever a handle onto three ordinary notes.
   * ⚠ It also used to take the triplet apart on the spot (2026-08-08 → 2026-08-30). It now selects:
   * taking it apart is the ✕ (`onTupletRemove`) and moving it is the handles (`onTupletEdge`).
   *
   * Which notes make a legal run is `tupletRunFrom` in `packages/core/src/labels/rhythm.ts` — the same module
   * that draws the bracket, so the tool cannot promise a triplet the engraver would not draw. The
   * sheet dims and un-clicks everything this would refuse, so case 3's "not the end note" is
   * unreachable through the UI; it is still handled, because a stale click must not invent one.
   *
   * ⚠ No transpose round-trip, unlike the accidental tool: a duration means the same thing in
   * display space and stored space, and `tupletRunFrom` reads durations only.
   */
  function onTupletPick(index: number) {
    const found = measureOf(index);
    if (!found) return;
    const { m, pos } = found;

    // ⚠ ANY drawn mark can be held, not just a real triplet (owner, 2026-08-30: *"bazı tupletler 3
    // notayı kapsamıyor, 1 notayı kapsayan tupletler vesaire de olabiliyor onları silebilmek veya
    // genişletebilmek istiyorum"*). A mark over one or two notes is the model's misread — the whole
    // reason `tupletGroupsIn` draws it — so it is exactly what most needs to be grabbed and fixed.
    const drawn = drawnTupletAt(m.events, pos);
    if (drawn) {
      const first = m.events[memberPositions(m.events, drawn)[0]!]!.index;
      setTupletAnchor(null);
      setSelectedNote(null); // one thing is selected at a time, or there are two ✕ on the page
      setSelectedTuplet(selectedTuplet === first ? null : first); // clicking it again lets it go
      return;
    }
    setSelectedTuplet(null); // a click off the group is a click away from it

    // Everything below is the CREATE gesture, which belongs to the tuplet tool. With nothing armed
    // (Seçim) a mark can still be picked up — the case above — but a click may not start building
    // one, or an ordinary note click would silently arm a half-made triplet.
    if (armed?.kind !== "tuplet") return;

    if (tupletAnchor == null) {
      if (tupletRunFrom(m.events, pos)) setTupletAnchor(index);
      return;
    }
    if (tupletAnchor === index) {
      setTupletAnchor(null); // clicking the anchor again backs out
      return;
    }
    const from = m.events.findIndex((e) => e.index === tupletAnchor);
    const run = from < 0 ? null : tupletRunFrom(m.events, from);
    if (!run || m.events[run[2]!]!.index !== index) return; // not this run's end note
    const idx = run.map((p) => m.events[p]!.index);
    onStop();
    markEdited(index);
    setTupletAnchor(null);
    history.apply((prev) => scaleDurations(prev, idx, { num: 2, den: 3 }));
    setSelectedTuplet(idx[0]!); // hold what was just made, so the handles are right there
  }

  /**
   * Edit mode: the held mark's ✕ — take the bracket off and give its notes their plain values back
   * (×3/2). The notes STAY; only the grouping goes (owner, 2026-08-30).
   *
   * ⚠ It works on a BROKEN mark too — one drawn over a single note, or two (owner, same day). Those
   * are the model's misreads, and clearing one is the commonest correction there is. The old rule
   * refused them on the grounds that ×³⁄₂ "would invent a rhythm nobody read"; that was an argument
   * about what the page TRULY says, and it is the person looking at the page who is answering that
   * question here. ⚠ The arithmetic is exact for the ordinary cases (a 1/12 goes back to a 1/8), but
   * a member with an unusual fraction can land on a value no single notehead draws — the engraver
   * then falls back to its nearest-value snap, exactly as it does for any other odd duration.
   *
   * The bar it is in becomes LONGER — an edit absorbs into its bar and bar lines never move, so the
   * off-meter mark is the indicator, exactly as making a triplet made the bar short.
   */
  /**
   * Put a SIGN on a bar (owner, 2026-09-03) — `‖:` `:‖` 1./2. 𝄋 ⊕ "D.C." "Son".
   *
   * ⚠ A sign is not a document edit. It sets a flag beside the score and the page's PLAYING ORDER
   * is then re-derived by the decoder's own expanders (`placeMark` → `resolveStructure`), so the
   * staff and the sound can never be told two different stories. The structure rides in the undo
   * stack with the notes, so one Ctrl+Z takes back whichever the user did last.
   *
   * ⚠ A score with no structure at all — every source but a decode — gets an EMPTY one on the
   * first sign, rather than the feature being unavailable there. `barCount` is read from the live
   * document every time, which is also what quietly drops a sign whose bar an edit has deleted.
   */
  function onPlaceMark(bar: number, mark: Exclude<SignTool, "repeat">) {
    if (!doc) return;
    onStop(); // the playing order is about to change under a running timeline
    const barCount = groupMeasures(doc).length;
    const result = placeMark(structure, barCount, bar, mark);
    setRefused(result.ok ? null : result.reason);
    if (!result.ok) return;
    history.applyStructure(() => result.structure);
  }

  /**
   * The repeat's two-click gesture, on the BARLINES (owner, 2026-09-03: *"ilk önce başlangıcı
   * nereye koymak istersiniz desin, kullanıcı seçtiğinde ise bu sefer bitişi nereye koymak
   * istersiniz yazsın"*).
   *
   * ⚠ The first click writes nothing. It only remembers which bar the `‖:` would open, so the
   * document can never hold half a repeat — which is what made the old two-tool version confusing:
   * an unclosed `‖:` is a sign the engraved staff refuses to draw, so the click left no trace.
   * `edge` names the barline: `"start"` is a bar's opening line, `"end"` its closing one.
   */
  function onRepeatEdge(bar: number, edge: "start" | "end") {
    if (!doc) return;
    setRefused(null);
    if (repeatAnchor == null) {
      if (edge === "start") setRepeatAnchor(bar);
      return;
    }
    onStop();
    const barCount = groupMeasures(doc).length;
    const result = placeRepeat(structure, barCount, repeatAnchor, bar);
    setRepeatAnchor(null);
    setRefused(result.ok ? null : result.reason);
    if (result.ok) history.applyStructure(() => result.structure);
  }

  /** Take a sign off the page. Never refused, and it takes the rest of its own object with it — a
   *  `:‖` removes the `‖:` it closed and the volta pair inside it, because that whole repeat is
   *  one thing to the person clicking it. */
  function onRemoveMark(bar: number, mark: StructureMark) {
    if (!doc) return;
    onStop();
    const barCount = groupMeasures(doc).length;
    setRefused(null);
    history.applyStructure((prev) => removeMark(prev, barCount, bar, mark));
  }

  function onTupletRemove() {
    if (selectedTuplet == null) return;
    const found = measureOf(selectedTuplet);
    if (!found) return;
    const drawn = drawnTupletAt(found.m.events, found.pos);
    if (!drawn) return;
    const idx = memberPositions(found.m.events, drawn).map((p) => found.m.events[p]!.index);
    onStop();
    markEdited(selectedTuplet);
    setTupletAnchor(null);
    setSelectedTuplet(null);
    history.apply((prev) => scaleDurations(prev, idx, { num: 3, den: 2 }));
  }

  /**
   * Edit mode: a handle of the selected triplet was dragged onto the note `targetIndex` — move the
   * group so that its `edge` end sits there (owner, 2026-08-30).
   *
   * What that MEANS depends on the mark, and `tupletEdgeTo` owns the distinction: a real triplet
   * **slides** (three members always — the digit is a hardcoded "3"), while a **broken** mark is
   * **repaired** — the grabbed end moves, the other stays, so it can grow to pick up the member the
   * model dropped or shrink toward nothing. Either way the edit is the same two scalings — ×³⁄₂ on
   * what leaves, ×⅔ on what joins — in ONE undo entry.
   *
   * ⚠ `coalesce` keys on the edge, not on the target: one drag across four notes is one gesture and
   * must undo as one. Keying on the target would leave an undo entry per note crossed.
   *
   * ⚠ The selection is moved to the group's new first member. It names a POSITION, and the handle
   * has just changed which notes hold it — leaving it behind would point at a note that is no
   * longer in any group, and the handles would vanish mid-drag.
   */
  function onTupletEdge(edge: "start" | "end", targetIndex: number) {
    if (selectedTuplet == null) return;
    const held = measureOf(selectedTuplet);
    if (!held) return;
    const drawn = drawnTupletAt(held.m.events, held.pos);
    if (!drawn) return;
    const at = held.m.events.findIndex((e) => e.index === targetIndex);
    if (at < 0) return; // the handle may only land inside the group's own bar
    const move = tupletEdgeTo(held.m.events, drawn, edge, at);
    if (!move) return; // the sheet dims what this refuses; a stale drag lands here
    const leaving = move.leaving.map((p) => held.m.events[p]!.index);
    const joining = move.joining.map((p) => held.m.events[p]!.index);
    onStop();
    markEdited(targetIndex);
    history.apply(
      (prev) => scaleDurations(scaleDurations(prev, leaving, { num: 3, den: 2 }), joining, { num: 2, den: 3 }),
      { coalesce: `tupslide:${edge}` },
    );
    setSelectedTuplet(held.m.events[memberPositions(held.m.events, move.group)[0]!]!.index);
  }

  /** Edit mode: select a note, dropping any held tuplet mark. The two selections are exclusive —
   *  each has its own ✕, and two delete buttons on the page at once could only be a trap. */
  function onSelectNote(index: number | null) {
    setSelectedNote(index);
    if (index != null) setSelectedTuplet(null);
  }

  /** Edit mode: delete the selected note (and any grace notes leading into it). The bar is left
   *  SHORT on purpose — an edit absorbs into its bar and bar lines never move. */
  function onDeleteNote(index: number) {
    onStop();
    markEdited(index);
    setSelectedNote(null);
    history.apply((prev) => deleteEvent(prev, index));
  }

  // Undo/redo drop the selection: a delete renumbers every event, so an index held across one
  // can name a different note. Clearing is cheap and cannot be subtly wrong.
  function onUndo() {
    onStop();
    setSelectedNote(null);
    setTupletAnchor(null);
    setSelectedTuplet(null);
    history.undo();
  }
  function onRedo() {
    onStop();
    setSelectedNote(null);
    setTupletAnchor(null);
    setSelectedTuplet(null);
    history.redo();
  }

  /** Arm a tool (or disarm — the palette's Seçim and Esc both come through here). A half-finished
   *  tuplet cannot survive a tool change: its anchor names a note in a run the next tool knows
   *  nothing about. */
  function armTool(t: Tool | null) {
    setArmed(t);
    setTupletAnchor(null);
    setRepeatAnchor(null); // a half-drawn repeat cannot survive a tool change either
    setRefused(null); // a refusal explains the LAST click; arming anything is a fresh start
    // ⚠ A held mark SURVIVES the move between Seçim and ÜÇLEME, because both can hold one. It does
    // not survive a note value or an accidental: those apply to a note, the mark stops being
    // pickable, and its handles would vanish leaving a selection nothing on the page explains.
    if (t != null && t.kind !== "tuplet") setSelectedTuplet(null);
  }

  return { armTool, onApplyTool, onDeleteNote, onInsertNote, onNudgePitch, onPlaceMark, onRedo, onRemoveMark, onRepeatEdge, onSelectNote, onTupletEdge, onTupletPick, onTupletRemove, onUndo };
}
