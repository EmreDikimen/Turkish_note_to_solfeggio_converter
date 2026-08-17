# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-17

## Now

⛔ **LEVER 1 IS SPENT: THE GEOMETRY PILOT RAN AND THE PRE-REGISTERED STOP RULE FIRED.** The padding
probe (2026-08-15) was causal — squashing exam crops raises edits/token monotonically, +59%, holdout
+61%. The pilot (2026-08-17) then found we **cannot buy the reverse**: that probe's ×1.00 baseline
*was* the exam's own **19.2 px**, and exceeding it needs crops under 479 px, i.e. narrower than one
measure — the half-measure target already measured at **+31.8% worse**. On the synthetic side
`maxMeasures = 2` is a **no-op** (87% of strips were already one measure; the 56-**token** budget binds
first). On the real side the 1-measure arm raises encoder spacing 17.3 → 21.1 px but takes short crops
**0.8% → 4.3% = 5.4× the control**, against a 2× stop threshold. **Written up as spent, not re-aimed.**
✅ **Two things survive it.** A cheap separable change — render the corpus at **one measure per strip**
to close the *training* gap (`strips_v4` reads at **16.0 px**, the exam at **19.2**) for **+12.9%**
strips, no slicer change, therefore no decode cost and no short-crop risk. And the **short-crop hole is
now the blocking item** on this axis rather than a side condition. ⚠ Both cost estimates this lever
carried were wrong: corpus +12.9% and decode **1.22×**, not ~3× either. Numbers:
[METRICS-GEOMETRY.md](METRICS-GEOMETRY.md) · verdict: [rung3/levers.md](rung3/levers.md).

⭐ **THE STACCATO DISTRACTOR IS BUILT, AND THE DEFECT IT TARGETS IS NOW MEASURED AT 72.7%.** The
owner spotted the model reading printed **staccato dots as augmentation dots**, lengthening notes
that were never long. The cause is structural: `ADDED_TOKENS` has **no articulation token** and the
renderer draws none, so **0 of 40,826 strips carry one** and every dot the model has ever seen meant
*longer*. On a paired pilot — same 110 strips, marks the only difference — it decodes a dot gold does
not have **72.7% of the time, against 0.0% unmarked**, which it reads 110/110 exactly. `--staccato-noise`
is built and **off by default**, following `drawSlurArc`: manifests byte-identical, `verify-labels`
PASS 1215/1215. **Nothing is trained yet** — the floors are pre-registered in
[rung3/levers.md](rung3/levers.md) Lever 6, and the trade is **duration over pitch** (owner).

⚠ **This partially re-scopes a line that read as closed.** "Resolution was ruled out" in
[METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) was measured on per-class **accidental recall**, on
glyphs that survive a shrink. It was never run against the **edit budget**, which is what Round 3
targets — and the edit budget does move. Both statements stand; they measure different things.

✅ **ROUND 3 HAS A SIGNED ACCEPTANCE BAR — the first round that does, and it is also the
public-launch gate** (owner, 2026-08-15). **≥75% of exam pages needing ≤5 corrections**, against 57%
today; the accidental measures are no-regression clauses at their Round-2 values. It is the *product*
number rather than the accidental headline because Round 3 targets pitch (40% of user edits) and
duration (28%), which the macro AEU mean cannot see. Written and dated **before** any Round-3
training, taken unchanged, and **not re-opened after the exam is read** — a miss is written up as a
miss and the launch waits for Round 4. [rung3/round3-criteria.md](rung3/round3-criteria.md).

✅ **F1 IS DONE, HEARD AND LIVE (2026-08-14)** — `Çalgı sesi` offers **Klarnet**, **Keman** and
**Kanun** beside the built-in tone, 62 CC0 files on the Hub, deployed and `smoke:live` PASS on both
paths. Four rounds of ear feedback each corrected a real measurement no green check caught (breath on
16th notes, too deep a trim, the kanun a whole koma sharp, its attack landing before the pluck) and
all four are closed and guarded. The account, and every number: [features/README.md](features/README.md),
[features/audio-sources.md](features/audio-sources.md), [features/kanun.md](features/kanun.md).
⚠ **The one operational trap that outlives the work**: the voices are hosted on **`VITE_VOICES_URL`**
and the drums ship with the app — setting `VITE_AUDIO_URL` in a deploy would 404 the drums into the
synthesis the owner rejected, silently ([../CLAUDE.md](../CLAUDE.md), [DECISIONS.md](DECISIONS.md)).

