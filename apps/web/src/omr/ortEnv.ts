/**
 * Tell `onnxruntime-web` where its own wasm files are — required in a PRODUCTION build.
 *
 * The symptom this fixes, found by `npm run smoke:build` and invisible in dev: in the built app
 * every `InferenceSession.create` logged **`document is not defined`** and then never resolved, so
 * the in-browser fallback hung forever instead of reading the page.
 *
 * The cause is the bundler. ORT ships its threaded runtime as a pair — `ort-wasm-simd-threaded.jsep.mjs`
 * (the glue, which also becomes the WORKER script) and the matching `.wasm`. Left to itself, Vite
 * inlines the glue into the app chunk, so ORT spawns its worker from bundled code that runs
 * `document`-dependent bootstrap. There is no `document` in a Worker.
 *
 * The fix is to serve both files as ordinary static assets and point ORT at them:
 * `apps/web/tools/copy-ort.mjs` puts them in `public/ort/` at build time, so they land in `dist/ort/`
 * and ORT fetches them as real URLs.
 *
 * ⚠ **Production only, deliberately.** The dev server has never had this problem — `optimizeDeps.exclude`
 * keeps ORT unbundled there — and dev is the configuration the browser gate passes at 27/28 and the
 * one every parity harness runs under. Changing what those load to fix a bug they do not have would
 * be trading a proven path for an unproven one.
 *
 * ⚠ Import this before any `InferenceSession.create`. `session.ts` does; the dev-only harness pages
 * (`omrGate.ts`, `checks/logprobCheck.ts`) do not need to.
 */
import * as ort from "onnxruntime-web";

let done = false;

export function configureOrt(): void {
  if (done) return;
  done = true;
  if (!import.meta.env.PROD) return;
  // A prefix, not a file: ORT appends its own filenames, which vary with the build variant it picks.
  ort.env.wasm.wasmPaths = "/ort/";
}
