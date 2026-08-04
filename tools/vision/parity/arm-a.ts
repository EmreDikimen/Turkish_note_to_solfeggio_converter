/**
 * Arm A — decode the PORTED SLICER's own crops in the browser, paired against arm B (MVP W6).
 *
 * Arm B (`arm-b.ts`) decodes Python's crops in the browser and measures the ceiling: 86.0% of
 * strips agree with Python's decode, and the gap is two ORT builds splitting near-ties, not a
 * slicer difference (W3 scored both against hand-verified gold at the same SER). Arm A runs the
 * whole product path instead — page in, ported slicer, its crops, browser decode.
 *
 * ⚠ **The comparison is PAIRED, not a level check against 86.0%.** That was the original plan and
 * it does not work: at n=450 the standard error of the ceiling is ~1.6 pp, so a "within 1 pp" bar
 * sits inside the noise (docs/mvp/slicer-port.md). Both arms decode the SAME strips here, keyed by
 * (system, window), so what is counted is the DISCORDANT pairs — strips where exactly one arm
 * matches Python. A McNemar-style sign test on those is far more sensitive and needs no extra
 * pages. A slicer that cuts the same pixels produces discordant counts that balance; a slicer that
 * cuts worse produces a one-sided pile.
 *
 * Two things this deliberately does NOT claim. Agreement with Python is not quality — W3 settled
 * that, and the decisive test if arm A looks suspect is `scripts/score_browser_gold.py` against
 * gold. And a strip arm A emits that Python never emitted cannot be scored at all; those are
 * reported as unmatched, because a windowing difference shows up there first.
 *
 *   npx tsx tools/vision/parity/arm-a.ts --pages 10
 *   npx tsx tools/vision/parity/arm-a.ts --pages 10 --json a.json
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTokens } from "../../render/stitch";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const STRIPS = path.join(ROOT, "data/real/strips_v2");
const IMAGES = path.join(ROOT, "data/real/images");

/** The slicer config the decode caches on disk were produced under (identical to arm-b.ts). */
const REQUIRED = {
  suffix: "_int8",
  measures_per_strip: 3,
  window_mode: "legacy",
  edge_trim: true,
  vplace: true,
} as const;

interface PyStrip {
  strip: string;
  system: number;
  window: number;
  tokens: string;
  n_ids: number;
  min_logprob: number;
}
interface PyDecode {
  checkpoint: string;
  strips: PyStrip[];
}

interface HarnessCrop {
  name: string;
  system: number;
  window: number;
  width: number;
  dataUrl: string;
}

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

function eligible(dir: string): PyDecode | null {
  const stem = path.basename(dir);
  const f = path.join(dir, `${stem}_decode.json`);
  if (!existsSync(f)) return null;
  const j = JSON.parse(readFileSync(f, "utf8")) as PyDecode;
  if (!j.checkpoint?.endsWith("round2-stage2-best")) return null;
  for (const [k, v] of Object.entries(REQUIRED))
    if ((j as unknown as Record<string, unknown>)[k] !== v) return null;
  if (!j.strips?.length) return null;
  return j;
}

/** stem -> page image. The slicer needs the PAGE, not the crops. */
function indexImages(): Map<string, string> {
  const idx = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(png|jpe?g)$/i.test(e)) {
        const stem = e.replace(/\.[^.]+$/, "");
        if (!idx.has(stem)) idx.set(stem, p);
      }
    }
  };
  walk(IMAGES);
  return idx;
}

/** Compare token streams as the STITCHER sees them — see arm-b.ts for what this cost to learn. */
function norm(s: string): string {
  return normalizeTokens(s).replace(/\s+/g, " ").trim();
}

/**
 * Two-sided exact sign test on the discordant pairs (McNemar's exact form).
 *
 * Small n is the normal case here — a few dozen discordant strips — which is exactly where the
 * chi-square approximation misleads, so the exact binomial is worth the ten lines.
 */
