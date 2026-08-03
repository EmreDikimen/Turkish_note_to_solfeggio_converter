/**
 * Arm B — decode Python's own crops in the BROWSER and diff against Python's decode.
 *
 * This is the control arm the slicer port is judged against (docs/mvp/README.md W3), and it exists
 * because browser-vs-Python token equality will never be 100% even with a byte-perfect slicer: the
 * checkpoint's `resample: 2` is PIL BILINEAR while the product path uses a canvas draw. The gate
 * already shows the symptom at 27/28.
 *
 * So we measure the ceiling first. Feed both sides the SAME crop PNGs — Python's, straight off
 * disk — and whatever agreement rate comes out is the best any slicer could do. At W6 the ported
 * slicer's own crops (arm A) are held to "within 1 pp of this", not to 100%. Without this number
 * you would spend a week hunting a slicer bug that is a resampler.
 *
 * Runs the strips through headless Chromium rather than Node, deliberately: the canvas resampler
 * only exists in a browser, so a Node arm would not be the shipped path.
 *
 *   npx tsx tools/vision/parity/arm-b.ts --pages 5
 *   npx tsx tools/vision/parity/arm-b.ts --page data/real/strips_v2/<stem>
 */
import { chromium } from "playwright";
import { createServer } from "vite";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTokens, stitchStrips, type DecodedStrip } from "../../render/stitch";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_ROOT = path.join(ROOT, "apps/web");
const STRIPS = path.join(ROOT, "data/real/strips_v2");

/** The slicer config the current decode caches were produced under. A page whose header differs
 *  was cut by different code, and comparing against it would measure the wrong thing. */
const REQUIRED = {
  suffix: "_int8",
  measures_per_strip: 3,
  window_mode: "legacy",
  edge_trim: true,
  vplace: true,
} as const;

interface PyStrip {
  strip: string;
  system: number;
  window: number;
  tokens: string;
  n_ids: number;
  hit_cap: boolean;
  min_logprob: number;
  mean_logprob: number;
}
interface PyDecode {
  page: string;
  checkpoint: string;
  suffix: string;
  measures_per_strip: number;
  window_mode: string;
  edge_trim: boolean;
  vplace: boolean;
  strips: PyStrip[];
}

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

function eligible(dir: string): PyDecode | null {
  const stem = path.basename(dir);
  const f = path.join(dir, `${stem}_decode.json`);
  if (!existsSync(f)) return null;
  const j = JSON.parse(readFileSync(f, "utf8")) as PyDecode;
  if (!j.checkpoint?.endsWith("round2-stage2-best")) return null;
  for (const [k, v] of Object.entries(REQUIRED))
    if ((j as unknown as Record<string, unknown>)[k] !== v) return null;
  if (!j.strips?.length) return null;
  return j;
}

/**
 * Compare token streams the way the STITCHER sees them, not as raw strings.
 *
 * The two sides serialize differently and always have: `decode_page.py` stores HF `decode()`
 * output, which glues added tokens together (`\sig\komaFlatb \bakiyeFlate`), while the browser's
 * `detokenize` emits them spaced (`\sig \komaFlat b \bakiyeFlat e`). `normalizeTokens` is the
 * stitcher's own repair for exactly this and is what both streams pass through before becoming
 * music — so comparing before it measures a serialization difference, not a reading difference.
 *
 * Measured cost of getting this wrong: raw-string comparison put the arm-B ceiling at 10%, while
 * two of the three pages produced byte-identical scores.
 */
function norm(s: string): string {
  return normalizeTokens(s).replace(/\s+/g, " ").trim();
}

/** Compare two docs the way a user would notice: same events, same pitch/duration/bar. */
function docsMatch(a: { events: unknown[] }, b: { events: unknown[] }): boolean {
  const key = (e: Record<string, unknown>) =>
    `${e.kind}|${e.koma53}|${JSON.stringify(e.durationBeats)}|${e.bar}`;
  if (a.events.length !== b.events.length) return false;
  return a.events.every(
    (e, i) => key(e as Record<string, unknown>) === key(b.events[i] as Record<string, unknown>)
  );
}

