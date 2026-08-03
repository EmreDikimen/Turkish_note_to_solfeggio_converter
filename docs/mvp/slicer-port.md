# Porting the slicer to TypeScript — W4–W6

purpose: everything needed to transliterate `page_to_strips.py` into the browser, including the traps that were found the expensive way
audience: whoever picks up rung W4, W5 or W6 of the MVP ladder
updated: 2026-08-03

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
load_gray → binarize_ink → connectedComponents → detect_staves
  per staff: normalize_row → detect_barlines → window_measures → pad/trim/crop
```

`prepPage.ts` is the **photo-stage seam**: a no-op with `prep_page`'s exact signature returning
`{gray, cropped: false, skewDeg: 0}`. The camera path (`detect_page_quad`, `crop_to_page`,
`estimate_skew`, `deskew`) slots in there later and nothing else in the port changes. Every one of
those is already a documented no-op on clean input.

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
| `apps/web/src/omr/slicer/cvOps.ts` | **the only file importing opencv.js**: `binarizeInk`, `openHorizontal`, `connectedComponents`, `resizeArea`, `copyMakeBorder` |
| `apps/web/src/omr/slicer/constants.ts` | every constant from `page_to_strips.py` L32–97 + `STAFF_HOR_FRAC` (L308), each with its Python line number, plus `pyRound()` |
| `apps/web/src/omr/slicer/prepPage.ts` | the photo seam (no-op) |
| `apps/web/src/omr/slicer/staves.ts` | `detectStaves` L310, `clusterRows` L341, `emitStaff` L355 |
| `apps/web/src/omr/slicer/rows.ts` | `rowMusicExtent` L400, `placeBand` L423, `normalizeRow` L446 |
| `apps/web/src/omr/slicer/barlines.ts` | `longestVerticalRun` L474, `isThinStroke` L485, `clusterCols` L521, `terminalOvershoot` L544, `detectBarlines` L592, `hasNotehead` L679 |
| `apps/web/src/omr/slicer/windows.ts` | `spanCap` L776, `splitWide` L786, `windowMeasures` L867 |
| `apps/web/src/omr/slicer/slicer.ts` | the driver (L961–1011, minus filesystem and debug) |

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

## Acceptance, per rung

The corpus: `data/real/strips_v2` — **1,781 page dirs**, each with a `_manifest.json` and a
`_debug.png`, and **1,704 with a `_decode.json`**. Accept a page only if its decode header matches
`checkpoint: round2-stage2-best`, `suffix: _int8`, `measures_per_strip: 3`, `window_mode: legacy`,
`edge_trim: true`, `vplace: true`. **Exclude `data/real/strips/` entirely** — exam-frozen, cut by
older code.

The `_debug.png` overlays are already on disk and colour-code rejected barline candidates by reason
(`gate2_fat` orange, `gate3_clef` purple, `gate3_blob` yellow, `xrange` grey). That is a free
debugger for W5 — use it before theorising.

**W4 — staves + row normalization**
- staff count == `max(system)+1` on **≥99.5%** of eligible pages
- the 67 zero-staff pages yield zero staves — **100%**
- per-system `scale` within **0.002** of the manifest on ≥99.5% of systems (the manifest rounds to
  3 dp, so anything larger is a bug, not noise)

**W5 — barlines**, against `row_bars` (present on every `w00` entry, for the whole row)
- bar **count** per row exactly equal on **≥99.0%** of rows — a count difference shifts every
  downstream window and measure index, so it gets no tolerance
- among count-matching rows, per-bar `|Δx| ≤ 1 px` on **≥99.9%** and `== 0` on **≥95%**
  (1 px = 1/30 of a line space and cannot move a crop past a symbol)
- hand-inspect the worst 10 mismatching pages against their `_debug.png`

**W6 — windowing, driver, and the parity verdict**
- strip count per page exact on **≥99.5%** of pages
- `system`, `window`, `is_row_start`, `split_wide` exact; `row_x0`/`row_x1` within **2 px** on ≥99.9%
- the width/measure invariants hold at the same **0** violations Python currently has
  (`MAX_STRIP_W`, `MIN_STRIP_W`, `MEASURES_PER_STRIP`)

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

## Commands

```bash
npm run probe:cv                      # opencv.js still matches OpenCV-Python
npm run parity:armb -- --pages 20     # the ceiling / (W6) arm comparison
npm run decode:pool -- --pool <dir> --out b.json   # browser decode of a strip pool
.venv-ml/bin/python scripts/score_browser_gold.py --browser b.json
npm run typecheck && npm test && npm run gate:browser
```
