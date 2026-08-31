/**
 * Rung-2 batch strip renderer (Playwright). Drives the running web harness BY URL — one
 * `page.goto` per (piece × transpose × mode) render job — crops each training strip out of the
 * real full-score render, and writes image+label pairs plus a manifest.
 *
 * Job derivation is fully deterministic from `data/pieces.json` (written by
 * scripts/select_pieces.py; scores exported by scripts/export_scores.py):
 *   - lyrics drawn ⟺ transpose 0 and the piece has lyrics (≈ a third of renders);
 *   - repeat signs injected on a seeded ~50% of renders (seed = hash("slug:t"));
 *   - navigation marks (segno/coda/D.C./Son) injected on an independent seeded ~50%
 *     (seed = hash("slug:t:nav"));
 *   - distractor text + the low-rate büyük respell always on (seeds hashed the same way).
 * Any strip can be reproduced later by pasting its manifest row's fields into the harness URL —
 * see docs/MANUAL_CHECKS.md.
 *
 * RESUMABLE by design (thermal comfort: safe to Ctrl-C anytime and re-run): each piece's rows go
 * to `<out>/manifests/<slug>.jsonl` with a `<slug>.done` marker on completion; finished pieces
 * are skipped on the next run. `--finalize` (automatic after a full pass) concatenates the shards
 * into `manifest.jsonl` and writes a sampled contact sheet (`index.html`).
 *
 * Prereq: the harness dev server running (`npm run dev:web`).
 * Run:    npx tsx tools/render/render.ts --pieces data/pieces.json --out data/synthetic/strips_v2_2
 *             [--from 0 --to 25]   piece-index chunk: render pieces [from, to)
 *             [--delay 150]        ms pause after each screenshot (gentle on a fanless machine)
 *             [--clean]            wipe the output dir first (default: resume)
 *             [--finalize]         only rebuild manifest.jsonl + index.html from the shards
 *             [--thin-sharps]      draw the AEU sharps at real-print bar weight
 *             [--legacy-tuplet-mark]  the tuplet A/B's CONTROL arm: the pre-2026-08-12 continuous
 *                                  arc with the digit floating above it
 *             [--print-noise]      OPT-IN Round-3 print realism (seeded staff-line weight + usul
 *                                  beam grouping). Off by default — see the constant below
 *             [--staccato-noise]   OPT-IN staccato distractors: label-free dots on the notehead
 *                                  side, teaching that a dot means "longer" only BESIDE the
 *                                  notehead. Off by default — see the constant below
 *             [--usul-barline]     OPT-IN dotted (usul) barlines: a share of PIECES rule the
 *                                  usul's beat groups inside the bar, label-free. Off by default
 *             [--concave-tuplet]   OPT-IN third tuplet shape: a share of pieces draw a CONTINUOUS
 *                                  arc with the "3" inside its concavity, the style the owner found
 *                                  on two real scanned editions. Off by default — see the constant
 *             [--max-measures n]   Round-3 Lever 1: how many measures one strip may span. Absent =>
 *                                  STRIP_BUDGET.maxMeasures, i.e. the corpus recipe. See below
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { decodePretty } from "./decode";
import { hashStr, mulberry32 } from "./rng";

const URL = process.env.OMR_URL ?? "http://localhost:5173";
const SCALE = 3; // deviceScaleFactor — crisp beams; the model resizes to ~583×409 downstream

interface Strip {
  id: string;
  fromMeasure: number;
  toMeasure: number;
  label: string;
  decoded: string;
  rect: { x: number; y: number; width: number; height: number };
}

interface PieceEntry {
  slug: string;
  file: string; // /scores/<slug>.json under apps/web/public
  makam: string;
  hasLyrics: boolean;
  transposes: number[];
}

interface Job {
  piece: PieceEntry;
  transpose: number;
  mode: "every" | "measure";
  /** Unique per job (for the filename): `c0`,`c1`,… carry passes at t0, or `t+0`/`t-9` every jobs. */
  tag: string;
  /** Conventional printed-signature body for carry mode (?sig=), or null for every mode. */
  sig: string | null;
  lyrics: boolean;
  repseed: number | null;
  navseed: number | null;
  textseed: number;
  respellseed: number;
  slurseed: number;
  /** Round-3 staccato distractors (SheetView's drawStaccatoDot).
   *  `null` unless `--staccato-noise` — see STACCATO_NOISE above. */
  staccatoseed: number | null;
  /** Round-3 dotted (usul) barlines (SheetView's drawUsulBars). `null` unless `--usul-barline`.
   *  ⚠ Seeded per PIECE, never per copy or transpose: an edition either uses the convention or it
   *  does not, so every copy of one piece must make the same choice. */
  usulbarseed: number | null;
  /** Round-3 print realism: seeded staff-line weight + usul beam grouping (SheetView).
   *  `null` unless `--print-noise` — see PRINT_NOISE above. */
  printseed: number | null;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const PIECES_PATH = arg("pieces") ?? "data/pieces.json";
