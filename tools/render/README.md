# Phase 2 — synthetic data renderer (`tools/render/`)

Generates the **(image, label)** training pairs for fine-tuning the OMR model: the TypeScript side
renders short Turkish staff strips with the existing VexFlow engraving and emits each strip's label in
the model's output format, from the **same data that draws the image** (so labels can't drift from
pixels). OpenCV/Albumentations augmentation happens later, on the Python side.

## Label format (LilyPond, extended for Turkish microtones)

The lead model `omr_transformer` reads an image → **LilyPond** text, spelling notes char-by-char in
LilyPond English (`c d e f g a b`, `'` = octave up, duration numbers, `.` = dot, `r` = rest). We emit
the same and add the one thing it lacks — the Turkish microtonal accidentals — plus barlines.

- **Note** = `[<accidental>] <letter><octave><duration>` — e.g. `c''4` (Do5 quarter), `f''8` (Fa5 8th).
- **Octave:** apostrophes = `octave − 3` (our `Do5` = C5 = `c''`; `c'` = C4 = middle C).
- **Duration:** LilyPond number (`1 2 4 8 16 32`) + a `.` per augmentation dot.
- **Rest** = `r<duration>` (e.g. `r4`).
- **Barline** = `|` between measures.
- **8 AEU accidental tokens** (one atomic token each, placed before the note):
  `\komaFlat \komaSharp \bakiyeFlat \bakiyeSharp \kucukFlat \kucukSharp \buyukFlat \buyukSharp`.

**Label scheme — FAITHFUL + signature extraction (implemented in `lilypond.ts`).** The label marks
only what is **physically drawn**:

- Each note: an explicit **deviation** accidental, or an explicit **`\natural`** (cancel), else **bare**
  (no token). So label == image, and any crop — including **mid-row** — is valid.
- **Row-start strips** (crop includes the clef + makam signature) **prefix the read key signature**,
  e.g. `\sig \komaFlat b \sigend  a'4 f''8 …` — teaching the OMR to *extract* the signature. This is a
  **makam-independent** source of the row's default accidentals (crucial for photos with no makam).
- The **makam decoder (Phase 4)** resolves each **bare** note from the row's signature (OMR-read, or
  from the makam's per-degree defaults); explicit accidental/natural override; `makam = none` + no
  signature → notes as written. Written→sounding koma stays makam-dependent (Phase 4). Treble assumed;
  no clef/time-signature in the label.

> The **old semantic scheme** marked *every* effective accidental — which broke mid-row crops (a
> signature-covered bare note got a token that isn't in the image, so identical pixels needed
> different labels). Now labels come from the **same per-note decision as SheetView's keysig drawing**
> (deviation → accidental, cancel → `\natural`, matches signature → bare); `"every"`-mode strips pass
> no signature, so every drawn alteration is marked. Verified: for all sample scores, the keysig label
> (sig prefix + bare notes) decodes to the identical note sequence as the every-mode label.

