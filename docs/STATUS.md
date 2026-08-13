# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-13

## Now

✅ **Two rounds of ear feedback have landed, and each corrected the previous measurement.** Round 1:
16th notes came out as *"just like breath"* (clarinet) and an annoying *creak* (violin) — a short note
was playing the attack transient and stopping before the instrument spoke, at up to **13× less
volume** than a long one. Round 2, after the first fix: *"we can trim less from the beginning… or
maybe trim differently for different duration of the notes"* — both right. The first fix used an
**amplitude** threshold, which waits for full loudness rather than for the noise to stop, and
overshot in every file (158 ms where the tone settles at 92, 1178 where it settles at 404). Breath is
spectral, so the settled point is now measured on **harmonic content**, and **how much attack a note
keeps depends on the note**: it inherits the recorded swell only when that swell is ≤25% of it.
⚠ A smooth blend was tried and is wrong — it lands *inside* the transient for files with a long one,
which put the creak back in the middle of the range while both ends measured fine. ⚠ Cost: one
subtraction and one comparison per note; nothing measurable. ⚠ **The trim is in TIME, not in the
file** — the wavs stay byte-identical, so round 2 cost no re-upload, which is exactly why that
decision keeps paying. **Still needs a re-listen** — check 24 is not closed. Numbers: [features/audio-sources.md](features/audio-sources.md).

**F1 — instrument voices — is BUILT, UPLOADED and verified; it is not deployed and the fix above is
unheard.** The app has a `Çalgı sesi` picker offering **Klarnet** and **Keman** beside the built-in tone,
and a note is sounded by a real recording resampled onto its exact koma. The 26 CC0 files are live at
<https://huggingface.co/datasets/Beyaban/omr-voices> (55.6 MB); `smoke:editor` driven against that URL
reads **11/11 decoded, every note sounded by a recording and none by the synth**, with the drums still
loading from the app in the same run. The two open steps are **check 24 by ear**
([MANUAL_CHECKS.md](MANUAL_CHECKS.md)) and a deploy — see Track A item 5b.

✅ **The per-note fallback earned itself over a real network.** Against the Hub the first few notes of
a playback are still synthesised while the download runs, and the piece switches to recordings
mid-phrase with no re-schedule. That is why `play()` never waits on 20–35 MB, and only real latency
could show it — the local stand-in was ready before the first note.

⚠ **The drums do NOT move to the Hub, and that reverses what three files predicted** (owner,
2026-08-12). Percussion is essential to playback, so the kits keep shipping with the app and only the
voices are hosted off it, on **their own `VITE_VOICES_URL`**. `VITE_AUDIO_URL` is one base for the
whole `audio/` tree, so setting it in a deploy would take the drums with it and 404 them into the
synthesis the owner rejected by ear — silently, since the fallback still makes a sound.
`MAX_AUDIO_MB = 1` is therefore a **permanent guard on the drums**, not a trigger that has fired.
Rows: [DECISIONS.md](DECISIONS.md).

**Measuring the audio files rather than trusting their names paid for itself three times** — the
method `prepare_strokes.py` used on VCSL's numbered drums, applied to a library whose files *look*
self-describing. VSCO's clarinet labels sit **an octave below** sounding pitch; the violin needed no
offset and was the control that proved it; and one file is **mislabelled by a semitone at source**.
It also corrected a number the docs had carried twice: the widest pitch gap is **5 semitones**, so the
worst stretch is ±2.5, not ±1.5. Detail: [features/audio-sources.md](features/audio-sources.md).

**On the model side, the tuplet mark has been MEASURED against real print, REDRAWN, and passed the
owner's eye.** 16 of 16 marks across ~11 real editions **break the arc and set the "3" in the gap**,
and no continuous-arc-with-a-floating-digit exists in the real pools. `drawTupletArc` now draws two
arms with the digit in the gap and the curved-arc share is 70% → 90%. The owner's review then changed
it twice more — arms follow the notes, the digit is regular weight — and the correction that did
**not** survive measurement was sliding the gap toward the high side: print puts the digit dead centre
(0.49–0.50 of the span). ⚠ **Nothing about recall is claimed; the A/B has not run.** Numbers:
[METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md); account: [rung3/tuplets.md](rung3/tuplets.md).

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
3. **EDITOR STEP 9: delete `Save JSON`** (and its two `app-smoke` checks and the `PIPELINE.md`
   references). The last item on the editor's list; steps 1–8 and 10 are done, deployed and checked
   on the production bundle. ⚠ It needs one thing solved first: **`smoke:editor` reads the document
   by clicking `#save-json`**, so deleting the button removes the check's only way to see what an
   edit did. Does not gate W10. Brief: [mvp/editor.md](mvp/editor.md); what each step built and
   what is settled-do-not-re-open: [mvp/standing.md](mvp/standing.md).
4. **⏸ Everything else about speed is DEFERRED to after W10** (owner, 2026-08-06): ship at **~35–55 s
   a page**. Splitting a page across instances (~52 s → ~13 s) is the only option that touches the
   warm wait — the cold start is just 10.6 s of it — and it costs a rate-limiter rewrite plus a
   chunked-vs-unchunked parity check. **The trigger to build it is a friend saying the wait is
   annoying**, which is exactly what W10 is for. Menu and prices: [mvp/latency.md](mvp/latency.md).
5. **DONE 2026-08-11 — W10 SHIPPED AND ANSWERED**: the link went to two friends, they liked it, and
   asked for **more instrument sounds** — which is what 5b built. The rung is complete. Account:
   [mvp/README.md](mvp/README.md).
