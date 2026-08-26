# Barlines — where the cut goes

purpose: what a barline is to the slicer, which gate rejects what, and the hand-marked ground truth that says how often it is right
audience: anyone about to change `detect_barlines` or argue about crop quality
updated: 2026-08-26

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-25 at the 400-line cap. That file
keeps the STAFF and the ink mask — binarization, staff geometry, x-extent; this one keeps the CUT.
Nothing is duplicated in either.

⚠ **Read the ground-truth section first.** Every other barline number in this project counts what
the detector DID; only that one says what it should have done, and it reframes the rest.

## A stem is a barline with a notehead on it — and the gate had the evidence all along (2026-08-24)

Owner-reported from the slice inspector on `Meltem - 1. Hane.png`, a **clean** page: all three rows
cut at note stems. The owner's proposal — *if a notehead sits at the end of the stroke it is a stem,
not a barline* — turned out to be already computed and simply not acted on.

`_terminal_overshoot` returns `wide_beyond`, "is there a notehead/beam attached past a staff line".
The gate only consulted it once the stroke ALSO overshot a staff line by more than `OV_TOL_SP`
(15 px). Every false barline on that page overshoots by **2, 10 and 14 px** — all under it. And on
row 1 the rule inverted completely: the **real** barline at page x=1180 was rejected `gate3_blob`
(a notehead touches it) while the **stem** 40 px to its left was accepted.

`wide_beyond` separates the page perfectly — false at every real barline (page x 1331, 1427, 892),
true at every stem (563, 1139, 785).

**Measured against SymbTr truth**, changing the rule to *any* overshoot carrying a notehead:

| | exact rows | improved | regressed |
|---|---|---|---|
| old rule | 73/124 (58.9%) | 28 | 11 |
| **notehead rule** | **86/124 (69.4%)** | **43** | **11** |

**+13 rows and the regressed count does not move.** `dn` errors of 2 fall 12 → 4. On Meltem all
three stems are gone and no cut crosses ink; the two remaining non-barline cuts are `_split_wide`
gutters in whitespace.

**The session as a whole is 60 → 86 of those 124 rows** — `data/real/rung3/score_slicer.csv`, the
run of 2026-08-24. The `old_*` columns in it are the pipeline the labelled pools were **actually cut
with**, so that is the honest before: **48.4% of truth-bearing rows matched the printed measure
count yesterday, 69.4% do now.** ⚠ **Do not read the 73 and the 88 above as that same baseline** —
each per-fix table holds the other fixes in a fixed state to isolate one change, and only this line
compares today's slicer against the shipped one. ⚠ Same construction caveat as everywhere in this
section: the truth comes from aligning the OLD pipeline's decodes, so a row it never read is absent
from all four numbers.

⚠ **The cost is a real barline that a notehead merely TOUCHES** — the ±3 px walk cannot tell that
from an attachment, and x=1180 above stays rejected. The owner judged that case rare and took the
trade; the flat regressed count is the evidence for it.

⚠ **A RETRACTED NUMBER.** This rule was first rejected on a probe that counted "runt measures"
(a measure far narrower than its row's median) and read −16.1% barlines for −49.4% runts. **That
metric is not valid for this question**: a false barline splitting a measure roughly in half
produces two normal-width measures and no runt at all, so the proxy was blind to the very cases the
rule fixes. The threshold sweep built on it (0/4/8/12/15 px, "monotone, ≥2.9 real bars lost per
runt fixed") is retracted with it. Truth-based scoring reversed the conclusion.

⚠ **The repair's unit must be the PAGE's spacing, not the group's own smallest gap** (2026-08-24,
owner-reported on a **876×1118 screenshot** of the same photocopy — a different file from the
1056×1290 original, and the resolution is what exposed it). There the surviving lines are
`[266, 285, 291]`: gaps of **19 and 6** on a page whose median line gap is **9**. The 6 is one real
line split into two clusters; `min()` took it as the unit and rebuilt a 6 px staff, which
`STAFF_REPAIR_SP_BAND` then refused at 0.67× — so the row was lost twice over. Using `page_sp` as
the base rebuilds it correctly and costs nothing: the original page is unchanged at 10 staves, the
screenshot goes 9 → 10, and truth-based scoring is unmoved at **86/124**.

⚠ **Still NOT fixed, and on the worst pages it is NOT a gate problem.** On the photocopy 8 of 10
rows find no interior barline. The candidates are not being wrongly rejected — the **ink is not
there**. Tracing row 0's three real barlines against the 119 px continuity floor (85% of the 140 px
band): page x=572 runs 136 px and does become a candidate, but **x=865 reaches 115 px** (4 px short)
and **x=425 reaches only 22 px**. That last one is a dashed remnant — 59 px of ink in four pieces
split by gaps of **11, 24, 17, 20 and 9 px**. Recovering it needs a gap-TOLERANT continuity test,
which is not a free change: a stem is already ~105 px of solid run, so a ~25 px gap budget lets
stem+beam chains reach the floor too. Not attempted; it needs its own measurement.

