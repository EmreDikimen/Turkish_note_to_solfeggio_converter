# Staff detection — finding the five lines, and the rows that get lost

purpose: how a staff is found in the ink mask, every fix and every REJECTED fix, and why the row-level scorers cannot price a change to it
audience: anyone about to change `detect_staves`, `_emit_staff`, or the grouping rule
updated: 2026-08-26

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-26 at the 400-line cap. That file
keeps **how a page becomes an INK MASK** — binarization, the pale-line fallback, grayscale fidelity;
this one keeps **how a STAFF is found in that mask**. The CUT is a third file,
[METRICS-SLICER-BARLINES.md](METRICS-SLICER-BARLINES.md). Nothing is duplicated between them.

⚠ **The theme of this file, in one line:** three separate fixes here were first written as a GLOBAL
loosening of a rule, and all three were rejected on measurement in favour of a NARROW repair that
can only act where the shipped rule already produced something unusable. A dial that trades one page
against another is the wrong shape.

## A faded page loses whole rows and half-rows, and three fixes for it (2026-08-24)

Owner-reported from the slice inspector's new `debug.png` overlay on `bozukNihavendLonga.png` —
the same 1056 px re-scanned photocopy the pale-line fallback above was built for. The fallback got
it from **0 staves to 9**; this is the layer underneath. Three independent causes, all measured on
that page with `_staff_line_rows` / `_emit_staff` instrumented directly:

| cause | what it does | evidence on that page |
|---|---|---|
| a group of **3** surviving staff lines is dropped by the `4 <= len <= 7` floor | the whole row produces no strips | row 2's rows are `[268, 287, 299]` — 2 of 5 lines lost to the opening → 9 staves for 10 printed rows |
| the x-extent keeps only the **longest** run of qualifying columns | measures at a row's ends are never cut | 7 of 9 staves split into 2-6 runs; s05 discarded **420 px** of a 1008 px row, s07 128 px across 6 runs |
| `detect_barlines` re-binarized the row with **plain Otsu**, not the binarizer the page chose | no interior barline → every strip cut by WIDTH, through the music | longest vertical run maxed at **115 px** against the 119 needed; under the page's own binarizer, **57** columns pass |

⚠ The gaps that broke the extent runs were **marginal**: 28 px against a 27 px tolerance, 34 against
31, 45 against 30. A 1 px margin was deciding 159 px of music.

**The fixes**, and what each is worth. `STAFF_GAP_BRIDGE_SP` 3.0 → **6.0** (fades bridge, a scan
border still does not); `_repair_group` rebuilds a 3-line group; `page_binarizer`'s choice is
threaded into `detect_barlines` / `window_measures` instead of each re-running Otsu.

400 random corpus pages, geometry only, no deskew and no model (`arms.py` pattern, 0.18 s/page):

| arm | staves | strips | interior bars | measures | x-extent (px) |
|---|---|---|---|---|---|
| `+binarizer` | +0 | +3 | +5 | +6 | +0 |
| `+extent` | +0 | +65 | +41 | +46 | +24,413 |
| `+repair` | +54 | +117 | +42 | +94 | +64,659 |
| **all three** | **+54** | **+199** | **+83** | **+141** | **+95,323** |

**0 pages got worse on any of those five counts**, and 318 of 400 (79.5%) are byte-identical. The
binarizer arm reads near-zero here because it is a literal no-op on every page whose chooser
returns `binarize_ink`; on the pale page itself it is what took 3 rows from 0 interior barlines to
4, 2 and 1.

