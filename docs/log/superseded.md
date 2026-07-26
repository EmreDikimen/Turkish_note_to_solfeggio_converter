# Superseded — plans that were abandoned, reversed, or already executed

purpose: keep the reasoning behind dead plans so nobody re-proposes them, without leaving them where they read as instructions
audience: agents about to propose a direction change
updated: 2026-07-26

> ⛔ **DO NOT ACT ON ANYTHING IN THIS FILE.** Every item here was cancelled, overturned, or has
> already been carried out. It is kept because the *reasoning* is what stops the same idea coming
> back. Current plan → [../STATUS.md](../STATUS.md).

## Ordering: "the re-slice starts first" (locked 2026-07-20 → reversed 2026-07-21)

The Round-1 prerequisite order was originally: arc-metric code → **additive-only re-slice first**
(because it ends in a human adjudication queue, the critical-path resource) → synthetic re-render in
parallel → init A/B → exam.

**Reversed the next day.** Re-slice adjudication cost is driven by decoder quality (SymbTr is the
label; the queue is decode-vs-SymbTr disagreements), and the labeler was **neyzen-only (362 strips)**
while the re-slice target is **nota-dominant** — re-slicing then would have manufactured false
disputes. Round 1 ran first so its model could become a nota-aware labeler; the re-slice moved to
Round 2. Round 1 did not need the recoveries: its levers were the re-render plus the ~2,351 promoted
real strips, and it was an A/B *experiment*, not the maximal final model.

Still-valid constraints carried out of that plan (they apply whenever the re-slice does happen):
- **Additive-only**: new windows only where old ones dropped (~5,900 `split_wide`/`over_budget` plus
  the nota over-budget rejects). Promoted strips are never re-emitted — verdicts don't carry to
  shifted windows.
- **The exam is never touched**; its 27 over-budget recoveries are deferred to exam v3, because
  growing a frozen exam breaks the pre-registration.
- **Training window mix stays mixed** (k≈3 promoted + k=2/k=1 recoveries + synthetic 2–4): the exam
  and the deployed slicer produce k≈3, so k≈3 must stay in-distribution.
- **Tuplet caveat (measured 2026-07-17):** a 2-measure re-slice does NOT recover triplets — 80% of
  tup3 2-measure windows still blow the 59-id budget, and 39% of tup3 *single* measures do. Tuplet
  content needs `OMR_MEASURES_PER_STRIP=1`, and the dense tail needs the sub-measure fragment design.
- Eyeball ~20 `w00` crops before any bulk re-emit; run the labeler decode on Colab GPU.

## The `--every-share` sweep (pre-registered 2026-07-21, amended then CANCELLED 2026-07-22)

**What it was:** `strips_v3` measured `every` mode at 26.7% of strips but 81% of all inline
accidentals (4.4× the real effective rate), a plausible driver of the komaSharp/komaFlat
hallucination. The plan was a train-time `WeightedRandomSampler` share `s` swept over
{26.7%, 15%, 5%} — three arms because the inline-rate and class-mix hypotheses make **opposite**
predictions at 5%, and the winning mechanism would shape the Round-2 re-render. Budget was
sequential (4 runs, not a 6-run cross): init A/B at s=0.15 first, then {26.7%, 5%} on the winner.

**Amendment (same day, before any sweep run):** selection restricted to the mean over the four
≥30-gold real-val classes (one komaSharp token was measured to swing the 6-class mean 6.9pp);
stage 1 shortened to ~3–4k steps but re-run per arm, since `s` must apply to stage 1; komaFlat
precision (62 gold) adopted as the measurable proxy for the un-de-riskable komaSharp exam floor.

**Cancelled, on measured grounds, before any arm ran:**
1. **Power** — the largest intervention available (the init A/B itself) moved the amended metric
   **0.5pp** (92.7 vs 92.2). Subtler sweep arms would land inside noise, and the protocol's argmax
   would have recorded a coin flip as a measured selection *before* a one-shot exam.
