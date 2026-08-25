#!/usr/bin/env python3
"""Cut the hand-marking sheets for BARLINE GROUND TRUTH — where the barlines actually are.

Why this exists
---------------
Every barline number this project has is a count of what `detect_barlines` DID, never of what it
should have done. `score_slicer.py` comes closest, but its truth is a per-row MEASURE COUNT aligned
from the old pipeline's decodes, so it cannot say *which* barline was missed, cannot see a row that
pipeline never read, and cannot charge for a false barline that splits a measure evenly. On
2026-08-25 the gap bit twice in one session: barline x-positions read off a 2x preview produced an
arithmetic error and a retracted finding ("the ink is absent from the mask" — it was not).

So: the owner clicks the real barlines, and `score_barlines.py` turns every gate into precision and
recall on rows where we know the answer.

⚠ THE SHEETS DELIBERATELY DO NOT SHOW WHAT THE SLICER FOUND. Same rule as the exam gold: a marker
shown the detector's answer anchors to it, and an error the eye lets past becomes "truth". The
overlay in `data/real/debug/.../<page>_debug.png` is for diagnosis AFTER marking, never during.

⚠ COORDINATES ARE DESKEWED-PAGE COORDINATES, not raw-file ones. The sheets are cut from
`prep_page()`'s output, which is the image `detect_staves` / `detect_barlines` actually see, so a
marked x needs no transform to be compared against a detected one. A raw-file crop would be off by
the deskew, which is 0.3-0.5 deg on these pages — several px at the ends of a row.

Run:
    .venv-ml/bin/python scripts/rung3/build_barline_truth.py            # the default 4 pages
    .venv-ml/bin/python scripts/rung3/build_barline_truth.py --pages a.png b.png
    open data/real/rung3/_barline_truth/mark.html                       # click, then Save
    .venv-ml/bin/python scripts/rung3/score_barlines.py                 # once the JSON is saved
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "src" / "vision"))

import page_to_strips as P  # noqa: E402

# The four faded pages the owner flagged, ranked by rows the slicer cuts by WIDTH because it found
# no barline at all (`02-yeni-slicer` manifests, 2026-08-25). bozukNihavendLonga is the page the
# report started from; the other three are the worst of the rest.
DEFAULT_PAGES = [
    "bozukNihavendLonga.png",
    "data/real/images/mahur/gafil_ne_bilir_nesve_i_pur_sevk_i_vegayi_1_nota_p1.png",
    "data/real/images/mahur/aman_saki_lutfuna_amadeyim_nota_p1.png",
    "data/real/images/nikriz/meclis_imeydesakiyapdf1571218833_nota_p1.png",
]

ZOOM = 2          # sheets are cut at 2x so a faint bar survives the resample; the page scales it
PAD_SP = 3.0      # line-spaces of paper kept above and below the staff, so a bar's ends are visible


def build(pages: list[str], out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "rows").mkdir(exist_ok=True)
    index: list[dict] = []
    for rel in pages:
        path = REPO / rel
        if not path.exists():
            print(f"  !! missing {rel}")
            continue
        stem = path.stem
        gray, _, skew = P.prep_page(P.load_gray(path))
        ink = P.page_binarizer(gray)(gray)
        staves = P.detect_staves(ink)
        for si, st in enumerate(staves):
            pad = int(round(PAD_SP * st.spacing))
            y0, y1 = max(0, st.top - pad), min(gray.shape[0], st.bottom + pad)
            crop = gray[y0:y1, :]
            big = cv2.resize(crop, (crop.shape[1] * ZOOM, crop.shape[0] * ZOOM),
                             interpolation=cv2.INTER_CUBIC)
            name = f"{stem}_s{si:02d}.png"
            cv2.imwrite(str(out_dir / "rows" / name), big)
            index.append({
                "page": stem, "system": si, "img": f"rows/{name}",
                "zoom": ZOOM, "page_w": int(gray.shape[1]),
                # where the staff sits inside the sheet, so the marker can see the band it is
                # judging without being told where the BARLINES are
                "staff_top": int(st.top - y0), "staff_bot": int(st.bottom - y0),
                "spacing": round(float(st.spacing), 2), "skew": round(float(skew), 2),
            })
        print(f"  {stem}: {len(staves)} rows")
    (out_dir / "index.json").write_text(json.dumps(index, indent=1))
    return {"rows": len(index), "pages": len({r['page'] for r in index})}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", nargs="*", default=DEFAULT_PAGES)
    ap.add_argument("--out", default="data/real/rung3/_barline_truth")
    args = ap.parse_args()
    out = REPO / args.out
    got = build(args.pages, out)
    # Inline the row list. A browser refuses `fetch` from a file:// page, so a copied-as-is
    # mark.html renders BLANK with nothing in the console to explain it (measured 2026-08-25, the
    # first time the owner opened it). `<img src>` is not subject to that, so the sheets still load.
    html = (Path(__file__).parent / "barline_mark.html").read_text()
    rows_js = json.dumps(json.loads((out / "index.json").read_text()))
    html = html.replace("<script>",
                        f"<script>window.__BARLINE_ROWS__ = {rows_js};</script>\n<script>", 1)
    (out / "mark.html").write_text(html)
    print(f"\n{got['rows']} rows over {got['pages']} pages -> {out}")
    print(f"now open: {out / 'mark.html'}")


if __name__ == "__main__":
    main()
