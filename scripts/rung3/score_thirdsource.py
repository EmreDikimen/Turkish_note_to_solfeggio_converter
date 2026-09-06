#!/usr/bin/env python3
"""Round 4 step 4 — read the third-source probe, one column per engraving house.

The question is not "what is the accuracy" — 36 pieces cannot support that. It is **does the model
collapse on an engraving house it has never seen?** ([docs/rung3/third-source.md](../../docs/rung3/third-source.md)).
So two readings are printed, and the first one needs no gold at all:

  1. **YIELD, which is label-free.** The emitter keeps a strip only when the model's decode aligns
     with the SymbTr-derived label (`nd <= accept_nd`). On a source the model cannot read, alignment
     fails and the accepted share craters. That share is directly comparable with `strips_b8`'s own,
     because it is the same pipeline at the same thresholds. ⚠ It is a JOINT measure of the model
     and the slicer, which is the point: a user meets both.

  2. **EDITS PER STRIP on the accepted rows**, decoded with the checkpoint under test. ⛔ This is
     **biased low, by construction**: the accepted rows are the ones that already agreed with a
     model. It is quoted as a floor and never as the error rate, and it is only comparable across
     COLUMNS of this same probe, never against `_realval_v2`, whose gold was hand-read.

⚠ **The label-producing model and the graded model must differ.** Labels here come from
`round2-stage2-best`, the model that built `strips_b8`; the graded one defaults to Run A
`r3a-stage2-best-real`. Grading a model on labels it voted for measures agreement, not accuracy —
the same rule the exam's `\\sig` hint follows (CLAUDE.md).

    .venv-ml/bin/python scripts/rung3/score_thirdsource.py
    .venv-ml/bin/python scripts/rung3/score_thirdsource.py --ckpt data/checkpoints/round2-stage2-best
"""
from __future__ import annotations

import argparse
import collections
import csv
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src/vision"))
sys.path.insert(0, str(ROOT / "scripts/rung3"))

T = ROOT / "data/real/rung3/_thirdsource"
SOURCES = ("sahaney", "erdincbal", "blogspot")


def source_of(name: str) -> str:
    for s in SOURCES:
        if f"_{s}" in name:
            return s
    return "?"


def sliced_counts() -> dict[str, int]:
    """Strips the SLICER produced, per source — the denominator yield is measured against."""
    out: collections.Counter = collections.Counter()
    for d in (T / "strips_probe").iterdir():
        if not d.is_dir():
            continue
        m = list(d.glob("*_manifest.json"))
        if m:
            out[source_of(d.name)] += len(json.loads(m[0].read_text()))
    return dict(out)


def emit_tables() -> tuple[dict, dict, dict]:
    emit = T / "emit"
    man = [json.loads(l) for l in (emit / "manifest.jsonl").read_text().splitlines() if l.strip()]
    accepted: collections.Counter = collections.Counter()
    nds: dict[str, list[float]] = collections.defaultdict(list)
    for r in man:
        s = source_of(r["image"])
        accepted[s] += 1
        nds[s].append(float(r.get("nd", 0)))
    drops: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for r in csv.DictReader((emit / "emit_drops.csv").open()):
        drops[source_of(r.get("strip") or r.get("page") or r["piece"])][r["reason"]] += 1
    return dict(accepted), nds, drops


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default="data/checkpoints/r3a-stage2-best-real")
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--out", default=str(T / "probe_score.json"))
    args = ap.parse_args()

    sliced = sliced_counts()
    accepted, nds, drops = emit_tables()

    print("\n=== 1. YIELD — label-free, the collapse signal ===")
    print(f"{'source':11}{'sliced':>8}{'accepted':>10}{'yield':>8}   {'median nd':>10}{'p90 nd':>9}")
    for s in SOURCES:
        sl, ac = sliced.get(s, 0), accepted.get(s, 0)
        nd = nds.get(s) or [0.0]
        print(f"{s:11}{sl:>8}{ac:>10}{(ac / sl * 100 if sl else 0):>7.1f}%   "
              f"{statistics.median(nd):>10.3f}{statistics.quantiles(nd, n=10)[8] if len(nd) > 9 else float('nan'):>9.3f}")
    tot_s, tot_a = sum(sliced.values()), sum(accepted.values())
    print(f"{'TOTAL':11}{tot_s:>8}{tot_a:>10}{(tot_a / tot_s * 100 if tot_s else 0):>7.1f}%")

    print("\n  top drop reasons per source:")
    for s in SOURCES:
        top = ", ".join(f"{k} {v}" for k, v in
                        collections.Counter(drops.get(s, {})).most_common(4)) or "-"
        print(f"    {s:11} {top}")

    print("\n=== 2. EDITS/STRIP on the accepted rows (a FLOOR, not the error rate) ===")
    from paired_arm_score import decode_pool
    res, ds = decode_pool(args.ckpt, str(T / "emit"), args.batch_size, args.max_length, args.device)
    per: dict[str, list[int]] = collections.defaultdict(list)
    exact: collections.Counter = collections.Counter()
    gold: dict[str, list[int]] = collections.defaultdict(list)
    for name, (edits, ex, n_ref) in res.items():
        s = source_of(name)
        per[s].append(edits)
        gold[s].append(n_ref)
        exact[s] += int(ex)
    print(f"checkpoint: {args.ckpt}")
    print(f"{'source':11}{'strips':>8}{'edits/strip':>13}{'median':>8}{'exact':>8}{'gold ids':>10}")
    for s in SOURCES:
        e = per.get(s) or []
        if not e:
            print(f"{s:11}{0:>8}{'-':>13}{'-':>8}{'-':>8}{'-':>10}")
            continue
        print(f"{s:11}{len(e):>8}{statistics.mean(e):>13.2f}{statistics.median(e):>8.1f}"
              f"{exact[s] / len(e) * 100:>7.1f}%{statistics.mean(gold[s]):>10.1f}")
    allv = [x for v in per.values() for x in v]
    if allv:
        print(f"{'TOTAL':11}{len(allv):>8}{statistics.mean(allv):>13.2f}")

    Path(args.out).write_text(json.dumps({
        "checkpoint": args.ckpt,
        "sliced": sliced, "accepted": accepted,
        "edits_per_strip": {s: (statistics.mean(v) if v else None) for s, v in per.items()},
        "exact_share": {s: (exact[s] / len(v) if v else None) for s, v in per.items()},
        "drops": {s: dict(v) for s, v in drops.items()},
    }, indent=1))
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
