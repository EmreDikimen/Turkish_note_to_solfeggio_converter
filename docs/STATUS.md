# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-29

## Now

⭐ **A WHOLE STAFF ROW GOES MISSING ON 14% OF PAGES — FOUND BY EYE, FIXED, MEASURED, AND SHIPPING
OFF UNTIL YOU SAY OTHERWISE.** The owner opened the `examv3`-vs-frozen comparison sheets and saw
pages with more staff rows than the slicer found. He was right: `vuslata_..._p2` finds **4 of 9**,
`sevdim_..._p1` **5 of 8**, and it is **not** only handwriting — a printed TRT page loses 4 of 9.
⭐ **A lost row is not a bad crop, it is NO crop**, so no accuracy metric has ever shown it. Cause:
the horizontal opening's kernel is **one pixel tall**, so a line that wanders across rows is erased
rather than weakened. ⛔ **Do not re-open a global knob** — every global form was
measured and rejected. ✅ What ships is `STAFF_RESCUE`: pass 1 untouched, then re-detect **only in the
bands the page's own staff pitch says are empty**. Full scale: **all 6,440 scored rows identical**,
**+320 staff rows on 227 of 1,592 pages**. ✅ Ported to the browser and
`parity:slicer` passes **with the flag ON** (871/871 staff rows, 2425/2425 strips) — an off-run
passes while executing none of the new code. ⚠ Its benefit is **unscoreable, not merely unmeasured**
(below); the evidence it is real is visual, 14 of 14 rows on 4 pages.
[METRICS-SLICER.md](METRICS-SLICER.md) · [METRICS-SLICER-PORT.md](METRICS-SLICER-PORT.md).

⛔ **THE ROW-LEVEL SLICER INSTRUMENTS ARE BLIND TO STAFF-COUNT CHANGES.** Both pair a row to its
cached truth by **system index**, so inserting a staff shifts every later index and reports a large
regression that is pure artifact. `score_slicer.py` gained `--pair-by-position`; ⛔ **`score_barlines.py`
has the same coupling and NO fix** — `bozukNihavendLonga` read **30 marked before a staff change and
3 after**. This is also why the rescue's 320 rows can never be scored there: the truth is aligned
from the OLD pipeline's decodes, which never saw them. [METRICS-SLICER.md](METRICS-SLICER.md).

✅ **THE BROWSER/PYTHON STAFF DIVERGENCE IS FIXED AND SHIPPED.** `bozukNihavendLonga2.png` read **9
staves in the app against Python's 10**; it now reads 10. Cause: the rule deciding where one staff
ends (`2.2 x median line gap`) sat **0.8 px** from flipping, and the browser's unavoidable ±1
grayscale difference fell the other side. ⚠ `parity:slicer` read 100% throughout — its 120-page
sample does not hold that page, so a green check and a real divergence were both true.
⛔ **Two fixes were rejected before this one** — grouping by staff HEIGHT read **3205 against 3750**
(−545). ✅ What ships merges two adjacent groups each under the 3-line floor when together they fit
inside one staff — net **−2 of 6,440**,
`parity:slicer` **100% on the shipped defaults** (854/854 staff rows, 2388/2388 strips, worst Δ 0 px, W4/W5/W6 PASS). ✅ **A second, PRE-EXISTING defect on the same page is also fixed**
(owner: *"s03 is read soo wide in vertical, it includes previous staff"*): a staff whose measured
spacing read **15** against the page's **9.75** while its height was correct, so the row
under-magnified and its frame reached into the system above. `STAFF_SPAN_CONSENSUS` already did this
repair but was gated on line COUNT; it now gates on the defect. **+2 rows, 13 of 6,440 moved.** ⚠ Both bump `GEOMETRY_REV` → **20260826**: every decode cache on disk is invalid.
[METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md) · [DECISIONS.md](DECISIONS.md).

