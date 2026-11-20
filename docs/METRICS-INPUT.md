# What the model is shown — input geometry, unseen symbols, the second engraver

purpose: what reaches the encoder and what the renderers draw — the 409×583 box, symbols the renderer never drew, and the LilyPond engraver
audience: anyone changing the renderer, the crop geometry or the training input
updated: 2026-11-20

**Merged into this file on 2026-11-20:**

- [Crop geometry — what the encoder is actually GIVEN](#crop-geometry--what-the-encoder-is-actually-given) — was `docs/METRICS-INPUT.md`
- [Diagnostics — the symbols the model has never been shown](#diagnostics--the-symbols-the-model-has-never-been-shown) — was `docs/METRICS-INPUT.md`
- [Metrics — the second engraver (Round 3, Lever 4)](#metrics--the-second-engraver-round-3-lever-4) — was `docs/METRICS-INPUT.md`


## Crop geometry — what the encoder is actually GIVEN

*Was `docs/METRICS-INPUT.md` (last updated 2026-08-17).*

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-08-17 when that file crossed the
400-line cap. The split is by genre: that file keeps **what the model gets wrong**, this one keeps
**what the model is given** — a question about our own pipeline rather than about the model's errors.
Nothing is duplicated. The lever these numbers serve is
[archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first), Lever 1.

⚠ **Two rails, not one, and they behave oppositely.** The slicer cuts real pages
(`MEASURES_PER_STRIP` / `MAX_STRIP_W`, both env-switchable); the renderer packs synthetic strips by
measures and **label tokens** (`STRIP_BUDGET`) with no pixel-width rail at all. A number here always
says which side it is about.

### The three-arm pilot (2026-08-17) — the measure rail is not the lever, and the stop rule fired

Lever 1 step 2, pre-registered in [archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) before the arms ran. Six pieces,
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

#### The encoder's input box (2026-08-15) — 61% of it is padding, and edits track what is left

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

#### The padding probe (2026-08-15) — CAUSAL, and it replicates on the holdout

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
of [archive/rounds.md](archive/rounds.md#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are) skipped when its 2% shrink won 15.5% on the exam and −1.6% here.

- ⚠ **×2.00 extrapolates** below the exam's natural 12.2–36.5 px range: the in-range doses carry the
  claim, the wide ones establish the shape. ⚠ **25 of 326 crops are too dense to have a quiet
  window**, so their padding tiles symbol fragments (max 17.2% ink vs a 5.6% median) — dropping them
  moves every delta by ≤0.01, so the artifact is not what produces the curve. ⚠ A tiled window also
  repeats at a fixed period, a texture no real page has; that residual is why the reading rests on
  the **dose-response** rather than on any single arm.


### Step 2's pre-registration, as signed (2026-08-17, before any arm ran)

Kept verbatim so the result above can be checked against what was actually promised, rather than
against a memory of it. Moved here from [archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) on 2026-08-17 when that
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
the render is priced before it is run ([app/server.md](app/server.md#making-a-page-faster--the-options-with-what-each-one-costs)).

**⚠ What this pilot may NOT claim, written here so a later reader cannot borrow it.** Nothing about
accuracy. `domain_gap.py` measures distribution similarity; the accuracy claim belongs to a trained
arm and to nothing before it. Decoding narrow crops with `round2-stage2-best` would repeat the
`width_split_probe` confound exactly — a model trained on wide crops cannot separate *"narrow is
bad"* from *"never saw narrow"* — so the arms are **not decoded**.

**Costs and risks, stated up front:**

- ~3× more strips per page → decode time roughly triples. The page-splitting plan in
  [app/server.md](app/server.md#making-a-page-faster--the-options-with-what-each-one-costs) exists for exactly this, and the current gate is accuracy,
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


### Lever 1's plan as written, for the record (moved 2026-08-17)

The three-step plan Lever 1 carried before it was run. Steps 1 and 2 executed; step 3 is dead with
the lever. Kept verbatim because the *reasoning* in step 1 — why the probe tiles a quiet window
rather than replicating the last column — is the reusable part, and because a spent plan should be
checkable against what was actually done. Moved from [archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) at its cap.

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


### Lever 1 as it stood — the full case, kept for the record (closed 2026-08-17)

Moved out of [archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) on 2026-08-17 at its 400-line cap. The lever is
**closed**, so its argument is history and belongs beside its numbers. Kept in full rather than
summarised because the reasoning is what stops it being re-proposed — and because two of the claims
in it were measured wrong and the corrections only make sense next to the originals.

### Lever 1 — crop geometry: the model sees a fifth of the page it is given

> ✅ **THE PROBE RAN 2026-08-15 AND THE PRE-REGISTERED READING IS THE CAUSAL BRANCH.** Padding the
> exam crops with their own empty staff raises edits/token **monotonically across all four doses**,
> the bootstrap CI excludes zero from ×1.50 on, and the real-val holdout replicates **steeper**. The
> unpadded arms reproduced both recorded baselines exactly. **Numbers and caveats:**
> [METRICS-INPUT.md § Crop geometry — what the encoder is actually GIVEN](#crop-geometry--what-the-encoder-is-actually-given), "The padding probe".
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
6.5 px, and the one-or-two-position pitch errors that §1 of [rounds.md § Round 3 — the notes themselves: where they sit and how long they are](archive/rounds.md#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are) chased into a
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
wider than the real pools' (§4 of [rounds.md § Round 3 — the notes themselves: where they sit and how long they are](archive/rounds.md#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are)) rather than an accident on top of it. And
the two sides already disagree by one measure, 4 against 3, which nothing had flagged.

**A second argument, free with it.** An accidental carries to the end of its measure, so a
one-measure crop is the natural unit of the carry convention. The carry-sig hallucination
characterized on 2026-07-24 — accidentals invented on bare noteheads in mid-row crops that discarded
their signature — is a bug about crops that straddle the context they need.

**What was run, and the plan as written** → [METRICS-INPUT.md § Crop geometry — what the encoder is actually GIVEN](#crop-geometry--what-the-encoder-is-actually-given). Steps 1
(the padding probe) and 2 (the three-arm pilot) executed; step 3 — full render plus a matching
re-slice — is dead with the lever. The verdict is below.

#### ⛔ STEP 2 RESULT (2026-08-17) — the stop rule FIRED on the only arm that does anything

Numbers, both sides, in [METRICS-INPUT.md § Crop geometry — what the encoder is actually GIVEN](#crop-geometry--what-the-encoder-is-actually-given). Read against the
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
  in July on a disproved *mechanism* (§3 of [rounds.md § Round 3 — the notes themselves: where they sit and how long they are](archive/rounds.md#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are)) while its **cost** was confirmed,
  and it is what stops the only geometry arm that works. Any return to crop geometry goes through it
  first.

⚠ **One arm design error is recorded with the result**, because it produced numbers that looked
decisive and were not: pairing each arm with a lowered `MAX_STRIP_W` (800, 500 px) forced `_split_wide`
to cut **inside** measures — `split_wide` 25% → 76% → 94.7% — so the first run measured the
half-measure target by accident and "failed" the lever for the wrong reason. The cap must stay at 1450
and `split_wide` is the tell, not the widths.

#### The pre-registration itself → [METRICS-INPUT.md § Crop geometry — what the encoder is actually GIVEN](#crop-geometry--what-the-encoder-is-actually-given)

The step-2 design and the stop rule **as signed**, kept verbatim so the result above can be checked
against what was promised rather than against a memory of it. Moved there 2026-08-17 at this file's
400-line cap: the lever is closed, so its pre-registration is history and belongs with its numbers.


## Diagnostics — the symbols the model has never been shown

*Was `docs/METRICS-INPUT.md` (last updated 2026-09-06).*

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-08-20 when that file crossed
the 400-line cap. The split is by **genre, and the genre turned out to matter**: everything here has
the same cause and, as of the staccato arm, the same prognosis.

⭐ **The pattern these share.** A symbol exists in real print; `ADDED_TOKENS` has no token for it; the
renderer draws none; so **0 of 40,826 training strips carry it**, and the model reads it as the
nearest thing it *has* seen. That is not a tuning problem and not a domain gap — the label language
has no legal way to say the right thing.

⭐ **And it is the one axis Round 3 has moved.** The three "make the pixels look more real"
experiments were all nulls (tuplet mark p = 0.688, the second engraver, the scan profile); the
staccato arm — a symbol the model had **never seen** — took its primary from 72.7% to **0.0%**.
**A hole responds; a domain gap does not.** That is the reason to read the dotted-barline entry below
as owed work rather than as a curiosity. Round 3's arm: [archive/rounds.md](archive/rounds.md#the-staccato-distractor--round-3s-arm-2-lever-6--passes).

#### The DOTTED (usul) BARLINE read as `\repstart` (owner-found 2026-08-20, while labelling)

> ✅ **DRAWN 2026-08-31 — `drawUsulBars` / `render.ts --usul-barline`.** It rules the usul's own beat
> groups inside the bar (aksak 9/8 = 2+2+2+3 ⇒ three rules a bar), reading the groupings already in
> `USUL_BEAM_GROUPS`; the coin is per **PIECE**, since an edition either uses the convention or it
> does not, and a meter with no known grouping gets no rules rather than an invented one.
> ✅ **Label-free, and verified so: 188 strip labels over 4 scores are byte-identical with the flag
> on and off** — which is what makes it cost zero new labelling. Previews of it beside the other two
> final-render flags: `data/synthetic/_flag_preview/`.
> ⚠ **`USUL_BAR_RATE = 0.35` and the placement (62% of the way to the following note) are CHOSEN,
> NOT MEASURED** — the same status as `STACCATO_RATE` and `STACCATO_RADIUS`. The print-frequency
> count below is still owed and is what would replace the rate.
> ⏭ **It still owes its own paired scorer**, cloned from `staccato_falsedot_score.py` with the false
> `\repstart` rate in place of the false-dot rate. Without it, three flags in one render leave a
> general movement unattributable; with it, two of the three are attributable.

Same shape as the staccato hole below, found the same way — by eye, mid-labelling, on
`gorunce_ben_seni_ey_mah_nota_p1_s05_w02.png` (`batch3`, karcigar). The strip carries a **column of
four dots across the staff with no line** — the dotted barline Turkish editions print to mark usul
subdivisions *inside* a measure — and the model emitted `\repstart` there. The owner's verdict removed
it; the raw row is decode-seeded, so label and decode both carried the error.

The cause is structural, not tuning, and it is the third instance of one pattern:

- **`ADDED_TOKENS` has no dotted-barline token.** The 25 are 8 accidentals + `\natural`, `\sig`/
  `\sigend`, 4 repeat, 4 navigation, `|`, `3`, and 4 rhythm signs. A dotted barline has **no legal
  spelling**, so the model cannot be right about one.
- **The renderer draws none.** `SheetView.tsx` sets only `Barline.type.REPEAT_BEGIN` / `REPEAT_END`;
  everything else is VexFlow's default single bar. So **0 of 40,826 strips** carry a dotted barline.
- **The nearest thing it has seen is a repeat sign** — a line plus *dots*. A column of dots maps onto
  that, or onto an augmentation dot. Note the prior is not inflated: `\repstart` sits at **3.35%** of
  synthetic strips against **2.07% / 4.04% / 3.07%** in `strips_nota` / `strips_r1` / the exam.

**Frequency, from the `batch3` queue as it stands:**

| | count |
|---|---|
| rows whose decode contains `\repstart` | **117 of 1,499 (7.8%)** |
| of those, judged by the owner so far | 23 |
| judged **and the `\repstart` removed as wrong** | **13 (57%)** |

⚠ **Not a random sample.** The owner works in page order and noticed this pattern, so the 23 judged
rows are drawn toward it; 57% is an upper-ish estimate, not a rate. What it does establish is that
the failure is **repeated and systematic**, not one strip.

⭐ **A RANDOM sample now agrees (2026-08-22).** `b8-audit` is a *shuffled* 5% sample of the re-emit's
accepted TRAINING labels, and all 201 rows were read: **10 carry a `\repstart` and 4 of those 10 were
wrong**, with 2 further rows missing one that the page draws. Unbiased where the `batch3` count is
not, and on the training side rather than a review queue — so roughly **2% of accepted strips carry a
false repeat sign**. ⚠ n=10 for the ratio; treat 40% as an order of magnitude, not a rate. It is also
the largest error class in that audit ([METRICS-CORPUS.md](METRICS-CORPUS.md)).

⚠ **A second thing is visible in that row and is not this finding**: the seeded label spells
`\bakiyeSharpf''8` and `\repstarte''8` with no space, while the correction spells them apart.

⛔ **CORRECTED 2026-09-06 — this paragraph used to say those were different token sequences, and they
are not.** Two different spacing cases were conflated:

| case | example | ids |
|---|---|---|
| no space **after** a `\token` — what these rows have | `\repstarte''8` vs `\repstart e''8` | **identical** |
| a space **inside** a note — what [DECISIONS.md](DECISIONS.md) 2026-08-31 is about | `f'' 8` vs `f''8` | **differ** (`'</w>` against `'`) |

The `32`-only rule belongs to the second row of that table, not the first: `f'' 32` *is* id-identical
while `f'' 8` and `d'' 16` are not. The added-token matcher consumes the boundary itself, so a token
glued to the next word still tokenizes as the token. Measured against the live tokenizer on all
**51 unspaced rows in `_realval_v2` (19.1% of 267)**: every one tokenizes exactly as its spaced form.
⭐ So this is cosmetic, no `_realval_v2` number is affected, and **the gold must not be "repaired"** —
`strips_b8` has 0 such rows, so nothing in training is touched either. ⚠ What it does break is
`check_token_drift`, which is a *regex* guard and stricter than the tokenizer: run it on a
hand-corrected val pool and it fails a pool that is fine (`train.py` deliberately does not).

#### Staccato read as an augmentation dot (2026-08-15) — measured with a paired control

> ✅ **CLOSED BY A TRAINED ARM — 2026-08-20. The rate is 0.0%.** Everything below is the *baseline*
> and how it was found; the arm that fixed it and all three of its clauses are in
> [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md) ("Round 3 — arm 2"). The short version
> is in the result table at the end of this section.

Owner-reported, then measured. `ADDED_TOKENS` has **no articulation token** (all 25 are accidentals,
structure and navigation) and the renderer draws no staccato, so 0 of 40,826 training strips carry
one: every dot the model has ever seen meant *longer*. A 1,215-strip pilot rendered twice from
`pieces_v4.json`, identical apart from the marks (manifests byte-identical, `verify-labels` PASS
1215/1215), gives a pool of **110 strips carrying ≥1 staccato whose gold has no dotted duration**:

| arm | strips decoded exactly | SER | **decoded a dot gold does not have** |
|---|---|---|---|
| control (no marks) | **110/110 = 100%** | 0.000 | **0 / 110 = 0.0%** |
| staccato | 30/110 = 27.3% | 0.058 | **80 / 110 = 72.7%** |

⚠ **Re-measured 2026-08-20 and reproduced exactly** by `scripts/rung3/staccato_falsedot_score.py` —
80/110, exact 27.3%, SER 0.0578 — from a script written off the definition above. The original
measurement was ad hoc and never committed; the metric is now re-runnable, which is what let the
same instrument score the arm. The checkpoint behind these two rows is **`round2-stage2-best`**, the
live model; that was not written down at the time and matters, because the defect's severity is not
a constant (see the arm's table below).

**The staccato-triggered false-dot rate is 72.7%, against 0.0% on the same music without the marks**
— the baseline Lever 6 is stated against. The dominant substitutions are exactly `X → X.`
(`d''4 → d''4.`, `g''8 → g''8.`, …). 43% of pilot strips carry at least one mark.

Where the same error lands on the Round-2 exam, by quality tier — the reason a whole-exam floor
would measure scan quality rather than this defect:

| direction | easy | mid | hard | total |
|---|---|---|---|---|
| dot **added** | 0 | 1 | 3 | **4** |
| dot **lost** | 0 | 5 | 7 | **12** |

Dropped dots concentrate in the **hard tier** (7 of 12), and the easy tier shows **zero of either** —
so the exam is nearly blind to this and the pilot above is the instrument.

⚠ **CORRECTED 2026-08-18.** This line used to read "concentrate in degraded scans … six with `nd` up
to 1.14", i.e. it read `nd` as scan quality. It is not: `nd` is `lev(label, decode)/len(label)`, a
label-vs-decode disagreement ([METRICS-CORPUS.md](METRICS-CORPUS.md)). "The dots we lose are on
strips where the model disagrees with the label most" is a restatement, not an explanation, so the
**tier** concentration is the only claim the data supports here. ⚠ This matters beyond wording: it is
the stated basis for Lever 6 clause 2 excluding hard tier in advance — flagged in
[archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first), decision owed to the owner ([STATUS.md](STATUS.md)).

#### The arm's result: 72.7% → 0.0%, and the marks became invisible (2026-08-20)

Same 110-strip marked pool, same script, three checkpoints:

| checkpoint | exact | SER | **false dot** |
|---|---|---|---|
| **`r3-stac-stage2-best`** (the arm) | **99.1%** | **0.0002** | **0 / 110 = 0.0%** |
| `r3-tupnew-stage2-best` (its training control) | 43.6% | 0.0396 | 60 / 110 = 54.5% |
| `round2-stage2-best` (live, the baseline above) | 27.3% | 0.0578 | 80 / 110 = 72.7% |

Paired: **60 strips the control gets wrong and the arm gets right, 0 the other way** (exact McNemar
p = 1.7e-18); 80 vs 0 against the live model (p = 1.7e-24).

**The arm reads the marked pool exactly as well as the unmarked one** — 99.1% exact and SER 0.0002
on both, its one non-exact strip being the same file with the same `\bakiyeSharp → \komaSharp`
confusion in each. So this is not "learned to suppress a dot"; the marks stopped carrying
information about duration at all.

⚠ **The control is at 54.5%, not 72.7%.** The severity varies by checkpoint, so the published
baseline could not have served as the control on its own — that is why the arm was scored against
both.

⚠ **This is our own rendered staccato.** No labelled real strip in any pool carries one, so the
generalisation to a real printed staccato is **not measured**. Same blind spot as the concave
tuplet mark ([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md#tuplets--the-corpus-scan-the-printed-mark-and-what-follows-the-notes)).

#### The real-dot no-regression read, easy+mid (2026-08-20)

`scripts/rung3/staccato_realdot_score.py`. The augmentation dot is a suffix inside a duration token,
not a token, so `eval_omr.py` has no per-class row for it; counted per strip in both directions.
Gold dot instances: easy 18, mid 53, hard 64.

| checkpoint | easy+mid (**the gate**) | hard (reported, never gated) |
|---|---|---|
| arm | 65/71 kept = **91.5%** | 56/64 = 87.5% |
| control (`tupnew`) | 66/71 kept = **93.0%** | 57/64 = 89.1% |
| live (`round2`) | 66/71 = 93.0% | 59/64 = 92.2% |

One dot separates arm and control. Paired on the gated strips: 1 strip where only the arm lost a
dot, 0 where only the control did, **p = 1**. Easy tier is 18/18 on all three. On hard tier the arm
loses 3 strips the live model does not and 0 the other way (p = 0.25) — directionally worse, n far
too small to read, and excluded from the gate in advance.

⚠ **A number in the exclusion's written reason is wrong, and it is not this pool's.**
[DECISIONS.md](DECISIONS.md) (2026-08-19) justifies excluding hard tier partly on "hard tier carries
**~12 real-dot instances in total**". Measured here, `_realval_v2_hard` carries **64** gold dotted
durations — comparable to easy+mid's 71 combined. The "12" is the Round-2 **exam's** dropped-dot
count (0 easy / 5 mid / 7 hard, the table above), a different pool and a different quantity. The
exclusion still stands on its *other* stated reason — hard tier's gold is the least reliable pool we
own — and the gate passed either way, so nothing about the round changes. Recorded because this is
the **second** time a written reason in this section has failed to carry what it claims.

### ⛔ THE DOTTED (USUL) BARLINE'S PREMISE DOES NOT SURVIVE MEASUREMENT (2026-08-31)

Two counts, run as [BACKLOG.md](BACKLOG.md) item 5 asked, **before** the final render baked the flag
into the graded model's corpus. Both go against the flag.

#### 1. How often does real print actually rule a dotted usul barline? **0 of 24 editions.**

24 **pieces** sampled with a fixed seed from the 2,051 distinct pieces in `data/real/images`
(the coin is per PIECE, so the sample is by piece, not by page). For each, the first one or two staff
systems of page 1 were read by eye — enough, because ruling usul divisions is an **edition-wide
convention**: an edition that uses it uses it in every bar.

| | count |
|---|---|
| editions sampled | 24 |
| of those, whose meter `USUL_BEAM_GROUPS` can rule at all | **~17** (9/8, 10/8, 8/8, 9/4, 6/8) |
| **editions drawing a dotted/dashed rule inside the bar** | **0** |

Every one used **solid, full-height barlines**. The only dashed ink seen was **horizontal** — the
`(SAZ ‥‥)` section brackets under the staff — which is not a barline and is not what the flag draws.

⚠ **`USUL_BAR_RATE = 0.35` is refuted by this sample.** At a true per-piece rate of 0.35, seeing 0 of
17 eligible editions has probability `0.65^17 ≈ 0.0016`. The 95% upper bound at 0/17 is **~16%**, and
at 0/24 it is **~12%**. ⚠ **What this does NOT license**: our pages come from **two websites**
([BACKLOG.md](BACKLOG.md) item 10), so this measures those two sources' house style, not Turkish
engraving at large. It is decisive about **our own page distribution** — which is what the model is
graded on — and no more.

#### 2. Where do the false `\repstart`s actually come from? **NOT from a dotted barline.**

The flag's whole justification was that the owner keeps deleting false `\repstart`s by hand. **That
evidence is real** — over all 1,168 `fix` rows in `strips_b8` and `strips_exam_v3`, **105 (9.0%)
delete a `\repstart`**. But the *cause* attributed to it does not hold:

| where the deleted `\repstart` sits | share of the 105 |
|---|---|
| immediately after `\sigend` — the first token of the music | **97%** |
| in the first strip of a staff system (`_w00`) | **92%** |
| in the very first strip of the page (`_s00_w00`) | **83%** |

⛔ **A usul rule cannot produce that distribution.** It is drawn on beat-group boundaries *inside*
every bar, throughout the piece, so its errors would scatter across strips and across positions.
This clumps on one position: the start of a line, right after the key signature.

⭐ **Looking at the pixels says what it really is.** The strips carry **clef → key signature → TIME
SIGNATURE → music**, with no repeat sign and no dashed rule anywhere. The most likely reading is the
**stacked time signature**: a vertical pair of digits (`6/4`, `8/8`, `9/8`, `10/8`) beside the staff's
opening vertical looks like the two dots of `‖:`. That is a genuine hole — it is simply **a different
hole from the one `--usul-barline` fills**.

⏭ **What follows is the owner's call**, and both counts are on the record before any Round-3 model
exists: drawing dashed rules inside bars is not aimed at the error being paid for by hand. The
instrument to price it either way already exists —
`scripts/rung3/usul_falserep_score.py` — and its pilot pools cost two ~40-minute renders.


## Metrics — the second engraver (Round 3, Lever 4)

*Was `docs/METRICS-INPUT.md`.*

gate, the domain-gap read against the VexFlow control, and what that measurement cannot see
audience: agents and the owner working Lever 4 or deciding whether a second engraver earns a corpus

updated: 2026-08-18

> Part of the real-page track — index: [rung3/README.md](rung3/README.md). The lever's verdict and
> what happens next live in [archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first); current state is
> [STATUS.md](STATUS.md). Nothing here changes [archive/rounds.md](archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol).

### What was built (2026-08-18)

Every one of the 40,826 synthetic strips is VexFlow + Bravura. A second engraver — **GNU LilyPond
2.26.0**, installed with Homebrew, training-side only — now renders the same labels:

| Piece | File |
|---|---|
| label → real LilyPond source | `tools/render/ly-engrave.ts` |
| LilyPond SVG reader (staff lines, glyph identity) | `tools/render/ly-svg.ts` |
| the corpus arm (plan → label → engrave → crop → manifest) | `tools/render/render-ly.ts` |
| the pixels-vs-labels gate for this arm | `tools/render/verify-labels-ly.ts` |

The labels come from `labels-cli.ts --ranges`, i.e. the **same serializer** the corpus and the
real-page emitter use, so a second engraver costs no new labelling. That was the premise of the
lever and it held.

### The feasibility check — LilyPond draws all eight AEU accidentals, our way

LilyPond ships `ly/makam.ly`, which defines alterations in ninths of a whole tone and maps them to
Emmentaler glyphs. The mapping is **identical to ours** (`packages/core/src/notation.ts`), checked
glyph by glyph against Bravura rather than assumed:

| Alteration | Our glyph (Bravura) | LilyPond (Emmentaler) |
|---|---|---|
| koma ±1 | 1-stem 2-bar sharp / mirrored flat | `sharp.slashslash.stem` / `mirroredflat` |
| bakiye ±4 | plain sharp / slashed flat | `sharp` / `flat.slash` |
| küçük ±5 | 1-stem 3-bar sharp / plain flat | `sharp.slashslashslash.stem` / `flat` |
| büyük ±8 | 2-stem 3-bar sharp / double-slashed flat | `sharp.slashslashslash.stemstem` / `flat.slashslash` |

So the two engravers disagree about **how** a sign is drawn and agree about **which** sign a comma
value gets. That is the condition for mixing both into one corpus.

### The pilot pool — `data/synthetic/_pilot_ly`

| | |
|---|---|
| pieces | the 6 of `data/pieces_geom_pilot.json` (one per makam, 40–80 measures, no exam overlap) |
| strips | **312**, carry (`measure`) mode only, whole measures under `STRIP_BUDGET` (4 / 56) |
| signature | the makam's conventional printed variant, seeded **`<slug>:c0:sig`** — the same variant the control arm wears |
| geometry | pinned to the corpus: 336 px tall, staff lines 30.0 px apart, top line at y = 138 |
| render cost | **112 ms/strip**, one LilyPond process per piece → **~76 min for a 40,826-strip corpus** |

⚠ **It draws no lyrics, repeat signs, volta brackets, navigation marks, distractor text or slur
distractors.** `render.ts` draws all of those on a seeded share. That is a recipe gap, not an
engraver property, and it is why some columns below are not comparable.

### The gate — PASS 312/312, 501 accidentals

`verify-labels-ly.ts` re-engraves every strip from its manifest label, identifies each drawn
accidental **by font outline**, and compares the sequence — in reading order, signature block
included — with the label's own accidental tokens; then checks the PNG's height and width.

| | |
|---|---|
| strips | 312 / 312 pass |
| accidentals compared | 501 |
| LilyPond bar-check failures | 0 |

Two things the build had to get right for that, both found by the gate rather than by reasoning:

- **Emmentaler is an optical-size family.** A grace note's accidental is a *different outline* from
  the full-size sign, so a table calibrated only at full size reported "no accidentals drawn" on a
  strip that visibly had two. The calibration now renders every sign twice, full size and on a
  grace note.
- **The label's own signature order is what LilyPond draws**, checked rather than assumed:
  `keyAlterations` preserves list order (measured on four orderings), so no reordering is needed.

### The domain gap — NULL on everything the instrument can see

Control: `_pilot_geom_m4`, the same 6 pieces through VexFlow, **carry-mode strips only** (226 of its
433 — the rest are transposed `every`-mode strips and are a different render mode, not a control).
Reports: `data/real/rung3/domain_gap/geom_m4_carry.json` vs `ly_pilot.json`.

| column | VexFlow | LilyPond | exam / nota / r1 | read |
|---|---|---|---|---|
| `spacing_px_sd` | 0.00 | 0.31 | 1.11 / 0.72 / 0.29 | ⚠ not engraving — see below |
| `thickness_px_mean` | 3.00 | 3.03 | 4.78 / 4.19 / 3.81 | unchanged, still far |
| `thickness_px_sd` | 0.00 | 0.23 | 2.08 / 1.61 / 1.03 | moved 11% of the way |
| `thickness_rel_to_spacing` | 0.100 | 0.101 | 0.157 / 0.139 / 0.127 | unchanged |
| `beam_span` mean (staff spaces) | 4.79 | 5.09 | 4.02 / 3.95 / 4.35 | **further** |
| `beam_span` p90 | 8.33 | 10.27 | 6.93 / 6.75 / 7.57 | **further** |
| `outside_band_%_of_ink` | 4.25 | 0.28 | 3.81 / 4.86 / 4.69 | further — the arm draws no lyrics |
| `notes_per_strip` | 8.67 | 10.47 | 7.19 / 7.70 / 8.15 | further — packing, see below |

**The verdict is null-to-slightly-worse.** Nothing here says a second engraver closes the
synthetic→real gap.

⚠ **`spacing_px_sd` is not evidence of engraver diversity.** The arm's staff size is pinned to the
corpus's, so LilyPond's drawn spacing is as constant as VexFlow's; the 0.31 px is where the staff
lands on the pixel grid after rasterising, not variation the engraver introduced.

⚠ **Two columns are confounded by the recipe, not the engraver.** `notes_per_strip` and the strip
widths: this arm packs **whole measures**, while `render.ts` packs at note level inside a VexFlow
row and so splits a dense measure across strips. And every `ink` column: no lyrics, no marks. The
per-100-note token rates differ for the same two reasons plus the signature-block share (37% coin
here); the note-side labels are byte-identical serializer output — verified on **163 shared measure
ranges with identical note labels**, of which **99** also agree on the signature block.

### ⚠ What this measurement cannot see

`domain_gap.py` measures staff geometry, ink outside the band, density, label content and beam
spans. A second engraver mostly changes things it does **not** measure: glyph shapes, note spacing
*within* a measure, stem lengths, beam angles, flag design. The side-by-side of 99 identically
labelled strips — `data/real/rung3/domain_gap/ly_vs_vexflow.png` — shows those differences plainly
while the table above barely moves.

So "no domain-gap improvement" is a statement about **this instrument**, not proof that a second
engraver is worthless. The claim a mixed corpus would need is an accuracy claim, and only a trained
arm can make it.

### ⚠ The geometry knob is a separate change, and neither arm pulls it

Lever 4's premise is "one engine, one font, **one spacing** — SD zero across all 40,826 strips". The
first two are now addressed and the third is **not**: this arm was deliberately pinned to the
corpus's staff size so that the engraver was the only variable. Varying document scale per strip
(`set-global-staff-size` here, the scale factor on the VexFlow side) is a one-line, engraver-neutral
change that neither renderer makes today, and it is the part of the premise that actually touches
the SD-zero number.

### What a full LilyPond corpus would still need

Owed before this arm could stand beside `strips_v4` rather than beside a control:

1. **Slur distractors** — the VexFlow corpus draws them on ~35% of renders and they took `\tup3`
   precision 15.1% → 91.2% ([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)). An arm without them
   teaches the opposite lesson.
2. **Repeats, voltas and navigation marks** — `ly-engrave.ts` throws on those tokens today rather
   than approximating them, and LilyPond expresses them by restructuring the music.
3. **Lyrics and distractor text** — the ink-outside-the-staff share the real pools are full of.
4. **`every` mode and the transposed share** — 25% of the corpus, and this arm renders none of it.