⚠ A two-mask experiment — find candidates on the sensitive mask, test thinness on strict Otsu — was
tried and **rejected**: interior bars on that page went 3 → 4 while `gate2_fat` rejections rose
68 → 76. The bloating hypothesis it was built on is wrong.

Corpus-wide, over 400 pages, **27.0% of all strips are width-split** and **11.0% of staff rows have
no interior barline at all**. Nothing here addresses that. ⚠ **Re-measured on the FINAL 2026-08-25
slicer (400 pages, 2,973 staff rows, 8,174 strips): width-split 29.8%, rows with no interior barline
12.3%** — both *higher*, and that is not a regression. The 24 August repairs rescue faded rows that
produced nothing before (+54 staves on 400 pages); they enter the denominator and a faded row is
exactly the kind that finds no barline. ⚠ The 27.0/11.0 pair records no sample or seed, so the two
are not a paired delta — read the new pair as the current state, not as a change.

## BARLINE GROUND TRUTH EXISTS NOW, AND THE SLICER FINDS 28% OF THEM (2026-08-25)

The owner hand-marked **every printed barline** on 38 staff rows over the 4 most faded pages of his
bad-crop list (`bozukNihavendLonga`, `gafil_ne_bilir…`, `aman_saki…`, `meclis_imeyde…`) —
**129 marks**, of which 93 are interior and 36 are row ends. Tools:
`build_barline_truth.py` → `mark.html` → `score_barlines.py`. Truth file:
`data/real/rung3/_barline_truth/barline_truth.json`. ⚠ **That file is GITIGNORED** (`data/real/rung3/*`)
and it is 15 minutes of irreplaceable hand-work in 3 KB. It contains only the owner's own
coordinates — no third-party content — so nothing stops it being committed, and it should be. Until
then, do not clean that directory.

⚠ **The sheets show nothing the slicer found.** Same rule as the exam gold: a marker shown the
detector's answer anchors to it.

**This is the first number in the project that says what the slicer SHOULD have found.** Every other
barline figure counts what it did.

| | value |
|---|---|
| **RECALL** | **26 / 93 (28.0%)** |
| **PRECISION** | **26 / 41 (63.4%)** — 15 false barlines |
| rows finding **no** interior barline at all | **12 / 38** |

**Why the 67 misses were missed** — the scorer names the gate, which is the whole point of it:

| reason | n | share |
|---|---|---|
| `never_a_candidate` (gate 1: unbroken run + touching both staff lines) | **37** | 55% |
| `gate3_blob` (the 2026-08-24 notehead-past-a-line-means-stem rule) | **29** | 43% |
| `gate2_fat` | 1 | 1% |

⛔ **`gate3_blob` destroys 31% of every printed barline on these pages.** It was measured on
2026-08-24 as costing "a real barline that a notehead merely TOUCHES… rare", against a measure-count
metric that cannot see a page like these. ✅ **Fixed the same day — the attachment was the STAFF
LINE**, next section; the reading below is the *before*.

## The "notehead" was the staff line itself (2026-08-25)

⭐ **The cause is not the 2026-08-24 rule. It is what the walk counts as an attachment.**

`_terminal_overshoot` starts ON the outer staff line and steps outward, so the line's own thickness
is the first thing it meets — and `normalize_row` upscales the row to `TARGET_SPACING`, which
multiplies that thickness (a 2 px line on a 10 px-spacing photocopy becomes 6 px). Those rows are
very wide connected ink hanging off the stroke. So on a coarse scan **every barline carried a
"notehead"**, and a faded line makes it worse rather than better: the line breaks into long
one-sided runs, which is why the effect is strongest on exactly the pages the report came from.

