# Round 4's vocabulary A/B — how it is scored, and what the kit measured before any GPU ran

purpose: the numbers behind step 6 (old vocabulary against scheme H) — why edits need one shared scale, what the training pools and the selector actually hold — and, once run, its results
audience: anyone building, running or reading the step-6 A/B
updated: 2026-09-16

> Plan and order: [rung3/round4.md](rung3/round4.md) step 6. Decisions: [DECISIONS.md](DECISIONS.md)
> (2026-09-16 rows). Current state and next action are NOT here: [STATUS.md](STATUS.md).

## ⛔ An edit is not the same size under two vocabularies (2026-09-16)

Every scorer in this project counts edits in **token ids**. Scheme H spells a note in fewer ids, so
the same misread costs an H checkpoint fewer edits than an old one. Found while writing the step-6
notebook's read; nothing had been scored with it yet.

`scripts/rung3/score_vocab_check.py` (no model, ~10 s):

| check | result |
|---|---|
| same mistake injected into 267 real labels (`_realval_v2`), H − old edits, **each in its own ids** | **−1.139 / strip**, differs on **201** strips |
| the same, **both re-counted in old ids** after `data.canonical_label` | **+0.000 / strip**, differs on **0** |
| H decode → text → old ids, **without** `canonical_label` | wrong on **11,071 of 23,048** distinct labels |
| the same **with** it, under H and under old | **0** and **0** |
| `canonical_label` changing a gold label's old ids | **0** of 23,048 |
| base tokenizer + old vocabulary vs the live checkpoint's own ids | **0** differ |
| stored old-model decodes whose old ids `canonical_label` moves | **2 of 10,625**, both malformed (`b ''8`, `r''2`) |

- ⭐ **−1.139 is about 9× real-val's whole noise band** (~±0.13 edits/strip): read in its own ids,
  the A/B would have reported a large H win made by the ruler.
- ⚠ **Why text alone does not fix it**: H's decoder glues units the old tokenizer reads as different
  ids — `g''16a''16`, `r 16`, `c '8`. `canonical_label` puts one space between every command,
  barline, note, rest and stray duration, and glues only where a label never has a space.
- ✅ **Fixed in**: `paired_arm_score.py --score-vocab old` (refuses two vocabularies without it) and
  `error_taxonomy.py` (splits through `canonical_label`, length buckets always in old ids, and a
  checkpoint named by its run when its folder is a tag like `best-edits`).
- ⛔ **Not fixed in `eval_omr.py`** — the exam scorer. It prints a warning on a non-100 vocabulary.
  The exam may not be read on an H model until it counts on the old scale.
- ⚠ **Not a problem inside one run**: `train.py`'s `best-edits` compares checkpoints of the SAME
  vocabulary. Its logged numbers are never set beside the other arm's.

## What the two arms will train and select on (measured 2026-09-16, before upload)

From `train.py`'s own data section, run to the model load on the Mac with the kit's flags:

| | value |
|---|---|
| real pool `strips_h1` | 4,456 rows → **4,014 train × 4 / 442 val** (the 4 labels over 99 old ids are removed inside the zip, so the uploaded pool is 4,452) |
| real share of stage-2 draws | 16,056 of 52,088 = **30.8%** (`:5` would be 35.8%; Run A 32.9%) |
| synthetic `strips_v7_final` train | 36,032 strips (every 8,799 / carry 27,233; every-share → 0.15) |
| exam-disjointness | 601 real pieces, **0** in the 33-piece exam; the exam also shares **0** pieces with the synthetic set |
| selection pools | `_realval_v2r` 260 + `_tupletval` 28 = 288 → **259** after leaving out **29** strips of **5** songs that are in the synthetic TRAIN split (19 + 10). (On the unrepaired `_realval_v2`: 295 → 266) |
| selection labels needing ≥ 60 decode steps | **17 of 288** under old ids (longest 82); **0** under H (longest 50) — hence a cap of 100 for both |
| the upload | `data/colab/tnc_round4_colab.zip`: **815 MB** (854,222,642 bytes), 45,578 files, `unzip -t` clean; real manifest **4,452** rows, selection manifest **260**; no exam strips |
| `strips_h1` longest label | **105** old ids / **51** H ids; over 99 old ids: **4** |

