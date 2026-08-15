r"""Assemble `_tupletval` — the selection pool for the tuplet-mark A/B (docs/rung3/round3-criteria.md).

WHY IT EXISTS. The A/B's one pre-registered number is free-running `\tup3` recall, and the standing
selection pool cannot carry it: `_realval_v2` holds **35 `\tup3` groups over 19 strips**, so a 5 pp
difference between the arms is under two groups. This script pools every `\tup3`-bearing strip that
is already on the VAL side of the real pools, which roughly doubles the gold — still small, which is
why the criteria file pre-registers the resolution limit (~±8 pp) instead of discovering it after
the result.

WHAT IT GUARANTEES, and why each one is asserted rather than assumed:

  val side only   membership is decided by `src/vision/data.py::is_real_val_piece`, the same hash
                  train.py splits real pools with. Anything it returns True for is already held out
                  of training, so selecting on it introduces no leakage — but the assertion is here
                  because that claim is the whole basis of the pool.
  no exam pieces  matched on SymbTr piece id against testset.json, never on image stem. The Round-1
                  contamination went the other way and cost a round.
  no decode-derived labels
                  a row promoted with verdict `ok` kept the MODEL'S OWN decode as its label
                  (`promote_labels.py`). Those flatter whichever arm reads most like the old model —
                  here, the arm trained on the mark the old model was trained on — so they are
                  dropped, and the count is printed rather than hidden.
  one crop per strip
                  ⚠ strip FILENAMES survive a re-slice; the PIXELS do not. 11 names appear in both
                  source pools with identical labels and different pixels — `strips_tup` crops come
                  from the old slicer, `_realval_v2` from the 2026-07-29 re-slice. Keeping both
                  would score the same music twice, at two crop generations. Later pools win.

Usage:
    .venv-ml/bin/python scripts/rung3/build_tuplet_val.py            # report only
    .venv-ml/bin/python scripts/rung3/build_tuplet_val.py --build
    .venv-ml/bin/python src/vision/eval_omr.py --checkpoint <ckpt> \
        --strips-dir data/real/rung3/_tupletval --split none
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))

RUNG3 = ROOT / "data/real/rung3"
TUP = "\\tup3"
# Source pools, LOWEST priority first: a filename collision is resolved in favour of the later
# entry, so the crop from the newest slicer wins (see the module docstring).
DEFAULT_POOLS = ["strips_tup", "_realval_v2"]


def read_manifest(pool: str) -> list[dict]:
    mf = RUNG3 / pool / "manifest.jsonl"
    if not mf.exists():
        raise SystemExit(f"{mf} does not exist")
    return [json.loads(l) for l in mf.read_text().splitlines() if l.strip()]


def groups(rows: list[dict]) -> int:
    return sum(r["label"].count(TUP) for r in rows)


def collect(pools: list[str]) -> tuple[dict[str, dict], Counter, list[tuple[str, str, str]]]:
    """(kept rows by image name, per-pool/per-reason drop counts, filename collisions)."""
    from data import is_real_val_piece

    synth_val = set(json.loads((ROOT / "data/split_v4.json").read_text())["val_pieces"])
    exam_ids = {p["symbtr_file"].replace(".txt", "")
                for p in json.loads((RUNG3 / "testset.json").read_text())["pieces"]}

    kept: dict[str, dict] = {}
    from_pool: dict[str, str] = {}
    dropped: Counter = Counter()
    collisions: list[tuple[str, str, str]] = []

    for pool in pools:
        for r in read_manifest(pool):
            if TUP not in r["label"]:
                continue
            dropped[f"{pool}: tup3-bearing"] += 1
            if r["piece"] in exam_ids:
                dropped[f"{pool}: EXAM piece"] += 1
                continue
            if not is_real_val_piece(r["piece"], synth_val):
                dropped[f"{pool}: train side"] += 1
                continue
            if r.get("verdict") == "ok":
                dropped[f"{pool}: decode-derived label"] += 1
                continue
            name = r["image"]
            if name in kept:
                collisions.append((name, from_pool[name], pool))
            kept[name] = {**r, "pool": pool}
            from_pool[name] = pool
    return kept, dropped, collisions


def report(kept: dict[str, dict], dropped: Counter, collisions: list, pools: list[str]) -> None:
    rows = list(kept.values())
    print(f"{'pool':>14}{'strips':>9}{'groups':>9}")
    by_pool = Counter(r["pool"] for r in rows)
    for pool in pools:
        sub = [r for r in rows if r["pool"] == pool]
        print(f"{pool:>14}{by_pool[pool]:>9}{groups(sub):>9}")
    print(f"{'TOTAL':>14}{len(rows):>9}{groups(rows):>9}")

    print("\nwhat was considered and dropped:")
    for k in sorted(dropped):
        print(f"   {k:<42}{dropped[k]:>5}")
    if collisions:
        print(f"\n⚠ {len(collisions)} filename collisions across pools — later pool wins (its crop is "
              f"from the newer slicer; same name, DIFFERENT pixels):")
        for name, first, second in collisions[:5]:
            print(f"   {name}  {first} -> {second}")
        if len(collisions) > 5:
            print(f"   … and {len(collisions) - 5} more")

    by_source = Counter(r.get("source") or "?" for r in rows)
    print(f"\nby source: {dict(by_source)}   pieces: {len(set(r['piece'] for r in rows))}")
    n = groups(rows)
    print(f"\n>>> selection statistic runs on {n} `\\tup3` gold groups over {len(rows)} strips.")
    print("    One group is worth "
          f"{100 / max(n, 1):.1f} pp of recall — quote every tuplet number with its n "
          "(docs/rung3/round3-criteria.md).")


def build(kept: dict[str, dict], out_name: str) -> None:
    out_dir = RUNG3 / out_name
    out_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    for name, r in sorted(kept.items()):
        src = RUNG3 / r["pool"] / name
        if not src.exists():
            raise SystemExit(f"{name}: no crop at {src}")
        (out_dir / name).write_bytes(src.read_bytes())
        written += 1
    with (out_dir / "manifest.jsonl").open("w") as f:
        for _, r in sorted(kept.items()):
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\n{written} crops + manifest -> {out_dir}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pools", default=",".join(DEFAULT_POOLS),
                    help="comma-separated pools under data/real/rung3/, LOWEST priority first")
    ap.add_argument("--build", action="store_true", help="write the pool (default: report only)")
    ap.add_argument("--out-name", default="_tupletval")
    args = ap.parse_args()

    pools = [p for p in args.pools.split(",") if p]
    kept, dropped, collisions = collect(pools)
    if not kept:
        print("no strips survived the filters", file=sys.stderr)
        return 1
    report(kept, dropped, collisions, pools)
    if args.build:
        build(kept, args.out_name)
    else:
        print("\n(report only — pass --build to write the pool)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
