# Metrics — Round 3's two follow-up runs (A and B)

purpose: the single home for the numbers of the two runs made AFTER Round 3's final model was graded
audience: anyone asking whether a longer stage 2, or the retired pools' second cut, bought anything
updated: 2026-09-02

Round 3's exam was read on 2026-09-01 for `r3-final-stage2-last` and it missed
([METRICS-EXAMSET.md](METRICS-EXAMSET.md)). The owner then ordered two more trainings — *"round 3 is
not over. I will make 2 new trainings"* — and this file holds what they measured. ⚠ **Both are the
SAME ROUND as that exam read**, so neither has been near the exam; every number here is `_realval_v2`,
which **selects** and does not predict the exam (Round 1 it was out by 28 points).

## ⛔ The headline: all three models are indistinguishable

Every comparison below is `paired_arm_score.py` on `_realval_v2`, **262 unique strips**, both models
reading the same strips, with the tool's two pre-registered statistics.

| comparison | control edits | arm edits | mean diff / strip | 95% CI | sign test | verdict |
|---|---|---|---|---|---|---|
| Run A `best-real` (step 2500) vs `r3-final-stage2-last` | 667 | 656 | −0.042 | [−0.160, +0.073] | 15 / 15, p = 1.000 | **NULL** |
| Run B `last` (step 5000) vs `r3-final-stage2-last` | 667 | 645 | −0.084 | [−0.218, +0.046] | 19 / 16, p = 0.736 | **NULL** |
| Run B `last` vs Run A `best-real` | 656 | 645 | −0.042 | [−0.145, +0.057] | 17 / 15, p = 0.860 | **NULL** |

Exact-match over the same 262 strips: `r3-final-stage2-last` **68.3%**, Run A **69.1%**, Run B
**69.5%** — a spread of **3 strips**. ⭐ **Round 3's shipped choice stands. Neither a longer schedule
nor a second cut of the same music moves real-page accuracy.**

⚠ **The B-vs-A row carries TWO differences, not one.** Run B was to have been Run A plus the extra
pool; the owner set stage 2 to 5,000 steps where A ran 4,000 (2026-09-01), so a B-vs-A gap could not
have been attributed to the data anyway. It is moot here — the row is a null — but it is the reason
this file does not claim the extra data was isolated.

## Run A — a longer stage 2 (4,000 steps against Round 3's 2,000)

One variable, starting from Round 3's OWN stage-1 checkpoint. Raw log: `round3_runa_logs.md`.

- Real val **0.0182 → 0.0171 (−6.0%)**, minimum moving step 1750 → **2500**, then flat and drifting
  slightly UP over the last 1,500 steps. ⚠ Step 2,500 **of a 4,000-step cosine** — not a transferable
  step count.
- ⭐ **That 6% of loss is worth ZERO edits** (row 1 above). This is the cleanest demonstration the
  project has that a teacher-forced val loss is not a correction count, and it should be quoted
  whenever a loss curve is used to argue for a change.

## Run B — every hand-verified real strip, retired crops included

`strips_b8` (3,929) **plus `strips_oldhuman`** (1,408), both at `:4` — 4,777 combined train-side
strips against 36,032 synthetic = **34.7%** of stage-2 batches, against Round 3's recipe at 32.9%.
5,000 steps. Raw log: `round3_runb_logs.md`.

- ⛔ **Run B's `real` val column is NOT comparable with Run A's.** `train.py` holds out ~10% of the
  pieces of every real pool it is given, so B's real-val set is **560 strips** (390 b8 + **170
  retired-crop**) where A's was **390** (b8 only). B's higher `real` number is a harder exam, not a
  worse model — the paired reads above are what settle it.
- Real val bottomed at **0.0343, step 1250**, then sat in 0.0343–0.0385 for the remaining **3,750
  steps**. The extra steps bought nothing, which is the same shape Run A showed.
- Synthetic val, which **is** comparable (same 4,763 strips): B ends **0.0059** against A's 0.0114,
  better at every matching step. ⚠ Not a product number — the synthetic side has been solved at 99.9%
  since Rung 2, and this run's real-page result is a null.

### ⛔ The checkpoint selector was wrong a THIRD time

| | `best` | `best-real` | `last` | which won on `_realval_v2` |
|---|---|---|---|---|
| Round 3 final | step 500 | — | step 2000 | **`last`** (667 vs 784 edits) |
| Run A | step 250 | step 2500 | step 4000 | `best-real` (the run's only usable model) |
| Run B | step 3250 | step 1250 | step 5000 | **`last`** — 645 vs `best-real`'s 694 |

Run B's `last` beats its own `best-real` by **−0.187 edits/strip, CI [−0.420, −0.004]; 19 better / 13
worse, sign p = 0.377**. ⚠ **The two statistics disagree** — the CI clears zero by 0.004 and the sign
test is a null — so read this as "use `last`", not as a measured margin.
⚠ And note **why** `best-real` failed here specifically: B's real-val pool is **30% retired-crop
strips**, so the one selector that is supposed to track real pages was partly steered by pictures the
shipped slicer does not produce. [BACKLOG.md](BACKLOG.md) item 3.

## What this closes

⛔ **The retired pools' second cut is answered: it bought nothing measurable** (row 2, and row 3 for
the direct pair). That was [rung3/worklist.md](rung3/worklist.md) B10 and the owner's 2026-09-01
lead. ⚠ **It is a null, not a refutation of the idea** — 262 strips give a CI half-width of ~±0.13
edits/strip, so a small real gain could hide inside it. What it does rule out is the size of gain
that would have justified re-opening the exam.
