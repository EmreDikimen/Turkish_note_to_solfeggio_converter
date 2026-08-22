# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-22

## Now

⭐ **THE ARMS ARE DONE AND THE FINAL RENDER IS SPECIFIED (2026-08-20).** Round 3's arm list closed —
one dropped, one null, one **passed** — and the three decisions the final render was waiting on were
all taken in one session. **It carries three flags**: `--concave-tuplet`, `--staccato-noise` and a
new **label-free dotted (usul) barline**. What is left is **render → train → the exam, read once**.
[DECISIONS.md](DECISIONS.md).

⭐ **THE TRAINING POOLS WERE RE-EMITTED ONTO THE CURRENT CROPS (2026-08-21) — `strips_b8`, 3,955
accepted strips against 2,330, in 37 minutes on the laptop.** Training was the last thing still cut by
the retired slicer. ⏭ **It is not training data yet**: the **201-row audit is 58 read / 143 open**
(**15.5% wrong so far**, interim) and the **1,442 human corrections do not carry themselves** (951
recoverable, by measure span and never by filename).
⭐ The drop table now points at the **59-id budget**, not at alignment.
[METRICS-CORPUS.md](METRICS-CORPUS.md) · [rung3/labeling-queues.md](rung3/labeling-queues.md).

⭐ **THE STACCATO ARM PASSED, AND ITS FLAG NOW RIDES THE FINAL RENDER.** False-dot rate **72.7% →
0.0%**, paired **60–0** against its training control (exact McNemar p = 1.7e-18) and **80–0** against
the live model; clause 2 passes, clause 3 shows **no price**. ✅ It ships, and it keeps its **own**
paired instrument, so the claim stays attributable whatever else moved. ⚠ The marks became
*invisible* rather than tolerated, and ⚠ transfer to a **real printed** staccato is **unmeasured**.
[rung3/staccato-arm.md](rung3/staccato-arm.md) · [METRICS-UNSEEN.md](METRICS-UNSEEN.md).

⭐ **THE DOTTED (USUL) BARLINE IS PROMOTED INTO THAT RENDER, DRAWN LABEL-FREE.** The owner found it by
eye while labelling and it measured out: **117 of 1,499 `batch3` rows (7.8%) decode a `\repstart`**,
and **~1 in 5 of the batch's corrections so far is deleting one** — the owner is paying by hand for a
symbol the renderer has never drawn (0 of 40,826 strips), so the model reaches for the nearest thing
it knows, a line plus *dots*. ⭐ It is the **same shape as the staccato hole**, and that now means
something measured rather than argued: **a hole responds to being filled; a domain gap does not**
(72.7% → 0.0% against three nulls). ⚠ **Label-free, not a token** — naming it would make every
existing real gold label silently wrong, since no pool annotates one; drawn without a label it is
consistent with everything on disk and costs **zero new labelling**. The `\dottedbar` token is a
Round-4 question. ⏭ Probe the real pools for the print frequency before rendering — 7.8% is a
statistic about the model's guesses. [BACKLOG.md](BACKLOG.md) item 5 · [METRICS-UNSEEN.md](METRICS-UNSEEN.md).

