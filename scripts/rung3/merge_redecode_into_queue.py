#!/usr/bin/env python3
"""Refresh a labelling queue's `decoded` column from the CURRENT page decodes — pending rows only.

Why this is not `build_exam_v3_queue.py --rebuild`
-------------------------------------------------
That path refuses to run once a queue carries verdicts, and rightly: rebuilding rewrites
`emit_review.csv`, where the human judgments live. `examv3` already holds 62 of them, plus 138
PENDING rows carrying a carried-gold suggestion in `corrected_label` -- exam v2's hand-made gold,
moved onto the new crop. None of that may be touched.

So this merges the narrow thing instead. For every row WITHOUT a verdict it replaces `decoded`
with the token stream now stored in `<page>_decode.json`, and records `redecoded=1`. A row that
already has a verdict is copied through byte-for-byte, and `corrected_label` is never written on
any row. The old file is backed up first.

    .venv-ml/bin/python scripts/rung3/merge_redecode_into_queue.py \
        --queue data/real/rung3/strips_exam_v3/emit_review.csv \
        --strips-root data/real/strips_examv3 --tag labeler
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
from collections import Counter
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=None)
def decodes(root: str, page: str) -> dict[str, str]:
    p = Path(root) / page / f"{page}_decode.json"
    if not p.exists():
        return {}
    d = json.loads(p.read_text())
    return {s["strip"]: s.get("tokens", "") for s in d.get("strips", [])}


def drop_ties(s: str) -> str:
    """Remove the retired `\\tie` token from a decode.

    ⚠ **As a SUBSTRING, never by `s.split()`** — decodes carry two spellings of the same thing,
    `a'4. \\tie a'8` and the compact `a'4. \\tiea'8`, and the added-token tokenizer splits on the
    substring so both mean one token to the model. A whitespace filter misses every compact one and
    still reports success (docs/rung3/labeling.md). Delete it, then collapse the space it leaves.

    No accidental restrike is needed on a decode, unlike the render side: the tail spells its own
    pitch, and a barline between tie and tail would be the one unsafe case — verified 0 of 133 on
    the exam queue before this was turned on.
    """
    return re.sub(r" {2,}", " ", s.replace("\\tie", " ")).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue", required=True)
    ap.add_argument("--strips-root", required=True)
    ap.add_argument("--tag", default="prev")
    ap.add_argument("--drop-ties", action="store_true",
                    help="strip the retired \\tie token from the decode (owner, 2026-08-22)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    qp = Path(args.queue)
    with qp.open() as f:
        rd = csv.DictReader(f)
        fields = list(rd.fieldnames or [])
        rows = list(rd)
    if "redecoded" not in fields:
        fields.append("redecoded")

    c = Counter()
    for r in rows:
        r.setdefault("redecoded", "")
        if r.get("verdict"):
            c["kept_verdicted"] += 1
            continue
        new = decodes(args.strips_root, r["page"]).get(r["strip"])
        if new is None:
            c["no_decode_found"] += 1
            continue
        if args.drop_ties:
            before = new.count("\\tie")
            if before:
                new = drop_ties(new)
                c["tie_tokens_dropped"] += before
                c["rows_detied"] += 1
        if new == r.get("decoded", ""):
            c["pending_unchanged"] += 1
        else:
            c["pending_updated"] += 1
        r["decoded"] = new
        r["redecoded"] = "1"

    print(f"{qp.name}: {len(rows)} rows")
    for k, v in sorted(c.items()):
        print(f"  {k:20} {v}")
    if args.dry_run:
        return

    shutil.copy2(qp, qp.with_suffix(f".csv.bak-{args.tag}"))
    tmp = qp.with_suffix(".csv.tmp")
    with tmp.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    tmp.replace(qp)
    print(f"written; previous file at {qp.with_suffix(f'.csv.bak-{args.tag}').name}")


if __name__ == "__main__":
    main()
