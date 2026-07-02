"""
Rung 1 — the overfit-10 GO/NO-GO gate for `Flova/omr_transformer` (Phase 2).

WHAT: fine-tune the full model on just 10 of our synthetic strips until it reproduces their
labels EXACTLY, microtonal accidentals and `\\sig` blocks included.

WHY: a 143M-parameter model can trivially memorize 10 images — so if this fails, the model
isn't the problem, the WIRING is (image preprocessing, tokenizer extension, label alignment,
loss masking, decoding). This converts "silent bug that wastes a week of Colab time" into
"loud failure on the Mac in under an hour". The overfitted checkpoint is a THROWAWAY
diagnostic — the real training run restarts from the original pretrained weights.

NOTE on coverage: only the accidentals present in the current sample scores appear here
(e.g. koma/küçük flats). That's fine for THIS gate — every added token goes through the same
mechanism (add_tokens → resized embeddings → softmax), so proving one proves the path. Full
8-accidental coverage is a Rung-2 entry requirement (more scores + chromatic transpositions).

Decision rule (docs/PHASE2.md §5): 10/10 exact match → GO (keep omr_transformer, next is the
Rung-1.5 ONNX/browser gate); anything less after debugging → NO-GO (pivot to CRNN+CTC).

Run:
    .venv-ml/bin/python src/vision/overfit10.py                  # defaults: n=10 steps=400 lr=1e-4
    .venv-ml/bin/python src/vision/overfit10.py --steps 600      # give it longer if loss still high
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # allow `import data` when run as a script

from data import ADDED_TOKENS, StripDataset, check_token_drift, collate, strip_special

MODEL_ID = "Flova/omr_transformer"
EVAL_MD = Path(__file__).with_name("MODEL_EVAL.md")


def pick_samples(ds: StripDataset, n: int, seed: int = 7) -> list[int]:
    """
    Choose n strips deterministically, with deliberate coverage of everything the label format
    can contain: keysig strips (the `\\sig … \\sigend` prefix), explicit AEU accidentals, the
    rare `\\natural` cancels, rests, and dotted durations. A random 10 could miss the very
    features this gate exists to test.
    """
    rng = random.Random(seed)
    idx = list(range(len(ds)))

    picked: set[int] = set()

    def grab(pred, k):
        got = [i for i in idx if pred(ds.strips[i])]
        rng.shuffle(got)
        for i in got:
            if k <= 0:
                break
            if i not in picked:
                picked.add(i)
                k -= 1

    grab(lambda s: "\\natural" in s.label, 1)                      # the rarest feature first
    grab(lambda s: s.mode == "keysig", 3)                          # \sig prefixes
    grab(lambda s: any(t in s.label for t in ADDED_TOKENS[:8]), 2) # explicit AEU accidentals
    grab(lambda s: "r" in s.label.split(), 1)                      # a rest
    grab(lambda s: "." in s.label, 1)                              # dotted duration
    grab(lambda s: True, max(0, n - len(picked)))                  # fill the rest randomly
    return sorted(picked)[:n]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--steps", type=int, default=400)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--batch-size", type=int, default=5)
    ap.add_argument("--strips-dir", default="data/synthetic/strips")
    ap.add_argument("--device", default=None, help="mps | cpu (default: mps if available)")
    args = ap.parse_args()

    import torch
    from transformers import AutoProcessor, VisionEncoderDecoderModel

    device = args.device or ("mps" if torch.backends.mps.is_available() else "cpu")
    torch.manual_seed(7)

    # ---- 1. data ---------------------------------------------------------------------------
    ds = StripDataset(args.strips_dir)
    check_token_drift(ds)  # fail loudly if lilypond.ts grew tokens this file doesn't know
    chosen = pick_samples(ds, args.n)
    print(f"== {len(chosen)} strips chosen (of {len(ds)}), device={device}\n")
    for i in chosen:
        s = ds.strips[i]
        print(f"  [{s.mode:6}] {s.image_path.name}\n           {s.label}")

    # ---- 2. model + tokenizer extension ----------------------------------------------------
    print(f"\n== loading {MODEL_ID} ...")
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID)
    tok = processor.tokenizer

    added = tok.add_tokens(ADDED_TOKENS)
    model.decoder.resize_token_embeddings(len(tok))
    # VisionEncoderDecoder builds decoder_input_ids from `labels` by shifting right, starting
    # from decoder_start_token_id; generate() needs the same ids. Make them explicit.
    if model.config.decoder_start_token_id is None:
        model.config.decoder_start_token_id = tok.bos_token_id
    model.config.pad_token_id = tok.pad_token_id
    model.generation_config.pad_token_id = tok.pad_token_id
    # The base model's pretraining used a literal "." (id 2) as its stop symbol:
    # generation_config ships with eos_token_id=2 and forced_eos_token_id=2. We fine-tune
    # with the REAL </s> as the terminator, so generation must stop on that — otherwise
    # generate() skips right past our (correctly predicted) </s> and free-runs until it
    # happens to emit a "." (observed: perfect prefix + junk tail ending in " .").
    model.generation_config.eos_token_id = tok.eos_token_id
    model.generation_config.forced_eos_token_id = None
    print(f"   vocab: +{added} tokens -> {len(tok)} ids; decoder embeddings resized")
    print(f"   generation: eos re-pointed to </s> (id {tok.eos_token_id}); forced_eos off")

    # ---- 3. tokenizer sanity (BEFORE training) ----------------------------------------------
    # If any added token weren't atomic, encoding would shred it into <unk>/chars and training
    # would optimize toward garbage. Comparisons happen in ID space (see data.strip_special:
    # this tokenizer's string decode drops spaces around added tokens, but ids are stable —
    # re-encoding a decoded string reproduces the identical ids). Prove both properties first.
    print("\n== tokenizer sanity check (id-space round-trip)")
    for i in chosen:
        label = ds.strips[i].label
        ids = tok(label, add_special_tokens=True).input_ids
        if tok.unk_token_id in ids:
            print(f"   FAIL {ds.strips[i].image_path.name}: <unk> in encoded label\n     {label}")
            return 1
        back = tok.decode(ids, skip_special_tokens=True).strip()
        re_ids = tok(back, add_special_tokens=True).input_ids
        if re_ids != ids:
            print(f"   FAIL {ds.strips[i].image_path.name}: ids unstable under decode/re-encode")
            print(f"     label : {label}\n     decode: {back}")
            return 1
    example = ds.strips[chosen[0]].label
    print(f"   ok — no <unk>, ids stable. e.g. {example[:48]!r} -> ids {tok(example).input_ids[:12]} ...")

    # ---- 4. train (full fine-tune, nothing frozen) -------------------------------------------
    # Plain PyTorch loop so every mechanic is visible: the forward pass returns the
    # teacher-forced cross-entropy loss (the decoder sees the gold prefix and predicts each
    # next token); backward computes gradients; AdamW updates ALL weights (freezing is only
    # ever a memory fallback — see ROADMAP Phase 3).
    samples = [ds[i] for i in chosen]
    model.to(device).train()
    optim = torch.optim.AdamW(model.parameters(), lr=args.lr)
    print(f"\n== training: {args.steps} steps, lr={args.lr}, batch={args.batch_size}")
    step = 0
    while step < args.steps:
        random.Random(step).shuffle(samples)
        for at in range(0, len(samples), args.batch_size):
            if step >= args.steps:
                break
            pixel_values, labels = collate(samples[at : at + args.batch_size], processor, tok)
            loss = model(pixel_values=pixel_values.to(device), labels=labels.to(device)).loss
            optim.zero_grad()
            loss.backward()
            optim.step()
            step += 1
            if step == 1 or step % 20 == 0:
                print(f"   step {step:4d}  loss {loss.item():.4f}")

    # ---- 5. judge: generate and compare EXACTLY (in id space) --------------------------------
    print("\n== judgement (generate vs. ground truth, exact token-id match)")
    model.eval()
    n_ok = 0
    with torch.no_grad():
        for i in chosen:
            image, label = ds[i]
            want = strip_special(tok(label, add_special_tokens=True).input_ids, tok)
            pixel_values = processor(images=image, return_tensors="pt").pixel_values.to(device)
            out = model.generate(pixel_values, max_length=100)
            got_ids = out[0].tolist()
            # generate() seeds the decoder with decoder_start_token_id — not part of the label.
            if got_ids and got_ids[0] == model.config.decoder_start_token_id:
                got_ids = got_ids[1:]
            got = strip_special(got_ids, tok)
            ok = got == want
            n_ok += ok
            print(f"   {'✓' if ok else '✗'} {ds.strips[i].image_path.name}")
            if not ok:
                text = tok.decode(out[0], skip_special_tokens=True).strip()
                print(f"     want: {label}\n     got : {text}")

    go = n_ok == len(chosen)
    verdict = (
        "GO — keep omr_transformer (next: Rung 1.5 ONNX/browser gate)"
        if go
        else "NOT YET — debug the wiring (or pivot to CRNN+CTC if it persists)"
    )
    print(f"\n== RESULT: {n_ok}/{len(chosen)} exact  →  {verdict}")

    # ---- 6. record in MODEL_EVAL.md -----------------------------------------------------------
    lines = [
        "",
        f"## Rung 1 — overfit-10 result ({date.today().isoformat()})",
        f"- {n_ok}/{len(chosen)} strips reproduced exactly after {args.steps} steps "
        f"(lr={args.lr}, full fine-tune, batch={args.batch_size}, device={device}).",
        f"- Verdict: {verdict}",
    ]
    with EVAL_MD.open("a") as f:
        f.write("\n".join(lines) + "\n")
    print(f"[appended] {EVAL_MD}")
    return 0 if go else 1


if __name__ == "__main__":
    sys.exit(main())
