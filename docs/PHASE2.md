# Phase 2 — Synthetic data + fine-tune a pretrained OMR model (kickoff & hand-off)

> Read `ROADMAP.md` §3 (Phases 2–4) and §5 (risks) for the canonical plan. This doc orients a
> fresh session: what Phase 2 is, what's already done, what to build first, and how to de-risk it.
> **Phase numbering:** the rung ladder (§5) spans ROADMAP Phases 2–3 — Rungs 0–1.5 + data gen are
> Phase 2; Rung 2 (scaled fine-tune) and Rung 3 (real photos) are ROADMAP's Phase 3; Rung 4 is
> Phase 4. "Phase 2" in commits/this doc's title is the working label for the whole kickoff.

## 1. The project in one line
Photograph Classical/Art **Turkish (makam)** sheet music → recognize the notes *including
microtonal accidentals* → an **editable** note model → play back at exact **53-TET (AEU)** pitch.
Ship the web app first (in-browser inference, **no server** — can't afford hosting), then convert it
to mobile. Python is training/data only.

## 2. Where we are (Phase 1 DONE — the renderer is ready)
The harness engraves sheets that look like real **Classical Turkish Music** scores, which is
exactly what Phase 2 renders into training images:
- **AEU accidentals only** on the staff (`toAeuAlter` snaps every alteration to koma/bakiye/küçük·
  büyük mücennep; no numbered ±2/±3 "folk" signs). The exact koma (sounding pitch) is preserved in
  the data — the editor still shows it — and is recovered later by the makam-aware decoder.
- **Lyrics** (syllables, melisma underscores, optional hyphens), an **engraved header**
  (makam/form/title/usul/tempo/composer), **justified rows**, correct AEU **key signatures**.
- **Concert-pitch tuning** (anchor a fourth below written) and **transpose** (incl. sound-only ahenk).
- SymbTr→note-model→render pipeline works; 3 sample scores in `apps/web/public/`.

## 3. Phase 2 goal — fine-tune a pretrained OMR model on synthetic Turkish data
We **transfer-learn**: take a model that already reads Western notation and teach it the one new thing
this project needs — the Turkish microtonal accidentals. No model is trained from raw weights.
```
download pretrained Western OMR model ──► extend its vocab with Turkish AEU accidentals
        ▲                                              │
        │ (gated by a quick eval, §4)                  ▼
SymbTr → note-model → (TS) render staff PNG ─► (Python) fine-tune (image, label) pairs
                          │                              ↑
                          └── label emitted in the MODEL'S output format, same render pass ──┘
```
- **Chosen model (all gates passed):** `Flova/omr_transformer` on HuggingFace — a Donut-style
  vision-encoder-decoder (image → LilyPond), Western-trained, downloadable (Apache-2.0). It passed
  the Step-1 eval (§4), the Rung-1 overfit-10 (GO), the Rung-1.5 ONNX/browser gate (PASS) and the
  Rung-2 scaled fine-tune (PASS, 99.9% headline — §5). The lighter **CRNN+CTC** (PrIMuS-based)
  fallback is fully retired (export concern at Rung 1.5, accuracy concern at Rung 2).
- **Render with VexFlow headless** (Playwright minimal page), reusing the harness engraving (the
  engraving relies on DOM SVG + `getComputedTextLength` + the Bravura web font, so a real browser is
  the low-risk way to reuse it exactly). Render **FROM the note model**, so labels are emitted from the
  same data that draws the image (perfect alignment, no re-parse) — **in the chosen model's output
  format**. The label generator is TypeScript; OpenCV augmentation is Python.
- **Render SHORT strips (~2–4 measures) at a model-friendly size/aspect** (≈ the model's input frame,
  e.g. ~583×409 for `omr_transformer`) — not whole wide rows. Long lines overrun the decoder's token
  cap (notes go missing), and extreme wide-short strips get squashed on resize, blurring beam/flag
  detail so durations flip (8th↔16th). Both were observed in the Step-1 tests.
- **Pitch augmentation:** core `transpose(doc, commas)` — render each piece at several transpositions.
- **Image augmentation (Python/OpenCV+albumentations, on-the-fly in the training loader):**
  ⚠️ **This decides success more than the model architecture** — and it must match what users
  actually upload: **mostly WEB SCREENSHOTS** (scores viewed in a browser/PDF — clean geometry,
  flat white, only resampling/JPEG damage); camera photos of printed pages are the minority
  (user, 2026-07-06). So `src/vision/augment.py` mixes two profiles at `PHOTO_SHARE = 0.35`:
  **screenshot** (65%: down-up rescale softness, JPEG, tiny brightness/contrast, light noise;
  a slice passes nearly clean) and **photo** (35%: rotation, perspective warp, staff curvature,
  ink bleed/fade, paper texture, soft shadows, lighting gradients, blur, sensor noise, JPEG).
  Revisit the ratio at Rung 3 against real usage. Preview grid (the human gate on strength):
  `python src/vision/augment.py --out data/synthetic/aug_preview.png`.

## 4. Step 1 — evaluate the candidate model FIRST (the gate)
Before building any pipeline, download `omr_transformer` and check the things that decide everything
downstream:
- Does it **read Western notation** well (run it on a Western sample + a few of our rendered staves)?
- What is its **exact output format** (LilyPond token stream)? Can our renderer emit labels in it?
- How do we **extend its tokenizer/vocabulary** with the microtonal accidental tokens?
- **Model size** — viable to export to ONNX and (eventually) run on mobile?

Record findings in `src/vision/MODEL_EVAL.md`. If it fails the gate, evaluate the CRNN/PrIMuS fallback
before committing. **The accidentals are the only new thing we teach it** — the AEU signs
(koma/bakiye/küçük·büyük mücennep) as new output tokens. The **exact koma is NOT a token**; the
**decoder (Phase 4)** turns (AEU sign + makam) back into the precise koma.

**makam/usul/tempo are header metadata, NOT model outputs.** Predicting makam would overcomplicate the
model and overfit (many classes, a global property a single strip can't determine). Keep it as a
separate header-reading step (printed name + small classifier/heuristic) and **user-editable**.

**Label scheme — FAITHFUL + signature extraction (agreed; supersedes the earlier "semantic" scheme,
which broke mid-row crops).** The label marks only what is *drawn* on each note — an explicit deviation
accidental, an explicit **`\natural`** (cancel), else **bare**. **Row-start strips** (crop includes the
clef + signature) also **prefix the read key signature** (`\sig … \sigend`) so the OMR *extracts* it —
a **makam-independent** source of the row's default accidentals (crucial for photos with no makam). The
Phase-4 decoder resolves each **bare** note from the OMR-read signature and/or the makam's per-degree
defaults; explicit accidental/natural override; `makam = none` + no signature → as-written. New tokens:
the 8 AEU accidentals + **`\natural`** + **`\sig`/`\sigend`** + `|` + `3`. Treble is assumed (universal
in the repertoire), so clef-less mid-row crops are fine.

## 5. The de-risk ladder (never invest a week before a day proves it works)
- **Rung 0 — model gate (~½ day)** ✅ **passed:** §4 above. Confirm the downloaded model reads notes and we know how
  to extend it. **Start here.**
- **Rung 1 — wiring proof + model GO/NO-GO (~1–2 days, runs on the Mac via MPS)** ✅ **GO (2026-07-02):** render ~50 short
  strips with labels in the model's format, wire the fine-tuning loop (load weights → extend tokenizer
  → train — **freeze NOTHING for this test**, the whole model is trainable), and **overfit 10 samples**
  until the model reproduces them exactly (accidentals included).
  This is the **decision point for `omr_transformer`**: a clean overfit → keep it and scale (Rung 2);
  **can't overfit 10 → pivot to the CRNN/PrIMuS fallback**. The base model's raw accuracy on unseen
  styles is poor-but-expected (seen in Step-1 tests), so *this* — whether it can learn our notation —
  is how we judge the model, not the raw eval. (The overfitted checkpoint is a **throwaway
  diagnostic** — it only proves the wiring; Rung 2 re-starts from the original pretrained weights.)
- **Rung 1.5 — ONNX/browser gate (~1 day, BEFORE paying for GPU time)** ✅ **PASS (2026-07-03):** the product premise is
  **in-browser inference**, and an autoregressive encoder-decoder is the *hard* export case
  (past-key-values, a generation loop that must be re-implemented in JS) — so prove it now, while
  changing models is still cheap. Export the model to ONNX (`optimum-cli export onnx` → encoder +
  decoder-with-past graphs), load it with `onnxruntime-web`, hand-roll the greedy decode loop in JS,
  and decode **one strip in a real browser**; measure latency. Pass → buy Colab Pro and scale (Rung 2).
  Fail or unusably slow → that's a model-choice fact: the **CRNN+CTC fallback is a single forward
  pass** and exports trivially. (Model hosting: serve the int8 ONNX files — **221 MB** total across
  the encoder / decoder / decoder-with-past graphs, per the actual Rung-1.5 export — from the
  **HuggingFace Hub CDN** — free; the browser downloads and caches them. No server needed.)
- **Rung 2 — scale (Colab Pro)** ✅ **PASS (2026-07-07, first try — headline 99.9% mean per-class
  AEU accuracy, SER 0.001, exact-match 96.8% on the held-out pieces; full log in
  `src/vision/MODEL_EVAL.md`; the CRNN fallback is retired):** (the Mac is fine for overfit-10,
  not for thousands of images through 143M params) thousands of augmented strips, training
  **from the original pretrained weights**;
  **full fine-tune at a small LR** (AdamW, ~1e-5–5e-5) — freezing the encoder is a **memory/compute
  fallback, not the default**: our images (VexFlow engraving, later phone photos) don't look like the
  base model's training images, so the encoder needs to adapt too. Mix in **synthesized repeat-sign
  strips** (see §6; no Western rehearsal data — plan updated) + measure the **headline metric:
  per-class accuracy on the 8 AEU accidentals** (SER secondary) on a held-out synthetic split. ⚠️ **Split train/val BY PIECE, not by
  strip**: every strip and every transposition of a piece goes into the same split. Strips of one
  piece are near-duplicates (same melody, same engraving); if a piece straddles both splits,
  validation is contaminated and the metrics look great while proving nothing.
- **Rung 3 — the moment of truth:** run on real phone photos (worse — the expected synthetic→real
  gap), then **fine-tune on a few hundred real photos** labeled via *this app's editor*. This small
  real set matters more than any hyperparameter.
- **Rung 4 (Phase 4):** wire preprocess → staff isolation → model → decode → note model → editor;
  run on-device via `onnxruntime-web`.

**Three reassurances:** (1) we only teach the model the AEU accidental tokens — the easy end of OMR
(monophonic, small known new vocab, self-generated perfect labels) — on top of a model that already
reads notes; (2) metrics make each fear measurable (**per-class accidental accuracy** is the headline);
(3) the **editable note model is the safety net** — OMR needn't be perfect, the user corrects it.

## 6. Known gaps / decisions to carry forward
- **SymbTr has no repeats/voltas/D.C./ties/slurs** (flattened out) → can't auto-label them from
  SymbTr. **Validated 2026-07-02 against the full dataset:** zero of the 2,200 MusicXML files contain
  `<repeat>`, `<ending>` (volta), segno, coda, or any `<bar-style>`; the mu2 files have no repeat rows
  either. But real photos **do** show repeat signs, so the model must **recognize** them. **Primary
  plan: synthesize them ourselves** — VexFlow draws repeat barlines (`Barline.type.REPEAT_BEGIN/END`)
  and voltas (the `Volta` stave modifier), so the strip renderer can inject repeat signs into a
  fraction of strips with self-generated labels, exactly like every other symbol. Do NOT count on the
  base model's Western pretraining surviving fine-tuning (it's a small model and SymbTr strips are
  repeat-free — whatever it knew would be forgotten). The pipeline then **flattens/expands** repeats
  on output (the section is shown twice, no repeat sign). Tuplets DO exist (MusicXML); barlines come
  from SymbTr `offset` (`assignBars`/`groupMeasures`).
  - **Encoding decided 2026-07-02: 4 new faithful drawn-symbol tokens** — `\repstart` `\repend`
    `\volta1` `\volta2`. The base vocab's structural `\repeat `/`volta ` tokens are unusable (a crop
    usually shows only one end of a repeat; no braces in the vocab anyway — see `MODEL_EVAL.md`).
    Plain `|` stays in the labels: each read barline re-anchors measure reconstruction, so a duration
    misread corrupts one measure instead of desyncing the rest (and the editor pivots on measures).
  - **Placement: duplicate-run detection + random injection.** SymbTr's flattening leaves each
    repeated passage as an adjacent duplicate measure run, so the sign positions are recoverable
    (equal runs → repeat signs; equal-but-last-measure → volta 1./2.) — verified against the printed
    gamzedeyim score. **Implemented 2026-07-02** (`tools/render/repeats.ts` `detectRepeats` +
    serializer support): detection ONLY — the doc/layout/playback stay untouched; the signs are
    drawn onto the same engraving and strip labels carry the matching tokens (the still-drawn
    duplicate pass is invisible to 1–3-measure strips). ✅ **Random injection DONE (2026-07-05)**:
    `injectRepeats` (same file) adds 2–4 seeded spans on ~half of renders; 6.4% of v2 strips carry
    repeat tokens.
