# Diagnostics — measured investigations into specific defects

purpose: the single home for "why does it fail, and what did we test" — the probe results, including the ones that came back negative
audience: agents and the owner, before proposing a fix for a known weakness
updated: 2026-07-29

Split out of [METRICS.md](METRICS.md) on 2026-07-28 when that file crossed the 400-line cap. The
split is by genre: METRICS.md keeps the **scoreboard** (what the model scores, against which floors);
this file keeps the **investigations** behind those scores. Nothing is duplicated.

**Read the negative results.** Most of what follows is a hypothesis that was tested and did not
survive — each one is a change that was not built on a guess, and re-proposing it costs a round.

### ⛔ A ~2% pre-shrink: exam −15.5%, real-val −1.6%. DID NOT REPLICATE (2026-07-28)

Per-strip staff-line spacing, measured on the strips as they reach the model. The slicer targets
`TARGET_SPACING = 30.0` px; the renderer produces exactly that.

| pool | mean px | sd | p10 | p90 | vs synthetic |
|---|---|---|---|---|---|
| synthetic `strips_v4` | **30.000** | **0.000** | 30.000 | 30.000 | — |
| real exam | **30.496** | 2.096 | 29.50 | 31.75 | **+1.65%** |
| real-val | 30.197 | 1.032 | 29.75 | 30.50 | +0.66% |
| real nota | 30.122 | 0.701 | 29.50 | 30.75 | +0.41% |

Correcting the size at inference (`scripts/rung3/staff_geometry_probe.py`, frozen
`round2-stage2-best` on the frozen 326-strip exam; rung 0 reproduces the 562-edit total exactly):

| scale applied | exam edits | vs baseline |
|---|---|---|
| identity | 562 | — |
| 0.990 | 486 | −13.5% |
| **0.980** | **475** | **−15.5%** |
| 0.975 | 494 | −12.1% |
| 0.960 | 541 | −3.7% |

- **Not monotonic** — it rises at both ends, ruling out "smaller is always better". The 1–2.5% basin
  is flat, so the exact optimum is **not resolvable at n=326**; the evidence is four independent
  scale values all landing 12–15.5% better.
- Vertical placement is **not** the cause: shift +1% gave +0.4% edits. Only scale mattered.
- Resampling is **not** the cause: an identity warp through the same interpolation gave 562 exactly.
- ⛔ **It does not generalise.** The same operation on the **real-val holdout** gives 247 → 243
  edits, **−1.6%**. The exam result came after ~15 variations were tried against the exam and the
  best was reported — selection on the test set. **Do not act on this.**
- ✅ **CLOSED 2026-07-31 — the last defence is dead, and the sign flips.** The open caveat was that
  real-val was the easy pool with no hard tier, so an effect confined to hard pages could hide
  there. Re-run on `_realval_v2` (267 strips, 41% hard, SER 0.079 — *harder* per token than the
  exam), same frozen `round2-stage2-best`, `staff_geometry_probe.py --strips-dir … --ladder
  fine_scale`:

  | rung | edits | vs identity warp |
  |---|---|---|
  | identity warp | 746 | — |
  | scale 1% | 766 | **+2.7%** |
  | scale 1.5% | 766 | **+2.7%** |
  | scale 2.5% | 785 | **+5.2%** |
  | scale 4% | 779 | **+4.4%** |

  **Every scale is WORSE**, where the exam had −13.5% to −15.5% at the same values. The effect is
  not merely absent off the exam — it reverses. Four independent scale values agreeing on the sign
  is the same standard of evidence the original claim rested on, now pointing the other way. The
  exam result was selection on the test set and nothing more. **Do not re-propose a pre-shrink.**
- ⚠ No mechanism was ever found. Ruled out: resampling (down-up 555), blur (562), ink lighten (565),
  ink thin (589), and staff-size matching — the exam benefit appears in **every** size bucket
  (undersized −33%, ~right −10%, oversized −16%), not just oversized strips.
- ⚠ **The staff-size explanation is DISPROVED.** Rescaling each strip individually to exactly
  30.000 px gives only **528 edits (−6.0%)** — less than half the blunt global shrink. If the model
  simply wanted the training spacing, exact per-strip matching would have won. It did not.
