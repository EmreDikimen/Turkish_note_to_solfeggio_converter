"""Score the photo-exam decode against the frozen clean-exam labels — the photo-domain AEU number.

The frozen gold is a CURATED SUBSET of short labeled measures (median 4 strips/page, ~11 tokens
each), keyed to CLEAN slicing geometry. Photo slicing differs and covers whole pages, so neither
strip-to-strip nor page-concatenation alignment works. Instead, for each gold strip we LOCATE it
inside the photo page's concatenated decode by *fitting alignment* (align the whole short gold
segment to its best-matching substring of the photo stream, free end-gaps), then count accidentals
in that aligned region — exactly eval_omr's per-class match/sub/del/ins accounting.

Reports three things:
  - LOCATED rate  : gold strips found in the photo (content match good enough) = a yield proxy
  - AEU on LOCATED: per-class accidental accuracy over located strips = "accuracy on what it finds"
  - AEU COMBINED  : over ALL gold strips (unlocated = all gold tokens missed) = end-to-end

    .venv-ml/bin/python scripts/rung3/score_photos_exam.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from data import strip_special                # noqa: E402
from eval_omr import AEU, TRACKED             # noqa: E402

CKPT = "data/checkpoints/round1-best"
GOLD = "data/real/rung3/strips_exam_v2_clean/manifest.jsonl"
DECODE_ROOT = Path("data/real/rung3/photos_exam_strips")
LOCATE_MIN_LEN = 3      # gold strips shorter than this locate by chance — excluded from LOCATED
LOCATE_MAX_NDIST = 0.5  # located iff fitting edit-distance / gold-length <= this


def fitting_align(gold: list[int], photo: list[int]):
    """Align the WHOLE gold to its best-matching substring of photo (free start/end gaps on the
    photo side). Returns (edit_distance, ops) with ops as eval_omr's match/sub/del/ins tuples."""
    n, m = len(gold), len(photo)
    cost = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        cost[i][0] = i                          # row 0 stays 0: free to begin anywhere in photo
    for i in range(1, n + 1):
        gi = gold[i - 1]
        row, prow = cost[i], cost[i - 1]
        for j in range(1, m + 1):
            same = gi == photo[j - 1]
            row[j] = min(prow[j - 1] + (0 if same else 1), prow[j] + 1, row[j - 1] + 1)
    jend = min(range(m + 1), key=lambda j: cost[n][j])
    dist = cost[n][jend]
    ops, i, j = [], n, jend
    while i > 0:
        if j > 0 and cost[i][j] == cost[i - 1][j - 1] + (0 if gold[i - 1] == photo[j - 1] else 1):
            ops.append(("match" if gold[i - 1] == photo[j - 1] else "sub", gold[i - 1], photo[j - 1]))
            i, j = i - 1, j - 1
        elif cost[i][j] == cost[i - 1][j] + 1:
            ops.append(("del", gold[i - 1], None)); i -= 1
        else:
            ops.append(("ins", None, photo[j - 1])); j -= 1
    return dist, ops[::-1]


def map_photo_to_gold(photo_stem: str, gold_stems: list[str]) -> str | None:
    mk = re.search(r"_pp(\d+)", photo_stem)
    if not mk:
        return None
    k = int(mk.group(1))
    best = None
    for g in gold_stems:
        mg = re.search(r"_p(\d+)$", g)
        if not mg or int(mg.group(1)) != k:
            continue
        core = g[: mg.start()]
        if core in photo_stem and (best is None or len(core) > len(best[1])):
            best = (g, core)
    return best[0] if best else None


def tally(ops, tracked_ids, gold, hit, fp):
    for op, r, h in ops:
        if op == "match" and r in tracked_ids:
            gold[r] += 1; hit[r] += 1
        elif op == "sub":
            if r in tracked_ids: gold[r] += 1
            if h in tracked_ids: fp[h] += 1
        elif op == "del":
            if r in tracked_ids: gold[r] += 1
        elif op == "ins":
            if h in tracked_ids: fp[h] += 1