- **Navigation marks (segno 𝄋 / coda ⊕ / "D.C." / "Son") — same story as repeats, closed
  2026-07-06:** zero in SymbTr, but routine on real sheets (the neyzen.com engravings use the
  ⊕-jump + D.C. + Son form constantly), and without them the flatten/expand step can't finish a
  da-capo piece. **4 new faithful drawn-symbol tokens** — `\segno` `\coda` `\dc` `\fine` —
  injected like repeats (`tools/render/navmarks.ts`: seeded 4–6 marks on ~70% of renders via
  `navseed` — denser than a real page on purpose; at 2–4-marks/50% the rarer tokens simulated
  UNDER the audit floors — coda as an end→start ⊕ pair, D.C./Son above OR below the staff,
  never stacked on repeat/volta measures). Drawn in SheetView (Bravura glyphs + italic text), labeled at the drawn
  measure edge, decoded in `decode.ts`, audited with per-token floors (`audit_coverage.py`).
  ✅ **Re-rendered same day: `data/synthetic/strips_v2_1/` (18,627 strips), audit PASS** —
  injection density was set by SIMULATING the audit floors first (at the initial 2–4 marks on
  ~50% the rarer tokens came in under floor; shipped at 4–6 on ~70%). Also baked in: the
  centered-rest engraving fix (`alignRests` off in SheetView). Train on v2_1, not v2.
