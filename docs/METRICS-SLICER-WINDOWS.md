# Slicer windowing and the crop frame — measured

purpose: the single home for how `page_to_strips.py` CUTS a row into strips — the windowing retune, the vertical frame, the shared-edge trim, and the ideas that measured out to nothing
audience: agents and the owner, before changing the windowing constants or the strip frame

updated: 2026-08-17

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-17 when that file crossed the 400-line
cap. The split is by genre: that file keeps **how a page is read into an ink mask** (binarization,
grayscale fidelity, opencv.js parity, which slicer the pools came from); this one keeps **how a row is
cut into crops**. Nothing is duplicated.

⚠ **Do not patch `page_to_strips.py` from reading this.** Two fixes written that way were reverted on
2026-07-28 (one was dead code, one was contradicted by the slicer's own manifests), and the 2026-07-29
windowing retune overturned its own premise once measured. Measure against real output first.

⚠ **The crop-geometry rails are a Round-3 lever and they are NOT shared with the renderer.**
`MEASURES_PER_STRIP` / `MAX_STRIP_W` (both env-switchable: `OMR_MEASURES_PER_STRIP`,
`OMR_MAX_STRIP_W`) cut real pages; the renderer packs synthetic strips by measures and label tokens
with no width rail at all. See [rung3/levers.md](rung3/levers.md), Lever 1.

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

### Whole-page spot check on an unseen screenshot (2026-07-29, n=1)

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

### The strip frame cut low beams off; the staff now floats inside it (2026-07-29)

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