Measured over the 38 marked rows: of the **63 candidates `gate3_blob` rejected, 30 are printed
barlines and 33 are stems.** The median width of the ink the gate called a notehead is **373 px on
the barlines against 44 px on the stems** — 44 px is one line-space, a real notehead; 373 px is not
a glyph at all.

**The fix**: a row whose ink SPANS THE STAFF is neutral — it is not a wide attachment, and it does
not break the run either, so the walk looks straight through it for a real notehead. The test is
gate 2's own staff-row test at the same **0.4** fill, so the file keeps one definition of "this row
is a staff line". `BLOB_SKIP_LINE`, `OMR_BLOB_LINE=0` restores 2026-08-24 behaviour exactly.

| | recall | precision | `gate3_blob` misses |
|---|---|---|---|
| 2026-08-24 rule | 26/93 (28.0%) | 26/41 (63.4%) | **29** |
| **+ staff line neutral (ships)** | **47/93 (50.5%)** | **47/72 (65.3%)** | **8** |

**Recall nearly doubles and precision RISES** — it is not a recall/precision trade, unlike
`BAR_FADE_SP` below. On the owner's 12 flagged pages, interior barlines **163 → 224** and rows
finding no barline at all **17 → 10**.

⚠ **It costs 4 rows on the other instrument**: `score_slicer.py` exact rows **86 → 82** (improved 39,
regressed 12). Same shape as the 2026-08-24 staff repairs — that sample is mostly clean pages, where
the staff line is thin and this ink was never the problem, so the fix can only cost there. Taken
because the gain is measured on the instrument built for this exact question and the loss is one
third of it.

**Structurally, 200 random corpus pages** (`arms.py --env OMR_BLOB_LINE`), 36.5% byte-identical:

| count | off | on | delta | pages better | pages worse |
|---|---|---|---|---|---|
| staves | 1523 | 1523 | **+0** | 0 | **0** |
| x-extent (px) | 2,174,046 | 2,174,046 | **+0** | 0 | **0** |
| barlines | 2863 | **3317** | **+454** | **127** | **0** |
| measures | 4323 | 4737 | +414 | 119 | **0** |
| strips | 4141 | 4174 | +33 | 29 | 9 |

**No page anywhere in the 200 loses a barline**, and staff geometry is untouched by construction —
this fix only changes what gate 3 accepts. ⚠ **The 9 pages with FEWER strips are not a regression and
that was checked, not assumed**: all 9 also found MORE barlines and more measures (e.g.
`firsat_bulsam_yare_varsam` 9 → 21 bars, 27 → 26 strips). A row with no barline is cut by WIDTH into
several strips; finding its bars packs the same music into fewer, correct ones.

✅ **Ported to the browser slicer, and `parity:slicer` is 100% on all three rungs** (120 eligible
pages + 12 zero-staff): bar count exact 844/844 rows, bar x exact 3456/3456, W6 strips 2353/2353. The
directly relevant line is the stricter one it reports but does not gate — **rejected candidates
identical 844/844 (100%)**, so the two languages reject the same candidate for the same reason.

### Two alternatives were built and lost

⛔ **A SHAPE DISCRIMINATOR — "a beam is horizontal, a notehead is round".** This is what the
2026-08-25 report proposed, and it works: exempt the attachment when its median connected width
exceeds 1.5 sp *and* the whole wide run is no taller than 0.55 sp (a beam is ~0.5 sp thick). It
reads **57.0% recall / 67.1% precision** — better than the shipped fix on both. **It costs 12 rows
on `score_slicer` (86 → 74), three times the price**, because on a clean page a beamed stem whose
notehead sits INSIDE the staff is exactly that shape and walks straight through. Combining the two
is worse than either (58.1% / 62.8%, and 73 rows). ⛔ **Not kept in the code**: it lost to a simpler
rule on the instrument that prices clean pages, and it needed a bespoke run-shape pass in the
gate's hottest loop. The numbers are here so it is not rebuilt.

