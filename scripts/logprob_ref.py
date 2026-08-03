"""Reference per-token logprobs for the browser confidence check (MVP W1).

The browser now returns a log-probability per decoded token (`apps/web/src/omr/decode.ts`), which
is what the app will use to show a user WHERE to look (ROADMAP §0) and what W8 turns into measure
highlighting. Before anything is built on those numbers they have to be shown correct, and the
browser gate hands us a clean way to do it: its "reference" arm decodes Python's own
`.pixels.bin` tensors, so the two sides consume BIT-IDENTICAL input and any difference is the
arithmetic, not the image pipeline.

This dumps the Python side for all 14 gate strips. Compare with `npm run check:logprobs`.

    .venv-ml/bin/python scripts/logprob_ref.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "vision"))
from onnx_parity import onnx_greedy_decode  # noqa: E402

MODELS = Path("apps/web/public/models")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=str(MODELS), help="dir holding gate.json + the .onnx graphs")
    ap.add_argument("--out", default="apps/web/public/probe/logprobs_ref.json")
    args = ap.parse_args()

    models = Path(args.models)
    gate = json.loads((models / "gate.json").read_text())

    # The browser loads these same three graphs from /models/ — no suffix, they are already int8.
    sessions = tuple(
        ort.InferenceSession(str(models / f"{name}.onnx"))
        for name in ("encoder_model", "decoder_model", "decoder_with_past_model")
    )

    out: dict[str, dict] = {}
    for s in gate["strips"]:
        pv = np.fromfile(models / s["pixels"], dtype=np.float32).reshape([1] + list(s["pixelsShape"]))
        ids, _, _, logprobs = onnx_greedy_decode(
            sessions, pv, gate["startId"], gate["eosId"], return_logprobs=True
        )
        out[s["image"]] = {"ids": ids, "logprobs": logprobs}
        print(f"{s['image'][:60]:62s} {len(ids):3d} ids  min {min(logprobs):.4f}")

    dest = Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out))
    print(f"\nwrote {dest} ({len(out)} strips)")


if __name__ == "__main__":
    main()
