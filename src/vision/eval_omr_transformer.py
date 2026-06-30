"""
Step-1 model gate (Phase 2): evaluate the lead pretrained OMR candidate `Flova/omr_transformer`.

WHAT this answers (the four questions that decide whether we build the pipeline on this model):
  1. Does it read Western notation?  -> run it on the repo's own sample staves, print the output.
  2. What is its exact output format? -> inspect decoder config + decoded text (LilyPond tokens).
  3. How do we extend its vocab?      -> demonstrate add_tokens + resize_token_embeddings.
  4. Is the size mobile/ONNX-viable?  -> count params + estimate fp32 / int8 footprint.

WHY a script (not notes): the answers must come from the real downloaded weights, not assumptions.
Run (full report on the repo's own sample staves, writes MODEL_EVAL.md):
    .venv-ml/bin/python src/vision/eval_omr_transformer.py

Check the model on YOUR OWN image(s) (just prints the LilyPond it reads; no MODEL_EVAL.md rewrite):
    .venv-ml/bin/python src/vision/eval_omr_transformer.py path/to/staff.png [more.png ...]
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

MODEL_ID = "Flova/omr_transformer"
OUT_MD = Path(__file__).with_name("MODEL_EVAL.md")
SAMPLES = ["sample1.png", "sample2.png", "sample3.png"]


def transcribe(model, processor, image) -> str:
    """Run the model on one PIL image and return the decoded LilyPond string."""
    import torch

    pixel_values = processor(images=image, return_tensors="pt").pixel_values
    with torch.no_grad():
        generated = model.generate(
            pixel_values,
            max_length=getattr(model.generation_config, "max_length", 256) or 256,
        )
    return processor.batch_decode(generated, skip_special_tokens=True)[0]


def run_on_paths(paths: list[str]) -> int:
    """Manual-check mode: transcribe user-supplied image files and print the result."""
    from PIL import Image
    from transformers import AutoProcessor, VisionEncoderDecoderModel

    print(f"Loading {MODEL_ID} ...")
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID)
    model.eval()
    for p in paths:
        try:
            image = Image.open(p).convert("RGB")
            print(f"\n{p}  ({image.size[0]}x{image.size[1]})\n  -> {transcribe(model, processor, image)}")
        except Exception as e:  # noqa: BLE001
            print(f"\n{p}  -> FAILED: {e!r}")
    return 0


def main() -> int:
    import torch
    from huggingface_hub import hf_hub_download
    from PIL import Image
    from transformers import AutoProcessor, VisionEncoderDecoderModel

    log: list[str] = []

    def out(line: str = "") -> None:
        print(line)
        log.append(line)

    out(f"# Step-1 model evaluation — `{MODEL_ID}`")
    out()

    # --- load -----------------------------------------------------------------
    out("Loading processor + model (downloads weights on first run)...")
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID)
    model.eval()
    tok = processor.tokenizer

    cfg = model.config
    enc = cfg.encoder
    dec = cfg.decoder

    # --- Q4: size -------------------------------------------------------------
    n_params = sum(p.numel() for p in model.parameters())
    fp32_mb = n_params * 4 / 1e6
    int8_mb = n_params * 1 / 1e6
    out()
    out("## Size (Q4 — mobile / ONNX viability)")
    out(f"- Parameters: **{n_params/1e6:.1f}M**")
    out(f"- Footprint: ~**{fp32_mb:.0f} MB** fp32, ~**{int8_mb:.0f} MB** int8-quantized")
    out(f"- Encoder: `{enc.model_type}`  |  Decoder: `{dec.model_type}`")
    img_size = getattr(enc, "image_size", None)
    out(f"- Encoder input image size: `{img_size}`")

    # --- Q2: output format ----------------------------------------------------
    out()
    out("## Output format & tokenizer (Q2 + Q3)")
    out(f"- Tokenizer class: `{tok.__class__.__name__}`")
    out(f"- Vocab size: **{tok.vocab_size}** (+ {len(tok.get_added_vocab())} added tokens)")
    out(f"- Decoder max_length (generation): `{getattr(cfg, 'max_length', None) or getattr(model.generation_config, 'max_length', None)}`")
    specials = {k: v for k, v in tok.special_tokens_map.items()}
    out(f"- Special tokens: `{specials}`")

    # --- Q1: does it read notation? run on the repo's own samples -------------
    out()
    out("## Reading test (Q1 — run on the model's own sample staves)")
    for name in SAMPLES:
        try:
            path = hf_hub_download(MODEL_ID, name)
            image = Image.open(path).convert("RGB")
            pixel_values = processor(images=image, return_tensors="pt").pixel_values
            with torch.no_grad():
                generated = model.generate(
                    pixel_values,
                    max_length=getattr(model.generation_config, "max_length", 256) or 256,
                )
            text = processor.batch_decode(generated, skip_special_tokens=True)[0]
            out(f"- **{name}** ({image.size[0]}x{image.size[1]}) -> `{text[:200]}`")
        except Exception as e:  # noqa: BLE001 - report, don't crash the whole eval
            out(f"- **{name}** -> FAILED: {e!r}")

    # --- Q3: demonstrate extending the vocabulary -----------------------------
    out()
    out("## Vocab-extension mechanism (Q3 — proof it works)")
    new_tokens = [
        "<koma_sharp>", "<koma_flat>", "<bakiye_sharp>", "<bakiye_flat>",
        "<kucuk_sharp>", "<kucuk_flat>", "<buyuk_sharp>", "<buyuk_flat>",
    ]
    before = len(tok)
    added = tok.add_tokens(new_tokens)
    model.decoder.resize_token_embeddings(len(tok))
    after = len(tok)
    out(f"- Added {added} microtonal tokens via `tokenizer.add_tokens(...)`: {before} -> {after} ids.")
    out(f"- `model.decoder.resize_token_embeddings({after})` succeeded -> the head can predict them.")
    out("- => fine-tuning to recognize the AEU accidentals is wired-supportable on this model.")

    out()
    out("## Verdict")
    out("- See the reading test above: if the LilyPond output tracks the sample staves, Q1 passes.")
    out("- Output format = LilyPond token stream (Q2). Vocab is extendable (Q3).")
    out(f"- Size ~{n_params/1e6:.0f}M params (Q4) — note for the mobile/ONNX budget.")

    OUT_MD.write_text("\n".join(log) + "\n")
    print(f"\n[written] {OUT_MD}")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(run_on_paths(args) if args else main())
