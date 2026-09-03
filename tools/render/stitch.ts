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
 *  3. **Resolve the structure**: `\repstart … \repend` plays twice (voltas: "1." on the last
 *     measure of the pass, "2." right after the `:‖` — same convention as repeats.ts); a page
 *     carrying more than one `\segno` plays the FIRST one's section again at every later 𝄋 and
 *     comes back (`expandSegnoJumps` — the teslim of a saz semâî, the nakarat of a şarkı); then
 *     `\dc`
 *     replays from the top (or the `\segno` measure) up to `\fine`/"Son", taking the ⊕ → ⊕ coda
 *     jump, repeats not re-taken. The result is the PLAYING ORDER, and it is always returned as
 *     `structure.playBars`. `expand: true` (the default) also flattens the doc to that order;
 *     ⚠ the app passes `expand: false`, keeping the WRITTEN score — a repeated bar written once,
 *     with its `:‖` — and unfolds only at playback time (`unfoldDoc` in core).
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
  /** Measures the returned `doc` holds (== written when `expand: false` or nothing expands). */
  playedMeasures: number;
  /**
   * The signs the page carries and the order they make the music play in — ALWAYS in the
   * WRITTEN score's bar numbering, whatever `expand` says.
   *
   * With `expand: false` (what the app uses) this pairs with the returned doc bar-for-bar: the
   * sheet draws the signs and the player follows `playBars`, so the score reads like a printed
   * page and still sounds the same. With the default `expand: true` the doc is already flattened
   * and this only describes what WAS folded out.
   */
  structure: ScoreStructure;
}

/** One written bar's structure marks, in the WRITTEN doc's 1-based bar numbering. */
export interface BarStructure {
  bar: number;
  /** `‖:` at this bar's left edge. */
  repStart?: boolean;
  /** `:‖` at this bar's right edge. */
  repEnd?: boolean;
  volta1?: boolean;
  volta2?: boolean;
  segno?: boolean;
  /** Which edge of the bar the 𝄋 is drawn on — `"start"` for the FIRST one (it opens the section
   *  the later ones come back to), `"end"` for a D.S. sign at a bar's right barline, which is
   *  where a hane's returning 𝄋 is printed. Only the drawn position; the jump always fires at the
   *  end of the bar carrying it (see `expandSegnoJumps`). */
  segnoAt?: "start" | "end";
  /** ⊕ in reading order: 0 = the "to coda" jump point, 1 = the coda destination. */
  codaOrder?: number;
  dc?: boolean;
  fine?: boolean;
}

/** A page's written structure: which bars carry which signs, and what those signs make the
 *  music DO. `playBars` is the performance order as written-bar numbers, so a repeated bar
 *  simply appears twice — expanding it reproduces the old flattened document exactly. */