Re-measured 2026-09-16 on the repaired `_realval_v2r`, running `train.py`'s data section to the
model load for both vocabularies: both start, and every row above holds.

## Results

### ⛔ The vocabulary A/B is a NULL (2026-09-17)

`paired_arm_score.py --score-vocab old` on `_realval_v2r`, 260 strips, each arm's `best-edits`
(control step 2,750, H step 3,250). Run on the Colab L4; JSON at
`MyDrive/tnc/r4-read/paired_realval_v2r.json`.

| | edits (old ids) | per strip | exact |
|---|---|---|---|
| control (old vocabulary) | 377 | 1.45 | 192 / 260 = 73.8% |
| H | 397 | 1.53 | 187 / 260 = 71.9% |

- mean difference (H − control) **+0.077 edits/strip, 95% CI [−0.069, +0.231]**; median 0.
- H better on **18** strips, worse on **21**, tied on **221** — exact sign test **p = 0.749**.
- ⭐ **What the interval rules out**: an H gain bigger than **0.069 edits/strip (~4.8% of the
  control's corrections)**. It does NOT rule out H being up to 0.231/strip (~16%) worse. The point
  estimate leans to the control.
- ⚠ Both picks were chosen on 241 of these 260 strips, so both are slightly flattered — the same way.

**By error kind and length** (`error_taxonomy.py`, LABEL-TOKEN counts — not the edit scale above;
buckets in old ids for both):

| | control | H |
|---|---|---|
| short+mid (217 strips): exact | 163 (75.1%) | 160 (73.7%) |
| short+mid: token edits / imperfect strips | 171 / 54 | 173 / 57 |
| **long ≥ 50 ids (43 strips): exact** | **29 (67.4%)** | **27 (62.8%)** |
| long: token edits / imperfect strips | 30 / 14 | 35 / 16 |
| exact by bucket short / mid / long | 82/99 · 81/118 · 29/43 | 79/99 · 81/118 · 27/43 |

- ⛔ **H did not help the long strips** — the band this round watched. 2 strips of 43, not separable.
- Categories (short+mid, raised counts) move in both directions and none separates at these sizes:
  signature 46 → 38, accidental 18 → 23, note-extra 24 → 28, pitch 14 → 17, tuplet 8 → 5.
- ⚠ The same pages lead both models' error lists (`bak_yine_gecti_bahar_gul_n_eylesin` supplies
  examples in most categories for both), and 221 of 260 strips tie: the errors follow the page, not the
  vocabulary.
- ⚠ **Not comparable with Round 3's reads** (656 edits / 69.1% for Run A): those were on the
  unrepaired `_realval_v2`. Whether Round 4's package beats the live model is its own paired read.

### Round 4's control against the LIVE model (2026-09-17): a lead, NOT a win — the gain shrinks to a null once the pick is fair

`paired_arm_score.py --score-vocab old` on `_realval_v2r`, 260 strips: control
`r3-r3a-stage2-best-real` (the model on the site), arm `r4-ctl-stage2-best-edits`. Both old vocabulary.
JSON at `MyDrive/tnc/r4-read/paired_live_vs_ctl.json`.

| | edits | per strip | exact |
|---|---|---|---|
| live — Round 3 Run A `best-real` | 409 | 1.57 | 187 / 260 = 71.9% |
| Round 4 control `best-edits` | **377** | **1.45** | **192 / 260 = 73.8%** |

- mean difference **−0.123 edits/strip, 95% CI [−0.235, −0.023]** — the interval clears zero; median 0.
- better on **21** strips, worse on **9**, tied on **230** — exact sign test **p = 0.043**.
- ⭐ **The first paired read since Round 2 whose interval excludes zero** (Run A 656 vs 667 and Run B
  645 vs 667 were both nulls, on the unrepaired pool).
