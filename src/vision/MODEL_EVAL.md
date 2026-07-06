# Step-1 model evaluation — `Flova/omr_transformer`

Loading processor + model (downloads weights on first run)...

## Size (Q4 — mobile / ONNX viability)
- Parameters: **143.0M**
- Footprint: ~**572 MB** fp32, ~**143 MB** int8-quantized
- Encoder: `donut-swin`  |  Decoder: `mbart`
- Encoder input image size: `[583, 409]`

## Output format & tokenizer (Q2 + Q3)
- Tokenizer class: `TokenizersBackend`
- Vocab size: **54** (+ 22 added tokens)
- Decoder max_length (generation): `60`
- Special tokens: `{'bos_token': '<s>', 'eos_token': '</s>', 'unk_token': '<unk>', 'pad_token': '<pad>'}`

## Reading test (Q1 — run on the model's own sample staves)
- **sample1.png** (640x480) -> `c'2 a''8 c''8 r4 c'1 e'8 c'8 c'8 a''8 f'4 a'8 c'8 .`
- **sample2.png** (583x409) -> `\key a \minor d'8 g'8 c''8 a'8 d'2 c'8 f''8 d'4 c''4 e'8 r8 g'8 b'8 e'8 g'8 d'2 .`
- **sample3.png** (640x480) -> `g'4 c'4 r8 f''8 e'8 d'8 r8 c'8 c'2 a'2 b'4 r4 a'8 r8 .`

## Vocab-extension mechanism (Q3 — proof it works)
- Added 8 microtonal tokens via `tokenizer.add_tokens(...)`: 75 -> 83 ids.
- `model.decoder.resize_token_embeddings(83)` succeeded -> the head can predict them.
- => fine-tuning to recognize the AEU accidentals is wired-supportable on this model.

## Verdict
- See the reading test above: if the LilyPond output tracks the sample staves, Q1 passes.
- Output format = LilyPond token stream (Q2). Vocab is extendable (Q3).
- Size ~143M params (Q4) — note for the mobile/ONNX budget.




## Rung 1 — overfit-10 result (2026-07-02)
- 10/10 strips reproduced exactly after 400 steps (lr=0.0001, full fine-tune, batch=5, device=mps).
- Final training loss **0.0004** (started at ~4.44 ≈ ln(88), i.e. uniform over the 88-token vocab;
  ~0.05 by step 100). Note: on 10 samples a near-zero loss only proves memorization + correct
  wiring — that is all this gate tests; generalization is Rung 2's job.
- Verdict: **GO** — keep omr_transformer (next: Rung 1.5 ONNX/browser gate).
- Two wiring bugs caught and fixed by this gate (the reason it exists): (1) the tokenizer adds
  no EOS, so labels must append `</s>` manually or generation can't stop; (2) the base model's
  generation_config stops on a literal "." (id 2) instead of `</s>` — re-pointed for our labels.

## Base-vocab note on repeats (2026-07-02)
- Full vocab dumped (75 ids): it DOES contain structural `\repeat ` (57) and `volta ` (58) tokens,
  but **no braces, no `\alternative`, and no barline `|`** — so LilyPond's structural repeat form
  can't be spelled, and it couldn't label a crop showing only one end of a repeat anyway.
- Decision: add 4 faithful drawn-symbol tokens `\repstart` `\repend` `\volta1` `\volta2` to
  `ADDED_TOKENS` (same mechanism as the accidentals; `|` is likewise ours, not the base model's).

## Rung 1 — overfit-10 result (2026-07-03)
- 10/10 strips reproduced exactly after 400 steps (lr=0.0001, full fine-tune, batch=5, device=mps).
- Verdict: GO — keep omr_transformer (next: Rung 1.5 ONNX/browser gate)
  (Re-run of the 2026-07-02 gate, unchanged settings — done to SAVE the overfitted checkpoint
  via the new `--save-dir` as the Rung-1.5 gate model: it reproduces known labels, so the
  browser decode has an exact expected output. Still a throwaway: Rung 2 restarts from the
  original pretrained weights.)

## Rung 1.5 — ONNX/browser gate (2026-07-03): PASS
The product premise — in-browser, no-server inference of an autoregressive encoder-decoder —
is now proven end-to-end. Chain: `optimum-cli export onnx --task image-to-text-with-past` →
int8 dynamic quantization → `onnxruntime-web` (wasm EP, threaded) with a hand-rolled greedy
loop in JS, in a real (headless Chromium) browser.

- **Export:** encoder / decoder / decoder-with-past graphs; optimum's own validation max diff
  ≤ 4.5e-5 on logits (fp32).
- **Python parity** (`src/vision/onnx_parity.py`): ONNX greedy decode == PyTorch `generate`
  == ground-truth label ids, 3/3 strips, **fp32 AND int8**. int8 sizes: encoder 311→91 MB,
  decoder 276→69 MB, decoder-with-past 242→61 MB (**221 MB total** to ship, vs ~830 MB fp32).
- **Browser** (`apps/web/omr-gate.html` + `src/omrGate.ts`; assets staged by
  `src/vision/make_browser_gate.py`): 3/3 strips decode to their exact label ids — via BOTH
  Python's reference pixel tensors and live canvas preprocessing (the DonutImageProcessor
  port: rotate 90° CW → shortest-edge 409 → thumbnail-fit 409×583 → center-pad black →
  [−1, 1] normalize). So the JS preprocessing is exact, not just close.
- **Latency (M-series Mac, int8, wasm threads):** session load ~2.9 s (local files);
  per strip ~0.8–1.3 s encoder + ~0.23–0.31 s greedy decode (40–56 tokens) ≈ **~1.5 s/strip**.
  Usable for the product flow (a photo has a handful of strips, decodable in parallel or
  with a progress bar). WebGPU EP left unexplored — a later optimization, not a gate item.
- **Verdict: PASS → buy Colab Pro and scale (Rung 2).** The CRNN+CTC fallback is no longer
  needed for export reasons.
- Wiring notes carried forward: transformers 5 saves a `tokenizer_config.json` it can't
  reload (`TokenizersBackend` class name + list-typed `extra_special_tokens`) — `overfit10.py
  --save-dir` sanitizes it on save. Vite must not pre-bundle `onnxruntime-web`
  (`optimizeDeps.exclude`), or its import.meta.url-relative wasm loading breaks.

## Rung 2 — training-kit smoke test (2026-07-06): PASS
Wiring shakeout of the scaled fine-tune scripts on the Mac (MPS) before paying for Colab —
`train.py` (fresh run) → `train.py --resume` (optimizer/scheduler state carried across the
restart) → `eval_omr.py` on the smoke checkpoint all ran end-to-end.
- Val loss fell monotonically across the smoke checkpoints (tiny subset — proves the loop,
  not the model; generalization numbers come from the real Colab run).
- `eval_omr.py` table + headline metric (per-class AEU accidental accuracy) render correctly
  and append to `<ckpt>/eval.jsonl`.
- Verdict: **GO** — next entry here should be the real Rung-2 Colab result (judge
  `<out>/best` with `eval_omr.py`; recipe in `train.py`'s docstring).
