# Crop geometry — what the encoder is actually GIVEN

purpose: the single home for the input-geometry thread — the fixed 409x583 encoder box, how much of a strip survives it, the padding probe that made resolution causal, and the pilot that priced the fix
audience: agents and the owner working Round-3 Lever 1

updated: 2026-08-17

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-08-17 when that file crossed the
400-line cap. The split is by genre: that file keeps **what the model gets wrong**, this one keeps
**what the model is given** — a question about our own pipeline rather than about the model's errors.
Nothing is duplicated. The lever these numbers serve is
[rung3/levers.md](rung3/levers.md), Lever 1.

⚠ **Two rails, not one, and they behave oppositely.** The slicer cuts real pages
(`MEASURES_PER_STRIP` / `MAX_STRIP_W`, both env-switchable); the renderer packs synthetic strips by
measures and **label tokens** (`STRIP_BUDGET`) with no pixel-width rail at all. A number here always
says which side it is about.

## The three-arm pilot (2026-08-17) — the measure rail is not the lever, and the stop rule fired

Lever 1 step 2, pre-registered in [rung3/levers.md](rung3/levers.md) before the arms ran. Six pieces,
one per makam (`scripts/rung3/make_geom_pilot_list.py`); 25 non-exam real pages re-sliced per arm
(`scripts/rung3/geom_reslice.py`). All three synthetic arms pass `verify-labels` exactly
(433/433, 434/434, 489/489, zero label drift).

**Synthetic side** — `render.ts --max-measures`, against the two pools that matter:

| pool | median width | encoder staff spacing | ≤479 px | measures per strip |
|---|---|---|---|---|
| `strips_v4` — **what trained** | 1092 px | **16.0 px** | 2.1% | 68% one, 22% two, 10% three–four |
| **exam — what is read** | 910 px | **19.2 px** | 6.4% | mostly one |
| nota (real) | 1011 px | 17.3 px | 1.1% | mostly one |
| pilot control (4) | 1020 px | 17.1 px | 1.2% | **87% already one measure** |
| pilot arm A (2) | 1014 px | 17.2 px | 1.4% | 87% one measure |
| **pilot arm B (1)** | **912 px** | **19.2 px** | 6.7% | 100% one measure |

- **`maxMeasures = 2` is a no-op**: the renderer already emitted one measure per strip 87% of the time,
  because the **56-token budget binds before the measure rail does**. Only the strict 1-measure rail
  moves anything, and sweeping three arms is what showed that — picking "2" would have returned a null
  and read as a refuted lever.
- **Arm B lands on the exam almost exactly**: 912 px vs 910, 19.2 px vs 19.2, 6.7% vs 6.4%.
- What the lever actually buys is therefore **not more resolution but a closed training gap**: the
  corpus reads at 16.0 px while the exam reads at 19.2. ⚠ **It cannot go beyond 19.2**, because the
  padding probe's ×1.00 baseline *was* 19.2 px — exceeding it needs crops under 479 px, i.e. narrower
  than one measure, which is the half-measure target already measured at **+31.8% worse**.
- Corpus cost is **+12.9%** strips (433 → 489), not the ~3× this lever was priced at.

**Real side** — `OMR_MEASURES_PER_STRIP`, cap held at its shipped 1450 in every arm:

| arm | strips/page | median width | encoder staff spacing | ≤479 px | short crops (est) | `split_wide` |
|---|---|---|---|---|---|---|
| 3 (control) | 18.88 | 1012 px | 17.3 px | 3.4% | **0.8%** | 25.0% |
| 2 | 19.00 (1.01×) | 998 px | 17.5 px | 3.6% | 1.1% | 24.8% |
| 1 | **23.00 (1.22×)** | 827 px | **21.1 px** | 12.9% | **4.3%** | 20.5% |

- The measure rail **does** bind here, unlike on the renderer — but only at 1: 17.3 → 21.1 px (+22%).
- **Decode cost is 1.22×, not 3×.** The 3× figure this lever carried was wrong.
- ⛔ **THE PRE-REGISTERED STOP RULE FIRES ON ARM 1**: short crops 0.8% → **4.3%**, i.e. **5.4×** the
  control against a 2× threshold. Arm 2 survives at 1.1% but does nothing.
