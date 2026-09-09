#!/usr/bin/env python3
r"""A readable sample of the DENSE strips the `nd` referee dropped — so "is it the label or the model?"
stops being an inference and becomes a count.

WHAT IT SAMPLES, and why this population and not `nd_high` at large. Round 4's scheme-H re-emit
brought the over-budget strips back (`over_budget` 4,012 -> 141) and then lost most of them to a
SECOND gate: `nd`, the emitter's disagreement check against `round2-stage2-best`'s own reading. The
strips that made both journeys — dropped by `strips_b8` as `over_budget`, dropped by `strips_h1` as
`nd_high` — are **1,678 rows**, and they are genuinely unusual material: median 49 ids of music in
the crop against 37 for an accepted strip.

⚠ **THE OPEN QUESTION IS WHY THEIR `nd` IS HIGH, AND NOBODY HAS LOOKED.** `nd` cannot tell "the
model misread a dense strip" from "the label is the wrong measures" — that is the whole reason the
emitter drops rather than guesses. On EXAM pieces, where `nd_high` goes to review instead of being
dropped, 75 hand-read rows say it is overwhelmingly the label (the owner's answer sat a median of
20 label-token edits from the label and 0 from the decode). ⛔ **But those are exam pieces and the
general `nd_high` population is NOT dense** — median 37 ids, the same as an accepted strip. So the
exam reading does not settle this subset, and this queue exists to settle it.

WHAT A VERDICT MEANS HERE. The same contract as `realval-hard-v2` and `photo-gold`: these strips
carry no trustworthy SymbTr label, so the row is seeded with the model's own decode and **the
verdict is against the PICTURE**. `ok` = "I looked and the decode is right". `fix` = type what the
page actually says. `bad` = the crop is unusable, which is the slicer's fault and not either
source's.

⭐ **WHAT THIS QUEUE CAN AND CANNOT ANSWER.** The derived label is NOT carried: `emit_drops.csv`
records only piece/page/strip/reason/nd, and re-deriving a label for a dropped strip means running
the emitter again. So the row carries an EMPTY `label` column and the question it settles is the
load-bearing half:

    does the model read dense material correctly?

`fix` rate high  -> the model IS weak on dense strips. `nd_high` then partly means "the model could
                    not read it", these strips are worth hand-labelling, and the round should treat
                    dense material as a training gap.
`fix` rate low   -> the model reads them fine, so a high `nd` came from the LABEL side, and the
                    strips are recoverable but teach the model little it does not already know.

⭐ A side benefit of the empty label: the edit box is then seeded with the decode alone, so there is
exactly ONE anchor to reason about instead of the usual label-sig + decode-content hybrid.

⚠ **ANCHORING, stated because this queue's whole output is an attribution.** `review_ui.baseText`
seeds the edit box with the LABEL's `\sig` block plus the DECODE's content, so a reader who accepts
what is on screen lands on the decode for notes and the label for the signature. `verdict_attribution.py`
measures the size of that effect on every pool that already has verdicts; read this queue's result
through it, and prefer the rows you actually re-typed.

⛔ **NOT GOLD, and it cannot become training data by accident.** The file is neither
`emit_review.csv` nor `full_audit.csv`, the only two names `promote_labels.py` reads — the same
guarantee `handtest` and `r3-exam-errors` carry.

Run:
    .venv-ml/bin/python scripts/rung3/build_ndhigh_queue.py            # 40 rows, seed 11
    .venv-ml/bin/python scripts/rung3/build_ndhigh_queue.py --n 80     # more, same seed prefix
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from merge_redecode_into_queue import drop_ties  # noqa: E402  the ONE tie-removal rule

B8_DROPS = ROOT / "data/real/rung3/strips_b8/emit_drops.csv"
H1_DROPS = ROOT / "data/real/rung3/strips_h1/emit_drops.csv"
CROPS = ROOT / "data/real/strips_v2"
OUT = ROOT / "data/real/rung3/_ndhigh/ndhigh_sample.csv"
COLS = ["piece", "page", "strip", "reason", "nd", "min_logprob", "mean_logprob",
        "exam", "label", "decoded", "verdict", "corrected_label", "by"]


def page_decode(page: str) -> dict:
    p = CROPS / page / f"{page}_decode.json"
    if not p.exists():
        return {}
    return {s["strip"]: s for s in json.load(p.open())["strips"]}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n", type=int, default=40,
                    help="rows to stage. 40 gives a 95%% interval of roughly +/-15pp on a 50%% "
                         "split — enough to separate 'mostly the label' from 'mostly the model', "
                         "not enough to quote a rate to the point.")
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()

    b8 = {r["strip"]: r["reason"] for r in csv.DictReader(B8_DROPS.open())}
    pool = [r for r in csv.DictReader(H1_DROPS.open())
            if r["reason"] == "nd_high" and b8.get(r["strip"]) == "over_budget"]
    print(f"population: {len(pool)} strips (b8 dropped as over_budget, h1 drops as nd_high)")

    # ⚠ A SIMPLE RANDOM SAMPLE, not worst-first. Every other queue in this project is ordered
    # worst-first to spend the human where the errors are — that is right for HARVESTING labels and
    # wrong here, because this queue exists to estimate a RATE. Ordering by anything correlated
    # with the answer would bias the estimate it is being read for.
    rng = random.Random(args.seed)
    sample = rng.sample(pool, min(args.n, len(pool)))
    sample.sort(key=lambda r: (r["page"], r["strip"]))    # read in page order, not sample order

    cache: dict[str, dict] = {}
    rows, skipped = [], 0
    for r in sample:
        page = r["page"]
        if page not in cache:
            cache[page] = page_decode(page)
        s = cache[page].get(r["strip"])
        if s is None or not (CROPS / page / r["strip"]).exists():
            skipped += 1
            continue
        rows.append({
            "piece": r["piece"], "page": page, "strip": r["strip"], "reason": "nd_high",
            "nd": r["detail"].split("=")[1] if "nd=" in r["detail"] else "",
            "min_logprob": s.get("min_logprob", ""), "mean_logprob": s.get("mean_logprob", ""),
            "exam": "", "label": "", "decoded": drop_ties(s.get("tokens", "")),
            "verdict": "", "corrected_label": "", "by": "",
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        raise SystemExit(f"{OUT} exists — verdicts in it would be overwritten. Move it aside first.")
    with OUT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {OUT} — {len(rows)} rows" + (f" ({skipped} skipped: no crop or no cache)" if skipped else ""))
    print("NEXT: review_ui.py -> queue `ndhigh`. ok = the decode is right; fix = type the page.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
