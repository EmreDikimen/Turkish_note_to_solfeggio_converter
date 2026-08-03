# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-02

## Now

**The work has switched to the PRODUCT. The model is frozen and an MVP is being wired for a
release to friends** (owner decision 2026-08-02). Round 3 does not start until that ships and real
feedback comes back. The reasoning: Round 3 is an unknown-payoff synthetic content-mix bet that
would change nothing a friend notices, the product half of the 2026-07-27 goal (showing *where* the
errors are) has never been built, and feedback cannot be collected without a pipeline. The live
model stays `round2-stage2-best` int8 throughout. Track, ladder and running state:
[mvp/README.md](mvp/README.md).

- **The gap is smaller than it looked.** Decode, Donut preprocessing, detokenization, stitching, the
  editor and playback all already work in the browser — the helpers in `apps/web/src/omrGate.ts`
  were just never exported, and `tools/render/stitch.ts` has no node imports. **The one genuinely
  missing piece is a TypeScript page→strips slicer.**
- **✅ W0 PASSED (2026-08-02): opencv.js is bit-identical to OpenCV-Python** on all five primitives
  the slicer rests on, both sides OpenCV 5.0.0. The port is cleared to start.
- **✅ W1 PASSED (2026-08-02): the decode module is extracted and returns per-token confidence.**
  `omrGate.ts` 309 → 164 lines, the reusable half now in `apps/web/src/omr/`; `omr-gate.html` is
  byte-identical and still reads 27/28 with the same failing strip.
- **✅ W2 PASSED (2026-08-02): THE APP READS SHEET MUSIC.** "Read strips" takes a page's crops,
  decodes them in the browser, stitches and loads a playable, editable, saveable score — verified in
  the real app (16 crops → 344 notes / 28 measures, valid `schemaVersion: 1` on save). **~1.1 s/strip**,
  so a 20-strip page is 20–30 s and W7 needs no Web Worker. Non-strip images decode to 0 events
  without throwing.
- **The browser-vs-Python ceiling is 86.0%** of strips over 20 pages (450 strips) — the bar W6 holds
  the ported slicer to. ⚠ The first measurement said **10%** and was wrong: the two sides serialize
  tokens differently and must be compared *after* the stitcher's `normalizeTokens`.
- **The pre-registered "arm B < 90% → fix the resampler first" rule FIRED and was NOT followed,
  because its causal model is wrong.** Disagreement is concentrated in strips the model was already
  unsure about — **21.9% agreement where Python's `min_logprob < -1.0` (n=32) against 90.9% where it
  is confident (n=418)** — while crop width, which decides how hard a strip is resampled, shows no
  trend (89.3% narrowest decile vs 83.9% widest). `preprocess.ts` is unchanged.
- **First real-data evidence that the `-1.0` confidence threshold means something** — it separates
  exactly the strips where the two runtimes disagree. This partly discharges W1's non-claim.
- **✅ W3 PASSED (2026-08-03): THE BROWSER IS NOT WORSE THAN PYTHON.** Scored against the same 261
  hand-verified `_realval_v2` strips with the same scorer: **SER 0.0821 → 0.0818, exact-match 60.2%
  both, AEU macro recall 94.8% → 94.9%**. The ~14% arm-B disagreement is two ORT builds splitting
  near-ties, at no cost in quality. ⚠ This is a *paired* Δ on real-val — it establishes the
  difference, not the absolute level (real-val does not predict exam performance; 28 pp gap on
  record).
- **⚠ The confidence signal does NOT meet its pre-registered bar.** Against gold, flagged strips do
  average **8.60 token edits vs 2.69** — the signal is real — but "flag 10% of tokens, catch ≥60% of
  errors" is **NOT MET**: the best achievable at a 10% budget is **26.3%**. A usable operating point
  exists at `min_logprob < -0.5` (flag 22.6% of strips, catch 57.1% of edits, 2.5× lift), but as a
  hint rather than a promise. W8 must now choose: ship the soft cut, invest in per-TOKEN
  localisation, or drop the feature. Detail: [mvp/README.md](mvp/README.md).
- **The 40-page ceiling sample was dropped on purpose.** Its ±1 pp bar is not resolvable (SE ~1.6 pp
  at n=450, ~1.2 pp at 40 pages). W6 should compare arm A and arm B **pairwise on the same strips**
  instead, which is far more sensitive and needs no extra pages.