⚠ **The repair's first version invented a staff out of a block of underlined LYRICS**
(`huzzam/gonul_dustu_care_yoktur_nota_p1`, +79 staves across the sample instead of +54). Even
spacing and integer gaps were not enough — text baselines pass both. `STAFF_REPAIR_SP_BAND`
(0.70–1.40 × the page's median line-row gap) is what refuses it: the lyric block repairs at
**1.97×**, every genuine repair in the sample at **0.94–1.32×**. Same argument as
`page_binarizer`'s shape check, one level down.

⚠ **The staff fixes COST measure-count accuracy on rows that already worked.** Against SymbTr
truth (`score_slicer.py --sample 25`, 124 rows), on top of the barline rule below: both off
**88/124**, extent only 87, repair only 87, both on **86**. So each costs about one row in 124.
The metric cannot see their benefit by construction — its truth comes from aligning the OLD
pipeline's decodes, so a row that pipeline never read has no truth entry, and those are exactly the
faded rows the fixes rescue. Both facts are real; the trade was taken deliberately, because a lost
row is total data loss while a wrong measure count is a recoverable indexing error.

## One page, one staff SIZE — the spacing was being read 30% low (2026-08-25)

Owner-reported: `bozukNihavendLonga` "is not cut at the bars", plus a list of exam-queue strips too
zoomed-in to read (`names_of_bad_cropped_images.md`). Both are the same bug, and it is upstream of
every barline gate.

On a faded photocopy the horizontal opening does not lose whole staff lines so much as **chop**
them: the thresholded row profile dips below the threshold at random heights *inside* one staff, so
`_cluster_rows` reports **6 or 7 "lines" where 5 are printed**. `_emit_staff`'s
most-evenly-spaced-consecutive-5 rule then chooses among windows that are all wrong, and it takes
the **tightest** one. Measured on that page: every group's first-to-last span is 43-49 px (true
spacing ~11.75) while the chosen windows read **8-10 px**.

It is not cosmetic. `normalize_row` scales by `30 / spacing`, so a 30% low spacing upscales the row
30% too much, the band the barline gates analyse no longer sits on the staff, and **real barlines
fail gate 1 while note stems pass** — which is exactly "cut through the music, never at a bar". The
same arithmetic produces the unreadable crops: two exam pages read **7.0 px and 6.0 px** where their
own neighbouring rows read 13-15.

**The fix is the page itself.** Every staff printed on one page is the same height, so when a
group's own span already agrees with the page's median span, spread 5 evenly-spaced lines across it
instead of choosing a window. Only the interior three lines are re-derived — the outer two are
observed rows, and ink outside a staff is not long-horizontal, so a group's first and last rows are
the outer staff lines far more reliably than its middle ones. A volta bracket or lyric rule riding
along makes the span too LARGE, which `STAFF_SPAN_TOL` refuses, leaving the window rule in charge
exactly where it was written for.

⚠ **`STAFF_SPAN_MIN_ROWS` is 6, and that is measured.** A group of exactly 5 is usually a correct
staff, and re-spacing it moves each line a px or two, which flips marginal barline decisions in
BOTH directions — on `pek_revadir` it won 2 barlines on one row and lost 3 on two others.

| rebuild floor | SymbTr exact rows | regressed | interior bars, 12 flagged pages |
|---|---|---|---|
| off (baseline) | 86/124 | 11 | 146 |
| 5+ rows | 86/124 | 12 | 162 |
| **6+ rows (ships)** | **86/124** | **11** | **163** |

⚠ That last column is the **geometry-only** probe (staff detect → normalize → barlines, no strip
writing), which is what makes the three rows comparable. The shipped driver reads **164** on the same
pages, because `page_to_strips` hands `normalize_row` a connected-component labelling and the probe
does not, which moves one row's frame by a pixel. Both numbers are real; do not mix them.

⚠ `STAFF_SPAN_TOL` was swept 0.08-0.20 and **both instruments are flat** across it. It is a guard
rail, not a dial.

## One page, one staff WIDTH — half a row was being thrown away (2026-08-25)

Same page, owner-reported after the fix above: *"the 2nd and 9th rows have lost half of themselves"*.
`_emit_staff` keeps only the LONGEST run of qualifying columns, so a fade that opens a gap wider
than `STAFF_GAP_BRIDGE_SP` discards everything beyond it — on those two rows, **156-864 px of a
41-1000 px staff** and **41-934 px of a 41-1010 px one**. Raising the bridge is not the answer: it is
what stops a scan border stretching the extent across the paper, and the breaking gaps are marginal
(**69 px against a 60 px bridge, 73 against 72**), so any bridge wide enough is also wide enough to
swallow the artifacts.

