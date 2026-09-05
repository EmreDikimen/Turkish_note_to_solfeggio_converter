/**
 * Does the app's "Read page" input turn ONE PAGE IMAGE into a playable score? (MVP W7 acceptance)
 *
 * `app-smoke.ts` proves the same wiring from crops; this proves the half W7 adds — the browser
 * slicer running inside the app, on a page a user could actually upload. The two are kept apart
 * rather than merged: W2's smoke is a pinned 30 s check, and this one is minutes.
 *
 * What it asserts, beyond "a score came out":
 *   - the strip count matches what LOCAL PYTHON cuts for the same page, so a slicer that silently
 *     drops a system inside the app cannot pass. The reference is `scripts/slicer_ref.py`'s output,
 *     NOT the `_manifest.json` on disk: 1,578 of the 1,781 page dirs were sliced on Colab and the
 *     current Python reproduces only ~98.6% of them, so a manifest check would fail W7's wiring for
 *     a W4 reason. Same lesson W4 paid for — agreement with an artifact is not correctness. The
 *     manifest count is printed beside it as context.
 *   - the tab stays responsive while slicing. The sweep is ~35 s of rotations and used to be one
 *     unbroken block; a page that cannot answer JS for 35 s is not shippable, so the run polls the
 *     status text and requires the page to keep replying while the slice is in flight.
 *
 *   .venv-ml/bin/python scripts/slicer_ref.py --pages 8 --out ref.json
 *   npx tsx tools/browser/page-smoke.ts --ref ref.json [--page <stem>]
 *
 * Without `--ref` the strip-count bar cannot be scored and is skipped, loudly: the run still
 * proves the wiring and the responsiveness, which is most of W7.
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dismissMakamPrompt } from "./makamPrompt";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const STRIPS = path.join(ROOT, "data/real/strips_v2");
const IMAGES = path.join(ROOT, "data/real/images");

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

/** stem -> page image, the same index `tools/vision/parity/arm-a.ts` builds. */
function indexImages(): Map<string, string> {
  const idx = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(png|jpe?g)$/i.test(e)) {
        const stem = e.replace(/\.[^.]+$/, "");
        if (!idx.has(stem)) idx.set(stem, p);
      }
    }
  };
  walk(IMAGES);
  return idx;
}

/** The `_manifest.json` on disk: a bare list of strip rows. Context only — see the header. */
type Manifest = { system: number; window: number }[];

/** `scripts/slicer_ref.py`'s output, keyed by page stem. `strips` is local Python's own cut. */
interface Ref {
  [stem: string]: { strips: unknown[]; n_staves: number; kind: string };
}