⛔ **`OMR_BLOB_FILL` 0.3 WAS MEASURED AND REJECTED.** **+7.6pp recall** on the 93-mark faded-page truth,
but **3741 exact against 3750** at full scale, paired **BETTER 52 / WORSE 72**, and the dominant move
is `+0 → +1` on 37 rows — a row that was RIGHT gaining a spurious barline. ⭐ Same signature as
`BAR_FADE_SP`. ⛔ **The faded-page table has now mispredicted the full run three times**; never price a
barline gate on it alone. [METRICS-SLICER-BARLINES.md](METRICS-SLICER-BARLINES.md).

⚠ **IF THE EXAM IS EVER RE-CUT, RE-PRICE IT FIRST.** The **125-verdict** figure predates the two
2026-08-26 fixes and `GEOMETRY_REV` is now **20260826**, so every decode cache on disk is invalid and
the next emit RE-DECODES rather than reusing 1,704 of them. ⏭ Do the `carry_labels()` fix first —
**25 of 67 pages are byte-identical and carry 168 verdicts** that need no human at all
([BACKLOG.md](BACKLOG.md)). [METRICS-SLICER-ROOTS.md](METRICS-SLICER-ROOTS.md).

⏭ **THE EXAM RE-CUT IS THE NEXT SLICER-SIDE ACTION, AND IT IS NOW PRICED — BUT IT WAITS ON ONE
DECISION.** ⚠ **The 2026-08-24 freeze no longer holds**: the owner re-opened the slicer on
2026-08-25 (*"we did not freeze it"*) and the staff rescue landed behind a flag, so what `examv4`
gets cut with is a choice, not a given (top of this file). ⚠ **`examv3` crops are definitively
stale** — five fixes moved staff and barline geometry on 24–25 August, and the decode-cache guard
refuses their caches by construction. **Re-priced 2026-08-25 on the current slicer: 330 of 455
verdicts carry safely, 125 need a person again** (76 lost, 49 returning as a suggestion). Then cut
**once**: `strips_examv3` is kept as the record, the new root is `examv4`, and the surviving
verdicts carry over. ⚠ **The exam queue is 455 of 663 verdicted** (398 fix / 35 bad / 22 ok), so
**208 rows remain**, over **31 page-complete / 17 partial / 16 untouched** of 64 pages. The primary
is per page, so a half-labelled page under-counts itself — finish page-complete.

✅ **`\tie` IS RETIRED AND BOTH SIDES ARE DONE** (owner, 2026-08-22) — an arc is label-free ink, like
a slur, because **65–78% of every `\tie` in the queues joined two DIFFERENT pitches**. Render, gold
and scorer all followed; the tie tail now restrikes its accidental where nothing carries one.
⚠ Real-val's arc-`\tup3` diagnostic now prints `n/a` — that floor is read on the **exam**, which keeps
its ties. Account: [log/status-log.md](log/status-log.md) · [rung3/labeling.md](rung3/labeling.md).

⭐ **THE ARMS ARE DONE AND THE FINAL RENDER IS SPECIFIED (2026-08-20).** Round 3's arm list closed —
one dropped, one null, one **passed** — and the three decisions the final render was waiting on were
all taken in one session. **It carries three flags**: `--concave-tuplet`, `--staccato-noise` and a
new **label-free dotted (usul) barline**. What is left is **render → train → the exam, read once**.
[DECISIONS.md](DECISIONS.md).

⭐ **THE TRAINING POOLS WERE RE-EMITTED ONTO THE CURRENT CROPS (2026-08-21) — `strips_b8`, 3,955
accepted strips against 2,330, in 37 minutes on the laptop.** ✅ **Its 201-row audit is now read
whole: 13.4% of the auto-accepted labels are wrong** — the same level as the re-sliced exam, and the
biggest error class is **repeat structure** (`\repstart` / `\volta`), not pitch. ⏭ **Still not
training data**: the **1,442 human corrections do not carry themselves** (951 recoverable, by measure
span and never by filename). ⭐ The drop table points at the **59-id budget**, not at alignment.
✅ **`b8-full` IS NOW DRAFT-ACCEPTED WHERE THE LABEL AND THE DECODE AGREE (owner, 2026-08-27)** —
**2,896 rows** drafted `ok` (`by=agree`), **842 disagreements left for a human**, and the 201
hand-read audit verdicts carried in. Agreement was right on **94%** of the rows a human has read
against **45%** for disagreement; ⚠ a draft is **not** a read, and the misses **clump on one page**.
Spot-check with the review UI's **🤖 auto-accepted (agree)** filter, least-confident first.
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
(18 fix + 1 bad) against exam v2's **51%** on the identical queue. [rung3/exam.md](rung3/exam.md) ·
[METRICS-EXAMSET.md](METRICS-EXAMSET.md).

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

