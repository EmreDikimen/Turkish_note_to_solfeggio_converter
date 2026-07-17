/**
 * Notation helpers: turn a SymbTr note name into staff position + the correct Turkish
 * (AEU) accidental glyph.
 *
 * Background: SymbTr note names encode the microtonal alteration as a `#N`/`bN` suffix, where N
 * is the exact alteration in commas (verified against Koma53). Classical / Turkish ART music
 * notates every microtonal pitch with ONLY the four standard Arel-Ezgi-Uzdilek accidentals
 * (SMuFL U+E440–E447): koma (±1), bakiye (±4), küçük mücennep (±5), büyük mücennep (±8).
 * The numbered ±2/±3 "folk" signs are NOT used in art music, so the engraved STAFF snaps any
 * non-AEU alteration to the nearest AEU sign (`toAeuAlter`) — the exact koma (sounding pitch) is
 * kept; the written sign just follows the makam convention (a 2-comma flat is drawn as a koma flat
 * / segah bemolü, which the decoder later resolves back per makam). The EDITOR, by contrast, shows
 * and edits the exact alteration/koma the user wants, so `accidentalGlyph`/`accidentalLabel` are
 * raw (no snapping) and only the sheet-drawing call sites apply `toAeuAlter`.
 */

import type { NoteModelDocument } from "./types";

/** Turkish solfege → Western letter (for staff positioning). */
const SOLFEGE_TO_LETTER: Record<string, string> = {
  Do: "C",
  Re: "D",
  Mi: "E",
  Fa: "F",
  Sol: "G",
  La: "A",
  Si: "B",
};

/** Diatonic step index within an octave, C=0 .. B=6 (used for vertical staff position). */
const LETTER_STEP: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** Western letter → Turkish solfege (for writing note names back out). */
const LETTER_TO_SOLFEGE: Record<string, string> = {
  C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si",
};

/** Comma value of each natural pitch-class within an octave (C=0). Sums to 53 at the next C. */
const PC_COMMA: Record<string, number> = { C: 0, D: 9, E: 18, F: 22, G: 31, A: 40, B: 49 };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

export interface ParsedNote {
  /** Western letter C..B. */
  letter: string;
  /** Octave number from the name (SymbTr's scientific-ish numbering). */
  octave: number;
  /** Signed comma alteration: +N for `#N`, -N for `bN`, 0 if none. */
  alterCommas: number;
  /**
   * Diatonic position as a single increasing integer (letter step + 7*octave). Two notes
   * one staff line apart differ by 1; an octave differs by 7. Convenient for y-layout.
   */
  diatonic: number;
}

