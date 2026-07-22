/**
 * Note-model → LilyPond label serializer (Phase 2, Step 2).
 *
 * Produces the training LABELS for fine-tuning `omr_transformer` (image → LilyPond). The model
 * spells notes char-by-char in LilyPond (English note names), so we emit the same, and add the one
 * thing it lacks: the Turkish microtonal accidentals, each as a single readable atomic token
 * (`\komaFlat`, `\bakiyeSharp`, …). Decisions locked with the user:
 *
 *  - **FAITHFUL labels (label == pixels):** a note carries a token only for what is *physically
 *    drawn* on it — an explicit deviation accidental, an explicit `\natural` (cancel), else bare.
 *    This mirrors SheetView's per-note drawing decision exactly (same signature comparison), so any
 *    crop — including mid-row — is valid training data: identical pixels always get identical
 *    labels. (The earlier *semantic* scheme — every altered note labeled with its effective
 *    accidental — broke that: a signature-covered bare note got a token that isn't in the image,
 *    so the same glyphs needed different labels depending on the piece.)
 *  - **Signature extraction:** strips whose crop includes the row start (clef + makam signature) are
 *    prefixed with the printed signature, e.g. `\sig \komaFlat b \sigend` — the OMR *reads* the
 *    signature, giving Phase 4 a makam-independent source of the row's default accidentals. The
 *    Phase-4 decoder resolves bare notes from that signature (or the makam's defaults); explicit
 *    accidental / `\natural` override; no signature + `makam = none` → notes as written.
 *  - **Three render modes, one rule.** `"every"` mode draws every alteration inline (no signature), so
 *    the faithful label marks every altered note — pass NO signature to the serializer. `"keysig"`
 *    mode suppresses signature-covered accidentals, so pass the drawn signature and the serializer
 *    marks deviations/cancels only. `"measure"` (carry) mode is standard engraving — signature PLUS
 *    the measure-scoped carry rule (an accidental prints on the first note per staff position that
 *    breaks the alteration in effect, then carries to the barline; a cancel prints on return) —
 *    pass the signature AND a per-measure `CarryState`. Real printed pages use this convention
 *    (confirmed on the neyzen corpus, Rung 3), and it mirrors SheetView's `"measure"`
 *    `AccidentalMode` decision exactly, so label == pixels there too.
 *  - **AEU accidentals = 8 dedicated tokens** (koma/bakiye/küçük/büyük × flat/sharp), each ONE token.
 *  - **Barlines** kept as `|` (one atomic token) to preserve measure structure (matches the drawn
 *    barlines). Clef / time-signature are NOT in the label (treble is universal in the repertoire).
 *  - **Short strips:** group measures into self-contained chunks that stay under the model's ~60-token
 *    decoder cap (see `docToStrips`).
 *
 * New tokens this format requires beyond the base vocab: the 8 accidental tokens, `\natural`,
 * `\sig`/`\sigend`, the 4 repeat-sign tokens (`\repstart`/`\repend`/`\volta1`/`\volta2`), the
 * 4 navigation-mark tokens (`\segno`/`\coda`/`\dc`/`\fine` — see navmarks.ts), `|`,
 * the digit `3` (the base vocab lacks `3`, so it can't write "32" for 32nd notes — see MODEL_EVAL.md),
 * and the 4 rhythm-sign tokens (`\tup3`/`\tupend`/`\tie`/`\grace` — see rhythm.ts, strips_v2_2).
 */

