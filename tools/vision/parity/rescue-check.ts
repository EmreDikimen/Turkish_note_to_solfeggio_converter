/** Does STAFF_RESCUE actually fire IN THE BROWSER, through the setter the inspector uses? */
import { chromium } from "playwright";
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import path from "node:path";

const WEB_ROOT = path.resolve("apps/web");
const PAGES: Array<[string, string]> = [
  ["bozukNihavendLonga2", "bozukNihavendLonga2.png"],
  ["sevdim_yine_bir_afet_gibi_yar_nota_p1",
   "data/real/images/huzzam/sevdim_yine_bir_afet_gibi_yar_nota_p1.png"],
  ["vuslata_nail_de_etse_ger_felek_nota_p2",
   "data/real/images/hisarbuselik/vuslata_nail_de_etse_ger_felek_nota_p2.png"],
  ["nisaburek_pesrev_fahri_kopuz_udi_p2",
   "data/real/images/nisaburek/nisaburek_pesrev_fahri_kopuz_udi_p2.png"],
];

async function main() {
  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  await page.goto(`${base}/slicer-harness.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).__slicer?.ready === true, null, { timeout: 120000 });

  console.log(`${"page".padEnd(42)}${"rescue OFF".padStart(12)}${"rescue ON".padStart(12)}`);
  for (const [stem, file] of PAGES) {
    const url = "data:image/png;base64," + readFileSync(file).toString("base64");
    const counts: number[] = [];
    for (const on of [false, true]) {
      const n = await page.evaluate(
        async ([u, flag]) => {
          // exactly what the slice inspector does: flip it through the setter, then slice
          const c = await import("/src/omr/slicer/constants.ts");
          c.setStaffRescue(flag as boolean);
          const r = await (window as any).__slicer.stage1(u as string, undefined, true, undefined);
          return r.systems.length as number;
        },
        [url, on] as const
      );
      counts.push(n as number);
    }
    const mark = counts[1]! > counts[0]! ? "  <- rescue fired" : "";
    console.log(`${stem.slice(0, 40).padEnd(42)}${String(counts[0]).padStart(12)}${String(counts[1]).padStart(12)}${mark}`);
  }
  await browser.close();
  await server.close();
}

void main();
