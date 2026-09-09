#!/usr/bin/env python3
r"""What the owner's verdicts actually say — attributed to the LABEL or to the MODEL, by kind.

WHY THIS EXISTS. "How many corrections did I make" does not say which SOURCE was wrong. Every
review row carries three texts, and a verdict picks a winner between them:

    label      the SymbTr-derived answer the emitter wrote
    decoded    what a model read off the same crop (the hint / the referee's reading)
    truth      what the owner says the PICTURE says

So each row prices two independent things — `truth` vs `label` is the LABEL's error, `truth` vs
`decoded` is the MODEL's error — and the interesting cell is where one of them is exactly right
while the other is not. That is the question this file answers, split by error KIND.

⛔ **NO MODEL IS RUN AND NO EXAM IS RE-READ.** Everything here is already on disk.

⚠ **THE THREE POPULATIONS ARE SELECTED DIFFERENTLY AND MAY NEVER BE POOLED.** Their selection is
the whole reason their numbers differ:

  accepted-ok    `full_audit` rows the emitter ACCEPTED (nd <= --accept-nd, i.e. the model already
                 agreed with the label on >=90% of it) and the owner then confirmed. Model errors
                 found here are the RESIDUAL inside an already-agreeing population — a floor, never
                 a rate for the model at large.
  accepted-fix   the same accepted rows, where the owner says the label is WRONG. This is the
                 escaped-bad class: a label the `nd` gate let through and a human caught.
  refused        `emit_review` rows the emitter REFUSED (nd too high, or an unalignable row). Hard
                 material by construction, and the only place both sources are routinely wrong.

⚠ **ANCHORING IS REAL AND IS NOT SYMMETRIC.** `review_ui.baseText` seeds the edit box, by default,
with the LABEL's `\sig` block plus the DECODE's note content. So a reader who accepts what is in
front of them lands on the decode for notes and on the label for the signature. Two consequences,
both stated wherever they bite: `truth == decoded` is easier to reach than `truth == label` for note
content, and signature agreement with the label is partly manufactured. The defence is that a
reader is reading the PICTURE — anchoring can explain a small distance, not a large one — so the
distance distributions are printed beside the counts, never the counts alone.

⚠ **TOKEN SPACE, NOT ID SPACE.** Categories are musical, so this reuses `error_taxonomy.relabel`
(which repairs the tokenizer's dropped spaces) and its `classify` / `sig_mask`. ⛔ The resulting
counts are therefore NOT `eval_omr` edit counts and must never be quoted beside them.
⚠ One mistake can raise two categories (a note wrong in both pitch and duration), so category
totals exceed edit totals — `error_taxonomy` makes the same choice for the same reason.

Run:
    .venv-ml/bin/python scripts/rung3/verdict_attribution.py
    .venv-ml/bin/python scripts/rung3/verdict_attribution.py --examples 4
    .venv-ml/bin/python scripts/rung3/verdict_attribution.py --out /tmp/attrib.json
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics as st
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src/vision"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from error_taxonomy import CATEGORIES, classify, relabel, sig_mask  # noqa: E402
from eval_omr import align  # noqa: E402
from merge_redecode_into_queue import drop_ties  # noqa: E402  the ONE tie-removal rule

# Only pools cut by the CURRENT slicer. ⛔ strips_nota / strips_r1 / strips_tup are the retired
# root: their verdicts were given against pixels the shipped slicer no longer produces, so their
# error MIX is a record of a different cut and is reported apart, never merged (METRICS-SLICER-ROOTS.md).
POPULATIONS = [
    ("accepted-ok  (h1, label confirmed)", "data/real/rung3/strips_h1/full_audit.csv", "ok", "label"),
    ("accepted-fix (h1, label corrected)", "data/real/rung3/strips_h1/full_audit.csv", "fix", "corrected"),
    ("refused      (examv3, corrected)", "data/real/rung3/strips_exam_v3/emit_review.csv", "fix", "corrected"),
]
RETIRED_CROP = [
    ("retired-root (nota, corrected)", "data/real/rung3/strips_nota/emit_review.csv", "fix", "corrected"),
    ("retired-root (r1, corrected)", "data/real/rung3/strips_r1/emit_review.csv", "fix", "corrected"),
]


def seed_text(row: dict) -> str:
    r"""What `review_ui.baseText` puts in the edit box by DEFAULT: the LABEL's \sig block followed
    by the DECODE's content. Reproduced here so a row where the owner simply accepted what was on
    screen can be separated from one they actively re-typed — without that split the attribution is
    circular, because a passive accept makes `truth` equal the seed by construction and then
    "the label was wrong about notes, the model about the signature" is the SEEDING talking."""
    lab, dec = row.get("label", ""), drop_ties(row.get("decoded", ""))
    if not lab:
        return dec
    if not dec.strip():
        return lab
    sig = ""
    si, se = lab.find("\\sig"), lab.find("\\sigend")
    if si >= 0 and se > si:
        sig = lab[si:se + 7]
    de = dec.find("\\sigend")
    content = dec[de + 7:] if de >= 0 else dec
    return (sig + " " if sig else "") + content.strip()


def truth_of(row: dict, mode: str) -> str:
    """`ok` asserts the LABEL shown is right (review_ui clears corrected_label on ok);
    `fix` puts the owner's own text in corrected_label."""
    return row["label"] if mode == "label" else row["corrected_label"]


