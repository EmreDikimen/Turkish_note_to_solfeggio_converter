/**
 * Makam identification and PERFORMED intonation — pipeline stage 9.
 *
 * Two jobs, both about the gap between what a page prints and what a player does:
 *
 *  1. **Which makam is this?** A decoded page carries no metadata (`stitch.ts` writes
 *     `makam: ""`), so we guess it from the score itself: the derived key signature plus the
 *     karar (the note the piece ends on). Signature alone is not enough — `\komaFlat b
 *     \bakiyeFlat e \bakiyeSharp f` is printed by hüzzam, karcığar AND sûznâk, three makams
 *     with three different intonations, and only the karar tells them apart.
 *
 *  2. **How does it actually sound?** Arel-Ezgi-Uzdilek has four accidentals and several perdes
 *     are performed away from all of them, because notation has no sign for where they really
 *     sit. Uşşak's segah is played flatter than its written koma-bemol; Sabâ's hicaz is played
 *     sharper than its written bakiye-bemol; Hüzzam's hisar is played higher. `MAKAM_INTONATION`
 *     is that table, in commas, applied to the SOUNDING koma only.
 *
 * ⚠ The written staff never moves. These deltas reach `buildTimeline` and nothing else — not the
 * engraving, not the saved JSON, not the training strips. Selecting a makam changes what you
 * hear, never what the OMR claims it read. `none` (empty slug) is the identity and the default.
 *
 * ⚠ Rules match a note by its WRITTEN letter + alteration, at every octave. That is correct for
 * canonical Turkish notation, which writes each makam at its own perde (uşşak on dügâh = A), and
 * it is wrong for a page transposed to some other key — there is no degree-relative resolution
 * yet. The app applies the deltas AFTER any user transpose, keyed by event index, so the user's
 * transpose control cannot desync the rules from the spelling they were read from.
 *
 * The numbers, their sources, and what was deliberately left out: docs/mvp/makam.md.
 */

import type { NoteModelDocument } from "./types";
import { deriveKeySignature, parseNoteName, type KeySignatureEntry } from "./notation";
import { makamDisplay } from "./metadata";
import { MAKAM_SIGNATURES } from "./makamSignatures";

/**
 * Signed comma alteration → the label token that spells it in a signature.
 *
 * Deliberate small twin of `AEU_TOKEN` in `tools/render/lilypond.ts`: `packages/core` must not
 * import from `tools/`, and the label path is load-bearing enough that it does not move here.
 * `tools/render/stitch-test.ts` round-trips every signature in `MAKAM_SIGNATURES` through both
 * vocabularies, so a drift between the two copies fails a test instead of silently breaking
 * detection.
 */
export const SIG_TOKEN_BY_ALTER: Record<number, string> = {
  1: "\\komaSharp",
  [-1]: "\\komaFlat",
  4: "\\bakiyeSharp",
  [-4]: "\\bakiyeFlat",
  5: "\\kucukSharp",
  [-5]: "\\kucukFlat",
  8: "\\buyukSharp",
  [-8]: "\\buyukFlat",
};

/**
 * Key-signature entries → the lookup string `MAKAM_SIGNATURES` is keyed on
 * (`"\komaFlat b \bakiyeSharp f"`, drawn order, lowercase letters).
 *
 * Non-AEU alterations are skipped rather than guessed at: signature entries are AEU-snapped
 * upstream by `deriveKeySignature`, so anything else here would be a bug, not a spelling.
 */
export function signatureKey(entries: ReadonlyArray<KeySignatureEntry>): string {
  const parts: string[] = [];
  for (const e of entries) {
    const tok = SIG_TOKEN_BY_ALTER[e.alterCommas];
    if (!tok) continue;
    parts.push(tok, e.letter.toLowerCase());
  }
  return parts.join(" ");
}

