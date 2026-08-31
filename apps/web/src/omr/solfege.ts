/**
 * Note letters → the syllables the owner reads (`do re mi fa sol la si`).
 *
 * ONE definition, used by two views that show model output verbatim: the slice inspector
 * (`slices/slicesView.ts`) and the raw decode panel (`ui/DecodePanel.tsx`). It mirrors what
 * `scripts/rung3/review_ui.py` does for the labelling queues, so a strip reads the same way in the
 * app as it does in the review tool.
 *
 * ⚠ This is a DISPLAY rewrite and nothing else. The tokens themselves, the `Save`/download JSON,
 * the stitcher and every label the corpus stores stay in LilyPond letters — that is the alphabet
 * the model was trained on, and inventing a second spelling for storage would break every diff.
 */

/**
 * LilyPond note letter → the solfège syllable the rest of the app uses (`packages/core`'s
 * `spellNote`). Lower-case here because a decoded token is lower-case: `b'16` reads as `si'16`.
 */
const LETTER_TO_SOLFEGE: Record<string, string> = {
  c: "do",
  d: "re",
  e: "mi",
  f: "fa",
  g: "sol",
  a: "la",
  b: "si",
};

/** A note token: letter, octave marks, an OPTIONAL duration, dots. `\d*` is what lets a bare
 *  signature letter (`\sig \bakiyeFlat b`) be renamed too — it carries no duration. */
const NOTE_TOKEN = /^([a-g])([',]*)(\d*)(\.*)$/;

/** One VOCABULARY token: a bare letter, with or without the BPE word-end marker (`a`, `b</w>`). */
const VOCAB_LETTER = /^([a-g])(<\/w>)?$/;

/**
 * Rewrite one decoded token with its note name, leaving everything else exactly as the model
 * emitted it: `b'16` → `si'16`, `\komaSharp` → `\komaSharp`, `r4` → `r4`.
 *
 * Rests are deliberately NOT renamed. The note model calls a rest "Es", but `r` is unambiguous in
 * the token stream and inventing a second spelling for it would make the two harder to compare.
 */
export function toSolfegeToken(tok: string): string {
  const m = NOTE_TOKEN.exec(tok);
  if (!m) return tok;
  const [, letter, octave, dur, dots] = m;
  return `${LETTER_TO_SOLFEGE[letter!] ?? letter}${octave}${dur}${dots}`;
}

/** The whole label, token by token. Whitespace is normalized to single spaces. */
export function toSolfegeLabel(tokens: string): string {
  return tokens.trim().split(/\s+/).filter(Boolean).map(toSolfegeToken).join(" ");
}

/**
 * The same rename one level lower: on a SUB-WORD token out of the model's own vocabulary, where a
 * note is spelled across several pieces (`c''8` is `c` `'` `'` `8</w>`). Only a lone letter is a
 * pitch there — the octave marks, the digits and the `</w>` marker are separate tokens — so
 * `a` → `la` and `b</w>` → `si</w>`, and everything else is returned untouched.
 *
 * Safe because the label alphabet has no words in it: across the 25,781 label/decode cells in the
 * real pools, every token is a note, a rest, `|`, or a `\command`. A letter token is a pitch.
 */
export function toSolfegeVocabToken(tok: string): string {
  const m = VOCAB_LETTER.exec(tok);
  if (!m) return tok;
  return `${LETTER_TO_SOLFEGE[m[1]!] ?? m[1]}${m[2] ?? ""}`;
}
