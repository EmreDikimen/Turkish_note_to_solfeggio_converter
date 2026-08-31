# Corpus and label quality — how good the DATA is

purpose: the single home for corpus sizes, pool composition and measured label-noise rates
audience: agents and the owner, whenever a question is about the data rather than the model
updated: 2026-08-22

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
| **`strips_b8`** — the re-emit | **3,955 accepted strips / 912 pieces**, 4,738 in review, 201-row audit sample | 2026-08-21, the three training pools re-cut onto the CURRENT crops (`strips_v2`) with `round2-stage2-best` as hint AND gate. **A separate dataset, not a replacement** — the old pools are untouched and their human corrections do not carry themselves ([METRICS-B8.md](METRICS-B8.md)) |
| Exam v2.1 (frozen) | **352 strips / 45 piece entries**, tup3 gold 55 groups | `testset.json` |
| Photo exam | 690 strips sliced, 284 hand-labelled | exam-only |
| Real corpus on disk | 798 PDFs → 1,259 page PNGs (89 makams) + 964 nota pieces / 1,227 pages | |

Exam v2.1 class gold: bakiyeSharp 117, bakiyeFlat 60, kucukFlat 54, natural 48, komaFlat 39,
kucukSharp 28, komaSharp 19 (18 scorable), buyukSharp 3 → 0 after the re-audit, buyukFlat 0.

## ⚠ Which slicer cut which pool, and what the checkpoint selector sees (measured 2026-08-20)

Prompted by the owner asking whether the data trained against every 500 steps is out of date. It is,
and the second table is the larger finding.

`page_to_strips.py` was **overhauled 2026-07-25** and fixed four more times on **2026-07-29** (width
and measure caps enforced, overlapping crops trimmed, the staff floated in the frame). A pool cut
before that date is not what the shipped slicer produces — measured on a 5-page re-slice sample,
**0 of 30 crops came out identical**, old 207 px slivers becoming 1435 px full rows.

| pool | role | crops cut | slicer |
|---|---|---|---|
| `strips_nota` / `strips_r1` / `strips_tup` | training **and** the real half of the selector | 11–17 Jul | **old** |
| **`strips_b8`** | the same three pools, re-emitted | **21 Aug** | current — closes the row above, once its labels are carried |
| `strips_exam_v2_clean` | **the exam**, read once, the launch gate | 17 Jul | **old** |
| `_realval_v2` | what every Round-3 arm is scored on | 31 Jul | current |

So the pool the arms are *scored* on is current; the pools they *train* on, and the exam that decides
the launch, are not. Re-emitting the training pools is the standing B8 decision; the exam's version of
it is exam v3 ([BACKLOG.md](BACKLOG.md)).

**What picks `best`.** `train.py` blends two val losses by strip count —
`select = (synth × n_s + real × n_r) / (n_s + n_r)` — evaluated every `--eval-every` (default 500)
steps. At the default `--real-val-frac 0.10` that every notebook uses, against `strips_v6_stac`:

| val pool | strips | weight in the number that saves `best` |
|---|---|---|
| synthetic (val pieces of the corpus) | 4,769 | **94.6%** |
| real (nota 224 + r1 26 + tup 21) | 271 | **5.4%** |

**`best` is therefore chosen 94.6% on synthetic val loss**, in a round graded entirely on real pages.
[rung3/levers.md](rung3/levers.md) Lever 5 already said "strip-weighted toward synthetic"; this is the
number under it. ⚠ The staleness of the real half matters **less than its weight** — fixing the crops
without changing the blend moves 5.4% of the selector.

⚠ **This does not invalidate a paired arm.** An arm and its control share these pools, so a stale
crop or a synthetic-heavy selector applies identically to both and cancels in the delta. It bears on
which checkpoint is called `best` — which is why both `best` and `last` are read, and why arm 1's two
checkpoints disagreed.

## The B8 re-emit → [METRICS-B8.md](METRICS-B8.md)

Moved 2026-08-31 at the 400-line cap. That file owns the yield table, the drop table, the
**1,479** human corrections and where they landed, the 97.7% span-key validation, and the
`b8-full` read. Nothing here restates its numbers.

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

## ⚠ What `nd` actually is — it is NOT scan degradation (corrected 2026-08-18)

Several docs read `nd` as a scan-quality or degradation measure. It is not, and there is exactly one
`nd` in this repo. [`scripts/rung3/emit_strip_labels.py`](../scripts/rung3/emit_strip_labels.py)
defines it as

```
nd = lev(label_ids, decoded_ids) / len(label_ids)      # empty \sig pairs stripped from both sides
```

— the **normalized edit distance between the SymbTr label and the model's own decode**. Every other
script (`build_reslice_queue.py`, `build_realval_v2.py`, `build_exam_fix_queue.py`) only passes it
through, and `nd_high` is a drop *reason* meaning "label and decode disagree a lot".

