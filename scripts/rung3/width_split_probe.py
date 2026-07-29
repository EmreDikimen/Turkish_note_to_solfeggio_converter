r"""Round-3 — is the model's trouble with WIDE crops caused by the width itself?

WHERE THIS CAME FROM. `empty_crop_probe.py --sweep` decoded the whole exam and found a U-shape in
the per-token error rate (edits divided by gold ids, so note count is already controlled for):

    0-350 px   0.811     600-900 px   0.033
    350-600    0.090     900-1200     0.031
                         1200+        0.082

Both tails are expensive. The wide tail is the bigger one in absolute terms — 45 strips carrying
161 of the exam's 562 edits — and nothing in docs/rung3/round3.md mentions it. The suspected cause
is the one `scripts/rung3/sharp_width_test.py` was written for: the encoder's input box is fixed, so
the wider a strip is, the more it is shrunk on the way in, and thin detail merges.

WHY A SPLIT TEST AND NOT A RE-SLICE. Re-slicing produces crops with no gold, so nothing can be
scored. Splitting an EXISTING strip keeps its gold exactly: cut a >1200 px strip in two, decode both
halves, concatenate the two token streams, and score that against the strip's original label. Same
music, same answer key, only the width changed. That makes this a real A/B rather than a projection.

The cut lands only on a zero-ink gutter, reusing `page_to_strips._split_wide` — the slicer's own
rule, which exists so a cut can never bisect a notehead or a beam and get it decoded twice.

WHAT IT CANNOT TELL US. The right half of a split loses whatever key signature stood at the row
start, so a `\sig`-carrying strip is scored with a handicap the real slicer would not impose (it
re-prints the signature context per row, not per window). Strips whose gold opens with `\sig` are
therefore reported SEPARATELY, never pooled into the headline.

PRE-REGISTERED READ (written before the run): if splitting cuts the edit count on these strips by
25% or more, `MAX_STRIP_W` is too high and lowering it is a real, training-free win. If it is flat
or worse, width is a symptom of hard content rather than a cause, and the wide tail needs a
different lever.

Usage:
    .venv-ml/bin/python scripts/rung3/width_split_probe.py --min-width 1200
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))

CKPT = ROOT / "data/checkpoints/round2-stage2-best"
EXAM = ROOT / "data/real/rung3/strips_exam_v2_clean"
OUT = ROOT / "data/real/rung3/width_split_probe"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-width", type=int, default=1200,
                    help="only strips at least this wide (the expensive tail)")
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    import torch
    from data import strip_special
    from eval_omr import align
    from modeling import load_model_and_processor
    import page_to_strips as pts

    recs = [json.loads(l) for l in (EXAM / "manifest.jsonl").read_text().splitlines() if l.strip()]
    wide = []
    for rec in recs:
        p = Path(rec["image"])
        if not p.is_absolute():
            p = EXAM / rec["image"]
        if p.exists() and Image.open(p).width >= args.min_width:
            wide.append((p, rec["label"]))
    if args.limit:
        wide = wide[: args.limit]
    print(f"{len(wide)} exam strips at >= {args.min_width}px\n")

    model, processor, _ = load_model_and_processor(str(CKPT))
    model.eval()
    dev = args.device or ("cuda" if torch.cuda.is_available() else
                          "mps" if torch.backends.mps.is_available() else "cpu")
    model.to(dev)
    tok = processor.tokenizer

    def decode(img: Image.Image) -> str:
        px = processor(img.convert("RGB"), return_tensors="pt").pixel_values.to(dev)
        with torch.no_grad():
            ids = model.generate(px, max_length=args.max_length)
        return tok.decode(ids[0], skip_special_tokens=True)

    def edits(gold: str, hyp: str) -> int:
        r = strip_special(tok(gold, add_special_tokens=True).input_ids, tok)
        h = strip_special(tok(hyp, add_special_tokens=True).input_ids, tok)
        return sum(1 for op, _, _ in align(r, h) if op != "match")

    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for i, (p, gold) in enumerate(wide):
        img = Image.open(p).convert("L")
        arr = np.asarray(img)
        # The slicer's own gutter rule. _split_wide takes its piece count from
        # ceil(width / MAX_STRIP_W), so a halving needs a cap in [width/2, width) — one pixel
        # UNDER half gives ceil(2.003) = 3 pieces, not 2.
        old_cap = pts.MAX_STRIP_W
        pts.MAX_STRIP_W = max(200, (img.width + 1) // 2)
        try:
            pieces = pts._split_wide(arr, 0, img.width)
        finally:
            pts.MAX_STRIP_W = old_cap
        if len(pieces) < 2:
            continue

        whole = decode(img)
        parts = [decode(Image.fromarray(arr[:, a:b])) for a, b in pieces]
        joined = " ".join(x for x in parts if x)
        e_whole, e_split = edits(gold, whole), edits(gold, joined)
        rows.append({"image": p.name, "w": img.width, "pieces": len(pieces),
                     "cut_widths": [b - a for a, b in pieces], "gold": gold,
                     "whole": whole, "split": joined,
                     "edits_whole": e_whole, "edits_split": e_split,
                     "has_sig": gold.lstrip().startswith("\\sig")})
        if (i + 1) % 10 == 0:
            print(f"  ... {i+1}/{len(wide)}", flush=True)

    (OUT / "results.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows))

    def report(name: str, sub: list[dict]) -> None:
        if not sub:
            return
        w = sum(r["edits_whole"] for r in sub)
        s = sum(r["edits_split"] for r in sub)
        better = sum(1 for r in sub if r["edits_split"] < r["edits_whole"])
        worse = sum(1 for r in sub if r["edits_split"] > r["edits_whole"])
        print(f"\n{name}: {len(sub)} strips")
        print(f"  edits whole : {w}")
        print(f"  edits split : {s}   ({100*(s-w)/max(w,1):+.1f}%)")
        print(f"  split better on {better} strips, worse on {worse}, same on "
              f"{len(sub)-better-worse}")

    nosig = [r for r in rows if not r["has_sig"]]
    report("HEADLINE — strips with no \\sig to lose", nosig)
    report("strips whose gold opens with \\sig (handicapped, see docstring)",
           [r for r in rows if r["has_sig"]])

    print("\nPRE-REGISTERED BAR: a >=25% drop in edits on the headline group means MAX_STRIP_W "
          f"(currently {pts.MAX_STRIP_W}) is too high.\n")
    for r in sorted(nosig, key=lambda z: z["edits_split"] - z["edits_whole"])[:6]:
        print(f"  {r['edits_whole']:>2} -> {r['edits_split']:>2}  w={r['w']} "
              f"cuts={r['cut_widths']}  {r['image']}")
    print(f"\nresults -> {OUT/'results.jsonl'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
