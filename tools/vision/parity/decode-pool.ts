/**
 * Decode a flat pool of strip PNGs in the browser and dump the token streams (MVP W3).
 *
 * Built to answer the one question arm-B agreement cannot: **is the browser WORSE than Python, or
 * only different?** Agreement measures similarity to another decoder; only gold measures quality.
 * This produces the browser's side; `scripts/score_browser_gold.py` scores it and Python's cached
 * decode against the same hand-verified labels with the same scorer.
 *
 *   npx tsx tools/vision/parity/decode-pool.ts \
 *     --pool data/real/rung3/_realval_v2 --out <file>.json
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/web");

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

async function main() {
  const pool = path.resolve(arg("--pool", "data/real/rung3/_realval_v2"));
  const out = arg("--out", "");
  if (!out) {
    console.error("usage: decode-pool.ts --pool <dir> --out <file.json>");
    process.exit(2);
  }
  const batch = Number(arg("--batch", "20"));

  const pngs = readdirSync(pool).filter((f) => f.endsWith(".png")).sort();
  if (!pngs.length) {
    console.error(`no PNGs in ${pool}`);
    process.exit(2);
  }
  console.log(`decoding ${pngs.length} strips from ${pool}\n`);

  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  await page.goto(`${base}/strips-harness.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).__omr?.ready === true, null, { timeout: 120000 });

  const results: Record<string, unknown> = {};
  const t0 = Date.now();
  // Batched so one page.evaluate does not hold thousands of base64 strings at once. Each strip is
  // its own row (system 0, window i) — the stitcher is irrelevant here, only per-strip tokens are.
  for (let i = 0; i < pngs.length; i += batch) {
    const chunk = pngs.slice(i, i + batch);
    const inputs = chunk.map((name, k) => ({
      name,
      system: 0,
      window: k,
      dataUrl: "data:image/png;base64," + readFileSync(path.join(pool, name)).toString("base64"),
    }));
    const res = (await page.evaluate(
      ([strips]) => (window as any).__omr.decode(strips, "pool"),
      [inputs] as const
    )) as { strips: { name: string; tokens: string; nIds: number; hitCap: boolean; minLogprob: number; meanLogprob: number }[] };
    for (const s of res.strips)
      results[s.name] = {
        tokens: s.tokens,
        nIds: s.nIds,
        hitCap: s.hitCap,
        minLogprob: s.minLogprob,
        meanLogprob: s.meanLogprob,
      };
    const done = Math.min(i + batch, pngs.length);
    const rate = (Date.now() - t0) / done;
    console.log(
      `  ${String(done).padStart(4)}/${pngs.length}  ${(rate).toFixed(0)} ms/strip  ` +
        `eta ${(((pngs.length - done) * rate) / 1000).toFixed(0)} s`
    );
  }

  await browser.close();
  await server.close();

  writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(`\nwrote ${out} (${Object.keys(results).length} strips, ${((Date.now() - t0) / 1000).toFixed(0)} s total)`);
  if (!existsSync(out)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