const OUT = arg("out") ?? "data/synthetic/strips_v2_2";
const DELAY = Number(arg("delay") ?? 150);
const FROM = Number(arg("from") ?? 0);
const TO = arg("to") != null ? Number(arg("to")) : Infinity;
// Round-2: draw the four AEU sharps at real-print bar weight instead of Bravura's heavier one,
// which closes the white gaps between the THREE bars of a küçük/büyük mücennep so they decode as
// their 2-bar cousins (see SheetView's drawThinSharps). Opt-in, so an A/B against the current
// corpus stays possible.
const THIN_SHARPS = has("thin-sharps");
// The tuplet A/B (docs/rung3/round3-criteria.md): the CONTROL arm renders the mark as it was drawn
// until 2026-08-12 — one unbroken arc with the digit floating above it. Pixels only; the `\tup3`
// token and every manifest field are identical either way, which is what makes the two arms'
// manifests byte-comparable.
const LEGACY_TUPLET = has("legacy-tuplet-mark");
// The THIRD printed tuplet shape (2026-08-19): a CONTINUOUS arc with the "3" hanging inside its
// concavity, drawn on a share of pieces as a per-piece coin. The owner found it on two real scanned
// editions, refuting this project's own "16 of 16 marks break the arc" reading (docs/rung3/tuplets.md).
// OPT-IN, like --print-noise and --staccato-noise, and for the same reason: it changes a share of
// EVERY piece, so a corpus rendered with it on is not comparable to one rendered with it off. Print
// noise once rode along unconditionally and shipped an unvalidated change into ~40k strips.
const CONCAVE_TUPLET = has("concave-tuplet");
// Round-3 print realism (seeded staff-line weight + usul beam grouping) is OPT-IN as of 2026-08-13.
// It used to ride along unconditionally, which meant any fresh render silently shipped
// USUL_BEAM_GROUPS into ~40k strips — and that change is measured as unvalidated and deliberately
// quarantined (docs/METRICS-DIAGNOSTICS.md). Off ⇒ this render matches the strips_v4 recipe.
const PRINT_NOISE = has("print-noise");
// Round-3 staccato distractors (2026-08-15, owner): the model reads a printed staccato as an
// augmentation dot and lengthens the note. Nothing in 40,826 strips has ever carried an
// articulation, and ADDED_TOKENS has no name for one, so the corpus taught "every dot means
// longer". These label-free dots teach the POSITIONAL rule instead — a dot lengthens only when it
// sits BESIDE the notehead. Opt-in, so probe and control arms are one flag apart.
const STACCATO_NOISE = has("staccato-noise");
// Round-3 dotted (usul) BARLINE (2026-08-30, owner): Turkish editions rule the usul's beat groups
// inside a bar with a light dashed line. The renderer has never drawn one — 0 of 40,826 strips —
// and ADDED_TOKENS has no name for one, so the nearest symbol the model knows is a vertical line
// with dots beside it: a repeat sign. It emits `\repstart`, and the owner has been deleting those
// by hand while labelling batch3 (docs/BACKLOG.md item 5, docs/METRICS-UNSEEN.md).
// ⭐ Same SHAPE as the staccato hole, which is the only Round-3 arm that moved its primary: a hole
// in what the model has been shown responds to being filled; a domain gap does not.
// ⚠ LABEL-FREE, on purpose. Naming it would make every real gold label on disk silently wrong (no
// pool annotates one); unnamed it is consistent with everything we own and costs zero labelling.
// The `\dottedbar` token is a Round-4 question (docs/DECISIONS.md).
// Opt-in for the same reason as the two flags above: it changes a share of every piece.
const USUL_BARLINE = has("usul-barline");
// Round-3 Lever 1 (docs/rung3/levers.md): the crop-geometry pilot's only variable. The renderer packs
// a strip by MEASURES and LABEL TOKENS (`STRIP_BUDGET` in tools/render/lilypond.ts) and has no pixel
// width rail at all — which is why our strips run wider than the real pools' and reach the encoder
// downscaled by half (docs/METRICS-DIAGNOSTICS.md, "The encoder's input box").
//
// ⚠ Do NOT read this as "the constant the slicer shares". It does not: the slicer cuts real pages at
// MEASURES_PER_STRIP = 3 / MAX_STRIP_W = 1450 px, a separate pair with its own env knobs. Narrowing
// only this narrows the SYNTHETIC side, and a pilot that does that alone measures a corpus that no
// longer matches what the model will be asked to read. The matching re-slice is the other half.
//
// Absent → undefined → App.tsx passes no override → STRIP_BUDGET applies, so every pre-2026-08-17
// render command reproduces exactly what it did before.
const MAX_MEASURES = arg("max-measures") != null ? Number(arg("max-measures")) : null;
if (MAX_MEASURES != null && (!Number.isInteger(MAX_MEASURES) || MAX_MEASURES < 1)) {
  // A typo here would silently render a whole arm at the default budget and read as a normal run —
  // the same failure shape as rendering from the stale pieces.json.
  console.error(`--max-measures must be a positive integer, got ${arg("max-measures")}`);
  process.exit(1);
}

