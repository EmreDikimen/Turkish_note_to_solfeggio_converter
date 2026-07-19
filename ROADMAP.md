# Roadmap — Classical Turkish Music OMR App

> This document is the source of truth for **what to build and why**. It was written
> after a planning discussion to correct misconceptions in an early AI-generated draft of
> `README.md` (the README has since been corrected to match). Where this file and
> `README.md` disagree, **this file wins**.

---

## 0. Project in one sentence

Photograph Classical Turkish (makam) sheet music → recognize the notes *including
microtonal accidentals* → produce an **editable** note model → play it back at exact
**53-TET (Arel-Ezgi-Uzdilek)** frequencies. First as a **web app**, eventually offline on mobile.

---

## 1. Locked-in decisions

> **Ship WEB FIRST, then convert to mobile.** The web app is the **first released product**; the
> mobile app is a later conversion that reuses the same shared TS core. **There is no server** — OMR
> inference and audio run **in-browser / on-device** (`onnxruntime-web` + Web Audio), because a hosting
> subscription isn't affordable. Build the web product properly; the mobile phase rebuilds only the
> UI + native adapters over the same core.

| Decision | Choice | Rationale |
|---|---|---|
| Shipped product | **Web first, then mobile** | Ship the working web app as the first release; then convert to a React Native mobile version reusing the same core. |
| Runtime / hosting | **In-browser / on-device — NO server** | Can't afford a backend subscription; OMR runs via `onnxruntime-web` (web) / `onnxruntime-react-native` (mobile), synthesis via Web/native audio. |
| App stack | **React (web) + React Native (mobile) over a shared TypeScript `core`** | App logic written ONCE in the TS core; notation/audio libs (VexFlow, Tone.js) are mature in JS; mobile becomes "UI + adapters over the same core". |
| Python's role | **Training + data ONLY** (not in the shipped app) | ML training, synthetic-data generation, and SymbTr→JSON export. The app's runtime logic lives in the TS core, so it ports to mobile. |
| OMR model (v1) | **Fine-tune a pretrained OMR model** (download a Western OMR model, retrain to add the AEU accidentals) | Reuses a model that already reads notes; we only teach the microtonal accidentals. **Confirmed: `omr_transformer`** — passed the Step-1 eval, the Rung-1 overfit-10 (GO, 2026-07-02) and the Rung-1.5 ONNX/browser gate (PASS, 2026-07-03) — see `src/vision/MODEL_EVAL.md`. |
| OMR model (fallbacks) | **CRNN+CTC (PrIMuS-based)**, then **YOLOv8 glyph detection** + heuristic decoder | **RETIRED (2026-07-07)** — Rung 1.5 retired the export/size concern; the Rung-2 PASS (99.9% headline accuracy, see §7) retired the accuracy concern. Kept here for the record only. |
| Where OMR runs | **On-device** via ONNX Runtime (onnxruntime-web for the web harness, onnxruntime-react-native for mobile) | Same exported ONNX model both places; preserves the offline goal; no production backend. |
| ML framework | **PyTorch** → export **ONNX** | Standard OMR stack; ONNX runs in both JS runtimes. |
| Training data source | **Synthetic, rendered from SymbTr** + augmentation, then fine-tune on real photos | SymbTr has no images; we generate them. See §3. |

### Developer context (for tailoring future help)
- Strong **deep-learning theory** (CNNs, RNNs from a detailed university course).
- **No hands-on model-training experience yet** — needs scaffolding for training
  mechanics (data loaders, loss wiring, sanity checks), not architecture theory.
- New concept to reinforce when relevant: **fine-tuning / transfer-learning mechanics** (load
  pretrained weights, extend the output vocab, small-LR full fine-tune vs. freezing — freeze only as
  a memory fallback, guard catastrophic forgetting, split held-out data by piece);
  **CTC loss** (alignment-free sequence labeling) only if the CRNN fallback is used.


## 2. Target architecture

```
Photo
  → [Preprocess]            OpenCV: perspective correction, binarize, denoise
  → [Staff isolation]       detect staff systems, slice into single-staff strips
  → [OMR model]             image strip → ordered symbol sequence (a fine-tuned pretrained OMR model)
  → [Decode]                tokens → notes {pitch_53tet, duration, ...} via lookup
  → [Editable note model]   <-- the core data structure; everything pivots here
  → [Editor UI]             render (VexFlow), drag to fix time & pitch
  → [Synthesis]             audio at exact 53-TET frequencies
  → audio
```

The **editable note model sits in the middle by design**: OMR (which *will* make
mistakes) feeds it, the user corrects it, and synthesis consumes it.

### Layered architecture (the split that matters — NOT backend/frontend)

The product ships web-first then mobile, and runs fully client-side, so there is **no production
backend**. The meaningful split is portable-core vs. platform-adapters vs. UI shells:

```
ML training (Python)     offline; never shipped. Produces the ONNX model, synthetic
                         data, and SymbTr→JSON sample exports.
        │ (ONNX model + JSON)
        ▼
Shared CORE (TypeScript) note model, 53-TET tuning (koma→Hz), synthesis SCHEDULING
                         logic, OMR token decoding. Pure logic, no platform APIs.
                         Written ONCE; reused by web and mobile verbatim.
        │ calls interfaces ↓
ADAPTERS (per platform)  AudioBackend (Web Audio | native), OmrRuntime (onnxruntime-web
                         | onnxruntime-react-native), camera/file access.
        ▼
UI SHELLS                Web (React) = first shipped product; Mobile (React Native) = later conversion.
                         "Mobile = UI + adapters over the same core."
```

Rule of thumb: **anything that touches a platform API (Web Audio, DOM, camera, native
audio) goes behind an adapter interface; everything else lives in the core.** This is
what makes "write the logic once, then just build the mobile UI" actually true.

### Target repo structure (introduced at Phase 1)
```
ml/            (today's src/ + scripts/) — Python: training, data gen, SymbTr→JSON export
packages/core/ — shared TypeScript: note model, tuning, synth scheduling, OMR decode
apps/web/      — React test harness (VexFlow + Web Audio adapter)
apps/mobile/   — React Native product (native audio + onnxruntime-react-native)
```
Phase 0's `src/` (Python parser/tuning/synth) stays as the **reference implementation**
and the training-side SymbTr tooling; its tuning + synth-scheduling logic is ported to
`packages/core` in TypeScript.

### The note model (conceptual schema)
```
Note {
  onset:      float   # beats or seconds
  duration:   float
  pitch_name: string  # SymbTr/AEU symbolic name
  cents/comma: int    # 53-TET position → frequency
  accidental: enum    # natural, koma, bakiye, kucuk_mucennep, ...
  source:     enum    # "omr" | "user_edited"   (track provenance for trust/UX)
}
Score { makam, usul, notes[] }
```

---

## 3. Phased plan

**Build order is deliberately NOT the README's order.** ML comes last. Phases 0–1
produce a real, demoable app with zero machine learning.

### Phase 0 — Foundations (no ML)  ⬅️ START HERE
- Parse SymbTr `.txt`/MusicXML → internal note list.
- Build the `pitch_name → 53-TET frequency` table from SymbTr's AEU pitches.
- Minimal synthesizer: note list → audio (sine/additive is fine to start).
- **Milestone:** a script that turns a SymbTr file into correct microtonal audio.
- Stack: Python + numpy + stdlib `wave`. Note: this Python synth/tuning is the **reference
  implementation**; the shippable version of this logic is ported to `packages/core` (TS)
  in Phase 1. Python itself stays training/data-side only.

### Phase 1 — Shared TS core + web app (no ML) — *foundation of the web product*
- **0. Bridge:** add a Python `SymbTr → note-model JSON` exporter (mirrors the `Event`
  fields: koma_53, ms/duration, note name, lyric, kind). This is how the TS side gets data.
- **1. `packages/core` (TypeScript):** port the note model, 53-TET tuning (`koma53_to_freq`),
  and synthesis *scheduling* logic from the Python reference. Define the `AudioBackend` and
  (later) `OmrRuntime` adapter interfaces. Pure logic, no platform APIs.
