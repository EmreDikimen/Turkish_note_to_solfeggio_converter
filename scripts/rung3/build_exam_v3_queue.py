#!/usr/bin/env python3
"""Cut the EXAM v3 labelling queue — the 21 exam pages we already own but do not grade.

    # 1. re-slice + emit those pieces with TODAY'S slicer, into their OWN crop root
    OMR_ORT_THREADS=2 nice -19 .venv-ml/bin/python scripts/rung3/emit_strip_labels.py --exam \
      --testset data/real/rung3/testset.json \
      --checkpoint data/checkpoints/rung3-labeler --onnx-dir data/checkpoints/rung3-labeler-onnx \
      --strips-root data/real/strips_examv3 --out data/real/rung3/strips_exam_v3_emit \
      --pieces <what this script's --plan prints>
    # 2. merge into one queue      3. label it              4. promote into the exam
    .venv-ml/bin/python scripts/rung3/build_exam_v3_queue.py
    .venv-ml/bin/python scripts/rung3/review_ui.py                 # the `examv3` tab
    .venv-ml/bin/python scripts/rung3/promote_labels.py --dir data/real/rung3/strips_exam_v3 \
        --exam --strips-root data/real/strips_examv3
                                   #  ^^^^^^^^^^^^ NOT the default root, or it links old crops

What the queue is
-----------------
`testset.json` holds 45 pieces whose 67 page images are all on disk, and the frozen exam grades
**46** of those pages (`strips_exam_v2_clean/manifest.jsonl`). The other 21 pages belong to pieces
that are ALREADY exam-only, so labelling them costs the model no training data
(docs/rung3/exam.md, docs/METRICS-EXAM.md).

The target pages are DERIVED here (testset pages minus graded pages), never listed by hand, so the
queue cannot drift from the exam it grows.

Why a SEPARATE crop root (`data/real/strips_examv3`)
----------------------------------------------------
The exam's crops under `data/real/strips` are 2026-07-15..17 slicer output; `page_to_strips.py` was
overhauled on 2026-07-25/29 and **no exam page was ever re-sliced** (0 of 67 exist under
`data/real/strips_v2`). DECISIONS.md 2026-07-28 says so and warns: *"exam v3 needs the same
treatment; until then the one-shot instrument measures a retired slicer."*

So this queue is cut from a FRESH slice with today's settings. It writes to its own root because the
emitter slices in place, and the crops under `data/real/strips` are hardlinked into
`strips_exam_v2_clean/` — re-slicing there would silently change the pixels the FROZEN exam's gold
describes. Separate root = the frozen exam cannot be touched, whatever this run does.

⚠ The first cut of this queue (2026-08-20, superseded the same day) reproduced the OLD geometry on
purpose, to match the 46 graded pages. That was wrong: it handed the owner 265 px slivers that cut
beamed groups in half. Same pages, new slicer: median crop width 640 → 1031 px, crops under 400 px
24% → 4%, and 297 human rows → 214. Kept here so the trade is not re-made by accident.

⚠ Consequence, and it is NOT this script's to decide: the 46 graded pages are still old-slicer
output, so the exam mixes two slicers. Re-cutting them costs **315 of the 326 gold labels**
(measured: `check_crop_staleness.py --root data/real/strips` over the graded pages — 45 of 46 would
lose them), 295 of which were made by hand. That decision lives in docs/rung3/exam.md.

⚠ TRAINING MUST NEVER TAKE THESE ROWS. Every row carries `exam=1`; `promote_labels.py` refuses to
promote an exam row into a training manifest unless `--exam` names the exam dir explicitly.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

TESTSET = "data/real/rung3/testset.json"
CLEAN = "data/real/rung3/strips_exam_v2_clean/manifest.jsonl"
STRIPS = "data/real/strips_examv3"          # this queue's crop root — see the docstring
EMIT = "data/real/rung3/strips_exam_v3_emit"
OUT = "data/real/rung3/strips_exam_v3"

REVIEW_FIELDS = ["piece", "page", "strip", "reason", "nd", "min_logprob", "exam",
                 "label", "decoded", "verdict", "corrected_label", "by"]


def target_pages(root: Path) -> tuple[dict[str, str], set[str]]:
    """(page stem -> owning piece stem) for every testset page, and the subset that the frozen
    exam does NOT grade — the pages this queue exists for."""
    ts = json.loads((root / TESTSET).read_text())
    owner = {}
    for piece in ts["pieces"]:
        for page in piece["pages"]:
            owner[Path(page).stem] = piece["stem"]
    graded = {json.loads(line)["page"] for line in (root / CLEAN).open()}
    return owner, set(owner) - graded


def pieces_to_emit(owner: dict[str, str], targets: set[str]) -> list[str]:
    """Every piece owning at least one ungraded page. The emitter needs the WHOLE piece — it aligns
    a piece's pages together — so its already-graded pages are re-sliced too, into this queue's own
    root, where they harm nothing."""
    pages_of: dict[str, list[str]] = defaultdict(list)
    for page, piece in owner.items():
        pages_of[piece].append(page)
    return sorted(p for p, pages in pages_of.items() if any(x in targets for x in pages))


def link(src: Path, dst: Path) -> None:
    """Hardlink src -> dst, replacing a dst that points somewhere else. Strip FILENAMES survive a
    re-slice while the pixels do not, so a plain `if not dst.exists()` would keep last week's
    picture under this week's name — the exact trap QUEUE_IMG_ROOTS exists for."""
    if dst.exists():
        if dst.stat().st_ino == src.stat().st_ino:
            return
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        import shutil
        shutil.copy2(src, dst)



