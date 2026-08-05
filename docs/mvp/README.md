# MVP track — the in-browser pipeline, and a release to friends

purpose: the plan and running state of the W0–W10 ladder that turns the frozen model into a link someone can open
audience: agents and the owner working the product side (not the training side)
updated: 2026-08-05

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
stitching, the editor and playback all already existed in browser-safe form; the decode helpers in
`apps/web/src/omrGate.ts` were simply never exported, and `tools/render/stitch.ts` is confirmed
free of node imports. The only genuinely missing piece was the page→strips slicer
(`src/vision/page_to_strips.py`, 1,077 lines of numpy/OpenCV) — **ported and verified over the whole
corpus at W6 (2026-08-04)**, so the browser now runs page → staves → rows → barlines → windows →
crops — and **wired into the app at W7 (2026-08-05)**, so an uploaded page becomes a playable score.

## Scope decisions (owner, 2026-08-02)

| Decision | Why |
|---|---|
| Slicer ported with **opencv.js**, not hand-rolled | Parity over bundle size; 13 MB is noise beside 211 MB of weights. Validated at W0. |
| **Screenshots and clean scans only** | Real uploads are mostly web screenshots. Cuts the hardest third of the port. ⚠ The stated reason — "the photo front-end is a no-op on clean input" — held for the perspective crop and **failed for the deskew** (W4): 15.3% of corpus pages take a real rotation, so it is ported. |
| ~~Weights on **Hugging Face Hub**, app on a COOP/COEP-capable static host~~ | **SUPERSEDED 2026-08-05**: decode moves to a server, so the weights never reach the browser and the COOP/COEP requirement (which existed for `onnxruntime-web`'s threads) mostly goes away. Keep it only if the browser path is retained as a fallback — and it is, as the reference the server is checked against. [deploy.md](deploy.md) |
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
| **W0** | opencv.js primitives match OpenCV-Python | ✅ **DONE 2026-08-02** — [rungs.md](rungs.md) |
| **W1** | Decode module extracted from `omrGate.ts`, logprobs added, gate still 27/28 | ✅ **DONE 2026-08-02** — [rungs.md](rungs.md) |
| **W2** | Strips → editor end to end (no slicer); produces the W3 control arm | ✅ **DONE 2026-08-02** — [rungs.md](rungs.md) |
| **W3** | Parity harness, the arm-B **ceiling**, and browser-vs-gold quality | ✅ **DONE 2026-08-03** — [rungs.md](rungs.md) |
| **W4** | Slicer: staves + row normalization | ✅ **DONE 2026-08-04** — [rungs.md](rungs.md) |
| **W5** | Slicer: barlines (the riskiest file) | ✅ **DONE 2026-08-04** — [rungs.md](rungs.md) |
| **W6** | Slicer: windowing + driver; **paired** parity vs arm B | ✅ **DONE 2026-08-04** — [rungs.md](rungs.md) |
| **W7** | Upload a page in the app | ✅ **DONE 2026-08-05** — [rungs.md](rungs.md) |
| **W8** | Confidence: **decide first** (soft −0.5 cut / per-token / drop), then build | **next** |
| **W9** | **Server-side decode** + hosting — the backend question is SETTLED, plan in [deploy.md](deploy.md) | — |
| **W10** | Friends release | — |

## What each rung established

The finished write-ups live in **[rungs.md](rungs.md)** — moved there on 2026-08-04 (this file crossed the
400-line cap). They carry what each rung measured, what passed, and — more useful — the
hypotheses that died: the resampler theory the arm-B ceiling killed, the confidence bar that was
NOT met, the `prepPage` no-op that was not a no-op, and the two acceptance criteria that had to
be restated because they were written before the ±1 grayscale residue was understood.

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

The W0 probe (`apps/web/cv-probe.html`, `apps/web/src/probe/cvProbe.ts`,
`scripts/cv_probe_ref.py`) was written as throwaway, to be deleted at W6. **It was kept**: it is the
only check that would catch an opencv.js version bump changing a primitive under the port, and it
costs one command ([../DECISIONS.md](../DECISIONS.md)).

## Files this track adds

| Path | What |
|---|---|
| `tools/browser/run-page.ts` | headless runner for any harness page (permanent) |
| `apps/web/cv-probe.html`, `apps/web/src/probe/cvProbe.ts` | W0 probe (kept, not deleted — see above) |
| `scripts/cv_probe_ref.py` | W0 Python reference (kept) |
| `apps/web/src/omr/` | decode, preprocess, session, pipeline, weights (W1, W2, W9) |
| `apps/web/logprob-check.html`, `apps/web/src/checks/logprobCheck.ts`, `scripts/logprob_ref.py` | W1 confidence-signal check (permanent — W8 depends on it) |
| `apps/web/strips-harness.html`, `apps/web/src/checks/stripsHarness.ts` | headless entry to the shipped decode path, driven by Playwright |
| `tools/vision/parity/arm-b.ts` | the ceiling measurement (W3) |
| `tools/vision/parity/decode-pool.ts` + `scripts/score_browser_gold.py` | browser vs Python **against gold** — the release-gating quality check |
| `tools/vision/parity/edge-cases.ts` | non-strip images must not throw |
| `tools/browser/app-smoke.ts` | the real app: strips in → playable score out |
| `apps/web/src/omr/slicer/` | the TS port of `page_to_strips.py` (W4–W6) |
| `apps/web/src/omr/page.ts` | page image → crops, the seam between the slicer and the decode path (W7) |
| `tools/browser/page-smoke.ts` | the real app: a page image in → playable score out, plus a responsiveness bar (W7) |
| `apps/web/slices.html`, `apps/web/src/slices/slicesView.ts` | slice inspector — see the crops a page is cut into, no model loaded (owner request, W7) |
| `tools/vision/parity/arm-a.ts` | the port's crops decoded and compared to arm B, **paired** (W6) |
| `apps/web/src/checks/slicerHarness.ts` + `apps/web/slicer-harness.html` | headless entry to the ported slicer |
| `scripts/slicer_ref.py` | the Python control arm for the port, and the sample definition |
| `tools/vision/parity/slicer-parity.ts` | slicer parity harness, `npm run parity:slicer` (W4–W6) |
| `tools/vision/parity/deskew-check.ts` | the exactness gate behind the 126× skew-sweep speedup (W7) |

## Verification gates

| Gate | Command |
|---|---|
| Types | `npm run typecheck` |
| Stitcher round-trip | `npm test` |
| Browser ONNX gate, pinned | `npm run gate:browser` |
| opencv.js parity | `npm run probe:cv` |
| Confidence signal transfers | `npm run check:logprobs` |
| App: strips in → playable score out | `npm run smoke:app` |
| App: a PAGE in → playable score out | `npm run smoke:page -- --ref ref.json` |
| Non-strip images don't throw | `npm run check:edge` |
| Arm-B ceiling | `npm run parity:armb -- --pages 20` |
| Arm A vs arm B, paired on the same strips | `npm run parity:arma -- --pages 20` |
| Slicer port vs local Python | `scripts/slicer_ref.py --pages 120 --out ref.json` then `npm run parity:slicer -- --ref ref.json` |
| Skew sweep's fast path is EXACT | `npm run check:deskew -- --pages 8` |
| Browser quality vs Python, against gold | `npm run decode:pool -- --pool data/real/rung3/_realval_v2 --out b.json` then `scripts/score_browser_gold.py --browser b.json` |
