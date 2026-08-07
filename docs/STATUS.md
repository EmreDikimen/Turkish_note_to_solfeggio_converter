# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-07

## Now

**W9 IS COMPLETE AND NOTHING IS OWED ON IT.** The app is LIVE at
**<https://komavision.netlify.app>**, the weights are on the Hub, decode is on Cloud Run behind the
origin lock, and `npm run smoke:live` **passes on both paths against the deployed site** — the
shipped configuration, driven as a friend would.

**MAKAM SELECTION SHIPPED 2026-08-07** (not on the ladder — an owner request taken before the style
pass). Playback used to sound every note where the staff spells it, which is the written skeleton
and not what a player plays. The app now guesses the makam from a decoded page's own signature and
karar, confirms it in a prompt, and bends the **sounding** komas to that makam's performed
intonation — uşşak's segah 1.5 commas below its written koma-bemol, and an explicit *no deviation*
for hüseyni, the contrast the whole feature turns on. **Sound only: the engraving, `Save JSON` and
the training strips never move.** Audibly correct on **204/213** bundled scores
([METRICS.md](METRICS.md)); table, sources and the guessing rule in [mvp/makam.md](mvp/makam.md).
**THE STYLE PASS IS DONE, 2026-08-07 — BUILT, GREEN, NOT YET DEPLOYED.** The harness is now
**KomaVision**, in **Turkish**, on warm paper: upload is the hero (drag, drop or paste), the
transport keeps only the six controls a musician touches, the twelve developer controls fold into a
collapsed **Gelişmiş**. Slicing, decode, the fallback and the origin lock did not move. The
load-bearing change underneath: **the deploy checks no longer read the copy** — `#omr-status` carries
`data-state / data-kind / data-where` + counts (`apps/web/src/ui/status.ts`), which is what let the
UI become Turkish without touching one assertion.

**The next action is the REDEPLOY**, which carries the style pass **and** makam selection in one
build (both are committed, neither is live). Then W10. TWO tracks run in parallel, as re-scoped on
2026-08-05:

| | |
|---|---|
| **Product track (live)** | Build the decode server → release to **exactly two friends** → ask them **what features to add**. It is the **interface** being tested, not the model |
| **Model track (live, parallel)** | **Round 3 is UNPAUSED.** It no longer waits for feedback, because the feedback being collected is about features and would not aim it |
| **The friends build's model** | **Swaps to a better one whenever one lands** — a server redeploy, no client download. ⚠ So decode-quality remarks from friends are anecdotes, not measurements; the exam still judges models |
| **Feedback** | **By talking to them.** No in-app button, no telemetry at n=2 |
| **Phones** | **Out of scope** until the web app is done |
| **Public launch** | A later rung, gated on **Round 3's exam result**. Good → open it up; not good → Round 4 |

**W8 (confidence highlighting) is DROPPED** — its pre-registered bar was not met and the bar was not
moved to fit. That leaves half of the 2026-07-27 goal unbuilt, and this line is the saying-so.

- **✅ W9 IS DEPLOYED AND RUNNING (2026-08-06):
  `https://omr-decode-706571981988.europe-west3.run.app`** — Cloud Run, 1 vCPU / 2 GiB /
  concurrency 1 / max-instances 3. Node + `onnxruntime-node` importing the browser's own
  `decode.ts`, so there is **one decode implementation, not a third**. The client swaps behind
  `VITE_DECODE_URL` and falls back to in-browser decode on any failure. **It reads what the browser
  reads** (93.8% identical ids, and against gold a paired wash) and the safety checklist is complete
  — numbers, costs and the concurrency measurement in [METRICS.md](METRICS.md) and
  [mvp/latency.md](mvp/latency.md).
  ⚠ **It is SLOWER than the owner's own browser (0.66×), plus a 10.6 s cold start** — **exactly what
  [mvp/deploy.md](mvp/deploy.md) predicted and what the release was chosen on**: the win is a
  friend's laptop staying cool, not speed. The free tier still covers ~4× more than 50 users need.
  ⚠ **Two things are OWED.** A genuine cold start after real idle — the 2026-08-06 attempt FAILED,
  hitting a warm instance (`uptimeS` 315), so it needs container-start timestamps from the logs. And
  one controlled read of `--cpu-boost`, which across two revisions has **not** beaten the 9.5 s it
  aimed at.
  ⚠ **Two bugs stood between "built" and "running", both the same shape** — what ships was never
  what was tested (an ESM-bundle `require`, and a 503 that should have been a 413). `check:bundle`
  and a live `check:limits` now cover them; the standing rule is [DECISIONS.md](DECISIONS.md).
