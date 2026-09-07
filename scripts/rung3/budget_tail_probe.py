"""Rung 3 / Round 4 — how long are the labels REALLY, and where should the budget sit?

Free: no model, no decode, no GPU. It tokenizes labels that already exist and counts ids.

The question (owner, 2026-09-07). The emitter drops a strip whose label costs more than the
budget. That budget was 59 ids in every pool this project has built — but 59 is NOT a model
limit. The model's real ceiling is 100, in two places at once: `MAX_TOKENS` in
apps/web/src/omr/decode.ts and `collate(max_len=100)` in src/vision/data.py, which TRUNCATES a
longer label at 99 and would teach the model to stop early. The owner had watched the live model
read strips of 85-90 ids correctly — in the OLD id space, so what that shows is the DECODER
walking 85-90 steps, and scheme H buys real headroom on top of it.

  .venv-ml/bin/python scripts/rung3/budget_tail_probe.py            # b8 + the examv3 hand set
  .venv-ml/bin/python scripts/rung3/budget_tail_probe.py --responses <emit_responses.json>

⚠ It reads `emit_responses.json`, NOT the manifest: the manifest holds only the strips that
passed, and the whole question is about the ones the budget threw away. The responses file is
every label the serializer produced, over-budget ones included.

READ 2026-09-07 on `strips_b8` (15,758 serialized labels) and on the 579 hand-typed
`corrected_label`s in examv3's review queue:

  ids                     old              H
  median                   42             24
  p95                     105             53
  max                     344            192
  > 59 ids       4,012 (25.5%)    504 (3.20%)
  > 80 ids                  —     148 (0.94%)
  > 85 ids       1,407 ( 8.9%)    106 (0.67%)
  >100 ids         917 ( 5.8%)     45 (0.29%)

⭐ The tail is REAL MUSIC, not an alignment artefact: `MEASURES_PER_STRIP` is 3 and every strip in
it covers 3 measures or fewer. ⭐ On the material the owner hand-corrected the longest H label is
**67 ids** — nothing there reaches even 70, which is what made the 80 call safe.

⭐ **THE BUDGET IS 80 UNDER SCHEME H (owner, 2026-09-07).** It admits 15,610 of 15,758 (99.06%),
leaves the rail 148 windows instead of 504, trains 356 dense strips WHOLE that would otherwise be
halved, and keeps 20 ids of margin under the truncation cliff. The gate now moves with the
vocabulary: `emit_strip_labels.MAX_IDS_BY_VOCAB`, mirrored in `audit_coverage.py`,
`promote_labels.py --vocab` and `train.py --select-max-length`.

⚠ ONE THING IT MEASURED THAT STEP 6 MUST DECIDE: of the 15,610 strips a budget of 80 admits under
H, **769 (4.93%) cost more than 100 ids under the OLD vocabulary**. The old-vocabulary control arm
cannot hold those rows — collate would truncate them — so the two arms cannot share one pool
exactly, and "same pools, one variable" needs re-stating before that A/B is run.

Numbers live in docs/METRICS-SLICER-WINDOWS.md.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "src" / "vision"))

CUTS = (59, 80, 85, 90, 100)


def build(checkpoint: str, scheme: str):
    from data import vocabulary
    from transformers import AutoProcessor

    tok = AutoProcessor.from_pretrained(checkpoint).tokenizer
    tok.add_tokens(vocabulary(scheme))      # idempotent for the ids already there
    return tok


def n_ids(tok, label: str) -> int:
    """The emitter's exact rule: ids plus the training-time EOS the tokenizer does not append."""
    ids = tok(label).input_ids
    return len(ids) + (0 if ids and ids[-1] == tok.eos_token_id else 1)


def report(name: str, labels: list[str], old, h) -> None:
    if not labels:
        print(f"\n=== {name}: no labels found ===")
        return
    o = np.array([n_ids(old, x) for x in labels])
    n = np.array([n_ids(h, x) for x in labels])
    print(f"\n=== {name}  (n = {len(labels)}) ===")
    print(f"  old: median {np.median(o):3.0f}  p95 {np.percentile(o, 95):3.0f}  max {o.max()}")
    print(f"  H  : median {np.median(n):3.0f}  p95 {np.percentile(n, 95):3.0f}  max {n.max()}")
    for c in CUTS:
        print(f"    > {c:3d} ids:  old {int((o > c).sum()):6d} ({100 * (o > c).mean():5.2f}%)"
              f"    H {int((n > c).sum()):6d} ({100 * (n > c).mean():5.2f}%)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--responses", default="data/real/rung3/strips_b8/emit_responses.json",
                    help="an emit's labels-cli responses — EVERY label, dropped ones included")
    ap.add_argument("--review", default="data/real/rung3/strips_exam_v3/emit_review.csv",
                    help="a review queue whose hand-typed corrected_label column is read too")
    ap.add_argument("--checkpoint", default="data/checkpoints/round2-stage2-best",
                    help="tokenizer source only — no model is loaded")
    args = ap.parse_args()

    old, h = build(args.checkpoint, "old"), build(args.checkpoint, "h")
    print(f"vocabulary: old {len(old)} ids -> H {len(h)} ids")

    resp_p = REPO / args.responses
    if resp_p.exists():
        resp = json.loads(resp_p.read_text())
        labels = [r["label"] for r in resp if r.get("label")]
        report(f"{Path(args.responses).parent.name}: every serialized label", labels, old, h)

        # Is the tail real music or a mis-assigned measure range? The packer cannot pack more than
        # MEASURES_PER_STRIP measures into a window, so anything above it would be an artefact.
        req_p = resp_p.parent / "emit_requests.json"
        if req_p.exists():
            from page_to_strips import MEASURES_PER_STRIP
            meas = {s["id"]: len(s["measures"])
                    for piece in json.loads(req_p.read_text()) for s in piece["strips"]}
            over = [meas.get(r["id"], 0) for r in resp
                    if r.get("label") and n_ids(h, r["label"]) > 80]
            bad = sum(1 for m in over if m > MEASURES_PER_STRIP)
            print(f"  the H tail over 80 ids: {len(over)} strips, {bad} of them covering more than "
                  f"MEASURES_PER_STRIP={MEASURES_PER_STRIP} measures (an alignment artefact)")

    rev_p = REPO / args.review
    if rev_p.exists():
        with rev_p.open() as f:
            hand = [r["corrected_label"].strip() for r in csv.DictReader(f)
                    if r.get("verdict") and r.get("corrected_label", "").strip()]
        report(f"{Path(args.review).parent.name}: hand-typed corrected_label", hand, old, h)
    return 0


if __name__ == "__main__":
    sys.exit(main())
