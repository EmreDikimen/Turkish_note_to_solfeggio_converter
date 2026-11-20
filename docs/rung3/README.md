# Rung 3 — teaching the model real pages

purpose: index and plan for the real-page (model) track, its settled findings, and the exam rules
audience: agents and the owner working on real data
updated: 2026-11-20

> This track's **current state and next action are NOT here** — they live in
> [../STATUS.md](../STATUS.md). This file describes the plan and where each part is written up.

## The plan in one paragraph

Pieces that also exist in SymbTr need no hand labeling — **SymbTr already is the correct answer**.
The neyzen corpus gave 85 such matches; notaarsivleri.com (TRT-repertoire sheets with real catalog
metadata) gave far more, in a second engraving style — so both sources' matches were collected and
**one big Round-1 fine-tune ran on both styles at once** (owner decision 2026-07-11: don't split
what can be one training run). A throwaway **Round-0.5 labeler** was inserted before the nota emit
(the 348-row review queue and its 22.6% audit fix rate showed how much labor a synthetic-only
emitter model costs); Round 1 itself stayed one run from base weights. Before training, matched
pieces were frozen as a never-trained-on **exam**. Only after the rounds does hand work start on
the unmatched pieces — by then the model has seen real engraving, so correcting is "glance and
confirm", not "repair everything".

## The live files