⛔ **"Skip only the line's OWN thickness"** — neutral only while the walk is still inside the run of
staff-line rows adjacent to the line, which sounds tighter and is more obviously correct. It reads
**37.6% recall**, far below the shipped rule, because on a faded page the line's remnant at the very
first row often does not reach the fill threshold and the rows that do sit further out.

## Gate 2 was blind on a dense page, because a "staff row" only had to be FULL (2026-08-25)

Owner-reported from the slice inspector on `bozukNihavendLonga`: rows cut through note stems.
Three of that page's cuts are not printed barlines, and they have **two different causes** — worth
separating, because only one of them is a barline bug at all.

**Cause 1, one cut: a stem taken for a barline** (s03, page x=424). The ink profile at that column
is a **40–55 px blob in the upper third of the staff over a 10–11 px stroke** — a notehead, roughly
1.5 line-spaces wide, with its stem below. Gate 2 exists to reject exactly that and did not.

Gate 2 skips "staff rows" so the five lines cannot make every candidate read fat, and it found them
by **fill alone**: ink covering more than 0.4 of the row's width. A staff has 5 lines. On this page
that test claims:

| row | rows called a staff line | of which nowhere near a line |
|---|---|---|
| s03 | **101 / 140 (72%)** | **61** |
| s09 | 112 / 140 (80%) | 75 |
| whole page | 41–80% of every row's band | — |

With most rows skipped, gate 2 can never collect `fat_run` **consecutive** fat rows, so the notehead
is invisible and its stem passes. **The fix**: a staff row must also BE where a staff line is. The
normalized row fixes the five positions exactly, so requiring a staff row to sit within
`STAFF_ROW_POS_SP` line-spaces of one costs nothing to compute.

| | recall | precision | false barlines | `score_slicer` exact rows |
|---|---|---|---|---|
| fill only | 50.5% | 65.3% | 25 | 82/124 |
| **+ position (ships, 0.2)** | **50.5%** | **79.7%** | **12** | **82/124** |

**Precision +14.4pp with recall untouched, and exactly neutral on the second instrument** — it costs
nothing on either. Flat over 0.15–0.3; 0.5 is wide enough to re-admit the old behaviour. On the
reported page the row-4 stem cut disappears and no real barline is lost.

⚠ **A stricter gate can only REMOVE barlines, and corpus-wide 29 of them are unverified.** 200 pages,
**92.0% byte-identical**: bars **3317 → 3288 (−29) on 16 pages, 0 pages gain one**; staves and
x-extent untouched. Where we can check whether a removal was right, all of them were: on the four
hand-marked pages the fix drops **13 barlines, all 13 false, 0 real** (that is what precision rising
while recall does not means). On `score_slicer` **not one of the 113 comparable rows changes at all**,
so that instrument neither confirms nor denies. ⚠ **The 16 corpus pages are none of those**, so their
29 removals rest on the argument, not on a measurement — the worst single page is `gozumden_gonlumden`
at 21 → 16. If a page ever needs re-checking after this change, start there.

✅ `parity:slicer` re-run after the port: **100% on all three rungs** (120 pages), bar x exact
3433/3433, and **rejected candidates identical 844/844 rows**.

**Cause 2, the other two cuts: not barlines at all** (s06 x=397, s08 x=361). These are `_split_wide`
**width gutters**. Those rows found too few barlines (1 of 2 printed, 2 of 3), so an over-wide
measure must be split — and `_split_wide` may only cut on a ZERO-ink column. On a dense row there is
no such column, so it falls back to the least-inked one, which still crosses a stem. ⚠ **This is not
fixable in the splitter**: it is gate 1's `never_a_candidate` misses arriving one step later. A row
that finds its barlines never enters the width-split path at all. ⚠ Checked and rejected as a
contributing cause: `_split_wide` excludes staff rows from its ink profile with the same fill-only
test, but at all three columns the profile is non-zero either way — they are "least ink" cases, not
false gutters.

### The fill threshold is a knob, and 0.4 is not the best recall

`OMR_BLOB_FILL` — how much of the row's width the ink must span to count as the staff line:

| fill | recall | precision | `score_slicer` exact rows |
|---|---|---|---|
| 0.2 | 59.1% | 61.8% | 79 |
| 0.3 | 58.1% | 62.8% | 81 |
| **0.4 (ships)** | **50.5%** | **65.3%** | **82** |
| 0.6 | 38.7% | 69.2% | — |

