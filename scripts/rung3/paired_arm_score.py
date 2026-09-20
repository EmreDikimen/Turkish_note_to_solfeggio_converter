#!/usr/bin/env python3
"""Two checkpoints, one pool, scored PAIRED per strip — the read a trained arm is decided on.

    .venv-ml/bin/python scripts/rung3/paired_arm_score.py \\
        --ctl data/checkpoints/r3-tupnew-stage2-best \\
        --arm data/checkpoints/r3-scan-stage2-last \\
        --pool data/real/rung3/_realval_v2_scan --out data/real/rung3/lever7/scan_last.json

WHY PAIRED, and why this file rather than reading two `eval_omr.py` reports side by side: the pools
an arm is scored on are 47–202 strips, so an unpaired difference of a few points can rest on which
strips happen to be hard. Both models read the SAME strips here, and the statistic is the
per-strip difference — the same instrument `tuplet_ab_score.py` used for the tuplet A/B, generalised
from `\\tup3` occurrences to edits.

⚠ **The alignment is `eval_omr.align`, imported, not re-implemented.** Edits are counted in ID space
exactly as `eval_omr.py` counts them for its EDITS/PAGE block, so a number here and a number there
mean the same thing. (`crop_geometry_probe.py` carries a warning about its own re-alignment reading
differently from eval_omr's; this file avoids that by not having one.)

⚠ **Read the per-STRIP difference as the headline.** These pools are not page-complete — 2.1–5.0
strips a page — so their `edits/page` is edits per *page fragment*. Both are reported; only the
first is the pre-registered statistic. And `share_le5` is never quoted from here at all: that number
is defined on the 46-page exam ([docs/rung3/scan-profile.md](../../docs/rung3/scan-profile.md)).

⚠ **The two tests answer different questions and both are printed.** The exact sign test asks
"does the arm win on more strips than it loses on?" — it is insensitive to a single catastrophic
strip. The bootstrap CI on the mean difference asks "how much total correction does a user save?" —
that one *is* moved by a single bad strip, which is why the median difference is printed beside it.

⛔ **TWO VOCABULARIES NEED `--score-vocab old`, AND THE SCRIPT REFUSES WITHOUT IT** (2026-09-16). An
edit is counted in token ids, and Round 4's scheme H spells a note in fewer ids than the old
vocabulary, so the same misread costs the H arm fewer edits — each checkpoint counted in its OWN ids
tilts the A/B toward H by construction. `--score-vocab old` decodes each checkpoint to text, puts
back one spacing with `data.canonical_label` (H's decode glues notes, and re-encoding the glued text
changed the ids of 51% of real labels), and counts BOTH arms in the old vocabulary's ids — the scale
every Round 1-3 number was measured on. ⚠ `own` stays the default so every recorded number reproduces.
"""
from __future__ import annotations

import argparse
import json
import sys
from math import comb
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src/vision"))


def score_tokenizer(scheme: str):
    """The tokenizer edits are counted in: None = each checkpoint's own, else base + `scheme`."""
    if scheme == "own":
        return None
    from transformers import AutoTokenizer
    from data import vocabulary
    from modeling import MODEL_ID
    tok = AutoTokenizer.from_pretrained(MODEL_ID)
    tok.add_tokens(vocabulary(scheme))
    return tok


def model_name(ckpt: str) -> str:
    """`r4-h-stage2-best-edits`, not `best-edits`: both arms' picks carry the same TAG folder name."""
    p = Path(ckpt)
    tags = {"best", "best-real", "best-edits", "last", "ema-best", "ema-last"}
    return f"{p.parent.name}-{p.name}" if p.name in tags else p.name


def vocab_size(ckpt: str) -> int:
    from transformers import AutoTokenizer
    return len(AutoTokenizer.from_pretrained(ckpt))


def decode_pool(ckpt: str, pool: str, batch_size: int, max_length: int, device: str | None,
                score_tok=None):
    """{image -> (edits, exact, n_gold_tokens)} for one checkpoint, using eval_omr's own pieces.

    `score_tok` None counts in the checkpoint's own ids (every number before 2026-09-16); a
    tokenizer re-encodes the canonical TEXT of gold and decode with it — see the header."""
    import torch
    from data import StripDataset, canonical_label
    from eval_omr import align, strip_special
    from modeling import load_model_and_processor

    dev = device or ("cuda" if torch.cuda.is_available()
                     else "mps" if torch.backends.mps.is_available() else "cpu")
    model, processor, added = load_model_and_processor(ckpt)
    if added:
        raise SystemExit(f"{ckpt} is missing {added} project tokens — that is the base model, "
                         f"not a trained checkpoint")
    tok = processor.tokenizer
    model.to(dev).eval()
    ds = StripDataset(pool)
    out: dict[str, tuple[int, bool, int]] = {}
    with torch.no_grad():
        for at in range(0, len(ds), batch_size):
            batch = [ds[i] for i in range(at, min(at + batch_size, len(ds)))]
            pv = processor(images=[im for im, _ in batch], return_tensors="pt").pixel_values
            gen = model.generate(pv.to(dev), max_length=max_length)
            for k, ((_, label), got) in enumerate(zip(batch, gen.tolist())):
                if got and got[0] == model.config.decoder_start_token_id:
                    got = got[1:]
                hyp = strip_special(got, tok)
                ref = strip_special(tok(label, add_special_tokens=True).input_ids, tok)
                if score_tok is not None:
                    # special ids are already gone, so a generated <unk> survives as text and
                    # still counts as a mismatch
                    text = tok.decode(hyp, skip_special_tokens=False)
                    hyp = strip_special(score_tok(canonical_label(text)).input_ids, score_tok)
                    ref = strip_special(score_tok(canonical_label(label)).input_ids, score_tok)
                edits = sum(1 for op, _, _ in align(ref, hyp) if op != "match")
                out[ds.strips[at + k].image_path.name] = (edits, hyp == ref, len(ref))
    return out, ds


