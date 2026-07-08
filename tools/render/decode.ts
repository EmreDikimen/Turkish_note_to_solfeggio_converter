/**
 * Pure LilyPond-label → readable Turkish note-name decoder (browser-safe — no Node imports).
 *
 * Round-trips the serializer: turns a strip's LilyPond label back into note names like
 * `Si4b1[koma bemolü,16th]`, so labels can be verified (in the harness Strip panel, and via the CLI
 * in `decode-cli.ts`). It shows the **written AEU** note (the accidental as drawn — snapped from the
 * exact koma), by design: Phase-4's makam decoder recovers the exact koma later.
 *
 * FAITHFUL-scheme resolution (a mini-prototype of Phase 4's "written skeleton" layer): a leading
 * `\sig … \sigend` block sets each letter's default alteration; a **bare** note resolves to its
 * letter's signature entry (0 if none); an explicit accidental or `\natural` token overrides it.
 * Labels without a `\sig` block ("every"-mode strips) therefore resolve exactly as written.
 */

import { accidentalLabel, spellNote } from "@turkish-omr/core";
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

/** Repeat-sign, navigation and rhythm-sign tokens → their readable glyph. Structural markers:
 *  they never affect how the surrounding notes resolve (Phase 4 expands repeats/navigation,
 *  merges `x \tie x` into one event and attaches `\grace` notes to their host; here they just
 *  round-trip for verification — `‹3 … ›` shows the bracket, `⁀` the tie arc, `grace»` the
 *  small note that follows). */
const REPEAT_GLYPH: Record<string, string> = {
  [REP_START_TOKEN]: "‖:",
  [REP_END_TOKEN]: ":‖",
  [VOLTA1_TOKEN]: "volta1.",
  [VOLTA2_TOKEN]: "volta2.",
  [SEGNO_TOKEN]: "𝄋",
  [CODA_TOKEN]: "⊕",
  [DC_TOKEN]: "D.C.",
  [FINE_TOKEN]: "Son",
  [TUP3_TOKEN]: "‹3",
  [TUP_END_TOKEN]: "›",
  [TIE_TOKEN]: "⁀",
  [GRACE_TOKEN]: "grace»",
};

const TOKEN_TO_ALTER: Record<string, number> = Object.fromEntries(
  Object.entries(AEU_TOKEN).map(([commas, tok]) => [tok, Number(commas)]),
);
const LILY_TO_LETTER: Record<string, string> = { c: "C", d: "D", e: "E", f: "F", g: "G", a: "A", b: "B" };
const DUR_NAME: Record<string, string> = {
  "1": "whole", "2": "half", "4": "quarter", "8": "8th", "16": "16th", "32": "32nd", "64": "64th",
};

export interface Decoded {
  kind: "note" | "rest" | "bar" | "sig" | "repeat";
  /** Project-style name, e.g. "Si4b1" (rests/bars: "rest"/""; sig: readable summary). */
  name: string;
  /** Human accidental label, e.g. "koma bemolü" ("" if natural/rest). */
  accidental: string;
  /** Duration label, e.g. "16th" + dots. */
  duration: string;
}

/** Parse one note/rest token like `b'16`, `c''4.`, `r8` into (letter, octave, durationCode, dots). */
function parseLilyToken(tok: string): { letter: string | null; octave: number; dur: string; dots: number } {
  const letter = tok[0]!;
  let i = 1;
  let octave = 3; // c' = C4, so a bare letter (no marks) = octave 3
  while (tok[i] === "'" || tok[i] === ",") {
    octave += tok[i] === "'" ? 1 : -1;
    i++;
  }
  const rest = tok.slice(i);
  const digits = rest.match(/^\d+/)?.[0] ?? "";
  const dots = (rest.match(/\.+$/)?.[0] ?? "").length;
  return { letter: letter === "r" ? null : letter, octave, dur: digits, dots };
}

/** Decode a full LilyPond label string into readable note entries. */
export function decodeLabel(label: string): Decoded[] {
  const out: Decoded[] = [];
  const sigMap = new Map<string, number>(); // letter (upper-case) → default alteration, from \sig block
  let inSig = false;
  let sigAlter = 0; // accidental token seen inside the \sig block, waiting for its letter
  let pendingAlter: number | null = null; // explicit token before a note; null = bare (use signature)
  for (const tok of label.trim().split(/\s+/).filter(Boolean)) {
    if (tok === SIG_TOKEN) {
      inSig = true;
      sigAlter = 0;
      continue;
    }
    if (tok === SIG_END_TOKEN) {
      inSig = false;
      const summary = [...sigMap.entries()]
        .map(([l, a]) => `${spellNote(l, 4, a, "solfege").replace(/4/, "")}(${accidentalLabel(a)})`)
        .join(" ");
      out.push({ kind: "sig", name: summary || "empty", accidental: "", duration: "" });
      continue;
    }
    if (inSig) {
      // Inside the signature block: accidental tokens pair with the letter that follows.
      if (tok in TOKEN_TO_ALTER) sigAlter = TOKEN_TO_ALTER[tok]!;
      else {
        const western = LILY_TO_LETTER[tok];
        if (western && sigAlter !== 0) sigMap.set(western, sigAlter);
        sigAlter = 0;
      }
      continue;
    }
    if (tok === "|") {
      out.push({ kind: "bar", name: "", accidental: "", duration: "" });
      continue;
    }
    if (tok in REPEAT_GLYPH) {
      out.push({ kind: "repeat", name: REPEAT_GLYPH[tok]!, accidental: "", duration: "" });
      continue;
    }
    if (tok === NATURAL_TOKEN) {
      pendingAlter = 0; // explicit cancel — overrides the signature
      continue;
    }
    if (tok in TOKEN_TO_ALTER) {
      pendingAlter = TOKEN_TO_ALTER[tok]!;
      continue;
    }
    const { letter, octave, dur, dots } = parseLilyToken(tok);
    const duration = (DUR_NAME[dur] ?? `1/${dur}`) + ".".repeat(dots);
    if (letter === null) {
      out.push({ kind: "rest", name: "rest", accidental: "", duration });
      pendingAlter = null;
      continue;
    }
    const western = LILY_TO_LETTER[letter];
    if (!western) continue; // unknown token, skip
    // Bare note → the signature's default for its letter; explicit token → that alteration.
    const alter = pendingAlter !== null ? pendingAlter : (sigMap.get(western) ?? 0);
    out.push({
      kind: "note",
      name: spellNote(western, octave, alter, "solfege"),
      accidental: alter !== 0 ? accidentalLabel(alter) : "",
      duration,
    });
    pendingAlter = null;
  }
  return out;
}

/** One-line readable form of a decoded entry. */
export function fmt(d: Decoded): string {
  if (d.kind === "bar") return "|";
  if (d.kind === "repeat") return d.name;
  if (d.kind === "sig") return `sig{${d.name}}`;
  if (d.kind === "rest") return `rest(${d.duration})`;
  return d.accidental ? `${d.name}[${d.accidental},${d.duration}]` : `${d.name}[${d.duration}]`;
}

/** Decode a label and join the readable forms with two spaces (handy for one-line display). */
export function decodePretty(label: string): string {
  return decodeLabel(label).map(fmt).join("  ");
}
