# Diagnostics — measured investigations into specific defects

purpose: the single home for "why does it fail, and what did we test" — the probe results, including the ones that came back negative
audience: agents and the owner, before proposing a fix for a known weakness
updated: 2026-08-18

Split out of [METRICS.md](METRICS.md) on 2026-07-28 when that file crossed the 400-line cap. The
split is by genre: METRICS.md keeps the **scoreboard** (what the model scores, against which floors);
this file keeps the **investigations** behind those scores. Nothing is duplicated.

**Read the negative results.** Most of what follows is a hypothesis that was tested and did not
survive — each one is a change that was not built on a guess, and re-proposing it costs a round.

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

### Tuplets — the corpus scan and the renderer constants (2026-08-11)

Taken while diagnosing why `\tup3` recall misses its floor. Reading:
[rung3/tuplets.md](rung3/tuplets.md). Scores themselves: [METRICS.md](METRICS.md).

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

**What the renderer draws**, as of this date (`apps/web/src/SheetView.tsx`):

| constant | value | where |
|---|---|---|
| curved-arc style share | 70% of pieces, by name hash → **90% from 2026-08-12** | `tupletCurved` |
| slur distractors | fire on **35%** of eligible ≥3-note runs | `slurRng() < 0.35` |
| the "3" | 13 px bold italic serif, placed **above** the arc apex → **redrawn 2026-08-12** | `drawTupletArc` |
| arc stroke | 1.1 px, one unbroken quadratic → **two segments 2026-08-12**, same weight | `drawTupletArc` |

⚠ **Real Turkish print breaks the arc and sets the "3" inside the gap** (owner, 2026-08-11, from a
real page). The renderer's continuous-arc-plus-floating-digit is not the printed shape, and it is
the leading hypothesis for the recall deficit.

### The printed triplet mark, MEASURED (2026-08-12) — the owner's report holds, 16/16

`scripts/rung3/tuplet_mark_probe.py`. The script locates digit-like components that have arc-like ink
beside them and writes matched-staff-size tiles (a 4× zoom with a one-staff-space ruler, and the same
window after the 409×583 Donut resize); **a human accepts or rejects each tile** and the geometry is
then taken by scanning outward from the digit along its own row band. It deliberately builds no mark
detector — the false positives it does surface (lyric syllables, the tempo mark `♩=76—84`) are exactly
why. 20 tiles read on `strips_tup` → 12 accepted; 8 read on `strips_exam_v2_clean` → 5 accepted.

**Every one of the 16 accepted marks is BROKEN with the "3" in the gap.** Not one continuous arc with
a floating digit, across ~11 editions.

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

### The mark FOLLOWS THE NOTES — measured 2026-08-12 after the owner's review

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
  come back null (2026-08-15, [rung3/tuplets.md](rung3/tuplets.md)).
- **The digit's FONT changed, and the gap is why.** Bold italic Georgia (an old-style figure) measured
  **1.10 S wide** at real print's height, leaving 0.26 S of clearance instead of 0.43 — it would have
  fused with the arc ends after the shrink. Upright Times at 16 px measures 0.77 × 1.20 S. The slant
  itself stays unmeasured; the width was not optional. Pre-registered: if the digit fuses again,
  **widen the gap, never shrink the digit**.

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
- Resolution was **ruled out for this defect**: recall does not fall with encoder scale
  (1.22 → 0.24) on either dataset; `\bakiyeSharp` holds 84–94% in every bucket. ⚠ **Scope, added
  2026-08-15:** that test was per-class ACCIDENTAL RECALL, on glyphs that survive a shrink. It was
  never run against the edit budget, and the edit budget *does* move with encoder scale — see "The
  encoder's input box" above. Both statements stand; they are about different measures.
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
