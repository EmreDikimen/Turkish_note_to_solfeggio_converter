"""Is the BROWSER's reading worse than Python's, or only different? (MVP W3)

Arm-B agreement (docs/mvp/README.md) says the two decoders disagree on ~14% of strips, concentrated
where the model is already unsure. That measures *similarity to another decoder* and cannot say
which one is right. Only gold can, and the release decision rests on it: if the browser reads
meaningfully worse than Python, then friends get worse results than every number in
docs/METRICS.md claims, and no amount of slicer work fixes that.

So: score both sides against the SAME hand-verified labels with the SAME scorer
(`eval_omr.align`, the project's Levenshtein id-space alignment), on the SAME strips.

    npx tsx tools/vision/parity/decode-pool.ts --pool data/real/rung3/_realval_v2 --out b.json
    .venv-ml/bin/python scripts/score_browser_gold.py --browser b.json
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "vision"))
from data import ADDED_TOKENS  # noqa: E402
from eval_omr import align  # noqa: E402

AEU = ADDED_TOKENS[:8]
POOL = Path("data/real/rung3/_realval_v2")
STRIPS_V2 = Path("data/real/strips_v2")


def score(pairs: list[tuple[list[int], list[int]]], id2tok: dict[int, str]) -> dict:
    """SER, exact-match and per-class AEU recall/precision — the project's usual read."""
    S = D = I = N = 0
    exact = 0
    gold_n: Counter[str] = Counter()
    hit: Counter[str] = Counter()
    pred_n: Counter[str] = Counter()
    for ref, hyp in pairs:
        N += len(ref)
        if ref == hyp:
            exact += 1
        for op, r, h in align(ref, hyp):
            if op == "sub":
                S += 1
            elif op == "del":
                D += 1
            elif op == "ins":
                I += 1
            if r is not None:
                t = id2tok.get(r, "")
                if t in AEU:
                    gold_n[t] += 1
                    if op == "match":
                        hit[t] += 1
            if h is not None:
                t = id2tok.get(h, "")
                if t in AEU:
                    pred_n[t] += 1
    recalls = {c: hit[c] / gold_n[c] for c in AEU if gold_n[c]}
    precs = {c: hit[c] / pred_n[c] for c in AEU if pred_n[c]}
    macro_r = sum(recalls.values()) / len(recalls) if recalls else 0.0
    micro_r = sum(hit.values()) / max(1, sum(gold_n.values()))
    return {
        "n": len(pairs),
        "ser": (S + D + I) / max(1, N),
        "exact": exact / max(1, len(pairs)),
        "macro_recall": macro_r,
        "micro_recall": micro_r,
        "per_class": {c: (hit[c], gold_n[c], recalls.get(c)) for c in AEU if gold_n[c]},
        "S": S, "D": D, "I": I, "N": N,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--browser", required=True, help="JSON from decode-pool.ts")
    ap.add_argument("--pool", default=str(POOL))
    ap.add_argument("--checkpoint", default="data/checkpoints/round2-stage2-best")
    args = ap.parse_args()

    pool = Path(args.pool)
    gold_rows = [json.loads(l) for l in (pool / "manifest.jsonl").open()]
    browser = json.loads(Path(args.browser).read_text())

    # The tokenizer that made the training labels — the only correct way into id space. Load it
    # straight from the checkpoint (which already carries the extended vocab) rather than through
    # load_model_and_processor, which would pull 143M params in to read a vocab file.
    from transformers import AutoProcessor

    tok = AutoProcessor.from_pretrained(args.checkpoint).tokenizer
    vocab = tok.get_vocab()
    missing = [t for t in ADDED_TOKENS if t not in vocab]
    if missing:
        raise SystemExit(f"checkpoint tokenizer is missing project tokens: {missing[:5]}")
    id2tok = {i: t for t, i in vocab.items()}

    def ids(text: str) -> list[int]:
        return tok(text).input_ids

    # Python's side comes from the decode caches: same checkpoint, same int8 graphs, already run.
    py_tokens: dict[str, str] = {}
    for r in gold_rows:
        dec = STRIPS_V2 / r["page"] / f"{r['page']}_decode.json"
        if not dec.exists():
            continue
        for s in json.loads(dec.read_text())["strips"]:
            if s["strip"] == r["image"]:
                py_tokens[r["image"]] = s["tokens"]
                break

    both, only_missing = [], 0
    for r in gold_rows:
        name = r["image"]
        if name not in browser or name not in py_tokens:
            only_missing += 1
            continue
        both.append((r, browser[name], py_tokens[name]))

    print(f"gold strips {len(gold_rows)}   scored head-to-head {len(both)}   "
          f"skipped {only_missing} (no Python decode cached)\n")

    ref_pairs_js = [(ids(r["label"]), ids(b["tokens"])) for r, b, _ in both]
    ref_pairs_py = [(ids(r["label"]), ids(p)) for r, _, p in both]

    js = score(ref_pairs_js, id2tok)
    py = score(ref_pairs_py, id2tok)

    print(f"{'metric':<22}{'PYTHON':>10}{'BROWSER':>10}{'Δ':>10}")
    print("-" * 52)
    for key, label, pct in [
        ("ser", "SER (lower better)", False),
        ("exact", "exact-match", True),
        ("macro_recall", "AEU macro recall", True),
        ("micro_recall", "AEU micro recall", True),
    ]:
        p, j = py[key], js[key]
        f = (lambda v: f"{v:.1%}") if pct else (lambda v: f"{v:.4f}")
        d = j - p
        arrow = "" if abs(d) < (0.0005 if not pct else 0.005) else (" ✓" if (d > 0) == pct else " ✗")
        print(f"{label:<22}{f(p):>10}{f(j):>10}{(f'{d:+.1%}' if pct else f'{d:+.4f}'):>10}{arrow}")

    print(f"\n{'AEU class':<18}{'gold':>6}{'PY rec':>9}{'JS rec':>9}{'Δ':>9}")
    print("-" * 51)
    for c in AEU:
        if c not in py["per_class"]:
            continue
        ph, pg, pr = py["per_class"][c]
        jh, _, jr = js["per_class"].get(c, (0, pg, 0.0))
        print(f"{c:<18}{pg:>6}{pr:>9.1%}{(jr or 0):>9.1%}{((jr or 0) - (pr or 0)):>+9.1%}")

    # ---- does min_logprob < -1.0 actually predict errors? (what W8 highlights on) --------------
    # W1 could not test this: all 14 gate strips were confident reads. Here there is real gold, so
    # the threshold can be checked against the thing it claims to predict — user corrections.
    FLAG = -1.0
    flagged = [(r, b) for r, b, _ in both if b["minLogprob"] < FLAG]
    clean = [(r, b) for r, b, _ in both if b["minLogprob"] >= FLAG]

    def bucket(rows):
        if not rows:
            return None
        pairs = [(ids(r["label"]), ids(b["tokens"])) for r, b in rows]
        s = score(pairs, id2tok)
        edits = sum(s["S"] + s["D"] + s["I"] for _ in [0])
        return s, edits

    print(f"\n{'confidence bucket':<26}{'strips':>7}{'exact':>9}{'SER':>9}{'edits/strip':>13}")
    print("-" * 64)
    total_edits = 0
    for label, rows in [(f"flagged (min < {FLAG})", flagged), (f"clean  (min >= {FLAG})", clean)]:
        got = bucket(rows)
        if not got:
            print(f"{label:<26}{0:>7}")
            continue
        s, _ = got
        e = s["S"] + s["D"] + s["I"]
        total_edits += e
        print(f"{label:<26}{s['n']:>7}{s['exact']:>9.1%}{s['ser']:>9.3f}{e / max(1, s['n']):>13.2f}")

    # Threshold sweep: the -1.0 line was validated as a BAD-CROP proxy for the labelling queue, not
    # as an error locator for a user. Those are different jobs, so measure the curve before W8
    # builds highlighting on any particular cut.
    per_strip = []
    for r, b, _ in both:
        s = score([(ids(r["label"]), ids(b["tokens"]))], id2tok)
        per_strip.append((b["minLogprob"], s["S"] + s["D"] + s["I"]))
    all_edits = sum(e for _, e in per_strip) or 1
    per_strip.sort(key=lambda x: x[0])  # least confident first

    print(f"\n{'flag if min <':>14}{'strips':>9}{'% strips':>10}{'% edits':>10}{'lift':>8}")
    print("-" * 51)
    for thr in (-2.0, -1.5, -1.0, -0.7, -0.5, -0.3, -0.2, -0.1):
        sel = [(m, e) for m, e in per_strip if m < thr]
        if not sel:
            continue
        ss = len(sel) / len(per_strip)
        se = sum(e for _, e in sel) / all_edits
        print(f"{thr:>14.1f}{len(sel):>9}{ss:>10.1%}{se:>10.1%}{se / max(1e-9, ss):>8.1f}×")

    # What the pre-registered rule actually asks for: catch >=60% of errors from 10% of the page.
    k = max(1, round(0.10 * len(per_strip)))
    caught10 = sum(e for _, e in per_strip[:k]) / all_edits
    print(
        f"\nPRE-REGISTERED BAR (ROADMAP §0 / STATUS): flag 10% -> catch >=60% of errors.\n"
        f"  best possible at 10% of strips by confidence ranking: {caught10:.1%}"
        f"  -> {'MET' if caught10 >= 0.60 else 'NOT MET'}"
    )
    if caught10 < 0.60:
        print(
            "  per-strip confidence alone cannot carry W8's highlighting. Options: a looser cut as\n"
            "  a soft hint (not a promise), per-TOKEN logprobs, or drop the feature. Decide at W8."
        )

    # The verdict, stated in the terms the release decision actually needs.
    dser = js["ser"] - py["ser"]
    print("\n" + "=" * 52)
    if abs(dser) <= 0.005:
        print(f"VERDICT: the browser is NOT worse — SER differs by {dser:+.4f}, within noise.")
        print("The ~14% arm-B disagreement is two decoders splitting near-ties, not lost quality.")
    elif dser > 0:
        print(f"VERDICT: the browser reads WORSE — SER {dser:+.4f}. Investigate before releasing.")
    else:
        print(f"VERDICT: the browser reads BETTER — SER {dser:+.4f}. Suspicious; check the harness.")
    print("=" * 52)

    Path("data/checkpoints/browser_gold_score.json").write_text(
        json.dumps({"python": py, "browser": js, "n": len(both)}, indent=1)
    )


if __name__ == "__main__":
    main()
