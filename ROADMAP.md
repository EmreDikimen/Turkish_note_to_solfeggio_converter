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
| OMR model (v1) | **Fine-tune a pretrained OMR model** (download a Western OMR model, retrain to add the AEU accidentals) | Reuses a model that already reads notes; we only teach the microtonal accidentals. Lead candidate `omr_transformer` — passed the Step-1 eval (`src/vision/MODEL_EVAL.md`); the final go/no-go is the Rung-1 overfit-10. |
| OMR model (fallbacks) | **CRNN+CTC (PrIMuS-based)**, then **YOLOv8 glyph detection** + heuristic decoder | Lighter CRNN if the transformer is too big/awkward for mobile; YOLO if sequence transfer disappoints. |
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

### Phase 2 — Synthetic training data
- **Render SymbTr scores to images with VexFlow**, reusing the harness's proven engraving
  (VexFlow 5 + Bravura), which already renders the Turkish microtonal accidentals correctly
  (koma, bakiye, küçük mücennep) via raw SMuFL codepoints. **Decided (see `docs/PHASE2.md` §3 +
  `tools/render/`):** a headless browser (Playwright) crops **short strips (~2–4 measures,
  ≤ ~46 tokens)** out of the harness's live full-score render, at a model-friendly size/aspect
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
    diagnostic**; the real run restarts from the original pretrained weights.
  - **ONNX/browser gate before scaling** (`docs/PHASE2.md` §5 Rung 1.5): export to ONNX + decode one
    strip in `onnxruntime-web` — prove the in-browser premise before paying for GPU time.
  - Scale training runs on **Colab Pro** (the Mac handles overfit-10, not thousands of images
    through 143M params). AdamW + small LR + checkpointing; train with the model's native loss
    (sequence cross-entropy for a vision-encoder-decoder; CTC for the CRNN fallback).
  - **Western rehearsal data** (incl. synthesized repeat-sign strips) mixed in to prevent
    catastrophic forgetting.
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
  rely on the base model's Western pretraining surviving fine-tuning. Our pipeline then
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
  GPU training. The CRNN+CTC fallback exports trivially (single forward pass).
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

**Phase 0: DONE (2026-06-20).** Symbolic → microtonal audio pipeline works with no ML.
- SymbTr dataset lives at `~/Downloads/SymbTr-2.0.0/` (txt, MusicXML, midi, mu2; 2200 pieces).
- `src/symbtr/parser.py` — parses SymbTr `.txt` → `Score`/`Event` model. Verified on all 2200 files.
- `src/audio/tuning.py` — `koma53_to_freq()`; 53-TET, concert anchor 440 Hz at comma 327 (written
  pitch sounds a fourth below — Turkish transposing convention). Validated
  against 12-TET (E5 → 659.97 Hz).
- `src/audio/synth.py` — additive synth + WAV writer (numpy + stdlib `wave`, no heavy deps).
- `scripts/symbtr_to_audio.py` — CLI: `python scripts/symbtr_to_audio.py <file.txt> -o out.wav --info`.
- Sample input in `data/raw/`, sample output in `data/processed/`.

**Phase 1: DONE (2026-06-22).** Shared TS core + web harness; load → view → edit → playback all working.
- ✅ Python `SymbTr → note-model JSON` exporter — `src/symbtr/export_json.py` +
  `scripts/symbtr_to_json.py` (schemaVersion 1; notes/rests/meta tagged; carries tuning params).
- ✅ npm-workspaces monorepo: root `package.json` (workspaces `packages/*`, `apps/*`).
- ✅ `packages/core` (TypeScript): `types.ts` (note model), `tuning.ts` (`koma53ToFreq`,
  verified parity with Python to 4e-5 Hz), `scheduling.ts` (`buildTimeline` + `AudioBackend`
  interface). Type-checks clean.
- ✅ `apps/web` (React + Vite): loads note-model JSON, **piano-roll** view (pitch = 53-TET
  comma, hover for note details), Web Audio `AudioBackend` playback at 53-TET. Builds + serves.