import {
  eventBeats,
  groupMeasures,
  parseNoteName,
  toAeuAlter,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { repeatMarksAt, type RepeatSpan } from "./repeats";
import { navMarksAt, type NavMark } from "./navmarks";
import { tieSplitBeats, tupletGroupsIn, tupletWrittenBeats } from "./rhythm";

/** AEU-snapped alteration (commas) → the LilyPond accidental token. toAeuAlter only yields ±1/4/5/8. */
export const AEU_TOKEN: Record<number, string> = {
  1: "\\komaSharp", [-1]: "\\komaFlat",
  4: "\\bakiyeSharp", [-4]: "\\bakiyeFlat",
  5: "\\kucukSharp", [-5]: "\\kucukFlat",
  8: "\\buyukSharp", [-8]: "\\buyukFlat",
};

/** Explicit natural (cancel) sign — drawn when a note deviates from an altered signature back to 0. */
export const NATURAL_TOKEN = "\\natural";
/** Delimiters of the key-signature prefix on row-start strips: `\sig <acc> <letter> … \sigend`. */
export const SIG_TOKEN = "\\sig";
export const SIG_END_TOKEN = "\\sigend";
/** Repeat signs, faithful drawn symbols (the base vocab's structural `\repeat `/`volta ` can't
 *  label a crop showing only one end of a repeat): `‖:` / `:‖` barlines (replacing `|` at their
 *  boundary) and the 1./2. volta brackets (before the bracketed measure's first note). */
export const REP_START_TOKEN = "\\repstart";
export const REP_END_TOKEN = "\\repend";
export const VOLTA1_TOKEN = "\\volta1";
export const VOLTA2_TOKEN = "\\volta2";
/** Navigation marks, faithful drawn symbols like the repeat signs: the segno/coda glyphs (𝄋 ⊕)
 *  and the "D.C." / "Son" text marks (Son = the Turkish Fine). SymbTr has none, so they are
 *  injected — see navmarks.ts. One token per drawn mark, emitted at its measure edge. */
export const SEGNO_TOKEN = "\\segno";
export const CODA_TOKEN = "\\coda";
export const DC_TOKEN = "\\dc";
export const FINE_TOKEN = "\\fine";
/** Rhythm signs recovered from the exact durations (see rhythm.ts, strips_v2_2). Faithful drawn
 *  symbols like everything else: `\tup3 … \tupend` wraps a bracketed triplet group (the digit is
 *  in the name so a future `\tup5` can join, like `\volta1`/`\volta2`; the written durations
 *  inside stay as drawn — three plain 8ths under a "3"); `\tie` sits between the two written
 *  notes of a tied pair (LilyPond's `~` is unspellable in the base vocab); `\grace` prefixes a
 *  small slashed grace note's own spelling (`\grace \bakiyeSharp f''8`). */
export const TUP3_TOKEN = "\\tup3";
export const TUP_END_TOKEN = "\\tupend";
export const TIE_TOKEN = "\\tie";
export const GRACE_TOKEN = "\\grace";

/** NavMark type → its label token. */
export const NAV_TOKEN: Record<NavMark["type"], string> = {
  segno: SEGNO_TOKEN,
  coda: CODA_TOKEN,
  dc: DC_TOKEN,
  fine: FINE_TOKEN,
};

/**
 * Shared strip-packing budget — the ONE place the cap lives (both `docToStrips` and the browser
 * exporter's `buildStrips` default to it). 56 + EOS = 57 ≤ the decoder's max_length 60, leaving
 * headroom for the char-count token estimate; `audit_coverage.py --tokenizer` is the hard backstop
 * (fails on any label > 59 real ids).
 */
export const STRIP_BUDGET = { maxMeasures: 4, maxTokens: 56 } as const;

/** The full set of tokens we must add to the model's tokenizer for this format. */
export const ADDED_TOKENS: string[] = [
  ...Object.values(AEU_TOKEN),
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
  "|",
  "3",
  // strips_v2_2 rhythm signs — appended at the END so every earlier token keeps its id
  // (several scripts slice ADDED_TOKENS[:8] for the AEU set; never insert mid-list).
  TUP3_TOKEN,
  TUP_END_TOKEN,
  TIE_TOKEN,
  GRACE_TOKEN,
];

/**
 * The signature in effect for the rendered image: pitch letter (upper-case "C".."B") → AEU-snapped
 * alteration in commas. `null`/`undefined` = "every" render mode (no signature drawn; every
 * alteration is inline). Matches SheetView's `signatureMap` so label decisions equal draw decisions.
 */
export type SignatureMap = ReadonlyMap<string, number> | null | undefined;

/**
 * "measure" (carry) mode state: staff position (`letter+octave`, e.g. "B4") → the alteration
 * currently in effect within the measure. Seeded lazily from the signature; set by each printed
 * accidental. One instance per measure (carry is measure-scoped — it resets at every barline),
 * created by `measureAtoms` and threaded through the note serializers. Mirrors the `active` map
 * in SheetView's `buildStaveNotes`.
 */
export type CarryState = Map<string, number>;

// LilyPond duration code (denominator) paired with its value as a fraction of a whole note.
const DUR: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 1 / 2], [4, 1 / 4], [8, 1 / 8], [16, 1 / 16], [32, 1 / 32], [64, 1 / 64],
];