// Conventional PRINTED key signatures per makam (data/makam_signatures.json, built by
// scripts/build_makam_signatures.py from the adjudication-confirmed real-page labels). Carry-mode
// renders wear the makam's real printed signature (not SymbTr's content-derived one): we sample a
// variant per pass (seeded, weighted by real frequency) and hand its body string to the harness as
// ?sig=, which feeds BOTH the drawn glyphs and the label (faithful scheme).
const SIG_TABLE: Record<string, { variants: { sig: string; weight: number }[] }> = JSON.parse(
  readFileSync(arg("sigs") ?? "data/makam_signatures.json", "utf8"),
);
const normMakam = (m: string) => m.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Seeded weighted pick of a makam's printed-signature variant → its drawn-order body string. */
function pickSignature(makam: string, seed: number): string | null {
  const entry = SIG_TABLE[normMakam(makam)];
  if (!entry?.variants.length) return null;
  const r = mulberry32(seed)();
  let acc = 0;
  for (const v of entry.variants) {
    acc += v.weight;
    if (r <= acc) return v.sig;
  }
  return entry.variants[entry.variants.length - 1]!.sig;
}
// Carry (measure) mode is the DOMINANT, signature-bearing share — rendered at written pitch (t0)
// only so the conventional signature matches the notation, and bulked to dominance via this many
// seeded augmentation passes per piece (blur/text/repeat/nav + signature-variant variety).
const CARRY_PASSES = Number(arg("carry-passes") ?? 4);

/**
 * The deterministic render jobs for one piece. Carry-dominant matrix (Round-1 re-render):
 *  - CARRY_PASSES × carry ("measure") renders at written pitch (t0), each a seeded augmentation
 *    pass wearing a sampled conventional makam signature — the DOMINANT, signature-bearing share
 *    that mirrors real printed pages;
 *  - one "every" render per NON-zero transpose — the minority share carrying the pitch augmentation
 *    (no signature, so transposing is always faithful; t0's written pitch is covered by carry).
 * keysig mode is retired (real pages use the carry convention).
 */
