"""
The DOTTED (USUL) BARLINE's primary read: the false-`\repstart` rate, paired.

WHAT: decode the two pilot pools that differ ONLY by the dotted usul barline
(`_usul_falserep_ctl` / `_usul_falserep_usul`, manifests byte-identical) with one checkpoint, and
report the share of strips whose decode contains a `\repstart` the gold does not have. Both pools'
gold carries ZERO `\repstart` by construction (that is what selected them), so the metric is simply
"did a repeat sign appear at all".

WHY IT EXISTS. Turkish editions rule light dashed lines inside a bar to show the usul's beat groups
(aksak 9/8 = 2+2+2+3, so three rules a bar). The renderer had never drawn one — 0 of 40,826 strips —
and `ADDED_TOKENS` has no name for one, so the nearest thing the model knows is a vertical line with
dots beside it: a repeat sign. It duly emits `\repstart`. The owner has been deleting those by hand
while labelling; ~1 in 5 of `batch3`'s corrections is exactly that.

WHY A SEPARATE SCRIPT, and this is the whole point of it: the FINAL render carries THREE flags at
once (`--staccato-noise --concave-tuplet --usul-barline`), so a general movement in the final model
is NOT attributable to any one of them. The staccato arm survives that because it kept its own
paired instrument. This is that instrument for the barline, and it makes TWO of the three
attributable instead of one. ⚠ The concave tuplet mark has none and never claimed one.

⚠ WHAT THIS DOES NOT ESTABLISH — the same limit as the staccato scorer's, and for the same reason.
The rate is measured on OUR OWN rendered dotted barline. It shows the model no longer maps *the
dashed rule this renderer draws* onto `\repstart`. It does NOT show it reads a real printed one,
because no labelled real strip in any pool is annotated for one.

⚠ `USUL_BAR_RATE = 0.35` is CHOSEN, NOT MEASURED (docs/BACKLOG.md item 5) — this scorer prices the
model's response to the mark, not the realism of how often it is drawn. The 7.8% on record is a
statistic about the model's guesses, not about print.

Pairing: greedy decode is deterministic and the two pools share filenames, so a strip is its own
control. `--compare` adds the same read for a second checkpoint and a McNemar test over the
discordant strips. Structure, flags and output shape follow `staccato_falsedot_score.py`
deliberately — read that one too; a difference between them is a bug in one of them.

Build the pools first:
    .venv-ml/bin/python scripts/rung3/make_usul_pools.py --plan

Usage:
    .venv-ml/bin/python scripts/rung3/usul_falserep_score.py \
        --checkpoint data/checkpoints/r3-final-stage2-best \
        --compare    data/checkpoints/round2-stage2-best
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from math import comb
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))

from data import StripDataset, strip_special  # noqa: E402
from modeling import load_model_and_processor  # noqa: E402

CTL = "data/synthetic/_usul_falserep_ctl"
USUL = "data/synthetic/_usul_falserep_usul"

# ⚠ Count `\repstart` ONLY. `\repend` is a different glyph in a different place (the END of a bar,
# thick-thin with the dots on the left) and the dashed rule sits INSIDE the bar, so a false `\repend`
# is a different error with a different cause. It is reported beside the primary, never gated with it.
REPSTART = "\\repstart"
REPEND = "\\repend"


def repstart_count(text: str) -> int:
    return text.count(REPSTART)


def repend_count(text: str) -> int:
    return text.count(REPEND)


def levenshtein(ref: list[int], hyp: list[int]) -> int:
    n, m = len(ref), len(hyp)
    prev = list(range(m + 1))
    for i in range(1, n + 1):
        cur = [i] + [0] * m
        for j in range(1, m + 1):
            cur[j] = min(prev[j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1),
                         prev[j] + 1, cur[j - 1] + 1)
        prev = cur
    return prev[m]


def decode_pool(model, processor, strips_dir: str, batch_size: int, max_length: int, device, limit=None):
    import torch

    tok = processor.tokenizer
    ds = StripDataset(strips_dir)
    if limit:
        ds.strips = ds.strips[:limit]
    rows = []
    with torch.no_grad():
        for at in range(0, len(ds), batch_size):
            batch = [ds[i] for i in range(at, min(at + batch_size, len(ds)))]
            pixel_values = processor(images=[im for im, _ in batch], return_tensors="pt").pixel_values
            out = model.generate(pixel_values.to(device), max_length=max_length)
            for k, ((_, label), got_ids) in enumerate(zip(batch, out.tolist())):
                if got_ids and got_ids[0] == model.config.decoder_start_token_id:
                    got_ids = got_ids[1:]
                hyp = strip_special(got_ids, tok)
                ref = strip_special(tok(label, add_special_tokens=True).input_ids, tok)
                text = tok.decode(got_ids, skip_special_tokens=True)
                rows.append({
                    "image": ds.strips[at + k].image_path.name,
                    "gold": label,
                    "decode": text,
                    "exact": hyp == ref,
                    "edits": levenshtein(ref, hyp),
                    "ref_len": len(ref),
                    "gold_repstart": repstart_count(label),
                    "hyp_repstart": repstart_count(text),
                    "gold_repend": repend_count(label),
                    "hyp_repend": repend_count(text),
                })
            print(f"   {strips_dir.split('/')[-1]}: {len(rows)}/{len(ds)}", flush=True)
    return rows


def summarise(rows: list[dict]) -> dict:
    n = len(rows)
    false_rep = [r for r in rows if r["hyp_repstart"] > r["gold_repstart"]]
    false_end = [r for r in rows if r["hyp_repend"] > r["gold_repend"]]
    return {
        "n": n,
        "exact": sum(r["exact"] for r in rows) / n,
        "ser": sum(r["edits"] for r in rows) / max(1, sum(r["ref_len"] for r in rows)),
        "false_repstart_n": len(false_rep),
        "false_repstart_rate": len(false_rep) / n,
        "false_repend_n": len(false_end),          # reported, never gated — see REPSTART above
        "false_repend_rate": len(false_end) / n,
    }


def mcnemar_exact(b: int, c: int) -> float:
    """Two-sided exact binomial test over the b+c discordant pairs."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(comb(n, i) for i in range(0, k + 1)) / (2 ** n)
    return min(1.0, 2 * tail)


