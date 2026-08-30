/**
 * Build a standalone HTML fingering chart for the sol klarnet, so a player can audit the whole
 * table by eye (feature F3).
 *
 * What/why: `clarinet-test.ts` can prove the table is *self-consistent* — ascending, on the ladder,
 * every gap inside one lip — and cannot prove it is *right*. Only somebody who plays the instrument
 * can say that, and they can only say it if they can see all thirty-three fingerings at once. Two
 * errors have already been caught this way and by no other means: a whole table transcribed from
 * the wrong key system, and the La key drawn in the wrong place.
 *
 * The page is self-contained — the photograph is inlined as a data URI — so it can be opened from
 * anywhere, mailed, or kept beside the instrument.
 *
 * ⚠ It draws from `CLARINET_FINGERINGS` and `clarinetArt.ts`, never from its own copy of anything,
 * so it cannot drift from what the app shows. If the chart is wrong, the app is wrong.
 *
 * Run: npx --yes tsx tools/core/clarinet-chart.ts [out.html]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { CLARINET_FINGERINGS, LIP_REACH_KOMA, type ClarinetKeyId } from "@turkish-omr/core";
import { HOLES, IMAGE, KEYS, BACK_INSET, MARKERS } from "../../apps/web/src/ui/clarinetArt";

const out = process.argv[2] ?? "clarinet-chart.html";

const png = readFileSync(`apps/web/public/${IMAGE.src}`).toString("base64");

/** Which register a fingering belongs to, for grouping. */
function band(koma: number, clarion: boolean): string {
  // ⚠ Order matters: the altissimo sits above the clarion in pitch but is NOT clarion, so it has to
  // be tested first or every one of its rows would fall into the wrong group.
  if (koma > 371) return "İnce sesler (altissimo) — kendi parmakları var, alttakilerin oktavı değil";
  if (clarion) return "Klarnet (üst) register — register tuşu basılı";
  if (koma >= 292) return "Boğaz sesleri — neredeyse hiçbir delik kapalı değil";
  return "Kalın register (chalumeau) — register tuşu basılı değil";
}

/** One instrument picture with a fingering shown on it. */
function figure(keys: readonly ClarinetKeyId[]): string {
  const down = new Set(keys);
  const marks = MARKERS.map((m) => {
    const lit = down.has(m.id);
    const cls = `mk${lit ? " on" : ""}`;
    return `<circle class="${cls}" cx="${m.cx}" cy="${m.cy}" r="${m.r}"><title>${m.id}</title></circle>`;
  }).join("");
  const stem = `<line class="stem" x1="${BACK_INSET[0]!.cx}" y1="${BACK_INSET[0]!.cy - 24}" x2="${BACK_INSET[1]!.cx}" y2="${BACK_INSET[1]!.cy + 24}"/>`;
  const back = `<text class="back" x="${BACK_INSET[1]!.cx}" y="${BACK_INSET[1]!.cy + 50}" text-anchor="middle">arka</text>`;
  // ⚠ Cropped to the marked part of the instrument, not the whole thing. The bell carries no
  // fingering and, drawn at 1:6.4, it pushed the note name off the bottom of every card — which is
  // the one thing this page exists to show.
  const top = -18;
  const bottom = Math.max(...MARKERS.map((m) => m.cy + m.r)) + 26;
  return `<svg viewBox="-100 ${top} ${IMAGE.w + 112} ${bottom - top}"><use href="#clar"/>${stem}${back}${marks}</svg>`;
}

const rows = [...CLARINET_FINGERINGS].sort((a, b) => a.koma - b.koma);

let cards = "";
let last = "";
for (const f of rows) {
  const b = band(f.koma, f.clarion);
  if (b !== last) {
    cards += `</section><h2>${b}</h2><section class="grid">`;
    last = b;
  }
  const names = [...f.keys].sort().join(" · ") || "—";
  cards += `<figure>
      ${figure(f.keys)}
      <figcaption>
        <b>${f.label}</b>
        <small>koma ${f.koma}</small>
        ${f.fingeredAs ? `<small class="via">${f.clarion ? `${f.fingeredAs} parmağı + register` : `${f.fingeredAs} ile aynı parmak — dudak daha sert`}</small>` : ""}
        <code>${names}</code>
      </figcaption>
    </figure>`;
}
cards += "</section>";