export interface ScoreStructure {
  bars: BarStructure[];
  playBars: number[];
  /**
   * The FIRST ENDINGS, as inclusive written-bar ranges: the bars under a "1." bracket, which the
   * second pass skips whole on its way to the "2.". A first ending is usually one or two bars, not
   * always the `:‖` bar alone — see `MAX_FIRST_ENDING`.
   *
   * ⚠ Resolved once, here, and used by BOTH sides: `playBars` already skips these, and the sheet
   * draws the "1." at `from`. A second copy of the rule is how the drawn bracket and the music
   * would come to disagree about where the ending starts.
   */
  firstEndings: { from: number; to: number }[];
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

/**
 * The structure marks on ONE bar, with no music attached.
 *
 * ⭐ This is the whole input to the three expanders below: what a page's signs make the music do
 * depends on the SIGNS ALONE, never on the notes under them. Splitting it out is what lets the
 * editor re-resolve a page after the user adds or deletes a sign (`resolveStructure`) through the
 * very same code the decoder runs — one rule, not two that drift. `MeasureRec` and `BarStructure`
 * are both this shape plus a field of their own, so neither call site needed changing.
 */
export interface StructureMarks {
  /** `‖:` at this bar's left edge. */
  repStart?: boolean;
  /** `:‖` at this bar's right edge. */
  repEnd?: boolean;
  volta1?: boolean;
  volta2?: boolean;
  segno?: boolean;
  /** Drawn edge of the 𝄋 — see `BarStructure.segnoAt`. */
  segnoAt?: "start" | "end";
  /** ⊕ marks touching this measure, in reading order across the piece (0 = first ⊕ = the
   *  "to coda" jump point, 1 = second ⊕ = the coda destination). */
  codaOrder?: number;
  dc?: boolean;
  fine?: boolean;
}

/** One written measure with the structure marks decoded on/around it. */
interface MeasureRec extends StructureMarks {
  events: WrittenEvent[];
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
        // Only a measure with notes in it is closed here. An EMPTY one is a measure already being
        // opened by another start-edge mark at the same barline (`\segno \repstart` — the head of
        // a teslim), and flushing that would report a spurious empty measure. Same rule as the
        // volta brackets below.
        if (cur.events.length > 0) flushMeasure();
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
        // A 𝄋 belongs to the measure it is DRAWN ON, whichever edge that is: before the measure's
        // notes it opens the bar (the section a later 𝄋 comes back to), after them it closes the
        // bar (the D.S. sign printed at a hâne's last barline). ⚠ It used to be filed as a
        // start-edge mark only, so an end-edge one landed on the PREVIOUS bar — the jump then
        // fired one bar early and cut the hâne's last bar off.
        cur.segno = true;
        cur.segnoAt = cur.events.length === 0 ? "start" : "end";
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
  // A mark decoded AFTER the page's last barline has no measure of its own to open, and
  // `flushMeasure` carries it forward to a measure that never comes. The saz semâî's last 𝄋 — the
  // one at the end of the final hâne — is exactly this, so the marks are folded back onto the last
  // written measure instead of being dropped. Only the marks that can close a bar: a `‖:` or a
  // volta bracket after the last barline opens nothing and stays dropped.
  const dangling = cur.segno || cur.dc || cur.fine || cur.codaOrder != null;
  if (cur.events.length === 0 && dangling && measures.length > 0) {
    const last = measures[measures.length - 1]!;
    if (cur.segno && !last.segno) {
      last.segno = true;
      last.segnoAt = "end";
    }
    if (cur.dc) last.dc = true;
    if (cur.fine) last.fine = true;
    if (cur.codaOrder != null && last.codaOrder == null) last.codaOrder = cur.codaOrder;
  }
  return measures;
}

// ---------------------------------------------------------------------------------------------
// 3. Structure expansion (repeats/voltas, then da capo) — output is the flattened playing order

/**
 * The longest run of bars a "1." bracket is allowed to open, in bars INCLUDING the `:‖`.
 *
 * A first ending is short. Measured over the 1,128 `\\volta1` marks that fall inside a repeat span
 * on the real page decodes: **62.1% sit on the `:‖` bar itself** (a one-bar ending), **26.7% one bar
 * before it** (two bars), and **94.1% are within three**. Past that the mark is far more likely to be
 * a stray token than an eight-bar first ending — so a farther "1." is IGNORED rather than obeyed.
 * ⚠ That asymmetry is deliberate: obeying a stray mark would DELETE real music from the second pass,
 * and ignoring one only replays a passage that was already going to be played.
 */
export const MAX_FIRST_ENDING = 4;

/**
 * ⚠ The ONE warning that is not an error, which is why it is a constant rather than a literal.
 *
 * A `‖:` with nothing closing it is an UNFINISHED repeat, not a wrong one — and it is the state a
 * person is in for as long as it takes them to place the matching `:‖`, because a score is read
 * and edited left to right. The editor therefore ACCEPTS it and the sheet draws it as incomplete
 * (`structure-edit.ts`, the same idiom as a broken tuplet mark); every OTHER warning here means a
 * sign that would draw but not sound, and those are refused. Matching the text is what let the two
 * files disagree, so both read this.
 */
export const WARN_UNMATCHED_REPSTART = "unmatched \\repstart — played once";

/**
 * Expand `‖: … :‖` (+ 1./2. voltas) into two written passes, and report where the first endings are.
 *
 * ⭐ **The first ending is a RUN, not one bar** (owner, 2026-08-30: *"2. dönüşte ilk volta çalmamalı,
 * direkt 2. voltaya geçmeli"*). It runs from the "1." bracket to the `:‖`, and the second pass skips
 * ALL of it and continues at the "2." — which is the bar after the `:‖`. Until this fix only the
 * single bar carrying the "1." was skipped, so a two-bar first ending played its tail again on the
 * repeat: **37.9% of real first endings** were affected.
 *
 * Unmatched `:‖` repeats from the start of the piece (or the previous span's end) — the engraving
 * convention. Where a span carries more than one "1." (26 spans do, all noise), the LAST one wins:
 * it is the one nearest its `:‖`.
 */
function expandRepeats(
  measures: readonly StructureMarks[],
  warnings: string[],
): { order: number[]; endings: [number, number][] } {
  const out: number[] = [];
  /** First endings as inclusive measure-index ranges — what the second pass, and the da-capo pass
   *  below, must skip. Resolved HERE and nowhere else, so drawing and playback cannot disagree. */
  const endings: [number, number][] = [];
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
      let v1: number | null = null;
      for (let k = start; k <= i; k++) if (measures[k]!.volta1) v1 = k;
      if (v1 != null && i - v1 + 1 > MAX_FIRST_ENDING) {
        warnings.push(
          `\\volta1 opens ${i - v1 + 1} bars before its :‖ — too long for a first ending, ignored`,
        );
        v1 = null;
      }
      if (v1 != null) endings.push([v1, i]);
      // Second pass: the span up to the first ending, which is skipped whole — the "2." that
      // replaces it follows the `:‖`.
      for (let k = start; k < (v1 ?? i + 1); k++) out.push(k);
      openStart = null;
      passStart = i + 1;
    }
  }
  if (openStart != null) warnings.push(WARN_UNMATCHED_REPSTART);
  return { order: out, endings };
}

