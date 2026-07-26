# Round 1 — the first fine-tune on real pages (Step 4)

purpose: the plan, the init A/B, the one-shot exam read, and the ship decision
audience: agents and the owner working the real-page track
updated: 2026-07-23

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

> Split for readability: the pre-registered floors live in [ship-criteria.md](ship-criteria.md)
> (Step 4.0) and the corpus rebuild in [rerender.md](rerender.md) (Step 4.1).

## Step 4 — Round 1: fine-tune on everything matched + the first honest number

Colab, the proven Rung-2 kit: synthetic re-render + ALL matched real strips (both sources;
per-source + real oversampling are loader knobs — **never** "delete neyzen files"). Multi-pool
loader DONE (`train.py --real-dir DIR[:REPEAT]`, stable piece-hash real-val split consistent
across pools, `--oversample-tup`, real strips train un-augmented). **Split by piece across ALL
pools** (a piece's real and synthetic strips stay in one split; dedupe matched↔synthetic by
SymbTr file). Baseline v2.1 taken 2026-07-20 (64.1% AEU / SER 0.147; `MODEL_EVAL.md`) — the
number Round 1 must beat. Refinements decided 2026-07-20 (each fixes a plan weak point):

1. **Init = an EXPERIMENT, not a decree (the highest-leverage choice).** The pre-registered
   text said "from base, single-stage joint." But Round-0.5 (real-only fine-tune from a
   synthetic-trained checkpoint) moved real-val AEU **70 → 91.7%** — evidence that a dedicated
   real-specialization phase is worth a lot, which single-stage joint (fixed ~10:1
   synthetic:real throughout) dilutes. So run BOTH on Colab and pick on real-val — both arms at
   `--every-share 0.15`; the every-share sweep then runs on the winning recipe ([rerender.md](rerender.md),
   DECIDED 2026-07-21 — sequential, 4 runs total, never the 6-run cross):
   - **(A) two-stage from BASE** — Stage 1: carry-mode synthetic from base → carry-native
     synthetic checkpoint; Stage 2: real-inclusive fine-tune from Stage 1, fresh low-LR
     warmup, early-stopped on real-val. This is the Round-0.5 recipe with 5.6× the real data.
   - **(B) single-stage joint from BASE** — the control.
   - Init from `rung22-stemfix` is REJECTED: it was trained on NON-carry labels, so it starts
     with a format mismatch Round 1 would have to unlearn. Two-stage Stage 1 gives a
     carry-native synthetic checkpoint from base and sidesteps this cleanly.
2. **Checkpoint selection = free-running real-val AEU, NOT teacher-forced loss.** The tup3
   hallucination and accidental over-prediction are generation-time pathologies cross-entropy
   loss barely sees. Run `eval_omr.py` on the real-val pool at the eval checkpoints; select the
   best on real-val AEU (+ precision, see below). The loader's val-mix loss is a coarse guard
   only.
3. **Watch PRECISION, not just the recall headline.** The headline ("mean per-class AEU
   accuracy") is mean per-class RECALL — precision is excluded, so a hallucinating model scores
   well while degrading the product (a spurious koma is a real pitch error). Baseline already
   shows it: komaSharp precision **21%**, komaFlat **54%**. Report mean **F1** alongside;
   ship criteria carry precision floors.
4. **`--oversample-tup` is a precision risk, keep it MODEST.** The baseline tup3 problem is
   precision (15%, recall 93%): the model fires `\tup3` on ordinary beamed/tie'd groups. Raising
   the tup3-positive prior can worsen precision — the real fix is realistic synthetic triplet
   rendering (arc + "3", stem-fix already improved this) + the abundant non-triplet negatives we
   already have. Validate tup3 on real-val **precision**, not recall.
5. **nota is the ceiling.** nota = 79% of the real pool, harder domain (baseline 60% vs neyzen
   72%), AND ~7% pitch / ~38% structural label noise. Don't over-oversample the noisy pool;
   re-audit a fresh 5% nota sample after Round 1 (planned).
6. **Ordering (locked 2026-07-20, after an external plan review): re-slice STARTS FIRST, re-render
   runs in parallel.** The two were "large and independent, pick either" — but they are not
   symmetric: the re-slice ends in a human adjudication queue (the slowest resource in the whole
   project), while the re-render is machine-bound. Open the human tail as early as possible;
   the re-render, Colab kit, and photo-exam shoot all proceed alongside it.
7. **Re-slice scope = ADDITIVE ONLY.** New windows only where old ones were dropped
   (split_wide / over_budget rows; k=1 windows for tuplet pieces). Promoted strips are NEVER
   re-emitted — verdicts do not carry to shifted windows, so a wholesale re-emit would re-buy
   weeks of adjudication — and the **exam is NEVER touched**: the "27 exam over-budget
   recoveries" listed earlier are **DEFERRED to a post-Round-1 exam v3** (adding strips to the
   frozen exam after the baseline was taken would break the Step-4.0 pre-registration).
