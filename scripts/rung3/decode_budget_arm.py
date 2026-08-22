"""Decode a page sample under the LABEL-BUDGET rail — arm B for the `?dense=` measurement.

Arm A is free: `data/real/strips_v2/*/\\*_decode.json` already holds every page decoded under the
shipped measures+width rule with `round2-stage2-best` int8. This produces the matching arm under
`OMR_WINDOW_MODE=budget`, so `measure_fill_score.py --decode-root A --compare B` can read the two
against each other on the same pages.

Why a script and not the env var. `decode_page.py` loads the ONNX graphs per invocation (~20 s), so
a per-page subprocess would spend more time loading than decoding. This loads once and loops, and
it is resumable — a page already written under --out is skipped, so Ctrl-C is safe.

⚠ The checkpoint must be the one the cached arm-A decodes were written with, or the comparison
measures two models instead of two packing rules. It is `round2-stage2-best`, and the script
refuses to run if arm A's cache says otherwise.

    .venv-ml/bin/python scripts/rung3/decode_budget_arm.py --pages 120 --budget 50
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
import page_to_strips as pts                       # noqa: E402
from decode_page import load_runtime, decode_page  # noqa: E402

ARM_A = Path("data/real/strips_v2")
IMAGES = Path("data/real/images")
CKPT = "data/checkpoints/round2-stage2-best"
ONNX = "data/checkpoints/round2-stage2-best-onnx"


def index_images() -> dict[str, Path]:
    idx: dict[str, Path] = {}
    for p in IMAGES.rglob("*"):
        if p.suffix.lower() in (".png", ".jpg", ".jpeg") and p.stem not in idx:
            idx[p.stem] = p
    return idx


def eligible(images: dict[str, Path]) -> list[str]:
    """Pages with an arm-A decode from the RIGHT checkpoint and the shipped windowing.

    The same gate `slicer_ref.py` uses, and for the same reason: a page whose cache was written by
    another model or another packing rule cannot be one half of a paired comparison.
    """
    out = []
    for d in sorted(p for p in ARM_A.iterdir() if p.is_dir()):
        f = d / f"{d.name}_decode.json"
        if not f.exists() or d.name not in images:
            continue
        j = json.loads(f.read_text())
        if not str(j.get("checkpoint", "")).endswith("round2-stage2-best"):
            continue
        if j.get("window_mode", "legacy") != "legacy" or j.get("suffix") != "_int8":
            continue
        if not j.get("strips"):
            continue
        out.append(d.name)
    return out


def sample(items: list, n: int) -> list:
    """Deterministic spread over the alphabetised corpus — `slicer_ref.py`'s own, so the two
    tools sample the same pages at the same n."""
    if n >= len(items):
        return items
    stride = len(items) / n
    return [items[int(i * stride)] for i in range(n)]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", type=int, default=120)
    ap.add_argument("--budget", type=float, default=50.0)
    ap.add_argument("--out", type=Path, default=None, help="default: data/real/rung3/_dense_b<N>")
    ap.add_argument("--stems", type=Path, help="file of page stems instead of a sample")
    args = ap.parse_args()

    out = args.out or Path(f"data/real/rung3/_dense_b{int(args.budget)}")
    images = index_images()
    stems = ([l.strip() for l in args.stems.read_text().splitlines() if l.strip()]
             if args.stems else sample(eligible(images), args.pages))
    todo = [s for s in stems if not (out / s / f"{s}_decode.json").exists()]
    print(f"{len(stems)} page(s) in the sample, {len(stems) - len(todo)} already done, "
          f"{len(todo)} to decode -> {out}")
    if not todo:
        return 0

    # Set on the MODULE: `decode_page` imported `page_to_strips` already, and both globals are read
    # at call time inside `window_measures`, so this reaches the real slicer.
    pts.WINDOW_MODE = "budget"
    pts.TOKEN_BUDGET = args.budget
    print(f"⚠ BUDGET MODE — packing to {args.budget:g} estimated ids "
          f"(arm A on disk is the shipped measures+width rule)\n")

    print(f"loading runtime ({CKPT}, int8) ...")
    t0 = time.time()
    rt = load_runtime(CKPT, ONNX, "_int8")
    print(f"  loaded in {time.time() - t0:.1f}s\n")

    run0 = time.time()
    n_strips = skipped = 0
    for i, stem in enumerate(todo, 1):
        try:
            res = decode_page(images[stem], rt, out_root=out, debug=False, verbose=False)
        except RuntimeError:                      # 0 strips — a slicer outcome, not an error
            skipped += 1
            print(f"[{i:3d}/{len(todo)}] {stem[:48]:48}  SKIP (no strips)")
            continue
        n_strips += len(res["strips"])
        el = time.time() - run0
        print(f"[{i:3d}/{len(todo)}] {stem[:48]:48}  {len(res['strips']):3d} strips"
              f"   {el:5.0f}s elapsed, ~{el / i * (len(todo) - i) / 60:.0f} min left", flush=True)
    print(f"\ndone: {n_strips} strips over {len(todo) - skipped} pages, {skipped} skipped, "
          f"{(time.time() - run0) / 60:.1f} min")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