- ⚠ The estimator hypothesis is also disproved: `Staff.spacing` (median of gaps) vs the endpoint
  span that actually sets the crop height measures **span/median = 0.998** over 357 staves,
  predicting 29.95 px — not the 30.5 observed (`scripts/rung3/spacing_estimator_probe.py`).
- Current slicer output spacing is **30.353** against the old code's 30.494, so the bias narrowed
  but persists. Synthetic is exactly 30.000 (sd 0.000).
- **Do not act on this until the mechanism is known.** Untested candidates: ink weight, stroke
  thinning under INTER_AREA, encoder preprocessing.

### Decode confidence predicts correctness, and the review confirms it (2026-07-28)

`round2-stage2-best` re-decoding the exam's 145 hand-labelled HARD strips, bucketed by the decode's
minimum per-token log-probability — then the same buckets as the owner labels the `realval-hard`
queue (69 of 130 done at time of writing):

| min_logprob | exam hard: decode exactly right | realval-hard `ok` | realval-hard **`bad` crop** |
|---|---|---|---|
| > −0.1 | **80%** (51 strips) | 83% (53) | **6%** |
| −0.5 … −0.1 | 28% (40) | 50% (30) | 27% |
| −1.0 … −0.5 | 10% (31) | 21% (29) | **55%** |
| < −1.0 | **4%** (23) | 0% (18) | **89%** |
| all | 39% (145) | 50% (130) | **33%** |

Owner-labelled, all 130 rows: **65 ok / 22 fix / 43 bad**.

- Real signal, and the two measurements agree in the top bucket; used to order the labelling queue.
  ⚠ It orders the work, it does **not** license skipping rows — the top bucket is still wrong 1 in 5.
  ⚠ `ok` is looser than "exactly right", so the middle buckets are not directly comparable.
- **Low confidence strongly predicts a BAD CROP** — 16 of the 18 strips below −1.0 were rejected
  crops (89%), and the bad rate falls monotonically with confidence. ⚠ **Corrects an earlier claim
  in this file** that "confidence cannot detect a bad crop", which was drawn from the first 7 `bad`
  verdicts; the full 130 contradict it. High confidence still does not *guarantee* a good crop
  (6% of the top bucket were bad), so it is a screen, not a proof.
- **33% of the old slicer's hard strips are unusable crops** (43 of 130) — the slicer's failure rate
  on the material it had already flagged as doubtful. Only 87 were usable against 110 needed, so a
  re-slice was required regardless.
- First measured evidence the confidence signal carries information, bearing on the deferred
  error-localisation feature (pre-registered at TOKEN level; this is per strip).

> **Slicer behaviour lives in [METRICS-SLICER.md](METRICS-SLICER.md)** — the windowing
> retune, the cap bugs, the shared-edge trim and the vertical placement of the staff.

### Crop shape and beam weight (2026-07-28) — costs confirmed, both mechanisms disproved

Whole-exam decode, 326 strips, 562 edits. Per-bucket detail in
[rung3/round3.md](rung3/round3.md); source `scripts/rung3/empty_crop_probe.py`,
`width_split_probe.py`, `beam_weight_probe.py`.

| finding | number |
|---|---|
| crops with ≤3 notes | **5.5% of strips, 20.8% of all edits** (0.5–1.06 edits/gold token vs 0.03–0.05) |
| crops >1200 px | 13.8% of strips, **28.6% of edits** (0.082/token) |
| note-free crops that invented notes | **1 of 8** — bar was ≥50%, so **not hallucination** |
| splitting wide crops at a gutter | **132 → 174 edits, +31.8%** (19 of 45 have no internal bar-line) |
| slicer old → current, same 67 pages | <350 px **3.4% → 1.4%**; >1200 px **13.8% → 27.8%** |
| beam thickness, median | synthetic **0.500 S** (v4 = v5); real nota 0.567 S, exam 0.765 S |

- The 22%-too-thick sharp-bar finding **does not transfer** to beams — ours match the engraving
  standard and real print is *heavier*. ⚠ Thick tails are contaminated (synthetic = double beams,
  real = ink bleed); only the median is usable. ⚠ Measures **thickness**, not **grouping**, so it
  cannot validate `USUL_BEAM_GROUPS`.
- Post-encoder the model sees synthetic beams at **6.5 px** and real at **9–14.6 px** — a *width*
  effect, since our strips average 1229 px against real 904–1018 and shrink harder through the
  encoder's fixed box.


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
