# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-06

## Now

**The decode server is BUILT and checked; it has never been deployed. The next action is a
`gcloud` deploy, which needs the owner's Google account.** TWO tracks run in parallel, as re-scoped
by the owner on 2026-08-05:

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

- **✅ W9 IS BUILT — `apps/server/`, and the app reads a page through it (2026-08-06).** Node +
  `onnxruntime-node` importing the browser's own `decode.ts`, so there is **one decode
  implementation, not a third**; `CLAUDE.md`'s Python-never-ships rule is untouched. The client
  swaps behind `VITE_DECODE_URL` and falls back to in-browser decode on any failure. All three
  paths give the **same score** on the same page (7 staves → 16 strips → **344 notes / 28
  measures**): browser **24.5 s**, server **6.0 s**, dead-server fallback **25.0 s** while saying so
  in the status line. The tab's slowest reply during a read drops **2,358 ms → 29 ms**.
  **What decides the quality question is the gold check, not agreement**: both arms scored on the
  same 267 hand-verified `_realval_v2` strips with the same scorer, **paired — no detectable
  difference** (McNemar exact **p = 0.727**, edits 780 vs 768). Strip-level agreement is 93.8%, and
  the divergences sit at tokens the model was ~55% sure of.
  ⚠ **NOT DEPLOYED.** No `gcloud` on this machine and no project set up, so **cold start and a real
  cloud vCPU's speed are unmeasured** — every server number is from the dev M4 and is an upper bound
  on speed, a lower bound on cost. ⚠ Docker could not be run locally either (Rancher Desktop is
  installed but its daemon is not running), so the **container has never been built**; it builds in
  Cloud Build by design, but that is one more thing the first deploy will discover.
  ⚠ The **hard billing cap is still owed** — the only safety item that bounds the bill, and the only
  one not checkable from the repo. Commands, flags and reasoning: [mvp/deploy.md](mvp/deploy.md).
  ⚠ **The HOSTING half of W9's title is untouched, and W10 cannot happen without it**: the app still
  runs from `npm run dev:web`, and the fallback's weights still come from `apps/web/public/models/`
  rather than the Hugging Face Hub. The decision is unchanged and unbuilt — it simply was not part
  of the server work, and saying so now is cheaper than discovering it at the release.
- **⛔ THE BATCHING ARGUMENT FOR HAVING A SERVER IS WITHDRAWN — measured, not argued (2026-08-06).**
  `deploy.md` listed "no batching, ever" as a structural advantage over `onnxruntime-web`. Batch 8
  against batch 1 is **slower at every thread count** (1 thread 12.0 vs 11.8 s/page, 2 threads 8.7
  vs 8.3, 4 threads 7.4 vs 7.4) and costs **2.9× the peak memory** (2,778 MB vs 955 MB on a 38-strip
  page). One 409×583 Swin forward already fills the cores. `OMR_MAX_BATCH` now defaults to **1**; the
  batched path stays behind the knob because this is one CPU architecture. **The real second reason
  for a server is that native ORT is ~4× faster than wasm** — 6.0 s against 24.5 s on the same M4.
  The **"smaller upload" reason is withdrawn too**: the crops upload is a median **1.7× the page
  image**, not smaller.
- **A page costs 11.7 vCPU-seconds at 1 vCPU** — measured from the server's own `process.cpuUsage()`,
  which is what Cloud Run bills. **1 vCPU is the cheapest shape by 2.5×** (2 vCPU 16.8, 4 vCPU 29.3),
  and the free tier covers roughly **15,400 pages/month** there. The earlier 30–60 vCPU-s estimate
  was ~3× pessimistic because it assumed the batching that does not exist.
- **The safety checklist is a command now**: `npm run check:limits` — **6/6** payload cases plus the
  per-IP rate limit, and it prints the billing-cap item it cannot check instead of counting it.
- **There is a SLICE INSPECTOR now (`/slices.html`), and it is how the two fixes below were found.**
  Upload a page, see every crop the slicer made, captioned with the slicer's own decisions, its
  decoded label with note names substituted (`si'16`), its confidence and its vertical placement —
  in red with the shortfall when a side is cut. It loads the model but never builds a score, so it
  cannot disturb the editor. [MANUAL_CHECKS.md](MANUAL_CHECKS.md) Check 13.
