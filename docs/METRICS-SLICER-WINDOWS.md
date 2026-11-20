# Slicer windowing and the crop frame — measured

purpose: the label budget and the windows — the rail, the windowing retune and crop frame, and the opt-in `?dense=` experiment
audience: agents and the owner, before changing the windowing constants or the strip frame

updated: 2026-11-20

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-17 when that file crossed the 400-line
cap, and split again on 2026-08-22 — [METRICS-SLICER-WINDOWS.md](#the-windowing-retune-and-the-crop-frame--measured-and-settled) took the
settled retune and crop-frame work. The remaining genre is narrow on purpose: **the label budget**,
the only cutting question still open. How a page becomes an ink mask stays in
[METRICS-SLICER.md](METRICS-SLICER.md). Nothing is duplicated.

⚠ **Do not patch `page_to_strips.py` from reading this.** Two fixes written that way were reverted on
2026-07-28 (one was dead code, one was contradicted by the slicer's own manifests), and the 2026-07-29
windowing retune overturned its own premise once measured. Measure against real output first.

⚠ **The crop-geometry rails are a Round-3 lever and they are NOT shared with the renderer.**
`MEASURES_PER_STRIP` / `MAX_STRIP_W` (both env-switchable: `OMR_MEASURES_PER_STRIP`,
`OMR_MAX_STRIP_W`) cut real pages; the renderer packs synthetic strips by measures and label tokens
with no width rail at all. See [archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first), Lever 1.

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
[archive/phases.md](archive/phases.md#porting-the-slicer-to-typescript--w4w6).

⚠ **Parity is not accuracy.** It says the browser does what Python does. Whether the rail produces
*better notes* is the measure-fill read below, and it is a separate question.

## The `?dense=` experiment moved out (2026-09-07)

Everything about **`?dense=50`, its wash, and the two ways it was asked again** — the
measure-fill instrument, the 117-page read, the gradient that DOES exist and is not the token
budget, and the budget VALUE that was never chosen — now lives in
[METRICS-SLICER-WINDOWS.md](#the-dense-experiment--the-apps-missing-label-rail-measured). That is the product-side question: what a rail does for a
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
opened because the model reads it badly. ⚠ **That reading was corrected 2026-09-09** — on the 75 `nd_high` rows a human read, the answer is a median of 20 label-token edits from the LABEL and 0 from the decode ([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md#where-an-error-comes-from--the-label-or-the-model)). After promotion the pool is **4,425 rows** against b8's
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
[METRICS-SLICER-WINDOWS.md](#the-windowing-retune-and-the-crop-frame--measured-and-settled). Those questions are closed; this file keeps the
one that is open.

**Merged into this file on 2026-11-20:**

- [The windowing retune and the crop frame — measured, and settled](#the-windowing-retune-and-the-crop-frame--measured-and-settled) — was `docs/METRICS-SLICER-WINDOWS.md`
- [The `?dense=` experiment — the app's missing label rail, measured](#the-dense-experiment--the-apps-missing-label-rail-measured) — was `docs/METRICS-SLICER-WINDOWS.md`


## The windowing retune and the crop frame — measured, and settled

*Was `docs/METRICS-SLICER-WINDOWS.md` (last updated 2026-09-03).*

Split out of [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) on 2026-08-22 when that file
crossed the 400-line cap. The split is by phase, not by size: **this file is settled** — every
question in it was measured to a conclusion and the answer was "do not move it" — while that one
holds the **live** question, the label budget the shipped app has no rail for. Nothing is
duplicated.

⚠ **Do not patch `page_to_strips.py` from reading this.** Two fixes written that way were reverted
on 2026-07-28 (one was dead code, one was contradicted by the slicer's own manifests), and the
2026-07-29 windowing retune overturned its own premise once measured. Measure against real output
first.

### The slicer's windowing was never retuned after the 2026-07-25 fix (2026-07-29)

**The fix itself was right.** The old staff-detection kernel (`w/4`) lost the ends of staff lines,
pushing `x0` **70–490 px right** and cutting off clefs and whole measures (see the comment in
`_emit_staff`). `STAFF_HOR_FRAC = 0.11` stopped that. Measured wins on 158 re-sliced val-side pages:

| | old slicer | current slicer |
|---|---|---|
| crops < 350 px (slivers) | 10.4% | **1.2%** |
| crops > 1200 px | 18.5% | 29.7% |
| median width | 851 px | 1001 px |

**But rows now carry more music, and the windowing constants still assume truncated rows.**
`MEASURES_PER_STRIP = 3` and `MAX_STRIP_W = 1450` predate the fix. Decoding both crop sets with the
**same** model over 6 pages (the earlier n_ids comparison was confounded — the two `decode.json`
caches were written by different models):

| | old slicer | current slicer |
|---|---|---|
| crops | 115 | 116 |
| median decoded ids | 42 | **49** |
| **≥ 59 ids — over the label budget** | **20.9%** | **31.9%** |

The emitter drops those as `over_budget`, so content is captured correctly and then thrown away.
On one re-sliced page the probe emit gave `accepted=3 review=2 dropped=25` of 30, with
`over_budget: 11`.

**Sweep of `MEASURES_PER_STRIP`** (env-overridable; 6 pages; "usable" = crops whose decode fits the
59-id budget):

| measures/window | strips | median ids | over budget | **usable** | median width |
|---|---|---|---|---|---|
| **1** | 138 | 41 | 22.5% | **107** | 848 px |
| 2 | 123 | 46 | 26.8% | 90 | 980 px |
| 3 (current) | 116 | 49 | 31.9% | **79** | 1014 px |

Monotonic — the current value is the worst of the three on usable yield, and 1 measure/window gives
**35% more usable strips**. ⚠ This does **not** mean 1 is the answer: "usable" counts only budget
fit, and ignores that narrower windows carry less context, give the stitcher more pieces to
reassemble, and open a train/test mismatch against a synthetic corpus built at 2–4 measures. It says
the constant is worth retuning, not what to retune it to.

**A second, smaller defect.** `MEASURES_PER_STRIP` is not enforced: the sliver-merge in
`window_measures` checks the width cap but not the measure cap, so a full 3-measure window that
absorbs a sliver becomes 4 or 5. **13 of 3,168** re-sliced strips, none of them `split_wide`. Small,
but it feeds straight into the budget overflow above.

**Unchanged by the overhaul:** the moderate-quality band. Crops at `min_logprob < -0.5` sit at ~10%
under both slicers — the fix removed the catastrophic crops, not the mediocre ones.

#### The windowing retune was RUN (2026-07-29) — the constants are not the lever

The retune above was measured to its conclusion. **Neither `MEASURES_PER_STRIP` nor `MAX_STRIP_W`
is worth moving**, and the sweep that suggested lowering the first was scored on the wrong quantity.
Two genuine BUGS were found underneath it and fixed. Source: `ml/omr/page_to_strips.py`.

**1. Measure count is a poor proxy for the budget that actually drops strips.** Over the 31,968
decoded old-pool strips:

| | |
|---|---|
| strips over the 59-id budget | **11.5%** |
| **SINGLE measures over the budget on their own** | **8.9%** (n=19,895) |
| strips spending ≤ 25 of the 59 ids | **28.6%** |
| ids predicted by strip WIDTH | R² = **0.54** |
| ids predicted by stem count + inked columns | R² = **0.77** (residual sd 8.9) |

The budget is over-run and under-used at the same time. And because 8.9% of single measures blow it
alone, **no `MEASURES_PER_STRIP` value can fix those** — the constant is not the mechanism.

**2. `MEASURES_PER_STRIP = 1` is actively harmful, and the earlier sweep could not see it.** That
sweep ranked settings by "usable yield" (does the decode fit the budget), which improves
monotonically as windows shrink — it cannot charge for the near-empty crops that shrinking creates,
and those carry 20.8% of exam corrections. Re-scored on 16 val-side pages including that cost:

| arm | strips | over budget | near-empty (≤20 ids) | **healthy 21–59** |
|---|---|---|---|---|
| legacy, 3 measures (current) | 326 | 10.4% | 8.0% | **81.6%** |
| **legacy, 1 measure** | 442 | 5.7% | **33.9%** | **60.4%** |

⚠ Estimated ids, not decoded, so the levels are approximate — but the arms share one estimator, so
the ordering holds. **`MEASURES_PER_STRIP` stays at 3.**

**3. Budget-aware packing was built, decoded head-to-head, and is a WASH.** `WINDOW_MODE=budget`
packs measures until the estimated token cost is spent instead of counting measures. Decoded on the
same 16 pages with the shipped `round2-stage2-best` int8:

| | legacy m=3 | budget b=55 m=4 | budget b=62 m=4 |
|---|---|---|---|
| strips | 326 | 338 | 328 |
| over the 59-id budget | 9.5% | 8.0% | 9.1% |
| near-empty (≤20 ids) | 14.7% | **16.3%** | 14.6% |
| **healthy 21–59 ids** | **75.8%** | 75.7% | 76.2% |
| usable strips | 295 | **311** | 298 |
| `min_logprob < -1.0` (bad-crop proxy, 89% precision) | 14.4% | 14.5% | 14.0% |

Its only real effect is **+16 usable strips** bought with **+1.6pp more near-empty crops**. It
**ships OFF** (`OMR_WINDOW_MODE=budget` to enable), so existing decode caches stay valid and the
change stays A/B-able. ⚠ Out of sample the estimator is weaker than its fit: mean signed error
**+3.3 ids**, sd 10.5, and it missed 16 real overflows against 19 false alarms.

**4. Two real cap bugs, found by measuring the pool rather than reading the file.** Both fixed and
verified by re-slicing the 62 affected pages (legacy packing, so only the fixes differ):

| bug | before | after | cause |
|---|---|---|---|
| strips over `MEASURES_PER_STRIP = 3` | 13 / 3,168 | **0** | the sliver-merge checked the width cap but not the measure cap |
| crops over `MAX_STRIP_W = 1450` | 82 / 3,168 | **0** | 22 = the `lead` clef prefix re-extended window 0 *after* the check; 31 = `_split_wide` gutter-shifted cuts overran; 29 = the driver's left pad was added after the check |

Checked invariant across 458 rows / 61 pages: **0 rows changed measure count or coverage** — every
measure is still assigned to exactly one window. Cost: **+7.2% strips on the affected pages**
(over-wide windows now split instead of silently exceeding the trained width).

**5. Decode caches were keyed on `measures_per_strip` alone**, so a packing-rule change would have
slipped straight past staleness detection and mixed two slicers inside one comparison — the exact
confound that spoiled the earlier n_ids read. Caches now carry the full windowing signature
(`window_signature()` / `window_cache_ok()`).

**6. Two source pages collide on one stem — FIXED 2026-07-29, and only one of the two was what it
looked like.** Strip directories are keyed by page stem alone (`<strips_root>/<stem>/`) while page
images are makam-scoped, so two pages sharing a stem silently overwrite each other. The two cases
needed opposite fixes:

| stem | hicaz vs other | what it is | fix |
|---|---|---|---|
| `bir_nigah_et_ney` | PDFs differ; **different SymbTr pieces** — Şekerci Cemil Bey/ağıraksak (hicaz) vs Zeki Arif Ataergin/aksak (saba) | a real collision: two unrelated songs whose titles slugify alike | stems qualified to `bir_nigah_et_ney_hicaz` / `_saba`, both kept |
| `nesem_emelim_ney` | **byte-identical PDF and PNG**; both matched to the *same* SymbTr piece | one neyzen upload filed under two makams | uzzal copy dropped; hicaz kept |

Renaming the duplicate would have been the wrong fix — it puts two copies of one page in the pool,
and near-duplicates on opposite sides of a piece-level split are the leakage `data/split.json`
exists to prevent. The two are told apart by their match target (same symbtr = duplicate, different
= collision), which is what `collect_tuplets.neyzen_stems()` now does over the whole match CSV.
A **full scan found exactly these two** across every page image on disk and every row of the match
CSV, so the class is closed, not just the instances. `emit_strip_labels.py` now refuses to slice
when two pages resolve to one stem.

⚠ **Fallout:** the `strips/` and `strips_v2/` crops for `bir_nigah_et_ney_p1` were cut from an
unrecoverable one of the two pages (both pages are 1653×2338, so provenance cannot be recovered from
geometry) and were **deleted** — they are regenerated by the pending re-slice. The 5 `realval-hard`
verdicts on that stem (3 ok / 1 fix / 1 bad) are void, which the queue rebuild already covers.
`nesem_emelim_ney_p1` crops were **kept**: both sources were byte-identical, so those crops are
well-defined whichever one produced them. The Colab page lists had **both** colliding pages queued
into one strip dir; they are corrected.

#### Whole-page spot check on an unseen screenshot (2026-07-29, n=1)

A neyzen.com screenshot of Kürdîlihicâzkâr Saz Semâî "Meltem" 1. Hâne, run end to end through the
2026-07-29 slicer and the shipped model: 3 systems → 8 strips → 85 events, stitched to 9 measures.
Anecdote, not a measurement — recorded for the two behaviours it exposed.

- **`\tup3` opens and never closes.** The model emits the triplet marker but no `\tupend`, and
  `stitch.ts` reports *unclosed \tup3 at row end closed* and terminates it at the row boundary. The
  recovered 1/24 grouping matches the print, so the output is right by recovery rather than by
  reading. Bears on the `\tup3` arc metric, which is measured on the common k=1 case only.
- **Two scheme limits, not reading errors.** The page opens with four noteheads stacked on one stem
  and is in 10/8; `ADDED_TOKENS` has no chord and no time-signature token, so neither is
  recoverable. Worth stating explicitly before anyone reads a missing chord as a model failure.
- ⚠ **A key-signature "error" reported here first was the reviewer miscounting the print**, not the
  model: the engraving carries three flats (si, mi, la) and the decode read three. Correcting the
  record because the wrong version briefly reached a shared page. The koma *class* (all three read
  as küçük mücennep, 5 komas) was **not** verified against the engraving.

#### The strip frame cut low beams off; the staff now floats inside it (2026-07-29)

The 336 px frame puts the staff at y=138, leaving **4.60 line-spaces above and only 2.60 below**.
Measured on the page before the frame truncates anything, counting only ink connected to the row's
own staff:

| this row's music reaches | p50 | p90 | p95 | p99 | max | frame allows |
|---|---|---|---|---|---|---|
| **below** the staff | 1.76 | 2.68 | 3.01 | 3.80 | 4.07 | **2.60 sp** |
| above the staff | 2.25 | 3.55 | 4.04 | 4.64 | 5.50 | 4.60 sp |

**11.6% of real staff rows lost music at the bottom**, against 1.4% at the top — real engraving
hangs beams lower than our renderer does. Border ink alone is a misleading signal here: 48.6% of
real strips had ink on the bottom border, but splitting it by whether it CONNECTS to the row's
staff, only **5.0%** was this row's music and **43.5%** was a neighbouring system or page
furniture. Synthetic: 1.0% / 9.8%.

**`place_band()` redistributes the frame instead of enlarging it.** Height and the 30 px spacing
are fixed by training and untouched — only the split between headroom and underroom moves, per
row, to fit that row's measured extent. Result on 20 re-sliced pages:

| | fixed 4.6/2.6 | adaptive |
|---|---|---|
| BOTTOM: music cut off | 11.9% | **4.4%** |
| BOTTOM: foreign ink | 47.0% | 52.3% |
| TOP: music cut off | 1.3% | 1.0% |
| TOP: foreign ink | 45.2% | 42.8% |

**⚠ The decode A/B is NEUTRAL, not positive**, and the justification is geometric rather than
measured. On 16 pages the bad-crop proxy reads 13.8% off / 15.0% at a 3.30 sp floor / 15.6% at a
4.10 sp floor. There is **no dose-response** — the gentler shift is not better than the larger one
— so at 326 strips (1–2pp ≈ 4–6 strips) these are noise, not a shift penalty. Kept ON because
clipped beams are destroyed information a confidence proxy cannot see, and because it moves real
crops toward the training distribution (synthetic clips 1.0%). ⚠ **It has not been shown to improve
accuracy** — that needs gold-labelled pages. `OMR_VPLACE=0` disables it;
`OMR_VPLACE_MIN_HEAD` sets the dose.

**Why 4.4% still clips, split by cause (2026-08-05).** Reproduced on 60 real pages / 453 rows, and
the residual is not one problem but two:

| cause | share of clipped rows | fixable by placement? |
|---|---|---|
| the row's music genuinely exceeds the frame (`below` > `total - MIN_HEAD` = 3.9 sp) | **17 of 20** | **no** — only a scale change could, and scale costs 12–15% edits per 1% |
| ink ABOVE outranks it (`place_band` L440 raises `head` to protect the top) | 3 of 20 | yes |

The first group is dominated by degraded scans where the row's ink is connected to lyrics or the
next system, so `row_music_extent` saturates near its own `6*sp` search limit — those rows are short
by a **median 2.31 sp**, which no redistribution of 7.2 sp can supply. The second group is the one a
reader notices: a **slur above the staff** pushes the staff down and shears the beams below, i.e. it
trades ink that carries no duration for ink that does.

**The conflict rule was FIXED, and it did not have to be a trade (2026-08-05).** The first two
candidates both were:

| over 120 pages / 901 rows | ink lost ≤3.5 sp above (real notes) | >3.5 sp above (decoration) | ink lost BELOW (beams) |
|---|---|---|---|
| top wins (the old rule) | **0** | 19,670 | 19,932 |
| bottom first | **500** | 23,681 | 16,193 |
| **top claim capped at 3.5 sp (shipped)** | **0** | 22,763 | **17,231 (−13.6%)** |

Bottom-first was rejected: it saves beams by destroying **500 px of real ledger-note ink**, which is
the harm the rule exists to prevent. Capping what the top may CLAIM does better than both — it loses
nothing the old rule kept inside the ledger-note zone, and takes 13.6% off the beam loss. A notehead
three ledger lines up sits ~3.0 sp above the top line, ~3.5 with its accidental; past that the ink is
a slur, phrase mark, segno or ornament, and the renderer injects slurs as deliberately LABEL-FREE
distractors. By construction it moves only rows ALREADY in conflict, i.e. rows already losing
something, so the downside is confined to crops that were damaged anyway.

`OMR_VPLACE_TOP_CLAIM=99` restores the old uncapped rule exactly, and the slice inspector has it as a
toggle. ⚠ **Still not a decode measurement**: it is an information argument (which ink the model must
read), not an accuracy result, and the affected 2.6% of rows make an A/B underpowered — the same
limit the adaptive placement itself ran into.

⚠ **Correction to how this was justified.** The "vertical placement is free" result (+1% shift →
+0.4% edits) was measured at ~3 px. The adaptive placement shifts up to 39 px, 13x outside that
range, so it does not license the change — hence the direct A/B above.

#### Neighbouring crops no longer overlap (`TRIM_SHARED_EDGE`, 2026-07-29)

Crops carried a `PAD_PX = 6` left margin with no matching right trim, so **74.8% of mid-row strips
overlapped their predecessor by 6 px** and that band was drawn in both. The right edge now gives
back exactly what the next strip's left pad takes.

**The double-counting worry it was raised against is NOT real, and was not the reason to change it.**
A notehead is 22 px and the band is 6 px, so a head cannot fit; measured on decodes, the same note
ending one strip and starting the next runs **1.3%** at overlapping boundaries (2/155) against a
**6.85%** within-strip null for adjacent identical notes — the opposite of duplication. ⚠ Partly
confounded: padded boundaries *are* barlines, and notes repeat less across a barline. ⚠ Two earlier
geometric estimates of this (1.2%, then 7.8%) were both wrong — the first used a test window wider
than the band, the second also fires on beams, which run to the end of a measure. The decode test
is the one to trust.

**What it does fix.** A strip's label never names an edge barline — **0 of 421** real labels start or
end with `|` — but the pixels did:

| share of strips showing a barline at the edge | left | right |
|---|---|---|
| synthetic `strips_v4` (what the model trained on) | 100% | **5%** |
| real crops, before | 49.6% | **61.0%** |
| real crops, after the trim | 49.6% | **22.5%** |

The residual 22.5% is structural — the last strip of a row has no successor to give the pad to, so
it still ends on the system's closing barline. The **left**-edge gap (49.6% vs 100%) runs the other
way and is not addressable from the slicer: row starts open with a clef, and gutter cuts land
mid-measure where no barline exists.

**Decoded A/B, 16 val-side pages, shipped model, crops differing only at their edges — a wash:**

| | trim off | trim on |
|---|---|---|
| strips / decoded notes | 326 / 2,479 | 326 / 2,482 |
| over the 59-id budget | 9.5% | 9.2% |
| near-empty (≤20 ids) | 14.7% | 14.4% |
| `min_logprob < -1.0` (bad-crop proxy) | 14.4% | **13.8%** |
| confident (> −0.1) | 31.9% | 30.7% |
| duplicate note at a boundary | 6/204 | 4/204 |

Overlapping pairs go **195 → 0**, with the same strips, the same measure spans and both caps still
holding — only the crop edges moved. Kept because it removes a structural pixel/label
inconsistency at no measured cost, **not** because it bought accuracy. Switchable via
`OMR_EDGE_TRIM=0`; it is part of the decode-cache signature.

### `TAIL_SPAN_MAX_SP` — the closing barline counted twice (2026-09-03)

Owner-reported from the slice inspector on `nihavendLongaDuzgun`, a neyzen.com engraving of Kevser
Hanım's Nihâvend Longa: the last row is cut at a note stem, and it also emits a junk strip.
**Two unrelated defects**, and only the second one is fixed here.

**The cut at a stem is the known residual and was NOT touched.** Measured on that page, the stem at
page column 1462 runs top staff line → bottom line +3 px, exactly like the real barline at 1068, and
is 2–7 px wide over most of its length. Gate 2 should reject it on the attached notehead and beam —
their ink IS there, **34 px wide against the barline's uniform 6** — but the gate needs `fat_run`
= 0.5 sp of *contiguous* fat rows and gets **8 (the head) and 9 (the beam) against the 15 required**,
because the stem's own column cuts the head near its narrow edge. The shape discriminator that would
catch it was built, read better on hand-marked truth and **cost three times as much on
`score_slicer`** — see [METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md#barlines--where-the-cut-goes), which also carries
the 2026-08-25 fix for the dense-photocopy variant of the same complaint. Unchanged.

⛔ **AND THE WIDTH VERSION OF THE SHAPE RULE WAS TRIED ON 2026-09-03 AND LOST TOO — do not rebuild
it.** The stems on this page carry ink **104–292 px** wide where a plain barline carries 5–11 and a
repeat sign 36–39, a clean gap at ~2–3 sp, so "reject a candidate whose attached run is wider than
N sp at ANY row, with no contiguity requirement" looks obvious. Two things killed it. (1) Gate 2
searches only **±1 line-space** sideways, so it cannot see a 104 px attachment at all — a 2.0 sp
threshold sat just inside that window and behaved wildly (barline recall 48.4% → 10.8%) while 2.5
did literally nothing. (2) Measuring the run on the **full row** instead makes the rule work on this
page (39 → 34 interior bars) and destroys everything else: **recall 48.4% → 8.6%** on the
hand-marked pages, where a faded barline's smeared ink runs the width of the row, and on clean pages
`score_slicer --sample 25` goes **81 → 78 exact rows** with too-few-measure rows **14 → 40**. Tried
at 1.5 / 2.0 / 2.5 / 3.0 / 4.0 sp; no threshold is safe on both. Reverted, uncommitted.

⚠ **What the stem cuts COST is now measured, and it is not cosmetic.** Decoding this page with
`r3b-stage2-last` under both slicings: 8 of 10 rows read identically, and the two that differ show
the damage — the cut at a stem **inserts a false `|` into the token stream** (row 6) and **fabricates
a duration** (row 9: `\bakiyeSharpf''4` where the print has `f''16`). So a stem cut is a reading
error, not just an ugly box. The fix for it remains unfound.

**What IS fixed: the closing `:|` read as two barlines.** That row's bars end `… 2328, 2629, 2664`
— the final repeat's thin and thick strokes, **35 px apart**, surviving as two candidates because
`_cluster_cols` merges only within 0.6 sp (18 px). The 35 px gap then became a *measure*, and
`MIN_STRIP_W` could not rescue it: a sliver merges into the previous window only while that window
is under `MEASURES_PER_STRIP`, and this one already held 3. So it emitted as its own crop.

⭐ **Fixed where the error is — it was never a measure** — by mirroring the `lead` prefix rule at the
other end of the row: a trailing span under `TAIL_SPAN_MAX_SP` (1.5 sp) that holds **no notehead**
stops being counted, and its ink stays inside the last window's crop, so the row still **ends on its
own closing barline**. `OMR_TAIL_SPAN=0` restores the old behaviour.

| | before | after |
|---|---|---|
| `nihavendLongaDuzgun` strips | 27 | **26** |
| that row's measures | 6 | **5** |
| last crop | ended 35 px short, junk strip after it | **ends on the `:|`** |

**Both instruments are exactly neutral, verified by A/B on the same machine** (`OMR_TAIL_SPAN=0`
against the shipped 1.5):

| | rule OFF | rule ON |
|---|---|---|
| `score_barlines` (38 rows, 93 marked) | 48.4% recall / 81.8% precision / 10 false | **identical** |
| `score_slicer --sample 25` (124 truth rows) | 81 exact | **81 exact** |

That is expected — this changes measure segmentation, not barline detection — and it is why the pair
is quoted as a guard rather than as evidence of gain.

**Prevalence, and the honest caveat on the threshold.** Over the 12,169 rows recorded in the
`strips_v2` manifests, **119 rows (0.98%) on 111 of 1,781 pages (6.2%)** have a trailing span ≤ 1.5 sp
(gaps: min 22, median 33, max 45 px). ⚠ That is an **upper bound on OLD geometry** — it counts the
width trigger only, and the shipped rule also requires the span to hold no notehead. Slicing 10 of
those pages both ways under today's code: **215 → 213 strips**, i.e. it removed the sliver and
touched nothing else.

⛔ **1.5 sp is a judgement, not a discovered boundary.** The trailing-span width distribution is
**continuous** — 119 rows at ≤ 1.5 sp, **82 more in 1.5–2.5 sp**, 32 in 2.5–3.0, and on up — so no
valley separates "double bar" from "narrow final measure". The discrimination is carried by the
**no-notehead test**; the width cap is only there to bound that test's known failure mode, the same
one the `lead` rule documents (a measure holding ONLY rests has no notehead either, and at ≤ 1.5 sp
there is no room to print one).

⚠ **`GEOMETRY_REV` 20260826 → 20260903**, because this moves a crop boundary: every
`<page>_decode.json` cache on disk is now refused and the next emit re-decodes. `TAIL_SPAN_MAX_SP` is
in `window_signature()`. ⚠ Mirrored in the browser slicer (`TAIL_SPAN_MAX_SP` in
`apps/web/src/omr/slicer/constants.ts`, the tail trim and `winX1` in `windows.ts`) — the two must
move together or the port splits.


## The `?dense=` experiment — the app's missing label rail, measured

*Was `docs/METRICS-SLICER-WINDOWS.md` (last updated 2026-09-07).*

Split out of [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) on 2026-09-07 when that file
crossed the 400-line cap. Genre split: this is the **product-side** question — what the rail does
for a reader's page in the browser — while the training-side budget (its value, the label-length
tail, Round 4's emitter rail) stays there. Nothing was changed in the move.

⚠ **`?dense=` is an OPT-IN EXPERIMENT, not a default**: parity unverified, no gold measurement.
The shipped app has no rail, and [BACKLOG.md](BACKLOG.md) item 0 owns why it still does not.

### `?dense=50` IS A WASH ON THE THING IT WAS BUILT FOR (2026-08-22)

⛔ **The rail does not produce better-filled strips.** Measured with the parity gap closed, so this
is the browser's own behaviour and not an approximation of it.

#### The instrument: measure fill, which needs no labelling

The slicer cuts on **barlines**, so the manifest already knows how many measures a crop holds, and
music is metrical — a decode that drops notes comes up short against `n_measures x the page's
meter`. An early `</s>` under-fills, and nothing else in the pipeline produces that signature at
scale. The meter is derived **per page** from the page's own decodes (the modal beats-per-measure),
so no piece match, no usul table and no hand labelling is involved; a page whose decodes disagree
about a meter is reported unscorable rather than guessed at. `ml/labels/measure_fill_score.py`.

⚠ **It has a floor, and the floor is measured, not assumed.** Run over hand-verified gold
(`_realval_v2`, n=211 scorable rows) the same scorer flags **10.0%** — **7.6% under**, 2.4% over.
Every one of those is the proxy's own false alarm. Excluding first/last windows of a row drops the
floor to 5.1% but discards 72% of the sample, which is a bad trade, so the floor stays and the arms
are compared against each other rather than against zero.

⚠ **It cannot see a wrong pitch, a wrong accidental, or two errors that cancel.** It is a floor on
the error rate, never the rate. It is nevertheless the right instrument for *this* claim, because
the failure `?dense=` targets — the model emitting `</s>` early — is exactly what it detects.

#### The read: 117 shared pages, `round2-stage2-best` int8 both arms

Arm A is the cached corpus decode under the shipped rule; arm B is the same pages re-decoded under
the rail (`ml/labels/decode_budget_arm.py`, 120 pages, 21 min on the laptop).

| | shipped rule | rail, b=50 | Fisher |
|---|---|---|---|
| **under-fill, ALL scored strips** | **155/990 = 15.7%** | **209/1260 = 16.6%** | **p = 0.57** |
| under-fill, `est_tokens > 59` | 32/119 = 26.9% | 5/43 = 11.6% | p = 0.055 |
| under-fill, `est_tokens <= 59` | 123/871 = 14.1% | 204/1217 = 16.8% | p = 0.11 |
| strips over budget at all | 119 | **43** | — |
| strips emitted | 2,255 | 2,462 (**+9.2%**) | — |

**The rail works mechanically and the work does not reach the page.** Over-budget strips fall by
64% and under-filling among them roughly halves — but the music lands in more, shorter strips that
under-fill at least as often, so the total does not move.

**The obvious confound was checked and runs the other way.** More strips means more first/last
windows of a row, where the gold floor is higher (8.6% vs 5.1%) — but arm B's edge share is *lower*
(67.4% vs 76.5%), so if anything it was flattered. On interior windows alone the picture is
unchanged: **14.2% -> 16.5%**.

⚠ **Do not read the per-`n_measures` split as a regression.** It shows 2-measure strips at
24.5% -> 39.6% (p = 0.0006), and that cell is **selection, not effect**: the rail splits the easy
2-measure windows into single measures, so what remains under that label in arm B is different
music from arm A's. The arms cut different crops, which is why **only the page-level total is an
honest comparison** and why nothing here is strip-paired.

⚠ **Not measured**: wall-clock cost. Arm A's `total_ms` was recorded in an earlier batch under
different thread settings, so the 113-vs-403 ms/strip gap is the machine, not the rule. **+9.2%
strips** is the machine-independent cost. Also unmeasured: any budget other than 50, any model other
than `round2-stage2-best`, and whether pitch accuracy moved.

#### Asked again the two ways that could have rescued it (2026-08-22)

Both were fair objections to the headline, and both were tested on the data already in hand.

**1. "The representative sample dilutes it — only dense pages matter."** Restricting to the 37
pages the shipped rule leaves with at least one over-budget strip:

| | shipped rule | rail, b=50 | Fisher |
|---|---|---|---|
| under-fill, DENSE pages | 116/604 = 19.2% | 125/696 = 18.0% | p = 0.57 |
| under-fill, non-dense pages | 39/386 = 10.1% | 84/564 = 14.9% | **p = 0.031** |

No improvement where it was supposed to act, and a **significant regression where it was not** —
which is a second, independent reason not to make it a default.

**2. "Under-fill per STRIP is unfair — the rail emits more strips."** So score the page instead:
per page, the music the decode actually spells over the music its crops cover. That number is
composition-free.

| | shipped rule | rail, b=50 |
|---|---|---|
| median page completeness, all pages (n=66) | 0.955 | 0.955 |
| median page completeness, dense pages (n=35) | 0.900 | 0.909 |
| pages better / worse under the rail (dense) | — | **10 better, 12 worse** |

⚠ **Roughly as many pages get worse as better.** Three readings — per strip, dense-only, and
page completeness — and none of them moves.

#### The gradient that DOES exist, and it is not the token budget

⭐ Under-filling tracks **how much music is crammed into one crop**, steeply (shipped rule):

| measures in the strip | under-fill |
|---|---|
| 1 | **7.5%** (51/679) |
| 2 | 24.5% (57/233) |
| 3 | **60.3%** (47/78) |

⚠ **But cutting the crop smaller does not collect that gradient** — that is exactly what the rail
does, and all three readings above are flat. So the constraint is not "too much music per crop" in
a form that re-cutting solves.

⚠ **And the decoder was never out of room.** `MAX_TOKENS` is **100** in both `decode.ts` and
`onnx_parity.py`, and `hit_cap` fired on **0 of 202** misfilled strips here — the model stops on its
own, well short of the cap. The 59-id figure is the **emitter's training-data gate**
(`audit_coverage.MAX_IDS`), not an inference limit: the model has only ever been *trained* on labels
that fit in 59, so it has learned that labels end by then. That points the remaining lever at the
training gate ([BACKLOG.md](BACKLOG.md) item 7 / B9), not at the slicer.

#### The budget VALUE was never chosen, and 50 was the wrong one (2026-08-23)

⚠ The read above tested **b=50** because that is the number `?dense=` documents — it was never
selected against anything. Choosing it properly costs no decoding at all: re-window the same stage-1
geometry at every candidate and count what enters the corpus against what it costs.
`ml/labels/budget_sweep.py`, 200 pages / 3,876 legacy windows:

| b | windows | over the 59-id gate | near-empty (≤20) | healthy 21–59 | recovered |
|---|---|---|---|---|---|
| shipped rule | 3,876 | 15.1% | 7.8% | 77.1% | — |
| 40 | 4,503 | 6.5% | **10.8%** | 82.7% | +291 |
| 50 | 4,286 | 6.8% | 8.4% | 84.8% | +293 |
| 55 | 4,172 | 7.0% | 7.9% | 85.1% | +292 |
| **57** | **4,124** | 7.2% | **7.5%** | **85.3%** | +290 |
| 59 | 4,086 | 7.2% | 7.6% | 85.2% | +290 |
| 62 | 4,036 | 9.3% | 7.7% | 83.0% | **+211** |

⭐ **Recovery is FLAT from b=40 to b=59 (~+291).** Cutting harder buys nothing — the windows that
splitting can rescue are rescued at any of these budgets. So the budget should be chosen entirely on
what over-splitting *costs*, and that cost falls as b rises: near-empty crops go 10.8% → 7.5%,
which at b=57 is **below the shipped rule's own 7.8%**. On this instrument b=57 recovers 290 windows
into the trainable corpus at no measured cost.

⛔ **b=62 is a cliff** — recovery collapses to +211, because windows estimated between 59 and 62 are
allowed to stand and then blow the gate they were supposed to fit.

⛔ **So b=50 over-splits: 162 unnecessary extra windows against b=57, and a worse near-empty rate,
for the same recovery.** That is the most likely explanation of the **non-dense-page regression**
measured above (10.1% → 14.9%) — at 50 the rail cuts pages that never needed cutting. The gate is
59 and the estimator's residual sd is ~30 ids; stopping at 50 pays that margin twice.

⚠ Estimated ids, not decoded (sd ~30) — every arm shares one estimator, so the ordering holds where
the absolute levels do not. This is the same caveat, and the same "healthy band" instrument, as the
July sweep in [METRICS-SLICER-WINDOWS.md](#the-windowing-retune-and-the-crop-frame--measured-and-settled), so the two are comparable.

⚠ **This ranks the budget; it does not show the rail works.** The paired decode read above is still
a wash, and nothing here changes that — what it changes is which value a *paired* experiment
(re-emit → train → measure) should use.

#### What this leaves

The dense-page bug is **real and unchanged** — 59.1% of pages carry an over-budget strip and
`hit_cap` still fires on essentially none of them (0 of 202 misfilled strips in arm A here). What is
now measured is that **this particular fix is not the answer**: cutting on the estimate moves the
failure rather than removing it. Splitting *and* something that helps a short strip decode
correctly would be a different experiment.

### How often the decoder ceiling is actually hit (2026-09-19)

Measured over all 15,711 candidate strips the emitter priced on real pages: **5.91% carry more than
99 ids** under the shipped vocabulary — past `MAX_TOKENS` — against **0.30%** under scheme H. That is
the size of the class this page's failure lives in, and the numbers, with what they do and do not
license, are in [METRICS-EXAM.md](METRICS-EXAM.md#round-4s-vocabulary-ab--how-it-is-scored-and-what-the-kit-measured-before-any-gpu-ran).
