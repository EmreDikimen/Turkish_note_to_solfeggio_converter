# Diagnostics — measured investigations into specific defects

purpose: why the model fails and what was tested — the probes, error attribution (label vs model), the sharp glyphs and the tuplets
audience: agents and the owner, before proposing a fix for a known weakness
updated: 2026-11-20

Split out of [METRICS.md](METRICS.md) on 2026-07-28 when that file crossed the 400-line cap. The
split is by genre: METRICS.md keeps the **scoreboard** (what the model scores, against which floors);
this file keeps the **investigations** behind those scores. Nothing is duplicated.

**Read the negative results.** Most of what follows is a hypothesis that was tested and did not
survive — each one is a change that was not built on a guess, and re-proposing it costs a round.

### Octave jumps and merged notes are RARE — a wrong pitch is one line or space off (2026-09-03)

Counted off the saved Round-3 decodes in `data/real/rung3/final/_taxonomy_cache/` (the files
`error_taxonomy.py` wrote on 2026-09-01), aligned on label tokens with that tool's `relabel` rule;
**no model ran and the exam was NOT re-decoded** — the exam column is the 2026-09-01 read
re-counted. Asked because the Round-4 vocabulary change was being argued from "the model gets
octaves wrong" ([rung3/round4.md](rung3/round4.md)).

| | R3 on `_realval_v2` (262) | R3 on `examv3` (660) | R2 on `_realval_v2` |
|---|---|---|---|
| pitched-note substitutions | 69 | 94 | 71 |
| **exactly one or two octaves off, same letter** | **1** | **2** | 1 |
| one staff step off | 14 | 13 | 13 |
| same pitch, wrong duration | 20 | 48 | 22 |
| two notes read as ONE (their durations sum to the decoded one) | **3 strips** | 0 | 4 |
| a repeated note dropped / a note doubled | 1 / 3 | 3 / 1 | 0 / 0 |

Per-octave error rate — a note substituted or dropped, over the gold notes at that octave:

| octave marks | real-val | exam |
|---|---|---|
| `'` | 5.7% (32 / 560) | 2.8% (35 / 1,252) |
| `''` | 7.1% (99 / 1,402) | 2.4% (85 / 3,595) |
| `'''` | **14.3% (3 / 21)** | **4.2% (3 / 72)** |

- **A wrong octave is really a wrong HEIGHT.** The model lands a line or space away, not an octave
  away. A fused letter+octave token cannot fix that; the vocabulary case rests on yield.
- **`'''` notes read about twice as badly, on 3 errors each — a LEAD, not a finding.** They are 1.1%
  of notes and sit on ledger lines; rarity, not token cost, is the likelier cause.
- **Two notes written as one is rare**, as the owner said ("nadiren"): 3 in 262 strips. Not a lever.
- ⚠ Substitutions involving a rest are excluded from the octave rows (a rest has no octave); the
  taxonomy's own `note-vs-rest` category carries them.

### ⛔ LEVER 7, THE SCAN PROFILE: NULL on its primary (2026-08-19, trained arm)

