/**
 * Note-model events → VexFlow notes: durations, accidentals, grace notes, the key signature and where
 * a tuplet's mark sits. Split out of SheetView.tsx on 2026-11-20, unchanged.
 *
 * ⚠ This is part of the TRAINING-STRIP source (render.ts screenshots what it draws): pixels and labels
 * must come from one code path, so never change a drawing rule here without the label side.
 */
import {
  Accidental,
  Dot,
  GraceNote,
  GraceNoteGroup,
  Stave,
  StaveNote,
} from "vexflow";
import {
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
  accidentalGlyph,
  accidentalLabel,
  eventBeats,
  parseNoteName,
  toAeuAlter,
} from "@turkish-omr/core";
import { SIG_GLYPH_ADVANCE, SIG_LINE } from "./layout";
import {
  type TupletGroup,
  tieSplitBeats,
  tupletGroupsIn,
  tupletWrittenBeats,
} from "@turkish-omr/core/labels/rhythm";

// How printed Turkish scores beam eighth/sixteenth runs. VexFlow's default is a fixed
// quarter-note clock ([2/8]), which can only ever produce groups of 2 eighths — measured over
// strips_v4 it yields 60% two-note groups and essentially no group of 5+. Real engraving beams by
// USUL group, so the exam pool shows runs of 3, 4 and 5 under one beam. Neither convention is
// universal (the nota/sarki pool often does print pairs), so a render picks one on a seeded coin
// and the corpus carries both — which is what the real pools carry.
//
// Values are counts of denominator-notes per beam, in order; generateBeams cycles the list.
// Meters not listed keep VexFlow's default (we do not invent groupings for meters we have not
// seen engraved).
export const USUL_BEAM_GROUPS: Record<string, number[]> = {
  "5/8": [2, 3],          // Türk aksağı
  "6/8": [3, 3],          // yürük semai
  "7/8": [3, 2, 2],       // devr-i hindî
  "8/8": [3, 2, 3],       // düyek
  "9/8": [2, 2, 2, 3],    // aksak
  "10/8": [3, 2, 2, 3],   // curcuna
  "12/8": [3, 3, 3, 3],   // ...
  "5/4": [2, 3],
  "7/4": [3, 2, 2],
  "9/4": [2, 2, 2, 3],
  "10/16": [3, 2, 2, 3],
};

// VexFlow duration codes paired with their value as a fraction of a whole note.
export const DUR: ReadonlyArray<readonly [string, number]> = [
  ["w", 1],
  ["h", 1 / 2],
  ["q", 1 / 4],
  ["8", 1 / 8],
  ["16", 1 / 16],
  ["32", 1 / 32],
  ["64", 1 / 64],
];

/**
 * Map a note-value (fraction of a whole note) to a VexFlow duration code + dot count.
 * We match the base value, then test for a single or double augmentation dot (×1.5 / ×1.75).
 * Tuplet fractions and undrawable long values never reach this raw: `buildStaveNotes` hands in
 * the WRITTEN value instead (a tuplet member's ×3/2, a tie split's parts — see rhythm.ts).
 * Anything still unexpected falls back to the nearest base value so the sheet always draws —
 * playback uses durationMs anyway.
 */
export function vexDuration(beats: number): { duration: string; dots: number } {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
  for (const [code, val] of DUR) {
    if (near(beats, val)) return { duration: code, dots: 0 };
    if (near(beats, val * 1.5)) return { duration: code, dots: 1 };
    if (near(beats, val * 1.75)) return { duration: code, dots: 2 };
  }
  let best = DUR[2]!; // default to a quarter
  for (const d of DUR) if (Math.abs(d[1] - beats) < Math.abs(best[1] - beats)) best = d;
  return { duration: best[0], dots: 0 };
}

/**
 * How accidentals are displayed on the staff:
 * - `"every"`   — draw every note's accidental inline (no suppression).
 * - `"keysig"`  — draw the makam key signature once per row and inline-mark only notes that
 *                 deviate from it (every deviating occurrence, no measure memory).
 * - `"measure"` — standard engraving: key signature at the row start PLUS the measure-scoped
 *                 carry rule — an accidental prints on the first note (per staff position) that
 *                 breaks the alteration in effect, then carries to later same-position notes in
 *                 the measure; a cancel (natural, or the signature's glyph) prints on return.
 *                 This matches how real note sheets are engraved.
 */
export type AccidentalMode = "every" | "keysig" | "measure";