- **2. `apps/web` (React):** load note-model JSON, render notation (**VexFlow** / OSMD),
  play back via a **Web Audio** `AudioBackend` adapter at exact 53-TET frequencies.
- Edit interactions: drag notes to change onset/duration and pitch; add/delete notes.
- Purpose: validate the core, note model, and synthesis quickly; later validate OMR output.
  Doubles as the **labeling tool** for Phase 3's real-photo set. The core is permanent; the web UI is
  the **first shipped product surface** (the mobile UI is a later conversion in Phase 5).
- **Milestone:** working "JSON score → edit → playback" harness over the shared core.

> **Phase 2/3 boundary note.** The de-risk **rung ladder** in `docs/PHASE2.md` §5 spans both
> phases: Rungs 0–1.5 (model gate, overfit-10, ONNX/browser gate) + the data generator belong to
> **Phase 2**; Rung 2 (scaled fine-tune) and Rung 3 (real photos) are **Phase 3**; Rung 4 is
> Phase 4. Commits and `docs/PHASE2.md` say "Phase 2" for the whole ladder kickoff — that's the
> working label, not a redefinition of these phases.

### Phase 2 — Synthetic training data
- **Render SymbTr scores to images with VexFlow**, reusing the harness's proven engraving
  (VexFlow 5 + Bravura), which already renders the Turkish microtonal accidentals correctly
  (koma, bakiye, küçük mücennep) via raw SMuFL codepoints. **Decided (see `docs/PHASE2.md` §3 +
  `tools/render/`):** a headless browser (Playwright) crops **short strips (~2–4 measures,
  ≤ 56 tokens — the shared `STRIP_BUDGET`; raised from the initial ~46 on 2026-07-05)** out of
  the harness's live full-score render, at a model-friendly size/aspect
  (≈583×409 for `omr_transformer`) — NOT whole wide rows: long lines overrun the decoder's token
  cap and wide-short strips blur beam/flag detail when resized (both observed in Step-1 tests).
- **Render from the note model**, so the symbol-token label sequence is emitted from the same
  data that draws the image — labels stay perfectly aligned with no re-parse. The data
  generator is **TypeScript** (reuses `packages/core` notation + the SheetView engraving
  logic); OpenCV augmentation stays in **Python**. Phase-2 data-gen is therefore split:
  *TS renders → Python augments*.
- **Pitch augmentation — chromatic transpose (before rendering).** Add a core
  `transpose(doc, commas)` in `packages/core` that shifts every note by N commas and re-spells
  it via `notation.ts` (so names stay sensible, not weird enharmonics), then render several
  transpositions of each piece. This multiplies the data cheaply and teaches the model
  pitch/position invariance (same symbols at different staff heights and accidental contexts).
  Note the named **ahenk**s (Bolahenk, Mansur, Kız, …) are just fixed transposition offsets, so
  a `name → comma-offset` table can drive both these augmentation labels and, later, the
  product's user-facing ahenk selector (Phase 5): the transpose is **chromatic under the hood**;
  the ahenk name is only a presentation label. This core function is mobile-reusable.
- **OpenCV augmentations** to bridge synthetic→real: rotation, perspective warp, blur,
  paper texture, ink bleed, lighting gradients, JPEG noise, slight staff curvature.
- Emit labels **per staff strip in the chosen model's output format** (e.g. the pretrained model's
  LilyPond token stream, extended with the microtonal accidental tokens). (CRNN fallback: a plain
  symbol-token sequence; YOLO fallback: bounding boxes.)
- **Milestone:** thousands of labeled staff-strip images.
- ⚠️ **This phase's augmentation quality decides project success** more than architecture
  (how realistically you augment toward real photos matters most).

### Phase 3 — Fine-tune the OMR model
- **Approach: transfer learning.** Download a pretrained Western OMR model (lead candidate
  `omr_transformer`; gated by an eval — see `docs/PHASE2.md` §4), **extend its tokenizer/vocab** with
  the AEU accidental tokens, and **fine-tune the FULL model at a small LR** (AdamW, ~1e-5–5e-5) on our
  synthetic data. **Freezing the encoder is a memory/compute fallback, not the default** — our images
  (VexFlow engraving, later phone photos) don't look like the base model's training images, so the
  encoder needs to adapt too. No model is trained from raw weights — we only teach the new glyphs.
- Training mechanics to scaffold (developer is new to this):
  - `(image → label)` dataset/dataloader in the model's output format.
  - **Sanity check first: overfit 10 samples** (nothing frozen, on the Mac/MPS) to confirm the data,
    tokenizer extension, and decode are wired correctly. The overfitted checkpoint is a **throwaway
    diagnostic**; the real run restarts from the original pretrained weights. ✅ **GO (2026-07-02)** — see §7.
  - **ONNX/browser gate before scaling** (`docs/PHASE2.md` §5 Rung 1.5): export to ONNX + decode one
    strip in `onnxruntime-web` — prove the in-browser premise before paying for GPU time.
    ✅ **PASS (2026-07-03)** — see §7.
  - Scale training runs on **Colab Pro** (the Mac handles overfit-10, not thousands of images
    through 143M params). AdamW + small LR + checkpointing; train with the model's native loss
    (sequence cross-entropy for a vision-encoder-decoder; CTC for the CRNN fallback).
  - **Synthesized repeat-sign strips** mixed in (self-generated — see Phase 4 and
    `docs/PHASE2.md` §6; no Western rehearsal data — plan updated).
  - **Split train/val BY PIECE, not by strip** — all strips + transpositions of a piece stay in one
    split, else validation contains near-copies of training data and the metrics are meaningless.
  - **Headline metric: per-class accuracy on the 8 AEU accidentals** (SER secondary).
- **Fine-tune again on a few hundred REAL photos** (labeled via the Phase-1 editor). This small
  real set matters more than any hyperparameter.
- **Milestone:** photo of a staff → correct symbol sequence (microtonal accidentals included).

### Phase 4 — End-to-end integration
- Wire: preprocess → staff isolation → OMR model → decode → note model → existing editor.
- OMR runs **on-device** via `onnxruntime-web` in the harness (no production backend, per §1) —
  the browser loads the exported ONNX model and produces the note model locally.
- **Makam-aware pitch decoding (required).** The written accidental on the page does NOT map 1:1
  to the sounding 53-TET pitch — the mapping is **makam-dependent**. Example: in Uşşak
  (gamzedeyim), Si is *written* with a koma flat but is *performed/encoded* as a 2-koma flat
  (`Si4b2`, koma 312) — see the SymbTr data. So the pipeline must **extract the makam** (from the
  printed makam name and/or the signature + note distribution) and feed it to the decode step,
  which resolves each written symbol to the correct koma using a per-makam intonation table
  (built from SymbTr). The makam stays user-editable in the editor (OMR can misread it). This also
  constrains **Phase 2 rendering**: render the makam's *conventional written form*, not a naive
  koma→accidental, so the synthetic images match real scores and the makam→pitch table is learnable.
  - **Two resolution layers.** (1) *Written skeleton:* OMR reads notes + explicit deviation
    accidentals + explicit naturals, and — on **row-start** crops — **reads the printed key signature**
    (`\sig … \sigend`); the decoder applies that signature (or the makam's per-degree defaults) to the
    **bare** notes to reconstruct the written accidentals. Reading the signature makes this
    **makam-independent** — key for photos whose header has no readable makam. (2) *Sounding koma:* the
    makam maps each written accidental to its exact koma (the Uşşak-Si example above). `makam = none` +
    no signature → notes as written. See `docs/PHASE2.md` §4 for the label scheme + tokens.
- **Makam selection UX (user-editable, with a `none` option).** The intended app flow:
  1. extract the **written** notes from the photo (OMR) → build the note model + a first playback;
  2. **OCR the printed makam name** from the header (fallback: infer from key signature + note
     distribution);
  3. look up that makam's intonation table and **adjust the sounding komas** — the *audio* and any
     pitch readout update; the **written staff stays as drawn**;
  4. the makam is a **user-editable control** (OCR/inference can be wrong): changing it re-derives the
     sounding pitches live (the note model is the pivot; makam maps written→sounding).
  - **`none` = identity:** every note sounds exactly **as written** (the nominal koma of each AEU sign),
    no makam adjustment. Safe default, robust to OCR errors, trivial to implement (skip the adjust step).
    Makams like hüzzam / uşşak / hüseyni (whose sounding pitch differs from the written page) are the
    cases the per-makam tables refine on top of this literal transcription.
- **Repeats: recognized on input, flattened on output.** Real photos **do** contain repeat signs and
  the model must **recognize** them. SymbTr is flattened and can't teach this — **validated
  2026-07-02**: zero of the 2,200 MusicXML files contain `<repeat>`/`<ending>`/segno/coda, and the
  mu2 files have no repeat rows either. So we **synthesize repeat-sign strips ourselves**: VexFlow
  draws repeat barlines (`Barline.type.REPEAT_BEGIN/END`) and voltas (the `Volta` stave modifier),
  and the strip renderer injects them into a fraction of strips with self-generated labels — do NOT
  rely on the base model's Western pretraining surviving fine-tuning. (Encoding + placement decided
  2026-07-02: 4 faithful drawn-symbol tokens, fold-detected + randomly injected placement —
  `docs/PHASE2.md` §6.) Our pipeline then
  **flattens/expands** them when building the note model — the repeated section is shown **twice,
  without a repeat sign** — which is what the editor and playback want.