def diff_cats(ref: list[str], hyp: list[str]) -> tuple[int, Counter, list]:
    """ref -> hyp as (edit count, category tally, the ops). ref is the SOURCE being priced."""
    ops = align(ref, hyp)
    mask = sig_mask(ref)
    cats: Counter = Counter()
    n, i = 0, 0
    detail = []
    for op, a, b in ops:
        in_sig = mask[i] if (op in ("match", "sub", "del") and i < len(mask)) else False
        if op in ("match", "sub", "del"):
            i += 1
        if op == "match":
            continue
        n += 1
        for c in classify(op, a, b, in_sig):
            cats[c] += 1
        detail.append((op, a, b))
    return n, cats, detail


def load(path: Path, verdict: str, mode: str) -> list[dict]:
    if not path.exists():
        return []
    out = []
    for r in csv.DictReader(path.open()):
        if r.get("verdict") != verdict:
            continue
        truth = truth_of(r, mode).strip()
        if not truth or not r.get("label", "").strip() or not r.get("decoded", "").strip():
            continue
        # ⛔ `\tie` IS RETIRED (owner, 2026-08-22) and the decode caches predate the retirement,
        # so every `\tie` in `decoded` is a token nothing may emit any more. Left in, it is scored
        # as a MODEL error and lands in `other`: measured 2026-09-09 it was 70% of that column and
        # the single largest "model mistake" in the accepted pool — an artefact of the vocabulary
        # change, not a misreading. review_ui strips it on the same two read paths, for the same
        # reason; this uses that one implementation, never a second copy.
        t = relabel(truth)
        out.append({"strip": r["strip"], "truth": t,
                    "label": relabel(r["label"]), "decoded": relabel(drop_ties(r["decoded"])),
                    "active": t != relabel(seed_text(r)), "raw": r})
    return out


def analyse(rows: list[dict]) -> dict:
    res = {"n": len(rows), "label_edits": [], "model_edits": [],
           "label_cats": Counter(), "model_cats": Counter(), "cell": Counter(),
           "only_label_wrong_cats": Counter(), "only_model_wrong_cats": Counter(),
           "acc_subs": Counter(), "examples": {"only_label_wrong": [], "only_model_wrong": []}}
    for r in rows:
        nl, cl, dl = diff_cats(r["label"], r["truth"])
        nm, cm, dm = diff_cats(r["decoded"], r["truth"])
        res["label_edits"].append(nl)
        res["model_edits"].append(nm)
        res["label_cats"] += cl
        res["model_cats"] += cm
        cell = ("both right" if nl == 0 and nm == 0 else
                "only the LABEL was wrong" if nl > 0 and nm == 0 else
                "only the MODEL was wrong" if nm > 0 and nl == 0 else
                "BOTH were wrong")
        res["cell"][cell] += 1
        if cell == "only the LABEL was wrong":
            res["only_label_wrong_cats"] += cl
            if len(res["examples"]["only_label_wrong"]) < 8:
                res["examples"]["only_label_wrong"].append((r["strip"], dl))
        if cell == "only the MODEL was wrong":
            res["only_model_wrong_cats"] += cm
            if len(res["examples"]["only_model_wrong"]) < 8:
                res["examples"]["only_model_wrong"].append((r["strip"], dm))
        for op, a, b in dm:
            if op == "sub" and (a or "").startswith("\\") and (b or "").startswith("\\"):
                res["acc_subs"][f"{a} -> {b}"] += 1
    return res


