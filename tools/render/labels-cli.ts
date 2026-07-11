/**
 * Ground-truth label exporter for Rung 3's SymbTr-matched real pages (Node-only).
 *
 * For each note-model JSON (a SymbTr piece matched by name to a downloaded real page — see
 * `scripts/rung3/match_symbtr.py`), writes `labels.json` next to it: the piece's per-measure
 * LilyPond label tokens in BOTH faithful modes, plus the full-piece streams. The Rung-3 labeling
 * loop aligns a real page's decoded strips against these to auto-correct labels without hand
 * transcription (docs/RUNG3.md §3).
 *
 *  - `every`  — every drawn alteration marked inline, no signature (mid-row-crop style).
 *  - `keysig` — signature-covered accidentals suppressed; the derived `\sig … \sigend` block is
 *    exported separately so the aligner can prefix it on row-start strips. Real engraved pages
 *    print a key signature, so `keysig` is the mode that matches their pixels.
 *  - SymbTr is FLATTENED (repeats written out twice, no repeat/nav signs), so these labels carry
 *    no `\repstart`/`\volta`/nav tokens — they correspond to the real page's EXPANDED form, i.e.
 *    the token stream after `stitch.ts` structure expansion, not the raw per-strip decode.
 *
 * Run: npx --yes tsx tools/render/labels-cli.ts <score.json> [more score.json ...]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deriveKeySignature, groupMeasures, type NoteModelDocument } from "@turkish-omr/core";
import {
  serializeMeasure,
  serializeMeasures,
  serializeSignature,
  type SignatureMap,
} from "./lilypond";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: npx tsx tools/render/labels-cli.ts <score.json> [more ...]");
  process.exit(1);
}

for (const path of args) {
  const doc = JSON.parse(readFileSync(path, "utf8")) as NoteModelDocument;
  const measures = groupMeasures(doc);

  const sigEntries = deriveKeySignature(doc);
  const sigMap: SignatureMap = new Map(sigEntries.map((e) => [e.letter, e.alterCommas]));
  const sig = serializeSignature(sigEntries);

  const out = {
    source: path,
    makam: doc.makam,
    form: doc.form,
    usul: doc.usul,
    title: doc.title,
    composer: doc.composer,
    measureCount: measures.length,
    signature: { entries: sigEntries, label: sig.label },
    measures: measures.map((m) => ({
      index: m.index,
      every: serializeMeasure(m).label,
      keysig: serializeMeasure(m, sigMap).label,
    })),
    full: {
      every: serializeMeasures(measures).label,
      keysig: serializeMeasures(measures, sigMap).label,
    },
  };

  const outPath = join(dirname(path), "labels.json");
  writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
  console.log(`${path} -> ${outPath}  (${measures.length} measures, sig: ${sig.label})`);
}
