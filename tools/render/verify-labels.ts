/**
 * Pixels-vs-labels verifier for a rendered strip corpus.
 *
 * WHY: `render.ts` writes the label from the note model and the PNG from the engraving. Those are
 * two different decision paths — `noteToLily` (tools/render/lilypond.ts) and `buildStaveNotes`
 * (apps/web/src/SheetView.tsx) — and on 2026-07-26 they were found to disagree: `sigTolerant` was
 * implemented on the label side only, so 18.8% of `strips_v3`'s signature-bearing carry strips drew
 * an accidental their label omitted (2,369 of them `\kucukSharp`). Nothing caught it, because
 * nothing had ever compared what is DRAWN with what is LABELLED.
 *
 * WHAT IT DOES: re-opens every render job straight from the corpus manifest (which stores the full
 * URL parameter set, so the job is reproduced exactly and deterministically), reads the accidental
 * glyphs out of the live SVG with their positions, assigns each to the strip crop it falls inside,
 * and compares that multiset against the accidental tokens in that strip's label — signature block
 * included, since a row-start crop shows the donanım.
 *
 * Glyph identity comes from the DOM, not from the code under test:
 *   - Bravura `<text>` glyphs are identified by SMuFL codepoint (packages/core/src/notation.ts);
 *   - `--thin-sharps` replaces the four AEU sharps with `<g data-omr="aeu-sharp">`, whose
 *     (stem count, bar count) is unique per sharp: koma 1×2, bakiye 2×2, küçük 1×3, büyük 2×3.
 *
 * Prereq: the harness dev server running (`npm run dev:web`).
 * Run:    npx tsx tools/render/verify-labels.ts --strips data/synthetic/strips_v4 --thin-sharps
 *             [--limit 20]      verify only the first N jobs (smoke)
 *             [--every 1]       verify every Nth job (sampling for a quick pass)
 *             [--out report.json]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { hashStr } from "./rng";

const URL = process.env.OMR_URL ?? "http://localhost:5173";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const STRIPS = arg("strips") ?? "data/synthetic/strips_v4";
const THIN_SHARPS = has("thin-sharps");
// Round-3 staccato distractors. Not a manifest field (it is an A/B arm marker, kept out so the two
// arms' manifests stay byte-identical), so this reseeds per piece rather than replaying the render's
// seed — the check is "do the extra dots break the glyph<->label correspondence", not "reproduce
// that exact page". Without it the distractor is simply absent and this file would pass trivially.
const STACCATO_NOISE = has("staccato-noise");
const staccatoSeed = (piece: string) => hashStr(`${piece}:verify:staccato`);
// The concave tuplet mark (2026-08-19). Like the staccato dots it is pixels only and NOT a manifest
// field, so it is replayed from the flag rather than from the row. It changes no strip boundary and
// no accidental, so this file passes with or without it — it is carried so the verifier looks at the
// same picture the corpus ships, which is the whole point of running it against an arm.
const CONCAVE_TUPLET = has("concave-tuplet");
// Round-3 Lever 1: the strip-packing measure rail the corpus was rendered at. This one MUST be
// replayed rather than reseeded, because unlike the staccato dots it changes the strip BOUNDARIES —
// the manifest's `m<from>-<to>` ids are what this file looks strips up by, so replaying a narrow arm
// at the default budget makes every id unresolvable and reports the whole corpus as "strip not
// published by the harness". Read from render_config.json when present so it cannot be forgotten,
// with the flag as an override for a pool rendered before that field existed.
const MAX_MEASURES = (() => {
  const flag = arg("max-measures");
  if (flag != null) return Number(flag);
  try {
    const cfg = JSON.parse(readFileSync(`${STRIPS}/render_config.json`, "utf8"));
    return typeof cfg.maxMeasures === "number" ? cfg.maxMeasures : null;
  } catch {
    return null; // no config on disk (pre-2026-08-17 pool) => the default budget, as before
  }
})();
const LIMIT = arg("limit") != null ? Number(arg("limit")) : Infinity;
const EVERY = Number(arg("every") ?? 1);
const OUT = arg("out") ?? `${STRIPS}/verify_labels.json`;

/** The accidental tokens a label can carry. `\sig`/`\sigend` are delimiters, not glyphs. */
const ACC_TOKENS = [
  "\\komaSharp", "\\bakiyeSharp", "\\kucukSharp", "\\buyukSharp",
  "\\komaFlat", "\\bakiyeFlat", "\\kucukFlat", "\\buyukFlat", "\\natural",
];

interface Row {
  image: string; label: string; mode: string; sig: string | null; piece: string;
  transpose: number; lyrics: boolean; repseed: number | null; navseed: number | null;
  textseed: number; respellseed: number; slurseed: number; from: number; to: number;
}

/** One render job = every manifest row that shares the same URL parameters. */
function jobKey(r: Row): string {
  return JSON.stringify([r.piece, r.mode, r.transpose, r.lyrics, r.sig,
    r.repseed, r.navseed, r.textseed, r.respellseed, r.slurseed]);
}

