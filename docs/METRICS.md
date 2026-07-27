# Metrics — every headline number, once

purpose: the single home for measured numbers; other docs link here instead of restating
audience: agents and the owner, whenever a number is needed
updated: 2026-07-27

Raw run logs (settings, error dumps, export details) live in
[../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md). This file is the summary index.

**AEU headline** = mean per-class recall over the 8 Turkish accidentals. It is **recall-only**, so
mean **AEU F1** is reported beside it since Round 1. Both are *per-class means*, which makes them
**fragile to classes with few gold tokens** — see the low-n caveats below.

## Model quality — synthetic val (held-out pieces)

| Run | Date | Corpus | AEU | SER | Exact | Notes |
|---|---|---|---|---|---|---|
| Rung 2 | 2026-07-07 | strips_v2_1, 2,384 val strips | 99.9% (8/8) | 0.001 (S17 D84 I39 / N95,316) | 96.8% | first Colab Pro run, first try |
| Rung 2.2 | 2026-07-08 | strips_v2_2, 2,417 val strips | 99.9% (8/8) | 0.002 | 96.7% | + rhythm tokens: `\tup3` 100%, `\tie` 96.4%, `\grace` 98.0% |
| Rung 2.2b | 2026-07-09 | strips_v2_2 rebuilt, 23,391 strips | ~100% all AEU | — | — | `\tup3` 98.3% on 118 gold (was a 9-sample smoke signal), `\grace` 99.4% |
| Round 1 (no-regression check) | 2026-07-22 | 1,000-strip strips_v3 val subset | 93.0% | — | — | ⛔ fails the ≥99% clause; reference 99.9% was measured on the older v2_2, so it overstates forgetting |

## Model quality — real exam (never trained on, read once per round)

| Read | Date | Set | AEU recall | AEU F1 | SER | Exact |
|---|---|---|---|---|---|---|
| First real baseline *(superseded, LOW-N)* | 2026-07-12 | 33 strips | 83.3% | — | 0.018 | 78.8% |
| Exam v2.1 baseline | 2026-07-20 | 352 strips | 64.1% | 57.0% | 0.147 | 17.3% |
| Round 1, as read | 2026-07-22 | 352 strips | 66.6% | 67.0% | 0.059 | 49.1% |
| Round 1, contamination-corrected | 2026-07-22 | 327 clean strips | 66.63 → 66.26% | 66.98 → 66.53% | 0.0591 → 0.0597 | — |
| Round 1, re-scored after gold re-audit | 2026-07-25 | 352 strips, 13 gold fixes | 78.5% | 78.0% | 0.059 | — |
| **Round 2, read once** | **2026-07-27** | **326 clean strips** | **74.2%** | **73.9%** | **0.052** | **52.1%** |

### Round 2 vs Round 1 — identical 326 strips, identical re-audited gold

`round1-best` was scored on this exact set on 2026-07-25, so the comparison needs no adjustment.

| | Round 1 | Round 2 | Δ |
|---|---|---|---|
| mean AEU F1 | **78.0%** | **73.9%** | **−4.1pp** |
| AEU recall headline | 78.5% | 74.2% | −4.3pp |
| SER | 0.059 | **0.052** | better |
| exact match | 50.0% | **52.1%** | better |

### The product goal — corrections a user faces per page (baseline 2026-07-27)

From `eval_omr.py`'s `EDITS/PAGE` block on the 326-strip clean exam (46 pages, 7.1 strips/page).
One "edit" = one token substitution, deletion or insertion needed to turn the output into gold.

| | Round 2 | target |
|---|---|---|
| **pages needing ≤5 corrections** | **57%** | **≥90%** |
| median edits/page | 5 | — |
| mean edits/page | 12.2 | — |
| strips already perfect | 52% | — |

- The distribution is **heavily right-skewed** — median 5 against a mean of 12.2 — so the goal is
  stated on the *share of pages*, not the median. A median target would have been satisfied on the
  day it was written.