8. **A/B selection = ONE pre-registered number** (see the decision rule below): free-running
   real-val **mean AEU F1**, on the hand-verified subset of val strips where available;
   tie-break = the arc-triggered false-`\tup3` rate. "AEU and precision" was too vague to be
   binding — the likely outcome is A wins recall / B wins precision, and the formula must
   exist before that result is seen.
9. **Arc-metric code lands NOW, not at exam time** — see [ship-criteria.md](ship-criteria.md); the baseline cell is filled
   by re-running the spent rung22-stemfix exam read (zero leakage). Never debug measurement
   code on one-shot exam day.
10. **Training window mix stays MIXED.** Old k≈3 promoted strips + new k=2/k=1 recoveries +
    synthetic 2–4-measure strips. Do NOT re-cut old strips to k=2: the exam and the deployed
    slicer produce k≈3 windows, so k≈3 must stay in-distribution. (Reporting note: the exam's
    crops carry OLD-slicer defects — stem-cut barlines, bisected noteheads — that the hardened
    slicer no longer produces, so the exam slightly over-measures robustness to retired
    defects; say so in `MODEL_EVAL.md`.)

**Exam discipline (hard rule): exam = baseline + FINAL only; ALL iteration on real-val.** The
baseline read is spent; every further look at exam errors leaks. Take the Step-2 exam ONCE on
the experiment winner, report per-class × per-source (style-overfit check) + F1 + the
blind-spot caveats (below), against the pre-registered criteria. `PHOTO_SHARE` likely stands
(clean rasterizations = screenshot-profile). Ship through the scripted chain (ONNX export →
int8 parity → browser gate) before it becomes the runtime in `apps/web/public/models/`.

### Step 4.2 — Round-1 init A/B RESULT (2026-07-22): Arm A (two-stage) WINS

Full numbers + caveats: `src/vision/MODEL_EVAL.md`. Both arms from BASE on `strips_v3` at the
pre-registered `--every-share 0.15`; judged on the ONE pre-registered number, free-running real-val
mean AEU F1 over the merged 271-strip real-val pool (`src/vision/make_realval_pool.py`).

- **Arm A — two-stage: MEAN AEU F1 89.2%** (stage 1 synthetic-only 6k steps → stage 2 from stage-1
  `best`, 2k steps @ lr 1e-5, real oversampled `:8` → 33.3% of the pool). WINNER.
- **Arm B — single-stage joint: 78.4%** (7k steps, real at its natural 5.9%).
- Tie-break not needed — both arms tied at 1.6% arc-triggered false-`\tup3`.

**The tup3-precision catastrophe is FIXED:** `\tup3` precision **15.1% → 97.4%**, arc-triggered
false-`\tup3` **77.6% → 1.6%** (floor ≤10%). That is the slur distractors working as designed.

**But read the margin honestly — it is LOW-N driven.** `\komaSharp` has **1 gold** in real-val and
`\kucukSharp` 21; between them they account for 10.4 of the 10.8 pp gap (a single `\komaSharp` token
is worth 6.9 pp of a 6-class mean). On the four classes with ≥30 gold the arms are effectively tied
(A 92.7% vs B 92.2%). The substantive signal is `\kucukSharp` recall 95.2% vs 61.9%; A also wins
source consistency (0.6 vs 2.8 pp) and tup3 precision. The call stands, the margin is soft.

