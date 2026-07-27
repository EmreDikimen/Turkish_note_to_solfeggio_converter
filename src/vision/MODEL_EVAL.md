# Step-1 model evaluation — `Flova/omr_transformer`

purpose: the raw log of every model run, gate and export — settings, error dumps, verdicts
audience: whoever needs the detail behind a number
updated: 2026-07-27

> **Append-only.** New runs go at the END, under a `## <run> (<date>): <verdict>` heading.
> Summary numbers are collected in `docs/METRICS.md`; project state in `docs/STATUS.md`.

## Index

| Run / gate | Date | Verdict |
|---|---|---|
| Step-1 model gate (`Flova/omr_transformer`) | 2026-07-01 | PASS |
| Rung 1 — overfit-10 | 2026-07-02/03 | GO |
| Rung 1.5 — ONNX/browser gate | 2026-07-03 | PASS |
| Rung 2 — training-kit smoke | 2026-07-06 | PASS |
| Rung 2 — scaled fine-tune (Colab) | 2026-07-07 | PASS |
| Rung 2 — ONNX export | 2026-07-07 | PASS |
| Rung 2.2 — rhythm-sign retrain + export | 2026-07-08 | PASS |
| Rung 2.2b — stem-fix retrain + export | 2026-07-09 | PASS |
| Rung 3 — first real-page exam baseline (33 strips) | 2026-07-12 | superseded, LOW-N |
| Round 0.5 — labeler fine-tune (never shipped) | 2026-07-15 | PASS |
| Rung 3 — exam v2.1 baseline (352 strips) | 2026-07-20 | the pre-Round-1 reference |
| Round 1 — `strips_v3` re-render + distribution measurement | 2026-07-21 | built |
| Round 1 — init A/B on real-val | 2026-07-22 | Arm A wins |
| Round 1 — exam v2.1 FINAL | 2026-07-22 | ⛔ does not pass (5 floors) |
| Round 1 — exam contamination check | 2026-07-22 | verdict unchanged |
| Round 1 — ship (int8 parity + browser gate) | 2026-07-23 | shipped, 19/20 gate |
| Round 2 — `strips_v4` two-stage fine-tune (Colab) | 2026-07-26 | converged |
| Round 2 — exam v2.1 FINAL (read once) | 2026-07-27 | ⛔ headline regressed, NOT shipped |
| Round-2 run-first diagnostics (tiers, degrade probe) | 2026-07-23 | done |
| Carry-sig bug characterization | 2026-07-24 | logged |


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
dataset: 4 new tokens `\tup3` `\tupend` `\tie` `\grace`, 96 → 100 ids — `docs/log/status-log.md` /
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
  checkpoint — exact steps in `docs/MANUAL_CHECKS.md` Check 9): local copy → ONNX export → int8 → parity →
  new gate strips (must now include triplet/tie/grace) → browser gate → retry the original
  triplet-misreading real upload.

## Rung-2.2 ONNX export (2026-07-08): PASS
The Rung-2 export chain rerun against the rhythm-sign checkpoint (`data/checkpoints/rung22-best`
→ `data/checkpoints/rung22-best-onnx`, both gitignored) — the browser now decodes the new
`\tup3`/`\tupend`/`\tie`/`\grace` signs. Same invocations as Rung 2, only paths changed
(`rung22-best`, `strips_v2_2`). The int8 assets in `apps/web/public/models/` now carry rung22
(the upload box decodes with it). Manual walkthrough: `docs/MANUAL_CHECKS.md` Check 9.

- **Gate strips** (`rung22-best/GATE_STRIPS.txt`, 10): held-out val pieces, two per category —
  `\tup3`/`\tupend`, `\grace`, `\tie`, `\sig` block, plain AEU accidentals — plus incidental
  nav marks (`\coda`/`\dc`/`\repstart`) across 8 pieces (acemkurdi, muhayyer, acemtarab, sehnaz,
  huzzam, rast, muhayyerkurdi, yegah). Strips were pre-picked with PyTorch: of 16 candidates, 14
  decoded exactly; the 2 drops were genuine model errors (a leading `\grace` dropped, and the
  known empty `\sig \sigend` ambiguity), not export errors — `onnx==pytorch` was True on all 16.
- **Export:** same `optimum-cli export onnx --task image-to-text-with-past`. Optimum's own
  validation max logit diff: encoder ~7.2e-5 (irrelevant in id space — see parity).
- **int8:** `src/vision/quantize_onnx.py`: encoder 311→91 MB, decoder 276→69 MB,
  decoder-with-past 242→61 MB — **221 MB total, identical to Rung 2 / 1.5**.
- **Python parity** (`onnx_parity.py --checkpoint data/checkpoints/rung22-best --onnx-dir
  data/checkpoints/rung22-best-onnx --strips-dir data/synthetic/strips_v2_2 --n 10`):
  ONNX == PyTorch == label ids, **10/10, fp32 AND int8** — quantization does not disturb the
  rhythm-sign decode.
- **Browser** (`make_browser_gate.py` same flags → `omr-gate.html`, headless Chromium via
  Playwright, wasm threads on / crossOriginIsolated): **20/20 exact** — 10 strips × (Python
  reference pixels + live canvas preprocessing). Latency: session load ~3.0 s; ~0.9 s encoder +
  0.07–0.25 s decode ≈ **~1.0 s/strip**.
- **Upload path:** a held-out triplet strip fed through the drag-and-drop box (real canvas path)
  returns `\tup3 \kucukFlat b''8 c'''8 \kucukFlat b''8 \tupend …` — the earlier real-image
  triplet misread (`16. 32`) is now recovered as `\tup3 … \tupend`.
- **Verdict: PASS — the shipped-form rhythm-aware model reads triplets/ties/graces exactly in a
  real browser.** Unblocks Rung 3 (real photos / model-assisted labeling, `docs/PIPELINE.md`).

## Rung 2.2b — stem-fix + triplet-expansion retrain (2026-07-09): PASS
Triggered by a real-image upload (neyzen.com nihavend) whose triplets misread as `16. 32`. Two
root causes, both fixed, then a from-base retrain:

1. **Renderer bug** (`apps/web/src/SheetView.tsx` `flushSub`): tuplet beams were built with
   `new Beam(sub)` — VexFlow's `autoStem` defaults **false**, forcing every tuplet stem UP, so
   ALL synthetic triplets engraved with the "3" **below** (stems up). Real Turkish scores stem
   high passages DOWN → "3" **above**; the model had never seen that orientation, so it fell back
   to duration-snapping (`16. 32`) or read the over-note arc as a `\tie`. Fix: `new Beam(sub, true)`
   → stems follow pitch, both orientations appear (verified: high-note triplets now render "3" above).
2. **Triplet under-representation.** Old `strips_v2_2`: 413 triplet strips (2.2%), only **125
   distinct** musical instances, **9** in val (unmeasurable). Cause: `select_pieces.py` optimizes
   AEU-accidental coverage only, so triplet-dense forms (sazsemaisi/aksaksemai/longa/sirto) were
   skipped — the corpus holds ~8× more triplet data. Fix: `scripts/add_triplet_pieces.py` appended
   **40 triplet-rich pieces** (150 → 190; new makams: kurdilihicazkar, nihavent, huzzam, …).

**Rebuilt dataset** (full re-render + `export_scores.py` + `make_split.py`): **23,391 strips**
(was 18,777); **1,487 triplet strips (6.4%)** in **53 pieces** (was 413/2.2%/23); split 157/24
pieces; **val triplet strips 9 → 89** (in 8 pieces) — `\tup3` recall is now measurable. No token
drift (still 100 ids). Pre-triplet `data/{pieces.json,split.json}` are recoverable from git
history (the commit before this one); strips backup: `data/synthetic/strips_v2_2.pre-stemfix/`.
Colab kit rebuilt: `data/colab/tnc_stemfix_colab.zip`
(23,391 pngs) + `notebooks/rung22_stemfix_colab.ipynb`.

