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

**Ship the web app first, then convert it to mobile.** The web app is the first released product;
a React Native mobile version comes later, reusing the same shared core. **There is no server** —
OMR inference and audio run **in-browser / on-device** (`onnxruntime-web` + Web Audio), because a
hosting subscription isn't affordable. Everything runs locally.

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
  → OMR model             (image strip → ordered symbol sequence; a fine-tuned pretrained OMR model)
  → Decode                (tokens → notes {pitch_53tet, duration, …})
  → Editable note model   ← the core: OMR feeds it, the user corrects it, synth consumes it
  → Editor UI             (web: render with VexFlow, drag to fix time & pitch)
  → Synthesis             (Web Audio at exact 53-TET frequencies)
  → audio
```


See [ROADMAP.md](ROADMAP.md) for the phased plan, model-training strategy, and rationale.

## Status

> **Where we left off + what's next → [ROADMAP.md §7](ROADMAP.md)** — the single always-current
> status section; everything else points there. **Fresh-session reading order:** this README →
> ROADMAP §7 → [docs/PHASE2.md](docs/PHASE2.md) (the live ML track). Full dated history of the
> completed phases: [docs/HISTORY.md](docs/HISTORY.md). Code map: [docs/CODE_TOUR.md](docs/CODE_TOUR.md).

- **Phase 0 — DONE:** symbolic → microtonal audio, no machine learning (SymbTr parser + 53-TET
  tuning + synth). Verified across all 2,200 SymbTr pieces.
- **Phase 1 — DONE:** shared TypeScript `core` + React web harness: piano-roll + **VexFlow-engraved
  sheet** with Turkish AEU accidentals, Web Audio playback at exact 53-TET with transport /
  playhead / click-to-seek, editing (drag + per-measure editor), tempo + usul-aware metronome,
  transpose/ahenk, lyrics + makam/usul/composer header.
- **Phase 2 — IN PROGRESS:** synthetic training data (VexFlow strips rendered from SymbTr) +
  **fine-tuning a pretrained OMR model** (`omr_transformer`) to add the Turkish microtonal
  accidentals. All de-risk gates passed: model eval, **overfit-10 GO**, **ONNX/browser gate PASS**
  (int8 export decoded in-browser via `onnxruntime-web`, ~1.5 s/strip). The Rung-2 dataset
  (`strips_v2_1`, coverage audit PASS) and the training kit (`augment.py` / `modeling.py` /
  `train.py` / `eval_omr.py`, smoke-tested end-to-end on the Mac) are done. The scaled
  fine-tune (**Rung 2**) **PASSED on Colab Pro (2026-07-07, first try): 99.9% mean per-class
  AEU accidental accuracy** on held-out pieces. Next: ONNX-export the Rung-2 checkpoint
  (`data/checkpoints/rung2-best/`) via the proven Rung-1.5 pipeline — exact status in ROADMAP §7.

## Directory Structure

Current (monorepo as of Phase 1 — Python reference/data side + TypeScript core + web harness):
```text
.
├── data/
│   ├── raw/            # input scores (e.g. SymbTr .txt)
│   ├── processed/      # generated audio / processed data
│   └── synthetic/      # rendered strip images + labels for training (gitignored)
├── src/                # Python (reference impl + training side)
│   ├── symbtr/         # SymbTr .txt parser → Score/Event model + JSON export
│   ├── audio/          # 53-TET tuning + synthesis (reference impl; ported to TS core)
│   └── vision/         # OMR gates (model eval, overfit-10, ONNX) + Rung-2 training kit (augment/train/eval)
├── scripts/            # runnable Python entry points
├── tools/render/       # TS synthetic-data generator (strip labels + Playwright renderer)
├── packages/core/      # shared TypeScript: note model, tuning, synth scheduling
├── apps/web/           # React test harness (piano-roll + Web Audio)
├── docs/               # CODE_TOUR.md, PHASE2.md (ML-track kickoff), HISTORY.md (completed phases)
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

