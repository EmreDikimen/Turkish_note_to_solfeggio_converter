"""Score the model on the HAND-VERIFIED photo strips (photo_gold.csv) — the direct photo AEU.

Unlike score_photos_exam.py (which fit the curated clean gold onto the photo decode, an estimate),
this scores each photo strip against the expert's own verified label, strict per-strip (eval_omr
alignment) — the honest photo-domain number.

Per strip: truth = corrected_label if verdict=fix else label (label was seeded = model decode, so
verdict=ok means the model was right). hyp = the model's decode (the seeded `decoded` column, never
changed by the UI). verdict=bad (unreadable, no ground truth) and pending are excluded. Reports the
AEU accidental headline separately from | and \tie (which the pipeline can re-derive downstream).

    .venv-ml/bin/python scripts/rung3/score_photo_gold.py
"""
from __future__ import annotations

import csv
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from data import strip_special          # noqa: E402
from eval_omr import AEU, TRACKED, align  # noqa: E402

CKPT = "data/checkpoints/round1-best"
CSV = Path("data/real/rung3/photos_exam_strips/photo_gold.csv")


def main() -> None:
    from transformers import AutoProcessor
    tok = AutoProcessor.from_pretrained(CKPT).tokenizer
    tracked_ids = {tok.convert_tokens_to_ids(t): t for t in TRACKED}

    rows = list(csv.DictReader(open(CSV)))
    scorable = [r for r in rows if r["verdict"] in ("ok", "fix")]

    gold, hit, fp = Counter(), Counter(), Counter()
    # Recall bucketed by where the accidental is PRINTED — the signature block and the notehead are
    # different reading tasks, and the microtonal sharps sit almost entirely in the first
    # (docs/METRICS.md). `\sig` opens the block, `\sigend` closes it; ops run in reference order.
    pos_gold, pos_hit = Counter(), Counter()
    sig_ids = {tok.convert_tokens_to_ids(t): t for t in ("\\sig", "\\sigend")}
    S = D = I = exact = 0
    for r in scorable:
        truth = r["corrected_label"] if (r["verdict"] == "fix" and r["corrected_label"].strip()) else r["label"]
        ref = strip_special(tok(truth, add_special_tokens=True).input_ids, tok)
        hyp = strip_special(tok(r["decoded"], add_special_tokens=True).input_ids, tok)
        exact += ref == hyp
        in_sig = False
        for op, rr, hh in align(ref, hyp):
            if op != "ins" and rr in sig_ids:
                in_sig = sig_ids[rr].endswith("sig")
            bucket = "sig" if in_sig else "inline"
            if op == "match":
                if rr in tracked_ids:
                    gold[rr] += 1; hit[rr] += 1
                    pos_gold[(bucket, rr)] += 1; pos_hit[(bucket, rr)] += 1
            elif op == "sub":
                S += 1
                if rr in tracked_ids:
                    gold[rr] += 1; pos_gold[(bucket, rr)] += 1
                if hh in tracked_ids: fp[hh] += 1
            elif op == "del":
                D += 1
                if rr in tracked_ids:
                    gold[rr] += 1; pos_gold[(bucket, rr)] += 1
            else:
                I += 1
                if hh in tracked_ids: fp[hh] += 1

    def line(t):
        tid = tok.convert_tokens_to_ids(t)
        g, h, f = gold[tid], hit[tid], fp[tid]
        rec = h / g if g else None
        prec = h / (h + f) if (h + f) else None
        f1 = (2 * rec * prec / (rec + prec)) if (rec and prec) else (0.0 if (rec is not None and prec is not None) else None)
        s = lambda x: f"{x:.0%}" if x is not None else "  -"
        print(f"{t:<14}{g:>6}{s(rec):>9}{s(prec):>9}{s(f1):>8}")
        return rec, f1

    print(f"scored {len(scorable)} hand-verified photo strips (ok+fix; bad/pending excluded)\n")
    print(f"{'token':<14}{'gold':>6}{'recall':>9}{'prec':>9}{'f1':>8}")
    recs, f1s = [], []
    for t in AEU:
        rec, f1 = line(t)
        if rec is not None:
            recs.append(rec)
            if f1 is not None: f1s.append(f1)
    print("  " + "-" * 40)
    for t in ("\\natural", "|", "\\tie"):   # shown but NOT in the AEU headline
        line(t)
    print(f"\n{'token':<14}{'sig gold':>9}{'sig rec':>9}{'inline gold':>12}{'inline rec':>11}")
    for t in AEU:
        tid = tok.convert_tokens_to_ids(t)
        sg, sh = pos_gold[("sig", tid)], pos_hit[("sig", tid)]
        ig, ih = pos_gold[("inline", tid)], pos_hit[("inline", tid)]
        if not (sg or ig):
            continue
        f = lambda g, h: f"{h / g:.0%}" if g else "-"
        print(f"{t:<14}{sg:>9}{f(sg, sh):>9}{ig:>12}{f(ig, ih):>11}")
    head = sum(recs) / len(recs) if recs else float("nan")
    hf1 = sum(f1s) / len(f1s) if f1s else float("nan")
    print(f"\n== PHOTO-GOLD AEU (direct, hand-verified): recall {head:.1%} / F1 {hf1:.1%}  "
          f"(over {len(recs)}/8 classes)")
    print(f"   exact-match {exact}/{len(scorable)} = {exact/len(scorable):.0%}  |  edits S={S} D={D} I={I}")
    print("   (| and \\tie above are excluded from the AEU headline — downstream re-derivable)")


if __name__ == "__main__":
    main()