**Training:** from BASE (`Flova/omr_transformer`, dropped `--model`), Rung-2 recipe on the
expanded set (`lr 3e-5`, steps scaled to keep ~3-epoch coverage on the larger corpus). Shakeout
clean (`+25 tokens -> 100 ids`; loss 5.25 → 0.85 in 100 steps — higher start than Rung 2.2 is the
extra new-vocab density, not underfit). Checkpoint: Drive `MyDrive/tnc/rung22-stemfix/best`.

**Eval (`eval_omr.py`, held-out val):**
- **AEU accidentals all ~100%** (koma/bakiye/kücük/büyük sharp+flat 97.4–100% recall, ≥99.7%
  precision; büyükFlat 97.4% is 1/38); `\natural` 99.6%.
- **Rhythm signs — the headline:** `\tup3` **98.3%** / 100% on **118 gold** (was 100% on 9 — now
  trustworthy), `\tupend` 99.2%, `\tie` 96.4%, `\grace` **99.4%** (↑ from 98.0%). Both tuplet
  orientations now covered.
- Repeats/nav 97–100%, `|` 99.8%, digit `3` 99.7%. **Zero regression** vs Rung 2.2.
- **`\sig`/`\sigend` 94.4% recall / 99.2% precision is a LABEL bug, not a model error:** the
  serializer emits an *empty* `\sig \sigend` for signatures with no accidentals, which draws
  nothing, so the model correctly omits it (precision ~99% confirms it only emits `\sig` for real
  signatures). True `\sig` quality is ~99%+. TODO: skip empty `\sig … \sigend` in the label
  serializer (`tools/render/lilypond.ts`) — needs a re-render, so batch with the next data build.

- **Verdict: PASS — triplets now robustly validated (not a 9-sample smoke signal) and the
  above-placement orientation is fixed, with no regression elsewhere.** Remaining: download
  `rung22-stemfix/best` → rerun the ONNX export chain → re-upload the neyzen strips in
  `omr-gate.html` (high triplets should now decode `\tup3 … \tupend`). Then Rung 3.

## Rung-2.2b ONNX export (2026-07-09): PASS
The proven export chain rerun against the stem-fix checkpoint
(`data/checkpoints/rung22-stemfix-best` → `data/checkpoints/rung22-stemfix-best-onnx`, both
gitignored) — the shipped int8-ONNX model now reads the fixed above-placement triplets in a real
browser. Same invocations as Rung 2.2, only paths changed (`rung22-stemfix-best`,
`strips_v2_2`). Manual walkthrough: `docs/MANUAL_CHECKS.md` Check 9.

- **Gate strips** (`rung22-stemfix-best/GATE_STRIPS.txt`, 10): held-out val pieces, covering
  every category incl. the now-measurable triplets — **two `\tup3`/`\tupend`** (nihavent,
  hicaz — one high-note triplet), `\grace`×2 (rast, acemtarab), `\tie` (segah), `\sig` block
  (nisaburek), `\buyukFlat` (acemtarab), `\repstart` (hisarbuselik), `\fine` nav (sehnaz),
  multi-measure `|` (acemtarab). Pre-picked as PyTorch-exact decodes; each was then confirmed
  int8-exact before staging (see the int8-swap note below).
- **Export:** same `optimum-cli export onnx --task image-to-text-with-past`. Optimum's own
  validation max logit diff: encoder ~1.6e-3, decoder graphs ≤ 5.3e-5 (irrelevant in id space —
  see parity).
- **int8:** `src/vision/quantize_onnx.py`: encoder 311→91 MB, decoder 276→69 MB,
  decoder-with-past 242→61 MB — **221 MB total, identical to every prior rung.**
- **Python parity** (`onnx_parity.py --checkpoint data/checkpoints/rung22-stemfix-best
  --onnx-dir data/checkpoints/rung22-stemfix-best-onnx --strips-dir data/synthetic/strips_v2_2
  --n 10`): ONNX == PyTorch == label ids, **10/10 fp32 AND 10/10 int8.** One first-pick nav
  strip (nisaburek `m142-144`) was fp32-exact but int8 flipped a leading `\buyukSharp`→
  `\bakiyeFlat` (a borderline int8 quantization case, not an export bug — `onnx==pytorch` held
  at fp32); swapped it for an int8-exact nav strip (sehnaz `\fine`) so the gate is a clean 10/10.
- **Browser** (`make_browser_gate.py` same flags → `omr-gate.html`, headless Chromium via
  Playwright, wasm threads on / crossOriginIsolated): **20/20 exact** — 10 strips × (Python
  reference pixels + live canvas preprocessing); both `\tup3` strips decode `\tup3 … \tupend`.
  Latency: session load ~3.0 s; ~0.85 s encoder + 0.14–0.26 s decode ≈ **~1.0 s/strip**.
- **Real-strip proof:** the original triplet-misreading upload (`data/real/refs/triplet_test.png`,
  a real neyzen strip) fed through the drag-and-drop box (canvas product path) now returns
  `\repstart r8 e''8 f''8 a''8 \tup3 g''8 f''8 \tupend e''16 …` — the high-note triplet is
  recovered as **`\tup3 … \tupend`**, no longer the pre-fix `16. 32`. Residual roughness on the
  rest of this real (non-VexFlow) image (a stray later `\tupend`, an `e'' 32` spacing) is the
  expected synthetic→real gap that Rung 3 exists to close — the stem/triplet fix itself is
  confirmed end-to-end in the shipped form.
- **Verdict: PASS — the shipped int8-ONNX model reads the fixed above-placement triplets
  exactly in a real browser, and the real-image regression that triggered Rung 2.2b is
  resolved.** Next: Rung 3 (real photo/screenshot collection + model-assisted labeling,
  `docs/PIPELINE.md` §3) using this checkpoint.

## Rung 3 — real-page exam BASELINE (2026-07-12): 83.3% AEU (the synthetic→real gap, measured)

- **What:** `rung22-stemfix-best` (unchanged — trained on synthetic only) evaluated on the
  first REAL exam strips: `data/real/rung3/strips_exam/` — 33 alignment-certain strips from
  the frozen 20-piece SymbTr-matched exam set (`data/real/rung3/testset.json`, provisional
  neyzen-only), labels emitted by `scripts/rung3/emit_strip_labels.py` (carry-mode +
  printed-signature conventions), never trained on.
- **Result:** headline mean per-class AEU accidental accuracy **83.3%** (4/8 classes present,
  ALL LOW-N: komaSharp 4/4, bakiyeSharp 2/3, komaFlat 2/3, bakiyeFlat 1/1 gold), SER
  **0.018**, exact-match **26/33 = 78.8%**. Per-source: neyzen only. Synthetic val for the
  same checkpoint: 99.9% / 0.002 / 96.7% — the synthetic→real gap is now a NUMBER, and
  closing it is exactly the Round-1 fine-tune's job (`docs/rung3/round1.md`).
- **Honesty caveats (printed by `eval_omr.py` itself):** matched-piece exam = an upper bound
  for real-world accuracy; AND these 33 auto-labelable strips are the alignment-certain end
  of the exam pieces (accidental-disagreeing strips sit in the review queue awaiting human
  adjudication — the exam grows as `data/real/rung3/strips_exam/emit_review.csv` is worked
  through). büyük classes: zero on real pages (untransposed) — unmeasurable by design.
- Baseline eval row appended to `data/checkpoints/rung22-stemfix-best/eval.jsonl`
  (`caveat: matched-upper-bound`, `per_source`).

## Round-0.5 — rung3-labeler fine-tune (2026-07-15): PASS (tooling checkpoint, NEVER shipped)

Throwaway emitter/decode_page checkpoint (docs/rung3/labeling.md §1a.5): fine-tuned FROM
`rung22-stemfix-best` on the 418-strip human-adjudicated real pool ONLY
(`data/real/rung3/strips_r1`, promote_labels.py 2026-07-14; split 40/8 pieces = 362/56
strips, exam pieces structurally absent). Colab L4, `--lr 1e-5`, best val loss 0.0608 at
step 200 (~4.5 epochs — early convergence then overfit, textbook for 362 strips; run
stopped at 700).

