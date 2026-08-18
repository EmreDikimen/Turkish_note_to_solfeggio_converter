# Backlog — owed, not next, not cancelled

purpose: work that is real and justified but is not the next action; kept out of STATUS so that file can hold only current state and the next move
audience: agents picking up the project with spare capacity, or looking for what was deferred and why

updated: 2026-08-18

Split out of [STATUS.md](STATUS.md) on 2026-08-17 when that file crossed the 400-line cap. Genre
split: STATUS states **current state and the next action**; this file holds **everything owed that is
neither**. Nothing here was dropped in the move.

⚠ **This is not a queue to work down.** Each item carries the reason it is deferred, and several are
deferred because acting on them would confound a measurement in flight. Read the reason before
starting. Abandoned plans are a different thing again and live in
[log/superseded.md](log/superseded.md) — never act on anything found there.

### Cheap, owed, and independent of both

1. **The deskew *estimator* is validated on 132 pages, not the corpus** — every full run injects
   Python's angle. It used to cost ~18 h of browser time; at 1.3 s/page a full un-injected corpus
   run is now well under an hour, so this is worth simply doing.
2. **NEW 2026-08-16 — `_realval_v2` has 5 duplicate manifest rows, 4 with CONTRADICTORY labels.**
   267 rows over 262 distinct images; four PNGs are scored against two unrelated gold strings, so at
   least one of each pair is wrong. Found while checking pad-directory integrity, not by looking for
   it. **Scope is that pool only** — the exam, `_tupletval` and `strips_nota` are clean. It is ~1.9%
   of the pool and it sits inside every recorded `_realval_v2` absolute, including the tuplet A/B's
   guard number. ⚠ It does **not** threaten a paired result (the duplicates are identical in every
   arm and cancel in a delta), which is why the geometry probe's holdout stands. Owed: de-duplicate,
   re-derive, and check whether any other pool built by the same path shares it.
   [METRICS-CORPUS.md](METRICS-CORPUS.md).

3. **NEW 2026-08-18 — "REVIEW UI 2": a PAGE-level correction UI. Designed, costed, and STOPPED by the
   owner on the arithmetic, with the queue half already BUILT and working.** The ask was a tool like
   the app — photo and rendered score side by side, tokens visible, all editor mechanics, plus
   editable `\sig` blocks and a selectable/deletable tuplet mark — to correct real pages page by page
   instead of strip by strip.
   ⛔ **Do not restart it without re-reading the cost case**, which is the reason it stopped:
   the win is concentrated **entirely in the ~1/3 of strips that need a fix** (~45 s of typing a token
   string in `review_ui.py` → ~3 s of dragging a notehead). Checking speed barely moves, because you
   read every note either way. Whole-queue estimate **~175 h → ~55 h**: real, but not the order of
   magnitude that would justify the build.
   ⚠ **Two assumptions that would have justified it were measured FALSE**, and this is the part worth
   inheriting: window **overlap is only 1.15×** (43,586 measure-instances over 38,026 distinct
   measures — there is no "each bar is verdicted three times" redundancy to collapse), and the
   editor's off-meter mark flags **37.8%** of interior bars corpus-wide, so it narrows the duration
   hunt ~2.6× rather than lighting up the errors ([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)).
   ✅ **What survives and is on disk, documented and re-runnable** — the ranking half, which is
   independently useful if page gold is ever wanted: `tools/vision/page-structure.ts` (per-page stitch
   stats, reusing the shipped stitcher and core so the meter rule is not duplicated) and
   `scripts/rung3/build_page_queue.py` (ranks pages by structural error evidence, refuses exam
   pieces, caps per makam). A 150-page queue is built at
   `data/real/rung3/_pagequeue/page_queue.json`.
   ✅ **Update, same day: the ranking IS consumed now** — `build_label_batch.py` reuses its scorer to
   cut page-complete labelling batches for the *existing* strip UI, and `batch2` is live
   ([rung3/labeling-queues.md](rung3/labeling-queues.md)). What stays deferred is only the **page-level
   UI**, i.e. the expensive half the cost case stopped. The ranking earning its keep in a cheaper
   consumer is the reason it was kept rather than deleted.
   ⚠ The strongest remaining argument for ever building it is **not** throughput: nothing this project
   owns produces **page-level gold**, which is the unit Round 3's signed floor is stated in, measured
   today on 46 pages at ±12 points ([rung3/levers.md](rung3/levers.md) Lever 3). ~150 corrected pages
   would triple the exam. If it returns, it returns for that reason.

