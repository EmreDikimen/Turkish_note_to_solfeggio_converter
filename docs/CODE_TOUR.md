# Code Tour — how to read this codebase

purpose: a learning-oriented map of the codebase and the order to read it in
audience: anyone new to the code, human or agent
updated: 2026-08-04

A learning-oriented map of the code. Every function also has a detailed comment at its top
(what it does, why, how, what's important) — this file is the **reading order** and a
one-line index so you know where to start and how the pieces connect.

## The big picture

The project is **two halves joined by one JSON file**:

```
SymbTr .txt ──(Python)──► Score/Event ──► note-model JSON ──(TypeScript)──► view + edit + sound
            parse           tuning/synth     export            shared core         web harness
```

- **Python side** (`src/`, `scripts/`) = the reference + data/training tooling. Parses the
  dataset, proves the tuning/synthesis, and exports JSON. Not shipped in the app.
- **The JSON file** = the contract. Python writes it (`export_json.py`), TypeScript reads it
  (`types.ts`). They describe the same shape on two sides of the wire.
- **TypeScript side** = the actual app logic, split deliberately:
  - `packages/core` — **portable logic, no platform APIs** (note model, tuning, scheduling,
    notation, measures, tempo, usul, transpose, metadata). Reused *unchanged* by the future mobile app.
  - `apps/web` — the **React web harness, and the first shipped product surface** (the project
    ships web-first — see ROADMAP §1): it renders the core's output (piano-roll + VexFlow sheet)
    and supplies the *platform adapter* (`webAudioBackend.ts` implements the core's
    `AudioBackend` interface). The later mobile app swaps this UI layer and keeps the core.

**Golden rule for reading:** read the *data shape* before the *functions* (nouns before
verbs). Once you know what an `Event` / `NoteEvent` is, the transforms make sense.

## Reading order

### Part A — Python (the reference + the bridge)

| # | File · function | One line |
|---|---|---|
| 1 | [parser.py](../src/symbtr/parser.py) · `EventKind`, `Event`, `Score` | The data shapes. Read these first. |
| 1 | `Event.kind` / `Event.duration_s` | Is a row a note/rest/grace/meta? (grace = çarpma, Kod 8 / Ms 0.) How long is it? |
| 1 | `Score.notes` / `Score.sounding_events` | Notes only vs. notes+rests (why rests matter for timing). |
| 1 | `parse_file` | **Entry point.** File → `Score`. |
| 2 | [tuning.py](../src/audio/tuning.py) · `koma53_to_freq` | The heart: comma number → frequency in Hz. (`cents_above_ref` = a UI/sanity unit.) |
| 3 | [synth.py](../src/audio/synth.py) · `render_score` → `_render_tone` → `_envelope` → `write_wav` | Notes → audio samples → WAV. |
| 4 | [symbtr_to_audio.py](../scripts/symbtr_to_audio.py) · `main` | Ties 1–3 together (the whole Phase-0 flow on one screen). |
| 5 | [export_json.py](../src/symbtr/export_json.py) · `score_to_dict` → `export_file` | **The bridge.** `Score` → note-model JSON for the TS side. |
| 5 | [symbtr_to_json.py](../scripts/symbtr_to_json.py) · `main` | CLI wrapper around the bridge. |

### Part B — TypeScript core (`packages/core`, the portable logic)

[index.ts](../packages/core/src/index.ts) is just a barrel that re-exports every module below;
the web app imports everything from `@turkish-omr/core`.

| # | File · function | One line |
|---|---|---|
| 6 | [types.ts](../packages/core/src/types.ts) · `NoteEvent`, `NoteModelDocument`, `TuningParams` | Same shape as `Event`/`Score`, in TS. Compare to step 5. |
| 7 | [tuning.ts](../packages/core/src/tuning.ts) · `koma53ToFreq`, `freqFromTuning` | Line-for-line port of step 2 (verified to match). `freqFromTuning` uses a doc's own anchor. |
| 8 | [scheduling.ts](../packages/core/src/scheduling.ts) · `buildTimeline`, `AudioBackend` | Events → flat timeline of timed notes; and the audio *contract* (interface). |
| 9 | [tempo.ts](../packages/core/src/tempo.ts) · `estimateWholeNoteMs`, `beatsToMs`, `estimateBpm` | SymbTr stores no tempo — estimate one (median ms÷beats) to convert note-values ↔ ms. |
| 10 | [measures.ts](../packages/core/src/measures.ts) · `assignBars` → `groupMeasures` | Split a score into bars. `assignBars` reads SymbTr's `offset` (integer = a printed barline); `groupMeasures` groups by the resulting `bar`. `isMeasureValid` drives the editor's Save gate. |
| 11 | [notation.ts](../packages/core/src/notation.ts) · `parseNoteName`, `komaOf`/`spellNote`/`komaToName`, `accidentalGlyph`, `toAeuAlter`, `deriveKeySignature` | Note name ⇄ staff position + comma + Turkish (AEU) accidental glyph. The sheet view's brain. `toAeuAlter` snaps any alteration to a standard AEU sign **for the engraved staff only** (the editor keeps the exact koma). |
| 12 | [usul.ts](../packages/core/src/usul.ts) · `USULS`, `findUsul`, `buildMetronomeTrack` | Usul (rhythmic-cycle) table with beat groupings; builds a metronome click-track aligned to the bars — correct for non-integer usuls (aksak 9/8). |
| 13 | [transpose.ts](../packages/core/src/transpose.ts) · `transpose` | Chromatic transpose of a score (shift koma + re-spell + recompute freq); pitch-augmentation primitive + the harness's transpose/ahenk control. |
| 14 | [metadata.ts](../packages/core/src/metadata.ts) · `scoreHeader`, `makamDisplay`/`formDisplay`/`titleCase` | Format the score's ASCII metadata slugs into a printed Turkish header (makam/form/usul/composer). |

### Part C — Web harness (`apps/web`, the first product surface + the platform adapter)

| # | File · function | One line |
|---|---|---|
| 15 | [webAudioBackend.ts](../apps/web/src/webAudioBackend.ts) · `play(timeline, fromMs?, opts?)`, `pause`/`resume`/`stop`, `getPositionMs`, `buildPeriodicWave` | The browser's *implementation* of `AudioBackend` (web's synth.py): schedules notes, seeks, metronome, exposes the audio clock for the playhead. |
| 16 | [App.tsx](../apps/web/src/App.tsx) · `App`, `loadDoc`, `updateEvent`, `onSaveMeasure`, `onPlayPause`, `applyPlayback`, `applyTranspose`, `buildPlayOptions` | The glue: owns the loaded score, derives `displayDoc` + the timeline, wires transport/tempo/metronome(usul)/transpose/edit to core + backend. |
| 17 | [PianoRoll.tsx](../apps/web/src/PianoRoll.tsx) · `xOf`/`yOf`/`yToKoma`, draw effect, pointer handlers | Canvas piano-roll: x=time, y=comma. Drag a note to change pitch; drag its right edge for duration. |
| 18 | [SheetView.tsx](../apps/web/src/SheetView.tsx) · `SheetView`, `vexDuration`, `buildStaveNotes`, `drawSignature`, `drawLyrics`, `drawThinSharps` | VexFlow-engraved staff: real stems/beams/dots + AEU-only accidentals, triplet brackets / tie arcs / slashed grace notes (from `rhythm.ts`, strips_v2_2), justified rows, a lyric line (syllables/melisma/hyphens), an engraved header, a playhead cursor, click-to-seek, and (edit mode) clickable measures. Three accidental modes (`every` / `keysig` / `measure`=carry — the strip renderer's `mode`). `drawThinSharps` (opt-in, `?thinsharps=1`) redraws the four AEU sharps as SVG at real-print bar weight — the 2026-07-26 fidelity fix that stopped küçük's three bars fusing into a koma; see [STATUS.md](STATUS.md) / [rung3/round2.md](rung3/round2.md). |
| 19 | [MeasureEditModal.tsx](../apps/web/src/MeasureEditModal.tsx) · `MeasureEditModal`, `save` | Per-measure editor: pick pitch/accidental/duration, add/delete; Save only when the bar's total duration is preserved. |
| 19 | [AccidentalSelect.tsx](../apps/web/src/AccidentalSelect.tsx) · `AccidentalSelect` | Custom dropdown showing each accidental's exact Bravura glyph + Turkish name (full range, incl. ±2/±3, for exact-koma editing). |

[main.tsx](../apps/web/src/main.tsx) just mounts React — you can ignore it.

### Part D — ML tooling, Phase 2 (synthetic) and Phase 3 (real pages) (skim after A–C)

Added after Phase 1; not part of the core→harness spine above.

| File(s) | One line |
|---|---|
| [tools/render/](../tools/render/) | Synthetic-data generator: `lilypond.ts` serializes note-model strips to the OMR model's LilyPond label format, `render.ts` (Playwright) crops PNG+label pairs from the live harness render, `repeats.ts` detects + injects repeat signs, `navmarks.ts` injects navigation marks (segno/coda/D.C./Son), `rhythm.ts` recovers triplet groups + tie-splits from the exact durations (real data, no injection — `\tup3`/`\tupend`/`\tie`; strips_v2_2), `respell.ts` seeds the büyük-enharmonic respell, `decode.ts`/`decode-cli.ts` verify labels, `labels-cli.ts` serves labels for a real page's measure ranges (the Rung-3 emitter's TS half), `stitch.ts`/`stitch-cli.ts` are the Rung-4 stage-8 STITCHER (decoded page tokens → editable note model: `\sig` resolution, tie/tuplet/grace fold-back, repeat/volta/da-capo expansion; `stitch-test.ts` = structure unit tests + the 194-score label round-trip). Browser side: `apps/web/src/stripExport.ts` (crop rects + labels from the sheet layout), `textNoise.ts` (seeded distractor text). Since `strips_v3` (2026-07-21) the renderer is **carry-dominant** — `mode: "measure"` (key signature + measure-scoped carry, i.e. how real pages print) with conventional per-makam signatures from `data/makam_signatures.json`, plus label-free **slur distractors** (`slurseed`) so an arc alone doesn't read as a triplet; `--thin-sharps` turns on the real-print sharp weight. `verify-labels.ts` is the PIXELS-vs-LABELS gate (2026-07-26): it re-opens every job from the corpus manifest, reads the accidental glyphs out of the live SVG (SMuFL codepoint, or stem/bar count for the redrawn AEU sharps) and checks each crop rect's glyphs against that strip's label — the check whose absence let the `sigTolerant` defect ship. **Read [tools/render/README.md](../tools/render/README.md) — it's the full tour of this directory.** |
| [tools/browser/](../tools/browser/) | `run-page.ts` — runs any harness page in headless Chromium (Vite node API + Playwright) and asserts on the global it exposes, turning pages that were checked by eye into commands: `npm run gate:browser` (the ONNX gate), `npm run probe:cv` (the opencv.js parity probe). `--expect P/T` tallies the page's own ✓/✗ marks instead of trusting a boolean — the OMR gate reports a single `FAIL` while the known ORT-web int8 `\tup3` wobble exists, so only a pinned tally (27/28) can tell that from a real regression. `app-smoke.ts` (`npm run smoke:app`) drives the REAL app with Playwright — sets the "Read strips" input to a page's crops, waits for the read, switches to Sheet, plays, and downloads the saved JSON — covering the `onStrips` → `loadDoc` → render → transport wiring a headless pipeline test cannot reach. |
| [apps/web/src/omr/](../apps/web/src/omr/) | **The in-browser OMR runtime** — the product decode path, extracted from the Rung-1.5 gate harness at MVP rung W1 so React can use it. `decode.ts` (`greedyDecode` = encoder once → first-step decoder → decoder-with-past loop, the JS port of `onnx_parity.onnx_greedy_decode`; `argmaxLast` also returns each token's log-probability; `decodeStrip` packages ids + tokens + `hitCap`/`minLogprob`/`meanLogprob`), `preprocess.ts` (`preprocessCanvas` = DonutImageProcessor on canvas — the `Math.trunc` calls transliterate HF's `int()` steps and are load-bearing; `sourceSize`/`canvasFromImageData` let the slicer's canvases feed it), `types.ts` (`Sessions`, `ModelMeta`, `StripDecode`), and **`slicer/`** — the TypeScript port of `page_to_strips.py` (MVP W4–W6, guide in [mvp/slicer-port.md](mvp/slicer-port.md)): `constants.ts` (every constant with the Python line it came from, plus `pyRound()` — Python rounds half-to-even and `Math.round` does not, which silently retunes two barline gates), `cvOps.ts` (**the only opencv.js importer**; everything else works on plain typed arrays so the transliteration diffs against the numpy), `prepPage.ts` (`estimate_skew`/`deskew` ported — NOT the no-op the plan assumed, 15.3% of corpus pages take a real rotation — with `detect_page_quad`/`crop_to_page` left as the camera seam), `staves.ts`, `rows.ts`, `slicer.ts` (`sliceStage1`). ⚠ It is a **transliteration**: do not restructure, do not "improve" it, and do not optimise the 41-rotation skew sweep here even though it costs ~35 s/page. **Two rules:** nothing here may touch the DOM by id (that import-time `getElementById` is what made the gate unimportable), and this is deliberately NOT `packages/core`, which ROADMAP §2 keeps free of platform APIs. |
| [tools/vision/parity/](../tools/vision/parity/) | Browser-vs-Python decode parity. `arm-b.ts` decodes **Python's own crops** in headless Chromium and diffs against the `strips_v2` decode caches — the **ceiling** the ported slicer is judged against at W6 ("within 1 pp", never 100%), since a canvas draw is not PIL BILINEAR. ⚠ It compares token streams **after** the stitcher's `normalizeTokens`: the two sides serialize differently (`\sig\komaFlatb` vs `\sig \komaFlat b`) and comparing raw strings put the ceiling at 10% instead of 96.7%. `--json` dumps per-strip agreement with crop width and confidence, which is how the "wider crops resample worse" hypothesis was killed. `edge-cases.ts` proves non-strip images (blank, black, 8×8, wrong orientation) return a loadable doc instead of throwing. `slicer-parity.ts` (`npm run parity:slicer`) scores the ported slicer against **local Python** — `scripts/slicer_ref.py`, which is both the control arm and the sample definition, since the `strips_v2` manifests are NOT reproducible by the current code (1,680/1,704) and scoring against them failed pages where the port matched Python line for line. `--inject-skew` skips the 41-rotation sweep by feeding Python's angle in, which is what makes a full-corpus run affordable. |
| [apps/web/src/checks/](../apps/web/src/checks/) | `stripsHarness.ts` (+ `apps/web/strips-harness.html`) — headless entry to the *shipped* decode path for the parity tools; deliberately a browser page, not a Node lookalike, because the canvas resampler only exists in a browser. `logprobCheck.ts` + `apps/web/logprob-check.html` + `scripts/logprob_ref.py` — proves the browser's confidence signal transfers before W8 builds highlighting on it. Both sides decode the gate's `.pixels.bin` reference tensors, so the image pipeline is out of the picture. It does **not** assert per-token equality: ORT-web and ORT-Python int8 disagree by up to 8.6e-2 (the documented numerics gap), so it asserts that every token lands on the same side of the validated `min_logprob < -1.0` threshold. `npm run check:logprobs`. `slicerHarness.ts` + `apps/web/slicer-harness.html` — headless entry to the ported slicer; returns per-system geometry only and never pixels, because a 10-system page normalizes to ~10 MB of row images and serializing those over CDP would dominate the run. |
| [apps/web/src/probe/](../apps/web/src/probe/) | `cvProbe.ts` + `apps/web/cv-probe.html` + `scripts/cv_probe_ref.py` — **throwaway** (deleted at MVP rung W6): proves opencv.js reproduces OpenCV-Python's Otsu / MORPH_OPEN / connectedComponents / INTER_AREA before the slicer is ported. Two arms: fed Python's own grayscale bytes it must be *exact* (algorithm parity); fed the browser's PNG decode it only drifts (`imread(IMREAD_GRAYSCALE)` converts inside the decoder, which a browser cannot reach). See [mvp/README.md](mvp/README.md). |
| [scripts/](../scripts/) | Corpus building (Python, never shipped): `select_pieces.py` picks the (piece, transpose) render jobs by greedy max-min AEU coverage — since 2026-07-26 it also EXTENDS an existing selection (`--keep`, `--boost-class`, `--per-makam-cap`, `--sig-table`) instead of re-rolling it, and refuses exam pieces by SymbTr id (`--exam`); `export_scores.py` writes the picked pieces to `apps/web/public/scores/`; `build_makam_signatures.py` learns the conventional printed signature per makam from the adjudicated real labels (AEU theory only as fallback); `make_split.py` splits BY PIECE; `symbtr_to_json.py` / `symbtr_to_audio.py` are the SymbTr readers; `check_docs.py` guards these docs. `slicer_ref.py` dumps Python's slicer stage 1 (prep_page → detect_staves → normalize_row) as the **control arm** for the TypeScript port, and the file it writes also defines the sample the browser side runs — resumable, ~1.9 s/page. |
| [src/vision/](../src/vision/) | Python fine-tuning side: `eval_omr_transformer.py` (Step-1 model gate), `data.py` (dataset/label wiring), `overfit10.py` (Rung-1 gate), `onnx_parity.py` + `make_browser_gate.py` (Rung-1.5 ONNX/browser gate), `audit_coverage.py` (Rung-2 dataset gate; fed by `scripts/select_pieces.py` / `export_scores.py` / `make_split.py`). **Rung-2 training kit:** `augment.py` (on-the-fly input-realism augmentation, screenshot-dominant two-profile mix — preview grid is the human gate), `modeling.py` (shared model/tokenizer setup so train + eval can't drift), `train.py` (the scaled Colab fine-tune: AMP, warmup+cosine, val loop, checkpoint/resume — recipe in its docstring), `eval_omr.py` (headline per-class AEU accidental accuracy + SER via id-space alignment; since 2026-07-27 it also splits recall by PRINT POSITION — `\sig` block vs notehead — which is how Round 2's koma↔küçük confusion was traced to the key signature), `quantize_onnx.py` (int8 quantization of the exported graphs). **Rung-4 page pipeline:** `page_to_strips.py` (classical-CV slicer: page → training-shaped strips via staff/barline detection + scale normalization; `docs/PIPELINE.md` §1 stages 2–6; carries the 2026-07-25 **photo front-end** — auto-deskew, crop-to-quad de-warp, `STAFF_HOR_FRAC=0.11` — all no-ops on clean scans. **2026-07-29 overhaul:** width and measure caps are now actually enforced; `TRIM_SHARED_EDGE` stops neighbouring crops sharing pixels; `place_band()` + `row_music_extent()` float the staff inside the fixed frame so low beams are not cut off; `row_cost_features()` / `estimate_tokens()` predict a strip's decoded length so over-budget crops are flagged in the manifest; `window_signature()` / `window_cache_ok()` key decode caches on the whole windowing. Knobs, all defaulting to the shipped behaviour: `OMR_WINDOW_MODE` (legacy|budget), `OMR_TOKEN_BUDGET`, `OMR_EDGE_TRIM`, `OMR_VPLACE`, `OMR_VPLACE_MIN_HEAD`, `OMR_MEASURES_PER_STRIP` — see [METRICS-SLICER.md](METRICS-SLICER.md) for what each was measured to do), `decode_page.py` (end-to-end page decode: slicer → ONNX greedy decode → per-row token streams + `<page>_decode.json`, the stage-8 stitcher's input). **Round-N (real-data) additions:** `make_realval_pool.py` (materialises the real-val pool `eval_omr.py` scores for the pre-registered selection number), `degrade_probe.py` (degraded-strip hallucination probe). Results log: [MODEL_EVAL.md](../src/vision/MODEL_EVAL.md). |
| [scripts/rung3/](../scripts/rung3/) | **The real-page (Phase-3) loop** — narrative in [rung3/](rung3/README.md). *Collect:* `collect_nota.py`, `collect_tuplets.py`, `find_tuplet_pieces.py` (`scripts/collect_notalar.py` did the neyzen corpus). *Label:* `match_symbtr.py` (name-match a real page to SymbTr = free ground truth), `emit_strip_labels.py` (real strip PNG → token label; `--val-side` restricts the run to real-val pieces through `data.is_real_val_piece` rather than a hand-made list; hard-fails when two source pages resolve to one page stem, because strip dirs are keyed by stem alone — `collect_tuplets.neyzen_stems()` is where stems are made unique, and it distinguishes a real collision from a duplicate upload), `decode_pages_gpu.py` (Colab batch decode), `review_ui.py` (one-keystroke verdict UI for every queue: adjudication, `photo-gold`, `exam-fix`, `realval-hard-v2`, `reslice-all`; `/img/` is keyed by QUEUE — `QUEUE_IMG_ROOTS` binds each queue to the crops it was built from, because a strip filename survives a re-slice and its pixels do not; queues over `EAGER_MAX` rows ship counts only in `/api/state` and load their rows from `/api/rows` when the tab is opened), `build_reslice_queue.py` (one queue over EVERY strip the re-slice decoded — 33,804 crops / 1,704 pages — worst-first, seeded with the page cache's decode; joins ONLY `strips_v2emit`, the sole emit made from those crops, see [rung3/labeling.md](rung3/labeling.md)), `build_realval_v2.py` (`--report` the exam-vs-real-val difficulty mix, `--queue N` stage the hard tier **worst-first**, `--build` assemble the rebuilt pool; queues are versioned per re-slice and `--strip-root`/`--pools` must point at the current slicer's output), `promote_labels.py` / `rule_fix_notafull.py` (adjudicated labels → training or exam manifest), `build_testset.py` (freeze the exam). *Measure:* `score_slicer.py`, `score_clean_baseline.py`, `decode_photos_exam.py` + `score_photos_exam.py` + `photos_exam_report.py` (photo domain), `score_photo_gold.py` (hand-labelled photo strips), `build_photo_gold_queue.py` / `build_exam_fix_queue.py` + `apply_exam_fix.py` (gold re-audit), `sharp_adjudication_report.py` + `sharp_width_test.py` (the microtonal-sharp diagnosis that traced the weakness to our renderer). Since 2026-07-26 `score_photos_exam.tally` also buckets gold by PRINT POSITION (`\sig` block vs notehead) and `score_photo_gold.py` / `score_clean_baseline.py` print that split — the microtonal sharps are scored almost entirely in the signature, which a pooled per-class number hides. `build_realval_v2.py` (2026-07-28) rebuilds real-val to the exam's difficulty mix — `--report` shows the gap and how many hard strips are owed, `--queue N` stages the `realval-hard` review queue (see [rung3/labeling.md](rung3/labeling.md)). **Round-3 pre-render probes (2026-07-28)**, each carrying its pre-registered bar AND its result in the docstring so it is not re-litigated: `empty_crop_probe.py` (`--sweep` decodes the whole exam and buckets edits by crop width and note count — the tool that reproduces the 562-edit total and gave per-strip attribution for the first time), `width_split_probe.py` (splits wide strips at a gutter and scores against identical gold — closed the "cut them narrower" idea), `beam_weight_probe.py` (beam thickness in staff spaces, ours vs real print — closed "our beams are too heavy"), `staff_geometry_probe.py` (dose-response ladder over scale/shift — found the slicer's staff-size bias, worth 12–15.5% of corrections). |

## The 15-minute path (the spine)

If you only have a little time, read just these and you'll understand the whole flow:

1. `parser.py` → `Event` (what a row is)
2. `tuning.py` → `koma53_to_freq` (comma → Hz)
3. `symbtr_to_audio.py` → `main` (Phase-0 flow end to end)
4. `types.ts` → `NoteModelDocument` (the JSON contract in TS)
5. `scheduling.ts` → `buildTimeline` (data → timed notes)
6. `App.tsx` → `App` (how the harness ties core + backend together)

## Two ideas worth pausing on

- **The `AudioBackend` boundary** ([scheduling.ts](../packages/core/src/scheduling.ts) defines
  it, [webAudioBackend.ts](../apps/web/src/webAudioBackend.ts) implements it). Everything that
  touches a real audio API lives behind this interface — that's what lets the mobile app reuse
  the core verbatim and only rewrite the backend.
- **Bars come from `offset`, not from counting beats** ([measures.ts](../packages/core/src/measures.ts)).
  SymbTr's `offset` column already marks barlines (an integer = one usul cycle), so this works
  for non-whole-note usuls like aksak (9/8), not just düyek (8/8). The `bar` is assigned once at
  load and travels with each event so editing can't scramble the grouping.

## How to read actively (not just stare)

Run this with files 1–4 open:

```bash
python3 scripts/symbtr_to_audio.py data/raw/<score>.txt --info
```

The `--info` table (note name → koma → Hz) **is** the data flowing through steps 1→2.
Then open the exported JSON next to `types.ts` (steps 5–6) and you'll literally see the
bridge: the same fields, Python on one side, TypeScript on the other.

```bash
python3 scripts/symbtr_to_json.py data/raw/<score>.txt -o apps/web/public/sample.json
npm install && npm run dev:web   # open the URL: ▶ Play, toggle Sheet, ✎ Edit a measure
```