✅ **F3 IS BUILT — THE VIOLIN FINGERBOARD TAB, AND TRACK A HAS NO DESIGNED-NOT-STARTED WORK LEFT**
(2026-08-16). A third view beside Nota and Piyano rulosu: a violin neck, a dot that follows the audio
clock, and a tick at **every position the loaded score itself uses** on each string — so the uneven,
microtonal spacing on screen is the music's, not a diagram's. `npm test` (38 new assertions),
`typecheck` and `smoke:editor` pass, and a local `dist/` build was driven headlessly to prove the
photo is served and the marker tracks in the **production bundle**, which dev mode cannot show.
What it built, the three things the photo corrected, and the traps:
[features/README.md](features/README.md) · [log/status-log.md](log/status-log.md).

⛔ **IT IS NOT DEPLOYED. <https://komavision.netlify.app> DOES NOT HAVE IT.** "The production bundle"
above means a `dist/` built and served **on this machine**; `smoke:live` has not run. See it with
`npm run dev:cloud`. ✅ **It IS committed** — F3 in `469c87e`/`64a6702` and the staccato distractor in
`1c106b0`, separately, as intended. ⚠ **This block said "not committed" until 2026-08-17, when it was
checked rather than believed**; it was written while both were in the tree and never revised after they
landed. A stale "uncommitted" warning is worse than none, because the next session budgets a commit it
does not owe — and it hid a *genuinely* uncommitted third change, the pale-line binarizer, for a day.

⚠ **NOTHING ABOUT IT HAS BEEN SEEN BY A PERSON**, and every automated check reads the *same geometry
the drawing does* — so none can say the dot is where a violinist would put the finger, or whether the
ticks inform or clutter. That is **[MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) check 25**,
and it is Track A's next action (item 3b), before any deploy.

✅ **The blocking question was answered first: standard Sol–Re–La–Mi, table left open** (owner,
2026-08-16) — the frequencies are data, so a Turkish scordatura is a row and no geometry moves.
⚠ Two consequences to know before looking: the open strings sit on **this project's 53-TET grid**,
not a tuner's (open Sol 195.571 Hz, ~4 cents = a fifth of a koma, which is what makes an open string
land at ratio 0 exactly); and because Turkish notation transposes down a fourth, **low written
passages sound below the open Sol and get no marker at all**, reported as `out-of-range` rather than
clamped. [DECISIONS.md](DECISIONS.md).

**The mark itself is settled history now** — measured against ~11 real editions (16/16 break the arc),
redrawn to those numbers, corrected twice by the owner's eye, and A/B'd above. Geometry:
[METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md); the account: [rung3/tuplets.md](rung3/tuplets.md).

**Why that redraw was worth doing:** the `\tup3` weakness is a trade made on purpose — the slur
distractors took precision 15.1% → 91.2% and pushed recall **92.7% → 83.8%**, under its floor and
below where it started, so the model now *misses* triplets rather than inventing them. Drawing the
mark unlike real print was the suspected cause, and the measurement held.

**The two tracks run in parallel, as re-scoped 2026-08-05:** the product track never trains, the model
track never touches the app, and neither waits for the other. [mvp/README.md](mvp/README.md).

**W8 (confidence highlighting) is DROPPED** — its pre-registered bar was not met and the bar was not
moved to fit. That leaves half of the 2026-07-27 goal unbuilt, and this line is the saying-so.
Measurement: [mvp/standing.md](mvp/standing.md).

⚠ **Two copyright items remain open and are both the owner's call**: the samples and the neyzen.com
screenshot are out of HEAD but remain in the **public** repo's git history (clearing them needs a
`filter-repo` rewrite and a force-push), and there is still **no LICENSE file**.
[THIRD-PARTY.md](THIRD-PARTY.md).

⚠ **Every human who has used the deployed app was on a phone, and n is still 2.** Of the three page
reads on 2026-08-08 one was the owner's Android and two came from elsewhere, both Android; the log
cannot say whether that is one stranger or two. `/health` fires on every page open, so `/decode` is
the honest counter. This is the first evidence touching "web first, mobile later" and it is **a
question, not a finding** — the friends' own reads can now move it (Track A item 5c).
[METRICS-USAGE.md](METRICS-USAGE.md).

## Previously — the settled context

Established findings live in two files, so this one can hold only "now" and "next". Neither contains
a next action.

