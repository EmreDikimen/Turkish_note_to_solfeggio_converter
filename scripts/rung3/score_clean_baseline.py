"""Clean-render fitting-alignment baseline — the fair comparison for the photo-exam AEU.

Renders each exam PDF's pages, slices + decodes them with the SAME improved slicer and round1-best
model, then scores with the SAME per-gold-strip fitting alignment score_photos_exam uses. Because
photo AEU and this clean AEU are computed identically, clean - photo = the true photo-domain penalty
(unlike the strict-per-strip eval_omr number, which the lenient fitting method isn't comparable to).

Pages are named '<pdfstem>_ppK' so score_photos_exam.map_photo_to_gold reuses the exam gold mapping.

    .venv-ml/bin/python scripts/rung3/score_clean_baseline.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from data import strip_special                # noqa: E402
from eval_omr import AEU, TRACKED             # noqa: E402
from decode_page import load_runtime, decode_page  # noqa: E402
import importlib.util
_spec = importlib.util.spec_from_file_location("s", str(Path(__file__).with_name("score_photos_exam.py")))
S = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(S)

PDF_DIR = Path("data/real/rung3/photo_exam_pdfs")
RENDER_DIR = Path("data/real/rung3/_clean_pages")
DECODE_ROOT = Path("data/real/rung3/clean_pages_strips")
DPI = 200


def render_pages() -> list[Path]:
    import fitz
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    pngs = []
    for pdf in sorted(PDF_DIR.glob("*.pdf")):
        if pdf.stem.startswith("00_"):
            continue
        doc = fitz.open(pdf)
        for i in range(len(doc)):
            out = RENDER_DIR / f"{pdf.stem}_pp{i+1}.png"
            if not out.exists():
                doc[i].get_pixmap(dpi=DPI).save(out)
            pngs.append(out)
    return pngs


def main() -> None:
    pngs = render_pages()
    print(f"rendered/collected {len(pngs)} clean pages")
    rt = load_runtime(S.CKPT, "data/checkpoints/round1-best-onnx", "_int8")
    for p in pngs:
        try:
            decode_page(p, rt, out_root=DECODE_ROOT, debug=False, verbose=False)
        except RuntimeError:
            pass

    tok = rt.tok
    tracked_ids = {tok.convert_tokens_to_ids(t): t for t in TRACKED}
    gold_rows = [json.loads(l) for l in open(S.GOLD)]
    by_page: dict[str, list] = {}
    for r in gold_rows:
        by_page.setdefault(r["page"], []).append(r)
    gold_stems = list(by_page)

    gold, hit, fp = Counter(), Counter(), Counter()
    # Recall split by where the accidental is PRINTED (signature block vs notehead) — see
    # S.tally's docstring for why the pooled number can't answer that question.
    pos_gold, pos_hit = Counter(), Counter()
    sig_ids = {tok.convert_tokens_to_ids(t): t for t in ("\\sig", "\\sigend")}
    matched = 0
    for d in sorted(DECODE_ROOT.glob("*/")):
        dj = d / f"{d.name}_decode.json"
        if not dj.exists():
            continue
        g = S.map_photo_to_gold(d.name, gold_stems)
        if g is None:
            continue
        matched += 1
        strips = sorted(json.loads(dj.read_text())["strips"], key=lambda s: (s["system"], s["window"]))
        ph = strip_special(tok(" ".join(s["tokens"] for s in strips), add_special_tokens=True).input_ids, tok)
        for r in by_page[g]:
            seg = strip_special(tok(r["label"], add_special_tokens=True).input_ids, tok)
            if not seg:
                continue
            _, ops = S.fitting_align(seg, ph)
            S.tally(ops, tracked_ids, gold, hit, fp, pos_gold, pos_hit, sig_ids)

    print(f"\nmatched {matched} clean pages to gold")
    print(f"{'token':<14}{'gold':>7}{'recall':>9}{'prec':>9}{'f1':>8}")
    recs, f1s = [], []
    for t in TRACKED:
        tid = tok.convert_tokens_to_ids(t)
        gg, hh, ff = gold[tid], hit[tid], fp[tid]
        rec = hh / gg if gg else None
        prec = hh / (hh + ff) if (hh + ff) else None
        f1 = (2 * rec * prec / (rec + prec)) if (rec and prec) else (0.0 if (rec is not None and prec is not None) else None)
        if t in AEU and rec is not None:
            recs.append(rec)
            if f1 is not None: f1s.append(f1)
        if t in AEU or gg:
            print(f"{t:<14}{gg:>7}{(f'{rec:.0%}' if rec is not None else '-'):>9}"
                  f"{(f'{prec:.0%}' if prec is not None else '-'):>9}{(f'{f1:.0%}' if f1 is not None else '-'):>8}")
    S.print_position_split(tok, pos_gold, pos_hit, AEU)
    print(f"\n== CLEAN-FITTING AEU recall {sum(recs)/len(recs):.1%} / F1 {sum(f1s)/len(f1s):.1%}"
          f"  (over {len(recs)}/8 classes)")
    print("   compare to PHOTO-FITTING AEU recall 61.1% / F1 75.0% -> gap = photo-domain penalty")


if __name__ == "__main__":
    main()
