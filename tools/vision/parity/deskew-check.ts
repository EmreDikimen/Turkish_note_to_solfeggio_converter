/**
 * Is the morphology-free `qualifyingLineRows` EXACTLY the morphology one, and how much faster?
 *
 * The skew sweep is ~35 of the ~36 s a page costs in the browser (MVP W7), and almost all of that
 * was one page-wide `morphologyEx` per rotation, 41 times. `openHorizontalRowSums` replaces it with
 * a run-length scan that is mathematically the same thing — an EXACT substitution, so the estimator
 * must return the identical angle on every page.
 *
 * That claim is worth distrusting, which is what this checks. The subtle part is the border:
 * `morphologyEx` defaults to `morphologyDefaultBorderValue()`, so it erodes as if everything outside
 * the frame were foreground, and a run touching the left or right edge therefore survives WHOLE
 * however short it is. Get that wrong and the counts differ only on some pages, at some angles —
 * exactly the kind of bug that a single happy-path test misses.
 *
 * So this runs BOTH implementations on the SAME rotated image, at every angle the coarse pass
 * evaluates plus a fine sample around straight, over real corpus pages, and requires
 * **zero** disagreements. It also times them, which is where the speedup number comes from.
 *
 *   npx tsx tools/vision/parity/deskew-check.ts [--pages 8]
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const IMAGES = path.join(ROOT, "data/real/images");

interface DeskewAngle {
  angle: number;
  morph: number;
  fast: number;
}
interface DeskewCheck {
  width: number;
  height: number;
  angles: DeskewAngle[];
  mismatches: DeskewAngle[];
  msMorph: number;
  msFast: number;
  msPerCallMorph: number;
  msPerCallFast: number;
}

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

/** Real corpus pages, spread across makam directories rather than taken from one folder. */
function pickPages(limit: number): string[] {
  const out: string[] = [];
  const dirs = readdirSync(IMAGES)
    .map((d) => path.join(IMAGES, d))
    .filter((d) => statSync(d).isDirectory());
  for (let round = 0; out.length < limit && round < 50; round++) {
    for (const d of dirs) {
      if (out.length >= limit) break;
      const files = readdirSync(d).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
      if (files[round]) out.push(path.join(d, files[round]!));
    }
  }
  return out;
}

async function main() {
  const limit = Number(arg("--pages", "8"));
  const pages = pickPages(limit);
  console.log(`deskew check — ${pages.length} real pages, both implementations on every angle\n`);

  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${base}/slicer-harness.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).__slicer?.ready === true, { timeout: 120000 });

  let angles = 0;
  let mismatches = 0;
  let msMorph = 0;
  let msFast = 0;
  const worst: { page: string; m: DeskewAngle }[] = [];

  for (const img of pages) {
    const dataUrl = `data:image/${path.extname(img).slice(1)};base64,${readFileSync(img).toString("base64")}`;
    const r = (await page.evaluate(
      async (u) => await (window as any).__slicer.deskewCheck(u),
      dataUrl,
    )) as DeskewCheck;
    angles += r.angles.length;
    mismatches += r.mismatches.length;
    msMorph += r.msMorph;
    msFast += r.msFast;
    for (const m of r.mismatches.slice(0, 3)) worst.push({ page: path.basename(img), m });
    const flag = r.mismatches.length ? `✗ ${r.mismatches.length} MISMATCH` : "✓";
    console.log(
      `  ${flag}  ${path.basename(img).slice(0, 46).padEnd(46)} ${r.width}×${r.height}` +
        `  ${r.msPerCallMorph.toFixed(0)} ms → ${r.msPerCallFast.toFixed(0)} ms per call`,
    );
  }

  await browser.close();
  await server.close();

  const speedup = msFast > 0 ? msMorph / msFast : Infinity;
  const perCallMorph = msMorph / angles;
  const perCallFast = msFast / angles;
  console.log(`\n${angles} angle evaluations over ${pages.length} pages`);
  console.log(`  disagreements:            ${mismatches}`);
  console.log(`  row-sum stage per call:   ${perCallMorph.toFixed(1)} ms → ${perCallFast.toFixed(1)} ms  (${speedup.toFixed(1)}× faster)`);
  console.log(`  saved per 41-angle sweep: ${(41 * (perCallMorph - perCallFast) / 1000).toFixed(1)} s`);
  for (const w of worst.slice(0, 5))
    console.log(`    ${w.page} @ ${w.m.angle}°: morphology ${w.m.morph} vs fast ${w.m.fast}`);

  const ok = mismatches === 0;
  console.log(
    ok
      ? "\nPASS — the substitution is exact on every angle of every page tested."
      : `\nFAIL — ${mismatches} disagreement(s); the substitution is NOT exact.`,
  );
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