Three consequences, all of them bites that have already happened:

1. **It needs an independent label to exist.** Measured: `nd` is empty for **all 33,804 rows** of
   `_reslice_v2/reslice_all.csv`, because 30,049 of them are seeded with their own decode. A filter
   built on it there is silently inert.
2. **"High `nd`" cannot explain "the model does badly here"** — it *is* that statement. Any argument
   of the form "these strips are harder, see their `nd`" is circular. This voided one half of the
   2026-08-17 classical-forms confound check ([log/superseded.md](log/superseded.md)); the other half
   (they are simpler on every countable property) is independent and stands.
3. ⚠ **One signed pre-registration uses it this way and has been flagged, not changed** — Lever 6
   clause 2 excludes hard tier because "hard-tier dropped dots are scan degradation, `nd` up to 1.14"
   ([rung3/levers.md](rung3/levers.md)). The exclusion may still be correct, since hard tier is
   defined independently of `nd`; its written justification is not. Owner's call, owed before the
   staccato arm is scored.

⚠ Where a genuine scan-quality number is wanted, the honest one on record is the source split: nota
(scanned TRT-era prints) runs ~5× the SER of neyzen ([METRICS.md](METRICS.md)) — that inference is
safe because the *source* difference is known independently of any model output. ⚠ But neyzen is
**not** the "clean vector PDFs" several docs called it; see the census below.

## The born-digital census (measured 2026-08-18) — and what it corrects

Asked while looking for a *non-circular* difficulty signal: which pages were **typeset by software**
and never scanned? The test is a **file-format fact, not a heuristic** — page 1 embeds no raster
image at all and is drawn with >150 vector operators. A scan is always one big embedded image, so
the two cannot be confused, and no model, threshold or eyeball is involved. That is the point: every
other difficulty signal this project has is either circular (`nd`, above) or measured worse than
random (decode confidence, [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)).

Over all **2,055 PDFs** on disk (`scripts/rung3/build_label_batch.py::born_digital_stems`, cached to
`data/real/rung3/_pagequeue/born_digital.json`):

| Source | PDFs | Born-digital | Scanned |
|---|---|---|---|
| nota | 1,000 | **88** | 912 |
| neyzen | 1,055 | **0** | 1,055 |

⚠ **This corrects a line repeated across several docs**: neyzen was described as "clean vector PDFs"
and it is nothing of the kind — **every neyzen page is a raster scan**. Its ~5× lower SER is real,
but the cause is that it is a *better scan*, not a born-digital one. Fixed in [METRICS.md](METRICS.md)
and [rung3/levers.md](rung3/levers.md); the SER numbers themselves are unaffected, only the label on
the row.

Of the 88 born-digital pieces, **84 are sliced — 115 pages / 2,956 strips**, all from the nota
source. That tier is what `build_label_batch.py --clean` cuts a labelling batch from
([rung3/labeling-queues.md](rung3/labeling-queues.md)).

### ⚠ The same census run against the EXAM (2026-08-19) — 93% of it is scans

The census above was run over the corpus. Run over `data/real/rung3/testset.json` it answers a
sharper question — *what medium is Round 3 actually graded on?*

| | pieces | pages |
|---|---|---|
| exam total | 45 | 67 |
| **born-digital** | **4** | **5 (7%)** |
| **scanned** | **41** | **62 (93%)** |

The four are all nota (`ey_gonca_acil…`, `ab_u_tab_ile…`, `gozlerinden_icti…`, `ay_dalgalanirken…`);
all 17 neyzen exam pieces are scans, consistent with 0 of 1,055 neyzen PDFs being born-digital.

This is the number that re-aimed the labelling on 2026-08-19 ([DECISIONS.md](DECISIONS.md)). It turns
a qualitative caveat — "a clean-page batch cannot be expected to move the floor much" — into a
measured one: **`batch2` is cut entirely from the tier that supplies 7% of the exam's pages.**

### Labelling yield by tier — what a strip-look actually buys (2026-08-19)

| Batch | Tier | Verdicts so far | Fix rate |
|---|---|---|---|
| `batch2` | born-digital (52/52 pages) | 59 ok / 8 fix / 1 bad, n=68 | **~12%** |
| nota training pool (2026-07-27 audit, row below) | scanned | 521 corrected of 1,740 | **30%** |

⚠ **n = 68, so the batch2 rate carries roughly a 5–22% interval** — it is a direction, not a
precise rate. It agrees with the owner's own read of those strips ("mostly decoded correctly") and
with the tier being the clean one, which is why it was acted on rather than measured further.