- ⚠ The exam is a **matched upper bound** (its pieces exist in SymbTr); real uploads will be worse.
- The second half of the goal — the app showing *where* the errors are — is unmeasured, because it
  does not exist yet. Finding 5 unknown errors among ~250 notes costs more than fixing them.

### Where the user's corrections actually go (2026-07-27) — accidentals are 13% of them

Every one of the 562 edits in the Round-2 exam read, classified by what the user would have to fix
(token-level alignment over the 156 mismatching strips in `data/colab/round2-exam-errors.txt`).

| what needs fixing | edits | share | excl. the 12 catastrophic strips |
|---|---|---|---|
| **pitch (letter/octave)** | 222 | **40%** | 36% |
| **duration** | 158 | **28%** | 29% |
| rhythm signs (tie/triplet/grace) | 74 | 13% | 16% |
| **accidentals** | 73 | **13%** | 13% |
| structure (barlines, repeats, nav) | 26 | 5% | 5% |
| signature delimiters | 9 | 2% | 1% |

- **Two rounds of work went into the 13%.** The old headline made accidentals look like the whole
  problem because it only measured accidentals.
- **Errors are concentrated:** 42 of 326 strips (13%) carry 63% of all edits; 11 strips carry 29%;
  12 strips are >50% wrong and carry 21%. Under the page-based goal, those are what push a page
  over the 5-correction line.
- **…but not only concentrated:** excluding the 12 catastrophic strips barely moves the mix, so
  pitch and duration are pervasively weak on ordinary strips too.
- Note-level substitution mix (96 subs): duration only 38%, multiple-differ 30%, letter only 27%,
  **octave only 5%**. Plus **55 whole notes inserted or deleted** — the model losing count, not
  misreading a glyph.

#### The crop-shape gap (the cause of the catastrophic strips)

| | signature-only strips |
|---|---|
| `strips_v4` (training) | **0 of 40,826** |
| exam v2.1 clean | **4 of 326**; 91 strips (28%) have ≤8 label words |

`stripExport` always builds chunks from whole measures, so a "clef + donanım, no notes" image
cannot occur in training — but the slicer produces them from real pages. The worst exam strip is
exactly that: gold `\sig \kucukFlat b \kucukFlat e \kucukFlat a \sigend`, decode a hallucinated
`\volta2 b'16 c''8 g''8 g''8` — **19 edits against 8 gold tokens.**

#### Gold octave errors — real, but NOT a lever (negative result, keep it)

All 5 octave-only substitutions are cases where the GOLD leaps ≥4 scale steps from both neighbours
while the model reads the stepwise line (e.g. gold `a''8` between `b'` and `g'`; model `a'8`).
They are almost certainly mislabels — consistent with the adjudication precedent of siding with the
decode 187:14. But the scale is small and the pools are clean:

| pool | strips | with an isolated octave spike |
|---|---|---|
| strips_nota | 1,747 | 1 (0.1%) |
| strips_r1 | 421 | 1 (0.2%) |
| strips_tup | 169 | 0 |
| strips_v4 | 40,826 | 36 (0.1%) |

≈1% of exam edits. Worth fixing for correctness; **not** an explanation for the pitch weakness.

### Re-scored under low-n-robust headlines (2026-07-27) — the regression was a metric artifact

Recomputed from the stored `per_class` blocks by `scripts/rung3/rescore_headline.py`; no model was
re-run, and no exam was re-read. **MICRO** pools tokens instead of classes (Σhit/Σgold), so one rare
class cannot swing it. **MACRO≥30** is the same per-class mean restricted to classes with ≥30 gold.

