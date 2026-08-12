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


def staff_rows(bw: np.ndarray) -> tuple[float, list[tuple[int, int]]] | None:
    """(staff spacing, staff-line row bands). Same rule as beam_weight_probe.staff_spacing."""
    rows = np.flatnonzero(bw.mean(axis=1) >= 0.6)
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


def candidates(arr: np.ndarray) -> tuple[float, list[dict]]:
    """Digit-like components with arc-like ink beside them. Permissive by design."""
    bw = arr < 128
    sr = staff_rows(bw)
    if sr is None:
        return 0.0, []
    sp, bands = sr
    line_rows = np.zeros(bw.shape[0], bool)
    for a, b in bands:
        line_rows[max(0, a - 1) : b + 2] = True

    n, lab, stats, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 8)
    boxes = [tuple(int(v) for v in stats[i][:4]) for i in range(1, n)]  # x, y, w, h

    # Arc-like: wide and flat, but thinner than a beam (beams survive a 7px vertical erosion).
    arcs = []
    for i, (x, y, w, h) in enumerate(boxes, start=1):
        if w < 0.9 * sp or w > 8 * sp or h > 1.4 * sp or w < 1.6 * h:
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
    ap.add_argument("--accept", default=None,
                    help="comma list of tile indices a HUMAN confirmed are tuplet marks; prints the "
                         "geometry summary over those only (same -n/--seed → same indices)")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    accept = {int(v) for v in args.accept.split(",")} if args.accept else None

    OUT.mkdir(parents=True, exist_ok=True)
    for name, pool in POOLS.items():
        if args.pool and args.pool != name:
            continue
        if not pool.exists():
            print(f"{name}: missing {pool}")
            continue
        picks = images(pool, args.n, args.seed)
        found: list[tuple[dict, Path]] = []
        for p, _label in picks:
            arr = np.asarray(Image.open(p).convert("L"))
            _sp, cs = candidates(arr)
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

        if accept is not None:
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
        slug = name.split()[0] + "_" + name.split()[1].strip("()")
        out = OUT / f"marks_{slug}.png"
        sheet.save(out)
        print(f"LOOK AT THIS before quoting any number: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
