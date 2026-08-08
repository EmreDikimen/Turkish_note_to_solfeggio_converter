---
license: apache-2.0
base_model: Flova/omr_transformer
pipeline_tag: image-to-text
tags:
  - optical-music-recognition
  - omr
  - turkish-makam-music
  - onnx
library_name: onnx
---

# omr-weights — Turkish (makam) optical music recognition

ONNX graphs for [KomaVision](https://komavision.netlify.app), an optical music recognition model
for **Classical Turkish (makam) music**: a photo or screenshot of sheet music in, notes out —
including the microtonal accidentals (koma, küçük mücennep, bakiye, büyük mücennep) that Western
OMR models have no vocabulary for.

Source code: <https://github.com/EmreDikimen/Turkish_note_to_solfeggio_converter>

## What is here

Int8-quantized ONNX exports of a Donut-style vision-encoder-decoder (~143M parameters):

| File | Role |
|---|---|
| `encoder_model.onnx` | image encoder |
| `decoder_model.onnx` | first decode step |
| `decoder_with_past_model.onnx` | subsequent steps, with KV cache |

Input is a **409×583** grayscale strip — one staff line's worth of music, not a whole page. The
application slices a page into strips before decoding. Output is a LilyPond-flavoured token stream
with AEU accidental tokens.

The same graphs run in two places: in the browser via `onnxruntime-web` (the offline fallback) and
on a CPU server via `onnxruntime-node`. There is one decode implementation, shared.

## Licence and attribution

**Apache-2.0**, inherited from the base model.

Fine-tuned from **[`Flova/omr_transformer`](https://huggingface.co/Flova/omr_transformer)**
(Apache-2.0) — a pretrained OMR transformer. That model is the reason this project did not need to
train an OMR system from scratch, and its licence and attribution travel with these weights as
Apache-2.0 §4 requires.

## Training data

- **Self-rendered synthetic strips.** Turkish scores engraved by the project's own VexFlow
  renderer, with augmentation aimed at what users actually upload (screenshots more than photos).
  The pixels and the labels come from one code path, so a label can never disagree with its image.
- **Real printed pages**, hand-labelled, from freely-published Turkish score archives. These are
  used as training and evaluation data locally and are **not redistributed** here or anywhere.
- Score metadata for the synthetic renders derives from
  **[SymbTr](https://github.com/MTG/SymbTr)** (Karaosmanoğlu et al.), which is licensed
  **CC BY-NC-SA 4.0** — attributed here accordingly.

No Western rehearsal data was used in fine-tuning; coverage comes from self-rendered Turkish
strips.

## Intended use and limits

Intended for reading Classical Turkish music notation. It is **not** a general-purpose OMR model —
it was fine-tuned on a Turkish token vocabulary and will not do anything sensible with orchestral
or piano scores.

Known limits, stated plainly:

- Accuracy on **clean synthetic** strips is effectively solved; accuracy on **real printed pages**
  is the open problem and is substantially lower. Treat every decode as a draft to be corrected —
  the application ships an editor for exactly that reason.
- The microtonal accidentals are the hard part, and the koma/küçük mücennep distinction is where
  the remaining errors concentrate.
- Long or dense staff lines can overrun the decoder's token budget.
- Handwritten manuscript is out of scope.

## Citation

If the base model is useful to you, cite that first —
[`Flova/omr_transformer`](https://huggingface.co/Flova/omr_transformer). For SymbTr:

> M. K. Karaosmanoğlu, "A Turkish makam music symbolic database for music information retrieval:
> SymbTr", ISMIR 2012.
