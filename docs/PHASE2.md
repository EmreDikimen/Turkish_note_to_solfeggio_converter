# Phase 2 — Synthetic data + fine-tune a pretrained OMR model (kickoff & hand-off)

> Read `ROADMAP.md` §3 (Phases 2–4) and §5 (risks) for the canonical plan. This doc orients a
> fresh session: what Phase 2 is, what's already done, what to build first, and how to de-risk it.

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
- **Lead candidate model:** `Flova/omr_transformer` on HuggingFace — a Donut-style vision-encoder-
  decoder (image → LilyPond), Western-trained, downloadable (Apache-2.0). **Gated:** evaluate it first
  (§4); fall back to a lighter **CRNN+CTC** (PrIMuS-based) if its output format is awkward to extend or
  its size hurts the mobile/ONNX goal.
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
- **Image augmentation (Python/OpenCV):** rotation, perspective warp, blur, paper texture, ink
  bleed, lighting gradients, JPEG noise, slight staff curvature. ⚠️ **This decides success more than
  the model architecture.**

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
- **Rung 0 — model gate (~½ day):** §4 above. Confirm the downloaded model reads notes and we know how
  to extend it. **Start here.**
- **Rung 1 — wiring proof + model GO/NO-GO (~1–2 days, runs on the Mac via MPS):** render ~50 short
  strips with labels in the model's format, wire the fine-tuning loop (load weights → extend tokenizer
  → train — **freeze NOTHING for this test**, the whole model is trainable), and **overfit 10 samples**
  until the model reproduces them exactly (accidentals included).
  This is the **decision point for `omr_transformer`**: a clean overfit → keep it and scale (Rung 2);
  **can't overfit 10 → pivot to the CRNN/PrIMuS fallback**. The base model's raw accuracy on unseen
  styles is poor-but-expected (seen in Step-1 tests), so *this* — whether it can learn our notation —
  is how we judge the model, not the raw eval. (The overfitted checkpoint is a **throwaway
  diagnostic** — it only proves the wiring; Rung 2 re-starts from the original pretrained weights.)
- **Rung 1.5 — ONNX/browser gate (~1 day, BEFORE paying for GPU time):** the product premise is
  **in-browser inference**, and an autoregressive encoder-decoder is the *hard* export case
  (past-key-values, a generation loop that must be re-implemented in JS) — so prove it now, while
  changing models is still cheap. Export the model to ONNX (`optimum-cli export onnx` → encoder +
  decoder-with-past graphs), load it with `onnxruntime-web`, hand-roll the greedy decode loop in JS,
  and decode **one strip in a real browser**; measure latency. Pass → buy Colab Pro and scale (Rung 2).
  Fail or unusably slow → that's a model-choice fact: the **CRNN+CTC fallback is a single forward
  pass** and exports trivially. (Model hosting: serve the ~143 MB int8 file from the **HuggingFace Hub
  CDN** — free; the browser downloads and caches it. No server needed.)
- **Rung 2 — scale (Colab Pro — the Mac is fine for overfit-10, not for thousands of images through
  143M params):** thousands of augmented strips, training **from the original pretrained weights**;
  **full fine-tune at a small LR** (AdamW, ~1e-5–5e-5) — freezing the encoder is a **memory/compute
  fallback, not the default**: our images (VexFlow engraving, later phone photos) don't look like the
  base model's training images, so the encoder needs to adapt too. Mix in **Western rehearsal data**
  (incl. repeat-sign strips — see §6) + measure the **headline metric: per-class accuracy on the 8 AEU
  accidentals** (SER secondary) on a held-out synthetic split. ⚠️ **Split train/val BY PIECE, not by
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
- Render **both lyric and lyric-free** strips, and **randomize header/footer text** so the model
  learns to ignore non-musical text (real photos always have it).
- Keep audio/`koma53` untouched by rendering changes — it's the decoder's source of truth.
- **Headline metric:** per-class AEU-accidental accuracy. **Western rehearsal data** is mixed into
  fine-tuning. **Makam stays out of the OMR model.**

## 7. Before scaling Phase 2 (checklist)
- [x] **Step 1 model gate** — `omr_transformer` evaluated (`src/vision/MODEL_EVAL.md`): passed
      (reads notes, LilyPond output, vocab extendable, ~143M params). Final go/no-go = overfit-10.
- [ ] Confirm green typecheck (`npx tsc` core + web).
- [x] **Label output format decided AND implemented** — LilyPond + AEU tokens, **faithful +
      signature scheme** (§4), in `tools/render/lilypond.ts` (2026-07-02). Round-trip verified on
      all sample scores. ⚠️ Regenerate any previously rendered strips — old ones carry semantic labels.
- [x] Scaffold `tools/render/` (Playwright strip renderer — done, incl. Strip panel + decoder CLI).
      `src/vision/` has the eval script; the dataset/fine-tune/eval scripts are still TODO.

## 8. Next action
1. ~~Switch the label serializer to the faithful + signature scheme~~ — **done (2026-07-02)**;
   regenerate strips via `tools/render/render.ts` if old ones exist.
2. Run **Rung 1: the overfit-10 go/no-go** (§5) — wire the fine-tune loop (load weights → extend
   tokenizer → train, nothing frozen) and overfit 10 strips until reproduced exactly, accidentals
   included. Runs on the Mac (MPS). Clean overfit → keep `omr_transformer`; can't → CRNN fallback.
3. Run **Rung 1.5: the ONNX/browser gate** (§5) — export to ONNX, decode one strip in the browser
   via `onnxruntime-web`, measure latency. Only after BOTH gates pass, buy Colab Pro and scale.
