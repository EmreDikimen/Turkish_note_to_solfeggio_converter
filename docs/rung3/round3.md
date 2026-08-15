# Round 3 — the notes themselves: where they sit and how long they are

purpose: what Round 3 targets, the evidence behind it, and the checks to run BEFORE rendering anything
audience: agents and the owner working the real-page track
updated: 2026-08-16

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md).
> Decisions: [../DECISIONS.md](../DECISIONS.md).
>
> ▶ **UNPAUSED 2026-08-05 (owner): this round runs in PARALLEL with the product work** and no longer
> waits for the friends release. The release asks friends about the interface, so its feedback would
> not aim this round either way. [../DECISIONS.md](../DECISIONS.md)
>
> ✅ **This round's acceptance bar is WRITTEN AND SIGNED (2026-08-15) and lives in
> [round3-criteria.md](round3-criteria.md)** — floors beside their Round-2 baselines, with **≥75% of
> exam pages needing ≤5 corrections** as the primary number and the public-launch gate. It was fixed
> before any Round-3 training and is not re-opened after the read. Do not restate the numbers here.

> ✅ **A FIFTH check was added 2026-08-15, after the four below had all come back negative — and it
> is the one that came back POSITIVE.** It is not about what we draw, but about how much of the strip
> the encoder is given. Result in §5 below; the lever and its next step live with the other levers in
> [levers.md](levers.md). Read that before rendering anything, including the content change described
> here — **the next render is a geometry render, and the content work is sequenced behind it.**

## What this round is for

**Not the microtonal marks. The note heights and the note lengths.**

We counted every correction a user would have to make on the Round-2 exam and sorted them by what
actually needs fixing:

| what the user fixes | share |
|---|---|
| **which line or space the note sits on** | **40%** |
| **how long the note is** | **28%** |
| tie / triplet / grace marks | 13% |
| the microtonal marks (koma, küçük, bakiye…) | 13% |
| bar-lines, repeats, navigation | 5% |

Two whole rounds went into that 13%. Not because it was the biggest problem — because the old score
**only measured that**. It could not see the other 87%. Full table in
[../METRICS.md](../METRICS.md).

## The checks were RUN (2026-07-28). Most of them said no.

All four were run against the shipped `round2-stage2-best`, no training, no re-render. The headline:
**three of the four ideas below are dead, and the one real win was not on the list.** Details per
check are kept in place below, each under its own verdict line, because the negative results are the
point — each one is a change we did not build on a guess.

The harness is trustworthy: decoding all 326 exam strips reproduces the known **562-edit** total
exactly ([../METRICS.md](../METRICS.md)).

| check | verdict |
|---|---|
| 1. staff geometry → note heights | **claim not supported**; the apparent win it uncovered failed to replicate — see §1 |
| 2. beam/flag weight → note lengths | **disproved.** Ours are at the engraving standard; real print is *heavier* |
| 3. render the odd crop shapes | **dropped.** The cost is real, the stated mechanism is wrong |
| 4. how crowded are the strips | **already answered** by `domain_gap.py` before this session |
| **5. how much of the strip does the encoder SEE** (added 2026-08-15) | ✅ **CAUSAL — the first check here that came back positive**, and the first that is not about what we draw. See §5 |

**⛔ The apparent win did not survive a holdout.** Shrinking real strips ~2% removed **15.5% of exam
corrections** (562 → 475) across four scale values, with no mechanism ever found — resampling, blur,
ink weight and staff-size matching were each tested and ruled out. On the **real-val holdout it is
−1.6%** (247 → 243). It is exam-specific. The cause of the mistake is worth more than the result:
~15 variations were run against the frozen exam and the best was written up before any holdout was
tried. ⚠ Not fully closed — real-val is the easy pool and lacks the hard tier, so re-test after the
rebuild. **Do not act on it.** See [../DECISIONS.md](../DECISIONS.md).

