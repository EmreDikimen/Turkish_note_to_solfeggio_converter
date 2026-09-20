#!/usr/bin/env python3
r"""Build a DENSE real-page evaluation pool out of `strips_h1`'s held-out side.

WHY THIS EXISTS (owner, 2026-09-18: *"our purpose in this round is to gain the overbudget strips. We
do not measure them"*). Round 4's paired reads all landed on `_realval_v2r`, and that pool is
**5.8% dense** — 15 of its 260 strips cost more than the old 59-id gate, the class this whole round
was opened for. `strips_h1`'s held-out side is **14.5%** (64 of 442), the real-page rate, and 68 of
its strips do not exist in `strips_b8` at all: they are exactly what scheme H and the rail rescued.

WHY IT IS A FAIR POOL, checked before it was built (2026-09-18):
  * `is_real_val_piece` is deterministic per piece, so these 61 pieces are val-side in EVERY pool
    that uses the same `--real-val-frac`. **0** of them sit on `strips_b8`'s train side, so the LIVE
    model (`r3a-stage2-best-real`, trained on b8) never saw them either — all three models are
    equally blind to this material.
  * **0** exam pieces, by the same `testset.json` guard the trainer applies.
  * Neither Round-4 arm's `best-edits` was picked here: that selector read `_realval_v2r` +
    `_tupletval`. ⚠ It DID read 44 of the same PIECES though (other strips of the same songs), so
    this is a held-out-strip pool, not a fresh corpus. Say so when quoting it.
  * Labels are the owner's: every h1 row was read or auto-accepted, and the corrections were promoted
    on 2026-09-16 (`promote_labels.py`). ⚠ The `\sig` block can still be a model vote where rule D let
    one through (CLAUDE.md).

⛔ NOT THE EXAM, and it may not become one. The exam is page-complete, frozen, and read once per
round; this is a strip pool for iteration, like real-val.

⚠ **Lengths are counted in OLD ids** — one scale for every model, the same rule
`paired_arm_score.py --score-vocab old` follows. A pool built with H's tokenizer would put different
strips in the dense bucket for the H arm than for the control, which is the bias this round already
paid for once ([../../docs/METRICS-ROUND4-AB.md](../../docs/METRICS-ROUND4-AB.md)).

    .venv-ml/bin/python scripts/rung3/build_denseval.py                    # report only
    .venv-ml/bin/python scripts/rung3/build_denseval.py --apply            # all 442 -> _denseval_h1
    .venv-ml/bin/python scripts/rung3/build_denseval.py --apply --min-ids 50 \
        --out data/real/rung3/_denseval_h1_dense                           # the dense bucket alone
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "src" / "vision"))

POOL = "data/real/rung3/strips_h1"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pool", default=POOL, help="the training pool whose HELD-OUT side is taken")
    ap.add_argument("--split", default="data/split_v4.json")
    ap.add_argument("--real-val-frac", type=float, default=0.10,
                    help="⚠ must match the training run's value, or the held-out set is a different one")
    ap.add_argument("--checkpoint", default="data/checkpoints/rung22-stemfix-best",
                    help="tokenizer source for the OLD-id length count (no model is loaded)")
    ap.add_argument("--min-ids", type=int, default=0, help="keep strips costing MORE than this in old ids")
    ap.add_argument("--max-ids", type=int, default=None, help="keep strips at or under this (old ids)")
    ap.add_argument("--out", default="data/real/rung3/_denseval_h1")
    ap.add_argument("--apply", action="store_true", help="write the pool (default: report only)")
    args = ap.parse_args()

    from data import StripDataset, is_real_val_piece, vocabulary
    from transformers import AutoTokenizer

    tok = AutoTokenizer.from_pretrained(args.checkpoint)
    tok.add_tokens(vocabulary("old"))

    def n_ids(label: str) -> int:
        ids = tok(label).input_ids
        return len(ids) + (0 if ids and ids[-1] == tok.eos_token_id else 1)

    split = json.loads((REPO / args.split).read_text())
    synth_val = set(split["val_pieces"])
    pool = Path(args.pool)
    rows = [json.loads(l) for l in (pool / "manifest.jsonl").read_text().splitlines() if l.strip()]
    held = [r for r in rows if is_real_val_piece(r.get("piece", ""), synth_val, args.real_val_frac)]

    # the exam guard, on the same key train.py uses — a pool that leaks the exam may never be scored on
    ts = json.loads((REPO / "data/real/rung3/testset.json").read_text())
    exam = {(e["symbtr_file"][:-4] if e.get("symbtr_file", "").endswith(".txt") else e.get("symbtr_file", ""))
            for e in ts["pieces"]} - {""}
    leaked = sorted({r["piece"] for r in held if r.get("piece") in exam})
    if leaked:
        raise SystemExit(f"⛔ EXAM LEAK: {len(leaked)} exam piece(s) on the held-out side: {leaked[:5]}")

    for r in held:
        r["old_ids"] = n_ids(r["label"])
    keep = [r for r in held if r["old_ids"] > args.min_ids
            and (args.max_ids is None or r["old_ids"] <= args.max_ids)]

    buckets = Counter("<30" if r["old_ids"] < 30 else "30-49" if r["old_ids"] < 50
                      else "50-59" if r["old_ids"] < 60 else "60-99" if r["old_ids"] < 100 else ">=100"
                      for r in keep)
    print(f"{pool}: {len(rows)} rows, {len(held)} held out over {len({r['piece'] for r in held})} pieces")
    print(f"   keeping {len(keep)} (old ids > {args.min_ids}"
          + (f", <= {args.max_ids}" if args.max_ids else "") + ")")
    for b in ("<30", "30-49", "50-59", "60-99", ">=100"):
        if buckets[b]:
            print(f"      {b:6s} {buckets[b]}")
    over = sum(1 for r in keep if r["old_ids"] > 59)
    print(f"   over the old 59-id gate: {over} ({100 * over / max(1, len(keep)):.1f}%)")
    # ⚠ A label over 99 old ids CANNOT be produced by an old-vocabulary model at max_length 100 —
    # `collate` truncates it in training and the decoder runs out of steps at inference. It is a real
    # H advantage, but it is also a guaranteed control loss, so it is counted separately and never
    # buried inside a headline.
    cliff = [r["image"] for r in keep if r["old_ids"] >= 100]
    if cliff:
        print(f"   ⚠ {len(cliff)} label(s) at/over 100 old ids — the control cannot emit these at all: {cliff}")

    if not args.apply:
        print("\nreport only — pass --apply to write the pool")
        return 0

    out = REPO / args.out
    out.mkdir(parents=True, exist_ok=True)
    for r in keep:
        src, dst = pool / r["image"], out / r["image"]
        if not dst.exists():
            try:
                os.link(src, dst)
            except OSError:
                dst.write_bytes(src.read_bytes())
    with (out / "manifest.jsonl").open("w") as f:
        for r in keep:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\nwrote {out}: {len(keep)} strips")
    print("   read it with: scripts/rung3/paired_arm_score.py --score-vocab old --pool " + args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
