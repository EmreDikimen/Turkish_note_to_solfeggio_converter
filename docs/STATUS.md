# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-19

## Now

⭐ **ROUND 3 HAS AN ORDER: FOUR TRAINED ARMS, ONE VARIABLE EACH, AND THE FIRST NEEDS NO RENDER**
(owner, 2026-08-19). **The scan profile → one measure per strip → the staccato arm → the final
model**, then the exam is read once. **No two run together** — Round 3 has been unattributable twice
already. The table, what each is scored on, and the one asymmetry that would tempt you to combine
them: [rung3/levers.md](rung3/levers.md).

⭐ **THE LABELLING MOVED TO THE SCANNED PAGES AND `batch3` IS CUT AND OPEN** (owner, 2026-08-19,
superseding the 2026-08-18 clean-pages-first call). **93% of exam pages are scans**, so `batch2` was
cut entirely from the tier supplying **7%** of the medium Round 3 is graded on; and `batch2`'s own fix
rate came in at **~12%** against **30%** in the scanned nota pool. A batch row is seeded with the
decode, so an `ok` changes the training data by nothing — **the yield of a batch is its *fix* rate.**
⛔ **`batch1` is not the answer and stays parked**: it ranks the most damaged pages corpus-wide, so it
concentrates the deferred handwritten manuscript, and 10 of its 52 pages are born-digital anyway.
⚠ **The scanned tier costs something the born-digital one did not**: it contains handwriting, and
**24% of its pages are stale** — 28 of 71 pages had to be excluded before the batch was clean.
[METRICS-CORPUS.md](METRICS-CORPUS.md) · [rung3/labeling-queues.md](rung3/labeling-queues.md).

⛔ **ROUND 3'S ARM 1 RAN AND IT IS A NULL. The scan profile changed nothing on scanned pages**
(2026-08-19): paired over 197 strips, `best` **+0.071** edits/strip (p = 0.105) and `last`
**+0.010** (p = 0.488), both intervals spanning zero — and the interval excludes anything better
than a **~5% reduction**, so the effect is absent rather than unresolved. The no-regression clause
on born-digital pages **passes**, point estimate favouring the arm and also spanning zero.
**Reported as a null; the mix is not re-tuned.** ⏭ One question is left open and it is the owner's:
does the profile stay ON in the final model? ⚠ Two findings came out of building it: **no augmented
image in this project is reproducible from a seed** (albumentations 2.0.8 seeds from OS entropy),
and **the `hard` tier is not the hard one** — its gold is decode-seeded, so it scores better than
mid, which moved the arm's primary to a medium split before signing.
[rung3/scan-profile.md](rung3/scan-profile.md) · [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md).

⚠ **THAT IS THREE NULLS ON THE SAME AXIS, AND THE THIRD IS A TRAINED ARM.** Tuplet mark p = 0.688,
the second engraver's domain gap null, now the scan profile. "Make the synthetic pixels look more
like real pages" was *inferred* to be at diminishing returns; it is now measured that way. Arms 2
and 3 are on different axes and stand. A fourth realism arm does not. [DECISIONS.md](DECISIONS.md).

✅ **LEVER 6 CLAUSE 2 IS SETTLED — the exclusion stands, the reason is replaced** (owner,
2026-08-19), taken **before** the arm was trained rather than after seeing a result. The
`nd`-as-degradation justification was void; the exclusion survives because hard tier carries ~12
real-dot instances in total and its gold is the least reliable pool we own. The gate does not move a
point.

⛔ **THE TUPLET DRAWING THREAD IS CLOSED AND NO ARM BELONGS TO IT.** The A/B ran and was null
(p = 0.688); the shape is kept on the print measurement alone. Two items survive and neither costs a
render or a run: the **position lead** — the model marks the first triplet of a passage and forgets
the later ones, 96% → 81%, in both arms — is settled **for free at the exam read**, and the
**digit-in-the-concavity probe** is a person looking at tiles. [rung3/tuplets.md](rung3/tuplets.md).

