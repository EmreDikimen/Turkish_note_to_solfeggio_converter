# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-11

## Now

**The feature track is open, and its first two features are BUILT AND DEPLOYED.** The owner
re-confirmed the parallel split on 2026-08-10 and asked for the non-model track to start; it runs on
`main`, since it shares no file with Round 3. Scope was **F0 + F2 only** — F1 (instrument voices) and
F3 (fingerboard tab) stay designed-not-started ([features/README.md](features/README.md)).

**F0 rebuilt playback** on one long-lived `AudioContext` with a look-ahead scheduler. Nothing
user-visible changed; it exists so a *sample* can be cached at all, because the old `stop()` closed
the context and an `AudioBuffer` dies with it. **F2 made the usul play its own düm/tek/ke strokes**
instead of a metronome blip — a checkbox beside `Metronom`, `buildPercussionTrack` in core, a
`Vuruş sesi` slider, and now a **`Vurmalı çalgı` picker** choosing between a real **darbuka** and a
real **bendir**.

✅ **The synthesised strokes were rejected by ear that morning and replaced the same day.** The
strokes are CC0 VCSL recordings, prepared by `scripts/prepare_strokes.py`; the synthesis survives
only as the fallback for a kit that has not downloaded. The swap reached exactly the one method it
was designed to reach, and `usul-test.ts` passes **unchanged**, which is how we know core did not
move. ⚠ The instructive part is the **bar**, not the code: the plan wrote down *"düm and tek must be
unmistakable from each other"*, the synthesis met it, and meeting it is how it failed.

**Which drum a file is was decided by measurement, not by its name.** VCSL numbers its darbuka
articulations 1–5 and never says which is the open centre hit, so each is measured (low-band energy,
spectral centroid, decay) and the mapping follows the physics. The frame drum — whose files *are*
self-described — was the control, and agreed. That caught two things a reasonable guess would not:
both `Hand` takes are 40+ dB down and unusable as a tek, and inheriting VCSL's session levels would
have re-created the inaudibility bug fixed that morning from a different cause. Detail:
[features/audio-sources.md](features/audio-sources.md); the account:
[log/status-log.md](log/status-log.md).

⚠ **The first cut clipped, and the fix is a level rule worth carrying into F1.** The owner heard the
darbuka "patlamış"; the files were clean and the **mix** was not — a note is a normalised wave at
gain 1.0 into the same master as a düm normalised to 0.89, which hard-clipped 38% of the waveform at
the default slider. Stroke peaks dropped to 0.50/0.35/0.19 (ratios kept), master 0.85 → 0.72, and a
**limiter** now sits before the destination so no slider setting can clip again. **A level that is
safe for a synthesised blip is not safe for a recorded instrument** — F1 puts more recordings through
this same master. Numbers: [log/status-log.md](log/status-log.md).

**Audio ships from the app, but behind `VITE_AUDIO_URL`** — the owner asked which is easier to
maintain given more instruments are coming. 660 KB does not justify a second host; F1's instruments
do — measured at **~20 MB each**, 40–60 MB for the three. So the files are local and the loader already reads the env var, tested against an
off-app origin, and `MAX_AUDIO_MB` in `prune-dist.mjs` fails the build when it is time to move.
Decision and its pre-registered trigger: [DECISIONS.md](DECISIONS.md).

**All of it is DEPLOYED** (2026-08-11) — <https://komavision.netlify.app> now carries F0, F2 with
both drum kits, the copyright pass and the koma-bemol fix. `smoke:live` **PASS on both paths**, and
the twelve `/audio/*.wav` files answer 200 while `sample.json` still answers 404. Numbers:
[METRICS.md](METRICS.md).

✅ **W10 IS COMPLETE — the friends used it, liked it, and said what to add next: MORE INSTRUMENT
SOUNDS** (2026-08-11). The link went out, they came back, and the answer was directed enough to
build from. **This is the loop the whole W0–W10 ladder was for, and it closed.** ⚠ Non-claim, since
it would be easy to over-read: **n=2 and they are friends**, they were asked what to add rather than
whether the app is good, and "I like it" is not a usage measurement — `/decode` in the request log
is ([METRICS-USAGE.md](METRICS-USAGE.md)).

