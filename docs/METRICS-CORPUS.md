# Corpus and label quality — how good the DATA is

purpose: the single home for corpus sizes, pool composition and measured label-noise rates
audience: agents and the owner, whenever a question is about the data rather than the model
updated: 2026-08-15

Split out of [METRICS.md](METRICS.md) on 2026-07-28 when that file crossed the 400-line cap. The
split is by genre: METRICS.md keeps **how well the model reads**, this file keeps **what the data is
and how trustworthy its labels are**. Model-quality numbers stay there; nothing is duplicated.

## Corpora and pools

| Set | Size | Notes |
|---|---|---|
| strips_v2 | 18,624 strips / 150 pieces | 2026-07-05 |
| strips_v2_1 | 18,627 strips / 470 MB | + nav-mark tokens, centered-rest fix — what Rung 2 trained on |
| strips_v2_2 | 18,777 strips / 474 MB → 23,391 after the triplet expansion (190 pieces) | + rhythm tokens |
| strips_v3 | 38,091 strips, 73.3% carry, 49 makams, 33 signature variants | budget gate PASS (57 ids, cap 59) — the Round-1 corpus |
| **strips_v4** | **40,826 strips / 202 pieces, 75.5% carry** | the Round-2 corpus (2026-07-26): thin sharps, the carry pixels-vs-labels fix, +23 küçük-bearing pieces, −5 exam pieces. Audit PASS. `\kucukSharp` in the signature 1,210 → **1,998** tokens; inline unchanged (206 → 209 strips). Val is `split_v3`'s **verbatim** (24 pieces / 4,772 strips) so v3-vs-v4 stays matched |
| **strips_v5_tupnew / _tupctl** | **40,826 strips / 202 pieces each** (40,841 rendered, the same 15 boundary-bleed strips excluded) | the tuplet A/B's two arms (2026-08-14), from `data/pieces_v4.json` with `--thin-sharps` and no print noise. **Row-for-row identical to `strips_v4`** — same image set, and every field including the label matches on all 40,826. The arms differ from each other in **1,691 PNGs**: 1,690 curved-style `\tup3` strips plus one 20-pixel crop-edge bleed; the 379 `\tup3` strips that are pixel-identical are exactly the 22 bracket-style pieces. Protocol: [rung3/round3-criteria.md](rung3/round3-criteria.md) |
| Real training pool | 2,160 strips (1,758 nota + 418 neyzen, incl. 172 tup3) | after all promotes |
| Exam v2.1 (frozen) | **352 strips / 45 piece entries**, tup3 gold 55 groups | `testset.json` |
| Photo exam | 690 strips sliced, 284 hand-labelled | exam-only |
| Real corpus on disk | 798 PDFs → 1,259 page PNGs (89 makams) + 964 nota pieces / 1,227 pages | |

Exam v2.1 class gold: bakiyeSharp 117, bakiyeFlat 60, kucukFlat 54, natural 48, komaFlat 39,
kucukSharp 28, komaSharp 19 (18 scorable), buyukSharp 3 → 0 after the re-audit, buyukFlat 0.

## ⚠ `_realval_v2` has 5 DUPLICATE MANIFEST ROWS, 4 of them contradictory (found 2026-08-16)

Found incidentally while checking pad-directory integrity for the crop-geometry probe. The pool has
**267 rows over 262 distinct images**: five PNGs appear twice, and **four of the five carry two
different labels for the same pixels**, so at least one gold string in each pair is wrong. They are
not near-misses — e.g. `bakma_sakin_benden_yana_nota_p1_s02_w01.png` is scored against both
`r8 f'8 g'8 a'8 b'8. d''8 c''8 b'8 | a'8. f'16 g'8 e'8` and `f'4. c''8 d''8 e''8 f''4 \segno`.

- **Scope: `_realval_v2` only.** `strips_exam_v2_clean` (326), `_tupletval` (28) and `strips_nota`
  (1,740) each have zero duplicate rows.
- **Effect:** every recorded `_realval_v2` number counts those 5 images twice and scores 4 of them
  against a label that cannot be right — ~1.9% of the pool. Small, but it inflates the pool's error
  floor and it is in the tuplet A/B's guard number and the geometry probe's holdout baseline alike.
- **Not a threat to a PAIRED result**: the duplicates are identical in every arm, so they cancel in
  a delta. The geometry probe's `--compare` deduplicates by filename (n=262) and reproduces the same
  monotone rise, which is what says so.
- **Owed:** de-duplicate and re-derive, then re-check whether any *other* pool built by the same
  path shares the defect. Until then, quote `_realval_v2` absolutes with this caveat.

## Label quality (measured by hand audits)

