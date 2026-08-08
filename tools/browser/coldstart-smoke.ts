/**
 * Does a COLD decode server still get the page? (the 2026-08-08 fix in `omr/remote.ts`)
 *
 * Cloud Run routes traffic as soon as the container listens, which is ~9.5 s before the graphs are
 * loaded, so `/decode` answers a truthful `503 model still loading` in that window. Until this fix
 * the client treated that like a dead server and read the whole page locally — so a friend's first
 * upload after any idle period never reached the server at all, which is the one thing the server
 * exists to prevent. `smoke:live` found it by failing its first run; nothing in the repo could have,
 * because every other check runs against an already-warm server.
 *
 * This check puts a deliberately-cold proxy in FRONT of a real decode server, so the cold window is
 * a parameter rather than a race:
 *
 *   run 1  cold for --cold-ms, then honest    → must finish ON THE SERVER, having waited
 *   run 2  a load that genuinely FAILED       → must NOT wait; that 503 never gets better
 *
 * Run 2 is the half that keeps the fix honest. "Retry a 503" applied to every 503 would hang a user
 * behind a broken container for the full warm-up budget, so what is asserted is the *absence* of
 * warm-up polling — the proxy counts the `/health` requests that follow the failed decode. It
 * deliberately does not wait for the local fallback to finish afterwards; `smoke:build` and
 * `smoke:live` already prove the fallback reads a page.
 *
 *   npm run dev:server &                     # the real server the proxy hides
 *   npm run check:coldstart
 */
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dismissMakamPrompt } from "./makamPrompt";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const IMAGES = path.join(ROOT, "data/real/images");

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want);
  if (g === w) console.log(`  ok    ${name}  ${g}`);
  else { failures++; console.log(`  FAIL  ${name}\n    want: ${w}\n    got : ${g}`); }
}

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

/** "warming" answers a still-loading 503; "broken" answers a load that failed; "pass" proxies. */
type Mode = "warming" | "broken" | "pass";

interface Fake {
  url: string;
  /** Set the behaviour for the next requests. */
  mode: (m: Mode) => void;
  /** `/health` hits since the last `resetCounts`, and `/decode` POSTs. */
  counts: () => { healths: number; decodes: number };
  resetCounts: () => void;
  close: () => Promise<void>;
}

/**
 * A decode server that can be cold on demand, in front of the real one.
 *
 * It mimics `apps/server/src/index.ts` on the two answers this fix turns on: `/health` reporting
 * `ready: false` with a 200 while loading (a 503 there means the load FAILED), and `/decode`
 * answering `503 {"error":"model still loading"}`. Everything else is proxied untouched, so a
 * passing run is a real decode by the real server rather than a fixture.
 */