- **Real-val decode, before → after** (56 strips, same split, upper-bound caveat applies):
  SER **0.086 → 0.021**, exact **39.3% → 69.6%**, AEU headline **70.0% → 91.7%**;
  `\bakiyeSharp` (n=52, the only high-N class) 75/76.5% → **100/100%**; `\sig`/`\sigend`
  96.4/85.7% → **100/100%** (signature hallucinations gone — the majority-vote poisoning
  vector). Both eval rows in the respective checkpoints' `eval.jsonl`.
- **Known regression:** `\tup3` recall 100→33% (n=3) — real pool is tuplet-poor; benign for
  the emitter (labels come from SymbTr; a missed decode only raises nd → review, never a
  wrong label). Persistent (not regressed): `\volta1` under the "2." bracket, `\fine`.
- **Export:** same `optimum-cli export onnx --task image-to-text-with-past` →
  `data/checkpoints/rung3-labeler-onnx`, `quantize_onnx.py` int8 (91/69/61 MB). Parity
  (GATE_STRIPS.txt = 16 strips_r1 train+val strips): fp32 **8/8**, int8 **8/8** exact
  (onnx==pytorch AND ==label), int8 decode ~2.5× faster.
- **Scope guard:** this checkpoint only ever feeds `decode_page.py`/the emitter
  (`--checkpoint data/checkpoints/rung3-labeler --onnx-dir data/checkpoints/rung3-labeler-onnx`).
  No browser gate, never in `apps/web/public/models/`; Round 1 still trains from BASE.

## Rung 3 — exam v2.1 BASELINE (2026-07-20): 64.1% AEU on the full 352-strip real exam

- **What:** `rung22-stemfix-best` (synthetic-only, unchanged) on the frozen exam v2.1
  (`data/real/rung3/strips_exam_v2/`, 352 strips: v2's 311 + the tup3 extension — 10 holdout
  tuplet pieces, tup3 gold 4 → 55 groups / 38 strips). This supersedes both earlier baselines
  (83.3% on 33 strips, ALL LOW-N; the 311-strip retake never ran) as THE pre-Round-1 reference.
- **Headline: mean per-class AEU accidental accuracy 64.1% (7/8 present; \buyukFlat absent,
  \komaSharp 18 / \buyukSharp 3 gold = LOW-N), SER 0.147, exact-match 17.3%** (352 strips,
  free-running, id-space alignment).
- **Per-source:** neyzen 74 strips — 72.4% / 0.075 / 39.2%; nota 278 strips — 60.0% / 0.167 /
  11.5% (nota engravings are the harder, blurrier tail — consistent with the sharpness analysis).
- **The tup3 number Round 1 must move: recall 92.7%, precision 15.1%** — the synthetic-only
  model hallucinates `\tup3`/`\tupend` on ordinary 8th/16th figures all over real pages
  (I=919 dominates the SER). Also weak: `\kucukSharp` recall 22.6% (n=31), `\kucukFlat` 51.4%,
  `\volta1` 25.0%, `\tie` 66.2/61.1% (slur confusion both directions).
- **Honesty:** matched-piece exam = an upper bound (emit-alignable pages only); tup3 gold is
  common-case k=1 material — dense contiguous-run instrumentals stay unmeasured until
  sub-measure fragments (docs/rung3/labeling.md §1c); eval row appended to
  `data/checkpoints/rung22-stemfix-best/eval.jsonl`.
- **Arc-metric + mean-F1 addendum (2026-07-20, item (0b) — measurement code shipped BEFORE any
  Round-1 training, `eval_omr.py`):** two Step-4.0 pre-registered metrics now print on every eval
  and persist to `eval.jsonl`. Baseline filled by **re-running the spent exam read** (same frozen
  model + frozen exam = zero selection leakage):
  - **Mean per-class AEU F1 = 57.0%** (vs the recall-only headline 64.1%) — the honest single
    number the headline hides. Worst F1s: `\kucukSharp` 35.0% (recall-bound), `\komaSharp` 33.7%
    and `\komaFlat` 66.7% (precision-bound, i.e. koma hallucination). Per-class `f1` column now in
    the table.
  - **Arc-triggered false-`\tup3` rate = 66/85 = 77.6%** (of exam strips whose gold has `\tie` but
    no `\tup3`, the fraction that decode a spurious `\tup3`); neither-token rate 82/229 = 35.8%.
    The re-computed denominators (**85 / 229**) match the hand-computed pre-registration exactly.
    Floor is ≤10% — the arc→triplet misread the re-render's slur distractors must eliminate.

## Round-1 synthetic re-render — corpus `strips_v3` + accidental-distribution measurement (2026-07-21)

Not a model eval — a DATA measurement, recorded here because it sets up Round 1's training mix and
one open decision. Full design + rationale: `docs/rung3/rerender.md`.

- **Corpus:** `data/synthetic/strips_v3` — **38,091 strips**, 190 pieces, 49 makams.
  **73.3% carry** (`measure` mode, 27,933) / 26.7% `every` (10,158). All carry strips wear a
  per-makam conventional PRINTED signature (`data/makam_signatures.json`, 33 distinct variants
  sampled). keysig mode retired. Budget gate PASS: longest label **57 ids** (cap 59), no token drift.
- **What changed vs `strips_v2_2`:** carry-mode dominance at written pitch (t0) with conventional
  makam signatures; `every` mode now carries the transpose augmentation (t≠0); label-free **slur
  distractors** (≥3 notes, no "3") to attack the arc→`\tup3` misread (baseline tup3 precision 15%,
  arc-triggered false-tup3 77.6%). Slurs verified pixels-only: 15 drawn with a seed / 0 without,
  88/88 labels byte-identical to the pre-slur render.

**Inline-accidental rate (the headline):**

| | inline accidentals / strip |
|---|---|
| carry (`measure`) | 0.36 |
| **REAL pools** | **0.32** ✅ |
| `every` | 4.22 (13× real) |

**Carry mode structurally matches the real distribution** — the conventional-signature work is
validated. But `every` is 26.7% of strips and **81% of all inline accidentals**, so the effective
rate is 1.40/strip = **4.4× real**. Hypothesis (testable, not proven): an inflated
"emit an accidental" prior that surfaces as hallucination on ambiguous real ink — consistent with
the baseline komaSharp precision **21%** / komaFlat **54%** (Step-4.0 floor is ≥70%).

**Per-class share vs real, as a function of the `every` sampling share s:**

| s | inline rate | mean abs dev | kucukFlat | kucukSharp | komaSharp |
|---|---|---|---|---|---|
| 26.7% (as rendered) | 4.4× | 3.75pp | 4.9% | 1.9% | 5.7% |
| 15% | 2.9× | **3.32pp** | 7.1% | 2.7% | 6.1% |
| 10% | 2.3× | 3.36pp | 8.3% | 3.2% | 6.3% |
| 5% | 1.7× | 3.69pp | 9.8% | 3.8% | 6.6% |
| 0% | 1.1× | 4.11pp | 11.7% | 4.6% | 7.0% |
| **REAL** | — | — | **19.3%** | **2.5%** | **2.1%** |

Criteria disagree at the margin (deviation minimised ≈10–15%; inline-rate pushes lower; komaSharp
worsens as s falls — carry-only komaSharp is 7.0%). s=0 is measurably worse overall than as-rendered.

**Prior plan item "komaSharp/kucukSharp boost" — overturned:** komaSharp is already over-represented
(5.7% vs 2.1%) and precision-bound → boosting backfires; kucukSharp already matches real. The real
gap is kucukFlat, whose residual is a **makam-mix** artifact (real pool over-weights
nihavent/kurdilihicazkar/acemasiran), not a spelling bug. The `bakiyeSharp→kucukFlat` respell is
**held** — down-weighting `every` lifts kucukFlat for free (4.9% → 7–8%).

**Open decision:** add `--every-share` to `train.py` (stochastic per-epoch sampling; `Strip` already
carries `mode`) and treat s as an A/B dimension {26.7%, 15%, 5%}, selecting on real-val mean AEU F1.
Train-time over re-render: free, **tunable** (a re-render bakes in one guess at ~75 min), reversible,
and it makes the choice measured rather than decreed. Caveat: mixture ratios tune on validation —
keep to 2–3 values; the one-shot exam stays the clean number.

