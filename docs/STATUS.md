# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-09-03

## Now

⛔ **ROUND 3 IS READ AND IT MISSES. THE EXAM PRIMARY IS 51%** (2026-09-01), against a floor signed
at 75% (62% on the re-expressed reading) and a Round-2 baseline of **44%**. At 63 pages the 95%
half-width is ~±12 pp, so **+7 is inside the noise band**. ⚠ The primary rose while every strip-level
metric went flat or slightly down (exact 75.2% → 74.2%, per-class F1 84.5% → 78.0%): the distribution
tightened at the *median* (6 → 5 edits/page) while the *mean* barely moved.
⛔ **AND ~15 OF THE 17 POINTS IS THE `\tie` RETIREMENT** — strip it and the gap is **+2 pp**. The
residual, by token class, is **note/rest −15 and sig-marker −8** against **tuplet +1, accidental +2,
barline +2** — ⛔ **every class the three render flags targeted is flat or slightly WORSE**, and what
improved is consistent with the real pool growing 72%, not with the render.
[METRICS-EXAMSET.md](METRICS-EXAMSET.md).

⭐ **THE OWNER HAND-TESTED IT AND THE VERDICT IS "BETTER, NOT ENOUGH TO SHIP" (2026-09-01).** The
model is exported, int8-quantized and staged locally (`apps/web/public/models/`, `apps/server/models/`)
for that test; **nothing is published** and the live site is still Round 2. Round 2 is backed up at
`apps/web/public/models/_round2_backup/`. §3c's ship call is a human judgement, and it was taken.

⭐ **RUN A IS TRAINED AND ITS QUESTION IS ANSWERED: a longer stage 2 helps a little, and the gain is
exhausted by step ~2,500** (2026-09-01). One variable against the Round-3 final run — stage 2 at
**4,000 steps instead of 2,000**, starting from Round 3's OWN stage-1 checkpoint so nothing else moves.
Real val **0.0182 → 0.0171 (−6.0%)**, the minimum shifting from step 1750 to **2500**, then flat and
drifting slightly UP for the last 1,500 steps. ⚠ **A teacher-forced loss, not a correction count** —
Round 3's `+13.7 pp` on real-val turned out to be almost all `\tie`, so 6% of loss may be worth no
edits at all. ⚠ "2,500" does not transfer as a step count: it is step 2,500 *of a 4,000-step cosine*.
⭐ **That question is now answered, and the answer is zero: 6% of loss bought NO edits** (15 strips
better, 15 worse, p = 1.000). Quote it whenever a loss curve is used to argue for a change.
[../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md) · raw logs `round3_runa_logs.md`,
`round3_runb_logs.md`.

⛔ **THE CHECKPOINT SELECTOR FAILED AGAIN, HARDER — `best` WAS STAMPED AT STEP 250.** The first
evaluation of stage 2, after 250 steps of real specialisation, and no later mix ever beat it (Round 3
at least reached step 500). ⭐ **`best-real`, added the same day, is the only reason the run produced
anything usable**: `best` is barely specialised and `last` (step 4,000) is past the minimum. ⛔ **AND A THIRD TIME ON RUN B — where the wrong pick was `best-real` ITSELF.** B's `last` (step
5,000) beats its own `best-real` (step 1,250), 645 edits to 694. `best-real` is only as good as the
pool it reads, and B's real-val pool is **30% retired-crop strips**. Three runs, three wrong picks.
[BACKLOG.md](BACKLOG.md) item 3 · [METRICS-ROUND3-RUNS.md](METRICS-ROUND3-RUNS.md).

⚠ **`GEOMETRY_REV` → 20260903: EVERY DECODE CACHE ON DISK IS NOW REFUSED** (2026-09-03). Two slicer
fixes moved crop boundaries the same day: a closing `:|` read as two barlines (junk strip on ~1% of
rows, `OMR_TAIL_SPAN=0` restores) and **a note stem taken for a barline** (`END_BLOBS`, below,
`OMR_END_BLOBS=0` restores; the `end_blobs` geometry key tells the two apart under one rev). The next
emit re-decodes; nothing is owed today. [METRICS-SLICER-FRAME.md](METRICS-SLICER-FRAME.md) · [METRICS-SLICER-STEMS.md](METRICS-SLICER-STEMS.md).

