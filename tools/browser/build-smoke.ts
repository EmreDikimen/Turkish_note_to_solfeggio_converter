/**
 * Does the BUILT app work — the one a friend will actually open? (MVP W9/W10 hosting)
 *
 * `page-smoke.ts` drives the Vite dev server, which is not what gets deployed. Three things only
 * exist in a production build, and each one has a way of failing that a dev run cannot show:
 *
 *   1. **The weights come from another origin.** A deployed build has no `/models/` — it fetches
 *      them from `VITE_WEIGHTS_URL` (the Hugging Face Hub). That is a cross-origin request under
 *      `Cross-Origin-Embedder-Policy: require-corp`, which is exactly the combination that blocks
 *      quietly. Here they are served from a second local origin, so the check is real.
 *   2. **COOP/COEP come from the host, not from Vite.** `vite preview` repeats the dev headers, so
 *      this rehearses the `public/_headers` a static host will send. Without them the fallback
 *      loses `SharedArrayBuffer` and wasm threads.
 *   3. **The decode URL is baked in at build time.** The server path here is the built one, not a
 *      dev env var.
 *
 * Two runs over one build: the server path, then the FALLBACK, forced through the
 * `localStorage.omrDecodeUrl` override rather than a rebuild. Both must produce the same score.
 *
 *   npm run dev:server &                 # the decode server the built app will call
 *   npm run smoke:build
 *
 * **It runs the build itself**, because the weights origin is only known once its port is open —
 * and because a check that accepts whatever `dist/` happens to be lying around is a check that
 * eventually passes on a stale one.
 *
 * The weights it serves are `apps/server/models/` when that exists: the exact artifact set
 * `prepare-models.mjs` emits and the one destined for the Hub, so the browser fallback and the
 * decode server are fed the same bytes. Otherwise it falls back to `apps/web/public/models/`,
 * aliasing `model.json` to `gate.json`.
 */
import { chromium, type Page } from "playwright";
import { preview } from "vite";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const DIST = path.join(WEB_ROOT, "dist");
const SERVER_MODELS = path.join(ROOT, "apps/server/models");
const WEB_MODELS = path.join(WEB_ROOT, "public/models");
const IMAGES = path.join(ROOT, "data/real/images");

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

/** Any real page image; the slicer's correctness is W4–W7's business, not this check's. */
function findPage(): string {
  const chosen = arg("--page");
  if (chosen) return path.resolve(chosen);
  for (const makam of readdirSync(IMAGES)) {
    const dir = path.join(IMAGES, makam);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".png")) return path.join(dir, f);
  }
  throw new Error(`no page image under ${IMAGES}`);
}

/**
 * Serve the weights from a SECOND origin, the way the Hugging Face Hub will.
 *
 * `Access-Control-Allow-Origin: *` is what makes a plain CORS `fetch` satisfy `require-corp`; the
 * Hub sends the same. Serving them from the app's own origin would test nothing.
 */