| File | Covers |
|---|---|
| [round4.md](round4.md) | **Round 4, the open round**: the root causes with their homes, the owner's decisions, the order of work and where each step ended |
| [tokenization.md](tokenization.md) | How a label is spelled, what scheme H changed, and why the vocabulary A/B was a null |
| [round4.md § Third-source probe — does the model hold up on an engraving house…](round4.md#third-source-probe--does-the-model-hold-up-on-an-engraving-house-it-has-never-seen) | Round 4's step 4 — the third-engraver probe: the three sites, what was collected, and the provenance traps |
| [labeling.md](labeling.md) | The label **conventions** — what is a token and what is label-free ink (the retired `\tie`, the arc) |
| [labeling.md § Labeling, Step 1 — collecting real pages and matching them to SymbTr](labeling.md#labeling-step-1--collecting-real-pages-and-matching-them-to-symbtr) | Collection and free labels: neyzen match, the Round-0.5 labeler, the notaarsivleri run, targeted tuplet collection |
| [labeling.md § The labelling queues — reslice-all, the batches, b8 and examv3](labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3) | The review queues feeding the training pools and the exam (reslice-all, the batches, b8, examv3, h1) |
| [labeling.md § The real-val labelling queues — realval-hard, and the 2026-09-09…](labeling.md#the-real-val-labelling-queues--realval-hard-and-the-2026-09-09-repair) | The review queues feeding REAL-VAL (realval-hard, and the 2026-09-09 repair) |
| [README.md § The exam — freezing an honest test set (Steps 2 and 3)](#the-exam--freezing-an-honest-test-set-steps-2-and-3) | Freezing the exam, the emitter's calibration, exam v1 → v2 → v2.1 → v3 |
| [README.md § Standing findings — the real-page track, established and still true](#standing-findings--the-real-page-track-established-and-still-true) | Settled findings of this track — background, not next actions |

## The closed rounds — archived, do not act on them

| Round | Files |
|---|---|
| Round 1 (2026-07-23) | [rounds.md § Round 1 — the first fine-tune on real pages (Step 4)](../archive/rounds.md#round-1--the-first-fine-tune-on-real-pages-step-4) · [rounds.md § Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim](../archive/rounds.md#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim) · [rounds.md § Synthetic re-render — `strips_v3` and the accidental-distribution…](../archive/rounds.md#synthetic-re-render--strips_v3-and-the-accidental-distribution-findings-step-41) |
| Round 2 (2026-07-27) | [rounds.md § Round 2 — photo axis, the sharp fix, and what is still open](../archive/rounds.md#round-2--photo-axis-the-sharp-fix-and-what-is-still-open) |
| Round 3 (closed 2026-09-03, archived 2026-10-08) | [rounds.md § Round 3 — the notes themselves: where they sit and how long they are](../archive/rounds.md#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are) · [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](../archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) (the **signed** ≥75% bar that still governs publishing a model) · [rounds.md § Round 3 — the worklist, item by item](../archive/rounds.md#round-3--the-worklist-item-by-item) · [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](../archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) (the unpulled levers — still the menu for the next round) · [rounds.md § The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL](../archive/rounds.md#the-scan-profile--round-3s-first-trained-arm-lever-7--null) · [rounds.md § The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES](../archive/rounds.md#the-staccato-distractor--round-3s-arm-2-lever-6--passes) · [rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](../archive/rounds.md#tuplets--why-tup3-recall-keeps-missing-its-floor) |
| Parked ideas, watch-items, the old folder layout | [rounds.md § Follow-ups — the correction loop, parked ideas, watch-items, data…](../archive/rounds.md#follow-ups--the-correction-loop-parked-ideas-watch-items-data-layout) |

**Raw records, verbatim** — every Colab training console (Round 3's arms, final model, runs A and B;
Round 4's control and H arms) and the owner's two labelling ml/notebooks (unusable crops, model failures
seen while labelling) — are in [../log/raw/](../log/raw.md#round4_control_logs). ⚠ Read a console
beside [../../ml/omr/MODEL_EVAL.md](../../ml/omr/MODEL_EVAL.md); ⛔ an H arm's `EDITS` are in
H ids and compare with nothing in the old vocabulary.

## State of the steps

| Step | State |
|---|---|
| 1 — free labels from SymbTr matches | ✅ done, both sources (+ targeted tuplet collection) |
| 2 — freeze the exam | ✅ v2.1 frozen 2026-07-19; **v3 promoted 2026-08-31** — 67 pages in the set, 64 that produce strips (3 drop every candidate on the budget), **63 pages / 660 strips graded** at the read — read once for Round 3 ([README.md § The exam — freezing an honest test set (Steps 2 and 3)](#the-exam--freezing-an-honest-test-set-steps-2-and-3), [METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument)). ⏭ Round 4 keeps `examv3` as the comparable column; dense and third-source columns stay SEPARATE |
| 3 — strip-label emitter | ✅ built and calibrated; rule D for the key signature since 2026-09-06; the 80-id budget under scheme H since 2026-09-07 |
| 4 — Round 1 | ✅ shipped as "an improvement, not a pass" (2026-07-23) |
| 4 — Round 2 | ✅ shipped as "an improvement, not a pass" (2026-07-27) |
| 4 — Round 3 | ✅ **CLOSED 2026-09-03** — exam **51%** against the signed 75% floor, a miss; ~15 of its +17 points were the retired `\tie`; runs A and B nulls ([METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument), [METRICS-EXAM.md § Metrics — Round 3's two follow-up runs (A and B)](../METRICS-EXAM.md#metrics--round-3s-two-follow-up-runs-a-and-b)) |
| 4 — Round 4 | 🔄 **open since 2026-09-03** — both arms trained 2026-09-16/17; scheme H is a NULL; the control `r4-ctl-stage2-last` leads on dense strips and has been the **live model since 2026-09-28**. The exam is **not read** for Round 4 ([round4.md](round4.md), [METRICS-EXAM.md § Round 4's vocabulary A/B — how it is scored, and what the kit…](../METRICS-EXAM.md#round-4s-vocabulary-ab--how-it-is-scored-and-what-the-kit-measured-before-any-gpu-ran)) |
| 5 — hand-correction loop on unmatched pieces | ⏸ not started (scheduled after the rounds) |

## Standing rules for this track

- The exam is read **once** per round, on the final model; iteration happens on real-val.
- **Real-val orders candidates; it does not predict the exam** (28pp gap measured).
- Accidental-class disagreements between label and decode **never auto-accept** — a human decides.
- Photos of exam pieces are **exam-only**, never training.
- Full list with dates: [../DECISIONS.md](../DECISIONS.md).

**Merged into this file on 2026-11-20:**

- [Standing findings — the real-page track, established and still true](#standing-findings--the-real-page-track-established-and-still-true) — was `docs/rung3/README.md`
- [The exam — freezing an honest test set (Steps 2 and 3)](#the-exam--freezing-an-honest-test-set-steps-2-and-3) — was `docs/rung3/README.md`


## Standing findings — the real-page track, established and still true

*Was `docs/rung3/README.md` (last updated 2026-10-08).*

> Moved out of [../STATUS.md](../STATUS.md) on 2026-08-07, when that file crossed its 400-line
> limit. Nothing here is a next action; it is the background a next action rests on. Current state
> and what to do → [../STATUS.md](../STATUS.md). Dated history → [../log/status-log.md](../log/status-log.md).

---

### Previously (real-page track — all still true)

**The re-slice is DONE and REAL-VAL v2 IS BUILT.** `data/real/rung3/_realval_v2` holds **267 strips
at the exam's own difficulty mix — 47 easy / 110 mid / 110 hard (17.6 / 41.2 / 41.2%)**, against the
old pool's 59 / 41 / **0**. The 110 hard strips are hand-verified, every crop comes from the new
slicer, and no decode-derived label survives. Numbers: [METRICS-SLICER.md](../METRICS-SLICER.md).
Full account: [log/status-log.md](../log/status-log.md).

- **The val-side pool is 146 pieces / 194 pages** — the old "158 pages" figure was wrong by more
  than the stem fix could explain, and 37 page stems had never been sliced at all.
  `emit_strip_labels.py --val-side` now derives the list through `data.is_real_val_piece`.
- **The queue ordering was REVERSED (owner, 2026-07-29): worst rows first — and the finished queue
  proves it.** All 165 rows were read by hand (111 ok / 44 fix / 10 bad, 155 usable): the **worst
  half needed a fix 46% of the time, the best half 7%** — a 6.5× concentration. Under the old
  most-confident-first ordering half the effort would have gone to rows that needed nothing. The
  early-stop protocol was not used and stays available; why the stop is gated on error
  *clustering* rather than error count is in [rung3/labeling.md](labeling.md).
- **The full re-slice is DONE (2026-07-31).** `data/real/strips_v2` now holds **1,781 page dirs /
  1,704 decode caches / 35,586 crops** — 1,578 re-sliced on Colab plus the 203 val-side pages. Every
  cache passes `window_cache_ok` and records `round2-stage2-best`, so the emitter reuses all 1,704.
  67 pages (4.2%) found no staves — covers and near-empty continuation pages, matching the val side.
  ⚠ **The 67 exam pages were deliberately excluded**
  (`data/colab/decode_pages_reslice_EXAM_EXCLUDED.txt`): the exam is frozen and its gold describes
  crops under `data/real/strips/`. Re-cutting them belongs to exam v3.
- **All of the re-slice is now REVIEWABLE (2026-07-31).** `ml/labels/build_reslice_queue.py`
  writes one `reslice-all` queue over every crop the re-slice decoded, so any strip can be pulled
  up in `review_ui.py` and verdicted against its picture instead of only the hard-tier sample.
  It is a browsing tool — nothing consumes it, and it is not a labelling target. Sizes, what a row
  means and what is deliberately NOT joined into it: [rung3/labeling.md](labeling.md).
- **Two silent-staleness traps were closed before any labelling** — a strip filename survives a
  re-slice but its pixels do not. Queues are now versioned per re-slice, and image lookup is keyed
  per queue (`QUEUE_IMG_ROOTS`); without the latter, 129 of the 165 rows would have shown old
  crops against new rows with nothing to notice.
- **The windowing constants STAY** (`MEASURES_PER_STRIP = 3`, `MAX_STRIP_W = 1450`). The sweep
  pointing at 1 measure/window was scored on usable *yield*, which cannot charge for the near-empty
  crops that shrinking creates; re-scored with that cost, 1 measure/window takes the healthy band
  81.6% → 60.4%. A budget-aware packer was built, decoded head-to-head and is a **wash** — it ships
  OFF (`OMR_WINDOW_MODE=budget`).
- **Two cap bugs fixed** — the measure cap was unenforced (13 of 3,168 strips) and the width cap was
  violated 82 times by three separate paths. Both verified to **0**, measure coverage invariant.
- **Crops no longer overlap** — the 6 px left pad had no matching right trim, so 74.8% of mid-row
  strips shared pixels with their predecessor (195 → 0 pairs). ⚠ The double-count worry behind it is
  **not** real; it was kept for pixel/label agreement, and the decode A/B is a wash.
- **The staff now floats inside the frame** so low beams are not cut off (bottom clipping
  11.9% → 4.4%). ⚠ Decode A/B is **neutral and underpowered, with no dose-response** — this is a
  geometric argument, **not** a measured accuracy win. `OMR_VPLACE=0` disables it.
- **Decode caches now key on the full windowing signature**, so a slicer change can no longer
  silently reuse crops cut by different code.
- **The page-stem collision is FIXED (2026-07-29)** — and only one of the two was a collision.
  `bir_nigah_et_ney` really is two different songs under one stem (now qualified with the makam);
  `nesem_emelim_ney` is one upload filed under two makams, byte-identical, so the duplicate was
  dropped rather than renamed. A full scan found exactly these two. `emit_strip_labels.py` now
  refuses to slice when two pages resolve to one stem. Detail:
  [METRICS-SLICER.md](../METRICS-SLICER.md).

**✅ The "2% pre-shrink" is CLOSED (2026-07-31): it does not replicate, and off the exam it makes
things WORSE.** Shrinking exam strips ~2% removed 12–15.5% of corrections (562 → 475) and looked
like the biggest free lever this project had found. Re-run on the rebuilt `_realval_v2` — which now
has the hard tier whose absence was the last defence of the result — **every scale is worse:
+2.7% at 1%, +5.2% at 2.5%** ([METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)). The effect
reverses off the exam. Do not re-propose it.

- **How it happened, so it is not repeated:** ~15 variations were run against the frozen exam and
  the best-scoring one was reported as a finding — selection on the test set — before any holdout
  was tried. The holdout should have come first. Mechanism tests along the way ruled out resampling
  (down-up = 555), blur (562), ink weight (lighten 565, thin 589) and staff-size matching (the
  benefit appears in every size bucket, including strips already at 30.0 px), so there was never a
  mechanism either.
- **The rebuilt pool is what closed it.** Real-val v2 carries the hard tier the old pool lacked and
  is harder than the exam on SER, so "an effect confined to hard pages could hide there" is no
  longer available as an explanation. That is the first decision `_realval_v2` has actually
  settled — and it settled it against the result.

### Previously (Round 3 pre-render checks, 2026-07-28)

**All four hypotheses were RUN against the shipped model, with no training and no re-render. Three
died.** Dropped, measured, do not re-propose: rendering the odd crop shapes, cutting wide crops
narrower (**+31.8% edits**), thinning beams. Still standing: the content work — eighth/quarter-note
mix and bar-line density in `select_pieces.py`. ⚠ **A FIFTH check was added 2026-08-15** — the
encoder's input geometry, the first one not about what we draw. It came back causal, its follow-up
pilot was **stopped 2026-08-17**, and the owner then put **Lever 4 (renderer diversity)** in front of
the content work, which stays behind all of it. Ranked menu and the live order: [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](../archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first).
`USUL_BEAM_GROUPS` remains **unvalidated and
quarantined** (the beam check measured thickness, not grouping) and `staff_jitter` is insurance, not
a fix. Full detail: [archive/rounds.md](../archive/rounds.md#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are); why each was dropped:
[DECISIONS.md](../DECISIONS.md).

### Previously (moved out of STATUS 2026-08-16 — settled, no next action here)

These were "Now" items that are finished. They are kept because each carries a caveat that outlives
the result.

✅ **THE `\tup3` A/B RAN, AND IT IS A NULL — the redrawn mark stays, and no recall claim is made.**
Two arms on the identical recipe over corpora row-for-row identical apart from the mark: **88.9% (new)
vs 85.2% (control)** on `_tupletval` — 2 net groups of 54, **exact McNemar p = 0.688** against a
pre-registered ~6-group threshold. Precision cleared its veto and the `_realval_v2` guard passed. The
null branch of the rule written *before* the render applies: **keep the shape**, on the print
measurement (16/16 marks, ~11 editions), and claim nothing either way. ⚠ **Not "the shape doesn't
help"** — 54 groups cannot resolve under ~11 pp. ⚠ The `_realval_v2` `\tup3` split is **not** a second
result; those 35 groups are a subset of these 54.
**The mark itself (2026-08-12, retired from STATUS 2026-08-16):** measured against ~11 real printed
editions (16/16 break the arc), redrawn to those numbers, and corrected twice by the owner's eye.
Geometry: [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md); the account, including the
comparison sheet and its ⚠ local-viewing-only caveat: [rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](../archive/rounds.md#tuplets--why-tup3-recall-keeps-missing-its-floor).

[../METRICS.md](../METRICS.md) · [../../ml/omr/MODEL_EVAL.md](../../ml/omr/MODEL_EVAL.md).

✅ **The control also answered a question nothing else could**: it scored **85.2%, exactly
`round2-stage2-best`'s score on the same pool** — so `staff_jitter`, the rasterizer drift and a fresh
training environment moved this class by **zero, together**. Only learnable by training the arm.
⚠ Reading the misses afterwards produced a **lead** worth more than the A/B did — Track B item 1e.

⚠ **`data/pieces.json` is stale and cost a full corpus render.** `strips_v4` and `data/split_v4.json`
were both built from **`data/pieces_v4.json`** (208 pieces vs 190), but the documented command named
the older file. The wrong render completed and looked normal — 23 of Round 2's pieces missing, 528
strips in neither side of the split, dropped in silence at train time. Fixed beside the command in
[../../CLAUDE.md](../../CLAUDE.md).

### Previously (Round 2, still true)

**Phase 3 (real pages).** Synthetic reading is solved; every open problem is about real printed
pages and photos of them.

- **The goal changed on 2026-07-27: ≥90% of pages need ≤5 corrections, and the app shows where they
  are** ([ROADMAP.md](../../ROADMAP.md) §0). Model accuracy is now a diagnostic, not the target.
  Baseline: **57% of pages ≤5** (median 5, mean 12.2, 52% of strips already perfect). The second
  half — surfacing *where* the model is unsure — **is deferred by the owner (2026-07-27)**; the work
  is therefore on reducing errors, and the evidence for what to reduce is below.
- **Round 2 was read once on 2026-07-27. Its apparent regression was a METRIC ARTIFACT, and it
  SHIPPED the same day** as an improvement, not a pass. The macro headline fell 78.0 → 73.9% mean
  AEU F1, but that average gives a 14-gold class the same weight as a 145-gold one. Re-scored on the
  same strips with low-n-robust measures: **micro recall 83.9 → 84.8%**, **macro≥30 recall 81.4 →
  84.8%**, micro F1 85.0 → 84.8% — flat-to-better, on top of SER 0.059 → 0.052 and 9 of 11 floors.
- **`round2-stage2-best` int8 was the live model from 2026-07-27 to 2026-09-03** (then Run A
  `r3a-stage2-best-real`, then `r4-ctl-stage2-last` since 2026-09-28 — [../STATUS.md](../STATUS.md))
  — its ship chain was all green: parity 14/14 fp32 + 14/14 int8, browser gate 27/28 with the
  product (canvas) path clean 14/14. Runtime in
  `apps/web/public/models/`; Round 1's runtime was backed up at
  `data/checkpoints/_public_models_backup_round1/` until the 2026-09-06 space sweep deleted it as a
  byte-identical duplicate — revert = re-stage `data/checkpoints/round1-best-onnx/*_int8.onnx`.
- **Every eval now reports MICRO and MACRO≥30 beside the macro mean**; past runs back-fill with
  `ml/labels/rescore_headline.py`. The macro mean stays the pre-registered bar — micro was
  computed after the fact and flatters us, so promoting it now would move the goalposts.
- **Accidentals are only 13% of what a user has to fix.** Classifying all 562 exam edits: pitch 40%,
  duration 28%, rhythm signs 13%, **accidentals 13%**, structure 5%. Two rounds went into the 13%,
  because the old headline only measured accidentals. Pitch and duration have never been targeted by
  any synthetic work.
- **Sparse crops are the most expensive shape** — crops with ≤3 notes are 5.5% of exam strips and
  **20.8% of all corrections**. ⚠ **The "hallucinates a bar" reading was DISPROVED 2026-07-28** (1 of
  8 note-free crops invented anything, against a ≥50% bar): it cannot *read* them, and the shape is
  the slicer's trade-off. The `stripExport` fix that sat here is dropped ([DECISIONS.md](../DECISIONS.md)).
- **The sharp diagnosis was right and incomplete.** The label-noise fix killed the one-directional
  küçük→koma fallback as predicted, and küçük-in-signature went **50 → 72%**. Underneath is a
  **symmetric** koma↔küçük confusion — 8× one way, 7× the other, **all 15 inside the `\sig` block**,
  net `\komaSharp` emission 0. Not a bias: a discrimination failure. It wrecks `\komaSharp` (F1
  21.4%) because n=14, and a six-class mean carries that into the headline.
- **The sharps are read in the KEY SIGNATURE, not on noteheads** (exam gold: 32 in-signature vs 1
  inline). `eval_omr.py` now reports recall split by print position — that split is the only reason
  the signature-only confinement was visible.
- **The photo domain is basically solved.** The wall was the slicer, not the model: a guarded photo
  front-end took yield 28% → 97% of pages, and hand-labelled photo strips score within ~3–4pp of
  clean pages.
- **`strips_v4` is built and verified** — 40,826 strips / 202 pieces, thin sharps + the
  pixels-vs-labels fix + 23 küçük-bearing pieces − 5 exam pieces; `verify-labels.ts` clean, audit
  PASS. It is sound data; the corpus is not what failed.

Numbers for all of the above: [METRICS.md](../METRICS.md). Why things were decided this way:
[DECISIONS.md](../DECISIONS.md). Round 2 in full: [archive/rounds.md](../archive/rounds.md#round-2--photo-axis-the-sharp-fix-and-what-is-still-open).


## The exam — freezing an honest test set (Steps 2 and 3)

*Was `docs/rung3/README.md` (last updated 2026-08-21).*

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

### Steps 2+3 — BUILT + CALIBRATED (2026-07-12); provisional exam frozen, first real baseline taken

> Implementation status. The emitter (`ml/labels/emit_strip_labels.py`), the exam builder
> (`ml/labels/build_testset.py`), the carry-mode label serialization, and the honest eval
> are DONE and gated; the plans below remain the reference for the design. What the 85-piece
> calibration taught us (each finding is now baked into the pipeline):
>
> 1. **Real pages are jump-structured.** 64/85 pieces decode a printed segno/Son/D.C.; 40/85
>    carry the flattened D.S. signature in SymbTr itself (the tail duplicates an earlier run).
>    The emitter folds that tail (`detect_dc_tail`) as a fold-candidate next to the adjacent
>    repeats; strips touching the jump-mark measures (or decoding a nav token) go to review.
> 2. **Editions reorder/omit sections**, so a global cursor cannot assign rows — each row's
>    decoded id stream is content-searched against every printed window (monotonic, pruned,
>    margin-or-identical-content acceptance; `\sig` blocks stripped for position-finding).
> 3. **The printed signature is the makam's CONVENTIONAL one, not SymbTr's content-derived
>    one** (hicaz pages print ♭+♯+♯ where derivation gives 2 entries). The emitter
>    majority-votes the model's row-start signature reads and overrides the label signature
>    with the printed truth (33/85 pieces needed it); split votes -> `sig_mismatch` review.
> 4. **Written vs sounding, second layer:** SymbTr's 5-comma eviç under a koma-sharp-F
>    signature is printed BARE (the performer supplies the intonation). Real labels are
>    emitted `sigTolerant`: same-direction intonation refinements of the effective alteration
>    stay bare; explicit signs mark genuine chromatic deviations only. (Caught by the
>    stage-4 eyeball gate — the audit process worked.)
>
> **Final thresholds (calibrated):** strip accept `nd <= 0.10` AND no accidental-class token
> in the label/decode disagreement (`acc_disagreement` — rhythm noise is provably model-side,
> accidental disagreements are exactly what the headline metric can't tolerate, so they always
> get human review); review band `nd <= 0.35`; row search `nd <= 0.45`, margin `0.10`.
>
> **Yield (2026-07-12):** `strips_r1/` = **84 auto-accepted training strips** (23 pieces,
> high-trust: audit samples are exact/near-exact) + **348-strip review queue**
> (`emit_review.csv`: nd_review / acc_disagreement / sig_mismatch / nav / low_coverage — the
> recoverable pool for the planned review interface); `strips_exam/` = **33 exam strips** +
> 443 exam-review. Auto-accept is deliberately conservative: wrong labels are worse than few
> labels, and the review queue is where the volume lives. Also: 233 over-budget drops
> (real 3-measure windows exceed the 59-id cap — a `MEASURES_PER_STRIP=2` re-slice would
> recover many; follow-up).
>
> **Exam frozen (provisional):** `testset.json` — 20 pieces / 16 makams, all 6 reachable
> class floors met (büyük = 0 on real pages, unmeasurable; komaSharp/kucukSharp LOW-N),
> deterministic per seed, committable (`.gitignore` negation chain). Re-run over both sources
> when notaarsivleri lands, THEN commit = the freeze, before Round-1 training.
> **→ ✅ RE-FROZEN v2 over both sources (2026-07-15):** `testset.json` now **25 pieces /
> 16 makams (23 nota + 2 neyzen), every reachable class ≥44 gold accidentals, NO LOW-N
> classes** (bakiyeSharp 361, bakiyeFlat 148, komaFlat 105, kucukFlat 47, komaSharp 44,
> kucukSharp 44; büyük unreachable as before). v1 backed up as `testset.json.bak-v1`.
> Exam emit on the v2 pieces: **63 accepted exam strips + 287-row growth queue**
> (`strips_exam_v2/emit_review.csv` — supersedes the old 443-row `strips_exam` queue).
> Committing testset.json = the freeze.
>
> **First real baseline (`MODEL_EVAL.md` "Rung 3 — real-page exam BASELINE"):** the synthetic
> Rung-2.2b checkpoint scores **83.3% AEU / SER 0.018 / 78.8% exact** on the exam strips (vs
> 99.9% / 0.002 / 96.7% synthetic) — the synthetic→real gap is now a number for Round 1 to
> close.

### ⭐ Exam v3 — the bounded growth, decided 2026-08-20

**Decision: label the 21 exam pages we already own and stop there. 46 → 67 graded pages.** Owner,
2026-08-20, after asking how much more exam labelling was worth doing. This is
[rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](../archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first)'s power-note **option 1** (grow the exam before the read, which keeps the
one-shot rule intact) taken in a bounded form, with **option 2 applied on top of it** (report the
interval beside the result). The census, the drop table and the sizing arithmetic are in
[METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument) and are not restated here.

**Why these 21 pages and no others.** They belong to pieces that are *already* exam-only, so
labelling them takes nothing away from training. Every page beyond 67 costs a piece removed from the
model's training data **and** hand labelling, to buy a precision improvement that goes as the square
root of the work.

**Why we stop rather than push to 113 or 200.** With a 75% floor, the score a model must *measure*
before its interval clears the floor is ~86% at 46 pages and still ~81% at 200. No affordable exam
size makes a near-boundary call crisp, so the honest instrument is the interval, not a bigger n.

**Cost, as estimated before the emit ran** (⚠ the emit came in at 297 rows — see the block below and
[../METRICS-EXAM.md](../METRICS-EXAM.md); the estimate is kept because its *reasoning* is what set the
bound). ~7.1 strips a page ⇒ **~150 strips**, of which (scaling the v2 emit's 63-accepted /
329-review split) roughly **120–130 need a human**. For scale: `batch3` has ~1,385 rows still open,
so exam v3 is about **a tenth** of the labelling already committed — and unlike `batch3` it decides
whether the one-shot read can be interpreted at all. ⏭ **It outranks `batch3` for a scarce evening.**

⭐ **THE EXAM IS BEING REBUILT ON THE CURRENT SLICER — owner, 2026-08-21.** *"I can make it from
scratch, it is okey. Just exam need to be okey."* All 45 pieces / 67 pages were re-sliced into
`data/real/strips_examv3` and re-emitted. `examv3` in the review UI now holds **663 rows over 64 of
the 67 pages**, with **139** strips the emitter labelled by itself. Numbers, and what happened to the
frozen gold: [METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument). How to run it:
[labeling.md § The labelling queues — reslice-all, the batches, b8 and examv3](labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3).

**Why a rebuild rather than the planned growth.** The growth queue was cut on the crops already on
disk and the owner opened its first strip: a 265 px crop holding one measure, its notehead cut by the
frame and its beams outside it. **No exam page had ever been re-sliced** — every crop was 2026-07-15..17
output, four weeks after the slicer was overhauled, which the 2026-07-28 decision row had already
written down as a warning. Growing an instrument that measures a retired slicer is not worth doing.

**The frozen gold was not thrown away.** A label describes the music of an exact measure span, so it
survives on any new crop holding that span: **43 labels agreed** with the fresh SymbTr derivation and
need no human at all, **178 came back as pending suggestions** (151 on rows already queued, 27 as
`gold_conflict` where the two derivations disagree), and **105 were lost** — mostly re-packed into a
differently-bounded window. `strips_exam_v2_clean/` is untouched and remains the record of what
Round 2 was measured on.

✅ **`examv3-full` IS READ — all 139 emitter-written labels, by hand (2026-08-21).** 13.7% were
wrong against exam v2's 51% on the same queue, so the re-slice paid off twice: better crops **and**
better labels off them. ⛔ **But the audit found a defect the exam cannot fix by labelling harder**:
the key signature is decided by a **majority vote over the model's own reads**, not by SymbTr, and it
overwrote the derivation on **24 of these 45 pieces**. Seven of the 18 corrections were that one bug.
Row-start (`w00`) strips are therefore the exam's least trustworthy labels until
[../BACKLOG.md](../BACKLOG.md) item 9 is done — and the cheapest check is one `w00` strip per piece,
since a signature is identical on every row of a piece. [../METRICS-CORPUS.md](../METRICS-CORPUS.md).

⚠ **THE REBUILT EXAM IS A HARDER INSTRUMENT, AND THE SIGNED FLOOR WAS SET ON THE OLD ONE.** It grades
~12 candidate strips a page against the frozen exam's 7.1, so a page collects more edits at equal
model quality and the primary ("pages needing ≤5 corrections") will read lower. Fairness is not
affected — the `round2-stage2-best` re-score puts both models on the same set — but **what a 75%
floor means does change**, and that is the owner's to settle before the read, not after it
([rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](../archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) §3b, §4).

⛔ **THE EXAM IS NOT EMITTED AGAIN, AND ITS DECODE IS NOT UPGRADED** (owner, 2026-08-21). The
training pools answered this the other way — they are re-emitted entirely on `round2-stage2-best`
([../DECISIONS.md](../DECISIONS.md)) — and the exam does not follow them, for one reason: **`round2-stage2-best` is the baseline column re-scored on this very exam.** Gold seeded from
a graded model's decode is anchored toward it; every error a tired reader lets past becomes part of
the answer key, and it is that model's own error. The July model is weaker but is graded by nobody
and comes from a different lineage (fine-tuned from `rung22-stemfix-best`, while `round2-stage2-best`
trained from BASE), so its mistakes are **noise rather than bias** — noise costs both models equally,
and a one-shot read survives that. `_realval_v2` keeps its `round2-stage2-best` seed, because
real-val **selects** and does not grade ([../DECISIONS.md](../DECISIONS.md)).

⏭ **Still true, and now the only remaining ceiling**: 3 of the 67 pages produce nothing at all —
every candidate drops as `split_wide` or `over_budget` — so the exam tops out at **64 pages** until
the 59-id decoder budget is measured ([../BACKLOG.md](../BACKLOG.md) item 7).

### Step 2 — Set the exam aside (before any training on real data)

Freeze ~15–25 matched pieces in `data/real/rung3/testset.json` — **drawn from every source in
the round** (neyzen + notaarsivleri), because a one-style exam can't detect style overfit.
Rules: exclude pieces that are also among the 190 synthetic training pieces (dedupe by SymbTr
file — the exam must measure real-image generalization, not memorized melodies); spread over
makams / signatures / density. Matched pieces are the ideal exam: their labels are perfect.
After every round, `eval_omr.py` on these pages = the real-world accuracy number.

**Grow the exam by adjudication (decided 2026-07-13).** The provisional exam is statistically
thin: 33 auto-accepted strips, 4/8 AEU classes present, ALL LOW-N (~11 gold accidentals behind
the 83.3% headline) — too thin to tell whether Round 1 improved or regressed. The growth pool is the exam-review
queue (**now the 287-row `strips_exam_v2/emit_review.csv`** after the v2 re-freeze; the old
443-row `strips_exam` queue is superseded), and exam strips never enter training, so
adjudicating them is pure measurement quality. Rules:

- **Timing: AFTER the two-source freeze** (step 1b re-run may change the piece list — don't
  polish strips that may drop out), and **BEFORE Round 1's exam-taking**.
- **Priority: accidental-bearing rows first** — they add exactly the gold the headline
  per-class metric lacks. Stop when per-class gold N is respectable (target ~20+ per
  reachable class), not when all 443 are cleared.
- **Re-take the baseline** (`rung22-stemfix-best`) on the grown exam before Round 1, so the
  Round-1 comparison is apples-to-apples — the 83.3% number is only valid on the 33-strip exam.

### Step 3 — Strip-label emitter (NEXT BUILD ITEM, source-agnostic)

A training sample is (real strip PNG → tokens). Strip images come from the slicer
(`page_to_strips.py`); tokens come from SymbTr — copied for exactly the measures inside each
strip. Not `docToStrips` (its token-budget windows differ from the slicer's width-based crops).
Per page:

1. Slice + decode (`decode_page.py`) → strips, measure boxes, decoded tokens.
2. Align SymbTr measures to page measures. The wrinkle is repeats: the page draws a repeat sign
   once, SymbTr writes the passage twice. The decode reads repeat/volta/nav tokens reliably
   (Rung 2: 100%/≥96%), and `detectRepeats` (`packages/core/src/labels/repeats.ts`) already finds SymbTr's
   duplicate runs — fold them together. Where counts still disagree, token-level Levenshtein on
   `labels.json` `full.keysig` recovers the offset (the id-space alignment `eval_omr.py`
   implements).
3. Emit each strip's label from the SymbTr measures it covers: keysig-mode bodies joined with
   `|`, `\sig` prefix on row-start strips, repeat/volta/nav tokens where the page draws them.
4. **Drop any strip whose alignment is uncertain** — a wrong label is worse than no label.
   The emitter also enforces the decoder budget automatically (real-tokenizer ≤59-id check,
   over-budget strips dropped as untrainable — same rule as the synthetic export); token
   counting is never a human job. Gate before training: round-trip every emitted label
   through `decode.ts` + eyeball ~20 renders per source.
5. **Piece-level human screen (user decision 2026-07-11):** before a matched piece's strips
   enter training, a quick by-hand pass over its pages rejects wrong matches, handwritten /
   hand-lettered pages, incomplete or multi-piece PDFs, and layouts the slicer will mangle
   (stacked verse lines, ossia staves). Rejected-for-handwriting pages are PARKED in
   `data/real/rung3/handwritten/` (with their SymbTr match) — out of scope for v1, but the
   free seed dataset if a later version takes on handwriting. A dedicated review interface
   (strip image vs. re-engraved label, one-keystroke accept/flag) is planned to speed this
   and the Step-5 loop up.

This trusts the model almost nowhere: strip→measure mapping is geometry (barline detection),
content is SymbTr. Expected yield: ~1,500–2,000 strips from neyzen's 85 alone; notaarsivleri
multiplies that.