| Track | Settled context |
|---|---|
| Product (W0–W9.7, the server, the three shipped features) | [mvp/standing.md](mvp/standing.md) — moved 2026-08-08 |
| Real pages (real-val v2, the re-slice, Round 3 pre-render checks, the Round 2 position) | [rung3/standing.md](rung3/standing.md) — moved 2026-08-07 |
| The feature track (F0's scheduler, F2's drums and how each stroke was identified, F1's voices) | [features/README.md](features/README.md) + [features/audio-sources.md](features/audio-sources.md) — the narrative left this file 2026-08-13 |
| What happened on any given day, and why | [log/status-log.md](log/status-log.md) |

## Next — two tracks, running in parallel

Since 2026-08-05 the product and the model advance independently: **the product track never trains,
the model track never touches the app.** Either can be worked on without waiting for the other.

### Track A — the product (W9 → W10 → public)

0. **Items 0, 0b, 1 and 2 are DONE and have been retired from this list** (the real drum samples,
   the ear-verified stroke tables, the F0+F2 deploy, the copyright redeploy — all 2026-08-09/11).
   They were each parked here "for one sitting"; that sitting has passed, and the account of every
   one of them is in [log/status-log.md](log/status-log.md). ⚠ Two traps they left behind live
   elsewhere now: `deploy:app` needs `--filter @turkish-omr/web` or `netlify-cli` hangs on a
   workspace prompt after a successful build and publishes nothing
   ([mvp/hosting-setup.md](mvp/hosting-setup.md)), and **`dev:cloud`, not deploying, keeps the Mac
   cool** ([../CLAUDE.md](../CLAUDE.md)).
3. **⛔ EDITOR STEP 9 IS DROPPED — `Save JSON` STAYS** (owner, 2026-08-15), superseding the
   2026-08-07 decision to delete it, which was never carried out. **`smoke:editor` reads the edited
   document by clicking `#save-json`**, so the button is the check's only view of what an edit did,
   and removing it would have to buy a new DOM seam first. **The editor's list is now complete: steps
   1–8 and 10, built, deployed and checked on the production bundle. There is no step 9.**
   [mvp/editor.md](mvp/editor.md) · [mvp/standing.md](mvp/standing.md) · [DECISIONS.md](DECISIONS.md).
3b. **✅ F3 IS BUILT (2026-08-16) — what is left is a LOOK, then a deploy, not more code.**
   ⛔ **Not deployed, not committed** — the live site does not have it (see "Now").
   ⏭ **THE NEXT PRODUCT ACTION, and the only one that needs a person, is
   [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) check 25**: open it, play a piece with
   Keman selected, and answer the two things no automated check can — does the dot sit where your
   finger would (open strings are the free calibration: the dot must be **at** the nut), and do the
   ticks read as information or as clutter? ⚠ Do **not** report the thin high positions as a finding;
   ~7 px per koma near the nut and less above is the shipped photo's known limit, and a
   higher-resolution bare-neck image fixes it with no code change. Everything it built, and the
   traps inside it, are in [features/README.md](features/README.md).
   **Then, and only after that look:** commit (staging by path — see "Now"), `npm run deploy:app`,
   `npm run smoke:live`. ⚠ `smoke:live` does not check images any more than it checks audio, so
   spot-check `/instruments/violin-vl100.png` for 200 after the deploy.
4. **⏸ Everything else about speed is DEFERRED to after W10** (owner, 2026-08-06): ship at **~35–55 s
   a page**. Splitting a page across instances (~52 s → ~13 s) is the only option that touches the
   warm wait — the cold start is just 10.6 s of it — and it costs a rate-limiter rewrite plus a
   chunked-vs-unchunked parity check. **The trigger to build it is a friend saying the wait is
   annoying**, which is exactly what W10 is for. Menu and prices: [mvp/latency.md](mvp/latency.md).
5. **DONE 2026-08-11 — W10 SHIPPED AND ANSWERED**: the link went to two friends, they liked it, and
   asked for **more instrument sounds** — which is what 5b built. The rung is complete. Account:
   [mvp/README.md](mvp/README.md).
5b. **✅ F1, INSTRUMENT VOICES — DONE 2026-08-14, AND THE FRIENDS LIKED IT.** Retired from this list;
   everything it built and every trap inside it is in [features/README.md](features/README.md),
   [features/audio-sources.md](features/audio-sources.md) and [features/kanun.md](features/kanun.md).
   ⚠ Three things outlive it. Ney has **no** CC0 source and needs the owner's own recording; oud and
   tanbur stay **Karplus–Strong**, code rather than files. `features/README.md` says any instrument
   past these three is aimed by what the friends say next — **not a queue to work down.** And if the
   voices should be louder the order is per-voice `gain` → a `Çalgı sesi` slider → **never**
   `MASTER_GAIN`; they are peak-matched, so sounding a few dB under the built-in tone is the trade
   and not a fault.

5c. **Cheap, independent, and still open — but it is NOT the next action; 3b is.** Read the request
   log now that real users exist. The
   "every human so far was on a phone" line rests on **n=2** and cannot be more than a question
   ([METRICS-USAGE.md](METRICS-USAGE.md)). The friends' own reads are the first data that can move
   it, and `/decode` is the honest counter (`/health` fires on every page open, robots included).
   This needs no feedback from anyone and answers a real planning question — "web first, mobile
   later" is a **plan**, not a finding, and two friends on phones would be evidence against it.
6. **Public launch** — a later rung, gated on Round 3's exam result, not on W10.

### Track B — the model (Round 3, UNPAUSED)

Still the **public-launch gate**, and still runnable at any time — it shares no file with the feature
track. It stopped being "the whole project's next move" when the owner picked F1 (2026-08-11); the
two now run in parallel exactly as the 2026-08-05 scoping intended.

1. ✅ **DONE 2026-08-15 — the acceptance bar is written AND SIGNED**, and it doubles as the
   public-launch gate: [rung3/round3-criteria.md](rung3/round3-criteria.md). Binding from here — not
   re-opened after the read, and the exam is still read **once**, on Round 3's final model.
1d. **THE `\tup3` A/B IS DONE (2026-08-15) — NULL, shape kept, no recall claim.** Retired to
   [rung3/standing.md](rung3/standing.md) on 2026-08-16 with every number and caveat, including why
   **not to re-run it**. Live consequences only: **`strips_v5_tupnew` is the corpus Round 3 continues
   from**, and **neither arm ships** — so `round2-stage2-best` stays the runtime.
1e. **NEXT ON THE TUPLET THREAD, but NOT next overall — and the target may have moved.** Reading the
   10 groups either arm missed showed the model **marks the first triplet of a passage and forgets the
   later ones** (recall 96%→81% by position, in both arms), which points away from the renderer
   entirely. ⚠ It is a **lead, not a finding**: one piece supplies 35% of that pool and 7 of the 8
   problem strips. **Settle it for free at Round 3's exam read** — split `\tup3` recall by
   first-in-strip vs later on the exam's 55 groups across many more pieces; the decode already runs.
   If it holds, the lever is the decode-side repair ([rung3/tuplets.md](rung3/tuplets.md) step 4), not
   the 35% slur-distractor rate. ⚠ Also owed, deferred: real print draws the arc **heavier** than we
   do, and that must change jointly with `drawSlurArc` or it becomes a thickness cue real pages do
   not have. ⚠ **No new
   labelling** — the tuplet queues are finished and promoted, whatever
   [rung3/labeling.md](rung3/labeling.md) said until 2026-08-11.
1f. ✅ **DONE 2026-08-15 — CAUSAL, on the pre-registered reading, and it replicates on the holdout.**
   The numbers are in the "Now" section above and [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md).
   What it settles: **the next render is a GEOMETRY render**, and item 2 below is sequenced behind it.
   ⚠ Two limits stated with the result rather than after it — **×2.00 extrapolates** below the exam's
   natural width range, and the probe **lowers** resolution, which is not the same as showing that
   raising it pays.
1g. **⛔ DONE AND STOPPED 2026-08-17 — Lever 1 step 2 ran and the pre-registered stop rule fired.**
   The full verdict is in "Now" above and [rung3/levers.md](rung3/levers.md); numbers in
   [METRICS-GEOMETRY.md](METRICS-GEOMETRY.md). ⏭ **What is left of it and is worth doing on its own:
   re-render the corpus at ONE measure per strip** (`render.ts --max-measures 1`) to close the
   16.0-vs-19.2 px *training* gap — +12.9% strips, the slicer untouched, so no decode cost and none of
   the short-crop risk that stopped the lever. It still needs a trained arm to claim anything.
   ⚠ **The short-crop hole is now the blocking item on this axis**, promoted from side condition: it
   was dropped in July on a disproved *mechanism* while its **cost** stayed confirmed, and it is what
   stops the only geometry arm that works. Anything that returns to crop geometry goes through it.
   ⚠ **Two things this item asserted are now measured and were wrong.** The rails are **not** "shared
   by the renderer and the slicer" — the renderer has no pixel-width rail at all — and the cost is not
   ~3×: corpus **+12.9%**, decode **1.22×**. ⚠ A third trap is recorded with the result rather than
   after it: pairing an arm with a lowered `MAX_STRIP_W` makes `_split_wide` cut **inside** measures
   (94.7% of crops), which silently tests the half-measure target instead of the lever.
   [rung3/levers.md](rung3/levers.md) · [METRICS-GEOMETRY.md](METRICS-GEOMETRY.md).
1h. **THE STACCATO DISTRACTOR IS BUILT AND MEASURED, NOT TRAINED** (owner, 2026-08-15).
   `--staccato-noise`, off by default; baseline **72.7%** false-dot rate against **0.0%** on the same
   music unmarked. What is owed is a **trained arm**, and the pre-registered floors it must clear are
   [rung3/levers.md](rung3/levers.md) Lever 6 — in particular clause 2, no regression on real dots
   **on easy+mid tiers only**. ⚠ `STACCATO_RATE` is **chosen, not measured**; counting staccato
   frequency in real editions is how to replace it. ⚠ Not sequenced ahead of 1g: it is a second
   render variable, and Round 3 has been unattributable twice already.
1a. ⭐ **NEW 2026-08-17, AND IT RE-ORDERS THE TRACK — THE CORPUS IS THE WRONG SHAPE, NOT JUST SMALL.**
   The owner reported from **using the product** that it makes many mistakes "especially in classical
   parts", *including on clean computer-generated PDFs*. Measured on the spent Round-2 dump:
   **non-şarkı runs 1.73× şarkı's edits/token, beste/nakış ~2.9×** ([METRICS-EXAM.md](METRICS-EXAM.md)).
   Training is **52.9% şarkı**; the **exam is 68.9% şarkı**, so it is *more* song-weighted than the data
   and nearly blind to the defect. ⛔ **And it cannot be fixed by labelling harder: the nota pool is
   86.0% şarkı and holds only 118 strips of the expensive forms.** The music is not on disk.
   ⏭ **So COLLECTION becomes the first move, not an extra** — specifically peşrev/beste/nakış/kâr/semai.
   Sizing: **~25–30 pages of those forms ≈ 500 strips**, taking them from ~5% to ~20% of the real
   fine-tune set. Exam growth on the same forms is the other half and must precede the next read.
   ⚠ **A number I quoted was misleading and is corrected here**: the "94.8% on clean pages" tier figure
   is **accidental** accuracy only, not page-level correctness — it never measured pitch or duration,
   which are 68% of user fixes. The owner's hands-on report is the better evidence, and it is why the
   clean-first launch idea below needs measuring rather than assuming. Lever:
   [rung3/levers.md](rung3/levers.md) Lever 1b.
1h2. **⏭ IN PROGRESS — THE OWNER IS HAND-CORRECTING REAL LABELS THIS WEEK** (owner, 2026-08-17),
   chosen over more synthetic experiments. The case: of the real labels checked so far in the nota
   pool, **531 needed fixing against 167 that were fine** — three in four wrong — and pitch is 40% of
   what a user corrects, so dirty pitch labels cap the metric Round 3 is graded on no matter what the
   renderer does. Queue: **`reslice-all`** in `review_ui.py` (33,639 of 33,804 pending, worst-first).
   ⚠ **Attend to PITCH AND DURATION, not accidentals** — every audit so far chased accidentals because
   the old headline measured them; this axis has never been audited.
   ⚠ **The queue choice is load-bearing and was nearly got wrong.** The owner asked whether the pools
   were stale; measured, they are — but only some. `reslice-all` reads `strips_v2` and keeps **100%** of
   labels under today's slicer; the nota/exam-fix/r1/tup queues read the July 15–17 crops and would
   **void 90%** of them ([METRICS-SLICER.md](METRICS-SLICER.md)). Run
   `scripts/rung3/check_crop_staleness.py` before any future labelling push.
   ⚠ Consequence: the 531 existing `fix` verdicts are **stranded** on old crops. They evidence bad
   auto-derived labels; they are not corrections we can bank.
1i. **NEW 2026-08-17 — MEASURE THE TUPLET DIGIT'S POSITION, RENDER NOTHING** (owner, from a real
   page). The "3" is set **between the curve and the noteheads**, inside the arc's concavity — neither
   shape we have drawn. ⚠ Possible counterexample to *"16 of 16 marks break the arc"*
   ([rung3/tuplets.md](rung3/tuplets.md)), a sample small enough for one to exist. Run
   `tuplet_mark_probe.py` and have a **person** accept each tile, as before; if it confirms it enters
   as a per-piece coin like bracket-vs-curved, i.e. a Lever-4 diversity item, not a correction. ⚠ Not
   in the geometry render — a third mark style there is a second variable. ⚠ Expect little on recall:
   the shape A/B was null and the surviving lead points away from the renderer.