- ✅ **Transport + playhead** (added 2026-06-22): Play / **Pause / Resume** (via
  `AudioContext.suspend/resume` — no rescheduling) + Stop. A teal **playhead** bar tracks the
  currently-sounding note on the sheet, driven by `requestAnimationFrame` reading the audio
  clock (`WebAudioBackend.getPositionMs()` = `currentTime − originTime`), so it's
  sample-accurate and freezes correctly while paused. **Click-to-seek**: in the sheet's
  non-edit mode, clicking a measure plays from there (`play(timeline, fromMs)` re-schedules
  from an offset). End-of-piece is detected by polling the audio clock (pause-aware), not a
  wall-clock timer. The `AudioBackend.play` signature is now `play(timeline, fromMs?)`.
- ✅ **Drag-to-edit** (the core editing feature): drag a note vertically to change pitch
  (snaps to nearest comma, frequency + playback update live); drag its right edge to change
  duration (following notes reflow). Edits flow up to App → rebuild doc → re-render + replay.
  Inverse pitch-mapping math verified (zero round-trip error).
- ✅ **Sheet-music view + measure editor** (instructive mode): Piano-roll | Sheet toggle. The
  staff is engraved with **VexFlow 5** (real stems, flags, beams, dots, duration-correct
  noteheads/rests), with real **Turkish AEU accidentals via the Bravura font**. Trick: VexFlow's
  built-in accidental table lacks most Turkish glyphs, but `Accidental` renders an unknown code
  verbatim in the music font — so we pass the **raw SMuFL codepoint char** (from the verified
  `accidentalGlyph` map in `notation.ts`) and VexFlow still reserves layout space. Durations come
  from `durationBeats` via a fraction→VexFlow-code+dots mapper. Measure interaction: in edit mode
  an HTML overlay makes measures clickable (open editor); in non-edit mode a click seeks/plays
  from that measure (see Transport above). Top-right **Edit** button → click a
  measure → modal. Modal **Basic** tab: pick base note + how many commas sharp/flat (custom
  dropdown showing the Bravura **symbol + Turkish name**), duration, add/delete; **Advanced**
  tab adds absolute koma + frequency editing. **Save disabled + warning** unless the measure's
  total duration is preserved. Pitch stored as explicit spelling (letter+octave+alter), so
  names never enharmonically flip — verified: all 266 sample notes round-trip name & koma
  exactly. Measures come from SymbTr's `offset` column: an integer `offset` is one printed
  barline (one usul cycle), so `assignBars` tags each event with a stable 1-based `bar` and
  `groupMeasures` groups by it — correct for any usul, whole-note (düyek 8/8) or not
  (aksak 9/8, curcuna 5/4). The `bar` is assigned at load and carried through edits, with a
  whole-note fallback for data lacking a usable `offset`. New core (`notation.ts`,
  `measures.ts`, `tempo.ts`) is mobile-reusable; tempo derived in TS so no Python/schema change.
- ✅ **Key-signature mode** (added 2026-06-22): a sheet-view toggle (the **♯♭ Key sig** button)
  that draws the score's prevailing accidentals once after the clef on every row (makam-style
  signature) and suppresses inline accidentals on notes that match — deviating notes still show
  one (a natural sign when the note is natural under an altered signature). Signature is derived
  in core (`deriveKeySignature` in `notation.ts` = most-frequent accidental per pitch letter).
  Drawn by reserving width via `Stave.setNoteStartX` and appending Bravura SVG glyphs (VexFlow's
  native `KeySignature` only supports standard Western keys). This is the button-only slice of the
  README's deferred "settings modal" idea; the full modal (view/theme/this toggle) is still TODO.
  (Now generalized into a three-way **Accidentals** selector: every-note / key-signature /
  standard per-measure accidental-carry.)
