/**
 * Ground-truth label exporter for Rung 3's SymbTr-matched real pages (Node-only).
 *
 * TWO MODES:
 *
 * 1. Per-piece export (default). For each note-model JSON (a SymbTr piece matched by name to a
 *    downloaded real page — see `scripts/rung3/match_symbtr.py`), writes `labels.json` next to
 *    it: the piece's per-measure LilyPond label tokens in all three faithful modes, the
 *    full-piece streams, and the detected repeat spans. The Rung-3 emitter aligns a real page's
 *    decoded strips against these (docs/RUNG3.md §3).
 *
 *     - `every`   — every drawn alteration marked inline, no signature (mid-row-crop style).
 *     - `keysig`  — signature-covered accidentals suppressed (every deviating occurrence marked).
 *     - `measure` — keysig PLUS the measure-scoped carry rule — the convention real printed
 *       pages use (accidental once per measure, cancel on return; confirmed on neyzen). This is
 *       the mode real-strip training labels are emitted in.
 *     - `repeats` — `detectRepeats(doc)` spans (1-based measure indices): where a printed page
 *       would fold SymbTr's flattened duplicate runs back into repeat signs.
 *     - SymbTr is FLATTENED, so the measure/full labels carry no `\repstart`/`\volta`/nav tokens;
 *       the emitter adds them per strip from the `repeats` spans (via `--ranges`).
 *
 *    Run: npx --yes tsx tools/render/labels-cli.ts <score.json> [more score.json ...]
 *
 * 2. `--ranges` batch mode (the emitter's label back-end). Reads one request file describing
 *    every strip of every piece, answers all of them in ONE process (tsx startup is slow):
 *    for each strip, the label for its measure range — "measure" (carry) mode bodies joined by
 *    `|`, repeat/volta tokens from the supplied spans (volta2 pre-remapped by the emitter to the
 *    printed second ending), `\sig` prefix on row-start strips (NON-EMPTY signatures only — the
 *    empty `\sig \sigend` marker is retired, see MODEL_EVAL.md "Rung 2.2b").
 *    Every label is round-trip checked in-process (decodeLabel + token-class count audit).
 *
 *    Run: npx --yes tsx tools/render/labels-cli.ts --ranges <requests.json> --out <responses.json>
 *
 *    Request:  [{ score: "<path to score.json>",
 *                 strips: [{ id, measures: [12,13,14], rowStart: true,
 *                            spans?: [{start,end,volta2?}] }] }]
 *    Response: [{ id, label, estTokens, mode: "measure",
 *                 check: { notes, rests, bars, errors: [] } }]
 *
 * 3. `--check` batch mode (the promote script's round-trip gate). Runs checkLabel — the SAME
 *    gate --ranges labels pass — over raw label texts (human-corrected review-queue labels
 *    never went through --ranges; this is how they earn their way into the manifest).
 *
 *    Run: npx --yes tsx tools/render/labels-cli.ts --check <labels.json> --out <results.json>
 *
 *    Request:  [{ id, label }]
 *    Response: [{ id, notes, rests, bars, errors: [] }]   (exit code 1 when any label errors)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deriveKeySignature, groupMeasures, type NoteModelDocument } from "@turkish-omr/core";
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
  serializeMeasure,
  serializeMeasures,
  serializeSignature,
  type SignatureMap,
} from "./lilypond";
import { detectRepeats, type RepeatSpan } from "./repeats";
import { decodeLabel } from "./decode";

// ---------------------------------------------------------------------------------------------
// Shared piece loading

interface Piece {
  doc: NoteModelDocument;
  measures: ReturnType<typeof groupMeasures>;
  sigEntries: ReturnType<typeof deriveKeySignature>;
  sigMap: SignatureMap;
  sigLabel: string;
}

function loadPiece(path: string): Piece {
  const doc = JSON.parse(readFileSync(path, "utf8")) as NoteModelDocument;
  const measures = groupMeasures(doc);
  const sigEntries = deriveKeySignature(doc);
  const sigMap: SignatureMap = new Map(sigEntries.map((e) => [e.letter, e.alterCommas]));
  return { doc, measures, sigEntries, sigMap, sigLabel: serializeSignature(sigEntries).label };
}

// ---------------------------------------------------------------------------------------------
// Label self-check (round-trip gate, half 1): every token must belong to a known class, and the
// carry-mode decode must consume exactly the note/rest tokens the serializer wrote.

const ACCIDENTAL_TOKENS = new Set(Object.values(AEU_TOKEN));
const STRUCTURAL_TOKENS = new Set([
  REP_START_TOKEN, REP_END_TOKEN, VOLTA1_TOKEN, VOLTA2_TOKEN,
  SEGNO_TOKEN, CODA_TOKEN, DC_TOKEN, FINE_TOKEN,
  TUP3_TOKEN, TUP_END_TOKEN, TIE_TOKEN, GRACE_TOKEN,
]);

function checkLabel(label: string): { notes: number; rests: number; bars: number; errors: string[] } {
  const errors: string[] = [];
  let notes = 0;
  let rests = 0;
  let bars = 0;
  let inSig = false;
  const durOk = (digits: string) => {
    const den = parseInt(digits, 10);
    return den > 0 && (den & (den - 1)) === 0 && den <= 64;
  };
  for (const t of label.trim().split(/\s+/).filter(Boolean)) {
    if (t === SIG_TOKEN) { inSig = true; continue; }
    if (t === SIG_END_TOKEN) { inSig = false; continue; }
    if (inSig) {
      if (!ACCIDENTAL_TOKENS.has(t) && !/^[a-g]$/.test(t)) errors.push(`bad sig token '${t}'`);
      continue;
    }
    if (t === "|") { bars++; continue; }
    if (STRUCTURAL_TOKENS.has(t) || ACCIDENTAL_TOKENS.has(t) || t === NATURAL_TOKEN) continue;
    let m = /^r(\d+)\.{0,2}$/.exec(t);
    if (m) {
      if (!durOk(m[1]!)) errors.push(`bad duration '${t}'`);
      rests++;
      continue;
    }
    m = /^[a-g][',]*(\d+)\.{0,2}$/.exec(t);
    if (m) {
      if (!durOk(m[1]!)) errors.push(`bad duration '${t}'`);
      notes++;
      continue;
    }
    errors.push(`unknown token '${t}'`);
  }
  const decoded = decodeLabel(label, "carry");
  const dn = decoded.filter((d) => d.kind === "note").length;
  const dr = decoded.filter((d) => d.kind === "rest").length;
  if (dn !== notes || dr !== rests) {
    errors.push(`decode count mismatch: decoded ${dn} notes/${dr} rests, label has ${notes}/${rests}`);
  }
  return { notes, rests, bars, errors };
}

// ---------------------------------------------------------------------------------------------
// Mode 2: --ranges batch

interface RangeStrip {
  id: string;
  /** 1-based flattened measure indices, in printed order. */
  measures: number[];
  rowStart?: boolean;
  spans?: RepeatSpan[];
}
interface RangeRequest {
  score: string;
  /** Optional PRINTED-signature override (drawn order). Real editions print the makam's
   *  conventional signature, which routinely differs from `deriveKeySignature`'s
   *  content-derived one (verified on the neyzen corpus, Rung 3) — the emitter majority-votes
   *  the model's row-start signature reads and passes the printed truth here, so the labels
   *  match the pixels: the `\sig` block, the carry-mode bare/marked decisions, everything. */
  signature?: { letter: string; alterCommas: number }[];
  strips: RangeStrip[];
}

