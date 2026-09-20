#!/usr/bin/env python3
r"""Is an edit the same size for both arms of Round 4's vocabulary A/B? No model, no GPU; ~10 s.

WHY THIS EXISTS (2026-09-16). Every scorer counts edits in token ids, and scheme H spells a note in
fewer ids than the old vocabulary. So the same misread costs an H checkpoint fewer edits than an
old one, and a paired read in each checkpoint's OWN ids tilts toward H by construction. The fix is
`paired_arm_score.py --score-vocab old`: decode to text, restore one spacing with
`data.canonical_label`, and count both arms in the old vocabulary's ids. This script is the proof
that the fix is (a) lossless and (b) neutral, and it must pass again after any change to
`canonical_label`, `ADDED_TOKENS` or `SCHEME_H_TOKENS`.

Four checks, each expected at zero:

  1. text round-trip — encode a label under a vocabulary, decode it, canonicalise, re-encode under
     OLD: the ids must equal the label's own old ids. Under H without `canonical_label` this fails
     on about half of real labels, because H's decode glues notes (`g''16a''16`, `r 16`, `c '8`).
  2. `canonical_label` never changes a gold label's old ids.
  3. base + old vocabulary gives the live checkpoint's ids, so `--score-vocab old` reproduces every
     number measured on an old checkpoint.
  4. SAME MISTAKE, SAME COST — each real label is corrupted once (one unit substituted or deleted),
     both vocabularies "generate" the corrupted text, and the edit difference H − old is printed
     twice: in own ids (the bias) and on the shared scale (must be 0 on every strip).

Also reported, not asserted: how many stored old-model decodes `canonical_label` moves (malformed
output only is expected).

    .venv-ml/bin/python scripts/rung3/score_vocab_check.py
"""
from __future__ import annotations

import csv
import random
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "src/vision"))

LABEL_POOLS = ["data/real/rung3/strips_h1", "data/real/rung3/_realval_v2",
               "data/real/rung3/_tupletval", "data/real/rung3/strips_exam_v3",
               "data/synthetic/strips_v7_final"]
DECODE_QUEUES = ["data/real/rung3/strips_h1/full_audit.csv",
                 "data/real/rung3/strips_h1/emit_review.csv",
                 "data/real/rung3/_handtest/handtest_review.csv"]
SAME_MISTAKE_POOL = "data/real/rung3/_realval_v2"
LIVE = "data/checkpoints/r3a-stage2-best-real"   # an old-vocabulary checkpoint


def main() -> int:
    from transformers import AutoTokenizer

    from data import StripDataset, canonical_label, strip_special, vocabulary
    from eval_omr import align
    from modeling import MODEL_ID

    base_old = AutoTokenizer.from_pretrained(MODEL_ID)
    base_old.add_tokens(vocabulary("old"))
    base_h = AutoTokenizer.from_pretrained(MODEL_ID)
    base_h.add_tokens(vocabulary("h"))
    live = AutoTokenizer.from_pretrained(REPO / LIVE)

    def ids(tok, text):
        return strip_special(tok(text, add_special_tokens=True).input_ids, tok)

    def edits(a, b):
        return sum(op != "match" for op, _, _ in align(a, b))

    labels: list[str] = []
    for d in LABEL_POOLS:
        labels += [s.label for s in StripDataset(REPO / d).strips]
    labels = list(dict.fromkeys(labels))
    fails = {"roundtrip_old": 0, "roundtrip_h": 0, "roundtrip_h_without_canonical": 0,
             "canonical_moves_gold": 0, "base_old_differs_from_live": 0}
    for text in labels:
        ref = ids(base_old, text)
        fails["canonical_moves_gold"] += ids(base_old, canonical_label(text)) != ref
        fails["base_old_differs_from_live"] += ids(live, text) != ref
        for name, tok in (("old", base_old), ("h", base_h)):
            decoded = tok.decode(ids(tok, text), skip_special_tokens=False)
            fails[f"roundtrip_{name}"] += ids(base_old, canonical_label(decoded)) != ref
            if name == "h":
                fails["roundtrip_h_without_canonical"] += ids(base_old, decoded) != ref
    print(f"{len(labels):,} distinct labels over {len(LABEL_POOLS)} pools")
    for k, v in fails.items():
        tag = "(expected > 0 — the defect)" if k.endswith("without_canonical") else ""
        print(f"   {k:34s} {v:6,d} {tag}")

    # stored decodes come from old-vocabulary models (round2-stage2-best, r3a-stage2-best-real)
    csv.field_size_limit(10 ** 8)
    decodes: set[str] = set()
    for q in DECODE_QUEUES:
        if (REPO / q).exists():
            with open(REPO / q, newline="") as f:
                decodes |= {r["decoded"].replace("\\tie", "") for r in csv.DictReader(f)
                            if r.get("decoded")}
    moved = sum(ids(base_old, canonical_label(t)) != ids(base_old, t) for t in decodes)
    print(f"{len(decodes):,} distinct stored old-model decodes: canonical_label moves the ids of "
          f"{moved} (malformed output expected)")

    rng = random.Random(7)
    gap_own, gap_shared = [], []
    for text in (s.label for s in StripDataset(REPO / SAME_MISTAKE_POOL).strips):
        units = canonical_label(text).split()
        k = rng.randrange(len(units))
        if rng.random() < 0.5:
            del units[k]
        else:
            units[k] = "a'8" if units[k] != "a'8" else "b'8"
        wrong = " ".join(units)
        cost = {}
        for name, tok in (("old", base_old), ("h", base_h)):
            hyp = ids(tok, wrong)
            shared_hyp = ids(base_old, canonical_label(tok.decode(hyp, skip_special_tokens=False)))
            cost[name] = (edits(ids(tok, text), hyp),
                          edits(ids(base_old, canonical_label(text)), shared_hyp))
        gap_own.append(cost["h"][0] - cost["old"][0])
        gap_shared.append(cost["h"][1] - cost["old"][1])
    n = len(gap_own)
    print(f"same mistake on {n} real strips, H minus old edits:")
    print(f"   own ids       mean {sum(gap_own) / n:+.3f}/strip, differs on {sum(g != 0 for g in gap_own)}")
    print(f"   shared scale  mean {sum(gap_shared) / n:+.3f}/strip, differs on {sum(g != 0 for g in gap_shared)}")

    must_be_zero = [v for k, v in fails.items() if not k.endswith("without_canonical")]
    ok = not any(must_be_zero) and not any(gap_shared)
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
