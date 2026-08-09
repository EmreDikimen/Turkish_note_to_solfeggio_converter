# Metrics — every headline number, once

purpose: the single home for measured numbers; other docs link here instead of restating
audience: agents and the owner, whenever a number is needed
updated: 2026-08-08

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

Round 2 clears one floor Round 1 missed (`\komaFlat` precision), misses four, and is better on every
floor except the two headlines — a per-class mean that `\komaSharp` collapsed. Ties carry **no
floor** on purpose (~38% structurally noisy gold); the arc-triggered false-`\tup3` rate replaces
them, over 85 tie-but-no-tup3 and 229 neither-token strips. Full reasoning:
[rung3/ship-criteria.md](rung3/ship-criteria.md).

## Model quality — real-val (selection set, NOT a predictor)

| Arm | Date | mean AEU F1 | Notes |
|---|---|---|---|
| A — two-stage (winner) | 2026-07-22 | **89.2%** | synthetic-only 6k steps from BASE → 2k @ lr 1e-5 with real oversampled `:8` (real = 33.3%) |
| B — single-stage joint | 2026-07-22 | 78.4% | 7k steps, real at its natural 5.9% |

- Margin is **low-n driven**: `\komaSharp` (1 gold) + `\kucukSharp` (21) account for 10.4 of the
  10.8pp. On the four ≥30-gold classes the arms tie (92.7% vs 92.2%).
- **Real-val 95.0% AEU vs exam 66.6% = a 28pp gap.** Tier decomposition: easy 96.8% vs 94.8%,
  mid 91.9% vs 63.0%, hard tier absent from real-val (0 strips) vs 58.3% on the exam.
  **Composition dominates; edition familiarity is small** (clean tiers agree within 2pp). This is
  the measurement the real-val rebuild acts on — see [rung3/labeling.md](rung3/labeling.md).

### Real-val v2 — the rebuilt pool (2026-07-31)

`_realval_v2`: **267 strips at the exam's difficulty mix, 47 easy / 110 mid / 110 hard
(17.6 / 41.2 / 41.2%)** against the old pool's 59 / 41 / **0**. 110 hard strips hand-labelled from
the `realval-hard-v2` queue (165 read, 111 ok / 44 fix / 10 bad); every crop from the 2026-07-29
slicer; no decode-derived label survives.

Both pools read with the SAME model (`round2-stage2-best`) on the same day, so these compare:

| | old `_realval` | **`_realval_v2`** | Round-2 exam |
|---|---|---|---|
| mean AEU F1 | 90.5% | **84.3%** | 74.2% |
| micro F1 | 94.5% | 91.3% | 84.8% |
| macro≥30 F1 | 94.8% | 91.4% | 84.8% |
| SER | 0.028 | **0.079** | 0.052 |
| exact-match | 65.7% | 62.9% | 52.1% |
| mean edits/page | 3.5 | **8.6** | — |
| pages ≤5 corrections | 75% | 70% | 57% |

- **The pool really is harder: SER nearly tripled and now EXCEEDS the exam's.** Mean edits/page
  rose 3.5 → 8.6 while the median stayed at 2 — the signature of a restored hard *tail*, not a
  uniformly harder set.
- **Headline gap to the exam: 16.3pp → 10.1pp, ~38% closed.** ⚠ Not comparable to the historical
  "28pp" above, which was a different metric and model generation; quote this same-model pair when
  comparing pools.
- ⚠ **The residual gap is CLASS COMPOSITION, not difficulty.** Real-val v2 still carries 6 of 8
  accidental classes and **zero `\komaSharp` in-signature gold**, while the exam headline is
  substantially a `\komaSharp` n=14 artifact inside a six-class mean. Matching the difficulty mix
  cannot match a per-class mean whose classes differ. The lever for that is more
  `\komaSharp`/`\kucukSharp` gold (exam v3), not more hard strips.
- ⚠ **First build mis-filed all 110 new rows as source "synthetic"** in `eval_omr.py`'s per-source
  table — `build_realval_v2.build()` did not carry `source`/`makam`. Fixed via
  `piece_provenance()`; the pool reads neyzen 79 / nota 188. Headline numbers were unaffected
  (same crops, labels and seed) — only the provenance table was wrong.