- **✅ A SLUR ABOVE THE STAFF WAS SHEARING THE BEAMS BELOW, AND IT IS FIXED (2026-08-05).**
  `place_band` let ink above the staff claim room without limit, so a slur pushed the staff down and
  the frame cut the beams — the ink that carries duration. Ink above may now claim only **3.5 sp**.
  Over 120 pages / 901 rows: **0 px lost inside the ledger-note zone**, beam loss **19,932 → 17,231
  (−13.6%)**. **Not a trade** — bottom-first destroys 500 px of real ledger-note ink.
  ⚠ **An information argument, not a decode result** (at 2.6% of rows an A/B is underpowered), and
  ⚠ the other **85% of clipped rows are not fixable by placement** — their music genuinely exceeds
  the frame, and only a scale change reaches those, at 12–15% edits per 1%.
- **✅ THE PAGE LATENCY IS FIXED, EXACTLY (2026-08-05): 36.6 → 1.3 s/page, answers unchanged.** The
  41-rotation skew sweep ran a page-wide `morphologyEx` per angle; its kernel is `len`×1, so the
  opening is per-row and has a closed form, and `qualifyingLineRows` only wanted the row sums:
  **856 ms → 6.8 ms per call, 125.8×**. **A substitution, not a heuristic, and checked as one** —
  `npm run check:deskew` runs both implementations at every angle the coarse pass evaluates:
  **0 disagreements in 328 evaluations**, deskew angle still identical 20/20, W4/W5/W6 exact. The
  browser slicer is now faster than the Python it copies. ⚠ The subtle part is the border rule —
  `morphologyEx` erodes as if outside the frame were foreground — which is why the check sweeps
  angles rather than testing one. Detail: [log/status-log.md](log/status-log.md).
- **A decoded `\tup3` that could not close was drawing the WRONG rhythm, and is fixed (2026-08-05).**
  Owner-reported as "`\repstart`/`\repend`/`\tup3` are not seen in the sheet"; over the 1,704 decode
  caches it was two different things. **Repeats are not lost** — the note model has no field for one,
  so they are consumed into an UNFOLDED playing order, the wanted behaviour (owner: no repeat
  barlines drawn, unfold with correct voltas, cursor forward only); **1,165/1,262 pages unfold
  (92.3%)**, the other **97 (7.7%)** carry a `\repstart` the model never closed and are left alone
  rather than guessed at. **Triplets were genuinely broken**: an unclosed run yielded no group, so
  every member snapped to the nearest plain value — a definitely-wrong rhythm with no mark saying
  so, **1,287 notes / 22.9% of `\tup3`-bearing pages**, now **0**.
  ⚠ `tupletGroupsIn` is shared with the label serializer by design, so both moved: **5 measures in 1
  of 190 training pieces**, on a future re-render only. ⚠ **`verify-labels.ts` cannot see this** — it
  inspects accidental glyphs; the real check was rendering the 3 worst pages through both draw paths
  with 0 dropped measures.
- **✅ W7 PASSED (2026-08-05): THE APP READS A WHOLE PAGE.** Upload an image, get a playable,
  editable, saveable score — slice, decode, stitch, render, play, nothing stubbed. `npm run
  smoke:page`: **7 staves → 16 strips → 344 notes / 28 measures**, strip count matching local Python
  16 vs 16. The 35-second freeze was fixed by making `estimate_skew` a **generator with two
  drivers** rather than an async copy, with **no arithmetic change** — verified, deskew angle
  identical 20/20. ⚠ A hang at 0% CPU turned out to be Vite's dep optimizer full-reloading the tab
  mid-slice, not the port; `optimizeDeps.include` fixes it. Detail: [mvp/rungs.md](mvp/rungs.md).
- **✅ W0–W6 PASSED (2026-08-02/04) — the slicer port is done and the browser is not worse than
  Python.** opencv.js bit-identical on all five primitives; decode extracted with per-token
  confidence; the browser scored against the SAME hand-verified gold as Python — **SER 0.0821 →
  0.0818, exact-match 60.2% both**; and the ported slicer checked over the whole corpus, 1,781 pages
  / 33,805 strips, with the decode arm **paired** (McNemar p = 0.077, no detectable difference).
  Write-ups, including the four hypotheses that died along the way: [mvp/rungs.md](mvp/rungs.md).
  Numbers: [METRICS-SLICER-PORT.md](METRICS-SLICER-PORT.md).
  ⚠ Three things from those rungs that still bind: **agreement with an artifact is not correctness**
  (the `strips_v2` manifests are not the bar — the current Python reproduces only 98.59% of them,
  and three separate criteria had to be restated for this reason); **`prepPage` is not a no-op**
  (15.3% of corpus pages take a real rotation); and the **86.0% browser-vs-Python ceiling** is
  near-ties, not a resampler — disagreement concentrates where the model is unsure (21.9% agreement
  below `min_logprob < -1.0` against 90.9% above), so `preprocess.ts` is unchanged. **Owed:** every
  full-corpus run used `--inject-skew`, so the deskew *estimator* is validated on 132 pages.
