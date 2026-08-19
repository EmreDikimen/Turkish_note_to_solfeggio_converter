#!/bin/sh
# Build the Colab upload package for ONE ARM of the tuplet-mark A/B (docs/rung3/round3-criteria.md).
#
#   scripts/make_round3_colab_zip.sh tupnew   -> data/colab/tnc_round3_tupnew_colab.zip
#   scripts/make_round3_colab_zip.sh tupctl   -> data/colab/tnc_round3_tupctl_colab.zip
#   scripts/make_round3_colab_zip.sh scan     -> data/colab/tnc_round3_scan_colab.zip
#
# THE `scan` ARM IS NOT A THIRD CORPUS. It ships `strips_v5_tupnew` — byte for byte the corpus the
# tuplet A/B's winning arm trained on — because Lever 7's only variable is the AUGMENTATION MIX
# (`--photo-share 0.20 --scan-share 0.25`), which lives in src/vision/augment.py and is chosen at
# training time. That is also what lets `data/checkpoints/r3-tupnew-stage2-best` stand as its
# control instead of costing a second GPU run: same corpus, same split, same recipe, same steps.
# ⚠ So DO NOT "fix" the corpus path below to a scan-specific pool. There isn't one, and there must
# not be — a second variable is exactly what Round 3 has been unattributable for twice already.
#
# Same shape as scripts/make_round2_colab_zip.sh — read that one for the per-file rationale. What
# changes here is that there are TWO corpora, identical except for how the triplet mark is drawn:
#   strips_v5_tupnew   the measured shape: arc broken, "3" set in the gap
#   strips_v5_tupctl   the CONTROL: the pre-2026-08-12 continuous arc with the digit above it
# Both are rendered with --thin-sharps and WITHOUT print noise, so they match the strips_v4 recipe
# in every other respect. The split is data/split_v4.json, reused because data/pieces.json did not
# move — same pieces, same piece-level split, so the two arms and Round 2 stay comparable.
#
# EXAM STRIPS ARE DELIBERATELY NOT SHIPPED. testset.json travels so the exam-piece guard is
# verifiable on the Colab side. The A/B's selection pool (`_tupletval`) is not shipped either — it
# is read locally on the Mac, on the checkpoints that come back.
#
# ⚠ The arm is checked against the corpus's own render_config.json. A zip built from the wrong
# corpus is invisible afterwards: the manifests of the two arms are byte-identical by design.
set -e
cd "$(dirname "$0")/.."

ARM=$1
case "$ARM" in
  tupnew) WANT_LEGACY=false; CORPUS=strips_v5_tupnew ;;
  tupctl) WANT_LEGACY=true;  CORPUS=strips_v5_tupctl ;;
  scan)   WANT_LEGACY=false; CORPUS=strips_v5_tupnew ;;   # same corpus — see the header
  *) echo "usage: $0 tupnew|tupctl|scan"; exit 2 ;;
esac

STRIPS=data/synthetic/$CORPUS
SPLIT=data/split_v4.json
TESTSET=data/real/rung3/testset.json
REAL_POOLS="data/real/rung3/strips_nota data/real/rung3/strips_r1 data/real/rung3/strips_tup"
OUT=data/colab/tnc_round3_${ARM}_colab.zip

mkdir -p data/colab
rm -f "$OUT"

[ -f "$STRIPS/manifest.jsonl" ] || { echo "ERROR: $STRIPS/manifest.jsonl missing — render + finalize first"; exit 1; }
[ -f "$SPLIT" ] || { echo "ERROR: $SPLIT missing"; exit 1; }
[ -f "$TESTSET" ] || { echo "ERROR: $TESTSET missing"; exit 1; }

# WHICH ARM IS THIS, really. The mark is pixels only, so nothing downstream can tell the corpora
# apart — this is the only place the flag is checkable.
CFG="$STRIPS/render_config.json"
[ -f "$CFG" ] || { echo "ERROR: $CFG missing — re-render with the current tools/render/render.ts"; exit 1; }
python3 -c "
import json,sys
c=json.load(open('$CFG'))
want = '$WANT_LEGACY' == 'true'
ok = c.get('legacyTupletMark') is want and c.get('thinSharps') is True and c.get('printNoise') is False
print(f\"   render_config: legacyTupletMark={c.get('legacyTupletMark')} thinSharps={c.get('thinSharps')} printNoise={c.get('printNoise')}\")
sys.exit(0 if ok else 1)
" || { echo "ERROR: $CFG does not describe arm '$ARM' (want legacyTupletMark=$WANT_LEGACY, thinSharps=true, printNoise=false)"; exit 1; }

# The corpus must have passed the pixels-vs-labels verifier before it is worth a Colab run: a label
# that disagrees with its own image is what cost Round 1.
VERIFY="$STRIPS/verify_labels.json"
if [ -f "$VERIFY" ]; then
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
  echo "$STRIPS/render_config.json"
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
