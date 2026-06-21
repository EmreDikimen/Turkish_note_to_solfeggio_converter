# Classical Turkish Music Optical Music Recognition (OMR)

> **Detailed build plan lives in [ROADMAP.md](ROADMAP.md).** Where this README and the
> roadmap differ, the roadmap is the source of truth.

## Context & Problem Statement
Existing Western Optical Music Recognition (OMR) tools (PlayScore and similar) generally
fail on Turkish sheet music. They do not recognize the microtonal accidentals intrinsic to
the genre — *koma*, *bakiye*, *küçük mücennep* — and they cannot synthesize playback in the
**53-TET (Arel-Ezgi-Uzdilek)** tuning system. This leaves a real gap for musicians and
students of Classical Turkish Music.

## Project Vision
An OMR app tailored to Classical Turkish (makam) music. The user photographs a score, the
app recognizes the notes including microtonal accidentals, presents them in an **editable**
view (OMR makes mistakes, so every note's pitch and timing can be corrected by hand), and
plays the result back at precise 53-TET frequencies, with natively synthesized instruments
(Ney, clarinet, …).

**The product is a mobile app** that runs offline (Edge AI). A web app is used only as an
internal **testing/development harness** to iterate quickly on the note model, synthesis,
and OMR validation — it is not a released product.

**Architecture:** the app logic (note model, 53-TET tuning, synthesis scheduling, OMR
decoding) lives once in a shared **TypeScript core**; a **React** web harness and a
**React Native** mobile app are thin shells over it, with platform specifics (audio output,
on-device ONNX inference, camera) behind adapter interfaces. There is **no production
backend** — everything runs on-device. **Python is training/data only** (model training,
synthetic-data generation, SymbTr→JSON export) and is never shipped in the app.

## Pipeline
```
Photo
  → Preprocess            (OpenCV: perspective, binarize, denoise)
  → Staff isolation       (slice into single-staff strips)
  → OMR (CRNN + CTC)      (image strip → ordered symbol-token sequence)
  → Decode                (tokens → notes {pitch_53tet, duration, …})
  → Editable note model   ← the core: OMR feeds it, the user corrects it, synth consumes it
  → Editor UI             (web: render with VexFlow, drag to fix time & pitch)
  → Synthesis             (Web Audio at exact 53-TET frequencies)
  → audio
```

Three facts that shape this design (and correct an earlier draft of this README):

1. **SymbTr-2.0.0 is a *symbolic* dataset, not images.** It cannot be used to train OMR
   directly; instead it is used to *generate* synthetic labeled training images and as the
   ground-truth 53-TET pitch table.
2. **No DSP pitch-shifting is needed.** Once a symbol is known, its exact frequency comes
   from a lookup table and is synthesized directly.
3. **The music is monophonic** (single melodic line), which makes an end-to-end recognizer
   tractable.

See [ROADMAP.md](ROADMAP.md) for the phased plan, model-training strategy, and rationale.

## Status
- **Phase 0 — DONE:** symbolic → microtonal audio, no machine learning. A SymbTr parser, the
  53-TET tuning module, and a simple synthesizer turn any SymbTr score into correct
  microtonal audio. Verified across all 2,200 SymbTr pieces.
- **Phase 1 — next:** web editor + Web Audio playback.

## Directory Structure

Current (Phase 0 — Python reference implementation):
```text
.
├── data/
│   ├── raw/            # input scores (e.g. SymbTr .txt)
│   └── processed/      # generated audio / processed data
├── src/                # Python (reference impl + training side)
│   ├── symbtr/         # SymbTr .txt parser → Score/Event model + JSON export
│   ├── audio/          # 53-TET tuning + synthesis (reference impl; ported to TS core)
│   └── vision/         # (later) OpenCV preprocessing & OMR training
├── scripts/            # runnable Python entry points
├── packages/core/      # shared TypeScript: note model, tuning, synth scheduling
├── apps/web/           # React test harness (piano-roll + Web Audio)
├── docs/               # research notes & CODE_TOUR.md
├── ROADMAP.md          # detailed build plan (source of truth)
├── README.md           # this overview
└── requirements.txt    # Python dependencies
```

Target (introduced in Phase 1):
```text
ml/             # Python: training, synthetic data, SymbTr→JSON export (today's src/ + scripts/)
packages/core/  # shared TypeScript: note model, tuning, synth scheduling, OMR decode
apps/web/       # React test harness (VexFlow + Web Audio adapter)
apps/mobile/    # React Native product (native audio + onnxruntime-react-native)
```

## Getting Started

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Phase 0 only needs `numpy` (plus the standard library). Convert a SymbTr score to audio:

```bash
python3 scripts/symbtr_to_audio.py data/raw/<score>.txt -o data/processed/out.wav --info
```

The `--info` flag prints a score summary and the first notes with their computed 53-TET
frequencies.

## Data
SymbTr-2.0.0 (Karaosmanoğlu, 2012) — 2,200 machine-readable makam scores in txt, MusicXML,
MIDI, and mu2. Not redistributed here; download separately and point the scripts at the
`.txt` files. The `Koma53` column encodes each pitch as an absolute Holdrian comma value,
which maps directly to a 53-TET frequency.