- ⛔ **SELECTION BIAS, NOT YET REMOVED.** `best-edits` was chosen as the lowest of 16 readings on 241 of
  these 260 strips; the live model's `best-real` was chosen on a different pool. In the arm's own log
  the pick read **396** against **405–425** at the other evals from step 2,000 (**410** at `last`) — about
  **14 edits of optimism, a rough estimate**. Taking that off the 32-edit gap leaves ~18 (~−0.07/strip),
  whose interval would likely include zero. ⏭ The clean check is `r4-ctl-stage2/last` — the final step,
  chosen on nothing — against the same live model.
- ⚠ **Several things changed at once**: the corrected, larger real pool (`strips_h1`), the `:4` repeat,
  the correction-based picker, and the repaired picking pool. A win, if it holds, belongs to the
  package, not to one lever.

**The unbiased check — `r4-ctl-stage2/last` (chosen on nothing) against the same live model:**

| | edits | per strip | exact |
|---|---|---|---|
| live — Round 3 Run A `best-real` | 409 | 1.57 | 187 / 260 = 71.9% |
| Round 4 control `last` | 392 | 1.51 | 192 / 260 = 73.8% |

- mean difference **−0.065 edits/strip, 95% CI [−0.169, +0.038]** — spans zero: ⛔ **a NULL**; median 0.
- better on **21**, worse on **10**, tied on **229** — exact sign test **p = 0.071**.
- ⭐ **The selection-bias estimate held**: `best-edits` read 377 and `last` 392 on this pool, 15 edits
  apart against the ~14 estimated from the training log; the ~18 edits predicted to remain came out 17.