- **Milestone:** photograph real sheet music → edit → hear it, all in the browser.

### Phase 5 — Mobile app (the second release, a conversion of the web product)
- After the web product works, convert it to mobile by reusing the same core.
- **React Native** app that **reuses `packages/core` verbatim**; build only: the mobile UI,
  a native `AudioBackend` adapter, an `onnxruntime-react-native` `OmrRuntime` adapter, and
  camera/file access. The web harness's core ports over; its React UI does not.
- **Ahenk (transposition) selector** — a user-facing control that picks a named ahenk (Bolahenk,
  Mansur, Kız, …) for playback/display, built on the core `transpose()` from Phase 2 via the
  `name → comma-offset` table (chromatic transpose under the hood, ahenk name on top).
- On-device synthesis + offline ONNX inference (export PyTorch → ONNX; TFLite only if needed).
- **Milestone:** shipped offline mobile app — photograph → recognize → edit → hear.

---

## 4. Tech stack reference

| Layer | Tool |
|---|---|
| ML training / data gen (Python, offline) | PyTorch, OpenCV; custom SymbTr parser; SymbTr→JSON export |
| Synthetic rendering | **VexFlow** (reuse the harness engraving; render staves → PNG via node-canvas / headless browser) |
| Shared core | **TypeScript** (`packages/core`): note model, tuning, synth scheduling, OMR decode |
| Web harness | React + VexFlow/OSMD (render) + Web Audio (`AudioBackend` adapter) |
| Mobile product | React Native + native audio adapter + onnxruntime-react-native |
| On-device OMR | ONNX Runtime — onnxruntime-web (harness) / onnxruntime-react-native (mobile) |
| Model export | PyTorch → ONNX (TFLite only if needed) |

---

## 5. Key risks / watch-items
- **Synthetic→real domain gap** — the #1 risk. Mitigate with aggressive, realistic
  augmentation and a real-photo fine-tuning set. Do not skip the real photos.
- **Microtonal glyph coverage** in the rendering font — koma/bakiye/küçük mücennep are
  already verified to render correctly in VexFlow + Bravura (Phase 1), which is why Phase 2
  reuses that engraving for synthetic data. Re-verify if the render font/path ever changes.
- **Staff isolation robustness** on phone photos (curvature, lighting) — a weak link
  upstream of an otherwise-good model.
- **ONNX export / in-browser inference of an autoregressive encoder-decoder** — the product's
  no-server premise rests on it, and it's the hard export case (past-key-values, JS generation
  loop). Gated early: `docs/PHASE2.md` §5 Rung 1.5 proves it in a real browser before any paid
  GPU training. ✅ **RESOLVED (2026-07-03): the Rung-1.5 gate PASSED** — see §7; this risk is
  retired, and the CRNN+CTC fallback is no longer needed for export reasons.
- Resist building Phase 5 (mobile/edge) early; it's the slowest path and gates nothing.

---

## 6. Non-essential / optional features (deferred)

Nice-to-haves explicitly **off the critical path** — build them only after the core product works.
(UI-level optional items also live in `README.md` → "Not essential for now but can be added after.")

- **Rule-based import for digital sheets (no AI).** For *born-digital* scores (engraved by
  MuseScore/Finale/Sibelius/LilyPond and exported as PDF, or downloaded from the internet), the notes
  can be extracted **deterministically without the OMR model**: parse the PDF's vector content —
  music-font glyph codepoints (noteheads, clefs, accidentals, rests) + their x/y positions + staff
  lines — then geometrically decode pitch (notehead position vs. clef/staff) and duration (notehead
  type + beams/flags/dots) into the note model. More reliable than the camera path for clean PDFs, and
  reads the **exact** AEU accidental straight from its SMuFL codepoint (e.g. koma U+E444 → exact koma,
  no guessing — the map already lives in `packages/core/notation.ts`), where image OMR can only
  approximate. Even simpler when a **MusicXML/MEI/MIDI** is available: skip OMR entirely and parse it
  (as we already do for SymbTr). A product could expose both input paths — drop in a PDF (vector
  parse) or snap a photo (the fine-tuned model). The camera/OMR path stays the priority; this is a
  clean-input convenience for later.

---

## 7. Status / next action

> **Canonical status lives HERE.** This is the single section updated after every work session;
> `README.md` → Status and `docs/PHASE2.md` §8 only point to it. The full dated,
> feature-by-feature history of the completed phases was moved **verbatim** to
> **[docs/HISTORY.md](docs/HISTORY.md)** — below is the short form.

**Phase 0: DONE (2026-06-20).** Symbolic → microtonal audio with no ML: SymbTr `.txt` parser
(`src/symbtr/parser.py`, verified on all 2,200 files), 53-TET tuning (`src/audio/tuning.py`,
concert anchor 440 Hz at comma 327), additive synth (`src/audio/synth.py`), CLI
`scripts/symbtr_to_audio.py`. Dataset at `~/Downloads/SymbTr-2.0.0/`. Details: `docs/HISTORY.md`.

**Phase 1: DONE (2026-06-22; polish through 2026-06-28).** Shared TS core (`packages/core`:
types / tuning / scheduling / notation / measures / tempo / usul / transpose / metadata) + React
web harness (`apps/web`), fed by the Python JSON exporter (`scripts/symbtr_to_json.py`):
piano-roll + VexFlow-engraved sheet (AEU accidentals via Bravura), transport with playhead +
click-to-seek, drag-to-edit + per-measure editor, three-way accidental display (incl. makam key
signature), tempo (BPM) + usul-aware metronome, transpose/ahenk (incl. sound-only), lyrics +
engraved header + justified rows. Deferred: darbuka usul playback, OMR feed-in (Phase 4).
Details: `docs/HISTORY.md`; code map: `docs/CODE_TOUR.md`. ML-track kickoff doc:
**[docs/PHASE2.md](docs/PHASE2.md)**.

