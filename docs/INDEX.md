# Doc index — which file answers which question

purpose: route a reader (human or agent) to the one file that owns an answer
audience: everyone; start here if `CLAUDE.md` did not already answer it
updated: 2026-07-26

**Rule of the house:** every fact has ONE home. If two files state the same number, one of them is
wrong — fix by deleting, not by syncing.

## Start here

| Question | File |
|---|---|
| What is this project, how do I run it, what may I not do? | [../CLAUDE.md](../CLAUDE.md) |
| What ships today? What is the next action? | [STATUS.md](STATUS.md) |
| Explain it to me in plain English (no jargon) | [OVERVIEW.md](OVERVIEW.md) |

## Facts and decisions

| Question | File |
|---|---|
| What is the accuracy / corpus size / yield of X? | [METRICS.md](METRICS.md) |
| Why do we do X this way? What was overturned? | [DECISIONS.md](DECISIONS.md) |
| Raw log of a training run or export | [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md) |

## The work

| Question | File |
|---|---|
| The real-page track: collect → label → exam → rounds | [rung3/README.md](rung3/README.md) |
| How real pages get labelled without hand work | [rung3/labeling.md](rung3/labeling.md) |
| Exam rules, what is frozen, how gold was audited | [rung3/exam.md](rung3/exam.md) |
| Round 1: criteria, A/B, exam result, disposition | [rung3/round1.md](rung3/round1.md) |
| Round 2: photo axis, the sharp fidelity fix, what is open | [rung3/round2.md](rung3/round2.md) |
| Parked ideas, watch-items, data folder layout | [rung3/followups.md](rung3/followups.md) |
| Long-range plan, architecture, risks (evergreen) | [../ROADMAP.md](../ROADMAP.md) |

## How things work

| Question | File |
|---|---|
| Where does this code live, in what reading order? | [CODE_TOUR.md](CODE_TOUR.md) |
| How does a page become strips, decode, and stitch back? | [PIPELINE.md](PIPELINE.md) |
| How do I see a feature working with my own eyes? | [MANUAL_CHECKS.md](MANUAL_CHECKS.md) |
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
