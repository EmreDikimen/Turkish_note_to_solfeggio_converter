#!/bin/sh
# Build the self-contained Colab upload package for the ROUND-1 fine-tune (see docs/COLAB.md).
#
# Round 1 differs from the Rung-2 kit (scripts/make_colab_zip.sh): it ships the carry-dominant
# synthetic corpus PLUS all three promoted REAL pools, so `train.py --real-dir` works on the Colab
# side, and the frozen testset.json so the exam-piece guard is verifiable there.
#
# One zip, mirroring the repo layout, so every command in the notebook works unchanged after
# unzipping — no git clone or repo state needed on Colab:
#   src/vision/*.py                  the training kit (train/eval/data/modeling/augment/audit)
#   data/split_v3.json               split-by-piece for strips_v3
#   data/real/rung3/testset.json     frozen exam piece list (guard: these never train)
#   data/synthetic/strips_v3/        manifest.jsonl + PNGs (carry-dominant, 38k strips)
#   data/real/rung3/strips_{nota,r1,tup}/  manifest.jsonl + ONLY the manifest-referenced PNGs
#
# The real pools hold PNGs that their manifest no longer references (strips_tup was trimmed to
# tup3-only: 1,413 PNGs on disk vs 172 rows), so we resolve image names from each manifest instead
# of globbing the directory — smaller zip, no dead files.
#
# EXAM STRIPS ARE DELIBERATELY NOT SHIPPED. The exam is read ONCE on the winning checkpoint
# (Step-4.0 discipline); keeping it off the training box removes any chance of accidental training.
#
# Output: data/colab/tnc_round1_colab.zip (~1 GB; PNGs don't compress, -1 keeps it fast).
set -e
cd "$(dirname "$0")/.."

STRIPS=data/synthetic/strips_v3
SPLIT=data/split_v3.json
TESTSET=data/real/rung3/testset.json
REAL_POOLS="data/real/rung3/strips_nota data/real/rung3/strips_r1 data/real/rung3/strips_tup"
OUT=data/colab/tnc_round1_colab.zip

mkdir -p data/colab
rm -f "$OUT"

[ -f "$STRIPS/manifest.jsonl" ] || { echo "ERROR: $STRIPS/manifest.jsonl missing — render + finalize first"; exit 1; }
[ -f "$SPLIT" ] || { echo "ERROR: $SPLIT missing — run scripts/make_split.py"; exit 1; }
[ -f "$TESTSET" ] || { echo "ERROR: $TESTSET missing"; exit 1; }

LIST=$(mktemp)
trap 'rm -f "$LIST"' EXIT

{
  ls src/vision/*.py
  echo "$SPLIT"
  echo "$TESTSET"
  echo "$STRIPS/manifest.jsonl"
  find "$STRIPS" -maxdepth 1 -name '*.png'
  for pool in $REAL_POOLS; do
    [ -f "$pool/manifest.jsonl" ] || { echo "ERROR: $pool/manifest.jsonl missing" >&2; exit 1; }
    echo "$pool/manifest.jsonl"
    # only the PNGs this manifest actually references
    python3 -c "
import json,sys,os
pool=sys.argv[1]
for line in open(os.path.join(pool,'manifest.jsonl')):
    line=line.strip()
    if not line: continue
    img=json.loads(line).get('image')
    if img:
        p=os.path.join(pool,img)
        if os.path.exists(p): print(p)
        else: print(f'WARN missing {p}', file=sys.stderr)
" "$pool"
  done
} > "$LIST"

echo "packing $(wc -l < "$LIST" | tr -d ' ') files ..."
zip -1 -q "$OUT" -@ < "$LIST"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1)) — upload this one file to Google Drive"
unzip -l "$OUT" | tail -1