| 326 clean strips | Round 1 | Round 2 | Δ |
|---|---|---|---|
| macro recall *(the historical headline)* | 78.5% | 74.2% | −4.3pp |
| macro F1 | 78.0% | 73.9% | −4.1pp |
| **micro recall** | 83.9% | **84.8%** | **+0.9pp** |
| **micro F1** | **85.0%** | 84.8% | −0.2pp |
| **macro≥30 recall** | 81.4% | **84.8%** | **+3.4pp** |
| **macro≥30 F1** | 83.9% | **84.4%** | +0.5pp |

**Round 2 is not a regression.** On every low-n-robust measure it is flat-to-better, and that is
before counting SER, exact-match and the 9-of-11 floors. The −4pp came from `\komaSharp` (n=14)
inside a six-class average.

⚠ **Do not read the ~85% micro figures as hitting the 85% target.** That floor was pre-registered
against the MACRO mean; micro is a different, structurally higher number here because the
well-read common classes carry most of the tokens. Retrospectively, macro has been reporting
66–78% while token-level accidental accuracy sat at 83–85% for both models.

**Token-level accuracy improved; the per-class headline regressed.** Round-2 per-class recall:
koma♯ 21.4, bakiye♯ 91.7, küçük♯ 69.7, koma♭ 90.5, bakiye♭ 87.0, küçük♭ 85.0 → mean 74.2%.
`\komaSharp` (F1 **21.4%**, n=14) accounts for the whole drop: a mean over six classes moves ~4pp
when one class moves 25pp. Same low-n fragility flagged above.

Round-2 recall by print position (the split `eval_omr.py` now reports):

| | signature gold | signature recall | inline gold | inline recall |
|---|---|---|---|---|
| `\kucukSharp` | 32 | **72%** | 1 | 0% |
| `\komaSharp` | 12 | **8%** | 2 | 100% |
| `\bakiyeSharp` | 57 | 91% | 88 | 92% |
| `\kucukFlat` | 49 | 82% | 11 | 100% |

- **The targeted fix worked:** küçük-in-signature 50% (`round1-best`, photo gold) → **72%**; overall
  küçük recall 58.1% → 69.7%. Its precision fell **100% → 76.7%**, the pre-registered trade.
- **What replaced the old failure:** on the 156 mismatching strips the substitutions are
  `\kucukSharp → \komaSharp` **8×** and `\komaSharp → \kucukSharp` **7×**, **all 15 inside the
  `\sig` block**, with net `\komaSharp` emission of **0**.
- So the Round-1 error — one-directional, küçük read as koma, reverse essentially never — is gone.
  What remains is a **symmetric koma↔küçük discrimination failure confined to the key signature**.
  It is not a re-flipped bias; it is a coin flip, and it destroys `\komaSharp` because n=14.
- **Untested lead:** the glyph-fidelity work (`sharp_probe`, bar weight, küçük pitch widened to
  0.65 S) was measured on INLINE glyphs. Signature glyphs are packed at `SIG_GLYPH_ADVANCE = 13 px`
  and were never examined — and that is where 32 of the 33 küçük gold tokens live.

- Exam v2.1 baseline per-source: neyzen 72.4%, nota 60.0%.
- Round 1 per-source AEU gap: **12.5pp → 0.3pp** (style overfit gone).
- ⚠ **~11 of the 12pp re-score jump is a metric artifact**, not model improvement: `\buyukSharp`
  (n=3, 0% recall) was corrected to n=0 and dropped out of the per-class mean. Token-level accuracy
  barely moved (SER 0.060 → 0.059).
- ⚠ **Contamination (found 2026-07-22):** 4 SymbTr pieces / 25 strips (7.1%) had their *other*
  engraving in the training pools. `strips_exam_v2_clean/` (327 strips) is the honest reference.
  The correction also moved komaFlat precision 66.2 → 63.8%; the verdict was unchanged.
  ⚠ **The POOLS were only cleaned on 2026-07-26.** The train-time guard was added in July but the
  contaminated strips were never removed behind it, so they sat in the real pools until Round 2's
  shakeout refused to start. 14 strips dropped (11 `strips_nota`, 3 `strips_tup`); real pools are
  now 2,337 strips / 444 pieces, 0 in the exam. Originals kept as `manifest.jsonl.pre-examclean`,
  list in `data/real/rung3/excluded_exam_pieces.txt`.