/**
 * The 𝄋 → 𝄋 rule of the Turkish forms: the FIRST sign marks a section, every LATER one plays it
 * again and comes back (owner, 2026-08-30).
 *
 * ⭐ **What the sign means on these pages.** A saz semâîsi is four *hâne*s and one *teslim*. The
 * teslim is written ONCE, and it is played after every hâne. The engraver says that with one
 * glyph: a 𝄋 at the head of the teslim, and a 𝄋 at the end of each later hâne. Reading it:
 *
 *   - the **first 𝄋 is a place-marker**, not an instruction — it opens the section;
 *   - **every later 𝄋 is a jump**: play the marked section again, then come back to where the
 *     jump was and carry on with the next hâne;
 *   - the last jump has nothing after it, so the piece simply ends there — which is where the
 *     page prints "Son".
 *
 * So `hâne1 · teslim · hâne2 · teslim · hâne3 · teslim · hâne4 · teslim`, from a page that writes
 * the teslim once. The şarkı form is the same rule with one jump: 𝄋 at the nakarat, 𝄋 at the end
 * of the meyan, nothing after it → nakarat, then stop.
 *
 * **Where the section ends** — the one thing the page has to tell us, in this order:
 *   1. a "Son" (`\fine`) at or after the 𝄋 — the printed end of the returning section;
 *   2. otherwise the first `:‖` at or after it (the teslim's own repeat closes the section), plus
 *      the "2." bar that follows a first ending;
 *   3. otherwise **nothing happens** and a warning is written. Guessing an end would replay an
 *      arbitrary stretch of music; playing the page straight through is merely incomplete.
 *
 * **The section is replayed WITH its own repeat** (owner's call, asked 2026-08-30: *"her seferinde
 * iki kere"*) — a `‖: … :‖` teslim sounds twice on every visit, the first one included. That is
 * NOT the Western D.S. convention (which drops repeats on the return); it is what these pages
 * mean. The replay is produced by running `expandRepeats` over the section's own bars, so one
 * piece of code decides what a repeat does, wherever it is played from.
 *
 * ⚠ **A jump fires at the END of the bar carrying it**, whichever edge the 𝄋 was decoded on. The
 * glyph sits on a barline and lands on either side of it; firing at the end plays the hâne out
 * and then returns, while firing at the start would cut its last bar off. Same asymmetry as
 * `MAX_FIRST_ENDING`: an extra bar is heard twice, but no written music is deleted.
 *
 * ⚠ Jumps INSIDE the section are dropped — that is the anchor's own glyph read twice, and obeying
 * it would ask the music to return to a place it has not left. A jump on a bar carrying "D.C." is
 * dropped too: `expandDaCapo` below already performs that return.
 */