function jobsFor(piece: PieceEntry): Job[] {
  const jobs: Job[] = [];
  for (let p = 0; p < CARRY_PASSES; p++) {
    const repseed = hashStr(`${piece.slug}:c${p}`);
    const navseed = hashStr(`${piece.slug}:c${p}:nav`);
    jobs.push({
      piece,
      transpose: 0,
      mode: "measure",
      tag: `c${p}`,
      sig: pickSignature(piece.makam, hashStr(`${piece.slug}:c${p}:sig`)),
      lyrics: p === 0 && piece.hasLyrics, // one seeded pass carries lyrics, the rest don't
      repseed: mulberry32(repseed)() < 0.5 ? repseed : null, // seeded coin: ~half get repeats
      navseed: mulberry32(navseed)() < 0.7 ? navseed : null, // ~70% get nav marks (audit density)
      textseed: hashStr(`${piece.slug}:c${p}:text`),
      respellseed: hashStr(`${piece.slug}:c${p}:respell`),
      slurseed: hashStr(`${piece.slug}:c${p}:slur`),
      staccatoseed: STACCATO_NOISE ? hashStr(`${piece.slug}:c${p}:staccato`) : null,
      usulbarseed: USUL_BARLINE ? hashStr(`${piece.slug}:usulbar`) : null,
      printseed: PRINT_NOISE ? hashStr(`${piece.slug}:c${p}:print`) : null,
    });
  }
  for (const t of piece.transposes) {
    if (t === 0) continue; // t0 is the carry share; every mode is the transpose augmentation
    const repseed = hashStr(`${piece.slug}:${t}`);
    const navseed = hashStr(`${piece.slug}:${t}:nav`);
    jobs.push({
      piece,
      transpose: t,
      mode: "every",
      tag: `t${t >= 0 ? "+" : ""}${t}`,
      sig: null, // every mode draws no signature
      lyrics: false, // lyrics only on the written-pitch (t0) staff
      repseed: mulberry32(repseed)() < 0.5 ? repseed : null,
      navseed: mulberry32(navseed)() < 0.7 ? navseed : null,
      textseed: hashStr(`${piece.slug}:${t}:text`),
      respellseed: hashStr(`${piece.slug}:${t}:respell`),
      slurseed: hashStr(`${piece.slug}:${t}:slur`),
      staccatoseed: STACCATO_NOISE ? hashStr(`${piece.slug}:${t}:staccato`) : null,
      usulbarseed: USUL_BARLINE ? hashStr(`${piece.slug}:usulbar`) : null,
      printseed: PRINT_NOISE ? hashStr(`${piece.slug}:${t}:print`) : null,
    });
  }
  return jobs;
}

function jobUrl(job: Job): string {
  const q = new URLSearchParams({
    score: job.piece.file,
    mode: job.mode,
    lyrics: job.lyrics ? "1" : "0",
    transpose: String(job.transpose),
    textseed: String(job.textseed),
    respellseed: String(job.respellseed),
    slurseed: String(job.slurseed),
  });
  if (job.sig) q.set("sig", job.sig);
  if (job.repseed != null) q.set("repseed", String(job.repseed));
  if (job.navseed != null) q.set("navseed", String(job.navseed));
  if (job.staccatoseed != null) q.set("staccatoseed", String(job.staccatoseed));
  if (job.usulbarseed != null) q.set("usulbarseed", String(job.usulbarseed));
  if (job.printseed != null) q.set("printseed", String(job.printseed));
  if (THIN_SHARPS) q.set("thinsharps", "1");
  if (LEGACY_TUPLET) q.set("legacytuplet", "1");
  if (CONCAVE_TUPLET) q.set("concavetuplet", "1");
  if (MAX_MEASURES != null) q.set("maxmeasures", String(MAX_MEASURES));
  return `${URL}/?${q}`;
}

/** Navigate to a job and wait until the harness reports the APPLIED config matches it (the
 *  `applied` flag means the engraved layout — and thus the crop rects — belongs to this exact
 *  configuration; no fixed-sleep races). */
