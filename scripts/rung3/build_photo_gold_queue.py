"""Build a review-UI queue to hand-label the PHONE-PHOTO strips — a direct per-strip photo test set.

The frozen gold labels live on the CLEAN strips and are curated/sparse and error-prone (komaSharp/
kucukSharp). Rather than fitting-align them onto the photo decode, build proper ground truth ON the
photo strips themselves: every phone-photo strip, seeded with the model's decode, for the domain
expert to confirm (ok) or correct (fix) against the actual photo. The result is a clean, per-strip
photo benchmark scored directly (no alignment indirection).

Seeding note: `label` starts as the model decode so a correct strip is a one-key `ok`; the expert
verifies each against the image (the strip is shown large) — model-assisted labeling, not auto-trust.
`reason=accid` flags strips whose decode has an accidental (what AEU scores — scrutinize first).
`min_logprob` (shown in the UI) marks where the model was unsure.

    .venv-ml/bin/python scripts/rung3/build_photo_gold_queue.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from data import ADDED_TOKENS   # noqa: E402

DECODE_ROOT = Path("data/real/rung3/photos_exam_strips")
OUT = Path("data/real/rung3/photos_exam_strips/photo_gold.csv")
ACC = ADDED_TOKENS[:9]   # 8 accidentals + natural


def has_accidental(tokens: str) -> bool:
    # detokenized decode glues tokens (e.g. "\komaFlatb"), so substring test, not split
    return any(a in tokens for a in ACC)


def main() -> None:
    rows = []
    for d in sorted(DECODE_ROOT.glob("*/")):
        dj = d / f"{d.name}_decode.json"
        if not dj.exists():
            continue
        strips = sorted(json.loads(dj.read_text())["strips"], key=lambda s: (s["system"], s["window"]))
        for s in strips:
            toks = s["tokens"]
            rows.append({
                "page": d.name, "strip": s["strip"],
                "system": s["system"], "window": s["window"],
                "min_logprob": s.get("min_logprob", ""),
                "reason": "accid" if has_accidental(toks) else "",
                "label": toks, "decoded": toks,     # seed label = decode; expert confirms/corrects
                "verdict": "", "corrected_label": "", "by": "",
            })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fields = ["page", "strip", "system", "window", "min_logprob", "reason",
              "label", "decoded", "verdict", "corrected_label", "by"]
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    n_acc = sum(1 for r in rows if r["reason"] == "accid")
    print(f"wrote {OUT}  ({len(rows)} photo strips, {n_acc} with an accidental)")


if __name__ == "__main__":
    main()
