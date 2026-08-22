# Round 3 — the worklist, item by item

purpose: what each Round-3 work item B0-B9 is, what it found, and what it still owes
audience: whoever is picking up a Round-3 item and needs its state and its traps

updated: 2026-08-23

> **This file does NOT state what is next.** The ordered table and the current next action live in
> [../STATUS.md](../STATUS.md), which is the only file allowed to say either. This one holds the
> per-item detail so that file can stay a summary.

Split out of [../STATUS.md](../STATUS.md) on 2026-08-23 when it crossed the 400-line cap. The split
is the one [../MAINTAINING.md](../MAINTAINING.md) asks for: **STATUS keeps current state and the
next action; work goes in the track doc it belongs to.** Nothing was dropped in the move.

**B0. ⏭ THE EXAM REBUILD — LABEL `examv3`. Highest-value labelling on the board, and it BLOCKS the
   read.** ✅ **166 rows are read**: all 139 of `examv3-full` and all 27 `gold_conflict`.
   ✅ **UNPAUSED 2026-08-23** — it sat at 62 of 663 only because a slicer change would force a re-cut,
   and the label-budget rail is now deferred to Round 4 ([../DECISIONS.md](../DECISIONS.md)), so the
   crops are stable and no row is spent twice. ⚠ A Round-4 re-cut will still cost something, but not
   everything: gold carries by measure span (**221 of 326** last rebuild, each a suggestion needing
   confirmation). **Label PAGE-COMPLETE** — the primary counts corrections per page, so a
   half-labelled page under-counts its own errors.
   ⚠ **Crops live in `data/real/strips_examv3`**, so `promote_labels.py` needs
   `--strips-root data/real/strips_examv3` — the default root holds the same filenames with the
   retired slicer's pixels. ⚠ **The ceiling is 64 pages**: 3 drop every candidate as `split_wide` /
   `over_budget`. ⚠ About **1 row in 9 is unwinnable at 59 ids** — the red OVER BUDGET line means
   `bad`, not a correction worth typing.
   ⏭ **Before the read**: re-score `round2-stage2-best` on the rebuilt exam, and settle what the 75%
   floor means on a harder instrument. [rung3/exam.md](exam.md).

**B1. ✅ `batch3` IS CUT AND OPEN — 54 pages / 1,499 strips from the SCANNED tier** in `review_ui.py`
   (`batch3` tab, crop root `data/real/strips_v2`); 28 pages excluded over four rounds (11 handwritten,
   **17 stale = 24% of those checked**), 0 void. ⚠ **Training only** — the ranking selects the worst
   pages in its tier, so nothing cut here may become exam gold.
   [rung3/labeling-queues.md](labeling-queues.md).

**B2. ⏭ THE OWNER HAND-CORRECTS REAL LABELS — and the probe is IN: `batch3` pays better than any queue
   before it.** 114 of 1,499 judged, **66 fix / 39 ok / 9 bad ≈ 58% fix rate**, against ~30% in the
   scanned nota pool and ~12% in `batch2`; bad rate 7.9% against `realval-hard`'s 33%, so no
   impact-score cap is needed. The case is unchanged — pitch is 40% of what a user corrects, so dirty
   pitch labels cap the metric Round 3 is graded on no matter what the renderer does.
   ⚠ **Attend to PITCH AND DURATION, not accidentals** — that axis has never been audited.
   ⚠ **B0 outranks this for a scarce evening** (above), and ⚠ **~1 in 5 of these fixes is deleting a
   false `\repstart`** — hand-payment for a hole the final render now closes, so expect the fix rate
   to fall once a model trained on that render reseeds the queue.
   ⚠ The 531 existing `fix` verdicts are **stranded on old crops**: they evidence bad auto-derived
   labels, they are not corrections we can bank ([METRICS-SLICER.md](../METRICS-SLICER.md)).
   ⚠ Only the **final** model consumes this work, so the arms never waited for it.
   ✅ **The promotion embargo is LIFTED (2026-08-20)** — both arms are read, so `promote_labels.py`
   and B8 are unblocked, and promoting *before* the final render is the point of B2.