async function openJob(page: Page, job: Job): Promise<Strip[]> {
  await page.goto(jobUrl(job), { waitUntil: "networkidle" });
  await page.waitForFunction(
    (want) => {
      const w = window as any;
      const c = w.__omrConfig;
      // `applied` alone is sufficient: strips are published in the same React effect as the
      // config, and a job CAN legitimately have zero strips (e.g. keysig mode when every
      // row-start chunk exceeds the token budget) — requiring length > 0 would hang forever.
      return (
        c && c.applied && c.score === want.score && c.mode === want.mode &&
        c.lyrics === want.lyrics && c.transpose === want.transpose && c.sig === want.sig &&
        c.repseed === want.repseed && c.navseed === want.navseed &&
        c.textseed === want.textseed && c.respellseed === want.respellseed &&
        c.slurseed === want.slurseed && c.staccatoseed === want.staccatoseed &&
        c.usulbarseed === want.usulbarseed &&
        c.printseed === want.printseed &&
        // Which tuplet mark the page drew. Checked per job rather than once, because a wrong arm is
        // invisible in the labels and would only surface as a corpus that fails to reproduce.
        c.legacyTuplet === want.legacyTuplet &&
        // The strip-packing rail. Asserted per job for the same reason as the tuplet arm: a wrong
        // geometry is invisible in a label and would surface only as a pilot arm that cannot be
        // attributed. Cheap insurance against the whole point of the run being lost.
        c.maxmeasures === want.maxmeasures
      );
    },
    {
      score: job.piece.file, mode: job.mode, lyrics: job.lyrics, transpose: job.transpose, sig: job.sig,
      repseed: job.repseed, navseed: job.navseed, textseed: job.textseed, respellseed: job.respellseed,
      slurseed: job.slurseed, staccatoseed: job.staccatoseed, usulbarseed: job.usulbarseed,
      printseed: job.printseed,
      legacyTuplet: LEGACY_TUPLET, maxmeasures: MAX_MEASURES,
    },
    { timeout: 20000 },
  );
  return (await page.evaluate(() => (window as any).__omrStrips as Strip[])) ?? [];
}

async function renderPiece(page: Page, piece: PieceEntry, shardPath: string): Promise<number> {
  let count = 0;
  for (const job of jobsFor(piece)) {
    const strips = await openJob(page, job);

    const svg = page.locator('[data-omr="sheet-svg"]');
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await svg.boundingBox();
    if (!box) continue;
    // Grow the viewport so every row sits on-screen from the top (clip screenshots must be within it).
    await page.setViewportSize({ width: 1200, height: Math.ceil(box.y + box.height + 80) });
    await page.evaluate(() => window.scrollTo(0, 0));
    const box2 = (await svg.boundingBox())!;

    for (const s of strips) {
      const name = `${piece.slug}_${job.tag}_${job.mode}_${s.id}`;
      const clip = { x: box2.x + s.rect.x, y: box2.y + s.rect.y, width: s.rect.width, height: s.rect.height };
      try {
        await page.screenshot({ path: `${OUT}/${name}.png`, clip });
      } catch (e) {
        console.warn(`  skip ${name}: clip`, clip, String(e).split("\n")[0]);
        continue;
      }
      writeFileSync(`${OUT}/${name}.txt`, s.label + "\n");
      appendFileSync(shardPath, JSON.stringify({
        image: `${name}.png`, label: s.label, mode: job.mode, makam: piece.makam, sig: job.sig,
        piece: piece.slug, transpose: job.transpose, lyrics: job.lyrics,
        repseed: job.repseed, navseed: job.navseed, textseed: job.textseed, respellseed: job.respellseed,
        // staccatoseed and usulbarseed are deliberately NOT recorded here, the way legacyTuplet
        // is not: they are arm markers, and keeping them out is what makes the two arms' manifests
        // byte-identical and therefore diffable as a proof that the ink is pixels-only.
        slurseed: job.slurseed, printseed: job.printseed,
        from: s.fromMeasure, to: s.toMeasure,
      }) + "\n");
      count++;
      if (DELAY > 0) await page.waitForTimeout(DELAY);
    }
  }
  return count;
}