- **W1's pre-registered logprob criterion FAILED and was replaced, on purpose.** Demanding ≤1e-3
  per-token agreement with `onnx_parity.py` assumed two different ORT builds produce identical
  logits from identical input — they do not, and that is the *same* int8 numerics gap already
  documented under open risks. Ids agree on 13 of 14 strips, so the decode is sound. The check now
  measures what W8 depends on: **0 of 576 tokens land on the opposite side of the validated
  `min_logprob < -1.0` threshold.** ⚠ Non-claim: 0 tokens came within 0.1 of that boundary, so the
  gate fixture is too confident to test it — owed on real-page strips at W3.
- **Grayscale can never be exact from a browser, and it does not matter.** `imread(IMREAD_GRAYSCALE)`
  converts inside the PNG decoder; OpenCV's own two paths already differ by ±1 on 7.4% of a colour
  page. Re-running the slicer under that perturbation leaves 119 strips bit-identical
  ([METRICS-SLICER.md](METRICS-SLICER.md)).
- **The browser OMR gate is now a command**, pinned at `27/28` — `npm run gate:browser`.
  `window.__gateResult` had existed unused since the gate was written; a boolean could not tell the
  known `\tup3` wobble from a real regression, so the runner tallies the page's own ✓/✗ marks.
  Baseline before any refactor: 27/28 with the canvas (product) path clean at **14/14**.

## Previously (real-page track — all still true)

**The re-slice is DONE and REAL-VAL v2 IS BUILT.** `data/real/rung3/_realval_v2` holds **267
strips at the exam's own difficulty mix — 47 easy / 110 mid / 110 hard (17.6 / 41.2 / 41.2%)**,
against the old pool's 59 / 41 / **0**. The 110 hard strips are hand-verified, every crop comes
from the new slicer, and no decode-derived label survives. Everything else below is still true. Numbers: [METRICS-SLICER.md](METRICS-SLICER.md). Decisions:
[DECISIONS.md](DECISIONS.md). Full account: [log/status-log.md](log/status-log.md).

- **The val-side pool is 146 pieces / 194 pages** — the old "158 pages" figure was wrong by more
  than the stem fix could explain, and 37 page stems had never been sliced at all.
  `emit_strip_labels.py --val-side` now derives the list through `data.is_real_val_piece`.
- **The queue ordering was REVERSED (owner, 2026-07-29): worst rows first — and the finished queue
  proves it.** All 165 rows were read by hand (111 ok / 44 fix / 10 bad, 155 usable): the **worst
  half needed a fix 46% of the time, the best half 7%** — a 6.5× concentration. Under the old
  most-confident-first ordering half the effort would have gone to rows that needed nothing. The
  early-stop protocol was not used and stays available; why the stop is gated on error
  *clustering* rather than error count is in [rung3/labeling.md](rung3/labeling.md).
- **The full re-slice is DONE (2026-07-31).** `data/real/strips_v2` now holds **1,781 page dirs /
  1,704 decode caches / 35,586 crops** — 1,578 re-sliced on Colab plus the 203 val-side pages.
  Verified: every cache passes `window_cache_ok` and records `round2-stage2-best`, so the emitter
  reuses all 1,704 rather than discarding them. 67 pages (4.2%) found no staves — covers and
  near-empty continuation pages, matching the 4.6% seen on the val side.
  ⚠ **The 67 exam pages were deliberately excluded**
  (`data/colab/decode_pages_reslice_EXAM_EXCLUDED.txt`): the exam is frozen and its gold describes
  crops under `data/real/strips/`. Re-cutting them belongs to exam v3.
- **All of the re-slice is now REVIEWABLE (2026-07-31).** `scripts/rung3/build_reslice_queue.py`
  writes one `reslice-all` queue over every crop the re-slice decoded, so any strip can be pulled
  up in `review_ui.py` and verdicted against its picture instead of only the hard-tier sample.
  It is a browsing tool — nothing consumes it, and it is not a labelling target. Sizes, what a row
  means and what is deliberately NOT joined into it: [rung3/labeling.md](rung3/labeling.md).
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
  [METRICS-SLICER.md](METRICS-SLICER.md).

**✅ The "2% pre-shrink" is CLOSED (2026-07-31): it does not replicate, and off the exam it makes
things WORSE.** Shrinking exam strips ~2% removed 12–15.5% of corrections (562 → 475) and looked
like the biggest free lever this project had found. Re-run on the rebuilt `_realval_v2` — which now
has the hard tier whose absence was the last defence of the result — **every scale is worse:
+2.7% at 1%, +5.2% at 2.5%** ([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)). The effect
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

## Previously (Round 3 pre-render checks, 2026-07-28)

**All four were RUN against the shipped model, with no training and no re-render. Three of the four
hypotheses are dead.** Full detail: [rung3/round3.md](rung3/round3.md).

