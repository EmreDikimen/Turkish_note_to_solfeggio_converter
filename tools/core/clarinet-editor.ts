/**
 * Build a standalone HTML editor for the sol klarnet fingering table (feature F3).
 *
 * What/why: the note-by-note fingerings come from a printed Oehler/Albert chart, and the marker
 * POSITIONS on the photo are mostly placed by eye — fifteen of twenty-one. Two errors have already
 * been caught by the owner looking at the picture and by nothing else. This page hands him the pen:
 * for each note he deletes the points that are wrong and clicks where the right ones go, and the
 * page hands back JSON to paste into `clarinet.ts` / `clarinetArt.ts`.
 *
 * ⭐ **Only the nineteen BASE fingerings are editable, and that is deliberate.** The clarion is the
 * same fingerings with the register key added — a fact about a stopped pipe, not a choice — so
 * editing it separately could only introduce a disagreement. Fix a base fingering and its clarion
 * partner follows.
 *
 * ⭐ **Komas are not editable either**, because they are not fingered: the owner's own design says a
 * koma is reached by relaxing the lip from the nearest standard fingering. So the table needs the
 * twelve-per-octave notes and nothing between them.
 *
 * ⚠ The page starts from the CURRENT table and calibration, so what it shows is what the app does.
 * Work in progress is kept in `localStorage`, because this is an audit that takes a while and a
 * reload must not throw it away.
 *
 * Run: npx --yes tsx tools/core/clarinet-editor.ts [out.html]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { BASE_FINGERINGS, type ClarinetKeyId } from "@turkish-omr/core";
import { IMAGE, MARKERS } from "../../apps/web/src/ui/clarinetArt";

const out = process.argv[2] ?? "clarinet-editor.html";
const png = readFileSync(`apps/web/public/${IMAGE.src}`).toString("base64");

/** Every position the calibration knows, as a snap target and a faint ghost. */
const spots = MARKERS.map((m) => ({ id: m.id, x: m.cx, y: m.cy, r: m.r, measured: m.source === "measured" }));
const byId = new Map(spots.map((s) => [s.id, s]));

/** The starting state: one point per key the fingering presses, at that key's calibrated place. */
const notes = BASE_FINGERINGS.map((f) => ({
  note: f.label,
  koma: f.koma,
  points: f.keys
    .map((k: ClarinetKeyId) => byId.get(k))
    .filter(Boolean)
    .map((s) => ({ id: s!.id, x: s!.x, y: s!.y, r: s!.r })),
}));

const DATA = JSON.stringify({ image: { w: IMAGE.w, h: IMAGE.h }, spots, notes });

