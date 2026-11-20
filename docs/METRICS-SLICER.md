# Slicer diagnostics — what the page-cutter does, measured

purpose: how a real page is read into an ink mask, which crop root each pool came from, and how the browser slicer port measures against the Python
audience: agents and the owner, before changing the slicer or re-slicing a pool
updated: 2026-11-20

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-07-29 when that file crossed
the 400-line cap: that file keeps **what the model gets wrong**, this one **what the page-cutter
does**. Split again on 2026-08-17 at the same cap — **how a row is CUT into strips** moved to
[METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md). Nothing is duplicated in either split.

⚠ **Do not patch `page_to_strips.py` from reading it.** Two fixes written that way were reverted on
2026-07-28 (one was dead code, one was contradicted by the slicer's own manifests), and the
2026-07-29 windowing retune overturned its own premise once measured. Measure against real output
first; the probes below are the pattern.

## Pale staff lines: Otsu erases them, and the guard that fixes it (2026-08-17)

`ml/labels/pale_line_probe.py`, over all **2,987** corpus pages. `binarize_ink` is global Otsu, a
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

Measured for the browser port ([archive/phases.md](archive/phases.md#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed) W0), and it is the number that makes
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
[METRICS-SLICER.md](#slicer-port-parity--does-the-typescript-reproduce-the-python) — W4 parity, the manifest-reproducibility problem,
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
all in [METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md#barlines--where-the-cut-goes). Split out 2026-08-25 at the
400-line cap; this file keeps the STAFF and the ink mask, that one keeps the CUT. That file reached
the cap in turn, so the 2026-09-03 stem gate (`END_BLOBS` — a stroke with wide ink at BOTH ends is
a stem) lives in [METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md#a-stem-taken-for-a-barline--the-both-ends-gate).

## A screenshot's dark viewer frame: Otsu calls it ink (2026-11-15)

The owner uploaded a phone screenshot of a PDF viewer: 1080×1998 JPEG, two pages, the viewer's flat
gray (level **53**) down both sides and between the pages, **14** staves. The slicer found **13**
staves and cut **38** strips, and every row's last strip ended in a black block. Two mechanisms, one
cause — global Otsu puts the frame on the ink side:

- `_emit_staff` takes a column as staff when most line rows carry ink there. The frame's columns
  qualify, the 48 px of paper between staff end and frame is under `STAFF_GAP_BRIDGE_SP`, so every
  staff's `x1` ran to the image edge (**1079** where the staff ends at **1011**).
- The frame is a third brightness class. Otsu read **155** with it and **158** without; the page's
  1 px anti-aliased staff lines sit at **157–159**, and the last staff kept 2 of its 5 lines.

`whiten_frame` (Python) / `whitenFrame` (TS) paints the frame white after the deskew and before
binarization. Page coordinates do not move. After it: **14 of 14** staves, **36** strips, extents on
the staff.

| Where it was run | Result |
|---|---|
| Corpus pages (`data/real/images`) that it touches | **0 of 2,987** — the function returns the same array |
| Exam photos (`data/real/photos_exam`) it touches | **0 of 39** (14 of 39 before the straight-edge test) |
| Owner's hand-test screenshots (`exam_pages/`) it touches | **3 of 20** — see below |
| Python vs the TS port in Node, 12 pages (the screenshot, 4 framed variants, 1 clean, 6 corpus) | page bytes, staves and strips identical on **12 / 12** |
| The screenshot JPEG and the 3 hand-test pages in real headless **Chromium and WebKit** | same staves, strips and x-extents as Python on **4 / 4**, both engines |
| `parity:slicer --inject-skew`, 22 corpus pages | **420 / 420** strips exact, W4 W5 W6 PASS |
| Cost in the browser path | **≤ 22 ms** a page (Node, opencv.js), **1–3 ms** when it does nothing |

Framed variants, cut the way the browser cuts (no perspective crop), staves found before → after of 8:
black bars above and below **0 → 8**, black all round **0 → 8**, gray 53 all round **6 → 8**, gray
on the left only **6 → 8**. n = 1 page each, synthetic frames around one real page.

⚠ **The 3 hand-test pages are the same defect, not a false alarm.** A desktop screenshot carries a
1 px dark window-edge line down one side; on those pages every staff had `x0` or `x1` on the image
edge (e.g. `x1` 1157 on a 1158 px page, now 1110–1122). Their strip counts move 27 → 25, 17 → 16 and
27 → 27. ⚠ So a hand-test correction count taken before 2026-11-15 on those three pages was taken
on different crops.

⚠ **Not measured:** whether the model reads the re-cut strips better — no page here was decoded.
⚠ **Left alone on purpose:** two pages of different widths in one screenshot (the edge is not
straight, so the page is refused and cut as before), a frame lighter than Otsu's level (it was
never ink), and a toolbar with icons (only its flat part is a frame). The staff lines at 157–159
against a threshold of 158 are still marginal: the frame was one cause of the lost row, the page's
low resolution (10.5 px line spacing) is the other, and nothing here fixes that.

⚠ `GEOMETRY_REV` was **not** bumped, by the owner's decision — [DECISIONS.md](DECISIONS.md), 2026-11-15 row. The six synthetic cases in
`tools/tests/frame-test.ts` (inside `npm test`) pin the TS port to Python's bytes;
`ml/prep/frame_whiten_ref.py` prints the hashes to paste after any change to the rule.

## Which crop root a pool came from: measured in its own file

Crop **provenance** — which slicer cut which root, what a re-slice costs in labels, and how to
measure a queue's staleness before labelling it — is a different genre of question from what the
page-cutter *does*, and lives in [METRICS-SLICER.md](#crop-roots--which-slicer-cut-which-pool-and-what-a-re-slice-costs). Split out
2026-08-25 at the 400-line cap; nothing is duplicated.

## Windowing and the crop frame: measured in their own file

How a row is CUT into strips — the 2026-07-29 windowing retune and why the constants were not the
lever, the vertical frame that was clipping low beams, the shared-edge trim, and the crop-geometry
rails Round 3 is now moving — is a different genre of question and lives in
[METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md). Split out 2026-08-17 at the 400-line cap.

**Merged into this file on 2026-11-20:**

- [Crop roots — which slicer cut which pool, and what a re-slice costs](#crop-roots--which-slicer-cut-which-pool-and-what-a-re-slice-costs) — was `docs/METRICS-SLICER-ROOTS.md`
- [Slicer port parity — does the TypeScript reproduce the Python?](#slicer-port-parity--does-the-typescript-reproduce-the-python) — was `docs/METRICS-SLICER-PORT.md`


## Crop roots — which slicer cut which pool, and what a re-slice costs

*Was `docs/METRICS-SLICER-ROOTS.md` (last updated 2026-09-09).*

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-25 when that file crossed the
400-line cap. That file keeps **what the page-cutter does**; this one keeps **where a crop on disk
came from**. Nothing is duplicated in either.

⚠ **A strip filename survives a re-slice and its pixels do not.** That is the single fact this file
exists for: two roots can hold the same filenames and different images, so a label written against
one root is not a label for the other.

### Re-cutting the exam on the current slicer, priced THREE ways (2026-08-25)

⭐ **The answer is 125 verdicts, and the two earlier numbers were both bounds rather than estimates.**
All three measure the same re-cut; they differ in what they call a loss.

| measurement | verdicts lost | of 455 | what it actually asks |
|---|---|---|---|
| span comparison (2026-08-24, **superseded**) | 78 | 17% | did `row_x0`–`row_x1` move? Optimistic — same span can hold different pixels, and it predates the 25 Aug blob fix |
| page level (`check_crop_staleness.py`) | 287 | 63% | did ANY crop on this page move? Pessimistic — one moved crop voids a whole page |
| **strip level, `carry_gold`'s own rule** | **125** | **27%** | is there a crop holding this exact music, in a row whose barlines did not move? |

**Page level, all 67 pages** (`--root data/real/strips_examv3 --pages 67`, 2026-08-25):

| | pages |
|---|---|
| identical | 25 |
| pixels only / size only (labels fine) | 0 / 0 |
| **measures differ** — labels void | 16 |
| **crop count/names differ** — labels void | 26 |

**37% of pages keep their labels; 42 of 67 lose them.** ⚠ That the "labels fine" rows are both ZERO
is itself the finding: on this re-cut a page either survives untouched or its music moves.

**Strip level**, matching on `build_exam_v3_queue.py`'s own `MUSIC_KEYS` (L120 — `system`,
`meas_from`, `meas_to`, `n_measures`, `is_row_start`), with one guard added: an index match only
means "same music" if that row's **measure count** did not move, because adding a barline renumbers
every measure after it.

| outcome | crops (of 1,369) | verdicts (of 455) |
|---|---|---|
| **carried** — same span, row's barlines unchanged | 899 (65.7%) | **330 (73%)** |
| bars_changed — lands on a crop, but the row was renumbered | 77 | 25 |
| staves_changed — the page's staff count moved | 101 | 24 |
| **lost** — nothing holds that music | 292 (21.3%) | 76 |

Of the **125** needing a person again, **76 are fully lost** (retype from the picture) and **49 land
on a crop with the old label carried as a suggestion** — a confirm, not a retype.

⚠ **Do not use `check_crop_staleness.py`'s page verdict as a labelling bill.** It grades a page, and
it is the right tool for *"is this queue safe to label"* — but as a cost it over-counts by 2.3x here.

### What the staff RESCUE would add to that bill (2026-08-25)

Measured on the same 67 exam pages, rescue off vs on ([METRICS-SLICER.md](METRICS-SLICER.md)):

| | |
|---|---|
| staff rows, rescue **off** | 501 |
| staff rows, rescue **on** | **522 (+21)** |
| pages gaining a row | **14 of 67 (21%)** |

Concentrated: `vuslata_nail_de_etse_ger_felek_nota_p2` alone gains 4 (4 → 8) and four pages gain 2.
At ~2–3 strips a row that is roughly **+45–60 new strips**, all unlabelled, on pages already
verdicted — an `examv4` of ~710–725 rows against `examv3`'s 663.

⚠ **The exam and the training pools do not have to be cut with the same setting**, only to each be
internally consistent, and `window_signature()`'s `staff_rescue` field records which cut a given
decode. The rescue's value is highest where rows are free (training: **+320 rows over 227 pages**)
and lowest on the exam, which grades fine at 663 and whose difficulty has already shifted once.
⚠ The cost of splitting them is that the model would be **trained** on rescue-cut pages and
**graded** on pages cut without it. Unmeasured, and small only because every row both settings find
is cut identically. Not yet decided — [STATUS.md](STATUS.md).

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

### Which crop root is still current — measured, not remembered (2026-08-17)

`ml/labels/check_crop_staleness.py` re-slices sampled pages with **today's** code and compares
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
under the root are reported, not skipped silently. Usage: [rung3/labeling.md](rung3/labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3).

### `_realval_v2` had OLD labels with NEW pixels under them (2026-09-09)

⭐ **The fourth time crop staleness cost something, and the first time it reached a metric pool.**
`build_realval_v2.py --build` carries rows out of the previous `_realval` pool and then copies
`strip_root / page / image` under every row it writes. `strip_root` defaults to `strips_v2` — but
the old pool is entirely on the retired root: **271 of its 271 PNGs are byte-identical to
`data/real/strips/`**. So 157 carried rows got a current crop placed under a label read against the
retired one, with no span check between them. The 5 duplicate manifest rows
([BACKLOG.md](BACKLOG.md) item 2, open since 2026-08-16) were the visible tip of this, not a
separate defect.

**The referee, and why it is trustworthy.** Both roots carry a `round2-stage2-best` decode cache, so
each label can be scored against both roots' decodes in ID space with `eval_omr.align`. A model is
never asked whether a label is RIGHT, only which of two pictures it describes. The control is the
110 `hard` rows, which were hand-read against the current crop:

| group | closer to retired | closer to v2 | tie | no cache |
|---|---|---|---|---|
| `hard` (hand-read against v2) — **CONTROL** | 5 | **50** | 3 | 52 |
| `carried` (from the old pool) | **41** | 22 | 3 | 91 |
| ↳ restricted to crops the re-slice widened by ≥10%: `hard` | 0 | **31** | 1 | — |
| ↳ same restriction, `carried` | **15** | **0** | 0 | — |

The control separates the other way, and on the ≥10% cut the separation is total.

**What the repair costs**, classified by measure span — the deciding evidence, since an unchanged
span holds the same music however the pixels shifted (`repair_realval_v2.py --report`):

| | rows |
|---|---|
| keep — label and crop agree | 243 |
| DROP — carried twin of a duplicate image | 5 |
| RE-HOME — label moves to the v2 strip covering the same span | 3 |
| **REVIEW — label is for other measures, needs a human** | **10** |
| flagged — the pool still holds a RETIRED crop (`strips_v2` has no such file) | 6 |

So **10 of 262 distinct images (3.8%)** carry a label about music that is not in their picture.
⚠ **A span is only comparable across roots when the page's staff COUNT matches in both** — `system`
is an index, the same coupling that forces `score_slicer.py --pair-by-position`. 6 of the 10 review
rows are there because the two roots disagree on staff count, so no re-home was attempted.

⚠ **This does not invalidate a PAIRED result** — both arms read the same wrong labels and the
difference survives. It matters because Round 4 gave this pool a third job: `train.py --select-dir`
picks a checkpoint on **absolute** corrections against these labels
([rung3/round4.md](rung3/round4.md) step 2).

**The human read confirmed it (2026-09-16).** The owner read the 10 rows against the picture, with
the old label hidden: **2 `bad`** (crop unusable) and **8 `fix`**. ⭐ **Not one of the 8 answers
matches the old label** — every carried label described other music. One shows the staff-count
cause directly: `nicin_bulbul_figan_eyler…_p1_s03_w00`'s old label is the music the owner read in
**`s05_w00`**, two staff rows down. The `round2-stage2-best` decode was right on 6 of the 8 (spacing
only); the other 2 needed content the model missed (two `\tup3` groups; a fourth signature
accidental).

**`_realval_v2r`, built the same day: 260 rows, 260 distinct images** — 249 kept (the 243 above
plus the 6 flagged retired-crop rows, whose label matches the crop they carry), 3 re-homed, 8
re-read, 5 duplicate twins and 2 unusable crops dropped.

⛔ **The defect is in the builder, so a future `build_realval_v2.py --build` repeats it.** Not fixed
— [BACKLOG.md](BACKLOG.md).


## Slicer port parity — does the TypeScript reproduce the Python?

*Was `docs/METRICS-SLICER-PORT.md` (last updated 2026-08-05).*

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-04 when that file crossed the 400-line
cap. The split is by genre: that file keeps **what the Python page-cutter does**; this one keeps
**whether the port reproduces it**. Nothing is duplicated.

How to reproduce any number here — and ⚠ why the control is local Python rather than the manifests
on disk — is [archive/phases.md](archive/phases.md#porting-the-slicer-to-typescript--w4w6). Rung state: [archive/phases.md](archive/phases.md#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed).

### Both 2026-08-26 staff fixes port exactly, and both SHIP ON

`STAFF_GROUP_BY_SPAN` and `STAFF_SPAN_FIX_SPACING` are the first slicer changes this month to go on
by default, so parity here is not a diagnostic — it is what stops the app cutting differently from
the training data. 120 pages, run three times as the two landed:

| check | shipped rule | + group merge | **+ spacing fix (ships)** |
|---|---|---|---|
| staff line y's identical | 844/844 | 854/854 | **854/854 (100%)** |
| outer lines + spacing identical | 844/844 | 854/854 | **854/854** |
| staff x-extent / normalized row width | 844/844 | 854/854 | **854/854** each |
| strip count exact per page | 120/120 | 120/120 | **120/120** |
| window fields exact | 2352/2352 | 2379/2379 | **2388/2388** |
| `row_x0`/`row_x1` within 2 px, worst Δ | 0 px | 0 px | **0 px** |
| split_wide gutter cuts | 742 = 742 | 750 = 750 | **768 = 768** |
| deskew angle identical | 132/132 | 132/132 | **132/132** |
| | W4 W5 W6 PASS | PASS | **PASS** |

⭐ **The counts moving is the evidence the new code ran**: +10 staff rows from the merge, then +9
more strips as the spacing fix re-magnified rows whose scale had been wrong. Every one of them
agrees between TypeScript and Python.

⚠ **The bug behind the merge was found IN THE BROWSER and is invisible to Python alone** — the ±1
grayscale difference is what pushed `bozukNihavendLonga2` across the grouping threshold. It now reads
**10 staves**, matching Python, with the rescue on or off.

### The grouping repair, measured on its own (2026-08-26)

`STAFF_GROUP_BY_SPAN` is the first slicer change this month to go on by default, so parity here is
not a diagnostic — it is what stops the app cutting differently from the training data. 120 pages,
both sides on:

| check | result |
|---|---|
| staff line y's identical | **854/854 (100%)** — 844 before the merge, so it added 10 rows on this sample |
| outer lines + spacing identical | 854/854 |
| staff x-extent / normalized row width | 854/854 each |
| strip count exact per page | 120/120 |
| window fields exact | **2379/2379** strips |
| `row_x0`/`row_x1` within 2 px | 2379/2379, worst Δ **0 px** |
| split_wide gutter cuts | 750 = 750 |
| deskew angle identical | 132/132 |
| | **W4 PASS   W5 PASS   W6 PASS** |

⭐ **The bug this fixes was found IN THE BROWSER and is invisible to Python alone**: the ±1 grayscale
difference is what pushed `bozukNihavendLonga2` across the grouping threshold. The browser now reads
**10 staves**, matching Python, with the rescue on or off.

### The staff RESCUE ports exactly, tested with the flag ON (2026-08-25)

⭐ **The point of this entry is that the FLAG WAS ON.** A parity run with `STAFF_RESCUE` off passes
100% while executing none of the new code, so it proves only that the port did not disturb the
existing path. Both runs are recorded because only the second one is evidence about the rescue.

Same 120 pages, `slicer_ref.py` + `slicer-parity.ts`:

| check | rescue OFF both sides | rescue ON both sides |
|---|---|---|
| staff line y's identical | 844/844 | **871/871** |
| outer lines + spacing identical | 844/844 | **871/871** |
| staff x-extent identical | 844/844 | **871/871** |
| normalized row width identical | 844/844 | **871/871** |
| strip count exact per page | 120/120 | **120/120** |
| window fields exact | 2352/2352 | **2425/2425** |
| `row_x0`/`row_x1` within 2 px | 2352/2352, worst Δ **0 px** | **2425/2425, worst Δ 0 px** |
| split_wide gutter cuts | 742 = 742 | **780 = 780** |
| verdict | W4 W5 W6 **PASS** | W4 W5 W6 **PASS** |

⭐ **The counts moving is the evidence**: +27 staff rows and +73 strips on the same pages, and
TypeScript agreed with Python on every recovered row — same line positions, same x-extents, same
windowing, zero drift on any crop boundary.

⚠ **Testing it required editing the TS constant**, because `STAFF_RESCUE` is a compile-time constant
rather than an env knob (the browser has no environment). The run flips it to `true`, runs, and
restores `false` from a shell `trap` — and the restore was verified by reading the file afterwards,
not by trusting the trap. **A forgotten `true` there silently changes what the shipped app cuts.**

⚠ **`row pixel-sum drift max 427.1 ppm` is unchanged and is never zero** — the browser's grayscale
differs from Python's by ±1 by construction ([METRICS-SLICER.md](METRICS-SLICER.md)).

### Windowing and the driver reproduce Python (2026-08-04, MVP W6)

Port vs **local Python** over the **whole corpus — 1,781 pages / 33,805 strips**. The reference
side is the real `page_to_strips`: `slicer_ref.py` runs it into a temp dir rather than
re-implementing the driver's pad/trim block, so the control cannot share a misreading with the port.

| check | full corpus | W6 bar |
|---|---|---|
| strip count exact per page | **1,697/1,697 pages (100%)** — raw 1,704/1,705 | ≥99.5% |
| window fields exact (`is_row_start`, `split_wide`, measure span, `row_measures`) | **33,783/33,783 (100%)** — raw 33,799/33,805 | 100% |
| `row_x0`/`row_x1` within 2 px | **33,781/33,783 (99.99%)** — raw 33,802/33,805 | ≥99.9% |
| `row_x0`/`row_x1` exact | 33,778/33,805 (99.92%) | not gated |
| width/measure invariants | **port 0 violations, Python 0** | no worse than Python |
| clef-prefix trims (`hasNotehead`) | **861 rows, both sides** | not gated |
| `split_wide` gutter cuts | **10,246 strips, both sides** | not gated |

**`hasNotehead` is no longer a non-claim.** W5 ported it with nothing exercising it; the clef-prefix
trim is its only observable and it fires on **861 rows**, identically on both sides.

#### The bar was restated, and the restatement is the honest part

⚠ The three gated numbers are scored **on rows whose bar list agrees**, with the raw number printed
beside each. Windows are computed *from* the bars, so the **2 rows in 12,123** where W5 records a
±1-grayscale bar-count difference cannot produce identical windows: they account for **all 6** of
the raw field mismatches (3 strips on `birgunbana…_p1`, 3 on `kurdilihicazkar…_p2` — the only two
pages in the corpus whose bar count differs) and the single raw strip-count difference. Gating W6 on
them charges this rung for the previous one's known residue, exactly the way W4's "zero-staff pages
yield zero staves" bar failed a port that agreed with Python. Both numbers are reported so the
restatement hides nothing.

#### The 2 strips that move more than 2 px are a gutter, not a cut through ink

`benim_serv_i_hiramanim…_p1` s09 has **identical bars** (`[336, 1958, 3282]`) and identical
`split_wide` flags and pads, yet its two fragments differ: Python cuts at **931**, the port at
**939**. The 336→1958 measure is 1,622 px against the 1,435 cap, so `_split_wide` picks a gutter —
and the ±1 grayscale changes which columns read as zero-ink, moving the chosen gutter **centre** by
8 px. Both cut points lie inside the same whitespace run, so no ink is divided differently; the two
crops differ by 8 columns of blank. That is also why the decode arm below sees no width-linked
disagreement.

⚠ Same scope note as W4 and W5: the corpus run used `--inject-skew`, so it validates everything
downstream of the deskew estimator, not the estimator. At **0.4 s/page** with the angle supplied.

**The manifest ceiling for strips is much lower than for staves, as expected**: local Python
reproduces only **1,514/1,704 (88.85%)** of the manifests' strip entries, the port **1,502/1,704
(88.15%)**. One staff difference cascades into every strip of that page, which is why a
manifest-scored W6 would have looked catastrophic while agreeing with Python 100%.

### The decode verdict: the port's own crops are not worse than Python's (2026-08-04, MVP W6)

`npm run parity:arma -- --pages 20` slices 20 pages with the **port**, decodes those crops in the
browser, decodes **Python's** crops for the same pages, and scores both against Python's decode
cache — **pairwise on the same (system, window)**.

| arm | agrees with Python |
|---|---|
| **A — the ported slicer's crops** | **395/450 strips (87.78%)** |
| B — Python's crops (the W3 ceiling) | 387/450 (86.00%) |

- **0 strips unmatched in either direction.** The port emitted exactly Python's strip set on all 20
  pages, so no windowing difference is hiding behind the token comparison.
- **Discordant pairs: 12 A-only against 4 B-only, McNemar exact p = 0.077.** No detectable
  difference. The point estimate leans the port's way and that is **not** a claim worth making at
  this p — the honest reading is "same".
- **All 16 discordant strips have identical crop widths** (|Δ| = 0 px), and only **3 of 450** strips
  differ in width at all (≤2 px, all three in the both-agree group). Whatever the two decoders are
  splitting on, it is not where the slicer cut.
- **Disagreement sits where the model is unsure**, as at W3: median Python `min_logprob` −0.55
  (A-only), −0.92 (B-only), −0.90 (neither agrees) against **−0.018** on the 383 strips both arms
  get right.
- Arm B landing on exactly its recorded **86.00%** ceiling is a free control on the harness.

⚠ **This is a difference, not a level.** Agreement with Python is not quality (W3); if a future
change makes arm A look worse, the decisive test is `ml/prep/score_browser_gold.py` against gold.
⚠ **Do not compare arm A to the 86.0% number directly** — at n=450 its standard error is ~1.6 pp,
which is why the plan's original "within 1 pp of the ceiling" bar was replaced by this paired test.

#### `_split_wide`: the escalation loop is real, the collapse branch never fired

From Python's own strip entries over the corpus, grouping maximal runs of `split_wide` strips:

| | |
|---|---|
| split groups / strips in them | **4,414 / 10,246** (≈30% of all strips are gutter fragments) |
| groups where the even split held (`pieces == ceil(span/cap)`) | 3,825 |
| **groups that needed the escalation** (`pieces > n0`) | **589** |
| groups where cuts COLLAPSED onto one gutter (`pieces < n0`) | **0** |
| groups whose mean piece still exceeds the cap | 0 |

The escalation the trap list warned about is exercised 589 times and the port reproduces every one.
The `sorted(set(cuts))` collapse it is written to survive **never happens in this corpus** — ported
anyway, because it is a correctness property rather than a hot path, and one page with an unbroken
beam run would hit it.

### Barlines reproduce too (2026-08-04, MVP W5)

Port vs **local Python** over the same **whole corpus — 1,781 pages / 12,123 rows / 51,019 bars**.

| check | full corpus | W5 bar |
|---|---|---|
| bar **count** exact per row | **12,121/12,123 rows (99.98%)** | ≥99.0% |
| bar x within 1 px | **51,018/51,019 (100.00%)** | ≥99.9% |
| bar x exact | **51,013/51,019 (99.99%)** | ≥95% |
| **rejected candidates identical, reason for reason** | **12,112/12,123 rows (99.91%)** | not gated |

**All 8 differing rows are the ±1 grayscale residue, and every one was reproduced inside Python.**
Feeding Python its own *other* grayscale path (`cvtColor` on `imread` colour instead of
`imread(IMREAD_GRAYSCALE)` — the two disagree by ±1 on 3.8–9.5% of these pages' pixels) makes Python
emit **exactly the port's answer**, bar list *and* reject list. The same sensitivity test W0 used to
settle grayscale in the first place:

- **2 rows differ in bar COUNT, one in each direction** — `birgunbanageleceksinyillardansonrapdf…_p1`
  s1 (the port rejects candidate 2532 as `gate3_blob`, Python keeps it) and
  `kurdilihicazkar_saz_semai_haydar_tatliyay_kemani_no2_p2` s2 (Python rejects 1537, the port keeps
  it). Both are `_terminal_overshoot` near-ties, and Python flips to the port's verdict — including
  the identical reject list — under the perturbation. **A port bug in that walk would flip one way
  consistently across many rows; these are 2 rows out of 12,123, symmetric.**
- **The single 2 px difference is W4's `x0` residue, not a barline problem.**
  `sayd_eyledi_bu_gonlumu_bir_gozleri_ahu_nota_p1` s5 is the page W4 already recorded as having `x0`
  off by 1 (157 vs 158). `detect_barlines` snaps the row's first bar to `int(staff.x0 * scale)`, and
  that row's scale is exactly 2.0 — so 1 page px becomes 2 row px. Nothing in the gates moved.
- **On all 6 rows where a bar POSITION moved, the reject lists are identical** — no gate disagreed
  on any of them; these are cluster-centre moves, 4 of the 6 with nothing rejected at all.

#### The reject-list check found 9 more rows the bar list cannot see

Recording the rejected candidates was a free extra, and it earns its keep: **9 rows produce
identical bars while disagreeing about which candidates were thrown out**, on top of the 2 that
disagree on both. None is a new failure mode, and all three shapes are ±1 effects:

- **6 rows: a rejected candidate's x moves by 1** (e.g. `seddiaraban_saz_semai_cemil_bey_tanburi_p1`
  s1, `1147` vs `1148`) — same candidate, same reason.
- **2 rows: a candidate is generated on one side only** (`var_mi_cana_derd_i_askin_caresi_nota_p1`
  s5 loses `1872`), i.e. it fails gate 1 rather than being rejected later. Bars unaffected.
- **1 row: the same candidate is rejected for a different REASON** —
  `huseyni_saz_semai_rasid_efendi_neyzen_baba_p1` s7 col 956, `gate2_fat` in Python against
  `gate3_blob` in the port. Rejected either way, so the bar list never sees it. ⚠ This is the one
  worth remembering: a reason swap means two independent gates both sit near their thresholds on
  that column, and only this check can see it.

⚠ **Same scope note as W4: the corpus run used `--inject-skew`**, so it validates everything
downstream of the deskew estimator, not the estimator.

⚠ **Non-claim: `hasNotehead` is ported but NOT exercised by W5.** Its only caller is
`window_measures`, so nothing here measures it. W6 covers it.

**The manifests are the weaker reference here too, and again below the bar.** Current Python
reproduces only **11,689/12,099 (96.61%)** of the manifests' `row_bars`; the port reaches
**11,681/12,099 (96.55%)**, 8 rows below — the same 8 residue rows. A port scored against the
manifests would read 96.55% against a 99% bar and look like a failure.

### The TypeScript port reproduces stage 1 exactly (2026-08-04, MVP W4)

Port vs **local Python** over the **whole corpus — 1,781 pages / 12,123 systems**. Reference built
by `ml/prep/slicer_ref.py`, scored by `npm run parity:slicer`.

| check | full corpus | W4 bar |
|---|---|---|
| staff count exact | **1,704/1,704 pages (100%)** | ≥99.5% |
| manifest-zero pages match Python | **77/77 (100%)** | 100% |
| `scale` within 0.002 | **12,122/12,122 systems (100%)** | ≥99.5% |
| **outer lines + median spacing identical** | **12,123/12,123 (100%)** | not gated |
| normalized row width identical | 12,123/12,123 (100%) | not gated |
| staff x-extent identical | 12,122/12,123 (99.99%) | not gated |
| staff line y's identical | 12,117/12,123 (99.95%) | not gated |
| deskew angle identical | **132/132** (the un-injected 132-page run) | not gated |
| normalized-row pixel-sum drift | max 548 ppm | never 0, see below |

**Everything that differs is the ±1 grayscale residue, and this is the first time that residue has
been observed reaching an output at all.** Two shapes, both harmless and both diagnosed rather than
waved through:

- **7 systems, 1 px.** Six have one *interior* staff line's cluster centre off by 1 px (e.g.
  `sipihr_p_dilhayat_kalfa_p2` s3: `884` vs `883`) and one has `x0` off by 1
  (`sayd_eyledi_bu_gonlumu_bir_gozleri_ahu_nota_p1` s5: 158 vs 157). One page row of ink falls on
  the other side of Otsu.
- **None of them reaches a crop.** `normalize_row` reads only the **outer** lines and the **median**
  spacing, and that triple is identical on **all 12,123** systems — which is why the row width and
  `scale` are 100%. An interior line cannot move the median of four gaps. W5 inherits an identical
  normalized row.

The pixel-sum drift has the same cause and is reported rather than gated for the same reason: a
browser cannot reach `imread(IMREAD_GRAYSCALE)`'s bytes (see the section above).

⚠ **The deskew angle is NOT covered by the full-corpus run.** It used `--inject-skew` (Python's
angle fed in) to stay affordable, so its "1,781/1,781" is trivially true. The estimator's real
number is **132/132 from the 132-page un-injected run**, and that is the one to quote.

⚠ **The zero-staff bar was restated, on purpose.** It was written as "the zero-staff pages yield
zero staves — 100%", with those pages identified by an **empty manifest**. Local Python now finds a
staff on **1 of the 77** (`serapa_husn_u_ansin_dil_sitansin_nota_p1`), and the port finds the same
one with identical lines, x-extent, spacing and scale — so the original wording failed a port that
agreed with Python exactly. Held against the control like every other check (port must match
Python's staff count there) it is 77/77, and the tool prints the drift count beside it.

#### The manifests on disk are NOT reproducible, so they cannot be the bar

The port was first scored against `data/real/strips_v2/*_manifest.json` and read **86.7%**. That
number measured two things at once. Running the **current** `page_to_strips.py` over the whole
corpus agrees with those manifests on only **1,680/1,704 (98.59%)** — already below W4's own bar.
1,578 of the 1,781 page dirs were sliced on Colab, and the artifact has drifted from the code.

One page makes the point: `gozumden_gonlumden_hayali_gitmez_nota_p1` has a manifest saying 5
systems; local Python finds **7**, and the port finds the same 7 with every line y, x0, x1 and
spacing identical. It was being scored as a port failure. **The port reaches the manifest ceiling
exactly — 1,680/1,704, the same pages as Python.**

Same shape as the arm-B decode ceiling ([archive/phases.md](archive/phases.md#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed) W3): agreement with an
artifact is not correctness.

#### Deskew is NOT a no-op on this corpus (2026-08-03)

**15.3% of pages (272/1,781) take a real rotation** from `estimate_skew` — 17.4% (23/132) on the
first sample, angles 0.3–1.1° — against **0%** that take a perspective crop. The plan had both down
as no-ops on clean input; only the crop is. Skipping the rotation cost whole systems
(`hengam_i_safadir_yine_sen_nus_i_mey_eyle_nota_p1` went 10 staves → **0**), and **22 of the 23**
pages failing the first parity run were exactly the 23 deskewed ones.

⚠ **Cost: 36.1 s/page in the browser** (the parity harness's corpus mean; the end-to-end number a user waits for is in [METRICS.md](METRICS.md)), ~35 s of it the 41-rotation sweep (each rotation re-runs a
page-wide `MORPH_OPEN`), against ~1.9 s for Python's whole stage 1 — ~19× slower. A W7 latency
problem: an axis-aligned screenshot pays the full sweep to learn it has no skew. It also puts a
full-corpus parity run at ~18 h, which is why `--inject-skew` exists (feed Python's angle in and
check everything downstream); with it the corpus run reads 0.4 s/page.

**W7 made this non-blocking, not cheaper (2026-08-05).** The sweep now yields to the event loop
between rotations (`estimateSkewAsync`), so the tab stays responsive and shows progress; the work
done is identical, verified by re-running this harness with the real estimator on 20 pages —
**deskew angle identical 20/20**. The cost itself is untouched and is the open W7 item in
[STATUS.md](STATUS.md).
