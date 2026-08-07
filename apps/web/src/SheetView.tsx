import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Accidental, Barline, Beam, Dot, Formatter, Fraction, GraceNote, GraceNoteGroup, Renderer, Stave, StaveModifierPosition, StaveNote, StaveTie, Tuplet } from "vexflow";
import {
  accidentalGlyph,
  accidentalLabel,
  deriveKeySignature,
  deriveTimeSignature,
  estimateBpm,
  eventBeats,
  groupMeasures,
  parseNoteName,
  scoreHeader,
  toAeuAlter,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { repeatMarksAt, type RepeatSpan } from "../../../tools/render/repeats";
import { navMarksAt, type NavMark } from "../../../tools/render/navmarks";
import { tieSplitBeats, tupletGroupsIn, tupletWrittenBeats } from "../../../tools/render/rhythm";
import { buildTextNoise } from "./textNoise";
import { TR } from "./ui/strings";
import { mulberry32 } from "../../../tools/render/rng";

// --- layout constants -------------------------------------------------------
const LEFT = 10;
const CONTENT_WIDTH = 1000; // staff content area (rows wrap within this)
const ROW_HEIGHT = 130; // vertical pitch of each staff system
const STAVE_TOP_PAD = 40; // headroom above each stave for high notes / beams
const CLEF_W = 50; // extra width the leading clef costs on the first stave of a row
const SVG_WIDTH = LEFT * 2 + CONTENT_WIDTH;
const CURSOR_MARGIN = 8; // playhead bar extends this far above/below the staff lines
const SIG_GLYPH_ADVANCE = 13; // horizontal space each key-signature accidental occupies
// Baseline of the lyric line below the bottom staff line. MUST stay inside the strip crop, which
// ends 106 px below the stave top = 26 px below the bottom staff line (stripExport's PAD_TOP +
// STAFF_H). At the old value of 30 the baseline fell 4 px BELOW the crop, so training strips
// caught only the ascender tips of each syllable while real crops carry whole letterforms
// (measured: 11% of synthetic strips had ink outside the staff band vs 42-52% of real ones).
const LYRIC_DY = 24;
// Staff line each signature accidental sits on (VexFlow treble: F5=line0, B4=line2, E4=line4),
// choosing an octave that keeps every letter on the staff.
const SIG_LINE: Record<string, number> = { C: 1.5, D: 1, E: 0.5, F: 0, G: 3, A: 2.5, B: 2 };

// --- print realism (render automation only; pixels, never labels) ------------
//
// Real printed staff lines are FATTER relative to the staff than ours, and their weight varies
// between editions and scans. Measured on strips normalised to a 30 px staff space
// (scripts/rung3/domain_gap.py): thickness/spacing was 0.100 for every synthetic strip (SD 0.02 —
// literally constant) against 0.128-0.159 across the three real pools. VexFlow strokes staff
// lines at lineWidth 1 on a 10 px staff space; this range straddles the real mean and gives the
// per-render variation the corpus had none of.
const STAFF_LINE_WIDTH = { min: 1.0, max: 1.75 } as const;

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
const USUL_BEAM_GROUPS: Record<string, number[]> = {
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
const DUR: ReadonlyArray<readonly [string, number]> = [
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
function vexDuration(beats: number): { duration: string; dots: number } {
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
interface NoteSlot {
  ev: NoteEvent;
  durationMs: number;
  lyric: string;
}

/** The written duration a grace note draws: a small slashed 8th by convention — SymbTr çarpma
 *  rows have no duration of their own. Must match GRACE_WRITTEN_BEATS in lilypond.ts. */
const GRACE_VEX_DURATION = "8";

/**
 * Build the VexFlow StaveNotes for one measure (parallel `slots` keeps the source events).
 * `signatureMap` is the makam key signature (alteration per letter); it's consulted in the
 * `"keysig"` and `"measure"` modes and ignored in `"every"`.
 *
 * Rhythm signs (rhythm.ts — the SAME detection the label serializer uses, so pixels == labels):
 *  - a triplet group's members draw their ×3/2 WRITTEN value and are returned in `tuplets` for
 *    the "3" bracket; a tie-split long value draws as consecutive written notes returned in
 *    `ties` for the arcs (rests split too but are never tied);
 *  - grace events become GraceNotes attached to the NEXT real note (dangling measure-final
 *    graces are dropped, matching the serializer).
 */
function buildStaveNotes(
  measure: Measure,
  mode: AccidentalMode,
  signatureMap: Map<string, number>,
): { notes: StaveNote[]; slots: NoteSlot[]; tuplets: StaveNote[][]; ties: [StaveNote, StaveNote][] } {
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
      // SAME-DIRECTION notes are drawn BARE — this is `sigTolerant` in noteToLily
      // (tools/render/lilypond.ts), and it must be applied here too or the page shows a sign the
      // label doesn't carry. Real editions print the degree under its signature sign and leave the
      // makam intonation to the performer: eviç is a 5-comma F♯ printed bare under a koma-sharp-F
      // donanım, because SymbTr stores the SOUNDING value. Explicit signs mark genuine chromatic
      // deviations only — a direction change, or a cancel to natural.
      //
      // Until 2026-07-26 this rule lived only on the label side, so 18.8% of `strips_v3`'s
      // signature-bearing carry strips drew an accidental their label omitted — 2,369 of them
      // `\kucukSharp`, against just 234 correctly labelled inline. That taught the model to see
      // the küçük glyph and emit nothing, which is exactly its measured failure (48% recall at
      // 100% precision). Numbers in docs/METRICS.md.
      const covered =
        alter === effective ||
        (effective !== 0 && alter !== 0 && Math.sign(alter) === Math.sign(effective));
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
        // Only the FIRST written note of a tied pair draws the accidental — engraving never
        // restrikes it on the tied-to note.
        if (pi === 0) applyAccidental(n, parsed, true);
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
  return { notes, slots, tuplets: groupNotes.filter((g) => g.length > 0), ties };
}

/**
 * Attach a Turkish accidental to a note. Pass the SMuFL glyph CHARACTER as the accidental type:
 * VexFlow renders unknown codes verbatim in the (Bravura) music font, so every koma/bakiye/
 * mücennep glyph works and VexFlow still reserves horizontal space for it.
 */
function addAccidental(n: StaveNote, alterCommas: number) {
  const g = accidentalGlyph(alterCommas);
  if (g) n.addModifier(new Accidental(String.fromCodePoint(g.codepoint)), 0);
}

/** After drawing, attach an SVG <title> to each note so hovering shows pitch/freq/duration. */
function attachTitles(notes: StaveNote[], evs: NoteEvent[]) {
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
function drawSignature(
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
 * Which side a tuplet sign goes: the NOTEHEAD side, opposite the stems/beam — the placement the
 * printed Turkish engravings use (stems up → sign below the noteheads; stems down or stemless →
 * above). Rests count as stem-up (VexFlow's default).
 */
function tupletAbove(group: StaveNote[]): boolean {
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

/**
 * Draw the CURVED tuplet mark — a slur-like arc with an italic "3" at its apex — as raw SVG,
 * like the voltas/nav marks. This is the shape most printed Turkish scores use (VexFlow's
 * `Tuplet` only draws the square bracket, which stays as the minority per-piece style).
 */
function drawTupletArc(svg: SVGSVGElement, group: StaveNote[], above: boolean) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const xs = group.map((n) => n.getAbsoluteX());
  const x1 = Math.min(...xs) - 2;
  const x2 = Math.max(...xs) + 12;
  const ys = group.flatMap((n) => {
    try {
      return n.getYs();
    } catch {
      return [];
    }
  });
  if (ys.length === 0) return;
  const yEdge = above ? Math.min(...ys) - 9 : Math.max(...ys) + 9;
  const bulge = above ? -9 : 9;
  const midX = (x1 + x2) / 2;
  const path = document.createElementNS(SVG_NS, "path");
  // Quadratic arc; its apex sits at yEdge + bulge, where the digit goes.
  path.setAttribute("d", `M ${x1} ${yEdge} Q ${midX} ${yEdge + bulge * 2} ${x2} ${yEdge}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#222");
  path.setAttribute("stroke-width", "1.1");
  svg.appendChild(path);
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(midX));
  text.setAttribute("y", String(yEdge + bulge + (above ? -2 : 11)));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
  text.setAttribute("font-size", "13");
  text.setAttribute("font-style", "italic");
  text.setAttribute("font-weight", "bold");
  text.setAttribute("fill", "#222");
  text.textContent = "3";
  svg.appendChild(text);
}

/** VexFlow's default distance between two staff lines, in SVG units — the unit all the AEU
 *  accidental geometry below is expressed in, so it stays correct at any render scale. */
const STAFF_SPACE = 10;

/**
 * Shared stroke weights for the AEU sharps, in STAFF SPACES — taken from REAL PRINT, not Bravura.
 *
 * Measured on `data/real/strips/hala_kanayan_kalbimi_ney_p1/..._s03_w00.png`, a real neyzen page
 * carrying a küçük mücennep sharp both in its signature and inline, at a staff size matched to
 * Bravura's (≈30px between staff lines). The two instances agree to the pixel, and a second
 * edition (`strips_exam_v2_clean/bulbulun_cilesi...`) gives the same 0.300 S bar on a koma.
 *
 * **Bravura draws every AEU sharp with a 0.367 S bar; real print draws 0.300 S.** The weight is
 * applied to all four so that BAR COUNT stays the only thing separating them — thinning just the
 * one broken glyph would hand the model a thickness cue that real pages do not have.
 */
const AEU_SHARP_STROKE = {
  stem: 0.133,
  height: 2.7,   // stem length
  bar: 0.3,      // bar thickness, measured vertically as drawn (Bravura: 0.367)
  slope: 0.357,  // rise / run — each bar's rise scales with its own length
};

/**
 * The four AEU sharps as stem offsets and bar lengths, in STAFF SPACES. The family is one
 * systematic design: 1 or 2 vertical stems crossed by 2 or 3 slanted bars, and the glyphs are told
 * apart ONLY by those counts. Lengths follow Bravura so each keeps its familiar shape; the küçük's
 * are the real-print ones (stubby top/bottom bars either side of a full-width middle bar — the
 * "staircase" a domain reader recognises).
 *
 * Why the three-bar glyphs needed this at all — the white gap left between neighbouring bars:
 *
 *                     bar pitch   Bravura gap   new gap
 *   koma   (2 bars)     0.94 S       0.58 S      0.64 S   (never at risk)
 *   bakiye (2 bars)     1.03 S       0.66 S      0.73 S   (never at risk)
 *   küçük  (3 bars)     0.65 S       0.12 S      0.35 S   ← fused into a block
 *   büyük  (3 bars)     0.51 S       0.14 S      0.21 S   ← fused into a block
 *
 * A 0.12 S gap is ~1–2px once the encoder has shrunk the strip, so a küçük's three bars merge and
 * it decodes as a 2-bar koma. That is the measured failure: gold küçük read as koma, the single
 * most common error on BOTH the clean exam and the photo strips, and one-directional
 * (`scripts/rung3/sharp_width_test.py`).
 *
 * **The küçük's 0.65 S pitch is deliberately wider than the 0.55 S measured in real print** — a
 * domain-expert call, chosen off `data/real/rung3/sharp_probe/kucuk_pitch_options.png`: it is the
 * glyph the model actually fails on, so its bars are opened a little past life-size to survive the
 * shrink, while staying far from koma's 0.94 S (at which point küçük's outer pair would start to
 * read as a koma). Note the trade: synthetic küçüks are spaced slightly more openly than printed
 * ones, so if the model ever starts missing TIGHTLY printed küçüks, move this back toward 0.55
 * rather than opening it further.
 */
const AEU_SHARPS: Record<number, { stems: number[]; pitch: number; lengths: number[] }> = {
  0xe444: { stems: [0], pitch: 0.94, lengths: [0.9, 0.9] },                  // koma
  0xe445: { stems: [-0.23, 0.23], pitch: 1.03, lengths: [1.0, 1.0] },        // bakiye
  0xe446: { stems: [0], pitch: 0.65, lengths: [0.73, 1.4, 0.73] },           // küçük mücennep
  0xe447: { stems: [-0.23, 0.23], pitch: 0.51, lengths: [1.0, 1.37, 1.0] },  // büyük mücennep
};

/**
 * Redraw the AEU sharps at real-print bar weight, replacing Bravura's heavier glyphs.
 *
 * Why redraw rather than pick a lighter font: no VexFlow font ships the AEU accidentals at all
 * (they are rendered as raw Bravura `<text>` — see {@link addAccidental}), and a font glyph cannot
 * be thinned, so the shapes are drawn here instead. Sharps only — the flat family scores 89–92%,
 * and changing a healthy class risks a regression for no measured gain.
 *
 * Runs after the engrave, over both VexFlow's inline accidentals and our own key-signature glyphs.
 * Pixels only: labels are serialized from the doc, never from what is drawn.
 */
function drawThinSharps(svg: SVGSVGElement, staffSpace: number) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const S = staffSpace;
  const w = AEU_SHARP_STROKE;
  for (const text of Array.from(svg.querySelectorAll("text"))) {
    const cp = text.textContent?.codePointAt(0);
    const shape = cp === undefined ? undefined : AEU_SHARPS[cp];
    if (!shape) continue;
    let box: DOMRect;
    try {
      box = text.getBBox();
    } catch {
      continue;
    }
    if (box.width === 0 || box.height === 0) continue; // unmeasurable (font not loaded) — leave it
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("fill", "#000");
    group.setAttribute("data-omr", "aeu-sharp"); // inspection only (an attribute, not pixels)

    for (const dx of shape.stems) {
      const stem = document.createElementNS(SVG_NS, "rect");
      stem.setAttribute("x", String(cx + dx * S - (w.stem * S) / 2));
      stem.setAttribute("y", String(cy - (w.height * S) / 2));
      stem.setAttribute("width", String(w.stem * S));
      stem.setAttribute("height", String(w.height * S));
      group.appendChild(stem);
    }

    // Parallelogram bars rising left→right, stacked around the glyph centre and centred on it.
    // The white gap between them is the whole signal.
    const t = (w.bar * S) / 2;
    const n = shape.lengths.length;
    shape.lengths.forEach((lenS, i) => {
      const len = lenS * S;
      const half = len / 2;
      const rise = (len * w.slope) / 2; // shorter bars rise less — same slope, not same rise
      const y = cy + (i - (n - 1) / 2) * shape.pitch * S;
      const poly = document.createElementNS(SVG_NS, "polygon");
      poly.setAttribute(
        "points",
        [
          [cx - half, y + rise + t],
          [cx + half, y - rise + t],
          [cx + half, y - rise - t],
          [cx - half, y + rise - t],
        ]
          .map(([px, py]) => `${px},${py}`)
          .join(" "),
      );
      group.appendChild(poly);
    });
    text.replaceWith(group);
  }
}

/**
 * Draw a plain PHRASE SLUR — a curved arc over a run of noteheads WITHOUT the tuplet "3" — as raw
 * SVG. Real Turkish editions slur legato groups, but the synthetic corpus drew arcs ONLY on
 * triplets, so the model learned "any over-note arc ⇒ `\tup3`" (baseline tup3 precision 15%, and
 * the arc-triggered false-`\tup3` rate the Step-4.0 metric watches). These label-free distractors
 * teach that an arc ALONE is not a triplet — only arc + "3" is. Pixels only: a slur is never a
 * label token, and buildStrips serializes from the doc, so the labels stay plain automatically.
 */
function drawSlurArc(svg: SVGSVGElement, group: StaveNote[], above: boolean) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const xs = group.map((n) => n.getAbsoluteX());
  const x1 = Math.min(...xs) - 1;
  const x2 = Math.max(...xs) + 10;
  const ys = group.flatMap((n) => {
    try {
      return n.getYs();
    } catch {
      return [];
    }
  });
  if (ys.length === 0) return;
  const yEdge = above ? Math.min(...ys) - 8 : Math.max(...ys) + 8;
  const bulge = above ? -7 : 7; // shallower than the tuplet arc, and no digit — a phrase slur
  const midX = (x1 + x2) / 2;
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `M ${x1} ${yEdge} Q ${midX} ${yEdge + bulge * 2} ${x2} ${yEdge}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#222");
  path.setAttribute("stroke-width", "1.1");
  path.setAttribute("data-omr", "slur"); // for tests/inspection only (an attribute, not pixels)
  svg.appendChild(path);
}

// Volta bracket height above the top staff line: close to the row (clear of most beams) and well
// inside the strip-crop window (which starts ~46px above the top line).
const VOLTA_ABOVE = 26;

/**
 * Draw a volta (1./2. ending) bracket over one measure, as raw SVG — like the key signature and
 * meter. VexFlow's own `Volta` places the bracket ~7 staff spaces above the top line and its label
 * ignores the y-shift, so it can't be brought closer to the row.
 */
function drawVolta(svg: SVGSVGElement, stave: Stave, label: string) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const y = stave.getYForLine(0) - VOLTA_ABOVE;
  // Start the bracket where the music starts, not at the stave's left edge — on a row-start
  // measure the bracket must not reach back over the clef / key signature / begin-repeat sign.
  const x1 = Math.max(stave.getX() + 1, stave.getNoteStartX() - 6);
  const x2 = stave.getX() + stave.getWidth() - 2;
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `M ${x1} ${y + 12} V ${y} H ${x2} V ${y + 12}`); // ⌐¬ down-ticks at both ends
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#222");
  path.setAttribute("stroke-width", "1.2");
  svg.appendChild(path);
  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", String(x1 + 6));
  t.setAttribute("y", String(y + 12));
  t.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
  t.setAttribute("font-size", "12");
  t.setAttribute("fill", "#222");
  t.textContent = label;
  svg.appendChild(t);
}

// SMuFL codepoints for the navigation glyphs (Bravura, same raw-glyph path as the key signature).
const NAV_GLYPH_CODEPOINT = { segno: 0xe047, coda: 0xe048 } as const;
// Printed text of the navigation text marks ("Son" = the Turkish Fine, as on the real sheets).
const NAV_TEXT = { dc: "D.C.", fine: "Son" } as const;

/**
 * Draw one measure's navigation marks (segno 𝄋 / coda ⊕ glyphs, "D.C." / "Son" text) as raw SVG,
 * like the key signature and voltas. Start-edge marks sit above the measure's first note,
 * end-edge marks at its right barline; `below` text marks go under the bottom staff line (both
 * placements appear in real prints). Injection (navmarks.ts) keeps these off repeat/volta
 * measures, so the above-staff band never stacks two kinds of ink.
 */
function drawNavMarks(svg: SVGSVGElement, stave: Stave, marks: { start: NavMark[]; end: NavMark[] }) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  for (const edge of ["start", "end"] as const) {
    for (const m of marks[edge]) {
      const t = document.createElementNS(SVG_NS, "text");
      const atEnd = edge === "end";
      if (m.type === "segno" || m.type === "coda") {
        // Glyph baseline a touch above the top line; the glyph body extends upward, staying
        // inside the strip-crop window (which starts ~46px above the top line — see drawVolta).
        // End-edge glyphs are right-anchored so they stay inside the measure's crop rect.
        t.setAttribute("x", String(atEnd ? stave.getX() + stave.getWidth() - 2 : Math.max(stave.getX() + 2, stave.getNoteStartX() - 4)));
        t.setAttribute("y", String(stave.getYForLine(0) - 12));
        t.setAttribute("font-family", "Bravura");
        t.setAttribute("font-size", "22"); // ~2.5 staff spaces tall, like the printed sheets
        if (atEnd) t.setAttribute("text-anchor", "end");
        t.textContent = String.fromCodePoint(NAV_GLYPH_CODEPOINT[m.type]);
      } else {
        const y = m.below ? stave.getYForLine(4) + 18 : stave.getYForLine(0) - 16;
        t.setAttribute("x", String(atEnd ? stave.getX() + stave.getWidth() - 2 : stave.getNoteStartX()));
        t.setAttribute("y", String(y));
        t.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
        t.setAttribute("font-size", "13");
        t.setAttribute("font-style", "italic");
        if (atEnd) t.setAttribute("text-anchor", "end");
        t.textContent = NAV_TEXT[m.type];
      }
      t.setAttribute("fill", "#222");
      svg.appendChild(t);
    }
  }
}

/**
 * Draw one lyric syllable centered under a note, below the staff (like the original engraved
 * sheets). SymbTr stores the syllable per note; "." marks a melisma/continuation (no new text)
 * and is skipped by the caller. Drawn as a plain SVG <text> in a serif face.
 */
function drawLyric(svg: SVGSVGElement, x: number, y: number, text: string): SVGTextElement {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text") as SVGTextElement;
  t.setAttribute("x", String(x));
  t.setAttribute("y", String(y));
  t.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
  t.setAttribute("font-size", "13");
  t.setAttribute("text-anchor", "middle"); // center the syllable under the notehead
  t.setAttribute("fill", "#222");
  t.textContent = text;
  svg.appendChild(t);
  return t;
}

/**
 * Melisma extension line: an underscore-style rule drawn just BELOW the lyric baseline (so it
 * never cuts through the text), between caller-supplied endpoints. Used to carry a held syllable
 * across the notes it's sung over — including spanning multiple rows.
 */
function drawMelismaLine(svg: SVGSVGElement, startX: number, endX: number, baseY: number) {
  if (endX - startX < 8) return; // too short to read as an extension
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(startX));
  line.setAttribute("x2", String(endX));
  line.setAttribute("y1", String(baseY + 2)); // below the baseline → reads as an underscore
  line.setAttribute("y2", String(baseY + 2));
  line.setAttribute("stroke", "#222");
  line.setAttribute("stroke-width", "1.3");
  svg.appendChild(line);
}

/** One note's lyric slot: its x, the row's baseline, and what it carries. */
interface LyricItem {
  x: number;
  baseY: number;
  row: number;
  text: string;
  hold: boolean; // melisma/continuation note (no new syllable)
  wordEnd: boolean; // this syllable ends a word
}

/**
 * Render the lyric line under the staff like an engraved score: syllables centered under their
 * notes, a HYPHEN in the gap between a word's syllables (but not across word boundaries), and a
 * MELISMA underscore carrying a held syllable across the notes it's sung over — continuing across
 * row breaks. Text widths are measured so connectors sit in the gaps and never cut through text.
 */
function drawLyrics(svg: SVGSVGElement, items: LyricItem[], hyphens: boolean) {
  // Per-row first/last note x and baseline, so a melisma can span whole rows and start at the
  // first note (clear of the clef/key signature), not at the page margin.
  const rowMinX = new Map<number, number>();
  const rowMaxX = new Map<number, number>();
  const rowBaseY = new Map<number, number>();
  for (const it of items) {
    rowMinX.set(it.row, Math.min(rowMinX.get(it.row) ?? Infinity, it.x));
    rowMaxX.set(it.row, Math.max(rowMaxX.get(it.row) ?? 0, it.x));
    rowBaseY.set(it.row, it.baseY);
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.hold) continue; // held notes carry no syllable; a preceding melisma underscore spans them
    const el = drawLyric(svg, it.x, it.baseY, it.text);
    const halfW = (el.getComputedTextLength?.() || it.text.length * 7) / 2;
    const rightEdge = it.x + halfW;

    // Run of held notes after this syllable (across rows), up to the next real syllable.
    let j = i + 1;
    while (j < items.length && items[j]!.hold) j++;
    const next = j < items.length ? items[j]! : null;

    if (j > i + 1) {
      // Melisma: an underscore per row segment, from the syllable to the last held note. On the
      // final row it stops just before the next syllable (if any) so the line leads into it.
      const last = items[j - 1]!;
      for (let row = it.row; row <= last.row; row++) {
        // First row starts just after the syllable; later rows start at that row's first note.
        const startX = row === it.row ? rightEdge + 4 : (rowMinX.get(row) ?? LEFT) - 4;
        // Stop at the last held note of the row — on the final row this leaves the gap before the
        // next syllable, so the underscore never runs into it.
        const endX = row === last.row ? last.x : rowMaxX.get(row) ?? startX;
        drawMelismaLine(svg, startX, endX, rowBaseY.get(row) ?? it.baseY);
      }
    } else if (hyphens && next && !it.wordEnd) {
      // Same word continues on the very next note → hyphen (only when enabled).
      if (next.row === it.row) {
        drawLyric(svg, (rightEdge + next.x) / 2, it.baseY, "-"); // in the gap between syllables
      } else {
        drawLyric(svg, rightEdge + 7, it.baseY, "-"); // word breaks across rows → trailing hyphen
      }
    }
  }
}

// SMuFL time-signature digits live at U+E080 (0) … U+E089 (9) in the music font.
const timeSigGlyphs = (n: number): string =>
  [...String(n)].map((d) => String.fromCodePoint(0xe080 + Number(d))).join("");

/**
 * Draw the meter (e.g. 9/8) as stacked Bravura digits centered on `centerX`: numerator in the
 * upper half of the staff, denominator in the lower half. Drawn ourselves (not via VexFlow's
 * `addTimeSignature`, which always sits right after the clef) so it can follow the key signature.
 */
function drawTimeSignature(svg: SVGSVGElement, stave: Stave, centerX: number, ts: { num: number; den: number }) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const space = stave.getYForLine(1) - stave.getYForLine(0); // px per staff space
  // Center the stack on the middle line, nudged up slightly: Bravura's digit baseline renders a
  // touch low, so this small lift makes the meter read vertically centered on the staff.
  const mid = stave.getYForLine(2) - space * 0.35;
  const digit = (value: number, y: number) => {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(centerX));
    text.setAttribute("y", String(y));
    text.setAttribute("font-family", "Bravura");
    text.setAttribute("font-size", "39"); // ~4-space em; each digit spans ~2 staff spaces
    text.setAttribute("text-anchor", "middle"); // auto-centers multi-digit numbers (e.g. "10")
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "#222");
    text.textContent = timeSigGlyphs(value);
    svg.appendChild(text);
  };
  digit(ts.num, mid - space); // numerator one space above the middle line
  digit(ts.den, mid + space); // denominator one space below the middle line
}