- ⚠ The short-crop share here is the slicer's fitted `est_tokens`, **not** the tokenizer's gold count
  that defines the `<10` threshold. Direction and ratio are usable; the absolute is not.

**A rough trade, stated as an estimate rather than a result.** Against the padding dose curve
(19.2 → 15.4 px cost +13% SER), a +22% rise might buy ~−10% SER on normal crops; +3.5 pp of strips
moving from ~0.04 to 0.259 ed/token adds ~+15%. **The two are the same size and the sign is probably
negative** — which points the same way as the stop rule, by a different route.

⚠ **An arm design error, recorded because it produced plausible numbers.** The first run paired each
arm with a *lowered width cap* (800, 500 px). A real measure is ~1012 px, so those caps cannot be met
by packing fewer measures — `_split_wide` cut **inside** measures to satisfy them: `split_wide` 25% →
76% → **94.7%**, width down to 334 px, 3.06× strips/page, short crops 19.8%. Every number looked like
a decisive result for the lever and none of it was about the lever: it was the half-measure target,
tested by accident. The tell was `split_wide`, not the widths. With the cap held at 1450 it is flat at
**118 strips in all three arms** — the cap is not binding and every crop falls on a barline.

**`domain_gap` on the density family**, control → arm B: `notes_per_strip` and `tokens_per_strip` both
**CLOSER**, `strips_<=3_notes_%` **CLOSER** (2.56 → 0.889). `strip_width_px_mean` reads **further**
(60.3 → 66.2) — but only because that verdict targets the unweighted mean of exam+nota+r1 (~977 px)
and arm B *overshoots it downward while landing on the exam*. Which pool is the target matters here,
and the exam is what Round 3 is graded on.

### The encoder's input box (2026-08-15) — 61% of it is padding, and edits track what is left

`scripts/rung3/crop_geometry_probe.py`. The arithmetic first, because it had never been written
down: `preprocess.ts` rotates a strip 90° and fits it into a fixed **409×583** frame, so the net
scale is `min(583/W, 409/H)` with H = 336 for every strip we cut.

| strip | net scale | staff spacing the encoder sees | one note position | frame used |
|---|---|---|---|---|
| synthetic median, 1212 px | 0.48 | **14.4 px** | 7.2 px | 161 of 409 columns — **39%** |
| exam median, 924 px | 0.63 | 18.9 px | 9.5 px | 51% |
| exam p90, 1285 px | 0.45 | 13.6 px | 6.8 px | 37% |
| **≤479 px** (the aspect the frame wants) | **1.22 (upscale)** | **36.5 px** | 18.3 px | **100%** |

**A strip narrower than 479 px is the only one this encoder does not throw resolution away on**, and
we cut them at 3 measures / up to 1450 px. Two consequences already in this file get a common cause:
synthetic beams arriving at 6.5 px, and crops >1200 px carrying 28.6% of exam edits.

Then the same 326-strip Round-2 exam decode, re-aligned by this probe and bucketed by effective
spacing with each confound pinned in turn:

| control | low res | mid | high res |
|---|---|---|---|
| **density held** (10–14 gold tokens / 1000 px) | 14.3 px → **0.161** ed/token, 40% perfect | 18.2 px → 0.103, 48% | 22.0 px → **0.066**, 64% |
| **length held** (12–18 gold tokens) | 13.9 px → **0.162** | 17.0 px → 0.058 | 19.7 px → 0.101 |
| **width held** (900–1150 px), bucketed by LENGTH instead | 9 tok → 0.094 | 13 tok → 0.099 | 16 tok → 0.076 |

- **At matched musical density the most-squashed third costs 2.4× the edits per token.** Holding
  length fixed keeps the effect; holding width fixed and varying length removes it — so this is
  **resolution, not autoregressive drift over a longer sequence**.
- ⚠ **Observational, not causal.** Wide crops may differ in ways not controlled here, and the
  buckets are ~40 strips each. The causal test is `--make-padded`: widen a strip with more of its
  own empty staff (content and gold identical, resolution lower) and read the dose-response.
  **RUN 2026-08-15 — see the next section. It is causal, and it replicates on the holdout.**
