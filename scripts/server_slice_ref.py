"""Python's own crops for `tools/vision/parity/server-slice-parity.ts`.

Runs the REAL driver, `page_to_strips`, on each page in a list and leaves its strip PNGs in
<out>/<index>/ — the control the server's slicer (`apps/server/src/slicePage.ts`, i.e. the browser's
TypeScript port run in Node) is compared with, crop by crop.

    .venv-ml/bin/python scripts/server_slice_ref.py --list pages.txt --out DIR
"""
import argparse
import contextlib
import io
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from vision.page_to_strips import page_to_strips  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--list", required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()

pages = [p.strip() for p in open(args.list) if p.strip()]
t0 = time.time()
for i, p in enumerate(pages):
    out = Path(args.out) / f"{i:04d}"
    out.mkdir(parents=True, exist_ok=True)
    with contextlib.redirect_stdout(io.StringIO()):
        page_to_strips(p, out)
print(f"python sliced {len(pages)} pages in {time.time() - t0:.0f} s")
