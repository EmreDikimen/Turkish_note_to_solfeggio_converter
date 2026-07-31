r"""Round-3 Check B — are the off-by-one pitch errors actually caused by staff geometry?

THE CLAIM UNDER TEST (docs/rung3/round3.md §1). When the model gets a note's height wrong it is
off by only one or two staff positions 74% of the time. Our training strips are unnaturally steady
— spacing SD 0.03 px raw, 0.76 px augmented — against 0.72-1.11 px in the real pools, and a
vertical-placement p5-p95 spread of 2.0 px raw against 6-21 px real. round3.md calls the link
"consistent with, not proven to be caused by", and proposes widening `augment.py`'s Affine range.
That widening is already sitting uncommitted in the working tree. This decides whether it is aimed
at anything.

WHY PERTURB RATHER THAN "SQUEEZE REAL TOWARD SYNTHETIC". The plan's phrasing assumed real strips
carry raw page variation. They do not: `page_to_strips.normalize_row` already rescales every row so
its line spacing equals TARGET_SPACING. The spread we measured is the slicer's RESIDUAL error after
that normalisation, and there is no way to subtract it out — the true spacing is unknown per strip.
So run it the other way: apply a deterministic, monotonic ladder of the same geometry perturbation
and watch the off-by-one rate respond. Same structure as `src/vision/degrade_probe.py`, which
replaced the every-share sweep with a dose-response curve instead of a training run.

READING IT:
  off-by-one errors climb steeply with small perturbation -> the model IS brittle to staff
    geometry, the augmenter is under-shaking relative to reality, and the working-tree change is
    aimed at a real mechanism.
  the curve is flat -> geometry is not what produces these errors. The augmenter change is cheap
    insurance rather than a fix, and the 40%-of-corrections pitch bucket needs a different lever.
    Say so BEFORE rendering anything.

WHAT IS MEASURED. Alignment is the project's own (eval_omr.align, id space). A "pitch substitution"
is an aligned sub where gold and hypothesis are both notes; its DISTANCE is the difference in staff
positions (letter + 7 x octave), so +-1 means one line-or-space out. Reported per rung of the
ladder, beside total edits so a rise in off-by-ones cannot hide a general collapse.

EXAM DISCIPLINE. Read on the frozen exam through `round2-stage2-best`, whose exam turn is spent.
Frozen model + frozen exam = no selection leakage, the same manoeuvre ship-criteria.md used to
backfill the arc-\tup3 baseline. Rung 0 is the untouched exam and must reproduce the known 562
edits — if it does not, the harness is wrong and nothing else here counts.

Usage:
    .venv-ml/bin/python scripts/rung3/staff_geometry_probe.py --device cpu
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))

CKPT = ROOT / "data/checkpoints/round2-stage2-best"
EXAM = ROOT / "data/real/rung3/strips_exam_v2_clean"
OUT = ROOT / "data/real/rung3/staff_geometry_probe"

NOTE_RE = re.compile(r"^([a-g])('*|,*)(\d+)(\.?)$")
LETTER = {c: i for i, c in enumerate("cdefgab")}

# The model's decoded STRING loses the spaces around added tokens — a real decode comes back as
# `\sigend\volta2b'16 c''8`, which is why eval_omr.py scores in id space. Splitting that on
# whitespace yields junk like `\sigend\volta2b'16`, so tokens are lexed by shape instead, and the
# same lexer runs over the gold so both sides are tokenized identically.
LEX = re.compile(r"\\[A-Za-z]+|[a-g][',]*\d+\.?|r\d+\.?|\|")

# The ladder, in the same units augment.py's Affine uses. The top rung is roughly double the
# widened range in the working tree, so the curve has somewhere to go before it saturates.
#
# "raw" is the untouched image and exists only to prove the harness reproduces the known 562-edit
# exam total. It is NOT the control for the other rungs: it never goes through warpAffine, and a
# 2% shrink under INTER_AREA is a mild low-pass filter that could improve a noisy scan all on its
# own. "identity" applies the same warp with no geometry change and IS the control.
LADDERS = {
    "ramp": [
        ("0 raw (no warp)", 1.000, 0.000),
        ("1 scale2%_shift1%", 0.980, 0.010),
        ("2 scale4%_shift2%", 0.960, 0.020),
        ("3 scale8%_shift3%", 0.920, 0.030),
    ],
    # Rung 1 of the ramp moved scale and shift together, so its result cannot be attributed.
    # Decompose: hold the resampling constant and vary one axis at a time.
    "decompose": [
        ("identity warp", 1.000, 0.000),
        ("scale 2% only", 0.980, 0.000),
        ("shift 1% only", 1.000, 0.010),
        ("shift -1% only", 1.000, -0.010),
    ],
    # The decomposition put the whole effect on SCALE (-15.5%), with the identity warp landing on
    # 562 exactly — so resampling contributes nothing and this is a genuine geometry result.
    #
    # The hypothesis it suggests is a systematic SCALE MISMATCH, not the variance story round3.md
    # tells: domain_gap measures exam staff spacing at 30.437 px against the corpus's 30.003, so the
    # exam is 1.45% larger and a 1.43% shrink matches it exactly — right where the tested optimum
    # sat. That hypothesis makes a falsifiable prediction: a MINIMUM near 0.985 with the curve
    # rising on BOTH sides. If instead smaller is monotonically better, the cause is something else
    # (encoder shrink, thinning strokes) and the matching story is wrong.
    # Per-strip size match: measure each strip's own spacing and rescale it to 30.0. Removes both
    # the average offset AND the per-strip spread, which no fixed rung can do.
    "renormalize": [
        ("identity warp", 1.000, 0.000),
        ("renormalize to 30.0", 1.000, 0.000),
    ],
    # What is the 2% shrink actually doing? See mechanism_op.
    "mechanism": [
        ("identity warp", 1.000, 0.000),
        ("op:down_up", 1.000, 0.000),
        ("op:blur", 1.000, 0.000),
        ("op:ink_lighten", 1.000, 0.000),
        ("op:ink_thin", 1.000, 0.000),
    ],
    "fine_scale": [
        ("identity warp", 1.000, 0.000),
        ("scale 1%", 0.990, 0.000),
        ("scale 1.5%", 0.985, 0.000),
        ("scale 2.5%", 0.975, 0.000),
        ("scale 4%", 0.960, 0.000),
    ],
}


def staff_position(tok: str) -> int | None:
    """Staff position of a note token: letter index + 7 per octave mark. None if not a note."""
    m = NOTE_RE.match(tok)
    if not m:
        return None
    letter, marks, _, _ = m.groups()
    oct_shift = marks.count("'") - marks.count(",")
    return LETTER[letter] + 7 * oct_shift


def perturb(img: Image.Image, scale: float, shift: float) -> Image.Image:
    """Shrink about the centre and shift vertically, padding with paper white.

    Deliberately affine-only and deterministic — no rotation, no resampling of the staff spacing
    beyond the scale factor. A dose-response curve needs a fixed ladder, not a sample.
    """
    import cv2

    a = np.asarray(img.convert("L"))
    h, w = a.shape
    M = np.float32([[scale, 0, (1 - scale) * w / 2],
                    [0, scale, (1 - scale) * h / 2 + shift * h]])
    out = cv2.warpAffine(a, M, (w, h), flags=cv2.INTER_AREA,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=255)
    return Image.fromarray(out)


def mechanism_op(name: str, img: Image.Image) -> Image.Image:
    r"""The `mechanism` ladder: what is the ~2% shrink actually DOING?

    Established: shrinking a real strip ~2% removes 12-15.5% of exam corrections, and matching the
    training staff size is NOT the reason (per-strip exact rescaling gives only -6.0%). These rungs
    separate the remaining candidates. Each changes ONE property and holds the others.

    down_up is the decisive one. It resamples DOWN by 2% and straight back UP to the original size,
    so the picture ends the same size it started but has been through the same low-pass filtering
    twice. If it reproduces the win, the cause is the FILTERING, not the size.

    Why this rung is needed at all, and a correction: the earlier "identity warp" control was
    supposed to hold resampling constant, but an exact identity matrix makes warpAffine copy pixels
    one-for-one — it never filters. So resampling was never actually ruled out, despite the run
    being reported that way.

    ink_lighten / ink_thin test the other live candidate. Real strips carry heavier ink than
    synthetic (staff lines 3.8-4.8 px vs 3.0, beams 0.567-0.765 S vs 0.500), and shrinking with
    INTER_AREA both blurs and lightens thin strokes.
    """
    import cv2

    a = np.asarray(img.convert("L"))
    h, w = a.shape
    if name == "down_up":
        small = cv2.resize(a, (max(1, int(w * 0.98)), max(1, int(h * 0.98))),
                           interpolation=cv2.INTER_AREA)
        out = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
    elif name == "blur":
        out = cv2.GaussianBlur(a, (0, 0), 0.6)
    elif name == "ink_lighten":
        # pull ink toward paper without moving any edge
        out = np.clip(255.0 - (255.0 - a.astype(np.float32)) * 0.85, 0, 255).astype(np.uint8)
    elif name == "ink_thin":
        # erode the INK (dilate the paper) by one pixel — strokes get thinner, size unchanged
        out = cv2.dilate(a, np.ones((2, 2), np.uint8))
    else:
        raise ValueError(name)
    return Image.fromarray(out)


def measured_spacing(img: Image.Image) -> float | None:
    """Staff-line spacing of a strip as it actually is, sub-pixel, from its own pixels."""
    bw = np.asarray(img.convert("L")) < 128
    rows = np.flatnonzero(bw.mean(axis=1) >= 0.6)
    if rows.size < 5:
        return None
    groups, cur = [], [rows[0]]
    for y in rows[1:]:
        if y - cur[-1] <= 2:
            cur.append(y)
        else:
            groups.append(cur)
            cur = [y]
    groups.append(cur)
    if len(groups) < 5:
        return None
    sp = float(np.median(np.diff([float(np.mean(g)) for g in groups])))
    return sp if 8.0 <= sp <= 80.0 else None


def renormalize(img: Image.Image, target: float = 30.0) -> Image.Image:
    """Rescale a strip so its MEASURED staff spacing equals `target`.

    The point of doing it per strip rather than by a global constant: the global shrink tested in
    the ladder can only remove the average offset (exam +1.65%), while each strip also carries its
    own error (sd 2.1 px). Measuring per strip removes both. If the size-match explanation is right
    this must beat every fixed rung; if it does not, the explanation is wrong.
    """
    sp = measured_spacing(img)
    if sp is None:
        return img
    return perturb(img, target / sp, 0.0)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--ladder", choices=sorted(LADDERS), default="ramp",
                    help="ramp = dose-response; decompose = one axis at a time, warp held constant")
    # The pre-shrink finding was exam-only and never replicated. The holdout it failed on had NO
    # hard tier, so an effect confined to hard pages could hide there — the stated reason the
    # result was left open. `_realval_v2` has one, so point this at it to close the question:
    #   --strips-dir data/real/rung3/_realval_v2 --ladder fine_scale
    ap.add_argument("--strips-dir", default=str(EXAM),
                    help="pool to probe (default: the frozen clean exam)")
    args = ap.parse_args()
    ladder = LADDERS[args.ladder]
    pool = Path(args.strips_dir)

    import torch
    from data import strip_special
    from eval_omr import align
    from modeling import load_model_and_processor

    recs = [json.loads(l) for l in (pool / "manifest.jsonl").read_text().splitlines() if l.strip()]
    print(f"pool: {pool}  ({len(recs)} strips)")
    if args.limit:
        recs = recs[: args.limit]

    model, processor, _ = load_model_and_processor(str(CKPT))
    model.eval()
    dev = args.device or ("cuda" if torch.cuda.is_available() else
                          "mps" if torch.backends.mps.is_available() else "cpu")
    model.to(dev)
    tok = processor.tokenizer

    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for name, scale, shift in ladder:
        edits = pitch_subs = near = 0
        dist_hist: dict[int, int] = {}
        for k, rec in enumerate(recs):
            p = Path(rec["image"])
            if not p.is_absolute():
                p = pool / rec["image"]
            if not p.exists():
                continue
            img = Image.open(p)
            if name.startswith("op:"):
                img = mechanism_op(name[3:], img)
            elif name.startswith("renormalize"):
                img = renormalize(img)
            elif "raw" not in name:
                # Everything except the raw rung goes through warpAffine, identity included, so
                # the resampling is identical across rungs and only the geometry differs.
                img = perturb(img, scale, shift)
            px = processor(img.convert("RGB"), return_tensors="pt").pixel_values.to(dev)
            with torch.no_grad():
                ids = model.generate(px, max_length=args.max_length)
            hyp = tok.decode(ids[0], skip_special_tokens=True)

            # Edits stay in ID space so the count is the same quantity eval_omr.py reports.
            ref_ids = strip_special(tok(rec["label"], add_special_tokens=True).input_ids, tok)
            hyp_ids = strip_special(tok(hyp, add_special_tokens=True).input_ids, tok)
            edits += sum(1 for op, _, _ in align(ref_ids, hyp_ids) if op != "match")

            # Pitch distance needs WHOLE tokens: `c''8` is several ids, and decoding one id back
            # gives a fragment like "c" or "''" that no note pattern can classify. So align a
            # second time over whitespace tokens, mapped through a shared vocabulary so the
            # project's own align() can still be used.
            vocab: dict[str, int] = {}
            def ids_of(s: str) -> list[int]:
                return [vocab.setdefault(t, len(vocab)) for t in LEX.findall(s)]
            ref_t, hyp_t = ids_of(rec["label"]), ids_of(hyp)
            inv = {v: k for k, v in vocab.items()}
            for op, r, h in align(ref_t, hyp_t):
                if op != "sub":
                    continue
                pr = staff_position(inv[r])
                ph = staff_position(inv[h])
                if pr is None or ph is None:
                    continue
                d = abs(pr - ph)
                dist_hist[d] = dist_hist.get(d, 0) + 1
                # d == 0 is a note swapped for the SAME pitch at a different duration — a
                # note-length error, not a height one. Counted in the histogram, kept out of the
                # pitch total so the off-by-one share is not diluted by the 28% bucket.
                if d == 0:
                    continue
                pitch_subs += 1
                if d <= 2:
                    near += 1
            if (k + 1) % 100 == 0:
                print(f"  {name}: {k+1}/{len(recs)}", flush=True)
        rows.append({"rung": name, "scale": scale, "shift": shift, "edits": edits,
                     "pitch_subs": pitch_subs, "near_1_2": near,
                     "dist_hist": {str(k): v for k, v in sorted(dist_hist.items())}})
        print(f"{name}: edits={edits} pitch_subs={pitch_subs} within_2={near}", flush=True)

    (OUT / "results.json").write_text(json.dumps(rows, indent=1))

    base = rows[0]
    print(f"\n{'rung':>20} {'edits':>7} {'vs base':>9} {'pitch subs':>11} "
          f"{'within +-2':>11} {'% of subs':>10}")
    print("-" * 74)
    for r in rows:
        pct = 100 * r["near_1_2"] / max(r["pitch_subs"], 1)
        print(f"{r['rung']:>20} {r['edits']:>7} {100*(r['edits']-base['edits'])/max(base['edits'],1):>8.1f}% "
              f"{r['pitch_subs']:>11} {r['near_1_2']:>11} {pct:>9.1f}%")

    print("\nThe raw rung must reproduce the known 562-edit exam total; anything else means the "
          "harness is wrong.\nIn the decompose ladder the baseline is the IDENTITY WARP, not raw.")
    print("\ndistance histogram (staff positions between gold and decoded note):")
    for r in rows:
        print(f"  {r['rung']:>20}  {r['dist_hist']}")
    print(f"\nresults -> {OUT/'results.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
