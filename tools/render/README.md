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
`3`, so it cannot spell "32" for 32nd notes (see `src/vision/MODEL_EVAL.md`).

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
≤ 46 estimated tokens — a safe margin under the model's ~60-token decoder cap), inserting `|` at
measure boundaries. Note-level packing means even a single dense 16th-note measure can't overrun the
cap. Each strip is rendered with its own clef + makam key signature so it's decodable on its own.

## Out of scope for the labels (handled elsewhere)
- **Repeats:** not in SymbTr (validated: no repeat/volta/segno markers anywhere in the 2,200-piece
  dataset — txt, MusicXML, or mu2), but real photos have them — so a later renderer step **synthesizes
  them**: VexFlow draws repeat barlines (`Barline.type.REPEAT_BEGIN/END`) and voltas (`Volta` stave
  modifier), injected into a fraction of strips with self-generated labels. The pipeline flattens them
  on output (shown twice, no sign). See `ROADMAP.md` Phase 4.
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
OMR_URL=http://localhost:5174 npx --yes tsx tools/render/render.ts
```
Output → `data/synthetic/strips/` (gitignored): `<score>_<mode>_<id>.png` + `.txt` per strip,
`manifest.jsonl`, and an **`index.html` contact sheet** (open it to scroll every PNG next to its label
+ decoded notes). Both modes are rendered: `every` (every accidental inline, crop anywhere) and
`keysig` (makam signature at the row start, crop row-start ranges). 2–3× device scale keeps beams crisp.

## Files
- `lilypond.ts` — the serializer (note model → strips/measures + labels). Pure logic; reuses `@turkish-omr/core`.
- `decode.ts` — pure label → readable note-name decoder (browser-safe; reused by the Strip panel).
- `decode-cli.ts` — CLI for the decoder. Run:
  `npx --yes tsx tools/render/decode-cli.ts [score.json | "<label string>"]`. Shows the *written* AEU
  note (snapped), so compare against the harness Sheet view, not the raw exact koma.
- `demo.ts` — prints strips from a sample score. Run: `npx --yes tsx tools/render/demo.ts [score.json]`.
- `render.ts` — Playwright batch renderer (crops the live sheet → PNG + label + manifest + contact sheet).

## Status
- [x] Label format decided + serializer (`lilypond.ts`) built and verified on real scores.
- [x] **Faithful + signature scheme implemented** (deviation/`\natural`/bare + `\sig … \sigend` on
      row-start keysig strips; `ADDED_TOKENS` extended). Round-trip verified on all sample scores:
      keysig and every-mode labels decode to identical note sequences.
- [x] Verification decoder (`decode.ts`/`decode-cli.ts`) — resolves bare notes from the `\sig` block
      (a mini-prototype of Phase 4's written-skeleton resolution).
- [x] Strip exporter: in-harness Strip panel + Playwright `render.ts`; every-note **and** keysig strips.
- [ ] **Regenerate the strips** (`render.ts`) — any previously generated `data/synthetic/strips/`
      still carry old semantic labels; delete + re-render before training.
- [ ] OpenCV/Albumentations augmentation (Python, Step 4).
- [ ] Clef on mid-row every-note strips (only row-start crops currently include the clef).
