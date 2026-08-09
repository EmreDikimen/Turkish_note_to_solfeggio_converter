/** Live pixels-vs-labels check (verify-labels' geometry, but on the app's own strips): does every
 *  strip's label carry exactly the accidental glyphs drawn inside its crop rect? */
import { chromium } from "playwright";
const BASE = process.env.OMR_URL ?? "http://localhost:5174";
const SCORES = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
const read = () => page.evaluate(() => {
  const CP = { 0xe444:"\\komaSharp",0xe445:"\\bakiyeSharp",0xe446:"\\kucukSharp",0xe447:"\\buyukSharp",
    0xe443:"\\komaFlat",0xe442:"\\bakiyeFlat",0xe441:"\\kucukFlat",0xe440:"\\buyukFlat",0xe261:"\\natural" };
  const svg = document.querySelector('[data-omr="sheet-svg"]');
  const glyphs = [];
  for (const t of Array.from(svg.querySelectorAll("text"))) {
    const cp = t.textContent?.codePointAt(0); const cls = CP[cp];
    if (!cls) continue;
    const b = t.getBBox(); glyphs.push({ cls, cx: b.x + b.width/2, cy: b.y + b.height/2 });
  }
  return { glyphs, strips: window.__omrStrips ?? [] };
});
const tally = (a) => { const m = {}; for (const x of a) m[x] = (m[x] ?? 0) + 1; return m; };
for (const score of SCORES) {
  for (const [tag, url, pick] of [["human ", `${BASE}/?score=${score}`, true],
                                  ["render", `${BASE}/?score=${score}&mode=measure`, false]]) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector("#app[data-ready]");
    if (pick) await page.selectOption('select:has(option[value="measure"])', "measure");
    await page.waitForTimeout(900);
    const { glyphs, strips } = await read();
    let ok = 0, bad = [];
    for (const s of strips) {
      const inside = glyphs.filter(g => g.cx >= s.rect.x && g.cx <= s.rect.x + s.rect.width &&
                                        g.cy >= s.rect.y && g.cy <= s.rect.y + s.rect.height);
      const drawn = tally(inside.map(g => g.cls));
      const labelled = tally([...s.label.matchAll(/\\(?:komaSharp|bakiyeSharp|kucukSharp|buyukSharp|komaFlat|bakiyeFlat|kucukFlat|buyukFlat|natural)/g)].map(m => m[0]));
      if (JSON.stringify(drawn) === JSON.stringify(labelled)) ok++;
      else bad.push({ id: s.id, drawn, labelled });
    }
    console.log(`${score} ${tag}: ${ok}/${strips.length} strips match` + (bad.length ? ` — MISMATCH ${JSON.stringify(bad.slice(0,3))}` : ""));
  }
}
await browser.close();
