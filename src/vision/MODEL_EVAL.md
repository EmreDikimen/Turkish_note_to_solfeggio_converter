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
  closing it is exactly the Round-1 fine-tune's job (`docs/RUNG3.md` step 4).
- **Honesty caveats (printed by `eval_omr.py` itself):** matched-piece exam = an upper bound
  for real-world accuracy; AND these 33 auto-labelable strips are the alignment-certain end
  of the exam pieces (accidental-disagreeing strips sit in the review queue awaiting human
  adjudication — the exam grows as `data/real/rung3/strips_exam/emit_review.csv` is worked
  through). büyük classes: zero on real pages (untransposed) — unmeasurable by design.
- Baseline eval row appended to `data/checkpoints/rung22-stemfix-best/eval.jsonl`
  (`caveat: matched-upper-bound`, `per_source`).

## Round-0.5 — rung3-labeler fine-tune (2026-07-15): PASS (tooling checkpoint, NEVER shipped)

Throwaway emitter/decode_page checkpoint (docs/RUNG3.md §1a.5): fine-tuned FROM
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
