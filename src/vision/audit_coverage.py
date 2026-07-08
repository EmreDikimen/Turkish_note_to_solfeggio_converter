"""
Rung-2 dataset coverage audit — the GATE between "rendered" and "worth training on".

Reads a strips manifest and reports everything the Definition-of-done cares about; exits non-zero
on violations so it can guard a training run mechanically:

  - per-class counts of the 8 AEU accidentals (+ \\natural, \\sig, repeat/nav tokens, barline
    `|`, and the v2_2 rhythm signs \\tup3/\\tupend/\\tie/\\grace), overall and per split side
    when --split is given;
  - measures-per-strip histogram and the multi-measure / barline shares;
  - per-mode / per-transpose / lyric / repeat-render shares;
  - with --tokenizer: encodes EVERY label with the real tokenizer and FAILS if any exceeds
    59 ids incl. EOS — the hard backstop for the renderer's 56-token char-count estimate
    (decoder max_length is 60);
  - runs check_token_drift (an unknown \\token in any label fails the audit).

Usage:
    .venv-ml/bin/python src/vision/audit_coverage.py --strips data/synthetic/strips_v2_2 \
        [--split data/split.json] [--tokenizer data/checkpoints/overfit10]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data import ADDED_TOKENS, StripDataset, check_token_drift

AEU = ADDED_TOKENS[:8]
STRUCT = ["\\natural", "\\sig", "\\repstart", "\\repend", "\\volta1", "\\volta2",
          "\\segno", "\\coda", "\\dc", "\\fine", "|",
          "\\tup3", "\\tupend", "\\tie", "\\grace"]
NAV = ["\\segno", "\\coda", "\\dc", "\\fine"]
# strips_v2_2 rhythm signs (tools/render/rhythm.ts) — REAL data recovered from the durations
# (34 train / 3 val pieces have triplets, 24/3 ties, 86/12 graces of the 150), never injected,
# so the floors below are regression guards on the renderer, not injection-density tuning.
RHYTHM = ["\\tup3", "\\tie", "\\grace"]  # \tupend counts == \tup3, no separate floor
MAX_IDS = 59  # incl. EOS; decoder max_length is 60 (one slot for the decoder-start id)

# DoD thresholds (docs/PHASE2.md §6 + the plan). Büyük classes get a lower val floor: they are
# injected at a deliberately low rate (see tools/render/respell.ts — user decision 2026-07-05).
MIN_TRAIN_PER_CLASS = 200
MIN_VAL_PER_CLASS = 25
MIN_VAL_BUYUK = 15
# Regression floor, not an aspiration: the v2 render measured 39.9% multi-measure / 40.7%
# barline (the structural ceiling — measures pair only within a screen row, and dense measures
# can't pair under the 60-id budget; the OLD dataset was 4%). The v2_2 rhythm signs raised the
# per-measure token cost, lowering the ceiling ~2pp (measured 38.1% / 38.6%) — floors follow.
# A future render below these means the packing broke.
MIN_MULTI_MEASURE_SHARE = 0.35  # of every-mode strips
MIN_BARLINE_SHARE = 0.37        # of all labels
MIN_REPEAT_SHARE = 0.05
# Navigation marks are single measure-edge glyphs (repeat signs are 2–4-measure SPANS), so far
# fewer strips carry one; the per-token floors below are what actually guards trainability.
MIN_NAV_SHARE = 0.02
MIN_TRAIN_PER_NAV = 100
MIN_VAL_PER_NAV = 10
# Rhythm-sign floors, set just under the measured v2_2 render (train \tup3 561 / \tie 544 /
# \grace 2148; val 9 / 195 / 254) — corpus-driven, not an injection rate. Val \tup3 is
# STRUCTURALLY thin: only 3 val pieces have triplets and two are dense ağırsemai/aksak pieces
# whose triplet bars exceed the token budget (they were dropped in v2_1 too) — treat the eval
# recall on \tup3 as a smoke signal, like \volta2.
MIN_TRAIN_PER_RHYTHM = 400
MIN_VAL_PER_RHYTHM = 8


def token_counts(rows: list[dict]) -> Counter:
    c: Counter = Counter()
    for r in rows:
        for tok in r["label"].split():
            if tok in AEU or tok in STRUCT:
                c[tok] += 1
    return c


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strips", default="data/synthetic/strips_v2_2")
    ap.add_argument("--split", default=None)
    ap.add_argument("--tokenizer", default=None, help="HF checkpoint dir for the real-id length gate")
    args = ap.parse_args()

    strips_dir = Path(args.strips)
    rows = [json.loads(l) for l in (strips_dir / "manifest.jsonl").read_text().splitlines() if l.strip()]
    for r in rows:
        r["piece"] = r.get("piece") or r["image"].split("_")[0]
    n = len(rows)
    failures: list[str] = []
    print(f"== audit: {n} strips in {strips_dir}\n")

    # --- structure ---------------------------------------------------------
    every = [r for r in rows if r["mode"] == "every"]
    spans = Counter(min(r["to"] - r["from"] + 1, 9) for r in every)
    multi = sum(v for k, v in spans.items() if k >= 2) / max(1, len(every))
    barline = sum(1 for r in rows if "|" in r["label"].split()) / n
    print("measures-per-strip (every mode):", dict(sorted(spans.items())))
    print(f"multi-measure share (every mode): {multi:.1%}   labels with '|': {barline:.1%}")
    if multi < MIN_MULTI_MEASURE_SHARE:
        failures.append(f"multi-measure share {multi:.1%} < {MIN_MULTI_MEASURE_SHARE:.0%}")
    if barline < MIN_BARLINE_SHARE:
        failures.append(f"barline share {barline:.1%} < {MIN_BARLINE_SHARE:.0%}")

    rep = sum(1 for r in rows if "\\repstart" in r["label"] or "\\repend" in r["label"]) / n
    nav = sum(1 for r in rows if any(t in r["label"].split() for t in NAV)) / n
    lyr = sum(1 for r in rows if r.get("lyrics")) / n
    tup = sum(1 for r in rows if "\\tup3" in r["label"].split()) / n
    tie = sum(1 for r in rows if "\\tie" in r["label"].split()) / n
    grc = sum(1 for r in rows if "\\grace" in r["label"].split()) / n
    modes = Counter(r["mode"] for r in rows)
    transposes = Counter(r.get("transpose", 0) for r in rows)
    print(f"repeat-token strips: {rep:.1%}   nav-token strips: {nav:.1%}   lyric strips: {lyr:.1%}   modes: {dict(modes)}")
    print(f"rhythm-sign strips — triplet: {tup:.1%}   tie: {tie:.1%}   grace: {grc:.1%}")
    print(f"transposes: {dict(sorted(transposes.items()))}")
    if rep < MIN_REPEAT_SHARE:
        failures.append(f"repeat share {rep:.1%} < {MIN_REPEAT_SHARE:.0%}")
    if nav < MIN_NAV_SHARE:
        failures.append(f"nav-mark share {nav:.1%} < {MIN_NAV_SHARE:.0%}")

    # --- token coverage ----------------------------------------------------
    split = json.loads(Path(args.split).read_text()) if args.split else None
    sides: list[tuple[str, list[dict]]] = [("all", rows)]
    if split:
        tp, vp = set(split["train_pieces"]), set(split["val_pieces"])
        overlap = tp & vp
        if overlap:
            failures.append(f"{len(overlap)} pieces in BOTH splits")
        sides = [("train", [r for r in rows if r["piece"] in tp]),
                 ("val", [r for r in rows if r["piece"] in vp])]

    print(f"\n{'token':<14}" + "".join(f"{name:>10}" for name, _ in sides))
    counts = {name: token_counts(rs) for name, rs in sides}
    for tok in AEU + STRUCT:
        print(f"{tok:<14}" + "".join(f"{counts[name][tok]:>10}" for name, _ in sides))
    if split:
        for tok in AEU:
            floor_val = MIN_VAL_BUYUK if "buyuk" in tok else MIN_VAL_PER_CLASS
            if counts["train"][tok] < MIN_TRAIN_PER_CLASS:
                failures.append(f"{tok}: train {counts['train'][tok]} < {MIN_TRAIN_PER_CLASS}")
            if counts["val"][tok] < floor_val:
                failures.append(f"{tok}: val {counts['val'][tok]} < {floor_val}")
        for tok in NAV:
            if counts["train"][tok] < MIN_TRAIN_PER_NAV:
                failures.append(f"{tok}: train {counts['train'][tok]} < {MIN_TRAIN_PER_NAV}")
            if counts["val"][tok] < MIN_VAL_PER_NAV:
                failures.append(f"{tok}: val {counts['val'][tok]} < {MIN_VAL_PER_NAV}")
        for tok in RHYTHM:
            if counts["train"][tok] < MIN_TRAIN_PER_RHYTHM:
                failures.append(f"{tok}: train {counts['train'][tok]} < {MIN_TRAIN_PER_RHYTHM}")
            if counts["val"][tok] < MIN_VAL_PER_RHYTHM:
                failures.append(f"{tok}: val {counts['val'][tok]} < {MIN_VAL_PER_RHYTHM}")

    # --- drift + real-tokenizer length gate ---------------------------------
    ds = StripDataset(strips_dir)
    check_token_drift(ds)
    print("\ncheck_token_drift: OK")

    if args.tokenizer:
        from transformers import AutoProcessor

        tok = AutoProcessor.from_pretrained(args.tokenizer).tokenizer
        # Measure with the TRAINING-TIME vocabulary: modeling.py adds ADDED_TOKENS before every
        # run, so a checkpoint tokenizer predating a token (e.g. the nav marks vs. overfit10)
        # would split it into ~5 ids and fail good labels. add_tokens is idempotent.
        tok.add_tokens(ADDED_TOKENS)
        eos = tok.eos_token_id
        too_long = 0
        longest = 0
        for r in rows:
            ids = tok(r["label"]).input_ids
            n_ids = len(ids) + (0 if ids and ids[-1] == eos else 1)  # + manually-appended EOS
            longest = max(longest, n_ids)
            if n_ids > MAX_IDS:
                too_long += 1
                if too_long <= 5:
                    print(f"  TOO LONG ({n_ids} ids): {r['image']}")
        print(f"real-tokenizer length: longest {longest} ids (cap {MAX_IDS}), {too_long} over")
        if too_long:
            failures.append(f"{too_long} labels exceed {MAX_IDS} tokenizer ids")

    print()
    if failures:
        print("== AUDIT FAIL:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("== AUDIT PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
