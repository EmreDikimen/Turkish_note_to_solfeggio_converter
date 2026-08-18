# The labelling queues — realval-hard, reslice-all and the batches

purpose: the dated review queues, why each exists and what it produced
audience: agents and the owner working the real-page track
updated: 2026-08-18

> Split out of [labeling.md](labeling.md) on 2026-08-07 at the 400-line cap. That page is the
> standing procedure (free labels from SymbTr matches); this one is the **queues that were run
> through the review UI**. Current state and next action are NOT here: [../STATUS.md](../STATUS.md).

---

## The `realval-hard` queue (2026-07-28) — labelling the practice test's missing hard tier

**Why it exists.** Real-val reads ~96% where the exam reads 74%, and the cause is measured:
composition. The exam is 18% easy / 41% mid / **41% hard**; real-val is 59 / 41 / **0**. A practice
test with no hard questions cannot rank candidates, which is why every round so far has been a blind
one-shot. Rebuilding it is item 1 in [../STATUS.md](../STATUS.md).

**Why it cannot be done by filtering.** "Hard" means the emitter refused the strip for
`row_unaligned` or `nd_high` — those are **drops, not reviews**, so no label was ever written
(6,168 in the nota pool alone, 13,975 across all pools). The exam has 145 hard strips only because
they were recovered and hand-labelled one at a time. There is no pile to draw from.

**The queue.** `scripts/rung3/build_realval_v2.py --queue N` selects candidates that are on the
val side (`data.is_real_val_piece`, the same rule `train.py` uses) and never exam pieces, mirrors
the exam's own 107:38 `row_unaligned`:`nd_high` balance, caps 3 strips per piece so the tier is not
five bad scans repeated, and seeds each row with the **current** model's decode.

**The live queue is `realval-hard-v2`** (2026-07-29): 165 staged, 110 needed, built on the
2026-07-29 re-slice. The surplus absorbs unusable crops — the first round lost **43 of 130 (33%)**
that way. `realval-hard` (v1) is kept as the record of that round's verdicts (65 ok / 22 fix /
43 bad); **do not label there.** None of those verdicts transfer, because no crop survives a
re-slice unchanged.

**Rows are ordered WORST-FIRST** — least confident at the top (reversed 2026-07-29; it was
most-confident-first). The calibration is what decides this: on the exam's hard tier the same
model's decode is exactly right **80%** of the time at `min_logprob > -0.1`, and only **4%** below
−1.0 ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)). So the confident head is mostly the
reviewer confirming what is already right, while nearly every real correction sits in the tail.
Worst-first spends the human where the errors are.

**Stopping early is allowed — but on a measurement, not a feeling.** Work down from the top. As
rows get more confident the corrections dry up, and at some point reading on stops earning its
keep. Before accepting a remaining tail:

1. Draw **~20 rows at random** from what is left — random, not the next 20, or you have only
   measured the easiest slice of the remainder.
2. Read them properly, against the picture.
3. **Judge the shape of the errors, not just the count.** A few scattered misses are survivable:
   they add noise that handicaps every candidate model about equally. Errors that are all the
   *same kind* — say every one a koma/küçük confusion — are not, because they systematically
   punish precisely the model that fixes that weakness. Any clustering means keep reading, however
   good the count looks.
4. If the sample is clean and the misses are scattered, accept the rest and write those rows with
   **`by=tail-accept`** so they stay distinguishable forever. A later human verdict clears the
   marker automatically (`review_ui.save_verdict`).

Record the sample size and what it found. If real-val ever reads oddly, that note is how you check
whether the tail is the reason.

- ⚠ **An accepted row you did not read becomes gold.** If it is wrong, a Round-3 model that FIXES
  that error gets scored as a regression for fixing it. That is the only way this queue can do
  real harm — which is why the stop is gated on a sample rather than on the ordering alone.
- Seeding from the decode is deliberate and is only safe **because a person checks it against the
  picture**. `ok` must mean "I looked and it was right", never "the model sounded sure". Same
  contract as `photo-gold`.
