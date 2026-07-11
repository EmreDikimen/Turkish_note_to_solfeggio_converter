# Rung 3 — teaching the model real pages (plan + status)

> The model is 99.9% on synthetic strips but has never trained on a real page. This rung fixes
> that **without weeks of hand labeling**. Collection round 1 is DONE (798 neyzen PDFs → 1,259
> page PNGs — `docs/PIPELINE.md` §3); this doc is the labeling + retraining plan, agreed
> 2026-07-11. Canonical status stays in `ROADMAP.md` §7.

## The plan in one paragraph

Pieces that also exist in SymbTr need no hand labeling — SymbTr already is the correct answer.
The neyzen corpus gave 85 such matches; **notaarsivleri.com (TRT-repertoire sheets, ~21k TSM
pieces with real catalog metadata) should give far more, in a second engraving style** — so we
collect its SymbTr matches too and do ONE big Round-1 fine-tune on both styles at once
(user decision 2026-07-11: don't split what can be one training run). Before training, ~15–25
matched pieces (from BOTH sources) are frozen as a never-trained-on **exam set** for honest
real-world accuracy. Only after Round 1 does hand work start: correcting the model's output on
the unmatched pieces — by then the model has seen real engraving and correcting is "glance and
confirm", not "repair everything".

## Step 1 — Free labels from SymbTr matches

### 1a. neyzen ✅ DONE (2026-07-11)

`scripts/rung3/match_symbtr.py` matches the 798 downloaded pdfs against the 2,186 SymbTr pieces
by name. Makam must agree (spelling-alias table: nihavend↔nihavent, suznak↔suzinak, family
fallbacks like hicaz_humayun→hicaz); songs match on the lyric-incipit title, instrumentals on
composer + form abbreviation (p/ss/longa/…). First run: **85 auto-accepts** (spot-checked
correct), 28 review-band rows, 665 rejects (genuinely not in SymbTr). Outputs, per piece, under
`data/real/rung3/matched/<makam>/<stem>/`:

```
match.json    the pairing (pdf/url/page PNGs ↔ SymbTr file, score)
score.json    SymbTr → note-model JSON — the ground truth (exact sounding komas kept)
labels.json   per-measure label tokens (tools/render/labels-cli.ts), every+keysig modes
              + the derived \sig … \sigend block
```

To promote a review-band row: check the pair, flip its `tier` to `accept` in
`data/real/rung3/matches_review.csv`, rerun with `--apply-csv`.

**Written vs. sounding pitch is already correct (user-raised, verified 2026-07-11).** SymbTr
stores the SOUNDING pitch (uşşak si = 2-comma flat) but the page PRINTS the conventional sign
(1-comma koma flat). The label serializer converts through `toAeuAlter` — the same call the
synthetic renderer uses — so labels carry the WRITTEN sign; verified on a matched uşşak piece
(`\sig \komaFlat b \sigend`). The exact koma stays in `score.json` for playback.

### 1b. notaarsivleri.com — SymbTr-first download (TO BUILD, before Round 1)

Researched 2026-07-11: ~21,000 TSM pieces, sheets from the **TRT repertoire — the same
repertoire SymbTr transcribes**, so the overlap should be large; catalogued with
title/makam/composer/form/usul columns, so matching runs on REAL metadata instead of filename
fuzzing (near-certain accepts). Separate THM section = easy folk exclusion (folk notation uses
numbered bemol-2/3 signs the model has no tokens for — never collect THM/Çoksesli).

**Invert the neyzen order: census the catalog → match against SymbTr → download ONLY the
matched pieces.** Every downloaded page then arrives pre-labeled, in a second engraving style.
Extend `collect_notalar.py` (`--nota` is the wired starting point) + `match_symbtr.py`
(catalog-metadata mode). Gate before it enters training: the slicer was tuned on neyzen's clean
vector PDFs — run `page_to_strips.py --debug` on ~10 sample pages first (TRT scans are older:
skew, bleed, hand-lettered titles) and fix what breaks. **Timebox: if this source needs major
slicer work, Round 1 ships neyzen-only rather than stalling.**

Other sources (later rounds, same SymbTr-first recipe): **nota.trt.net.tr** (official TRT
archive, ~9,500 items, explicit `musicType=Türk Sanat Müziği` filter, keyword-searchable per
SymbTr title), **sahaney.com/en/notalar/** (makam/form/composer-filterable PDFs, a third
engraver), then small ney-community mirrors (devletkorosu.com, erdincbal.com, neyzenim.com).
None publishes a restrictive robots.txt (checked 2026-07-11); crawl politely (rate-limited,
resumable, census-first) like `collect_notalar.py`; everything stays under gitignored
`data/real/` (training data, never redistributed).

## Step 2 — Set the exam aside (before any training on real data)

Freeze ~15–25 matched pieces in `data/real/rung3/testset.json` — **drawn from every source in
the round** (neyzen + notaarsivleri), because a one-style exam can't detect style overfit.
Rules: exclude pieces that are also among the 190 synthetic training pieces (dedupe by SymbTr
file — the exam must measure real-image generalization, not memorized melodies); spread over
makams / signatures / density. Matched pieces are the ideal exam: their labels are perfect.
After every round, `eval_omr.py` on these pages = the real-world accuracy number.

## Step 3 — Strip-label emitter (NEXT BUILD ITEM, source-agnostic)

A training sample is (real strip PNG → tokens). Strip images come from the slicer
(`page_to_strips.py`); tokens come from SymbTr — copied for exactly the measures inside each
strip. Not `docToStrips` (its token-budget windows differ from the slicer's width-based crops).
Per page:

1. Slice + decode (`decode_page.py`) → strips, measure boxes, decoded tokens.
2. Align SymbTr measures to page measures. The wrinkle is repeats: the page draws a repeat sign
   once, SymbTr writes the passage twice. The decode reads repeat/volta/nav tokens reliably
   (Rung 2: 100%/≥96%), and `detectRepeats` (`tools/render/repeats.ts`) already finds SymbTr's
   duplicate runs — fold them together. Where counts still disagree, token-level Levenshtein on
   `labels.json` `full.keysig` recovers the offset (the id-space alignment `eval_omr.py`
   implements).
3. Emit each strip's label from the SymbTr measures it covers: keysig-mode bodies joined with
   `|`, `\sig` prefix on row-start strips, repeat/volta/nav tokens where the page draws them.
4. **Drop any strip whose alignment is uncertain** — a wrong label is worse than no label.
   The emitter also enforces the decoder budget automatically (real-tokenizer ≤59-id check,
   over-budget strips dropped as untrainable — same rule as the synthetic export); token
   counting is never a human job. Gate before training: round-trip every emitted label
   through `decode.ts` + eyeball ~20 renders per source.
5. **Piece-level human screen (user decision 2026-07-11):** before a matched piece's strips
   enter training, a quick by-hand pass over its pages rejects wrong matches, handwritten /
   hand-lettered pages, incomplete or multi-piece PDFs, and layouts the slicer will mangle
   (stacked verse lines, ossia staves). Rejected-for-handwriting pages are PARKED in
   `data/real/rung3/handwritten/` (with their SymbTr match) — out of scope for v1, but the
   free seed dataset if a later version takes on handwriting. A dedicated review interface
   (strip image vs. re-engraved label, one-keystroke accept/flag) is planned to speed this
   and the Step-5 loop up.

This trusts the model almost nowhere: strip→measure mapping is geometry (barline detection),
content is SymbTr. Expected yield: ~1,500–2,000 strips from neyzen's 85 alone; notaarsivleri
multiplies that.

## Step 4 — Round 1: ONE fine-tune on everything matched + the first honest number

Colab, from base weights, the proven Rung-2 kit: synthetic `strips_v2_2` + ALL matched real
strips (both sources, real oversampled; per-source sampling weights in the loader — source
balance is a loader knob, **never** "delete neyzen files"). **Split by piece across ALL pools**
(a piece's real and synthetic strips stay in one split; dedupe matched↔synthetic by SymbTr
file). Then take the Step-2 exam with `eval_omr.py` (headline: per-class AEU accidental
accuracy) — including the per-source breakdown, which is the style-overfit check. `PHOTO_SHARE`
likely stands (these pages are clean rasterizations — screenshot-profile territory). Ship
through the scripted chain (ONNX export → int8 parity → browser gate) before it becomes the
runtime in `apps/web/public/models/`.

## Step 5 — Hand-correction loop for the unmatched pieces (AFTER Round 1)

Deliberately scheduled after the retrain: today's model would need most strips repaired; the
Round-1 model has seen two real engraving styles, so correcting becomes verification. Already
wired (Rung-4 stage 8): `decode_page.py` → `stitch-cli.ts` → harness → fix in editor →
**⬇ Save JSON** → `data/real/rung3/corrected/<makam>/<stem>/`. Disciplines:

- **Triage:** decode ALL pages (~7 s each), rank by suspicion — stitch warnings, decodes
  hitting the 60-id cap without EOS, row/measure-count inconsistencies, min token logprob.
  Hand-correct from the worst end (active learning).
- **Auto-accept the clean end:** zero-warning, clean-EOS, high-confidence pages go straight to
  training; hand-audit a ~5% sample to measure the label-noise rate before trusting it.
- **Verify, don't edit:** the review act is a visual compare (strip image vs. re-engraved
  decode). Watch for anchoring — plausible-but-wrong accidentals waved through; the audit
  sample measures this too.
- Retrain, re-decode, repeat; stop when the marginal correction rate flattens. (This loop is
  inherently iterative — the "one big run" decision only removed the unnecessary
  neyzen-only intermediate round.)

## Folder layout (under gitignored `data/real/`)

```
data/real/
  pdfs/<source>/<makam>/*.pdf     downloads (collect_notalar.py; source = neyzen, nota, …)
  images/<makam>/<stem>_pN.png    rasterized pages, 200 dpi
  strips/<page>/                  slicer + decode outputs (page_to_strips.py / decode_page.py)
  refs/                           ad-hoc reference uploads (incl. triplet_test.png)
  census.json, manifest.csv       collector catalog
  rung3/
    matches_review.csv            every pdf's best SymbTr candidate + score + tier
    matched/<makam>/<stem>/       SymbTr-matched ground truth (step 1)
    testset.json                  frozen exam pieces (step 2 — TODO)
    corrected/<makam>/<stem>/     editor-corrected docs (step 5)
```

## Watch-items

- **Slicer vs. TRT-style scans** (step 1b): the biggest unknown of the combined Round 1 —
  sample-check with `--debug` overlays before bulk download; timeboxed with a neyzen-only
  fallback.
- **Alignment bugs poison labels silently** (step 3) — the round-trip + eyeball gate is
  mandatory per source before the first train.
- **Empty-`\sig` label bug** (`MODEL_EVAL.md` Rung 2.2b): fold the fix into the next dataset
  re-render so real + synthetic labels stay consistent.
- **Folk vs. art music:** TSM sections only; THM's numbered bemol-2/3 signs have no tokens.
- **Handwritten scores** stay OUT of scope for v1 (product-side message, not a model fix).
