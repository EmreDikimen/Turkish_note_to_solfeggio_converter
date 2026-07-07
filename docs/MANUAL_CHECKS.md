# Rung-2 dataset & training upgrades — manual checking guide

How to verify each upgrade **with your own eyes**, step by step. Everything here runs locally.
Prerequisite for the browser checks: the dev harness running —

```bash
npm run dev:web        # → http://localhost:5173
```

The harness now accepts **render-automation URL parameters** (this is how the batch renderer
drives it, and how you can reproduce any render exactly):

| param | meaning | example |
|---|---|---|
| `score` | score JSON under `apps/web/public/` | `score=/sample.json` |
| `mode` | accidental mode: `every` or `keysig` | `mode=keysig` |
| `lyrics` | `1` draw lyrics, `0` hide | `lyrics=0` |
| `transpose` | chromatic shift in commas | `transpose=-4` |
| `repseed` | integer → inject seeded repeat signs | `repseed=42` |
| `navseed` | integer → inject seeded navigation marks (segno 𝄋 / coda ⊕ / "D.C." / "Son") | `navseed=1` |
| `textseed` | integer → seeded distractor text | `textseed=7` |
| `respellseed` | integer → seeded low-rate büyük-enharmonic respell (the batch renderer always sets it) | `respellseed=5` |

---

## Check 1 — multi-measure strips (token cap 46 → 56)

Open (a **sparse** piece — see the note below):

> http://localhost:5173/?score=/safalar-getirdiniz.json&mode=every&lyrics=0

Scroll to the **Strip panel** below the sheet.

- **Look for:** strip ids like `m12-13`, `m30-31` (spanning 2+ measures), and `|` inside those
  labels between the measures.
- **Click a multi-measure strip:** the orange highlight rectangle on the sheet must cover all of
  its measures, and the decoded line under the label must match the highlighted notes.
- **Wrong looks like:** every single id being `mN-N`, or a highlight that covers a different
  region than the label describes.

⚠️ **Known and expected:** dense pieces (`/sample.json` = aldanma, `/gamzedeyim-deva.json`) still
pack ONE measure per strip. Verified against the real tokenizer: a dense 9-note measure costs
~38 of the decoder's 60-token budget, so two of them can never fit — this is a model constraint,
not a bug. Multi-measure coverage therefore comes from selecting enough sparse pieces (the
selection script targets this; see Check 5).

## Check 2 — URL-driven transpose + keysig labels

Open side by side:

> http://localhost:5173/?score=/sample.json&mode=keysig&lyrics=0&transpose=0
> http://localhost:5173/?score=/sample.json&mode=keysig&lyrics=0&transpose=-4

- **Look for:** a *different key signature* drawn after the clef in the second tab (t=0 shows a
  single koma-flat on b; t=−4 shows bakiye-flats on d, g, a), and the Strip panel labels'
  `\sig … \sigend` prefix tracking exactly what is drawn.
- **Wrong looks like:** the drawn signature and the `\sig` block disagreeing, or the sheet not
  transposing at all.

## Check 3 — seeded repeat-sign injection

Open:

> http://localhost:5173/?score=/sample.json&mode=every&lyrics=0&repseed=42

- **Look for:** repeat barlines (`‖:` thick+dots begin, `:‖` end) and "1." / "2." volta brackets
  drawn on the sheet.
- **Faithful one-end-only rule:** click a strip that touches only the *left* edge of a repeated
  passage — its label must contain `\repstart` but **not** `\repend` (and vice versa for the
  right edge). A strip fully inside the repeat has neither.
- **Determinism:** reload the page — the signs must be at the *identical* measures every time.
- **Wrong looks like:** a label carrying a repeat token whose sign isn't visible inside that
  strip's highlight rectangle, or signs moving between reloads.

## Check 3b — seeded navigation-mark injection (segno / coda / D.C. / Son)

Open:

> http://localhost:5173/?score=/gamzedeyim-deva.json&mode=every&lyrics=0&navseed=42&repseed=99&respellseed=43

- **Look for:** navigation marks drawn like the real neyzen.com sheets — this seed draws a
  ⊕ **coda pair** (end of m31 → start of m40) and italic **"D.C."** at m12's and m52's right
  barlines. Other seeds draw segno 𝄋 (e.g. `navseed=1`, m28) and "Son"; each render gets 4–6
  marks, so no single seed shows every kind (text marks sit above OR below the staff — both
  placements are injected on purpose).
