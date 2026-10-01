/**
 * The brand's icons — generated, never hand-drawn (2026-09-28; the logo itself 2026-10-01).
 *
 * What: the owner's logo — a koma bemolü (turquoise), a koma diyezi (Turkish red) and an 8'lik
 * (lapis), scattered on an ivory tile. Chosen by the owner on 2026-10-01 from six candidates as
 * candidate C, angles 27 / -25 / -173 set by hand, positions measured off the owner's screenshot. The
 * outlines are Bravura's own glyphs; the marks live in `apps/web/src/ui/logoMarks.ts`, which the
 * header's `BrandMark.tsx` reads too.
 *
 * Writes `favicon.svg` (the tab icon `apps/web/index.html` links to) and the PNGs an install
 * needs: 192 and 512 (`purpose: any`, the tile with its rounded corners), a 512 MASKABLE one
 * whose marks sit inside the central safe circle so Android's mask never cuts them, and iOS's
 * 180px `apple-touch-icon`, full-bleed because iOS rounds the corners itself.
 *
 * Why a script: one source for the brand — an icon that drifts from the favicon is a second
 * brand. Change the marks here and re-run; every file under `apps/web/public/icons/` is OUTPUT.
 *
 *   npx tsx tools/browser/make-icons.ts
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { LOGO_MARKS } from "../../apps/web/src/ui/logoMarks";

const OUT = path.resolve(__dirname, "../../apps/web/public/icons");
const IVORY = "#f7f4ec"; // the tile
const EDGE = "#e2dccb"; // the tile's hairline, so it reads on a white tab bar


const marks = (): string =>
  LOGO_MARKS.map((m) => `<path fill="${m.fill}" transform="${m.transform}" d="${m.d}"/>`).join("");

/**
 * `shape`: "tile" = the rounded tile with its hairline, as the owner chose it; "bleed" = a full
 * square of ivory (the platform rounds or masks it). `zoom` shrinks the marks about the centre.
 */
function svg(size: number, shape: "tile" | "bleed", zoom = 1): string {
  const ground =
    shape === "tile"
      ? `<rect x="1" y="1" width="98" height="98" rx="20" fill="${IVORY}" stroke="${EDGE}" stroke-width="1.5"/>`
      : `<rect width="100" height="100" fill="${IVORY}"/>`;
  const t = 50 - 50 * zoom;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${ground}<g transform="translate(${t} ${t}) scale(${zoom})">${marks()}</g></svg>`;
}

const ICONS: { file: string; size: number; shape: "tile" | "bleed"; zoom: number }[] = [
  { file: "icon-192.png", size: 192, shape: "tile", zoom: 1 },
  { file: "icon-512.png", size: 512, shape: "tile", zoom: 1 },
  // Maskable: everything that matters inside the central 80% circle — 0.72 keeps the marks in.
  { file: "icon-maskable-512.png", size: 512, shape: "bleed", zoom: 0.72 },
  { file: "apple-touch-icon.png", size: 180, shape: "bleed", zoom: 0.9 },
];

async function main() {
  writeFileSync(path.join(OUT, "favicon.svg"), svg(32, "tile") + "\n");
  console.log("  favicon.svg");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const ic of ICONS) {
    await page.setViewportSize({ width: ic.size, height: ic.size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(ic.size, ic.shape, ic.zoom)}</body></html>`);
    await page.locator("svg").screenshot({ path: path.join(OUT, ic.file), omitBackground: true });
    console.log(`  ${ic.file}  ${ic.size}×${ic.size}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