## Round 1 — init A/B on real-val (2026-07-22): TWO-STAGE (Arm A) WINS, 89.2% vs 78.4% mean AEU F1

First Round-1 training result. Both arms trained from BASE on `strips_v3` (carry-dominant, conventional
per-makam printed signatures, slur distractors) at the pre-registered `--every-share 0.15`, Colab L4
(~0.9–1.3 s/step @ batch 16). Judged by the ONE pre-registered selection number: free-running
**real-val mean per-class AEU F1** on the merged real-val pool (`src/vision/make_realval_pool.py` →
`data/real/rung3/_realval`, **271 strips** — the same stable-hash split train.py validated on).
Tie-break (arc-triggered false-`\tup3`) not needed: both arms tied at 1.6%.

- **Arm A — two-stage.** Stage 1: synthetic ONLY from BASE, 6,000 steps, lr 3e-5. Stage 2: from
  stage-1 `best`, 2,000 steps, lr 1e-5 + 100 warmup, real pools **oversampled `:8`** → real = 33.3%
  of the pool (16,640 / 49,959). Best = **stage-2 step 1000** (val_mix 0.0171, real 0.0937).
- **Arm B — single-stage joint (control).** From BASE, 7,000 steps, lr 3e-5, real at its natural
  **5.9%** share. Best = **step 5000** (val_mix 0.0184, real 0.0979).

| | Arm A (two-stage) | Arm B (single-stage) |
|---|---|---|
| **MEAN AEU F1 (SELECTION)** | **89.2%** | 78.4% |
| AEU headline (recall) | 95.0% | 88.7% |
| SER | 0.032 | 0.031 |
| exact-match | 63.1% (171/271) | 62.0% (168/271) |
| arc-triggered false-`\tup3` | 1.6% (1/64) | 1.6% (1/64) |
| per-source gap (neyzen vs nota) | **0.6 pp** (94.2 / 94.8) | 2.8 pp (91.4 / 88.6) |
| `\tup3` recall / precision | 84.1% / **97.4%** | **93.2%** / 91.1% |
| `\tie` F1 | 63.2% | 65.9% |

**⚠ THE MARGIN IS LOW-N DRIVEN — read the selection honestly.** Per-class F1 (A vs B):
`\komaSharp` **1 gold** 66.7/25.0 · `\kucukSharp` **21 gold** 97.6/76.5 · `\bakiyeSharp` 129 gold
92.5/92.4 · `\komaFlat` 62 gold 93.7/93.7 · `\bakiyeFlat` 57 gold 90.9/90.1 · `\kucukFlat` 61 gold
93.7/92.7. The mean is over 6 classes, so **a single `\komaSharp` gold token contributes 6.9 pp of the
10.8 pp gap**, and `\kucukSharp` a further 3.5 pp — together 10.4 of 10.8. Restricted to the four
classes with ≥30 gold, **A 92.7% vs B 92.2% — effectively tied.** The one substantive signal is
`\kucukSharp` RECALL 95.2% (A) vs 61.9% (B) = 20/21 vs 13/21 found. A also wins on source
consistency and tup3 precision, so the call stands — but it is not the decisive 10.8 pp it looks like.

**HEADLINE WIN — the tup3-precision catastrophe is fixed.** Against the rung22-stemfix baseline:
`\tup3` precision **15.1% → 97.4%** (Arm A) and the arc-triggered false-`\tup3` rate
**77.6% → 1.6%** (both arms; floor ≤10%). This is the slur distractors (`drawSlurArc`, label-free
arcs with no "3") doing exactly what they were designed for — an arc alone is no longer read as a
triplet. The conventional-signature work also shows: `\sig` 98.2% / `\sigend` 96.0–98.2% F1.

**Arm A clears every Step-4.0 floor ON REAL-VAL** (AEU 95.0 ≥85, mean-F1 89.2 ≥80, tup3 precision
97.4 ≥70, SER 0.032 ≤0.06, exact 63.1 ≥45, source gap 0.6 ≤12, arc 1.6 ≤10; every ≥20-gold class
above the 75% recall / 70% precision bars).

**HONESTY CAVEATS — do not over-read these numbers:**
1. **Real-val is the SELECTION set, not the exam.** These floors are pre-registered for the frozen
   exam v2.1; passing them on the set we selected on is indicative only, and optimistic.
2. **NOT comparable to the 64.1% AEU / 57.0% F1 baseline.** That was exam v2.1 (352 strips); this is
   real-val (271 strips). Different sets — the exam read is still owed, ONCE, on the winner.
3. `\komaSharp` (1 gold) and `\kucukSharp` (21 gold) are statistically weak here; `\buyukSharp` /
   `\buyukFlat` are absent from real-val entirely (untransposed real pages, by design).

**Methodological note (logged as a real fix, not a footnote):** Arm A stage 2 was first written with
the real pools at their natural 5.9% share — at 2,000 steps that is **each real strip seen <1×**,
which could never reproduce the Round-0.5 effect the arm exists to test. Caught before running and
fixed with `:8` oversampling (real → 33.3%, each real strip ~5×). Without it Arm A would have been
"Arm B with a warm start" and the A/B would have tested nothing.

**Checkpoint-selection note:** `best` is chosen on a strip-weighted val mix dominated by the 4,772
synthetic val strips (vs 271 real), so it need not be best for real pages. Checked in both arms — it
was: Arm B best step 5000 = lowest real (0.0979); Arm A best stage-2 step 1000 = lowest real
(0.0937). Stage 2 then overfit (real 0.0937 → 0.0966 → 0.0968), the expected consequence of
oversampled real; `best` caught the turn. Evaluating `best/` alone is therefore correct here.

**Also observed:** Arm B's real-val loss plateaued from ~step 2500 (0.1018 → 0.0979 over the next
2,500 steps), i.e. the last ~4,500 steps bought almost nothing for real pages — relevant to budgeting
the every-share sweep. And the every-share komaSharp diagnostic pre-registered for that sweep is
**unmeasurable on real-val (n=1)**; exam v2.1 has 18 komaSharp gold, still low.

## Round 1 — exam v2.1 FINAL (2026-07-22): ⛔ DOES NOT PASS the Step-4.0 floors

**The one-shot read, spent.** Arm A (two-stage, `--every-share 0.15`) on the frozen 352-strip exam
v2.1, run locally per the Step-4.0 discipline (exam strips never went to the training box). Command:
`eval_omr.py --checkpoint data/checkpoints/round1-best --strips-dir data/real/rung3/strips_exam_v2
--split none --show-errors 20`, defaults for `--batch-size 16` / `--max-length 100`, device mps.
Row appended to `data/checkpoints/round1-best/eval.jsonl` (exactly one exam row).

**Pre-flight validation of the frozen exam (computed from gold labels alone, no model):** 352 strips,
arc denominator **85**, neither-token denominator **229**, tup3 **55 groups / 38 strips**, per-class
gold identical to the Step-4.0 table (bakiyeSharp 141, kucukFlat 70, bakiyeFlat 66, komaFlat 48,
kucukSharp 31, komaSharp 18, buyukSharp 3, buyukFlat 0), source split 278 nota / 74 neyzen. The exam
is unchanged since the baseline; the read is valid.

### Verdict against the pre-registered floors

| Criterion | Baseline | **Round 1** | Floor | |
|---|---|---|---|---|
| Mean per-class AEU **recall** (headline) | 64.1% | **66.6%** | ≥85% | ⛔ **FAIL −18.4pp** |
| Mean per-class AEU **F1** | 57.0% | **67.0%** | ≥80% | ⛔ **FAIL −13.0pp** |
| `\tup3` **precision** | 15.1% | **93.0%** | ≥70% | ✅ PASS |
| `\tup3` recall | 92.7% | **72.7%** | ≥85% | ⛔ **FAIL −12.3pp** |
| **Arc-triggered false `\tup3`** | 77.6% | **0.0%** (0/85) | ≤10% | ✅ **PASS** |
| SER | 0.147 | **0.059** | ≤0.06 | ✅ PASS (by 0.001) |
| Exact-match | 17.3% | **49.1%** | ≥45% | ✅ PASS |
| Per-source AEU gap | 12.5pp | **0.3pp** | ≤12pp | ✅ **PASS** |
| Synthetic val no-regression | 99.9% | not yet run | ≥99% | ⏸ pending |