const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sol klarnet — parmak düzenleyici</title>
<style>
  :root { color-scheme: light dark; --bg:#fbfaf8; --fg:#1a1a1c; --mut:#6b6b70; --line:#e2ded7;
          --card:#fff; --accent:#0f766e; --on:#e8483f; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#17171a; --fg:#eceae6; --mut:#9a9aa2; --line:#2e2e34; --card:#1f1f24; --accent:#2dd4bf; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); padding:20px 18px 40px;
         font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  h1 { font-size:22px; margin:0 0 4px; }
  .lede { color:var(--mut); max-width:74ch; margin:0 0 14px; font-size:14px; }
  .notes { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
  .notes button { font:600 14px/1 inherit; padding:9px 11px; border-radius:8px; cursor:pointer;
                  border:1px solid var(--line); background:var(--card); color:var(--fg); }
  .notes button.sel { background:var(--accent); border-color:var(--accent); color:#fff; }
  .notes button i { font-style:normal; opacity:.6; font-weight:400; font-size:12px; margin-left:5px; }
  .wrap { display:flex; gap:18px; align-items:flex-start; flex-wrap:wrap; }
  .panels { display:flex; gap:10px; background:var(--card); border:1px solid var(--line);
            border-radius:12px; padding:10px; }
  .panels svg { height:min(72vh,720px); width:auto; cursor:crosshair; touch-action:none; }
  .side { flex:1; min-width:280px; max-width:460px; display:flex; flex-direction:column; gap:12px; }
  .box { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .box h3 { margin:0 0 8px; font-size:14px; }
  .box p, .box li { font-size:13.5px; color:var(--mut); margin:0 0 6px; }
  .box ul { margin:0; padding-left:18px; }
  kbd { font:12px ui-monospace,Menlo,monospace; border:1px solid var(--line); border-radius:4px;
        padding:1px 5px; background:var(--bg); }
  .row { display:flex; gap:8px; flex-wrap:wrap; }
  .row button { font:14px inherit; padding:8px 12px; border-radius:8px; cursor:pointer;
                border:1px solid var(--line); background:var(--bg); color:var(--fg); }
  .row button.primary { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:600; }
  textarea { width:100%; height:150px; font:11.5px/1.45 ui-monospace,Menlo,monospace; resize:vertical;
             border:1px solid var(--line); border-radius:8px; padding:9px; background:var(--bg);
             color:var(--fg); }
  .ghost { fill:none; stroke:rgba(130,130,140,.55); stroke-width:2; stroke-dasharray:3 3; }
  .ghost.measured { stroke-dasharray:none; stroke:rgba(130,130,140,.8); }
  .pt { fill:var(--on); stroke:#7d1d18; stroke-width:2; cursor:pointer; }
  .pt:hover { stroke:#000; stroke-width:3.5; }
  .lbl { fill:var(--mut); font-size:15px; }
  .hint { font-size:12.5px; color:var(--mut); }
  .count { font-variant-numeric:tabular-nums; }
</style></head>
<body>
<h1>Sol klarnet — parmak düzenleyici</h1>
<p class="lede">Her nota için noktaları siz koyun. <b>Boş bir yere tıklayın</b> → yeni nokta.
<b>Kırmızı bir noktaya tıklayın</b> → o noktayı siler. Soluk halkalar bilinen delik ve tuş yerleridir;
yakınına tıklarsanız oraya yapışır. Komalar için ayrı parmak yok — onlar dudak gevşeterek çıkıyor,
o yüzden burada sadece tam notalar ve arızalıları var. Register tuşlu (ince) sesler bu tablodan
kendiliğinden türüyor, ayrıca düzenlemeye gerek yok.</p>

<div class="notes" id="notes"></div>

<div class="wrap">
  <div class="panels">
    <svg id="pa" viewBox="-100 -24 350 512"></svg>
    <svg id="pb" viewBox="-100 460 350 400"></svg>
  </div>

  <div class="side">
    <div class="box">
      <h3>Şu an: <span id="cur"></span> <span class="count" id="cnt"></span></h3>
      <div class="row">
        <button id="undo">Geri al</button>
        <button id="reset">Bu notayı sıfırla</button>
        <button id="clear">Bütün noktaları sil</button>
      </div>
      <p class="hint" style="margin-top:8px"><kbd>←</kbd> <kbd>→</kbd> ile notalar arasında gezebilirsiniz.</p>
    </div>

    <div class="box">
      <h3>Bitince</h3>
      <p>Aşağıdaki metni kopyalayıp bana gönderin — tabloyu ona göre düzeltirim.</p>
      <div class="row">
        <button class="primary" id="copy">Kopyala</button>
        <button id="save">Dosyaya indir</button>
      </div>
      <textarea id="outbox" readonly spellcheck="false" style="margin-top:10px"></textarea>
    </div>
  </div>
</div>

<script>
const DATA = ${DATA};
const KEY = "klarnet-parmak-v1";
const IMG = "data:image/png;base64,${png}";

const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } })();
const state = saved && saved.length === DATA.notes.length
  ? saved
  : DATA.notes.map(n => ({ note: n.note, koma: n.koma, points: n.points.map(p => ({ ...p })) }));

let sel = 0;
const undoStack = [];

const $ = id => document.getElementById(id);
const SNAP = 26;   // click within this many image px of a known spot and it snaps there

function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

function svgPoint(svg, ev) {
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX; pt.y = ev.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function nearestSpot(x, y) {
  let best = null, bd = SNAP;
  for (const s of DATA.spots) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function pushUndo() {
  undoStack.push(JSON.stringify(state[sel].points));
  if (undoStack.length > 200) undoStack.shift();
}

function addPoint(x, y) {
  const s = nearestSpot(x, y);
  pushUndo();
  const pts = state[sel].points;
  if (s) {
    if (pts.some(p => p.id === s.id)) return;          // already pressed — nothing to add
    pts.push({ id: s.id, x: s.x, y: s.y, r: s.r });
  } else {
    pts.push({ id: null, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: 13 });
  }
  draw();
}

function removeAt(i) { pushUndo(); state[sel].points.splice(i, 1); draw(); }

function panel(svg, lo, hi) {
  const parts = [\`<image href="\${IMG}" x="0" y="0" width="\${DATA.image.w}" height="\${DATA.image.h}"/>\`];
  for (const s of DATA.spots) {
    if (s.y < lo || s.y > hi) continue;
    parts.push(\`<circle class="ghost\${s.measured ? " measured" : ""}" cx="\${s.x}" cy="\${s.y}" r="\${s.r}"/>\`);
  }
  state[sel].points.forEach((p, i) => {
    if (p.y < lo || p.y > hi) return;
    parts.push(\`<circle class="pt" data-i="\${i}" cx="\${p.x}" cy="\${p.y}" r="\${p.r || 13}"><title>\${p.id || "serbest"} — silmek için tıkla</title></circle>\`);
  });
  if (lo < 0) parts.push('<text class="lbl" x="-46" y="250" text-anchor="middle">arka</text>');
  svg.innerHTML = parts.join("");
}

function draw() {
  panel($("pa"), -1e9, 460);
  panel($("pb"), 460, 1e9);
  $("cur").textContent = state[sel].note;
  $("cnt").textContent = "· " + state[sel].points.length + " nokta";
  [...$("notes").children].forEach((b, i) => {
    b.classList.toggle("sel", i === sel);
    b.querySelector("i").textContent = state[i].points.length;
  });
  $("outbox").value = JSON.stringify(
    state.map(n => ({ note: n.note, koma: n.koma,
      points: n.points.map(p => ({ id: p.id, x: p.x, y: p.y })) })), null, 1);
  persist();
}

for (const svg of [$("pa"), $("pb")]) {
  svg.addEventListener("click", ev => {
    const hit = ev.target.closest(".pt");
    if (hit) { removeAt(+hit.dataset.i); return; }
    const p = svgPoint(svg, ev);
    addPoint(p.x, p.y);
  });
}

state.forEach((n, i) => {
  const b = document.createElement("button");
  b.innerHTML = n.note + ' <i></i>';
  b.onclick = () => { sel = i; undoStack.length = 0; draw(); };
  $("notes").appendChild(b);
});

$("undo").onclick = () => { const u = undoStack.pop(); if (u) { state[sel].points = JSON.parse(u); draw(); } };
$("reset").onclick = () => { pushUndo(); state[sel].points = DATA.notes[sel].points.map(p => ({ ...p })); draw(); };
$("clear").onclick = () => { pushUndo(); state[sel].points = []; draw(); };
$("copy").onclick = async () => {
  try { await navigator.clipboard.writeText($("outbox").value); $("copy").textContent = "Kopyalandı ✓";
        setTimeout(() => ($("copy").textContent = "Kopyala"), 1400); }
  catch { $("outbox").select(); }
};
$("save").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([$("outbox").value], { type: "application/json" }));
  a.download = "klarnet-parmaklar.json"; a.click(); URL.revokeObjectURL(a.href);
};
addEventListener("keydown", e => {
  if (e.key === "ArrowRight") { sel = (sel + 1) % state.length; undoStack.length = 0; draw(); }
  if (e.key === "ArrowLeft") { sel = (sel - 1 + state.length) % state.length; undoStack.length = 0; draw(); }
});

draw();
</script>
</body></html>`;

writeFileSync(out, html);
console.log(
  `wrote ${out} — ${notes.length} editable notes, ${spots.length} snap targets, ` +
    `${(html.length / 1024 / 1024).toFixed(2)} MB`,
);
