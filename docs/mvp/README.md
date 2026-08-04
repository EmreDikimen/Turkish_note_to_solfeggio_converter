# MVP track — the in-browser pipeline, and a release to friends

purpose: the plan and running state of the W0–W10 ladder that turns the frozen model into a link someone can open
audience: agents and the owner working the product side (not the training side)
updated: 2026-08-04

> **Picking up W4–W6 (the slicer port)? Read [slicer-port.md](slicer-port.md) first** — it carries
> the function map, the acceptance thresholds and the traps that were found the expensive way.
>
> Current state and next action for the WHOLE project are NOT here: see [../STATUS.md](../STATUS.md).
> Numbers: [../METRICS.md](../METRICS.md), [../METRICS-SLICER.md](../METRICS-SLICER.md) and
> [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).
> Decisions: [../DECISIONS.md](../DECISIONS.md). Pipeline design: [../PIPELINE.md](../PIPELINE.md).

## Why this track exists

Two real-page rounds have shipped as "improvement, not pass". Round 3 targets pitch (40%) and
duration (28%) of user edits through a synthetic content-mix change — a real lever, but an unknown
one, and **nothing a friend would notice**. Meanwhile the product half of the goal set on
2026-07-27 (≥90% of pages ≤5 corrections, *and the app shows you where they are*) has never been
built at all.

So: **freeze the model, finish the pipeline, release, then train Round 3 against real feedback.**
The model stays `round2-stage2-best` int8 for the whole ladder. This track trains nothing.

The gap turned out to be narrower than it looked. Decode, Donut preprocessing, detokenization,
stitching, the editor and playback all already exist in browser-safe form; the decode helpers in
`apps/web/src/omrGate.ts` were simply never exported, and `tools/render/stitch.ts` is confirmed
free of node imports. **The only genuinely missing piece is the page→strips slicer**, which lives
in `src/vision/page_to_strips.py` (1,077 lines of numpy/OpenCV) and has no TypeScript counterpart.

## Scope decisions (owner, 2026-08-02)

| Decision | Why |
|---|---|
| Slicer ported with **opencv.js**, not hand-rolled | Parity over bundle size; 13 MB is noise beside 211 MB of weights. Validated at W0. |
| **Screenshots and clean scans only** | Real uploads are mostly web screenshots. Cuts the hardest third of the port. ⚠ The stated reason — "the photo front-end is a no-op on clean input" — held for the perspective crop and **failed for the deskew** (W4): 15.3% of corpus pages take a real rotation, so it is ported. |
| Weights on **Hugging Face Hub**, app on a COOP/COEP-capable static host | HF is built for large files; Cloudflare Pages caps files at 25 MB, so the 90 MB encoder cannot live there. |
| **Confidence highlighting is in the MVP** | It is half of the stated goal, and per-strip logprobs are nearly free. |

## The ladder

Ten rungs, each independently pausable with its own acceptance check. W2 already gets an image to
the editor; the slicer does not block a demo.

```
W0 ─┐                                    opencv.js risk — first, it can force a re-plan
    ├─→ W4 → W5 → W6 ─┐
W1 → W2 → W3 ─────────┴─→ W7 → W8 → W9 → W10
         (ceiling)
```

| Rung | Goal | State |
|---|---|---|
| **W0** | opencv.js primitives match OpenCV-Python | ✅ **DONE 2026-08-02** — see below |
| **W1** | Decode module extracted from `omrGate.ts`, logprobs added, gate still 27/28 | ✅ **DONE 2026-08-02** — see below |
| **W2** | Strips → editor end to end (no slicer); produces the W3 control arm | ✅ **DONE 2026-08-02** — see below |
| **W3** | Parity harness, the arm-B **ceiling**, and browser-vs-gold quality | ✅ **DONE 2026-08-03** — see below |
| **W4** | Slicer: staves + row normalization | ✅ **DONE 2026-08-04** — see below |
| **W5** | Slicer: barlines (the riskiest file) | **next** — [slicer-port.md](slicer-port.md) |
| **W6** | Slicer: windowing + driver; **paired** parity vs arm B | [slicer-port.md](slicer-port.md) |
| **W7** | Upload a page in the app | — |
| **W8** | Confidence: **decide first** (soft −0.5 cut / per-token / drop), then build | — |
| **W9** | Model delivery (HF + Cache API) and hosting | — |
| **W10** | Friends release | — |

