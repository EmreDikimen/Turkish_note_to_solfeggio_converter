# MVP track — the in-browser pipeline, and a release to friends

purpose: the plan and running state of the W0–W10 ladder that turns the frozen model into a link someone can open
audience: agents and the owner working the product side (not the training side)
updated: 2026-08-08

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

So: **finish the pipeline and get it in front of people.** This track trains nothing.

### Re-scoped 2026-08-05 (owner) — read this before planning W9 or W10

The original framing was "freeze the model, release, then train Round 3 against real feedback."
**The freeze and the wait are gone**; the rest stands.

| | |
|---|---|
| **Who** | Exactly **two friends**, to start |
| **What they are asked** | *"What features should I add?"* — **the interface, not the model** |
| **Round 3** | **Runs in parallel**, unpaused. It is not aimed by this feedback, so it does not wait for it |
| **The model in the friends build** | **Swaps to a better one as soon as one lands** — a server redeploy, no client download. ⚠ Cost: decode-quality comments cannot be attributed to a version. They are anecdotes; the exam still judges models |
| **How feedback returns** | **By talking to them.** No in-app button, no telemetry — at n=2 a conversation returns better information and costs nothing |
| **Phones** | **Out of scope** until the web app is done |
| **Public launch** | A later rung, gated on **Round 3's exam result**. Good → open it up; not good → Round 4, and so on |

Full rows and reasoning: [../DECISIONS.md](../DECISIONS.md).

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
| Weights on **Hugging Face Hub**, app on a COOP/COEP-capable static host | **STANDS 2026-08-05, with a correction.** It was briefly written up as superseded — "decode moves to a server, so the weights never reach the browser". Wrong: the client keeps an in-browser decode **fallback**, which needs both the weights and wasm threads. What changed is *when* — weights are fetched **lazily, only if the fallback fires**. [deploy.md](deploy.md) |
| ~~**Confidence highlighting is in the MVP**~~ | ⛔ **DROPPED 2026-08-05** (owner). The logprobs were nearly free, as predicted — but the signal missed its pre-registered bar and the bar was not moved to fit it. [../DECISIONS.md](../DECISIONS.md) |

## The ladder

Each rung is independently pausable with its own acceptance check. W2 already gets an image to
the editor; the slicer does not block a demo.