Per-class, the five AEU classes with ≥20 exam gold:

| Class | gold | recall → floor ≥75% | precision → floor ≥70% |
|---|---|---|---|
| `\bakiyeSharp` | 141 | 76.6 → **92.2%** ✅ | 90.8 → **92.2%** ✅ |
| `\kucukFlat` | 70 | 51.4 → **78.6%** ✅ | 92.3 → **94.8%** ✅ |
| `\bakiyeFlat` | 66 | 60.6 → **92.4%** ✅ | 83.3 → **95.3%** ✅ |
| `\komaFlat` | 48 | 87.5 → **89.6%** ✅ | 53.8 → **66.2%** ⛔ **FAIL −3.8pp** |
| `\kucukSharp` | 31 | 22.6 → **58.1%** ⛔ **FAIL −16.9pp** | 77.8 → **94.7%** ✅ |

**Five floors missed** (headline recall, mean F1, tup3 recall, kucukSharp recall, komaFlat precision).
Per the Step-4.0 decision rule this is **not a ship**, and the exam is **not re-run**: diagnosis moves
to real-val, and any further exam read must be labelled a *second look with its leakage acknowledged*.

### What genuinely improved — and it is substantial

- **The arc→triplet catastrophe is eliminated, not merely reduced: 77.6% → 0.0%** (0 of 85
  arc-bearing strips emit a false `\tup3`; 0 of 229 on the neither-token control). `\tup3` precision
  **15.1% → 93.0%**. The slur distractors did exactly what they were designed to do.
- **Style overfit is gone: the per-source AEU gap collapsed 12.5pp → 0.3pp** (neyzen 64.6 / nota
  64.9). The harder nota domain caught up completely — the carry-dominant re-render with conventional
  printed signatures is validated.
- SER **0.147 → 0.059** (−60%), exact-match **17.3% → 49.1%** (+31.8pp), `\sig` F1 94.1% /
  `\sigend` 92.0%, `\bakiyeFlat` recall 60.6 → 92.4%, `\kucukFlat` 51.4 → 78.6%.

### The finding that matters most: real-val was wildly optimistic

| | real-val (271) | exam v2.1 (352) |
|---|---|---|
| mean AEU recall | **95.0%** | **66.6%** |
| mean AEU F1 | **89.2%** | **67.0%** |
| exact-match | 63.1% | 49.1% |

**A ~28pp generalization gap on the headline.** The pre-registration warned real-val would be
optimistic *because it is the selection set*; the magnitude is far beyond what that caveat implied.
Both pools are piece-disjoint and promoted, so piece-level leakage is not the explanation — the
likely driver is that real-val pieces sit inside the same publications/editions the model trained on,
while exam pieces were held out wholesale. **Standing lesson: real-val cannot be used to predict exam
performance in absolute terms, only to order candidates.** This also retroactively strengthens the
sweep-cancellation call: a metric this loosely coupled to the exam could not have selected usefully.

### Why the headline is 66.6% — LOW-N drag, reported not excluded

`\buyukSharp` (**3 gold**) scored **0.0% recall**, and `\komaSharp` (**18 gold**) **regressed** on
recall 83.3 → 55.6% (precision improved 21.1 → 43.5%). Between them they cost ~20pp of the 7-class
mean. Restricted to the five ≥20-gold classes the means are **82.2% recall / 84.0% F1** — but per the
Step-4.0 blind-spot rule the LOW-N classes **stay inside the headline and F1 means and are never
dropped to flatter them**, so *the verdict stands at 66.6% / 67.0% and the run FAILS*. The 5-class
figure is diagnostic context only, not a re-scoring.

Note a pre-registration inconsistency found during adjudication: Step 4.0's table applies per-class
floors to classes with **≥20 gold** (so `\komaSharp`, 18 gold, carries none), while the 2026-07-22
sweep amendment referred to "the exam's ≥70% komaSharp-precision floor". **Step 4.0 is the binding
text** — komaSharp is scored, reported, and floor-free. Logged rather than silently resolved.

### Failure modes visible in the error dump

1. **Signature accidental-class confusion, both directions** — `\komaSharp f` ↔ `\kucukSharp f`
   swapped on *the same piece* (zahiri p1_s03_w00 and p1_s04_w00). This is the single biggest driver
   of the kucukSharp/komaSharp misses: the model reads the sig slot but picks the wrong koma family.
2. **`\tup3` → `\grace` substitution** (neydin_guzelim p1_s00_w00: gold `\tup3 d''16 c''16 b'16
   \tupend` decoded as `\grace d''16 …`). A *new* failure mode: having stopped over-firing triplets,
   the model now re-labels some real ones as grace groups — the mechanism behind recall 92.7 → 72.7%.
3. **`\tie` misses dominate the deletion count** (65.4% recall / 75.0% precision) — reported, never
   floored, per the unstable-ground-truth rule.
4. `\volta1` dropped (81.2% recall), and occasional spurious `\sig` blocks on non-row-start strips.

### Blind spots — restated as non-claims

`\buyukFlat`: **0 real gold**, no real-page claim in either direction. `\komaSharp` 18 / `\buyukSharp`
3 gold are LOW-N and carry no floor. `\tup3` gold is common-case k=1 material — dense
contiguous-triplet instrumentals remain **unmeasured** (§1c sub-measure fragments). The exam is a
**matched-upper-bound** (`caveat: matched-upper-bound`); real-world accuracy is below it. Exam crops
carry **retired old-slicer defects**, so robustness to those is slightly over-measured. `\sigend`
movement is partly the empty-`\sig` label fix, not pure model gain. Training-pool label noise (~7%
pitch / ~38% tie structural) bounds attribution of the residual — the fresh 5% nota re-audit runs
**regardless of this failure**.

### Synthetic no-regression clause — ⛔ ALSO FAILS (93.0% vs ≥99%), and it names the root cause

`eval_omr.py --strips-dir data/synthetic/strips_v3 --split data/split_v3.json --side val
--limit 1000` (1,000-strip subset of synthetic val — a subset, stated as such):

**Mean per-class AEU recall 93.0% (floor ≥99%) — FAIL.** Mean F1 90.5%, SER 0.006, exact-match
88.6%. Per class: `\bakiyeFlat` 100% / `\komaFlat` 99.6% / `\natural` 100% / `\bakiyeSharp` 95.1%,
then the drag — `\kucukFlat` 90.9% recall at **70.2% precision** (44 gold), `\kucukSharp` 83.3%
(24), `\buyukFlat` 75.0% (8), `\buyukSharp` 68.4% precision (26).

**Comparability caveat, stated plainly:** the 99.9% reference was `rung22-stemfix` on
**`strips_v2_2`** (every/keysig modes); this is Round 1 on **`strips_v3`** (carry-dominant,
conventional printed signatures, slur distractors, 33 signature variants). Different, harder corpus —
so this is *not* a strict same-set regression measurement, and the gap overstates forgetting. It is
still a fail against the clause as written.

**The error dump is the payoff — a reproducible signature-interaction bug.** Under a
`\sig \kucukFlat b \sigend` signature the model repeatedly inserts a spurious **inline `\komaFlat`
on `b'`** that the gold does not have (three separate strips in the first errors alone:
`… c''4 b'8 …` → `… c''4 \komaFlat b'8 …`). It is re-stating, inline and in the wrong koma family,
an alteration the signature already carries.

That is almost certainly the same defect as the exam's **`\komaFlat` precision 66.2%** failure and a
contributor to the `\komaSharp`↔`\kucukSharp` confusion: **carry-mode accidental/signature
interaction is not solidly learned.** It reproduces on synthetic, which means Round 2 can attack it
with a fast, fully-labelled iteration loop instead of scarce real pages — the most actionable result
of this whole exam cycle.

### ⚠ Exam contamination found during post-read verification (2026-07-22) — 4 pieces / 25 strips

