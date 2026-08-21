# The labelling queues — realval-hard, reslice-all and the batches

purpose: the dated review queues, why each exists and what it produced
audience: agents and the owner working the real-page track
updated: 2026-08-20

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
| `batch1` | whole corpus | 52 / 1,500 | nota 47, neyzen 5 | 48.6 units/page | ⛔ **PARKED — and not the answer, see below** |
| `batch2` | `--clean` (born-digital only) | 52 / 1,497 | nota 52 | 30.2 units/page, from 115 ranked pages | ⛔ **STOOD DOWN 2026-08-19** at 68 verdicts |
| `batch3` | `--scanned` (the inverse filter) | **54 / 1,499** | nota 46, neyzen 8 | 43.0 units/page, from 1,504 ranked pages (corpus median 12.0) | ✅ **CUT 2026-08-19 — THE LIVE ONE** |

**Why batch 1 is parked.** Unfiltered, the ranking selected exactly what it is built to select — the
most damaged pages — and those turn out to be old scans and **real handwritten manuscript**.
Handwriting is a **deferred category** ([../DECISIONS.md](../DECISIONS.md), owner 2026-08-17) and must
not enter a printed-page pool. The file is kept on disk as the record of what the unfiltered ranking
returns; it carries 4 verdicts from a look at the top rows and no more.