- **Measured while building that probe, and it killed the obvious implementation:** the last column
  of an exam crop is **36% ink at the median** — the 120 px staff span, i.e. **the crop ends on a
  barline**, not on the blank staff the `PAD_PX = 6` trim suggests. Extending it (`BORDER_REPLICATE`)
  would pad with a black band. Two more reference points from the same pass: a genuinely blank column
  is **4.6%** ink (the five staff lines are thicker than they look), and the probe's tiled padding
  lands at **5.6%**, with ~25 of 326 strips dense enough to have no quiet window at all.
- ⚠ **This probe's own re-alignment totals 433 edits where `eval_omr` reports 562** — different
  tokenizer and alignment. Trends only; quote `eval_omr` for any total.
- ⚠ **The high-resolution end is NOT better**: short crops (<10 gold tokens, median 558 px) run
  **0.259 ed/token**, the known crop-shape hole (0 of 40,826 training strips are signature-only).
  Narrowing crops without rendering the short shapes would enlarge that hole, not close it.
- ⚠ **The current slicer made this worse, not better**: crops >1200 px went **13.8% → 27.8%** of
  the same 67 pages (row above). The exam was cut by the old slicer, so production is further into
  the bad end than these numbers show.

### The padding probe (2026-08-15) — CAUSAL, and it replicates on the holdout

`crop_geometry_probe.py --make-padded` widens each crop with more of **its own quietest columns**,
so content and gold are untouched and only the resolution the encoder sees falls. Decoded with
`round2-stage2-best`; totals below are `eval_omr`'s.

| pad | staff spacing at the encoder | SER (edits/token) | exact-match | pages ≤5 edits |
|---|---|---|---|---|
| **×1.00** | 19.2 px | **0.052** | 52.1% | 57% |
| ×1.25 | 15.4 px | 0.059 | 38.0% | 50% |
| ×1.50 | 12.8 px | 0.061 | 35.0% | 54% |
| ×1.75 | 11.0 px | 0.070 | 27.9% | 41% |
| **×2.00** | 9.6 px | **0.083** | 16.6% | 37% |

**Strictly monotone across all four doses — +59% edits/token at ×2.00 — which is the branch the
pre-registration called causal.** The ×1.00 row reproduced the known Round-2 read exactly
(S=209 D=144 I=209 = **562 edits**, 52.1%, 57%), so the harness is the same one that produced it.

Paired bootstrap over strip names (10k resamples; padding does not change a filename, so every dose
is the same 326 images), on this probe's own re-alignment:

| pad | Δ edits/strip vs ×1.00 | 95% CI | same, dropping the 25 artifact strips |
|---|---|---|---|
| ×1.25 | +0.132 | [−0.015, +0.282] | +0.126 |
| ×1.50 | +0.267 | **[+0.110, +0.426]** | +0.269 |
| ×1.75 | +0.534 | **[+0.359, +0.706]** | +0.525 |
| ×2.00 | +0.874 | **[+0.684, +1.061]** | +0.874 |

**Real-val holdout** (`_realval_v2`, 267 strips; ×1.00 also reproduced its recorded SER 0.079 /
62.9% exactly): **0.079 → 0.096 → 0.127**, i.e. **+61% at ×2.00**, Δ +0.462 [+0.244, +0.691] and
+1.187 [+0.901, +1.500]. The direction replicates and is **steeper** than the exam's — the check §1
of [rung3/round3.md](rung3/round3.md) skipped when its 2% shrink won 15.5% on the exam and −1.6% here.

- ⚠ **×2.00 extrapolates** below the exam's natural 12.2–36.5 px range: the in-range doses carry the
  claim, the wide ones establish the shape. ⚠ **25 of 326 crops are too dense to have a quiet
  window**, so their padding tiles symbol fragments (max 17.2% ink vs a 5.6% median) — dropping them
  moves every delta by ≤0.01, so the artifact is not what produces the curve. ⚠ A tiled window also
  repeats at a fixed period, a texture no real page has; that residual is why the reading rests on
  the **dose-response** rather than on any single arm.


