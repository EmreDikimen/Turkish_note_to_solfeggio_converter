#!/usr/bin/env python3
"""Rank SymbTr pieces by tuplet content and cross them with the Rung-3 match data.

Why (docs/RUNG3.md "Tuplet training gap"): the exam holds 4 \\tup3 gold tokens and the
training manifest ~14 tup3 rows — the model reads triplets poorly and the corpus can't
teach it. This script finds the SymbTr pieces that would fix that: for each of the
~2,200 SymbTr txt files it counts tuplet events (same rule as tools/render/rhythm.ts —
a sounding event whose reduced Pay/Payda denominator is divisible by 3), then joins
the counts against nota_matches.csv, matches_review.csv (neyzen), and the download
state, so the tuplet-dense UNCOLLECTED matches surface as download targets.

Output: data/real/rung3/tuplet_pieces.csv, one row per tuplet-bearing SymbTr piece,
sorted by tuplet group count desc. Columns cover both sources' best match tier/score
and whether the piece is already downloaded/matched.

Usage:
    python scripts/rung3/find_tuplet_pieces.py [--symbtr-dir ~/Downloads/SymbTr-2.0.0/txt]
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from fractions import Fraction
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "src"))
sys.path.insert(0, str(REPO / "scripts" / "rung3"))

from symbtr.parser import EventKind, parse_file  # noqa: E402

OUT = REPO / "data" / "real" / "rung3"
TUPLETS_P = OUT / "tuplet_pieces.csv"


def tuplet_stats(path: Path) -> tuple[int, int, int]:
    """(tuplet_events, tuplet_groups, sounding_events) for one SymbTr file.

    Group = contiguous run of tuplet-fraction events that closes as soon as its exact
    sum has a power-of-two denominator (mirrors tupletGroupsIn in rhythm.ts).
    """
    score = parse_file(path)
    n_tup = n_groups = n_sounding = 0
    run_sum = Fraction(0)
    in_run = False
    for ev in score.events:
        if ev.kind not in (EventKind.NOTE, EventKind.REST):
            continue
        n_sounding += 1
        frac = Fraction(ev.num, ev.den) if ev.den else Fraction(0)
        is_tup = frac > 0 and frac.denominator % 3 == 0
        if is_tup:
            n_tup += 1
            run_sum += frac
            if not in_run:
                in_run = True
                n_groups += 1
            # power-of-two denominator = the group closed; the next tuplet event
            # starts a NEW group even without a plain note between them.
            if run_sum.denominator & (run_sum.denominator - 1) == 0:
                in_run = False
                run_sum = Fraction(0)
        else:
            in_run = False
            run_sum = Fraction(0)
    return n_tup, n_groups, n_sounding


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--symbtr-dir", type=Path,
                    default=Path.home() / "Downloads" / "SymbTr-2.0.0" / "txt")
    args = ap.parse_args()

    # --- best nota-catalog match per SymbTr stem -------------------------------
    nota_best: dict[str, dict] = {}
    nota_csv = OUT / "nota_matches.csv"
    if nota_csv.exists():
        for r in csv.DictReader(nota_csv.open()):
            if not r["symbtr"]:
                continue
            prev = nota_best.get(r["symbtr"])
            if prev is None or float(r["score"]) > float(prev["score"]):
                nota_best[r["symbtr"]] = r

    # --- best neyzen match per SymbTr stem ------------------------------------
    ney_best: dict[str, dict] = {}
    ney_csv = OUT / "matches_review.csv"
    if ney_csv.exists():
        for r in csv.DictReader(ney_csv.open()):
            if not r["symbtr"]:
                continue
            prev = ney_best.get(r["symbtr"])
            if prev is None or float(r["score"]) > float(prev["score"]):
                ney_best[r["symbtr"]] = r

    # --- what is already collected --------------------------------------------
    downloads = json.loads((OUT / "nota_downloads.json").read_text()) \
        if (OUT / "nota_downloads.json").exists() else {}
    downloaded_ids = set(downloads)
    matched_stems: set[str] = set()          # SymbTr stems with a matched/ ground-truth dir
    for mj in (OUT / "matched").glob("*/*/match.json"):
        try:
            matched_stems.add(Path(json.loads(mj.read_text())["symbtr"]["file"]).stem)
        except (KeyError, json.JSONDecodeError):
            pass

    # --- scan ------------------------------------------------------------------
    rows: list[dict] = []
    files = sorted(args.symbtr_dir.glob("*.txt"))
    print(f"scanning {len(files)} SymbTr files …")
    for i, path in enumerate(files, 1):
        try:
            n_tup, n_groups, n_sounding = tuplet_stats(path)
        except Exception as e:  # noqa: BLE001 — one bad file must not kill the scan
            print(f"  ⚠ {path.name}: {e}", file=sys.stderr)
            continue
        if not n_tup:
            continue
        stem = path.stem
        nb, yb = nota_best.get(stem), ney_best.get(stem)
        rows.append({
            "symbtr": stem,
            "makam": stem.split("--")[0],
            "tup_events": n_tup,
            "tup_groups": n_groups,
            "sounding_events": n_sounding,
            "tup_share": f"{n_tup / n_sounding:.3f}" if n_sounding else "0",
            "already_matched": "y" if stem in matched_stems else "",
            "nota_tier": nb["tier"] if nb else "",
            "nota_score": nb["score"] if nb else "",
            "nota_id": nb["id"] if nb else "",
            "nota_downloaded": "y" if nb and nb["id"] in downloaded_ids else "",
            "nota_title": nb["title"] if nb else "",
            "neyzen_tier": yb["tier"] if yb else "",
            "neyzen_score": yb["score"] if yb else "",
            "neyzen_stem": yb["neyzen"] if yb else "",
        })
        if i % 400 == 0:
            print(f"  {i}/{len(files)}")

    rows.sort(key=lambda r: (-r["tup_groups"], -r["tup_events"]))
    with TUPLETS_P.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    n_match = sum(1 for r in rows if r["already_matched"])
    n_nota_new = sum(1 for r in rows if r["nota_tier"] in
                     ("accept", "review", "review_ambiguous") and not r["nota_downloaded"])
    print(f"{len(rows)} tuplet-bearing pieces -> {TUPLETS_P}")
    print(f"  already matched/collected: {n_match}")
    print(f"  nota candidates not yet downloaded (accept/review tiers): {n_nota_new}")
    for tier in ("accept", "review_ambiguous", "review"):
        n = sum(1 for r in rows if r["nota_tier"] == tier and not r["nota_downloaded"])
        print(f"    {tier}: {n}")
    n_ney = sum(1 for r in rows if r["neyzen_tier"] in ("accept", "review")
                and not r["already_matched"])
    print(f"  neyzen accept/review not in matched/: {n_ney}")


if __name__ == "__main__":
    main()