- **By source, the two engraving styles are far apart** (2026-07-31, corrected table):

  | source | n | AEU headline | SER | exact |
  |---|---|---|---|---|
  | neyzen (clean vector PDFs) | 79 | 96.5% | 0.021 | 77.2% |
  | nota (scanned TRT-era prints) | 188 | 93.8% | **0.105** | 56.9% |

  **SER is 5× worse on nota**, and the hard tier is nota-dominant — so "hard" in this pool largely
  means *scan quality and engraving age*, not musical density. Worth keeping in view before
  attributing a future round's real-val movement to anything else.

## Photo domain (phone photos of exam pieces — EXAM-ONLY)

| Measure | Value | Date |
|---|---|---|
| Slicer yield, before the photo front-end | 28% of pages / 106 strips (72% of pages yielded ZERO) | 2026-07-24 |
| Slicer yield, after | **97% of pages / 690 strips** | 2026-07-25 |
| Photo AEU, fitting-alignment estimate | ~61% recall / 75% F1 | 2026-07-25 |
| Photo AEU, hand-labelled gold (284 labelled, 272 scorable) | **73.7% recall / 75.9% F1** | 2026-07-25 |
| Photo vs clean gap | ≈3–4pp | 2026-07-25 |
| Unreadable even to a human | ~4% of strips | 2026-07-25 |

## Diagnostics — why the failures happen

