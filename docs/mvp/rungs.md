# MVP rungs — what each one established

purpose: the finished write-up of the SLICER rungs (W4 onward) — what each measured, what passed, and what it disproved
audience: agents working the MVP ladder, and anyone quoting a rung result
updated: 2026-08-07

Split out of [README.md](README.md) on 2026-08-04 when that file crossed the 400-line cap. The split
is by genre: README keeps the **plan** (why the track exists, the ladder, the files, the gates),
this file keeps the **results**. Rung state lives in README's table and links here.

Numbers: [../METRICS.md](../METRICS.md), [../METRICS-SLICER.md](../METRICS-SLICER.md),
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md). Current state for the whole project is
NOT here: see [../STATUS.md](../STATUS.md).

⚠ **W0–W3 moved to [rungs-w0-w3.md](rungs-w0-w3.md)** on 2026-08-07, at the same 400-line cap:
opencv.js primitive parity, the extracted decode module, an image reaching the editor, the arm-B
ceiling and the browser-vs-Python verdict.

## W4 — staves + row normalization ✅ DONE (2026-08-04)

**The port reproduces Python's stage 1 exactly, over the whole corpus** — 1,781 pages / 12,123
systems, not a sample. Staff count **1,704/1,704**, manifest-zero pages **77/77**, `scale`
**12,122/12,122**; normalized row width and the outer-lines+spacing triple both **12,123/12,123**.
Numbers: [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

**Everything that differs anywhere is the ±1 grayscale residue, and none of it reaches a crop.**
Seven systems differ by 1 px — six an *interior* staff line's cluster centre, one an `x0` — and
`normalize_row` reads only the outer lines and the median spacing, which are identical on all
12,123. This is the first time the residue W0 predicted has been observed reaching any output.

⚠ **Two scope notes on the corpus run.** It used `--inject-skew`, so its deskew-angle column is
trivially true; the estimator's real number is **132/132** from the un-injected 132-page run. And
the "zero-staff pages yield zero staves" bar was **restated against the control**: those pages are
identified by an empty manifest, local Python now finds a staff on 1 of the 77, and the port finds
the same one — the original wording failed a port that agreed with Python exactly.

### Two things the plan had wrong, both found by measuring

**1. `prepPage` could not be the planned no-op.** [slicer-port.md](slicer-port.md) recorded that the
whole camera path is inert on clean input. True of the perspective crop (**0%** of pages take one),
false of the deskew: **15.3% (272/1,781) take a real rotation**. Skipping it took one page from 10
staves to **0**, and 22 of the 23 pages failing the first parity run were exactly the 23 deskewed
ones. `estimate_skew`/`deskew` are now ported in full, guards and all, so an axis-aligned
screenshot still passes through untouched. ⚠ **It costs ~35 s of the ~36 s a page takes in the
browser** (41 rotations, each with a page-wide `MORPH_OPEN`) against ~1.9 s for Python's whole stage
1 — a **W7** problem, since a screenshot pays the full sweep to learn it has no skew.

**2. The manifests on disk cannot be the acceptance bar.** Scored against them the port read
**86.7%**, and one page it failed matched local Python line for line (7 staves against the
manifest's 5). The current `page_to_strips.py` reproduces only **1,680/1,704 (98.59%)** of those manifests —
below W4's own bar — because 1,578 of the 1,781 page dirs were sliced on Colab. `scripts/slicer_ref.py`
now builds a local-Python reference that is both the control and the sample definition; the port
reaches the manifest ceiling exactly, 1,680/1,704 on the same pages as Python. **Same lesson W3 already
recorded about arm-B agreement: agreement with an artifact is not correctness.**

## W5 — barlines ✅ DONE (2026-08-04)

**The riskiest file in the slicer reproduces Python over the whole corpus** — 1,781 pages / 12,123
rows / 51,019 bars. Bar **count** exact on **12,121/12,123 rows (99.98%)**, positions within 1 px on
**51,018/51,019 (100.00%)** and exact on **51,013/51,019 (99.99%)**. Numbers:
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

**It passed on the first run, and the reason is the trap list.** The three hazards
[slicer-port.md](slicer-port.md) named the expensive way — `_is_thin_stroke`'s staff-row `continue`
that does *not* reset the run, `_terminal_overshoot`'s four-variable walk, and the per-ROW
`binarize_ink` calls that must not be hoisted — were transliterated as written rather than
rediscovered. **Trap 1 was confirmed empirically rather than trusted:** `30 * 0.35` and `30 * 0.75`
really are exactly 10.5 and 22.5 in IEEE doubles, so `Math.round` would have returned 11 and 22.5→23
where Python returns 10 and 22, silently retuning gates 1 and 2. `pyRound` returns Python's values.

**Every difference was diagnosed, not tolerated.** All 8 differing rows are the ±1 grayscale
residue: feeding Python its own *other* grayscale path makes Python emit the port's exact bar list
**and reject list**. The 2 rows whose bar count differs are `_terminal_overshoot` near-ties that
flip **one in each direction** — a genuine port bug in that walk would flip one way across many
rows. The single 2 px difference is W4's already-recorded `x0` residue multiplied through
`int(staff.x0 * scale)` at scale 2.0.

**A free extra check earned its keep.** Recording `detect_barlines`' *rejected* candidates costs
nothing (the gates run either way) and is stricter than the bar list: it found **9 further rows that
produce identical bars while disagreeing about what was thrown out**, including one column rejected
as `gate2_fat` by Python and `gate3_blob` by the port. Rejected either way, so the bar list can
never see it — but it means two independent gates sit near their thresholds on that column.

⚠ **Two non-claims.** The corpus run used `--inject-skew`, so it validates everything downstream of
the deskew estimator and not the estimator (unchanged from W4). And `hasNotehead` is ported but
**not exercised by anything W5 measures** — its only caller is `window_measures`, so W6 owns it.

## W6 — windowing, the driver, and the decode verdict ✅ DONE (2026-08-04)

**The slicer port is finished, and the browser cuts the same strips Python does.** Over the whole
corpus — 1,781 pages / 33,805 strips — the window fields are exact on **33,783/33,783** strips,
strip count per page on **1,697/1,697**, and `row_x0`/`row_x1` within 2 px on **99.99%**, with the
width and measure invariants at Python's own **0** violations. Numbers:
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

**The decode arm is the verdict that matters, and it is paired.** `npm run parity:arma` slices
20 pages with the port, decodes those crops, decodes Python's crops for the same pages, and compares
on the same (system, window):

| arm | agrees with Python |
|---|---|
| **A — the port's crops** | **395/450 (87.78%)** |
| B — Python's crops (the ceiling) | 387/450 (86.00%) |

**12 A-only against 4 B-only discordant pairs, McNemar exact p = 0.077 — no detectable difference**,
and **0 strips unmatched** in either direction. All 16 discordant strips have identical crop widths,
so the disagreement is the near-tie coin flip W3 characterised, not the cutting. ⚠ Read it as a
difference, not a level; agreement is not quality.

### Three things worth carrying forward

1. **The bar was restated, on purpose.** "Window fields exact" was written as 100% before the ±1
   grayscale residue was understood. Windows are computed *from* the bars, and the 2 rows where W5
   already records a bar-count difference account for **all 6** raw mismatches — so the gate now
   scores rows whose bars agree and prints the raw number beside it. Same shape as W4's restated
   zero-staff bar. Detail in [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).
2. **`hasNotehead` is exercised at last** — 861 clef-prefix trims, identical on both sides. That
   discharges W5's explicit non-claim.
3. **The Python control now runs the REAL driver.** `slicer_ref.py` calls `page_to_strips` into a
   temp dir instead of re-implementing its pad/trim block, because the port is transliterated from
   those same 40 lines and a second hand-written copy could encode one misreading twice and then
   agree with itself. It costs a second stage-1 pass (~4.2 s/page, ~2 h for the corpus).

⚠ **The W0 cv-probe was NOT deleted**, though this rung was where the plan retired it. It is the
only check that would catch an opencv.js version bump changing a primitive under the port, and it
costs one command.


## W7 — upload a page in the app ✅ DONE (2026-08-05)

**The app reads a page.** One image into the "Read page" input and a playable, editable score comes
out — slice, decode, stitch, render, play, save, all in the browser. That is the whole product path
with nothing stubbed, and it is the first rung a friend could be handed.

Acceptance is `npm run smoke:page`, which drives the real app with Playwright:

| check | result |
|---|---|
| page read end to end | 7 staves → **16 strips → 344 notes, 28 measures** |
| strip count matches local Python | **16 vs 16** |
| tab stayed responsive while slicing | slowest reply **2,353 ms** (bar: < 5,000) |
| progress actually moved | 57 distinct status lines |
| sheet renders / play enabled / playback started / no page errors | all ✓ |
| slice / decode | **36.4 s** + **19.1 s** (16 strips ≈ 1.2 s each) |

**A free confirmation nobody asked for:** W2's smoke reads *Python's* crops of this same page and
gets **344 notes / 28 measures** too. The ported slicer's crops produce the identical score here.
n=1 — the evidence that carries weight is still W6's paired McNemar — but it is the first time the
two cutters have been compared through the whole product path rather than at the token level.

### The 35-second freeze was the real work

The port cost ~36 s/page and **all of it ran as one synchronous block**. A tab that cannot answer
JavaScript for 35 s is not shippable: no progress paints, and the browser offers to kill the page.

The fix is not an optimisation and deliberately changes no arithmetic. `estimate_skew` is now a
**generator** that yields after each of its 41 rotations, with two drivers over it — `estimateSkew`
runs it to completion (what the parity harness measures), `estimateSkewAsync` steps it and hands
the event loop back between rotations. One search, two drivers. An async *copy* of that code was
the obvious alternative and is exactly the duplication CLAUDE.md warns about: the two would drift
the first time a gate is retuned.

`deskew`'s two guards were split into `guardedAngle` for the same reason, so the app — which
estimates first and slices second — reaches the same decision as the one-shot path rather than
re-deriving it.

**Verified, not assumed:** the parity harness re-run with the REAL estimator (no `--inject-skew`)
on 20 pages, 4 of which genuinely rotate — **deskew angle identical 20/20**, and W4/W5/W6 all still
PASS with bars, positions and strip spans exact. The refactor moves nothing.

What remains blocking is one **2.35 s** stretch: ink → connected components → staves → rows →
barlines → windows, which is a single synchronous call by design. It is under the bar and splitting
it would mean threading yields through the transliteration, which is not worth it.

### Two bugs the harness found, both in the harness or the wiring

1. **Vite's dep optimizer ate the first upload.** opencv.js reaches `App.tsx` only through the lazy
   `import("./omr/page")`, so Vite's static scan never sees it; it is discovered at the first upload
   instead, which triggers a re-optimize and a **full page reload mid-slice** — throwing the upload
   away and leaving the app waiting on a slice that no longer exists. It presents as a hang at 0%
   CPU, which is why it was not obviously a bug. `optimizeDeps.include: ["@techstark/opencv-js"]`
   makes it a startup cost. Dev-server only; a production build has no dep optimizer. The fix was
   re-verified against a **cold** `.vite` cache, not a warm one.
2. **The strip-count bar was pointed at the wrong reference.** It first scored against the page
   dir's `_manifest.json` and would have failed W7 for a W4 reason — local Python reproduces only
   ~98.6% of those manifests. It now scores against `scripts/slicer_ref.py`, with the manifest count
   printed beside it as context. Third time this project has had to relearn that agreement with an
   artifact is not correctness.

### Still owed at W7, and named

⚠ **The latency is not fixed, only made bearable.** A straight screenshot still pays all 41
rotations to learn it has no skew. Both candidate fixes — an early exit at 0°, or replacing the
estimator with a standard one (Hough / Radon / FFT of the row projection) — are behaviour changes
that need their own measurement against the 132-page estimator sample and the 15.3% of pages that
genuinely rotate. Not folded into this rung.
