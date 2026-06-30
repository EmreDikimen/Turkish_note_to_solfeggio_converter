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