- **✅ THE APP IS BUILT, HOSTED AND CHECKED WHERE IT LIVES (2026-08-06)** — the other half of W9's
  title. `build:app` produces **43.3 MB** and **fails** if the output crosses 60 MB or contains an
  `.onnx` (Vite copies all of `public/` — 332 MB of graphs — into `dist/`, and deleting a directory
  by hand is easy to forget). Weights come from `VITE_WEIGHTS_URL`, cached in Cache Storage and
  fetched **only if the fallback fires**; `public/_headers` carries COOP/COEP, which **Netlify**
  reads unchanged. **`npm run smoke:live` drives the deployed site and passes on both paths**
  (server 49.8 s, Hub-weights fallback 73.0 s, same score, no page errors) — and it exists because
  the origin lock refuses a localhost preview, so `smoke:build` can no longer reach the real chain.
- **⛔ AND IT FOUND A BUG THAT ONLY EXISTS IN THE BUILT APP: the fallback hung forever** — the
  bundler inlines ORT's `…jsep.mjs`, which is *also* the worker script, and a Worker has no
  `document`. Fixed by shipping ORT's runtime as real files (`/ort/`, `wasmPaths`), production only.
  ⚠ The argument for the check: dev, `smoke:page` and the 27/28 gate were all green while the thing
  a friend would open was broken.
- **⛔ THE BATCHING ARGUMENT FOR HAVING A SERVER IS WITHDRAWN — measured, not argued (2026-08-06).**
  Batch 8 is **slower at every thread count** and costs **2.9× the peak memory**, so `OMR_MAX_BATCH`
  defaults to **1**. **The real second reason for a server is that native ORT is ~4× faster than
  wasm.** The **"smaller upload" reason is withdrawn too** (median **1.7× the page image**).
- **A page costs 11.7 vCPU-seconds at 1 vCPU** (the server's own `process.cpuUsage()`, what Cloud Run
  bills). **1 vCPU is the cheapest shape by 2.5×**; the earlier 30–60 vCPU-s estimate was ~3×
  pessimistic because it assumed the batching that does not exist.
- **A slice inspector, and two crop fixes from 2026-08-05.** `/slices.html` shows every crop with the
  slicer's own reasoning, its decoded label and its placement ([MANUAL_CHECKS.md](MANUAL_CHECKS.md)
  Check 13) — it is how both were found: a slur above the staff shearing the beams below (beam loss
  **−13.6%**, ⚠ an information argument, not a decode result), and the page latency fixed **exactly**
  (36.6 → 1.3 s/page, the skew sweep's per-angle morphology had a closed form, **0 disagreements in
  328 evaluations**). Detail: [log/status-log.md](log/status-log.md), numbers: [METRICS.md](METRICS.md).
