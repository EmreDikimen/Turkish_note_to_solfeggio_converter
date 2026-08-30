/**
 * Does keeping the repeat signs on the page change what the app PLAYS? (2026-08-30)
 *
 * The app used to expand every repeat the model read: `‖: … :‖` was thrown away and the music
 * inside it was written out twice. Now the score is kept as the page prints it and the repeat is
 * taken at playback time (`ScoreStructure.playBars` → core's `unfoldDoc`). That is only safe if
 * unfolding the written score reproduces the old flattened document EXACTLY — same events, same
 * order, same durations. This check proves it on real decodes rather than on hand-written streams
 * (`tools/render/stitch-test.ts` does those): every cached page decode in `data/real/strips_v2` is
 * stitched both ways and compared note for note.
 *
 * It also reports how much shorter the page gets, which is the whole point of the feature.
 *
 * ⚠ The cached decodes are only the INPUT here — this compares two stitchers, not two models, so
 * a stale cache cannot make it lie (nothing is re-cut and no geometry is read).
 *
 * Run: npx --yes tsx tools/render/fold-check.ts [--dir data/real/strips_v2]
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { groupMeasures, unfoldDoc } from "@turkish-omr/core";
import { stitchStrips, type DecodedStrip } from "./stitch";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

const DIR = resolve(ROOT, arg("--dir", "data/real/strips_v2"));
if (!existsSync(DIR)) {
  console.error(`no such directory: ${DIR}`);
  process.exit(2);
}

let pages = 0;
let foldedPages = 0;
let writtenBars = 0;
let playedBars = 0;
let changed = 0;

for (const d of readdirSync(DIR).sort()) {
  const f = join(DIR, d, `${d}_decode.json`);
  if (!existsSync(f)) continue;
  const raw = JSON.parse(readFileSync(f, "utf8")) as { strips?: DecodedStrip[] };
  const strips = raw.strips ?? (raw as unknown as DecodedStrip[]);
  if (!Array.isArray(strips) || strips.length === 0) continue;

  const written = stitchStrips(strips, { accidentals: "carry", expand: false });
  const flat = stitchStrips(strips, { accidentals: "carry" });
  const unfolded = unfoldDoc(written.doc, written.structure.playBars).doc;

  const same =
    unfolded.events.length === flat.doc.events.length &&
    unfolded.events.every((e, i) => {
      const o = flat.doc.events[i]!;
      return e.kind === o.kind && e.koma53 === o.koma53 && e.durationMs === o.durationMs;
    });

  pages++;
  const bars = groupMeasures(written.doc).length;
  writtenBars += bars;
  playedBars += written.structure.playBars.length;
  if (written.structure.playBars.length !== bars) foldedPages++;
  if (!same) {
    changed++;
    if (changed <= 10) {
      console.log(`  CHANGED ${d}: unfolded ${unfolded.events.length} events vs flattened ${flat.doc.events.length}`);
    }
  }
}

const shorter = playedBars > 0 ? (100 * (1 - writtenBars / playedBars)).toFixed(1) : "0.0";
console.log("");
console.log(`pages read              ${pages}`);
console.log(`pages that fold         ${foldedPages} (${((100 * foldedPages) / Math.max(1, pages)).toFixed(1)}%)`);
console.log(`bars written / played   ${writtenBars} / ${playedBars}  → the page is ${shorter}% shorter`);
console.log(`pages whose SOUND moved ${changed}`);
console.log(changed === 0 ? "\nPASS — folding changed no sound" : `\nFAIL — ${changed} page(s) changed`);
process.exit(changed === 0 ? 0 : 1);
