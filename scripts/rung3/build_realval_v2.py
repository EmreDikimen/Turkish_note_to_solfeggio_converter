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
             CURRENT model to seed the review, and write a queue `review_ui.py` can drive —
             ordered WORST-FIRST (see build_queue)
  --build    assemble the rebuilt pool once the queue has verdicts

⚠ `--strip-root` / `--pools` must point at the CURRENT slicer's crops. They default to the
2026-07-29 re-slice (`strips_v2` / `strips_v2emit`); a later slicer change moves them again, and
running against a stale root rebuilds the queue from crops the model will never see in production
without raising anything.

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
import random
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))

RUNG3 = ROOT / "data/real/rung3"
CKPT = ROOT / "data/checkpoints/round2-stage2-best"
# The queue is VERSIONED, one directory per re-slice. Strip filenames are stable across a re-slice
# (`<page>_s<NN>_w<NN>.png`) but the PIXELS behind them are not — 59 of the 2026-07-29 candidates
# reuse a name from the first queue. Writing a new queue into the old directory would leave the
# reviewer looking at last week's crop while the CSV row describes this week's, which is the exact
# failure the re-slice exists to prevent. Versioning also keeps the previous round's verdicts as a
# record instead of overwriting them.
QUEUE_VERSION = "v2"

HARD_REASONS = ("row_unaligned", "nd_high")
# The exam's own hard-tier split, so the queue mirrors the difficulty it has to predict.
EXAM_HARD_MIX = {"row_unaligned": 107, "nd_high": 38}

# Which crops and which emit the queue is drawn from. These are FLAGS, not constants, because a
# slicer change invalidates every crop on disk and the pool moves with it: the 2026-07-29 overhaul
# is the second time, and pointing this script at the previous re-slice's output would rebuild the
# queue from stale pictures without erroring — it would just be quietly wrong.
DEFAULT_STRIP_ROOT = "data/real/strips_v2"
DEFAULT_POOLS = ["strips_v2emit"]


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


def report(pools: list[str]) -> int:
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
    for pool in pools:
        f = RUNG3 / pool / "emit_drops.csv"
        if not f.exists():
            continue
        with f.open() as fh:
            for r in csv.DictReader(fh):
                if r["reason"] in HARD_REASONS:
                    avail[r["reason"]] += 1
    print(f"\ncandidates available in the emit_drops queues {pools}: {dict(avail)} "
          f"(total {sum(avail.values())})")
    return 0


def queue_paths(version: str) -> tuple[Path, Path]:
    """(directory, csv) for a queue version. `v1` is the original un-suffixed pair, kept so the
    first round's 130 verdicts stay readable at the path they were written to."""
    d = RUNG3 / ("_realval_hard" if version == "v1" else f"_realval_hard_{version}")
    return d, d / ("realval_hard.csv" if version == "v1" else f"realval_hard_{version}.csv")


def build_queue(n: int, strip_root: Path, pools: list[str], version: str) -> int:
    import torch
    from PIL import Image
    from data import is_real_val_piece
    from modeling import load_model_and_processor

    synth_val = set(json.loads((ROOT / "data/split_v4.json").read_text())["val_pieces"])
    exam_ids = {p["symbtr_file"].replace(".txt", "")
                for p in json.loads((RUNG3 / "testset.json").read_text())["pieces"]}

    # Gather candidates: hard-reason drops on VAL-side, NON-exam pieces.
    cands: list[dict] = []
    for pool in pools:
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
                png = strip_root / r["page"] / r["strip"]
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
    queue_dir, queue_csv = queue_paths(version)
    if queue_csv.exists():
        raise SystemExit(
            f"{queue_csv} already exists — refusing to overwrite verdicts. Bump QUEUE_VERSION "
            f"(or pass --queue-version) rather than writing over a labelled queue.")

    model, proc, _ = load_model_and_processor(str(CKPT))
    model.eval()
    model.to("cpu")
    tok = proc.tokenizer
    queue_dir.mkdir(parents=True, exist_ok=True)
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
        # Always rewrite: inside a queue version the filename MUST bind to these pixels.
        img.convert("L").save(queue_dir / c["strip"])
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

    # LEAST-confident first (reversed 2026-07-29, owner's call — was most-confident first).
    # The calibration is what decides this: at min_logprob > -0.1 the decode is already exactly
    # right 80% of the time, below -1.0 only 4%. So the confident head is mostly the reviewer
    # confirming what is already correct, and nearly every real correction lives in the tail.
    # Worst-first spends the human on the errors, and lets the run stop once the remaining rows
    # are demonstrably clean — see the sampled stopping rule in docs/rung3/labeling.md.
    rows.sort(key=lambda r: r["min_logprob"])
    with queue_csv.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"\nqueue -> {queue_csv}\nstrips -> {queue_dir}")
    print("\nNEXT: point review_ui.py's `realval-hard` queue at that CSV and work DOWN from the")
    print("top — rows are ordered worst-first, so the corrections come early. You may stop before")
    print("the end, but only on the sampled check in docs/rung3/labeling.md: an unread row that is")
    print("silently accepted becomes gold, and a wrong one scores a model that FIXES it as a")
    print("regression. Rows accepted without reading must be written with `by=tail-accept`.")
    return 0