**⏭ So F1 — instrument voices — is next, and it is the friends' request, not a guess.** The owner
named **violin, clarinet and kanun**, which are *exactly* the three with verified CC0 coverage.
⚠ Worth keeping straight, because the opposite was written here twice: F0 and F2 **were** built
before anyone was asked, and that was a genuine tension. It resolved the pleasant way — the friends
independently pointed where the owner's own list already pointed — but that is **evidence the guess
was good, not that asking was unnecessary**. F3 and any instrument past these three should still be
aimed by what the friends say next. Decision rows: [DECISIONS.md](DECISIONS.md).

✅ **And the stroke tables are verified** (owner, by ear, 2026-08-11): all ten accepted, including
the four `[derived]` ones no automated check could judge. **F2 is finished** — nothing about it is
open.

**The beta is live, the copyright pass is deployed, and the link HAS been sent (2026-08-11).**
<https://komavision.netlify.app> — page upload, the slicer, server decode with an in-browser
fallback, makam-aware playback, the armed editor, Turkish throughout. What each of those
established, and the traps inside them, moved to **[mvp/standing.md](mvp/standing.md)**
(2026-08-08). Nothing there is a next action.

**A genuine Cloud Run cold start is finally measured** (11.3 s wall, 10,093 ms of it graph loading,
after ~3 h idle) — but it was caused by a post-deploy crawler, not by the app, so it does **not**
close the cold-start open risk below. Evidence and the correction: [METRICS.md](METRICS.md).

**Someone who is not the owner has already used it, unannounced — and every human so far was on a
phone.** Of the three page reads on 2026-08-08, one was the owner's own Android; the other two came
from a home ADSL line and from the owner's network six hours apart, both Android, and the log cannot
say whether that is **one stranger or two**. Around them is a `/health`-only trickle that whois puts
on AWS, a datacenter and a ProtonVPN exit — the app pings `/health` when it opens, so that trickle is
a visit counter nobody built, and `/decode` is the honest count. This is the first evidence touching
the "web first, mobile later" plan, and at n=2 it is **a question for W10's friends, not a finding**.
Detail and the limits of it: [METRICS-USAGE.md](METRICS-USAGE.md). ⚠ **The friends can now answer it** —
their own reads are the first data that can move n past 2; see Track A item 5c.

⚠ **Two copyright items remain open and are both the owner's call**, independent of the redeploy:
the samples and the neyzen.com screenshot are out of HEAD but remain in the **public** repo's git
history (clearing them needs a `filter-repo` rewrite and a force-push), and there is still **no
LICENSE file**. Detail: [THIRD-PARTY.md](THIRD-PARTY.md).

**The two tracks run in parallel, as re-scoped 2026-08-05:** the product track never trains, the
model track never touches the app, and neither waits for the other. Who the release is for, what
they are asked, and why Round 3 is not aimed by their answers: [mvp/README.md](mvp/README.md) and
[DECISIONS.md](DECISIONS.md).

**On the model side, the tuplet weakness was diagnosed on 2026-08-11 and it is not what anyone
thought.** An owner report of two misread triplets led to reading the data instead of the docs.
Three things came out of it. **The tuplet labelling is finished and promoted** — 169 strips / 205
groups, training at `:8`, exam gold 4 → 55 — and [rung3/labeling.md](rung3/labeling.md) had said
otherwise for three weeks, so "finish the queue" was recommended three times in a row from a stale
file. **The real weakness is a trade we made on purpose**: the slur distractors took `\tup3`
precision 15.1% → 91.2% and pushed recall **92.7% → 83.8%**, under its floor and below where it
started — the model misses triplets now rather than inventing them. **And the likely cause is that we
draw the mark wrong**: real Turkish editions break the arc and set the "3" in the gap, while
`drawTupletArc` draws an unbroken curve with the digit floating above, so our corpus separates a
triplet from a phrase slur by a faint mark where real print separates them structurally. Same shape
as the Bravura sharp-bar defect — **a hypothesis with a mechanism, A/B'd against nothing yet**. Full
account: [rung3/tuplets.md](rung3/tuplets.md).