- **A decoded `\tup3` that could not close was drawing the WRONG rhythm, and is fixed (2026-08-05).**
  Owner-reported as "`\repstart`/`\repend`/`\tup3` are not seen in the sheet"; it was two different
  things. **Repeats are not lost** — they are consumed into an UNFOLDED playing order, the wanted
  behaviour; **92.3% of pages unfold**, the rest carry a `\repstart` the model never closed and are
  left alone rather than guessed at. **Triplets were genuinely broken**: an unclosed run yielded no
  group, so every member snapped to the nearest plain value — a definitely-wrong rhythm with no mark
  saying so, now **0**. ⚠ `tupletGroupsIn` is shared with the label serializer, so both moved: **5
  measures in 1 of 190 training pieces**, on a future re-render only. ⚠ **`verify-labels.ts` cannot
  see this** — the real check was rendering the 3 worst pages through both draw paths with 0 dropped
  measures. Counts: [METRICS.md](METRICS.md); reasoning: [DECISIONS.md](DECISIONS.md).
- **✅ W7 PASSED (2026-08-05): THE APP READS A WHOLE PAGE.** Upload an image, get a playable,
  editable, saveable score — nothing stubbed. `smoke:page`: **7 staves → 16 strips → 344 notes /
  28 measures**, strip count matching local Python. The 35-second freeze was fixed by making
  `estimate_skew` a **generator with two drivers**, with **no arithmetic change** (deskew angle
  identical 20/20). ⚠ A hang at 0% CPU was Vite's dep optimizer full-reloading the tab mid-slice,
  not the port. Detail: [mvp/rungs.md](mvp/rungs.md).
- **✅ W0–W6 PASSED (2026-08-02/04) — the slicer port is done and the browser is not worse than
  Python.** opencv.js bit-identical on all five primitives; the browser scored against the SAME
  hand-verified gold as Python (**SER 0.0821 → 0.0818**, exact-match 60.2% both); the ported slicer
  checked over 1,781 pages / 33,805 strips with the decode arm **paired** (McNemar p = 0.077).
  Write-ups and the four hypotheses that died: [mvp/rungs.md](mvp/rungs.md). Numbers:
  [METRICS-SLICER-PORT.md](METRICS-SLICER-PORT.md).
  ⚠ Three things still bind: **agreement with an artifact is not correctness** (the `strips_v2`
  manifests are not the bar — current Python reproduces 98.59%, and three criteria had to be
  restated for it); **`prepPage` is not a no-op** (15.3% of pages take a real rotation); and the
  **86.0% browser-vs-Python ceiling** is near-ties, not a resampler, so `preprocess.ts` is
  unchanged. **Owed:** every full-corpus run used `--inject-skew`, so the deskew *estimator* is
  validated on 132 pages.
- **⛔ The confidence signal missed its pre-registered bar, and W8 is DROPPED (owner, 2026-08-05).**
  The signal is real (flagged strips average **8.60 token edits vs 2.69**) but "flag 10% of tokens,
  catch ≥60% of errors" is **NOT MET** — best at a 10% budget is **26.3%**, and a usable soft point
  existed and was **not** taken. **The bar was not moved to fit the result.** Nothing is deleted;
  it is a strong candidate to return if a friend asks. Detail: [mvp/rungs.md](mvp/rungs.md).

## Previously (real-page track — all still true)

**The re-slice is DONE and REAL-VAL v2 IS BUILT.** `data/real/rung3/_realval_v2` holds **267 strips
at the exam's own difficulty mix — 47 easy / 110 mid / 110 hard (17.6 / 41.2 / 41.2%)**, against the
old pool's 59 / 41 / **0**. The 110 hard strips are hand-verified, every crop comes from the new
slicer, and no decode-derived label survives. Numbers: [METRICS-SLICER.md](METRICS-SLICER.md).
Full account: [log/status-log.md](log/status-log.md).

- **The val-side pool is 146 pieces / 194 pages** — the old "158 pages" figure was wrong by more
  than the stem fix could explain, and 37 page stems had never been sliced at all.
  `emit_strip_labels.py --val-side` now derives the list through `data.is_real_val_piece`.