function manifestOf(stem: string): Manifest | null {
  const f = path.join(STRIPS, stem, `${stem}_manifest.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Manifest) : null;
}

async function main() {
  const images = indexImages();
  const refFile = arg("--ref");
  const ref: Ref | null = refFile
    ? (JSON.parse(readFileSync(path.resolve(refFile), "utf8")) as Ref)
    : null;

  // Prefer a page the reference actually covers, and one big enough to exercise multi-row stitching.
  const candidates = ref
    ? Object.keys(ref).filter((s) => ref[s]!.kind === "eligible" && ref[s]!.strips.length >= 10)
    : readdirSync(STRIPS).filter((s) => (manifestOf(s)?.length ?? 0) >= 10);
  const chosen = arg("--page");
  const stem = chosen ? path.basename(path.resolve(chosen)) : candidates.find((s) => images.has(s));
  if (!stem) throw new Error("no page with both an image and a >=10-strip slice");
  const image = images.get(stem);
  if (!image) throw new Error(`no page image for ${stem}`);
  const pyStrips = ref?.[stem]?.strips.length ?? null;
  const manifest = manifestOf(stem);

  console.log(`page smoke — ${stem}\n  image:    ${path.relative(ROOT, image)}`);
  console.log(
    `  python:   ${pyStrips ?? "(no --ref, strip-count bar skipped)"} strips` +
      (manifest ? `   [manifest on disk: ${manifest.length}]` : "") +
      "\n"
  );

  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  // Pointing `VITE_DECODE_URL` at a dead server is how the FALLBACK gets exercised, and a browser
  // logs a console error for the refused request no matter how cleanly the app recovers. Ignore
  // exactly that one line — the failure this run is provoking on purpose — and nothing else, so a
  // real error in the fallback path still fails the check.
  const decodeHost = (() => {
    try {
      return process.env.VITE_DECODE_URL ? new URL(process.env.VITE_DECODE_URL).host : "";
    } catch {
      return "";
    }
  })();
  // ⚠ The URL of a failed fetch appears in the console message's LOCATION, not in its text, so a
  // text-only match would never fire and the provoked error would fail the run.
  const provoked = (url: string, text: string) =>
    !!decodeHost && `${url} ${text}`.includes(decodeHost) && /ERR_|Failed to load resource/.test(text);

  page.on("console", (msg) => {
    if (msg.type() === "error" && !provoked(msg.location()?.url ?? "", msg.text()))
      pageErrors.push(`console: ${msg.text()}`);
  });

  console.log(`  dev server up at ${base}`);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  // ⚠ Wait for the upload control, NOT for `data-ready`. Since 2026-08-08 the app bundles no score
  // (App.tsx SAMPLES), so on a bare visit `data-ready` never appears — correctly, because it means
  // "a score is installed" and none is. This run makes its own score from the page it uploads, so
  // the boot signal it actually needs is "the file input is there".
  await page.waitForSelector("#page-input", { timeout: 60000 });
  console.log("  app loaded, uploading the page…");

  const t0 = Date.now();
  await page.locator("#page-input").setInputFiles(image);

  // Responsiveness: while the sweep runs, the tab must still answer JS and repaint. Poll the
  // status line — if the main thread were blocked, `textContent` would not return at all.
  const status = page.locator("#omr-status");
  await status.waitFor({ timeout: 60000 }); // the first status paints before any slicing starts
  const seen = new Set<string>();
  let polls = 0;
  let maxGapMs = 0;
  const deadline = Date.now() + 900000;
  while (Date.now() < deadline) {
    const tPoll = Date.now();
    // A short timeout on purpose: this call IS the responsiveness measurement, so waiting 30 s for
    // a blocked main thread would defeat it. A miss reads as a slow reply, which is the finding.
    const text = (await status.textContent({ timeout: 8000 }).catch(() => null))?.trim() ?? "";
    maxGapMs = Math.max(maxGapMs, Date.now() - tPoll);
    polls++;
    // Print every new status line as it appears. A stalled run and a slow one look identical from
    // the outside, and this is a minutes-long check — the trace is what tells them apart.
    if (text && !seen.has(text)) {
      seen.add(text);
      console.log(`    [${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s] ${text}`);
    }
    // The FACT that the read finished, not the sentence saying so (apps/web/src/ui/status.ts).
    if ((await status.getAttribute("data-state")) === "done" || (await page.locator("#omr-error").count()))
      break;
    await page.waitForTimeout(500);
  }
  const summary = (await status.textContent())?.trim() ?? "";
  const errText = (await page.locator("#omr-error").textContent().catch(() => null))?.trim() ?? "";
  const elapsedS = (Date.now() - t0) / 1000;
  console.log(`  status:   ${summary || errText || "(nothing)"}`);
  console.log(`  ${polls} polls over ${elapsedS.toFixed(1)} s, ${seen.size} distinct status lines`);
  console.log(`  slowest reply from the page: ${maxGapMs} ms`);

  const num = async (attr: string) => Number(await status.getAttribute(attr));
  // ⚠ Non-throwing: an error UNMOUNTS the status line (`App.tsx` renders the status or the error,
  // never both), so asking a detached element waits 30 s and throws — a timeout on a locator where
  // the honest answer is "not done". Same shape as the loop above; see live-smoke.ts.
  const done = (await status.getAttribute("data-state").catch(() => null)) === "done";
  const nStrips = done ? await num("data-strips") : 0;
  const nStaves = done ? await num("data-staves") : 0;
  const nNotes = done ? await num("data-notes") : 0;
  const where = done ? await status.getAttribute("data-where") : null;
  const read = done && nStaves > 0 && nStrips > 0 && nNotes > 0;

  // The score must be on screen and playable, exactly as in app-smoke.
  let svgCount = 0;
  let playable = false;
  let playingState = "";
  if (read) {
    // The makam prompt's backdrop would swallow every click below — accept it first.
    await dismissMakamPrompt(page);
    await page.locator("#view-sheet").click();
    await page.waitForSelector("svg", { timeout: 30000 });
    svgCount = await page.locator("svg").count();
    const playBtn = page.locator("#play");
    playable = await playBtn.isEnabled();
    await playBtn.click();
    await page.waitForTimeout(700);
    playingState = (await playBtn.getAttribute("data-play-state")) ?? "";
    await page.locator("#stop").click();
  }

  await browser.close();
  await server.close();

  // W9 step 3: with a decode server configured, the app must actually USE it — and say so.
  // ⚠ Since 2026-09-04 a dead `VITE_DECODE_URL` no longer exercises "the other half": local decode
  // is off where a server is configured, so the app REFUSES and this smoke reads no page at all.
  // `smoke:build` and `smoke:live` own the refusal; point this one at a server that answers.
  const decodeUrl = process.env.VITE_DECODE_URL?.trim();
  const ranOnServer = where === "server";
  const fellBack = where === "local-fallback";

  const checks: [string, boolean, string][] = [
    ["page read end to end", read, summary || errText || "no result"],
    ...(decodeUrl
      ? ([
          [
            "decode ran where it was told",
            ranOnServer || fellBack,
            ranOnServer ? `on the server (${decodeUrl})` : `fell back (${where})`,
          ],
        ] as [string, boolean, string][])
      : []),
    ...(pyStrips == null
      ? []
      : ([
          [
            "strip count matches python",
            nStrips === pyStrips,
            `${nStrips} browser vs ${pyStrips} python`,
          ],
        ] as [string, boolean, string][])),
    ["tab stayed responsive", maxGapMs < 5000, `slowest reply ${maxGapMs} ms`],
    ["progress actually moved", seen.size >= 3, `${seen.size} distinct lines`],
    ["sheet renders", svgCount > 0, `${svgCount} svg`],
    ["play enabled", playable, String(playable)],
    ["playback started", playingState === "playing", playingState || "(none)"],
    ["no uncaught page errors", pageErrors.length === 0, pageErrors.join("; ") || "none"],
  ];
  console.log("");
  for (const [label, ok, detail] of checks)
    console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(26)} ${detail}`);

  const allOk = checks.every(([, ok]) => ok);
  console.log(allOk ? "\nPASS — a page image in, a playable score out, in the real app." : "\nFAIL");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
