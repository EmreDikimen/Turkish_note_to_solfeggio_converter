/**
 * Run one harness page in headless Chromium and report the global it exposes.
 *
 * Several harness pages already publish their verdict on `window` (`__gateResult` in omrGate.ts,
 * `__cvProbe` in cvProbe.ts) but there has never been a way to run them from a terminal, so they
 * were checked by opening a browser and looking. This turns them into commands, which is the
 * difference between a regression test and a thing you remember to check.
 *
 *   npx tsx tools/browser/run-page.ts cv-probe.html __cvProbe
 *   npx tsx tools/browser/run-page.ts omr-gate.html __gateResult --expect 27/28
 *
 * Exits non-zero when the page reports failure, errors, or times out.
 *
 * `--expect P/T` tallies the ✓/✗ marks in the page's own log and requires exactly P passing of T.
 * The OMR gate needs this: it reports a single boolean, which has been FAIL ever since the known
 * ORT-web int8 `\tup3` wobble on one strip's reference path (docs/STATUS.md). Pinning the tally at
 * 27/28 makes it a regression test — a 28th failure now breaks the build, where the boolean
 * could not tell "the known wobble" from "the refactor broke decoding".
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web");

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

async function main() {
  const [, , pagePath, globalName] = process.argv;
  if (!pagePath || !globalName) {
    console.error("usage: run-page.ts <page.html> <window-global> [--timeout ms] [--quiet]");
    process.exit(2);
  }
  const timeout = Number(arg("--timeout", "300000"));
  const quiet = process.argv.includes("--quiet");

  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const url = `${server.resolvedUrls!.local[0]!.replace(/\/$/, "")}/${pagePath}`;
  console.log(`serving ${WEB_ROOT}\nopening ${url}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  if (!quiet) {
    page.on("console", (m) => console.log(`  [${m.type()}] ${m.text()}`));
    page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  }

  let result: unknown;
  let timedOut = false;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      (name) => (window as unknown as Record<string, unknown>)[name] !== undefined,
      globalName,
      { timeout },
    );
    result = await page.evaluate(
      (name) => (window as unknown as Record<string, unknown>)[name],
      globalName,
    );
  } catch (e) {
    timedOut = true;
    console.error(`\n${globalName} never appeared within ${timeout} ms: ${(e as Error).message}`);
  }

  // The page's own rendered log is the readable report; print it either way.
  const text = await page.evaluate(() => document.getElementById("log")?.textContent ?? "");
  if (text) console.log(`\n--- page log ---\n${text}\n----------------`);

  await browser.close();
  await server.close();

  if (timedOut) process.exit(1);

  const expect = arg("--expect", "");
  if (expect) {
    // Tally the page's own ✓/✗ marks rather than trusting a single boolean.
    const passed = (text.match(/✓/g) ?? []).length;
    const failedN = (text.match(/✗/g) ?? []).length;
    const total = passed + failedN;
    const [wantPass, wantTotal] = expect.split("/").map(Number);
    const ok = passed === wantPass && total === wantTotal;
    console.log(`checks ${passed}/${total} (expected ${expect}) — ${ok ? "OK" : "MISMATCH"}`);
    process.exit(ok ? 0 : 1);
  }

  console.log(`${globalName} = ${typeof result === "string" ? "<page log>" : JSON.stringify(result)}`);
  if (typeof result === "string") {
    // A string global carries no verdict of its own; require --expect for those pages.
    console.error(`${globalName} is a plain log string — pass --expect P/T to assert on it.`);
    process.exit(1);
  }
  const r = result as { allOk?: boolean; ok?: boolean; error?: unknown } | undefined;
  const bad = !r || r.error !== undefined || r.allOk === false || r.ok === false;
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