## Step 2's pre-registration, as signed (2026-08-17, before any arm ran)

Kept verbatim so the result above can be checked against what was actually promised, rather than
against a memory of it. Moved here from [rung3/levers.md](rung3/levers.md) on 2026-08-17 when that
file crossed its 400-line cap — the lever is closed, so its pre-registration is history.


**Three arms, one variable.** `maxMeasures` 4 (control, the corpus recipe), 2, and 1 — swept rather
than picked, because the decode cost the winner carries is the owner's call and the numbers should be
on the table when it is made. `--max-measures` on `render.ts` carries it, so the arms are one flag
apart in the manner of `--thin-sharps` and `--staccato-noise`.

**Both sides move, or the measurement is meaningless.** The real pools on disk were cut at 3 / 1450,
so narrowing only the synthetic side would *invert* the width gap rather than close it — and
production slices real pages with our own slicer too. Each arm therefore also re-slices ~25 real
pages at the matching rails (`OMR_MEASURES_PER_STRIP`, `OMR_MAX_STRIP_W`), and **the control arm is a
fresh re-slice, not the pools already on disk** — those predate the pale-line binarizer
([../METRICS-SLICER.md](METRICS-SLICER.md)), and reusing them would move two variables at once.

**⛔ The stop rule (owner, signed before the run).** An arm is **stopped, or must carry a short-shape
render alongside**, if the re-sliced **real** side's share of crops under **10 gold tokens** more than
**doubles** against the control re-slice. The real side is where the hole bites, because that is what
the model reads at inference, and short crops are the worst thing it reads: **0.259 ed/token against
a 0.03–0.05 baseline** ([../METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)). ⚠ The threshold is
in `crop_geometry_probe.tokenize()`'s units — `domain_gap.py` cannot report it, since its
`strips_<=3_notes_%` is a *note* count on a naive whitespace split.

**What a surviving arm must show:** strip width and tokens/strip moving *toward* the real pools'
without overshooting them, the effective encoder spacing rising, and the strips/page cost stated so
the render is priced before it is run ([../mvp/latency.md](mvp/latency.md)).

**⚠ What this pilot may NOT claim, written here so a later reader cannot borrow it.** Nothing about
accuracy. `domain_gap.py` measures distribution similarity; the accuracy claim belongs to a trained
arm and to nothing before it. Decoding narrow crops with `round2-stage2-best` would repeat the
`width_split_probe` confound exactly — a model trained on wide crops cannot separate *"narrow is
bad"* from *"never saw narrow"* — so the arms are **not decoded**.

**Costs and risks, stated up front:**

- ~3× more strips per page → decode time roughly triples. The page-splitting plan in
  [../mvp/latency.md](mvp/latency.md) exists for exactly this, and the current gate is accuracy,
  not latency — but this is a real product cost and the owner should price it before the render.
- ⚠ **The short-crop hole gets bigger before it gets smaller.** Crops under ~10 gold tokens are the
  worst thing this model reads, because 0 of 40,826 training strips are signature-only. Narrow
  geometry makes short crops the *common* case, so the render must include those shapes or Lever 1
  will make the exam worse. This is the failure mode to watch, not the resolution arithmetic.
- ⚠ The 2026-07-28 result that splitting wide crops made things **worse** is not a refutation: that
  split happened at decode time on a model trained on wide crops. It does say that half-measures are
  a bad target — cut on barlines.
- A re-slice changes which real strips are val-side, so `_realval_v2` and `_tupletval` must be
  re-checked rather than assumed (same warning the content work carries).

**The alternative shape of the same lever**, if the probe is positive but narrow crops prove too
expensive: keep the crops and enlarge the encoder frame instead (Donut-Swin tiles its windows, so
the input size can be raised with interpolated position embeddings). It costs the same compute per
page, changes the ONNX bundle and the browser path, and is the more invasive of the two. Prefer the
crop change; keep this in the drawer.


## Lever 1's plan as written, for the record (moved 2026-08-17)

The three-step plan Lever 1 carried before it was run. Steps 1 and 2 executed; step 3 is dead with
the lever. Kept verbatim because the *reasoning* in step 1 — why the probe tiles a quiet window
rather than replicating the last column — is the reusable part, and because a spent plan should be
checkable against what was actually done. Moved from [rung3/levers.md](rung3/levers.md) at its cap.