- ⚠ **Queues are versioned per re-slice, and images resolve per queue.** Strip *filenames* are
  stable across a re-slice but the pixels are not: 59 of the v2 candidates reuse a v1 filename, and
  129 of the 165 also exist under the old `data/real/strips/`. `QUEUE_IMG_ROOTS` in `review_ui.py`
  binds each queue to the crops it was built from — without it the whole v2 queue would have
  rendered last week's pictures against this week's rows.

**`f'' 32` is NOT an error — do not "fix" it.** The model emits the 32nd-note duration with a space
before it. Measured: `f''32` and `f'' 32` produce **identical token ids** (`[19, 1, 37, 95, 35]`),
because the tokenizer splits the octave marks from `32` either way — the glued form even *decodes
back* with the space. `eval_omr.py` scores in id space, so the two are the same thing.
⚠ **This holds for `32` only.** `f''16` vs `f'' 16` and `f''8` vs `f'' 8` DO differ in id space, so a
space before those would be a real disagreement. Every spaced occurrence in this queue is a `32`
(20 of them, all verified lossless). The written convention elsewhere is glued — 0 spaced labels
across the exam, nota and real-val pools — so `build_realval_v2.py --build` normalises them; the
reviewer does not need to.
- ⚠ **An unverdicted row must never enter the metric pool** — that would reintroduce exactly the
  flattery the rebuild exists to remove.

Run: `.venv-ml/bin/python scripts/rung3/review_ui.py` → queue **`realval-hard-v2`**. Images resolve
from `data/real/strips_v2/<page>/<strip>`. Progress and the target mix:
`build_realval_v2.py --report`.

## The `reslice-all` queue (2026-07-31) — every strip the re-slice decoded, in one place

**What it is.** One queue over **all 33,804 crops / 1,704 pages** in `data/real/strips_v2` (30,049
decoded on Colab), so any strip in the re-slice can be pulled up instead of only the 165-row
hard-tier sample. `scripts/rung3/build_reslice_queue.py` builds it **worst-first** (`--order page`
groups by page instead); re-running merges the verdicts already there and carries the 165 hand-read
`realval-hard-v2` rows across — same crops, same slicer.

**What a row means.** 392 rows carry a real emitted label from the val-side emit (`strips_v2emit`);
the other 33,412 are seeded with the page cache's decode, so `ok` means "I looked at the picture
and the decode is right" — the `photo-gold` contract. `reason` carries the emit's own verdict where
there is one (`accepted`, `row_unaligned`, `split_wide`, …) and is the filter to narrow with.

⚠ **Nothing but `strips_v2emit` is joined in** — every other pool was emitted from the OLD crops
under `data/real/strips`, and a filename survives a re-slice while its pixels do not. ⚠ **It is a
browsing tool, not a labelling target** — 33,804 hand checks is not a plan, nothing consumes it
yet, and promoting from it needs the same rules as any other queue.

Run: `review_ui.py` → queue **`reslice-all`** (the default tab); its rows load on first open, too
big (16 MB) to ship with every `/api/state`.

## The labelling BATCHES (2026-08-18) — a page-complete cut of `reslice-all`

**Why they exist.** `reslice-all` is a browsing tool, not a labelling target: 33,804 hand checks is
not a plan, and the UI sorts nothing. Worse, the queue ships **worst-confidence-first**, an ordering
since measured at **0.44× lift** on this very pool ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)),
so taking its first 1,500 rows is close to labelling 1,500 random strips. A batch is therefore cut
outside the UI by `scripts/rung3/build_label_batch.py` and handed to it as its own queue.

**What it ranks on, and what it refuses to rank on.** Per-page **structural evidence** — off-meter
bars, stitch warnings, truncated (`hit_cap`) strips, slicer-flagged crops — reusing
`build_page_queue.py`'s scorer, so there is one ranking implementation. The two obvious alternatives
are ruled out by measurements already on record: **decode confidence** (0.44× lift, and W8 was
dropped for it) and **label/decode disagreement** (~78% of disagreements are the *label* being wrong,
and `nd` is empty for all 33,804 reslice rows anyway).
⚠ It is a heuristic over **visible damage**, not a validated predictor of edits/page — and it cannot
be validated, because the only pages carrying gold are the exam's and those are (correctly) refused.
Read the order as "where the damage is", which is what it measures.

