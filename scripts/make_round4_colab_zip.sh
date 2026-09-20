#!/bin/sh
# Build the ONE Colab upload for Round 4 step 6 — the vocabulary A/B (docs/rung3/round4.md).
#
#   scripts/make_round4_colab_zip.sh   -> data/colab/tnc_round4_colab.zip
#
# ONE ZIP, BOTH ARMS. The control and the H arm read the same synthetic corpus, the same real pool
# and the same selection pools; the only thing that differs is `train.py --vocab`, chosen in the
# notebook (notebooks/round4_vocab_ab_colab.ipynb). A second zip would be a second chance for the
# two arms to train on different files.
#
#   strips_v7_final   UNCHANGED — no render this round (owner, 2026-09-03). Checked against its
#                     own render_config.json and verify_labels.json exactly as Round 3's final was.
#   strips_h1         the real pool, with the owner's verdicts promoted (promote_labels.py
#                     --audit-csv full_audit.csv --audit-csv rail_added.csv). ⚠ SHIPPED MINUS
#                     THE LABELS THAT COST MORE THAN 99 ids UNDER THE OLD VOCABULARY — the owner's
#                     call (2026-09-07): `collate` truncates a label at 99 ids, so the control arm
#                     cannot hold them, and "same pools, one variable" means BOTH arms lose them.
#                     The list is derived here, fresh, every build, and written into the zip beside
#                     the manifest (r4_excluded_over99_old.txt). ⛔ The Mac's pool is NOT edited:
#                     the filter lives in the zip only, so a later H-only run can keep those rows.
#   _realval_v2r      the REPAIRED selection pool (repair_realval_v2.py --build). ⛔ NOT _realval_v2,
#   _tupletval        which carries 10 labels about music that is not in their picture. The build
#                     REFUSES while _realval_v2r does not exist.
#
# EXAM STRIPS ARE DELIBERATELY NOT SHIPPED. testset.json travels so the exam-piece guard runs on
# the Colab side.
#
# ⚠ The notebook asserts the zip's exact byte count before unzipping (a half-synced Drive upload
# otherwise fails three cells later with a misleading error), so this script WRITES that count into
# the notebook. Re-running it after any pool change keeps the two in step.
set -e
cd "$(dirname "$0")/.."
REPO=$(pwd)

PY=.venv-ml/bin/python
STRIPS=data/synthetic/strips_v7_final
REAL=data/real/rung3/strips_h1
SELECT_POOLS="data/real/rung3/_realval_v2r data/real/rung3/_tupletval"
SPLIT=data/split_v4.json
TESTSET=data/real/rung3/testset.json
NOTEBOOK=notebooks/round4_vocab_ab_colab.ipynb
OUT=data/colab/tnc_round4_colab.zip

for f in "$STRIPS/manifest.jsonl" "$STRIPS/render_config.json" "$STRIPS/verify_labels.json" \
         "$REAL/manifest.jsonl" "$SPLIT" "$TESTSET" "$NOTEBOOK"; do
  [ -f "$f" ] || { echo "ERROR: $f missing"; exit 1; }
done
for pool in $SELECT_POOLS; do
  [ -f "$pool/manifest.jsonl" ] || {
    echo "ERROR: $pool/manifest.jsonl missing."
    echo "       _realval_v2r is built AFTER the owner reads the 10-row realval-repair queue:"
    echo "       $PY scripts/rung3/repair_realval_v2.py --build"
    exit 1; }
done

# THE RENDER. Same four flags as Round 3's `final` arm — this corpus is reused, not re-rendered.
$PY -c "
import json, sys
c = json.load(open('$STRIPS/render_config.json'))
want = dict(legacyTupletMark=False, thinSharps=True, printNoise=False, staccatoNoise=True,
            concaveTuplet=True, usulBarline=True, maxMeasures=None)
got = {k: c.get(k) for k in want}
print('   render_config:', got)
sys.exit(0 if got == want else 1)
" || { echo "ERROR: $STRIPS/render_config.json is not Round 3's final render"; exit 1; }

