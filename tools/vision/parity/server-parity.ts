/**
 * Build step 2 of W9: **prove the decode server matches the browser** (docs/mvp/deploy.md).
 *
 * The browser is the reference, exactly as Python was the reference for the slicer port. The
 * difference is that this is a smoke test rather than a rung, and the reason is architectural:
 * the server imports `apps/web/src/omr/decode.ts`, so the greedy loop, the stopping rule and the
 * logprob scoring are not a second implementation to be checked — they are the same lines. What
 * genuinely CAN differ is the ONNX runtime underneath (`onnxruntime-node` against
 * `onnxruntime-web`), and the gate already shows that surface is not silent: one strip's `\tup3`
 * flips under an int8 numerics wobble at 27/28.
 *
 * So the check holds everything else still. The browser harness preprocesses each crop and hands
 * back BOTH the PNG it would upload and the ids it read; those same PNG bytes go to the server.
 * PNG is lossless, so both runtimes see identical pixels and any disagreement is the runtime's —
 * or the batching's, which is why `--replay` exists (below).
 *
 *   npm run parity:server -- --pages 6 --fixture f.json    # drives the browser, saves both halves
 *   npm run parity:server -- --replay f.json               # server only, no browser, seconds not minutes
 *   npm run parity:server -- --replay f.json --url https://decode-xxxx.run.app
 *
 * `--replay` is what makes the interesting question answerable. A disagreement here has two
 * possible causes — the runtime, or the batched encoder — and they are told apart by replaying the
 * SAME fixture against a server started with `OMR_MAX_BATCH=1`. Without the replay each such run
 * would cost another few minutes of browser decode and a hot laptop.
 *
 * Divergences print the browser's log-probability AT the diverging token, because that is the
 * difference between "the two runtimes tipped a near-tie the other way" and "one of them is wrong".
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTokens } from "../../render/stitch";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const STRIPS = path.join(ROOT, "data/real/strips_v2");

/** One strip as the browser prepared it: the upload bytes plus what the browser itself read. */
interface PreparedStrip {
  name: string;
  system: number;
  window: number;
  png: string;
  ids: number[];
  tokens: string;
  logprobs: number[];
  minLogprob: number;
  hitCap: boolean;
  encoderMs: number;
  decodeMs: number;
  cropBytes: number;
}

interface PreparedPage {
  page: string;
  strips: PreparedStrip[];
}

interface ServerStrip {
  system: number;
  window: number;
  name?: string;
  ids: number[];
  tokens: string;
  hitCap: boolean;
  minLogprob: number;
  meanLogprob: number;
}

interface ServerReply {
  strips: ServerStrip[];
  timings: {
    encoderMs: number;
    decodeMs: number;
    totalMs: number;
    batches: number[];
    queuedAndRanMs: number;
    cpuMs: number;
  };
  threads: number;
}

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

function norm(s: string): string {
  return normalizeTokens(s).replace(/\s+/g, " ").trim();
}

/** Page dirs that actually hold crop PNGs — the crop filenames carry the position. */
function pageDirs(limit: number, one: string): { dir: string; crops: string[] }[] {
  const dirs = one ? [path.resolve(one)] : readdirSync(STRIPS).map((d) => path.join(STRIPS, d));
  const out: { dir: string; crops: string[] }[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const crops = readdirSync(dir)
      .filter((f) => /_s\d+_w\d+\.png$/.test(f))
      .sort();
    if (crops.length) out.push({ dir, crops });
    if (!one && out.length >= limit) break;
  }
  return out;
}

function positionOf(name: string): { system: number; window: number } {
  const m = /_s(\d+)_w(\d+)\.png$/.exec(name)!;
  return { system: Number(m[1]), window: Number(m[2]) };
}