Checking exam↔training piece disjointness *after* the read turned up **4 SymbTr pieces present in
BOTH the exam manifest and the training pools** — in every case the exam holds one engraving and
training holds **the other engraving of the same piece**:

| SymbTr piece | exam side | training side |
|---|---|---|
| `huzzam--…--sevdim_yine` | `…_nota_p1` | `…_p1` (neyzen), strips_tup |
| `kurdilihicazkar--…--gittin_biraktin` | `…_ney_p1` | `…_nota_p1`, strips_nota |
| `kurdilihicazkar--…--ay_dalgalanirken` | `…_p1` | `…_nota_p1`, strips_nota |
| `saba--…--neydin_guzelim` | `…_nota_p1` | `…_ney_p1`, strips_tup |

**This violates the Step-2 rule as written** ("dedupe by SymbTr file — the exam must measure
real-image generalization, not memorized melodies"): same melody, same token sequence, different
printed image, so the model can partly recall rather than read.

**Root cause — the guard is EMIT-time, not TRAIN-time.** `emit_strip_labels.py --testset` excludes
exam pieces when emitting training labels, and `make_round1_colab_zip.sh` never ships exam strips.
Neither check re-runs when the *exam* grows or when new material is collected. Both happened after
the v2 freeze: §1c (2026-07-17) deliberately downloaded **second-engraving copies of pieces already
held**, and the tup3 exam extension (2026-07-20) moved pieces INTO the exam —
`gittin_biraktin` and `ay_dalgalanirken` are both on that holdout candidate list — while their other
engraving already sat in `strips_nota`. Nothing re-validated disjointness afterwards.

**Scale and direction: 4 of 32 pieces, 25 of 352 strips = 7.1%, biasing the exam UPWARD.** The
Round-1 failure is therefore *not* explained away by it — the true figure is at or below 66.6%.

**Corrected read (instrument repair, NOT a re-roll).** `strips_exam_v2_clean/` = the same manifest
minus those 4 pieces (327 strips, hardlinked images, frozen exam untouched). The ≥20-gold class set
is preserved (`\bakiyeSharp` 139, `\kucukFlat` 60, `\bakiyeFlat` 57, `\komaFlat` 41, `\kucukSharp`
31), so the Step-4.0 per-class floors still apply; arc denominators become 82 / 219. This read can
only LOWER the score, so it cannot be self-serving — it is a defective instrument being repaired,
and both numbers are reported.

**Fixes owed for exam v3:** (a) a **train-time** disjointness assertion (train.py refuses to start if
any real pool piece appears in `testset.json`), not just the emit-time filter; (b) re-validate
disjointness whenever the exam grows OR new pieces are collected; (c) dedupe on the SymbTr piece id,
never on the image stem — all four of these slipped through precisely because the stems differ.

#### Corrected read result (327 clean strips) — the verdict is UNCHANGED

Everything moved in the predicted direction (down), confirming the contamination was inflating the
score — and confirming it was inflating it only slightly.

| Criterion | full (352) | **clean (327)** | Floor | |
|---|---|---|---|---|
| Mean AEU recall | 66.63% | **66.26%** | ≥85% | ⛔ FAIL |
| Mean AEU F1 | 66.98% | **66.53%** | ≥80% | ⛔ FAIL |
| `\tup3` recall | 72.7% | **74.4%** | ≥85% | ⛔ FAIL |
| `\kucukSharp` recall | 58.1% | **58.1%** | ≥75% | ⛔ FAIL |
| `\komaFlat` precision | 66.2% | **63.8%** | ≥70% | ⛔ FAIL |
| `\tup3` precision | 93.0% | **93.5%** | ≥70% | ✅ PASS |
| Arc-triggered false `\tup3` | 0.0% | **0.0%** (0/82) | ≤10% | ✅ PASS |
| SER | 0.05908 | **0.05973** | ≤0.06 | ✅ PASS by 0.00027 |
| Exact-match | 49.15% | **49.24%** | ≥45% | ✅ PASS |
| Per-source AEU gap | 0.3pp | **5.3pp** (neyzen 59.5 / nota 64.8) | ≤12pp | ✅ PASS |

Per-class on the clean exam: `\bakiyeSharp` (139) 92.1/92.1 ✅✅ · `\bakiyeFlat` (57) 91.2/96.3 ✅✅ ·
`\kucukFlat` (60) 76.7/93.9 ✅✅ · `\komaFlat` (41) 90.2/**63.8** ✅/⛔ · `\kucukSharp` (31)
**58.1**/94.7 ⛔/✅. LOW-N, no floor: `\komaSharp` (18) 55.6/43.5, `\buyukSharp` (3) 0.0/0.0.

**Deltas are small: AEU −0.37pp, F1 −0.45pp, `\komaFlat` precision −2.4pp.** The 7.1% contamination
mattered less than feared, which means **66.3% is a figure that can be stood behind**. The six failed
criteria (five exam + the synthetic no-regression clause) are unchanged.

One artefact worth noting: the per-source gap *widened* 0.3 → 5.3pp, because 2 of the 4 removed
pieces were neyzen and neyzen is the small pool (74 → 64 strips) — the contaminated (easier) strips
had been flattering neyzen specifically. Still well inside the ≤12pp floor.

**`data/real/rung3/strips_exam_v2_clean/` is the honest reference from here on**; exam v3 should be
built from it plus the guard fixes above.

### Disposition (2026-07-23): SHIP as an improvement, not a pass

Decided (`docs/rung3/round1.md`): Round 1 ships despite the failed floors, because on the clean
327-strip exam it strictly dominates the deployed `rung22-stemfix` (AEU 64.1 → 66.3%, F1 57.0 →
66.5%, SER 0.147 → 0.060, exact 17.3 → 49.2%, tup3 precision 15.1 → 93.5%, arc→`\tup3`
77.6% → 0.0%). This entry will be updated to **"SHIPPED as improvement-not-pass"** once the ship
chain (ONNX → int8 parity → browser gate) completes; the Round-1 CRITERIA remain FAILED and Round 2
continues. Round-2 entry begins with two cheap redirect-checks (photo exam + real-val rebuild).

### ✅ SHIPPED 2026-07-23 (improvement-not-pass) — `round1-best` int8 is the runtime

Ship chain complete; `round1-best` int8 ONNX staged into `apps/web/public/models/` (backup of the
prior rung22 runtime at `data/checkpoints/_public_models_backup_rung22/`, gitignored — revert =
re-stage it). This did NOT meet the Round-1 criteria (6 floors failed); it ships because it strictly
improves on the deployed `rung22-stemfix` and the tup3/arc pathology fix is worth getting to users
now. Round 2 continues.

- **ONNX export:** encoder / decoder / decoder-with-past (optimum float-validation max-diff ~5e-5,
  benign — id-space parity is the real gate). int8: 829 MB → 221 MB (91 + 69 + 61).
- **Parity (the real gate): fp32 10/10 PASS, int8 10/10 PASS** — ONNX == PyTorch AND ONNX == label,
  in id space, over 10 of a fresh 14-strip gate list spread across 14 makams/pieces
  (`GATE_STRIPS.txt` regenerated: the Colab checkpoint arrived without one; strips chosen as
  exact-decoding v3 val strips with `\sig` + accidental coverage).
- **Browser gate (headless Chromium via Playwright, ORT-web wasm int8): 19/20 strips clean — NOT a
  clean 20/20.** One strip (`hicaz--…--yalan_degil`) drops a single augmentation dot on a
  double-dotted note: label `a''2..` → decode `a''2.` (the second double-dot `b''2..` stayed
  correct). Diagnosis: **an ORT-web int8 numerics wobble, model-independent** — both the reference
  tensor (Python's exact pixels) and the canvas path fail *identically* (rules out JS
  preprocessing), and Python-ORT int8 decodes the strip correctly (rules out the graph). The prior
  rung22 gate had **0/10** double-dot strips, so this token pattern was **never gated before**; the
  newly diversified gate surfaced a pre-existing runtime limitation, not a Round-1 regression. It is
  a duration error (a dot), visible and editable in the product, never a pitch/accidental error.
  **→ Round-2 investigation item: ORT-web int8 divergence on double-dot durations** (quantization
  granularity per-tensor vs per-channel; compare fp32-in-browser). Logged, not blocking this ship.

## Round-2 run-first diagnostics (2026-07-23) — tier decomposition + degrade probe

Free, pre-Round-2 analyses (docs/rung3/round1.md, addenda items 1 & 4). No training; the exam read is
still the spent one — these regroup/degrade already-seen strips, zero new leakage.

### Item 1 — the 28pp real-val↔exam gap, decomposed by difficulty tier

Both pools partitioned by emit provenance: **easy** = clean auto-accept (reason=None, nd≤0.10),
**mid** = promoted review (acc_disagreement/sig_mismatch/nd_review/low_coverage), **hard** =
`row_unaligned`/`nd_high` (the tail the accept gate drops). `round1-best` per tier:

| tier | real-val | exam | Δ |
|---|---|---|---|
| easy | 96.8% (160) | 94.8% (62) | **2 pp** |
| mid | 91.9% (111) | 63.0% (145) | **29 pp** |
| hard | — (0 strips) | 58.3% (145) | n/a |
| overall | 95.0% | 66.6% | 28 pp |

**Two independent inflation sources, not one:**

1. **Composition dominates the headline gap.** Real-val has **0%** hard-tier; the exam is **41%**
   hard-tier at 58%. Real-val simply never contains the strips the model is worst on. The planned
   hard-tail-inclusive rebuild fixes this.
2. **Edition familiarity is SMALL — the rebuild need NOT be edition-disjoint.** On clean (easy)
   strips real-val 96.8% ≈ exam 94.8% (2 pp). If trained-edition familiarity were large, clean
   real-val would beat clean exam by much more. It doesn't. (Resolves the Step-4.3-vs-4.4
   ambiguity: **composition, not edition**.)
