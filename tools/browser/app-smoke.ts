/**
 * Does the app's "Read strips" button actually produce a playable score? (MVP W2 acceptance)
 *
 * The parity harness (`tools/vision/parity/arm-b.ts`) proves the pipeline; this proves the WIRING —
 * `onStrips` → `loadDoc` → SheetView → the transport buttons. Those are the parts a
 * headless pipeline test cannot reach, and they are what a friend will actually touch.
 *
 *   npx tsx tools/browser/app-smoke.ts [--page data/real/strips_v2/<stem>]
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dismissMakamPrompt } from "./makamPrompt";

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
  // Wait for the app to boot before feeding it strips. ⚠ This used to wait on `data-ready`, which
  // worked only because a bundled sample auto-loaded; the app has bundled no score since
  // 2026-08-08 (App.tsx SAMPLES — they were all SymbTr-derived, CC BY-NC-SA), so `data-ready`
  // never appears on a bare visit. `#page-input` is DOM state, not copy, so the rule that these
  // checks never match on wording still holds.
  await page.waitForSelector("#page-input", { timeout: 60000 });

  // "Read strips" is a developer control and lives inside the collapsed Gelişmiş panel; a closed
  // <details> hides its subtree. Opening it is also the only coverage that panel gets.
  await page
    .locator("#advanced")
    .evaluate((d) => ((d as HTMLDetailsElement).open = true))
    .catch(() => {});

  const input = page.locator("#strips-input");
  await input.setInputFiles(pngs);

  // Reading is ~1 s/strip plus a one-off model load. Wait on the status line's STATE, not its
  // wording — see apps/web/src/ui/status.ts for the contract.
  const status = page.locator('#omr-status[data-state="done"][data-kind="strips"]');
  await status.waitFor({ timeout: 600000 });
  const summary = (await status.textContent())?.trim() ?? "";
  const nStrips = Number(await status.getAttribute("data-strips"));
  const nDecoded = Number(await status.getAttribute("data-notes"));
  console.log(`  status: ${summary}`);

  // A decode raises the makam prompt, and its backdrop covers the page — every click below would
  // fail on "element intercepts pointer events". Accept the guess and move on; which makam it
  // picked is not what this check is about (that is MANUAL_CHECKS check 14).
  await dismissMakamPrompt(page);

  // The raw decode inspector (ui/DecodePanel.tsx) must have caught what the model said. It is the
  // only place the model's own tokens survive — `stitchDecoded` consumes them and returns a
  // document — so a silent regression here would be invisible everywhere else. DOM state only:
  // the counts, and the token list of the first strip.
  const decodePanel = page.locator('#decode-panel[data-decode="ready"]');
  const decodeReady = (await decodePanel.count()) > 0;
  const decodeStrips = Number((await decodePanel.getAttribute("data-decode-strips")) ?? 0);
  const decodeTokens = Number((await decodePanel.getAttribute("data-decode-tokens")) ?? 0);
  const decodeWhere = (await decodePanel.getAttribute("data-decode-where")) ?? "";
  await page.locator("[data-decode-strip]").first().click();
  const shownTokens = Number(
    (await page.locator("[data-token-count]").first().getAttribute("data-token-count")) ?? 0
  );

  // The score must actually be on screen and playable. Ids, not button LABELS — the labels are
  // user-facing copy (and are Turkish).
  await page.locator("#view-sheet").click();
  await page.waitForSelector("svg", { timeout: 30000 });
  const svgCount = await page.locator("svg").count();

  const playBtn = page.locator("#play");
  const playable = await playBtn.isEnabled();
  await playBtn.click();
  await page.waitForTimeout(700);
  const playingState = (await playBtn.getAttribute("data-play-state")) ?? "";
  await page.locator("#stop").click();

  // Save JSON is the Rung-3 labeling loop's output — it must yield a schemaVersion-1 doc.
  const dl = page.waitForEvent("download", { timeout: 30000 });
  await page.locator("#save-json").click();
  const file = await (await dl).path();
  const doc = JSON.parse(readFileSync(file!, "utf8")) as {
    schemaVersion: number;
    events: { kind: string }[];
  };
  const notes = doc.events.filter((e) => e.kind === "note").length;

  await browser.close();
  await server.close();

  const checks: [string, boolean, string][] = [
    ["status reports a read", nStrips > 0 && nDecoded > 0, `${nStrips} strips, ${nDecoded} notes`],
    ["raw decode kept", decodeReady && decodeStrips === nStrips, `${decodeStrips}/${nStrips} strips, ${decodeWhere}`],
    ["…and it has tokens", decodeTokens > 0, `${decodeTokens} tokens`],
    ["…a strip lists its own", shownTokens > 0, `${shownTokens} on strip 1`],
    ["sheet renders", svgCount > 0, `${svgCount} svg`],
    ["play enabled", playable, String(playable)],
    ["playback started", playingState === "playing", playingState || "(none)"],
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
