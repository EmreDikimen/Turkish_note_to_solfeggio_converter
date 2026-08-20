"""
Lever 6's primary read: the staccato-triggered FALSE-DOT rate, paired.

WHAT: decode the two 110-strip pilot pools that differ ONLY by the staccato marks
(`_staccato_falsedot_ctl` / `_staccato_falsedot_stac`, manifests byte-identical) with one
checkpoint, and report the share of strips whose decode contains an augmentation dot the gold
does not have. Both pools' gold carries ZERO dotted durations by construction (that is what
selected them), so the metric is simply "did a dotted duration appear at all".

WHY a script and not eval_omr.py: eval_omr reports AEU/SER/exact, and none of those isolate the
one substitution this lever is about (`d''4 -> d''4.`). The 2026-08-15 baseline of 72.7% / 0.0%
was measured ad hoc and never committed; this makes it re-runnable.

Pairing: greedy decode is deterministic and the two pools share filenames, so a strip is its own
control. `--compare` adds the same read for a second checkpoint and a McNemar test over the
discordant strips.

Usage:
    .venv-ml/bin/python scripts/rung3/staccato_falsedot_score.py \
        --checkpoint data/checkpoints/r3-stac-stage2-best \
        --compare    data/checkpoints/r3-tupnew-stage2-best
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from math import comb
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))

from data import StripDataset, strip_special  # noqa: E402
from modeling import load_model_and_processor  # noqa: E402

CTL = "data/synthetic/_staccato_falsedot_ctl"
STAC = "data/synthetic/_staccato_falsedot_stac"

# A duration token with an augmentation dot: `4.`, `8.`, `16.` at the end of a note token.
DOTTED = re.compile(r"\d+\.")


def dotted_count(text: str) -> int:
    return len(DOTTED.findall(text))


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
                    "gold_dots": dotted_count(label),
                    "hyp_dots": dotted_count(text),
                })
            print(f"   {strips_dir.split('/')[-1]}: {len(rows)}/{len(ds)}", flush=True)
    return rows


def summarise(rows: list[dict]) -> dict:
    n = len(rows)
    false_dot = [r for r in rows if r["hyp_dots"] > r["gold_dots"]]
    return {
        "n": n,
        "exact": sum(r["exact"] for r in rows) / n,
        "ser": sum(r["edits"] for r in rows) / max(1, sum(r["ref_len"] for r in rows)),
        "false_dot_n": len(false_dot),
        "false_dot_rate": len(false_dot) / n,
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
    for name, path in (("ctl", CTL), ("stac", STAC)):
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

    import torch
    device = args.device or ("cuda" if torch.cuda.is_available()
                             else "mps" if torch.backends.mps.is_available() else "cpu")

    results = {ckpt: run(ckpt, args, device) for ckpt in [args.checkpoint, *args.compare]}

    print(f"\n{'checkpoint':44} {'pool':5} {'exact':>7} {'SER':>7} {'false dot':>12}")
    for ckpt, res in results.items():
        for pool in ("ctl", "stac"):
            s = res[pool]
            print(f"{Path(ckpt).name:44} {pool:5} {s['exact']:>6.1%} {s['ser']:>7.4f} "
                  f"{s['false_dot_n']:>4}/{s['n']} = {s['false_dot_rate']:>5.1%}")

    # Paired: the arm against each comparison, on the MARKED pool, strip by strip.
    base = args.checkpoint
    for other in args.compare:
        by_img = {r["image"]: r for r in results[other]["stac"]["rows"]}
        b = c = both = neither = 0
        for r in results[base]["stac"]["rows"]:
            a_bad = r["hyp_dots"] > r["gold_dots"]
            o_bad = by_img[r["image"]]["hyp_dots"] > by_img[r["image"]]["gold_dots"]
            if a_bad and o_bad:
                both += 1
            elif a_bad:
                b += 1
            elif o_bad:
                c += 1
            else:
                neither += 1
        p = mcnemar_exact(b, c)
        print(f"\npaired on the MARKED pool: {Path(base).name} vs {Path(other).name}")
        print(f"   both false {both} | only {Path(base).name} {b} | only {Path(other).name} {c} "
              f"| neither {neither}")
        print(f"   exact McNemar p = {p:.4g}")

    if args.out:
        payload = {"date": date.today().isoformat(),
                   "results": {k: {p: {kk: vv for kk, vv in v[p].items()} for p in ("ctl", "stac")}
                               for k, v in results.items()}}
        Path(args.out).write_text(json.dumps(payload, indent=1))
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
