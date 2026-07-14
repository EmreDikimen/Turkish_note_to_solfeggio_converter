/**
 * Stage-8 STITCHER (docs/PIPELINE.md §1 stage 8) — decoded strip tokens → an editable note model.
 *
 * Input: the per-strip LilyPond-ish token streams the OMR model emits for one page (sliced by
 * `src/vision/page_to_strips.py`, decoded by `src/vision/decode_page.py` or, later, the browser).
 * Output: a `NoteModelDocument` (schemaVersion 1) the Phase-1 editor loads directly — the
 * "editor feed-in" that unlocks the Rung-3 model-assisted labeling loop.
 *
 * What it does, in order (browser-safe — no Node imports, like decode.ts):
 *  1. **Join** each staff row's strips left-to-right, inserting the `|` the crop boundary ate
 *     (page windows cut AT barlines, so the barline pixel column belongs to neither crop) —
 *     unless a repeat barline token (`\repstart`/`\repend`) already marks that boundary; then
 *     join the rows top-to-bottom the same way.
 *  2. **Resolve the written skeleton** (Phase 4's layer 1): a row-start `\sig … \sigend` block
 *     sets each letter's default alteration for the row; a **bare** note resolves to its letter's
 *     signature entry; an explicit AEU token / `\natural` overrides. Rhythm signs are folded back
 *     the way the serializer spelled them: `\tup3 … \tupend` members sound at written × 2/3,
 *     `x \tie x` merges into ONE event, `\grace` becomes a zero-duration EventKind "grace".
 *  3. **Expand structure**: `\repstart … \repend` plays twice (voltas: "1." on the last measure
 *     of the pass, "2." right after the `:‖` — same convention as repeats.ts), then `\dc` replays
 *     from the top (or the `\segno` measure) up to `\fine`/"Son", taking the ⊕ → ⊕ coda jump,
 *     repeats not re-taken. Output is FLATTENED — what the editor and playback want.
 *  4. **Build the document**: sequential bars; `offset` in bar units (integer = barline) so the
 *     harness's `assignBars` reproduces the decoded barlines exactly; durations at a nominal
 *     tempo (the user sets BPM in the editor; SymbTr-less pages have no tempo of their own).
 *
 * Model output is NOISY (this is the synthetic→real gap the Rung-3 loop trains away), so every
 * malformed construct — stray `\tupend`, dangling `\tie`, mid-row `\sig`, empty measures — is
 * skipped with a warning instead of failing: a mostly-right note model in the editor beats a
 * parse error, because correcting it there IS the labeling loop.
 */

