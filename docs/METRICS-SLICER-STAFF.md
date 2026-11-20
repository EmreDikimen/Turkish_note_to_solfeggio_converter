# Staff detection — finding the five lines, and the rows that get lost

purpose: how staffs and barlines are found — every fix and rejected fix, the hand-marked barline truth, and the stem-vs-barline gate
audience: anyone about to change `detect_staves`, `_emit_staff`, or the grouping rule
updated: 2026-11-20

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-26 at the 400-line cap. That file
keeps **how a page becomes an INK MASK** — binarization, the pale-line fallback, grayscale fidelity;
this one keeps **how a STAFF is found in that mask**. The CUT is a third file,
[METRICS-SLICER-STAFF.md](#barlines--where-the-cut-goes). Nothing is duplicated between them.

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
zoomed-in to read (`docs/log/raw.md`). Both are the same bug, and it is upstream of
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
[METRICS-SLICER.md](METRICS-SLICER.md#crop-roots--which-slicer-cut-which-pool-and-what-a-re-slice-costs).

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

**Merged into this file on 2026-11-20:**

- [Barlines — where the cut goes](#barlines--where-the-cut-goes) — was `docs/METRICS-SLICER-STAFF.md`
- [A stem taken for a barline — the both-ends gate](#a-stem-taken-for-a-barline--the-both-ends-gate) — was `docs/METRICS-SLICER-STAFF.md`


## Barlines — where the cut goes

*Was `docs/METRICS-SLICER-STAFF.md` (last updated 2026-08-26).*

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-25 at the 400-line cap. That file
keeps the STAFF and the ink mask — binarization, staff geometry, x-extent; this one keeps the CUT.
Nothing is duplicated in either.

⚠ **Read the ground-truth section first.** Every other barline number in this project counts what
the detector DID; only that one says what it should have done, and it reframes the rest.

### A stem is a barline with a notehead on it — and the gate had the evidence all along (2026-08-24)

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

### BARLINE GROUND TRUTH EXISTS NOW, AND THE SLICER FINDS 28% OF THEM (2026-08-25)

The owner hand-marked **every printed barline** on 38 staff rows over the 4 most faded pages of the owner's
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

### The "notehead" was the staff line itself (2026-08-25)

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

#### Two alternatives were built and lost

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

### Gate 2 was blind on a dense page, because a "staff row" only had to be FULL (2026-08-25)

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

#### The fill threshold is a knob, and 0.4 is not the best recall

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

#### The day's two staff fixes, re-measured on this instrument

| | recall | precision | `outside_staff_extent` misses |
|---|---|---|---|
| both off | 17/96 (**17.7%**) | 17/32 (**53.1%**) | **5** |
| both on (ships) | 26/93 (**28.0%**) | 26/41 (**63.4%**) | **0** |

Recall and precision both rise, and the width fix takes marks-the-slicer-could-never-reach to zero.
⚠ The denominators differ (96 vs 93) because which marks count as *interior* depends on the detected
x0/x1, which is what the width fix moves. ⚠ Note the contrast with `score_slicer.py`, where the same
two fixes are **exactly neutral** — that sample is mostly clean pages, this one is the worst four we
have. Neither instrument is wrong; they measure different populations.

#### `BAR_FADE_SP` reopened: it is a straight trade, not a bug

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

### `BAR_FADE_SP` was turned ON at 0.25 and turned back OFF the same day (2026-08-25 evening)

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

#### ⚠ `score_slicer.py` is a 6,440-row instrument, and every earlier number is a 124-row sample

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

### ⛔ `OMR_BLOB_FILL` 0.3 was measured and rejected (2026-08-26)

The third rule this month to look free on the hand-marked faded pages and fail at scale: **+7.6pp
recall (50.5% -> 58.1%)** for −1.4pp precision on the 93-mark truth, but at 6,440 rows **3741 exact
against 3750**, paired **BETTER 52 / WORSE 72, net −20** over 131 rows on 105 pages. ⭐ **The dominant move is `+0 -> +1` on 37 rows** — a row whose measure count was RIGHT gaining
a spurious barline — against 33 recovering a missing one, plus 21 going `+1 -> +2`. Same signature as
`BAR_FADE_SP` (net −76). ⛔ Do not re-open either from the faded-page table: 93 marks on the 4 worst
pages we own, and it has now mispredicted the full run three times.

### Crop quality has no settled metric — two probes answered the wrong question (2026-08-24)

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


## A stem taken for a barline — the both-ends gate

*Was `docs/METRICS-SLICER-STAFF.md` (last updated 2026-09-03).*

Split out of [METRICS-SLICER-STAFF.md](#barlines--where-the-cut-goes), which sits at the 400-line
cap. That file keeps gates 1–3 and the hand-marked ground truth; this one keeps the fourth gate.
Nothing is duplicated. Plain words for the owner: a *stem* is the thin vertical line on a note; a
*barline* is the thin vertical line between two measures. Both cross the staff, so the slicer has to
tell them apart, and where it gets that wrong it cuts a strip through the music.

⭐ **Priced on the full 6,440-row run (2026-09-03, owner-approved, two passes): 3,762 → 4,068
exact rows for the gate (+306), then → 4,133 with the stroke-width refinement (+65 more, +371 in
all), paired BETTER 502 / WORSE 122 against the baseline.** The largest single gate gain this
project has measured — the whole 24–25 August session was +446. Both passes are below; the second
is what ships.

### The failure (owner-reported, 2026-09-03)

`nihavendLongaDuzgun.png`, a clean screenshot: **the last row was cut at a note stem**, between a
sharp and the note it belongs to. The sharp landed at the end of one strip and its note at the
start of the next, so neither strip can read the pitch right.

The stroke at row x=1462 is the stem of a 16th note whose **head sits on the top staff line** and
whose **second beam ends on the bottom staff line**. Every gate read it as a barline:

| gate | what it asks | what it saw at x=1462 |
|---|---|---|
| 1 continuity | one unbroken run from the top line to the bottom line | run rows 11..133 of the 140-row band — identical to the four real barlines on the row |
| 2 thinness | ≥ 15 consecutive rows of ink ≥ 0.75 sp wide through the column (staff-line rows skipped) | **8**: the head attaches at the stem's middle, so only its lower half is at the column, its lowest 3 rows narrow below 0.75 sp, and the 6 rows ON the top line are skipped |
| 3 termination | wide ink connected PAST an outer staff line | nothing — the head ends where the line is, and so does the beam (`ov_top` 0, `ov_bot` 3, `wide_beyond` False) |

So the gates were not wrong about what they measured; the stem simply spans the staff exactly and
keeps both of its wide parts *on* the outer lines, where the line-row skip hides them.

The same page has the same stroke four more times — rows 1, 5, 6 and 8 (three of them the stem
after a sharp in the repeated phrase, one mid-group with its beam on the bottom line) — each
manufacturing a spurious measure.

### The variant that was tried first and dropped: counting the line rows in gate 2

The first idea was to stop skipping the staff-line rows in gate 2 and instead read them on a
*de-lined* view (a pixel counts on a line row when its column's ink run is taller than the line
itself). Measured, and dropped, for two reasons:

- **It still misses the target.** With the 6 line rows counted the head reaches **14 fat rows
  against the 15 gate 2 needs** — the head's lowest rows narrow below 0.75 sp, so half a head is
  simply not a whole one.
- **It costs real barlines.** On the 93-mark hand-marked truth: recall 48.4 → **45.2%** (3 real
  barlines lost) for precision 81.8 → 89.4%. The reason is structural: a barline that a head merely
  *touches* at the top line is, at that column, **the same picture** as this stem's head end. Gate 2
  looks at one end and cannot tell them apart, however it counts.

What separates the two is the **far end**: a barline's is bare; a stem's is inside a beam.

### The gate that ships: wide ink at BOTH ends of the stroke is a stem (`END_BLOBS`)

Within `END_SPAN_SP` = 1.5 line-spaces of **each** end of the stroke's run, look for
`END_RUN_SP` = 0.3 line-spaces (9 rows) of consecutive fat rows (ink ≥ 0.75 sp wide connected
through the column, the same "fat" gate 2 uses). Reject only when **both** ends carry one. Staff-line
rows are read on the de-lined view (`_line_row_blobs`, margin 3 rows over the line block's own
thickness) so a head or beam straddling a line keeps its height, and a line row that fills the whole
±1 sp window stays neutral (that is a beam or an under-read line, never a head). 1.5 sp is where a
16th's second beam ends (beam, gap, beam ≈ 1.25 sp); 1.0 sp was tried and left the target's second
beam half outside the window, rejecting it by 11 rows to 9 only through the bottom line's blur.

It runs after gate 2 and before gate 3, on the cluster's `test_col`, and it is **strictly a
tightening** — it can only remove candidates. `OMR_END_BLOBS=0` restores the 2026-09-02 behaviour.
The reject shows **amber** in the debug overlays (`gate2_ends`). Both sides carry it: Python
`page_to_strips.py` and the browser's `barlines.ts` / `constants.ts`.

#### What it does on the reported page

| row | before | after |
|---|---|---|
| 1, 8 | `[188, 1217, 1709, 2136, 2435, 2785]` | 1709 gone — the stem after the sharp |
| 5 | `[215, 520, 1079, 1565, 2087, 2218, 2785]` | 2218 gone — a mid-group stem, beam on the bottom line |
| 6 | `[188, 1037, 1446, 1650, 2227, 2784]` | 1446 gone — head on the top line, two beams ending on the bottom line |
| 9 | `[188, 1068, 1462, 1741, 2328, 2629, 2664]` | 1462 gone — the reported cut; the row is 4 measures, cut at real barlines |

⚠ Row 9 also loses **2629**, the thin stroke of the closing `:‖`: a decorative bracket touches it
at both ends (the segno's tail above, a curly bracket below). Harmless here — the thick stroke stays
and the row end snaps onto it — but it is the gate's known shape: **a real barline touched at both
ends is rejected**. 27 → 28 strips on the page, no strip narrower than 342 px.

#### The hand-marked truth (93 marks, 4 pages — the worst pages we own)

| | recall | precision | false barlines |
|---|---|---|---|
| 2026-09-02 code (`OMR_END_BLOBS=0`) | 45/93 (48.4%) | 45/55 (81.8%) | 10 |
| **`END_BLOBS`, 1.5 sp** | **44/93 (47.3%)** | **44/51 (86.3%)** | **7** |

Three false barlines gone (`aman_saki` s5 x=1126, `gafil` s1 x=1345 and s3 x=780), **one real
barline lost** (`gafil` s6 x=1088): a dark photocopy where merged ink touches the barline above
*and* below — exactly the both-ends shape, and the gate cannot tell it from a stem. Two misses on
`bozukNihavendLonga` s4 change label only (`gate3_blob` → `gate2_ends`; they were already missed).

#### `score_slicer.py --sample 25` (124 rows — a smoke read, not the instrument)

| | exact rows | improved | regressed | `dn` +1 / +2 |
|---|---|---|---|---|
| 2026-09-02 code | 81/124 (65.3%) | 39 | 12 | 22 / 7 |
| **`END_BLOBS`** | **86/124 (69.4%)** | **42** | **13** | **16 / 4** |

+5 exact rows; the two new regressions are `bir_melek_p1` s02 (3 measures printed, 1 found) and
`cayir_ince_p1` s00 (3 printed, 2 found) — rows that lose a real barline. In that sample the gate
fired **117** times, 63 of them on candidates gate 3 would have rejected anyway (`gate3_blob`
118 → 55) and 12 that `gate3_clef` would have (142 → 130). ⚠ At 124 rows a 3–4 row difference is
noise; **read the full run before quoting a direction.**

#### The full run (6,440 rows, 1,159 pieces; `OMR_END_BLOBS=0` against the default, same code)

| | exact rows | `dn` −1 / 0 / +1 / +2 | gate rejects |
|---|---|---|---|
| gate off (today's baseline; +12 over the 26 Aug 3,750 from the tail-span trim) | 3,762 (58.4%) | 773 / 3,762 / 1,255 / 288 | `gate3_blob` 4,825 · `gate3_clef` 5,265 |
| **gate on** | **4,068 (63.2%)** | 958 / **4,068** / 835 / 172 | `gate3_blob` 2,324 · `gate3_clef` 5,052 · **`gate2_ends` 5,432** |

Paired row by row: **789 rows change on 488 pages, BETTER 547, WORSE 242.** The moves:

| move (`dn` off → on) | rows | what it is |
|---|---|---|
| +1 → 0 | **418** | a stem stops being a barline — the target class |
| 0 → −1 | 163 | a barline lost, OR a stem that was masking a barline the slicer never found (see below) |
| +2 → 0 | 64 | two stems on one row |
| +1 → −1 | 49 | a stem removed on a row that also misses a real barline |
| +2 → +1 | 44 | one of two stems |
| −1 → −2, −2 → −3 | 53 | a further real barline lost on a row already short |

The gate fired **5,432** times; about 2,500 of those were candidates `gate3_blob` rejected before
(it runs first now), the rest are new rejections.

**What the WORSE rows are** — two shapes, from the rows looked at by eye:

- **A stem that was masking a missed barline.** `bestenigar…ney_p2` s00: both rejected strokes are
  real stems (head on a line, beam on the other line), but the row also has a real barline gate 1
  never proposed. Before, +1 spurious and −1 missed summed to an "exact" row; now the count reads
  −1. The gate is right and the instrument cannot see that. This is the same blind spot
  [METRICS-SLICER-STAFF.md](#barlines--where-the-cut-goes) records for `never_a_candidate`.
- **A repeat barline with curved "wings".** `cok_yasa_ayse_ney_p1` s01: two real `‖:` / `:‖`
  strokes, drawn with a thin curved bracket touching the thick bar at both ends — bar plus wing read
  as "wide ink at both ends". A real loss, and the one shape the rule cannot separate from a stem by
  ends alone. The refinement below targets it.

#### 200 random corpus pages, geometry only (`arms.py --env OMR_END_BLOBS`)

| count | off | on | delta | pages + | pages − |
|---|---|---|---|---|---|
| staves | 1,530 | 1,530 | 0 | 0 | 0 |
| bars | 3,292 | 2,817 | **−475** | 0 | 136 |
| measures | 4,702 | 4,270 | −432 | 0 | 128 |
| strips | 4,204 | 4,201 | −3 | 20 | 19 |

64 pages (32%) byte-identical; no page gains a bar, as a tightening must. Worst single page
`yalandir_dogustan_sarhos_oldugum_nota_p1` 45 → 35. Raw: `arms_end_blobs.json` in the session
scratchpad (not kept).

#### Parity of the browser port

`slicer_ref.py --pages 20 --zero-pages 2` + `parity:slicer`: **W4 / W5 / W6 all PASS** — bar x
exact 576/576, **rejected candidates identical reason-for-reason on 154/154 rows**, strips
419/419 exact. The gate fired **56** times inside that sample, so the port was exercised, not just
compiled. ⚠ The three eligible hand-marked pages are not in `strips_v2`, so a `--stems` reference
on them is empty ("no pages to run") — that is the reference's page pool, not a failure.

### The refinement for winged repeat bars: width BEYOND the stroke (ships, priced +65)

"Wide" was the whole connected run through the column, so a repeat sign's thick stroke (~0.5 sp
by itself) plus a thin wing read as fat. The refinement measures the attachment **beyond the
stroke's own thickness** — `_stroke_width`, the median width through the run's middle third, where
nothing is attached — and a 2 px stem loses nothing by it. Same in `barlines.ts` (`strokeWidth`).

What it does on the cheap instruments:

| | before the refinement | with it |
|---|---|---|
| `cok_yasa_ayse_ney_p1` s01 | both winged `‖:` lost | **both kept** |
| `bestenigar…ney_p2` s00 stems | rejected | still rejected |
| the reported page | 5 stems gone; the thin stroke of the decorated closing `:‖` gone too | 5 stems gone; **closing stroke kept** |
| hand-marked truth (93 marks) | recall 47.3%, precision 86.3%, 7 false | recall 47.3%, precision **83.0%**, 9 false |

The two false barlines that come back are both on `gafil…`, the dark photocopy: its strokes are
thick merged ink, so subtracting a large stroke width defeats the test there. So the refinement
trades winged repeat bars (real, kept) against dense-photocopy strokes (false, back), and the
93 marks could not say which side outnumbers the other. **The full run could (second pass, same
day, owner-approved):**

| arm (6,440 rows) | exact rows | vs baseline BETTER / WORSE | vs the plain gate |
|---|---|---|---|
| gate off (baseline) | 3,762 | — | — |
| plain gate | 4,068 | 547 / 242 | — |
| **gate + stroke-width** | **4,133 (64.2%)** | **502 / 122** | 152 better / 75 worse on 227 rows |

The refinement's own moves against the plain gate: **−1 → 0 on 124 rows** (a real barline
recovered — the winged repeats) against **0 → +1 on 58** (a thick false stroke back). Against the
baseline the real-barline losses (`0 → −1`) fall from 163 rows to **70**, while the target class
(`+1 → 0`) keeps 389 of its 418. On 200 random pages: bars **3,292 → 2,904 (−388 on 122 pages,
none gain)**, staves and x-extent untouched, 78 pages byte-identical. `parity:slicer` on a fresh
20-page sample: bar x exact 584/584, rejects identical 154/154 rows, strips 420/420, with the
refined gate firing 31 times. `data/real/rung3/score_slicer.csv` holds this arm's per-row result.

### What is owed

1. Nothing on the gate itself — both passes are priced and both ship. The remaining WORSE rows
   (122 against the baseline) are the two known shapes above: a stem that masked a never-found
   barline, and dense photocopies. Neither is a rule this file should sharpen from 93 marks.
2. The decode caches: `GEOMETRY_REV` stays **20260903** (no cache on disk carried it when this
   landed) and the `end_blobs` key in `window_signature()["geometry"]` is what tells the two
   same-day geometries apart. Nothing is owed today; the next pool build re-decodes regardless.