**Two methodological fixes worth carrying forward:**
1. Stage 2 initially used the real pools at their natural 5.9% share → **each real strip seen <1×**
   in 2,000 steps, which could never reproduce the Round-0.5 effect the arm exists to test. Caught
   before running; `:8` oversampling makes it a genuine specialisation phase. Without it Arm A was
   just "Arm B with a warm start".
2. `best` is picked on a synth-dominated val mix (4,772 synth vs 271 real), so it need not be best
   for real pages. Verified in both arms that it was; stage 2 then overfit (real 0.0937 → 0.0968),
   the expected cost of oversampled real, and `best` caught the turn.

**Observed trade-off to carry forward: `\tup3` recall dipped as precision soared** — A 84.1% vs
B 93.2% (44 real-val gold) vs baseline 92.7%; the distractors bought precision partly with recall.
As tup3 F1, B is actually slightly ahead (92.1% vs ~90.3%); both clear the precision floor, which
is the pathology that mattered. Measurable at the exam too (v2.1 carries 55 tup3 gold / 38 strips
after the tuplet exam extension, [labeling.md](labeling.md) §1c) — watch whether the winner's recall dip persists there.

**Still owed:** the exam, ONCE, on Arm A at `s`=0.15, then the ship chain — **the every-share
sweep was CANCELLED later the same day, before any sweep run** (decision block below).

#### ⛔ Every-share sweep CANCELLED (2026-07-22, before any sweep run)

**Decision:** both remaining sweep runs are cancelled. `s` ships at its **pre-registered default
0.15** — nothing is selected, so the cancellation cannot flatter any result. Next = exam ONCE on
Arm A → ship chain (ONNX → int8 parity → browser gate). `s` is not re-tuned in Round 1.

**Why (measured, not preferred):**

1. **Power, measured empirically:** the largest intervention available in this round (the init
   A/B — two-stage vs single-stage, real share 33.3% vs 5.9%) moved the amended selection metric
   by **0.5 pp** (92.7 vs 92.2). The sweep is a strictly subtler intervention; its arms would
   land inside noise, and the protocol's argmax would then record a coin flip as a *measured
   selection* carried into a one-shot exam — actively harmful, not merely wasteful.
2. **The premise collapsed before `s` got a vote:** the pathology the sweep was built to tune
   away is already fixed on the selection set — `\komaFlat` F1 **93.7 in BOTH arms** (baseline
   precision 53.8%), fixed by the carry-dominant re-render + conventional signatures themselves.
   A null sweep result is therefore 3-way ambiguous (not-distributional / underpowered / nothing
   left to move) and the mechanism question is unanswerable here. The as-rendered 26.7% arm
   retains only one-sided diagnostic value (re-provoking hallucination) but cannot separate the
   two mechanisms — both predict the same direction there — so it forks no decision.
