/**
 * What a page actually costs on the decode server — build step 1's other half (docs/mvp/deploy.md).
 *
 * deploy.md left two questions open and marked every cost figure on the page as derived from M4
 * timings rather than measured. This answers both, against a real server:
 *
 *   1. **vCPU-seconds per page**, taken from the server's own `process.cpuUsage()` rather than from
 *      wall time — that is what Cloud Run bills, and with threads > 1 the two are not the same
 *      number. Plus cold start, measured as the first request against a just-started process.
 *   2. **Does the ~19 crops/page upload beat sending the page image?** Both are on disk here, so
 *      this is a byte count, not an argument.
 *
 * It replays a FIXTURE of already-preprocessed strips (`npm run parity:server -- --fixture f.json`)
 * so the benchmark never needs a browser: the point is to time the server, and starting Chromium
 * inside the measurement would put a resampler in the stopwatch.
 *
 *   npm run parity:server -- --pages 2 --fixture bench.json     # once, to build the fixture
 *   npm run bench:server -- --fixture bench.json --repeat 3
 *   npm run bench:server -- --fixture bench.json --url https://decode-xxx.run.app --cold
 *
 * ⚠ Run against the CONTAINER, not `npm run dev:server`, and quote the host: a benchmark taken on
 * an M4 says nothing about a shared cloud vCPU except as an upper bound.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const IMAGES = path.join(ROOT, "data/real/images");

/** The fixture `server-parity.ts --fixture` writes: it carries the browser's answers too, which
 *  this script ignores — only the upload half is replayed. */
interface FixturePage {
  page: string;
  strips: { system: number; window: number; name: string; png: string; cropBytes: number }[];
}

interface Timings {
  encoderMs: number;
  decodeMs: number;
  totalMs: number;
  batches: number[];
  queuedAndRanMs: number;
  cpuMs: number;
}

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

/** The source page image for a strip dir, so the payload comparison uses the real file. */
function pageImageBytes(stem: string): number | null {
  if (!existsSync(IMAGES)) return null;
  for (const makam of readdirSync(IMAGES)) {
    const f = path.join(IMAGES, makam, `${stem}.png`);
    if (existsSync(f)) return statSync(f).size;
  }
  return null;
}

async function post(url: string, body: string): Promise<{ timings: Timings; wallMs: number }> {
  const t0 = Date.now();
  const res = await fetch(`${url}/decode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const wallMs = Date.now() - t0;
  if (!res.ok) throw new Error(`server said ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { timings: Timings };
  return { timings: json.timings, wallMs };
}

function pct(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

async function main() {
  const url = arg("--url", "http://localhost:8080").replace(/\/$/, "");
  const fixtureFile = arg("--fixture");
  const repeat = Number(arg("--repeat", "3"));
  const cold = process.argv.includes("--cold");

  if (!fixtureFile || !existsSync(fixtureFile)) {
    console.error("need --fixture <file> from: npm run parity:server -- --fixture <file>");
    process.exit(2);
  }
  const fixture = JSON.parse(readFileSync(fixtureFile, "utf8")) as FixturePage[];

  // Cold start, measured the only way that is honest: how long the FIRST request takes against a
  // process that has not served one. Requires a freshly started server (or container).
  const health0 = Date.now();
  let ready = false;
  let readyMs = 0;
  for (let i = 0; i < 600 && !ready; i++) {
    try {
      const h = (await (await fetch(`${url}/health`)).json()) as { ready: boolean };
      ready = h.ready;
    } catch {
      /* not listening yet */
    }
    if (!ready) await new Promise((r) => setTimeout(r, 250));
    readyMs = Date.now() - health0;
  }
  if (!ready) {
    console.error(`server at ${url} never became ready`);
    process.exit(2);
  }

  const health = (await (await fetch(`${url}/health`)).json()) as {
    threads: number;
    maxBatch: number;
    uptimeS: number;
  };
  console.log(
    `bench — ${url}\n` +
      `  ${health.threads} thread(s), max batch ${health.maxBatch}, up ${health.uptimeS} s\n` +
      (cold ? `  time to ready from this script's first probe: ${(readyMs / 1000).toFixed(1)} s\n` : "")
  );

  const rows: string[] = [];
  let cpuTotal = 0;
  let stripTotal = 0;
  const perPageWall: number[] = [];

  for (const page of fixture) {
    // Only the four fields the endpoint takes: the fixture also holds the browser's own decode,
    // and measuring THAT as upload bytes would answer the payload question with the wrong number.
    const body = JSON.stringify({
      strips: page.strips.map((s) => ({
        system: s.system,
        window: s.window,
        name: s.name,
        png: s.png,
      })),
    });
    const uploadBytes = Buffer.byteLength(body);
    const cropBytes = page.strips.reduce((a, s) => a + (s.cropBytes ?? 0), 0);
    const pageBytes = pageImageBytes(page.page);

    const runs: { timings: Timings; wallMs: number }[] = [];
    for (let i = 0; i < repeat; i++) runs.push(await post(url, body));
    if (cold && runs.length > 1) {
      // The first run of the first page carries the cold cost; report it, then drop it from p50.
      rows.push(`  ${page.page}: first request ${(runs[0]!.wallMs / 1000).toFixed(1)} s (COLD)`);
    }
    const warm = cold && runs.length > 1 ? runs.slice(1) : runs;

    const wall = warm.map((r) => r.wallMs);
    const cpu = warm.map((r) => r.timings.cpuMs);
    const enc = warm.map((r) => r.timings.encoderMs);
    const dec = warm.map((r) => r.timings.decodeMs);
    cpuTotal += pct(cpu, 50);
    stripTotal += page.strips.length;
    perPageWall.push(pct(wall, 50));

    rows.push(
      `  ${page.page.slice(0, 40).padEnd(40)} ${String(page.strips.length).padStart(2)} strips  ` +
        `wall ${(pct(wall, 50) / 1000).toFixed(1)} s  cpu ${(pct(cpu, 50) / 1000).toFixed(1)} s  ` +
        `(enc ${(pct(enc, 50) / 1000).toFixed(1)} + dec ${(pct(dec, 50) / 1000).toFixed(1)})  ` +
        `batches ${warm[0]!.timings.batches.join("+")}`
    );
    rows.push(
      `      upload ${(uploadBytes / 1024).toFixed(0)} KB` +
        (pageBytes
          ? `  vs page image ${(pageBytes / 1024).toFixed(0)} KB  (${(uploadBytes / pageBytes).toFixed(2)}× the page)`
          : `  (page image not found on disk)`) +
        `   raw crops ${(cropBytes / 1024).toFixed(0)} KB`
    );
  }

  console.log(rows.join("\n"));
  console.log(
    `\n== median per page: ${(perPageWall.reduce((a, b) => a + b, 0) / perPageWall.length / 1000).toFixed(1)} s wall, ` +
      `${(cpuTotal / fixture.length / 1000).toFixed(1)} vCPU-s\n` +
      `   ${(cpuTotal / stripTotal / 1000).toFixed(2)} vCPU-s per strip over ${stripTotal} strips\n` +
      `   Cloud Run free tier (~180k vCPU-s/month) ≈ ` +
      `${Math.round(180_000 / (cpuTotal / fixture.length / 1000)).toLocaleString()} pages/month`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
