# Doc index — which file answers which question

purpose: route a reader (human or agent) to the one file that owns an answer
audience: everyone; start here if `CLAUDE.md` did not already answer it
updated: 2026-08-11

**Rule of the house:** every fact has ONE home. If two files state the same number, one of them is
wrong — fix by deleting, not by syncing.

## Start here

| Question | File |
|---|---|
| What is this project, how do I run it, what may I not do? | [../CLAUDE.md](../CLAUDE.md) |
| What ships today? What is the next action? | [STATUS.md](STATUS.md) |
| Explain it to me in plain English (no jargon) | [OVERVIEW.md](OVERVIEW.md) |
| The 28 July test day, in plain English (history) | [OVERVIEW-JULY.md](OVERVIEW-JULY.md) |
| Can I publish this? In plain English | [OVERVIEW-COPYRIGHT.md](OVERVIEW-COPYRIGHT.md) |
| The model story so far, in plain English (Rounds 1–2 + backlog) | [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md) |
| I finished some work — which doc do I update? | [MAINTAINING.md](MAINTAINING.md) |

## Facts and decisions

| Question | File |
|---|---|
| What is the accuracy / yield of X? | [METRICS.md](METRICS.md) |
| What did the one-shot real exam score, in any round? | [METRICS-EXAM.md](METRICS-EXAM.md) |
| How big is a corpus, and how noisy are its labels? | [METRICS-CORPUS.md](METRICS-CORPUS.md) |
| Why does the model fail at X — and what was already tried? | [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) |
| Is anyone actually using the live app? | [METRICS-USAGE.md](METRICS-USAGE.md) |
| How the page-cutter behaves on real pages — retunes, cap bugs, crop geometry | [METRICS-SLICER.md](METRICS-SLICER.md) |
| Whether the TypeScript slicer port reproduces the Python, rung by rung | [METRICS-SLICER-PORT.md](METRICS-SLICER-PORT.md) |
| Why do we do X this way? What was overturned? | [DECISIONS.md](DECISIONS.md) |
| What may we publish? Licences, attribution, why no score ships | [THIRD-PARTY.md](THIRD-PARTY.md) |
| Raw log of a training run or export | [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md) |

## The work

| Question | File |
|---|---|
| The MVP track: in-browser pipeline → release to friends | [mvp/README.md](mvp/README.md) |
| The product track's settled findings (moved out of STATUS) | [mvp/standing.md](mvp/standing.md) |
| What each MVP rung established: the slicer rungs W4–W7 | [mvp/rungs.md](mvp/rungs.md) |
| The earlier rungs W0–W3 (opencv.js parity, decode module, browser-vs-Python) | [mvp/rungs-w0-w3.md](mvp/rungs-w0-w3.md) |
| How to port the slicer to TypeScript (W4–W6) | [mvp/slicer-port.md](mvp/slicer-port.md) |
| How the app gets hosted, what it costs, and the server question (W9–W10) | [mvp/deploy.md](mvp/deploy.md) |
| Running and redeploying the decode server — the actual commands | [mvp/deploy-ops.md](mvp/deploy-ops.md) |
| **Setting up Google Cloud from scratch, step by step** (owner walkthrough) | [mvp/gcloud-setup.md](mvp/gcloud-setup.md) |
| **Putting the app and the weights online, step by step** (owner walkthrough) | [mvp/hosting-setup.md](mvp/hosting-setup.md) |
| How to make a page faster, and what each option costs | [mvp/latency.md](mvp/latency.md) |
| **The makam intonation table, its sources, and how a page's makam is guessed** | [mvp/makam.md](mvp/makam.md) |
| **Reworking note editing into a direct, MuseScore/Mus2-style editor** | [mvp/editor.md](mvp/editor.md) |
| What each editor step BUILT, and the traps it found | [mvp/editor-built.md](mvp/editor-built.md) |
| The real-page track: collect → label → exam → rounds | [rung3/README.md](rung3/README.md) |
| How real pages get labelled without hand work | [rung3/labeling.md](rung3/labeling.md) |
| The two review queues that were run (realval-hard, reslice-all) | [rung3/labeling-queues.md](rung3/labeling-queues.md) |
| The real-page track's settled findings (moved out of STATUS) | [rung3/standing.md](rung3/standing.md) |
| Exam rules, what is frozen, how gold was audited | [rung3/exam.md](rung3/exam.md) |
| Round 1: criteria, A/B, exam result, disposition | [rung3/round1.md](rung3/round1.md) |
| Round 2: photo axis, the sharp fidelity fix, what is open | [rung3/round2.md](rung3/round2.md) |
| Round 3: note heights + note lengths, and the checks to run first | [rung3/round3.md](rung3/round3.md) |
| Parked ideas, watch-items, data folder layout | [rung3/followups.md](rung3/followups.md) |
| **Post-beta features: instrument voices, usul percussion, the fingerboard tab** | [features/README.md](features/README.md) |
| Which audio file, from where, under what licence | [features/audio-sources.md](features/audio-sources.md) |
| Long-range plan, architecture, risks (evergreen) | [../ROADMAP.md](../ROADMAP.md) |

## How things work

| Question | File |
|---|---|
| Where does this code live, in what reading order? | [CODE_TOUR.md](CODE_TOUR.md) |
| How does a page become strips, decode, and stitch back? | [PIPELINE.md](PIPELINE.md) |
| How do I see a feature working with my own eyes? (the app) | [MANUAL_CHECKS.md](MANUAL_CHECKS.md) |
| …and the synthetic corpus / renderer side | [MANUAL_CHECKS-CORPUS.md](MANUAL_CHECKS-CORPUS.md) |
| …and the editor (select, palette, insert, tuplets) | [MANUAL_CHECKS-EDITOR.md](MANUAL_CHECKS-EDITOR.md) |
| How do I train on Colab? | [COLAB.md](COLAB.md) |
| How does the synthetic renderer work? | [../tools/render/README.md](../tools/render/README.md) |
| The synthetic track (Rungs 0–2.2b) — CLOSED | [PHASE2.md](PHASE2.md) |

## History (append-only — do not act on it)

| Question | File |
|---|---|
| What was built in Phases 0–1, in detail | [log/HISTORY.md](log/HISTORY.md) |
| Dated log of every session's status entries | [log/status-log.md](log/status-log.md) |
| Plans that were abandoned or reversed | [log/superseded.md](log/superseded.md) |
| The docs exactly as they were before the 2026-07-26 refactor | [archive/pre-refactor/](archive/pre-refactor/) |