⚠ **What an `ok` verdict costs and buys.** Batch rows are seeded with the model's own decode, so
`ok` means the training label was **already right** — the row changes the training data by nothing.
The yield of a batch is therefore its *fix* rate, not its throughput. ⚠ Composition matters too:
`batch1` is not the inverse of `batch2` — 10 of its 52 pages are born-digital, 5 are neyzen, and it
carries the handwritten manuscript the ranking surfaces at the top.

## ⚠ The whole corpus comes from TWO websites (measured 2026-08-22)

Raised by the owner, and it is exact — `data/real/manifest.csv` records a source per PDF:

| source | PDFs | in `strips_b8` | in the exam (`testset.json`) |
|---|---|---|---|
| neyzen.com | 1,055 | 1,390 strips / 159 pieces | 17 pieces |
| notaarsivleri.com | 1,000 | 2,565 strips / 416 pieces | 28 pieces |
| **anything else** | **0** | **0** | **0** |

⚠ **Consequence for every accuracy number here**: they are measured on two engraving houses, so the
honest form is "reads *these two sources* at X%", not "reads Turkish sheet music at X%". Nothing in
any pool tests a third engraver. The cheap way to find out — a probe, not a corpus — and why it is
deferred rather than scheduled: [BACKLOG.md](BACKLOG.md) item 10.

## Label quality (measured by hand audits)

| Pool | Content-error rate | Date |
|---|---|---|
| neyzen auto-accepts (full audit, 84 strips) | 22.6% needed correction | 2026-07-12 |
| nota auto-accepts (69-strip sample) | 7.2% pitch-level | 2026-07-16 |
| exam v2 auto-accepts (all 63) | ~6% pitch/duration | 2026-07-17 |
| tup3 auto-accepts (78 strips) | 10% | 2026-07-19 |
| exam gold, full re-audit | 13 new label errors found (gold over-sized sharps) | 2026-07-25 |
| **nota training pool, review of every disagreeing strip** | **521 of 1,740 strips (30%) carry a human-corrected label**; of the strips where label and decode disagreed at all, **~78% of the labels were wrong** | 2026-07-27 |
| **✅ `strips_b8` auto-accepts (`b8-audit`, ALL 201 READ BY HAND)** | **27 fix / 174 ok = 13.4% wrong.** One `fix` re-saves an unchanged label, so **26 real corrections = 12.9%**; three more differ from their label only by the id-identical `32` spacing ([DECISIONS.md](DECISIONS.md)), which is not an error. Same level as the re-sliced exam's auto-accepts below (13.7%), against the old neyzen pool's 22.6%. ⭐ **Repeat structure is the biggest class, ahead of pitch**: `\repstart` 6 rows + `\volta` 4 = **10 of 26**, against pitch/rest 8, duration 6, grace 3, signature 3. **4 of the 10 accepted labels that carry a `\repstart` were wrong** ([METRICS-UNSEEN.md](METRICS-UNSEEN.md)), and 2 of the 3 signature errors are `\komaSharp`→`\kucukSharp` inside `\sig` — [BACKLOG.md](BACKLOG.md) items 5 and 9 reappearing inside a TRAINING pool, not new failures. ⚠ 12.9% is what the auto-accepted half carries **into training**; carrying the human fixes is a separate job | 2026-08-22 |
| **AGREEMENT between label and decode, `b8-audit` + `b8-full`** | On the rows a human has read: where the proposed label and the model decode say the **same tokens**, **159 ok / 10 fix = 94% correct (n=169)**; where they differ, **20 ok / 24 fix = 45%** (`b8-audit`, n=44). This is what `auto_accept_agree.py` acts on — it drafts `ok` (`by=agree`) on the **2,896** agreeing rows of `b8-full` and leaves the **842** disagreeing ones for a human. ⚠ **94% is not 100%, and the misses CLUMP**: 5 of the 7 bad agreements sit on ONE page — when a page is misread the label and the decode tend to be wrong the *same* way, so the two agreeing is not two independent votes. ⚠ Agreement is also partly **memory**: `round2-stage2-best` was both the emitter's hint and its gate and was trained on these labels at 9× oversampling. Spot-check via the review UI's **🤖 auto-accepted (agree)** filter, least-confident first | 2026-08-27 |
| **exam v3 auto-accepts (all 139, `examv3-full`)** | **18 fix + 1 bad = 13.7% wrong** — against exam v2's **51%** on the same queue; the drop is the re-slice ([the crop finding below](#the-key-signature-is-decided-by-the-model-not-by-symbtr-found-2026-08-21)) | 2026-08-21 |
| **`b8-full` READ WHOLE (owner, 2026-08-31)** | 3,955 rows: **3,362 ok / 576 fix / 17 bad**; **1,016 read by hand**, 2,939 left as machine `agree` drafts. ⭐ The drafts are backed by the random audit: of its 201 rows, **41 had `label == decode` and a human read all 41 as `ok` — 0 wrong** (95% upper bound ~7% at n=41). ⛔ **One measured exception: `\sig`.** `unaccept_sig.py` sent machine-accepted signature rows back to pending and the owner then corrected **12 — all 12 carrying a `\sig` block**, i.e. the agreement rule is circular exactly where the label came from the model's own vote | 2026-08-31 |
| Tie structure in nota pool | ~38% structurally noisy (why ties carry no floor) | 2026-07-20 |
| **`strips_v3` carry strips: accidental DRAWN but not labelled** | **18.8% of signature-bearing carry strips** (5,240 / 27,933; 8,485 accidentals over 137 pieces) | 2026-07-26 |

