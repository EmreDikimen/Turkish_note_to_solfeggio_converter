"""Fold the hand-review corrections from exam_fix.csv into the frozen exam gold manifest.

Backs up the manifest first (never lose the frozen gold), then applies:
  verdict=fix  -> replace the strip's label with corrected_label
  verdict=bad  -> drop the strip from the exam
  ok/blank     -> unchanged

    .venv-ml/bin/python scripts/rung3/apply_exam_fix.py            # apply
    .venv-ml/bin/python scripts/rung3/apply_exam_fix.py --restore  # revert to the backup
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
from pathlib import Path

MANIFEST = Path("data/real/rung3/strips_exam_v2_clean/manifest.jsonl")
BACKUP = MANIFEST.with_suffix(".jsonl.bak-precorrect")
FIXCSV = Path("data/real/rung3/strips_exam_v2_clean/exam_fix.csv")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--restore", action="store_true", help="revert manifest from the backup")
    args = ap.parse_args()

    if args.restore:
        if not BACKUP.exists():
            raise SystemExit("no backup to restore")
        shutil.copy(BACKUP, MANIFEST)
        print(f"restored {MANIFEST} from {BACKUP}")
        return

    corr = {r["strip"]: r for r in csv.DictReader(open(FIXCSV))}
    if not BACKUP.exists():                       # first apply: preserve the original frozen gold
        shutil.copy(MANIFEST, BACKUP)
        print(f"backed up gold -> {BACKUP}")
    else:
        print(f"backup already exists ({BACKUP}); applying onto the CURRENT manifest")

    rows = [json.loads(l) for l in open(MANIFEST)]
    out, n_fix, n_drop = [], 0, 0
    for r in rows:
        c = corr.get(r["image"])
        if c and c["verdict"] == "bad":
            n_drop += 1
            continue
        if c and c["verdict"] == "fix" and c["corrected_label"].strip():
            r = {**r, "label": c["corrected_label"].strip()}
            n_fix += 1
        out.append(r)

    with open(MANIFEST, "w") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"applied {n_fix} fixes, dropped {n_drop} bad -> {len(out)} strips in {MANIFEST}")


if __name__ == "__main__":
    main()
