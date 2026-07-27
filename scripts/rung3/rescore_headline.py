#!/usr/bin/env python3
"""Re-score any PAST eval run under the low-n-robust headlines, without re-running the model.

WHY: the AEU headline is a per-class MEAN, so a class with a handful of gold tokens counts as much
as one with hundreds. That has now distorted two consecutive exam reads in opposite directions —
a 3-gold class dropping out of the mean lifted Round 1 by ~11pp, and a 14-gold class flipping cost
Round 2 ~4pp — neither of which was the model reading better or worse. `eval_omr.py` now reports
MICRO (pool tokens, not classes) and MACRO>=N beside it, but every run logged before 2026-07-27
only has the macro numbers.

It does not need the model: `eval.jsonl` stores per-class gold/recall/precision, and hits and false
positives follow from those, so every historical run can be re-scored exactly.

  hits = gold * recall            fp = hits/precision - hits      (precision > 0)

Usage:
    .venv-ml/bin/python scripts/rung3/rescore_headline.py data/checkpoints/*/eval.jsonl
        [--strips-dir-filter exam]   only rows whose strips_dir contains this
        [--min-n 30]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent.parent / "src"
sys.path.insert(0, str(SRC / "vision"))

from data import ADDED_TOKENS  # noqa: E402

AEU = ADDED_TOKENS[:8]


def rescore(per_class: dict, min_n: int) -> dict:
    """Micro (token-pooled) and macro>=N recall/F1 from a stored per-class block."""
    tot_gold = tot_hit = tot_fp = 0
    strong = []
    for t in AEU:
        c = per_class.get(t)
        if not c or not c.get("gold"):
            continue
        g = c["gold"]
        rec, prec = c.get("recall"), c.get("precision")
        if rec is None:
            continue
        h = round(g * rec)
        tot_gold += g
        tot_hit += h
        # A class can have gold and hits but no precision entry only if nothing was predicted.
        if prec:
            tot_fp += round(h / prec) - h
        if g >= min_n:
            strong.append(t)
    micro_r = tot_hit / tot_gold if tot_gold else float("nan")
    micro_p = tot_hit / (tot_hit + tot_fp) if (tot_hit + tot_fp) else float("nan")
    micro_f1 = 2 * micro_r * micro_p / (micro_r + micro_p) if (micro_r and micro_p) else float("nan")
    mac_r = sum(per_class[t]["recall"] for t in strong) / len(strong) if strong else float("nan")
    mac_f1 = sum(per_class[t]["f1"] for t in strong) / len(strong) if strong else float("nan")
    return {"micro_recall": micro_r, "micro_precision": micro_p, "micro_f1": micro_f1,
            "micro_gold": tot_gold, "macro_n_recall": mac_r, "macro_n_f1": mac_f1,
            "n_classes": len(strong), "classes": strong}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("logs", nargs="+", help="eval.jsonl paths (globs are fine)")
    ap.add_argument("--strips-dir-filter", default=None,
                    help="only rows whose strips_dir contains this substring (e.g. 'exam')")
    ap.add_argument("--min-n", type=int, default=30)
    args = ap.parse_args()

    print(f"{'checkpoint':<34}{'set':<26}{'n':>5}"
          f"{'macro R':>9}{'macro F1':>10}{'micro R':>9}{'micro F1':>10}"
          f"{'macro' + str(args.min_n) + '+ R':>12}{'F1':>8}  classes")
    for path in args.logs:
        for line in Path(path).read_text().splitlines():
            if not line.strip():
                continue
            d = json.loads(line)
            sd = d.get("strips_dir", "")
            if args.strips_dir_filter and args.strips_dir_filter not in sd:
                continue
            pc = d.get("per_class")
            if not pc:
                continue
            r = rescore(pc, args.min_n)
            ck = Path(d.get("checkpoint", "?")).name
            parent = Path(d.get("checkpoint", "?")).parent.name
            f = lambda v: f"{v:.1%}" if v == v else "—"  # NaN-safe
            print(f"{(parent + '/' + ck)[:33]:<34}{Path(sd).name[:25]:<26}{d.get('n', 0):>5}"
                  f"{f(d.get('headline_aeu') or float('nan')):>9}{f(d.get('headline_f1') or float('nan')):>10}"
                  f"{f(r['micro_recall']):>9}{f(r['micro_f1']):>10}"
                  f"{f(r['macro_n_recall']):>12}{f(r['macro_n_f1']):>8}  {r['n_classes']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
