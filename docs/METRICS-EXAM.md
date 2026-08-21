# Metrics — the real exam

purpose: every number the one-shot real-page exam has produced, round by round
audience: agents and the owner, whenever an exam result is quoted or compared

updated: 2026-08-18

Split out of [METRICS.md](METRICS.md) on 2026-08-11, when that file reached its 400-line cap — this
section was 188 of its 399 lines. **Nothing here changed in the move.** Every other measured number
still lives in [METRICS.md](METRICS.md); raw run logs are in
[../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md).

⚠ **The exam is one-shot**: `data/real/rung3/testset.json` pieces are never trained on, and the exam
is read once per round on the final model. All iteration happens on real-val, which
[METRICS.md](METRICS.md) warns does **not** predict this number — the measured gap is 28pp.

⚠ **The AEU headline is a per-class mean and is fragile to low-n classes.** Quote micro and
macro≥30 beside it; see the caveats in [METRICS.md](METRICS.md).

## Errors by MUSICAL FORM (2026-08-17) — ⛔ THE LEAD IS DEAD; THE TABLE IS KEPT

⛔ **Read this before quoting anything below.** These numbers were measured because the owner reported
the app failing on classical pieces. **The owner retested the app the same week and withdrew that
report** — classical pages read no worse than songs (*"it is not read it well but it cannot read the
songs as well"*). Hours before that, the mechanism had already half-failed a confound check:
beste/nakış are *simpler* than şarkı on every countable property. ⚠ The other half of that check —
"they are worse SCANS, `nd` 0.167 vs 0.070" — was **circular and is withdrawn**: `nd` is
`lev(label, decode)/len(label)`, a label-vs-decode disagreement, so it restates this very table
rather than explaining it ([METRICS-CORPUS.md](METRICS-CORPUS.md)). The
table is arithmetic on a spent dump and is correct as such; **it is not evidence of a form effect**,
and no plan may be built on it. Full account: [log/superseded.md](log/superseded.md).

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
beste **3.8%**, nakış **1.4%**, ağırsemai 1.9%, kâr **0%**. Coverage and the error ranking above do
line up. ⛔ **Do not read this as a coverage argument** — the lead was killed by the owner retesting
the app, not by any mechanism, and at n = 2–26 strips per form this table cannot carry one either
way. ⚠ An earlier version of this line blamed "scan age"; that explanation rested on `nd` and is
withdrawn as circular ([METRICS-CORPUS.md](METRICS-CORPUS.md)).

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
material.** [rung3/round3-criteria.md](rung3/round3-criteria.md) §5 says this about tuplets only
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
and that is the owner's to settle ([rung3/round3-criteria.md](rung3/round3-criteria.md) §3b).

**What it cost, page level vs label level** (`check_crop_staleness.py --root data/real/strips`, all
46 graded pages, measured before the rebuild was decided): 0 identical, **1** size-only, 8 measures
differ, **37 crop count differs** — i.e. "45 of 46 pages lose their labels". At *label* level the
loss is **105 of 326 (32%)**, because most labels move with their music. That gap is why the rebuild
kept 221 of them rather than starting blank.

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
  beside the result. [rung3/exam.md](rung3/exam.md) · [DECISIONS.md](DECISIONS.md).

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

⚠ **These are Rounds 1 and 2's floors. Round 3 has its OWN, signed 2026-08-15** —
[rung3/round3-criteria.md](rung3/round3-criteria.md), where the pass/fail number is the product one
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
[rung3/ship-criteria.md](rung3/ship-criteria.md).

