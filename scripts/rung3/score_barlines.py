#!/usr/bin/env python3
"""Score `detect_barlines` against HAND-MARKED barline positions — precision, recall, and WHY.

The instrument this project did not have. `score_slicer.py` scores a per-row MEASURE COUNT aligned
from the old pipeline's decodes: it cannot name the barline that was missed, cannot see a row that
pipeline never read, and cannot charge for a false barline that splits a measure evenly. This reads
positions a human marked (`build_barline_truth.py` -> `mark.html`) and answers three questions the
count cannot:

  * RECALL   — of the barlines that are printed, how many does the slicer find?
  * PRECISION— of the barlines it reports, how many are printed?
  * WHY      — for each miss, which gate rejected it, or whether it never became a candidate at all
               (which is gate 1, continuity + touching both staff lines).

⚠ Truth is in DESKEWED page px, the space `prep_page()` produces, so this re-runs the same path and
compares without transforming anything.

⚠ ROW ENDS ARE EXCLUDED FROM BOTH SIDES. `detect_barlines` always emits the staff's own x0/x1 as
boundaries whether or not a barline is printed there, so counting them would inflate precision on
every row. A hand mark within `--end-tol` line-spaces of a row end is dropped with them — so there
is no need to mark where a staff starts and stops, only what is PRINTED inside it.

⚠ A MARK BEYOND THE DETECTED EXTENT IS A MISS, NOT A DROP, and it is its own kind of failure. If a
row's x0/x1 is wrong the slicer cannot cut at that barline whatever the gates do — that is the "the
2nd and 9th rows have lost half of themselves" defect (owner, 2026-08-25). Dropping such a mark with
the row ends would hide exactly the bug it proves, so it counts against recall under
`outside_staff_extent` and is reported on its own line.

    .venv-ml/bin/python scripts/rung3/score_barlines.py
    OMR_STAFF_SPAN=0 .venv-ml/bin/python scripts/rung3/score_barlines.py   # A/B any slicer flag
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "src" / "vision"))

import page_to_strips as P  # noqa: E402


def page_path(stem: str) -> Path | None:
    if (REPO / f"{stem}.png").exists():
        return REPO / f"{stem}.png"
    return next((REPO / "data/real/images").rglob(f"{stem}.png"), None)


def detections(path: Path) -> dict[int, dict]:
    """system -> {'bars': interior x's, 'rejects': [(x, why)], 'x0','x1','sp'} in deskewed page px."""
    gray, _, _ = P.prep_page(P.load_gray(path))
    binz = P.page_binarizer(gray)
    ink = binz(gray)
    out: dict[int, dict] = {}
    for si, st in enumerate(P.detect_staves(ink)):
        row, scale, top_y = P.normalize_row(gray, st, lab=ink)
        info: dict = {}
        bars = P.detect_barlines(row, st, scale, debug_info=info, top_y=top_y, binarize=binz)
        out[si] = {
            "bars": [b / scale for b in bars[1:-1]],
            "rejects": [(x / scale, why) for x, why in info.get("rejects", [])],
            "x0": st.x0, "x1": st.x1, "sp": st.spacing,
        }
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--truth", default="data/real/rung3/_barline_truth/barline_truth.json")
    ap.add_argument("--match-tol", type=float, default=0.6,
                    help="line-spaces a detection may sit from a mark and still be the same bar")
    ap.add_argument("--end-tol", type=float, default=1.5,
                    help="line-spaces from a row end within which a mark is a ROW END, not interior")
    ap.add_argument("--csv", default="data/real/rung3/_barline_truth/score_barlines.csv")
    args = ap.parse_args()

    tp = REPO / args.truth
    if not tp.exists():
        print(f"no truth yet: {tp}\nmark some rows first — see build_barline_truth.py")
        return 1
    truth = json.loads(tp.read_text())["marks"]

    cache: dict[str, dict] = {}
    n_truth = n_found = n_det = 0
    miss_why: Counter = Counter()
    rows_scored = 0
    per_page: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])   # truth, found, detected
    n_outside: Counter = Counter()
    misses: list[tuple] = []
    extras: list[tuple] = []

    for key, xs in sorted(truth.items()):
        if not xs:
            continue
        stem, si = key.rsplit("|", 1)
        si = int(si)
        if stem not in cache:
            pp = page_path(stem)
            if pp is None:
                print(f"  !! page not found: {stem}")
                cache[stem] = {}
            else:
                cache[stem] = detections(pp)
        d = cache[stem].get(si)
        if d is None:
            print(f"  !! {stem} s{si:02d}: the slicer finds no such row")
            continue
        rows_scored += 1
        tol = args.match_tol * d["sp"]
        end = args.end_tol * d["sp"]
        # outside the DETECTED extent = a miss the gates never got a chance at; within `end_tol`
        # of an end = the row end itself, which the slicer always emits. See the header.
        outside = [x for x in sorted(xs) if not (d["x0"] - end <= x <= d["x1"] + end)]
        marks = [x for x in sorted(xs) if d["x0"] + end < x < d["x1"] - end]
        det = list(d["bars"])
        used: set[int] = set()
        for m in marks:
            hit = min(((abs(m - b), k) for k, b in enumerate(det) if k not in used),
                      default=(None, None))
            if hit[0] is not None and hit[0] <= tol:
                used.add(hit[1])
                n_found += 1
            else:
                why = min(((abs(m - x), w) for x, w in d["rejects"]), default=(None, None))
                reason = why[1] if (why[0] is not None and why[0] <= tol) else "never_a_candidate"
                miss_why[reason] += 1
                misses.append((stem, si, round(m), reason))
        for x in outside:
            miss_why["outside_staff_extent"] += 1
            misses.append((stem, si, round(x), "outside_staff_extent"))
            n_outside[stem] += 1
        n_truth += len(marks) + len(outside)
        n_det += len(det)
        for k, b in enumerate(det):
            if k not in used:
                extras.append((stem, si, round(b)))
        per_page[stem][0] += len(marks) + len(outside)
        per_page[stem][1] += len(used)
        per_page[stem][2] += len(det)

    if not n_truth:
        print("no marks inside any row — nothing to score")
        return 1
    prec = n_found / n_det if n_det else 0.0
    print(f"rows scored: {rows_scored}   marked barlines: {n_truth}   detected: {n_det}"
          f"   (interior only, row ends excluded)")
    print(f"RECALL    {n_found}/{n_truth} ({n_found / n_truth:.1%})")
    print(f"PRECISION {n_found}/{n_det} ({prec:.1%})   false barlines: {n_det - n_found}")
    print("\nwhy the misses were missed:")
    for why, c in miss_why.most_common():
        print(f"  {why:<20} {c:>4}  ({c / (n_truth - n_found):.0%} of misses)"
              if n_truth != n_found else f"  {why:<20} {c:>4}")
    if sum(n_outside.values()):
        print(f"\n⚠ {sum(n_outside.values())} marked barlines fall OUTSIDE the detected staff"
              f" extent — the gates never saw them; the row's x0/x1 is what is wrong:")
        for pg, c in n_outside.most_common():
            print(f"  {pg:<40} {c}")
    print("\nper page:            marked  found  detected  recall")
    for pg, (t, f, dd) in sorted(per_page.items()):
        print(f"  {pg[:34]:<34} {t:>5} {f:>6} {dd:>9}  {f / t:.0%}" if t else "")

    out = REPO / args.csv
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w") as fh:
        fh.write("kind,page,system,x,reason\n")
        for stem, si, x, why in misses:
            fh.write(f"miss,{stem},{si},{x},{why}\n")
        for stem, si, x in extras:
            fh.write(f"false,{stem},{si},{x},\n")
    print(f"\nper-barline CSV -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