⭐ **THE FROZEN GOLD LARGELY MOVED WITH ITS MUSIC — 221 of 326 labels, not 11.** ⚠ A carried label is a
**suggestion, not a verdict**; `strips_exam_v2_clean/` stays the record of what Round 2 was measured on.
[METRICS-EXAMSET.md](METRICS-EXAMSET.md).

⚠ **THE REBUILT EXAM IS HARDER THAN THE ONE THE FLOOR WAS SIGNED AGAINST, AND THAT NEEDS SETTLING
BEFORE THE READ.** It grades ~12 candidate strips a page against 7.1, so a page collects more edits at
equal model quality and the primary ("pages needing ≤5 corrections") reads lower. Fairness is intact —
the `round2-stage2-best` re-score puts both models on the same set — but **what 75% means changes**.
[rung3/round3-criteria.md](rung3/round3-criteria.md) §3b · [rung3/exam.md](rung3/exam.md).

⚠ **THE EXAM STILL THROWS AWAY THE WIDE AND THE DENSE — 567 of 1,369 candidates (41%)**, so it reads
each page on its easier material. Quote it with the result; it is also a second reason to measure the
decoder budget. [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

⛔ **THE SHIPPED APP RETURNS SILENTLY WRONG NOTES ON DENSE PAGES. THE FIX IS MEASURED, SPECIFIED, AND
DEFERRED TO ROUND 4 (owner, 2026-08-23) — which is what RELEASES THE EXAM.** The browser slicer has **no label-budget rail**: at training an over-budget strip is dropped,
at inference there is none, so the model emits `</s>` early and **confidently** — `hitCap` catches
**7 of 4,012 (0.2%)**, and **998 of 1,689 pages (59.1%)** carry such a strip. ✅ The rail's
browser-vs-Python **parity is CLOSED** (132 pages; W4/W5/W6 pass under the rail as under the shipped
rule). ⛔ **The rail ALONE is a wash** — under-fill 15.7% → 16.6% (p = 0.57), no better on dense
pages only (19.2% → 18.0%) or on page completeness (0.900 → 0.909, 10 better / 12 worse).
⚠ **But that tested INFERENCE on a model never trained under the rail, which is not the experiment
that matters**: a split strip *fits the 59-id emitter gate and therefore enters training*, and today
**4,012 over-budget strips are dropped**, so the model has never seen dense music in any form.
Splitting is not optional either — a 130-id label cannot be emitted at all. ⭐ **Dense music already
reads twice as badly even in a 1-measure strip (9.9% vs 4.8%, p = 0.013)** — a training gap, not a
cutting one. ⏭ The settling experiment is the **pair** — re-emit with the rail → train
→ measure — and it is **Round 4's headline**, at **b=57, not 50** (recovery is flat b=40..59, so the
value rides on over-splitting cost alone; 50 makes 162 needless cuts, the likely cause of the
measured non-dense-page regression 10.1% → 14.9%, p = 0.031). ⭐ **Deferring it is not a shrug**: the
shipping slicer therefore does not change this round, so the rebuilt exam stays valid and B0 is
unblocked. [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) · [BACKLOG.md](BACKLOG.md) item 0.

⏭ **THE FINAL RUN SAVES TWO CHECKPOINTS AND CHOOSES BETWEEN THEM ON REAL-VAL.** `best` is selected on
a val loss that is **94.6% synthetic** (4,769 strips outvoting 271, nineteen to one) in a round graded
on real pages. The fix was deferred because changing the selector mid-round makes the arms
incomparable — **the arms are now read**, so rather than swapping it (a second uncontrolled change) the
final run keeps the current selector *and* additionally keeps one selected on a free-running real
metric, comparing them on `_realval_v2` **before** the exam. Legal by the standing rule: real-val is
the selection set, the exam is one-shot. [BACKLOG.md](BACKLOG.md) item 3 · [DECISIONS.md](DECISIONS.md).