### Python reference / data side (Phase 0 + ML training)

```bash
python3 -m venv .venv-ml
source .venv-ml/bin/activate
pip install -r requirements.txt
```

Phase 0 only needs `numpy` (plus the standard library); the rest of `requirements.txt`
(torch, transformers, optimum-onnx, OpenCV, …) is for the Phase-2 ML track in `src/vision/`.
Convert a SymbTr score to audio:

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
a measure to play from there, set the **BPM** and toggle the **usul metronome**, **Transpose**
(with **Keep sheet (sound only)** for ney ahenks), pick an **Accidentals** display mode, toggle
**Lyrics**, and **✎ Edit** to correct notes. The shared logic lives in `packages/core`; the React
UI in `apps/web` is the first shipped product surface (later converted to mobile in Phase 5).

## Data
SymbTr-2.0.0 (Karaosmanoğlu, 2012) — 2,200 machine-readable makam scores in txt, MusicXML,
MIDI, and mu2. Not redistributed here; download separately and point the scripts at the
`.txt` files. The `Koma53` column encodes each pitch as an absolute Holdrian comma value,
which maps directly to a 53-TET frequency.


## Not essential for now but can be added after
- We need to add a settings modal. We can select if we want to use note sheet or piano roll, dark mode or light mode, showing the accidentals for every note or using a single sign at the score and only show accidentals if the accidental of that specific note is not match with the accidentals of the score
  - _Done (selector, not modal): the sheet view's **Accidentals** selector offers three modes — on every note, makam key signature at the row start (only deviations marked), and standard per-measure notation (an accidental carries to the rest of its measure). The rest of the settings modal is still TODO._

- The notesheet part have two scrolling. We can remove the inner scrolling.

- **Transpose / ahenk.** _Partly done:_ the core `transpose(doc, commas)` (chromatic, re-spelling
  notes) is built, and the harness has a **Transpose** dropdown with a **Keep sheet (sound only)**
  toggle for transposing instruments (added 2026-06-28). _Still TODO:_ the user-facing **ahenk**
  selector (Bolahenk, Mansur, Kız, …) — each ahenk is a fixed comma offset, so it's the same
  chromatic transpose with an ahenk-name label on top; shipped as a mobile feature in Phase 5.

- **Usul-based rhythm.** _Partly done:_ a **usul-aware metronome** now clicks each piece's usul
  on the correct beat groupings (downbeat accented), locked to the measures, so non-integer usuls
  like aksak (9/8) stay aligned — with a tempo (BPM) control and a usul selector. _Still TODO:_
  upgrade those clicks into a real rhythmic cycle on a traditional percussion sound (e.g. darbuka)
  so the usul sounds idiomatic, and auto-detect the usul from the OMR model while keeping it
  user-editable (OMR can misread it) — wire the detection in at Phase 3–4.

- **Rule-based import for digital sheets (no AI).** For *born-digital* scores (engraved by
  MuseScore/Finale/Sibelius/LilyPond and exported as a PDF, or downloaded from the internet) we can
  extract the notes **deterministically, without the OMR model**: parse the PDF's vector content —
  the music-font glyph codepoints (noteheads, clefs, accidentals, rests) + their x/y positions and
  the staff lines — then geometrically decode pitch (notehead position vs. clef/staff) and duration
  (notehead type + beams/flags/dots) into the note model. This is more reliable than the camera path
  for clean PDFs, and reads the **exact** AEU accidental from its SMuFL codepoint (e.g. koma U+E444 →
  exact koma, no guessing) using the map already in `packages/core/notation.ts`. Even simpler: if a
  **MusicXML / MEI / MIDI** is available, skip OMR entirely and parse it (as we already do for SymbTr).
  A shipped product could offer both input paths — drop in a PDF (vector parse) or snap a photo (the
  fine-tuned model). The camera/OMR path stays the priority; this is a clean-input convenience.
