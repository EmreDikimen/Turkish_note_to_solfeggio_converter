r"""Rebuild real-val so it MATCHES THE EXAM'S DIFFICULTY MIX (docs/STATUS.md, item 1).

THE PROBLEM. Real-val reads ~96% while the exam reads 74% — a gap of ~22-28pp, measured. It is not
that real-val is a different edition; that was tested and the clean tiers agree within 2pp. It is
COMPOSITION: the exam is 18% easy / 41% mid / 41% hard, and real-val is 59% easy / 41% mid / **0%
hard**. A practice test with no hard questions cannot rank candidates, so every round so far has
been a blind one-shot costing a full re-render plus a paid training run.

WHAT "HARD" MEANS, exactly (from the tier dirs the 2026-07-23 decomposition built):
    easy  no review at all - clean auto-accepts
    mid   review for nd_review / acc_disagreement / low_coverage / sig_mismatch / nav_* / tup_holdout
    hard  review for **row_unaligned** or **nd_high**
Real-val has zero hard strips because those two reasons are DROPS, not reviews: the emitter throws
them away (6,168 of them in the nota pool alone) rather than emit a label it cannot trust. The exam
got its 145 hard strips because they were recovered and hand-labelled one at a time.

SO THIS CANNOT BE DONE BY FILTERING ALONE. There is no pile of labelled hard strips to draw from —
they have to be labelled. This script does everything around that:

  --report   what the mix is now, what the exam's is, and exactly how many hard strips are owed
  --queue N  pick N hard-tier candidates (val-side pieces, never exam pieces), decode them with the
             CURRENT model to seed the review, and write a queue `review_ui.py` can drive
  --build    assemble the rebuilt pool once the queue has verdicts

WHY THE SEED IS RE-DECODED. `data/real/strips/*/**_decode.json` already holds a decode per strip,
but it came from `rung3-labeler` — the weak early model. Seeding the queue from it would mean more
hand corrections. Re-decoding with `round2-stage2-best` costs a couple of minutes and makes the
human pass shorter.

ON DECODE-DERIVED LABELS. The rebuild is supposed to exclude them from the metric pool. Measured
today: `promote_labels.py` only keeps a decode when the verdict is `ok`, and current real-val has
exactly **1** such strip — so this filter, which the 2026-07-23 note expected to matter, is
effectively a no-op now (the 2026-07-27 nota-full review replaced those labels with human ones).
It is still applied, and still reported, so the claim stays checkable rather than assumed.

Usage:
    .venv-ml/bin/python scripts/rung3/build_realval_v2.py --report
    .venv-ml/bin/python scripts/rung3/build_realval_v2.py --queue 130
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))

RUNG3 = ROOT / "data/real/rung3"
STRIP_ROOT = ROOT / "data/real/strips"
CKPT = ROOT / "data/checkpoints/round2-stage2-best"
QUEUE_DIR = RUNG3 / "_realval_hard"
QUEUE_CSV = QUEUE_DIR / "realval_hard.csv"

HARD_REASONS = ("row_unaligned", "nd_high")
# The exam's own hard-tier split, so the queue mirrors the difficulty it has to predict.
EXAM_HARD_MIX = {"row_unaligned": 107, "nd_high": 38}

POOLS = ["strips_nota", "strips_r1", "strips_tup"]


def read_manifest(p: Path) -> list[dict]:
    mf = p / "manifest.jsonl"
    if not mf.exists():
        return []
    return [json.loads(l) for l in mf.read_text().splitlines() if l.strip()]


def tier_of(rec: dict) -> str:
    """easy / mid / hard, by the same rule the 2026-07-23 tier dirs were built with."""
    if rec.get("promoted") != "review":
        return "easy"
    return "hard" if rec.get("reason") in HARD_REASONS else "mid"


def exam_mix() -> dict[str, int]:
    out: dict[str, int] = {}
    for tier in ("easy", "mid", "hard"):
        d = RUNG3 / f"_exam_tier_{tier}"
        out[tier] = len(read_manifest(d))
    return out


def realval_now() -> list[dict]:
    return read_manifest(RUNG3 / "_realval")


def report() -> int:
    ex, rv = exam_mix(), realval_now()
    have = Counter(tier_of(r) for r in rv)
    decode_derived = [r for r in rv if r.get("verdict") == "ok"]
    ex_tot, rv_tot = sum(ex.values()), len(rv)

    print(f"{'tier':>6} {'exam n':>8} {'exam %':>8} {'realval n':>10} {'realval %':>10}")
    print("-" * 46)
    for t in ("easy", "mid", "hard"):
        print(f"{t:>6} {ex[t]:>8} {100*ex[t]/ex_tot:>7.1f}% {have[t]:>10} "
              f"{100*have[t]/max(rv_tot,1):>9.1f}%")
    print(f"{'total':>6} {ex_tot:>8} {'':>8} {rv_tot:>10}")

    print(f"\ndecode-derived labels in real-val (verdict 'ok'): {len(decode_derived)} "
          f"— these leave the metric pool")

    # Hold `mid` fixed (it is the largest clean tier we have) and solve for the rest.
    mid = have["mid"] - sum(1 for r in decode_derived if tier_of(r) == "mid")
    target_total = mid / (ex["mid"] / ex_tot)
    want_easy = round(target_total * ex["easy"] / ex_tot)
    want_hard = round(target_total * ex["hard"] / ex_tot)
    print(f"\nTo match the exam's mix while keeping every usable mid strip ({mid}):")
    print(f"  total {round(target_total)}   easy {want_easy} (have {have['easy']}, drop "
          f"{max(0, have['easy']-want_easy)})   hard {want_hard} (have {have['hard']})")
    print(f"\n>>> {want_hard} HARD strips must be labelled. That is the whole cost of this rebuild.")

    avail = Counter()
    for pool in POOLS:
        f = RUNG3 / pool / "emit_drops.csv"
        if not f.exists():
            continue
        with f.open() as fh:
            for r in csv.DictReader(fh):
                if r["reason"] in HARD_REASONS:
                    avail[r["reason"]] += 1
    print(f"\ncandidates available in the emit_drops queues: {dict(avail)} "
          f"(total {sum(avail.values())})")
    return 0


def build_queue(n: int) -> int:
    import torch
    from PIL import Image
    from data import is_real_val_piece
    from modeling import load_model_and_processor

    synth_val = set(json.loads((ROOT / "data/split_v4.json").read_text())["val_pieces"])
    exam_ids = {p["symbtr_file"].replace(".txt", "")
                for p in json.loads((RUNG3 / "testset.json").read_text())["pieces"]}

    # Gather candidates: hard-reason drops on VAL-side, NON-exam pieces.
    cands: list[dict] = []
    for pool in POOLS:
        f = RUNG3 / pool / "emit_drops.csv"
        if not f.exists():
            continue
        with f.open() as fh:
            for r in csv.DictReader(fh):
                if r["reason"] not in HARD_REASONS:
                    continue
                sym = r.get("symbtr", "")
                if not sym or sym in exam_ids:
                    continue                        # exam pieces may never enter real-val
                if not is_real_val_piece(sym, synth_val):
                    continue                        # must be the val side, same rule as train.py
                png = STRIP_ROOT / r["page"] / r["strip"]
                if png.exists():
                    cands.append({**r, "png": str(png)})

    if not cands:
        print("no candidates — nothing on the val side of the hard drops", file=sys.stderr)
        return 1

    # Mirror the exam's own row_unaligned : nd_high balance, and spread across pieces so the
    # queue is not five pages repeated — a tier that is one bad scan tells us nothing.
    by_reason: dict[str, list[dict]] = {k: [] for k in HARD_REASONS}
    for c in cands:
        by_reason[c["reason"]].append(c)
    total_mix = sum(EXAM_HARD_MIX.values())
    picked: list[dict] = []
    for reason, share in EXAM_HARD_MIX.items():
        want = round(n * share / total_mix)
        pool_r = sorted(by_reason[reason], key=lambda c: (c["symbtr"], c["strip"]))
        seen: Counter = Counter()
        for c in pool_r:
            if len(picked) >= sum(round(n * s / total_mix) for s in EXAM_HARD_MIX.values()):
                break
            if sum(1 for p in picked if p["reason"] == reason) >= want:
                break
            if seen[c["symbtr"]] >= 3:              # at most 3 strips per piece
                continue
            seen[c["symbtr"]] += 1
            picked.append(c)

    print(f"{len(cands)} eligible candidates -> picked {len(picked)} "
          f"({dict(Counter(p['reason'] for p in picked))}) "
          f"over {len(set(p['symbtr'] for p in picked))} pieces")

    # Seed each row with the CURRENT model's decode (see module docstring).
    model, proc, _ = load_model_and_processor(str(CKPT))
    model.eval()
    model.to("cpu")
    tok = proc.tokenizer
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for i, c in enumerate(picked):
        img = Image.open(c["png"]).convert("RGB")
        px = proc(img, return_tensors="pt").pixel_values
        with torch.no_grad():
            gen = model.generate(px, max_length=100, output_scores=True,
                                 return_dict_in_generate=True)
        ids = gen.sequences
        hyp = tok.decode(ids[0], skip_special_tokens=True)
        # Per-token confidence, so the queue can be ordered easiest-first. A strip the model is
        # sure about is a fast "ok" for the reviewer; the unsure ones are where the eye is needed.
        # decode_page.py already computes this for its own review columns — same idea.
        lps = []
        for step, sc in enumerate(gen.scores):
            lp = torch.log_softmax(sc[0].float(), dim=-1)
            tid = ids[0][step + 1]
            lps.append(float(lp[tid]))
        min_lp = round(min(lps), 4) if lps else 0.0
        mean_lp = round(sum(lps) / len(lps), 4) if lps else 0.0
        dst = QUEUE_DIR / c["strip"]
        if not dst.exists():
            img.convert("L").save(dst)
        rows.append({
            "piece": c["symbtr"], "page": c["page"], "strip": c["strip"],
            "reason": c["reason"], "nd": "", "min_logprob": min_lp,
            "mean_logprob": mean_lp, "exam": "",
            # label is SEEDED FROM THE DECODE on purpose: these strips have no trustworthy
            # SymbTr alignment (that is why they were dropped), so the human is verdicting the
            # model's reading against the picture. verdict `ok` therefore means "a person looked
            # and the decode was right" — human-verified, not decode-derived.
            "label": hyp, "decoded": hyp, "verdict": "", "corrected_label": "", "by": "",
        })
        if (i + 1) % 25 == 0:
            print(f"  decoded {i+1}/{len(picked)}", flush=True)

    # Most-confident first: the reviewer confirms a run of easy ones quickly and reaches the
    # genuinely ambiguous strips knowing they are the ones that need care.
    rows.sort(key=lambda r: -r["min_logprob"])
    with QUEUE_CSV.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"\nqueue -> {QUEUE_CSV}\nstrips -> {QUEUE_DIR}")
    print("\nNEXT: add a `realval-hard` entry to review_ui.py's QUEUES pointing at that CSV, then")
    print("verdict every row. Every row needs a human look — an unverdicted hard strip must NOT")
    print("enter the metric pool, or the rebuild reintroduces the problem it exists to fix.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--queue", type=int, metavar="N")
    args = ap.parse_args()
    if args.report:
        return report()
    if args.queue:
        return build_queue(args.queue)
    ap.error("pass --report or --queue N")


if __name__ == "__main__":
    raise SystemExit(main())
