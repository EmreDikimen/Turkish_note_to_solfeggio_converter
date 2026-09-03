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
  measureBeats,
  nudgePitch,
  parseNoteName,
  scoreHeader,
  toAeuAlter,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { repeatMarksAt, type RepeatSpan } from "../../../tools/render/repeats";
import { navMarksAt, type NavMark } from "../../../tools/render/navmarks";
import type { MarkTarget, SignTool, StructureMark } from "../../../tools/render/structure-edit";
import {
  closedTupletAt,
  drawnTupletAt,
  memberPositions,
  tieSplitBeats,
  tupletGroupsIn,
  tupletRunFrom,
  tupletEdgeTo,
  tupletWrittenBeats,
  type TupletGroup,
} from "../../../tools/render/rhythm";
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

// --- following the playhead (owner, 2026-09-03) -----------------------------
//
// While the piece plays, the cursor walks down a sheet that is taller than the window, so it
// leaves the screen and the reader has to chase it by hand. With `followPlayhead` on, the page
// goes to the cursor instead.
//
// ⚠ ONCE PER ROW, AND ONLY WHEN THE ROW IS OFF THE SCREEN (owner, 2026-09-03: *"sadece row
// değiştiğinde tetiklensin"*). The trigger is the cursor moving to a NEW staff row, not the clock:
// inside a row the page never moves, whatever the reader does with it, so nothing can shift under
// a pointer mid-bar and a reader who scrolls away to look at something else is left alone until the
// music turns the corner. It also costs nothing — one box read per row instead of one per frame,
// and no cooldown, because a scroll that is asked for once cannot restart its own animation.
// ⚠ Consequence, and it is deliberate: on a window too narrow for the sheet the SIDEWAYS follow
// also fires only at a row change, so a cursor crossing a wide row leaves the box until then.
const FOLLOW_MARGIN = 32; // px of the window's edge that counts as already "off the page"
const FOLLOW_AIM = 0.35; // after a scroll the cursor's row sits this far down the window
// How much hidden width a sideways scroller must have before this axis is followed at all. On a
// wide window the 1020 px sheet overruns `.kv-score`'s content box by about 2 px — absorbed by its
// own padding, invisible to anyone — and yet a cursor near the end of a row reads as past the right
// margin, so the sheet would twitch sideways in the middle of playback for no reader's benefit.
// Below this the box counts as fitting; above it (a narrow window, a phone) the cursor really can
// be off to the right, which is the case this axis exists for.
const FOLLOW_SIDE_MIN = 48;
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
function buildStaveNotes(
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
      // noteToLily (tools/render/lilypond.ts), applied here too or the page would show a sign the
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
 * The printed triplet mark, in STAFF SPACES — MEASURED on real editions, not designed.
 *
 * `scripts/rung3/tuplet_mark_probe.py` read 16 marks across ~11 Turkish editions (`strips_tup` and
 * `strips_exam_v2_clean`, tiles accepted by eye at matched staff size). **All 16 break the arc and set
 * the "3" inside the gap.** Until 2026-08-12 we drew one unbroken quadratic with the digit floating
 * 1.27 S OUTSIDE it, which left a triplet separated from a plain phrase slur (`drawSlurArc`) by a
 * hovering digit — the weakest cue available, where real print differs structurally. `\tup3` recall
 * had fallen to 83.8%, below its own pre-slur-distractor baseline; this is the leading hypothesis
 * for that, same shape as the Bravura sharp-bar defect. Numbers and the caveats:
 * docs/METRICS-DIAGNOSTICS.md.
 *
 * ⚠ `gap` is sized to the DIGIT, not to the group: real print holds 1.63 S whether the mark spans
 * 4.5 S or 28 S. A fraction-of-span rule is the natural guess and it is wrong.
 * ⚠ `stroke` stays at `drawSlurArc`'s weight even though real print draws both HEAVIER (0.133–0.168 S
 * vs our 0.100). Thickening only this one would hand the model a thickness cue separating a triplet
 * from a slur that real pages do not have — the trap `AEU_SHARP_STROKE` documents. Owed as a joint
 * change with the slur. The shape A/B has now run (2026-08-15) and came back null, so the stroke is
 * still owed and still joint — see docs/rung3/round3-criteria.md and docs/rung3/tuplets.md step 5.
 */
const TUPLET_MARK = {
  gap: 1.63,       // S — arc-end to arc-end, the hole the digit sits in (real: 1.55–1.69, n=16)
  digitH: 1.2,     // S — digit height (real 1.20, ours was 0.97)
  // S — digit centre just INSIDE the arc ends, toward the staff. The probe's +0.20 is measured from
  // the stroke's TOP ink row; `yGap` below is its centreline, so the constant carries that offset.
  digitDrop: 0.07,
  clear: 0.85,     // S — how far an arm's OUTER end clears its OWN end note (real 0.60–0.93, n=7 arms)
  rise: 0.58,      // S — how much further the gap sits above the group's outermost note: clear+rise
                   //     = 1.43 S over the highest notehead, measured on 3 marks of one real page
  minSeg: 0.5,     // S — shortest arm worth drawing; a group too narrow for the gap widens OUTWARD
                   //     rather than closing it
  stroke: 0.11,    // S — deliberately equal to drawSlurArc's; see the warning above
};

/**
 * The THIRD printed shape: a CONTINUOUS arc with the "3" hanging INSIDE its concavity — between the
 * curve and the noteheads — rather than in a break or floating above the apex.
 *
 * ⚠ This refutes the sentence `TUPLET_MARK` above is built on. "All 16 break the arc" is still true
 * of the two pools that probe sampled; it is NOT true of Turkish print in general. The owner supplied
 * two real scanned editions drawing it this way (2026-08-19, `data/real/tuplet_marks/`), and the
 * probe could not have found them because **no labelled real strip we own carries this style**.
 *
 * Measured with `tuplet_mark_probe.py --images --accept`, n=5 marks on the Kemânî Sebuh page (the
 * second page confirms the style by eye but its staff detection is unstable at 12.6–14.8 px, so it
 * is not measured). The load-bearing number is the LAST one:
 *
 *   * digit and arc are SEPARATE ink in 5 of 5. Our legacy mark was one connected component — "a
 *     slur with a bump" — which is exactly what made it indistinguishable from a phrase slur. This
 *     style keeps the two apart, so it is a real second cue rather than a variant of the old defect.
 *
 * ⚠ `share` is CHOSEN, NOT MEASURED — like `STACCATO_RATE`. Nobody has counted how often Turkish
 * editions use this shape against the broken one; two pages is an existence proof, not a frequency.
 * Replace it by reading marks across editions with the probe, not by taste.
 */
const TUPLET_MARK_CONCAVE = {
  arcAbove: 0.91,  // S — the arc's underside down to the digit's TOP (real 0.57–1.00, n=3 clean marks)
  digitH: 1.22,    // S — digit height (real 1.13–1.26, n=5). Taller than the broken style's 1.20
  digitW: 0.83,    // S — recorded for the probe to check a pilot render against (real 0.83–0.91)
  digitAt: 0.5,    // fraction of the span — real 0.40–0.56, n=5, i.e. centred within the spread
  digitClear: 0.25, // S — digit's bottom to the outermost notehead. ⚠ DERIVED, not measured: it is
                   //     what stops the digit colliding with the notes, and the apex follows from it
  clear: 0.85,     // S — an end of the arc over its OWN end note; same rule as the broken mark
  stroke: 0.11,    // S — the SAME as drawSlurArc and drawTupletArc. Real print draws this one
                   //     heavier (0.174–0.217 S here) but thickening only the tuplet arc invents a
                   //     thickness cue against phrase slurs; owed jointly with drawSlurArc, as before
  share: 0.25,     // of CURVED-style pieces (see the ⚠ above — chosen, not measured)
};

/**
 * Draw the CURVED tuplet mark as raw SVG, like the voltas/nav marks: two arc segments with the "3"
 * set in the gap between them, to the measurements in `TUPLET_MARK`. This is the shape printed
 * Turkish scores use (VexFlow's `Tuplet` only draws the square bracket, which stays as the minority
 * per-piece style — and which, note, already breaks around its digit).
 *
 * **THE ARMS FOLLOW THE NOTES** (owner, 2026-08-12, looking at the redraw beside real pages;
 * measured on `strips_tup/ben_guzele_…_p2_s01_w03.png`, four descending triplets in one strip). A
 * printed mark is NOT a fixed shape floating at one height: **each arm's outer end clears its OWN end
 * note** (0.60–0.93 S over that notehead), while the gap sits 1.43 S above the group's HIGHEST note.
 * So a descending triplet gets a nearly flat left arm and a long sweeping right one — the mark tilts
 * with the contour, which is how a reader sees which notes it covers.
 *
 * ⚠ The digit stays at the **middle of the span**, and that is measured, not assumed: on that page it
 * sits at 0.49–0.50 of the mark's width even on descending figures. Sliding the gap toward the high
 * note (tried first, 2026-08-12) looks right in a screenshot and is wrong — it degenerates into a stub
 * arm whenever the highest note is an outer one. The visual asymmetry of a printed mark comes from the
 * arms' SLOPES, not from where the "3" sits.
 */
function drawTupletArc(svg: SVGElement, group: StaveNote[], above: boolean) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const S = STAFF_SPACE;
  const sign = above ? -1 : 1; // -1 = the mark is above the noteheads, so "outward" is up
  // Per note: its x and the notehead edge the mark sits beyond. `getYs` is the noteheads, which IS
  // the outer ink on the mark's side — the sign chooses which end of a chord to clear.
  const notes = group
    .map((n) => {
      let ys: number[] = [];
      try {
        ys = n.getYs();
      } catch {
        ys = [];
      }
      return { x: n.getAbsoluteX(), edge: ys.length ? (above ? Math.min(...ys) : Math.max(...ys)) : NaN };
    })
    .filter((p) => Number.isFinite(p.edge))
    .sort((a, b) => a.x - b.x);
  if (notes.length === 0) return;
  const first = notes[0]!;
  const last = notes[notes.length - 1]!;
  const x1 = first.x - 2;
  const x2 = last.x + 12;
  // The gap's HEIGHT comes from the group's outermost note, so the mark clears every notehead under
  // it; its horizontal position is simply the middle of the span (see the ⚠ above).
  const peak = above ? Math.min(...notes.map((p) => p.edge)) : Math.max(...notes.map((p) => p.edge));
  const yGap = peak + sign * (TUPLET_MARK.clear + TUPLET_MARK.rise) * S;

  const half = (TUPLET_MARK.gap * S) / 2;
  const minSeg = TUPLET_MARK.minSeg * S;
  // A group too narrow for a full-width gap widens the mark OUTWARD — never narrows the gap, or the
  // digit fuses with the arc ends after the encoder's shrink (the sharp-bar failure mode).
  const ax1 = Math.min(x1, (x1 + x2) / 2 - half - minSeg);
  const ax2 = Math.max(x2, (x1 + x2) / 2 + half + minSeg);
  const gapX = (ax1 + ax2) / 2;
  // Each arm: quadratic from its own note's clearance point up to the gap, control point at the gap's
  // HEIGHT so the curve arrives horizontally there and does its bending at the outer end.
  for (const [from, yFrom, to] of [
    [ax1, first.edge + sign * TUPLET_MARK.clear * S, gapX - half],
    [ax2, last.edge + sign * TUPLET_MARK.clear * S, gapX + half],
  ] as const) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M ${from} ${yFrom} Q ${from + 0.55 * (to - from)} ${yGap} ${to} ${yGap}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#222");
    path.setAttribute("stroke-width", String(TUPLET_MARK.stroke * S));
    svg.appendChild(path);
  }
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(gapX));
  // `y` is the baseline: put the digit's CENTRE `digitDrop` inside the gap, then drop half a digit.
  const centre = yGap - sign * TUPLET_MARK.digitDrop * S;
  text.setAttribute("y", String(centre + (TUPLET_MARK.digitH * S) / 2));
  text.setAttribute("text-anchor", "middle");
  // ⚠ UPRIGHT Times at REGULAR weight, not the bold italic Georgia this used to be. Two reasons, and
  // neither is taste: an italic Georgia "3" (an old-style figure) measured 1.10 S wide where real
  // print draws 0.76, which left 0.26 S of air each side instead of 0.43 — the digit would fuse with
  // the arc ends after the encoder's shrink, the failure mode the sharp bars already cost us once —
  // and the printed digit is a REGULAR-weight serif (owner, 2026-08-12, against real pages; bold was
  // this renderer's invention). Sized so the ink measures TUPLET_MARK.digitH; verify with
  // tuplet_mark_probe.py --dir on a pilot render.
  text.setAttribute("font-family", "'Times New Roman', Georgia, serif");
  text.setAttribute("font-size", "16");
  text.setAttribute("fill", "#222");
  text.textContent = "3";
  svg.appendChild(text);
}

