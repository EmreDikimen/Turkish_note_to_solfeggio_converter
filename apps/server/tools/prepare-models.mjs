/**
 * Assemble the server's model directory: the three int8 graphs plus a TRIMMED `model.json`.
 *
 *   node apps/server/tools/prepare-models.mjs [--from apps/web/public/models] [--out apps/server/models]
 *
 * The graphs are copied, not re-exported — they are byte-identical to the ones the browser's
 * fallback downloads, which is the only way "the server and the fallback read the same model"
 * stays true without anybody checking.
 *
 * `model.json` is `gate.json` minus its 14 test strips: the runtime needs `startId`, `eosId`,
 * `id2token` and `preprocess.size` and has no business carrying a test fixture into a container
 * (the shape `omr/types.ts` predicted for W9). Same file, same fields, ~12 KB smaller.
 *
 * Runs at Docker build time; run it by hand for a local server.
 */
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const GRAPHS = ["encoder_model.onnx", "decoder_model.onnx", "decoder_with_past_model.onnx"];

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const from = path.resolve(ROOT, arg("--from", "apps/web/public/models"));
const out = path.resolve(ROOT, arg("--out", "apps/server/models"));

await mkdir(out, { recursive: true });

const gate = JSON.parse(await readFile(path.join(from, "gate.json"), "utf8"));
const meta = {
  startId: gate.startId,
  eosId: gate.eosId,
  id2token: gate.id2token,
  preprocess: { size: gate.preprocess.size },
};
for (const [k, v] of Object.entries(meta)) {
  if (v === undefined) throw new Error(`gate.json has no ${k} — cannot build model.json`);
}
await writeFile(path.join(out, "model.json"), JSON.stringify(meta));

let bytes = 0;
for (const g of GRAPHS) {
  const src = path.join(from, g);
  bytes += (await stat(src)).size;
  await copyFile(src, path.join(out, g));
}

console.log(
  `model dir ready: ${out}\n` +
    `  3 graphs, ${(bytes / 1024 / 1024).toFixed(0)} MB\n` +
    `  model.json: ${Object.keys(meta.id2token).length} tokens, ` +
    `${meta.preprocess.size.width}×${meta.preprocess.size.height}, start ${meta.startId}, eos ${meta.eosId}`
);