**Why batch 2 was the live one.** `--clean` restricts the ranking to **born-digital** pages — a
file-format fact, not a heuristic, so no scan and no handwriting can enter
([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). The owner's call on 2026-08-18 was to teach the clean
modern sheets first. ⚠ **Know what it aimed at**: the still-open *"publish for clean pages first"*
question, **not** the signed Round-3 floor — that exam is 41 nota / 26 neyzen pages and only 18% of
it is the easy tier, so a clean-page batch cannot be expected to move it much.

## ⛔ Why batch 2 was stood down after 68 rows (2026-08-19) — and what replaces it

The caveat above turned out to be understated, and two measurements say so
([../METRICS-CORPUS.md](../METRICS-CORPUS.md)):

- **93% of exam pages are scans** — 62 of 67; only 4 of 45 exam pieces are born-digital. So `batch2`
  was cut entirely from the tier that supplies **7%** of the medium Round 3 is graded on.
- **Its own fix rate is ~12%** (59 ok / 8 fix / 1 bad, n=68), against **30%** in the scanned nota
  pool. Since a row is seeded with the decode, an `ok` changes the training data by **nothing** — so
  the yield of a batch is its *fix* rate, and ~88% of those looks bought nothing.

The owner's goal changed with it: the model must be **good enough on scans too**
([../DECISIONS.md](../DECISIONS.md)).

⚠ **`batch1` is NOT the inverse and unparking it is the wrong move.** It ranks the most damaged pages
*corpus-wide*, which is why it surfaced handwritten manuscript in the first place — and 10 of its 52
pages are born-digital anyway. Handwriting stays **deferred**.

## ✅ `batch3` — cut 2026-08-19, and what the cut cost

All five steps ran. `--scanned` and `--exclude-pages` are now in `build_label_batch.py`;
`--stats --batch N` reads the yield while labelling.

**The batch: 54 pages / 1,499 strips**, nota 46 + neyzen 8, 43.0 evidence units a page against the
scanned tier's median of 12.0. Two rows arrive already judged, carried in from the master queue.

**28 pages were excluded, and it took four cut/check rounds to converge** — dropping a page pulls
the next-ranked one in, and that one has to be triaged and checked too. The list, with a reason per
page, is `data/real/rung3/_pagequeue/handwritten_pages.json`; the crop verdicts are
`batch3_staleness.json`.

| Excluded | n | Why |
|---|---|---|
| handwritten | 11 | free-hand pen manuscript — a **deferred category**, and the scanned tier is the first tier that can contain it |
| stale crops | 17 | the page no longer re-slices to the same crops, so a verdict on it would not survive a re-slice |

⚠ **The handwriting rule is narrow, deliberately.** A page is dropped when its **note glyphs** are
drawn free-hand — irregular noteheads, wobbly stems, hand-drawn staff extensions, visible
corrections. The professionally **hand-copied editions** that were reproduced and published are
KEPT, even where the lyrics are hand-lettered: most of the Turkish nota corpus is exactly that, and
so is the exam, so the wide rule would empty the scanned tier and train on a medium the exam does
not have. 56 pages were read by eye at contact-sheet scale and 20 of them again at native
resolution, before and after each re-cut.

⚠ **24% of the pages the ranking offered are stale** (17 of 71 checked) — the scanned tier really is
staler than the corpus average, as this file predicted. Every page in the final batch is verified:
40 identical, 11 size-only, 3 pixels-only, **0 void**. The owner's call was to exclude rather than
label into them, because B8 (re-emitting the pools from the new crops) is still an open decision, so
a re-slice is a real possibility rather than a hypothetical one. The cost is real too: the excluded
pages were the highest-evidence ones in the tier.

✅ **THE PROBE IS IN AND `batch3` IS THE BEST-PAYING QUEUE THIS PROJECT HAS RUN (read 2026-08-20,
114 of 1,499 judged: 66 fix / 39 ok / 9 bad).** That is a **~58% fix rate** — against ~30% in the
scanned nota pool and **~12%** in `batch2` — so the tier re-aim was right and the queue is worth
finishing. The bad rate is **7.9%**, far under `realval-hard`'s 33%, so no impact-score cap is
needed. ⚠ **~1 in 5 of those fixes is deleting a false `\repstart`**, i.e. hand-payment for the
dotted-barline hole, which is now going into the final render label-free
([../DECISIONS.md](../DECISIONS.md)) — expect the fix rate to fall once a model trained on that
render replaces the seeding decode. ⚠ **Priority note (2026-08-20): exam v3 outranks this queue for
a scarce evening** — 297 rows that decide whether the one-shot read can be interpreted, against
~1,385 rows here that improve training ([exam.md](exam.md), and the `examv3` section below).

⏭ **The original instruction, kept for the record: probe 100 rows before committing to all 1,499**,
then `--stats --batch 3` for the fix rate AND the bad rate. Reference points: **~30%** fix in the scanned
nota pool (why this tier), **~12%** in `batch2` (why that one was stood down), **33%** crops lost in
`realval-hard` (the bad-rate warning). If the bad rate is high, cap the impact score rather than
reading on. ⚠ Attend to **pitch and duration, not accidentals** — every audit so far chased
accidentals because the old headline measured them, and that axis has never been audited.

**The loop**, and the two steps that are easy to skip:

```bash
npx tsx tools/vision/page-structure.ts                                    # 1. stitch stats (once)
.venv-ml/bin/python scripts/rung3/build_label_batch.py --merge-back --batch 2   # 2. LAST batch home
.venv-ml/bin/python scripts/rung3/build_label_batch.py --scanned --batch 3 \
    --exclude-pages data/real/rung3/_pagequeue/handwritten_pages.json     # 3. cut it
.venv-ml/bin/python scripts/rung3/check_crop_staleness.py --root data/real/strips_v2 \
    --pages-from data/real/rung3/_pagequeue/batch3_pages.json \
    --out data/real/rung3/_pagequeue/batch3_staleness.json                # 4. will the work survive?
#    -> add every `wouldLoseLabels` page to the exclude list, re-cut, re-check the NEWCOMERS
.venv-ml/bin/python scripts/rung3/review_ui.py                            # 5. label the `batch3` tab
.venv-ml/bin/python scripts/rung3/build_label_batch.py --stats --batch 3  # 6. what is it yielding?
.venv-ml/bin/python scripts/rung3/build_label_batch.py --merge-back --batch 3   # 7. verdicts home
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

---

## ⏭ `examv3` — the exam, re-cut whole (2026-08-21)

**Why it exists.** It is the labelling that **blocks the Round-3 read**. It began as a growth queue
over the 21 exam pages we own but never graded; it became a **rebuild of the entire exam** when the
first strip the owner opened showed that no exam page had ever been re-sliced ([exam.md](exam.md)).

**What is in it.** **663 rows over 64 of the 67 pages**, plus `examv3-full` with the **139** strips
the emitter labelled by itself. **185 rows arrive with text already in the edit box** — the frozen
exam's own gold, moved onto the crop holding the same music, or a correction typed against the
superseded first cut. Composition, the gold-carry table and the harder-instrument caveat:
[../METRICS-EXAM.md](../METRICS-EXAM.md).

⭐ **It reads its OWN crop root, `data/real/strips_examv3`.** A separate root is what made the
re-slice safe: the emitter slices in place, and the crops under `data/real/strips` are hardlinked
into `strips_exam_v2_clean/`, so re-slicing there would have rewritten the pixels the **frozen
exam's** gold describes. Verified after every run: all 1,026 crops on the graded pages byte-identical.

⛔ **Two superseded cuts are kept and must not be labelled**: `strips_exam_v3_oldgeom` (the first cut,
on retired-slicer crops — 24% of its rows under 400 px against 4% now) and `strips_exam_v3_growthonly`
(the 214-row growth queue, before the owner chose a rebuild).

```bash
.venv-ml/bin/python scripts/rung3/build_exam_v3_queue.py --plan      # prints the emit command
#   … run it: re-slices + decodes all 67 pages into data/real/strips_examv3 …
.venv-ml/bin/python scripts/rung3/build_exam_v3_queue.py --rebuild   # -> the examv3 queue
.venv-ml/bin/python scripts/rung3/review_ui.py                       # label the `examv3` tab
.venv-ml/bin/python scripts/rung3/promote_labels.py \
    --dir data/real/rung3/strips_exam_v3 --exam \
    --strips-root data/real/strips_examv3                            # verdicts -> exam gold
```

⏭ **The order to label it in, and the stopping rule** (reviewed 2026-08-21, owner accepted):

1. **`examv3-full` first — all 139 rows.** 96 of them are exam gold no human has ever read. The
   reference point is exam v2's own audit: of its 63 auto-accepted labels a human later corrected
   **32 (51%)**. A wrong gold label *manufactures* corrections on the page it sits on, which is how
   a bad label moves the primary.
2. **The 27 `gold_conflict` rows**, where a hand correction and a fresh derivation disagree.
3. **The rest, PAGE-COMPLETE.** The primary counts corrections *per page*, so a half-labelled page
   under-counts its own errors — grading it would be worse than skipping it. Stopping early should
   cost whole pages, never half ones.

- ⚠ **`--strips-root data/real/strips_examv3` on the promote step is not optional.** The default root
  holds the same filenames with the retired slicer's pixels, so the default links the wrong pictures.
- ⚠ **A SUGGESTION IS NOT A VERDICT.** The carried gold sits in `corrected_label` with the row still
  pending, so `e` opens the editor with it already typed. It is confirmed against the new picture,
  never promoted unseen — a label written against a crop that cut a beamed group in half is a reading
  of a truncated picture.
- ⚠ **`gold_conflict` (27 rows) is where a hand correction and a fresh SymbTr derivation disagree**
  on the same music. Read those first; the first one examined is a `\tie` the gold has and the new
  label does not, with the arc plainly drawn in the crop.
- ⚠ **EXAM GOLD, NOT TRAINING.** Every row carries `exam=1`, which `promote_labels.py` refuses to
  promote into a training manifest.
- ⚠ **Attend to the picture.** 329 of the 663 rows are `row_unaligned` and carry no label at all —
  the edit box starts from the model's decode, and `ok` must mean "I looked and it was right".
- ⚠ **Preconditions of the read**: finish before the model takes it, and **re-score
  `round2-stage2-best` on the rebuilt exam** — now doubly binding, since the instrument changed
  ([exam.md](exam.md), [round3-criteria.md](round3-criteria.md) §3b).
- ⏭ Promotion grows `strips_exam_v3/manifest.jsonl`. That manifest **replaces** `strips_exam_v2_clean`
  as the exam; the old one stays on disk as the record of what Round 2 was measured on.