**B3. ✅ ARM 1 — THE SCAN PROFILE: RAN, NULL, DECIDED — nothing to do.** **`scan_share` stays OFF**
   (owner, 2026-08-19), which is its default. [rung3/scan-profile.md](scan-profile.md) · raw log
   [round_3_scan_logs.md](../../round_3_scan_logs.md).

**B4. ⛔ ARM 2 — ONE MEASURE PER STRIP: DROPPED, not deferred.** Reasoning in "Now", decision row in
   [DECISIONS.md](../DECISIONS.md). ⚠ The **short-crop hole** is still the blocking item on the
   crop-geometry axis ([METRICS-GEOMETRY.md](../METRICS-GEOMETRY.md)).

**B5. ✅ ARM 2 — THE STACCATO DISTRACTOR: TRAINED, SCORED, IT PASSES, AND THE FLAG SHIPS** (see
   "Now"). Primary **72.7% → 0.0%** false dots, paired **60–0** (p = 1.7e-18); clause 2 passes, clause
   3 shows no price. **The first Round-3 arm to move its primary.**
   [rung3/staccato-arm.md](staccato-arm.md) · [METRICS-UNSEEN.md](../METRICS-UNSEEN.md).

**B6. ⏭ THE FINAL MODEL, then the exam, read ONCE. The render carries THREE flags and no more.**
   `--concave-tuplet` (a per-piece coin on print evidence, no recall claim), `--staccato-noise` (the
   passed arm) and the new **label-free dotted (usul) barline**. ⛔ **Nothing else joins them** — in
   particular **not** a raised token budget (B9) and **not** the content work (B7).
   ⏭ **Before rendering**: how often does print actually draw a dotted barline? 7.8% is a statistic
   about the model's guesses — ⭐ cheapest honest method is to count them while labelling `examv3`.
   ⏭ **Give the barline its own paired scorer**, cloned from `staccato_falsedot_score.py` (false
   `\repstart` rate instead of false dots). Three flags in one render means a general movement is not
   attributable; the staccato arm survives that because it kept its own instrument, and this makes two
   of the three attributable instead of one.
   ⏭ **During training**: save **two** checkpoints, one under the current selector and one selected on
   a free-running real metric, and choose between them on `_realval_v2` **before** the exam
   ([BACKLOG.md](../BACKLOG.md) item 3).
   ⏭ **Before the read**: B0 must be done, and `round2-stage2-best` re-scored on the grown exam.
   ⏭ **At the read**: add one free column — split `\tup3` recall by first-in-strip vs later, which
   settles the tuplet position lead over the exam's 55 groups ([rung3/tuplets.md](tuplets.md)) —
   and report the primary **with its interval**.
   ⚠ Three flags means a general movement is not attributable to one of them. That was already true at
   ±12 points; the staccato claim survives it because that arm kept its own paired instrument.

**B6b. ⏭ TARGETED COLLECTION — two targets, not a wider funnel** (owner, 2026-08-20, narrowing the
   2026-08-17 collect-broadly call). **2,486 unlabelled page PNGs already sit on disk**, so volume
   relieves nothing. The two things volume cannot substitute for: pages drawing the **concave tuplet
   mark** (no labelled real strip carries it, so nothing we own can score it) and **tuplet-dense
   instrumentals** — sirto, longa, saz semaisi, the Avni Anıl page — which meet two known blind spots
   at once. ⚠ **Collecting the second does not fix it**: the same 59-id budget drops the new pages, so
   it is paired with B9 or it buys drops. Then re-run `build_tuplet_val.py`; today's pool is
   neyzen-heavy, 24 of 28 strips. Sources are listed once, in [DECISIONS.md](../DECISIONS.md). ⚠ Read
   each licence before redistributing ([THIRD-PARTY.md](../THIRD-PARTY.md)); keep refusing exam pieces.

