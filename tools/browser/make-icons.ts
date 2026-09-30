/**
 * The PWA's icons — generated, never hand-drawn (2026-09-28).
 *
 * What: the favicon's koma diyezi (two gold uprights, two ivory slants, on lapis — the Tezhip
 * palette since 2026-09-30; it was red and black on cream) drawn at
 * the sizes an install needs: 192 and 512 (`purpose: any`), a 512 MASKABLE one whose sign sits
 * inside the central safe circle so Android's round/squircle mask never cuts it, and iOS's 180px
 * `apple-touch-icon`, full-bleed because iOS rounds the corners itself.
 *
 * Why a script: the favicon in `apps/web/index.html` is the brand, and an icon that drifts from it
 * is a second brand. Change the sign here and re-run; the PNGs under `apps/web/public/icons/` are
 * OUTPUT. ⚠ It is a placeholder until the owner supplies a logo (asked 2026-09-28).
 *
 *   npx tsx tools/browser/make-icons.ts
 */
import { chromium } from "playwright";
import path from "node:path";

const OUT = path.resolve(__dirname, "../../apps/web/public/icons");
const PAPER = "#1f3a6b"; // lapis — the ground (the name is kept from the cream era)
const RED = "#d4af5f"; // gold — the uprights
const INK = "#f7f4ec"; // ivory — the slants

/** The sign, in the favicon's own 32-unit coordinates (x 7–25, y 6–26). */
const SIGN = `
  <g stroke="${RED}" stroke-width="2.4" stroke-linecap="round"><path d="M11 6v20M21 6v20"/></g>
  <g stroke="${INK}" stroke-width="2.6" stroke-linecap="round"><path d="M7 13.5l18-3.2M7 21.7l18-3.2"/></g>`;

/** `fill` = the share of the icon's side the sign's 20-unit height takes. */
function svg(size: number, fill: number, rounded: boolean): string {
  const s = (size * fill) / 20; // 20 = the sign's height in favicon units
  const cx = 16, cy = 16; // the sign's centre in favicon units
  const r = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" fill="${PAPER}"/>
    <g transform="translate(${size / 2 - cx * s} ${size / 2 - cy * s}) scale(${s})">${SIGN}</g>
  </svg>`;
}

const ICONS: { file: string; size: number; fill: number; rounded: boolean }[] = [
  { file: "icon-192.png", size: 192, fill: 0.62, rounded: true },
  { file: "icon-512.png", size: 512, fill: 0.62, rounded: true },
  // Maskable: everything that matters inside the central 80% circle — 0.5 keeps the sign's corners in.
  { file: "icon-maskable-512.png", size: 512, fill: 0.5, rounded: false },
  { file: "apple-touch-icon.png", size: 180, fill: 0.58, rounded: false },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const ic of ICONS) {
    await page.setViewportSize({ width: ic.size, height: ic.size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(ic.size, ic.fill, ic.rounded)}</body></html>`);
    await page.locator("svg").screenshot({ path: path.join(OUT, ic.file), omitBackground: true });
    console.log(`  ${ic.file}  ${ic.size}×${ic.size}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
