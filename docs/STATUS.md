# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-08

## Now

**⚠ A COPYRIGHT PASS LANDED 2026-08-08 AND IS NOT DEPLOYED YET — the live site still serves the old
build.** The next action is a redeploy (recipe in Track A below). What changed and why:
[THIRD-PARTY.md](THIRD-PARTY.md), decision row in [DECISIONS.md](DECISIONS.md).

The finding: **the deployed app was publishing content it had no right to publish.** Every bundled
score is a SymbTr export, and SymbTr is **CC BY-NC-SA 4.0** — serving one owes attribution, binds
the derived file to ShareAlike, and holds the whole app to **NonCommercial forever**. Two were also
compositions still in copyright under FSEK 5846 (life + 70): *safalar getirdiniz* (Avni Anıl,
d. 2008) and *delisin deli* (Selahattin Pınar, d. 1960). A neyzen.com screenshot
(`Meltem - 1. Hane.png`) was committed to the **public** GitHub repo.

The owner chose **removal over attribution**, to keep the app commercially unencumbered. So:

- **`SAMPLES` is empty and the app opens on the upload prompt** — no bundled score, no Sample
  dropdown. The files stay on disk (gitignored) because `npm test`, `smoke:editor` and the manual
  checks read them through `?score=…`; local use is not distribution.
- **`prune-dist.mjs` now fails the build on any `.json` at the dist root.** That is the real guard —
  "no UI links to it" is not "not published", since everything under `public/` is served to whoever
  guesses the name. Negative-tested: it exits 1.
- **A legal footer** (`#legal`) states that uploads are not stored — true: the server never writes
  an image to disk — that the user owns what they upload, and links the repo's issue tracker as the
  takedown route. Notices ship at `/THIRD-PARTY.txt`.
- **The Hub weights need a model card**; [`hf/README.md`](../hf/README.md) is written and awaits
  upload. `Flova/omr_transformer` is Apache-2.0, whose §4 requires attribution to travel.

Green after the change: `typecheck`, `npm test` (217/217 round-trip), `smoke:editor` (**ALL PASS**,
including the grace-note geometry section, which still reads its 427 boxes off the local file),
`smoke:page` (**PASS** — page in, playable score out, from the empty state), `build:app` (11 files,
42.7 MB, no score reaches `dist/`).

⚠ **Still open, both the owner's call:** the samples and the screenshot are out of HEAD but remain
in the repo's **git history**, and the repo is public — clearing them needs a `filter-repo` rewrite
and a force-push. And there is still **no LICENSE file**.

**THE REDEPLOY IS DONE, 2026-08-08.** <https://komavision.netlify.app> now carries **makam
selection**, **the style pass** and **the editor, steps 1–8 + 10** — one build, as the owner asked.
`smoke:live` passes on both paths and the editor was additionally driven on the *deployed* bundle
(`smoke:editor` only ever ran on the dev server). It needed no Cloud Run rebuild and no Hub
re-upload: nothing under `apps/server/` or `apps/web/src/omr/` had moved since the live revision.
Numbers: [METRICS.md](METRICS.md); how and what it found: [log/status-log.md](log/status-log.md).

**✅ TWO BUGS THAT REDEPLOY FOUND ARE FIXED, same day — both settled, nothing owed.** The
**cold-start fallback** (a warming container's truthful `503` made a friend's first upload after
idle decode on their own laptop; the client now waits it out and pings `/health` on open, pinned by
`check:coldstart`) and the **"one giant note"** (a grace note's merged bounding box stole 126 of 134
clicks; boxes reaching the SVG origin now fall back to the note's own ink, pinned by `smoke:editor`
on a grace-note score). Both are written up in full — mechanism, what was rejected, and the numbers
— in [log/status-log.md](log/status-log.md); the rules they left behind are in
[../CLAUDE.md](../CLAUDE.md), the numbers in [METRICS.md](METRICS.md).

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

**THE STYLE PASS IS DONE, 2026-08-07 — AND LIVE SINCE 2026-08-08.** The harness is now
**KomaVision**, in **Turkish**, on warm paper: upload is the hero (drag, drop or paste), the transport
keeps the controls a musician touches, the rest fold into a collapsed **Gelişmiş**. ⚠ **Three came
back up on 2026-08-08** (owner): transposition, *porte değişmesin* and *arıza işaretleri* sit in the
transport bar, because a ney player transposing a score is using the app as intended and should not
have to open "geliştirici ayarları"; the transposition list now speaks **komas**, named by the scale
degree one lands on ("4 ses (22 koma)"). Slicing, decode, the fallback and the origin lock did not
move. Underneath it, the load-bearing change: **the deploy checks no longer read the copy** —
`#omr-status` carries `data-state / kind / where` + counts (`apps/web/src/ui/status.ts`), which is what
let the UI become Turkish without touching one assertion.

