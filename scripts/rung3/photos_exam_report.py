"""Build a self-contained HTML report of the photo-exam decode vs frozen gold.

For each gold strip (a short labeled measure), shows: the clean reference strip image, the GOLD
tokens, the PHOTO model decode (the fitting-aligned window), and a color-coded token diff
(match / substitution / deletion / insertion), accidentals badged. Images are base64-embedded so
the file is portable. Open the written path in a browser.

    .venv-ml/bin/python scripts/rung3/photos_exam_report.py
"""
from __future__ import annotations

import base64
import html
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from data import ADDED_TOKENS, strip_special   # noqa: E402
from eval_omr import AEU, TRACKED              # noqa: E402
import importlib.util
_spec = importlib.util.spec_from_file_location("s", str(Path(__file__).with_name("score_photos_exam.py")))
S = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(S)

GOLD_STRIP_DIR = Path("data/real/rung3/strips_exam_v2_clean")
OUT = Path("data/real/rung3/photos_exam_report.html")
ACCIDS = set(ADDED_TOKENS[:8])


def b64_img(path: Path) -> str:
    if not path.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def diff_html(ops, id2tok) -> tuple[str, int, int, int]:
    """Render alignment ops as colored spans. Returns (html, acc_gold, acc_hit, acc_err)."""
    out, ag, ah, ae = [], 0, 0, 0
    for op, r, h in ops:
        rt = id2tok(r) if r is not None else None
        ht = id2tok(h) if h is not None else None
        acc_r = rt in ACCIDS
        acc_h = ht in ACCIDS
        badge = " acc" if (acc_r or acc_h) else ""
        if op == "match":
            out.append(f'<span class="m{badge}">{html.escape(rt)}</span>')
            if acc_r: ag += 1; ah += 1
        elif op == "sub":
            out.append(f'<span class="s{badge}">{html.escape(rt)}&rarr;{html.escape(ht)}</span>')
            if acc_r: ag += 1; ae += 1
            if acc_h: ae += 1
        elif op == "del":
            out.append(f'<span class="d{badge}">{html.escape(rt)}</span>')
            if acc_r: ag += 1; ae += 1
        else:  # ins
            out.append(f'<span class="i{badge}">+{html.escape(ht)}</span>')
            if acc_h: ae += 1
    return " ".join(out), ag, ah, ae


