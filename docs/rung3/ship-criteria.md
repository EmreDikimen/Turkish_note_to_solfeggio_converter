# Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim

purpose: the floors Round 1 was judged against, written before training; the template for Round 2
audience: agents and the owner working the real-page track
updated: 2026-07-20

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

> Written 2026-07-20, **before stage 1 saw anything**. Round 1 was measured against exactly
> these floors; the result is in [round1.md](round1.md) and [../METRICS.md](../METRICS.md).
> Round 2 amends this file rather than inventing new floors.

### Step 4.0 — PRE-REGISTERED ship criteria ✅ WRITTEN 2026-07-20 (before Stage 1 saw anything)

**Status: these are the criteria, fixed before any Round-1 training ran.** Every floor below is
stated next to its measured baseline (`rung22-stemfix-best` on the frozen 352-strip exam v2.1,
`data/checkpoints/rung22-stemfix-best/eval.jsonl` last row) so the demanded delta is explicit
and auditable. Round 1's exam read is a ONE-SHOT (see "Exam discipline" above) — a pass bar
written after seeing the result is not a bar, it is a description.

**Threshold stance: ambitious but defensible.** The anchor is Round-0.5, which moved real-val
AEU **70 → 91.7%** as a real-only fine-tune on 418 strips; Round 1 has ~5.6× that real data plus
the (re-rendered) synthetic pool. A bar Round 1 clears automatically would not discriminate a
good run from a mediocre one.

#### The floors

| Criterion | Baseline | Round-1 floor |
|---|---|---|
| Mean per-class AEU **recall** — the headline | **64.1%** | **≥ 85%** |
| Mean per-class AEU **F1** — new, reported alongside | **57.0%** | **≥ 80%** |
| Per-class **recall**, each class with ≥20 real gold | 22.6–87.5% | **≥ 75% each** |
| Per-class **precision**, same classes | 53.8–92.3% | **≥ 70% each** |
| `\tup3` **precision** | **15.1%** | **≥ 70%** |
| `\tup3` recall (may fall — precision is what we are buying) | 92.7% | **≥ 85%** |
| **Arc-triggered false `\tup3` rate** (defined below) | **77.6%** (66/85) | **≤ 10%** |
| SER | **0.147** | **≤ 0.06** |
| Exact-match | **17.3%** | **≥ 45%** |
| Per-source AEU gap (neyzen − nota) | **12.5 pp** | **≤ 12 pp** (must not widen) |
| Synthetic val mean AEU recall — no-regression clause | 99.9% | **≥ 99%** |

The five classes carrying the per-class floors (≥20 real gold on the exam) and what each must
move:

| Class | gold | recall | → floor | precision | → floor |
|---|---|---|---|---|---|
| `\bakiyeSharp` | 141 | 76.6% | ≥75% (holds) | 90.8% | ≥70% (holds) |
| `\kucukFlat` | 70 | 51.4% | **≥75% (+24pp)** | 92.3% | ≥70% (holds) |
| `\bakiyeFlat` | 66 | 60.6% | **≥75% (+14pp)** | 83.3% | ≥70% (holds) |
| `\komaFlat` | 48 | 87.5% | ≥75% (holds) | 53.8% | **≥70% (+16pp)** |
| `\kucukSharp` | 31 | 22.6% | **≥75% (+52pp)** | 77.8% | ≥70% (holds) |

`\kucukSharp` recall is the single hardest ask and the reason the re-render boosts komaSharp/
kucukSharp. Note the shape of the baseline: the flats miss notes they should catch (recall), the
komas invent notes that are not there (precision). Both are failures; only one is in the headline.

**Why mean F1 and not just the headline.** The headline is mean per-class **recall** — precision
is excluded, so a hallucinating model scores well while making the product worse (a spurious koma
is a real pitch error the user must hunt down). Baseline precision: `\komaSharp` **21.1%**,
`\komaFlat` **53.8%**. Mean F1 (57.0%) is the honest single number and must be reported next to
the headline every time. The F1 floor is set at 80%, slightly under the 85% recall floor, because
two LOW-N classes (`\komaSharp` 18 gold at 21% precision, `\buyukSharp` 3 gold) sit in the mean
and drag it; excluding them from the *mean* would be gaming, so the floor absorbs them instead.

#### Ties are NOT a ship criterion — the arc→`\tup3` confusion is (user decision, 2026-07-20)