### Further out (not next, not cancelled)

1. **DONE (2026-07-31): every consumer now reads `_realval_v2`**; `make_realval_pool.py` is no longer
   the selection set — pointing an eval at its `_realval` output silently restores the no-hard-tier
   pool ([log/status-log.md](log/status-log.md)). **Not recoverable, for the record:** the owner's
   130 v1 verdicts (**65 ok / 22 fix / 43 bad**) did not transfer, since no crop survives a re-slice
   unchanged — what they bought is the confidence calibration and the 33% crop-failure rate that
   sized the 165-row v2 queue.

2. **The error-localisation UI — deferred 2026-07-27, then DROPPED as W8 on 2026-08-05.** The
   measurement is done and it is the reason it was dropped: flagging 10% of tokens catches 26.3% of
   errors against a ≥60% bar. Per-token logprobs already come out of
   `onnx_greedy_decode(return_logprobs=True)`; `decode_page.py` still throws all but min/mean away.
   If it is ever picked up again, per-TOKEN localisation is the version worth building.
3. **Measure the SIGNATURE-packed sharp glyphs.** Every fidelity measurement we have (`sharp_probe`,
   the 0.300 S bar weight, küçük's pitch widened to 0.65 S) was taken on INLINE glyphs. Signature
   glyphs are packed at `SIG_GLYPH_ADVANCE = 13 px`, have never been examined, and hold 32 of the
   exam's 33 küçük tokens — widening küçük's bars may actively hurt where horizontal room is fixed.
   Now a 13%-of-edits problem, so it sits below the pitch/duration work.
4. **Exam v3.** Owed: the 27 over-budget strip recoveries deferred from v2.1, re-validation of
   disjointness whenever the exam grows, and dedupe on SymbTr piece id rather than image stem. Also
   more `\komaSharp` gold — at n=14 the class cannot carry the weight the headline gives it. The
   train-time disjointness guard is already shipped; give v3 a one-time `round1-best` bridge read as
   its baseline. (The low-n weighting it also owed was done on 2026-07-27.)
5. **Extend the train-time exam guard to the SYNTHETIC corpus.** It inspects only the `--real-dir`
   pools today, which is how 5 exam pieces sat in `strips_v3`. `select_pieces.py --exam` now blocks
   them at selection, but the training guard should refuse them too.

6. **⬆ THE FEATURE TRACK LEFT THIS SECTION on 2026-08-15**, and finished on 2026-08-16 — F0, F2, F1
   and F3 are all built. This line stays only to say where it went: [features/README.md](features/README.md).
   ⚠ One caveat from here still holds and is recorded there: F3 was supposed to be aimed by what the
   friends say next, and it was built on the owner's own call instead — they were asked once (W10),
   said "more instrument sounds", and F1 delivered that. **The audio is settled** (2026-08-09): drums,
   clarinet, violin and kanun all shipped under **CC0**, licences read per file, no NC anywhere;
   **ney alone** still needs the owner's own recording, and oud and tanbur stay Karplus–Strong.
   Files: [features/audio-sources.md](features/audio-sources.md).

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 numerics
investigation — now two instances, a dropped double dot (Round 1) and a dropped `\tup3` (Round 2),
both reference-path only and both fine under Python-ORT int8.

