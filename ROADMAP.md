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


## 2. Target architecture

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
- **Render SymbTr scores to images with VexFlow**, reusing the harness's proven engraving
  (VexFlow 5 + Bravura), which already renders the Turkish microtonal accidentals correctly
  (koma, bakiye, küçük mücennep) via raw SMuFL codepoints. Render staff-by-staff and rasterize
  each staff to PNG — either a Node script using `node-canvas`, or a headless browser
  (Playwright/Puppeteer) if embedding the Bravura font that way is simpler.
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
- Emit labels as **symbol-token sequences per staff strip** (for CRNN). (If falling back
  to YOLO, emit bounding boxes instead.)
- **Milestone:** thousands of labeled staff-strip images.
- ⚠️ **This phase's augmentation quality decides project success** more than architecture
  (how realistically you augment toward real photos matters most).

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
- **Milestone:** photograph real sheet music → edit → hear it, all in the browser.

### Phase 5 — Mobile app (THE PRODUCT)
- This is the actual release. Everything before it is groundwork/validation.
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
- Resist building Phase 5 (mobile/edge) early; it's the slowest path and gates nothing.

---

## 6. Status / next action

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
transpose/ahenk + art-music-faithful engraving with header & lyrics). Next major milestone is the
ML track (Phase 2: synthetic training data).

Run the harness: `npm install` then `npm run dev:web` (export a sample first:
`python scripts/symbtr_to_json.py <file.txt> -o apps/web/public/sample.json`).

Note: Phase-0/training Python stays in `src/` for now; the `ml/` rename is cosmetic and deferred.

Web deps of note: `vexflow@5` (notation engraving; bundles the Bravura font, hence the large web
bundle — fine for a throwaway harness).

_Last updated: 2026-06-28._