const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sol klarnet — parmak tablosu</title>
<style>
  :root { color-scheme: light dark; --bg:#fbfaf8; --fg:#1a1a1c; --mut:#6b6b70; --line:#e2ded7; --card:#fff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#17171a; --fg:#eceae6; --mut:#9a9aa2; --line:#2e2e34; --card:#1f1f24; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; padding:28px 22px 60px; }
  h1 { font-size:26px; margin:0 0 6px; }
  .lede { color:var(--mut); max-width:62ch; margin:0 0 4px; }
  h2 { font-size:15px; font-weight:650; letter-spacing:.01em; margin:34px 0 12px;
       padding-bottom:7px; border-bottom:1px solid var(--line); color:var(--mut); }
  .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(132px,1fr)); }
  figure { margin:0; background:var(--card); border:1px solid var(--line); border-radius:10px;
           padding:10px 8px 8px; display:flex; flex-direction:column; align-items:center; }
  figure svg { width:100%; height:250px; display:block; }
  figcaption { text-align:center; margin-top:6px; display:flex; flex-direction:column; gap:2px; width:100%; }
  figcaption b { font-size:19px; }
  figcaption small { color:var(--mut); font-size:12px; }
  .via { font-style:italic; }
  code { font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--mut);
         word-break:break-word; margin-top:3px; }
  .mk { fill:none; stroke:rgba(120,120,130,.75); stroke-width:2.5; }
  .mk.eye { stroke-dasharray:4 3; }
  .mk.on { fill:#e8483f; stroke:#7d1d18; stroke-dasharray:none; }
  .stem { stroke:rgba(120,120,130,.5); stroke-width:1.5; stroke-dasharray:4 4; }
  .back { fill:var(--mut); font-size:22px; }
  .key { display:flex; flex-wrap:wrap; gap:16px; margin:14px 0 0; padding:12px 14px;
         border:1px solid var(--line); border-radius:10px; background:var(--card); font-size:13px; }
  .key span { display:flex; align-items:center; gap:7px; }
  .sw { width:15px; height:15px; border-radius:50%; flex:none; }
  .warn { border-left:3px solid #e8a33f; padding:10px 14px; margin:16px 0 0; background:var(--card);
          border-radius:0 8px 8px 0; max-width:78ch; font-size:14px; }
</style></head>
<body>
<h1>Sol klarnet — parmak tablosu</h1>
<p class="lede">Uygulamanın kullandığı tablonun tamamı, ${rows.length} parmak pozisyonu. Kalın yazı,
o parmakla çıkan sestir — sayfada okuduğunuz nota. Kırmızı olan delik ve tuşlar basılacak olanlardır.</p>

<div class="key">
  <span><i class="sw" style="background:#e8483f"></i> basılı</span>
  <span><i class="sw" style="border:2.5px solid rgba(120,120,130,.75)"></i> açık</span>
  <span>“arka” = enstrümanın arkası: baş parmak deliği ve register tuşu</span>
</div>

<div class="warn"><b>Bu tablo sizin:</b> tuşların yerlerini 30.08.2026'da kendiniz yerleştirdiniz;
altı ses deliğinin yeri ise fotoğraf üzerinden ölçüldü. Notaların kendisi Oehler/Albert parmak
tablosundan gelir. Kalın register
sesleri ile register tuşlu (ince) sesler arasında <b>on ikili</b> fark vardır, sekizli değil.
Bir koma = 22,6 sent; dudak en fazla ${LIP_REACH_KOMA} koma aşağı iner.</div>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <image id="clar" x="0" y="0" width="${IMAGE.w}" height="${IMAGE.h}" href="data:image/png;base64,${png}"/>
</defs></svg>

<section class="grid">${cards}
</body></html>`;

writeFileSync(out, html);
console.log(
  `wrote ${out} — ${rows.length} fingerings, ${HOLES.length} measured holes, ` +
    `${KEYS.length + BACK_INSET.length} by eye, ${(html.length / 1024 / 1024).toFixed(2)} MB`,
);
