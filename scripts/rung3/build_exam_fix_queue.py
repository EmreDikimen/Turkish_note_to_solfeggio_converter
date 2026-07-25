"""Build a review-UI queue of EVERY frozen Round-1 exam gold strip, for auditing gold-label errors.

This IS the Round-1 exam (strips_exam_v2_clean = the v2.1 frozen exam it was scored on). The domain
expert suspects some strips FAILED the model not because the model misread them but because the GOLD
label is wrong (komaSharp/kucukSharp confirmed; possibly spurious | / \tie). This stages all strips
into a review_ui.py queue with the model's EXACT per-strip decode (decoding each frozen strip image
directly with round1-best — the same model/graphs the exam used) so the label can be checked against
what the model actually said + the image.

`reason` (strict per-strip align of gold vs decode) sorts prime suspects first:
  accid-diff  an accidental differs (gold vs decode)   diff  other tokens differ   (blank) exact match

Corrections land in `corrected_label`; apply_exam_fix.py folds them into the manifest before re-run.

    .venv-ml/bin/python scripts/rung3/build_exam_fix_queue.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from data import ADDED_TOKENS, strip_special      # noqa: E402
from eval_omr import align                         # noqa: E402
from decode_page import load_runtime               # noqa: E402
from onnx_parity import onnx_greedy_decode         # noqa: E402
from PIL import Image                              # noqa: E402

CKPT = "data/checkpoints/round1-best"
ONNX = "data/checkpoints/round1-best-onnx"
GOLD = "data/real/rung3/strips_exam_v2_clean/manifest.jsonl"
STRIP_DIR = Path("data/real/rung3/strips_exam_v2_clean")
OUT = Path("data/real/rung3/strips_exam_v2_clean/exam_fix.csv")
ACC = set(ADDED_TOKENS[:8])


def main() -> None:
    # carry over any verdicts already made in the queue (keyed by strip) — never lose review work
    prior: dict[str, dict] = {}
    if OUT.exists():
        for r in csv.DictReader(open(OUT)):
            if r.get("verdict"):
                prior[r["strip"]] = {"verdict": r["verdict"],
                                     "corrected_label": r.get("corrected_label", ""),
                                     "by": r.get("by", "")}
        print(f"carrying over {len(prior)} existing verdicts")

    rt = load_runtime(CKPT, ONNX, "_int8")
    tok = rt.tok
    acc_ids = {tok.convert_tokens_to_ids(t) for t in ACC}
    gold_rows = [json.loads(l) for l in open(GOLD)]

    rows = []
    for i, r in enumerate(gold_rows, 1):
        img_path = STRIP_DIR / r["image"]
        decoded, reason = "", "no-image"
        if img_path.exists():
            img = Image.open(img_path).convert("RGB")
            pv = rt.processor(images=img, return_tensors="pt").pixel_values.numpy()
            ids, *_ = onnx_greedy_decode(rt.sessions, pv, rt.start_id, rt.eos_id)
            decoded = tok.decode(ids, skip_special_tokens=True).strip()
            ref = strip_special(tok(r["label"], add_special_tokens=True).input_ids, tok)
            hyp = strip_special(ids, tok)
            ops = align(ref, hyp)
            if any(op != "match" and (rr in acc_ids or hh in acc_ids) for op, rr, hh in ops):
                reason = "accid-diff"
            elif any(op != "match" for op, _, _ in ops):
                reason = "diff"
            else:
                reason = ""
        pv_prior = prior.get(r["image"], {})
        rows.append({
            "piece": r.get("piece", ""), "page": r["page"], "strip": r["image"],
            "nd": r.get("nd", ""), "min_logprob": r.get("min_logprob", ""),
            "reason": reason, "label": r["label"], "decoded": decoded,
            "verdict": pv_prior.get("verdict", ""),
            "corrected_label": pv_prior.get("corrected_label", ""),
            "by": pv_prior.get("by", ""),
        })
        if i % 50 == 0:
            print(f"  decoded {i}/{len(gold_rows)}")

    order = {"accid-diff": 0, "diff": 1, "": 2, "no-image": 3}
    rows.sort(key=lambda x: (order[x["reason"]], x["page"], x["strip"]))
    fields = ["piece", "page", "strip", "nd", "min_logprob", "reason",
              "label", "decoded", "verdict", "corrected_label", "by"]
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    from collections import Counter
    c = Counter(r["reason"] for r in rows)
    print(f"wrote {OUT}  ({len(rows)} strips)")
    print(f"  by reason: accid-diff={c['accid-diff']}  diff={c['diff']}  match={c['']}  no-image={c['no-image']}")


if __name__ == "__main__":
    main()
