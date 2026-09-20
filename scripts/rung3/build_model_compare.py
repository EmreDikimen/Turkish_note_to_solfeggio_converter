#!/usr/bin/env python3
r"""Decode one or more strip pools with SEVERAL checkpoints and write the table `compare_ui.py` reads.

WHY THIS EXISTS (owner, 2026-09-19). `paired_arm_score.py` reports counts — 35 edits against 48 —
and throws the decodes away, so the only way to ask *what* the models disagreed about was to
re-decode by hand. Round 4's dense read turned out to rest on ONE strip of 117
([docs/METRICS-ROUND4-AB.md](../../docs/METRICS-ROUND4-AB.md)), which no count could have shown.
This writes the strip, the gold and every model's text into one file so a person can look.

⚠ **IT SCORES NOTHING NEW.** Edits are counted the way `paired_arm_score.py --score-vocab old`
counts them — `data.canonical_label` then the OLD vocabulary's ids — so a number here and a number
there mean the same thing, and scheme H is not flattered by spelling a note in fewer ids. The same
rule decides AGREEMENT: two models agree when their canonical old-id sequences are equal, so H's
glued decode (`b''32a''32`) does not read as a disagreement with the control's `b''32 a''32`.

⚠ **GOLD IS OPTIONAL.** A pool with no `label` column (a bare page's crops) is still worth looking
at — the models can be compared with each other — but nothing there is an accuracy measurement, and
`compare_ui.py` labels such a pool as having no gold. ⛔ The exam is not a pool for this tool.

    .venv-ml/bin/python scripts/rung3/build_model_compare.py            # the default two pools
    .venv-ml/bin/python scripts/rung3/build_model_compare.py \
        --pool data/real/rung3/_realval_v2r --out data/real/rung3/_compare/models.json

~0.25 s per strip per model on the M4's GPU; the default set is 465 strips x 3 models ~= 6 min.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "src/vision"))

# The three columns. ⚠ `r4-ctl-stage2-last` is the UNBIASED control pick (chosen on nothing), which
# is what the live-vs-Round-4 dense read used; `best-edits` was chosen on 241 of the selection
# pool's strips and reads ~15 edits better there for that reason alone
# ([docs/METRICS-ROUND4-AB.md](../../docs/METRICS-ROUND4-AB.md)). Anyone swapping it must say so in
# the UI, because the edit column would then not be comparable with the published dense numbers.
MODELS = [
    ("live", "the live model — Round 3 Run A", "data/checkpoints/r3a-stage2-best-real"),
    ("ctl", "Round 4 control (old vocabulary)", "data/checkpoints/r4-ctl-stage2-last"),
    ("h", "Round 4 scheme H", "data/checkpoints/r4-h-stage2-best-edits"),
]

DEFAULT_POOLS = [
    "data/real/rung3/_denseval_h1",
    "data/real/strips/meltem1.HaneTamSayfa",
]


def load_rows(pool: Path) -> list[dict]:
    """Every PNG of a pool, with its gold label when the pool has one.

    Two shapes are accepted: a strips pool (`manifest.jsonl`, carries `label`) and a bare page
    directory of `*_sNN_wNN.png` crops (no labels — model-vs-model only)."""
    man = pool / "manifest.jsonl"
    if man.exists():
        rows = [json.loads(l) for l in man.read_text().splitlines() if l.strip()]
        return [{"image": r["image"], "gold": r.get("label", ""), "meta": r} for r in rows]
    pngs = sorted(p.name for p in pool.glob("*_s*_w*.png"))
    pngs += sorted(p.name for p in pool.glob("*_s*_m*.png"))
    if not pngs:
        raise SystemExit(f"⛔ {pool}: no manifest.jsonl and no *_sNN_wNN.png crops")
    return [{"image": n, "gold": "", "meta": {}} for n in sorted(set(pngs))]


def old_ids(tok, text: str) -> list[int]:
    """The canonical OLD-vocabulary id sequence — the one scale every arm is counted on."""
    from data import canonical_label
    from eval_omr import strip_special
    return strip_special(tok(canonical_label(text)).input_ids, tok)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pool", action="append", default=None,
                    help="a strips pool or a page crop dir (repeatable); default: the two above")
    ap.add_argument("--out", default="data/real/rung3/_compare/models.json")
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--limit", type=int, default=0, help="first N strips of each pool (a smoke run)")
    args = ap.parse_args()

    import torch
    from PIL import Image
    from transformers import AutoTokenizer
    from data import canonical_label, vocabulary
    from eval_omr import align, strip_special
    from modeling import MODEL_ID, load_model_and_processor

    pools = [Path(p) for p in (args.pool or DEFAULT_POOLS)]
    dev = args.device or ("cuda" if torch.cuda.is_available()
                          else "mps" if torch.backends.mps.is_available() else "cpu")

    # the scoring tokenizer: base + the OLD vocabulary, never a checkpoint's own
    score_tok = AutoTokenizer.from_pretrained(MODEL_ID)
    score_tok.add_tokens(vocabulary("old"))

    pool_rows: dict[str, list[dict]] = {}
    for pool in pools:
        rows = load_rows(REPO / pool if not pool.is_absolute() else pool)
        pool_rows[str(pool)] = rows[: args.limit] if args.limit else rows
        n_gold = sum(1 for r in pool_rows[str(pool)] if r["gold"])
        print(f"{pool}: {len(pool_rows[str(pool)])} strips, {n_gold} with gold")

    total = sum(len(v) for v in pool_rows.values())
    print(f"\n{total} strips x {len(MODELS)} models on {dev}\n")

    for key, desc, ckpt in MODELS:
        t0 = time.time()
        model, processor, added = load_model_and_processor(str(REPO / ckpt))
        if added:
            raise SystemExit(f"⛔ {ckpt} is missing {added} project tokens — that is the base model")
        tok = processor.tokenizer
        model.to(dev).eval()
        done = 0
        with torch.no_grad():
            for pool, rows in pool_rows.items():
                root = REPO / pool if not Path(pool).is_absolute() else Path(pool)
                for at in range(0, len(rows), args.batch_size):
                    chunk = rows[at: at + args.batch_size]
                    imgs = [Image.open(root / r["image"]).convert("RGB") for r in chunk]
                    pv = processor(images=imgs, return_tensors="pt").pixel_values.to(dev)
                    gen = model.generate(pv, max_length=args.max_length)
                    for r, ids in zip(chunk, gen.tolist()):
                        if ids and ids[0] == model.config.decoder_start_token_id:
                            ids = ids[1:]
                        hyp = strip_special(ids, tok)
                        raw = tok.decode(hyp, skip_special_tokens=False)
                        r.setdefault("out", {})[key] = {
                            "raw": raw.strip(),
                            "text": canonical_label(raw),
                            "nIds": len(hyp),
                        }
                    done += len(chunk)
                    if done % 80 < args.batch_size:
                        print(f"  {key}: {done}/{total}  ({time.time() - t0:.0f}s)")
        print(f"  {key}: {done}/{total} done in {time.time() - t0:.0f}s  [{ckpt}]")
        del model

    # ---- score and cross-compare, all on the OLD-id scale -------------------------------------
    keys = [k for k, _, _ in MODELS]
    out_rows = []
    for pool, rows in pool_rows.items():
        for r in rows:
            ids = {k: old_ids(score_tok, r["out"][k]["text"]) for k in keys}
            gold_ids = old_ids(score_tok, r["gold"]) if r["gold"] else None
            rec = {
                "pool": pool, "image": r["image"], "gold": r["gold"],
                "goldIds": len(gold_ids) if gold_ids is not None else None,
                "piece": r["meta"].get("piece", ""), "page": r["meta"].get("page", ""),
                "nd": r["meta"].get("nd"), "verdict": r["meta"].get("verdict", ""),
                "models": {}, "agree": {}, "nAgree": 0,
            }
            for k in keys:
                m = dict(r["out"][k])
                if gold_ids is not None:
                    m["edits"] = sum(1 for op, _, _ in align(gold_ids, ids[k]) if op != "match")
                    m["exact"] = ids[k] == gold_ids
                rec["models"][k] = m
            # pairwise agreement on the canonical old-id sequence — H's glue is not a disagreement
            for i, a in enumerate(keys):
                for b in keys[i + 1:]:
                    rec["agree"][f"{a}|{b}"] = ids[a] == ids[b]
            rec["allAgree"] = all(rec["agree"].values())
            rec["nAgree"] = sum(1 for v in rec["agree"].values() if v)
            out_rows.append(rec)

    out = REPO / args.out if not Path(args.out).is_absolute() else Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "generatedBy": "scripts/rung3/build_model_compare.py",
        "scoreVocab": "old",
        "models": [{"key": k, "desc": d, "checkpoint": c} for k, d, c in MODELS],
        "pools": [{"path": p, "n": len(v), "gold": sum(1 for r in v if r["gold"])}
                  for p, v in pool_rows.items()],
        "rows": out_rows,
    }, indent=1, ensure_ascii=False))

    scored = [r for r in out_rows if r["goldIds"] is not None]
    print(f"\nwrote {out}  ({len(out_rows)} rows, {len(scored)} with gold)")
    if scored:
        print("\n  edits on the gold rows, OLD ids (the same scale as paired_arm_score --score-vocab old):")
        for k, desc, _ in MODELS:
            e = sum(r["models"][k]["edits"] for r in scored)
            x = sum(1 for r in scored if r["models"][k]["exact"])
            print(f"    {k:5s} {e:5d} edits   exact {x}/{len(scored)} = {x / len(scored):.1%}   {desc}")
    print("\n  how often the models agree with each other:")
    for pair in out_rows[0]["agree"]:
        n = sum(1 for r in out_rows if r["agree"][pair])
        print(f"    {pair:12s} {n}/{len(out_rows)} = {n / len(out_rows):.1%}")
    n3 = sum(1 for r in out_rows if r["allAgree"])
    n0 = sum(1 for r in out_rows if r["nAgree"] == 0)
    print(f"    all three  {n3}/{len(out_rows)} = {n3 / len(out_rows):.1%}"
          f"    all three DIFFER  {n0}/{len(out_rows)} = {n0 / len(out_rows):.1%}")
    print(f"\n  look at it with: .venv-ml/bin/python scripts/rung3/compare_ui.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