def sign_test_p(wins: int, losses: int) -> float:
    """Exact two-sided binomial p on the DISCORDANT strips only (ties carry no information)."""
    n = wins + losses
    if n == 0:
        return 1.0
    k = min(wins, losses)
    tail = sum(comb(n, i) for i in range(0, k + 1)) / 2 ** n
    return min(1.0, 2 * tail)


def bootstrap_ci(diffs: list[int], iters: int, seed: int) -> tuple[float, float]:
    import numpy as np
    rng = np.random.default_rng(seed)
    a = np.asarray(diffs, dtype=float)
    means = rng.choice(a, size=(iters, len(a)), replace=True).mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ctl", required=True, help="the control checkpoint")
    ap.add_argument("--arm", required=True, help="the arm checkpoint")
    ap.add_argument("--pool", required=True, help="a strips dir with manifest.jsonl")
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--bootstrap", type=int, default=20000)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default=None, help="write the per-strip table as JSON")
    ap.add_argument("--score-vocab", choices=["own", "old"], default="own",
                    help="the ids edits are counted in: `own` = each checkpoint's (every number "
                         "before 2026-09-16), `old` = both arms re-encoded in the old vocabulary. "
                         "⛔ REQUIRED as `old` when the two checkpoints' vocabularies differ "
                         "(Round 4's control vs H) — see the header.")
    args = ap.parse_args()

    sizes = (vocab_size(args.ctl), vocab_size(args.arm))
    if sizes[0] != sizes[1] and args.score_vocab == "own":
        raise SystemExit(f"⛔ the two checkpoints have different vocabularies ({sizes[0]} vs "
                         f"{sizes[1]} tokens), so their edits are not the same size in their own "
                         f"ids. Re-run with --score-vocab old.")
    score_tok = score_tokenizer(args.score_vocab)
    print(f"   edits counted in: {args.score_vocab} ids (vocabularies {sizes[0]} / {sizes[1]})")

    ctl, ds = decode_pool(args.ctl, args.pool, args.batch_size, args.max_length, args.device, score_tok)
    arm, _ = decode_pool(args.arm, args.pool, args.batch_size, args.max_length, args.device, score_tok)
    names = sorted(set(ctl) & set(arm))
    if len(names) != len(ctl) or len(names) != len(arm):
        raise SystemExit("the two decodes cover different strips — same pool?")

    # arm − control, so NEGATIVE is the arm needing fewer corrections (a win for the arm)
    diffs = [arm[n][0] - ctl[n][0] for n in names]
    wins = sum(1 for d in diffs if d < 0)
    losses = sum(1 for d in diffs if d > 0)
    ties = sum(1 for d in diffs if d == 0)
    lo, hi = bootstrap_ci(diffs, args.bootstrap, args.seed)
    ctl_tot, arm_tot = sum(ctl[n][0] for n in names), sum(arm[n][0] for n in names)
    ctl_ex, arm_ex = sum(ctl[n][1] for n in names), sum(arm[n][1] for n in names)
    med = sorted(diffs)[len(diffs) // 2]

    pool_name = Path(args.pool).name
    print(f"\n== {pool_name}: {len(names)} strips, paired")
    print(f"   control  {model_name(args.ctl):28s} {ctl_tot:5d} edits   "
          f"{ctl_tot / len(names):5.2f}/strip   exact {ctl_ex}/{len(names)} = {ctl_ex / len(names):.1%}")
    print(f"   arm      {model_name(args.arm):28s} {arm_tot:5d} edits   "
          f"{arm_tot / len(names):5.2f}/strip   exact {arm_ex}/{len(names)} = {arm_ex / len(names):.1%}")
    print(f"\n   mean difference (arm − control)  {(arm_tot - ctl_tot) / len(names):+.3f} edits/strip"
          f"   95% CI [{lo:+.3f}, {hi:+.3f}]")
    print(f"   median difference                {med:+d}")
    print(f"   arm better on {wins} strips, worse on {losses}, tied on {ties}"
          f"   — exact sign test p = {sign_test_p(wins, losses):.3f}")
    print(f"\n   ⚠ negative = the arm needs FEWER corrections. A CI spanning 0 is a NULL, and a null "
          f"is reported as one.")

    if args.out:
        p = Path(args.out)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({
            "generatedBy": "scripts/rung3/paired_arm_score.py",
            "pool": args.pool, "control": args.ctl, "arm": args.arm, "n": len(names),
            "scoreVocab": args.score_vocab,
            "controlEdits": ctl_tot, "armEdits": arm_tot,
            "controlExact": ctl_ex, "armExact": arm_ex,
            "meanDiffPerStrip": (arm_tot - ctl_tot) / len(names),
            "ci95": [lo, hi], "medianDiff": med,
            "armBetter": wins, "armWorse": losses, "tied": ties,
            "signTestP": sign_test_p(wins, losses),
            "perStrip": {n: {"ctl": ctl[n][0], "arm": arm[n][0], "goldTokens": ctl[n][2]}
                         for n in names},
        }, indent=1))
        print(f"\n   wrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