- **Dropped, measured, do not re-propose:** rendering the odd crop shapes (the cost is real but the
  model does not hallucinate — 1 of 8; and the shape is the slicer's own trade-off, already halved);
  cutting wide crops narrower (**+31.8% edits** when tried); thinning beams (ours are at the
  engraving standard, real print is *heavier*). See [DECISIONS.md](DECISIONS.md).
- **Still standing from the Round-3 plan:** the content work — the eighth/quarter-note mix and
  bar-line density in `select_pieces.py` — now with a second, independent argument behind its width
  half: after the encoder's fixed input box the model sees our beams at 6.5 px and real beams at
  9–14.6 px, purely because our strips are wider and shrink harder.
- **`USUL_BEAM_GROUPS` is still unvalidated and quarantined.** The beam check measured *thickness*,
  not *grouping*, so it cannot clear it. Do not ship it into 40,826 strips.
- **The `staff_jitter` op in `src/vision/augment.py` is insurance, not a fix** — synthetic spacing
  has sd 0.000, so we genuinely shake not at all before augmentation, but the dose-response ladder
  says variance is not what costs edits today.

## Previously (Round 2, still true)

**Phase 3 (real pages).** Synthetic reading is solved; every open problem is about real printed
pages and photos of them.

- **The goal changed on 2026-07-27: ≥90% of pages need ≤5 corrections, and the app shows where they
  are** ([ROADMAP.md](../ROADMAP.md) §0). Model accuracy is now a diagnostic, not the target.
  Baseline: **57% of pages ≤5** (median 5, mean 12.2, 52% of strips already perfect). The second
  half — surfacing *where* the model is unsure — **is deferred by the owner (2026-07-27)**; the work
  is therefore on reducing errors, and the evidence for what to reduce is below.
- **Round 2 was read once on 2026-07-27. Its apparent regression was a METRIC ARTIFACT, and it
  SHIPPED the same day** as an improvement, not a pass. The macro headline fell 78.0 → 73.9% mean
  AEU F1, but that average gives a 14-gold class the same weight as a 145-gold one. Re-scored on the
  identical strips with low-n-robust measures: **micro recall 83.9 → 84.8%**, **macro≥30 recall
  81.4 → 84.8%**, micro F1 85.0 → 84.8% — flat-to-better, on top of SER 0.059 → 0.052, exact-match
  50.0 → 52.1% and 9 of 11 floors.
- **Live model is `round2-stage2-best` int8** (shipped 2026-07-27). Ship chain all green — parity
  14/14 fp32 + 14/14 int8, browser gate 27/28 with the product (canvas) path clean 14/14. Runtime in
  `apps/web/public/models/`; the Round-1 runtime is backed up at
  `data/checkpoints/_public_models_backup_round1/` (revert = re-stage it).
- **Every eval now reports MICRO and MACRO≥30 beside the macro mean**, and past runs can be
  back-filled with `scripts/rung3/rescore_headline.py` without re-running a model. The macro mean
  stays the pre-registered bar — micro was computed after the fact and flatters us, so promoting it
  now would be moving the goalposts ([DECISIONS.md](DECISIONS.md)).
- **Accidentals are only 13% of what a user has to fix.** Classifying all 562 exam edits: pitch 40%,
  duration 28%, rhythm signs 13%, **accidentals 13%**, structure 5%. Two rounds went into the 13%,
  because the old headline only measured accidentals. Pitch and duration have never been targeted by
  any synthetic work.
- **Sparse crops are the most expensive shape** — crops with ≤3 notes are 5.5% of exam strips and
  **20.8% of all corrections**. ⚠ **The "the model hallucinates a bar" reading of this was
  DISPROVED on 2026-07-28** (1 of 8 note-free crops invented anything, against a ≥50% bar): it
  cannot *read* them, and the shape is the slicer's own trade-off rather than a rendering gap. The
  `stripExport` fix that used to sit here is dropped — see "Now" and [DECISIONS.md](DECISIONS.md).
- **The sharp diagnosis was right and incomplete.** The label-noise fix killed the one-directional
  küçük→koma fallback exactly as predicted, and küçük-in-signature went **50 → 72%**. What it exposed
  underneath is a **symmetric** koma↔küçük confusion — 8× one way, 7× the other, **all 15 inside the
  `\sig` block**, net `\komaSharp` emission 0. Not a bias any more: a discrimination failure. It
  wrecks `\komaSharp` (F1 21.4%) because n=14, and a six-class mean carries that into the headline.
- **The sharps are read in the KEY SIGNATURE, not on noteheads** (exam gold: 32 in-signature vs 1
  inline). `eval_omr.py` now reports recall split by print position — that split is the only reason
  the signature-only confinement was visible.
- **The photo domain is basically solved.** The wall was the slicer, not the model: a guarded photo
  front-end took yield from 28% to 97% of pages, and hand-labelled photo strips score within ~3–4pp
  of clean pages.
- **`strips_v4` is built and verified** — 40,826 strips / 202 pieces, thin sharps + the
  pixels-vs-labels fix + 23 küçük-bearing pieces − 5 exam pieces; `verify-labels.ts` clean, audit
  PASS. It is sound data; the corpus is not what failed.

Numbers for all of the above: [METRICS.md](METRICS.md). Why things were decided this way:
[DECISIONS.md](DECISIONS.md). Round 2 in full: [rung3/round2.md](rung3/round2.md).

## Next — in order

**The MVP ladder is the live work. Everything under "after the release" is paused, not cancelled.**
Rung-by-rung goals, acceptance checks and state: [mvp/README.md](mvp/README.md).

1. **W4 — slicer stage 1: staves + row normalization** in TypeScript, against the 1,781 manifests
   on disk. **Read [mvp/slicer-port.md](mvp/slicer-port.md) before starting** — function map,
   per-rung acceptance thresholds, and the traps (chief among them: `pyRound()` half-to-even at
   every rounding site, because `30*0.35` and `30*0.75` are exactly 10.5 and 22.5, where
   `Math.round` silently retunes two barline gates).
2. **W5–W6 — barlines, then windowing + the driver.** W6 compares arm A against arm B **pairwise on
   the same strips**, not against the 86.0% level.
3. **W7–W10** — page upload in the app, the W8 confidence decision above, model delivery from HF
   Hub, release.

### After the release (the real-page track, paused)

1. **DONE (2026-07-31): every consumer now reads `_realval_v2`.** `degrade_probe.py` and
   `empty_crop_probe.py` default to it; `staff_geometry_probe.py` gained `--strips-dir` (still
   defaulting to the frozen exam). `make_realval_pool.py` is **not** the selection set any more —
   its `_realval` output is the *base* `--build` extends, and its docstring now says so, because
   pointing an eval at it silently restores the no-hard-tier pool. It also stopped carrying a third
   verbatim copy of the val-split hash and calls `data.is_real_val_piece` (verified: 0 of 444
   pieces change side). Round-1/2 notebooks are left alone — one notebook per round, never
   re-pointed.
   - **Not recoverable, for the record:** the owner's 130 v1 verdicts (**65 ok / 22 fix / 43 bad**)
     did not transfer — no crop survives a re-slice unchanged. What they bought is the confidence
     calibration and the 33% crop-failure rate that sized the 165-row v2 queue.

2. **Decide whether to re-emit the training pools from the new crops.** The re-slice is done (see
   "Now"); this is the separate decision it unlocks, **not** a formality. Re-emitting rewrites the
   manifests the promoted verdicts hang off, so it needs its own `--out` and a look at what moved
   before anything is promoted. Weigh it against the evidence that Round 3's target — pitch (40%)
   and duration (28%) of user edits — is a *synthetic content mix* problem, not a shortage of real
   strips: the current pools already hold 2,330 accepted real strips (nota 1,740, r1 421, tup 169).

3. **The content work in `select_pieces.py`** — eighth/quarter-note mix and bar-line density (owner
   decision 2026-07-27: these only; ties and accidentals stay out). Verify on a 300-strip pilot with
   `domain_gap.py` before regenerating `data/pieces.json`. Guard: check the accidental counts before
   and after on the same pilot and treat a drop as a stop sign, not a trade. Independent of items
   1–2 — it never touches real-val, so it can run alongside the labelling.
4. **Write down what Round 3 must reach, before training starts** — on the user-effort metric
   (≥90% of pages ≤5 corrections; baseline 57%), with micro and macro≥30 quoted beside the macro
   mean. Then render once, train stage 1 once with several cheap stage-2 variants, read the exam
   once.
5. **Deferred by the owner (2026-07-27): the error-localisation UI.** The measurement that would
   justify it is cheap and still owed — per-token logprobs already come out of
   `onnx_greedy_decode(return_logprobs=True)` and `decode_page.py` throws all but min/mean away.
   Pre-registered rule if it is ever picked up: flagging 10% of tokens must catch ≥60% of errors.
6. **Measure the SIGNATURE-packed sharp glyphs.** Every fidelity measurement we have (`sharp_probe`,
   the 0.300 S bar weight, küçük's pitch widened to 0.65 S) was taken on INLINE glyphs. Signature
   glyphs are packed at `SIG_GLYPH_ADVANCE = 13 px`, have never been examined, and hold 32 of the
   exam's 33 küçük tokens — widening küçük's bars may actively hurt where horizontal room is fixed.
   Now a 13%-of-edits problem, so it sits below the pitch/duration work.
7. **Exam v3.** Owed: the 27 over-budget strip recoveries deferred from v2.1, re-validation of
   disjointness whenever the exam grows, and dedupe on SymbTr piece id rather than image stem. Also
   more `\komaSharp` gold — at n=14 the class cannot carry the weight the headline gives it. The
   train-time disjointness guard is already shipped; give v3 a one-time `round1-best` bridge read as
   its baseline. (The low-n weighting it also owed was done on 2026-07-27.)
8. **Extend the train-time exam guard to the SYNTHETIC corpus.** It inspects only the `--real-dir`
   pools today, which is how 5 exam pieces sat in `strips_v3`. `select_pieces.py --exam` now blocks
   them at selection, but the training guard should refuse them too.

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 numerics
investigation — now two instances, a dropped double dot (Round 1) and a dropped `\tup3` (Round 2),
both reference-path only and both fine under Python-ORT int8.

## Open risks and non-claims

- **Real-val orders candidates; it does not predict exam performance.** Measured gap: 28pp.
- **The AEU headline is a per-class mean and is fragile to low-n classes.** A 3-gold class swung it
  ~11pp in Round 1; a 14-gold class swung it 4pp in Round 2 and was the entire reason that round
  read as a regression. MICRO and MACRO≥30 are now reported beside it and are the numbers to compare
  models on — but macro remains the pre-registered bar, so quote all of them.
- **The carry-sig bug is unfixed:** under a signature the model re-states the alteration inline in
  the wrong koma family. It reproduces on synthetic, so it can be iterated on with perfect labels.
  Round 2 weakens the old guess that it explains the komaSharp↔kucukSharp confusion: that confusion
  is now symmetric and confined to the `\sig` block, which looks like a glyph-discrimination
  problem rather than a carry-resolution one.
- **Round 2's three changes are not separable.** Glyph weight, label noise and corpus size all moved
  together, so nothing in that read attributes to one of them.
- **Label noise in the training pools:** ~7% pitch-level content error in nota auto-accepts, ~38%
  structurally noisy tie annotation. A 5% re-audit after Round 1 is owed.
- **Signature-position vs note-position accuracy is now MEASURED** (2026-07-27) and the sharps live
  in the signature: exam gold 32 in-signature vs 1 inline for `\kucukSharp`. Any claim about the
  microtonal sharps has to say which position it is about.
- **Blind spots, stated as non-claims:** `\buyukFlat` has 0 real gold; `\komaSharp`/`\buyukSharp` are
  low-n on the exam; `\tup3` is measured on the common k=1 case only; the exam is a matched
  upper bound (its pieces exist in SymbTr).
- **The correction-loop strategy is now the plan, not a fallback** (goal change 2026-07-27). What is
  still unmeasured is whether error localisation actually saves a user time — that needs a person
  correcting real pages with and without the highlights, not a model metric.
- **Superseded:** there is no pre-registered pivot trigger. Switching to a correction-loop strategy is a
  situational call after the Round-2 exam, not an automatic rule.
- **Browser gate is 27/28** on the live model — one strip's *reference*-path decode drops a `\tup3`
  under an ORT-web int8 numerics wobble (the canvas/product path reads all 14 strips exactly, and
  Python-ORT int8 reads that strip exactly). Measured: the flipped token is a real 69/31 near-tie,
  the only sub-0.99 token in that strip, so the runtime tips a coin rather than corrupting a
  confident read. Not blocking; the strip stays in the gate list so the wobble stays measured.

## Where the detail is

| For | Read |
|---|---|
| Every number, with its date and source | [METRICS.md](METRICS.md) |
| Why a thing was decided, and what overturned it | [DECISIONS.md](DECISIONS.md) |
| The real-page track, step by step | [rung3/README.md](rung3/README.md) |
| Round 1 in full (criteria → A/B → exam → disposition) | [rung3/round1.md](rung3/round1.md) |
| Round 2 so far (photos, sharps, what's open) | [rung3/round2.md](rung3/round2.md) |
| Round 3: what it targets and the checks to run first | [rung3/round3.md](rung3/round3.md) |
| Dated history of everything | [log/status-log.md](log/status-log.md) |
| Plans that were abandoned — do not act on them | [log/superseded.md](log/superseded.md) |
| Plain-English version of this page | [OVERVIEW.md](OVERVIEW.md) |
| How to update this file (and the others) | [MAINTAINING.md](MAINTAINING.md) |
