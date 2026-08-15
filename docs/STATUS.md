# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-15

## Now

⭐ **A FIFTH ROUND-3 CHECK WAS ADDED AND IT IS THE FIRST ONE THAT IS NOT ABOUT WHAT WE DRAW: the
encoder is given a strip and throws half of it away.** The frame is a fixed 409×583, so a median
strip arrives downscaled by half with **61% of the frame spent on black padding**, and one note
position lands on ~7 px. Re-aligning the spent Round-2 exam decode and pinning the confounds one at a
time, **the most-squashed third costs 2.4× the edits per token at matched musical density**; holding
length fixed keeps the effect, holding width fixed removes it — so it is resolution, not sequence
length. ⚠ **Observational, ~40 strips a bucket, and the causal test has NOT been run** — that is the
next action below. Numbers: [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md). What it implies, and the
four other levers nobody has pulled: [rung3/levers.md](rung3/levers.md).

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

✅ **THE `\tup3` A/B RAN, AND IT IS A NULL — the redrawn mark stays, and no recall claim is made.**
Two arms on the identical recipe, over corpora **row-for-row identical to `strips_v4` apart from the
mark**: `\tup3` recall **88.9% (new) vs 85.2% (control)** on `_tupletval` — **2 net groups of 54**,
paired 4-vs-2 discordant, **exact McNemar p = 0.688** against a pre-registered ~6-group threshold.
Precision cleared its veto (98.0% / 95.8%) and the `_realval_v2` guard passed (mean AEU F1 83.9% vs
83.3%). The null branch of the rule written *before* the render applies: **keep the shape** — it
stands on the print measurement (16/16 marks, ~11 editions), not on recall — and claim nothing either
way. ⚠ **Not "the shape doesn't help"**: 54 groups cannot resolve under ~11 pp, and ~5 was the hope.
⚠ **The `_realval_v2` `\tup3` split (91.4% vs 80.0%) is NOT a second result** — those 35 groups are a
subset of these 54. [METRICS.md](METRICS.md) · [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md).

✅ **The control also answered a question nothing else could**: it scored **85.2%, exactly
`round2-stage2-best`'s score on the same pool** — so `staff_jitter`, the rasterizer drift and a fresh
training environment moved this class by **zero, together**. Reassuring for Round 3's attribution,
and only learnable by training the arm. ⚠ Reading the misses afterwards produced a **lead** worth
more than the A/B did — see Track B item 1e.

⚠ **`data/pieces.json` is stale and cost a full corpus render.** `strips_v4` and `data/split_v4.json`
were both built from **`data/pieces_v4.json`** (208 pieces vs 190), but the documented command named
the older file. The wrong render completed and looked normal — 23 of Round 2's pieces missing, 528
strips in neither side of the split, dropped in silence at train time. Fixed beside the command in
[../CLAUDE.md](../CLAUDE.md).

✅ **F1 IS DONE, HEARD AND LIVE (2026-08-14)** — `Çalgı sesi` offers **Klarnet**, **Keman** and
**Kanun** beside the built-in tone, 62 CC0 files on the Hub, deployed and `smoke:live` PASS on both
paths. Four rounds of ear feedback each corrected a real measurement no green check caught (breath on
16th notes, too deep a trim, the kanun a whole koma sharp, its attack landing before the pluck) and
all four are closed and guarded. The account, and every number: [features/README.md](features/README.md),
[features/audio-sources.md](features/audio-sources.md), [features/kanun.md](features/kanun.md).
⚠ **The one operational trap that outlives the work**: the voices are hosted on **`VITE_VOICES_URL`**
and the drums ship with the app — setting `VITE_AUDIO_URL` in a deploy would 404 the drums into the
synthesis the owner rejected, silently ([../CLAUDE.md](../CLAUDE.md), [DECISIONS.md](DECISIONS.md)).

