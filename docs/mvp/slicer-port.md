# Porting the slicer to TypeScript — W4–W6

purpose: everything needed to transliterate `page_to_strips.py` into the browser, including the traps that were found the expensive way
audience: whoever picks up rung W4, W5 or W6 of the MVP ladder
updated: 2026-08-04

> Track index and current rung state: [README.md](README.md). Project state: [../STATUS.md](../STATUS.md).
> What the slicer does and why: [../PIPELINE.md](../PIPELINE.md) §1 and
> [../METRICS-SLICER.md](../METRICS-SLICER.md).

⚠ **Do not patch `page_to_strips.py` from reading it, and do not "improve" it while porting.** Two
fixes written that way were reverted on 2026-07-28, and the 2026-07-29 windowing retune overturned
its own premise once measured. This is a **transliteration**. Behaviour changes are a separate
decision with their own measurement.

## What is being ported

Screenshots and clean scans only (owner decision, [../DECISIONS.md](../DECISIONS.md)). The chain:

```
load_gray → prep_page → binarize_ink → connectedComponents → detect_staves
  per staff: normalize_row → detect_barlines → window_measures → pad/trim/crop
```

⚠ **`prepPage.ts` is NOT a full no-op, and the version of this page that said it was cost a day.**
The claim was that every step of the camera path is inert on clean input. Measured against the
corpus at W4, that is true of the perspective crop (**0%** of pages take one) and false of the
deskew (**15.3%**, 272 of 1,781, take a real rotation). Skipping the rotation took one page from 10
staves to **0**, and 22 of the 23 pages that failed the first parity run were exactly the 23
deskewed ones. So:

- **`estimate_skew` + `deskew` are ported in full.** Both guards (0.3° deadband, "must buy ≥3 more
  staff-line rows") survive, so an axis-aligned screenshot still passes through untouched.
- **`detect_page_quad` + `crop_to_page` are still the seam.** They slot into `prepPage` later and
  nothing else in the port changes.

⚠ **The deskew costs ~35 s of the ~36 s a page takes in the browser** — 41 rotations, each with a
page-wide `MORPH_OPEN`. That is a **W7** problem (a screenshot pays the whole sweep to learn it has
no skew), not a W4 one, and it is why the parity harness has `--inject-skew`. Do not "fix" it inside
the port: a faster estimator is a behaviour change and needs its own measurement.

**Not ported** — confirm each in review, they are training bookkeeping with no effect on pixels:
`window_signature` (L749), `window_cache_ok` (L756), `row_cost_features` (L706),
`estimate_tokens` (L737), `est_tokens`/`budget_risk`, **all of `budget` mode**,
`meas_from`/`meas_to`/`row_measures` (the stitcher reads only `system`/`window`/`tokens`), the
`--debug` overlay branch, and every filesystem write.

Dropping budget mode outright rather than defaulting it off also removes `window_measures`' entire
`cost()` threading (~60 lines of the hardest numpy). It ships OFF as a measured wash and in legacy
mode never influences a decision — verified.

## File layout

| File | Holds |
|---|---|
| `apps/web/src/omr/slicer/cvOps.ts` | **the only file importing opencv.js**: `decodeGray`, `binarizeInk`, `openHorizontal`, `connectedComponents`, `resizeArea`/`resizeScale`, `copyMakeBorderTB`, `rotate`, `subRows` |
| `apps/web/src/omr/slicer/constants.ts` | every constant from `page_to_strips.py` L32–97 + `STAFF_HOR_FRAC` (L308), each with its Python line number, plus `pyRound()` |
| `apps/web/src/omr/slicer/prepPage.ts` | `qualifyingLineRows` L223, `estimateSkew` L237, `deskew` L266, `prepPage` L280 — plus the crop seam |
| `apps/web/src/omr/slicer/staves.ts` | `detectStaves` L310, `clusterRows` L341, `emitStaff` L355 |
| `apps/web/src/omr/slicer/rows.ts` | `rowMusicExtent` L400, `placeBand` L423, `normalizeRow` L446 |
| `apps/web/src/omr/slicer/barlines.ts` | `longestVerticalRun` L474, `isThinStroke` L485, `clusterCols` L521, `terminalOvershoot` L544, `detectBarlines` L592, `hasNotehead` L679 |
| `apps/web/src/omr/slicer/windows.ts` | `spanCap` L776, `splitWide` L786, `windowMeasures` L867 |
| `apps/web/src/omr/slicer/slicer.ts` | the driver (L961–1011, minus filesystem and debug); `sliceStage1` is the W4 half |
| `apps/web/src/checks/slicerHarness.ts` + `apps/web/slicer-harness.html` | headless entry the parity tool drives; returns geometry only, never pixels |
| `scripts/slicer_ref.py` | the Python control arm; also defines the sample |
| `tools/vision/parity/slicer-parity.ts` | `npm run parity:slicer` |

## Trap 1 — `Math.round` is not Python's `round`. Verified, twice, in load-bearing places.

Python rounds half-to-even; JavaScript rounds half-up. Two barline-discrimination parameters land
**exactly** on `.5`:

```
int(round(30 * 0.35))  →  Python 10,  Math.round 11    # `tol`,   detect_barlines gate-1 slack
int(round(30 * 0.75))  →  Python 22,  Math.round 23    # `fat_w`, detect_barlines gate-2 width
```

A naive port silently retunes both gates and every downstream measure boundary with them.
**Use `pyRound()` at every `round()` site, no exceptions** — including `_emit_staff`'s
`tol = max(2, int(round(sp * 0.2)))` and `normalize_row`'s `band_top`/`band_bot`/`top_line_y`,
which take arbitrary floats and can land on `.5` for some staff spacings.

## Trap 2 — grayscale can never be exact, and that is fine

`cv2.imread(IMREAD_GRAYSCALE)` converts inside the PNG decoder; a browser only ever sees RGBA and
converts afterwards. OpenCV's own two paths already differ by ±1 on 7.4% of a colour page's pixels,
and 18% of corpus pages are truly colour. **Settled by measurement, not tolerance:** re-running the
whole slicer under that perturbation left all 119 strips across the 6 most colour-shifted pages
bit-identical. Numbers in [../METRICS-SLICER.md](../METRICS-SLICER.md). Decode with
`createImageBitmap(blob, {colorSpaceConversion: "none", premultiplyAlpha: "none"})`.

opencv.js itself is **exact** against OpenCV-Python on the five primitives when fed identical bytes
(W0, both sides OpenCV 5.0.0) — so any divergence you find is the port, not the library.

## Trap 3 — named hazards, per function

Transliterate line by line; do not restructure into something cleaner.

- **`_is_thin_stroke` L505-507** — a staff row `continue`s **without resetting `run`**. The
  "skip but don't reset" semantics is easy to get subtly wrong and silently changes what counts as a
  barline.
- **`_terminal_overshoot`'s inner walk L560-585** — four state variables with four different reset
  rules: `ov` updates only on inked rows, `run` resets on a blank row, `gap_rows > 1` breaks, and
  `is_wide` latches once set. The fiddliest 46 lines in the file, and it is what separates a barline
  from a G-clef.
- **`binarize_ink(row)` re-thresholds the ROW, not the page**, at three separate call sites
  (`detect_barlines` L622, `_has_notehead` L692, `_split_wide` L813). Do **not** hoist them into one
  Otsu — they run on different sub-images.
- **`_emit_staff` L370-395** reads the **raw** ink for the x-extent, not the opened image. The
  comment explains why: on a slightly skewed scan the opened image loses a line's ends and pushes
  `x0` 70–490 px right, cutting the clef or whole measures.
- **`is_bar = longest >= span * 0.85`** compares a float against an int run length. Keep it a float
  compare.
- **`_split_wide`** — `sorted(set(cuts))` (L836) can collapse two targets onto one gutter and yield
  fewer pieces than `n`; the escalation loop (L843-846) depends on that. Python's `min(near)`
  compares tuples, so JS needs an explicit two-key comparator. L818-822 uses the loop variable
  **after** the loop — Python leaks it, JS will not, so keep an explicit `lastX`.
- **`normalize_row`'s `cv2.resize(crop, (new_w, STRIP_H))`** is a non-uniform resize. Keep it one
  call; do not decompose into two.
- **`VPLACE_ADAPTIVE` is ON by default** and changes the crops. It needs the whole-page
  `connectedComponents` label map plus `row_music_extent`'s label-set membership test. Turning it
  off would re-introduce the measured 11.6% beam clipping.

## The control is LOCAL PYTHON, not the manifests on disk

⚠ **Read this before writing any acceptance check.** The manifests in `data/real/strips_v2` look
like ground truth and are not: **the current `page_to_strips.py` reproduces only 118 of 120 of
them**, because 1,578 of the 1,781 page dirs were sliced on Colab and the artifact has drifted from
the code. That is already below W4's own 99.5% bar, so a port scored against manifests can fail
while being perfect. It happened: the first W4 run read 86.7%, and one of the pages it failed
(`gozumden_gonlumden_hayali_gitmez_nota_p1`) matched local Python line for line, 7 staves against
the manifest's 5.

So the flow is:

```bash
.venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out ref.json   # the control, ~1.9 s/page
npx tsx tools/vision/parity/slicer-parity.ts --ref ref.json            # ~36 s/page
```

`ref.json` also **defines the sample** — the browser side runs exactly the pages in it, so the two
sides cannot drift apart on which pages they ran. Manifest agreement is still printed, as the
weaker second reference and as the ceiling any port could reach against it.

`--inject-skew` feeds Python's angle in and skips the 41-rotation sweep (~35 of the 36 s), which is
what makes a full-corpus run affordable; the estimator itself is then only covered by runs without
the flag. Same principle as W3: **agreement with an artifact is not correctness.**

## Acceptance, per rung

The corpus: `data/real/strips_v2` — **1,781 page dirs**, each with a `_manifest.json` and a
`_debug.png`, and **1,704 with a `_decode.json`**. Accept a page only if its decode header matches
`checkpoint: round2-stage2-best`, `suffix: _int8`, `measures_per_strip: 3`, `window_mode: legacy`,
`edge_trim: true`, `vplace: true` — that selects the page set; the *values* come from
`slicer_ref.py`. The 77 pages with an empty manifest are the zero-staff pages and are scored
separately. **Exclude `data/real/strips/` entirely** — exam-frozen, cut by older code.

The `_debug.png` overlays are already on disk and colour-code rejected barline candidates by reason
(`gate2_fat` orange, `gate3_clef` purple, `gate3_blob` yellow, `xrange` grey). That is a free
debugger for W5 — use it before theorising.

**W4 — staves + row normalization** ✅ **PASSED**; numbers in [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md)
Measured over the **whole corpus** (1,781 pages / 12,123 systems), not a sample:
- staff count exact on **≥99.5%** of eligible pages — got **1,704/1,704**
- the manifest-zero pages match Python — **77/77**. ⚠ The bar was written as "yield zero staves";
  Python now finds a staff on 1 of the 77 and the port finds the same one, so it is held against
  the control like every other check
- per-system `scale` within **0.002** — got **12,122/12,122**
- free extras: row width and outer-lines+median-spacing both **12,123/12,123**; the only differences
  anywhere are 7 systems off by 1 px (six an *interior* line, one an `x0`), none reaching a crop
- ⚠ the corpus run used `--inject-skew`, so the **estimator** is validated on 132 pages (132/132),
  not the corpus

**W5 — barlines** ✅ **PASSED**; numbers in [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).
Measured over the **whole corpus** (1,781 pages / 12,123 rows / 51,019 bars), against **local
Python's** bar list — `slicer_ref.py` now records it (and the reject list) beside the staves. The
manifest's `row_bars` is the weaker second reference and sits at 96.61% for Python itself
- bar **count** per row exactly equal on **≥99.0%** of rows — got **12,121/12,123 (99.98%)**. A count
  difference shifts every downstream window and measure index, so it gets no tolerance
- among count-matching rows, per-bar `|Δx| ≤ 1 px` on **≥99.9%** — got **51,018/51,019 (100.00%)** —
  and `== 0` on **≥95%** — got **51,013/51,019 (99.99%)**
- free extra: **rejected candidates identical, reason for reason, on 12,112/12,123 rows (99.91%)**.
  Stricter than the bar list and worth keeping — it is the only check that can see two gates both
  sitting near their thresholds on the same column
- the hand-inspection step was replaced by something stronger: **every one of the 8 differing rows
  was reproduced inside Python** by feeding it its own other grayscale path, which returns the
  port's exact bar *and* reject list. Diagnosis beats eyeballing an overlay
- W4 handed W5 a **bit-identical normalized row** on all 12,123 systems, so every difference found
  is genuinely in `detect_barlines` and not inherited
- ⚠ `hasNotehead` is ported but **not exercised** — its only caller is `window_measures`. W6 covers it

**W6 — windowing, driver, and the parity verdict** ✅ **PASSED**; numbers in
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md). Whole corpus, 1,781 pages / 33,805 strips:
- strip count per page exact on **≥99.5%** of pages — got **1,697/1,697 (100%)**
- `system`, `window`, `is_row_start`, `split_wide` exact — got **33,783/33,783 (100%)**;
  `row_x0`/`row_x1` within **2 px** on ≥99.9% — got **33,781/33,783 (99.99%)**
