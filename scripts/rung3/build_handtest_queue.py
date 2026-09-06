r"""The owner's HAND-TEST pages as a review queue — 20 pages, judged against the picture.

WHAT THIS IS. The page-level instrument the project has never had
([docs/rung3/round4.md](../../docs/rung3/round4.md), [docs/BACKLOG.md](../../docs/BACKLOG.md) item 6):
a fixed set of pages outside the frozen exam, every model read on the same pages, corrections counted
per page. The owner supplied the pages; this turns one decode of them into rows `review_ui.py` can
drive.

⛔ **IT IS NOT GOLD AND IT IS NOT THE EXAM.** `label` is written EMPTY on every row, so there is
nothing for a stray `ok` to promote, and the filename is neither `emit_review.csv` nor
`full_audit.csv` — the only two `promote_labels.py` reads. That is the same pair of guarantees
`r3-exam-errors` carries, and it matters more here than usual: the `decoded` column comes from
`r3a-stage2-best-real`, the model now serving the live site, so seeding gold from it would be exactly
the circularity CLAUDE.md forbids. The hint is allowed (owner, 2026-08-23 — a bad hint causes reader
errors); the gold is not.

WHAT THE VERDICTS MEAN HERE — this is a correction count, not a label pass:

    ok   the model read this strip correctly       -> costs the user nothing
    fix  the model got it wrong                    -> type what the page actually says
    bad  the crop is unusable                      -> the slicer's fault, not the model's

Corrections per page = the rows that are not `ok`. That is the number to compare between models.

⚠ Re-running carries existing verdicts across by strip name, so a re-decode with a NEW model does not
throw away the owner's reading. ⚠ But a verdict is only meaningful against the pixels it was given:
if the slicer changes, the crops move and the verdicts must be dropped, not carried.

    .venv-ml/bin/python scripts/rung3/build_handtest_queue.py [--root data/real/rung3/_handtest]
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

SIG = re.compile(r"\\sig(.*?)\\sigend", re.S)
FIELDS = ["piece", "page", "strip", "nd", "min_logprob", "reason",
          "verdict", "label", "decoded", "corrected_label"]


def tells(strips: list[dict]) -> dict[str, str]:
    r"""One structural tell per strip — no gold needed, so it is a place to LOOK, not a verdict.

    Every row-start strip of one page should read the SAME key signature; where they disagree, at
    least one is wrong. A `\sig` block in a mid-row crop is invented outright — that crop cannot see
    a signature. Both are the largest error class in Round 4 (root cause #2).
    """
    sigs = Counter()
    for s in strips:
        m = SIG.search(s["tokens"])
        if m and s["is_row_start"]:
            sigs[" ".join(m.group(1).split())] += 1
    majority = sigs.most_common(1)[0][0] if sigs else None
    out = {}
    for s in strips:
        t, m = s["tokens"], SIG.search(s["tokens"])
        if m and not s["is_row_start"]:
            out[s["strip"]] = "midrow-sig"
        elif "\\sig" in t and "\\sigend" not in t:
            out[s["strip"]] = "sig-unclosed"
        elif m and s["is_row_start"] and " ".join(m.group(1).split()) != majority:
            out[s["strip"]] = "sig-differs"
        elif (s.get("min_logprob") or 0) < -1.0:
            out[s["strip"]] = "low-confidence"
        elif len(t.split()) <= 3:
            out[s["strip"]] = "near-empty"
        else:
            out[s["strip"]] = ""
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="data/real/rung3/_handtest")
    ap.add_argument("--mapping", default="", help="TSV of <page>\\t<original filename>")
    args = ap.parse_args()

    root = Path(args.root)
    out_csv = root / "handtest_review.csv"

    prior: dict[str, tuple[str, str]] = {}
    if out_csv.exists():
        with out_csv.open(newline="") as f:
            for r in csv.DictReader(f):
                if r.get("verdict"):
                    prior[r["strip"]] = (r["verdict"], r.get("corrected_label", ""))

    names = {}
    if args.mapping and Path(args.mapping).exists():
        names = dict(l.split("\t") for l in Path(args.mapping).read_text().splitlines() if "\t" in l)

    rows = []
    for pd in sorted(p for p in root.iterdir() if p.is_dir()):
        dj = pd / f"{pd.name}_decode.json"
        if not dj.exists():
            continue
        strips = json.loads(dj.read_text())["strips"]
        tell = tells(strips)
        for s in strips:
            v, c = prior.get(s["strip"], ("", ""))
            rows.append({
                "piece": names.get(pd.name, pd.name), "page": pd.name, "strip": s["strip"],
                "nd": "", "min_logprob": s.get("min_logprob", ""), "reason": tell[s["strip"]],
                "verdict": v, "label": "", "decoded": s["tokens"], "corrected_label": c,
            })

    with out_csv.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

    kept = sum(1 for r in rows if r["verdict"])
    print(f"wrote {out_csv}  —  {len(rows)} rows over {len({r['page'] for r in rows})} pages"
          f"  (carried {kept} existing verdicts)")
    for reason, n in Counter(r["reason"] for r in rows).most_common():
        print(f"   {reason or '(nothing structural)':22s} {n}")
    print("\nreview with:  .venv-ml/bin/python scripts/rung3/review_ui.py   -> queue 'handtest'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