**W8 (confidence highlighting) is DROPPED** — its pre-registered bar was not met and the bar was not
moved to fit. That leaves half of the 2026-07-27 goal unbuilt, and this line is the saying-so. The
measurement that dropped it: [mvp/standing.md](mvp/standing.md).

## Previously — the settled context

Established findings live in two files, so this one can hold only "now" and "next". Neither contains
a next action.

| Track | Settled context |
|---|---|
| Product (W0–W9.7, the server, the three shipped features) | [mvp/standing.md](mvp/standing.md) — moved 2026-08-08 |
| Real pages (real-val v2, the re-slice, Round 3 pre-render checks, the Round 2 position) | [rung3/standing.md](rung3/standing.md) — moved 2026-08-07 |

## Next — two tracks, running in parallel

Since 2026-08-05 the product and the model advance independently: **the product track never trains,
the model track never touches the app.** Either can be worked on without waiting for the other.

### Track A — the product (W9 → W10 → public)

0. **DONE 2026-08-11 — the real drum samples are in.** VCSL darbuka + frame drum, CC0, chosen by
   measurement and shipping from `public/audio/` behind `VITE_AUDIO_URL`. Kept here for one sitting
   because item 0b below rests on it.
0b. **DONE 2026-08-11 — the usul stroke tables are VERIFIED BY EAR and accepted** (owner, after
   listening: *"they sound really nice"*). That covers all ten, **including the four `[derived]`
   ones** — Devr-i Hindî, Curcuna, Aksak Semâi and Ağır Aksak — which were our reduction of the
   usul's beat grouping rather than a quoted pattern, and which no automated check could ever
   judge. F2 now has nothing open. ⚠ The verdict is one musician's ear, which is the only standard
   that exists for this and is **not** the same as a cited source; if a pattern is ever disputed,
   re-open the `[derived]` four first and cite a source rather than re-deriving.
1. **DONE 2026-08-11 — F0 + F2 ARE DEPLOYED.** `npm run deploy:app` then `smoke:live`, PASS on both
   paths. ⚠ **`deploy:app` needed a fix to run unattended and it is in**: `netlify-cli` now detects
   the workspaces and *stops on an interactive "select the project" prompt* unless given
   `--filter @turkish-omr/web`, so the documented one-command recipe hung after a successful build
   and published nothing. The build succeeding is not the deploy happening — read for the
   `Deploy is live!` line. Long form: [mvp/hosting-setup.md](mvp/hosting-setup.md).
   ⚠ **Deploying is NOT what keeps the owner's Mac cool, and it was believed to be** (owner asked
   2026-08-11). `npm run dev:cloud` is: the local harness with `VITE_DECODE_URL` pointed at the live
   service, verified end to end that day (`data-where="server"`, 27.3 s of decode on Cloud Run
   against 1.6 s of slicing locally). **Plain `dev:web` sets no decode URL and reads the page in the
   browser** — measured, not assumed: with port 5173 genuinely empty it serves an `import.meta.env`
   with no `VITE_DECODE_URL` in it. A CLAUDE.md line claiming otherwise was the cause and is fixed.
2. **DONE 2026-08-09 — the copyright redeploy shipped**, Netlify only, plus the model card on the
   Hub. Kept here for one sitting because it is what the state above rests on.
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
5. **DONE 2026-08-11 — W10 SHIPPED AND ANSWERED.** Link to two friends, no ads and no in-app
   widget, just a conversation ([mvp/README.md](mvp/README.md)). They liked it and asked for **more
   instrument sounds**, which is what item 5b now builds. The rung is complete: it was defined as
   *"what features should I add?"*, and that question has an answer.