1j. **NEW 2026-08-17 — LEVER 4 (RENDERER DIVERSITY) NOW RUNS BEFORE THE CONTENT WORK** (owner),
   re-ordering item 2 below. One engine, one font, staff-spacing SD **zero** across all 40,826 strips;
   real LilyPond via `tools/render/lilypond.ts` is a second engraver at no labelling cost. ⚠ Its hard
   constraint is pixels == labels, and `verify-labels.ts` is the gate. [rung3/levers.md](rung3/levers.md).
1k. **NEW 2026-08-17 — COLLECT REAL PAGES BROADLY FROM MORE SOURCES** (owner), past neyzen.com and
   notaarsivleri.com. ⚠ **A cost was raised and overruled**: 2,486 page PNGs are already on disk
   unlabelled, so this does not relieve the bottleneck, which is labelling throughput
   ([METRICS-CORPUS.md](METRICS-CORPUS.md)). Both halves are in [DECISIONS.md](DECISIONS.md). Two rules
   hold regardless: read each new source's licence before redistributing anything
   ([THIRD-PARTY.md](THIRD-PARTY.md)), and keep **refusing exam pieces** in any flow feeding training.
2. **The content work in `select_pieces.py`** — what Round 3 actually *is*: eighth/quarter-note mix
   and bar-line density (owner decision 2026-07-27: these only; ties and accidentals stay out). **Not
   cancelled and not superseded — sequenced behind 1g, and since 2026-08-17 behind Lever 4 (1j) too**,
   because the note-value mix changes how wide a
   measure is and therefore moves the geometry variable as a side effect; rendering both at once would
   leave Round 3 unattributable for the third round running. ⚠ Our strips are already **wider** than
   the real pools' and denser music widens them further, so the selection needs a **strip-width
   target**, not only a note-value histogram ([rung3/levers.md](rung3/levers.md)).
   Verify on a 300-strip pilot with `domain_gap.py` **before** regenerating the piece list.
   Guard: check the accidental counts before and after on the same pilot and treat a drop as a stop
   sign, not a trade. ⚠ The live list is **`data/pieces_v4.json`**, not `data/pieces.json` — a new
   selection needs its own filename **and its own split** (`scripts/make_split.py`), because
   `split_v4.json` covers exactly the 208 pieces of `pieces_v4.json` and a piece outside it is dropped
   from training in silence. ⚠ Changing the piece list also changes which real strips are val-side
   (`is_real_val_piece` takes the synthetic val list as input), so `_realval_v2` and `_tupletval`
   must be re-checked, not assumed.