**What to run, in order:**

1. **The causal probe, half a day, no GPU.**
   `scripts/rung3/crop_geometry_probe.py --make-padded …` widens exam crops with **more of their own
   empty staff**, which lowers resolution while leaving content and gold identical; decode each pad
   factor with `eval_omr.py` and read the dose-response. ⚠ The obvious implementation — extend the
   last column — was measured and **rejected before use**: the last column of an exam crop is 36% ink
   at the median, because the crop ends on a barline, so replicating it would paint a black band and
   change far more than the resolution. The probe tiles the strip's own quietest columns instead
   (5.6% ink against a 4.6% blank-staff floor). It still has a tail: ~25 of 326 strips are dense
   enough to have no quiet window, and the run prints how many. **Pre-registered reading, written
   here before the run: monotone rise in edits/token → resolution is causal and Lever 1 proceeds;
   flat within noise → the correlation is a confound and this lever is dropped, in writing, like the
   five above it.**
2. **A 300-strip pilot** at the new geometry through `domain_gap.py`, before any full render — the
   same gate the content work carries. **Design and pre-registration signed 2026-08-17, before any
   arm was rendered — see the block below.**
3. Full render + **re-slice of the real pools** at matching constants, then the Round-2 recipe
   unchanged. One variable.


## Lever 1 as it stood — the full case, kept for the record (closed 2026-08-17)

Moved out of [rung3/levers.md](rung3/levers.md) on 2026-08-17 at its 400-line cap. The lever is
**closed**, so its argument is history and belongs beside its numbers. Kept in full rather than
summarised because the reasoning is what stops it being re-proposed — and because two of the claims
in it were measured wrong and the corrections only make sense next to the originals.

## Lever 1 — crop geometry: the model sees a fifth of the page it is given

> ✅ **THE PROBE RAN 2026-08-15 AND THE PRE-REGISTERED READING IS THE CAUSAL BRANCH.** Padding the
> exam crops with their own empty staff raises edits/token **monotonically across all four doses**,
> the bootstrap CI excludes zero from ×1.50 on, and the real-val holdout replicates **steeper**. The
> unpadded arms reproduced both recorded baselines exactly. **Numbers and caveats:**
> [../METRICS-GEOMETRY.md](METRICS-GEOMETRY.md), "The padding probe".
>
> ⛔ **AND STEP 2 THEN STOPPED THE LEVER (2026-08-17).** The caveat this box already carried — *the
> probe lowers resolution and does not prove raising it helps* — turned out to be the whole story:
> the probe's own ×1.00 baseline **was** the exam's 19.2 px, so there is nothing above it to reach
> without cutting inside measures. The measure rail is a no-op on the synthetic side at anything but
> 1, and on the real side the 1-measure arm trips the pre-registered short-crop stop rule at **5.4×**
> the control. **Result and what survives: the STEP 2 RESULT block below.** Both statements stand —
> squashing crops costs edits, and we cannot buy the reverse.

**The finding.** The encoder frame is a fixed **409×583**; a strip is rotated and fitted into it, so
the net scale is `min(583/W, 409/H)`. We cut strips at 3 measures / up to 1450 px, which means the
median strip arrives downscaled by half, with **61% of the frame spent on black padding**. A strip
narrower than **479 px** — roughly one measure — is the only shape this encoder does not throw
resolution away on. Measured, and re-measured with the two obvious confounds pinned:
[../METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md), "The encoder's input box".

**Why it is ranked first.** It predicts three findings this project already owns and never
connected: crops >1200 px carrying a fifth of exam edits, synthetic beams reaching the encoder at
6.5 px, and the one-or-two-position pitch errors that §1 of [round3.md](rung3/round3.md) chased into a
dead end. It needs **no new labels and no architecture change** — only the strip-cutting rails.

⚠ **CORRECTED 2026-08-17: the renderer and the slicer do NOT share those constants**, and this file
said they did. They are parallel implementations cutting on different quantities, so the lever is two
edits rather than one:

