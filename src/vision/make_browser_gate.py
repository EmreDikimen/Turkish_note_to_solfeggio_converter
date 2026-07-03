"""
Rung 1.5 (part 2 prep) — stage the browser-gate assets into apps/web/public/models/.

The gate page (apps/web/omr-gate.html + src/omrGate.ts) needs, all same-origin (the product
premise is offline/no-server, so nothing is fetched from a CDN):
  - the int8 ONNX graphs (encoder / decoder / decoder_with_past),
  - gate.json: decode constants (start/eos ids), the id→token table (from tokenizer.json),
    and per-strip ground truth (label token ids to compare against),
  - each gate strip's PNG (input for the JS canvas preprocessing), and
  - each strip's REFERENCE pixel_values tensor (.bin, float32 CHW) — Python's exact
    preprocessing output. The page decodes BOTH tensors; if the reference passes and the
    canvas one fails, the bug is in the JS preprocessing, not in onnxruntime-web.

Everything under public/models/ is gitignored (hundreds of MB; HF Hub CDN hosting is the
later product path).

Run (after onnx_parity.py passes):
    .venv-ml/bin/python src/vision/make_browser_gate.py
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data import StripDataset
from onnx_parity import pick_samples

ONNX_FILES = ["encoder_model", "decoder_model", "decoder_with_past_model"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--checkpoint", default="data/checkpoints/overfit10")
    ap.add_argument("--onnx-dir", default="data/checkpoints/overfit10-onnx")
    ap.add_argument("--strips-dir", default="data/synthetic/strips")
    ap.add_argument("--out", default="apps/web/public/models")
    ap.add_argument("--suffix", default="_int8")
    ap.add_argument("--n", type=int, default=3)
    args = ap.parse_args()

    from transformers import AutoProcessor

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    processor = AutoProcessor.from_pretrained(args.checkpoint)
    tok = processor.tokenizer

    for name in ONNX_FILES:
        src = Path(args.onnx_dir) / f"{name}{args.suffix}.onnx"
        shutil.copy(src, out / f"{name}.onnx")
        print(f"copied {src.name} -> {out / f'{name}.onnx'} ({src.stat().st_size / 1e6:.0f} MB)")

    ds = StripDataset(args.strips_dir)
    gate_names = (Path(args.checkpoint) / "GATE_STRIPS.txt").read_text().split()
    chosen = pick_samples(ds, gate_names, args.n)

    strips = []
    for i in chosen:
        image, label = ds[i]
        s = ds.strips[i]
        shutil.copy(s.image_path, out / s.image_path.name)
        pv = processor(images=image, return_tensors="np").pixel_values[0]  # (3, 583, 409) f32
        bin_name = s.image_path.stem + ".pixels.bin"
        (out / bin_name).write_bytes(pv.astype("float32").tobytes())
        strips.append(
            {
                "image": s.image_path.name,
                "pixels": bin_name,
                "pixelsShape": list(pv.shape),
                "label": label,
                "labelIds": tok(label).input_ids,  # content ids, no specials (tokenizer adds none)
            }
        )
        print(f"staged {s.image_path.name} (label {len(strips[-1]['labelIds'])} ids)")

    from transformers import VisionEncoderDecoderModel

    start_id = VisionEncoderDecoderModel.from_pretrained(args.checkpoint).config.decoder_start_token_id
    gate = {
        "startId": start_id,
        "eosId": tok.eos_token_id,
        # id → token string, display only (comparison happens in id space, like the Python side)
        "id2token": {str(i): tok.convert_ids_to_tokens(i) for i in range(len(tok))},
        "preprocess": processor.image_processor.to_dict(),
        "strips": strips,
    }
    (out / "gate.json").write_text(json.dumps(gate, indent=1))
    print(f"wrote {out / 'gate.json'} (startId={start_id}, eosId={tok.eos_token_id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
