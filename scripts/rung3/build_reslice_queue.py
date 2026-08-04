#!/usr/bin/env python3
r"""Build ONE review queue over EVERY strip the 2026-07-29 re-slice decoded (docs/STATUS.md).

The re-slice produced `data/real/strips_v2` — 1,704 page decode caches / 33,804 crops, 1,578 pages
decoded on Colab plus the val-side pages decoded here. Nothing but the 165-row hard-tier sample has
ever been LOOKED AT. This writes a queue `review_ui.py` can drive over all of it, so any strip in
the re-slice can be pulled up and verdicted.

WHAT A ROW IS. Most of these crops have no trustworthy SymbTr label — they were never emitted, or
they were dropped by the emitter. So each row is seeded with the decode already in the page cache
(`round2-stage2-best` int8, the live model) and the verdict is against the PICTURE: `ok` means "I
looked at the crop and the decode is right". Where the val-side emit DID produce a label
(`strips_v2emit`), that label is used instead and the decode sits beside it as the diff — those are
the rows where the two sources can disagree.

⚠ ONLY `strips_v2emit` IS JOINED IN. The other pools (strips_nota, strips_r1, strips_tup …) were
emitted from `data/real/strips`, i.e. crops cut by the OLD slicer. Strip filenames survive a
re-slice but the pixels do not, so joining their labels or reasons here would caption the new crop
with the old crop's verdict — the exact trap `QUEUE_IMG_ROOTS` was added for.

ORDER: worst-first (least confident decode at the top), the ordering the owner set on 2026-07-29
and the finished hard-tier queue justified — its worst half needed a fix 46% of the time against
the best half's 7%. `--order page` groups by page instead, for reading a page in context.

Re-running is safe: verdicts already recorded in the queue are merged back in by strip name, and
the 165 hand-read `realval-hard-v2` rows are carried over on first build (same crops, same slicer).

Usage:
    .venv-ml/bin/python scripts/rung3/build_reslice_queue.py            # build / refresh
    .venv-ml/bin/python scripts/rung3/build_reslice_queue.py --report   # what's on disk, no write
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import tempfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNG3 = ROOT / "data/real/rung3"

# The crops this queue is built from. A later slicer change moves this, and the queue must move
# with it into a new directory — see QUEUE_VERSION in build_realval_v2.py for why.
STRIP_ROOT = ROOT / "data/real/strips_v2"
# The only emit run made from those crops; see the module docstring for why nothing else is joined.
EMIT_POOL = RUNG3 / "strips_v2emit"
QUEUE_DIR = RUNG3 / "_reslice_v2"
QUEUE_CSV = QUEUE_DIR / "reslice_all.csv"
# Hand-read rows over the same crops, carried in so that work is not repeated.
CARRY_FROM = RUNG3 / "_realval_hard_v2/realval_hard_v2.csv"
# The 1,578 pages handed to Colab; everything else in strips_v2 was decoded here (the val side).
# NOT `..._EXAM_EXCLUDED.txt` — that is the list of exam pages deliberately left OUT.
COLAB_LIST = ROOT / "data/colab/decode_pages_reslice.txt"

FIELDS = ["piece", "page", "strip", "src", "reason", "nd", "min_logprob", "mean_logprob",
          "n_measures", "label", "decoded", "verdict", "corrected_label", "by"]


def load_emit() -> tuple[dict[str, dict], dict[str, str]]:
    """strip -> {reason, label, piece} from the val-side emit, and page -> piece."""
    per_strip: dict[str, dict] = {}
    page_piece: dict[str, str] = {}

    mani = EMIT_POOL / "manifest.jsonl"
    if mani.exists():
        with mani.open() as f:
            for line in f:
                m = json.loads(line)
                per_strip[Path(m["image"]).name] = {"reason": "accepted", "label": m["label"],
                                                    "piece": m.get("piece", "")}
                page_piece.setdefault(m["page"], m.get("piece", ""))

    for name in ("emit_review.csv", "emit_audit.csv"):
        f = EMIT_POOL / name
        if not f.exists():
            continue
        with f.open(newline="") as fh:
            for r in csv.DictReader(fh):
                per_strip.setdefault(r["strip"], {"reason": r.get("reason", ""),
                                                  "label": r.get("label", ""), "piece": ""})

    drops = EMIT_POOL / "emit_drops.csv"
    if drops.exists():
        with drops.open(newline="") as fh:
            for r in csv.DictReader(fh):
                # a drop carries no label it can stand behind — only the reason it was thrown out
                per_strip.setdefault(r["strip"], {"reason": r["reason"], "label": "",
                                                  "piece": r.get("symbtr", "")})
                if r.get("symbtr"):
                    page_piece.setdefault(r["page"], r["symbtr"])
    return per_strip, page_piece


def load_prior() -> dict[str, dict]:
    """Verdicts to keep: the queue's own (a rebuild must not erase work) plus the hand-read
    hard-tier rows, which were labelled against these very crops."""
    prior: dict[str, dict] = {}
    for path in (CARRY_FROM, QUEUE_CSV):        # the queue's own rows win over the carried ones
        if not path.exists():
            continue
        with path.open(newline="") as f:
            for r in csv.DictReader(f):
                if r.get("verdict"):
                    prior[r["strip"]] = {"verdict": r["verdict"],
                                         "corrected_label": r.get("corrected_label", ""),
                                         "by": r.get("by", "")}
    return prior


def collect() -> list[dict]:
    per_strip, page_piece = load_emit()
    colab = set()
    if COLAB_LIST.exists():
        colab = {Path(l.strip()).stem for l in COLAB_LIST.read_text().splitlines() if l.strip()}

    rows: list[dict] = []
    for cache in sorted(STRIP_ROOT.glob("*/*_decode.json")):
        page = cache.parent.name
        try:
            d = json.loads(cache.read_text())
        except json.JSONDecodeError:
            print(f"  ! unreadable decode cache, page skipped: {page}", file=sys.stderr)
            continue
        makam = Path(d.get("page", "")).parent.name
        for s in d.get("strips", []):
            if not (cache.parent / s["strip"]).exists():
                continue                        # cache row without a crop: nothing to look at
            e = per_strip.get(s["strip"], {})
            rows.append({
                "piece": e.get("piece") or page_piece.get(page, "") or makam,
                "page": page,
                "strip": s["strip"],
                "src": "colab" if page in colab else "local",
                "reason": e.get("reason", ""),
                "nd": "",
                "min_logprob": s.get("min_logprob", ""),
                "mean_logprob": s.get("mean_logprob", ""),
                "n_measures": s.get("n_measures", ""),
                # seed: the emitted label when the val-side emit produced one, else the decode
                "label": e.get("label") or s.get("tokens", ""),
                "decoded": s.get("tokens", ""),
                "verdict": "", "corrected_label": "", "by": "",
            })
    return rows


def order(rows: list[dict], how: str) -> list[dict]:
    if how == "page":
        return sorted(rows, key=lambda r: (r["page"], r["strip"]))
    # worst-first: least confident decode at the top; rows with no score go last, not first
    return sorted(rows, key=lambda r: (float(r["min_logprob"]) if r["min_logprob"] != "" else 0.0,
                                       r["strip"]))


def write(rows: list[dict]) -> None:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=QUEUE_DIR, suffix=".csv.tmp")
    try:
        with os.fdopen(fd, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            w.writerows(rows)
        os.replace(tmp, QUEUE_CSV)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--order", choices=["worst", "page"], default="worst")
    ap.add_argument("--report", action="store_true", help="print the summary, write nothing")
    args = ap.parse_args()

    if not STRIP_ROOT.exists():
        print(f"no crops at {STRIP_ROOT} — nothing to review", file=sys.stderr)
        return 1

    rows = collect()
    if not rows:
        print(f"no decoded strips under {STRIP_ROOT}", file=sys.stderr)
        return 1

    # review_ui.save_verdict matches a row by strip name alone, so a duplicate name would make
    # every verdict on it fail. Page stems are unique after the 2026-07-29 collision fix; check.
    dup = [s for s, n in Counter(r["strip"] for r in rows).items() if n > 1]
    if dup:
        print(f"ABORT: {len(dup)} duplicate strip names, e.g. {dup[:3]} — a verdict could not be "
              f"written unambiguously. Fix the page stems first.", file=sys.stderr)
        return 1

    prior = load_prior()
    carried = 0
    for r in rows:
        if r["strip"] in prior:
            r.update(prior[r["strip"]])
            carried += 1

    rows = order(rows, args.order)
    pages = len({r["page"] for r in rows})
    print(f"{len(rows):,} strips over {pages:,} pages  "
          f"({Counter(r['src'] for r in rows)['colab']:,} colab / "
          f"{Counter(r['src'] for r in rows)['local']:,} local)")
    print(f"  labels: {sum(1 for r in rows if r['reason'] == 'accepted'):,} from the val-side emit, "
          f"{sum(1 for r in rows if r['reason'] != 'accepted'):,} seeded with the decode")
    top = Counter(r["reason"] for r in rows).most_common()
    print("  reason: " + ", ".join(f"{k or '(none)'} {v:,}" for k, v in top))
    print(f"  carried-over verdicts: {carried} ({dict(Counter(r['verdict'] for r in rows if r['verdict']))})")

    if args.report:
        print("--report: nothing written")
        return 0
    write(rows)
    print(f"wrote {QUEUE_CSV.relative_to(ROOT)} (order={args.order}) — queue id `reslice-all`")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