## W0 — opencv.js primitive parity ✅ PASS (2026-08-02)

Before transliterating 1,000 lines, prove the primitives underneath behave identically. Run it with
`npm run probe:cv`; regenerate the reference with
`.venv-ml/bin/python scripts/cv_probe_ref.py <page.png>`.

**Both sides are OpenCV 5.0.0** (`cv2` 5.0.0, `@techstark/opencv-js` 5.0.0-release.1) — the
versions were checked, not assumed.

The probe runs **two arms**, and the split is the whole point:

- **Arm B — opencv.js fed Python's own grayscale bytes.** All five exact: Otsu threshold (154),
  ink pixel count (408,651), the full 2,339-row MORPH_OPEN projection, connectedComponents (1,522
  labels), and the INTER_AREA column sums. This is algorithm parity, and it is the gate.
- **Arm A — opencv.js fed the browser's own PNG decode.** Cannot be exact and never will be: see
  below. Reported as drift, not pass/fail.

**Grayscale cannot be exact, and that is fine.** `cv2.imread(IMREAD_GRAYSCALE)` converts inside the
PNG decoder; a browser only ever gets RGBA out of the decoder and converts afterwards. OpenCV's own
two paths already disagree — `imread`-gray vs `cvtColor` on `imread`-colour differ by ±1 on **7.4%**
of pixels of a colour page. 18% of corpus pages are truly colour (sampled 120), so this is not an
edge case.

**What settles it is a sensitivity measurement, not a tolerance argument.** Re-running the entire
slicer on the 6 most colour-shifted pages in the corpus under exactly that ±1 perturbation left all
**119 strips bit-identical** — same strip count, `row_x0`/`row_x1`, `scale`, `row_bars`, pads.
Sub-quantization grayscale noise does not reach the output. Numbers in
[../METRICS-SLICER.md](../METRICS-SLICER.md).

**Verdict: proceed with the port; the pre-blessed W0 fallback (hand-writing grayscale/Otsu) is not
needed.**

## W1 — decode module extracted, logprobs added ✅ DONE (2026-08-02)

`omrGate.ts` 309 → 164 lines. The reusable half now lives in `apps/web/src/omr/`
(`types.ts`, `decode.ts`, `preprocess.ts`); the gate keeps only its DOM, the reference-vs-canvas
comparison and the upload demo. **`omr-gate.html` is byte-identical** (`git diff --stat` empty) and
still reads **27/28 with the same failing strip and the same token stream**.

Two things worth knowing about the move:

- **`preprocessCanvas` widened** from `HTMLImageElement` to any `CanvasImageSource` via a
  `sourceSize()` helper, because the slicer (W6) emits canvases rather than `<img>` elements. A
  `canvasFromImageData()` helper came with it.
- **`willReadFrequently` was deliberately NOT added** to the preprocessing canvas context. It can
  move rasterization to software, which is exactly the sort of change that would perturb
  `drawImage` filtering and the gate's 14/14 canvas arm with it.

### The logprob check, and the criterion that was wrong

`argmaxLast` now also returns the chosen token's log-probability — `-log(Σ exp(row - row[tok]))`,
copied from `onnx_parity.py:83` and stable by construction because `tok` is the argmax. The logits
row was always in hand and was being discarded.

