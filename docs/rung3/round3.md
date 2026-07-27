# Round 3 — the notes themselves: where they sit and how long they are

purpose: what Round 3 targets, the evidence behind it, and the checks to run BEFORE rendering anything
audience: agents and the owner working the real-page track
updated: 2026-07-27

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md).
> Decisions: [../DECISIONS.md](../DECISIONS.md).

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

## Four checks to run BEFORE rendering anything

None of these needs training. Three of the last three "the model is bad at X" findings turned out to
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

- **To do:** re-measure with a proper staff-line detector (the numbers above come from a
  row-darkness heuristic that lyrics and dense beaming can fool), then widen the `Affine` scale and
  translate ranges to match what is measured.
- **Cost:** a settings change in the augmenter. **No re-render.**
- **Non-claim:** the ±1-position errors are *consistent with* this, not proven to be caused by it.
  The proper measurement is what turns it into a fact.

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

- **To do:** apply the `sharp_probe` method to beams, flags and augmentation dots — measure ours
  against real printed editions at matched staff size, as
  [round2.md](round2.md) describes for the sharp bars.
- **Cost:** a measurement, then possibly a renderer change.

### 3. Draw the crop shapes the page-cutter actually makes

`stripExport` always builds a strip out of whole measures, so a "clef and key signature, no notes"
picture **cannot occur in training**: 0 of 40,826 strips. The slicer produces them from real pages —
4 of 326 exam strips, and 28% of exam strips are short.

The worst exam strip is exactly that shape: the answer is just the key signature, and the model
invented a whole bar of notes — **19 corrections against 8 correct tokens**. Twelve such strips carry
**21% of all corrections**.

- **To do:** have `stripExport` also emit signature-only crops, short fragments and row-start-only
  windows, in the proportions the slicer actually produces.
- **Cost:** a `stripExport` change. **No training needed to test it** — render a sample and look.

### 4. How crowded are the strips?

55 of the note-level errors are whole notes **inserted or deleted** — the model losing count, not
misreading a symbol. That points at density and crop width rather than glyph quality.

- **To do:** compare notes-per-strip and tokens-per-strip between the synthetic corpus and the real
  pools, the same way print position was compared for accidentals.

## Then

Render the corpus with whatever those four checks say. Train with the recipe held fixed again
(two-stage, `--every-share 0.15`, real oversampled to ~34% of batches — recompute the `:N` repeat if
the corpus size changes). Read the exam **once**.

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

1. **Write down what counts as success first.** The goal is now **≥90% of pages needing ≤5
   corrections**; the Round-2 baseline is **57%**. Pick the number Round 3 must reach and write it
   here before the run. Deciding afterwards is how people talk themselves into whatever they got —
   and this project has already been burned twice by a headline that moved for reasons unrelated to
   reading ability.
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
