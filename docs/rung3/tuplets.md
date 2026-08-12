# Tuplets — why `\tup3` recall keeps missing its floor

purpose: the tuplet diagnosis, the printed-notation facts behind it, and the plan that follows
audience: agents and the owner working the real-page track
updated: 2026-08-11

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md) and
> [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).
>
> Written 2026-08-11 after an owner report of two misread triplets on a real page. The collection
> side of tuplets is in [labeling.md](labeling.md) §1c; this file is the *reading* side.

## The finding

**The tuplet data work is finished. The remaining weakness is a precision/recall trade we made on
purpose and never rebalanced — and, underneath it, a mark we draw in a shape real print does not
use.**

`\tup3` recall was **92.7% before any of this round's work** and is **83.8% now**, against a ≥85%
floor it has missed twice. Precision went the other way, 15.1% → 91.2%, against a ≥70% floor. The
numbers and their history: [../METRICS.md](../METRICS.md).

The model does not invent triplets any more. It **misses about one in six**.

## What is NOT the problem (checked 2026-08-11)

**Not a data shortage.** The `strips_tup` queues are fully verdicted and the promote has run —
`manifest.jsonl` holds 169 strips / 205 groups, and the pool trains at `:8` oversampling
(`--real-dir data/real/rung3/strips_tup:8`, [round1_colab.ipynb](../../notebooks/round1_colab.ipynb)).
The exam extension also happened: tup3 gold went 4 → 55 groups at the v2.1 freeze.

⚠ [labeling.md](labeling.md) §1c described "78 accepted + a 147-row review queue" until this date.
That was the state on 2026-07-18 and it was read as current three weeks later. Corrected there.

**Not the 0/39 hallucination finding.** The tup3 image pass measured that every decode-proposed NEW
`\tup3` was a hallucination (0 of 39 real, near-always triggered by a printed slur). That was
measured on the **pre-tuplet-collection** model and does not describe `round2-stage2-best`. It is
kept as history in [labeling.md](labeling.md), not as a current fact about the live model.

**Not the stitcher.** Unclosed `\tup3` is closed at the barline or row end, a stray `\tupend` is
ignored, and a mid-row `\sig` is dropped (`tools/render/stitch.ts`). The page is already repaired.
⚠ But the exam scores **token ids, before the stitcher**, so no stitch-time repair can move it.

## The two failure shapes, from a real page (owner, 2026-08-11)

**A group with the wrong edges.** The model found the bracket and started it one note late:

```
model:  \natural f''16   \tup3 e''16 d''16 \tupend      ← 2 noteheads
right:  \tup3 \natural f''16 e''16 d''16 \tupend
```

**A group missed entirely.** `b''16 a''16 g''16` emitted as three plain notes, no markers.

The first is repairable from the tokens alone (below). The second is not — a missed triplet is
token-identical to three plain notes, and the model reads no time signature, so nothing sums.

## A triplet is NOT always three noteheads

The "3" counts **units of time, not noteheads**. Two units can be merged into one longer note, or
one unit split into two shorter ones. A 32nd + a 16th under one bracket is three units in two
noteheads, and it is normal music.

