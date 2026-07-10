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
MEASURES_PER_STRIP = 3     # target measures per window (2-4 is the training range)
MAX_STRIP_W = 1450         # cap width (training strips topped out ~1443 px)
MIN_STRIP_W = 200          # ignore degenerate slivers


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
            _emit_staff(group, horiz, staves)
            group = [cur]
    _emit_staff(group, horiz, staves)
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


def _emit_staff(group: list[int], horiz: np.ndarray, out: list[Staff]) -> None:
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
    # x-extent: columns where the staff lines carry ink. A staff column only holds ~5 thin
    # lines, so threshold relative to the column max (not the band height).
    band = horiz[group[0]:group[-1] + 1]
    col = band.sum(axis=0) / 255.0
    if col.max() < 1:
        return
    xs = np.where(col > col.max() * 0.3)[0]
    if len(xs) == 0:
        return
    out.append(Staff(lines=group, x0=int(xs[0]), x1=int(xs[-1])))


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


def detect_barlines(row: np.ndarray, staff: Staff, scale: float) -> list[int]:
    """Find real barlines by CONTINUITY + THINNESS, not by summed darkness.

    Two tests a barline passes and notes/stems/beams do not:
      1. CONTINUITY — one unbroken vertical run from the top staff line to the bottom line,
         with ink touching both extremes (a stem only reaches partway).
      2. THINNESS — the stroke is a few px wide at EVERY height (a notehead is a fat ellipse,
         a beam is a fat horizontal bar; either makes the local run wide at some row).
    Test 1 alone lets through the occasional high note whose stem spans the staff and touches
    both lines; test 2 rejects it because its notehead blob is wide. Returns barline x's (row
    coordinates).
    """
    top, bot = TOP_LINE_Y, TOP_LINE_Y + STAFF_SPAN
    tol = max(3, int(round(TARGET_SPACING * 0.35)))          # ~1/3 line-space slack
    band = binarize_ink(row)[top - tol:bot + tol] > 0        # bool, small margin each side
    span = band.shape[0]

    longest = _longest_vertical_run(band)
    touches_top = band[:2 * tol].any(axis=0)                 # ink at/above the top staff line
    touches_bot = band[-2 * tol:].any(axis=0)                # ink at/below the bottom staff line
    is_bar = (longest >= span * 0.85) & touches_top & touches_bot

    xs = np.where(is_bar)[0]
    bars = _cluster_rows(xs, gap=max(4, int(TARGET_SPACING * 0.6)))  # merge thick/repeat strokes
    # reject any candidate carrying a NOTEHEAD-tall fat blob (a note), while keeping thick/repeat
    # barlines and lines that notes merely touch. Ignore the staff-line rows (they ink every col).
    staff_rows = band.sum(axis=1) > band.shape[1] * 0.4
    fat_w = int(round(TARGET_SPACING * 0.75))                # wider than a thick barline core
    fat_run = int(round(TARGET_SPACING * 0.5))               # ~a notehead's height
    bars = [b for b in bars if _is_thin_stroke(band, b, fat_w, fat_run, staff_rows)]
    x0, x1 = int(staff.x0 * scale), int(staff.x1 * scale)
    bars = [b for b in bars if x0 - 5 <= b <= x1 + 5]
    # the staff's own left/right ends are measure boundaries even if unlined — but only add them
    # when no detected barline already sits near that end (else a tiny sliver measure forms)
    end_tol = int(round(TARGET_SPACING * 0.7))
    if not bars or bars[0] > x0 + end_tol:
        bars = [x0] + bars
    if bars[-1] < x1 - end_tol:
        bars = bars + [x1]
    return bars


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


def window_measures(bars: list[int], row: np.ndarray | None = None) -> list[tuple[int, int]]:
    """Group consecutive measures (bar-to-bar spans) into ~MEASURES_PER_STRIP windows.

    The first window of a row keeps the left prefix (clef + key signature -> the \\sig carrier).
    A single measure wider than MAX_STRIP_W (a missed barline) is split at whitespace gutters so
    no strip exceeds the width the model was trained on.
    """
    spans = list(zip(bars[:-1], bars[1:]))     # each = one measure
    if not spans:
        return []
    windows: list[tuple[int, int]] = []
    i = 0
    while i < len(spans):
        j = min(i + MEASURES_PER_STRIP, len(spans))
        while j > i + 1 and spans[j - 1][1] - spans[i][0] > MAX_STRIP_W:
            j -= 1
        x0, x1 = spans[i][0], spans[j - 1][1]
        if x1 - x0 >= MIN_STRIP_W:
            if x1 - x0 > MAX_STRIP_W and row is not None:   # over-wide single measure
                windows.extend(_split_wide(row, x0, x1))
            else:
                windows.append((x0, x1))
        i = j
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
        bars = detect_barlines(row, staff, scale)
        windows = window_measures(bars, row)
        for wi, (x0, x1) in enumerate(windows):
            crop = row[:, x0:x1]
            name = f"{stem}_s{si:02d}_w{wi:02d}.png"
            cv2.imwrite(str(out_dir / name), crop)
            manifest.append({
                "strip": name, "system": si, "window": wi,
                "row_x0": int(x0), "row_x1": int(x1), "width": int(x1 - x0),
                "scale": round(scale, 3), "is_row_start": wi == 0,
            })
            n += 1
        if dbg is not None:
            for y in staff.lines:
                cv2.line(dbg, (staff.x0, y), (staff.x1, y), (0, 160, 0), 1)
            for b in bars:            # every detected barline (blue) — check completeness here
                bx = int(b / scale)
                cv2.line(dbg, (bx, staff.top - 12), (bx, staff.bottom + 12), (220, 120, 0), 2)
            for (x0, x1) in windows:  # window boundaries (red boxes) mapped back to page coords
                px0, px1 = int(x0 / scale), int(x1 / scale)
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
