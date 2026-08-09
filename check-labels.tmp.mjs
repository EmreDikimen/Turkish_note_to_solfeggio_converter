import { chromium } from "playwright";
const BASE = process.env.OMR_URL ?? "http://localhost:5174";
const SCORE = process.argv[2] ?? "/beyati-delisin.json";
const NAMES = {0xe440:"buyukFlat",0xe441:"kucukFlat",0xe442:"bakiyeFlat",0xe443:"komaFlat",
  0xe444:"komaSharp",0xe445:"bakiyeSharp",0xe446:"kucukSharp",0xe447:"buyukSharp"};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
for (const [tag, url, pick] of [
  ["human ", `${BASE}/?score=${SCORE}`, true],
  ["render", `${BASE}/?score=${SCORE}&mode=measure`, false],
]) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#app[data-ready]");
  if (pick) await page.selectOption('select:has(option[value="measure"])', "measure");
  await page.waitForTimeout(900);
  const r = await page.evaluate((NAMES) => {
    const drawn = {};
    for (const t of document.querySelectorAll(".kv-score svg text"))
      for (const ch of (t.textContent ?? "")) {
        const cp = ch.codePointAt(0);
        if (cp >= 0xe440 && cp <= 0xe447) drawn[NAMES[cp]] = (drawn[NAMES[cp]] ?? 0) + 1;
      }
    const labelled = {};
    for (const s of (window.__omrStrips ?? []))
      for (const m of s.label.matchAll(/\\(komaSharp|komaFlat|bakiyeSharp|bakiyeFlat|kucukSharp|kucukFlat|buyukSharp|buyukFlat|natural)/g))
        labelled[m[1]] = (labelled[m[1]] ?? 0) + 1;
    return { drawn, labelled, strips: (window.__omrStrips ?? []).length };
  }, NAMES);
  const fmt = (o) => Object.entries(o).sort().map(([k,v]) => `${k}×${v}`).join(" ") || "(none)";
  console.log(`${tag}  strips=${r.strips}`);
  console.log(`   drawn   : ${fmt(r.drawn)}`);
  console.log(`   labelled: ${fmt(r.labelled)}`);
  console.log(`   MATCH   : ${JSON.stringify(r.drawn) === JSON.stringify(Object.fromEntries(Object.entries(r.labelled).filter(([k])=>k!=="natural"))) ? "yes" : "compare above"}`);
}
await browser.close();