const NAME_RE = /^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])(-?\d+)([#b]\d+)?$/;

/**
 * Parse a note name like "Do5", "Sol5#1", "La4b4", or "C5#3" into staff/accidental info.
 *
 * What/why: the sheet view needs (a) where to draw the notehead — from letter+octave — and
 * (b) which accidental — from the suffix. Centralizing the parsing here keeps the renderer
 * and the edit modal consistent.
 * Returns null for rests ("Es") or anything unparseable, so callers can skip them.
 */
export function parseNoteName(name: string): ParsedNote | null {
  const m = NAME_RE.exec(name.trim());
  if (!m) return null;
  const [, base, octaveStr, accStr] = m;
  const letter = SOLFEGE_TO_LETTER[base!] ?? base!;
  if (!(letter in LETTER_STEP)) return null;
  const octave = parseInt(octaveStr!, 10);
  let alterCommas = 0;
  if (accStr) {
    const n = parseInt(accStr.slice(1), 10);
    alterCommas = accStr[0] === "#" ? n : -n;
  }
  return { letter, octave, alterCommas, diatonic: LETTER_STEP[letter]! + 7 * octave };
}

/** Absolute Holdrian comma of a natural pitch (no accidental), e.g. naturalKoma("C",5)=318. */
export function naturalKoma(letter: string, octave: number): number {
  return 53 * (octave + 1) + (PC_COMMA[letter] ?? 0);
}

/** Absolute comma of a spelled note = its natural pitch plus the comma alteration. */
export function komaOf(letter: string, octave: number, alterCommas: number): number {
  return naturalKoma(letter, octave) + alterCommas;
}

/**
 * Build a note name from an explicit spelling (letter + octave + comma alteration).
 * Unlike `komaToName`, this preserves exactly the spelling the user chose (so picking
 * "Fa5" + "+5 commas" yields "Fa5#5", never the enharmonic "Sol5b4").
 * @param style "solfege" → Do/Re/Mi…; "western" → C/D/E…
 */
export function spellNote(letter: string, octave: number, alterCommas: number, style: "solfege" | "western" = "solfege"): string {
  const base = style === "western" ? letter : LETTER_TO_SOLFEGE[letter] ?? letter;
  const suffix = alterCommas > 0 ? `#${alterCommas}` : alterCommas < 0 ? `b${-alterCommas}` : "";
  return `${base}${octave}${suffix}`;
}

/**
 * Inverse of parseNoteName: spell an absolute comma value (Koma53) as a note name.
 *
 * What/why: when the user edits a note's pitch in the modal, its `koma53` changes, so its
 * written name (which encodes the accidental) must be regenerated, or the staff would still
 * draw the old notehead/accidental. We pick the spelling with the **smallest comma
 * alteration** (the most natural enharmonic), which reproduces SymbTr's own spellings
 * (e.g. 321→"Do5#3", 301→"La4b4").
 *
 * @param style "solfege" → Do/Re/Mi… (matches `noteName`); "western" → C/D/E… (matches `noteAE`).
 */
export function komaToName(koma: number, style: "solfege" | "western" = "solfege"): string {
  const block = Math.floor(koma / 53);
  let best: { letter: string; octave: number; alter: number } | null = null;
  for (let o = block - 2; o <= block + 1; o++) {
    for (const letter of LETTERS) {
      const natural = 53 * (o + 1) + PC_COMMA[letter]!;
      const alter = koma - natural;
      if (Math.abs(alter) > 8) continue;
      if (!best || Math.abs(alter) < Math.abs(best.alter)) best = { letter, octave: o, alter };
    }
  }
  if (!best) return ""; // out of representable range
  const base = style === "western" ? best.letter : LETTER_TO_SOLFEGE[best.letter]!;
  const suffix = best.alter > 0 ? `#${best.alter}` : best.alter < 0 ? `b${-best.alter}` : "";
  return `${base}${best.octave}${suffix}`;
}

export interface AccidentalGlyph {
  /** SMuFL glyph name (matches Bravura's glyphnames.json). */
  name: string;
  /** Unicode code point to render in the Bravura font. */
  codepoint: number;
}

// Every renderable accidental, keyed by signed comma alteration: the four AEU pairs (U+E440–E447)
// used on the engraved staff, PLUS the numbered ±2/±3 "folk" glyphs (U+E451/E452/E455/E456). The
// folk glyphs exist so the EDITOR can show a note's exact alteration; the sheet itself never draws
// them — sheet callers snap to AEU via `toAeuAlter` first.
const GLYPHS: Record<number, AccidentalGlyph> = {
  1: { name: "accidentalKomaSharp", codepoint: 0xe444 },
  2: { name: "accidental2CommaSharp", codepoint: 0xe451 },
  3: { name: "accidental3CommaSharp", codepoint: 0xe452 },
  4: { name: "accidentalBakiyeSharp", codepoint: 0xe445 },
  5: { name: "accidentalKucukMucennebSharp", codepoint: 0xe446 },
  8: { name: "accidentalBuyukMucennebSharp", codepoint: 0xe447 },
  [-1]: { name: "accidentalKomaFlat", codepoint: 0xe443 },
  [-2]: { name: "accidental2CommaFlat", codepoint: 0xe455 },
  [-3]: { name: "accidental3CommaFlat", codepoint: 0xe456 },
  [-4]: { name: "accidentalBakiyeFlat", codepoint: 0xe442 },
  [-5]: { name: "accidentalKucukMucennebFlat", codepoint: 0xe441 },
  [-8]: { name: "accidentalBuyukMucennebFlat", codepoint: 0xe440 },
};

// AEU accidental magnitudes in Holdrian commas: koma=1, bakiye=4, küçük=5, büyük mücennep=8.
const AEU_MAGNITUDES = [1, 4, 5, 8];

/**
 * Snap a comma alteration to the nearest AEU accidental (sign preserved; 0 stays natural).
 * Art music writes every microtonal pitch with one of the four standard signs, never a numbered
 * ±2/±3, so e.g. a 2-comma flat → koma flat (segah bemolü), a 3-comma sharp → bakiye diyezi. The
 * exact koma (sounding pitch) is kept; this only governs the WRITTEN sign. Use it at SHEET-drawing
 * call sites — NOT in the editor, which must show/keep the exact alteration the user chose.
 */
export function toAeuAlter(commas: number): number {
  if (commas === 0) return 0;
  const mag = Math.abs(commas);
  let best = AEU_MAGNITUDES[0]!;
  for (const m of AEU_MAGNITUDES) if (Math.abs(m - mag) < Math.abs(best - mag)) best = m;
  return commas < 0 ? -best : best;
}

/**
 * Map a comma alteration to its glyph EXACTLY (no snapping), so the editor can show the true
 * alteration (incl. a numbered ±2/±3). Returns null for 0 (natural) and any value without a glyph.
 * For the engraved staff, pass an AEU-snapped value (`toAeuAlter`) — see `buildStaveNotes`.
 */
export function accidentalGlyph(alterCommas: number): AccidentalGlyph | null {
  return GLYPHS[alterCommas] ?? null;
}

const NAMED: Record<number, string> = { 1: "koma", 4: "bakiye", 5: "küçük mücennep", 8: "büyük mücennep" };

/**
 * Human-readable Turkish name of an accidental, for the edit modal and the legend.
 * Examples: +1 → "koma diyezi", -4 → "bakiye bemolü", +2 → "2 koma diyezi".
 */
export function accidentalLabel(alterCommas: number): string {
  if (alterCommas === 0) return "natural";
  const dir = alterCommas > 0 ? "diyezi" : "bemolü"; // sharp / flat
  const mag = Math.abs(alterCommas);
  const base = NAMED[mag] ?? `${mag} koma`;
  return `${base} ${dir}`;
}

export interface KeySignatureEntry {
  /** Western letter C..B the accidental applies to (all octaves). */
  letter: string;
  /** Signed comma alteration carried by that letter throughout the score. */
  alterCommas: number;
}

/**
 * Derive a "key signature" for a score: the prevailing accidental of each pitch letter, so the
 * sheet view can draw it once at the start of a staff (like a makam signature) instead of on
 * every note.
 *
 * What/why: Turkish scores, like Western ones, hoist the recurring accidentals into a signature
 * and only mark notes that deviate. We approximate the signature from the data itself: for each
 * letter (C..B), take the accidental it carries **most often**, keeping it only if it's non-zero
 * (a natural is the absence of a signature entry). Returned in PRINTED signature order —
 * flats B-E-A-D-G-C-F first, then sharps F-C-G-D-A-E-B — the convention Turkish editions
 * print (confirmed against the notaarsivleri majority-voted signatures, 2026-07-16); the
 * emitter's printed-signature override still wins where a page's drawn order differs.
 */
export function deriveKeySignature(doc: NoteModelDocument): KeySignatureEntry[] {
  // letter -> (alterCommas -> count)
  const counts: Record<string, Map<number, number>> = {};
  for (const ev of doc.events) {
    if (ev.kind !== "note") continue;
    const p = parseNoteName(ev.noteName);
    if (!p) continue;
    const byAlter = (counts[p.letter] ??= new Map());
    const a = toAeuAlter(p.alterCommas); // signature uses standard AEU signs only
    byAlter.set(a, (byAlter.get(a) ?? 0) + 1);
  }

  const entries: KeySignatureEntry[] = [];
  for (const letter of LETTERS) {
    const byAlter = counts[letter];
    if (!byAlter) continue;
    let bestAlter = 0;
    let bestCount = -1;
    for (const [alter, count] of byAlter) {
      if (count > bestCount) {
        bestCount = count;
        bestAlter = alter;
      }
    }
    if (bestAlter !== 0) entries.push({ letter, alterCommas: bestAlter });
  }
  const FLATS = ["B", "E", "A", "D", "G", "C", "F"];
  const SHARPS = ["F", "C", "G", "D", "A", "E", "B"];
  entries.sort((x, y) => {
    const xf = x.alterCommas < 0 ? 0 : 1;
    const yf = y.alterCommas < 0 ? 0 : 1;
    if (xf !== yf) return xf - yf; // flats before sharps
    const order = xf === 0 ? FLATS : SHARPS;
    return order.indexOf(x.letter) - order.indexOf(y.letter);
  });
  return entries;
}
