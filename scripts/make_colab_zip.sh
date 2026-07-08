#!/bin/sh
# Build the self-contained Colab upload package for the Rung-2 fine-tune (see docs/COLAB.md).
#
# One zip, mirroring the repo layout, so every command in the docs/notebook works unchanged
# after unzipping — no git clone or repo state needed on the Colab side:
#   src/vision/*.py                        the training kit (train/eval/data/modeling/augment/audit)
#   data/split.json                        the committed split-by-piece
#   data/synthetic/strips_v2_2/            manifest.jsonl + PNGs (the .txt label sidecars and the
#                                          per-piece manifests/ shards are redundant — excluded)
#
# Output: data/colab/tnc_rung2_colab.zip (~470 MB; PNGs don't compress, -1 keeps it fast).
# Upload that single file to your Google Drive, then follow docs/COLAB.md.
set -e
cd "$(dirname "$0")/.."

STRIPS=data/synthetic/strips_v2_2
OUT=data/colab/tnc_rung2_colab.zip
mkdir -p data/colab
rm -f "$OUT"

[ -f "$STRIPS/manifest.jsonl" ] || { echo "ERROR: $STRIPS/manifest.jsonl missing — render + finalize first"; exit 1; }

{
  ls src/vision/*.py
  echo data/split.json
  echo "$STRIPS/manifest.jsonl"
  find "$STRIPS" -maxdepth 1 -name '*.png'
} | zip -1 -q "$OUT" -@

echo "wrote $OUT ($(du -h "$OUT" | cut -f1)) — upload this one file to Google Drive"
unzip -l "$OUT" | tail -1
