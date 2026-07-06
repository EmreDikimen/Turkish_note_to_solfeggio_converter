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
npx tsx tools/render/render.ts --pieces data/pieces.json --out data/synthetic/strips_v2 --from 0 --to 3
open data/synthetic/strips_v2/index.html
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
.venv-ml/bin/python scripts/make_split.py --strips data/synthetic/strips_v2
.venv-ml/bin/python src/vision/audit_coverage.py --strips data/synthetic/strips_v2 \
    --split data/synthetic/strips_v2/split.json --tokenizer data/checkpoints/overfit10
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

---

**Reproducing any strip later:** its manifest row carries `piece`, `transpose`, `mode`, `lyrics`,
`repseed`, `navseed`, `textseed`, `respellseed` — paste them into the URL parameters above and you are looking
at the exact render that produced it (`respellseed` matters: the respell changes which accidental
glyphs are drawn, so omitting it can show different signs than the strip's PNG).
