#!/usr/bin/env python3
r"""Look at what THREE models read on the same strip — the picture, the gold, and all three decodes.

WHY IT IS A SEPARATE TOOL FROM `review_ui.py` (owner, 2026-09-19). That one records a VERDICT and
writes it back into a queue CSV; this one writes nothing at all. Keeping them apart means a
comparison session can never touch a labelling queue, and the two have different shapes anyway — a
verdict is one strip against one label, this is one strip against four columns.

WHAT IT IS FOR. Round 4's dense read came out as counts (35 edits against 48) and its whole
difference turned out to be ONE strip of 117 ([docs/METRICS-ROUND4-AB.md](../../docs/METRICS-ROUND4-AB.md)).
Counts cannot show that; a page of strips can. The filter that matters most is **agreement**: where
two models say the same thing and the third does not, the odd one out is the interesting column.

⛔ **NOTHING HERE IS A MEASUREMENT.** It shows rows, in the order you ask for. Reading it and then
quoting "H looked worse" is exactly the mistake the round already paid for once — a number needs
`paired_arm_score.py`, with its interval, on a pool chosen before looking. ⚠ Some pools have NO
gold (a bare page's crops): those rows can only be compared model against model, and the UI says so.

⚠ **Edits and agreement are on the OLD-id scale**, produced by `build_model_compare.py` the way
`paired_arm_score.py --score-vocab old` produces them — so scheme H is not flattered by spelling a
note in fewer ids, and its glued decode (`b''32a''32`) does not read as a disagreement.

Run:
    .venv-ml/bin/python scripts/rung3/build_model_compare.py    # decode first (~10-14 min)
    .venv-ml/bin/python scripts/rung3/compare_ui.py             # http://127.0.0.1:8378

Keys: j / k or arrows move | n note names on/off | r toggle H's raw glued text

⚠ **Note names are a DISPLAY rewrite** (`do re mi fa sol la si`, on by default) — the same rule
`review_ui.py` and `apps/web/src/omr/solfege.ts` apply, so a strip reads the same way in all three.
The token alignment still runs on the LilyPond letters, so what is painted red does not move when
you toggle it, and nothing on disk is rewritten: letters are the alphabet the model was trained on.

Only stdlib, read-only, no writes of any kind.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

REPO = Path(__file__).resolve().parents[2]
DATA = "data/real/rung3/_compare/models.json"

PAGE = r"""<!doctype html>
<meta charset="utf-8"><title>three models, one strip</title>
<style>
 :root{--bg:#14161a;--fg:#e8e8e6;--dim:#9aa0a8;--line:#2a2e35;--card:#1b1e24;
       --gold:#e8c46a;--live:#7fb2ff;--ctl:#7fd8a0;--h:#e29ad8;--bad:#ff6b6b;--ok:#3a4a3a}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--fg);
      font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
 header{position:sticky;top:0;z-index:5;background:#101216;border-bottom:1px solid var(--line);
        padding:10px 14px}
 h1{font:600 14px/1.3 system-ui;margin:0 0 6px}
 .legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--dim);font-size:11px;margin-bottom:8px}
 .legend b{font-weight:600}
 .sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:baseline}
 .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
 select,input[type=search]{background:#20242b;color:var(--fg);border:1px solid var(--line);
   border-radius:5px;padding:4px 7px;font:12px ui-monospace,Menlo,monospace}
 label.chk{display:inline-flex;align-items:center;gap:4px;background:#20242b;border:1px solid var(--line);
   border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px;user-select:none}
 label.chk.on{background:#2c3a30;border-color:#4a6a52}
 .count{color:var(--dim);font-size:11px;margin-left:auto}
 main{padding:10px 14px 60px}
 .row{background:var(--card);border:1px solid var(--line);border-radius:8px;margin-bottom:12px;
      padding:10px;scroll-margin-top:120px}
 .row.sel{border-color:#5a7fb5;box-shadow:0 0 0 1px #5a7fb5}
 .meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--dim);font-size:11px;margin-bottom:7px}
 .tag{background:#23272e;border-radius:4px;padding:1px 6px}
 .tag.warn{background:#3a2a20;color:#e0a878}
 .strip{background:#fff;border-radius:5px;padding:4px;overflow-x:auto;margin-bottom:8px}
 .strip img{display:block;max-width:none;height:auto;image-rendering:crisp-edges}
 .ln{display:grid;grid-template-columns:76px 58px 1fr;gap:9px;align-items:start;
     padding:3px 0;border-top:1px solid #23262c}
 .ln:first-of-type{border-top:0}
 .who{font-weight:600;font-size:11px;padding-top:1px}
 .sc{font-size:11px;color:var(--dim);text-align:right;padding-top:1px;white-space:nowrap}
 .txt{white-space:pre-wrap;word-break:break-word;font-size:12.5px}
 .d{background:#4a1f22;color:#ffb3b3;border-radius:2px;padding:0 1px}
 .m{background:#1f3a24;border-radius:2px;padding:0 1px}
 .nogold .d,.nogold .m{background:none;color:inherit;padding:0}
 .raw{color:var(--dim);font-size:11.5px;margin-top:2px;display:none}
 body.showraw .raw{display:block}
 .empty{color:var(--dim);padding:40px 0;text-align:center}
 kbd{background:#23272e;border:1px solid var(--line);border-radius:3px;padding:0 4px;font-size:11px}
 .help{color:var(--dim);font-size:11px;margin-top:6px}
</style>
<header>
 <h1>three models, one strip <span id="sub" style="font-weight:400;color:#9aa0a8"></span></h1>
 <div class="legend" id="legend"></div>
 <div class="bar">
  <select id="pool"></select>
  <select id="agree">
   <option value="">agreement: any</option>
   <option value="all">all three agree</option>
   <option value="two">exactly two agree — one odd out</option>
   <option value="none">no two agree</option>
   <option value="any2">any two agree (all + exactly two)</option>
  </select>
  <select id="odd">
   <option value="">odd one out: any</option>
  </select>
  <select id="gold">
   <option value="">gold: any</option>
   <option value="yes">has gold</option>
   <option value="no">no gold</option>
   <option value="wrongall">every model differs from gold</option>
   <option value="okall">every model exact</option>
  </select>
  <select id="len">
   <option value="">length: any</option>
   <option value="d">dense — over 49 old ids</option>
   <option value="over59">over the old 59-id gate</option>
   <option value="s">under 30 old ids</option>
  </select>
  <select id="nd">
   <option value="">nd: any</option>
   <option value="0">nd = 0 — the gate model matched the label exactly</option>
   <option value="gt0">nd &gt; 0</option>
  </select>
  <select id="sort">
   <option value="dis">sort: most disagreement first</option>
   <option value="ids">sort: longest label first</option>
   <option value="spread">sort: widest edit spread first</option>
   <option value="pool">sort: pool order</option>
  </select>
  <input type="search" id="q" placeholder="piece / file contains…" size="18">
  <label class="chk on" id="notetog"><input type="checkbox" id="notecb" checked>note names</label>
  <label class="chk" id="rawtog"><input type="checkbox" id="rawcb">H raw</label>
  <span class="count" id="count"></span>
 </div>
 <div class="help">
  <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>n</kbd> note names (do re mi fa sol la si) ·
  <kbd>r</kbd> H raw text · red = differs from gold ·
  a pool with no gold is compared model-against-model only, never scored
 </div>
</header>
<main id="list"></main>
<script>
let DATA=null, VIEW=[], SEL=0, KEYS=[];
const $=id=>document.getElementById(id);

/* Token alignment — the SAME shape as eval_omr.align (Levenshtein over token arrays), so what is
   painted red here is what the edit count counted. Not a re-scoring: the numbers come from the
   builder; this only decides which token to colour. */
function ops(a,b){
 const n=a.length,m=b.length,D=[];
 for(let i=0;i<=n;i++){D.push(new Int32Array(m+1));D[i][0]=i;}
 for(let j=0;j<=m;j++)D[0][j]=j;
 for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)
   D[i][j]=Math.min(D[i-1][j]+1,D[i][j-1]+1,D[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
 let i=n,j=m;const out=[];
 while(i>0||j>0){
  if(i>0&&j>0&&D[i][j]===D[i-1][j-1]+(a[i-1]===b[j-1]?0:1)){out.push([a[i-1]===b[j-1]?'m':'s',b[j-1]]);i--;j--;}
  else if(j>0&&D[i][j]===D[i][j-1]+1){out.push(['i',b[j-1]]);j--;}
  else {out.push(['d',null]);i--;}
 }
 return out.reverse();
}
/* quotes too: a decode goes into a title="" attribute for the raw-on-hover column */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,
  c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Note letters shown as the syllables the owner reads: c''16 -> do''16, and a bare signature
   letter too (`\kucukFlat b` -> `\kucukFlat si`). The three lines below are the SAME rule as
   review_ui.py's and apps/web/src/omr/solfege.ts's, so a strip reads the same way in all three.
   ⚠ DISPLAY ONLY. The alignment below still runs on the LETTER tokens, so what is painted red does
   not move when this is toggled, and nothing on disk is rewritten — LilyPond letters are the
   alphabet the model was trained on. ⚠ The `r` rest is deliberately not renamed (solfege.ts). */
const SOLF={c:'do',d:'re',e:'mi',f:'fa',g:'sol',a:'la',b:'si'};
const toSolf=t=>t.startsWith('\\')?t:t.replace(/^([a-g])(?=[',\d.]|$)/,m=>SOLF[m]);
let NOTES=true;                                   // the toggle; on by default
const disp=t=>NOTES?toSolf(t):t;                  // one token
const show=s=>String(s==null?'':s).trim().split(/\s+/).filter(Boolean).map(disp).join(' ');
function paint(gold,txt){
 if(!gold) return esc(show(txt));
 /* ⚠ the alignment runs on the LETTER tokens, never the displayed ones — so toggling note names
    cannot move which token is painted red */
 const g=gold.split(/\s+/).filter(Boolean), t=txt.split(/\s+/).filter(Boolean);
 let out=[];
 for(const [op,tk] of ops(g,t)){
  if(op==='m') out.push(esc(disp(tk)));
  else if(op==='s'||op==='i') out.push('<span class="d">'+esc(disp(tk))+'</span>');
  else out.push('<span class="d">·</span>');
 }
 return out.join(' ');
}

function oddOne(r){
 if(r.nAgree!==1) return null;
 const pair=Object.keys(r.agree).find(k=>r.agree[k]).split('|');
 return KEYS.find(k=>!pair.includes(k));
}

function apply(){
 const pool=$('pool').value, ag=$('agree').value, od=$('odd').value, gd=$('gold').value,
       ln=$('len').value, nd=$('nd').value, q=$('q').value.trim().toLowerCase();
 VIEW=DATA.rows.filter(r=>{
  if(pool && r.pool!==pool) return false;
  if(ag==='all'&&!r.allAgree) return false;
  if(ag==='two'&&r.nAgree!==1) return false;
  if(ag==='none'&&r.nAgree!==0) return false;
  if(ag==='any2'&&r.nAgree===0) return false;
  if(od && oddOne(r)!==od) return false;
  if(gd==='yes'&&r.goldIds==null) return false;
  if(gd==='no'&&r.goldIds!=null) return false;
  if(gd==='wrongall'&&(r.goldIds==null||KEYS.some(k=>r.models[k].exact))) return false;
  if(gd==='okall'&&(r.goldIds==null||!KEYS.every(k=>r.models[k].exact))) return false;
  if(ln==='d'&&!(r.goldIds>49)) return false;
  if(ln==='over59'&&!(r.goldIds>59)) return false;
  if(ln==='s'&&!(r.goldIds!=null&&r.goldIds<30)) return false;
  if(nd==='0'&&r.nd!==0) return false;
  if(nd==='gt0'&&!(r.nd>0)) return false;
  if(q&&!((r.piece+' '+r.image).toLowerCase().includes(q))) return false;
  return true;
 });
 const spread=r=>{const e=KEYS.map(k=>r.models[k].edits).filter(x=>x!=null);
                  return e.length?Math.max(...e)-Math.min(...e):-1;};
 const s=$('sort').value;
 if(s==='dis') VIEW.sort((a,b)=>(a.nAgree-b.nAgree)||(spread(b)-spread(a))||((b.goldIds||0)-(a.goldIds||0)));
 else if(s==='ids') VIEW.sort((a,b)=>(b.goldIds||0)-(a.goldIds||0));
 else if(s==='spread') VIEW.sort((a,b)=>spread(b)-spread(a)||(a.nAgree-b.nAgree));
 SEL=0; render();
}

function render(){
 const L=$('list');
 const scored=VIEW.filter(r=>r.goldIds!=null);
 const tot=KEYS.map(k=>{
   const e=scored.reduce((s,r)=>s+r.models[k].edits,0);
   const x=scored.filter(r=>r.models[k].exact).length;
   return `${k} ${e}e ${scored.length?Math.round(100*x/scored.length):0}%`;
 }).join('  ·  ');
 $('count').textContent=`${VIEW.length} of ${DATA.rows.length} rows`+
   (scored.length?`   —   ${scored.length} scored:  ${tot}`:'   —   no gold in this selection');
 if(!VIEW.length){L.innerHTML='<div class="empty">nothing matches these filters</div>';return;}
 L.innerHTML=VIEW.map((r,i)=>{
  const poolIdx=DATA.pools.findIndex(p=>p.path===r.pool);
  const od=oddOne(r);
  const tags=[`<span class="tag">${esc(r.image)}</span>`];
  if(r.piece) tags.push(`<span class="tag">${esc(r.piece.split('--').slice(-2)[0]||r.piece)}</span>`);
  if(r.goldIds!=null) tags.push(`<span class="tag">${r.goldIds} old ids</span>`);
  else tags.push(`<span class="tag warn">no gold — model vs model only</span>`);
  if(r.nd!=null) tags.push(`<span class="tag${r.nd===0?' warn':''}">nd ${r.nd}</span>`);
  if(r.verdict) tags.push(`<span class="tag">verdict ${esc(r.verdict)}</span>`);
  tags.push(`<span class="tag">${r.allAgree?'all three agree':r.nAgree===0?'all three differ':
              'odd one out: '+od}</span>`);
  const lines=[];
  if(r.gold) lines.push(`<div class="ln"><div class="who" style="color:var(--gold)">gold</div>
      <div class="sc"></div><div class="txt">${esc(show(r.gold))}</div></div>`);
  for(const k of KEYS){
   const m=r.models[k];
   const sc=m.edits==null?`${m.nIds} ids`
     :(m.exact?'<span style="color:#7fd8a0">exact</span>':`<b style="color:var(--bad)">${m.edits}</b> ed`);
   const body=paint(r.gold,m.text)+
     (k==='h'?`<div class="raw">raw: ${esc(m.raw)}</div>`:'');
   lines.push(`<div class="ln${r.gold?'':' nogold'}">
     <div class="who" style="color:var(--${k})">${k}${od===k?' ◄':''}</div>
     <div class="sc">${sc}</div><div class="txt" ${k==='h'?`title="raw: ${esc(m.raw)}"`:''}>${body}</div></div>`);
  }
  return `<div class="row${i===SEL?' sel':''}" id="r${i}">
    <div class="meta">${tags.join('')}</div>
    <div class="strip"><img loading="lazy" src="/img/${poolIdx}/${encodeURIComponent(r.image)}"></div>
    ${lines.join('')}</div>`;
 }).join('');
}

function move(d){
 SEL=Math.max(0,Math.min(VIEW.length-1,SEL+d));
 document.querySelectorAll('.row').forEach((e,i)=>e.classList.toggle('sel',i===SEL));
 const el=$('r'+SEL); if(el) el.scrollIntoView({block:'center',behavior:'smooth'});
}
addEventListener('keydown',e=>{
 if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
 if(e.key==='j'||e.key==='ArrowDown'){e.preventDefault();move(1);}
 else if(e.key==='k'||e.key==='ArrowUp'){e.preventDefault();move(-1);}
 else if(e.key==='r'){$('rawcb').click();}
 else if(e.key==='n'){$('notecb').click();}
});

fetch('/api/data').then(r=>r.json()).then(d=>{
 DATA=d; KEYS=d.models.map(m=>m.key);
 $('legend').innerHTML=d.models.map(m=>
   `<span><span class="sw" style="background:var(--${m.key})"></span><b>${m.key}</b> — ${esc(m.desc)}
    <span style="opacity:.6">${esc(m.checkpoint.replace('data/checkpoints/',''))}</span></span>`).join('')
   +`<span style="opacity:.7">edits and agreement on the OLD-id scale (--score-vocab old)</span>`;
 $('sub').textContent=`— ${d.rows.length} strips, ${d.pools.length} pool(s)`;
 $('pool').innerHTML='<option value="">pool: all</option>'+
   d.pools.map(p=>`<option value="${esc(p.path)}">${esc(p.path.split('/').pop())} — ${p.n} strips, ${p.gold?p.gold+' gold':'NO gold'}</option>`).join('');
 $('odd').innerHTML='<option value="">odd one out: any</option>'+
   KEYS.map(k=>`<option value="${k}">odd one out: ${k}</option>`).join('');
 ['pool','agree','odd','gold','len','nd','sort'].forEach(id=>$(id).onchange=apply);
 $('q').oninput=apply;
 $('rawcb').onchange=e=>{document.body.classList.toggle('showraw',e.target.checked);
                         $('rawtog').classList.toggle('on',e.target.checked);};
 $('notecb').onchange=e=>{NOTES=e.target.checked;
                          $('notetog').classList.toggle('on',NOTES); render();};
 apply();
});
</script>
"""


class Handler(BaseHTTPRequestHandler):
    root: Path = REPO
    payload: dict = {}

    def log_message(self, *a):  # keep the terminal quiet
        pass

    def _send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj).encode(), "application/json")

    def do_GET(self):
        path = unquote(self.path.split("?", 1)[0])
        if path == "/":
            self._send(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/api/data":
            self._json(self.payload)
        elif path.startswith("/img/"):
            idx, _, name = path[len("/img/"):].partition("/")
            # the pool is addressed by INDEX and the name must be a bare png — a crop root is never
            # taken from the URL, which is what keeps this read-only server off the rest of the disk
            if not idx.isdigit() or not re.fullmatch(r"[\w.\-]+\.png", name):
                self._json({"error": "bad path"}, 400)
                return
            pools = self.payload.get("pools", [])
            if int(idx) >= len(pools):
                self._json({"error": "no such pool"}, 404)
                return
            base = (self.root / pools[int(idx)]["path"]).resolve()
            img = (base / name).resolve()
            if str(img).startswith(str(base)) and img.exists():
                self._send(200, img.read_bytes(), "image/png")
            else:
                self._json({"error": "not found"}, 404)
        else:
            self._json({"error": "not found"}, 404)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=DATA, help="the file build_model_compare.py wrote")
    ap.add_argument("--port", type=int, default=8378)
    args = ap.parse_args()

    p = REPO / args.data if not Path(args.data).is_absolute() else Path(args.data)
    if not p.exists():
        raise SystemExit(f"⛔ {p} does not exist — run:\n"
                         f"   .venv-ml/bin/python scripts/rung3/build_model_compare.py")
    Handler.payload = json.loads(p.read_text())
    n = len(Handler.payload["rows"])
    gold = sum(1 for r in Handler.payload["rows"] if r["goldIds"] is not None)
    print(f"{n} strips ({gold} with gold) from {p}")
    for m in Handler.payload["models"]:
        print(f"   {m['key']:5s} {m['checkpoint']}")
    print(f"\n-> http://127.0.0.1:{args.port}   (read-only; it writes nothing)\n")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
