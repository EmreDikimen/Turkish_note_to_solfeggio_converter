# History — the phases, the MVP ladder, closed backlog and risks, one-time setup

purpose: HISTORY ONLY, do not act on it: phases 0–2, the MVP rungs W0–W10, the slicer port plan, closed backlog items and risks, and the finished one-time cloud and hosting setup walkthroughs
audience: anyone who needs to know why something is the way it is
updated: 2026-11-20

> ⛔ **ARCHIVED — history only. Never act on anything here;** current state is in [STATUS.md](../STATUS.md).

**Merged into this file on 2026-11-20:**

- [History — detailed log of completed phases](#history--detailed-log-of-completed-phases) — was `docs/archive/phases.md`
- [Phase 2 — synthetic data + the fine-tune ladder (CLOSED 2026-07-09)](#phase-2--synthetic-data--the-fine-tune-ladder-closed-2026-07-09) — was `docs/archive/phases.md`
- [W0–W3 — opencv.js parity, the decode module, and the browser-vs-Python verdict](#w0w3--opencvjs-parity-the-decode-module-and-the-browser-vs-python-verdict) — was `docs/archive/phases.md`
- [MVP rungs — what each one established](#mvp-rungs--what-each-one-established) — was `docs/archive/phases.md`
- [Porting the slicer to TypeScript — W4–W6](#porting-the-slicer-to-typescript--w4w6) — was `docs/archive/phases.md`
- [MVP track — the in-browser pipeline, and a release to friends (CLOSED)](#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed) — was `docs/archive/phases.md`
- [Backlog — closed items, archived](#backlog--closed-items-archived) — was `docs/archive/phases.md`
- [Risks — closed caveats, archived](#risks--closed-caveats-archived) — was `docs/archive/phases.md`
- [Setting up Google Cloud — step by step, in plain words](#setting-up-google-cloud--step-by-step-in-plain-words) — was `docs/archive/phases.md`
- [Putting the app online — step by step, in plain words](#putting-the-app-online--step-by-step-in-plain-words) — was `docs/archive/phases.md`
- [The friends release — plan, build order and ladder (W9/W10)](#the-friends-release--plan-build-order-and-ladder-w9w10) — moved from `docs/app/server.md` on 2026-11-20


## History — detailed log of completed phases

*Was `docs/archive/phases.md` (last updated 2026-07-04 (content frozen; moved to docs/log/ on 2026-07-26)).*

> Extracted verbatim from ROADMAP §7 on 2026-07-04. **Current** state and next action live in
> [../STATUS.md](../STATUS.md) — not here. Later history: [status-log.md](../log/status-log.md).
> Code map: [../CODE_TOUR.md](../CODE_TOUR.md).

### Phase 0: DONE (2026-06-20)

Symbolic → microtonal audio pipeline works with no ML.
- SymbTr dataset lives at `~/Downloads/SymbTr-2.0.0/` (txt, MusicXML, midi, mu2; 2200 pieces).
- `src/symbtr/parser.py` — parses SymbTr `.txt` → `Score`/`Event` model. Verified on all 2200 files.
- `src/audio/tuning.py` — `koma53_to_freq()`; 53-TET, concert anchor 440 Hz at comma 327 (written
  pitch sounds a fourth below — Turkish transposing convention). Validated
  against 12-TET (E5 → 659.97 Hz).
- `src/audio/synth.py` — additive synth + WAV writer (numpy + stdlib `wave`, no heavy deps).
- `scripts/symbtr_to_audio.py` — CLI: `python scripts/symbtr_to_audio.py <file.txt> -o out.wav --info`.
- Sample input in `data/raw/`, sample output in `data/processed/`.

### Phase 1: DONE (2026-06-22; polish through 2026-06-28)

Shared TS core + web harness; load → view → edit → playback all working.
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
started — **[phases.md](#phase-2--synthetic-data--the-fine-tune-ladder-closed-2026-07-09)** is the kickoff/hand-off doc (goal, de-risk ladder).


## Phase 2 — synthetic data + the fine-tune ladder (CLOSED 2026-07-09)

*Was `docs/archive/phases.md` (last updated 2026-07-26 (content closed; live work moved to docs/rung3/)).*

> **This track is finished.** Rungs 0 → 2.2b all passed; reading synthetic music is a solved
> problem. Live work is the real-page track: [rung3/README.md](phases/rung3/README.md). Current state:
> [STATUS.md](phases/STATUS.md). Numbers: [METRICS.md](phases/METRICS.md).
>
> Still useful here: the label scheme, the augmentation policy (§3), the token designs (§6), and the
> de-risk ladder's reasoning (§5). Architecture and phase plan: [../ROADMAP.md](ROADMAP.md).
> **Phase numbering:** the rung ladder spans ROADMAP Phases 2–3 — Rungs 0–1.5 + data gen are
> Phase 2; Rung 2 (scaled fine-tune) and Rung 3 (real pages) are Phase 3; Rung 4 is Phase 4.

### 1. The project in one line
Photograph Classical/Art **Turkish (makam)** sheet music → recognize the notes *including
microtonal accidentals* → an **editable** note model → play back at exact **53-TET (AEU)** pitch.
Ship the web app first (in-browser inference, **no server** — can't afford hosting), then convert it
to mobile. Python is training/data only.

### 2. Where we are (Phase 1 DONE — the renderer is ready)
The harness engraves sheets that look like real **Classical Turkish Music** scores, which is
exactly what Phase 2 renders into training images:
- **AEU accidentals only** on the staff (`toAeuAlter` snaps every alteration to koma/bakiye/küçük·
  büyük mücennep; no numbered ±2/±3 "folk" signs). The exact koma (sounding pitch) is preserved in
  the data — the editor still shows it — and is recovered later by the makam-aware decoder.
- **Lyrics** (syllables, melisma underscores, optional hyphens), an **engraved header**
  (makam/form/title/usul/tempo/composer), **justified rows**, correct AEU **key signatures**.
- **Concert-pitch tuning** (anchor a fourth below written) and **transpose** (incl. sound-only ahenk).
- SymbTr→note-model→render pipeline works; 3 sample scores in `apps/web/public/`.

### 3. Phase 2 goal — fine-tune a pretrained OMR model on synthetic Turkish data
We **transfer-learn**: take a model that already reads Western notation and teach it the one new thing
this project needs — the Turkish microtonal accidentals. No model is trained from raw weights.
```
download pretrained Western OMR model ──► extend its vocab with Turkish AEU accidentals
        ▲                                              │
        │ (gated by a quick eval, §4)                  ▼
SymbTr → note-model → (TS) render staff PNG ─► (Python) fine-tune (image, label) pairs
                          │                              ↑
                          └── label emitted in the MODEL'S output format, same render pass ──┘
```
- **Chosen model (all gates passed):** `Flova/omr_transformer` on HuggingFace — a Donut-style
  vision-encoder-decoder (image → LilyPond), Western-trained, downloadable (Apache-2.0). It passed
  the Step-1 eval (§4), the Rung-1 overfit-10 (GO), the Rung-1.5 ONNX/browser gate (PASS) and the
  Rung-2 scaled fine-tune (PASS, 99.9% headline — §5). The lighter **CRNN+CTC** (PrIMuS-based)
  fallback is fully retired (export concern at Rung 1.5, accuracy concern at Rung 2).
- **Render with VexFlow headless** (Playwright minimal page), reusing the harness engraving (the
  engraving relies on DOM SVG + `getComputedTextLength` + the Bravura web font, so a real browser is
  the low-risk way to reuse it exactly). Render **FROM the note model**, so labels are emitted from the
  same data that draws the image (perfect alignment, no re-parse) — **in the chosen model's output
  format**. The label generator is TypeScript; OpenCV augmentation is Python.
- **Render SHORT strips (~2–4 measures) at a model-friendly size/aspect** (≈ the model's input frame,
  e.g. ~583×409 for `omr_transformer`) — not whole wide rows. Long lines overrun the decoder's token
  cap (notes go missing), and extreme wide-short strips get squashed on resize, blurring beam/flag
  detail so durations flip (8th↔16th). Both were observed in the Step-1 tests.
- **Pitch augmentation:** core `transpose(doc, commas)` — render each piece at several transpositions.
- **Image augmentation (Python/OpenCV+albumentations, on-the-fly in the training loader):**
  ⚠️ **This decides success more than the model architecture** — and it must match what users
  actually upload: **mostly WEB SCREENSHOTS** (scores viewed in a browser/PDF — clean geometry,
  flat white, only resampling/JPEG damage); camera photos of printed pages are the minority
  (user, 2026-07-06). So `src/vision/augment.py` mixes two profiles at `PHOTO_SHARE = 0.35`:
  **screenshot** (65%: down-up rescale softness, JPEG, tiny brightness/contrast, light noise;
  a slice passes nearly clean) and **photo** (35%: rotation, perspective warp, staff curvature,
  ink bleed/fade, paper texture, soft shadows, lighting gradients, blur, sensor noise, JPEG).
  Revisit the ratio at Rung 3 against real usage. Preview grid (the human gate on strength):
  `python src/vision/augment.py --out data/synthetic/aug_preview.png`.

### 4. Step 1 — evaluate the candidate model FIRST (the gate)
Before building any pipeline, download `omr_transformer` and check the things that decide everything
downstream:
- Does it **read Western notation** well (run it on a Western sample + a few of our rendered staves)?
- What is its **exact output format** (LilyPond token stream)? Can our renderer emit labels in it?
- How do we **extend its tokenizer/vocabulary** with the microtonal accidental tokens?
- **Model size** — viable to export to ONNX and (eventually) run on mobile?

Record findings in `src/vision/MODEL_EVAL.md`. If it fails the gate, evaluate the CRNN/PrIMuS fallback
before committing. **The accidentals are the only new thing we teach it** — the AEU signs
(koma/bakiye/küçük·büyük mücennep) as new output tokens. The **exact koma is NOT a token**; the
**decoder (Phase 4)** turns (AEU sign + makam) back into the precise koma.

**makam/usul/tempo are header metadata, NOT model outputs.** Predicting makam would overcomplicate the
model and overfit (many classes, a global property a single strip can't determine). Keep it as a
separate header-reading step (printed name + small classifier/heuristic) and **user-editable**.

**Label scheme — FAITHFUL + signature extraction (agreed; supersedes the earlier "semantic" scheme,
which broke mid-row crops).** The label marks only what is *drawn* on each note — an explicit deviation
accidental, an explicit **`\natural`** (cancel), else **bare**. **Row-start strips** (crop includes the
clef + signature) also **prefix the read key signature** (`\sig … \sigend`) so the OMR *extracts* it —
a **makam-independent** source of the row's default accidentals (crucial for photos with no makam). The
Phase-4 decoder resolves each **bare** note from the OMR-read signature and/or the makam's per-degree
defaults; explicit accidental/natural override; `makam = none` + no signature → as-written. New tokens:
the 8 AEU accidentals + **`\natural`** + **`\sig`/`\sigend`** + `|` + `3`. Treble is assumed (universal
in the repertoire), so clef-less mid-row crops are fine.

### 5. The de-risk ladder (never invest a week before a day proves it works)
- **Rung 0 — model gate (~½ day)** ✅ **passed:** §4 above. Confirm the downloaded model reads notes and we know how
  to extend it. **Start here.**
- **Rung 1 — wiring proof + model GO/NO-GO (~1–2 days, runs on the Mac via MPS)** ✅ **GO (2026-07-02):** render ~50 short
  strips with labels in the model's format, wire the fine-tuning loop (load weights → extend tokenizer
  → train — **freeze NOTHING for this test**, the whole model is trainable), and **overfit 10 samples**
  until the model reproduces them exactly (accidentals included).
  This is the **decision point for `omr_transformer`**: a clean overfit → keep it and scale (Rung 2);
  **can't overfit 10 → pivot to the CRNN/PrIMuS fallback**. The base model's raw accuracy on unseen
  styles is poor-but-expected (seen in Step-1 tests), so *this* — whether it can learn our notation —
  is how we judge the model, not the raw eval. (The overfitted checkpoint is a **throwaway
  diagnostic** — it only proves the wiring; Rung 2 re-starts from the original pretrained weights.)
- **Rung 1.5 — ONNX/browser gate (~1 day, BEFORE paying for GPU time)** ✅ **PASS (2026-07-03):** the product premise is
  **in-browser inference**, and an autoregressive encoder-decoder is the *hard* export case
  (past-key-values, a generation loop that must be re-implemented in JS) — so prove it now, while
  changing models is still cheap. Export the model to ONNX (`optimum-cli export onnx` → encoder +
  decoder-with-past graphs), load it with `onnxruntime-web`, hand-roll the greedy decode loop in JS,
  and decode **one strip in a real browser**; measure latency. Pass → buy Colab Pro and scale (Rung 2).
  Fail or unusably slow → that's a model-choice fact: the **CRNN+CTC fallback is a single forward
  pass** and exports trivially. (Model hosting: serve the int8 ONNX files — **221 MB** total across
  the encoder / decoder / decoder-with-past graphs, per the actual Rung-1.5 export — from the
  **HuggingFace Hub CDN** — free; the browser downloads and caches them. No server needed.)
- **Rung 2 — scale (Colab Pro)** ✅ **PASS (2026-07-07, first try — headline 99.9% mean per-class
  AEU accuracy, SER 0.001, exact-match 96.8% on the held-out pieces; full log in
  `src/vision/MODEL_EVAL.md`; the CRNN fallback is retired):** (the Mac is fine for overfit-10,
  not for thousands of images through 143M params) thousands of augmented strips, training
  **from the original pretrained weights**;
  **full fine-tune at a small LR** (AdamW, ~1e-5–5e-5) — freezing the encoder is a **memory/compute
  fallback, not the default**: our images (VexFlow engraving, later phone photos) don't look like the
  base model's training images, so the encoder needs to adapt too. Mix in **synthesized repeat-sign
  strips** (see §6; no Western rehearsal data — plan updated) + measure the **headline metric:
  per-class accuracy on the 8 AEU accidentals** (SER secondary) on a held-out synthetic split. ⚠️ **Split train/val BY PIECE, not by
  strip**: every strip and every transposition of a piece goes into the same split. Strips of one
  piece are near-duplicates (same melody, same engraving); if a piece straddles both splits,
  validation is contaminated and the metrics look great while proving nothing.
- **Rung 3 — the moment of truth:** run on real phone photos (worse — the expected synthetic→real
  gap), then **fine-tune on a few hundred real photos** labeled via *this app's editor*. This small
  real set matters more than any hyperparameter. *(Under way since 2026-07-10 and now the live
  track — it grew into its own doc, `RUNG3.md`: archive collection, SymbTr name-matching for free
  labels, a frozen exam, and the Round-N loop. Round 1 was taken and shipped 2026-07-23. The
  prediction held — real pages ARE much harder than synthetic — and the small real set did matter
  more than any hyperparameter, twice over: the largest tuning intervention moved the selection
  metric 0.5 pp, while a data/renderer fidelity fix moved a single class by tens of points.)*
- **Rung 4 (Phase 4):** wire preprocess → staff isolation → model → decode → note model → editor;
  run on-device via `onnxruntime-web`. *(Stages 1–8 built 2026-07-10 — slicer, page decode, and the
  stitcher; design + status in `CODE_TOUR.md`.)*

**Three reassurances:** (1) we only teach the model the AEU accidental tokens — the easy end of OMR
(monophonic, small known new vocab, self-generated perfect labels) — on top of a model that already
reads notes; (2) metrics make each fear measurable (**per-class accidental accuracy** is the headline);
(3) the **editable note model is the safety net** — OMR needn't be perfect, the user corrects it.

### 6. Known gaps / decisions to carry forward
- **SymbTr has no repeats/voltas/D.C./ties/slurs** (flattened out) → can't auto-label them from
  SymbTr. **Validated 2026-07-02 against the full dataset:** zero of the 2,200 MusicXML files contain
  `<repeat>`, `<ending>` (volta), segno, coda, or any `<bar-style>`; the mu2 files have no repeat rows
  either. But real photos **do** show repeat signs, so the model must **recognize** them. **Primary
  plan: synthesize them ourselves** — VexFlow draws repeat barlines (`Barline.type.REPEAT_BEGIN/END`)
  and voltas (the `Volta` stave modifier), so the strip renderer can inject repeat signs into a
  fraction of strips with self-generated labels, exactly like every other symbol. Do NOT count on the
  base model's Western pretraining surviving fine-tuning (it's a small model and SymbTr strips are
  repeat-free — whatever it knew would be forgotten). The pipeline then **flattens/expands** repeats
  on output (the section is shown twice, no repeat sign). Tuplets DO exist (MusicXML); barlines come
  from SymbTr `offset` (`assignBars`/`groupMeasures`).
  - **Encoding decided 2026-07-02: 4 new faithful drawn-symbol tokens** — `\repstart` `\repend`
    `\volta1` `\volta2`. The base vocab's structural `\repeat `/`volta ` tokens are unusable (a crop
    usually shows only one end of a repeat; no braces in the vocab anyway — see `MODEL_EVAL.md`).
    Plain `|` stays in the labels: each read barline re-anchors measure reconstruction, so a duration
    misread corrupts one measure instead of desyncing the rest (and the editor pivots on measures).
  - **Placement: duplicate-run detection + random injection.** SymbTr's flattening leaves each
    repeated passage as an adjacent duplicate measure run, so the sign positions are recoverable
    (equal runs → repeat signs; equal-but-last-measure → volta 1./2.) — verified against the printed
    gamzedeyim score. **Implemented 2026-07-02** (`tools/render/repeats.ts` `detectRepeats` +
    serializer support): detection ONLY — the doc/layout/playback stay untouched; the signs are
    drawn onto the same engraving and strip labels carry the matching tokens (the still-drawn
    duplicate pass is invisible to 1–3-measure strips). ✅ **Random injection DONE (2026-07-05)**:
    `injectRepeats` (same file) adds 2–4 seeded spans on ~half of renders; 6.4% of v2 strips carry
    repeat tokens.
- **Navigation marks (segno 𝄋 / coda ⊕ / "D.C." / "Son") — same story as repeats, closed
  2026-07-06:** zero in SymbTr, but routine on real sheets (the neyzen.com engravings use the
  ⊕-jump + D.C. + Son form constantly), and without them the flatten/expand step can't finish a
  da-capo piece. **4 new faithful drawn-symbol tokens** — `\segno` `\coda` `\dc` `\fine` —
  injected like repeats (`tools/render/navmarks.ts`: seeded 4–6 marks on ~70% of renders via
  `navseed` — denser than a real page on purpose; at 2–4-marks/50% the rarer tokens simulated
  UNDER the audit floors — coda as an end→start ⊕ pair, D.C./Son above OR below the staff,
  never stacked on repeat/volta measures). Drawn in SheetView (Bravura glyphs + italic text), labeled at the drawn
  measure edge, decoded in `decode.ts`, audited with per-token floors (`audit_coverage.py`).
  ✅ **Re-rendered same day: `data/synthetic/strips_v2_1/` (18,627 strips), audit PASS** —
  injection density was set by SIMULATING the audit floors first (at the initial 2–4 marks on
  ~50% the rarer tokens came in under floor; shipped at 4–6 on ~70%). Also baked in: the
  centered-rest engraving fix (`alignRests` off in SheetView). Train on v2_1, not v2.
- **Triplets (tuplet brackets) — ✅ CLOSED 2026-07-08, together with the tie + grace bundle
  below (one strips_v2_2 upgrade; implementation details + audit numbers in `docs/log/status-log.md` —
  18,777 strips, audit PASS, 413 `\tup3` / 704 `\tie` / 1,996 `\grace` strips; drawn as the
  curved-arc "3" of printed Turkish scores on ~70% of pieces, VexFlow's square bracket on the
  rest; Rung-2.2 retrain pending). Two findings vs. the plan text below: fractions must be
  REDUCED first (`3/12` is a plain 1/4, so 37 — not 58 — of the 150 pieces truly carry
  triplets), and val `\tup3` is structurally thin (9 occurrences — the dense val pieces' triplet
  bars exceed the token budget, as in v2_1; smoke-signal metric only). Original gap (found
  2026-07-07 by the first real-image upload test — triplet 8ths came back as `16. 32`):**
  SymbTr DOES have them (survey
  over all 2,200 txt files: **34.8% of pieces** contain tuplet-fraction durations, **1.86% of
  notes** — 8th/16th triplets, `Pay/Payda` 1/12 and 1/24, dominate; **58 of our 150 selected
  pieces** have some), but the pipeline currently SNAPS tuplet fractions to the nearest plain
  duration (`lilyDuration`'s fallback + SheetView's `vexDuration`), so the synthetic sheets draw
  triplet passages as ordinary 16ths — no bracket, no "3" — and the model, never having seen the
  bracket, invents plausible-but-wrong rhythms on real scores. The base model can't help: its BPE
  vocab is **54 char-level ids — no `{`/`}`, no `/` (and originally no digit `3`)** — so
  LilyPond's structural `\tuplet 3/2 { … }` is UNSPELLABLE. Same situation as the repeat signs →
  same medicine, faithful drawn-symbol tokens. **Plan: 2 new tokens `\tup3 … \tupend`** wrapping
  the bracketed group (digit in the name for a future `\tup5`, like `\volta1`/`\volta2`; the
  written durations inside stay as drawn — three plain 8ths under a 3-bracket); detect groups
  from note-model durations (runs of 1/12 / 1/24 summing to a plain value — REAL data, no
  injection needed, unlike repeats/nav marks); draw with VexFlow `Tuplet`; decoder round-trip;
  audit floors; re-render `strips_v2_2` → Rung-2.2 retrain → re-export (all three steps proven +
  scripted). This also makes those 58 pieces' sheets rhythmically correct for the first time.
  **Why before Rung 3:** the labeling loop serializes hand-corrected real photos through THIS
  serializer — a format that can't express triplets would poison the very labels the loop exists
  to create.
  - **Ties / long held notes — ✅ done in the same bundle (user decision 2026-07-07):**
    SymbTr writes a long value (5/8, 9/8, 5/4, 5/16 … ≈0.3% of notes) as ONE event, but the
    engraved form is a **tied pair** (e.g. 5/8 = half + tied 8th); today we snap it to a plain
    value — a real duration error in the audio. LilyPond's `~` is unspellable in the base vocab
    → **+1 faithful token `\tie`**, emitted between the two written notes of the drawn pair.
    Rendering splits the long value into tied written notes (SheetView draws the arc via
    VexFlow); the note model keeps the ONE event untouched (audio/`koma53` stays the source of
    truth); the Phase-4 decoder merges `x \tie x` back into one event. (Implementation notes:
    accidental drawn/labeled only on the FIRST written note; long RESTS split side-by-side with
    no tie, as engraved; no across-the-barline handling needed — `assignBars` gives each event
    exactly one bar, so the written pair always draws inside its own measure; a value the greedy
    split can't resolve in ≤3 written notes keeps the legacy snap.)
  - **Grace notes (çarpma) — ✅ done in the same bundle, recognized like ties (user decision
    2026-07-07):** SymbTr has them as real data (Kod 8, ~12.8k occurrences — no injection
    needed) but we currently drop them (Ms=0 → META) and never draw them, so on a real photo
    the model would read the small notehead as a REAL note and corrupt the measure's rhythm.
    Fix: **+1 faithful token `\grace`**, prefixing the small note's own spelling (e.g.
    `\grace \bakiyeSharp f''8` — pitch/accidental/duration reuse the existing vocab): expose
    grace events through the parser/JSON export (new event kind, zero playback duration for
    now), engrave the small slashed notehead (VexFlow `GraceNote`), decoder round-trip attaches
    the grace to its main note in the note model — so ornament PLAYBACK becomes possible later
    without another retrain. Audit floors like every token.
    **Total new ids for v2_2: 4** (`\tup3` `\tupend` `\tie` `\grace`, 96 → 100).
- **Strip-length coverage gap:** ✅ **CLOSED (2026-07-05)** — cap raised 46→56 (`STRIP_BUDGET`,
  one shared constant) and piece selection targets sparse pieces. Measured on the v2 render:
  39.9% of every-mode strips span 2–4 measures; `|` in 40.7% of labels. Two hard facts learned:
  a dense measure costs ~38 REAL tokenizer ids (≈4/note), so dense measures can never pair under
  the decoder's 60-id budget; and single measures that exceed the budget are now DROPPED at
  export (an over-budget label can never generate its EOS — a poisoned sample).
- ✅ Render **both lyric and lyric-free** strips (38.7% lyric in v2), and **randomize header/footer
  text** so the model learns to ignore non-musical text — drawn INSIDE the SVG crop bands
  (`apps/web/src/textNoise.ts`); the real engraved header is an HTML element outside the crops.
- ✅ **Büyük-mücennep coverage via low-rate AEU-enharmonic respell (2026-07-05, user decision):**
  the whole corpus has ~47 notes at ≥6 commas and smallest-alteration respelling can't exceed ±5,
  so `tools/render/respell.ts` flips a seeded ~8–15% of koma-sign notes to their exact büyük
  enharmonic (same pitch, other valid glyph) — enough for the decoder to LEARN the token (~1,150
  occurrences in v2), deliberately NOT rebalancing toward a sign real photos rarely show.
- Keep audio/`koma53` untouched by rendering changes — it's the decoder's source of truth.
- **Headline metric:** per-class AEU-accidental accuracy. **No Western rehearsal data** in
  fine-tuning (plan updated; repeat-sign coverage comes from our own synthesized strips, §6).
  **Makam stays out of the OMR model.**

### 7. Before scaling Phase 2 (checklist)
- [x] **Step 1 model gate** — `omr_transformer` evaluated (`src/vision/MODEL_EVAL.md`): passed
      (reads notes, LilyPond output, vocab extendable, ~143M params). Final go/no-go = overfit-10.
- [x] Confirm green typecheck (`npx tsc` core + web — clean as of 2026-07-02).
- [x] **Label output format decided AND implemented** — LilyPond + AEU tokens, **faithful +
      signature scheme** (§4), in `tools/render/lilypond.ts` (2026-07-02). Round-trip verified on
      all sample scores. Re-render DONE (2026-07-05): `data/synthetic/strips_v2/` carries the
      repeat-sign tokens + multi-measure coverage — audit PASS (`docs/log/status-log.md`).
- [x] Scaffold `tools/render/` (Playwright strip renderer — done, incl. Strip panel + decoder CLI).
      `src/vision/` has the eval script, the dataset wiring (`data.py`), the overfit-10 gate
      (`overfit10.py`), the ONNX-gate scripts, and the coverage audit (`audit_coverage.py`).
- [x] **Rung-2 training kit (2026-07-06):** `augment.py` (two-profile screenshot/photo
      augmentation, §3), `modeling.py` (shared model/tokenizer setup — the overfit-10-proven
      wiring), `train.py` (full fine-tune, AMP, warmup+cosine LR, val loop, checkpoint/resume
      for Colab), `eval_omr.py` (per-class AEU accuracy + SER via id-space Levenshtein
      alignment). Smoke-tested on the Mac: train → resume → eval all run end-to-end.

### 8. Next action

> **Canonical status + next action: [STATUS.md](phases/STATUS.md).** Gate results (full settings, bug
> notes, export details) are logged in [../src/vision/MODEL_EVAL.md](src/vision/MODEL_EVAL.md);
> the headline numbers are collected in [METRICS.md](phases/METRICS.md).

Short form: Rungs 0–1.5 are all **done** (model gate passed; overfit-10 **GO** 2026-07-02 — the
two decode-wiring fixes live in `src/vision/data.py`/`overfit10.py` and carry forward; ONNX/browser
gate **PASS** 2026-07-03 — see the ✅ markers in §5), the **Rung-2 dataset upgrades are DONE**
(now **`data/synthetic/strips_v2_1/`**, coverage audit PASS 2026-07-06 — carries the
navigation-mark tokens (§6) and the centered-rest fix; supersedes v2 — `docs/log/status-log.md`), and the
**Rung-2 training kit is DONE + smoke-tested** (2026-07-06: `augment.py` / `modeling.py` /
`train.py` / `eval_omr.py`, screenshot-dominant augmentation per §3). **Rung 2: PASS
(2026-07-07, first Colab Pro run)** — headline **99.9% mean per-class AEU accidental accuracy**
(8/8 classes), SER 0.001, exact-match 96.8% on the 20 held-out pieces; checkpoint local at
`data/checkpoints/rung2-best/` (Drive `MyDrive/tnc/rung2/best` is the backup); full log + error
taxonomy in `src/vision/MODEL_EVAL.md`; the CRNN fallback is retired. **Rung-2 ONNX export:
PASS (2026-07-07, same day)** — the Rung-1.5 pipeline rerun on `rung2-best`: export → int8
(now committed: `src/vision/quantize_onnx.py`; 221 MB) → Python parity 5/5 (fp32 + int8) →
browser gate 10/10 exact on held-out-piece strips with real Turkish accidentals, ~1.0 s/strip
(`MODEL_EVAL.md`; watch it yourself: `docs/MANUAL_CHECKS.md` Check 9). **The rhythm-sign
dataset upgrade (§6) is DONE (2026-07-08)** — triplets + ties + grace notes, 4 new tokens
`\tup3` `\tupend` `\tie` `\grace` (96 → 100 ids), recovered from real durations by
`tools/render/rhythm.ts`; **`strips_v2_2` rendered (18,777 strips) + audit PASS** (live check:
`docs/MANUAL_CHECKS.md` Check 3c) — and the **Rung-2.2 retrain PASSED the same day** (Colab,
from base weights): **headline 99.9% (8/8), SER 0.002, exact-match 96.7%** on the 2,417
held-out val strips; `\tup3`/`\tupend` 100%, `\tie` 96.4%, `\grace` 98.0% recall
(`MODEL_EVAL.md` "Rung 2.2"; checkpoint: Drive `MyDrive/tnc/rung22/best`). **Rung 2.2b —
stem-fix + triplet expansion — PASSED 2026-07-09** (tuplet stems follow pitch, 40 triplet-rich
pieces added; `\tup3` 98.3% on 118 gold), and its **ONNX export passed the same day** (parity
10/10 fp32 + int8, browser gate 20/20).

**This doc stops being the live one there.** Everything after Rung 2.2b is REAL-page work
(Rung 3 collection + labeling + the frozen exam + the Round-N loop, and Rung 4's page→strips
pipeline): the live track is **[RUNG3.md](phases/RUNG3.md)** (detail), **[CODE_TOUR.md](phases/PIPELINE.md)**
(page→strips→stitch design), and **[OVERVIEW.md](phases/OVERVIEW.md)** (plain-English "where we are").
**The canonical status + next action stays [STATUS.md](phases/STATUS.md).**


## W0–W3 — opencv.js parity, the decode module, and the browser-vs-Python verdict

*Was `docs/archive/phases.md` (last updated 2026-08-07).*

> Split out of [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) on 2026-08-07 at the 400-line cap. That page now holds the
> **slicer** rungs (W4–W7); this one holds the four that came before. The ladder itself, with
> current state, is [README.md](phases/README.md); next action is [../STATUS.md](STATUS.md).

---

### W0 — opencv.js primitive parity ✅ PASS (2026-08-02)

Before transliterating 1,000 lines, prove the primitives underneath behave identically. Run it with
`npm run probe:cv`; regenerate the reference with
`.venv-ml/bin/python scripts/cv_probe_ref.py <page.png>`.

**Both sides are OpenCV 5.0.0** (`cv2` 5.0.0, `@techstark/opencv-js` 5.0.0-release.1) — the
versions were checked, not assumed.

The probe runs **two arms**, and the split is the whole point:

- **Arm B — opencv.js fed Python's own grayscale bytes.** All five exact: Otsu threshold (154),
  ink pixel count (408,651), the full 2,339-row MORPH_OPEN projection, connectedComponents (1,522
  labels), and the INTER_AREA column sums. This is algorithm parity, and it is the gate.
- **Arm A — opencv.js fed the browser's own PNG decode.** Cannot be exact and never will be: see
  below. Reported as drift, not pass/fail.

**Grayscale cannot be exact, and that is fine.** `cv2.imread(IMREAD_GRAYSCALE)` converts inside the
PNG decoder; a browser only ever gets RGBA out of the decoder and converts afterwards. OpenCV's own
two paths already disagree — `imread`-gray vs `cvtColor` on `imread`-colour differ by ±1 on **7.4%**
of pixels of a colour page. 18% of corpus pages are truly colour (sampled 120), so this is not an
edge case.

**What settles it is a sensitivity measurement, not a tolerance argument.** Re-running the entire
slicer on the 6 most colour-shifted pages in the corpus under exactly that ±1 perturbation left all
**119 strips bit-identical** — same strip count, `row_x0`/`row_x1`, `scale`, `row_bars`, pads.
Sub-quantization grayscale noise does not reach the output. Numbers in
[../METRICS-SLICER.md](METRICS-SLICER.md).

**Verdict: proceed with the port; the pre-blessed W0 fallback (hand-writing grayscale/Otsu) is not
needed.**

### W1 — decode module extracted, logprobs added ✅ DONE (2026-08-02)

`omrGate.ts` 309 → 164 lines. The reusable half now lives in `apps/web/src/omr/`
(`types.ts`, `decode.ts`, `preprocess.ts`); the gate keeps only its DOM, the reference-vs-canvas
comparison and the upload demo. **`omr-gate.html` is byte-identical** (`git diff --stat` empty) and
still reads **27/28 with the same failing strip and the same token stream**.

Two things worth knowing about the move:

- **`preprocessCanvas` widened** from `HTMLImageElement` to any `CanvasImageSource` via a
  `sourceSize()` helper, because the slicer (W6) emits canvases rather than `<img>` elements. A
  `canvasFromImageData()` helper came with it.
- **`willReadFrequently` was deliberately NOT added** to the preprocessing canvas context. It can
  move rasterization to software, which is exactly the sort of change that would perturb
  `drawImage` filtering and the gate's 14/14 canvas arm with it.

#### The logprob check, and the criterion that was wrong

`argmaxLast` now also returns the chosen token's log-probability — `-log(Σ exp(row - row[tok]))`,
copied from `onnx_parity.py:83` and stable by construction because `tok` is the argmax. The logits
row was always in hand and was being discarded.

The **pre-registered acceptance was "≤1e-3 per token vs `onnx_parity.py`" and it FAILED at 8.6e-2.**
That number is kept here because the diagnosis matters more than the result: the ids agree on 13 of
14 strips, so the decode is fine — the gap is the **ORT-web vs ORT-Python int8 numerics difference
this project already documents** (the same effect that tips one strip's 69/31 near-tie). Feeding
both sides bit-identical `.pixels.bin` tensors buys identical *input*, not identical *logits*, so
≤1e-3 was never a property of our arithmetic; it was an untested assumption about two runtimes.

The check was re-aimed at what W8 actually depends on: **does the browser land on the same side of
the validated `min_logprob < -1.0` threshold as Python?** Measured over 576 token logprobs:
**0 tokens and 0 strips disagree**, and the raw runtime gap is reported rather than gated.

⚠ **Non-claim:** 0 of those 576 tokens came within 0.1 of −1.0 — the 14 gate strips are all
confident reads (every min above −0.15), so this fixture is too easy to test the boundary. The
threshold gets a real test at W3 on real-page strips, and that is owed.

Run it with `npm run check:logprobs` (reference: `.venv-ml/bin/python scripts/logprob_ref.py`).

### W2 — an image reaches the editor ✅ DONE (2026-08-02)

**The app now reads sheet music.** "Read strips" in the toolbar takes a page's `*_sNN_wNN.png`
crops, decodes them in the browser, stitches them and loads the score — playable, editable,
downloadable as note-model JSON. Verified in the real app, not just a harness
(`npm run smoke:app`): 16 crops → **344 notes / 28 measures**, sheet renders, playback starts,
the note model is a valid `schemaVersion: 1` doc, no uncaught page errors. ⚠ That was read from the
⬇ Save JSON download until 2026-08-30; the button is gone and the check reads `window.__omrDoc`.

New: `apps/web/src/omr/session.ts` (memoised model load — **sequential**, because three
`InferenceSession.create` calls in flight means three sets of weights live at once and memory, not
bandwidth, is the phone failure mode) and `apps/web/src/omr/pipeline.ts` (`decodeStripsToDoc`,
`positionFromName`). Strips are ordered by their filename's `_sNN_wNN` suffix, not by pick order —
a file input's order is the OS's, and the stitcher builds the music from `system`/`window`.

**Robustness** (`npm run check:edge`): a blank white strip, a solid black strip, an 8×8 image and a
wrong-orientation portrait all decode to 4 ids / 0 events without throwing, so the app's "the model
read nothing from these images" message fires instead of a crash. ⚠ Note for W8: those garbage
crops score **min_logprob ≈ −0.84**, i.e. *above* the −1.0 flag — the confidence threshold does not
catch an empty crop, the event count does.

**Latency: ~1.1 s/strip** uncontended (~1.5 s/strip while another job was running), so a 20-strip
page is 20–30 s. Python int8 is ~353 ms/strip. That is slow but tolerable behind a progress line,
and it means **W7 does not need a Web Worker** to be usable.

### The arm-B ceiling, and a hypothesis that died

`npm run parity:armb` decodes **Python's own crops** in the browser and diffs against Python's
decode caches. Whatever agreement that produces is the best any slicer could do, so it is the bar
W6 holds the ported slicer to — "within 1 pp of the ceiling", never "100%".

**Ceiling over 20 pages / 450 strips: 86.0% of strips decode identically; 8/20 pages produce a
byte-identical score.**

**First, a measurement bug worth remembering.** The first run said **10%**, while two of three
pages produced identical scores — an impossible pair. The cause: `decode_page.py` stores raw HF
`decode()` output, which glues added tokens (`\sig\komaFlatb \bakiyeFlate`), while the browser's
`detokenize` emits them spaced (`\sig \komaFlat b \bakiyeFlat e`). Both pass through the stitcher's
`normalizeTokens` before becoming music, so comparing before it measures *serialization*, not
reading. Normalizing first: **10% → 96.7%** on that sample.

**Then the hypothesis died.** The plan pre-registered "if arm B lands below ~90%, the resampler gap
dominates — spend a day matching PIL's BILINEAR before porting the slicer." Arm B came in at 86%, so
that rule fired. It should not have, because the causal model behind it is wrong:

| split | strips | agree |
|---|---|---|
| Python flagged it (`min_logprob < -1.0`) | 32 | **21.9%** |
| Python was confident (`≥ -1.0`) | 418 | **90.9%** |

Crop width — the thing that decides how hard a strip is downscaled, and therefore how much a
resampler difference could bite — shows **no trend at all**: 89.3% in the narrowest decile against
83.9% in the widest, with 75% and 92.9% deciles in between. Token count is equally flat.
Disagreement is **model uncertainty**, not resampling: near-ties that either ORT build can tip, the
same mechanism as the gate's 27/28 and its measured 69/31 coin-flip. **So the resampler work is not
done, and `preprocess.ts` stays as it is.** Measure before touching, as
[../METRICS-SLICER.md](METRICS-SLICER.md) says at the top.

**A side benefit: this is the first real-data evidence that the `-1.0` threshold means something.**
W1 had to record a non-claim — the 14 gate strips were all too confident to test the boundary. Here
32 strips fall below it and they behave completely differently from the other 418 (21.9% vs 90.9%
agreement). The threshold separates exactly the strips where two runtimes disagree, which is a good
sign for W8's highlighting.

⚠ **The open question this does NOT answer, and it is the one that matters for a release:
is the browser *worse*, or just *different*?** Agreement with Python cannot tell them apart. On the
63 disagreeing strips the browser tends to read slightly *fewer* tokens (31 of 63 are −1 or −2 ids),
which is suggestive but not evidence. The decisive test is scoring browser decodes against
**hand-verified gold** — `_realval_v2`'s 267 strips — and comparing to Python's score on the same
strips. **Owed at W3**, and it is what says whether a friend gets the quality the project's metrics
claim.

### W3 — the browser is not worse than Python ✅ DONE (2026-08-03)

**The release-gating question is settled.** Arm-B agreement said the two decoders differ on ~14% of
strips; agreement cannot say *which one is right*, and if the browser read meaningfully worse then
friends would get worse results than every number in [../METRICS.md](METRICS.md) claims.

Both sides were scored against the **same 261 hand-verified `_realval_v2` strips** with the **same
scorer** (`eval_omr.align`, the project's Levenshtein id-space alignment), on the identical strips:

| metric | Python | Browser | Δ |
|---|---|---|---|
| SER (lower better) | 0.0821 | **0.0818** | −0.0003 |
| exact-match | 60.2% | **60.2%** | 0.0 |
| AEU macro recall | 94.8% | **94.9%** | +0.1 pp |
| AEU micro recall | 92.5% | **92.5%** | 0.0 |

Per class the two are within a point everywhere, and the two largest moves cancel
(`\bakiyeSharp` −0.8 pp, `\komaFlat` +1.5 pp). **Verdict: the ~14% disagreement is two ORT builds
splitting near-ties, at no cost in quality.** Reproduce with `npm run decode:pool -- --pool
data/real/rung3/_realval_v2 --out b.json` then
`.venv-ml/bin/python scripts/score_browser_gold.py --browser b.json`.

⚠ **Scope of the claim:** this is real-val, which orders candidates and does not predict exam
performance (a 28 pp gap is on record). It is a *paired* comparison on identical strips, so the
**Δ** is what it establishes — not the absolute level.

#### The 40-page ceiling sample was dropped, deliberately

The plan pre-registered widening the arm-B ceiling from 20 pages to 40. Two reasons not to:

1. **Its purpose changed.** The ceiling existed to answer "is a slicer difference real or is it the
   resampler". Now that gold shows agreement is not a quality proxy, the ceiling is only a
   reference level for W6, not a quality bar.
2. **The stated ±1 pp bar is not resolvable at any sample size we would run.** At 86% with n=450 the
   standard error is ~1.6 pp; 40 pages would only reach ~1.2 pp. **W6 should use a PAIRED test
   instead** — arm A and arm B decode the *same* strips, so compare per-strip agreement pairwise
   (a McNemar-style count of strips where exactly one arm matches Python). That is far more
   sensitive than differencing two independent proportions, and it needs no extra pages.

#### Confidence: real signal, but it does NOT meet the pre-registered bar

Measured against gold, `min_logprob` genuinely separates good strips from bad — flagged strips
average **8.60 token edits against 2.69** for the rest. But as an *error locator* it is weak:

| flag if min < | % strips flagged | % of all edits caught | lift |
|---|---|---|---|
| −1.0 | 3.8% | 11.3% | 3.0× |
| −0.7 | 9.2% | 26.3% | 2.9× |
| **−0.5** | **22.6%** | **57.1%** | 2.5× |
| −0.3 | 33.0% | 64.2% | 1.9× |

**The pre-registered rule — flag 10%, catch ≥60% of errors ([../STATUS.md](STATUS.md)) — is NOT
met.** The best achievable at a 10% budget is **26.3%**. There is a usable operating point at −0.5
("check about one strip in five, see over half the errors"), but that is a soft hint, not the
promise the rule describes.

**This lands before W8 is built rather than during it, which is the point of measuring first.** W8
now has a real decision to make: ship the −0.5 cut as a hint, invest in per-TOKEN localisation
(logprobs already exist; the cost is threading token identity through the stitcher), or drop the
feature. ⚠ Note also that the −1.0 line was validated as a **bad-crop proxy for the labelling
queue**, a different job from locating a user's errors — and W2 found it does not even fire on a
blank crop (those score ≈ −0.84).


## MVP rungs — what each one established

*Was `docs/archive/phases.md` (last updated 2026-08-07).*

Split out of [README.md](phases/README.md) on 2026-08-04 when that file crossed the 400-line cap. The split
is by genre: README keeps the **plan** (why the track exists, the ladder, the files, the gates),
this file keeps the **results**. Rung state lives in README's table and links here.

Numbers: [../METRICS.md](METRICS.md), [../METRICS-SLICER.md](METRICS-SLICER.md),
[../METRICS-SLICER-PORT.md](METRICS-SLICER.md). Current state for the whole project is
NOT here: see [../STATUS.md](STATUS.md).

⚠ **W0–W3 moved to [phases.md § W0–W3 — opencv.js parity, the decode module, and the…](#w0w3--opencvjs-parity-the-decode-module-and-the-browser-vs-python-verdict)** on 2026-08-07, at the same 400-line cap:
opencv.js primitive parity, the extracted decode module, an image reaching the editor, the arm-B
ceiling and the browser-vs-Python verdict.

### W4 — staves + row normalization ✅ DONE (2026-08-04)

**The port reproduces Python's stage 1 exactly, over the whole corpus** — 1,781 pages / 12,123
systems, not a sample. Staff count **1,704/1,704**, manifest-zero pages **77/77**, `scale`
**12,122/12,122**; normalized row width and the outer-lines+spacing triple both **12,123/12,123**.
Numbers: [../METRICS-SLICER-PORT.md](METRICS-SLICER.md).

**Everything that differs anywhere is the ±1 grayscale residue, and none of it reaches a crop.**
Seven systems differ by 1 px — six an *interior* staff line's cluster centre, one an `x0` — and
`normalize_row` reads only the outer lines and the median spacing, which are identical on all
12,123. This is the first time the residue W0 predicted has been observed reaching any output.

⚠ **Two scope notes on the corpus run.** It used `--inject-skew`, so its deskew-angle column is
trivially true; the estimator's real number is **132/132** from the un-injected 132-page run. And
the "zero-staff pages yield zero staves" bar was **restated against the control**: those pages are
identified by an empty manifest, local Python now finds a staff on 1 of the 77, and the port finds
the same one — the original wording failed a port that agreed with Python exactly.

#### Two things the plan had wrong, both found by measuring

**1. `prepPage` could not be the planned no-op.** [phases.md § Porting the slicer to TypeScript — W4–W6](#porting-the-slicer-to-typescript--w4w6) recorded that the
whole camera path is inert on clean input. True of the perspective crop (**0%** of pages take one),
false of the deskew: **15.3% (272/1,781) take a real rotation**. Skipping it took one page from 10
staves to **0**, and 22 of the 23 pages failing the first parity run were exactly the 23 deskewed
ones. `estimate_skew`/`deskew` are now ported in full, guards and all, so an axis-aligned
screenshot still passes through untouched. ⚠ **It costs ~35 s of the ~36 s a page takes in the
browser** (41 rotations, each with a page-wide `MORPH_OPEN`) against ~1.9 s for Python's whole stage
1 — a **W7** problem, since a screenshot pays the full sweep to learn it has no skew.

**2. The manifests on disk cannot be the acceptance bar.** Scored against them the port read
**86.7%**, and one page it failed matched local Python line for line (7 staves against the
manifest's 5). The current `page_to_strips.py` reproduces only **1,680/1,704 (98.59%)** of those manifests —
below W4's own bar — because 1,578 of the 1,781 page dirs were sliced on Colab. `scripts/slicer_ref.py`
now builds a local-Python reference that is both the control and the sample definition; the port
reaches the manifest ceiling exactly, 1,680/1,704 on the same pages as Python. **Same lesson W3 already
recorded about arm-B agreement: agreement with an artifact is not correctness.**

### W5 — barlines ✅ DONE (2026-08-04)

**The riskiest file in the slicer reproduces Python over the whole corpus** — 1,781 pages / 12,123
rows / 51,019 bars. Bar **count** exact on **12,121/12,123 rows (99.98%)**, positions within 1 px on
**51,018/51,019 (100.00%)** and exact on **51,013/51,019 (99.99%)**. Numbers:
[../METRICS-SLICER-PORT.md](METRICS-SLICER.md).

**It passed on the first run, and the reason is the trap list.** The three hazards
[phases.md § Porting the slicer to TypeScript — W4–W6](#porting-the-slicer-to-typescript--w4w6) named the expensive way — `_is_thin_stroke`'s staff-row `continue`
that does *not* reset the run, `_terminal_overshoot`'s four-variable walk, and the per-ROW
`binarize_ink` calls that must not be hoisted — were transliterated as written rather than
rediscovered. **Trap 1 was confirmed empirically rather than trusted:** `30 * 0.35` and `30 * 0.75`
really are exactly 10.5 and 22.5 in IEEE doubles, so `Math.round` would have returned 11 and 22.5→23
where Python returns 10 and 22, silently retuning gates 1 and 2. `pyRound` returns Python's values.

**Every difference was diagnosed, not tolerated.** All 8 differing rows are the ±1 grayscale
residue: feeding Python its own *other* grayscale path makes Python emit the port's exact bar list
**and reject list**. The 2 rows whose bar count differs are `_terminal_overshoot` near-ties that
flip **one in each direction** — a genuine port bug in that walk would flip one way across many
rows. The single 2 px difference is W4's already-recorded `x0` residue multiplied through
`int(staff.x0 * scale)` at scale 2.0.

**A free extra check earned its keep.** Recording `detect_barlines`' *rejected* candidates costs
nothing (the gates run either way) and is stricter than the bar list: it found **9 further rows that
produce identical bars while disagreeing about what was thrown out**, including one column rejected
as `gate2_fat` by Python and `gate3_blob` by the port. Rejected either way, so the bar list can
never see it — but it means two independent gates sit near their thresholds on that column.

⚠ **Two non-claims.** The corpus run used `--inject-skew`, so it validates everything downstream of
the deskew estimator and not the estimator (unchanged from W4). And `hasNotehead` is ported but
**not exercised by anything W5 measures** — its only caller is `window_measures`, so W6 owns it.

### W6 — windowing, the driver, and the decode verdict ✅ DONE (2026-08-04)

**The slicer port is finished, and the browser cuts the same strips Python does.** Over the whole
corpus — 1,781 pages / 33,805 strips — the window fields are exact on **33,783/33,783** strips,
strip count per page on **1,697/1,697**, and `row_x0`/`row_x1` within 2 px on **99.99%**, with the
width and measure invariants at Python's own **0** violations. Numbers:
[../METRICS-SLICER-PORT.md](METRICS-SLICER.md).

**The decode arm is the verdict that matters, and it is paired.** `npm run parity:arma` slices
20 pages with the port, decodes those crops, decodes Python's crops for the same pages, and compares
on the same (system, window):

| arm | agrees with Python |
|---|---|
| **A — the port's crops** | **395/450 (87.78%)** |
| B — Python's crops (the ceiling) | 387/450 (86.00%) |

**12 A-only against 4 B-only discordant pairs, McNemar exact p = 0.077 — no detectable difference**,
and **0 strips unmatched** in either direction. All 16 discordant strips have identical crop widths,
so the disagreement is the near-tie coin flip W3 characterised, not the cutting. ⚠ Read it as a
difference, not a level; agreement is not quality.

#### Three things worth carrying forward

1. **The bar was restated, on purpose.** "Window fields exact" was written as 100% before the ±1
   grayscale residue was understood. Windows are computed *from* the bars, and the 2 rows where W5
   already records a bar-count difference account for **all 6** raw mismatches — so the gate now
   scores rows whose bars agree and prints the raw number beside it. Same shape as W4's restated
   zero-staff bar. Detail in [../METRICS-SLICER-PORT.md](METRICS-SLICER.md).
2. **`hasNotehead` is exercised at last** — 861 clef-prefix trims, identical on both sides. That
   discharges W5's explicit non-claim.
3. **The Python control now runs the REAL driver.** `slicer_ref.py` calls `page_to_strips` into a
   temp dir instead of re-implementing its pad/trim block, because the port is transliterated from
   those same 40 lines and a second hand-written copy could encode one misreading twice and then
   agree with itself. It costs a second stage-1 pass (~4.2 s/page, ~2 h for the corpus).

⚠ **The W0 cv-probe was NOT deleted**, though this rung was where the plan retired it. It is the
only check that would catch an opencv.js version bump changing a primitive under the port, and it
costs one command.


### W7 — upload a page in the app ✅ DONE (2026-08-05)

**The app reads a page.** One image into the "Read page" input and a playable, editable score comes
out — slice, decode, stitch, render, play, save, all in the browser. That is the whole product path
with nothing stubbed, and it is the first rung a friend could be handed.

Acceptance is `npm run smoke:page`, which drives the real app with Playwright:

| check | result |
|---|---|
| page read end to end | 7 staves → **16 strips → 344 notes, 28 measures** |
| strip count matches local Python | **16 vs 16** |
| tab stayed responsive while slicing | slowest reply **2,353 ms** (bar: < 5,000) |
| progress actually moved | 57 distinct status lines |
| sheet renders / play enabled / playback started / no page errors | all ✓ |
| slice / decode | **36.4 s** + **19.1 s** (16 strips ≈ 1.2 s each) |

**A free confirmation nobody asked for:** W2's smoke reads *Python's* crops of this same page and
gets **344 notes / 28 measures** too. The ported slicer's crops produce the identical score here.
n=1 — the evidence that carries weight is still W6's paired McNemar — but it is the first time the
two cutters have been compared through the whole product path rather than at the token level.

#### The 35-second freeze was the real work

The port cost ~36 s/page and **all of it ran as one synchronous block**. A tab that cannot answer
JavaScript for 35 s is not shippable: no progress paints, and the browser offers to kill the page.

The fix is not an optimisation and deliberately changes no arithmetic. `estimate_skew` is now a
**generator** that yields after each of its 41 rotations, with two drivers over it — `estimateSkew`
runs it to completion (what the parity harness measures), `estimateSkewAsync` steps it and hands
the event loop back between rotations. One search, two drivers. An async *copy* of that code was
the obvious alternative and is exactly the duplication CLAUDE.md warns about: the two would drift
the first time a gate is retuned.

`deskew`'s two guards were split into `guardedAngle` for the same reason, so the app — which
estimates first and slices second — reaches the same decision as the one-shot path rather than
re-deriving it.

**Verified, not assumed:** the parity harness re-run with the REAL estimator (no `--inject-skew`)
on 20 pages, 4 of which genuinely rotate — **deskew angle identical 20/20**, and W4/W5/W6 all still
PASS with bars, positions and strip spans exact. The refactor moves nothing.

What remains blocking is one **2.35 s** stretch: ink → connected components → staves → rows →
barlines → windows, which is a single synchronous call by design. It is under the bar and splitting
it would mean threading yields through the transliteration, which is not worth it.

#### Two bugs the harness found, both in the harness or the wiring

1. **Vite's dep optimizer ate the first upload.** opencv.js reaches `App.tsx` only through the lazy
   `import("./omr/page")`, so Vite's static scan never sees it; it is discovered at the first upload
   instead, which triggers a re-optimize and a **full page reload mid-slice** — throwing the upload
   away and leaving the app waiting on a slice that no longer exists. It presents as a hang at 0%
   CPU, which is why it was not obviously a bug. `optimizeDeps.include: ["@techstark/opencv-js"]`
   makes it a startup cost. Dev-server only; a production build has no dep optimizer. The fix was
   re-verified against a **cold** `.vite` cache, not a warm one.
2. **The strip-count bar was pointed at the wrong reference.** It first scored against the page
   dir's `_manifest.json` and would have failed W7 for a W4 reason — local Python reproduces only
   ~98.6% of those manifests. It now scores against `scripts/slicer_ref.py`, with the manifest count
   printed beside it as context. Third time this project has had to relearn that agreement with an
   artifact is not correctness.

#### Still owed at W7, and named

⚠ **The latency is not fixed, only made bearable.** A straight screenshot still pays all 41
rotations to learn it has no skew. Both candidate fixes — an early exit at 0°, or replacing the
estimator with a standard one (Hough / Radon / FFT of the row projection) — are behaviour changes
that need their own measurement against the 132-page estimator sample and the 15.3% of pages that
genuinely rotate. Not folded into this rung.


## Porting the slicer to TypeScript — W4–W6

*Was `docs/archive/phases.md` (last updated 2026-08-04).*

> Track index and current rung state: [phases.md § MVP track — the in-browser pipeline, and a release to friends (CLOSED)](#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed). Project state: [../STATUS.md](../STATUS.md).
> What the slicer does and why: [CODE_TOUR.md § Inference pipeline — from a full uploaded image to editable notes](../CODE_TOUR.md#inference-pipeline--from-a-full-uploaded-image-to-editable-notes) §1 and
> [../METRICS-SLICER.md](../METRICS-SLICER.md).

⚠ **Do not patch `page_to_strips.py` from reading it, and do not "improve" it while porting.** Two
fixes written that way were reverted on 2026-07-28, and the 2026-07-29 windowing retune overturned
its own premise once measured. This is a **transliteration**. Behaviour changes are a separate
decision with their own measurement.

### What is being ported

Screenshots and clean scans only (owner decision, [../DECISIONS.md](../DECISIONS.md)). The chain:

```
load_gray → prep_page → binarize_ink → connectedComponents → detect_staves
  per staff: normalize_row → detect_barlines → window_measures → pad/trim/crop
```

⚠ **`prepPage.ts` is NOT a full no-op, and the version of this page that said it was cost a day.**
The claim was that every step of the camera path is inert on clean input. Measured against the
corpus at W4, that is true of the perspective crop (**0%** of pages take one) and false of the
deskew (**15.3%**, 272 of 1,781, take a real rotation). Skipping the rotation took one page from 10
staves to **0**, and 22 of the 23 pages that failed the first parity run were exactly the 23
deskewed ones. So:

- **`estimate_skew` + `deskew` are ported in full.** Both guards (0.3° deadband, "must buy ≥3 more
  staff-line rows") survive, so an axis-aligned screenshot still passes through untouched.
- **`detect_page_quad` + `crop_to_page` are still the seam.** They slot into `prepPage` later and
  nothing else in the port changes.

⚠ **The deskew costs ~35 s of the ~36 s a page takes in the browser** — 41 rotations, each with a
page-wide `MORPH_OPEN`. That is a **W7** problem (a screenshot pays the whole sweep to learn it has
no skew), not a W4 one, and it is why the parity harness has `--inject-skew`. Do not "fix" it inside
the port: a faster estimator is a behaviour change and needs its own measurement.

**Not ported** — confirm each in review, they are training bookkeeping with no effect on pixels:
`window_signature` (L749), `window_cache_ok` (L756), `budget_risk`,
`meas_from`/`meas_to`/`row_measures` (the stitcher reads only `system`/`window`/`tokens`), the
`--debug` overlay branch, and every filesystem write.

⚠ **`budget` mode CAME BACK, and this section used to say it never would** (2026-08-22). It was
dropped as a measured wash — but the wash was measured for **labelling yield**, and at INFERENCE the
trade inverts: an over-budget strip cannot be dropped, so it returns a short, confident, wrong read
([../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md)). `row_cost_features` (L706),
`estimate_tokens` (L737), `est_tokens` and `window_measures`' `cost()` threading are therefore all
ported now, behind the opt-in `tokenBudget` parameter that only `?dense=` sets. **In legacy mode the
features are never computed**, so a normal visit pays nothing and `est_tokens` is `null` rather than
a number nobody measured.

**It has its own acceptance run, on the same instrument as the shipped rule.** `slicer_ref.py
--token-budget N` makes the reference define the *packing rule* as well as the sample, and
`slicer-parity.ts` refuses a reference that mixes the two — scoring the shipped rule against a
budget-mode control would report a port failure for a configuration difference, which is the same
mistake as scoring against a stale manifest. The budget run adds one check the legacy run cannot
have: **`est_tokens` agreement**, the quantity the rail thresholds on. A port that cuts in the same
places while computing a different cost is a coincidence waiting to break on the next page.

⚠ **Its bar is half a stem (0.94 ids), not exact, and that number is the argument.**
`estimate_tokens` is `1.889 x stems + 0.0288 x inked_columns`, and the two terms fail differently: a
stem is the longest unbroken vertical run over ~2 staff spaces, which the browser's ±1 grayscale
difference cannot create or destroy, while an inked *column* is one pixel's worth of ink and flips
freely at the Otsu threshold. So a difference under half a stem proves the stem counts are identical
and the rest is the same residue the row pixel-sum drift line has always reported as never zero.
Exact agreement is reported beside it, ungated — the shape `bar x exact` already has next to
`bar x within 1 px`. Result: [../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md).

### File layout

| File | Holds |
|---|---|
| `apps/web/src/omr/slicer/cvOps.ts` | **the only file importing opencv.js**: `decodeGray`, `binarizeInk`, `openHorizontal`, `connectedComponents`, `resizeArea`/`resizeScale`, `copyMakeBorderTB`, `rotate`, `subRows` |
| `apps/web/src/omr/slicer/constants.ts` | every constant from `page_to_strips.py` L32–97 + `STAFF_HOR_FRAC` (L308), each with its Python line number, plus `pyRound()` |
| `apps/web/src/omr/slicer/prepPage.ts` | `qualifyingLineRows` L223, `estimateSkew` L237, `deskew` L266, `prepPage` L280 — plus the crop seam |
| `apps/web/src/omr/slicer/staves.ts` | `detectStaves` L310, `clusterRows` L341, `emitStaff` L355 |
| `apps/web/src/omr/slicer/rows.ts` | `rowMusicExtent` L400, `placeBand` L423, `normalizeRow` L446 |
| `apps/web/src/omr/slicer/barlines.ts` | `longestVerticalRun` L474, `isThinStroke` L485, `clusterCols` L521, `terminalOvershoot` L544, `detectBarlines` L592, `hasNotehead` L679 |
| `apps/web/src/omr/slicer/windows.ts` | `spanCap` L776, `splitWide` L786, `windowMeasures` L867 |
| `apps/web/src/omr/slicer/slicer.ts` | the driver (L961–1011, minus filesystem and debug); `sliceStage1` is the W4 half |
| `apps/web/src/checks/slicerHarness.ts` + `apps/web/slicer-harness.html` | headless entry the parity tool drives; returns geometry only, never pixels |
| `scripts/slicer_ref.py` | the Python control arm; also defines the sample |
| `tools/vision/parity/slicer-parity.ts` | `npm run parity:slicer` |

### Trap 1 — `Math.round` is not Python's `round`. Verified, twice, in load-bearing places.

Python rounds half-to-even; JavaScript rounds half-up. Two barline-discrimination parameters land
**exactly** on `.5`:

```
int(round(30 * 0.35))  →  Python 10,  Math.round 11    # `tol`,   detect_barlines gate-1 slack
int(round(30 * 0.75))  →  Python 22,  Math.round 23    # `fat_w`, detect_barlines gate-2 width
```

A naive port silently retunes both gates and every downstream measure boundary with them.
**Use `pyRound()` at every `round()` site, no exceptions** — including `_emit_staff`'s
`tol = max(2, int(round(sp * 0.2)))` and `normalize_row`'s `band_top`/`band_bot`/`top_line_y`,
which take arbitrary floats and can land on `.5` for some staff spacings.

### Trap 2 — grayscale can never be exact, and that is fine

`cv2.imread(IMREAD_GRAYSCALE)` converts inside the PNG decoder; a browser only ever sees RGBA and
converts afterwards. OpenCV's own two paths already differ by ±1 on 7.4% of a colour page's pixels,
and 18% of corpus pages are truly colour. **Settled by measurement, not tolerance:** re-running the
whole slicer under that perturbation left all 119 strips across the 6 most colour-shifted pages
bit-identical. Numbers in [../METRICS-SLICER.md](../METRICS-SLICER.md). Decode with
`createImageBitmap(blob, {colorSpaceConversion: "none", premultiplyAlpha: "none"})`.

opencv.js itself is **exact** against OpenCV-Python on the five primitives when fed identical bytes
(W0, both sides OpenCV 5.0.0) — so any divergence you find is the port, not the library.

### Trap 3 — named hazards, per function

Transliterate line by line; do not restructure into something cleaner.

- **`_is_thin_stroke` L505-507** — a staff row `continue`s **without resetting `run`**. The
  "skip but don't reset" semantics is easy to get subtly wrong and silently changes what counts as a
  barline.
- **`_terminal_overshoot`'s inner walk L560-585** — four state variables with four different reset
  rules: `ov` updates only on inked rows, `run` resets on a blank row, `gap_rows > 1` breaks, and
  `is_wide` latches once set. The fiddliest 46 lines in the file, and it is what separates a barline
  from a G-clef.
- **`binarize_ink(row)` re-thresholds the ROW, not the page**, at three separate call sites
  (`detect_barlines` L622, `_has_notehead` L692, `_split_wide` L813). Do **not** hoist them into one
  Otsu — they run on different sub-images.
- **`_emit_staff` L370-395** reads the **raw** ink for the x-extent, not the opened image. The
  comment explains why: on a slightly skewed scan the opened image loses a line's ends and pushes
  `x0` 70–490 px right, cutting the clef or whole measures.
- **`is_bar = longest >= span * 0.85`** compares a float against an int run length. Keep it a float
  compare.
- **`_split_wide`** — `sorted(set(cuts))` (L836) can collapse two targets onto one gutter and yield
  fewer pieces than `n`; the escalation loop (L843-846) depends on that. Python's `min(near)`
  compares tuples, so JS needs an explicit two-key comparator. L818-822 uses the loop variable
  **after** the loop — Python leaks it, JS will not, so keep an explicit `lastX`.
- **`normalize_row`'s `cv2.resize(crop, (new_w, STRIP_H))`** is a non-uniform resize. Keep it one
  call; do not decompose into two.
- **`VPLACE_ADAPTIVE` is ON by default** and changes the crops. It needs the whole-page
  `connectedComponents` label map plus `row_music_extent`'s label-set membership test. Turning it
  off would re-introduce the measured 11.6% beam clipping.

### The control is LOCAL PYTHON, not the manifests on disk

⚠ **Read this before writing any acceptance check.** The manifests in `data/real/strips_v2` look
like ground truth and are not: **the current `page_to_strips.py` reproduces only 118 of 120 of
them**, because 1,578 of the 1,781 page dirs were sliced on Colab and the artifact has drifted from
the code. That is already below W4's own 99.5% bar, so a port scored against manifests can fail
while being perfect. It happened: the first W4 run read 86.7%, and one of the pages it failed
(`gozumden_gonlumden_hayali_gitmez_nota_p1`) matched local Python line for line, 7 staves against
the manifest's 5.

So the flow is:

```bash
.venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out ref.json   # the control, ~1.9 s/page
npx tsx tools/vision/parity/slicer-parity.ts --ref ref.json            # ~36 s/page
```

`ref.json` also **defines the sample** — the browser side runs exactly the pages in it, so the two
sides cannot drift apart on which pages they ran. Manifest agreement is still printed, as the
weaker second reference and as the ceiling any port could reach against it.

`--inject-skew` feeds Python's angle in and skips the 41-rotation sweep (~35 of the 36 s), which is
what makes a full-corpus run affordable; the estimator itself is then only covered by runs without
the flag. Same principle as W3: **agreement with an artifact is not correctness.**

### Acceptance, per rung

The corpus: `data/real/strips_v2` — **1,781 page dirs**, each with a `_manifest.json` and a
`_debug.png`, and **1,704 with a `_decode.json`**. Accept a page only if its decode header matches
`checkpoint: round2-stage2-best`, `suffix: _int8`, `measures_per_strip: 3`, `window_mode: legacy`,
`edge_trim: true`, `vplace: true` — that selects the page set; the *values* come from
`slicer_ref.py`. The 77 pages with an empty manifest are the zero-staff pages and are scored
separately. **Exclude `data/real/strips/` entirely** — exam-frozen, cut by older code.

The `_debug.png` overlays are already on disk and colour-code rejected barline candidates by reason
(`gate2_fat` orange, `gate3_clef` purple, `gate3_blob` yellow, `xrange` grey). That is a free
debugger for W5 — use it before theorising.

**W4 — staves + row normalization** ✅ **PASSED**; numbers in [METRICS-SLICER.md § Slicer port parity — does the TypeScript reproduce the Python?](../METRICS-SLICER.md#slicer-port-parity--does-the-typescript-reproduce-the-python)
Measured over the **whole corpus** (1,781 pages / 12,123 systems), not a sample:
- staff count exact on **≥99.5%** of eligible pages — got **1,704/1,704**
- the manifest-zero pages match Python — **77/77**. ⚠ The bar was written as "yield zero staves";
  Python now finds a staff on 1 of the 77 and the port finds the same one, so it is held against
  the control like every other check
- per-system `scale` within **0.002** — got **12,122/12,122**
- free extras: row width and outer-lines+median-spacing both **12,123/12,123**; the only differences
  anywhere are 7 systems off by 1 px (six an *interior* line, one an `x0`), none reaching a crop
- ⚠ the corpus run used `--inject-skew`, so the **estimator** is validated on 132 pages (132/132),
  not the corpus

**W5 — barlines** ✅ **PASSED**; numbers in [METRICS-SLICER.md § Slicer port parity — does the TypeScript reproduce the Python?](../METRICS-SLICER.md#slicer-port-parity--does-the-typescript-reproduce-the-python).
Measured over the **whole corpus** (1,781 pages / 12,123 rows / 51,019 bars), against **local
Python's** bar list — `slicer_ref.py` now records it (and the reject list) beside the staves. The
manifest's `row_bars` is the weaker second reference and sits at 96.61% for Python itself
- bar **count** per row exactly equal on **≥99.0%** of rows — got **12,121/12,123 (99.98%)**. A count
  difference shifts every downstream window and measure index, so it gets no tolerance
- among count-matching rows, per-bar `|Δx| ≤ 1 px` on **≥99.9%** — got **51,018/51,019 (100.00%)** —
  and `== 0` on **≥95%** — got **51,013/51,019 (99.99%)**
- free extra: **rejected candidates identical, reason for reason, on 12,112/12,123 rows (99.91%)**.
  Stricter than the bar list and worth keeping — it is the only check that can see two gates both
  sitting near their thresholds on the same column
- the hand-inspection step was replaced by something stronger: **every one of the 8 differing rows
  was reproduced inside Python** by feeding it its own other grayscale path, which returns the
  port's exact bar *and* reject list. Diagnosis beats eyeballing an overlay
- W4 handed W5 a **bit-identical normalized row** on all 12,123 systems, so every difference found
  is genuinely in `detect_barlines` and not inherited
- ⚠ `hasNotehead` is ported but **not exercised** — its only caller is `window_measures`. W6 covers it

**W6 — windowing, driver, and the parity verdict** ✅ **PASSED**; numbers in
[METRICS-SLICER.md § Slicer port parity — does the TypeScript reproduce the Python?](../METRICS-SLICER.md#slicer-port-parity--does-the-typescript-reproduce-the-python). Whole corpus, 1,781 pages / 33,805 strips:
- strip count per page exact on **≥99.5%** of pages — got **1,697/1,697 (100%)**
- `system`, `window`, `is_row_start`, `split_wide` exact — got **33,783/33,783 (100%)**;
  `row_x0`/`row_x1` within **2 px** on ≥99.9% — got **33,781/33,783 (99.99%)**
- the width/measure invariants hold at the same **0** violations Python currently has — got **0**
- free extras: **861 clef-prefix trims** identical, which is the first thing to exercise
  `hasNotehead` at all, and **10,246 `split_wide` fragments** identical
- ⚠ **the first three are scored on rows whose BAR LIST agrees**, with the raw number printed
  beside each. Windows are computed from the bars, so W5's 2 residue rows cannot yield identical
  windows — and they account for **all 6** raw field mismatches. Restating this was the same
  correction W4 had to make to its zero-staff bar: a criterion written before the ±1 grayscale
  residue was understood will fail a port that agrees with Python everywhere the residue does not
  reach. **When a bar is restated, print both numbers** — that is what keeps it honest
- ⚠ the corpus run used `--inject-skew` (0.4 s/page), so the estimator is still only validated on
  the 132-page un-injected run

**The decode arm (also W6)**: `npm run parity:arma -- --pages 20` — arm A **395/450 (87.78%)**
against arm B **387/450 (86.00%)**, 12 vs 4 discordant, **McNemar exact p = 0.077**, 0 strips
unmatched. See the note below on why this is paired rather than compared to 86.0%.

### W6's parity test: paired, not a level comparison

⚠ **Do not judge arm A against the 86.0% ceiling number.** That was the original plan and it does
not work: at n=450 the standard error is ~1.6 pp, so a "within 1 pp" bar is inside the noise, and
40 pages would only reach ~1.2 pp.

Arm A (the ported slicer's own crops) and arm B (Python's crops, `tools/vision/parity/arm-b.ts`)
decode the **same strips**, so compare them **pairwise**: count the strips where exactly one arm
matches Python's tokens. A McNemar-style test on those discordant pairs is far more sensitive than
differencing two independent proportions, and it needs no extra pages.

Remember what the ceiling is and is not. **Agreement is not quality** — W3 established that the
browser scores the same as Python against hand-verified gold (SER 0.0818 vs 0.0821), so a strip
where the two decoders differ is usually a near-tie, not an error. If arm A's crops look suspect,
the decisive test is the same one W3 used: score against gold with
`scripts/score_browser_gold.py`, not against Python's tokens.

**Result (2026-08-04):** 12 A-only against 4 B-only on 450 paired strips, p = 0.077 — no detectable
difference. The design paid for itself twice over: all 16 discordant strips have **identical crop
widths**, which is what rules the slicer out as the cause, and the level comparison the plan
originally asked for would have read "87.78% vs 86.00%" and said nothing at all.

### Commands

```bash
npm run probe:cv                      # opencv.js still matches OpenCV-Python
.venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out ref.json   # the control arm, ~4.2 s/page
npm run parity:slicer -- --ref ref.json [--inject-skew] [--dump d.json] [--page <stem>]
npm run parity:armb -- --pages 20     # the ceiling
npm run parity:arma -- --pages 20     # arm A vs arm B, paired (~80 s/page: real deskew + 2 decodes)
npm run decode:pool -- --pool <dir> --out b.json   # browser decode of a strip pool
.venv-ml/bin/python scripts/score_browser_gold.py --browser b.json
npm run typecheck && npm test && npm run gate:browser
```


## MVP track — the in-browser pipeline, and a release to friends (CLOSED)

*Was `docs/archive/phases.md` (last updated 2026-10-08).*

> ⛔ **CLOSED 2026-10-08 (owner), moved here from `docs/mvp/README.md`.** Every rung is done: W10's
> two friends used the app on 2026-08-11 and the owner made it public on 2026-09-05. **Everything
> below is as of its own date and is NOT current** — in particular the in-browser decode **fallback**
> (removed 2026-09-04: a configured server that does not answer now raises `server-unavailable`),
> `--max-instances 3` (10 since 2026-09-04), the gate's 27/28 (26/28 since 2026-10-08), the live
> model (`r4-ctl-stage2-last` since 2026-09-28) and "phones out of scope" (overturned 2026-09-19).
> The live app docs that came out of this track are in [../../app/README.md](../app/README.md#the-app--server-hosting-editor-makam-speed);
> current state is [../../STATUS.md](../STATUS.md).

> **Picking up W4–W6 (the slicer port)? Read [phases.md § Porting the slicer to TypeScript — W4–W6](#porting-the-slicer-to-typescript--w4w6) first** — it carries
> the function map, the acceptance thresholds and the traps that were found the expensive way.
>
> This track's **settled findings** — what the server, the build and the three shipped features
> established, and the traps inside them — are in [README.md § Standing findings — the product track, established and still true](../app/README.md#standing-findings--the-product-track-established-and-still-true).
> Post-beta feature ideas that are designed but not started: [../features/README.md](../features/README.md).
>
> Current state and next action for the WHOLE project are NOT here: see [../STATUS.md](../STATUS.md).
> Numbers: [../METRICS.md](../METRICS.md), [../METRICS-SLICER.md](../METRICS-SLICER.md) and
> [METRICS-SLICER.md § Slicer port parity — does the TypeScript reproduce the Python?](../METRICS-SLICER.md#slicer-port-parity--does-the-typescript-reproduce-the-python).
> Decisions: [../DECISIONS.md](../DECISIONS.md). Pipeline design: [CODE_TOUR.md § Inference pipeline — from a full uploaded image to editable notes](../CODE_TOUR.md#inference-pipeline--from-a-full-uploaded-image-to-editable-notes).

### Why this track exists

Two real-page rounds have shipped as "improvement, not pass". Round 3 targets pitch (40%) and
duration (28%) of user edits through a synthetic content-mix change — a real lever, but an unknown
one, and **nothing a friend would notice**. Meanwhile the product half of the goal set on
2026-07-27 (≥90% of pages ≤5 corrections, *and the app shows you where they are*) has never been
built at all.

So: **finish the pipeline and get it in front of people.** This track trains nothing.

#### Re-scoped 2026-08-05 (owner) — read this before planning W9 or W10

The original framing was "freeze the model, release, then train Round 3 against real feedback."
**The freeze and the wait are gone**; the rest stands.

| | |
|---|---|
| **Who** | Exactly **two friends**, to start |
| **What they are asked** | *"What features should I add?"* — **the interface, not the model** |
| **Round 3** | **Runs in parallel**, unpaused. It is not aimed by this feedback, so it does not wait for it |
| **The model in the friends build** | **Swaps to a better one as soon as one lands** — a server redeploy, no client download. ⚠ Cost: decode-quality comments cannot be attributed to a version. They are anecdotes; the exam still judges models |
| **How feedback returns** | **By talking to them.** No in-app button, no telemetry — at n=2 a conversation returns better information and costs nothing |
| **Phones** | ⚠ **OVERTURNED 2026-09-19** — the phone is the product's main screen and was rebuilt on 2026-09-26. This row said *"out of scope until the web app is done"*; it was written before anyone had looked at one. [../features/phone.md](../features/phone.md) |
| **Public launch** | A later rung, gated on **Round 3's exam result**. Good → open it up; not good → Round 4, and so on |

Full rows and reasoning: [../DECISIONS.md](../DECISIONS.md).

The gap turned out to be narrower than it looked. Decode, Donut preprocessing, detokenization,
stitching, the editor and playback all already existed in browser-safe form; the decode helpers in
`apps/web/src/omrGate.ts` were simply never exported, and `tools/render/stitch.ts` is confirmed
free of node imports. The only genuinely missing piece was the page→strips slicer
(`src/vision/page_to_strips.py`, 1,077 lines of numpy/OpenCV) — **ported and verified over the whole
corpus at W6 (2026-08-04)**, so the browser now runs page → staves → rows → barlines → windows →
crops — and **wired into the app at W7 (2026-08-05)**, so an uploaded page becomes a playable score.

### Scope decisions (owner, 2026-08-02)

| Decision | Why |
|---|---|
| Slicer ported with **opencv.js**, not hand-rolled | Parity over bundle size; 13 MB is noise beside 211 MB of weights. Validated at W0. |
| **Screenshots and clean scans only** | Real uploads are mostly web screenshots. Cuts the hardest third of the port. ⚠ The stated reason — "the photo front-end is a no-op on clean input" — held for the perspective crop and **failed for the deskew** (W4): 15.3% of corpus pages take a real rotation, so it is ported. |
| Weights on **Hugging Face Hub**, app on a COOP/COEP-capable static host | **STANDS 2026-08-05, with a correction.** It was briefly written up as superseded — "decode moves to a server, so the weights never reach the browser". Wrong: the client keeps an in-browser decode **fallback**, which needs both the weights and wasm threads. What changed is *when* — weights are fetched **lazily, only if the fallback fires**. [server.md § Deploying the app — the server, the host, and what the friends…](../app/server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for) |
| ~~**Confidence highlighting is in the MVP**~~ | ⛔ **DROPPED 2026-08-05** (owner). The logprobs were nearly free, as predicted — but the signal missed its pre-registered bar and the bar was not moved to fit it. [../DECISIONS.md](../DECISIONS.md) |

### The ladder

Each rung is independently pausable with its own acceptance check. W2 already gets an image to
the editor; the slicer does not block a demo.

```
W0 ─┐                                    opencv.js risk — first, it can force a re-plan
    ├─→ W4 → W5 → W6 ─┐
W1 → W2 → W3 ─────────┴─→ W7 ──────→ W9 → W10 ─────→ public
         (ceiling)          ⛔W8              (gated on Round 3)
```

| Rung | Goal | State |
|---|---|---|
| **W0** | opencv.js primitives match OpenCV-Python | ✅ **DONE 2026-08-02** — [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) |
| **W1** | Decode module extracted from `omrGate.ts`, logprobs added, gate still 27/28 | ✅ **DONE 2026-08-02** — [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) |
| **W2** | Strips → editor end to end (no slicer); produces the W3 control arm | ✅ **DONE 2026-08-02** — [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) |
| **W3** | Parity harness, the arm-B **ceiling**, and browser-vs-gold quality | ✅ **DONE 2026-08-03** — [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) |
| **W4** | Slicer: staves + row normalization | ✅ **DONE 2026-08-04** — [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) |
| **W5** | Slicer: barlines (the riskiest file) | ✅ **DONE 2026-08-04** — [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) |
| **W6** | Slicer: windowing + driver; **paired** parity vs arm B | ✅ **DONE 2026-08-04** — [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) |
| **W7** | Upload a page in the app | ✅ **DONE 2026-08-05** — [phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established) |
| **W8** | Confidence highlighting | ⛔ **DROPPED 2026-08-05** — the pre-registered bar was NOT met (best at a 10% budget is 26.3% against ≥60%) and the owner dropped it rather than moving the bar. Half of the 2026-07-27 goal stays unbuilt, stated out loud. Nothing deleted; may return if a friend asks. [../DECISIONS.md](../DECISIONS.md) |
| **W9** | **Server-side decode** + hosting — Cloud Run, Node + `onnxruntime-node` reusing `decode.ts`, in-browser fallback | ✅ **DEPLOYED 2026-08-06** — live at `omr-decode…europe-west3.run.app`, reads what the browser reads (93.8% ids, gold a paired wash), cold start 10.6 s, ~40 vCPU-s/page. ⚠ Slower than the owner's own browser, as predicted. Gold quality is a paired wash (McNemar p = 0.727). Safety checklist complete ($5 budget alert set, `--max-instances 3`). ✅ **Hosting DONE the same day** — app on Netlify at **<https://komavision.netlify.app>**, weights on the Hub (`Beyaban/omr-weights`), origin lock + 413 fix + `--cpu-boost` deployed. Cloudflare Pages was ruled out on its 25 MiB per-asset cap against our 25.58 MiB wasm. [phases.md § Putting the app online — step by step, in plain words](#putting-the-app-online--step-by-step-in-plain-words) · [server.md § Deploying the app — the server, the host, and what the friends…](../app/server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for) |
| **W9.5** | **Makam selection + performed intonation** (pipeline stage 9's makam half) — guess the makam from the decoded signature + karar, confirm it in a prompt, bend the SOUNDING komas to that makam's real intonation | ✅ **DONE 2026-08-07** — audibly correct on **204/213** bundled scores; sound only, the staff never moves. Not a planned rung: added before W10 alongside the style pass, because playing uşşak as AEU spells it is wrong in a way a friend WILL hear. [README.md § Makam selection — the performed intonation](../app/README.md#makam-selection--the-performed-intonation) |
| **W9.6** | **The style pass** — the harness becomes a product a friend can be shown | ✅ **DONE 2026-08-07** — KomaVision, Turkish, editorial; upload is the hero, developer controls fold into Gelişmiş. ⚠ The palette was **repainted İznik turquoise on 2026-08-08** (owner: the warm cream-and-terracotta original read as somebody else's website); tokens only, no layout moved. Presentation only. Also moved the deploy checks off the copy and onto `data-*` (`apps/web/src/ui/status.ts`), which is what made a Turkish UI possible at all. Built and green on both paths; **DEPLOYED 2026-08-08**, in one build with W9.5 and the editor |
| **W10** | Friends release — **two friends, interface feedback** | **READY 2026-08-08** — the redeploy is done, so the live site is what a friend would be sent. ⚠ Decide the cold-start fallback first ([../STATUS.md](../STATUS.md)): a friend's first upload after idle is read on their own laptop, which is the one thing the server was built to prevent |
| **W9.7** | **The editor rework** — drop the per-measure modal for direct editing on the staff | **STEPS 1–8 + 10 DONE** (2026-08-07 select/drag/delete/undo, 2026-08-08 the armed palette, its Çal-from-last-edited-bar, insert-on-empty-space with a ghost-notehead preview, the **tuplet tool**, the **off-meter bar mark**, and the **per-measure modal deleted** — out of order, at the owner's request, taking rests/lyrics/exact-koma/±2±3 with it). Rests and the numbered ±2/±3 koma signs were rebuilt into the palette the same day, so the deletion cost only lyric editing and exact koma/Hz entry. `Save JSON` (step 9) was dropped on 2026-08-15 and then REMOVED on 2026-08-30 at the owner's request, the check reading `window.__omrDoc` in its place. Owner 2026-08-07. Not cosmetic: the editor is the Rung-3 labeling loop's tool, so correction speed is labelling throughput. Does **not** gate W10 — it can land either side of the link. Brief: [editor.md](../app/editor.md); what each step built + the traps: [editor.md § The editor — what each step BUILT, and the traps it found](../app/editor.md#the-editor--what-each-step-built-and-the-traps-it-found) |
| **public** | Open it to everyone | ⭐ **HAPPENED 2026-09-05** — the owner posted the live link on LinkedIn. ⚠ It was written here as gated on Round 3's exam result and it went out anyway; that was the owner's call, and the live consequences (Cloud Run capacity with no fallback, the Round-2 model, the unlooked-at phone) are in [../STATUS.md](../STATUS.md) |

### What each rung established

The finished write-ups live in **[phases.md § MVP rungs — what each one established](#mvp-rungs--what-each-one-established)** — moved there on 2026-08-04 (this file crossed the
400-line cap). They carry what each rung measured, what passed, and — more useful — the
hypotheses that died: the resampler theory the arm-B ceiling killed, the confidence bar that was
NOT met, the `prepPage` no-op that was not a no-op, and the two acceptance criteria that had to
be restated because they were written before the ±1 grayscale residue was understood.

### What W0 built that is not throwaway

`tools/browser/run-page.ts` — runs any harness page in headless Chromium and asserts on it.
`omrGate.ts` has exposed `window.__gateResult` since it was written and it had **never been used**;
the gate was checked by opening a browser and looking. It is now `npm run gate:browser`.

One wrinkle worth knowing: the gate reports a single boolean, and that boolean has been `FAIL` ever
since the known ORT-web int8 `\tup3` wobble on one strip's reference path. A boolean cannot tell
"the known wobble" from "someone broke decoding", so the runner tallies the page's own ✓/✗ marks
instead and the script pins **`--expect 27/28`**. Measured baseline before any W1 refactor:
**27/28, with the canvas (product) path clean at 14/14**, sessions ready in ~3.0 s,
~0.9 s encoder + ~0.2 s decode per strip.

The W0 probe (`apps/web/cv-probe.html`, `apps/web/src/probe/cvProbe.ts`,
`scripts/cv_probe_ref.py`) was written as throwaway, to be deleted at W6. **It was kept**: it is the
only check that would catch an opencv.js version bump changing a primitive under the port, and it
costs one command ([../DECISIONS.md](../DECISIONS.md)).

### Files this track adds

| Path | What |
|---|---|
| `tools/browser/run-page.ts` | headless runner for any harness page (permanent) |
| `apps/web/cv-probe.html`, `apps/web/src/probe/cvProbe.ts` | W0 probe (kept, not deleted — see above) |
| `scripts/cv_probe_ref.py` | W0 Python reference (kept) |
| `apps/web/src/omr/` | decode, preprocess, session, pipeline, weights (W1, W2, W9) |
| `apps/web/logprob-check.html`, `apps/web/src/checks/logprobCheck.ts`, `scripts/logprob_ref.py` | W1 confidence-signal check (permanent — W8 depends on it) |
| `apps/web/strips-harness.html`, `apps/web/src/checks/stripsHarness.ts` | headless entry to the shipped decode path, driven by Playwright |
| `tools/vision/parity/arm-b.ts` | the ceiling measurement (W3) |
| `tools/vision/parity/decode-pool.ts` + `scripts/score_browser_gold.py` | browser vs Python **against gold** — the release-gating quality check |
| `tools/vision/parity/edge-cases.ts` | non-strip images must not throw |
| `tools/browser/app-smoke.ts` | the real app: strips in → playable score out |
| `apps/web/src/omr/slicer/` | the TS port of `page_to_strips.py` (W4–W6) |
| `apps/web/src/omr/page.ts` | page image → crops, the seam between the slicer and the decode path (W7) |
| `tools/browser/page-smoke.ts` | the real app: a page image in → playable score out, plus a responsiveness bar (W7) |
| `tools/browser/build-smoke.ts`, `live-smoke.ts` | the BUILT app (`dist/`, real headers, cross-origin weights) and the DEPLOYED site (W9) |
| `apps/web/slices.html`, `apps/web/src/slices/slicesView.ts` | slice inspector — see the crops a page is cut into, no model loaded (owner request, W7) |
| `tools/vision/parity/arm-a.ts` | the port's crops decoded and compared to arm B, **paired** (W6) |
| `apps/web/src/checks/slicerHarness.ts` + `apps/web/slicer-harness.html` | headless entry to the ported slicer |
| `scripts/slicer_ref.py` | the Python control arm for the port, and the sample definition |
| `tools/vision/parity/slicer-parity.ts` | slicer parity harness, `npm run parity:slicer` (W4–W6) |
| `tools/vision/parity/deskew-check.ts` | the exactness gate behind the 126× skew-sweep speedup (W7) |
| `apps/server/` | the decode server: `index.ts` (HTTP), `decodeBatch.ts` (imports the browser's `decode.ts`), `model.ts` (the only ORT-runtime-specific file), `limits.ts`, `png.ts`, `Dockerfile`, `cloudbuild.yaml` (W9) |
| `apps/web/src/omr/pixels.ts` | the client/server seam — the rescale, DOM-free, so the server needs no resampler (W9) |
| `apps/web/src/omr/remote.ts` | `decodeStripsRouted` — server first behind `VITE_DECODE_URL`, in-browser fallback on any failure (W9) |
| `apps/web/src/checks/serverParityHarness.ts` + `apps/web/server-parity.html` | the client half of the contract: the PNG it would upload AND what the browser read from it (W9) |
| `tools/vision/parity/server-parity.ts`, `server-bench.ts`, `server-limits.ts` | server vs browser, vCPU-seconds/payload, and the safety checklist as a command (W9) |
| `packages/core/src/makam.ts`, `makamSignatures.ts` (generated) | makam detection + the performed-intonation table (W9.5) — [README.md § Makam selection — the performed intonation](../app/README.md#makam-selection--the-performed-intonation) |
| `apps/web/src/MakamModal.tsx`, `tools/browser/makamPrompt.ts` | the post-decode makam prompt, and the smoke checks' dismissal of it (W9.5) |
| `apps/web/src/ui/` | the interface, split out of App.tsx (W9.6). **`status.ts` is the DOM contract the deploy checks assert on**; `strings.ts` is every user-visible word, in one file |
| `apps/web/src/styles/` | `tokens.css` (the design vocabulary), `base.css`, `app.css` (the `.kv-*` components) |

### Verification gates

| Gate | Command |
|---|---|
| Types | `npm run typecheck` |
| Stitcher round-trip | `npm test` |
| Browser ONNX gate, pinned | `npm run gate:browser` |
| opencv.js parity | `npm run probe:cv` |
| Confidence signal transfers | `npm run check:logprobs` |
| App: strips in → playable score out | `npm run smoke:app` |
| The editor really edits (select, drag, delete, undo, the palette, insert, rests, tuplets, the off-meter mark) | `npm run smoke:editor` |
| Makam signature vocabulary (core vs the label serializer) | `npm test` — 90/90 variants round-trip |
| The makam actually changes the SOUND (ears) | [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md) check 14 |
| App: a PAGE in → playable score out | `npm run smoke:page -- --ref ref.json` |
| Non-strip images don't throw | `npm run check:edge` |
| Arm-B ceiling | `npm run parity:armb -- --pages 20` |
| Arm A vs arm B, paired on the same strips | `npm run parity:arma -- --pages 20` |
| Slicer port vs local Python | `scripts/slicer_ref.py --pages 120 --out ref.json` then `npm run parity:slicer -- --ref ref.json` |
| Skew sweep's fast path is EXACT | `npm run check:deskew -- --pages 8` |
| Browser quality vs Python, against gold | `npm run decode:pool -- --pool data/real/rung3/_realval_v2 --out b.json` then `scripts/score_browser_gold.py --browser b.json` |
| Server matches the browser | `npm run dev:server` then `npm run parity:server -- --pages 6 --fixture f.json` (`--replay f.json` re-runs the server half with no browser) |
| Server quality vs gold | `npm run decode:pool -- --pool data/real/rung3/_realval_v2 --server http://localhost:8080 --out s.json` then `scripts/score_browser_gold.py --browser s.json --score-out data/checkpoints/server_gold_score.json` |
| Server cost per page, payload bytes | `npm run bench:server -- --fixture f.json` |
| The safety checklist | `npm run check:limits` |
| The app, through the server (and through the fallback) | `VITE_DECODE_URL=http://localhost:8080 npm run smoke:page` · point it at a dead port for the fallback |
| The BUILT app, against the real remotes | `npm run smoke:build -- --decode-url <service> --weights-url <hub>` — `--weights-url` swaps the local weights stand-in for the actual Hub, which sends a *reflected* CORS origin behind a 307, not the `*` the stand-in sends. ⚠ Costs a 211 MB download |
| **The DEPLOYED site** | `npm run smoke:live` (`-- --site https://…` for another deployment). **The only check that still exercises the shipped configuration**: a localhost preview is now refused by `ALLOWED_ORIGINS`, so `smoke:build` against the live server fails CORS by design |


## Backlog — closed items, archived

*Was `docs/archive/phases.md` (last updated 2026-10-08).*

> ⛔ **Archived 2026-10-08 from [../BACKLOG.md](../BACKLOG.md).** Item numbers are the ones BACKLOG.md
> used; BACKLOG.md keeps a one-line stub under each number so old references still land. Every
> "owed" / "next" below is as of its own date.

### Item 3 — the history behind the selector fix (2026-08-20 → 2026-09-06)

   ⚠ **Deferred, not ignored, for one reason: changing the selector mid-round makes the arms
   incomparable.** `r3-tupnew-stage2-best` was selected under the current blend, so every arm scored
   against it must be too. This lands **after** the staccato arm is read, and it is a Round-4 recipe
   change, not a Round-3 patch.

   ⭐ **CONFIRMED BY THE ROUND-3 FINAL RUN, 2026-09-01 — this is no longer a prediction.** Stage 2's
   two val curves moved in **opposite directions** for 1,500 steps: synthetic 0.0106 → 0.0117 while
   **real fell 0.0301 → 0.0182 (−39%)**, still falling at the last step. The blend weighted them
   4,763 : 390 (**92.4% synthetic**), so the selector followed the synthetic curve and stamped `best`
   at **step 500**, where real val was **0.0234 — 22% worse than `last`** at step 1750–2000. The
   round's own mitigation (bring `last` home too, and compare on `_realval_v2`) is what saves the run;
   without it the graded checkpoint would have been the worse one on real pages, silently.
   Raw curve: [../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md), log `docs/log/raw.md`.

   ⛔ **CONFIRMED A SECOND TIME, AND WORSE, BY RUN A (2026-09-01).** At 4,000 stage-2 steps the blend
   stamped `best` at **step 250** — the first evaluation — and no later mix ever beat it, while real
   val went on improving to **step 2,500**. ⭐ The `best-real` checkpoint added the same day is the
   only reason that 1.7-hour run produced a usable model: `best` is barely specialised and `last` is
   past the minimum. **Two runs, two wrong picks, the second by 2,250 steps.** The cheap fix is now
   shipped (a third checkpoint); the real fix — re-weighting the blend, or selecting on a free-running
   metric — is still owed and is still a recipe change, not a patch.
   ⚠ It does **not** invalidate any paired arm result — an arm and its control share the selector.

   ⛔ **A THIRD TIME ON RUN B (2026-09-02), AND THE WRONG PICK WAS `best-real` ITSELF.** The blend put
   `best` at step 3,250 this time — a different place again — but the run's real-page winner was
   `last` (step 5,000), which beats its own `best-real` (step 1,250) **645 edits to 694** on
   `_realval_v2`. ⚠ **Why `best-real` failed here is the part to keep**: Run B trains on two real
   pools, so `train.py` held out ~10% of each and its real-val set is **560 strips, 170 of them
   retired-crop** — the checkpoint meant to track real pages was 30% steered by pictures the shipped
   slicer does not produce. ⭐ So the cheap fix has a boundary: **`best-real` is only as good as the
   pool it reads**, and adding a real pool silently changes that pool. Three runs, three wrong picks,
   in three different places (steps 500, 250, and `best-real` at 1,250).
   [METRICS-EXAM.md](../METRICS-EXAM.md#metrics--round-3s-two-follow-up-runs-a-and-b).
   ✅ **BUILT 2026-09-06** — `train.py --select-dir` decodes a FIXED pool free-running at every eval
   and stamps `best-edits` on corrections, not loss; `--ema-decay` and `--label-smoothing` are in as
   off-by-default arms ([rung3/round4.md](../rung3/round4.md) step 2). ⚠ **Built, not measured**: no arm
   has trained with it, so "the selector now picks right" is a design claim, not a result.
   ⭐ The boundary this item kept hitting is now a hard guard — the selection pool may not share a
   piece with training, and the run REFUSES rather than warns. `_realval_v2` shares 40 of its 69
   pieces with `strips_b8`; all 40 are val-side at `--real-val-frac 0.10`, but 17 cross over at
   0.05.


### Item 4 — the b8 re-emit (done 2026-08-21)

4. ✅ **DONE 2026-08-21 — the re-emit RAN** (`data/real/rung3/strips_b8`, 3,955 accepted against
   2,330; result and carry table in [METRICS-CORPUS.md](../METRICS-CORPUS.md), queues in
   [rung3/labeling.md](../rung3/labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3)). ✅ **The `b8-audit` guard is READ —
   all 201 rows, 13.4% wrong** ([METRICS-CORPUS.md](../METRICS-CORPUS.md)). ⏭ **One thing is still owed
   before it is training data**: the **1,442 human `fix` labels** in the old pools
   must be carried across **by measure span, never by filename**. The problem statement
   below is kept because it is what the run was justified by — and because the *selector* half of it
   is untouched: the real val strips inside the blend are still the old pools' crops until the carry
   is done.
   **NEW 2026-08-20 — the real TRAINING pools are old-slicer crops, and so is the real half of the
   selector.** `strips_nota` / `strips_r1` / `strips_tup` were cut **11–17 July**; the slicer was
   overhauled **25 July** and fixed four more times on **29 July**. On a 5-page re-slice sample **0 of
   30 crops were identical**. So 2,330 training strips, and the 271 val-side strips inside the
   checkpoint selector, are crops the shipped slicer no longer produces
   ([METRICS-CORPUS.md](../METRICS-CORPUS.md)).
   ⚠ **This is the concrete half of B8** ([STATUS.md](../STATUS.md)), which frames re-emitting as a
   decision about *training* data; the selector consequence is the part that had not been stated.
   ⚠ Do the re-emit with its own `--out` and look at what moved first — it rewrites the manifests the
   promoted verdicts hang off. And note the priority: fixing these crops without touching the blend
   above improves **5.4%** of the number that picks `best`.
   ⭐ **UPGRADED 2026-08-21 — this is no longer a tidiness item, it is a train/test mismatch.** The
   exam was rebuilt on the current slicer and `_realval_v2` was already built on it, so **training is
   now the only pool still on retired crops**: the model would learn from crops the shipped slicer
   does not produce and be selected *and* graded on crops it does. Round 3's own Lever 1 measured crop
   geometry as **causal** (+59% edits when resolution falls), so this is a domain gap of exactly the
   kind the round is trying to close.
   ⭐ **And it is cheap, measured 2026-08-21: 2,064 of the 2,330 labels (89%) carry** onto the new
   crops by measure span (`strips_r1` 404/421, `strips_nota` 1,554/1,740, `strips_tup` 106/169 — the
   tuplet pool is the weak one at 63%). 248 are lost, 18 ambiguous. **No new labelling** — the same
   carry rule the exam rebuild used ([rung3/README.md](../rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3)).
   ⏭ **Sequence it BEFORE the final render**, not after: a render is the one moment the training set
   is rebuilt anyway.
   ⭐ **WHICH MODEL, settled 2026-08-21 (owner): `round2-stage2-best` does the WHOLE job** — a
   morning's split into "gate" and "hint" models was proposed and **cancelled the same day**
   ([DECISIONS.md](../DECISIONS.md)). The number that settled it: the gate model also **aligns rows**, and
   an unalignable row discards every strip on it — the weak referees dropped **10,695 strips as
   `row_unaligned`** (4,467 nota / 5,540 tup / 688 r1) against **2,330 accepted**. Yield, not
   precision, is the referee's dominant effect. ⚠ **The audit sample must be READ.** `--audit-frac`
   measures the escaped-bad-label rate, which is the whole guard now that the referee has seen these
   labels; exam v2 sampled 2 of 63 and a later full read found **51%** wrong. ⛔ The exam is not
   re-emitted and keeps the neutral decode ([rung3/README.md](../rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3)).


### Item 5 — the dotted (usul) barline (promoted 2026-08-20; Round 3 drew it label-free)

5. ✅ **PROMOTED OUT OF THIS FILE 2026-08-20 — the dotted (usul) barline goes into the FINAL
   RENDER, drawn LABEL-FREE.** The decision, its two halves and what is given up are in
   [DECISIONS.md](../DECISIONS.md); the work is tracked in [STATUS.md](../STATUS.md). The description below
   is kept because it is the diagnosis, and because the *token* half of it is still owed to Round 4.
   ⚠ **What changed:** this item was deferred behind the render-slot rule; the staccato arm's read
   has happened and the same-shape argument is now backed by a trained result. It is also the only
   deferred item the owner is paying for **by hand** — ~1 in 5 of `batch3`'s corrections so far is
   deleting a false `\repstart`.

   **The diagnosis, as written:** the DOTTED (usul) BARLINE has no token and is never drawn, so the
   model reads it as `\repstart`. Owner-found while labelling `batch3`, then measured: **117 of 1,499 rows
   (7.8%)** decode a `\repstart`, and of the 23 judged so far **13 had it removed as wrong**
   ([METRICS-INPUT.md](../METRICS-INPUT.md#diagnostics--the-symbols-the-model-has-never-been-shown)). Turkish editions print a dotted barline to mark
   usul subdivisions inside a measure; `ADDED_TOKENS` has no spelling for one and the renderer draws
   only single and repeat barlines, so **0 of 40,826 strips** contain one and the nearest thing the
   model knows is a repeat sign — a line plus *dots*.
   ⭐ **This is the same structural hole as the staccato one** (Lever 6) — and as of 2026-08-20 that
   matters more than it did, because the staccato arm **ran and took its primary from 72.7% to 0.0%**
   while the three realism arms beside it were all nulls. **A hole responds to being filled; a domain
   gap does not** ([rounds.md § The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES](rounds.md#the-staccato-distractor--round-3s-arm-2-lever-6--passes)). Same shape as the signature-only
   crop and the bare phrase slur before it. The fix has the same two halves:
   draw it (a renderer change plus a per-piece coin) and give it a name — ⚠ and `ADDED_TOKENS` is
   **append-only**, so a `\dottedbar` token goes at the END and needs gold annotation before it can
   be scored.
   ⛔ **The deferral text that stood here is SPENT and is not to be acted on** — it said the item was
   held behind the render-slot rule and behind the staccato flag's open question. Both resolved on
   2026-08-20 and the item was promoted; see the head of this entry. ⚠ **What did NOT get promoted is
   the token half**: the `\dottedbar` spelling stays a Round-4 question, because naming the symbol
   would make every existing real gold label — none of which annotates one — silently wrong. Drawing
   it label-free is consistent with every pool on disk, which is the whole reason it costs no
   labelling ([DECISIONS.md](../DECISIONS.md)).
   ⚠ **Cheap first step, no render**: count dotted barlines across the real pools with a probe, the
   way the tuplet mark was counted. 7.8% of one batch is a decode statistic, not a print frequency.


### Item 7 — the 59-id decoder budget (resolved 2026-09-07: 80 under scheme H)

7. ✅ **RESOLVED 2026-09-07 — MEASURE THE 59-id DECODER BUDGET. It is a setting, not an architectural
   limit, and it is the only item on this list that pays THREE times.** `MAX_IDS = 59` in
   `src/vision/audit_coverage.py` exists because the base weights' `generation_config.max_length` is
   **60**; `src/vision/data.py` truncates training targets to it and every emitter drops a strip that
   exceeds it. The comment beside it — *"cannot be raised without breaking training"* — is true of
   **existing checkpoints**, which is not the same as true of a model trained from base, and the final
   render trains from base anyway. What raising it would buy, all three already measured:
   - **the exam**: on the REBUILT exam it drops **153** strips as over-budget (of 567 dropped in all),
     and **3 of the 67 pages produce nothing at all**, capping the exam at 64 pages
     ([METRICS-EXAM.md](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument)). The pre-rebuild figure was 78 of 282.
   - **the tuplet repertoire**: 39.4% of triplet-bearing *single* measures blow it, 80.5% of 2-measure
     and 92.9% of 3-measure windows — which is *why* sirto/longa/saz semaisi are unmeasured
     ([rung3/labeling.md](../rung3/labeling.md#labeling-step-1--collecting-real-pages-and-matching-them-to-symbtr) §1c, [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) §5)
   - **training data**: 2,108 over-budget drops plus the `split_wide` pile
   ✅ **DONE 2026-09-07 — the measurement was run and the owner raised it to 80 under scheme H.**
   `scripts/rung3/budget_tail_probe.py` did exactly what this item asked (the real tokenizer over the
   existing drop lists, one script, no GPU): over b8's 15,758 serialized labels the over-gate count is
   **504 (3.20%) at 59 and 148 (0.94%) at 80**, and the longest label the owner has ever hand-typed
   is **67** ids. ⚠ **This item's premise needed one correction**: the ceiling is not 60 but **100** —
   `data.collate(max_len=100)` and `MAX_TOKENS` in `decode.ts` — so 59 was never the model's limit,
   only the emitter's gate. ⚠ The cost side this item flagged is still unpriced and still real:
   longer targets mean more decode steps per strip, in the browser and on Cloud Run. Nothing about
   the SHIPPED latency changed, because the budget gates the training pool and not the runtime.
   [METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md) · [DECISIONS.md](../DECISIONS.md).


### Item 9 — the model-voted key signature (rule D chosen and built 2026-09-06)

9. **NEW 2026-08-21 — THE MODEL-VOTED KEY SIGNATURE: measure it, then change the rule.** Found by the
   owner reading `examv3-full` ([METRICS-CORPUS.md](../METRICS-CORPUS.md) has the mechanism and the
   counts). The signature is the only part of a label not derived from SymbTr: the model reads it off
   each row-start strip and the majority read **overwrites** the derivation. The voter is the weak
   `rung3-labeler`, its koma/küçük confusion is systematic so the vote is unanimous and wrong, and the
   `nd` gate cannot see signatures at all. It fired on **24 of 45 exam pieces**, **406 of 938**
   `strips_nota` pieces, 98 of 293 `strips_tup`, 26 of 65 `strips_r1`.
   ⏭ **The measurement is a script — no labelling, no GPU.** For every piece where the override fired,
   compare the chosen signature against `data/makam_signatures.json`'s majority variant for that
   makam and list the disagreements. On the exam that already gives **8 of 36 pieces**, several of
   them *missing* entries the table calls near-universal (huseyni, nikriz, segah). That turns one
   owner observation into a checkable list across all four pools.
   ⏭ **The proposed rule change**: a model may not silently overwrite the table. Where the vote
   disagrees with the makam's majority variant, send the row-start strips to **review** instead of
   overriding — the same treatment a split vote already gets.
   ⚠ **Re-emitting with `round2-stage2-best` does NOT fix this** (item 4): that model trained on these
   labels, so it inherits the koma bias. A better voter is still the wrong kind of authority.
   ⭐ **That prediction is now OBSERVED, not argued** (2026-08-22): the 201-row `b8-audit` — labels the
   *re-emit* wrote with `round2-stage2-best` voting — contains **2 more `\komaSharp`→`\kucukSharp`
   corrections inside `\sig`**, both in the same direction as the exam's ten. ⚠ n=2, so it confirms
   the mechanism survived the re-emit; it does not size it.
   ⚠ **Not yet an error rate.** n=7 corrections in 1 makam; many overrides are probably right, and the
   table is a guide — mahur genuinely prints both ways (küçük 35, koma 17).
   ✅ **THE MEASUREMENT IS DONE (2026-09-06)** — `scripts/rung3/sig_vote_audit.py`, all five pools,
   in [METRICS-CORPUS.md](../METRICS-CORPUS.md#metrics--the-model-voted-key-signature-audited). It confirmed the mechanism and moved the target: the
   **largest** content change is not a wrong accidental but a **deleted** one (410 overrides drop an
   entry against 156 that alter one; 106 of the missing entries were in the derivation), and **47%
   of overrides change only the drawn order**, which no earlier count separated. ⏭ **Still owed: the
   rule**, and it now needs an owner decision, because a table-disagreement trigger (145 pieces)
   cannot see the dropped-entry class while a content-change trigger (690) can
   ([rung3/round4.md](../rung3/round4.md) step 3).


### The segah `b2` question (closed 2026-09-05)

#### ✅ CLOSED the day it was opened — a segah spelled `b2` is a SymbTr artefact, not a page (owner, 2026-09-05)

Kept because the wrong version of this is easy to re-derive from the fixtures. `MAKAM_INTONATION`
matches a note by its **exact** written alteration, and the staff draws the **nearest** AEU sign
(`toAeuAlter`) — so on the bundled SymbTr exports a `Si4b2` and a `Si4b1` are the same koma-bemol on
screen and only the second is bent. `gamzedeyim-deva` is **22 `b1` against 54 `b2`**;
`beyati-delisin` is **0 against 40**, so choosing Beyâtî there changes nothing at all. That looks
like a hole in the table and is not one.

⛔ **A real page cannot spell a `b2`.** The model's vocabulary is the **8 AEU accidentals** plus a
natural (`ADDED_TOKENS`, `src/vision/data.py`) — there is no 2- or 3-koma token, so a decode only
ever produces ±1 / ±4 / ±5 / ±8, and printed Turkish editions only ever print those four signs
either way (owner: *"beyati delisini zaten biz SymbTr'den aldık, orada b2 b3 var ama normal
fotoğraflarda yok öyle bir şey"*). `decoded.json`, the one bundled score that came from a photograph,
reads **2 `b1` / 0 `b2`**. The product path — photo → decode → play — is therefore already exact.

⚠ **Two residues, both small and both worth knowing.** (1) The **editor** offers ±2/±3 on purpose
(`ACCIDENTAL_VALUES`), so a hand-placed 2-koma si draws as a koma-bemol and takes no bend; that is
one user, one note, and snapping the match would make the editor's exact alterations stop meaning
what they say. (2) On a SymbTr fixture the picker's count reads low by design — 22 where a reader
counts 76 drawn koma-bemols on `gamzedeyim-deva`. Do not debug that as a counting bug.


## Risks — closed caveats, archived

*Was `docs/archive/phases.md` (last updated 2026-10-08).*

> ⛔ **Archived 2026-10-08 from [BACKLOG.md § Open risks and non-claims](../BACKLOG.md#open-risks-and-non-claims).** Why each left: the training pools moved to
> the current slicer (`strips_b8` / `strips_h1` hardlink `strips_v2`); the exam's gold was fully read
> and the exam was read on 2026-09-01; the 46-page interval became 63 graded pages (now a live caveat
> in RISKS); the crop-geometry probe closed 2026-08-17; the browser fallback was switched off
> 2026-09-04; Round 3 is closed; error highlighting (W8) was dropped 2026-08-05; the pivot trigger was
> already superseded.

- **NEW (2026-08-21): the training pools are the last thing still on the RETIRED slicer.** The exam
  was rebuilt on the current one and `_realval_v2` was already on it; `strips_nota` / `strips_r1` /
  `strips_tup` — **2,330 real training strips** — were not. Until they are re-emitted, a Round-3 model
  learns real-page appearance from crops the shipped slicer no longer produces, then is selected and
  graded on crops it does. Round 3's own Lever 1 measured crop geometry as **causal**, so this is a
  domain gap of the kind the round exists to close. Cost of fixing it is measured and low: **89% of
  the labels carry** onto the new crops by measure span, with no new labelling
  ([BACKLOG.md](../BACKLOG.md) item 4).
- **NEW (2026-08-21): 96 labels enter the rebuilt exam's gold without any human having read them.**
  139 strips come straight from the emitter; 43 agree token-for-token with the frozen exam's hand-made
  gold, the other 96 have no such check. The reference point is exam v2's own audit: of its 63
  auto-accepted labels a human later corrected **32 (51%)**. They are the `examv3-full` tab, and
  reading them is a precondition of the read
  ([rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) §3c).
- **NEW (2026-08-21): the rebuilt exam is a harder instrument than the floors were signed against.**
  ~12 candidate strips a page against 7.1, so the primary reads lower at equal model quality. The
  baseline re-score keeps the comparison fair; what the absolute 75% *means* is an open owner
  decision, and it must be settled before the read (§3c).
- **NEW (2026-08-15): the primary Round-3 floor is measured on 46 pages, so its 95% interval is
  roughly ±12 points.** ⚠ Superseded in its numbers by the rebuild — the exam is now 64 pages —
  but not in its point. A model truly at 72% can read 78% and vice versa. The criteria are signed and
  are **not re-opened**; what is still open, and is the owner's call **before** the read, is whether
  to grow the exam first (v3 is already owed) or to read it as signed and report the interval beside
  the result. Choosing after seeing the number is the one option that is not available.
  Reasoning: [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first).
- **NEW (2026-08-15): the crop-geometry finding is observational.** ~40 strips a bucket, on crops cut
  by the retired slicer, and no causal test has run yet. Nothing renders on it until the padding
  probe reads. ⚠ The same file also records the trap in acting on it: narrow crops make the
  **short-crop hole** the common case, and short crops are the worst thing this model reads.
- **The in-browser fallback hides its own reasons.** Whenever the server is missed the page is still
  read correctly, so nothing looks broken — the only evidence is `data-where` and a warm laptop. That
  is what let the cold-start bug live from 2026-08-06 to 2026-08-08 in a fully "passing" deployment.
- **NEW (2026-08-14): a Round-3 model will differ from `round2-stage2-best` by four things, not one** —
  the corpus change, the **`staff_jitter` augmentation added 2026-07-29** (two days after Round 2
  trained; ±4% scale on 80% of samples, never A/B'd), a sub-visual **rasterizer drift** that moves
  every one of the 40,826 strips, and the training environment. This is why the tuplet A/B trains its
  own control instead of reusing the live model, and it is a caveat on Round 3's exam read too.
  Measurements: [METRICS-CORPUS.md](../METRICS-CORPUS.md); reasoning:
  [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol).
- **The correction-loop strategy is now the plan, not a fallback** (goal change 2026-07-27). What is
  still unmeasured is whether error localisation actually saves a user time — that needs a person
  correcting real pages with and without the highlights, not a model metric.
- **Superseded:** there is no pre-registered pivot trigger. Switching to a correction-loop strategy is a
  situational call after the Round-2 exam, not an automatic rule.


## Setting up Google Cloud — step by step, in plain words

*Was `docs/archive/phases.md` (last updated 2026-10-08).*

> This page is **how to do it**. What we chose and why is [server.md § Deploying the app — the server, the host, and what the friends…](../app/server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for); the exact deploy
> commands live there too and are repeated at the end here. Current state:
> [../STATUS.md](../STATUS.md).

---

### First: the program and its memory are two different things

This trips people up, so it comes first.

| | Where it lives | What happens if you reinstall |
|---|---|---|
| **The program** (`gcloud` itself) | wherever you installed it | replaced |
| **Its memory** (accounts, tokens, configurations) | `~/.config/gcloud` | **untouched** |

So "delete it and reinstall to get a clean slate" does not work. You would reinstall, type
`gcloud auth list`, and still be logged in as before. **If you want a clean slate, clean
`~/.config/gcloud` — that is the part that remembers.**

A **configuration** is just a saved set of three answers: *which Google account*, *which project*,
*which region*. `gcloud` can hold several, so one machine can serve two unrelated jobs safely.

---

### Step 1 — find out what is actually on this machine

```bash
which gcloud                          # is the program there at all?
ls ~/.config/gcloud                   # is the memory there? (it survives an uninstall)
cat ~/.config/gcloud/active_config    # which setup is switched on
cat ~/.config/gcloud/configurations/* # which account and project it points at
```

**On this machine, as of 2026-08-06:** the program is **gone** (it used to be at
`~/Desktop/google-cloud-sdk`) but the memory is **still there**, holding a logged-in account from
the old freelance job. `~/.zshrc` also still has two lines pointing at the deleted folder; they are
harmless (guarded by `if [ -f … ]`) but untidy.

#### Clearing the old job out, safely

Rename rather than delete — if something turns out to be needed, renaming is one command to undo:

```bash
mv ~/.config/gcloud ~/.config/gcloud.old-job     # reversible; delete it in a month if all is well
```

Then remove the two dead `google-cloud-sdk` lines from `~/.zshrc` (the installer adds fresh ones).

---

### Step 1b — install it

Homebrew is the tidy way on a Mac: it keeps the program out of your Desktop and updates it with
everything else.

```bash
brew install --cask gcloud-cli     # NOT google-cloud-sdk, NOT google-cloud-cli
hash -r                            # your shell caches which commands exist; this forgets that
gcloud version
```

⚠ **The cask name has changed twice.** It was `google-cloud-sdk`, and Homebrew now calls it
`gcloud-cli` (Google renamed the product from "SDK" to "CLI"). If it ever fails with *No Cask with
this name exists*, do not guess — run `brew search gcloud` and read the second group, which is the
cask list.

⚠ With the Homebrew version, **`gcloud components update` is disabled** — use `brew upgrade` instead.
That is the only day-to-day difference from Google's own installer. It also installs `python@3.14`
as a dependency (gcloud is written in Python); that does not disturb conda or `.venv-ml`.

---

### Step 2 — make a separate setup for this project

```bash
gcloud config configurations create turkish-omr
```

This creates it **and switches to it**. From now on, everything you type affects only this one.

If a second job ever needs its own account and project, make it another configuration rather than
logging in and out:

```bash
gcloud config configurations list                  # what exists
gcloud config configurations activate turkish-omr  # switch between them
```

---

### Step 3 — log in with your own Google account

```bash
gcloud auth login
```

A browser window opens. **Choose your personal account**, not a client's.

---

### Step 4 — make a project

A "project" is a box that holds everything: the server, the logs, the bill.

```bash
gcloud projects create turkish-omr-app --name="Turkish OMR"
gcloud config set project turkish-omr-app
gcloud config set run/region europe-west3
```

Two things to know:

- **The project id must be unique in the whole world.** If `turkish-omr-app` is taken, add something:
  `turkish-omr-app-2026`. Use the same name in the later commands.
- **`europe-west3` is Frankfurt** — the closest Google region to Türkiye, so your friends wait less.

---

### Step 5 — connect a payment card (yes, even though it will be free)

Google will not run anything without a card on file. Your usage should sit inside the free tier and
cost about **$0** — see the measured numbers in [server.md § Deploying the app — the server, the host, and what the friends…](../app/server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for).

1. Open <https://console.cloud.google.com/billing> in your browser.
2. Create a billing account if you do not have one, and add your card.
3. Connect it to the project:

```bash
gcloud billing accounts list          # copy the ID, it looks like 0X0X0X-0X0X0X-0X0X0X
gcloud billing projects link turkish-omr-app --billing-account=0X0X0X-0X0X0X-0X0X0X
```

---

### Step 6 — set a budget, and understand what it does NOT do

Do this **before** the server exists.

1. Go to **Billing → Budgets & alerts → Create budget**.
2. Set the amount to something small, like **$5 per month**.
3. Tick alerts at 50%, 90% and 100%. Put your email in.

⚠ **Be clear about this: a Google budget only sends you an email. It does not stop the spending.**
There is no simple "hard stop at $5" switch. (There is a complicated way — a script that switches
billing off — and it is not worth it for a hobby project, because it can also break things while you
sleep.)

So the real protection is three cheap things, and they are already in place:

| Protection | Where it comes from |
|---|---|
| `--max-instances 10` | the deploy setting — Google will never run more than 10 copies (it was 3 until 2026-09-04) |
| 20 uploads per minute per person | built into the server (`npm run check:limits` proves it) |
| The free tier itself | your expected use is roughly 15% of it |

---

### Step 7 — turn on the three services you need

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

In plain words: **Cloud Run** runs the server, **Cloud Build** turns the code into a container, and
**Artifact Registry** stores that container.

---

### Step 8 — build and deploy

```bash
PROJECT=turkish-omr-app; REGION=europe-west3
IMAGE=$REGION-docker.pkg.dev/$PROJECT/omr/decode:latest

gcloud artifacts repositories create omr --repository-format=docker --location=$REGION
gcloud builds submit --config apps/server/cloudbuild.yaml --substitutions _IMAGE=$IMAGE .

gcloud run deploy omr-decode --image $IMAGE --region $REGION \
  --cpu 1 --memory 2Gi --concurrency 1 --max-instances 3 --timeout 300 \
  --set-env-vars OMR_ORT_THREADS=1 \
  --allow-unauthenticated
```

⚠ **Historical command (2026-08-06).** Since 2026-09-04 the live service runs `--max-instances 10`,
and `ALLOWED_ORIGINS` carries the localhost dev origins too. Do NOT re-run this block against the
live service — it would overwrite both. To ship a new image, use the image-only command in
[server.md § Running and deploying the decode server — the commands](../app/server.md#running-and-deploying-the-decode-server--the-commands).

The build takes a few minutes and uploads about 213 MB. **This was run for real on 2026-08-06**: the
build succeeded first time in **1 m 27 s**, and the *deploy* failed once — the container exited
before opening its port, and Cloud Run reported only "failed to start and listen on PORT". The real
error was in the logs (`gcloud logging read`), and it is fixed. If a deploy ever fails that way
again, **read the logs before changing anything** — the message Cloud Run shows you is never the
error itself.

At the end Google prints a URL. Check it:

```bash
curl https://<that-url>/health          # should say "ready": true
npm run check:limits -- --url https://<that-url>
npm run bench:server -- --fixture f.json --url https://<that-url> --cold
```

The last one gives you **the first real cold-start number this project has ever had**. Put it in
[../METRICS.md](../METRICS.md) and delete the laptop guesses.

---

### Step 9 — after the app is hosted, lock the door

Once the app has a real address, tell the server to accept only that address:

```bash
gcloud run services update omr-decode --region $REGION \
  --set-env-vars OMR_ORT_THREADS=1,ALLOWED_ORIGINS=https://your-app-address
```

Until you do this, it accepts requests from anywhere.

---

### What it will actually cost

| | |
|---|---|
| Cloud Run (the server) | **$0** — you would use roughly 15% of the free tier at 50 users |
| Cloud Build | **$0** — 2,500 free build-minutes a month, you need a few |
| Artifact Registry (storing the container) | **~$0.10/month** — the free tier is 0.5 GB and the image is about 1 GB |

⚠ So it is "free" with an asterisk: expect a bill of a few cents, not zero. Prices were not checked
against Google's pricing page — re-read them when you set the budget.

---

### If you get stuck

- `gcloud config list` tells you which setup is active. Most confusing errors are "wrong project".
- `gcloud run services logs read omr-decode --region europe-west3` shows what the server printed.
- A `403` almost always means step 7 (services) or step 5 (billing) is missing.


## Putting the app online — step by step, in plain words

*Was `docs/archive/phases.md` (last updated 2026-10-08).*

> ✅ **This was all done on 2026-08-06** — the app is at **<https://komavision.netlify.app>**, the
> weights at **`Beyaban/omr-weights`**. The page is kept as the record of how, and as the recipe for
> doing it again (a second site, a rebuilt machine, a new model). Two things bit us and are marked
> ⚠ **GOTCHA** below.
>
> This page is **how to do it**. What we chose and why is [server.md § Deploying the app — the server, the host, and what the friends…](../app/server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for). The Google Cloud
> half has its own page: [phases.md § Setting up Google Cloud — step by step, in plain words](#setting-up-google-cloud--step-by-step-in-plain-words). Current state: [../STATUS.md](../STATUS.md).

---

### What still has to go somewhere

The decode server is already live. Two things are not:

| What | Size | Where | Done? |
|---|---|---|---|
| The decode server | — | Cloud Run | ✅ live |
| **The weights** (three model files) | **211 MB** | **Hugging Face Hub** | ❌ this page |
| **The app** (the web page itself) | **43 MB** | **Netlify** | ❌ this page |

**Do them in that order.** The weights get an address, and that address has to be typed into the
app *while it is being built* — so the app cannot be built until the weights exist.

⚠ **Nothing here needs a payment card.** Both are free at this size.

#### Why the weights are not just part of the app

A static host will not accept a 90 MB file, and — more importantly — **a friend on the normal path
never downloads them at all**. The weights are only fetched if the Cloud Run server does not answer
and the app has to read the page on their own machine instead. So they live somewhere separate, and
are collected only in that emergency.

---

### Part 1 — Hugging Face (the weights)

Hugging Face is a free hosting site for machine-learning files. Think of it as GitHub for models.

#### Step 1 — make the account

1. Go to <https://huggingface.co/join>.
2. Sign up with your email. Pick a username — **it becomes part of the address of your weights**, so
   choose one you are happy to keep.
3. Confirm the email they send.

#### Step 2 — make a token, so the computer can log in as you

A token is a long password that programs use instead of your real one.

1. Go to <https://huggingface.co/settings/tokens>.
2. **Create new token** → give it the **Write** role (it needs to upload, not just read).
3. Name it something like `turkish-omr-upload`.
4. Copy it. **You cannot see it again after you leave that page** — if you lose it, delete it and
   make another; that costs nothing.

Then log in on this machine:

```bash
.venv-ml/bin/hf auth login
```

It asks you to paste the token. Paste it and press Enter. (It will not appear on screen as you
type — that is normal, not a frozen terminal.)

⚠ It also asks whether to use the token for git. **Say no** — this project does not push code to
Hugging Face, only files.

#### Step 3 — make the repository, and make it PUBLIC

```bash
.venv-ml/bin/hf repo create omr-weights --repo-type model
```

This creates `https://huggingface.co/<your-username>/omr-weights`.

⚠ **It must be public, which is the default here — do not add `--private`.** The reason: the app
fetches these files straight from a friend's browser, with no password anywhere. A private repo
would need a token embedded in the app, and anything embedded in a web page is public anyway — it
would be a secret in name only.

Nothing sensitive is in there. It is a music-reading model, trained on our own rendered sheets.

#### Step 4 — upload the weights

```bash
.venv-ml/bin/hf upload <your-username>/omr-weights apps/server/models . --repo-type model
```

That is 211 MB over your connection — expect a few minutes, and it prints progress. If it stops
half way, run the same command again: it skips what already arrived.

⚠ **Upload `apps/server/models/`, not any other model folder.** That exact directory is what the
Cloud Run container was built from, so the server and the emergency fallback read the same bytes. If
they were assembled separately they would slowly drift apart, and the first sign of it would be a
friend's fallback quietly disagreeing with the server for no visible reason.

If that folder is missing, rebuild it with:

```bash
node apps/server/tools/prepare-models.mjs
```

#### Step 5 — check it from outside

```bash
curl -sIL https://huggingface.co/<your-username>/omr-weights/resolve/main/model.json | head -20
```

You want a `200` on all four files. You also want an `access-control-allow-origin` line — that
header is what lets a browser on another website read the file, and without it the fallback fails
*quietly*.

⚠ **The three `.onnx` files answer `*`, but `model.json` does not, and that is fine.** The big files
are LFS and come from a CDN; the small one is served by the Hub app, which **reflects whoever asked**
behind `vary: Origin`. A bare `curl` sends no Origin, so it shows `https://huggingface.co` and looks
broken. Ask the way a browser does before believing it:

```bash
curl -s -o /dev/null -D - -H "Origin: https://example.netlify.app" \
  "https://huggingface.co/<your-username>/omr-weights/resolve/main/model.json" | grep -i access-control-allow-origin
```

It should echo back the origin you sent. `model.json` is fetched on **every** page load, not just
the fallback, so this one is worth checking properly.

**Write this address down**, it is the next part's input:

```
https://huggingface.co/<your-username>/omr-weights/resolve/main
```

(`resolve/main` is the part that means "give me the actual file", not the web page about the file.)

---

### Part 2 — Netlify (the app)

#### Why Netlify and not Cloudflare Pages

Cloudflare was the first choice and it does not work, for one specific reason found on 2026-08-06:
**Cloudflare Pages refuses any single file over 25 MiB**, and one file in our app is **25.58 MiB** —
the wasm runtime that lets the browser read a page on its own. Over by about 600 KB.

Netlify has no cap in the way, and reads the same `_headers` file, so nothing in the project had to
change. (This is the payoff of a choice made back on 2026-08-05: the two hosts were kept
interchangeable on purpose.)

The wasm file *can* be made half the size later — see [server.md § Deploying the app — the server, the host, and what the friends…](../app/server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for) — but that is a change
to how the app reads pages, and it should not be rushed to meet a hosting deadline.

#### Step 6 — make the account

Go to <https://app.netlify.com/signup> and sign up with your email. No card.

#### Step 7 — build the app, with both addresses baked in

The app has to be built **knowing** where the server, the weights and the instrument voices are.
These are not settings you can change afterwards — they are written into the files.

```bash
VITE_DECODE_URL=https://omr-decode-706571981988.europe-west3.run.app \
VITE_WEIGHTS_URL=https://huggingface.co/<your-username>/omr-weights/resolve/main \
VITE_VOICES_URL=https://huggingface.co/datasets/<your-username>/omr-voices/resolve/main \
npm run build:app
```

⚠ It is the whole address from step 5, `huggingface.co` included — and no trailing slash.

⚠ **`VITE_VOICES_URL` includes `/datasets/`** — the voices live in a *dataset* repo, which does not
resolve like the weights' model repo. Get it wrong and you get 404s that look like a failed upload.

⚠ **Do NOT set `VITE_AUDIO_URL`, ever.** It is the base for the app's *own* `audio/` folder, which is
where F2's two drum kits ship from. Pointing it anywhere takes the drums off the app with it and
404s them into the synthesised strokes the owner rejected by ear — **silently**, because the fallback
still makes a sound. The voices have their own variable precisely so this cannot happen
([../DECISIONS.md](../DECISIONS.md), 2026-08-12).

The build takes a few seconds and ends with `✓ deployable (under 60 MB, no weights)`. That last
check exists because the project folder holds 332 MB of model files that must **not** be published;
the build refuses rather than trusting anyone to remember.

#### Step 8 — send it to Netlify

```bash
npx netlify-cli login                       # opens a browser, click Authorize
```

⚠ **GOTCHA 1 — the interactive commands do not work in a monorepo.** `netlify sites:create` and a
plain `netlify deploy` stop and ask "which project?" (it sees `packages/core`, `apps/server`,
`apps/web`). Go through the API instead, which asks nothing. What actually worked:

```bash
cd apps/web                                  # or it resolves ./dist against the repo root and fails
npx netlify-cli api createSite --data '{"name":"komavision"}'
# it ignores "name" and invents one — rename it, and check the answer:
npx netlify-cli api updateSite --data '{"site_id":"<id>","body":{"name":"komavision"}}'
npx netlify-cli deploy --dir /absolute/path/to/apps/web/dist --prod --site <id> --no-build
```

⚠ **GOTCHA 2 — a brand-new Netlify site is PRIVATE, and it does not tell you.** Every URL answers
**401** with a "Login Redirect" page, including the one you just deployed. Nothing is wrong with the
build: Netlify now switches SSO on for new sites (`sso_login: true`). Turn it off:

```bash
npx netlify-cli api updateSite --data '{"site_id":"<id>","body":{"sso_login":false}}'
```

Then `curl -sI https://<name>.netlify.app/` should be **200**. It was neither the account nor the
email — both were fine — so do not go hunting for a verification email as we nearly did.

**Simpler alternative if the terminal is annoying:** open <https://app.netlify.com/drop> and drag
the `apps/web/dist` folder onto the page. Same result, and it does not hit gotcha 1.

**Write down the address it gives you.**

---

### Part 3 — lock the door and check it

#### Step 9 — tell the server who is allowed to call it

Right now the decode server accepts requests from anywhere (`ALLOWED_ORIGINS` is `*`). Now that the
app has a real address, this one command does three owed things at once:

```bash
gcloud run deploy omr-decode \
  --image europe-west3-docker.pkg.dev/turkish-omr-app/omr/decode:latest \
  --region europe-west3 \
  --cpu 1 --memory 2Gi --concurrency 1 --max-instances 3 --timeout 300 --cpu-boost \
  --set-env-vars OMR_ORT_THREADS=1,ALLOWED_ORIGINS=https://<your-site>.netlify.app \
  --allow-unauthenticated
```

⚠ **Historical command (2026-08-06).** Since 2026-09-04 the live service runs `--max-instances 10`,
and `ALLOWED_ORIGINS` carries the localhost dev origins too. Do NOT re-run this block against the
live service — it would overwrite both. To ship a new image, use the image-only command in
[server.md § Running and deploying the decode server — the commands](../app/server.md#running-and-deploying-the-decode-server--the-commands).

⚠ **Rebuild the image first** if the running one predates commit `0b1cb44` — see the deploy commands
in [server.md § Deploying the app — the server, the host, and what the friends…](../app/server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for). That commit fixes an oversized upload reporting itself as "the server is
down" instead of "that file is too big".

What the three are: the address lock, the 413 fix, and `--cpu-boost` (extra processing power during
the slow first start, decided 2026-08-06).

#### Step 10 — check it the way a friend would

Open the Netlify address in a browser and upload a page of sheet music. Then check two things:

1. It says **"read on the server"** at the end, not "read on your machine". If it says the second
   one, the app could not reach Cloud Run — most likely step 9 has a typo in the address.
   ⚠ **This used to be wrong on a first upload, and was fixed on 2026-08-08.** The server sleeps when
   nobody uses it and takes ~10 seconds to wake; it says "not ready yet" until then, and the app used
   to give up and read the page on your own machine instead. Now it **waits** for it — and it also
   nudges the server awake the moment you open the page, so by the time you have picked a file it is
   usually ready anyway. If it still says "read on your machine", something is actually wrong: check
   step 9's address.
2. It finishes. A page takes **35–55 seconds** depending on how many lines of music are on it, plus
   about 10 seconds if the server was asleep.

And re-check the machine-run version, which tests both paths at once:

```bash
npm run smoke:build -- --decode-url https://omr-decode-706571981988.europe-west3.run.app
```

⚠ `--cpu-boost` is new and unproven for us. Google says "up to" faster, so **read the number rather
than believing it**:

```bash
curl -s https://omr-decode-706571981988.europe-west3.run.app/health
```

`loadMs` is how long the model took to load. It was **9,500 ms** before. Put whatever it is now in
[../METRICS.md](../METRICS.md).

---

### Shipping a change afterwards (you will do this for every frontend edit)

The two URLs are **baked into the files at build time**, so `dist/` cannot be edited in place and a
rebuild always needs both variables. Two commands:

```bash
VITE_DECODE_URL=https://omr-decode-706571981988.europe-west3.run.app \
VITE_WEIGHTS_URL=https://huggingface.co/Beyaban/omr-weights/resolve/main \
VITE_VOICES_URL=https://huggingface.co/datasets/Beyaban/omr-voices/resolve/main \
npm run build:app

cd apps/web && npx netlify-cli deploy --dir "$PWD/dist" --prod \
  --site f16514d1-b17b-4dcd-8fc9-2f93816b1d64 --no-build
```

⚠ In practice use **`npm run deploy:app`**, which carries all three variables and the
`--filter @turkish-omr/web` that stops `netlify-cli` hanging on a workspace prompt. The two-command
form above is what it expands to.

Then `npm run smoke:live` — it confirms the machinery still works after the furniture moved. A bad
deploy is one click to undo: Netlify keeps every previous version under **Deploys → Publish deploy**.

⚠ While working locally, `npm run dev:web` reaches the live decode server because
`http://localhost:5173` and `:4173` are in `ALLOWED_ORIGINS`. `npm run smoke:build` against the live
server does **not** — it serves on its own port and gets refused. That is the lock working.

### What it costs

| | |
|---|---|
| Hugging Face (211 MB, public) | **$0** — free for public model files, no card |
| Netlify (43 MB app) | **$0** — the free tier allows 100 GB of traffic a month; two friends will use a fraction of a GB |
| Cloud Run | **$0** — already measured, about 15% of the free tier at 50 users |

---

### If you get stuck

- **The app says "read on your machine" every time.** The browser could not reach Cloud Run. Open
  the browser's developer console (⌥⌘I) and look for a red CORS message — that means step 9's
  address does not exactly match the app's address (`https://`, no trailing slash).
- **The app hangs with a spinner forever.** That is the fallback failing, and it means the weights
  address is wrong. Re-run step 5's `curl`.
- **`hf: command not found`.** Use the full path: `.venv-ml/bin/hf`.
- **Netlify deployed but the page is blank.** Check you pointed it at `apps/web/dist`, not
  `apps/web`.
- **You want to undo a Netlify deploy.** Netlify keeps every previous version — in the site's
  **Deploys** tab, open an older one and press "Publish deploy".

## The friends release — plan, build order and ladder (W9/W10)

*Moved here from `docs/app/server.md` on 2026-11-20 — the work is finished.*

### What the friends release is actually for

**Two friends. The question is "what features should I add?", not "how good are the readings?"**
That single sentence decides most of what follows, so it is first:

- **The release is not gated on model accuracy.** Round 3 runs in parallel and never blocks it.
- **The friends build takes a better model whenever one lands** — a server redeploy, no client
  download. The cost is that decode-quality comments from this period cannot be attributed to a
  model version; they are anecdotes. The exam stays the only thing that judges a model.
- **Feedback comes back by talking to them.** No in-app reporting button, no telemetry endpoint. At
  n=2 a conversation beats any widget, and it returns feature ideas rather than bug reports. Build
  the endpoint when the audience is too large to talk to.
- **The public launch is a later rung**, behind Round 3's exam result. If Round 3 is good it opens
  up; if not, Round 4, and so on.

### The build order

| # | Step | State |
|---|---|---|
| 1 | **Build the endpoint and deploy it** | ✅ **done and live.** Built in Cloud Build (1 m 27 s, 213 MB context) and deployed. ⚠ Two bugs sat between "built" and "running", both the same shape — the shipped artifact was never the tested one: the ESM bundle threw on `pngjs`'s CommonJS `require` (dev uses `tsx`), and a destroyed socket became a 503. `check:bundle` and a live `check:limits` now cover both. |
| 2 | **Prove the server matches the browser** | ✅ done — `npm run parity:server`, and then the check that actually decides it: both arms scored against `_realval_v2` gold, **paired, no detectable difference** (McNemar p = 0.727). [../METRICS.md](../METRICS.md) |
| 3 | **Client swap behind a flag, plus the fallback** | ✅ done — `VITE_DECODE_URL` (or `localStorage.omrDecodeUrl`). All three paths pass `smoke:page` with the SAME score: browser 24.5 s, server 6.0 s, and a dead server falling back in 25.0 s while telling the user so. |
| 4 | **Safety checklist** | ✅ **complete** — `npm run check:limits` 6/6 + rate limit, $5 budget alert set, `--max-instances 3`. |
| 5 | **Host the app and the weights** | ✅ **done 2026-08-06** — Netlify + Hugging Face Hub, then one redeploy for `ALLOWED_ORIGINS` + the 413 fix + `--cpu-boost`. Walkthrough: [phases.md § Putting the app online — step by step, in plain words](#putting-the-app-online--step-by-step-in-plain-words). |

### Open questions

| Question | Answer |
|---|---|
| What does a page cost in vCPU-seconds? | **~40 on Cloud Run** (1.93 vCPU-s/strip), against 11.7 on the M4 — a shared vCPU is **~3.5× slower**. Free tier ≈ **4,450 pages/month**. |
| How long is a real cold start? | **10.6 s**, of which **9.5 s is loading the graphs** (1.5 s on the M4). Container start is the small half. ⚠ Measured minutes after a deploy; a cold start after genuine idle is still unmeasured. |
| Does the ~19 crops/page upload beat sending the page image? | **No — usually larger** (median ~1.7×). The seam stays for the other reasons; the byte argument is withdrawn. **Is the batched encoder worth it? No** — slower and 2.9× the memory, `OMR_MAX_BATCH` defaults to 1. |

### What this changes in the ladder

| Rung | Effect |
|---|---|
| **W8** (confidence) | **DROPPED** for this release — the pre-registered bar was not met. Half of the 2026-07-27 goal stays unbuilt, said out loud. [../DECISIONS.md](../DECISIONS.md) |
| **W9** (server + hosting) | ✅ **COMPLETE 2026-08-06.** Server on Cloud Run, app on Netlify (**<https://komavision.netlify.app>**), weights on the Hub (`Beyaban/omr-weights`), origin lock on, safety checklist complete. Verified against the deployed site rather than assumed: COOP/COEP present, the 25.58 MiB wasm served whole, `/models/*.onnx` 404, both URLs live in the shipped bundle. |
| **W10** (friends release) | Two friends, interface feedback, no ads, no in-app reporting; safety checklist first. |
| **public launch** | A new rung after W10, gated on Round 3's exam result. |
