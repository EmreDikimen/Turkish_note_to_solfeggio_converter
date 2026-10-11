/**
 * The server's Donut port against training's own image processor — byte for byte.
 *
 * `apps/server/src/donut.ts` turns a slicer crop into the model's 409×583 input for the page
 * endpoint (`POST /page`). It is a second resampler, so it is held to the bar the browser's canvas
 * never met: IDENTICAL bytes to `DonutImageProcessor` (resize + thumbnail + pad, before rescale) on
 * every strip sampled. `scripts/donut_ref.py` writes the Python side.
 *
 *   npx tsx tools/vision/parity/donut-parity.ts [--pages 200] [--per-page 3]
 *
 * Sample: real strips from `data/real/strips_v2` (every page dir in name order, stepping to reach
 * `--pages`), the first, a middle and the last strip of each, plus the same count of synthetic
 * strips from `data/synthetic/strips_v7_final` when it is on disk.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { donutPreprocess, type Plane } from "../../../apps/server/src/donut";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const arg = (name: string, dflt: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
};
const PAGES = arg("pages", 200);
const PER_PAGE = arg("per-page", 3);
const W = 409;
const H = 583;

function pickReal(): string[] {
  const root = path.join(ROOT, "data/real/strips_v2");
  if (!existsSync(root)) throw new Error(`no ${root} — this check needs the corpus on this machine`);
  const dirs = readdirSync(root).sort();
  const step = Math.max(1, Math.floor(dirs.length / PAGES));
  const out: string[] = [];
  for (let i = 0; i < dirs.length && out.length < PAGES * PER_PAGE; i += step) {
    const d = path.join(root, dirs[i]!);
    const strips = readdirSync(d).filter((f) => /_s\d+_w\d+\.png$/.test(f)).sort();
    if (!strips.length) continue;
    const picks = new Set([0, Math.floor(strips.length / 2), strips.length - 1].slice(0, PER_PAGE));
    for (const k of picks) out.push(path.join(d, strips[k]!));
  }
  return out;
}

function pickSynthetic(n: number): string[] {
  const root = path.join(ROOT, "data/synthetic/strips_v7_final");
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (files.length >= n * 50) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".png")) files.push(p);
    }
  };
  walk(root);
  files.sort();
  const step = Math.max(1, Math.floor(files.length / n));
  return files.filter((_, i) => i % step === 0).slice(0, n);
}

function readGray(file: string): Plane {
  const png = PNG.sync.read(readFileSync(file));
  const data = new Uint8Array(png.width * png.height);
  for (let i = 0; i < data.length; i++) data[i] = png.data[i * 4]!;
  return { data, width: png.width, height: png.height };
}

const real = pickReal();
const synth = pickSynthetic(real.length);
const all = [...real, ...synth];
const work = mkdtempSync(path.join(tmpdir(), "donut-parity-"));
writeFileSync(path.join(work, "list.txt"), all.join("\n"));
execFileSync(
  path.join(ROOT, ".venv-ml/bin/python"),
  ["scripts/donut_ref.py", "--list", path.join(work, "list.txt"), "--out", path.join(work, "ref")],
  { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] }
);

let same = 0;
let worstDiff = 0;
let worstFile = "";
const bad: string[] = [];
for (const [i, file] of all.entries()) {
  const ref = readGray(path.join(work, "ref", `${String(i).padStart(5, "0")}.png`));
  const rgba = donutPreprocess(readGray(file), W, H);
  let nDiff = 0;
  let maxD = 0;
  for (let p = 0; p < W * H; p++) {
    const d = Math.abs(rgba[p * 4]! - ref.data[p]!);
    if (d) nDiff++;
    if (d > maxD) maxD = d;
  }
  if (nDiff === 0) same++;
  else bad.push(`${path.relative(ROOT, file)}: ${nDiff} px differ, max ${maxD}`);
  if (maxD > worstDiff) [worstDiff, worstFile] = [maxD, file];
}

console.log(`real ${real.length} + synthetic ${synth.length} strips`);
console.log(`identical: ${same}/${all.length}`);
if (bad.length) {
  console.log(bad.slice(0, 15).join("\n"));
  console.log(`worst |Δ| ${worstDiff} on ${path.relative(ROOT, worstFile)}`);
  process.exit(1);
}
console.log("✓ the server's Donut port is byte-identical to DonutImageProcessor on every strip");
