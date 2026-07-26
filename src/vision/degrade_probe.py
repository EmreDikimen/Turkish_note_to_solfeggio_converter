r"""
Degraded-strip probe — the pre-registered replacement for the CANCELLED every-share sweep
(decision block in `docs/log/superseded.md`).

The sweep existed to test one hypothesis: that the synthetic pool's inflated "emit an accidental"
prior (every-mode strips carry 4.22 inline accidentals vs 0.32 on real pages) is what makes the
model HALLUCINATE accidentals on ambiguous real ink. The sweep was cancelled because its selection
metric was measured to be underpowered AND the pathology it targets is already fixed on clean
real-val (`\komaFlat` F1 93.7 in both init-A/B arms, from a 53.8%-precision baseline).

This probe asks the same question for free, with no training run: **does the hallucination come
back when the ink gets ambiguous?** Run the existing checkpoint over real-val at increasing
degradation and watch accidental EMISSION RATE and per-class PRECISION.

  - precision collapses as strips degrade  -> the model invents accidentals under ambiguity;
    the mechanism is plausibly distributional and Round-2 renderer work is the right lever.
  - precision holds while recall falls     -> the model abstains rather than guesses; the
    residual is legibility, not prior. Round 2 needs a different lever.

Scope, per the pre-registration: real-val ONLY, and any transfer to `\komaSharp` (n=1 on real-val,
18 gold on the exam) is a PROXY CLAIM and must be stated as such.

Degradation ladder. The two mechanisms are lifted from `augment.py` — `ink_variation`'s fade branch
(scale ink depth toward the paper, line 88) and the camera pipeline's Gaussian blur — but applied
DETERMINISTICALLY and monotonically. augment.py randomises both (fade coin-flips against bleed,
blur fires at p=0.5); a dose-response curve needs a fixed ladder, not a sample. Labels are copied
through untouched: the gold does not change, only legibility.

Usage:
    # 1. build the degraded copies (fast, pure image ops)
    .venv-ml/bin/python src/vision/degrade_probe.py --strips-dir data/real/rung3/_realval
    # 2. eval each level with the normal evaluator (no new metric code)
    for d in data/real/rung3/_realval_degraded/L*; do
        .venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/round1-best \
            --strips-dir "$d" --split none
    done
    # 3. tabulate emission rate + precision against the clean read
    .venv-ml/bin/python src/vision/degrade_probe.py --report \
        --checkpoint data/checkpoints/round1-best
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np

# (name, ink_depth, blur_sigma). depth scales ink toward the paper: LOWER = fainter print.
# augment.py's trained fade range is 0.55-0.85, so L1-L3 stay in-distribution and L4 is
# deliberately BEYOND it (marked out-of-distribution in the report — read it as a stress point,
# not as a domain the model was ever prepared for).
LADDER: list[tuple[str, float, float]] = [
    ("L0_clean", 1.00, 0.0),
    ("L1_light", 0.85, 0.6),
    ("L2_mid", 0.70, 1.0),
    ("L3_heavy", 0.55, 1.4),
    ("L4_ood", 0.45, 1.8),
]

AEU_CLASSES = [
    "\\komaFlat", "\\bakiyeFlat", "\\kucukFlat", "\\buyukFlat",
    "\\komaSharp", "\\bakiyeSharp", "\\kucukSharp", "\\buyukSharp",
]


def degrade(img: np.ndarray, depth: float, sigma: float) -> np.ndarray:
    """Fade ink toward the paper, then soften. Deterministic — no RNG anywhere."""
    if depth < 1.0:
        img = (255 - (255 - img.astype(np.float32)) * depth).astype(np.uint8)
    if sigma > 0:
        img = cv2.GaussianBlur(img, (0, 0), sigma)
    return img


def build(strips_dir: Path, out_root: Path) -> int:
    rows = [json.loads(l) for l in (strips_dir / "manifest.jsonl").read_text().splitlines() if l.strip()]
    print(f"== {len(rows)} strips from {strips_dir}")

    for name, depth, sigma in LADDER:
        out = out_root / name
        out.mkdir(parents=True, exist_ok=True)
        for r in rows:
            src = strips_dir / r["image"]
            dst = out / r["image"]
            if depth == 1.0 and sigma == 0.0:
                shutil.copyfile(src, dst)          # L0 is the clean control, byte-identical
                continue
            img = cv2.imread(str(src), cv2.IMREAD_COLOR)
            if img is None:
                raise SystemExit(f"unreadable: {src}")
            cv2.imwrite(str(dst), degrade(img, depth, sigma))
        # labels copied through UNCHANGED — the gold is the same, only legibility moves
        (out / "manifest.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows))
        print(f"   {name:10s} depth={depth:.2f} sigma={sigma:.1f} -> {out}")
    return 0


def report(checkpoint: Path, out_root: Path) -> int:
    """Tabulate the eval.jsonl rows this probe produced. No new metrics: emission count is
    recoverable from what eval_omr.py already persists, since precision = hits/predicted and
    recall = hits/gold, so predicted = gold * recall / precision."""
    rows = [json.loads(l) for l in (checkpoint / "eval.jsonl").read_text().splitlines() if l.strip()]
    by_dir = {}
    for r in rows:
        by_dir[r.get("strips_dir", "")] = r          # last row per dir wins

    levels = []
    for name, depth, sigma in LADDER:
        key = str(out_root / name)
        row = by_dir.get(key)
        if row is None:
            print(f"   (missing eval for {name} — run eval_omr.py on {key})")
            continue
        levels.append((name, depth, sigma, row))
    if not levels:
        raise SystemExit("no probe evals found; run eval_omr.py over the degraded dirs first")

    print("\n== DEGRADED-STRIP PROBE — real-val only; komaSharp transfer is a PROXY CLAIM ==\n")
    print(f"{'level':10s} {'depth':>6s} {'blur':>5s} {'n':>5s} {'AEU':>7s} {'F1':>7s} "
          f"{'SER':>7s} {'acc/strip':>10s}")
    for name, depth, sigma, row in levels:
        n = row.get("n") or 1
        emitted = 0.0
        for cls in AEU_CLASSES:
            st = (row.get("per_class") or {}).get(cls)
            if not st or not st.get("precision"):
                continue
            emitted += st["gold"] * st["recall"] / st["precision"]
        flag = "  <- OOD" if name.endswith("_ood") else ""
        print(f"{name:10s} {depth:6.2f} {sigma:5.1f} {n:5d} "
              f"{row['headline_aeu']*100:6.1f}% {row['headline_f1']*100:6.1f}% "
              f"{row['ser']:7.3f} {emitted/n:10.3f}{flag}")

    print("\nper-class PRECISION (the hallucination signal — falling = inventing accidentals):")
    header = "".join(f"{n.split('_')[0]:>10s}" for n, _, _, _ in levels)
    print(f"{'class':14s}{header}")
    for cls in AEU_CLASSES:
        cells, seen = "", False
        for _, _, _, row in levels:
            st = (row.get("per_class") or {}).get(cls)
            if st and st.get("gold"):
                seen = True
                cells += f"{st['precision']*100:9.1f}%" if st.get("precision") is not None else f"{'—':>10s}"
            else:
                cells += f"{'—':>10s}"
        if seen:
            gold = next((row["per_class"][cls]["gold"] for _, _, _, row in levels
                         if (row.get("per_class") or {}).get(cls, {}).get("gold")), 0)
            low = " LOW-N" if gold < 30 else ""
            print(f"{cls:14s}{cells}{low}")
    print("\nReading: precision COLLAPSING with degradation => hallucination is ambiguity-driven "
          "(distributional mechanism plausible, Round-2 renderer lever).\n"
          "         precision HOLDING while recall falls => the model abstains; the residual is "
          "legibility, and Round 2 needs a different lever.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strips-dir", default="data/real/rung3/_realval")
    ap.add_argument("--out-root", default="data/real/rung3/_realval_degraded")
    ap.add_argument("--report", action="store_true", help="tabulate instead of building")
    ap.add_argument("--checkpoint", default="data/checkpoints/round1-best",
                    help="where eval_omr.py appended its rows (report mode)")
    args = ap.parse_args()

    out_root = Path(args.out_root)
    if args.report:
        return report(Path(args.checkpoint), out_root)
    return build(Path(args.strips_dir), out_root)


if __name__ == "__main__":
    raise SystemExit(main())
