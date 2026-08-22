"""Which token budget should the label-budget rail pack to? — a free sweep, no decoding.

The rail's value is at TRAINING time: a window whose label cannot fit the emitter's 59-id gate is
DROPPED, so dense music never reaches the model in any form. Splitting such a window makes its
parts fit, which is how that music gets into the corpus at all. But cutting too eagerly has its own
cost, and it is a measured one — `MEASURES_PER_STRIP = 1` looked monotonically better on "does it
fit" and turned out to be harmful, because it manufactured near-empty crops that "fit" while
carrying almost no music (docs/METRICS-SLICER-FRAME.md).

So the budget is a trade between two curves, and this reports both at every candidate b:

  * **recovered** — windows that now fit the 59-id gate and would enter training
  * **near-empty** — windows estimated at <= 20 ids, the cost that sank `MEASURES_PER_STRIP = 1`
  * **healthy 21-59** — the band the July measurement ranked on, so the numbers are comparable

⚠ These are ESTIMATED ids (`estimate_tokens`), not decoded ones, and the estimator's residual sd is
~30 ids. Every arm shares one estimator, so the ORDERING is trustworthy where the absolute levels
are not — the same caveat the July sweep carries.

⚠ It re-runs stage 1 (prep -> staves -> normalize -> barlines) once per page and then re-windows
that same geometry at every b, so the arms differ only in the packing rule. No model is loaded.

    .venv-ml/bin/python scripts/rung3/budget_sweep.py --pages 120
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

import vision.page_to_strips as pts  # noqa: E402
from vision.page_to_strips import (  # noqa: E402
    VPLACE_ADAPTIVE,
    binarize_page_ink,
    detect_barlines,
    detect_staves,
    load_gray,
    normalize_row,
    prep_page,
    window_measures,
)

STRIPS = Path("data/real/strips_v2")
IMAGES = Path("data/real/images")
GATE = 59      # audit_coverage.MAX_IDS — what actually drops a strip from training
NEAR_EMPTY = 20


def index_images() -> dict[str, Path]:
    idx: dict[str, Path] = {}
    for p in IMAGES.rglob("*"):
        if p.suffix.lower() in (".png", ".jpg", ".jpeg") and p.stem not in idx:
            idx[p.stem] = p
    return idx


def sample(items: list, n: int) -> list:
    if n >= len(items):
        return items
    stride = len(items) / n
    return [items[int(i * stride)] for i in range(n)]


def rows_of(image: Path):
    """Stage 1 for one page: the normalized rows and their barlines."""
    gray = load_gray(image)
    page, _, _ = prep_page(gray)
    ink = binarize_page_ink(page)
    lab = (cv2.connectedComponents((ink > 0).astype(np.uint8), connectivity=8)[1]
           if VPLACE_ADAPTIVE else None)
    out = []
    for st in detect_staves(ink):
        row, scale, top_y = normalize_row(page, st, lab)
        out.append((row, top_y, detect_barlines(row, st, scale, top_y=top_y)))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", type=int, default=120)
    ap.add_argument("--budgets", type=float, nargs="*",
                    default=[40, 45, 50, 55, 59, 62])
    args = ap.parse_args()

    images = index_images()
    stems = sample(sorted(d.name for d in STRIPS.iterdir()
                          if d.is_dir() and d.name in images), args.pages)
    print(f"{len(stems)} pages, budgets {args.budgets} + the shipped rule as control\n")

    arms: dict[str, list[float]] = {}
    t0 = time.time()
    for i, stem in enumerate(stems, 1):
        try:
            rows = rows_of(images[stem])
        except Exception as e:                       # a page the slicer cannot read is not an arm
            print(f"  [{i}/{len(stems)}] {stem[:40]} SKIP ({type(e).__name__})")
            continue
        for label, budget in [("legacy", None)] + [(f"b={b:g}", b) for b in args.budgets]:
            pts.WINDOW_MODE = "legacy" if budget is None else "budget"
            if budget is not None:
                pts.TOKEN_BUDGET = budget
            got = arms.setdefault(label, [])
            for row, top_y, bars in rows:
                for w in window_measures(bars, row, top_y=top_y):
                    got.append(w.est_tokens)
        if i % 10 == 0:
            print(f"  {i}/{len(stems)}  {time.time() - t0:.0f}s", flush=True)
    pts.WINDOW_MODE = "legacy"

    base_over = sum(1 for e in arms["legacy"] if e > GATE)
    print(f"\n{'arm':<9}{'windows':>9}{'over 59':>10}{'(dropped)':>11}"
          f"{'near-empty':>12}{'healthy':>10}{'recovered':>11}")
    print("-" * 72)
    for label in ["legacy"] + [f"b={b:g}" for b in args.budgets]:
        e = arms.get(label)
        if not e:
            continue
        n = len(e)
        over = sum(1 for x in e if x > GATE)
        empty = sum(1 for x in e if x <= NEAR_EMPTY)
        healthy = n - over - empty
        print(f"{label:<9}{n:>9}{over:>9} {100 * over / n:>9.1f}%"
              f"{100 * empty / n:>11.1f}%{100 * healthy / n:>9.1f}%"
              f"{base_over - over:>+11d}")
    print("\n  recovered = windows no longer over the 59-id gate, vs the shipped rule "
          f"({base_over} over)")
    print("  ⚠ ESTIMATED ids (sd ~30) — the ordering holds, the absolute levels are approximate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
