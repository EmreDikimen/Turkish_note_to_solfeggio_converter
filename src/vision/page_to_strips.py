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

import cv2
import numpy as np

# ---- target strip geometry the model was trained on (measured from gate strips) --------------
STRIP_H = 336          # output strip height (px)
TARGET_SPACING = 30.0  # staff line spacing after normalization (px)
STAFF_SPAN = 120       # top line -> bottom line (= 4 * spacing)
TOP_LINE_Y = 138       # y of the top staff line inside the 336-tall strip
HEADROOM_SP = TOP_LINE_Y / TARGET_SPACING          # line-spaces above the top line (~4.6)
BELOW_SP = (STRIP_H - TOP_LINE_Y - STAFF_SPAN) / TARGET_SPACING  # below bottom line (~2.6)

# ---- windowing --------------------------------------------------------------------------------
# OMR_MEASURES_PER_STRIP: tuplet-dense pieces blow the 59-id label budget even at 2 measures
# (measured 2026-07-17: 80% of tup3-bearing 2-measure windows, 39% of SINGLE measures) — the
# targeted tuplet emit slices at 1 measure/window so the fitting 61% survive the budget gate.
MEASURES_PER_STRIP = int(os.environ.get("OMR_MEASURES_PER_STRIP", "3"))
# target measures per window (2-4 is the training range)
MAX_STRIP_W = 1450         # cap width (training strips topped out ~1443 px)
MIN_STRIP_W = 200          # ignore degenerate slivers

# ---- barline discrimination (line-space units; rows are geometry-normalized) ------------------
# A true barline terminates AT (or a few px past) the outer staff lines with nothing attached;
# a stem ends in a notehead/flag/beam, a G-clef extends far beyond BOTH lines.
EXT_SP = 2.5           # analysis band extends this far past the outer staff lines
                       # (2.5 sp keeps the band inside STRIP_H: 138-75=63, 258+75=333)
OV_TOL_SP = 0.5        # a real barline may overshoot a staff line by up to this much
WIDE_BEYOND_SP = 0.5   # connected ink this wide past a staff line = notehead/flag/beam ...
WIDE_RUN_SP = 0.2      # ... but only when wide for this many CONSECUTIVE rows (a notehead is
                       # ~0.8 sp tall; a 2-3 px slur/tie crossing the bar's tip is not a blob)
WIDE_NEAR_SP = 1.5     # ... and only within this distance of the staff line: a staff-spanning
                       # stem's head/beam attaches nearer (a longer stem couldn't also span the
                       # staff), while colliding TITLE/LYRIC text sits further out (old prints)
PAD_PX = 6             # crop padding past enclosing barlines (tight: never reaches a notehead)


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


# ---------------------------------------------------------------------------- staff detection
def detect_staves(ink: np.ndarray) -> list[Staff]:
    """Find 5-line staff systems via a horizontal-opening + row projection, then group lines."""
    h, w = ink.shape
    # keep only long horizontal structures (staff lines), drop noteheads/stems/text
    hor_len = max(20, w // 4)
    horiz = cv2.morphologyEx(
        ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (hor_len, 1))
    )
    row_ink = horiz.sum(axis=1) / 255.0
    if row_ink.max() < 1:
        return []
    # candidate staff-line rows: strong horizontal ink
    thr = max(row_ink.max() * 0.3, w * 0.2)
    line_rows = _cluster_rows(np.where(row_ink > thr)[0])
    if len(line_rows) < 2:
        return []
    # group consecutive lines into systems: a gap >> median spacing starts a new system
    gaps = np.diff(line_rows)
    sp = float(np.median(gaps))
    staves: list[Staff] = []
    group = [line_rows[0]]
    for prev, cur in zip(line_rows[:-1], line_rows[1:]):
        if cur - prev <= sp * 2.2:          # same staff
            group.append(cur)
        else:                                # new system
            _emit_staff(group, ink, staves)
            group = [cur]
    _emit_staff(group, ink, staves)
    return staves


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


