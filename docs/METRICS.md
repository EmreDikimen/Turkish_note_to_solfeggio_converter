# Metrics — every headline number, once

purpose: the single home for measured numbers — the headline table, plus the live app's usage, the owner's hand-test set, the shipped ONNX model and the b8 re-emit
audience: agents and the owner, whenever a number is needed
updated: 2026-11-20

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

## Model quality — real exam → [METRICS-EXAM.md](METRICS-EXAM.md)

Moved 2026-08-11: at 188 of this file's 399 lines it was half of it, and the file hit its 400-line
cap. **Every exam number, every round, unchanged** — including the ship-criteria table and the
low-n caveats — is in [METRICS-EXAM.md](METRICS-EXAM.md). Nothing about the exam is restated here.

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

### Round 3's checkpoint choice and its real-val position (2026-09-01) → [METRICS-EXAM.md](METRICS-EXAM.md#metrics--round-3s-two-follow-up-runs-a-and-b)

⭐ **`last` beat `best` on every column — the selector picked the worse model** (667 edits against 784,
exact 68.3% against 63.4% on `_realval_v2`'s 262 strips), and against Round 2 the sign test is decisive
at 72 : 22 while the mean-edits CI spans zero. ⭐ **Round 3's gain was confined to SHORT strips**
(improve:regress 4.4 : 1 under 50 tokens against **1.25 : 1** at ≥ 50) — the lead Round 4 was opened on.
Tables, the concentration of the damage, and the exam caveat are in that file.

### Round 3's two follow-up runs (A and B) → [METRICS-EXAM.md](METRICS-EXAM.md#metrics--round-3s-two-follow-up-runs-a-and-b)

⛔ **Both are NULLS and Round 3's shipped choice stands** — exact-match 68.3% / 69.1% / 69.5% on the
same 262 strips, every CI spanning zero. ⭐ Run A is the project's cleanest demonstration that a **6%
better val loss can be worth zero edits**.

### Round 4 — the vocabulary A/B, the dense read, the live model → [METRICS-EXAM.md](METRICS-EXAM.md#round-4s-vocabulary-ab--how-it-is-scored-and-what-the-kit-measured-before-any-gpu-ran)

⛔ **Scheme H is a NULL everywhere it was measured**, including the dense strips it was built for:
H − control is 42 vs **35** edits on `_denseval_h1_dense` (117, p = 0.549), 76 vs **69** over all 442
held-out strips (p = 1.000) and 397 vs **377** on `_realval_v2r` (260, p = 0.749). ⭐ **Round 4's
control beats the LIVE model on dense strips** — **−0.111 edits/strip, CI [−0.291, −0.009]**, 6 better
/ 1 worse — while being a null overall (−0.020/strip over 442). ⭐ **H's remaining case is the decoder
ceiling**: **5.91%** of all 15,711 candidate strips exceed 99 old ids against **0.30%** under H.
⚠ **An edit count is comparable only inside one vocabulary** — `paired_arm_score.py --score-vocab old`.

### The exported runtime (ONNX / int8) → [METRICS.md](#metrics--the-exported-runtime-onnx-export-int8-quantization-parity)

Export validation, int8 sizes, and the parity of the quantized graphs against PyTorch — including the finding that int8 is exact on the 14 synthetic gate strips and diverges on **~10% of real ones**, in Round 2 as well as Round 3.

### ⛔ Round 3's real-val gain is the `\tie` RETIREMENT, not better note reading (2026-09-01)

Found by `error_taxonomy.py` while classifying the errors: Round 2's single largest error category
was `other`, and `other` was **`\tie` insertions**. `\tie` was retired 2026-08-22; Round 2 was
trained before that and still emits it, **`_realval_v2` gold contains zero**, and Round 3 emits zero.

**`round2-stage2-best` emits 86 `\tie` over 60 of 262 strips.** What `stitch.ts` would do with them,
measured strip by strip rather than assumed:

| what the tie joins | n | stitcher behaviour | costs the user |
|---|---|---|---|
| **same pitch** | **26 (30%)** | **merges two notes into one longer note** | ⛔ **yes — a wrong note** |
| different pitch | 56 (65%) | kept as separate notes + a warning | ✅ nothing |
| dangling | 4 (5%) | dropped + a warning | ✅ nothing |

⭐ **65% joining different pitches independently replicates the 65–78% that justified the
retirement** ([../CLAUDE.md](../CLAUDE.md)), on a pool that figure was not derived from.

**The priority block (short+mid, n = 218) under three accountings:**

| accounting | R2 edits | R3 edits | change | R2 exact | R3 exact | change |
|---|---|---|---|---|---|---|
| all 86 ties charged | 345 | 270 | **−21.7%** | 53.2% | 69.3% | **+16.1 pp** |
| **only the 26 HARMFUL ties** | 291 | 270 | **−7.2%** | 64.7% | 69.3% | **+4.6 pp** |
| no ties charged | 271 | 270 | **−0.4%** | 69.7% | 69.3% | **−0.5 pp** |

⛔ **READ THE BOTTOM ROW. With `\tie` discounted, Round 3 and Round 2 are indistinguishable on this
pool** — 270 edits against 271, exact 69.3% against 69.7%. Every measurable real-val gain Round 3
has comes from no longer emitting a retired token. ⚠ **That gain is real** — 26 fewer merged-note
errors over 262 strips — **but it is not the content improvement the three render flags were meant to
deliver**, and it must not be reported as one.

⚠ **The middle row is the product-relevant estimate**: −7.2% edits, +4.6 pp exact.
⚠ **Consequence for the exam**: `examv3` gold is also tie-free (0/660), so the **44%**
`round2-stage2-best` baseline already charges Round 2 for its ties. Round 3 will therefore beat it
partly on this mechanism — and on 2026-09-01 it did: ~15 of its +17 points ([METRICS-EXAM.md](METRICS-EXAM.md#metrics--the-exam-as-an-instrument)). The comparison is fair — same instrument, same pages — but the ship
judgement must not credit the gain to the render flags.
Raw: `data/real/rung3/final/taxonomy_realval_v2.json`.

### Round 3's error taxonomy on real-val (2026-09-01)

`error_taxonomy.py`, label-token space. ⛔ **Not comparable with the edit counts above**, which are
id-space. Categories sum to more than the edit count by design (one substitution can be pitch *and*
duration).

| bucket | strips | R2 exact | **R3 exact** |
|---|---|---|---|
| short < 30 ids | 100 | 58.0% | **77.0%** |
| mid 30–49 | 118 | 49.2% | **62.7%** |
| long ≥ 50 | 44 | 61.4% | **63.6%** |

⚠ These are the tie-inflated numbers; the bucket *shape* survives the discount, the sizes do not.
**Round 3's remaining error mix, priority block** (270 edits, categories raised): signature 53
(17.5%), pitch 48 (15.9%), duration 45 (14.9%), note-extra 36 (11.9%), accidental 28 (9.3%),
repeat-structure 26 (8.6%), note-missing 25 (8.3%), note-vs-rest 16 (5.3%), other 9, tuplet 8,
barline 7, grace 1. ⭐ **Signature is the largest single category** and every `\sig` in a real-page
label is itself unverified ([BACKLOG.md](BACKLOG.md) item 9) — so part of that 17.5% may be bad gold
rather than bad decoding. ⚠ On long strips the mix is different: **note-missing is 37.5%**, the
model dropping notes it never had enough training examples of.

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
  | neyzen (cleaner scans) | 79 | 96.5% | 0.021 | 77.2% |
  | nota (scanned TRT-era prints) | 188 | 93.8% | **0.105** | 56.9% |

  **SER is 5× worse on nota**, and the hard tier is nota-dominant — so "hard" in this pool largely
  means *scan quality and engraving age*, not musical density. Worth keeping in view before
  attributing a future round's real-val movement to anything else.
  ⚠ **The neyzen row said "clean vector PDFs" until 2026-08-18 and that was wrong** — a census of
  every PDF on disk found **0 of 1,055 neyzen files born-digital**; they are all raster scans, just
  better ones ([METRICS-CORPUS.md](METRICS-CORPUS.md)). The numbers above are untouched; only the
  label was. The genuinely born-digital pages are **88 nota pieces**, and they are their own tier.

### `_tupletval` — the tuplet A/B's selection pool (built 2026-08-13)

Every `\tup3`-bearing strip already on the VAL side of `strips_tup` + `_realval_v2`
(`scripts/rung3/build_tuplet_val.py`): **54 gold groups over 28 strips, 11 pieces**, neyzen 24 /
nota 4. Exam pieces refused, one decode-derived label dropped, 8 filename collisions resolved to
the newer slicer's crop. Protocol: [archive/rounds.md](archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol).

**THE A/B RESULT (2026-08-15) — NULL.** Both arms trained on the identical recipe; the pre-registered
statistic is free-running `\tup3` recall on this pool, paired.

| arm | gold | hit | recall | precision |
|---|---|---|---|---|
| **tupnew** (arc broken, "3" in the gap) | 54 | 48 | **88.9%** | 98.0% |
| **tupctl** (the pre-2026-08-12 continuous arc) | 54 | 46 | **85.2%** | 95.8% |

**Δ +3.7 pp = 2 net groups; paired 4 NEW-only vs 2 CTL-only; exact McNemar p = 0.688.** The
pre-registered threshold was ~6 discordant groups one way (~11 pp), so this is a null and is reported
as one. Guard on `_realval_v2`: mean AEU F1 **83.9% vs 83.3%** (the ≤1 pp clause passes), everything
else a wash. ⚠ **`\tup3` on `_realval_v2` reads 91.4% vs 80.0% — not a second result**: those 35
groups are a SUBSET of these 54. Full read: [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md).

⚠ **The control scored 85.2% — exactly what `round2-stage2-best` scores below.** The `staff_jitter`
augmentation, the rasterizer drift and a new training environment together moved this class by zero.

Reference read, `round2-stage2-best` (the live model) on this pool, CPU, 2026-08-13 — **context for
the A/B, not a selection**:

| | value |
|---|---|
| `\tup3` recall / precision | **85.2% / 97.9%** (54 gold) |
| `\tupend` recall / precision | 79.2% / 93.3% |
| SER · exact-match | 0.071 · 42.9% |
| pages ≤5 corrections | 75% (16 pages, 1.8 strips/page) |

- **The pool is not flattering on the class it exists to measure**: 85.2% here against 83.8% on the
  exam, where real-val's headline usually reads far higher than the exam's. That is the one property
  a selection set for this A/B needs.
- ⚠ **AEU gold is nearly absent** (13 tokens over 4 classes) — this pool measures tuplets and
  nothing else. The accidental guard is read on `_realval_v2`.
- ⚠ n=54 means one group is 1.9 pp, and the exact-McNemar threshold is ~6 discordant groups
  (~11 pp). Quote every number here with its n.
- ⚠ **The pool is PIECE-CONCENTRATED** (found 2026-08-15, after the A/B): one piece
  (`acemasiran--sarki--senginsemai--canan_okuyor`) supplies **19 of the 54 groups — 35%** — and 7 of
  the 8 strips either arm got wrong. Any *subgroup* claim off this pool is really a claim about that
  piece. The headline paired comparison is unaffected (both arms read the same strips), but a future
  build of this pool should cap per-piece share the way the labelling queues cap 3 strips per piece.

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

## The second engraver (Lever 4) → [METRICS-INPUT.md](METRICS-INPUT.md#metrics--the-second-engraver-round-3-lever-4)

New 2026-08-18. That file owns the LilyPond arm: the AEU glyph-mapping check, the 312-strip pilot,
its pixels-vs-labels gate, the domain-gap read against a matched VexFlow control, and the two limits
that read matters under — the instrument is blind to most of what an engraver changes, and the staff
geometry was pinned on purpose.

## Corpora, pools and label quality

Moved to [METRICS-CORPUS.md](METRICS-CORPUS.md) on 2026-07-28 (this file hit the 400-line cap).
That file owns corpus sizes, pool composition, hand-audited label-noise rates, the carry
pixels-vs-labels defect and the `verify-labels.ts` verification.

## Decode server (MVP W9) — DEPLOYED 2026-08-06, measured on Cloud Run

Service: `omr-decode`, europe-west3, 1 vCPU / 2 GiB / concurrency 1 / max-instances 3 when these rows were measured (**10 since 2026-09-04**). ⛔ Every "fallback" row below is history: since 2026-09-04 a deployed build reads nothing in the browser.
Rows marked **M4** are the dev laptop; rows marked **Cloud Run** are the deployed service.
Plan: [app/server.md](app/server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for).

| Measure (Cloud Run, 1 vCPU) | Value |
|---|---|
| **Cold start** | **10.6 s** to a first answer, of which **9.5 s is loading the three graphs** (against 1.5 s on the M4). Container start is the small half. ⚠ **Until 2026-08-08 a cold start did not cost 10.6 s of waiting — it cost the server path entirely.** The container listens before its graphs are loaded, so a decode arriving in that window got the truthful `503 model still loading`, and `remote.ts` treated any error as "fall back" with no retry: the whole page was then read on the user's own machine (**+211 MB of weights on a first fallback**). **Fixed the same day** — the client waits out a warming server and pings `/health` on open; a cold start is once again just ~10 s of waiting. Row below |
| **Cost per strip** | **1.93 vCPU-s** — against **0.55** on an M4 core at 1 thread, so **a shared cloud vCPU is ~3.5× slower** |
| **Cost per page** | ~**40 vCPU-s** for a 21-strip page → free tier ≈ **4,450 pages/month**. A 38-strip page measured **69.9 vCPU-s / 71 s** |
| **⚠ It is SLOWER than the user's own browser** | 128 strips: **250 s on Cloud Run vs 166 s in the M4 browser (0.66×)**. Warm. Cold adds 10.6 s. **This is the outcome deploy.md predicted and the release was chosen on** — the win is the friend's laptop staying cool, not speed |
| **Reads the same as the browser** | **120/128 strips (93.8%)** identical token ids — *the same rate as the local server*, and the divergences again sit on near-ties (median browser log-prob at the diverging token **−0.87, p = 0.42**) |
| **Per strip / per page** | **~2.0 s a strip**; a 16-strip page **~35 s** warm and ~46 s cold, a 26-strip page **~55 s** warm. The encoder is **74–81%** of it, so nothing that leaves the encoder alone matters. ⚠ The same 26-strip page reads in **34 s in the owner's browser** — the server is slower, by choice |
| **Parallelism works** (2026-08-06) | Three page requests at once finished in **35.5 s**, against ~80 s if run one after another, and **server-side time did not degrade** (23.5 / 26.4 / 22.6 s) — Cloud Run gave three machines and each kept full speed. The extra wall time on two of them is their own cold start. This is the measured basis for splitting ONE page across instances: [app/server.md](app/server.md#making-a-page-faster--the-options-with-what-each-one-costs) |
| Safety limits, live | `check:limits` **6/6** after one fix: a destroyed socket reached Cloud Run's proxy as a **503** rather than a 413, turning a client error into an apparent outage |
| **The BUILT app against the LIVE service** (2026-08-06) | The first end-to-end run of the deployable artifact against Cloud Run rather than a local server — `smoke:build --decode-url <service>`, **PASS on both paths**. Same 26-strip page: **61.2 s reading on the server** against **33.2 s in the local fallback** on the same M4, identical score (9 staves → 26 strips → **399 notes / 26 measures**), `crossOriginIsolated` true and no page errors on either. ⚠ The server being ~1.8× slower here is the 0.66× row above seen end to end, plus this page being 26 strips rather than 16 |

| **The DEPLOYED site, driven as a friend would** (2026-08-06, `npm run smoke:live`) | **PASS on both paths** against <https://komavision.netlify.app> with the origin lock on — the shipped configuration, which no other check can reach any more. Server path **49.8 s** (47.4 s reading, 26 strips, warm); **fallback 73.0 s**, weights pulled from the Hub over the real network. Same score both ways (9 staves → 26 strips → **399 notes / 26 measures**), `crossOriginIsolated` true, **no page errors on either**. This is the number to quote for "what a friend experiences" |
| **The DEPLOYED site after the 2026-08-08 redeploy** (`npm run smoke:live`) | **PASS on both paths**, warm: server **47.5 s** (44.4 s reading), **fallback 64.2 s** from the Hub, same score both ways (9 staves → 26 strips → **399 notes / 26 measures**), isolated, no page errors. Unchanged from 2026-08-06 within noise, which is the point — the frontend grew makam selection, the style pass and the editor, and the decode chain did not move. ⚠ **The FIRST run of this pair FAILED, and the failure is the finding**: the container was cold, `/decode` answered **503 model still loading**, and the app fell back to the browser for the whole page — `data-where=local-fallback` where `server` was wanted. Re-run after one `/health` ping (which cold-started it in 10.7 s, `loadMs` 9,183) it passes. So `smoke:live`'s server assertion is only meaningful against a warm service, and a friend's first upload after idle silently takes the slow path |
| **The DEPLOYED site after the 2026-08-09 COPYRIGHT redeploy** (`npm run smoke:live`) | **PASS on both paths**, warm (an earlier note here claimed this run started cold — see the correction two rows below): server **48.8 s** (45.3 s reading), **fallback 79.8 s** from the Hub, same score both ways (9 staves → 26 strips → **399 notes / 26 measures**), isolated, no page errors. Within noise of 2026-08-06 and 2026-08-08 — the deploy removed five bundled scores and moved no decode code, and the numbers say so. The build that shipped: **11 files, 42.7 MB**, no `.json` at the dist root, both real URLs baked in, zero `localhost:8080` strings. Live host after it: all five scores plus `/scores/` and `/models/model.json` answer **404**, having answered **200** the same morning |
| **A GENUINE cold start, measured at last** (2026-08-09, Cloud Run logs) | The row two below said this was unmeasured; it now is. After **~3 h** idle (last container start 07:12:28), a `/health` at **10:11:41** took **11.29 s** end to end, of which **10,093 ms** is graph loading (`model ready` at 10:11:53). So the honest cold-start cost is **~11 s**, on a genuinely idle service rather than minutes after a deploy. ⚠ **What this row does NOT say** — see the correction below — is that the *app* survived it: the client that paid the 11.29 s was a crawler asking `/health`, and no `/decode` followed it |
| **⚠ CORRECTION, same day: that cold start was NOT `smoke:live`'s** | First written up as "the fix is proven on a genuinely idle service", from wall-clock proximity alone. The request log says otherwise: the 10:11:41 cold start came from **`HeadlessChrome/131`, referer the unique deploy URL** — an automated visitor that arrives seconds after a Netlify deploy. `smoke:live` opened **33 s later** and its `/health` returned in **2 ms**, warm. Its `/decode` (10:12:18, 200 in 43.7 s, `data-where=server`) is therefore a **warm** result like the two before it. **The standing lesson: a post-deploy `smoke:live` can never be the cold test**, because the deploy summons the thing that warms it. Attribute a container start to a client before drawing anything from it |
| **⚠ A second way the same day's readings misled** | Concurrency is **1**, so a request arriving during a decode gets its **own fresh container**. A `/health` curl fired while the owner's upload was decoding returned `uptimeS` **11** and `loadMs` **9,849** — visually identical to scale-to-zero, and first read as "the service goes cold within minutes". It was concurrency spillover. **One `/health` cannot tell a busy service from an idle one**; only the request log distinguishes them |
| **The cold-start fix, measured** (2026-08-08, `npm run check:coldstart`) | A proxy that is deliberately cold for a set window, in front of a real decode server, so the race is a parameter. **Cold for 12 s: the page still finished ON THE SERVER** (9/26/399/26 in 22.5 s — the wait, then a 10 s decode), having re-POSTed after waiting; and opening the app is confirmed to ping `/health`. **The other half, which keeps it honest: a load that genuinely FAILED is not waited on** — one `/decode`, zero follow-up `/health` polls in the next 8 s, so a broken container still falls back at once instead of stranding the user for the 40 s budget. Live confirmation on a genuinely idle service is in the row below |
| **The built app, this build** (2026-08-08, `smoke:build` against a local `dev:server`) | **PASS on both paths**, **9/26/399/26 identical** — the same score as the 2026-08-06 run, so the palette follow-ups and editor steps 5–8 changed nothing the built artifact reads. Server path 13.0 s, cross-origin fallback 36.6 s (local weights, 2 ORT threads). `dist/` **43.4 MB**, no `.onnx`, ORT shipped as real files under `/ort/` |
| **The grace-note box bug, measured** (2026-08-08, owner-reported) | On `beyati-delisin.json` (427 note boxes, median **18×47 px**): **14 boxes — exactly its 14 grace notes — ran from the SVG origin to their own note**, the largest **949×1805 px**. Consequence, measured by asking `elementFromPoint` who owns each box's own centre: **126 of the 134 on-screen boxes had their click stolen** by a giant one lying over them. That is the whole of the report ("one giant note I must delete before I can edit") as a number — and the deletions it forced were of real notes. After the fix: **0 at the origin, 0 stolen**, median unchanged at 18×47, so ordinary notes kept their boxes. Cause: `StaveNote.getBoundingBox()` merges every modifier's box and `GraceNoteGroup` never positions itself, so it reports (0,0) |
| **The editor on the DEPLOYED build** (2026-08-08) | The gap `smoke:live` cannot see: `smoke:editor` drives the Vite **dev** server, so editor steps 1–8 had never run in a production bundle on the real host. A throwaway Playwright pass over <https://komavision.netlify.app> — **all 27 palette tools arm themselves**, every glyph fits inside its button (measured against the loaded Bravura, the minified-CSS risk), select → ✕ → undo restores the count (513 → 512 → 513), armed insert on blank staff previews a pitched ghost and lands the note (→ 514), the palette's Çal starts and shows a playhead, Dur stops it, **no page errors**. Not a repo check: `#save-json` was due for deletion (and was removed 2026-08-30), so nothing was added to `package.json` |
| **Origin lock, final shape** (revision `omr-decode-00004-nc2`) | Allowed: the Netlify host, `http://localhost:5173`, `http://localhost:4173` (so `dev:web` can reach the live server during frontend work). An unknown origin gets **no** `access-control-allow-origin` at all. ⚠ Consequence: `smoke:build` from a localhost preview against the live server now fails CORS **by design** |
| **The whole chain, live** (2026-08-06) | App on Netlify, weights on the Hub, decode on Cloud Run. `smoke:build` against **both real remotes**: **PASS on both paths**, identical score (9 staves → 26 strips → 399 notes / 26 measures). Server path **59.2 s**; **fallback 69.9 s against 33.2 s with local weights** — the ~37 s gap is a friend's one-time **211 MB** download of the graphs from the Hub, and it is paid only on a first fallback |
| **The deployed site, checked from outside** | COOP/COEP both present (Netlify serving `public/_headers` unchanged) · the 25.58 MiB wasm served whole as `application/wasm` · `/models/encoder_model.onnx` **404**, so no weights reached the static host · the shipped bundle points at the real Cloud Run and Hub URLs |
| **Origin lock** (revision `omr-decode-00003-jrl`) | Preflight from `https://komavision.netlify.app` returns `access-control-allow-origin` for that host; preflight from an unknown origin returns **no such header** |
| **`--cpu-boost`: the 25 s alarm was a FRESH-PUSH artifact, resolved 2026-08-09** | The two readings that raised it — `loadMs` **25,857 ms** (`…00003-jrl`) and **25,216 ms** (`…00004-nc2`) — were both taken shortly after a push, and the row concluded the flag "had not earned its place". **Four later starts on the very same revision `…00004-nc2` read 10,096 / 11,166 / 10,093 / 9,849 ms** (2026-08-08 22:30 → 2026-08-09 10:15), i.e. back at the **9,500 ms** pre-boost level. So the lazy-image-layer explanation was right after all and simply needed longer to fade; holding the revision constant is what showed it. **Standing read: boost changes nothing visible either way, and load is ~10 s.** The controlled boost-off comparison is still unrun, but nothing now argues for removing the flag |
| **~~A genuine cold start is STILL not measured~~ — MEASURED 2026-08-09**, in the row further up | Kept for the method it cost. The 2026-08-06 attempt (18 min idle, then `/health`) **did not capture one**: the reply came back in 0.26 s with `uptimeS` 315, i.e. a warm instance that had started ~5 min earlier without being asked. What finally worked is what this row predicted — **container-start timestamps from the logs**, rather than a wall-clock guess at when Cloud Run scales to zero |

⚠ **Still not measured:** behaviour with two friends uploading at once — though 2026-08-09 gave a
one-sided hint of it, when a `/health` arriving mid-decode was served by a second container in ~11 s
rather than queued. The **cost** of a cold start after real idle came off this list on 2026-08-09;
whether the **app** survives one on a live idle service did not ([BACKLOG.md](BACKLOG.md#open-risks-and-non-claims)). Since
2026-09-04 a cold start that outlasts `WARMUP_WAIT_MS` (120 s) shows `server-unavailable`; one cold
start was measured at **38.2 s** that day.

📊 **Who arrives at the live service — how many visitors, on what devices, and how much of it is
robots — moved to [METRICS.md](#metrics--who-actually-uses-the-deployed-app)** on 2026-08-09. The rows above measure how
the system *performs*; that file measures who *shows up*.

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

The table and the method: [app/README.md](app/README.md#makam-selection--the-performed-intonation). Scored two ways, because the useful
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
| **Saving a score, three engines** (2026-10-17, `npm run check:export`, `beyati-delisin.json`) | Chromium, Firefox, WebKit: **0 music glyphs left as font text** in every export. PNG **2136×4756**, ink **8.53 / 8.54 / 8.55%**. PDF **2 A4 pages**, **207 / 201 / 218 KB**, ink per page average **6.18 / 6.12 / 5.83%**, no blank page. Outlines: **3,650 glyphs in 23 files, 2,287 KB** raw, fetched per block only when saving. ⚠ Not run on Samsung Internet — the tester's phone is the check that matters. **Round 2 (canvas replay, no SVG image):** against round 1's image route the same PNG differs on **0.004–0.005%** of pixels by more than 64 grey levels (edge antialiasing), mean \|Δ\| **0.05–0.06**; on `decoded.json`, light and dark theme alike, PNG ink **7.17 / 7.18 / 7.18%**, PDF **5.73 / 5.75 / 5.41%** |
| **The DEPLOYED site after the 2026-08-13 F1 redeploy** (`npm run smoke:live`) | **PASS on both paths**, warm: server **49.9 s** (45.8 s reading), **fallback 64.6 s** from the Hub, same score both ways (9 staves → 26 strips → **399 notes / 26 measures**), isolated, no page errors. Within noise of every read since 2026-08-06 — F1 added no decode code, and the numbers say so. Spot-checked live afterwards, because `smoke:live` does **not** cover audio: the voices URL is baked into the shipped bundle (`index-C7uR4vG3.js`), the drum wavs still answer **200** from `/audio/` (the check that the split base held in production), and `sample.json` still answers **404** |
| **F1's instrument voices** (2026-08-13) | **26 files, 55.6 MB** in `Beyaban/omr-voices`, byte-identical to VSCO 2 CE (sha256-checked): clarinet `susLong` v2, 11 pitches, 20.2 MB; solo violin `Arco Vib` f, 15 pitches, 35.4 MB. **None of it enters `dist/`** — the build is still **23 files, 43.4 MB** and `MAX_AUDIO_MB` is untouched at 1. Playback level is a per-voice gain (3.775 / 3.156) clamped so `gain × peak ≤ 0.98`, i.e. never above the synthesised note it replaces. Pitch through the resampler: **1,841 sampled pitches × the makam deltas, worst 9.9e-5 cents** — 1/229,000 of a koma. ⚠ Non-claim: the violin's vibrato swings **0.9–1.2 komas**, so its centre is exact but it cannot demonstrate a koma-sized interval; the clarinet is steady to 0.1 |
| **The DEPLOYED site after the 2026-08-11 FEATURE redeploy** (`npm run smoke:live`) | **PASS on both paths**, warm: server **47.5 s** (44.3 s reading), **fallback 62.9 s** from the Hub, same score both ways (9 staves → 26 strips → **399 notes / 26 measures**), isolated, no page errors. Within noise of every read since 2026-08-06 — this deploy added F0, F2 and 660 KB of audio and moved no decode code, and the numbers say so. Shipped: **23 files, 43.4 MB**, 17 changed files uploaded. Spot-checked live afterwards: all six `/audio/…-rr1.wav` answer **200** (45–62 KB, `audio/x-wav`), `/THIRD-PARTY.txt` carries the VCSL attribution, and `sample.json` still answers **404** — the copyright guard holds across the new deploy |
| **Deployable build after F2's drum samples** (2026-08-11, `npm run build:app`) | **23 files, 43.4 MB** — up 0.7 MB from the 2026-08-09 build's 42.7 MB, all of it audio. `dist/audio/` is **660 KB**: two kits × three strokes × two round-robins, 16-bit mono 44.1 kHz, tails cut at 700 ms. Headroom against `MAX_TOTAL_MB = 60` is ~17 MB, which F1 exceeds on its **first** instrument — measured at ~20 MB, so its voices go to a Hub repo rather than shipping here. ⚠ Both new `prune-dist.mjs` conditions were **verified to fail the build** when tripped (audio outside `audio/`; audio over `MAX_AUDIO_MB = 1`), not just to pass when clean |
| int8 ONNX bundle | 221 MB total (from ~830 MB fp32) |
| Browser decode | ~1.0–1.5 s/strip (`onnxruntime-web`, wasm threaded), session load ~3 s |
| **Folding the page back into a normal score** (2026-08-30, `npm run check:fold`) | Over the **1,720** cached page decodes in `strips_v2`: **1,173 (68.2%) fold** — the written score is shorter than the performance — and across all of them **44,475 written bars against 64,859 played**, so a page is **31.4% shorter** on screen than the flattened form it replaces. ⭐ **0 pages changed sound**: unfolding the written score along `playBars` reproduces the flattened document event for event (kind, koma, duration). ⚠ These are the model's OWN signs on real pages, not gold — the check prices the fold, not the reading |
| **The 𝄋 → 𝄋 return: how often the sign is there, and how often it can be read** (2026-08-30) | Over the same **1,720** decoded pages: **742 carry at least one `\segno`**, and **258 carry two or more** — the shape that means *play that section again* (a saz semâî's teslim after every hâne, a şarkı's nakarat after the meyan). ⭐ **200 of them (11.6% of all pages) now take the return**; the other **58** carry no "Son" and no `:‖` after the first 𝄋, so nothing on the page says where the section ends and they are left alone. ⭐ **249 of the 258 carry no `\dc` at all** (only **58 pages** in the whole corpus do), so before this the second 𝄋 changed nothing on nearly every page that has one. ⚠ **433 pages carry a 𝄋 drawn at a bar's END** — those were being filed onto the PREVIOUS bar, which is where the jump would have fired. Effect on the corpus: **62,369 → 64,859 played bars (+2,490, +4.0%)**, and the written page is **31.4%** shorter than its performance instead of 28.7%. ⚠ These are the model's own signs on real pages, not gold — the count prices the rule, not the reading |
| **How long a first ending is** (2026-08-30) | Over the **1,128** `\volta1` marks that fall inside a repeat span on those pages: **62.1% sit on the `:‖` bar itself** (a one-bar ending), **26.7% one bar before it**, **94.1% within three**; **26 spans carry more than one** mark (the last wins). ⭐ This is what exposed a live defect: the second pass skipped only the bar CARRYING the "1.", so **37.9% of first endings** replayed their tail before jumping to the "2.". Fixed by skipping the ending whole; at full scale **62,733 → 62,369 played bars (−364)**. ⚠ `MAX_FIRST_ENDING = 4` bars: a "1." farther from its `:‖` is treated as a stray token and ignored, because obeying one would DELETE real music from the second pass while ignoring one only replays a passage that was going to be played. ⭐ **AND THE "1." IS OFTEN NOT READ AT ALL** (2026-09-07): of the **1,208** `:‖` on those pages that carry a "2." on the next bar, **156 (12.9%) had no usable "1." inside the span** — 153 with no `\volta1` anywhere, 3 with one too far — so the whole span replayed and the first ending sounded AGAIN before the "2.". A second ending is only ever printed opposite a first one, so the `:‖` bar is now read as a one-bar ending on the "2." alone: **1,052 → 1,200 spans resolved**, **64,859 → 64,695 played bars (−164)**, `check:fold` still **0 pages changed**. ⚠ The remaining **8** are refused on purpose: 5 one-bar spans (the inference would erase the repeat, not shorten it) and the 3 far-"1." spans, which keep the ignore-and-warn rule rather than drawing a second bracket. ⭐ **A "1." PRINTED PAST THE `:‖` IS A "2."** (2026-09-07): a first ending lies inside the repeat by definition, so **58 more spans** were repaired — **29** where that bracket was the span's only volta ink (the ending was never skipped) and **29** where a correct "1." sits on the `:‖` bar and a SECOND "1." is drawn on the bar after it. ⚠ **0 of the 58 open a repeat and 0 already carried a "2."**, which is why the reading is safe. Together the two rules take first endings resolved **1,052 → 1,225** and played bars **64,859 → 64,672 (−187)**, `check:fold` still **0 pages changed**; what is left is **11** spans refused on purpose and **1** stray "1." on a bar that opens a repeat |
| **Decoded marks that reach the page** (2026-08-05) | Over the 1,704 decode caches: `\tup3` notes drawn at the wrong length with no bracket **1,287 → 0** (22.9% of `\tup3`-bearing pages affected → 0). Repeats: 1,262 pages carry `\repstart`/`\repend`, **1,165 (92.3%) unfold**, **97 (7.7%) have no effect** — an unmatched `\repstart`, left alone rather than guessed at |
| **Whole page in the app, after the deskew speedup** (2026-08-05) | **~25 s** on the same 7-staff page: slice **1.6 s** + decode **19.1 s** for 16 strips. The slicer over the parity sample went **36.6 → 1.3 s/page**, i.e. faster than the Python it copies (~1.9 s stage 1). Decode is now the bottleneck |
| **`qualifyingLineRows` row-sum stage** (2026-08-05) | **856 ms → 6.8 ms per call, 125.8× faster**, over 328 angle evaluations on 8 real pages, with **0 disagreements** against the morphology it replaces. ~34.8 s saved per 41-angle sweep |
| **Whole page in the app** (2026-08-05, MVP W7) | **~56 s** on one 7-staff page: slice **36.4 s** (of which ~35 s is the 41-rotation skew sweep) + decode **19.1 s** for 16 strips, on a 7-staff page. Model load ~3.4 s more on a cold session. Longest single main-thread block **2.35 s** — the sweep yields between rotations. The slicer's corpus-mean cost is in [METRICS-SLICER.md](METRICS-SLICER.md#slicer-port-parity--does-the-typescript-reproduce-the-python) |
| Page decode (Mac, int8) | ~353 ms/strip ≈ 7.4 s/page |
| Round-1 ship gate | parity 10/10 fp32 + 10/10 int8; browser gate **19/20** — one double-dot token (`a''2..`) trips an ORT-web int8 numerics wobble, model-independent, logged not blocking |
| Round-2 ship gate (2026-07-27, live) | parity 14/14 fp32 + 14/14 int8; browser gate **27/28** — canvas (product) path 14/14, one *reference*-path strip drops a `\tup3`; deterministic, logged not blocking. Round-1's double-dot failure did not reproduce |
| Round-3/4 browser gate (2026-09-28 → 2026-10-08) | `r3a` **22/28**, `r4-ctl` **24/28** on the July golds; after the one `\tie` gold was rewritten tie-free (2026-10-08), `r4-ctl` (live) reads **26/28** — the pin since then. Detail: [METRICS.md](#metrics--the-exported-runtime-onnx-export-int8-quantization-parity) |
| That gate miss, measured | the flipped token is a real near-tie: `\tup3` **p=0.689** vs `e` **p=0.306** under Python-ORT int8 — the only token in the strip below 0.99 (next lowest 0.938). ORT-web wasm int8 tips it; the graph and the JS preprocessing are both exonerated |
| Training strip geometry | H=336 px, staff spacing 30 px, top line y≈138; label cap 59 ids (the real pools' emitter gate is **80 H ids** since 2026-09-07 — [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md)) |
| Slicer staff-detection kernel | `STAFF_HOR_FRAC = 0.11` of page width (was `w/4`) |
| Slicer, a screenshot's dark viewer frame (2026-11-15) | painted white before binarization; what it fixes and the pages it does not touch are in [METRICS-SLICER.md](METRICS-SLICER.md) |

**Merged into this file on 2026-11-20:**

- [Metrics — who actually uses the deployed app](#metrics--who-actually-uses-the-deployed-app) — was `docs/METRICS.md`
- [Hand-test pages — the page-level instrument](#hand-test-pages--the-page-level-instrument) — was `docs/METRICS.md`
- [Metrics — the exported runtime (ONNX export, int8 quantization, parity)](#metrics--the-exported-runtime-onnx-export-int8-quantization-parity) — was `docs/METRICS.md`
- [Metrics — the B8 re-emit and the human fixes it did not carry](#metrics--the-b8-re-emit-and-the-human-fixes-it-did-not-carry) — was `docs/METRICS.md`


## Metrics — who actually uses the deployed app

*Was `docs/METRICS.md` (last updated 2026-10-08).*

Split out of [METRICS.md](METRICS.md) on 2026-08-09, by genre: that file measures how the system
*performs*, this one measures who *arrives*. Service performance (cold starts, cost, decode speed)
stays there. Current state → [STATUS.md](STATUS.md).

⭐ **EVERY NUMBER BELOW WAS READ OFF A REQUEST LOG, AND SINCE 2026-09-05 THERE IS A REAL COUNTER**
(owner). The table on this page is the historical record of what could be inferred without one; new
readings come from the site's own anonymous counter and its dashboard
([features/README.md](features/README.md#f6--the-visit-counter-and-the-owners-private-dashboard)), which separates robots from people and counts
DEVICES rather than requests. ⚠ **The two are not comparable**: the log below counts everything that
touched Cloud Run, the counter counts browsers that ran the app and skips its own test runs. Do not
continue this table from the dashboard — start a dated section under it.

**Where the data below comes from, and why it exists at all.** Nothing was instrumented for analytics
at the time — the project had no tracker, and DECISIONS.md kept it that way until the row of
2026-09-05 reversed it. But the app pings `/health` when it opens (the cold-start fix), so Cloud
Run's ordinary request log became a visit counter as a side effect. Read it with the two limits below
firmly in mind.

⚠ **A request log can tell you how many DEVICES, never how many PEOPLE, and never who.** Every
sharpening of the numbers below came from the owner supplying what the log could not — that nobody
in this circle runs Linux, and that one of the phones was the owner's. Expect to have to ask.

⚠ **`/health` counts openings, `/decode` counts uses.** Only the second means a human read a page.
Robots do the first constantly.

### The live service, 7 days to 2026-08-09

| Measure | Value |
|---|---|
| **Who has actually used the deployed app** (2026-08-09, 7 days of request log) | The app pings `/health` on open, so Cloud Run's log doubles as a visit counter. Three page reads on 2026-08-08, **all from ANDROID PHONES** — but ⚠ **one of them is the OWNER'S own phone** (`144.122.137.254`, 11:35, Chrome/150, also back at 13:14 and 16:38 — owner-confirmed 2026-08-09, after an earlier version of this row miscounted all three as visitors). **That leaves two non-owner page reads:** `88.240.41.208` at 14:18 (Türk Telekom home ADSL, 2.2 MB) and `144.122.151.233` at 20:32 (2.5 MB, desktop-site mode). Everything else from outside is **`/health` with no `/decode`**, and the whois says why: **AWS** (`100.31.187.16`, the post-deploy crawler), **Ace Data Centers** (`23.27.145.210`), a **ProtonVPN** exit in Iceland (`185.159.158.61`), plus scattered foreign ISPs whose device stories do not hold — one iPhone UA from **four unrelated IPs** in two days. ⚠ `/health` is an upper bound on humans; `/decode` is the real count |
| **⚠ Those two remaining reads are ONE OR TWO people — the log cannot say which** | Both ran **Chrome/151** on Android, six hours apart, from two different networks (home ADSL, then the owner's `144.122.x`). A phone moving between them in six hours is unremarkable, and so is two people. **No further evidence exists**: Cloud Run logs no cookie, no session id and no client hints, and the two page sizes prove only that different sheets were read. So the standing count is **≥1 stranger, ≤2**. Resolving it properly means either asking them (W10) or storing a client id — ⭐ **and that is what 2026-09-05 decided to do**, in the one form that answers the question without becoming tracking: an id that expires every night, so it separates two devices today and links nothing tomorrow ([features/README.md](features/README.md#f6--the-visit-counter-and-the-owners-private-dashboard)) |
| **A distinct-device proof that DOES hold** | The owner's phone ran **Chrome/150** at 13:14 and 16:38 while the 14:18 upload came from **Chrome/151**. Browsers never downgrade, so those are certainly two devices — which is how "at least one real stranger" is known rather than assumed. Chrome build number is the only device discriminator this log offers, since the Android UA is frozen to `Android 10; K` |
| **⚠ An `X11; Linux x86_64` UA here does NOT mean a Linux machine** | It is what Chrome for Android sends under **"Request desktop site"**, and mistaking it cost one wrong entry in this file. `144.122.151.233` is the proof, all one IP and one Chrome build: `/health` on the **Android mobile** UA at 20:29:57 → `/health` on the **X11 Linux** UA at 20:30:57 → upload at 20:32. One person, one phone, one minute. Owner-confirmed context: nobody in this circle runs Linux |
| **⚠ Real visitors are arriving on PHONES, against a "web first, mobile later" plan** | All three humans were on Android, and one switched to desktop mode within 60 s of opening — then uploaded. That is a small n, and the switch has no stated reason, so it is a **signal to ask W10's friends about, not a finding**: it is equally consistent with a cramped mobile layout or with habit. ⚠ The plan it was in tension with changed on 2026-09-19: the phone is now the main screen ([features/phone.md](features/phone.md)) |


## Hand-test pages — the page-level instrument

*Was `docs/METRICS.md` (last updated 2026-09-06).*

> Current state and next action are NOT here — see [STATUS.md](STATUS.md). The plan this serves is
> [rung3/round4.md](rung3/round4.md); the reason it exists is [BACKLOG.md](BACKLOG.md) item 6.

### What it is

**20 pages the owner supplied on 2026-09-06**, outside the frozen exam, decoded once and loaded into
`review_ui.py` as queue **`handtest`**. It is the page-level instrument this project has never had:
the exam scores strips and drops 41% of its candidates, real-val is 262 strips with a CI half-width
that hides any gain under ~5%, and the owner's judgement of the app has so far been on whatever page
happened to be open. Here every model reads **the same pages** and the number is **corrections per
page** — the unit a user actually experiences.

⚠ **The pictures are not in the repo.** `exam_pages/` is gitignored (2026-09-06): they are someone
else's engraving and this repo is public. The crops and decodes live under
`data/real/rung3/_handtest/`, also gitignored.

### What the verdicts mean

Different from every other queue — this is a correction count, not a label pass:

| verdict | meaning |
|---|---|
| `ok` | the model read this strip correctly — costs the user nothing |
| `fix` | the model got it wrong — type what the page actually says |
| `bad` | the crop is unusable — the slicer's fault, not the model's |

**Corrections per page = the rows that are not `ok`.**

⛔ **It is not gold and it is not the exam.** `label` is empty on every row, the client clears
`corrected_label` on `ok`, and the filename is neither `emit_review.csv` nor `full_audit.csv` — the
only two `promote_labels.py` reads. Those are the same two guarantees `r3-exam-errors` carries, and
they matter more here: the `decoded` column comes from `r3a-stage2-best-real`, the model serving the
live site, so promoting it would be the circularity [../CLAUDE.md](../CLAUDE.md) forbids.

### The first decode (2026-09-06, `r3a-stage2-best-real` int8)

The shipped runtime, `OMR_ORT_THREADS=2`, on the laptop.

| | |
|---|---|
| pages decoded | **20 of 20**, no failures |
| staff rows found | 182 |
| strips | **515** |
| wall clock | 211 s — **~10.5 s a page** |
| `hit_cap` (decode stopped at the length cap) | **0** |

#### Structural tells — 62 of 515 rows

Computed without gold, so they say *where to look*, never *what is wrong*. Every row-start strip of
one page should read the **same** key signature; where they disagree at least one is misread, and a
`\sig` block in a mid-row crop is invented outright because that crop cannot see a signature.

| tell | rows |
|---|---|
| `sig-differs` — a row disagrees with its page's majority signature | **18** |
| `low-confidence` — min token log-prob < −1 | 18 |
| `near-empty` — 3 tokens or fewer | 15 |
| `midrow-sig` — a mid-row crop emitted a `\sig` block | 7 |
| `sig-unclosed` — opened a `\sig` that never closes | 4 |

⭐ **6 of the 20 pages have rows that disagree with each other about the key signature.** The worst
is a faded archive scan: **6 different signatures across its 9 rows**, plus 13 low-confidence strips.
That the signature is the largest error class is Round 4's root cause #2
([rung3/round4.md](rung3/round4.md)); this is that finding arriving from a third direction, on pages
from a source the corpus does not contain.

### What may NOT be claimed from this

- ⛔ **No accuracy number.** Nothing here has been read by a person yet, so there is no
  corrections-per-page figure for any model — only the decode and the tells above.
- ⛔ **Not comparable to `examv3`.** Different pages, different sources, no gold, and the exam's own
  numbers come from a strip-level scorer over a filtered candidate set.
- ⚠ **A verdict is given against pixels.** If the slicer changes, the crops move and the verdicts do
  not transfer; re-running `build_handtest_queue.py` carries them by strip name, which is only valid
  while the crops are the same. Bump nothing and re-read if `GEOMETRY_REV` moves.
- ⚠ **The set is not checked against the exam.** Three of the 20 titles were matched against
  `testset.json` and none is an exam piece; **17 are unchecked**. It matters only if these pages ever
  become training data — as a read-only hand test they are safe either way.
- ⚠ **n = 20 pages.** A difference of one or two corrections per page between two models is not a
  result at this size.


## Metrics — the exported runtime (ONNX export, int8 quantization, parity)

*Was `docs/METRICS.md` (last updated 2026-10-08).*

Split out of [METRICS.md](METRICS.md) on 2026-09-01 when that file crossed the 400-line cap. Genre:
METRICS.md holds model quality; this holds the artifact that gets served.

⚠ **No accuracy number anywhere in this project is measured on int8.** Every exam, real-val and
taxonomy figure comes from the PyTorch checkpoint. The app serves int8. That gap is what this file
sizes.

### Export (`optimum-cli export onnx --task image-to-text-with-past`)

| checkpoint | date | optimum float validation |
|---|---|---|
| `r3-final-stage2-last` | 2026-09-01 | max diff 5e-5 – 3.3e-4 (encoder 3.3e-4, logits 6.9e-5) |

The tolerance warning at 1e-5 is expected and has fired on every export this project has done; parity
in **id space** is the check that matters, below.

### int8 quantization (`quantize_onnx.py`, `quantize_dynamic`, QInt8 weights)

| graph | fp32 | int8 |
|---|---|---|
| encoder | 311 MB | **91 MB** |
| decoder | 276 MB | **69 MB** |
| decoder-with-past | 242 MB | **61 MB** |
| **total shipped** | ~830 MB | **221 MB** |

### Parity: int8 vs PyTorch, in id space

Found while exporting Round 3, by noticing that `onnx_parity.py` pointed at a real pool selects
**zero** strips and prints `0/0 PASS` — it filters to `GATE_STRIPS.txt`, which is 14 SYNTHETIC
strips. That vacuous pass is worth knowing about on its own.

Same reference decoder (`onnx_parity.onnx_greedy_decode`), 60 `_realval_v2` strips spread across the
pool, int8 graphs vs the PyTorch checkpoint, identical token ids required:

| checkpoint | 14 gate strips (synthetic) | **60 real strips** |
|---|---|---|
| `round2-stage2-best` — the live runtime on 2026-09-01 | — | **54/60 = 90.0%** |
| `r3-final-stage2-last` | **14/14 = 100%** | **52/60 = 86.7%** |

⭐ **This is ambient int8 behaviour, not a Round-3 defect**: both models diverge, 6 vs 8 strips of 60
is within noise at that n, and the divergences land on **largely the same strips** in both
(`yegah_pesrev…p2_s01_w03`, `canan_okuyor…p1_s03_w01`, `beni_cun_kendine…s01_w01`,
`cok_surmedi…p2_s00`) — a property of hard, near-boundary strips rather than of either export.
⚠ **But it has never been visible**, because the documented gate is 14 synthetic strips where int8 is
exact. The shipped app has always decoded real pages with a model that can disagree with its own
fp32 weights on ~1 strip in 10, and some disagreements are large (24 and 20 ids on ~50-token strips).
⚠ **Consequence for any hand-test or hands-on impression**: the app runs int8, and no
accuracy number in this file was measured on int8 — they all come from the PyTorch checkpoints.


### The browser gate is STALE for any tie-free model (2026-09-01)

`npm run gate:browser` expects **27/28**. `r3-final-stage2-last` reads **24/28**, and the four failed
checks are three different things:

| # | strip | cause |
|---|---|---|
| 2 | `rast…icime_hep` | ⭐ **the gold still contains `\tie`**, retired 2026-08-22. The model emits `a'1 a'4`, which under the retirement rule IS the correct label. **The fixture is wrong, not the model** |
| 1 | `kurdilihicazkar…bunca_cevrinle` (reference) | **pre-existing** — `round2-stage2-best` produces byte-identical output here; this is the known 1/28 |
| 1 | the same strip (canvas) | ⚠ **genuinely new** — Round 3 drops `\tup3` where Round 2 kept it, by one token (56 vs 57) |

⛔ **So the 27/28 gate cannot pass any post-`\tie` model**, and would have blocked whoever shipped
next regardless of Round 3. Regenerating that one gold tie-free would read **Round 3 26/28** and
**Round 2 25/28** — the honest ordering, since Round 2 is now the stale model. ⚠ Not done: changing a
shipped check's expected value is an owner call.

#### The two models measured on the SAME golds (2026-09-28)

Run while staging Round 4's control for the live site — both read through `npm run gate:browser`,
the July `gate.json` golds untouched in between, so the two numbers are comparable:

| model | checks | failing strips |
|---|---|---|
| `r3a-stage2-best-real` — the model that WAS live | **22/28** | `rast…icime_hep` (the `\tie` gold), `kurdilihicazkar…bunca_cevrinle`, `hicaz…yalan_degil` |
| `r4-ctl-stage2-last` — deployed 2026-09-28 | **24/28** | `rast…icime_hep` (the `\tie` gold), `kurdilihicazkar…bunca_cevrinle` |

- ⭐ **Round 4's control is two checks BETTER than the model it replaced**, on the gate the project
  already had. That is not an accuracy finding — 14 synthetic strips decide it — but it is the one
  check that was run on both and it does not contradict the deploy.
- ⛔ **Neither reaches the documented 27/28, and `r3a` has been failing it since it was staged on
  2026-09-03.** Nobody ran the gate at that staging. The expectation was stale for the reason this
  section already gives — ✅ **settled 2026-10-08, below.**
- `r4-ctl`'s surviving new failure is the same `\tup3` drop the row above records: gold
  `\tup3 e''16 d''16 e''16 \tupend`, decode `e''16 d''16 e''16 \tupend` — an unbalanced tuplet, the
  class the owner accepted on 2026-09-03 because the stitcher brackets an unclosed run.
- ⚠ **A staging trap, paid for once:** `make_browser_gate.py` REWRITES `gate.json` — golds included —
  when it is given a different `--strips-dir`. Staging a new model must copy the three graphs and
  leave `gate.json` alone, or the gate stops being comparable with every earlier reading.

⚠ A second apparent difference on that strip, `d''32` rendered as `d'' 32`, is **not** a difference:
the two forms tokenize to identical ids `[17, 1, 37, 95, 35]`. `d''16` vs `d'' 16` genuinely differs,
which is why `promote_labels.norm_label`'s rule is **32 only**.

#### ✅ The `\tie` gold is fixed and the gate is pinned at 26/28 (owner, 2026-10-08)

The one gold carrying the retired `\tie` (`rast…icime_hep`) was rewritten by the retirement rule —
`a'1 \tie a'4` → `a'1 a'4`, same pitches, same total length — and re-tokenized with the live model's
tokenizer (`r4-ctl-stage2-last`); the other 13 golds were re-tokenized as a control and came back
**byte-identical**, so nothing else moved. Graphs in `apps/web/public/models/` hash-matched
`r4-ctl-stage2-last-onnx/*_int8.onnx` before the run.

| model | checks | failing strips |
|---|---|---|
| `r4-ctl-stage2-last` (live) | **26/28** | `kurdilihicazkar…bunca_cevrinle`, both paths — the `\tup3` drop above |

`npm run gate:browser` now pins **`--expect 26/28`**. ⚠ **`gate.json` is gitignored** (it lives in
`apps/web/public/models/`, staged by `make_browser_gate.py` from the synthetic strip labels), so the
fix exists on this Mac only. Re-staging with `make_browser_gate.py` regenerates golds from the
synthetic labels and would bring the `\tie` back if those labels still carry it — re-apply the same
one-line edit, or the gate reads 24/28 again for a fixture reason.


## Metrics — the B8 re-emit and the human fixes it did not carry

*Was `docs/METRICS.md` (last updated 2026-08-31).*

> Split out of [METRICS-CORPUS.md](METRICS-CORPUS.md) on 2026-08-31 at the 400-line cap, by phase:
> that file holds the standing corpus census, this one holds the re-emit. Current state and next
> action are NOT here: see [STATUS.md](STATUS.md). Queues: [rung3/labeling.md](rung3/labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3).

### The re-emit: what it yielded, and what it does NOT carry (2026-08-21)

`emit_strip_labels.py` over the **1,293 non-exam matched pieces**, `--strips-root
data/real/strips_v2`, `round2-stage2-best` doing both emitter jobs, into `data/real/rung3/strips_b8`.
**37 minutes** on the M4 at `OMR_ORT_THREADS=2 nice -19`: 1,704 page decodes were reused from the
2026-07-29 re-slice (same checkpoint, same `window_cache_ok` signature) and only **16 pages** were
decoded fresh, so the GPU half of the job had already been paid for.

| | |
|---|---|
| pieces | 912 ok / 324 low_coverage / 57 missing_pages |
| rows | 3,440 ok + 950 `recovered_dc` + 3,616 `recovered_dn`, **3,984 unaligned (33%)** |
| strips | **accepted 3,955** · review 4,738 · dropped 24,837 · audit sample 201 |
| drops | **split_wide 10,226** · row_unaligned 7,446 · **over_budget 4,012** · nd_high 3,053 · empty_range 43 |

**Yield: 3,955 against the old pools' 2,330 (+70%)**, which is the referee argument paying out —
the weak referees dropped 10,695 strips on row alignment alone. ⭐ **Width and budget now dominate**:
`split_wide` + `over_budget` = **14,238 strips**, nearly twice what alignment loses, so the 59-id
budget measurement ([BACKLOG.md](BACKLOG.md) item 7) is now the biggest single lever on real training
volume, not a tidiness item.

#### ⚠ The 1,442 human corrections do not come back by themselves

Matching old rows to new by **measure span** (`page`, `from`, `to`), which is the only sound key:

| old row | n | where it landed now |
|---|---|---|
| never touched by a human | 844 | 704 on the same measures — and **687 (98%) got an identical label** |
| **human `fix`** | **1,442** | 445 same measures · 506 → `b8-review` · 248 same FILENAME only · 223 dropped · 20 not produced |
| human `ok` | 44 | 16 same filename only · 10 review · 10 not produced · 8 dropped |

⭐ **The 98% row is what makes the rest readable.** On rows no one edited, the emitter reproduces its
own July output almost exactly, so it has not drifted. Which means the disagreement on the corrected
rows — of the 445 human fixes that land on the same measures, the fresh machine label matches the
human on only **41** — is most likely the machine repeating the error the person fixed. ⚠ **That is an
inference, not a measurement**: the pre-correction labels were overwritten at promote time, so the two
cannot be diffed directly. The observed differences are the known tie/rest conventions
(`g''4. g''4` vs `g''2 \tie g''8`; `e''4 r8` vs `e''4.`).

#### ⭐ Carried, measured, and largely redundant — the 2026-08-31 read

`scripts/rung3/carry_old_fixes.py` located every retired-pool correction again and marked it in the
b8 queues. The key is the measure span **the slicer itself recorded** —
`(page, system, meas_from, meas_to)` out of each crop root's `<page>_manifest.json` — never the
filename. ⚠ Those indices are ROW-LOCAL, so `system` is part of the key and a page whose two slicers
disagree on staff-row count is **refused, not guessed** (654 of 1,779 shared pages).

⚠ **The key was validated before it was trusted**, against the one place a real SymbTr span exists on
both sides: where it says SAME, the SymbTr span agrees on **1,002 of 1,026 (97.7%)**; where it says
DIFFERENT, **35 of 36** really are different.

| old human fix (n = **1,479** distinct) | span-matched | filename only |
|---|---|---|
| lands in `b8-full` (already accepted) | 588 | 103 |
| lands in `b8-review` | 460 | 64 |
| lands on a strip the emitter DROPPED | 113 | — |
| not produced at all | — | 151 |

⭐ **The owner had already redone most of it by hand.** Of the **198** span-matched fixes that
disagree with b8's own label inside `b8-full`: **122 the owner had fixed identically**, 18 differently, 22 the
owner read as `ok`, 33 were still machine drafts, 3 bad. So two independent human reads of the same music,
on different crops months apart, agree **122 of 140 = 87%** — the strongest quality signal either
label set has. ⛔ **A span match is the same BARS, never the same pixels**: of the 1,215 crops
carrying a hint, **0 are byte-identical** and **77.7% changed size** (median +9 px wide; height
unchanged on every one). That is why the hint is a suggestion with its own accept button and plain
`ok` never stores it.

⏭ **`b8-review`'s 450 promotable old fixes are deferred to Round 4** (owner, 2026-08-31): +11% volume
on a pool that had already grown +70%, spread over 206 pages of which 43 are new. ⚠ 197 of the 460
carry a `\sig` block, which is unverified by standing rule.

⚠ **Carry by measure span, NEVER by filename.** 248 of the 1,442 fixes match a new strip's *name*
while covering different music — the standing re-slice trap, and here it is quantified.
**951 of 1,442 (66%) are recoverable now** (445 accepted + 506 in review); the remaining 243 need the
width/budget rails to move.

⚠ **`\sig` blocks in this pool are unverified like every other real-page pool** — 1,622 of them, voted
by a model rather than derived ([below](#the-key-signature-is-decided-by-the-model-not-by-symbtr-found-2026-08-21)). The voter here is
`round2-stage2-best` rather than the weak labeler, which should help and has not been measured.