const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;

/** Map a note-value (fraction of a whole note) to a LilyPond duration string ("8", "4.", "16", …). */
export function lilyDuration(beats: number): string {
  for (const [code, val] of DUR) {
    if (near(beats, val)) return `${code}`;
    if (near(beats, val * 1.5)) return `${code}.`; // single augmentation dot
    if (near(beats, val * 1.75)) return `${code}..`; // double dot
  }
  // Unexpected value (e.g. a tuplet fraction): fall back to the nearest base value, undotted.
  let best = DUR[2]!;
  for (const d of DUR) if (Math.abs(d[1] - beats) < Math.abs(best[1] - beats)) best = d;
  return `${best[0]}`;
}

/** LilyPond octave marks for our note-model octave numbering (Do5 = C5 = `c''`). c'=C4, so n = octave−3. */
export function lilyOctave(octave: number): string {
  const n = octave - 3;
  return n > 0 ? "'".repeat(n) : n < 0 ? ",".repeat(-n) : "";
}

/**
 * One event → its LilyPond text plus a rough token-count estimate (for strip packing).
 *
 * FAITHFUL rule (must equal SheetView's drawing decision for the same mode):
 *  - no `signature` ("every" mode): an accidental token iff the note is altered (that's what's drawn);
 *  - with `signature` ("keysig" mode): token only when the note DEVIATES from the signature —
 *    `\natural` if it cancels back to natural, the AEU token otherwise; matching notes stay bare;
 *  - with `carry` ("measure" mode): token only when the note breaks the alteration currently in
 *    effect for its staff position (carry state first, signature default second) — then the new
 *    alteration is remembered for the rest of the measure. `carryUpdate = false` prints by the
 *    same decision without setting the state (grace notes — their tiny accidental doesn't bind
 *    the measure, matching SheetView).
 *
 * `writtenBeats` overrides the duration actually spelled: tuplet members write their ×3/2 value
 * (a sounding 1/12 spells as an 8th under the bracket) and tie-split parts write each half.
 * Without it the event's own duration is spelled, snapping any unexpected value (legacy fallback).
 */
