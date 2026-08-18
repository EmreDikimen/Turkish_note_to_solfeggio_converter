# Standing findings — the real-page track, established and still true

purpose: the settled context behind the model track — what is already known, so STATUS can hold only "now" and "next"
audience: agents and the owner working the real-page track
updated: 2026-08-17

> Moved out of [../STATUS.md](../STATUS.md) on 2026-08-07, when that file crossed its 400-line
> limit. Nothing here is a next action; it is the background a next action rests on. Current state
> and what to do → [../STATUS.md](../STATUS.md). Dated history → [../log/status-log.md](../log/status-log.md).

---

## Previously (real-page track — all still true)

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
- **All of the re-slice is now REVIEWABLE (2026-07-31).** `scripts/rung3/build_reslice_queue.py`
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

## Previously (Round 3 pre-render checks, 2026-07-28)

**All four hypotheses were RUN against the shipped model, with no training and no re-render. Three
died.** Dropped, measured, do not re-propose: rendering the odd crop shapes, cutting wide crops
narrower (**+31.8% edits**), thinning beams. Still standing: the content work — eighth/quarter-note
mix and bar-line density in `select_pieces.py`. ⚠ **A FIFTH check was added 2026-08-15** — the
encoder's input geometry, the first one not about what we draw. It came back causal, its follow-up
pilot was **stopped 2026-08-17**, and the owner then put **Lever 4 (renderer diversity)** in front of
the content work, which stays behind all of it. Ranked menu and the live order: [levers.md](levers.md).
`USUL_BEAM_GROUPS` remains **unvalidated and
quarantined** (the beam check measured thickness, not grouping) and `staff_jitter` is insurance, not
a fix. Full detail: [rung3/round3.md](round3.md); why each was dropped:
[DECISIONS.md](../DECISIONS.md).

## Previously (moved out of STATUS 2026-08-16 — settled, no next action here)

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
comparison sheet and its ⚠ local-viewing-only caveat: [tuplets.md](tuplets.md).

[../METRICS.md](../METRICS.md) · [../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md).

✅ **The control also answered a question nothing else could**: it scored **85.2%, exactly
`round2-stage2-best`'s score on the same pool** — so `staff_jitter`, the rasterizer drift and a fresh
training environment moved this class by **zero, together**. Only learnable by training the arm.
⚠ Reading the misses afterwards produced a **lead** worth more than the A/B did — Track B item 1e.

⚠ **`data/pieces.json` is stale and cost a full corpus render.** `strips_v4` and `data/split_v4.json`
were both built from **`data/pieces_v4.json`** (208 pieces vs 190), but the documented command named
the older file. The wrong render completed and looked normal — 23 of Round 2's pieces missing, 528
strips in neither side of the split, dropped in silence at train time. Fixed beside the command in
[../../CLAUDE.md](../../CLAUDE.md).

## Previously (Round 2, still true)

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
- **Live model is `round2-stage2-best` int8** (shipped 2026-07-27) — ship chain all green: parity
  14/14 fp32 + 14/14 int8, browser gate 27/28 with the product (canvas) path clean 14/14. Runtime in
  `apps/web/public/models/`; Round 1 is backed up at
  `data/checkpoints/_public_models_backup_round1/` (revert = re-stage it).
- **Every eval now reports MICRO and MACRO≥30 beside the macro mean**; past runs back-fill with
  `scripts/rung3/rescore_headline.py`. The macro mean stays the pre-registered bar — micro was
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
[DECISIONS.md](../DECISIONS.md). Round 2 in full: [rung3/round2.md](round2.md).
