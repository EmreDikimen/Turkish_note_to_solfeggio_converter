#!/usr/bin/env python3
"""Split `_realval_v2` into its three difficulty tiers, so an arm can be scored on ONE of them.

    .venv-ml/bin/python scripts/rung3/split_realval_tiers.py            # build the three pools
    .venv-ml/bin/python src/vision/eval_omr.py --checkpoint <ckpt> \\
        --strips-dir data/real/rung3/_realval_v2_hard --split none --show-errors 0

WHY THIS EXISTS: Round 3's Lever-7 arm (the scan profile) is pre-registered on **edits on the HARD
tier**, with a no-regression clause on the EASY tier — because the hard tier is where the scanned
pages are and the easy tier is the closest thing we own to the screenshot case
(docs/rung3/levers.md). `eval_omr.py` reads a strips directory; the pool's manifest carries no
`tier` field; so the tiers have to become directories, exactly as `_exam_tier_*` already are.

⚠ **`tier_of` is IMPORTED, never re-implemented.** The tier is not a property of the crop — it is
`promoted` + `reason`, i.e. what the emitter did with the strip — and a second copy of that rule
would drift from `build_realval_v2.py` silently, which is how a pool ends up meaning two things.

⚠ **THE TIER POOLS ARE NOT PAGE-COMPLETE.** The queue capped strips per piece, so the hard tier is
110 strips over 51 pages — **2.16 strips a page**. `eval_omr.py` still prints an EDITS/PAGE block
and it is still worth reading, but on these pools it is edits per *page fragment*, not per page.
For an arm-vs-control read, quote the **paired per-strip** difference as the headline and put
edits/page beside it, saying which is which. The one number that must never be quoted from here is
the signed floor's `share_le5`: that is defined on the 46-page exam, and a 2-strip fragment clears
"≤5 edits" for reasons that have nothing to do with the model.

⚠ **POWER.** hard = 110 strips / 51 pages, mid = 110 / 44, easy = 47 / 22. The easy-tier clause can
catch a large regression and nothing subtle; that is a limit to write beside the result, not a
reason to skip the clause.

⚠ `_realval_v2` carries 5 duplicate rows, 4 of them contradictory (docs/METRICS-CORPUS.md). They are
identical in both arms, so a paired delta is unaffected; absolute totals are inflated by them.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_realval_v2 import tier_of  # noqa: E402  (the single definition of a tier)

ROOT = Path(__file__).resolve().parents[2]
POOL = ROOT / "data/real/rung3/_realval_v2"
TIERS = ("easy", "mid", "hard")
MEDIA = ("scan", "borndigital")


def medium_of(rec: dict, born_digital: set[str]) -> str:
    """scan / borndigital — the MEDIUM a strip's page was captured in, not its difficulty.

    ⚠ This is the split Lever 7 actually targets, and it is not the same axis as `tier_of`. The
    tier is what the EMITTER did with a strip (`promoted` + `reason`); the medium is a fact about
    the source PDF (does page 1 embed a raster image). They correlate — the hard tier is 88% scans —
    but a difficulty tier cannot say whether a change aimed at scanner damage worked, and the two
    pools have different sizes and different label provenance.
    """
    from build_label_batch import piece_stem
    return "borndigital" if piece_stem(rec.get("page", "")) in born_digital else "scan"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pool", default=str(POOL))
    ap.add_argument("--out-prefix", default=None,
                    help="default: <pool>_<tier>, e.g. …/_realval_v2_hard")
    ap.add_argument("--force", action="store_true", help="rebuild pools that already exist")
    ap.add_argument("--by", choices=("tier", "medium", "both"), default="both",
                    help="tier = easy/mid/hard (the emitter's difficulty); medium = scan/borndigital "
                         "(the capture, which is what the scan profile actually targets)")
    args = ap.parse_args()

    pool = Path(args.pool)
    prefix = args.out_prefix or str(pool)
    rows = [json.loads(l) for l in (pool / "manifest.jsonl").read_text().splitlines() if l.strip()]
    groups: dict[str, list[dict]] = {}
    if args.by in ("tier", "both"):
        groups.update({t: [] for t in TIERS})
        for r in rows:
            groups[tier_of(r)].append(r)
    if args.by in ("medium", "both"):
        from build_label_batch import born_digital_stems
        bd = born_digital_stems()
        groups.update({m: [] for m in MEDIA})
        for r in rows:
            groups[medium_of(r, bd)].append(r)

    for tier in groups:
        out = Path(f"{prefix}_{tier}")
        if out.exists():
            if not args.force:
                print(f"{out.name} exists — pass --force to rebuild")
                continue
            shutil.rmtree(out)
        out.mkdir(parents=True)
        for r in groups[tier]:
            src = pool / r["image"]
            if not src.exists():
                raise SystemExit(f"{src} missing — is {pool.name} intact?")
            (out / r["image"]).write_bytes(src.read_bytes())
        with (out / "manifest.jsonl").open("w") as fh:
            for r in groups[tier]:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        pages = Counter(r.get("page", "") for r in groups[tier])
        hand = sum(1 for r in groups[tier] if r.get("label_source") == "human-verified")
        src_mix = ", ".join(f"{s}:{c}" for s, c in
                            Counter(r.get("source", "") for r in groups[tier]).most_common())
        print(f"{out.name:26s} {len(groups[tier]):4d} strips  {len(pages):3d} pages  "
              f"{len(groups[tier]) / max(1, len(pages)):.2f} strips/page  "
              f"hand-verified {hand:3d}   {src_mix}")

    print(f"\ntotal {len(rows)} strips — each split partitions the pool exactly, no strip is "
          f"dropped or shared.")
    print("⚠ `hand-verified` is the count of rows whose gold was SEEDED WITH A MODEL DECODE and "
          "then confirmed or corrected by a person; a descendant of that model is flattered by "
          "them. All 110 of them are in the hard tier.")
    print("⚠ edits/page on these is edits per PAGE FRAGMENT (see this file's docstring); quote the "
          "paired per-strip difference as the headline.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