⭐ **THE SECOND ENGRAVER EXISTS, ITS GATE PASSES 312/312 — AND IT BOUGHT NO MEASURABLE REALISM.**
**LilyPond 2.26** renders our own labels, because its `makam.ly` draws all eight AEU accidentals under
the *same* comma→glyph convention Bravura does — checked glyph by glyph, not assumed. A 312-strip
pilot passed the new pixels-vs-labels gate **312/312, 501 accidentals**; a whole corpus would cost
**~76 min**. ⛔ **The domain gap did not move** against a matched VexFlow control: every column the
instrument can see is null or slightly further from real pages. **Reported as a null, not re-aimed.**
⚠ Two limits sit with it: `domain_gap.py` is blind to most of what an engraver changes, and this
arm's **staff geometry was pinned on purpose**, so the "spacing SD is zero" third of the premise is
**still untouched**. **Lever 4 gets no trained arm and no corpus.**
[METRICS-ENGRAVER.md](METRICS-ENGRAVER.md) · [rung3/levers.md](rung3/levers.md).

⛔ **LEVER 1 IS SPENT: THE GEOMETRY PILOT RAN AND THE PRE-REGISTERED STOP RULE FIRED.** The padding
probe was causal (+59%, holdout +61%), but the reverse **cannot be bought**: beating the exam's own
19.2 px needs crops narrower than one measure, and that target measured **+31.8% worse**; the
real-side 1-measure arm tripped the short-crop stop rule at **5.4×** the control. ✅ What survives is
arm 2 below. ⚠ The **short-crop hole is now the blocking item** on this axis, and both of the lever's
cost estimates were wrong (decode **1.22×**, not ~3×). [METRICS-GEOMETRY.md](METRICS-GEOMETRY.md).

⚠ **A line that read as closed is partially re-scoped.** "Resolution was ruled out" in
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

✅ **F1 IS DONE, HEARD AND LIVE (2026-08-14)** — `Çalgı sesi` offers Klarnet, Keman and Kanun; four
rounds of ear feedback each caught a real measurement error no green check saw, all closed. The whole
account: [features/README.md](features/README.md), [features/audio-sources.md](features/audio-sources.md),
[features/kanun.md](features/kanun.md). ⚠ **The trap that outlives it**: voices ride
**`VITE_VOICES_URL`**, the drums ship with the app, and setting `VITE_AUDIO_URL` in a deploy 404s the
drums into the synthesis the owner rejected — silently ([../CLAUDE.md](../CLAUDE.md), [DECISIONS.md](DECISIONS.md)).

✅ **F3 IS BUILT AND DEPLOYED (2026-08-16 / 2026-08-18) — <https://komavision.netlify.app> HAS THE
VIOLIN FINGERBOARD TAB.** A third view beside Nota and Piyano rulosu: a violin neck, a dot that
follows the audio clock, and a tick at **every position the loaded score itself uses** on each string,
so the uneven microtonal spacing on screen is the music's, not a diagram's. `Deploy is live!` was read
out of the output rather than inferred from exit 0; `smoke:live` **PASS on both paths** (server 47.8 s,
Hub fallback 67.6 s, identical 9/26/399/26), and the two assets it cannot see were spot-checked by
hand. ⚠ **The tuning question was answered first**: standard Sol–Re–La–Mi on this project's 53-TET
grid, table left open, and low written passages that sound below the open Sol are reported
`out-of-range` rather than clamped ([DECISIONS.md](DECISIONS.md), [features/README.md](features/README.md)).

⛔ **IT WENT OUT WITHOUT CHECK 25, ITS WRITTEN PRE-CONDITION** — skipped on the owner's instruction,
not overlooked. **Nothing about the fingerboard has been seen by a person**, and every automated check
reads the *same geometry the drawing does*, so none can say the dot is where a violinist would put the
finger or whether the ticks inform or clutter. That look is
**[MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) check 25** and it is still Track A's next
action (item 3b) — now on a page two friends can open, which is the cost of the inverted order.

✅ **THE TREE IS COMMITTED as of 2026-08-19** (checked with `git status` after committing, not
believed): the scan profile, `batch3`'s cut, the two new scoring scripts, the arm's raw Colab log and
every doc edit behind them are in, as two commits — the code, then the docs. ⚠ **Worth knowing before
reading `git log`:** the 2026-08-17 subject *"the classical-forms lead was scan quality, and the docs
say so"* names an explanation **withdrawn the next day** as circular. The commit is history and stays;
the subject is not current.

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