- **⛔ The confidence signal missed its pre-registered bar, and W8 is DROPPED (owner, 2026-08-05).**
  Against gold, flagged strips do average **8.60 token edits vs 2.69** — the signal is real — but
  "flag 10% of tokens, catch ≥60% of errors" is **NOT MET**: the best achievable at a 10% budget is
  **26.3%**. A usable soft operating point existed (`min_logprob < -0.5`: flag 22.6% of strips, catch
  57.1% of edits, 2.5× lift) and was **not** taken. **The bar was not moved to fit the result.**
  Nothing is deleted — the measurement, `check:logprobs` and the per-token logprobs all stay, and it
  is a strong candidate to return if a friend asks for it. Detail: [mvp/rungs.md](mvp/rungs.md).

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
  1,704 decode caches / 35,586 crops** — 1,578 re-sliced on Colab plus the 203 val-side pages.
  Verified: every cache passes `window_cache_ok` and records `round2-stage2-best`, so the emitter
  reuses all 1,704 rather than discarding them. 67 pages (4.2%) found no staves — covers and
  near-empty continuation pages, matching the 4.6% seen on the val side.
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

1. **DEPLOY THE SERVER — the one step W9 cannot finish on this machine.** Needs a Google account, a
   project and billing; the commands, the flags and *why each flag* are in
   [mvp/deploy.md](mvp/deploy.md) ("Running it, and deploying it"). Order: create the Artifact
   Registry repo → `gcloud builds submit` (the image builds in Cloud Build, **not** locally — an
   Apple Silicon `docker build` produces arm64 and Cloud Run will not start it) → `gcloud run deploy
   --cpu 1 --concurrency 1 --max-instances 3 --memory 2Gi` → **set the hard billing cap and alert**
   → re-run `npm run check:limits -- --url <service>` and `npm run bench:server -- --url <service>`
   against the real thing and replace the laptop numbers in [METRICS.md](METRICS.md).
   ⚠ **The first deploy is also the first cold-start measurement.** If it is intolerable, deploy.md
   names the fallback: Hetzner at ~€4/month, which is cheaper than keeping Cloud Run warm.
   ⚠ **Do not delete the in-browser decode.** `gate:browser`, `parity:armb`, `parity:arma`,
   `smoke:page` and the W3 browser-vs-gold result all rest on it; it is both the reference the
   server is checked against and the live fallback path.
2. **Host the app, and move the weights to the Hugging Face Hub.** The other half of W9's title,
   and W10's blocker: a COOP/COEP-capable static host (the fallback needs wasm threads — this
   requirement did NOT go away when decode moved server-side) plus Hub-delivered weights fetched
   lazily on first fallback. Decisions are settled; the code is not written.
3. **W10 — release to two friends.** Ask what features to add. Billing cap first. No ads and no
   in-app feedback widget: talk to them.
4. **Public launch** — a later rung, gated on Round 3's exam result, not on W10.

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
   promoted verdicts hang off, so it needs its own `--out` and a look at what moved before anything
   is promoted. Weigh it against the evidence that Round 3's target — pitch (40%) and duration (28%)
   of user edits — is a *synthetic content mix* problem rather than a shortage of real strips: the
   pools already hold 2,330 accepted real strips (nota 1,740, r1 421, tup 169).

### Cheap, owed, and independent of both

7. **The deskew *estimator* is validated on 132 pages, not the corpus** — every full run injects
   Python's angle. It used to cost ~18 h of browser time; at 1.3 s/page a full un-injected corpus
   run is now well under an hour, so this is worth simply doing.

### Further out (not next, not cancelled)

1. **DONE (2026-07-31): every consumer now reads `_realval_v2`.** `degrade_probe.py` and
   `empty_crop_probe.py` default to it; `staff_geometry_probe.py` gained `--strips-dir` (still
   defaulting to the frozen exam). `make_realval_pool.py` is **not** the selection set any more —
   its `_realval` output is the *base* `--build` extends, and its docstring now says so, because
   pointing an eval at it silently restores the no-hard-tier pool. It also stopped carrying a third
   verbatim copy of the val-split hash and calls `data.is_real_val_piece` (verified: 0 of 444
   pieces change side). Round-1/2 notebooks are left alone — one notebook per round, never
   re-pointed.
   - **Not recoverable, for the record:** the owner's 130 v1 verdicts (**65 ok / 22 fix / 43 bad**)
     did not transfer — no crop survives a re-slice unchanged. What they bought is the confidence
     calibration and the 33% crop-failure rate that sized the 165-row v2 queue.

   *(The re-emit decision and the `select_pieces.py` content work used to sit here; both are now
   live under Track B above.)*

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
