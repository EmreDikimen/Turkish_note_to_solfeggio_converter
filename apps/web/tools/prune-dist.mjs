/**
 * Take the dev-only assets back out of a production build, then REFUSE a build that is too big.
 *
 * Vite copies all of `public/` into `dist/`, and `public/models/` is 332 MB of ONNX graphs plus the
 * gate's test strips. Those belong in a checkout, not on a static host: a deployed build fetches
 * its weights from `VITE_WEIGHTS_URL` (the Hugging Face Hub) and only if the in-browser fallback
 * ever fires. Uploading them to Cloudflare Pages or Netlify would be a slow deploy at best and a
 * refused one at worst — both cap individual files well below a 90 MB graph.
 *
 * The size assertion is the point of this script, not the deletion. Deleting two directories is
 * easy to do by hand and easy to forget; a build that FAILS when the output crosses a few tens of
 * megabytes cannot regress quietly the next time something large lands in `public/`.
 */
import { rm, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(WEB, "dist");

/** Dev-only, and each one is here for a different reason — hence the notes rather than a bare list. */
const DROP = [
  "models", // 332 MB: the int8 graphs, gate.json and the gate's 14 test strips
  "probe", // opencv.js / logprob reference dumps, read only by the harness pages
  // ~20 MB / 220 files: the render automation's corpus, loaded only via `?score=…` by
  // tools/render/render.ts. The files at the public ROOT stay: gamzedeyim-deva.json and
  // safalar-getirdiniz.json are the Sample dropdown, and sample.json is still driven by the manual
  // checks' `?score=/sample.json` even though it left the dropdown on 2026-08-08.
  "scores",
];

/**
 * The bundler emits its own copy of ORT's wasm even though `ortEnv.ts` points the runtime at
 * `/ort/` instead (see copy-ort.mjs). Dropping the duplicate saves ~26 MB of a static host's quota.
 * ⚠ It is only dead weight while `wasmPaths` is set — `smoke:build` is what proves that it is.
 */
const DROP_ASSETS = /^ort-wasm-.*\.wasm$/;

/** A deployed build is HTML, JS, wasm, fonts and a handful of sample scores. */
const MAX_TOTAL_MB = 60;
const MAX_FILE_MB = 30;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push({ path: full, size: (await stat(full)).size });
  }
  return out;
}

for (const name of DROP) {
  await rm(path.join(DIST, name), { recursive: true, force: true });
}
const assetsDir = path.join(DIST, "assets");
for (const f of await readdir(assetsDir).catch(() => [])) {
  if (DROP_ASSETS.test(f)) await rm(path.join(assetsDir, f), { force: true });
}

const files = await walk(DIST);
const total = files.reduce((a, f) => a + f.size, 0);
const biggest = [...files].sort((a, b) => b.size - a.size).slice(0, 5);

console.log(`dist: ${files.length} files, ${(total / 1024 / 1024).toFixed(1)} MB`);
for (const f of biggest) {
  console.log(`  ${(f.size / 1024 / 1024).toFixed(1).padStart(6)} MB  ${path.relative(DIST, f.path)}`);
}

const problems = [];
if (total > MAX_TOTAL_MB * 1024 * 1024)
  problems.push(`total ${(total / 1024 / 1024).toFixed(1)} MB > ${MAX_TOTAL_MB} MB`);
for (const f of files) {
  if (f.size > MAX_FILE_MB * 1024 * 1024)
    problems.push(`${path.relative(DIST, f.path)} is ${(f.size / 1024 / 1024).toFixed(1)} MB`);
}
if (files.some((f) => f.path.endsWith(".onnx")))
  problems.push("an .onnx graph reached dist/ — weights belong on the Hub, not the static host");

if (problems.length) {
  console.error(`\n✗ this build should not be deployed:`);
  for (const p of problems) console.error(`   ${p}`);
  process.exit(1);
}
console.log(`✓ deployable (under ${MAX_TOTAL_MB} MB, no weights)`);