Measured across all four label pools — 20,259 groups — four have ≠3 noteheads, two of them
legitimate. Detail: [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

⚠ **"≠3 noteheads" is a review GATE, never an auto-repair.** [labeling.md](labeling.md) records the
rule that such a group never auto-accepts — correct, because it sends the odd ones to a human. Wired
up as a *fixer* it would corrupt the legitimate two-notehead groups, which live in exactly the fast
32nd-note passages the model is already worst at.

**More than three noteheads is rare in Turkish notation** (owner, 2026-08-11), so the corpus holding
none of that shape is correct, not a gap.

## What the durations do determine

A group closes when its running sum of *sounding* durations lands on a plain power-of-two value.
That is already the rule `tupletGroupsIn` implements (`tools/render/rhythm.ts`), and it handles
two-, three- and four-notehead groups without counting anything.

So the closing point is derivable, which yields a repair that only ever acts when the arithmetic
leaves no choice:

| running sum when `\tupend` arrives | action |
|---|---|
| a plain value | well-formed, close |
| not plain, and exactly one neighbouring note equals the deficit | pull it in — **forced, not guessed** |
| not plain, and two or zero neighbours fit | flag, leave alone |

Worked on the owner's case: the group sums to 1/12, the next plain value is 1/8, the deficit is
1/24, and the note immediately before is a 16th — 1/24 inside a bracket. One candidate, exact fit.

This narrows the standing "do not overwrite what the model read" policy
(`rhythm.ts`) to the provable cases only; the ambiguous ones keep it.

### `\tupend` stays in the vocabulary

It carries no information the durations do not already carry, so removing it is *technically*
sound. It is not worth it: every label in every pool would be regenerated, including the frozen exam
gold, mid-round, for a saving of one token per group.

The same benefit is available without touching a label — **constrain decoding**: forbid `\tupend`
until the running sum is plain, force it when it is. A malformed group becomes unemittable, and
unlike a stitch-time repair it shows up in the exam score. Decision row:
[../DECISIONS.md](../DECISIONS.md).

## The likely root cause: we draw the mark wrong

**Real Turkish editions break the arc and put the "3" in the gap. We draw a continuous arc with the
digit floating above it** (owner, 2026-08-11, from a real page).

```
real print:   ⌒‾‾  3  ‾‾⌒          our renderer:        3
                                                  ⌒‾‾‾‾‾‾‾‾‾⌒
```

Why this matters more than it looks — consider what separates a triplet from a plain phrase slur:

- **In real print:** a slur is a continuous curve; a triplet is a *broken* curve with a digit in the
  break. A structural difference, legible even in a small strip.
- **In our corpus:** a slur is a continuous curve; a triplet is *the same continuous curve* plus a
  13 px digit hovering above it. The weakest cue available.

The label-free slur distractors were added to kill the arc→`\tup3` misread, and they worked —
arc-triggered false `\tup3` went 77.6% → 0.0%. But they taught discrimination on **our** cue, not
the printed one, and the cost landed on recall.

This is the same shape as the Bravura sharp-bar defect: a glyph we drew unlike real print, learned
faithfully, and paid for on real pages. That diagnosis method — measure our glyph against real
print at matched staff size — is the one that worked, and it has never been pointed at the tuplet
mark. Renderer constants as they stand: [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

## The plan

Ordered, one change at a time, because Round 1 and Round 2 each moved several things and neither can
be attributed.

1. **Redraw the mark**: break the arc, put the digit in the gap, raise the arc share above its
   current 70% (owner: arcs are more dominant than that). **Pixels only** — the `\tup3` token is
   identical either way, so no label moves and no re-labelling is needed. `drawTupletArc` in
   `apps/web/src/SheetView.tsx`. ⚠ That file is both the app's score view and the training-strip
   source, so this also fixes how the app draws triplets for a reader.
2. **Show the owner a rendered sample beside a real page** before re-rendering at scale. The shape
   is a domain judgement, not a measurement.
3. **Re-render and A/B** on `\tup3` recall specifically, with precision watched (it has ~20 points
   of headroom above its floor and can afford to give some back).
4. **Ship the arithmetic repair** for the wrong-edge groups that survive, plus the decode
   constraint above.
5. **Only then** revisit the 35% slur-distractor rate. It may be fine once the two shapes genuinely
   differ; changing it at the same time as the shape would make the result unreadable.

**No new labelling appears in this list.** That work is done.

## Non-claims

- The arc-shape story is a **hypothesis with a mechanism**, not a measurement. Nothing has been
  A/B'd yet. It is consistent with the precision/recall history and with the Bravura precedent, and
  that is all.
- The missed-group failure (shape 2 above) is **not** addressed by any repair rule here. Bar-length
  comparison across a page could reach it — most bars agreeing sets the expected length without a
  time signature — but that is untested and unbuilt.
- Recall is measured on the exam's 55 tup3 groups. That is far better than the 4 it froze with, but
  it is still a small class; quote it with n.
- Two `strips_tup` labels do not sum to a whole number of units (`\bakiyeSharp g''8 a''8`, twice).
  Unresolved: a wrong label or a crop that cut a group. Two rows out of 20,259 groups.
