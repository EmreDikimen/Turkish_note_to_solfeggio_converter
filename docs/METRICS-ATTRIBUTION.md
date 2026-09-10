# Where an error comes from — the label, or the model?

purpose: verdicts attributed to the SymbTr label or to the model, by error kind, and what the `nd` gate is actually catching
audience: anyone deciding whether a refused strip is worth recovering, or reading a correction count

updated: 2026-09-09

> Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-09-09 at the 400-line cap.
> That file keeps ranking, geometry and window counts; this one keeps **which source was wrong**.
> Current state and next action are NOT here: [STATUS.md](STATUS.md).

---

## Verdicts attributed to the LABEL or to the MODEL, by kind (2026-09-09)

`scripts/rung3/verdict_attribution.py`, no model run. Every review row carries three texts — the
SymbTr-derived `label`, a model's `decoded`, and the owner's `truth` — so each row prices the label
and the model **independently**. ⛔ The three populations are selected differently and may never be
pooled. ⚠ Counts are in LABEL-TOKEN space (`error_taxonomy.relabel`), so they are **not**
`eval_omr` edit counts.

**Two controls, both load-bearing, both found by the numbers looking wrong.**

- ⛔ **The decode caches predate the `\tie` retirement.** Left in, that one dead token was **70% of
  the `other` column** and the largest apparent model mistake in the accepted pool. Stripped, `other`
  falls to **0.3%** and the taxonomy is usable. It is an artefact of the vocabulary change.
- ⛔ **`review_ui.baseText` seeds the edit box with the LABEL's `\sig` block plus the DECODE's
  content.** A reader who accepts what is on screen therefore lands on the decode for notes and the
  label for the signature — which is *exactly* the shape "label wrong about notes, model wrong about
  the signature" that the raw tables show. Only **7% / 12% / 28%** of rows in the three populations
  were actively re-typed. Every number below is the `--active-only` cut.

| population | n (active) | both right | only LABEL wrong | only MODEL wrong | BOTH wrong |
|---|---|---|---|---|---|
| accepted, label confirmed (`h1`) | 233 | — | — (definitional) | **100%** | — |
| accepted, label corrected (`h1`) | 65 | 0% | **24.6%** | 0% | **75.4%** |
| refused (`examv3`) | 82 | 0% | 13.4% | 1.2% | **85.4%** |

⚠ In the first row `truth` **is** the label (that is what `ok` asserts), so its label column is
tautological and only the model column is a finding.

**Distance to the owner's answer** (label tokens, active rows): accepted-corrected — label median
**2.0**, model median **1.0**; refused — label median **4.0** (31.7% within 2 edits), model median
**1.0** (75.6% within 2).

**What each source gets wrong.** The label's dominant failure is the **signature**, and the seeding
works *against* finding it, so it is understated rather than inflated:

| where only the LABEL was wrong | share | n |
|---|---|---|
| `h1` accepted-corrected | **signature 93.3%** | 60 |
| `strips_nota` (retired crops) | **signature 49.5%** | 212 |
| `examv3` refused | accidental 26.4%, signature 24.5% | 53 |

The model's profile is different. On **accepted** material its residual errors are tuplet **24.0%**,
duration 20.8%, pitch 19.2%, repeat-structure 19.2% — accidentals only **0.6%**. On **refused**
material: pitch 18.2%, tuplet 18.2%, signature 16.9%, duration 14.3%, accidental 10.4%. Its top sign
substitution across all rows is **`\komaSharp` → `\kucukSharp`, 9 occurrences** — the known
koma/küçük weakness, in the direction the owner corrected 10:0.

⭐ **The finding that changes a plan: on refused material BOTH sources are wrong 85.4% of the time.**
Neither the label nor the model can be trusted alone there, which is what the emitter's refusal is
for — and why recovering those strips needs a human, not a better referee
([rung3/round4.md](rung3/round4.md) step 5).

## `nd_high` is mostly a wrong LABEL, not a strip the model cannot read (2026-09-09)

`nd = lev(label, decode) / len(label)`; over 0.35 the emitter DROPS the strip. In `--exam` mode it
reviews instead, so **85 `nd_high` rows carry the owner's own answer**. Of the 75 `fix` rows:

| | median distance to the owner's answer | within 2 edits |
|---|---|---|
| the SymbTr **label** | **20.0** | 1% |
| the model's **decode** | **0.0** | 91% |

Same in the dense half (n=20): **24.5** against **0.0**. ⚠ Anchoring explains a small distance, not
a 20-edit one — the reader is reading the picture.

