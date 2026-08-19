"""
Are the crops a labelling queue shows still what today's slicer produces?

WHY THIS EXISTS: a hand-made label says "these are the notes in THIS crop". If the slicer later cuts
that page differently, the label points at a picture that no longer exists — and this project has
already paid for that once: 130 hand verdicts from 2026-07-28 did not transfer, because no crop
survived the 2026-07-29 re-slice unchanged (docs/METRICS-SLICER.md). Before anyone spends a week
labelling, the question "will this survive?" should be answered by measurement, not by memory.

WHAT IT CHECKS, per page, in order of how much it would hurt:

  measures differ   the crop holds DIFFERENT MUSIC -> any label on it is void. This is the only
                    failure that actually destroys work.
  size differs      same music, different pixel width (a sub-pixel change in the measured staff
                    spacing rescales the row). A label still describes the right notes.
  pixels differ     same music, same size, values differ slightly. Harmless for labelling; expected
                    on any page that gets ROTATED, since rotation interpolates.
  identical         byte-for-byte.

⚠ It compares against a strip ROOT, so point it at the root the queue actually reads. They are not
interchangeable: `data/real/strips` is the 2026-07-15..17 slicer and `data/real/strips_v2` is the
2026-07-29 re-slice, and `review_ui.QUEUE_IMG_ROOTS` decides which one a given queue shows.

Run:
    .venv-ml/bin/python scripts/rung3/check_crop_staleness.py --root data/real/strips_v2 --pages 20
    .venv-ml/bin/python scripts/rung3/check_crop_staleness.py --root data/real/strips --pages 20
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from vision.page_to_strips import page_to_strips  # noqa: E402

# The fields that decide WHICH MUSIC a crop holds. Everything else (scale, row_x0, pad, width) can
# move without invalidating a label; these cannot.
MUSIC_KEYS = ("meas_from", "meas_to", "n_measures", "is_row_start", "split_wide")


def manifest_rows(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    return data if isinstance(data, list) else data.get("strips", [])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(ROOT / "data/real/strips_v2"))
    ap.add_argument("--pages", type=int, default=20)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--pages-from", metavar="BATCH_PAGES.JSON",
                    help="check exactly the pages of a labelling batch "
                         "(data/real/rung3/_pagequeue/batch<N>_pages.json) instead of a random "
                         "sample — the question 'is the work I already did still valid?'")
    ap.add_argument("--out", metavar="RESULT.JSON",
                    help="write the per-page verdict, so the pages that would lose their labels can "
                         "be fed to `build_label_batch.py --exclude-pages` MECHANICALLY. The stdout "
                         "list is truncated at 10 and re-running this check costs ~12 min a batch, "
                         "which is how an exclusion list ends up hand-copied and short.")
    args = ap.parse_args()

    root = Path(args.root)
    imgs = {p.stem: p for p in (ROOT / "data/real/images").rglob("*.png")}
    dirs = [d for d in sorted(root.iterdir()) if d.is_dir() and d.name in imgs]
    if args.pages_from:
        want = {p["page"] for p in json.loads(Path(args.pages_from).read_text())["pages"]}
        sample = [d for d in dirs if d.name in want]
        missing = want - {d.name for d in sample}
        if missing:
            print(f"⚠ {len(missing)} batch pages have no dir under {root} — not checked")
    else:
        sample = random.Random(args.seed).sample(dirs, min(args.pages, len(dirs)))
    print(f"{root}: {len(dirs)} page dirs with a source PNG; re-slicing {len(sample)}\n")

    tmp = Path(tempfile.mkdtemp(prefix="staleness_"))
    tally = {"identical": 0, "pixels": 0, "size": 0, "measures": 0, "count": 0}
    music_bad: list[str] = []
    verdict: dict[str, str] = {}

    for i, d in enumerate(sample, 1):
        n = d.name
        page_to_strips(imgs[n], tmp)
        old = sorted(p.name for p in d.glob(f"{n}_s*_w*.png"))
        new = sorted(p.name for p in tmp.glob(f"{n}_s*_w*.png"))
        if old != new:
            print(f"  [{i}] CROP COUNT/NAMES  {n}: {len(old)} -> {len(new)}")
            tally["count"] += 1
            music_bad.append(n)
            verdict[n] = "crop count differs"
            continue

        o_rows = manifest_rows(d / f"{n}_manifest.json")
        n_rows = manifest_rows(tmp / f"{n}_manifest.json")
        music_same = len(o_rows) == len(n_rows) and all(
            tuple(a[k] for k in MUSIC_KEYS) == tuple(b[k] for k in MUSIC_KEYS)
            for a, b in zip(o_rows, n_rows)
        )
        if not music_same:
            print(f"  [{i}] MEASURES DIFFER   {n}  <- labels on this page would be VOID")
            tally["measures"] += 1
            music_bad.append(n)
            verdict[n] = "measures differ"
            continue

        sizes = [f for f in old if Image.open(d / f).size != Image.open(tmp / f).size]
        if sizes:
            print(f"  [{i}] size only         {n}: {len(sizes)}/{len(old)} crops, same music")
            tally["size"] += 1
            verdict[n] = "size only"
            continue
        px = [f for f in old
              if Image.open(d / f).tobytes() != Image.open(tmp / f).tobytes()]
        if px:
            print(f"  [{i}] pixels only       {n}: {len(px)}/{len(old)} crops, same music + size")
            tally["pixels"] += 1
            verdict[n] = "pixels only"
        else:
            tally["identical"] += 1
            verdict[n] = "identical"

    n = len(sample)
    print(f"\n{'=' * 70}")
    print(f"identical            {tally['identical']:3d}/{n}")
    print(f"pixels only          {tally['pixels']:3d}/{n}   labels fine")
    print(f"size only            {tally['size']:3d}/{n}   labels fine (same music)")
    print(f"MEASURES differ      {tally['measures']:3d}/{n}   <- labels VOID")
    print(f"crop count differs   {tally['count']:3d}/{n}   <- labels VOID")
    void = tally["measures"] + tally["count"]
    print(f"\n=> {(n - void) / n:.0%} of pages would keep their labels; {void}/{n} would lose them.")
    if music_bad:
        print("   pages that would lose labels:")
        for p in music_bad[:10]:
            print(f"     {p}")
        if len(music_bad) > 10:
            print(f"     … and {len(music_bad) - 10} more — pass --out to get all of them")
    if args.out:
        Path(args.out).write_text(json.dumps({
            "generatedBy": "scripts/rung3/check_crop_staleness.py",
            "root": str(root),
            "pagesFrom": args.pages_from,
            "tally": tally,
            # The two verdicts that void a label, named so a caller can filter on meaning rather
            # than on a string it guessed.
            "voidVerdicts": ["crop count differs", "measures differ"],
            "wouldLoseLabels": music_bad,
            "verdict": verdict,
        }, indent=1))
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