- ⚠ **Second contamination channel (found 2026-07-26): the SYNTHETIC corpus.** 5 of the 190
  `strips_v3` pieces are exam pieces — `hisarbuselik--vuslata_nail`, two `kurdilihicazkar` şarkıs,
  `mahur--cihani_lal-i`, `nikriz--zeybek`. The train-time guard only checks the `--real-dir` pools,
  so our own render of an exam piece passed it. Excluded from the next corpus; the Round-1 numbers
  above were measured with them present.

### Round-1 floors vs what was achieved (pre-registered 2026-07-20)

Round 2 was read against the same floors (never re-registered, so the comparison stays honest).
Its column is measured on the 326-strip clean set; Round 1's is its original as-read 352.

| Floor | Target | Baseline | Round 1 | | Round 2 | |
|---|---|---|---|---|---|---|
| AEU headline | ≥85% | 64.1% | 66.6% | ⛔ | 74.2% | ⛔ |
| mean AEU F1 | ≥80% | 57.0% | 67.0% | ⛔ | 73.9% | ⛔ |
| `\tup3` recall | ≥85% | 92.7% | 72.7% | ⛔ | 83.8% | ⛔ |
| `\kucukSharp` recall | ≥75% | 22.6% | 58.1% | ⛔ | 69.7% | ⛔ |
| `\komaFlat` precision | ≥70% | 53.8% | 66.2% | ⛔ | 73.1% | ✅ |
| `\tup3` precision | ≥70% | 15.1% | 93.0% | ✅ | 91.2% | ✅ |
| arc-triggered false `\tup3` | ≤10% | 77.6% | 0.0% (0/85) | ✅ | 0.0% (0/81) | ✅ |
| SER | ≤0.06 | 0.147 | 0.059 | ✅ | 0.052 | ✅ |
| exact match | ≥45% | 17.3% | 49.1% | ✅ | 52.1% | ✅ |
| per-source gap | ≤12pp | 12.5pp | 0.3pp | ✅ | 0.0pp | ✅ |
| synthetic no-regression | ≥99% | 99.9% | 93.0% | ⛔ | not measured | — |

Round 2 clears one floor Round 1 missed (`\komaFlat` precision) and misses four. Against Round 1 it
is **better on every floor except the two headlines**, which the identical-set comparison above
shows moving the other way — the headline is a per-class mean and `\komaSharp` collapsed.

Ties deliberately carry **no floor** (their ground truth is ~38% structurally noisy); the
arc-triggered false-`\tup3` rate replaces them. Arc denominators: 85 tie-but-no-tup3 strips,
229 neither-token strips.

## Model quality — real-val (selection set, NOT a predictor)

| Arm | Date | mean AEU F1 | Notes |
|---|---|---|---|
| A — two-stage (winner) | 2026-07-22 | **89.2%** | synthetic-only 6k steps from BASE → 2k @ lr 1e-5 with real oversampled `:8` (real = 33.3%) |
| B — single-stage joint | 2026-07-22 | 78.4% | 7k steps, real at its natural 5.9% |

- Margin is **low-n driven**: `\komaSharp` (1 gold) + `\kucukSharp` (21) account for 10.4 of the
  10.8pp. On the four ≥30-gold classes the arms tie (92.7% vs 92.2%).
- Real signal: `\kucukSharp` recall 95.2% vs 61.9%; source consistency 0.6 vs 2.8pp.
- **Real-val 95.0% AEU vs exam 66.6% = a 28pp gap.** Tier decomposition: easy 96.8% vs 94.8%,
  mid 91.9% vs 63.0%, hard tier absent from real-val (0 strips) vs 58.3% on the exam.
  **Composition dominates; edition familiarity is small** (clean tiers agree within 2pp).