- the width/measure invariants hold at the same **0** violations Python currently has — got **0**
- free extras: **861 clef-prefix trims** identical, which is the first thing to exercise
  `hasNotehead` at all, and **10,246 `split_wide` fragments** identical
- ⚠ **the first three are scored on rows whose BAR LIST agrees**, with the raw number printed
  beside each. Windows are computed from the bars, so W5's 2 residue rows cannot yield identical
  windows — and they account for **all 6** raw field mismatches. Restating this was the same
  correction W4 had to make to its zero-staff bar: a criterion written before the ±1 grayscale
  residue was understood will fail a port that agrees with Python everywhere the residue does not
  reach. **When a bar is restated, print both numbers** — that is what keeps it honest
- ⚠ the corpus run used `--inject-skew` (0.4 s/page), so the estimator is still only validated on
  the 132-page un-injected run

**The decode arm (also W6)**: `npm run parity:arma -- --pages 20` — arm A **395/450 (87.78%)**
against arm B **387/450 (86.00%)**, 12 vs 4 discordant, **McNemar exact p = 0.077**, 0 strips
unmatched. See the note below on why this is paired rather than compared to 86.0%.

## W6's parity test: paired, not a level comparison

⚠ **Do not judge arm A against the 86.0% ceiling number.** That was the original plan and it does
not work: at n=450 the standard error is ~1.6 pp, so a "within 1 pp" bar is inside the noise, and
40 pages would only reach ~1.2 pp.