The **pre-registered acceptance was "≤1e-3 per token vs `onnx_parity.py`" and it FAILED at 8.6e-2.**
That number is kept here because the diagnosis matters more than the result: the ids agree on 13 of
14 strips, so the decode is fine — the gap is the **ORT-web vs ORT-Python int8 numerics difference
this project already documents** (the same effect that tips one strip's 69/31 near-tie). Feeding
both sides bit-identical `.pixels.bin` tensors buys identical *input*, not identical *logits*, so
≤1e-3 was never a property of our arithmetic; it was an untested assumption about two runtimes.

The check was re-aimed at what W8 actually depends on: **does the browser land on the same side of
the validated `min_logprob < -1.0` threshold as Python?** Measured over 576 token logprobs:
**0 tokens and 0 strips disagree**, and the raw runtime gap is reported rather than gated.

⚠ **Non-claim:** 0 of those 576 tokens came within 0.1 of −1.0 — the 14 gate strips are all
confident reads (every min above −0.15), so this fixture is too easy to test the boundary. The
threshold gets a real test at W3 on real-page strips, and that is owed.

Run it with `npm run check:logprobs` (reference: `.venv-ml/bin/python scripts/logprob_ref.py`).

## W2 — an image reaches the editor ✅ DONE (2026-08-02)

**The app now reads sheet music.** "Read strips" in the toolbar takes a page's `*_sNN_wNN.png`
crops, decodes them in the browser, stitches them and loads the score — playable, editable,
downloadable as note-model JSON. Verified in the real app, not just a harness
(`npm run smoke:app`): 16 crops → **344 notes / 28 measures**, sheet renders, playback starts,
⬇ Save JSON yields a valid `schemaVersion: 1` doc, no uncaught page errors.

New: `apps/web/src/omr/session.ts` (memoised model load — **sequential**, because three
`InferenceSession.create` calls in flight means three sets of weights live at once and memory, not
bandwidth, is the phone failure mode) and `apps/web/src/omr/pipeline.ts` (`decodeStripsToDoc`,
`positionFromName`). Strips are ordered by their filename's `_sNN_wNN` suffix, not by pick order —
a file input's order is the OS's, and the stitcher builds the music from `system`/`window`.

**Robustness** (`npm run check:edge`): a blank white strip, a solid black strip, an 8×8 image and a
wrong-orientation portrait all decode to 4 ids / 0 events without throwing, so the app's "the model
read nothing from these images" message fires instead of a crash. ⚠ Note for W8: those garbage
crops score **min_logprob ≈ −0.84**, i.e. *above* the −1.0 flag — the confidence threshold does not
catch an empty crop, the event count does.

**Latency: ~1.1 s/strip** uncontended (~1.5 s/strip while another job was running), so a 20-strip
page is 20–30 s. Python int8 is ~353 ms/strip. That is slow but tolerable behind a progress line,
and it means **W7 does not need a Web Worker** to be usable.

## The arm-B ceiling, and a hypothesis that died

`npm run parity:armb` decodes **Python's own crops** in the browser and diffs against Python's
decode caches. Whatever agreement that produces is the best any slicer could do, so it is the bar
W6 holds the ported slicer to — "within 1 pp of the ceiling", never "100%".

**Ceiling over 20 pages / 450 strips: 86.0% of strips decode identically; 8/20 pages produce a
byte-identical score.**

**First, a measurement bug worth remembering.** The first run said **10%**, while two of three
pages produced identical scores — an impossible pair. The cause: `decode_page.py` stores raw HF
`decode()` output, which glues added tokens (`\sig\komaFlatb \bakiyeFlate`), while the browser's
`detokenize` emits them spaced (`\sig \komaFlat b \bakiyeFlat e`). Both pass through the stitcher's
`normalizeTokens` before becoming music, so comparing before it measures *serialization*, not
reading. Normalizing first: **10% → 96.7%** on that sample.

**Then the hypothesis died.** The plan pre-registered "if arm B lands below ~90%, the resampler gap
dominates — spend a day matching PIL's BILINEAR before porting the slicer." Arm B came in at 86%, so
that rule fired. It should not have, because the causal model behind it is wrong:

| split | strips | agree |
|---|---|---|
| Python flagged it (`min_logprob < -1.0`) | 32 | **21.9%** |
| Python was confident (`≥ -1.0`) | 418 | **90.9%** |

Crop width — the thing that decides how hard a strip is downscaled, and therefore how much a
resampler difference could bite — shows **no trend at all**: 89.3% in the narrowest decile against
83.9% in the widest, with 75% and 92.9% deciles in between. Token count is equally flat.
Disagreement is **model uncertainty**, not resampling: near-ties that either ORT build can tip, the
same mechanism as the gate's 27/28 and its measured 69/31 coin-flip. **So the resampler work is not
done, and `preprocess.ts` stays as it is.** Measure before touching, as
[../METRICS-SLICER.md](../METRICS-SLICER.md) says at the top.

**A side benefit: this is the first real-data evidence that the `-1.0` threshold means something.**
W1 had to record a non-claim — the 14 gate strips were all too confident to test the boundary. Here
32 strips fall below it and they behave completely differently from the other 418 (21.9% vs 90.9%
agreement). The threshold separates exactly the strips where two runtimes disagree, which is a good
sign for W8's highlighting.

⚠ **The open question this does NOT answer, and it is the one that matters for a release:
is the browser *worse*, or just *different*?** Agreement with Python cannot tell them apart. On the
63 disagreeing strips the browser tends to read slightly *fewer* tokens (31 of 63 are −1 or −2 ids),
which is suggestive but not evidence. The decisive test is scoring browser decodes against
**hand-verified gold** — `_realval_v2`'s 267 strips — and comparing to Python's score on the same
strips. **Owed at W3**, and it is what says whether a friend gets the quality the project's metrics
claim.

## W3 — the browser is not worse than Python ✅ DONE (2026-08-03)

**The release-gating question is settled.** Arm-B agreement said the two decoders differ on ~14% of
strips; agreement cannot say *which one is right*, and if the browser read meaningfully worse then
friends would get worse results than every number in [../METRICS.md](../METRICS.md) claims.

Both sides were scored against the **same 261 hand-verified `_realval_v2` strips** with the **same
scorer** (`eval_omr.align`, the project's Levenshtein id-space alignment), on the identical strips:

| metric | Python | Browser | Δ |
|---|---|---|---|
| SER (lower better) | 0.0821 | **0.0818** | −0.0003 |
| exact-match | 60.2% | **60.2%** | 0.0 |
| AEU macro recall | 94.8% | **94.9%** | +0.1 pp |
| AEU micro recall | 92.5% | **92.5%** | 0.0 |

Per class the two are within a point everywhere, and the two largest moves cancel
(`\bakiyeSharp` −0.8 pp, `\komaFlat` +1.5 pp). **Verdict: the ~14% disagreement is two ORT builds
splitting near-ties, at no cost in quality.** Reproduce with `npm run decode:pool -- --pool
data/real/rung3/_realval_v2 --out b.json` then
`.venv-ml/bin/python scripts/score_browser_gold.py --browser b.json`.

⚠ **Scope of the claim:** this is real-val, which orders candidates and does not predict exam
performance (a 28 pp gap is on record). It is a *paired* comparison on identical strips, so the
**Δ** is what it establishes — not the absolute level.

### The 40-page ceiling sample was dropped, deliberately

The plan pre-registered widening the arm-B ceiling from 20 pages to 40. Two reasons not to:

1. **Its purpose changed.** The ceiling existed to answer "is a slicer difference real or is it the
   resampler". Now that gold shows agreement is not a quality proxy, the ceiling is only a
   reference level for W6, not a quality bar.
2. **The stated ±1 pp bar is not resolvable at any sample size we would run.** At 86% with n=450 the
   standard error is ~1.6 pp; 40 pages would only reach ~1.2 pp. **W6 should use a PAIRED test
   instead** — arm A and arm B decode the *same* strips, so compare per-strip agreement pairwise
   (a McNemar-style count of strips where exactly one arm matches Python). That is far more
   sensitive than differencing two independent proportions, and it needs no extra pages.

### Confidence: real signal, but it does NOT meet the pre-registered bar

Measured against gold, `min_logprob` genuinely separates good strips from bad — flagged strips
average **8.60 token edits against 2.69** for the rest. But as an *error locator* it is weak:

| flag if min < | % strips flagged | % of all edits caught | lift |
|---|---|---|---|
| −1.0 | 3.8% | 11.3% | 3.0× |
| −0.7 | 9.2% | 26.3% | 2.9× |
| **−0.5** | **22.6%** | **57.1%** | 2.5× |
| −0.3 | 33.0% | 64.2% | 1.9× |

**The pre-registered rule — flag 10%, catch ≥60% of errors ([../STATUS.md](../STATUS.md)) — is NOT
met.** The best achievable at a 10% budget is **26.3%**. There is a usable operating point at −0.5
("check about one strip in five, see over half the errors"), but that is a soft hint, not the
promise the rule describes.

**This lands before W8 is built rather than during it, which is the point of measuring first.** W8
now has a real decision to make: ship the −0.5 cut as a hint, invest in per-TOKEN localisation
(logprobs already exist; the cost is threading token identity through the stitcher), or drop the
feature. ⚠ Note also that the −1.0 line was validated as a **bad-crop proxy for the labelling
queue**, a different job from locating a user's errors — and W2 found it does not even fire on a
blank crop (those score ≈ −0.84).

## W4 — staves + row normalization ✅ DONE (2026-08-04)

**The port reproduces Python's stage 1 exactly, over the whole corpus** — 1,781 pages / 12,123
systems, not a sample. Staff count **1,704/1,704**, manifest-zero pages **77/77**, `scale`
**12,122/12,122**; normalized row width and the outer-lines+spacing triple both **12,123/12,123**.
Numbers: [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

**Everything that differs anywhere is the ±1 grayscale residue, and none of it reaches a crop.**
Seven systems differ by 1 px — six an *interior* staff line's cluster centre, one an `x0` — and
`normalize_row` reads only the outer lines and the median spacing, which are identical on all
12,123. This is the first time the residue W0 predicted has been observed reaching any output.

⚠ **Two scope notes on the corpus run.** It used `--inject-skew`, so its deskew-angle column is
trivially true; the estimator's real number is **132/132** from the un-injected 132-page run. And
the "zero-staff pages yield zero staves" bar was **restated against the control**: those pages are
identified by an empty manifest, local Python now finds a staff on 1 of the 77, and the port finds
the same one — the original wording failed a port that agreed with Python exactly.

### Two things the plan had wrong, both found by measuring

**1. `prepPage` could not be the planned no-op.** [slicer-port.md](slicer-port.md) recorded that the
whole camera path is inert on clean input. True of the perspective crop (**0%** of pages take one),
false of the deskew: **15.3% (272/1,781) take a real rotation**. Skipping it took one page from 10
staves to **0**, and 22 of the 23 pages failing the first parity run were exactly the 23 deskewed
ones. `estimate_skew`/`deskew` are now ported in full, guards and all, so an axis-aligned
screenshot still passes through untouched. ⚠ **It costs ~35 s of the ~36 s a page takes in the
browser** (41 rotations, each with a page-wide `MORPH_OPEN`) against ~1.9 s for Python's whole stage
1 — a **W7** problem, since a screenshot pays the full sweep to learn it has no skew.

**2. The manifests on disk cannot be the acceptance bar.** Scored against them the port read
**86.7%**, and one page it failed matched local Python line for line (7 staves against the
manifest's 5). The current `page_to_strips.py` reproduces only **1,680/1,704 (98.59%)** of those manifests —
below W4's own bar — because 1,578 of the 1,781 page dirs were sliced on Colab. `scripts/slicer_ref.py`
now builds a local-Python reference that is both the control and the sample definition; the port
reaches the manifest ceiling exactly, 1,680/1,704 on the same pages as Python. **Same lesson W3 already
recorded about arm-B agreement: agreement with an artifact is not correctness.**

## What W0 built that is not throwaway

`tools/browser/run-page.ts` — runs any harness page in headless Chromium and asserts on it.
`omrGate.ts` has exposed `window.__gateResult` since it was written and it had **never been used**;
the gate was checked by opening a browser and looking. It is now `npm run gate:browser`.

One wrinkle worth knowing: the gate reports a single boolean, and that boolean has been `FAIL` ever
since the known ORT-web int8 `\tup3` wobble on one strip's reference path. A boolean cannot tell
"the known wobble" from "someone broke decoding", so the runner tallies the page's own ✓/✗ marks
instead and the script pins **`--expect 27/28`**. Measured baseline before any W1 refactor:
**27/28, with the canvas (product) path clean at 14/14**, sessions ready in ~3.0 s,
~0.9 s encoder + ~0.2 s decode per strip.

The probe itself (`apps/web/cv-probe.html`, `apps/web/src/probe/cvProbe.ts`,
`scripts/cv_probe_ref.py`) **is** throwaway and is deleted at W6.

## Files this track adds

| Path | What |
|---|---|
| `tools/browser/run-page.ts` | headless runner for any harness page (permanent) |
| `apps/web/cv-probe.html`, `apps/web/src/probe/cvProbe.ts` | W0 probe (deleted at W6) |
| `scripts/cv_probe_ref.py` | W0 Python reference (deleted at W6) |
| `apps/web/src/omr/` | decode, preprocess, session, pipeline, weights (W1, W2, W9) |
| `apps/web/logprob-check.html`, `apps/web/src/checks/logprobCheck.ts`, `scripts/logprob_ref.py` | W1 confidence-signal check (permanent — W8 depends on it) |
| `apps/web/strips-harness.html`, `apps/web/src/checks/stripsHarness.ts` | headless entry to the shipped decode path, driven by Playwright |
| `tools/vision/parity/arm-b.ts` | the ceiling measurement; grows into the W6 arm-A comparison |
| `tools/vision/parity/decode-pool.ts` + `scripts/score_browser_gold.py` | browser vs Python **against gold** — the release-gating quality check |
| `tools/vision/parity/edge-cases.ts` | non-strip images must not throw |
| `tools/browser/app-smoke.ts` | the real app: strips in → playable score out |
| `apps/web/src/omr/slicer/` | the TS port of `page_to_strips.py` (W4–W6) |
| `apps/web/src/checks/slicerHarness.ts` + `apps/web/slicer-harness.html` | headless entry to the ported slicer |
| `scripts/slicer_ref.py` | the Python control arm for the port, and the sample definition |
| `tools/vision/parity/slicer-parity.ts` | slicer parity harness, `npm run parity:slicer` (W4–W6) |

## Verification gates

| Gate | Command |
|---|---|
| Types | `npm run typecheck` |
| Stitcher round-trip | `npm test` |
| Browser ONNX gate, pinned | `npm run gate:browser` |
| opencv.js parity | `npm run probe:cv` |
| Confidence signal transfers | `npm run check:logprobs` |
| App: strips in → playable score out | `npm run smoke:app` |
| Non-strip images don't throw | `npm run check:edge` |
| Arm-B ceiling / (W6) decode arm comparison | `npm run parity:armb -- --pages 20` |
| Slicer port vs local Python | `scripts/slicer_ref.py --pages 120 --out ref.json` then `npm run parity:slicer -- --ref ref.json` |
| Browser quality vs Python, against gold | `npm run decode:pool -- --pool data/real/rung3/_realval_v2 --out b.json` then `scripts/score_browser_gold.py --browser b.json` |
