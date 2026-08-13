r"""The tuplet mark, side by side: real edition vs what we drew vs what we draw now.

WHY IT EXISTS (docs/rung3/tuplets.md step 2). A renderer change aimed at real print is a DOMAIN
JUDGEMENT before it is a measurement, so the shape goes in front of the owner beside a real page
before anything is re-rendered at scale. `tuplet_mark_probe.py` says whether we hit the numbers; this
says whether it looks like print. It also carries the pre-registered shrink check: if the "3" fuses
with the arc ends in the right-hand column, the GAP widens — the digit never shrinks.

All three rows are the SAME PIECE and (for ours) the same strip id, so nothing in the picture varies
except the thing under test. Left column: 2x zoom at matched staff size. Right: the same window as
the ENCODER sees it (the 409x583 Donut resize), blown back up.

⚠ The real row is a third-party printed edition — this sheet is for looking at locally, never for
publishing (docs/THIRD-PARTY.md).

Usage:
    .venv-ml/bin/python scripts/rung3/tuplet_mark_sheet.py
    → data/real/rung3/tuplet_probe/mark_comparison.png
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tuplet_mark_probe import staff_rows, donut_scale  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ROWS = [
    ("REAL EDITION — cok_yasa, neyzen page (strips_tup)",
     "data/real/rung3/strips_tup/cok_yasa_ayse_ney_p1_s06_w02.png"),
    ("OURS BEFORE — same piece, strip m49-49 (strips_v4)",
     "data/synthetic/strips_v4/hicaz--sarki--nimsofyan--cok_yasa--muhlis_sabahaddin_c0_measure_m49-49.png"),
    ("OURS NOW — the same strip, re-rendered (_pilot_tuplet_arc)",
     "data/synthetic/_pilot_tuplet_arc/hicaz--sarki--nimsofyan--cok_yasa--muhlis_sabahaddin_c0_measure_m49-49.png"),
]
ZOOM, WIN_W, WIN_H, ABOVE = 2, 12.5, 6.2, 1.6  # staff spaces


def find_mark(arr: np.ndarray, sp: float, top: int) -> tuple[int, int, int, int] | None:
    """The tuplet mark's bounding box — centred on the "3" whenever the "3" is its own component.

    Three shapes have to be found by one rule. In the OLD style the digit TOUCHES the arc apex, so mark
    and digit are a single blob (which is itself part of the finding). In the NEW one the arms follow
    the notes, so they dip level with the staff and "everything above the staff" no longer bounds the
    mark. So: prefer a digit-shaped component that has thin ink beside it, else any digit-shaped
    component, else the widest thing clear of the staff.
    """
    bw = arr < 128
    n, _lab, stats, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 8)
    boxes = [tuple(int(v) for v in stats[i][:4]) for i in range(1, n)]
    digits = [b for b in boxes
              if 0.9 * sp <= b[3] <= 1.5 * sp and 0.4 * sp <= b[2] <= 1.2 * sp and b[2] < b[3]
              and b[1] + b[3] <= top + 0.5 * sp]
    thin = [b for b in boxes if b[2] >= 0.8 * sp and b[3] <= 1.8 * sp and b[2] > 1.3 * b[3]]
    flanked = [d for d in digits
               if any(abs((t[1] + t[3] / 2) - (d[1] + d[3] / 2)) <= 2.2 * sp
                      and abs((t[0] + t[2] / 2) - (d[0] + d[2] / 2)) <= 4 * sp for t in thin)]
    anchor = None
    for pick in (flanked, digits):
        if pick:
            anchor = min(pick, key=lambda b: abs(b[0] + b[2] / 2 - arr.shape[1] / 2))
            break
    if anchor is None:
        above = [b for b in boxes if b[1] + b[3] <= top and b[3] <= 2.5 * sp]
        if not above:
            return None
        anchor = max(above, key=lambda b: b[2])
    acx = anchor[0] + anchor[2] / 2
    near = [b for b in boxes
            if b[3] <= 2.5 * sp and abs(b[0] + b[2] / 2 - acx) <= 4 * sp and b[1] <= top + sp]
    x0 = min(b[0] for b in near)
    y0 = min(b[1] for b in near)
    return (x0, y0, max(b[0] + b[2] for b in near) - x0, max(b[1] + b[3] for b in near) - y0)


def row_image(label: str, path: str, font) -> Image.Image:
    im = Image.open(ROOT / path).convert("L")
    arr = np.asarray(im)
    sr = staff_rows(arr < 128)
    assert sr, path
    sp, bands = sr
    d = find_mark(arr, sp, bands[0][0])
    assert d, f"no mark found in {path}"
    x, y, w, h = d
    cx = x + w / 2
    box = (max(0, int(cx - WIN_W * sp / 2)), max(0, int(y - ABOVE * sp)),
           min(im.width, int(cx + WIN_W * sp / 2)), min(im.height, int(y - ABOVE * sp + WIN_H * sp)))
    zoom = im.crop(box).resize(((box[2] - box[0]) * ZOOM, (box[3] - box[1]) * ZOOM), Image.NEAREST)

    s = donut_scale(im.width, im.height)
    small = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    sb = tuple(int(round(v * s)) for v in box)
    enc = small.crop((sb[0], sb[1], max(sb[0] + 1, sb[2]), max(sb[1] + 1, sb[3])))
    enc = enc.resize((zoom.width, int(enc.height * zoom.width / enc.width)), Image.NEAREST)

    pad, lab_h = 10, 34
    row = Image.new("L", (zoom.width + enc.width + 3 * pad,
                          max(zoom.height, enc.height) + lab_h + pad), 255)
    row.paste(zoom, (pad, lab_h))
    row.paste(enc, (zoom.width + 2 * pad, lab_h))
    dr = ImageDraw.Draw(row)
    dr.text((pad, 6), f"{label}      [left: 2x, matched staff size]      "
                      f"[right: as the model sees it, 409x583]", fill=0, font=font)
    dr.line([(pad, lab_h - 3), (row.width - pad, lab_h - 3)], fill=190)
    return row


def main() -> int:
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 19)
    except OSError:
        font = ImageFont.load_default()
    rows = [row_image(lab, p, font) for lab, p in ROWS]
    W = max(r.width for r in rows)
    head = 82
    sheet = Image.new("L", (W, head + sum(r.height + 10 for r in rows)), 255)
    dr = ImageDraw.Draw(sheet)
    dr.text((10, 8), "The triplet mark: real print vs what we drew vs what we draw now "
                     "(same piece, same strip)", fill=0, font=font)
    dr.text((10, 32), "measured, in staff spaces — gap 1.63 (real 1.63) | digit 0.70 x 1.20 "
                      "(real 0.76 x 1.20)", fill=0, font=font)
    dr.text((10, 52), "each arm clears its OWN end note by 0.85 (real 0.60-0.93) | the gap sits 1.43 "
                      "over the highest note (real 1.43)", fill=0, font=font)
    y = head
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height + 10
    out = ROOT / "data/real/rung3/tuplet_probe/mark_comparison.png"
    sheet.save(out)
    print(f"wrote {out}  ({sheet.width}x{sheet.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
