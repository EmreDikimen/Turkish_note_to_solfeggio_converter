# Classical Turkish Music Optical Music Recognition (OMR)

## Context & Problem Statement
Existing Western Optical Music Recognition (OMR) solutions (like PlayScore and similar applications) generally fail on Turkish sheet music. They do not recognize the distinct microtonal accidentals intrinsic to the genre, such as *koma*, *bakiye*, and *küçük mücennep*. Furthermore, they lack the capacity to accurately synthesize playback mapped to the 53-TET (Arel-Ezgi-Uzdilek) tuning system, leaving a massive gap for musicians and students of Classical Turkish Music.

## Project Vision
This project aims to build an OMR mobile application tailored exclusively for Classical Turkish Music. 
Users will be able to snap a photo of sheet music and immediately hear it played back with precise microtonal frequencies. Playback options will include both solfege and natively synthesized traditional instruments (e.g., Ney, Clarinet).

To ensure zero recurring server costs, protect user data, and provide low-latency playback, the ultimate product is designed to run completely offline on the user's mobile device leveraging Edge AI.

## Proposed Architecture & Pipeline
This repository contains the foundational research and model development phase, eventually migrating towards edge-deployment.

The pipeline comprises the following main stages:
1. **Preprocessing / Image Processing (OpenCV):**
   - Perspective correction, binarization, and noise reduction.
   - Staff line detection and removal for isolated symbol analysis.
2. **Object Detection (CNN / YOLO):**
   - Recognizing musical symbols, traditional notes, and specifically the microtonal accidentals unique to Turkish music score notations.
3. **Sequence Modeling:**
   - Interpreting the spatial configuration of the notes into a temporal sequence, understanding pitch and rhythm structures over time.
4. **Digital Signal Processing (DSP):**
   - Synthesizing accurate audio playback. Utilizing pitch scaling algorithms to perfectly hit the 53-TET tuning frequencies based on the sequence map.
5. **Mobile UI & Edge Deployment:**
   - Exporting the trained PyTorch models to ONNX/TFLite.
   - Deploying directly into a mobile environment (iOS/Android) for offline continuous inference.

## Directory Structure
```text
.
├── data/               # Raw and processed image datasets/annotations
├── docs/               # Technical architecture and research papers
├── mobile_app/         # Mobile application source code (UI & Edge logic)
├── notebooks/          # Jupyter notebooks for prototyping and initial EDA
├── src/                # Core pipeline source code
│   ├── audio/          # DSP code, 53-TET synthesis, & pitch shifting
│   └── vision/         # OpenCV preprocessing & YOLO/CNN training scripts
├── README.md           # Project overview
└── requirements.txt    # Base Python dependencies for CV/Audio research
```

## Getting Started
For the initial research phase, you can set up your isolated environment as follows:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
