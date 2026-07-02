/**
 * Step-2c batch strip renderer (Playwright). Drives the running web harness, crops each training
 * strip out of the real full-score render, and writes image+label pairs for manual verification.
 *
 * For every sample score × accidental mode (every-note, key-signature), it reads the harness's
 * `window.__omrStrips` (crop rects + LilyPond labels + decoded notes), screenshots each strip's
 * region from the live SVG (fonts render correctly in the live DOM), and writes:
 *   data/synthetic/strips/<score>_<mode>_<id>.png   the cropped staff strip
 *   data/synthetic/strips/<score>_<mode>_<id>.txt   its LilyPond label
 *   data/synthetic/strips/manifest.jsonl            one JSON line per strip
 *   data/synthetic/strips/index.html                a contact sheet (PNG + label + decoded) to scroll
 *
 * Prereq: the harness dev server running (`npm run dev:web`, default http://localhost:5173).
 * Run:    npx --yes tsx tools/render/render.ts
 */

import { mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { chromium } from "playwright";

const URL = process.env.OMR_URL ?? "http://localhost:5173";
const OUT = "data/synthetic/strips";
const SCALE = 3; // deviceScaleFactor — crisp beams; the model resizes to ~583×409 downstream

const SAMPLES = [
  { slug: "aldanma", value: "/sample.json" },
  { slug: "safalar", value: "/safalar-getirdiniz.json" },
  { slug: "gamzedeyim", value: "/gamzedeyim-deva.json" },
];
const MODES: { key: "every" | "keysig"; button: string }[] = [
  { key: "every", button: "every-note" },
  { key: "keysig", button: "key-signature" },
];

interface Strip {
  id: string;
  fromMeasure: number;
  toMeasure: number;
  label: string;
  decoded: string;
  rect: { x: number; y: number; width: number; height: number };
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const manifest: string[] = [];
  const sheet: string[] = [];

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: SCALE, viewport: { width: 1200, height: 1600 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  for (const sample of SAMPLES) {
    // Pick the sample (the <select> that has this file as an option) and switch to Sheet view.
    await page.locator(`select:has(option[value="${sample.value}"])`).selectOption(sample.value);
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    // Turn lyrics off so strips are a clean staff (uncheck if checked).
    const lyrics = page.getByRole("checkbox", { name: "Lyrics" });
    if (await lyrics.isChecked().catch(() => false)) await lyrics.uncheck();

    for (const mode of MODES) {
      await page.getByRole("button", { name: mode.button, exact: true }).click();
      await page.waitForFunction(() => (window as any).__omrStrips?.length > 0, null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300); // let React re-render the new mode + recompute strips
      const strips = (await page.evaluate(() => (window as any).__omrStrips as Strip[])) ?? [];
      const meta = (await page.evaluate(() => (window as any).__omrMeta)) ?? { makam: "" };

      const svg = page.locator('[data-omr="sheet-svg"]');
      await page.evaluate(() => window.scrollTo(0, 0)); // clicking the panel (below the sheet) scrolled down
      const box = await svg.boundingBox();
      if (!box) continue;
      // Grow the viewport so every row sits on-screen from the top (clip screenshots must be within it).
      await page.setViewportSize({ width: 1200, height: Math.ceil(box.y + box.height + 80) });
      await page.evaluate(() => window.scrollTo(0, 0));
      const box2 = (await svg.boundingBox())!;

      for (const s of strips) {
        const name = `${sample.slug}_${mode.key}_${s.id}`;
        const clip = { x: box2.x + s.rect.x, y: box2.y + s.rect.y, width: s.rect.width, height: s.rect.height };
        try {
          await page.screenshot({ path: `${OUT}/${name}.png`, clip });
        } catch (e) {
          console.warn(`  skip ${name}: clip`, clip, String(e).split("\n")[0]);
          continue;
        }
        writeFileSync(`${OUT}/${name}.txt`, s.label + "\n");
        manifest.push(JSON.stringify({ image: `${name}.png`, label: s.label, mode: mode.key, makam: meta.makam, from: s.fromMeasure, to: s.toMeasure }));
        sheet.push(
          `<figure><img src="${name}.png"><figcaption><b>${name}</b><br><code>${escapeHtml(s.label)}</code>` +
            `<br><span class="dec">${escapeHtml(s.decoded)}</span></figcaption></figure>`,
        );
      }
      console.log(`${sample.slug} / ${mode.key}: ${strips.length} strips`);
    }
  }

  await browser.close();
  appendFileSync(`${OUT}/manifest.jsonl`, manifest.join("\n") + "\n");
  writeFileSync(`${OUT}/index.html`, contactSheet(sheet));
  console.log(`\nWrote ${manifest.length} strips to ${OUT}/  (open ${OUT}/index.html to verify)`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function contactSheet(items: string[]): string {
  return `<!doctype html><meta charset="utf-8"><title>OMR strips</title>
<style>
  body{font-family:system-ui;margin:16px;background:#f5f5f5}
  figure{display:inline-block;margin:0 12px 16px 0;vertical-align:top;background:#fff;border:1px solid #ddd;border-radius:6px;padding:8px}
  img{display:block;background:#fff;border:1px solid #eee;max-width:560px}
  figcaption{font-size:12px;margin-top:6px;max-width:560px}
  .dec{color:#555}
</style>
<h2>Synthetic strips — image vs. label vs. decoded</h2>
${items.join("\n")}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