- **The queue ordering was REVERSED (owner, 2026-07-29): worst rows first — and the finished queue
  proves it.** All 165 rows were read by hand (111 ok / 44 fix / 10 bad, 155 usable): the **worst
  half needed a fix 46% of the time, the best half 7%** — a 6.5× concentration. Under the old
  most-confident-first ordering half the effort would have gone to rows that needed nothing. The
  early-stop protocol was not used and stays available; why the stop is gated on error
  *clustering* rather than error count is in [rung3/labeling.md](rung3/labeling.md).
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
  means and what is deliberately NOT joined into it: [rung3/labeling.md](rung3/labeling.md).
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
  [METRICS-SLICER.md](METRICS-SLICER.md).

**✅ The "2% pre-shrink" is CLOSED (2026-07-31): it does not replicate, and off the exam it makes
things WORSE.** Shrinking exam strips ~2% removed 12–15.5% of corrections (562 → 475) and looked
like the biggest free lever this project had found. Re-run on the rebuilt `_realval_v2` — which now
has the hard tier whose absence was the last defence of the result — **every scale is worse:
+2.7% at 1%, +5.2% at 2.5%** ([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)). The effect
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
mix and bar-line density in `select_pieces.py`. `USUL_BEAM_GROUPS` remains **unvalidated and
quarantined** (the beam check measured thickness, not grouping) and `staff_jitter` is insurance, not
a fix. Full detail: [rung3/round3.md](rung3/round3.md); why each was dropped:
[DECISIONS.md](DECISIONS.md).

## Previously (Round 2, still true)

**Phase 3 (real pages).** Synthetic reading is solved; every open problem is about real printed
pages and photos of them.

- **The goal changed on 2026-07-27: ≥90% of pages need ≤5 corrections, and the app shows where they
  are** ([ROADMAP.md](../ROADMAP.md) §0). Model accuracy is now a diagnostic, not the target.
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
  the slicer's trade-off. The `stripExport` fix that sat here is dropped ([DECISIONS.md](DECISIONS.md)).
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

Numbers for all of the above: [METRICS.md](METRICS.md). Why things were decided this way:
[DECISIONS.md](DECISIONS.md). Round 2 in full: [rung3/round2.md](rung3/round2.md).

## Next — two tracks, running in parallel

Since 2026-08-05 the product and the model advance independently: **the product track never trains,
the model track never touches the app.** Either can be worked on without waiting for the other.

### Track A — the product (W9 → W10 → public)

1. **✅ DONE 2026-08-06 — the app and the weights are hosted.** `dist/` on **Netlify** at
   **<https://komavision.netlify.app>**, weights on the Hub at **`Beyaban/omr-weights`** (uploaded
   from `apps/server/models/`, so container, Hub and checkout stay one artifact set). The two traps
   — the Hub's *reflected* CORS origin, and Netlify SSO-gating every new site behind a 401 — are in
   [mvp/hosting-setup.md](mvp/hosting-setup.md). ⚠ **Cloudflare Pages was ruled OUT on a number**
   (25 MiB per-asset cap vs our 25.58 MiB wasm); the shrink to `onnxruntime-web/wasm` is **deferred
   on purpose** — it changes the fallback's runtime.
2. **The origin lock, the 413 fix and `--cpu-boost` are all deployed** (2026-08-06) — this row used
   to be the next action and is now history; the log has it.
   ⚠ **Do not delete the in-browser decode.** `gate:browser`, `parity:armb`, `parity:arma`,
   `smoke:page` and the W3 browser-vs-gold result all rest on it; it is both the reference the
   server is checked against and the live fallback path.
3. **⏸ Everything else about speed is DEFERRED to after W10** (owner, 2026-08-06): ship at **~35–55 s
   a page**. Splitting a page across instances (~52 s → ~13 s) is the only option that touches the
   warm wait — the cold start is just 10.6 s of it — and it costs a rate-limiter rewrite plus a
   chunked-vs-unchunked parity check. **The trigger to build it is a friend saying the wait is
   annoying**, which is exactly what W10 is for. Menu and prices: [mvp/latency.md](mvp/latency.md).