```
W0 ─┐                                    opencv.js risk — first, it can force a re-plan
    ├─→ W4 → W5 → W6 ─┐
W1 → W2 → W3 ─────────┴─→ W7 ──────→ W9 → W10 ─────→ public
         (ceiling)          ⛔W8              (gated on Round 3)
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
| **W8** | Confidence highlighting | ⛔ **DROPPED 2026-08-05** — the pre-registered bar was NOT met (best at a 10% budget is 26.3% against ≥60%) and the owner dropped it rather than moving the bar. Half of the 2026-07-27 goal stays unbuilt, stated out loud. Nothing deleted; may return if a friend asks. [../DECISIONS.md](../DECISIONS.md) |
| **W9** | **Server-side decode** + hosting — Cloud Run, Node + `onnxruntime-node` reusing `decode.ts`, in-browser fallback | ✅ **DEPLOYED 2026-08-06** — live at `omr-decode…europe-west3.run.app`, reads what the browser reads (93.8% ids, gold a paired wash), cold start 10.6 s, ~40 vCPU-s/page. ⚠ Slower than the owner's own browser, as predicted. Gold quality is a paired wash (McNemar p = 0.727). Safety checklist complete ($5 budget alert set, `--max-instances 3`). ✅ **Hosting DONE the same day** — app on Netlify at **<https://komavision.netlify.app>**, weights on the Hub (`Beyaban/omr-weights`), origin lock + 413 fix + `--cpu-boost` deployed. Cloudflare Pages was ruled out on its 25 MiB per-asset cap against our 25.58 MiB wasm. [hosting-setup.md](hosting-setup.md) · [deploy.md](deploy.md) |
| **W9.5** | **Makam selection + performed intonation** (pipeline stage 9's makam half) — guess the makam from the decoded signature + karar, confirm it in a prompt, bend the SOUNDING komas to that makam's real intonation | ✅ **DONE 2026-08-07** — audibly correct on **204/213** bundled scores; sound only, the staff never moves. Not a planned rung: added before W10 alongside the style pass, because playing uşşak as AEU spells it is wrong in a way a friend WILL hear. [makam.md](makam.md) |
| **W9.6** | **The style pass** — the harness becomes a product a friend can be shown | ✅ **DONE 2026-08-07** — KomaVision, Turkish, warm editorial; upload is the hero, developer controls fold into Gelişmiş. Presentation only. Also moved the deploy checks off the copy and onto `data-*` (`apps/web/src/ui/status.ts`), which is what made a Turkish UI possible at all. Built and green on both paths; **not yet deployed** |
| **W10** | Friends release — **two friends, interface feedback** | **UNBLOCKED 2026-08-06** — one redeploy away (it carries W9.5 + W9.6 together) |
| **W9.7** | **The editor rework** — drop the per-measure modal for direct editing on the staff | **STEPS 1–4 DONE** (2026-08-07 select/drag/delete/undo, 2026-08-08 the armed palette); step 5 next. Owner 2026-08-07. Not cosmetic: the editor is the Rung-3 labeling loop's tool, so correction speed is labelling throughput. Does **not** gate W10 — it can land either side of the link. Brief: [editor.md](editor.md) |
| **public** | Open it to everyone | — gated on Round 3's exam result, not on W10 |

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
| `tools/browser/build-smoke.ts`, `live-smoke.ts` | the BUILT app (`dist/`, real headers, cross-origin weights) and the DEPLOYED site (W9) |
| `apps/web/slices.html`, `apps/web/src/slices/slicesView.ts` | slice inspector — see the crops a page is cut into, no model loaded (owner request, W7) |
| `tools/vision/parity/arm-a.ts` | the port's crops decoded and compared to arm B, **paired** (W6) |
| `apps/web/src/checks/slicerHarness.ts` + `apps/web/slicer-harness.html` | headless entry to the ported slicer |
| `scripts/slicer_ref.py` | the Python control arm for the port, and the sample definition |
| `tools/vision/parity/slicer-parity.ts` | slicer parity harness, `npm run parity:slicer` (W4–W6) |
| `tools/vision/parity/deskew-check.ts` | the exactness gate behind the 126× skew-sweep speedup (W7) |
| `apps/server/` | the decode server: `index.ts` (HTTP), `decodeBatch.ts` (imports the browser's `decode.ts`), `model.ts` (the only ORT-runtime-specific file), `limits.ts`, `png.ts`, `Dockerfile`, `cloudbuild.yaml` (W9) |
| `apps/web/src/omr/pixels.ts` | the client/server seam — the rescale, DOM-free, so the server needs no resampler (W9) |
| `apps/web/src/omr/remote.ts` | `decodeStripsRouted` — server first behind `VITE_DECODE_URL`, in-browser fallback on any failure (W9) |
| `apps/web/src/checks/serverParityHarness.ts` + `apps/web/server-parity.html` | the client half of the contract: the PNG it would upload AND what the browser read from it (W9) |
| `tools/vision/parity/server-parity.ts`, `server-bench.ts`, `server-limits.ts` | server vs browser, vCPU-seconds/payload, and the safety checklist as a command (W9) |
| `packages/core/src/makam.ts`, `makamSignatures.ts` (generated) | makam detection + the performed-intonation table (W9.5) — [makam.md](makam.md) |
| `apps/web/src/MakamModal.tsx`, `tools/browser/makamPrompt.ts` | the post-decode makam prompt, and the smoke checks' dismissal of it (W9.5) |
| `apps/web/src/ui/` | the interface, split out of App.tsx (W9.6). **`status.ts` is the DOM contract the deploy checks assert on**; `strings.ts` is every user-visible word, in one file |
| `apps/web/src/styles/` | `tokens.css` (the design vocabulary), `base.css`, `app.css` (the `.kv-*` components) |

## Verification gates

| Gate | Command |
|---|---|
| Types | `npm run typecheck` |
| Stitcher round-trip | `npm test` |
| Browser ONNX gate, pinned | `npm run gate:browser` |
| opencv.js parity | `npm run probe:cv` |
| Confidence signal transfers | `npm run check:logprobs` |
| App: strips in → playable score out | `npm run smoke:app` |
| Makam signature vocabulary (core vs the label serializer) | `npm test` — 90/90 variants round-trip |
| The makam actually changes the SOUND (ears) | [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md) check 14 |
| App: a PAGE in → playable score out | `npm run smoke:page -- --ref ref.json` |
| Non-strip images don't throw | `npm run check:edge` |
| Arm-B ceiling | `npm run parity:armb -- --pages 20` |
| Arm A vs arm B, paired on the same strips | `npm run parity:arma -- --pages 20` |
| Slicer port vs local Python | `scripts/slicer_ref.py --pages 120 --out ref.json` then `npm run parity:slicer -- --ref ref.json` |
| Skew sweep's fast path is EXACT | `npm run check:deskew -- --pages 8` |
| Browser quality vs Python, against gold | `npm run decode:pool -- --pool data/real/rung3/_realval_v2 --out b.json` then `scripts/score_browser_gold.py --browser b.json` |
| Server matches the browser | `npm run dev:server` then `npm run parity:server -- --pages 6 --fixture f.json` (`--replay f.json` re-runs the server half with no browser) |
| Server quality vs gold | `npm run decode:pool -- --pool data/real/rung3/_realval_v2 --server http://localhost:8080 --out s.json` then `scripts/score_browser_gold.py --browser s.json --score-out data/checkpoints/server_gold_score.json` |
| Server cost per page, payload bytes | `npm run bench:server -- --fixture f.json` |
| The safety checklist | `npm run check:limits` |
| The app, through the server (and through the fallback) | `VITE_DECODE_URL=http://localhost:8080 npm run smoke:page` · point it at a dead port for the fallback |
| The BUILT app, against the real remotes | `npm run smoke:build -- --decode-url <service> --weights-url <hub>` — `--weights-url` swaps the local weights stand-in for the actual Hub, which sends a *reflected* CORS origin behind a 307, not the `*` the stand-in sends. ⚠ Costs a 211 MB download |
| **The DEPLOYED site** | `npm run smoke:live` (`-- --site https://…` for another deployment). **The only check that still exercises the shipped configuration**: a localhost preview is now refused by `ALLOWED_ORIGINS`, so `smoke:build` against the live server fails CORS by design |
