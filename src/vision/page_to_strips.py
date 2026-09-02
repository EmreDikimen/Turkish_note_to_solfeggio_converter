"""Rung 4, stage 1 — slice a full notation PAGE into training-shaped STRIPS.

The model was fine-tuned on short strips engraved at ONE fixed scale: height 336 px, a 5-line
staff spanning 120 px (30 px line spacing), top line ~138 px down (see the measured gate strips).
Real uploads are whole pages at arbitrary DPI, so before decoding we must reproduce that exact
geometry. This is classical CV (staff + barline detection), NOT the model — per docs/PIPELINE.md
§1 and §0: staff lines give the rows, barlines give the measure boundaries, and grouping a few
measures per window reproduces the training strip.

Pipeline (this file):
  page -> [staff detection] rows -> [scale-normalize] each row to spacing=30
       -> [barline detection] measure boxes -> [windowing] 2-3 measures -> strip PNGs

Screenshot/clean-scan first (the easy, majority case). Deskew/perspective for phone photos is a
later stage; this module assumes roughly axis-aligned staves.

CLI:
    .venv-ml/bin/python src/vision/page_to_strips.py <page.png> --out <dir> [--debug]
"""
from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

# ---- target strip geometry the model was trained on (measured from gate strips) --------------
STRIP_H = 336          # output strip height (px)
TARGET_SPACING = 30.0  # staff line spacing after normalization (px)
STAFF_SPAN = 120       # top line -> bottom line (= 4 * spacing)
TOP_LINE_Y = 138       # y of the top staff line inside the 336-tall strip
HEADROOM_SP = TOP_LINE_Y / TARGET_SPACING          # line-spaces above the top line (~4.6)
BELOW_SP = (STRIP_H - TOP_LINE_Y - STAFF_SPAN) / TARGET_SPACING  # below bottom line (~2.6)
# The default split (4.6 sp above, 2.6 below) is generous above and too tight below for real
# engraving: measured 2026-07-29, this row's own music reaches 2.68 sp below at p90 and 3.01 at
# p95, so 11.6% of real staff rows had beams cut off, against 1.4% clipped at the top. The frame
# height and the 30 px spacing are fixed by training and are NOT touched — only where the staff
# sits inside the frame, which is the axis the model is insensitive to (a +1% vertical shift cost
# +0.4% edits, against 12-15% for scale). See place_band().
VPLACE_ADAPTIVE = os.environ.get("OMR_VPLACE", "1") not in ("0", "false", "False")
VPLACE_MARGIN_SP = 0.25    # breathing room past the measured ink extent
VPLACE_MIN_HEAD_SP = float(os.environ.get("OMR_VPLACE_MIN_HEAD", "3.30"))
                           # floor on headroom: how far the staff may be pushed up. The
                           # "vertical shift is free" evidence was measured at +-1% (~3 px);
                           # 3.30 sp is a 39 px shift, well outside it, so this is a dose.
# How far ABOVE the top staff line ink may claim room when the frame cannot hold both sides.
# A notehead three ledger lines up sits ~3.0 sp above, ~3.5 with its accidental; ink beyond that is
# a slur, phrase mark, segno or ornament, and our own renderer injects slurs as deliberately
# LABEL-FREE distractors. Uncapped, such decoration pushed the staff down and sheared the BEAMS,
# which carry the durations. Measured over 120 pages / 901 rows (2026-08-05), against uncapped:
#   ink lost within 3.5 sp above (real notes):  0  ->  0     (nothing that was kept is now lost)
#   ink lost below the staff (beams):      19,932 -> 17,231  (-13.6%)
# It only moves rows that are ALREADY in conflict, i.e. rows already losing something. Set it huge
# (OMR_VPLACE_TOP_CLAIM=99) to restore the old uncapped rule exactly.
VPLACE_TOP_CLAIM_SP = float(os.environ.get("OMR_VPLACE_TOP_CLAIM", "3.5"))

# ---- windowing --------------------------------------------------------------------------------
# OMR_MEASURES_PER_STRIP: tuplet-dense pieces blow the 59-id label budget even at 2 measures
# (measured 2026-07-17: 80% of tup3-bearing 2-measure windows, 39% of SINGLE measures) — the
# targeted tuplet emit slices at 1 measure/window so the fitting 61% survive the budget gate.
MEASURES_PER_STRIP = int(os.environ.get("OMR_MEASURES_PER_STRIP", "3"))
# target measures per window (2-4 is the training range)
#
# OMR_MAX_STRIP_W: the width rail, env-switchable since 2026-08-17 for Round-3 Lever 1's crop-geometry
# pilot (docs/rung3/levers.md). It had to be monkeypatched before that — width_split_probe.py still
# shows the pattern. ⚠ This is the SLICER's pair; the renderer packs training strips by measures and
# LABEL TOKENS (`STRIP_BUDGET` in tools/render/lilypond.ts) and has no width rail at all, so changing
# this alone moves the real crops and leaves the synthetic corpus where it was.
MAX_STRIP_W = int(os.environ.get("OMR_MAX_STRIP_W", "1450"))   # cap width (training strips ~1443 px)
MIN_STRIP_W = 200          # ignore degenerate slivers
# A TRAILING span narrower than this is the row's CLOSING BARLINE COUNTED TWICE, not a measure.
# A `:|` draws a thin stroke, a gap and a thick one; when the two land further apart than the
# candidate-merge gap (`_cluster_cols`, 0.6 sp) they survive as two barlines and manufacture a
# measure a few px wide. `MIN_STRIP_W` then cannot rescue it: the sliver merges into the previous
# window only while that window is under MEASURES_PER_STRIP, so a full one emits the sliver as its
# own strip (nihavendLongaDuzgun s09: bars ... 2629, 2664 -> a 35 px "measure", one junk crop).
# Fixed where the error is — it was never a measure — mirroring the `lead` prefix rule below: the
# span stops being counted and its ink stays inside the last window's crop, so the row still ends
# on its own closing barline. 1.5 sp is far under any real measure and over any double-bar gap.
TAIL_SPAN_MAX_SP = float(os.environ.get("OMR_TAIL_SPAN", "1.5"))

# ---- label-budget-aware packing ---------------------------------------------------------------
# What actually DROPS a strip is the 59-id label budget (audit_coverage.MAX_IDS), and neither
# constant above measures it. Measured over 31,968 decoded old-pool strips (2026-07-29):
#   * width alone explains R^2 = 0.54 of a strip's decoded token count; stem count + inked
#     columns explain 0.77 (residual sd 8.9 ids).
#   * 8.9% of SINGLE-measure windows blow the budget on their own — no MEASURES_PER_STRIP can
#     fix those, so lowering it is not the lever the sweep made it look like.
#   * simultaneously 28.6% of strips spend <= 25 of the 59 ids: the budget is over-run and
#     under-used at the same time, the signature of packing against the wrong quantity.
# So "budget" mode packs measures until the ESTIMATED token cost is spent, keeping the measure and
# width caps as safety rails rather than as the packing rule.
#
# ⚠ It ships OFF. Decoded head-to-head on 16 val-side pages with the shipped model (2026-07-29),
# budget packing is a WASH: healthy-band share 75.8% legacy vs 75.7% (b=55) / 76.2% (b=62), and the
# validated bad-crop proxy (min_logprob < -1.0) 14.4% vs 14.5% / 14.0%. Its one real effect is
# +16 usable strips (295 -> 311) at b=55, bought with +1.6pp more near-empty crops — a trade worth
# taking only if labelling volume is the binding constraint. Default stays legacy so existing
# decode caches remain valid and the change stays A/B-able, like `drawThinSharps`.
WINDOW_MODE = os.environ.get("OMR_WINDOW_MODE", "legacy")   # "legacy" | "budget"
TOKEN_BUDGET = float(os.environ.get("OMR_TOKEN_BUDGET", "50"))
COST_PER_STEM = 1.889      # a stemmed note costs ~2 ids (pitch + duration), shared beams less
COST_PER_INK_COL = 0.0288  # residual content: rests, dots, accidentals, ledgers
COST_ROW_START = -5.25     # a row-start crop carries the \sig block but less music

# ---- barline discrimination (line-space units; rows are geometry-normalized) ------------------
# A true barline terminates AT (or a few px past) the outer staff lines with nothing attached;
# a stem ends in a notehead/flag/beam, a G-clef extends far beyond BOTH lines.
EXT_SP = 2.5           # analysis band extends this far past the outer staff lines
                       # (2.5 sp keeps the band inside STRIP_H across the whole adaptive
                       # placement range: top line 99..138 -> 99-75=24 and 138+120+75=333)
OV_TOL_SP = 0.5        # a real barline may overshoot a staff line by up to this much
# How much of a barline may have FADED AWAY at its ends and still be recognised.
#
# ⚠ IT SHIPS OFF, and that is a measurement, not caution. Gate 1 asks for one UNBROKEN run covering
# 0.85 of the analysis band, and because the band is the staff plus 2x its own slack that works out
# at ~the full staff height — a barline whose bottom few px are lost to a photocopy fails by ONE
# pixel (measured on bozukNihavendLonga row 0: run 118 against 119, and `touches_bot` false because
# the run stops short of the bottom window). Rather than lower the fraction — which lets any long
# stem in anywhere in the band — this rule is POSITIONAL: the run must still START at the top staff
# line and END at the bottom one, each within this tolerance, and it is OR-ed with the original
# rule so nothing found today can be lost.
#
# ⚠ IT WAS TURNED ON AT 0.25 ON 2026-08-25 AND TURNED BACK OFF THE SAME DAY, MEASURED. Keeping the
# whole account because the ON case is now priced properly and should not be re-argued from the
# faded-page numbers alone — which is exactly the mistake that turned it on.
#
# Re-swept on the hand-marked truth AFTER that day's two gate fixes (the staff-line neutral blob
# walk and gate 2's position rule), which the paragraph above predates:
#
#   fade   recall          precision       false bars
#   0      47/93 (50.5%)   47/59 (79.7%)   12     <- ships
#   0.25   51/93 (54.8%)   51/64 (79.7%)   13
#   0.35   53/93 (57.0%)   53/68 (77.9%)   15
#   0.5    65/93 (69.9%)   65/90 (72.2%)   25
#
# At 0.25 precision does not move on that instrument — and that reading DID NOT GENERALISE. The
# hand truth is 93 marks on the 4 most faded pages we own; `score_slicer.py` run at FULL scale
# (6,440 truth-bearing rows, 1,159 pieces, not the 124-row sample every earlier note used) pairs the
# two settings row for row:
#
#   exact rows 3750 -> 3718 (-32);  paired BETTER 111, WORSE 187, net -76 rows
#   the dominant move is +0 -> +1 on 108 rows: a row whose measure count was RIGHT gains a
#   spurious barline. The intended win, -1 -> +0, is 72 rows. So 72 recovered against 108 broken.
#
# That is the original note's "the stems it admits are not caught by gates 2 and 3" — confirmed at
# 50x the scale it was first measured on. The owner had also rejected 0.35+ on the PIXELS: every
# false barline each further step adds is a NOTE STEM (three of three at 0.35, and the one 0.25 adds
# is a stem too). A stem cuts the crop through the music.
# ⚠ Mirrored in the browser slicer (`BAR_FADE_SP` in apps/web/src/omr/slicer/constants.ts) — the two
# must move together or `parity:slicer` breaks and the app cuts differently from the training data.
# The TS side of the rule IS ported and was verified at 0.25 (100% on all three rungs, rejected
# candidates identical 844/844), so re-enabling it is one constant on each side.
BAR_FADE_SP = float(os.environ.get("OMR_BAR_FADE", "0"))
WIDE_BEYOND_SP = 0.5   # connected ink this wide past a staff line = notehead/flag/beam ...
WIDE_RUN_SP = 0.2      # ... but only when wide for this many CONSECUTIVE rows (a notehead is
                       # ~0.8 sp tall; a 2-3 px slur/tie crossing the bar's tip is not a blob)
WIDE_NEAR_SP = 1.5     # ... and only within this distance of the staff line: a staff-spanning
                       # stem's head/beam attaches nearer (a longer stem couldn't also span the
                       # staff), while colliding TITLE/LYRIC text sits further out (old prints)