✅ **F3 IS SCOPED — THE VIOLIN AND ONLY THE VIOLIN — AND ITS ARTWORK HAS LANDED** (owner,
2026-08-15). It is Track A's next action, item 3b. What was actually in the way turned out to be one
bullet, not the work: `features/README.md` demanded **own artwork**, which read as *you must draw a
violin*. F3 needs a **fingerboard**, not a violin, and the rule was protecting **provenance** rather
than banning third-party pixels — so it is amended, not dropped. A CC0 image whose chain has been
read now counts; an unlicensed one still does not.
`apps/web/public/instruments/violin-vl100.png` is CC0 1.0 from Wikimedia Commons, and ⚠ **its
derivation was followed rather than assumed**, because CC0 on a user-upload site is the uploader's
claim and a CC0 derivative of a restricted photo would be worthless.
[THIRD-PARTY.md](THIRD-PARTY.md) · [DECISIONS.md](DECISIONS.md).

⚠ **Opening the image corrected the plan written before it was downloaded**, which is the part worth
keeping. The advice had been that a neck crop puts the bridge out of frame and forces a three-point
projective calibration; the real file is a **straight-on front view with the nut and the bridge both
in frame**, so it is the easy two-points-per-string case. The limit is elsewhere and is the thing to
design against: the nut→bridge run is ~580 px, putting a koma at roughly **7 px near the nut** and
less higher up — so the **high positions** are where this image runs out. A bare-neck photo at higher
resolution is the upgrade, and because the calibration is *data* a swap costs no code.

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
3b. **⏭ THE NEXT PRODUCT ACTION — F3, the fingerboard tab, VIOLIN ONLY** (owner, 2026-08-15). Show
   where the finger goes as the piece plays. It is the last designed-not-started feature, it is
   client-side (no server, no GPU, no ML), and it runs beside Round 3 without touching it. A fretless
   position is the exact formula `length × (1 − openStringFreq / noteFreq)`, so **all 53 komas land
   exactly — a 12-tone app cannot draw a koma position at all**, which is what makes this the feature
   worth having. ✅ The artwork is **in hand and CC0**: `apps/web/public/instruments/violin-vl100.png`
   ([THIRD-PARTY.md](THIRD-PARTY.md)). ⚠ **Blocked on one answer only, and it is the owner's:** the
   four open strings — standard G3–D4–A4–E5 or a Turkish keman tuning. Everything else takes them as
   data and can be built first. Brief, and the two things measured off the image itself:
   [features/README.md](features/README.md).
4. **⏸ Everything else about speed is DEFERRED to after W10** (owner, 2026-08-06): ship at **~35–55 s
   a page**. Splitting a page across instances (~52 s → ~13 s) is the only option that touches the
   warm wait — the cold start is just 10.6 s of it — and it costs a rate-limiter rewrite plus a
   chunked-vs-unchunked parity check. **The trigger to build it is a friend saying the wait is
   annoying**, which is exactly what W10 is for. Menu and prices: [mvp/latency.md](mvp/latency.md).
5. **DONE 2026-08-11 — W10 SHIPPED AND ANSWERED**: the link went to two friends, they liked it, and
   asked for **more instrument sounds** — which is what 5b built. The rung is complete. Account:
   [mvp/README.md](mvp/README.md).
5b. **✅ F1, INSTRUMENT VOICES — DONE 2026-08-14, AND THE FRIENDS LIKED IT** (owner, 2026-08-15).
   Klarnet, Keman and Kanun: uploaded, deployed, `smoke:live` PASS on both paths, check 24 closed
   after four ear-passes. Retired from this list — everything it built, every number, and the traps
   inside it are in [features/README.md](features/README.md),
   [features/audio-sources.md](features/audio-sources.md) and [features/kanun.md](features/kanun.md).
   ⚠ Three things outlive it. Ney has **no** CC0 source and needs the owner's own recording; oud and
   tanbur stay **Karplus–Strong**, code rather than files. `features/README.md` says any instrument
   past these three is aimed by what the friends say next — **not a queue to work down.** And if the
   voices should be louder the order is per-voice `gain` → a `Çalgı sesi` slider → **never**
   `MASTER_GAIN`; they are peak-matched, so sounding a few dB under the built-in tone is the trade
   and not a fault.

