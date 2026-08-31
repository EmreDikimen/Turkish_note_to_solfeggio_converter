#!/usr/bin/env python3
r"""Send MACHINE-accepted strips back to pending when their label's key signature contains a
given accidental.

Why this exists (owner, 2026-08-30): a `\sig` block in a real-page label is the one part the
MODEL decided, not SymbTr — `emit_strip_labels.py` takes a majority vote over the row-start
decodes and overwrites the derivation with it (CLAUDE.md, docs/DECISIONS.md). So on these rows
"the label and the decode agree" is close to circular: the decode is where the label came from.
The weak voter's known failure is exactly koma vs kucuk, which is why a signature carrying
`\komaSharp` is worth a human's eyes even when the two sides match to the character.

Only rows whose `by` column marks a MACHINE verdict are touched — a human read is never undone.
Reverting clears `verdict`, `corrected_label` and `by` together, so the row is pending again and
the review UI shows it in the normal queue.

The accidental is matched INSIDE the `\sig` … `\sigend` block only; the same token appearing as
an inline accidental in the music does not select a row.

  # what would be reverted, writes nothing
  python3 scripts/rung3/unaccept_sig.py --sig-has '\komaSharp' --dry-run
  # apply; repeat --sig-has to take more than one accidental
  python3 scripts/rung3/unaccept_sig.py --sig-has '\komaSharp' --sig-has '\kucukSharp'
"""
from __future__ import annotations

import argparse
import csv
import os
import shutil
import tempfile
from collections import Counter
from pathlib import Path

from auto_accept_agree import toks  # same splitter, so a glued `\sigb` is read the same way

CSV_PATH = Path("data/real/rung3/strips_b8/full_audit.csv")
# `by` values a script writes. Anything else in that column (or an empty one) is a human.
MACHINE = ("agree", "agree-ws", "claude", "rule")


def sig_tokens(label: str) -> set[str]:
    """The tokens between `\\sig` and `\\sigend`. Empty when the strip has no signature."""
    out, inside = set(), False
    for t in toks(label):
        if t == "\\sig":
            inside = True
        elif t == "\\sigend":
            inside = False
        elif inside:
            out.add(t)
    return out


def revert(rows: list[dict], wanted: set[str]) -> tuple[Counter, list[str]]:
    stats, hit = Counter(), []
    for r in rows:
        if not (sig_tokens(r.get("label", "")) & wanted):
            continue
        stats["matched"] += 1
        by = (r.get("by") or "").strip()
        if not r.get("verdict"):
            stats["  already pending"] += 1
        elif by.startswith(MACHINE):
            r["verdict"] = r["corrected_label"] = r["by"] = ""
            stats[f"  reverted (was {by})"] += 1
            hit.append(r["strip"])
        else:
            stats["  kept: human verdict"] += 1
    return stats, hit


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", type=Path, default=CSV_PATH)
    ap.add_argument("--sig-has", action="append", required=True, metavar="TOKEN",
                    help=r"accidental to look for inside \sig … \sigend, e.g. '\komaSharp'")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    wanted = set(args.sig_has)
    with open(args.csv, newline="") as f:
        rd = csv.DictReader(f)
        fields = list(rd.fieldnames or [])
        rows = list(rd)
    stats, hit = revert(rows, wanted)
    print(f"{args.csv} — {len(rows)} rows, looking for {' '.join(sorted(wanted))} in the signature")
    for k, v in stats.most_common():
        print(f"  {k:28s} {v}")
    for s in hit:
        print(f"    ← {s}")
    if args.dry_run:
        print("\ndry run — nothing written")
        return
    if not hit:
        print("nothing to revert")
        return

    bak = args.csv.with_suffix(".csv.bak-unaccept")
    if not bak.exists():
        shutil.copy2(args.csv, bak)
        print(f"backup → {bak}")

    # re-read before writing, so a verdict saved by a live review-UI session is not clobbered
    with open(args.csv, newline="") as f:
        rd = csv.DictReader(f)
        fields = list(rd.fieldnames or [])
        rows = list(rd)
    revert(rows, wanted)
    fd, tmp = tempfile.mkstemp(dir=args.csv.parent, suffix=".csv.tmp")
    try:
        with os.fdopen(fd, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        os.replace(tmp, args.csv)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    print(f"written → {args.csv}")


if __name__ == "__main__":
    main()
