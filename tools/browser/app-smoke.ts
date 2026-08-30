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
import { existsSync, readdirSync } from "node:fs";
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

  // ---------------------------------------------------------------------------------------------
  // The page is kept as it is WRITTEN, and the repeat is taken at playback time (2026-08-30).
  //
  // Two claims, and neither can be read off the words on the screen:
  //   1. the sheet is SHORTER than the performance — a repeated passage is drawn once;
  //   2. the blue playhead goes BACK to it, i.e. sound and picture agree about the repeat.
  // Claim 2 is proved by watching where the cursor actually is: playback is started inside the
  // repeat, and the cursor must at some point move backwards on the page (up a row, or left on the
  // same row). Nothing else in the app moves it backwards.
  const structure = await page.evaluate(
    () =>
      (window as unknown as {
        __omrStructure?: { bars: { bar: number; repEnd?: boolean }[]; playBars: number[] } | null;
      }).__omrStructure ?? null,
  );
  const writtenBars = await page.evaluate(
    () =>
      (window as unknown as { __omrDoc?: { events: { bar?: number }[] } | null }).__omrDoc?.events.reduce(
        (m, e) => Math.max(m, e.bar ?? 0),
        0,
      ) ?? 0,
  );
  const playedBars = structure?.playBars.length ?? 0;
  const repEnds = (structure?.bars ?? []).filter((b) => b.repEnd).map((b) => b.bar);
  const foldedPage = playedBars > writtenBars;
  console.log(
    `  structure: ${writtenBars} written bars → ${playedBars} played, ` +
      `${repEnds.length} repeat end(s)${foldedPage ? "" : " — this page has nothing to fold"}`,
  );

  /** Where the playhead is on the page: row first, then across. Null while it is hidden. */
  const playheadAt = async (): Promise<{ top: number; left: number } | null> =>
    page.evaluate(() => {
      const ph = document.querySelector<HTMLElement>('[data-omr="playhead"]');
      const surface = document.querySelector<HTMLElement>("#sheet-surface");
      if (!ph || !surface || ph.style.display === "none") return null;
      const p = ph.getBoundingClientRect();
      const s = surface.getBoundingClientRect();
      return { top: p.top - s.top, left: p.left - s.left };
    });

  let wentBack = false;
  let samples = 0;
  if (foldedPage && repEnds.length > 0) {
    // Start playing INSIDE the repeat: click the strip that holds the `:‖` bar. A click on the
    // sheet in non-edit mode is "play from this bar", and it is also the user gesture the audio
    // context needs. Strip rects are in the SVG's own coordinates, and no transform may touch that
    // container (the CSS rule), so they are the surface's coordinates too.
    const target = await page.evaluate((bar) => {
      const strips = (window as unknown as {
        __omrStrips?: { fromMeasure: number; toMeasure: number; rect: { x: number; y: number; width: number; height: number } }[];
      }).__omrStrips ?? [];
      const hit = strips.find((st) => st.fromMeasure <= bar && bar <= st.toMeasure) ?? strips[0];
      const surface = document.querySelector<HTMLElement>("#sheet-surface");
      if (!hit || !surface) return null;
      // ⚠ Scroll it into view FIRST. `page.mouse.click` takes viewport coordinates, and a `:‖` half
      // way down a 28-bar page is simply not on screen — the click then lands nowhere, playback
      // never starts, and it looks exactly like "the seek is broken".
      const absTop = window.scrollY + surface.getBoundingClientRect().top + hit.rect.y;
      window.scrollTo(0, Math.max(0, absTop - window.innerHeight / 2));
      const s = surface.getBoundingClientRect();
      return { x: s.left + hit.rect.x + hit.rect.width / 2, y: s.top + hit.rect.y + hit.rect.height / 2 };
    }, repEnds[0]!);

    if (target) {
      await page.mouse.click(target.x, target.y);
      let prev: { top: number; left: number } | null = null;
      for (let i = 0; i < 45; i++) {
        const at = await playheadAt();
        if (at) {
          samples++;
          if (prev && (at.top < prev.top - 2 || (Math.abs(at.top - prev.top) < 2 && at.left < prev.left - 6))) {
            wentBack = true;
          }
          prev = at;
        }
        if (wentBack) break;
        await page.waitForTimeout(120);
      }
    }
    // Only if the click actually started something — an unclickable target must fail the check
    // below, not time out here on a disabled button.
    if (await page.locator("#stop").isEnabled()) await page.locator("#stop").click();
  }

  // The stitched note model itself, read off the live page. `window.__omrDoc` is the app's own
  // automation hook (like `__omrStrips`) and replaced the JSON download button — the check is the
  // same one either way: the wiring must produce a schemaVersion-1 doc with notes in it.
  const doc = (await page.evaluate(
    () => (window as unknown as { __omrDoc?: { schemaVersion: number; events: { kind: string }[] } }).__omrDoc ?? null,
  )) ?? { schemaVersion: 0, events: [] };
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
    ["note model is schemaVersion 1", doc.schemaVersion === 1, String(doc.schemaVersion)],
    ["…and it has notes", notes > 0, `${notes} notes`],
    // A page with no repeat signs is not a failure — it is a page with nothing to fold, and the
    // check says which case it saw rather than passing quietly on an empty condition.
    [
      "the sheet is written, not played out",
      !foldedPage || writtenBars < playedBars,
      foldedPage ? `${writtenBars} drawn vs ${playedBars} played` : "no signs on this page",
    ],
    [
      "⭐ the playhead goes back at the repeat",
      !foldedPage || wentBack,
      foldedPage ? (wentBack ? `yes, after ${samples} samples` : `NO — ${samples} samples, never moved back`) : "n/a",
    ],
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