A printed page uses ONE left and ONE right margin, so the median `x0`/`x1` over its staves says how
far a row may reach; a discarded run that starts (or ends) at the page's own margin is the same
staff. Only runs that already qualified as staff-line columns are re-admitted, so a row that
genuinely ends early — the last line of a piece — has nothing out there to re-admit and stays short.
Both rows above are restored to the full page width.

## What the two fixes cost, measured twice (2026-08-25)

**Against SymbTr truth** (`score_slicer.py --sample 25`, 124 rows), each arm alone and together:
**86/124 exact, 11 regressed — identical to the untouched baseline.** They neither help nor hurt
this instrument, and the reason is the one this file gives everywhere: its truth comes from aligning
the OLD pipeline's decodes, so the faded rows these fixes rescue have no truth entry at all.

**Structurally, 200 random corpus pages, geometry only** (`data/real/debug/badcrops_2026-08-25/arms.py`),
both flags off vs on. 176 of 200 (**88%**) are identical on every count:

| count | off | on | delta | pages better | pages worse |
|---|---|---|---|---|---|
| staves | 1523 | 1523 | **+0** | 0 | **0** |
| interior bars | 2853 | 2863 | +10 | 8 | 5 |
| measures | 4312 | 4323 | +11 | 8 | 4 |
| strips | 4150 | 4141 | −9 | 6 | 10 |
| x-extent (px) | 2,165,877 | 2,174,046 | **+8,169** | 18 | 3 |

⚠ **This is NOT the 2026-08-24 result's "0 pages got worse on any count".** Five pages lose
barlines. The worst, `gel_meclise_ey_gonce_i_gulzar_i_letafet_nota_p1` (3 → 1), is **handwritten**:
its detected spacings go from 13.5-17.5 (detection noise on hand-ruled staves) to a consistent
16.5-18.5, the crop stops clipping the tops of the notes — and the one row that lost two bars had
found the *same* double barline twice. The owner's standing call is that handwritten and old pages
may be compromised on for now.

**On the 12 owner-flagged pages** (94 rows), from the written manifests: interior barlines
**146 → 164**, and rows with **zero** barlines — the ones cut by width, straight through the music —
**27 → 17**. Sheets: `data/real/debug/badcrops_2026-08-25/` (`01-eski-slicer` vs `02-yeni-slicer`).

⚠ **Still open on `bozukNihavendLonga`**: 3 of its 10 rows find no barline, and the owner reports
that **every row of that page has barlines**. ⚠ **A first reading of this said the ink was "absent
from the mask" and that is RETRACTED** — it was measured at columns picked off a 2x preview with a
bad display-to-page conversion, so it measured blank paper. At the barlines' real columns the ink is
**40 of 44 and 44 of 44** page rows dark. They are present, and the GATES reject them:

| row 6, real barline | what the gate sees | why it is rejected |
|---|---|---|
| page x=417 | unbroken run **119**, threshold **119** | passes on length, fails `touches_top` — the run starts ONE row below the touch window |
| page x=711 | run 133, median width 13, fat-run 9 (a clean thin bar) | `gate3_blob`: it clears the bottom line by 15 rows and a **beam** crosses there — the documented cost of the 2026-08-24 notehead-means-stem rule, firing on a real barline |

⚠ **This is why `BAR_FADE_SP` below was the right direction and the wrong rule**: loosening gate 1
positionally does reach the first case, but it admits stems because it asks nothing new. Neither
case is a binarization problem.

⛔ **There is no ground truth for barline POSITIONS on any real page, and eyeballing them off a
preview has now produced one arithmetic error and one retracted finding.** Every barline number in
this section is a count of what the detector did, never of what it should have done. The owner has
offered to mark real barlines by hand; that is the instrument this question needs.

⚠ **A fade tolerance for gate 1 was written, measured and REJECTED** (`BAR_FADE_SP`, ships at 0).
Real barlines on that page miss the continuity gate by ONE pixel (run 118 against 119), so the rule
lets a run that still starts at the top staff line and ends at the bottom one fade by up to
`BAR_FADE_SP` at each end, OR-ed with the original so nothing can be lost. It buys 2 barlines on the
photocopy and costs **3 real rows** against SymbTr (86 → 83): the stems it admits are not caught by
gates 2 and 3. Kept switchable (`OMR_BAR_FADE=0.25`) because the failure it targets is real.

