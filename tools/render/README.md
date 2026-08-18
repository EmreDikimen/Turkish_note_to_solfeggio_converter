# Phase 2 — synthetic data renderer (`tools/render/`)

purpose: how the synthetic (image, label) training pairs are generated, and what each corpus version added
audience: anyone changing the renderer, the label serializer, or a training corpus
updated: 2026-07-26

> Project state: `docs/STATUS.md`. Measured numbers: `docs/METRICS.md`. This file is renderer-internal.

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
tokens, **`\natural`**, **`\sig`** / **`\sigend`**, `|`, the digit **`3`** — the base vocab lacks
`3`, so it cannot spell "32" for 32nd notes (see `src/vision/MODEL_EVAL.md`) — the 4 repeat-sign
tokens `\repstart` `\repend` `\volta1` `\volta2` (faithful drawn symbols; the base vocab's structural
`\repeat `/`volta ` can't label a crop showing only one end of a repeat), the 4 navigation-mark
tokens `\segno` `\coda` `\dc` `\fine` (segno 𝄋 / coda ⊕ / "D.C." / "Son" — same faithful-drawn-symbol
story, injected via `navmarks.ts`; see `docs/PHASE2.md` §6), and the 4 **rhythm-sign** tokens
`\tup3` `\tupend` `\tie` `\grace` (strips_v2_2 — REAL data recovered from the exact durations by
`rhythm.ts`, no injection: `\tup3 … \tupend` wraps a bracketed triplet group whose members spell
their ×3/2 written value; `\tie` sits between the two written notes of a split long value — rests
split without a tie; `\grace` prefixes a small slashed grace note's own spelling). 25 added ids
total. `\repstart`/`\repend` replace the `|` at their boundary; `\volta1`/`\volta2` precede the
bracketed measure's first note; nav tokens sit at the drawn measure edge (start-edge marks before
the measure's notes, end-edge after).

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
    --pieces data/pieces.json --out data/synthetic/strips_v2_1 [--from 0 --to 25] [--clean] [--finalize]
```
Jobs are derived deterministically from `data/pieces.json` (written by `scripts/select_pieces.py`;
scores exported by `scripts/export_scores.py`): every transpose × both modes, lyrics only at t=0,
seeded repeat injection on ~half of renders, seeded nav-mark injection on ~70%, distractor text +
the low-rate büyük respell always on (all seeds hashed from `slug:transpose`, so any strip is
reproducible — `docs/MANUAL_CHECKS.md`). Output → the `--out` dir (gitignored; `strips_v3` is the
current corpus): `<slug>_t±N_<mode>_<id>.png` + `.txt` per strip,
per-piece manifest shards + `.done` markers under `manifests/` (**resumable**: Ctrl-C anytime;
finished pieces are skipped on re-run, a partial piece is re-rendered), and — after a full pass or
`--finalize` — a combined `manifest.jsonl` + a 500-strip sampled **`index.html` contact sheet**
(each PNG next to its label + decoded notes). Two modes are rendered: **`measure`/carry** (signature
at the row start PLUS measure-scoped accidental carry — how real pages print, and 73% of `strips_v3`)
and `every` (every accidental inline, crop anywhere; the transpose carrier). `keysig` mode still
exists in SheetView but is no longer rendered into the corpus. 3× device scale keeps beams crisp.

## Files
- `lilypond.ts` — the serializer (note model → strips/measures + labels; `STRIP_BUDGET`,
  `ADDED_TOKENS`). Pure logic; reuses `@turkish-omr/core`.
- `decode.ts` — pure label → readable note-name decoder (browser-safe; reused by the Strip panel).
- `decode-cli.ts` — CLI for the decoder. Run:
  `npx --yes tsx tools/render/decode-cli.ts [score.json | "<label string>"]`. Shows the *written* AEU
  note (snapped), so compare against the harness Sheet view, not the raw exact koma.
- `demo.ts` — prints strips from a sample score. Run: `npx --yes tsx tools/render/demo.ts [score.json]`.
- `render.ts` — Playwright batch renderer (drives the harness by URL; crops the live sheet → PNG +
  label + per-piece manifest shards + contact sheet; chunked + resumable). Since `strips_v3`:
  carry (`measure`) mode is dominant, conventional signatures come from `data/makam_signatures.json`
  (`--sigs`), seeded slur distractors are on (`slurseed`), and `--thin-sharps` renders the four AEU
  sharps at real-print bar weight (opt-in — see the Status list).
- `verify-labels.ts` — the PIXELS-vs-LABELS gate. Re-opens every job from a corpus manifest, reads
  the accidental glyphs out of the live SVG (SMuFL codepoint; the `--thin-sharps` AEU sharps by
  their unique stem/bar counts) and checks each crop rect's glyphs against that strip's label,
  `\sig` block included. Run:
  `npx --yes tsx tools/render/verify-labels.ts --strips data/synthetic/<set> [--thin-sharps] [--staccato-noise]`
  (`--limit`/`--every` for a quick pass). **A corpus is not trainable until this passes** — the
  carry decision is duplicated between `SheetView.tsx` and `lilypond.ts`, and when they silently
  diverged, 18.8% of `strips_v3`'s carry strips drew accidentals their labels omitted. If you change
  either rule, re-run it, and check the report's mismatch deltas rather than only the pass count.
- `labels-cli.ts` — the Rung-3 emitter's TS half: serves, for a real page's decoded measure ranges,
  the carry-mode label of each range (`mode: "measure"` bodies joined by `|`) so a name-matched
  SymbTr score becomes ground truth for real strips (`scripts/rung3/emit_strip_labels.py`).
- `repeats.ts` — `detectRepeats` (fold detection of flattened duplicate runs) + `injectRepeats`
  (seeded random spans for token coverage) + `repeatMarksAt` (per-measure drawn marks).
- `navmarks.ts` — seeded navigation-mark injection (segno / coda / D.C. / Son; 4–6 marks on ~70%
  of renders, never stacked on repeat/volta measures — see `docs/PHASE2.md` §6).
- `respell.ts` — seeded low-rate AEU-enharmonic respell (büyük coverage; only `noteName` changes,
  so pixels and labels stay consistent by construction).
- `rhythm.ts` — triplet-group + tie-split detection from the exact `durationBeats` rationals
  (strips_v2_2; pure per-measure functions shared by the serializer and SheetView, so pixels ==
  labels by construction — no seeds, no injection: these signs are real data).
- `rng.ts` — seeded PRNG (`mulberry32`) + `hashStr`, shared by every seeded render step.

**The second engraver (`ly-*.ts`, 2026-08-18 — Round 3 Lever 4).** A pilot arm, not a corpus: real
GNU LilyPond 2.26 renders the *same* labels this directory already serializes, so a second visual
domain costs no new labelling. It needs `brew install lilypond` and runs training-side only.
- `ly-engrave.ts` — label → LilyPond source. It **re-decides nothing**: a note the label marks is
  written at that alteration and forced with `!`, a note it leaves bare takes the drawn signature's
  alteration, and `\accidentalStyle "forget"` removes LilyPond's own accidental memory — so its
  engine can neither add nor drop a sign. `\time` per measure comes from `deriveTimeSignature`
  (LilyPond beams by it) and every measure carries a bar check. **Throws** on repeat/volta/nav
  tokens rather than approximating them.
- `ly-svg.ts` — reads a LilyPond SVG back: staff lines, and glyph identity **by font outline**,
  self-calibrated by rendering the nine signs twice. ⚠ Twice because Emmentaler is an optical-size
  family — a grace note's accidental is a different outline, and a full-size-only table silently
  reports "no accidentals" on a strip that has them.
- `render-ly.ts` — the corpus arm: labels from `labels-cli.ts --ranges`, one LilyPond run per piece,
  one SVG page per strip, cropped by Playwright at the corpus geometry (336 px tall, 30 px staff
  spacing — pinned on purpose, so the engraver is the only variable). Run:
  `npx --yes tsx tools/render/render-ly.ts --pieces data/pieces_geom_pilot.json --out data/synthetic/<set>`
- `verify-labels-ly.ts` — **this arm's own** pixels-vs-labels gate (`verify-labels.ts` cannot read
  it: different engine, different glyph identification). Re-engraves from the manifest and compares
  drawn accidentals against label tokens in reading order. A pool it produced is not trainable until
  this passes. Run: `npx --yes tsx tools/render/verify-labels-ly.ts --strips data/synthetic/<set>`

Result of the pilot — 312/312 gate pass, and a **null** domain-gap read against a matched VexFlow
control: [../../docs/METRICS-ENGRAVER.md](../../docs/METRICS-ENGRAVER.md).
(Browser-side counterparts live in `apps/web/src/`: `stripExport.ts` builds crop rects + labels
from SheetView's layout; `textNoise.ts` draws the seeded distractor text.)

## Status (renderer-internal — project state lives in `docs/STATUS.md`, numbers in `docs/METRICS.md`)
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
- [x] **strips_v2_1 re-render (2026-07-06):** 18,627 strips — adds the 4 navigation-mark tokens
      (`navmarks.ts`, all audit floors cleared) and the centered-rest engraving fix (`alignRests`
      off in SheetView); audit PASS. **Supersedes v2 for training** (v2 stays on disk). This is the
      set Rung 2 trained on (PASS 2026-07-07 — `docs/METRICS.md`).
- [x] OpenCV augmentation — deliberately NOT baked into the rendered files; applied on-the-fly in
      the Rung-2 training loader (`src/vision/augment.py`, screenshot-dominant two-profile mix).
- [ ] Clef on mid-row every-note strips (only row-start crops currently include the clef).
- [x] Repeat-sign tokens emitted (2026-07-02): `detectRepeats` (`repeats.ts`) finds the flattened
      duplicate runs (detection only — the doc/layout/playback are untouched); the harness Repeats
      toggle draws the signs and the strip labels carry the matching tokens. Verified live: token
      placement, note round-trip, single-id tokenization. **Random injection DONE (2026-07-05):**
      `injectRepeats` adds 2–4 seeded spans on ~half of renders; 6.4% of v2 strips carry repeat tokens.
- [x] **Multi-measure strip coverage — CLOSED (2026-07-05):** cap raised 46→56 (`STRIP_BUDGET`) +
      sparse-piece selection; 39.9% of every-mode v2 strips span 2–4 measures, `|` in 40.7% of
      labels (dense measures can't pair under the 60-id budget — a model constraint, not a bug).
- [x] **strips_v2_2 (2026-07-08, re-rendered 2026-07-09):** adds the 4 rhythm tokens (`rhythm.ts`:
      `\tup3` `\tupend` `\tie` `\grace`, recovered from real durations — no injection) and the
      tuplet stem fix; 23,391 strips from 190 pieces after the triplet-piece expansion. The set
      Rung 2.2 / 2.2b trained on.
- [x] **`strips_v3` — carry-dominant re-render (2026-07-21), the Round-1 training corpus**
      (size and composition: `docs/METRICS.md`; design rationale: `docs/rung3/rerender.md`).
      Three changes, all aimed at the real-page gap: conventional PRINTED per-makam
      signatures (`data/makam_signatures.json`, built from adjudication-confirmed real labels) wired
      to both glyphs and labels; carry mode replacing `keysig` as the majority (real pages print a
      signature and carry accidentals within the measure — v2_2 had **zero** carry strips); and
      label-free **slur distractors** so an arc alone stops reading as a triplet (`\tup3` precision
      15% → 97% at Round 1). `every` mode stays as the minority transpose carrier (its share is
      train-time tunable via `train.py --every-share`, shipped at 0.15).
- [x] **Real-print sharp weight — `--thin-sharps` (2026-07-26), OFF by default.** Bravura draws the
      AEU sharp bars too thick and packs küçük's three bars too close, so after the encoder's shrink
      they fuse into a block that IS a 2-bar koma — that, not resolution and not teaching volume, was
      the model's microtonal-sharp weakness. `drawThinSharps` (SheetView) redraws all four sharps as
      SVG at real-print bar weight — all four, so bar COUNT stays the only difference; flats
      untouched. Off by default so an A/B against `strips_v3` stays possible.
      Diagnosis: `docs/rung3/round2.md`; the measured widths: `docs/METRICS.md`.
- [x] **Staccato distractors — `--staccato-noise` (2026-08-15), OFF by default.** `ADDED_TOKENS` has
      no articulation token and the renderer drew no staccato, so 0 of 40,826 strips carried one and
      **every dot the model had ever seen meant *longer***: it reads a printed staccato as an
      augmentation dot. Measured with a paired control — **72.7%** of marked strips get a dot the gold
      does not have, against **0.0%** unmarked. `drawStaccatoDot` (SheetView) draws it as raw SVG on
      the notehead side, and the draw deliberately seeks out **already-dotted notes**, because a
      notehead carrying both marks is the only example that isolates position. ⚠ `staccatoseed` is
      **not** a manifest field (like `legacyTuplet`), so the two arms' manifests stay byte-identical
      and diffable. ⚠ `STACCATO_RATE` is chosen, not measured. Floors and the account:
      `docs/rung3/levers.md` Lever 6.
- [ ] **Next re-render owes the sharp FREQUENCY balance:** inline, `strips_v3` carries far more
      `\komaSharp` than `\kucukSharp` and **no** strip holds both — the model has never seen the pair
      contrasted in one image (counts: `docs/METRICS.md`). Balance them and place koma/küçük/bakiye
      on neighbouring notes, with `--thin-sharps` on.
