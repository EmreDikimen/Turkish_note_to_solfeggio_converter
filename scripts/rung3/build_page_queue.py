#!/usr/bin/env python3
"""Build the review-UI-2 PAGE queue: the pages worth correcting first.

    npx tsx tools/vision/page-structure.ts          # 1. stitch stats (the meter rule lives in core)
    .venv-ml/bin/python scripts/rung3/build_page_queue.py [--n 150]   # 2. this

Why a page queue at all, and why ranked this way
------------------------------------------------
The strip queue (`reslice-all`, 33,639 pending) is ordered worst-first by the model's own
confidence. Two measurements say that is the wrong basis for THIS queue:

  1. **Confidence is a measured-weak error signal in this project.** W8 (confidence highlighting)
     was DROPPED because it caught **26.3%** of errors at a 10% budget against a pre-registered
     ≥60% bar (docs/mvp/standing.md). Re-measured here on the 3,755 rows of `reslice_all.csv` that
     carry an INDEPENDENT emitted label (the `src=local` rows — the 30,049 colab rows are seeded
     with their own decode and cannot disagree by construction): sorting worst-confidence-first,
     the worst 10% holds **4%** of the disagreements. Lift **0.44x** — worse than random.
  2. **A label/decode disagreement is not a decode error.** ~78% of disagreements were the LABEL
     being wrong, not the decode (docs/METRICS-CORPUS.md). So disagreement cannot be used as the
     target to rank against either.

⚠ Both of those are recorded so nobody re-runs them. What is left is **structural evidence** —
things that are wrong on their face, needing no ground truth to call:

  * **off-meter bars** — a bar whose durations do not sum to the page's derived meter. Something in
    it is wrong (or the piece changes usul, which is the known false positive). Corpus rate 37.8%
    of interior bars, so this is plentiful AND real.
  * **stitch warnings** — unbalanced `\\sig`, unclosed `\\tup3`, a dangling `\\tie`, unknown tokens.
    Each is a decode the language itself rejects.
  * **hit_cap strips** — the decode ran into the token cap, so it is truncated by construction.
  * **split_wide / over_budget strips** — the slicer flagged the crop, and review_ui's own lint
    treats an over-budget strip as unpromotable.

⚠ **This ranking is a heuristic over error EVIDENCE, not a validated predictor of edits/page.**
It could not be validated: the exam pages carry gold and edits/page but are (correctly) absent from
the re-slice pool and carry no logprobs, and the reslice pool's own disagreements measure label
noise. Treat the order as "where the visible damage is", which is what it measures.

⚠ **Exam pieces are refused**, twice: `data/real/rung3/testset.json` page stems are excluded here,
and the re-slice that produced these decodes already excluded them
(`data/colab/decode_pages_reslice_EXAM_EXCLUDED.txt`). Measured at build time: 0 overlap.

Diversity is a SELECTION constraint, not a score term: a per-makam cap stops 150 pages collapsing
onto whatever makam happens to scan badly, because Lever 4's whole argument is that the corpus is
too uniform already.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STRUCTURE = ROOT / "data/real/rung3/_pagequeue/page_structure.json"
RESLICE = ROOT / "data/real/rung3/_reslice_v2/reslice_all.csv"
TESTSET = ROOT / "data/real/rung3/testset.json"
STRIPS_ROOT = ROOT / "data/real/strips_v2"
OUT_DIR = ROOT / "data/real/rung3/_pagequeue"

# Weights. Each unit is "one thing on the page a human would have to look at and probably fix".
# They are deliberately in the same currency so the total reads as a count, not an index.
W_OFF_METER = 1.0  # one bar that does not add up
W_WARNING = 1.0  # one construct the label language rejects
W_HIT_CAP = 2.0  # a truncated strip: certainly wrong, and its whole tail is missing
W_FLAGGED = 0.5  # split_wide / over_budget: the slicer already doubted this crop

# ⚠ THERE IS NO SCAN-QUALITY FILTER IN THIS QUEUE, and that is a known gap, not an oversight.
# The obvious candidate was the `nd` column, which several docs describe as "degradation". It is
# not: `emit_strip_labels.py` defines it as `lev(label_ids, decoded_ids) / len(label_ids)` — the
# normalized edit distance between the SymbTr label and the model's own decode, i.e. a
# label-vs-decode DISAGREEMENT measure. Two things follow: it needs an independent label to exist
# at all (so it is empty for all 33,804 rows of `reslice_all.csv`, measured), and using it as a
# difficulty gate here would gate on "the model already disagrees", which is the thing being
# ranked, not a control for it.
# Consequence, stated rather than hidden: a badly scanned page can reach the queue. The existing
# `bad` verdict is one keystroke and is the intended answer when one does.
MIN_NOTES = 24  # a page with fewer notes is a cover/lyrics page, not music worth a session

# ⚠ The off-meter term is only meaningful when the page HAS a meter. `deriveTimeSignature` takes the
# modal bar length, so on a badly decoded page the mode can be a coin flip and "off-meter" then
# counts the derivation failing rather than the music. Below this support, the off-meter term is
# dropped and the page is ranked on the unambiguous evidence only (warnings, hit_cap, flagged).
# Caught in review: the first build's top pages included derived meters of 2/8 and 3/8, which no
# Turkish usul uses — a symptom of exactly this.
MIN_MODE_SHARE = 0.25


def exam_page_stems() -> set[str]:
    """Page stems belonging to exam pieces. HARD RULE: these never enter a training flow."""
    if not TESTSET.exists():
        return set()
    ts = json.loads(TESTSET.read_text())
    stems: set[str] = set()
    for piece in ts.get("pieces", []):
        for page in piece.get("pages", []):
            stems.add(Path(page).stem)
        if piece.get("stem"):
            stems.add(str(piece["stem"]))
    return stems


def load_structure() -> dict[str, dict]:
    if not STRUCTURE.exists():
        raise SystemExit(
            f"missing {STRUCTURE.relative_to(ROOT)} — run:\n"
            f"  npx tsx tools/vision/page-structure.ts"
        )
    doc = json.loads(STRUCTURE.read_text())
    return {p["stem"]: p for p in doc["pages"]}


def load_strip_features() -> dict[str, dict]:
    """Per-page aggregates from the reslice CSV: makam, source, nd, and existing verdicts."""
    pages: dict[str, dict] = defaultdict(
        lambda: {"nd": [], "makam": Counter(), "src": Counter(), "verdicts": 0, "strips": 0}
    )
    if not RESLICE.exists():
        return {}
    with RESLICE.open() as fh:
        for row in csv.DictReader(fh):
            p = pages[row["page"]]
            p["strips"] += 1
            if row.get("piece"):
                p["makam"][row["piece"]] += 1
            if row.get("src"):
                p["src"][row["src"]] += 1
            if row.get("verdict"):
                p["verdicts"] += 1
            try:
                p["nd"].append(float(row["nd"]))
            except (TypeError, ValueError):
                pass
    return pages


def load_decode_flags() -> dict[str, dict]:
    """hit_cap / split_wide counts, straight from each page's decode manifest."""
    out: dict[str, dict] = {}
    if not STRIPS_ROOT.exists():
        return out
    for page_dir in sorted(STRIPS_ROOT.iterdir()):
        if not page_dir.is_dir():
            continue
        dec = page_dir / f"{page_dir.name}_decode.json"
        if not dec.exists():
            continue
        try:
            strips = json.loads(dec.read_text()).get("strips", [])
        except (json.JSONDecodeError, OSError):
            continue
        out[page_dir.name] = {
            "hit_cap": sum(1 for s in strips if s.get("hit_cap")),
            "flagged": sum(1 for s in strips if s.get("split_wide")),
            "n_ids_max": max((s.get("n_ids") or 0) for s in strips) if strips else 0,
        }
    return out


