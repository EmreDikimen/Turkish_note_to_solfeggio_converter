/**
 * Does the app's "Read strips" button actually produce a playable score? (MVP W2 acceptance)
 *
 * The parity harness (`tools/vision/parity/arm-b.ts`) proves the pipeline; this proves the WIRING —
 * `onStrips` → `loadDoc` → SheetView/PianoRoll → the transport buttons. Those are the parts a
 * headless pipeline test cannot reach, and they are what a friend will actually touch.
 *
 *   npx tsx tools/browser/app-smoke.ts [--page data/real/strips_v2/<stem>]
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const STRIPS = path.join(ROOT, "data/real/strips_v2");

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

/** First page dir with a decent number of crops, so the test exercises multi-row stitching. */
function pickPage(): string {
  for (const d of readdirSync(STRIPS)) {
    const dir = path.join(STRIPS, d);
    const stem = path.basename(dir);
    if (!existsSync(path.join(dir, `${stem}_decode.json`))) continue;
    const pngs = readdirSync(dir).filter((f) => /_s\d+_w\d+\.png$/.test(f));
    if (pngs.length >= 10) return dir;
  }
  throw new Error("no suitable page dir found");
}

async function main() {
  const dir = arg("--page") ? path.resolve(arg("--page")) : pickPage();
  const stem = path.basename(dir);
  const pngs = readdirSync(dir)
    .filter((f) => /_s\d+_w\d+\.png$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));
  console.log(`app smoke — ${stem}, ${pngs.length} crops\n`);

  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(base, { waitUntil: "domcontentloaded" });
  // The bundled sample auto-loads first; wait for the app to settle before swapping it out.
  await page.waitForSelector("text=Turkish OMR", { timeout: 60000 });

  const input = page.locator("#strips-input");
  await input.setInputFiles(pngs);

  // Reading is ~1 s/strip plus a one-off model load; the status line ends with "read N strips".
  const status = page.locator("text=/read \\d+ strips/");
  await status.waitFor({ timeout: 600000 });
  const summary = (await status.textContent())?.trim() ?? "";
  console.log(`  status: ${summary}`);

  // The score must actually be on screen and playable.
  await page.getByRole("button", { name: /Sheet/ }).click();
  await page.waitForSelector("svg", { timeout: 30000 });
  const svgCount = await page.locator("svg").count();

  const playBtn = page.getByRole("button", { name: /Play/ });
  const playable = await playBtn.isEnabled();
  await playBtn.click();
  await page.waitForTimeout(700);
  const pausedLabel = (await page.getByRole("button", { name: /Pause|Play/ }).textContent()) ?? "";
  await page.getByRole("button", { name: /Stop/ }).click();

  // "Save JSON" is the Rung-3 labeling loop's output — it must yield a schemaVersion-1 doc.
  const dl = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: /Save JSON/ }).click();
  const file = await (await dl).path();
  const doc = JSON.parse(readFileSync(file!, "utf8")) as {
    schemaVersion: number;
    events: { kind: string }[];
  };
  const notes = doc.events.filter((e) => e.kind === "note").length;

  await browser.close();
  await server.close();

  const checks: [string, boolean, string][] = [
    ["status reports a read", /read \d+ strips/.test(summary), summary],
    ["sheet renders", svgCount > 0, `${svgCount} svg`],
    ["play enabled", playable, String(playable)],
    ["playback started", /Pause/.test(pausedLabel), pausedLabel.trim()],
    ["saved schemaVersion 1", doc.schemaVersion === 1, String(doc.schemaVersion)],
    ["saved doc has notes", notes > 0, `${notes} notes`],
    ["no uncaught page errors", pageErrors.length === 0, pageErrors.join("; ") || "none"],
  ];
  console.log("");
  for (const [label, ok, detail] of checks)
    console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(26)} ${detail}`);

  const allOk = checks.every(([, ok]) => ok);
  console.log(allOk ? "\nPASS — image in, playable score out, in the real app." : "\nFAIL");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