- ✅ **Tempo control + usul-aware metronome** (added 2026-06-27): a **BPM** input that defaults
  to each piece's natural tempo (`estimateBpm`) and re-times playback live (`speed = chosenBpm /
  naturalBpm`); a **metronome** toggle; and a **usul selector**. New core `usul.ts` carries each
  usul's meter + beat **grouping** (e.g. aksak 9/8 = 2+2+2+3 eighths) and `buildMetronomeTrack`
  walks the bars (`groupMeasures`) to place clicks on the felt beats with the downbeat accented —
  so non-integer usuls click correctly, aligned to the bars, at any tempo. The selector defaults
  to the piece's own usul (else the usul whose meter matches the derived time signature). Pure
  data + scheduling math, mobile-reusable. (This is the click-track slice of the usul-rhythm idea;
  a real darbuka pattern + OMR-driven usul detection is still later — see below.)
- ✅ **Notation realism for synthetic data** (added 2026-06-28, toward Phase-2 image quality):
  - **AEU accidentals only on the engraved staff** — `toAeuAlter` (in `notation.ts`) snaps every
    alteration to the four standard signs (koma/bakiye/küçük·büyük mücennep); no numbered ±2/±3
    "folk" signs. The koma (pitch/audio) is untouched and the **editor keeps the exact alteration**;
    the decoder resolves sign → koma per makam later (Phase 4). So the model trains on CTM signs.
  - **Justified rows** — each system stretched to a uniform width (last line ragged), for realistic
    note spacing.
  - **Lyrics under the staff** — syllables, melisma underscores, optional hyphens; the parser now
    keeps SymbTr's word boundary (`lyric_word_end`/`lyricWordEnd`).
  - **Engraved header** (`metadata.ts` `scoreHeader`: makam+form, title, usul+tempo, composer) —
    the block Phase 2 draws into the images so the model learns to read makam/usul/tempo.
- ✅ **Transpose / ahenk in the harness** (added 2026-06-28): a **Transpose** dropdown over the
  core `transpose()` (defined for Phase 2), plus a **Keep sheet (sound only)** toggle for
  transposing instruments (kız/mansur ney — the sound shifts, the notation stays). Decoupled from
  the stored doc (display + timeline derive it; edits map back to base). Pairs with the concert-pitch
  anchor (Phase 0).
- ⏳ Optional later: feed OMR output into this harness (Phase 4).
- ⏳ Later: **usul-based rhythm playback (full).** Upgrade the usul-aware metronome above into the
  piece's usul played as a real rhythmic cycle on a traditional percussion sound (darbuka), so
  non-integer usuls sound idiomatic, not just clicked. The usul is auto-detected by OMR and stays
  user-editable (OMR can misread it); wire the automatic detection in with the OMR model (Phase 3–4).

**Phase 1 is complete** (piano-roll editor + sheet/notation editor + tempo/usul metronome +
transpose/ahenk + art-music-faithful engraving with header & lyrics). The ML track (Phase 2) has
started — **[docs/PHASE2.md](docs/PHASE2.md)** is the kickoff/hand-off doc (goal, de-risk ladder).

**Phase 2: IN PROGRESS (as of 2026-07-02).**
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
  identical notes). ⚠️ Regenerate any previously rendered strips — old ones carry semantic labels.
- ✅ **Rung-1 overfit-10: GO (2026-07-02)** — full fine-tune wiring proven on the Mac (MPS):
  10/10 strips reproduced exactly, `\sig` blocks and accidentals included
  (`src/vision/overfit10.py` + `data.py`; result logged in `src/vision/MODEL_EVAL.md`).
  The gate caught two decode-side wiring bugs (no-EOS labels; generation stopping on "."
  instead of `</s>`) — fixed and carried forward. `omr_transformer` is confirmed trainable
  on our notation.
- ⏳ Next: the **Rung-1.5 ONNX/browser gate** (export → `onnxruntime-web` → decode one strip in
  a real browser); passes → Colab Pro for the scaled fine-tune (augmentation + full data).

Run the harness: `npm install` then `npm run dev:web` (export a sample first:
`python scripts/symbtr_to_json.py <file.txt> -o apps/web/public/sample.json`).

Note: Phase-0/training Python stays in `src/` for now; the `ml/` rename is cosmetic and deferred.

Web deps of note: `vexflow@5` (notation engraving; bundles the Bravura font, hence the large web
bundle — acceptable for the web app).

_Last updated: 2026-07-02._
