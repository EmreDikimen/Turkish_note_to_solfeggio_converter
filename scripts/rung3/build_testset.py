"""Rung 3, step 2 — freeze the real-page EXAM set (never trained on, honestly stratified).

Picks ~15-25 SymbTr-matched pieces whose pages become the held-out real-image exam
(`eval_omr.py` on their emitted strips = the real-world accuracy number). Selection is
greedy max-min over the 8 AEU accidental classes (the `scripts/select_pieces.py` recipe):
each step takes the piece that most improves the WORST-covered class, so the per-class
headline metric is actually measurable — a makam-only spread can leave a class with 3 gold
occurrences and a meaningless number (review critique B).

Honesty rules (critique C), all recorded in the output:
  - gold counts come from the CARRY-mode labels over the PRINTED form (all detected repeat
    spans folded) — the same convention and shape the exam labels will have;
  - floors only bind for REACHABLE classes (pool > 0). Measured pool reality: the büyük
    classes are 0 on real pages (untransposed), \\kucukSharp lives in ~3 pieces — those are
    reported as unreachable/LOW-N, never silently "covered";
  - pieces overlapping the synthetic training set (data/split.json, by SymbTr stem) are
    excluded — the exam must measure real-image generalization, not melody recall;
  - pieces the emitter reports as pipeline-unusable (count mismatch / nav-jump structure /
    missing pages) are excluded when --emit-report is given: they yield no eval strips.

Deterministic per --seed. The neyzen-only run is PROVISIONAL — rerun over both sources when
notaarsivleri lands, and only then commit the file (the freeze), before any Round-1 training.

Run:
    .venv-ml/bin/python scripts/rung3/build_testset.py \
        --emit-report data/real/rung3/strips_r1/emit_report.json
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from emit_strip_labels import Span, printed_sequence

AEU_CLASSES = ["\\komaSharp", "\\bakiyeSharp", "\\kucukSharp", "\\buyukSharp",
               "\\komaFlat", "\\bakiyeFlat", "\\kucukFlat", "\\buyukFlat"]
AEU_RE = re.compile(r"\\(?:koma|bakiye|kucuk|buyuk)(?:Sharp|Flat)")

UNUSABLE_STATUSES = {"count_mismatch", "missing_pages", "no_rows", "nav_review"}


def piece_counts(labels: dict) -> Counter:
    """AEU token counts over the piece's PRINTED form: carry-mode measure labels, all
    detected repeat spans folded (the duplicate pass isn't on the page)."""
    spans = [Span(r["start"], r["end"], r.get("volta2")) for r in labels.get("repeats", [])]
    printed, _ = printed_sequence(labels["measureCount"], spans, set(range(len(spans))))
    by_index = {m["index"]: m["measure"] for m in labels["measures"]}
    c: Counter = Counter()
    for i in printed:
        c.update(AEU_RE.findall(by_index[i]))
    # the printed signature's accidentals appear on every row start too — count once as context
    return c


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--matched", default="data/real/rung3/matched")
    ap.add_argument("--split", default="data/split.json")
    ap.add_argument("--emit-report", help="emit_report.json — excludes pipeline-unusable pieces")
    ap.add_argument("--out", default="data/real/rung3/testset.json")
    ap.add_argument("--n", type=int, default=20, help="target size (15-25)")
    ap.add_argument("--floor", type=int, default=15, help="per-class gold target")
    ap.add_argument("--seed", type=int, default=33)
    ap.add_argument("--exclude", default="", help="comma-separated stems to exclude (bad matches)")
    args = ap.parse_args()

    synth = set()
    split = json.loads((REPO / args.split).read_text())
    synth = set(split["train_pieces"]) | set(split["val_pieces"])

    unusable: dict[str, str] = {}
    if args.emit_report:
        rep = json.loads(Path(args.emit_report).read_text())
        unusable = {p["piece"]: p["status"] for p in rep["pieces"]
                    if p["status"] in UNUSABLE_STATUSES}

    manual_excl = {s for s in args.exclude.split(",") if s}

    candidates = []
    excluded = {"synthetic_overlap": [], "manual": [], "pipeline_unusable": []}
    for match_p in sorted(Path(args.matched).rglob("match.json")):
        d = match_p.parent
        labels_p = d / "labels.json"
        if not labels_p.exists():
            continue
        match = json.loads(match_p.read_text())
        source = next(k for k, v in match.items() if isinstance(v, dict) and "pages" in v)
        stem = match[source]["stem"]
        symbtr_stem = Path(match["symbtr"]["file"]).stem
        if symbtr_stem in synth:
            excluded["synthetic_overlap"].append(stem)
            continue
        if stem in manual_excl:
            excluded["manual"].append(stem)
            continue
        if stem in unusable:
            excluded["pipeline_unusable"].append(f"{stem} ({unusable[stem]})")
            continue
        labels = json.loads(labels_p.read_text())
        acc = piece_counts(labels)
        candidates.append({
            "stem": stem, "symbtr_file": match["symbtr"]["file"], "source": source,
            "makam": match[source].get("makam", ""), "pages": match[source]["pages"],
            "sig": labels["signature"]["label"],
            "measures": labels["measureCount"],
            "density": round(len(labels["full"]["measure"].split()) / max(labels["measureCount"], 1), 1),
            "acc": dict(acc),
        })

    pool: Counter = Counter()
    for c in candidates:
        pool.update(c["acc"])
    reachable = [cl for cl in AEU_CLASSES if pool[cl] > 0]
    floors = {cl: min(args.floor, max(pool[cl] // 2, 1)) for cl in reachable}
    print(f"candidates: {len(candidates)}  (excluded: "
          f"{len(excluded['synthetic_overlap'])} synthetic-overlap, "
          f"{len(excluded['manual'])} manual, {len(excluded['pipeline_unusable'])} unusable)")
    print(f"pool totals: { {cl: pool[cl] for cl in AEU_CLASSES} }")
    print(f"floors (reachable classes): {floors}")

    rng = random.Random(args.seed)
    picked: list[dict] = []
    totals: Counter = Counter()

    def coverage_key(p):
        after = totals + Counter(p["acc"])
        ratios = sorted(after[cl] / floors[cl] for cl in reachable)
        # maximize the worst floor-coverage ratio, then the second-worst; prefer new makams and
        # new signatures for spread; seeded jitter breaks remaining ties deterministically.
        new_makam = p["makam"] not in {q["makam"] for q in picked}
        new_sig = p["sig"] not in {q["sig"] for q in picked}
        return (ratios[0], ratios[1] if len(ratios) > 1 else ratios[0],
                new_makam, new_sig, rng.random())

    remaining = list(candidates)
    while remaining and len(picked) < args.n:
        best = max(remaining, key=coverage_key)
        picked.append(best)
        totals.update(best["acc"])
        remaining.remove(best)
        if (len(picked) >= 15
                and all(totals[cl] >= floors[cl] for cl in reachable)
                and len(picked) >= args.n):
            break

    floors_met = {cl: totals[cl] >= floors[cl] for cl in reachable}
    out = {
        "generatedBy": "scripts/rung3/build_testset.py",
        "status": "provisional-neyzen-only" if {p["source"] for p in picked} == {"neyzen"}
                  else "multi-source",
        "date": date.today().isoformat(),
        "params": {"n": args.n, "floor": args.floor, "seed": args.seed},
        "pieces": [{k: p[k] for k in ("stem", "symbtr_file", "source", "makam", "pages",
                                      "sig", "measures", "density", "acc")} for p in picked],
        "per_class_gold": {cl: totals[cl] for cl in AEU_CLASSES},
        "floors": floors,
        "floors_met": floors_met,
        "unreachable_classes": [cl for cl in AEU_CLASSES if pool[cl] == 0],
        "low_n_classes": [cl for cl in reachable if totals[cl] < 30],
        "sources": dict(Counter(p["source"] for p in picked)),
        "excluded": excluded,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, indent=1) + "\n")

    print(f"\npicked {len(picked)} pieces -> {args.out}")
    print(f"per-class gold: {out['per_class_gold']}")
    print(f"floors met: {floors_met}")
    print(f"unreachable (gold=0 by pool): {out['unreachable_classes']}")
    print(f"LOW-N (<30 gold): {out['low_n_classes']}")
    print(f"makams: {sorted({p['makam'] for p in picked})}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
