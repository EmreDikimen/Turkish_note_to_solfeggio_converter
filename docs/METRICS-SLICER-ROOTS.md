# Crop roots — which slicer cut which pool, and what a re-slice costs

purpose: crop PROVENANCE — which root came from which slicer, what re-cutting costs in labels, and how to measure a queue's staleness before labelling it
audience: anyone about to label a queue, re-slice a pool, or re-cut the exam
updated: 2026-08-25

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-25 when that file crossed the
400-line cap. That file keeps **what the page-cutter does**; this one keeps **where a crop on disk
came from**. Nothing is duplicated in either.

⚠ **A strip filename survives a re-slice and its pixels do not.** That is the single fact this file
exists for: two roots can hold the same filenames and different images, so a label written against
one root is not a label for the other.

## Re-cutting the exam on the current slicer, priced (2026-08-24)

Read-only comparison of the frozen `strips_examv3` manifests against a fresh slice of the same pages:

| | |
|---|---|
| strips in examv3 | 1,369 |
| crop span **unchanged** | 1,075 (78.5%) |
| **moved or gone** | 294 (21.5%) |
| verdicts already recorded | 452 |
| **verdicts invalidated** | **78** (55 fix, 21 bad, 2 ok) |

⚠ **Optimistic lower bound.** It compares `row_x0`–`row_x1` only; a row whose vertical placement
moved gives different pixels under the same span. The exact figure needs the crops themselves
compared.

## The labelling pools are OLD-SLICER output (2026-07-28)

Strips on disk were written 2026-07-15..17; `page_to_strips.py` was overhauled 2026-07-25 and the
pools were never re-sliced. Re-slicing 5 queue pages and comparing crop-for-crop:

**0 of 30 crops are identical**, 2 no longer exist, and old slivers became full rows
(`gonul_sana_tapali..._s03_w00` **207 px → 1435 px**; `yuru_dilber_ney_p1_s01_w02` 409 → 1038) —
the sliver behaviour the overhaul fixed. **The frozen exam carries the same 2026-07-15..17 crops**,
so exam and real-val are consistent with each other but both measure a slicer no longer shipped.
Owner's read while labelling: the model does well, the failures were the old slicer's — though the
current slicer's crops still have some issues. Measured on 5 pages (164 old vs 147 current crops,
small sample, indicative only):

| | old slicer | current slicer |
|---|---|---|
| crops < 350 px (slivers) | 3.0% | **0.7%** |
| min_logprob < −1.0 (predicts a broken crop) | 3.0% | **0.7%** |
| min_logprob < −0.5 | 9.8% | 10.2% |
| clean and confident (> −0.1) | 72.6% | 70.7% |

**The catastrophic crops are ~4x rarer; the moderate ones are unchanged.** Re-slicing removes the
sliver class, not every bad crop — matching the owner's observation exactly.

## Which crop root is still current — measured, not remembered (2026-08-17)

`scripts/rung3/check_crop_staleness.py` re-slices sampled pages with **today's** code and compares
crop-for-crop. It exists because the owner asked the right question before committing a week of
labelling — *are these crops even what the slicer makes now?* — and the answer differs by root, which
nothing recorded.

| root | queues that read it | pages keeping their labels (n=20) |
|---|---|---|
| `data/real/strips_v2` (2026-07-29 re-slice) | `reslice-all`, `realval-hard-v2` | **100%** — 18 byte-identical, 2 size-only |
| `data/real/strips` (2026-07-15..17) | `nota-*`, `exam-fix`, `r1-*`, `tup-*` | **10%** — 16 of 20 change crop COUNT, 2 change measures |

**What voids a label is the music, not the pixels.** The script grades in that order: different
measures or a different crop count voids it; a different width does not, and neither do different
pixel values. On the two `strips_v2` pages that moved, every crop carries **the same measures** — the
measured staff spacing shifted by half a pixel (8.5 → 9.0 px) on two systems of a **rotated** page, so
the row rescales ~5% narrower. A label still names the right notes.

**Consequences, both worth acting on:**

- **`reslice-all` is the safe queue to label** — 33,804 rows over 1,704 pages, 33,639 pending,
  ordered worst-first.
- **The 531 `fix` verdicts already in `nota-full` are stranded** on crops today's slicer does not
  produce. They still evidence that the SymbTr-derived labels were bad (531 fix vs 167 ok), but they
  are not 531 corrections anyone can bank. Re-slicing those pools is a rebuild, not a repair.

⚠ This is the third time crop staleness has cost something — 130 verdicts in July, the pools in the
row below, and nearly a week here. **Run this script before any labelling push**, and never infer a
root's freshness from a date.

⚠ **The n=20 row above is a corpus average, and a batch is not a random sample** (2026-08-18). The
labelling batches cut by `build_label_batch.py` deliberately select the *most damaged* pages, which
is the population most likely to move under a re-slice. `--pages-from <batch>_pages.json` therefore
re-slices **exactly the batch's pages** instead of a random sample — the difference between "the
root is mostly current" and "the work I am about to do will survive". Pages of the batch with no dir
under the root are reported, not skipped silently. Usage: [rung3/labeling-queues.md](rung3/labeling-queues.md).