def run(checkpoint: str, args, device) -> dict:
    model, processor, added = load_model_and_processor(checkpoint)
    if added:
        print(f"WARNING: {added} project tokens were missing from {checkpoint}")
    model.to(device).eval()
    print(f"== {checkpoint} on {device}")
    out = {}
    for name, path in (("ctl", CTL), ("usul", USUL)):
        rows = decode_pool(model, processor, path, args.batch_size, args.max_length, device, args.limit)
        out[name] = {"rows": rows, **summarise(rows)}
    del model
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--compare", action="append", default=[],
                    help="a second (or third) checkpoint, scored the same way and paired")
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--limit", type=int, default=None, help="first N strips (smoke)")
    ap.add_argument("--out", default=None, help="write the per-strip rows here as JSON")
    args = ap.parse_args()

    for p in (CTL, USUL):
        if not Path(p, "manifest.jsonl").exists():
            raise SystemExit(
                f"{p}/manifest.jsonl missing — build the paired pools first:\n"
                f"    .venv-ml/bin/python scripts/rung3/make_usul_pools.py --plan")

    import torch
    device = args.device or ("cuda" if torch.cuda.is_available()
                             else "mps" if torch.backends.mps.is_available() else "cpu")

    results = {ckpt: run(ckpt, args, device) for ckpt in [args.checkpoint, *args.compare]}

    print(f"\n{'checkpoint':44} {'pool':5} {'exact':>7} {'SER':>7} {'false repstart':>16} {'(false repend)':>16}")
    for ckpt, res in results.items():
        for pool in ("ctl", "usul"):
            s = res[pool]
            print(f"{Path(ckpt).name:44} {pool:5} {s['exact']:>6.1%} {s['ser']:>7.4f} "
                  f"{s['false_repstart_n']:>4}/{s['n']} = {s['false_repstart_rate']:>5.1%} "
                  f"{s['false_repend_n']:>10}/{s['n']} = {s['false_repend_rate']:>5.1%}")

    # Paired: the arm against each comparison, on the RULED pool, strip by strip.
    base = args.checkpoint
    for other in args.compare:
        by_img = {r["image"]: r for r in results[other]["usul"]["rows"]}
        b = c = both = neither = 0
        for r in results[base]["usul"]["rows"]:
            a_bad = r["hyp_repstart"] > r["gold_repstart"]
            o_bad = by_img[r["image"]]["hyp_repstart"] > by_img[r["image"]]["gold_repstart"]
            if a_bad and o_bad:
                both += 1
            elif a_bad:
                b += 1
            elif o_bad:
                c += 1
            else:
                neither += 1
        p = mcnemar_exact(b, c)
        print(f"\npaired on the RULED pool: {Path(base).name} vs {Path(other).name}")
        print(f"   both false {both} | only {Path(base).name} {b} | only {Path(other).name} {c} "
              f"| neither {neither}")
        print(f"   exact McNemar p = {p:.4g}")

    if args.out:
        payload = {"date": date.today().isoformat(),
                   "results": {k: {p: {kk: vv for kk, vv in v[p].items()} for p in ("ctl", "usul")}
                               for k, v in results.items()}}
        Path(args.out).write_text(json.dumps(payload, indent=1))
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