A missed `\tie` is cheap: the note survives at the right pitch, the duration merge is visible in
the editor, and the **tie ground truth itself is unstable** (~38% tie/repeat structural label
noise in nota auto-accepts; hand adjudication applies `\tie` across different-pitch arcs
inconsistently — see the tup3 image-pass note in [labeling.md](labeling.md) §1b: "printed-arc-vs-`\tie` is user judgment; no
textual rule works"). Gating a ship decision on that would measure the labels, not the model. So
`\tie` (baseline 66.2% recall / 61.1% precision) is **reported, never floored**.

The damaging failure is directional: **a printed slur/tie arc read as a triplet.** The tup3 image
pass is unambiguous — every decode-proposed new `\tup3` was a hallucination (**0/39 real**),
near-always triggered by a printed slur arc — and those insertions dominate the baseline SER
(I=919). That error silently rewrites the rhythm of a whole group (3 notes become ×2/3 of their
written value); unlike a dropped tie, nothing on screen looks wrong.

**Arc-triggered false `\tup3` rate** = of exam strips whose gold label contains `\tie` but **no**
`\tup3`, the fraction whose decode emits any `\tup3`. On exam v2.1 that denominator is **85
strips** (88 have `\tie`, 3 of those also have `\tup3`). **Floor: ≤ 10%.** Report it beside the
same rate over the **229 strips with neither** `\tie` nor `\tup3` — the split separates "learned
what a triplet looks like" from "stopped firing on arcs specifically."

**✅ SHIPPED 2026-07-20 (`eval_omr.py`, per item (0b) — code lands before any Round-1 training).**
The metric (per-strip presence of `\tie`/`\tup3` in gold vs `\tup3` in decode) + mean per-class
AEU **F1** now print on every eval and persist to `eval.jsonl` (`arc_tup3{}`, `headline_f1`, and a
per-class `f1`). **Baseline filled by re-running the spent rung22-stemfix exam read** (same frozen
model + frozen exam v2.1 = zero selection leakage): the measured denominators came out to **exactly
85 / 229**, confirming the hand-computed pre-registration, and mean F1 to **exactly 57.0%**.
**Arc-triggered false-`\tup3` baseline = 66/85 = 77.6%** (neither-token rate 82/229 = 35.8%) — the
model fires a spurious triplet on more than three-quarters of arc-bearing strips; the ≤10% floor is
what the re-render's slur distractors must buy. Measurement is now debugged, off the one-shot
exam-day path.

This is what the synthetic re-render's **slur distractors** are for: synthetic never drew slurs,
so the model has no negative examples for the arc shape. This metric is how we find out whether
that fix worked, and it is why `--oversample-tup` stays modest — more tup3 positives without arc
negatives makes precision *worse*. (The reporting addition lands in `eval_omr.py` **before any
Round-1 training** — not at exam time — and the baseline cell above is filled by re-running the
spent rung22-stemfix exam read: same frozen model, same frozen exam, zero selection leakage. The
metric is computable from the manifest labels + decodes with no new gold; building it now means
the measurement is debugged before the one-shot read it gates.)

#### Blind spots — the criteria must NOT be gamed on these

- **`\buyukFlat`: 0 real gold** on the exam. Synthetic-validated only (100%/100% at 34 gold,
  Rung 2.2). **No real-page claim may be made for it**, in either direction.
- **LOW-N classes: `\komaSharp` 18 gold, `\buyukSharp` 3 gold.** Below the ≥20 threshold, so they
  carry no per-class floor — they cannot honestly support a 75% bar. They stay **inside** the
  headline and F1 means (as at baseline, so the numbers stay comparable) and are always printed
  with the LOW-N marker. Never silently dropped to flatter the mean.
- **`\tup3` gold is common-case k=1 material.** Dense contiguous-triplet instrumentals
  (sazsemaisi/longa, 90+ groups) sit in the over_budget/split_wide drops and are **unmeasured**
  until the sub-measure fragment follow-up ([labeling.md](labeling.md) §1c). Round-1 tup3 numbers speak for the common case
  only — say so in `MODEL_EVAL.md` when reporting.
- **The exam is an upper bound.** Matched, emit-alignable pages only (`caveat:
  matched-upper-bound` in the eval row): handwritten, faded, and slicer-defeating pages never
  entered it. Real-world accuracy is *below* whatever this exam says.
- **Training-pool label noise** (~7% pitch / ~38% tie-repeat structural in nota auto-accepts)
  bounds how much of a residual miss is the model's fault. The post-Round-1 fresh 5% nota
  re-audit runs **regardless of pass or fail**.
- **`\sigend` 73.5% recall / 65.9% precision** is partly the known empty-`\sig` label bug, which
  the re-render fixes; do not read Round-1 movement here as pure model improvement.

#### The decision rule (what makes this binding)

1. **Selection happens on real-val, never on the exam.** The A-vs-B init experiment is decided by
   free-running `eval_omr.py` real-val AEU **and precision** — not teacher-forced val loss, which
   cannot see generation pathologies like the tup3 hallucination.
   *Refined 2026-07-20, before any training ran: the selection statistic is ONE pre-registered
   number — **free-running real-val mean AEU F1**, computed on the hand-verified subset of val
   strips where available (so pool label noise doesn't pick the winner); tie-break = the
   arc-triggered false-`\tup3` rate. "AEU and precision" alone was too vague to be binding.*
2. **The exam is taken ONCE**, on that single winner.
3. **A miss is not re-rolled on the same exam.** If a criterion fails: diagnose on real-val, fix,
   and any further exam read is labelled in `MODEL_EVAL.md` as a **second look, with its leakage
   acknowledged**. Writing this down now, while it costs nothing, is the whole point of Step 4.0.
4. **Ship only on a clean pass** — through the scripted chain (ONNX export → int8 parity → browser
   gate) into `apps/web/public/models/`. A partial pass is written up as partial, never rounded up.