export function noteToLily(
  ev: NoteEvent,
  signature?: SignatureMap,
  writtenBeats?: number,
  carry?: CarryState,
  carryUpdate = true,
  sigTolerant = false,
): { text: string; tokens: number } {
  const dur = lilyDuration(writtenBeats ?? eventBeats(ev));
  const parsed = ev.kind === "note" || ev.kind === "grace" ? parseNoteName(ev.noteName) : null;
  if (!parsed) {
    // Rest: `r` + duration. tokens ≈ 1 (r) + duration chars.
    return { text: `r${dur}`, tokens: 1 + dur.length };
  }
  const alter = toAeuAlter(parsed.alterCommas); // AEU sign actually drawn on the staff
  let acc = "";
  if (carry) {
    const posKey = `${parsed.letter}${parsed.octave}`;
    const sigAlter = signature?.get(parsed.letter) ?? 0;
    const effective = carry.has(posKey) ? carry.get(posKey)! : sigAlter;
    // `sigTolerant` (real printed pages, Rung 3): a note whose alteration RAISES/LOWERS in
    // the same direction as the alteration in effect is written BARE — the page shows the
    // degree under its signature sign and the performer supplies the makam intonation
    // (SymbTr stores the SOUNDING value: eviç is a 5-comma F sharp under a koma-sharp-F
    // signature, printed bare — the two-layer written/sounding design, ROADMAP §Phase 4).
    // Explicit signs mark genuine chromatic deviations only (direction change or natural).
    const covered =
      alter === effective ||
      (sigTolerant && effective !== 0 && alter !== 0 && Math.sign(alter) === Math.sign(effective));
    if (!covered) {
      acc = alter === 0 ? `${NATURAL_TOKEN} ` : `${AEU_TOKEN[alter]} `;
      if (carryUpdate) carry.set(posKey, alter);
    }
  } else if (!signature) {
    if (alter !== 0) acc = `${AEU_TOKEN[alter]} `;
  } else {
    const sigAlter = signature.get(parsed.letter) ?? 0;
    if (alter !== sigAlter) acc = alter === 0 ? `${NATURAL_TOKEN} ` : `${AEU_TOKEN[alter]} `;
  }
  const oct = lilyOctave(parsed.octave);
  const letter = parsed.letter.toLowerCase();
  const text = `${acc}${letter}${oct}${dur}`;
  // tokens ≈ accidental/natural(1) + letter(1) + each octave mark(1) + each duration char(1).
  const tokens = (acc !== "" ? 1 : 0) + 1 + oct.length + dur.length;
  return { text, tokens };
}

/**
 * Serialize a drawn key signature into the row-start prefix, e.g. `\sig \komaFlat b \sigend`.
 * Emitted only for strips whose crop shows the row start (clef + signature). An empty signature
 * still yields `\sig \sigend` — an explicit "row start, nothing in the signature" marker.
 */
export function serializeSignature(
  entries: ReadonlyArray<{ letter: string; alterCommas: number }>,
): { label: string; tokens: number } {
  const parts: string[] = [SIG_TOKEN];
  for (const e of entries) {
    const tok = AEU_TOKEN[e.alterCommas];
    if (!tok) continue; // signature entries are AEU-snapped upstream; skip anything else defensively
    parts.push(tok, e.letter.toLowerCase());
  }
  parts.push(SIG_END_TOKEN);
  return { label: parts.join(" "), tokens: parts.length };
}

/** Inverse of `serializeSignature`: parse a signature body — `\komaFlat b \bakiyeSharp c`, drawn
 *  order — into key-signature entries. The `\sig`/`\sigend` wrapper is tolerated if present, so
 *  both a bare body and a full prefix parse. Used to feed a makam's CONVENTIONAL PRINTED signature
 *  (`data/makam_signatures.json`, built by `scripts/build_makam_signatures.py` from the confirmed
 *  real-page labels) into BOTH the draw path (SheetView) and the label path (stripExport), so
 *  synthetic carry-mode strips wear the makam's real printed signature instead of the
 *  content-derived `deriveKeySignature`. Throws on a malformed body rather than silently drop. */
const ALTER_OF_TOKEN: Record<string, number> = Object.fromEntries(
  Object.entries(AEU_TOKEN).map(([commas, tok]) => [tok, Number(commas)]),
);

export function parseSignatureBody(body: string): { letter: string; alterCommas: number }[] {
  const toks = body
    .replace(SIG_TOKEN, " ")
    .replace(SIG_END_TOKEN, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const entries: { letter: string; alterCommas: number }[] = [];
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i]!;
    const alter = ALTER_OF_TOKEN[tok];
    if (alter === undefined) throw new Error(`bad signature token '${tok}' in "${body}"`);
    const letter = (toks[i + 1] ?? "").toUpperCase();
    if (!/^[A-G]$/.test(letter)) throw new Error(`'${tok}' not followed by a letter A–G in "${body}"`);
    entries.push({ letter, alterCommas: alter });
    i++;
  }
  return entries;
}