/**
 * The concave style: ONE continuous arc with the "3" hanging inside it, to `TUPLET_MARK_CONCAVE`.
 *
 * ⚠ It is NOT `drawTupletArcLegacy` with the digit moved. The legacy mark's digit touched the apex,
 * making arc+digit one connected component; here they are deliberately separate ink, which is what
 * the real pages measure (5 of 5) and the only reason this shape is worth drawing at all.
 *
 * The arms follow the notes exactly as `drawTupletArc`'s do — each end clears its OWN end note — so
 * the two styles differ in the mark's topology and nothing else. The apex is DERIVED from the digit
 * it has to hold (`arcAbove + digitH + digitClear` above the outermost notehead), never given as a
 * constant, so changing the digit cannot silently push it into the noteheads.
 */
function drawTupletArcConcave(svg: SVGElement, group: StaveNote[], above: boolean) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const S = STAFF_SPACE;
  const M = TUPLET_MARK_CONCAVE;
  const sign = above ? -1 : 1; // -1 = mark above the noteheads, so "outward" is up
  const notes = group
    .map((n) => {
      let ys: number[] = [];
      try {
        ys = n.getYs();
      } catch {
        ys = [];
      }
      return { x: n.getAbsoluteX(), edge: ys.length ? (above ? Math.min(...ys) : Math.max(...ys)) : NaN };
    })
    .filter((p) => Number.isFinite(p.edge))
    .sort((a, b) => a.x - b.x);
  if (notes.length === 0) return;
  const first = notes[0]!;
  const last = notes[notes.length - 1]!;
  const x1 = first.x - 2;
  const x2 = last.x + 12;
  const peak = above ? Math.min(...notes.map((p) => p.edge)) : Math.max(...notes.map((p) => p.edge));
  // The apex has to hold the whole digit plus its clearance over the outermost notehead.
  const yApex = peak + sign * (M.arcAbove + M.digitH + M.digitClear) * S;
  const y1 = first.edge + sign * M.clear * S;
  const y2 = last.edge + sign * M.clear * S;
  // One quadratic. With the control point at mid-span the curve's t=0.5 point is (y1 + 2yc + y2)/4,
  // so solving for yc puts the apex exactly at yApex — and x is then linear in t, which is what lets
  // the digit be placed at `digitAt` of the span without solving the Bezier.
  const yc = (4 * yApex - y1 - y2) / 2;
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${yc} ${x2} ${y2}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#222");
  path.setAttribute("stroke-width", String(M.stroke * S));
  svg.appendChild(path);

  const t = M.digitAt;
  const xd = x1 + t * (x2 - x1);
  const yArc = (1 - t) * (1 - t) * y1 + 2 * t * (1 - t) * yc + t * t * y2;
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(xd));
  // `y` is the baseline. Above: the digit hangs BELOW the arc, so its top is arcAbove under the
  // curve and the baseline a further digitH down. Below: mirrored, the digit sits over the arc.
  const top = yArc - sign * M.arcAbove * S;
  text.setAttribute("y", String(above ? top + M.digitH * S : top));
  text.setAttribute("text-anchor", "middle");
  // ⚠ ITALIC here, unlike drawTupletArc's upright Times — and that is measured, not a preference.
  // The upright form was chosen for the BROKEN mark because an italic digit at 1.10 S wide ate the
  // clearance inside a 1.63 S gap. This style has no gap to fuse across: the digit hangs in open
  // space under the curve, real print draws it slanted, and it measures 0.83 S wide there.
  text.setAttribute("font-family", "'Times New Roman', Georgia, serif");
  text.setAttribute("font-size", "16");
  text.setAttribute("font-style", "italic");
  text.setAttribute("fill", "#222");
  text.textContent = "3";
  svg.appendChild(text);
}

/**
 * The mark as it was drawn until 2026-08-12 — ONE unbroken quadratic with a bold italic "3"
 * floating above its apex. It exists for exactly one reason: it is the **control arm** of the
 * tuplet A/B pre-registered in docs/rung3/round3-criteria.md, reached only through
 * `render.ts --legacy-tuplet-mark` (URL `?legacytuplet=1`). The app itself always draws the
 * measured shape above.
 *
 * ⚠ Do not "fix" or tidy this function. It is a frozen copy of what `strips_v4` was rendered with,
 * and any change to it silently changes what the A/B is comparing against. Delete it once the A/B
 * has been read and written up.
 */
function drawTupletArcLegacy(svg: SVGElement, group: StaveNote[], above: boolean) {
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

/** How often a bar that HAS internal usul groups gets its dotted lines drawn. CHOSEN, NOT
 *  MEASURED, exactly like STACCATO_RATE and the slur distractor's 0.35 — nobody has counted how
 *  often real Turkish editions rule them, and BACKLOG item 5 says the 7.8% on record is a statistic
 *  about the MODEL'S GUESSES, not about print. Coined per PIECE (not per bar): an edition either
 *  uses the convention or it does not, and a page that rules some bars and not others is not a
 *  page any engraver produced. */
const USUL_BAR_RATE = 0.35;

/** Dash pattern of the usul barline, in staff spaces (dash, gap). A ruled usul line is drawn much
 *  lighter than a real barline — it is a reading aid, not a division of the music. */
const USUL_BAR_DASH = [0.22, 0.30] as const;

/**
 * Draw the DOTTED (usul) BARLINE — a light dashed vertical rule inside a measure, on the usul's
 * own beat-group boundaries.
 *
 * WHY. Turkish editions rule these to show the usul's subdivisions (aksak 9/8 = 2+2+2+3, so the
 * bar carries three internal rules). The renderer has never drawn one — 0 of 40,826 strips — and
 * `ADDED_TOKENS` has no name for one, so the nearest thing the model knows is a vertical line with
 * DOTS beside it: a repeat sign. It duly emits `\repstart`, and the owner has been deleting those
 * by hand while labelling — ~1 in 5 of `batch3`'s corrections is exactly that (docs/BACKLOG.md
 * item 5, docs/METRICS-UNSEEN.md).
 *
 * ⭐ This is the same SHAPE of change as the staccato distractor, and that now means something
 * measured rather than argued: a HOLE in what the model has been shown responds to being filled
 * (72.7% → 0.0%), while a domain gap does not (three nulls). Both are symbols it has never seen.
 *
 * ⚠ LABEL-FREE, and that is a decision, not an oversight. Naming it would make every real gold
 * label silently wrong, because no pool on disk annotates one; drawn without a label it is
 * consistent with everything we own and costs ZERO new labelling. The `\dottedbar` token is a
 * Round-4 question (docs/DECISIONS.md).
 *
 * Raw SVG rather than a VexFlow `StaveLine`/`Barline` for the same reason `drawStaccatoDot` and
 * `drawSlurArc` are: a VexFlow modifier feeds `StaveNote.getBoundingBox()`, the merge that once
 * stretched a graced note's click box across the whole score (see `noteBoxOf`). Appending to the
 * SVG leaves every note box untouched.
 *
 * Pixels only: `buildStrips` serializes from the document, so the labels are byte-identical with
 * and without it — which is what `verify-labels.ts` re-checks.
 */
function drawUsulBars(
  svg: SVGSVGElement,
  stave: Stave,
  notes: StaveNote[],
  onsets: number[],
  boundaries: number[],
): void {
  const top = stave.getYForLine(0);
  const bottom = stave.getYForLine(4);
  const space = (bottom - top) / 4;
  // A boundary must land ON a note's onset. Syncopation across a group boundary does happen, but
  // then there is no gap to rule into and an engraver ties or omits the line; guessing an x inside
  // a note would draw ink through a notehead.
  const eps = 1e-6;
  for (const at of boundaries) {
    const i = onsets.findIndex((o) => Math.abs(o - at) < eps);
    if (i <= 0 || i >= notes.length) continue;
    const prev = notes[i - 1]!, cur = notes[i]!;
    let x0: number, x1: number;
    try {
      x0 = prev.getAbsoluteX();
      x1 = cur.getAbsoluteX();
    } catch {
      continue;
    }
    if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) continue;
    // Biased toward the following note, which is where print puts it — the rule belongs to the
    // group it opens. ⚠ Chosen BY EYE on a pilot render, like STACCATO_RADIUS; not a measurement.
    const x = x0 + (x1 - x0) * 0.62;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x));
    line.setAttribute("x2", String(x));
    line.setAttribute("y1", String(top));
    line.setAttribute("y2", String(bottom));
    line.setAttribute("stroke", "#000");
    line.setAttribute("stroke-width", String(space * 0.11));
    line.setAttribute("stroke-dasharray", USUL_BAR_DASH.map((d) => d * space).join(" "));
    svg.appendChild(line);
  }
}

/** Staccato dot radius, in STAFF SPACES. It must LOOK like Bravura's augmentation dot — the whole
 *  experiment rests on the two marks being the same ink in different PLACES, so if one reads as
 *  bigger the model can separate them by size instead of by position and learns nothing. Checked by
 *  eye on the pilot render, not asserted. Vertical placement is not a constant: see the space-centre
 *  rule in drawStaccatoDot. */
const STACCATO_RADIUS = 0.15;

/** How often a staccato is drawn. CHOSEN, NOT MEASURED — like the slur distractor's 0.35, which is
 *  the precedent this follows. `dotted` is the rate on notes that ALREADY carry an augmentation
 *  dot and is deliberately the higher of the two: those are the strips that isolate position from
 *  everything else, so the corpus should be rich in them even though real print is not. Nobody has
 *  counted staccato frequency in real Turkish editions; doing so is the way to replace these. */
const STACCATO_RATE = { dotted: 0.3, run: 0.18 } as const;

/**
 * Draw a STACCATO dot — a filled dot on the notehead side, opposite the stem — as raw SVG.
 *
 * WHY. The corpus has never contained one: 0 of 40,826 strips carry an articulation, and
 * `ADDED_TOKENS` has no name for one either (the augmentation dot is not a token, it is a suffix
 * inside the duration — `8` vs `8.`). So every dot the model has ever seen meant *longer*, and it
 * reads a printed staccato as an augmentation dot, lengthening notes that were never long (owner,
 * 2026-08-15).
 *
 * What this teaches is POSITIONAL, and that is the whole design: an augmentation dot is a suffix
 * beside the notehead, on its line or space (VexFlow's `Dot`, via `Dot.buildAndAttach` above); a
 * staccato sits above or below it. Drawn on the wrong side this distractor teaches the confusion
 * instead of curing it.
 *
 * Raw SVG rather than VexFlow's `Articulation` on purpose. A modifier feeds
 * `StaveNote.getBoundingBox()`, the merge that once stretched a graced note's click box across the
 * whole score (see `noteBoxOf`) — appending to the SVG keeps every note box untouched. It is also
 * what `drawSlurArc` does, and this is that same idea for a different mark: label-free ink that
 * teaches what a symbol is NOT.
 *
 * Pixels only: a staccato is never a label token, and buildStrips serializes from the doc, so the
 * labels stay identical with and without it.
 */