/** One drawn StaveNote's link back to the timeline: its source event, the slice of that event's
 *  playback time this note covers (a tied pair splits it), and the lyric it carries (only the
 *  first note of a tied pair keeps the syllable). */
export interface NoteSlot {
  ev: NoteEvent;
  durationMs: number;
  lyric: string;
}

/** The written duration a grace note draws: a small slashed 8th by convention — SymbTr çarpma
 *  rows have no duration of their own. Must match GRACE_WRITTEN_BEATS in lilypond.ts. */
export const GRACE_VEX_DURATION = "8";

/**
 * Build the VexFlow StaveNotes for one measure (parallel `slots` keeps the source events).
 * `signatureMap` is the makam key signature (alteration per letter); it's consulted in the
 * `"keysig"` and `"measure"` modes and ignored in `"every"`. `sigTolerant` only bites in
 * `"measure"` mode — see the rule inside `applyAccidental`.
 *
 * Rhythm signs (rhythm.ts — the SAME detection the label serializer uses, so pixels == labels):
 *  - a triplet group's members draw their ×3/2 WRITTEN value and are returned in `tuplets` for
 *    the "3" bracket; a tie-split long value draws as consecutive written notes returned in
 *    `ties` for the arcs (rests split too but are never tied);
 *  - grace events become GraceNotes attached to the NEXT real note (dangling measure-final
 *    graces are dropped, matching the serializer).
 */
