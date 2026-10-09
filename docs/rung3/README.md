# Rung 3 — teaching the model real pages

purpose: index and one-page plan for the real-page (model) track; routes to the live detail files and to the archived rounds
audience: agents and the owner working on real data
updated: 2026-10-08

> This track's **current state and next action are NOT here** — they live in
> [../STATUS.md](../STATUS.md). This file describes the plan and where each part is written up.

## The plan in one paragraph

Pieces that also exist in SymbTr need no hand labeling — **SymbTr already is the correct answer**.
The neyzen corpus gave 85 such matches; notaarsivleri.com (TRT-repertoire sheets with real catalog
metadata) gave far more, in a second engraving style — so both sources' matches were collected and
**one big Round-1 fine-tune ran on both styles at once** (owner decision 2026-07-11: don't split
what can be one training run). A throwaway **Round-0.5 labeler** was inserted before the nota emit
(the 348-row review queue and its 22.6% audit fix rate showed how much labor a synthetic-only
emitter model costs); Round 1 itself stayed one run from base weights. Before training, matched
pieces were frozen as a never-trained-on **exam**. Only after the rounds does hand work start on
the unmatched pieces — by then the model has seen real engraving, so correcting is "glance and
confirm", not "repair everything".

## The live files

| File | Covers |
|---|---|
| [round4.md](round4.md) | **Round 4, the open round**: the root causes with their homes, the owner's decisions, the order of work and where each step ended |
| [tokenization.md](tokenization.md) | How a label is spelled, what scheme H changed, and why the vocabulary A/B was a null |
| [third-source.md](third-source.md) | Round 4's step 4 — the third-engraver probe: the three sites, what was collected, and the provenance traps |
| [labeling.md](labeling.md) | The label **conventions** — what is a token and what is label-free ink (the retired `\tie`, the arc) |
| [labeling-collection.md](labeling-collection.md) | Collection and free labels: neyzen match, the Round-0.5 labeler, the notaarsivleri run, targeted tuplet collection |
| [labeling-queues.md](labeling-queues.md) | The review queues feeding the training pools and the exam (reslice-all, the batches, b8, examv3, h1) |
| [labeling-queues-realval.md](labeling-queues-realval.md) | The review queues feeding REAL-VAL (realval-hard, and the 2026-09-09 repair) |
| [exam.md](exam.md) | Freezing the exam, the emitter's calibration, exam v1 → v2 → v2.1 → v3 |
| [standing.md](standing.md) | Settled findings of this track — background, not next actions |

## The closed rounds — archived, do not act on them

| Round | Files |
|---|---|
| Round 1 (2026-07-23) | [round1.md](../archive/rounds/round1.md) · [ship-criteria.md](../archive/rounds/ship-criteria.md) · [rerender.md](../archive/rounds/rerender.md) |
| Round 2 (2026-07-27) | [round2.md](../archive/rounds/round2.md) |
| Round 3 (closed 2026-09-03, archived 2026-10-08) | [round3.md](../archive/rounds/round3.md) · [round3-criteria.md](../archive/rounds/round3-criteria.md) (the **signed** ≥75% bar that still governs publishing a model) · [worklist.md](../archive/rounds/worklist.md) · [levers.md](../archive/rounds/levers.md) (the unpulled levers — still the menu for the next round) · [scan-profile.md](../archive/rounds/scan-profile.md) · [staccato-arm.md](../archive/rounds/staccato-arm.md) · [tuplets.md](../archive/rounds/tuplets.md) |
| Parked ideas, watch-items, the old folder layout | [followups.md](../archive/rounds/followups.md) |

**Raw records, verbatim** — every Colab training console (Round 3's arms, final model, runs A and B;
Round 4's control and H arms) and the owner's two labelling notebooks (unusable crops, model failures
seen while labelling) — are in [../log/raw/](../log/raw/round4_control_logs.md). ⚠ Read a console
beside [../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md); ⛔ an H arm's `EDITS` are in
H ids and compare with nothing in the old vocabulary.

## State of the steps

| Step | State |
|---|---|
| 1 — free labels from SymbTr matches | ✅ done, both sources (+ targeted tuplet collection) |
| 2 — freeze the exam | ✅ v2.1 frozen 2026-07-19; **v3 promoted 2026-08-31** — 67 pages in the set, 64 that produce strips (3 drop every candidate on the budget), **63 pages / 660 strips graded** at the read — read once for Round 3 ([exam.md](exam.md), [../METRICS-EXAMSET.md](../METRICS-EXAMSET.md)). ⏭ Round 4 keeps `examv3` as the comparable column; dense and third-source columns stay SEPARATE |
| 3 — strip-label emitter | ✅ built and calibrated; rule D for the key signature since 2026-09-06; the 80-id budget under scheme H since 2026-09-07 |
| 4 — Round 1 | ✅ shipped as "an improvement, not a pass" (2026-07-23) |
| 4 — Round 2 | ✅ shipped as "an improvement, not a pass" (2026-07-27) |
| 4 — Round 3 | ✅ **CLOSED 2026-09-03** — exam **51%** against the signed 75% floor, a miss; ~15 of its +17 points were the retired `\tie`; runs A and B nulls ([../METRICS-EXAMSET.md](../METRICS-EXAMSET.md), [../METRICS-ROUND3-RUNS.md](../METRICS-ROUND3-RUNS.md)) |
| 4 — Round 4 | 🔄 **open since 2026-09-03** — both arms trained 2026-09-16/17; scheme H is a NULL; the control `r4-ctl-stage2-last` leads on dense strips and has been the **live model since 2026-09-28**. The exam is **not read** for Round 4 ([round4.md](round4.md), [../METRICS-ROUND4-AB.md](../METRICS-ROUND4-AB.md)) |
| 5 — hand-correction loop on unmatched pieces | ⏸ not started (scheduled after the rounds) |

## Standing rules for this track

- The exam is read **once** per round, on the final model; iteration happens on real-val.
- **Real-val orders candidates; it does not predict the exam** (28pp gap measured).
- Accidental-class disagreements between label and decode **never auto-accept** — a human decides.
- Photos of exam pieces are **exam-only**, never training.
- Full list with dates: [../DECISIONS.md](../DECISIONS.md).