function expandSegnoJumps(
  measures: readonly StructureMarks[],
  order: readonly number[],
  warnings: string[],
): number[] {
  const segnos: number[] = [];
  measures.forEach((m, i) => {
    if (m.segno) segnos.push(i);
  });
  if (segnos.length < 2) return [...order]; // one 𝄋 marks a place; nothing jumps to it
  const anchor = segnos[0]!;

  // 1. Where the returning section ends.
  let end = measures.findIndex((m, i) => i >= anchor && m.fine);
  if (end < 0) {
    end = measures.findIndex((m, i) => i >= anchor && m.repEnd);
    // A first ending inside the section ends at the `:‖`; the "2." that replaces it is the bar
    // after, so the section has to reach past the barline to hold it.
    if (end >= 0 && measures[end + 1]?.volta2) end++;
  }
  if (end < 0 || end < anchor) {
    warnings.push(
      `\\segno at measure ${anchor + 1} is jumped back to ${segnos.length - 1}× but nothing (no "Son", no :‖) says where the section ends — jumps ignored`,
    );
    return [...order];
  }

  // 2. The section's own playing order — repeats taken, first endings resolved, by the same
  //    function that expanded them in the main pass.
  const sub = expandRepeats(measures.slice(anchor, end + 1), []);
  const section = sub.order.map((i) => i + anchor);

  // 3. Fire each jump at its bar's LAST sounding in the main pass (a jump bar inside a repeat is
  //    reached twice, and the sign is obeyed on the way out, not on the way round).
  const fire = new Set<number>();
  for (const j of segnos.slice(1)) {
    if (j <= end) continue; // inside the section — the anchor's own glyph, read twice
    if (measures[j]!.dc) continue; // "D.C." on the same bar: expandDaCapo makes that return
    const at = order.lastIndexOf(j);
    if (at < 0) continue; // a bar the repeat expansion never played
    fire.add(at);
  }
  if (fire.size === 0) return [...order];

  const out: number[] = [];
  order.forEach((mi, at) => {
    out.push(mi);
    if (fire.has(at)) out.push(...section);
  });
  return out;
}

/** Append the da-capo pass: jump to the top (or the 𝄋 segno), play WITHOUT repeats preferring
 *  the "2." ending, stop at "Son" (fine) — or take the ⊕→⊕ coda jump and play the coda out. */