Lower reads more ink as staff line, so more candidates survive. **0.4 ships** because it is gate 2's
existing definition of a staff row — one definition in the file, no new tunable — and it costs the
least on the clean-page instrument. ⚠ 0.3 is +7.6pp recall for −1 row and −2.5pp precision; that is
an owner call of the same kind as `BAR_FADE_SP`, not a fact.

### The day's two staff fixes, re-measured on this instrument

| | recall | precision | `outside_staff_extent` misses |
|---|---|---|---|
| both off | 17/96 (**17.7%**) | 17/32 (**53.1%**) | **5** |
| both on (ships) | 26/93 (**28.0%**) | 26/41 (**63.4%**) | **0** |

Recall and precision both rise, and the width fix takes marks-the-slicer-could-never-reach to zero.
⚠ The denominators differ (96 vs 93) because which marks count as *interior* depends on the detected
x0/x1, which is what the width fix moves. ⚠ Note the contrast with `score_slicer.py`, where the same
two fixes are **exactly neutral** — that sample is mostly clean pages, this one is the worst four we
have. Neither instrument is wrong; they measure different populations.

### `BAR_FADE_SP` reopened: it is a straight trade, not a bug

The rejected fade rule, swept on the new instrument — ⚠ **this sweep predates the same day's two
gate fixes and the section below re-runs it after them**:

| `OMR_BAR_FADE` | recall | precision | false barlines |
|---|---|---|---|
| **0 (ships)** | 26/93 (28.0%) | 63.4% | 15 |
| 0.25 | 30/93 (32.3%) | 57.7% | 22 |
| 0.5 | 38/93 (40.9%) | 50.0% | 38 |

Every step buys recall and pays precision; F1 rises across the range (0.39 → 0.41 → 0.45). ⚠ **That
does not settle it**, and the default was NOT changed on it: a false barline cuts a crop through the
music, a missed one only makes the strip wider, and nothing has measured which costs more downstream.
It also still costs 3 rows on `score_slicer` (86 → 83), which is the clean-page population. The
decision needs an owner call on what a false cut is worth, not another sweep.

## `BAR_FADE_SP` was turned ON at 0.25 and turned back OFF the same day (2026-08-25 evening)

⭐ **This is the section to read before ever re-opening the fade rule.** Turning it on is cheap and
the faded-page numbers make it look free; the reason it ships OFF is a measurement that only exists
at full scale, and re-arguing it from the table above is exactly how it got turned on.

**Re-swept on the hand-marked truth AFTER the staff-line-neutral blob walk and gate 2's position
rule** — both landed after the sweep above, and both change which candidates survive:

| `OMR_BAR_FADE` | recall | precision | false barlines |
|---|---|---|---|
| **0 (ships)** | 47/93 (50.5%) | 47/59 (79.7%) | 12 |
| 0.25 | 51/93 (54.8%) | 51/64 (**79.7%**) | 13 |
| 0.3 | 52/93 (55.9%) | 52/66 (78.8%) | 14 |
| 0.35 | 53/93 (57.0%) | 53/68 (77.9%) | 15 |
| 0.4 | 59/93 (63.4%) | 59/80 (73.8%) | 21 |
| 0.45 | 63/93 (67.7%) | 63/86 (73.3%) | 23 |
| 0.5 | 65/93 (69.9%) | 65/90 (72.2%) | 25 |

The recorded trade — *"every step buys recall and pays precision"* — **does not reproduce on this
code**. Precision is flat to 0.35 and the knee is exactly there: 0.35 → 0.4 is +6.4pp recall for
−4.1pp precision and 6 more false barlines. At 0.25 precision does not move at all.

⛔ **AND THAT READING DID NOT GENERALISE.** The hand truth is 93 marks on the 4 most faded pages we
own. `score_slicer.py` run at **FULL scale** pairs the two settings row for row over the same
population:

| | fade 0 | fade 0.25 |
|---|---|---|
| exact rows | 3750/6440 (58.2%) | **3718/6440 (57.7%)** |
| paired vs fade 0 | — | **BETTER 111, WORSE 187, net −76 rows** |

**How the error moved is the whole argument** — the dominant transition is a row whose measure count
was RIGHT gaining a spurious barline:

