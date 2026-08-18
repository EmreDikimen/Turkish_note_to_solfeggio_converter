/**
 * Round-3 Lever 4 (renderer diversity): OUR STRIP LABEL → REAL LILYPOND SOURCE.
 *
 * WHY THIS FILE EXISTS. Every one of the 40,826 synthetic strips was engraved by VexFlow + Bravura
 * at a staff spacing whose standard deviation is zero (docs/rung3/levers.md, Lever 4). LilyPond is a
 * second engraver — different spacing engine, different font (Emmentaler), different beaming and
 * bracket conventions — and it ships `makam.ly`, which defines the SAME eight AEU accidentals we
 * draw, with the same comma→glyph convention (checked 2026-08-18: koma = mirrored flat / 1-stem
 * 2-bar sharp, bakiye = slashed flat / plain sharp, küçük = plain flat / 1-stem 3-bar, büyük =
 * double-slashed flat / 2-stem 3-bar; identical to `packages/core/src/notation.ts`). So a second
 * domain costs no new labelling — only this translation.
 *
 * ⚠ THE HARD RULE IS PIXELS == LABELS (../../CLAUDE.md). This file does NOT re-decide what to draw:
 * it takes a label that `tools/render/lilypond.ts` already produced and renders exactly that. The
 * label is the complete description of what must appear (that is what "faithful" means), so the
 * translation is mechanical:
 *
 *   - a note WITH an accidental token → written at that alteration and FORCED with `!`;
 *   - a note WITHOUT one → written at the alteration the drawn key signature already shows for its
 *     letter (natural if the strip draws no signature), so nothing prints;
 *   - `\accidentalStyle "forget"` so LilyPond keeps NO memory of its own: the print decision is then
 *     purely "differs from the key signature", which the two rules above pin exactly.
 *
 * The written pitch is therefore the pitch a READER of our picture would infer, which is all a
 * training image needs — it is never played, and a suppressed accidental cannot move a notehead
 * (staff position comes from the letter and octave alone).
 *
 * ⚠ Two things this file deliberately refuses rather than approximates:
 *   - repeat/volta/navigation tokens (`\repstart`, `\volta1`, `\segno`, …) throw. LilyPond expresses
 *     those through `\repeat volta`, which restructures the music rather than drawing a sign where
 *     the label puts one; a half-built version would fail the gate in a way that reads like an
 *     engraving bug. The pilot's labels are generated without them (render-ly.ts passes no spans).
 *   - a measure whose written durations do not sum to a power-of-two fraction throws, instead of
 *     rounding into a `\time` LilyPond would then disagree with.
 *
 * The time signature is computed per measure from the label's own durations and drawn with
 * `\omit Staff.TimeSignature` — invisible, but it makes LilyPond place the barline where the label's
 * `|` is and beam by that meter. The `|` bar checks are the independent audit of that arithmetic:
 * if the sum is wrong, LilyPond warns and render-ly.ts fails the strip.
 */

import {
  AEU_TOKEN,
  NATURAL_TOKEN,
  SIG_TOKEN,
  SIG_END_TOKEN,
  REP_START_TOKEN,
  REP_END_TOKEN,
  VOLTA1_TOKEN,
  VOLTA2_TOKEN,
  SEGNO_TOKEN,
  CODA_TOKEN,
  DC_TOKEN,
  FINE_TOKEN,
  TUP3_TOKEN,
  TUP_END_TOKEN,
  TIE_TOKEN,
  GRACE_TOKEN,
} from "./lilypond";

/** Comma alteration → the `makam.ly` pitch-name suffix. `makam.ly` spells the alteration into the
 *  note name itself (c = C natural, cc = koma sharp, cb = bakiye sharp, ck = küçük, cbm = büyük,
 *  and the same four with an `f` for the flats), so there is no separate accidental syntax. */
export const MAKAM_SUFFIX: Record<number, string> = {
  0: "",
  1: "c", 4: "b", 5: "k", 8: "bm",
  [-1]: "fc", [-4]: "fb", [-5]: "fk", [-8]: "fbm",
};

/** Label accidental token → comma alteration (the inverse of lilypond.ts's `AEU_TOKEN`). */
export const ALTER_OF_TOKEN: Record<string, number> = Object.fromEntries([
  ...Object.entries(AEU_TOKEN).map(([commas, tok]) => [tok, Number(commas)]),
  [NATURAL_TOKEN, 0],
]);