## Photo domain (phone photos of exam pieces — EXAM-ONLY)

| Measure | Value | Date |
|---|---|---|
| Slicer yield, before the photo front-end | 28% of pages / 106 strips (72% of pages yielded ZERO) | 2026-07-24 |
| Slicer yield, after | **97% of pages / 690 strips** | 2026-07-25 |
| Photo AEU, fitting-alignment estimate | ~61% recall / 75% F1 | 2026-07-25 |
| Photo AEU, hand-labelled gold (284 labelled, 272 scorable) | **73.7% recall / 75.9% F1** | 2026-07-25 |
| Photo vs clean gap | ≈3–4pp | 2026-07-25 |
| Unreadable even to a human | ~4% of strips | 2026-07-25 |

## The microtonal-sharp defect (measured against two real printed editions)

| Quantity | Real print | Bravura (ours, before) | Ours, after `--thin-sharps` |
|---|---|---|---|
| Sharp bar thickness | 0.300 S | 0.367 S (+22%) | 0.300 S |
| küçük bar pitch (spacing) | 0.550 S | 0.483 S (−14%) | 0.65 S (deliberately wider) |
| küçük white gap | 0.250 S | **0.116 S** (~1–2 px after the encoder shrink) | clears the shrink |

- koma/bakiye were never at risk (0.58–0.66 S gaps).
- The error was **one-directional**: gold `\kucukSharp` decoded as `\komaSharp` **11× on the clean
  exam, 10× on photos**; the reverse essentially never. Matches the 100%-precision / 48%-recall
  signature.
- Resolution was **ruled out**: recall does not fall with encoder scale (1.22 → 0.24) on either
  dataset; `\bakiyeSharp` holds 84–94% in every bucket.
### Where the sharps are PRINTED (measured 2026-07-26 — corrects the framing above)

Every gold and corpus label split into tokens inside the row-start `\sig … \sigend` block versus
tokens on a note. The scorers count both (no stripping), so both feed the AEU headline.

| Set | `\kucukSharp` on a note | `\kucukSharp` in the signature |
|---|---|---|
| Clean exam v2.1 (352 strips) | **1** | **30** |
| Clean exam, contamination-corrected (326) | 1 | 32 |
| Photo gold (109 hand-corrected labels) | 3 | 13 |
| `strips_v3` corpus | 234 tokens / 206 strips | 1,210 strips |

- **The class is scored almost entirely in the key signature**, not on noteheads. `\komaSharp` runs
  the same way on the exam (2 inline / 12 in-signature).
- Structural reason: the carry serializer's `sigTolerant` rule prints a note bare when its
  alteration runs the same direction as the signature's (SymbTr stores the SOUNDING value — eviç is
  a 5-comma F♯ printed bare under a koma-sharp-F signature). Real pages therefore rarely print
  küçük on a note at all. Verified end-to-end: a dry render of two küçük-heavy pieces under
  non-küçük signature variants produced **zero** inline `\kucukSharp`.
- **In the context that scores, `strips_v3` is not imbalanced**: küçük appears in 1,210 signature
  strips against koma's 1,422 (bakiye 6,512). The 9× "1,887 vs 206" gap below is an inline-only
  statistic about a context holding ~1 of the exam's 33 küçük tokens.
- The real corpus gap is **diversity, not count**: signature-position küçük comes from just **3
  makams** (mahur, nisaburek, süzidilara) and 4 distinct spellings.
- **Inline counts, for the record:** `strips_v3` carries `\komaSharp` inline in 1,887 strips vs
  `\kucukSharp` in 206 (0.5%), and zero strips hold both. Kept because it is a true statement about
  note-position coverage — it is simply not what the exam measures.

## Corpora and pools

