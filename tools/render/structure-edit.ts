/**
 * Editing the SIGNS: add and delete `‖:` `:‖` 1./2. 𝄋 ⊕ "D.C." "Son" on a page (owner, 2026-09-03).
 *
 * ⭐ **A sign is not part of the document.** The app keeps the written score in `NoteModelDocument`
 * and the signs beside it in a `ScoreStructure` (owner, 2026-08-30) — so editing one is not a
 * document edit at all: it sets a flag on a bar and then asks what the whole page now PLAYS.
 * Every function here does exactly that, and the asking is `resolveStructure`, the same three
 * expanders the decoder runs. There is no second rulebook about what a repeat does.
 *
 * ⚠ **A placement is refused when it would DRAW one thing and SOUND another.** That is the single
 * rule, and it is enforced by simulation, not by a list: the edit is resolved, and if it produced
 * a warning the page did not already have, it is rejected. Every warning `resolveStructure` emits
 * is precisely of that kind — an unmatched `‖:` is played once, a "1." too far from its `:‖` is
 * ignored, a 𝄋 with nothing closing its section does not jump, a mid-piece "D.C." is dropped — so
 * the gate needs no knowledge of which signs exist. It is the bargain the tuplet tool already
 * struck with `tupletGroupsIn`: ask the code that decides, do not restate what it decides.
 *
 * ⚠ The named `reason` codes below are a COURTESY, not the gate. They exist so the palette can say
 * *why* instead of nothing; the warning diff is what actually decides, and it catches cases no
 * pre-check here names.
 *
 * ⚠ **Removals are never gated.** Deleting a sign can leave the page in a state a decode reaches
 * on its own (two 𝄋 with no "Son" is common on real pages), and refusing to delete something
 * because another sign leans on it would trap the user. What a removal DOES do is take the rest of
 * its own object with it: deleting a `:‖` deletes the `‖:` it closed and the volta pair inside it,
 * because to the person clicking, that whole repeat is one thing.
 */

import {
  MAX_FIRST_ENDING,
  WARN_UNMATCHED_REPSTART,
  resolveStructure,
  type BarStructure,
  type ScoreStructure,
} from "./stitch";

/** A sign that EXISTS on a page — what `markTargets` reports and what `removeMark` takes off.
 *  `volta` is ONE object: the "1." and its "2." are set and cleared together, because real
 *  engraving never prints one bracket alone. */
export type StructureMark = "repStart" | "repEnd" | "volta" | "segno" | "coda" | "dc" | "fine";

/**
 * A TOOL in the palette, which is not the same list.
 *
 * ⚠ `repeat` has no `repStart`/`repEnd` counterpart here on purpose (owner, 2026-09-03: *"tekrarı
 * alet çantasından bir kez seçeyim, ilk önce başlangıcı nereye koymak istersiniz desin"*). A repeat
 * is placed as ONE object by a two-click gesture on the BARLINES — open, then close — so the editor
 * can never commit half of one, and the "where does this `‖:` end?" question is asked by the tool
 * instead of being left on the page. `placeRepeat` is its entry point; every other tool is one
 * click and goes through `placeMark`.
 */
export type SignTool = "repeat" | "volta" | "segno" | "coda" | "dc" | "fine";

/** Why a placement was refused. `conflict` is the simulation's catch-all. */
export type RefusalReason =
  | "offScore"
  | "backwards"
  | "voltaOutside"
  | "voltaFar"
  | "voltaLast"
  | "codaFull"
  | "conflict";

export type PlaceResult =
  | { ok: true; structure: ScoreStructure }
  | { ok: false; reason: RefusalReason };

/** Where a sign the user can DELETE is drawn, so the sheet can put a click target on it. Only
 *  signs the structure really carries appear here: an unmatched `:‖` draws a `‖:` at the top of
 *  its span (the engraving convention, `repeatSpansFromStructure`) and there is no flag there to
 *  delete, so no target is offered for it. */
export interface MarkTarget {
  bar: number;
  mark: StructureMark;
  /** Which edge of the bar the ink sits on — matching what SheetView draws. `above` is the volta
   *  bracket's band over the staff. */
  at: "start" | "end" | "above";
}

/** The flags as a bar-indexed map, so an edit can read and write one bar without scanning. */
function marksByBar(structure: ScoreStructure | null): Map<number, BarStructure> {
  return new Map((structure?.bars ?? []).map((b) => [b.bar, { ...b }]));
}

