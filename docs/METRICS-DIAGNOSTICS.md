# Diagnostics — measured investigations into specific defects

purpose: the single home for "why does it fail, and what did we test" — the probe results, including the ones that came back negative
audience: agents and the owner, before proposing a fix for a known weakness
updated: 2026-08-19

Split out of [METRICS.md](METRICS.md) on 2026-07-28 when that file crossed the 400-line cap. The
split is by genre: METRICS.md keeps the **scoreboard** (what the model scores, against which floors);
this file keeps the **investigations** behind those scores. Nothing is duplicated.

**Read the negative results.** Most of what follows is a hypothesis that was tested and did not
survive — each one is a change that was not built on a guess, and re-proposing it costs a round.

### ⛔ LEVER 7, THE SCAN PROFILE: NULL on its primary (2026-08-19, trained arm)

The arm ran on Colab (L4, 12 vCPU, ~2.6 h; stage 1 6,000 steps then stage 2 2,000, batch 16, mix
**screenshot .55 / photo .20 / scan .25** printed in both stages' startup line). Scored **paired**
against `r3-tupnew-stage2-best` with `scripts/rung3/paired_arm_score.py`, which reuses
`eval_omr.align`, so an edit here is an edit there.

| pool | arm ckpt | n | control | arm | mean difference (arm − control) | sign test |
|---|---|---|---|---|---|---|
| **`_scan`** — the signed primary | **`best`** (step 500) | 197 | 3.66 | 3.73 | **+0.071, 95% CI [−0.203, +0.335]** | 21 W / 34 L / 142 tied, **p = 0.105** |
| **`_scan`** | `last` (step 2000) | 197 | 3.66 | 3.67 | **+0.010, 95% CI [−0.198, +0.208]** | 23 W / 29 L / 145 tied, **p = 0.488** |
| **`_borndigital`** — the clause | **`best`** | 65 | 0.75 | 0.66 | −0.092, 95% CI [−0.415, +0.231] | 8 W / 6 L / 51 tied, p = 0.791 |
| **`_borndigital`** | `last` | 65 | 0.75 | 0.58 | −0.169, 95% CI [−0.477, +0.077] | 8 W / 6 L / 51 tied, p = 0.791 |

(edits/strip. The signed read is `best` vs `best`; `last` is the **step-matched** one, because the
control's `best == last` at step 2,000.)

Pool aggregates from `eval_omr.py`, control → arm: `_scan` SER 0.107 → 0.108, exact 52.5% → 51.5%;
`_borndigital` SER 0.024 → **0.019**, exact 72.3% → **75.4%**. Reported, not gated: mid 0.145 →
0.141, hard 0.051 → 0.054, easy 0.060 → 0.058, whole pool 0.089 → 0.088. Stage-1 synthetic val
landed at 0.0104 against the control's 0.0086 — the expected direction, since the arm trained on
harder pictures.

- **The primary is a null, and an INFORMATIVE one.** The interval is ±0.20 edits/strip on a base of
  3.66, so a **>5% reduction in corrections on scanned pages would have been detected**. This is not
  an underpowered test failing to see a large effect; the effect is not there.
- **The no-regression clause passes**, and the point estimate runs the *other* way — the arm is 22%
  better on born-digital pages, though that interval also crosses zero. Teaching the model what a
  scan looks like appears to have made it a slightly better reader in general rather than a
  specialist on scans. ⚠ Two nulls do not become a finding by pointing in a pleasing direction.
- ⚠ **n = 197, not 202**: the pool's 5 duplicate rows (4 contradictory) are all in the scan half, and
  the paired read counts each image once. It treats both models identically, so the difference is
  unaffected; the absolute totals are not comparable to `eval_omr`'s 202-row figures.
- ✅ **The conclusion does not hinge on the checkpoint choice**, which is the one thing that could
  have muddied it: stage 2 saved `best` at step **500** on a mix loss that peaked early while
  real-val loss kept falling to step 1,500 — [levers.md](rung3/levers.md) Lever 5's selector problem
  showing up live. **Both** checkpoints were therefore read, and both are null on the primary. The
  step-500 model is slightly the worse of the two on scanned pages (+0.071 vs +0.010), which is the
  direction under-training predicts.

### `_realval_v2` split five ways, and the "hard" tier is not the hard one (2026-08-19)

Measured while building Lever 7's scoring instrument (`scripts/rung3/split_realval_tiers.py`), on
**`r3-tupnew-stage2-best`** — the checkpoint that is also the arm's control. Both splits partition
the 267-strip pool exactly: the tiers and the media each re-sum to the whole pool's 153 exact matches
and S=267 D=340 I=236 over N=9461.

| pool | strips | pages | strips/page | SER | exact | edits/page (median, mean) | hand-verified rows |
|---|---|---|---|---|---|---|---|
| whole `_realval_v2` | 267 | 87 | 3.1 | 0.089 | 57.3% | 2, 9.7 | 110 |
| **`_scan`** (the Lever-7 primary) | **202** | 74 | 2.7 | **0.107** | 52.5% | 2, 10.7 | 97 |
| **`_borndigital`** (its clause) | **65** | 13 | 5.0 | **0.024** | 72.3% | 2, 3.8 | 13 |
| `_easy` | 47 | 22 | 2.1 | 0.060 | 66.0% | 2, 4.0 | 0 |
| `_mid` | 110 | 44 | 2.5 | **0.145** | 55.5% | 5, 12.1 | 0 |
| `_hard` | 110 | 51 | 2.2 | **0.051** | 55.5% | 1, 4.4 | **110** |

Two findings, and the second changed a pre-registration before it was signed:

- **The medium separates the model by 4.5×** — scanned pages 0.107 SER against born-digital 0.024,
  on the axis a scan-augmentation profile changes. 88% of the hard tier is scan-sourced, so the
  tier's premise was right; the split is simply the direct measurement of it, at twice the n.
- ⚠ **The `hard` tier scores BETTER than `mid` (0.051 vs 0.145), and the cause is its gold.** All 110
  hard rows were seeded with `round2-stage2-best`'s own decode and then confirmed or corrected by a
  person, so a descendant of that model is being scored partly against its ancestor's output. Mid
  and easy carry emitter-derived labels and no such rows. This is the mechanism behind "its gold is
  the least reliable pool we own" ([DECISIONS.md](DECISIONS.md), the Lever-6 clause-2 settlement) —
  and it is why Lever 7's primary was moved from the tier to the medium
  ([rung3/scan-profile.md](rung3/scan-profile.md)).

⚠ **Non-claim:** none of these pools is page-complete (2.1–5.0 strips a page), so their `edits/page`
is edits per *page fragment*. `share_le5` is not quoted from them at all — that number is defined on
the 46-page exam.

### The scan profile moves the geometry family toward real pages (2026-08-19, pre-GPU)

`domain_gap.py --augment --scan-share 0.25 --photo-share 0.20` on `strips_v5_tupnew`, against the
**non-exam** real pools (`strips_nota`, `strips_r1`) — the exam's pixel statistics are deliberately
not a target for a mix that has to be chosen without reading the exam.

| | control mix | scan mix | nota | r1 | verdict |
|---|---|---|---|---|---|
| `staff_detect_fail_%` | 28.7 | **17.3** | 15.0 | 15.3 | CLOSER (13.5 → 2.2) |
| `spacing_px_sd` | 0.788 | 0.710 | 0.715 | 0.288 | CLOSER |
| `staff_top_y_sd` | 4.18 | 3.79 | 3.59 | 0.76 | CLOSER |
| `thickness_px_mean` | 3.08 | 3.04 | 4.19 | 3.81 | further |

Content, density and beam-group columns are **unchanged to the digit**, as they must be — the profile
is pixels only. ⚠ Two caveats: `domain_gap` is a weak instrument (the LilyPond pilot returned null on
it while changing the engraver outright), and its `beam_span_px` family is unreliable on degraded
images by its own docstring. This says the profile builds a scan rather than a mess. It is not
evidence that the arm will win.

### The off-meter bar mark as an error localiser — 37.8% corpus-wide (2026-08-18)

Measured while costing the page-level correction UI ([BACKLOG.md](BACKLOG.md)), which would have
leaned on this mark to find errors. Run with `npx tsx tools/vision/page-structure.ts`, which uses the
**shipped** stitcher and core helpers (`stitchStrips` with `expand:false`, `deriveTimeSignature`,
`measureBeats`) so the number is the one the editor actually draws.

| | pages | interior bars | off-meter |
|---|---|---|---|
| real decoded pages, `strips_v2` | **1,670** | 40,937 | **15,491 = 37.8%** |

Median share per page **40%**; only **7.2%** of pages come out clean.

⚠ **This tempers, without contradicting, the claim in [mvp/editor.md](mvp/editor.md)** that the mark
"is silent on correct music and lights up where the model misread a duration". That was measured on
**one** decoded page (8 of 28 bars) against three clean scores, and the file says in its own words not
to over-read it. At corpus scale the mark flags **2 bars in 5**, so it narrows a duration hunt by
about **2.6×** — useful, not a spotlight. It also cannot see pitch, which is 40% of the edit budget.

⚠ **A false-positive source is now quantified too**: `deriveTimeSignature` takes the *modal* bar
length, so on a badly decoded page the mode is a coin flip and "off-meter" counts the derivation
failing rather than the music. Pages whose modal bar length is supported by <25% of their bars were
producing derived meters of **2/8 and 3/8** — no Turkish usul uses those. `page-structure.ts` reports
`modeShare` beside the meter so a consumer can tell the two apart.

### Model confidence does NOT rank strips by error — lift 0.44× (2026-08-18)

Measured while choosing a ranking signal for the page queue, on `reslice_all.csv`. ⚠ The test is only
well-posed on the **3,755 `src=local` rows that carry an INDEPENDENT emitted label** — the 30,049
colab rows are seeded with their own decode and cannot disagree by construction. (Run against all
33,801 rows first, which is why this caveat is recorded.)

Sorting worst-`mean_logprob`-first, share of the 869 label/decode disagreements captured:

| budget | captured | lift |
|---|---|---|
| worst 10% | 4% | **0.44×** |
| worst 20% | 13% | 0.65× |
| worst 30% | 23% | 0.78× |
| worst 50% | 43% | 0.87× |

**Every budget is worse than random.** Consistent with W8 being dropped — the same signal caught
26.3% of errors at a 10% budget against a ≥60% bar ([mvp/standing.md](mvp/standing.md)). ⚠ Note what
the target here is: a label/decode **disagreement**, and ~78% of those are the *label* being wrong
(below), so this measures ranking-for-review, not ranking-for-decode-error. Both readings say the
same thing — do not build a review queue on logprobs.

### Window overlap on real pages is 1.15×, not 3× (2026-08-18)

Over all 1,704 re-sliced pages: **43,586** measure-instances across 33,804 crops against **38,026**
distinct measures = **1.15×**. Assumed to be ~3× (k≈3 measures per window with shared edges) when
costing page-level review; it is not, so there is no redundancy for a page-level tool to collapse.
19.8 crops/page, 22.3 distinct measures/page, and **35.9%** of crops are row-starts carrying `\sig`.

### Tuplets — moved to their own file (2026-08-19)

The corpus scan (99.98% of groups are 3 noteheads), the 16-of-16 measurement of how real editions
draw the triplet mark, and the finding that the mark FOLLOWS the notes rather than sitting at a
fixed height → **[METRICS-TUPLETS.md](METRICS-TUPLETS.md)**.

### ⛔ A ~2% pre-shrink: exam −15.5%, real-val −1.6%. DID NOT REPLICATE (2026-07-28)

Per-strip staff-line spacing, measured on the strips as they reach the model. The slicer targets
`TARGET_SPACING = 30.0` px; the renderer produces exactly that.

| pool | mean px | sd | p10 | p90 | vs synthetic |
|---|---|---|---|---|---|
| synthetic `strips_v4` | **30.000** | **0.000** | 30.000 | 30.000 | — |
| real exam | **30.496** | 2.096 | 29.50 | 31.75 | **+1.65%** |
| real-val | 30.197 | 1.032 | 29.75 | 30.50 | +0.66% |
| real nota | 30.122 | 0.701 | 29.50 | 30.75 | +0.41% |

Correcting the size at inference (`scripts/rung3/staff_geometry_probe.py`, frozen
`round2-stage2-best` on the frozen 326-strip exam; rung 0 reproduces the 562-edit total exactly):

| scale applied | exam edits | vs baseline |
|---|---|---|
| identity | 562 | — |
| 0.990 | 486 | −13.5% |
| **0.980** | **475** | **−15.5%** |
| 0.975 | 494 | −12.1% |
| 0.960 | 541 | −3.7% |

- **Not monotonic** — it rises at both ends, ruling out "smaller is always better". The 1–2.5% basin
  is flat, so the exact optimum is **not resolvable at n=326**; the evidence is four independent
  scale values all landing 12–15.5% better.
- Vertical placement is **not** the cause: shift +1% gave +0.4% edits. Only scale mattered.
- Resampling is **not** the cause: an identity warp through the same interpolation gave 562 exactly.
- ⛔ **It does not generalise.** The same operation on the **real-val holdout** gives 247 → 243
  edits, **−1.6%**. The exam result came after ~15 variations were tried against the exam and the
  best was reported — selection on the test set. **Do not act on this.**
- ✅ **CLOSED 2026-07-31 — the last defence is dead, and the sign flips.** The open caveat was that
  real-val was the easy pool with no hard tier, so an effect confined to hard pages could hide
  there. Re-run on `_realval_v2` (267 strips, 41% hard, SER 0.079 — *harder* per token than the
  exam), same frozen `round2-stage2-best`, `staff_geometry_probe.py --strips-dir … --ladder
  fine_scale`:

  | rung | edits | vs identity warp |
  |---|---|---|
  | identity warp | 746 | — |
  | scale 1% | 766 | **+2.7%** |
  | scale 1.5% | 766 | **+2.7%** |
  | scale 2.5% | 785 | **+5.2%** |
  | scale 4% | 779 | **+4.4%** |

  **Every scale is WORSE**, where the exam had −13.5% to −15.5% at the same values. The effect is
  not merely absent off the exam — it reverses. Four independent scale values agreeing on the sign
  is the same standard of evidence the original claim rested on, now pointing the other way. The
  exam result was selection on the test set and nothing more. **Do not re-propose a pre-shrink.**
- ⚠ No mechanism was ever found. Ruled out: resampling (down-up 555), blur (562), ink lighten (565),
  ink thin (589), and staff-size matching — the exam benefit appears in **every** size bucket
  (undersized −33%, ~right −10%, oversized −16%), not just oversized strips.
- ⚠ **The staff-size explanation is DISPROVED.** Rescaling each strip individually to exactly
  30.000 px gives only **528 edits (−6.0%)** — less than half the blunt global shrink. If the model
  simply wanted the training spacing, exact per-strip matching would have won. It did not.
- ⚠ The estimator hypothesis is also disproved: `Staff.spacing` (median of gaps) vs the endpoint
  span that actually sets the crop height measures **span/median = 0.998** over 357 staves,
  predicting 29.95 px — not the 30.5 observed (`scripts/rung3/spacing_estimator_probe.py`).
- Current slicer output spacing is **30.353** against the old code's 30.494, so the bias narrowed
  but persists. Synthetic is exactly 30.000 (sd 0.000).
- **Do not act on this until the mechanism is known.** Untested candidates: ink weight, stroke
  thinning under INTER_AREA, encoder preprocessing.

### Decode confidence predicts correctness, and the review confirms it (2026-07-28)

`round2-stage2-best` re-decoding the exam's 145 hand-labelled HARD strips, bucketed by the decode's
minimum per-token log-probability — then the same buckets as the owner labels the `realval-hard`
queue (69 of 130 done at time of writing):

| min_logprob | exam hard: decode exactly right | realval-hard `ok` | realval-hard **`bad` crop** |
|---|---|---|---|
| > −0.1 | **80%** (51 strips) | 83% (53) | **6%** |
| −0.5 … −0.1 | 28% (40) | 50% (30) | 27% |
| −1.0 … −0.5 | 10% (31) | 21% (29) | **55%** |
| < −1.0 | **4%** (23) | 0% (18) | **89%** |
| all | 39% (145) | 50% (130) | **33%** |

Owner-labelled, all 130 rows: **65 ok / 22 fix / 43 bad**.

- Real signal, and the two measurements agree in the top bucket; used to order the labelling queue.
  ⚠ It orders the work, it does **not** license skipping rows — the top bucket is still wrong 1 in 5.
  ⚠ `ok` is looser than "exactly right", so the middle buckets are not directly comparable.
- **Low confidence strongly predicts a BAD CROP** — 16 of the 18 strips below −1.0 were rejected
  crops (89%), and the bad rate falls monotonically with confidence. ⚠ **Corrects an earlier claim
  in this file** that "confidence cannot detect a bad crop", which was drawn from the first 7 `bad`
  verdicts; the full 130 contradict it. High confidence still does not *guarantee* a good crop
  (6% of the top bucket were bad), so it is a screen, not a proof.
- **33% of the old slicer's hard strips are unusable crops** (43 of 130) — the slicer's failure rate
  on the material it had already flagged as doubtful. Only 87 were usable against 110 needed, so a
  re-slice was required regardless.
- First measured evidence the confidence signal carries information, bearing on the deferred
  error-localisation feature (pre-registered at TOKEN level; this is per strip).

> **Slicer behaviour lives in [METRICS-SLICER.md](METRICS-SLICER.md)** — the windowing
> retune, the cap bugs, the shared-edge trim and the vertical placement of the staff.

### Crop shape and beam weight (2026-07-28) — costs confirmed, both mechanisms disproved

Whole-exam decode, 326 strips, 562 edits. Per-bucket detail in
[rung3/round3.md](rung3/round3.md); source `scripts/rung3/empty_crop_probe.py`,
`width_split_probe.py`, `beam_weight_probe.py`.

| finding | number |
|---|---|
| crops with ≤3 notes | **5.5% of strips, 20.8% of all edits** (0.5–1.06 edits/gold token vs 0.03–0.05) |
| crops >1200 px | 13.8% of strips, **28.6% of edits** (0.082/token) |
| note-free crops that invented notes | **1 of 8** — bar was ≥50%, so **not hallucination** |
| splitting wide crops at a gutter | **132 → 174 edits, +31.8%** (19 of 45 have no internal bar-line) |
| slicer old → current, same 67 pages | <350 px **3.4% → 1.4%**; >1200 px **13.8% → 27.8%** |
| beam thickness, median | synthetic **0.500 S** (v4 = v5); real nota 0.567 S, exam 0.765 S |

- The 22%-too-thick sharp-bar finding **does not transfer** to beams — ours match the engraving
  standard and real print is *heavier*. ⚠ Thick tails are contaminated (synthetic = double beams,
  real = ink bleed); only the median is usable. ⚠ Measures **thickness**, not **grouping**, so it
  cannot validate `USUL_BEAM_GROUPS`.
- Post-encoder the model sees synthetic beams at **6.5 px** and real at **9–14.6 px** — a *width*
  effect, since our strips average 1229 px against real 904–1018 and shrink harder through the
  encoder's fixed box. **Followed up 2026-08-15 in the section below**, which measures what that
  costs in edits.

### Crop geometry: moved to its own file (2026-08-17)

The encoder's fixed 409×583 box, how much of a strip survives it, the padding probe that made
resolution **causal**, and the three-arm pilot that priced the fix are now
**[METRICS-GEOMETRY.md](METRICS-GEOMETRY.md)** — a genre split at the 400-line cap: this file is
*what the model gets wrong*, that one is *what the model is given*.

⚠ One line from it belongs here because it re-scopes a claim below: the edit budget **does** move with
encoder scale, while "resolution was ruled out" (the sharp-glyph section) was measured on per-class
accidental recall. Both stand; they measure different things.

### Staccato read as an augmentation dot (2026-08-15) — measured with a paired control

Owner-reported, then measured. `ADDED_TOKENS` has **no articulation token** (all 25 are accidentals,
structure and navigation) and the renderer draws no staccato, so 0 of 40,826 training strips carry
one: every dot the model has ever seen meant *longer*. A 1,215-strip pilot rendered twice from
`pieces_v4.json`, identical apart from the marks (manifests byte-identical, `verify-labels` PASS
1215/1215), gives a pool of **110 strips carrying ≥1 staccato whose gold has no dotted duration**:

| arm | strips decoded exactly | SER | **decoded a dot gold does not have** |
|---|---|---|---|
| control (no marks) | **110/110 = 100%** | 0.000 | **0 / 110 = 0.0%** |
| staccato | 30/110 = 27.3% | 0.058 | **80 / 110 = 72.7%** |

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
[rung3/levers.md](rung3/levers.md), decision owed to the owner ([STATUS.md](STATUS.md)).

## The microtonal-sharp defect — moved to its own file (2026-08-19)

Bravura's sharp bars were **22% too thick** and küçük's were packed too close, so its three bars
fused into a two-bar koma after the encoder shrink. Measured against two real printed editions,
fixed by `--thin-sharps`, and the "resolution was ruled out" line that came out of it carries a
scope caveat. All of it → **[METRICS-SHARPS.md](METRICS-SHARPS.md)**.
