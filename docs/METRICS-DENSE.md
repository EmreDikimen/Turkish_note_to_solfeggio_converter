# The `?dense=` experiment — the app's missing label rail, measured

purpose: the single home for `?dense=`, the opt-in browser experiment that gives the SHIPPED app a label-budget rail, and every measurement that says what it does and does not buy
audience: agents and the owner, before quoting anything about `?dense=` or proposing to turn it on

updated: 2026-09-07

Split out of [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) on 2026-09-07 when that file
crossed the 400-line cap. Genre split: this is the **product-side** question — what the rail does
for a reader's page in the browser — while the training-side budget (its value, the label-length
tail, Round 4's emitter rail) stays there. Nothing was changed in the move.

⚠ **`?dense=` is an OPT-IN EXPERIMENT, not a default**: parity unverified, no gold measurement.
The shipped app has no rail, and [BACKLOG.md](BACKLOG.md) item 0 owns why it still does not.

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

### Asked again the two ways that could have rescued it (2026-08-22)

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

### The gradient that DOES exist, and it is not the token budget

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

### The budget VALUE was never chosen, and 50 was the wrong one (2026-08-23)

⚠ The read above tested **b=50** because that is the number `?dense=` documents — it was never
selected against anything. Choosing it properly costs no decoding at all: re-window the same stage-1
geometry at every candidate and count what enters the corpus against what it costs.
`scripts/rung3/budget_sweep.py`, 200 pages / 3,876 legacy windows:

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
July sweep in [METRICS-SLICER-FRAME.md](METRICS-SLICER-FRAME.md), so the two are comparable.

⚠ **This ranks the budget; it does not show the rail works.** The paired decode read above is still
a wash, and nothing here changes that — what it changes is which value a *paired* experiment
(re-emit → train → measure) should use.

### What this leaves

The dense-page bug is **real and unchanged** — 59.1% of pages carry an over-budget strip and
`hit_cap` still fires on essentially none of them (0 of 202 misfilled strips in arm A here). What is
now measured is that **this particular fix is not the answer**: cutting on the estimate moves the
failure rather than removing it. Splitting *and* something that helps a short strip decode
correctly would be a different experiment.