async function main() {
  const one = arg("--page");
  const limit = Number(arg("--pages", "5"));

  const dirs = one
    ? [path.resolve(one)]
    : readdirSync(STRIPS)
        .map((d) => path.join(STRIPS, d))
        .filter((d) => existsSync(d));

  const jobs: { dir: string; py: PyDecode }[] = [];
  for (const d of dirs) {
    const py = eligible(d);
    if (py) jobs.push({ dir: d, py });
    if (!one && jobs.length >= limit) break;
  }
  if (!jobs.length) {
    console.error("no eligible page dirs found");
    process.exit(2);
  }
  console.log(`arm B — ${jobs.length} page(s), browser decode of Python's own crops\n`);

  const server = await createServer({ root: WEB_ROOT, server: { port: 0 } });
  await server.listen();
  const base = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  await page.goto(`${base}/strips-harness.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as any).__omr?.ready === true, null, { timeout: 120000 });

  const report: {
    page: string; strip: string; agree: boolean; width: number;
    nIdsPy: number; nIdsJs: number; minLogprobPy: number; minLogprobJs: number;
  }[] = [];
  let totStrips = 0;
  let totMatch = 0;
  let totMs = 0;
  let docsSame = 0;
  const perPage: string[] = [];

  for (const { dir, py } of jobs) {
    const stem = path.basename(dir);
    const inputs = py.strips
      .filter((s) => existsSync(path.join(dir, s.strip)))
      .map((s) => ({
        name: s.strip,
        system: s.system,
        window: s.window,
        dataUrl:
          "data:image/png;base64," + readFileSync(path.join(dir, s.strip)).toString("base64"),
      }));
    if (inputs.length !== py.strips.length)
      console.log(`  ⚠ ${stem}: ${py.strips.length - inputs.length} crop PNG(s) missing on disk`);

    const res = (await page.evaluate(
      ([strips, name]) => (window as any).__omr.decode(strips, name),
      [inputs, stem] as const
    )) as {
      strips: { name: string; tokens: string; nIds: number; minLogprob: number; hitCap: boolean }[];
      doc: { events: unknown[] };
      totalMs: number;
      warnings: string[];
    };

    // Crop geometry, so disagreement can be attributed rather than guessed at: a longer strip is
    // downscaled harder into the model's 409×583 box, which is where a resampler difference bites.
    const manFile = path.join(dir, `${stem}_manifest.json`);
    const widths = new Map<string, number>();
    if (existsSync(manFile))
      for (const r of JSON.parse(readFileSync(manFile, "utf8")) as { strip: string; width: number }[])
        widths.set(r.strip, r.width);

    const byName = new Map(res.strips.map((s) => [s.name, s]));
    let match = 0;
    const diffs: string[] = [];
    for (const s of py.strips) {
      const got = byName.get(s.strip);
      if (!got) continue;
      const agree = norm(got.tokens) === norm(s.tokens);
      if (agree) match++;
      else if (diffs.length < 2) diffs.push(s.strip);
      report.push({
        page: stem,
        strip: s.strip,
        agree,
        width: widths.get(s.strip) ?? -1,
        nIdsPy: s.n_ids,
        nIdsJs: got.nIds ?? -1,
        minLogprobPy: s.min_logprob,
        minLogprobJs: got.minLogprob,
      });
    }

    // The doc a user would get from Python's tokens, built with the identical stitcher options.
    const pyDoc = stitchStrips(py.strips as unknown as DecodedStrip[], {
      name: stem,
      accidentals: "carry",
    }).doc;
    const sameDoc = docsMatch(res.doc, pyDoc);
    if (sameDoc) docsSame++;

    totStrips += inputs.length;
    totMatch += match;
    totMs += res.totalMs;
    const pct = ((100 * match) / inputs.length).toFixed(1);
    perPage.push(
      `  ${stem.slice(0, 52).padEnd(52)} ${String(match).padStart(3)}/${String(inputs.length).padEnd(3)} ` +
        `strips (${pct}%)  doc ${sameDoc ? "same" : "DIFFERS"}  ${(res.totalMs / inputs.length).toFixed(0)} ms/strip`
    );
    if (diffs.length) perPage.push(`       first token diffs: ${diffs.join(", ")}`);
  }

  await browser.close();
  await server.close();

  console.log(perPage.join("\n"));
  const pct = (100 * totMatch) / totStrips;
  console.log(
    `\n== ARM B CEILING: ${totMatch}/${totStrips} strips decode identically to Python (${pct.toFixed(2)}%)`
  );
  console.log(`   stitched docs identical on ${docsSame}/${jobs.length} pages`);
  console.log(`   ${(totMs / totStrips).toFixed(0)} ms/strip in-browser (Python int8 ≈ 353 ms/strip)`);
  console.log(
    `\nThis is the ceiling for the ported slicer (arm A, W6): it is judged "within 1 pp of ${pct.toFixed(2)}%",\n` +
      "not against 100%. The gap is the PIL-BILINEAR vs canvas resampler, not the slicer."
  );

  const jsonOut = arg("--json");
  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(report, null, 1));
    console.log(`\nwrote ${jsonOut} (${report.length} strips)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
