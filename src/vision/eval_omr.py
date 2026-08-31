"""
Rung 2 — generation eval: per-class AEU accidental accuracy (THE headline metric) + SER.

WHAT: run a fine-tuned checkpoint over held-out strips (val pieces of data/split.json),
greedy-decode each image, align prediction to ground truth in ID space (Levenshtein), and
report, per tracked token (the 8 AEU accidentals first, then \\natural / \\sig / repeat tokens
/ `|`): recall ("accuracy" = of the gold occurrences, how many the model got in place),
precision (of the predicted occurrences, how many were right), and F1, plus corpus SER
((S+D+I)/ref-len) and the exact-match rate.

Two Step-4.0 metrics report ALONGSIDE the recall headline (docs/rung3/ship-criteria.md):
  - mean per-class AEU **F1** — the headline is recall-only and hides accidental
    hallucination (a spurious koma is a real pitch error); F1 is the honest single number.
  - **arc-triggered false-\\tup3 rate** — of strips whose gold has \\tie but no \\tup3, the
    fraction whose decode emits a \\tup3 (a slur/tie arc misread as a triplet, the damaging
    directional error), reported beside the same rate on neither-token strips.
    ⚠ Since \\tie retired (2026-08-22) only pools labelled BEFORE it can feed this bucket; on
    tie-free gold it prints "n/a" rather than a 0/0 that would read as "no arc errors".
⛔ \\tie is filtered out of BOTH the gold and the decode before scoring, so a checkpoint that
still writes it and one that never will are measured on the same footing.

WHY alignment, not counting: a strip where the model drops one note shifts everything after
it; naive position-wise comparison would count the whole tail wrong. Levenshtein alignment
charges one deletion and still credits the rest — the standard way OMR/ASR per-symbol metrics
are computed. Comparisons are in token-ID space (data.strip_special: string decode is lossy
around added tokens, ids are stable).

Usage:
    .venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/rung2/best
    # smoke: --limit 8 --device cpu; train-side sanity: --side train --limit 200
Results: printed table + a JSON line appended to <checkpoint>/eval.jsonl.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data import ADDED_TOKENS, StripDataset, strip_special
from modeling import load_model_and_processor

AEU = ADDED_TOKENS[:8]
TRACKED = ADDED_TOKENS  # AEU + \natural + \sig(end) + repeat tokens + | + 3


def align(ref: list[int], hyp: list[int]) -> list[tuple[str, int | None, int | None]]:
    """
    Levenshtein alignment; returns ops ("match"|"sub"|"del"|"ins", ref_id|None, hyp_id|None).
    Sequences are <=60 ids (the decoder budget), so the O(n*m) table is trivial.
    """
    n, m = len(ref), len(hyp)
    cost = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        cost[i][0] = i
    for j in range(1, m + 1):
        cost[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            same = ref[i - 1] == hyp[j - 1]
            cost[i][j] = min(cost[i - 1][j - 1] + (0 if same else 1),
                             cost[i - 1][j] + 1, cost[i][j - 1] + 1)
    ops: list[tuple[str, int | None, int | None]] = []
    i, j = n, m
    while i or j:
        if i and j and cost[i][j] == cost[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            ops.append(("match" if ref[i - 1] == hyp[j - 1] else "sub", ref[i - 1], hyp[j - 1]))
            i, j = i - 1, j - 1
        elif i and cost[i][j] == cost[i - 1][j] + 1:
            ops.append(("del", ref[i - 1], None))
            i -= 1
        else:
            ops.append(("ins", None, hyp[j - 1]))
            j -= 1
    return ops[::-1]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True, help="dir saved by train.py (best/last)")
    ap.add_argument("--strips-dir", default="data/synthetic/strips_v2_2")
    ap.add_argument("--split", default="data/split.json",
                    help="'none' evaluates the WHOLE dir (real-page exam dirs are all-eval)")
    ap.add_argument("--side", default="val", choices=["val", "train"])
    ap.add_argument("--limit", type=int, default=None, help="first N strips (smoke tests)")
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--show-errors", type=int, default=5, help="print the first N mismatching strips")
    args = ap.parse_args()

    import torch

    device = args.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    model, processor, added = load_model_and_processor(args.checkpoint)
    tok = processor.tokenizer
    if added:
        # a Rung-2 checkpoint must already contain the extended vocab — freshly-added ids
        # would have UNTRAINED embeddings and every score would be garbage
        print(f"WARNING: {added} project tokens were missing from {args.checkpoint} — is this the base model?")
    model.to(device).eval()

    if args.split == "none":
        ds = StripDataset(args.strips_dir)
        side = "all"
    else:
        split = json.loads(Path(args.split).read_text())
        ds = StripDataset(args.strips_dir, pieces=set(split[f"{args.side}_pieces"]))
        side = args.side
    if args.limit:
        ds.strips = ds.strips[: args.limit]
    print(f"== eval: {len(ds)} {side} strips, checkpoint {args.checkpoint}, device {device}")

    tracked_ids = {tok.convert_tokens_to_ids(t): t for t in TRACKED}
    tup3_id = tok.convert_tokens_to_ids("\\tup3")
    tie_id = tok.convert_tokens_to_ids("\\tie")
    gold = Counter()   # per-token gold occurrences
    hit = Counter()    # aligned exact matches
    fp = Counter()     # predicted where gold has something else / nothing
    # Gold/hits ALSO bucketed by WHERE the token is printed: inside the row-start
    # `\sig … \sigend` block, or inline on a notehead. They are different reading tasks and the
    # microtonal sharps live almost entirely in the first — on the clean exam `\kucukSharp` is 32
    # in-signature against 1 inline (docs/METRICS.md) — so a pooled per-class recall cannot say
    # which one moved. Only recall splits: a false positive has no gold token, hence no position.
    pos_gold, pos_hit = Counter(), Counter()
    sig_ids = {tok.convert_tokens_to_ids(t): t for t in ("\\sig", "\\sigend")}
    # Per-page user effort (real-page manifests only) — the project's product goal.
    page_edits, page_strips, page_clean = Counter(), Counter(), Counter()
    S = D = I = N = 0
    exact = 0
    shown = 0
    # Arc-triggered false-\tup3 metric (pre-registered, docs/rung3/ship-criteria.md): the damaging
    # failure is a printed slur/tie arc read as a triplet. Per STRIP (presence, not count):
    #   arc   = gold has \tie but NO \tup3 → the arc-bearing strips a \tup3 must never fire on
    #   noarc = gold has neither → the clean baseline firing rate
    # numerator each = strips whose decode emits ANY \tup3. The split separates "learned what a
    # triplet looks like" from "stopped firing on arcs specifically".
    arc_denom = arc_num = 0
    noarc_denom = noarc_num = 0
    # Per-source parallel counters (Rung 3: a real-page exam reports neyzen/nota/... separately —
    # the style-overfit check once two engraving sources exist).
    by_src: dict[str, dict] = {}

    def src_stats(src: str) -> dict:
        if src not in by_src:
            by_src[src] = {"gold": Counter(), "hit": Counter(), "fp": Counter(),
                           "S": 0, "D": 0, "I": 0, "N": 0, "exact": 0, "n": 0}
        return by_src[src]

    with torch.no_grad():
        for at in range(0, len(ds), args.batch_size):
            batch = [ds[i] for i in range(at, min(at + args.batch_size, len(ds)))]
            pixel_values = processor(images=[im for im, _ in batch], return_tensors="pt").pixel_values
            out = model.generate(pixel_values.to(device), max_length=args.max_length)
            for k, ((image, label), got_ids) in enumerate(zip(batch, out.tolist())):
                if got_ids and got_ids[0] == model.config.decoder_start_token_id:
                    got_ids = got_ids[1:]
                hyp = strip_special(got_ids, tok)
                ref = strip_special(tok(label, add_special_tokens=True).input_ids, tok)
                # The arc bucket reads the RAW gold, before the \tie filter below — on a legacy
                # pool (strips_exam_v2_clean) that is still how an arc-bearing strip is spotted.
                if tup3_id not in ref:  # only strips the gold says have NO triplet
                    if tie_id in ref:
                        arc_denom += 1
                        arc_num += tup3_id in hyp
                    else:
                        noarc_denom += 1
                        noarc_num += tup3_id in hyp
                # ⛔ \tie IS RETIRED (owner, 2026-08-22) — a tied pair is two plain notes and the
                # arc is label-free ink. Drop it from BOTH sides so it is neither right nor wrong:
                #   - gold pools written before the retirement (exam v2) must not charge a
                #     DELETION to a model that correctly no longer writes it;
                #   - `round2-stage2-best`, which does write it, must not be charged an INSERTION
                #     against tie-free gold — and it is the baseline column the Round-3 floor is
                #     read against, so an unfair baseline would flatter the new model.
                # Both sides filtered = old and new checkpoints stay comparable either way.
                hyp = [i for i in hyp if i != tie_id]
                ref = [i for i in ref if i != tie_id]
                st = src_stats(ds.strips[at + k].source)
                st["n"] += 1
                N += len(ref)
                st["N"] += len(ref)
                exact += hyp == ref
                # PRODUCT goal accounting: how many token edits would a user have to make on this
                # page, and how many of its strips are already perfect. Per page because that is
                # the unit a person uploads and proofreads.
                pg = ds.strips[at + k].page
                if pg:
                    page_edits[pg] += sum(1 for op, _, _ in align(ref, hyp) if op != "match")
                    page_strips[pg] += 1
                    page_clean[pg] += hyp == ref
                st["exact"] += hyp == ref
                if hyp != ref and shown < args.show_errors:
                    shown += 1
                    print(f"   ✗ {ds.strips[at + k].image_path.name}")
                    print(f"     want: {label}")
                    print(f"     got : {tok.decode(got_ids, skip_special_tokens=True).strip()}")
                in_sig = False  # ops run in reference order, so the block state tracks as we go
                for op, r, h in align(ref, hyp):
                    if op != "ins" and r in sig_ids:
                        in_sig = sig_ids[r].endswith("sig")  # \sig opens, \sigend closes
                    bucket = "sig" if in_sig else "inline"
                    if op == "match":
                        if r in tracked_ids:
                            gold[r] += 1
                            hit[r] += 1
                            st["gold"][r] += 1
                            st["hit"][r] += 1
                            pos_gold[(bucket, r)] += 1
                            pos_hit[(bucket, r)] += 1
                    elif op == "sub":
                        S += 1
                        st["S"] += 1
                        if r in tracked_ids:
                            gold[r] += 1
                            st["gold"][r] += 1
                            pos_gold[(bucket, r)] += 1
                        if h in tracked_ids:
                            fp[h] += 1
                            st["fp"][h] += 1
                    elif op == "del":
                        D += 1
                        st["D"] += 1
                        if r in tracked_ids:
                            gold[r] += 1
                            st["gold"][r] += 1
                            pos_gold[(bucket, r)] += 1
                    else:
                        I += 1
                        st["I"] += 1
                        if h in tracked_ids:
                            fp[h] += 1
                            st["fp"][h] += 1
            print(f"   ... {min(at + args.batch_size, len(ds))}/{len(ds)}", end="\r")

    # ---- report ------------------------------------------------------------------------------
    LOW_N = 30  # below this many gold occurrences a per-class number is statistically weak

    print(f"\n\n{'token':<14}{'gold':>7}{'recall':>9}{'precision':>11}{'f1':>8}")
    per_class: dict[str, dict] = {}
    for tid, name in tracked_ids.items():
        g, h, f = gold[tid], hit[tid], fp[tid]
        rec = h / g if g else None
        prec = h / (h + f) if (h + f) else None
        f1 = (2 * prec * rec / (prec + rec) if prec and rec else 0.0) if g else None
        per_class[name] = {"gold": g, "recall": rec, "precision": prec, "f1": f1}
        fmt = lambda v: f"{v:8.1%}" if v is not None else "       —"
        marker = ("  (absent from this eval)" if g == 0
                  else f"  LOW-N ({g} gold)" if name in AEU and g < LOW_N else "")
        print(f"{name:<14}{g:>7}{fmt(rec)} {fmt(prec)}{fmt(per_class[name]['f1'])}{marker}")

    aeu_recalls = [per_class[t]["recall"] for t in AEU if per_class[t]["recall"] is not None]
    aeu_f1s = [per_class[t]["f1"] for t in AEU if per_class[t]["f1"] is not None]
    headline = sum(aeu_recalls) / len(aeu_recalls) if aeu_recalls else float("nan")
    # Mean per-class AEU F1 (Step 4.0: reported ALONGSIDE the recall headline, which is
    # recall-only and hides accidental hallucination — a spurious koma is a real pitch error).
    headline_f1 = sum(aeu_f1s) / len(aeu_f1s) if aeu_f1s else float("nan")

    # ---- low-n-robust companions to the macro headline (added 2026-07-27) ---------------------
    # The two headlines above are per-class MEANS, so every class counts the same no matter how
    # few gold tokens it has. That has now distorted two consecutive exam reads in opposite
    # directions: a 3-gold class dropping out of the mean lifted Round 1 by ~11pp, and a 14-gold
    # class flipping cost Round 2 ~4pp — neither reflecting a change in reading ability. So report
    # beside them:
    #   MICRO  — pool the tokens, not the classes (Σhit/Σgold). One rare class can no longer swing
    #            it; common classes weigh what they actually cost a reader.
    #   MACRO≥N — the same per-class mean restricted to classes with enough gold to mean anything.
    # Neither replaces the macro headline in the historical record: every number logged before this
    # date is macro, and the pre-registered floors were written against it.
    micro_gold = sum(gold[tok.convert_tokens_to_ids(t)] for t in AEU)
    micro_hit = sum(hit[tok.convert_tokens_to_ids(t)] for t in AEU)
    micro_fp = sum(fp[tok.convert_tokens_to_ids(t)] for t in AEU)
    micro_rec = micro_hit / micro_gold if micro_gold else float("nan")
    micro_prec = micro_hit / (micro_hit + micro_fp) if (micro_hit + micro_fp) else float("nan")
    micro_f1 = (2 * micro_rec * micro_prec / (micro_rec + micro_prec)
                if micro_rec and micro_prec else float("nan"))
    strong = [t for t in AEU if per_class[t]["gold"] >= LOW_N]
    macro_n_rec = (sum(per_class[t]["recall"] for t in strong) / len(strong)) if strong else float("nan")
    macro_n_f1 = (sum(per_class[t]["f1"] for t in strong) / len(strong)) if strong else float("nan")
    ser = (S + D + I) / max(1, N)
    weak = [t for t in AEU if 0 < per_class[t]["gold"] < LOW_N]
    print(f"\n== HEADLINE  mean per-class AEU accidental accuracy (recall): {headline:.1%}  (over {len(aeu_recalls)}/8 classes present)")
    print(f"== MEAN F1   mean per-class AEU F1: {headline_f1:.1%}  (over {len(aeu_f1s)}/8 classes present)")
    if weak:
        print(f"   (classes with gold<{LOW_N} are statistically weak: {', '.join(weak)})")
    print(f"== MICRO     token-weighted AEU: recall {micro_rec:.1%} / precision {micro_prec:.1%} / "
          f"F1 {micro_f1:.1%}  (over {micro_gold} gold tokens)")
    pct = lambda v: f"{v:.1%}" if v == v else "—"  # NaN-safe: no class clears the bar on tiny sets
    print(f"== MACRO>={LOW_N}  mean per-class AEU over classes with >={LOW_N} gold: "
          f"recall {pct(macro_n_rec)} / F1 {pct(macro_n_f1)}  "
          f"({len(strong)} classes: {', '.join(strong) or '—'})")
    print(f"== SER {ser:.3f}  (S={S} D={D} I={I} / N={N})   exact-match {exact}/{len(ds)} = {exact/len(ds):.1%}")

    # ---- the PRODUCT goal: corrections a user faces per page (2026-07-27) --------------------
    # Stated per page because a page is what someone uploads and proofreads. The accidental scores
    # above say whether a change helped; THIS says whether the app is worth using.
    # Target: **>=90% of pages need <=5 edits** (ROADMAP.md §0). The share, not the median: the
    # distribution is heavily right-skewed (Round-2 baseline: median 5, mean 12.2), so a median
    # target was already satisfied when it was written. The tail is the product problem.
    if page_edits:
        e = sorted(page_edits.values())
        med = e[len(e) // 2]
        mean = sum(e) / len(e)
        share_le5 = sum(1 for v in e if v <= 5) / len(e)
        clean_strips = sum(page_clean.values()) / max(1, sum(page_strips.values()))
        print(f"\n== EDITS/PAGE  median {med}  mean {mean:.1f}  (over {len(e)} pages, "
              f"{sum(page_strips.values()) / len(e):.1f} strips/page)")
        print(f"   pages needing <=5 corrections: {share_le5:.0%}   "
              f"strips already perfect: {clean_strips:.0%}   TARGET: >=90% of pages <=5")

    # Recall by PRINT POSITION — signature block vs notehead. The pooled per-class recall above
    # mixes two different reading tasks; for the microtonal sharps the gold is nearly all in the
    # signature, so this table is where a sharp fix shows up or fails to.
    if any(pos_gold.values()):
        print(f"\n{'token':<14}{'sig gold':>9}{'sig rec':>9}{'inline gold':>12}{'inline rec':>11}")
        for t in AEU + ["\\natural"]:
            tid = tok.convert_tokens_to_ids(t)
            sg, sh = pos_gold[("sig", tid)], pos_hit[("sig", tid)]
            ig, ih = pos_gold[("inline", tid)], pos_hit[("inline", tid)]
            if not (sg or ig):
                continue
            f = lambda g, h: f"{h / g:.0%}" if g else "—"
            print(f"{t:<14}{sg:>9}{f(sg, sh):>9}{ig:>12}{f(ig, ih):>11}")

    # Arc-triggered false-\tup3 (Step 4.0 floor: arc rate <= 10%; reported beside the neither rate).
    # ⚠ It selects arc-bearing strips by \tie IN THE GOLD, so it only works on pools labelled
    # BEFORE the 2026-08-22 retirement. On tie-free gold the denominator is 0 and the metric says
    # so instead of printing a number — a silent 0/0 would have read as "no arc errors".
    # ⏭ To revive it: the arc is still DRAWN, and a strip's manifest row carries `piece`, `from`
    # and `to`, so the arc-bearing strips can be recovered offline from the score itself
    # (`needsTieSplit` over that measure range) with no re-render. Nothing about that is blocked
    # by this change — it is a script, whenever the metric is wanted.
    if arc_denom == 0:
        # ⚠ Must still BIND arc_rate — the JSON payload below reads it unconditionally, so leaving it
        # unset raised UnboundLocalError *after* the whole report had printed. Every pool labelled
        # since `\tie` retired (2026-08-22) is tie-free, examv3 included, so this is now the NORMAL
        # path and not the rare one: it crashed the exam baseline re-score. nan, not None, to match
        # `noarc_rate` below — the file already uses it to mean "this rate is undefined".
        arc_rate = float("nan")
        print("== ARC-\\tup3  n/a on this pool: gold carries no \\tie (retired 2026-08-22) — see the "
              "note in eval_omr.py for how to rebuild the arc bucket from the manifest")
    else:
        arc_rate = arc_num / arc_denom
        print(f"== ARC-\\tup3  gold-has-\\tie-no-\\tup3: {arc_num}/{arc_denom} = {arc_rate:.1%} decode a false \\tup3")
    noarc_rate = noarc_num / noarc_denom if noarc_denom else float("nan")
    print(f"== no-arc baseline  neither-token: {noarc_num}/{noarc_denom} = {noarc_rate:.1%}")

    # Per-source block (Rung 3): once real strips are in the mix, each engraving source gets
    # its own headline — the style-overfit check, and the honest real-page number.
    per_source: dict[str, dict] = {}
    real_eval = any(src != "synthetic" for src in by_src)
    if len(by_src) > 1 or real_eval:
        print(f"\n{'source':<12}{'n':>6}{'AEU headline':>14}{'SER':>8}{'exact':>8}")
        for src in sorted(by_src):
            st = by_src[src]
            recalls = []
            for t in AEU:
                tid = tok.convert_tokens_to_ids(t)
                if st["gold"][tid]:
                    recalls.append(st["hit"][tid] / st["gold"][tid])
            h = sum(recalls) / len(recalls) if recalls else float("nan")
            s_ser = (st["S"] + st["D"] + st["I"]) / max(1, st["N"])
            print(f"{src:<12}{st['n']:>6}{h:>13.1%} {s_ser:>7.3f} {st['exact'] / max(st['n'], 1):>7.1%}")
            per_source[src] = {"n": st["n"], "headline_aeu": h, "ser": s_ser,
                               "exact": st["exact"] / max(st["n"], 1)}
    if real_eval:
        print("\nNOTE: matched-piece exam = an UPPER BOUND for real-world accuracy; unmatched/"
              "scanned pages are harder (docs/rung3/exam.md).")

    row = {"date": date.today().isoformat(), "checkpoint": str(args.checkpoint), "side": side,
           "strips_dir": str(args.strips_dir),
           "n": len(ds), "headline_aeu": headline, "headline_f1": headline_f1,
           # Low-n-robust companions (2026-07-27). Older lines lack these; recompute them from
           # `per_class` with scripts/rung3/rescore_headline.py.
           "micro_aeu": {"recall": micro_rec, "precision": micro_prec, "f1": micro_f1,
                         "gold": micro_gold},
           "macro_minn": {"min_n": LOW_N, "classes": strong, "recall": macro_n_rec, "f1": macro_n_f1},
           "edits_per_page": ({"median": sorted(page_edits.values())[len(page_edits) // 2],
                               "mean": sum(page_edits.values()) / len(page_edits),
                               "pages": len(page_edits),
                               "share_le5": sum(1 for v in page_edits.values() if v <= 5) / len(page_edits)}
                              if page_edits else None),
           "ser": ser, "exact": exact / len(ds),
           "arc_tup3": {"arc_num": arc_num, "arc_denom": arc_denom, "arc_rate": arc_rate,
                        "noarc_num": noarc_num, "noarc_denom": noarc_denom, "noarc_rate": noarc_rate},
           "per_class": {k: v for k, v in per_class.items()}}
    if per_source:
        row["per_source"] = per_source
    if real_eval:
        row["caveat"] = "matched-upper-bound"
    out_path = Path(args.checkpoint) / "eval.jsonl"
    with out_path.open("a") as f:
        f.write(json.dumps(row) + "\n")
    print(f"[appended] {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
