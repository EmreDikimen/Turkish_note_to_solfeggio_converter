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

## 5. The de-risk ladder (never invest a week before a day proves it works)
- **Rung 0 — model gate (~½ day):** §4 above. Confirm the downloaded model reads notes and we know how
  to extend it. **Start here.**
- **Rung 1 — wiring proof + model GO/NO-GO (~1–2 days):** render ~50 short strips with labels in the
  model's format, wire the fine-tuning loop (load weights → extend tokenizer → freeze early layers →
  train), and **overfit 10 samples** until the model reproduces them exactly (accidentals included).
  This is the **decision point for `omr_transformer`**: a clean overfit → keep it and scale (Rung 2);
  **can't overfit 10 → pivot to the CRNN/PrIMuS fallback**. The base model's raw accuracy on unseen
  styles is poor-but-expected (seen in Step-1 tests), so *this* — whether it can learn our notation —
  is how we judge the model, not the raw eval.
- **Rung 2 — scale:** thousands of augmented strips; fine-tune with **Western rehearsal data** mixed in
  (prevents catastrophic forgetting) + modest LR; measure the **headline metric: per-class accuracy on
  the 8 AEU accidentals** (SER secondary) on a held-out synthetic split.
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
- **SymbTr has no repeats/voltas/D.C./ties/slurs** (flattened out) → can't auto-label them. We **rely
  on the pretrained model's existing Western knowledge** for repeats, and guard **catastrophic
  forgetting** (rehearsal with Western data + a small hand-authored Turkish set). Tuplets DO exist
  (MusicXML); barlines come from SymbTr `offset` (`assignBars`/`groupMeasures`).
- Render **both lyric and lyric-free** strips, and **randomize header/footer text** so the model
  learns to ignore non-musical text (real photos always have it).
- Keep audio/`koma53` untouched by rendering changes — it's the decoder's source of truth.
- **Headline metric:** per-class AEU-accidental accuracy. **Western rehearsal data** is mixed into
  fine-tuning. **Makam stays out of the OMR model.**

## 7. Before scaling Phase 2 (checklist)
- [ ] **Step 1 model gate** — evaluate `omr_transformer` (`src/vision/MODEL_EVAL.md`).
- [ ] Confirm green typecheck (`npx tsc` core + web).
- [ ] **Decide the label output format** from the chosen model (LilyPond + microtonal tokens).
- [ ] Scaffold `tools/render/` (Playwright strip renderer) and `src/vision/` (dataset, fine-tune, eval).

## 8. First action in the new chat
Run the **Step 1 model gate**: download `omr_transformer`, run it on a Western sample + a rendered
Turkish staff, and record its output format, tokenizer-extension path, and size in
`src/vision/MODEL_EVAL.md`. Only once a model passes the gate do we build the renderer + fine-tune loop.