/** One unsplittable label unit for strip packing: a plain note/rest, a whole `\tup3 … \tupend`
 *  group, a tied written pair, or a grace glued to its host — splitting any of these across a
 *  strip boundary would orphan half a sign, so packing treats each atom as one piece. */
export interface LabelAtom {
  text: string;
  tokens: number;
}

/** Spell the continuation note of a tie: bare letter+octave+duration — engraving never
 *  restrikes the accidental on the tied-to note, in ANY accidental mode. */
function tieTailToLily(ev: NoteEvent, writtenBeats: number): LabelAtom {
  const dur = lilyDuration(writtenBeats);
  const parsed = parseNoteName(ev.noteName);
  if (!parsed) return { text: `r${dur}`, tokens: 1 + dur.length };
  const oct = lilyOctave(parsed.octave);
  return {
    text: `${parsed.letter.toLowerCase()}${oct}${dur}`,
    tokens: 1 + oct.length + dur.length,
  };
}

/** The written duration a grace note spells/draws: a small slashed 8th by convention —
 *  SymbTr gives çarpma rows no duration of their own (Pay/Payda 0). */
const GRACE_WRITTEN_BEATS = 1 / 8;

/** `\grace` + the small note's own spelling (accidental per the same faithful rule as notes).
 *  In carry mode the grace's accidental prints by the shared decision but never sets the
 *  measure's state (`carryUpdate = false` — matching SheetView's grace handling). */
function graceToLily(
  ev: NoteEvent,
  signature?: SignatureMap,
  carry?: CarryState,
  sigTolerant = false,
): LabelAtom {
  const inner = noteToLily(ev, signature, GRACE_WRITTEN_BEATS, carry, false, sigTolerant);
  return { text: `${GRACE_TOKEN} ${inner.text}`, tokens: 1 + inner.tokens };
}

/** Merge consecutive atoms into one (used to glue graces to the atom that follows them). */
function mergeAtoms(parts: LabelAtom[]): LabelAtom {
  return {
    text: parts.map((p) => p.text).join(" "),
    tokens: parts.reduce((s, p) => s + p.tokens, 0),
  };
}

/**
 * Serialize one measure's events into unsplittable label atoms, applying the rhythm signs
 * (rhythm.ts — the SAME detection SheetView draws from):
 *  - a triplet group becomes ONE atom `\tup3 <members at ×3/2 written durations> \tupend`;
 *  - an undrawable long value becomes a tied written pair `x \tie x` (notes) or two plain
 *    side-by-side rests (rests are never tied);
 *  - a grace note (`\grace` + its small-8th spelling) glues onto the atom that follows it
 *    (its main note), so packing can't separate them. A grace with NO following event in its
 *    measure (only possible at the very end of a piece — `assignBars` moves a barline grace
 *    into the next bar) is dropped: VexFlow can only draw a grace attached to a host note, so
 *    the label must not carry what the pixels can't show.
 */