def main() -> None:
    from transformers import AutoProcessor
    tok = AutoProcessor.from_pretrained(CKPT).tokenizer
    tracked_ids = {tok.convert_tokens_to_ids(t): t for t in TRACKED}

    gold_rows = [json.loads(l) for l in open(GOLD)]
    by_page: dict[str, list] = {}
    for r in gold_rows:
        by_page.setdefault(r["page"], []).append(r)
    gold_stems = list(by_page)

    # photo page -> concatenated decode id stream (reading order)
    photo_ids: dict[str, list[int]] = {}
    for d in sorted(DECODE_ROOT.glob("*/")):
        dj = d / f"{d.name}_decode.json"
        if not dj.exists():
            continue
        strips = sorted(json.loads(dj.read_text())["strips"], key=lambda s: (s["system"], s["window"]))
        stream = " ".join(s["tokens"] for s in strips)
        photo_ids[d.name] = strip_special(tok(stream, add_special_tokens=True).input_ids, tok)

    # counters: [loc] = located strips only, [all] = combined (unlocated counted as full miss)
    gl, hl, fl = Counter(), Counter(), Counter()
    ga, ha, fa = Counter(), Counter(), Counter()
    n_gold_strips = n_located = n_eligible = 0
    unmatched_pages = []

    for photo_stem, ph in photo_ids.items():
        g = map_photo_to_gold(photo_stem, gold_stems)
        if g is None:
            unmatched_pages.append(photo_stem)
            continue
        for r in by_page[g]:
            gold_seg = strip_special(tok(r["label"], add_special_tokens=True).input_ids, tok)
            if not gold_seg:
                continue
            n_gold_strips += 1
            dist, ops = fitting_align(gold_seg, ph)
            located = len(gold_seg) >= LOCATE_MIN_LEN and dist / len(gold_seg) <= LOCATE_MAX_NDIST
            if len(gold_seg) >= LOCATE_MIN_LEN:
                n_eligible += 1
                n_located += located
            tally(ops, tracked_ids, ga, ha, fa)             # combined: always count the fit
            if located:
                tally(ops, tracked_ids, gl, hl, fl)         # located-only

    # ---- report ------------------------------------------------------------------------------
    def report(title, gold, hit, fp):
        print(f"\n=== {title} ===")
        print(f"{'token':<14}{'gold':>7}{'recall':>9}{'prec':>9}{'f1':>8}")
        recs, f1s = [], []
        for t in TRACKED:
            tid = tok.convert_tokens_to_ids(t)
            gg, hh, ff = gold[tid], hit[tid], fp[tid]
            rec = hh / gg if gg else None
            prec = hh / (hh + ff) if (hh + ff) else None
            f1 = (2 * rec * prec / (rec + prec)) if (rec and prec) else (0.0 if (rec is not None and prec is not None) else None)
            if t in AEU and rec is not None:
                recs.append(rec)
                if f1 is not None: f1s.append(f1)
            if t in AEU or gg:
                rs = f"{rec:.0%}" if rec is not None else "-"
                ps = f"{prec:.0%}" if prec is not None else "-"
                fs = f"{f1:.0%}" if f1 is not None else "-"
                print(f"{t:<14}{gg:>7}{rs:>9}{ps:>9}{fs:>8}")
        head = sum(recs) / len(recs) if recs else float("nan")
        hf1 = sum(f1s) / len(f1s) if f1s else float("nan")
        print(f"  AEU recall {head:.1%} / F1 {hf1:.1%}  (over {len(recs)}/8 classes)")

    print(f"pages matched to gold: {len(photo_ids) - len(unmatched_pages)}/{len(photo_ids)}"
          f"  unmatched: {unmatched_pages}")
    print(f"gold strips: {n_gold_strips}   locatable (>= {LOCATE_MIN_LEN} tok): {n_eligible}   "
          f"LOCATED: {n_located} ({n_located/max(n_eligible,1):.0%})")
    report("AEU on LOCATED strips (accuracy on what the slicer finds)", gl, hl, fl)
    report("AEU COMBINED over all gold strips (end-to-end, unlocated = miss)", ga, ha, fa)


if __name__ == "__main__":
    main()
