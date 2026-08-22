# Slicer windowing and the crop frame — measured

purpose: the single home for the LABEL BUDGET — the rail that decides whether the model can express a strip at all, why the shipped app has none, and what the `?dense=` experiment measures
audience: agents and the owner, before changing the windowing constants or the strip frame

updated: 2026-08-17

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

## `?dense=50` IS A WASH ON THE THING IT WAS BUILT FOR (2026-08-22)

⛔ **The rail does not produce better-filled strips.** Measured with the parity gap closed, so this
is the browser's own behaviour and not an approximation of it.

### The instrument: measure fill, which needs no labelling

The slicer cuts on **barlines**, so the manifest already knows how many measures a crop holds, and
music is metrical — a decode that drops notes comes up short against `n_measures x the page's
meter`. An early `</s>` under-fills, and nothing else in the pipeline produces that signature at
scale. The meter is derived **per page** from the page's own decodes (the modal beats-per-measure),
so no piece match, no usul table and no hand labelling is involved; a page whose decodes disagree
about a meter is reported unscorable rather than guessed at. `scripts/rung3/measure_fill_score.py`.

⚠ **It has a floor, and the floor is measured, not assumed.** Run over hand-verified gold
(`_realval_v2`, n=211 scorable rows) the same scorer flags **10.0%** — **7.6% under**, 2.4% over.
Every one of those is the proxy's own false alarm. Excluding first/last windows of a row drops the
floor to 5.1% but discards 72% of the sample, which is a bad trade, so the floor stays and the arms
are compared against each other rather than against zero.

⚠ **It cannot see a wrong pitch, a wrong accidental, or two errors that cancel.** It is a floor on
the error rate, never the rate. It is nevertheless the right instrument for *this* claim, because
the failure `?dense=` targets — the model emitting `</s>` early — is exactly what it detects.

### The read: 117 shared pages, `round2-stage2-best` int8 both arms

Arm A is the cached corpus decode under the shipped rule; arm B is the same pages re-decoded under
the rail (`scripts/rung3/decode_budget_arm.py`, 120 pages, 21 min on the laptop).

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

### What this leaves

The dense-page bug is **real and unchanged** — 59.1% of pages carry an over-budget strip and
`hit_cap` still fires on essentially none of them (0 of 202 misfilled strips in arm A here). What is
now measured is that **this particular fix is not the answer**: cutting on the estimate moves the
failure rather than removing it. Splitting *and* something that helps a short strip decode
correctly would be a different experiment.

## The 2026-07-29 retune and the crop frame moved out (2026-08-22)

Everything about **which constants were swept and why none of them moved** — the
`MEASURES_PER_STRIP` sweep and the two bugs found under it, the budget-mode labelling-yield wash,
the whole-page spot check — plus the **vertical crop frame** (the low-beam fix, the floating staff)
and the **shared-edge trim** now lives in
[METRICS-SLICER-FRAME.md](METRICS-SLICER-FRAME.md). Those questions are closed; this file keeps the
one that is open.