| | slicer (real pages) | renderer (synthetic strips) |
|---|---|---|
| where | `src/vision/page_to_strips.py` → `apps/web/src/omr/slicer/windows.ts` | `STRIP_BUDGET` in `tools/render/lilypond.ts` → `apps/web/src/stripExport.ts` |
| measure rail | `MEASURES_PER_STRIP = 3` | `maxMeasures = 4` |
| second rail | `MAX_STRIP_W = 1450` **px** | `maxTokens = 56` **label tokens** |
| knob | `OMR_MEASURES_PER_STRIP`, `OMR_MAX_STRIP_W` | `--max-measures` on `render.ts` |

Two consequences that change what the pilot has to do. **The renderer has no pixel-width rail at
all** — a wide row is emitted at whatever width the engraving produced, which is *why* our strips run
wider than the real pools' (§4 of [round3.md](rung3/round3.md)) rather than an accident on top of it. And
the two sides already disagree by one measure, 4 against 3, which nothing had flagged.

**A second argument, free with it.** An accidental carries to the end of its measure, so a
one-measure crop is the natural unit of the carry convention. The carry-sig hallucination
characterized on 2026-07-24 — accidentals invented on bare noteheads in mid-row crops that discarded
their signature — is a bug about crops that straddle the context they need.

**What was run, and the plan as written** → [../METRICS-GEOMETRY.md](METRICS-GEOMETRY.md). Steps 1
(the padding probe) and 2 (the three-arm pilot) executed; step 3 — full render plus a matching
re-slice — is dead with the lever. The verdict is below.

### ⛔ STEP 2 RESULT (2026-08-17) — the stop rule FIRED on the only arm that does anything

Numbers, both sides, in [../METRICS-GEOMETRY.md](METRICS-GEOMETRY.md). Read against the
pre-registration below, which was signed before the arms ran and is **not** re-opened now.

1. **The measure rail is not the lever on the synthetic side** — the 56-**token** budget binds first,
   so the renderer was already emitting one measure per strip 87% of the time.
2. **It cannot raise resolution at all**, only close a *training* gap. The padding probe's ×1.00
   baseline **was** the exam's own spacing, and exceeding it needs crops narrower than one measure —
   the half-measure target already measured at **+31.8% worse**.
3. **Both costs this file carried were wrong**, and much lower than feared.
4. ⛔ **The stop rule fires**: short crops on the re-sliced real side reach **5.4×** the control
   against a **2×** threshold. Arm 1 is stopped; arm 2 survives and does nothing. A rough independent
   estimate agrees — the resolution gain and the short-crop cost are the same size, sign probably
   negative.

**So the lever as written is spent, and it is written up as spent rather than re-aimed.** Two things
survive it and neither is a version of "narrow the crops":

- **A real, cheap, separable change**: render the corpus at **one measure per strip** to remove the
  16.0-vs-19.2 px *training* gap, for +12.9% strips and no change to the slicer, therefore **no
  decode cost and no short-crop risk at all** — the stop rule is about the *real* side, which this
  does not touch. ⚠ Untested as an accuracy claim; it needs a trained arm like anything else.
- **The short-crop hole is now the blocking item on this axis, not a side condition.** It was dropped
  in July on a disproved *mechanism* (§3 of [round3.md](rung3/round3.md)) while its **cost** was confirmed,
  and it is what stops the only geometry arm that works. Any return to crop geometry goes through it
  first.

⚠ **One arm design error is recorded with the result**, because it produced numbers that looked
decisive and were not: pairing each arm with a lowered `MAX_STRIP_W` (800, 500 px) forced `_split_wide`
to cut **inside** measures — `split_wide` 25% → 76% → 94.7% — so the first run measured the
half-measure target by accident and "failed" the lever for the wrong reason. The cap must stay at 1450
and `split_wide` is the tell, not the widths.

### The pre-registration itself → [../METRICS-GEOMETRY.md](METRICS-GEOMETRY.md)

The step-2 design and the stop rule **as signed**, kept verbatim so the result above can be checked
against what was promised rather than against a memory of it. Moved there 2026-08-17 at this file's
400-line cap: the lever is closed, so its pre-registration is history and belongs with its numbers.

