"""Does the model read microtonal sharps worse on WIDE strips?

The encoder's input box is fixed (409x583, DonutImageProcessor: align_long_axis -> thumbnail ->
pad), so a strip is scaled by min(409/short, 583/long). Strips are ~336px tall and 579-2472px
wide, so the WIDER the strip, the smaller everything inside it arrives at the encoder — measured
scale runs from ~1.0 (narrow) down to ~0.24 (widest). If the komaSharp/kucukSharp weakness is a
RESOLUTION problem (the glyphs' distinguishing strokes merge when shrunk), recall must fall as the
scale falls. If it is a DATA problem (inline kucukSharp is 0.5% of strips_v3 and never co-occurs
with komaSharp), recall should be flat across scale.

The confound this must control for: wide strips hold more notes, so they are harder for every
reason at once. So the report carries controls — a healthy accidental class, and overall token
accuracy — measured over the same buckets. The sharp hypothesis needs the sharps to degrade
MORE STEEPLY than the controls, not merely to degrade.

    .venv-ml/bin/python scripts/rung3/sharp_width_test.py            # photo gold (hand-verified)
    .venv-ml/bin/python scripts/rung3/sharp_width_test.py --clean    # clean exam gold
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from data import strip_special          # noqa: E402
from eval_omr import align              # noqa: E402

CKPT = "data/checkpoints/round1-best"
PHOTO_CSV = Path("data/real/rung3/photos_exam_strips/photo_gold.csv")
PHOTO_ROOT = Path("data/real/rung3/photos_exam_strips")
CLEAN_DIR = Path("data/real/rung3/strips_exam_v2_clean")

BOX_W, BOX_H = 409, 583          # preprocessor_config.json
FOCUS = ["\\komaSharp", "\\kucukSharp"]
CONTROLS = ["\\bakiyeSharp", "\\kucukFlat"]
BUCKETS = [(0.0, 0.35), (0.35, 0.45), (0.45, 0.60), (0.60, 2.0)]


def encoder_scale(w: int, h: int) -> float:
    """Fraction of original size the encoder receives (aspect-preserving thumbnail into the box)."""
    short, long = min(w, h), max(w, h)
    return min(BOX_W / short, BOX_H / long)


def bucket_of(s: float) -> tuple[float, float]:
    for b in BUCKETS:
        if b[0] <= s < b[1]:
            return b
    return BUCKETS[-1]


def load_photo_rows() -> list[tuple[Path, str, str]]:
    """(image, truth, hypothesis) for hand-verified photo strips."""
    out = []
    for r in csv.DictReader(open(PHOTO_CSV)):
        if r["verdict"] not in ("ok", "fix"):
            continue
        truth = r["corrected_label"] if (r["verdict"] == "fix" and r["corrected_label"].strip()) else r["label"]
        img = PHOTO_ROOT / r["page"] / r["strip"]
        if img.exists():
            out.append((img, truth, r["decoded"]))
    return out


def load_clean_rows() -> list[tuple[Path, str, str]]:
    """(image, truth, hypothesis) for the clean exam.

    Truth comes from the CORRECTED manifest (the 13 audited fixes are already folded in by
    apply_exam_fix.py); the hypothesis is the per-strip decode cached in exam_fix.csv, which
    build_exam_fix_queue.py produced by decoding each frozen strip directly with round1-best.
    """
    truth = {}
    for l in open(CLEAN_DIR / "manifest.jsonl"):
        r = json.loads(l)
        truth[r.get("strip") or r.get("image")] = r["label"]
    out = []
    for r in csv.DictReader(open(CLEAN_DIR / "exam_fix.csv")):
        name = r["strip"]
        if name in truth and r["decoded"].strip():
            img = CLEAN_DIR / name
            if img.exists():
                out.append((img, truth[name], r["decoded"]))
    return out


def main() -> None:
    from transformers import AutoProcessor
    tok = AutoProcessor.from_pretrained(CKPT).tokenizer

    rows = load_clean_rows() if "--clean" in sys.argv else load_photo_rows()
    tracked = {tok.convert_tokens_to_ids(t): t for t in FOCUS + CONTROLS}

    gold: dict = defaultdict(Counter)
    hit: dict = defaultdict(Counter)
    toks: Counter = Counter()
    errs: Counter = Counter()
    nstrips: Counter = Counter()
    widths: dict = defaultdict(list)

    for img, truth, hypothesis in rows:
        w, h = Image.open(img).size
        b = bucket_of(encoder_scale(w, h))
        nstrips[b] += 1
        widths[b].append(w)
        ref = strip_special(tok(truth, add_special_tokens=True).input_ids, tok)
        hyp = strip_special(tok(hypothesis, add_special_tokens=True).input_ids, tok)
        toks[b] += len(ref)
        for op, rr, hh in align(ref, hyp):
            if op != "match":
                errs[b] += 1
            if rr in tracked:
                gold[b][rr] += 1
                if op == "match":
                    hit[b][rr] += 1

    src = "CLEAN EXAM" if "--clean" in sys.argv else "PHOTO GOLD (hand-verified)"
    print(f"=== sharp recall vs encoder scale — {src}, {len(rows)} strips ===\n")
    hdr = f"{'encoder scale':<16}{'strips':>7}{'med width':>11}"
    for t in FOCUS + CONTROLS:
        hdr += f"{t.replace(chr(92), ''):>14}"
    hdr += f"{'token acc':>11}"
    print(hdr)
    print("-" * len(hdr))

    for b in BUCKETS:
        if not nstrips[b]:
            continue
        med = sorted(widths[b])[len(widths[b]) // 2]
        line = f"{b[0]:.2f}-{b[1]:.2f}".ljust(16) + f"{nstrips[b]:>7}{med:>11}"
        for t in FOCUS + CONTROLS:
            tid = tok.convert_tokens_to_ids(t)
            g, hh = gold[b][tid], hit[b][tid]
            line += (f"{hh/g:>10.0%} (n={g})" if g else f"{'-':>14}")
        acc = 1 - errs[b] / toks[b] if toks[b] else float("nan")
        line += f"{acc:>11.1%}"
        print(line)

    print("\nReading it: if the FOCUS sharps fall with scale while the CONTROLS and token accuracy")
    print("stay flatter, the glyphs are being destroyed by the shrink (fix = narrower strips).")
    print("If everything falls together, wide strips are just harder (fix = more training examples).")


if __name__ == "__main__":
    main()