def norm(text: str) -> str:
    """Collapse whitespace so two spellings of the same token sequence compare equal."""
    return " ".join(text.split())


# The music a crop holds, as `check_crop_staleness.py` defines it — plus the system, since window
# indices are per row. Two crops agreeing on all of these hold the same measures of the same staff.
MUSIC_KEYS = ("system", "meas_from", "meas_to", "n_measures", "is_row_start")


def carry_labels(root: Path, old_dir: Path, old_strips: Path, new_strips: Path,
                 review: list[dict]) -> list[dict]:
    """Offer an earlier cut's hand-typed corrections again, on the new crop holding the same music.

    ⚠ They are written to `corrected_label` and NOT given a verdict, so every row stays PENDING:
    review_ui seeds its edit box from `corrected_label`, so the text is there to confirm or fix
    against the better picture, and nothing enters exam gold without a human looking. That
    distinction is the point — a label typed against a crop that cut a beamed group in half is a
    reading of a truncated picture, and this queue exists because those crops were wrong.
    """
    prior = [r for r in csv.DictReader((old_dir / "emit_review.csv").open())
             if r.get("verdict") and r["verdict"] != "bad"]
    if not prior:
        return []
    mans: dict[tuple[str, str], dict] = {}

    def manifest(rootdir: Path, page: str) -> dict:
        key = (str(rootdir), page)
        if key not in mans:
            path = rootdir / page / f"{page}_manifest.json"
            mans[key] = ({r["strip"]: r for r in json.loads(path.read_text())}
                         if path.exists() else {})
        return mans[key]

    by_strip = {r["strip"]: r for r in review}
    carried = []
    for r in prior:
        text = r.get("corrected_label") or r.get("label") or ""
        o = manifest(root / old_strips, r["page"]).get(r["strip"])
        hits = []
        if o is not None:
            want = tuple(o.get(k) for k in MUSIC_KEYS)
            hits = [s for s, v in manifest(root / new_strips, r["page"]).items()
                    if tuple(v.get(k) for k in MUSIC_KEYS) == want]
        target = hits[0] if len(hits) == 1 and hits[0] in by_strip else ""
        if target:
            by_strip[target]["corrected_label"] = text
        carried.append({"old_strip": r["strip"], "old_verdict": r["verdict"], "page": r["page"],
                        "new_strip": target,
                        "status": "offered" if target else
                                  ("no crop holds this music now" if not hits else
                                   "matched a crop that is not in the queue"),
                        "text": text})
    return carried