⏭ **COLLECTION IS NARROWED TO TWO TARGETS, not broadened.** 2,486 unlabelled page PNGs already sit on
disk, so volume relieves nothing. What it cannot substitute for: pages drawing the **concave tuplet
mark** (unscoreable — no labelled real strip carries it) and **tuplet-dense instrumentals** (sirto,
longa, saz semaisi — a measured structural hole). ⚠ The second does **not** fix itself: the same budget
drops the new pages. ⚠ **A THIRD target, DEFERRED not dismissed**: every page we own is from **two
websites**, exam included ([BACKLOG.md](BACKLOG.md) item 10).

⛔ **ARM 2 (one measure per strip) IS DROPPED and ARM 1 (the scan profile) WAS A NULL** — what drops a
strip is the **59-id budget**, not width, and `scan_share` stays off. ⚠ Arm 2's drop was about the
TRAINING corpus and does **not** cover the inference question above, which is a different trade. [rung3/scan-profile.md](rung3/scan-profile.md) ·
[METRICS-GEOMETRY.md](METRICS-GEOMETRY.md).

⚠ **THAT IS THREE NULLS ON ONE AXIS AND ONE PASS OFF IT.** Tuplet mark p = 0.688, the second
engraver's domain gap, the scan profile — all "make the synthetic pixels look more like real pages".
Only the staccato arm, which asked a different question, moved its primary, so **a fourth realism arm
does not follow**; the dotted barline counts because it is a hole rather than a gap. ⚠ **Lever 4 gets
no arm and no corpus.** [rung3/levers.md](rung3/levers.md) · [METRICS-ENGRAVER.md](METRICS-ENGRAVER.md).

✅ **ROUND 3 HAS A SIGNED ACCEPTANCE BAR, and it is also the public-launch gate** (owner, 2026-08-15):
**≥75% of exam pages needing ≤5 corrections**, against 57% today, with the accidental measures as
no-regression clauses. Written before any Round-3 training and **not re-opened after the read** — a
miss is a miss and the launch waits for Round 4. ⚠ §3b now records that the exam grows *before* the
read and that the baseline column is re-measured with it; the floors do not move.
[rung3/round3-criteria.md](rung3/round3-criteria.md).

✅ **TRACK A IS SHIPPED AND LIVE — <https://komavision.netlify.app>.** F1's instrument voices, F2's
drums and all three F3 instruments are deployed. ✅ **The machine's backlog went out in ONE deploy on 2026-08-30** — the violin's 2026-08-27 rebuild, F3's whole 2026-08-29 day (kanun view, the two
views merged into one "Enstrüman üzerinde" tab whose picker also sets the playback voice, piano roll deleted) and the sol klarnet. `smoke:live` passes
on both paths; the clarinet photo and its CC BY-SA credit were spot-checked live by hand, which `smoke:live` does not cover. ⛔ **The fingerboard originally went out without
check 25, its written pre-condition** — skipped on the owner's instruction. Half of that look has
since happened and it changed the view twice; ⚠ **the other half — *is the mark in the right place* —
is still owed for BOTH instruments** (checks 25 and 26) and is still the only thing no automated
check can answer. ⚠ The trap that outlives F1: voices ride **`VITE_VOICES_URL`**, the drums ship with
the app, and setting `VITE_AUDIO_URL` in a deploy 404s the drums into synthesis — silently.
[features/README.md](features/README.md) · [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md).

⚠ **Two copyright items remain open and are both the owner's call**: the samples and the neyzen.com
screenshot are out of HEAD but remain in the **public** repo's git history (clearing them needs a
`filter-repo` rewrite and a force-push), and there is still **no LICENSE file**. [THIRD-PARTY.md](THIRD-PARTY.md).

⚠ **Every human who has used the deployed app was on a phone, and n is still 2** — **a question, not a finding**
about "web first, mobile later". [METRICS-USAGE.md](METRICS-USAGE.md).

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

