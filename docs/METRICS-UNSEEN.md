# Diagnostics — the symbols the model has never been shown

purpose: the single home for defects whose cause is a HOLE — a printed symbol the renderer never drew and the label language cannot name — and what happened when one was filled
audience: agents and the owner, before proposing a fix for a symbol the model reads as something else

updated: 2026-08-20

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-08-20 when that file crossed
the 400-line cap. The split is by **genre, and the genre turned out to matter**: everything here has
the same cause and, as of the staccato arm, the same prognosis.

⭐ **The pattern these share.** A symbol exists in real print; `ADDED_TOKENS` has no token for it; the
renderer draws none; so **0 of 40,826 training strips carry it**, and the model reads it as the
nearest thing it *has* seen. That is not a tuning problem and not a domain gap — the label language
has no legal way to say the right thing.

⭐ **And it is the one axis Round 3 has moved.** The three "make the pixels look more real"
experiments were all nulls (tuplet mark p = 0.688, the second engraver, the scan profile); the
staccato arm — a symbol the model had **never seen** — took its primary from 72.7% to **0.0%**.
**A hole responds; a domain gap does not.** That is the reason to read the dotted-barline entry below
as owed work rather than as a curiosity. Round 3's arm: [rung3/staccato-arm.md](rung3/staccato-arm.md).

### The DOTTED (usul) BARLINE read as `\repstart` (owner-found 2026-08-20, while labelling)

Same shape as the staccato hole below, found the same way — by eye, mid-labelling, on
`gorunce_ben_seni_ey_mah_nota_p1_s05_w02.png` (`batch3`, karcigar). The strip carries a **column of
four dots across the staff with no line** — the dotted barline Turkish editions print to mark usul
subdivisions *inside* a measure — and the model emitted `\repstart` there. The owner's verdict removed
it; the raw row is decode-seeded, so label and decode both carried the error.

The cause is structural, not tuning, and it is the third instance of one pattern:

- **`ADDED_TOKENS` has no dotted-barline token.** The 25 are 8 accidentals + `\natural`, `\sig`/
  `\sigend`, 4 repeat, 4 navigation, `|`, `3`, and 4 rhythm signs. A dotted barline has **no legal
  spelling**, so the model cannot be right about one.
- **The renderer draws none.** `SheetView.tsx` sets only `Barline.type.REPEAT_BEGIN` / `REPEAT_END`;
  everything else is VexFlow's default single bar. So **0 of 40,826 strips** carry a dotted barline.
- **The nearest thing it has seen is a repeat sign** — a line plus *dots*. A column of dots maps onto
  that, or onto an augmentation dot. Note the prior is not inflated: `\repstart` sits at **3.35%** of
  synthetic strips against **2.07% / 4.04% / 3.07%** in `strips_nota` / `strips_r1` / the exam.

**Frequency, from the `batch3` queue as it stands:**

| | count |
|---|---|
| rows whose decode contains `\repstart` | **117 of 1,499 (7.8%)** |
| of those, judged by the owner so far | 23 |
| judged **and the `\repstart` removed as wrong** | **13 (57%)** |

⚠ **Not a random sample.** The owner works in page order and noticed this pattern, so the 23 judged
rows are drawn toward it; 57% is an upper-ish estimate, not a rate. What it does establish is that
the failure is **repeated and systematic**, not one strip.

⚠ **A second thing is visible in that row and is not this finding**: the seeded label spells
`\bakiyeSharpf''8` and `\repstarte''8` with no space, while the correction spells them apart. Spacing
is id-identical for `32` **only** ([DECISIONS.md](DECISIONS.md)), so for `8` these are different token
sequences. That is the decode's raw output, not a gold defect — but it means a decode-seeded row can
differ from its own correction in more than the symbol under discussion.

### Staccato read as an augmentation dot (2026-08-15) — measured with a paired control

> ✅ **CLOSED BY A TRAINED ARM — 2026-08-20. The rate is 0.0%.** Everything below is the *baseline*
> and how it was found; the arm that fixed it and all three of its clauses are in
> [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md) ("Round 3 — arm 2"). The short version
> is in the result table at the end of this section.

Owner-reported, then measured. `ADDED_TOKENS` has **no articulation token** (all 25 are accidentals,
structure and navigation) and the renderer draws no staccato, so 0 of 40,826 training strips carry
one: every dot the model has ever seen meant *longer*. A 1,215-strip pilot rendered twice from
`pieces_v4.json`, identical apart from the marks (manifests byte-identical, `verify-labels` PASS
1215/1215), gives a pool of **110 strips carrying ≥1 staccato whose gold has no dotted duration**:

| arm | strips decoded exactly | SER | **decoded a dot gold does not have** |
|---|---|---|---|
| control (no marks) | **110/110 = 100%** | 0.000 | **0 / 110 = 0.0%** |
| staccato | 30/110 = 27.3% | 0.058 | **80 / 110 = 72.7%** |

