r"""Round-3 Check C — are our beams and flags the weight real print uses?

THE GAP THIS FILLS (docs/rung3/round3.md §2). Note-length errors are 28% of everything a user has
to fix, and they are lopsided: 15 of them are "the model read the note as twice as long as it is",
i.e. it missed a beam or a flag. We proved exactly this story once before for the microtonal sharps
— Bravura draws a 0.367 S bar where real print draws 0.300 S, and after the encoder's shrink the
extra weight fused küçük's three bars into a koma's two. That was fixed (`drawThinSharps`).
Nobody has ever measured the beams, the flags or the dots.

WHY THIS EXISTS SEPARATELY FROM domain_gap.py. `domain_gap.py` reports `beam_span_px`, and its own
docstring forbids comparing that column against the real pools: on scans the detector loses broken
beams and catches fat noteheads, so it under-reports there. It measures LENGTH anyway. This measures
THICKNESS, which is the quantity the sharp finding was about and the one the encoder shrink acts on.

METHOD, and why it is this one. A beam merges with its stems and noteheads into a single connected
component, so component height is not beam thickness. But in the columns strictly BETWEEN two stems
the only ink present IS the beam. So: locate beams as wide flat runs (the `domain_gap.beam_spans`
rule), then take the MODE of the vertical ink extent across each beam's columns — between-stem
columns dominate the count, and the mode ignores the stem columns entirely.

Everything is reported in STAFF SPACES (S), never pixels, so synthetic and real are comparable at
whatever scale each was normalised to. Engraving convention puts a beam at 0.5 S.

THE EYEBALL SHEET IS NOT OPTIONAL. Two detectors in this round's earlier checks failed silently and
were only caught by looking at contact sheets. This writes matched-staff-size crops of the thickest
and thinnest beams it measured, plus the post-encoder view (`sharp_probe.py`'s Donut geometry, which
is what the model actually sees). Confirm the number against the picture before quoting it.

Usage:
    .venv-ml/bin/python scripts/rung3/beam_weight_probe.py
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data/real/rung3/beam_probe"

POOLS = {
    "synth_v4 (control)": ROOT / "data/synthetic/_pilot_v4_control",
    "synth_v5 (pilot)": ROOT / "data/synthetic/_pilot_v5",
    "real exam": ROOT / "data/real/rung3/strips_exam_v2_clean",
    "real nota": ROOT / "data/real/rung3/strips_nota",
}

# Donut preprocessing box, from preprocessor_config.json — same constants sharp_probe.py uses.
SIZE_W, SIZE_H = 409, 583


def staff_spacing(bw: np.ndarray) -> float | None:
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
    return sp if 8.0 <= sp <= 80.0 else None


def beam_thicknesses(img: np.ndarray) -> list[float]:
    """Beam thickness in staff spaces, one entry per beam found in this strip."""
    bw = img < 128
    sp = staff_spacing(bw)
    if sp is None:
        return []
    glyph = bw.copy()
    glyph[bw.mean(axis=1) >= 0.6] = False               # staff-line rows out
    # Erode vertically so slurs, ties and volta rules (a few px thick) disappear and only the
    # genuinely thick horizontal strokes survive — the domain_gap.beam_spans rule.
    er = cv2.erode(glyph.astype(np.uint8), np.ones((7, 1), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(er, 8)
    out = []
    for i in range(1, n):
        x, y, w, h, _ = stats[i]
        if not (w >= 1.8 * sp and w > 3.0 * h and w < 0.92 * bw.shape[1]):
            continue
        # Vertical ink extent per column, measured on the UNERODED glyph mask so the beam keeps
        # its true thickness (the erosion was only ever a locator).
        runs = []
        for cx in range(x, x + w):
            col = np.flatnonzero(glyph[:, cx])
            if col.size == 0:
                continue
            near = col[(col >= y - 2 * sp) & (col <= y + h + 2 * sp)]
            if near.size == 0:
                continue
            ext = near.max() - near.min() + 1
            if ext > 2.0 * sp:            # a stem column, or a stack of several beams — skip
                continue
            runs.append(int(ext))
        if len(runs) < 5:
            continue
        mode = Counter(runs).most_common(1)[0][0]
        out.append(mode / sp)
    return out


def donut_scale(w: int, h: int) -> float:
    """Fraction of original size the encoder sees. Same geometry as sharp_probe.donut_geom."""
    rot = (h < w and SIZE_H > SIZE_W) or (h > w and SIZE_H < SIZE_W)
    rw, rh = (h, w) if rot else (w, h)
    return min(SIZE_W / rw, SIZE_H / rh)


def images(pool: Path, n: int, seed: int) -> list[Path]:
    mf = pool / "manifest.jsonl"
    if mf.exists():
        recs = [json.loads(l) for l in mf.read_text().splitlines() if l.strip()]
        paths = []
        for r in recs:
            p = Path(r["image"])
            paths.append(p if p.is_absolute() else pool / r["image"])
    else:
        paths = sorted(pool.rglob("*.png"))
    paths = [p for p in paths if p.exists()]
    random.Random(seed).shuffle(paths)
    return paths[:n]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=250, help="strips sampled per pool")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    print(f"{'pool':>20} {'strips':>7} {'beams':>7} {'median S':>9} {'mean S':>8} "
          f"{'p10':>6} {'p90':>6} {'thin<0.4S':>10}")
    print("-" * 82)
    samples: dict[str, list[tuple[float, Path]]] = {}
    for name, pool in POOLS.items():
        if not pool.exists():
            print(f"{name:>20}   (missing {pool})")
            continue
        vals: list[tuple[float, Path]] = []
        used = 0
        for p in images(pool, args.n, args.seed):
            arr = np.asarray(Image.open(p).convert("L"))
            ts = beam_thicknesses(arr)
            if ts:
                used += 1
                vals += [(t, p) for t in ts]
        samples[name] = vals
        if not vals:
            print(f"{name:>20} {used:>7} {0:>7}")
            continue
        a = np.array([v for v, _ in vals])
        print(f"{name:>20} {used:>7} {a.size:>7} {np.median(a):>9.3f} {a.mean():>8.3f} "
              f"{np.percentile(a,10):>6.3f} {np.percentile(a,90):>6.3f} "
              f"{100*np.mean(a<0.4):>9.1f}%")

    print("\nEngraving convention puts a beam at 0.500 S. A synthetic beam materially THICKER than")
    print("real print is the same failure mode as the sharp bars: after the encoder shrink, the gap")
    print("between two stacked beams (16th notes) closes and the pair reads as one.")

    # What the encoder actually sees, per pool — thickness x that pool's typical shrink.
    print("\npost-encoder beam thickness (staff spaces x median Donut scale):")
    for name, pool in POOLS.items():
        vals = samples.get(name) or []
        if not vals:
            continue
        scales = []
        for p in {p for _, p in vals}:
            w, h = Image.open(p).size
            scales.append(donut_scale(w, h))
        med_scale = float(np.median(scales))
        med_t = float(np.median([v for v, _ in vals]))
        sp_px = 30.0                      # strips are normalised to TARGET_SPACING
        print(f"  {name:>20}  scale {med_scale:.3f}  ->  {med_t*sp_px*med_scale:5.2f} px on screen")

    # Eyeball sheet: thickest and thinnest measured beam per pool, at matched staff size.
    tiles = []
    for name, vals in samples.items():
        if not vals:
            continue
        vals_sorted = sorted(vals, key=lambda v: v[0])
        for tag, (t, p) in (("thin", vals_sorted[0]), ("thick", vals_sorted[-1])):
            im = Image.open(p).convert("L")
            tiles.append((f"{name} {tag} {t:.2f}S", im.crop((0, 0, min(700, im.width), im.height))))
    if tiles:
        W = max(im.width for _, im in tiles)
        H = sum(im.height + 14 for _, im in tiles)
        sheet = Image.new("L", (W, H), 255)
        y = 0
        for _, im in tiles:
            sheet.paste(im, (0, y))
            y += im.height + 14
        sheet.save(OUT / "beam_eyeball.png")
        print(f"\nLOOK AT THIS before quoting any number: {OUT/'beam_eyeball.png'}")
        for i, (lab, _) in enumerate(tiles):
            print(f"  tile {i}: {lab}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