def score_page(stem: str, st: dict, feats: dict, flags: dict) -> dict | None:
    """One page's impact row, or None when it does not belong in the queue."""
    if st.get("degenerate") or st.get("notes", 0) < MIN_NOTES:
        return None

    mode_share = st.get("modeShare", 0.0)
    meter_ok = bool(st.get("meter")) and mode_share >= MIN_MODE_SHARE
    off = st.get("offMeterBars", 0) if meter_ok else 0
    warn = st.get("warnings", 0)
    hit_cap = flags.get("hit_cap", 0)
    flagged = flags.get("flagged", 0)

    evidence = W_OFF_METER * off + W_WARNING * warn + W_HIT_CAP * hit_cap + W_FLAGGED * flagged

    makam = feats["makam"].most_common(1)[0][0] if feats.get("makam") else "?"
    src = feats["src"].most_common(1)[0][0] if feats.get("src") else "?"
    source = "neyzen" if "_ney_" in stem or stem.endswith("_ney") else "nota"

    return {
        "page": stem,
        "impact": round(evidence, 2),
        "evidence": round(evidence, 2),
        "off_meter": off,
        "interior_bars": st.get("interiorBars", 0),
        "mode_share": round(mode_share, 3),
        "meter_usable": meter_ok,
        "warnings": warn,
        "hit_cap": hit_cap,
        "flagged": flagged,
        "strips": st.get("strips", 0),
        "measures": st.get("measures", 0),
        "notes": st.get("notes", 0),
        "systems": st.get("systems", 0),
        "meter": st.get("meter"),
        "makam": makam,
        "source": source,
        "decoded_on": src,
        "done_strips": feats.get("verdicts", 0),
    }