- **Strip-length coverage gap:** ✅ **CLOSED (2026-07-05)** — cap raised 46→56 (`STRIP_BUDGET`,
  one shared constant) and piece selection targets sparse pieces. Measured on the v2 render:
  39.9% of every-mode strips span 2–4 measures; `|` in 40.7% of labels. Two hard facts learned:
  a dense measure costs ~38 REAL tokenizer ids (≈4/note), so dense measures can never pair under
  the decoder's 60-id budget; and single measures that exceed the budget are now DROPPED at
  export (an over-budget label can never generate its EOS — a poisoned sample).
- ✅ Render **both lyric and lyric-free** strips (38.7% lyric in v2), and **randomize header/footer
  text** so the model learns to ignore non-musical text — drawn INSIDE the SVG crop bands
  (`apps/web/src/textNoise.ts`); the real engraved header is an HTML element outside the crops.
- ✅ **Büyük-mücennep coverage via low-rate AEU-enharmonic respell (2026-07-05, user decision):**
  the whole corpus has ~47 notes at ≥6 commas and smallest-alteration respelling can't exceed ±5,
  so `tools/render/respell.ts` flips a seeded ~8–15% of koma-sign notes to their exact büyük
  enharmonic (same pitch, other valid glyph) — enough for the decoder to LEARN the token (~1,150
  occurrences in v2), deliberately NOT rebalancing toward a sign real photos rarely show.