# ... and it is NOT a notehead if the ink is the STAFF LINE ITSELF.
#
# The 2026-08-24 "a notehead past a staff line means stem" rule fixed a real inversion on clean
# pages and was priced as costing "a real barline a notehead merely TOUCHES... rare". Hand-marked
# barline truth (2026-08-25) says it is not rare: `gate3_blob` rejected 29 of the 93 printed
# barlines on the four faded pages, 31% of every one of them.
#
# The cause is not the rule, it is what the walk counts as an attachment. It starts ON the outer
# staff line and steps outward, so the line's own thickness is the first thing it meets — and the
# row is upscaled to TARGET_SPACING, which multiplies that thickness (a 2 px line on a 10 px-spacing
# photocopy becomes 6 px). Those rows are very wide connected ink hanging off the stroke, so every
# barline on a coarse scan carried a "notehead". A faded line makes it worse rather than better: it
# breaks into long one-sided runs, which is why the effect is strongest on exactly the pages the
# report came from.
#
# So a row whose ink SPANS THE STAFF is neutral — it is not a wide attachment and it does not break
# the run, and the walk looks straight through it for a real notehead. The test is gate 2's own
# staff-row test, at the same 0.4 fill, so the file keeps ONE definition of "this row is a staff
# line". ⚠ Switchable, so it stays A/B-able against the rule it amends: `OMR_BLOB_LINE=0` restores
# 2026-08-24 behaviour exactly. Numbers, and the rejected shape-based alternative:
# docs/METRICS-SLICER-BARLINES.md.
BLOB_SKIP_LINE = os.environ.get("OMR_BLOB_LINE", "1") == "1"
BLOB_LINE_FILL = float(os.environ.get("OMR_BLOB_FILL", "0.4"))   # ... "spans the staff" = this full
# Gate 2 skips "staff rows" so the five lines cannot make every candidate look fat. It finds them by
# fill alone (>0.4 of the row width), and on a DENSE photocopy that claims rows the staff lines are
# nowhere near: 101 of 140 band rows on `bozukNihavendLonga` s03, 61 of them not within a line's
# thickness of any of the 5 line positions. Gate 2 then cannot collect `fat_run` CONSECUTIVE fat
# rows anywhere, so a notehead sitting inside the staff is invisible and its stem passes as a
# barline. A staff row must therefore also BE where a staff line is: within this many line-spaces of
# one of the five, whose positions the normalized row fixes exactly. `OMR_STAFF_ROW_POS=0` restores
# fill-only. Measured on hand-marked truth: precision 65.3% -> 79.7% with recall UNCHANGED at 50.5%
# (false barlines 25 -> 12), and `score_slicer` exactly neutral at 82/124 — it costs nothing on
# either instrument. Flat over 0.15-0.3; 0.5 is wide enough to re-admit the old behaviour.
STAFF_ROW_POS_SP = float(os.environ.get("OMR_STAFF_ROW_POS", "0.2"))
PAD_PX = 6             # crop padding past enclosing barlines (tight: never reaches a notehead)
# Give the left pad back off the PREVIOUS strip's right edge, so neighbouring crops never carry
# the same pixels and a strip stops ending on the barline its label does not mention. Measured
# 2026-07-29: real crops showed a closing barline 65% of the time against 5% for the synthetic
# training strips. Switchable (`OMR_EDGE_TRIM=0`) to keep the change A/B-able.
TRIM_SHARED_EDGE = os.environ.get("OMR_EDGE_TRIM", "1") not in ("0", "false", "False")


@dataclass
class Staff:
    lines: list[int]       # y of each of the ~5 staff lines (page coords)
    x0: int                # left extent of the staff (page coords)
    x1: int                # right extent

    @property
    def spacing(self) -> float:
        d = np.diff(self.lines)
        return float(np.median(d)) if len(d) else TARGET_SPACING

    @property
    def top(self) -> int:
        return self.lines[0]

    @property
    def bottom(self) -> int:
        return self.lines[-1]


# ------------------------------------------------------------------------------- preprocessing
def load_gray(path: str | Path) -> np.ndarray:
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise FileNotFoundError(path)
    return img


def binarize_ink(gray: np.ndarray) -> np.ndarray:
    """Return a uint8 mask where ink=255, background=0 (adaptive; robust to lighting)."""
    # Otsu on an inverted image; adaptive fallback handles gradients but Otsu is fine for scans.
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return th


# -------------------------------------------------------------------------- crop-to-page quad
# Deskew (a single rotation) straightens a flat page but CANNOT fix a page shot obliquely: keystone
# perspective makes the staff skew VARY down the page (measured on the photo exam: after deskew,
# pg17's middle 6 systems detect but the top-2/bottom-1 still miss, and 5 pages stay at 0 strips).
# Those are planar sheets photographed at an angle (no curl), so ONE homography rectifies every
# system at once. We find the bright page quad against a darker background and warp it flat. Guarded
# to a no-op when the page already fills the frame (clean scan / full-bleed screenshot): no quad
# meaningfully inset from the borders -> return the image untouched.
PAGE_MIN_AREA_FRAC = 0.25   # the page contour must cover >= this fraction of the frame
PAGE_FULLFRAME_FRAC = 0.92  # quad this close to the whole frame => nothing to crop (no-op)