export function measureAtoms(
  m: Measure,
  signature?: SignatureMap,
  carry = false,
  sigTolerant = false,
): LabelAtom[] {
  const evs = m.events;
  const groups = tupletGroupsIn(evs);
  const atoms: LabelAtom[] = [];
  let pendingGraces: LabelAtom[] = [];
  // "measure" (carry) mode: fresh per-measure state — carry is measure-scoped, so creating it
  // here IS the barline reset.
  const state: CarryState | undefined = carry ? new Map() : undefined;

  const push = (atom: LabelAtom) => {
    atoms.push(pendingGraces.length > 0 ? mergeAtoms([...pendingGraces, atom]) : atom);
    pendingGraces = [];
  };

  for (let i = 0; i < evs.length; i++) {
    const ev = evs[i]!;
    const group = groups.find((g) => g.from === i);
    if (group) {
      // Whole bracketed group as one atom; inner graces spell in place, attached by position.
      const parts: LabelAtom[] = [{ text: TUP3_TOKEN, tokens: 1 }];
      for (let j = group.from; j <= group.to; j++) {
        const member = evs[j]!;
        parts.push(
          member.kind === "grace"
            ? graceToLily(member, signature, state, sigTolerant)
            : noteToLily(member, signature, tupletWrittenBeats(member), state, true, sigTolerant),
        );
      }
      parts.push({ text: TUP_END_TOKEN, tokens: 1 });
      push(mergeAtoms(parts));
      i = group.to;
      continue;
    }
    if (ev.kind === "grace") {
      pendingGraces.push(graceToLily(ev, signature, state, sigTolerant));
      continue;
    }
    const split = tieSplitBeats(ev);
    if (split) {
      const parts: LabelAtom[] = [noteToLily(ev, signature, split[0]!, state, true, sigTolerant)];
      for (const beats of split.slice(1)) {
        if (ev.kind === "note") parts.push({ text: TIE_TOKEN, tokens: 1 });
        parts.push(tieTailToLily(ev, beats));
      }
      push(mergeAtoms(parts));
      continue;
    }
    push(noteToLily(ev, signature, undefined, state, true, sigTolerant));
  }
  // Dangling graces (nothing after them in the measure) are dropped — see the doc comment.
  return atoms;
}

/** Serialize one measure's events to a LilyPond fragment + its token estimate.
 *  `carry = true` selects "measure" (carry) mode; `sigTolerant = true` additionally writes
 *  same-direction intonation refinements of the effective alteration BARE (the real
 *  printed-page convention — see noteToLily). */
export function serializeMeasure(
  m: Measure,
  signature?: SignatureMap,
  carry = false,
  sigTolerant = false,
): { label: string; tokens: number } {
  const merged = mergeAtoms(measureAtoms(m, signature, carry, sigTolerant));
  return { label: merged.text, tokens: merged.tokens };
}

/**
 * Serialize a contiguous run of measures into one strip label (measures joined by ` | `), plus the
 * total token estimate. Used by the cropping renderer: a strip is a set of whole measures (so the
 * crop falls on barlines), and this produces the matching faithful label for the render mode
 * implied by `signature` (absent = "every", present = "keysig").
 *
 * `repeatSpans` (from `foldRepeats` — the SAME spans SheetView draws) adds the repeat tokens,
 * faithfully at their drawn positions: `\repstart`/`\repend` replace the `|` at their boundary
 * (or open/close the strip when the sign sits on the crop edge); `\volta1`/`\volta2` precede the
 * bracketed measure's first note. A strip overlapping only one end of a repeat gets only that
 * end's token — label == pixels, exactly like the accidentals.
 *
 * `navMarks` (from `injectNavMarks` — again the SAME marks SheetView draws) adds the navigation
 * tokens at their drawn edges: start-edge marks (𝄋 / ⊕ over the first note) right before the
 * measure's notes, end-edge marks (⊕ / "D.C." / "Son" at the right barline) right after them.
 */
