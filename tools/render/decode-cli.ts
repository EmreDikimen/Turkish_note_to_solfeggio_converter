/**
 * CLI for the verification decoder (Node-only). Decodes a score's strips, or a raw label string.
 *
 * Run (decode a score's strips, label → decoded notes):  npx --yes tsx tools/render/decode-cli.ts [score.json]
 * Run (decode a raw label string):                       npx --yes tsx tools/render/decode-cli.ts "\komaFlat b'16 a'8"
 */

import { readFileSync } from "node:fs";
import type { NoteModelDocument } from "@turkish-omr/core";
import { docToStrips } from "./lilypond";
import { decodePretty } from "./decode";

const arg = process.argv[2] ?? "apps/web/public/gamzedeyim-deva.json";

if (arg.endsWith(".json")) {
  const doc = JSON.parse(readFileSync(arg, "utf8")) as NoteModelDocument;
  console.log(`score: ${arg}  (makam=${doc.makam})  — first 6 strips, label → decoded notes:\n`);
  for (const s of docToStrips(doc).slice(0, 6)) {
    console.log(`[m${s.fromMeasure}-${s.toMeasure}]`);
    console.log(`  label  : ${s.label}`);
    console.log(`  decoded: ${decodePretty(s.label)}\n`);
  }
} else {
  console.log(`label  : ${arg}`);
  console.log(`decoded: ${decodePretty(arg)}`);
}
