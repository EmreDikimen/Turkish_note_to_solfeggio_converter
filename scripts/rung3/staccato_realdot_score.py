"""
Lever 6 clause 2: the no-regression read on REAL augmentation dots.

The primary (staccato_falsedot_score.py) asks whether the arm stopped inventing dots. This asks
the opposite question — whether it bought that by dropping the real ones. Gated on EASY+MID only
(pre-registered 2026-08-15, exclusion re-affirmed 2026-08-19); hard tier is decoded and printed
but never gated on.

The dot is a suffix inside a duration token, not a token of its own, so there is no per-class row
for it in eval_omr.py. Counted per strip and compared in both directions: dots the decode lost,
and dots it added. Paired per strip (greedy decode is deterministic and both checkpoints see the
same files), with an exact McNemar over the strips where exactly one side lost a dot.

Usage:
    .venv-ml/bin/python scripts/rung3/staccato_realdot_score.py \
        --checkpoint data/checkpoints/r3-stac-stage2-best \
        --compare    data/checkpoints/r3-tupnew-stage2-best
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from datetime import date
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "falsedot", Path(__file__).resolve().parent / "staccato_falsedot_score.py")
_fd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fd)

GATED = ("_realval_v2_easy", "_realval_v2_mid")
REPORTED = ("_realval_v2_hard",)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--compare", action="append", default=[])
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    import torch
    device = args.device or ("cuda" if torch.cuda.is_available()
                             else "mps" if torch.backends.mps.is_available() else "cpu")

    pools = GATED + REPORTED
    results: dict[str, dict] = {}
    for ckpt in [args.checkpoint, *args.compare]:
        model, processor, added = _fd.load_model_and_processor(ckpt)
        if added:
            print(f"WARNING: {added} project tokens were missing from {ckpt}")
        model.to(device).eval()
        print(f"== {ckpt} on {device}", flush=True)
        results[ckpt] = {}
        for pool in pools:
            rows = _fd.decode_pool(model, processor, f"data/real/rung3/{pool}",
                                   args.batch_size, args.max_length, device)
            results[ckpt][pool] = rows
        del model

    def tally(rows):
        gold = sum(r["gold_dots"] for r in rows)
        got = sum(r["hyp_dots"] for r in rows)
        lost = sum(max(0, r["gold_dots"] - r["hyp_dots"]) for r in rows)
        added = sum(max(0, r["hyp_dots"] - r["gold_dots"]) for r in rows)
        return gold, got, lost, added

    print(f"\n{'checkpoint':30} {'pool':20} {'gold':>5} {'decoded':>8} {'lost':>6} {'added':>6} {'kept':>7}")
    for ckpt, per_pool in results.items():
        for pool in pools:
            gold, got, lost, added = tally(per_pool[pool])
            tag = "" if pool in GATED else "   (reported, not gated)"
            print(f"{Path(ckpt).name:30} {pool:20} {gold:>5} {got:>8} {lost:>6} {added:>6} "
                  f"{(gold-lost)/max(1,gold):>6.1%}{tag}")
        gated_rows = [r for p in GATED for r in per_pool[p]]
        gold, got, lost, added = tally(gated_rows)
        print(f"{Path(ckpt).name:30} {'EASY+MID (the gate)':20} {gold:>5} {got:>8} {lost:>6} "
              f"{added:>6} {(gold-lost)/max(1,gold):>6.1%}")

    base = args.checkpoint
    for other in args.compare:
        for label, group in (("EASY+MID (the gate)", GATED), ("hard (reported)", REPORTED)):
            a = {r["image"]: r for p in group for r in results[base][p]}
            o = {r["image"]: r for p in group for r in results[other][p]}
            b = c = both = neither = 0
            for img, r in a.items():
                a_lost = r["gold_dots"] > r["hyp_dots"]
                o_lost = o[img]["gold_dots"] > o[img]["hyp_dots"]
                if a_lost and o_lost:
                    both += 1
                elif a_lost:
                    b += 1
                elif o_lost:
                    c += 1
                else:
                    neither += 1
            p = _fd.mcnemar_exact(b, c)
            print(f"\nstrips losing >=1 real dot, {label}: {Path(base).name} vs {Path(other).name}")
            print(f"   both {both} | only {Path(base).name} {b} | only {Path(other).name} {c} "
                  f"| neither {neither}")
            print(f"   exact McNemar p = {p:.4g}")

    if args.out:
        Path(args.out).write_text(json.dumps(
            {"date": date.today().isoformat(), "results": results}, indent=1))
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