**THE EDITOR REWORK IS BUILT AND LIVE — steps 1–8 and 10, 2026-08-07/08.** Edit mode is a Mus2-style
armed palette beside the sheet: click a note to select, **✕** to delete, **drag** to move its pitch
(carrying its accidental across the octave seam), **undo/redo** (buttons + Ctrl/⌘+Z); arm a value, a
rest or any of the thirteen koma signs and click a note to apply it, or click blank staff to **insert**
one — pitch from the click's height, previewed by a ghost notehead. **ÜÇLEME** makes and unmakes
triplets, with everything illegal dim and unclickable rather than erroring. A `+`/`−` badge marks any
bar off the **derived meter**; **edits absorb and bar lines never move**. The palette's own **Çal
plays from the last edited bar**. The per-measure modal is deleted.
Underneath it, one set of edit primitives (`packages/core/src/edits.ts`) serves every edit path, which
fixed a live bug on the way: the piano roll moved a dragged note's *sound* and left its notehead
behind. What each step built, and the traps worth knowing before touching any of it (Bravura ink
outside its em box; a tuplet is **not stored**, so the check counts drawn marks in both styles; bar 1
is exempt from the short-bar warning): **[mvp/editor-built.md](mvp/editor-built.md)** and the brief
**[mvp/editor.md](mvp/editor.md)**. Blow-by-blow: [log/status-log.md](log/status-log.md).

**The next action is EDITOR STEP 9 — delete `Save JSON`** (and its two `app-smoke` checks and the
`PIPELINE.md` references), the last item on the editor's list. ⚠ It needs one thing solved first:
`smoke:editor` reads the document by clicking `#save-json`, so deleting the button removes the
check's only way to see what an edit did. TWO tracks run in
parallel, as re-scoped on 2026-08-05:

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
  ⚠ **And the cold start is not paid as 10.6 s of waiting — it is paid by losing the server path for
  that page entirely** (2026-08-08, top of this file).
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
  `document`. Fixed by shipping ORT's runtime as real files (`/ort/`, `wasmPaths`). ⚠ Dev,
  `smoke:page` and the 27/28 gate were all green while the thing a friend would open was broken —
  which is the whole argument for `smoke:build`; it is a hard rule in [../CLAUDE.md](../CLAUDE.md).
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
  (36.6 → 1.3 s/page, a closed form for the skew sweep, **0 disagreements in 328 evaluations**).
  Detail: [log/status-log.md](log/status-log.md), numbers: [METRICS.md](METRICS.md).
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

## Previously — the settled context

The real-page track's established findings (real-val v2 and the re-slice, the Round 3 pre-render
checks, the Round 2 position) moved to **[rung3/standing.md](rung3/standing.md)** on 2026-08-07, so
this file can hold only "now" and "next". Nothing there is a next action.

## Next — two tracks, running in parallel

Since 2026-08-05 the product and the model advance independently: **the product track never trains,
the model track never touches the app.** Either can be worked on without waiting for the other.

### Track A — the product (W9 → W10 → public)

0. **⏭ THE NEXT ACTION: redeploy, carrying the copyright pass.** The live site still serves scores
   that are not ours to serve. Nothing under `apps/server/` or `apps/web/src/omr/` moved, so this is
   Netlify only — no Cloud Run rebuild, no Hub re-upload of the weights. Build with both real env
   vars (⚠ not the `smoke:build` artifact, which is baked with `localhost:8080` — see item 4), then
   `npm run smoke:live`. **Upload `hf/README.md` to the Hub as the model card in the same sitting**:
   `huggingface-cli upload Beyaban/omr-weights hf/README.md README.md`.
1. **✅ DONE 2026-08-06 — the app and the weights are hosted.** `dist/` on **Netlify** at
   **<https://komavision.netlify.app>**, weights on the Hub at **`Beyaban/omr-weights`** (uploaded
   from `apps/server/models/`, so container, Hub and checkout stay one artifact set). The two traps,
   and why Cloudflare Pages was ruled out: [mvp/hosting-setup.md](mvp/hosting-setup.md) and
   [DECISIONS.md](DECISIONS.md). ⚠ The `onnxruntime-web/wasm` shrink is **deferred on purpose** — it
   changes the fallback's runtime.
2. **The origin lock, the 413 fix and `--cpu-boost` are all deployed** (2026-08-06); the log has it.
   ⚠ **Do not delete the in-browser decode.** `gate:browser`, `parity:armb`, `parity:arma`,
   `smoke:page` and the W3 browser-vs-gold result all rest on it; it is both the reference the
   server is checked against and the live fallback path.
3. **⏸ Everything else about speed is DEFERRED to after W10** (owner, 2026-08-06): ship at **~35–55 s
   a page**. Splitting a page across instances (~52 s → ~13 s) is the only option that touches the
   warm wait — the cold start is just 10.6 s of it — and it costs a rate-limiter rewrite plus a
   chunked-vs-unchunked parity check. **The trigger to build it is a friend saying the wait is
   annoying**, which is exactly what W10 is for. Menu and prices: [mvp/latency.md](mvp/latency.md).
