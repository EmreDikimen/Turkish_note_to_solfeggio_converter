#!/usr/bin/env python3
"""Deterministic train/val split BY PIECE for the Rung-2 strip dataset.

Why by piece, not by strip: a piece's strips (and its transposed re-renders) are near-copies of
each other; strip-level splitting would leak them across the boundary and make validation metrics
meaningless (ROADMAP Phase-3 rule). The split key is the manifest's `piece` field, so every
variant of a piece lands on one side automatically.

Selection is deterministic (pieces ordered by md5 of their slug) and coverage-aware: while
filling the val fraction it prefers pieces that still add occurrences of the worst-covered AEU
accidental class in val, so even the rare classes are represented on the held-out side.

Usage:
    .venv-ml/bin/python scripts/make_split.py --strips data/synthetic/strips_v2
        [--val-frac 0.12] [--out <strips>/split.json]
Commit a copy at data/split.json so the split is frozen with the code.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC))

from vision.data import ADDED_TOKENS  # noqa: E402

AEU_CLASSES = ADDED_TOKENS[:8]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strips", default="data/synthetic/strips_v2")
    ap.add_argument("--val-frac", type=float, default=0.12)
    ap.add_argument("--out", default=None, help="default: <strips>/split.json")
    args = ap.parse_args()

    strips_dir = Path(args.strips)
    rows = [json.loads(l) for l in (strips_dir / "manifest.jsonl").read_text().splitlines() if l.strip()]

    # Per-piece strip counts and AEU-class occurrence counts (over label tokens).
    n_strips: Counter = Counter()
    acc: dict[str, Counter] = {}
    for r in rows:
        piece = r.get("piece") or r["image"].split("_")[0]
        n_strips[piece] += 1
        c = acc.setdefault(piece, Counter())
        for tok in r["label"].split():
            if tok in AEU_CLASSES:
                c[tok] += 1

    total = sum(n_strips.values())
    target = args.val_frac * total
    ordered = sorted(n_strips, key=lambda p: hashlib.md5(p.encode()).hexdigest())

    val: list[str] = []
    val_strips = 0
    val_acc: Counter = Counter({c: 0 for c in AEU_CLASSES})
    # Greedy: repeatedly take the piece (in hash order for determinism) that most helps the
    # currently worst-covered class in val; plain hash order once every class has a footing.
    remaining = list(ordered)
    while val_strips < target and remaining:
        worst = min(AEU_CLASSES, key=lambda c: val_acc[c])
        helpers = [p for p in remaining if acc[p][worst] > 0]
        pick = helpers[0] if val_acc[worst] < 25 and helpers else remaining[0]
        remaining.remove(pick)
        val.append(pick)
        val_strips += n_strips[pick]
        val_acc.update(acc[pick])

    train = sorted(remaining)
    val = sorted(val)
    stats = {
        "total_strips": total,
        "val_strips": val_strips,
        "val_frac": round(val_strips / total, 4),
        "val_acc_counts": {c: val_acc[c] for c in AEU_CLASSES},
        "train_acc_counts": {c: sum(acc[p][c] for p in train) for c in AEU_CLASSES},
    }

    out = Path(args.out) if args.out else strips_dir / "split.json"
    out.write_text(json.dumps({"train_pieces": train, "val_pieces": val, "stats": stats},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"split: {len(train)} train / {len(val)} val pieces "
          f"({val_strips}/{total} strips = {val_strips / total:.1%}) -> {out}")
    print("val per-class:", {k.strip(chr(92)): v for k, v in stats["val_acc_counts"].items()})
    return 0


if __name__ == "__main__":
    sys.exit(main())