2. **Premise collapse** — the hallucination the sweep targeted was already fixed on real-val by the
   re-render itself (komaFlat F1 93.7 in *both* arms, from a 53.8% baseline precision), making a null
   three-way result ambiguous and the mechanism question unanswerable there.
3. The amendment itself carried a **stage-1-length confound** (logged as a protocol bug).

**Consequences:** `s` ships at the pre-registered default 0.15; nothing was selected; the Step-4.0
floors, one-shot exam and real-val-only selection were untouched. **Replacements pre-registered in
its place:** a future-sweep **power criterion** (the minimum interesting effect must exceed the
measured metric movement, currently 0.5pp); the free **degraded-strip probe** as the mechanism
diagnostic (run 2026-07-23 — hallucination is not ambiguity-driven); and Round-2 **renderer
deconfounding** (transposed-carry / accidental-thinned every) instead of re-sweeping the conflated
`s`. The komaSharp exam floor (18 gold, baseline 21%, target ≥70%) stayed an acknowledged leap of
faith the sweep could not have de-risked anyway.

## The Round-2 pivot trigger (proposed 2026-07-23, DROPPED the same day)

Proposed rule: if the Round-2 exam closes less than half the remaining gap to the 80% F1 floor, the
correction-loop pivot automatically becomes primary. **Dropped by the owner.** It inherited an
unproven premise — that Round-2 levers are at least as strong as Round-1's, when Round 1's gain was
partly a one-time synthetic→real jump — and it keyed a six-floor ship decision on a single metric.
The correction-loop pivot stays a **situational call** after the Round-2 exam. Consequence accepted:
there is no automatic guard against a sunk-cost "one more round".

*(An earlier ROADMAP entry said this was "RATIFIED", contradicting the track doc. Corrected
2026-07-25; the track doc was authoritative.)*

## Overturned data-mix ideas

- **"Boost komaSharp/kucukSharp share in the re-render"** (2026-07-20) — **overturned by measurement
  2026-07-21**: komaSharp was already over-represented and precision-bound, not recall-bound. The
  real gap was `kucukFlat`, and that turned out to be a makam-mix artifact, so the planned
  `bakiyeSharp→kucukFlat` enharmonic respell was **held**, not implemented.
- Note this is *not* the same as the still-open **sharp frequency imbalance** (far more koma than
  küçük inline, never both in one image), which is a live Round-2 item — see
  [../STATUS.md](../STATUS.md).

## Already-executed step-by-steps (kept only as a template)

- **The Rung-2.2 ONNX export checklist** (local checkpoint copy → gate-strip pick → `optimum-cli`
  export → int8 via `quantize_onnx.py` → `onnx_parity.py` fp32 *and* int8 → browser gate → log in
  `MODEL_EVAL.md`) was carried out on 2026-07-08 and again for 2.2b and Round 1. The live procedure
  now lives in [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md) Check 9; use that, not this note.
- **Round-0.5 labeler fine-tune** — done 2026-07-15, a throwaway tooling checkpoint, never shipped.
- **Exam v1 (20 pieces, 33 strips, 83.3% AEU)** — superseded by exam v2 (2026-07-15) and v2.1
  (2026-07-19). The 83.3% number is LOW-N and must not be quoted as a baseline; the reference is the
  352-strip v2.1 read.

## Parked, not dead

These were deliberately set aside and may return; they are *not* cancelled:
- ~2,100 blurry nota-review rows (`low_coverage` / `nav` / `nd_review`) — unverdicted rows never
  train; mine them per-class only if an error taxonomy gives a reason.
- 126 nota-full pending disputes (pitch/accidental content) — post-Round-1 re-audit territory.
- Decode-repair heuristics + adaptive window re-split on cap-hit — see
  [../rung3/followups.md](../rung3/followups.md).
- Sub-measure fragments for dense contiguous tuplet runs.
- In-browser stages 2–7 (the slicer/decode currently run in Python) and stage-9 header OCR.
