# Rung 3 — teaching the model real pages

purpose: index and one-page plan for the real-page track; routes to the six detail files
audience: agents and the owner working on real data
updated: 2026-07-26

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
pieces were frozen as a never-trained-on **exam**. Only after Round 1 does hand work start:
correcting the model's output on the unmatched pieces — by then the model has seen real engraving,
so correcting is "glance and confirm", not "repair everything".

## Where each part is written up

| File | Covers | Old section names |
|---|---|---|
| [labeling.md](labeling.md) | Collection and free labels: neyzen match, the Round-0.5 labeler, the notaarsivleri run, targeted tuplet collection | §1a, §1a.5, §1b, §1c |
| [exam.md](exam.md) | Freezing the exam, the emitter's calibration, exam v1 → v2 → v2.1 | Steps 2+3, Step 2, Step 3 |
| [ship-criteria.md](ship-criteria.md) | The pre-registered Round-1 floors and decision rule | Step 4.0 |
| [rerender.md](rerender.md) | The carry-dominant `strips_v3` re-render + accidental-distribution findings | Step 4.1 |
| [round1.md](round1.md) | Round-1 plan, init A/B, the one-shot exam read, the ship decision, plan-review addenda | Step 4, 4.2, 4.3, 4.4, 4.4a |
| [round2.md](round2.md) | Entry plan, photo axis, the microtonal-sharp fix, what is still open | Step 4.4 (Round-2 part), Step 4.5 |
| [followups.md](followups.md) | Hand-correction loop, decode-repair heuristics, watch-items, data folder layout | Step 5, "Logged for later", folder layout, watch-items |

## State of the six steps

| Step | State |
|---|---|
| 1 — free labels from SymbTr matches | ✅ done, both sources (+ targeted tuplet collection) |
| 2 — freeze the exam | ✅ done; v2.1 frozen 2026-07-19; **v3 owed** (low-n floor, over-budget recoveries, disjointness re-validation) |
| 3 — strip-label emitter | ✅ built and calibrated |
| 4 — Round 1 | ✅ trained, examined, shipped as "an improvement, not a pass" (2026-07-23) |
| 4 — Round 2 | 🔄 in progress: photo axis done, sharp fidelity fixed at source, re-render owed |
| 5 — hand-correction loop on unmatched pieces | ⏸ not started (scheduled after the rounds) |

## Standing rules for this track

- The exam is read **once** per round, on the final model; iteration happens on real-val.
- **Real-val orders candidates; it does not predict the exam** (28pp gap measured).
- Accidental-class disagreements between label and decode **never auto-accept** — a human decides.
- Photos of exam pieces are **exam-only**, never training.
- Full list with dates: [../DECISIONS.md](../DECISIONS.md).