The arm ran on Colab (L4, 12 vCPU, ~2.6 h; stage 1 6,000 steps then stage 2 2,000, batch 16, mix
**screenshot .55 / photo .20 / scan .25** printed in both stages' startup line). Scored **paired**
against `r3-tupnew-stage2-best` with `ml/labels/paired_arm_score.py`, which reuses
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
  real-val loss kept falling to step 1,500 — [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) Lever 5's selector problem
  showing up live. **Both** checkpoints were therefore read, and both are null on the primary. The
  step-500 model is slightly the worse of the two on scanned pages (+0.071 vs +0.010), which is the
  direction under-training predicts.

### `_realval_v2` split five ways, and the "hard" tier is not the hard one (2026-08-19)

Measured while building Lever 7's scoring instrument (`ml/labels/split_realval_tiers.py`), on
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
  ([archive/rounds.md](archive/rounds.md#the-scan-profile--round-3s-first-trained-arm-lever-7--null)).

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
leaned on this mark to find errors. Run with `npx tsx tools/dev/page-structure.ts`, which uses the
**shipped** stitcher and core helpers (`stitchStrips` with `expand:false`, `deriveTimeSignature`,
`measureBeats`) so the number is the one the editor actually draws.

| | pages | interior bars | off-meter |
|---|---|---|---|
| real decoded pages, `strips_v2` | **1,670** | 40,937 | **15,491 = 37.8%** |

Median share per page **40%**; only **7.2%** of pages come out clean.

⚠ **This tempers, without contradicting, the claim in [app/editor.md](app/editor.md)** that the mark
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
26.3% of errors at a 10% budget against a ≥60% bar ([app/README.md](app/README.md#standing-findings--the-product-track-established-and-still-true)). ⚠ Note what
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
fixed height → **[METRICS-DIAGNOSTICS.md](#tuplets--the-corpus-scan-the-printed-mark-and-what-follows-the-notes)**.

### ⛔ A ~2% pre-shrink: exam −15.5%, real-val −1.6%. DID NOT REPLICATE (2026-07-28)

Per-strip staff-line spacing, measured on the strips as they reach the model. The slicer targets
`TARGET_SPACING = 30.0` px; the renderer produces exactly that.

| pool | mean px | sd | p10 | p90 | vs synthetic |
|---|---|---|---|---|---|
| synthetic `strips_v4` | **30.000** | **0.000** | 30.000 | 30.000 | — |
| real exam | **30.496** | 2.096 | 29.50 | 31.75 | **+1.65%** |
| real-val | 30.197 | 1.032 | 29.75 | 30.50 | +0.66% |
| real nota | 30.122 | 0.701 | 29.50 | 30.75 | +0.41% |

Correcting the size at inference (`ml/labels/staff_geometry_probe.py`, frozen
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
  predicting 29.95 px — not the 30.5 observed (`ml/labels/spacing_estimator_probe.py`).
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
[archive/rounds.md](archive/rounds.md#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are); source `ml/labels/empty_crop_probe.py`,
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
**[METRICS-INPUT.md](METRICS-INPUT.md#crop-geometry--what-the-encoder-is-actually-given)** — a genre split at the 400-line cap: this file is
*what the model gets wrong*, that one is *what the model is given*.

⚠ One line from it belongs here because it re-scopes a claim below: the edit budget **does** move with
encoder scale, while "resolution was ruled out" (the sharp-glyph section) was measured on per-class
accidental recall. Both stand; they measure different things.

### The dot and articulation holes — moved to their own file (2026-08-20)

**The staccato read as an augmentation dot** (72.7% → **0.0%**, closed by a trained arm) and **the
dotted usul barline read as `\repstart`** (7.8% of `batch3` rows, owed) both live in
**[METRICS-INPUT.md](METRICS-INPUT.md#diagnostics--the-symbols-the-model-has-never-been-shown)** — together, because they have the same cause: a printed
symbol with no token, no drawn pixels, and therefore no legal way to say it. That file also carries
the finding the pairing produced — **a hole responds to being filled; a domain gap does not**.

## The microtonal-sharp defect — moved to its own file (2026-08-19)

Bravura's sharp bars were **22% too thick** and küçük's were packed too close, so its three bars
fused into a two-bar koma after the encoder shrink. Measured against two real printed editions,
fixed by `--thin-sharps`, and the "resolution was ruled out" line that came out of it carries a
scope caveat. All of it → **[METRICS-DIAGNOSTICS.md](#the-microtonal-sharp-defect--the-glyph-investigation)**.

## Where an error COMES FROM — moved out (2026-09-09)

Attribution (was it the SymbTr label or the model that was wrong, and about what?) and the `nd`
gate's own diagnosis are a different genre from the ranking and geometry counts this file keeps, and
they crossed the 400-line cap on arrival: **[METRICS-DIAGNOSTICS.md](#where-an-error-comes-from--the-label-or-the-model)**.

**Merged into this file on 2026-11-20:**

- [Where an error comes from — the label, or the model?](#where-an-error-comes-from--the-label-or-the-model) — was `docs/METRICS-DIAGNOSTICS.md`
- [The microtonal-sharp defect — the glyph investigation](#the-microtonal-sharp-defect--the-glyph-investigation) — was `docs/METRICS-DIAGNOSTICS.md`
- [Tuplets — the corpus scan, the printed mark, and what follows the notes](#tuplets--the-corpus-scan-the-printed-mark-and-what-follows-the-notes) — was `docs/METRICS-DIAGNOSTICS.md`


## Where an error comes from — the label, or the model?

*Was `docs/METRICS-DIAGNOSTICS.md` (last updated 2026-09-16).*

> Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-09-09 at the 400-line cap.
> That file keeps ranking, geometry and window counts; this one keeps **which source was wrong**.
> Current state and next action are NOT here: [STATUS.md](STATUS.md).

---

### Verdicts attributed to the LABEL or to the MODEL, by kind (2026-09-09)

`ml/labels/verdict_attribution.py`, no model run. Every review row carries three texts — the
SymbTr-derived `label`, a model's `decoded`, and the owner's `truth` — so each row prices the label
and the model **independently**. ⛔ The three populations are selected differently and may never be
pooled. ⚠ Counts are in LABEL-TOKEN space (`error_taxonomy.relabel`), so they are **not**
`eval_omr` edit counts.

**Two controls, both load-bearing, both found by the numbers looking wrong.**

- ⛔ **The decode caches predate the `\tie` retirement.** Left in, that one dead token was **70% of
  the `other` column** and the largest apparent model mistake in the accepted pool. Stripped, `other`
  falls to **0.3%** and the taxonomy is usable. It is an artefact of the vocabulary change.
- ⛔ **`review_ui.baseText` seeds the edit box with the LABEL's `\sig` block plus the DECODE's
  content.** A reader who accepts what is on screen therefore lands on the decode for notes and the
  label for the signature — which is *exactly* the shape "label wrong about notes, model wrong about
  the signature" that the raw tables show. Only **7% / 12% / 28%** of rows in the three populations
  were actively re-typed. Every number below is the `--active-only` cut.

| population | n (active) | both right | only LABEL wrong | only MODEL wrong | BOTH wrong |
|---|---|---|---|---|---|
| accepted, label confirmed (`h1`) | 233 | — | — (definitional) | **100%** | — |
| accepted, label corrected (`h1`) | 65 | 0% | **24.6%** | 0% | **75.4%** |
| refused (`examv3`) | 82 | 0% | 13.4% | 1.2% | **85.4%** |

⚠ In the first row `truth` **is** the label (that is what `ok` asserts), so its label column is
tautological and only the model column is a finding.

**Distance to the owner's answer** (label tokens, active rows): accepted-corrected — label median
**2.0**, model median **1.0**; refused — label median **4.0** (31.7% within 2 edits), model median
**1.0** (75.6% within 2).

**What each source gets wrong.** The label's dominant failure is the **signature**, and the seeding
works *against* finding it, so it is understated rather than inflated:

| where only the LABEL was wrong | share | n |
|---|---|---|
| `h1` accepted-corrected | **signature 93.3%** | 60 |
| `strips_nota` (retired crops) | **signature 49.5%** | 212 |
| `examv3` refused | accidental 26.4%, signature 24.5% | 53 |

The model's profile is different. On **accepted** material its residual errors are tuplet **24.0%**,
duration 20.8%, pitch 19.2%, repeat-structure 19.2% — accidentals only **0.6%**. On **refused**
material: pitch 18.2%, tuplet 18.2%, signature 16.9%, duration 14.3%, accidental 10.4%. Its top sign
substitution across all rows is **`\komaSharp` → `\kucukSharp`, 9 occurrences** — the known
koma/küçük weakness, in the direction the owner corrected 10:0.

⭐ **The finding that changes a plan: on refused material BOTH sources are wrong 85.4% of the time.**
Neither the label nor the model can be trusted alone there, which is what the emitter's refusal is
for — and why recovering those strips needs a human, not a better referee
([rung3/round4.md](rung3/round4.md) step 5).

### `nd_high` is mostly a wrong LABEL, not a strip the model cannot read (2026-09-09)

`nd = lev(label, decode) / len(label)`; over 0.35 the emitter DROPS the strip. In `--exam` mode it
reviews instead, so **85 `nd_high` rows carry the owner's own answer**. Of the 75 `fix` rows:

| | median distance to the owner's answer | within 2 edits |
|---|---|---|
| the SymbTr **label** | **20.0** | 1% |
| the model's **decode** | **0.0** | 91% |

Same in the dense half (n=20): **24.5** against **0.0**. ⚠ Anchoring explains a small distance, not
a 20-edit one — the reader is reading the picture.

**They are also not denser** (ids of music in the crop, `round2-stage2-best`'s own decode): accepted
**37**, all `nd_high` **37**. ⭐ **The one subset that IS dense**: the **1,678** strips `strips_b8`
dropped as `over_budget` and `strips_h1` drops as `nd_high` carry a median of **49**. Their nd
median is 0.54, and **nobody has read one** — `build_ndhigh_queue.py` stages 40 at random
([rung3/labeling.md](rung3/labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3)).

⚠ Scale of the disagreement, all `nd_high` in `strips_h1` (n = 4,701): nd median **0.59**, 48% above
0.60, max **15.33** (the decode is 15× the label's length — a total misalignment).

### When the label and the decode AGREE, how often are they right? (2026-09-10)

Re-measured on **every h1 row a human has read** (n = 3,864), against the August estimate's n = 169.
Comparison is token-for-token with `\tie` dropped and a spaced `32` re-glued.

| the two sources | rows | correct |
|---|---|---|
| identical | 945 | **99.6%** (4 fix) |
| identical ignoring spaces | 2,120 | **99.4%** (12 fix) |
| **agreement, combined** | **3,065** | **99.5% — 16 wrong** |
| they differ | 799 | **31.4%** |

⚠ **Agreement is not independence, and two things break it.** The errors **clump**: those 16 sit on
**8 pages** and one page holds 6 — when a page is misread, both sources tend to be wrong the same
way. And the decodes these queues show come from **`round2-stage2-best`**, not the current model
(only `handtest` uses `r3a-stage2-best-real`), so part of the agreement is memory: that model was
trained on labels largely carried into b8.

⭐ **THE SIGNATURE IS WHERE IT BREAKS BY CONSTRUCTION, AND ONE RULE CATCHES IT** (owner, 2026-09-10:
*"sadece sig bloğu içinde komaSharp veya kucukSharp varsa otomatik accept etme"*). The emitter
overwrites a label's `\sig` block with a majority vote over the model's own row-start decodes, so
there the label can BE the decode. Back-tested on the 3,065:

| | rows | share | errors | error rate |
|---|---|---|---|---|
| held back — `\sig` block spells a koma or küçük sharp | 56 | 1.8% | **7 of 16** | **12.50%** |
| let through | 3,009 | 98.2% | 9 | **0.30%** |

**1.8% of the volume for 44% of the mistakes**, a 40× separation. ⚠ Inside the block only — an
inline koma/küçük sharp after `\sigend` is read off the staff and is independent of the vote.
Signature rows are 38% of agreeing rows but 63% of their errors.

**Applied to `strips_h1` the same day:** 261 rows auto-accepted (242 exact, 19 whitespace-only),
marked `by="agree"` / `"agree-ws"` so they stay distinguishable and reversible; the owner's reading
queue fell **571 → 309**. ⛔ **The 100 `new_dense_sample` rows were excluded** — they are a random
sample staged to estimate how dirty the rescued strips are, and auto-accepting the agreeing half
would leave a remainder biased toward disagreement, destroying the rate they exist to produce.
Verified after the write: no human verdict was overwritten.
⚠ **SUPERSEDED 2026-09-11 (recorded 2026-09-16):** after 31 hand reads the owner released the sample,
and **37** of its rows were auto-accepted. The rate survived because every row left was then read by
hand — see the next section.

### ⚠ A `fix` verdict does not always fix anything (2026-09-10)

Counting `fix` rows overstates the escaped-bad rate, and on one queue it does so enormously.
Measured by comparing `corrected_label` against `label` in token space:

| queue | verdicted | `fix` | of those, change **nothing** | real corrections |
|---|---|---|---|---|
| **`h1-audit`** | 29 | 27 | **23** | **4** |
| `b8-audit` | 201 | 27 | 1 | 26 |
| `h1-full` | 4,126 | 550 | 15 | 535 |

⛔ **So h1-audit reads 93% `fix` and is really 4 of 29 — 13.8%**, in line with b8-audit's **12.9%**
(26 real of 201), the figure this project quotes as the escaped-bad rate. The no-ops are byte-identical,
not re-spacings, so they are a verdict pressed without an edit rather than a retype.
⚠ **Quote real corrections, never `fix` counts**, and check the two before comparing queues.

⭐ **And the errors are where agreement is not:** all **4** of h1-audit's real corrections sit in rows
where the label and the decode DIFFER. Of its 23 read rows where they agree, **zero** carry a real
correction — the same picture as h1-full's 0.30%.

**Auto-accept applied to `h1-audit` the same day:** 149 rows (143 exact, 6 whitespace-only), 3 held
back by the koma/küçük signature rule, leaving **49** to read. ⚠ The sample stays usable because the
strata are marked: `by="agree"` rows carry the measured 0.30% error rate and the hand-read rows carry
what they carry, so an escaped-bad rate is still a weighted estimate rather than a lost one.

### ⭐ The rescued strips were twice as dirty — measured on all 571, not a sample (2026-09-16)

The 571 `h1-full` rows no human had read before 2026-09-10 are the strips scheme H let back in. All
571 now carry a verdict, in two strata: the rows where label and decode **disagree** were all read by
hand, and the rows where they **agree** were read by hand (25) or auto-accepted (298). Errors are
real corrections plus `bad`, with no-op `fix` verdicts not counted, as above.

| population | n | read by hand | auto-accepted (agree) | errors | rate | 95% (Wilson) |
|---|---|---|---|---|---|---|
| **all rescued rows** | **571** | 273 | 298 | **150** (146 fix + 4 bad) | **26.3%** | **22.8–30.0%** |
| the seeded random sample | 100 | 63 | 37 | 26 | 26.0% | 18.4–35.4% |
| `b8-audit` — the comparison | 201 | 201 | 0 | 26 | 12.9% | 9.0–18.3% |

- ⭐ **It separates**: the rescued rows' lower bound (22.8%) sits above b8's upper bound (18.3%).
  The new material came in about **twice as dirty** as b8's machine-accepted rows.
- ⭐ **Every one of the 150 errors sits where label and decode disagree.** The 25 agreeing rows read
  by hand carry **0** real corrections (14 are no-op `fix`), in line with the 0.30% measured on 3,009.
  So the 298 auto-accepted rows are expected to hide about **1** wrong label.
- ⚠ **Measured AND fixed.** Each of the 150 was corrected or removed and promoted into
  `strips_h1/manifest.jsonl` the same day, so the pool trains on corrected labels; the rate says how
  dirty the material *was*, not how dirty the pool *is*.
- ⚠ The sample and the whole population agree (26.0% / 26.3%), which is the check that the
  2026-09-11 release did not bias the read.

**The rest of the pool, now fully read:**

| queue | n | errors | rate | 95% | note |
|---|---|---|---|---|---|
| `h1-audit` (the emitter's 5% sample of everything it accepted) | 227 | 36 (34 fix + 2 bad) | 15.9% | 11.7–21.2% | 149 rows auto-accepted; overlaps b8's 12.9%, and it includes rescued rows |
| `h1-rail` (the 35 strips the rail split out) | 35 | 14 | 40.0% | 25.6–56.4% | n = 35: a lead, not a rate to plan on |

**Promoted 2026-09-16** (`promote_labels.py --vocab h --audit-csv full_audit.csv --audit-csv
rail_added.csv`): **185** labels replaced (160 `h1-full` + 25 rail, no-ops included), **4** rows
removed, **0** rejects; the pool is **4,456** rows. The rail file needed the new `--audit-csv` flag —
`merge_rail_strips.py` keeps those rows out of `full_audit.csv` on purpose, so their 14 real
corrections had no way into training before it.


## The microtonal-sharp defect — the glyph investigation

*Was `docs/METRICS-DIAGNOSTICS.md` (last updated 2026-08-19).*

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-08-19 when that file crossed
the 400-line cap. The split is by genre: that file keeps the **investigations into how the model
reads a page**; this one keeps the one investigation into **a glyph we were drawing wrong**. Nothing
is duplicated. The fix it produced is `--thin-sharps` / `drawThinSharps`, on in every corpus since
`strips_v5`.

### The microtonal-sharp defect (measured against two real printed editions)

| Quantity | Real print | Bravura (ours, before) | Ours, after `--thin-sharps` |
|---|---|---|---|
| Sharp bar thickness | 0.300 S | 0.367 S (+22%) | 0.300 S |
| küçük bar pitch (spacing) | 0.550 S | 0.483 S (−14%) | 0.65 S (deliberately wider) |
| küçük white gap | 0.250 S | **0.116 S** (~1–2 px after the encoder shrink) | clears the shrink |

- koma/bakiye were never at risk (0.58–0.66 S gaps).
- The error was **one-directional**: gold `\kucukSharp` decoded as `\komaSharp` **11× on the clean
  exam, 10× on photos**; the reverse essentially never. Matches the 100%-precision / 48%-recall
  signature.
- Resolution was **ruled out for this defect**: recall does not fall with encoder scale
  (1.22 → 0.24) on either dataset; `\bakiyeSharp` holds 84–94% in every bucket. ⚠ **Scope, added
  2026-08-15:** that test was per-class ACCIDENTAL RECALL, on glyphs that survive a shrink. It was
  never run against the edit budget, and the edit budget *does* move with encoder scale — see "The
  encoder's input box" above. Both statements stand; they are about different measures.
#### Where the sharps are PRINTED (measured 2026-07-26 — corrects the framing above)

Every gold and corpus label split into tokens inside the row-start `\sig … \sigend` block versus
tokens on a note. The scorers count both (no stripping), so both feed the AEU headline.

| Set | `\kucukSharp` on a note | `\kucukSharp` in the signature |
|---|---|---|
| Clean exam v2.1 (352 strips) | **1** | **30** |
| Clean exam, contamination-corrected (326) | 1 | 32 |
| Photo gold (109 hand-corrected labels) | 3 | 13 |
| `strips_v3` corpus | 234 tokens / 206 strips | 1,210 strips |

- **The class is scored almost entirely in the key signature**, not on noteheads. `\komaSharp` runs
  the same way on the exam (2 inline / 12 in-signature).
- Structural reason: the carry serializer's `sigTolerant` rule prints a note bare when its
  alteration runs the same direction as the signature's (SymbTr stores the SOUNDING value — eviç is
  a 5-comma F♯ printed bare under a koma-sharp-F signature). Real pages therefore rarely print
  küçük on a note at all. Verified end-to-end: a dry render of two küçük-heavy pieces under
  non-küçük signature variants produced **zero** inline `\kucukSharp`.
- **In the context that scores, `strips_v3` is not imbalanced**: küçük appears in 1,210 signature
  strips against koma's 1,422 (bakiye 6,512). The 9× "1,887 vs 206" gap below is an inline-only
  statistic about a context holding ~1 of the exam's 33 küçük tokens.
- The real corpus gap is **diversity, not count**: signature-position küçük comes from just **3
  makams** (mahur, nisaburek, süzidilara) and 4 distinct spellings.
- **Inline counts, for the record:** `strips_v3` carries `\komaSharp` inline in 1,887 strips vs
  `\kucukSharp` in 206 (0.5%), and zero strips hold both. Kept because it is a true statement about
  note-position coverage — it is simply not what the exam measures.


## Tuplets — the corpus scan, the printed mark, and what follows the notes

*Was `docs/METRICS-DIAGNOSTICS.md` (last updated 2026-08-19).*

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-08-19 when that file crossed
the 400-line cap. The split is by genre: that file keeps **how the model fails**, this one keeps
**what a triplet looks like** — in our labels, in our renderer, and on a real page. Nothing is
duplicated. The thread these serve is [archive/rounds.md](archive/rounds.md#tuplets--why-tup3-recall-keeps-missing-its-floor); the A/B they informed
ran and was **null** (p = 0.688).

#### Tuplets — the corpus scan and the renderer constants (2026-08-11)

Taken while diagnosing why `\tup3` recall misses its floor. Reading:
[archive/rounds.md](archive/rounds.md#tuplets--why-tup3-recall-keeps-missing-its-floor). Scores themselves: [METRICS.md](METRICS.md).

**Noteheads per `\tup3` group**, over every label pool we own — `strips_tup`, `strips_nota`,
`strips_exam_v2`, `strips_v4`:

| noteheads | groups | note |
|---|---|---|
| 3 | **20,244** | 99.98% |
| 2 | **4** | all in `strips_tup`; 2 legitimate, 2 do not sum |
| >3 | **0** | the shape is rare in Turkish notation (owner) — absence is correct, not a gap |

The two legitimate ones are a 32nd + a 16th (`c''32 b'16`, `c''32 \natural b'16`) — three units of
time in two noteheads, which the closing arithmetic accepts. The two that do not sum are
`\bakiyeSharp g''8 a''8` (twice): 2 units where 3 are needed. Unresolved — a wrong label or a crop
that cut a group.

⚠ **This retires "all groups are exactly 3 closed notes"** ([rung3/labeling.md](rung3/labeling.md),
2026-07-18). It was true of the 114-group manifest and is not true of the 205-group one.

**What the renderer draws**, as of this date (`apps/web/src/score/SheetView.tsx`):

| constant | value | where |
|---|---|---|
| curved-arc style share | 70% of pieces, by name hash → **90% from 2026-08-12** | `tupletCurved` |
| slur distractors | fire on **35%** of eligible ≥3-note runs | `slurRng() < 0.35` |
| the "3" | 13 px bold italic serif, placed **above** the arc apex → **redrawn 2026-08-12** | `drawTupletArc` |
| arc stroke | 1.1 px, one unbroken quadratic → **two segments 2026-08-12**, same weight | `drawTupletArc` |

⚠ **Real Turkish print breaks the arc and sets the "3" inside the gap** (owner, 2026-08-11, from a
real page). The renderer's continuous-arc-plus-floating-digit is not the printed shape, and it is
the leading hypothesis for the recall deficit.

#### The printed triplet mark, MEASURED (2026-08-12) — the owner's report holds, 16/16

`ml/labels/tuplet_mark_probe.py`. The script locates digit-like components that have arc-like ink
beside them and writes matched-staff-size tiles (a 4× zoom with a one-staff-space ruler, and the same
window after the 409×583 Donut resize); **a human accepts or rejects each tile** and the geometry is
then taken by scanning outward from the digit along its own row band. It deliberately builds no mark
detector — the false positives it does surface (lyric syllables, the tempo mark `♩=76—84`) are exactly
why. 20 tiles read on `strips_tup` → 12 accepted; 8 read on `strips_exam_v2_clean` → 5 accepted.

**Every one of the 16 accepted marks is BROKEN with the "3" in the gap**, across ~11 editions.

> ⛔ **CORRECTED 2026-08-19 — this measurement stands, the generalisation drawn from it does not.**
> The line that followed read *"Not one continuous arc with a floating digit, across ~11 editions."*
> Two real scanned editions supplied by the owner draw a **continuous arc with the italic "3" set
> inside the concavity** — Kemânî Sebuh / Sofyan, and Avni Anıl / Düyek (the latter over dense
> contiguous triplet runs). The sample was 16 tiles from **two pools we already own**, and the style
> is absent from both, so the probe could not have found it. 16/16 describes those pools; Turkish
> print at large has at least two shapes. Geometry for the third style is measured separately, on
> those pages, before it is drawn ([archive/rounds.md](archive/rounds.md#tuplets--why-tup3-recall-keeps-missing-its-floor), [DECISIONS.md](DECISIONS.md)).

| quantity, in staff spaces | real print (n=16) | ours, curved style | ours, bracket style |
|---|---|---|---|
| gap between the arc's inner ends | **1.63** (range 1.55–1.69) | — (continuous) | 1.27 |
| clearance each side of the digit | **0.43** | — | — |
| digit height | **1.20** | 0.97 | 0.97 |
| digit width | **0.76** | 0.87 | 0.70 |
| digit centre vs the arc's inner ends | **+0.20** (just inside, toward the staff) | +1.27 (fully outside) | in the gap |
| one segment's rise, outer end → gap | **~0.95** | 1.00 (whole arc's depth) | — |
| arc stroke | 0.133–0.168 | 0.100 | — |

**The gap is sized to the digit, not to the group.** It is 1.63 S whether the mark spans 4.5 S or 28 S
— i.e. the digit's own width plus ~0.43 S of air each side. A fraction-of-span rule would have been
the natural guess and it is wrong.

**Our own bracket style is structurally closer to real print than our arc is** — it already breaks
around the digit. Only the curved style (70% of pieces then, 90% now) ever carried the defect.

**The redraw lands on the measurements**, checked with `--dir` on the pilot render: gap **1.63**,
digit **0.70 × 1.20**, clearance **0.43 / 0.50**, digit centre **0.20** inside the ends.

#### The THIRD style measured (2026-08-19) — continuous arc, "3" inside the concavity

`tuplet_mark_probe.py --images data/real/tuplet_marks --accept …`, on the two real editions the
owner supplied. The probe needed three additions to read them at all, and each is a fact about
scanned pages rather than about tuplets:

- **A scanned page is ONE connected component.** On the Kemânî Sebuh page the arc, the digit, every
  notehead, both beams and all five staff lines form a single blob 2,026 px wide — component logic,
  which is this file's whole method, can say nothing until the staff lines are erased (`--destaff`).
- **A full-width row rarely reaches the 0.6 ink fraction** that defines a staff line here: 0.57 and
  0.61 maxima on the two scans, against 0.95 born-digital. `--staff-thresh` exists for that and
  **the pools keep 0.6**.
- **The concave style sets its digit ON the top staff line**, so the candidate filter's "reject
  anything touching a line" rule threw it away. Dropped only when the lines have been erased.

**n = 5 marks, one page.** The second page (Avni Anıl) confirms the style by eye but its staff
detection reads 12.6–14.8 px across thresholds — unstable, so it is **not** measured. Sub-staff-space
geometry off a 548 px two-system scan would not be worth quoting.

| quantity, in staff spaces | real, concave (n=5) | ours, as rendered | ours, broken style |
|---|---|---|---|
| clearance, arc underside → digit top | **0.91** (0.57–1.00, n=3 clean) | 1.00 | — (digit is in the gap) |
| **digit and arc are ONE component** | **no, 0 of 5** | no, 0 of 6 | no |
| digit centre along the span | **0.44** (0.40–0.56) | 0.50 | in the gap, 0.49–0.50 |
| digit height | **1.22** (1.13–1.26) | 1.20 | 1.20 |
| digit width | **0.83** (0.83–0.91) | 0.77 | 0.76 real / 0.70 ours |
| whole mark's span | 6.74 (5.87–7.26) | 7.20 | — |
| arc depth | 1.65–2.39 | 1.60 | — |
| arc stroke | 0.174–0.217 | **0.100** | 0.100 |

**The load-bearing row is the second one.** Our *legacy* mark had the digit touching the apex, so arc
and digit were one component — a slur with a bump, and that is what made it indistinguishable from a
phrase slur. Real print in this style keeps them apart, which is why the shape is worth drawing at
all rather than being a repaint of the mark we already abandoned.

⚠ **The arc stroke is again left at the slur's weight**, and again deliberately: real print draws
this arc heavier still (0.174–0.217 S against our 0.100), but thickening only the tuplet arc invents
a thickness cue against phrase slurs. Owed jointly with `drawSlurArc`, exactly as for the broken mark.

⚠ **How often either style is used is NOT measured.** Two pages are an existence proof, not a
frequency, so `TUPLET_MARK_CONCAVE.share` is chosen. Replace it by counting marks across editions
with the probe.

#### The mark FOLLOWS THE NOTES — measured 2026-08-12 after the owner's review

The owner's verdict on the first redraw: right shape, wrong rigidity — *"in real editions the tuplets'
arms follow the notes, up or down"* — plus "reduce the font weight of the 3". Both were then measured
on `strips_tup/ben_guzele_…_p2_s01_w03.png`, one strip carrying **four descending triplets** (7 arms):

| quantity, in staff spaces | real print | ours now |
|---|---|---|
| an arm's outer end clears **its own** end note | 0.86–0.93 (left arms), 0.60–0.73 (right arms) | 0.85 both |
| the gap's height over the group's **highest** note | 1.40–1.43 (n=3) | 1.43 |
| the digit's position along the mark's span | **0.49–0.50** — the middle | 0.50 |

**The digit stays centred, and that is the non-obvious part.** A descending printed mark *looks*
weighted toward its high side, so the first attempt slid the gap over the highest note — which
degenerates into a stub arm whenever that note is an outer one. The measurement says the asymmetry
comes entirely from the arms' **slopes**: ends follow the notes, digit stays at mid-span.

- The printed digit is **regular weight**, not bold (owner, against real pages). At the same 16 px it
  measures 0.70 S wide against print's 0.76 — narrower, which only widens the clearance, so the
  shrink rule is satisfied with more margin.
- ⚠ **n is small and one-page for the arm numbers** (7 arms, 3 gap heights, one edition), against 16
  marks / ~11 editions for the gap-and-digit table above. Quote them with that.

- **Caveat on the `span`, `seg w` and `rise` columns:** where a segment merges with a staff line or a
  long slur, its component inflates those three (4 of 17 rows). `gap`, `digit_h` and `digit_w` are
  band-scanned locally and unaffected. One exam row (`askin_o_sihirli…`) reports `gap 0.77 / gapL
  0.00` because a staff line crosses the digit's row band; its tile shows a normal gap.
- **Deliberately NOT changed:** real print's arc stroke is *heavier* than ours (0.133–0.168 vs 0.100).
  Thickening only the tuplet arc would hand the model a thickness cue separating it from a phrase
  slur that real pages do not have — the same trap `AEU_SHARP_STROKE` documents. It is owed as a
  joint change with `drawSlurArc` — still owed, and still joint, now that the shape A/B has run and
  come back null (2026-08-15, [archive/rounds.md](archive/rounds.md#tuplets--why-tup3-recall-keeps-missing-its-floor)).
- **The digit's FONT changed, and the gap is why.** Bold italic Georgia (an old-style figure) measured
  **1.10 S wide** at real print's height, leaving 0.26 S of clearance instead of 0.43 — it would have
  fused with the arc ends after the shrink. Upright Times at 16 px measures 0.77 × 1.20 S. The slant
  itself stays unmeasured; the width was not optional. Pre-registered: if the digit fuses again,
  **widen the gap, never shrink the digit**.