export function buildStaveNotes(
  measure: Measure,
  mode: AccidentalMode,
  signatureMap: Map<string, number>,
  sigTolerant: boolean,
): {
  notes: StaveNote[];
  slots: NoteSlot[];
  tuplets: StaveNote[][];
  /** Parallel to `tuplets`: the measure positions each drawn mark covers, so a caller can ask
   *  `closedTupletAt` whether the group behind a mark is one the editor may hold. Without it the
   *  drawn mark and the document have no link, and the click target would have to guess. */
  tupletGroups: TupletGroup[];
  ties: [StaveNote, StaveNote][];
} {
  const notes: StaveNote[] = [];
  const slots: NoteSlot[] = [];
  const ties: [StaveNote, StaveNote][] = [];
  const groups = tupletGroupsIn(measure.events);
  const groupNotes: StaveNote[][] = groups.map(() => []);
  let pendingGraces: GraceNote[] = [];
  // "measure" mode only: the alteration currently in effect for each staff position
  // (letter+octave) within THIS measure. Seeded lazily from the key signature; set by a printed
  // accidental and carried until it changes. It's local to one measure, so it naturally resets
  // at every barline — exactly the standard convention.
  const active = new Map<string, number>();

  // The shared per-mode accidental decision. `carry` updates the measure-mode memory — true for
  // real notes; false for grace notes (their tiny accidental doesn't set the measure's state).
  const applyAccidental = (
    n: StaveNote,
    parsed: { letter: string; octave: number; alterCommas: number },
    carry: boolean,
  ) => {
    // Snap to the nearest standard AEU sign (art-music notation has no numbered ±2/±3); the staff
    // position and the note's koma/pitch are unchanged — only the drawn accidental.
    const alter = toAeuAlter(parsed.alterCommas);
    if (mode === "every") {
      // Show every alteration inline.
      if (alter !== 0) addAccidental(n, alter);
    } else if (mode === "keysig") {
      // Mark only notes that deviate from the signature (each occurrence). A natural under an
      // altered signature needs an explicit natural sign; otherwise draw the note's glyph.
      const sigAlter = signatureMap.get(parsed.letter) ?? 0;
      if (alter !== sigAlter) {
        if (alter === 0) n.addModifier(new Accidental("n"), 0);
        else addAccidental(n, alter);
      }
    } else {
      // Standard measure-scoped carry. The alteration in effect for this position starts at the
      // key signature and updates whenever an accidental is printed. Print one only when the
      // note breaks the effect; then remember it for the rest of the measure.
      const posKey = `${parsed.letter}${parsed.octave}`;
      const sigAlter = signatureMap.get(parsed.letter) ?? 0;
      const effective = active.has(posKey) ? active.get(posKey)! : sigAlter;
      // `sigTolerant` ON: SAME-DIRECTION notes are drawn BARE — the rule of the same name in
      // noteToLily (packages/core/src/labels/lilypond.ts), applied here too or the page would show a sign the
      // label doesn't carry. Real editions print the degree under its signature sign and leave the
      // makam intonation to the performer: eviç is a 5-comma F♯ printed bare under a koma-sharp-F
      // donanım, because SymbTr stores the SOUNDING value. Explicit signs mark genuine chromatic
      // deviations only — a direction change, or a cancel to natural. That is what a SYNTHETIC page
      // must imitate, so the renderer keeps it on.
      //
      // Until 2026-07-26 this rule lived only on the label side, so 18.8% of `strips_v3`'s
      // signature-bearing carry strips drew an accidental their label omitted — 2,369 of them
      // `\kucukSharp`, against just 234 correctly labelled inline. That taught the model to see
      // the küçük glyph and emit nothing, which is exactly its measured failure (48% recall at
      // 100% precision). Numbers in docs/METRICS.md.
      //
      // `sigTolerant` OFF (a human using the app — owner decision 2026-08-09): a sign prints
      // whenever the note's alteration differs from the one in effect AT ALL, so the staff says
      // what the audio plays. With it on, a koma bemol under a küçük-bemol donanım printed bare and
      // READ as a küçük bemol while sounding a koma — the sheet and the sound disagreeing is the
      // one thing this app may not do. Which side each caller takes: `SIG_TOLERANT` in App.tsx.
      const covered =
        alter === effective ||
        (sigTolerant && effective !== 0 && alter !== 0 && Math.sign(alter) === Math.sign(effective));
      if (!covered) {
        if (alter === 0) n.addModifier(new Accidental("n"), 0); // cancel back to natural
        else addAccidental(n, alter);
        if (carry) active.set(posKey, alter);
      }
    }
  };

  measure.events.forEach((ev, i) => {
    // Grace note: a small slashed 8th collected until its host (the next real note) is built.
    if (ev.kind === "grace") {
      const parsed = parseNoteName(ev.noteName);
      if (!parsed) return;
      const g = new GraceNote({
        keys: [`${parsed.letter.toLowerCase()}/${parsed.octave}`],
        duration: GRACE_VEX_DURATION,
        slash: true,
      });
      applyAccidental(g, parsed, false);
      pendingGraces.push(g);
      return;
    }

    const groupIdx = groups.findIndex((g) => i >= g.from && i <= g.to);
    // Written durations: a tuplet member draws its ×3/2 value; an undrawable long value draws
    // as its tie-split parts; everything else draws its own value.
    const split = groupIdx < 0 ? tieSplitBeats(ev) : null;
    const partBeats = split ?? [groupIdx >= 0 ? tupletWrittenBeats(ev) : eventBeats(ev)];
    const totalBeats = partBeats.reduce((s, b) => s + b, 0);
    const parsed = ev.kind === "note" ? parseNoteName(ev.noteName) : null;

    let prev: StaveNote | null = null;
    partBeats.forEach((beats, pi) => {
      const { duration, dots } = vexDuration(beats);
      let n: StaveNote;
      if (!parsed) {
        // Rests (and any unparseable note) render as a rest on the middle line.
        n = new StaveNote({ keys: ["b/4"], duration: `${duration}r` });
      } else {
        // Staff position comes from letter+octave only (Turkish accidentals don't shift the
        // line); octave numbering already matches VexFlow's scientific pitch (Do5 = c/5 = C5).
        n = new StaveNote({ keys: [`${parsed.letter.toLowerCase()}/${parsed.octave}`], duration });
        // ⚠ EVERY written part asks the same question, including a tie-split tail. In "measure"
        // (carry) mode that is a no-op — the head already put the alteration in `active`, so the
        // tail is `covered` and stays bare, which is what engraving does. In "keysig"/"every" mode
        // nothing carries, so the tail draws its own sign — and it must, because `\tie` retired
        // (2026-08-22) and the arc no longer tells a reader the two notes share a pitch. The label
        // side takes the identical decision by spelling the tail through `noteToLily`.
        applyAccidental(n, parsed, true);
      }
      for (let d = 0; d < dots; d++) Dot.buildAndAttach([n], { all: true });
      if (pi === 0 && pendingGraces.length > 0) {
        const grp = new GraceNoteGroup(pendingGraces, false);
        if (pendingGraces.length > 1) grp.beamNotes();
        n.addModifier(grp, 0);
        pendingGraces = [];
      }
      notes.push(n);
      slots.push({
        ev,
        // A tie split spreads the event's playback time across its written parts.
        durationMs: split ? (ev.durationMs * beats) / totalBeats : ev.durationMs,
        lyric: pi === 0 ? ev.lyric : "",
      });
      if (groupIdx >= 0) groupNotes[groupIdx]!.push(n);
      if (prev && parsed) ties.push([prev, n]);
      prev = n;
    });
  });
  // Dangling measure-final graces are dropped (the serializer drops them too — see lilypond.ts).
  const drawn = groups
    .map((group, i) => ({ group, notes: groupNotes[i]! }))
    .filter((g) => g.notes.length > 0);
  return {
    notes,
    slots,
    tuplets: drawn.map((g) => g.notes),
    tupletGroups: drawn.map((g) => g.group),
    ties,
  };
}