3. **NEW — a decode-self-agreement inflation in the mid tier.** real-val mid 91.9% vs exam mid
   63.0% on the *same provenance category* (29 pp). The driver: real-val's mid tier is ~45%
   `acc_disagreement` strips whose **labels ARE the decode** (that adjudication sided with the
   decode 187:14). Evaluating the model against decode-derived labels measures self-consistency,
   not correctness — it scores high by reproducing its own past read. The exam's mid tier is mostly
   `nd_review` (hand-fixed), so it carries no such bias.

**Consequence for the real-val rebuild (what item 1 exists to gate):** hard-tail-inclusive ✅,
edition-disjoint ❌ not needed, **but decode-derived labels must be excluded from (or hand-verified
in) the metric pool** — otherwise the rebuilt real-val re-inflates exactly as its mid tier does now.
*This directly bears on dropped item 6 (hand-verify the hard tail): the evidence argues for keeping
at least the "exclude decode-labeled strips from real-val" part of it.*

### Item 4 — degraded-strip probe: hallucination is NOT ambiguity-driven

`round1-best` on real-val at 5 degradation levels (fade + blur, labels unchanged). **Per-class
precision and accidental emission rate are FLAT** across clean→OOD: komaFlat 92.2→93.5%, bakiyeFlat
94.2→92.7%, bakiyeSharp 89.8→89.8%, **emission 1.25→1.26 accidentals/strip**; AEU 94.5→94.3%. By the
probe's pre-registered rule this is the "precision holds → the model abstains, residual is
legibility, NOT a distributional prior" branch. **So Round 2 should NOT invest in renderer
accidental-rate deconfounding to fix hallucination** — degradation does not provoke it. Consistent
with item 1 and the exam: the komaFlat precision miss (63.8% on the exam vs 92%+ on real-val) is
**makam/signature-specific** (the synthetic-reproducible carry-mode `\komaFlat`-under-`\kucukFlat`-sig
bug), not a general ambiguity effect. Caveat: real-val is the easy pool and fade+blur ≠ real nota
print noise, so this is suggestive, not a proof the hallucination can never be provoked.

### Carry-sig bug — characterized (2026-07-24): context-blind accidental hallucination

`round1-best` on 1,500 synthetic val strips (perfect labels, pixels bare by construction, so any
inserted accidental is a *pure* hallucination). Analysis: `align()` insertions of AEU tokens vs the
gold, cut by `Strip.mode` and note degree.

**Findings (they overturn the first single-example guess):**
- **Carry-mode-specific: 61/64 false insertions on `measure` strips (~6%), 3/476 on `every`.**
- **Concentrated on the makam-active degrees: b/si 37, a/la 14, f 7, e 6.**
- **Only 4/64 re-state a visible signature pitch** (`\kucukFlat b` sig → inserted `\komaFlat b`, wrong
  koma family). The dominant 60/64 are accidentals invented on a **bare** notehead with no accidental
  in the pixels.
- Wrong-class swaps are rare (`\buyukFlat`→`\bakiyeFlat` ×5).

**Mechanism (measured, not assumed).** Per-degree P(explicit accidental precedes the note) in the
training labels: **carry** 1–8% (b 3.6%, a 4.2%, f 7.7%) vs **every** 30–71% (a 71%, b 50%, e 51%).
The corpus genuinely alters si/la/mi/fa often; every-mode spells it, carry-mode implies it (signature
at row-start + measure carry). A cropped mid-row carry strip has **discarded the signature**, so a
bare si is ambiguous between koma-flat-from-signature and natural — information that is simply not in
the strip. The model resolves the ambiguity with the corpus prior on these degrees instead of the
pixels → over-emits. This is the real-page `\komaFlat` precision miss (exam 63.8%): same degree family,
worse because real mid-row strips are context-blind AND blurrier.

**Not** distributional (item 4: precision flat under degradation), **not** primarily sig-restatement
(4/64), **not** a rendering/label error (synthetic pixels are bare by construction).

**Fix decision this creates (Round-2, `docs/rung3/round2.md`):** the root cause is *information loss*
— strip-level carry decoding cannot see the signature that defines the alteration. Options:
1. **Inject the effective signature into each strip** — either repeat `\sig` per-strip in the carry
   label (re-render + retrain; must also change the REAL-strip emitter so synthetic/real stay aligned)
   or propagate the row-start signature as decode context in the stitcher (model-agnostic; labels
   unchanged). Attacks the root.
2. **Weaken the prior** — carry hard-negatives (bare-natural si/la) or lower every-share. Palliative;
   caps the achievable precision because the ambiguity remains; brushes the cancelled every-share
   sweep, so flag if pursued.
3. **Decode-repair** — drop inline accidentals that restate an active signature alteration; only the
   4/64 visible-sig cases, narrow.

The architectural insight worth stating plainly: **a bare notehead whose alteration is defined by an
off-strip signature is not decidable from the strip alone** — so the durable fix is context injection
(option 1), not more training against the prior.

#### Carry-bug fix direction (2026-07-24) — it's a learned PRIOR, not context-loss

