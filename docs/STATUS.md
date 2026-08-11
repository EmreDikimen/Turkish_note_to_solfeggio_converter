# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-11

## Now

**The feature track is open, and the first two features are built but NOT deployed.** The owner
re-confirmed the parallel split on 2026-08-10 and asked for the non-model track to start; it runs on
`main`, since it shares no file with Round 3. Scope was **F0 + F2 only** — F1 (instrument voices) and
F3 (fingerboard tab) stay designed-not-started ([features/README.md](features/README.md)).

**F0 rebuilt playback** on one long-lived `AudioContext` with a look-ahead scheduler. Nothing
user-visible changed; it exists so a *sample* can be cached at all, because the old `stop()` closed
the context and an `AudioBuffer` dies with it. **F2 made the usul play its own düm/tek/ke strokes**
instead of a metronome blip — a new checkbox beside `Metronom`, `buildPercussionTrack` in core, and
strokes **synthesised** rather than sampled so it works with no download and no licence question.
Green: `typecheck`, `npm test` (three files now), `smoke:editor` ALL PASS, `smoke:app` PASS. The
account, including the one bug this found: [log/status-log.md](log/status-log.md).

⚠ **Two things are open on it, and both are below in Next**: the ten stroke tables are **drafted, not
verified by ear** (four are marked `[derived]`), and none of this is on the live site — the last
deploy was 2026-08-09.

**The beta is live, the copyright pass is deployed, and a friend could be sent the link today.**
<https://komavision.netlify.app> — page upload, the slicer, server decode with an in-browser
fallback, makam-aware playback, the armed editor, Turkish throughout. What each of those
established, and the traps inside them, moved to **[mvp/standing.md](mvp/standing.md)**
(2026-08-08). Nothing there is a next action.

**The copyright redeploy went out 2026-08-09 and the live site is now what we mean to publish.**
Before it, the deployed build served five bundled SymbTr scores — CC BY-NC-SA, which would bind the
whole app to NonCommercial forever, and two were compositions still in copyright under FSEK 5846.
All five answered **200** on the live host that morning and all five answer **404** now, alongside
`/scores/` and `/models/`. The legal footer ships. The full account — what was found, why removal
beat attribution, and the enforcement — is [THIRD-PARTY.md](THIRD-PARTY.md); the decision row is in
[DECISIONS.md](DECISIONS.md); the hard rule is in [../CLAUDE.md](../CLAUDE.md). The model card is
now on the Hub as `Beyaban/omr-weights/README.md`.

Green for that deploy: `typecheck`, `build:app` (11 files, 42.7 MB, no score at the dist root, both
real URLs baked in and no `localhost:8080` left in the bundle), and `smoke:live` **PASS on both
paths** — numbers in [METRICS.md](METRICS.md). `npm test` (217/217), `smoke:editor` (**ALL PASS**,
including the grace-note geometry section) and `smoke:page` were green in this HEAD on 2026-08-08 and
no source moved since.

**A second deploy went out the same day: the sheet no longer shows a koma bemol as a küçük bemol.**
Owner report from real use — in `Standart (ölçü boyunca)` the staff dropped the sign on any
alteration pointing the same way as the donanım, so it read as the signature's size while the audio
played the true koma (**134 of 213 bundled scores** have at least one such letter). The
`sigTolerant` printing rule is now the **renderer's only**: on for render jobs, which must imitate
real printed pages, off for a human. The corpus is untouched — same glyph tally on `?mode=measure`
before and after — and pixels==labels holds on both settings. Decision row in
[DECISIONS.md](DECISIONS.md), account in [log/status-log.md](log/status-log.md). Green for it:
`typecheck`, `npm test`, `smoke:editor`, a fresh `build:app` (both real URLs, no `localhost:8080`),
`smoke:live` **PASS on both paths**, and the fix confirmed **on the deployed bundle** (51 signs on
the human path vs 40 on `?mode=measure`, same score).

**And the model's own tokens are visible in the app** (owner request): `Gelişmiş` → **Modelin ham
çıktısı** shows, per strip of the last read, every token the model produced with its confidence,
the truncation flag, and the stitcher's warnings — the answer to "the model saw it, so why is it not
on the page". Nothing kept those tokens before; `stitchDecoded` consumes them. `smoke:app` asserts
it. Walkthrough: check 22 in [MANUAL_CHECKS.md](MANUAL_CHECKS.md).

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
Detail and the limits of it: [METRICS.md](METRICS.md).

⚠ **Two copyright items remain open and are both the owner's call**, independent of the redeploy:
the samples and the neyzen.com screenshot are out of HEAD but remain in the **public** repo's git
history (clearing them needs a `filter-repo` rewrite and a force-push), and there is still **no
LICENSE file**. Detail: [THIRD-PARTY.md](THIRD-PARTY.md).

**The two tracks run in parallel, as re-scoped 2026-08-05:** the product track never trains, the
model track never touches the app, and neither waits for the other. Who the release is for, what
they are asked, and why Round 3 is not aimed by their answers: [mvp/README.md](mvp/README.md) and
[DECISIONS.md](DECISIONS.md).

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

0. **⏭ THE NEXT ACTION — CHECK THE USUL STROKE TABLES BY EAR.** F2 is built and its data is the part
   no test can judge: six of the ten patterns are the standard simple forms, four (Devr-i Hindî,
   Curcuna, Aksak Semâi, and Ağır Aksak riding on Aksak) are marked `[derived]` in
   `packages/core/src/usul.ts` because they are our reduction of that usul's beat grouping rather
   than a quoted pattern. A wrong Düyek is obvious to a musician and invisible to every check here.
   Walkthrough: **check 23** in [MANUAL_CHECKS.md](MANUAL_CHECKS.md). Cheap, and it gates whether F2
   is fit to deploy.
1. **F0 + F2 are BUILT AND UNDEPLOYED.** The live site is still the 2026-08-09 build. They can ride
   along with whatever goes out next rather than earning their own deploy — nothing about them is
   urgent. `npm run deploy:app` is now the whole recipe in one command (2026-08-11), with
   `smoke:live` after; the long form stays in [mvp/hosting-setup.md](mvp/hosting-setup.md).
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
5. **W10 — release to two friends.** Ask what features to add. No ads and no in-app feedback
   widget: talk to them. ⚠ Note the tension, stated on purpose: F0 and F2 were built *before* asking,
   from the owner's own list ([DECISIONS.md](DECISIONS.md)). Nothing stops the question being asked
   anyway, and the answer is still the thing that should aim F1/F3.
6. **Public launch** — a later rung, gated on Round 3's exam result, not on W10.

### Track B — the model (Round 3, UNPAUSED)

1. **Write down what Round 3 must reach, BEFORE training starts** — on the user-effort metric (≥90%
   of pages ≤5 corrections; baseline 57%), with micro and macro≥30 quoted beside the macro mean.
   This is now also the **public-launch gate**, so it settles more than one thing. Then render once,
   train stage 1 once with several cheap stage-2 variants, read the exam once.
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