function toBars(map: Map<number, BarStructure>): BarStructure[] {
  return [...map.values()]
    .map((b) => {
      // Drop the flags an edit turned off, so `Object.keys(b).length > 1` in `resolveStructure`
      // can still tell a bar that carries nothing from one that carries something.
      const out: BarStructure = { bar: b.bar };
      if (b.repStart) out.repStart = true;
      if (b.repEnd) out.repEnd = true;
      if (b.volta1) out.volta1 = true;
      if (b.volta2) out.volta2 = true;
      if (b.segno) {
        out.segno = true;
        if (b.segnoAt) out.segnoAt = b.segnoAt;
      }
      if (b.codaOrder != null) out.codaOrder = b.codaOrder;
      if (b.dc) out.dc = true;
      if (b.fine) out.fine = true;
      return out;
    })
    .filter((b) => Object.keys(b).length > 1)
    .sort((a, b) => a.bar - b.bar);
}

function edit(map: Map<number, BarStructure>, bar: number, fn: (b: BarStructure) => void): void {
  const b = map.get(bar) ?? { bar };
  fn(b);
  map.set(bar, b);
}

/**
 * The FIRST 𝄋 opens the section; every later one is a jump back to it (`expandSegnoJumps`). The
 * drawn edge follows that meaning, so it is re-derived after every add and delete rather than
 * remembered — deleting the first 𝄋 promotes the next one, and it must move to the bar's head.
 */
function restampSegnoEdges(map: Map<number, BarStructure>): void {
  const bars = [...map.values()].filter((b) => b.segno).sort((a, b) => a.bar - b.bar);
  bars.forEach((b, i) => {
    b.segnoAt = i === 0 ? "start" : "end";
  });
}

/** ⊕ order is reading order across the page: the first is the jump point, the second the
 *  destination (`expandDaCapo`). Renumbered on every change for the same reason as the 𝄋 edge. */
function restampCodaOrder(map: Map<number, BarStructure>): void {
  const bars = [...map.values()].filter((b) => b.codaOrder != null).sort((a, b) => a.bar - b.bar);
  bars.forEach((b, i) => {
    b.codaOrder = i;
  });
}

/** The repeat span a bar falls in, as written-bar numbers: from the `‖:` that opens it (or the
 *  bar after the previous `:‖`, the engraving convention) to the `:‖` that closes it. `null` when
 *  no `:‖` follows the bar, which is the state that makes a volta impossible. */
function spanAt(map: Map<number, BarStructure>, bar: number, barCount: number): { start: number; end: number } | null {
  let start = 1;
  let open: number | null = null;
  for (let i = 1; i <= barCount; i++) {
    const m = map.get(i);
    if (m?.repStart) open = i;
    if (m?.repEnd) {
      const from = open ?? start;
      if (bar >= from && bar <= i) return { start: from, end: i };
      open = null;
      start = i + 1;
    }
  }
  return null;
}

/** The unfinished repeat is not a fault, so it never counts against an edit. */
function strip(warnings: readonly string[]): string[] {
  return warnings.filter((w) => w !== WARN_UNMATCHED_REPSTART);
}

/** Multiset difference: did this edit introduce a warning the page did not already have? */
function newWarning(before: readonly string[], after: readonly string[]): boolean {
  const seen = new Map<string, number>();
  for (const w of before) seen.set(w, (seen.get(w) ?? 0) + 1);
  for (const w of after) {
    const n = seen.get(w) ?? 0;
    if (n === 0) return true;
    seen.set(w, n - 1);
  }
  return false;
}

/** A page with no signs at all — what the first repeat placed on a score that never had a
 *  structure starts from (a bundled sample, or a decode that read none). */
export function emptyStructure(barCount: number): ScoreStructure {
  return resolveStructure([], barCount).structure;
}

/**
 * Add a sign. Returns the re-resolved structure, or the reason it was refused.
 *
 * ⚠ `barCount` is the WRITTEN bar count of the document the signs belong to; it is what makes a
 * sign on a deleted bar impossible and what tells the volta whether a "2." bar exists at all.
 */
