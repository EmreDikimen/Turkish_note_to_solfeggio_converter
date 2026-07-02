/**
 * Demo / sanity check for the LilyPond label serializer — prints real strips from a sample score,
 * so we can eyeball the label format on actual Turkish data before wiring up the image renderer.
 *
 * Run:  npx --yes tsx tools/render/demo.ts [path/to/score.json]
 * Default score: apps/web/public/gamzedeyim-deva.json
 */

import { readFileSync } from "node:fs";
import type { NoteModelDocument } from "@turkish-omr/core";
import { ADDED_TOKENS, docToStrips } from "./lilypond";

const path = process.argv[2] ?? "apps/web/public/gamzedeyim-deva.json";
const doc = JSON.parse(readFileSync(path, "utf8")) as NoteModelDocument;

console.log(`score: ${path}`);
console.log(`makam=${doc.makam}  form=${doc.form}  usul=${doc.usul}  events=${doc.events.length}`);
console.log(`tokens to add to the model: ${ADDED_TOKENS.join("  ")}`);

const strips = docToStrips(doc);
console.log(`\n${strips.length} strips total. First 6:\n`);
for (const s of strips.slice(0, 6)) {
  console.log(`  [m${s.fromMeasure}-${s.toMeasure}] (~${s.estTokens} tok)  ${s.label}`);
}

const over = strips.filter((s) => s.estTokens > 55);
console.log(`\nstrips over 55 est-tokens (should be 0): ${over.length}`);
const maxTok = Math.max(...strips.map((s) => s.estTokens));
console.log(`max est-tokens in any strip: ${maxTok}`);
