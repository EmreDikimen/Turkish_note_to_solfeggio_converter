# Metrics — the second engraver (Round 3, Lever 4)

purpose: the single home for the LilyPond-arm numbers — the feasibility check, the pixels-vs-labels
gate, the domain-gap read against the VexFlow control, and what that measurement cannot see
audience: agents and the owner working Lever 4 or deciding whether a second engraver earns a corpus

updated: 2026-08-18

> Part of the real-page track — index: [rung3/README.md](rung3/README.md). The lever's verdict and
> what happens next live in [rung3/levers.md](rung3/levers.md); current state is
> [STATUS.md](STATUS.md). Nothing here changes [rung3/round3-criteria.md](rung3/round3-criteria.md).

## What was built (2026-08-18)

Every one of the 40,826 synthetic strips is VexFlow + Bravura. A second engraver — **GNU LilyPond
2.26.0**, installed with Homebrew, training-side only — now renders the same labels:

| Piece | File |
|---|---|
| label → real LilyPond source | `tools/render/ly-engrave.ts` |
| LilyPond SVG reader (staff lines, glyph identity) | `tools/render/ly-svg.ts` |
| the corpus arm (plan → label → engrave → crop → manifest) | `tools/render/render-ly.ts` |
| the pixels-vs-labels gate for this arm | `tools/render/verify-labels-ly.ts` |

The labels come from `labels-cli.ts --ranges`, i.e. the **same serializer** the corpus and the
real-page emitter use, so a second engraver costs no new labelling. That was the premise of the
lever and it held.

## The feasibility check — LilyPond draws all eight AEU accidentals, our way

LilyPond ships `ly/makam.ly`, which defines alterations in ninths of a whole tone and maps them to
Emmentaler glyphs. The mapping is **identical to ours** (`packages/core/src/notation.ts`), checked
glyph by glyph against Bravura rather than assumed:

| Alteration | Our glyph (Bravura) | LilyPond (Emmentaler) |
|---|---|---|
| koma ±1 | 1-stem 2-bar sharp / mirrored flat | `sharp.slashslash.stem` / `mirroredflat` |
| bakiye ±4 | plain sharp / slashed flat | `sharp` / `flat.slash` |
| küçük ±5 | 1-stem 3-bar sharp / plain flat | `sharp.slashslashslash.stem` / `flat` |
| büyük ±8 | 2-stem 3-bar sharp / double-slashed flat | `sharp.slashslashslash.stemstem` / `flat.slashslash` |

So the two engravers disagree about **how** a sign is drawn and agree about **which** sign a comma
value gets. That is the condition for mixing both into one corpus.

## The pilot pool — `data/synthetic/_pilot_ly`

| | |
|---|---|
| pieces | the 6 of `data/pieces_geom_pilot.json` (one per makam, 40–80 measures, no exam overlap) |
| strips | **312**, carry (`measure`) mode only, whole measures under `STRIP_BUDGET` (4 / 56) |
| signature | the makam's conventional printed variant, seeded **`<slug>:c0:sig`** — the same variant the control arm wears |
| geometry | pinned to the corpus: 336 px tall, staff lines 30.0 px apart, top line at y = 138 |
| render cost | **112 ms/strip**, one LilyPond process per piece → **~76 min for a 40,826-strip corpus** |

⚠ **It draws no lyrics, repeat signs, volta brackets, navigation marks, distractor text or slur
distractors.** `render.ts` draws all of those on a seeded share. That is a recipe gap, not an
engraver property, and it is why some columns below are not comparable.

## The gate — PASS 312/312, 501 accidentals

`verify-labels-ly.ts` re-engraves every strip from its manifest label, identifies each drawn
accidental **by font outline**, and compares the sequence — in reading order, signature block
included — with the label's own accidental tokens; then checks the PNG's height and width.

| | |
|---|---|
| strips | 312 / 312 pass |
| accidentals compared | 501 |
| LilyPond bar-check failures | 0 |

Two things the build had to get right for that, both found by the gate rather than by reasoning:

- **Emmentaler is an optical-size family.** A grace note's accidental is a *different outline* from
  the full-size sign, so a table calibrated only at full size reported "no accidentals drawn" on a
  strip that visibly had two. The calibration now renders every sign twice, full size and on a
  grace note.