function fakeColdServer(realUrl: string): Promise<Fake> {
  let mode: Mode = "warming";
  let healths = 0;
  let decodes = 0;

  const json = (res: ServerResponse, status: number, body: unknown) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
      "access-control-allow-origin": "*",
    });
    res.end(payload);
  };

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // `content-type: application/json` makes the POST preflighted, so OPTIONS is not optional.
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "0", // never cache a preflight — run 2 must reach the server too
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      healths++;
      if (mode === "warming") { json(res, 200, { ok: true, ready: false, uptimeS: 1 }); return; }
      if (mode === "broken") { json(res, 503, { ok: false, ready: false, error: "boom" }); return; }
      void proxy(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/decode") {
      decodes++;
      if (mode === "warming") { json(res, 503, { error: "model still loading" }); return; }
      if (mode === "broken") { json(res, 503, { error: "model failed to load: boom" }); return; }
      void proxy(req, res, url);
      return;
    }

    json(res, 404, { error: "not found" });
  });

  async function proxy(req: IncomingMessage, res: ServerResponse, url: URL) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    try {
      const upstream = await fetch(`${realUrl}${url.pathname}`, {
        method: req.method,
        headers: { "content-type": "application/json" },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(text),
        "access-control-allow-origin": "*",
      });
      res.end(text);
    } catch (err) {
      json(res, 502, { error: `proxy could not reach ${realUrl}: ${String(err)}` });
    }
  }

  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        url: `http://localhost:${port}`,
        mode: (m) => { mode = m; },
        counts: () => ({ healths, decodes }),
        resetCounts: () => { healths = 0; decodes = 0; },
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function main() {
  const realUrl = arg("--decode-url", "http://localhost:8080").replace(/\/$/, "");
  const coldMs = Number(arg("--cold-ms", "12000"));
  const image = findPage();

  // Refuse early rather than reporting a proxy failure as a fallback: without a real server behind
  // it, run 1 could only ever fail, and the message would point at the wrong thing.
  const probe = await fetch(`${realUrl}/health`).catch(() => null);
  if (!probe?.ok) throw new Error(`no decode server at ${realUrl} — start \`npm run dev:server\` first`);

  const fake = await fakeColdServer(realUrl);
  console.log(
    `cold-start smoke — ${path.relative(ROOT, image)}\n` +
      `  real server:  ${realUrl}\n  cold proxy:   ${fake.url}\n  cold window:  ${coldMs} ms\n`
  );

  const vite = await createViteServer({ root: WEB_ROOT, server: { port: 0 } });
  await vite.listen();
  const base = vite.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();

  // ---- run 1: cold, then ready. The page must land on the SERVER, and must have waited for it.
  {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    fake.mode("warming");
    fake.resetCounts();

    await page.goto(base, { waitUntil: "domcontentloaded" });
    // `VITE_DECODE_URL` is not set for a dev run, so point this tab at the proxy the way a deployed
    // build gets pointed at a local server.
    await page.evaluate((u) => localStorage.setItem("omrDecodeUrl", u), fake.url);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });

    // The app pings /health on open (the warm-up half of the fix). That is a real behaviour, so it
    // is asserted rather than tolerated.
    check("opening the app wakes the server", fake.counts().healths > 0, true);

    const readyAt = Date.now() + coldMs;
    setTimeout(() => fake.mode("pass"), coldMs);

    const t0 = Date.now();
    await page.locator("#page-input").setInputFiles(image);
    const status = page.locator("#omr-status");
    await status.waitFor({ timeout: 60000 });
    const deadline = Date.now() + 600000;
    while (Date.now() < deadline) {
      if ((await status.getAttribute("data-state")) === "done") break;
      if (await page.locator("#omr-error").count()) break;
      await dismissMakamPrompt(page);
      await page.waitForTimeout(500);
    }
    await dismissMakamPrompt(page);

    const done = (await status.getAttribute("data-state")) === "done";
    const where = await status.getAttribute("data-where");
    const counts = await Promise.all(
      ["data-staves", "data-strips", "data-notes", "data-measures"].map(async (a) =>
        Number(await status.getAttribute(a))
      )
    );
    const elapsed = (Date.now() - t0) / 1000;
    console.log(`  run 1: ${elapsed.toFixed(1)} s — ${counts.join("/")}`);

    check("run 1: the page was read", done && counts.every((n) => n > 0), true);
    check("run 1: it ran ON THE SERVER despite the cold start", where, "server");
    // The decode cannot have started before the proxy went honest, so a server-path result proves
    // the client held on rather than got lucky with the timing.
    check("run 1: it waited out the cold window", Date.now() > readyAt, true);
    check("run 1: it re-asked more than once", fake.counts().decodes >= 2, true);
    check("run 1: no page errors", errors.join("; ").slice(0, 160) || "none", "none");
    await page.close();
  }

  // ---- run 2: a load that FAILED. Waiting must not happen — that 503 never gets better.
  {
    const page = await browser.newPage();
    fake.mode("broken");

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.evaluate((u) => localStorage.setItem("omrDecodeUrl", u), fake.url);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('#app[data-ready="1"]', { timeout: 60000 });

    fake.resetCounts();
    await page.locator("#page-input").setInputFiles(image);
    // Wait for the decode attempt itself, then watch for polling that must not come.
    const until = Date.now() + 90000;
    while (Date.now() < until && fake.counts().decodes === 0) await page.waitForTimeout(250);
    check("run 2: the server was tried", fake.counts().decodes, 1);

    const healthsAtRefusal = fake.counts().healths;
    await page.waitForTimeout(8000);
    check(
      "run 2: a FAILED load is not waited on",
      fake.counts().healths - healthsAtRefusal,
      0
    );
    check("run 2: and it was not re-POSTed either", fake.counts().decodes, 1);
    await page.close();
  }

  await browser.close();
  await vite.close();
  await fake.close();

  console.log(failures === 0 ? "\nPASS — a cold server still gets the page." : `\nFAIL — ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
