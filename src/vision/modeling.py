"""
Shared model/tokenizer plumbing for the Rung-2 training + eval scripts (Phase 2).

This is the exact setup PROVEN by the Rung-1 overfit-10 gate (`overfit10.py`) — factored out
so `train.py` and `eval_omr.py` cannot drift apart on the wiring details the gate debugged:
the manually-appended EOS, generation stopping on the real `</s>` instead of the base model's
"." stop symbol, the explicit decoder_start/pad ids, and the tokenizer_config sanitization
needed to reload a saved checkpoint. (overfit10.py keeps its own inline copy: it is a passed,
logged gate — not worth reopening.)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data import vocabulary

MODEL_ID = "Flova/omr_transformer"


def load_model_and_processor(source: str = MODEL_ID, scheme: str = "old"):
    """
    Load model + processor from the HF hub id or a checkpoint dir, extend the tokenizer with
    the project's tokens, and fix the generation config.

    Returns (model, processor, added): `added` is how many tokens were new — the whole vocabulary
    when `source` is the pretrained base, 0 when it is an already-extended checkpoint at the SAME
    scheme (the embedding resize is skipped, so a checkpoint's trained embeddings are never
    touched).

    ⚠ `scheme` picks the vocabulary (`data.vocabulary`): `old` is every checkpoint through Round 3,
    `h` appends Round 4's note spelling. It defaults to `old` so that every existing caller — and
    every existing checkpoint — keeps loading with `added == 0`; only the Round-4 H arm passes `h`,
    and for it `added` is 16 on a Round-3 checkpoint, which is a real resize and not the "this is
    the base model" signal that `paired_arm_score` checks for.
    """
    from transformers import AutoProcessor, VisionEncoderDecoderModel

    processor = AutoProcessor.from_pretrained(source)
    model = VisionEncoderDecoderModel.from_pretrained(source)
    tok = processor.tokenizer

    added = tok.add_tokens(vocabulary(scheme))
    if added:
        model.decoder.resize_token_embeddings(len(tok))

    # VisionEncoderDecoder builds decoder_input_ids from `labels` by shifting right, starting
    # from decoder_start_token_id; generate() needs the same ids. Make them explicit.
    if model.config.decoder_start_token_id is None:
        model.config.decoder_start_token_id = tok.bos_token_id
    model.config.pad_token_id = tok.pad_token_id
    model.generation_config.pad_token_id = tok.pad_token_id
    # The base model's pretraining used a literal "." (id 2) as its stop symbol. We fine-tune
    # with the REAL </s> as the terminator, so generation must stop on that — otherwise
    # generate() skips past our (correctly predicted) </s> and free-runs (Rung-1 finding).
    model.generation_config.eos_token_id = tok.eos_token_id
    model.generation_config.forced_eos_token_id = None
    return model, processor, added


def save_model(save_dir: str | Path, model, processor) -> None:
    """save_pretrained for both, plus the tokenizer_config fix so the dir actually reloads."""
    save_dir = Path(save_dir)
    model.save_pretrained(save_dir)
    processor.save_pretrained(save_dir)  # carries the extended tokenizer
    # transformers writes a tokenizer_config.json it can't reload (internal class name
    # "TokenizersBackend"; extra_special_tokens saved as a list where a dict is expected).
    # Sanitize so AutoProcessor.from_pretrained(save_dir) works. (Same fix as overfit10.py.)
    tc_path = save_dir / "tokenizer_config.json"
    if tc_path.exists():
        tc = json.loads(tc_path.read_text())
        tc["tokenizer_class"] = "PreTrainedTokenizerFast"
        tc.pop("extra_special_tokens", None)
        tc_path.write_text(json.dumps(tc, indent=2))