**Page-complete, in reading order** (`s00_w00`, `s00_w01`, `s01_w00`, …): the strip-level order is
worthless, reading a page once beats reading it 20 times, and a page is the unit Round 3's primary
floor is stated in.

⚠ **A batch is TRAINING data and nothing else.** Exam pieces are refused twice over (here, and by
the re-slice that produced the decodes), but the deeper reason is the ranking: it selects *the worst
pages in its tier*, so an exam drawn from it would not be comparable to exam v2.1's baseline or to
the signed floor. Exam growth is a separate job needing a random/stratified sample ([levers.md](levers.md)).

| Batch | Cut | Pages / strips | Sources | Evidence | State |
|---|---|---|---|---|---|
| `batch1` | whole corpus | 52 / 1,500 | nota 47, neyzen 5 | 48.6 units/page | ⛔ **PARKED, not labelled** |
| `batch2` | `--clean` (born-digital only) | 52 / 1,497 | nota 52 | 30.2 units/page, from 115 ranked pages | ✅ **the live one** |

**Why batch 1 is parked.** Unfiltered, the ranking selected exactly what it is built to select — the
most damaged pages — and those turn out to be old scans and **real handwritten manuscript**.
Handwriting is a **deferred category** ([../DECISIONS.md](../DECISIONS.md), owner 2026-08-17) and must
not enter a printed-page pool. The file is kept on disk as the record of what the unfiltered ranking
returns; it carries 4 verdicts from a look at the top rows and no more.

**Why batch 2 is the live one.** `--clean` restricts the ranking to **born-digital** pages — a
file-format fact, not a heuristic, so no scan and no handwriting can enter
([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). The owner's call on 2026-08-18 is to teach the clean
modern sheets first. ⚠ **Know what it aims at**: the still-open *"publish for clean pages first"*
question, **not** the signed Round-3 floor — that exam is 41 nota / 26 neyzen pages and only 18% of
it is the easy tier, so a clean-page batch cannot be expected to move it much.

**The loop**, and the two steps that are easy to skip:

```bash
npx tsx tools/vision/page-structure.ts                                    # 1. stitch stats (once)
.venv-ml/bin/python scripts/rung3/check_crop_staleness.py \
    --pages-from data/real/rung3/_pagequeue/batch2_pages.json             # 2. are these crops current?
.venv-ml/bin/python scripts/rung3/build_label_batch.py --clean --batch 2  # 3. cut it
.venv-ml/bin/python scripts/rung3/review_ui.py                            # 4. label the `batch2` tab
.venv-ml/bin/python scripts/rung3/build_label_batch.py --merge-back --batch 2   # 5. verdicts home
```

- ⚠ **Step 2 is not optional.** A verdict is only worth what its crop is worth, and a strip filename
  survives a re-slice while its pixels do not — `--pages-from` checks *exactly this batch's* pages
  rather than a random sample, which is the difference between "the corpus is mostly current" and
  "the work I am about to do will survive".
- **Step 5 keeps `reslice_all.csv` the record**, so no verdict lives only in a batch file. A strip
  that already carries a *different* verdict in the master queue is a real conflict: the merge
  reports it and leaves it alone rather than picking silently. Cutting over an existing batch CSV
  refuses unless `--force`, because that file may hold verdicts.
- The batches share `reslice-all`'s row schema and its crop root (`data/real/strips_v2`, bound per
  queue in `QUEUE_IMG_ROOTS`), so verdicts carried in from the master queue show up already judged.
- `--makam-cap` (default 0.15 of the strip budget) stops one makam taking the batch — Lever 4's whole
  argument is that the corpus is already too uniform.
