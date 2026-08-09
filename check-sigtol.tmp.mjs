/**
 * Human view (no ?mode=, dropdown switched to "Standart") vs render view (?mode=measure):
 * which accidental glyphs does the staff actually draw?
 */
import { chromium } from "playwright";

const BASE = process.env.OMR_URL ?? "http://localhost:5174";
const SCORE = process.argv[2] ?? "/beyati-delisin.json";

const NAMES = {
  0xe440: "buyukFlat", 0xe441: "kucukFlat", 0xe442: "bakiyeFlat", 0xe443: "komaFlat",
  0xe444: "komaSharp", 0xe445: "bakiyeSharp", 0xe446: "kucukSharp", 0xe447: "buyukSharp",
};

/** Every accidental glyph inside the note area (VexFlow draws them as <text> in Bravura). */
async function glyphs(page) {
  return await page.evaluate(() => {
    const out = [];
    for (const t of document.querySelectorAll(".kv-score svg text")) {
      const s = t.textContent ?? "";
      for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (cp >= 0xe440 && cp <= 0xe447) out.push({ cp, x: +t.getAttribute("x") || 0, y: +t.getAttribute("y") || 0 });
      }
    }
    return out;
  });
}

function tally(gs) {
  const m = new Map();
  for (const g of gs) m.set(g.cp, (m.get(g.cp) ?? 0) + 1);
  return [...m].sort().map(([cp, n]) => `${NAMES[cp] ?? cp.toString(16)}×${n}`).join("  ");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));

// 1. the human path: no mode in the URL, the dropdown does the switching
await page.goto(`${BASE}/?score=${SCORE}`, { waitUntil: "networkidle" });
await page.waitForSelector("#app[data-ready]");
await page.selectOption('select:has(option[value="measure"])', "measure");
await page.waitForTimeout(700);
const human = await glyphs(page);
console.log("human   (dropdown → Standart):", tally(human), `| total ${human.length}`);

// 2. the render path: ?mode=measure, i.e. a corpus job
await page.goto(`${BASE}/?score=${SCORE}&mode=measure`, { waitUntil: "networkidle" });
await page.waitForSelector("#app[data-ready]");
await page.waitForTimeout(700);
const render = await glyphs(page);
console.log("render  (?mode=measure)      :", tally(render), `| total ${render.length}`);

await browser.close();