5c. **Cheap and newly possible: read the request log now that real users exist.** Until today the
   "every human so far was on a phone" line rested on **n=2** and could not be more than a question
   ([METRICS-USAGE.md](METRICS-USAGE.md)). The friends' own reads are the first data that can move
   it, and `/decode` is the honest counter (`/health` fires on every page open, robots included).
   This needs no feedback from anyone and answers a real planning question — "web first, mobile
   later" is a **plan**, not a finding, and two friends on phones would be evidence against it.
6. **Public launch** — a later rung, gated on Round 3's exam result, not on W10.

### Track B — the model (Round 3, UNPAUSED)

Still the **public-launch gate**, and still runnable at any time — it shares no file with the feature
track. It stopped being "the whole project's next move" when the owner picked F1 (2026-08-11); the
two now run in parallel exactly as the 2026-08-05 scoping intended.

1. ✅ **DONE 2026-08-15 — the acceptance bar is written AND SIGNED**:
   [rung3/round3-criteria.md](rung3/round3-criteria.md). **≥75% of exam pages needing ≤5 corrections**
   (Round-2 baseline 57%), doubling as the public-launch gate; the accidental measures are
   no-regression clauses at their Round-2 values. Binding from here: not re-opened after the read,
   and the exam is still read **once**, on Round 3's final model.
1b. **DONE 2026-08-12 and retired from this list — the mark was measured against real print, redrawn,
   and judged by the owner.** Geometry and the two corrections that came back:
   [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md); the account, including the comparison sheet and
   its ⚠ local-viewing-only caveat: [rung3/tuplets.md](rung3/tuplets.md).
1d. **THE `\tup3` A/B IS DONE (2026-08-15) — NULL, shape kept, no recall claim.** Both arms trained and
   read; the numbers and the caveats are in the "Now" section above, [METRICS.md](METRICS.md) and
   [rung3/tuplets.md](rung3/tuplets.md). **`strips_v5_tupnew` is the corpus Round 3 continues from**,
   and **neither arm ships** — the exam is unread and neither is a Round-3 model, so
   `round2-stage2-best` stays the runtime. ⚠ Do **not** re-run this A/B hoping for a cleaner answer:
   the exam and every real pool together hold too few `\tup3` groups to resolve ~5 pp, so the way to
   answer it is more tuplet gold, not another pair of runs.
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
1f. **⏭ THE NEXT ACTION — the crop-geometry probe. Half a day, no GPU, no render.**
   `scripts/rung3/crop_geometry_probe.py --make-padded …` widens exam crops with `BORDER_REPLICATE`,
   which lowers the resolution the encoder sees while leaving content and gold **identical**, then
   `eval_omr.py` reads each pad factor. **Pre-registered in [rung3/levers.md](rung3/levers.md) before
   the run: monotone rise in edits/token → resolution is causal and the next render is a geometry
   render; flat within noise → the correlation is a confound and the lever is dropped in writing**,
   like the five checks before it. It is first because its answer changes *what* item 2 should render,
   and because it is the cheapest measurement left. ⚠ It is a second look at a spent exam read and
   must be written up as one; the Round-3 exam is still read once, on the final model.
2. **The content work in `select_pieces.py`** — what Round 3 actually *is*: eighth/quarter-note mix
   and bar-line density (owner decision 2026-07-27: these only; ties and accidentals stay out). **Not
   cancelled and not superseded — sequenced behind 1f**, because the note-value mix changes how wide a
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
   promoted verdicts hang off, so it needs its own `--out` and a look at what moved first. Weigh it
   against the evidence that Round 3's target — pitch (40%) and duration (28%) of user edits — is a
   *synthetic content mix* problem, not a shortage of real strips (2,330 accepted already).

### Cheap, owed, and independent of both

1. **The deskew *estimator* is validated on 132 pages, not the corpus** — every full run injects
   Python's angle. It used to cost ~18 h of browser time; at 1.3 s/page a full un-injected corpus
   run is now well under an hour, so this is worth simply doing.

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

