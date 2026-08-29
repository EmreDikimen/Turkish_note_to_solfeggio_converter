#!/usr/bin/env python3
"""Draft-verdict `ok` on every b8 strip where the proposed label and the model decode AGREE.

The signal, measured on the b8 rows a human has actually read (2026-08-27):

  b8-audit, fully read 201/201   agree 154 ok /  3 fix  (98%)
                                 differ  20 ok / 24 fix (45%)
  b8-full, 16 read so far        agree   5 ok /  7 fix
  ------------------------------------------------------------
  agreeing rows, both queues     159 ok / 10 fix = 94% correct  (n=169)

So agreement is a strong signal and disagreement is a coin flip. ⚠ But agreement is NOT
proof: `round2-stage2-best` was the emitter's hint AND its gate, and it was trained on these
very labels at 9x oversampling, so part of the agreement is memory rather than judgement
(CLAUDE.md, docs/DECISIONS.md). And the errors CLUMP: 5 of the 7 bad agreements in b8-full sit
on ONE page — when a page is misread, the label and the decode tend to be wrong the same way.

Hence these are DRAFTS, written with by="agree" so the review UI, the log and any trust
accounting can tell them from a human read; the UI's "🤖 auto-accepted (agree)" filter lists
them LEAST-CONFIDENT FIRST for spot-checking, and any human (re-)verdict clears the marker.

Comparison is token-for-token with `\tie` dropped from both sides (the token is RETIRED —
CLAUDE.md — and eval_omr.py drops it from gold and decode alike). On b8-full that changes
nothing: 3,065 rows match either way.

`--carry-from` first copies human verdicts from the sampled audit queue onto the same strip
(full_audit.csv is generated once and its build-time carry-over missed the 201 audit rows that
were read afterwards). Carried and drafted rows are only ever written onto STILL-PENDING rows,
and the CSV is re-read immediately before the atomic write, so a live review-UI session cannot
be clobbered. A one-time .csv.bak-agree backup is kept beside the queue.

  python3 scripts/rung3/auto_accept_agree.py --dry-run     # counts only, writes nothing
  python3 scripts/rung3/auto_accept_agree.py               # apply
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import shutil
import tempfile
from collections import Counter
from pathlib import Path

CSV_PATH = Path("data/real/rung3/strips_b8/full_audit.csv")
CARRY_PATH = Path("data/real/rung3/strips_b8/emit_audit.csv")
BY = "agree"

# longest-first so \sigend splits before \sig; the `decoded` column glues a command token to its
# successor (`\tieg''16`, `|g'2`), so it has to be split before anything can be compared.
_BACKSLASH = sorted(
    ["komaSharp", "bakiyeSharp", "kucukSharp", "buyukSharp",
     "komaFlat", "bakiyeFlat", "kucukFlat", "buyukFlat", "natural", "sigend", "sig",
     "repstart", "repend", "volta1", "volta2", "segno", "coda", "dc", "fine",
     "tup3", "tupend", "tie", "grace"], key=len, reverse=True)
_SPLIT_RE = re.compile(r"(\\(?:" + "|".join(_BACKSLASH) + r")|\|)")


def toks(s: str) -> list[str]:
    """Token list with `\tie` dropped — the token is retired and carries no meaning."""
    return [t for t in _SPLIT_RE.sub(r" \1 ", s or "").split() if t and t != "\\tie"]


def agrees(row: dict) -> bool:
    lab, dec = toks(row.get("label", "")), toks(row.get("decoded", ""))
    return bool(lab) and lab == dec


def carry_map(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    with open(path, newline="") as f:
        return {r["strip"]: r for r in csv.DictReader(f) if r.get("verdict")}


def apply(rows: list[dict], carry: dict[str, dict]) -> Counter:
    """Fill still-pending rows in place. Carry wins over the draft on the same strip."""
    stats = Counter()
    for r in rows:
        for col in ("verdict", "corrected_label", "by"):
            r.setdefault(col, "")
        if r.get("verdict"):
            stats["already verdicted"] += 1
            continue
        src = carry.get(r["strip"])
        if src:
            r["verdict"], r["corrected_label"] = src["verdict"], src.get("corrected_label", "")
            r["by"] = src.get("by", "")
            stats["carried from audit: " + src["verdict"]] += 1
        elif agrees(r):
            r["verdict"], r["corrected_label"], r["by"] = "ok", "", BY
            stats["auto-accepted (agree)"] += 1
        else:
            stats["left pending (differ)"] += 1
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", type=Path, default=CSV_PATH)
    ap.add_argument("--carry-from", type=Path, default=CARRY_PATH,
                    help="queue whose HUMAN verdicts are copied onto the same strip first "
                         "(pass an empty string to skip)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    carry = carry_map(args.carry_from) if str(args.carry_from) else {}
    with open(args.csv, newline="") as f:
        rows = list(csv.DictReader(f))
    stats = apply(rows, carry)
    print(f"{args.csv} — {len(rows)} rows, carry pool {len(carry)}")
    for k, v in stats.most_common():
        print(f"  {k:34s} {v}")
    if args.dry_run:
        print("\ndry run — nothing written")
        return

    bak = args.csv.with_suffix(".csv.bak-agree")
    if not bak.exists():
        shutil.copy2(args.csv, bak)
        print(f"backup → {bak}")

    # re-read just before writing: a review-UI verdict may have landed since, and only rows
    # still pending in the FRESH file are filled.
    with open(args.csv, newline="") as f:
        rd = csv.DictReader(f)
        fields = list(rd.fieldnames or [])
        rows = list(rd)
    for col in ("verdict", "corrected_label", "by"):
        if col not in fields:
            fields.append(col)
    apply(rows, carry)
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
