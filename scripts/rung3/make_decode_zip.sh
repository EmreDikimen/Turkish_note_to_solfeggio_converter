#!/bin/sh
# Build the Colab upload package for the GPU page-decode offload (decode_pages_gpu.py).
#
# One zip, repo-layout paths (like make_labeler_zip.sh): the training kit sources, the GPU
# decode script, a pages.txt listing every matched piece's page images (both sources, from
# matched/*/*/match.json), and those page PNGs. The rung3-labeler START WEIGHTS ARE NOT IN
# THE ZIP — they're already on Drive at MyDrive/tnc/rung3-labeler/best from the fine-tune.
#
# Output: data/colab/tnc_rung3_decode_colab.zip — upload to MyDrive/tnc/, then run
# notebooks/rung3_decode_colab.ipynb and download the strips zip it leaves on Drive.
set -e
cd "$(dirname "$0")/../.."

OUT=data/colab/tnc_rung3_decode_colab.zip
PAGES=data/colab/decode_pages.txt
mkdir -p data/colab
rm -f "$OUT"

python3 - <<'EOF'
import json
from pathlib import Path
pages = []
for mp in sorted(Path("data/real/rung3/matched").rglob("match.json")):
    m = json.loads(mp.read_text())
    src = next((k for k, v in m.items() if isinstance(v, dict) and "pages" in v), None)
    if src:
        pages += [p for p in m[src]["pages"] if Path(p).exists()]
pages = sorted(set(pages))
Path("data/colab/decode_pages.txt").write_text("\n".join(pages) + "\n")
print(f"{len(pages)} pages listed")
EOF

{
  ls src/vision/*.py
  echo scripts/rung3/decode_pages_gpu.py
  echo "$PAGES"
  cat "$PAGES"
} | zip -1 -q "$OUT" -@

echo "wrote $OUT ($(du -h "$OUT" | cut -f1)) — upload this one file to MyDrive/tnc/"
unzip -l "$OUT" | tail -1