- **The label's own signature order is what LilyPond draws**, checked rather than assumed:
  `keyAlterations` preserves list order (measured on four orderings), so no reordering is needed.

## The domain gap — NULL on everything the instrument can see

Control: `_pilot_geom_m4`, the same 6 pieces through VexFlow, **carry-mode strips only** (226 of its
433 — the rest are transposed `every`-mode strips and are a different render mode, not a control).
Reports: `data/real/rung3/domain_gap/geom_m4_carry.json` vs `ly_pilot.json`.

| column | VexFlow | LilyPond | exam / nota / r1 | read |
|---|---|---|---|---|
| `spacing_px_sd` | 0.00 | 0.31 | 1.11 / 0.72 / 0.29 | ⚠ not engraving — see below |
| `thickness_px_mean` | 3.00 | 3.03 | 4.78 / 4.19 / 3.81 | unchanged, still far |
| `thickness_px_sd` | 0.00 | 0.23 | 2.08 / 1.61 / 1.03 | moved 11% of the way |
| `thickness_rel_to_spacing` | 0.100 | 0.101 | 0.157 / 0.139 / 0.127 | unchanged |
| `beam_span` mean (staff spaces) | 4.79 | 5.09 | 4.02 / 3.95 / 4.35 | **further** |
| `beam_span` p90 | 8.33 | 10.27 | 6.93 / 6.75 / 7.57 | **further** |
| `outside_band_%_of_ink` | 4.25 | 0.28 | 3.81 / 4.86 / 4.69 | further — the arm draws no lyrics |
| `notes_per_strip` | 8.67 | 10.47 | 7.19 / 7.70 / 8.15 | further — packing, see below |

**The verdict is null-to-slightly-worse.** Nothing here says a second engraver closes the
synthetic→real gap.

⚠ **`spacing_px_sd` is not evidence of engraver diversity.** The arm's staff size is pinned to the
corpus's, so LilyPond's drawn spacing is as constant as VexFlow's; the 0.31 px is where the staff
lands on the pixel grid after rasterising, not variation the engraver introduced.

⚠ **Two columns are confounded by the recipe, not the engraver.** `notes_per_strip` and the strip
widths: this arm packs **whole measures**, while `render.ts` packs at note level inside a VexFlow
row and so splits a dense measure across strips. And every `ink` column: no lyrics, no marks. The
per-100-note token rates differ for the same two reasons plus the signature-block share (37% coin
here); the note-side labels are byte-identical serializer output — verified on **163 shared measure
ranges with identical note labels**, of which **99** also agree on the signature block.

## ⚠ What this measurement cannot see

`domain_gap.py` measures staff geometry, ink outside the band, density, label content and beam
spans. A second engraver mostly changes things it does **not** measure: glyph shapes, note spacing
*within* a measure, stem lengths, beam angles, flag design. The side-by-side of 99 identically
labelled strips — `data/real/rung3/domain_gap/ly_vs_vexflow.png` — shows those differences plainly
while the table above barely moves.

So "no domain-gap improvement" is a statement about **this instrument**, not proof that a second
engraver is worthless. The claim a mixed corpus would need is an accuracy claim, and only a trained
arm can make it.

## ⚠ The geometry knob is a separate change, and neither arm pulls it

Lever 4's premise is "one engine, one font, **one spacing** — SD zero across all 40,826 strips". The
first two are now addressed and the third is **not**: this arm was deliberately pinned to the
corpus's staff size so that the engraver was the only variable. Varying document scale per strip
(`set-global-staff-size` here, the scale factor on the VexFlow side) is a one-line, engraver-neutral
change that neither renderer makes today, and it is the part of the premise that actually touches
the SD-zero number.

## What a full LilyPond corpus would still need

Owed before this arm could stand beside `strips_v4` rather than beside a control:

1. **Slur distractors** — the VexFlow corpus draws them on ~35% of renders and they took `\tup3`
   precision 15.1% → 91.2% ([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)). An arm without them
   teaches the opposite lesson.
2. **Repeats, voltas and navigation marks** — `ly-engrave.ts` throws on those tokens today rather
   than approximating them, and LilyPond expresses them by restructuring the music.
3. **Lyrics and distractor text** — the ink-outside-the-staff share the real pools are full of.
4. **`every` mode and the transposed share** — 25% of the corpus, and this arm renders none of it.