- **Faithful tokens:** click a strip showing a mark — its label must carry the matching token
  (`\segno` `\coda` `\dc` `\fine`) at the drawn edge (start-edge marks before the measure's
  notes, end-edge marks after). Strips without a visible mark must have no nav token.
- **No stacking:** nav marks never appear on measures carrying repeat signs or volta brackets
  (injection excludes them ±1 measure — they share the above-staff band).
- **Determinism:** reload — identical marks at identical measures every time.
- **Wrong looks like:** a clipped glyph at a crop edge, a token without its drawn mark (or vice
  versa), or marks moving between reloads.

## Check 4 — distractor text (pixels only, never labels)

Open:

> http://localhost:5173/?score=/sample.json&mode=every&lyrics=0&textseed=7

- **Look for:** fake title/composer/usul text near the TOP of the first staff row, and
  publisher/year/page strings in the empty lyric zone at the bottom of rows (lyric-free renders
  only). Fonts/sizes/positions vary with the seed.
- **The critical check — labels unchanged:** open the same URL *without* `&textseed=7` in a second
  tab and compare any strip's label in the Strip panel: they must be **character-identical**.
  The text is drawn into the SVG only; the label pipeline never sees it.
- **Wrong looks like:** any label difference between the two tabs, or noise text covering note
  heads/accidentals so badly they'd be unreadable (occasional light overlap with beams is fine —
  real photos have that too).

## Check 5 — piece selection & coverage projection *(after step 5 exists)*

```bash
.venv-ml/bin/python scripts/select_pieces.py --n 150
```

- **Look for:** the printed per-class projection table — each of the 8 AEU accidental classes
  comfortably non-zero (watch `\buyukSharp` / `\kucukSharp`, the rare ones), and the projected
  multi-measure share. Skim `data/pieces.json` for familiar makams.
- Spot-load 2–3 exported scores in the harness: `?score=/scores/<slug>.json`.

## Check 6 — smoke render + contact sheet *(after step 6 exists)*

```bash
npx tsx tools/render/render.ts --pieces data/pieces.json --out data/synthetic/strips_v2_1 --from 0 --to 3
open data/synthetic/strips_v2_1/index.html
```

- **The single most valuable check in the pipeline:** each card shows a strip PNG, its raw label,
  and the human-readable decoded line. Read ~10 cards: does the decoded text match the drawn
  notes, accidentals, barlines, repeat signs?
- **Resumability:** interrupt the render mid-run (Ctrl-C), re-run the same command — finished
  pieces must be skipped, the interrupted one re-rendered.
- **Before the FULL render:** find the widest 4-measure strips on the contact sheet and confirm
  the glyphs stay legible — the model squashes every strip to 583×409.

## Check 7 — split + audit *(after step 7 exists)*

```bash
# split-by-piece is already committed at data/split.json — only re-run make_split.py if the
# piece list itself changes
.venv-ml/bin/python src/vision/audit_coverage.py --strips data/synthetic/strips_v2_1 \
    --split data/split.json --tokenizer data/checkpoints/overfit10
```

- **Look for:** exit code 0; per-class counts vs the Definition-of-done targets (each AEU class
  ≥200 train / ≥25 val — büyük classes ≥15 val, since their respell-injection rate is deliberately
  low); ≥40% of labels containing `|`; `\repstart`/`\repend` in ≥5% of strips;
  **no label above 59 real tokenizer ids**; no piece in both splits.

## Check 8 — augmentation preview grid (training kit)

```bash
.venv-ml/bin/python src/vision/augment.py --n 6 --out data/synthetic/aug_preview.png
open data/synthetic/aug_preview.png
```

Each row is one strip; the columns are **original | screenshot | photo | photo** (two
independent photo draws, since that profile varies the most).

