#!/bin/sh
# Build the self-contained Colab upload package for the ROUND-2 fine-tune (see docs/COLAB.md).
#
# Same shape as scripts/make_round1_colab_zip.sh — read that one for the per-file rationale. What
# changes for Round 2 is the corpus:
#   data/synthetic/strips_v4/   40,841 strips: thin sharps, the carry pixels-vs-labels fix,
#                               +23 küçük-bearing pieces, −5 exam pieces (docs/METRICS.md)
#   data/split_v4.json          val is split_v3's VERBATIM, so v3-vs-v4 stays matched
#
# EXAM STRIPS ARE DELIBERATELY NOT SHIPPED — the exam is read ONCE, on the winning checkpoint.
# testset.json still travels, so the exam-piece guard is verifiable on the Colab side.
#
# Recipe reminder (keep Round 1's winning two-stage arm so the exam read is attributable to the
# corpus fixes, not to a new schedule) — and note the REAL-STRIP REPEAT changes:
#   Round 1 held real at 33.3% with `--real-dir …:8` against 33,319 synthetic train strips.
#   strips_v4 has 36,069, so `:8` would drift real down to ~31% — use `:9`.
#
# Output: data/colab/tnc_round2_colab.zip (~1 GB; PNGs don't compress, -1 keeps it fast).
set -e
cd "$(dirname "$0")/.."

STRIPS=data/synthetic/strips_v4
SPLIT=data/split_v4.json
TESTSET=data/real/rung3/testset.json
REAL_POOLS="data/real/rung3/strips_nota data/real/rung3/strips_r1 data/real/rung3/strips_tup"
OUT=data/colab/tnc_round2_colab.zip

mkdir -p data/colab
rm -f "$OUT"

[ -f "$STRIPS/manifest.jsonl" ] || { echo "ERROR: $STRIPS/manifest.jsonl missing — render + finalize first"; exit 1; }
[ -f "$SPLIT" ] || { echo "ERROR: $SPLIT missing"; exit 1; }
[ -f "$TESTSET" ] || { echo "ERROR: $TESTSET missing"; exit 1; }

# The corpus must have passed the pixels-vs-labels verifier (tools/render/verify-labels.ts) before
# it is worth a Colab run: a label that disagrees with its own image is what cost Round 1.
VERIFY="$STRIPS/verify_labels.json"
if [ -f "$VERIFY" ]; then
  # A flagged strip may be either fixed or EXCLUDED, but it must not still be in the manifest —
  # that is the whole point of the gate.
  python3 -c "
import json,sys
r=json.load(open('$VERIFY'))
bad={m['image'] for m in r['mismatches'] if 'image' in m}
errs=[m for m in r['mismatches'] if 'image' not in m]
shipped={json.loads(l)['image'] for l in open('$STRIPS/manifest.jsonl') if l.strip()}
still=sorted(bad & shipped)
print(f\"   verify-labels: {r['stripsChecked']} checked, {r['mismatched']} flagged, \"
      f\"{r['labelDrift']} drifted, {len(bad - shipped)} excluded from the manifest\")
for s in still[:10]: print(f'     STILL SHIPPED: {s}')
sys.exit(1 if (still or errs or r['labelDrift']) else 0)
" || { echo "ERROR: $VERIFY flags strips that are still in the manifest — fix or exclude them first"; exit 1; }
else
  echo "ERROR: $VERIFY missing — run: npx tsx tools/render/verify-labels.ts --strips $STRIPS --thin-sharps"
  exit 1
fi

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
