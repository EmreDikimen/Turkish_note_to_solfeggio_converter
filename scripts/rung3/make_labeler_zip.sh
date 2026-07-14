#!/bin/sh
# Build the Colab upload package for the Round-0.5 LABELER fine-tune (docs/RUNG3.md §1a.5).
#
# Mirrors scripts/make_colab_zip.sh: one zip, repo-layout paths, so the notebook commands
# (notebooks/rung3_labeler_colab.ipynb) work unchanged after unzipping. Contents:
#   src/vision/*.py                     the training kit
#   data/real/rung3/strips_r1/          manifest.jsonl + split.json + PNGs (the promoted
#                                       418-strip human-verified pool — tiny, ~15 MB)
# START WEIGHTS ARE NOT IN THE ZIP: the run fine-tunes FROM rung22-stemfix-best, which should
# already sit on your Drive at MyDrive/tnc/rung22-stemfix/best from the Rung-2.2b run (the
# notebook rsyncs it, skipping trainer_state.pt). If you deleted it, re-upload
# data/checkpoints/rung22-stemfix-best/ (all files EXCEPT trainer_state.pt, ~550 MB) there.
#
# RE-RUN THIS after any promote_labels.py / make_split.py re-run (e.g. the 3 typo fixes).
# Output: data/colab/tnc_rung3_labeler_colab.zip — upload to MyDrive/tnc/.
set -e
cd "$(dirname "$0")/../.."

STRIPS=data/real/rung3/strips_r1
OUT=data/colab/tnc_rung3_labeler_colab.zip
mkdir -p data/colab
rm -f "$OUT"

[ -f "$STRIPS/manifest.jsonl" ] || { echo "ERROR: $STRIPS/manifest.jsonl missing — run promote_labels.py first"; exit 1; }
[ -f "$STRIPS/split.json" ] || { echo "ERROR: $STRIPS/split.json missing — run scripts/make_split.py --strips $STRIPS"; exit 1; }

{
  ls src/vision/*.py
  echo "$STRIPS/manifest.jsonl"
  echo "$STRIPS/split.json"
  find "$STRIPS" -maxdepth 1 -name '*.png'
} | zip -1 -q "$OUT" -@

echo "wrote $OUT ($(du -h "$OUT" | cut -f1)) — upload this one file to MyDrive/tnc/"
unzip -l "$OUT" | tail -1