/** Drive the real client path in headless Chromium: preprocess, decode, hand back both. */
async function prepareInBrowser(jobs: { dir: string; crops: string[] }[]): Promise<PreparedPage[]> {
  const vite = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await vite.listen();
  const base = vite.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  await page.goto(`${base}/server-parity.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).__omrParity?.ready === true, null, {
    timeout: 120000,
  });

  const pages: PreparedPage[] = [];
  for (const { dir, crops } of jobs) {
    const stem = path.basename(dir);
    const inputs = crops.map((f) => ({
      name: f,
      ...positionOf(f),
      dataUrl: "data:image/png;base64," + readFileSync(path.join(dir, f)).toString("base64"),
    }));
    const strips = (await page.evaluate(
      (s) => (window as any).__omrParity.prepare(s),
      inputs
    )) as PreparedStrip[];
    pages.push({ page: stem, strips });
    console.log(`  prepared ${stem.slice(0, 44).padEnd(44)} ${strips.length} strips in the browser`);
  }

  await browser.close();
  await vite.close();
  return pages;
}

async function main() {
  const url = arg("--url", "http://localhost:8080").replace(/\/$/, "");
  const replay = arg("--replay");
  const fixtureFile = arg("--fixture");
  const minAgree = Number(arg("--min-agree", "93"));
  const outFile = arg("--out");

  const health = (await (await fetch(`${url}/health`)).json()) as {
    ready: boolean;
    threads?: number;
    maxBatch?: number;
  };
  if (!health.ready) {
    console.error(`server at ${url} is not ready: ${JSON.stringify(health)}`);
    process.exit(2);
  }

  let pages: PreparedPage[];
  if (replay) {
    pages = JSON.parse(readFileSync(replay, "utf8")) as PreparedPage[];
    console.log(
      `server parity (REPLAY of ${path.basename(replay)}) — ${pages.length} page(s) vs ${url}\n` +
        `  server: ${health.threads} thread(s), max batch ${health.maxBatch}\n`
    );
  } else {
    const jobs = pageDirs(Number(arg("--pages", "3")), arg("--page"));
    if (!jobs.length) {
      console.error(`no page dirs with crops under ${STRIPS}`);
      process.exit(2);
    }
    console.log(
      `server parity — ${jobs.length} page(s) vs ${url}\n` +
        `  server: ${health.threads} thread(s), max batch ${health.maxBatch}\n`
    );
    pages = await prepareInBrowser(jobs);
    if (fixtureFile) {
      writeFileSync(fixtureFile, JSON.stringify(pages));
      console.log(`  wrote ${fixtureFile} — replay it with --replay, no browser needed\n`);
    }
  }

  let totStrips = 0;
  let idMatch = 0;
  let tokenMatch = 0;
  let browserMs = 0;
  let serverMs = 0;
  let serverCpuMs = 0;
  let uploadBytes = 0;
  let cropBytes = 0;
  const divergent: string[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const { page: stem, strips: prepared } of pages) {
    const body = JSON.stringify({
      strips: prepared.map((s) => ({
        system: s.system,
        window: s.window,
        name: s.name,
        png: s.png,
      })),
    });
    uploadBytes += Buffer.byteLength(body);
    cropBytes += prepared.reduce((a, s) => a + s.cropBytes, 0);

    const t0 = Date.now();
    const res = await fetch(`${url}/decode`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const wallMs = Date.now() - t0;
    if (!res.ok) {
      console.error(`  ${stem}: server said ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    const reply = (await res.json()) as ServerReply;

    let pageIdMatch = 0;
    for (const [i, b] of prepared.entries()) {
      const s = reply.strips[i]!;
      const sameIds = b.ids.length === s.ids.length && b.ids.every((v, k) => v === s.ids[k]);
      totStrips++;
      if (sameIds) {
        idMatch++;
        pageIdMatch++;
      } else if (divergent.length < 20) {
        const at = b.ids.findIndex((v, k) => v !== s.ids[k]);
        const lp = b.logprobs[at];
        divergent.push(
          `${b.name} — token ${at}: browser ${b.ids[at]} vs server ${s.ids[at]}, ` +
            `browser logprob there ${lp === undefined ? "n/a" : lp.toFixed(3)} ` +
            `(p=${lp === undefined ? "?" : Math.exp(lp).toFixed(2)}), ${b.ids.length} vs ${s.ids.length} ids`
        );
      }
      if (norm(b.tokens) === norm(s.tokens)) tokenMatch++;
      browserMs += b.encoderMs + b.decodeMs;
      rows.push({
        page: stem,
        strip: b.name,
        sameIds,
        divergeAt: sameIds ? -1 : b.ids.findIndex((v, k) => v !== s.ids[k]),
        divergeLogprob: sameIds ? 0 : (b.logprobs[b.ids.findIndex((v, k) => v !== s.ids[k])] ?? 0),
        browserIds: b.ids.length,
        serverIds: s.ids.length,
        browserMinLogprob: b.minLogprob,
        serverMinLogprob: s.minLogprob,
      });
    }
    serverMs += reply.timings.totalMs;
    serverCpuMs += reply.timings.cpuMs ?? 0;

    console.log(
      `  ${stem.slice(0, 40).padEnd(40)} ${String(pageIdMatch).padStart(3)}/${String(prepared.length).padEnd(3)} ` +
        `ids  server ${(reply.timings.totalMs / 1000).toFixed(1)} s ` +
        `(enc ${(reply.timings.encoderMs / 1000).toFixed(1)} + dec ${(reply.timings.decodeMs / 1000).toFixed(1)}, ` +
        `batches ${reply.timings.batches.join("+")}, cpu ${((reply.timings.cpuMs ?? 0) / 1000).toFixed(1)} s)  ` +
        `wall ${(wallMs / 1000).toFixed(1)} s`
    );
  }

  const pct = (100 * idMatch) / totStrips;
  const divergeLps = rows.filter((r) => !r.sameIds).map((r) => r.divergeLogprob as number);
  const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1]! : NaN);

  console.log(
    `\n== ${totStrips} strips over ${pages.length} page(s)\n` +
      `   token ids identical : ${idMatch}/${totStrips} (${pct.toFixed(1)}%)\n` +
      `   stitcher-normalized : ${tokenMatch}/${totStrips} (${((100 * tokenMatch) / totStrips).toFixed(1)}%)\n` +
      (browserMs
        ? `   decode time         : browser ${(browserMs / 1000).toFixed(1)} s vs server ${(serverMs / 1000).toFixed(1)} s ` +
          `(${(browserMs / serverMs).toFixed(2)}×), server cpu ${(serverCpuMs / 1000).toFixed(1)} s\n`
        : `   server decode       : ${(serverMs / 1000).toFixed(1)} s wall, ${(serverCpuMs / 1000).toFixed(1)} s cpu\n`) +
      `   upload              : ${(uploadBytes / 1024).toFixed(0)} KB of JSON for ${totStrips} strips ` +
      `(raw crops on disk: ${(cropBytes / 1024).toFixed(0)} KB)`
  );
  if (divergent.length) {
    console.log(
      `\n   divergent strips (browser logprob at the diverging token — near 0 means the model was ` +
        `sure, and a flip there would NOT be a coin toss):`
    );
    for (const d of divergent) console.log(`     ${d}`);
    console.log(
      `   median browser logprob at divergence: ${median(divergeLps).toFixed(3)} ` +
        `(p=${Math.exp(median(divergeLps)).toFixed(2)})`
    );
  }
  if (outFile) {
    writeFileSync(outFile, JSON.stringify({ url, totStrips, idMatch, tokenMatch, rows }, null, 2));
    console.log(`\n   wrote ${outFile}`);
  }

  const ok = pct >= minAgree;
  console.log(`\n== ${ok ? "PASS" : "FAIL"} (bar: ${minAgree}% of strips with identical ids)`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