function drawStaccatoDot(svg: SVGSVGElement, note: StaveNote): void {
  const SVG_NS = "http://www.w3.org/2000/svg";
  let yTop: number;
  let yBottom: number;
  let nonDisplacedX: number | undefined;
  let displacedX: number | undefined;
  let width: number;
  let stemUp: boolean;
  let stave: Stave;
  try {
    ({ yTop, yBottom, nonDisplacedX, displacedX } = note.getNoteHeadBounds());
    width = note.getGlyphWidth();
    stemUp = note.getStemDirection() >= 0;
    stave = note.checkStave();
  } catch {
    return;
  }
  if (!Number.isFinite(yTop) || !Number.isFinite(yBottom) || !Number.isFinite(width) || width <= 0) return;
  const space = stave.getSpacingBetweenLines();
  const yTopLine = stave.getYForLine(0);
  if (!Number.isFinite(space) || space <= 0 || !Number.isFinite(yTopLine)) return;

  // ⚠ `yTop`/`yBottom` are NOT the ink's edges — VexFlow builds them from `notehead.getY()`, the
  // notehead's ANCHOR, so on a single-notehead note they are both simply its CENTRE. Two drafts
  // were rejected by eye on the pilot for missing that, and the failure is worth keeping: treating
  // the anchor as an edge measures every clearance from half a notehead too close, and the dots
  // came out fused to the noteheads.
  //
  // So: the notehead spans centre ± ~0.5 spaces. Step outward from its far side by the dot's own
  // radius plus a margin, then land on the first SPACE CENTRE beyond that — never on a staff line,
  // where a 0.3-space dot simply disappears into the line.
  const centre = (yTop + yBottom) / 2;
  const dir = stemUp ? 1 : -1;
  const clearance = 0.5 + STACCATO_RADIUS + 0.1; // half a notehead, the dot's radius, a margin
  const t0 = (centre - yTopLine) / space + dir * clearance;
  const slot = stemUp ? Math.ceil(t0 - 0.5) + 0.5 : Math.floor(t0 - 0.5) + 0.5;
  // Notes IN a space get the neighbouring space, the textbook placement. Notes ON a line get the
  // one beyond it, because the adjacent space centre is exactly where an on-line notehead's ink
  // already reaches — that collision is geometry, not tuning, and no clearance value avoids it.
  // Looser than a fastidious engraver would set, and the right trade here: an ambiguous mark
  // teaches nothing, a clearly detached one IS the lesson — this dot is not beside the notehead.

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", String((nonDisplacedX ?? displacedX ?? note.getAbsoluteX()) + width / 2));
  dot.setAttribute("cy", String(yTopLine + slot * space));
  dot.setAttribute("r", String(STACCATO_RADIUS * space));
  dot.setAttribute("fill", "#000");
  dot.setAttribute("data-omr", "staccato"); // inspection only (an attribute, not pixels)
  svg.appendChild(dot);
}

// Volta bracket height above the top staff line: close to the row (clear of most beams) and well
// inside the strip-crop window (which starts ~46px above the top line).
const VOLTA_ABOVE = 26;

/** Delete-target geometry for the structure signs. A repeat barline's target is NARROW on purpose:
 *  it straddles the barline, where no notehead sits, so what it takes from a note target is stem
 *  and beam. The nav marks' boxes sit entirely above the top staff line, where the glyphs are
 *  drawn — they overlap nothing. */
const SIGN_HIT_W = 16;
const SIGN_HIT_PAD = 6;
const NAV_HIT_W = 30;
const NAV_HIT_H = 22;
/** The strip at a bar's right edge the off-meter badge owns (`.kv-bar-warn`, 16px + its offset). */
const BAR_WARN_W = 24;

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
  /** y of this row's TOP staff line — the origin the insert tool reads a pitch from. Not the same
   *  as `y`, which is the stave's bounding-box top and sits well above the first line. */
  topLineY: number;
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

/**
 * The box of one drawn triplet mark's INK, for its click target.
 *
 * ⚠ **`getBBox()` on the wrapping group is NOT the ink, and using it produced a target four times
 * too tall** (measured 2026-08-30 on a bracket-style page): a group's box is the union of its
 * children's, and two children lie about theirs.
 *
 *  - **A `<text>` reports its FONT's em box, not its glyph.** The bracket's "3" measured
 *    **12 × 160 px** — 12 px of digit inside the em box of a music font whose ascent and descent
 *    are enormous. The digit always sits in the mark's own gap, between the strokes, so the strokes
 *    already bound it: text children are skipped rather than measured.
 *  - **VexFlow emits a zero-height `<rect>` at the SVG ORIGIN inside its tuplet group** (0,0,95,0).
 *    Any box reaching x ≤ 0 or y ≤ 0 is rejected, the same rule and the same reason as `noteBoxOf`
 *    above: a drawn mark is never at the origin, so only an unpositioned element can claim to be.
 *
 * Falls back to the group's own box when nothing survives — a loose target beats no target, and the
 * caller has no other way to find the mark.
 */
function markBoxOf(el: SVGGraphicsElement): { x: number; y: number; width: number; height: number } | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const kid of Array.from(el.querySelectorAll<SVGGraphicsElement>("path, rect, line, polygon, polyline"))) {
    let b: DOMRect;
    try {
      b = kid.getBBox();
    } catch {
      continue;
    }
    if (b.width <= 0 && b.height <= 0) continue;
    if (b.x <= 0 || b.y <= 0) continue; // unpositioned — see the note above
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.width);
    y2 = Math.max(y2, b.y + b.height);
  }
  if (x1 < x2 && y1 < y2) return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  try {
    const b = el.getBBox();
    return b.width > 0 ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
  } catch {
    return null;
  }
}

/**
 * One drawn triplet mark — the arc-and-"3" (or VexFlow bracket) over a group — as a click target.
 *
 * ⚠ It names the group by its FIRST MEMBER's `NoteEvent.index`, not by anything about the mark:
 * nothing about a tuplet is stored, so the mark is only ever a handle onto three ordinary notes.
 * Only groups `closedTupletAt` accepts get one — an unclosed run's bracket is the flag that the
 * MODEL misread something, and holding it could not mean anything.
 */
interface TupletMarkBox {
  evIndex: number;
  /** True for a real three-member triplet; false for a mark the arithmetic never closed — the
   *  model's misread, which the sheet flags and the editor can repair or clear. */
  closes: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fallback half-width for a note whose bounding box VexFlow won't give us. */
const NOTE_FALLBACK_W = 14;
/** Slack around a note's box so a click near the notehead still lands on it. */
const NOTE_HIT_PAD = 3;
/** Slack around a drawn triplet mark so the "3" is comfortable to hit — the arc itself is a hairline
 *  and the digit is small, so the ink's own box is a poor target. */
const MARK_HIT_PAD = 5;
/** Width of a held triplet's drag handle. Wide enough to grab without covering the note beside it
 *  — the handles sit OUTSIDE the group's frame, so a fat one would sit on the neighbour a drag is
 *  aiming at. */
const TUPLET_HANDLE_W = 8;
/** Vertical drag (px) that moves a note one diatonic step — half a staff space, i.e. the real
 *  distance between a line and the space above it, so the note tracks the pointer. */
const DRAG_PX_PER_STEP = STAFF_SPACE / 2;

/** The pitch of the TOP staff line in treble clef — the origin every insert height is measured
 *  from. VexFlow's `getYForLine(0)` is this line, and each further diatonic step down is
 *  {@link DRAG_PX_PER_STEP} px lower. */
const TOP_LINE_PITCH = { letter: "F", octave: 5, alter: 0 } as const;
/** How far above the top line / below the bottom line an insert may be aimed, in diatonic steps —
 *  three ledger lines each way. The measure's click band is taller than that, and a click in its
 *  far corner should land on a readable note rather than four octaves out. (Line 0 is step 0 and
 *  line 4 is step 8, so the staff itself is 0..8.) */
const INSERT_STEP_RANGE = { min: -6, max: 14 };
/** The ghost notehead's size, in SVG units — one staff space tall and a little wider, which is
 *  roughly a real notehead. ⚠ It is a plain oval, NOT a Bravura glyph: nothing inside `.kv-score`
 *  may set a font (CLAUDE.md), because the renderer crops training strips out of that container. */
const GHOST_W = 12;
const GHOST_H = 9;

/**
 * Which staff position a click at height `y` is aiming at, as a spelling — the insert tool's
 * pitch-from-height. `alter` comes from the drawn key signature, so a note inserted on Si under a
 * koma-bemol-Si signature is born koma-flat and the engraver prints nothing on it: the note looks
 * exactly like the place that was clicked. The palette's accidental tool changes it afterwards.
 */
function pitchAtHeight(y: number, topLineY: number, signatureMap: Map<string, number>) {
  const raw = Math.round((y - topLineY) / DRAG_PX_PER_STEP);
  const steps = Math.max(INSERT_STEP_RANGE.min, Math.min(INSERT_STEP_RANGE.max, raw));
  const at = nudgePitch(TOP_LINE_PITCH, -steps); // down the screen is a lower pitch
  return { letter: at.letter, octave: at.octave, alter: signatureMap.get(at.letter) ?? 0, steps };
}

/**
 * The note's OWN ink — noteheads plus stem, and nothing a modifier claims.
 *
 * Built from public accessors that report real, positioned geometry, so it is immune to the
 * modifier-merge bug documented on `noteBoxOf`. Returns null when VexFlow has not formatted the note
 * far enough to answer (a rest has no stem, an unformatted note has no heads).
 */
function inkBoxOf(n: StaveNote, evIndex: number): NoteBox | null {
  try {
    const { yTop, yBottom } = n.getNoteHeadBounds();
    if (!Number.isFinite(yTop) || !Number.isFinite(yBottom)) return null;
    let top = yTop;
    let bottom = yBottom;
    if (!n.isRest() && n.hasStem()) {
      const { topY, baseY } = n.getStemExtents();
      if (Number.isFinite(topY) && Number.isFinite(baseY)) {
        top = Math.min(top, topY, baseY);
        bottom = Math.max(bottom, topY, baseY);
      }
    }
    const width = n.getGlyphWidth();
    if (!Number.isFinite(width) || width <= 0) return null;
    return { evIndex, x: n.getAbsoluteX(), y: top, width, height: bottom - top };
  } catch {
    return null;
  }
}

/**
 * The clickable box of one drawn note, in the SVG's coordinate space (which is the overlay's too
 * — the container is never transformed; see the .kv-score rule in CLAUDE.md).
 *
 * ⚠ **VexFlow's own box cannot be trusted on a note that carries a grace group.**
 * `StaveNote.getBoundingBox()` is a MERGE over the note's modifiers, and `GraceNoteGroup` never
 * overrides `Element.getBoundingBox()` — which reads `this.x`/`this.y`, still **0** because the group
 * positions its inner notes and never itself. Merging a box at the SVG origin stretches the note's
 * box from the top-left of the score all the way to the note: measured on `beyati-delisin.json`,
 * 14 boxes (exactly its 14 grace notes) up to **949×1805 px**, each one starting at (0,0).
 *
 * Owner-reported 2026-08-08 as "one giant note I have to delete before I can edit", and that is
 * what it looks like: the box is a click target AND the tinted selection overlay, so the topmost
 * such box swallows every click over a third of the page. Nothing was wrong with the score — the
 * notes people deleted to escape it were real.
 *
 * So a box that reaches the origin is rejected in favour of the note's own ink. The test needs no
 * tuning and encodes the mechanism exactly: a drawn note is never at x ≤ 0 (the clef is left of it)
 * nor y ≤ 0 (the title is above it), so only an unpositioned modifier can put it there. If VexFlow
 * ever fixes `GraceNoteGroup`, this simply stops firing.
 */
function noteBoxOf(n: StaveNote, evIndex: number, barTop: number, barHeight: number): NoteBox {
  try {
    const bb = n.getBoundingBox();
    const reachesOrigin = bb && (bb.getX() <= 0 || bb.getY() <= 0);
    if (bb && Number.isFinite(bb.getW()) && bb.getW() > 0 && !reachesOrigin) {
      return { evIndex, x: bb.getX(), y: bb.getY(), width: bb.getW(), height: bb.getH() };
    }
    const ink = inkBoxOf(n, evIndex);
    if (ink) return ink;
  } catch {
    // fall through to the stave-height fallback below
  }
  return { evIndex, x: n.getAbsoluteX() - NOTE_FALLBACK_W / 2, y: barTop, width: NOTE_FALLBACK_W, height: barHeight };
}

/** Where a single timed event sits on screen, so the playhead can follow playback. */
interface NotePos {
  startMs: number;
  endMs: number;
  /** Which event is drawn here (`NoteEvent.index`) — the link a folded score needs, where the
   *  clock runs over a performance the page does not write out in order. */
  evIndex: number;
  /** Left x of the note within the SVG (same coordinate space as the overlay). */
  x: number;
  /** Top y of the playhead bar for this note's row (just above the top staff line). */
  top: number;
  /** Height of the playhead bar (staff height plus a small margin each side). */
  height: number;
}

/**
 * One sounding event of the PERFORMANCE, pointing at the written note that is drawn for it.
 *
 * A folded score writes a repeated bar once and plays it twice, so the drawn order is no longer
 * the playing order and the playhead cannot simply walk the notes it drew. The player hands over
 * this list instead — the clock's own order — and each step names the drawn note to sit on. The
 * cursor jumping back to the `‖:` is nothing more than two steps naming the same note.
 */
export interface PlayStep {
  /** `NoteEvent.index` in the WRITTEN document — the one this view drew. */
  evIndex: number;
  startMs: number;
  endMs: number;
}

/**
 * The nearest ancestor that can actually scroll SIDEWAYS, or null when nothing can.
 *
 * Found by MEASUREMENT, not by class name: the sheet's sideways scroll belongs to `.kv-score`
 * today (styles/app.css), but this view is also mounted by the render harness, and "there is more
 * content here than box" is true wherever the container ends up. ⚠ The vertical axis is
 * deliberately not looked for — `.kv-score` is `overflow-y: clip` on purpose (the sheet must not
 * grow a second scrollbar), so the only thing that scrolls up and down is the page itself.
 *
 * ⚠ BOTH tests are needed, and the overflow one is the trap. A box can hold more content than it
 * shows and still not scroll: on a narrow window the sheet's own wrapper is 1020 px wide inside a
 * ~600 px column with `overflow: visible`, so it reports 420 px of hidden width — and setting its
 * `scrollLeft` does exactly nothing. It sits INSIDE `.kv-score`, so it was found first and the
 * sideways follow was dead on every window narrow enough to need it. `smoke:editor` caught it.
 */
function sideScrollerOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.scrollWidth <= p.clientWidth + FOLLOW_SIDE_MIN) continue;
    const overflow = getComputedStyle(p).overflowX;
    if (overflow === "auto" || overflow === "scroll") return p;
  }
  return null;
}