3. **Protocol-bug admission (the memo's C4):** the 2026-07-22 amendment was internally
   inconsistent — "the 0.15 cell is already filled" (6k stage 1) and "stage 1 shortened to
   ~3–4k, identical across arms" cannot both hold; run as written, `s` would have been
   confounded with stage-1 length. Logged as a bug in this file's own protocol; moot under
   cancellation.

**Pre-registration integrity ruling** (the memo's §6.1, ruled on explicitly): the cancellation
is a legitimate amendment because (a) it reverts to the pre-registered default rather than
selecting anything; (b) its grounds are a *power measurement*, not an outcome preference; and
(c) everything pre-registration actually protects — Step-4.0 floors verbatim, one-shot exam,
selection never on the exam — is untouched. **Power criterion pre-registered for all future
sweeps:** a tuning sweep only runs if its minimum interesting effect exceeds the measured
movement of the selection metric under the largest prior intervention (currently 0.5 pp).

**Replacement diagnostic (pre-registered here; free, no training run) — the degraded-strip
probe:** run the EXISTING Arm-A checkpoint on real-val strips deliberately degraded
(blur/fade, `src/vision/augment.py` transforms) and compare accidental emission rate +
per-class precision against the clean read. The original hypothesis predicts hallucination
returns under ambiguity; if it does, that is evidence the mechanism is distributional —
admissible for Round-2 design as a proxy claim (real-val only), at minutes of cost instead of
two training runs.

**Carried to Round 2:** (a) **deconfound the renderer** instead of re-sweeping the conflated
`s` — render transposed-carry and/or accidental-thinned every strips so accidental rate and
transpose exposure vary independently; (b) the additive-only re-slice enlarges real-val — the
actual fix for the power problem; (c) the `\komaSharp` exam floor (18 gold, baseline 21%,
floor ≥70%) remains an acknowledged, un-de-riskable-before-exam leap of faith — the sweep
could not have de-risked it either (real-val cannot see the class).

### Step 4.3 — Round-1 EXAM TAKEN (2026-07-22): ⛔ does NOT pass — full numbers in `MODEL_EVAL.md`

> **UPDATE 2026-07-25 — gold re-audited, exam re-scored.** A full hand-audit of the 327 clean exam
> strips (the gold was already ~82% reviewed via `examv2-review`; only **13 new label errors** found —
> the gold over-sizes sharps, e.g. `\buyukSharp`/`\komaSharp`→`\bakiyeSharp`). After correcting them
> (`scripts/rung3/apply_exam_fix.py`; backup `manifest.jsonl.bak-precorrect`), the re-score is **AEU
> recall 66.3→78.5%, F1 66.5→78.0%** — BUT ~11 of the 12pp is a **metric artifact**: `\buyukSharp`
> (n=3, 0% recall) corrected to n=0 drops out of the per-class mean; token-level barely moved (SER
> 0.060→0.059, exact 49.2→50.0%). Lessons: the per-class-mean headline is fragile to low-n classes
> (exam-v3 must floor/weight by n), and the R1 "fail" was **partly** a low-n label artifact, not
> wholesale bad labels — the `\komaSharp`/`\kucukSharp` weakness is real (F1 ~49/73% on corrected gold).

The one-shot read is **spent**. Arm A on the frozen 352-strip exam v2.1, run locally (exam strips
never went to the training box, per `make_round1_colab_zip.sh`). Pre-flight from gold labels alone
re-confirmed the freeze: 352 strips, arc denominators **85 / 229**, tup3 55 groups / 38 strips,
per-class gold identical to the Step-4.0 table.

**Headline: mean AEU recall 66.6% (floor ≥85%), mean AEU F1 67.0% (floor ≥80%) — FAIL.** Five floors
missed: headline recall, mean F1, `\tup3` recall (92.7 → 72.7%, floor ≥85%), `\kucukSharp` recall
(58.1%, floor ≥75%), `\komaFlat` precision (66.2%, floor ≥70%). Passed: `\tup3` precision
15.1 → **93.0%**, **arc-triggered false-`\tup3` 77.6% → 0.0%**, SER 0.147 → **0.059**, exact
17.3 → **49.1%**, per-source gap 12.5 → **0.3pp**.

**Three things this read established:**

1. **The slur-distractor fix is total** — 0/85 arc strips emit a false triplet, and the per-source
   gap collapsed to 0.3pp (style overfit gone; nota fully caught up with neyzen).
2. **Real-val was wildly optimistic: 95.0% AEU / 89.2% F1 → 66.6% / 67.0% on the exam — a ~28pp
   gap.** Both pools are piece-disjoint, so this is not piece leakage; real-val pieces sit inside
   publications/editions the model trained on, exam pieces were held out wholesale. **Standing rule
   from now on: real-val orders candidates, it does NOT predict exam performance.** (This also
   retroactively supports the sweep cancellation — a metric this loosely coupled could not select.)
3. **The headline is LOW-N-dragged and stays that way.** `\buyukSharp` (3 gold) 0.0% recall and
   `\komaSharp` (18 gold) recall REGRESSED 83.3 → 55.6% cost ~20pp of the 7-class mean; on the five
   ≥20-gold classes the means are 82.2% / 84.0%. Per the Step-4.0 blind-spot rule LOW-N classes stay
   **inside** the means — the 5-class figure is diagnostic only and **the verdict remains FAIL**.

**New failure modes to attack in Round 2** (from the error dump): (a) `\komaSharp` ↔ `\kucukSharp`
signature confusion in BOTH directions on the same piece — the dominant kucukSharp/komaSharp loss;
(b) **`\tup3` → `\grace` substitution** — having stopped over-firing triplets the model now
re-labels some real ones as grace groups, which is the tup3-recall mechanism; (c) `\tie` misses
(reported, never floored).

**Pre-registration inconsistency logged, not silently resolved:** [ship-criteria.md](ship-criteria.md)'s table floors classes
with **≥20 gold** (so `\komaSharp` at 18 carries none), while the sweep amendment referred to "the
exam's ≥70% komaSharp-precision floor". **[ship-criteria.md](ship-criteria.md) is binding**; komaSharp is scored and reported,
floor-free.

**Consequences (Step-4.0 decision rule, applied):** no ship — the ship chain runs only on a clean
pass. The exam is **NOT re-run**; diagnosis moves to real-val, and any further exam read is labelled
in `MODEL_EVAL.md` as a **second look with its leakage acknowledged**. The fresh 5% nota label
re-audit runs regardless of the failure.

### Step 4.4 — Round-1 disposition + Round-2 entry plan (DECIDED 2026-07-23)

**Decision: ship Round 1, but label it "an improvement, not a pass."** On our honest test (the exam)
it scored **66.3%** on the hard note-marks — below our **85%** target, and it missed 5 of our targets
plus a check on the fake-data score. But it beats the old live model on every measure we track: it
fixed a bad bug that used to rewrite rhythms (fake-triplet errors, **77.6% → 0.0%**), it makes far
fewer mistakes overall (error rate 0.147 → 0.060), it gets whole strips exactly right much more often
(17% → 49%), and it reads triplets far more precisely (15% → 93%). Keeping the old, worse model live
just to honour a "don't ship unless it passes" rule would hurt users — that rule exists to block
*bad* models, and this one is *better*. So we ship it through the usual export-and-check steps, and we
write in `MODEL_EVAL.md`, plainly, that it improved things but did not meet the Round-1 targets, so
Round 2 continues. (This is a deliberate "improvement ship," clearly marked — different from a clean
pass, which is what the Step-4.0 rule was about.)

> The Round-2 entry plan that followed this decision moved to [round2.md](round2.md).

### Step 4.4a — Plan-review addenda (2026-07-23, adopted BEFORE Round-2 execution)

A plan review (Claude, in-repo, full session record) accepted these amendments to the Step-4.4
entry plan. They reorder nothing expensive — every early item is free or near-free — but three of
them gate the design of the expensive steps, so they run first.

> **Status (2026-07-23): items 1–4 EXECUTED, 5/7/9 retained as commitments, 6 & 8 DROPPED by the
> user.** Item-1 findings + item-4 probe: `src/vision/MODEL_EVAL.md` "Round-2 run-first
> diagnostics". Item 2 (guard) shipped in `train.py` + `data.py`; item 3 (canonical split)
> shipped as `data.is_real_val_piece`. **⚠ The item-1 result partly re-opens dropped item 6 —**
> see item 6's note.

**Run-first block (all free; before the photo shoot and before any rebuild/recovery emit):**

1. **Decompose the 28pp real-val↔exam gap from the SPENT exam read — it gates the rebuild
   design.** The record carries TWO different explanations demanding different fixes: Step 4.3
   says *edition familiarity* (real-val pieces sit inside editions the model trained on); Step 4.4
   says *composition* (real-val = the nd-gated easy pool, exam ~41% hard-tail). Regroup the
   existing exam per-strip results by tier (easy vs `row_unaligned`/`nd_high`-like hard tail) and
   score the subsets separately — a regrouping of an already-spent read, not a new exam look, so
   zero leakage. Reading: exam easy-tier strips score ~90%+ → composition dominates and the
   planned hard-tail re-split fixes the lie; easy-tier ALSO lands ~70% → edition familiarity
   dominates and the rebuilt real-val must be **edition-disjoint**, not merely hard-tail-inclusive
   (hard-tail alone would keep lying).
2. **The train-time disjointness guard moves UP — it lands NOW, not with exam v3.** The
   contamination root cause was "the guard is emit-time only and nothing re-validates when pools
   grow" — and Round 2 grows pools again (hard-tail recovery, real-val rebuild, possible new
   sources), so deferring the guard re-arms the same trap. `train.py` refuses to start if any
   real-pool piece (matched on **SymbTr piece id**, never image stem) appears in `testset.json`.
   A few lines; blocks a recurrence class, not one bug.
3. **Hard-tail partition rule, written before either consumer starts.** The same
   `row_unaligned`/`nd_high` strips are wanted by BOTH the rebuilt real-val and the training
   recovery; a strip may serve exactly one. Fix the split rule (e.g. piece-hash, like the existing
   real-val split) before the rebuild or the recovery emit touches the pool — this is the same
   failure shape as the exam contamination, one level down.
4. **Run the degraded-strip probe BEFORE the real-val rebuild.** `src/vision/degrade_probe.py`
   (built, not yet run) is defined over the current 271-strip `_realval`; rebuilding first orphans
   its L0 clean control. No training involved — build the ladder, 5 evals, report.

**Design amendments to the redirect-checks themselves:**

5. **The photo exam reports TWO numbers, not one:** (a) **slicer yield** — the share of photo
   strips that align to the frozen labels at all; (b) **AEU/F1 on the aligned strips only**. A
   single collapsed score conflates the two bottlenecks (slicer/photo robustness vs accidental
   recognition) — which is exactly the distinction the redirect decision exists to make.
6. **⛔ DROPPED by the user (2026-07-23) — but PARTLY RE-OPENED by the item-1 finding.** As
   written: hand-verify the rebuilt real-val's hard tail (noisy gold can penalize a correct model).
   Dropped to keep the rebuild a cheap re-split, not a labeling pass — defensible because real-val
   is for ORDERING candidates, and ordering tolerates label noise better than absolute scoring.
   **However**, item 1 measured a concrete inflation this decision reintroduces: real-val's mid tier
   scores 91.9% vs the exam's 63.0% on the same provenance category, largely because ~45% of it is
   `acc_disagreement` strips whose **labels ARE the decode** — the model scores high by reproducing
   its own read. A rebuilt real-val that keeps decode-derived labels re-inflates the same way. So
   the cheap, non-labeling residue of item 6 is retained as a rule: **EXCLUDE decode-derived
   (`acc_disagreement`, decode-sided) labels from the rebuilt real-val metric pool** — no human
   time, just a filter. Full hand-verification stays dropped.

**Forward commitments (cheap to write now, expensive to improvise later):**

7. **Exam v3 owes a bridge read:** when v3 exists, run `round1-best` on it ONCE to set the new
   baseline — legitimate (round1-best never selected on v3) and required for the Round-2 delta to
   mean anything across the exam change.
8. **⛔ DROPPED by the user (2026-07-23) — no pre-registered pivot trigger.** As written: if the
   Round-2 exam closes < half the remaining gap to the 80% F1 floor (< 73.3% today), promote the
   correction-loop product pivot to primary. Dropped — consistent with the plan-review critique that
   the "< half" line inherited an unproven premise (that Round-2 levers are ≥ Round-1's, when Round
   1's gain was partly the one-time synthetic→real jump that cannot recur) and keyed a
   six-floor ship decision on one metric. **The pivot stays available as a SITUATIONAL call** after
   the Round-2 exam + the item-1-informed real-val, not a bound number. The correction-loop pivot
   itself remains a live option (Step 4.4 alternatives). Consequence accepted: no automatic guard
   against a sunk-cost "one more round" — the decision is made with eyes open each round.
9. **Logged, not mandated — tie-token loss masking.** Training continues on labels whose tie
   structure is ~38% noisy; ties carry no floor (correct), but `\tie` misses are a listed exam
   failure mode, and noisy gold may be actively teaching wrong tie behavior. Consider masking tie
   tokens from the loss on noisy-pool strips in Round 2. Heavier intervention — evaluate, don't
   assume.
