"""
The pale-staff-line binarization fallback, measured over the whole real page corpus.

WHY THIS FILE EXISTS: the fallback (`page_binarizer` in src/vision/page_to_strips.py) was built and
measured, but its corpus numbers lived only in a code comment — no script, no saved output, nothing
to re-run. That is exactly the shape of claim docs/METRICS-SLICER.md warns about at the top of the
file. This script is the claim's home, so it can be re-measured after any change to the guard.

WHAT IT MEASURES, per page, with no slicing and no model:
  - staves under plain Otsu            (`binarize_ink`)          -> the behaviour before the change
  - staves under the fallback chooser  (`binarize_page_ink`)     -> the behaviour after it
  - which binarizer the chooser picked, and the interline/height ratio its shape check gates on

The three numbers that matter, and the only ones worth quoting:
  FIRES        pages where the chooser picks the paper-relative binarizer
  RECOVERED    pages that had 0 staves under Otsu and have >0 after
  REGRESSED    pages that had staves under Otsu and have FEWER after  <- must be 0

Deskew is deliberately NOT run. The fallback is chosen from the unrotated page (prep_page's skew
sweep asks `page_binarizer` for the choice once and reuses it for all 41 rotations), so measuring
the choice here matches how the slicer makes it, and skips the corpus's single most expensive step.

Chunked and resumable (fanless-Mac rule): each page's row is appended to the JSONL as it is
measured, and a re-run skips pages already in it. Ctrl-C is safe.

Run:
    .venv-ml/bin/python scripts/rung3/pale_line_probe.py                 # the whole corpus
    .venv-ml/bin/python scripts/rung3/pale_line_probe.py --pages 40      # a smoke sample
    .venv-ml/bin/python scripts/rung3/pale_line_probe.py --report        # re-print, measure nothing
"""

from __future__ import annotations

import argparse
import collections
import json
import random
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from vision.page_to_strips import (  # noqa: E402
    PALE_LINE_MIN_ROWS,
    _binarize_paper_relative,
    _staff_line_rows,
    binarize_ink,
    detect_staves,
    load_gray,
    page_binarizer,
)

DEFAULT_PAGES = ROOT / "data/real/images"
DEFAULT_OUT = ROOT / "data/real/rung3/pale_line_probe.jsonl"


def measure(path: Path) -> dict:
    """One page's row.

    `gate` records WHICH of `page_binarizer`'s three exits the page took, because "the fallback
    fired" and "the fallback was tried" are different counts and conflating them is how the guard's
    first write-up ended up quoting a number that does not reproduce:

      otsu-has-lines      stopped at PALE_LINE_MIN_ROWS — Otsu exposes enough staff-line rows, so
                          the fallback is never tried. ⚠ A page can be here AND still detect 0
                          staves: line rows are clustered rows of horizontal ink, and detect_staves
                          additionally has to group them into 5-line systems.
      fallback-empty      tried, and the paper-relative threshold found no staves either
      shape-rejected      tried, found staves, but interline/height fell outside the believed band
      fired               tried, found staves, believed
    """
    gray = load_gray(path)
    otsu_ink = binarize_ink(gray)
    otsu_rows = _staff_line_rows(otsu_ink)
    otsu_staves = detect_staves(otsu_ink)

    chosen = page_binarizer(gray)
    fired = chosen is _binarize_paper_relative
    after_staves = detect_staves(chosen(gray)) if fired else otsu_staves

    # The ratio the shape check gates on, recomputed here for EVERY page that the fallback was
    # actually tried on — believed or not — so a threshold change can be re-argued from saved data
    # instead of another corpus sweep. Deliberately not computed for `otsu-has-lines` pages: the
    # fallback never runs there, so a number for them would invite reading it as a rejection.
    rel = None
    if len(otsu_rows) >= PALE_LINE_MIN_ROWS:
        gate = "otsu-has-lines"
    else:
        pale_staves = after_staves if fired else detect_staves(_binarize_paper_relative(gray))
        if not pale_staves:
            gate = "fallback-empty"
        else:
            interline = float(np.median([np.median(np.diff(s.lines)) for s in pale_staves]))
            rel = interline / gray.shape[0]
            gate = "fired" if fired else "shape-rejected"

    return {
        "page": str(path.relative_to(ROOT)),
        "h": int(gray.shape[0]),
        "otsu_line_rows": len(otsu_rows),
        "otsu_staves": len(otsu_staves),
        "after_staves": len(after_staves),
        "fired": fired,
        "gate": gate,
        "rel": rel,
    }