function expandDaCapo(
  measures: readonly StructureMarks[],
  firstPass: number[],
  endings: readonly [number, number][],
  warnings: string[],
): number[] {
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
    if (endings.some(([a, b]) => i >= a && i <= b)) {
      i++; // D.C. pass takes the second ending — the WHOLE first ending is skipped, not one bar
      continue;
    }
    const m = measures[i]!;
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

/** A written measure's sounding length in whole notes. Zero = graces only, which `buildDoc`
 *  cannot place, so it is dropped — and the structure map must drop it too or every later bar
 *  number is off by one. One function, two callers, on purpose. */
function barLengthOf(m: MeasureRec): number {
  return m.events.reduce((s, e) => s + e.num / e.den, 0);
}

/** Written measure index → its 1-based bar number in the built doc (null = dropped, see above). */
function barNumbers(measures: readonly MeasureRec[]): (number | null)[] {
  let bar = 0;
  return measures.map((m) => (barLengthOf(m) > 0 ? ++bar : null));
}

/** Re-express the parsed marks and the playing order in the WRITTEN doc's bar numbering — the
 *  only numbering anything outside this file sees. */
function structureOf(
  measures: readonly MeasureRec[],
  played: readonly number[],
  endings: readonly [number, number][],
): ScoreStructure {
  const barOf = barNumbers(measures);
  const bars: BarStructure[] = [];
  measures.forEach((m, i) => {
    const bar = barOf[i];
    if (bar == null) return;
    const { events: _events, ...marks } = m;
    if (Object.keys(marks).length > 0) bars.push({ bar, ...marks });
  });
  return {
    bars,
    playBars: played.map((i) => barOf[i]).filter((b): b is number => b != null),
    firstEndings: endings
      .map(([a, b]) => ({ from: barOf[a], to: barOf[b] }))
      .filter((e): e is { from: number; to: number } => e.from != null && e.to != null),
  };
}

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
    const barLen = barLengthOf(m);
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

/**
 * Re-resolve a page's playing order from its SIGNS ALONE — the editor's entry into the very code
 * the decoder runs.
 *
 * ⭐ **Why this exists.** The app lets a person add and delete `‖:` `:‖` 1./2. 𝄋 ⊕ "D.C." "Son"
 * on a decoded page. What those signs DO — `playBars` and `firstEndings` — was until now decided
 * only while stitching a token stream, so an editor would have needed a second copy of the rules
 * (a first ending is a run, a jump fires at the end of its bar, a D.C. mid-piece is noise, …) and
 * the copies would have drifted. Instead the marks were split out of `MeasureRec`, and this runs
 * the same three expanders in the same order over a bare `BarStructure[]`.
 *
 * `barCount` is the WRITTEN bar count of the document the marks belong to. A mark naming a bar
 * outside it is dropped rather than obeyed — editing a note can delete a bar, and a sign left
 * pointing past the end of the score must not silently re-point at another bar.
 *
 * ⚠ The `warnings` it returns are the editor's ONLY legality test. Every one of them is a sign
 * that would DRAW but not sound the way it looks ("unmatched \repstart", a "1." too far from its
 * `:‖`, a 𝄋 with nothing saying where its section ends, a mid-piece "D.C."), so the editor refuses
 * exactly the placements that would put the staff and the sound at odds — see
 * `structure-edit.ts`. That is a simulation, not a second rulebook, which is the same bargain the
 * tuplet tool struck with `tupletGroupsIn`.
 */
export function resolveStructure(
  bars: readonly BarStructure[],
  barCount: number,
): { structure: ScoreStructure; warnings: string[] } {
  const warnings: string[] = [];
  const marks: StructureMarks[] = Array.from({ length: Math.max(0, barCount) }, () => ({}));
  for (const b of bars) {
    const i = b.bar - 1;
    if (i < 0 || i >= marks.length) continue;
    const { bar: _bar, ...rest } = b;
    marks[i] = { ...marks[i], ...rest };
  }

  // Same order as `stitchTokenRows`: repeats are local, then the 𝄋 → 𝄋 returns that replay a whole
  // section, then the "D.C." at the very end, which reads the order the other two made.
  const repeats = expandRepeats(marks, warnings);
  const withSegno = expandSegnoJumps(marks, repeats.order, warnings);
  const played = expandDaCapo(marks, withSegno, repeats.endings, warnings);

  return {
    structure: {
      bars: marks
        .map((m, i) => ({ bar: i + 1, ...m }))
        .filter((b) => Object.keys(b).length > 1),
      playBars: played.map((i) => i + 1),
      firstEndings: repeats.endings.map(([a, b]) => ({ from: a + 1, to: b + 1 })),
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------
// Entry points

/** Stitch pre-joined per-row token streams (top-to-bottom) into a note model. */
export function stitchTokenRows(rows: readonly string[], opts: StitchOptions = {}): StitchResult {
  const warnings: string[] = [];
  const measures = parseRows(rows, warnings, opts.accidentals === "carry");
  const written = measures.map((_, i) => i);
  // The playing order is resolved WHATEVER `expand` says: with `expand: false` the caller keeps
  // the written score on the page and follows `structure.playBars` at playback time instead, so
  // the same expansion (and the same warnings about malformed signs) has to run either way.
  const repeats = expandRepeats(measures, warnings);
  // Order matters: repeats first (they are local), then the 𝄋 → 𝄋 returns that play a whole
  // section again, then the "D.C." at the very end, which reads the order the other two made.
  const withSegno = expandSegnoJumps(measures, repeats.order, warnings);
  const played = expandDaCapo(measures, withSegno, repeats.endings, warnings);
  const playlist = opts.expand === false ? written : played;
  return {
    doc: buildDoc(measures, playlist, opts),
    warnings,
    writtenMeasures: measures.length,
    playedMeasures: playlist.length,
    structure: structureOf(measures, played, repeats.endings),
  };
}

/** Stitch a page's decoded strips (the `decode_page.py --json` shape) into a note model. */
export function stitchStrips(strips: readonly DecodedStrip[], opts: StitchOptions = {}): StitchResult {
  return stitchTokenRows(stripsToRows(strips), opts);
}