5b. **F1, INSTRUMENT VOICES — BUILT 2026-08-13 (clarinet + violin). Kanun deferred.** The friends'
   own request. Everything in the app is done and checked: the `Çalgı sesi` picker, per-note
   selection between a recording and the built-in tone, `playbackRate` onto the exact koma,
   Cache-Storage caching like the weights, and a fallback that keeps playing when the host is
   unreachable. Kanun stayed out because it needs a Freesound account and onset-splitting a
   two-minute take — a different job, and the manifest is shaped so it is a data change.
   ⚠ Ney still has **no** CC0 source and needs the owner's own recording; oud and tanbur remain
   **Karplus–Strong**, code rather than files.

   **✅ UPLOADED 2026-08-13** to `Beyaban/omr-voices` (a **dataset** repo — note the `/datasets/`
   path segment, which does not resolve like the weights' model repo). Verified from outside: 200
   after the LFS redirect, byte counts identical to the VSCO originals, `access-control-allow-origin`
   echoed for the deployed origin, and the `#` in `A#2` resolving percent-encoded.

   **✅ DEPLOYED 2026-08-13** — `Deploy is live!`, `smoke:live` PASS on both paths. Verified beyond
   what that check covers: the voices URL is baked into the shipped bundle (env vars inline at build
   time, so a wrong one is invisible until someone clicks the picker), the drum wavs still answer 200
   from `/audio/`, and `sample.json` still 404s.

   **⏭ WHAT IS LEFT: a third listen.** Check 24 has been run twice and both passes found real
   defects — 16th notes coming out as breath, then the trim being too deep. Both are fixed and
   measured; neither fix has been heard. ⚠ The number most likely to come back wrong is the per-voice
   `gain`: the voices are **peak-matched**, so they sound a few dB quieter than the built-in tone,
   which is the trade and not a fault. If they should be louder the order is `gain` → a `Çalgı sesi`
   slider → **never** `MASTER_GAIN`.

   **What the owner settled before it started, all three honoured** ([DECISIONS.md](DECISIONS.md)):
   nothing compressed or trimmed (the staged files are **byte-identical to the library's**, asserted
   by sha256); hosted on the Hub; not committed to git. ⚠ What CHANGED during the work: the host
   variable is **`VITE_VOICES_URL`**, not `VITE_AUDIO_URL` — see the "Now" section above.

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

1. **Write down what Round 3 must reach, BEFORE training starts** — on the user-effort metric (≥90%
   of pages ≤5 corrections; baseline 57%), with micro and macro≥30 quoted beside the macro mean.
   This is now also the **public-launch gate**, so it settles more than one thing. Then render once,
   train stage 1 once with several cheap stage-2 variants, read the exam once.
1b. **THE TUPLET MARK — DONE 2026-08-12, and it is measured, not guessed.** The arc is broken with the
   "3" in the gap and the curved-arc share is 90% (`TUPLET_MARK` + `drawTupletArc`,
   `apps/web/src/SheetView.tsx`); pixels only, and `verify-labels` on the pilot is 309/309 exact, so no
   label moved. Real print was measured first (16/16 marks broken, ~11 editions) and the redraw lands on
   every quantity: [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md).
1c. **DONE 2026-08-12 — the owner judged the shape** on
   `data/real/rung3/tuplet_probe/mark_comparison.png` (regenerate:
   `.venv-ml/bin/python scripts/rung3/tuplet_mark_sheet.py`; ⚠ **local viewing only**, the real row is a
   third-party edition — [THIRD-PARTY.md](THIRD-PARTY.md)). Two corrections came back and are in: the
   arms follow the notes, the digit is lighter.
1d. **⏭ THE NEXT ACTION — re-render the corpus and A/B `\tup3` recall**, which has missed its floor
   twice and now sits *below* its own pre-work baseline. ⚠ Write item 1's acceptance bar down **first**,
   because an A/B is training. ⚠ Do **not** touch the 35% slur-distractor rate in the same change; it is
   the obvious second knob and moving both makes the result unreadable. ⚠ Also owed and deliberately
   deferred: real print draws the arc **heavier** than we do, and that must change jointly with
   `drawSlurArc` or it becomes a thickness cue real pages do not have. Plan and non-claims:
   [rung3/tuplets.md](rung3/tuplets.md). ⚠ **No new labelling** — the tuplet queues are finished and
   promoted, whatever [rung3/labeling.md](rung3/labeling.md) said until 2026-08-11.
2. **The content work in `select_pieces.py`** — eighth/quarter-note mix and bar-line density (owner
   decision 2026-07-27: these only; ties and accidentals stay out). Verify on a 300-strip pilot with
   `domain_gap.py` before regenerating `data/pieces.json`. Guard: check the accidental counts before
   and after on the same pilot and treat a drop as a stop sign, not a trade.
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

6. **The rest of the feature track — F3 (the fingerboard tab).**
   **F0, F2 and F1 are DONE** (2026-08-10/11/13); only F3 is designed-not-started. It is
   client-side (no server, no GPU, no new ML), so it runs alongside Round 3 without touching it.
   Plan and the licence traps: [features/README.md](features/README.md). ⚠ `features/README.md` says
   to aim F3 by what the friends say next, so it is **not** simply the next thing to build.
   **The audio is no longer an open question** (2026-08-09): bendir, darbuka, tef, zil, clarinet,
   violin and kanun are all sourced under **CC0**, licences verified per file, no NC anywhere — ney
   still needs the owner's own recording. Of those, the drums and the clarinet/violin are **in and
   shipping**; **kanun** is the one left that has a source, and it needs a manual Freesound download
   plus onset-splitting a two-minute take. Files and prep:
   [features/audio-sources.md](features/audio-sources.md).

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 numerics
investigation — now two instances, a dropped double dot (Round 1) and a dropped `\tup3` (Round 2),
both reference-path only and both fine under Python-ORT int8.

## Open risks and non-claims

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
