# Slicer diagnostics — what the page-cutter does, measured

purpose: the single home for how a real page is READ INTO AN INK MASK — binarization, grayscale fidelity, opencv.js parity, and which slicer the labelled pools came from
audience: agents and the owner, before changing the slicer or re-slicing a pool
updated: 2026-09-03

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

## Staff detection: measured in its own file

How the five lines are found in the mask above — the faded-row fixes, the staff SIZE and WIDTH
consensus, the missing-row rescue, the grouping repair, and why the row-level scorers cannot price
any of it — is [METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md).

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
400-line cap; this file keeps the STAFF and the ink mask, that one keeps the CUT. That file reached
the cap in turn, so the 2026-09-03 stem gate (`END_BLOBS` — a stroke with wide ink at BOTH ends is
a stem) lives in [METRICS-SLICER-STEMS.md](METRICS-SLICER-STEMS.md).

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