def _order_quad(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as [top-left, top-right, bottom-right, bottom-left]."""
    pts = pts.reshape(4, 2).astype(np.float32)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)],
                     pts[np.argmax(s)], pts[np.argmax(d)]], dtype=np.float32)


def detect_page_quad(gray: np.ndarray) -> np.ndarray | None:
    """Return the page's 4 corners (full-res coords, tl/tr/br/bl) or None. Estimated on a downscaled
    mask of the bright page region against a darker background."""
    h, w = gray.shape
    scale = 800.0 / max(h, w)
    small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    blur = cv2.GaussianBlur(small, (5, 5), 0)
    # page = the bright region; Otsu splits it from a darker desk/background
    _, mask = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE,
                            cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < PAGE_MIN_AREA_FRAC * small.shape[0] * small.shape[1]:
        return None
    peri = cv2.arcLength(c, True)
    quad = None
    for eps in (0.02, 0.03, 0.05, 0.08):
        approx = cv2.approxPolyDP(c, eps * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            quad = approx.reshape(4, 2).astype(np.float32)
            break
    if quad is None:                       # no clean 4-gon: fall back to the min-area rectangle
        quad = cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float32)
    return _order_quad(quad / scale)


def crop_to_page(gray: np.ndarray) -> tuple[np.ndarray, bool]:
    """Perspective-rectify the page to a flat rectangle. No-op (returns applied=False) when no
    confident inset quad is found — clean scans and full-bleed screenshots pass through untouched."""
    quad = detect_page_quad(gray)
    if quad is None:
        return gray, False
    h, w = gray.shape
    if cv2.contourArea(quad) >= PAGE_FULLFRAME_FRAC * h * w:
        return gray, False                 # page already fills the frame: nothing to crop
    tl, tr, br, bl = quad
    out_w = int(round(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl))))
    out_h = int(round(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl))))
    if out_w < 200 or out_h < 200:
        return gray, False
    dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]],
                   dtype=np.float32)
    M = cv2.getPerspectiveTransform(quad, dst)
    warped = cv2.warpPerspective(gray, M, (out_w, out_h),
                                 flags=cv2.INTER_LINEAR, borderValue=255)
    return warped, True


# ------------------------------------------------------------------------------------ deskew
# The staff detector isolates lines with a ~w/4-wide horizontal opening, which needs that much
# CONTINUOUS horizontal ink on ONE pixel row. A handheld phone photo skewed by ~1.5deg drifts a
# staff line ~10px vertically across that span (> line thickness), so the opening slices through
# every line and detection collapses to 0 staves (measured on the photo exam: 72% of pages -> 0
# strips, recovered to 92% by deskew alone). A clean scan is already axis-aligned, so the deadband
# below makes this a no-op there. Estimation objective = the angle maximizing the count of
# qualifying staff-line rows: it's exactly the signal detect_staves() gates on, not a proxy.
SKEW_MAX_DEG = 7.0      # search range; beyond this it's perspective/curl (rotation can't fix it)
SKEW_DEADBAND_DEG = 0.3  # don't rotate an essentially-straight page (avoid interpolation blur)
SKEW_MIN_GAIN = 3        # ... and only rotate if it buys >= this many more staff-line rows

def _qualifying_line_rows(gray: np.ndarray, binarize=None) -> int:
    """#clustered staff-line rows detect_staves() would see — its len<2 gate is the 0-staff cliff.

    `binarize` lets estimate_skew() pass the page's chosen binarizer (page_binarizer). It matters:
    on a pale-line page Otsu leaves nothing to measure, so the sweep maximizes noise and returns an
    angle that ROTATES THE PAGE WRONG — measured at +7.5 deg where the truth was about -0.25.
    """
    ink = (binarize or binarize_ink)(gray)
    hor_len = max(20, gray.shape[1] // 4)
    horiz = cv2.morphologyEx(
        ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (hor_len, 1))
    )
    row_ink = horiz.sum(axis=1) / 255.0
    if row_ink.max() < 1:
        return 0
    thr = max(row_ink.max() * 0.3, gray.shape[1] * 0.2)
    return len(_cluster_rows(np.where(row_ink > thr)[0]))


def estimate_skew(gray: np.ndarray) -> tuple[float, int, int]:
    """Return (best_angle_deg, rows_at_best, rows_at_0). Estimated on a downscaled copy (angle is
    scale-invariant) to keep the ~50-rotation sweep cheap."""
    # Estimate near full-res: staff lines are ~1px thin, so aggressive downscaling blurs them below
    # the horizontal-opening threshold and the qualifying-row signal collapses (measured: a 1500->
    # 1000px shrink turned a clean +0.5deg/8-row estimate into a garbage +7.5deg/2-row one). Only
    # shrink genuinely large uploads, and keep lines >=~1px by capping at 1600px wide.
    small = gray
    if gray.shape[1] > 2400:
        s = 1600.0 / gray.shape[1]
        small = cv2.resize(gray, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    h, w = small.shape
    c = (w / 2, h / 2)
    binz = page_binarizer(small)   # decided once; a property of the page, not of the rotation

    def rows_at(a: float) -> int:
        if a == 0.0:
            return _qualifying_line_rows(small, binz)
        M = cv2.getRotationMatrix2D(c, a, 1.0)
        rot = cv2.warpAffine(small, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
        return _qualifying_line_rows(rot, binz)

    rows0 = rows_at(0.0)
    coarse = [(rows_at(a), a) for a in np.arange(-SKEW_MAX_DEG, SKEW_MAX_DEG + 0.01, 0.5)]
    best_n, best_a = max(coarse)
    fine = [(rows_at(a), a) for a in np.arange(best_a - 0.5, best_a + 0.501, 0.1)]
    best_n, best_a = max(fine + [(best_n, best_a)])
    return round(float(best_a), 2), best_n, rows0


def deskew(gray: np.ndarray, est: tuple[float, int, int] | None = None) -> tuple[np.ndarray, float]:
    """Auto-deskew a page so its staves are axis-aligned. No-op (returns angle 0.0) when the page
    is already near-straight or the best rotation doesn't materially help — clean scans pass through
    untouched. Rotates about the center with a white border (matches the paper, not ink). `est`
    lets a caller pass a precomputed estimate_skew() result to avoid recomputing the sweep."""
    ang, best_n, rows0 = est if est is not None else estimate_skew(gray)
    if abs(ang) < SKEW_DEADBAND_DEG or best_n < rows0 + SKEW_MIN_GAIN:
        return gray, 0.0
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), ang, 1.0)
    rot = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
    return rot, ang


def prep_page(gray: np.ndarray) -> tuple[np.ndarray, bool, float]:
    """Perspective-rectify then deskew a page for slicing. Returns (page, cropped, skew_angle).
    The crop is KEPT only if it improves staff-line detectability (qualifying-row count at the best
    rotation): a sheet shot on a contrasting desk rectifies cleanly, but a sheet on a white-paper
    stack has a low-contrast edge the quad detector can misread — there the crop is discarded so it
    never regresses a page deskew alone already handled."""
    cropped, did_crop = crop_to_page(gray)
    if did_crop:
        est_c, est_o = estimate_skew(cropped), estimate_skew(gray)
        if est_c[1] <= est_o[1]:            # crop didn't help -> fall back to the uncropped page
            cropped, did_crop, est = gray, False, est_o
        else:
            est = est_c
    else:
        est = estimate_skew(cropped)
    page, ang = deskew(cropped, est)
    return page, did_crop, ang


# ---------------------------------------------------------------------------- staff detection
# Opening kernel = fraction of page width a staff line must span as CONTINUOUS ink to survive. The
# old w/4 (0.25) was too long: a faint/broken photocopied line (or a page's short last system) has
# no 0.25*w unbroken run and gets erased entirely — measured as systematically dropping the bottom
# system of many pages on BOTH photos AND clean renders (clean pg01's true 9 systems detected as 8).
# 0.11 recovers those real systems with no false staves (validated on clean exam pages: counts only
# rise to the true value, never past; the _emit_staff 5-line-even-spacing gate rejects text/brackets).
# NB: the deskew estimator deliberately keeps the long w/4 kernel — there intolerance is a feature
# (it sharpens the angle peak), whereas here sensitivity is what we want.
STAFF_HOR_FRAC = 0.11
# ------------------------------------------- repairing a system the gap rule SPLIT (ships ON)
# Where one staff ENDS and the next begins — `OMR_STAFF_GROUP_SPAN`, on by default since 2026-08-26.
#
# The shipped rule splits when a gap exceeds `2.2 x sp`, where `sp` is the page's MEDIAN LINE GAP.
# That is a page-global number deciding a local question, and it sits close enough to the data to be
# flipped by rounding: on `bozukNihavendLonga2.png` the browser and Python found the SAME three staff
# lines on one row (y = 266, 285, 291) and disagreed on whether they were one staff. Python measured
# sp = 9.0 -> threshold 19.8 px; the browser measured sp = 8.0 -> threshold 17.6 px; the gap in
# question is 19 px. One grouped them and repaired the row to 5 lines; the other split them into a
# 1-line and a 2-line group, both under the 3-line floor, so `_repair_group` never ran and the staff
# was LOST. The browser reads 9 staves where Python reads 10.
#
# ⚠ It is not a browser bug and there is no code difference. `cv2.imread(IMREAD_GRAYSCALE)` converts
# inside the PNG decoder and a browser cannot, so the two greyscales differ by +-1 on ~16% of pixels
# by construction (see METRICS-SLICER.md). Python won this page by 0.8 px of luck.
#
# ⛔ THE FIX IS NOT "GROUP BY HEIGHT INSTEAD". That was built and measured: re-cutting every line
# row on the page's staff height read 3205 exact rows against the shipped rule's 3750 at full scale
# — **-545 rows**, regressions 694 -> 1351. The 2.2*sp rule earns its place. See `_regroup_by_span`.
# What ships is the NARROW repair: merge two adjacent UNDERSIZED groups (under the 3-line floor,
# so both are being discarded anyway) when together they fit inside one staff. A group with 3+
# lines is never touched, so a page whose grouping is healthy cannot move.
# Full scale, paired against the shipped rule: BETTER 29 / WORSE 31, **net -2 of 6,440 rows** — the
# moves are symmetric with no systematic direction, i.e. a wash, and it buys a real parity fix.
# ⚠ Falls back to the shipped rule when the page has too few confident staves to have a trustworthy
# span, so a 1-2 staff page behaves exactly as before.
STAFF_GROUP_BY_SPAN = os.environ.get("OMR_STAFF_GROUP_SPAN", "1") not in ("0", "false", "False")
STAFF_GROUP_SPAN_TOL = 0.15  # how far a MERGED pair may EXCEED the page's staff height
# ⛔ At 1.2 this constant meant something else — the broad regrouping that measured −545 exact
# rows and was thrown away. See `_regroup_by_span`; do not restore that reading.
# ------------------------------------------------------------------ the staff RESCUE second pass
# Re-detect a staff only in the bands where the page's own rhythm says a row is MISSING —
# `OMR_STAFF_RESCUE`. It exists because a whole row is currently lost on faint and hand-ruled
# pages: `vuslata_nail_de_etse_ger_felek_nota_p2` finds 4 of its 9 rows, `sevdim_yine_bir_afet_gibi_
# yar_nota_p1` 5 of 8. A lost row is not a bad crop, it is NO crop — that music never reaches the
# model at all.
#
# The mechanism is the (hor_len, 1) opening in `_staff_line_rows`: one pixel tall, so it demands the
# line stay inside a single row for 11% of the page width. A hand-ruled line wanders and is erased
# outright. `_emit_staff` already documents this exact failure for the x-extent and works around it
# by re-reading the RAW ink; detection never got the same treatment.
#
# ⚠ WHY THIS SHAPE AND NOT A KNOB. Loosening detection GLOBALLY was tried first and rejected on
# measurement: dilating the mask before the opening takes sevdim 5 -> 8, and the same change takes
# `bozukNihavendLonga` 10 -> 1, because on a page whose lines sit 9 px apart any useful dilation
# fuses them. Making the dilation a fraction of the measured line spacing does not escape it either
# (at the fraction that helps sevdim, bozukNihavend still reads 6). A dial that trades one page
# against another is the wrong shape. A second pass that only looks inside a band pass 1 left empty
# CANNOT move a page whose rows were all found — which is the property the dial could not have.
STAFF_RESCUE = os.environ.get("OMR_STAFF_RESCUE", "0") not in ("0", "false", "False")
# A rescued staff's HEIGHT must be within this of the page's median staff height.
RESCUE_SPAN_TOL = 0.18
# ...and it must be about as WIDE as the page's real staves. Not a tidy-up: without it the block of
# UNDERLINED LYRICS at the foot of a handwritten page is rescued as a staff (seen on sevdim), because
# lyric rules sit at staff-like spacing and so pass the height test. They span only the part of the
# page the text occupies. `_repair_group` documents the same false positive and refuses it on
# spacing; height alone cannot, since these two agree on height.
RESCUE_WIDTH_FRAC = 0.60
# Below this many staves a page has no trustworthy pitch to predict a missing row FROM, so the
# second pass does not run at all — the same argument as STAFF_SPAN_MIN_GROUPS.
RESCUE_MIN_STAVES = 3
# The readings tried inside a band, cheapest first, stopping at the first that is accepted:
# (dilate, threshold fraction). The first entry is pass 1's own rule minus the page-global parts,
# and it is the one that rescues most rows — the ink was there and readable, and it was the
# page-wide threshold and grouping that lost it, not absent ink.
RESCUE_READS = ((0, 0.30), (0, 0.20), (2, 0.25), (3, 0.25), (0, 0.12))
# How far apart two runs of qualifying staff-line columns may sit and still count as ONE staff
# (in line-spaces). A photocopy fades a staff line in patches; each fade splits the run, and
# `_emit_staff` keeps only the LONGEST piece, so the rest of the row is never cut into strips.
# It cannot simply be huge: a scan border or a stray blob far from the staff would then stretch
# the extent across the page. Measured over the corpus in docs/METRICS-SLICER.md.
STAFF_GAP_BRIDGE_SP = 6.0
# Rebuild a staff whose horizontal opening dropped lines, when 3 of the 5 survive (_repair_group).
# A switch, not a dial: the probe that measured it flips this to compare arms.
STAFF_REPAIR_3LINE = True
# ... and only when the rebuilt staff has the SAME line spacing as the rest of the page, as a
# ratio to the page's median line-row gap. Without it the repair invents a staff out of a block of
# UNDERLINED LYRICS — measured on huzzam/gonul_dustu_care_yoktur_nota_p1, where the lyric block
# repaired at 1.97x the page's spacing while every genuine repair on the 400-page sample sat at
# 0.94-1.32x. This is the same argument `page_binarizer`'s shape check makes, at row level.
STAFF_REPAIR_SP_BAND = (0.70, 1.40)

# ---- one page, one staff SIZE ------------------------------------------------------------------
# Every staff printed on a page is the same height, so the page's median first-line-to-last-line
# SPAN is a far more reliable measurement than any single group's individual line rows. On a
# faded photocopy the horizontal opening does not lose whole lines so much as CHOP them: the
# thresholded row profile dips below the threshold at random heights inside one staff and
# `_cluster_rows` reports 6 or 7 "lines" where 5 are printed. `_emit_staff`'s
# most-evenly-spaced-5-window rule then had to choose among windows that are ALL wrong, and it
# systematically took the tightest one -- measured on bozukNihavendLonga, every row's span is
# 43-49 px (true spacing ~11.75) while the chosen windows read 8-10 px. The consequence is not
# cosmetic: `normalize_row` scales by 30/spacing, so a 30% low spacing upscales the row 30% too
# much, the staff band the barline gates analyse no longer sits on the staff, and real barlines
# fail gate 1 while note stems pass. That is the "cut through the music, never at a bar" failure.
#
# So: when a group's own span already agrees with the page's, spread 5 evenly-spaced lines across
# it instead of choosing a window. Nothing is invented -- the outer two lines are observed rows,
# only the interior three are re-derived, and ink OUTSIDE a staff is not long-horizontal, so the
# first and last rows of a group are the outer staff lines far more reliably than the middle ones.
# A volta bracket or a lyric rule riding along makes the span too LARGE, which the tolerance
# refuses, leaving today's window rule in charge exactly where it was written for.
STAFF_SPAN_CONSENSUS = os.environ.get("OMR_STAFF_SPAN", "1") not in ("0", "false", "False")
STAFF_SPAN_MIN_GROUPS = 3   # a page needs this many 4+-line groups before its median means anything
# How far a group's span may sit from the page median and still be "one staff". Swept 0.08 - 0.20
# on 2026-08-25: BOTH instruments are flat across that range (SymbTr 86/124 with 11 regressed at
# every value; the 12 owner-flagged pages read 163 interior barlines at every value), so this is a
# guard rail, not a dial — do not tune it without an instrument that can see it move.
STAFF_SPAN_TOL = 0.15
# Smallest group the rebuild touches. 6 is the measurement, not a guess: a group of exactly 5 is
# usually a correctly detected staff, and re-spacing it moves each line by a px or two, which flips
# marginal barline decisions in BOTH directions — on `pek_revadir` it won 2 barlines on one row and
# lost 3 on two others. A group of 6 or 7 is the failure this rule was written for, since a staff
# only prints 5 lines. At 6, SymbTr exact rows are 86/124 with the regressed count back at the
# untouched baseline's 11 (against 12 at 5), and the 12 owner-flagged pages read 163 interior
# barlines against 162. Both instruments point the same way.
STAFF_SPAN_MIN_ROWS = int(os.environ.get("OMR_STAFF_SPAN_ROWS", "6"))
# ...and the same rebuild fires when the group's MEASURED spacing contradicts its own height —
# `OMR_STAFF_SPAN_FIX`. The line-count gate above only catches a staff chopped into MORE lines than
# it has; the identical defect with too FEW lines went straight through, and it is worse, because
# `normalize_row` scales by `30 / spacing` and a spacing read 54% high under-magnifies the row until
# its fixed-height frame reaches into the system above. See `_emit_staff`. Ships ON pending its
# full-scale read; the tolerance is deliberately loose so only a gross disagreement fires.
STAFF_SPAN_FIX_SPACING = os.environ.get("OMR_STAFF_SPAN_FIX", "1") not in ("0", "false", "False")
STAFF_SPAN_SPACING_TOL = 0.25

# ---- one page, one staff WIDTH -----------------------------------------------------------------
# `_emit_staff` keeps only the LONGEST run of qualifying columns, so a fade that opens a gap wider
# than STAFF_GAP_BRIDGE_SP throws away everything on the far side of it — whole measures at a row's
# left or right end, which then never become strips at all. Raising the bridge is not the answer:
# it is exactly what stops a scan border or a page number from stretching the extent across the
# paper, and the gaps that break real rows are MARGINAL (measured on bozukNihavendLonga: 69 px
# against a 60 px bridge, and 73 against 72), so any bridge wide enough to fix them is also wide
# enough to swallow the artifacts it was written for.
#
# The page itself settles it. A printed page uses ONE left and ONE right margin, so the median x0
# and x1 over its staves say where a row is allowed to reach. A discarded run that starts (or ends)
# at the page's own margin is the same staff; one out past the margin is the artifact. Only runs
# that already qualified as staff-line columns can be re-admitted, so a row that genuinely ends
# early — the last line of a piece — has nothing out there to re-admit and stays short.
STAFF_WIDTH_CONSENSUS = os.environ.get("OMR_STAFF_WIDTH", "1") not in ("0", "false", "False")
STAFF_WIDTH_MIN_STAVES = 3   # same argument as STAFF_SPAN_MIN_GROUPS: 1-2 staves is not a consensus
STAFF_WIDTH_SLACK_SP = 2.0   # how far past the page margin a re-admitted run may reach

# ---------------------------------------------------------------- pale-staff-line binarization
# binarize_ink() is global Otsu, which splits the page into TWO classes. A page with black
# noteheads and pale staff lines has THREE (paper / line / note), and Otsu puts the line on the
# paper side: measured on a 1056px re-scanned photocopy, paper=253, staff lines=219, noteheads=27,
# Otsu threshold=156 -> every staff line erased, 0 staves, 0 strips, while the notes survived
# intact. The damage compounds: estimate_skew() gates on the same staff-line rows, so with the
# lines gone it returns a garbage angle (+7.5 deg on that page) and the rotation destroys what was
# left.
#
# The fallback thresholds relative to the PAPER instead. It is gated hard, because a wider guard
# is actively harmful: an earlier version fired whenever no row spanned half the page width, which
# is true of many perfectly readable pages (detect_staves itself only needs 20%) -- measured over
# the 2,987-page real corpus it fired on 65 working pages and pushed 62 of them from 9-11 staves
# to ZERO. The guard below only fires where Otsu exposes almost no staff line at all, and only
# wins when what it finds is shaped like a staff. Over the same 2,987 pages, re-measured 2026-08-17
# by scripts/rung3/pale_line_probe.py: the fallback is TRIED on 93 and BELIEVED on 37 -- every one
# of the 37 already at 0 staves, so 37 recovered and 0 regressions, and 0 staves overall falls
# 144 -> 107. (Those two counts are different quantities; this comment used to give 93 as the
# number that fired.) Of the 56 tried but not believed, 51 find nothing either and 5 are refused
# by the shape check below.
PALE_LINE_MIN_ROWS = 4   # fewer clustered staff-line rows than this = Otsu found no staff at all
PALE_LINE_DELTA = 25     # ink is anything this much darker than the paper

# What the fallback's result must look like to be believed, as interline / page height. Many of the
# pages Otsu reports 0 staves on are LYRICS pages that genuinely have no staff, and on those a more
# sensitive binarization finds text baselines and groups them into "staves" with interlines of
# 90-471px. Measured over the 2,843 corpus pages that detect staves today, interline/height sits
# between 0.29% and 0.73% for 99 of every 100; this band is deliberately wider than that on both
# sides, so it rejects only the absurd. Re-measured 2026-08-17: it refuses 5 pages, all of them for
# being too COARSE (0.0387-0.2014), while the 37 it believes sit at 0.0035-0.0152.
PALE_LINE_MIN_REL = 0.0025
PALE_LINE_MAX_REL = 0.02


def _staff_line_rows(ink: np.ndarray, y0: int = 0, y1: int | None = None,
                     dilate: int = 0, thr_frac: float = 0.3,
                     width_floor: bool = True) -> list[int]:
    """detect_staves()' candidate staff-line rows — the opening + row projection, on its own.

    Shared with binarize_page_ink() so the fallback's guard is measured against the SAME signal
    detect_staves gates on, rather than a second rule that could drift away from it.

    ⚠ Called with no optional argument this is EXACTLY the page-wide rule it has always been; the
    parameters exist for `_rescue_missing_staves`, which re-asks the same question inside one band.
    Three of the defaults are page-GLOBAL decisions about a local question, and that is why a band
    needs to override them: `row_ink.max()` is the whole page's darkest row, so one heavy row lifts
    the bar for every faint one, and the `w * 0.2` floor asks a row to carry a fifth of the page
    width in surviving ink.
    """
    band = ink[y0:y1 if y1 is not None else ink.shape[0]]
    if band.size == 0:
        return []
    w = ink.shape[1]
    # a line that WANDERS vertically has no unbroken run in any single row, so the (hor_len, 1)
    # opening below erases it outright rather than weakening it
    src = (cv2.dilate(band, cv2.getStructuringElement(cv2.MORPH_RECT, (1, dilate)))
           if dilate > 1 else band)
    # keep only long horizontal structures (staff lines), drop noteheads/stems/text
    hor_len = max(20, int(w * STAFF_HOR_FRAC))
    horiz = cv2.morphologyEx(
        src, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (hor_len, 1))
    )
    row_ink = horiz.sum(axis=1) / 255.0
    if row_ink.max() < 1:
        return []
    # candidate staff-line rows: strong horizontal ink
    thr = row_ink.max() * thr_frac
    if width_floor:
        thr = max(thr, w * 0.2)
    return [y0 + r for r in _cluster_rows(np.where(row_ink > thr)[0])]


def _binarize_paper_relative(gray: np.ndarray) -> np.ndarray:
    """Ink = anything PALE_LINE_DELTA darker than the paper. The paper level is re-measured per
    call because deskew's rotation pads with white, which shifts the page's brightness histogram.

    ⚠ The comparison is `>=`, not `>`, and that is not a detail. A scan whose paper is one flat
    value (the page this was built for is 78% exactly 253) has NOTHING strictly above its own 60th
    percentile, so `>` takes the median of an EMPTY array -> nan -> `gray < nan` is all False ->
    an empty ink mask and 0 staves. It read as working only because deskew pads its rotation with
    white and cubic upscaling overshoots, both of which happen to introduce a few brighter pixels;
    an unrotated page at native scale got an empty mask.
    """
    paper = float(np.median(gray[gray >= np.percentile(gray, 60)]))
    return ((gray < paper - PALE_LINE_DELTA).astype(np.uint8) * 255)


def page_binarizer(gray: np.ndarray) -> Callable[[np.ndarray], np.ndarray]:
    """Choose ONCE which binarizer this page needs — see the note above.

    Returned rather than applied because estimate_skew() binarizes 41 times (one per rotation) and
    the choice is a property of the page, not of the rotation; deciding per call would triple the
    cost of the sweep, which is already the slowest thing the slicer does.

    PAGE level only. binarize_ink() is also called per-row by the barline gates, where this guard
    is meaningless (one row holds exactly one staff) and the extra opening is pure cost.
    """
    otsu = binarize_ink(gray)
    if len(_staff_line_rows(otsu)) >= PALE_LINE_MIN_ROWS:
        return binarize_ink
    # Otsu exposes no staff here, so the fallback has nothing to lose -- but it does have something
    # to INVENT, which is what the shape check is for: most pages that reach this point are lyrics
    # pages with no staff at all, and a more sensitive threshold happily groups their text baselines
    # into "staves". Believe the fallback only when what it finds is shaped like a staff.
    staves = detect_staves(_binarize_paper_relative(gray))
    if not staves:
        return binarize_ink
    interline = float(np.median([np.median(np.diff(s.lines)) for s in staves]))
    rel = interline / gray.shape[0]
    if not (PALE_LINE_MIN_REL <= rel <= PALE_LINE_MAX_REL):
        return binarize_ink
    return _binarize_paper_relative


def binarize_page_ink(gray: np.ndarray) -> np.ndarray:
    """binarize_ink() for a whole PAGE, with the pale-staff-line fallback."""
    return page_binarizer(gray)(gray)


def detect_staves(ink: np.ndarray, rescue: bool | None = None) -> list[Staff]:
    """Find 5-line staff systems via a horizontal-opening + row projection, then group lines.

    `rescue` overrides STAFF_RESCUE for one call. It exists so a SCORER can ask for both readings
    of the same page: the row-level instruments pair rows by system INDEX against a cached truth,
    so a pass that inserts a staff shifts every later index and would report a false regression.
    With both lists in hand a caller can pair on position instead.
    """
    h, w = ink.shape
    line_rows = _staff_line_rows(ink)
    if len(line_rows) < 2:
        return []
    # group consecutive lines into systems: a gap >> median spacing starts a new system
    gaps = np.diff(line_rows)
    sp = float(np.median(gaps))
    groups: list[list[int]] = []
    group = [line_rows[0]]
    for prev, cur in zip(line_rows[:-1], line_rows[1:]):
        if cur - prev <= sp * 2.2:          # same staff
            group.append(cur)
        else:                                # new system
            groups.append(group)
            group = [cur]
    groups.append(group)
    if STAFF_GROUP_BY_SPAN:
        groups = _regroup_by_span(line_rows, groups)
    page_span = _page_staff_span(groups)
    staves: list[Staff] = []
    runs_per_staff: list = []
    for g in groups:
        _emit_staff(g, ink, staves, sp, page_span, runs_per_staff)
    if STAFF_RESCUE if rescue is None else rescue:
        # before _widen_to_page_margins, so a rescued staff gets the same x-extent treatment as
        # any other. It appends to BOTH lists in step, because _widen zips them.
        # ⚠ This can also move an EXISTING row: _widen_to_page_margins takes the median x-extent
        # over all staves, so a rescued row is a vote in it. That is the coupling the position-
        # pairing scorer exists to measure, not a reason to reorder the two.
        _rescue_missing_staves(ink, staves, runs_per_staff)
    _widen_to_page_margins(staves, runs_per_staff)
    staves.sort(key=lambda s: s.lines[0])
    return staves


def _missing_bands(staves: list[Staff], h: int) -> list[tuple[int, int]]:
    """Vertical bands where the page's OWN rhythm says a staff should be and none was found.

    A page's rows sit at a near-constant pitch, so a gap of ~k x that pitch is k-1 missing rows.
    This reads the SURVIVING rows, so it cannot be fooled by whatever hid the missing one.
    """
    tops = [s.lines[0] for s in staves]
    pitch = float(np.median(np.diff(tops)))
    span = float(np.median([s.lines[-1] - s.lines[0] for s in staves]))
    if pitch <= 0:
        return []
    bands: list[tuple[int, int]] = []
    for a, b in zip(tops[:-1], tops[1:]):
        k = int(round((b - a) / pitch))
        for j in range(1, k):
            y = a + (b - a) * j / k
            bands.append((int(y - span * 0.4), int(y + span * 1.4)))
    # above the first row and below the last: no interior gap can reveal these, and a row lost at
    # the foot of a page is the single most common one (the old w/4 kernel dropped it systematically)
    if tops[0] - pitch > 0:
        bands.append((int(tops[0] - pitch - span * 0.4), int(tops[0] - pitch + span * 1.4)))
    if staves[-1].lines[-1] + pitch < h:
        bands.append((int(tops[-1] + pitch - span * 0.4), int(tops[-1] + pitch + span * 1.4)))
    return [(max(0, y0), min(h, y1)) for y0, y1 in bands if y1 > y0]


def _rescue_missing_staves(ink: np.ndarray, staves: list[Staff], runs_out: list) -> None:
    """Second pass: re-detect ONLY inside the bands pass 1 left empty — see STAFF_RESCUE.

    Acceptance is deliberately strict and is the same argument `_repair_group` uses: a rescued
    group must survive `_emit_staff` (5 evenly-spaced lines) AND match the page's other staves in
    both HEIGHT and WIDTH. Rejecting restores today's behaviour — the row is simply dropped — so
    the safe direction is the default.
    """
    if len(staves) < RESCUE_MIN_STAVES:
        return
    span = float(np.median([s.lines[-1] - s.lines[0] for s in staves]))
    page_w = float(np.median([s.x1 - s.x0 for s in staves]))
    for y0, y1 in _missing_bands(staves, ink.shape[0]):
        for dilate, thr in RESCUE_READS:
            # no width floor: inside a band we already believe holds a staff, the question is
            # which rows are lines, not whether the band is music at all
            rows = _staff_line_rows(ink, y0, y1, dilate, thr, width_floor=False)
            if len(rows) < 3:
                continue
            cand: list[Staff] = []
            cand_runs: list = []
            _emit_staff(rows, ink, cand, float(np.median(np.diff(rows))), span, cand_runs)
            if not cand:
                continue
            st = cand[0]
            if abs((st.lines[-1] - st.lines[0]) - span) > RESCUE_SPAN_TOL * span:
                continue
            if (st.x1 - st.x0) < RESCUE_WIDTH_FRAC * page_w:
                continue                     # underlined lyrics, a title rule, a volta bracket
            staves.append(st)
            runs_out.append(cand_runs[0])
            break


def _widen_to_page_margins(staves: list[Staff], runs_per_staff: list) -> None:
    """Re-admit runs of staff-line columns that reach the PAGE's own margins — STAFF_WIDTH_CONSENSUS."""
    if not STAFF_WIDTH_CONSENSUS or len(staves) < STAFF_WIDTH_MIN_STAVES:
        return
    page_x0 = float(np.median([s.x0 for s in staves]))
    page_x1 = float(np.median([s.x1 for s in staves]))
    for st, (runs, sp) in zip(staves, runs_per_staff):
        slack = STAFF_WIDTH_SLACK_SP * sp
        left = [r for r in runs if r[0] < st.x0 and r[0] >= page_x0 - slack]
        right = [r for r in runs if r[1] > st.x1 and r[1] <= page_x1 + slack]
        if left:
            st.x0 = min(r[0] for r in left)
        if right:
            st.x1 = max(r[1] for r in right)


def _regroup_by_span(line_rows: list[int], groups: list[list[int]]) -> list[list[int]]:
    """Merge ADJACENT UNDERSIZED groups whose combined height is one staff — STAFF_GROUP_BY_SPAN.

    ⛔ AN EARLIER, BROADER VERSION OF THIS WAS MEASURED AND THROWN AWAY. It re-cut *every* line row
    on the page's staff height instead of only repairing undersized groups, and at full scale
    (`score_slicer.py`, 6,440 rows) that read **3205 exact against the shipped rule's 3750 — −545
    rows**, with regressions nearly doubled (694 -> 1351). The `2.2 * sp` rule does real work: a
    staff spans ~4*sp, so "the group may be one staff tall" permits ~4.8*sp between the first and
    last line, and on a page whose systems sit close together that merges rows which should be
    separate. **Do not re-open the global form.** docs/METRICS-SLICER.md.

    What is left is the narrow repair, the same shape as `_rescue_missing_staves`: a group of 1-2
    lines is BELOW the 4-line floor and below `_repair_group`'s 3-line floor, so it is discarded and
    its music is lost. Where two such neighbours together are the height of one staff, they are one
    staff that the gap rule split. A group that already has 3+ lines is never touched, so a page
    whose grouping is healthy cannot move.

    This is the `bozukNihavendLonga2` case: the browser and Python found the SAME three lines
    (y = 266, 285, 291) and the 19 px gap fell either side of `2.2 * sp` depending on whether the
    page's median line gap rounded to 9.0 or 8.0 — one grouped them, the other split them into a
    1-line and a 2-line group and lost the staff.
    """
    span = _page_staff_span(groups)
    if not span or span <= 0:
        return groups                       # too few confident staves to know a staff's height
    out: list[list[int]] = []
    i = 0
    while i < len(groups):
        g = groups[i]
        nxt = groups[i + 1] if i + 1 < len(groups) else None
        # The test bounds the merged height from ABOVE only. An undersized group is undersized
        # BECAUSE lines are missing, so its raw height is naturally SHORT of a full staff — an
        # equality test rejects exactly the cases this exists for (bozukNihavendLonga2's pair spans
        # 25 px against a 38 px staff). What must not happen is a merge TALLER than a staff, which
        # would be two different rows. `_emit_staff` then still has to accept the result: repair to
        # 5 evenly spaced lines whose spacing matches the rest of the page.
        if (len(g) < 3 and nxt is not None and len(nxt) < 3
                and (nxt[-1] - g[0]) <= span * (1 + STAFF_GROUP_SPAN_TOL)):
            out.append(g + nxt)
            i += 2                          # both consumed; never merge three
            continue
        out.append(g)
        i += 1
    return out


def _page_staff_span(groups: list[list[int]]) -> float | None:
    """The page's median staff height (first line -> last line), or None if it cannot be trusted.

    Only groups that already look like a staff (4+ detected line rows) vote, and a page needs
    STAFF_SPAN_MIN_GROUPS of them: on a one- or two-staff page the median is just that staff's own
    span, so it carries no independent information and must not be used to rewrite it.
    """
    if not STAFF_SPAN_CONSENSUS:
        return None
    spans = [g[-1] - g[0] for g in groups if len(g) >= 4]
    if len(spans) < STAFF_SPAN_MIN_GROUPS:
        return None
    return float(np.median(spans))


def _cluster_rows(rows: np.ndarray, gap: int = 3) -> list[int]:
    """Collapse runs of adjacent row indices to their centers (a staff line is a few px thick)."""
    if len(rows) == 0:
        return []
    out, start, prev = [], rows[0], rows[0]
    for r in rows[1:]:
        if r - prev > gap:
            out.append(int((start + prev) // 2))
            start = r
        prev = r
    out.append(int((start + prev) // 2))
    return out


def _repair_group(group: list[int], page_sp: float | None = None) -> list[int] | None:
    """A 3-line group with the other two lines missing -> the repaired 5, or None.

    On a faded photocopy the horizontal opening can lose individual staff lines while keeping the
    rest, and a group of 3 is thrown away by the 4-line floor below — the whole row then produces
    no strips at all. The lost lines are recoverable because a staff is EVENLY spaced: a gap of
    ~2x its neighbours has one line missing inside it, and a staff short of 5 continues at the
    same pitch. Nothing is invented that the surviving lines do not already imply.

    Deliberately narrow. Only a group of exactly 3 is repaired (4 is already accepted), every gap
    must be a small integer multiple of the group's own smallest gap, the result must be evenly
    spaced, and — the test that does the real work — its spacing must match the REST OF THE PAGE
    (`page_sp`, the median line-row gap). The first three tests alone still admitted a block of
    underlined lyrics as a staff; STAFF_REPAIR_SP_BAND is what refuses it. Rejecting is the safe
    direction: it restores today's behaviour of dropping the row.
    """
    if len(group) != 3:
        return None
    # The unit to rebuild in is the PAGE's line spacing, not the group's own smallest gap. A
    # detected "line" can be one real line split into two clusters, which puts a 6 px gap next to
    # a 19 px one on a page whose true spacing is 9; `min` then takes the artifact as the unit and
    # rebuilds a 6 px staff, which the spacing band below rightly refuses — and the row is lost.
    # Measured on a 876x1118 screenshot of bozukNihavendLonga (owner, 2026-08-24).
    base = float(page_sp) if page_sp else float(np.min(np.diff(group)))
    if base < 4:                                   # too fine to be a staff at any real resolution
        return None
    filled = [group[0]]
    for prev, cur in zip(group[:-1], group[1:]):
        k = int(round((cur - prev) / base))
        if not (1 <= k <= 3):                      # not an integer multiple: not a dropped line
            return None
        for j in range(1, k):
            filled.append(int(round(prev + j * (cur - prev) / k)))
        filled.append(cur)
    if len(filled) > 5:
        return None
    sp = float(np.median(np.diff(filled)))
    while len(filled) < 5:                         # a staff short of 5 continues at its own pitch
        filled.append(int(round(filled[-1] + sp)))
    d = np.diff(filled)
    if float(d.max() - d.min()) > 0.5 * sp:        # must end up evenly spaced
        return None
    if page_sp:                                    # ... and be the same staff as the page's others
        lo, hi = STAFF_REPAIR_SP_BAND
        if not (lo * page_sp <= sp <= hi * page_sp):
            return None
    return filled


def _emit_staff(group: list[int], ink: np.ndarray, out: list[Staff],
                page_sp: float | None = None, page_span: float | None = None,
                runs_out: list | None = None) -> None:
    """Accept a group as a staff if it has ~5 evenly-spaced lines; record its x-extent."""
    if STAFF_REPAIR_3LINE and len(group) == 3:
        repaired = _repair_group(group, page_sp)
        if repaired is not None:
            group = repaired
    if not (4 <= len(group) <= 7):
        return
    span = group[-1] - group[0]
    if page_span and abs(span - page_span) <= STAFF_SPAN_TOL * page_span:
        # this group is exactly as tall as the page's other staves, so it IS one staff whose
        # interior lines the opening chopped up -- see STAFF_SPAN_CONSENSUS
        step = span / 4.0
        # ⚠ The gate used to be `len(group) >= STAFF_SPAN_MIN_ROWS` (6), written for the symptom
        # that produced it: a staff CHOPPED into 6-7 fragments. It is blind to the same defect
        # arriving with too FEW lines. `bozukNihavendLonga2` s03 is detected as 4 lines at
        # y = 440, 455, 471, 479 -- gaps 15/16/8, median **15**, against the page's 9.75 -- while
        # its HEIGHT (39 px) matches the page exactly. `normalize_row` scales by `30 / spacing`, so
        # the row upscaled 2.0x where every healthy row on that page gets 3.0-3.5x; under-magnified
        # in a fixed 336 px frame, the crop then reached 4.60 sp above the staff and swallowed the
        # bottom of the previous system (owner, 2026-08-26).
        # So gate on the DEFECT rather than on the line count: the height already says the spacing
        # must be `span / 4`, and if the measured median gap disagrees materially the measurement is
        # what is wrong. On a healthy staff the two agree and this is a no-op.
        gaps = np.diff(group)
        measured = float(np.median(gaps)) if len(gaps) else step
        chopped = len(group) >= STAFF_SPAN_MIN_ROWS
        misread = (STAFF_SPAN_FIX_SPACING
                   and abs(measured - step) > STAFF_SPAN_SPACING_TOL * step)
        if chopped or misread:
            group = [int(round(group[0] + i * step)) for i in range(5)]
    if len(group) > 5:
        # extra long horizontals (a VOLTA bracket above, an ottava/lyric rule below) can ride
        # along in the cluster — keep the most evenly-spaced consecutive 5-line window
        best, best_spread = None, None
        for k in range(len(group) - 4):
            win = group[k:k + 5]
            gaps = np.diff(win)
            spread = float(gaps.max() - gaps.min())
            if best_spread is None or spread < best_spread:
                best, best_spread = win, spread
        group = list(best)
    # x-extent from the RAW ink at the detected line rows — NOT the opened image: on a
    # slightly skewed scan a staff line drifts across pixel rows, splitting each row into
    # runs shorter than the opening kernel, so the opened image loses the line's left/right
    # portions (measured: x0 pushed 70..490 px right, cutting the clef or whole measures).
    # A column counts when a MAJORITY of the group's lines carry ink within ±tol rows.
    sp = float(np.median(np.diff(group)))
    tol = max(2, int(round(sp * 0.2)))
    count = np.zeros(ink.shape[1], dtype=np.int16)
    for y in group:
        y0, y1 = max(0, y - tol), min(ink.shape[0], y + tol + 1)
        count += ink[y0:y1].max(axis=0) > 0
    xs = np.where(count >= max(3, (len(group) + 1) // 2))[0]
    if len(xs) == 0:
        return
    # keep the longest gap-tolerant run of qualifying columns: stray blobs and scan-border
    # artifacts far from the staff must not stretch the extent. The tolerance is what separates a
    # FADE inside one staff line from a genuinely separate piece of ink, so it is a constant with
    # a measurement behind it, not an inline number — see STAFF_GAP_BRIDGE_SP.
    gap_tol = int(STAFF_GAP_BRIDGE_SP * sp)
    runs: list[tuple[int, int]] = []
    start, prev = int(xs[0]), int(xs[0])
    for x in xs[1:]:
        if x - prev > gap_tol:
            runs.append((start, prev))
            start = int(x)
        prev = int(x)
    runs.append((start, prev))
    x0, x1 = max(runs, key=lambda r: r[1] - r[0])
    out.append(Staff(lines=group, x0=x0, x1=x1))
    if runs_out is not None:
        runs_out.append((runs, sp))


# -------------------------------------------------------------------- normalize + barlines
def row_music_extent(lab: np.ndarray, staff: Staff) -> tuple[float, float]:
    """(above, below) in line-spaces: how far THIS row's music reaches past its outer staff
    lines, counting only ink CONNECTED to the staff band so a neighbouring system or a page
    header cannot masquerade as this row's content.

    `lab` is a whole-page connected-component labelling (cv2.connectedComponents on the ink).
    """
    sp = staff.spacing
    reach = int(6 * sp)
    x0, x1 = staff.x0, staff.x1
    mine = set(np.unique(lab[staff.top:staff.bottom + 1, x0:x1])) - {0}
    if not mine:
        return 0.0, 0.0
    mine_arr = np.fromiter(mine, dtype=lab.dtype, count=len(mine))
    below_band = lab[staff.bottom + 1:min(lab.shape[0], staff.bottom + reach), x0:x1]
    ys = np.where(np.isin(below_band, mine_arr).any(axis=1))[0]
    below = (ys.max() + 1) / sp if len(ys) else 0.0
    top_band = lab[max(0, staff.top - reach):staff.top, x0:x1]
    ys2 = np.where(np.isin(top_band, mine_arr).any(axis=1))[0]
    above = (top_band.shape[0] - ys2.min()) / sp if len(ys2) else 0.0
    return float(above), float(below)


def place_band(above: float, below: float) -> tuple[float, float]:
    """Split the frame's non-staff height between headroom and underroom, in line-spaces.

    The frame is fixed by training — 336 px tall, 30 px spacing — so the TOTAL is not ours to
    change and neither is the scale, the axis the model is genuinely sensitive to. What is free
    is where the staff sits inside that total: a +1% vertical shift moved the exam by +0.4%
    edits, against 12–15% for scale (docs/METRICS-DIAGNOSTICS.md). So keep the height, and give
    the bottom the room it actually needs.

    The default 4.60 above / 2.60 below is generous above and too tight below for real
    engraving: music reaches 2.68 sp below at p90 and 3.01 at p95, so 11.6% of real staff rows
    had beams cut off. Measured 2026-07-29.
    """
    total = HEADROOM_SP + BELOW_SP                      # 7.2 sp of non-staff height
    want_b = min(below + VPLACE_MARGIN_SP, total - VPLACE_MIN_HEAD_SP)
    want_b = max(want_b, BELOW_SP)                      # never tighter than the trained default
    head = total - want_b
    claim = min(above, VPLACE_TOP_CLAIM_SP) + VPLACE_MARGIN_SP   # decoration may not claim room
    if head < claim:                                   # cannot fit both: keep the staff nearer
        head = min(HEADROOM_SP, max(VPLACE_MIN_HEAD_SP, claim))
    head = min(HEADROOM_SP, max(VPLACE_MIN_HEAD_SP, head))
    return head, total - head


def normalize_row(gray: np.ndarray, staff: Staff,
                  lab: np.ndarray | None = None) -> tuple[np.ndarray, float, int]:
    """Crop the band around a staff and rescale so line spacing == TARGET_SPACING.

    Returns (row_img HxW at STRIP_H tall, scale, top_line_y_in_row). With `lab` (a page-level
    connected-component labelling) the staff is placed adaptively inside the fixed frame so low
    beams are not cut off; without it the fixed training placement is used.
    """
    sp = staff.spacing
    scale = TARGET_SPACING / sp
    head_sp, below_sp = HEADROOM_SP, BELOW_SP
    if lab is not None and VPLACE_ADAPTIVE:
        head_sp, below_sp = place_band(*row_music_extent(lab, staff))
    # band in page coords that maps to the 336-tall strip with the staff placed like training
    band_top = int(round(staff.top - head_sp * sp))
    band_bot = int(round(staff.bottom + below_sp * sp))
    band_top_c, band_bot_c = max(0, band_top), min(gray.shape[0], band_bot)
    crop = gray[band_top_c:band_bot_c, :]
    # pad if the band ran off the page edge (keep the staff at the right vertical offset)
    pad_t, pad_b = band_top_c - band_top, band_bot - band_bot_c
    if pad_t or pad_b:
        crop = cv2.copyMakeBorder(crop, pad_t, pad_b, 0, 0, cv2.BORDER_CONSTANT, value=255)
    new_w = max(1, int(round(crop.shape[1] * scale)))
    row = cv2.resize(crop, (new_w, STRIP_H), interpolation=cv2.INTER_AREA)
    top_line_y = int(round(head_sp * TARGET_SPACING))
    return row, scale, top_line_y


def _longest_vertical_run(band_bool: np.ndarray,
                          with_ends: bool = False) -> np.ndarray | tuple[np.ndarray, ...]:
    """Per column, the length of the longest UNBROKEN run of ink (vectorized over rows).

    With `with_ends`, also the first and last row of that run — what BAR_FADE_SP needs to ask
    WHERE a stroke sits rather than only how long it is.
    """
    n = band_bool.shape[1]
    run = np.zeros(n, dtype=np.int32)
    best = np.zeros(n, dtype=np.int32)
    if not with_ends:
        for y in range(band_bool.shape[0]):
            run = (run + 1) * band_bool[y]
            best = np.maximum(best, run)
        return best
    start = np.zeros(n, dtype=np.int32)
    end = np.zeros(n, dtype=np.int32)
    for y in range(band_bool.shape[0]):
        run = (run + 1) * band_bool[y]
        upd = run > best
        best = np.where(upd, run, best)
        end = np.where(upd, y, end)
        start = np.where(upd, y - run + 1, start)
    return best, start, end


def _is_thin_stroke(band: np.ndarray, x: int, fat_w: int, fat_run: int,
                    skip_rows: np.ndarray) -> bool:
    """True if the vertical stroke at column x is a BARLINE, not a note.

    At each (non-staff-line) row, measure the connected horizontal ink width through the column.
    A note is rejected because its NOTEHEAD is a fat ellipse spanning many consecutive rows.
    Repeat dots, a thick/double barline core, or a note merely touching the line are NOT rejected
    because they are either narrow or only a few rows tall. So: reject only when `fat_w`-or-wider
    rows form a CONTIGUOUS run of at least `fat_run` rows (a notehead's height).

    `skip_rows` marks the horizontal STAFF-LINE rows (every column is inked there); they neither
    count as fat nor break a run.
    """
    r = int(TARGET_SPACING)                       # search ±1 line-space horizontally
    lo = max(0, x - r)
    sub = band[:, lo:x + r + 1]
    c = x - lo                                    # center column within the window
    run = 0
    for y in range(sub.shape[0]):
        if skip_rows[y]:
            continue                              # staff line: ignore, don't reset the run
        if not sub[y, c]:
            run = 0
            continue
        l = c
        while l > 0 and sub[y, l - 1]:
            l -= 1
        rt = c
        while rt < sub.shape[1] - 1 and sub[y, rt + 1]:
            rt += 1
        run = run + 1 if (rt - l + 1) >= fat_w else 0
        if run >= fat_run:
            return False                          # a notehead-tall fat blob is attached
    return True


def _cluster_cols(xs: np.ndarray, longest: np.ndarray, gap: int) -> list[tuple[int, int]]:
    """Cluster nearby candidate columns; return (center, test_col) per cluster.

    A double/thick barline's cluster CENTER can land in the blank gap between its strokes,
    where every gate would trivially pass (or fail) on empty ink — so the discrimination
    gates run on `test_col`, the member column with the longest vertical run.
    """
    out: list[tuple[int, int]] = []
    if len(xs) == 0:
        return out
    start, prev = int(xs[0]), int(xs[0])
    members = [int(xs[0])]
    for x in xs[1:]:
        x = int(x)
        if x - prev > gap:
            out.append(((start + prev) // 2, max(members, key=lambda c: longest[c])))
            start, members = x, []
        members.append(x)
        prev = x
    out.append(((start + prev) // 2, max(members, key=lambda c: longest[c])))
    return out


def _terminal_overshoot(band_ext: np.ndarray, x: int, ext: int) -> tuple[int, int, bool]:
    """How far the stroke at column x continues PAST the outer staff lines, and whether the
    overshoot carries anything wide.

    Returns (ov_top, ov_bot, wide_beyond): rows of connected ink (in `x` ±3 px, one-row gaps
    tolerated) above the top staff line / below the bottom line, and whether any overshoot row
    holds a connected horizontal run >= WIDE_BEYOND_SP through the stroke (a notehead, flag or
    beam — including a hollow half-note head whose thin walls defeat the fat-run test). Rows that
    are the STAFF LINE itself are looked through, not counted as an attachment — see BLOB_SKIP_LINE.
    """
    h, w = band_ext.shape
    lo, hi = max(0, x - 3), min(w, x + 4)
    top_i, bot_i = ext, ext + STAFF_SPAN                     # outer staff-line rows in band_ext
    wide = int(round(TARGET_SPACING * WIDE_BEYOND_SP))
    wide_run = max(2, int(round(TARGET_SPACING * WIDE_RUN_SP)))
    wide_near = int(round(TARGET_SPACING * WIDE_NEAR_SP))

    line_rows = (band_ext.sum(axis=1) > band_ext.shape[1] * BLOB_LINE_FILL) \
        if BLOB_SKIP_LINE else np.zeros(h, dtype=bool)

    def walk(y_start: int, step: int, y_end: int) -> tuple[int, bool]:
        ov, gap_rows, run, is_wide = 0, 0, 0, False
        y = y_start + step
        while y != y_end:
            seg = band_ext[y, lo:hi]
            if seg.any() and line_rows[y]:
                ov = abs(y - y_start)                # the staff line — look straight through it
                gap_rows = 0
            elif seg.any():
                ov = abs(y - y_start)
                gap_rows = 0
                # connected horizontal width through the stroke at this overshoot row
                c = lo + int(np.argmax(seg))
                l = c
                while l > 0 and band_ext[y, l - 1]:
                    l -= 1
                rt = c
                while rt < w - 1 and band_ext[y, rt + 1]:
                    rt += 1
                run = run + 1 if rt - l + 1 >= wide else 0
                if run >= wide_run and ov <= wide_near:
                    is_wide = True
            else:
                gap_rows += 1
                run = 0
                if gap_rows > 1:
                    break
            y += step
        return ov, is_wide

    ov_top, wide_top = walk(top_i, -1, -1)
    ov_bot, wide_bot = walk(bot_i, +1, h)
    return ov_top, ov_bot, wide_top or wide_bot


def detect_barlines(row: np.ndarray, staff: Staff, scale: float,
                    debug_info: dict | None = None,
                    top_y: int = TOP_LINE_Y,
                    binarize: Callable[[np.ndarray], np.ndarray] = binarize_ink) -> list[int]:
    """Find real barlines by CONTINUITY + THINNESS + CLEAN TERMINATION.

    Three tests a barline passes and notes/stems/clefs do not:
      1. CONTINUITY — one unbroken vertical run from the top staff line to the bottom line,
         with ink touching both extremes (a stem only reaches partway).
      2. THINNESS — within the staff band, the stroke is a few px wide at EVERY height (a
         notehead is a fat ellipse, a beam a fat bar). Deliberately NOT run outside the
         staff: lyrics/dot-leaders/slurs there are usually UNRELATED ink and killed real
         barlines on cramped prints — outside-staff evidence is gate 3's job, which only
         follows ink CONNECTED to the stroke.
      3. TERMINATION — a barline stops at/near both outer staff lines. Walking the connected
         stroke past a line: extending past BOTH lines is a clef (or a page-border artifact);
         past ONE line with a sustained-wide attachment (>= WIDE_RUN_SP rows) is a stem
         ending in a notehead/flag/beam — a 2-3 px slur/tie crossing the tip stays a
         barline. Thin ONE-sided overshoot of any length is kept: long-drawn barlines,
         volta-bracket ticks and system-touching bars are all legitimate (a hard length cap
         was tried and rejected real volta barlines).
    Gate 2 tests the cluster CENTER (old semantics — a smudged bar's longest-run column can
    sit inside the smudge and read fat); gate 3 tests the longest-run member column, since
    the walk needs actual stroke ink (a double-bar cluster's center is the blank gap).
    Returns barline x's (row coordinates). `debug_info`, if given, collects rejected
    candidates under key "rejects" as (x, reason) for the debug overlay.
    """
    top, bot = top_y, top_y + STAFF_SPAN
    tol = max(3, int(round(TARGET_SPACING * 0.35)))          # ~1/3 line-space slack
    ext = int(round(TARGET_SPACING * EXT_SP))
    band_ext = binarize(row)[top - ext:bot + ext] > 0        # staff ± EXT_SP (gate 3)
    band = band_ext[ext - tol:ext + STAFF_SPAN + tol]        # staff ± tol (gates 1-2)
    span = band.shape[0]

    longest, run_top, run_bot = _longest_vertical_run(band, with_ends=True)
    touches_top = band[:2 * tol].any(axis=0)                 # ink at/above the top staff line
    touches_bot = band[-2 * tol:].any(axis=0)                # ink at/below the bottom staff line
    is_bar = (longest >= span * 0.85) & touches_top & touches_bot
    if BAR_FADE_SP > 0:
        # ... or a stroke that RUNS BETWEEN the two staff lines but has faded at one end. The
        # staff lines sit at band rows `tol` and `tol + STAFF_SPAN`; a fade may eat BAR_FADE_SP of
        # a line-space off either end. See BAR_FADE_SP — this only ADDS candidates.
        fade = int(round(TARGET_SPACING * BAR_FADE_SP))
        is_bar |= ((longest >= STAFF_SPAN - 2 * fade)
                   & (run_top <= tol + fade)
                   & (run_bot >= tol + STAFF_SPAN - fade))

    xs = np.where(is_bar)[0]
    clusters = _cluster_cols(xs, longest, gap=max(4, int(TARGET_SPACING * 0.6)))
    rejects: list[tuple[int, str]] = [] if debug_info is not None else None

    # gate 2: reject any candidate carrying a NOTEHEAD-tall fat blob inside the staff band,
    # keeping thick/repeat barlines and lines notes merely touch. Staff-line rows ink every
    # column and are skipped.
    staff_rows = band.sum(axis=1) > band.shape[1] * 0.4
    if STAFF_ROW_POS_SP > 0:
        # ... and a staff row must sit ON a staff line. See STAFF_ROW_POS_SP.
        th = max(2, int(round(TARGET_SPACING * STAFF_ROW_POS_SP)))
        on_line = np.zeros(len(staff_rows), dtype=bool)
        for k in range(5):
            on_line[max(0, tol + STAFF_SPAN // 4 * k - th):tol + STAFF_SPAN // 4 * k + th + 1] = True
        staff_rows &= on_line
    fat_w = int(round(TARGET_SPACING * 0.75))                # wider than a thick barline core
    fat_run = int(round(TARGET_SPACING * 0.5))               # ~a notehead's height
    ov_tol = int(round(TARGET_SPACING * OV_TOL_SP))
    bars = []
    for center, test_col in clusters:
        if not _is_thin_stroke(band, center, fat_w, fat_run, staff_rows):
            if rejects is not None:
                rejects.append((center, "gate2_fat"))
            continue
        ov_top, ov_bot, wide_beyond = _terminal_overshoot(band_ext, test_col, ext)
        if ov_top > ov_tol and ov_bot > ov_tol:              # extends both ways: clef
            if rejects is not None:
                rejects.append((center, "gate3_clef"))
            continue
        # A NOTEHEAD ATTACHED PAST A STAFF LINE MEANS STEM, however little the stroke overshoots
        # (owner, 2026-08-24). `wide_beyond` always found it; the gate used to ignore it unless the
        # overshoot also passed OV_TOL_SP, so a stem clearing the line by 14 px against a 15 px
        # tolerance was taken as a barline — and on Meltem row 1 the REAL barline was rejected
        # while the stem beside it was kept. Measured against SymbTr truth (score_slicer, 124
        # rows): rows whose measure count matches the print go 73 -> 86, and the regressed count
        # does not move (11 -> 11). The cost is a real barline that a notehead merely TOUCHES,
        # which the ±3 px walk cannot tell from an attachment; that is rare and it is a trade the
        # owner took deliberately. docs/METRICS-SLICER.md.
        if (ov_top > 0 or ov_bot > 0) and wide_beyond:  # head/flag/beam past a line
            if rejects is not None:
                rejects.append((center, "gate3_blob"))
            continue
        bars.append(center)

    x0, x1 = int(staff.x0 * scale), int(staff.x1 * scale)
    if rejects is not None:
        rejects.extend((b, "xrange") for b in bars if not (x0 - 5 <= b <= x1 + 5))
    bars = [b for b in bars if x0 - 5 <= b <= x1 + 5]
    # the staff's own left/right ends are measure boundaries even if unlined. SNAP a detected
    # bar near an end onto the end itself (never leave the clef/signature left of measure 0,
    # nor a sliver); otherwise add the end as a synthetic boundary.
    end_tol = int(round(TARGET_SPACING * 0.7))
    if bars and bars[0] <= x0 + end_tol:
        bars[0] = min(bars[0], x0)
    else:
        bars = [x0] + bars
    if bars[-1] >= x1 - end_tol:
        bars[-1] = max(bars[-1], x1)
    else:
        bars = bars + [x1]
    if debug_info is not None:
        debug_info["rejects"] = rejects
    return bars


def _has_notehead(row: np.ndarray, xa: int, xb: int, top_y: int = TOP_LINE_Y,
                  binarize: Callable[[np.ndarray], np.ndarray] = binarize_ink) -> bool:
    """Any notehead-fat blob in columns [xa, xb)? Same fat semantics as `_is_thin_stroke`:
    a connected horizontal run >= 0.75 sp wide sustained over >= 0.5 sp of consecutive rows.
    Signature accidentals stay under it (a flat's bowl is ~0.55 sp), repeat dots far under."""
    sp = TARGET_SPACING
    fat_w = int(round(sp * 0.75))
    fat_run = int(round(sp * 0.5))
    if xb - xa < fat_w:
        return False
    y0 = max(0, int(top_y - 1.5 * sp))
    y1 = min(row.shape[0], int(top_y + STAFF_SPAN + 1.5 * sp))
    band = binarize(row)[y0:y1, xa:xb] > 0
    staff_rows = band.sum(axis=1) > band.shape[1] * 0.9   # staff lines ink the whole slice
    run = 0
    for y in range(band.shape[0]):
        if staff_rows[y]:
            continue
        best = cur = 0
        for v in band[y]:
            cur = cur + 1 if v else 0
            best = cur if cur > best else best
        run = run + 1 if best >= fat_w else 0
        if run >= fat_run:
            return True
    return False


def row_cost_features(row: np.ndarray,
                      top_y: int = TOP_LINE_Y,
                      binarize: Callable[[np.ndarray], np.ndarray] = binarize_ink,
                      ) -> tuple[np.ndarray, np.ndarray]:
    """Per-column token-cost features for a normalized row: (stem_starts, ink_cols).

    Both are 0/1 column arrays that SUM over a pixel span, so a window's estimated token cost is
    a prefix-sum difference — the packer evaluates a candidate span in O(1).

    `stem_starts` marks the FIRST column of each vertical-stroke cluster (a note's stem is ~3 sp,
    so a 2 sp unbroken run finds stems and barlines while ignoring beams and staff lines); one
    stem counts once however many columns thick it is. `ink_cols` marks columns carrying any
    non-staff-line ink, which picks up what has no stem: rests, dots, accidentals, whole notes.
    """
    ink = binarize(row) > 0
    h = ink.shape[0]
    y0 = max(0, int(top_y - 2.0 * TARGET_SPACING))               # ledger notes above ...
    y1 = min(h, int(top_y + STAFF_SPAN + 2.0 * TARGET_SPACING))  # ... and beams below
    band = ink[y0:y1]
    if band.size == 0:
        z = np.zeros(ink.shape[1], dtype=np.int32)
        return z, z
    staff_rows = band.sum(axis=1) > band.shape[1] * 0.4          # staff lines ink every column
    body = band[~staff_rows]

    longest = _longest_vertical_run(band)                        # includes staff rows: a stem
    stem_cols = longest >= int(2.0 * TARGET_SPACING)             # crosses them unbroken
    starts = stem_cols & ~np.r_[False, stem_cols[:-1]]           # rising edge = one stem

    ink_cols = (body.sum(axis=0) > 0) if body.size else np.zeros(band.shape[1], dtype=bool)
    return starts.astype(np.int32), ink_cols.astype(np.int32)


def estimate_tokens(cum_stems: np.ndarray, cum_ink: np.ndarray,
                    x0: int, x1: int, is_row_start: bool) -> float:
    """Estimated decoded token count for the span [x0, x1), from the prefix sums of
    `row_cost_features`. Fitted on 2,500 decoded strips; see the constants block."""
    x0 = max(0, min(x0, len(cum_stems) - 1))
    x1 = max(x0, min(x1, len(cum_stems) - 1))
    stems = float(cum_stems[x1] - cum_stems[x0])
    inked = float(cum_ink[x1] - cum_ink[x0])
    return (COST_PER_STEM * stems + COST_PER_INK_COL * inked
            + (COST_ROW_START if is_row_start else 0.0))


# Bump this whenever the CLASSICAL-CV path — staff detection, the ink mask, or barline detection —
# changes in a way that can move a crop boundary. The settings below cover the env-switchable knobs,
# but a code change moves crops with every knob left alone: the 2026-08-24/25 staff repairs, the
# staff-line-neutral blob walk and gate 2's position rule all did, and `window_cache_ok` could not
# see any of them, so a July decode still read as valid against crops the current code no longer
# produces. Date-shaped so the value says WHEN the geometry it describes was current.
GEOMETRY_REV = 20260903


def window_signature() -> dict:
    """The settings a cached decode's CROPS were produced under — store this beside a decode.

    Two halves, and both move a crop: the WINDOWING rules (how measures are packed into strips) and
    the GEOMETRY that decides where a measure is at all. Only the first half was recorded until
    2026-08-25.
    """
    return {"measures_per_strip": MEASURES_PER_STRIP, "max_strip_w": MAX_STRIP_W,
            "window_mode": WINDOW_MODE, "token_budget": TOKEN_BUDGET,
            "edge_trim": TRIM_SHARED_EDGE, "vplace": VPLACE_ADAPTIVE,
            "tail_span": TAIL_SPAN_MAX_SP,
            "geometry_rev": GEOMETRY_REV,
            "geometry": {"bar_fade": BAR_FADE_SP, "staff_rescue": STAFF_RESCUE,
                         "staff_group_span": STAFF_GROUP_BY_SPAN,
                         "blob_skip_line": BLOB_SKIP_LINE,
                         "blob_line_fill": BLOB_LINE_FILL, "staff_row_pos": STAFF_ROW_POS_SP,
                         "staff_span_consensus": STAFF_SPAN_CONSENSUS,
                         "staff_span_min_rows": STAFF_SPAN_MIN_ROWS,
                         "staff_span_fix": STAFF_SPAN_FIX_SPACING,
                         "staff_width_consensus": STAFF_WIDTH_CONSENSUS}}


def window_cache_ok(prev: dict) -> bool:
    """True if a cached decode's crops match the CURRENT windowing settings.

    Caches used to be keyed on `measures_per_strip` alone, which a packing-rule change would slip
    straight past — and mixing two slicers inside one comparison is exactly how the earlier n_ids
    read was confounded (docs/METRICS-SLICER.md). Caches written before the modes existed are
    legacy by definition.
    """
    if prev.get("measures_per_strip", 3) != MEASURES_PER_STRIP:
        return False
    # The width rail moves crop boundaries just as directly as the measure rail, and until 2026-08-17
    # it was absent here: a decode cached at MAX_STRIP_W 1450 stayed "valid" after the cap was
    # lowered, so a geometry pilot would silently score new crops against old decodes. Default 1450
    # so every cache written before this field existed reads as the shipped geometry, which it was.
    if int(prev.get("max_strip_w", 1450)) != MAX_STRIP_W:
        return False
    if prev.get("window_mode", "legacy") != WINDOW_MODE:
        return False
    if prev.get("edge_trim", False) != TRIM_SHARED_EDGE:
        return False        # the crops moved, so every decode under them is stale
    if prev.get("vplace", False) != VPLACE_ADAPTIVE:
        return False        # the staff sits elsewhere in the frame
    # Where the STAFF and the BARLINES were found, which decides where a measure is — absent from
    # this check until 2026-08-25, and that is not a theoretical gap: five fixes landed on 24-25
    # August that move crop boundaries, and a cache written on 31 July still passed. A cache with no
    # `geometry_rev` was written before the field existed, so nothing in it says which CV code cut
    # those crops; it cannot be proven current and is refused rather than assumed.
    if prev.get("geometry_rev") != GEOMETRY_REV:
        return False
    if prev.get("geometry") != window_signature()["geometry"]:
        return False
    # the token budget only moves a crop boundary in budget mode
    return WINDOW_MODE != "budget" or float(prev.get("token_budget", -1)) == TOKEN_BUDGET


def _span_cap() -> int:
    """Width budget for a WINDOW SPAN, leaving room for the crop pad the driver adds on its left.

    The cap has to hold on the emitted PNG, not on the pre-pad span: 29 of 3,168 strips_v2 crops
    cleared MAX_STRIP_W as spans and broke it once padded (measured 2026-07-29). The reserve is
    the largest pad the driver applies (the w00 clef margin, 0.5 sp).
    """
    return MAX_STRIP_W - int(round(TARGET_SPACING * 0.5))


def _split_wide(row: np.ndarray, x0: int, x1: int,
                top_y: int = TOP_LINE_Y,
                binarize: Callable[[np.ndarray], np.ndarray] = binarize_ink,
                ) -> list[tuple[int, int]]:
    """Split an over-wide span (a genuinely wide measure) at whitespace GUTTERS only.

    A cut through ink (a notehead / beam) puts half the symbol in each neighbouring strip and
    the model decodes it twice — so cuts may ONLY land on columns with ZERO symbol ink. Symbol
    ink is measured over a band wider than the staff (noteheads ride above it, beams hang below
    it) with the full-width staff-line rows excluded. Each cut picks the widest-gutter center
    nearest the ideal k/n position; if a region has no zero-ink gutter at all (unbroken beam
    run), the least-ink column is the last resort.

    A gutter can sit far from the ideal k/n position, so the even split n = ceil(w / cap) is only
    a STARTING guess: it left 31 of 3,168 strips_v2 crops over the cap (measured 2026-07-29).
    We raise n until every piece fits, giving up after a few tries rather than cutting through ink.
    """
    import math
    cap = _span_cap()
    if x1 - x0 <= cap:
        return [(x0, x1)]
    sp = TARGET_SPACING
    y0 = max(0, int(top_y - 2.0 * sp))                   # cover ledger notes above ...
    y1 = min(row.shape[0], int(top_y + STAFF_SPAN + 2.0 * sp))  # ... and beams below
    band = binarize(row)[y0:y1] > 0
    staff_rows = band.sum(axis=1) > band.shape[1] * 0.4  # staff lines ink every column
    ink = band[~staff_rows].sum(axis=0)

    # maximal zero-ink runs (gutters) strictly inside the span
    margin = int(2 * sp)
    gutters: list[tuple[int, int]] = []                  # (center, width)
    g0 = None
    for x in range(x0 + margin, x1 - margin):
        if ink[x] == 0:
            g0 = x if g0 is None else g0
        elif g0 is not None:
            gutters.append(((g0 + x - 1) // 2, x - g0))
            g0 = None
    if g0 is not None:
        gutters.append(((g0 + x1 - margin - 1) // 2, x1 - margin - g0))

    def cut_into(n: int) -> list[tuple[int, int]]:
        cuts = [x0]
        for k in range(1, n):
            target = x0 + (x1 - x0) * k // n
            near = [(abs(c - target) - 2 * w, c) for c, w in gutters
                    if abs(c - target) < (x1 - x0) / (2 * n)]  # stay near the even split
            if near:
                cuts.append(min(near)[1])                # closest, wide gutters preferred
            else:                                        # no gutter: least-ink column
                w = int(sp * 3)
                lo, hi = max(x0 + 5, target - w), min(x1 - 5, target + w)
                cuts.append(lo + int(np.argmin(ink[lo:hi])) if hi > lo else target)
        cuts = sorted(set(cuts))                         # two targets can pick one gutter
        cuts.append(x1)
        return list(zip(cuts[:-1], cuts[1:]))

    n0 = math.ceil((x1 - x0) / cap)
    pieces = cut_into(n0)
    for n in range(n0 + 1, n0 + 4):                      # gutter-shifted cuts can still overrun
        if max(b - a for a, b in pieces) <= cap:
            break
        pieces = cut_into(n)
    return pieces


@dataclass
class Window:
    """One strip window: pixel span + the row-local measures it covers.

    `m_from`/`m_to` are 0-based inclusive indices into the row's bar-to-bar measure spans —
    the geometry the Rung-3 emitter aligns against SymbTr measures. A `split_wide` window is a
    FRAGMENT of one over-wide measure (`m_from == m_to`, partial content): it can never map to
    whole SymbTr measures, so the emitter drops it.
    """
    x0: int
    x1: int
    m_from: int
    m_to: int
    split_wide: bool = False
    est_tokens: float = 0.0    # estimated decoded length; > 59 means the emitter will drop it


def window_measures(bars: list[int], row: np.ndarray | None = None,
                    top_y: int = TOP_LINE_Y,
                    binarize: Callable[[np.ndarray], np.ndarray] = binarize_ink) -> list[Window]:
    """Group consecutive measures (bar-to-bar spans) into windows that fit the LABEL BUDGET.

    The first window of a row keeps the left prefix (clef + key signature -> the \\sig carrier).
    A single measure wider than the width cap (a missed barline) is split at whitespace gutters so
    no strip exceeds the width the model was trained on.

    Packing rule (`WINDOW_MODE`):
      "legacy" (default) — take up to MEASURES_PER_STRIP measures, shrink the window on width.
      "budget" — add measures while the ESTIMATED token cost stays under TOKEN_BUDGET, with
        MEASURES_PER_STRIP and the width cap as outer rails. Measured a wash against legacy (see
        the constants block); available because it trades near-empty crops for usable strips.
    The cap FIXES apply in both modes — only the packing rule differs.

    Every window records `est_tokens`, so a measure that cannot fit the budget even ALONE (8.9% of
    single measures) is visible in the manifest instead of silently dying in the emitter.

    A leading span holding no notehead past the clef zone (a repeat/barline printed right
    after the clef+signature) is a PREFIX, not a measure: it stays in the first window's
    crop but is excluded from measure indexing — counting it used to shift every strip's
    measure span by one and send whole rows to review (dn != 0). A pickup measure keeps
    counting normally: its notehead is found. Known trade-off: a row-start measure holding ONLY
    rests has no notehead and is mis-trimmed too — that row falls to the emitter's dn recovery /
    review queue, never to corrupted training labels.
    """
    lead = None
    if (row is not None and len(bars) >= 3
            and bars[1] - bars[0] <= int(10 * TARGET_SPACING)
            and not _has_notehead(row, bars[0] + int(4 * TARGET_SPACING), bars[1] - 2,
                                  binarize=binarize,
                                  top_y=top_y)):
        lead, bars = bars[0], bars[1:]         # clef ~3.5 sp: scan for music beyond it
    # ... and the same thing at the other end: a closing `:|` read as two barlines (TAIL_SPAN_MAX_SP)
    tail = None
    if (row is not None and len(bars) >= 3
            and bars[-1] - bars[-2] <= int(TAIL_SPAN_MAX_SP * TARGET_SPACING)
            and not _has_notehead(row, bars[-2] + 2, bars[-1] - 2,
                                  binarize=binarize, top_y=top_y)):
        tail, bars = bars[-1], bars[:-1]
    spans = list(zip(bars[:-1], bars[1:]))     # each = one measure
    if not spans:
        return []
    cap = _span_cap()
    # the estimate is recorded in BOTH modes (it is diagnostics, and keeps the two comparable);
    # only whether it GATES the packing depends on the mode
    budget_mode = WINDOW_MODE == "budget" and row is not None
    if row is not None:
        st, ic = row_cost_features(row, top_y=top_y, binarize=binarize)
        cum_stems, cum_ink = np.r_[0, np.cumsum(st)], np.r_[0, np.cumsum(ic)]

    def cost(x0: int, x1: int, first: bool) -> float:
        if row is None:
            return 0.0
        return estimate_tokens(cum_stems, cum_ink, x0, x1, first)

    # the first window starts at the clef prefix when there is one, so the caps below see the
    # crop's TRUE extent (re-extending it afterwards is what broke the width cap on 22 strips)
    def win_x0(i: int) -> int:
        return lead if (i == 0 and lead is not None) else spans[i][0]

    # ... and the last window ends AT the closing barline the tail trim dropped, for the same
    # reason: the caps below must see the crop's true extent, and a strip should end on its bar.
    def win_x1(k: int) -> int:
        return tail if (tail is not None and k == len(spans) - 1) else spans[k][1]

    windows: list[Window] = []
    i = 0
    while i < len(spans):
        first = i == 0
        x0 = win_x0(i)
        j = i + 1                              # always take at least one measure
        while j < len(spans) and j - i < MEASURES_PER_STRIP:
            nx1 = win_x1(j)
            if nx1 - x0 > cap:
                break                          # width rail
            if budget_mode and cost(x0, nx1, first) > TOKEN_BUDGET:
                break                          # label-budget rail (the one that drops strips)
            j += 1
        x1 = win_x1(j - 1)
        if x1 - x0 > cap and row is not None:               # over-wide single measure
            windows.extend(Window(a, b, i, j - 1, split_wide=True,
                                  est_tokens=round(cost(a, b, first and a == x0), 1))
                           for a, b in _split_wide(row, x0, x1, top_y=top_y, binarize=binarize))
        elif x1 - x0 < MIN_STRIP_W:
            # never silently DROP content: a sliver merges into the previous window when the
            # result stays within the trained width AND the measure cap; else it is emitted on
            # its own (a narrow w00 with just clef+sig beats a lost one — the old drop caused
            # mid-staff w00s). The measure-cap half was missing and let 13 of 3,168 strips_v2
            # crops carry 4-5 measures.
            prev = windows[-1] if windows else None
            if (prev is not None and not prev.split_wide
                    and x1 - prev.x0 <= cap
                    and (j - 1) - prev.m_from + 1 <= MEASURES_PER_STRIP):
                prev.x1, prev.m_to = x1, j - 1
                prev.est_tokens = round(cost(prev.x0, x1, prev.m_from == 0), 1)
            else:
                windows.append(Window(x0, x1, i, j - 1,
                                      est_tokens=round(cost(x0, x1, first), 1)))
        else:
            windows.append(Window(x0, x1, i, j - 1,
                                  est_tokens=round(cost(x0, x1, first), 1)))
        i = j
    return windows


# ----------------------------------------------------------------------------------- driver
def page_to_strips(page_path: str | Path, out_dir: str | Path, debug: bool = False) -> list[dict]:
    page = load_gray(page_path)
    # perspective-rectify an obliquely-shot page + deskew residual rotation; no-op on clean scans,
    # and the crop is auto-discarded when it doesn't improve staff detectability (see prep_page)
    page, cropped, skew_angle = prep_page(page)
    # ONE page, ONE binarizer. `page_binarizer` decides from the whole page (a per-row guard is
    # meaningless — one row holds one staff), and the row-level gates below are handed the SAME
    # choice rather than re-running plain Otsu. Threading it changes nothing on a page whose
    # chooser returns `binarize_ink`, which is every page the fallback does not fire on; on a pale
    # page it stops the barline gates from working off a mask the staff lines are missing from.
    binz = page_binarizer(page)
    ink = binz(page)
    # one page-level labelling, reused by every row: it is how normalize_row tells THIS row's
    # music (connected to its staff) from a neighbouring system or page furniture
    lab = cv2.connectedComponents((ink > 0).astype(np.uint8), connectivity=8)[1] \
        if VPLACE_ADAPTIVE else None
    staves = detect_staves(ink)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(page_path).stem

    dbg = cv2.cvtColor(page, cv2.COLOR_GRAY2BGR) if debug else None
    manifest: list[dict] = []
    n = 0
    for si, staff in enumerate(staves):
        row, scale, top_y = normalize_row(page, staff, lab)
        dbg_info: dict | None = {} if debug else None
        bars = detect_barlines(row, staff, scale, debug_info=dbg_info, top_y=top_y,
                               binarize=binz)
        windows = window_measures(bars, row, top_y=top_y, binarize=binz)
        # total measures the row's windows cover (a trimmed clef+sig prefix span is no measure)
        row_measures = max(w.m_to for w in windows) + 1 if windows else 0
        bar_set = set(bars)
        crops: list[tuple[int, int]] = []     # padded pixel spans, for the debug overlay
        # LEFT pad: reach past the enclosing barline so a cut never shaves a stem/flag, and so a
        # real crop opens on a visible barline the way every synthetic training strip does.
        # Gutter cuts from _split_wide get NO pad (a pad could re-enter the ink the gutter
        # avoided). w00 gets extra left margin: the clef's leftmost ink can start a few px left
        # of the measured staff.x0, and only page margin lies beyond.
        pads = [int(round(TARGET_SPACING * 0.5)) if wi == 0
                else (PAD_PX if w.x0 in bar_set else 0)
                for wi, w in enumerate(windows)]
        for wi, w in enumerate(windows):
            pl = pads[wi]
            # RIGHT trim: give back exactly what the NEXT strip takes as its left pad, so the
            # two never carry the same pixels. Two reasons, the second the load-bearing one:
            #   * without it the strips overlap by PAD_PX and the shared band is drawn twice;
            #   * a strip's label never contains an edge barline (0 of 421 real labels start or
            #     end with `|`), yet real crops ended ON the barline centre and showed one 65% of
            #     the time, against 5% for the synthetic strips the model trained on. Trimming
            #     drops the closing barline out of frame and closes that ~60pp domain gap.
            # Nothing is lost: the trimmed band is still carried by the following strip.
            trim = pads[wi + 1] if (TRIM_SHARED_EDGE and wi + 1 < len(windows)
                                    and windows[wi + 1].x0 == w.x1) else 0
            if w.x1 - trim - (w.x0 - pl) < MIN_STRIP_W:
                trim = 0                       # never trim a strip below the sliver floor
            cx0, cx1 = max(0, w.x0 - pl), min(row.shape[1], w.x1 - trim)
            crops.append((cx0, cx1))
            crop = row[:, cx0:cx1]
            name = f"{stem}_s{si:02d}_w{wi:02d}.png"
            cv2.imwrite(str(out_dir / name), crop)
            entry = {
                "strip": name, "system": si, "window": wi,
                "row_x0": int(cx0), "row_x1": int(cx1), "width": int(cx1 - cx0),
                # [left, right] margin around the measure span; right is NEGATIVE when the
                # shared-edge trim gave those columns to the following strip
                "pad": [int(w.x0 - cx0), int(cx1 - w.x1)],
                "scale": round(scale, 3), "is_row_start": wi == 0,
                # Rung-3 emitter geometry: row-local 0-based measure indices this strip covers.
                "meas_from": w.m_from, "meas_to": w.m_to,
                "n_measures": w.m_to - w.m_from + 1,
                "split_wide": w.split_wide,
                "row_measures": row_measures,
                # estimated decoded length (see row_cost_features): the emitter's 59-id gate is
                # what drops a strip, so flag the ones that cannot fit even alone rather than
                # letting them die silently downstream
                "est_tokens": w.est_tokens,
                "budget_risk": w.est_tokens > 59,
            }
            if wi == 0:
                entry["row_bars"] = [int(b) for b in bars]  # audit/debug: raw barline x-positions
            manifest.append(entry)
            n += 1
        if dbg is not None:
            for y in staff.lines:
                cv2.line(dbg, (staff.x0, y), (staff.x1, y), (0, 160, 0), 1)
            for b in bars:            # every accepted barline (blue) — check completeness here
                bx = int(b / scale)
                cv2.line(dbg, (bx, staff.top - 12), (bx, staff.bottom + 12), (220, 120, 0), 2)
            # rejected candidates, color-coded by WHY (orange=fat blob, purple=clef-like/too
            # long, yellow=head/flag past a staff line, gray=outside the staff x-extent)
            rej_color = {"gate2_fat": (0, 140, 255), "gate3_clef": (200, 0, 180),
                         "gate3_blob": (0, 220, 220), "xrange": (160, 160, 160)}
            for rx, why in (dbg_info or {}).get("rejects", []):
                bx = int(rx / scale)
                cv2.line(dbg, (bx, staff.top - 24), (bx, staff.bottom + 24),
                         rej_color.get(why, (128, 128, 128)), 2)
            for cx0, cx1 in crops:    # padded strip crops (red boxes) mapped back to page coords
                px0, px1 = int(cx0 / scale), int(cx1 / scale)
                cv2.rectangle(dbg, (px0, staff.top - 20), (px1, staff.bottom + 20), (0, 0, 220), 2)

    (out_dir / f"{stem}_manifest.json").write_text(json.dumps(manifest, indent=1))
    if dbg is not None:
        cv2.imwrite(str(out_dir / f"{stem}_debug.png"), dbg)
    pre = ("  [" + ", ".join(
        ([f"crop"] if cropped else []) + ([f"deskew {skew_angle:+.1f}deg"] if skew_angle else [])
    ) + "]") if (cropped or skew_angle) else ""
    print(f"{stem}: {len(staves)} staves -> {n} strips{pre}  ({out_dir})")
    return manifest


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page", help="path to a page PNG")
    ap.add_argument("--out", default="data/real/strips", help="output dir for strips")
    ap.add_argument("--debug", action="store_true", help="also write a <page>_debug.png overlay")
    args = ap.parse_args()
    out = Path(args.out) / Path(args.page).stem
    page_to_strips(args.page, out, debug=args.debug)


if __name__ == "__main__":
    main()