3. **Decide whether to re-emit the training pools from the new crops.** The re-slice is done; this
   is the separate decision it unlocks, **not** a formality — re-emitting rewrites the manifests the
   promoted verdicts hang off, so it needs its own `--out` and a look at what moved first. ⚠ **The
   framing under this item was narrowed 2026-08-15.** It used to weigh re-emission against "Round 3's
   target is a synthetic content mix problem, not a shortage of real strips (2,330 accepted)". The
   count is still not the issue — but **label noise on the axis Round 3 targets is**: the nota pool's
   audited pitch-level error rate sits under a target where pitch is 40% of user edits
   ([METRICS-CORPUS.md](METRICS-CORPUS.md)), and every audit so far aimed at accidentals. So "more
   real strips" stays unpersuasive while **auditing the pitch/duration axis, and growing exam PAGES
   rather than strips**, moved onto the list: [rung3/levers.md](rung3/levers.md) Lever 3.

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

## Open risks and non-claims

Moved to **[RISKS.md](RISKS.md)** on 2026-08-17, when this file crossed the 400-line cap. Genre
split: this file states current state and the next action; standing caveats are neither, and they
were crowding out the two things this file exists to say.

⚠ **Read it before quoting any number or believing any green check.** It carries, among others: the
±12-point interval on Round 3's primary floor, why a cold start has never been measured on a
genuinely idle service, why real-val orders models but does not predict the exam (28 pp), why the AEU
headline is fragile to low-n classes, and the four things that separate a Round-3 model from
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