6. **⬆ THE FEATURE TRACK LEFT THIS SECTION on 2026-08-15** — F0, F2 and F1 are done and F3 is now
   **Track A item 3b**, the next product action, scoped to the violin. This line stays only to say
   where it went. ⚠ One caveat from here still holds and is now recorded in
   [features/README.md](features/README.md): F3 was supposed to be aimed by what the friends say
   next, and it is being built on the owner's own call instead — the friends were asked once (W10)
   and said "more instrument sounds", which F1 delivered. **The audio is settled** (2026-08-09):
   drums, clarinet, violin and kanun all shipped under **CC0**, licences read per file, no NC
   anywhere; **ney alone** still needs the owner's own recording, and oud and tanbur stay
   Karplus–Strong. Files: [features/audio-sources.md](features/audio-sources.md).

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 numerics
investigation — now two instances, a dropped double dot (Round 1) and a dropped `\tup3` (Round 2),
both reference-path only and both fine under Python-ORT int8.

## Open risks and non-claims

- **NEW (2026-08-15): the primary Round-3 floor is measured on 46 pages, so its 95% interval is
  roughly ±12 points.** A model truly at 72% can read 78% and vice versa. The criteria are signed and
  are **not re-opened**; what is still open, and is the owner's call **before** the read, is whether
  to grow the exam first (v3 is already owed) or to read it as signed and report the interval beside
  the result. Choosing after seeing the number is the one option that is not available.
  Reasoning: [rung3/levers.md](rung3/levers.md).
- **NEW (2026-08-15): the crop-geometry finding is observational.** ~40 strips a bucket, on crops cut
  by the retired slicer, and no causal test has run yet. Nothing renders on it until the padding
  probe reads. ⚠ The same file also records the trap in acting on it: narrow crops make the
  **short-crop hole** the common case, and short crops are the worst thing this model reads.
- **STILL OPEN: the cold-start fix is proven on a FAKED cold window, not on a genuinely idle
  service.** `check:coldstart` controls the window deliberately, which is the better test of the
  mechanism — but the real thing has still only been seen warm since the fix.
  ⚠ **It was briefly written up as closed on 2026-08-09 and that was wrong**, which is worth keeping
  because of *how* it was wrong. The redeploy's `smoke:live` did follow a real ~3 h idle and a real
  11.3 s cold start — but an **automated visitor** (`HeadlessChrome/131`, referer the unique deploy
  URL) hit the site seconds after the deploy went live and absorbed that cold start; `smoke:live`
  opened 33 s later and got `/health` in **2 ms**. A warm run was read as a cold one because only the
  wall clock was checked. **The bot is the standing obstacle**: it arrives right after every deploy,
  so a post-deploy `smoke:live` can never be the cold test. Measure it on an untouched service, and
  confirm from the request log which client caused the container start.
- **Three things now warm this service behind your back** — a demo recording (2026-08-08), a
  post-deploy crawler and the owner's own use. Any cold-start claim has to name the client that
  caused the `model ready` line, not just the elapsed time.
- **A busy instance is indistinguishable from a cold one at `/health`.** Concurrency is 1, so a
  second request during a decode gets a **fresh container** — `uptimeS` a handful of seconds, exactly
  what scale-to-zero looks like. Never read cold-start behaviour off a single `/health`; read the
  request log and the `model ready` lines together.
- **The in-browser fallback hides its own reasons.** Whenever the server is missed the page is still
  read correctly, so nothing looks broken — the only evidence is `data-where` and a warm laptop. That
  is what let the cold-start bug live from 2026-08-06 to 2026-08-08 in a fully "passing" deployment.
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
- **NEW (2026-08-14): a Round-3 model will differ from `round2-stage2-best` by four things, not one** —
  the corpus change, the **`staff_jitter` augmentation added 2026-07-29** (two days after Round 2
  trained; ±4% scale on 80% of samples, never A/B'd), a sub-visual **rasterizer drift** that moves
  every one of the 40,826 strips, and the training environment. This is why the tuplet A/B trains its
  own control instead of reusing the live model, and it is a caveat on Round 3's exam read too.
  Measurements: [METRICS-CORPUS.md](METRICS-CORPUS.md); reasoning:
  [rung3/round3-criteria.md](rung3/round3-criteria.md).
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
