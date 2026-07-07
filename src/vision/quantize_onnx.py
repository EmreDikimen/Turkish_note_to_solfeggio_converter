"""
int8 dynamic quantization of the exported ONNX graphs (Rung 1.5 / Rung-2 export, part 1b).

WHAT: `quantize_dynamic` (weights stored int8, activations quantized at runtime) over the
three graphs the browser loads — encoder / decoder / decoder-with-past — writing
`{name}_int8.onnx` next to the fp32 originals. At Rung 1.5 this took the shipped total from
~830 MB fp32 to ~221 MB, the size that makes CDN-served in-browser inference viable.

WHY a script: the Rung-1.5 quantization was a one-off manual command that never got
committed; this pins the exact settings so the Rung-2 (and any later) export is reproducible.
Parity of the quantized graphs is judged by `onnx_parity.py --suffix _int8` in id space —
run it after this.

Export first (optimum-onnx), then:
    .venv-ml/bin/python src/vision/quantize_onnx.py --onnx-dir data/checkpoints/rung2-best-onnx
"""

from __future__ import annotations

import argparse
from pathlib import Path

GRAPHS = ("encoder_model", "decoder_model", "decoder_with_past_model")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--onnx-dir", default="data/checkpoints/rung2-best-onnx")
    args = ap.parse_args()

    from onnxruntime.quantization import QuantType, quantize_dynamic

    onnx_dir = Path(args.onnx_dir)
    for name in GRAPHS:
        src = onnx_dir / f"{name}.onnx"
        dst = onnx_dir / f"{name}_int8.onnx"
        quantize_dynamic(src, dst, weight_type=QuantType.QInt8)
        print(f"  {name}: {src.stat().st_size / 1e6:.0f} MB -> {dst.stat().st_size / 1e6:.0f} MB")
    return 0


if __name__ == "__main__":
    main()