export function placeMark(
  structure: ScoreStructure | null,
  barCount: number,
  bar: number,
  mark: Exclude<SignTool, "repeat">,
): PlaceResult {
  if (bar < 1 || bar > barCount) return { ok: false, reason: "offScore" };
  const map = marksByBar(structure);
  const before = resolveStructure(toBars(map), barCount).warnings;

  switch (mark) {
    case "volta": {
      // The pair is placed as one object: "1." on the clicked bar, "2." on the bar after the `:‖`
      // that closes the span — which is where a printed page puts it, and where
      // `repeatSpansFromStructure` looks for it.
      const span = spanAt(map, bar, barCount);
      if (!span) return { ok: false, reason: "voltaOutside" };
      if (span.end - bar + 1 > MAX_FIRST_ENDING) return { ok: false, reason: "voltaFar" };
      if (span.end + 1 > barCount) return { ok: false, reason: "voltaLast" };
      // Only one "1." per span: `expandRepeats` takes the LAST one, so leaving an older bracket in
      // place would silently move the ending somewhere the user did not click.
      for (let i = span.start; i <= span.end; i++) edit(map, i, (b) => { b.volta1 = false; });
      edit(map, bar, (b) => { b.volta1 = true; });
      edit(map, span.end + 1, (b) => { b.volta2 = true; });
      break;
    }
    case "segno":
      edit(map, bar, (b) => { b.segno = true; });
      restampSegnoEdges(map);
      break;
    case "coda": {
      const already = [...map.values()].filter((b) => b.codaOrder != null && b.bar !== bar);
      // Two ⊕ are the whole vocabulary: one to jump from, one to land on. A third would draw ink
      // `expandDaCapo` cannot read.
      if (already.length >= 2) return { ok: false, reason: "codaFull" };
      edit(map, bar, (b) => { b.codaOrder = 0; });
      restampCodaOrder(map);
      break;
    }
    case "dc":
      for (const b of map.values()) b.dc = false;
      edit(map, bar, (b) => { b.dc = true; });
      break;
    case "fine":
      for (const b of map.values()) b.fine = false;
      edit(map, bar, (b) => { b.fine = true; });
      break;
  }

  const next = resolveStructure(toBars(map), barCount);
  // THIS is the gate; the named reasons above are courtesy. The one exception is the unfinished
  // repeat — see `WARN_UNMATCHED_REPSTART`. Without it a score could only be marked up backwards
  // (`:‖` first), because a `‖:` is unmatched for as long as it takes to place its partner.
  if (newWarning(strip(before), strip(next.warnings))) return { ok: false, reason: "conflict" };
  return { ok: true, structure: next.structure };
}

/**
 * Place a whole repeat: `‖:` at the head of `from`, `:‖` at the tail of `to`.
 *
 * ⭐ Both marks in ONE operation, and that is the point. Placing them separately meant the page
 * could hold a `‖:` that nothing closed — a sign the engraved staff refuses to draw, so the tool
 * left no trace and the app had to invent a dashed stand-in for it. Asking for the closing barline
 * as the second half of the same gesture asks the same question at the moment the user is already
 * thinking about it, and the half-finished state never reaches the document at all.
 *
 * `from === to` is a one-bar repeat, which is legal (that bar plays twice). `to < from` cannot be
 * expressed and is refused rather than silently swapped — the sheet dims those barlines while the
 * gesture is open, so a backwards click is a mis-click, not an intention.
 */
export function placeRepeat(
  structure: ScoreStructure | null,
  barCount: number,
  from: number,
  to: number,
): PlaceResult {
  if (from < 1 || to < 1 || from > barCount || to > barCount) return { ok: false, reason: "offScore" };
  if (to < from) return { ok: false, reason: "backwards" };
  const map = marksByBar(structure);
  const before = resolveStructure(toBars(map), barCount).warnings;
  edit(map, from, (b) => { b.repStart = true; });
  edit(map, to, (b) => { b.repEnd = true; });
  const next = resolveStructure(toBars(map), barCount);
  if (newWarning(strip(before), strip(next.warnings))) return { ok: false, reason: "conflict" };
  return { ok: true, structure: next.structure };
}

/**
 * Delete a sign. Never refused — see the header.
 *
 * `bar` is the bar the CLICKED ink sits on. For a volta that is either bracket, and for a `:‖` the
 * bar whose right edge carries it; both take the rest of their object with them.
 */