- Keep audio/`koma53` untouched by rendering changes — it's the decoder's source of truth.
- **Headline metric:** per-class AEU-accidental accuracy. **No Western rehearsal data** in
  fine-tuning (plan updated; repeat-sign coverage comes from our own synthesized strips, §6).
  **Makam stays out of the OMR model.**

## 7. Before scaling Phase 2 (checklist)
- [x] **Step 1 model gate** — `omr_transformer` evaluated (`src/vision/MODEL_EVAL.md`): passed
      (reads notes, LilyPond output, vocab extendable, ~143M params). Final go/no-go = overfit-10.
- [x] Confirm green typecheck (`npx tsc` core + web — clean as of 2026-07-02).
- [x] **Label output format decided AND implemented** — LilyPond + AEU tokens, **faithful +
      signature scheme** (§4), in `tools/render/lilypond.ts` (2026-07-02). Round-trip verified on
      all sample scores. Re-render DONE (2026-07-05): `data/synthetic/strips_v2/` carries the
      repeat-sign tokens + multi-measure coverage — audit PASS (ROADMAP §7).
- [x] Scaffold `tools/render/` (Playwright strip renderer — done, incl. Strip panel + decoder CLI).
      `src/vision/` has the eval script, the dataset wiring (`data.py`), the overfit-10 gate
      (`overfit10.py`), the ONNX-gate scripts, and the coverage audit (`audit_coverage.py`).