function finalize() {
  const shardDir = `${OUT}/manifests`;
  const shards = existsSync(shardDir)
    ? readdirSync(shardDir).filter((f) => f.endsWith(".jsonl")).sort()
    : [];
  const rows: string[] = [];
  for (const f of shards) {
    // Only .done pieces go into the final manifest — a mid-piece interrupt leaves a partial
    // shard, which the next run deletes and re-renders anyway.
    if (!existsSync(`${shardDir}/${f.replace(/\.jsonl$/, ".done")}`)) continue;
    for (const line of readFileSync(`${shardDir}/${f}`, "utf8").split("\n")) {
      if (line.trim()) rows.push(line);
    }
  }
  writeFileSync(`${OUT}/manifest.jsonl`, rows.join("\n") + (rows.length ? "\n" : ""));

  // Contact sheet over a seeded random sample (a 30k-image page would never open).
  const rand = mulberry32(7);
  const sample = [...rows].map((r) => [rand(), r] as const).sort((a, b) => a[0] - b[0]).slice(0, 500).map(([, r]) => JSON.parse(r));
  const items = sample.map((m) =>
    `<figure><img src="${m.image}" loading="lazy"><figcaption><b>${m.image}</b><br><code>${escapeHtml(m.label)}</code>` +
      `<br><span class="dec">${escapeHtml(decodePretty(m.label))}</span></figcaption></figure>`,
  );
  writeFileSync(`${OUT}/index.html`, contactSheet(items));
  console.log(`finalize: ${rows.length} strips from ${shards.length} shards -> ${OUT}/manifest.jsonl (+ ${sample.length}-strip contact sheet)`);
}

async function main() {
  if (has("clean")) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(`${OUT}/manifests`, { recursive: true });
  if (has("finalize")) {
    finalize();
    return;
  }

  // Provenance for the corpus on disk: which flags made it. Deliberately NOT a manifest field — the
  // tuplet A/B's two arms must have byte-identical manifests, since the mark is pixels only
  // (docs/rung3/round3-criteria.md).
  writeFileSync(`${OUT}/render_config.json`, JSON.stringify({
    pieces: PIECES_PATH, carryPasses: CARRY_PASSES, thinSharps: THIN_SHARPS,
    legacyTupletMark: LEGACY_TUPLET, printNoise: PRINT_NOISE, staccatoNoise: STACCATO_NOISE,
    concaveTuplet: CONCAVE_TUPLET, usulBarline: USUL_BARLINE, maxMeasures: MAX_MEASURES,
    started: new Date().toISOString(),
  }, null, 2) + "\n");

  const pieces: PieceEntry[] = JSON.parse(readFileSync(PIECES_PATH, "utf8")).pieces;
  const chunk = pieces.slice(FROM, TO === Infinity ? undefined : TO);
  console.log(`${pieces.length} pieces in ${PIECES_PATH}; rendering [${FROM}, ${TO === Infinity ? pieces.length : TO}) = ${chunk.length} pieces (delay ${DELAY} ms)`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: SCALE, viewport: { width: 1200, height: 1600 } });
  const page = await ctx.newPage();

  let done = 0;
  for (const piece of chunk) {
    const shard = `${OUT}/manifests/${piece.slug}.jsonl`;
    const marker = `${OUT}/manifests/${piece.slug}.done`;
    if (existsSync(marker)) {
      done++;
      continue;
    }
    rmSync(shard, { force: true }); // an interrupted run leaves a partial shard — start it over
    const t0 = Date.now();
    const n = await renderPiece(page, piece, shard);
    writeFileSync(marker, new Date().toISOString() + "\n");
    done++;
    console.log(`[${done}/${chunk.length}] ${piece.slug}: ${n} strips (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await browser.close();

  // After a full pass over ALL pieces, rebuild the combined manifest + contact sheet.
  const allDone = pieces.every((p) => existsSync(`${OUT}/manifests/${p.slug}.done`));
  if (allDone) finalize();
  else console.log(`chunk finished (${done}/${chunk.length}); run remaining chunks, or --finalize to combine what's done`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function contactSheet(items: string[]): string {
  return `<!doctype html><meta charset="utf-8"><title>OMR strips (sample)</title>
<style>
  body{font-family:system-ui;margin:16px;background:#f5f5f5}
  figure{display:inline-block;margin:0 12px 16px 0;vertical-align:top;background:#fff;border:1px solid #ddd;border-radius:6px;padding:8px}
  img{display:block;background:#fff;border:1px solid #eee;max-width:560px}
  figcaption{font-size:12px;margin-top:6px;max-width:560px}
  .dec{color:#555}
</style>
<h2>Synthetic strips — random 500-strip sample (image vs. label vs. decoded)</h2>
${items.join("\n")}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