function jobUrl(r: Row): string {
  const q = new URLSearchParams({
    score: `/scores/${r.piece}.json`,
    mode: r.mode,
    lyrics: r.lyrics ? "1" : "0",
    transpose: String(r.transpose),
    textseed: String(r.textseed),
    respellseed: String(r.respellseed),
    slurseed: String(r.slurseed),
  });
  if (r.sig) q.set("sig", r.sig);
  if (r.repseed != null) q.set("repseed", String(r.repseed));
  if (r.navseed != null) q.set("navseed", String(r.navseed));
  if (THIN_SHARPS) q.set("thinsharps", "1");
  if (STACCATO_NOISE) q.set("staccatoseed", String(staccatoSeed(r.piece)));
  if (CONCAVE_TUPLET) q.set("concavetuplet", "1");
  if (MAX_MEASURES != null) q.set("maxmeasures", String(MAX_MEASURES));
  return `${URL}/?${q}`;
}

/** Accidental tokens in a label, in order (the `\sig … \sigend` body counts — a row-start crop
 *  shows those glyphs, so they must be matched against the drawing too). */
function labelAccidentals(label: string): string[] {
  return (label.match(/\\[A-Za-z]+/g) ?? []).filter((t) => ACC_TOKENS.includes(t));
}

function counts(list: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const t of list) c[t] = (c[t] ?? 0) + 1;
  return c;
}

function diff(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (d !== 0) out[k] = d;
  }
  return out;
}

interface PageGlyph { cls: string; cx: number; cy: number }
interface PageStrip { id: string; label: string; rect: { x: number; y: number; width: number; height: number } }

/** Read every accidental glyph (class + centre) and the published strips out of the live page. */
async function readPage(page: Page): Promise<{ glyphs: PageGlyph[]; strips: PageStrip[]; unknown: string[] }> {
  return page.evaluate(() => {
    const CP: Record<number, string> = {
      0xe444: "\\komaSharp", 0xe445: "\\bakiyeSharp", 0xe446: "\\kucukSharp", 0xe447: "\\buyukSharp",
      0xe443: "\\komaFlat", 0xe442: "\\bakiyeFlat", 0xe441: "\\kucukFlat", 0xe440: "\\buyukFlat",
      0xe261: "\\natural",
    };
    // (stems, bars) is unique per AEU sharp — see AEU_SHARPS in SheetView.tsx.
    const SHAPE: Record<string, string> = {
      "1,2": "\\komaSharp", "2,2": "\\bakiyeSharp", "1,3": "\\kucukSharp", "2,3": "\\buyukSharp",
    };
    const svg = document.querySelector('[data-omr="sheet-svg"]') as SVGSVGElement | null;
    const glyphs: { cls: string; cx: number; cy: number }[] = [];
    const unknown: string[] = [];
    if (!svg) return { glyphs, strips: [], unknown };

    // NB: no named helpers in here — the transpiler wraps them in a `__name` shim that does not
    // exist inside the page.
    for (const g of Array.from(svg.querySelectorAll('g[data-omr="aeu-sharp"]'))) {
      const key = `${g.querySelectorAll("rect").length},${g.querySelectorAll("polygon").length}`;
      const cls = SHAPE[key];
      if (!cls) { unknown.push(`shape:${key}`); continue; }
      const b = (g as SVGGraphicsElement).getBBox();
      glyphs.push({ cls, cx: b.x + b.width / 2, cy: b.y + b.height / 2 });
    }
    for (const t of Array.from(svg.querySelectorAll("text"))) {
      const cp = t.textContent?.codePointAt(0);
      if (cp == null) continue;
      const cls = CP[cp];
      if (!cls) {
        // Flag only unmapped glyphs from the two ACCIDENTAL blocks — standard (U+E260..E26F) and
        // Turkish/AEU (U+E440..E44F). The rest of U+E4xx is rests and articulations.
        if ((cp >= 0xe260 && cp <= 0xe26f) || (cp >= 0xe440 && cp <= 0xe44f)) {
          unknown.push(`cp:${cp.toString(16)}`);
        }
        continue;
      }
      const b = (t as unknown as SVGGraphicsElement).getBBox();
      glyphs.push({ cls, cx: b.x + b.width / 2, cy: b.y + b.height / 2 });
    }
    const strips = ((window as any).__omrStrips ?? []) as PageStrip[];
    return { glyphs, strips, unknown };
  }) as Promise<{ glyphs: PageGlyph[]; strips: PageStrip[]; unknown: string[] }>;
}

async function openJob(page: Page, r: Row): Promise<void> {
  await page.goto(jobUrl(r), { waitUntil: "networkidle" });
  await page.waitForFunction(
    (want) => {
      const c = (window as any).__omrConfig;
      return (
        c && c.applied && c.score === want.score && c.mode === want.mode &&
        c.lyrics === want.lyrics && c.transpose === want.transpose && c.sig === want.sig &&
        c.repseed === want.repseed && c.navseed === want.navseed &&
        c.textseed === want.textseed && c.respellseed === want.respellseed && c.slurseed === want.slurseed &&
        c.staccatoseed === want.staccatoseed &&
        // The rail that decides the strip boundaries this file matches ids against — so a
        // mismatched replay fails loudly here instead of as 100% "strip not published".
        c.maxmeasures === want.maxmeasures
      );
    },
    {
      score: `/scores/${r.piece}.json`, mode: r.mode, lyrics: r.lyrics, transpose: r.transpose,
      sig: r.sig, repseed: r.repseed, navseed: r.navseed, textseed: r.textseed,
      respellseed: r.respellseed, slurseed: r.slurseed,
      staccatoseed: STACCATO_NOISE ? staccatoSeed(r.piece) : null,
      maxmeasures: MAX_MEASURES,
    },
    { timeout: 30000 },
  );
}