⏭ **THE NEXT ACTION IS AN OWNER DECISION, AND IT IS NOT ANOTHER TRAINING RUN.** Three paired reads
now say the same thing: `r3-final-stage2-last` is the model we have, and both cheap levers are spent.
What is NOT spent, in the order the evidence supports it:
1. **The label-budget rail** — **4,012 over-budget strips** are dropped from training and dense music
   already reads twice as badly (9.9% vs 4.8%, p = 0.013). It is the only remaining lever with a
   measured mechanism behind it, and it is what RELEASES the exam. [BACKLOG.md](BACKLOG.md) item 0.
2. **The `\sig` circularity** — every `\sig` block in a real-page label is unverified, and the
   emitter's model vote fired on 24 of 45 exam pieces. [BACKLOG.md](BACKLOG.md) item 9.
3. **The selector** — three wrong picks in three runs; a Round-4 recipe change, not a patch.
⛔ **Not the exam.** It was read for this round on 2026-09-01, runs A and B are the SAME round, and a
re-read decided *after* seeing these numbers is the one option that is not clean.

⛔ **RUNS A AND B ARE BOTH READ, AND BOTH ARE NULLS — ROUND 3's SHIPPED CHOICE STANDS**
(2026-09-02). On the same 262 `_realval_v2` strips, paired: Run A `best-real` **656 edits** and Run B
`last` **645**, against `r3-final-stage2-last`'s **667**. Every CI spans zero, every sign test is a
null, and exact-match moves 68.3% → 69.1% → 69.5% — a spread of **3 strips**. ⭐ Neither a longer
stage 2 nor a second cut of the same music on retired crops moves real-page accuracy.
[METRICS-ROUND3-RUNS.md](METRICS-ROUND3-RUNS.md).

