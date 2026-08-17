"""
Build the piece list for Round-3 Lever 1's crop-geometry pilot (docs/rung3/levers.md, step 2).

WHY A SCRIPT AND NOT A HAND-PICKED FILE: the pilot's three arms must render the SAME music, so the
list is the one thing every arm shares. A file assembled by hand cannot be re-derived if an arm has
to be re-rendered later, and `render.ts --from/--to` is not a substitute — it slices the piece list in
order, so a 6-piece window is 6 *adjacent* pieces, which in `pieces_v4.json` means near-identical
makams. Makam spread is what a distribution measurement needs.

WHAT IT PICKS: six pieces, one per makam, from the 40-80 measure band. Both bounds earn their place —
a 250-measure piece would dominate the pooled width distribution on its own, and a 12-measure one
yields too few strips to have a distribution at all.

⚠ It reads `data/pieces_v4.json`, the LIVE list. Never `data/pieces.json`, which is the stale
2026-07-08 selection (see CLAUDE.md). ⚠ It also refuses to emit a piece that appears in the frozen
exam, which is belt-and-braces — `pieces_v4.json` has no exam overlap today (checked: 0 of 208
against the 33 exam symbtr stems) — because a pilot list is exactly the kind of derived file that
outlives the check someone did once in their head.

Run:
    .venv-ml/bin/python scripts/rung3/make_geom_pilot_list.py
    .venv-ml/bin/python scripts/rung3/make_geom_pilot_list.py --pieces 8 --seed 3
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIVE_LIST = ROOT / "data/pieces_v4.json"
TESTSET = ROOT / "data/real/rung3/testset.json"
OUT = ROOT / "data/pieces_geom_pilot.json"


def exam_stems() -> set[str]:
    """Every symbtr stem in the frozen exam, for the refusal below."""
    if not TESTSET.exists():
        return set()
    return {
        e["symbtr_file"].removesuffix(".txt")
        for e in json.loads(TESTSET.read_text())["pieces"]
        if e.get("symbtr_file")
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pieces", type=int, default=6)
    ap.add_argument("--min-measures", type=int, default=40)
    ap.add_argument("--max-measures", type=int, default=80)
    ap.add_argument("--seed", type=int, default=17)
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    src = json.loads(LIVE_LIST.read_text())
    exam = exam_stems()

    band = [
        p for p in src["pieces"]
        if args.min_measures <= p["measures"] <= args.max_measures
        and p["txt"].removesuffix(".txt") not in exam
        and p["slug"] not in exam
    ]
    # One piece per makam, and the FIRST by slug within each so the choice does not move with the
    # seed — only which makams are drawn does.
    by_makam: dict[str, list[dict]] = {}
    for p in sorted(band, key=lambda p: p["slug"]):
        by_makam.setdefault(p["makam"], []).append(p)

    makams = sorted(by_makam)
    if len(makams) < args.pieces:
        print(f"only {len(makams)} makams in the {args.min_measures}-{args.max_measures} band")
        return 1
    random.Random(args.seed).shuffle(makams)
    pick = [by_makam[m][0] for m in makams[: args.pieces]]

    print(f"{len(band)} pieces in the {args.min_measures}-{args.max_measures} measure band "
          f"across {len(by_makam)} makams; picked {len(pick)}:")
    for p in pick:
        print(f"  {p['makam']:16s} {p['measures']:3d} meas  lyrics={p['hasLyrics']}  {p['slug']}")

    out = dict(src)
    out["pieces"] = pick
    out["note"] = (
        f"Round-3 Lever 1 crop-geometry pilot (docs/rung3/levers.md step 2). {len(pick)} pieces, one "
        f"per makam, {args.min_measures}-{args.max_measures} measures, seed {args.seed}, derived from "
        f"data/pieces_v4.json by scripts/rung3/make_geom_pilot_list.py. NOT a training selection: it "
        f"has no split, and nothing rendered from it should reach a training run."
    )
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