/** Tokens the label language has and this translator refuses — see the header. */
const UNSUPPORTED = new Set([
  REP_START_TOKEN, REP_END_TOKEN, VOLTA1_TOKEN, VOLTA2_TOKEN,
  SEGNO_TOKEN, CODA_TOKEN, DC_TOKEN, FINE_TOKEN,
]);

const NOTE_RE = /^([a-g])([',]*)(\d+)(\.{0,2})$/;
const REST_RE = /^r(\d+)(\.{0,2})$/;

// -------------------------------------------------------------------------------------------
// Exact rational arithmetic over written durations. Powers of two, times 2/3 inside a triplet —
// so a plain `number` would accumulate the drift that a bar check exists to catch.

interface Frac { n: number; d: number }
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const frac = (n: number, d: number): Frac => {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return { n: n / g, d: d / g };
};
const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);

/** `4` → 1/4, `8.` → 3/16, `16..` → 7/64 — the written value of one duration token. */
function durationFrac(den: string, dots: string): Frac {
  let v = frac(1, Number(den));
  let extra = frac(0, 1);
  let half = v;
  for (let i = 0; i < dots.length; i++) {
    half = mul(half, frac(1, 2));
    extra = add(extra, half);
  }
  return add(v, extra);
}

// -------------------------------------------------------------------------------------------
// Parse

interface LyNote {
  kind: "note" | "rest";
  /** LilyPond pitch text without the duration, e.g. `cfk''` or `r`. */
  letter: string;
  octave: string;
  /** The alteration the label PRINTS on this note, or null when it prints none. */
  printed: number | null;
  dur: string;
  frac: Frac;
  tieAfter: boolean;
}

interface LyTuplet { kind: "tuplet"; members: LyNote[] }
interface LyGrace { kind: "grace"; notes: LyNote[] }
type LyItem = LyNote | LyTuplet | LyGrace;

export interface SigEntry { letter: string; alterCommas: number }

export interface ParsedStrip {
  /** The drawn key signature, or null when the strip shows none (no `\sig` block in the label). */
  sig: SigEntry[] | null;
  measures: LyItem[][];
  /** Every accidental the label says is drawn, in reading order — signature block first.
   *  The gate compares this against what LilyPond actually put in the SVG. */
  accidentals: string[];
}

/** Split a strip label into the structure the emitter needs. Throws on anything it cannot draw. */
export function parseLabel(label: string): ParsedStrip {
  const toks = label.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  let sig: SigEntry[] | null = null;
  const accidentals: string[] = [];

  if (toks[i] === SIG_TOKEN) {
    sig = [];
    i++;
    while (i < toks.length && toks[i] !== SIG_END_TOKEN) {
      const tok = toks[i]!;
      const alter = ALTER_OF_TOKEN[tok];
      if (alter === undefined || alter === 0) throw new Error(`bad signature token '${tok}'`);
      const letter = toks[i + 1];
      if (!letter || !/^[a-g]$/.test(letter)) throw new Error(`'${tok}' not followed by a letter`);
      sig.push({ letter: letter.toUpperCase(), alterCommas: alter });
      accidentals.push(tok);
      i += 2;
    }
    if (toks[i] !== SIG_END_TOKEN) throw new Error("unterminated \\sig block");
    i++;
  }

  const measures: LyItem[][] = [[]];
  let pendingAlter: number | null = null;
  let pendingToken: string | null = null;

  /** The note/rest token at `i`, carrying whatever accidental token preceded it. */
  const takeNote = (): LyNote => {
    const t = toks[i]!;
    const rest = REST_RE.exec(t);
    const note = rest ? null : NOTE_RE.exec(t);
    if (!rest && !note) throw new Error(`unknown token '${t}'`);
    if (rest && pendingAlter !== null) throw new Error(`accidental on a rest: '${t}'`);
    i++;
    const printed = pendingAlter;
    if (pendingToken) accidentals.push(pendingToken);
    pendingAlter = null;
    pendingToken = null;
    const [den, dots] = rest ? [rest[1]!, rest[2]!] : [note![3]!, note![4]!];
    return {
      kind: rest ? "rest" : "note",
      letter: rest ? "r" : note![1]!,
      octave: rest ? "" : note![2]!,
      printed,
      dur: `${den}${dots}`,
      frac: durationFrac(den, dots),
      tieAfter: false,
    };
  };

  while (i < toks.length) {
    const t = toks[i]!;
    if (UNSUPPORTED.has(t)) throw new Error(`token '${t}' is not translatable — see ly-engrave.ts`);
    if (t === "|") { measures.push([]); i++; continue; }
    if (t === SIG_TOKEN || t === SIG_END_TOKEN) throw new Error(`misplaced '${t}'`);

    const cur = measures[measures.length - 1]!;
    if (ALTER_OF_TOKEN[t] !== undefined) {
      if (pendingAlter !== null) throw new Error(`two accidentals before one note ('${t}')`);
      pendingAlter = ALTER_OF_TOKEN[t]!;
      pendingToken = t;
      i++;
      continue;
    }
    if (t === TIE_TOKEN) {
      // `x \tie x`: the tie belongs to the note already emitted.
      const prev = cur[cur.length - 1];
      const target = prev?.kind === "tuplet" ? prev.members[prev.members.length - 1] : prev;
      if (!target || (target.kind !== "note")) throw new Error("\\tie with no note before it");
      target.tieAfter = true;
      i++;
      continue;
    }
    if (t === GRACE_TOKEN) {
      // `\grace [<accidental>] <note>` — a grace carries its own accidental (drawn small, and in
      // carry mode it never binds the measure; see lilypond.ts `graceToLily`).
      i++;
      const acc = toks[i] !== undefined ? ALTER_OF_TOKEN[toks[i]!] : undefined;
      if (acc !== undefined) {
        pendingAlter = acc;
        pendingToken = toks[i]!;
        i++;
      }
      const g = takeNote();
      const prev = cur[cur.length - 1];
      if (prev?.kind === "grace") prev.notes.push(g);
      else cur.push({ kind: "grace", notes: [g] });
      continue;
    }
    if (t === TUP3_TOKEN) {
      i++;
      const members: LyNote[] = [];
      while (i < toks.length && toks[i] !== TUP_END_TOKEN) {
        const t2 = toks[i]!;
        if (ALTER_OF_TOKEN[t2] !== undefined) {
          pendingAlter = ALTER_OF_TOKEN[t2]!;
          pendingToken = t2;
          i++;
          continue;
        }
        if (t2 === GRACE_TOKEN) throw new Error("grace note inside a tuplet is not translatable");
        members.push(takeNote());
      }
      if (toks[i] !== TUP_END_TOKEN) throw new Error("unterminated \\tup3 group");
      i++;
      cur.push({ kind: "tuplet", members });
      continue;
    }
    cur.push(takeNote());
  }
  if (pendingAlter !== null) throw new Error("trailing accidental with no note");
  return { sig, measures, accidentals };
}

// -------------------------------------------------------------------------------------------
// Emit

/** The written duration a measure fills, as the `\time` LilyPond must be told. Graces take no
 *  time; a tuplet's three written members occupy two of their own value. */
function measureFrac(items: LyItem[]): Frac {
  let total = frac(0, 1);
  for (const it of items) {
    if (it.kind === "grace") continue;
    if (it.kind === "tuplet") {
      let inner = frac(0, 1);
      for (const m of it.members) inner = add(inner, m.frac);
      total = add(total, mul(inner, frac(2, 3)));
      continue;
    }
    total = add(total, it.frac);
  }
  return total;
}

/**
 * The `\time` for one measure. The PIECE's own meter wins whenever the measure is that long, and
 * only a measure that is not (a pickup, a strip's odd tail) falls back to the sum.
 *
 * ⚠ This is not cosmetic — nothing draws the time signature. LilyPond BEAMS by it, and the two
 * spellings of the same length beam very differently: an aksaksemai bar written `5/4` comes out
 * under one beam running the whole measure, the same bar written `10/8` beams in short groups like
 * a printed page. Getting it from `deriveTimeSignature` (packages/core) rather than from arithmetic
 * is what keeps LilyPond's own beaming conventions in play — which is the diversity Lever 4 is
 * buying. ⚠ It is deliberately NOT `beatStructure`-overridden to the usul's stroke pattern:
 * USUL_BEAM_GROUPS is quarantined on the VexFlow side (docs/METRICS-DIAGNOSTICS.md) and smuggling it
 * in here would make this arm a second variable instead of a second engraver.
 */
function timeSignature(f: Frac, meter: Meter | null): string {
  if (meter) {
    const m = frac(meter.num, meter.den);
    if (m.n === f.n && m.d === f.d) return `${meter.num}/${meter.den}`;
  }
  const den = Math.max(f.d, 4);
  const num = (f.n * den) / f.d;
  if (!Number.isInteger(num) || (den & (den - 1)) !== 0) {
    throw new Error(`measure length ${f.n}/${f.d} is not a drawable time signature`);
  }
  return `${num}/${den}`;
}

/** One note in `makam.ly` spelling. `sigAlter` is what the drawn signature already shows for this
 *  letter — a note the label leaves bare is written AT that alteration so nothing prints. */
function noteText(n: LyNote, sigAlter: number): string {
  if (n.kind === "rest") return `r${n.dur}${n.tieAfter ? " ~" : ""}`;
  const alter = n.printed ?? sigAlter;
  const suffix = MAKAM_SUFFIX[alter];
  if (suffix === undefined) throw new Error(`no makam.ly pitch for ${alter} commas`);
  const force = n.printed !== null ? "!" : "";
  return `${n.letter}${suffix}${n.octave}${force}${n.dur}${n.tieAfter ? " ~" : ""}`;
}

/** `\set Staff.keyAlterations` — LilyPond's own key signature, in commas/9 (makam.ly's unit).
 *  ⚠ LilyPond chooses the left-to-right ORDER of the drawn signs itself; render-ly.ts reads the
 *  drawn order back off the SVG and writes the label's `\sig` block in that order. */
function keyAlterations(sig: SigEntry[]): string {
  const degree: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const parts = sig.map((e) => `(${degree[e.letter]} . ${e.alterCommas}/9)`);
  return `\\set Staff.keyAlterations = #'(${parts.join(" ")})`;
}

/** A piece's printed meter, from `deriveTimeSignature` (packages/core). */
export interface Meter { num: number; den: number }

export interface ScoreOptions {
  /** Draw the treble clef — true exactly when the label carries a `\sig` block (a row-start crop). */
  drawClef: boolean;
  /** The piece's meter, used for every measure that is that long — see `timeSignature`. */
  meter?: Meter | null;
}

/** One strip → one `\score` block. */
export function stripToScore(parsed: ParsedStrip, opts: ScoreOptions): string {
  const sigAlterOf = new Map<string, number>(
    (parsed.sig ?? []).map((e) => [e.letter.toLowerCase(), e.alterCommas]),
  );
  const body: string[] = [];
  parsed.measures.forEach((items) => {
    if (items.length === 0) return;
    body.push(`\\time ${timeSignature(measureFrac(items), opts.meter ?? null)}`);
    for (const it of items) {
      if (it.kind === "grace") {
        const inner = it.notes.map((n) => noteText(n, sigAlterOf.get(n.letter) ?? 0)).join(" ");
        body.push(`\\slashedGrace { ${inner} }`);
        continue;
      }
      if (it.kind === "tuplet") {
        const inner = it.members.map((n) => noteText(n, sigAlterOf.get(n.letter) ?? 0)).join(" ");
        body.push(`\\tuplet 3/2 { ${inner} }`);
        continue;
      }
      body.push(noteText(it, sigAlterOf.get(it.letter) ?? 0));
    }
    // Bar check after EVERY measure, the last one included: LilyPond warns if the measure it read
    // does not match the `\time` above. Checking only the joins would leave a one-measure strip —
    // 87% of the corpus — with no check on its meter at all.
    body.push("|");
  });

  const staffMods = [
    "\\omit TimeSignature",
    ...(opts.drawClef ? [] : ["\\omit Clef"]),
  ].join(" ");
  const head = [
    parsed.sig && parsed.sig.length > 0 ? keyAlterations(parsed.sig) : null,
    '\\accidentalStyle "forget"',
    opts.drawClef ? "\\clef treble" : null,
  ].filter(Boolean).join("\n    ");

  return [
    "\\score {",
    `  \\new Staff \\with { ${staffMods} } {`,
    `    ${head}`,
    `    ${body.join(" ")}`,
    '    \\bar "|"',
    "  }",
    "  \\layout { }",
    "}",
  ].join("\n");
}

/** The `\book` wrapper: one file per piece, one `\score` (= one strip) per page, one line per page.
 *  `ly:one-line-breaking` sizes each page to its music, so every page SVG is exactly one system. */
export function lilyDocument(scores: string[]): string {
  return [
    '\\version "2.24.0"',
    '\\include "makam.ly"',
    "\\paper {",
    "  indent = 0",
    "  page-breaking = #ly:one-line-breaking",
    "  print-page-number = ##f",
    "  oddHeaderMarkup = ##f  evenHeaderMarkup = ##f",
    "  oddFooterMarkup = ##f  evenFooterMarkup = ##f",
    "  top-margin = 4\\mm  bottom-margin = 4\\mm",
    "  left-margin = 3\\mm  right-margin = 3\\mm",
    "}",
    "",
    ...scores,
    "",
  ].join("\n");
}
