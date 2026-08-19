#!/usr/bin/env python3
"""Cut a LABELLING BATCH out of `reslice-all` — a page-complete subset, ranked by error evidence.

    npx tsx tools/vision/page-structure.ts                              # 1. stitch stats (once)
    .venv-ml/bin/python scripts/rung3/build_label_batch.py --strips 1500   # 2. cut the batch
    .venv-ml/bin/python scripts/rung3/review_ui.py                      # 3. label the `batch1` tab
    .venv-ml/bin/python scripts/rung3/build_label_batch.py --stats --batch 1   # 3b. what is it yielding?
    .venv-ml/bin/python scripts/rung3/build_label_batch.py --merge-back  # 4. verdicts -> reslice_all

Which TIER to cut from — `--clean` / `--scanned`
------------------------------------------------
Both read the same `born_digital_stems()` set and are exact inverses of each other, so the tier is a
**file-format fact** rather than a heuristic: `--clean` keeps only pages whose PDF is born-digital,
`--scanned` keeps only the pages whose PDF is a scan. Neither is a difficulty score.

⚠ `--scanned` is where Round 3 is graded: **93% of exam pages are scans** (62 of 67), and the
born-digital `batch2` measured a ~12% fix rate against ~30% in the scanned nota pool. A row is seeded
with the decode, so an `ok` changes the training data by nothing — **the yield of a batch is its FIX
rate** (docs/METRICS-CORPUS.md, docs/rung3/labeling-queues.md).

⚠ `--scanned` does NOT mean "printed". The scanned tier contains real handwritten manuscript, which
is a DEFERRED category (owner, 2026-08-17) and must not enter a printed-page pool. Triage it at PAGE
level — 52 page images, minutes — and feed the result back with `--exclude-pages`, which is also
where a page whose crops are STALE goes (`check_crop_staleness.py`, "measures differ" = the label
would describe a picture that no longer exists).

Why this exists rather than a filter in review_ui
-------------------------------------------------
`review_ui.py` sorts nothing and filters only on the `reason` column, and `reslice-all` ships
ordered **worst-confidence-first** — an ordering measured at **0.44x lift** on this very pool
(the worst 10% by confidence holds 4% of the label/decode disagreements;
`scripts/rung3/build_page_queue.py`). Taking the first 1,500 rows of that tab is therefore close to
labelling 1,500 random strips. So the batch is cut here instead, on the only signal that survived
measurement — per-page structural evidence — and handed to the UI as its own queue.

What "affects the model most" means here, and what it does NOT
--------------------------------------------------------------
Three candidate rankings were considered and two are ruled out by measurements already on record:

  * **decode confidence** — 0.44x lift, worse than random (above, and W8 was dropped for it).
  * **label/decode disagreement** — ~78% of disagreements were the LABEL being wrong, not the
    decode (docs/METRICS-CORPUS.md), and `nd` is empty for all 33,804 reslice rows anyway, because
    30,049 of them are seeded with their own decode and cannot disagree by construction.
  * **structural evidence** — off-meter bars, stitch warnings, truncated (`hit_cap`) strips,
    slicer-flagged crops. Wrong on their face, no ground truth needed. This is what is used.

⚠ It is a heuristic over visible damage, **not** a validated predictor of edits/page — that could
not be validated, because the only pages carrying gold are the exam's and they are (correctly)
absent from this pool. Treat the order as "where the damage is", which is what it measures.

Page-complete, and why
----------------------
Every strip of a chosen page is in the batch, in reading order (`s00_w00`, `s00_w01`, `s01_w00` …),
because the strip-level order is worthless (above), reading a page once beats reading it 20 times,
and a page is the unit Round 3's primary floor is stated in.

⚠ **This is a TRAINING batch.** Exam pieces are refused twice over (here, and by the re-slice that
produced the decodes). Nothing cut here may become exam gold: this ranking selects *the worst pages
in the corpus*, so an exam drawn from it would not be comparable to exam v2.1's baseline or to the
signed floor. Exam growth is a separate job with random/stratified sampling — docs/rung3/levers.md.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_page_queue import (  # noqa: E402  (path shim above is deliberate)
    exam_page_stems,
    load_decode_flags,
    load_strip_features,
    load_structure,
    score_page,
)

ROOT = Path(__file__).resolve().parents[2]
RESLICE = ROOT / "data/real/rung3/_reslice_v2/reslice_all.csv"
OUT_DIR = ROOT / "data/real/rung3/_pagequeue"
PDF_DIRS = [ROOT / "data/real/pdfs/nota", ROOT / "data/real/pdfs/neyzen"]
BORN_DIGITAL = OUT_DIR / "born_digital.json"


def born_digital_stems(refresh: bool = False) -> set[str]:
    """Piece stems whose PDF is BORN-DIGITAL — typeset by software, never scanned.

    ⚠ This is a **file-format fact, not a heuristic**: the test is that page 1 embeds no raster
    image at all and is drawn with vector operators. A scan is always one big embedded image, so
    the two cannot be confused, and no model, threshold or eyeball is involved. That matters here
    because every other "difficulty" signal this project has is either circular (`nd`, tier_of) or
    was measured worse than random (decode confidence).

    Measured 2026-08-18 over all 2,055 PDFs: **88 of 1,000 nota PDFs are born-digital, and 0 of
    1,055 neyzen PDFs are.** ⚠ That last number corrects a line repeated in several docs — neyzen
    is described as "clean vector PDFs" and it is nothing of the kind; every neyzen page is a
    raster scan. Its ~5x lower SER is real, but it comes from being a *better scan*, not a
    born-digital one.
    """
    if BORN_DIGITAL.exists() and not refresh:
        return set(json.loads(BORN_DIGITAL.read_text())["stems"])
    try:
        import fitz  # PyMuPDF, .venv-ml only — training/data side, never shipped
    except ImportError:
        raise SystemExit("PyMuPDF missing: .venv-ml/bin/pip install pymupdf")
    stems: list[str] = []
    scanned = 0
    for d in PDF_DIRS:
        for f in sorted(d.rglob("*.pdf")):
            try:
                doc = fitz.open(f)
                page = doc[0]
                # >150 vector ops rules out a text-only cover or lyric sheet: a staff alone is
                # more than that, and the lowest real music page measured 199.
                if not page.get_images(full=True) and len(page.get_drawings()) > 150:
                    stems.append(f.stem)
                else:
                    scanned += 1
                doc.close()
            except Exception:
                scanned += 1
    BORN_DIGITAL.parent.mkdir(parents=True, exist_ok=True)
    BORN_DIGITAL.write_text(json.dumps(
        {"generatedBy": "scripts/rung3/build_label_batch.py::born_digital_stems",
         "test": "page 1 embeds no raster image AND has >150 vector drawing ops",
         "bornDigital": len(stems), "scanned": scanned, "stems": sorted(stems)}, indent=1))
    return set(stems)


def piece_stem(page: str) -> str:
    """`…_nota_p1` -> `…_nota`, the stem the PDF is named with."""
    return re.sub(r"_p\d+$", "", page)


def excluded_pages(path: str | None) -> dict[str, str]:
    """PAGE stems the ranking must skip, mapped to the reason they were dropped.

    Why a file rather than a flag: the two things that drop a page here — handwriting and stale
    crops — are JUDGEMENTS, and a judgement that lives only in a shell history cannot be re-read,
    corrected, or held against the next cut. Both are recorded once and reused by every later cut.

    Accepts whichever shape is convenient to write by hand:
        ["page_stem", …]                          | {"pages": [ … ]}
        [{"page": "…", "why": "handwritten"}, …]  | {"page_stem": "why", …}
    """
    if not path:
        return {}
    data = json.loads(Path(path).read_text())
    if isinstance(data, dict) and "pages" in data:
        data = data["pages"]
    if isinstance(data, dict):
        return {str(k): str(v) for k, v in data.items()}
    out: dict[str, str] = {}
    for item in data:
        if isinstance(item, str):
            out[item] = ""
        else:
            out[str(item["page"])] = str(item.get("why", ""))
    return out

# Reading order inside a page: system index, then window index, then the raw name as a tiebreak.
_SW = re.compile(r"_s(\d+)_w(\d+)\.png$")


def reading_order(strip: str) -> tuple:
    m = _SW.search(strip)
    return (int(m.group(1)), int(m.group(2)), strip) if m else (9_999, 9_999, strip)


def load_reslice() -> tuple[list[str], dict[str, list[dict]]]:
    """The re-slice queue, grouped by page. Fields are preserved so the batch is schema-identical."""
    with RESLICE.open(newline="") as fh:
        reader = csv.DictReader(fh)
        fields = list(reader.fieldnames or [])
        by_page: dict[str, list[dict]] = defaultdict(list)
        for row in reader:
            by_page[row["page"]].append(row)
    for rows in by_page.values():
        rows.sort(key=lambda r: reading_order(r["strip"]))
    return fields, by_page


def pick_pages(rows: list[dict], by_page: dict[str, list[dict]], budget: int,
               makam_cap_frac: float) -> list[dict]:
    """Highest-evidence pages first, page-complete, until the STRIP budget is met.

    The cap is on strips rather than pages so one makam cannot take the budget — Lever 4's whole
    argument is that the corpus is already too uniform to learn from.
    """
    cap = max(60, int(budget * makam_cap_frac))
    picked: list[dict] = []
    per_makam: Counter = Counter()
    total = 0
    overflow: list[dict] = []

    def take(r: dict) -> bool:
        nonlocal total
        n = len(by_page.get(r["page"], ()))
        if n == 0 or total + n > budget:
            return False
        picked.append({**r, "batch_strips": n})
        per_makam[r["makam"]] += n
        total += n
        return True

    for r in sorted(rows, key=lambda r: -r["impact"]):
        if total >= budget:
            break
        n = len(by_page.get(r["page"], ()))
        if n and per_makam[r["makam"]] + n > cap:
            overflow.append(r)
            continue
        take(r)
    # Caps (or a page that would overshoot) can leave the batch short: backfill by impact.
    for r in overflow:
        if total >= budget:
            break
        take(r)
    return picked


def cut(args: argparse.Namespace) -> None:
    structure = load_structure()
    feats = load_strip_features()
    flags = load_decode_flags()
    exam = exam_page_stems()
    fields, by_page = load_reslice()

    # ONE set behind both flags, read in opposite directions — see the module docstring. `--clean`
    # keeps the born-digital pages, `--scanned` keeps everything that is not one, and no page can
    # satisfy both: the tier is decided by whether page 1 of the PDF embeds a raster image.
    tier = born_digital_stems(args.refresh_pdfs) if (args.clean or args.scanned) else None
    dropped = excluded_pages(args.exclude_pages)

    rows: list[dict] = []
    refused = off_tier = 0
    skipped: Counter = Counter()
    for stem, st in structure.items():
        if stem in exam:
            refused += 1
            continue
        if tier is not None and (piece_stem(stem) in tier) is not bool(args.clean):
            off_tier += 1
            continue
        if stem in dropped:
            skipped[dropped[stem] or "no reason given"] += 1
            continue
        row = score_page(stem, st, feats.get(stem, {"nd": [], "makam": Counter(), "src": Counter()}),
                         flags.get(stem, {}))
        if row:
            rows.append(row)
    if tier is not None:
        kept, skip = ("born-digital", "scanned") if args.clean else ("scanned", "born-digital")
        print(f"{kept} filter: {len(rows)} pages kept, {off_tier} {skip} pages skipped")
    if dropped:
        print(f"excluded pages: {sum(skipped.values())} of the {len(dropped)} listed in "
              f"{args.exclude_pages} were in this tier — "
              + ", ".join(f"{w}:{c}" for w, c in skipped.most_common()))

    picked = pick_pages(rows, by_page, args.strips, args.makam_cap)
    out_csv = OUT_DIR / f"batch{args.batch}.csv"
    out_json = OUT_DIR / f"batch{args.batch}_pages.json"
    if out_csv.exists() and not args.force:
        raise SystemExit(f"{out_csv.relative_to(ROOT)} exists — it may hold verdicts. "
                         f"Merge it back first, or pass --force.")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    batch_rows: list[dict] = []
    for p in picked:
        batch_rows.extend(by_page[p["page"]])
    with out_csv.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(batch_rows)
    out_json.write_text(json.dumps({
        "generatedBy": "scripts/rung3/build_label_batch.py",
        "from": str(RESLICE.relative_to(ROOT)),
        # WHICH TIER this batch is, recorded in the batch itself: the CSV rows carry no trace of the
        # filter, so without this line a batch cannot say afterwards what it was cut from.
        "tier": "born-digital" if args.clean else "scanned" if args.scanned else "whole corpus",
        "excludePages": args.exclude_pages,
        "excludedInTier": dict(skipped),
        "stripBudget": args.strips,
        "makamCapFrac": args.makam_cap,
        "examPagesRefused": refused,
        "pagesRanked": len(rows),
        "pages": picked,
    }, indent=1))

    done = sum(1 for r in batch_rows if r.get("verdict"))
    ev = sum(p["evidence"] for p in picked)
    print(f"pages ranked      {len(rows)}   (exam pages refused: {refused})")
    print(f"batch {args.batch}           {len(picked)} pages / {len(batch_rows)} strips "
          f"-> {out_csv.relative_to(ROOT)}")
    print(f"  already judged  {done}  (carried in from the re-slice queue)")
    print(f"  evidence        {ev:.0f} units total, {ev / max(1, len(picked)):.1f}/page "
          f"(corpus median {sorted(r['impact'] for r in rows)[len(rows) // 2]:.1f}/page)")
    print(f"  off-meter bars  {sum(p['off_meter'] for p in picked)}")
    print(f"  warnings        {sum(p['warnings'] for p in picked)}"
          f"   hit_cap {sum(p['hit_cap'] for p in picked)}"
          f"   flagged {sum(p['flagged'] for p in picked)}")
    print("  makams          " + ", ".join(f"{m}:{c}" for m, c in
                                           Counter(p["makam"] for p in picked).most_common(8)))
    print("  sources         " + ", ".join(f"{s}:{c}" for s, c in
                                           Counter(p["source"] for p in picked).most_common()))
    print(f"\nnext: add \"batch{args.batch}\" to QUEUES in review_ui.py (already done for batch 1), "
          f"label it, then re-run with --merge-back.")


def merge_back(args: argparse.Namespace) -> None:
    """Copy the batch's verdicts into reslice_all.csv, so the 33,804-row queue stays the record."""
    src = OUT_DIR / f"batch{args.batch}.csv"
    if not src.exists():
        raise SystemExit(f"missing {src.relative_to(ROOT)}")
    with src.open(newline="") as fh:
        judged = {r["strip"]: r for r in csv.DictReader(fh) if r.get("verdict")}
    if not judged:
        print("no verdicts in the batch yet — nothing to merge")
        return

    with RESLICE.open(newline="") as fh:
        reader = csv.DictReader(fh)
        fields = list(reader.fieldnames or [])
        rows = list(reader)

    moved = clash = 0
    for r in rows:
        b = judged.get(r["strip"])
        if not b:
            continue
        # A verdict already in the master queue and DIFFERENT is a real conflict: the batch was cut
        # before it, so the master is the newer statement. Report it rather than picking silently.
        if r.get("verdict") and (r["verdict"], r.get("corrected_label", "")) != \
                (b["verdict"], b.get("corrected_label", "")):
            clash += 1
            continue
        r["verdict"] = b["verdict"]
        r["corrected_label"] = b.get("corrected_label", "")
        r["by"] = b.get("by", "")
        moved += 1

    fd, tmp = tempfile.mkstemp(dir=RESLICE.parent, suffix=".csv.tmp")
    try:
        with os.fdopen(fd, "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        os.replace(tmp, RESLICE)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise

    print(f"merged {moved} verdicts into {RESLICE.relative_to(ROOT)}")
    print("  " + ", ".join(f"{v}:{c}" for v, c in
                           Counter(r["verdict"] for r in judged.values()).most_common()))
    if clash:
        print(f"⚠ {clash} strips already carried a DIFFERENT verdict in the master queue — left "
              f"untouched, resolve by hand")


def stats(args: argparse.Namespace) -> None:
    """What the batch is YIELDING, while it is being labelled — the stop/continue instrument.

    ⚠ The number that matters is the **fix rate**, not the count of rows read. Every row is seeded
    with the model's own decode, so an `ok` verdict changes the training data by exactly nothing; a
    batch whose rows are mostly `ok` bought looks and no data (docs/rung3/labeling-queues.md).
    `bad` is the other side of it: the ranking selects the most damaged pages, and the scanned tail
    is where `realval-hard` lost 33% of its crops as unusable.
    """
    src = OUT_DIR / f"batch{args.batch}.csv"
    if not src.exists():
        raise SystemExit(f"missing {src.relative_to(ROOT)}")
    with src.open(newline="") as fh:
        rows = list(csv.DictReader(fh))
    judged = [r for r in rows if r.get("verdict")]
    if not judged:
        print(f"batch {args.batch}: 0 of {len(rows)} rows judged — nothing to read yet")
        return
    counts = Counter(r["verdict"] for r in judged)
    n = len(judged)
    pages = {r["page"] for r in rows}
    touched = {r["page"] for r in judged}

    print(f"batch {args.batch}   {n} of {len(rows)} rows judged "
          f"({len(touched)} of {len(pages)} pages touched)")
    print("  " + ", ".join(f"{v}:{c}" for v, c in counts.most_common()))
    print(f"  FIX rate  {counts['fix'] / n:6.1%}   <- the yield: an `ok` changes the data by nothing")
    print(f"  bad rate  {counts['bad'] / n:6.1%}   <- unusable crops; cap the impact score if high")
    print("\n  for scale, already on record (docs/METRICS-CORPUS.md, docs/rung3/labeling-queues.md):")
    print("    ~30%   fix rate in the scanned nota pool      <- why the scanned tier was chosen")
    print("    ~12%   fix rate of batch2, born-digital       <- why it was stood down at 68 rows")
    print("     33%   crops lost as unusable in realval-hard <- the bad-rate warning")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strips", type=int, default=1500, help="strip budget for the batch")
    ap.add_argument("--batch", type=int, default=1, help="batch number (names the files)")
    ap.add_argument("--makam-cap", type=float, default=0.15,
                    help="max share of the batch's strips one makam may take (default 0.15)")
    tier = ap.add_mutually_exclusive_group()
    tier.add_argument("--clean", action="store_true",
                      help="BORN-DIGITAL pages only — software-typeset, never scanned or handwritten")
    tier.add_argument("--scanned", action="store_true",
                      help="SCANNED pages only — the exact inverse of --clean over the same set. "
                           "⚠ includes handwritten manuscript: triage it with --exclude-pages")
    ap.add_argument("--exclude-pages", metavar="PAGES.JSON",
                    help="page stems to skip (handwritten, or stale crops) — see excluded_pages()")
    ap.add_argument("--refresh-pdfs", action="store_true",
                    help="re-scan the PDFs instead of reading the cached born_digital.json")
    ap.add_argument("--force", action="store_true", help="overwrite an existing batch CSV")
    ap.add_argument("--merge-back", action="store_true",
                    help="copy this batch's verdicts into reslice_all.csv")
    ap.add_argument("--stats", action="store_true",
                    help="what this batch is yielding so far (fix rate AND bad rate)")
    args = ap.parse_args()
    (stats if args.stats else merge_back if args.merge_back else cut)(args)


if __name__ == "__main__":
    main()
