/**
 * Does the browser decode path fail gracefully? (MVP W2 acceptance)
 *
 * A user picks whatever they like, so the pipeline has to survive images that are not strips. The
 * bar is not "reads them correctly" — it is **does not throw, and produces something the editor can
 * load or an error the app can show**. A crash here would take the whole harness down; a blank
 * score with a message is a fine outcome.
 *
 *   npx tsx tools/vision/parity/edge-cases.ts
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/web");

/** A solid-colour PNG of the given size, built without any image library. */
function solidPng(w: number, h: number, grey: number): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const byte of b) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = Buffer.concat(
    Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, grey)]))
  );
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return "data:image/png;base64," + png.toString("base64");
}

const CASES = [
  { label: "blank white strip (1400×336)", dataUrl: solidPng(1400, 336, 255) },
  { label: "solid black strip (1400×336)", dataUrl: solidPng(1400, 336, 0) },
  { label: "tiny 8×8 image", dataUrl: solidPng(8, 8, 200) },
  { label: "portrait 336×1400 (wrong orientation)", dataUrl: solidPng(336, 1400, 255) },
];

async function main() {
  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/strips-harness.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).__omr?.ready === true, null, { timeout: 120000 });

  let allOk = true;
  for (const c of CASES) {
    const r = (await page.evaluate(
      ([dataUrl]) =>
        (window as any).__omr
          .decode([{ name: "case_s00_w00.png", system: 0, window: 0, dataUrl }], "edge-case")
          .then((v: unknown) => ({ ok: true, v }))
          .catch((e: Error) => ({ ok: false, error: String(e?.message ?? e) })),
      [c.dataUrl] as const
    )) as { ok: boolean; v?: any; error?: string };

    if (!r.ok) {
      allOk = false;
      console.log(`  ✗ ${c.label.padEnd(38)} THREW: ${r.error}`);
      continue;
    }
    const events = r.v.doc.events.length;
    const notes = r.v.doc.events.filter((e: { kind: string }) => e.kind === "note").length;
    const s = r.v.strips[0];
    console.log(
      `  ✓ ${c.label.padEnd(38)} ${String(s.nIds).padStart(3)} ids  hitCap ${String(s.hitCap).padEnd(5)}  ` +
        `min ${s.minLogprob.toFixed(3).padStart(8)}  → ${events} events / ${notes} notes` +
        (r.v.warnings.length ? `  (${r.v.warnings.length} warn)` : "")
    );
  }

  await browser.close();
  await server.close();

  if (errors.length) {
    allOk = false;
    console.log(`\nuncaught page errors:\n  ${errors.join("\n  ")}`);
  }
  console.log(
    allOk
      ? "\nPASS — no case throws; every one returns a loadable document."
      : "\nFAIL — a case threw or raised an uncaught error."
  );
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
