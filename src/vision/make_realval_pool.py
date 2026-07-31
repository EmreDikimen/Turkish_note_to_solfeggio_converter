#!/usr/bin/env python3
"""Materialise the real-val BASE pool — the easy+mid strips the training pools can supply.

⚠ **THIS IS NO LONGER THE SET TO SELECT ON (2026-07-31).** Its output, `_realval`, contains **no
hard tier at all** (59% easy / 41% mid / 0% hard against the exam's 18/41/41), which is why it read
16.3pp above the exam and could not rank candidates. The set to evaluate and select on is
`data/real/rung3/_realval_v2`, built by `scripts/rung3/build_realval_v2.py --build`, which
downsamples this base to the exam's mix and adds 110 hand-labelled hard strips
(docs/METRICS.md, docs/rung3/labeling.md).

This script stays because `--build` reads `_realval` as its input. Run it when the training pools
change, then re-run `--build`; do not point `eval_omr.py` at its output.

WHY THIS EXISTS: `train.py` splits each real pool by piece with a STABLE md5 hash
(`is_val`, so a piece lands on the same side in every pool) and holds its real-val items only in
memory. `eval_omr.py` takes ONE `--strips-dir` and either a split file keyed by piece or
`--split none`. So without this, reproducing "the real-val set the run actually validated on"
at selection time means re-deriving a hash split by hand across three pools — exactly the kind of
measurement improvisation Step 4.0 forbids (cf. landing the arc metric before exam day, not on it).

This merges the val side of every `--real-dir` pool into one directory (manifest + hardlinked
PNGs). Selection then runs against the REBUILT pool:

    python src/vision/eval_omr.py --checkpoint <ckpt> \\
        --strips-dir data/real/rung3/_realval_v2 --split none

The val/train assignment comes from `data.is_real_val_piece` — the one implementation `train.py`,
`build_realval_v2.py` and this script all share. It used to be copied verbatim here, which is the
drift that function's docstring exists to prevent: three copies of a hash is three chances for a
piece to land on opposite sides in different pools.

Run (defaults mirror the Round-1 training command):
    python src/vision/make_realval_pool.py \\
        --real-dir data/real/rung3/strips_nota --real-dir data/real/rung3/strips_r1 \\
        --real-dir data/real/rung3/strips_tup --split data/split_v3.json
"""
from __future__ import annotations
import argparse, json, os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data import is_real_val_piece


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--real-dir", action="append", default=[], metavar="DIR[:REPEAT]",
                    help="real pool dir (the :REPEAT suffix train.py accepts is ignored here — "
                         "oversampling is a TRAIN-side knob and must not distort the val set)")
    ap.add_argument("--split", default="data/split_v3.json",
                    help="synthetic split: its val_pieces are FORCED to the real-val side")
    ap.add_argument("--real-val-frac", type=float, default=0.10, help="must match train.py")
    ap.add_argument("--out", default="data/real/rung3/_realval")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.real_dir:
        print("ERROR: pass at least one --real-dir", file=sys.stderr)
        return 2

    synth_val_pieces = set(json.loads(Path(args.split).read_text())["val_pieces"])

    def is_val(piece: str) -> bool:
        return is_real_val_piece(piece, synth_val_pieces, args.real_val_frac)

    out = Path(args.out)
    rows: list[dict] = []
    per_pool: list[str] = []
    for spec in args.real_dir:
        path, _, _rep = spec.partition(":")  # REPEAT deliberately ignored (see --real-dir help)
        pool = Path(path)
        man = pool / "manifest.jsonl"
        if not man.exists():
            print(f"ERROR: {man} missing", file=sys.stderr)
            return 1
        n_tr = n_va = 0
        for line in man.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if is_val(r.get("piece", "")):
                r["_pool"] = pool.name
                r["_src"] = str(pool / r["image"])
                rows.append(r)
                n_va += 1
            else:
                n_tr += 1
        per_pool.append(f"   {pool.name}: {n_va} val / {n_tr} train")
    print(f"== real-val pool from {len(args.real_dir)} pools")
    print("\n".join(per_pool))
    print(f"   total real-val strips: {len(rows)}")

    if args.dry_run:
        return 0

    out.mkdir(parents=True, exist_ok=True)
    # image names are unique across pools in practice, but prefix on collision to be safe
    seen: dict[str, str] = {}
    written = 0
    with (out / "manifest.jsonl").open("w") as fh:
        for r in rows:
            src = Path(r.pop("_src"))
            pool = r.pop("_pool")
            name = r["image"]
            if name in seen and seen[name] != str(src):
                name = f"{pool}__{name}"
                r["image"] = name
            seen[name] = str(src)
            dst = out / name
            if not dst.exists():
                if not src.exists():
                    print(f"WARN: missing {src}", file=sys.stderr)
                    continue
                try:
                    os.link(src, dst)
                except OSError:
                    dst.write_bytes(src.read_bytes())
            written += 1
            fh.write(json.dumps(r) + "\n")
    print(f"wrote {out}/manifest.jsonl ({written} strips + linked PNGs)")
    print(f"\nselection command:\n  python src/vision/eval_omr.py --checkpoint <ckpt> "
          f"--strips-dir {out} --split none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