def _emit_staff(group: list[int], ink: np.ndarray, out: list[Staff]) -> None:
    """Accept a group as a staff if it has ~5 evenly-spaced lines; record its x-extent."""
    if not (4 <= len(group) <= 7):
        return
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
    # artifacts far from the staff must not stretch the extent
    gap_tol = int(3 * sp)
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


# -------------------------------------------------------------------- normalize + barlines
def normalize_row(gray: np.ndarray, staff: Staff) -> tuple[np.ndarray, float, int]:
    """Crop the band around a staff and rescale so line spacing == TARGET_SPACING.

    Returns (row_img HxW at STRIP_H tall, scale, top_line_y_in_row).
    """
    sp = staff.spacing
    scale = TARGET_SPACING / sp
    # band in page coords that maps to the 336-tall strip with the staff placed like training
    band_top = int(round(staff.top - HEADROOM_SP * sp))
    band_bot = int(round(staff.bottom + BELOW_SP * sp))
    band_top_c, band_bot_c = max(0, band_top), min(gray.shape[0], band_bot)
    crop = gray[band_top_c:band_bot_c, :]
    # pad if the band ran off the page edge (keep the staff at the right vertical offset)
    pad_t, pad_b = band_top_c - band_top, band_bot - band_bot_c
    if pad_t or pad_b:
        crop = cv2.copyMakeBorder(crop, pad_t, pad_b, 0, 0, cv2.BORDER_CONSTANT, value=255)
    new_w = max(1, int(round(crop.shape[1] * scale)))
    row = cv2.resize(crop, (new_w, STRIP_H), interpolation=cv2.INTER_AREA)
    top_line_y = TOP_LINE_Y
    return row, scale, top_line_y