- **What it rules out**: Round 4's control being worse than the live model by more than 0.038/strip
  (~2.4% of the live model's corrections). A gain up to 0.169/strip (~11%) stays possible. Every
  reading leans to Round 4 — 21 vs 10 strips, 192 vs 187 exact — which is a **lead, not a finding**.
- ⚠ Both reads use `_realval_v2r`, whose ±~0.1/strip interval cannot separate gains under ~7%. An
  independent pool — the exam or the hand-test pages — is what can settle it.

## ⛔ EVERY READ ABOVE MISSED THE ROUND'S OWN TARGET (owner, 2026-09-18)

*"Our purpose in this round is to gain the overbudget strips. We do not measure them."* Correct, and
measured the same day with the old tokenizer over each pool's labels:

| pool | strips | over the old 59-id gate | share |
|---|---|---|---|
| `_realval_v2r` — what all three paired reads used | 260 | **15** | **5.8%** |
| `_tupletval` | 28 | 2 | 7.1% |
| **`strips_h1` held-out side** | **442** | **64** | **14.5%** |
| `strips_h1` train side (for reference) | 4,014 | 496 | 12.4% |

So the A/B that decided "H is a null" was read on a pool that is almost free of the material H exists
for, and the same is true of both live-model comparisons. **A null on 5.8% dense material is not an
answer about dense material.**

### The pools built for it (`scripts/rung3/build_denseval.py`, 2026-09-18)

- **`_denseval_h1`** — all **442** held-out strips of `strips_h1`: 139 under 30 old ids, 186 at 30–49,
  53 at 50–59, 63 at 60–99, **1 at ≥100**.
- **`_denseval_h1_dense`** — the **117** strips over 49 old ids, of which **64 (54.7%)** clear the old
  gate: the class the round opened for, at ten times `_realval_v2r`'s concentration.

**Why it is fair to all three models**, checked before building: `is_real_val_piece` is deterministic,
so these 61 pieces are val-side in every pool at `--real-val-frac 0.10` — **0** of them sit on
`strips_b8`'s train side, so the LIVE model never saw them either; **0** exam pieces; and neither
Round-4 arm's `best-edits` was picked here (that selector read `_realval_v2r` + `_tupletval`).
**68** of the 442 strips do not exist in `strips_b8` at all — they are what H and the rail rescued.
⚠ Caveats to quote with it: 44 of the 61 pieces also appear in the picking pool as OTHER strips, so
this is held-out strips rather than a fresh corpus; the labels are the owner's reads, whose `\sig`
block can still be a model vote; and it is **not** the exam — never page-complete, never one-shot.
⚠ **1 label costs ≥100 old ids**, which an old-vocabulary model cannot emit at all at `max_length`
100. That is a real H advantage and a guaranteed control loss, so it is counted apart, never inside a
headline.

⏭ **Unread.** Four paired reads are staged in the notebook: H against the control, and Round 4's
control (`last`) against the live model, on the dense pool and on all 442.

### The dense read — four paired reads, run on the Mac (2026-09-19)

Both Round-4 arms and the live model over `_denseval_h1_dense` (117) and `_denseval_h1` (442), all in
old ids, `--score-vocab old`. Tables in `data/real/rung3/r4read/`. **~2 min for four model decodes of
117 strips on the M4's GPU** — the earlier "15–25 min, and an hour for 442" estimate was wrong by an
order of magnitude; price a paired read at ~0.25 s/strip/model, not minutes.

| read | pool | edits | per strip | 95% CI | sign test |
|---|---|---|---|---|---|
| H − control | dense 117 | 42 vs **35** | +0.060 | [−0.043, +0.171] | 4 / 7, p = 0.549 |
| H − control | all 442 | 76 vs **69** | +0.016 | [−0.020, +0.054] | 12 / 13, **p = 1.000** |
| Round 4 `last` − live | dense 117 | **35** vs 48 | **−0.111** | **[−0.291, −0.009]** | 6 / 1, p = 0.125 |
| Round 4 `last` − live | all 442 | **71** vs 80 | −0.020 | [−0.079, +0.029] | 13 / 7, p = 0.263 |

⭐ **THE DECOMPOSITION IS THE FINDING.** Subtracting the dense rows from the 442 leaves 325 short and
medium strips:

| | short+mid 325 | dense 117 |
|---|---|---|
| control / H | 34 / **34** | **35** / 42 |
| live / Round 4 `last` | 32 / 36 | 48 / **35** |

- **H is exactly level on short and medium strips (34 vs 34) and 7 edits worse on the dense ones.**
  Not significant, and the opposite direction to the round's hypothesis. ⛔ On the material H was
  designed for, it did not help.
- ⭐ **Round 4's whole advantage over the live model sits in the dense strips**: −13 edits there,
  +4 on the rest. The round's data work paid where it aimed. ⚠ The dense interval clears zero while
  its sign test does not (6 better / 1 worse) — **suggestive, not proven**, the same split-verdict
  rule Run B's `last` was read under.
- ⚠ **Absolute rates here (0.16–0.41/strip) are NOT comparable with `_realval_v2r`'s (1.45–1.57)**:
  this pool's labels come from the pipeline the models trained on, and its strips passed the `nd`
  acceptance gate — which is built on the live model's own ancestor, so it should flatter the live
  model, not Round 4.

### ⭐ Where scheme H still has a case, and it is not an accuracy one (2026-09-19)

Tokenized every one of the **15,711** candidate strips the emitter priced on real pages, in both
vocabularies:

| label longer than | old ids | H ids |
|---|---|---|
| 59 (the retired gate) | 25.29% | 3.14% |
| 80 (today's gate) | 10.56% | 0.90% |
| **99 — `decode.ts`'s `MAX_TOKENS` and `collate`'s cliff** | **5.91%** | **0.30%** |
| median / max | 42 / 344 | 24 / 192 |

⭐ **About 1 real strip in 17 cannot be emitted at all by an old-vocabulary decoder; under H it is 1
in 333** — a ~20× cut in the class that produces the app's silently-wrong dense pages
([METRICS-DENSE.md](METRICS-DENSE.md)). ⛔ **No gold pool can show this**: the emitter dropped exactly
those strips, so they have no labels, and every pool above tops out under the cliff. It is a
structural argument from lengths, not a measured accuracy gain.
⚠ **H is not the only fix for it** — the app-side label-budget rail cuts dense crops smaller instead,
and needs no vocabulary change ([BACKLOG.md](BACKLOG.md) item 0). Neither has been measured on pages.

