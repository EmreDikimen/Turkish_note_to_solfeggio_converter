r"""Round-3 Check A — does the model invent music when a crop has no notes in it?

THE CLAIM UNDER TEST (docs/rung3/round3.md §3). `stripExport` always builds a strip out of whole
measures, so a "clef + key signature, no notes" picture cannot occur in training: 0 of 40,826
strips. The slicer DOES produce them from real pages, and on one such exam strip the model emitted
19 edits against 8 gold tokens. Twelve short strips carry 21% of all exam edits. If that
generalises, teaching `stripExport` to emit the shape is cheap and worth doing.

WHY THIS PROBE EXISTS. The claim rests on FOUR exam strips. Before changing the corpus we should
know whether the failure reproduces. This costs a decode, no training — the same trade
`src/vision/degrade_probe.py` makes for the every-share sweep.

WHAT IT MEASURES. Two arms, reported separately and never pooled:

  --decode   the genuine article: real slicer output whose GOLD LABEL contains no note tokens.
             Across every labelled pool we own there are exactly EIGHT of these (4 exam, 4 nota).
             Gold has no notes, so any note in the decode is invented. Honest, and underpowered:
             at n=8 a 1-in-8 result cannot separate "rare" from "the 50% bar" on its own.
  --sweep    the claim the corpus change actually rests on — "twelve short strips carry 21% of all
             edits". Decode the whole exam once and plot edits against strip width and note count.
             This is where the power is: 326 strips, no new gold, and it tests the SHAPE claim
             rather than the hallucination claim.

MANUFACTURED CROPS WERE TRIED AND ABANDONED. The obvious way to get more note-free crops is to cut
row-start strips down so the notes fall outside the frame. Two detectors were built and both failed
in eyeballing — the first left a hollow half-note in frame (open noteheads fail a fill test) and a
beam-merged group (one component too wide for a notehead test); the second over-corrected and
sliced the signature's own flats off, which would have charged the model for our bad crop, since
gold still lists every accidental. A third, cutting after the printed signature run and self-checked
against the gold's accidental count, refused 483 of 485 strips rather than guess. The arm was
dropped: it is a stress test of a shape WE chose, never evidence about how often the slicer makes
it, and --sweep answers the real question with data we already have.

EXAM DISCIPLINE. The `found` arm includes 4 exam strips, read through `round2-stage2-best`, whose
exam turn is already spent. Re-reading a spent exam with a frozen model is the manoeuvre
docs/rung3/ship-criteria.md used to backfill the arc-\tup3 baseline: same frozen model, same frozen
exam, zero selection leakage. The `cut` arm is sourced from NON-exam pools only, so the powered
half of the result never touches exam pixels.

PRE-REGISTERED READ (written before the first run, per the Round-3 plan): if >=50% of strips
invent notes, the `stripExport` change is justified. Below that, drop it from Round 3 and say so.

Usage:
    .venv-ml/bin/python scripts/rung3/empty_crop_probe.py --build   # cut the crops, write a sheet
    .venv-ml/bin/python scripts/rung3/empty_crop_probe.py --decode  # run the model, report
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
OUT = ROOT / "data/real/rung3/empty_crop_probe"

# Pools searched for note-free strips. The exam is here because its 4 are the strips the round-3
# claim was written from; see the exam-discipline note above for why re-reading them is safe.
POOLS = {
    "exam": ROOT / "data/real/rung3/strips_exam_v2_clean",
    "nota": ROOT / "data/real/rung3/strips_nota",
    "realval": ROOT / "data/real/rung3/_realval_v2",
    "r1": ROOT / "data/real/rung3/strips_r1",
}
EXAM = ROOT / "data/real/rung3/strips_exam_v2_clean"

NOTE_TOK = re.compile(r"^(?:[a-g](?:'+|,+)?|r)\d+\.?$")

# Width buckets for --sweep, in pixels. The exam's median strip is ~910 px and `stripExport` never
# makes anything under ~580, so the interesting question is entirely in the first two buckets.
WIDTH_BUCKETS = [(0, 350), (350, 600), (600, 900), (900, 1200), (1200, 10 ** 6)]


def staff_geometry(bw: np.ndarray) -> tuple[float, float, float] | None:
    """(spacing, top staff line y, bottom staff line y). Same row-darkness test as domain_gap.py."""
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
    centres = [float(np.mean(g)) for g in groups]
    sp = float(np.median(np.diff(centres)))
    if not (8.0 <= sp <= 80.0):
        return None
    return sp, centres[0], centres[-1]


def read_manifest(pool: Path) -> list[dict]:
    mf = pool / "manifest.jsonl"
    if not mf.exists():
        return []
    out = []
    for line in mf.read_text().splitlines():
        if line.strip():
            out.append(json.loads(line))
    return out


def note_count(label: str) -> int:
    return sum(1 for t in label.split() if NOTE_TOK.match(t))


def build(args: argparse.Namespace) -> int:
    """Collect every real strip whose GOLD contains no note tokens. There are eight."""
    OUT.mkdir(parents=True, exist_ok=True)
    found = []
    for name, pool in POOLS.items():
        for rec in read_manifest(pool):
            p = Path(rec["image"])
            if not p.is_absolute():
                p = pool / rec["image"]
            if p.exists() and note_count(rec["label"]) == 0:
                found.append({"arm": "found", "pool": name, "src": str(p),
                              "image": p.name, "gold": rec["label"]})
    mf = OUT / "manifest.jsonl"
    with mf.open("w") as f:
        for r in found:
            f.write(json.dumps(r) + "\n")
    print(f"found arm: {len(found)} strips (gold has no note tokens)")
    for r in found:
        print(f"   [{r['pool']}] {r['image']}\n      {r['gold']}")
    print(f"\nmanifest -> {mf}")
    return 0


def decode(args: argparse.Namespace) -> int:
    import torch
    from modeling import load_model_and_processor

    mf = OUT / "manifest.jsonl"
    if not mf.exists():
        print(f"no manifest at {mf} — run --build first", file=sys.stderr)
        return 1
    rows = [json.loads(l) for l in mf.read_text().splitlines() if l.strip()]
    drop = set()
    dropfile = OUT / "dropped.txt"
    if dropfile.exists():
        drop = {l.strip() for l in dropfile.read_text().splitlines()
                if l.strip() and not l.startswith("#")}
    rows = [r for r in rows if r["image"] not in drop]
    if drop:
        print(f"dropped {len(drop)} eyeballed-invalid crops (see {dropfile})\n")

    from data import strip_special
    from eval_omr import align

    model, processor, _ = load_model_and_processor(str(CKPT))
    model.eval()
    dev = args.device or ("cuda" if torch.cuda.is_available() else
                          "mps" if torch.backends.mps.is_available() else "cpu")
    model.to(dev)

    results = []
    for r in rows:
        img = Image.open(Path(r["src"])).convert("RGB")
        px = processor(img, return_tensors="pt").pixel_values.to(dev)
        with torch.no_grad():
            ids = model.generate(px, max_length=args.max_length)
        hyp = processor.tokenizer.decode(ids[0], skip_special_tokens=True)
        # Edits, in the SAME id space eval_omr.py scores in — string-level diffing is lossy around
        # the added tokens. This is the number the round-3 goal is written in ("pages needing <=5
        # corrections"), and it is what separates "invented a bar" from "misread the signature":
        # the note count below sees only the first.
        ref_ids = strip_special(processor.tokenizer(r["gold"], add_special_tokens=True).input_ids,
                                processor.tokenizer)
        hyp_ids = strip_special(processor.tokenizer(hyp, add_special_tokens=True).input_ids,
                                processor.tokenizer)
        ops = align(ref_ids, hyp_ids)
        edits = sum(1 for op, _, _ in ops if op != "match")
        results.append({**r, "decoded": hyp, "invented": note_count(hyp),
                        "hyp_tokens": len(hyp.split()), "gold_ids": len(ref_ids),
                        "edits": edits, "exact": edits == 0})

    (OUT / "results.jsonl").write_text(
        "".join(json.dumps(x) + "\n" for x in results))

    print(f"{'arm':>6} {'n':>4} {'inventing':>12} {'notes made up':>14} "
          f"{'exact':>8} {'median edits':>13} {'edits>5':>9}")
    print("-" * 74)
    for arm in ("found", "cut"):
        sub = [x for x in results if x["arm"] == arm]
        if not sub:
            continue
        bad = [x for x in sub if x["invented"] > 0]
        ex = [x for x in sub if x["exact"]]
        over = [x for x in sub if x["edits"] > 5]
        med = float(np.median([x["edits"] for x in sub]))
        print(f"{arm:>6} {len(sub):>4} {len(bad):>4} {100*len(bad)/len(sub):>6.0f}% "
              f"{sum(x['invented'] for x in sub):>14} "
              f"{len(ex):>3} {100*len(ex)/len(sub):>3.0f}% {med:>13.1f} "
              f"{len(over):>3} {100*len(over)/len(sub):>3.0f}%")

    print(f"\nPRE-REGISTERED BAR: >=50% of strips inventing notes justifies the stripExport change.")
    print("Edits are reported beside it because the bar only counts HALLUCINATION; a crop can be")
    print("badly read without a single invented note, and that is a different fix.\n")
    print("per-strip detail (gold has NO notes, so every note below is invented):\n")
    for x in sorted(results, key=lambda z: (-z["invented"], -z["edits"])):
        flag = "INVENTS" if x["invented"] else "no-notes"
        print(f"  {flag} {x['edits']:>2} edits / {x['gold_ids']:>2} gold ids "
              f"[{x['arm']}/{x['pool']}] {x['image']}")
        print(f"      gold: {x['gold']}")
        print(f"      hyp : {x['decoded']}")
    print(f"\nresults -> {OUT/'results.jsonl'}")
    return 0


def sweep(args: argparse.Namespace) -> int:
    r"""Decode the whole exam and ask whether SHORT crops really carry the edits.

    This is the powered half of Check A. The corpus change in round3.md rests on "twelve such
    strips carry 21% of all edits" — a claim about crop SHAPE, not about hallucination, and one
    that 326 strips can settle without a single new label. Reported per width bucket:
    strips, share of all edits, median edits, and the share needing more than 5 corrections
    (the metric the Round-3 goal is written in).

    Same frozen model on the same frozen exam as the spent Round-2 read, so no selection leakage.
    """
    import torch
    from data import strip_special
    from eval_omr import align
    from modeling import load_model_and_processor

    recs = read_manifest(EXAM)
    if not recs:
        print(f"no manifest under {EXAM}", file=sys.stderr)
        return 1
    if args.limit:
        recs = recs[: args.limit]

    model, processor, _ = load_model_and_processor(str(CKPT))
    model.eval()
    dev = args.device or ("cuda" if torch.cuda.is_available() else
                          "mps" if torch.backends.mps.is_available() else "cpu")
    model.to(dev)

    out = []
    for i, rec in enumerate(recs):
        p = Path(rec["image"])
        if not p.is_absolute():
            p = EXAM / rec["image"]
        if not p.exists():
            continue
        img = Image.open(p).convert("RGB")
        px = processor(img, return_tensors="pt").pixel_values.to(dev)
        with torch.no_grad():
            ids = model.generate(px, max_length=args.max_length)
        hyp = processor.tokenizer.decode(ids[0], skip_special_tokens=True)
        ref_ids = strip_special(
            processor.tokenizer(rec["label"], add_special_tokens=True).input_ids,
            processor.tokenizer)
        hyp_ids = strip_special(
            processor.tokenizer(hyp, add_special_tokens=True).input_ids, processor.tokenizer)
        edits = sum(1 for op, _, _ in align(ref_ids, hyp_ids) if op != "match")
        out.append({"image": p.name, "w": img.width, "gold": rec["label"], "decoded": hyp,
                    "notes": note_count(rec["label"]), "gold_ids": len(ref_ids), "edits": edits})
        if (i + 1) % 25 == 0:
            print(f"  ... {i+1}/{len(recs)}", flush=True)

    dst = OUT / "sweep_exam.jsonl"
    OUT.mkdir(parents=True, exist_ok=True)
    dst.write_text("".join(json.dumps(x) + "\n" for x in out))

    total = sum(x["edits"] for x in out)
    print(f"\n{len(out)} exam strips, {total} edits total\n")
    print(f"{'width px':>13} {'strips':>7} {'% strips':>9} {'edits':>7} {'% of edits':>11} "
          f"{'median':>7} {'>5 edits':>9}")
    print("-" * 70)
    for lo, hi in WIDTH_BUCKETS:
        sub = [x for x in out if lo <= x["w"] < hi]
        if not sub:
            continue
        e = sum(x["edits"] for x in sub)
        over = sum(1 for x in sub if x["edits"] > 5)
        lab = f"{lo}-{hi if hi < 10**6 else ''}"
        print(f"{lab:>13} {len(sub):>7} {100*len(sub)/len(out):>8.1f}% {e:>7} "
              f"{100*e/max(total,1):>10.1f}% {np.median([x['edits'] for x in sub]):>7.1f} "
              f"{100*over/len(sub):>8.0f}%")

    print(f"\n{'notes in gold':>13} {'strips':>7} {'% strips':>9} {'edits':>7} {'% of edits':>11} "
          f"{'median':>7}")
    print("-" * 62)
    for lo, hi in [(0, 1), (1, 4), (4, 8), (8, 12), (12, 10 ** 6)]:
        sub = [x for x in out if lo <= x["notes"] < hi]
        if not sub:
            continue
        e = sum(x["edits"] for x in sub)
        lab = f"{lo}-{hi-1 if hi < 10**6 else ''}"
        print(f"{lab:>13} {len(sub):>7} {100*len(sub)/len(out):>8.1f}% {e:>7} "
              f"{100*e/max(total,1):>10.1f}% {np.median([x['edits'] for x in sub]):>7.1f}")

    worst = sorted(out, key=lambda x: -x["edits"])[:12]
    share = 100 * sum(x["edits"] for x in worst) / max(total, 1)
    print(f"\nworst 12 strips carry {share:.1f}% of all edits "
          f"(round3.md claims 21% for 12 SHORT strips); their widths: "
          f"{sorted(x['w'] for x in worst)}")
    print(f"\nper-strip -> {dst}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", action="store_true", help="collect the note-free strips")
    ap.add_argument("--decode", action="store_true", help="run the model on them and report")
    ap.add_argument("--sweep", action="store_true",
                    help="decode the whole exam; edits by strip width and note count")
    ap.add_argument("--limit", type=int, default=None, help="--sweep smoke tests")
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    args = ap.parse_args()
    if args.build:
        return build(args)
    if args.decode:
        return decode(args)
    if args.sweep:
        return sweep(args)
    ap.error("pass --build, --decode or --sweep")


if __name__ == "__main__":
    raise SystemExit(main())