def _longest_vertical_run(band_bool: np.ndarray) -> np.ndarray:
    """Per column, the length of the longest UNBROKEN run of ink (vectorized over rows)."""
    run = np.zeros(band_bool.shape[1], dtype=np.int32)
    best = np.zeros(band_bool.shape[1], dtype=np.int32)
    for y in range(band_bool.shape[0]):
        row = band_bool[y]
        run = (run + 1) * row          # reset to 0 where there's no ink
        best = np.maximum(best, run)
    return best


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
    beam — including a hollow half-note head whose thin walls defeat the fat-run test).
    """
    h, w = band_ext.shape
    lo, hi = max(0, x - 3), min(w, x + 4)
    top_i, bot_i = ext, ext + STAFF_SPAN                     # outer staff-line rows in band_ext
    wide = int(round(TARGET_SPACING * WIDE_BEYOND_SP))
    wide_run = max(2, int(round(TARGET_SPACING * WIDE_RUN_SP)))
    wide_near = int(round(TARGET_SPACING * WIDE_NEAR_SP))

    def walk(y_start: int, step: int, y_end: int) -> tuple[int, bool]:
        ov, gap_rows, run, is_wide = 0, 0, 0, False
        y = y_start + step
        while y != y_end:
            seg = band_ext[y, lo:hi]
            if seg.any():
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
                    debug_info: dict | None = None) -> list[int]:
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
    top, bot = TOP_LINE_Y, TOP_LINE_Y + STAFF_SPAN
    tol = max(3, int(round(TARGET_SPACING * 0.35)))          # ~1/3 line-space slack
    ext = int(round(TARGET_SPACING * EXT_SP))
    band_ext = binarize_ink(row)[top - ext:bot + ext] > 0    # staff ± EXT_SP (gate 3)
    band = band_ext[ext - tol:ext + STAFF_SPAN + tol]        # staff ± tol (gates 1-2)
    span = band.shape[0]

    longest = _longest_vertical_run(band)
    touches_top = band[:2 * tol].any(axis=0)                 # ink at/above the top staff line
    touches_bot = band[-2 * tol:].any(axis=0)                # ink at/below the bottom staff line
    is_bar = (longest >= span * 0.85) & touches_top & touches_bot

    xs = np.where(is_bar)[0]
    clusters = _cluster_cols(xs, longest, gap=max(4, int(TARGET_SPACING * 0.6)))
    rejects: list[tuple[int, str]] = [] if debug_info is not None else None

    # gate 2: reject any candidate carrying a NOTEHEAD-tall fat blob inside the staff band,
    # keeping thick/repeat barlines and lines notes merely touch. Staff-line rows ink every
    # column and are skipped.
    staff_rows = band.sum(axis=1) > band.shape[1] * 0.4
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
        if (ov_top > ov_tol or ov_bot > ov_tol) and wide_beyond:  # head/flag/beam past a line
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


def _has_notehead(row: np.ndarray, xa: int, xb: int) -> bool:
    """Any notehead-fat blob in columns [xa, xb)? Same fat semantics as `_is_thin_stroke`:
    a connected horizontal run >= 0.75 sp wide sustained over >= 0.5 sp of consecutive rows.
    Signature accidentals stay under it (a flat's bowl is ~0.55 sp), repeat dots far under."""
    sp = TARGET_SPACING
    fat_w = int(round(sp * 0.75))
    fat_run = int(round(sp * 0.5))
    if xb - xa < fat_w:
        return False
    y0 = max(0, int(TOP_LINE_Y - 1.5 * sp))
    y1 = min(row.shape[0], int(TOP_LINE_Y + STAFF_SPAN + 1.5 * sp))
    band = binarize_ink(row)[y0:y1, xa:xb] > 0
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


def _split_wide(row: np.ndarray, x0: int, x1: int) -> list[tuple[int, int]]:
    """Split an over-wide span (a genuinely wide measure) at whitespace GUTTERS only.

    A cut through ink (a notehead / beam) puts half the symbol in each neighbouring strip and
    the model decodes it twice — so cuts may ONLY land on columns with ZERO symbol ink. Symbol
    ink is measured over a band wider than the staff (noteheads ride above it, beams hang below
    it) with the full-width staff-line rows excluded. Each cut picks the widest-gutter center
    nearest the ideal k/n position; if a region has no zero-ink gutter at all (unbroken beam
    run), the least-ink column is the last resort.
    """
    import math
    n = math.ceil((x1 - x0) / MAX_STRIP_W)
    if n <= 1:
        return [(x0, x1)]
    sp = TARGET_SPACING
    y0 = max(0, int(TOP_LINE_Y - 2.0 * sp))              # cover ledger notes above ...
    y1 = min(row.shape[0], int(TOP_LINE_Y + STAFF_SPAN + 2.0 * sp))  # ... and beams below
    band = binarize_ink(row)[y0:y1] > 0
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

    cuts = [x0]
    for k in range(1, n):
        target = x0 + (x1 - x0) * k // n
        near = [(abs(c - target) - 2 * w, c) for c, w in gutters
                if abs(c - target) < (x1 - x0) / (2 * n)]  # stay near the even split
        if near:
            cuts.append(min(near)[1])                    # closest, wide gutters preferred
        else:                                            # no gutter: least-ink column
            w = int(sp * 3)
            lo, hi = max(x0 + 5, target - w), min(x1 - 5, target + w)
            cuts.append(lo + int(np.argmin(ink[lo:hi])) if hi > lo else target)
    cuts.append(x1)
    return list(zip(cuts[:-1], cuts[1:]))


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


def window_measures(bars: list[int], row: np.ndarray | None = None) -> list[Window]:
    """Group consecutive measures (bar-to-bar spans) into ~MEASURES_PER_STRIP windows.

    The first window of a row keeps the left prefix (clef + key signature -> the \\sig carrier).
    A single measure wider than MAX_STRIP_W (a missed barline) is split at whitespace gutters so
    no strip exceeds the width the model was trained on.

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
            and not _has_notehead(row, bars[0] + int(4 * TARGET_SPACING), bars[1] - 2)):
        lead, bars = bars[0], bars[1:]         # clef ~3.5 sp: scan for music beyond it
    spans = list(zip(bars[:-1], bars[1:]))     # each = one measure
    if not spans:
        return []
    windows: list[Window] = []
    i = 0
    while i < len(spans):
        j = min(i + MEASURES_PER_STRIP, len(spans))
        while j > i + 1 and spans[j - 1][1] - spans[i][0] > MAX_STRIP_W:
            j -= 1
        x0, x1 = spans[i][0], spans[j - 1][1]
        if x1 - x0 > MAX_STRIP_W and row is not None:       # over-wide single measure
            windows.extend(Window(a, b, i, j - 1, split_wide=True)
                           for a, b in _split_wide(row, x0, x1))
        elif x1 - x0 < MIN_STRIP_W:
            # never silently DROP content: a sliver merges into the previous window when the
            # result stays within the trained width; else it is emitted on its own (a narrow
            # w00 with just clef+sig beats a lost one — the old drop caused mid-staff w00s)
            if (windows and not windows[-1].split_wide
                    and x1 - windows[-1].x0 <= MAX_STRIP_W):
                windows[-1].x1, windows[-1].m_to = x1, j - 1
            else:
                windows.append(Window(x0, x1, i, j - 1))
        else:
            windows.append(Window(x0, x1, i, j - 1))
        i = j
    if lead is not None and windows:
        windows[0].x0 = lead                   # keep the clef+sig prefix in the w00 crop
    return windows


# ----------------------------------------------------------------------------------- driver
def page_to_strips(page_path: str | Path, out_dir: str | Path, debug: bool = False) -> list[dict]:
    page = load_gray(page_path)
    ink = binarize_ink(page)
    staves = detect_staves(ink)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(page_path).stem

    dbg = cv2.cvtColor(page, cv2.COLOR_GRAY2BGR) if debug else None
    manifest: list[dict] = []
    n = 0
    for si, staff in enumerate(staves):
        row, scale, top_y = normalize_row(page, staff)
        dbg_info: dict | None = {} if debug else None
        bars = detect_barlines(row, staff, scale, debug_info=dbg_info)
        windows = window_measures(bars, row)
        # total measures the row's windows cover (a trimmed clef+sig prefix span is no measure)
        row_measures = max(w.m_to for w in windows) + 1 if windows else 0
        bar_set = set(bars)
        crops: list[tuple[int, int]] = []     # padded pixel spans, for the debug overlay
        for wi, w in enumerate(windows):
            # pad past the enclosing barlines so a cut never shaves a stem/flag — TIGHT
            # (engraved notes sit >= ~0.5 sp from a bar, so PAD_PX can't reach a neighbour's
            # head). Gutter cuts from _split_wide get NO pad (a pad could re-enter the ink
            # the gutter avoided). w00 gets extra left margin: the clef's leftmost ink can
            # start a few px left of the measured staff.x0, and only page margin lies beyond.
            if wi == 0:
                pl = int(round(TARGET_SPACING * 0.5))
            else:
                pl = PAD_PX if w.x0 in bar_set else 0
            pr = PAD_PX if w.x1 in bar_set else 0
            cx0, cx1 = max(0, w.x0 - pl), min(row.shape[1], w.x1 + pr)
            crops.append((cx0, cx1))
            crop = row[:, cx0:cx1]
            name = f"{stem}_s{si:02d}_w{wi:02d}.png"
            cv2.imwrite(str(out_dir / name), crop)
            entry = {
                "strip": name, "system": si, "window": wi,
                "row_x0": int(cx0), "row_x1": int(cx1), "width": int(cx1 - cx0),
                "pad": [int(w.x0 - cx0), int(cx1 - w.x1)],
                "scale": round(scale, 3), "is_row_start": wi == 0,
                # Rung-3 emitter geometry: row-local 0-based measure indices this strip covers.
                "meas_from": w.m_from, "meas_to": w.m_to,
                "n_measures": w.m_to - w.m_from + 1,
                "split_wide": w.split_wide,
                "row_measures": row_measures,
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
    print(f"{stem}: {len(staves)} staves -> {n} strips  ({out_dir})")
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