Arm A (the ported slicer's own crops) and arm B (Python's crops, `tools/vision/parity/arm-b.ts`)
decode the **same strips**, so compare them **pairwise**: count the strips where exactly one arm
matches Python's tokens. A McNemar-style test on those discordant pairs is far more sensitive than
differencing two independent proportions, and it needs no extra pages.

Remember what the ceiling is and is not. **Agreement is not quality** — W3 established that the
browser scores the same as Python against hand-verified gold (SER 0.0818 vs 0.0821), so a strip
where the two decoders differ is usually a near-tie, not an error. If arm A's crops look suspect,
the decisive test is the same one W3 used: score against gold with
`scripts/score_browser_gold.py`, not against Python's tokens.

**Result (2026-08-04):** 12 A-only against 4 B-only on 450 paired strips, p = 0.077 — no detectable
difference. The design paid for itself twice over: all 16 discordant strips have **identical crop
widths**, which is what rules the slicer out as the cause, and the level comparison the plan
originally asked for would have read "87.78% vs 86.00%" and said nothing at all.

## Commands

```bash
npm run probe:cv                      # opencv.js still matches OpenCV-Python
.venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out ref.json   # the control arm, ~4.2 s/page
npm run parity:slicer -- --ref ref.json [--inject-skew] [--dump d.json] [--page <stem>]
npm run parity:armb -- --pages 20     # the ceiling
npm run parity:arma -- --pages 20     # arm A vs arm B, paired (~80 s/page: real deskew + 2 decodes)
npm run decode:pool -- --pool <dir> --out b.json   # browser decode of a strip pool
.venv-ml/bin/python scripts/score_browser_gold.py --browser b.json
npm run typecheck && npm test && npm run gate:browser
```
