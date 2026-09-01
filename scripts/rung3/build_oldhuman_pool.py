r"""Build `strips_oldhuman` — every HAND-VERIFIED strip from the three retired pools (owner, 2026-09-01).

WHY THIS POOL EXISTS. The owner lifted the 2026-08-31 ban on `strips_nota` / `strips_r1` /
`strips_tup` **for the next run only** ([../../docs/DECISIONS.md](../../docs/DECISIONS.md)). Those
pools sit on the RETIRED slicer's crops, which is why they were barred: training on crops the app no
longer cuts is a train/test mismatch. The argument that won is that `strips_b8` stays in the mix, so
this ADDS a second cut of the same bars rather than replacing the current one — geometry variety,
not a replacement. ⚠ **Unmeasured.** Nobody has scored a model trained on mixed crop roots; this is
the pool that lets Run B find out.

⛔ **HAND-VERIFIED ONLY, AND THAT IS NARROWER THAN "IN THE MANIFEST".** `strips_nota`'s manifest
holds 1,740 rows but only **818** carry a human `ok`/`fix`; the rest were verdicted by `rule`,
`rule-lowconf` or `claude`, or accepted by the emitter with no review at all. Those machine labels on
retired crops are the weakest data in the project and are exactly what `strips_b8` was re-emitted to
replace, so they are dropped. `strips_r1` and `strips_tup` are fully hand-read and come across whole.

    strips_nota   818 of 1740     strips_r1   421 of 421     strips_tup   169 of 169   = 1,408

⚠ **A `fix` row's manifest label is ALREADY the correction** — `promote_labels.py` replaced it at
promote time, and a `bad` row was removed. So this script re-reads the verdict CSVs only to decide
WHICH rows to keep; it never re-derives a label.

⛔ **THE EXAM FILTER IS RE-RUN HERE, ON THE SymbTr ID.** These pools were hand-cleaned of exam pieces
once, on 2026-07-26, by a procedure that matched IMAGE STEMS and did not fix the producer — which is
how two exam pieces walked back into `strips_b8` in August (`excluded_exam_pieces.txt`). Any row
whose SymbTr piece is an exam piece is dropped here and named in the report, on the same key
`train.py`'s guard uses.

⚠ PNGs are HARDLINKED from each source pool, never copied and never re-sliced: a strip filename
survives a re-slice and its pixels do not, so the crop must come from the pool that produced it.

Run:
    .venv-ml/bin/python scripts/rung3/build_oldhuman_pool.py --dry-run
    .venv-ml/bin/python scripts/rung3/build_oldhuman_pool.py
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
POOLS = ("strips_nota", "strips_r1", "strips_tup")


def human_ok_fix(pool_dir: Path) -> set[str]:
    """Strips carrying a HUMAN `ok` or `fix`. A non-empty `by` marks a machine verdict."""
    keep: set[str] = set()
    for name in ("full_audit.csv", "emit_review.csv"):
        f = pool_dir / name
        if not f.exists():
            continue
        with f.open(newline="") as fh:
            for r in csv.DictReader(fh):
                if (r.get("verdict") or "").strip() in ("ok", "fix") and not (r.get("by") or "").strip():
                    keep.add(r["strip"])
    return keep


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="data/real/rung3/strips_oldhuman")
    ap.add_argument("--testset", default="data/real/rung3/testset.json")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    ts = json.loads((REPO / args.testset).read_text())
    exam = {(e["symbtr_file"][:-4] if e.get("symbtr_file", "").endswith(".txt")
             else e.get("symbtr_file", "")) for e in ts["pieces"]} - {""}

    out = REPO / args.out
    rows, links, counts, exam_hits, missing = [], [], Counter(), Counter(), []
    seen: dict[str, str] = {}

    for pool in POOLS:
        d = REPO / "data/real/rung3" / pool
        keep = human_ok_fix(d)
        man = [json.loads(l) for l in (d / "manifest.jsonl").read_text().splitlines() if l.strip()]
        counts[f"{pool}_manifest"] = len(man)
        for r in man:
            if r["image"] not in keep:
                counts[f"{pool}_not_hand_read"] += 1
                continue
            if r.get("piece") in exam:
                exam_hits[r["piece"]] += 1
                continue
            # ⚠ A filename can exist in two pools with DIFFERENT pixels (both were cut from the same
            # retired root, but strips_tup re-sliced some pages). First pool wins and the clash is
            # reported rather than silently overwritten.
            if r["image"] in seen:
                counts["dupe_filename_skipped"] += 1
                continue
            seen[r["image"]] = pool
            src = d / r["image"]
            if not src.exists():
                missing.append(f"{pool}/{r['image']}")
                continue
            rows.append({**r, "source_pool": pool})
            links.append((src, out / r["image"]))
            counts[f"{pool}_kept"] += 1

    print(json.dumps({"kept": len(rows), "counts": dict(counts),
                      "exam_pieces_dropped": dict(exam_hits),
                      "missing_pngs": len(missing)}, indent=1))
    if exam_hits:
        print("\n⛔ EXAM PIECES DROPPED (SymbTr id) — record them in excluded_exam_pieces.txt:")
        for p, n in exam_hits.items():
            print(f"     {p}  ({n} strips)")
    if missing:
        print(f"\n⚠ {len(missing)} manifest rows have no PNG in their pool; first few:")
        for m in missing[:5]:
            print("    ", m)
    if args.dry_run:
        print("\nDRY-RUN: nothing written")
        return 0

    out.mkdir(parents=True, exist_ok=True)
    for src, dst in links:
        if not dst.exists():
            try:
                os.link(src, dst)
            except OSError:
                shutil.copy2(src, dst)
    with (out / "manifest.jsonl").open("w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    (out / "build_report.json").write_text(json.dumps(
        {"generatedBy": "scripts/rung3/build_oldhuman_pool.py", "pools": list(POOLS),
         "kept": len(rows), "counts": dict(counts),
         "exam_pieces_dropped": dict(exam_hits)}, indent=1))
    print(f"\n   wrote {out}/manifest.jsonl ({len(rows)} strips) + {len(links)} hardlinked PNGs")
    print("   ⚠ RETIRED CROPS. Pass it BESIDE strips_b8, never instead of it:")
    print(f"     --real-dir data/real/rung3/strips_b8:N --real-dir {args.out}:N")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