**They are also not denser** (ids of music in the crop, `round2-stage2-best`'s own decode): accepted
**37**, all `nd_high` **37**. ⭐ **The one subset that IS dense**: the **1,678** strips `strips_b8`
dropped as `over_budget` and `strips_h1` drops as `nd_high` carry a median of **49**. Their nd
median is 0.54, and **nobody has read one** — `build_ndhigh_queue.py` stages 40 at random
([rung3/labeling-queues.md](rung3/labeling-queues.md)).

⚠ Scale of the disagreement, all `nd_high` in `strips_h1` (n = 4,701): nd median **0.59**, 48% above
0.60, max **15.33** (the decode is 15× the label's length — a total misalignment).

## When the label and the decode AGREE, how often are they right? (2026-09-10)

Re-measured on **every h1 row a human has read** (n = 3,864), against the August estimate's n = 169.
Comparison is token-for-token with `\tie` dropped and a spaced `32` re-glued.

| the two sources | rows | correct |
|---|---|---|
| identical | 945 | **99.6%** (4 fix) |
| identical ignoring spaces | 2,120 | **99.4%** (12 fix) |
| **agreement, combined** | **3,065** | **99.5% — 16 wrong** |
| they differ | 799 | **31.4%** |

⚠ **Agreement is not independence, and two things break it.** The errors **clump**: those 16 sit on
**8 pages** and one page holds 6 — when a page is misread, both sources tend to be wrong the same
way. And the decodes these queues show come from **`round2-stage2-best`**, not the current model
(only `handtest` uses `r3a-stage2-best-real`), so part of the agreement is memory: that model was
trained on labels largely carried into b8.

⭐ **THE SIGNATURE IS WHERE IT BREAKS BY CONSTRUCTION, AND ONE RULE CATCHES IT** (owner, 2026-09-10:
*"sadece sig bloğu içinde komaSharp veya kucukSharp varsa otomatik accept etme"*). The emitter
overwrites a label's `\sig` block with a majority vote over the model's own row-start decodes, so
there the label can BE the decode. Back-tested on the 3,065:

| | rows | share | errors | error rate |
|---|---|---|---|---|
| held back — `\sig` block spells a koma or küçük sharp | 56 | 1.8% | **7 of 16** | **12.50%** |
| let through | 3,009 | 98.2% | 9 | **0.30%** |

**1.8% of the volume for 44% of the mistakes**, a 40× separation. ⚠ Inside the block only — an
inline koma/küçük sharp after `\sigend` is read off the staff and is independent of the vote.
Signature rows are 38% of agreeing rows but 63% of their errors.

**Applied to `strips_h1` the same day:** 261 rows auto-accepted (242 exact, 19 whitespace-only),
marked `by="agree"` / `"agree-ws"` so they stay distinguishable and reversible; the owner's reading
queue fell **571 → 309**. ⛔ **The 100 `new_dense_sample` rows were excluded** — they are a random
sample staged to estimate how dirty the rescued strips are, and auto-accepting the agreeing half
would leave a remainder biased toward disagreement, destroying the rate they exist to produce.
Verified after the write: no human verdict was overwritten.

## ⚠ A `fix` verdict does not always fix anything (2026-09-10)

Counting `fix` rows overstates the escaped-bad rate, and on one queue it does so enormously.
Measured by comparing `corrected_label` against `label` in token space:

| queue | verdicted | `fix` | of those, change **nothing** | real corrections |
|---|---|---|---|---|
| **`h1-audit`** | 29 | 27 | **23** | **4** |
| `b8-audit` | 201 | 27 | 1 | 26 |
| `h1-full` | 4,126 | 550 | 15 | 535 |

⛔ **So h1-audit reads 93% `fix` and is really 4 of 29 — 13.8%**, in line with b8-audit's **12.9%**
(26 real of 201), the figure this project quotes as the escaped-bad rate. The no-ops are byte-identical,
not re-spacings, so they are a verdict pressed without an edit rather than a retype.
⚠ **Quote real corrections, never `fix` counts**, and check the two before comparing queues.

⭐ **And the errors are where agreement is not:** all **4** of h1-audit's real corrections sit in rows
where the label and the decode DIFFER. Of its 23 read rows where they agree, **zero** carry a real
correction — the same picture as h1-full's 0.30%.

**Auto-accept applied to `h1-audit` the same day:** 149 rows (143 exact, 6 whitespace-only), 3 held
back by the koma/küçük signature rule, leaving **49** to read. ⚠ The sample stays usable because the
strata are marked: `by="agree"` rows carry the measured 0.30% error rate and the hand-read rows carry
what they carry, so an escaped-bad rate is still a weighted estimate rather than a lost one.
