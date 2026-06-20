# Roadmap — Classical Turkish Music OMR App

> This document is the source of truth for **what to build and why**. It was written
> after a planning discussion to correct misconceptions in the original `README.md`
> (which was AI-generated and contains an inaccurate pipeline). Where this file and
> `README.md` disagree, **this file wins**.

---

## 0. Project in one sentence

Photograph Classical Turkish (makam) sheet music → recognize the notes *including
microtonal accidentals* → produce an **editable** note model → play it back at exact
**53-TET (Arel-Ezgi-Uzdilek)** frequencies. First as a **web app**, eventually offline on mobile.

---

## 1. Locked-in decisions

> **Release target is MOBILE ONLY.** The web app is an internal **testing/dev harness**
> for fast iteration on the note model, synthesis, and OMR validation — it is *not* a
> shipped product. Don't over-invest in web polish; the real UI is built in the mobile phase.

| Decision | Choice | Rationale |
|---|---|---|
| Shipped product | **Mobile app only** | This is the actual deliverable (offline Edge AI, on-device synthesis). |
| Dev/testing platform | **Web app** (React) — throwaway | Fastest way to prototype the editor + Web Audio synthesis. Validates logic, not released. |
| App stack | **React (web) + React Native (mobile) over a shared TypeScript `core`** | App logic written ONCE in the TS core; notation/audio libs (VexFlow, Tone.js) are mature in JS; mobile becomes "UI + adapters over the same core". |
| Python's role | **Training + data ONLY** (not in the shipped app) | ML training, synthetic-data generation, and SymbTr→JSON export. The app's runtime logic lives in the TS core, so it ports to mobile. |
| OMR model (v1) | **CRNN + CTC** (end-to-end, single staff) | Proven recipe for *monophonic* OMR; outputs an ordered symbol sequence directly; SymbTr labels are nearly ready-made. |
| OMR model (fallback) | **YOLOv8 glyph detection** + heuristic decoder | Use only if synthetic→real transfer with CRNN disappoints. |
| Where OMR runs | **On-device** via ONNX Runtime (onnxruntime-web for the web harness, onnxruntime-react-native for mobile) | Same exported ONNX model both places; preserves the offline goal; no production backend. |
| ML framework | **PyTorch** → export **ONNX** | Standard OMR stack; ONNX runs in both JS runtimes. |
| Training data source | **Synthetic, rendered from SymbTr** + augmentation, then fine-tune on real photos | SymbTr has no images; we generate them. See §3. |

### Developer context (for tailoring future help)
- Strong **deep-learning theory** (CNNs, RNNs from a detailed university course).
- **No hands-on model-training experience yet** — needs scaffolding for training
  mechanics (data loaders, loss wiring, sanity checks), not architecture theory.
- New concept to reinforce when relevant: **CTC loss** (alignment-free sequence labeling).

---

## 2. Critical corrections to the original README

These three reframes simplify the project enormously. Internalize them before coding.

1. **SymbTr-2.0.0 is a *symbolic* dataset, not images.** It holds machine-readable
   scores (`.txt`, MusicXML, MIDI, `.mu2`, PDF) for ~2,200 makam pieces, with
   53-TET/AEU pitches already encoded. It has **no `(image, label)` pairs**, so you
   **cannot train OMR directly on it**. Instead, use it to *generate* synthetic
   labeled images and as the ground-truth pitch table.

2. **The README's "DSP pitch-shifting" stage is unnecessary.** Once OMR yields a
   symbol, look up its exact 53-TET frequency from a table and synthesize directly
   ("play frequency F for duration D"). No audio pitch-scaling subsystem needed.

3. **Turkish classical music is monophonic** (single melodic line). This skips the
   hard, unsolved part of OMR (polyphony). A single-staff end-to-end recognizer is
   tractable.

---

## 3. Target architecture

```
Photo
  → [Preprocess]            OpenCV: perspective correction, binarize, denoise
  → [Staff isolation]       detect staff systems, slice into single-staff strips
  → [OMR: CRNN+CTC]         image strip → ordered symbol-token sequence
  → [Decode]                tokens → notes {pitch_53tet, duration, ...} via lookup
  → [Editable note model]   <-- the core data structure; everything pivots here
  → [Editor UI]             render (VexFlow), drag to fix time & pitch
  → [Synthesis]             audio at exact 53-TET frequencies
  → audio
```

The **editable note model sits in the middle by design**: OMR (which *will* make
mistakes) feeds it, the user corrects it, and synthesis consumes it.

### Layered architecture (the split that matters — NOT backend/frontend)

The product is offline mobile, so there is **no production backend**. The meaningful
split is portable-core vs. platform-adapters vs. UI shells:

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
UI SHELLS                Web (React) = testing harness; Mobile (React Native) = product.
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

## 4. Phased plan

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

### Phase 1 — Shared TS core + web harness (no ML) — *testing harness, not shipped*
- **0. Bridge:** add a Python `SymbTr → note-model JSON` exporter (mirrors the `Event`
  fields: koma_53, ms/duration, note name, lyric, kind). This is how the TS side gets data.
- **1. `packages/core` (TypeScript):** port the note model, 53-TET tuning (`koma53_to_freq`),
  and synthesis *scheduling* logic from the Python reference. Define the `AudioBackend` and
  (later) `OmrRuntime` adapter interfaces. Pure logic, no platform APIs.
- **2. `apps/web` (React):** load note-model JSON, render notation (**VexFlow** / OSMD),
  play back via a **Web Audio** `AudioBackend` adapter at exact 53-TET frequencies.
- Edit interactions: drag notes to change onset/duration and pitch; add/delete notes.
- Purpose: validate the core, note model, and synthesis quickly; later validate OMR output.
  Doubles as the **labeling tool** for Phase 3's real-photo set. **Keep the web UI minimal** —
  the core is permanent; the web UI is throwaway (mobile UI is rebuilt in Phase 5).