**W8 (confidence highlighting) is DROPPED** — its pre-registered bar was not met and the bar was not
moved to fit. That leaves half of the 2026-07-27 goal unbuilt, and this line is the saying-so.
Measurement: [mvp/standing.md](mvp/standing.md).

**The two tracks run in parallel, as re-scoped 2026-08-05:** the product track never trains, the model
track never touches the app, and neither waits for the other. [mvp/README.md](mvp/README.md).

## Previously — the settled context

Established findings live in these files, so this one can hold only "now" and "next". None contains a
next action.

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

⏭ **THE NEXT ACTIONS ARE BOTH THE OWNER'S, and they run in parallel** — every agent-side step either
side of them is done (2026-08-19). **B2** is the labelling; **B3** now needs one Colab run.

**B1. ✅ `batch3` IS CUT — 54 pages / 1,499 strips from the SCANNED tier, and the queue is open** in
   `review_ui.py` (`batch3` tab, crop root `data/real/strips_v2`). `batch2`'s 68 verdicts went home
   first; `--scanned`, `--exclude-pages` and `--stats` are in `build_label_batch.py`.
   **28 pages were excluded over four cut/check rounds**: 11 free-hand **handwritten** (a deferred
   category — the narrow rule keeps professionally hand-copied editions, which most of the corpus and
   the exam are), and **17 stale — 24% of the pages checked** — whose crops no longer re-slice to the
   same music. Every page in the batch is verified: 0 void. ⚠ The exclusions cost the
   highest-evidence pages in the tier (evidence/page 46.3 → 43.0), and that trade is the owner's, on
   the record. ⚠ **Training only** — the ranking selects the worst pages in its tier, so nothing cut
   here may become exam gold. [rung3/labeling-queues.md](rung3/labeling-queues.md).

**B2. ⏭ THE OWNER HAND-CORRECTS REAL LABELS — the `batch3` tab is waiting** (owner, 2026-08-17,
   re-aimed 2026-08-19). The case is unchanged: of the real labels checked in the nota pool, **531
   needed fixing against 167 that were fine**, and pitch is 40% of what a user corrects, so dirty
   pitch labels cap the metric Round 3 is graded on no matter what the renderer does.
   ⏭ **Probe 100 rows before committing to all 1,499**, then read
   `build_label_batch.py --stats --batch 3` for the fix rate **and** the bad rate — a row is seeded
   with the decode, so an `ok` changes the training data by nothing and **the yield of a batch is its
   fix rate**. Reference points: ~30% (scanned nota pool), ~12% (`batch2`), 33% crops lost
   (`realval-hard`). Verdicts go home with `--merge-back`, so `reslice_all.csv` stays the record.
   ⚠ **Attend to PITCH AND DURATION, not accidentals** — every audit so far chased accidentals
   because the old headline measured them; this axis has never been audited.
   ⚠ The 531 existing `fix` verdicts are **stranded on old crops**: they evidence bad auto-derived
   labels, they are not corrections we can bank ([METRICS-SLICER.md](METRICS-SLICER.md)).
   ⚠ Only the **final** model consumes this work, so B3–B5 do not wait for it — **B2 and B3 may run
   in either order, or at the same time.** ⛔ But **do not run `promote_labels.py`, and do not start
   B8, until the scan arm has been read**: labelling is safe (a verdict lands in `reslice_all.csv`
   and nowhere else), while promotion rewrites the real pools' manifests — and the arm shares those
   pools with its control, so a promotion between now and the read makes it differ in **corpus and
   mix** ([rung3/scan-profile.md](rung3/scan-profile.md)).