def pct(a: int, b: int) -> str:
    return f"{a / b * 100:5.1f}%" if b else "    - "


def report(name: str, res: dict, n_examples: int) -> None:
    n = res["n"]
    print(f"\n{'=' * 92}\n{name}   n = {n}\n{'=' * 92}")
    if not n:
        print("  (no rows)")
        return

    print("\n  WHICH SOURCE WAS WRONG")
    for k in ("both right", "only the LABEL was wrong", "only the MODEL was wrong", "BOTH were wrong"):
        print(f"    {k:28s} {res['cell'][k]:6d}  {pct(res['cell'][k], n)}")

    le, me = res["label_edits"], res["model_edits"]
    print("\n  HOW FAR EACH SOURCE WAS FROM THE OWNER'S ANSWER (label tokens)")
    print(f"    {'':10s} {'median':>7s} {'mean':>7s} {'exact':>7s} {'<=2 edits':>10s}")
    for lbl, v in (("LABEL", le), ("MODEL", me)):
        ex = sum(1 for x in v if x == 0) / len(v) * 100
        le2 = sum(1 for x in v if x <= 2) / len(v) * 100
        print(f"    {lbl:10s} {st.median(v):7.1f} {st.mean(v):7.1f} {ex:6.1f}% {le2:9.1f}%")

    print("\n  WHAT KIND OF THING EACH GOT WRONG  (a row may raise two categories)")
    tl, tm = sum(res["label_cats"].values()), sum(res["model_cats"].values())
    print(f"    {'category':18s} {'LABEL':>8s} {'share':>7s}   {'MODEL':>8s} {'share':>7s}")
    for c in CATEGORIES:
        a, b = res["label_cats"][c], res["model_cats"][c]
        if not (a or b):
            continue
        print(f"    {c:18s} {a:8d} {pct(a, tl)}   {b:8d} {pct(b, tm)}")
    print(f"    {'TOTAL':18s} {tl:8d}           {tm:8d}")

    for cell, key in (("ONLY THE LABEL WAS WRONG (the owner kept the model's reading)", "only_label_wrong_cats"),
                      ("ONLY THE MODEL WAS WRONG (the owner kept the label)", "only_model_wrong_cats")):
        tot = sum(res[key].values())
        if not tot:
            continue
        print(f"\n  {cell} — what differed:")
        for c, v in sorted(res[key].items(), key=lambda kv: -kv[1]):
            print(f"    {c:18s} {v:6d}  {pct(v, tot)}")

    if res["acc_subs"]:
        print("\n  THE MODEL'S TOP SIGN SUBSTITUTIONS (what it wrote -> what the page says)")
        for k, v in res["acc_subs"].most_common(8):
            print(f"    {k:44s} {v:5d}")

    for key, title in (("only_model_wrong", "only the MODEL was wrong"),
                       ("only_label_wrong", "only the LABEL was wrong")):
        ex = res["examples"][key][:n_examples]
        if not ex:
            continue
        print(f"\n  examples — {title}:")
        for strip, ops in ex:
            shown = "; ".join(f"{op} {a or '·'}->{b or '·'}" for op, a, b in ops[:4])
            print(f"    {strip[:56]:56s} {shown}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", type=int, default=3)
    ap.add_argument("--active-only", action="store_true",
                    help="keep only rows the owner ACTIVELY re-typed — truth differs from what "
                         "review_ui put in the edit box. The anchoring control: on a passive row "
                         "`truth` equals the seed by construction, so the attribution restates the "
                         "seeding rather than the reading.")
    ap.add_argument("--retired", action="store_true",
                    help="also report the retired-crop pools (a different cut — never merge them)")
    ap.add_argument("--out", help="write the per-population tallies as JSON")
    args = ap.parse_args()

    out = {}
    pops = POPULATIONS + (RETIRED_CROP if args.retired else [])
    for name, rel, verdict, mode in pops:
        rows = load(ROOT / rel, verdict, mode)
        if args.active_only:
            rows = [r for r in rows if r["active"]]
        res = analyse(rows)
        report(name, res, args.examples)
        out[name] = {"n": res["n"], "cell": dict(res["cell"]),
                     "label_cats": dict(res["label_cats"]), "model_cats": dict(res["model_cats"]),
                     "only_label_wrong_cats": dict(res["only_label_wrong_cats"]),
                     "only_model_wrong_cats": dict(res["only_model_wrong_cats"]),
                     "acc_subs": dict(res["acc_subs"])}
    if args.out:
        Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
