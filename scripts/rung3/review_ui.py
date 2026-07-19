#!/usr/bin/env python3
"""Temporary one-keystroke review UI for the Rung-3 verdict queues (docs/RUNG3.md).

Serves a single-page app over the four verdict CSVs and writes verdicts straight back
into them (adding `verdict` / `corrected_label` columns on first write):

  r1-audit     strips_r1/emit_audit.csv    seeded sample of ACCEPTED training strips.
                                           ok/bad -> the <2% escaped-bad-label gate.
  r1-full      strips_r1/full_audit.csv    EVERY accepted training strip (generated once
                                           from manifest.jsonl + page decode caches; the
                                           manifest itself is never written).
  r1-review    strips_r1/emit_review.csv   rejected-from-auto-accept pool. ok/fix promote
                                           a strip into Round-1 training; bad drops it.
  exam-audit   strips_exam/emit_audit.csv  (empty unless --audit-frac was set on the exam run)
  exam-review  strips_exam/emit_review.csv same, but promotes into the real-page EXAM.
                                           Rows with an empty label (row_unaligned etc.)
                                           must be labeled by hand — edit starts from the
                                           model's decode; fix what the model misread.

Two-source stage queues (2026-07-15; strips_exam ones above are SUPERSEDED by v2):
  nota-audit    strips_nota/emit_audit.csv     69-strip sample of the 1,262 nota accepts —
                                               the trust gate on the labeler-based emitter.
  nota-review   strips_nota/emit_review.csv    2,671-row nota review pool (promotes into
                                               Round-1 training).
  examv2-audit  strips_exam_v2/emit_audit.csv  sample of the v2 exam accepts.
  examv2-review strips_exam_v2/emit_review.csv 287-row growth queue for the re-frozen exam.

Targeted tuplet queues (2026-07-18, docs/RUNG3.md §1c; tup3-only, 1-measure windows):
  tup-full      strips_tup/full_audit.csv      all 78 accepted tup3 strips (114 groups) —
                                               sidecar built on first run, manifest untouched.
  tup-review    strips_tup/emit_review.csv     147 tup3 review rows / 205 groups (the
                                               promote pool that ~triples real triplet data).

Verdicts (written to the CSV, blank = not reviewed yet):
  ok   label matches the printed strip exactly
  fix  label corrected by hand (correction saved in `corrected_label`)
  bad  unusable — wrong music under the label, illegible strip, out-of-scope marks

Keys: <-/-> navigate | n next pending | a=ok x=bad e=edit u=clear | z zoom
      in edit: Cmd/Ctrl+Enter save-as-fix, Esc cancel

Run:  python3 scripts/rung3/review_ui.py            # http://127.0.0.1:8377
Only stdlib; CSV writes are atomic (temp file + rename). Verdict consumption
(promotion into manifest/exam through the real budget+round-trip gates) is a
follow-up script — this tool only records human judgment.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

REPO = Path(__file__).resolve().parents[2]

# Mirrors ADDED_TOKENS in src/vision/data.py — used only for the client-side token
# diff + lint; the authoritative gates re-run at promote time.
ADDED_TOKENS = [
    "\\komaSharp", "\\bakiyeSharp", "\\kucukSharp", "\\buyukSharp",
    "\\komaFlat", "\\bakiyeFlat", "\\kucukFlat", "\\buyukFlat",
    "\\natural", "\\sig", "\\sigend",
    "\\repstart", "\\repend", "\\volta1", "\\volta2",
    "\\segno", "\\coda", "\\dc", "\\fine",
    "|", "3",
    "\\tup3", "\\tupend", "\\tie", "\\grace",
]
ACCIDENTALS = set(ADDED_TOKENS[:9])

QUEUES = {
    # targeted tuplet run (2026-07-18, docs/RUNG3.md §1c) — tup3-only, k=1 windows
    "tup-audit": "data/real/rung3/strips_tup/emit_audit.csv",
    "tup-full": "data/real/rung3/strips_tup/full_audit.csv",
    "tup-review": "data/real/rung3/strips_tup/emit_review.csv",
    # two-source stage (2026-07-15) — the live queues
    "nota-audit": "data/real/rung3/strips_nota/emit_audit.csv",
    "nota-full": "data/real/rung3/strips_nota/full_audit.csv",
    "nota-review": "data/real/rung3/strips_nota/emit_review.csv",
    "examv2-audit": "data/real/rung3/strips_exam_v2/emit_audit.csv",
    "examv2-full": "data/real/rung3/strips_exam_v2/full_audit.csv",
    "examv2-review": "data/real/rung3/strips_exam_v2/emit_review.csv",
    # neyzen round (2026-07-12..14) — fully adjudicated, kept for reference;
    # the old strips_exam queues are SUPERSEDED by the v2 exam re-freeze.
    "r1-audit": "data/real/rung3/strips_r1/emit_audit.csv",
    "r1-full": "data/real/rung3/strips_r1/full_audit.csv",
    "r1-review": "data/real/rung3/strips_r1/emit_review.csv",
}

# full-queue id -> (manifest dir, sampled-audit queue whose verdicts are carried over)
FULL_AUDITS = {
    "r1-full": ("data/real/rung3/strips_r1", "r1-audit"),
    "nota-full": ("data/real/rung3/strips_nota", "nota-audit"),
    "examv2-full": ("data/real/rung3/strips_exam_v2", "examv2-audit"),
    "tup-full": ("data/real/rung3/strips_tup", "tup-audit"),
}
STRIPS = "data/real/strips"
VERDICTS = {"", "ok", "fix", "bad"}


def load_queue(root: Path, qid: str) -> tuple[list[str], list[dict]]:
    path = root / QUEUES[qid]
    if not path.exists():
        return [], []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)
    for col in ("verdict", "corrected_label", "by"):
        if col not in fields:
            fields.append(col)
        for r in rows:
            r.setdefault(col, "")
    return fields, rows


def save_verdict(root: Path, qid: str, strip: str, verdict: str, corrected: str,
                 by: str = "") -> dict:
    """`by` marks non-human verdicts (e.g. "claude") so trust accounting can tell them
    apart; the UI posts no `by`, so a human (re-)verdict always clears the marker."""
    if verdict not in VERDICTS:
        raise ValueError(f"bad verdict {verdict!r}")
    path = root / QUEUES[qid]
    fields, rows = load_queue(root, qid)
    hits = [r for r in rows if r["strip"] == strip]
    if len(hits) != 1:
        raise ValueError(f"{strip}: {len(hits)} rows matched in {qid}")
    hits[0]["verdict"] = verdict
    hits[0]["corrected_label"] = corrected
    hits[0]["by"] = by
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".csv.tmp")
    try:
        with os.fdopen(fd, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return hits[0]


def build_full_audit(root: Path) -> None:
    """Sidecar queues over EVERY accepted training strip (manifest.jsonl), so the whole
    training set can be eyeballed, not just the seeded audit sample. Verdicts live in
    full_audit.csv only — the manifest is never touched; the sampled-audit verdicts are
    carried over so that work isn't repeated. Generated once per dataset in FULL_AUDITS;
    delete a CSV to rebuild it (re-carrying the sample verdicts made since)."""
    for full_qid, (dirpath, audit_qid) in FULL_AUDITS.items():
        path = root / QUEUES[full_qid]
        mani = root / dirpath / "manifest.jsonl"
        if path.exists() or not mani.exists():
            continue
        _, audit_rows = load_queue(root, audit_qid)
        prior = {r["strip"]: (r["verdict"], r["corrected_label"]) for r in audit_rows}
        decodes: dict[str, dict] = {}
        rows = []
        with open(mani) as f:
            for line in f:
                m = json.loads(line)
                strip, page = Path(m["image"]).name, m["page"]
                if page not in decodes:
                    dj = root / STRIPS / page / f"{page}_decode.json"
                    decodes[page] = ({s["strip"]: s["tokens"]
                                      for s in json.load(open(dj))["strips"]}
                                     if dj.exists() else {})
                v, c = prior.get(strip, ("", ""))
                rows.append({"piece": m["piece"], "page": page, "strip": strip,
                             "nd": m.get("nd", ""), "min_logprob": m.get("min_logprob", ""),
                             "verdict": v, "label": m["label"],
                             "decoded": decodes[page].get(strip, ""), "corrected_label": c})
        with open(path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["piece", "page", "strip", "nd", "min_logprob",
                                              "verdict", "label", "decoded", "corrected_label"])
            w.writeheader()
            w.writerows(rows)


def state(root: Path) -> dict:
    out = {"queues": [], "vocab": ADDED_TOKENS, "accidentals": sorted(ACCIDENTALS)}
    for qid in QUEUES:
        _, rows = load_queue(root, qid)
        out["queues"].append({"id": qid, "rows": rows})
    return out


class Handler(BaseHTTPRequestHandler):
    root: Path = REPO

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
        elif path == "/api/state":
            self._json(state(self.root))
        elif path == "/font":
            # Bravura (SMuFL) from the web app — the token reference shows real AEU glyphs
            font = self.root / "apps/web/public/fonts/Bravura.woff2"
            if font.exists():
                self._send(200, font.read_bytes(), "font/woff2")
            else:
                self._json({"error": "font not found"}, 404)
        elif path.startswith("/img/"):
            rel = path[len("/img/"):]
            if not re.fullmatch(r"[\w.\-]+/[\w.\-]+\.png", rel):
                self._json({"error": "bad path"}, 400)
                return
            img = (self.root / STRIPS / rel).resolve()
            if not str(img).startswith(str((self.root / STRIPS).resolve())) or not img.exists():
                self._json({"error": "not found"}, 404)
                return
            self._send(200, img.read_bytes(), "image/png")
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        if self.path != "/api/verdict":
            self._json({"error": "not found"}, 404)
            return
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            row = save_verdict(self.root, body["queue"], body["strip"],
                               body.get("verdict", ""), body.get("corrected", ""),
                               body.get("by", ""))
            self._json({"ok": True, "row": row})
        except Exception as e:  # surface the reason in the UI toast
            self._json({"ok": False, "error": str(e)}, 400)


PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rung-3 strip review</title>
<style>
  :root{--bg:#f6f7f9;--card:#fff;--ink:#1a2030;--mut:#68738a;--line:#e3e6ee;
        --ok:#177245;--okbg:#e5f4ec;--bad:#b3261e;--badbg:#fbe9e7;
        --fix:#8a5a00;--fixbg:#fdf3dc;--acc:#3b5bdb;--accbg:#e8edfd;--hl:#ffd9d4;--hl2:#ffefc2}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
       font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  header{display:flex;gap:10px;align-items:center;flex-wrap:wrap;
         padding:10px 16px;background:var(--card);border-bottom:1px solid var(--line);
         position:sticky;top:0;z-index:5}
  header h1{font-size:15px;margin:0 8px 0 0;font-weight:650}
  .tab{border:1px solid var(--line);background:var(--bg);border-radius:8px;
       padding:5px 10px;cursor:pointer;font-size:13px}
  .tab.active{background:var(--accbg);border-color:var(--acc);color:var(--acc);font-weight:600}
  .tab .n{color:var(--mut);font-size:12px;margin-left:4px}
  select,label.chk{font-size:13px;color:var(--ink)}
  select{padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--card)}
  #bar{height:5px;background:var(--line)} #barfill{height:100%;width:0;background:var(--ok);transition:width .2s}
  main{max-width:1200px;margin:14px auto;padding:0 16px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;
        padding:14px 16px;margin-bottom:12px}
  #meta{display:flex;gap:14px;flex-wrap:wrap;align-items:baseline;font-size:13px;color:var(--mut)}
  #meta b{color:var(--ink);font-weight:600}
  .badge{padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600}
  .b-reason{background:var(--fixbg);color:var(--fix)}
  .b-ok{background:var(--okbg);color:var(--ok)} .b-bad{background:var(--badbg);color:var(--bad)}
  .b-fix{background:var(--fixbg);color:var(--fix)} .b-pend{background:var(--bg);color:var(--mut)}
  #imgwrap{overflow-x:auto;background:#fff;border:1px solid var(--line);border-radius:8px;
           padding:10px;text-align:center;cursor:zoom-in}
  #imgwrap img{max-width:100%;image-rendering:auto}
  #imgwrap.zoom{cursor:zoom-out} #imgwrap.zoom img{max-width:none}
  .lblhead{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:10px 0 4px}
  .toks{font:13.5px/2.15 ui-monospace,SFMono-Regular,Menlo,monospace;word-spacing:2px}
  .tok{padding:2px 4px;border-radius:5px;margin-right:3px;white-space:nowrap}
  .tok.diff{background:var(--hl);outline:1px solid #f2b8b5}
  .tok.diff2{background:var(--hl2);outline:1px solid #e8ce8e}
  .tok.accid{font-weight:700}
  .tok.gap{color:var(--mut);background:repeating-linear-gradient(45deg,#f1f2f6 0 4px,#fff 4px 8px)}
  .agree{color:var(--ok);font-size:13px}
  #editbox{display:none;margin-top:10px}
  #editbox textarea{width:100%;min-height:84px;font:13.5px/1.6 ui-monospace,Menlo,monospace;
        padding:10px;border:1px solid var(--acc);border-radius:8px;background:#fbfcff}
  #lint{font-size:12.5px;margin-top:4px;min-height:18px}
  #lint .warn{color:var(--bad)} #lint .fine{color:var(--ok)}
  .btns{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center}
  button{border:1px solid var(--line);border-radius:8px;background:var(--card);
         padding:7px 14px;font-size:13.5px;cursor:pointer;font-weight:600}
  button:hover{filter:brightness(.97)}
  .k{display:inline-block;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;
     padding:0 5px;font:11.5px ui-monospace,Menlo,monospace;color:var(--mut);margin-left:6px}
  #b-ok{color:var(--ok);border-color:#bfe3cf;background:var(--okbg)}
  #b-bad{color:var(--bad);border-color:#f2c4c0;background:var(--badbg)}
  #b-edit{color:var(--fix);border-color:#ecd9a8;background:var(--fixbg)}
  @font-face{font-family:'Bravura';src:url('/font') format('woff2')}
  .glyph{font-family:'Bravura';font-size:24px;line-height:1;display:inline-block;
         min-width:30px;text-align:center;transform:translateY(6px)}
  #refcard table{border-collapse:collapse;font-size:13px;width:100%}
  #refcard td,#refcard th{padding:4px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
  #refcard th{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
  #refcard code{font:12.5px ui-monospace,Menlo,monospace;background:var(--bg);
                padding:1px 5px;border-radius:4px}
  .refcols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:6px 28px}
  .refnote{font-size:12.5px;color:var(--mut);margin-top:8px}
  .logrow{display:flex;gap:10px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line);
          cursor:pointer;font-size:13px}
  .logrow:hover{background:var(--bg)}
  .logrow .mono{font:12.5px ui-monospace,Menlo,monospace}
  #toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--ink);
         color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .25s}
  #help{font-size:13px;color:var(--mut)} #help b{color:var(--ink)}
  #empty{color:var(--mut);text-align:center;padding:60px 0;font-size:15px}
  @media (prefers-color-scheme: dark){
    :root{--bg:#14161c;--card:#1d2027;--ink:#e8eaf1;--mut:#98a0b3;--line:#31353f;
          --okbg:#173226;--badbg:#3a1f1c;--fixbg:#332a12;--accbg:#1e2740;--hl:#5a2d28;--hl2:#4d3d14}
    #imgwrap{background:#fff} /* strips are black-on-white scans; keep them readable */
  }
</style></head><body>
<header>
  <h1>Rung-3 strip review</h1>
  <span id="tabs"></span>
  <select id="freason"><option value="">all reasons</option></select>
  <select id="fshow">
    <option value="pending" selected>pending only</option>
    <option value="reviewed">reviewed only</option>
    <option value="claude">🤖 claude verdicts</option>
    <option value="rule">🤖 rule drafts</option>
    <option value="all">all strips</option>
  </select>
  <button class="tab" id="b-log">🗂 saved log</button>
  <button class="tab" id="b-ref">📖 tokens</button>
  <span id="pos" style="margin-left:auto;font-size:13px;color:var(--mut)"></span>
</header>
<div id="bar"><div id="barfill"></div></div>
<main>
  <div class="card" id="viewer" style="display:none">
    <div id="meta"></div>
    <div id="imgwrap" title="click to zoom"><img id="strip" alt="strip"></div>
    <div id="labels"></div>
    <div id="editbox">
      <div class="lblhead">corrected label (saving marks the strip <b>fix</b>) — start from:
        <button class="tab" id="base-h">sig from label + notes from model</button>
        <button class="tab" id="base-l">label</button>
        <button class="tab" id="base-d">model decode</button>
        <label style="margin-left:10px;font-weight:400;white-space:nowrap">
          <input type="checkbox" id="striptup"> drop decode \tup3 (slur-hallucination guard)
        </label></div>
      <textarea id="edit" spellcheck="false"></textarea>
      <div id="lint"></div>
      <div class="btns" style="margin-top:8px">
        <button id="b-save" style="color:var(--ok);border-color:#bfe3cf;background:var(--okbg)">
          ✓ save fix<span class="k">⌘⏎</span></button>
        <button id="b-cancel">cancel<span class="k">esc</span></button>
      </div>
    </div>
    <div class="btns">
      <button id="b-ok">✓ ok<span class="k">a</span></button>
      <button id="b-edit">✎ edit / fix<span class="k">e</span></button>
      <button id="b-bad">✗ bad<span class="k">x</span></button>
      <button id="b-clear">clear<span class="k">u</span></button>
      <span style="flex:1"></span>
      <button id="b-prev">←</button>
      <button id="b-next">→</button>
      <button id="b-pend">next pending<span class="k">n</span></button>
    </div>
  </div>
  <div class="card" id="empty" style="display:none">queue clear — nothing matches the filter 🎉</div>
  <div class="card" id="refcard" style="display:none">
    <div class="lblhead">token reference — glyphs as engraved (Bravura, same font as the app)</div>
    <div class="refcols">
      <table><tr><th>sharp</th><th>commas</th><th>token</th></tr>
        <tr><td><span class="glyph">&#xE444;</span> koma diyezi</td><td>1</td><td><code>\komaSharp</code></td></tr>
        <tr><td><span class="glyph">&#xE445;</span> bakiye diyezi</td><td>4</td><td><code>\bakiyeSharp</code></td></tr>
        <tr><td><span class="glyph">&#xE446;</span> küçük mücennep diyezi</td><td>5</td><td><code>\kucukSharp</code></td></tr>
        <tr><td><span class="glyph">&#xE447;</span> büyük mücennep diyezi</td><td>8</td><td><code>\buyukSharp</code></td></tr>
        <tr><td><span class="glyph">&#xE261;</span> natural</td><td>0</td><td><code>\natural</code></td></tr>
      </table>
      <table><tr><th>flat</th><th>commas</th><th>token</th></tr>
        <tr><td><span class="glyph">&#xE443;</span> koma bemolü</td><td>1</td><td><code>\komaFlat</code></td></tr>
        <tr><td><span class="glyph">&#xE442;</span> bakiye bemolü</td><td>4</td><td><code>\bakiyeFlat</code></td></tr>
        <tr><td><span class="glyph">&#xE441;</span> küçük mücennep bemolü</td><td>5</td><td><code>\kucukFlat</code></td></tr>
        <tr><td><span class="glyph">&#xE440;</span> büyük mücennep bemolü</td><td>8</td><td><code>\buyukFlat</code></td></tr>
      </table>
      <table><tr><th>notes &amp; rhythm</th><th>meaning</th></tr>
        <tr><td><code>do''4.</code></td><td>pitch (do re mi fa sol la si) + octave marks + duration.
          <code>'</code>≈staff bottom half, <code>''</code>≈upper, <code>'''</code>=ledger lines above.
          durations 1 2 4 8 16 32; dot = ×1.5</td></tr>
        <tr><td><code>r4</code> <code>r8</code></td><td>rest (never takes octave marks)</td></tr>
        <tr><td><code>|</code></td><td>barline — also resets carried accidentals</td></tr>
        <tr><td><code>\tie</code></td><td>between two adjacent SAME-pitch notes (durations add).
          different pitches under an arc = slur → not labeled</td></tr>
        <tr><td><code>\tup3 … \tupend</code></td><td>triplet bracket around the 3 notes</td></tr>
        <tr><td><code>\grace</code></td><td>prefixes a small slashed grace note's own spelling</td></tr>
      </table>
      <table><tr><th>structure</th><th>meaning</th></tr>
        <tr><td><code>\sig … \sigend</code></td><td>row-start key signature: accidental + BARE note name,
          in printed order — e.g. <code>\sig \bakiyeFlat si \bakiyeSharp fa \sigend</code></td></tr>
        <tr><td><code>\repstart \repend</code></td><td>repeat barlines <code>|:</code> <code>:|</code></td></tr>
        <tr><td><code>\volta1 \volta2</code></td><td>1st / 2nd ending brackets</td></tr>
        <tr><td><code>\segno \coda \dc \fine</code></td><td>navigation marks (segno, coda, D.C./D.S., Son/Fine)
          — strips showing these usually go <b>bad</b></td></tr>
      </table>
    </div>
    <div class="refnote">
      Conventions: <b>carry mode</b> — an accidental holds for the rest of the measure until the barline;
      a note already altered by the signature is written <b>bare</b> (label = what's printed, not what sounds);
      slurs, lyrics and ornament text are never labeled. Label only what is physically inked on the strip.
    </div>
  </div>
  <div class="card" id="logcard" style="display:none">
    <div class="lblhead">saved verdicts — re-read from the CSV on disk<span id="logn"></span></div>
    <div id="loglist"></div>
  </div>
  <div class="card" id="help">
    <b>ok</b> label matches the printed strip exactly · <b>fix</b> you corrected the label
    (edit starts from the label, or from the model decode when no label exists) ·
    <b>bad</b> unusable strip (wrong music, illegible, marks we don't model).
    Notes shown as solfège (do''4 = c''4; saved CSV stays in letters — hover a token for the raw form).
    Red tokens = label/decode disagreement — check those pixels first; bold = accidental.
    Keys: <b>a</b>/<b>x</b>/<b>e</b>/<b>u</b>, <b>←→</b> move, <b>n</b> next pending, <b>z</b> zoom.
  </div>
</main>
<div id="toast"></div>
<script>
let S=null, qid=null, idx=0, editing=false;
const $=id=>document.getElementById(id);

const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
// show notes as solfège (c''4 -> do''4); CSV keeps lilypond letters (the tokenizer's alphabet)
const SOLF={c:'do',d:'re',e:'mi',f:'fa',g:'sol',a:'la',b:'si'};
const SOLF_REV={do:'c',re:'d',mi:'e',fa:'f',sol:'g',la:'a',si:'b'};
const toSolf=t=>t.startsWith('\\')?t:t.replace(/^([a-g])(?=[',\d.]|$)/,m=>SOLF[m]);
const fromSolf=t=>t.startsWith('\\')?t:t.replace(/^(sol|do|re|mi|fa|la|si)(?=[',\d.]|$)/,m=>SOLF_REV[m]);
const solfText=s=>tokenize(s).map(toSolf).join(' ');
const letterText=s=>tokenize(s).map(fromSolf).join(' ');
let CMDS=[], ACC=new Set();
function tokenize(s){
  const out=[]; let i=0; s=s.trim();
  while(i<s.length){
    const c=s[i];
    if(/\s/.test(c)){i++;continue}
    if(c==='|'){out.push('|');i++;continue}
    if(c==='\\'){
      const cmd=CMDS.find(t=>s.startsWith(t,i));
      if(cmd){out.push(cmd);i+=cmd.length;continue}
      const m=s.slice(i).match(/^\\[A-Za-z0-9]+/); out.push(m?m[0]:c); i+=(m?m[0].length:1); continue;
    }
    const m=s.slice(i).match(/^[^\s|\\]+/); out.push(m[0]); i+=m[0].length;
  }
  return out;
}
// LCS alignment -> [op, aTok|null, bTok|null]
function align(a,b){
  const n=a.length,m=b.length,d=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)
    d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]+1:Math.max(d[i-1][j],d[i][j-1]);
  const ops=[];let i=n,j=m;
  while(i>0||j>0){
    if(i>0&&j>0&&a[i-1]===b[j-1]){ops.push(['=',a[--i],b[--j]]);}
    else if(j>0&&(i===0||d[i][j-1]>=d[i-1][j])){ops.push(['+',null,b[--j]]);}
    else{ops.push(['-',a[--i],null]);}
  }
  return ops.reverse();
}
function tokHtml(t,cls){
  const a=ACC.has(t)?' accid':'';
  return `<span class="tok ${cls}${a}" title="${esc(t)}">${esc(toSolf(t))}</span>`;
}
function diffHtml(label,decoded){
  if(!label.trim()){
    return `<div class="lblhead">no aligned label — model decode (starting point for a fix)</div>
            <div class="toks">${tokenize(decoded).map(t=>tokHtml(t,'diff2')).join('')}</div>`;
  }
  if(!decoded.trim()){
    return `<div class="lblhead">label (no cached model decode — compare against the image)</div>
            <div class="toks">${tokenize(label).map(t=>tokHtml(t,'')).join('')}</div>`;
  }
  const ops=align(tokenize(label),tokenize(decoded));
  const same=ops.every(o=>o[0]==='=');
  let top='',bot='';
  for(const[op,at,bt]of ops){
    if(op==='='){top+=tokHtml(at,'');bot+=tokHtml(bt,'');}
    else if(op==='-'){top+=tokHtml(at,'diff');bot+='<span class="tok gap">·</span>';}
    else{top+='<span class="tok gap">·</span>';bot+=tokHtml(bt,'diff2');}
  }
  return `<div class="lblhead">label (proposed ground truth)</div><div class="toks">${top}</div>
          <div class="lblhead">model decode ${same?'<span class="agree">— agrees exactly</span>':''}</div>
          <div class="toks">${bot}</div>`;
}
// third block: the FINAL version of every verdicted row. A real fix is diffed against the
// original label (removed tokens = red gaps, new tokens = green); an untouched label
// (verdict ok, or a fix identical to the label) still shows its full token row so the
// reviewer sees exactly what was accepted.
function corrHtml(label,corrected,by,verdict){
  const who=by?`🤖 ${esc(by)}`:'you';
  const fin=(corrected&&corrected.trim())?corrected:label;
  if(tokenize(fin).join(' ')===tokenize(label).join(' '))
    return `<div class="lblhead" style="color:var(--fix)">final version (${verdict} by ${who}) — label accepted as-is</div>
            <div class="toks">${tokenize(fin).map(t=>tokHtml(t,'')).join('')}</div>`;
  const ops=align(tokenize(label),tokenize(fin));
  let out='';
  for(const[op,at,bt]of ops){
    if(op==='=')out+=tokHtml(bt,'');
    else if(op==='-')out+=`<span class="tok diff" title="removed: ${esc(at)}">·</span>`;
    else out+=tokHtml(bt,'diff2');
  }
  return `<div class="lblhead" style="color:var(--fix)">final version (${verdict} by ${who}) — diff vs label</div>
          <div class="toks">${out}</div>`;
}
function lint(txt){
  const toks=tokenize(txt), bad=[], known=new Set([...CMDS,'|']);
  let sig=0;
  for(const t of toks){
    if(t.startsWith('\\')&&!known.has(t))bad.push(t);
    if(t==='\\sig')sig++; if(t==='\\sigend')sig--;
  }
  const msgs=[];
  if(bad.length)msgs.push(`unknown token(s): ${bad.join(' ')}`);
  if(sig!==0)msgs.push('\\sig / \\sigend unbalanced');
  for(const t of toks)
    if(!t.startsWith('\\')&&t!=='|'&&t!=='3'&&!/^r?[a-g]?[',]*\d{0,2}\.{0,2}$/.test(t)&&!/^[a-gr][',]*\d+\.?$/.test(t))
      {msgs.push(`odd token: ${t}`);break}
  // real-tokenizer id cost (the ≤59 promote gate): char-level except added tokens —
  // \commands and | are 1 id, a note is 1 id per character (d''16 = 5); +1 for EOS.
  const ids=toks.reduce((s,t)=>s+((t.startsWith('\\')||t==='|')?1:t.length),0)+1;
  if(ids>59)msgs.push(`OVER BUDGET: ${ids} ids > 59 — promote will reject (unwinnable strip: verdict bad)`);
  return {warn:msgs, n:toks.length, ids};
}

function rows(){ return S.queues.find(q=>q.id===qid).rows; }
function visible(){
  const re=$('freason').value, show=$('fshow').value;
  return rows().map((r,i)=>({r,i}))
    .filter(x=>(!re||x.r.reason===re)
      &&(show==='all'||(show==='pending'?!x.r.verdict
        :show==='claude'?x.r.by==='claude'
        :show==='rule'?(x.r.by||'').startsWith('rule')
        :!!x.r.verdict)));
}
function counts(q){const d=q.rows.filter(r=>r.verdict).length;return[d,q.rows.length];}

function renderTabs(){
  $('tabs').innerHTML=S.queues.map(q=>{
    const[d,t]=counts(q);
    return `<button class="tab${q.id===qid?' active':''}" data-q="${q.id}" ${t?'':'disabled'}>
              ${q.id}<span class="n">${d}/${t}</span></button>`;
  }).join('');
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{qid=b.dataset.q;idx=0;render();});
}
function renderFilter(){
  const rs=[...new Set(rows().map(r=>r.reason).filter(Boolean))].sort();
  const cur=$('freason').value;
  $('freason').innerHTML='<option value="">all reasons</option>'+
    rs.map(r=>`<option${r===cur?' selected':''}>${r}</option>`).join('');
}
function render(){
  renderTabs();renderFilter();
  const vis=visible();
  const[d,t]=counts(S.queues.find(q=>q.id===qid));
  $('barfill').style.width=t?100*d/t+'%':'0';
  if(!vis.length){$('viewer').style.display='none';$('empty').style.display='block';
    $('pos').textContent=`${d}/${t} done`;return}
  $('empty').style.display='none';$('viewer').style.display='block';
  idx=Math.max(0,Math.min(idx,vis.length-1));
  const{r}= vis[idx];
  $('pos').textContent=`${idx+1}/${vis.length} shown · ${d}/${t} done`;
  const v=(r.verdict?`<span class="badge b-${r.verdict}">${r.verdict}</span>`
                    :'<span class="badge b-pend">pending</span>')
          +(r.by?`<span class="badge b-reason">🤖 ${esc(r.by)}</span>`:'');
  $('meta').innerHTML=
    `${v} ${r.reason?`<span class="badge b-reason">${esc(r.reason)}</span>`:''}
     <span><b>${esc(r.strip)}</b></span>
     ${r.nd?`<span>nd <b>${r.nd}</b></span>`:''}
     ${r.min_logprob?`<span>min&nbsp;logp <b>${r.min_logprob}</b></span>`:''}`;
  $('strip').src='/img/'+encodeURIComponent(r.page)+'/'+encodeURIComponent(r.strip);
  $('labels').innerHTML=diffHtml(r.label,r.decoded)+
    (r.verdict&&r.verdict!=='bad'?corrHtml(r.label,r.corrected_label,r.by,r.verdict):'');
  editing=false;$('editbox').style.display='none';$('imgwrap').classList.remove('zoom');
  if(logOpen)renderLog();
}

let logOpen=false;
async function toggleLog(){
  logOpen=!logOpen;
  if(logOpen){ // prove it: reload verdicts from the CSVs on disk, not browser memory
    const s=await(await fetch('/api/state')).json();
    S.queues=s.queues;
  }
  renderLog();render();
}
function renderLog(){
  $('logcard').style.display=logOpen?'block':'none';
  if(!logOpen)return;
  const done=rows().map((r,i)=>({r,i})).filter(x=>x.r.verdict);
  $('logn').textContent=` · ${done.length} in ${qid}`;
  $('loglist').innerHTML=done.length?done.map(x=>
    `<div class="logrow" data-strip="${esc(x.r.strip)}">
       <span class="badge b-${x.r.verdict}">${x.r.verdict}</span>${x.r.by?`<span class="badge b-reason">🤖</span>`:''}
       <span class="mono">${esc(x.r.strip)}</span>
       <span class="mono" style="color:var(--mut)">${esc(solfText(x.r.corrected_label||'').slice(0,60))}</span>
     </div>`).join('')
   :'<div style="color:var(--mut);padding:8px">nothing verdicted in this queue yet</div>';
  document.querySelectorAll('.logrow').forEach(el=>el.onclick=()=>{
    $('fshow').value='all';
    const v=visible(),j=v.findIndex(x=>x.r.strip===el.dataset.strip);
    if(j>=0){idx=j;logOpen=false;renderLog();render();window.scrollTo(0,0);}
  });
}

async function post(strip,verdict,corrected){
  const res=await fetch('/api/verdict',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({queue:qid,strip,verdict,corrected})});
  const j=await res.json();
  if(!j.ok){toast('save failed: '+j.error);return false}
  const row=rows().find(r=>r.strip===strip);
  row.verdict=verdict;row.corrected_label=corrected;
  row.by='';   // human (re-)verdict clears the machine marker, mirroring the server
  return true;
}
function toast(m){const t=$('toast');t.textContent=m;t.style.opacity=1;
  clearTimeout(t._h);t._h=setTimeout(()=>t.style.opacity=0,1800);}
function cur(){const v=visible();return v.length?v[idx].r:null}

async function verdict(v){
  const r=cur();if(!r)return;
  if(editing){ // an open edit must never be silently discarded by a verdict click
    const txt=letterText($('edit').value.trim());
    const orig=tokenize(r.corrected_label||r.label||r.decoded).join(' ');
    if(v==='ok'&&txt&&txt!==orig){saveEdit();return} // edited, then "ok" -> they mean the fix
    editing=false;$('editbox').style.display='none';
  }
  const ok=await post(r.strip,v,v?r.corrected_label:'');
  if(!ok)return;
  toast(v?`${r.strip.split('_').slice(-2).join('_')} → ${v}`:'cleared');
  // pending / 🤖 filters: the row leaves the list, so idx already points at the next strip
  if(v&&!['pending','claude','rule'].includes($('fshow').value))idx++;
  render();
}
// edit-base builder: the model reads notes well but signatures badly, so the default
// "hybrid" takes \sig…\sigend from the (corrected) label and everything after from the decode.
// The model hallucinates triplet brackets from slurs, so decode-derived drafts drop
// \tup3/\tupend — but OPTIONALLY (checkbox): in the tup-* queues the decode's brackets are
// usually real, so the guard defaults OFF there and ON everywhere else; toggling it
// rebuilds the draft. Label drafts always keep their own tup3 tokens.
const stripTups=s=>$('striptup').checked?s.replace(/\\tup(3|end)\s*/g,''):s;
let lastBase='hybrid';
function baseText(r,mode){
  const lab=r.corrected_label||r.label, dec=stripTups(r.decoded||'');
  if(mode==='label')return lab||dec;
  if(mode==='decode')return dec||lab;
  if(!lab)return dec;
  if(!dec.trim())return lab;
  let sig='';
  const si=lab.indexOf('\\sig'), se=lab.indexOf('\\sigend');
  if(si>=0&&se>si)sig=lab.slice(si,se+7);
  let content=dec;
  const de=dec.indexOf('\\sigend');
  if(de>=0)content=dec.slice(de+7);
  return (sig?sig+' ':'')+content.trim();
}
function setBase(mode,preferCorrected){
  const r=cur();if(!r)return;
  lastBase=mode;
  $('edit').value=solfText(preferCorrected&&r.corrected_label?r.corrected_label:baseText(r,mode));
  $('edit').focus();lintNow();
}
let striptupQueue=null; // per-queue default: guard OFF in tup-* queues, ON elsewhere
function openEdit(){
  const r=cur();if(!r)return;
  if(striptupQueue!==qid){$('striptup').checked=!qid.startsWith('tup');striptupQueue=qid;}
  editing=true;$('editbox').style.display='block';
  setBase('hybrid',true); // an existing correction wins; the base buttons rebuild from scratch
}
function lintNow(){
  const{warn,n,ids}=lint(letterText($('edit').value));
  $('lint').innerHTML=warn.length?warn.map(w=>`<span class="warn">⚠ ${esc(w)}</span>`).join(' · ')
    :`<span class="fine">✓ ${n} tokens ≈ ${ids}/59 ids, looks well-formed (real gates re-run at promote)</span>`;
}
async function saveEdit(){
  const r=cur();if(!r)return;
  const txt=letterText($('edit').value.trim());
  if(!txt){toast('empty label — use ✗ bad instead');return}
  if(await post(r.strip,'fix',txt)){toast('saved as fix');idx++;render();}
}

document.addEventListener('keydown',e=>{
  if(editing){
    if(e.key==='Escape'){editing=false;$('editbox').style.display='none'}
    else if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();saveEdit()}
    return;
  }
  if(e.target.tagName==='SELECT'||e.target.tagName==='INPUT')return;
  const k=e.key.toLowerCase();
  if(k==='arrowright'||k===' '){e.preventDefault();idx++;render()}
  else if(k==='arrowleft'){idx--;render()}
  else if(k==='n'){const v=visible();const j=v.findIndex((x,i)=>i>idx&&!x.r.verdict);
                   idx=j>=0?j:v.findIndex(x=>!x.r.verdict);if(idx<0)idx=0;render()}
  else if(k==='a')verdict('ok');
  else if(k==='x')verdict('bad');
  else if(k==='u')verdict('');
  else if(k==='e')openEdit();
  else if(k==='z')$('imgwrap').classList.toggle('zoom');
  else if(k==='t'){const c=$('refcard');c.style.display=c.style.display==='none'?'block':'none'}
});
$('b-ok').onclick=()=>verdict('ok');$('b-bad').onclick=()=>verdict('bad');
$('b-clear').onclick=()=>verdict('');$('b-edit').onclick=openEdit;
$('b-prev').onclick=()=>{idx--;render()};$('b-next').onclick=()=>{idx++;render()};
$('b-pend').onclick=()=>{const v=visible();const j=v.findIndex(x=>!x.r.verdict);if(j>=0)idx=j;render()};
$('b-save').onclick=saveEdit;
$('base-h').onclick=()=>setBase('hybrid');
$('base-l').onclick=()=>setBase('label');
$('base-d').onclick=()=>setBase('decode');
$('striptup').onchange=()=>setBase(lastBase); // toggling rebuilds the draft from scratch
$('b-cancel').onclick=()=>{editing=false;$('editbox').style.display='none'};
$('imgwrap').onclick=()=>$('imgwrap').classList.toggle('zoom');
$('freason').onchange=()=>{idx=0;render()};$('fshow').onchange=()=>{idx=0;render()};
$('b-log').onclick=toggleLog;
$('b-ref').onclick=()=>{const c=$('refcard');c.style.display=c.style.display==='none'?'block':'none'};
$('edit').addEventListener('input',lintNow);

fetch('/api/state').then(r=>r.json()).then(s=>{
  S=s;CMDS=[...s.vocab].filter(t=>t.startsWith('\\')).sort((a,b)=>b.length-a.length);
  ACC=new Set(s.accidentals);
  qid=s.queues.find(q=>q.rows.length&&q.rows.some(r=>!r.verdict))?.id||s.queues[0].id;
  render();
});
</script></body></html>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=8377)
    ap.add_argument("--root", type=Path, default=REPO,
                    help="repo root override (testing)")
    args = ap.parse_args()
    Handler.root = args.root.resolve()
    build_full_audit(Handler.root)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"rung-3 review UI → http://127.0.0.1:{args.port}   (Ctrl-C to stop)")
    for qid, rel in QUEUES.items():
        _, rows = load_queue(Handler.root, qid)
        done = sum(1 for r in rows if r["verdict"])
        print(f"  {qid:12s} {done}/{len(rows)} verdicted")
    srv.serve_forever()


if __name__ == "__main__":
    main()
