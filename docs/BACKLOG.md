# Backlog — owed, not next, not cancelled

purpose: work that is real and justified but is not the next action; kept out of STATUS so that file can hold only current state and the next move
audience: agents picking up the project with spare capacity, or looking for what was deferred and why

updated: 2026-08-20

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

3. **NEW 2026-08-20 — `best` is chosen 94.6% on SYNTHETIC val loss. Re-weight the selector, or
   select on a real metric.** Raised by the owner asking what the every-500-steps evaluation actually
   reads. `train.py` blends the two val losses by strip count, so at the default `--real-val-frac
   0.10` the synthetic val pool (4,769 strips) outvotes the real one (271) nineteen to one — in a
   round whose acceptance bar is a **real-page** number ([METRICS-CORPUS.md](METRICS-CORPUS.md)).
   [rung3/levers.md](rung3/levers.md) Lever 5 named this without a number; the number is what makes
   it actionable. Three fixes, cheapest first: weight the blend deliberately instead of by strip
   count; raise `--real-val-frac` so the real pool is not 271 strips; or select on a **free-running**
   real metric (edits/strip) rather than teacher-forced loss, which is Lever 5's own preferred answer
   and the only one that measures what the round is graded on.
   ⚠ **Deferred, not ignored, for one reason: changing the selector mid-round makes the arms
   incomparable.** `r3-tupnew-stage2-best` was selected under the current blend, so every arm scored
   against it must be too. This lands **after** the staccato arm is read, and it is a Round-4 recipe
   change, not a Round-3 patch.
   ⚠ It does **not** invalidate any paired arm result — an arm and its control share the selector.

4. **NEW 2026-08-20 — the real TRAINING pools are old-slicer crops, and so is the real half of the
   selector.** `strips_nota` / `strips_r1` / `strips_tup` were cut **11–17 July**; the slicer was
   overhauled **25 July** and fixed four more times on **29 July**. On a 5-page re-slice sample **0 of
   30 crops were identical**. So 2,330 training strips, and the 271 val-side strips inside the
   checkpoint selector, are crops the shipped slicer no longer produces
   ([METRICS-CORPUS.md](METRICS-CORPUS.md)).
   ⚠ **This is the concrete half of B8** ([STATUS.md](STATUS.md)), which frames re-emitting as a
   decision about *training* data; the selector consequence is the part that had not been stated.
   ⚠ Do the re-emit with its own `--out` and look at what moved first — it rewrites the manifests the
   promoted verdicts hang off. And note the priority: fixing these crops without touching the blend
   above improves **5.4%** of the number that picks `best`.

5. ✅ **PROMOTED OUT OF THIS FILE 2026-08-20 — the dotted (usul) barline goes into the FINAL
   RENDER, drawn LABEL-FREE.** The decision, its two halves and what is given up are in
   [DECISIONS.md](DECISIONS.md); the work is tracked in [STATUS.md](STATUS.md). The description below
   is kept because it is the diagnosis, and because the *token* half of it is still owed to Round 4.
   ⚠ **What changed:** this item was deferred behind the render-slot rule; the staccato arm's read
   has happened and the same-shape argument is now backed by a trained result. It is also the only
   deferred item the owner is paying for **by hand** — ~1 in 5 of `batch3`'s corrections so far is
   deleting a false `\repstart`.

   **The diagnosis, as written:** the DOTTED (usul) BARLINE has no token and is never drawn, so the
   model reads it as `\repstart`. Owner-found while labelling `batch3`, then measured: **117 of 1,499 rows
   (7.8%)** decode a `\repstart`, and of the 23 judged so far **13 had it removed as wrong**
   ([METRICS-UNSEEN.md](METRICS-UNSEEN.md)). Turkish editions print a dotted barline to mark
   usul subdivisions inside a measure; `ADDED_TOKENS` has no spelling for one and the renderer draws
   only single and repeat barlines, so **0 of 40,826 strips** contain one and the nearest thing the
   model knows is a repeat sign — a line plus *dots*.
   ⭐ **This is the same structural hole as the staccato one** (Lever 6) — and as of 2026-08-20 that
   matters more than it did, because the staccato arm **ran and took its primary from 72.7% to 0.0%**
   while the three realism arms beside it were all nulls. **A hole responds to being filled; a domain
   gap does not** ([rung3/staccato-arm.md](rung3/staccato-arm.md)). Same shape as the signature-only
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
   labelling ([DECISIONS.md](DECISIONS.md)).
   ⚠ **Cheap first step, no render**: count dotted barlines across the real pools with a probe, the
   way the tuplet mark was counted. 7.8% of one batch is a decode statistic, not a print frequency.

