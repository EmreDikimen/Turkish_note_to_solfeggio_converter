# Phase 2 — Synthetic Training Data (kickoff & hand-off)

> Read `ROADMAP.md` §3 (Phases 2–4) and §5 (risks) for the canonical plan. This doc orients a
> fresh session: what Phase 2 is, what's already done, what to build first, and how to de-risk it.

## 1. The project in one line
Photograph Classical/Art **Turkish (makam)** sheet music → recognize the notes *including
microtonal accidentals* → an **editable** note model → play back at exact **53-TET (AEU)** pitch.
Release target is mobile; the web app is a throwaway dev/test harness. Python is training/data only.

## 2. Where we are (Phase 1 DONE — the renderer is ready)
The harness now engraves sheets that look like real **Classical Turkish Music** scores, which is
exactly what Phase 2 will render into training images:
- **AEU accidentals only** on the staff (`toAeuAlter` snaps every alteration to koma/bakiye/küçük·
  büyük mücennep; no numbered ±2/±3 "folk" signs). The exact koma (sounding pitch) is preserved in
  the data — the editor still shows it — and is recovered later by the makam-aware decoder.
- **Lyrics** (syllables, melisma underscores, optional hyphens), an **engraved header**
  (makam/form/title/usul/tempo/composer), **justified rows**, correct AEU **key signatures**.
- **Concert-pitch tuning** (anchor a fourth below written) and **transpose** (incl. sound-only ahenk).
- SymbTr→note-model→render pipeline works; 3 sample scores in `apps/web/public/`.

## 3. Phase 2 goal
Generate **thousands of labeled single-staff-strip images** from SymbTr to train a **CRNN+CTC**
OMR model. Pipeline:
```
SymbTr → note-model → (TS) render staff PNG → (Python) OpenCV augment → (image, token-sequence) pairs
                          │                                                      ↑
                          └─────────── token label emitted from the SAME render pass ──────────────┘
```
- **Render with VexFlow headless**, reusing the harness engraving. Recommended: drive a minimal
  render page with **Playwright/Puppeteer** (the engraving relies on DOM SVG + `getComputedTextLength`
  + the Bravura web font, so a real browser is the low-risk way to reuse it exactly). `node-canvas`
  is the lighter alternative if font embedding proves easy.
- **Render FROM the note model**, so labels are emitted from the same data that draws the image
  (perfect alignment, no re-parse). The label generator is TypeScript; OpenCV augmentation is Python.
- **Pitch augmentation:** core `transpose(doc, commas)` — render each piece at several transpositions.
- **Image augmentation (Python/OpenCV):** rotation, perspective warp, blur, paper texture, ink
  bleed, lighting gradients, JPEG noise, slight staff curvature. ⚠️ **This decides success more than
  the model architecture.**

## 4. The token vocabulary (design this first — and note the AEU point)
The CRNN predicts a sequence of **visual tokens** per staff strip:
- clef, key-signature accidentals, time signature, barlines, rests, dots, beams/tuplets,
- noteheads by duration + staff position,
- **accidentals = the 8 AEU signs ONLY** (koma/bakiye/küçük·büyük mücennep, sharp & flat).

**The exact koma is NOT a token.** The model reads the AEU *sign*; the **decoder (Phase 4)** turns
(AEU sign + makam) back into the precise koma — this is why the sheet uses AEU signs and the data
keeps the exact koma. **makam/usul/tempo are header metadata**, a separate recognition track
(OCR-ish on the header), not staff tokens — use `metadata.ts`/`scoreHeader` for the rendered header.

## 5. The de-risk ladder (never invest a week before a day proves it works)
- **Rung 0 — toy proof (~1–2 days):** render ~50–100 strips, build the smallest CRNN+CTC (CNN →
  collapse height → BiLSTM → linear+softmax over vocab+`blank` → `torch.nn.CTCLoss`), and
  **overfit 10 samples** until greedy decode reproduces them exactly (accidentals included). This
  proves the data pipeline, vocab, loss wiring, and decode — catching ~90% of beginner bugs in an
  hour. **Start here.**
- **Rung 1:** scale to thousands of augmented strips; train; measure CTC loss + **symbol error rate
  (SER)** + **per-class accuracy on the AEU accidentals** on a held-out synthetic split.
- **Rung 2 — the moment of truth:** run on real phone photos (worse — the expected synthetic→real
  gap), then **fine-tune on a few hundred real photos** labeled via *this app's editor*. This small
  real set matters more than any hyperparameter.
- **Rung 3 (Phase 4):** wire preprocess → staff isolation → CRNN → decode → note model → editor;
  run on-device via `onnxruntime-web`.

**Three reassurances:** (1) accidentals are just learnable tokens — the easy end of OMR (monophonic,
small known vocab, self-generated perfect labels); (2) metrics make each fear measurable (per-class
accidental accuracy, SER); (3) the **editable note model is the safety net** — OMR needn't be perfect,
the user corrects it. Fallback if CRNN+CTC transfer disappoints: **YOLOv8 glyph detection +
heuristic decoder** (deps already present) — same data, downstream unchanged.

## 6. Known gaps / decisions to carry forward
- **SymbTr has no repeats/voltas/D.C./ties/slurs** (flattened out) → can't auto-label them. Rely on
  a **Western-pretrained** model for repeats, but guard **catastrophic forgetting** (rehearsal with
  some Western data + a small hand-authored Turkish set). Tuplets DO exist (MusicXML); barlines come
  from SymbTr `offset` (`assignBars`/`groupMeasures`).
- Render **both lyric and lyric-free** strips, and **randomize header/footer text** so the model
  learns to ignore non-musical text (real photos always have it).
- Keep audio/`koma53` untouched by rendering changes — it's the decoder's source of truth.

## 7. Before starting Phase 2 (checklist)
- [ ] Commit the pending working-tree changes (done as part of this hand-off).
- [ ] Confirm green typecheck (`npx tsc` core + web) — currently clean.
- [ ] **Decide the headless-render approach** (Playwright minimal page vs node-canvas) — first task.
- [ ] **Write the token vocabulary explicitly** (enumerate from SymbTr's symbol set + the 8 AEU signs).
- [ ] Scaffold `src/vision/` (or `ml/`): dataset/dataloader, the tiny CRNN, the overfit-10 script.

## 8. First action in the new chat
Build the **Rung 0 toy proof**: a TS script that renders ~50 single-staff PNGs + token labels from a
sample score, then a minimal PyTorch CRNN+CTC that **overfits 10 of them**. Seeing your own model
reproduce a Turkish staff — accidentals and all — is the most reassuring possible first step.