4. **✅ THE STYLE PASS IS DONE (2026-08-07) AND DEPLOYED (2026-08-08)** — in one build with makam
   selection and the editor, by the owner's call to build first and deploy once. Scope of the style
   pass itself held: presentation only. `smoke:build` came out `9/26/399/26` on both paths,
   **identical to the pre-editor run**, and `smoke:live` passes warm.
   ⚠ Reviewing locally first: `dev:web` on **:5173** — that port is in `ALLOWED_ORIGINS` so uploads
   reach the live decode server; on :5174 they fall back to the laptop.
   ⚠ The redeploy recipe has one trap worth keeping: the `dist/` that `smoke:build` leaves behind is
   baked with `localhost:8080`, so the artifact that ships must be a **second** build with both real
   env vars.
5. **THE EDITOR REWORK — steps 1–8 AND step 10 are DONE AND DEPLOYED (slice 1 on 2026-08-07; the
   palette, its Çal/Dur, insert-on-empty-space, the tuplet tool, the off-meter bar mark and the
   **deletion of the per-measure modal** on 2026-08-08); ⬅ step 9, deleting `Save JSON`, is all that
   is left.** ⚠ Steps 1–8 are now checked on the **deployed production bundle** as well as on dev —
   worth keeping up, because `smoke:editor` cannot see that build ([METRICS.md](METRICS.md)).
   ⚠ **The modal was deleted out of order, at the owner's request.** It took four things with it;
   **two came back into the palette the same day** (owner's call): an **Es row of six rest values**
   — arm one and click blank staff, or click a note to turn it into a rest, and a note value on a
   rest turns it back, pitched by the click's height — and **all thirteen alterations**, the
   numbered ±2/±3 and the previously-missing ±8 included. Still gone: editing a **lyric syllable**
   and typing an exact **koma/Hz**. ⚠ A ±2/±3 is stored exactly and **drawn snapped** to the nearest
   AEU sign, because that is what a Turkish edition prints. Detail: [mvp/editor.md](mvp/editor.md).
   The modal is gone; **Düzenle** opens a **Mus2-style armed palette** beside the sheet — pick a note
   value, an accidental or the tuplet tool, then click the score. **✅ Built:** clicking a note
   selects it, an **✕** deletes it, **dragging it** moves its pitch, **undo/redo** works
   (buttons + Ctrl/⌘+Z), **arming a note value or an accidental and clicking a note applies
   it**, the palette's **Çal plays from the last edited bar**, **arming a note value and
   clicking blank staff inserts one there** — pitch from the click's height, previewed by a ghost
   notehead, absorbed into the bar — **the tuplet tool** (click a note and the note two along; click
   any member to take one apart; everything illegal is dim and unclickable) and **the off-meter bar
   mark** against the derived meter, **rests** and **every koma sign** in the palette, and the
   per-measure **modal is deleted**. **Still owed: one deletion, `Save JSON`.** Editing is **whole-score, not measure-scoped**, and there is **no zoom**.
   ⚠ Step 5 left one thing deliberately unbuilt and said so in the brief: **an edit still stops
   playback**. Resume-in-place is deferred, not done.
   ⚠ Slice 1 deviated from the brief in one place, on purpose: the per-note rects are **local
   `SheetView` state, not part of `onLayout`** — that payload is the training-strip crop contract.
   ⚠ It also **fixed a live bug it found**: the piano roll moved a dragged note's sound and left
   the notehead behind (`updateEvent` never rewrote `noteName`). Both edit paths now share
   `packages/core/src/edits.ts`.
   ⚠ Settled, do not re-open: **repeats stay uneditable** (the stitcher unfolds them), **tuplets are
   exactly three notes** (the drawn digit is hardcoded "3") and their members must be **plain
   `1/2^k` values** (a dotted run's ×⅔ never closes), and **token-editing was rejected**.
   ⚠ Also settled: an edit **absorbs into its bar and bar lines never move**, and a bar over *or*
   under its length **warns** rather than blocking. The reference for that warning must be the
   **derived meter**, not `Measure.lengthBeats` (which is computed from the bar's own contents and
   so is true by construction). **Nothing is open** — the brief is buildable as written:
   **[mvp/editor.md](mvp/editor.md)**; what each step built and the traps it found:
   **[mvp/editor-built.md](mvp/editor-built.md)**. Does not gate W10.
   ⚠ **Now visible, and still unverified:** that meter check flags **8/28 interior bars on a decoded
   page vs 0/200 across three clean scores** — error localisation, free, from a warning the editor
   needed anyway. It is on screen as of step 8, so it can now be looked at on more decoded pages.
   n = 1 page; verify before promising it.
6. **W10 — release to two friends.** Ask what features to add. No ads and no in-app feedback
   widget: talk to them.
7. **Public launch** — a later rung, gated on Round 3's exam result, not on W10.

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

- **The cold-start fix is proven on a FAKED cold window, not yet on a genuinely idle service.**
  `check:coldstart` controls the window deliberately, which is the better test of the mechanism — but
  the real thing has only been seen warm since the fix. One `smoke:live` after ~20 minutes of nobody
  touching the site would close it; it was armed on 2026-08-08 and cancelled, because using the app
  for a demo recording warms the service and voids the test. Until then, that a real Cloud Run cold
  start now reaches the server is an inference from a local reproduction.
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