## A staff whose SPACING contradicts its own height (2026-08-26)

Owner-reported from the slice inspector: *"s03 is read soo wide in vertical, it includes previous
staff."* ⚠ **Pre-existing, and only renumbered by that day's grouping repair** — the same staff was
`s02` before the repair recovered a row above it.

| | |
|---|---|
| detected lines | 440, 455, 471, 479 — only **4** |
| gaps | 15, 16, 8 -> **median 15** |
| the page's real spacing | **9.75** |
| staff HEIGHT (440->479) | 39 px — **correct**, matches the page |

⭐ **The height is right and the spacing is read 54% high**, and the second is what the crop is built
from: `normalize_row` scales by `30 / spacing`, so that row upscaled **2.0x** where every healthy row
on the page got 3.0-3.5x. Under-magnified inside a FIXED 336 px frame, the crop reached **4.60 sp**
above the staff in page pixels and swallowed the bottom of the system above — the inspector's own
header said it: `music 0.7↑/1.1↓ sp, frame 4.60↑/2.60↓`.

⚠ **The fix for this already existed and was looking the wrong way.** `STAFF_SPAN_CONSENSUS` rebuilds
a staff to 5 evenly spaced lines when its height matches the page — exactly the remedy — but was
gated on `len(group) >= STAFF_SPAN_MIN_ROWS` (**6**), written for the symptom that produced it: a
staff CHOPPED into 6-7 fragments. This group has **4**. The guard's real condition (height matches
the page) passed; only the line count blocked it.

✅ **It now gates on the DEFECT rather than the line count** (`STAFF_SPAN_FIX_SPACING`, ships ON): the
height already says the spacing must be `span / 4`, so if the measured median gap disagrees by more
than `STAFF_SPAN_SPACING_TOL` (25%) the measurement is what is wrong. On a healthy staff the two
agree and it is a no-op. `s03` -> lines `[440, 450, 460, 469, 479]`, spacing **10.00**, scale **3.00**.

**Full scale** (6,440 rows), against the same slicer with only this off:

| | exact rows | paired |
|---|---|---|
| control | 3746/6440 | — |
| **spacing fix** | **3748/6440 (+2)** | **BETTER 7 / WORSE 6, net +1**, **13 rows on 12 pages** |

⭐ **The blast radius is the point**: 13 rows of 6,440. It fires only where a staff's two independent
measurements contradict each other, which is rare and is precisely the defect. ⚠ No staff COUNT
changes on any tested page, so the 129 barline hand marks keep their row keys; one truth page
(`meclis_...p1`) has 4 rows whose line positions move, which is the fix working.

## A whole staff ROW goes missing, and the second pass that gets it back (2026-08-25)

**The finding first: on 14% of corpus pages the slicer does not find every staff row, and a lost
row is not a bad crop — it is NO crop.** That music never reaches the model in any form, which is
why no accuracy metric has ever shown it. Found by eye by the owner in the `examv3`-vs-frozen
comparison sheets, then measured.

**What determines a staff today**, and where it breaks:

1. ink mask (Otsu, or the pale-line fallback above);
2. **horizontal opening**, a `hor_len x 1` kernel with `hor_len = STAFF_HOR_FRAC` (11%) of the page
   width — the continuity test;
3. row projection, keeping rows above `max(0.3 x the page's darkest row, 0.2 x width)`;
4. group into systems: a gap over `2.2 x the page's median line gap` starts a new staff;
5. accept a group of 4–7 lines (3 gets `_repair_group` first).

⭐ **Step 2's kernel is ONE PIXEL TALL, so it demands the line stay inside a single pixel row for
11% of the page width.** A hand-ruled or slightly skewed line wanders across rows, no row holds an
unbroken run, and the line is **erased rather than weakened**. `_emit_staff` already documents this
exact failure for the x-extent and works around it by re-reading the RAW ink; detection never got
the same treatment. ⚠ Steps 3 and 4 are also page-GLOBAL decisions about a local question: one dark
row lifts the threshold for every faint row on the page.

