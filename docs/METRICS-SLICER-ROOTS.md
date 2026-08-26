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

## Re-cutting the exam on the current slicer, priced THREE ways (2026-08-25)

⭐ **The answer is 125 verdicts, and the two earlier numbers were both bounds rather than estimates.**
All three measure the same re-cut; they differ in what they call a loss.

| measurement | verdicts lost | of 455 | what it actually asks |
|---|---|---|---|
| span comparison (2026-08-24, **superseded**) | 78 | 17% | did `row_x0`–`row_x1` move? Optimistic — same span can hold different pixels, and it predates the 25 Aug blob fix |
| page level (`check_crop_staleness.py`) | 287 | 63% | did ANY crop on this page move? Pessimistic — one moved crop voids a whole page |
| **strip level, `carry_gold`'s own rule** | **125** | **27%** | is there a crop holding this exact music, in a row whose barlines did not move? |

**Page level, all 67 pages** (`--root data/real/strips_examv3 --pages 67`, 2026-08-25):

| | pages |
|---|---|
| identical | 25 |
| pixels only / size only (labels fine) | 0 / 0 |
| **measures differ** — labels void | 16 |
| **crop count/names differ** — labels void | 26 |

**37% of pages keep their labels; 42 of 67 lose them.** ⚠ That the "labels fine" rows are both ZERO
is itself the finding: on this re-cut a page either survives untouched or its music moves.

**Strip level**, matching on `build_exam_v3_queue.py`'s own `MUSIC_KEYS` (L120 — `system`,
`meas_from`, `meas_to`, `n_measures`, `is_row_start`), with one guard added: an index match only
means "same music" if that row's **measure count** did not move, because adding a barline renumbers
every measure after it.

| outcome | crops (of 1,369) | verdicts (of 455) |
|---|---|---|
| **carried** — same span, row's barlines unchanged | 899 (65.7%) | **330 (73%)** |
| bars_changed — lands on a crop, but the row was renumbered | 77 | 25 |
| staves_changed — the page's staff count moved | 101 | 24 |
| **lost** — nothing holds that music | 292 (21.3%) | 76 |

Of the **125** needing a person again, **76 are fully lost** (retype from the picture) and **49 land
on a crop with the old label carried as a suggestion** — a confirm, not a retype.

⚠ **Do not use `check_crop_staleness.py`'s page verdict as a labelling bill.** It grades a page, and
it is the right tool for *"is this queue safe to label"* — but as a cost it over-counts by 2.3x here.

## What the staff RESCUE would add to that bill (2026-08-25)

Measured on the same 67 exam pages, rescue off vs on ([METRICS-SLICER.md](METRICS-SLICER.md)):

| | |
|---|---|
| staff rows, rescue **off** | 501 |
| staff rows, rescue **on** | **522 (+21)** |
| pages gaining a row | **14 of 67 (21%)** |

Concentrated: `vuslata_nail_de_etse_ger_felek_nota_p2` alone gains 4 (4 → 8) and four pages gain 2.
At ~2–3 strips a row that is roughly **+45–60 new strips**, all unlabelled, on pages already
verdicted — an `examv4` of ~710–725 rows against `examv3`'s 663.

⚠ **The exam and the training pools do not have to be cut with the same setting**, only to each be
internally consistent, and `window_signature()`'s `staff_rescue` field records which cut a given
decode. The rescue's value is highest where rows are free (training: **+320 rows over 227 pages**)
and lowest on the exam, which grades fine at 663 and whose difficulty has already shifted once.
⚠ The cost of splitting them is that the model would be **trained** on rescue-cut pages and
**graded** on pages cut without it. Unmeasured, and small only because every row both settings find
is cut identically. Not yet decided — [STATUS.md](STATUS.md).

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