def main() -> None:
    from transformers import AutoProcessor
    tok = AutoProcessor.from_pretrained(S.CKPT).tokenizer
    id2tok = lambda i: tok.convert_ids_to_tokens(i).replace("</w>", "") or "·"

    gold_rows = [json.loads(l) for l in open(S.GOLD)]
    by_page: dict[str, list] = {}
    for r in gold_rows:
        by_page.setdefault(r["page"], []).append(r)
    gold_stems = list(by_page)

    photo_ids, photo_meta = {}, {}
    for d in sorted(S.DECODE_ROOT.glob("*/")):
        dj = d / f"{d.name}_decode.json"
        if not dj.exists():
            continue
        strips = sorted(json.loads(dj.read_text())["strips"], key=lambda s: (s["system"], s["window"]))
        photo_ids[d.name] = strip_special(tok(" ".join(s["tokens"] for s in strips),
                                              add_special_tokens=True).input_ids, tok)
        photo_meta[d.name] = len(strips)

    sections, tot_ag, tot_ah, tot_ae = [], 0, 0, 0
    n_strips = 0
    for photo_stem in sorted(photo_ids):
        g = S.map_photo_to_gold(photo_stem, gold_stems)
        if g is None:
            continue
        ph = photo_ids[photo_stem]
        rows_html, p_ag, p_ah, p_ae = [], 0, 0, 0
        for r in sorted(by_page[g], key=lambda x: x["image"]):
            seg = strip_special(tok(r["label"], add_special_tokens=True).input_ids, tok)
            if not seg:
                continue
            n_strips += 1
            dist, ops = S.fitting_align(seg, ph)
            dh, ag, ah, ae = diff_html(ops, id2tok)
            got_ids = [h for _, _, h in ops if h is not None]              # model's decoded window
            got = tok.decode(got_ids, skip_special_tokens=True).strip()
            p_ag += ag; p_ah += ah; p_ae += ae
            img = b64_img(GOLD_STRIP_DIR / r["image"])
            imgtag = f'<img src="{img}" alt="strip">' if img else '<div class="noimg">no image</div>'
            ndist = dist / len(seg)
            qual = "ok" if ndist <= 0.5 else "bad"
            rows_html.append(f'''<div class="strip">
  <div class="thumb">{imgtag}</div>
  <div class="body">
    <div class="row"><span class="lbl">GOLD</span><code>{html.escape(r["label"])}</code></div>
    <div class="row"><span class="lbl got">GOT</span><code class="gotcode">{html.escape(got)}</code></div>
    <div class="row diff"><span class="lbl">DIFF</span><span>{dh}</span></div>
    <div class="meta {qual}">edit-dist {dist}/{len(seg)} ({ndist:.0%}) · accid gold {ag} hit {ah} err {ae}</div>
  </div></div>''')
        tot_ag += p_ag; tot_ah += p_ah; tot_ae += p_ae
        rec = f"{p_ah/p_ag:.0%}" if p_ag else "—"
        sections.append(f'''<section><h2>{html.escape(photo_stem)}
  <span class="pmeta">gold {g} · {photo_meta[photo_stem]} photo strips · accid recall {rec}</span></h2>
  {"".join(rows_html)}</section>''')

    rec = tot_ah / tot_ag if tot_ag else 0
    summary = (f"{n_strips} gold strips over {len(sections)} pages · "
               f"accidental hits {tot_ah}/{tot_ag} (recall {rec:.0%}) · errors {tot_ae}")
    doc = f'''<!doctype html><html><head><meta charset="utf-8">
<title>Photo-exam decode report</title><style>
body{{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#0f1115;color:#e6e6e6}}
header{{position:sticky;top:0;background:#161a20;padding:14px 20px;border-bottom:1px solid #2a2f37;z-index:2}}
header h1{{margin:0 0 4px;font-size:18px}} header .sum{{color:#9aa4b2;font-size:13px}}
.legend span{{display:inline-block;margin-right:12px;font-size:12px}}
section{{padding:8px 20px 20px}} h2{{font-size:14px;color:#cdd6e0;border-top:1px solid #2a2f37;padding-top:14px}}
.pmeta{{font-weight:400;color:#8b95a3;font-size:12px;margin-left:8px}}
.strip{{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #1e232b}}
.thumb{{flex:0 0 360px}} .thumb img{{width:360px;background:#fff;border-radius:4px}}
.noimg{{width:360px;height:40px;background:#22272f;color:#666;display:flex;align-items:center;justify-content:center;border-radius:4px}}
.body{{flex:1;min-width:0}} .row{{display:flex;gap:8px;margin:2px 0;align-items:baseline}}
.lbl{{flex:0 0 40px;color:#6b7280;font-size:11px;font-weight:600}} .lbl.got{{color:#6aa9ff}}
code{{font:12px/1.5 ui-monospace,Menlo,monospace;color:#c9d1d9;white-space:pre-wrap;word-break:break-word}}
code.gotcode{{color:#9fc6ff}}
.diff span span{{padding:1px 3px;border-radius:3px;margin:0 1px;font:12px ui-monospace,Menlo,monospace;display:inline-block}}
.m{{color:#8b95a3}} .s{{background:#5a1e1e;color:#ffb3b3}} .d{{background:#4a1f0a;color:#ffc99a;text-decoration:line-through}}
.i{{background:#3a2f0a;color:#ffe08a}} .acc{{outline:1px solid #6aa9ff;font-weight:700}}
.meta{{font-size:11px;color:#7b8494;margin-top:3px}} .meta.bad{{color:#ff9a7a}}
</style></head><body>
<header><h1>Photo-exam decode vs frozen gold</h1><div class="sum">{html.escape(summary)}</div>
<div class="legend"><span style="color:#6b7280">GOLD</span>=ground-truth label ·
<span style="color:#6aa9ff">GOT</span>=model decode (from photo) · DIFF: <span class="m">match</span>
<span><span class="s">gold&rarr;got</span> substitution</span>
<span><span class="d">gold</span> deleted (missed)</span>
<span><span class="i">+got</span> inserted (extra)</span>
<span><span class="m acc">accidental</span> (blue outline = AEU-scored)</span></div></header>
{"".join(sections)}
</body></html>'''
    OUT.write_text(doc)
    print(f"wrote {OUT}  ({n_strips} strips, {len(sections)} pages)")


if __name__ == "__main__":
    main()