**Three separate diagnoses about `page_to_strips.py` were measured and disproved this session**, and
two patches written on the first two were reverted (one was dead code, one was contradicted by the
slicer's own manifests). Lesson recorded in [../DECISIONS.md](../DECISIONS.md): measure before
touching that file.

## The four checks, as originally written (with what each returned)

None of these needed training. Three of the last three "the model is bad at X" findings turned out to
be something we never drew properly, so **measure first**.

### 1. Are the staff lines in the right place? (aimed at the 40%)

When the model gets a note height wrong, it is usually off by just **one or two positions** up or
down — 74% of the time. It is not confused about which note it is looking at; it is slightly
misjudging the height, like reading a thermometer one mark off.

Rough measurement so far (crude line detector, treat as a lead, not a fact):

| | line spacing | vertical placement |
|---|---|---|
| synthetic `strips_v4` | 30.6 ± 2.7 px | ± 17 px |
| real exam strips | 31.8 ± 4.9 px | ± 28 px |
| real nota pool | 31.9 ± 5.6 px | ± 29 px |

The averages match well — the slicer's scale normalisation works. But **real pictures vary about
twice as much**. And one note position is only about **15 px**, so drift of that size is exactly
what produces one-position errors.

Now compare that against what we teach the model to expect. `src/vision/augment.py` shakes each
training picture, but only this much:

```python
A.Affine(rotate=(-2, 2), shear=(-2, 2), scale=(0.97, 1.03), translate_percent=(0, 0.01))
```

Up to **3% bigger or smaller**, and about **3 px** up or down on a 336 px strip. Real strips vary
around 15% in line spacing. **We are shaking the pictures roughly five times less than reality
moves.**

### ⚠ §1 RESULT (2026-07-28) — the variance story is not supported, and neither is the size story

Measured with `scripts/rung3/staff_geometry_probe.py`: perturb exam strips along the same axis the
augmenter jitters, decode, and watch the error respond. A brittleness effect climbs with dose. This
one did the opposite — perturbing made the model **better**, and doubling the perturbation changed
nothing:

| scale applied to exam strips | exam edits |
|---|---|
| identity (no change) | 562 |
| 0.990 | 486 |
| **0.980** | **475 (−15.5%)** |
| 0.975 | 494 |
| 0.960 | 541 |

The curve is **not monotonic** — it rises at both ends — so "smaller is always better" is ruled out
and a real optimum near 2% exists. The basin between 1% and 2.5% is flat, so the exact
optimum is not resolvable at n=326; the evidence is that four independent scale values all land
12–15.5% better while 4% falls back to −3.7%.

Two things round3.md merged, now separated, because only one of them costs us edits today:

- **Size BIAS is real but is NOT the mechanism.** Per-strip staff spacing: synthetic **30.000 px,
  sd 0.000**; exam **30.496**, real-val 30.197, nota 30.122 (current slicer 30.353). The slicer
  intends 30.0 and lands high — but **rescaling each strip individually to exactly 30.000 gives only
  −6.0%**, less than half the blunt global shrink. If the model wanted the training size, exact
  matching would have won. It did not. A further hypothesis (that `Staff.spacing`'s median-of-gaps
  disagrees with the endpoint span setting the crop height) measured **0.998** where 1.016 was
  needed. **The cause of the −15.5% is unknown.** Numbers in [../METRICS.md](../METRICS.md).
- **Size VARIANCE (unmeasured payoff).** Synthetic raw spacing has sd **0.000** — every training
  strip is identical. Real runs sd 0.70–2.10. The original text says we shake "five times less than
  reality"; the raw truth is we shake *not at all* before augmentation. The `staff_jitter` op in
  `src/vision/augment.py` addresses this and stays as **insurance, not a fix** — the ladder says
  variance is not what is costing edits.

- **Non-claim:** measured on the exam only, and the cause is unknown, so nothing ships on it yet.
  Untested candidates: ink weight (real strips carry heavier ink than synthetic), stroke thinning
  under INTER_AREA, or the encoder's own preprocessing.
- **Non-claim:** the vertical-placement half of the original idea did nothing (shift +1% → +0.4%
  edits). Only scale mattered.

### 2. Are our beams, flags and dots the right weight? (aimed at the 28%)

The note-length mistakes are lopsided in a very specific way:

| gold → decoded | count |
|---|---|
| `8 → 4` | 8 |
| `16 → 8` | 6 |
| `8. → 8` (dot lost) | 4 |
| `4. → 4` (dot lost) | 3 |
| `8 → 8.` (dot added) | 2 |

15 of them are "the model thinks the note is **twice as long** as it is". A short note carries a
little flag or beam on its stem; the model is missing it. Another 15 are the small dot that makes a
note longer, added or dropped about equally.

This is the **same story as the sharp marks**: we draw with a music font whose strokes are heavier
than real print, and after the picture is shrunk for the model, thin details merge or vanish. We
proved that for the sharp bars and fixed it (`drawThinSharps`). **Nobody has ever checked the beams,
the flags or the dots.**

### ⛔ §2 RESULT (2026-07-28) — DISPROVED. Our beams are not too heavy; real print is heavier

Measured with `scripts/rung3/beam_weight_probe.py` (the `sharp_probe` method, applied to beam
thickness in staff spaces). Median thickness: synthetic **0.500 S** — exactly the engraving
standard — against real **0.567 S** (nota) and **0.765 S** (exam). The v4 and v5 pilots are
identical, confirming the beam-grouping change does not touch weight.

**The sharp-bar story does not transfer.** For the sharps our glyphs were 22% too thick; for beams
we are *thinner* than real print, and thinning them further would move us away from reality. The
residual gap matches the general ink spread already seen in staff-line thickness, so it is not
beam-specific.

- **Caveat, caught by looking at the contact sheet:** the thick tails are contaminated — synthetic
  "1.27 S" entries are **double beams** (16th-note pairs) and real "2.00 S" entries are degraded
  scans where ink bleed fused strokes. Only the median is trustworthy.
- **This does NOT clear `USUL_BEAM_GROUPS`.** That change alters beam *grouping*; this measured
  *thickness*. Grouping stays unvalidated and quarantined — do not ship it into 40,826 strips.
- **Separate finding, carried forward:** after the encoder's fixed-size input box, the model sees
  synthetic beams at ~6.5 px and real beams at 9–14.6 px. Both pools are normalised to the same
  staff spacing, but our strips average 1229 px wide against real 904–1018, so ours shrink harder.
  Every fine detail in a training picture arrives smaller than its real counterpart. An independent
  argument for the width half of the content work.

### 3. Draw the crop shapes the page-cutter actually makes

`stripExport` always builds a strip out of whole measures, so a "clef and key signature, no notes"
picture **cannot occur in training**: 0 of 40,826 strips. The slicer produces them from real pages —
4 of 326 exam strips, and 28% of exam strips are short.

The worst exam strip is exactly that shape: the answer is just the key signature, and the model
invented a whole bar of notes — **19 corrections against 8 correct tokens**. Twelve such strips carry
**21% of all corrections**.

### ⛔ §3 RESULT (2026-07-28) — cost CONFIRMED, mechanism DISPROVED, change DROPPED

Measured with `scripts/rung3/empty_crop_probe.py`.

**The cost is real.** Decoding the whole exam and bucketing by content: crops with **≤3 notes are
5.5% of strips but 20.8% of all corrections**, at 0.5–1.06 edits per gold token against a 0.03–0.05
baseline. round3.md said ~21%; it was right.

**The mechanism is wrong.** Across every labelled pool we own there are exactly **8** note-free
crops (4 exam, 4 nota — the shape is that rare). Only **1 of 8 invented notes**; the pre-registered
bar was ≥50%. The model does not hallucinate a bar — it simply cannot read these crops, getting
essentially every token wrong. The 19-edits-against-8-gold-tokens strip reproduced exactly, and the
page it comes from has a circled ④ section number in frame, so the trigger looks like unfamiliar
page furniture rather than emptiness.

**Why the change is dropped rather than re-aimed.** The shape is the *slicer's* deliberate
trade-off, not a rendering gap — `window_measures` merges slivers but emits a narrow clef+signature
crop rather than lose content, and the comment there says so. The current slicer has already halved
the shape (3.4% → 1.4% of crops). Teaching the renderer to imitate a crop we control and are
already removing is backwards, and it would cost a full re-render.

**A related idea, also measured and also dropped: cutting wide crops narrower.** Wide strips
(>1200 px) are 13.8% of the exam but 28.6% of corrections at 2.5× the baseline per-token rate. But
splitting them at a zero-ink gutter — scored against identical gold — made things **worse, +31.8%
(132 → 174 edits)**, worse on 15 strips and better on 5. And **19 of the 45 have no internal
bar-line at all**, so a measure-aligned split is impossible. `MAX_STRIP_W` is not a lever.
(`scripts/rung3/width_split_probe.py`.)

### 4. How crowded are the strips?

55 of the note-level errors are whole notes **inserted or deleted** — the model losing count, not
misreading a symbol. That points at density and crop width rather than glyph quality.

- **To do:** compare notes-per-strip and tokens-per-strip between the synthetic corpus and the real
  pools, the same way print position was compared for accidentals.

### ✅ §4 RESULT — already answered by `domain_gap.py` before this session

Strip width 1229 px synthetic vs 904 (exam) / 1018 (nota); notes per strip 8.6 vs 7.2–8.2; crops
with ≤3 notes 0.67% vs 6.0%. No further measurement needed. The width half of this gap is now
double-motivated — see the encoder-shrink note in §2.

### ✅ §5 RESULT (2026-08-15) — CAUSAL, and it replicates on the holdout

Measured with `scripts/rung3/crop_geometry_probe.py --make-padded`, which widens each exam crop with
more of **its own quietest columns** — content and gold untouched, only the resolution the encoder
sees goes down. Pre-registered before the run in [levers.md](levers.md): *monotone rise → causal;
flat within noise → drop the lever in writing.*

**It is monotone across all four doses**, as the encoder's staff spacing falls 19.2 → 9.6 px; the
paired bootstrap excludes zero from ×1.50 onward, and the **real-val holdout replicates steeper**.
Both unpadded arms reproduced their recorded baselines exactly — the exam's to the individual edit,
which is what says this is the same harness that produced the Round-2 read. The dose table, the
CIs and every caveat: [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

Two limits worth stating with the result, not after it: **×2.00 extrapolates** below the exam's
natural width range, and the probe **lowers** resolution — showing that costs edits is not the same
as showing that raising it pays. The **short-crop hole** (§3) is why that matters, and it is what
the 300-strip pilot has to watch.

## Then

Render the corpus with whatever those checks say. **§5 has now answered the one that was open: the
next render is a GEOMETRY render**, and the content work below is sequenced behind it. Train with the recipe held fixed again (two-stage, `--every-share 0.15`, real oversampled to
~34% of batches — recompute the `:N` repeat if the corpus size changes). Read the exam **once**.

## The real pool changed too (2026-07-27)

The `nota-full` review was worked through every disagreeing strip and promoted: 54 corrected labels,
7 `bad` strips removed. **521 of 1,740 nota strips now carry a human-corrected label**, and ~78% of
the labels on disagreeing strips turned out to be wrong ([../METRICS.md](../METRICS.md)).

Round 2 already trained on 467 of those corrections, so only the 54 are new — but the pool Round 3
trains on is cleaner than Round 2's, which is **one more difference between the two rounds**. Add it
to the attribution question below rather than forgetting it.

Still unmeasured: the 556 strips with no verdict all have `nd = 0` and were never flagged as
suspicious, so the error rate in that tail is unknown. A random 50 of them would settle whether the
pool is worth cleaning further or is ready to enlarge.

## Two things to settle before training, not after

1. ✅ **DONE — what counts as success was written down first**, and signed before training:
   [round3-criteria.md](round3-criteria.md). Deciding afterwards is how people talk themselves into
   whatever they got, and this project has already been burned twice by a headline that moved for
   reasons unrelated to reading ability.
2. **Decide whether to change one thing or four.** Round 2 changed the glyph weight, the label bug
   and the corpus size together, and we still cannot say which of them moved the number. That may be
   an acceptable trade again — but choose it deliberately rather than drifting into it.

## What is NOT in this round, and why

- **The microtonal sharps.** Still owed: signature-packed glyphs have never been measured
  (`SIG_GLYPH_ADVANCE = 13 px`), and that is where 32 of the exam's 33 küçük tokens are printed. But
  it is now a 13%-of-corrections problem, so it sits below the note-height and note-length work.
- **The error-highlighting UI.** Deferred by the owner (2026-07-27). The measurement that would
  justify it is still cheap: per-token confidence already comes out of
  `onnx_greedy_decode(return_logprobs=True)`, and `decode_page.py` throws all but min/mean away.
  Pre-registered rule if it is ever picked up: flagging 10% of tokens must catch ≥60% of errors.
- **Gold octave errors.** Real — every octave disagreement found was our answer key being wrong, not
  the model — but ≈1% of corrections, and the training pools are clean (0.1–0.2% of strips). Closed
  as a non-lever; see [../METRICS.md](../METRICS.md).
