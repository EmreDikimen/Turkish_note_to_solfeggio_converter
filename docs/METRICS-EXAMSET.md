# Metrics — the exam as an INSTRUMENT

purpose: what the one-shot exam is made of, how it was rebuilt, and how big it has to be — not what any model scored on it
audience: agents and the owner, whenever the question is about the exam itself rather than a result

updated: 2026-08-21

Split out of [METRICS-EXAM.md](METRICS-EXAM.md) on 2026-08-21, when that file crossed its 400-line
cap. The split is by genre: **METRICS-EXAM.md keeps what models SCORED**, this file keeps **what the
instrument IS** — its census, the 2026-08-21 rebuild, the hand audit of its auto-written labels, and
the sizing arithmetic behind the ±12-point interval. Plan and decisions: [rung3/exam.md](rung3/exam.md).

## ⭐ What the exam is MADE OF, and what it throws away (census 2026-08-20)

Counted off `testset.json` and `strips_exam_v2/` while answering "how much more exam should I
label?". Neither number had been written down, and both bear on the one-shot read.

**Pages: we own 67, we grade 46.**

| | count |
|---|---|
| exam pieces in `testset.json` | **45** |
| page images those pieces list — **all present on disk** | **67** |
| pages that produced graded strips | **46** (page 1 → 268 strips, page 2 → 58) |
| **pages owned, exam-only, and unused** | **21** |

Pages per piece: 24 pieces have 1, **20 have 2**, 1 has 3. The unused 21 are mostly the *second*
page of a piece whose first page was labelled. ⭐ **They cost nothing in training data** — their
pieces are already banned from training by the exam rule — so labelling them is the only way to grow
the exam that does not take a piece away from the model.

**Strips: 54% of the candidates on those pages are graded.**

| disposition | strips |
|---|---|
| in the clean exam (`strips_exam_v2_clean`) | **326** |
| dropped `split_wide` (crop cut at a gutter; fragment labels do not exist) | 203 |
| dropped `over_budget` (label exceeds the 59-id decoder budget) | 78 |
| dropped `empty_range` | 1 |
| **dropped total** (`emit_drops.csv`, over 33 distinct piece+page) | **282** |

⚠ **The drops are the wide and the dense strips, so the exam grades each page on its easier
material.** [rung3/round3-criteria.md](rung3/round3-criteria.md) §5 says this about tuplets only
("dense contiguous-triplet instrumentals remain unmeasured"); 282 against 326 makes it general. It
is a bias in the *matched upper bound* direction, i.e. it points the same way as the exam's other
known optimism, not against it.
⭐ Both drop reasons are blocked by the same two things — the 59-id ceiling and the absence of
fragment labels — which is why measuring that ceiling pays here as well as on training data
([BACKLOG.md](BACKLOG.md)).

**Per-class gold** (`testset.json`, v2.1 freeze): bakiyeSharp 141, kucukFlat 70, bakiyeFlat 66,
komaFlat 48, kucukSharp 31, komaSharp 18, buyukSharp 3, buyukFlat 0.

## ⭐ THE EXAM IS BEING REBUILT ON THE CURRENT SLICER (2026-08-20/21)

**How it started.** The exam-v3 growth queue was cut on the crops already on disk, and the owner
opened its first strip: a **265 px crop holding one measure**, notehead sliced by the frame, beams
outside it. The cause was not today's slicer — **no exam page had ever been re-sliced**. 0 of the 67
exist under `data/real/strips_v2`; every exam crop was 2026-07-15..17 output, four weeks after
`page_to_strips.py` was overhauled, exactly as [DECISIONS.md](DECISIONS.md) warned on 2026-07-28
(*"exam v3 needs the same treatment; until then the one-shot instrument measures a retired slicer"*).