## ⚠ The KEY SIGNATURE is decided by the MODEL, not by SymbTr (found 2026-08-21)

**How it was found.** The owner finished `examv3-full` (all 139 exam auto-accepts) and reported that
the corrections were "mostly `\komaSharp` → `\kucukSharp`". They were **7 of the 18 fixes**, and all
7 share three things: they are inside the `\sig … \sigend` block, they are on the same note (F), and
they belong to **2 pieces, both makam mahur**. Seven of the seven `\komaSharp` tokens in those 139
labels were wrong; none was corrected the other way. ⭐ **Reading the 27 `gold_conflict` rows the same
day added 3 more of the identical correction** — **10 now, still 10–0 in one direction**, over two
queues cut differently ([METRICS-EXAMSET.md](METRICS-EXAMSET.md)).

**The mechanism** ([../scripts/rung3/emit_strip_labels.py](../scripts/rung3/emit_strip_labels.py),
the `sig_votes` block). Everything else in a label comes from SymbTr. The signature does not: the
model reads it off every row-start strip, the **majority read wins**, and when that majority differs
from the SymbTr derivation the model's read **overwrites** it. The reason is legitimate and recorded
in the code — real editions print the makam's *conventional* signature, which routinely differs from
the content-derived one (a hicaz page prints flat + 2 sharps where the derivation gives 2). For
signatures, SymbTr is genuinely not the printed truth.

Three things then compound:

1. **The voter is `rung3-labeler`**, the weak July tooling checkpoint, and koma-vs-küçük is its
   measured weakness — the fused-bars glyph defect above, plus a **9:1** inline frequency imbalance
   (`\komaSharp` 1,887 against `\kucukSharp` 206).
2. **A systematic misread wins a vote unanimously.** The model does not err randomly on one strip; it
   errs the same way on every row-start of the piece. So the override fires with full confidence.
3. **The `nd` gate cannot see it.** The whole `\sig … \sigend` block is stripped from both sides
   before the label-vs-decode comparison, deliberately, because signature reading is noisy. A wrong
   signature is invisible to the one check that catches wrong labels.

**How far it reaches** (counted from each pool's `emit_report.json`):

| pool | pieces | signature OVERWRITTEN by the model | split-vote (sent to review) |
|---|---|---|---|
| exam v3 | 45 | **24 (53%)** | 12 |
| `strips_nota` | 938 | **406 (43%)** | 384 |
| `strips_tup` | 293 | **98 (33%)** | 37 |
| `strips_r1` | 65 | **26 (40%)** | 25 |

**Checked against our own makam table** (`data/makam_signatures.json`, built from real sources): of
the 36 exam pieces whose labels carry a signature, **8 (22%) disagree with the table's majority
variant** — and several are *missing* entries the table says are near-universal:

| makam | the label says | the table's majority | weight |
|---|---|---|---|
| huseyni | `\komaFlat b` | `\komaFlat b \bakiyeSharp f` | 100% |
| nikriz | `\bakiyeFlat b` | `\bakiyeFlat b \bakiyeSharp f \bakiyeSharp c` | 94% |
| segah | `\komaFlat e \bakiyeSharp f` | `\komaFlat b \komaFlat e \bakiyeSharp f` | 93% |
| mahur | `\komaSharp f` | `\kucukSharp f` | 67% |

⭐ **There is a loop in it.** The model misreads küçük as koma → that becomes the label → the model
trains on that label → it becomes more koma-biased. This is a plausible partial cause of the 9:1
imbalance above, on the accidental class the exam headline is most fragile about.

⚠ **What is NOT claimed.** n = 7, on 2 pieces, in 1 makam — a strong signal, not a measured error
rate for the override. The override exists to fix a real defect and many of those 24 / 406 / 98 are
probably right. The table is a **guide, not truth**: mahur genuinely prints both ways in our own
sources (küçük n=35, koma n=17), so it agrees with the owner's reading rather than proving it.
⏭ The cheap next measurement, and the proposed rule change, are [BACKLOG.md](BACKLOG.md) item 9.

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

