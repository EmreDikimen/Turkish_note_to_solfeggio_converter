/**
 * Put onnxruntime-web's threaded runtime where the BUILT app can fetch it as a plain file.
 *
 * Copies the two files that belong together — `ort-wasm-simd-threaded.jsep.mjs` (the glue, which
 * also becomes ORT's worker script) and its `.wasm` — into `public/ort/`, so Vite ships them to
 * `dist/ort/` and `omr/ortEnv.ts` can set `wasmPaths = "/ort/"`.
 *
 * Why a copy instead of a `?url` import: `onnxruntime-web`'s package.json `exports` map does not
 * expose `./dist/*.wasm`, so a deep import fails the build outright. That was tried first.
 *
 * Why it matters: without it the bundler inlines the glue, ORT spawns a worker from bundled code
 * that touches `document`, and every session creation in the production build hangs — see ortEnv.ts.
 */
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(WEB, "../../node_modules/onnxruntime-web/dist");
const OUT = path.join(WEB, "public/ort");

// The jsep variant is the one ORT selects for a threaded wasm build; both members of the pair are
// required, and shipping only the .wasm is the silent version of this bug.
const FILES = ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"];

await mkdir(OUT, { recursive: true });
for (const f of FILES) {
  await copyFile(path.join(SRC, f), path.join(OUT, f));
}
console.log(`ort runtime → ${path.relative(WEB, OUT)}/ (${FILES.length} files)`);
