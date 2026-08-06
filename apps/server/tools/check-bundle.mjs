/**
 * Run the BUNDLED server the way the container does, and prove it answers.
 *
 * This check exists because its absence cost a failed deploy. `npm run dev:server` runs the
 * TypeScript through `tsx`, which resolves CommonJS dependencies natively; the container runs
 * `node dist/server.js`, an ESM bundle where a CommonJS `require` throws unless the banner in
 * `bundle.mjs` is present. The two artifacts fail differently, so testing one proves nothing about
 * the other — and the difference only showed up in Cloud Run's logs.
 *
 *   node apps/server/tools/check-bundle.mjs
 *
 * It bundles, boots `node dist/server.js` on a spare port, waits for `/health` to report ready,
 * and decodes nothing — reading the model is `parity:server`'s job. What is under test here is
 * that the bundle *loads*: every import resolved, the native addon bound, the graphs opened.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODELS = path.join(SERVER, "models");
const PORT = 8137;

if (!existsSync(path.join(MODELS, "model.json"))) {
  console.error(`no model dir at ${MODELS} — run: node apps/server/tools/prepare-models.mjs`);
  process.exit(2);
}

execFileSync("node", ["tools/bundle.mjs"], { cwd: SERVER, stdio: "inherit" });

const child = spawn("node", ["dist/server.js"], {
  cwd: SERVER,
  env: { ...process.env, PORT: String(PORT), MODEL_DIR: MODELS, OMR_ORT_THREADS: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (d) => (output += d));
child.stderr.on("data", (d) => (output += d));

const deadline = Date.now() + 60000;
let health = null;
while (Date.now() < deadline) {
  if (child.exitCode !== null) break;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    const json = await res.json();
    if (json.ready) {
      health = json;
      break;
    }
  } catch {
    /* not listening yet */
  }
  await new Promise((r) => setTimeout(r, 500));
}

child.kill("SIGTERM");

if (!health) {
  console.error(`\n✗ the bundled server never became ready.\n${output.slice(-1500)}`);
  process.exit(1);
}
console.log(
  `✓ the bundle runs: model ready in ${health.loadMs.toFixed(0)} ms, ` +
    `${health.threads} thread(s), max batch ${health.maxBatch}`
);
