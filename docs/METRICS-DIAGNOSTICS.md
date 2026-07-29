# Diagnostics — measured investigations into specific defects

purpose: the single home for "why does it fail, and what did we test" — the probe results, including the ones that came back negative
audience: agents and the owner, before proposing a fix for a known weakness
updated: 2026-07-29

Split out of [METRICS.md](METRICS.md) on 2026-07-28 when that file crossed the 400-line cap. The
split is by genre: METRICS.md keeps the **scoreboard** (what the model scores, against which floors);
this file keeps the **investigations** behind those scores. Nothing is duplicated.

**Read the negative results.** Most of what follows is a hypothesis that was tested and did not
survive — each one is a change that was not built on a guess, and re-proposing it costs a round.

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
- ⚠ Not fully closed: real-val is the easy pool (0.9 edits/strip vs 1.7) and lacks the hard tier, so
  an effect confined to hard pages could hide there. Re-test after the real-val rebuild.
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

### The labelling pools are OLD-SLICER output (2026-07-28)

Strips on disk were written 2026-07-15..17; `page_to_strips.py` was overhauled 2026-07-25 and the
pools were never re-sliced. Re-slicing 5 queue pages and comparing crop-for-crop:

**0 of 30 crops are identical**, 2 no longer exist, and old slivers became full rows
(`gonul_sana_tapali..._s03_w00` **207 px → 1435 px**; `yuru_dilber_ney_p1_s01_w02` 409 → 1038) —
the sliver behaviour the overhaul fixed. **The frozen exam carries the same 2026-07-15..17 crops**,
so exam and real-val are consistent with each other but both measure a slicer no longer shipped.
Owner's read while labelling: the model does well, the failures were the old slicer's — though the
current slicer's crops still have some issues. Measured on 5 pages (164 old vs 147 current crops,
small sample, indicative only):

| | old slicer | current slicer |
|---|---|---|
| crops < 350 px (slivers) | 3.0% | **0.7%** |
| min_logprob < −1.0 (predicts a broken crop) | 3.0% | **0.7%** |
| min_logprob < −0.5 | 9.8% | 10.2% |
| clean and confident (> −0.1) | 72.6% | 70.7% |

**The catastrophic crops are ~4x rarer; the moderate ones are unchanged.** Re-slicing removes the
sliver class, not every bad crop — matching the owner's observation exactly.

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
  encoder's fixed box.


## The microtonal-sharp defect (measured against two real printed editions)

| Quantity | Real print | Bravura (ours, before) | Ours, after `--thin-sharps` |
|---|---|---|---|
| Sharp bar thickness | 0.300 S | 0.367 S (+22%) | 0.300 S |
| küçük bar pitch (spacing) | 0.550 S | 0.483 S (−14%) | 0.65 S (deliberately wider) |
| küçük white gap | 0.250 S | **0.116 S** (~1–2 px after the encoder shrink) | clears the shrink |

- koma/bakiye were never at risk (0.58–0.66 S gaps).
- The error was **one-directional**: gold `\kucukSharp` decoded as `\komaSharp` **11× on the clean
  exam, 10× on photos**; the reverse essentially never. Matches the 100%-precision / 48%-recall
  signature.
- Resolution was **ruled out**: recall does not fall with encoder scale (1.22 → 0.24) on either
  dataset; `\bakiyeSharp` holds 84–94% in every bucket.
### Where the sharps are PRINTED (measured 2026-07-26 — corrects the framing above)

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


## The slicer's windowing was never retuned after the 2026-07-25 fix (2026-07-29)

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

### The windowing retune was RUN (2026-07-29) — the constants are not the lever

The retune above was measured to its conclusion. **Neither `MEASURES_PER_STRIP` nor `MAX_STRIP_W`
is worth moving**, and the sweep that suggested lowering the first was scored on the wrong quantity.
Two genuine BUGS were found underneath it and fixed. Source: `src/vision/page_to_strips.py`.

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

**6. Two source pages collide on one stem** — `bir_nigah_et_ney_p1` and `nesem_emelim_ney_p1` each
exist under two makam directories with different content. Strip directories are keyed by stem, so
one page of each pair is silently overwritten. Not caused by the windowing work; found while
comparing pools. Unfixed.

### Neighbouring crops no longer overlap (`TRIM_SHARED_EDGE`, 2026-07-29)

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