interface MeasureBox {
  index: number;
  measure: Measure;
  x: number;
  y: number;
  width: number;
}

/**
 * Where one DRAWN note sits on screen, so edit mode can hit-test a click against it.
 *
 * Kept deliberately inside SheetView rather than pushed out through `onLayout`: that payload is
 * a contract shared with stripExport.ts and tools/render/render.ts, which crop training strips by
 * those measure rects, and the only consumer of per-note geometry is the overlay a few lines
 * below. (`onLayout` is also an engrave dependency, so a second callback prop would have to be
 * stable in the parent or re-engrave forever.)
 *
 * Two known holes, both documented rather than papered over:
 *  - a tie-split event draws TWO StaveNotes, so it gets two boxes with the same `evIndex`;
 *  - grace notes (çarpma) are modifiers on the following note, never entries in `notes[]`, so
 *    they get no box and cannot be selected. Deleting their host takes them with it.
 */
interface NoteBox {
  /** `NoteEvent.index` — the same 1-based handle updateEvent and the edit primitives match on. */
  evIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fallback half-width for a note whose bounding box VexFlow won't give us. */
const NOTE_FALLBACK_W = 14;
/** Slack around a note's box so a click near the notehead still lands on it. */
const NOTE_HIT_PAD = 3;
/** Vertical drag (px) that moves a note one diatonic step — half a staff space, i.e. the real
 *  distance between a line and the space above it, so the note tracks the pointer. */
const DRAG_PX_PER_STEP = STAFF_SPACE / 2;

/**
 * The clickable box of one drawn note, in the SVG's coordinate space (which is the overlay's too
 * — the container is never transformed; see the .kv-score rule in CLAUDE.md).
 */
function noteBoxOf(n: StaveNote, evIndex: number, barTop: number, barHeight: number): NoteBox {
  try {
    const bb = n.getBoundingBox();
    if (bb && Number.isFinite(bb.getW()) && bb.getW() > 0) {
      return { evIndex, x: bb.getX(), y: bb.getY(), width: bb.getW(), height: bb.getH() };
    }
  } catch {
    // fall through to the stave-height fallback below
  }
  return { evIndex, x: n.getAbsoluteX() - NOTE_FALLBACK_W / 2, y: barTop, width: NOTE_FALLBACK_W, height: barHeight };
}

/** Where a single timed event sits on screen, so the playhead can follow playback. */
interface NotePos {
  startMs: number;
  endMs: number;
  /** Left x of the note within the SVG (same coordinate space as the overlay). */
  x: number;
  /** Top y of the playhead bar for this note's row (just above the top staff line). */
  top: number;
  /** Height of the playhead bar (staff height plus a small margin each side). */
  height: number;
}

/**
 * Sheet-music (notation) view, engraved with VexFlow: real stems, flags, beams, dots and
 * duration-correct noteheads/rests. Turkish (AEU) microtonal accidentals are rendered from
 * the Bravura font via the project's verified SMuFL glyph map. In edit mode, an HTML overlay
 * makes each measure clickable to open the per-measure editor.
 */
export function SheetView({
  doc,
  editMode,
  accidentalMode,
  showLyrics,
  lyricHyphens,
  playing,
  getPositionMs,
  onMeasureClick,
  onSeekToMeasure,
  selectedNote,
  onSelectNote,
  onDeleteNote,
  onNudgePitch,
  armed,
  onApplyTool,
  onLayout,
  highlightRect,
  repeatSpans,
  navMarks,
  textNoise,
  slurNoise,
  thinSharps,
  printNoise,
  signatureOverride,
}: {
  doc: NoteModelDocument;
  editMode: boolean;
  /** How accidentals are displayed (see {@link AccidentalMode}). The key signature is drawn at
   *  each row start in `"keysig"` and `"measure"` modes. */
  accidentalMode: AccidentalMode;
  /** CONVENTIONAL printed-signature override (drawn-order entries). When set, replaces the
   *  content-derived `deriveKeySignature` for BOTH the drawn glyphs and the mode's accidental
   *  decisions, so the makam's real PRINTED signature is engraved. Must be the SAME entries the
   *  strip exporter gets (faithful scheme: pixels == labels). Undefined → derive from the doc. */
  signatureOverride?: { letter: string; alterCommas: number }[];
  /** Draw lyric syllables under the notes (skipping the "." melisma placeholders). */
  showLyrics: boolean;
  /** Draw a hyphen between a word's syllables (e.g. "Gam-ze-de"). Most sheets omit these. */
  lyricHyphens: boolean;
  /** True while there's an active (playing or paused) position — drives the playhead. */
  playing: boolean;
  /** Current playback position in ms (from the audio backend), or null when stopped. */
  getPositionMs: () => number | null;
  /** Edit mode: open the editor for a measure. Fires on a click that misses every note — the
   *  measure modal is still how notes are inserted and re-valued until the palette lands. */
  onMeasureClick: (m: Measure) => void;
  /** Non-edit mode: seek/play from the clicked measure. */
  onSeekToMeasure: (m: Measure) => void;
  /** Edit mode: which event (`NoteEvent.index`) is selected, or null. */
  selectedNote?: number | null;
  /** Edit mode: a note was clicked (null when a click landed on nothing selectable). */
  onSelectNote?: (index: number | null) => void;
  /** Edit mode: the selected note's ✕ was pressed. */
  onDeleteNote?: (index: number) => void;
  /** Edit mode: the note was dragged up or down — ±1 diatonic step per half staff space,
   *  accidental carried. Signed steps, not a delta in pixels. */
  onNudgePitch?: (index: number, steps: number) => void;
  /** Edit mode: is a palette tool armed? Only its ARMEDNESS matters here — the sheet does not
   *  care which tool it is; it just routes the click to `onApplyTool` instead of starting a
   *  pitch drag, and shows the "this click applies something" cursor. */
  armed?: boolean;
  /** Edit mode: a note was clicked while a tool was armed. Fires once per click, even for a
   *  tie-split event (two boxes, one `evIndex`). */
  onApplyTool?: (index: number) => void;
  /** Fired after each engrave with every measure's on-screen rectangle (1-based `index`, `x`, `y`,
   *  `width`) and the SVG size. Used by the Step-2c strip exporter to compute crop rectangles. */
  onLayout?: (layout: { boxes: { index: number; x: number; y: number; width: number }[]; svgWidth: number; svgHeight: number; rowHeight: number }) => void;
  /** Step-2c: draw a translucent rectangle over a strip's crop region (SVG coordinate space). */
  highlightRect?: { x: number; y: number; width: number; height: number } | null;
  /** Phase-2 preview: repeat barlines + volta brackets to draw (SymbTr has none, so these are
   *  synthesized — see repeats.ts). Empty/undefined → the default engraving, untouched. */
  repeatSpans?: RepeatSpan[];
  /** Rung-2: navigation marks (segno/coda/D.C./Son) to draw — injected, SymbTr has none
   *  (see navmarks.ts). Empty/undefined → none drawn. */
  navMarks?: NavMark[];
  /** Rung-2 distractor text drawn INSIDE the SVG (so strip crops capture it) — see textNoise.ts.
   *  Pixels only; labels never see it. Undefined → no noise (interactive use). */
  textNoise?: { seed: number } | null;
  /** Round-1 phrase-slur distractors: label-free arcs over non-triplet note runs (see drawSlurArc)
   *  so the model stops reading every arc as a `\tup3`. Pixels only. Undefined → none. */
  slurNoise?: { seed: number } | null;
  /** Round-2: redraw the AEU sharps with real-print bar weight so the three bars of a küçük/büyük
   *  mücennep stay separated after downscaling (see drawThinSharps). Pixels only. → Bravura. */
  thinSharps?: boolean;
  /** Round-3 print realism: seeded staff-line weight + usul beam grouping, so the corpus varies
   *  the way real editions do (see STAFF_LINE_WIDTH / USUL_BEAM_GROUPS). Pixels only — the labels
   *  come from the note model and are identical with and without it. Undefined → VexFlow's
   *  defaults, i.e. every strip rendered before Round 3. */
  printNoise?: { seed: number } | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  // An in-progress pitch drag: which event, where the pointer went down, and how many steps have
  // already been applied. A ref, not state — every applied step re-engraves the score, and the
  // drag has to survive those re-renders unchanged.
  const dragRef = useRef<{ index: number; startY: number; applied: number } | null>(null);
  // On-screen position of every timed event, in playback order. A ref (not state) because the
  // playhead animation reads it every frame and must not trigger re-renders.
  const positionsRef = useRef<NotePos[]>([]);
  const [boxes, setBoxes] = useState<MeasureBox[]>([]);
  // Per-note click targets for edit mode. State (not a ref like `positionsRef`) because the
  // overlay renders from them; they change only on a re-engrave, so this costs nothing.
  const [noteBoxes, setNoteBoxes] = useState<NoteBox[]>([]);
  const [svgHeight, setSvgHeight] = useState(ROW_HEIGHT + 20);
  const [hover, setHover] = useState<number | null>(null);

  // Distinct accidentals used, for the legend.
  const usedAccidentals = useMemo(() => {
    const set = new Set<number>();
    for (const ev of doc.events) {
      if (ev.kind !== "note") continue;
      const p = parseNoteName(ev.noteName);
      if (!p) continue;
      const a = toAeuAlter(p.alterCommas); // legend lists the AEU signs actually drawn
      if (a !== 0) set.add(a);
    }
    return [...set].sort((a, b) => a - b);
  }, [doc]);

  // The key signature (prevailing accidental per letter), and a lookup map. A caller-supplied
  // override (the makam's conventional PRINTED signature) wins over the doc-derived one — the render
  // pipeline passes it so synthetic pages wear the real printed signature (see stripExport.ts).
  const signature = useMemo(() => signatureOverride ?? deriveKeySignature(doc), [doc, signatureOverride]);
  const signatureMap = useMemo(() => new Map(signature.map((s) => [s.letter, s.alterCommas])), [signature]);

  // The usul meter (e.g. 9/8 for aksak), printed once at the start of the first staff.
  const timeSig = useMemo(() => deriveTimeSignature(doc), [doc]);

  // Printed-header metadata extracted from the score (makam, form, usul, composer) + its notated
  // tempo (we estimate it; SymbTr stores none). Rendered as an engraved-style header above the staff.
  const header = useMemo(() => scoreHeader(doc), [doc]);
  const headerBpm = useMemo(() => estimateBpm(doc), [doc]);

  // Draw the score with VexFlow whenever the document changes. (Edit mode only toggles the
  // HTML overlay below, so it deliberately isn't a dependency — no need to re-engrave.)
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = ""; // clear any previous render (also handles React 18 double-invoke)

    // Seeded RNG for the phrase-slur distractors (drawn per measure below; same seed → same slurs).
    const slurRng = slurNoise ? mulberry32(slurNoise.seed) : null;

    // Round-3 print realism, drawn once per render so a whole page is internally consistent (a
    // real edition has ONE staff weight and ONE beaming convention). Draw order is fixed so a
    // seed always yields the same page.
    const printRng = printNoise ? mulberry32(printNoise.seed) : null;
    const staffLineWidth = printRng
      ? STAFF_LINE_WIDTH.min + printRng() * (STAFF_LINE_WIDTH.max - STAFF_LINE_WIDTH.min)
      : null;
    // Beam by the usul's groups on a seeded coin (half the corpus), else VexFlow's quarter-note
    // clock. Only meters we have actually seen engraved get a grouping.
    const usulGroups =
      printRng && printRng() < 0.5 && timeSig
        ? USUL_BEAM_GROUPS[`${timeSig.num}/${timeSig.den}`]?.map((n) => new Fraction(n, timeSig.den))
        : undefined;
    const beamConfig = usulGroups ? { groups: usulGroups } : {};

    // The key signature is drawn whenever accidentals aren't shown on every note.
    const showSignature = accidentalMode !== "every";
    // Width the key signature needs after the clef on each row's first stave (0 when off).
    const sigWidth = showSignature && signature.length ? signature.length * SIG_GLYPH_ADVANCE + 10 : 0;
    // The clef + (optional) signature both repeat on the first stave of every row.
    const leadWidth = CLEF_W + sigWidth;
    // Extra room the meter (e.g. 9/8) needs — only on the very first stave of the piece.
    // Scales with the widest of numerator/denominator so multi-digit meters (10/8) still fit.
    const timeSigWidth = timeSig
      ? Math.max(String(timeSig.num).length, String(timeSig.den).length) * 16 + 10
      : 0;

    // Tuplet mark style, chosen ONCE per piece (a real edition engraves them one way): the
    // curved arc + "3" of most printed Turkish scores (~70% of pieces, by name hash) or
    // VexFlow's square bracket. The label token is identical either way — the style variety
    // is free training realism.
    const tupletCurved =
      Array.from(doc.name ?? "").reduce((s, ch) => s + ch.charCodeAt(0), 0) % 10 < 7;

    // Pack measures into rows (greedy wrap). The first stave of each row pays for the clef;
    // the very first measure additionally pays for the one-time time signature.
    const measures = groupMeasures(doc);
    type Cell = { m: Measure; width: number; firstInRow: boolean };
    const rows: Cell[][] = [];
    let cur: Cell[] = [];
    let used = 0;
    let firstMeasure = true;
    for (const m of measures) {
      const extra = firstMeasure ? timeSigWidth : 0;
      const base = Math.max(130, Math.min(420, m.events.length * 28 + 24));
      const isFirst = cur.length === 0;
      const width = base + (isFirst ? leadWidth : 0) + extra;
      if (!isFirst && used + width > CONTENT_WIDTH) {
        rows.push(cur);
        cur = [{ m, width: base + leadWidth, firstInRow: true }];
        used = base + leadWidth;
      } else {
        cur.push({ m, width, firstInRow: isFirst });
        used += width;
      }
      firstMeasure = false;
    }
    if (cur.length) rows.push(cur);

    // Justify each row to a uniform width, like engraved music: stretch its measures so every row
    // ends at the same right margin instead of a ragged edge. Scaling is proportional, so the
    // first measure (which carries the clef/sig) stays a touch wider — as in real scores. The
    // LAST row is left natural: short final systems are normal, and justifying a near-empty last
    // line would blow its spacing apart. Uniform rows matter for Phase-2 synthetic data realism.
    rows.forEach((cells, r) => {
      if (r === rows.length - 1) return; // final system stays ragged, as in real engraving
      const sum = cells.reduce((s, c) => s + c.width, 0);
      if (sum > 0) for (const c of cells) c.width *= CONTENT_WIDTH / sum;
    });

    const height = rows.length * ROW_HEIGHT + 20;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(SVG_WIDTH, height);
    const ctx = renderer.getContext();
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    svg?.setAttribute("data-omr", "sheet-svg"); // stable selector for the Playwright strip exporter

    const collected: MeasureBox[] = [];
    const positions: NotePos[] = [];
    const noteRects: NoteBox[] = [];
    const lyricItems: LyricItem[] = []; // collected across all staves, drawn in one pass below
    let tMs = 0; // running playback clock, matches buildTimeline's accumulation order
    rows.forEach((cells, r) => {
      const y = STAVE_TOP_PAD + r * ROW_HEIGHT;
      let x = LEFT;
      for (const cell of cells) {
        const stave = new Stave(x, y, cell.width);
        if (cell.firstInRow) stave.addClef("treble");
        // Lay out the leading symbols left→right: clef, then the makam key signature, then the
        // meter (clef → flats → 9/8, matching engraved Turkish scores). We draw the key sig and
        // meter as Bravura glyphs ourselves (VexFlow's native versions don't fit either case),
        // so we just reserve horizontal space here and remember each one's start x.
        const clefEnd = stave.getNoteStartX();
        const drawSig = showSignature && cell.firstInRow && signature.length > 0;
        const drawTime = r === 0 && cell.firstInRow && timeSig != null;
        const sigStartX = clefEnd;
        const timeStartX = clefEnd + (drawSig ? sigWidth : 0);
        const reserved = (drawSig ? sigWidth : 0) + (drawTime ? timeSigWidth : 0);
        // Phase-2: fold-detected repeat signs. Barline types are stave modifiers; setting one
        // invalidates the stave's layout, so they must go BEFORE setNoteStartX — otherwise the
        // re-format on draw() recomputes the note start and the notes overlap the hand-drawn
        // signature/meter glyphs. (The volta brackets are hand-drawn SVG — see drawVolta — added
        // after the stave exists.)
        const repMarks = repeatMarksAt(cell.m.index, repeatSpans);
        if (repMarks.repStart) stave.setBegBarType(Barline.type.REPEAT_BEGIN);
        if (repMarks.repEnd) stave.setEndBarType(Barline.type.REPEAT_END);
        if (reserved > 0) {
          // getNoteStartX re-formats first, so this includes any begin-repeat barline's width.
          stave.setNoteStartX(stave.getNoteStartX() + reserved);
          // VexFlow places a begin-repeat `‖:` directly after the clef; push it past the reserved
          // glyph space so the engraved order stays clef → flats → meter → ‖: → notes.
          if (repMarks.repStart) {
            const bar = stave.getModifiers(StaveModifierPosition.BEGIN, Barline.CATEGORY)[0];
            bar?.setX(bar.getX() + reserved);
          }
        }
        // drawWithStyle (not draw) so the seeded staff-line weight is applied and then restored;
        // it also reaches the barlines, which thicken with the staff in real print.
        if (staffLineWidth != null) {
          stave.setStyle({ lineWidth: staffLineWidth });
          stave.setContext(ctx).drawWithStyle();
        } else {
          stave.setContext(ctx).draw();
        }
        if (svg && repMarks.volta1) drawVolta(svg, stave, "1.");
        if (svg && repMarks.volta2) drawVolta(svg, stave, "2.");
        if (svg && navMarks?.length) drawNavMarks(svg, stave, navMarksAt(cell.m.index, navMarks));
        // Playhead extent for this row, from the actual staff-line positions (the Stave's y
        // param is its bounding-box top, which sits well above the first staff line).
        const barTop = stave.getYForLine(0) - CURSOR_MARGIN;
        const barHeight = stave.getYForLine(4) - stave.getYForLine(0) + 2 * CURSOR_MARGIN;
        try {
          const { notes, slots, tuplets, ties } = buildStaveNotes(cell.m, accidentalMode, signatureMap);
          if (notes.length > 0) {
            // Beaming: a triplet's members must beam TOGETHER (one beam under the "3" bracket,
            // as engraved) — auto-beam groups by quarter-note beat and would split or absorb
            // them. So beams are built explicitly: one per tuplet group (over its beamable
            // notes), auto-generated groups for every stretch between tuplets. Beams must
            // exist BEFORE FormatAndDraw (they set the stems) and draw after it.
            const inTuplet = new Set(tuplets.flat());
            const beams: Beam[] = [];
            let run: StaveNote[] = [];
            const flushRun = () => {
              // A fresh config object per call: generateBeams writes its default groups into the
              // object it is handed, so a shared literal would leak one run's fallback into the next.
              if (run.length > 0) beams.push(...Beam.generateBeams(run, { ...beamConfig }));
              run = [];
            };
            for (const n of notes) {
              if (inTuplet.has(n)) flushRun();
              else run.push(n);
            }
            flushRun();
            const beamable = (n: StaveNote) => !n.isRest() && ["8", "16", "32", "64"].includes(n.getDuration());
            for (const group of tuplets) {
              let sub: StaveNote[] = [];
              const flushSub = () => {
                // autoStem=true: derive the group's stem direction from pitch (like
                // Beam.generateBeams does for plain runs) instead of VexFlow's default forced-up.
                // Forced-up made EVERY tuplet render stems-up → beam-above → "3" below; real
                // engravings (and printed Turkish scores) stem high passages down → "3" above.
                if (sub.length >= 2) beams.push(new Beam(sub, true));
                sub = [];
              };
              for (const n of group) {
                if (beamable(n)) sub.push(n);
                else flushSub();
              }
              flushSub();
            }
            // alignRests OFF: it shifts rests vertically toward the surrounding melody (a
            // multi-voice collision feature), floating them near the top line in this high
            // repertoire. Real single-voice engraving — and the printed sheets the OMR must
            // read — keeps rests centered at their standard staff position (b/4).
            Formatter.FormatAndDraw(ctx, stave, notes, { autoBeam: false, alignRests: false });
            beams.forEach((b) => b.setContext(ctx).draw());
            attachTitles(notes, slots.map((s) => s.ev));
            // Rhythm signs draw AFTER FormatAndDraw so the notes have positions: the "3" mark
            // over/under each triplet group (curved arc or square bracket per the piece style,
            // on the notehead side — see tupletAbove/drawTupletArc), and the tie arcs of split
            // long values. The mark always shows "3" (numNotes 3 / notesOccupied 2 = the 3:2
            // ratio) even for a mixed-value group, matching the `\tup3` label.
            for (const group of tuplets) {
              const above = tupletAbove(group);
              if (tupletCurved && svg) drawTupletArc(svg, group, above);
              else
                new Tuplet(group, {
                  numNotes: 3,
                  notesOccupied: 2,
                  bracketed: true,
                  ratioed: false,
                  location: above ? 1 : -1,
                })
                  .setContext(ctx)
                  .draw();
            }
            // Phrase-slur distractors: label-free arcs over runs of ≥3 consecutive non-tuplet,
            // non-rest notes (≥3 so they never resemble a 2-note tie), on a seeded ~35% of runs.
            // Teaches "arc without a '3' ≠ triplet" — the tup3-precision fix. Within one measure,
            // so a barline crop never bisects a slur. Never touches the label (pixels only).
            if (slurRng && svg) {
              let run: StaveNote[] = [];
              const trySlur = () => {
                if (run.length >= 3 && slurRng() < 0.35) {
                  const maxLen = Math.min(5, run.length);
                  const len = 3 + Math.floor(slurRng() * (maxLen - 2)); // 3..maxLen
                  const start = Math.floor(slurRng() * (run.length - len + 1));
                  const grp = run.slice(start, start + len);
                  drawSlurArc(svg, grp, tupletAbove(grp));
                }
                run = [];
              };
              for (const n of notes) {
                if (inTuplet.has(n) || n.isRest()) trySlur();
                else run.push(n);
              }
              trySlur();
            }
            for (const [a, b] of ties) {
              new StaveTie({ firstNote: a, lastNote: b, firstIndexes: [0], lastIndexes: [0] })
                .setContext(ctx)
                .draw();
            }
            // Record each event's drawn x + row so the playhead can follow it. getAbsoluteX is
            // only valid after FormatAndDraw has positioned the notes.
            const lyricY = stave.getYForLine(4) + LYRIC_DY;
            notes.forEach((n, i) => {
              const slot = slots[i]!;
              positions.push({ startMs: tMs, endMs: tMs + slot.durationMs, x: n.getAbsoluteX(), top: barTop, height: barHeight });
              // The same walk records each note's clickable box for edit mode. VexFlow's own
              // bounding box covers notehead + stem + accidental; when it isn't available (the
              // try/catch in attachTitles shows some notes have no element) fall back to a small
              // box on the stave, which is still a usable click target.
              noteRects.push(noteBoxOf(n, slot.ev.index, barTop, barHeight));
              tMs += slot.durationMs;
              // Collect each note's lyric slot; the connectors (hyphens / melisma lines) need the
              // neighbours, so the actual drawing happens in one pass after the whole score is laid out.
              if (showLyrics) {
                const syl = slot.lyric?.trim() ?? "";
                const hold = syl === "" || syl === ".";
                lyricItems.push({ x: n.getAbsoluteX(), baseY: lyricY, row: r, text: hold ? "" : syl, hold, wordEnd: !!slot.ev.lyricWordEnd });
              }
            });
          }
          if (drawSig && svg) drawSignature(svg, stave, signature, sigStartX + 2);
          if (drawTime && svg && timeSig) drawTimeSignature(svg, stave, timeStartX + timeSigWidth / 2, timeSig);
        } catch (e) {
          console.warn(`sheet: failed to render measure ${cell.m.index}`, e);
        }
        collected.push({ index: cell.m.index, measure: cell.m, x, y, width: cell.width });
        x += cell.width;
      }
    });

    if (showLyrics && svg) drawLyrics(svg, lyricItems, lyricHyphens);

    // Rung-2 distractor text (render automation only): seeded fake header/footer strings inside
    // the SVG, positioned per staff row so the strip crops capture them. Labels are unaffected.
    if (textNoise && svg) {
      for (const it of buildTextNoise(textNoise.seed, rows.length, showLyrics)) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
        el.setAttribute("x", String(LEFT + it.fx * CONTENT_WIDTH));
        el.setAttribute("y", String(STAVE_TOP_PAD + it.row * ROW_HEIGHT + it.dy));
        el.setAttribute("font-size", String(it.size));
        el.setAttribute("font-family", it.serif ? "Georgia, 'Times New Roman', serif" : "Helvetica, Arial, sans-serif");
        if (it.italic) el.setAttribute("font-style", "italic");
        el.setAttribute("text-anchor", it.anchor);
        el.setAttribute("fill", "#000");
        el.textContent = it.text;
        svg.appendChild(el);
      }
    }

    // Last, so it catches BOTH VexFlow's inline accidentals and our own key-signature glyphs.
    if (thinSharps && svg) drawThinSharps(svg, STAFF_SPACE);

    setSvgHeight(height);
    setBoxes(collected);
    setNoteBoxes(noteRects);
    positionsRef.current = positions;
    onLayout?.({
      boxes: collected.map((b) => ({ index: b.index, x: b.x, y: b.y, width: b.width })),
      svgWidth: SVG_WIDTH,
      svgHeight: height,
      rowHeight: ROW_HEIGHT,
    });

    return () => {
      host.innerHTML = "";
    };
  }, [doc, accidentalMode, showLyrics, lyricHyphens, signature, signatureMap, timeSig, onLayout, repeatSpans, navMarks, textNoise, slurNoise, thinSharps, printNoise]);

  // Drive the playhead: while playing, each animation frame reads the audio clock, finds the
  // currently-sounding event, and moves the cursor bar onto it. We mutate the cursor's style
  // directly (via ref) rather than React state so 60fps updates don't re-render the component.
  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    if (!playing) {
      cursor.style.display = "none";
      return;
    }
    let raf = 0;
    const tick = () => {
      const pos = getPositionMs();
      const ps = positionsRef.current;
      if (pos != null && pos >= 0 && ps.length > 0) {
        // First event whose end is still ahead of the clock is the one sounding now.
        const active = ps.find((p) => pos < p.endMs) ?? ps[ps.length - 1]!;
        cursor.style.display = "block";
        cursor.style.height = `${active.height}px`;
        cursor.style.transform = `translate(${active.x - 2}px, ${active.top}px)`;
      } else {
        cursor.style.display = "none";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getPositionMs]);


  // Drag a note up and down to change its pitch (owner, 2026-08-07 — this replaces an earlier
  // scroll-wheel version, which fought the page's own scrolling and moved the note in jumps).
  //
  // Pointer events, not mouse events, so a trackpad, a mouse and a touchscreen all behave the
  // same. Three details carry the whole gesture:
  //  - `setPointerCapture` on pointerdown, so the drag keeps working once the pointer leaves the
  //    note's small box — which it does immediately, because the note moves out from under it;
  //  - steps are measured from where the pointer WENT DOWN, not from the previous event, so
  //    rounding cannot accumulate drift over a long drag;
  //  - `applied` remembers how far the note has already moved, and only the difference is sent,
  //    because `onNudgePitch` is relative.
  function onPitchDragStart(e: React.PointerEvent<HTMLDivElement>, index: number) {
    e.stopPropagation();
    e.preventDefault(); // no text selection, no native image drag
    onSelectNote?.(index);
    // A tool is armed: this click APPLIES it. Deliberately no drag — a click that both re-values a
    // note and nudges its pitch by whatever the pointer wobbled is not one edit, it is two.
    if (armed) {
      onApplyTool?.(index);
      return;
    }
    if (!onNudgePitch) return;
    dragRef.current = { index, startY: e.clientY, applied: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPitchDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || !onNudgePitch) return;
    // Down the screen is a lower pitch, so the sign flips.
    const want = -Math.round((e.clientY - d.startY) / DRAG_PX_PER_STEP);
    if (want === d.applied) return;
    onNudgePitch(d.index, want - d.applied);
    d.applied = want;
  }

  function onPitchDragEnd(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // Map a mouse event to the measure under it, by hit-testing against the recorded boxes. Used
  // for non-edit "click to play from here" (and its hover highlight). Coordinates are relative
  // to the positioned container, matching the SVG's own coordinate space.
  function measureAt(e: React.MouseEvent): MeasureBox | null {
    const cont = containerRef.current;
    if (!cont) return null;
    const rect = cont.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return (
      boxes.find(
        (b) => px >= b.x && px <= b.x + b.width && py >= b.y - 30 && py <= b.y - 30 + (ROW_HEIGHT - 16),
      ) ?? null
    );
  }

  return (
    // No frame of its own: this sits inside the score card (.kv-score), which supplies the paper,
    // the border and the horizontal scroll. A second border here would double-frame the sheet.
    <div>
      {/* Engraved-style header: the makam/form/usul/composer/tempo extracted from the score. */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px 4px",
          fontFamily: "var(--font-display)", color: "var(--ink)",
        }}
      >
        <div style={{ flex: "1 1 0", fontSize: 13, fontStyle: "italic", whiteSpace: "nowrap" }}>
          {header.usul} &nbsp;♩ = {headerBpm}
        </div>
        <div style={{ flex: "2 1 0", textAlign: "center", lineHeight: 1.3 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontStyle: "italic" }}>{header.makamForm}</div>
          {header.title && <div style={{ fontSize: 15, fontStyle: "italic" }}>{header.title}</div>}
        </div>
        <div style={{ flex: "1 1 0", fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>
          {header.composer && <>Beste: {header.composer}</>}
        </div>
      </div>
      <div
        ref={containerRef}
        // The deploy checks read state, never copy: edit mode and the selection are attributes.
        // The id matters — `#edit-toggle` also carries `data-edit-mode`, so a check that wants the
        // SHEET's state has to name this element rather than match the attribute alone.
        id="sheet-surface"
        data-edit-mode={editMode ? "on" : "off"}
        data-selected-note={editMode && selectedNote != null ? selectedNote : undefined}
        style={{ position: "relative", width: SVG_WIDTH, height: svgHeight, cursor: editMode ? "default" : "pointer" }}
        onClick={editMode ? undefined : (e) => { const m = measureAt(e); if (m) onSeekToMeasure(m.measure); }}
        onMouseMove={editMode ? undefined : (e) => setHover(measureAt(e)?.index ?? null)}
        onMouseLeave={editMode ? undefined : () => setHover(null)}
      >
        <div ref={hostRef} />
        {/* Step-2c: the selected strip's crop region (what a training PNG will capture). */}
        {highlightRect && (
          <div
            style={{
              position: "absolute",
              left: highlightRect.x,
              top: highlightRect.y,
              width: highlightRect.width,
              height: highlightRect.height,
              pointerEvents: "none",
              boxSizing: "border-box",
              border: "2px solid #f59e0b",
              background: "rgba(245,158,11,0.12)",
              borderRadius: 3,
            }}
          />
        )}
        {/* Non-edit hover highlight: shows which measure a click will play from. */}
        {!editMode &&
          hover != null &&
          (() => {
            const b = boxes.find((bx) => bx.index === hover);
            if (!b) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y - 30,
                  width: b.width,
                  height: ROW_HEIGHT - 16,
                  pointerEvents: "none",
                  boxSizing: "border-box",
                  borderRadius: 4,
                  background: "rgba(20,184,166,0.07)",
                  border: "1px solid rgba(20,184,166,0.5)",
                }}
              />
            );
          })()}
        {/* Playhead: a teal bar that tracks the currently-playing note (positioned via transform). */}
        <div
          ref={cursorRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 2.5,
            height: 0, // set per-row during playback (see the rAF loop)
            background: "#14b8a6",
            borderRadius: 2,
            boxShadow: "0 0 3px rgba(20,184,166,0.7)",
            pointerEvents: "none",
            display: "none",
            willChange: "transform",
          }}
        />
        {editMode && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} data-omr="edit-overlay">
            {/* Measure targets, underneath the note targets: a click that misses every note opens
                the measure modal, which is still the only way to insert a note or change a
                duration until the palette lands.
                ⚠ NO hover highlight here (owner, 2026-08-07). Editing is whole-score, so framing a
                measure says the wrong thing about what a click does — and it also cost a re-render
                per mouse-move across the sheet. The note boxes below carry the only hover state
                edit mode has. */}
            {boxes.map((b) => (
              <div
                key={b.index}
                onClick={() => { onSelectNote?.(null); onMeasureClick(b.measure); }}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y - 30,
                  width: b.width,
                  height: ROW_HEIGHT - 16,
                  pointerEvents: "auto",
                  cursor: "default",
                  boxSizing: "border-box",
                }}
              />
            ))}
            {/* Note targets. A tie-split event has two boxes sharing one evIndex; both highlight
                when it is selected, and either one selects it. */}
            {noteBoxes.map((nb, i) => {
              const on = selectedNote != null && nb.evIndex === selectedNote;
              return (
                <div
                  key={`${nb.evIndex}_${i}`}
                  className={`kv-note-hit${on ? " is-selected" : ""}${armed ? " is-armed" : ""}`}
                  data-omr-note={nb.evIndex}
                  data-selected={on ? "1" : undefined}
                  onPointerDown={(e) => onPitchDragStart(e, nb.evIndex)}
                  onPointerMove={onPitchDragMove}
                  onPointerUp={onPitchDragEnd}
                  onPointerCancel={onPitchDragEnd}
                  // The measure box underneath opens the modal; a click on a note must not.
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    left: nb.x - NOTE_HIT_PAD,
                    top: nb.y - NOTE_HIT_PAD,
                    width: nb.width + 2 * NOTE_HIT_PAD,
                    height: nb.height + 2 * NOTE_HIT_PAD,
                    pointerEvents: "auto",
                    cursor: armed ? "copy" : "grab",
                    touchAction: "none", // or the browser pans the page instead of dragging
                  }}
                />
              );
            })}
            {/* The ✕, on the FIRST box of the selected event (a tie-split has two) so a split
                note doesn't sprout two delete buttons. */}
            {(() => {
              if (selectedNote == null || !onDeleteNote) return null;
              const nb = noteBoxes.find((b) => b.evIndex === selectedNote);
              if (!nb) return null;
              return (
                <button
                  id="note-delete"
                  type="button"
                  title={TR.sheet.deleteNote}
                  aria-label={TR.sheet.deleteNote}
                  onClick={(e) => { e.stopPropagation(); onDeleteNote(selectedNote); }}
                  style={{
                    position: "absolute",
                    left: nb.x + nb.width + NOTE_HIT_PAD - 2,
                    top: nb.y - NOTE_HIT_PAD - 16,
                    width: 20,
                    height: 20,
                    lineHeight: "18px",
                    padding: 0,
                    pointerEvents: "auto",
                    cursor: "pointer",
                    borderRadius: "50%",
                    border: "1px solid #b91c1c",
                    background: "#fff",
                    color: "#b91c1c",
                    fontSize: 13,
                  }}
                >
                  ✕
                </button>
              );
            })()}
          </div>
        )}
      </div>

      <Legend used={usedAccidentals} />
    </div>
  );
}

function Legend({ used }: { used: number[] }) {
  if (used.length === 0) return null;
  return (
    <div
      style={{
        display: "flex", gap: 16, flexWrap: "wrap", padding: "var(--space-3) var(--space-2) 0",
        marginTop: "var(--space-3)", borderTop: "1px solid var(--rule)",
        color: "var(--ink-soft)", fontSize: "var(--text-sm)",
      }}
    >
      <span style={{ color: "var(--ink-faint)" }}>Değiştirme işaretleri:</span>
      {used.map((commas) => {
        const g = accidentalGlyph(commas);
        return (
          <span key={commas} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {g && <span className="kv-glyph" style={{ fontSize: 22 }}>{String.fromCodePoint(g.codepoint)}</span>}
            {accidentalLabel(commas)} ({commas > 0 ? `+${commas}` : commas} koma)
          </span>
        );
      })}
    </div>
  );
}