Moved to [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-07-28 (this file hit the 400-line
cap). That file owns the microtonal-sharp defect, the crop-shape and beam-weight probes, the decode
confidence calibration, the old-slicer staleness finding, and the ~2% pre-shrink that failed to
replicate.

## Corpora, pools and label quality

Moved to [METRICS-CORPUS.md](METRICS-CORPUS.md) on 2026-07-28 (this file hit the 400-line cap).
That file owns corpus sizes, pool composition, hand-audited label-noise rates, the carry
pixels-vs-labels defect and the `verify-labels.ts` verification.

## Decode server (MVP W9) — DEPLOYED 2026-08-06, measured on Cloud Run

Service: `omr-decode`, europe-west3, 1 vCPU / 2 GiB / concurrency 1 / max-instances 3.
Rows marked **M4** are the dev laptop; rows marked **Cloud Run** are the deployed service.
Plan: [mvp/deploy.md](mvp/deploy.md).

| Measure (Cloud Run, 1 vCPU) | Value |
|---|---|
| **Cold start** | **10.6 s** to a first answer, of which **9.5 s is loading the three graphs** (against 1.5 s on the M4). Container start is the small half. ⚠ **Until 2026-08-08 a cold start did not cost 10.6 s of waiting — it cost the server path entirely.** The container listens before its graphs are loaded, so a decode arriving in that window got the truthful `503 model still loading`, and `remote.ts` treated any error as "fall back" with no retry: the whole page was then read on the user's own machine (**+211 MB of weights on a first fallback**). **Fixed the same day** — the client waits out a warming server and pings `/health` on open; a cold start is once again just ~10 s of waiting. Row below |
| **Cost per strip** | **1.93 vCPU-s** — against **0.55** on an M4 core at 1 thread, so **a shared cloud vCPU is ~3.5× slower** |
| **Cost per page** | ~**40 vCPU-s** for a 21-strip page → free tier ≈ **4,450 pages/month**. A 38-strip page measured **69.9 vCPU-s / 71 s** |
| **⚠ It is SLOWER than the user's own browser** | 128 strips: **250 s on Cloud Run vs 166 s in the M4 browser (0.66×)**. Warm. Cold adds 10.6 s. **This is the outcome deploy.md predicted and the release was chosen on** — the win is the friend's laptop staying cool, not speed |
| **Reads the same as the browser** | **120/128 strips (93.8%)** identical token ids — *the same rate as the local server*, and the divergences again sit on near-ties (median browser log-prob at the diverging token **−0.87, p = 0.42**) |
| **Per strip / per page** | **~2.0 s a strip**; a 16-strip page **~35 s** warm and ~46 s cold, a 26-strip page **~55 s** warm. The encoder is **74–81%** of it, so nothing that leaves the encoder alone matters. ⚠ The same 26-strip page reads in **34 s in the owner's browser** — the server is slower, by choice |
| **Parallelism works** (2026-08-06) | Three page requests at once finished in **35.5 s**, against ~80 s if run one after another, and **server-side time did not degrade** (23.5 / 26.4 / 22.6 s) — Cloud Run gave three machines and each kept full speed. The extra wall time on two of them is their own cold start. This is the measured basis for splitting ONE page across instances: [mvp/latency.md](mvp/latency.md) |
| Safety limits, live | `check:limits` **6/6** after one fix: a destroyed socket reached Cloud Run's proxy as a **503** rather than a 413, turning a client error into an apparent outage |
| **The BUILT app against the LIVE service** (2026-08-06) | The first end-to-end run of the deployable artifact against Cloud Run rather than a local server — `smoke:build --decode-url <service>`, **PASS on both paths**. Same 26-strip page: **61.2 s reading on the server** against **33.2 s in the local fallback** on the same M4, identical score (9 staves → 26 strips → **399 notes / 26 measures**), `crossOriginIsolated` true and no page errors on either. ⚠ The server being ~1.8× slower here is the 0.66× row above seen end to end, plus this page being 26 strips rather than 16 |

| **The DEPLOYED site, driven as a friend would** (2026-08-06, `npm run smoke:live`) | **PASS on both paths** against <https://komavision.netlify.app> with the origin lock on — the shipped configuration, which no other check can reach any more. Server path **49.8 s** (47.4 s reading, 26 strips, warm); **fallback 73.0 s**, weights pulled from the Hub over the real network. Same score both ways (9 staves → 26 strips → **399 notes / 26 measures**), `crossOriginIsolated` true, **no page errors on either**. This is the number to quote for "what a friend experiences" |
| **The DEPLOYED site after the 2026-08-08 redeploy** (`npm run smoke:live`) | **PASS on both paths**, warm: server **47.5 s** (44.4 s reading), **fallback 64.2 s** from the Hub, same score both ways (9 staves → 26 strips → **399 notes / 26 measures**), isolated, no page errors. Unchanged from 2026-08-06 within noise, which is the point — the frontend grew makam selection, the style pass and the editor, and the decode chain did not move. ⚠ **The FIRST run of this pair FAILED, and the failure is the finding**: the container was cold, `/decode` answered **503 model still loading**, and the app fell back to the browser for the whole page — `data-where=local-fallback` where `server` was wanted. Re-run after one `/health` ping (which cold-started it in 10.7 s, `loadMs` 9,183) it passes. So `smoke:live`'s server assertion is only meaningful against a warm service, and a friend's first upload after idle silently takes the slow path |
| **The DEPLOYED site after the 2026-08-09 COPYRIGHT redeploy** (`npm run smoke:live`) | **PASS on both paths**, warm (an earlier note here claimed this run started cold — see the correction two rows below): server **48.8 s** (45.3 s reading), **fallback 79.8 s** from the Hub, same score both ways (9 staves → 26 strips → **399 notes / 26 measures**), isolated, no page errors. Within noise of 2026-08-06 and 2026-08-08 — the deploy removed five bundled scores and moved no decode code, and the numbers say so. The build that shipped: **11 files, 42.7 MB**, no `.json` at the dist root, both real URLs baked in, zero `localhost:8080` strings. Live host after it: all five scores plus `/scores/` and `/models/model.json` answer **404**, having answered **200** the same morning |
| **A GENUINE cold start, measured at last** (2026-08-09, Cloud Run logs) | The row two below said this was unmeasured; it now is. After **~3 h** idle (last container start 07:12:28), a `/health` at **10:11:41** took **11.29 s** end to end, of which **10,093 ms** is graph loading (`model ready` at 10:11:53). So the honest cold-start cost is **~11 s**, on a genuinely idle service rather than minutes after a deploy. ⚠ **What this row does NOT say** — see the correction below — is that the *app* survived it: the client that paid the 11.29 s was a crawler asking `/health`, and no `/decode` followed it |
| **⚠ CORRECTION, same day: that cold start was NOT `smoke:live`'s** | First written up as "the fix is proven on a genuinely idle service", from wall-clock proximity alone. The request log says otherwise: the 10:11:41 cold start came from **`HeadlessChrome/131`, referer the unique deploy URL** — an automated visitor that arrives seconds after a Netlify deploy. `smoke:live` opened **33 s later** and its `/health` returned in **2 ms**, warm. Its `/decode` (10:12:18, 200 in 43.7 s, `data-where=server`) is therefore a **warm** result like the two before it. **The standing lesson: a post-deploy `smoke:live` can never be the cold test**, because the deploy summons the thing that warms it. Attribute a container start to a client before drawing anything from it |
| **⚠ A second way the same day's readings misled** | Concurrency is **1**, so a request arriving during a decode gets its **own fresh container**. A `/health` curl fired while the owner's upload was decoding returned `uptimeS` **11** and `loadMs` **9,849** — visually identical to scale-to-zero, and first read as "the service goes cold within minutes". It was concurrency spillover. **One `/health` cannot tell a busy service from an idle one**; only the request log distinguishes them |
| **Who has actually used the deployed app** (2026-08-09, 7 days of request log) | The app pings `/health` on open, so Cloud Run's log doubles as a visit counter. **Three real page reads from three non-owner addresses**, all 2026-08-08: an Android at 11:35 and another at 14:18 (a different Turkish ISP), a Linux desktop at 20:32. Everything else from outside is **`/health` with no `/decode`** — the page opened, nothing uploaded — and much of that is automated: one iPhone UA string appears from **four unrelated IPs** across two days, and the `HeadlessChrome/131` crawler above turns up after each deploy. ⚠ Treat the `/health` count as an upper bound on humans, and the `/decode` count as the real one |
| **The cold-start fix, measured** (2026-08-08, `npm run check:coldstart`) | A proxy that is deliberately cold for a set window, in front of a real decode server, so the race is a parameter. **Cold for 12 s: the page still finished ON THE SERVER** (9/26/399/26 in 22.5 s — the wait, then a 10 s decode), having re-POSTed after waiting; and opening the app is confirmed to ping `/health`. **The other half, which keeps it honest: a load that genuinely FAILED is not waited on** — one `/decode`, zero follow-up `/health` polls in the next 8 s, so a broken container still falls back at once instead of stranding the user for the 40 s budget. Live confirmation on a genuinely idle service is in the row below |
| **The built app, this build** (2026-08-08, `smoke:build` against a local `dev:server`) | **PASS on both paths**, **9/26/399/26 identical** — the same score as the 2026-08-06 run, so the palette follow-ups and editor steps 5–8 changed nothing the built artifact reads. Server path 13.0 s, cross-origin fallback 36.6 s (local weights, 2 ORT threads). `dist/` **43.4 MB**, no `.onnx`, ORT shipped as real files under `/ort/` |
| **The grace-note box bug, measured** (2026-08-08, owner-reported) | On `beyati-delisin.json` (427 note boxes, median **18×47 px**): **14 boxes — exactly its 14 grace notes — ran from the SVG origin to their own note**, the largest **949×1805 px**. Consequence, measured by asking `elementFromPoint` who owns each box's own centre: **126 of the 134 on-screen boxes had their click stolen** by a giant one lying over them. That is the whole of the report ("one giant note I must delete before I can edit") as a number — and the deletions it forced were of real notes. After the fix: **0 at the origin, 0 stolen**, median unchanged at 18×47, so ordinary notes kept their boxes. Cause: `StaveNote.getBoundingBox()` merges every modifier's box and `GraceNoteGroup` never positions itself, so it reports (0,0) |
| **The editor on the DEPLOYED build** (2026-08-08) | The gap `smoke:live` cannot see: `smoke:editor` drives the Vite **dev** server, so editor steps 1–8 had never run in a production bundle on the real host. A throwaway Playwright pass over <https://komavision.netlify.app> — **all 27 palette tools arm themselves**, every glyph fits inside its button (measured against the loaded Bravura, the minified-CSS risk), select → ✕ → undo restores the count (513 → 512 → 513), armed insert on blank staff previews a pitched ghost and lands the note (→ 514), the palette's Çal starts and shows a playhead, Dur stops it, **no page errors**. Not a repo check: `#save-json` is due for deletion (editor step 9), so nothing was added to `package.json` |
| **Origin lock, final shape** (revision `omr-decode-00004-nc2`) | Allowed: the Netlify host, `http://localhost:5173`, `http://localhost:4173` (so `dev:web` can reach the live server during frontend work). An unknown origin gets **no** `access-control-allow-origin` at all. ⚠ Consequence: `smoke:build` from a localhost preview against the live server now fails CORS **by design** |
| **The whole chain, live** (2026-08-06) | App on Netlify, weights on the Hub, decode on Cloud Run. `smoke:build` against **both real remotes**: **PASS on both paths**, identical score (9 staves → 26 strips → 399 notes / 26 measures). Server path **59.2 s**; **fallback 69.9 s against 33.2 s with local weights** — the ~37 s gap is a friend's one-time **211 MB** download of the graphs from the Hub, and it is paid only on a first fallback |
| **The deployed site, checked from outside** | COOP/COEP both present (Netlify serving `public/_headers` unchanged) · the 25.58 MiB wasm served whole as `application/wasm` · `/models/encoder_model.onnx` **404**, so no weights reached the static host · the shipped bundle points at the real Cloud Run and Hub URLs |
| **Origin lock** (revision `omr-decode-00003-jrl`) | Preflight from `https://komavision.netlify.app` returns `access-control-allow-origin` for that host; preflight from an unknown origin returns **no such header** |
| **`--cpu-boost`: the 25 s alarm was a FRESH-PUSH artifact, resolved 2026-08-09** | The two readings that raised it — `loadMs` **25,857 ms** (`…00003-jrl`) and **25,216 ms** (`…00004-nc2`) — were both taken shortly after a push, and the row concluded the flag "had not earned its place". **Four later starts on the very same revision `…00004-nc2` read 10,096 / 11,166 / 10,093 / 9,849 ms** (2026-08-08 22:30 → 2026-08-09 10:15), i.e. back at the **9,500 ms** pre-boost level. So the lazy-image-layer explanation was right after all and simply needed longer to fade; holding the revision constant is what showed it. **Standing read: boost changes nothing visible either way, and load is ~10 s.** The controlled boost-off comparison is still unrun, but nothing now argues for removing the flag |
| **~~A genuine cold start is STILL not measured~~ — MEASURED 2026-08-09**, in the row further up | Kept for the method it cost. The 2026-08-06 attempt (18 min idle, then `/health`) **did not capture one**: the reply came back in 0.26 s with `uptimeS` 315, i.e. a warm instance that had started ~5 min earlier without being asked. What finally worked is what this row predicted — **container-start timestamps from the logs**, rather than a wall-clock guess at when Cloud Run scales to zero |

⚠ **Still not measured:** behaviour with two friends uploading at once — though 2026-08-09 gave a
one-sided hint of it, when a `/health` arriving mid-decode was served by a second container in ~11 s
rather than queued. The **cost** of a cold start after real idle came off this list on 2026-08-09;
whether the **app** survives one on a live idle service did not, and is an open risk in
[STATUS.md](STATUS.md).

### The pre-deploy laptop numbers, kept for the comparison

⚠ Every row below is the dev M4. They are what the cloud figures above should be read against.

| Measure | Value |
|---|---|
| **Server vs browser, same pixels** (2026-08-06) | **120/128 strips (93.8%)** identical token ids over 6 pages. Identical rate at `OMR_MAX_BATCH=1` — 120/128 again, but **a different 8 strips**, so batching moves *which* near-ties flip and not *how many*. Divergences sit where the model was unsure: median browser log-prob at the diverging token **−0.60 (p = 0.55)** |
| **Server vs browser, against GOLD** (2026-08-06) | The check that decides it, since agreement cannot say which side is right. Same 267 hand-verified `_realval_v2` strips, same scorer, **paired: no detectable difference.** Exact-match discordance browser-only 3 / server-only 5, **McNemar exact p = 0.727**; total edits **780 vs 768**; per-strip sign test **p = 0.664** |
| Unpaired columns for the same run | python SER 0.0821 / exact 60.2% / AEU macro 94.8% / micro 92.5% · browser 0.0818 / 60.2% / 94.9% / 92.5% · **server 0.0806 / 60.5% / 94.6% / 91.9%** (n = 261 head-to-head). ⚠ Every gap is ≤0.6 pp and the paired test above is the one to quote |
| **Cost per page, by container shape** | 1 vCPU **11.7 vCPU-s** (11.8 s wall) · 2 vCPU 16.8 (8.3 s) · 4 vCPU 29.3 (7.4 s), median over 6 pages / 128 strips, from the server's own `process.cpuUsage()`. **1 vCPU is the cheapest by 2.5×**; free tier ≈ **15,400 pages/month** there |
| **Batching does not pay** (2026-08-06) | Batch 8 vs batch 1 is **slower at every thread count** (1 thr 12.0 vs 11.8 s/page, 2 thr 8.7 vs 8.3, 4 thr 7.4 vs 7.4) and costs **2.9× the peak memory** — 38-strip page, **2,778 MB vs 955 MB**. `OMR_MAX_BATCH` now defaults to **1**. This withdrew a stated advantage of having a server at all |
| **A page in the real app, server vs browser** | Same page, same M4, `smoke:page`: **6.0 s on the server against 24.5 s in the browser** (~4×, native ORT vs wasm), identical result — 7 staves → 16 strips → **344 notes / 28 measures** either way. The tab's slowest reply during the read: **29 ms vs 2,358 ms** |
| Fallback | A dead server produces the same 344 notes / 28 measures in **25.0 s** locally and says so in the status line |
| Upload payload | Crops upload is **0.11×–2.03× the page image, median ~1.7×** (6 pages) — base64 costs a third and a padded 409×583 PNG is not small. ⚠ This **withdrew** the "smaller upload" reason for the client/server seam |
| Server model load | **1.5 s** for the three int8 graphs (`onnxruntime-node`), against ~3.0–3.4 s in the browser. It is the *floor* for a Cloud Run cold start, not the cold start |
| **The deployable app** (2026-08-06) | `npm run build:app` → **43.3 MB** (ORT wasm 25.6, opencv.js 14.8), from a `public/` of 332 MB + 220 render scores. `smoke:build` drives the BUILT app on both paths: server **8.3 s**, cross-origin fallback **34.0 s**, identical score (9 staves → 26 strips → **399 notes / 26 measures**). **Largest single file: `ort/ort-wasm-simd-threaded.jsep.wasm` at 26,827,543 bytes = 25.58 MiB** — the number that ruled out Cloudflare Pages (25 MiB cap) and sent the app to Netlify. ORT's non-jsep binary is **12.86 MiB**, unused for now |
| **A production-only bug the build check caught** | In the built app every `InferenceSession.create` logged `document is not defined` and **never resolved** — the fallback hung forever. The bundler inlines ORT's `…jsep.mjs`, which is also the worker script, and a Worker has no `document`. Dev, `smoke:page` and the 27/28 gate were all green throughout |
| Safety limits | `npm run check:limits`: **6/6** payload cases + the per-IP rate limit. Caps: 12 MB body (on bytes seen), 40 strips, 409×583 8-bit PNG only, 20 requests / 60 s |

## Makam detection (2026-08-07) — signature + karar, over the 213 bundled scores

The table and the method: [mvp/makam.md](mvp/makam.md). Scored two ways, because the useful
question is not "did it name the makam" but **"does the piece come out in tune"** — a makam with
no intonation rules sounds identical to `none`, so a wrong *name* there costs nothing.

| Measure | Value |
|---|---|
| **Audibly correct** — selected makam's intonation rules equal the true makam's (both-empty counts) | **204/213 (95.8%)** |
| Audibly wrong — a bend applied that the true makam does not take, or the wrong bend | **5/213 (2.3%)** |
| Missed a bend — declined or matched a no-rule makam where the true one does bend | 4/213 (1.9%) |
| Exact makam name | 101/213 (47.4%) |
| Right sound under a different name (e.g. beyati read as ussak) | 57/213 |
| Declined (`none`, plays as written) | 50/213 |

⚠ **Measured on clean SymbTr scores, not on decoded pages.** It scores the heuristic, not the
product: a decoded page's `deriveKeySignature` is noisier than a corpus score's, so this is an
upper bound on what a user sees. No decoded-page measurement exists yet.

The "decline when the karar contradicts the signature" rule was chosen on this measurement: it
traded **2 audibly wrong pieces for 2 that merely stay as written** (7→5 wrong, 2→4 missed), which
is the trade the feature exists to make. The residual 5 are the genuinely hard pairs — beyati vs
hüseyni share both a signature and a karar, and only the seyir separates them, which nothing here
reads.

## Runtime / engineering

| Measure | Value |
|---|---|
| Model | `Flova/omr_transformer`, ~143M params |
| int8 ONNX bundle | 221 MB total (from ~830 MB fp32) |
| Browser decode | ~1.0–1.5 s/strip (`onnxruntime-web`, wasm threaded), session load ~3 s |
| **Decoded marks that reach the page** (2026-08-05) | Over the 1,704 decode caches: `\tup3` notes drawn at the wrong length with no bracket **1,287 → 0** (22.9% of `\tup3`-bearing pages affected → 0). Repeats: 1,262 pages carry `\repstart`/`\repend`, **1,165 (92.3%) unfold**, **97 (7.7%) have no effect** — an unmatched `\repstart`, left alone rather than guessed at |
| **Whole page in the app, after the deskew speedup** (2026-08-05) | **~25 s** on the same 7-staff page: slice **1.6 s** + decode **19.1 s** for 16 strips. The slicer over the parity sample went **36.6 → 1.3 s/page**, i.e. faster than the Python it copies (~1.9 s stage 1). Decode is now the bottleneck |
| **`qualifyingLineRows` row-sum stage** (2026-08-05) | **856 ms → 6.8 ms per call, 125.8× faster**, over 328 angle evaluations on 8 real pages, with **0 disagreements** against the morphology it replaces. ~34.8 s saved per 41-angle sweep |
| **Whole page in the app** (2026-08-05, MVP W7) | **~56 s** on one 7-staff page: slice **36.4 s** (of which ~35 s is the 41-rotation skew sweep) + decode **19.1 s** for 16 strips, on a 7-staff page. Model load ~3.4 s more on a cold session. Longest single main-thread block **2.35 s** — the sweep yields between rotations. The slicer's corpus-mean cost is in [METRICS-SLICER-PORT.md](METRICS-SLICER-PORT.md) |
| Page decode (Mac, int8) | ~353 ms/strip ≈ 7.4 s/page |
| Round-1 ship gate | parity 10/10 fp32 + 10/10 int8; browser gate **19/20** — one double-dot token (`a''2..`) trips an ORT-web int8 numerics wobble, model-independent, logged not blocking |
| Round-2 ship gate (2026-07-27, live) | parity 14/14 fp32 + 14/14 int8; browser gate **27/28** — canvas (product) path 14/14, one *reference*-path strip drops a `\tup3`; deterministic, logged not blocking. Round-1's double-dot failure did not reproduce |
| That gate miss, measured | the flipped token is a real near-tie: `\tup3` **p=0.689** vs `e` **p=0.306** under Python-ORT int8 — the only token in the strip below 0.99 (next lowest 0.938). ORT-web wasm int8 tips it; the graph and the JS preprocessing are both exonerated |
| Training strip geometry | H=336 px, staff spacing 30 px, top line y≈138; label cap 59 ids |
| Slicer staff-detection kernel | `STAFF_HOR_FRAC = 0.11` of page width (was `w/4`) |
