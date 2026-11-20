# Metrics — the real exam

purpose: every number the one-shot exam produced, what the exam is made of, and the numbers of Round 3's follow-up runs and Round 4's vocabulary A/B
audience: agents and the owner, whenever an exam result is quoted or compared

updated: 2026-11-20

Split out of [METRICS.md](METRICS.md) on 2026-08-11, when that file reached its 400-line cap — this
section was 188 of its 399 lines. **Nothing here changed in the move.** Every other measured number
still lives in [METRICS.md](METRICS.md); raw run logs are in
[../ml/omr/MODEL_EVAL.md](../ml/omr/MODEL_EVAL.md).

⚠ **The exam is one-shot**: `data/real/rung3/testset.json` pieces are never trained on, and the exam
is read once per round on the final model. All iteration happens on real-val, which
[METRICS.md](METRICS.md) warns does **not** predict this number — the measured gap is 28pp.

⚠ **The AEU headline is a per-class mean and is fragile to low-n classes.** Quote micro and
macro≥30 beside it; see the caveats in [METRICS.md](METRICS.md).

## Errors by MUSICAL FORM (2026-08-17) — ⛔ THE LEAD IS DEAD; THE TABLE IS KEPT

⛔ **Read this before quoting anything below.** Measured because the owner reported the app failing on
classical pieces — then **retested the same week and withdrew the report**. The mechanism had already
half-failed a confound check (beste/nakış are *simpler* than şarkı on every countable property), and
the other half — "they are worse SCANS, `nd` 0.167 vs 0.070" — is **withdrawn as circular**, since
`nd` is a label-vs-decode disagreement and so restates this table rather than explaining it
([METRICS-CORPUS.md](METRICS-CORPUS.md)). The table is correct arithmetic on a spent dump; it is
**not evidence of a form effect** and no plan may be built on it. Full account:
[log/superseded.md](log/superseded.md).

Bucketing the **already-spent** Round-2 exam error dump by the form in each strip's `piece` slug:

| form | strips | gold tokens | edits | ed/token |
|---|---|---|---|---|
| marş | 13 | 126 | 46 | **0.365** |
| nakış | 24 | 269 | 73 | **0.271** |
| beste | 26 | 227 | 61 | **0.269** |
| sirto | 9 | 92 | 15 | 0.163 |
| ağırsemai | 2 | 26 | 3 | 0.115 |
| **şarkı** | **194** | 2166 | 201 | **0.093** |
| kâr-ı nâtık | 5 | 55 | 4 | 0.073 |
| zeybek | 4 | 92 | 6 | 0.065 |
| yürüksemai | 43 | 455 | 20 | 0.044 |
| peşrev | 6 | 103 | 4 | 0.039 |

**Non-şarkı runs 1.73× şarkı's rate (0.161 vs 0.093), and beste/nakış run ~2.9×.**

- ⚠ **"Classical" is the wrong category** and the table says so: peşrev (0.039) and yürüksemai (0.044)
  are the *best* rows. What is expensive is the dense ornate **vocal** forms — beste, nakış — plus
  marş, which is not Turkish art music at all. Any explanation has to fit that shape.
- ⚠ **Tiny n per form**: ağırsemai 2 strips, kâr 5, peşrev 6, zeybek 4, sirto 9, marş 13. Only şarkı
  (194) and yürüksemai (43) carry any weight. Treat everything else as a direction.
- ⚠ Totals are `crop_geometry_probe`'s own re-alignment (433 edits where `eval_omr` reports 562), so
  ratios only — never quote these as absolutes.

**The one line here that outlives the retraction: the exam's composition.** The exam is **68.9% şarkı**
(31 of 45 entries) against a training corpus that is 52.9% şarkı — so it is *more* song-weighted than
the data. That was written as "the exam cannot see the form defect"; there is no form defect, so it
now stands only as a **description of the exam's mix**, worth knowing whenever exam v3 is composed.
It is not an argument for weighting v3 by form.

**Training coverage, for the record** ([../data/pieces_v4.json](../data/pieces_v4.json), 208 pieces):
beste **3.8%**, nakış **1.4%**, ağırsemai 1.9%, kâr **0%** — which does line up with the ranking
above. ⛔ **Not a coverage argument**: the lead died by owner retest, and at n = 2–26 strips per form
this table cannot carry one either way. ⚠ An earlier version blamed "scan age" — withdrawn as
circular, same reason as above.

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

### The exam as an instrument → [METRICS-EXAM.md](#metrics--the-exam-as-an-instrument)

