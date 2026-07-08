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

## Rung 2 — scaled fine-tune on Colab (2026-07-07): PASS
First real generalization test: full fine-tune from the original pretrained weights on
`strips_v2_1` (16,243 train strips), judged by free-running generation on the 2,384 val strips
of the 20 held-out pieces (`eval_omr.py`, id-space alignment).
- **Run:** Colab Pro GPU, batch 16, lr 3e-5 (warmup 250 + cosine), 6,000 steps ≈ 110 min,
  ~1.1 s/step. Val loss 0.0701 @500 → **0.0045 @4000 (best)**, flat 0.0045–0.0048 to the end —
  converged, no overfit creep. Checkpoints on Drive: `MyDrive/tnc/rung2/{best,last}`.
- **HEADLINE: mean per-class AEU accidental accuracy 99.9% (8/8 classes present).** Every class
  ≥99.5% recall / ≥99.6% precision incl. büyükFlat (100%/100% at 35 gold — the low-rate respell
  coverage was enough). Repeat signs 100%; nav marks segno 100/100, coda 97.8/100, dc 100/97.1,
  fine 100/96.2; barline 99.9/100.
- **SER 0.001** (S=17 D=84 I=39 over N=95,316 ids); **exact-match 2,308/2,384 = 96.8%**.
- **Error taxonomy** (from --show-errors + the table): (1) spurious/missing `\sig \sigend` —
  95.5% recall, dominated by the **empty-signature ambiguity**: an every-mode row-start crop of
  a piece whose drawn signature is EMPTY is pixel-identical to the keysig-mode crop, but only
  the keysig label carries `\sig \sigend`; the model can only guess. Benign for the product
  (Phase-4 decoder: empty sig block == no sig block); if it ever matters, fix in DATA (emit
  `\sig \sigend` on every-mode row starts too) — do not chase it with training. (2) occasional
  dropped augmentation-blurred duration dots (`4.`→`4`). (3) rare mid-strip hallucinated note.
- Cosmetic: `tokenizer.decode()` drops spaces after added tokens in the error printouts
  (`\bakiyeSharpa'4`) — display only; metrics are computed in id space.
- **Verdict: PASS — Rung 2 done first try. The CRNN+CTC fallback is retired (export gate
  passed at Rung 1.5, accuracy gate passed here).** Next (decided same day): ONNX export of
  the checkpoint (local copy: `data/checkpoints/rung2-best/`; Drive `MyDrive/tnc/rung2/best`
  is the backup) via the Rung-1.5 pipeline FIRST — it unblocks Rung-4 wiring and the Rung-3
  labeling loop; Rung-3 photo collection (`docs/PIPELINE.md` §3) can run in parallel.

## Rung-2 ONNX export (2026-07-07): PASS
The Rung-1.5 pipeline rerun against the fine-tuned checkpoint (`data/checkpoints/rung2-best`
→ `data/checkpoints/rung2-best-onnx`, both gitignored) — the browser now decodes REAL Turkish
accidentals. Two deliberate differences from Rung 1.5: gate strips come from **held-out val
pieces** (this model generalizes rather than memorizes, so exact-decoding strips were
pre-picked with PyTorch — first candidate hit in every category, consistent with the 96.8%
exact-match eval), and the int8 step is now a **committed script** (it was a one-off manual
command at Rung 1.5). Manual walkthrough: `docs/MANUAL_CHECKS.md` Check 9.

- **Gate strips** (`rung2-best/GATE_STRIPS.txt`, 5): one per category — `\sig` block /
  `\buyukSharp` / repeat (`\volta1 … \repend`) / nav (`\coda`) / multi-measure `|` — and every
  strip carries AEU accidentals.
- **Export:** same `optimum-cli export onnx --task image-to-text-with-past` invocation.
  Optimum's own validation max logit diff: encoder 1.2e-3, decoder graphs ≤ 7.4e-5 (a bit
  above Rung 1.5's ≤ 4.5e-5, irrelevant in id space — see parity).
