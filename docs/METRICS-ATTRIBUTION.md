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
