"""
Rung 1.5 (part 1) — ONNX parity check for the exported `omr_transformer` gate checkpoint.

WHAT: run the same strips through (a) PyTorch `generate` on the overfit-10 checkpoint and
(b) a HAND-ROLLED greedy decode over the exported ONNX graphs (encoder → first-step decoder →
decoder-with-past loop), and require IDENTICAL token ids.

WHY: the browser gate (Rung 1.5 part 2) re-implements this exact loop in JS over
`onnxruntime-web`. Checking parity in Python first isolates "the export is broken" from
"my JS is broken" — and this file doubles as the reference the JS port mirrors line-for-line.

Export first (optimum-onnx):
    .venv-ml/bin/optimum-cli export onnx --model data/checkpoints/overfit10 \
        --task image-to-text-with-past data/checkpoints/overfit10-onnx

Run:
    .venv-ml/bin/python src/vision/onnx_parity.py                # fp32 graphs
    .venv-ml/bin/python src/vision/onnx_parity.py --suffix _int8 # quantized graphs
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data import ADDED_TOKENS, StripDataset, strip_special

MAX_TOKENS = 100  # matches overfit10.py's judgement generate(max_length=100)


def onnx_greedy_decode(
    sessions, pixel_values: np.ndarray, start_id: int, eos_id: int, return_logprobs: bool = False
):
    """
    The reference greedy loop (ported to JS in apps/web/src/omrGate.ts):
      1. encoder once: pixel_values → encoder_hidden_states
      2. step 0: decoder_model(input_ids=[start], encoder_hidden_states) → logits + present.*
         (present.* includes the ENCODER cross-attention K/V — computed once, reused forever)
      3. steps 1..N: decoder_with_past(input_ids=[last token], past_key_values.*) → logits +
         present.*.decoder.* (only the decoder self-attention cache grows; the encoder entries
         are carried over unchanged)
      4. argmax(logits) each step; stop on </s> or MAX_TOKENS.
    Returns (generated ids incl. eos, encoder_ms, decode_ms); with `return_logprobs=True`, a
    4th element — each chosen token's log-probability (softmax over that step's logits). The
    chosen ids are argmax either way: the flag only ADDS the confidence readout (Rung-3
    emitter review columns + the Step-5 triage), it can never change the decode.
    """
    encoder, decoder, decoder_wp = sessions

    t0 = time.perf_counter()
    (enc_hidden,) = encoder.run(None, {"pixel_values": pixel_values})
    t1 = time.perf_counter()

    out_names = [o.name for o in decoder.get_outputs()]
    outs = decoder.run(
        None,
        {"input_ids": np.array([[start_id]], np.int64), "encoder_hidden_states": enc_hidden},
    )
    by_name = dict(zip(out_names, outs))
    past = {
        n.replace("present.", "past_key_values."): v
        for n, v in by_name.items()
        if n.startswith("present.")
    }

    ids: list[int] = []
    logprobs: list[float] = []
    wp_out_names = [o.name for o in decoder_wp.get_outputs()]
    logits = by_name["logits"]
    while True:
        row = logits[0, -1]
        tok = int(np.argmax(row))
        ids.append(tok)
        if return_logprobs:
            # logprob(tok) = row[tok] − logsumexp(row); row[tok] is the max (argmax), so this
            # reduces to −log Σ exp(row − max) — numerically stable by construction.
            logprobs.append(-float(np.log(np.sum(np.exp(row - row[tok])))))
        if tok == eos_id or len(ids) >= MAX_TOKENS:
            break
        feed = {"input_ids": np.array([[tok]], np.int64), **past}
        outs = decoder_wp.run(None, feed)
        by_name = dict(zip(wp_out_names, outs))
        logits = by_name["logits"]
        for n, v in by_name.items():  # only .decoder.* entries are re-emitted; encoder K/V persist
            if n.startswith("present."):
                past[n.replace("present.", "past_key_values.")] = v
    t2 = time.perf_counter()
    if return_logprobs:
        return ids, (t1 - t0) * 1000, (t2 - t1) * 1000, logprobs
    return ids, (t1 - t0) * 1000, (t2 - t1) * 1000


def pick_samples(ds: StripDataset, names: list[str], n: int) -> list[int]:
    """From the gate strips, cover the features that matter: a `\\sig` block, an explicit AEU
    accidental, and one more."""
    idx = [i for i, s in enumerate(ds.strips) if s.image_path.name in names]
    chosen: list[int] = []

    def grab(pred):
        for i in idx:
            if i not in chosen and pred(ds.strips[i]):
                chosen.append(i)
                return

    grab(lambda s: "\\sig" in s.label)
    grab(lambda s: any(t in s.label for t in ADDED_TOKENS[:8]) and "\\sig" not in s.label)
    for i in idx:
        if len(chosen) >= n:
            break
        if i not in chosen:
            chosen.append(i)
    return chosen[:n]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--checkpoint", default="data/checkpoints/overfit10")
    ap.add_argument("--onnx-dir", default="data/checkpoints/overfit10-onnx")
    ap.add_argument("--strips-dir", default="data/synthetic/strips")
    ap.add_argument("--suffix", default="", help="e.g. _int8 to test quantized graphs")
    ap.add_argument("--n", type=int, default=3)
    args = ap.parse_args()

    import onnxruntime as ort
    import torch
    from transformers import AutoProcessor, VisionEncoderDecoderModel

    processor = AutoProcessor.from_pretrained(args.checkpoint)
    tok = processor.tokenizer
    model = VisionEncoderDecoderModel.from_pretrained(args.checkpoint).eval()  # cpu: deterministic
    start_id = model.config.decoder_start_token_id
    eos_id = tok.eos_token_id

    onnx_dir = Path(args.onnx_dir)
    sessions = tuple(
        ort.InferenceSession(str(onnx_dir / f"{name}{args.suffix}.onnx"))
        for name in ("encoder_model", "decoder_model", "decoder_with_past_model")
    )

    ds = StripDataset(args.strips_dir)
    gate_names = (Path(args.checkpoint) / "GATE_STRIPS.txt").read_text().split()
    chosen = pick_samples(ds, gate_names, args.n)

    print(f"== parity: PyTorch generate vs ONNX greedy ({args.suffix or 'fp32'}), {len(chosen)} strips\n")
    n_ok = 0
    for i in chosen:
        image, label = ds[i]
        pixel_values = processor(images=image, return_tensors="pt").pixel_values

        with torch.no_grad():
            pt_out = model.generate(pixel_values, max_length=MAX_TOKENS)[0].tolist()
        if pt_out and pt_out[0] == start_id:
            pt_out = pt_out[1:]

        onnx_out, enc_ms, dec_ms = onnx_greedy_decode(
            sessions, pixel_values.numpy(), start_id, eos_id
        )

        pt_ids = strip_special(pt_out, tok)
        onnx_ids = strip_special(onnx_out, tok)
        want_ids = strip_special(tok(label).input_ids, tok)
        match_pt = onnx_ids == pt_ids
        match_gt = onnx_ids == want_ids
        n_ok += match_pt and match_gt
        name = ds.strips[i].image_path.name
        print(f"  {'✓' if match_pt and match_gt else '✗'} {name}"
              f"  (onnx==pytorch: {match_pt}, onnx==label: {match_gt};"
              f" encoder {enc_ms:.0f} ms, decode {dec_ms:.0f} ms, {len(onnx_ids)} tokens)")
        if not (match_pt and match_gt):
            print(f"      label  : {label}")
            print(f"      pytorch: {tok.decode(pt_out, skip_special_tokens=True).strip()}")
            print(f"      onnx   : {tok.decode(onnx_out, skip_special_tokens=True).strip()}")

    ok = n_ok == len(chosen)
    print(f"\n== RESULT: {n_ok}/{len(chosen)} exact  →  {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
