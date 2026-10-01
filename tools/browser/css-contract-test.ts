/**
 * The stylesheet's contract, pinned (Node-only, a static read — no browser). Written for the
 * 2026-09-30 Tezhip restyle, which moved the app onto Tailwind; every assertion below is a rule
 * that had already cost a bug once, and none of them would throw at runtime if broken.
 *
 *  1. **`--control-h` is defined** — phone-probe and visual-snap wait on it as "the stylesheet is in".
 *  2. **The phone breakpoint is ONE number** — the `phone` variant and `PHONE_MAX_WIDTH` agree.
 *  3. **The score's box keeps its overflow pair** (`overflow-y: clip` is the one-scrollbar rule) and
 *     the card keeps `overflow: clip` (sticky breaks under `hidden`). Both live in contract.css,
 *     which index.css must import UNLAYERED.
 *  4. **No preflight.** Tailwind's reset would move the engraved SVG (training-strip source).
 *  5. **No `dark:` utility anywhere in the app** — the score card is a light island inside a dark
 *     page, and that works only because every colour is a token the card redeclares.
 *  6. **Nothing reaches inside `.kv-score` with a font, a colour or a transform**, in any sheet.
 *
 * Run: npx tsx tools/browser/css-contract-test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "apps/web/src");
const STYLES = path.join(SRC, "styles");
const read = (p: string) => fs.readFileSync(p, "utf8");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

let failures = 0;
function check(what: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** Every rule body for a selector list that contains `sel`, from comment-free CSS. */
function rulesFor(css: string, test: (selector: string) => boolean): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m; (m = re.exec(css)); ) if (test(m[1]!.trim())) out.push(m[2]!);
  return out;
}

const sheets = fs.readdirSync(STYLES).filter((f) => f.endsWith(".css"));
const all = sheets.map((f) => ({ f, css: stripComments(read(path.join(STYLES, f))) }));
const index = stripComments(read(path.join(SRC, "index.css")));
const contract = stripComments(read(path.join(STYLES, "contract.css")));

console.log("css contract");

// 1
check("--control-h is defined in tokens.css", /--control-h\s*:/.test(stripComments(read(path.join(STYLES, "tokens.css")))));

// 2
const phoneTs = read(path.join(SRC, "usePhone.ts"));
const phoneMax = Number(/PHONE_MAX_WIDTH\s*=\s*(\d+)/.exec(phoneTs)?.[1]);
const variant = /@custom-variant\s+phone\s*\(\s*@media\s*\(\s*max-width:\s*(\d+)px/.exec(read(path.join(STYLES, "theme.css")));
check("phone variant == PHONE_MAX_WIDTH", !!variant && Number(variant[1]) === phoneMax, `${variant?.[1]} vs ${phoneMax}`);
const mqs = all.flatMap(({ css }) => [...css.matchAll(/@media[^{]*?max-width:\s*(\d+)px/g)].map((m) => Number(m[1])));
check("every max-width media query in the sheets is the phone's", mqs.every((n) => n === phoneMax || n < 600), mqs.filter((n) => n !== phoneMax).join(",") || "all 700");

// 3
const scoreRules = rulesFor(contract, (s) => s.split(",").map((x) => x.trim()).includes(".kv-score")).join(";");
check(".kv-score has overflow-x: auto and overflow-y: clip", /overflow-x:\s*auto/.test(scoreRules) && /overflow-y:\s*clip/.test(scoreRules));
const cardRules = rulesFor(contract, (s) => s.split(",").map((x) => x.trim()).includes(".kv-card")).join(";");
check(".kv-card has overflow: clip", /overflow:\s*clip/.test(cardRules));
const contractImport = /@import\s+"\.\/styles\/contract\.css"\s*([^;]*);/.exec(index);
check("contract.css is imported unlayered", !!contractImport && !/layer/.test(contractImport[1]!));
const overflowOverride = all
  .filter(({ f }) => f !== "contract.css")
  .flatMap(({ f, css }) =>
    rulesFor(css, (s) => /\.kv-(score|card)(?![\w-])/.test(s))
      .filter((b) => /overflow/.test(b))
      .map(() => f),
  );
check("no other sheet sets overflow on .kv-score/.kv-card", overflowOverride.length === 0, overflowOverride.join(","));

// 4
check("no Tailwind preflight", !/preflight/.test(index) && !/@import\s+"tailwindcss"\s*;/.test(index));

// 5
const tsx: string[] = [];
(function walk(d: string) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(e.name)) tsx.push(p);
  }
})(SRC);
const darkUses = tsx.filter((p) => /(["'`\s])dark:[a-z]/.test(read(p))).map((p) => path.relative(SRC, p));
check("no dark: utility in the app", darkUses.length === 0, darkUses.join(","));

// 5b — one source of truth for light/dark: `:root[data-theme]`, set by src/theme.ts.
const mediaDark = all.filter(({ css }) => /prefers-color-scheme/.test(css)).map(({ f }) => f);
check("no prefers-color-scheme query in the sheets (the theme is data-theme)", mediaDark.length === 0, mediaDark.join(","));

// 6
const scoreLeaks: string[] = [];
for (const { f, css } of all) {
  for (const body of rulesFor(css, (s) => /\.kv-score[\s>]/.test(s))) {
    if (/(^|;|\s)(font(-family|-size)?|color|fill|stroke|transform|zoom|scale)\s*:/.test(body)) scoreLeaks.push(f);
  }
  for (const body of rulesFor(css, (s) => s.split(",").some((x) => /\.kv-score$/.test(x.trim())))) {
    if (/(^|;|\s)(transform|zoom|scale)\s*:/.test(body)) scoreLeaks.push(f + " (.kv-score itself)");
  }
}
check("no font/colour/transform reaches inside .kv-score", scoreLeaks.length === 0, scoreLeaks.join(","));

if (failures) {
  console.error(`\n${failures} FAILED`);
  process.exit(1);
}
console.log("ALL PASS");
