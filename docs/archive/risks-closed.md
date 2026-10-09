# Risks — closed caveats, archived

purpose: the RISKS.md entries that stopped being true, kept verbatim so their reasoning survives
audience: anyone asking why a caveat left RISKS.md
updated: 2026-10-08

> ⛔ **Archived 2026-10-08 from [../RISKS.md](../RISKS.md).** Why each left: the training pools moved to
> the current slicer (`strips_b8` / `strips_h1` hardlink `strips_v2`); the exam's gold was fully read
> and the exam was read on 2026-09-01; the 46-page interval became 63 graded pages (now a live caveat
> in RISKS); the crop-geometry probe closed 2026-08-17; the browser fallback was switched off
> 2026-09-04; Round 3 is closed; error highlighting (W8) was dropped 2026-08-05; the pivot trigger was
> already superseded.

- **NEW (2026-08-21): the training pools are the last thing still on the RETIRED slicer.** The exam
  was rebuilt on the current one and `_realval_v2` was already on it; `strips_nota` / `strips_r1` /
  `strips_tup` — **2,330 real training strips** — were not. Until they are re-emitted, a Round-3 model
  learns real-page appearance from crops the shipped slicer no longer produces, then is selected and
  graded on crops it does. Round 3's own Lever 1 measured crop geometry as **causal**, so this is a
  domain gap of the kind the round exists to close. Cost of fixing it is measured and low: **89% of
  the labels carry** onto the new crops by measure span, with no new labelling
  ([BACKLOG.md](../BACKLOG.md) item 4).
- **NEW (2026-08-21): 96 labels enter the rebuilt exam's gold without any human having read them.**
  139 strips come straight from the emitter; 43 agree token-for-token with the frozen exam's hand-made
  gold, the other 96 have no such check. The reference point is exam v2's own audit: of its 63
  auto-accepted labels a human later corrected **32 (51%)**. They are the `examv3-full` tab, and
  reading them is a precondition of the read
  ([rounds/round3-criteria.md](rounds/round3-criteria.md) §3c).
- **NEW (2026-08-21): the rebuilt exam is a harder instrument than the floors were signed against.**
  ~12 candidate strips a page against 7.1, so the primary reads lower at equal model quality. The
  baseline re-score keeps the comparison fair; what the absolute 75% *means* is an open owner
  decision, and it must be settled before the read (§3c).
- **NEW (2026-08-15): the primary Round-3 floor is measured on 46 pages, so its 95% interval is
  roughly ±12 points.** ⚠ Superseded in its numbers by the rebuild — the exam is now 64 pages —
  but not in its point. A model truly at 72% can read 78% and vice versa. The criteria are signed and
  are **not re-opened**; what is still open, and is the owner's call **before** the read, is whether
  to grow the exam first (v3 is already owed) or to read it as signed and report the interval beside
  the result. Choosing after seeing the number is the one option that is not available.
  Reasoning: [rounds/levers.md](rounds/levers.md).
- **NEW (2026-08-15): the crop-geometry finding is observational.** ~40 strips a bucket, on crops cut
  by the retired slicer, and no causal test has run yet. Nothing renders on it until the padding
  probe reads. ⚠ The same file also records the trap in acting on it: narrow crops make the
  **short-crop hole** the common case, and short crops are the worst thing this model reads.
- **The in-browser fallback hides its own reasons.** Whenever the server is missed the page is still
  read correctly, so nothing looks broken — the only evidence is `data-where` and a warm laptop. That
  is what let the cold-start bug live from 2026-08-06 to 2026-08-08 in a fully "passing" deployment.
- **NEW (2026-08-14): a Round-3 model will differ from `round2-stage2-best` by four things, not one** —
  the corpus change, the **`staff_jitter` augmentation added 2026-07-29** (two days after Round 2
  trained; ±4% scale on 80% of samples, never A/B'd), a sub-visual **rasterizer drift** that moves
  every one of the 40,826 strips, and the training environment. This is why the tuplet A/B trains its
  own control instead of reusing the live model, and it is a caveat on Round 3's exam read too.
  Measurements: [METRICS-CORPUS.md](../METRICS-CORPUS.md); reasoning:
  [rounds/round3-criteria.md](rounds/round3-criteria.md).
- **The correction-loop strategy is now the plan, not a fallback** (goal change 2026-07-27). What is
  still unmeasured is whether error localisation actually saves a user time — that needs a person
  correcting real pages with and without the highlights, not a model metric.
- **Superseded:** there is no pre-registered pivot trigger. Switching to a correction-loop strategy is a
  situational call after the Round-2 exam, not an automatic rule.