**What re-slicing does to crop shape**, measured on the 21 growth pages (same music, two slicers):
median crop width **640 → 1031 px**, crops under 400 px **24% → 4%**, and rows needing a human
**297 → 214**. 4% is the frozen exam's own sliver rate, so the re-slice puts crop shape back where
it belongs.

**The owner's call, 2026-08-21: rebuild the whole exam, not just grow it** (*"I can make it from
scratch, it is okey. Just exam need to be okey."*). All 45 pieces / 67 pages were re-sliced into
`data/real/strips_examv3` and re-emitted:

| the whole exam, re-emitted | strips |
|---|---|
| auto-labelled by the emitter | **139** |
| **rows needing a human** (`examv3`) | **663** |
| dropped `split_wide` | 414 |
| dropped `over_budget` | 153 |
| pages producing anything | **64 of 67** |

## `examv3-full` — all 139 auto-accepts read by hand (2026-08-21, COMPLETE)

The exam's 139 emitter-written labels entered the exam with no human check. The owner read every
one. This is the audit exam v2 never got (it sampled **2** of its 63; a later full read corrected
**32 of 63 = 51%**).

| verdict | rows |
|---|---|
| `ok` | **120** |
| `fix` | **18** |
| `bad` | **1** |
| **wrong** | **19 of 139 = 13.7%** |

**13.7% against v2's 51% on the identical queue**, with the emitter settings, the labeler checkpoint
and the seed all byte-identical between the two runs — the re-slice is the only thing that changed
([METRICS-CORPUS.md](METRICS-CORPUS.md)). The rate held on every slice: 11% on pages v2 also graded
(n=37), 8% on the 21 pages new to the exam (n=13), 12% on rows no human had ever seen (n=24).

**What the 18 fixes actually were** — one bug plus two ordinary classes:

| correction | count | what it is |
|---|---|---|
| `\komaSharp` → `\kucukSharp` **inside `\sig`** | **7** | ⚠ not 7 mistakes but **one bug 7 times** — the model-voted signature override, [METRICS-CORPUS.md](METRICS-CORPUS.md) |
| `\tie` added | 3 | SymbTr and the printed page disagree about ties |
| `\repstart` / `\repend` / `\volta1` added | 7 | repeat structure — the same family as the dotted-barline finding |
| `\repstart` removed | 2 | the label claimed a repeat the page does not print |
| duration corrected | 3 | `d''2`→`d''4.`, `d''8`→`d''4`, `e''4`→`e''4.` |

⚠ **The counts are token changes, not rows** — one fix row can carry more than one. ⚠ **Outside the
signature bug the exam's auto-labels are close to clean**: what is left is 12 repeat/tie marks and 3
durations, and repeats/ties are where SymbTr and a printed edition differ by convention, not error.

## The 27 `gold_conflict` rows — read, and the fresh derivation mostly won (2026-08-21)

Where a hand correction from the frozen exam and a fresh SymbTr derivation disagreed on the same
music. All 27 judged against the picture:

| verdict | rows | meaning |
|---|---|---|
| `ok` | **14** | the fresh derivation is right; the carried gold is dropped |
| `fix` | **13** | neither side was right as written |

**What the 13 fixes changed** (token-level; one row can carry more than one):

| change | count |
|---|---|
| `\repend` / `\volta1` / `\repstart` added | **9** |
| `\komaSharp` → `\kucukSharp` **inside `\sig`** | **3** |
| `\repstart` removed | 1 |
| rhythm / grace corrections (`a''16` → `g''16 \grace a''8`, `f''8. e''16` → `f''8 e''8`, …) | 5 |

- ⭐ **The signature bug appears again**: 3 of these are the model-voted key signature
  ([METRICS-CORPUS.md](METRICS-CORPUS.md)) — **10 across the two queues read so far, still 10–0 in
  one direction**, and now on two differently-cut queues rather than one.
- ⭐ **Repeat structure is the other repeat offender**: 10 changes here are `\repstart` / `\repend` /
  `\volta1`. With `examv3-full`'s 12, that is **22 repeat/volta marks over 166 rows** — the largest
  correction class in the exam after the signature.