3. **⛔ EDITOR STEP 9 IS DROPPED — `Save JSON` STAYS** (owner, 2026-08-15), superseding the
   2026-08-07 decision to delete it, which was never carried out. **`smoke:editor` reads the edited
   document by clicking `#save-json`**, so the button is the check's only view of what an edit did,
   and removing it would have to buy a new DOM seam first. **The editor's list is now complete: steps
   1–8 and 10, built, deployed and checked on the production bundle. There is no step 9.**
   [mvp/editor.md](mvp/editor.md) · [mvp/standing.md](mvp/standing.md) · [DECISIONS.md](DECISIONS.md).
3b. **✅ F3 IS BUILT (2026-08-16), DEPLOYED (2026-08-18) AND REBUILT UPRIGHT (2026-08-27)** after the
   owner finally looked at it: *"I want this in vertical position and half of the violin's body should
   be visible, it looks very bad right now."* The quarter-turn rotation is gone, a position is now one
   hideable line across all four strings instead of a notch on one, the lines are a **fixed chart** of
   the seven standard first-position notes (reversed the same day from lines built out of the loaded
   score — a reference that follows the music is not a reference), and a **neck zoom** was added. ⭐ Asking whether the lines were spaced right
   then exposed a real fault one level down: the **string choice** had no notion of a hand and let an
   ascending line climb one string forever (22 of Meltem's 83 notes above the octave). It is now a
   hand-position model — numbers in [features/fingerboard.md](features/fingerboard.md). Typecheck,
   `npm test` and `smoke:editor` all pass; **deployed 2026-08-30**. [features/fingerboard.md](features/fingerboard.md) ·
   [DECISIONS.md](DECISIONS.md).
3c. **✅ F3 HAS A SECOND INSTRUMENT: THE KANUN (2026-08-29)**, after the owner reopened the
   violin-only scope — *"şimdi biz kemanı ekledik çok hoş, kanunu eklemeye başlayabiliriz"*. A drawn
   kanun: 26 courses, 12 mandal boxes each, the sounding course in red and a lever that has just
   moved flashing. ⭐ **It is not the violin view with a different picture, and seeing that first is
   what made it small**: a violin position is a fact about one note, while a mandal **stays where it
   is put**, so this is a state machine over the whole piece — which is also what buys the piece's
   **opening mandal plan**, listed in words before you press play. ⭐ The string-choice trap that cost
   `fingering.ts` a rewrite cannot arise, because the written spelling names the course: **1,825 of
   1,825 notes placed, 0 respellings, 0 unreachable** on the four scores on disk. Typecheck,
   `npm test` (46 new checks) and `smoke:editor` (20 new, **207 ALL PASS**) all pass; **deployed
   2026-08-30**. [features/kanun-view.md](features/kanun-view.md) · [DECISIONS.md](DECISIONS.md).

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
   Fingering table, lip bar, view and wiring done; `npm test` (48 new), typecheck and `smoke:editor`
   pass. ⚠ **`smoke:editor` covers the clarinet VOICE, not the VIEW** — its DOM contract (`#clarinet[data-holes|data-keys|data-lip-reach]`, `[data-omr="clarinet-key"]`,
   `[data-omr="clarinet-lip-tick"]`) is unasserted, unlike the kanun's and the violin's. Confirmed to render pre-deploy by hand only: 6 holes, 18 keys, 5 lip ticks, photo loaded, no page
   errors. ⛔ **Two wrong turns, both caught by the owner's eye and by no test**: the first table came
   from **Boehm** diagrams for an **Albert** instrument (`T lh123|rh1--` is Si♭ on one, Si on the
   other), and the artwork went CC0-schematic → own-drawing → **photograph**, no CC0 photo of a
   German-system clarinet existing. The table is now read from the Oehler/Albert chart's own markup;
   the six tone holes are **measured** off the photo; key positions are by eye and flagged per
   marker. ⏭ Next: the remaining key-position corrections, the note label, the browser checks.
   [features/clarinet-view.md](features/clarinet-view.md)

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
| 3 | ✅ **DONE 2026-08-22** — the re-emit ran (37 min, `strips_b8`, **3,955 accepted** against 2,330) and its **201-row audit is read whole**; **`b8-full` draft-accepted 2026-08-27** (2,896 `by=agree`, **842 disagreements left pending**) | **13.4% of the auto-accepts are wrong**, repeat structure ahead of pitch ([METRICS-CORPUS.md](METRICS-CORPUS.md)); what still blocks promotion is the **human-fix carry**, not the audit | B8 |
| 4 | ✅ **DONE 2026-08-22** — the tie change on the RENDER side, plus the accidental restrike it forced and the scorer filter | the deadline item, closed **before** the render rather than after; `npm test`, 218/218 round-trip both modes, and a paired pilot render | — |
| 5 | ✅ **DONE 2026-08-22** — ties out of `_realval_v2`, its five derived pools, the five `_realval_degraded` levels and v1 `_realval` | **771 tokens over 576 rows in 12 manifests**; **78% of the pairs joined DIFFERENT pitches**, i.e. were slurs. No criterion moved — but real-val's arc-`\tup3` diagnostic now reads `n/a` ([rung3/labeling.md](rung3/labeling.md)) | — |
| 6 | ✅ **DONE 2026-08-22/23** — parity closed (132 pages, W4/W5/W6 pass under the rail), `?dense=` measured on a label-free proxy, and the budget value swept | rail **alone** is a wash; the value is **b=57, not 50**; splitting's real payoff is at TRAINING, untested ([METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md)) | — |
| 7 | ✅ **DECIDED 2026-08-23 — the rail-plus-retrain pair goes to ROUND 4** (owner) | the final render's arm list is closed, and deferring **releases the exam**: the shipping slicer does not change, so `examv3` stays valid ([DECISIONS.md](DECISIONS.md)) | — |
| 8 | ⏭ **NEXT — the remaining 208 rows of `examv3`, page-complete. NO re-cut.** | The queue is **455 of 663 verdicted** (398 fix / 35 bad / 22 ok), **31 pages complete of 64**. ⛔ `examv4` was priced and declined (owner, 2026-08-26): a re-cut does not bank verdicts, it reopens the queue at ~663 rows. The exam grades on `examv3`. The primary is per page, so finish page-complete — a half-labelled page under-counts itself | B0 |
| 9 | settle what the 75% floor means, then render → train → read | the rebuilt exam is harder than the instrument the floor was signed on | §3c, B6 |

✅ **Steps 5, 6 and 7 are closed, and the slicer is FROZEN again** (owner, 2026-08-26, after three fixes landed and two were rejected). ⏭ **The next action is step 8 and it needs no decision: label the remaining 208 rows of `examv3`, page-complete, then grade on it.**
⛔ **Measuring the 59-id budget was step 4 and is DROPPED** — it decides which strips we keep, not what
the model can read ([DECISIONS.md](DECISIONS.md)); its benefit half is measured and kept in
[BACKLOG.md](BACKLOG.md) item 7.

⚠ **Only B0 gates the read; step 3 gated the MODEL** and has run — but its output is not training
data until the audit is **finished** and the old human corrections are carried across. [RISKS.md](RISKS.md) ·
[rung3/round3-criteria.md](rung3/round3-criteria.md) §3c.

⏭ **B8 HAS LABELLING WORK AVAILABLE IN PARALLEL, AND IT IS NOT STEP 8** — step 8 is still the next
action. The 2026-08-27 draft-accept left **842 `b8-full` disagreements pending** for a human, and the
**2,896 drafted `ok` rows are unread** — a draft is not a verdict, and the known misses clump on one
page, so the spot-check goes through the review UI's **🤖 auto-accepted (agree)** filter,
least-confident first. ⚠ Neither of those is what blocks promotion: **the 1,442 human-fix carry is**.
Take this only when the exam queue is not the better use of an hour.
[rung3/labeling-queues.md](rung3/labeling-queues.md).

**The item-by-item detail — what each of B0-B9 is, what it found, and what it still owes — is in**
**[rung3/worklist.md](rung3/worklist.md).** Only the ordered table above and the next action stay here.

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
