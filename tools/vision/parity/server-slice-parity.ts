/**
 * The decode server's page path (`POST /page`) against Python's slicer — crop by crop.
 *
 * `/page` runs the browser's TypeScript slicer in Node (`apps/server/src/slicePage.ts`) behind a
 * new image reader (`apps/server/src/image.ts`: pngjs/jpeg-js instead of the browser's decoder).
 * The slicer port itself was proven in the browser (`parity:slicer`); what this checks is that it
 * survives the move — same staves, same strips, same pixels — and what slicing costs on a server.
 *
 *   npx tsx tools/vision/parity/server-slice-parity.ts [--pages 30]
 *
 * Pages: a deterministic spread over `data/real/images`. Control: `page_to_strips` itself, via
 * `scripts/server_slice_ref.py`. Expected residue: the two image decoders differ by ±1 grey on some
 * pixels of a colour page or a JPEG (docs/METRICS-SLICER.md), so a crop may differ by ±1 in places
 * without any strip moving; counts and names must match exactly.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { readPageImage } from "../../../apps/server/src/image";
import { ensureCv } from "../../../apps/server/src/slicePage";
import { cropStrip, sliceStage3, stripName } from "../../../apps/web/src/omr/slicer/slicer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const i = process.argv.indexOf("--pages");
const N = i >= 0 ? Number(process.argv[i + 1]) : 30;

function listPages(): string[] {
  const root = path.join(ROOT, "data/real/images");
  if (!existsSync(root)) throw new Error(`no ${root} — this check needs the corpus on this machine`);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d).sort()) {
      const p = path.join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(png|jpe?g)$/i.test(e)) out.push(p);
    }
  };
  walk(root);
  const stride = out.length / N;
  return N >= out.length ? out : Array.from({ length: N }, (_, k) => out[Math.floor(k * stride)]!);
}

async function main(): Promise<void> {
  const pages = listPages();
  const work = mkdtempSync(path.join(tmpdir(), "server-slice-"));
  writeFileSync(path.join(work, "pages.txt"), pages.join("\n"));
  execFileSync(
    path.join(ROOT, ".venv-ml/bin/python"),
    ["scripts/server_slice_ref.py", "--list", path.join(work, "pages.txt"), "--out", path.join(work, "py")],
    { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] }
  );

  await ensureCv();
  let pagesSameCount = 0;
  let stripsTotal = 0;
  let stripsIdentical = 0;
  let stripsPm1 = 0;
  let sliceMsTotal = 0;
  const problems: string[] = [];

  for (const [k, file] of pages.entries()) {
    const stem = path.basename(file).replace(/\.[^.]+$/, "");
    const pyDir = path.join(work, "py", String(k).padStart(4, "0"));
    const pyStrips = readdirSync(pyDir).filter((f) => /_s\d+_w\d+\.png$/.test(f)).sort();

    const t0 = performance.now();
    const gray = readPageImage(readFileSync(file), 1e9);
    const res = sliceStage3(gray);
    sliceMsTotal += performance.now() - t0;

    const mine = new Map<string, { data: Uint8Array; width: number; height: number }>();
    for (const r of res.rows)
      for (const s of r.strips) mine.set(stripName(stem, s.system, s.window), cropStrip(r.normalized.row, s));

    if (mine.size === pyStrips.length && pyStrips.every((n) => mine.has(n))) pagesSameCount++;
    else problems.push(`${stem}: python ${pyStrips.length} strips, server ${mine.size}`);

    for (const n of pyStrips) {
      const m = mine.get(n);
      if (!m) continue;
      stripsTotal++;
      const png = PNG.sync.read(readFileSync(path.join(pyDir, n)));
      if (png.width !== m.width || png.height !== m.height) {
        problems.push(`${n}: size ${png.width}×${png.height} vs ${m.width}×${m.height}`);
        continue;
      }
      let maxD = 0;
      for (let p = 0; p < m.data.length; p++) maxD = Math.max(maxD, Math.abs(png.data[p * 4]! - m.data[p]!));
      if (maxD === 0) stripsIdentical++;
      else if (maxD === 1) stripsPm1++;
      else problems.push(`${n}: max |Δ| ${maxD}`);
    }
  }

  console.log(`pages ${pages.length}: same strips (count + names) on ${pagesSameCount}`);
  console.log(`strips ${stripsTotal}: identical ${stripsIdentical}, ±1 only ${stripsPm1}`);
  console.log(`server slicing: ${(sliceMsTotal / pages.length / 1000).toFixed(1)} s per page (this Mac, 1 thread)`);
  if (problems.length) {
    // one line per page: how many strips differ beyond ±1, by how much, and how many changed size
    const byPage = new Map<string, { n: number; maxD: number; size: number }>();
    for (const line of problems) {
      const m = /^(.*?)(?:_s\d+_w\d+\.png)?: (?:max \|Δ\| (\d+)|(size)|(python))/.exec(line);
      const key = m?.[1] ?? line;
      const e = byPage.get(key) ?? { n: 0, maxD: 0, size: 0 };
      e.n++;
      if (m?.[2]) e.maxD = Math.max(e.maxD, Number(m[2]));
      if (m?.[3]) e.size++;
      byPage.set(key, e);
    }
    for (const [k, e] of byPage) console.log(`  ${k}: ${e.n} strip(s), max |Δ| ${e.maxD}, ${e.size} size change(s)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
