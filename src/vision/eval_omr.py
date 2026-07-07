"""
Rung 2 — generation eval: per-class AEU accidental accuracy (THE headline metric) + SER.

WHAT: run a fine-tuned checkpoint over held-out strips (val pieces of data/split.json),
greedy-decode each image, align prediction to ground truth in ID space (Levenshtein), and
report, per tracked token (the 8 AEU accidentals first, then \\natural / \\sig / repeat tokens
/ `|`): recall ("accuracy" = of the gold occurrences, how many the model got in place),
precision (of the predicted occurrences, how many were right), plus corpus SER
((S+D+I)/ref-len) and the exact-match rate.

WHY alignment, not counting: a strip where the model drops one note shifts everything after
it; naive position-wise comparison would count the whole tail wrong. Levenshtein alignment
charges one deletion and still credits the rest — the standard way OMR/ASR per-symbol metrics
are computed. Comparisons are in token-ID space (data.strip_special: string decode is lossy
around added tokens, ids are stable).

Usage:
    .venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/rung2/best
    # smoke: --limit 8 --device cpu; train-side sanity: --side train --limit 200
Results: printed table + a JSON line appended to <checkpoint>/eval.jsonl.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data import ADDED_TOKENS, StripDataset, strip_special
from modeling import load_model_and_processor

AEU = ADDED_TOKENS[:8]
TRACKED = ADDED_TOKENS  # AEU + \natural + \sig(end) + repeat tokens + | + 3


def align(ref: list[int], hyp: list[int]) -> list[tuple[str, int | None, int | None]]:
    """
    Levenshtein alignment; returns ops ("match"|"sub"|"del"|"ins", ref_id|None, hyp_id|None).
    Sequences are <=60 ids (the decoder budget), so the O(n*m) table is trivial.
    """
    n, m = len(ref), len(hyp)
    cost = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        cost[i][0] = i
    for j in range(1, m + 1):
        cost[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            same = ref[i - 1] == hyp[j - 1]
            cost[i][j] = min(cost[i - 1][j - 1] + (0 if same else 1),
                             cost[i - 1][j] + 1, cost[i][j - 1] + 1)
    ops: list[tuple[str, int | None, int | None]] = []
    i, j = n, m
    while i or j:
        if i and j and cost[i][j] == cost[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            ops.append(("match" if ref[i - 1] == hyp[j - 1] else "sub", ref[i - 1], hyp[j - 1]))
            i, j = i - 1, j - 1
        elif i and cost[i][j] == cost[i - 1][j] + 1:
            ops.append(("del", ref[i - 1], None))
            i -= 1
        else:
            ops.append(("ins", None, hyp[j - 1]))
            j -= 1
    return ops[::-1]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True, help="dir saved by train.py (best/last)")
    ap.add_argument("--strips-dir", default="data/synthetic/strips_v2_1")
    ap.add_argument("--split", default="data/split.json")
    ap.add_argument("--side", default="val", choices=["val", "train"])
    ap.add_argument("--limit", type=int, default=None, help="first N strips (smoke tests)")
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--show-errors", type=int, default=5, help="print the first N mismatching strips")
    args = ap.parse_args()

    import torch

    device = args.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    model, processor, added = load_model_and_processor(args.checkpoint)
    tok = processor.tokenizer
    if added:
        # a Rung-2 checkpoint must already contain the extended vocab — freshly-added ids
        # would have UNTRAINED embeddings and every score would be garbage
        print(f"WARNING: {added} project tokens were missing from {args.checkpoint} — is this the base model?")
    model.to(device).eval()

    split = json.loads(Path(args.split).read_text())
    ds = StripDataset(args.strips_dir, pieces=set(split[f"{args.side}_pieces"]))
    if args.limit:
        ds.strips = ds.strips[: args.limit]
    print(f"== eval: {len(ds)} {args.side} strips, checkpoint {args.checkpoint}, device {device}")

    tracked_ids = {tok.convert_tokens_to_ids(t): t for t in TRACKED}
    gold = Counter()   # per-token gold occurrences
    hit = Counter()    # aligned exact matches
    fp = Counter()     # predicted where gold has something else / nothing
    S = D = I = N = 0
    exact = 0
    shown = 0

    with torch.no_grad():
        for at in range(0, len(ds), args.batch_size):
            batch = [ds[i] for i in range(at, min(at + args.batch_size, len(ds)))]
            pixel_values = processor(images=[im for im, _ in batch], return_tensors="pt").pixel_values
            out = model.generate(pixel_values.to(device), max_length=args.max_length)
            for k, ((image, label), got_ids) in enumerate(zip(batch, out.tolist())):
                if got_ids and got_ids[0] == model.config.decoder_start_token_id:
                    got_ids = got_ids[1:]
                hyp = strip_special(got_ids, tok)
                ref = strip_special(tok(label, add_special_tokens=True).input_ids, tok)
                N += len(ref)
                exact += hyp == ref
                if hyp != ref and shown < args.show_errors:
                    shown += 1
                    print(f"   ✗ {ds.strips[at + k].image_path.name}")
                    print(f"     want: {label}")
                    print(f"     got : {tok.decode(got_ids, skip_special_tokens=True).strip()}")
                for op, r, h in align(ref, hyp):
                    if op == "match":
                        if r in tracked_ids:
                            gold[r] += 1
                            hit[r] += 1
                    elif op == "sub":
                        S += 1
                        if r in tracked_ids:
                            gold[r] += 1
                        if h in tracked_ids:
                            fp[h] += 1
                    elif op == "del":
                        D += 1
                        if r in tracked_ids:
                            gold[r] += 1
                    else:
                        I += 1
                        if h in tracked_ids:
                            fp[h] += 1
            print(f"   ... {min(at + args.batch_size, len(ds))}/{len(ds)}", end="\r")

    # ---- report ------------------------------------------------------------------------------
    print(f"\n\n{'token':<14}{'gold':>7}{'recall':>9}{'precision':>11}")
    per_class: dict[str, dict] = {}
    for tid, name in tracked_ids.items():
        g, h, f = gold[tid], hit[tid], fp[tid]
        rec = h / g if g else None
        prec = h / (h + f) if (h + f) else None
        per_class[name] = {"gold": g, "recall": rec, "precision": prec}
        fmt = lambda v: f"{v:8.1%}" if v is not None else "       —"
        print(f"{name:<14}{g:>7}{fmt(rec)} {fmt(prec)}")

    aeu_recalls = [per_class[t]["recall"] for t in AEU if per_class[t]["recall"] is not None]
    headline = sum(aeu_recalls) / len(aeu_recalls) if aeu_recalls else float("nan")
    ser = (S + D + I) / max(1, N)
    print(f"\n== HEADLINE  mean per-class AEU accidental accuracy: {headline:.1%}  (over {len(aeu_recalls)}/8 classes present)")
    print(f"== SER {ser:.3f}  (S={S} D={D} I={I} / N={N})   exact-match {exact}/{len(ds)} = {exact/len(ds):.1%}")

    row = {"date": date.today().isoformat(), "checkpoint": str(args.checkpoint), "side": args.side,
           "n": len(ds), "headline_aeu": headline, "ser": ser, "exact": exact / len(ds),
           "per_class": {k: v for k, v in per_class.items()}}
    out_path = Path(args.checkpoint) / "eval.jsonl"
    with out_path.open("a") as f:
        f.write(json.dumps(row) + "\n")
    print(f"[appended] {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
