"""Decode every photo-exam page with the shipped round1-best model (int8, the browser runtime).

One load_runtime(), then decode_page() per photo so the ONNX graphs load once. Writes each page's
strips + <page>_decode.json under --out, and a photos_exam_decode_summary.json with per-page strip
counts, timing, and any pages the slicer produced nothing for (skipped, not an error).

    .venv-ml/bin/python scripts/rung3/decode_photos_exam.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))
from decode_page import load_runtime, decode_page  # noqa: E402

PHOTOS = sorted(Path("data/real/photos_exam").glob("*.jpg"))
OUT = Path("data/real/rung3/photos_exam_strips")
CKPT = "data/checkpoints/round1-best"
ONNX = "data/checkpoints/round1-best-onnx"


def main() -> None:
    print(f"loading runtime ({CKPT}, int8) ...")
    t0 = time.time()
    rt = load_runtime(CKPT, ONNX, "_int8")
    print(f"  loaded in {time.time() - t0:.1f}s\n")

    summary, n_strips, skipped = [], 0, []
    run0 = time.time()
    for i, p in enumerate(PHOTOS, 1):
        try:
            res = decode_page(p, rt, out_root=OUT, debug=False, verbose=False)
        except RuntimeError as e:                    # 0 strips (e.g. pg36 page curl)
            skipped.append(p.name)
            print(f"[{i:2d}/{len(PHOTOS)}] {p.stem[:44]:44}  SKIP (no strips)")
            continue
        k = len(res["strips"])
        n_strips += k
        summary.append({"page": p.name, "strips": k, "decode_ms": res["total_ms"]})
        print(f"[{i:2d}/{len(PHOTOS)}] {p.stem[:44]:44}  {k:2d} strips  "
              f"{res['total_ms'] / 1000:5.1f}s")

    wall = time.time() - run0
    out = {"model": CKPT, "pages": len(PHOTOS), "decoded_pages": len(summary),
           "skipped_pages": skipped, "total_strips": n_strips,
           "wall_seconds": round(wall, 1), "per_page": summary}
    (OUT / "photos_exam_decode_summary.json").write_text(json.dumps(out, indent=1))
    print(f"\n{n_strips} strips across {len(summary)}/{len(PHOTOS)} pages in {wall/60:.1f} min "
          f"({wall / max(n_strips,1) * 1000:.0f} ms/strip); skipped {len(skipped)}: {skipped}")
    print(f"wrote {OUT}/photos_exam_decode_summary.json")


if __name__ == "__main__":
    main()