| `dn` move | rows | |
|---|---|---|
| **`+0` → `+1`** | **108** | a correct row gains a false barline |
| `-1` → `+0` | 72 | the intended win: a missing barline recovered |
| `+1` → `+2` | 46 | already wrong, now worse |

**72 recovered against 108 broken.** That is the original code comment's *"the stems it admits are
not caught by gates 2 and 3 as hoped"*, confirmed at 50× the scale it was first measured on.

⚠ **The owner had already rejected 0.35+ on the PIXELS rather than the summary**, and that reasoning
survives the revert: the false barlines each step adds were opened one by one, and **every new one is
a NOTE STEM** — three of three at 0.35, and the single one 0.25 adds is a stem too. A stem cuts the
crop through the music, which is the failure this project cares about most.

✅ **The rule IS ported to the browser slicer and was verified at 0.25 before the revert**:
`parity:slicer` 100% on all three rungs, bar count 844/844 rows, bar x exact 3490/3490, and the
stricter ungated line **rejected candidates identical 844/844**. So re-enabling it is one constant on
each side (`BAR_FADE_SP` in `page_to_strips.py` and in `apps/web/src/omr/slicer/constants.ts`), and
they must move together.

### ⚠ `score_slicer.py` is a 6,440-row instrument, and every earlier number is a 124-row sample

`--sample` has no default, so a bare run scores **1,159 pieces / 6,440 truth-bearing rows**. Every
score quoted before 2026-08-25 evening — `86/124`, `82/124`, `86 → 74`, `86 → 83` — comes from
`--sample 25`. That is stated in [COMMANDS.md](COMMANDS.md) and in [METRICS-SLICER.md](METRICS-SLICER.md),
but the derived decisions quote the bare number, and **at 124 rows a 3–4 row difference is not
separable from noise**. The full-scale baseline, first run 2026-08-25:

| | rows |
|---|---|
| truth-bearing rows | **6,440** (1,159 pieces scored, 179 skipped for no/stale cache) |
| the slicer the labelled pools were CUT with (`old_dn`) | 3,304 (51.3%) |
| **today's slicer** | **3,750 (58.2%)** — improved 1,296, regressed 694 |

⭐ So the 24–25 August work is **+446 exact rows** over the pipeline that cut the pools, measured
properly for the first time. ⚠ Re-price any future gate change here, not on `--sample 25`. A full run
costs ~30 min on the M4.

## ⛔ `OMR_BLOB_FILL` 0.3 was measured and rejected (2026-08-26)

The third rule this month to look free on the hand-marked faded pages and fail at scale: **+7.6pp
recall (50.5% -> 58.1%)** for −1.4pp precision on the 93-mark truth, but at 6,440 rows **3741 exact
against 3750**, paired **BETTER 52 / WORSE 72, net −20** over 131 rows on 105 pages. ⭐ **The dominant move is `+0 -> +1` on 37 rows** — a row whose measure count was RIGHT gaining
a spurious barline — against 33 recovering a missing one, plus 21 going `+1 -> +2`. Same signature as
`BAR_FADE_SP` (net −76). ⛔ Do not re-open either from the faded-page table: 93 marks on the 4 worst
pages we own, and it has now mispredicted the full run three times.

## Crop quality has no settled metric — two probes answered the wrong question (2026-08-24)

Written up so they are not re-run. The owner wanted a way to collect mis-cut strips automatically
instead of listing them by hand while labelling.

| probe | reads | verdict |
|---|---|---|
| cut passes THROUGH a symbol (a run at least a notehead wide straddles the cut column) | **1 of 754 cuts (0.1%)** — and **the same 1 of 745 before this session's fixes** | ⛔ cannot see the failure; a first version fired on smudged barlines until it was made to use the codebase's own `fat` definition (0.75 sp) |
| cut lands inside a beamed connected component | **117 of 754 (15.5%)** | closer, **unvalidated**, stopped there |

⭐ **The owner's framing is the one to build on** (*"a cut almost never goes through a note; we should
look at whether the cut lands somewhere that is not a barline"*). The failure that started this — an
exam strip whose note read as a quarter — had its **notehead intact and its beam in the previous
strip**, so nothing straddled the cut and a through-the-ink test is structurally blind to it.

⛔ **No slicer fix should be scored on the first two probes.**
