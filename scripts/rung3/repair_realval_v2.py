#!/usr/bin/env python3
r"""Repair `_realval_v2`: old labels that had NEW pixels put under them.

THE DEFECT. `build_realval_v2.py --build` carries rows out of the previous `_realval` pool and then
copies `strip_root / page / image` under every row it writes (build_realval_v2.py, the `for r in
out_rows` loop). `strip_root` defaults to the 2026-07-29 re-slice, `data/real/strips_v2` — but the
old `_realval` pool is on the RETIRED root: measured 2026-09-09, **271 of its 271 PNGs** are
byte-identical to `data/real/strips/`. Strip filenames survive a re-slice and the pixels do not, so
157 carried rows got a v2 crop placed under a label that was read against the retired one. Nothing
in the build checks that the two still describe the same music.

This is the trap `review_ui.QUEUE_IMG_ROOTS` was written for ("Strip filenames are stable across a
re-slice but the pixels are not, and the SAME page exists under several strip roots"); this builder
predates that lesson.

HOW A ROW IS JUDGED, with no GPU and no re-decode. Both crop roots carry a `round2-stage2-best`
decode cache (`<page>_decode.json`), so for every row we can ask which root's decode the label sits
closer to, counting edits in ID space with `eval_omr.align` — the project's one definition of an
edit. The referee is a model, so it is never asked whether a label is RIGHT; it is asked only which
of two pictures the label describes. What makes that trustworthy is the control: the 110 `hard`
rows were hand-labelled against the v2 crop, and they separate the other way.

    group                                    closer to retired   closer to v2
    hard (hand-read against v2) — CONTROL            5                50
    carried (from the old pool)                     41                22
      ... restricted to crops the re-slice
          moved by >=10% in width:  hard              0                31
                                    carried          15                 0

THE MEASURE SPAN IS THE DECIDING EVIDENCE, not the decode. Both roots' `<page>_manifest.json` record
`system` / `meas_from` / `meas_to` per strip. A crop whose span is unchanged holds the same music
however its pixels shifted, and its label stands. A crop whose span CHANGED is about other measures
and its label cannot stand.

⚠ **A span is only comparable across roots when the page's STAFF COUNT is the same in both.** The
slicer's staff detection changed between the two roots, and `system` is an index — the same coupling
that forces `score_slicer.py --pair-by-position` (CLAUDE.md group 2). A page whose system count
differs is never re-homed here; its rows go to review instead.

WHAT THIS SCRIPT DOES NOT TOUCH. `_realval_v2` itself. The repaired pool is a NEW directory, the
same rule `build_realval_v2.py` followed when it left `_realval` intact: every number recorded
against `_realval_v2` (Round 3 runs A and B) stays reproducible against the pool it was measured on.

Usage:
    .venv-ml/bin/python scripts/rung3/repair_realval_v2.py --report
    .venv-ml/bin/python scripts/rung3/repair_realval_v2.py --queue
    .venv-ml/bin/python scripts/rung3/repair_realval_v2.py --build
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from merge_redecode_into_queue import drop_ties  # noqa: E402  (the ONE tie-removal rule)

RUNG3 = ROOT / "data/real/rung3"
POOL = RUNG3 / "_realval_v2"
RETIRED = ROOT / "data/real/strips"
CURRENT = ROOT / "data/real/strips_v2"
CKPT = ROOT / "data/checkpoints/round2-stage2-best"

REPAIR_DIR = RUNG3 / "_realval_v2_repair"
REPAIR_CSV = REPAIR_DIR / "realval_repair.csv"
OUT_NAME = "_realval_v2r"

# The queue's column contract — `review_ui.py` reads these names, and `by` is what marks a row as
# hand-read rather than tail-accepted.
QUEUE_COLS = ["piece", "page", "strip", "reason", "nd", "min_logprob", "mean_logprob",
              "exam", "label", "decoded", "verdict", "corrected_label", "by"]


# --------------------------------------------------------------------------- reading the two roots

_manifest_cache: dict[tuple[Path, str], dict | None] = {}
_decode_cache: dict[tuple[Path, str], dict | None] = {}


def page_manifest(root: Path, page: str) -> dict | None:
    """{strip -> (system, meas_from, meas_to)} for one page under one crop root."""
    key = (root, page)
    if key not in _manifest_cache:
        p = root / page / f"{page}_manifest.json"
        _manifest_cache[key] = (
            {s["strip"]: (s["system"], s["meas_from"], s["meas_to"]) for s in json.load(p.open())}
            if p.exists() else None)
    return _manifest_cache[key]


def page_decode(root: Path, page: str) -> dict | None:
    """{strip -> decoded token string} for one page under one crop root."""
    key = (root, page)
    if key not in _decode_cache:
        p = root / page / f"{page}_decode.json"
        _decode_cache[key] = (
            {s["strip"]: s["tokens"] for s in json.load(p.open())["strips"]}
            if p.exists() else None)
    return _decode_cache[key]


def n_systems(root: Path, page: str) -> int | None:
    """How many staff rows this root found on the page — the guard on comparing a `system` index."""
    man = page_manifest(root, page)
    return None if man is None else len({sys_i for sys_i, _, _ in man.values()})


def read_pool() -> list[dict]:
    return [json.loads(line) for line in (POOL / "manifest.jsonl").read_text().splitlines()
            if line.strip()]


# --------------------------------------------------------------------------------- classification

def classify(rows: list[dict], tok) -> list[dict]:
    """One verdict per pool row. `cls` is what --queue and --build both dispatch on."""
    from eval_omr import align

    def edits(a: str, b: str) -> int:
        ia = tok(a, add_special_tokens=False).input_ids
        ib = tok(b, add_special_tokens=False).input_ids
        return sum(1 for op, _, _ in align(ia, ib) if op != "match")

    by_image: dict[str, list[int]] = defaultdict(list)
    for i, r in enumerate(rows):
        by_image[r["image"]].append(i)

    out = []
    for i, r in enumerate(rows):
        img, page = r["image"], r.get("page") or ""
        # `label_source` is only ever written by build_realval_v2's hard tier — a row that has it
        # was hand-read against the CURRENT crop and is not in question here.
        carried = not r.get("label_source")
        rec = {"i": i, "image": img, "page": page, "carried": carried, "cls": "keep",
               "why": "", "rehome_to": None}

        # 1. A duplicate image. The hand-read row describes the v2 crop by construction, so the
        #    carried twin is the one that goes — this is the visible tip of the whole defect.
        if len(by_image[img]) > 1:
            rec["cls"] = "keep" if not carried else "drop_dup"
            rec["why"] = ("hand-read twin of a duplicate image" if not carried
                          else "duplicate image: the hand-read row describes the v2 crop")
            out.append(rec)
            continue

        if not carried:
            rec["why"] = "hard tier — hand-read against the v2 crop"
            out.append(rec)
            continue

        # 2. Which crop is actually in the pool? build() falls back to the old pool's PNG when the
        #    current root has no file, so a few rows still carry RETIRED pixels.
        cur_man = page_manifest(CURRENT, page)
        ret_man = page_manifest(RETIRED, page)
        if cur_man is None or img not in cur_man:
            rec["cls"] = "retired_pixels"
            rec["why"] = "no crop under strips_v2 — the pool kept the retired PNG"
            out.append(rec)
            continue

        # 3. The span test. Unchanged span = same music, whatever the pixels did.
        if ret_man is None or img not in ret_man:
            rec["why"] = "no retired crop to compare against"
            out.append(rec)
            continue
        if ret_man[img] == cur_man[img]:
            rec["why"] = "same system and measure span on both roots"
            out.append(rec)
            continue

        # 4. The span moved: this label is about other measures. Can it be re-homed onto the v2
        #    strip covering the span it WAS read against? Only where the two roots agree on how
        #    many staff rows the page has — `system` is an index, and it shifts with staff count.
        want = ret_man[img]
        same_staffing = n_systems(RETIRED, page) == n_systems(CURRENT, page)
        hits = [s for s, span in cur_man.items() if span == want] if same_staffing else []
        if len(hits) == 1:
            rec["cls"] = "rehome"
            rec["rehome_to"] = hits[0]
            rec["why"] = f"span moved; strips_v2 covers {want} as {hits[0]}"
        else:
            rec["cls"] = "review"
            rec["why"] = ("span moved; no single v2 strip covers it" if same_staffing
                          else "span moved; the two roots disagree on the page's staff count")
        out.append(rec)

    # The decode-cache evidence, reported but never decisive — it is what found the defect, and it
    # is the only signal available for a page with no manifest on one of the roots.
    for rec in out:
        d_ret = page_decode(RETIRED, rec["page"]) or {}
        d_cur = page_decode(CURRENT, rec["page"]) or {}
        a, b = d_ret.get(rec["image"]), d_cur.get(rec["image"])
        if a is None or b is None or a == b:
            rec["closer"] = "-"
        else:
            lab = rows[rec["i"]]["label"]
            e_ret, e_cur = edits(lab, a), edits(lab, b)
            rec["closer"] = ("retired" if e_ret < e_cur else "v2" if e_cur < e_ret else "tie")
            rec["e_retired"], rec["e_v2"] = e_ret, e_cur
    return out


def load_tokenizer():
    from transformers import AutoProcessor
    return AutoProcessor.from_pretrained(str(CKPT)).tokenizer


# ---------------------------------------------------------------------------------------- report

def report(rows: list[dict], marks: list[dict]) -> None:
    print(f"pool: {POOL}  ({len(rows)} manifest rows, "
          f"{len({r['image'] for r in rows})} distinct images)\n")

    cls = Counter(m["cls"] for m in marks)
    labels = {
        "keep": "keep — label and crop agree",
        "drop_dup": "DROP — carried twin of a duplicate image",
        "rehome": "RE-HOME — label moves to the v2 strip with the same span",
        "review": "REVIEW — label is for other measures, needs a human",
        "retired_pixels": "flagged — pool still holds a RETIRED crop",
    }
    print("what the repair does:")
    for k in ("keep", "drop_dup", "rehome", "review", "retired_pixels"):
        if cls[k]:
            print(f"  {cls[k]:4d}  {labels[k]}")

    print("\nthe decode-cache evidence that found this (a model referee, never decisive):")
    grid = Counter((("hard  " if not m["carried"] else "carried"), m["closer"]) for m in marks)
    print(f"  {'group':8s} {'retired':>9s} {'v2':>6s} {'tie':>5s} {'n/a':>5s}")
    for g in ("carried", "hard  "):
        print(f"  {g:8s} {grid[(g,'retired')]:9d} {grid[(g,'v2')]:6d} "
              f"{grid[(g,'tie')]:5d} {grid[(g,'-')]:5d}")

    need = [m for m in marks if m["cls"] == "review"]
    if need:
        print(f"\nthe {len(need)} rows a human must read:")
        for m in need:
            print(f"   {m['image']}\n      {m['why']}")
    rehome = [m for m in marks if m["cls"] == "rehome"]
    if rehome:
        print(f"\nthe {len(rehome)} rows re-homed by measure span:")
        for m in rehome:
            print(f"   {m['image']}  ->  {m['rehome_to']}")
    stale = [m for m in marks if m["cls"] == "retired_pixels"]
    if stale:
        print(f"\n⚠ {len(stale)} rows still carry a RETIRED crop (strips_v2 has no such file). "
              f"Their label matches their pixels, so they are not broken — but they are crops the "
              f"shipped slicer no longer produces. Dropping them is a separate call:")
        for m in stale:
            print(f"   {m['image']}")


# ----------------------------------------------------------------------------------------- queue

def write_queue(rows: list[dict], marks: list[dict]) -> int:
    need = [m for m in marks if m["cls"] == "review"]
    if not need:
        print("nothing to review")
        return 0
    REPAIR_DIR.mkdir(parents=True, exist_ok=True)
    if REPAIR_CSV.exists():
        raise SystemExit(f"{REPAIR_CSV} exists — verdicts in it would be overwritten. Move it aside "
                         f"first if you really mean to re-cut the queue.")
    with REPAIR_CSV.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=QUEUE_COLS)
        w.writeheader()
        for m in need:
            r = rows[m["i"]]
            # ⚠ The hint comes from the CURRENT root's decode — the crop the reader will see. This
            # is `_realval_v2`'s standing exception: real-val SELECTS and does not grade, so its
            # round2-stage2-best seed is allowed (CLAUDE.md group 1). The `label` column is left
            # EMPTY on purpose: the carried label is the thing under suspicion, and showing it as
            # gold would anchor the read to the very string this repair exists to retire.
            # ⛔ The cache was written by round2-stage2-best, which predates the `\tie` retirement
            # (owner, 2026-08-22), so its decodes still spell one. A reader who accepts the hint
            # with `ok` would carry a retired token back into the pool — strip it here, with the
            # project's one implementation of that rule, never a second copy.
            dec = drop_ties((page_decode(CURRENT, m["page"]) or {}).get(m["image"], ""))
            w.writerow({
                "piece": r.get("piece", ""), "page": m["page"], "strip": m["image"],
                "reason": r.get("reason", ""), "nd": r.get("nd", ""),
                "min_logprob": r.get("min_logprob", ""), "mean_logprob": "",
                "exam": "", "label": "", "decoded": dec,
                "verdict": "", "corrected_label": "", "by": "",
            })
    print(f"wrote {REPAIR_CSV} — {len(need)} rows")
    print("NEXT: wire it into review_ui.py QUEUES as `realval-repair` with QUEUE_IMG_ROOTS "
          "['data/real/strips_v2'], read it, then --build.")
    return len(need)


# ----------------------------------------------------------------------------------------- build

def build(rows: list[dict], marks: list[dict]) -> int:
    verdicts: dict[str, dict] = {}
    if REPAIR_CSV.exists():
        for r in csv.DictReader(REPAIR_CSV.open()):
            verdicts[r["strip"]] = r

    need = [m for m in marks if m["cls"] == "review"]
    pending = [m for m in need if not verdicts.get(m["image"], {}).get("verdict")]
    if pending:
        raise SystemExit(
            f"{len(pending)} of {len(need)} review rows have no verdict. An unverdicted row must "
            f"never enter the metric pool — read them in review_ui.py first (queue "
            f"`realval-repair`), or run --queue if the CSV does not exist yet.")

    out_rows: list[dict] = []
    tally = Counter()
    for m in marks:
        r = dict(rows[m["i"]])
        if m["cls"] == "drop_dup":
            tally["dropped (duplicate)"] += 1
            continue
        if m["cls"] == "rehome":
            r["image"] = m["rehome_to"]
            r["repaired"] = "rehomed-by-span"
            tally["re-homed"] += 1
        elif m["cls"] == "review":
            v = verdicts[m["image"]]
            if v["verdict"] == "bad":
                tally["dropped (crop unusable)"] += 1
                continue
            if v["verdict"] == "fix":
                if not v["corrected_label"].strip():
                    raise SystemExit(f"{m['image']}: verdict `fix` with an empty corrected_label")
                r["label"] = v["corrected_label"].strip()
            elif v["verdict"] == "ok":
                # `ok` in a review queue means "the picture says what the edit box says" — the
                # decode is promoted, exactly as promote_labels.py treats an `ok`.
                r["label"] = v["decoded"].strip()
            r["label_source"] = "human-verified"
            r["repaired"] = f"re-read ({v['verdict']})"
            tally["re-read"] += 1
        else:
            tally["kept"] += 1
        out_rows.append(r)

    out_dir = RUNG3 / OUT_NAME
    out_dir.mkdir(parents=True, exist_ok=True)
    for r in out_rows:
        page = r.get("page") or ""
        src = CURRENT / page / r["image"]
        if not src.exists():
            # The rows the report flags as `retired_pixels`: their label was read against this crop
            # and matches it, so the pool's own copy is the correct pixels to carry forward.
            src = POOL / r["image"]
        if not src.exists():
            raise SystemExit(f"{r['image']}: no crop under {CURRENT} or {POOL}")
        (out_dir / r["image"]).write_bytes(src.read_bytes())

    with (out_dir / "manifest.jsonl").open("w") as f:
        for r in out_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"{out_dir}: {len(out_rows)} rows, "
          f"{len({r['image'] for r in out_rows})} distinct images")
    for k, v in sorted(tally.items()):
        print(f"   {v:4d}  {k}")
    return len(out_rows)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", action="store_true", help="what is broken and what the repair does")
    ap.add_argument("--queue", action="store_true", help="write the review queue for the broken rows")
    ap.add_argument("--build", action="store_true", help=f"assemble {OUT_NAME} once verdicts exist")
    args = ap.parse_args()
    if not (args.report or args.queue or args.build):
        ap.error("pick one of --report / --queue / --build")

    rows = read_pool()
    marks = classify(rows, load_tokenizer())
    if args.report:
        report(rows, marks)
    if args.queue:
        write_queue(rows, marks)
    if args.build:
        build(rows, marks)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