**B9. ⏭ MEASURE THE 59-id DECODER BUDGET — a script, not a change.** ⚠ Read it beside the 2026-08-23
   finding that the 59 is the **emitter's training gate, not an inference cap**: `MAX_TOKENS` is 100
   and `hit_cap` fired on 0 of 202 misfilled strips, so the model stops on its own
   ([../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md)).

   `MAX_IDS = 59` exists because the base weights' `generation_config.max_length` is **60**: a setting,
   not an architectural limit. Run the real tokenizer over the existing drop lists and report how many
   fit at **90** and at **120** ids. It would pay three times — 78 dropped exam strips, the
   tuplet-dense repertoire (39.4% / 80.5% / 92.9% of 1-, 2- and 3-measure triplet windows blow it),
   and 2,108 over-budget training drops. ⛔ **The measurement is Round 3; raising the budget is Round
   4** — the cost side is unpriced (decode steps in the browser and on Cloud Run, training memory) and
   it would move every pool, every manifest and the shipped latency at once.
   [BACKLOG.md](../BACKLOG.md) item 7.

**B7. The content work in `select_pieces.py`** — the eighth/quarter-note mix and bar-line density
   (owner, 2026-07-27: these only; ties and accidentals stay out). **Not cancelled and not superseded
   — sequenced behind everything above**, because the note-value mix changes how wide a measure is and
   would move the geometry variable as a side effect. ⚠ Our strips are already **wider** than the real
   pools' and denser music widens them further, so the selection needs a **strip-width target**, not
   only a note-value histogram; verify on a 300-strip pilot with `domain_gap.py` **before** regenerating
   the list, and treat a drop in accidental counts as a stop sign.
   ⚠ The live list is `data/pieces_v4.json`, and a new selection needs its own filename **and its own
   split** — a piece outside `split_v4.json` is dropped from training in silence. ⚠ It also changes
   which real strips are val-side, so `_realval_v2` and `_tupletval` must be re-checked, not assumed.

**B8. ✅ THE RE-EMIT RAN (2026-08-21) — `data/real/rung3/strips_b8`.** 1,293 non-exam matched pieces,
   current crops (`strips_v2`), `round2-stage2-best` as hint AND gate, **37 minutes** on the laptop:
   1,704 page decodes were reused from the July re-slice, only 16 were fresh. **3,955 accepted strips
   against the old pools' 2,330 (+70%)**, 4,738 in review. The train/test mismatch it existed to close
   is closed — training was the last thing on retired crops.
   ⏭ **It is NOT training data yet — but only ONE thing now stands between:**
   ✅ **(a) `b8-audit` is READ — all 201 rows, 27 fix / 174 ok = 13.4% wrong.** Worth reading: the
   referee trained on these very labels, and v2 sampled 2 of 63 before a later read found 51% wrong.
   ⚠ Not a clean bill — repeat structure is the biggest class (10 of 26) and 2 signature errors are
   [BACKLOG.md](../BACKLOG.md) item 9 inside a training pool. [METRICS-CORPUS.md](../METRICS-CORPUS.md).
   ⭐ **(b) carry the 1,442 human `fix` labels across** — they do **not** come back by themselves. 951
   are recoverable (445 land on an accepted strip covering the same measures, 506 sit in `b8-review`);
   ⛔ carry them by **measure span**, never by filename — 248 match a new strip's *name* while holding
   different music. The old pools are untouched on disk.
   ⭐ **The drop table**: `split_wide` 10,226 + `over_budget` 4,012 = **14,238** against 7,446 for
   alignment — the **budget rail is now the binding limit**, which is why step 4 moved up. Numbers and
   the 98% self-consistency check: [METRICS-CORPUS.md](../METRICS-CORPUS.md) · [rung3/labeling-queues.md](labeling-queues.md).
   ⛔ **The exam is not re-emitted** and keeps the neutral July decode ([DECISIONS.md](../DECISIONS.md)).

⚠ **The musical-form lead is DEAD** (owner retest, 2026-08-17) and must not be re-derived
([log/superseded.md](../log/superseded.md)). ⚠ **A fourth realism arm does not follow from three near
misses** — the three nulls and the one pass are the reason ([rung3/levers.md](levers.md)).