function mcnemarExactP(a: number, b: number): number {
  const n = a + b;
  if (n === 0) return 1;
  let logC = 0; // log C(n, k), stepped
  let tail = 0;
  const k0 = Math.min(a, b);
  for (let k = 0; k <= k0; k++) {
    if (k > 0) logC += Math.log((n - k + 1) / k);
    tail += Math.exp(logC + n * Math.log(0.5));
  }
  return Math.min(1, 2 * tail);
}

async function main() {
  const limit = Number(arg("--pages", "10"));
  const one = arg("--page");

  const dirs = one
    ? [path.resolve(one)]
    : readdirSync(STRIPS)
        .map((d) => path.join(STRIPS, d))
        .filter((d) => statSync(d).isDirectory());
  const images = indexImages();

  const jobs: { dir: string; stem: string; py: PyDecode; image: string }[] = [];
  for (const d of dirs) {
    const stem = path.basename(d);
    const image = images.get(stem);
    if (!image) continue;
    const py = eligible(d);
    if (py) jobs.push({ dir: d, stem, py, image });
    if (!one && jobs.length >= limit) break;
  }
  if (!jobs.length) {
    console.error("no eligible page dirs found");
    process.exit(2);
  }
  console.log(
    `arm A vs arm B — ${jobs.length} page(s), paired on (system, window)\n` +
      "  arm A: page -> PORTED SLICER -> browser decode      arm B: Python's crops -> browser decode\n" +
      "  ⚠ arm A runs the real deskew estimator (~35 s/page); it is the product path.\n"
  );

  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();

  const slicer = await browser.newPage();
  slicer.on("pageerror", (e) => console.log(`  [slicer pageerror] ${e.message}`));
  await slicer.goto(`${base}/slicer-harness.html`, { waitUntil: "domcontentloaded" });
  await slicer.waitForFunction(() => (window as any).__slicer?.ready === true, null, {
    timeout: 120000,
  });

  const decoder = await browser.newPage();
  decoder.on("pageerror", (e) => console.log(`  [decode pageerror] ${e.message}`));
  await decoder.goto(`${base}/strips-harness.html`, { waitUntil: "domcontentloaded" });
  await decoder.waitForFunction(() => (window as any).__omr?.ready === true, null, {
    timeout: 120000,
  });

  interface Row {
    page: string;
    key: string;
    aMatch: boolean;
    bMatch: boolean;
    widthPy: number;
    widthA: number;
    minLogprobPy: number;
  }
  const rows: Row[] = [];
  let aOnlyMissing = 0; // Python emitted this strip, the port did not
  let extra = 0; // the port emitted a strip Python did not
  let sliceMs = 0;

  for (const { dir, stem, py, image } of jobs) {
    // --- arm A: slice the page with the port, decode its crops -------------------------------
    const pageUrl = "data:image/png;base64," + readFileSync(image).toString("base64");
    const sliced = (await slicer.evaluate(
      ([url, name]) => (window as any).__slicer.crops(url, name),
      [pageUrl, stem] as const
    )) as { crops: HarnessCrop[]; nStaves: number; ms: number };
    sliceMs += sliced.ms;

    const aRes = (await decoder.evaluate(
      ([strips, name]) => (window as any).__omr.decode(strips, name),
      [sliced.crops.map((c) => ({ name: c.name, system: c.system, window: c.window, dataUrl: c.dataUrl })), stem] as const
    )) as { strips: { system: number; window: number; tokens: string }[] };

    // --- arm B: decode Python's own crops ------------------------------------------------------
    const bInputs = py.strips
      .filter((s) => existsSync(path.join(dir, s.strip)))
      .map((s) => ({
        name: s.strip,
        system: s.system,
        window: s.window,
        dataUrl: "data:image/png;base64," + readFileSync(path.join(dir, s.strip)).toString("base64"),
      }));
    const bRes = (await decoder.evaluate(
      ([strips, name]) => (window as any).__omr.decode(strips, name),
      [bInputs, stem] as const
    )) as { strips: { system: number; window: number; tokens: string }[] };

    const key = (s: { system: number; window: number }) => `${s.system}:${s.window}`;
    const aBy = new Map(aRes.strips.map((s) => [key(s), s]));
    const bBy = new Map(bRes.strips.map((s) => [key(s), s]));
    const aWidth = new Map(sliced.crops.map((c) => [key(c), c.width]));
    const pyWidth = new Map<string, number>();
    const manFile = path.join(dir, `${stem}_manifest.json`);
    if (existsSync(manFile))
      for (const m of JSON.parse(readFileSync(manFile, "utf8")) as {
        system: number;
        window: number;
        width: number;
      }[])
        pyWidth.set(key(m), m.width);

    let aOk = 0;
    let bOk = 0;
    let paired = 0;
    for (const s of py.strips) {
      const k = key(s);
      const a = aBy.get(k);
      const b = bBy.get(k);
      if (!b) continue; // crop PNG missing on disk — nothing to pair
      if (!a) {
        aOnlyMissing++;
        continue;
      }
      paired++;
      const pyTok = norm(s.tokens);
      const aMatch = norm(a.tokens) === pyTok;
      const bMatch = norm(b.tokens) === pyTok;
      if (aMatch) aOk++;
      if (bMatch) bOk++;
      rows.push({
        page: stem,
        key: k,
        aMatch,
        bMatch,
        widthPy: pyWidth.get(k) ?? -1,
        widthA: aWidth.get(k) ?? -1,
        minLogprobPy: s.min_logprob,
      });
    }
    for (const c of sliced.crops) if (!bBy.has(key(c))) extra++;

    // printed as it lands, not collected: a page costs ~80 s (a real deskew sweep plus two decode
    // arms), so a silent run looks hung for half an hour
    console.log(
      `  ${stem.slice(0, 46).padEnd(46)} ${String(paired).padStart(3)} paired  ` +
        `A ${String(aOk).padStart(3)}  B ${String(bOk).padStart(3)}  ` +
        `strips ${sliced.crops.length}/${py.strips.length}  ${(sliced.ms / 1000).toFixed(1)} s slice`
    );
  }

  await browser.close();
  await server.close();

  const n = rows.length;
  const aOk = rows.filter((r) => r.aMatch).length;
  const bOk = rows.filter((r) => r.bMatch).length;
  const aOnly = rows.filter((r) => r.aMatch && !r.bMatch).length;
  const bOnly = rows.filter((r) => !r.aMatch && r.bMatch).length;
  const p = mcnemarExactP(aOnly, bOnly);
  const pctf = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(2) : "0.00");

  console.log(`\n== PAIRED on ${n} strips (both arms decoded the same (system, window))`);
  console.log(`   arm A (ported slicer's crops)  ${aOk}/${n} agree with Python (${pctf(aOk, n)}%)`);
  console.log(`   arm B (Python's own crops)     ${bOk}/${n} agree with Python (${pctf(bOk, n)}%)`);
  console.log(
    `\n   discordant pairs: A only ${aOnly}   B only ${bOnly}   ` +
      `McNemar exact p = ${p.toFixed(4)}` +
      (p < 0.05 ? "   <- one arm is genuinely different" : "   <- no detectable difference")
  );
  console.log(
    `   strips Python emitted that the port did not: ${aOnlyMissing}` +
      `   strips only the port emitted: ${extra}`
  );
  console.log(`   ${(sliceMs / jobs.length / 1000).toFixed(1)} s/page to slice in-browser`);
  console.log(
    "\n   Read this as a DIFFERENCE, not a level: agreement with Python is not quality (W3).\n" +
      "   If arm A is worse here, score it against gold before touching the slicer."
  );

  const jsonOut = arg("--json");
  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
    console.log(`\nwrote ${jsonOut} (${rows.length} paired strips)`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