Correction to the earlier "context injection" framing (the user's point): under the carry
convention the correct label for a bare notehead is ALWAYS bare — the signature is read once
(row-start strip) and applied downstream (phase 4). So the model's job is pure transcription
(bare→bare); no per-strip signature context is needed, and injecting it would be wrong. The bug is
simply the model **inventing an accidental glyph that is not drawn** — a precision failure, fixable
in training.

Cause, now pinned by three measurements:
- **Not glyph-uncertainty** — item 4: precision is flat under blur/fade degradation.
- **Not data-scarcity** — carry labels are 96.4% bare on `b` (the model sees bare→bare constantly).
- **A learned prior** on the makam-active degrees, **concentrated on context-blind mid-row strips**
  (no `\sig` block): mid-row strips trigger the over-emission ~3.3× more per strip than row-start
  strips. The model appears to have learned "altered music declares its alteration somewhere"; when
  the row-start signature is off-strip, that expectation leaks out as spurious inline accidentals.

**Fix experiment (pre-registered; Colab retrain, GATED ON the photo-exam redirect check):** test
prior-reduction levers — (a) reduce every-mode influence (its 50–71% per-degree accidental rate is
the prior's likely source), (b) oversample mid-row bare strips as hard negatives, (c) a product-side
cleanup that drops inline accidentals on mid-row strips matching the row signature (the user's
"phase 4 handles it" insight — model-agnostic, no retrain). **Measure:** carry-mode false-insertion
rate on b/a/f/e (synthetic, perfect labels) + exam `\komaFlat` precision. Palliative-vs-root note:
(a)/(b) reduce the prior; (c) cleans the output directly and needs no training — likely the cheapest
first move.

## Round 2 — `strips_v4` two-stage fine-tune (Colab, 2026-07-26): converged

L4, batch 16, `--every-share 0.15`, `--num-workers 10`. Corpus `strips_v4` / `split_v4.json`
(36,057 synthetic train / 4,769 synth-val).

- **Stage 1** — synthetic only from BASE, lr 3e-5, 6,000 steps, ~1.25 s/step. Val loss
  0.1009 → **0.0111**, flat from step 4000 (0.0123 / 0.0119 / 0.0111 / 0.0112 / 0.0112). Converged.
- **Stage 2** — real specialisation from stage-1 `best`, lr 1e-5, warmup 100, 2,000 steps, real
  pools at `:9` (1,523 + 395 + 148 train ×9 = 18,594 → **34.0%** of 54,651 items).
  `exam-disjointness OK: 444 real pieces, 0 in the 33-piece exam`.

| step | synth val | **real val** | mix (what `best` tracks) |
|---|---|---|---|
| 500 | 0.0087 | **0.0988** | 0.0136 |
| 1000 | 0.0074 | **0.0976** | 0.0123 |
| 1500 | 0.0071 | **0.1021** | 0.0122 |
| 2000 | 0.0067 | **0.1020** | 0.0118 |

**Real val loss bottomed at step 1000 and rose after**, while the synth-dominated mix kept falling —
so `best` followed the mix, landed on the final step, and `best` == `last` (their real-val evals are
byte-identical). This is the Round-1 caveat reproducing exactly: oversampled real overfits fast and
the checkpoint selector does not see it. Training stage 2 longer was rejected on this evidence;
shortening it was also rejected, because choosing steps on real-val is tuning on a metric with a
measured 28pp gap to the exam.

Real-val (271 strips): AEU recall 96.3%, mean F1 90.3%, SER 0.027, exact 66.8%.
**Real-val could not see this round's work:** `\kucukSharp` recall 95.2% — identical to Round 1
Arm A's 95.2%, on n=21. It was already saturated on the class the round existed to fix.

## Round 2 — exam v2.1, read ONCE (2026-07-27): ⛔ headline regressed, NOT shipped

`eval_omr.py --checkpoint data/checkpoints/round2-stage2-best --strips-dir
data/real/rung3/strips_exam_v2_clean --split none` (326 strips, re-audited gold). Full console
output kept at `data/colab/round2-exam.txt`; all 156 mismatching strips at
`data/colab/round2-exam-errors.txt`.

Headline **74.2% recall / 73.9% mean F1**, SER 0.052, exact 52.1%. Against `round1-best` on the
**identical set with identical gold** (its 2026-07-25 read): 78.5% / 78.0%, SER 0.059, exact 50.0%.
Floors table and the print-position split: `docs/METRICS.md`.

Per-class recall: koma♯ 21.4 · bakiye♯ 91.7 · küçük♯ 69.7 · koma♭ 90.5 · bakiye♭ 87.0 · küçük♭ 85.0.

**Substitution census over the 156 mismatching strips** (parsed with a token alternation — the
decode prints tokens unspaced, e.g. `\kucukSharpf`, so a naive `\\[A-Za-z]+` undercounts):

| gold → decoded | n | inside `\sig` |
|---|---|---|
| `\kucukSharp` → `\komaSharp` | 8 | 8 |
| `\komaSharp` → `\kucukSharp` | 7 | 7 |
| `\natural` → `\bakiyeSharp` | 3 | 0 |
| `\bakiyeSharp` → `\komaSharp` | 2 | 1 |

Net `\komaSharp` emission over those strips: **0**.

**Verdict.** The label-noise fix did what it was predicted to do — the Round-1 one-directional
küçük→koma fallback is gone and küçük-in-signature went 50 → 72%. Underneath it is a **symmetric
koma↔küçük confusion confined to the key signature**: a discrimination failure, not a bias. It
destroys `\komaSharp` (n=14, F1 21.4%) and a six-class mean carries that into the headline.

**Next measurement, before any re-render:** every fidelity number we have (`sharp_probe`, 0.300 S
bar weight, küçük pitch widened to 0.65 S) was taken on INLINE glyphs. Signature glyphs are packed
at `SIG_GLYPH_ADVANCE = 13 px`, have never been measured, and hold 32 of the exam's 33 küçük tokens
— where extra bar width may hurt rather than help.

## Headline re-scoring — MICRO / MACRO≥30 (2026-07-27): Round 2's regression was a metric artifact

`scripts/rung3/rescore_headline.py` recomputes low-n-robust headlines from any stored `per_class`
block (hits = gold×recall, fp = hits/precision − hits), so every past run is re-scorable with **no
model re-run and no exam re-read**.

| 326 clean strips | macro R | macro F1 | micro R | micro F1 | macro≥30 R | macro≥30 F1 |
|---|---|---|---|---|---|---|
| `round1-best` | 78.5% | 78.0% | 83.9% | **85.0%** | 81.4% | 83.9% |
| `round2-stage2-best` | 74.2% | 73.9% | **84.8%** | 84.8% | **84.8%** | **84.4%** |

Round 2 is flat-to-better on every low-n-robust measure; the −4pp macro drop is `\komaSharp` (n=14)
inside a six-class mean. Combined with SER 0.059 → 0.052 and exact 50.0 → 52.1%, the "regression"
does not survive.

Earlier reads, same treatment (macro → micro): `strips_exam_v2` 352 strips 66.6% → 84.1%;
`_exam_tier_mid` 63.0% → 84.2%; `_exam_tier_hard` 58.3% → 77.5%. **Macro has been reporting 66–78%
throughout this project while token-level accidental accuracy sat at 83–85%.** Both are real; they
answer different questions, and only macro was ever quoted.

**Not done on purpose:** micro was not promoted to the headline (it was computed after the fact and
flatters us, and the 85% floor was pre-registered against macro), and the target was not restated.
The repair is more `\komaSharp` gold in exam v3 — see `docs/DECISIONS.md`.

## Edit-budget analysis of the Round-2 exam (2026-07-27): accidentals are 13% of user corrections

No decode re-run — the 156 mismatching strips in `data/colab/round2-exam-errors.txt` re-aligned with
the eval's own `align()` and each edit classified by token category.

| what the user fixes | edits | share | excl. 12 catastrophic strips |
|---|---|---|---|
| pitch (letter/octave) | 222 | 40% | 36% |
| duration | 158 | 28% | 29% |
| rhythm signs | 74 | 13% | 16% |
| accidentals | 73 | 13% | 13% |
| structure | 26 | 5% | 5% |
| signature delimiters | 9 | 2% | 1% |

Concentration: 42/326 strips carry 63% of edits, 11 carry 29%, 12 are >50% wrong and carry 21%.
Note-substitution mix (96): duration-only 38%, multiple-differ 30%, letter-only 27%, octave-only 5%;
plus 55 whole notes inserted/deleted (loss of count, not glyph misreading).

**Crop-shape gap:** signature-only strips are 0 of 40,826 in `strips_v4` and 4 of 326 on the exam
(28% of exam strips have ≤8 label words). Worst strip: gold `\sig \kucukFlat b \kucukFlat e
\kucukFlat a \sigend`, decode `\sig\bakiyeFlatb \sigend\volta2b'16 c''8 g''8 g''8` — 19 edits on 8
gold tokens. `stripExport` chunks whole measures, so the shape cannot appear in training.

**Negative result (keep):** all 5 octave-only substitutions are implausible-gold cases — gold leaps
≥4 scale steps from both neighbours where the model reads stepwise. Almost certainly mislabels, and
consistent with the 187:14 decode-over-SymbTr adjudication precedent — but ≈1% of edits, and the
training pools carry isolated octave spikes in only 0.1–0.2% of strips. Not the pitch lever.
