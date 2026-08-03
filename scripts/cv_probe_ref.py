"""W0 — reference numbers for the opencv.js primitive-parity probe.

The browser slicer port (docs plan W0-W6) must reproduce `src/vision/page_to_strips.py` exactly.
Before porting 1,000 lines, prove the four primitives it rests on behave identically in
opencv.js: Otsu threshold, MORPH_OPEN row projection, connectedComponents, and INTER_AREA resize
— plus the PNG->grayscale decode that feeds all of them, which is the least obvious divergence
source (colour management, premultiplied alpha).

This writes the Python side of that comparison. The browser side is apps/web/src/probe/cvProbe.ts.
Both are THROWAWAY and are deleted once the slicer reaches parity (W6).

    .venv-ml/bin/python scripts/cv_probe_ref.py <page.png> --out apps/web/public/probe
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.vision.page_to_strips import (  # noqa: E402
    STAFF_HOR_FRAC,
    STRIP_H,
    binarize_ink,
    load_gray,
)

# A fixed, page-independent crop+resize spec, so the INTER_AREA check does not depend on staff
# detection (which is exactly what W4 has yet to port). Non-integer scale in both axes on purpose.
RESIZE_CROP_TOP = 100
RESIZE_CROP_ROWS = 400
RESIZE_W_FRAC = 0.55


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--out", default="apps/web/public/probe")
    args = ap.parse_args()

    page = Path(args.page)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    gray = load_gray(page)
    h, w = gray.shape

    # 1. grayscale decode ---------------------------------------------------------------------
    # Dumped raw so the browser can diff its own PNG->canvas->gray against cv2.imread's.
    (out / "gray.bin").write_bytes(gray.tobytes())

    # 2. Otsu ----------------------------------------------------------------------------------
    # binarize_ink() discards the threshold value, so recompute it the same way to report it.
    otsu_thr, _ = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ink = binarize_ink(gray)
    ink_count = int((ink > 0).sum())

    # 3. MORPH_OPEN row projection -------------------------------------------------------------
    # page_to_strips.detect_staves L314-318, verbatim.
    hor_len = max(20, int(w * STAFF_HOR_FRAC))
    horiz = cv2.morphologyEx(
        ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (hor_len, 1))
    )
    row_ink = horiz.sum(axis=1) / 255.0

    # 4. connectedComponents -------------------------------------------------------------------
    # page_to_strips L969: 8-connectivity on the ink mask.
    n_labels, _ = cv2.connectedComponents(ink, connectivity=8)

    # 5. INTER_AREA ----------------------------------------------------------------------------
    crop = gray[RESIZE_CROP_TOP:RESIZE_CROP_TOP + RESIZE_CROP_ROWS, :]
    new_w = max(1, int(round(crop.shape[1] * RESIZE_W_FRAC)))
    resized = cv2.resize(crop, (new_w, STRIP_H), interpolation=cv2.INTER_AREA)
    col_sums = resized.astype(np.int64).sum(axis=0)

    ref = {
        "page": str(page),
        "width": int(w),
        "height": int(h),
        "grayBytes": int(gray.size),
        "graySha256": hashlib.sha256(gray.tobytes()).hexdigest(),
        "otsuThreshold": float(otsu_thr),
        "inkCount": ink_count,
        "horLen": int(hor_len),
        "rowInk": [float(v) for v in row_ink],
        "ccLabelCount": int(n_labels),
        "resize": {
            "cropTop": RESIZE_CROP_TOP,
            "cropRows": RESIZE_CROP_ROWS,
            "newW": int(new_w),
            "newH": int(STRIP_H),
            "colSums": [int(v) for v in col_sums],
        },
    }
    (out / "ref.json").write_text(json.dumps(ref))

    # The browser needs the page itself to decode.
    (out / "page.png").write_bytes(page.read_bytes())

    print(f"page        {page}  {w}x{h}")
    print(f"otsu        {otsu_thr}")
    print(f"ink         {ink_count} px")
    print(f"hor_len     {hor_len}")
    print(f"cc labels   {n_labels}")
    print(f"resize      {crop.shape[1]}x{crop.shape[0]} -> {new_w}x{STRIP_H}")
    print(f"wrote       {out}/ref.json, gray.bin ({gray.size} B), page.png")


if __name__ == "__main__":
    main()
