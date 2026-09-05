# Doc index — which file answers which question

purpose: route a reader (human or agent) to the one file that owns an answer
audience: everyone; start here if `CLAUDE.md` did not already answer it
updated: 2026-09-03

**Rule of the house:** every fact has ONE home. If two files state the same number, one of them is
wrong — fix by deleting, not by syncing.

## Start here

| Question | File |
|---|---|
| What is this project, how do I run it, what may I not do? | [../CLAUDE.md](../CLAUDE.md) |
| What is the command for X, and how does it fail silently? | [COMMANDS.md](COMMANDS.md) |
| What ships today? What is the next action? | [STATUS.md](STATUS.md) |
| What is owed but is NOT next, and why is it deferred? | [BACKLOG.md](BACKLOG.md) |
| Work deferred PAST this round — density levers, exam v3's owed items, the sharp-glyph measurement | [BACKLOG-LATER.md](BACKLOG-LATER.md) |
| What is measured but fragile, and what do we NOT claim? | [RISKS.md](RISKS.md) |
| Explain it to me in plain English (no jargon) | [OVERVIEW.md](OVERVIEW.md) |
| The 28 July test day, in plain English (history) | [OVERVIEW-JULY.md](OVERVIEW-JULY.md) |
| The features that shipped in early August, in plain English (history) | [OVERVIEW-AUGUST.md](OVERVIEW-AUGUST.md) |
| Can I publish this? In plain English | [OVERVIEW-COPYRIGHT.md](OVERVIEW-COPYRIGHT.md) |
| Why is there a server, where does the app live, what does it cost? In plain English | [OVERVIEW-SERVER.md](OVERVIEW-SERVER.md) |
| The model story so far, in plain English (Rounds 1–2 + backlog) | [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md) |
| The Round 3 plan in plain English — the four trainings, when we train, what the exam decides | [OVERVIEW-ROUND3.md](OVERVIEW-ROUND3.md) |
| **Round 4 in plain English — what Round 3 taught, what changes and what does not, what you will be asked to do** | [OVERVIEW-ROUND4.md](OVERVIEW-ROUND4.md) |
| I finished some work — which doc do I update? | [MAINTAINING.md](MAINTAINING.md) |

## Facts and decisions