5b. **⏭ THE NEXT ACTION — F1, INSTRUMENT VOICES: violin, clarinet, kanun.** The friends' own
   request, and the three the owner named are **exactly** the three with verified CC0 coverage — so
   this is a download-and-wire job like F2, not a search: clarinet and violin from **VSCO 2 CE**,
   kanun from **CompMusic Freesound 211133** (needs a free account, so that download is manual).
   Ney has **no** CC0 source and needs the owner's own recording; oud and tanbur are
   **Karplus–Strong**, code rather than files. Files and licences:
   [features/audio-sources.md](features/audio-sources.md); design and the 53-TET constraint:
   [features/README.md](features/README.md); the rules every file obeys:
   [features/audio-policy.md](features/audio-policy.md).

   **Settled with the owner before starting** ([DECISIONS.md](DECISIONS.md)):
   **(a) Nothing is compressed or trimmed** — full length, stereo, original bit depth. Quality is the
   priority and size is not a constraint once the files leave the app.
   **(b) They live in a Hugging Face Hub repo**, served through `VITE_AUDIO_URL`. This is the
   pre-registered trigger firing, not a new decision — measured, VSCO 2's clarinet `susLong` is 33
   files at ~1.8 MB each, so **one velocity across 11 pitches is ~20 MB and three instruments are
   40–60 MB**, against a 60 MB dist already at 43.4. **`MAX_AUDIO_MB` stays at 1; do not raise it.**
   **(c) Not committed to git** — ~50 MB of binaries in a public repo is permanent, and this project
   already has files stuck in its history.

   ⚠ **Two consequences of (a) worth carrying in.** These are **7–10 second sustains**, longer than
   almost any notated note, so **no sample needs looping** — the expensive-looking choice is also the
   simpler one. And at ~20 MB an instrument, **loading only on selection stops being an optimisation
   and becomes a requirement**; the `loadStrokeKit.ts` comment saying Cache Storage is not worth it
   is **true for 660 KB of drums and false here**, so F1 should cache like `omr/session.ts` does for
   the weights. Revisit that comment rather than inheriting it.
   ⚠ **Carry F2's level lesson in.** A level safe for a synthesised tone is not safe for a recording,
   and unlike a drum these voices **replace** the notes rather than sitting beside them — so a sample
   lands where the synthesised note's gain of 1.0 used to be, and `MASTER_GAIN` (0.72) plus the
   limiter were retuned around exactly that. "Patlamış" was arithmetic, and it changes again here.
   Check the mix, not the file.

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
1b. **⏭ THE TUPLET MARK — redraw the arc broken, with the "3" in the gap**, and raise the curved-arc
   share above 70% (owner, 2026-08-11). `drawTupletArc` in `apps/web/src/SheetView.tsx`; **pixels
   only, no label moves**, so it costs a re-render and nothing else. Show a rendered sample beside a
   real page before re-rendering at scale — the shape is a domain judgement. Then A/B on `\tup3`
   recall, which has missed its floor twice and now sits *below* its own pre-work baseline. ⚠ Do
   **not** touch the 35% slur-distractor rate in the same change; it is the obvious second knob and
   moving both makes the result unreadable. Diagnosis, plan and non-claims:
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

6. **The rest of the feature track — F1 (instrument voices) and F3 (the fingerboard tab).**
   **F0 and F2 are DONE (2026-08-10/11)**; these two are still designed-not-started. Both are
   client-side (no server, no GPU, no new ML), so they run alongside Round 3 without touching it.
   Plan and the licence traps: [features/README.md](features/README.md).
   **The audio is no longer an open question** (2026-08-09): bendir, darbuka, tef, zil, clarinet,
   violin and kanun are all sourced under **CC0**, licences verified per file, no NC anywhere — ney
   still needs the owner's own recording. F0 removed the blocker they shared: the `AudioContext` now
   survives a Stop, so a decoded sample can be cached. Files and prep:
   [features/audio-sources.md](features/audio-sources.md). Also cheap and owed on F2: swapping the
   synthesised strokes for those CC0 recordings, which touches only `scheduleStroke`.

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
