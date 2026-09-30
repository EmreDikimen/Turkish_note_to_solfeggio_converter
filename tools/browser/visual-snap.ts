/**
 * What does the app LOOK like? — a fixed tour of the app's states, screenshotted, plus the handful
 * of measurements a restyle must not move by accident.
 *
 * Not a checker with a verdict: run it before and after a style change and compare the two folders
 * (the PNGs by eye, `snap.json` by diff). Written for the 2026-09-30 Tezhip restyle.
 *
 *   npx tsx tools/browser/visual-snap.ts --out <dir> [--dark-only | --light-only]
 *
 * ⚠ `sheetSvg` in snap.json is the engraved score's rect — the training-strip source. A restyle may
 * move it (the chrome above it changed height) but must never change its width or height.
 */
import { chromium, devices, type Page } from "playwright";
import { createServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { answerVoicePrompt } from "./voicePrompt";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = arg("--out") ?? path.join(ROOT, "tmp/visual-snap");
const SCHEMES: ("light" | "dark")[] = argv.includes("--dark-only") ? ["dark"] : argv.includes("--light-only") ? ["light"] : ["light", "dark"];
const SCORE = "/gamzedeyim-deva.json";

type Rect = { x: number; y: number; w: number; h: number } | null;

async function rect(page: Page, sel: string): Promise<Rect> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return null;
    return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
  }, sel);
}

/** The rects a restyle is judged by. Absent elements come back null, which is itself a finding. */
async function measure(page: Page) {
  const sels = {
    sheetSvg: '[data-omr="sheet-svg"]',
    score: ".kv-score",
    card: ".kv-card",
    pinned: "#transport-pinned",
    settings: "#transport-settings",
    pitchToggle: "#pitch-toggle",
    tabs: "#mobile-tabs",
    toolbox: "#edit-palette",
    header: ".kv-header",
    footer: "#legal",
  };
  const out: Record<string, Rect> = {};
  for (const [k, s] of Object.entries(sels)) out[k] = await rect(page, s);
  out.scrollW = await page.evaluate(() => ({ x: 0, y: 0, w: document.documentElement.scrollWidth, h: document.documentElement.clientWidth })) as Rect;
  return out;
}

/** CSS arrives as JS in dev — wait for the tokens, as phone-probe does. */
async function styled(page: Page) {
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue("--control-h").trim() !== "",
    null, { timeout: 20000 },
  );
  await page.evaluate(() => document.fonts.ready);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await createServer({ root: WEB_ROOT, server: { port: 0 }, logLevel: "error" });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const report: Record<string, unknown> = {};

  const shot = async (page: Page, name: string) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    report[name] = await measure(page);
    console.log(`  ${name}`);
  };

  for (const scheme of SCHEMES) {
    // ── Desktop ────────────────────────────────────────────────────────────────────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto(`${base}/?nostats=1`, { waitUntil: "networkidle" });
      await styled(page);
      await shot(page, `desk-${scheme}-1-upload`);

      await page.goto(`${base}/?nostats=1&score=${SCORE}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });
      await styled(page);
      await shot(page, `desk-${scheme}-2-score`);
      await page.locator(".kv-card").scrollIntoViewIfNeeded();
      await shot(page, `desk-${scheme}-3-card`);

      await page.locator("#edit-toggle").click();
      await shot(page, `desk-${scheme}-4-edit`);
      await page.locator("#edit-toggle").click();

      await page.locator("#view-instrument").click();
      await page.waitForSelector("#instrument-view", { timeout: 10000 });
      await answerVoicePrompt(page, "cancel");
      await page.locator("#instrument-pick").selectOption("kanun");
      await answerVoicePrompt(page, "cancel");
      await page.waitForSelector("#kanun", { timeout: 10000 });
      await shot(page, `desk-${scheme}-5-kanun`);
      await ctx.close();
    }

    // ── Phone ──────────────────────────────────────────────────────────────────────────────
    {
      const ctx = await browser.newContext({
        ...devices["iPhone 13"],
        viewport: { width: 393, height: 800 },
        isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: scheme,
      });
      const page = await ctx.newPage();
      await page.goto(`${base}/?nostats=1`, { waitUntil: "networkidle" });
      await styled(page);
      await shot(page, `phone-${scheme}-1-upload`);

      await page.goto(`${base}/?nostats=1&score=${SCORE}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });
      await styled(page);
      // ⚠ A reload restores the touch emulation Chromium drops after a few navigations (phone-probe).
      if (!(await page.evaluate(() => matchMedia("(pointer: coarse)").matches))) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });
        await styled(page);
      }
      await shot(page, `phone-${scheme}-2-score`);

      await page.locator("#pitch-toggle").click();
      await page.waitForTimeout(500);
      await shot(page, `phone-${scheme}-3-fold`);
      await page.locator("#pitch-toggle").click();
      await page.waitForTimeout(500);

      await page.locator('[data-tab-id="duzenle"]').click();
      await shot(page, `phone-${scheme}-4-edit`);

      await page.locator('[data-tab-id="pages"]').click();
      await shot(page, `phone-${scheme}-5-pages`);

      await page.locator('[data-tab-id="nota"]').click();
      await page.locator("#fullscreen-on").click();
      await shot(page, `phone-${scheme}-6-fullscreen`);
      await ctx.close();
    }
  }

  fs.writeFileSync(path.join(OUT, "snap.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
  console.log(`\n→ ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
