#!/usr/bin/env python3
"""Append triplet-rich SymbTr pieces to data/pieces.json (without disturbing the existing
selection). Rung-2.2 finding: select_pieces.py optimizes AEU-accidental coverage only, so
triplet-dense forms (sazsemaisi / aksaksemai / longa / sirto) were skipped — the corpus holds
~8x more triplet data than we render. This tops up triplet coverage + variety before the
stem-fix fine-tune.

Ranks the whole corpus by triplet-note count (reduced duration denominator divisible by 3),
keeps the top renderable pieces NOT already selected, and appends each with t=0 plus up to
`--extra-transposes` register-spread transposes (different registers → both stem/tuplet
orientations, which is exactly the variety the stem fix needs). Reuses select_pieces.analyze()
so the appended entries are byte-identical in shape to the originals.

Usage:
    .venv-ml/bin/python scripts/add_triplet_pieces.py [--n 40] [--extra-transposes 2]
Then: export_scores.py (new JSONs) -> render.ts (re-render) -> make_split.py (re-split).
"""

from __future__ import annotations

import argparse
import json
import sys
from math import gcd
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from select_pieces import analyze  # noqa: E402  (reuse the exact candidate/accCount math)


def triplet_notes(path: Path) -> int:
    """Fast raw-column scan: count events whose reduced duration denominator is divisible by 3."""
    n = 0
    try:
        with path.open(encoding="utf-8", errors="ignore") as f:
            next(f, None)
            for line in f:
                c = line.rstrip("\n").split("\t")
                if len(c) < 8:
                    continue
                try:
                    pay, payda = int(c[6]), int(c[7])
                except ValueError:
                    continue
                if pay <= 0 or payda <= 0:
                    continue
                if (payda // gcd(pay, payda)) % 3 == 0:
                    n += 1
    except OSError:
        return 0
    return n


def pick_transposes(cand_offsets: list[int], extra: int) -> list[int]:
    """t=0 plus up to `extra` transposes spread across the register (min/max first) so the
    triplets land high AND low — the case that exercises both tuplet placements."""
    others = sorted(t for t in cand_offsets if t != 0)
    chosen = [0]
    # take from the extremes inward
    while others and len(chosen) < extra + 1:
        chosen.append(others.pop(0))
        if others and len(chosen) < extra + 1:
            chosen.append(others.pop(-1))
    return sorted(chosen)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pieces", default="data/pieces.json")
    ap.add_argument("--n", type=int, default=40, help="triplet-rich pieces to add")
    ap.add_argument("--extra-transposes", type=int, default=2)
    ap.add_argument("--min-triplets", type=int, default=20)
    args = ap.parse_args()

    manifest = json.loads(Path(args.pieces).read_text(encoding="utf-8"))
    corpus = Path(manifest["corpus"]).expanduser()
    have = {p["slug"] for p in manifest["pieces"]}

    ranked = sorted(
        ((triplet_notes(f), f) for f in corpus.glob("*.txt")),
        key=lambda x: x[0], reverse=True,
    )
    print(f"corpus scanned; top triplet piece has {ranked[0][0]} triplet-notes")

    added = []
    for count, path in ranked:
        if len(added) >= args.n or count < args.min_triplets:
            break
        if path.stem in have:
            continue
        piece = analyze(path)  # None if not renderable (koma window / note count / offsets)
        if piece is None:
            continue
        offsets = pick_transposes(list(piece.candidates), args.extra_transposes)
        entry = {
            "slug": piece.stem, "txt": piece.path.name, "file": f"/scores/{piece.stem}.json",
            "makam": piece.makam, "form": piece.form, "usul": piece.usul,
            "hasLyrics": piece.has_lyrics, "events": piece.n_events, "measures": piece.n_measures,
            "transposes": offsets,
            "accCounts": {str(t): dict(piece.candidates[t].acc) for t in offsets},
            "pairableShare": {str(t): round(piece.candidates[t].pairable, 3) for t in offsets},
        }
        entry["_triplets"] = count  # transient, dropped before write
        added.append(entry)

    print(f"adding {len(added)} triplet-rich pieces (>= {args.min_triplets} triplet-notes each):")
    for e in added:
        print(f"  {e.pop('_triplets'):4d} tn  transposes {e['transposes']}  {e['slug']}")

    manifest["pieces"] = sorted(manifest["pieces"] + added, key=lambda e: e["slug"])
    # recompute projectedTotals (sum of all accCounts across pieces/transposes)
    from collections import Counter
    tot: Counter = Counter()
    for p in manifest["pieces"]:
        for t, acc in p["accCounts"].items():
            tot.update(acc)
    manifest["projectedTotals"] = {c: tot.get(c, 0) for c in manifest.get("projectedTotals", {})} or dict(tot)

    Path(args.pieces).write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\npieces.json now has {len(manifest['pieces'])} pieces "
          f"(was {len(manifest['pieces']) - len(added)}). Next: export_scores.py -> render -> make_split.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