/**
 * Attach a Turkish accidental to a note. Pass the SMuFL glyph CHARACTER as the accidental type:
 * VexFlow renders unknown codes verbatim in the (Bravura) music font, so every koma/bakiye/
 * mücennep glyph works and VexFlow still reserves horizontal space for it.
 */
export function addAccidental(n: StaveNote, alterCommas: number) {
  const g = accidentalGlyph(alterCommas);
  if (g) n.addModifier(new Accidental(String.fromCodePoint(g.codepoint)), 0);
}

/** After drawing, attach an SVG <title> to each note so hovering shows pitch/freq/duration. */
export function attachTitles(notes: StaveNote[], evs: NoteEvent[]) {
  notes.forEach((n, i) => {
    const ev = evs[i]!;
    let el: SVGElement | undefined;
    try {
      el = n.getSVGElement() as SVGElement | undefined;
    } catch {
      el = undefined;
    }
    if (!el) return;
    const p = ev.kind === "note" ? parseNoteName(ev.noteName) : null;
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent =
      ev.kind === "rest" || !p
        ? `rest · ${ev.durationMs} ms`
        : `${ev.noteName} · ${(ev.freqHz ?? 0).toFixed(1)} Hz · ${ev.durationMs} ms` +
          (p.alterCommas !== 0 ? ` · ${accidentalLabel(p.alterCommas)}` : "");
    el.appendChild(title);
  });
}

/**
 * Draw the score's key signature into the gap reserved after the clef on one stave. Glyphs are
 * appended as Bravura <text> nodes (the same approach the per-note titles use) at the staff line
 * for each letter. `startX` is where the signature begins (just after the clef).
 */
export function drawSignature(
  svg: SVGSVGElement,
  stave: Stave,
  signature: { letter: string; alterCommas: number }[],
  startX: number,
) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  signature.forEach((entry, i) => {
    const g = accidentalGlyph(entry.alterCommas);
    if (!g) return;
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(startX + i * SIG_GLYPH_ADVANCE));
    text.setAttribute("y", String(stave.getYForLine(SIG_LINE[entry.letter] ?? 2)));
    text.setAttribute("font-family", "Bravura");
    text.setAttribute("font-size", "36"); // Bravura glyphs are designed on a 4-space (≈40px) em
    text.setAttribute("dominant-baseline", "alphabetic");
    text.setAttribute("fill", "#222");
    text.textContent = String.fromCodePoint(g.codepoint);
    svg.appendChild(text);
  });
}

/**
 * Which style this piece engraves its triplet marks in: the curved arc + "3" of most printed
 * Turkish scores, or VexFlow's square bracket. A per-piece coin (hashed on the score name), because
 * a real edition engraves them ONE way — see the long note at its call site in the draw effect.
 *
 * ⚠ Exported so the single-measure card beside the instrument (`MeasureCard.tsx`) draws the same
 * mark as the page does. One rulebook: a bar that changed style when you looked at it in the other
 * view would read as two different pieces of music.
 */
export function tupletCurvedFor(doc: NoteModelDocument): boolean {
  return Array.from(doc.name ?? "").reduce((s, ch) => s + ch.charCodeAt(0), 0) % 10 < 9;
}

/**
 * Which side a tuplet sign goes: the NOTEHEAD side, opposite the stems/beam — the placement the
 * printed Turkish engravings use (stems up → sign below the noteheads; stems down or stemless →
 * above). Rests count as stem-up (VexFlow's default).
 */
export function tupletAbove(group: StaveNote[]): boolean {
  let up = 0;
  let down = 0;
  for (const n of group) {
    let dir = 1;
    try {
      dir = n.getStemDirection();
    } catch {
      dir = 1;
    }
    if (dir >= 0) up++;
    else down++;
  }
  return down > up;
}
