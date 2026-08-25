# Slicer diagnostics — what the page-cutter does, measured

purpose: the single home for how a real page is READ INTO AN INK MASK — binarization, grayscale fidelity, opencv.js parity, and which slicer the labelled pools came from
audience: agents and the owner, before changing the slicer or re-slicing a pool
updated: 2026-08-24

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-07-29 when that file crossed
the 400-line cap: that file keeps **what the model gets wrong**, this one **what the page-cutter
does**. Split again on 2026-08-17 at the same cap — **how a row is CUT into strips** moved to
[METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md). Nothing is duplicated in either split.

⚠ **Do not patch `page_to_strips.py` from reading it.** Two fixes written that way were reverted on
2026-07-28 (one was dead code, one was contradicted by the slicer's own manifests), and the
2026-07-29 windowing retune overturned its own premise once measured. Measure against real output
first; the probes below are the pattern.

## Pale staff lines: Otsu erases them, and the guard that fixes it (2026-08-17)

`scripts/rung3/pale_line_probe.py`, over all **2,987** corpus pages. `binarize_ink` is global Otsu, a
**two**-class split; a page with black noteheads and pale staff lines has **three** classes. On the
1056 px re-scanned photocopy that started this: paper **253**, lines **219**, noteheads **27**, Otsu
threshold **156** — the lines land on the paper side and vanish (0 staves, 0 strips) while the notes
survive intact. It compounds: `estimate_skew` gates on the same rows, so with the lines gone the sweep
maximised noise and returned **+7.5°** where the truth was about **−0.25°**.

| | pages |
|---|---|
| 0 staves **before** | 144 (4.8%) |
| 0 staves **after** | **107 (3.6%)** |
| fallback **TRIED** | 93 |
| fallback **FIRED** (believed) | **37** |
| **RECOVERED** (0 → >0) | **37** |
| **REGRESSED** | **0** |
| fired while already detecting staves | **0** |

⚠ **"93" and "37" are different quantities, and the guard's first write-up used one word for both.**
93 pages reach the fallback (Otsu exposes fewer than `PALE_LINE_MIN_ROWS = 4` clustered line rows); of
those 51 find no staves under the paper-relative threshold either, **5** are refused by the shape
check, and **37** are believed — every one already at 0 staves, every one recovering. That is what
makes "it has nothing to lose" a measurement rather than a hope.

**Both guards are narrow on purpose.** An earlier version fired whenever no row spanned half the page
width — true of many readable pages, since `detect_staves` needs only 20% — and pushed **62 of 65**
working pages from 9–11 staves to **zero**. The shape check then refuses an absurd interline/height:
the 37 that fire sit at **0.0035–0.0152**, all **5** refusals are *too coarse* (0.0387–0.2014) — the
lyrics-page failure, text baselines grouped into "staves".

⚠ **New, from writing the probe:** of the **107** pages still at 0 staves, **51 are never offered to
the fallback**. `PALE_LINE_MIN_ROWS` gates on clustered *line rows*, not staves, so a page with ≥4 rows
of horizontal ink that `detect_staves` cannot group into 5-line systems fails late and is never
retried. Recorded, not acted on.

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

## The slicer is insensitive to ±1 grayscale noise (2026-08-02)

Measured for the browser port ([mvp/README.md](mvp/README.md) W0), and it is the number that makes
the port possible at all.

`cv2.imread(IMREAD_GRAYSCALE)` converts RGB→gray **inside the PNG decoder**; a browser only ever
gets RGBA out of the decoder and converts afterwards, so it can never reproduce those bytes exactly.
The gap is real but small — OpenCV's own two paths (`imread`-gray vs `cvtColor` on `imread`-colour)
differ by **±1 on 7.44%** of the pixels of a colour page. Sampling 120 corpus pages: 0 are
single-channel, 98 are RGB-but-neutral (`R==G==B`, where every formula agrees trivially) and
**22 (18%) are truly colour**, so this is not an edge case.

**Re-running the whole slicer under exactly that perturbation changes nothing.** On the 6 most
colour-shifted pages in the corpus, all **119 strips are bit-identical**: same strip count, same
`row_x0`/`row_x1`/`width`/`pad`/`scale`/`is_row_start`, same `row_bars`, same measure indices.

| page | strips | manifest diff |
|---|---|---|
| `ey_but_i_nev_eda_olmusum_muptela_nota_p1` | 27 | identical |
| `husnune_mail_gonlum_ezelden_nota_p1` | 18 | identical |
| `havada_bulut_yok_bu_ne_dumandir_p1` | 19 | identical |
| `oh_guzel_kiz_sirin_kiz_bakislari_derin_kiz_p2` | 22 | identical |
| `siyah_ebrulerin_p1` | 16 | identical |
| `enginde_yavas_yavas_gunun_minesi_soldu_nota_p2` | 17 | identical |

Downstream drift from the same perturbation, measured through opencv.js on one colour page:
Otsu threshold **unchanged** (154), connectedComponents **unchanged** (1,522 labels), ink pixel
count −354 of 408,651 (**0.087%**), MORPH_OPEN row projection max Δ1 of a 1,513 peak, INTER_AREA
column sums max Δ89 of ~85,680 (**0.10%**). The two quantities that actually drive slicer decisions
— the Otsu threshold and the CC label count — do not move.

⚠ **This is a claim about sub-quantization noise only.** It says nothing about a browser that
applies colour management or gamma to a profiled PNG; the probe deliberately decodes with
`colorSpaceConversion: "none"` and `premultiplyAlpha: "none"`, and the corpus page used carries no
ICC profile.

## The port: measured in its own file

Whether the TypeScript slicer reproduces the above is a different genre of question and lives in
[METRICS-SLICER-PORT.md](METRICS-SLICER-PORT.md) — W4 parity, the manifest-reproducibility problem,
and the deskew that was not the no-op the plan assumed.

## opencv.js reproduces OpenCV-Python exactly (2026-08-02)

Same page, same input bytes, `@techstark/opencv-js` 5.0.0-release.1 vs `cv2` 5.0.0 — versions
checked, not assumed. Fed Python's own grayscale bytes, all five primitives the slicer rests on are
**exact**: Otsu threshold 154, ink 408,651 px, the full 2,339-row MORPH_OPEN projection
(kernel 181×1), connectedComponents 1,522 labels, and the INTER_AREA column sums of a
1653×400 → 909×336 resize. Run it with `npm run probe:cv`.

## Barlines — where the cut goes, measured in their own file

What a barline IS to the slicer, which gate rejects what, the hand-marked ground truth and the
recall/precision it produces, and why "does the cut pass through a symbol" was the wrong question —
all in [METRICS-SLICER-BARLINES.md](METRICS-SLICER-BARLINES.md). Split out 2026-08-25 at the
400-line cap; this file keeps the STAFF and the ink mask, that one keeps the CUT.

## Which crop root a pool came from: measured in its own file

Crop **provenance** — which slicer cut which root, what a re-slice costs in labels, and how to
measure a queue's staleness before labelling it — is a different genre of question from what the
page-cutter *does*, and lives in [METRICS-SLICER-ROOTS.md](METRICS-SLICER-ROOTS.md). Split out
2026-08-25 at the 400-line cap; nothing is duplicated.

## Windowing and the crop frame: measured in their own file

How a row is CUT into strips — the 2026-07-29 windowing retune and why the constants were not the
lever, the vertical frame that was clipping low beams, the shared-edge trim, and the crop-geometry
rails Round 3 is now moving — is a different genre of question and lives in
[METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md). Split out 2026-08-17 at the 400-line cap.
