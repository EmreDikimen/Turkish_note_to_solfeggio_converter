# Metrics — every headline number, once

purpose: the single home for measured numbers; other docs link here instead of restating
audience: agents and the owner, whenever a number is needed
updated: 2026-07-26

Raw run logs (settings, error dumps, export details) live in
[../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md). This file is the summary index.

**AEU headline** = mean per-class recall over the 8 Turkish accidentals. It is **recall-only**, so
mean **AEU F1** is reported beside it since Round 1. Both are *per-class means*, which makes them
**fragile to classes with few gold tokens** — see the low-n caveats below.

## Model quality — synthetic val (held-out pieces)

| Run | Date | Corpus | AEU | SER | Exact | Notes |
|---|---|---|---|---|---|---|
| Rung 2 | 2026-07-07 | strips_v2_1, 2,384 val strips | 99.9% (8/8) | 0.001 | 96.8% | first Colab Pro run, first try |
| Rung 2.2 | 2026-07-08 | strips_v2_2, 2,417 val strips | 99.9% (8/8) | 0.002 | 96.7% | + rhythm tokens: `\tup3` 100%, `\tie` 96.4%, `\grace` 98.0% |
| Rung 2.2b | 2026-07-09 | strips_v2_2 rebuilt, 23,391 strips | ~100% all AEU | — | — | `\tup3` 98.3% on 118 gold (was a 9-sample smoke signal), `\grace` 99.4% |
| Round 1 (no-regression check) | 2026-07-22 | 1,000-strip strips_v3 val subset | 93.0% | — | — | ⛔ fails the ≥99% clause; reference 99.9% was measured on the older v2_2, so it overstates forgetting |

## Model quality — real exam (never trained on, read once per round)

| Read | Date | Set | AEU recall | AEU F1 | SER | Exact |
|---|---|---|---|---|---|---|
| First real baseline *(superseded, LOW-N)* | 2026-07-12 | 33 strips | 83.3% | — | 0.018 | 78.8% |
| Exam v2.1 baseline | 2026-07-20 | 352 strips | 64.1% | 57.0% | 0.147 | 17.3% |
| Round 1, as read | 2026-07-22 | 352 strips | 66.6% | 67.0% | 0.059 | 49.1% |
| Round 1, contamination-corrected | 2026-07-22 | 327 clean strips | 66.26% | 66.53% | 0.0597 | — |
| Round 1, re-scored after gold re-audit | 2026-07-25 | 352 strips, 13 gold fixes | 78.5% | 78.0% | 0.059 | — |

- Exam v2.1 baseline per-source: neyzen 72.4%, nota 60.0%.
- Round 1 per-source AEU gap: **12.5pp → 0.3pp** (style overfit gone).
- ⚠ **~11 of the 12pp re-score jump is a metric artifact**, not model improvement: `\buyukSharp`
  (n=3, 0% recall) was corrected to n=0 and dropped out of the per-class mean. Token-level accuracy
  barely moved (SER 0.060 → 0.059).
- ⚠ **Contamination (found 2026-07-22):** 4 SymbTr pieces / 25 strips (7.1%) had their *other*
  engraving in the training pools. `strips_exam_v2_clean/` (327 strips) is the honest reference.

### Round-1 floors vs what was achieved (pre-registered 2026-07-20)

| Floor | Target | Baseline | Round 1 | |
|---|---|---|---|---|
| AEU headline | ≥85% | 64.1% | 66.6% | ⛔ |
| mean AEU F1 | ≥80% | 57.0% | 67.0% | ⛔ |
| `\tup3` recall | ≥85% | 92.7% | 72.7% | ⛔ |
| `\kucukSharp` recall | ≥75% | 22.6% | 58.1% | ⛔ |
| `\komaFlat` precision | ≥70% | 53.8% | 66.2% | ⛔ |
| `\tup3` precision | ≥70% | 15.1% | 93.0% | ✅ |
| arc-triggered false `\tup3` | ≤10% | 77.6% | 0.0% (0/85) | ✅ |
| SER | ≤0.06 | 0.147 | 0.059 | ✅ |
| exact match | ≥45% | 17.3% | 49.1% | ✅ |
| per-source gap | ≤12pp | 12.5pp | 0.3pp | ✅ |
| synthetic no-regression | ≥99% | 99.9% | 93.0% | ⛔ |

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
- **Frequency imbalance, still open:** `strips_v3` carries `\komaSharp` inline in **1,887** strips
  vs `\kucukSharp` in **206** (0.5%), and **zero** strips hold both.

## Corpora and pools

| Set | Size | Notes |
|---|---|---|
| strips_v2 | 18,624 strips / 150 pieces | 2026-07-05 |
| strips_v2_1 | 18,627 strips | + nav-mark tokens, centered-rest fix — what Rung 2 trained on |
| strips_v2_2 | 18,777 → 23,391 after the triplet expansion (190 pieces) | + rhythm tokens |
| **strips_v3** | **38,091 strips, 73.3% carry, 49 makams, 33 signature variants** | budget gate PASS (57 ids, cap 59) — the Round-1 corpus |
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
| Training strip geometry | H=336 px, staff spacing 30 px, top line y≈138; label cap 59 ids |
| Slicer staff-detection kernel | `STAFF_HOR_FRAC = 0.11` of page width (was `w/4`) |