- [x] **Rung-2 training kit (2026-07-06):** `augment.py` (two-profile screenshot/photo
      augmentation, §3), `modeling.py` (shared model/tokenizer setup — the overfit-10-proven
      wiring), `train.py` (full fine-tune, AMP, warmup+cosine LR, val loop, checkpoint/resume
      for Colab), `eval_omr.py` (per-class AEU accuracy + SER via id-space Levenshtein
      alignment). Smoke-tested on the Mac: train → resume → eval all run end-to-end.

## 8. Next action

> **Canonical status + next action: `ROADMAP.md` §7** — the single section updated after every
> work session. Gate results (with full settings, bug notes, and export details) are logged in
> `src/vision/MODEL_EVAL.md`.

Short form: Rungs 0–1.5 are all **done** (model gate passed; overfit-10 **GO** 2026-07-02 — the
two decode-wiring fixes live in `src/vision/data.py`/`overfit10.py` and carry forward; ONNX/browser
gate **PASS** 2026-07-03 — see the ✅ markers in §5), the **Rung-2 dataset upgrades are DONE**
(now **`data/synthetic/strips_v2_1/`**, coverage audit PASS 2026-07-06 — carries the
navigation-mark tokens (§6) and the centered-rest fix; supersedes v2 — ROADMAP §7), and the
**Rung-2 training kit is DONE + smoke-tested** (2026-07-06: `augment.py` / `modeling.py` /
`train.py` / `eval_omr.py`, screenshot-dominant augmentation per §3). **Rung 2: PASS
(2026-07-07, first Colab Pro run)** — headline **99.9% mean per-class AEU accidental accuracy**
(8/8 classes), SER 0.001, exact-match 96.8% on the 20 held-out pieces; checkpoint local at
`data/checkpoints/rung2-best/` (Drive `MyDrive/tnc/rung2/best` is the backup); full log + error
taxonomy in `src/vision/MODEL_EVAL.md`; the CRNN fallback is retired. **Next (ROADMAP §7):
ONNX-export `rung2-best` via the proven Rung-1.5 pipeline** — it unblocks Rung-4 wiring AND the
Rung-3 model-assisted labeling loop; Rung-3 photo COLLECTION (`docs/PIPELINE.md` §3) can run in
parallel. The full-page inference pipeline + Rung-3 real-photo plan live in `docs/PIPELINE.md`.