- **Look for:** the *screenshot* column staying geometrically clean — flat white, straight
  staff, only a little rescale softness / JPEG fuzz (some slices come through nearly
  untouched — that's intended, native screenshots often are clean). The *photo* columns may
  tilt/curve/shade, but **every beam, flag and accidental must stay legible to your eye** —
  if you can't tell an 8th from a 16th, the model can't either (the Step-1 tests showed
  exactly that failure), so the amplitudes are too hot.
- **Wrong looks like:** screenshot cells with rotation/paper/shadows (profile leak), photo
  cells where noteheads merge with staff lines or accidentals smear beyond recognition, or
  two runs with the same `--seed` producing different grids.
- This is the human gate on augmentation strength — **look at it before spending GPU time**,
  and re-check after any parameter tweak in `augment.py`.

## Check 9 — in-browser OMR gate (the exported model, with your own eyes)

This is how you watch the **shipped form** of the model — int8 ONNX, decoded by
`onnxruntime-web` in a real browser, no Python anywhere — read Turkish notation. It exercises
the exact runtime path the product will use (Rung 4).

One-time prep (skip what's already done — after the Rung-2 export these all exist):

```bash
# 1. export the checkpoint to ONNX (encoder / decoder / decoder-with-past graphs)
.venv-ml/bin/optimum-cli export onnx --model data/checkpoints/rung2-best \
    --task image-to-text-with-past data/checkpoints/rung2-best-onnx
# 2. quantize to int8 (830 MB fp32 → 221 MB)
.venv-ml/bin/python src/vision/quantize_onnx.py --onnx-dir data/checkpoints/rung2-best-onnx
# 3. stage the gate assets into apps/web/public/models/ (gitignored)
.venv-ml/bin/python src/vision/make_browser_gate.py --checkpoint data/checkpoints/rung2-best \
    --onnx-dir data/checkpoints/rung2-best-onnx --strips-dir data/synthetic/strips_v2_1 --n 5
```

Then:

```bash
npm run dev:web
```

> open **http://localhost:5173/omr-gate.html**

The page loads the three int8 graphs (~3 s), then decodes each gate strip **twice**: once from
Python's reference pixel tensors (proves ONNX-in-browser), once from live canvas preprocessing
of the PNG (proves the real product path — the JS DonutImageProcessor port).

- **Look for:** the tab title flipping to **"OMR gate — PASS"**, the log turning green, and
  every strip showing `✓ reference` **and** `✓ canvas`. Each strip's PNG is rendered on the
  page — compare it to its printed `label` line: the accidentals (`\komaFlat`, `\bakiyeSharp`,
  …), barlines, repeat/nav tokens must all correspond to what you see drawn. Typical speed on
  an M-series Mac: ~0.85 s encoder + ~0.1–0.25 s decode per strip.
- **Wrong looks like:** a red **FAIL** with a `got:` line under some strip (the decode
  differs from the label — reference-only failures mean the export/quantization is broken;
  canvas-only failures mean the JS preprocessing drifted), or an early `ERROR:` line (usually
  the staged assets are missing/stale — re-run step 3).
- The same 5 strips must already pass in Python (`onnx_parity.py … --suffix _int8`) — if the
  browser disagrees with Python, suspect the JS side, not the model.
- **Try your own image — the upload box at the top of the page:** drop (or pick) any strip
  image and it runs the exact product path — canvas preprocessing → int8 ONNX greedy decode —
  and prints the **read** token line (no ✓/✗: an upload has no ground-truth label, so *you*
  compare the tokens against the picture). Keep it to **one staff, ~2–4 measures** — a full
  page or multi-line photo isn't segmented yet (that's Rung-4 staff isolation), and typically
  ends in the `⚠ hit the 100-token cap` warning. A screenshot crop of a real (non-VexFlow)
  score is a fun preview of Rung 3: expect some misreads — that's exactly the synthetic→real
  gap Rung 3 exists to close.
- **Swapping in different strips:** the gate reads `data/checkpoints/rung2-best/GATE_STRIPS.txt`
  (plain strip filenames from the strips dir). Edit it and re-run step 3 — but note the pass
  criterion is exact-match, so pick strips the PyTorch model decodes exactly (the eval is
  96.8% exact-match, so most val strips qualify; verify with `eval_omr.py`/`onnx_parity.py`
  before blaming the export).

---

**Reproducing any strip later:** its manifest row carries `piece`, `transpose`, `mode`, `lyrics`,
`repseed`, `navseed`, `textseed`, `respellseed` — paste them into the URL parameters above and you are looking
at the exact render that produced it (`respellseed` matters: the respell changes which accidental
glyphs are drawn, so omitting it can show different signs than the strip's PNG).