export function removeMark(
  structure: ScoreStructure | null,
  barCount: number,
  bar: number,
  mark: StructureMark,
): ScoreStructure {
  const map = marksByBar(structure);

  switch (mark) {
    // ⭐ EITHER END deletes the whole repeat — the `‖:`, the `:‖` and the volta pair inside them.
    // A repeat is placed as one object (`placeRepeat`), so it comes off as one; clearing a single
    // end would leave the other half behind, and a `‖:` alone draws nothing and warns.
    // ⚠ A `‖:` that spans nothing (an unmatched one, which only a DECODE can leave) has no span to
    // find, so it is simply cleared — which is what the dashed marker offering the click means.
    case "repStart":
    case "repEnd": {
      const span = spanAt(map, bar, barCount);
      if (span) {
        for (let i = span.start; i <= span.end; i++) {
          edit(map, i, (b) => { b.repStart = false; b.repEnd = false; b.volta1 = false; });
        }
        edit(map, span.end + 1, (b) => { b.volta2 = false; });
      }
      edit(map, bar, (b) => { b.repStart = false; b.repEnd = false; });
      break;
    }
    case "volta": {
      // Either bracket clears the pair. The "2." sits one bar past the `:‖`, so a click on it has
      // to look one bar BACK to find the span it belongs to.
      const span = spanAt(map, bar, barCount) ?? spanAt(map, bar - 1, barCount);
      if (span) {
        for (let i = span.start; i <= span.end; i++) edit(map, i, (b) => { b.volta1 = false; });
        edit(map, span.end + 1, (b) => { b.volta2 = false; });
      } else {
        edit(map, bar, (b) => { b.volta1 = false; b.volta2 = false; });
      }
      break;
    }
    case "segno":
      edit(map, bar, (b) => { b.segno = false; b.segnoAt = undefined; });
      restampSegnoEdges(map);
      break;
    case "coda":
      edit(map, bar, (b) => { b.codaOrder = undefined; });
      restampCodaOrder(map);
      break;
    case "dc":
      edit(map, bar, (b) => { b.dc = false; });
      break;
    case "fine":
      edit(map, bar, (b) => { b.fine = false; });
      break;
  }

  return resolveStructure(toBars(map), barCount).structure;
}

/**
 * The bar carrying a `‖:` that nothing closes, or `null`.
 *
 * ⚠ This sign is INVISIBLE on the engraved staff by design: `repeatSpansFromStructure` draws no
 * span for it, because a `‖:` on the page promising a repeat the music does not take is the one
 * thing that whole path exists to prevent. In EDIT MODE it must still be visible or the tool looks
 * broken — so the sheet draws it in the overlay, marked incomplete, exactly as it draws a broken
 * tuplet mark. Outside edit mode nothing is drawn and nothing has changed.
 */
export function openRepeatBar(structure: ScoreStructure | null, barCount: number): number | null {
  let open: number | null = null;
  for (let i = 1; i <= barCount; i++) {
    const m = (structure?.bars ?? []).find((b) => b.bar === i);
    if (m?.repStart) open = i;
    if (m?.repEnd) open = null;
  }
  return open;
}

/**
 * Every sign on the page that can be clicked away, with the edge its ink sits on.
 *
 * Edges match what SheetView draws (`drawVolta`, `drawNavMarks`, VexFlow's repeat barlines), so a
 * target always lands on the glyph it deletes. ⚠ Derived from the FLAGS, never from the drawn
 * spans: an unmatched `:‖` is drawn with a `‖:` at the head of its span that no flag carries, and
 * offering a delete target there would be a button that does nothing.
 */
export function markTargets(structure: ScoreStructure | null, barCount: number): MarkTarget[] {
  const out: MarkTarget[] = [];
  // ⚠ Skipped: a `‖:` nothing closes. It has no ink on the staff, so a delete chip there would sit
  // on nothing; `openRepeatBar` draws it dashed and takes the click itself.
  const open = openRepeatBar(structure, barCount);
  for (const b of structure?.bars ?? []) {
    if (b.repStart && b.bar !== open) out.push({ bar: b.bar, mark: "repStart", at: "start" });
    if (b.repEnd) out.push({ bar: b.bar, mark: "repEnd", at: "end" });
    if (b.volta1 || b.volta2) out.push({ bar: b.bar, mark: "volta", at: "above" });
    if (b.segno) out.push({ bar: b.bar, mark: "segno", at: b.segnoAt ?? "start" });
    if (b.codaOrder != null) out.push({ bar: b.bar, mark: "coda", at: b.codaOrder === 0 ? "end" : "start" });
    if (b.dc) out.push({ bar: b.bar, mark: "dc", at: "end" });
    if (b.fine) out.push({ bar: b.bar, mark: "fine", at: "end" });
  }
  return out;
}