- **Milestone:** working "JSON score → edit → playback" harness over the shared core.

### Phase 2 — Synthetic training data
- Render SymbTr scores to images with **Verovio** (or LilyPond / MuseScore CLI).
  Requires a font/SMuFL set with Turkish microtonal glyphs (koma, bakiye, küçük mücennep).
- **OpenCV augmentations** to bridge synthetic→real: rotation, perspective warp, blur,
  paper texture, ink bleed, lighting gradients, JPEG noise, slight staff curvature.
- Emit labels as **symbol-token sequences per staff strip** (for CRNN). (If falling back
  to YOLO, emit bounding boxes instead.)
- **Milestone:** thousands of labeled staff-strip images.
- ⚠️ **This phase's augmentation quality decides project success** more than architecture.

### Phase 3 — Train the OMR model (CRNN + CTC)
- Architecture: CNN feature extractor → collapse height to a width-indexed sequence →
  BiLSTM → linear+softmax over vocab (incl. `blank`) → `torch.nn.CTCLoss`.
- Vocabulary built from SymbTr's actual symbol set; microtonal accidentals are just tokens.
- Training mechanics to scaffold (developer is new to this):
  - `(image → tensor)` dataset/dataloader.
  - **Sanity check first: overfit 10 samples** to confirm model+loss are wired correctly.
  - AdamW, LR schedule, checkpointing, greedy/beam CTC decode at eval.
- **Fine-tune on a few hundred REAL photos** (labeled via the Phase-1 editor). This small
  real set matters more than any hyperparameter.
- HuggingFace note: you may warm-start the CNN backbone, but the **output head + vocab
  must be retrained** — no existing model knows the microtonal tokens.
- **Milestone:** photo of a staff → correct symbol sequence.

### Phase 4 — End-to-end integration
- Wire: preprocess → staff isolation → CRNN → decode → note model → existing editor.
- OMR runs **server-side**; browser sends image, gets back the note model.
- **Milestone:** photograph real sheet music → edit → hear it, all in the browser.

### Phase 5 — Mobile app (THE PRODUCT)
- This is the actual release. Everything before it is groundwork/validation.
- **React Native** app that **reuses `packages/core` verbatim**; build only: the mobile UI,
  a native `AudioBackend` adapter, an `onnxruntime-react-native` `OmrRuntime` adapter, and
  camera/file access. The web harness's core ports over; its React UI does not.
- On-device synthesis + offline ONNX inference (export PyTorch → ONNX; TFLite only if needed).
- **Milestone:** shipped offline mobile app — photograph → recognize → edit → hear.

---

## 5. Tech stack reference

| Layer | Tool |
|---|---|
| ML training / data gen (Python, offline) | PyTorch, OpenCV; custom SymbTr parser; SymbTr→JSON export |
| Synthetic rendering | Verovio (preferred) / LilyPond / MuseScore CLI |
| Shared core | **TypeScript** (`packages/core`): note model, tuning, synth scheduling, OMR decode |
| Web harness | React + VexFlow/OSMD (render) + Web Audio (`AudioBackend` adapter) |
| Mobile product | React Native + native audio adapter + onnxruntime-react-native |
| On-device OMR | ONNX Runtime — onnxruntime-web (harness) / onnxruntime-react-native (mobile) |
| Model export | PyTorch → ONNX (TFLite only if needed) |

---

## 6. Key risks / watch-items
- **Synthetic→real domain gap** — the #1 risk. Mitigate with aggressive, realistic
  augmentation and a real-photo fine-tuning set. Do not skip the real photos.
- **Microtonal glyph coverage** in the rendering font — verify koma/bakiye/küçük
  mücennep render correctly before mass-generating data.
- **Staff isolation robustness** on phone photos (curvature, lighting) — a weak link
  upstream of an otherwise-good model.
- Resist building Phase 5 (mobile/edge) early; it's the slowest path and gates nothing.

---

## 7. Status / next action

**Phase 0: DONE (2026-06-20).** Symbolic → microtonal audio pipeline works with no ML.
- SymbTr dataset lives at `~/Downloads/SymbTr-2.0.0/` (txt, MusicXML, midi, mu2; 2200 pieces).
- `src/symbtr/parser.py` — parses SymbTr `.txt` → `Score`/`Event` model. Verified on all 2200 files.
- `src/audio/tuning.py` — `koma53_to_freq()`; 53-TET, anchored A4=440 at comma 305. Validated
  against 12-TET (E5 → 659.97 Hz).
- `src/audio/synth.py` — additive synth + WAV writer (numpy + stdlib `wave`, no heavy deps).
- `scripts/symbtr_to_audio.py` — CLI: `python scripts/symbtr_to_audio.py <file.txt> -o out.wav --info`.
- Sample input in `data/raw/`, sample output in `data/processed/`.

Note: Phase-0 Python (`src/`) is the **reference implementation** — its tuning + synth logic
gets ported to the TS core. It will move under `ml/` when the repo is restructured in Phase 1.

**Next action: Phase 1** (in order):
1. Python `SymbTr → note-model JSON` exporter (mirror `Event`: koma_53, ms/duration, note name,
   lyric, kind) — the bridge that feeds the TS side.
2. Set up the repo: `ml/`, `packages/core/` (TS), `apps/web/` (React). Pick a monorepo tool
   (pnpm/npm workspaces).
3. Port note model + `koma53_to_freq` + synth scheduling into `packages/core`; define the
   `AudioBackend` interface.
4. `apps/web`: VexFlow rendering + drag-to-edit + Web Audio `AudioBackend` at 53-TET.

_Last updated: 2026-06-20._