def carry_gold(root: Path, gold_path: Path, old_strips: Path, new_strips: Path,
               review: list[dict], accepted: list[dict]) -> tuple[list[dict], list[dict]]:
    """Move the FROZEN exam's labels onto the re-sliced crops, and say what happened to each one.

    A gold label describes the music of an exact measure span, so it stays true on any crop holding
    that same span (`MUSIC_KEYS`, the rule `check_crop_staleness.py` uses). Three outcomes, and the
    split is the whole point of doing this rather than re-labelling blind:

      agreed     the re-emitted label for that crop is IDENTICAL to the carried gold. Two
                 independent derivations from SymbTr agree, so the strip needs no human.
      conflict   the crop was auto-accepted but its new label differs from the gold — the gold was
                 hand-corrected for a reason, so a human decides. Queued, gold in `corrected_label`.
      suggested  the crop is already in the review queue; the gold rides along in `corrected_label`
                 as a PENDING suggestion, so it is confirmed against the new picture, not retyped.
      lost       no crop holds that music any more (re-packed, or dropped as split_wide /
                 over_budget). The label cannot be rescued; it is listed so the loss is countable.
    """
    gold = [json.loads(l) for l in gold_path.open()]
    mans: dict[tuple[str, str], dict] = {}

    def manifest(rootdir: Path, page: str) -> dict:
        key = (str(rootdir), page)
        if key not in mans:
            path = rootdir / page / f"{page}_manifest.json"
            mans[key] = ({r["strip"]: r for r in json.loads(path.read_text())}
                         if path.exists() else {})
        return mans[key]

    idx: dict[str, dict[tuple, list[str]]] = {}

    def new_index(page: str) -> dict[tuple, list[str]]:
        if page not in idx:
            by: dict[tuple, list[str]] = defaultdict(list)
            for st, v in manifest(root / new_strips, page).items():
                by[tuple(v.get(k) for k in MUSIC_KEYS)].append(st)
            idx[page] = by
        return idx[page]

    by_review = {r["strip"]: r for r in review}
    by_accept = {m["image"]: m for m in accepted}
    outcome: list[dict] = []
    for g in gold:
        page, text = g["page"], norm(g["label"])
        o = manifest(root / old_strips, page).get(g["image"])
        hits = new_index(page).get(tuple(o.get(k) for k in MUSIC_KEYS), []) if o else []
        target = hits[0] if len(hits) == 1 else ""
        if not target:
            outcome.append({"page": page, "old_strip": g["image"], "new_strip": "",
                            "status": "lost", "gold": g["label"], "emitted": ""})
            continue
        if target in by_accept:
            emitted = norm(by_accept[target]["label"])
            if emitted == text:
                by_accept[target]["carried"] = "gold_agreed"
                outcome.append({"page": page, "old_strip": g["image"], "new_strip": target,
                                "status": "agreed", "gold": g["label"], "emitted": emitted})
            else:
                m = by_accept.pop(target)
                row = {"piece": m["piece"], "page": page, "strip": target,
                       "reason": "gold_conflict", "nd": m.get("nd", ""),
                       "min_logprob": m.get("min_logprob", ""), "exam": 1,
                       "label": m["label"], "decoded": "", "verdict": "",
                       "corrected_label": g["label"], "by": ""}
                review.append(row)
                by_review[target] = row
                outcome.append({"page": page, "old_strip": g["image"], "new_strip": target,
                                "status": "conflict", "gold": g["label"], "emitted": emitted})
        elif target in by_review:
            by_review[target]["corrected_label"] = g["label"]
            outcome.append({"page": page, "old_strip": g["image"], "new_strip": target,
                            "status": "suggested", "gold": g["label"],
                            "emitted": by_review[target].get("label", "")})
        else:
            outcome.append({"page": page, "old_strip": g["image"], "new_strip": target,
                            "status": "lost", "gold": g["label"], "emitted": ""})
    accepted[:] = [m for m in accepted if m["image"] in by_accept]
    return outcome, review



