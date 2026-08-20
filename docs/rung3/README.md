# Rung 3 — teaching the model real pages

purpose: index and one-page plan for the real-page track; routes to the six detail files
audience: agents and the owner working on real data
updated: 2026-08-17

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
| [ship-criteria.md](ship-criteria.md) | The pre-registered Round-1 floors and decision rule (Round 2 was judged against these too) | Step 4.0 |
| [round3-criteria.md](round3-criteria.md) | Round 3's floors + the public-launch gate (**signed 2026-08-15**), and the tuplet A/B protocol with its result | new 2026-08-13 |
| [rerender.md](rerender.md) | The carry-dominant `strips_v3` re-render + accidental-distribution findings | Step 4.1 |
| [round1.md](round1.md) | Round-1 plan, init A/B, the one-shot exam read, the ship decision, plan-review addenda | Step 4, 4.2, 4.3, 4.4, 4.4a |
| [round2.md](round2.md) | Entry plan, photo axis, the microtonal-sharp fix, what is still open | Step 4.4 (Round-2 part), Step 4.5 |
| [round3.md](round3.md) | Round 3: why it targets note heights and note lengths, and the four checks to run before rendering | new 2026-07-27 |
| [../../names_of_bad_cropped_images.md](../../names_of_bad_cropped_images.md) | Unusable crops noticed by eye during the batch3 labelling pass (the UI's `bad` verdict stays authoritative) | new 2026-08-19 |
| [../../some_problems_seen_while_labeling.md](../../some_problems_seen_while_labeling.md) | MODEL failures noticed by eye during the same pass — the pattern behind the corrections, which the CSV cannot show. Its first entry (the dotted barline read as `\repstart`) was measured and is now [BACKLOG.md](../BACKLOG.md) item 5 | new 2026-08-20 |
| [../../round_3_scan_logs.md](../../round_3_scan_logs.md) | Arm 1's raw Colab training log, both stages, kept verbatim | new 2026-08-19 |
| [scan-profile.md](scan-profile.md) | **Round 3's arm 1** — the scan augmentation profile: the ops, the signed pre-registration, how to run it and how to read it | new 2026-08-19 |
| [levers.md](levers.md) | The levers Round 3 has NOT pulled, ranked — crop geometry, decoding, real data, renderer diversity, the recipe — and the cheap measurement that decides each | new 2026-08-15 |
| [tuplets.md](tuplets.md) | Why `\tup3` recall misses its floor: the precision/recall trade, the arc we draw wrong, and the plan | new 2026-08-11 |
| [followups.md](followups.md) | Hand-correction loop, decode-repair heuristics, watch-items, data folder layout | Step 5, "Logged for later", folder layout, watch-items |

## State of the six steps

| Step | State |
|---|---|
| 1 — free labels from SymbTr matches | ✅ done, both sources (+ targeted tuplet collection) |
| 2 — freeze the exam | ✅ done; v2.1 frozen 2026-07-19; **v3 owed** (low-n floor, over-budget recoveries, disjointness re-validation) |
| 3 — strip-label emitter | ✅ built and calibrated |
| 4 — Round 1 | ✅ trained, examined, shipped as "an improvement, not a pass" (2026-07-23) |
| 4 — Round 2 | ✅ trained, examined, shipped as "an improvement, not a pass" (2026-07-27) |
| 4 — Round 3 | 🔄 in progress: floors **written and signed before training** ([round3-criteria.md](round3-criteria.md)), the tuplet-mark A/B run and **null** ([tuplets.md](tuplets.md)); the content work in `select_pieces.py` remains, sequenced behind the render-side levers — crop geometry ran and was **stopped**, and **Lever 4 (renderer diversity) is in front** as of 2026-08-17 ([levers.md](levers.md)) |
| 5 — hand-correction loop on unmatched pieces | ⏸ not started (scheduled after the rounds) |

## Standing rules for this track

- The exam is read **once** per round, on the final model; iteration happens on real-val.
- **Real-val orders candidates; it does not predict the exam** (28pp gap measured).
- Accidental-class disagreements between label and decode **never auto-accept** — a human decides.
- Photos of exam pieces are **exam-only**, never training.
- Full list with dates: [../DECISIONS.md](../DECISIONS.md).