/** Normalise a makam name to the table's key form — the TS twin of `norm()` in the builder. */
export function normMakam(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Follow a spelling alias ("nihavent" → "nihavend") to the entry that carries the real data. */
export function resolveMakam(name: string): string {
  const k = normMakam(name);
  return MAKAM_SIGNATURES[k]?.aliasOf ?? (MAKAM_SIGNATURES[k] ? k : "");
}

// ---------------------------------------------------------------------------------------------
// Karar — the perde a piece comes to rest on, as it is WRITTEN.
// ---------------------------------------------------------------------------------------------

export interface Karar {
  /** Western letter C..B of the final note. */
  letter: string;
  /** Its written comma alteration (segah karar = B at −1, i.e. a koma-bemol si). */
  alterCommas: number;
}

/**
 * Written karar per makam — only where it is needed or certain.
 *
 * Coverage is deliberately partial. A karar entry earns its place by disambiguating makams that
 * share a printed signature, or by belonging to a makam that carries an intonation rule; guessing
 * the rest would add wrong labels for no gain, since a makam with no rules sounds identical
 * whatever we call it. Makams with no entry here simply fall through to corpus-weight ranking.
 */
export const MAKAM_KARAR: Record<string, Karar> = {
  // Dügâh (La). The uşşak family and its neighbours.
  ussak: { letter: "A", alterCommas: 0 },
  beyati: { letter: "A", alterCommas: 0 },
  bayati: { letter: "A", alterCommas: 0 },
  isfahan: { letter: "A", alterCommas: 0 },
  besteisfahan: { letter: "A", alterCommas: 0 },
  bestenigar: { letter: "A", alterCommas: 0 },
  saba: { letter: "A", alterCommas: 0 },
  sipihr: { letter: "A", alterCommas: 0 },
  karcigar: { letter: "A", alterCommas: 0 },
  huseyni: { letter: "A", alterCommas: 0 },
  muhayyer: { letter: "A", alterCommas: 0 },
  muhayyerkurdi: { letter: "A", alterCommas: 0 },
  tahir: { letter: "A", alterCommas: 0 },
  hicaz: { letter: "A", alterCommas: 0 },
  hicazhumayun: { letter: "A", alterCommas: 0 },
  uzzal: { letter: "A", alterCommas: 0 },
  sehnaz: { letter: "A", alterCommas: 0 },
  kurdi: { letter: "A", alterCommas: 0 },
  acemkurdi: { letter: "A", alterCommas: 0 },

  // Segâh (Si koma-bemol) — the pair that must not be confused with karcığar/sûznâk.
  segah: { letter: "B", alterCommas: -1 },
  huzzam: { letter: "B", alterCommas: -1 },

  // Rast (Sol).
  rast: { letter: "G", alterCommas: 0 },
  suznak: { letter: "G", alterCommas: 0 },
  suzinak: { letter: "G", alterCommas: 0 },
  nihavend: { letter: "G", alterCommas: 0 },
  kurdilihicazkar: { letter: "G", alterCommas: 0 },
  hicazkar: { letter: "G", alterCommas: 0 },
  mahur: { letter: "G", alterCommas: 0 },
};

// ---------------------------------------------------------------------------------------------
// The intonation table.
// ---------------------------------------------------------------------------------------------

export interface IntonationRule {
  /** Western letter of the WRITTEN note this rule matches, at every octave. */
  letter: string;
  /** The WRITTEN comma alteration it matches (so `B` at −1 is a koma-bemol si, not any si). */
  alterCommas: number;
  /** Signed commas added to the SOUNDING koma. Fractional on purpose — audio is float. */
  deltaCommas: number;
  /** Why, in plain Turkish — this is shown in the makam prompt. The table is its own
   *  documentation; the English rationale and the sources live in docs/mvp/makam.md. */
  why: string;
}

/**
 * Uşşak's segah, shared by the whole family.
 *
 * AEU writes dügâh→segah as a büyük mücennep (8 commas, 181 cents) and spells it Si koma-bemol.
 * It is not played there: sources put the interval at 6–7 commas, the "eksik büyük mücennep",
 * and the descent pulls it lower still. −1.5 commas is the midpoint of that range (owner call,
 * 2026-08-06), landing the interval at 6.5 commas ≈ 147 cents.
 */
const USSAK_SEGAH: IntonationRule = {
  letter: "B",
  alterCommas: -1,
  deltaCommas: -1.5,
  why: "Uşşak'ın segâhı yazılı koma-bemolünün altında icra edilir: dügâh→segâh pratikte 6–7 komadır ('eksik büyük mücennep'), AEU'nun 8'i değil.",
};

/**
 * Written accidental → sounding koma, per makam. Keyed by normalised makam name.
 *
 * ONLY rules with a source behind them. A makam listed with an empty array is a deliberate
 * record that it does NOT deviate — hüseyni and muhayyer are the documented counter-example to
 * uşşak, and writing that down is what stops someone "completing" the table by symmetry later.
 * Every other makam is absent, selectable, and plays as written.
 */
export const MAKAM_INTONATION: Record<string, IntonationRule[]> = {
  // --- the uşşak family: one lowered segah, nothing else claimed ---
  ussak: [USSAK_SEGAH],
  beyati: [USSAK_SEGAH],
  bayati: [USSAK_SEGAH],
  isfahan: [USSAK_SEGAH],
  besteisfahan: [USSAK_SEGAH],
  bestenigar: [USSAK_SEGAH],
  // Karcığar opens with the same uşşak tetrachord on dügâh. Its hicaz on nevâ is direction-
  // dependent (an "average hicaz", ascending ≠ descending) and is NOT modelled — these rules
  // have no direction axis.
  karcigar: [USSAK_SEGAH],

  saba: [
    USSAK_SEGAH,
    {
      letter: "D",
      alterCommas: -4,
      deltaCommas: 1.5,
      why: "Sabâ'nın hicazı yazılı bakiye-bemolünden tiz icra edilir: Rauf Yektâ'nın 12/11 çargâh–hicazı re-bemole 4 değil 2,5 koma pestlik verir.",
    },
  ],

  // --- segâh family ---
  segah: [
    {
      letter: "B",
      alterCommas: -1,
      deltaCommas: -1,
      why: "Osmanlı segâh perdesi, Arel'inkinin yaklaşık bir koma altındadır.",
    },
  ],
  huzzam: [
    {
      letter: "B",
      alterCommas: -1,
      deltaCommas: -1,
      why: "Osmanlı segâh perdesi, Arel'inkinin yaklaşık bir koma altındadır.",
    },
    {
      letter: "E",
      alterCommas: -4,
      deltaCommas: 1,
      why: "Hüzzam'ın hisarı yazılı bakiye-bemolünün üstünde icra edilir: beşlinin artık ikilisi 12 komadan 10,5–11'e daralır.",
    },
  ],

  // --- documented NON-deviations. Present on purpose; do not "complete" these. ---
  // The uşşak lowering is explicitly reported as absent here: hüseyni approaches segah higher,
  // which is audible in its cadences. Same printed si koma-bemol, different perde.
  huseyni: [],
  muhayyer: [],
  tahir: [],
};

/** The intonation rules for a makam ( `[]` for `none`, unknown makams, and documented non-deviators ). */
export function makamIntonation(slug: string): IntonationRule[] {
  const k = resolveMakam(slug) || normMakam(slug);
  return MAKAM_INTONATION[k] ?? [];
}

/** Does selecting this makam actually bend anything? Drives the ♪ marker in the dropdown. */
export function makamHasIntonation(slug: string): boolean {
  return makamIntonation(slug).length > 0;
}

/**
 * Does the table SAY anything about this makam — including "it does not deviate"?
 *
 * ⚠ Two different answers come back as an empty rule list and the UI must not merge them.
 * Hüseyni's `[]` is a finding: sources report it does NOT take the uşşak lowering. An absent
 * makam is silence: nobody has looked, and it may well deviate. Saying "no deviation" for the
 * second would dress an unmeasured makam as a measured one.
 */
export function makamIntonationRecorded(slug: string): boolean {
  const k = resolveMakam(slug) || normMakam(slug);
  return MAKAM_INTONATION[k] !== undefined;
}

// ---------------------------------------------------------------------------------------------
// The dropdown list.
// ---------------------------------------------------------------------------------------------

export interface MakamOption {
  /** Normalised slug, the value stored in `doc.makam`. */
  slug: string;
  /** Display name via `makamDisplay` ("Uşşak", "Hüzzam"). */
  label: string;
  /** True when the makam carries intonation rules. */
  hasIntonation: boolean;
}

/**
 * Every makam the app knows, sorted by display name. Spelling aliases are folded away so
 * "Nihâvend" appears once, not twice.
 */
export function makamOptions(): MakamOption[] {
  const out: MakamOption[] = [];
  for (const [slug, entry] of Object.entries(MAKAM_SIGNATURES)) {
    if (entry.aliasOf) continue;
    out.push({ slug, label: makamDisplay(slug), hasIntonation: makamHasIntonation(slug) });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

// ---------------------------------------------------------------------------------------------
// Detection.
// ---------------------------------------------------------------------------------------------

export interface MakamDetection {
  /** Best guess, or null when nothing matched (the UI shows "none"). */
  slug: string | null;
  /** Equally-signatured runners-up, best-ranked first — offered as alternatives in the popup. */
  alternatives: string[];
  /** The signature the score itself derives to ("" when the score has no accidentals at all). */
  signature: string;
  /** The written karar the guess used, or null when the score ends on nothing readable. */
  karar: Karar | null;
  /** True when the karar actually narrowed the candidates (i.e. the guess is the strong kind). */
  kararMatched: boolean;
}

/** The last sounding note of a score, as written — the karar. */
function findKarar(doc: NoteModelDocument): Karar | null {
  for (let i = doc.events.length - 1; i >= 0; i--) {
    const ev = doc.events[i]!;
    if (ev.kind !== "note") continue;
    const p = parseNoteName(ev.noteName);
    if (p) return { letter: p.letter, alterCommas: p.alterCommas };
  }
  return null;
}

/** How much real evidence stands behind a makam printing this exact signature. */
function weightFor(slug: string, sig: string): number {
  const entry = MAKAM_SIGNATURES[slug];
  if (!entry) return 0;
  let best = 0;
  for (const v of entry.variants) if (v.sig === sig) best = Math.max(best, v.n);
  return best;
}

/**
 * Guess a score's makam from its own notes: derived signature first, then the karar to split the
 * makams that share it, then corpus weight to rank what is left.
 *
 * Returns `slug: null` rather than a nearest-neighbour guess when no makam prints this
 * signature. A wrong makam bends pitches that should not move; "none" only declines to help.
 */
export function detectMakam(doc: NoteModelDocument): MakamDetection {
  const signature = signatureKey(deriveKeySignature(doc));
  const karar = findKarar(doc);

  const candidates: string[] = [];
  for (const [slug, entry] of Object.entries(MAKAM_SIGNATURES)) {
    if (entry.aliasOf) continue; // the target carries the same variants
    if (entry.variants.some((v) => v.sig === signature)) candidates.push(slug);
  }
  if (candidates.length === 0) {
    return { slug: null, alternatives: [], signature, karar, kararMatched: false };
  }

  const byWeight = (a: string, b: string) =>
    weightFor(b, signature) - weightFor(a, signature) || a.localeCompare(b);

  // Narrow by karar. Exact (letter + written alteration) first, then letter-only — a page can end
  // on the right perde spelled a little differently, and that is still better evidence than none.
  let narrowed: string[] = [];
  let kararMatched = false;
  const known = karar ? candidates.filter((s) => MAKAM_KARAR[s]) : [];
  if (karar) {
    narrowed = known.filter(
      (s) => MAKAM_KARAR[s]!.letter === karar.letter && MAKAM_KARAR[s]!.alterCommas === karar.alterCommas,
    );
    if (narrowed.length === 0) narrowed = known.filter((s) => MAKAM_KARAR[s]!.letter === karar.letter);
    kararMatched = narrowed.length > 0;
  }

  // The karar CONTRADICTS the signature: some candidate declares where it should end and the
  // piece ends somewhere else. Decline rather than rank — measured on the 213 bundled scores this
  // trades 2 wrongly-bent pieces for 2 that merely stay as written, which is the trade this
  // function exists to make. (Candidates still come back as alternatives, so the prompt can offer
  // them.) When NO candidate declares a karar there is no contradiction, only silence, and the
  // corpus ranking below is the best evidence available.
  if (karar && known.length > 0 && !kararMatched) {
    return { slug: null, alternatives: [...candidates].sort(byWeight), signature, karar, kararMatched: false };
  }
  if (narrowed.length === 0) narrowed = candidates;

  narrowed.sort(byWeight);
  return { slug: narrowed[0]!, alternatives: narrowed.slice(1), signature, karar, kararMatched };
}

// ---------------------------------------------------------------------------------------------
// Applying the deltas.
// ---------------------------------------------------------------------------------------------

/**
 * Which events the selected makam bends, and by how many commas — keyed by `NoteEvent.index`.
 *
 * Read from the doc's OWN written spelling, which is why this takes the base doc and not the
 * transposed one: `transposeDoc` respells every note from its koma, so by then the letters the
 * rules match on are gone. Index-keyed so the result stays valid across a transpose.
 *
 * ⚠ The keys are the WRITTEN document's indices. A transpose keeps them; **`unfoldDoc` does not** —
 * put the result through `remapKomaDeltas` before applying it to a performance.
 */
export function makamKomaDeltas(doc: NoteModelDocument | null, slug: string): Map<number, number> {
  const deltas = new Map<number, number>();
  const rules = makamIntonation(slug);
  eachRuleMatch(doc, rules, (ri, index) => deltas.set(index, rules[ri]!.deltaCommas));
  return deltas;
}

/**
 * One pass over a document's written notes, handing every match to its rule.
 *
 * ⚠ Shared by `makamKomaDeltas` (which wants the deltas) and `makamRuleUsage` (which wants the
 * counts) so the two can never disagree about which notes a makam touches — the count shown beside
 * the picker is a promise about the pitches playback will actually bend, and a second loop is how
 * that promise quietly stops being true. A rule with a zero delta is skipped in both: it moves
 * nothing, so it is not a deviation.
 */
function eachRuleMatch(
  doc: NoteModelDocument | null,
  rules: readonly IntonationRule[],
  visit: (ruleIndex: number, eventIndex: number) => void,
): void {
  if (!doc || rules.length === 0) return;
  for (const ev of doc.events) {
    if (ev.kind !== "note" && ev.kind !== "grace") continue;
    const p = parseNoteName(ev.noteName);
    if (!p) continue;
    const ri = rules.findIndex(
      (r) => r.letter === p.letter && r.alterCommas === p.alterCommas && r.deltaCommas !== 0,
    );
    if (ri >= 0) visit(ri, ev.index);
  }
}

/** A rule, and how many of THIS score's notes it reaches. */
export interface MakamRuleUse {
  rule: IntonationRule;
  /** Matching notes in the document. 0 is a real answer: the rule bends nothing here. */
  count: number;
}

/**
 * The makam's rules against one score — what the picker's hint shows.
 *
 * The count is the honest half. A makam's rule is a claim about a perde, not about this piece:
 * hüzzam bends its hisar, and a hüzzam page that never writes one sounds exactly as printed. So
 * the hint states both, and `count: 0` says so rather than implying a change nobody will hear.
 * Read from the BASE doc, for the same reason `makamKomaDeltas` is — a transpose respells every
 * note and the letters these rules key on are gone by then.
 */
export function makamRuleUsage(doc: NoteModelDocument | null, slug: string): MakamRuleUse[] {
  const rules = makamIntonation(slug);
  const counts = rules.map(() => 0);
  eachRuleMatch(doc, rules, (ri) => {
    counts[ri]! += 1;
  });
  return rules
    .map((rule, i) => ({ rule, count: counts[i]! }))
    .filter((u) => u.rule.deltaCommas !== 0);
}

/**
 * Move the deltas from the WRITTEN document onto the PERFORMANCE — the step that must not be skipped.
 *
 * ⛔ **`unfoldDoc` renumbers every event**, so a delta map keyed by written indices is WRONG against
 * its output, and wrong in the worst way: the numbers still all exist, so nothing throws — the bend
 * simply lands on some other note. Two things renumber even a page with no repeat at all: the
 * unfolder drops `meta` events (`groupMeasures` skips them, which shifts every later index down),
 * and a repeated bar appears more than once. Measured on `gamzedeyim-deva` under uşşak before this
 * existed: **19 of 22 bent notes were the wrong ones** — a Re, a La, a Do and a 2-koma si taking the
 * lowering meant for the segah, while three landed right by luck. That is exactly what it sounds
 * like (owner, 2026-09-05: *"bazen la farklı çalıyor, bazen re, bazen mi… bazen de doğru"*).
 *
 * `srcOf` is `UnfoldedScore.srcOf` — performance index → the written event it came from. A repeated
 * bar has several performance indices pointing at one written note, and each copy gets the delta,
 * which is what makes the second pass of a repeat sound like the first.
 *
 * ⚠ Re-key rather than bending the doc BEFORE unfolding: `perf.doc` is handed to the instrument
 * views, and a course on the kanun is looked up by an exact WRITTEN koma — a fractional one misses.
 * The bend belongs to the timeline and to nothing else.
 */
export function remapKomaDeltas(
  deltas: ReadonlyMap<number, number>,
  srcOf: ReadonlyMap<number, number>,
): Map<number, number> {
  const out = new Map<number, number>();
  if (deltas.size === 0) return out;
  for (const [playedIndex, writtenIndex] of srcOf) {
    const d = deltas.get(writtenIndex);
    if (d !== undefined) out.set(playedIndex, d);
  }
  return out;
}

/**
 * A copy of the doc with the makam's comma deltas folded into `koma53` — and NOTHING else.
 *
 * `noteName`/`noteAE`/`freqHz` are left exactly as they were: this doc exists only to be handed
 * to `buildTimeline` (which recomputes frequency from `koma53` and ignores the cached field), so
 * the fractional komas it can hold never reach a speller. Returns the input unchanged when there
 * is nothing to apply, so `none` costs one map lookup and no allocation.
 */
export function withKomaDeltas(
  doc: NoteModelDocument,
  deltas: ReadonlyMap<number, number>,
): NoteModelDocument {
  if (deltas.size === 0) return doc;
  return {
    ...doc,
    events: doc.events.map((ev) => {
      const d = deltas.get(ev.index);
      return d === undefined ? ev : { ...ev, koma53: ev.koma53 + d };
    }),
  };
}
