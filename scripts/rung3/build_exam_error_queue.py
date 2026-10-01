r"""Cut a DIAGNOSTIC review queue of the exam strips a model got wrong — gold beside its decode.

WHAT IT IS FOR. The §3c ship call is a human judgement on an error classification
(docs/rung3/round3-criteria.md). `error_taxonomy.py` gives the shape in aggregate; this puts the
individual strips in front of a person, with the CROP, the GOLD and the MODEL'S DECODE on screen at
once, worst-first, so "where is it weak" can be answered by looking rather than by inference.

⛔⛔ **THIS QUEUE CAN NEVER PROMOTE, AND THAT IS DELIBERATE, NOT AN OVERSIGHT.**
`CLAUDE.md`'s standing rule: **never seed exam GOLD from the decode of a model that will be graded on
that exam.** Round 3 is graded on `examv3`. So:

  1. `corrected_label` is written **EMPTY** on every row. The model's decode is shown in the
     `decoded` column, which the UI draws read-only; it is never pre-loaded into the edit box, so a
     stray `ok` cannot store it. (`build_exam_v3_queue.py` puts *carried human gold* in that column;
     this one puts nothing, and the difference is the whole rule.)
  2. The file is `<out>/r3_exam_errors.csv` — **not** `emit_review.csv` and **not** `full_audit.csv`,
     which are the only two names `promote_labels.py` reads. There is therefore no code path from
     this file into any manifest. Renaming it to either of those names would break rule 1's
     protection, so **do not**.

⚠ **A DISAGREEMENT HERE IS NOT AUTOMATICALLY A MODEL ERROR.** Three things can produce one, and the
reader has to decide which: the model misread the picture; the GOLD is wrong (the exam's own labels
were audited, not proven — and `\sig` blocks in particular are unverified, docs/BACKLOG.md item 9);
or the crop is unreadable. The verdicts are re-purposed as a triage, and their meaning here is NOT
their meaning in a labelling queue:

    ok  = the MODEL is right and the GOLD is wrong   -> an exam-gold defect worth its own record
    fix = the MODEL is wrong                          -> a real model error, the normal case
    bad = the CROP is unusable                        -> neither model nor gold is at fault

⚠ So an `ok` here is a claim about the answer key, not a promotion. Acting on one means correcting
the exam by hand, through the `examv3` queue, from the PICTURE — never by copying this decode.

⚠ **The exam is one-shot (§4).** This tool re-uses `error_taxonomy.py`'s decode cache and does not
decode again if it is warm, so building the queue costs no extra read.

⭐ **IT ALSO RUNS ON A NON-EXAM POOL (2026-09-29, owner: "hangi stripleri ölçüyoruz, goldu ve token
çıktısını gösteren bir queue")** — `--out-name` names the file, and `exam` is written 1 only when the
pool's folder name says exam. That is how the Round-4 A/B's taxonomy (`signature` 46 for the control,
docs/METRICS-ROUND4-AB.md) became strips a person can open: the `r4-ctl-errors` / `r4-live-errors`
tabs. The same two guarantees hold — `corrected_label` empty, a file name promote_labels.py never
reads — and ⛔ `--out-name` refuses those two names.

⚠ **THE TEXT IN THE QUEUE IS RE-SPACED, NOT RAW.** Both `label` and `decoded` are written as
`relabel()`'s label tokens joined by one space, so the UI's diff is exactly the diff that was counted.
Raw, the tokenizer's dropped spaces (`\bakiyeSharpc''4`) would light up as a difference that is not
one. No token is changed, only the spaces between them.

⚠ `reason` is `<bucket> | <main category>` — the one category the strip raised most (ties broken in
`CATEGORIES` order) — because the UI's reason filter is an EXACT match. Every category a strip raised
is in `detail`, and the category totals the script prints count ALL of them, like error_taxonomy.py.

Run:
    .venv-ml/bin/python scripts/rung3/build_exam_error_queue.py \
        --checkpoint data/checkpoints/r3-final-stage2-last
    # then: .venv-ml/bin/python scripts/rung3/review_ui.py   -> the `r3-exam-errors` tab

    # Round 4's control on the A/B pool — reproduces the published taxonomy row by row
    .venv-ml/bin/python scripts/rung3/build_exam_error_queue.py \
        --checkpoint data/checkpoints/r4-ctl-stage2-best-edits \
        --pool data/real/rung3/_realval_v2r --out data/real/rung3/_errors \
        --out-name r4_ctl_errors.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "scripts" / "rung3"))
sys.path.insert(0, str(REPO / "src" / "vision"))

from error_taxonomy import (CATEGORIES, PRIORITY, bucket_of, cached_decode, classify,  # noqa: E402
                            relabel, sig_mask)

# The only two names promote_labels.py reads. A diagnostic queue under either could promote.
PROMOTABLE_NAMES = {"emit_review.csv", "full_audit.csv"}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", default="data/checkpoints/r3-final-stage2-last")
    ap.add_argument("--pool", default="data/real/rung3/strips_exam_v3")
    ap.add_argument("--out", default="data/real/rung3/final")
    ap.add_argument("--out-name", default="r3_exam_errors.csv")
    ap.add_argument("--cache-dir", default="data/real/rung3/final/_taxonomy_cache")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device")
    args = ap.parse_args()
    if args.out_name in PROMOTABLE_NAMES:
        raise SystemExit(f"⛔ --out-name {args.out_name}: promote_labels.py reads that name, and this "
                         f"queue must never promote — see the module docstring")
    is_exam = "exam" in Path(args.pool).name

    from eval_omr import align

    dec = cached_decode(args.checkpoint, args.pool, REPO / args.cache_dir, args)

    # Piece / page metadata comes from the pool's own manifest — the queue needs `page` to resolve
    # the crop, and `piece` for the UI's grouping.
    meta = {}
    for line in (REPO / args.pool / "manifest.jsonl").read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            meta[r["image"]] = r

    rows, cats, cats_pri = [], Counter(), Counter()
    for img, (gold, got, n_ids) in sorted(dec.items()):
        ref, hyp = relabel(gold), relabel(got)
        if ref == hyp:
            continue                                   # only the mistakes
        insig = sig_mask(ref)
        vocab: dict[str, int] = {}
        enc = lambda ts: [vocab.setdefault(t, len(vocab)) for t in ts]
        inv = {v: k for k, v in vocab.items()}
        rid, hid = enc(ref), enc(hyp)
        inv = {v: k for k, v in vocab.items()}
        raised, edits, ri = Counter(), 0, 0
        for op, a, c in align(rid, hid):
            if op != "match":
                edits += 1
                here = insig[ri] if ri < len(insig) else False
                for cat in classify(op, inv[a] if a is not None else None,
                                    inv[c] if c is not None else None, here):
                    raised[cat] += 1
            if op in ("match", "sub", "del"):
                ri += 1
        cats.update(raised)
        bucket = bucket_of(n_ids)
        if bucket in PRIORITY:
            cats_pri.update(raised)
        main_cat = max(raised, key=lambda c: (raised[c], -CATEGORIES.index(c)))
        m = meta.get(img, {})
        rows.append({
            "piece": m.get("piece", ""), "page": m.get("page", ""), "strip": img,
            # `reason` is what the UI filters on (an EXACT match), so it is kept to a few values:
            # the length group and the strip's main category. The whole diagnosis is `detail`.
            "reason": f"{'short+mid' if bucket in PRIORITY else 'long'} | {main_cat}",
            "detail": f"{edits} edits · {n_ids} gold ids · "
                      + ", ".join(f"{k}×{v}" for k, v in raised.most_common()),
            "edits": edits,
            "nd": round(edits / max(1, len(ref)), 3), "min_logprob": m.get("min_logprob", ""),
            "exam": int(is_exam),
            # ⚠ re-spaced label tokens, so the UI diff is the counted diff — see the docstring
            "label": " ".join(ref), "decoded": " ".join(hyp),
            "verdict": "", "corrected_label": "", "by": "",   # ⛔ corrected_label stays EMPTY
        })

    rows.sort(key=lambda r: (r["reason"], -r["edits"]))
    out = REPO / args.out / args.out_name
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else
                           ["piece", "page", "strip", "reason", "detail", "edits", "nd",
                            "min_logprob", "exam",
                            "label", "decoded", "verdict", "corrected_label", "by"])
        w.writeheader()
        w.writerows(rows)

    total = len(dec)
    print(f"   {len(rows)} imperfect strips of {total} ({len(rows) / total:.0%}) -> {out}")
    print(f"   {len({r['page'] for r in rows})} pages touched")
    for title, cc in (("SHORT+MID strips only (error_taxonomy.py's headline block)", cats_pri),
                      ("every strip", cats)):
        print(f"\n   categories raised — {title}:")
        tot = sum(cc.values()) or 1
        for k, v in cc.most_common():
            print(f"     {k:<18} {v:>5} {v / tot * 100:>5.1f}%")
    print("\n   worst 10 strips:")
    for r in sorted(rows, key=lambda r: -r["edits"])[:10]:
        print(f"     {r['reason'][:28]:<28} {r['detail'][:50]:<50} {r['strip'][:40]}")
    print("\n⛔ DIAGNOSTIC ONLY — corrected_label is empty on every row and this file is not a name "
          "promote_labels.py reads.\n   ok = the GOLD is wrong · fix = the MODEL is wrong · "
          "bad = the CROP is unusable. See the module docstring.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