- ⚠ **12 of these rows were judged before the viewer bug was fixed** — the decode panel was blank and
  the carried gold was invisible. The verdicts stand and their outcome was right (`promote_labels`
  reads `label` for an `ok` row), but they were decided with less on screen than the layout implied.

## What happened to the 326 frozen gold labels (2026-08-21)

A gold label describes the music of an exact measure span, so it survives on any new crop holding
that span — a finer question than `check_crop_staleness.py`'s page-level one (which says 45 of 46
pages change). Per label:

| outcome | labels | what it means |
|---|---|---|
| **agreed** | **43** | the re-emitted label is identical to the gold — two SymbTr derivations agree, **no human needed** |
| **suggested** | 151 | the crop is in the queue anyway; the gold rides along in `corrected_label` as a pending suggestion |
| **conflict** | 27 | crop auto-accepted but its new label differs from the gold — queued for a human, gold pre-loaded |
| **lost** | **105** | no crop holds that music any more |

- **185 of the 663 queue rows arrive with text already in the edit box** (the 178 above plus 7
  corrections carried from the superseded first cut).
- The 105 lost break down as **88 re-packed** into a differently-bounded window, **10 whose new crop
  is dropped** (`split_wide` / `over_budget`), and 7 ambiguous matches.
- ⚠ **The 27 conflicts are the interesting rows**: a hand correction and a fresh derivation disagree
  on the same music. The first one read is a `\tie` present in the gold and absent from the new
  label, with the tie arc visible in the crop.

⚠ **The rebuilt exam grades MORE of each page**: ~12 candidate strips a page against the frozen
exam's 7.1, because it drops 567 of 1,369 candidates (41%) where v2 dropped 46% of a smaller pool.
A page measured on more of its own material collects more edits, so **the primary ("pages needing ≤5
corrections") will read lower on the new instrument than on the old one at equal model quality**.
The signed 75% floor was set against the old, easier instrument. This does not affect *fairness* —
the baseline re-score puts both models on the same set — but it does change what the floor means,
and that is the owner's to settle ([rung3/round3-criteria.md](rung3/round3-criteria.md) §3b).

**What it cost, page level vs label level** (`check_crop_staleness.py --root data/real/strips`, all
46 graded pages, measured before the rebuild was decided): 0 identical, **1** size-only, 8 measures
differ, **37 crop count differs** — i.e. "45 of 46 pages lose their labels". At *label* level the
loss is **105 of 326 (32%)**, because most labels move with their music. That gap is why the rebuild
kept 221 of them rather than starting blank.

## How big the exam has to be — the arithmetic behind the ±12 (2026-08-20)

The primary is a **share of pages**, so its precision is binomial in the page count. 95% half-width
at a true rate near the 75% floor, and — the more useful column — the score you would have to
measure before the interval's lower bound clears 75%:

| exam pages | 95% half-width | to *demonstrate* a pass, must measure |
|---|---|---|
| **46 — today** | **±12.5 pp** | ~86% |
| **67 — every page we already own** | **±10.4 pp** | ~84% |
| 92 | ±8.8 pp | ~83% |
| 113 | ±8.0 pp | ~82.5% |
| 200 | ±6.0 pp | ~81% |

- **Precision improves with the square root of the work**, so doubling the exam buys ~1.4×. There is
  no reachable size at which a near-boundary result becomes crisp.
- ⚠ **The last column is the one that decides policy.** With a 75% floor, a model that is genuinely
  at 78% cannot *demonstrate* a pass at any exam size this project can afford. That is an argument
  for reporting the interval, not for buying pages.
- Consequence, taken as a decision on 2026-08-20: grow to **67 and stop**, and report the interval
  beside the result. [rung3/exam.md](rung3/exam.md) · [DECISIONS.md](DECISIONS.md).
