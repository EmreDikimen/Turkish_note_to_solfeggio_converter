"""Focused adjudication report for the komaSharp / kucukSharp gold-vs-model disagreements.

The domain expert flagged that where gold says komaSharp/kucukSharp the model is often right and the
gold wrong. For every gold strip whose label contains one of those tokens, this shows the clean
reference image, the GOLD label, and what the model decoded from BOTH the clean render and the photo
(fitting-aligned windows). If clean-GOT and photo-GOT agree with each other but disagree with GOLD,
that's strong evidence the gold is the error. Sharps are highlighted. Adjudicate visually.

    .venv-ml/bin/python scripts/rung3/sharp_adjudication_report.py
"""
from __future__ import annotations

import base64
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from data import strip_special                # noqa: E402
import importlib.util
_spec = importlib.util.spec_from_file_location("s", str(Path(__file__).with_name("score_photos_exam.py")))
S = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(S)

PHOTO_ROOT = Path("data/real/rung3/photos_exam_strips")
CLEAN_ROOT = Path("data/real/rung3/clean_pages_strips")
GOLD_STRIP_DIR = Path("data/real/rung3/strips_exam_v2_clean")
OUT = Path("data/real/rung3/sharp_adjudication.html")
FOCUS = ("\\komaSharp", "\\kucukSharp")
SHARPS = {"\\komaSharp", "\\kucukSharp", "\\bakiyeSharp", "\\buyukSharp"}


def b64(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode() if path.exists() else ""


def load_streams(root: Path, tok):
    out = {}
    for d in sorted(root.glob("*/")):
        dj = d / f"{d.name}_decode.json"
        if not dj.exists():
            continue
        st = sorted(json.loads(dj.read_text())["strips"], key=lambda s: (s["system"], s["window"]))
        out[d.name] = strip_special(tok(" ".join(s["tokens"] for s in st), add_special_tokens=True).input_ids, tok)
    return out


def hl(text: str) -> str:
    """Bold+color the sharp tokens in a plain token string."""
    esc = html.escape(text)
    for s in SHARPS:
        cls = "focus" if s in FOCUS else "other"
        esc = esc.replace(html.escape(s), f'<b class="{cls}">{html.escape(s)}</b>')
    return esc


def got_window(gold_seg, stream, tok) -> str:
    _, ops = S.fitting_align(gold_seg, stream)
    ids = [h for _, _, h in ops if h is not None]
    return tok.decode(ids, skip_special_tokens=True).strip()


def main() -> None:
    from transformers import AutoProcessor
    tok = AutoProcessor.from_pretrained(S.CKPT).tokenizer
    photo = load_streams(PHOTO_ROOT, tok)
    clean = load_streams(CLEAN_ROOT, tok)

    gold_rows = [json.loads(l) for l in open(S.GOLD)]
    by_page: dict[str, list] = {}
    for r in gold_rows:
        by_page.setdefault(r["page"], []).append(r)
    gold_stems = list(by_page)

    # photo/clean pages share the same '<...>_ppK' naming -> same gold via map
    def stream_for(gold_stem, table):
        for name in table:
            if S.map_photo_to_gold(name, gold_stems) == gold_stem:
                return table[name]
        return None

    cards, n = [], 0
    agree_vs_gold = 0
    for gp, rows in by_page.items():
        cs = stream_for(gp, clean)
        ps = stream_for(gp, photo)
        for r in rows:
            if not any(f in r["label"] for f in FOCUS):
                continue
            seg = strip_special(tok(r["label"], add_special_tokens=True).input_ids, tok)
            if not seg:
                continue
            n += 1
            gc = got_window(seg, cs, tok) if cs is not None else "(no clean page)"
            gpw = got_window(seg, ps, tok) if ps is not None else "(no photo page)"
            # heuristic flag: clean & photo both emit a focus sharp that gold's focus sharp differs from
            g_focus = [t for t in FOCUS if t in r["label"]]
            both = cs is not None and ps is not None
            clean_photo_agree = both and (gc == gpw)
            disagree_gold = both and clean_photo_agree and any(
                (f in gc) != (f in r["label"]) for f in FOCUS)
            if disagree_gold:
                agree_vs_gold += 1
            flag = ' <span class="flag">clean&amp;photo agree, differ from gold</span>' if disagree_gold else ""
            img = b64(GOLD_STRIP_DIR / r["image"])
            imgtag = f'<img src="{img}">' if img else '<div class="noimg">no image</div>'
            cards.append(f'''<div class="card{' hot' if disagree_gold else ''}">
  <div class="thumb">{imgtag}</div>
  <div class="body">
    <div class="pg">{html.escape(r["image"])}{flag}</div>
    <div class="row"><span class="k">GOLD</span><code>{hl(r["label"])}</code></div>
    <div class="row"><span class="k cl">GOT·clean</span><code>{hl(gc)}</code></div>
    <div class="row"><span class="k ph">GOT·photo</span><code>{hl(gpw)}</code></div>
  </div></div>''')

    doc = f'''<!doctype html><html><head><meta charset="utf-8"><title>komaSharp/kucukSharp adjudication</title><style>
body{{font:14px/1.5 -apple-system,Segoe UI,sans-serif;margin:0;background:#0f1115;color:#e6e6e6}}
header{{position:sticky;top:0;background:#161a20;padding:14px 20px;border-bottom:1px solid #2a2f37}}
h1{{margin:0 0 4px;font-size:17px}} .sum{{color:#9aa4b2;font-size:13px}}
.card{{display:flex;gap:14px;padding:12px 20px;border-bottom:1px solid #1e232b}}
.card.hot{{background:#1a1410}}
.thumb{{flex:0 0 380px}} .thumb img{{width:380px;background:#fff;border-radius:4px}}
.noimg{{width:380px;height:44px;background:#22272f;color:#666;display:flex;align-items:center;justify-content:center}}
.body{{flex:1;min-width:0}} .pg{{font-size:11px;color:#7b8494;margin-bottom:4px}}
.row{{display:flex;gap:8px;align-items:baseline;margin:2px 0}}
.k{{flex:0 0 78px;font-size:11px;font-weight:700;color:#6b7280}} .k.cl{{color:#8fce8f}} .k.ph{{color:#6aa9ff}}
code{{font:12px/1.5 ui-monospace,Menlo,monospace;color:#c9d1d9;white-space:pre-wrap;word-break:break-word}}
b.focus{{color:#ffd166;background:#4a3a0a;padding:0 3px;border-radius:3px}} b.other{{color:#c9d1d9}}
.flag{{color:#ffb15c;font-weight:700;margin-left:8px}}
</style></head><body>
<header><h1>komaSharp / kucukSharp — gold vs model (clean &amp; photo)</h1>
<div class="sum">{n} gold strips containing a focus sharp · {agree_vs_gold} where clean&amp;photo model AGREE with each other but DIFFER from gold (highlighted) · yellow = focus sharp</div></header>
{"".join(cards)}
</body></html>'''
    OUT.write_text(doc)
    print(f"wrote {OUT}  ({n} focus-sharp gold strips, {agree_vs_gold} flagged clean&photo-agree-vs-gold)")


if __name__ == "__main__":
    main()
