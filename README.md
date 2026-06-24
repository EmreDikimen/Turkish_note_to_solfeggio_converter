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


See [ROADMAP.md](ROADMAP.md) for the phased plan, model-training strategy, and rationale.

## Status
- **Phase 0 — DONE:** symbolic → microtonal audio, no machine learning. A SymbTr parser, the
  53-TET tuning module, and a simple synthesizer turn any SymbTr score into correct
  microtonal audio. Verified across all 2,200 SymbTr pieces.
- **Phase 1 — DONE:** shared TypeScript `core` + React web harness. Loads note-model JSON;
  piano-roll and **VexFlow-engraved sheet** views (real stems/beams/flags/dots + Turkish
  microtonal accidentals); Web Audio playback at exact 53-TET; **Play / Pause / Resume / Stop**
  with a live **playhead** cursor on the sheet and **click-a-measure-to-seek**; drag-to-edit
  (piano-roll) and a per-measure note editor (sheet). See ROADMAP §6 (Status) for details.
- **Phase 2 — next:** synthetic training data (render SymbTr → images for OMR).

## Directory Structure

Current (monorepo as of Phase 1 — Python reference/data side + TypeScript core + web harness):
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

Target (aspirational — not yet renamed; `src/`+`scripts/` still hold the Python side):
```text
ml/             # Python: training, synthetic data, SymbTr→JSON export (today's src/ + scripts/)
packages/core/  # shared TypeScript: note model, tuning, synth scheduling, OMR decode
apps/web/       # React test harness (VexFlow + Web Audio adapter)
apps/mobile/    # React Native product (native audio + onnxruntime-react-native)  ← Phase 5
```

## Getting Started

### Python reference / data side (Phase 0)

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

### Web harness (Phase 1) — view / edit / play a score

The harness reads a **note-model JSON** produced by the Python exporter. Export one into the
web app's public dir, then start the dev server:

```bash
# 1. export a sample score the web app will auto-load on start
python3 scripts/symbtr_to_json.py data/raw/<score>.txt -o apps/web/public/sample.json
# 2. install JS deps (npm workspaces) and run the Vite dev server
npm install
npm run dev:web
```

Then open the printed `localhost` URL. You can also load any exported JSON from the **Load JSON**
button. Toggle **Piano-roll / Sheet**; in Sheet view use **Play / Pause / Resume / Stop**, click
a measure to play from there, **♯♭ Key sig** to hoist accidentals to the row start, and **✎ Edit**
to correct notes. The shared logic lives in `packages/core`; the React UI in `apps/web` is a
throwaway dev tool (the real UI is rebuilt for mobile in Phase 5).

## Data
SymbTr-2.0.0 (Karaosmanoğlu, 2012) — 2,200 machine-readable makam scores in txt, MusicXML,
MIDI, and mu2. Not redistributed here; download separately and point the scripts at the
`.txt` files. The `Koma53` column encodes each pitch as an absolute Holdrian comma value,
which maps directly to a 53-TET frequency.


## Not essential for now but can be added after
- We need to add a settings modal. We can select if we want to use note sheet or piano roll, dark mode or light mode, showing the accidentals for every note or using a single sign at the score and only show accidentals if the accidental of that specific note is not match with the accidentals of the score
  - _Done (button, not modal): the score-signature toggle is the **♯♭ Key sig** button in the sheet view. The rest of the settings modal is still TODO._

- The notesheet part have two scrolling. We can remove the inner scrolling.

- **Usul-based rhythm (replace the metronome).** Play each piece's usul as a real rhythmic
  cycle on a traditional percussion sound (e.g. darbuka), locked to the measures, instead of a
  plain metronome click — so non-integer usuls like aksak (9/8) sound correct. The usul should
  be auto-detected by the OMR model and stay user-editable (OMR can misread it). Recommended:
  build the rhythm playback + editable usul selector as a harness/synthesis enhancement after
  Phase 1; wire the automatic usul detection in with the OMR model (Phase 3–4).