/**
 * Bring the playhead back on screen if it has left it. Called once per staff row — see FOLLOW_*.
 *
 * Two different scrollers, because the sheet has two axes and they are not the same object: down
 * the PAGE (the window), and across the sheet's own box (`sideScrollerOf`). Each axis is touched
 * only when the cursor is really outside the readable band, so a new row that is already on screen
 * moves nothing.
 */
function followCursorIntoView(cursor: HTMLElement): void {
  const box = cursor.getBoundingClientRect();
  if (box.height === 0) return; // hidden — there is nothing to follow yet
  // Obey the reader's own OS setting: same jump, no animation.
  const behavior: ScrollBehavior =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  if (box.top < FOLLOW_MARGIN || box.bottom > window.innerHeight - FOLLOW_MARGIN) {
    // Park the row a third of the way down the window, so there is music AHEAD of the cursor and
    // not only behind it. The browser clamps this at both ends of the document.
    window.scrollTo({ top: Math.max(0, window.scrollY + box.top - window.innerHeight * FOLLOW_AIM), behavior });
  }

  const scroller = sideScrollerOf(cursor);
  if (scroller) {
    const left = box.left - scroller.getBoundingClientRect().left;
    const width = scroller.clientWidth;
    if (left < FOLLOW_MARGIN || left > width - FOLLOW_MARGIN) {
      scroller.scrollTo({ left: Math.max(0, scroller.scrollLeft + left - width / 2), behavior });
    }
  }
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
  sigTolerant,
  showLyrics,
  lyricHyphens,
  playing,
  getPositionMs,
  playPlan,
  followPlayhead = false,
  onSeekToMeasure,
  selectedNote,
  onSelectNote,
  onDeleteNote,
  onNudgePitch,
  armedTool,
  armedRest = false,
  armedSign = null,
  signTargets,
  openRepeat = null,
  repeatAnchor = null,
  onPlaceMark,
  onRepeatEdge,
  onRepeatCancel,
  onRemoveMark,
  onApplyTool,
  onInsertNote,
  tupletAnchor = null,
  onTupletPick,
  selectedTuplet = null,
  onTupletEdge,
  onTupletRemove,
  onLayout,
  highlightRect,
  repeatSpans,
  navMarks,
  textNoise,
  slurNoise,
  staccatoNoise,
  usulBarNoise,
  thinSharps,
  printNoise,
  legacyTupletMark,
  concaveTuplet,
  signatureOverride,
}: {
  doc: NoteModelDocument;
  editMode: boolean;
  /** How accidentals are displayed (see {@link AccidentalMode}). The key signature is drawn at
   *  each row start in `"keysig"` and `"measure"` modes. */
  accidentalMode: AccidentalMode;
  /** `"measure"` mode only: write a same-direction intonation refinement BARE under the signature
   *  (a 5-comma F♯ under a koma-sharp-F donanım), the real printed-page convention — or print its
   *  own sign whenever the alteration differs at all, so the staff matches the sound. Required, not
   *  optional: the renderer and the app want opposite answers, and a caller that forgets would
   *  silently change what the corpus draws. The strip labels must be built with the SAME value
   *  (`buildStrips`' `sigTolerant`) or pixels stop equalling labels. See `SIG_TOLERANT` in App.tsx. */
  sigTolerant: boolean;
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
  /** The performance, when it differs from what is written: one step per sounding event, naming
   *  the drawn note it belongs to (see {@link PlayStep}). Undefined for a score that plays exactly
   *  as it is written — then the playhead walks the drawn notes, as it always did. */
  playPlan?: readonly PlayStep[];
  /** Scroll the page to the playhead when the playhead leaves the screen (owner, 2026-09-03).
   *
   *  The reader's setting, and it defaults to OFF here on purpose: the app turns it on (see
   *  `followPlayhead` in App.tsx), while the render harness — which mounts this view to cut
   *  training strips — must never move the score under the screenshot. Nothing happens while
   *  `playing` is false either way. */
  followPlayhead?: boolean;
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
  /** Edit mode: which KIND of palette tool is armed, or null for plain selection.
   *
   *  A click on a NOTE routes to `onApplyTool`, except for the tuplet, which has its own two-click
   *  gesture (`onTupletPick`). The kind also decides what EMPTY space does: a note value inserts
   *  there (step 6), while an accidental or the tuplet has nothing to attach to and does nothing —
   *  opening the measure modal on an armed click would be a surprise. */
  armedTool?: "duration" | "accidental" | "tuplet" | "structure" | null;
  /** True when the armed note value is a REST tool. Only the preview cares: a rest has no pitch, so
   *  the ghost parks mid-staff and stops naming one. The insert/apply paths are the same. */
  armedRest?: boolean;
  /** Edit mode: a note was clicked while a tool was armed. Fires once per click, even for a
   *  tie-split event (two boxes, one `evIndex`). */
  /**
   * Edit mode: the structure signs a click can DELETE, with the bar and edge each one is drawn on.
   * Undefined outside edit mode and while the score is written out long.
   *
   * ⚠ Positions come from the caller, not from `repeatSpans`, and the two are not the same list —
   * see `App`'s `signTargets`. This component only paints a target where it is told to.
   */
  signTargets?: MarkTarget[];
  /**
   * Edit mode: a bar carrying a `‖:` that nothing closes yet, or null.
   *
   * ⚠ This sign is NOT on the engraved staff and must not be — `repeatSpansFromStructure` refuses
   * to draw a repeat the music does not take. It is drawn here, in the overlay, marked incomplete:
   * a score is marked up left to right, so a `‖:` is unfinished for as long as it takes to place
   * its `:‖`, and a tool whose click leaves no trace reads as broken. Same idiom as a broken
   * tuplet mark.
   */
  openRepeat?: number | null;
  /** Which SIGN is armed, when `armedTool` is `"structure"`. The repeat is the one that is not
   *  placed on a bar, so the sheet has to tell them apart. */
  armedSign?: SignTool | null;
  /** The repeat gesture's first click: the bar whose opening barline carries the pending `‖:`,
   *  or null. ⚠ Nothing is in the document yet — this is a preview, not a placed sign. */
  repeatAnchor?: number | null;
  /** A structure tool is armed and a bar was clicked: put the sign on that bar. */
  onPlaceMark?: (bar: number) => void;
  /** A barline was clicked while the repeat tool is armed. `edge` says which line of the bar:
   *  `"start"` opens the repeat (first click), `"end"` closes it (second). */
  onRepeatEdge?: (bar: number, edge: "start" | "end") => void;
  /** The pending `‖:` was clicked again — take the gesture back. */
  onRepeatCancel?: () => void;
  /** A drawn sign was clicked in Seçim: take it off. */
  onRemoveMark?: (bar: number, mark: StructureMark) => void;
  onApplyTool?: (index: number, pitchAt?: { letter: string; octave: number; alter: number }) => void;
  /** Edit mode, a note value armed: empty staff was clicked, so insert a note there. Everything
   *  is already resolved from the geometry — which bar, which event to go in front of (null =
   *  the end of that bar), and the staff position the click's HEIGHT names. The spelling is in
   *  DISPLAY space: the sheet draws `displayDoc`, so a transposed score needs it mapped back. */
  onInsertNote?: (at: {
    measureIndex: number;
    beforeEventIndex: number | null;
    letter: string;
    octave: number;
    alter: number;
  }) => void;
  /** Edit mode, the tuplet armed: the first note of the run, or null when none is picked yet.
   *  Drives which targets stay clickable — see `tupletStates`. */
  tupletAnchor?: number | null;
  /** Edit mode, the tuplet armed: a clickable note was clicked. The sheet only refuses what it has
   *  dimmed; deciding what the click MEANS (anchor, apply, select, cancel) is App's. */
  onTupletPick?: (index: number) => void;
  /** Edit mode, the tuplet armed: a whole triplet is HELD, named by its first member's
   *  `NoteEvent.index`. The group itself is re-derived here with `closedTupletAt` — nothing about a
   *  tuplet is ever stored — and drives the frame, the two handles and the ✕. */
  selectedTuplet?: number | null;
  /** Edit mode: a handle of the held triplet was dragged onto a note. The sheet resolves the
   *  geometry (which note is under the pointer) and hands over an intent; whether the move is legal
   *  is `tupletEdgeTo`'s answer, which both sides read. */
  onTupletEdge?: (edge: "start" | "end", targetIndex: number) => void;
  /** Edit mode: the held triplet's ✕ was pressed — take the bracket off, keep the notes. */
  onTupletRemove?: () => void;
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
  /** Round-3 staccato distractors: label-free dots on the notehead side (see drawStaccatoDot), so
   *  the model learns that a dot means "longer" only BESIDE the notehead, not above or below it.
   *  Pixels only. Undefined → none, which is every strip rendered before 2026-08-15. */
  staccatoNoise?: { seed: number } | null;
  /** Round-3: label-free DOTTED (usul) BARLINES inside the bar, on the usul's beat-group
   *  boundaries (see drawUsulBars). The symbol has never been drawn, so the model reads a real one
   *  as `\repstart`. Pixels only. Undefined → none, i.e. every strip rendered before 2026-08-30. */
  usulBarNoise?: { seed: number } | null;
  /** Round-2: redraw the AEU sharps with real-print bar weight so the three bars of a küçük/büyük
   *  mücennep stay separated after downscaling (see drawThinSharps). Pixels only. → Bravura. */
  thinSharps?: boolean;
  /** Round-3 print realism: seeded staff-line weight + usul beam grouping, so the corpus varies
   *  the way real editions do (see STAFF_LINE_WIDTH / USUL_BEAM_GROUPS). Pixels only — the labels
   *  come from the note model and are identical with and without it. Undefined → VexFlow's
   *  defaults, i.e. every strip rendered before Round 3. */
  printNoise?: { seed: number } | null;
  /** The tuplet A/B's CONTROL arm: draw the pre-2026-08-12 continuous arc with the digit floating
   *  above it (see drawTupletArcLegacy). Pixels only — the `\tup3` token is identical either way.
   *  Corpus rendering only; the app never sets it. docs/rung3/round3-criteria.md */
  legacyTupletMark?: boolean;
  /** OPT-IN (2026-08-19): let a share of pieces draw the CONCAVE mark — a continuous arc with the
   *  "3" hanging inside it (see drawTupletArcConcave). Pixels only; the `\tup3` token is identical.
   *  ⚠ OFF by default and it must stay that way: it changes a share of every rendered piece, so a
   *  corpus rendered with it on is not comparable to one rendered with it off. That is precisely how
   *  `--print-noise` once shipped USUL_BEAM_GROUPS into ~40k strips by riding along unconditionally.
   *  docs/rung3/tuplets.md */
  concaveTuplet?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  // The row the follow has already answered for (its top in sheet coordinates), so the question is
  // asked once per row. A ref, like everything else the playhead frame touches: it must not
  // re-render anything. Null = nothing followed yet, which is why the FIRST row of a playback is a
  // change and gets its scroll — that is what takes you to the bar Çal was aimed at.
  const followRowRef = useRef<number | null>(null);
  // An in-progress pitch drag: which event, where the pointer went down, and how many steps have
  // already been applied. A ref, not state — every applied step re-engraves the score, and the
  // drag has to survive those re-renders unchanged.
  const dragRef = useRef<{ index: number; startY: number; applied: number } | null>(null);
  // An in-progress TUPLET-HANDLE drag: which end of the held triplet is following the pointer.
  // A ref for the same reason `dragRef` is one — every step of the drag rewrites two durations and
  // re-engraves the score, and the gesture has to survive those re-renders.
  const tupletDragRef = useRef<{ edge: "start" | "end" } | null>(null);
  // On-screen position of every timed event, in playback order. A ref (not state) because the
  // playhead animation reads it every frame and must not trigger re-renders.
  const positionsRef = useRef<NotePos[]>([]);
  // The same positions keyed by `NoteEvent.index` — see the write in the draw effect.
  const posByEvRef = useRef<Map<number, NotePos>>(new Map());
  const [boxes, setBoxes] = useState<MeasureBox[]>([]);
  // Per-note click targets for edit mode. State (not a ref like `positionsRef`) because the
  // overlay renders from them; they change only on a re-engrave, so this costs nothing.
  const [noteBoxes, setNoteBoxes] = useState<NoteBox[]>([]);
  // The drawn triplet marks that the editor may HOLD, with the box of their real ink. State, like
  // `noteBoxes`, because the overlay renders from them and they change only on a re-engrave.
  const [tupletMarks, setTupletMarks] = useState<TupletMarkBox[]>([]);
  const [svgHeight, setSvgHeight] = useState(ROW_HEIGHT + 20);
  const [hover, setHover] = useState<number | null>(null);
  // The insert preview: a ghost notehead at the staff position an empty click would use. Moved by
  // mutating the element directly (like the playhead above), never through state — a preview that
  // re-rendered the overlay on every mouse-move is exactly the cost that got the measure hover
  // highlight removed in slice 1.
  const ghostRef = useRef<HTMLDivElement>(null);

  /** Is any tool armed? The note-hit path only cares about this; the empty-space path needs the
   *  kind, because only a note value can be inserted into blank staff. */
  const armed = armedTool != null;

  /**
   * Can a drawn tuplet mark be picked up right now? With the TUPLET armed, and also with **nothing**
   * armed — plain Seçim (owner, 2026-08-30: *"tupletleri seçmek için toolkitten ille de tupleti
   * seçmem gerekmesin. Seçim seçiliyken de tupletleri seçip silebileyim"*).
   *
   * ⚠ Not with a note value or an accidental armed: those apply to a NOTE, and a mark is not one.
   * A click on a mark while they are armed falls through, exactly as a click on blank staff does.
   *
   * In Seçim the two selections are mutually exclusive — App clears the note when a mark is picked
   * and the mark when a note is — so the page never shows two things selected at once.
   */
  const tupletPickable = editMode && (armedTool == null || armedTool === "tuplet");

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

  /**
   * Edit mode, the tuplet armed: what a click on each note would do (editor step 7).
   *
   *  - `start`  — a legal run begins here (nothing anchored yet);
   *  - `member` — inside an existing closed triplet. ⚠ Since 2026-08-30 this is INFORMATION, not a
   *    target: a member is not clickable, because the group is picked up by clicking its drawn "3"
   *    (owner). The state is still published, so a check can still see where the triplets are;
   *  - `anchor` — the run's first note, already picked; clicking it again backs out;
   *  - `end`    — the one note that closes the run from the anchor;
   *  - `blocked` — everything else. Rendered dim and with `pointer-events: none`, which is what
   *    makes an invalid target literally unclickable rather than merely unresponsive (the brief:
   *    dim them, do not pop an error).
   *
   * Once a run is open only its own two ends stay live — an existing triplet elsewhere on the page
   * would otherwise silently abandon the anchor when clicked.
   *
   * All of it comes from `tools/render/rhythm.ts`, the module that draws the bracket, so the sheet
   * cannot offer a triplet the engraver would refuse to draw. Empty when the tool is not armed, so
   * nothing here costs anything in the other modes.
   */
  const tupletStates = useMemo(() => {
    const out = new Map<number, "start" | "member" | "anchor" | "end" | "blocked">();
    if (armedTool !== "tuplet") return out;
    for (const m of groupMeasures(doc)) {
      const anchorPos = tupletAnchor == null ? -1 : m.events.findIndex((e) => e.index === tupletAnchor);
      const endPos = anchorPos < 0 ? null : tupletRunFrom(m.events, anchorPos)?.[2] ?? null;
      m.events.forEach((ev, pos) => {
        const state =
          tupletAnchor != null
            ? ev.index === tupletAnchor ? "anchor" : pos === endPos ? "end" : "blocked"
            : drawnTupletAt(m.events, pos) ? "member"
              : tupletRunFrom(m.events, pos) ? "start"
                : "blocked";
        out.set(ev.index, state);
      });
    }
    return out;
  }, [doc, armedTool, tupletAnchor]);

  /**
   * Edit mode, the tuplet armed and a whole triplet HELD: its three members and where each handle
   * may legally land (editor step 7b).
   *
   * Nothing about a tuplet is stored, here least of all: `selectedTuplet` is one event index and the
   * group is re-derived from the document every time with `closedTupletAt` — the same function that
   * decides whether a bracket gets drawn at all. So a triplet that stops being one (an undo, a
   * re-valued member) simply loses its handles, and no stale geometry can outlive it.
   *
   * The landing sets come from `tupletEdgeTo`, which is also what App calls to make the move — the
   * sheet cannot offer a handle position the edit would then refuse. Null whenever nothing is held,
   * so this costs nothing in every other mode.
   */
  const tupletSel = useMemo(() => {
    if (!tupletPickable || selectedTuplet == null) return null;
    for (const m of groupMeasures(doc)) {
      const pos = m.events.findIndex((e) => e.index === selectedTuplet);
      if (pos < 0) continue;
      const g = drawnTupletAt(m.events, pos);
      if (!g) return null;
      const members = memberPositions(m.events, g).map((p) => m.events[p]!.index);
      if (members.length === 0) return null;
      const closedNow = closedTupletAt(m.events, pos) != null;
      const start: number[] = [];
      const end: number[] = [];
      // Landings that would COMPLETE a broken mark — drop the handle here and it becomes a real
      // triplet. Worth its own mark: on a decoded page most of what you do with these is repair
      // them, and the page can say where the repair is rather than leaving it to be discovered.
      const fixes = new Set<number>();
      m.events.forEach((ev, p) => {
        const a = tupletEdgeTo(m.events, g, "start", p);
        const b = tupletEdgeTo(m.events, g, "end", p);
        if (a) start.push(ev.index);
        if (b) end.push(ev.index);
        if ((a?.closes || b?.closes) && !closedNow) fixes.add(ev.index);
      });
      // Every legal landing, and WHICH handle can reach it — a note can be a landing for one end,
      // the other, or both, and a check that drags the wrong handle onto it would look like a bug
      // in the move rather than in the check.
      const all = new Map<number, "start" | "end" | "both">();
      for (const i of start) all.set(i, "start");
      for (const i of end) all.set(i, all.has(i) ? "both" : "end");
      return {
        members,
        /** Does the held mark close as a real triplet? A broken one is repaired rather than slid,
         *  and it is drawn differently, so the sheet has to know which it is holding. */
        closes: closedNow,
        fixes,
        /** The event each handle currently sits on — a candidate too, and the one that means
         *  "stay where you are", so a small wobble does not jump the group. ⚠ A broken mark can
         *  cover ONE note, and then both handles sit on the same event. */
        edge: { start: members[0]!, end: members[members.length - 1]! },
        targets: { start, end },
        all,
      };
    }
    return null;
  }, [doc, tupletPickable, selectedTuplet]);

  /**
   * Edit mode: which bars do not add up, and in which direction (editor step 8).
   *
   * ⚠ The reference is the DERIVED METER, never `Measure.lengthBeats` — that is computed from the
   * bar's own contents (`measureBeats`), so `isMeasureValid` against it is true by construction and
   * can only ever mean "you changed this bar since it was measured". A musician means something
   * else by "this bar is too long", and so does a model that misread a duration.
   *
   * The first and last bar warn only when OVER: a pickup and a closing bar are legitimately short,
   * an overfull one never is.
   */
  const barFill = useMemo(() => {
    const out = new Map<number, "over" | "under">();
    if (!editMode || !timeSig) return out;
    const meterWhole = timeSig.num / timeSig.den;
    const measures = groupMeasures(doc);
    measures.forEach((m, i) => {
      const d = measureBeats(m.events) - meterWhole;
      if (Math.abs(d) < 1e-4) return;
      const edge = i === 0 || i === measures.length - 1;
      if (d < 0 && edge) return;
      out.set(m.index, d > 0 ? "over" : "under");
    });
    return out;
  }, [doc, editMode, timeSig]);

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
    // Seeded RNG for the staccato distractors, drawn in the same per-measure walk. Its own stream,
    // so turning staccato on does not shift which slurs the slur seed draws — the two distractors
    // have to be separable, or an A/B on one of them silently moves the other.
    const staccatoRng = staccatoNoise ? mulberry32(staccatoNoise.seed) : null;
    // ⭐ The usul rule is coined ONCE for the whole page, not per bar: an edition either uses the
    // convention or it does not. Its group boundaries come from USUL_BEAM_GROUPS, which already
    // holds the conventional groupings by meter. ⚠ That table is quarantined as a BEAMING change
    // (it would move every beam in ~40k strips); reading it for where a RULE goes is a different
    // use and moves no beam.
    const usulBarGroups = (() => {
      if (!usulBarNoise || !timeSig) return null;
      if (mulberry32(usulBarNoise.seed)() >= USUL_BAR_RATE) return null;
      const pattern = USUL_BEAM_GROUPS[`${timeSig.num}/${timeSig.den}`];
      if (!pattern || pattern.length < 2) return null;
      // Cumulative INTERNAL boundaries, in whole-note units — the same unit `eventBeats` counts in.
      // The final entry is the barline itself and is dropped.
      const out: number[] = [];
      let acc = 0;
      for (const g of pattern.slice(0, -1)) {
        acc += g / timeSig.den;
        out.push(acc);
      }
      return out;
    })();

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
    // curved arc + "3" of most printed Turkish scores (~90% of pieces, by name hash) or
    // VexFlow's square bracket. The label token is identical either way — the style variety
    // is free training realism. 70% until 2026-08-12; the owner reads arcs as more dominant than
    // that in real editions, and 10% keeps the bracket represented, since real print does use it.
    const tupletCurved =
      Array.from(doc.name ?? "").reduce((s, ch) => s + ch.charCodeAt(0), 0) % 10 < 9;
    // A SECOND coin inside the curved style (2026-08-19): the continuous arc with the "3" inside its
    // concavity, which the owner found on two real scanned editions. Hashed on a DIFFERENT salt than
    // `tupletCurved` so the two styles are independent — reusing the same sum would tie "is it
    // curved" to "is it concave" and put a hidden correlation in the corpus.
    // ⚠ Chosen share, not measured — see TUPLET_MARK_CONCAVE. OPT-IN: without the flag this is
    // always false, so every render made before 2026-08-19 reproduces byte for byte.
    const tupletConcave =
      !!concaveTuplet &&
      Array.from(`${doc.name ?? ""}:concave`).reduce((s, ch) => s + ch.charCodeAt(0), 0) % 100
      < TUPLET_MARK_CONCAVE.share * 100;

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
    // The SVG backend's group API, used to wrap a VexFlow-drawn triplet bracket so it can be
    // measured. Typed narrowly and optional rather than cast to SVGContext: the backend is fixed
    // above, but a render context that cannot open a group should cost a click target, not a page.
    const svgCtx = ctx as unknown as
      | { openGroup(cls?: string, id?: string): SVGGElement; closeGroup(): void }
      | undefined;
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    svg?.setAttribute("data-omr", "sheet-svg"); // stable selector for the Playwright strip exporter

    const collected: MeasureBox[] = [];
    const positions: NotePos[] = [];
    const noteRects: NoteBox[] = [];
    // Every triplet mark drawn on the page, with the element wrapping its ink — a <g> we created for
    // a curved mark, one the render context opened for a VexFlow bracket. Both are measured the same
    // way below. `closes` separates a real triplet from a broken mark; both are holdable.
    const markSlots: { evIndex: number; el: SVGGraphicsElement; closes: boolean }[] = [];
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
          const { notes, slots, tuplets, tupletGroups, ties } = buildStaveNotes(cell.m, accidentalMode, signatureMap, sigTolerant);
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
            tuplets.forEach((group, gi) => {
              const above = tupletAbove(group);
              // Which event this mark belongs to, and whether it is a REAL triplet or a broken one.
              // ⚠ Both are holdable (owner, 2026-08-30). A mark over one or two notes is a run that
              // never summed plain — the model's misread, drawn on purpose so a person can see it —
              // and being able to grab that one is the whole point of the ask. It is flagged rather
              // than hidden, so the page says which marks need attention.
              const pos = tupletGroups[gi]!;
              const closes = closedTupletAt(cell.m.events, pos.from) != null;
              const first = cell.m.events[memberPositions(cell.m.events, pos)[0]!]?.index ?? null;
              if (tupletCurved && svg) {
                // Drawn INTO a <g> so the mark can be measured with `getBBox()` — the same trick
                // `g[data-omr="aeu-sharp"]` already uses, and the only way the click target can sit
                // on the real ink rather than on a second copy of the mark's geometry. The wrapper
                // changes no pixels: the arc drawers only ever `appendChild`.
                const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                g.setAttribute("data-omr", "tuplet-mark");
                svg.appendChild(g);
                (legacyTupletMark
                  ? drawTupletArcLegacy
                  : tupletConcave
                    ? drawTupletArcConcave
                    : drawTupletArc)(g, group, above);
                if (first != null) markSlots.push({ evIndex: first, el: g, closes });
              } else {
                // The square bracket goes into a group WE open, so it is measured exactly like the
                // curved mark. ⚠ Not found by its `.vf-tuplet` class and not by document order:
                // every bundled score hashes to the arc, so a bracket page is code no check on this
                // machine has ever executed — the fewer of VexFlow's private conventions it leans
                // on, the better. `openGroup` is the render context's own API and applies no
                // transform, so the box comes back in the same space as everything else here.
                const g = svgCtx?.openGroup("tuplet-mark") ?? null;
                new Tuplet(group, {
                  numNotes: 3,
                  notesOccupied: 2,
                  bracketed: true,
                  ratioed: false,
                  location: above ? 1 : -1,
                })
                  .setContext(ctx)
                  .draw();
                svgCtx?.closeGroup();
                if (first != null && g) markSlots.push({ evIndex: first, el: g, closes });
              }
            });
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
            // Dotted (usul) barlines: label-free rules on the usul's beat-group boundaries.
            // Onsets are counted off the DOCUMENT's own events (eventBeats, the arithmetic the
            // off-meter check uses), never off VexFlow ticks — a tuplet's written ticks do not sum
            // to the bar. A tie-split event keeps ONE onset, so a rule can never land between the
            // two halves of a single note.
            if (usulBarGroups && svg) {
              const onsets: number[] = [];
              let acc = 0;
              let seen: (typeof slots)[number]["ev"] | null = null;
              for (const slot of slots) {
                if (slot.ev !== seen) {
                  onsets.push(acc);
                  acc += eventBeats(slot.ev);
                  seen = slot.ev;
                } else {
                  onsets.push(onsets[onsets.length - 1] ?? 0);
                }
              }
              drawUsulBars(svg, stave, notes, onsets, usulBarGroups);
            }
            // Staccato distractors: label-free dots on the notehead side (see drawStaccatoDot).
            // Two passes, because they teach two different halves of the same rule.
            if (staccatoRng && svg) {
              const marked = new Set<StaveNote>();
              const mark = (n: StaveNote) => {
                if (marked.has(n) || n.isRest()) return;
                marked.add(n);
                drawStaccatoDot(svg, n);
              };
              // PASS 1 — the both-dots case, and the reason this distractor can work at all. A
              // notehead carrying an augmentation dot BESIDE it and a staccato ABOVE it is the only
              // example that isolates position from everything else: same ink, same note, one dot
              // lengthens and one does not. Deliberately sought out rather than left to chance,
              // because a run-based draw would hit dotted notes only occasionally and the contrast
              // is the whole lesson. Real editions print this constantly.
              for (const n of notes) {
                if (n.isRest()) continue;
                const dotted = n.getModifiers().some((m) => m instanceof Dot);
                if (dotted && staccatoRng() < STACCATO_RATE.dotted) mark(n);
              }
              // PASS 2 — ordinary phrase staccato, in RUNS, because real editions mark a phrase and
              // not a scattering of single notes. Within one measure, so a barline crop never cuts
              // a marked phrase in half (the same care drawSlurArc takes).
              let run: StaveNote[] = [];
              const tryStaccato = () => {
                if (run.length >= 2 && staccatoRng() < STACCATO_RATE.run) {
                  const maxLen = Math.min(4, run.length);
                  const len = 2 + Math.floor(staccatoRng() * (maxLen - 1)); // 2..maxLen
                  const start = Math.floor(staccatoRng() * (run.length - len + 1));
                  for (const n of run.slice(start, start + len)) mark(n);
                }
                run = [];
              };
              for (const n of notes) {
                if (n.isRest()) tryStaccato();
                else run.push(n);
              }
              tryStaccato();
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
              positions.push({ startMs: tMs, endMs: tMs + slot.durationMs, evIndex: slot.ev.index, x: n.getAbsoluteX(), top: barTop, height: barHeight });
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
        collected.push({ index: cell.m.index, measure: cell.m, x, y, width: cell.width, topLineY: stave.getYForLine(0) });
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

    // The triplet marks' click targets, measured off the STROKES that were actually drawn (see
    // `markBoxOf` — the group's own box is not the ink, and two of its children lie about theirs).
    // The target therefore sits on the mark a reader sees, never on a second copy of its geometry
    // that could drift from it. All of it is in the SVG's user space, which is the overlay's space
    // too (the container is never transformed; see the .kv-score rule in CLAUDE.md).
    const markRects: TupletMarkBox[] = [];
    for (const slot of markSlots) {
      const b = markBoxOf(slot.el);
      if (b) markRects.push({ evIndex: slot.evIndex, closes: slot.closes, ...b });
    }
    setTupletMarks(markRects);
    positionsRef.current = positions;
    // Drawn position BY EVENT, for the folded score's playhead: it follows the performance, so it
    // asks "where is written note 42 drawn?", not "what did we draw 42nd?". Built here rather than
    // per frame — the draw is the only thing that can move a note.
    // ⚠ FIRST box wins: one event can be drawn as two noteheads, and the note starts at the first.
    posByEvRef.current = new Map();
    for (const p of positions) if (!posByEvRef.current.has(p.evIndex)) posByEvRef.current.set(p.evIndex, p);
    onLayout?.({
      boxes: collected.map((b) => ({ index: b.index, x: b.x, y: b.y, width: b.width })),
      svgWidth: SVG_WIDTH,
      svgHeight: height,
      rowHeight: ROW_HEIGHT,
    });

    return () => {
      host.innerHTML = "";
    };
  }, [doc, accidentalMode, sigTolerant, showLyrics, lyricHyphens, signature, signatureMap, timeSig, onLayout, repeatSpans, navMarks, textNoise, slurNoise, staccatoNoise, usulBarNoise, thinSharps, printNoise, legacyTupletMark, concaveTuplet]);

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
    // A fresh playback answers for its first row again — it may start anywhere on the page.
    followRowRef.current = null;
    let raf = 0;
    const tick = () => {
      const pos = getPositionMs();
      const ps = positionsRef.current;
      // Two paths, and the plain one is unchanged. Without a `playPlan` the drawn order IS the
      // playing order, so the positions recorded during the draw are read straight off — including
      // the case of one event drawn as two noteheads, where the second box must not stand in for
      // the first. A folded score cannot do that: it plays bars the page does not write out in
      // order, so the clock is read against the PERFORMANCE and the cursor then looks up where that
      // written note is drawn.
      let active: NotePos | undefined;
      if (pos != null && pos >= 0) {
        if (playPlan) {
          if (playPlan.length > 0) {
            const step = playPlan.find((p) => pos < p.endMs) ?? playPlan[playPlan.length - 1]!;
            // Missing = the performance names a note this view did not draw (a structure mark
            // pointing at a bar the same decode dropped). The cursor then stays where it was,
            // rather than flicking to the top of the page.
            active = posByEvRef.current.get(step.evIndex);
          }
        } else if (ps.length > 0) {
          // First event whose end is still ahead of the clock is the one sounding now.
          active = ps.find((p) => pos < p.endMs) ?? ps[ps.length - 1]!;
        }
      }
      if (active) {
        cursor.style.display = "block";
        cursor.style.height = `${active.height}px`;
        cursor.style.transform = `translate(${active.x - 2}px, ${active.top}px)`;
        // ⚠ AFTER the transform, never before: the box is read from the DOM, so it has to be the
        // position this frame just wrote. And only when the ROW changed — see the FOLLOW_* block.
        if (followPlayhead && active.top !== followRowRef.current) {
          followRowRef.current = active.top;
          followCursorIntoView(cursor);
        }
      } else if (!playPlan || pos == null || pos < 0) {
        cursor.style.display = "none";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getPositionMs, playPlan, followPlayhead]);


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
    // The tuplet is a two-click gesture and its own path: it never selects, because the selection
    // highlight beside an anchor highlight would say there are two marked notes when there is one.
    if (armedTool === "tuplet") {
      onTupletPick?.(index);
      return;
    }
    onSelectNote?.(index);
    // A tool is armed: this click APPLIES it. Deliberately no drag — a click that both re-values a
    // note and nudges its pitch by whatever the pointer wobbled is not one edit, it is two.
    if (armed) {
      // The click's HEIGHT rides along, because one case needs it: a note value dropped on a REST
      // turns it back into a note, and a rest carries no pitch to keep. Same mapping as the insert
      // ghost, so a rest clicked at a given height becomes the note that height names. App ignores
      // it for every other target.
      onApplyTool?.(index, armedTool === "duration" ? pitchAtNote(e, index) : undefined);
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

  // --- the tuplet handles (editor step 7b) ------------------------------------------------------
  //
  // Grab either end of a held triplet and drag it along its bar. The group keeps exactly three
  // members, so the handle SLIDES it — one member drops back to its plain value and the neighbour
  // the handle passed over joins. Why three is the only honest length is arithmetic and lives with
  // `tupletEdgeTo`, not here; the sheet only resolves geometry into "which note is under the
  // pointer" and hands that over.

  /** The drawn box of an event. A triplet member can never be tie-split (its duration is a tuplet
   *  fraction, which `needsTieSplit` excludes), so one member is always exactly one box. */
  function boxOf(evIndex: number): NoteBox | null {
    return noteBoxes.find((b) => b.evIndex === evIndex) ?? null;
  }

  function onHandleDown(e: React.PointerEvent<HTMLDivElement>, edge: "start" | "end") {
    e.stopPropagation();
    e.preventDefault();
    tupletDragRef.current = { edge };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  /**
   * The handle moved: slide the group so its end lands on the nearest note the pointer is over.
   *
   * The candidates are the legal landings PLUS the note the handle is already on, and the nearest
   * centre wins. Including the current one is what makes the gesture stable — without it the
   * nearest candidate is always a different note, and the group would jump on the first pixel of
   * movement rather than when the pointer actually reaches the next note.
   *
   * Dragging away vertically does nothing: a tuplet is strictly intra-measure and a measure sits on
   * one row, so a pointer that has left the row is no longer aiming at any of these notes.
   */
  function onHandleMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = tupletDragRef.current;
    if (!d || !tupletSel || !onTupletEdge) return;
    const at = localXY(e);
    if (!at) return;
    const held = boxOf(tupletSel.edge[d.edge]);
    if (!held) return;
    if (Math.abs(at.y - (held.y + held.height / 2)) > ROW_HEIGHT) return; // off this row
    // "Stay put" first, then every legal landing.
    const cands = [
      { evIndex: tupletSel.edge[d.edge], legal: false },
      ...tupletSel.targets[d.edge].map((evIndex) => ({ evIndex, legal: true })),
    ];
    let best: { evIndex: number; legal: boolean } | null = null;
    let bestDx = Infinity;
    for (const c of cands) {
      const b = boxOf(c.evIndex);
      if (!b) continue;
      const dx = Math.abs(b.x + b.width / 2 - at.x);
      if (dx < bestDx) {
        bestDx = dx;
        best = c;
      }
    }
    if (best?.legal) onTupletEdge(d.edge, best.evIndex);
  }

  function onHandleUp(e: React.PointerEvent<HTMLDivElement>) {
    tupletDragRef.current = null;
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

  // Disarming (or switching to an accidental) must take the ghost with it — nothing else clears
  // it, because the pointer may never leave the bar it was last drawn over.
  useEffect(() => {
    if (armedTool !== "duration") hideGhost();
  }, [armedTool]);

  // --- insert on empty space (editor step 6) ------------------------------------------------
  //
  // The sheet owns all of the geometry and hands `App` a resolved intent, never pixels: which bar,
  // which event the new note goes in front of, and the staff position the click's height names.

  /** A pointer position in the container's (= the SVG's) coordinate space. */
  function localXY(e: React.MouseEvent): { x: number; y: number } | null {
    const cont = containerRef.current;
    if (!cont) return null;
    const r = cont.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /**
   * What an empty click inside measure `b` would insert: the pitch from its height, and the event
   * it goes in FRONT of from its x — the first note of that bar whose centre lies to the right,
   * or null to append at the end of the bar.
   *
   * ⚠ A tie-split event owns two boxes sharing one `evIndex`; first match wins, which is the right
   * answer (the split is one event, and it starts at the first box).
   */
  function insertAt(b: MeasureBox, at: { x: number; y: number }) {
    const own = new Set(b.measure.events.map((ev) => ev.index));
    let before: number | null = null;
    let bestX = Infinity;
    for (const nb of noteBoxes) {
      if (!own.has(nb.evIndex)) continue;
      const cx = nb.x + nb.width / 2;
      if (cx > at.x && cx < bestX) {
        bestX = cx;
        before = nb.evIndex;
      }
    }
    return { ...pitchAtHeight(at.y, b.topLineY, signatureMap), measureIndex: b.index, beforeEventIndex: before };
  }

  /** The staff position a click on an existing note is pointing at — the rest→note case. Needs the
   *  note's own bar, because the origin (`topLineY`) is per row. Null when the event is not on a
   *  laid-out bar, which a stale click can be. */
  function pitchAtNote(e: React.PointerEvent, index: number) {
    const at = localXY(e);
    const b = boxes.find((bx) => bx.measure.events.some((ev) => ev.index === index));
    if (!at || !b) return undefined;
    const p = pitchAtHeight(at.y, b.topLineY, signatureMap);
    return { letter: p.letter, octave: p.octave, alter: p.alter };
  }

  /** Move the ghost notehead to the position an insert would use, and label it with the pitch it
   *  would produce. `data-insert-pitch` is the contract `smoke:editor` reads: the preview and the
   *  insert must come out of the same mapping, and an attribute is how that is provable. */
  function moveGhost(b: MeasureBox, e: React.MouseEvent) {
    const g = ghostRef.current;
    const at = localXY(e);
    if (!g || !at) return;
    const spot = insertAt(b, at);
    g.style.display = "block";
    if (armedRest) {
      // A rest has no pitch: it goes where the engraver puts it, in the middle of the staff, and
      // the preview must not promise otherwise by following the pointer up and down. Drawn as a
      // squat bar rather than an oval, because that is what a rest looks like.
      g.style.borderRadius = "1px";
      g.style.transform =
        `translate(${at.x - GHOST_W / 2}px, ${b.topLineY + 4 * DRAG_PX_PER_STEP - GHOST_H / 2}px)`;
      g.setAttribute("data-insert-pitch", "es");
      return;
    }
    g.style.borderRadius = "50%";
    // The rotation rides along in the same property — assigning `transform` replaces all of it.
    g.style.transform =
      `translate(${at.x - GHOST_W / 2}px, ${b.topLineY + spot.steps * DRAG_PX_PER_STEP - GHOST_H / 2}px) rotate(-20deg)`;
    g.setAttribute("data-insert-pitch", `${spot.letter}${spot.octave}`);
  }

  function hideGhost() {
    const g = ghostRef.current;
    if (!g) return;
    g.style.display = "none";
    g.removeAttribute("data-insert-pitch");
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
        data-tuplet-anchor={editMode && tupletAnchor != null ? tupletAnchor : undefined}
        data-repeat-anchor={editMode && repeatAnchor != null ? repeatAnchor : undefined}
        data-tuplet-selected={tupletSel ? tupletSel.members[0] : undefined}
        // Whether the page chases the playhead. On the SHEET as well as on the checkbox, because
        // the checkbox only proves the control was clicked — this says what the sheet will do.
        data-follow={followPlayhead ? "on" : "off"}
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
        {/* Playhead: a teal bar that tracks the currently-playing note (positioned via transform).
            `data-omr` so a check can read WHERE playback started — an attribute saying which bar
            Çal aims at cannot prove the audio actually began there. */}
        <div
          ref={cursorRef}
          data-omr="playhead"
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
            {/* Measure targets, underneath the note targets. What an empty click does depends on
                what is armed: a NOTE VALUE inserts a note right there (step 6 — pitch from the
                click's height, duration from the tool); an ACCIDENTAL or the TUPLET does nothing,
                because neither has anything to attach to; with nothing armed it clears the
                selection. ⚠ It used to open the per-measure modal — deleted 2026-08-08, so a click
                on blank staff can no longer produce a window over the score.
                ⚠ NO hover highlight here (owner, 2026-08-07). Editing is whole-score, so framing a
                measure says the wrong thing about what a click does — and it also cost a re-render
                per mouse-move across the sheet. The note boxes below carry the only hover state
                edit mode has; the insert ghost moves without one. */}
            {boxes.map((b) => (
              <div
                key={b.index}
                onClick={(e) => {
                  if (armedTool === "duration") {
                    const at = localXY(e);
                    if (at) onInsertNote?.(insertAt(b, at));
                    return;
                  }
                  // A SIGN belongs to the BAR, so anywhere in it will do — including on top of a
                  // note, which is why the note targets go pointer-transparent while one is armed.
                  // ⚠ Except the REPEAT: its two signs sit ON barlines, so it has its own targets
                  // and a click in the middle of a bar means nothing to it.
                  if (armedTool === "structure") {
                    if (armedSign !== "repeat") onPlaceMark?.(b.index);
                    return;
                  }
                  if (armedTool) return; // an accidental (or the tuplet) needs a note
                  onSelectNote?.(null);
                }}
                onMouseMove={armedTool === "duration" ? (e) => moveGhost(b, e) : undefined}
                onMouseLeave={armedTool === "duration" ? hideGhost : undefined}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y - 30,
                  width: b.width,
                  height: ROW_HEIGHT - 16,
                  pointerEvents: "auto",
                  cursor: armedTool === "duration" ? "copy" : "default",
                  boxSizing: "border-box",
                }}
              />
            ))}
            {/* Bars that do not add up (editor step 8). An INDICATOR, never a block: an edit
                absorbs into its bar and bar lines never move, so over- and under-full bars are
                ordinary, reachable states of the document — a triplet makes one every time.
                ⚠ The reference is the DERIVED METER (see `barFill`), not `Measure.lengthBeats`.
                Drawn in the overlay, never in the SVG: the engraving may not move. */}
            {boxes.map((b) => {
              const fill = barFill.get(b.index);
              if (!fill) return null;
              const beats = measureBeats(b.measure.events);
              const meter = timeSig ? `${timeSig.num}/${timeSig.den}` : "";
              return (
                <div
                  key={`fill_${b.index}`}
                  data-omr="bar-warning"
                  data-bar={b.index}
                  data-bar-fill={fill}
                  className={`kv-bar-warn kv-bar-warn--${fill}`}
                  title={
                    fill === "over"
                      ? TR.bar.over(beats.toFixed(3), meter)
                      : TR.bar.under(beats.toFixed(3), meter)
                  }
                  // Just above the top staff line at the bar's right edge — `b.y` is the stave's
                  // bounding box, which starts a whole STAVE_TOP_PAD higher and reads as floating
                  // over the system rather than belonging to the bar.
                  style={{ position: "absolute", left: b.x + b.width - 20, top: b.topLineY - 24 }}
                >
                  {fill === "over" ? "+" : "−"}
                </div>
              );
            })}
            {/* The insert preview. One element for the whole sheet, parked until a note value is
                armed and the pointer is over a bar; `moveGhost` positions it and names the pitch
                it would produce. */}
            <div
              ref={ghostRef}
              data-omr="insert-ghost"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: GHOST_W,
                height: GHOST_H,
                borderRadius: "50%",
                background: "rgba(20,184,166,0.45)",
                border: "1px solid #14b8a6",
                boxSizing: "border-box",
                transform: "rotate(-20deg)", // a notehead leans, and it reads as one at this size
                pointerEvents: "none",
                display: "none",
                willChange: "transform",
              }}
            />
            {/* Note targets. A tie-split event has two boxes sharing one evIndex; both highlight
                when it is selected, and either one selects it. */}
            {noteBoxes.map((nb, i) => {
              const on = selectedNote != null && nb.evIndex === selectedNote;
              // Tuplet armed: what this note would do, and whether it can be clicked at all. A
              // tie-split event owns two boxes sharing one evIndex; both read the same state.
              const tup = tupletStates.get(nb.evIndex);
              // A note inside a triplet is not a target: the SIGN above it is (owner, 2026-08-30).
              // It keeps its `member` state so the DOM still says where the triplets are.
              // A held triplet marks its own three notes, and every note either handle could be
              // dragged onto. A landing is shown but NOT made clickable: the handles do the moving,
              // and a click that also moved the group would make "which end?" ambiguous.
              const heldMember = tupletSel?.members.includes(nb.evIndex) === true;
              const landing = tupletSel?.all.get(nb.evIndex);
              const isFix = tupletSel?.fixes.has(nb.evIndex) === true;
              // ⚠ TWO SEPARATE THINGS, and merging them was a live bug. `refused` is the TUPLET
              // tool saying "not this note" — it greys the note, which is how the page refuses
              // instead of popping an error. `dead` is only about pointer-events, and a SIGN tool
              // makes every note pointer-transparent because a sign goes on a BAR: the click has to
              // reach the measure box underneath, wherever in the bar it lands. Written as one
              // flag, arming any sign greyed out the whole score.
              const refused = tup === "blocked" || tup === "member";
              const dead = refused || armedTool === "structure";
              return (
                <div
                  key={`${nb.evIndex}_${i}`}
                  className={
                    `kv-note-hit${on ? " is-selected" : ""}${armed ? " is-armed" : ""}` +
                    `${refused ? " is-dim" : ""}${tup === "anchor" ? " is-anchor" : ""}` +
                    `${heldMember ? " is-tuplet-held" : ""}${landing ? " is-tuplet-landing" : ""}` +
                    `${isFix ? " is-tuplet-fix" : ""}`
                  }
                  data-omr-note={nb.evIndex}
                  data-selected={on ? "1" : undefined}
                  data-tuplet={tup}
                  data-tuplet-held={heldMember ? "1" : undefined}
                  data-tuplet-landing={landing}
                  data-tuplet-fix={isFix ? "1" : undefined}
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
                    // A note the tuplet tool would refuse is not a target at all — the click falls
                    // through to the measure box below, which with a tool armed does nothing.
                    pointerEvents: dead ? "none" : "auto",
                    cursor: armed ? "copy" : "grab",
                    touchAction: "none", // or the browser pans the page instead of dragging
                  }}
                />
              );
            })}
            {/* The drawn "3" marks, as click targets (owner, 2026-08-30: *"direkt olarak 3'leme
                işaretinin tıklanabilir olmasını istiyorum. notalarına tıklamak istemiyorum"*).
                Clicking the SIGN holds its tuplet. Every drawn mark gets one, a broken mark included
                — that is the one most in need of a correction. The box is measured off the ink that
                was engraved (see `markBoxOf`), so it lands on the mark a reader sees whichever of the
                four styles this piece drew.
                ⚠ These render in plain **Seçim** as well as with the tuplet armed (see
                `tupletPickable`), and they are painted AFTER the note targets on purpose — a later
                sibling wins an overlapping click. They started out before them, and in Seçim (where
                a note IS clickable, unlike under the tuplet tool) a note's box swallowed the mark
                outright: VexFlow's box reaches along the stem, past the noteheads, into the strip of
                staff the mark is drawn in. The mark wins there because it is the smaller, more
                specific target and it sits on the NOTEHEAD side, opposite the stems — so the region
                they fight over is stem, never notehead. `smoke:editor` holds the other half of that
                bargain: no note's CENTRE may fall inside a mark's box. */}
            {tupletPickable &&
              tupletMarks.map((mk) => (
                <div
                  key={`tupmark_${mk.evIndex}`}
                  data-omr="tuplet-mark-hit"
                  data-tuplet-group={mk.evIndex}
                  data-tuplet-mark={mk.closes ? "closed" : "broken"}
                  data-held={selectedTuplet === mk.evIndex ? "1" : undefined}
                  className={
                    `kv-tuplet-mark-hit${mk.closes ? "" : " is-broken"}` +
                    `${selectedTuplet === mk.evIndex ? " is-held" : ""}`
                  }
                  title={mk.closes ? TR.sheet.pickTuplet : TR.sheet.pickBrokenTuplet}
                  onClick={(e) => { e.stopPropagation(); onTupletPick?.(mk.evIndex); }}
                  style={{
                    position: "absolute",
                    left: mk.x - MARK_HIT_PAD,
                    top: mk.y - MARK_HIT_PAD,
                    width: mk.width + 2 * MARK_HIT_PAD,
                    height: mk.height + 2 * MARK_HIT_PAD,
                    pointerEvents: "auto",
                    cursor: "pointer",
                  }}
                />
              ))}
            {/* THE STRUCTURE SIGNS (owner, 2026-09-03). Two kinds of ink, and one of them is not on
                the staff at all.

                ⚠ These are DELETE targets, live only in Seçim. With a sign tool armed every click
                places one — "armed places, Seçim removes" — so a target here would make clicking an
                existing `‖:` mean two different things depending on what is in your hand.

                ⚠ Painted after the note targets for the same reason the tuplet marks are: a later
                sibling wins the overlap, and a repeat barline sits exactly where a note's box
                reaches. They are narrow and sit ON the barline, so what they take from a note is
                the sliver of staff no notehead occupies.

                ⚠ `openRepeat` is the odd one: a `‖:` with nothing closing it is deliberately absent
                from the engraved staff (`repeatSpansFromStructure` will not promise a repeat the
                music does not take), so edit mode draws it here, dashed. Outside edit mode it is
                invisible and the page is unchanged — which is the whole point. */}
            {armedTool == null &&
              signTargets?.map((t) => {
                const b = boxes.find((bx) => bx.index === t.bar);
                if (!b) return null;
                const bar = t.mark === "repStart" || t.mark === "repEnd";
                const box = bar
                  ? {
                      left: (t.at === "end" ? b.x + b.width : b.x) - SIGN_HIT_W / 2,
                      top: b.topLineY - SIGN_HIT_PAD,
                      width: SIGN_HIT_W,
                      height: 4 * STAFF_SPACE + 2 * SIGN_HIT_PAD,
                    }
                  : t.at === "above"
                    // ⚠ Short of the bar's right edge by `BAR_WARN_W`: the off-meter `+`/`−` badge
                    // sits there, in the same band, and this target paints later — taking the whole
                    // width would swallow the one tooltip that explains a bar that does not add up.
                    ? { left: b.x, top: b.topLineY - VOLTA_ABOVE - 4, width: Math.max(20, b.width - BAR_WARN_W), height: 20 }
                    : {
                        left: t.at === "end" ? b.x + b.width - NAV_HIT_W : b.x,
                        top: b.topLineY - NAV_HIT_H - 4,
                        width: NAV_HIT_W,
                        height: NAV_HIT_H,
                      };
                return (
                  <div
                    key={`sign_${t.bar}_${t.mark}`}
                    data-omr="sign-hit"
                    data-bar={t.bar}
                    data-sign={t.mark}
                    className="kv-sign-hit"
                    title={TR.sheet.removeSign}
                    onClick={(e) => { e.stopPropagation(); onRemoveMark?.(t.bar, t.mark); }}
                    style={{ position: "absolute", ...box, pointerEvents: "auto", cursor: "pointer" }}
                  />
                );
              })}
            {/* THE REPEAT'S BARLINE TARGETS (owner, 2026-09-03: *"ölçüye değil de barline lara
                tıklayabilsin kullanıcı"*). Two clicks, and they are on the two lines a repeat is
                actually printed on: a bar's OPENING line carries `‖:`, its CLOSING line carries
                `:‖`. That is also what makes the gesture unambiguous — the phases target different
                lines, so "the same place twice" is not a state that has to be given a meaning.

                ⚠ Unlike the delete chips these are VISIBLE while the tool is armed: an invisible
                target teaches nothing, and the user has to see which lines are on offer. Phase 2
                dims every line at or before the anchor (`data-repeat-edge-state="blocked"`) and
                makes it inert — a repeat cannot close where it opened or earlier. */}
            {armedTool === "structure" && armedSign === "repeat" &&
              boxes.map((b) => {
                const opening = repeatAnchor == null;
                const blocked = !opening && b.index < repeatAnchor!;
                return (
                  <div
                    key={`repedge_${b.index}`}
                    data-omr="repeat-edge"
                    data-bar={b.index}
                    data-edge={opening ? "start" : "end"}
                    data-repeat-edge-state={blocked ? "blocked" : "open"}
                    className={`kv-repeat-edge${blocked ? " is-blocked" : ""}`}
                    title={opening ? TR.sheet.repeatFrom : TR.sheet.repeatTo}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!blocked) onRepeatEdge?.(b.index, opening ? "start" : "end");
                    }}
                    style={{
                      position: "absolute",
                      // The opening line is the bar's left edge, the closing line its right — the
                      // same two places VexFlow puts `‖:` and `:‖`.
                      left: (opening ? b.x : b.x + b.width) - SIGN_HIT_W / 2,
                      top: b.topLineY - SIGN_HIT_PAD,
                      width: SIGN_HIT_W,
                      height: 4 * STAFF_SPACE + 2 * SIGN_HIT_PAD,
                      pointerEvents: blocked ? "none" : "auto",
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            {/* The pending `‖:`. Dashed, because nothing is in the document yet — the repeat is
                committed only by the second click. Clicking it takes the gesture back. */}
            {(() => {
              if (repeatAnchor == null) return null;
              const b = boxes.find((bx) => bx.index === repeatAnchor);
              if (!b) return null;
              return (
                <div
                  data-omr="repeat-anchor"
                  data-bar={repeatAnchor}
                  className="kv-open-repeat is-anchor"
                  title={TR.sheet.repeatCancel}
                  onClick={(e) => { e.stopPropagation(); onRepeatCancel?.(); }}
                  style={{
                    position: "absolute",
                    left: b.x - 2,
                    top: b.topLineY - SIGN_HIT_PAD,
                    width: 4,
                    height: 4 * STAFF_SPACE + 2 * SIGN_HIT_PAD,
                    pointerEvents: "auto",
                    cursor: "pointer",
                  }}
                />
              );
            })()}
            {(() => {
              if (openRepeat == null) return null;
              const b = boxes.find((bx) => bx.index === openRepeat);
              if (!b) return null;
              return (
                <div
                  data-omr="open-repeat"
                  data-bar={openRepeat}
                  className="kv-open-repeat"
                  title={TR.sheet.openRepeat}
                  onClick={(e) => { e.stopPropagation(); if (armedTool == null) onRemoveMark?.(openRepeat, "repStart"); }}
                  style={{
                    position: "absolute",
                    left: b.x - 2,
                    top: b.topLineY - SIGN_HIT_PAD,
                    width: 4,
                    height: 4 * STAFF_SPACE + 2 * SIGN_HIT_PAD,
                    pointerEvents: armedTool == null ? "auto" : "none",
                    cursor: armedTool == null ? "pointer" : "default",
                  }}
                />
              );
            })()}
            {/* The held triplet (editor step 7b): a frame round its three notes, a handle at each
                end, and the ✕ that takes the bracket off.
                ⚠ Nothing here is stored — `tupletSel` re-derives the group from the document every
                render — so an undo or a re-valued member simply stops drawing all of it.
                On a REAL triplet the handles slide the group without ever growing it, because the
                drawn digit is a hardcoded "3" and the label token is `\tup3`; on a BROKEN mark they
                repair it — the grabbed end moves and the other stays. `tupletEdgeTo` owns both. */}
            {(() => {
              if (!tupletSel || !onTupletEdge) return null;
              const held = tupletSel.members.map(boxOf).filter((b): b is NoteBox => b != null);
              // ⚠ Every member must have a box, and there may be ONE of them: a broken mark can
              // cover a single note. Testing for three here left every broken mark frameless and
              // handleless — held, with nothing on screen to say so.
              if (held.length === 0 || held.length !== tupletSel.members.length) return null;
              const first = held[0]!;
              const last = held[held.length - 1]!;
              const top = Math.min(...held.map((b) => b.y)) - NOTE_HIT_PAD;
              const bottom = Math.max(...held.map((b) => b.y + b.height)) + NOTE_HIT_PAD;
              const left = first.x - NOTE_HIT_PAD;
              const right = last.x + last.width + NOTE_HIT_PAD;
              const handle = (edge: "start" | "end") => (
                <div
                  key={`tuplet-handle-${edge}`}
                  data-omr="tuplet-handle"
                  data-edge={edge}
                  data-can-move={tupletSel.targets[edge].length > 0 ? "1" : "0"}
                  className="kv-tuplet-handle"
                  title={tupletSel.closes ? TR.sheet.tupletHandle : TR.sheet.tupletHandleFix}
                  aria-label={tupletSel.closes ? TR.sheet.tupletHandle : TR.sheet.tupletHandleFix}
                  onPointerDown={(e) => onHandleDown(e, edge)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={onHandleUp}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    left: edge === "start" ? left - TUPLET_HANDLE_W - 1 : right + 1,
                    top,
                    width: TUPLET_HANDLE_W,
                    height: bottom - top,
                    pointerEvents: "auto",
                    // Inline, not CSS: an inline cursor would win over the class either way, so
                    // the disabled state has to be decided in the same place.
                    cursor: tupletSel.targets[edge].length > 0 ? "ew-resize" : "not-allowed",
                    touchAction: "none", // or the browser pans the page instead of dragging
                  }}
                />
              );
              return (
                <>
                  <div
                    data-omr="tuplet-frame"
                    data-tuplet-mark={tupletSel.closes ? "closed" : "broken"}
                    className={`kv-tuplet-frame${tupletSel.closes ? "" : " is-broken"}`}
                    style={{ position: "absolute", left, top, width: right - left, height: bottom - top }}
                  />
                  {handle("start")}
                  {handle("end")}
                  {onTupletRemove && (
                    <button
                      id="tuplet-remove"
                      type="button"
                      title={TR.sheet.removeTuplet}
                      aria-label={TR.sheet.removeTuplet}
                      onClick={(e) => { e.stopPropagation(); onTupletRemove(); }}
                      style={{
                        position: "absolute",
                        left: (left + right) / 2 - 10,
                        top: top - 24,
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
                  )}
                </>
              );
            })()}
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