**New tokens to add to the model's tokenizer** (`ADDED_TOKENS` in `lilypond.ts`): the 8 accidental
tokens, **`\natural`**, **`\sig`** / **`\sigend`**, `|`, and the digit **`3`** — the base vocab lacks
`3`, so it cannot spell "32" for 32nd notes (see `src/vision/MODEL_EVAL.md`), and the 4 repeat-sign
tokens `\repstart` `\repend` `\volta1` `\volta2` (faithful drawn symbols; the base vocab's structural
`\repeat `/`volta ` can't label a crop showing only one end of a repeat). `\repstart`/`\repend`
replace the `|` at their boundary; `\volta1`/`\volta2` precede the bracketed measure's first note.

### Real examples (from `apps/web/public/`)
Uşşak (`gamzedeyim-deva.json`) — note the Uşşak Si as a koma-flat:
```
a'4 f''8 e''8 f''8 e''8 f''8 e''8 | f''8 e''8 f''8 g''8
e''8 c''8 \komaFlat b'16 a'16 | a'8 \komaFlat b'16 a'16 d''16 c''16 d''8
```
`safalar-getirdiniz.json` — küçük mücennep flats:
```
\kucukFlat a''8 f''8 | g''8 g''16 g''16 g''8 g''16 g''16 g''8
d''8 \kucukFlat e''8 e''8 | f''8 f''16 f''16 f''8 f''16 f''16 f''8
```

## Strips

`docToStrips(doc)` packs notes into **short, self-contained strips** (default ≤ 4 measures and
≤ 56 estimated tokens — `STRIP_BUDGET` in `lilypond.ts`, the ONE place the cap lives: the browser
exporter's `buildStrips` shares it, and `src/vision/audit_coverage.py --tokenizer` is the hard
backstop, failing any label over 59 real ids under the decoder's 60-id cap), inserting `|` at
measure boundaries. Note-level packing means even a single dense 16th-note measure can't overrun
the cap (the browser exporter instead DROPS an over-budget single measure — crops must fall on
barlines, and an over-cap label can never reach its EOS). Each strip is rendered with its own
clef + makam key signature so it's decodable on its own.

## Out of scope for the labels (handled elsewhere)
- **Repeats:** not in SymbTr (validated: no repeat/volta/segno markers anywhere in the 2,200-piece
  dataset — txt, MusicXML, or mu2), but real photos have them — so a later renderer step **synthesizes
  them**: VexFlow draws repeat barlines (`Barline.type.REPEAT_BEGIN/END`) and voltas (`Volta` stave
  modifier), placed by **fold detection** (adjacent duplicate measure runs = the flattened repeats;
  verified vs. the printed gamzedeyim score) plus **random injection** for token coverage, with
  self-generated labels (the 4 reserved tokens above). The pipeline flattens them on output (shown
  twice, no sign). The harness's **Repeats** toggle previews the drawing path. See `docs/PHASE2.md` §6.
- **Makam / exact koma:** the label is the *written* AEU sign only. The Phase-4 makam decoder maps
  (written sign + makam) → exact sounding koma; `makam = none` keeps notes as written.

## Generating the image+label pairs

We **crop** strips out of the harness's real full-score render (reusing the verified engraving), so no
note is re-drawn. The harness ([SheetView.tsx](../../apps/web/src/SheetView.tsx)) reports each measure's
geometry; the in-page **Strip panel** ([App.tsx](../../apps/web/src/App.tsx), Sheet view) lists strips,
highlights a strip's crop rectangle, and shows its label + decoded notes for a manual check.
`render.ts` then batches it:

```bash
npm run dev:web                       # start the harness (note the port, e.g. 5174)
OMR_URL=http://localhost:5174 npx --yes tsx tools/render/render.ts \
    --pieces data/pieces.json --out data/synthetic/strips_v2 [--from 0 --to 25] [--clean] [--finalize]
```
Jobs are derived deterministically from `data/pieces.json` (written by `scripts/select_pieces.py`;
scores exported by `scripts/export_scores.py`): every transpose × both modes, lyrics only at t=0,
seeded repeat injection on ~half of renders, distractor text + the low-rate büyük respell always on
(all seeds hashed from `slug:transpose`, so any strip is reproducible — `docs/MANUAL_CHECKS.md`).
Output → `data/synthetic/strips_v2/` (gitignored): `<slug>_t±N_<mode>_<id>.png` + `.txt` per strip,
per-piece manifest shards + `.done` markers under `manifests/` (**resumable**: Ctrl-C anytime;
finished pieces are skipped on re-run, a partial piece is re-rendered), and — after a full pass or
`--finalize` — a combined `manifest.jsonl` + a 500-strip sampled **`index.html` contact sheet**
(each PNG next to its label + decoded notes). Both modes are rendered: `every` (every accidental
inline, crop anywhere) and `keysig` (makam signature at the row start, crop row-start ranges).
3× device scale keeps beams crisp.

## Files
- `lilypond.ts` — the serializer (note model → strips/measures + labels; `STRIP_BUDGET`,
  `ADDED_TOKENS`). Pure logic; reuses `@turkish-omr/core`.
- `decode.ts` — pure label → readable note-name decoder (browser-safe; reused by the Strip panel).
- `decode-cli.ts` — CLI for the decoder. Run:
  `npx --yes tsx tools/render/decode-cli.ts [score.json | "<label string>"]`. Shows the *written* AEU
  note (snapped), so compare against the harness Sheet view, not the raw exact koma.
- `demo.ts` — prints strips from a sample score. Run: `npx --yes tsx tools/render/demo.ts [score.json]`.
- `render.ts` — Playwright batch renderer (drives the harness by URL; crops the live sheet → PNG +
  label + per-piece manifest shards + contact sheet; chunked + resumable).
- `repeats.ts` — `detectRepeats` (fold detection of flattened duplicate runs) + `injectRepeats`
  (seeded random spans for token coverage) + `repeatMarksAt` (per-measure drawn marks).
- `respell.ts` — seeded low-rate AEU-enharmonic respell (büyük coverage; only `noteName` changes,
  so pixels and labels stay consistent by construction).
- `rng.ts` — seeded PRNG (`mulberry32`) + `hashStr`, shared by every seeded render step.
(Browser-side counterparts live in `apps/web/src/`: `stripExport.ts` builds crop rects + labels
from SheetView's layout; `textNoise.ts` draws the seeded distractor text.)

## Status (renderer-internal — project-level status lives in ROADMAP §7)
- [x] Label format decided + serializer (`lilypond.ts`) built and verified on real scores.
- [x] **Faithful + signature scheme implemented** (deviation/`\natural`/bare + `\sig … \sigend` on
      row-start keysig strips; `ADDED_TOKENS` extended). Round-trip verified on all sample scores:
      keysig and every-mode labels decode to identical note sequences.
- [x] Verification decoder (`decode.ts`/`decode-cli.ts`) — resolves bare notes from the `\sig` block
      (a mini-prototype of Phase 4's written-skeleton resolution).
- [x] Strip exporter: in-harness Strip panel + Playwright `render.ts`; every-note **and** keysig strips.
- [x] **Rung-2 re-render DONE (2026-07-05):** `data/synthetic/strips_v2/` — 18,624 strips from the
      150 selected pieces (`data/pieces.json`), with repeat-sign tokens, multi-measure coverage,
      transposes, distractor text, and the büyük respell; coverage audit PASS
      (`src/vision/audit_coverage.py`). Supersedes the 2026-07-02 `data/synthetic/strips/` set.
- [ ] OpenCV/Albumentations augmentation — deliberately NOT baked into the rendered files;
      applied on-the-fly in the Rung-2 training loader (Python).
- [ ] Clef on mid-row every-note strips (only row-start crops currently include the clef).
- [x] Repeat-sign tokens emitted (2026-07-02): `detectRepeats` (`repeats.ts`) finds the flattened
      duplicate runs (detection only — the doc/layout/playback are untouched); the harness Repeats
      toggle draws the signs and the strip labels carry the matching tokens. Verified live: token
      placement, note round-trip, single-id tokenization. **Random injection DONE (2026-07-05):**
      `injectRepeats` adds 2–4 seeded spans on ~half of renders; 6.4% of v2 strips carry repeat tokens.
- [x] **Multi-measure strip coverage — CLOSED (2026-07-05):** cap raised 46→56 (`STRIP_BUDGET`) +
      sparse-piece selection; 39.9% of every-mode v2 strips span 2–4 measures, `|` in 40.7% of
      labels (dense measures can't pair under the 60-id budget — a model constraint, not a bug).