import {
  DEFAULT_TUNING,
  freqFromTuning,
  komaOf,
  spellNote,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import {
  ADDED_TOKENS,
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

// ---------------------------------------------------------------------------------------------
// Shapes

/** One decoded strip, as `decode_page.py --json` emits it (system = staff row on the page). */
export interface DecodedStrip {
  system: number;
  window: number;
  tokens: string;
}

export interface StitchOptions {
  /** Document name/title (e.g. the page file stem). */
  name?: string;
  /** Nominal whole-note duration for playback ms (default 2000 → quarter = 120 BPM). */
  wholeNoteMs?: number;
  /** Expand repeats/voltas/da-capo into the flattened form (default true). */
  expand?: boolean;
  /** How BARE notes resolve (must match the stream's engraving convention):
   *  - `"keysig"` (default) — bare = the signature pitch. Synthetic every/keysig-mode labels.
   *  - `"carry"` — standard engraving: an explicit accidental binds its staff position until the
   *    next barline; bare takes the carried alteration first, the signature second. Real printed
   *    pages use this (confirmed on the neyzen corpus) — `stitch-cli` passes it for page decodes. */
  accidentals?: "keysig" | "carry";
}

export interface StitchResult {
  doc: NoteModelDocument;
  /** Human-readable notes on every recovered/skipped malformed construct. */
  warnings: string[];
  /** Measures in the WRITTEN score (before structure expansion). */
  writtenMeasures: number;
  /** Measures after expansion (== written when nothing expands). */
  playedMeasures: number;
}

/** A parsed written event, pre-document (exact duration as a reduced fraction of a whole note). */
interface WrittenEvent {
  kind: "note" | "rest" | "grace";
  /** Upper-case letter C..B (notes/graces only). */
  letter?: string;
  octave?: number;
  /** Resolved comma alteration (signature applied; explicit token overrides). */
  alter?: number;
  num: number;
  den: number;
}

/** One written measure with the structure marks decoded on/around it. */
interface MeasureRec {
  events: WrittenEvent[];
  repStart?: boolean;
  /** `:‖` at this measure's right edge. */
  repEnd?: boolean;
  volta1?: boolean;
  volta2?: boolean;
  segno?: boolean;
  /** ⊕ marks touching this measure, in reading order across the piece (0 = first ⊕ = the
   *  "to coda" jump point, 1 = second ⊕ = the coda destination). */
  codaOrder?: number;
  dc?: boolean;
  fine?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Small exact-fraction helpers (same spirit as rhythm.ts — floats can't tell 1/12 sums apart)

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function reduce(n: number, d: number): [number, number] {
  if (d === 0 || n === 0) return [0, 1];
  const g = gcd(n, d);
  return [n / g, d / g];
}

function addFrac(an: number, ad: number, bn: number, bd: number): [number, number] {
  return reduce(an * bd + bn * ad, ad * bd);
}

// ---------------------------------------------------------------------------------------------
// 1. Joining strips into row streams, rows into one page stream

const TOKEN_TO_ALTER: Record<string, number> = Object.fromEntries(
  Object.entries(AEU_TOKEN).map(([commas, tok]) => [tok, Number(commas)]),
);
const LILY_TO_LETTER: Record<string, string> = { c: "C", d: "D", e: "E", f: "F", g: "G", a: "A", b: "B" };
const NOTE_RE = /^([a-gr])([',]*)(\d+)(\.*)$/;

/** The added backslash tokens, longest first so `\sigend` matches before `\sig` etc. */
const BACKSLASH_TOKENS = ADDED_TOKENS.filter((t) => t.startsWith("\\")).sort(
  (a, b) => b.length - a.length,
);
const TOKEN_SPLIT_RE = new RegExp(
  `(${BACKSLASH_TOKENS.map((t) => t.replace(/\\/g, "\\\\")).join("|")}|\\|)`,
  "g",
);

/** Re-space a decoded stream: the HF tokenizer's `decode` glues added tokens to their
 *  neighbours (`\sig\bakiyeFlata`, `\tup3d''16`, `r4\repstart`) while training labels are
 *  space-separated — surround every added token with spaces so both forms split identically. */
export function normalizeTokens(text: string): string {
  return text.replace(TOKEN_SPLIT_RE, " $1 ").replace(/\s+/g, " ").trim();
}

/** Would inserting a plain `|` at the boundary between these two chunks duplicate a drawn
 *  repeat barline? (`\repstart`/`\repend` REPLACE the `|` at their barline — serializer rule.) */
function boundaryHasBarline(prevLast: string | undefined, nextFirst: string | undefined): boolean {
  return prevLast === REP_END_TOKEN || nextFirst === REP_START_TOKEN || nextFirst === REP_END_TOKEN;
}

/** Join adjacent token chunks (strips within a row, then rows) with the barline their shared
 *  crop boundary represents. Empty chunks (a strip that decoded to nothing) are dropped. */
export function joinChunks(chunks: string[]): string {
  const parts: string[] = [];
  for (const chunk of chunks) {
    const toks = normalizeTokens(chunk).split(/\s+/).filter(Boolean);
    if (toks.length === 0) continue;
    if (parts.length > 0 && !boundaryHasBarline(parts[parts.length - 1], toks[0])) parts.push("|");
    parts.push(...toks);
  }
  return parts.join(" ");
}

/** Group decoded strips by staff row (`system`), join within each row, and return the per-row
 *  streams in top-to-bottom page order. */
export function stripsToRows(strips: readonly DecodedStrip[]): string[] {
  const bySystem = new Map<number, DecodedStrip[]>();
  for (const s of strips) {
    const row = bySystem.get(s.system) ?? [];
    row.push(s);
    bySystem.set(s.system, row);
  }
  return [...bySystem.keys()]
    .sort((a, b) => a - b)
    .map((sys) => joinChunks(bySystem.get(sys)!.sort((a, b) => a.window - b.window).map((s) => s.tokens)));
}

// ---------------------------------------------------------------------------------------------
// 2. Token streams → written measures (signature resolution + rhythm-sign fold-back)

/** Parse the per-row token streams into written measures with structure marks. */
function parseRows(rows: readonly string[], warnings: string[], carryMode = false): MeasureRec[] {
  const measures: MeasureRec[] = [];
  let cur: MeasureRec = { events: [] };
  let codaCount = 0;

  // Row signature state: letter → default alteration. Persists across rows until a NON-EMPTY
  // `\sig` block replaces it — an empty `\sig \sigend` on a later row is the known empty-signature
  // ambiguity (see MODEL_EVAL.md), so it never clears an established signature.
  let sig = new Map<string, number>();
  let sawNonEmptySig = false;
  // "carry" mode: staff position ("B4") → alteration in effect within the CURRENT measure
  // (set by explicit accidentals, cleared at every measure boundary — see StitchOptions).
  const active = new Map<string, number>();

  const flushMeasure = () => {
    active.clear(); // every flush is a measure boundary (barline / repeat barline / row end)
    if (cur.events.length > 0) measures.push(cur);
    else if (cur.repStart || cur.volta1 || cur.volta2 || cur.segno) {
      // Marks decoded onto an empty measure (consecutive barlines = model noise): carry them
      // forward so a `‖:` right after a spurious `|` still opens its repeat.
      warnings.push("empty measure with structure marks — marks carried to the next measure");
      cur = { ...cur, events: [] };
      return;
    }
    cur = { events: [] };
  };

  for (const [rowIdx, row] of rows.entries()) {
    const raw = normalizeTokens(row).split(/\s+/).filter(Boolean);
    // Re-glue split durations: `3` is an ADDED token (the base vocab can't spell "32"), so the
    // tokenizer's decode can emit `f'' 32` as two tokens — merge a bare pitch with the bare
    // duration that follows it. (Training labels never split; this is raw-decode spacing only.)
    const toks: string[] = [];
    for (let k = 0; k < raw.length; k++) {
      const t = raw[k]!;
      if (/^[a-gr][',]*$/.test(t) && k + 1 < raw.length && /^\d+\.*$/.test(raw[k + 1]!)) {
        toks.push(t + raw[k + 1]!);
        k++;
      } else {
        toks.push(t);
      }
    }
    let pendingAlter: number | null = null;
    let pendingGrace = false;
    let tiePending = false;
    let inTuplet = false;
    let inSig = false;
    let sigAlter = 0;
    let rowSig: Map<string, number> | null = null; // block being read
    let i = -1;

    // The shared bare-note/explicit-accidental resolution (see StitchOptions.accidentals).
    // Grace accidentals print but never bind the measure — mirroring the serializer.
    const resolveAlter = (letter: string, octave: number): number => {
      if (pendingAlter !== null) {
        if (carryMode && !pendingGrace) active.set(`${letter}${octave}`, pendingAlter);
        return pendingAlter;
      }
      if (carryMode && active.has(`${letter}${octave}`)) return active.get(`${letter}${octave}`)!;
      return sig.get(letter) ?? 0;
    };

    for (const tok of toks) {
      i++;
      // --- signature block ---------------------------------------------------------------
      if (tok === SIG_TOKEN) {
        if (i > 0 || cur.events.length > 0) {
          // Mid-stream \sig = decode noise; a real signature only opens a row.
          warnings.push(`row ${rowIdx}: mid-row \\sig ignored`);
          inSig = true; // still consume the block so its letters don't become notes
          rowSig = null;
          continue;
        }
        inSig = true;
        rowSig = new Map();
        sigAlter = 0;
        continue;
      }
      if (tok === SIG_END_TOKEN) {
        inSig = false;
        if (rowSig) {
          if (rowSig.size > 0) {
            sig = rowSig;
            sawNonEmptySig = true;
          } else if (sawNonEmptySig) {
            warnings.push(`row ${rowIdx}: empty \\sig block — keeping the previous row's signature`);
          } else {
            sig = rowSig; // genuinely signature-less piece
          }
        }
        rowSig = null;
        continue;
      }
      if (inSig) {
        if (tok in TOKEN_TO_ALTER) sigAlter = TOKEN_TO_ALTER[tok]!;
        else {
          const letter = LILY_TO_LETTER[tok];
          if (letter && sigAlter !== 0) rowSig?.set(letter, sigAlter);
          else if (!letter) warnings.push(`row ${rowIdx}: unexpected token '${tok}' inside \\sig block`);
          sigAlter = 0;
        }
        continue;
      }

      // --- barlines + structure marks ------------------------------------------------------
      if (tok === "|") {
        if (cur.events.length === 0 && measures.length > 0) warnings.push(`row ${rowIdx}: empty measure skipped`);
        if (tiePending) warnings.push(`row ${rowIdx}: dangling \\tie at a barline dropped`);
        if (inTuplet) warnings.push(`row ${rowIdx}: unclosed \\tup3 at a barline closed`);
        tiePending = false;
        inTuplet = false;
        flushMeasure();
        continue;
      }
      if (tok === REP_START_TOKEN) {
        flushMeasure();
        cur.repStart = true;
        continue;
      }
      if (tok === REP_END_TOKEN) {
        // `:‖` marks the measure BEFORE this boundary; it also closes the measure like a `|`.
        if (cur.events.length > 0) {
          cur.repEnd = true;
          flushMeasure();
        } else if (measures.length > 0) {
          measures[measures.length - 1]!.repEnd = true;
        } else {
          warnings.push(`row ${rowIdx}: \\repend before any music ignored`);
        }
        continue;
      }
      if (tok === VOLTA1_TOKEN || tok === VOLTA2_TOKEN) {
        // Volta brackets precede their measure's notes (serializer order: barline, volta, notes).
        if (cur.events.length > 0) flushMeasure();
        if (tok === VOLTA1_TOKEN) cur.volta1 = true;
        else cur.volta2 = true;
        continue;
      }
      if (tok === SEGNO_TOKEN) {
        // Start-edge mark: belongs to the measure it opens.
        (cur.events.length === 0 ? cur : measures[measures.length - 1] ?? cur).segno = true;
        continue;
      }
      if (tok === CODA_TOKEN) {
        // ⊕ is drawn either at a measure's right barline (the "to coda" jump point) or over the
        // next measure's first note (the coda destination) — both decode adjacent to the current
        // measure position, so the mark lands on `cur` and reading order (codaOrder) disambiguates.
        if (cur.codaOrder == null) cur.codaOrder = codaCount++;
        continue;
      }
      if (tok === DC_TOKEN || tok === FINE_TOKEN) {
        // End-edge marks: they close at the current measure's right barline. If the measure is
        // still empty the mark belongs to the PREVIOUS one (it decoded after the `|`).
        const target = cur.events.length > 0 ? cur : measures[measures.length - 1];
        if (!target) {
          warnings.push(`row ${rowIdx}: ${tok} before any music ignored`);
          continue;
        }
        if (tok === DC_TOKEN) target.dc = true;
        else target.fine = true;
        continue;
      }

      // --- rhythm signs --------------------------------------------------------------------
      if (tok === TUP3_TOKEN) {
        if (inTuplet) warnings.push(`row ${rowIdx}: nested \\tup3 — treating as one group`);
        inTuplet = true;
        continue;
      }
      if (tok === TUP_END_TOKEN) {
        if (!inTuplet) warnings.push(`row ${rowIdx}: stray \\tupend ignored`);
        inTuplet = false;
        continue;
      }
      if (tok === TIE_TOKEN) {
        const last = cur.events[cur.events.length - 1];
        if (last?.kind === "note") tiePending = true;
        else warnings.push(`row ${rowIdx}: \\tie without a preceding note ignored`);
        continue;
      }
      if (tok === GRACE_TOKEN) {
        pendingGrace = true;
        continue;
      }

      // --- accidentals + notes/rests -------------------------------------------------------
      if (tok === NATURAL_TOKEN) {
        pendingAlter = 0;
        continue;
      }
      if (tok in TOKEN_TO_ALTER) {
        pendingAlter = TOKEN_TO_ALTER[tok]!;
        continue;
      }
      const m = NOTE_RE.exec(tok);
      if (!m) {
        warnings.push(`row ${rowIdx}: unknown token '${tok}' skipped`);
        continue;
      }
      const [, letterLower, octMarks, durDigits, dots] = m;
      const den = parseInt(durDigits!, 10);
      if (!(den > 0) || (den & (den - 1)) !== 0 || den > 64) {
        warnings.push(`row ${rowIdx}: unreadable duration '${tok}' skipped`);
        pendingAlter = null;
        continue;
      }
      // Written duration as a fraction: plain 1/den, one dot 3/(2·den), two dots 7/(4·den).
      let [num, denom] =
        dots!.length >= 2 ? [7, den * 4] : dots!.length === 1 ? [3, den * 2] : [1, den];
      if (inTuplet) [num, denom] = reduce(num * 2, denom * 3); // sounding = written × 2/3

      if (letterLower === "r") {
        if (tiePending) {
          warnings.push(`row ${rowIdx}: \\tie into a rest ignored`);
          tiePending = false;
        }
        if (pendingGrace) {
          warnings.push(`row ${rowIdx}: \\grace before a rest ignored`);
          pendingGrace = false;
        }
        cur.events.push({ kind: "rest", num, den: denom });
        pendingAlter = null;
        continue;
      }
      const letter = LILY_TO_LETTER[letterLower!]!;
      let octave = 3; // c' = C4 → a bare letter is octave 3
      for (const ch of octMarks!) octave += ch === "'" ? 1 : -1;

      if (tiePending) {
        // Tie continuation: same pitch as the first written note (its accidental is never
        // restruck), duration adds onto the SAME event — the serializer's inverse.
        const last = cur.events[cur.events.length - 1]!;
        if (last.letter !== letter || last.octave !== octave) {
          warnings.push(
            `row ${rowIdx}: \\tie pitch mismatch (${last.letter}${last.octave} → ${letter}${octave}) — kept as separate notes`,
          );
          const alter = resolveAlter(letter, octave);
          cur.events.push({ kind: "note", letter, octave, alter, num, den: denom });
        } else {
          [last.num, last.den] = addFrac(last.num, last.den, num, denom);
        }
        tiePending = false;
        pendingAlter = null;
        continue;
      }

      const alter = resolveAlter(letter, octave);
      cur.events.push({
        kind: pendingGrace ? "grace" : "note",
        letter,
        octave,
        alter,
        num: pendingGrace ? 0 : num,
        den: pendingGrace ? 1 : denom,
      });
      pendingGrace = false;
      pendingAlter = null;
    }

    // Row end = a barline on the page.
    if (tiePending) warnings.push(`row ${rowIdx}: dangling \\tie at row end dropped`);
    if (inTuplet) warnings.push(`row ${rowIdx}: unclosed \\tup3 at row end closed`);
    flushMeasure();
  }
  flushMeasure();
  return measures;
}

// ---------------------------------------------------------------------------------------------
// 3. Structure expansion (repeats/voltas, then da capo) — output is the flattened playing order

/** Expand `‖: … :‖` (+ 1./2. voltas) into two written passes. Volta convention matches
 *  repeats.ts: "1." sits on the pass's LAST measure, "2." on the measure right after the `:‖`;
 *  pass 2 replaces the volta-1 measure with what follows. Unmatched `:‖` repeats from the start
 *  of the piece (or the previous span's end) — the engraving convention. */
function expandRepeats(measures: readonly MeasureRec[], warnings: string[]): number[] {
  const out: number[] = [];
  let passStart = 0; // where an unmatched `:‖` would jump back to
  let openStart: number | null = null;
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i]!;
    if (m.repStart) {
      if (openStart != null) warnings.push("nested \\repstart — outer span ignored");
      openStart = i;
    }
    out.push(i);
    if (m.repEnd) {
      const start = openStart ?? passStart;
      // Second pass: start..i, skipping any volta-1 measures (their "2." replacement follows i).
      for (let k = start; k <= i; k++) if (!measures[k]!.volta1) out.push(k);
      openStart = null;
      passStart = i + 1;
    }
  }
  if (openStart != null) warnings.push("unmatched \\repstart — played once");
  return out;
}

/** Append the da-capo pass: jump to the top (or the 𝄋 segno), play WITHOUT repeats preferring
 *  the "2." ending, stop at "Son" (fine) — or take the ⊕→⊕ coda jump and play the coda out. */
function expandDaCapo(measures: readonly MeasureRec[], firstPass: number[], warnings: string[]): number[] {
  const dcAt = measures.findIndex((m) => m.dc);
  if (dcAt < 0) return firstPass;
  // A real "D.C." sits at the written score's final barline. One decoded mid-piece (a real
  // page produced one at the END OF ROW 1) is model noise — honoring it would truncate the
  // whole piece at that measure, so require it at/next to the last written measure.
  if (dcAt < measures.length - 2) {
    warnings.push(
      `\\dc decoded mid-piece (measure ${dcAt + 1} of ${measures.length}) — ignored; a real D.C. ends the written score`,
    );
    return firstPass;
  }

  const segnoAt = measures.findIndex((m) => m.segno);
  const fineAt = measures.findIndex((m) => m.fine);
  const codaFrom = measures.findIndex((m) => m.codaOrder === 0);
  const codaTo = measures.findIndex((m) => m.codaOrder === 1);

  // The D.C. fires where its measure ends in the first pass (usually the piece's last measure).
  const cutAt = firstPass.lastIndexOf(dcAt);
  const out = cutAt >= 0 ? firstPass.slice(0, cutAt + 1) : [...firstPass];

  let i = segnoAt >= 0 ? segnoAt : 0;
  const guard = measures.length * 2; // decode noise must never loop forever
  let steps = 0;
  while (i < measures.length && steps++ < guard) {
    const m = measures[i]!;
    if (m.volta1) {
      i++; // D.C. pass takes the second ending
      continue;
    }
    out.push(i);
    if (i === fineAt) return out;
    if (codaFrom >= 0 && codaTo > codaFrom && i === codaFrom) {
      i = codaTo;
      continue;
    }
    if (i === dcAt) return out; // reached the D.C. sign again — stop (no infinite da capo)
    i++;
  }
  if (steps >= guard) warnings.push("da-capo expansion hit its loop guard — output truncated");
  return out;
}

// ---------------------------------------------------------------------------------------------
// 4. Note-model document

const DEFAULT_WHOLE_NOTE_MS = 2000; // quarter = 500 ms = 120 BPM; the editor's BPM control rescales

function buildDoc(
  measures: readonly MeasureRec[],
  playlist: readonly number[],
  opts: StitchOptions,
): NoteModelDocument {
  const wholeNoteMs = opts.wholeNoteMs ?? DEFAULT_WHOLE_NOTE_MS;
  const events: NoteEvent[] = [];
  let bar = 0;
  for (const mi of playlist) {
    const m = measures[mi]!;
    const barLen = m.events.reduce((s, e) => s + e.num / e.den, 0);
    if (barLen <= 0) continue; // nothing sounding (graces only) — unplaceable, skip
    bar++;
    let cum = 0;
    for (const ev of m.events) {
      const beats = ev.num / ev.den;
      const isNote = ev.kind !== "rest";
      const koma = isNote ? komaOf(ev.letter!, ev.octave!, ev.alter!) : -1;
      events.push({
        index: events.length + 1,
        kind: ev.kind,
        koma53: koma,
        noteName: isNote ? spellNote(ev.letter!, ev.octave!, ev.alter!, "solfege") : "Es",
        noteAE: isNote ? spellNote(ev.letter!, ev.octave!, ev.alter!, "western") : "Es",
        durationMs: Math.round(beats * wholeNoteMs),
        durationBeats: { num: ev.num, den: ev.den },
        freqHz: ev.kind === "note" ? freqFromTuning(koma, DEFAULT_TUNING) : null,
        lyric: "",
        // End time in bar units (integer = barline), so `assignBars` re-derives exactly the
        // decoded barlines whatever each bar's length is. A grace ends where it starts.
        offset: bar - 1 + (ev.kind === "grace" ? cum : cum + beats) / barLen,
        bar,
      });
      cum += beats;
    }
  }
  return {
    schemaVersion: 1,
    name: opts.name ?? "decoded-page",
    makam: "",
    form: "",
    usul: "",
    title: opts.name ?? "decoded page",
    composer: "",
    tuning: { ...DEFAULT_TUNING },
    events,
  };
}

// ---------------------------------------------------------------------------------------------
// Entry points

/** Stitch pre-joined per-row token streams (top-to-bottom) into a note model. */
export function stitchTokenRows(rows: readonly string[], opts: StitchOptions = {}): StitchResult {
  const warnings: string[] = [];
  const measures = parseRows(rows, warnings, opts.accidentals === "carry");
  const written = measures.map((_, i) => i);
  const playlist =
    opts.expand === false ? written : expandDaCapo(measures, expandRepeats(measures, warnings), warnings);
  return {
    doc: buildDoc(measures, playlist, opts),
    warnings,
    writtenMeasures: measures.length,
    playedMeasures: playlist.length,
  };
}

/** Stitch a page's decoded strips (the `decode_page.py --json` shape) into a note model. */
export function stitchStrips(strips: readonly DecodedStrip[], opts: StitchOptions = {}): StitchResult {
  return stitchTokenRows(stripsToRows(strips), opts);
}