⭐ **THE EXAM WAS REBUILT ON THE CURRENT SLICER AND LABELLING IT IS THE LIVE JOB (owner, 2026-08-21).**
All 45 pieces / 67 pages re-sliced into `data/real/strips_examv3`; `examv3` holds **663 rows over 64 of
the 67 pages**. ✅ **`examv3-full` is DONE — all 139 auto-written labels read by hand, 13.7% wrong**
(18 fix + 1 bad) against exam v2's **51%** on the identical queue, which is the re-slice paying off.
[rung3/exam.md](rung3/exam.md) · [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

⛔ **AND THAT AUDIT FOUND A BUG WORTH MORE THAN THE EXAM: THE KEY SIGNATURE IS DECIDED BY THE MODEL.**
The owner noticed the fixes were "mostly `\komaSharp` → `\kucukSharp`" — 7 of the 18, all inside
`\sig … \sigend`, all one makam. The signature is the **only** part of a label not derived from
SymbTr: the model reads it off each row-start strip and the majority read **overwrites** the
derivation, the voter is the weak `rung3-labeler`, its koma/küçük confusion is *systematic* so the vote
is unanimous and wrong, and the `nd` gate is **blind to `\sig` blocks by design**. It fired on **24 of
45 exam pieces (53%)** and **406 of 938** `strips_nota` pieces; **8 of 36 exam pieces disagree with our
own makam table**. ⭐ There is a **loop** in it — the misread becomes the label, the label trains the
model — and it lands on the accidental class the headline is most fragile about. ⚠ n=7 in one makam is
a signal, not an error rate. ⏭ [BACKLOG.md](BACKLOG.md) item 9 · [METRICS-CORPUS.md](METRICS-CORPUS.md).

⭐ **THE FROZEN GOLD LARGELY MOVED WITH ITS MUSIC — 221 of 326 labels, not 11.** ⚠ A carried label is
a **suggestion, not a verdict**; `strips_exam_v2_clean/` stays the record of what Round 2 was measured
on. [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

⚠ **THE REBUILT EXAM IS HARDER THAN THE ONE THE FLOOR WAS SIGNED AGAINST, AND THAT NEEDS SETTLING
BEFORE THE READ.** It grades ~12 candidate strips a page against 7.1, so a page collects more edits at
equal model quality and the primary ("pages needing ≤5 corrections") reads lower. Fairness is intact —
the `round2-stage2-best` re-score puts both models on the same set — but **what 75% means changes**.
[rung3/round3-criteria.md](rung3/round3-criteria.md) §3b · [rung3/exam.md](rung3/exam.md).

⚠ **THE EXAM STILL THROWS AWAY THE WIDE AND THE DENSE — 567 of 1,369 candidates (41%)**, so it reads
each page on its easier material. Quote it with the result; it is also a second reason to measure the
decoder budget. [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

⭐ **THE 59-id BUDGET IS A SETTING, NOT A LIMIT — and measuring it is the best-value script on the
board.** It pays **three times**, all measured: **153 dropped exam strips and the 3 pages that cap the
exam at 64**, the tuplet-dense repertoire (39.4% / 80.5% / 92.9% of 1-, 2- and 3-measure triplet
windows blow it — *why* sirto/longa/saz semaisi are unmeasured), and 2,108 over-budget training drops.
⏭ **The step is a MEASUREMENT**: how many drops fit at 90 and at 120 ids. No GPU, no render.
⛔ Do **not** raise it inside the final render — the cost side is unpriced. [BACKLOG.md](BACKLOG.md) item 7.

⏭ **THE FINAL RUN SAVES TWO CHECKPOINTS AND CHOOSES BETWEEN THEM ON REAL-VAL.** `best` is selected on
a val loss that is **94.6% synthetic** (4,769 strips outvoting 271, nineteen to one) in a round graded
on real pages. The fix was deferred because changing the selector mid-round makes the arms
incomparable — **the arms are now read**, so rather than swapping it (a second uncontrolled change) the
final run keeps the current selector *and* additionally keeps one selected on a free-running real
metric, comparing them on `_realval_v2` **before** the exam. Legal by the standing rule: real-val is
the selection set, the exam is one-shot. [BACKLOG.md](BACKLOG.md) item 3 · [DECISIONS.md](DECISIONS.md).

⏭ **COLLECTION IS NARROWED TO TWO TARGETS, not broadened.** 2,486 unlabelled page PNGs already sit on
disk, so volume relieves nothing. What volume cannot substitute for: pages drawing the **concave
tuplet mark** (unscoreable — no labelled real strip carries it) and **tuplet-dense instrumentals**
(sirto, longa, saz semaisi — a measured structural hole, not a taste). ⚠ Collecting the second does
**not** fix it on its own: the same budget drops the new pages, so it is paired with the ceiling
measurement or it buys drops. ⚠ **A THIRD target was raised 2026-08-22 and DEFERRED, not dismissed**:
every page we own is from **two websites**, exam included ([BACKLOG.md](BACKLOG.md) item 10).

⛔ **ARM 2 (one measure per strip) IS DROPPED and ARM 1 (the scan profile) WAS A NULL** — what drops a
strip is the **59-id budget**, not width, and the scan profile moved nothing on the medium it was built
for, so **`scan_share` stays off**. [rung3/scan-profile.md](rung3/scan-profile.md) ·
[METRICS-GEOMETRY.md](METRICS-GEOMETRY.md).

⚠ **THAT IS THREE NULLS ON ONE AXIS AND ONE PASS OFF IT.** Tuplet mark p = 0.688, the second
engraver's domain gap, the scan profile — all "make the synthetic pixels look more like real pages".
The staccato arm asked a different question and is the only one that moved its primary, so **a fourth
realism arm does not follow**, and the dotted barline counts because it is a hole rather than a gap.
⚠ **Lever 4 gets no arm and no corpus**: its gate passes 312/312 but the domain gap did not move, and
four recipe items are owed first. [rung3/levers.md](rung3/levers.md) · [METRICS-ENGRAVER.md](METRICS-ENGRAVER.md).

⛔ **THE TUPLET *DRAWING* THREAD IS CLOSED AND NO ARM BELONGS TO IT.** The A/B was null; the shape is
kept on the print measurement alone. Two items survive, neither costing a render: the **position lead**
(96% → 81% across a passage, in both arms), settled free at the exam read, and the concave mark — a
per-piece coin with **no recall claim**. [rung3/tuplets.md](rung3/tuplets.md).

⛔ **LEVER 1 IS SPENT.** The padding probe was causal (+59%, holdout +61%) but the reverse cannot be
bought — crops narrower than one measure measured **+31.8% worse**, tripping the stop rule at **5.4×**;
the **short-crop hole** blocks this axis. ⚠ "Resolution was ruled out"
([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)) was measured on per-class recall, never against the
**edit budget** — both stand, they measure different things. [METRICS-GEOMETRY.md](METRICS-GEOMETRY.md).

✅ **ROUND 3 HAS A SIGNED ACCEPTANCE BAR, and it is also the public-launch gate** (owner, 2026-08-15):
**≥75% of exam pages needing ≤5 corrections**, against 57% today, with the accidental measures as
no-regression clauses. Written before any Round-3 training and **not re-opened after the read** — a
miss is a miss and the launch waits for Round 4. ⚠ §3b now records that the exam grows *before* the
read and that the baseline column is re-measured with it; the floors do not move.
[rung3/round3-criteria.md](rung3/round3-criteria.md).

✅ **TRACK A IS SHIPPED AND LIVE — <https://komavision.netlify.app>.** F1's instrument voices, F2's
drums and F3's violin fingerboard are all deployed. ⛔ **The fingerboard went out without check 25, its
written pre-condition** — skipped on the owner's instruction, so **nothing about it has been seen by a
person**, and every automated check reads the same geometry the drawing does. That look is Track A's
next action. ⚠ The trap that outlives F1: voices ride **`VITE_VOICES_URL`**, the drums ship with the
app, and setting `VITE_AUDIO_URL` in a deploy 404s the drums into synthesis — silently.
[features/README.md](features/README.md) · [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md).

⚠ **Two copyright items remain open and are both the owner's call**: the samples and the neyzen.com
screenshot are out of HEAD but remain in the **public** repo's git history (clearing them needs a
`filter-repo` rewrite and a force-push), and there is still **no LICENSE file**.
[THIRD-PARTY.md](THIRD-PARTY.md).

⚠ **Every human who has used the deployed app was on a phone, and n is still 2.** This is the first
evidence touching "web first, mobile later" and it is **a question, not a finding**; `/decode` is the
honest counter, since `/health` fires on every page open. [METRICS-USAGE.md](METRICS-USAGE.md).

**W8 (confidence highlighting) is DROPPED** — its pre-registered bar was not met and the bar was not
moved to fit. That leaves half of the 2026-07-27 goal unbuilt, and this line is the saying-so.
Measurement: [mvp/standing.md](mvp/standing.md).

**The two tracks run in parallel, as re-scoped 2026-08-05:** the product track never trains, the model
track never touches the app, and neither waits for the other. [mvp/README.md](mvp/README.md).

## Previously — the settled context

Established findings live in these files, so this one holds only "now" and "next". None contains a next action.

| Track | Settled context |
|---|---|
| Product (W0–W9.7, the server, the shipped features) | [mvp/standing.md](mvp/standing.md) — moved 2026-08-08 |
| Real pages (real-val v2, the re-slice, Round 3 pre-render checks, the Round 2 position, the `\tup3` A/B) | [rung3/standing.md](rung3/standing.md) — moved 2026-08-07 |
| The feature track (F0's scheduler, F2's drums, F1's voices, F3's fingerboard) | [features/README.md](features/README.md) + [features/audio-sources.md](features/audio-sources.md) + [features/kanun.md](features/kanun.md) |
| What happened on any given day, and why | [log/status-log.md](log/status-log.md) |

## Next — two tracks, running in parallel

Since 2026-08-05 the product and the model advance independently: **the product track never trains,
the model track never touches the app.** Either can be worked on without waiting for the other.

### Track A — the product (W9 → W10 → public)

3. **⛔ EDITOR STEP 9 IS DROPPED — `Save JSON` STAYS** (owner, 2026-08-15), superseding the
   2026-08-07 decision to delete it, which was never carried out. **`smoke:editor` reads the edited
   document by clicking `#save-json`**, so the button is the check's only view of what an edit did,
   and removing it would have to buy a new DOM seam first. **The editor's list is now complete: steps
   1–8 and 10, built, deployed and checked on the production bundle. There is no step 9.**
   [mvp/editor.md](mvp/editor.md) · [mvp/standing.md](mvp/standing.md) · [DECISIONS.md](DECISIONS.md).
3b. **✅ F3 IS BUILT (2026-08-16) AND DEPLOYED (2026-08-18) — what is left is the LOOK, which the
   deploy went ahead of** on the owner's instruction; this item's ordering ("then, and only after that
   look") was overridden, not satisfied.
   ⏭ **THE NEXT PRODUCT ACTION, and the only one that needs a person, is
   [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) check 25** — now on the live site, or via
   `npm run dev:cloud`: open it, play a piece with Keman selected, and answer the two things no
   automated check can — does the dot sit where your finger would (open strings are the free
   calibration: the dot must be **at** the nut), and do the ticks read as information or as clutter?
   ⚠ Do **not** report the thin high positions as a finding; ~7 px per koma near the nut and less
   above is the shipped photo's known limit, and a higher-resolution bare-neck image fixes it with no
   code change. Everything it built, and the traps inside it: [features/README.md](features/README.md).
   ⚠ **If the look finds something, the fix now needs its own deploy** — the cost of the inverted
   order, and it is small (`deploy:app`, then `smoke:live`). ⚠ `smoke:live` checks neither images nor
   audio; spot-check both by hand after any deploy touching them.
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

Still the **public-launch gate**, and runnable at any time — it shares no file with the feature track.
**`strips_v5_tupnew` is the corpus Round 3 continues from**, and `round2-stage2-best` stays the
runtime until a Round-3 model beats it.

⏭ **THE ARMS ARE DONE AND THE FINAL RENDER IS FULLY SPECIFIED (2026-08-20)** — every decision it was
waiting on has been taken. B3, B4 and B5 are closed — null, dropped and **passed**.

⭐ **THE ORDER OF WORK, reviewed 2026-08-21 and accepted by the owner.** Steps 1, 3 and 4 need **no
labelling at all** and remove the three biggest risks; `batch3` (B2) waits for none of them.

| # | do this | why now | in |
|---|---|---|---|
| 1 | ✅ **DONE 2026-08-21** — `examv3-full`, all 139 read | **13.7% were wrong** (18 fix + 1 bad) against v2's 51%, and 7 of the fixes turned out to be **one bug** | B0 |
| 2 | ✅ **DONE 2026-08-21** — all 27 `gold_conflict` rows | **14 ok / 13 fix**; the fresh derivation mostly won, and **3 more signature bugs** fell out | B0 |
| 3 | ✅ **RAN 2026-08-21** — the re-emit, 37 min, `strips_b8`: **3,955 accepted** against 2,330 | ⏳ **its `b8-audit` is 58 of 201 read — 15.5% wrong so far**, and nothing may be promoted until the remaining 143 are done | B8 |
| 4 | ⏭ **NEXT** — **measure the 59-id budget** | a script, no labelling — and the re-emit just made it the biggest lever: width+budget drop **14,238** strips, twice what alignment loses | B9 |
| 5 | the remaining **636** `examv3` rows, **page-complete** | the primary is per page, so a half-labelled page under-counts itself; 64 pages still open | B0 |
| 6 | settle what the 75% floor means, then render → train → read | the rebuilt exam is harder than the instrument the floor was signed on | §3c, B6 |

⚠ **Only B0 gates the read; step 3 gated the MODEL** and has run — but its output is not training
data until the audit is **finished** and the old human corrections are carried across. [RISKS.md](RISKS.md) ·
[rung3/round3-criteria.md](rung3/round3-criteria.md) §3c.

**B0. ⏭ THE EXAM REBUILD — LABEL `examv3`. Highest-value labelling on the board, and it BLOCKS the
   read.** ✅ **166 rows are read**: all 139 of `examv3-full` and all 27 `gold_conflict`.
   ⏭ **636 remain over 64 pages** — 158 carrying a suggestion, 329 with no label at all, where the
   verdict is against the picture. **Label PAGE-COMPLETE**: the primary counts corrections per page, so
   a half-labelled page under-counts its own errors and grading it is worse than skipping it.
   ⚠ **This is step 5, not the next step** — B8's re-emit comes first, because it is the one item that
   damages the MODEL rather than what can be concluded from it, and it needs no labelling.
   ⚠ **Crops live in `data/real/strips_examv3`**, so `promote_labels.py` needs
   `--strips-root data/real/strips_examv3` — the default root holds the same filenames with the
   retired slicer's pixels. ⚠ **The ceiling is 64 pages**: 3 drop every candidate as `split_wide` /
   `over_budget`, which B9 would buy back.
   ⚠ **The viewer had three bugs on the `gold_conflict` rows, found by the owner and FIXED 2026-08-21**
   — no decode, an invisible suggestion, and **`ok` saving it**; repaired in place, exam gold never at
   risk ([rung3/labeling-queues.md](rung3/labeling-queues.md)).
   ⏭ **Two things must still happen before the read**: re-score `round2-stage2-best` on the rebuilt
   exam, and settle what the signed 75% floor means on a harder instrument.
   [rung3/labeling-queues.md](rung3/labeling-queues.md) · [rung3/exam.md](rung3/exam.md).

**B1. ✅ `batch3` IS CUT AND OPEN — 54 pages / 1,499 strips from the SCANNED tier** in `review_ui.py`
   (`batch3` tab, crop root `data/real/strips_v2`). **28 pages were excluded over four cut/check
   rounds**: 11 free-hand handwritten (a deferred category) and **17 stale — 24% of the pages
   checked** — whose crops no longer re-slice to the same music. Every page in the batch is verified:
   0 void. ⚠ The exclusions cost the highest-evidence pages in the tier (46.3 → 43.0 units/page), on
   the record. ⚠ **Training only** — the ranking selects the worst pages in its tier, so nothing cut
   here may become exam gold. [rung3/labeling-queues.md](rung3/labeling-queues.md).

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
   labels, they are not corrections we can bank ([METRICS-SLICER.md](METRICS-SLICER.md)).
   ⚠ Only the **final** model consumes this work, so the arms never waited for it.
   ✅ **The promotion embargo is LIFTED (2026-08-20)** — both arms are read, so `promote_labels.py`
   and B8 are unblocked, and promoting *before* the final render is the point of B2.

**B3. ✅ ARM 1 — THE SCAN PROFILE: RAN, NULL, DECIDED — nothing to do.** **`scan_share` stays OFF**
   (owner, 2026-08-19), which is its default. [rung3/scan-profile.md](rung3/scan-profile.md) · raw log
   [round_3_scan_logs.md](../round_3_scan_logs.md).

**B4. ⛔ ARM 2 — ONE MEASURE PER STRIP: DROPPED, not deferred.** Reasoning in "Now", decision row in
   [DECISIONS.md](DECISIONS.md). ⚠ The **short-crop hole** is still the blocking item on the
   crop-geometry axis ([METRICS-GEOMETRY.md](METRICS-GEOMETRY.md)).

**B5. ✅ ARM 2 — THE STACCATO DISTRACTOR: TRAINED, SCORED, IT PASSES, AND THE FLAG SHIPS** (see
   "Now"). Primary **72.7% → 0.0%** false dots, paired **60–0** (p = 1.7e-18); clause 2 passes, clause
   3 shows no price. **The first Round-3 arm to move its primary.**
   [rung3/staccato-arm.md](rung3/staccato-arm.md) · [METRICS-UNSEEN.md](METRICS-UNSEEN.md).

**B6. ⏭ THE FINAL MODEL, then the exam, read ONCE. The render carries THREE flags and no more.**
   `--concave-tuplet` (a per-piece coin on print evidence, no recall claim), `--staccato-noise` (the
   passed arm) and the new **label-free dotted (usul) barline**. ⛔ **Nothing else joins them** — in
   particular **not** a raised token budget (B9) and **not** the content work (B7).
   ⏭ **Before rendering**: how often does print actually draw a dotted barline? 7.8% is a statistic
   about the model's guesses. ⭐ **Cheapest honest method (2026-08-21): count them while labelling
   `examv3`** — ~660 real crops are about to pass in front of a person anyway.
   ⏭ **Give the barline its own paired scorer**, cloned from `staccato_falsedot_score.py` (false
   `\repstart` rate instead of false dots). Three flags in one render means a general movement is not
   attributable; the staccato arm survives that because it kept its own instrument, and this makes two
   of the three attributable instead of one.
   ⏭ **During training**: save **two** checkpoints, one under the current selector and one selected on
   a free-running real metric, and choose between them on `_realval_v2` **before** the exam
   ([BACKLOG.md](BACKLOG.md) item 3).
   ⏭ **Before the read**: B0 must be done, and `round2-stage2-best` re-scored on the grown exam.
   ⏭ **At the read**: add one free column — split `\tup3` recall by first-in-strip vs later, which
   settles the tuplet position lead over the exam's 55 groups ([rung3/tuplets.md](rung3/tuplets.md)) —
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
   neyzen-heavy, 24 of 28 strips. Sources are listed once, in [DECISIONS.md](DECISIONS.md). ⚠ Read
   each licence before redistributing ([THIRD-PARTY.md](THIRD-PARTY.md)); keep refusing exam pieces.

**B9. ⏭ MEASURE THE 59-id DECODER BUDGET — a script, not a change, and the best value on the board.**
   `MAX_IDS = 59` exists because the base weights' `generation_config.max_length` is **60**: a setting,
   not an architectural limit. Run the real tokenizer over the existing drop lists and report how many
   fit at **90** and at **120** ids. It would pay three times — 78 dropped exam strips, the
   tuplet-dense repertoire (39.4% / 80.5% / 92.9% of 1-, 2- and 3-measure triplet windows blow it),
   and 2,108 over-budget training drops. ⛔ **The measurement is Round 3; raising the budget is Round
   4** — the cost side is unpriced (decode steps in the browser and on Cloud Run, training memory) and
   it would move every pool, every manifest and the shipped latency at once.
   [BACKLOG.md](BACKLOG.md) item 7.

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
   ⏭ **It is NOT training data yet, and two things stand between:**
   ⏳ **(a) finish `b8-audit` — 58 of 201 read (2026-08-21 evening), 143 open.** The guard, and the
   referee was trained on these very labels, so its agreement is partly memory. v2 sampled 2 of 63 and
   a later read found 51% wrong. **So far 9 fix / 58 = 15.5% wrong** — ⚠ an interim number on n=58, not
   a verdict on the pool ([METRICS-CORPUS.md](METRICS-CORPUS.md)).
   ⭐ **(b) carry the 1,442 human `fix` labels across** — they do **not** come back by themselves. 951
   are recoverable (445 land on an accepted strip covering the same measures, 506 sit in `b8-review`);
   ⛔ carry them by **measure span**, never by filename — 248 match a new strip's *name* while holding
   different music. The old pools are untouched on disk.
   ⭐ **The drop table**: `split_wide` 10,226 + `over_budget` 4,012 = **14,238** against 7,446 for
   alignment — the **budget rail is now the binding limit**, which is why step 4 moved up. Numbers and
   the 98% self-consistency check: [METRICS-CORPUS.md](METRICS-CORPUS.md) · [rung3/labeling-queues.md](rung3/labeling-queues.md).
   ⛔ **The exam is not re-emitted** and keeps the neutral July decode ([DECISIONS.md](DECISIONS.md)).

⚠ **The musical-form lead is DEAD** (owner retest, 2026-08-17) and must not be re-derived
([log/superseded.md](log/superseded.md)). ⚠ **A fourth realism arm does not follow from three near
misses** — the three nulls and the one pass are the reason ([rung3/levers.md](rung3/levers.md)).

### Owed but not next → [BACKLOG.md](BACKLOG.md)

Genre split: this file holds current state and the next action; a backlog is neither. It carries the
deskew-estimator corpus run, the **5 duplicate `_realval_v2` rows (4 contradictory)**, exam v3, the
signature-packed sharp glyphs, the train-time exam guard for the synthetic corpus, the ORT int8
numerics wobble, and the additive-only re-slice — each with the reason it is deferred. ⚠ Several are
deferred *because* acting on them would confound something in flight; read the reason before starting.

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