**B3. ⛔ ARM 1 — THE SCAN PROFILE: RAN, SCORED, NULL.** Trained on Colab (L4, ~2.6 h), scored paired
   against `r3-tupnew-stage2-best` on both checkpoints, both null on the primary with the clause
   passing. Written up in full; the raw console log is kept this time
   ([round_3_scan_logs.md](../round_3_scan_logs.md)) because the tuplet A/B's was lost.
   ⏭ **The only thing owed is a decision, not work: does `scan_share=0.25` stay ON in the final
   Round-3 model?** It is off by default in code, so doing nothing = leaving it out. It costs
   nothing and did not hurt; the born-digital point estimate favours it; and "keep it because it
   didn't hurt" is a choice made on two nulls. Owner's call.
   [rung3/scan-profile.md](rung3/scan-profile.md) · [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md).

**B4. ⏭ ARM 2 — ONE MEASURE PER STRIP. This is now the next model action.** `render.ts --max-measures 1`, closing the 16.0-vs-19.2 px
   *training* gap: +12.9% strips, slicer untouched, so no decode cost and none of the short-crop risk
   that stopped Lever 1. ⚠ Pairing it with a lowered `MAX_STRIP_W` makes `_split_wide` cut **inside**
   measures (94.7% of crops) and silently tests the half-measure target instead of the lever.
   [METRICS-GEOMETRY.md](METRICS-GEOMETRY.md).

**B5. ARM 3 — THE STACCATO ARM.** Built and measured, not trained: `--staccato-noise` off by default,
   **72.7%** false-dot rate against **0.0%** on the same music unmarked, `verify-labels` PASS
   1215/1215 with the marks on. Floors: [rung3/levers.md](rung3/levers.md) Lever 6, clause 2 now
   settled. The trade is **duration over pitch** (owner). ⚠ `STACCATO_RATE` is **chosen, not
   measured**; counting staccato frequency in real editions is how to replace it.

**B6. ARM 4 — THE FINAL MODEL, then the exam, read ONCE.** ⏭ Add one free column to that read: split
   `\tup3` recall by first-in-strip vs later, which settles the tuplet position lead over the exam's
   55 groups across many more pieces ([rung3/tuplets.md](rung3/tuplets.md)).

**B7. The content work in `select_pieces.py`** — the eighth/quarter-note mix and bar-line density
   (owner, 2026-07-27: these only; ties and accidentals stay out). **Not cancelled and not superseded
   — sequenced behind all four arms**, because the note-value mix changes how wide a measure is and
   would move the geometry variable as a side effect. ⚠ Our strips are already **wider** than the real
   pools' and denser music widens them further, so the selection needs a **strip-width target**, not
   only a note-value histogram; verify on a 300-strip pilot with `domain_gap.py` **before**
   regenerating the piece list, and treat a drop in accidental counts as a stop sign, not a trade.
   ⚠ The live list is `data/pieces_v4.json`, and a new selection needs its own filename **and its own
   split** — a piece outside `split_v4.json` is dropped from training in silence. ⚠ It also changes
   which real strips are val-side, so `_realval_v2` and `_tupletval` must be re-checked, not assumed.

**B8. Decide whether to re-emit the training pools from the new crops.** The re-slice is done; this is
   the separate decision it unlocks, **not** a formality — re-emitting rewrites the manifests the
   promoted verdicts hang off, so it needs its own `--out` and a look at what moved first. ⚠ "More
   real strips" stays unpersuasive (2,330 accepted); **label noise on the axis Round 3 targets** is
   the live problem, which is what B2 attacks, alongside growing exam PAGES rather than strips
   ([rung3/levers.md](rung3/levers.md) Lever 3).

⚠ **Two items are measurements, not arms, and render nothing.** The **tuplet digit's position**
(`tuplet_mark_probe.py`, a person accepting each tile — a per-piece coin if it confirms, not a
correction), and **collecting real pages broadly from more sources** (owner, 2026-08-17), where a cost
was raised and **overruled**: 2,486 page PNGs already sit on disk unlabelled, so it does not relieve
the bottleneck, which is labelling throughput. Two rules hold regardless — read each new source's
licence before redistributing ([THIRD-PARTY.md](THIRD-PARTY.md)), and keep **refusing exam pieces** in
any flow feeding training. ⚠ **The musical-form lead is DEAD** (owner retest, 2026-08-17) and must not
be re-derived ([log/superseded.md](log/superseded.md)).

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
