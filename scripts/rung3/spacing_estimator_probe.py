r"""Round-3 — WHY does the slicer normalise real strips 1.65% too large?

THE SYMPTOM (docs/METRICS.md, 2026-07-28). `page_to_strips` targets `TARGET_SPACING = 30.0` px.
Synthetic strips sit at exactly 30.000 (sd 0.000). Real strips leave the slicer at **30.496** on the
exam. Correcting the size at inference removes 12-15.5% of every correction a user makes, so this is
worth understanding exactly rather than patching by feel.

THE HYPOTHESIS THIS TESTS. Two different quantities decide the output size, and they only agree when
the five detected lines are evenly spaced:

  Staff.spacing   = median(diff(lines))      <- what the horizontal rescale divides by
  (bottom - top)  = lines[-1] - lines[0]     <- what actually sets the crop height, and therefore
                                                the VERTICAL scale, and therefore the staff size
                                                the model sees

`normalize_row` builds the crop as [top - HEADROOM_SP*sp, bottom + BELOW_SP*sp] and then resizes it
to a fixed STRIP_H. So the vertical scale is STRIP_H / crop_height, not TARGET/sp. If the endpoint
span is wider than 4 x median gap — one line detected slightly low, a thick bottom line, a stray
rule joining the cluster — the crop is taller than intended, the resize shrinks it less, and the
staff lands LARGER than 30. A median is immune to the outlying gap; the span is not.

  span_spacing = (bottom - top) / 4
  If span_spacing > Staff.spacing systematically, that is the bug, and the fix is to make the two
  agree (use the span, or fit the lines) rather than to scale by a magic constant.

WHY MEASURE BEFORE EDITING. Two patches to `page_to_strips.py` were written this session on
diagnoses inferred from reading the file, and both were reverted — one was dead code, the other was
disproved by the slicer's own manifests. This script exists so the third change is made against
evidence. It only READS; it changes nothing.

Usage:
    .venv-ml/bin/python scripts/rung3/spacing_estimator_probe.py [-n 60]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))


def subpixel_lines(ink: np.ndarray, lines: list[int], tol: int) -> list[float]:
    """Ink-weighted centre of each staff line, to sub-pixel precision.

    `_cluster_rows` reports `(start + prev) // 2`, an integer floor. That is fine for locating a
    line but throws away up to a pixel, and a pixel is 3% of a staff space. The centroid keeps it,
    so the two estimators can be compared without the quantisation muddying the answer.
    """
    prof = (ink > 0).sum(axis=1).astype(float)
    out = []
    for y in lines:
        lo, hi = max(0, y - tol), min(len(prof), y + tol + 1)
        w = prof[lo:hi]
        if w.sum() <= 0:
            out.append(float(y))
            continue
        ys = np.arange(lo, hi, dtype=float)
        out.append(float((ys * w).sum() / w.sum()))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=60, help="pages to sample")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    import page_to_strips as P

    pages = sorted(Path(ROOT / "data/real/images").rglob("*.png"))
    if not pages:
        print("no pages under data/real/images", file=sys.stderr)
        return 1
    import random
    random.Random(args.seed).shuffle(pages)
    pages = pages[: args.n]

    rows = []
    for path in pages:
        try:
            gray = P.load_gray(path)
            gray, _, _ = P.prep_page(gray)
            ink = P.binarize_ink(gray)
            staves = P.detect_staves(ink)
        except Exception:
            continue
        for st in staves:
            if len(st.lines) < 2:
                continue
            med = st.spacing                                   # what the slicer divides by
            span = (st.bottom - st.top) / (len(st.lines) - 1)  # what sets the crop height
            tol = max(2, int(round(med * 0.2)))
            sub = subpixel_lines(ink, st.lines, tol)
            sub_span = (sub[-1] - sub[0]) / (len(sub) - 1)     # same, without integer flooring
            gaps = np.diff(st.lines)
            rows.append({
                "median": med, "span": span, "sub_span": sub_span,
                "n_lines": len(st.lines),
                "gap_spread": float(gaps.max() - gaps.min()) if len(gaps) else 0.0,
            })

    if not rows:
        print("no staves detected", file=sys.stderr)
        return 1

    med = np.array([r["median"] for r in rows])
    span = np.array([r["span"] for r in rows])
    sub = np.array([r["sub_span"] for r in rows])
    spread = np.array([r["gap_spread"] for r in rows])

    print(f"{len(rows)} staves over {len(pages)} sampled pages\n")
    print(f"{'estimator':>28} {'mean px':>9} {'sd':>7}")
    print("-" * 47)
    print(f"{'Staff.spacing = median(gaps)':>28} {med.mean():>9.3f} {med.std():>7.3f}")
    print(f"{'(bottom-top)/(n-1)':>28} {span.mean():>9.3f} {span.std():>7.3f}")
    print(f"{'same, sub-pixel centres':>28} {sub.mean():>9.3f} {sub.std():>7.3f}")

    r_span = span / med
    r_sub = sub / med
    print(f"\nspan / median      : mean {r_span.mean():.5f}  "
          f"median {np.median(r_span):.5f}  (>1 means the crop is TALLER than the median implies)")
    print(f"sub-pixel / median : mean {r_sub.mean():.5f}  median {np.median(r_sub):.5f}")
    print(f"\npredicted output staff size if the span drives the vertical scale:")
    print(f"  30.0 x span/median   = {30.0*r_span.mean():.3f} px   "
          f"(measured on real strips: 30.496)")
    print(f"  30.0 x subpix/median = {30.0*r_sub.mean():.3f} px")

    print(f"\nstaves whose 5 gaps are NOT equal (spread > 0 px): "
          f"{100*np.mean(spread > 0):.0f}%   spread mean {spread.mean():.2f} px, "
          f"p90 {np.percentile(spread, 90):.2f} px")
    print(f"staves where span exceeds median by >1%: {100*np.mean(r_span > 1.01):.0f}%")
    print("\nREAD: if span/median is ~1.016 the hypothesis holds and the fix is to make the two")
    print("agree. If it is ~1.000, the bias is elsewhere and this file still must not be edited.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