def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(REPO))
    ap.add_argument("--emit", default=EMIT, help="the emitter's output dir for these pieces")
    ap.add_argument("--strips-root", default=STRIPS, help="crop root the emit was made from")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--plan", action="store_true",
                    help="print the emit command and the page census, write nothing")
    ap.add_argument("--force", action="store_true",
                    help="rebuild over a queue that already carries verdicts (they are LOST)")
    ap.add_argument("--carry-from", metavar="OLD_QUEUE_DIR",
                    help="an earlier cut of this queue, on OTHER crops: its hand-typed corrections "
                         "are offered again on the new crop holding the SAME music (see carry_labels)")
    ap.add_argument("--carry-strips-root", default="data/real/strips",
                    help="crop root the --carry-from queue was built against")
    ap.add_argument("--rebuild", action="store_true",
                    help="EXAM REBUILD (owner, 2026-08-21): every testset page, not only the "
                         "ungraded ones — the whole instrument moves to the current slicer")
    ap.add_argument("--carry-gold", default=CLEAN,
                    help="--rebuild only: the frozen exam manifest whose labels are carried onto "
                         "the new crops (set empty to carry nothing)")
    args = ap.parse_args()
    root = Path(args.root)

    owner, targets = target_pages(root)
    pieces = pieces_to_emit(owner, targets)
    if args.rebuild:
        targets = set(owner)                      # the whole exam moves, not only the ungraded part
        pieces = sorted(set(owner.values()))
    print(f"testset pages: {len(owner)}   graded today: {len(owner) - len(targets)}   "
          f"this queue's pages: {len(targets)}   pieces to emit: {len(pieces)}")

    if args.plan:
        print(f"\nOMR_ORT_THREADS=2 nice -19 .venv-ml/bin/python scripts/rung3/emit_strip_labels.py "
              f"--exam \\\n  --testset {TESTSET} --checkpoint data/checkpoints/rung3-labeler \\\n"
              f"  --onnx-dir data/checkpoints/rung3-labeler-onnx \\\n"
              f"  --strips-root {args.strips_root} --out {args.emit} \\\n"
              f"  --pieces {','.join(pieces)}")
        return 0

    emit_dir = root / args.emit
    if not (emit_dir / "emit_review.csv").exists():
        sys.exit(f"no emit output at {emit_dir} — run the command from `--plan` first")

    out_dir = root / args.out
    # Rebuilding rewrites emit_review.csv, and the human verdicts live in that file — the same trap
    # `build_label_batch.py` refuses on. A queue with no verdicts yet is free to re-cut.
    existing = out_dir / "emit_review.csv"
    if existing.exists() and not args.force:
        done = sum(1 for r in csv.DictReader(existing.open()) if r.get("verdict"))
        if done:
            sys.exit(f"{existing} already carries {done} verdicts — re-cutting would lose them. "
                     f"Merge or move that file first, or pass --force to discard them.")
    out_dir.mkdir(parents=True, exist_ok=True)

    review = [{**r, "verdict": "", "corrected_label": "", "by": ""}
              for r in csv.DictReader((emit_dir / "emit_review.csv").open())
              if r["page"] in targets]
    drops = [r for r in csv.DictReader((emit_dir / "emit_drops.csv").open())
             if r["page"] in targets]
    audit = [r for r in csv.DictReader((emit_dir / "emit_audit.csv").open())
             if r["page"] in targets]
    accepted = [m for m in (json.loads(l) for l in (emit_dir / "manifest.jsonl").open())
                if m["page"] in targets]

    # Page-complete and in reading order: a page is the unit the Round-3 primary is stated in, and
    # the strip-level order carries no usable signal (build_label_batch.py measured 0.44x lift on
    # decode confidence). Zero-padded s##_w## sorts as reading order already.
    review.sort(key=lambda r: (r["page"], r["strip"]))
    accepted.sort(key=lambda m: (m["page"], m["image"]))

    def write_csv(name: str, rows: list[dict], fields: list[str]):
        with (out_dir / name).open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)

    gold_moves: list[dict] = []
    if args.rebuild and args.carry_gold:
        gold_moves, review = carry_gold(root, root / args.carry_gold,
                                        Path("data/real/strips"), Path(args.strips_root),
                                        review, accepted)
        review.sort(key=lambda r: (r["page"], r["strip"]))
        tally = Counter(m["status"] for m in gold_moves)
        write_csv("gold_carry.csv", gold_moves,
                  ["page", "old_strip", "new_strip", "status", "gold", "emitted"])
        print(f"frozen gold, {len(gold_moves)} labels: {dict(tally)}")

    carried = (carry_labels(root, root / args.carry_from, Path(args.carry_strips_root),
                            Path(args.strips_root), review) if args.carry_from else [])
    if carried:
        write_csv("carried_from_oldgeom.csv", carried,
                  ["page", "old_strip", "old_verdict", "new_strip", "status", "text"])
        offered = sum(1 for c in carried if c["status"] == "offered")
        print(f"carried {offered} of {len(carried)} earlier corrections onto the new crops "
              f"(as pending suggestions, never as verdicts) — carried_from_oldgeom.csv")

    write_csv("emit_review.csv", review, REVIEW_FIELDS)
    write_csv("emit_drops.csv", drops, ["piece", "symbtr", "page", "strip", "reason", "detail"])
    write_csv("emit_audit.csv", audit,
              ["piece", "page", "strip", "nd", "min_logprob", "verdict", "label", "decoded"])
    # review_ui builds full_audit.csv from manifest.jsonl on first run and never rebuilds it, so a
    # stale one would describe the previous cut's strips.
    (out_dir / "full_audit.csv").unlink(missing_ok=True)

    # The auto-accepted rows are exam gold the emitter labelled on its own. They are carried here so
    # `promote_labels.py --dir <out> --exam` has a manifest to grow, and so review_ui's
    # `examv3-full` sidecar can put every one of them in front of a human — v2 sampled 2 of 63.
    with (out_dir / "manifest.jsonl").open("w") as f:
        for m in accepted:
            link(root / args.strips_root / m["page"] / m["image"], out_dir / m["image"])
            f.write(json.dumps(m) + "\n")

    report = {
        "built_by": "scripts/rung3/build_exam_v3_queue.py",
        "emit": args.emit,
        "strips_root": args.strips_root,
        "pages": {"testset": len(owner), "graded_by_frozen_exam": len(owner) - len(targets),
                  "in_this_queue": len(targets),
                  "with_rows": len({r["page"] for r in review} | {m["page"] for m in accepted})},
        "strips": {"review": len(review), "auto_accepted": len(accepted), "dropped": len(drops)},
        "review_reasons": dict(Counter(r["reason"] for r in review)),
        "drop_reasons": dict(Counter(r["reason"] for r in drops)),
        "rows_per_page": dict(Counter(r["page"] for r in review)),
    }
    (out_dir / "build_report.json").write_text(json.dumps(report, indent=1))

    print(f"\nqueue: {len(review)} rows needing a human  (auto-accepted {len(accepted)}, "
          f"dropped {len(drops)})")
    print(f"review reasons: {report['review_reasons']}")
    print(f"drop reasons:   {report['drop_reasons']}")
    print(f"wrote {out_dir}/emit_review.csv  -> review_ui tab `examv3` "
          f"(crops resolve under {args.strips_root})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