- **int8:** `src/vision/quantize_onnx.py` (dynamic, QInt8 weights): encoder 311→91 MB,
  decoder 276→69 MB, decoder-with-past 242→61 MB — **221 MB total, identical to Rung 1.5**.
- **Python parity** (`onnx_parity.py --checkpoint data/checkpoints/rung2-best --onnx-dir
  data/checkpoints/rung2-best-onnx --strips-dir data/synthetic/strips_v2_1 --n 5`):
  ONNX == PyTorch == label ids, **5/5, fp32 AND int8** — quantization does not disturb the
  fine-tuned decode.
- **Browser** (`make_browser_gate.py` same flags → `omr-gate.html`, headless Chromium, wasm
  threads): **10/10 exact** — 5 strips × (Python reference pixels + live canvas
  preprocessing). Latency: session load ~3.0 s; ~0.85 s encoder + 0.12–0.23 s decode ≈
  **~1.0 s/strip** (a touch faster than Rung 1.5's ~1.5 s).
- **Verdict: PASS — the shipped-form model (int8 ONNX in a real browser) reads Turkish
  notation exactly.** Unblocks Rung-4 wiring and the Rung-3 model-assisted labeling loop
  (`docs/PIPELINE.md`).

## Rung 2.2 — rhythm-sign retrain on Colab (2026-07-08): PASS
Full fine-tune from the original pretrained weights on **`strips_v2_2`** (the rhythm-sign
dataset: 4 new tokens `\tup3` `\tupend` `\tie` `\grace`, 96 → 100 ids — ROADMAP §7 /
`docs/PHASE2.md` §6), judged by free-running generation on the **2,417 val strips** of the same
20 held-out pieces (`eval_omr.py`).
- **Run:** Colab GPU, `notebooks/rung2_colab.ipynb` (Rung-2 recipe, from base weights; shakeout
  first — `vocab: +25 tokens -> 100 ids`, loss fell cleanly). Checkpoints on Drive:
  `MyDrive/tnc/rung22/{best,last}`.
- **HEADLINE: mean per-class AEU accidental accuracy 99.9% (8/8 classes present)** — every
  class ≥99.1% recall / ≥99.6% precision (büyükFlat 100/100 at 34 gold). **SER 0.002**
  (S=43 D=95 I=26 / N=96,833); **exact-match 2,337/2,417 = 96.7%** — quality holds vs Rung 2
  (99.9% / 0.001 / 96.8%) while adding the new signs.
- **New rhythm-sign tokens:** `\tup3`/`\tupend` **100%/100%** recall+precision (9 gold — the
  structurally-thin val coverage, a smoke signal only, but a clean one); `\tie` **96.4%** recall
  / 100% precision (195 gold); `\grace` **98.0%** / 99.6% (254 gold). Everything else held:
  repeats 99.1–100%, nav 97.3–100% recall, `\sig` 95.4% (the known empty-signature ambiguity,
  same as Rung 2's 95.5%), `|` 99.8%, digit `3` 93.5%.
- **Error notes:** the exact-match misses cluster on one recurring val phrase at t−9 read with
  a dropped duration dot (`g'4.`→`g'4` — the known augmentation-blur failure mode); one strip
  swapped `\kucukFlat`→`\bakiyeFlat` and dropped a `\volta1`. The missing spaces in `got:`
  printouts (`\bakiyeSharpa'4`) are the known tokenizer-decode display artifact — metrics are
  id-space.
- **Verdict: PASS.** Remaining to ship it (the proven Rung-2 export chain, rerun on this
  checkpoint — exact steps in ROADMAP §7 "Next"): local copy → ONNX export → int8 → parity →
  new gate strips (must now include triplet/tie/grace) → browser gate → retry the original
  triplet-misreading real upload.