function runRanges(requestPath: string, outPath: string): void {
  const requests = JSON.parse(readFileSync(requestPath, "utf8")) as RangeRequest[];
  const responses: object[] = [];
  let errorCount = 0;

  for (const req of requests) {
    const piece = loadPiece(req.score);
    const byIndex = new Map(piece.measures.map((m) => [m.index, m]));
    // Printed-signature override: replaces the derived signature for BOTH the \sig prefix and
    // the carry-mode accidental decisions, so labels equal the page's pixels.
    const sigEntries = req.signature ?? piece.sigEntries;
    const sigMap: SignatureMap = req.signature
      ? new Map(req.signature.map((e) => [e.letter, e.alterCommas]))
      : piece.sigMap;
    const sigLabel = req.signature ? serializeSignature(req.signature).label : piece.sigLabel;
    for (const strip of req.strips) {
      const missing = strip.measures.filter((i) => !byIndex.has(i));
      if (missing.length > 0) {
        responses.push({ id: strip.id, error: `measures not in piece: ${missing.join(",")}` });
        errorCount++;
        continue;
      }
      const ms = strip.measures.map((i) => byIndex.get(i)!);
      // carry + sigTolerant = the printed-page conventions: measure-scoped accidental carry,
      // and same-direction intonation refinements written bare under the signature.
      const body = serializeMeasures(ms, sigMap, strip.spans, undefined, true, true);
      // \sig prefix on row starts — NON-EMPTY signatures only (empty-\sig fix, MODEL_EVAL Rung 2.2b).
      const label =
        strip.rowStart && sigEntries.length > 0 ? `${sigLabel} ${body.label}` : body.label;
      const estTokens =
        body.tokens + (strip.rowStart && sigEntries.length > 0 ? sigEntries.length * 2 + 2 : 0);
      const check = checkLabel(label);
      if (check.errors.length > 0) errorCount++;
      responses.push({ id: strip.id, label, estTokens, mode: "measure", check });
    }
  }

  writeFileSync(outPath, JSON.stringify(responses, null, 1) + "\n");
  console.log(
    `ranges: ${requests.length} pieces, ${responses.length} strips -> ${outPath}` +
      (errorCount > 0 ? `  (${errorCount} with errors)` : ""),
  );
  if (errorCount > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------------------------
// Mode 3: --check batch (round-trip gate over raw label texts)

function runCheck(requestPath: string, outPath: string): void {
  const items = JSON.parse(readFileSync(requestPath, "utf8")) as { id: string; label: string }[];
  const responses = items.map(({ id, label }) => ({ id, ...checkLabel(label) }));
  const errorCount = responses.filter((r) => r.errors.length > 0).length;
  writeFileSync(outPath, JSON.stringify(responses, null, 1) + "\n");
  console.log(
    `check: ${items.length} labels -> ${outPath}` +
      (errorCount > 0 ? `  (${errorCount} with errors)` : ""),
  );
  if (errorCount > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------------------------
// Mode 1: per-piece labels.json export

function runExport(paths: string[]): void {
  for (const path of paths) {
    const piece = loadPiece(path);
    const { measures, sigMap, sigEntries } = piece;

    const out = {
      source: path,
      makam: piece.doc.makam,
      form: piece.doc.form,
      usul: piece.doc.usul,
      title: piece.doc.title,
      composer: piece.doc.composer,
      measureCount: measures.length,
      signature: { entries: sigEntries, label: piece.sigLabel },
      // SymbTr is flattened; these spans are where a printed page would fold the duplicate runs
      // back into repeat signs (1-based measure indices — see repeats.ts RepeatSpan).
      repeats: detectRepeats(piece.doc),
      measures: measures.map((m) => ({
        index: m.index,
        every: serializeMeasure(m).label,
        keysig: serializeMeasure(m, sigMap).label,
        measure: serializeMeasure(m, sigMap, /* carry */ true).label,
      })),
      full: {
        every: serializeMeasures(measures).label,
        keysig: serializeMeasures(measures, sigMap).label,
        measure: serializeMeasures(measures, sigMap, undefined, undefined, /* carry */ true).label,
      },
    };

    const outPath = join(dirname(path), "labels.json");
    writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
    console.log(`${path} -> ${outPath}  (${measures.length} measures, sig: ${piece.sigLabel})`);
  }
}

// ---------------------------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args[0] === "--ranges" || args[0] === "--check") {
  const outIdx = args.indexOf("--out");
  if (!args[1] || outIdx < 0 || !args[outIdx + 1]) {
    console.error(`usage: npx tsx tools/render/labels-cli.ts ${args[0]} <requests.json> --out <responses.json>`);
    process.exit(1);
  }
  (args[0] === "--ranges" ? runRanges : runCheck)(args[1], args[outIdx + 1]!);
} else {
  if (args.length === 0) {
    console.error("usage: npx tsx tools/render/labels-cli.ts <score.json> [more ...]");
    process.exit(1);
  }
  runExport(args);
}