export function serializeMeasures(
  ms: Measure[],
  signature?: SignatureMap,
  repeatSpans?: readonly RepeatSpan[],
  navMarks?: readonly NavMark[],
  carry = false,
  sigTolerant = false,
): { label: string; tokens: number } {
  const parts: string[] = [];
  let tokens = 0;
  const push = (text: string, cost: number) => {
    parts.push(text);
    tokens += cost;
  };

  ms.forEach((m, i) => {
    const marks = repeatMarksAt(m.index, repeatSpans);
    const nav = navMarksAt(m.index, navMarks);
    const prevEnds = i > 0 && repeatMarksAt(ms[i - 1]!.index, repeatSpans).repEnd;
    // Boundary at this measure's left edge: repeat barlines replace the plain `|`.
    if (prevEnds) push(REP_END_TOKEN, 1);
    if (marks.repStart) push(REP_START_TOKEN, 1);
    else if (i > 0 && !prevEnds) push("|", 1);
    // Marks over this measure's opening: volta bracket, then start-edge nav marks (𝄋 / ⊕).
    if (marks.volta1) push(VOLTA1_TOKEN, 1);
    if (marks.volta2) push(VOLTA2_TOKEN, 1);
    for (const nm of nav.start) push(NAV_TOKEN[nm.type], 1);
    const body = serializeMeasure(m, signature, carry, sigTolerant);
    push(body.label, body.tokens);
    // Marks at this measure's right barline (⊕ / "D.C." / "Son").
    for (const nm of nav.end) push(NAV_TOKEN[nm.type], 1);
  });
  // The `:‖` on the strip's right edge (the crop ends exactly at that barline).
  if (ms.length > 0 && repeatMarksAt(ms[ms.length - 1]!.index, repeatSpans).repEnd) push(REP_END_TOKEN, 1);

  return { label: parts.join(" "), tokens };
}

/** One rendered strip: which measures it spans, its LilyPond label, and the token estimate. */
export interface Strip {
  /** 1-based measure indices covered (inclusive). */
  fromMeasure: number;
  toMeasure: number;
  /** The LilyPond label (notes separated by spaces, measures by ` | `). */
  label: string;
  /** Rough token-count estimate (to stay under the model's decoder cap). */
  estTokens: number;
}

/** A single label atom flattened with the measure it belongs to (for barline placement during
 *  packing). Atoms — not raw notes — so a `\tup3` group, tie pair, or grace+host never splits. */
interface FlatNote {
  text: string;
  tokens: number;
  measure: number;
}

/**
 * Split a score into short, self-contained strips for rendering + fine-tuning.
 *
 * Emits "every"-mode faithful labels (every drawn alteration marked, no signature) — the browser-side
 * exporter (`apps/web/src/stripExport.ts`) is the one that handles keysig-mode strips, because only
 * it knows the row layout (which crops include the signature).
 *
 * Packs note-by-note up to `maxTokens` (well under the model's ~60-token decoder cap), inserting a
 * `|` barline token at each measure boundary. Note-level (not whole-measure) packing guarantees no
 * strip can exceed the budget even when a single dense 16th-note measure is longer than the cap; a
 * very dense measure simply spills across strips. `maxMeasures` caps how many measures one strip may
 * span so strips stay visually short too.
 */
export function docToStrips(
  doc: NoteModelDocument,
  { maxMeasures = STRIP_BUDGET.maxMeasures, maxTokens = STRIP_BUDGET.maxTokens }: { maxMeasures?: number; maxTokens?: number } = {},
): Strip[] {
  const flat: FlatNote[] = [];
  for (const m of groupMeasures(doc)) {
    for (const { text, tokens } of measureAtoms(m)) {
      flat.push({ text, tokens, measure: m.index });
    }
  }

  const strips: Strip[] = [];
  let parts: string[] = [];
  let fromMeasure = 0;
  let prevMeasure = 0;
  let tokens = 0;

  const flush = () => {
    if (parts.length === 0) return;
    strips.push({ fromMeasure, toMeasure: prevMeasure, label: parts.join(" "), estTokens: tokens });
    parts = [];
    tokens = 0;
  };

  for (const n of flat) {
    const newMeasure = parts.length > 0 && n.measure !== prevMeasure;
    const cost = n.tokens + (newMeasure ? 1 : 0); // +1 for the ` | ` barline
    const spanWouldExceed = newMeasure && n.measure - fromMeasure + 1 > maxMeasures;
    if (parts.length > 0 && (tokens + cost > maxTokens || spanWouldExceed)) flush();
    if (parts.length === 0) fromMeasure = n.measure;
    else if (n.measure !== prevMeasure) parts.push("|"); // barline between measures within a strip
    parts.push(n.text);
    tokens += cost;
    prevMeasure = n.measure;
  }
  flush();
  return strips;
}
