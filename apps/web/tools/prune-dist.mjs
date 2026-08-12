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
  // tools/render/render.ts.
  "scores",
];

/**
 * Third-party-derived scores at the public ROOT, dropped since 2026-08-08 (the copyright pass).
 *
 * Every one is a SymbTr export, and SymbTr is **CC BY-NC-SA 4.0** — serving one from the deployed
 * site is redistribution, which would owe attribution, bind the derived file to ShareAlike, and
 * hold the whole app to NonCommercial forever. Two were also compositions still in copyright under
 * FSEK 5846 (life + 70): safalar-getirdiniz (Avni Anıl, d. 2008), beyati-delisin (Selahattin Pınar,
 * d. 1960). `meltem_notes.json` is a transcription of a neyzen.com engraving.
 *
 * ⚠ This list is a BACKSTOP, not the mechanism — `SAMPLES` in App.tsx is empty, so nothing links
 * to them. It exists because "no UI links to it" is not the same as "not published": a file under
 * `public/` is served to anyone who guesses its name. Deleting it here is what makes that untrue.
 */
const DROP_SCORES = [
  "sample.json",
  "beyati-delisin.json",
  "gamzedeyim-deva.json",
  "safalar-getirdiniz.json",
  "meltem_notes.json",
  "decoded.json", // a stitched decode of a real (copyrighted) page — stage-8 output
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

/**
 * Audio (F2's usul drums, and F1's instruments later) may ship, under two conditions.
 *
 * ⚠ This REPLACES the "never bundle audio into the app" rule of docs/features/README.md, which was
 * written against 211 MB of model weights and does not carry at 660 KB of drum hits (owner
 * decision, 2026-08-11). What made that rule worth having — the set stays auditable and a swap
 * stays cheap — is kept by `src/audio/strokeKits.ts` carrying a source and licence per file, and by
 * the loader reading `VITE_AUDIO_URL` so the files can move off the app without a code change.
 *
 * ⚠ **`MAX_AUDIO_MB` is a decision point, not a dial.** It is set just above what the two drum kits
 * need, so the first thing that trips it will be F1's instrument voices — ~4 MB per sampled
 * instrument, which genuinely does not belong on the static host. When that happens, set
 * `VITE_AUDIO_URL` and upload; do not raise this number.
 */
const AUDIO_RE = /\.(wav|mp3|ogg|opus|m4a|flac|aac)$/i;
const AUDIO_DIR = "audio";
const MAX_AUDIO_MB = 1;

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
for (const name of DROP_SCORES) {
  await rm(path.join(DIST, name), { force: true });
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

// Every score this project has is third-party-derived (SymbTr, CC BY-NC-SA), and every one of them
// lived as a .json at the dist ROOT — `fonts/glyphnames.json` is Bravura's own and sits a level
// down. So "no .json directly in dist/" is the whole rule, and it catches a NEW score too, which a
// name list never would. If a genuinely own-work score ever ships, put it in a subdirectory.
const rootJson = files
  .map((f) => path.relative(DIST, f.path))
  .filter((rel) => rel.endsWith(".json") && !rel.includes(path.sep));
for (const rel of rootJson)
  problems.push(`${rel} reached dist/ — third-party-derived scores are not redistributed`);

// Same shape as the rule above: structural, so it catches a NEW file rather than a listed one.
const audio = files
  .map((f) => ({ rel: path.relative(DIST, f.path), size: f.size }))
  .filter((f) => AUDIO_RE.test(f.rel));
for (const f of audio) {
  if (f.rel.split(path.sep)[0] !== AUDIO_DIR)
    problems.push(`${f.rel} is audio outside ${AUDIO_DIR}/ — every sample lives in that one place`);
}
const audioBytes = audio.reduce((a, f) => a + f.size, 0);
if (audioBytes > MAX_AUDIO_MB * 1024 * 1024) {
  problems.push(
    `audio is ${(audioBytes / 1024 / 1024).toFixed(1)} MB > ${MAX_AUDIO_MB} MB — this is the ` +
      `signal to host the samples off the app: set VITE_AUDIO_URL and upload them, rather than ` +
      `raising MAX_AUDIO_MB`,
  );
}

if (problems.length) {
  console.error(`\n✗ this build should not be deployed:`);
  for (const p of problems) console.error(`   ${p}`);
  process.exit(1);
}
console.log(`✓ deployable (under ${MAX_TOTAL_MB} MB, no weights)`);
