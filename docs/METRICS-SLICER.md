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
no interior barline at all**. Nothing here addresses that.

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

## Re-cutting the exam on the current slicer, priced (2026-08-24)

Read-only comparison of the frozen `strips_examv3` manifests against a fresh slice of the same pages:

| | |
|---|---|
| strips in examv3 | 1,369 |
| crop span **unchanged** | 1,075 (78.5%) |
| **moved or gone** | 294 (21.5%) |
| verdicts already recorded | 452 |
| **verdicts invalidated** | **78** (55 fix, 21 bad, 2 ok) |

⚠ **Optimistic lower bound.** It compares `row_x0`–`row_x1` only; a row whose vertical placement
moved gives different pixels under the same span. The exact figure needs the crops themselves
compared.

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

## The labelling pools are OLD-SLICER output (2026-07-28)

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

## Which crop root is still current — measured, not remembered (2026-08-17)

`scripts/rung3/check_crop_staleness.py` re-slices sampled pages with **today's** code and compares
crop-for-crop. It exists because the owner asked the right question before committing a week of
labelling — *are these crops even what the slicer makes now?* — and the answer differs by root, which
nothing recorded.

| root | queues that read it | pages keeping their labels (n=20) |
|---|---|---|
| `data/real/strips_v2` (2026-07-29 re-slice) | `reslice-all`, `realval-hard-v2` | **100%** — 18 byte-identical, 2 size-only |
| `data/real/strips` (2026-07-15..17) | `nota-*`, `exam-fix`, `r1-*`, `tup-*` | **10%** — 16 of 20 change crop COUNT, 2 change measures |

**What voids a label is the music, not the pixels.** The script grades in that order: different
measures or a different crop count voids it; a different width does not, and neither do different
pixel values. On the two `strips_v2` pages that moved, every crop carries **the same measures** — the
measured staff spacing shifted by half a pixel (8.5 → 9.0 px) on two systems of a **rotated** page, so
the row rescales ~5% narrower. A label still names the right notes.

**Consequences, both worth acting on:**

- **`reslice-all` is the safe queue to label** — 33,804 rows over 1,704 pages, 33,639 pending,
  ordered worst-first.
- **The 531 `fix` verdicts already in `nota-full` are stranded** on crops today's slicer does not
  produce. They still evidence that the SymbTr-derived labels were bad (531 fix vs 167 ok), but they
  are not 531 corrections anyone can bank. Re-slicing those pools is a rebuild, not a repair.

⚠ This is the third time crop staleness has cost something — 130 verdicts in July, the pools in the
row below, and nearly a week here. **Run this script before any labelling push**, and never infer a
root's freshness from a date.

⚠ **The n=20 row above is a corpus average, and a batch is not a random sample** (2026-08-18). The
labelling batches cut by `build_label_batch.py` deliberately select the *most damaged* pages, which
is the population most likely to move under a re-slice. `--pages-from <batch>_pages.json` therefore
re-slices **exactly the batch's pages** instead of a random sample — the difference between "the
root is mostly current" and "the work I am about to do will survive". Pages of the batch with no dir
under the root are reported, not skipped silently. Usage: [rung3/labeling-queues.md](rung3/labeling-queues.md).

## Windowing and the crop frame: measured in their own file

How a row is CUT into strips — the 2026-07-29 windowing retune and why the constants were not the
lever, the vertical frame that was clipping low beams, the shared-edge trim, and the crop-geometry
rails Round 3 is now moving — is a different genre of question and lives in
[METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md). Split out 2026-08-17 at the 400-line cap.