4. **✅ THE STYLE PASS IS DONE (2026-08-07), and ⬅ THE REDEPLOY IS THE NEXT ACTION.** Scope held:
   presentation only. Every check passes on the built artifact — `npm test`, `gate:browser` 27/28,
   `smoke:app`, `smoke:page`, and **`smoke:build` on both paths with identical scores**
   (`9/26/399/26` server vs fallback). What remains is one command pair from
   [mvp/hosting-setup.md](mvp/hosting-setup.md) ("Shipping a change afterwards") — a **rebuild with
   BOTH env vars** and `netlify deploy --prod` — then `npm run smoke:live`.
   ⚠ **That one deploy carries TWO changes**: the style pass and makam selection. So if `smoke:live`
   goes red it has two suspects; `smoke:build` against a local `dev:server` was run first for
   exactly that reason, and passed.
   ⚠ `smoke:build` from localhost cannot reach the LIVE server (`ALLOWED_ORIGINS` refuses it — the
   lock working). Use a local `dev:server` for `smoke:build`, and `smoke:live` for the deployed chain.
   Still genuinely open on makam: detection accuracy is scored on **clean SymbTr scores, never on
   decoded pages**, where the derived signature is noisier — and stage 9's **header OCR** still does
   not exist, so the makam is inferred from the notes rather than read off the page.
5. **W10 — release to two friends.** Ask what features to add. No ads and no in-app feedback widget:
   talk to them.
6. **Public launch** — a later rung, gated on Round 3's exam result, not on W10.

### Track B — the model (Round 3, UNPAUSED)

4. **Write down what Round 3 must reach, BEFORE training starts** — on the user-effort metric (≥90%
   of pages ≤5 corrections; baseline 57%), with micro and macro≥30 quoted beside the macro mean.
   This is now also the **public-launch gate**, so it settles more than one thing. Then render once,
   train stage 1 once with several cheap stage-2 variants, read the exam once.
5. **The content work in `select_pieces.py`** — eighth/quarter-note mix and bar-line density (owner
   decision 2026-07-27: these only; ties and accidentals stay out). Verify on a 300-strip pilot with
   `domain_gap.py` before regenerating `data/pieces.json`. Guard: check the accidental counts before
   and after on the same pilot and treat a drop as a stop sign, not a trade.
6. **Decide whether to re-emit the training pools from the new crops.** The re-slice is done; this
   is the separate decision it unlocks, **not** a formality — re-emitting rewrites the manifests the
   promoted verdicts hang off, so it needs its own `--out` and a look at what moved first. Weigh it
   against the evidence that Round 3's target — pitch (40%) and duration (28%) of user edits — is a
   *synthetic content mix* problem, not a shortage of real strips (2,330 accepted already).

### Cheap, owed, and independent of both

7. **The deskew *estimator* is validated on 132 pages, not the corpus** — every full run injects
   Python's angle. It used to cost ~18 h of browser time; at 1.3 s/page a full un-injected corpus
   run is now well under an hour, so this is worth simply doing.

### Further out (not next, not cancelled)

1. **DONE (2026-07-31): every consumer now reads `_realval_v2`**, and `make_realval_pool.py` is no
   longer the selection set — pointing an eval at its `_realval` output silently restores the
   no-hard-tier pool. Detail: [log/status-log.md](log/status-log.md).
   - **Not recoverable, for the record:** the owner's 130 v1 verdicts (**65 ok / 22 fix / 43 bad**)
     did not transfer — no crop survives a re-slice unchanged. What they bought is the confidence
     calibration and the 33% crop-failure rate that sized the 165-row v2 queue.

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

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 numerics
investigation — now two instances, a dropped double dot (Round 1) and a dropped `\tup3` (Round 2),
both reference-path only and both fine under Python-ORT int8.

## Open risks and non-claims

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