⚠ **Re-measured 2026-08-20 and reproduced exactly** by `scripts/rung3/staccato_falsedot_score.py` —
80/110, exact 27.3%, SER 0.0578 — from a script written off the definition above. The original
measurement was ad hoc and never committed; the metric is now re-runnable, which is what let the
same instrument score the arm. The checkpoint behind these two rows is **`round2-stage2-best`**, the
live model; that was not written down at the time and matters, because the defect's severity is not
a constant (see the arm's table below).

**The staccato-triggered false-dot rate is 72.7%, against 0.0% on the same music without the marks**
— the baseline Lever 6 is stated against. The dominant substitutions are exactly `X → X.`
(`d''4 → d''4.`, `g''8 → g''8.`, …). 43% of pilot strips carry at least one mark.

Where the same error lands on the Round-2 exam, by quality tier — the reason a whole-exam floor
would measure scan quality rather than this defect:

| direction | easy | mid | hard | total |
|---|---|---|---|---|
| dot **added** | 0 | 1 | 3 | **4** |
| dot **lost** | 0 | 5 | 7 | **12** |

Dropped dots concentrate in the **hard tier** (7 of 12), and the easy tier shows **zero of either** —
so the exam is nearly blind to this and the pilot above is the instrument.

⚠ **CORRECTED 2026-08-18.** This line used to read "concentrate in degraded scans … six with `nd` up
to 1.14", i.e. it read `nd` as scan quality. It is not: `nd` is `lev(label, decode)/len(label)`, a
label-vs-decode disagreement ([METRICS-CORPUS.md](METRICS-CORPUS.md)). "The dots we lose are on
strips where the model disagrees with the label most" is a restatement, not an explanation, so the
**tier** concentration is the only claim the data supports here. ⚠ This matters beyond wording: it is
the stated basis for Lever 6 clause 2 excluding hard tier in advance — flagged in
[rung3/levers.md](rung3/levers.md), decision owed to the owner ([STATUS.md](STATUS.md)).

### The arm's result: 72.7% → 0.0%, and the marks became invisible (2026-08-20)

Same 110-strip marked pool, same script, three checkpoints:

| checkpoint | exact | SER | **false dot** |
|---|---|---|---|
| **`r3-stac-stage2-best`** (the arm) | **99.1%** | **0.0002** | **0 / 110 = 0.0%** |
| `r3-tupnew-stage2-best` (its training control) | 43.6% | 0.0396 | 60 / 110 = 54.5% |
| `round2-stage2-best` (live, the baseline above) | 27.3% | 0.0578 | 80 / 110 = 72.7% |

Paired: **60 strips the control gets wrong and the arm gets right, 0 the other way** (exact McNemar
p = 1.7e-18); 80 vs 0 against the live model (p = 1.7e-24).

**The arm reads the marked pool exactly as well as the unmarked one** — 99.1% exact and SER 0.0002
on both, its one non-exact strip being the same file with the same `\bakiyeSharp → \komaSharp`
confusion in each. So this is not "learned to suppress a dot"; the marks stopped carrying
information about duration at all.

⚠ **The control is at 54.5%, not 72.7%.** The severity varies by checkpoint, so the published
baseline could not have served as the control on its own — that is why the arm was scored against
both.

⚠ **This is our own rendered staccato.** No labelled real strip in any pool carries one, so the
generalisation to a real printed staccato is **not measured**. Same blind spot as the concave
tuplet mark ([METRICS-TUPLETS.md](METRICS-TUPLETS.md)).

### The real-dot no-regression read, easy+mid (2026-08-20)

`scripts/rung3/staccato_realdot_score.py`. The augmentation dot is a suffix inside a duration token,
not a token, so `eval_omr.py` has no per-class row for it; counted per strip in both directions.
Gold dot instances: easy 18, mid 53, hard 64.

| checkpoint | easy+mid (**the gate**) | hard (reported, never gated) |
|---|---|---|
| arm | 65/71 kept = **91.5%** | 56/64 = 87.5% |
| control (`tupnew`) | 66/71 kept = **93.0%** | 57/64 = 89.1% |
| live (`round2`) | 66/71 = 93.0% | 59/64 = 92.2% |

One dot separates arm and control. Paired on the gated strips: 1 strip where only the arm lost a
dot, 0 where only the control did, **p = 1**. Easy tier is 18/18 on all three. On hard tier the arm
loses 3 strips the live model does not and 0 the other way (p = 0.25) — directionally worse, n far
too small to read, and excluded from the gate in advance.

⚠ **A number in the exclusion's written reason is wrong, and it is not this pool's.**
[DECISIONS.md](DECISIONS.md) (2026-08-19) justifies excluding hard tier partly on "hard tier carries
**~12 real-dot instances in total**". Measured here, `_realval_v2_hard` carries **64** gold dotted
durations — comparable to easy+mid's 71 combined. The "12" is the Round-2 **exam's** dropped-dot
count (0 easy / 5 mid / 7 hard, the table above), a different pool and a different quantity. The
exclusion still stands on its *other* stated reason — hard tier's gold is the least reliable pool we
own — and the gate passed either way, so nothing about the round changes. Recorded because this is
the **second** time a written reason in this section has failed to carry what it claims.
