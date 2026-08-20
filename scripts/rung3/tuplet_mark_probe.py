r"""Round-3 — how does REAL print draw the triplet mark, and how do we draw it?

THE GAP THIS FILLS (docs/rung3/tuplets.md). `\tup3` recall is 83.8% against a >=85% floor and below
its own 92.7% pre-work baseline: the model misses about one triplet in six. The leading hypothesis is
that we draw the mark in a shape real print does not use — real Turkish editions BREAK the arc and set
the "3" in the gap, while `drawTupletArc` draws one unbroken quadratic with the digit floating above
it. In our corpus that makes a triplet differ from a phrase slur (`drawSlurArc`) by a 2 px bulge and a
13 px digit; in real print the two differ structurally. Same shape as the Bravura sharp-bar defect,
and the method that caught THAT one — measure our glyph against real print at matched staff size —
has never been pointed at this mark.

METHOD, and what this script does NOT do. It is a LOCATOR AND A RULER, not a measurer of record:

  * it finds DIGIT-LIKE components (size-filtered, not touching a staff line) that have arc-like ink
    beside them, which is a permissive candidate rule — lyrics, volta numbers and time signatures
    will slip through, and that is fine;
  * for each candidate it writes two tiles at matched staff size: a 4x NEAREST zoom with a
    one-staff-space ruler burned in, and the same window as the ENCODER sees it (the 409x583 Donut
    resize) blown back up 4x;
  * it prints the geometry it can compute per candidate, in STAFF SPACES, so a human can check the
    picture against the number.

⚠ THE TILES ARE THE ARBITER, NOT THE TABLE. Two detectors in this round (round3.md §2, §3) failed
silently and were caught only by looking at contact sheets. A thin curve sitting among beams, ties and
slurs is exactly the shape that fools one, so nothing here decides whether a candidate IS a tuplet
mark — a person reads the tiles and rejects the rest.

The one column worth watching: `segs`, how many arc-like components flank the digit. 2 means the arc
is BROKEN around it (the printed shape we believe in); 1 spanning component means continuous (what we
draw today). That is the hypothesis, in one integer.

Everything is reported in staff spaces (S), never pixels, so real and synthetic are comparable at
whatever scale each pool was normalised to.

Usage:
    .venv-ml/bin/python scripts/rung3/tuplet_mark_probe.py [-n 40] [--pool "real tuplets"]
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data/real/rung3/tuplet_probe"

POOLS = {
    "real tuplets": ROOT / "data/real/rung3/strips_tup",
    "real exam": ROOT / "data/real/rung3/strips_exam_v2_clean",
    "synth v4 (control)": ROOT / "data/synthetic/strips_v4",
}

# Donut preprocessing box, from preprocessor_config.json — same constants beam_weight_probe.py uses.
SIZE_W, SIZE_H = 409, 583

ZOOM = 4  # tile magnification; NEAREST, so pixel edges stay visible for measuring


def staff_rows(bw: np.ndarray, thresh: float = 0.6) -> tuple[float, list[tuple[int, int]]] | None:
    """(staff spacing, staff-line row bands). Same rule as beam_weight_probe.staff_spacing.

    ⚠ `thresh` defaults to the 0.6 every earlier reading used — do NOT lower it for the pools, or the
    numbers in docs/METRICS-TUPLETS.md stop being reproducible. It exists for `--images` only: a
    SCANNED page has margins and broken staff lines, so a full-width row rarely reaches 0.6 even
    where a staff plainly is (measured 2026-08-19: 0.57 and 0.61 maxima on the owner's two scans,
    against 0.95 on a born-digital page).
    """
    rows = np.flatnonzero(bw.mean(axis=1) >= thresh)
    if rows.size < 5:
        return None
    groups, cur = [], [rows[0]]
    for y in rows[1:]:
        if y - cur[-1] <= 2:
            cur.append(y)
        else:
            groups.append(cur)
            cur = [y]
    groups.append(cur)
    if len(groups) < 5:
        return None
    sp = float(np.median(np.diff([float(np.mean(g)) for g in groups])))
    if not (8.0 <= sp <= 80.0):
        return None
    return sp, [(int(g[0]), int(g[-1])) for g in groups]


def stroke_thickness(mask: np.ndarray, x: int, w: int) -> float | None:
    """Mode of the per-column vertical ink extent — the beam-probe rule, applied to a thin curve."""
    runs = []
    for cx in range(x, x + w):
        col = np.flatnonzero(mask[:, cx])
        if col.size == 0:
            continue
        runs.append(int(col.max() - col.min() + 1))
    if len(runs) < 3:
        return None
    return float(Counter(runs).most_common(1)[0][0])


def strip_staff(bw: np.ndarray, sp: float) -> np.ndarray:
    """Erase the staff lines so components stop being one blob.

    ⚠ Needed for SCANNED pages and for nothing else. Measured 2026-08-19 on the owner's Kemânî
    Sebuh page: the arc, the digit, every notehead, both beams and all five staff lines are **ONE**
    connected component 2026 px wide, because scanned ink touches everywhere. Component logic — the
    whole method of this file — cannot say anything about such a page until the lines are gone.
    Open with a 2 S horizontal element to FIND the lines, subtract, then close vertically to rejoin
    glyphs the subtraction cut in half (a stem crossing a line, the "3" sitting on one).
    """
    b = bw.astype(np.uint8)
    lines = cv2.morphologyEx(b, cv2.MORPH_OPEN,
                             cv2.getStructuringElement(cv2.MORPH_RECT, (max(3, int(2 * sp)), 1)))
    out = cv2.subtract(b, lines)
    return cv2.morphologyEx(out, cv2.MORPH_CLOSE,
                            cv2.getStructuringElement(cv2.MORPH_RECT, (1, 5))).astype(bool)


def candidates(arr: np.ndarray, staff_thresh: float = 0.6,
               destaff: bool = False) -> tuple[float, list[dict]]:
    """Digit-like components with arc-like ink beside them. Permissive by design."""
    bw = arr < 128
    sr = staff_rows(bw, staff_thresh)
    if sr is None:
        return 0.0, []
    sp, bands = sr
    line_rows = np.zeros(bw.shape[0], bool)
    for a, b in bands:
        line_rows[max(0, a - 1) : b + 2] = True
    if destaff:
        # The lines are gone, so "does this component touch a staff line" no longer rejects
        # anything real — and it MUST not, because the concave style sets its digit ON the top line.
        bw = strip_staff(bw, sp)
        line_rows[:] = False

    n, lab, stats, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 8)
    boxes = [tuple(int(v) for v in stats[i][:4]) for i in range(1, n)]  # x, y, w, h

    # Arc-like: wide and flat, but thinner than a beam (beams survive a 7px vertical erosion).
    # ⚠ The 1.4 S height ceiling was set on BROKEN marks, where one segment is half the mark. A
    # continuous arc over a whole triplet is deeper than that — the owner's Kemânî Sebuh page
    # measures 1.65 S — so the concave path needs the taller ceiling or it rejects the very shape it
    # is looking for. Pool readings keep 1.4 exactly.
    arc_h_max = (2.5 if destaff else 1.4) * sp
    arcs = []
    for i, (x, y, w, h) in enumerate(boxes, start=1):
        if w < 0.9 * sp or w > 8 * sp or h > arc_h_max or w < 1.6 * h:
            continue
        if line_rows[y : y + h].any():
            continue
        comp = lab[y : y + h, x : x + w] == i
        t = stroke_thickness(comp, 0, w)
        if t is None or t > 0.35 * sp:  # a beam is ~0.5 S; an arc/slur is a few px
            continue
        arcs.append({"box": (x, y, w, h), "thick": t / sp})

    out = []
    for i, (x, y, w, h) in enumerate(boxes, start=1):
        if not (0.5 * sp <= h <= 1.6 * sp and 0.2 * sp <= w <= 1.0 * sp and w < h):
            continue
        if line_rows[y : y + h].any():
            continue
        cy, cx = y + h / 2, x + w / 2
        near = [
            a for a in arcs
            if abs((a["box"][1] + a["box"][3] / 2) - cy) <= 1.8 * sp
            and a["box"][0] - 3.0 * sp <= cx <= a["box"][0] + a["box"][2] + 3.0 * sp
        ]
        if not near:
            continue
        left = [a for a in near if a["box"][0] + a["box"][2] <= cx]
        right = [a for a in near if a["box"][0] >= cx]
        spanning = [a for a in near if a["box"][0] < cx < a["box"][0] + a["box"][2]]
        gap = None
        if left and right and not spanning:
            l = max(left, key=lambda a: a["box"][0] + a["box"][2])
            r = min(right, key=lambda a: a["box"][0])
            gap = (r["box"][0] - (l["box"][0] + l["box"][2])) / sp
            span = (r["box"][0] + r["box"][2] - l["box"][0]) / sp
        elif spanning:
            span = max(a["box"][2] for a in spanning) / sp
        else:
            span = max(a["box"][2] for a in near) / sp
        out.append({
            "sp": sp,
            "digit": (x, y, w, h),
            "digit_h": h / sp,
            "digit_w": w / sp,
            "segs": 0 if spanning else len(left[:1]) + len(right[:1]),
            "spanning": bool(spanning),
            "gap": gap,
            "span": span,
            "arc_thick": float(np.median([a["thick"] for a in near])),
            "arc_depth": max(a["box"][3] for a in near) / sp,
            # the digit's baseline against the arc ends: negative = digit sits ABOVE the arc line
            "digit_vs_arc": (y + h - np.median([a["box"][1] + a["box"][3] for a in near])) / sp,
        })
    return sp, out


def band_geometry(arr: np.ndarray, c: dict) -> dict | None:
    """The printed mark's geometry, measured WITHOUT classifying components.

    Component logic mis-sorts these marks (an arc that grazes a notehead merges with it), so the
    numbers that matter are taken by scanning outward from the digit along its own row band: the
    first ink to the left IS the left arc's inner end, and likewise on the right. Returns staff
    spaces throughout.
    """
    bw = arr < 128
    sp = c["sp"]
    x, y, w, h = c["digit"]
    lo, hi = max(0, int(y - 0.25 * sp)), min(bw.shape[0], int(y + h + 0.25 * sp))
    band = bw[lo:hi, :]
    band = band.copy()
    band[:, x : x + w] = False  # the digit itself out of the way

    def reach(cols: range) -> int | None:
        for cx in cols:
            if band[:, cx].any():
                return cx
        return None

    lend = reach(range(x - 1, max(-1, int(x - 3.5 * sp)), -1))
    rstart = reach(range(x + w, min(band.shape[1], int(x + w + 3.5 * sp))))
    if lend is None or rstart is None:
        return None
    # Follow each inner end out to its own component, for the segment's span and rise.
    n, lab, stats, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 8)
    def comp_at(cx: int) -> tuple[int, int, int, int] | None:
        col = np.flatnonzero(band[:, cx])
        if col.size == 0:
            return None
        i = lab[lo + int(col[0]), cx]
        return None if i == 0 else tuple(int(v) for v in stats[i][:4])
    lc, rc = comp_at(lend), comp_at(rstart)
    if lc is None or rc is None:
        return None
    return {
        "gap": (rstart - lend - 1) / sp,          # arc-end to arc-end, the hole the digit sits in
        "gap_left": (x - lend - 1) / sp,
        "gap_right": (rstart - x - w) / sp,
        "digit_h": h / sp,
        "digit_w": w / sp,
        "span": (rc[0] + rc[2] - lc[0]) / sp,     # whole mark, outer end to outer end
        "seg_w": ((lc[2] + rc[2]) / 2) / sp,      # one segment's width
        "rise": ((lc[3] + rc[3]) / 2) / sp,       # how far a segment climbs (its bbox height)
        # digit centre vs the arc's inner-end height: + = digit centre BELOW the arc ends
        "digit_vs_ends": ((y + h / 2) - (lo + int(np.flatnonzero(band[:, lend])[0]))) / sp,
    }


def concave_geometry(arr: np.ndarray, c: dict, destaff: bool = False) -> dict | None:
    """The THIRD printed style: a CONTINUOUS arc with the digit inside its concavity.

    Added 2026-08-19, after the owner supplied two real editions drawing it that way — the
    counterexample to this file's own 16/16 result (docs/METRICS-TUPLETS.md). `band_geometry` above
    cannot measure it: it scans sideways from the digit expecting to hit two arc ends, and here the
    arc is ABOVE the digit, not beside it. So the quantities are different ones —

      * `arc_above`     the vertical clearance from the digit's top to the arc's ink directly over
                        its centre. This is the number the redraw has to land on.
      * `touches`       whether digit and arc are ONE connected component. The 2026-08-12 measurement
                        found our legacy mark was — "a slur with a bump" — which is what made it
                        indistinguishable from a phrase slur. If real print keeps them separate, that
                        is the load-bearing difference and not the digit's height.
      * `digit_at`      the digit centre's position along the arc's span, 0..1. The broken style
                        measured dead centre (0.49-0.50); this style is not assumed to match.

    Returns None when the digit has no arc ink above it — i.e. this is not the concave style.
    """
    bw = arr < 128
    sp = c["sp"]
    if destaff:
        bw = strip_staff(bw, sp)
    x, y, w, h = c["digit"]
    cx = x + w // 2

    n, lab, stats, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 8)
    digit_lab = lab[y + h // 2, cx] if bw[y + h // 2, cx] else 0
    if digit_lab == 0:  # the digit's centre pixel is white (an open glyph like "3" often is)
        ys, xs = np.nonzero(bw[y : y + h, x : x + w])
        if ys.size == 0:
            return None
        digit_lab = lab[y + int(ys[0]), x + int(xs[0])]

    # First ink ABOVE the digit, in a narrow column band around its centre, skipping the digit itself.
    top = max(0, int(y - 2.5 * sp))
    band = bw[top:y, max(0, cx - int(0.15 * sp)) : cx + int(0.15 * sp) + 1]
    rows_with_ink = np.flatnonzero(band.any(axis=1))
    if rows_with_ink.size == 0:
        return None
    arc_y = top + int(rows_with_ink[-1])          # the LOWEST ink above the digit = the arc's underside
    arc_lab = lab[arc_y, cx] if bw[arc_y, cx] else 0
    if arc_lab == 0:
        col = np.flatnonzero(bw[arc_y, max(0, cx - int(0.15 * sp)) : cx + int(0.15 * sp) + 1])
        if col.size:
            arc_lab = lab[arc_y, max(0, cx - int(0.15 * sp)) + int(col[0])]
    if arc_lab == 0:
        return None
    ax, ay, aw, ah = (int(v) for v in stats[arc_lab][:4])
    thick = stroke_thickness(lab[ay : ay + ah, ax : ax + aw] == arc_lab, 0, aw)
    return {
        "arc_above": (y - arc_y) / sp,
        "touches": bool(arc_lab == digit_lab),
        "digit_at": float((cx - ax) / aw) if aw else float("nan"),
        "span": aw / sp,
        "arc_depth": ah / sp,
        "arc_thick": (thick / sp) if thick else float("nan"),
        "digit_h": h / sp,
        "digit_w": w / sp,
    }


def donut_scale(w: int, h: int) -> float:
    """Fraction of original size the encoder sees. Same geometry as beam_weight_probe.donut_scale."""
    rot = (h < w and SIZE_H > SIZE_W) or (h > w and SIZE_H < SIZE_W)
    rw, rh = (h, w) if rot else (w, h)
    return min(SIZE_W / rw, SIZE_H / rh)


def tiles_for(path: Path, c: dict, idx: int) -> Image.Image:
    """One row of the sheet: the mark zoomed, with a ruler, beside what the encoder sees."""
    im = Image.open(path).convert("L")
    sp = c["sp"]
    x, y, w, h = c["digit"]
    box = (
        max(0, int(x + w / 2 - 3.5 * sp)), max(0, int(y + h / 2 - 2.2 * sp)),
        min(im.width, int(x + w / 2 + 3.5 * sp)), min(im.height, int(y + h / 2 + 2.2 * sp)),
    )
    zoom = im.crop(box).resize(
        ((box[2] - box[0]) * ZOOM, (box[3] - box[1]) * ZOOM), Image.NEAREST
    )

    # The same window after the encoder's resize, blown back up so a human can see what survived.
    s = donut_scale(im.width, im.height)
    small = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    sbox = tuple(int(round(v * s)) for v in box)
    sbox = (sbox[0], sbox[1], max(sbox[0] + 1, sbox[2]), max(sbox[1] + 1, sbox[3]))
    enc = small.crop(sbox)
    enc = enc.resize(
        (int(enc.width * ZOOM / s), int(enc.height * ZOOM / s)), Image.NEAREST
    )

    pad, label_h = 8, 16
    row = Image.new("L", (zoom.width + enc.width + 3 * pad, max(zoom.height, enc.height) + label_h + pad), 255)
    row.paste(zoom, (pad, label_h))
    row.paste(enc, (zoom.width + 2 * pad, label_h))
    d = ImageDraw.Draw(row)
    d.text((pad, 2), f"#{idx}  {path.name[:56]}   left: 4x zoom   right: post-encoder", fill=0)
    # Ruler: one staff space per tick, along the bottom of the zoom tile.
    ybar = label_h + zoom.height - 3
    for k in range(0, 8):
        px = pad + int(k * sp * ZOOM)
        if px < pad + zoom.width:
            d.line([(px, ybar), (px, ybar - (7 if k % 1 == 0 else 4))], fill=0)
    d.line([(pad, ybar), (pad + int(7 * sp * ZOOM), ybar)], fill=0)
    return row


def loose_images(spec: str) -> list[tuple[Path, str]]:
    """Every PNG/JPG under a directory (or one file) — pages, not strips, so no manifest and no
    `\\tup3` filter. Added 2026-08-19 for `data/real/tuplet_marks/`, where the evidence for the third
    mark style lives: those are full-page screenshots the owner supplied, not pool members.
    ⚠ Nothing here is labelled, so every number this mode prints is descriptive of the PICTURE only —
    a human still reads the tiles before any of it is quoted."""
    p = Path(spec)
    files = sorted(
        [p] if p.is_file()
        else [q for q in p.iterdir() if q.suffix.lower() in {".png", ".jpg", ".jpeg"}]
    )
    return [(q, "") for q in files]


def images(pool: Path, n: int, seed: int) -> list[tuple[Path, str]]:
    """(path, label) for strips whose label carries a triplet — the only ones with a mark to measure."""
    mf = pool / "manifest.jsonl"
    recs = [json.loads(l) for l in mf.read_text().splitlines() if l.strip()] if mf.exists() else []
    paths = []
    for r in recs:
        if "\\tup3" not in r.get("label", ""):
            continue
        p = Path(r["image"])
        p = p if p.is_absolute() else pool / r["image"]
        if p.exists():
            paths.append((p, r["label"]))
    random.Random(seed).shuffle(paths)
    return paths[:n]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=40, help="tuplet-bearing strips sampled per pool")
    ap.add_argument("--tiles", type=int, default=14, help="candidate tiles written per pool")
    ap.add_argument("--pool", default=None, help="only this pool")
    ap.add_argument("--dir", default=None,
                    help="measure an arbitrary strips dir instead of the pools — e.g. a pilot render, "
                         "to check a redraw landed on the measured geometry")
    ap.add_argument("--images", default=None,
                    help="measure loose PAGE images (a dir or one file) instead of a strip pool — "
                         "e.g. data/real/tuplet_marks. Implies --concave reporting")
    ap.add_argument("--destaff", action="store_true",
                    help="erase the staff lines before finding components. Implied by --images; a "
                         "scanned page is otherwise ONE component and nothing can be measured")
    ap.add_argument("--staff-thresh", type=float, default=0.6,
                    help="row-ink fraction that counts as a staff line. LEAVE AT 0.6 for the pools; "
                         "a scanned page with margins needs ~0.45 (see staff_rows)")
    ap.add_argument("--concave", action="store_true",
                    help="report the CONTINUOUS-arc/digit-in-the-concavity geometry (the third style, "
                         "docs/rung3/tuplets.md) instead of the broken-arc one")
    ap.add_argument("--accept", default=None,
                    help="comma list of tile indices a HUMAN confirmed are tuplet marks; prints the "
                         "geometry summary over those only (same -n/--seed → same indices)")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    accept = {int(v) for v in args.accept.split(",")} if args.accept else None

    OUT.mkdir(parents=True, exist_ok=True)
    concave = args.concave or args.images is not None
    destaff = args.destaff or args.images is not None
    if args.images:
        pools = {f"images {Path(args.images).name}": Path(args.images)}
    elif args.dir:
        pools = {f"dir {Path(args.dir).name}": Path(args.dir)}
    else:
        pools = POOLS
    for name, pool in pools.items():
        if args.pool and args.pool != name:
            continue
        if not pool.exists():
            print(f"{name}: missing {pool}")
            continue
        picks = loose_images(args.images) if args.images else images(pool, args.n, args.seed)
        found: list[tuple[dict, Path]] = []
        for p, _label in picks:
            arr = np.asarray(Image.open(p).convert("L"))
            sp, cs = candidates(arr, args.staff_thresh, destaff)
            if args.images:
                print(f"   {p.name[:48]:48} staff spacing {sp:.1f} px, {len(cs)} candidates")
            found += [(c, p) for c in cs]
        print(f"\n=== {name}: {len(picks)} strips with \\tup3, {len(found)} digit-like candidates")
        print(f"{'#':>3} {'segs':>4} {'gap S':>6} {'span S':>6} {'digit hxw S':>12} "
              f"{'arc S':>6} {'depth S':>7} {'dig-arc S':>9}  file")
        for i, (c, p) in enumerate(found[: args.tiles]):
            gap = f"{c['gap']:.2f}" if c["gap"] is not None else "  -  "
            print(f"{i:>3} {c['segs']:>4} {gap:>6} {c['span']:>6.2f} "
                  f"{c['digit_h']:>5.2f}x{c['digit_w']:<6.2f} {c['arc_thick']:>6.3f} "
                  f"{c['arc_depth']:>7.2f} {c['digit_vs_arc']:>9.2f}  {p.name[:44]}")
        if not found:
            continue

        if accept is not None and concave:
            keep = [(c, p) for i, (c, p) in enumerate(found[: args.tiles]) if i in accept]
            print(f"\n--- CONCAVE geometry over the {len(keep)} HUMAN-CONFIRMED marks (staff spaces)")
            print(f"{'#':>3} {'arc above':>9} {'touches':>7} {'digit at':>8} {'span':>5} "
                  f"{'depth':>5} {'arc S':>6} {'digit h':>7} {'digit w':>7}  file")
            gs = []
            for i, (c, p) in zip(sorted(accept), keep):
                g = concave_geometry(np.asarray(Image.open(p).convert("L")), c, destaff)
                if g is None:
                    print(f"{i:>3}   (no arc ink above the digit — not the concave style)")
                    continue
                gs.append(g)
                print(f"{i:>3} {g['arc_above']:>9.2f} {str(g['touches']):>7} {g['digit_at']:>8.2f} "
                      f"{g['span']:>5.2f} {g['arc_depth']:>5.2f} {g['arc_thick']:>6.3f} "
                      f"{g['digit_h']:>7.2f} {g['digit_w']:>7.2f}  {p.name[:30]}")
            if gs:
                print(f"\n{'median':>3}", end=" ")
                for k in ("arc_above", "digit_at", "span", "arc_depth", "arc_thick", "digit_h", "digit_w"):
                    print(f"{k}={np.nanmedian([g[k] for g in gs]):.2f}", end="  ")
                print(f"\n(n={len(gs)} marks; digit and arc are ONE component in "
                      f"{sum(g['touches'] for g in gs)} of them)")
        elif accept is not None:
            keep = [(c, p) for i, (c, p) in enumerate(found[: args.tiles]) if i in accept]
            print(f"\n--- geometry over the {len(keep)} HUMAN-CONFIRMED marks (staff spaces)")
            print(f"{'#':>3} {'gap':>5} {'gapL':>5} {'gapR':>5} {'digit h':>7} {'digit w':>7} "
                  f"{'span':>5} {'seg w':>5} {'rise':>5} {'dig vs ends':>11}  file")
            gs: list[dict] = []
            for i, (c, p) in zip(sorted(accept), keep):
                g = band_geometry(np.asarray(Image.open(p).convert("L")), c)
                if g is None:
                    print(f"{i:>3}   (no ink either side within 3.5 S — check the tile)")
                    continue
                gs.append(g)
                print(f"{i:>3} {g['gap']:>5.2f} {g['gap_left']:>5.2f} {g['gap_right']:>5.2f} "
                      f"{g['digit_h']:>7.2f} {g['digit_w']:>7.2f} {g['span']:>5.2f} "
                      f"{g['seg_w']:>5.2f} {g['rise']:>5.2f} {g['digit_vs_ends']:>11.2f}  {p.name[:34]}")
            if gs:
                print(f"\n{'median':>3}", end=" ")
                for k in ("gap", "gap_left", "gap_right", "digit_h", "digit_w", "span", "seg_w",
                          "rise", "digit_vs_ends"):
                    print(f"{k}={np.median([g[k] for g in gs]):.2f}", end="  ")
                print(f"\n(n={len(gs)} marks; gap is a fraction {np.median([g['gap']/g['span'] for g in gs]):.2f} "
                      f"of the mark's span)")

        rows = [tiles_for(p, c, i) for i, (c, p) in enumerate(found[: args.tiles])]
        W = max(r.width for r in rows)
        sheet = Image.new("L", (W, sum(r.height + 6 for r in rows)), 255)
        y = 0
        for r in rows:
            sheet.paste(r, (0, y))
            y += r.height + 6
        slug = "_".join(w.strip("()") for w in name.split()[:2])
        out = OUT / f"marks_{slug}.png"
        sheet.save(out)
        print(f"LOOK AT THIS before quoting any number: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
