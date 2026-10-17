/**
 * Does saving a score (PNG and PDF) give the same, complete picture in every browser engine?
 *
 * Written 2026-10-17 after a tester's Samsung phone (Samsung Internet 30, in the Play app) saved a
 * PNG with no noteheads and printed a blank PDF. We cannot drive that browser, so this drives the
 * three engines Playwright has — Chromium, Firefox, WebKit — through the real save menu and asserts
 * what would have caught it:
 *
 *   - `__omrExportLeft` is 0: every music glyph was outlined, so the export needs no web font;
 *   - the PNG and every PDF page carry ink (not blank), and the engines agree on how much;
 *   - the PDF is well-formed enough for our own reader: page count, one image per page.
 *
 * It writes the files to a folder so a person can LOOK at them — a ratio is not a picture.
 *
 *   npx tsx tools/browser/export-check.ts [--score /beyati-delisin.json] [--out DIR]
 *
 * ⚠ Needs `npx playwright install firefox webkit` once. The score comes from `?score=` (gitignored
 * files a dev server serves; the app ships none).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { chromium, firefox, webkit, type BrowserType } from "playwright";
import { PNG } from "pngjs";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const arg = (f: string, d: string) => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1]! : d;
};
const SCORE = arg("--score", "/beyati-delisin.json");
const OUT = path.resolve(arg("--out", path.join(ROOT, "tmp-export-check")));

/** Share of pixels darker than mid-grey: "is there music on this page" as one number. */
function inkShare(grey: Uint8Array | Buffer, stride = 1): number {
  let dark = 0;
  const n = grey.length / stride;
  for (let i = 0; i < grey.length; i += stride) if (grey[i]! < 128) dark++;
  return dark / n;
}

/** Our own PDFs only: page count, and each page's grey image (FlateDecode) decoded. */
function readPdf(buf: Buffer): { pages: number; images: { w: number; h: number; grey: Buffer }[] } {
  const text = buf.toString("latin1");
  const pages = Number(/\/Count (\d+)/.exec(text)?.[1] ?? 0);
  const images: { w: number; h: number; grey: Buffer }[] = [];
  const re = /\/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceGray \/BitsPerComponent 8 \/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g;
  for (let m; (m = re.exec(text)); ) {
    const start = m.index + m[0].length;
    const len = Number(m[3]);
    images.push({ w: Number(m[1]), h: Number(m[2]), grey: inflateSync(buf.subarray(start, start + len)) });
  }
  return { pages, images };
}

function greyToPng(w: number, h: number, grey: Buffer): Buffer {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < grey.length; i++) {
    png.data[i * 4] = png.data[i * 4 + 1] = png.data[i * 4 + 2] = grey[i]!;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

let failed = 0;
function check(label: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await createServer({ root: WEB_ROOT, server: { port: 0 }, logLevel: "error" });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const engines: [string, BrowserType][] = [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]];
  const pngInk: Record<string, number> = {};
  const pdfInk: Record<string, number> = {};

  for (const [name, type] of engines) {
    console.log(`\n${name}`);
    const browser = await type.launch();
    const page = await browser.newPage({ acceptDownloads: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/?score=${SCORE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('#app[data-ready="1"]', { timeout: 120000 });

    for (const kind of ["png", "pdf"] as const) {
      await page.locator("#export-toggle").click();
      const [dl] = await Promise.all([
        page.waitForEvent("download", { timeout: 120000 }),
        page.locator(`#export-${kind}`).click(),
      ]);
      const file = path.join(OUT, `${name}.${kind}`);
      await dl.saveAs(file);
      const buf = (await import("node:fs")).readFileSync(file);
      const left = await page.evaluate(() => (window as unknown as { __omrExportLeft?: number }).__omrExportLeft);
      check(`${kind}: every music glyph outlined`, left === 0, `${left} left`);

      if (kind === "png") {
        const png = PNG.sync.read(buf);
        pngInk[name] = inkShare(png.data, 4);
        check("png: has ink", pngInk[name]! > 0.005, `${png.width}×${png.height}, ink ${(pngInk[name]! * 100).toFixed(2)}%`);
      } else {
        const pdf = readPdf(buf);
        check("pdf: one image per page", pdf.pages > 0 && pdf.images.length === pdf.pages, `${pdf.pages} pages, ${pdf.images.length} images, ${(buf.length / 1024).toFixed(0)} KB`);
        const inks = pdf.images.map((im) => inkShare(im.grey));
        check("pdf: no blank page", inks.every((v) => v > 0.002), inks.map((v) => (v * 100).toFixed(2) + "%").join(" "));
        pdfInk[name] = inks.reduce((a, b) => a + b, 0) / Math.max(1, inks.length);
        if (pdf.images[0]) writeFileSync(path.join(OUT, `${name}-pdf-p1.png`), greyToPng(pdf.images[0].w, pdf.images[0].h, pdf.images[0].grey));
      }
    }
    check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
    await browser.close();
  }

  // The engines draw the same paths, so their ink should agree closely; a missing glyph class
  // (noteheads are most of the ink) would move it by far more than antialiasing does.
  for (const [label, ink] of [["png", pngInk], ["pdf", pdfInk]] as const) {
    const vals = Object.values(ink);
    const spread = (Math.max(...vals) - Math.min(...vals)) / Math.max(...vals);
    check(`${label}: engines agree on ink`, spread < 0.15, Object.entries(ink).map(([k, v]) => `${k} ${(v * 100).toFixed(2)}%`).join(", ") + ` (spread ${(spread * 100).toFixed(0)}%)`);
  }

  await server.close();
  console.log(`\nfiles in ${OUT}`);
  console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ all checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