⛔ **THE OBVIOUS FIX — LOOSEN DETECTION GLOBALLY — WAS BUILT AND REJECTED.** Dilating the mask
vertically before the opening addresses the mechanism exactly, and it trades pages against each
other:

| page | ships | dilate 3 px |
|---|---|---|
| `sevdim_yine_bir_afet_gibi_yar_nota_p1` (hand-ruled, 8 rows) | 5 | **8** ✅ |
| `bozukNihavendLonga` (10 rows) | 10 | **1** ⛔ |

Scaling the dilation to the page's own measured line spacing does **not** escape it: at the fraction
that helps `sevdim`, `bozukNihavendLonga` still reads 6. On a page whose lines sit 9 px apart any
useful dilation fuses them. ⚠ A horizontal CLOSE was tried too and is worse for a non-obvious
reason — it raises `row_ink.max()`, which raises the relative threshold in step 3 and loses faint
lines elsewhere. **Do not re-open a global knob here.**

✅ **What ships instead is a SECOND PASS** (`STAFF_RESCUE`, `OMR_STAFF_RESCUE`, **off by default**).
Pass 1 is untouched; its result is then used to say *where* a row is missing — a page's rows sit at
a near-constant pitch, so a gap of ~k x that pitch is k-1 missing rows — and detection is re-run
**only inside those bands**, cheapest reading first. A page whose rows were all found has no bands
and therefore cannot move, which is the property the dial could not have. Acceptance is the same
argument `_repair_group` uses: survive `_emit_staff`, then match the page's other staves in **height
and width**.

⚠ **The WIDTH test is not a tidy-up.** Without it the block of **underlined lyrics** at the foot of a
handwritten page is rescued as a staff — lyric rules sit at staff-like spacing and pass the height
test. They span only the part of the page the text occupies.

**Full scale** (`score_slicer.py`, 6,440 truth-bearing rows, 1,159 pieces, both arms run the same day):

| | rescue off | rescue on |
|---|---|---|
| exact rows, current slicer | 3750/6440 (58.2%) | **3750/6440 (58.2%)** |
| improved / regressed | 1296 / 694 | 1296 / 694 |
| dn histogram | `-3:45 -2:277 -1:770 +0:3750 +1:1268 +2:294 +3:36` | identical |
| **staff rows gained** | — | **320, on 227 of 1,592 pages (14%)** |

⭐ **Every scored number is identical.** The only difference in the two runs is `xrange` gate rejects,
55 → 52 — a rescued row is a vote in the page-median width consensus, so a staff extent shifted
slightly on one page; no row's measure count moved.

⚠ **THE GAINED ROWS CANNOT BE SCORED THERE AND NEVER WILL BE.** `score_slicer.py`'s truth is aligned
from the OLD pipeline's decodes, and the old pipeline never saw these rows — this is the blind spot
its own docstring names, and a staff fix lands squarely in it. The evidence that they are real is
visual: **14 of 14 rescued rows correct across 4 pages**, after the width guard. That is a sample,
not a rate.

⚠ **It is not only a handwriting problem.** `kacma_mecburundan…_nota_p1` (printed TRT) loses 4 of 9
rows and `bengibisana…_nota_p1` (typeset) 4 of 11; both are fully recovered.

⏭ **Turning it on is a decision, not a step**: it moves crops on 227 pages, so it bumps
`GEOMETRY_REV` and invalidates every decode cache. What it costs the exam is in
[METRICS-SLICER-ROOTS.md](METRICS-SLICER-ROOTS.md).

## A system the gap rule SPLIT, and the fix that had to be narrowed twice (2026-08-26)

**The finding: the rule deciding where one staff ends sat 0.8 px from flipping, and the browser fell
the other side of it.** `bozukNihavendLonga2.png` is the same music as `bozukNihavendLonga.png`
screenshotted smaller; the slice inspector read **9 staves where Python read 10**.

⚠ **Not a port bug and not a code difference.** `cv2.imread(IMREAD_GRAYSCALE)` converts inside the
PNG decoder and a browser cannot, so the two greyscales differ by **±1 on 16.1% of that page's
pixels** by construction. Both sides then found the **SAME three staff lines** on one row
(y = 266, 285, 291) and disagreed only on whether they were one staff:

