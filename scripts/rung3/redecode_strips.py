#!/usr/bin/env python3
"""Re-decode the crops a page ALREADY has, with a different checkpoint — never re-slicing.

Why this exists (2026-08-23, owner's call)
------------------------------------------
`decode_page()` slices the page before it decodes it (src/vision/decode_page.py), so the ordinary
way to refresh a decode also rewrites the PNGs. For the EXAM that is unacceptable: `examv3`'s crops
were frozen when the label-budget rail went to Round 4 (docs/DECISIONS.md 2026-08-23), 62 rows are
already verdicted against those pixels and 138 more carry a suggestion positioned on them. A
re-slice that moved one crop by a pixel would silently invalidate all of it.

So this tool reads `<page>_decode.json`, opens each strip PNG **from disk as it is**, and rewrites
only the model-produced fields:

    tokens · n_ids · hit_cap · min_logprob · mean_logprob · checkpoint · suffix

Every geometry field the emitter aligns on -- meas_from / meas_to / n_measures / row_measures /
split_wide / system / window / is_row_start -- is copied through untouched, as is the stored
window signature, so `window_cache_ok()` still passes and a later `emit_strip_labels.py` run finds
a VALID cache and therefore never calls the slicer either.

The original is kept beside it as `<page>_decode.json.bak-<tag>`; a page whose backup already
exists is skipped, so the run is resumable after a Ctrl-C (this Mac is fanless -- docs/COLAB.md).

    OMR_ORT_THREADS=2 nice -19 .venv-ml/bin/python scripts/rung3/redecode_strips.py \
        --strips-root data/real/strips_examv3 \
        --checkpoint data/checkpoints/round2-stage2-best \
        --onnx-dir data/checkpoints/round2-stage2-best-onnx --tag labeler
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "src" / "vision"))

from PIL import Image  # noqa: E402

from onnx_parity import MAX_TOKENS, onnx_greedy_decode  # noqa: E402
from decode_page import load_runtime  # noqa: E402
from page_to_strips import window_cache_ok, window_signature  # noqa: E402

# Model-produced fields, i.e. exactly what a re-decode is allowed to change.
DECODE_FIELDS = ("tokens", "n_ids", "hit_cap", "min_logprob", "mean_logprob")


def redecode_page(dj: Path, rt, strip_dir: Path) -> tuple[dict, int]:
    d = json.loads(dj.read_text())
    # ⚠ The stored window signature is COPIED through below, so it MUST already describe today's
    # slicer. If it does not, these crops are not what `page_to_strips` now produces: writing a
    # decode that claims otherwise would hand the next `emit_strip_labels.py` run a cache it
    # believes, or -- worse, if it disbelieves it -- send it through `decode_page()`, which slices
    # before it decodes and would re-cut the frozen exam. Refuse instead of guessing.
    if not window_cache_ok(d):
        raise SystemExit(
            f"{dj}: stored window signature does not match the current slicer.\n"
            f"  stored : { {k: d.get(k) for k in window_signature()} }\n"
            f"  current: {window_signature()}\n"
            "  These crops predate the current slicer -- re-cut them deliberately, do not re-decode.")
    changed = 0
    for entry in d.get("strips", []):
        png = strip_dir / entry["strip"]
        if not png.exists():
            raise FileNotFoundError(f"{png} — crop missing; refusing to guess")
        img = Image.open(png).convert("RGB")
        pv = rt.processor(images=img, return_tensors="pt").pixel_values.numpy()
        ids, _enc_ms, _dec_ms, logprobs = onnx_greedy_decode(
            rt.sessions, pv, rt.start_id, rt.eos_id, return_logprobs=True
        )
        text = rt.tok.decode(ids, skip_special_tokens=True).strip()
        if text != entry.get("tokens"):
            changed += 1
        entry["tokens"] = text
        entry["n_ids"] = len(ids)
        entry["hit_cap"] = len(ids) >= MAX_TOKENS and (not ids or ids[-1] != rt.eos_id)
        entry["min_logprob"] = round(min(logprobs), 4) if logprobs else None
        entry["mean_logprob"] = round(sum(logprobs) / len(logprobs), 4) if logprobs else None
    # The cache key the emitter checks. The window signature is COPIED, not recomputed: these
    # crops were cut under the stored settings and this tool did not re-cut them.
    d["checkpoint"] = rt.checkpoint
    d["suffix"] = rt.suffix
    d["redecoded_from"] = d.get("redecoded_from") or "data/checkpoints/rung3-labeler"
    return d, changed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strips-root", required=True)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--onnx-dir", required=True)
    ap.add_argument("--suffix", default="_int8")
    ap.add_argument("--tag", default="prev", help="backup suffix: <page>_decode.json.bak-<tag>")
    ap.add_argument("--limit", type=int, default=0, help="stop after N pages (a pilot)")
    ap.add_argument("--pages", default="", help="comma-separated page stems; default = all")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.strips_root)
    want = {p for p in args.pages.split(",") if p}
    jobs = []
    for dj in sorted(root.glob("*/*_decode.json")):
        stem = dj.parent.name
        if want and stem not in want:
            continue
        if (dj.parent / f"{dj.name}.bak-{args.tag}").exists():
            continue  # already done — resumable
        jobs.append(dj)
    if args.limit:
        jobs = jobs[: args.limit]

    n_strips = sum(len(json.loads(p.read_text()).get("strips", [])) for p in jobs)
    print(f"pages to do: {len(jobs)}   strips: {n_strips}")
    if args.dry_run or not jobs:
        return

    rt = load_runtime(args.checkpoint, args.onnx_dir, args.suffix)
    t0 = time.time()
    done_strips = 0
    total_changed = 0
    for i, dj in enumerate(jobs, 1):
        stem = dj.parent.name
        d, changed = redecode_page(dj, rt, dj.parent)
        shutil.copy2(dj, dj.parent / f"{dj.name}.bak-{args.tag}")
        dj.write_text(json.dumps(d, indent=1))
        done_strips += len(d.get("strips", []))
        total_changed += changed
        el = time.time() - t0
        rate = el / max(done_strips, 1)
        left = (n_strips - done_strips) * rate
        print(f"[{i}/{len(jobs)}] {stem}: {len(d['strips'])} strips, {changed} changed "
              f"| {el/60:.1f} min elapsed, ~{left/60:.1f} min left", flush=True)
    print(f"\ndone: {done_strips} strips, {total_changed} decodes changed "
          f"({total_changed/max(done_strips,1)*100:.1f}%), {(time.time()-t0)/60:.1f} min")


if __name__ == "__main__":
    main()