# pixels == labels: no strip the verifier flagged may still be in the manifest
$PY -c "
import json, sys
r = json.load(open('$STRIPS/verify_labels.json'))
bad = {m['image'] for m in r['mismatches'] if 'image' in m}
shipped = {json.loads(l)['image'] for l in open('$STRIPS/manifest.jsonl') if l.strip()}
still = sorted(bad & shipped)
print(f\"   verify-labels: {r['stripsChecked']} checked, {r['mismatched']} flagged, \"
      f\"{r['labelDrift']} drifted, {len(bad - shipped)} excluded from the manifest\")
sys.exit(1 if (still or r['labelDrift']) else 0)
" || { echo "ERROR: $STRIPS/verify_labels.json flags strips still in the manifest"; exit 1; }

STAGE=$(mktemp -d)
LIST=$(mktemp)
trap 'rm -rf "$STAGE" "$LIST"' EXIT

# THE REAL POOL, minus the labels the control arm cannot hold. Counted with the base tokenizer +
# the OLD vocabulary — exactly what `collate` sees in the control arm — plus EOS.
mkdir -p "$STAGE/$REAL"
$PY - "$REAL" "$STAGE/$REAL" <<'PYEOF'
import json, sys
from pathlib import Path
sys.path.insert(0, "src/vision")
from transformers import AutoTokenizer
from data import vocabulary
from modeling import MODEL_ID

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
tok = AutoTokenizer.from_pretrained(MODEL_ID)
tok.add_tokens(vocabulary("old"))
rows = [json.loads(l) for l in (src / "manifest.jsonl").read_text().splitlines() if l.strip()]
keep, drop = [], []
for r in rows:
    n = len(tok(r["label"]).input_ids)
    n += 0 if tok(r["label"]).input_ids[-1:] == [tok.eos_token_id] else 1
    (drop if n > 99 else keep).append((r, n))
if len(drop) > 20:
    sys.exit(f"ERROR: {len(drop)} labels over 99 old ids — the owner's call was about 4; re-ask before shipping")
(dst / "manifest.jsonl").write_text("".join(json.dumps(r) + "\n" for r, _ in keep))
(dst / "r4_excluded_over99_old.txt").write_text(
    "# strips_h1 rows left out of BOTH Round-4 arms: label > 99 ids under the OLD vocabulary\n"
    "# (collate truncates there). Derived by scripts/make_round4_colab_zip.sh.\n"
    + "".join(f"{r['image']}\t{n}\n" for r, n in drop))
print(f"   {src}: {len(rows)} rows, shipping {len(keep)}, left out {len(drop)} (> 99 old ids)")
for r, n in drop:
    print(f"      {n:3d}  {r['image']}")
PYEOF
[ -s "$STAGE/$REAL/manifest.jsonl" ] || { echo "ERROR: the filtered real manifest is empty"; exit 1; }

{
  ls src/vision/*.py
  # the notebook's paired read runs on the GPU — both scorers count on the old-id scale
  echo scripts/rung3/paired_arm_score.py
  echo scripts/rung3/error_taxonomy.py
  echo "$SPLIT"
  echo "$TESTSET"
  echo "$STRIPS/manifest.jsonl"
  echo "$STRIPS/render_config.json"
  find "$STRIPS" -maxdepth 1 -name '*.png'
  # only the PNGs the FILTERED manifest references
  $PY -c "
import json, os, sys
for l in open('$STAGE/$REAL/manifest.jsonl'):
    p = os.path.join('$REAL', json.loads(l)['image'])
    if not os.path.exists(p): sys.exit(f'ERROR: {p} missing')
    print(p)
"
  for pool in $SELECT_POOLS; do
    echo "$pool/manifest.jsonl"
    $PY -c "
import json, os, sys
for l in open(os.path.join('$pool', 'manifest.jsonl')):
    if not l.strip(): continue
    p = os.path.join('$pool', json.loads(l)['image'])
    if not os.path.exists(p): sys.exit(f'ERROR: {p} missing')
    print(p)
"
  done
} > "$LIST"

mkdir -p data/colab
rm -f "$OUT"
echo "packing $(wc -l < "$LIST" | tr -d ' ') files ..."
zip -1 -q "$OUT" -@ < "$LIST"
# the filtered manifest goes in UNDER THE POOL'S OWN PATH, from the staging copy
(cd "$STAGE" && zip -1 -q "$REPO/$OUT" "$REAL/manifest.jsonl" "$REAL/r4_excluded_over99_old.txt")

BYTES=$(stat -f %z "$OUT")
$PY - "$NOTEBOOK" "$BYTES" <<'PYEOF'
import json, re, sys
path, n = sys.argv[1], int(sys.argv[2])
nb = json.load(open(path))
hits = 0
for cell in nb["cells"]:
    src = "".join(cell["source"])
    new, k = re.subn(r"ZIP_BYTES = \d+", f"ZIP_BYTES = {n}", src)
    if k:
        cell["source"] = new.splitlines(keepends=True)
        hits += k
if hits != 1:
    sys.exit(f"ERROR: expected one ZIP_BYTES line in {path}, found {hits}")
json.dump(nb, open(path, "w"), indent=1, ensure_ascii=False)
open(path, "a").write("\n")
print(f"   {path}: ZIP_BYTES = {n}")
PYEOF

echo "wrote $OUT ($(du -h "$OUT" | cut -f1)) — upload this one file to Google Drive"
unzip -l "$OUT" | tail -1