async function main() {
  const rows: Row[] = readFileSync(`${STRIPS}/manifest.jsonl`, "utf8")
    .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

  const jobs = new Map<string, Row[]>();
  for (const r of rows) {
    const k = jobKey(r);
    if (!jobs.has(k)) jobs.set(k, []);
    jobs.get(k)!.push(r);
  }
  const jobList = [...jobs.values()].filter((_, i) => i % EVERY === 0).slice(0, LIMIT);
  // Name EVERY arm flag, not just one: the whole failure mode this gate exists inside is checking a
  // different picture than the corpus ships, and a banner that mentions only thin sharps reads as a
  // full description of the run when it is not.
  const flags = [THIN_SHARPS && "thin sharps", STACCATO_NOISE && "staccato", CONCAVE_TUPLET && "concave tuplet"]
    .filter(Boolean).join(", ");
  console.log(`${rows.length} strips / ${jobs.size} jobs in ${STRIPS}; verifying ${jobList.length} jobs` +
    (flags ? ` (${flags})` : " (no arm flags)"));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });

  let checked = 0, ok = 0;
  const mismatches: any[] = [];
  const labelDrift: any[] = [];
  const unknownGlyphs = new Set<string>();
  let jobIdx = 0;

  for (const group of jobList) {
    jobIdx++;
    const r0 = group[0]!;
    try {
      await openJob(page, r0);
    } catch (e) {
      mismatches.push({ job: r0.piece, error: `open failed: ${String(e).split("\n")[0]}` });
      continue;
    }
    const { glyphs, strips, unknown } = await readPage(page);
    for (const u of unknown) unknownGlyphs.add(u);

    const byId = new Map(strips.map((s) => [s.id, s]));
    for (const row of group) {
      const id = `m${row.from}-${row.to}`;
      const s = byId.get(id);
      if (!s) {
        mismatches.push({ image: row.image, error: "strip not published by the harness" });
        continue;
      }
      // The manifest label must still be what the harness produces — otherwise the corpus on disk
      // and the current code have drifted apart, and everything below is measuring the wrong thing.
      if (s.label !== row.label) labelDrift.push({ image: row.image, manifest: row.label, now: s.label });

      const inside = glyphs.filter((g) =>
        g.cx >= s.rect.x && g.cx <= s.rect.x + s.rect.width &&
        g.cy >= s.rect.y && g.cy <= s.rect.y + s.rect.height);
      const drawn = counts(inside.map((g) => g.cls));
      const labelled = counts(labelAccidentals(row.label));
      const d = diff(drawn, labelled);
      checked++;
      if (Object.keys(d).length === 0) ok++;
      else mismatches.push({ image: row.image, sig: row.sig, delta: d, drawn, labelled, label: row.label });
    }
    if (jobIdx % 25 === 0) {
      console.log(`  [${jobIdx}/${jobList.length}] ${checked} strips checked, ${checked - ok} mismatched`);
    }
  }
  await browser.close();

  const report = {
    strips: STRIPS, thinSharps: THIN_SHARPS, jobsVerified: jobList.length,
    stripsChecked: checked, stripsOk: ok, mismatched: checked - ok,
    labelDrift: labelDrift.length, unknownGlyphs: [...unknownGlyphs],
    mismatches: mismatches.slice(0, 200), labelDriftSamples: labelDrift.slice(0, 20),
  };
  writeFileSync(OUT, JSON.stringify(report, null, 1));
  console.log(`\nchecked ${checked} strips: ${ok} exact, ${checked - ok} mismatched` +
    ` | label drift vs manifest: ${labelDrift.length}` +
    ` | unknown glyphs: ${[...unknownGlyphs].join(",") || "none"}`);
  console.log(`report -> ${OUT}`);
  // A run that checked NOTHING is not a pass. `checked - ok > 0` alone is false at 0/0, so the
  // whole corpus gate — the one CLAUDE.md makes a corpus's trainability depend on — used to exit 0
  // after verifying zero strips. That is exactly how the Round-1 pixels-vs-labels defect stayed
  // invisible. Observed 2026-08-05: 1,019 jobs "verified", 0 strips checked, exit 0, because the
  // dev server was not running.
  if (checked === 0) {
    console.error(
      `\nFAIL — 0 strips checked over ${jobList.length} job(s). This is NOT a pass.\n` +
        `  Most likely the harness dev server is not running: npm run dev:web`,
    );
    process.exit(1);
  }
  if (checked - ok > 0 || labelDrift.length > 0) process.exit(1);
  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
