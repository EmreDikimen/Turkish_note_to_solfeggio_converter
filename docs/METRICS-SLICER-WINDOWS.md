# Slicer windowing and the crop frame — measured

purpose: the single home for the LABEL BUDGET — the rail that decides whether the model can express a strip at all, why the shipped app has none, and what the `?dense=` experiment measures
audience: agents and the owner, before changing the windowing constants or the strip frame

updated: 2026-09-07

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-17 when that file crossed the 400-line
cap, and split again on 2026-08-22 — [METRICS-SLICER-FRAME.md](METRICS-SLICER-FRAME.md) took the
settled retune and crop-frame work. The remaining genre is narrow on purpose: **the label budget**,
the only cutting question still open. How a page becomes an ink mask stays in
[METRICS-SLICER.md](METRICS-SLICER.md). Nothing is duplicated.

⚠ **Do not patch `page_to_strips.py` from reading this.** Two fixes written that way were reverted on
2026-07-28 (one was dead code, one was contradicted by the slicer's own manifests), and the 2026-07-29
windowing retune overturned its own premise once measured. Measure against real output first.

⚠ **The crop-geometry rails are a Round-3 lever and they are NOT shared with the renderer.**
`MEASURES_PER_STRIP` / `MAX_STRIP_W` (both env-switchable: `OMR_MEASURES_PER_STRIP`,
`OMR_MAX_STRIP_W`) cut real pages; the renderer packs synthetic strips by measures and label tokens
with no width rail at all. See [rung3/levers.md](rung3/levers.md), Lever 1.

## The label budget is a PRODUCT bug, not a labelling one (2026-08-22)

⛔ **The app hands the model strips it cannot express, and nothing says so.** The browser slicer packs
up to `MEASURES_PER_STRIP` measures with a width rail and **no label-budget rail at all** — budget mode
was deliberately not ported (`apps/web/src/omr/slicer/windows.ts`, module doc). At training time an
over-budget strip is *dropped*; at inference there is no drop, so the model returns a short, confident,
wrong read.

**The safety net does not catch it.** `hitCap` warns the user when the decoder stops at the cap. Scored
against 4,012 strips whose true label exceeds the budget: **it fires on 7 of them (0.2%).** The model
does not run out of room — it emits `</s>` early with normal confidence. So the failure is **silent**.

**How widespread.** Over the 1,689 pages the b8 emit touched: **998 (59.1%) carry at least one
over-budget strip**; the median affected page carries 3.

### Why the rail was shelved, and why that reasoning does not transfer

Budget mode was measured in July for **labelling yield** and came back a wash — healthy-band share
75.8% legacy vs 76.2% at b=62 — so it defaulted off and was left out of the port. That evaluation is
still correct for what it asked. It does not transfer, because the trade inverts:

- **Training**: cutting too eagerly costs labelling yield, and the gain measured nil.
- **Inference**: cutting too eagerly costs decode time. Cutting too little costs wrong notes.

And an over-eager cut is nearly free: **77.4% of real windows (26,284 of 33,937) are already a single
measure**, so a split strip is the shape the model saw most.

### The pixel estimate cannot GATE, but it can trigger a split

Scored against 7,967 strips with exact id counts (4,012 over-budget drops, which record their length,
plus 3,955 accepted labels):

| detector | catches | needlessly cuts good strips |
|---|---|---|
| `est_tokens > 59` | 40.9% | 6.3% |
| `est_tokens > 45` | 77.7% | 32.8% |
| decode length `> 52` | 68.0% | 9.6% |
| `hit_cap` | 0.2% | 0.0% |

Estimator error (true minus estimate) has **sd 30.6 ids**, worst underestimate **+307**. Disqualifying
for a gate. Acceptable as a split trigger, where a false positive costs only time.

⚠ **A large share of that apparent error is not error.** Against the densest measure a human ever
wrote in the exam queue (66 ids/measure, n=184 uncensored labels), **1,537 of 4,012 over-budget drops
(38.3%)** claim more music than the crop can physically hold — a misaligned label, with the estimator
correctly disagreeing. One claims 344 ids over 2 measures against an estimate of 37.

### What splitting to single measures actually buys

| | |
|---|---|
| over-budget windows (excluding width-splits) | 4,012 |
| of those, multi-measure | 2,140 |
| **fixed by splitting into single measures** | **1,779 of 2,140 = 83.1%** |
| still over even as single measures | 361 |
| already single-measure, so unsplittable | 1,872 |

So splitting rescues **44.3% of the whole failure class**. The rest needs a different lever.

### First experiment — `Kurdilihicazkar_sirto_kemani_sebuh_ney_p1` (2026-08-22)

A worst case: **13 of its 15 windows already carry `budget_risk: true`**. Decoded with
`round2-stage2-best` int8, `OMR_ORT_THREADS=2`, `nice -19`:

| config | strips | decode | decodes over 59 ids | longest |
|---|---|---|---|---|
| baseline (shipped rule) | 15 | 6.3 s | 13 | **96 ids** |
| `OMR_WINDOW_MODE=budget`, b=50 | 28 | 10.4 s | 7 | 70 ids |
| `OMR_MEASURES_PER_STRIP=1` | 28 | 10.6 s | 7 | 70 ids |

**+65% decode time**, and per-strip cost *fell* (417 → 371 ms) because shorter strips emit fewer
tokens. On a control page with 0 windows at risk (`her_gordugu_periye_gonul_muptela_olur_nota_p2`) all
three configs give **16 strips, 5.6 s** — identical. The cost is paid only where it is needed.

**Quality, on row s05**: the baseline reads the key signature as two `\kucukFlat` where the page has
three (the split read gets all three, matching the owner's hand-checked label on `s06_w00`), and emits
`\tup3 … \tup3` with no closing `\tupend`. The split read closes every group, and `min_logprob` on
the later strips improves to −0.04 / −0.01 against −0.50 / −0.62.

⚠ **NOT a result.** One page, one row inspected by eye. `?dense=<ids>` is in the app as an opt-in
path to look at, not to quote.

### The rail's browser-vs-Python parity is CLOSED (2026-08-22)

It was the blocking item: without it, every dense number measured something the training pipeline
does not do. `slicer_ref.py --token-budget N` now runs the Python control under the same rail, so
the reference fixes the **packing rule** as well as the sample, and `parity:slicer` refuses a
reference that mixes the two. Both arms, **132 pages / 813 rows**, `--inject-skew`:

| | shipped rule | budget rail, b=50 |
|---|---|---|
| W4 staff count / scale | PASS 120/120, 813/813 | PASS 120/120, 813/813 |
| W5 bar count per row | PASS 812/813 | PASS 812/813 |
| strip count exact per page | PASS 119/119 | PASS 119/119 |
| window fields exact | PASS 2,250/2,250 | PASS **2,459/2,459** |
| `row_x0`/`row_x1` exact | 2,250/2,250 | 2,460/2,462 (99.92%) |
| `est_tokens` stem counts agree | n/a — not computed | PASS **2,459/2,459** |
| `est_tokens` exact | n/a | 2,431/2,459 (98.86%) |

**The rail cuts the same crops in both languages.** The legacy column is the control and confirms
the shipped path was not disturbed by porting the cost features.

⚠ **`est_tokens` is gated at half a stem (0.94 ids), not exact, and the worst observed difference
was 0.39 ids = 13.7 ink columns.** The estimate is `1.889 x stems + 0.0288 x inked_columns`: a stem
is an unbroken vertical run over ~2 staff spaces and the browser's ±1 grayscale difference cannot
create or destroy one, while an inked *column* is one pixel's worth of ink and flips freely at the
Otsu threshold. So the bar proves the **stem counts are identical** and charges nothing for the
residue that the row pixel-sum drift has always reported as never zero. Design and its trap:
[mvp/slicer-port.md](mvp/slicer-port.md).

⚠ **Parity is not accuracy.** It says the browser does what Python does. Whether the rail produces
*better notes* is the measure-fill read below, and it is a separate question.

## The `?dense=` experiment moved out (2026-09-07)

Everything about **`?dense=50`, its wash, and the two ways it was asked again** — the
measure-fill instrument, the 117-page read, the gradient that DOES exist and is not the token
budget, and the budget VALUE that was never chosen — now lives in
[METRICS-DENSE.md](METRICS-DENSE.md). That is the product-side question: what a rail does for a
reader's page. This file keeps the training-side budget.

## HOW FAR over budget, and what 59 actually costs (2026-08-25)

⭐ **The framing "the model chokes on a dense strip" is wrong, and the distribution says so.** Over
**11,844 real strips** (600 cached page decodes under `strips_v2`, `n_ids` read off the decode, no
re-decoding):

| | |
|---|---|
| decode longer than the 59-id budget | **1,737 (14.67%)** |
| of those, **median** | **67 ids** — 8 over |
| p90 / max | 81 / 100 |
| ran to the hard decode limit (`hit_cap`, 100 ids) | **4 of 11,844 (0.03%)** |

**60% of the over-budget strips sit in the 60–69 band.** The model is not being truncated: 59 is not
an inference limit at all, it is the **emitter's drop rule** (`MAX_IDS` in `audit_coverage.py`), and
the decoder's own ceiling is 100, which essentially nothing reaches. ⭐ So the cost of 59 is **14.7%
of the real training strips thrown away** — a data-volume problem, not a model-capacity one. Read
[BACKLOG.md](BACKLOG.md) item 7 that way. ✅ The geometry-only estimate agrees with the decodes to the
decimal (14.7% estimated over 200 pages vs 14.67% measured here), so `estimate_tokens` can be used to
price a packing change without decoding anything.

## The packer is GREEDY, and on a real row a better cut existed (2026-08-25)

Owner-reported: *"the last strip of row 3 is very narrow, so the model reads it badly"*, on a clean
neyzen.com page (`nihavend longa garip okunuyor`, kept in
`data/real/debug/badcrops_2026-08-25/03-son-slicer/`). `window_measures` packs left to right, taking
measures while they fit the width rail, and never looks at what that leaves for the rest of the row.
Row `s02` holds 4 measures of **906 · 703 · 612 · 324 px**. Every legal packing:

| packing | strips (width, est_ids) | legal |
|---|---|---|
| **1\|2\|1 ← chosen** | (906, 43.2) **(1315, 69.9)** (324, 15.5) | ❌ middle strip over budget |
| **1\|1\|2** | (906, 43.2) (703, 38.0) (936, 47.4) | ✅ **nothing narrow, nothing over** |
| 1\|1\|1\|1 | (906,43) (703,38) (612,32) (324,15) | ✅ but 4 strips |
| 2\|2 | (1609, 81.2) (936, 47.4) | ❌ width rail |

**One greedy choice produced both harms on one row** — the runt *and* the over-budget strip — while a
3-strip packing existed that had neither. A balanced (DP) packer is cheap: 4–7 measures a row.

⛔ **NOT FIXED IN THE SLICER (owner, 2026-08-25), and the reason is cost, not doubt.** It moves crop
boundaries, so it stales every labelled pool and the 455 human verdicts on `examv3`; the final render
rebuilds the training set anyway, so the same ground is cheaper to test at TRAINING. Round 4, with
the rail.

⚠ **Two candidate explanations were measured and BOTH FAILED**, which is why the packer is the
remaining one:

- **"the merge rule should catch it"** — it already exists (`MIN_STRIP_W` = 200 px, merge into the
  previous window) and cannot fire here: the runt is 324 px, and merging it anyway gives 1639 px
  against the 1435 cap and 85.4 ids against 59. Raising the threshold converts runts into
  over-wide, over-budget strips, which are dropped.
- **"training will cover it"** as a data gap — it is not one. Synthetic `strips_v5_tupnew` is
  **6.5%** strips under 600 px (n=6,000 sample) against **3.5%** in the real pools (`strips_b8`,
  n=3,955): the model has seen *more* narrow strips than it meets. Nor are real narrow crops unusual
  in content — repeat/nav tokens appear in 21–25% of their gold, against 19–32% at every other width.
  What they *are* is end-of-row: **61% of crops under 600 px are the last window on their row**,
  against a 35% baseline.

⚠ **Narrow crops do cost, and here is the size of it.** Over the 455 human verdicts on `examv3`,
crops under 600 px are marked `bad` (the crop itself unusable) **19% of the time against 8% overall**
and 4–9% in every other width band. n=54, so it is a signal, not a rate.

## HOW LONG LABELS REALLY ARE, AND WHY THE BUDGET IS 80 UNDER H (2026-09-07)

`budget_tail_probe.py`, free — it tokenizes labels that already exist and counts ids. It reads
`emit_responses.json` and NOT the manifest, because the manifest holds only the strips that passed
and the whole question is about the ones the budget threw away.

⚠ **59 was never a model limit.** It is `audit_coverage.MAX_IDS`, the emitter's quality gate. The
model's real ceiling is **100**, in two places at once: `MAX_TOKENS` in `apps/web/src/omr/decode.ts`
and `collate(max_len=100)` in `data.py` — which **truncates a longer label at 99**, teaching the
model to stop early, which is the failure this round exists to remove.

`strips_b8`, all **15,758** serialized labels (the 4,012 the gate dropped included):

| | old | scheme H |
|---|---|---|
| median ids | 42 | **24** |
| p95 | 105 | 53 |
| max | 344 | **192** |
| > 59 ids | 4,012 (25.5%) | **504 (3.20%)** |
| > 80 ids | 1,674 (10.6%) | **148 (0.94%)** |
| > 85 ids | 1,407 (8.9%) | 106 (0.67%) |
| > 100 ids | 917 (5.8%) | 45 (0.29%) |

⭐ **The tail is real music, not an alignment artefact**: `MEASURES_PER_STRIP` is 3, and all 148
strips over 80 cover three measures or fewer. ⭐ **On the 579 labels the owner hand-typed into
`examv3`'s review queue the longest H label is 67 ids** — nothing there reaches even 70, and only 2
rows (0.35%) pass 59. Those are the hardest crops in the project by construction, which is what
makes a budget of 80 safe rather than optimistic. Three of them, the ones the owner named:

| strip | old ids | H ids |
|---|---|---|
| `Kurdilihicazkar_sirto_kemani_sebuh_ney_p1_s03_w01` | 92 | **57** |
| `..._p1_s05_w00` | 99 | **61** |
| `..._p1_s06_w00` | 131 | **67** |

⭐ **The budget is 80 under H** (owner, 2026-09-07 — [DECISIONS.md](DECISIONS.md)): it admits 15,610
of 15,758 (99.06%), leaves the rail **148** windows instead of 504, trains **356 dense strips whole**
that would otherwise be halved, and keeps 20 ids of margin under the truncation cliff.

⚠ **One number step 6 has to answer for**: of those 15,610 strips, **769 (4.93%) cost more than 100
ids under the OLD vocabulary**. The control arm cannot hold them at all, so the planned A/B's "same
pools, one variable" is not achievable as written.

## WHAT THE RAIL DOES WHERE THERE IS NO GOLD — nothing, and that is the design (2026-09-07)

The owner's question: a strip with no gold label has no known id count, so how is it decided to be
over budget? **It is not.** The plan prices only windows whose label exists, and `Rail.page()`
answers **False** for a range it never priced — an unknown range is "leave it alone", never a guess.
That is what confines a re-cut to windows measured to need one.

**Who has no gold, in the b8 emit** (33,530 crops over 1,704 pages):

| | strips | why it has no label |
|---|---|---|
| labelled | **15,758** | the piece matched SymbTr and its row aligned |
| `split_wide` | 10,226 | cut at a whitespace gutter INSIDE one measure — it carries no whole measure, so no label can be derived for it |
| `row_unaligned` | 7,446 | the row's decode did not match the SymbTr reference |
| `empty_range` / `missing_pages` | 100 | — |

⭐ **None of them is training data either way**, so the rail declining to touch them costs nothing.

⚠ **But every number on this page describes the LABELLED population**, so it is worth asking whether
the unlabelled half is denser — if it were, the over-budget rate would be understated. Checked on the
model's own decode length: `row_unaligned` reads **median 40 / mean 41.5 / p90 68** ids against the
labelled strips' **40 / 41.9 / 66**, and `split_wide` is shorter still (36). No visible difference.
⚠ The proxy is itself biased short — an over-budget strip is exactly where the model stops early —
so this is "no evidence of a denser tail", not "there is none".

### The place where it really bites is the APP, and no signal there is good enough

At inference there is no SymbTr, no label, no gold — which is why the shipped slicer has **no rail at
all** ([BACKLOG.md](BACKLOG.md) item 0). Two gold-free signals exist and both were priced:

- **`est_tokens`, the slicer's own ink estimate.** Measured 2026-09-07 over 40 pages re-sliced and
  paired to their gold **by measure span** (453 strips): correlation with the true H id count is
  **0.67**, and it is biased **+16 ids** (median 37 against a true H median of 21) — it was fitted on
  decode lengths in the OLD id space, so under scheme H it over-predicts by construction. ⛔ It cannot
  gate as it stands; it would have to be refitted against H labels first.
- **`hit_cap`, the model's decode reaching its ceiling.** It fires on **0.05%** of labelled strips.
  The failure mode is the model stopping EARLY and confidently, not running long, so this signal is
  looking for the opposite of the bug.

## The rail's emitter half, verified on a real page (2026-09-07)

Round 4's rail is now end to end: the emitter prices the ranges (`--rail-plan` → `emit_rail.json`)
and replays them as the slicer's `oversize` callback (`--rail`). Read on **one** piece —
`nikriz_sirto_refik_fersan`, 3 pages, 63 strips, crops written to a scratch root so no pool was
touched. ⚠ **n = 1 piece. It verifies the MECHANISM; it prices nothing.** The pool-level numbers
stay the ones the b8 emit and the token probe measured.

| arm | over-budget windows | accepted strips |
|---|---|---|
| `--vocab old` (today's gate) | 18 | 28 |
| `--vocab h` (scheme H, no re-cut) | **0** | 40 |
| `--vocab old --rail` (the plan applied) | **0** | 54 |

⭐ **The owner's rule holds where it matters.** Slicing that page twice — once plain, once with the
plan — the two cuts share **19 measure spans, and all 19 crops are byte-identical**; 9 windows were
split into 18, and the page went 28 → 37 strips. ⚠ **8 of those 19 identical crops carry a different
`_wNN` name**, which is the renumbering trap in one number: a strip filename survives a re-cut and
its pixels do not, so pools join by measure span (`carry_old_fixes.py`), never by name. The manifest
marks a re-cut strip with `split_from`.

## THE POOL-LEVEL READ: scheme H at a budget of 80, on frozen crops (2026-09-07)

Round 4 step 5, run for real — `strips_b8` re-emitted as **`strips_h1`** with `--vocab h
--frozen-crops`, the same 1,720 decode caches and **not one page re-sliced**. Compare against b8's
own emit, which is the same corpus under the old vocabulary at 59.

| | b8 (old, 59) | h1 (H, 80, frozen) |
|---|---|---|
| accepted | 3,955 | **4,435** |
| review | 4,738 | 6,434 |
| **dropped `over_budget`** | **4,012** | **141** |
| dropped `nd_high` | 3,053 | **4,701** |
| dropped `split_wide` / `row_unaligned` | 10,226 / 7,446 | 10,161 / 7,423 |

⭐ **THE BUDGET STOPPED BEING THE BINDING GATE, AND THE REFEREE BECAME IT.** The over-budget class
collapsed as predicted (4,012 → 141, against the 148 the token probe forecast). But of the ~3,871
strips that came back, only **+588 reached training**: ~1,739 went to review and ~1,648 were dropped
as `nd_high` instead. ⛔ **So the round's standing "3,508 rescued → pool 7,437" is WRONG as a yield
claim** — it priced the budget gate alone. A strip over the budget is a DENSE strip, and the
disagreement gate asks the referee (`round2-stage2-best`) to read exactly the material this round
opened because the model reads it badly. After promotion the pool is **4,425 rows** against b8's
3,929: **+12.6%**, not +89%.

⚠ **The gain is aimed where it was meant to be, which the yield number alone hides**: the 588 new
accepted strips carry a median of **18 label tokens against 11** for the rows b8 already had.

⛔ **A BETTER REFEREE DOES NOT FIX IT — MEASURED, AND IT IS A NULL.** The obvious move is to swap
the referee for `r3a-stage2-best-real` (the live model, the owner's hand-test pick), which is fair
on this material for a provable reason: the over-budget strips were never in training, so it cannot
have memorised them. `redecode_strips.py --frozen-crops` re-reads the existing crops with another
checkpoint and slices nothing. Pilot on **12 pieces / 597 strips**, the pages carrying the most
rescued-then-dropped strips:

| pilot | accepted | `nd_high` | `row_unaligned` |
|---|---|---|---|
| referee `round2-stage2-best` | 33 | 241 | 103 |
| referee `r3a-stage2-best-real` | **32** | **234** | 109 |

r3a read **228 of the 597 strips differently (38.2%)** and moved acceptance by one strip. ⚠ n = 12
pieces: this rules out an effect at the scale the rescue needs, not a small one. The cost it saves
is real — a full referee swap is ~1,720 pages of inference.

### What the budget is actually worth in this pool

Measured over h1's 4,425 promoted labels with both tokenizers:

| | scheme H | old vocabulary |
|---|---|---|
| median ids | 22 | 38 |
| longest label | **51** | 105 |
| over the 80 gate | **0** | — |
| over 99 (`collate`'s truncation cliff) | — | **4** |
| over 59 (b8's gate) | — | 549 |

⭐ **The 80-id budget binds nothing here** — the longest H label is 51. The pool's growth is the 549
labels that cost more than 59 old ids, and the ceiling that matters for step 6's control arm is
**4 rows**, not the 769 the pre-emit estimate gave: dropping them from both arms makes the A/B clean
at negligible cost.

### Why the crops were frozen, in one number

A full re-emit would have re-sliced every page under the 2026-09-03 CV fixes. Measured on **30 b8
pages** re-cut and compared byte-for-byte against `strips_v2`: **20 of 30 pages cut differently**,
451 of 632 crops (71%) byte-identical, and **of the strips carrying a LABEL, 138 of 163 (84.7%)
survived — 15.3% changed pixels**. A verdict is given against pixels, so that is ~600 reads
invalidated across the pool. The owner's call (2026-09-07): keep them, they were cut and read
correctly. Hence `--frozen-crops` and route C+ in [rung3/round4.md](rung3/round4.md).

## The 2026-07-29 retune and the crop frame moved out (2026-08-22)

Everything about **which constants were swept and why none of them moved** — the
`MEASURES_PER_STRIP` sweep and the two bugs found under it, the budget-mode labelling-yield wash,
the whole-page spot check — plus the **vertical crop frame** (the low-beam fix, the floating staff)
and the **shared-edge trim** now lives in
[METRICS-SLICER-FRAME.md](METRICS-SLICER-FRAME.md). Those questions are closed; this file keeps the
one that is open.