✅ **RUN B RAN — `strips_b8` + `strips_oldhuman` at `:4` (34.7% real), 5,000 stage-2 steps** (the
step count is the owner's, 2026-09-01; Run A ran 4,000, so B differs from A in two places, not one).
Notebook: `notebooks/round3_runb_oldstrips_colab.ipynb`, reusing Round 3's stage 1 like Run A.
⛔ **Its `real` val column is NOT comparable with Run A's** — a second pool means a second held-out
set, so B evaluates on **560** strips (170 of them retired-crop) where A used **390**. A higher
number there is a harder exam, not a worse model. [METRICS-ROUND3-RUNS.md](METRICS-ROUND3-RUNS.md).

⚠ **RUNS A AND B ARE THE SAME ROUND AS THE EXAM READ** (owner, 2026-09-01: *"round 3 is not over. I
will make 2 new trainings"*). The exam was read on 2026-09-01 for `r3-final-stage2-last`, and the rule
is **one read per round**. ⛔ A second read is not available without the owner re-opening it
deliberately — and deciding that *after* seeing A's or B's real-val numbers is the one option that is
not clean. Unsettled, flagged, not assumed.

⭐ **THE ROUND-3 MODEL IS `r3-final-stage2-last`** — real-val chose it over `best` (667 vs 784 edits, 39 strips better / 6 worse, sign p = 0.000). Against Round 2 the sign test wins 72 : 22 but the **mean edits/strip CI spans zero and is a NULL**. [METRICS.md](METRICS.md).

⛔ **ROUND 3'S REAL-VAL GAIN WAS THE `\tie` RETIREMENT, NOT BETTER NOTE READING.** Discount the retired token and Round 2 and Round 3 are indistinguishable on `_realval_v2` (271 vs 270 edits). Only **26 of 86 ties (30%)** cost a user anything. Product-relevant estimate: **−7.2% edits / +4.6 pp exact**, not −21.7% / +16.1 pp. Full table and the stitcher accounting: [METRICS.md](METRICS.md).

⭐ **SHORT AND MEDIUM STRIPS ARE THE TARGET (owner, 2026-09-01); LONG STRIPS ARE A FUTURE
CONCERN.** Round 3's gain is confined by length — improve:regress **4.5 : 1** under 30 gold ids,
**4.4 : 1** at 30–49, **1.25 : 1** at ≥50 where it is net negative. ⚠ A **LEAD, not a finding**
(n = 44, one of four groupings inspected). ⚠ The exam drops **41% of candidates** as
`split_wide`/`over_budget`, so it grades each page on its shorter material and may **flatter**
this model. [DECISIONS.md](DECISIONS.md) · [METRICS.md](METRICS.md).

⭐ **THE NEXT ATTEMPT GETS EVERY HAND-VERIFIED REAL STRIP, RETIRED CROPS INCLUDED** (owner,
2026-09-01). This lifts the 2026-08-31 ban on `strips_nota` / `strips_r1` / `strips_tup` **for the
next run only** — the Round-3 final model is trained and its pool is history. ⭐ It adds **1,435
hand-verified strips** (nota 835, r1 428, tup 172, human `ok`+`fix` only) on top of b8's 3,929.
⚠ Those crops come from a slicer the app no longer runs, and much of that music is already in b8 at
the current geometry — so the pools overlap in MUSIC and differ in PIXELS. The owner's argument is
that b8 stays in the mix, so this **adds a second cut rather than replacing the current one**.
✅ **DONE AND ANSWERED 2026-09-02: it bought nothing measurable** (Run B, above). Somebody has now
scored a model trained on mixed crop roots, and it is indistinguishable from one that was not.
⚠ **A null, not a refutation** — at 262 strips a CI half-width of ~±0.13 edits/strip could hide a
small gain; what it rules out is a gain big enough to reopen the exam.
[DECISIONS.md](DECISIONS.md) · [METRICS-ROUND3-RUNS.md](METRICS-ROUND3-RUNS.md) ·
[rung3/worklist.md](rung3/worklist.md) B10.

✅ **Two exam pieces were found in `strips_b8` and removed (7 strips, pool now 3,929).** The emitter matched exam pieces by IMAGE STEM where `train.py` guards on the SymbTr id, so a second engraving passed; both now use the SymbTr id and `promote_labels.py` carries a backstop. Detail: [DECISIONS.md](DECISIONS.md) · `data/real/rung3/excluded_exam_pieces.txt`.

⭐ **ROUND 3'S DATA IS SETTLED AND THE ROUND IS READY TO RUN (owner, 2026-08-31).** Every labelling
question is closed. Round 3 uses **four** things and nothing else: **`strips_b8`** as the real
training pool (3,929 strips after promotion), a **new 3-flag synthetic render** off
`data/pieces_v4.json` + `data/split_v4.json`, **`_realval_v2`** (+ `_tupletval`) to select the
checkpoint, and **`examv3`** to grade. ⏭ **`b8-review`, the old human fixes, `batch3` and
`reslice-all` all go to ROUND 4** — the last two could not join anyway, see below.
[rung3/worklist.md](rung3/worklist.md) · [rung3/labeling-queues.md](rung3/labeling-queues.md).

✅ **THE EXAM IS PROMOTED AND THE BASELINE IS RE-MEASURED ON IT (2026-08-31).** `strips_exam_v3` is
now the exam — **660 strips over 63 pages** (10.5 strips/page against the frozen v2's 7.1);
`strips_exam_v2_clean` stays frozen as Round 2's record. ⭐ **`round2-stage2-best` re-scored on it:
the primary reads 44%**, against 57% on the frozen exam — §3b's precondition 2 is DONE, and it was
measured *before* any Round-3 model exists, which is what keeps §3c's choice legal. ⚠ **The model
did not get worse**: every strip-level number improves sharply (exact 50.0% → 75.2%, AEU recall
78.5% → 90.5%, SER 0.059 → 0.027) and the *per-page* primary still falls, because a page is now
graded on half again as many strips. ⚠ The 13 points mix **three** changes — re-cut crops, more
strips per page, and **19 pages never graded before** — and no split between them is claimed.
[rung3/exam.md](rung3/exam.md) · [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

✅ **Three settled 2026-08-31 findings moved out of this file** — the `b8-full` read and its `\sig` exception, — the promote gate that was deleting hand corrections over an `f'' 32` spacing, and the recovery of the retired pools' 1,479 human fixes by measure span. Both are decision rows in [DECISIONS.md](DECISIONS.md) with their numbers in [METRICS-CORPUS.md](METRICS-CORPUS.md).

✅ **The launch files were fixed 2026-08-31** — the `final`/`finalb` zip arms, the final
run's own notebook and the `:5`-not-`:9` re-measure. Detail: [log/status-log.md](log/status-log.md).

✅ **THE 75%-vs-62% QUESTION IS NOT OPEN — IT WAS SETTLED 2026-08-31, AND WITH A THIRD ANSWER.**
This file carried it as a live binary choice until 2026-09-01; that was stale. The owner's decision
(*"I will look where it makes mistakes and classify the problems. Then decide ship manually"*) is
that **the numeric floor stops being the automatic ship gate**. The primary is still computed and
reported with its interval, and `round2-stage2-best`'s **44%** still stands as the comparison column,
so "better or worse than Round 2" stays a factual question. But the launch call is taken by the owner
after reading an **error classification**. ⛔ **That taxonomy is what now blocks the exam read** —
grouping the exam's mistakes by kind (pitch / duration / accidental / repeat structure / signature)
with examples, not just a rate. `eval_omr.py --show-errors` prints the raw material;
**the grouping is not built**. ⚠ Build and rehearse it on **real-val**, never on the exam — real-val
diagnoses freely, the exam is one-shot.
[rung3/round3-criteria.md](rung3/round3-criteria.md) §3c · [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

✅ **DONE — every run since 2026-09-01 saves three checkpoints (`best`, `best-real`, `last`) and
chooses between them on `_realval_v2`.** That is the mitigation, not the fix: the blend itself is
still 92% synthetic and has now picked wrong three times running. [BACKLOG.md](BACKLOG.md) item 3.

⚠ **THE REBUILT EXAM IS HARDER THAN THE ONE THE FLOOR WAS SIGNED AGAINST.** It grades ~12 candidate
strips a page against 7.1, so a page collects more edits at equal model quality and the primary
reads lower. Fairness is intact — the `round2-stage2-best` re-score puts both models on the same set,
and that re-score is a **precondition of the read** — but what 75% *means* changes.
⚠ **The exam also still throws away the wide and the dense — 567 of 1,369 candidates (41%)** — so it
reads each page on its easier material. Quote it with the result.
[rung3/round3-criteria.md](rung3/round3-criteria.md) §3b · [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

⛔ **`batch3` AND `reslice-all` COULD NOT HAVE JOINED ROUND 3 EVEN IF ASKED.** Neither has any
promotion path, and the reason is structural: **53 of `batch3`'s 66 hand corrections sit on strips
the emitter DROPPED** (`split_wide` / `over_budget` / `row_unaligned`), as do **all 50** of
`reslice-all`'s. Making them usable IS the label-budget rail. [rung3/labeling-queues.md](rung3/labeling-queues.md).

⛔ **THE SHIPPED APP RETURNS SILENTLY WRONG NOTES ON DENSE PAGES. THE FIX IS MEASURED, SPECIFIED,
AND DEFERRED TO ROUND 4 (owner, 2026-08-23) — which is what RELEASES THE EXAM.** The browser slicer
has **no label-budget rail**: at training an over-budget strip is dropped, at inference there is
none, so the model emits `</s>` early and **confidently** — `hitCap` catches **7 of 4,012 (0.2%)**,
and **998 of 1,689 pages (59.1%)** carry such a strip. ✅ Browser-vs-Python parity is **CLOSED**
(132 pages). ⛔ **The rail ALONE is a wash** (under-fill 15.7% → 16.6%, p = 0.57). ⚠ But that tested
INFERENCE on a model never trained under the rail: a split strip *fits the 59-id emitter gate and
therefore enters training*, and today **4,012 over-budget strips are dropped**. ⭐ **Dense music
already reads twice as badly even in a 1-measure strip (9.9% vs 4.8%, p = 0.013)** — a training gap,
not a cutting one. ⏭ The settling experiment is the **pair** — re-emit with the rail → train →
measure — at **b = 57, not 50**. ⭐ Deferring it is what keeps the shipping slicer still, so
`examv3` stays valid. [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) · [BACKLOG.md](BACKLOG.md) item 0.

⭐ **A WHOLE STAFF ROW GOES MISSING ON 14% OF PAGES, AND `STAFF_RESCUE` IS THE FIX — SHIPPING OFF
UNTIL YOU SAY OTHERWISE.** The horizontal opening's kernel is **one pixel tall**, so a staff line
that wanders across rows is **erased, not weakened**; a lost row is not a bad crop, it is **NO
crop**, so no accuracy metric has ever shown it. ⛔ Every global knob was measured and rejected. ✅
What ships is a **second pass** re-detecting only in the bands the page's own staff pitch says are
empty: all **6,440** scored rows identical, **+320 rows on 227 of 1,592 pages**, `parity:slicer`
passes with the flag ON. ⚠ Its benefit is **unscoreable, not merely unmeasured**; the evidence is
visual, 14 of 14 rows on 4 pages. ⚠ `STAFF_RESCUE` must move together in Python and `constants.ts`,
and turning it on bumps `GEOMETRY_REV`. [METRICS-SLICER.md](METRICS-SLICER.md).

⛔ **THE ROW-LEVEL SLICER INSTRUMENTS ARE BLIND TO STAFF-COUNT CHANGES.** Both pair a row to its
cached truth by **system index**, so inserting a staff shifts every later index and reports a large
regression that is pure artifact. `score_slicer.py` gained `--pair-by-position`; ⛔ **`score_barlines.py`
has the same coupling and NO fix** — `bozukNihavendLonga` read **30 marked before a staff change and
3 after**. It is also why the rescue's 320 rows can never be scored there. [METRICS-SLICER.md](METRICS-SLICER.md).

⚠ **THE 2026-08-26 SLICER FREEZE WAS LIFTED TWICE ON 2026-09-03, BOTH TIMES AT THE OWNER'S REQUEST**
— for the trailing-`:|` fix above, and for **a stem taken for a barline** (`nihavendLongaDuzgun`'s
last row cut between a sharp and its note): a stroke with wide ink at BOTH ends is now a stem
(`END_BLOBS`), with width counted beyond the stroke's own thickness so winged repeat bars survive.
⭐ **Priced on two full 6,440-row runs the same day: 3,762 → 4,133 exact (+371), BETTER 502 / WORSE
122; 200 pages lose 388 bars, gain none; parity exact.** Nothing owed on it. [METRICS-SLICER-STEMS.md](METRICS-SLICER-STEMS.md).
The freeze (owner, 2026-08-26) followed three fixes landing and two being rejected — the
browser/Python staff divergence, the over-wide staff span, and
`OMR_BLOB_FILL` 0.3 (measured and **REJECTED**, with the lesson that the faded-page table has now
mispredicted the full run three times); those two shipped fixes were what took `GEOMETRY_REV` to
20260826. ⏭ **Treat the slicer as frozen again unless the owner says otherwise.**
[METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md) · [DECISIONS.md](DECISIONS.md).

⏭ **COLLECTION IS NARROWED TO TWO TARGETS, not broadened.** 2,486 unlabelled page PNGs already sit
on disk, so volume relieves nothing. What it cannot substitute for: pages drawing the **concave
tuplet mark** (unscoreable — no labelled real strip carries it) and **tuplet-dense instrumentals**
(sirto, longa, saz semaisi). ⚠ The second does **not** fix itself — the same budget drops the new
pages. ⚠ **A THIRD target, DEFERRED not dismissed**: every page we own is from **two websites**,
exam included ([BACKLOG.md](BACKLOG.md) item 10).

✅ **ROUND 3 HAS A SIGNED ACCEPTANCE BAR, and it is also the public-launch gate** (owner,
2026-08-15): **≥75% of exam pages needing ≤5 corrections**, against 57% today, with the accidental
measures as no-regression clauses. Written before any Round-3 training and **not re-opened after the
read** — a miss is a miss and the launch waits for Round 4. ⚠ Report the primary **with its
interval**: at 67 pages the 95% half-width is ~±10.4 pp. [rung3/round3-criteria.md](rung3/round3-criteria.md).

✅ **`\tie` IS RETIRED AND BOTH SIDES ARE DONE** (owner, 2026-08-22) — rule and numbers in
[../CLAUDE.md](../CLAUDE.md); ⚠ real-val's arc-`\tup3` diagnostic prints `n/a` (that floor is read on
the **exam**, which keeps its ties). [rung3/labeling.md](rung3/labeling.md).

✅ **TRACK A IS SHIPPED AND LIVE — <https://komavision.netlify.app>.** The 2026-08-30 deploy took out
F1's voices, F2's drums, all three F3 instruments, the sol klarnet, the **repeat drawn as a sign**
with the teslim replayed after every hâne, and a **tuplet mark you can hold**. `smoke:live` passes on
both paths. ⏭ **The next product action, and the only one needing a person, is
[MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) checks 25 AND 26** — is the finger mark in the
right place, and is the kanun's opening mandal plan one you would actually set. ⚠ The trap that
outlives F1: voices ride **`VITE_VOICES_URL`**, the drums ship with the app, and setting
`VITE_AUDIO_URL` in a deploy 404s the drums into synthesis — silently.
[features/README.md](features/README.md) · [log/status-log.md](log/status-log.md).

⚠ **Two copyright items remain open and are both the owner's call**: the samples and the neyzen.com
screenshot are out of HEAD but remain in the **public** repo's git history (clearing them needs a
`filter-repo` rewrite and a force-push), and there is still **no LICENSE file**. [THIRD-PARTY.md](THIRD-PARTY.md).

**The two tracks run in parallel, as re-scoped 2026-08-05:** the product track never trains, the model track never touches the app, and neither waits for the other. [mvp/README.md](mvp/README.md).

## Previously — the settled context

Established findings live in these files, so this one holds only "now" and "next". None contains a next action.

| Track | Settled context |
|---|---|
| Product (W0–W9.7, the server, the shipped features) | [mvp/standing.md](mvp/standing.md) — moved 2026-08-08 |
| Real pages (real-val v2, the re-slice, Round 3 pre-render checks, the Round 2 position, the `\tup3` A/B) | [rung3/standing.md](rung3/standing.md) — moved 2026-08-07 |
| The feature track (F0's scheduler, F2's drums, F1's voices, F3's two instruments) | [features/README.md](features/README.md) + [features/audio-sources.md](features/audio-sources.md) + [features/fingerboard.md](features/fingerboard.md) + [features/kanun-view.md](features/kanun-view.md) + [features/kanun.md](features/kanun.md) |
| What happened on any given day, and why | [log/status-log.md](log/status-log.md) |

## Next — two tracks, running in parallel

Since 2026-08-05 the product and the model advance independently: **the product track never trains,
the model track never touches the app.** Either can be worked on without waiting for the other.

### Track A — the product (W9 → W10 → public)

3. **✅ `Save JSON` IS GONE (owner, 2026-08-30) — and the check that needed it now reads the
   document directly.** The 2026-08-15 decision kept the button for one reason: `smoke:editor` had no
   other way to see what an edit did. That is paid off, not overruled — `window.__omrDoc` sits beside
   the existing `__omrStrips`/`__omrConfig` hooks, `save()` reads it, and both suites pass. **The
   editor's list is complete: steps 1–8 and 10, built, deployed and checked on the production
   bundle.** [mvp/editor.md](mvp/editor.md) · [mvp/standing.md](mvp/standing.md) ·
   [DECISIONS.md](DECISIONS.md).
3b. **✅ F3 IS BUILT (2026-08-16), DEPLOYED (2026-08-18), REBUILT UPRIGHT (2026-08-27) AND DEPLOYED
   AGAIN (2026-08-30).** ⭐ Asking whether its position lines were spaced right exposed a real fault
   one level down — the **string choice** had no notion of a hand and let an ascending line climb one
   string forever; it is now a hand-position model. Account and numbers:
   [features/fingerboard.md](features/fingerboard.md) · [DECISIONS.md](DECISIONS.md).
3c. **✅ F3 HAS A SECOND INSTRUMENT: THE KANUN (2026-08-29), DEPLOYED 2026-08-30.** ⭐ It is not the
   violin view with a different picture: a violin position is a fact about one note, while a mandal
   **stays where it is put**, so this is a state machine over the whole piece — which is what buys the
   piece's **opening mandal plan**, listed in words before you press play.
   [features/kanun-view.md](features/kanun-view.md) · [DECISIONS.md](DECISIONS.md).

3d. **✅ ONE INSTRUMENT PAGE, AND THE PIANO ROLL IS GONE (2026-08-29)**, both the owner's call after
   seeing the kanun. Keman and Kanun now share one tab — **Enstrüman üzerinde** — with a dropdown
   that ⭐ **sets the sound as well as the picture**. `PianoRoll.tsx` is deleted; `PitchRangeNote`
   survives it and is unrelated. ⚠ The tab does **not** set the voice merely by being opened: a
   sampled voice is a 20–35 MB Hub download and "load only on selection" is F1's requirement, so a
   first visit can draw a violin while the default tone still plays. `smoke:editor` **217 ALL PASS**,
   including that picking Kanun moves the transport's own voice. **Deployed 2026-08-30.**
   [features/README.md](features/README.md) · [DECISIONS.md](DECISIONS.md).

   ⏭ **THE NEXT PRODUCT ACTION, and the only one that needs a person, is
   [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) checks 25 AND 26 — the violin view and the
   kanun view, now both behind the one **Enstrüman üzerinde** tab, neither of which any eye has judged** — via `npm run dev:cloud`, then a deploy once
   they pass. Check 25: does the dot sit where your finger would (open strings are the free
   calibration — the dot must be **at** the nut), and do the lines read as information or as clutter?
   Check 26: is the opening mandal plan one you would actually set, does the flash last long enough
   to catch, and is the close-up needed every single time (if so its default should flip)?
   ⚠ Do **not** report the thin high positions as a finding; ~7 px per koma near the nut and less
   above is the shipped photo's known limit, and a higher-resolution bare-neck image fixes it with no
   code change. Everything it built, and the traps inside it: [features/README.md](features/README.md).
   ⚠ **If the look finds something, the fix now needs its own deploy** — the cost of the inverted
   order, and it is small (`deploy:app`, then `smoke:live`). ⚠ `smoke:live` checks neither images nor
   audio; spot-check both by hand after any deploy touching them.
3e. **🚧 THE SOL KLARNET — DEPLOYED 2026-08-30, STILL UNCHECKED IN THE BROWSER (built 2026-08-29).**
   ⚠ **`smoke:editor` covers the clarinet VOICE, not the VIEW** — its DOM contract
   (`#clarinet[data-holes|data-keys|data-lip-reach]`, `[data-omr="clarinet-key"]`,
   `[data-omr="clarinet-lip-tick"]`) is unasserted, unlike the kanun's and the violin's. Confirmed
   pre-deploy by hand only: 6 holes, 18 keys, 5 lip ticks, photo loaded, no page errors.
   ⭐ **THE TABLE IS NOW THE OWNER'S OWN** (2026-08-30), placed note by note in
   `tools/core/clarinet-editor.ts`: **six of nineteen changed, every one a KEY; no hole, no note.**
   The chart's *notes* survived a real sol klarnet; five of my six by-eye key positions did not.
   ⛔ Two earlier wrong turns caught by eye and by no test: a table from **Boehm** diagrams, and
   artwork that went CC0-schematic → own-drawing → **photograph**. ⏭ Next: the **altissimo**,
   Re♭6–Sol6 (seven fingerings the owner is filling in), then the browser checks. [features/clarinet-view.md](features/clarinet-view.md)

4. **⏸ Everything else about speed is DEFERRED to after W10** (owner, 2026-08-06): ship at **~35–55 s
   a page**. Splitting a page across instances (~52 s → ~13 s) is the only option that touches the
   warm wait — the cold start is just 10.6 s of it — and it costs a rate-limiter rewrite plus a
   chunked-vs-unchunked parity check. **The trigger to build it is a friend saying the wait is
   annoying**, which is exactly what W10 is for. Menu and prices: [mvp/latency.md](mvp/latency.md).
5c. **Cheap, independent, and still open — but it is NOT the next action; 3b is.** Read the request
   log now that real users exist. The "every human so far was on a phone" line rests on **n=2** and
   cannot be more than a question ([METRICS-USAGE.md](METRICS-USAGE.md)). The friends' own reads are
   the first data that can move it, and `/decode` is the honest counter (`/health` fires on every page
   open, robots included). "Web first, mobile later" is a **plan**, not a finding, and two friends on
   phones would be evidence against it.
6. **Public launch** — a later rung, gated on Round 3's exam result, not on W10.

⚠ **Items 0, 0b, 1, 2, 5 and 5b are done and retired from this list** — the real drum samples, the
ear-verified stroke tables, the F0+F2 deploy, the copyright redeploy, **W10 itself** (the link went to
two friends, they liked it and asked for more instrument sounds) and **F1's instrument voices**. Each
account is in [log/status-log.md](log/status-log.md), [mvp/README.md](mvp/README.md) and
[features/README.md](features/README.md). ⚠ Traps they left behind, now living elsewhere: `deploy:app`
needs `--filter @turkish-omr/web` or `netlify-cli` publishes **nothing** after a successful build
([mvp/hosting-setup.md](mvp/hosting-setup.md)); **`dev:cloud`, not deploying, keeps the Mac cool**
([../CLAUDE.md](../CLAUDE.md)); ney has **no** CC0 source and oud and tanbur stay Karplus–Strong, and
any instrument past those is aimed by what the friends say next — **not a queue to work down**; and if
the voices should be louder the order is per-voice `gain` → a `Çalgı sesi` slider → **never**
`MASTER_GAIN`.

### Track B — the model (Round 3, UNPAUSED)

Still the **public-launch gate**, and runnable at any time — it shares no file with the feature
track. ⭐ **THE LABELLING IS DONE. What is left is render → train → read, plus three preparations
that need no human judgement.** `round2-stage2-best` stays the runtime until a Round-3 model beats it.

**What Round 3 consumes — settled 2026-08-31 and closed to additions:**

| role | pool | state |
|---|---|---|
| real training | **`strips_b8`** | 3,955 read; **3,936 promoted**, then **3,929** after 7 exam-leaking strips came out |
| synthetic training | the **3-flag render** (`--staccato-noise --concave-tuplet --usul-barline`), `pieces_v4.json` + `split_v4.json` | ⏭ not rendered |
| selection | **`_realval_v2`** (+ `_tupletval` for the free `\tup3` column) | built |
| grading | **`examv3`** | 663/663, 64 pages complete; ⏭ not promoted |

⛔ **Out, by the owner's call or by construction:** `b8-review` (4,738 rows, 450 carrying an old
human fix) → still out; ⭐ **the old pools' hand-verified strips came BACK IN on 2026-09-01** as
`strips_oldhuman` (1,408) for run B; `batch3` and `reslice-all` → later, and *unusable*
before the label-budget rail; `strips_nota` / `strips_r1` / `strips_tup` → **superseded, must not be passed** (same
music, retired crops). `photo-gold`, `batch1`, `batch2` and the historical tabs are in neither.

✅ **EVERY ROUND-3 STEP IS DONE AND THE ROUND IS CLOSED** — pools promoted, corpus rendered, model
trained, checkpoint chosen on real-val, exam read once. The per-step record is in
[log/status-log.md](log/status-log.md) and [rung3/worklist.md](rung3/worklist.md); it is history now,
not a to-do list.

⏭ **THE NEXT ACTION IS TO UPLOAD AND RUN A AND B** (the table in "Now"). Nothing local blocks either.
⏭ Then: choose among `best` / `best-real` / `last` on `_realval_v2`, compare A against B, and only
then decide the exam question above. ⛔ **The exam was read on 2026-09-01 and the rule is one read
per round; runs A and B are the SAME round.**

**The item-by-item detail — what each of B0–B9 is, what it found, and what it still owes — is in**
**[rung3/worklist.md](rung3/worklist.md).** Only the tables above and the next action stay here.


### Owed but not next → [BACKLOG.md](BACKLOG.md)

Genre split: this file holds current state and the next action; a backlog is neither. Every deferred
item lives there with the reason it is deferred — ⚠ and several are deferred *because* acting on them
would confound something in flight, so read the reason before starting one.

## Open risks and non-claims

Moved to **[RISKS.md](RISKS.md)** on 2026-08-17, when this file crossed the 400-line cap. Genre split:
this file states current state and the next action; standing caveats are neither.

⚠ **Read it before quoting any number or believing any green check.** It carries, among others: the
±12-point interval on Round 3's primary floor, why a cold start has never been measured on a genuinely
idle service, why real-val orders models but does not predict the exam (28 pp), why the AEU headline
is fragile to low-n classes, and the four things that separate a Round-3 model from
`round2-stage2-best`.

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