function serveWeights(): Promise<{ url: string; close: () => Promise<void> }> {
  const assembled = existsSync(path.join(SERVER_MODELS, "model.json"));
  const dir = assembled ? SERVER_MODELS : WEB_MODELS;
  const server = createServer((req, res) => {
    const name = path.basename(new URL(req.url ?? "/", "http://x").pathname);
    const file = path.join(dir, !assembled && name === "model.json" ? "gate.json" : name);
    if (!existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": name.endsWith(".json") ? "application/json" : "application/octet-stream",
    });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        url: `http://localhost:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

interface RunResult {
  summary: string;
  /** Where the model ran, straight off the status line's data attributes (ui/status.ts). */
  where: string | null;
  /** staves/strips/notes/measures — the score itself, for the "both paths agree" check. */
  counts: number[];
  errors: string[];
  isolated: boolean;
  elapsedS: number;
}

async function readOnePage(page: Page, base: string, image: string, deadDecodeUrl?: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // A failed subresource fetch logs "Failed to load resource: net::ERR_…" with the URL only in
    // the message's LOCATION, never in its text — so matching on the text alone would flag the very
    // failure this run provokes on purpose. Match the location, and keep every other error.
    const from = `${m.location()?.url ?? ""} ${m.text()}`;
    const provoked = !!deadDecodeUrl && from.includes(new URL(deadDecodeUrl).host);
    if (m.type() === "error" && !provoked) errors.push(`console: ${m.text()}`);
  });

  await page.goto(base, { waitUntil: "domcontentloaded" });
  if (deadDecodeUrl) {
    await page.evaluate((u) => localStorage.setItem("omrDecodeUrl", u), deadDecodeUrl);
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  // If this is false the host's headers are wrong and the fallback has no wasm threads.
  const isolated = await page.evaluate(() => (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true);

  const t0 = Date.now();
  await page.locator("#page-input").setInputFiles(image);
  const status = page.locator("#omr-status");
  await status.waitFor({ timeout: 60000 });
  const deadline = Date.now() + 900000;
  let summary = "";
  while (Date.now() < deadline) {
    summary = (await status.textContent({ timeout: 15000 }).catch(() => null))?.trim() ?? "";
    if ((await status.getAttribute("data-state")) === "done" || (await page.locator("#omr-error").count()))
      break;
    await page.waitForTimeout(500);
  }
  const done = (await status.getAttribute("data-state")) === "done";
  const where = done ? await status.getAttribute("data-where") : null;
  const counts = done
    ? await Promise.all(
        ["data-staves", "data-strips", "data-notes", "data-measures"].map(async (a) =>
          Number(await status.getAttribute(a))
        )
      )
    : [];
  if (await page.locator("#omr-error").count())
    summary = (await page.locator("#omr-error").textContent())?.trim() ?? summary;

  return { summary, where, counts, errors, isolated, elapsedS: (Date.now() - t0) / 1000 } satisfies RunResult;
}

async function main() {
  const image = findPage();
  const decodeUrl = arg("--decode-url", "http://localhost:8080");

  // The weights origin must exist before the build, because its URL is baked into the bundle.
  //
  // `--weights-url` swaps the local stand-in for the REAL Hugging Face repo. The local server is a
  // faithful imitation on the one header that matters (`access-control-allow-origin: *`) — but the
  // Hub does not send `*`, it REFLECTS the requesting origin behind `vary: Origin`, and it answers
  // through a 307 to a different host. Neither is exercised by the imitation, and both are on the
  // path that fails quietly under `require-corp`. Costs a 211 MB download, so it is opt-in.
  const remoteWeights = arg("--weights-url");
  const weights = remoteWeights
    ? { url: remoteWeights.replace(/\/$/, ""), close: async () => {} }
    : await serveWeights();
  console.log(
    `build smoke — ${path.relative(ROOT, image)}\n` +
      `  weights from a second origin: ${weights.url}${remoteWeights ? "  (REAL, not the stand-in)" : ""}\n` +
      `  decode server:                ${decodeUrl}\n  building…`
  );
  execFileSync("npm", ["run", "build:app"], {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, VITE_DECODE_URL: decodeUrl, VITE_WEIGHTS_URL: weights.url },
  });
  if (existsSync(path.join(DIST, "models")))
    throw new Error(`${DIST}/models exists — this build carries the weights it should not`);
  console.log("");

  const server = await preview({ root: WEB_ROOT, preview: { port: 0 } });
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();

  // `want` is the exact `data-where` this run must report. Stricter than the old prose match:
  // "local-fallback" proves the configured server was tried and missed, where "read on your
  // machine" also matched a build that had no decode server configured at all.
  const runs: { label: string; want: string; res: RunResult }[] = [];

  const a = await browser.newPage();
  runs.push({ label: "server path", want: "server", res: await readOnePage(a, base, image) });
  await a.close();

  const dead = "http://127.0.0.1:9931";
  const b = await browser.newPage();
  runs.push({
    label: "fallback path (weights cross-origin)",
    want: "local-fallback",
    res: await readOnePage(b, base, image, dead),
  });
  await b.close();

  await browser.close();
  await server.close();
  await weights.close();

  const key = (r: RunResult) => (r.counts.every((n) => n > 0) ? r.counts.join("/") : "");
  const checks: [string, boolean, string][] = [];
  for (const r of runs) {
    checks.push([`${r.label}: read a page`, !!key(r.res), r.res.summary.slice(0, 120) || "(nothing)"]);
    checks.push([`${r.label}: ran where told`, r.res.where === r.want, `${r.res.where ?? "?"} (want ${r.want})`]);
    checks.push([`${r.label}: cross-origin isolated`, r.res.isolated, String(r.res.isolated)]);
    checks.push([`${r.label}: no page errors`, r.res.errors.length === 0, r.res.errors.join("; ").slice(0, 140) || "none"]);
    console.log(`  ${r.label}: ${r.res.elapsedS.toFixed(1)} s — ${r.res.summary.slice(0, 110)}`);
  }

  // The whole point of a fallback: same page, same music, wherever it ran.
  const [x, y] = runs.map((r) => key(r.res));
  checks.push(["both paths gave the same score", !!x && x === y, `${x || "?"} vs ${y || "?"}`]);

  console.log("");
  for (const [label, ok, detail] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(46)} ${detail}`);
  const allOk = checks.every(([, ok]) => ok);
  console.log(allOk ? "\nPASS — the built app works, on both paths." : "\nFAIL");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
