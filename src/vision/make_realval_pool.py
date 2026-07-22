#!/usr/bin/env python3
"""Materialise the REAL-VAL pool — the single dir `eval_omr.py` reads to produce Round-1's
pre-registered SELECTION number (free-running real-val mean AEU F1, tie-break arc-triggered
false-`\\tup3` rate).

WHY THIS EXISTS: `train.py` splits each real pool by piece with a STABLE md5 hash
(`is_val`, so a piece lands on the same side in every pool) and holds its real-val items only in
memory. `eval_omr.py` takes ONE `--strips-dir` and either a split file keyed by piece or
`--split none`. So without this, reproducing "the real-val set the run actually validated on"
at selection time means re-deriving a hash split by hand across three pools — exactly the kind of
measurement improvisation Step 4.0 forbids (cf. landing the arc metric before exam day, not on it).

This merges the val side of every `--real-dir` pool into one directory (manifest + hardlinked
PNGs), so selection is a single unambiguous command:

    python src/vision/eval_omr.py --checkpoint <ckpt> \\
        --strips-dir data/real/rung3/_realval --split none

The `is_val` rule is copied verbatim from train.py and MUST stay in sync: a piece in the synthetic
val split is forced to val (a piece must never be train in one pool and val in another), otherwise
it is val iff md5(piece) % 1000 < real_val_frac * 1000.

Run (defaults mirror the Round-1 training command):
    python src/vision/make_realval_pool.py \\
        --real-dir data/real/rung3/strips_nota --real-dir data/real/rung3/strips_r1 \\
        --real-dir data/real/rung3/strips_tup --split data/split_v3.json
"""
from __future__ import annotations
import argparse, hashlib, json, os, sys
from pathlib import Path


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

    def is_val(piece: str) -> bool:  # VERBATIM from train.py — keep in sync
        if piece in synth_val_pieces:
            return True
        h = int(hashlib.md5(piece.encode()).hexdigest(), 16)
        return (h % 1000) < args.real_val_frac * 1000

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