def select(rows: list[dict], n: int, makam_cap_frac: float) -> list[dict]:
    """Top-n by impact, with a per-makam cap so the set cannot collapse onto one makam."""
    cap = max(2, int(n * makam_cap_frac))
    picked: list[dict] = []
    per_makam: Counter = Counter()
    overflow: list[dict] = []
    for r in sorted(rows, key=lambda r: -r["impact"]):
        if len(picked) >= n:
            break
        if per_makam[r["makam"]] >= cap:
            overflow.append(r)
            continue
        picked.append(r)
        per_makam[r["makam"]] += 1
    # If the caps left the queue short (few makams available), fill from the overflow by impact.
    for r in overflow:
        if len(picked) >= n:
            break
        picked.append(r)
    return picked


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n", type=int, default=150, help="pages to put in the queue (default 150)")
    ap.add_argument("--makam-cap", type=float, default=0.12,
                    help="max share of the queue one makam may take (default 0.12)")
    ap.add_argument("--out", default=str(OUT_DIR / "page_queue.json"))
    args = ap.parse_args()

    structure = load_structure()
    feats = load_strip_features()
    flags = load_decode_flags()
    exam = exam_page_stems()

    rows: list[dict] = []
    skipped_exam = 0
    for stem, st in structure.items():
        if stem in exam:
            skipped_exam += 1
            continue
        row = score_page(stem, st, feats.get(stem, {"nd": [], "makam": Counter(), "src": Counter()}), flags.get(stem, {}))
        if row:
            rows.append(row)

    picked = select(rows, args.n, args.makam_cap)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "generatedBy": "scripts/rung3/build_page_queue.py",
        "weights": {"off_meter": W_OFF_METER, "warning": W_WARNING,
                    "hit_cap": W_HIT_CAP, "flagged": W_FLAGGED},
        "thresholds": {"min_notes": MIN_NOTES, "min_mode_share": MIN_MODE_SHARE},
        "exam_pages_refused": skipped_exam,
        "ranked": len(rows),
        "pages": picked,
    }, indent=1))

    tot_off = sum(r["off_meter"] for r in picked)
    tot_strips = sum(r["strips"] for r in picked)
    print(f"pages ranked        {len(rows)}   (exam pages refused: {skipped_exam})")
    print(f"queue               {len(picked)} pages -> {out.relative_to(ROOT)}")
    print(f"  strips covered    {tot_strips}  ({tot_strips / max(1, len(picked)):.1f}/page)")
    print(f"  off-meter bars    {tot_off}  ({tot_off / max(1, len(picked)):.1f}/page)")
    print(f"  impact  median    {statistics.median([r['impact'] for r in picked]):.1f}"
          f"   min {min(r['impact'] for r in picked):.1f}   max {max(r['impact'] for r in picked):.1f}")
    print(f"  vs corpus median  {statistics.median([r['impact'] for r in rows]):.1f}")
    print("  makams            " + ", ".join(f"{m}:{c}" for m, c in
                                             Counter(r["makam"] for r in picked).most_common(8)))
    print("  sources           " + ", ".join(f"{s}:{c}" for s, c in
                                             Counter(r["source"] for r in picked).most_common()))


if __name__ == "__main__":
    main()