| | median line gap `sp` | split threshold `2.2 * sp` | the gap in question | result |
|---|---|---|---|---|
| Python | 9.0 | 19.8 px | **19 px** | one group of 3 -> `_repair_group` rebuilds 5 lines -> staff kept |
| browser | 8.0 | 17.6 px | **19 px** | split into 1-line + 2-line, both under the 3-line floor -> **staff lost** |

⭐ **One pixel of difference in a page-wide median deleted a staff.** ⚠ `parity:slicer` read 100%
throughout, because its 120-page sample does not contain this page — a green parity check and a real
divergence were both true at once.

⛔ **FIX ATTEMPT 1, REJECTED ON MEASUREMENT: group by staff HEIGHT instead.** Re-cutting every line
row on the page's own staff height fixes the page and, at full scale, reads **3205 exact rows
against the shipped rule's 3750 — −545 rows**, with regressions nearly doubled (694 -> 1351). The
reason is arithmetic: a staff spans ~`4*sp`, so "the group may be one staff tall" permits ~`4.8*sp`
between first and last line, and on a page whose systems sit close together that merges rows which
should be separate. **The `2.2 * sp` rule earns its place. Do not re-open the global form.**

⚠ **FIX ATTEMPT 2 ALSO FAILED FIRST TIME, for a reason worth keeping**: the merge required the pair
to *equal* one staff height. But a group is undersized **because lines are missing**, so its raw
height is naturally short — this page's pair spans 25 px against a 38 px staff, and the equality
test rejected exactly the case it existed for. The test bounds the height from ABOVE only.

✅ **WHAT SHIPS is the narrow repair** (`STAFF_GROUP_BY_SPAN`, **on by default 2026-08-26**): merge two
ADJACENT UNDERSIZED groups — each under the 3-line floor, so each is being discarded anyway — when
together they fit inside one staff. A group with 3+ lines is never touched, so a page whose grouping
is healthy cannot move. `_emit_staff` still has to accept the result.

**Full scale** (`score_slicer.py`, 6,440 rows), paired row-for-row against the shipped rule:

| | exact rows | paired |
|---|---|---|
| shipped rule | 3750/6440 (58.2%) | — |
| **narrow merge** | **3746/6440 (58.2%)** | **BETTER 29 / WORSE 31, net −2**, 62 rows on 32 pages |

⭐ **A wash, and the moves are symmetric** — `+0→-1` 9 against `-1→+0` 8, `+0→+1` 7 against `+1→+0` 7,
with no systematic direction. That is what separates it from the two rules rejected below, whose
losses all pointed one way. It costs nothing measurable and removes a case where **the app cuts
differently from the training data**.

⚠ It is **not inert**: crops move on at least 32 pages, so it bumps `GEOMETRY_REV` (-> 20260826) and
invalidates every decode cache. On the exam it touches **1 of 67 pages**
(`elbet_gonullerde_sabah_olacakpdf1567931546_nota_p1`, 11 -> 12 staves) — already among the 42 void
pages, so it costs no extra re-labelling — and the row it adds was confirmed by eye to be a **real
staff** the slicer had been missing outright.

## ⚠ The row-level instruments cannot price a staff-detection change (2026-08-25)

Both of them pair a row to its cached truth **by system index**, so a pass that inserts a staff
shifts every later index and each row is scored against another row's answer. This is a property of
the instruments, not of the change, and it produces a large FALSE regression rather than an error.

- **`score_slicer.py`** says it in its own docstring — *"Rows pair 1:1 by system index (staff
  grouping is unchanged)"*. It now takes **`--pair-by-position`**, which re-pairs to the pass-1
  reading by vertical position and counts the added rows separately instead of scoring them.
- **`score_barlines.py`** has the same coupling and **no fix**: its hand marks are keyed to detected
  rows. Measured, `bozukNihavendLonga` read **30 marked** before a staff change and **3** after —
  the instrument breaking, not the slicer. ⛔ **Do not quote it across a staff-detection change.**