# A written label glues the duration to the note ("f''32"); the model emits it spaced ("f'' 32").
# Measured: for 32 ONLY the two forms tokenize to identical ids, so normalising is lossless and the
# reviewer never has to touch it. 16 and 8 DO differ in id space — never widen this.
SPACED_32_RE = re.compile(r"(?<=\S)\s+32\b")


def piece_provenance() -> dict[str, tuple[str, str]]:
    """SymbTr piece stem -> (source, makam), read off the matched/ tree.

    The queue CSV carries only the piece id, but a real-val row needs its source ("nota" /
    "neyzen") or eval_omr.py files it under "synthetic" in the per-source table.
    """
    sys.path.insert(0, str(ROOT / "scripts" / "rung3"))
    from emit_strip_labels import load_piece

    out: dict[str, tuple[str, str]] = {}
    for match in (RUNG3 / "matched").rglob("match.json"):
        p = load_piece(match.parent)
        if p is not None:
            out[p.symbtr_stem] = (p.source, p.makam)
    return out


def build(strip_root: Path, version: str, out_name: str, seed: int) -> int:
    """Assemble the rebuilt real-val: current pool + the labelled hard tier, downsampled to the
    exam's difficulty mix. Writes a NEW directory — `_realval` is left intact, same reason the
    queues are versioned."""
    queue_dir, queue_csv = queue_paths(version)
    if not queue_csv.exists():
        raise SystemExit(f"{queue_csv} does not exist — stage a queue first (--queue N)")

    rows = list(csv.DictReader(queue_csv.open()))
    pending = [r for r in rows if not r["verdict"]]
    hard_rows = [r for r in rows if r["verdict"] in ("ok", "fix")]
    n_bad = sum(1 for r in rows if r["verdict"] == "bad")
    if pending:
        # Not a warning — the rebuild exists to remove flattery from the metric pool, and an
        # unverdicted row is model output with no human behind it.
        raise SystemExit(
            f"{len(pending)} of {len(rows)} rows have no verdict. Label them, or accept the tail "
            f"explicitly with by=tail-accept after the sampled check (docs/rung3/labeling.md). "
            f"An unverdicted row must never enter the metric pool.")

    ex = exam_mix()
    ex_tot = sum(ex.values())
    old = realval_now()

    # Decode-derived rows leave the pool: in the EXISTING manifest a verdict of `ok` means
    # promote_labels kept the model's own decode as the label. (Queue rows are the opposite —
    # there `ok` means a person checked the picture — which is why the two never share a field.)
    dropped_decode = [r for r in old if r.get("verdict") == "ok"]
    keep = [r for r in old if r.get("verdict") != "ok"]

    by_tier: dict[str, list[dict]] = {"easy": [], "mid": [], "hard": []}
    for r in keep:
        by_tier[tier_of(r)].append(r)

    # Provenance for the new rows. eval_omr.py buckets its per-source table on `source`, and a row
    # without one lands in "synthetic" — which silently reported 110 hand-labelled REAL strips as
    # synthetic on the first build. `makam` travels with it so the pool stays sliceable by makam.
    prov = piece_provenance()

    new_hard = []
    for r in hard_rows:
        label = r["corrected_label"] if r["verdict"] == "fix" else r["label"]
        src, makam = prov.get(r["piece"], ("", ""))
        new_hard.append({
            "image": r["strip"],
            "label": SPACED_32_RE.sub("32", label.strip()),
            "mode": "measure",
            "piece": r["piece"],
            "makam": makam,
            "source": src,
            "page": r["page"],
            "min_logprob": float(r["min_logprob"]) if r["min_logprob"] else None,
            # tier_of() reads these two — they are what makes the row count as HARD.
            "promoted": "review",
            "reason": r["reason"],
            # Provenance, deliberately NOT called `verdict`: these are human-checked labels, and
            # reusing `verdict` would make a later --build read them back as decode-derived.
            "label_source": "tail-accept" if r["by"] == "tail-accept" else "human-verified",
        })
    by_tier["hard"].extend(new_hard)

    # Hold mid fixed (the largest clean tier) and solve the other two against the exam's shares.
    mid_n = len(by_tier["mid"])
    total = mid_n / (ex["mid"] / ex_tot)
    want = {"easy": round(total * ex["easy"] / ex_tot), "mid": mid_n,
            "hard": round(total * ex["hard"] / ex_tot)}

    rng = random.Random(seed)
    out_rows: list[dict] = []
    for tier in ("easy", "mid", "hard"):
        have = by_tier[tier]
        if len(have) > want[tier]:
            # Seeded sample so the pool is reproducible from the manifest + this seed alone.
            have = rng.sample(have, want[tier])
        out_rows.extend(have)

    out_dir = RUNG3 / out_name
    out_dir.mkdir(parents=True, exist_ok=True)
    n_copied = 0
    for r in out_rows:
        src = strip_root / r["page"] / r["image"] if r.get("page") else None
        dst = out_dir / r["image"]
        if src and src.exists():
            dst.write_bytes(src.read_bytes())
            n_copied += 1
        elif (RUNG3 / "_realval" / r["image"]).exists():
            dst.write_bytes((RUNG3 / "_realval" / r["image"]).read_bytes())
            n_copied += 1
        else:
            raise SystemExit(f"{r['image']}: no source crop found under {strip_root} or _realval")

    with (out_dir / "manifest.jsonl").open("w") as f:
        for r in out_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    got = Counter(tier_of(r) for r in out_rows)
    print(f"queue {queue_csv.name}: {len(hard_rows)} usable ({n_bad} bad, "
          f"{sum(1 for r in hard_rows if r['by'] == 'tail-accept')} tail-accepted)")
    print(f"decode-derived rows dropped from the old pool: {len(dropped_decode)}")
    print(f"\n{'tier':>6} {'exam %':>8} {'was':>6} {'now':>6} {'target':>7}")
    print("-" * 38)
    was = Counter(tier_of(r) for r in old)
    for t in ("easy", "mid", "hard"):
        print(f"{t:>6} {100*ex[t]/ex_tot:>7.1f}% {was[t]:>6} {got[t]:>6} {want[t]:>7}")
    print(f"{'total':>6} {'':>8} {len(old):>6} {len(out_rows):>6}")
    print(f"\n{n_copied} crops + manifest -> {out_dir}")
    if got["hard"] < want["hard"]:
        print(f"\n⚠ hard tier is {want['hard'] - got['hard']} SHORT of the exam mix — stage more "
              f"queue rows and re-run, or the rebuilt pool still under-represents the hard tail.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--queue", type=int, metavar="N")
    ap.add_argument("--strip-root", default=DEFAULT_STRIP_ROOT,
                    help="crops the queue images come from — must be the CURRENT slicer's output")
    ap.add_argument("--pools", default=",".join(DEFAULT_POOLS),
                    help="comma-separated emit dirs under data/real/rung3/ to draw drops from")
    ap.add_argument("--queue-version", default=QUEUE_VERSION,
                    help="one queue dir per re-slice; never write a new queue into an old one")
    ap.add_argument("--build", action="store_true",
                    help="assemble the rebuilt pool from the labelled queue")
    ap.add_argument("--out-name", default="_realval_v2",
                    help="directory under data/real/rung3/ to write the rebuilt pool into")
    ap.add_argument("--seed", type=int, default=33,
                    help="seeds the downsampling, so the pool is reproducible from the manifest")
    args = ap.parse_args()
    pools = [p for p in args.pools.split(",") if p]
    if args.report:
        return report(pools)
    if args.queue:
        return build_queue(args.queue, ROOT / args.strip_root, pools, args.queue_version)
    if args.build:
        return build(ROOT / args.strip_root, args.queue_version, args.out_name, args.seed)
    ap.error("pass --report, --queue N or --build")


if __name__ == "__main__":
    raise SystemExit(main())