| Question | File |
|---|---|
| What is the accuracy / yield of X? | [METRICS.md](METRICS.md) |
| What did the one-shot real exam score, in any round? | [METRICS-EXAM.md](METRICS-EXAM.md) |
| What is the exam MADE of, and how was it rebuilt? | [METRICS-EXAMSET.md](METRICS-EXAMSET.md) |
| How big is a corpus, and how noisy are its labels? | [METRICS-CORPUS.md](METRICS-CORPUS.md) |
| Does the SHIPPED (int8/ONNX) model match the one that was measured? | [METRICS-ONNX.md](METRICS-ONNX.md) |
| The B8 re-emit: its yield, and the 1,479 human fixes it did not carry | [METRICS-B8.md](METRICS-B8.md) |
| Did Round 3's two follow-up runs (longer stage 2, retired-crop strips) buy anything? | [METRICS-ROUND3-RUNS.md](METRICS-ROUND3-RUNS.md) |
| Why does the model fail at X — and what was already tried? | [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) |
| A symbol the model reads as something else — staccato, the dotted usul barline | [METRICS-UNSEEN.md](METRICS-UNSEEN.md) |
| What the encoder is GIVEN — the 409×583 box, the padding probe, the geometry pilot | [METRICS-GEOMETRY.md](METRICS-GEOMETRY.md) |
| The koma/küçük sharp glyph — what real print does, what we drew, where sharps appear | [METRICS-SHARPS.md](METRICS-SHARPS.md) |
| Tuplets — the corpus scan, the printed mark, the mark's geometry | [METRICS-TUPLETS.md](METRICS-TUPLETS.md) |
| The second engraver (LilyPond) — feasibility, its own gate, the null domain-gap read | [METRICS-ENGRAVER.md](METRICS-ENGRAVER.md) |
| Is anyone actually using the live app? | [METRICS-USAGE.md](METRICS-USAGE.md) |
| How a real page is read into an ink mask — binarization, grayscale fidelity, opencv.js parity | [METRICS-SLICER.md](METRICS-SLICER.md) |
| The LABEL BUDGET — the rail the shipped app has none of, and the `?dense=` experiment | [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) |
| The windowing retune and the crop frame — settled: which constants were swept, and why none moved | [METRICS-SLICER-FRAME.md](METRICS-SLICER-FRAME.md) |
| Barlines — the gates, the hand-marked truth, and what crop quality even means | [METRICS-SLICER-BARLINES.md](METRICS-SLICER-BARLINES.md) |
| A STEM taken for a barline — the both-ends gate (2026-09-03), what it costs, and the variant that was dropped | [METRICS-SLICER-STEMS.md](METRICS-SLICER-STEMS.md) |
| How a STAFF is found in that mask — the faded-row fixes, the missing-row rescue, the grouping repair, and the three global knobs that were rejected | [METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md) |
| Which crop ROOT a pool came from, and what re-slicing costs in labels | [METRICS-SLICER-ROOTS.md](METRICS-SLICER-ROOTS.md) |
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
| The rules a real-page label obeys (what is a token, what is ink) | [rung3/labeling.md](rung3/labeling.md) |
| How real pages were collected and matched to SymbTr (§1a–§1c) | [rung3/labeling-collection.md](rung3/labeling-collection.md) |
| The two review queues that were run (realval-hard, reslice-all) | [rung3/labeling-queues.md](rung3/labeling-queues.md) |
| The real-page track's settled findings (moved out of STATUS) | [rung3/standing.md](rung3/standing.md) |
| Exam rules, what is frozen, how gold was audited | [rung3/exam.md](rung3/exam.md) |
| Round 1: criteria, A/B, exam result, disposition | [rung3/round1.md](rung3/round1.md) |
| Round 2: photo axis, the sharp fidelity fix, what is open | [rung3/round2.md](rung3/round2.md) |
| Round 3: note heights + note lengths, and the checks to run first | [rung3/round3.md](rung3/round3.md) |
| Round 3's floors, the launch gate, and the tuplet A/B protocol | [rung3/round3-criteria.md](rung3/round3-criteria.md) |
| **Round 4: the dense half, the signature answer key, the selector — evidence, the owner's decisions, the order** | [rung3/round4.md](rung3/round4.md) |
| What each Round-3 work item B0–B9 is, and what it still owes | [rung3/worklist.md](rung3/worklist.md) |
| The remaining model levers, ranked, and what to measure first | [rung3/levers.md](rung3/levers.md) |
| **How a label is spelled, and what re-spelling notes would buy** | [rung3/tokenization.md](rung3/tokenization.md) |
| Parked ideas, watch-items, data folder layout | [rung3/followups.md](rung3/followups.md) |
| **Post-beta features: instrument voices, usul percussion, the fingerboard tab** | [features/README.md](features/README.md) |
| Which audio file, from where, under what licence | [features/audio-sources.md](features/audio-sources.md) |
| Which audio LICENCES may be used, and the rules every file obeys | [features/audio-policy.md](features/audio-policy.md) |
| How the kanun was cut from one take, and the traps that come with that | [features/kanun.md](features/kanun.md) |
| The violin fingerboard view (F3): artwork, calibration, why a line is tape and not a fret | [features/fingerboard.md](features/fingerboard.md) |
| The kanun view (F3): the 26 courses, the mandal state machine, why it is drawn and not photographed | [features/kanun-view.md](features/kanun-view.md) |
| The sol klarnet view (F3): the CC0 layered schematic, the rejected photos, the lip bar | [features/clarinet-view.md](features/clarinet-view.md) |
| The bar beside the instrument (F3): one measure drawn on its own, play-this-bar, the hand-over to the editor | [features/measure-card.md](features/measure-card.md) |
| The pages this browser has already read (F5): what is stored, the 30-page cap, why it is a cache | [features/recent-pages.md](features/recent-pages.md) |
| The visit counter (F6): what is counted, the daily-expiring anonymous id, the private dashboard | [features/visit-stats.md](features/visit-stats.md) |
| Long-range plan, architecture, risks (evergreen) | [../ROADMAP.md](../ROADMAP.md) |

## How things work

| Question | File |
|---|---|
| Where does this code live, in what reading order? | [CODE_TOUR.md](CODE_TOUR.md) |
| How does a page become strips, decode, and stitch back? | [PIPELINE.md](PIPELINE.md) |
| How do I see a feature working with my own eyes? (the app) | [MANUAL_CHECKS.md](MANUAL_CHECKS.md) |
| …and the synthetic corpus / renderer side | [MANUAL_CHECKS-CORPUS.md](MANUAL_CHECKS-CORPUS.md) |
| …and the editor (select, palette, insert, tuplets) | [MANUAL_CHECKS-EDITOR.md](MANUAL_CHECKS-EDITOR.md) |
| …and the feature track — the checks that need EARS or EYES (usul strokes, voices, fingerboard) | [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) |
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
