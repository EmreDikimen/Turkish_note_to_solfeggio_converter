"""Reference for the server's Donut port: what training's image processor makes of each strip.

Reads a list of strip PNG paths (one per line) and writes, for each, the processor's 409x583
output BEFORE rescale/normalize as an 8-bit grayscale PNG (channel 0; the three are equal because
training opens every strip with .convert("RGB")). `tools/vision/parity/donut-parity.ts` runs this
and compares the bytes with `apps/server/src/donut.ts`.

    .venv-ml/bin/python scripts/donut_ref.py --list paths.txt --out DIR
"""
import argparse
import os

import numpy as np
from PIL import Image
from transformers import AutoProcessor

ap = argparse.ArgumentParser()
ap.add_argument("--list", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--checkpoint", default="data/checkpoints/r4-ctl-stage2-last")
args = ap.parse_args()

proc = AutoProcessor.from_pretrained(args.checkpoint).image_processor
os.makedirs(args.out, exist_ok=True)
paths = [p.strip() for p in open(args.list) if p.strip()]
for i, p in enumerate(paths):
    img = Image.open(p).convert("RGB")  # exactly src/vision/data.py
    px = proc(images=img, do_rescale=False, do_normalize=False, return_tensors="np").pixel_values[0]
    ch = px[0]
    assert np.array_equal(ch, px[1]) and np.array_equal(ch, px[2]), p
    Image.fromarray(ch.astype(np.uint8), mode="L").save(os.path.join(args.out, f"{i:05d}.png"))
print(f"wrote {len(paths)} references to {args.out}")
