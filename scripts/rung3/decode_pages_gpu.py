#!/usr/bin/env python3
"""GPU batch page decode for the Rung-3 emitter — the Colab offload (docs/RUNG3.md §1b).

Slices every listed page (`page_to_strips`, same classical-CV slicer) and batch-decodes all
strips with the PyTorch checkpoint on CUDA, writing `<page>_decode.json` in EXACTLY the
schema `src/vision/decode_page.py` writes — so the emitter on the laptop reuses them as its
per-page decode cache and only runs the cheap alignment + label serialization locally.

The cache metadata is written as checkpoint=<--cache-checkpoint> / suffix="_int8" — the
IDENTITY the local emitter loads (its ONNX int8 runtime). The tokens here come from fp32
torch greedy decode instead; `onnx_parity.py` proved the two runtimes agree token-for-token
(8/8 fp32 AND int8, 2026-07-15), and fp32 is if anything the more accurate side, so gates
(nd / sig votes / alignment) only get cleaner. Greedy + per-token logprobs mirror
`onnx_greedy_decode(return_logprobs=True)`; MAX_TOKENS=100 matches onnx_parity.MAX_TOKENS.

Run (Colab, see notebooks/rung3_decode_colab.ipynb):
    python scripts/rung3/decode_pages_gpu.py --pages pages.txt \
        --checkpoint /content/rung3-labeler --out data/real/strips --batch-size 32
    # then zip data/real/strips back to Drive

Smoke test on the laptop (CPU, 1 page — verifies schema + token parity vs an existing JSON):
    .venv-ml/bin/python scripts/rung3/decode_pages_gpu.py --pages <(echo <page.png>) \
        --checkpoint data/checkpoints/rung3-labeler --device cpu --out /tmp/decode_smoke
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "src" / "vision"))

MAX_TOKENS = 100  # onnx_parity.MAX_TOKENS — the decode cap both runtimes share


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", required=True,
                    help="text file: one page-image path per line (repo-relative or absolute)")
    ap.add_argument("--checkpoint", required=True, help="torch checkpoint dir (train.py best/)")
    ap.add_argument("--cache-checkpoint", default="data/checkpoints/rung3-labeler",
                    help="checkpoint path RECORDED in the JSONs — must equal the local "
                         "emitter's --checkpoint for cache reuse")
    ap.add_argument("--out", default="data/real/strips")
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--device", default=None, help="cuda | cpu (default: cuda if available)")
    ap.add_argument("--skip-existing", action="store_true",
                    help="skip pages whose _decode.json already records --cache-checkpoint")
    ap.add_argument("--measures-per-strip", type=int, default=None,
                    help="override the slicer window size (default: OMR_MEASURES_PER_STRIP "
                         "env or 3). The tuplet emit (docs/RUNG3.md §1c) runs at 1.")
    args = ap.parse_args()

    import torch
    from PIL import Image
    from transformers import AutoProcessor, VisionEncoderDecoderModel

    import page_to_strips as page_to_strips_mod
    from page_to_strips import page_to_strips
    if args.measures_per_strip is not None:
        page_to_strips_mod.MEASURES_PER_STRIP = args.measures_per_strip

    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    processor = AutoProcessor.from_pretrained(args.checkpoint)
    tok = processor.tokenizer
    model = VisionEncoderDecoderModel.from_pretrained(args.checkpoint).to(device).eval()
    eos_id = tok.eos_token_id
    print(f"device={device}  checkpoint={args.checkpoint}  batch={args.batch_size}")

    pages = [l.strip() for l in Path(args.pages).read_text().splitlines() if l.strip()]
    out_root = Path(args.out)
    n_done = n_skip = n_fail = 0
    t0 = time.time()

    for pi, page in enumerate(pages, 1):
        page_path = Path(page)
        if not page_path.is_absolute():
            page_path = REPO / page
        stem = page_path.stem
        strip_dir = out_root / stem
        dj = strip_dir / f"{stem}_decode.json"
        if args.skip_existing and dj.exists():
            try:
                prev = json.loads(dj.read_text())
                if (prev.get("checkpoint") == args.cache_checkpoint
                        and prev.get("measures_per_strip", 3) == page_to_strips_mod.MEASURES_PER_STRIP):
                    n_skip += 1
                    continue
            except json.JSONDecodeError:
                pass
        try:
            manifest = page_to_strips(page_path, strip_dir, debug=True)
        except Exception as e:  # noqa: BLE001 — one broken scan must not kill the batch
            print(f"  ⚠ {stem}: slicer failed ({e})")
            n_fail += 1
            continue
        if not manifest:
            # same meaning as decode_page's RuntimeError: the emitter will treat the piece
            # as missing_pages when it can't decode the page either
            print(f"  ⚠ {stem}: no strips (staff detection found nothing)")
            n_fail += 1
            continue

        images = [Image.open(strip_dir / row["strip"]).convert("RGB") for row in manifest]
        decoded: list[dict] = []
        t_page = time.time()
        for b0 in range(0, len(images), args.batch_size):
            batch = images[b0: b0 + args.batch_size]
            pv = processor(images=batch, return_tensors="pt").pixel_values.to(device)
            with torch.no_grad():
                gen = model.generate(pv, max_length=MAX_TOKENS, output_scores=True,
                                     return_dict_in_generate=True)
            seqs = gen.sequences  # [B, 1+steps] incl. decoder_start
            # greedy per-token logprobs, aligned with seqs[:, 1:]
            logps = torch.stack(
                [step.log_softmax(-1).gather(1, seqs[:, i + 1, None]).squeeze(1)
                 for i, step in enumerate(gen.scores)], dim=1
            )  # [B, steps]
            for j, row in enumerate(manifest[b0: b0 + args.batch_size]):
                ids = seqs[j, 1:].tolist()
                # trim padding after eos (batched generate pads finished rows)
                if eos_id in ids:
                    cut = ids.index(eos_id) + 1
                else:
                    cut = len(ids)
                ids = ids[:cut]
                lp = logps[j, :cut].tolist()
                text = tok.decode(ids, skip_special_tokens=True).strip()
                decoded.append({
                    "strip": row["strip"], "system": row["system"], "window": row["window"],
                    "is_row_start": row["is_row_start"], "tokens": text,
                    "meas_from": row.get("meas_from"), "meas_to": row.get("meas_to"),
                    "n_measures": row.get("n_measures"), "split_wide": row.get("split_wide"),
                    "row_measures": row.get("row_measures"),
                    "n_ids": len(ids),
                    "hit_cap": len(ids) >= MAX_TOKENS and (not ids or ids[-1] != eos_id),
                    "min_logprob": round(min(lp), 4) if lp else None,
                    "mean_logprob": round(sum(lp) / len(lp), 4) if lp else None,
                })
        result = {"page": str(page), "checkpoint": args.cache_checkpoint, "suffix": "_int8",
                  "measures_per_strip": page_to_strips_mod.MEASURES_PER_STRIP,
                  "total_ms": round((time.time() - t_page) * 1000, 1), "strips": decoded}
        dj.write_text(json.dumps(result, indent=1))
        n_done += 1
        if pi % 25 == 0 or pi == len(pages):
            rate = n_done / max(time.time() - t0, 1e-9)
            eta = (len(pages) - pi) / max(rate, 1e-9)
            print(f"  {pi}/{len(pages)}  done={n_done} skip={n_skip} fail={n_fail}"
                  f"  ({rate * 60:.1f} pages/min, eta {eta / 60:.0f} min)")

    print(f"\ndecoded {n_done} pages ({n_skip} skipped, {n_fail} failed) -> {out_root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
