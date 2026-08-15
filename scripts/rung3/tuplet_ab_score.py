r"""Score the tuplet-mark A/B: `\tup3` recall per arm, PAIRED, with an exact McNemar test.

Reads the pre-registered number in docs/rung3/round3-criteria.md and nothing else. Two arms decode
the SAME pool (`_tupletval`, 54 gold groups over 28 strips), each gold `\tup3` occurrence is scored
hit/miss by the same Levenshtein alignment `eval_omr.py` uses, and the two outcome vectors are
compared **paired** — which is the only honest test at this n. An unpaired difference of a few
groups means nothing; what matters is how many groups one arm gets and the other misses.

WHY PAIRED, spelled out: the pool holds 54 groups, so one group is 1.9 pp of recall. Two arms could
differ by 4 pp while disagreeing on a single group. McNemar looks only at the discordant groups
(b = NEW hits where CTL misses, c = the reverse) and asks whether their split is stranger than a coin
— exactly the question "did the shape change buy recall" reduces to. ~6 discordant groups all one way
is the threshold of significance; the criteria file pre-registers that as the resolution limit.

⚠ Precision is a VETO, not a tiebreak (floor ≥70%), and the mean-AEU-F1 guard is read separately on
`_realval_v2` with eval_omr.py. This script does not decide anything — the decision rule is written
in docs/rung3/round3-criteria.md, before the result.

Usage:
    .venv-ml/bin/python scripts/rung3/tuplet_ab_score.py \
        --new data/checkpoints/r3-tupnew-stage2-best \
        --ctl data/checkpoints/r3-tupctl-stage2-best
    # --pool defaults to data/real/rung3/_tupletval; --device cpu is fine at n=28
"""

from __future__ import annotations

import argparse
import json
import sys
from math import comb
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))

TUP = "\\tup3"


def outcomes(checkpoint: str, pool: Path, device: str, max_length: int) -> tuple[list[bool], int]:
    """Per-gold-`\tup3`-occurrence hit/miss over the pool, plus the count of decoded `\tup3` tokens.

    The order is (strip, then occurrence within the strip), and it is stable across arms because it
    comes from the GOLD labels — which is what makes the two vectors pairable.
    """
    import torch
    from data import StripDataset, strip_special
    from eval_omr import align
    from modeling import load_model_and_processor

    model, proc, _ = load_model_and_processor(checkpoint)
    model.to(device).eval()
    tok = proc.tokenizer
    tup_id = tok.convert_tokens_to_ids(TUP)

    ds = StripDataset(str(pool))
    hits: list[bool] = []
    predicted = 0
    with torch.no_grad():
        for i in range(len(ds)):
            image, label = ds[i]
            px = proc(images=[image], return_tensors="pt").pixel_values
            got = model.generate(px.to(device), max_length=max_length)[0].tolist()
            if got and got[0] == model.config.decoder_start_token_id:
                got = got[1:]
            hyp = strip_special(got, tok)
            ref = strip_special(tok(label, add_special_tokens=True).input_ids, tok)
            predicted += sum(1 for t in hyp if t == tup_id)
            for op, r, _h in align(ref, hyp):
                if r == tup_id and op != "ins":
                    hits.append(op == "match")
            print(f"   {i + 1}/{len(ds)}", end="\r", flush=True)
    return hits, predicted


def mcnemar_exact(b: int, c: int) -> float:
    """Two-sided exact McNemar (binomial on the discordant pairs). b+c==0 -> p = 1.0."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(comb(n, i) for i in range(0, k + 1)) / (2 ** n)
    return min(1.0, 2 * tail)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--new", required=True, help="checkpoint trained on strips_v5_tupnew")
    ap.add_argument("--ctl", required=True, help="checkpoint trained on strips_v5_tupctl")
    ap.add_argument("--pool", default="data/real/rung3/_tupletval")
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--out", default="", help="write the paired outcomes to this JSON")
    args = ap.parse_args()

    pool = ROOT / args.pool
    if not (pool / "manifest.jsonl").exists():
        raise SystemExit(f"{pool}/manifest.jsonl missing — build it with build_tuplet_val.py --build")

    arms = {}
    for name, ck in (("NEW", args.new), ("CTL", args.ctl)):
        print(f"== decoding {name}: {ck}")
        arms[name] = outcomes(ck, pool, args.device, args.max_length)

    (hn, pn), (hc, pc) = arms["NEW"], arms["CTL"]
    if len(hn) != len(hc):
        raise SystemExit(f"gold group counts differ ({len(hn)} vs {len(hc)}) — the arms did not read "
                         f"the same pool; refusing to compare")
    n = len(hn)
    b = sum(1 for x, y in zip(hn, hc) if x and not y)   # NEW hits, CTL misses
    c = sum(1 for x, y in zip(hn, hc) if y and not x)   # CTL hits, NEW misses
    p = mcnemar_exact(b, c)

    def rec(h: list[bool]) -> float:
        return 100 * sum(h) / max(len(h), 1)

    def prec(h: list[bool], predicted: int) -> float:
        return 100 * sum(h) / predicted if predicted else float("nan")

    print(f"\n{'arm':>6}{'gold':>7}{'hit':>6}{'recall':>9}{'predicted':>11}{'precision':>11}")
    print(f"{'NEW':>6}{n:>7}{sum(hn):>6}{rec(hn):>8.1f}%{pn:>11}{prec(hn, pn):>10.1f}%")
    print(f"{'CTL':>6}{n:>7}{sum(hc):>6}{rec(hc):>8.1f}%{pc:>11}{prec(hc, pc):>10.1f}%")
    print(f"\nΔ recall (NEW − CTL): {rec(hn) - rec(hc):+.1f} pp   "
          f"[one group = {100 / max(n, 1):.1f} pp]")
    print(f"paired: {b} groups NEW-only, {c} groups CTL-only, "
          f"{sum(1 for x, y in zip(hn, hc) if x and y)} both, "
          f"{sum(1 for x, y in zip(hn, hc) if not x and not y)} neither")
    print(f"exact McNemar p = {p:.3f}  ->  {'DIFFERENT' if p < 0.05 else 'NULL (not resolvable at this n)'}")
    print("\n⚠ Precision is a veto at 70%, not a tiebreak. The decision rule is in "
          "docs/rung3/round3-criteria.md — read it before reading this table again.")

    if args.out:
        Path(args.out).write_text(json.dumps({
            "pool": str(pool), "n_groups": n,
            "new": {"checkpoint": args.new, "hits": hn, "recall": rec(hn), "predicted": pn},
            "ctl": {"checkpoint": args.ctl, "hits": hc, "recall": rec(hc), "predicted": pc},
            "mcnemar": {"b_new_only": b, "c_ctl_only": c, "p": p},
        }, indent=2) + "\n")
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