6. **NEW 2026-08-18 — "REVIEW UI 2": a PAGE-level correction UI. Designed, costed, and STOPPED by the
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

7. **NEW 2026-08-20 — MEASURE THE 59-id DECODER BUDGET. It is a setting, not an architectural
   limit, and it is the only item on this list that pays THREE times.** `MAX_IDS = 59` in
   `src/vision/audit_coverage.py` exists because the base weights' `generation_config.max_length` is
   **60**; `src/vision/data.py` truncates training targets to it and every emitter drops a strip that
   exceeds it. The comment beside it — *"cannot be raised without breaking training"* — is true of
   **existing checkpoints**, which is not the same as true of a model trained from base, and the final
   render trains from base anyway. What raising it would buy, all three already measured:
   - **the exam**: 78 of its 282 dropped strips are over-budget alone ([METRICS-EXAM.md](METRICS-EXAM.md))
   - **the tuplet repertoire**: 39.4% of triplet-bearing *single* measures blow it, 80.5% of 2-measure
     and 92.9% of 3-measure windows — which is *why* sirto/longa/saz semaisi are unmeasured
     ([rung3/labeling.md](rung3/labeling.md) §1c, [rung3/round3-criteria.md](rung3/round3-criteria.md) §5)
   - **training data**: 2,108 over-budget drops plus the `split_wide` pile
   ⏭ **The step to take is a measurement, not a change**: run the real tokenizer over the existing
   drop lists and report how many fit at **90** and at **120** ids. One script, no GPU, no render.
   ⚠ **Do not raise it as part of the final render.** The cost side is unpriced — longer targets mean
   more decode steps per strip in the browser *and* on Cloud Run, and more training memory — and it
   would change every pool, every manifest and the shipped latency at once. It is a **Round-4**
   change that a Round-3 measurement can justify.

8. **NEW 2026-08-20 — audit 100 crops from the CURRENT slicer before pouring more hours into
   labelling.** The evidence that the slicer's throw-away rate is the bottleneck is scattered across
   four files and has never been put in one place or re-measured on today's code: **33% of crops
   unusable** in the first `realval-hard` queue (43 of 130), **13,975** strips dropped corpus-wide for
   `row_unaligned`/`nd_high`, **2,108** over-budget, and `batch3`'s own cut excluded **24%** of the
   pages it checked as stale. ⚠ Every one of those numbers is from the OLD slicer or from a queue
   build, so none of them says what today's code does. ⏭ Draw 100 random crops from a current
   re-slice, look at them, and report the unusable rate. If it is still ~1 in 3, the slicer outranks
   labelling and this file's item 4 stops being a cleanup and becomes the main line.

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
   ⚠ **ADDED 2026-08-20 — the exam's crops are OLD-SLICER output too** (`strips_exam_v2_clean`, cut
   **17 July**, against the 25/29 July overhaul), so **the launch gate is measured on crops the
   shipped slicer no longer produces** ([METRICS-CORPUS.md](METRICS-CORPUS.md)). That is a decision to
   take **before** the one-shot read, not after — re-cutting the exam afterwards would either waste
   the shot or invite re-reading it, and the one-shot rule is what makes the number mean anything.
   ⚠ It cuts both ways and neither direction is measured: the exam carries retired defects the
   current slicer has fixed (flattering), while crops over 1200 px went **13.8% → 27.8%** on the same
   67 pages under the new slicer, so production sits further into the bad end than the exam shows
   ([METRICS-GEOMETRY.md](METRICS-GEOMETRY.md)). ⚠ Growing the exam and re-cutting it are the same
   job — do them in one pass or the disjointness re-validation runs twice.
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

