r"""Find AUTO-ACCEPTED b8 strips that may have lost a navigation sign (owner, 2026-09-01).

THE HOLE THIS LOOKS FOR. `auto_accept_agree.py` drafts `ok` on a row when the label and the model's
decode agree token-for-token. That is sound where the model is strong — the 201-row audit found 41
such rows and a human read all 41 as `ok`. ⛔ **But agreement is circular exactly where the model is
BLIND.** On the exam, `\segno` recall is **43.5%** and `\coda` **42.9%**, both at ~100% precision:
the model does not invent them, it simply does not see them. So when the derived label ALSO lacks
the sign, label and decode agree on an absence, and the row is auto-accepted with a navigation sign
missing — with nothing anywhere to say so.

⭐ **THE EVIDENCE IS THE OLD POOLS.** The same music was labelled once before, by hand, in
`strips_nota` / `strips_r1` / `strips_tup`. Where an old label carries a navigation token that the b8
label does not, that is a concrete reason to re-read the crop.

⛔⛔ **MACHINE-ACCEPTED ROWS ONLY. A ROW THE OWNER READ IS NEVER TOUCHED** (owner: *"Do not change
any in the strips I fixed"*). The filter is `verdict == ok AND by == agree` in `full_audit.csv`;
any row with an empty `by` is a human read and is skipped, as is any `fix` or `bad`.

⚠ **THIS WRITES A SUGGESTION, NOT A LABEL, AND NOT A VERDICT.** Two reasons, both measured:
  1. **A span match is the same BARS, never the same PIXELS** — 0 of 1,215 crops are byte-identical
     and 77.7% changed size ([../../docs/METRICS-CORPUS.md](../../docs/METRICS-CORPUS.md)). A
     `\segno` inside the OLD crop can fall OUTSIDE the new one, so inserting it unread would add a
     sign that is not in the picture.
  2. Nothing here knows WHERE in the new label the token belongs. That is a judgement from the crop.
So the old label travels in the `decoded` column — drawn read-only, beside the current label — and
`corrected_label` is left EMPTY. The reviewer looks at the crop and types.

⚠ **The queue does not promote.** Its file is `nav_suggest.csv` in its own directory, and
`promote_labels.py` reads only `emit_review.csv` / `full_audit.csv` in the pool dir. To act on a row,
correct it in the **`b8-full`** queue, which is the one that owns those labels.

⚠ `reason` carries the missing token, so the review UI's existing per-reason dropdown filters
`\segno` from `\coda` from `\volta1` with no new UI code.

Run:
    .venv-ml/bin/python scripts/rung3/build_nav_suggest_queue.py --dry-run
    .venv-ml/bin/python scripts/rung3/build_nav_suggest_queue.py
"""
from __future__ import annotations

import argparse
import collections
import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "scripts" / "rung3"))

from carry_old_fixes import NEW_ROOT, OLD_POOLS, OLD_ROOT, page_index  # noqa: E402

# The jump/section signs. ⚠ `\repstart` / `\repend` are deliberately a SEPARATE class: they are
# drawn barlines rather than jump instructions, the model reads them far better (89-95% recall vs
# 43%), and mixing them would bury the signal this queue exists for. They are still reported, tagged
# distinctly, so the dropdown can separate them.
NAV = ["\\segno", "\\coda", "\\dc", "\\fine", "\\volta1", "\\volta2"]
REP = ["\\repstart", "\\repend"]
B8 = "data/real/rung3/strips_b8"


def old_labels(repo: Path) -> dict[str, tuple[str, str]]:
    """strip filename -> (label, pool) for every ACCEPTED strip in the retired pools."""
    out: dict[str, tuple[str, str]] = {}
    for pool in OLD_POOLS:
        mf = repo / "data/real/rung3" / pool / "manifest.jsonl"
        if not mf.exists():
            continue
        for line in mf.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out.setdefault(r["image"], (r["label"], pool))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="data/real/rung3/_navsuggest")
    ap.add_argument("--include-repeats", action="store_true",
                    help="also flag missing \\repstart/\\repend (off: the model reads those well)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    tokens = NAV + (REP if args.include_repeats else [])
    old_idx, new_idx = page_index(REPO / OLD_ROOT), page_index(REPO / NEW_ROOT)

    # old-side lookup by span, so a b8 strip can find the old strip holding the SAME BARS.
    oldkey: dict[tuple, list[str]] = collections.defaultdict(list)
    for pg, d in old_idx.items():
        for s, k in d["by"].items():
            oldkey[(pg,) + k].append(s)
    newspan = {s: (pg,) + k for pg, d in new_idx.items() for s, k in d["by"].items()}
    # ⚠ A page whose two slicers disagree on staff-row count cannot be span-matched at all: the
    # `system` index is ROW-LOCAL, so it means a different row on each side (carry_old_fixes.py).
    same_rows = {p for p in (set(old_idx) & set(new_idx))
                 if old_idx[p]["rows"] == new_idx[p]["rows"]}

    oldlab = old_labels(REPO)
    b8 = REPO / B8
    man = {json.loads(l)["image"]: json.loads(l)
           for l in (b8 / "manifest.jsonl").read_text().splitlines() if l.strip()}

    rows, counts = [], collections.Counter()
    with (b8 / "full_audit.csv").open(newline="") as f:
        for r in csv.DictReader(f):
            strip = r["strip"]
            verdict, by = (r.get("verdict") or "").strip(), (r.get("by") or "").strip()
            if verdict != "ok" or by != "agree":
                counts["skipped_not_machine_ok"] += 1     # ⛔ every human read lands here
                continue
            counts["machine_ok"] += 1
            m = man.get(strip)
            if m is None:
                counts["not_in_manifest"] += 1
                continue
            span = newspan.get(strip)
            if span is None or span[0] not in same_rows:
                counts["no_span" if span is None else "row_count_disagrees"] += 1
                continue
            cands = [s for s in oldkey.get(span, []) if s in oldlab]
            if not cands:
                counts["no_old_strip_same_bars"] += 1
                continue
            counts["span_matched"] += 1
            cur = set(m["label"].split())
            for cand in cands:
                lab, pool = oldlab[cand]
                miss = [t for t in tokens if t in lab.split() and t not in cur]
                if not miss:
                    continue
                counts["FLAGGED"] += 1
                for t in miss:
                    counts[f"missing {t}"] += 1
                rows.append({
                    "piece": m.get("piece", ""), "page": m.get("page", ""), "strip": strip,
                    "reason": " ".join(miss),          # ⭐ the UI's per-reason dropdown reads this
                    "nd": m.get("nd", ""), "min_logprob": m.get("min_logprob", ""),
                    "label": m["label"],
                    "decoded": lab,                    # the OLD hand-read label — the evidence
                    "old_strip": cand, "old_pool": pool,
                    "verdict": "", "corrected_label": "", "by": "",   # ⛔ stays EMPTY
                })
                break

    print(json.dumps({"flagged": len(rows), "counts": dict(counts)}, indent=1))
    if not args.dry_run and rows:
        out = REPO / args.out
        out.mkdir(parents=True, exist_ok=True)
        p = out / "nav_suggest.csv"
        with p.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        print(f"\n   wrote {p} ({len(rows)} rows)")
        print("   review_ui.py -> the `b8-nav` tab; the per-reason dropdown separates the tokens.")
    elif args.dry_run:
        print("\nDRY-RUN: nothing written")
    print("\n⛔ SUGGESTIONS ONLY. corrected_label is empty, no verdict is written, and rows the owner "
          "read by hand were never considered.\n   Act on one in the `b8-full` queue, from the CROP.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
