/**
 * Drive the DEPLOYED site, as a friend would — the last check before W10.
 *
 * `smoke:build` drives a local `vite preview` of `dist/`, and that stopped being the shipped
 * configuration the moment `ALLOWED_ORIGINS` was set: the decode server now refuses a localhost
 * origin **by design**, so the only run that still exercises what a friend gets is one pointed at
 * the real host. Three things exist only here:
 *
 *   1. **The origin lock is satisfied rather than bypassed.** Every earlier end-to-end run was from
 *      an origin the server would now reject.
 *   2. **Netlify serves the headers**, not `vite preview` repeating them from `public/_headers`.
 *   3. **The weights come from the Hub over the real network**, on the real fallback.
 *
 * Two runs: the server path, then the fallback forced through the `localStorage.omrDecodeUrl`
 * override rather than a rebuild — the site is already deployed and must not be rebuilt to be
 * tested. Both must produce the same score.
 *
 *   npm run smoke:live                          # https://komavision.netlify.app
 *   npm run smoke:live -- --site https://…      # any other deployment
 *
 * ⚠ The fallback run downloads ~211 MB from the Hub and runs decode locally, so expect it to be the
 * slow half. That is the friend's worst case, which is the point of measuring it.
 */
import { chromium, type Page } from "playwright";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const IMAGES = path.join(ROOT, "data/real/images");

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

const SITE = arg("--site", "https://komavision.netlify.app").replace(/\/$/, "");

/** Any real page image; the slicer's correctness is W4–W7's business, not this check's. */
function findPage(): string {
  const chosen = arg("--page");
  if (chosen) return path.resolve(chosen);
  for (const makam of readdirSync(IMAGES)) {
    const dir = path.join(IMAGES, makam);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".png")) return path.join(dir, f);
  }
  throw new Error(`no page image under ${IMAGES}`);
}

async function readOnePage(page: Page, image: string, deadDecodeUrl?: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // The fallback run provokes a connection error on purpose; every OTHER error still counts.
    const from = `${m.location()?.url ?? ""} ${m.text()}`;
    const provoked = !!deadDecodeUrl && from.includes(new URL(deadDecodeUrl).host);
    if (m.type() === "error" && !provoked) errors.push(`console: ${m.text()}`);
  });

  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  if (deadDecodeUrl) {
    await page.evaluate((u) => localStorage.setItem("omrDecodeUrl", u), deadDecodeUrl);
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  // False here means the HOST's headers are wrong and the fallback has no wasm threads.
  const isolated = await page.evaluate(
    () => (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true
  );

  const t0 = Date.now();
  await page.locator("#page-input").setInputFiles(image);
  const status = page.locator("#omr-status");
  await status.waitFor({ timeout: 60000 });
  const deadline = Date.now() + 900000;
  let summary = "";
  while (Date.now() < deadline) {
    summary = (await status.textContent({ timeout: 15000 }).catch(() => null))?.trim() ?? "";
    if (/read a page:/.test(summary) || (await page.locator("#omr-error").count())) break;
    await page.waitForTimeout(500);
  }
  if (await page.locator("#omr-error").count())
    summary = (await page.locator("#omr-error").textContent())?.trim() ?? summary;

  return { summary, errors, isolated, elapsedS: (Date.now() - t0) / 1000 };
}

async function main() {
  const image = findPage();
  console.log(`live smoke — ${SITE}\n  page: ${path.relative(ROOT, image)}\n`);

  const browser = await chromium.launch();
  const runs: { label: string; want: RegExp; res: Awaited<ReturnType<typeof readOnePage>> }[] = [];

  const a = await browser.newPage();
  runs.push({ label: "server path", want: /read on the server/, res: await readOnePage(a, image) });
  await a.close();

  const b = await browser.newPage();
  runs.push({
    label: "fallback (weights from the Hub)",
    want: /read on your machine/,
    res: await readOnePage(b, image, "http://127.0.0.1:9931"),
  });
  await b.close();
  await browser.close();

  const notes = (s: string) => /(\d+) staves → (\d+) strips → (\d+) notes, (\d+) measures/.exec(s);
  const checks: [string, boolean, string][] = [];
  for (const r of runs) {
    checks.push([`${r.label}: read a page`, !!notes(r.res.summary), r.res.summary.slice(0, 110) || "(nothing)"]);
    checks.push([`${r.label}: ran where told`, r.want.test(r.res.summary), r.res.summary.slice(-50)]);
    checks.push([`${r.label}: cross-origin isolated`, r.res.isolated, String(r.res.isolated)]);
    checks.push([
      `${r.label}: no page errors`,
      r.res.errors.length === 0,
      r.res.errors.join("; ").slice(0, 160) || "none",
    ]);
    console.log(`  ${r.label}: ${r.res.elapsedS.toFixed(1)} s — ${r.res.summary.slice(0, 110)}`);
  }

  // The whole point of a fallback: same page, same music, wherever it ran.
  const [x, y] = runs.map((r) => notes(r.res.summary)?.slice(1).join("/") ?? "");
  checks.push(["both paths gave the same score", !!x && x === y, `${x || "?"} vs ${y || "?"}`]);

  console.log("");
  for (const [label, ok, detail] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(42)} ${detail}`);
  const allOk = checks.every(([, ok]) => ok);
  console.log(allOk ? "\nPASS — the DEPLOYED site works, on both paths." : "\nFAIL");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