**Phase 2: IN PROGRESS (as of 2026-07-02).** (Rungs 0–1.5 of the `docs/PHASE2.md` ladder = Phase 2;
the next item, Rung 2, formally opens **Phase 3** — see the boundary note above §3's Phase 2.)
- ✅ **Step-1 model gate** — `Flova/omr_transformer` evaluated (`src/vision/MODEL_EVAL.md`):
  reads its own sample staves, output = LilyPond token stream, vocab extendable
  (`add_tokens` + `resize_token_embeddings` proven), ~143M params (~143 MB int8).
- ✅ **Label serializer + strip renderer** (`tools/render/`) — `docToStrips` packs short
  (~2–4 measure, ≤ ~46-token) strips; a Playwright script crops PNG+label pairs out of the
  harness's live render; in-harness Strip panel + decoder CLI for manual verification.
- ✅ **Faithful + signature label scheme implemented** (2026-07-02) — labels mark only what is
  *drawn* (explicit accidental / `\natural` / bare; `\sig … \sigend` prefix on row-start keysig
  crops), mirroring SheetView's own drawing decision; the decoder resolves bare notes from the
  `\sig` block. Round-trip verified on all sample scores (keysig and every-mode labels decode to
  identical notes). Strips regenerated same day with faithful labels (⚠️ the on-disk set still
  predates the repeat-sign tokens and is 246/256 single-measure — re-render is part of the Rung-2
  dataset upgrades).
- ✅ **Rung-1 overfit-10: GO (2026-07-02)** — full fine-tune wiring proven on the Mac (MPS):
  10/10 strips reproduced exactly, `\sig` blocks and accidentals included
  (`src/vision/overfit10.py` + `data.py`; result logged in `src/vision/MODEL_EVAL.md`).
  The gate caught two decode-side wiring bugs (no-EOS labels; generation stopping on "."
  instead of `</s>`) — fixed and carried forward. `omr_transformer` is confirmed trainable
  on our notation.
- ✅ **Repeat signs (2026-07-02)** — encoding: 4 new faithful drawn-symbol tokens (`\repstart`
  `\repend` `\volta1` `\volta2`; the base vocab's structural `\repeat `/`volta ` are unusable, and
  `|` stays); placement: **duplicate-run detection** (`tools/render/repeats.ts` — the flattened
  repeats, verified vs. the printed gamzedeyim score), random injection for coverage still TODO.
  **Implemented + verified live**: the harness **Repeats** toggle draws the signs (detection only —
  layout/playback untouched) and strip labels carry the matching tokens; tokens add as single
  stable ids (75→92). Also found: 246/256 rendered strips are single-measure (`|` in only 10
  labels) → Rung 2 must guarantee multi-measure strips. Details in `docs/PHASE2.md` §6. None of
  this reopens Rung 1 (wiring-only gate).
- ✅ **Rung-1.5 ONNX/browser gate: PASS (2026-07-03)** — the no-server premise is proven:
  `optimum-cli` ONNX export (encoder + decoder + decoder-with-past) → **int8** dynamic
  quantization (**221 MB** total, from ~830 MB fp32) → decoded in a real browser via
  `onnxruntime-web` (wasm, threaded) with a hand-rolled JS greedy loop **and** a JS port of the
  Donut preprocessing — 3/3 gate strips reproduce their exact label ids, ~1.5 s/strip on the
  Mac. Python parity checked first (`src/vision/onnx_parity.py`: ONNX == PyTorch == label, fp32
  and int8). Gate page: `apps/web/omr-gate.html` (assets staged by
  `src/vision/make_browser_gate.py`, gitignored). Result logged in `src/vision/MODEL_EVAL.md`.
- ✅ **Rung-2 dataset upgrades: DONE, AUDIT PASS (2026-07-05)** — `data/synthetic/strips_v2/`:
  **18,624 strips / 466 MB from 150 pieces** (47 makams; selected from 2,030 usable corpus files
  by `scripts/select_pieces.py`, greedy max-min over the AEU classes with EXACT projected counts
  — the TS spelling math ported to Python). Everything seeded + reproducible (any strip's
  manifest row → harness URL, `docs/MANUAL_CHECKS.md`). Delivered: token cap 46→56 (shared
  `STRIP_BUDGET`; over-budget single measures DROPPED — untrainable), 39.9% multi-measure /
  40.7% `|` coverage, random repeat injection (6.4% of strips), transposes (−9…+9 commas),
  lyric (38.7%) + lyric-free variants, in-SVG header/footer text noise, low-rate büyük
  enharmonic respell (`tools/render/respell.ts`, user decision), `piece`/`transpose`/`lyrics`
  manifest fields, **split-by-piece** (125 train / 20 val pieces, committed `data/split.json`),
  and the pass/fail gate `src/vision/audit_coverage.py` (per-class floors + real-tokenizer
  ≤59-id check: longest 57, 0 over). Renderer (`tools/render/render.ts`) is URL-param-driven,
  chunked + resumable (per-piece shards + `.done` markers). OpenCV augmentation deliberately
  NOT baked in — it goes on-the-fly in the Rung-2 training loader.
- ✅ **Rung-2 training kit: DONE, smoke-tested (2026-07-06)** — `src/vision/augment.py`
  (on-the-fly input-realism augmentation, **two profiles mixed at `PHOTO_SHARE = 0.35`**:
  65% "screenshot" — rescale softness/JPEG/light jitter — because **real uploads are mostly
  web screenshots, not camera photos** (user decision, recorded in `docs/PHASE2.md` §3);
  35% full camera-photo pipeline — perspective/curvature/ink/paper/soft shadows/lighting/
  noise; preview grid gate: `augment.py --out ...`), `modeling.py` (the overfit-10-proven
  model/tokenizer/generation wiring, shared so train and eval can't drift), `train.py`
  (full fine-tune from original weights, AMP, warmup+cosine, split-by-piece loaders,
  per-worker RNG reseeding, val loop, best/last checkpoint + resume for Colab), and
  `eval_omr.py` (headline per-class AEU accidental accuracy + SER + exact-match, id-space
  Levenshtein alignment; appends to `<ckpt>/eval.jsonl`). Verified on the Mac (MPS):
  train → resume (optimizer/scheduler state carried) → eval all run; val loss fell
  monotonically across the smoke checkpoints and the eval table/headline render correctly.
- ✅ **Navigation-mark tokens (2026-07-06)** — segno 𝄋 / coda ⊕ / "D.C." / "Son": 4 new faithful
  drawn-symbol tokens (`\segno` `\coda` `\dc` `\fine`), zero in SymbTr (like repeats) but routine
  on real sheets and required for the Phase-4 da-capo expansion. Seeded injection
  (`tools/render/navmarks.ts`, `navseed` URL param, 4–6 marks on ~70% of renders — density set
  by simulating the audit floors before rendering, never stacked on repeat/volta measures),
  SheetView drawing (Bravura glyphs + italic text, above/below variants),
  labels at the drawn measure edge, decoder round-trip, audit floors
  (`audit_coverage.py`: nav share ≥2%, per-token train/val floors). Verified live: labels ==
  pixels on gamzedeyim across seeds/modes. **Also new: `docs/PIPELINE.md`** — the full
  page-photo → strips → decode → stitch → note-model inference design (Rung 4) + the Rung-3
  real-photo collection/labeling plan.
- ✅ **strips_v2_1 re-render: DONE, AUDIT PASS (2026-07-06)** — 18,627 strips / 470 MB, all 150
  pieces, zero render errors. Adds the nav-mark tokens (all floors cleared: train 220–392, val
  25–45 per token; 6.4% nav strips) and the **centered-rest fix** (`alignRests` off — rests were
  floating near the top line, unlike printed sheets). Real-tokenizer length gate: longest 57 ids,
  0 over (audit now measures with the training-time vocabulary — `add_tokens(ADDED_TOKENS)` —
  since the overfit10 checkpoint's tokenizer predates the nav tokens). v2 remains on disk;
  v2_1 supersedes it for training.
- ✅ **Colab kit (2026-07-07):** `docs/COLAB.md` (first-timer guide; plan decision: **Colab Pro,
  not Pro+** — a full run ≈ 5–10 compute units, Pro's 100 covers the whole campaign),
  `notebooks/rung2_colab.ipynb` (shakeout → full run → resume → eval, checkpoints to Drive),
  `scripts/make_colab_zip.sh` (one self-contained 320 MB upload: training kit + split +
  strips_v2_1; layout verified by unzip + StripDataset load). All `--strips-dir` defaults now
  point at v2_1.
- ✅ **Rung 2 — PASS (2026-07-07), first try:** scaled fine-tune on Colab Pro (`strips_v2_1`,
  batch 16, lr 3e-5, 6000 steps ≈ 110 min; best val loss 0.0045 @ step 4000, flat after — no
  overfit). `eval_omr.py` on the 2,384 val strips (unseen pieces, free-running generation):
  **headline mean per-class AEU accidental accuracy 99.9% (8/8 classes; büyükFlat 100% at 35
  gold)**, SER 0.001 (S17 D84 I39 / N95,316), exact-match 96.8%; nav marks ≥96% each, repeat
  signs 100%. Weakest token: `\sig`/`\sigend` 95.5% recall — largely the known **empty-signature
  ambiguity** (an every-mode row-start crop of a signature-less piece is pixel-identical to a
  keysig-mode one, but only the latter's label has `\sig \sigend`; benign downstream — the
  Phase-4 decoder treats an empty sig block as none). Full log: `src/vision/MODEL_EVAL.md`.
  Model: Drive `MyDrive/tnc/rung2/best`. **The CRNN+CTC fallback is retired for accuracy
  reasons too.**
- ✅ **Rung-2 ONNX export: PASS (2026-07-07, same day)** — the proven Rung-1.5 pipeline rerun
  on `rung2-best` (→ `data/checkpoints/rung2-best-onnx/`, gitignored): `optimum-cli` export →
  int8 dynamic quantization — now a **committed script**, `src/vision/quantize_onnx.py`
  (221 MB total, sizes identical to Rung 1.5) → Python parity (`onnx_parity.py`: ONNX ==
  PyTorch == label, 5/5 gate strips, fp32 AND int8) → browser gate (`omr-gate.html`, headless
  Chromium): **10/10 exact** (reference pixels + live canvas preprocessing), ~1.0 s/strip,
  session load ~3 s. Gate strips now come from HELD-OUT val pieces and carry real Turkish
  accidentals + repeat/nav tokens (`data/checkpoints/rung2-best/GATE_STRIPS.txt`; pre-picked
  as exact PyTorch decodes, since a generalizing model isn't the memorizing overfit10). Full
  log: `src/vision/MODEL_EVAL.md`; see-it-yourself guide: `docs/MANUAL_CHECKS.md` Check 9.
- ✅ **Rhythm-sign dataset upgrade (triplets + ties + grace notes): DONE, AUDIT PASS
  (2026-07-08)** — the pipeline now spells the three signs the first real upload test exposed
  (triplet 8ths misread as `16. 32`): **4 faithful tokens `\tup3` `\tupend` `\tie` `\grace`**
  (96 → 100 ids, appended at the END so every earlier token id stays stable), all recovered
  from REAL durations, no injection (`tools/render/rhythm.ts` — pure per-measure functions
  shared by SheetView and the serializer, so pixels == labels by construction). Delivered:
  parser/exporter grace kind (Kod 8 + Ms 0; the few timed Kod-8 rows stay ordinary notes),
  core `EventKind "grace"` (transpose moves it, playback skips it, a barline grace joins the
  NEXT bar with its host), triplet groups from reduced exact fractions closing on plain sums
  (members spell their ×3/2 written value; `3/12`-style reducible fractions correctly excluded),
  tie pairs `x \tie x` (accidental only on the first note; long RESTS split side-by-side with
  no tie), `\grace` + small-slashed-8th spelling glued to its host note; tuplet groups / tie
  pairs / grace+host are **unsplittable packing atoms**; the measure editor hides graces and
  re-attaches them on save. Drawing: triplets **beam together** (explicit per-group beams),
  tuplet mark = hand-drawn **curved arc + italic "3"** on the notehead side (~70% of pieces by
  name hash — the printed-Turkish-score shape; user-verified) or VexFlow's square bracket,
  `StaveTie` arcs, `GraceNoteGroup` slashed noteheads. **`data/synthetic/strips_v2_2/`:
  18,777 strips / 474 MB, zero render errors, audit PASS** — longest label 57 ids (cap 59);
  413 `\tup3` / 704 `\tie` / 1,996 `\grace` strips; floors set to measured reality (val
  `\tup3` is structurally thin at 9 — only 3 val pieces have triplets, two are dense pieces
  whose triplet bars exceed the token budget, in v2_1 too — treat its eval recall as a smoke
  signal; barline-share floor 40→37%, the rhythm tokens raised per-measure cost ~2pp).
  Non-regression: all 8,575 feature-free measures serialize byte-identical to v2_1. Live
  check: `docs/MANUAL_CHECKS.md` **Check 3c** (sample `beyati-delisin.json`). Mac train smoke
  on v2_2 PASS; **Colab kit rebuilt** (`data/colab/tnc_rung2_colab.zip`, 320 MB; the notebook
  now checkpoints to `MyDrive/tnc/rung22/` so the Rung-2 Drive backup stays intact).
- ✅ **Rung 2.2 — rhythm-sign retrain: PASS (2026-07-08, first try):** Colab run from base
  weights on `strips_v2_2` (shakeout clean: `+25 tokens -> 100 ids`). On the 2,417 held-out val
  strips: **headline 99.9% (8/8), SER 0.002, exact-match 96.7%** — quality holds vs Rung 2
  while adding the new signs: `\tup3`/`\tupend` 100%/100% (9 gold, smoke signal), `\tie` 96.4%
  recall, `\grace` 98.0%; repeats/nav/`\sig` unchanged. Full log + error notes:
  `src/vision/MODEL_EVAL.md` "Rung 2.2". Checkpoint: Drive `MyDrive/tnc/rung22/best`.
- ✅ **Rung 2.2 ONNX export: PASS (2026-07-08):** 10/10 parity (fp32+int8), browser gate 20/20;
  the upload box decodes rung22 int8. Full log: `MODEL_EVAL.md` "Rung-2.2 ONNX export".
- ✅ **Rung 2.2b — stem-fix + triplet expansion retrain: PASS (2026-07-09):** a real neyzen upload
  misread triplets as `16. 32`. Two fixes: (1) renderer bug `apps/web/src/SheetView.tsx`
  `new Beam(sub, true)` — tuplet stems now follow pitch, so high-note "3" engraves ABOVE like real
  scores (was forced below); (2) `scripts/add_triplet_pieces.py` added **40 triplet-rich pieces**
  (150 → 190 pieces; new makams). Rebuilt `strips_v2_2`: 23,391 strips, triplets 413 → **1,487
  (6.4%)**, val triplet strips 9 → **89**. From-base retrain (`MyDrive/tnc/rung22-stemfix/best`):
  `\tup3` **98.3% on 118 gold** (was a 9-sample smoke signal), `\grace` 99.4%, all AEU ~100%, **no
  regression**. `\sig` 94.4% is a known label bug (empty `\sig \sigend`), not a model error. Full
  log: `MODEL_EVAL.md` "Rung 2.2b". Colab kit: `data/colab/tnc_stemfix_colab.zip` +
  `notebooks/rung22_stemfix_colab.ipynb`.
- ✅ **Rung-2.2b ONNX export: PASS (2026-07-09):** the export chain rerun on the stem-fix
  checkpoint (`data/checkpoints/rung22-stemfix-best` → `…-best-onnx`, gitignored). Python parity
  **10/10 fp32 + 10/10 int8** (221 MB total); browser gate **20/20 exact** (headless Chromium,
  10 val strips × reference+canvas), both `\tup3` gate strips decoding `\tup3 … \tupend`. **Real-strip
  proof PASS:** `data/real/refs/triplet_test.png` (the neyzen strip that triggered Rung 2.2b) now decodes
  the high-note triplet as `\tup3 g''8 f''8 \tupend` — the pre-fix `16. 32` misread is resolved.
  One first-pick nav gate strip was fp32-exact but int8-borderline (`\buyukSharp`→`\bakiyeFlat`);
  swapped for an int8-exact strip → clean 10/10. Full log: `MODEL_EVAL.md` "Rung-2.2b ONNX export".
- ✅ **Rung 3 — real corpus COLLECTED (2026-07-10):** `scripts/collect_notalar.py` (census →
  makam-weighted download → PDF→PNG rasterize) pulled **798 engraved PDFs → 1,259 page PNGs
  (200 dpi) across all 89 makams** from neyzen.com's freely-published classical archive (robots
  allows `/makamlar/` + `/nota_arsivi/`; polite + resumable + seeded). Census = **8,442 pieces**;
  downloads are **proportional to per-makam song count** (hicaz 59, nihavend 51, rast 33, …) with
  a `--min-per-makam` floor for variety. These are PRINTED/engraved pages — the clean end of the
  screenshot-dominant upload distribution, and no camera needed (camera photos are a later
  validation set). Under gitignored `data/real/` (`pdfs/`, `images/`, `census.json`,
  `manifest.csv`). notaarsivleri.com is an opt-in second source (`--nota`, best-effort). Sample
  page confirmed real notation (keysig + repeats/voltas + lyrics + header noise).
- ✅ **Rung 4 stages 1–7 — page→strips slicer + end-to-end page decode: WORKING (2026-07-10):**
  `src/vision/page_to_strips.py` (classical CV, `docs/PIPELINE.md` §1 stages 2–6): staff systems
  via horizontal-open + row projection; each row scale-normalized to the TRAINING geometry
  (strip H=336, staff spacing 30 px, top line y≈138 — measured from the gate strips); barlines by
  **continuity + thinness** (unbroken top→bottom vertical run, no notehead-tall fat blob,
  staff-line rows excluded) — plain per-column darkness is NOT enough: stems pass it and real
  barlines fail it; windows of ~3 measures, row-starts keep clef+keysig (the `\sig` carrier);
  over-wide fallback splits at whitespace gutters; `--debug` overlay draws staves/barlines/
  windows. Five real-page bugs found & fixed during verification on `data/real/` pages, incl.
  **volta-bracket lines clustering as a 6th staff line** (row anchored one gap too high → every
  barline in the row rejected; fix: keep the most evenly-spaced 5-line window).
  **Slicer hardened 2026-07-19** (real-corpus false positives — stems/G-clefs cut as barlines,
  skew-eaten staff x-extent, phantom clef+sig lead measure): third TERMINATION gate (connected
  overshoot walk past the outer lines), raw-ink staff extent, notehead-gated prefix trim,
  padded crops, reject-reason debug overlay + `scripts/rung3/score_slicer.py` regression
  scorer; details in `docs/RUNG3.md` § slicer defects and `docs/PIPELINE.md` §1.5.
  `src/vision/decode_page.py` chains the slicer into the Rung-1.5 ONNX greedy decode (int8 =
  browser runtime). **First real neyzen page (hicaz şarkı, 7 rows → 21 strips): keysig read on
  every row-start, `\repstart`/`\volta1`/`\repend`/`\volta2` structure captured, bakiye/koma
  accidentals decoded, ~353 ms/strip (7.4 s/page).** Known rough edges: spurious/disordered
  tuplet tokens on some 16th pairs, occasional `\sig` inconsistency — exactly the synthetic→real
  gap the Rung-3 labeling loop trains away.
- ✅ **Rung 4 stage 8 — STITCHER + editor feed-in: DONE (2026-07-10):** `tools/render/stitch.ts`
  (browser-safe TS, like decode.ts) turns a page's decoded strip tokens into a schemaVersion-1
  note model: joins strips/rows re-inserting the `|` the crop boundary ate (repeat barlines
  excepted), resolves bare notes from the row's `\sig` block (empty blocks never clear an
  established signature — the known ambiguity), folds the rhythm signs back (`x \tie x` → one
  event, `\tup3` members × 2/3, `\grace` → zero-duration grace), then **expands structure**
  (repeat/volta passes, D.C. al Fine with segno/coda jumps — repeats not retaken) and emits
  events with bar-unit offsets so the harness's `assignBars` reproduces the decoded barlines.
  Model noise (stray `\tupend`, dangling `\tie`, glued tokenizer output like `\sig\bakiyeFlata`,
  split durations `f'' 32`, a hallucinated mid-piece `\dc` — the last two produced by a real
  nihavend page) is normalized/warned, never fatal. **Verified:** `stitch-test.ts` — 13 structure
  unit tests +
  **round-trip 194/194 bundled scores exact** (labels via `docToStrips` → stitch → identical
  written notes; comparison at the WRITTEN AEU layer, per the two-layer design).
  **Editor feed-in:** `decode_page.py` now writes `<page>_decode.json` → `stitch-cli.ts -o
  apps/web/public/decoded.json` → loads in the harness (file picker or `?score=/decoded.json`);
  new **⬇ Save JSON** button exports the corrected doc — the labeling loop is closed. Live
  proof on the hicaz test page: 21 strips → 23 written / 28 expanded measures, keysig + volta
  structure resolved, 225 events render + play (headless-verified: engraving drawn, save
  round-trips, no console errors); second page (nihavend): 25 strips → 29 written / 37 expanded
  measures, 288 notes.
- ✅ **Rung 3 — SymbTr↔neyzen name match: DONE (2026-07-11):** `scripts/rung3/match_symbtr.py`
  fuzzy-matches the 798 downloaded pdfs against SymbTr (makam alias table, incipit/composer/form
  token scoring): **85 auto-accepted pairs** (spot-checked), 28 review-band, exported under
  `data/real/rung3/matched/<makam>/<stem>/` as `score.json` (ground-truth note model) +
  `labels.json` (per-measure tokens via the new `tools/render/labels-cli.ts`, every+keysig modes
  + `\sig` block). Written-vs-sounding verified: `toAeuAlter` snap makes uşşak export
  `\komaFlat b` like the printed page. **Full plan for the rest of Rung 3: `docs/RUNG3.md`**
  (agreed order: freeze a ~15-piece real exam set from the matches → strip-label emitter →
  Round-1 fine-tune on synthetic + matched-real → only then the hand-correction loop on the
  unmatched ~700). Also: `data/real/` tidied (`refs/`, `rung3/` subtree).
- ✅ **Rung 3 — strip-label emitter + frozen exam + FIRST REAL BASELINE (2026-07-12):** the
  full auto-labeling pipeline is built and calibrated on the 85 matches (emitter-first order,
  user decision 2026-07-11). Delivered: carry-mode ("measure") label serialization + carry-aware
  decode (real engraving's accidental-carry convention, confirmed by user; `lilypond.ts` /
  `decode.ts` / `stitch.ts`, 194/194 carry round-trip), slicer measure geometry persisted
  (PNGs byte-identical), per-token logprobs in the ONNX decode (parity 10/10 fp32+int8),
  `labels-cli --ranges` batch mode (empty-`\sig` fix baked in), and
  `scripts/rung3/emit_strip_labels.py` — D.S./da-capo tail folding (64/85 pieces jump;
  40/85 have the flattened-tail signature), content-driven monotonic row search (editions
  reorder sections; a cursor can't follow), printed-signature majority vote + label override
  (real pages print the makam's CONVENTIONAL sig, not SymbTr's derived one — 33/85
  overridden), `sigTolerant` written-vs-sounding handling (eviç prints bare under a
  koma-sharp-F sig), and the triple gate: ≤59-id budget, decodeLabel round-trip, nd
  disagreement vs the model's decode (accept ≤0.10 AND no accidental-class disagreement —
  those always get human review). Yield: **84 auto-accepted training strips**
  (`data/real/rung3/strips_r1/`, StripDataset-ready, high-trust) + **348-strip review queue**
  + **33 exam strips**. Exam: `testset.json` (committable via .gitignore negation) — 20
  pieces / 16 makams, all 6 reachable AEU floors met (büyük = 0 on real pages), seeded +
  deterministic, PROVISIONAL until notaarsivleri lands. `eval_omr.py` now prints per-source
  blocks + LOW-N/absent honesty markers + the upper-bound caveat. **Baseline: 83.3% AEU /
  SER 0.018 / 78.8% exact on the real exam (synthetic: 99.9% / 0.002 / 96.7%) — the
  synthetic→real gap is now a number** (`MODEL_EVAL.md` "Rung 3 — real-page exam BASELINE").
  Full plan + calibration findings: `docs/RUNG3.md`.
- ✅ **Review UI + full training-set audit (2026-07-12):** `scripts/rung3/review_ui.py`
  (stdlib server :8377) — queue tabs, one-keystroke ok|fix|bad verdicts written atomically
  into the emit CSVs (+ `full_audit.csv` sidecar over ALL 84 accepted strips; manifest never
  written by the UI), solfège display, label-vs-decode token diff, Bravura token reference.
  **Full audit result: 65 ok / 19 fix / 0 bad — 22.6% of auto-accepted labels needed
  correction** (spurious flattened-SymbTr `\repstart` the edition doesn't print; slurs decode
  as false `\tie`). Corrections sit in `full_audit.csv` until the promote script applies them.
- ✅ **Rung 3 — 348-row adjudication + promote script: DONE (2026-07-14).** Full r1 review
  queue hand-adjudicated (341 fix / 4 bad / 3 ok — the conservative gate was right: nearly
  everything flagged needed fixing). `scripts/rung3/promote_labels.py` applied the verdicts:
  19 full_audit fixes into `manifest.jsonl`, 334 review rows promoted through the real gates
  (≤59-id budget with the training tokenizer + labels-cli `--check` round-trip — a new batch
  mode running the SAME checkLabel gate over raw label text). **Training pool: 84 → 418 real
  strips** (65 emitter-ok / 19 audit-fixed / 334 promoted; provenance columns on every row).
  10 rejects in `promote_rejects.csv`: 7 over-budget (60–73 ids, correct but undecodable
  within max_length 60 — the MEASURES_PER_STRIP=2 re-slice territory) + 3 split-duration
  typos (`c'' 32`) awaiting hand-fix, then re-run (script is idempotent, keyed on image).
- ✅ **Rung 3 — Round-0.5 labeler TRAINED + EXPORTED (2026-07-15,
  `MODEL_EVAL.md` "Round-0.5"):** throwaway real-only fine-tune from `rung22-stemfix-best`
  on the 418-strip promoted pool (exam pieces excluded from train AND val). Real-val
  **SER 0.086→0.021, AEU 70→91.7%, sig reads 100%**; `data/checkpoints/rung3-labeler`
  + `-onnx` int8, parity 8/8. Never shipped — it is the emitter's decode model only
  (`emit_strip_labels.py --checkpoint … --redecode`).
- ✅ **Rung 3 — TWO-SOURCE STAGE COMPLETE (2026-07-15, `docs/RUNG3.md` §1b + Step 2):**
  `scripts/rung3/collect_nota.py` census 20,833 TSM pieces → 966 metadata accepts →
  **964 pieces downloaded**; **1,227 pages GPU-decoded on Colab**
  (`scripts/rung3/decode_pages_gpu.py` + `make_decode_zip.sh` +
  `notebooks/rung3_decode_colab.ipynb` — labeler decode offloaded, fanless-Mac rule);
  fold-search 2^n blow-up fixed (`SPAN_SUBSET_CAP=12` + hill-climb). Emit over 938 pieces
  (440 ok / 338 low_coverage / 160 missing_pages) → **1,262 accepted nota strips +
  2,671-row review queue + 69-strip audit sample** (`strips_nota/`); dominant drops
  row_unaligned 4,467 / split_wide 3,757 / over_budget 2,108 (`MEASURES_PER_STRIP=2`
  re-slice = the #1 yield lever). **Exam RE-FROZEN v2** (`testset.json`, v1 → `.bak-v1`):
  **25 pieces / 16 makams (23 nota + 2 neyzen), every reachable class ≥44 gold, no LOW-N**;
  exam emit 63 strips + 287-row growth queue (`strips_exam_v2/`). Sig clusters flagged, NOT
  yet adjudicated: **mahur [F+1]×12 + missing-B-1** (the hicaz lesson's per-makam spot check
  doing its job).
- ✅ **Rung 3 — nota audit + first promote DONE (2026-07-16).** 69-strip audit sample fully
  adjudicated (29 ok / 40 fix). Fix decomposition: 8 pure sig-order (now no-ops after the
  canonicalization below), 1 sig-block, 26 tie/repeat structural (the known SymbTr-vs-edition
  conventions), **5 pitch-level = 7.2% content-error rate** (vs neyzen's 22.6% — the
  Round-0.5 labeler earned its keep). 180 review rows verdicted (105 sig_mismatch — the
  worksheet clusters — 29 nd_review, 23 low_coverage, 8 acc_disagreement, 13 nav).
  `promote_labels.py --dir strips_nota` APPLIED: **manifest 1,262 → 1,435 strips** (47 audit
  fixes in place + 173 promoted); 6 rejects = 4 over_budget (61–85 ids, re-slice territory)
  + 2 correction typos pending re-edit. **Combined real pool: 1,853 strips** (1,435 nota +
  418 neyzen). Sig-entry order canonicalized EVERYWHERE (serializer + ~404 existing labels,
  see `docs/RUNG3.md` watch-item). Sharpness analysis: the review queue is systematically
  the BLURRY tail (accepted median 1672 vs low_coverage/sig_mismatch ~900 Laplacian-var) —
  except acc_disagreement rows (1703, sharp + accidental-bearing = best value left).
  Rare-class real gold is thin (komaSharp 26 / kucukSharp 31 tokens) → synthetic
  oversampling in the Round-1 re-render, not queue-grinding. Photo-domain exam prep:
  all 25 exam-piece PDFs staged + merged (`data/real/rung3/photo_exam_pdfs/`,
  00_ALL_25_MERGED.pdf, 38 pp) for print-and-photograph → `data/real/photos_exam/` =
  a second exam axis at zero labeling cost.
- ✅ **Rung 3 — sig_mismatch + acc_disagreement adjudicated, EXAM GROWN 10x (2026-07-16/17).**
  All 231 sig_mismatch + all 216 acc_disagreement nota-review rows verdicted; second promote:
  **training manifest 1,435 → 1,742** (real pool **2,160** with neyzen). **acc_disagreement
  lesson (docs/RUNG3.md "Logged for later"): the user's fixes sided with the DECODE 187/214
  (87%) vs SymbTr 14 — printed editions win accidental disputes; the never-auto-accept rule
  avoided 187 headline-class poisonings; the labeler's decode is the right edit draft.**
  Sig-entry order canonicalized (serializer + ~404 labels); 198 sig-less w00 labels validated
  + kept (crop-cut dominates, 96%). examv2-review DONE (287: 249 promoted / 12 bad / 26
  over_budget = unwinnable under the 59-id cap): **exam manifest 63 → 312 strips**
  (`promote_labels.py --exam` flag added; exam/training pools mutually guarded). Exam gold:
  bakiyeSharp 117, bakiyeFlat 60, kucukFlat 54, natural 48, komaFlat 39, kucukSharp 28,
  komaSharp 19 — **but \tup3 only 4: the exam measures triplets WEAKLY** (budget depletion;
  interpret Round-1 tup3 via synthetic val + manual checks). THREE slicer defects logged for
  the re-slice (docs/RUNG3.md watch-item): w00 crops cutting clef/sig, note stems mistaken
  for barlines (duration misread; pad cuts a few px, TIGHT), bisected noteheads. Review
  policies logged: cut note / dangling accidental inside labeled content = bad; outside =
  ignore fragment. nota-full reordered nd-desc (riskiest first). Promote rejects pending:
  3 typos (ben_seni_sevdim p1_s03_w01 stray `d`; gonlum_heves p1_s04_w00 backslash-less
  `bakiyeSharp`; yikildi p1_s01_w00 `g''' 32` split) + 14 over_budget (re-slice recovers).
- ✅ **Rung 3 — examv2-full DONE (2026-07-17, the LAST exam hand task):** all 63 auto-accepted
  exam strips verdicted — **31 ok / 32 fix / 0 bad**. Fixes: 22 tie-only (the SymbTr-vs-edition
  structural conventions), 4 volta/repeat, **4 pitch/duration = ~6% content-error rate**
  (matches the nota audit's 7.2%), 1 sig-block removal (w00 crop-cut), 1 accidental-class sig
  fix (zahiri p1_s04_w00 komaSharp→kucukSharp). **mahur (18) + suzidilara (16) sig-suspects:
  ZERO signature corrections — the voted sigs are confirmed, clusters cleared.** Fixes
  APPLIED via `promote_labels.py --exam`: 31 of 32; the 32nd (neydin_guzelim p1_s03_w00,
  60 ids) over budget → row removed as unwinnable (promote_labels fixed to remove
  gate-failed audit fixes per its docstring). **Final exam manifest: 311 strips** (tie 127,
  \tup3 still 4; class counts in docs/RUNG3.md).
- ⏳ **Next: (1) COMMIT
  `testset.json` + sync = THE FREEZE; (2) re-take baseline (`rung22-stemfix-best`) on the
  311-strip exam per-class × per-source (× photo arm when the printed-page photos land —
  PDFs staged in `data/real/rung3/photo_exam_pdfs/`); (3) USER (optional, training quality):
  nota-full — 125 hand-verdicted; **325 rule-drafted** (`rule_fix_notafull.py`: decode-side
  ties/dur-respells/repeat-marks only, by=rule 174 ≈84% exact / by=rule-lowconf 151) —
  review drafts in the UI, hand-work the 244 abstained sig/tuplet/grace/pitch disputes,
  568 no-diff skim/skip, then `promote_labels.py --dir strips_nota`;
  (4) Round-1 fine-tune from BASE weights, PRE-REGISTERED ship criteria, checkpoint selection
  on val only (exam taken once at the end).** Round-1 prerequisites: multi-pool loader in
  train.py + the synthetic re-render batch (empty-`\sig` fix, carry-mode rendering,
  hicaz-family sig coverage, slurs as unlabeled distractors, **aggressive `\tup3`
  oversampling incl. contiguous-triplet runs**, rare-class komaSharp/kucukSharp oversampling,
  blur/fade augmentation) + the `MEASURES_PER_STRIP=2` re-slice with the three slicer fixes
  (recovers the ~5,900 split_wide/over_budget drops + 14 training + 26 exam over-budget
  corrections; PROMOTE FIRST — re-emit discipline in `docs/RUNG3.md`). **⚠ Tuplet caveat
  (measured 2026-07-17, docs/RUNG3.md §1c): the 2-measure re-slice does NOT recover triplets —
  80% of tup3 2-measure windows still blow the 59-id budget, 39% of tup3 SINGLE measures do;
  tuplet content needs `OMR_MEASURES_PER_STRIP=1` (knob added) and, for the dense tail,
  the sub-measure fragment design in §1c.** Parked: ~2,100
  blurry nota-review rows (low_coverage/nav/nd_review — unverdicted rows never train; mine
  per-class only if Round-1 taxonomy gives a reason). Label-noise budget for Round 1: ~7%
  pitch / ~38% tie-repeat structural in nota auto-accepts — RE-AUDIT a fresh 5% sample after
  Round 1. Later: decode-repair heuristics (docs/RUNG3.md "Logged for later"),
  hand-correction loop on unmatched pieces, in-browser stages 2–7, stage-9 header OCR.
- 📌 **Superseded (historical) step-by-step for the original Rung-2.2 export:**
  1. **Local copy:** download Drive `MyDrive/tnc/rung22/best` → `data/checkpoints/rung22-best/`
     (gitignored, like rung2-best).
  2. **Gate strips:** write `data/checkpoints/rung22-best/GATE_STRIPS.txt` — ~8–10 val-piece
     strip filenames from `data/synthetic/strips_v2_2/`, one per category as at Rung 2 (`\sig`
     block, büyük, repeat/volta, nav, multi-measure `|`) **plus the new categories: a `\tup3`
     strip, a `\tie` strip, a `\grace` strip**. Pre-pick strips the PyTorch checkpoint decodes
     EXACTLY (the gate criterion is exact match; at 96.7% exact-match most candidates pass —
     verify with a quick decode loop or `eval_omr.py --show-errors` output before blaming the
     export). Rhythm-sign candidates: grep the v2_2 manifest for `\tup3`/`\tie`/`\grace` among
     val pieces (val `\tup3` strips are all in acemkurdi/muhayyer).
  3. **Export:** the same `optimum-cli export onnx --task image-to-text-with-past` invocation
     as Rung 2 (see `docs/MANUAL_CHECKS.md` Check 9) → `data/checkpoints/rung22-best-onnx/`.
  4. **int8:** `src/vision/quantize_onnx.py` on that dir (expect ~221 MB total again).
  5. **Parity:** `src/vision/onnx_parity.py --checkpoint data/checkpoints/rung22-best
     --onnx-dir data/checkpoints/rung22-best-onnx --strips-dir data/synthetic/strips_v2_2`,
     fp32 AND `--suffix _int8` — must be N/N exact.
  6. **Browser gate:** `src/vision/make_browser_gate.py` (same flags) → `omr-gate.html`
     headless Chromium (Check 9) — target N×2/N×2 exact, then **retry the original
     triplet-misreading real upload** in the gate page's upload box: the triplet passage should
     now come back wrapped in `\tup3 … \tupend` instead of `16. 32`.
  7. **Log results** in `MODEL_EVAL.md` (append to the Rung-2.2 section) + update this entry.
  **THEN Rung 3:** photo/screenshot COLLECTION (`docs/PIPELINE.md` §3) can start any time; the
  model-assisted labeling loop uses this checkpoint. The int8 graphs unblock **Rung-4 wiring**
  (preprocess → staff isolation → decode → note model, `docs/PIPELINE.md`).

Run the harness: `npm install` then `npm run dev:web` (export a sample first:
`python scripts/symbtr_to_json.py <file.txt> -o apps/web/public/sample.json`).

Note: Phase-0/training Python stays in `src/` for now; the `ml/` rename is cosmetic and deferred.

Web deps of note: `vexflow@5` (notation engraving; bundles the Bravura font, hence the large web
bundle — acceptable for the web app).

_Last updated: 2026-07-17 (adjudication cycle DONE — the last hand task, examv2-full, finished: 63 rows, 31 ok / 32 fix (22 tie-only, 4 pitch/duration ≈ 6% content-error), mahur/suzidilara sig-suspects cleared with ZERO sig corrections. Earlier today: sig_mismatch + acc_disagreement cleared — **decode beat SymbTr 187:14 on accidental disputes**; training manifest **1,742** (real pool 2,160); exam manifest **63→312** via `promote_labels.py --exam` (tup3 only 4 — exam measures triplets weakly); three slicer defects logged for the re-slice. examv2-full fixes APPLIED via promote --exam → final exam manifest **311 strips** (one over-budget fix removed as unwinnable). Next = COMMIT testset.json = freeze → baseline on 311-strip exam → optional nota-full nd>0 tier → Round 1 (pre-registered criteria; synthetic re-render must oversample tup3 aggressively). LATER SAME DAY — targeted tuplet collection (docs/RUNG3.md §1c): SymbTr scanned for tuplet pieces (459; 267 already held), **293 NEW tuplet pieces downloaded** (36 nota review-promotes + 257 neyzen from the never-downloaded census tail; 60 brand-new SymbTr pieces + 164 second-style copies), budget analysis shows tup3 needs 1-measure windows (`OMR_MEASURES_PER_STRIP` knob added; 2,325 tup3 measures/3,384 groups fit at k=1; 1,512 dense measures await the sub-measure fragment follow-up); k=1 decode ran on Colab per the fanless-Mac rule. 2026-07-18: EMIT DONE + strips_tup TRIMMED TO TUP3-ONLY (user call): **78 accepted tup3 strips / 114 groups (all groups verified = exactly 3 closed notes) + 147-row tup3 review queue / 205 groups**; review-UI tabs tup-full/tup-review/tup-audit wired. Sufficiency assessment (docs/RUNG3.md §1c): training = YES for Round 1 (~180 rows / ~280 groups after adjudication + synthetic oversampling); exam = NO without action — **hold ~10–12 tuplet pieces OUT of the promote as a tup3 exam extension (~30–50 gold, v2.1 freeze) and re-baseline before Round 1**; dense contiguous-run instrumentals stay a blind spot until sub-measure fragments)._
