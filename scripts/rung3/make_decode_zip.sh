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
#
# Optional $1 = an existing pages list (one PNG path per line) to package INSTEAD of
# regenerating from all of matched/ — used by the targeted tuplet run (docs/rung3/labeling.md §1c)
# and by the 2026-07-29 re-slice. The list keeps its OWN filename inside the zip: copying it over
# decode_pages.txt (what this did until 2026-07-30) destroyed the record of the previous run's
# page set, and the notebook then had no way to say which pages it decoded.
# Optional $2 = output zip name (default tnc_rung3_decode_colab.zip), so two runs can coexist.
set -e
cd "$(dirname "$0")/../.."

OUT=data/colab/${2:-tnc_rung3_decode_colab.zip}
PAGES=${1:-data/colab/decode_pages.txt}
mkdir -p data/colab
rm -f "$OUT"

if [ -n "$1" ]; then
  echo "$(wc -l < "$PAGES" | tr -d ' ') pages listed (from $PAGES)"
else
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
fi

{
  ls src/vision/*.py
  echo scripts/rung3/decode_pages_gpu.py
  echo "$PAGES"
  cat "$PAGES"
} | zip -1 -q "$OUT" -@

echo "wrote $OUT ($(du -h "$OUT" | cut -f1)) — upload this one file to MyDrive/tnc/"
unzip -l "$OUT" | tail -1