Moved there on 2026-08-21 when this file hit its cap: **what the exam is made of** (census, the 41%
of candidates it throws away), **the 2026-08-21 rebuild** on the current slicer, **`examv3-full`**
(all 139 auto-accepts read by hand: 13.7% wrong against v2's 51%), **what happened to the 326 frozen
gold labels**, and **how big the exam has to be** (the ±12-point arithmetic). This file keeps the
scores.

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

Recomputed from the stored `per_class` blocks by `ml/labels/rescore_headline.py`; no model was
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

⚠ **These are Rounds 1 and 2's floors. Round 3 has its OWN, signed 2026-08-15** —
[archive/rounds.md](archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol), where the pass/fail number is the product one
(≥75% of pages needing ≤5 corrections) and the accidental measures below become no-regression
clauses. Do not judge Round 3 against this table.

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

Round 2 clears one floor Round 1 missed (`\komaFlat` precision), misses four, and is better on every
floor except the two headlines — a per-class mean that `\komaSharp` collapsed. Ties carry **no
floor** on purpose (~38% structurally noisy gold); the arc-triggered false-`\tup3` rate replaces
them, over 85 tie-but-no-tup3 and 229 neither-token strips. Full reasoning:
[archive/rounds.md](archive/rounds.md#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim).

**Merged into this file on 2026-11-20:**

- [Metrics — the exam as an INSTRUMENT](#metrics--the-exam-as-an-instrument) — was `docs/METRICS-EXAM.md`
- [Metrics — Round 3's two follow-up runs (A and B)](#metrics--round-3s-two-follow-up-runs-a-and-b) — was `docs/METRICS-EXAM.md`
- [Round 4's vocabulary A/B — how it is scored, and what the kit measured before any GPU ran](#round-4s-vocabulary-ab--how-it-is-scored-and-what-the-kit-measured-before-any-gpu-ran) — was `docs/METRICS-EXAM.md`


## Metrics — the exam as an INSTRUMENT

*Was `docs/METRICS-EXAM.md` (last updated 2026-08-31).*

Split out of [METRICS-EXAM.md](METRICS-EXAM.md) on 2026-08-21, when that file crossed its 400-line
cap. The split is by genre: **METRICS-EXAM.md keeps what models SCORED**, this file keeps **what the
instrument IS** — its census, the 2026-08-21 rebuild, the hand audit of its auto-written labels, and
the sizing arithmetic behind the ±12-point interval. Plan and decisions: [rung3/README.md](rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3).

### ⭐ What the exam is MADE OF, and what it throws away (census 2026-08-20)

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
material.** [archive/rounds.md](archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) §5 says this about tuplets only
("dense contiguous-triplet instrumentals remain unmeasured"); 282 against 326 makes it general. It
is a bias in the *matched upper bound* direction, i.e. it points the same way as the exam's other
known optimism, not against it.
⭐ Both drop reasons are blocked by the same two things — the 59-id ceiling and the absence of
fragment labels — which is why measuring that ceiling pays here as well as on training data
([BACKLOG.md](BACKLOG.md)).

**Per-class gold** (`testset.json`, v2.1 freeze): bakiyeSharp 141, kucukFlat 70, bakiyeFlat 66,
komaFlat 48, kucukSharp 31, komaSharp 18, buyukSharp 3, buyukFlat 0.

### ⭐ THE EXAM IS BEING REBUILT ON THE CURRENT SLICER (2026-08-20/21)

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

### `examv3-full` — all 139 auto-accepts read by hand (2026-08-21, COMPLETE)

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

### The 27 `gold_conflict` rows — read, and the fresh derivation mostly won (2026-08-21)

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

### What happened to the 326 frozen gold labels (2026-08-21)

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
and that is the owner's to settle ([archive/rounds.md](archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) §3b).

**What it cost, page level vs label level** (`check_crop_staleness.py --root data/real/strips`, all
46 graded pages, measured before the rebuild was decided): 0 identical, **1** size-only, 8 measures
differ, **37 crop count differs** — i.e. "45 of 46 pages lose their labels". At *label* level the
loss is **105 of 326 (32%)**, because most labels move with their music. That gap is why the rebuild
kept 221 of them rather than starting blank.

### ⭐ THE REBUILT EXAM IS PROMOTED AND THE BASELINE IS RE-MEASURED ON IT (2026-08-31)

`promote_labels.py --dir data/real/rung3/strips_exam_v3 --exam --strips-root data/real/strips_examv3`.
**`strips_exam_v3` is now the exam**; `strips_exam_v2_clean` stays frozen as the record of what
Round 2 was graded on.

| | frozen v2 | **rebuilt v3** |
|---|---|---|
| graded strips | 326 | **660** |
| graded pages | 46 | **63** |
| strips per page | 7.1 | **10.5** |

Of 663 verdicted review rows, 61 are `bad` (not gradeable by construction) and **80 were refused by
the promotion gates**: 77 genuinely over the 59-id budget, 2 `ok` verdicts on rows carrying **no
label at all** (`row_unaligned` — an empty label is not gold), and 1 round-trip failure (below).
⚠ **The 64th page is gone**: `vuslata_nail_de_etse_ger_felek_nota_p1` lost every candidate to the
budget. Page overlap with the frozen exam: **44 shared, 19 never graded before, 2 dropped.**

⚠ **27 rows were nearly lost to a metadata mismatch, not to a bad label.** Their queue `piece`
column holds the **SymbTr** stem where `load_piece_meta` keys on the **source** stem, and a metadata
miss REJECTS a row — 27 hand-verdicted rows would have left the exam silently, taking 8 pages out of
PAGE-COMPLETE. `promote_labels.py` now falls back to the strip FILENAME, which is unambiguous.
Validated before it was trusted: it agrees with the `piece` column on **636 of 636** well-formed rows
and resolves **27 of 27** broken ones. ⛔ Not reverse-mapped by SymbTr stem — two of the eight pieces
have two source editions (a *nota* and a *ney* print), so that key is ambiguous where this one is not.

#### ⛔ ROUND 3'S EXAM RESULT (2026-09-01) — 51%, A MISS, AND THE GAIN IS MOSTLY `\tie`

`r3-final-stage2-last` (chosen over `best` on `_realval_v2`), `examv3`, read once.

| | Round 2 baseline | **Round 3** | change |
|---|---|---|---|
| **pages ≤5 corrections — THE PRIMARY** | 44% | **51%** | **+7 pp** |
| median edits/page | 6 | **5** | −1 |
| mean edits/page | 10.0 | 9.8 | flat |
| strips already perfect | 75.2% | 74.2% | −1.0 |
| SER | 0.027 | 0.026 | flat |
| mean per-class AEU recall | 90.5% | 89.1% | −1.4 |
| mean per-class AEU F1 | 84.5% | **78.0%** | **−6.5** |

⛔ **51% against a floor signed at 75% (62% on the re-expressed reading). It misses either way**, and
at 63 pages the 95% half-width is ~±12 pp, so **+7 is inside the noise band** — not a demonstrated
improvement. ⚠ The primary rose while every strip-level metric went flat or slightly down: the error
distribution tightened at the *median* (6 → 5 edits/page) while the *mean* barely moved, so more pages
crossed under the threshold without fewer errors overall.

**What is left between the two models once the confounds come out.** Measured in label-token space
(`error_taxonomy.py`), where both sides get identical treatment and nothing is re-tokenized:

| layer | R2 edits | R3 edits | R2 ≤5 | R3 ≤5 | gap |
|---|---|---|---|---|---|
| as read | 567 | 368 | 48% | 65% | **+17 pp** |
| **minus the retired `\tie`** | 380 | 368 | 63% | 65% | **+2 pp** |
| minus `\tie` + navigation signs | 363 | 341 | 63% | 65% | +2 pp |
| minus `\tie` + all repeat structure | 352 | 337 | 63% | 67% | +3 pp |

⛔ **~15 of the 17 points is `\tie`** — the token retired 2026-08-22, which Round 2 still emits and
`examv3` gold does not contain. ⚠ **A precise tie-adjusted OFFICIAL primary is not claimed**: the
official number is id-space, and reconstructing id sequences from decoded text is lossy — the
reconstruction reproduces Round 3's 51% exactly but not Round 2's 44%. The *proportion* above is
trustworthy because it never re-tokenizes; the adjusted absolute is not.

⭐ **THE RESIDUAL, BY TOKEN CLASS** (`\tie` and navigation removed; negative = Round 3 better):

| class | net edits R3 − R2 |
|---|---|
| note/rest | **−15** |
| sig-marker | **−8** |
| repeat-bar | −5 |
| tuplet | **+1** |
| grace | +1 |
| accidental | **+2** |
| barline | **+2** |

⛔ **THE THREE RENDER FLAGS SHOW NO BENEFIT, AND THE CLASSES THEY TARGETED ARE THE ONES THAT GOT
WORSE.** `--concave-tuplet` aimed at tuplet (**+1**), `--usul-barline` at barline and false
`\repstart` (**+2**), `--staccato-noise` at duration/accidental (**accidental +2**). Every one is flat
or slightly negative. What improved is **note/rest (−15)** and **signature markers (−8)** — consistent
with the real training pool growing 72% (2,059 → 3,539 train-side strips), not with the render.
⚠ Total residual is **22 edits of 363, about 6%**, at n = 660 strips — small, and no significance test
is claimed for it.

⚠ This vindicates the 2026-08-31 pre-registration that a three-flag render makes a general movement
unattributable. The two flags that kept their own paired instruments can still be read on those; the
concave tuplet mark never had one and now has no general movement to claim either.

#### The Round-2 baseline on the rebuilt exam — §3b's precondition 2, DONE

`eval_omr.py --checkpoint data/checkpoints/round2-stage2-best --strips-dir data/real/rung3/strips_exam_v3
--split none`, 660 strips, ~5 min on the laptop. **This is the baseline column of every floor pair in
[archive/rounds.md](archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) §1**, and it was measured *before* any Round-3
model exists, which is what keeps §3c's choice legal.

| | frozen v2 (Round 2) | **rebuilt v3 (same model)** |
|---|---|---|
| **pages needing ≤5 corrections — THE PRIMARY** | **57%** | **44%** |
| median edits/page | 5 | 6 |
| mean edits/page | 12.2 | **10.0** |
| strips already perfect | 52% | **75%** |
| mean per-class AEU recall | 78.5% | **90.5%** |
| mean per-class AEU F1 | 78.0% | **84.5%** |
| SER | 0.059 | **0.027** |
| exact match | 50.0% | **75.2%** |

⭐ **Read that table twice — it does not say the model got worse.** Every *strip-level* number
improves sharply, and the **primary still falls 13 points**. The two are not in conflict: the primary
counts corrections **per page**, and the rebuilt exam grades **10.5 strips a page against 7.1**. Each
strip is cleaner, and there are half again as many of them, so more pages cross the 5-edit line.
Mean edits/page falls 12.2 → 10.0 while the *share* under 5 falls — the signature of a
right-skewed distribution being sampled more densely.

⚠ **The 57% → 44% move mixes THREE changes and must not be quoted as "the re-cut cost 13 points".**
(1) the crops were re-cut on the current slicer, (2) the strips-per-page rose 7.1 → 10.5, and (3)
**19 of the 63 pages had never been graded at all**. Separating them would need a per-page edit dump
restricted to the 44 shared pages; `eval_omr.py` persists only the aggregates today, so it has **not
been done** and no split of the 13 points between the three is claimed here.

⚠ **`\komaSharp` is the weak class and stays weak**: 65.0% recall / 48.1% precision at n=20 — under
the LOW-N line, and the same koma/küçük confusion that [BACKLOG.md](BACKLOG.md) item 9 tracks in the
signature vote. `\buyukFlat` is absent from the exam entirely and `\buyukSharp` has n=1.

⚠ **One exam row is refused and it is the OWNER'S call, not a typo to guess at.**
`hicazkar_sirto_sebuh_efendi_kemani_p1_s04_w00` fails the round-trip gate on `bad sig token '\segno'`:
the hand correction reads `… \bakiyeSharp f \bakiyeSharp \segno c \sigend \repstart …`, i.e. a
`\segno` landed **inside** the `\sig` block and split the `\bakiyeSharp c` pair. The model's decode
puts `\segno` **before** the signature. Where the sign actually belongs is a question about the
image, so it is left rejected rather than repaired by inference.

### How big the exam has to be — the arithmetic behind the ±12 (2026-08-20)

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
  beside the result. [rung3/README.md](rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3) · [DECISIONS.md](DECISIONS.md).


## Metrics — Round 3's two follow-up runs (A and B)

*Was `docs/METRICS-EXAM.md` (last updated 2026-09-19).*

Round 3's exam was read on 2026-09-01 for `r3-final-stage2-last` and it missed
([METRICS-EXAM.md](#metrics--the-exam-as-an-instrument)). The owner then ordered two more trainings — *"round 3 is
not over. I will make 2 new trainings"* — and this file holds what they measured. ⚠ **Both are the
SAME ROUND as that exam read**, so neither has been near the exam; every number here is `_realval_v2`,
which **selects** and does not predict the exam (Round 1 it was out by 28 points).

### ⛔ The headline: all three models are indistinguishable

Every comparison below is `paired_arm_score.py` on `_realval_v2`, **262 unique strips**, both models
reading the same strips, with the tool's two pre-registered statistics.

| comparison | control edits | arm edits | mean diff / strip | 95% CI | sign test | verdict |
|---|---|---|---|---|---|---|
| Run A `best-real` (step 2500) vs `r3-final-stage2-last` | 667 | 656 | −0.042 | [−0.160, +0.073] | 15 / 15, p = 1.000 | **NULL** |
| Run B `last` (step 5000) vs `r3-final-stage2-last` | 667 | 645 | −0.084 | [−0.218, +0.046] | 19 / 16, p = 0.736 | **NULL** |
| Run B `last` vs Run A `best-real` | 656 | 645 | −0.042 | [−0.145, +0.057] | 17 / 15, p = 0.860 | **NULL** |

Exact-match over the same 262 strips: `r3-final-stage2-last` **68.3%**, Run A **69.1%**, Run B
**69.5%** — a spread of **3 strips**. ⭐ **Round 3's shipped choice stands. Neither a longer schedule
nor a second cut of the same music moves real-page accuracy.**

⚠ **The B-vs-A row carries TWO differences, not one.** Run B was to have been Run A plus the extra
pool; the owner set stage 2 to 5,000 steps where A ran 4,000 (2026-09-01), so a B-vs-A gap could not
have been attributed to the data anyway. It is moot here — the row is a null — but it is the reason
this file does not claim the extra data was isolated.

### Round 3's own checkpoint choice and its real-val position (2026-09-01)

Both read with `paired_arm_score.py` on `_realval_v2`, **262 unique strips** (267 rows, 5 duplicates
collapse on filename — [BACKLOG.md](BACKLOG.md) item 2; identical in both arms, so a paired result is
unaffected). ⚠ Real-val **selects**, it does not predict the exam — Round 1 it was out by 28 points.

| comparison | edits | edits/strip | exact | paired |
|---|---|---|---|---|
| `r3-final-stage2-best` (step 500) | 784 | 2.99 | 63.4% | — |
| **`r3-final-stage2-last` (step 2000)** | **667** | **2.55** | **68.3%** | **−0.447/strip, CI [−0.847, −0.172]; 39 better / 6 worse, sign p = 0.000** |
| `round2-stage2-best` (baseline) | 720 | 2.75 | 54.6% | — |
| **`r3-final-stage2-last` vs Round 2** | 667 | 2.55 | **68.3%** | **−0.202/strip, CI [−0.405, +0.008] = NULL; 72 better / 22 worse, sign p = 0.000** |

⭐ **`last` beats `best` on every column** — the checkpoint selector picked the worse model
([BACKLOG.md](BACKLOG.md) item 3, confirmed not predicted). **Use `last`.**

⛔ **Against Round 2 the two statistics disagree, and both are pre-registered by the tool.** The sign
test (does it win more often?) is decisive at 72 : 22; **the bootstrap CI on mean edits/strip spans
zero and is reported as a NULL**. Exact-match moves **54.6% → 68.3% (+13.7 pp)**: 46 strips Round 2
got wrong are now perfect, against **10** Round 2 had perfect and Round 3 broke.

⚠ **The mean is null because the damage is concentrated**: the 22 regressions add +73 edits, of which
the **worst 6 strips carry +43 (59%)**. Two pages hold 5 of the 22 (`aman_ey_suh_i_nazende_2_nota_p1`
lost all 3 of its strips, +13 edits); the other 17 are one-per-page.

⭐ **THE ONE PATTERN THAT SURVIVES ITS CONTROL — Round 3's gain is confined to SHORT strips.**

| gold length | n | regressed | improved | improve : regress | net edits |
|---|---|---|---|---|---|
| < 30 tokens | 100 | 6.0% | 27.0% | 4.5 : 1 | |
| 30–49 | 118 | 6.8% | 29.7% | 4.4 : 1 | **−60 (short+mid)** |
| **≥ 50** | **44** | **18.2%** | **22.7%** | **1.25 : 1** | **+7 — slightly WORSE** |

The control matters: a long strip has more tokens to get wrong, so it should move more in *both*
directions. It does not — the improve:regress **ratio collapses 4.4 → 1.25**, and long strips are the
only bucket where Round 3 is net negative. Fisher one-sided **p = 0.0171**.
⚠ **Treat as a LEAD, not a finding**: n = 44, and this is one of four groupings inspected (source,
makam, mode, length), so it does not clear a multiple-comparison correction. It is quoted because it
matches a mechanism already on record — the 59-id emitter gate drops **4,012 over-budget strips** from
training, so the pool is systematically depleted of exactly this material, and dense music was already
measured to read twice as badly ([METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md)).
⚠ Consequence for the exam, worth holding before the read: the exam **drops 41% of candidates as
`split_wide`/`over_budget`**, so it grades each page on its shorter material and may **flatter** this
model relative to real use. Raw table: `data/real/rung3/final/r3last_vs_r2_realval_v2.json`.

### Run A — a longer stage 2 (4,000 steps against Round 3's 2,000)

One variable, starting from Round 3's OWN stage-1 checkpoint. Raw log: `docs/log/raw.md`.

- Real val **0.0182 → 0.0171 (−6.0%)**, minimum moving step 1750 → **2500**, then flat and drifting
  slightly UP over the last 1,500 steps. ⚠ Step 2,500 **of a 4,000-step cosine** — not a transferable
  step count.
- ⭐ **That 6% of loss is worth ZERO edits** (row 1 above). This is the cleanest demonstration the
  project has that a teacher-forced val loss is not a correction count, and it should be quoted
  whenever a loss curve is used to argue for a change.

### Run B — every hand-verified real strip, retired crops included

`strips_b8` (3,929) **plus `strips_oldhuman`** (1,408), both at `:4` — 4,777 combined train-side
strips against 36,032 synthetic = **34.7%** of stage-2 batches, against Round 3's recipe at 32.9%.
5,000 steps. Raw log: `docs/log/raw.md`.

- ⛔ **Run B's `real` val column is NOT comparable with Run A's.** `train.py` holds out ~10% of the
  pieces of every real pool it is given, so B's real-val set is **560 strips** (390 b8 + **170
  retired-crop**) where A's was **390** (b8 only). B's higher `real` number is a harder exam, not a
  worse model — the paired reads above are what settle it.
- Real val bottomed at **0.0343, step 1250**, then sat in 0.0343–0.0385 for the remaining **3,750
  steps**. The extra steps bought nothing, which is the same shape Run A showed.
- Synthetic val, which **is** comparable (same 4,763 strips): B ends **0.0059** against A's 0.0114,
  better at every matching step. ⚠ Not a product number — the synthetic side has been solved at 99.9%
  since Rung 2, and this run's real-page result is a null.

#### ⛔ The checkpoint selector was wrong a THIRD time

| | `best` | `best-real` | `last` | which won on `_realval_v2` |
|---|---|---|---|---|
| Round 3 final | step 500 | — | step 2000 | **`last`** (667 vs 784 edits) |
| Run A | step 250 | step 2500 | step 4000 | `best-real` (the run's only usable model) |
| Run B | step 3250 | step 1250 | step 5000 | **`last`** — 645 vs `best-real`'s 694 |

Run B's `last` beats its own `best-real` by **−0.187 edits/strip, CI [−0.420, −0.004]; 19 better / 13
worse, sign p = 0.377**. ⚠ **The two statistics disagree** — the CI clears zero by 0.004 and the sign
test is a null — so read this as "use `last`", not as a measured margin.
⚠ And note **why** `best-real` failed here specifically: B's real-val pool is **30% retired-crop
strips**, so the one selector that is supposed to track real pages was partly steered by pictures the
shipped slicer does not produce. [BACKLOG.md](BACKLOG.md) item 3.

### What this closes

⛔ **The retired pools' second cut is answered: it bought nothing measurable** (row 2, and row 3 for
the direct pair). That was [archive/rounds.md](archive/rounds.md#round-3--the-worklist-item-by-item) B10 and the owner's 2026-09-01
lead. ⚠ **It is a null, not a refutation of the idea** — 262 strips give a CI half-width of ~±0.13
edits/strip, so a small real gain could hide inside it. What it does rule out is the size of gain
that would have justified re-opening the exam.


## Round 4's vocabulary A/B — how it is scored, and what the kit measured before any GPU ran

*Was `docs/METRICS-EXAM.md` (last updated 2026-09-16).*

> Plan and order: [rung3/round4.md](rung3/round4.md) step 6. Decisions: [DECISIONS.md](DECISIONS.md)
> (2026-09-16 rows). Current state and next action are NOT here: [STATUS.md](STATUS.md).

### ⛔ An edit is not the same size under two vocabularies (2026-09-16)

Every scorer in this project counts edits in **token ids**. Scheme H spells a note in fewer ids, so
the same misread costs an H checkpoint fewer edits than an old one. Found while writing the step-6
notebook's read; nothing had been scored with it yet.

`ml/labels/score_vocab_check.py` (no model, ~10 s):

| check | result |
|---|---|
| same mistake injected into 267 real labels (`_realval_v2`), H − old edits, **each in its own ids** | **−1.139 / strip**, differs on **201** strips |
| the same, **both re-counted in old ids** after `data.canonical_label` | **+0.000 / strip**, differs on **0** |
| H decode → text → old ids, **without** `canonical_label` | wrong on **11,071 of 23,048** distinct labels |
| the same **with** it, under H and under old | **0** and **0** |
| `canonical_label` changing a gold label's old ids | **0** of 23,048 |
| base tokenizer + old vocabulary vs the live checkpoint's own ids | **0** differ |
| stored old-model decodes whose old ids `canonical_label` moves | **2 of 10,625**, both malformed (`b ''8`, `r''2`) |

- ⭐ **−1.139 is about 9× real-val's whole noise band** (~±0.13 edits/strip): read in its own ids,
  the A/B would have reported a large H win made by the ruler.
- ⚠ **Why text alone does not fix it**: H's decoder glues units the old tokenizer reads as different
  ids — `g''16a''16`, `r 16`, `c '8`. `canonical_label` puts one space between every command,
  barline, note, rest and stray duration, and glues only where a label never has a space.
- ✅ **Fixed in**: `paired_arm_score.py --score-vocab old` (refuses two vocabularies without it) and
  `error_taxonomy.py` (splits through `canonical_label`, length buckets always in old ids, and a
  checkpoint named by its run when its folder is a tag like `best-edits`).
- ⛔ **Not fixed in `eval_omr.py`** — the exam scorer. It prints a warning on a non-100 vocabulary.
  The exam may not be read on an H model until it counts on the old scale.
- ⚠ **Not a problem inside one run**: `train.py`'s `best-edits` compares checkpoints of the SAME
  vocabulary. Its logged numbers are never set beside the other arm's.

### What the two arms will train and select on (measured 2026-09-16, before upload)

From `train.py`'s own data section, run to the model load on the Mac with the kit's flags:

| | value |
|---|---|
| real pool `strips_h1` | 4,456 rows → **4,014 train × 4 / 442 val** (the 4 labels over 99 old ids are removed inside the zip, so the uploaded pool is 4,452) |
| real share of stage-2 draws | 16,056 of 52,088 = **30.8%** (`:5` would be 35.8%; Run A 32.9%) |
| synthetic `strips_v7_final` train | 36,032 strips (every 8,799 / carry 27,233; every-share → 0.15) |
| exam-disjointness | 601 real pieces, **0** in the 33-piece exam; the exam also shares **0** pieces with the synthetic set |
| selection pools | `_realval_v2r` 260 + `_tupletval` 28 = 288 → **259** after leaving out **29** strips of **5** songs that are in the synthetic TRAIN split (19 + 10). (On the unrepaired `_realval_v2`: 295 → 266) |
| selection labels needing ≥ 60 decode steps | **17 of 288** under old ids (longest 82); **0** under H (longest 50) — hence a cap of 100 for both |
| the upload | `data/colab/tnc_round4_colab.zip`: **815 MB** (854,222,642 bytes), 45,578 files, `unzip -t` clean; real manifest **4,452** rows, selection manifest **260**; no exam strips |
| `strips_h1` longest label | **105** old ids / **51** H ids; over 99 old ids: **4** |

Re-measured 2026-09-16 on the repaired `_realval_v2r`, running `train.py`'s data section to the
model load for both vocabularies: both start, and every row above holds.

### Results

#### ⛔ The vocabulary A/B is a NULL (2026-09-17)

`paired_arm_score.py --score-vocab old` on `_realval_v2r`, 260 strips, each arm's `best-edits`
(control step 2,750, H step 3,250). Run on the Colab L4; JSON at
`MyDrive/tnc/r4-read/paired_realval_v2r.json`.

| | edits (old ids) | per strip | exact |
|---|---|---|---|
| control (old vocabulary) | 377 | 1.45 | 192 / 260 = 73.8% |
| H | 397 | 1.53 | 187 / 260 = 71.9% |

- mean difference (H − control) **+0.077 edits/strip, 95% CI [−0.069, +0.231]**; median 0.
- H better on **18** strips, worse on **21**, tied on **221** — exact sign test **p = 0.749**.
- ⭐ **What the interval rules out**: an H gain bigger than **0.069 edits/strip (~4.8% of the
  control's corrections)**. It does NOT rule out H being up to 0.231/strip (~16%) worse. The point
  estimate leans to the control.
- ⚠ Both picks were chosen on 241 of these 260 strips, so both are slightly flattered — the same way.

**By error kind and length** (`error_taxonomy.py`, LABEL-TOKEN counts — not the edit scale above;
buckets in old ids for both):

| | control | H |
|---|---|---|
| short+mid (217 strips): exact | 163 (75.1%) | 160 (73.7%) |
| short+mid: token edits / imperfect strips | 171 / 54 | 173 / 57 |
| **long ≥ 50 ids (43 strips): exact** | **29 (67.4%)** | **27 (62.8%)** |
| long: token edits / imperfect strips | 30 / 14 | 35 / 16 |
| exact by bucket short / mid / long | 82/99 · 81/118 · 29/43 | 79/99 · 81/118 · 27/43 |

- ⛔ **H did not help the long strips** — the band this round watched. 2 strips of 43, not separable.
- Categories (short+mid, raised counts) move in both directions and none separates at these sizes:
  signature 46 → 38, accidental 18 → 23, note-extra 24 → 28, pitch 14 → 17, tuplet 8 → 5.
- ⚠ The same pages lead both models' error lists (`bak_yine_gecti_bahar_gul_n_eylesin` supplies
  examples in most categories for both), and 221 of 260 strips tie: the errors follow the page, not the
  vocabulary.
- ⚠ **Not comparable with Round 3's reads** (656 edits / 69.1% for Run A): those were on the
  unrepaired `_realval_v2`. Whether Round 4's package beats the live model is its own paired read.

#### Round 4's control against the LIVE model (2026-09-17): a lead, NOT a win — the gain shrinks to a null once the pick is fair

`paired_arm_score.py --score-vocab old` on `_realval_v2r`, 260 strips: control
`r3-r3a-stage2-best-real` (the model on the site), arm `r4-ctl-stage2-best-edits`. Both old vocabulary.
JSON at `MyDrive/tnc/r4-read/paired_live_vs_ctl.json`.

| | edits | per strip | exact |
|---|---|---|---|
| live — Round 3 Run A `best-real` | 409 | 1.57 | 187 / 260 = 71.9% |
| Round 4 control `best-edits` | **377** | **1.45** | **192 / 260 = 73.8%** |

- mean difference **−0.123 edits/strip, 95% CI [−0.235, −0.023]** — the interval clears zero; median 0.
- better on **21** strips, worse on **9**, tied on **230** — exact sign test **p = 0.043**.
- ⭐ **The first paired read since Round 2 whose interval excludes zero** (Run A 656 vs 667 and Run B
  645 vs 667 were both nulls, on the unrepaired pool).
- ⛔ **SELECTION BIAS, NOT YET REMOVED.** `best-edits` was chosen as the lowest of 16 readings on 241 of
  these 260 strips; the live model's `best-real` was chosen on a different pool. In the arm's own log
  the pick read **396** against **405–425** at the other evals from step 2,000 (**410** at `last`) — about
  **14 edits of optimism, a rough estimate**. Taking that off the 32-edit gap leaves ~18 (~−0.07/strip),
  whose interval would likely include zero. ⏭ The clean check is `r4-ctl-stage2/last` — the final step,
  chosen on nothing — against the same live model.
- ⚠ **Several things changed at once**: the corrected, larger real pool (`strips_h1`), the `:4` repeat,
  the correction-based picker, and the repaired picking pool. A win, if it holds, belongs to the
  package, not to one lever.

**The unbiased check — `r4-ctl-stage2/last` (chosen on nothing) against the same live model:**

| | edits | per strip | exact |
|---|---|---|---|
| live — Round 3 Run A `best-real` | 409 | 1.57 | 187 / 260 = 71.9% |
| Round 4 control `last` | 392 | 1.51 | 192 / 260 = 73.8% |

- mean difference **−0.065 edits/strip, 95% CI [−0.169, +0.038]** — spans zero: ⛔ **a NULL**; median 0.
- better on **21**, worse on **10**, tied on **229** — exact sign test **p = 0.071**.
- ⭐ **The selection-bias estimate held**: `best-edits` read 377 and `last` 392 on this pool, 15 edits
  apart against the ~14 estimated from the training log; the ~18 edits predicted to remain came out 17.
- **What it rules out**: Round 4's control being worse than the live model by more than 0.038/strip
  (~2.4% of the live model's corrections). A gain up to 0.169/strip (~11%) stays possible. Every
  reading leans to Round 4 — 21 vs 10 strips, 192 vs 187 exact — which is a **lead, not a finding**.
- ⚠ Both reads use `_realval_v2r`, whose ±~0.1/strip interval cannot separate gains under ~7%. An
  independent pool — the exam or the hand-test pages — is what can settle it.

### ⛔ EVERY READ ABOVE MISSED THE ROUND'S OWN TARGET (owner, 2026-09-18)

*"Our purpose in this round is to gain the overbudget strips. We do not measure them."* Correct, and
measured the same day with the old tokenizer over each pool's labels:

| pool | strips | over the old 59-id gate | share |
|---|---|---|---|
| `_realval_v2r` — what all three paired reads used | 260 | **15** | **5.8%** |
| `_tupletval` | 28 | 2 | 7.1% |
| **`strips_h1` held-out side** | **442** | **64** | **14.5%** |
| `strips_h1` train side (for reference) | 4,014 | 496 | 12.4% |

So the A/B that decided "H is a null" was read on a pool that is almost free of the material H exists
for, and the same is true of both live-model comparisons. **A null on 5.8% dense material is not an
answer about dense material.**

#### The pools built for it (`ml/labels/build_denseval.py`, 2026-09-18)

- **`_denseval_h1`** — all **442** held-out strips of `strips_h1`: 139 under 30 old ids, 186 at 30–49,
  53 at 50–59, 63 at 60–99, **1 at ≥100**.
- **`_denseval_h1_dense`** — the **117** strips over 49 old ids, of which **64 (54.7%)** clear the old
  gate: the class the round opened for, at ten times `_realval_v2r`'s concentration.

**Why it is fair to all three models**, checked before building: `is_real_val_piece` is deterministic,
so these 61 pieces are val-side in every pool at `--real-val-frac 0.10` — **0** of them sit on
`strips_b8`'s train side, so the LIVE model never saw them either; **0** exam pieces; and neither
Round-4 arm's `best-edits` was picked here (that selector read `_realval_v2r` + `_tupletval`).
**68** of the 442 strips do not exist in `strips_b8` at all — they are what H and the rail rescued.
⚠ Caveats to quote with it: 44 of the 61 pieces also appear in the picking pool as OTHER strips, so
this is held-out strips rather than a fresh corpus; the labels are the owner's reads, whose `\sig`
block can still be a model vote; and it is **not** the exam — never page-complete, never one-shot.
⚠ **1 label costs ≥100 old ids**, which an old-vocabulary model cannot emit at all at `max_length`
100. That is a real H advantage and a guaranteed control loss, so it is counted apart, never inside a
headline.

⏭ **Unread.** Four paired reads are staged in the notebook: H against the control, and Round 4's
control (`last`) against the live model, on the dense pool and on all 442.

#### The dense read — four paired reads, run on the Mac (2026-09-19)

Both Round-4 arms and the live model over `_denseval_h1_dense` (117) and `_denseval_h1` (442), all in
old ids, `--score-vocab old`. Tables in `data/real/rung3/r4read/`. **~2 min for four model decodes of
117 strips on the M4's GPU** — the earlier "15–25 min, and an hour for 442" estimate was wrong by an
order of magnitude; price a paired read at ~0.25 s/strip/model, not minutes.

| read | pool | edits | per strip | 95% CI | sign test |
|---|---|---|---|---|---|
| H − control | dense 117 | 42 vs **35** | +0.060 | [−0.043, +0.171] | 4 / 7, p = 0.549 |
| H − control | all 442 | 76 vs **69** | +0.016 | [−0.020, +0.054] | 12 / 13, **p = 1.000** |
| Round 4 `last` − live | dense 117 | **35** vs 48 | **−0.111** | **[−0.291, −0.009]** | 6 / 1, p = 0.125 |
| Round 4 `last` − live | all 442 | **71** vs 80 | −0.020 | [−0.079, +0.029] | 13 / 7, p = 0.263 |

⭐ **THE DECOMPOSITION IS THE FINDING.** Subtracting the dense rows from the 442 leaves 325 short and
medium strips:

| | short+mid 325 | dense 117 |
|---|---|---|
| control / H | 34 / **34** | **35** / 42 |
| live / Round 4 `last` | 32 / 36 | 48 / **35** |

- **H is exactly level on short and medium strips (34 vs 34) and 7 edits worse on the dense ones.**
  Not significant, and the opposite direction to the round's hypothesis. ⛔ On the material H was
  designed for, it did not help.
- ⭐ **Round 4's whole advantage over the live model sits in the dense strips**: −13 edits there,
  +4 on the rest. The round's data work paid where it aimed. ⚠ The dense interval clears zero while
  its sign test does not (6 better / 1 worse) — **suggestive, not proven**, the same split-verdict
  rule Run B's `last` was read under.
- ⚠ **Absolute rates here (0.16–0.41/strip) are NOT comparable with `_realval_v2r`'s (1.45–1.57)**:
  this pool's labels come from the pipeline the models trained on, and its strips passed the `nd`
  acceptance gate — which is built on the live model's own ancestor, so it should flatter the live
  model, not Round 4.

#### ⭐ Where scheme H still has a case, and it is not an accuracy one (2026-09-19)

Tokenized every one of the **15,711** candidate strips the emitter priced on real pages, in both
vocabularies:

| label longer than | old ids | H ids |
|---|---|---|
| 59 (the retired gate) | 25.29% | 3.14% |
| 80 (today's gate) | 10.56% | 0.90% |
| **99 — `decode.ts`'s `MAX_TOKENS` and `collate`'s cliff** | **5.91%** | **0.30%** |
| median / max | 42 / 344 | 24 / 192 |

⭐ **About 1 real strip in 17 cannot be emitted at all by an old-vocabulary decoder; under H it is 1
in 333** — a ~20× cut in the class that produces the app's silently-wrong dense pages
([METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md#the-dense-experiment--the-apps-missing-label-rail-measured)). ⛔ **No gold pool can show this**: the emitter dropped exactly
those strips, so they have no labels, and every pool above tops out under the cliff. It is a
structural argument from lengths, not a measured accuracy gain.
⚠ **H is not the only fix for it** — the app-side label-budget rail cuts dense crops smaller instead,
and needs no vocabulary change ([BACKLOG.md](BACKLOG.md) item 0). Neither has been measured on pages.