| Set | Size | Notes |
|---|---|---|
| strips_v2 | 18,624 strips / 150 pieces | 2026-07-05 |
| strips_v2_1 | 18,627 strips / 470 MB | + nav-mark tokens, centered-rest fix — what Rung 2 trained on |
| strips_v2_2 | 18,777 strips / 474 MB → 23,391 after the triplet expansion (190 pieces) | + rhythm tokens |
| strips_v3 | 38,091 strips, 73.3% carry, 49 makams, 33 signature variants | budget gate PASS (57 ids, cap 59) — the Round-1 corpus |
| **strips_v4** | **40,826 strips / 202 pieces, 75.5% carry** | the Round-2 corpus (2026-07-26): thin sharps, the carry pixels-vs-labels fix, +23 küçük-bearing pieces, −5 exam pieces. Audit PASS. `\kucukSharp` in the signature 1,210 → **1,998** tokens; inline unchanged (206 → 209 strips). Val is `split_v3`'s **verbatim** (24 pieces / 4,772 strips) so v3-vs-v4 stays matched |
| Real training pool | 2,160 strips (1,758 nota + 418 neyzen, incl. 172 tup3) | after all promotes |
| Exam v2.1 (frozen) | **352 strips / 45 piece entries**, tup3 gold 55 groups | `testset.json` |
| Photo exam | 690 strips sliced, 284 hand-labelled | exam-only |
| Real corpus on disk | 798 PDFs → 1,259 page PNGs (89 makams) + 964 nota pieces / 1,227 pages | |

Exam v2.1 class gold: bakiyeSharp 117, bakiyeFlat 60, kucukFlat 54, natural 48, komaFlat 39,
kucukSharp 28, komaSharp 19 (18 scorable), buyukSharp 3 → 0 after the re-audit, buyukFlat 0.

## Label quality (measured by hand audits)

| Pool | Content-error rate | Date |
|---|---|---|
| neyzen auto-accepts (full audit, 84 strips) | 22.6% needed correction | 2026-07-12 |
| nota auto-accepts (69-strip sample) | 7.2% pitch-level | 2026-07-16 |
| exam v2 auto-accepts (all 63) | ~6% pitch/duration | 2026-07-17 |
| tup3 auto-accepts (78 strips) | 10% | 2026-07-19 |
| exam gold, full re-audit | 13 new label errors found (gold over-sized sharps) | 2026-07-25 |
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

Adjudication finding: when the label and the model's decode disagreed on an accidental, the
owner's fixes sided with the **decode 187 times vs SymbTr 14** — printed editions win accidental
disputes.

## Runtime / engineering

| Measure | Value |
|---|---|
| Model | `Flova/omr_transformer`, ~143M params |
| int8 ONNX bundle | 221 MB total (from ~830 MB fp32) |
| Browser decode | ~1.0–1.5 s/strip (`onnxruntime-web`, wasm threaded), session load ~3 s |
| Page decode (Mac, int8) | ~353 ms/strip ≈ 7.4 s/page |
| Round-1 ship gate | parity 10/10 fp32 + 10/10 int8; browser gate **19/20** — one double-dot token (`a''2..`) trips an ORT-web int8 numerics wobble, model-independent, logged not blocking |
| Round-2 ship gate (2026-07-27, live) | parity 14/14 fp32 + 14/14 int8; browser gate **27/28** — canvas (product) path 14/14, one *reference*-path strip drops a `\tup3`; deterministic, logged not blocking. Round-1's double-dot failure did not reproduce |
| That gate miss, measured | the flipped token is a real near-tie: `\tup3` **p=0.689** vs `e` **p=0.306** under Python-ORT int8 — the only token in the strip below 0.99 (next lowest 0.938). ORT-web wasm int8 tips it; the graph and the JS preprocessing are both exonerated |
| Training strip geometry | H=336 px, staff spacing 30 px, top line y≈138; label cap 59 ids |
| Slicer staff-detection kernel | `STAFF_HOR_FRAC = 0.11` of page width (was `w/4`) |