def report(rows: list[dict]) -> str:
    n = len(rows)
    fired = [r for r in rows if r["fired"]]
    recovered = [r for r in rows if r["otsu_staves"] == 0 and r["after_staves"] > 0]
    regressed = [r for r in rows if r["after_staves"] < r["otsu_staves"]]
    zero_before = [r for r in rows if r["otsu_staves"] == 0]
    zero_after = [r for r in rows if r["after_staves"] == 0]

    out = [
        f"pages measured        {n}",
        f"0 staves BEFORE       {len(zero_before)}  ({len(zero_before) / max(1, n):.1%})",
        f"0 staves AFTER        {len(zero_after)}  ({len(zero_after) / max(1, n):.1%})",
        "",
        f"FIRES (fallback used) {len(fired)}",
        f"RECOVERED (0 -> >0)   {len(recovered)}",
        f"REGRESSED (fewer)     {len(regressed)}   <- must be 0",
    ]
    # every page the fallback fires on should already be at 0 staves: that is the whole claim that
    # it "has nothing to lose". A page that fires while already detecting staves is the dangerous
    # shape, so name them rather than folding them into a percentage.
    fired_with_staves = [r for r in fired if r["otsu_staves"] > 0]
    out.append(f"fired while already detecting staves  {len(fired_with_staves)}")
    for r in fired_with_staves[:10]:
        out.append(f"    {r['page']}  {r['otsu_staves']} -> {r['after_staves']}")
    for r in regressed[:10]:
        out.append(f"  REGRESSION  {r['page']}  {r['otsu_staves']} -> {r['after_staves']}")

    # The gate anatomy. Report it always: "the fallback was TRIED on n pages" and "it FIRED on n
    # pages" are different numbers, and the guard's first write-up quoted one as the other.
    gates = collections.Counter(r.get("gate") for r in rows)
    tried = gates["fallback-empty"] + gates["shape-rejected"] + gates["fired"]
    out += [
        "",
        "where each page exited page_binarizer:",
        f"  otsu-has-lines  {gates['otsu-has-lines']}   (>= PALE_LINE_MIN_ROWS line rows: never tried)",
        f"  fallback-empty  {gates['fallback-empty']}   (tried, found no staves either)",
        f"  shape-rejected  {gates['shape-rejected']}   (tried, found staves, interline/height refused)",
        f"  fired           {gates['fired']}",
        f"  -> TRIED {tried}, FIRED {gates['fired']}",
    ]
    # ⚠ A page can sit in otsu-has-lines and still detect 0 staves: line rows are clustered rows of
    # horizontal ink, and detect_staves must additionally group them into 5-line systems. Those
    # pages are the fallback's blind spot, so count them rather than let them hide in the 4.8%.
    blind = [r for r in rows if r.get("gate") == "otsu-has-lines" and r["otsu_staves"] == 0]
    out.append(f"  of which STILL 0 staves and never tried: {len(blind)}   <- the guard's blind spot")

    rels = [r["rel"] for r in fired if r["rel"] is not None]
    if rels:
        out += [
            "",
            f"interline/height on the pages that FIRED: "
            f"min {min(rels):.4f}  median {float(np.median(rels)):.4f}  max {max(rels):.4f}",
        ]
    rejected = [r for r in rows if r.get("gate") == "shape-rejected"]
    if rejected:
        rr = [r["rel"] for r in rejected]
        lo = sum(1 for x in rr if x < 0.0025)
        hi = sum(1 for x in rr if x > 0.02)
        out.append(
            f"...and on the {len(rejected)} the shape check REJECTED: "
            f"min {min(rr):.4f}  median {float(np.median(rr)):.4f}  max {max(rr):.4f}"
            f"   ({lo} too fine, {hi} too coarse)"
        )
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages-dir", default=str(DEFAULT_PAGES))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--pages", type=int, default=None, help="sample only N pages (smoke)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--report", action="store_true", help="print the saved rows, measure nothing")
    args = ap.parse_args()

    out_path = Path(args.out)
    done: dict[str, dict] = {}
    if out_path.exists():
        for line in out_path.read_text().splitlines():
            if line.strip():
                row = json.loads(line)
                done[row["page"]] = row

    if args.report:
        if not done:
            print(f"nothing saved at {out_path}")
            return 1
        print(report(list(done.values())))
        return 0

    pages = sorted(Path(args.pages_dir).rglob("*.png"))
    if args.pages is not None:
        pages = random.Random(args.seed).sample(pages, min(args.pages, len(pages)))
    print(f"{len(pages)} pages; {len(done)} already measured -> {out_path}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("a") as fh:
        for i, p in enumerate(pages, 1):
            key = str(p.relative_to(ROOT))
            if key in done:
                continue
            try:
                row = measure(p)
            except Exception as exc:  # a corrupt page must not lose the whole sweep
                print(f"  !! {key}: {exc}")
                continue
            done[key] = row
            fh.write(json.dumps(row) + "\n")
            fh.flush()
            if i % 100 == 0:
                print(f"  {i}/{len(pages)}")

    print()
    print(report([done[str(p.relative_to(ROOT))] for p in pages if str(p.relative_to(ROOT)) in done]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