| Pool | Content-error rate | Date |
|---|---|---|
| neyzen auto-accepts (full audit, 84 strips) | 22.6% needed correction | 2026-07-12 |
| nota auto-accepts (69-strip sample) | 7.2% pitch-level | 2026-07-16 |
| exam v2 auto-accepts (all 63) | ~6% pitch/duration | 2026-07-17 |
| tup3 auto-accepts (78 strips) | 10% | 2026-07-19 |
| exam gold, full re-audit | 13 new label errors found (gold over-sized sharps) | 2026-07-25 |
| **nota training pool, review of every disagreeing strip** | **521 of 1,740 strips (30%) carry a human-corrected label**; of the strips where label and decode disagreed at all, **~78% of the labels were wrong** | 2026-07-27 |
| Tie structure in nota pool | ~38% structurally noisy (why ties carry no floor) | 2026-07-20 |
| **`strips_v3` carry strips: accidental DRAWN but not labelled** | **18.8% of signature-bearing carry strips** (5,240 / 27,933; 8,485 accidentals over 137 pieces) | 2026-07-26 |

### The carry pixels-vs-labels defect (found 2026-07-26, fixed at source)

`sigTolerant` — print a note bare when its alteration runs the same direction as the signature's —
was applied on the LABEL side for every carry strip (`stripExport.ts` passes it) but had no
counterpart in `SheetView`'s drawing decision, which marked every deviation. Same document, same
signature, two coverage rules.

| class | drawn but unlabelled | correctly labelled inline |
|---|---|---|
| `\kucukSharp` | **2,369** | 234 |
| `\kucukFlat` | 1,749 | 788 |
| `\komaSharp` | 1,364 | 2,829 |
| `\komaFlat` | 1,268 | 9,896 |
| `\bakiyeFlat` | 872 | 12,843 |
| `\bakiyeSharp` | 863 | 24,015 |

- **91% of the küçük sharps drawn on a notehead in `strips_v3` are labelled as nothing** — the model
  was shown the glyph and told there was nothing there. That is a direct mechanism for its measured
  signature: 48% recall at **100%** precision (it under-fires, it never over-fires).
- ⚠ **Round-1 caveat:** `round1-best` trained on this corpus, so its microtonal-sharp numbers
  reflect label noise as well as Bravura's bar weight. The two causes are not separated by any
  measurement taken so far.
- Fixed in `SheetView` (draw bare, matching real editions and the label) — pixels-only: labels over
  a re-rendered piece were byte-identical, and genuine deviations (direction change, cancel to
  natural) still print.

### Pixels-vs-labels verification of `strips_v4` (`tools/render/verify-labels.ts`, 2026-07-26)

Every job re-opened from the manifest, every accidental glyph read out of the live SVG and matched
against the label of the crop it falls in — signature block included.

| | |
|---|---|
| strips checked | **40,841** (1,020 jobs, whole corpus) |
| exact | **40,826** |
| flagged | 15 (0.037%) — all **excluded** from the manifest |
| label drift vs the manifest on disk | **0** |
| unrecognised glyphs | none |

- **Positive control:** with the `sigTolerant` fix temporarily reverted, the same verifier flagged
  **15 of 30** strips on three known-bad v3 jobs, every delta exactly `\kucukSharp` drawn-but-
  unlabelled. The test detects the defect class it exists for.
- The 15 flagged strips are **crop-boundary bleed**, not a rule disagreement: measure boxes do not
  split exactly between glyphs, so a crop occasionally clips the neighbouring measure's accidental —
  they occur in ± pairs on adjacent strips. Geometric and pre-existing (v3 has it too). Listed in
  `data/synthetic/strips_v4/excluded_boundary_bleed.txt`; PNGs left on disk, rows removed from the
  manifest, so the shipped corpus is 40,826 strips.
- ⚠ **`strips_v4` and the 2026-08-14 re-render are NOT pixel-equal, and the difference is not ours.**
  Every one of the 40,826 shared strips differs — non-tuplet strips included — by a mean absolute
  **0.3–4.8 grey levels of 255**, with no integer shift (dx=dy=0 minimises the error), ink fraction
  equal to four decimals, and no visible difference side by side. The labels are byte-identical and
  no renderer constant moved (`--thin-sharps` was already in v4; print realism is off), so this is a
  rasterizer/Chromium change since 2026-07-26. Recorded because sub-visual has bitten this project
  twice — the 22%-too-thick sharp bars and the 2% pre-shrink were both invisible to the eye.
- **Re-verified 2026-08-14 on both tuplet-A/B arms**: 40,841 checked, **40,826 exact, 15 flagged, 0
  drift** on each — and the flagged 15 are the **same filenames** as v4's. A redraw that moved a label
  would have shown up here as a different set; it did not. Both arms follow v4's convention:
  `manifest.full.jsonl` keeps everything, `manifest.jsonl` ships the clean subset,
  `excluded_boundary_bleed.txt` names what left.

⚠ **The 30% figure is over the REVIEWED population, not a random sample.** Every strip checked so
far was selected for being suspicious — high decode disagreement, or flagged by the low-confidence
rule. The 556 still-unverdicted strips all have `nd = 0` and were never flagged, so they are likely
the cleanest slice; their error rate is unmeasured. The July figure (7.2% pitch-level on a random
69-strip sample) and this one answer different questions.

Adjudication finding: when the label and the model's decode disagreed on an accidental, the
owner's fixes sided with the **decode 187 times vs SymbTr 14** — printed editions win accidental
disputes.

