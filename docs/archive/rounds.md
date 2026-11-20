# History — training rounds 1 to 3

purpose: HISTORY ONLY, do not act on it: Rounds 1–3 — criteria, A/B runs, exam results, the re-render, the levers, the tuplet mark, the parked follow-ups
audience: anyone who needs to know why something is the way it is
updated: 2026-11-20

> ⛔ **ARCHIVED — history only. Never act on anything here;** current state is in [STATUS.md](../STATUS.md).

**Merged into this file on 2026-11-20:**

- [Round 1 — the first fine-tune on real pages (Step 4)](#round-1--the-first-fine-tune-on-real-pages-step-4) — was `docs/archive/rounds/round1.md`
- [Round 2 — photo axis, the sharp fix, and what is still open](#round-2--photo-axis-the-sharp-fix-and-what-is-still-open) — was `docs/archive/rounds/round2.md`
- [Synthetic re-render — `strips_v3` and the accidental-distribution findings (Step 4.1)](#synthetic-re-render--strips_v3-and-the-accidental-distribution-findings-step-41) — was `docs/archive/rounds/rerender.md`
- [Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim](#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim) — was `docs/archive/rounds/ship-criteria.md`
- [Round 3 — the notes themselves: where they sit and how long they are](#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are) — was `docs/archive/rounds/round3.md`
- [Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) — was `docs/archive/rounds/round3-criteria.md`
- [Round 3 — the worklist, item by item](#round-3--the-worklist-item-by-item) — was `docs/archive/rounds/worklist.md`
- [The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) — was `docs/archive/rounds/levers.md`
- [The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL](#the-scan-profile--round-3s-first-trained-arm-lever-7--null) — was `docs/archive/rounds/scan-profile.md`
- [The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES](#the-staccato-distractor--round-3s-arm-2-lever-6--passes) — was `docs/archive/rounds/staccato-arm.md`
- [Tuplets — why `\tup3` recall keeps missing its floor](#tuplets--why-tup3-recall-keeps-missing-its-floor) — was `docs/archive/rounds/tuplets.md`
- [Follow-ups — the correction loop, parked ideas, watch-items, data layout](#follow-ups--the-correction-loop-parked-ideas-watch-items-data-layout) — was `docs/archive/rounds/followups.md`
- [The tuplet review queues — finished and promoted (2026-08-11)](#the-tuplet-review-queues--finished-and-promoted-2026-08-11) — moved from `docs/rung3/labeling.md` on 2026-11-20


## Round 1 — the first fine-tune on real pages (Step 4)

*Was `docs/archive/rounds/round1.md` (last updated 2026-07-23).*

> Part of the real-page track — index: [README.md](rounds/README.md). Current state and next action are NOT here: see [../STATUS.md](STATUS.md).
Numbers: [../METRICS.md](METRICS.md). Decisions: [../DECISIONS.md](DECISIONS.md).

> Split for readability: the pre-registered floors live in [rounds.md § Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim](#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim)
> (Step 4.0) and the corpus rebuild in [rounds.md § Synthetic re-render — `strips_v3` and the accidental-distribution…](#synthetic-re-render--strips_v3-and-the-accidental-distribution-findings-step-41) (Step 4.1).

### Step 4 — Round 1: fine-tune on everything matched + the first honest number

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
   `--every-share 0.15`; the every-share sweep then runs on the winning recipe ([rounds.md § Synthetic re-render — `strips_v3` and the accidental-distribution…](#synthetic-re-render--strips_v3-and-the-accidental-distribution-findings-step-41),
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
9. **Arc-metric code lands NOW, not at exam time** — see [rounds.md § Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim](#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim); the baseline cell is filled
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

#### Step 4.2 — Round-1 init A/B RESULT (2026-07-22): Arm A (two-stage) WINS

Full numbers + caveats: `ml/omr/MODEL_EVAL.md`. Both arms from BASE on `strips_v3` at the
pre-registered `--every-share 0.15`; judged on the ONE pre-registered number, free-running real-val
mean AEU F1 over the merged 271-strip real-val pool (`ml/omr/make_realval_pool.py`).

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
after the tuplet exam extension, [labeling-collection.md](rounds/labeling-collection.md) §1c) — watch whether the winner's recall dip persists there.

**Still owed:** the exam, ONCE, on Arm A at `s`=0.15, then the ship chain — **the every-share
sweep was CANCELLED later the same day, before any sweep run** (decision block below).

##### ⛔ Every-share sweep CANCELLED (2026-07-22, before any sweep run)

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
(blur/fade, `ml/omr/augment.py` transforms) and compare accidental emission rate +
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

#### Step 4.3 — Round-1 EXAM TAKEN (2026-07-22): ⛔ does NOT pass — full numbers in `MODEL_EVAL.md`

> **UPDATE 2026-07-25 — gold re-audited, exam re-scored.** A full hand-audit of the 327 clean exam
> strips (the gold was already ~82% reviewed via `examv2-review`; only **13 new label errors** found —
> the gold over-sizes sharps, e.g. `\buyukSharp`/`\komaSharp`→`\bakiyeSharp`). After correcting them
> (`ml/labels/apply_exam_fix.py`; backup `manifest.jsonl.bak-precorrect`), the re-score is **AEU
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

**Pre-registration inconsistency logged, not silently resolved:** [rounds.md § Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim](#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim)'s table floors classes
with **≥20 gold** (so `\komaSharp` at 18 carries none), while the sweep amendment referred to "the
exam's ≥70% komaSharp-precision floor". **[rounds.md § Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim](#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim) is binding**; komaSharp is scored and reported,
floor-free.

**Consequences (Step-4.0 decision rule, applied):** no ship — the ship chain runs only on a clean
pass. The exam is **NOT re-run**; diagnosis moves to real-val, and any further exam read is labelled
in `MODEL_EVAL.md` as a **second look with its leakage acknowledged**. The fresh 5% nota label
re-audit runs regardless of the failure.

#### Step 4.4 — Round-1 disposition + Round-2 entry plan (DECIDED 2026-07-23)

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

> The Round-2 entry plan that followed this decision moved to [rounds.md § Round 2 — photo axis, the sharp fix, and what is still open](#round-2--photo-axis-the-sharp-fix-and-what-is-still-open).

#### Step 4.4a — Plan-review addenda (2026-07-23, adopted BEFORE Round-2 execution)

A plan review (Claude, in-repo, full session record) accepted these amendments to the Step-4.4
entry plan. They reorder nothing expensive — every early item is free or near-free — but three of
them gate the design of the expensive steps, so they run first.

> **Status (2026-07-23): items 1–4 EXECUTED, 5/7/9 retained as commitments, 6 & 8 DROPPED by the
> user.** Item-1 findings + item-4 probe: `ml/omr/MODEL_EVAL.md` "Round-2 run-first
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
4. **Run the degraded-strip probe BEFORE the real-val rebuild.** `ml/omr/degrade_probe.py`
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


## Round 2 — photo axis, the sharp fix, and what is still open

*Was `docs/archive/rounds/round2.md` (last updated 2026-07-27).*

### Result — exam read once, 2026-07-27: SHIPPED as an improvement, not a pass

**Headline regressed, everything else improved.** On the identical 326-strip clean set with the
same re-audited gold: mean AEU F1 **78.0 → 73.9%**, while SER (0.059 → 0.052), exact-match
(50.0 → 52.1%) and 9 of the 11 pre-registered floors moved the right way. Numbers, floors table and
the print-position split: [../METRICS.md](METRICS.md).

**The diagnosis was right; the correction was incomplete.**

- Removing the label noise did what it was supposed to: the one-directional küçük→koma fallback is
  **gone**, and küçük-in-signature recall went **50 → 72%**.
- Underneath it sits a **symmetric koma↔küçük confusion, entirely inside the key signature** —
  `\kucukSharp → \komaSharp` 8×, `\komaSharp → \kucukSharp` 7×, all 15 in the `\sig` block, net
  `\komaSharp` emission 0. That is a discrimination failure, not a bias.
- It destroys `\komaSharp` (F1 21.4%) because n=14, and a per-class mean over six classes carries
  that straight into the headline. `\kucukSharp`, with 33 gold, absorbs the same coin flip and still
  reads 69.7%.
- **The lead for Round 3:** every fidelity measurement so far — `sharp_probe`, bar weight, the küçük
  pitch widened to 0.65 S — was taken on INLINE glyphs. Signature glyphs are packed at
  `SIG_GLYPH_ADVANCE = 13 px` and have never been examined, and that is where 32 of the exam's 33
  küçük tokens are printed.

Attribution caveat, stated before the run and still binding: this round changed the glyph weight AND
removed the label noise AND added pieces, so no single one of them owns the movement.

#### Post-read analysis (2026-07-27) — what Round 3 should actually target

Re-scoring and an edit-budget breakdown changed both the verdict and the direction. Full numbers in
[../METRICS.md](METRICS.md); the short version:

- **Round 2 was never a regression.** Under low-n-robust headlines it is flat-to-better (micro recall
  83.9 → 84.8%, macro≥30 recall 81.4 → 84.8%). The −4pp was `\komaSharp` (n=14) inside a six-class
  mean. The not-shipped decision is overturned.
- **Accidentals are 13% of what a user fixes.** Pitch 40%, duration 28%. Two rounds went into the
  13%, because the old headline only measured accidentals.
- **12 strips carry 21% of all edits**, and the worst are a crop-shape gap: signature-only crops
  occur 0 times in 40,826 training strips but 4 times in 326 exam strips.
- **Gold octave errors are real but ~1% of edits**, and the training pools are clean — closed as a
  non-lever rather than left as a suspicion.

So Round 3 is a **pitch-and-duration** round, opening with the crop-shape fix (no training needed)
and a corpus-vs-real distribution measurement before anything is rendered. The signature-glyph
fidelity work stays owed but drops below both, being a 13%-of-edits problem.

#### Ship (2026-07-27) — `round2-stage2-best` int8 became the live runtime

⚠ **It is no longer the live runtime**: Round 3 Run A `best-real` replaced it on 2026-09-03. Current
state is [../STATUS.md](STATUS.md)'s job, not this file's.

The re-scoring reopened the ship decision and the owner took it: same disposition as Round 1, an
**improvement ship, not a pass** — the macro floor is still failed, and that is written down rather
than rounded up ([../DECISIONS.md](DECISIONS.md)).

Chain, all green: ONNX export → int8 (221 MB) → `onnx_parity.py` **14/14 fp32 + 14/14 int8** →
`make_browser_gate.py` → browser gate **27/28**, with the product (canvas) path a clean 14/14. The
gate list was rebuilt from `strips_v4` **val** pieces because the Colab checkpoint arrived without
one. Export details, the gate-strip method and the one failing strip: [../METRICS.md](METRICS.md)
and `../../ml/omr/MODEL_EVAL.md`.

**Carried forward, not fixed:** the browser miss is an ORT-web wasm int8 numerics wobble (Python-ORT
int8 reads the same strip exactly). It is now the second instance — Round 1's was a double dot, this
one drops a `\tup3` — so the open investigation gains a second case. Round 1's double-dot strip
passes on this model.

> Part of the real-page track — index: [README.md](rounds/README.md). Current state and next action are NOT here: see [../STATUS.md](STATUS.md).
Numbers: [../METRICS.md](METRICS.md). Decisions: [../DECISIONS.md](DECISIONS.md).

### Entry plan (decided 2026-07-23, after the Round-1 disposition in [rounds.md § Round 1 — the first fine-tune on real pages (Step 4)](#round-1--the-first-fine-tune-on-real-pages-step-4))

**Round 2 starts with two cheap checks that could change our whole direction — so we do them first:**

1. **Photo test (free, could change everything).** Real users take phone photos (shadows, angles,
   blur), but every score so far is from clean PDF pages. Print the merged exam pages
   (`00_ALL_25_MERGED.pdf`), photograph them (see the photo-exam section below), and run the model. If the photo score is
   far below 66%, the real bottleneck is handling messy photos — not reading the note-marks — and our
   current plan is aimed at the wrong problem.
2. **Rebuild our everyday score (the quick check we call "real-val").** It said 95%, but the real exam
   said 66% — the everyday score was lying, because it only used easy pages while the exam has ~41%
   hard ones. This is just a re-split of pages, not new labeling. Until it's fixed, every Round-2
   choice rests on a number that lies. Rule from now on: the everyday score can *rank* two models
   against each other, but it does NOT predict the real exam score.

> **Added 2026-07-23 (details in [rounds.md § Round 1 — the first fine-tune on real pages (Step 4)](#round-1--the-first-fine-tune-on-real-pages-step-4), plan-review addenda):** before those two checks, a few free tasks run first —
> split the 66-vs-95 gap by page difficulty (to learn whether the rebuilt everyday score also needs
> different *editions* of pieces, not just harder pages); add a safety check that refuses to train if
> an exam piece leaks into training; write the rule for how shared hard pages get split; and run the
> "blur test" on the current everyday score. The photo test also reports two separate numbers: how
> many strips it could even line up, and the accuracy on those.

**Then, once those checks land, the training work** (all still open, and clearer after the checks):
- ⛔ **The "invented mark" bug — DROPPED as a Round-2 priority (user decision, 2026-07-25).** It was
  listed here as "the fastest model fix": the model adds flat-family marks that aren't printed (worst
  on 'si'), and it reproduces on synthetic data. Dropped because the evidence moved: on the
  hand-labelled photo gold and the corrected clean gold the **flat family is now healthy**
  (`\kucukFlat` F1 92%, `\bakiyeFlat` 89%, `\natural` 89%), and the degrade probe ([rounds.md § Round 1 — the first fine-tune on real pages (Step 4)](#round-1--the-first-fine-tune-on-real-pages-step-4), addenda item 4)
  showed the hallucination is not ambiguity-driven, so a renderer fix was never the lever. The whole
  remaining accidental weakness sits in the **microtonal SHARPS**. Kept only as a logged synthetic
  defect (`MODEL_EVAL.md` "carry-bug"), not scheduled work.
- **✅ Sharp-size discrimination DIAGNOSED + FIXED AT SOURCE (2026-07-26) — it was a RENDERER
  FIDELITY bug, not resolution and not teaching volume.** `\komaSharp` F1 ~50% and `\kucukSharp`
  recall 48% at **100% precision** — the model UNDER-fires the small sharps, so it was failing to
  *see* the difference, not failing to be careful. Diagnosis, in order:
  - **Resolution RULED OUT.** `ml/labels/sharp_width_test.py` regroups the already-scored strips
    by the encoder's effective scale (DonutImageProcessor `align_long_axis → thumbnail → pad` into
    409×583; strips are 336px tall and 579–2472 wide, so the scale runs 1.22 → 0.24). If shrinking
    were the cause, recall would fall with scale. It does not, on EITHER dataset: clean-exam
    koma/kucuk are 62/67% at scale 0.45–0.60 vs 50/53% at 0.60+, and photo gold has the same shape.
    `\bakiyeSharp` sits at 84–94% in **every** bucket — the deficit follows the SYMBOL, not the size.
    So narrowing strips (the expensive lever) would not have helped. *(Logged, not chased: ~⅔ of the
    encoder's input window is blank padding, because a 4:1 strip fits a 1.43:1 box.)*
  - **The error is ONE substitution, one-directional:** gold `\kucukSharp` decoded as `\komaSharp`
    **11× on the clean exam and 10× on the photo strips** — the single most common error in both, and
    koma→kucuk essentially never happens. That matches the 100%-precision signature exactly: when
    unsure, fall back to the class seen 9× more often.
  - **Root cause = Bravura's glyph weight.** The AEU sharps are ONE systematic design — 1–2 vertical
    stems crossed by 2–3 slanted bars — so reading them IS counting bars. Measured against two real
    printed editions at matched staff size (`data/real/rung3/sharp_probe/`): real print draws a
    **0.300 S** bar, Bravura **0.367 S**, and Bravura also packs küçük's three bars **0.483 S** apart
    where real print leaves **0.550 S**. Compounded, Bravura leaves küçük a **0.116 S** white gap vs
    the real **0.250 S** — ~1–2px after the encoder shrink, so the three bars fuse into a block and
    the glyph *is* a 2-bar koma. koma/bakiye were never at risk (0.58–0.66 S gaps). Real print also
    draws küçük's top/bottom bars stubby (0.73 S) either side of a full-width middle bar, where
    Bravura's three are near-equal — which is what kills the staircase a reader recognises.
  - **FIX SHIPPED (opt-in): `drawThinSharps` in `SheetView.tsx`** redraws all four AEU sharps as SVG
    at real-print bar weight (0.300 S), keeping each glyph's Bravura proportions so the shapes stay
    familiar. Applied to all four, not just the broken one, so **bar COUNT stays the only
    difference** — thinning küçük alone would hand the model a thickness cue real pages lack.
    küçük's pitch is set to **0.65 S**, deliberately wider than the real 0.550 S (domain-expert call
    off `sharp_probe/kucuk_pitch_options.png`) to clear the shrink with margin while staying far from
    koma's 0.94 S. Wired as `?thinsharps=1` (App.tsx) and `--thin-sharps` (render.ts), **off by
    default so an A/B against `strips_v3` stays possible.** Flats untouched (89–92%, healthy).
    Verified in-browser: every AEU sharp replaced, 0 left on Bravura. Residual: büyük keeps a 0.21 S
    gap (its 0.51 S pitch is Bravura's) — n=3 in the exam, revisit only if it shows up.
  - **⛔ The "FREQUENCY imbalance" follow-up was aimed at the wrong context — corrected 2026-07-26.**
    It read: inline, `strips_v3` has `\komaSharp` in 1,887 strips vs `\kucukSharp` in 206, zero
    strips carry both, so balance the counts and put the three sharps on neighbouring notes. All
    true, and all about a context the exam barely contains. Splitting every gold label by print
    position (numbers in [../METRICS.md](METRICS.md)) shows küçük is scored **32:1 inside the
    row-start key signature**, and the carry serializer's `sigTolerant` rule explains why: a note
    whose alteration runs the same direction as the signature's is printed **bare**, because SymbTr
    stores the sounding value (eviç = a 5-comma F♯ printed bare under a koma-sharp-F signature).
    Confirmed by dry render — two küçük-heavy pieces under non-küçük signature variants produced
    **zero** inline `\kucukSharp`. In the signature context the corpus is already balanced (küçük
    1,210 strips vs koma 1,422).
  - **✅ AND A SECOND CAUSE, found the same day: the carry pages drew accidentals their labels did
    not mark.** `sigTolerant` lived on the label side only, so `SheetView` marked every deviation
    from the signature while the serializer wrote the note bare. **18.8% of v3's signature-bearing
    carry strips** are affected, worst of all `\kucukSharp`: **2,369 drawn-but-unlabelled against 234
    labelled correctly — 91% of the küçük sharps drawn on a notehead were labelled as nothing.**
    Training on that teaches exactly the observed behaviour (48% recall at 100% precision). Fixed by
    giving the drawing the same rule — owner decision, because real editions print bare. Counts in
    [../METRICS.md](METRICS.md). `round1-best` trained on the un-fixed corpus, so its sharp
    numbers carry label noise as well as glyph weight, and nothing measured so far separates them.
  - **What replaces it:** the corpus gap is **diversity, not count** — signature-position küçük
    comes from only 3 makams (mahur, nisaburek, süzidilara) in 4 spellings, so the model can learn
    "this makam ⇒ this donanım" instead of reading the glyph. Round 2 therefore re-renders with
    `--thin-sharps` (the glyph fix helps both print positions), adds küçük-bearing pieces, and
    adds küçük-bearing pieces. The Round-1-era "boost komaSharp share" item stays overturned; the
    enharmonic-respell idea was dropped before use (see [../DECISIONS.md](DECISIONS.md)).
    A generated signature-drill set was also **dropped**: across every adjudicated real signature we
    hold, `\kucukSharp` appears on **f and nowhere else** (104 occurrences), so a drill would have to
    print accidental/letter pairs no edition prints.
  - **✅ `strips_v4` BUILT (2026-07-26)** — 40,841 strips / 202 pieces, thin sharps + the pixels-vs-
    labels fix + 23 küçük-bearing pieces − 5 exam pieces; audit PASS, Mac train smoke PASS; val is
    `split_v3`'s verbatim so the v3 A/B stays matched. Sizes in [../METRICS.md](METRICS.md).
  - **✅ Scorers now split recall by print position** (`score_photo_gold.py`,
    `score_clean_baseline.py` via `score_photos_exam.tally`): on the photo gold küçük reads **50% in
    the signature** (22 gold) where `\bakiyeSharp` reads 83% in the same position — the deficit
    follows the glyph, not the position. Headline unchanged (73.7% / 75.9%), so the split is
    additive.
- **Recover the hard pages we had to drop** — many real strips were dropped earlier because the old
  reading model couldn't line them up. The Round-1 model reads better, so it can recover them into
  training. This is our biggest source of new data. It needs human checking, our slowest step, so
  start it early.
- **A refreshed exam ("v3")** — with the safety check built in and better coverage of the rarest
  marks, built from the cleaned exam pages.

**Safety fixes the new exam owes** (because Round 1's exam accidentally shared 4 pieces with
training): (a) make training refuse to start if any training piece is also an exam piece; (b) re-check
this every time the exam or the page collection grows; (c) match pieces by their music ID, not the
image file name.

**Other paths we considered but did NOT pick as the main plan** (kept as backups if the checks or
Round 2 stall): collect many more pages from new sources; pivot the product toward "model drafts, a
human quickly fixes" (66% plus a fast editor may beat chasing 85% fully automatic); or reconsider the
whole model approach (only if another round barely moves the number).

#### Step 4.5 — Photo-exam axis (second, product-domain exam; zero labeling cost)

> **DONE 2026-07-24..25 (results).** 39 photos shot. **The slicer, not the model, was the wall:** raw
> `page_to_strips.py` yielded 0 strips on 72% of photos — its `w/4` staff-detection kernel can't
> tolerate ~1.5° handheld skew. Fixed with a guarded photo front-end (all no-ops on clean scans):
> **auto-deskew + crop-to-quad/perspective de-warp + a narrower `STAFF_HOR_FRAC=0.11` detection kernel**
> (the old `w/4` had been silently dropping faint/bottom systems on clean renders too). **Yield 28% →
> 97% of pages / 106 → 690 strips.** Photo AEU ≈ **61% recall / 75% F1** (`ml/labels/
> decode_photos_exam.py` + `score_photos_exam.py`; 690 strips decoded on the M4 in ~6 min — Colab
> unneeded), first scored by fitting the curated gold onto the photo decode (an estimate). **Then the
> expert HAND-LABELLED 284 photo strips directly** (review_ui `photo-gold`; stopped there — enough to
> measure + many photos unreadable even to a human, 4% marked bad) and `score_photo_gold.py` scored
> the model against those verified labels, strict per-strip: **photo AEU recall 73.7% / F1 75.9%** (272
> scorable) — the definitive number, HIGHER than the fitting estimate (which under-counted recall).
> **Photo vs corrected-clean (~77%) gap ≈ 3–4pp → photo domain basically solved by the front-end.** The
> real weakness is MICROTONAL SHARPS (komaSharp F1 50%, kucukSharp rec 48%/prec 100% — under-fires,
> reads them as bakiye/koma), a CLEAN-domain reading issue; `|`/`\tie` are fine (90/94% F1, NOT the
> problem). → next model lever = synthetic re-render weighted toward koma/kucuk/bakiye sharp
> discrimination, not more photo labels. Aside: ~15% of TSM measures are single-but-dense >59 tokens
> (same on clean+photo — inherent density, not over-wide slicing; model reads them, 0 truncated).

> **The 284 hand-labelled photo strips stay EXAM-ONLY (settled 2026-07-25).** They are shots of the
> printed exam pieces, so training on them contaminates the exam (the train-time guard would refuse
> to start). Frozen as the photo half of exam v3. Camera-photo TRAINING data must be shot fresh from
> NON-exam pieces.

The v2.1 exam is clean PDF renders; the real product input is screenshots / **phone photos**.
The 25 exam-piece PDFs are staged + merged (`data/real/rung3/photo_exam_pdfs/`,
`00_ALL_25_MERGED.pdf`, 38 pp) to PRINT → PHOTOGRAPH → `data/real/photos_exam/` — reusing the
SAME frozen labels (same pieces), so it measures the actual deployment domain for free. Take it
once at the end alongside the PDF exam. Photo-shoot guidance in the "Photo-exam capture" note
below.

##### Photo-exam capture — how to shoot (the point is REALISM, not quality)

This exam only earns its keep if the photos look like what a real user snaps — the whole value
is the domain gap. So do NOT scan, do NOT flatten in software, do NOT shoot a perfect
overhead. Aim for the messy-but-legible middle of the real upload distribution.

- **Print first, then photograph.** A photo of a screen re-introduces moiré/backlight — a
  different (also real, but separate) domain. Print `00_ALL_25_MERGED.pdf` on plain white paper,
  one system-dense page at a time; laser or inkjet both fine.
- **Phone camera, handheld, auto everything.** The default camera app, HEIC/JPEG straight out —
  no "document scan" mode (that de-warps and binarizes, which is exactly the preprocessing we
  want to TEST, not pre-bake). Handheld, not a tripod.
- **Deliberately vary — one page ≠ one condition.** Across the 38 pages sweep: **angle** (flat
  down, plus ~15–30° oblique so staff lines converge), **lighting** (window daylight, warm indoor
  lamp, and one harsh overhead so a shadow/glare band crosses the staff), **distance** (whole page
  vs. tight on 2–3 systems), and let a couple go **slightly soft/motion-blurred** — real uploads
  are. A gentle page curl (don't press it flat) is a plus: staff curvature is a known weak link.
- **Keep it legible to a human.** The label is fixed; if YOU can't read the accidental in the
  photo, it's noise, not signal — reshoot that one. Blur/skew/shadow yes; illegible no.
- **Coverage is what matters, not count.** ~1 photo per page (≈38) is plenty; a few pages in two
  conditions is better than many identical shots. Spread the hard conditions across DIFFERENT
  pieces so no single makam/style is the only "hard" one.
- **Filenames must map to the piece.** Name each `<stem>_pNN_photo.jpg` (or keep a shot→page
  index) so the frozen labels line up — a photo we can't map to its label is unusable. Put them
  under `data/real/photos_exam/` (gitignored, like the rest of `data/real/`).
- Optional second axis if quick: a **screenshot** of a couple pages opened in a PDF viewer
  (the single most common REAL upload per `upload-distribution`) — but the printed-photo set is
  the priority tonight.

Then `page_to_strips.py` + `decode_page.py` run on these exactly like the PDF pages; the slicer's
behaviour on real perspective/curvature/shadow is itself a result worth logging (it's the
upstream weak link, and these photos are its first real stress test).


## Synthetic re-render — `strips_v3` and the accidental-distribution findings (Step 4.1)

*Was `docs/archive/rounds/rerender.md` (last updated 2026-07-21).*

> Part of the real-page track — index: [README.md](rounds/README.md). Current state and next action are NOT here: see [../STATUS.md](STATUS.md).
Numbers: [../METRICS.md](METRICS.md). Decisions: [../DECISIONS.md](DECISIONS.md).

#### Step 4.1 — Round-1 synthetic re-render (carry-dominant) ✅ BUILT 2026-07-21 + the accidental-distribution findings

##### Ordering CHANGED (2026-07-21): Round 1 FIRST, the re-slice moves to Round 2

Step 4 item 6 said "re-slice STARTS FIRST" (open the human adjudication queue early, it's the
slowest resource). **Superseded** — the re-slice now runs AFTER Round 1 and feeds Round 2. Why:

- Re-slice adjudication cost is driven by DECODER quality, not volume. SymbTr is the label, so an
  aligned window auto-accepts for free; the *review queue* — the only human cost — is populated by
  decode-vs-SymbTr disagreements (`nd_review`, `acc_disagreement`, `row_unaligned`). A weak decoder
  **manufactures false disputes** (correct label, disagreeing decode → thrown to a human anyway).
- The current labeler (`rung3-labeler`) was fine-tuned on `strips_r1` = **362 neyzen strips only**,
  but the re-slice target is **nota-dominant** (nota holds essentially all the `over_budget` drops).
  Decoding nota with a neyzen-only labeler is the *worst* time to do it. A Round-1 model that has
  trained on nota real strips is a materially better labeler → smaller, cleaner queue.
- Round 1 doesn't need the recoveries: its levers are the synthetic re-render (tup3 precision) and
  the already-promoted ~2,351 real strips. Round 1 is also an A/B *experiment* — it picks the recipe,
  it is not the maximal final model.
- This dissolves rather than contradicts the "bottleneck" argument: per-strip human cost is a
  function of labeler quality, so opening the queue early with a weak labeler costs MORE total effort.

Round-1 data scope is therefore **FROZEN**: fresh synthetic re-render + the promoted real pools.

##### Re-render design — mode/transpose policy (LOCKED with the user)

- **Carry mode** (the web app's `"measure"` = signature at row start + measure-scoped accidental
  carry; the real printed-page convention) **replaces keysig entirely** and is the DOMINANT share.
  It is signature-bearing, so it wears the makam's conventional PRINTED signature.
- Carry renders at **transpose 0 ONLY** (written pitch = the conventional signature matches the
  notation; a transposed makam signature matches no real edition). Bulked to dominance via
  `CARRY_PASSES=4` seeded augmentation passes (blur/text/repeat/nav + signature-variant variety).
- **Every mode** (no signature; every accidental inline) is the MINORITY and carries the
  **transpose augmentation** (t≠0) — pure pitch augmentation, always faithful, no signature conflict.
- `stripExport.ts` gained its first `measure`/carry branch: **all chunks kept** (not keysig's
  row-start-only), carry+sigTolerant serialization, `\sig` prefix on the row-start chunk only —
  matching how the emitter labels REAL carry strips, so synthetic and real carry agree.

##### Per-makam conventional PRINTED signatures (`data/makam_signatures.json`)

Real editions print the makam's conventional signature (donanım), which routinely differs from
SymbTr's content-derived one (`deriveKeySignature`). Built by `ml/prep/build_makam_signatures.py`
from the **adjudication-confirmed `\sig…\sigend` blocks in the promoted real labels** (source of
truth), with AEU theory only as fallback for the ~12 makams with no real sig strips.
**Variant count is UNCAPPED** — several makams genuinely print 3–4 spellings (hicaz 4, şehnaz 4,
nisaburek 3, sultaniyegah 3); the renderer samples one per pass weighted by real frequency.
Covers all 49 corpus makams (65 entries incl. aliases nihavent→nihavend, hicaz-uzzal→uzzal).
Wiring: `parseSignatureBody` (`lilypond.ts`, inverse of `serializeSignature`) →
`render.ts` seeded weighted pick → `?sig=` → `App.tsx` → BOTH `SheetView` (drawn glyphs) and
`stripExport` (label), so pixels == labels.

##### Slur distractors (the tup3-precision fix)

Previously the ONLY arc the renderer drew was the triplet mark, so the model learned "any over-note
arc ⇒ `\tup3`" (baseline tup3 precision **15%**, arc-triggered false-tup3 rate **77.6%**).
`drawSlurArc` (`SheetView.tsx`) now draws label-free phrase arcs — ≥3 notes, **no "3"**, within a
measure so a barline crop never bisects one — over a seeded ~35% of non-tuplet runs, threaded as
`slurseed`/`slurNoise`. **Pixels only**: verified 15 slurs drawn with a seed / 0 without, and
88/88 labels byte-identical to the pre-slur render.

Already in place, no change needed: realistic triplets (`drawTupletArc` + the rung2.2b stem-fix),
blur/fade (`ml/omr/augment.py`, train-time), the empty-`\sig` fix (serializer).

##### The corpus: `data/synthetic/strips_v3` (2026-07-21)

**38,091 strips** over 190 pieces / 49 makams; **73.3% carry** (27,933) / 26.7% every (10,158);
27,933 carry strips carry a signature, **33 distinct signature variants** sampled.
Budget gate PASS (longest label 57 ids, cap 59; no token drift).

##### Accidental distribution — finding + ✅ DECIDED plan (2026-07-21): train-time `--every-share` sweep

Measured the synthetic label distribution against the REAL pools (what the model must generalize to):

| | inline accidentals per strip |
|---|---|
| carry (measure) | **0.36** |
| **REAL pools** | **0.32** ✅ |
| every | **4.22** (13× real) |

**Carry mode structurally matches real — the signature work is validated.** But `every` mode is
**26.7% of strips yet produces 81% of all inline accidentals**, pushing the *effective* rate to
1.40/strip = **4.4× real**. Hypothesis (unproven, testable): this inflates the model's
"emit an accidental" prior, and on ambiguous/blurry real ink (nota = 79% of the real pool) an
inflated prior surfaces as **hallucination** — consistent with baseline komaSharp precision **21%**
and komaFlat **54%**, which Step-4.0 gates at ≥70%.

Effective mix as a function of the every-mode sampling share `s`:

| s | inline rate | mean abs dev. from real | kucukFlat | kucukSharp | komaSharp |
|---|---|---|---|---|---|
| 26.7% (as rendered) | 4.4× | 3.75pp | 4.9% | 1.9% | 5.7% |
| 15% | 2.9× | **3.32pp** | 7.1% | **2.7%** | 6.1% |
| 10% | 2.3× | 3.36pp | 8.3% | 3.2% | 6.3% |
| 5% | 1.7× | 3.69pp | 9.8% | 3.8% | 6.6% |
| 0% | 1.1× | 4.11pp | 11.7% | 4.6% | 7.0% |
| **REAL** | — | — | **19.3%** | **2.5%** | **2.1%** |

Note the criteria **disagree at the margin**: overall deviation is minimised near s≈10–15%, the
inline-rate argument pushes lower, and komaSharp gets *worse* as s falls (carry-only komaSharp is
7.0%, higher than every-mode's). Deleting every mode entirely (s=0) is measurably WORSE overall.

**On the earlier "komaSharp/kucukSharp boost" plan item — overturned by data:** komaSharp is
already OVER-represented in synth (5.7% vs 2.1% real) and is *precision*-bound, so boosting it would
backfire; kucukSharp already matches real. The genuine gap is **kucukFlat**, and its residual after
the signature fix is a **makam-mix** artifact (the real pool over-weights kucukFlat-signature makams
— nihavent/kurdilihicazkar/acemasiran) rather than a spelling bug. Down-weighting `every` lifts
kucukFlat for free (4.9% → 7–8%), so the `bakiyeSharp→kucukFlat` enharmonic respell
(`respell.ts`, the proven büyük-style mechanism) is **held**, not applied.

**✅ DECIDED (2026-07-21) — the plan, pre-registered before any Round-1 training runs:**

1. **Mechanism = train-time, not re-render.** Add `--every-share` to `train.py` (stochastic
   per-epoch sampling — `Strip` already carries `mode`, `data.py:60`; PyTorch's
   `WeightedRandomSampler` is the idiomatic tool; with-replacement, so every strip stays reachable
   across epochs). strips_v3 is a superset of every mix we'd want: sampling down is free, instant
   and reversible, while a re-render bakes in ONE guess at ~75 min and can't be retuned. **Default
   `s = 0.15`** — the mean-deviation minimum in the table above, and it keeps meaningful transpose
   exposure alive (see the confound below).
2. **Pre-registered arms: `s ∈ {26.7%, 15%, 5%}` — three, not two, because the arms are
   diagnostic.** The two candidate mechanisms make OPPOSITE predictions at 5%: the *inline-rate*
   story (hallucination prior scales with total accidental bulk) predicts monotone improvement as
   `s` falls → 5% beats 15%; the *class-mix* story (what matters is the accidental-type
   distribution matching real) predicts an optimum at ~15% with 5% nearly as bad as as-rendered
   (3.69pp vs 3.75pp) → 15% beats both ends. A {26.7, 15} pair would confirm "downweighting
   helps" but not WHICH mechanism — and the mechanism decides the Round-2 re-render design
   (rate ⇒ accidental-thinned every strips; mix ⇒ makam-mix rebalance for kucukFlat).
3. **Run budget: SEQUENTIAL, never crossed with the init experiment** (crossing = 2 inits × 3
   shares = 6 runs). First the init A/B (Step 4 item 1: two-stage vs single-stage) with `s` FIXED
   at 0.15 (2 runs), then the every-share sweep {26.7%, 5%} on the winning init recipe (2 runs —
   the 0.15 cell is already filled). **4 runs total.** Selection at every step stays the ONE
   locked number: free-running real-val mean AEU F1, tie-break = arc-triggered false-`\tup3`
   rate; the exam is taken ONCE, on the overall winner.
4. **Pre-registered confound (non-claim):** `s` scales TWO things at once — the accidental rate
   AND transpose exposure, because every mode is the sole carrier of t≠0 (carry is t0-only by
   design). At s=5% the model sees almost no transposed strips, so pitch-height↔makam
   correlations go nearly unbroken. If the 5% arm loses, we canNOT attribute the loss between
   mix-deviation and transpose starvation — accepted for Round 1 (the arms still order correctly
   for selection); deconfounding (e.g. transposed-signature carry or accidental-thinned every) is
   Round-2 re-render material.
5. **Diagnostic logging (NOT selection):** per-class real-val precision across the arms,
   komaSharp especially. Lowering `s` cuts the overall "emit an accidental" prior (should help
   precision) but RAISES komaSharp's share of synthetic accidentals (5.7% → 7.0% carry-only, vs
   2.1% real) — the class-specific prior moves the wrong way, and komaSharp is the scariest
   Step-4.0 floor (21% → ≥70%). If komaSharp precision does not move with `s`, the hallucination
   is not distributional and Round 2 needs a different lever (decode-side or hard-negative
   rendering), not more mix-tuning.

Standing risk note: mixture ratios are tuned on validation — keep the sweep to these 3 values
and let the **one-shot exam** stay the clean number.

**⚠ AMENDED 2026-07-22, before any sweep run** (full text: "Every-share sweep protocol" in
[rounds.md § Round 1 — the first fine-tune on real pages (Step 4)](#round-1--the-first-fine-tune-on-real-pages-step-4) Step 4.2): sweep selection = mean AEU F1 over the four **≥30-gold** real-val classes only (the
init A/B measured a single komaSharp token swinging the 6-class mean 6.9 pp); stage 1 shortened
to ~3–4k steps but **re-run per arm** (`s` must apply to stage 1); the komaSharp diagnostic in
item 5 is unmeasurable on real-val (n=1) → replaced by **komaFlat precision (62 gold) as the
measurable proxy**.

**⛔ CANCELLED later the same day, still before any sweep run** (decision block, full reasoning in [../log/superseded.md](log/superseded.md)):
the init A/B measured the selection
metric's power (largest available intervention → 0.5 pp) and showed the target pathology
already fixed on real-val (komaFlat F1 93.7 in both arms) — the sweep could neither select nor
diagnose. `s` ships at the pre-registered default **0.15**; deconfounding the renderer replaces
`s`-tuning in Round 2.


## Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim

*Was `docs/archive/rounds/ship-criteria.md` (last updated 2026-07-20).*

> Part of the real-page track — index: [README.md](rounds/README.md). Current state and next action are NOT here: see [../STATUS.md](STATUS.md).
Numbers: [../METRICS.md](METRICS.md). Decisions: [../DECISIONS.md](DECISIONS.md).

> Written 2026-07-20, **before stage 1 saw anything**. Round 1 was measured against exactly
> these floors; the result is in [rounds.md § Round 1 — the first fine-tune on real pages (Step 4)](#round-1--the-first-fine-tune-on-real-pages-step-4) and [../METRICS.md](METRICS.md).
> Round 2 amends this file rather than inventing new floors.

#### Step 4.0 — PRE-REGISTERED ship criteria ✅ WRITTEN 2026-07-20 (before Stage 1 saw anything)

**Status: these are the criteria, fixed before any Round-1 training ran.** Every floor below is
stated next to its measured baseline (`rung22-stemfix-best` on the frozen 352-strip exam v2.1,
`data/checkpoints/rung22-stemfix-best/eval.jsonl` last row) so the demanded delta is explicit
and auditable. Round 1's exam read is a ONE-SHOT (see "Exam discipline" above) — a pass bar
written after seeing the result is not a bar, it is a description.

**Threshold stance: ambitious but defensible.** The anchor is Round-0.5, which moved real-val
AEU **70 → 91.7%** as a real-only fine-tune on 418 strips; Round 1 has ~5.6× that real data plus
the (re-rendered) synthetic pool. A bar Round 1 clears automatically would not discriminate a
good run from a mediocre one.

##### The floors

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

##### Ties are NOT a ship criterion — the arc→`\tup3` confusion is (user decision, 2026-07-20)

A missed `\tie` is cheap: the note survives at the right pitch, the duration merge is visible in
the editor, and the **tie ground truth itself is unstable** (~38% tie/repeat structural label
noise in nota auto-accepts; hand adjudication applies `\tie` across different-pitch arcs
inconsistently — see the tup3 image-pass note in [labeling-collection.md](rounds/labeling-collection.md) §1b: "printed-arc-vs-`\tie` is user judgment; no
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

##### Blind spots — the criteria must NOT be gamed on these

- **`\buyukFlat`: 0 real gold** on the exam. Synthetic-validated only (100%/100% at 34 gold,
  Rung 2.2). **No real-page claim may be made for it**, in either direction.
- **LOW-N classes: `\komaSharp` 18 gold, `\buyukSharp` 3 gold.** Below the ≥20 threshold, so they
  carry no per-class floor — they cannot honestly support a 75% bar. They stay **inside** the
  headline and F1 means (as at baseline, so the numbers stay comparable) and are always printed
  with the LOW-N marker. Never silently dropped to flatter the mean.
- **`\tup3` gold is common-case k=1 material.** Dense contiguous-triplet instrumentals
  (sazsemaisi/longa, 90+ groups) sit in the over_budget/split_wide drops and are **unmeasured**
  until the sub-measure fragment follow-up ([labeling-collection.md](rounds/labeling-collection.md) §1c). Round-1 tup3 numbers speak for the common case
  only — say so in `MODEL_EVAL.md` when reporting.
- **The exam is an upper bound.** Matched, emit-alignable pages only (`caveat:
  matched-upper-bound` in the eval row): handwritten, faded, and slicer-defeating pages never
  entered it. Real-world accuracy is *below* whatever this exam says.
- **Training-pool label noise** (~7% pitch / ~38% tie-repeat structural in nota auto-accepts)
  bounds how much of a residual miss is the model's fault. The post-Round-1 fresh 5% nota
  re-audit runs **regardless of pass or fail**.
- **`\sigend` 73.5% recall / 65.9% precision** is partly the known empty-`\sig` label bug, which
  the re-render fixes; do not read Round-1 movement here as pure model improvement.

##### The decision rule (what makes this binding)

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


## Round 3 — the notes themselves: where they sit and how long they are

*Was `docs/archive/rounds/round3.md` (last updated 2026-09-03).*

> ⛔ **ARCHIVED 2026-10-08 — Round 3 closed on 2026-09-03.** Moved here from `docs/rung3/`. Every
> ⏭ / "next" / "owed" below is as of its own date and is NOT a current action: the exam was read
> once (51% against 75%), Round 4 is the live round ([../../rung3/round4.md](../rung3/round4.md)),
> and current state is [../../STATUS.md](../STATUS.md).

> Part of the real-page track — index: [README.md](../rung3/README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md).
> Decisions: [../DECISIONS.md](../DECISIONS.md).
>
> ⛔ **THIS ROUND IS CLOSED (2026-09-03).** Read once on 2026-09-01: **51%** against the 75% floor, ~15
> of its +17 points the retired `\tie`; runs A and B nulls. What follows is [round4.md](../rung3/round4.md).
>
> ▶ **UNPAUSED 2026-08-05 (owner): this round runs in PARALLEL with the product work** and no longer
> waits for the friends release. The release asks friends about the interface, so its feedback would
> not aim this round either way. [../DECISIONS.md](../DECISIONS.md)
>
> ✅ **This round's acceptance bar is WRITTEN AND SIGNED (2026-08-15) and lives in
> [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol)** — floors beside their Round-2 baselines, with **≥75% of
> exam pages needing ≤5 corrections** as the primary number and the public-launch gate. It was fixed
> before any Round-3 training and is not re-opened after the read. Do not restate the numbers here.

> ✅ **A FIFTH check was added 2026-08-15, after the four below had all come back negative — and it
> is the one that came back POSITIVE.** It is not about what we draw, but about how much of the strip
> the encoder is given. Result in §5 below; the lever and its next step live with the other levers in
> [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first). Read that before rendering anything, including the content change described
> here. ⚠ **The sequencing this note used to state is out of date**: "the next render is a geometry
> render" was true on 2026-08-15, but the geometry pilot was **stopped 2026-08-17** by its
> pre-registered rule and the owner promoted **Lever 4 (renderer diversity) ahead of the content
> work** the same day. The content work is still behind everything; what is in front of it now is in
> [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first).

### What this round is for

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

### The checks were RUN (2026-07-28). Most of them said no.

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

### The four checks, as originally written (with what each returned)

None of these needed training. Three of the last three "the model is bad at X" findings turned out to
be something we never drew properly, so **measure first**.

#### 1. Are the staff lines in the right place? (aimed at the 40%)

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

Now compare that against what we teach the model to expect. `ml/omr/augment.py` shakes each
training picture, but only this much:

```python
A.Affine(rotate=(-2, 2), shear=(-2, 2), scale=(0.97, 1.03), translate_percent=(0, 0.01))
```

Up to **3% bigger or smaller**, and about **3 px** up or down on a 336 px strip. Real strips vary
around 15% in line spacing. **We are shaking the pictures roughly five times less than reality
moves.**

#### ⚠ §1 RESULT (2026-07-28) — the variance story is not supported, and neither is the size story

Measured with `ml/labels/staff_geometry_probe.py`: perturb exam strips along the same axis the
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
  `ml/omr/augment.py` addresses this and stays as **insurance, not a fix** — the ladder says
  variance is not what is costing edits.

- **Non-claim:** measured on the exam only, and the cause is unknown, so nothing ships on it yet.
  Untested candidates: ink weight (real strips carry heavier ink than synthetic), stroke thinning
  under INTER_AREA, or the encoder's own preprocessing.
- **Non-claim:** the vertical-placement half of the original idea did nothing (shift +1% → +0.4%
  edits). Only scale mattered.

#### 2. Are our beams, flags and dots the right weight? (aimed at the 28%)

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

#### ⛔ §2 RESULT (2026-07-28) — DISPROVED. Our beams are not too heavy; real print is heavier

Measured with `ml/labels/beam_weight_probe.py` (the `sharp_probe` method, applied to beam
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

#### 3. Draw the crop shapes the page-cutter actually makes

`stripExport` always builds a strip out of whole measures, so a "clef and key signature, no notes"
picture **cannot occur in training**: 0 of 40,826 strips. The slicer produces them from real pages —
4 of 326 exam strips, and 28% of exam strips are short.

The worst exam strip is exactly that shape: the answer is just the key signature, and the model
invented a whole bar of notes — **19 corrections against 8 correct tokens**. Twelve such strips carry
**21% of all corrections**.

#### ⛔ §3 RESULT (2026-07-28) — cost CONFIRMED, mechanism DISPROVED, change DROPPED

Measured with `ml/labels/empty_crop_probe.py`.

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
(`ml/labels/width_split_probe.py`.)

#### 4. How crowded are the strips?

55 of the note-level errors are whole notes **inserted or deleted** — the model losing count, not
misreading a symbol. That points at density and crop width rather than glyph quality.

- **To do:** compare notes-per-strip and tokens-per-strip between the synthetic corpus and the real
  pools, the same way print position was compared for accidentals.

#### ✅ §4 RESULT — already answered by `domain_gap.py` before this session

Strip width 1229 px synthetic vs 904 (exam) / 1018 (nota); notes per strip 8.6 vs 7.2–8.2; crops
with ≤3 notes 0.67% vs 6.0%. No further measurement needed. The width half of this gap is now
double-motivated — see the encoder-shrink note in §2.

#### ✅ §5 RESULT (2026-08-15) — CAUSAL, and it replicates on the holdout

Measured with `ml/labels/crop_geometry_probe.py --make-padded`, which widens each exam crop with
more of **its own quietest columns** — content and gold untouched, only the resolution the encoder
sees goes down. Pre-registered before the run in [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first): *monotone rise → causal;
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

### Then

Render the corpus with whatever those checks say. ⚠ **§5 answered the one that was open — and then
the answer was overtaken.** Its geometry pilot was stopped on 2026-08-17 and Lever 4 was promoted
ahead of the content work, so the render order lives in [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) and not here; the
content work below is behind all of it either way. Train with the recipe held fixed again (two-stage, `--every-share 0.15`, real oversampled to
~34% of batches — recompute the `:N` repeat if the corpus size changes). Read the exam **once**.

### The real pool changed too (2026-07-27)

The `nota-full` review was worked through every disagreeing strip and promoted: 54 corrected labels,
7 `bad` strips removed. **521 of 1,740 nota strips now carry a human-corrected label**, and ~78% of
the labels on disagreeing strips turned out to be wrong ([../METRICS.md](../METRICS.md)).

Round 2 already trained on 467 of those corrections, so only the 54 are new — but the pool Round 3
trains on is cleaner than Round 2's, which is **one more difference between the two rounds**. Add it
to the attribution question below rather than forgetting it.

Still unmeasured: the 556 strips with no verdict all have `nd = 0` and were never flagged as
suspicious, so the error rate in that tail is unknown. A random 50 of them would settle whether the
pool is worth cleaning further or is ready to enlarge.

### Two things to settle before training, not after

1. ✅ **DONE — what counts as success was written down first**, and signed before training:
   [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol). Deciding afterwards is how people talk themselves into
   whatever they got, and this project has already been burned twice by a headline that moved for
   reasons unrelated to reading ability.
2. **Decide whether to change one thing or four.** Round 2 changed the glyph weight, the label bug
   and the corpus size together, and we still cannot say which of them moved the number. That may be
   an acceptable trade again — but choose it deliberately rather than drifting into it.

### What is NOT in this round, and why

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


## Round-3 criteria — the pre-registration, and the tuplet A/B protocol

*Was `docs/archive/rounds/round3-criteria.md` (last updated 2026-08-20).*

> ⛔ **ARCHIVED 2026-10-08 — Round 3 closed on 2026-09-03.** Moved here from `docs/rung3/`. Every
> ⏭ / "next" / "owed" below is as of its own date and is NOT a current action: the exam was read
> once (51% against 75%), Round 4 is the live round ([../../rung3/round4.md](../rung3/round4.md)),
> and current state is [../../STATUS.md](../STATUS.md).

> Part of the real-page track — index: [README.md](../rung3/README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md) and
> [../METRICS-EXAM.md](../METRICS-EXAM.md). Decisions: [../DECISIONS.md](../DECISIONS.md).
>
> Round 1's pre-registration is [rounds.md § Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim](#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim), kept verbatim; this file is the
> same instrument for Round 3 and follows its shape deliberately. Round 2 was read against Round 1's
> floors without re-registering them, which is why that comparison stayed honest — and why this file
> exists rather than a third set of numbers invented after a result.

### ✅ Status: SIGNED by the owner 2026-08-15 — these are the criteria

Written and dated **before** the Round-3 corpus was rendered and before any Round-3 training ran,
then taken as-is by the owner. **The numbers below are now binding**: they are not re-opened after
the exam is read, and a miss is written up as a miss. A bar chosen after seeing a result is not a
bar, it is a description — and this one carries more than usual, because §2 makes it the
public-launch gate as well.

⚠ The **tuplet A/B in §3 ran before this signature** (2026-08-15) and was not affected by it: its own
protocol was pre-registered here on 2026-08-14 and it selects nothing against the floors in §1.

### 1. The floors

Each floor sits beside its measured Round-2 baseline (`round2-stage2-best`, the 326-strip clean exam
v2.1 with re-audited gold, read 2026-07-27 — [../METRICS-EXAM.md](../METRICS-EXAM.md)), so the
demanded delta is explicit.

| Criterion | Round-2 baseline | Round-3 floor |
|---|---|---|
| **Pages needing ≤5 corrections — the PRIMARY number** | **57%** | **≥ 75%** |
| Micro AEU F1 | 84.8% | ≥ 84.8% (no regression) |
| Macro≥30 AEU F1 | 84.4% | ≥ 84.4% (no regression) |
| Mean per-class AEU F1 *(the historical headline — fragile, low-n)* | 73.9% | ≥ 73.9%, reported with its n |
| Mean per-class AEU recall | 74.2% | ≥ 74.2%, reported with its n |
| SER | 0.052 | ≤ 0.052 |
| Exact-match | 52.1% | ≥ 52.1% |
| `\tup3` recall | 83.8% | ≥ 85% (standing floor, missed twice) |
| `\tup3` precision | 91.2% | ≥ 70% (standing floor) |
| Arc-triggered false `\tup3` | 0.0% (0/81) | ≤ 10% (standing floor) |
| Per-source AEU gap (neyzen − nota) | 0.0 pp | ≤ 12 pp (must not widen) |
| Synthetic val mean AEU recall — no-regression clause | 99.9% (Rung 2.2) | ≥ 99% |

**Why the primary number is the product one, not the accidental headline.** Round 3 targets pitch
(40% of user edits) and duration (28%), which the AEU headline cannot see — accidentals are 13% of
what a user fixes ([../METRICS-EXAM.md](../METRICS-EXAM.md)). `eval_omr.py` already computes and
persists `edits_per_page.share_le5`, so this needs no new measurement code.

**Why ≥75% and not ≥90%.** ≥90% of pages at ≤5 corrections is the standing product goal
(ROADMAP §0) and remains the destination. As a one-round floor from 57% it would demand more than
any round so far has delivered, and a floor nobody can clear stops discriminating a good run from a
mediocre one — the failure mode Round 1's threshold stance names explicitly. 75% is roughly half the
remaining distance, and it is the number the launch gate below is keyed to.

**Why the accidental measures are no-regression clauses, not targets.** Two rounds were spent on the
13%. What Round 3 must not do is buy pitch and duration by giving back the microtonal reading — so
they are floored at their Round-2 values rather than pushed. The macro mean stays *inside* the
report (never silently dropped) but is not the pass/fail number: it swung ~11 pp on a 3-gold class
in Round 1 and −4 pp on a 14-gold class in Round 2, which is what micro and macro≥30 are quoted
beside it to absorb.

**Per-class floors.** Round 1's five ≥20-gold classes keep their floors verbatim from
[rounds.md § Round-1 ship criteria (Step 4.0) — the pre-registration, kept verbatim](#round-1-ship-criteria-step-40--the-pre-registration-kept-verbatim) (recall ≥75%, precision ≥70% each). They are reported, and a
miss is written up as a miss, but the pass/fail decision for Round 3 is made on the table above.

### 2. The public-launch gate

**The app opens beyond the two friends when Round 3's one-shot exam read clears the PRIMARY floor:
≥75% of pages needing ≤5 corrections.** Below it → Round 4, and the link stays with the friends.

One number, stated once, before the read. Three things follow from it:

- The gate is the **product** number, because what gates a launch is whether the app is worth using,
  not whether it reads a küçük mücennep.
- The exam is a **matched upper bound** (its pieces exist in SymbTr), so real uploads will be worse
  than whatever it says. That is a known, accepted bias in the gate, not a discovery to make later.
- A near-miss is a miss. The "improvement ship" disposition used in Rounds 1 and 2 is about what
  becomes the live *model*; it does not open the launch.

### 3. The tuplet A/B — pre-registered protocol

> ✅ **RUN 2026-08-15. Result: NULL** — 88.9% vs 85.2%, 2 net groups of 54, exact McNemar **p = 0.688**.
> The null branch below applied as written: the shape is kept, no recall claim is made. The protocol
> is left **unedited** so it stays auditable against the result. Numbers: [../METRICS.md](../METRICS.md);
> verdict and caveats: [rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](#tuplets--why-tup3-recall-keeps-missing-its-floor).

The first training under this file is not Round 3 itself but the `\tup3` shape A/B
([rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](#tuplets--why-tup3-recall-keeps-missing-its-floor) step 3). An A/B is training, so it is registered here before the render.

**The question.** Real Turkish print breaks the tuplet arc and sets the "3" in the gap (16/16 marks,
~11 editions); until 2026-08-12 we drew a continuous arc with the digit floating above it. Does
drawing it the printed way recover `\tup3` recall, which sits at 83.8% — under its ≥85% floor and
*below* its own pre-slur-distractor baseline of 92.7%?

**The arms.** Identical `data/pieces_v4.json` (⚠ *not* `data/pieces.json`, which is the stale
2026-07-08 selection), `data/split_v4.json`, recipe and seed; the ONLY difference is the mark:

| Arm | Corpus | Mark |
|---|---|---|
| `CTL` | `data/synthetic/strips_v5_tupctl` | continuous arc, digit floating above (pre-2026-08-12) |
| `NEW` | `data/synthetic/strips_v5_tupnew` | broken arc, digit in the gap (as measured) |

- The curved-arc **share stays at 90% in BOTH arms** (owner, 2026-08-13). Shape is what is under
  test; moving the share too would make the result unattributable, the same reason the slur
  distractors are held fixed.
- **Print realism (`printseed`) is OFF in both arms** (owner, 2026-08-13), so the corpora match the
  shipped `strips_v4` recipe apart from the mark. It carries `USUL_BEAM_GROUPS`, which is measured
  as unvalidated and quarantined ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)); a fresh
  render would otherwise have shipped it into ~40k strips as a side effect. It is opt-in from now on
  (`render.ts --print-noise`) and is its own later question.
- **Not in this A/B:** the 35% slur-distractor rate, the heavier arc stroke owed jointly with
  `drawSlurArc`, and the content work in `select_pieces.py`. One change at a time.

#### Why `round2-stage2-best` is NOT the control (measured 2026-08-14)

The obvious saving is to train one arm and compare it to the live model, which was trained on the old
mark. It was checked and rejected: a Round-3 model differs from `round2-stage2-best` by **four**
things, not one.

| difference | size |
|---|---|
| the tuplet mark | what we want to measure |
| **`staff_jitter`, a NEW augmentation** — `ml/omr/augment.py`, added 2026-07-29, **two days after** `round2-stage2-best` trained | ±4% scale, ±2% vertical shift, on **80% of every training sample**, both profiles. Never A/B'd, and aimed at exactly the geometry axis a triplet lives on |
| sub-visual **pixel drift** across the corpus | **all 40,826** strips differ between `strips_v4` and today's render, not only tuplet ones: mean abs delta 0.3–4.8 grey levels, no integer shift, ink fraction equal to 4 decimals, indistinguishable by eye. It is a rasterizer/Chromium change since 2026-07-26, **not** a drawing change of ours — `--thin-sharps` was already in v4 and print realism is off in both arms |
| the training environment | July Colab vs today's, plus ordinary run-to-run variance |

The two arms share all three nuisance differences, so only the mark separates them. Against
`round2-stage2-best`, nothing would separate. ⚠ **Sub-visual is not the same as harmless** — the
22%-too-thick sharp bars were invisible too and collapsed a class, and the 2% pre-shrink faked a
15.5% exam gain that reversed off the exam.

⚠ **This also applies to Round 3's own exam read**, which is why it is written here: whatever the
round scores, it carries `staff_jitter` and the pixel drift alongside whatever the round changed
deliberately. Rounds 1 and 2 both ended with "the changes are not separable"; say so again rather
than attributing a movement to the corpus alone.

**The selection statistic — ONE number.** Free-running `\tup3` **recall** on the tuplet val slice
`data/real/rung3/_tupletval` (built by `ml/labels/build_tuplet_val.py`: every `\tup3`-bearing
val-side strip from `strips_tup` and `_realval_v2`, val side decided by
`ml/omr/data.py::is_real_val_piece`, exam pieces refused).

**The pool's reference point, read before the arms exist.** `round2-stage2-best` — the live model,
held out from these strips by the same hash — reads **85.2% `\tup3` recall / 97.9% precision** on it
([../METRICS.md](../METRICS.md)). Two things follow: the pool is **not** flattering on the class it
exists to measure (85.2% here against 83.8% on the exam, where real-val normally reads far higher),
and the arms have a number to be sane against. It is context, not a selection — the A/B is decided
between the two arms, paired.

**Guards, which do not select but can veto:** `\tup3` precision ≥70% (it has ~20 pp of headroom
above its floor and may spend some), and mean AEU F1 on `_realval_v2` must not fall more than 1 pp
between arms.

**Power, stated before the result — and it is tight.** The slice as built holds **54 `\tup3` gold
groups over 28 strips, 11 pieces** (`strips_tup` 19 groups / 9 strips, `_realval_v2` 35 / 19; one
decode-derived row and 8 filename collisions with older-slicer pixels removed). So **one group is
worth 1.9 pp of recall**, and significance — an exact **McNemar** test on the paired per-group
hit/miss across the arms — needs about **6 discordant groups all pointing one way** (b=6, c=0 gives
p = 0.031; 5 and 0 gives 0.063). The **minimum resolvable effect is therefore ~11 pp**, not the 5 pp
the redraw is hoped to buy. The whole read is one command,
`ml/labels/tuplet_ab_score.py --new <ckpt> --ctl <ckpt>`, which decodes both arms over the pool,
pairs the outcomes by gold occurrence and prints the exact p. Two consequences, both accepted before the run rather than discovered after it:

- A win has to be **large** to be called a win. Anything smaller is reported as null, in the
  language of the null branch below.
- ⚠ The pool is **neyzen-heavy** (24 of 28 strips; `--pools` can add `strips_nota` for +4 groups,
  deliberately not in the default — 4 groups cannot decide anything and it would put a noisier
  auto-accept pool inside the selection metric).

**The decision rule, written before the result:**

1. `NEW` wins significantly → its corpus becomes Round 3's, and the tuplet work moves to
   [rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](#tuplets--why-tup3-recall-keeps-missing-its-floor) step 4 (the forced-arithmetic repair + the decode constraint).
2. **Null** → the redraw is **kept anyway** — it is measured against real print, and realism is its
   own justification — but **no recall claim is made anywhere**, and the next lever is the
   slur-distractor rate (step 5), never both at once.
3. `CTL` wins significantly → revert the redraw and re-open the diagnosis in
   [rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](#tuplets--why-tup3-recall-keeps-missing-its-floor).

**The exam is not read for this A/B.** It is read once, later, on Round 3's final model, against §1.

### 3c. ADDENDUM 2026-08-21 — the exam was REBUILT, and one question is open for the owner

Same rule as §3b: written here, nothing in §1 or §2 edited. **This addendum contains the only
Round-3 criteria question that is still open**, and it must be closed **before** the read.

**What changed.** The exam is not merely grown, it is **re-cut**. Every one of its 67 pages was
re-sliced with the current `page_to_strips.py` and re-emitted, because no exam page had ever been
re-sliced — 46 of them were measuring a slicer no user gets ([README.md § The exam — freezing an honest test set (Steps 2 and 3)](../rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3),
[../DECISIONS.md](../DECISIONS.md) 2026-08-21). The frozen `strips_exam_v2_clean/` is untouched and
remains the record of what Round 2's numbers were measured on.

⚠ **The rebuilt exam is a HARDER instrument than the one §1's floors were signed against.** It grades
about **12 candidate strips a page against the frozen exam's 7.1** — 802 of 1,369 candidates over 64
pages, where v2 kept 326 of 608 over 46. A page measured on more of its own material collects more
edits, so *at equal model quality* the primary ("pages needing ≤5 corrections") reads **lower** on the
new exam than on the old one. §3b's "a bigger exam changes precision, not the bar" was true of growth;
it is **not** true of a re-cut that also changes what a page is graded on.

⭐ **Fairness is not at stake — interpretability is.** §3b's precondition 2 already re-scores
`round2-stage2-best` on the new instrument, so every baseline/floor pair in §1 still refers to one
exam and the two models still face identical pages. What is unsettled is what the **absolute** 75%
means once the instrument is harder.

⏭ **The owner's call, to be taken before the read and recorded here.** The two honest readings:

1. **Keep 75% as written.** The floor was signed as an absolute product statement — "3 pages in 4
   need at most 5 corrections" — and a harder exam simply measures that claim more completely. The
   bar gets harder because the old bar was flattered.
2. **Re-express the floor against the re-measured baseline.** Take the Round-2 baseline on the new
   exam (57% was measured on the old one) and restate the floor as the same *improvement* it
   represented when signed. This keeps the intended difficulty and makes the instrument change
   neutral.

⛔ **What is not available**: choosing between them after seeing the Round-3 number. §4 stands.

> ✅ **SETTLED 2026-08-31 (owner), and it is a THIRD reading, not one of the two above.**
> *"I will look where it makes mistakes and classify the problems. Then decide ship manually."*
>
> **What this means in practice.** The numeric floor stops being the *automatic* ship gate. The exam
> is still read **once**, and the primary is still **computed and reported with its interval** — that
> costs nothing and keeps the record comparable — but the launch decision is taken by the owner after
> reading an **error classification**, not by comparing one number to 75%.
>
> ⚠ **What is given up, stated plainly, because that is what a pre-registration is for.** A signed
> numeric floor is a commitment made while the answer is unknown; a judgement made after seeing the
> output is not, however honestly it is taken. The specific risk is the one §4 was written against —
> a result that misses gets re-read as "the errors are the acceptable kind". **Recording the
> decision now, before any Round-3 model exists, is what keeps it honest**: the rule changed while
> the answer was still unknown, which is the only time it legitimately can.
>
> ⚠ **What is NOT changed.** The exam is still one-shot (§4). The no-regression clauses in §1 are
> still measured and still reported. `round2-stage2-best`'s baseline on the rebuilt exam
> (**44%**, [METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument)) stands as the comparison column, so
> "better or worse than Round 2" remains a factual question with a factual answer.
>
> ⏭ **What this now REQUIRES that the old plan did not**: an error classification the owner can
> actually read — the exam's mistakes grouped by kind (pitch / duration / accidental / repeat
> structure / signature), with examples, not just a rate. Without it this decision has no input.
> `eval_omr.py --show-errors` prints per-strip errors and its payload carries the per-class table;
> **grouping them into a readable taxonomy is not built yet** and is the thing to build before the
> read. [../BACKLOG.md](../BACKLOG.md).

⚠ **§3b's drop note is superseded in its numbers only.** The rebuilt exam drops **567 of 1,369**
candidates (41%: `split_wide` 414, `over_budget` 153) where v2 dropped 282 of 608 (46%). The bias is
the same in kind — the wide and the dense are still what gets thrown away — and still runs in the
declared matched-upper-bound direction.

⚠ **A new gold-quality precondition.** 139 strips enter the rebuilt exam labelled by the emitter
alone, and **96 of them have never been read by a human** (the other 43 agree token-for-token with
the frozen exam's hand-made gold). The comparable historical rate is not reassuring: of exam v2's 63
auto-accepted labels, a human later corrected **32 (51%)**. Those 96 are the `examv3-full` tab and
reading them is a **precondition of the read**, not an audit sample.

### 3b. ADDENDUM 2026-08-20 — the exam grows before the read, and the floors do NOT move

Added after signing, and it is written here rather than inside §1 so the signed text stays auditable
as signed. **Nothing in §1 or §2 is edited, re-opened or re-numbered by this section.**

**What changed.** The exam grows from **46 to 67 graded pages** before the one-shot read — the 21
pages it already owns and has never labelled ([README.md § The exam — freezing an honest test set (Steps 2 and 3)](../rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3)). This is the power note's option 1
([rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first)), which exists precisely so that growing *before* a read is legal; §4's rules
are unaffected because the exam is still read **once**, on the final model.

**Why this is not moving the goalposts.** Three things keep it honest, and all three were fixed
before any Round-3 number was seen:

1. **The floors are unchanged.** ≥75% of pages at ≤5 corrections is still the primary and still the
   launch gate. A bigger exam changes the *precision* of the estimate, not the bar it is compared to.
2. ⚠ **The Round-2 baseline column is re-measured on the grown exam.** `round2-stage2-best` is
   re-scored over the 67 pages, so every "Round-2 baseline / Round-3 floor" pair in §1 refers to the
   same instrument. Without this the table would silently compare two different exams. One CPU decode
   run; it is a **precondition of the read**, not a follow-up to it.
3. **The interval is reported beside the result**, which is the power note's option 2 taken as well.
   At 67 pages the 95% half-width is ~±10.4 pp, so a near-miss and a near-pass remain
   indistinguishable — that is stated *before* the number exists, and it does not soften §2's "a
   near-miss is a miss".

⚠ **A blind spot in §5 is now sized, and it is bigger than §5 implies.** §5 says dense
contiguous-triplet instrumentals are unmeasured. The census behind this addendum shows the exam grades
**326 of 608** candidate strips on its own pages — the other 282 are dropped as `split_wide` (203) or
`over_budget` (78), i.e. the **wide and the dense** ones ([METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument)).
So the exam reads each page on its easier material. This does **not** change the floors either: the
bias runs in the same direction as the already-declared "matched upper bound" optimism, which §2
accepts on the record. It is stated so the result is quoted with it.

### 4. What makes this binding

1. **Selection happens on real-val, never on the exam.** Real-val orders candidates; it does not
   predict exam performance (measured gap 28 pp historically, 10.1 pp same-model on `_realval_v2`).
2. **The exam is taken ONCE**, on the final Round-3 model.
3. **A miss is not re-rolled on the same exam.** Diagnose on real-val; any further exam read is
   labelled in `MODEL_EVAL.md` as a second look with its leakage acknowledged.
4. **A partial pass is written up as partial**, never rounded up — and it does not open the launch.
5. **Power criterion (standing, from [rounds.md § Round 1 — the first fine-tune on real pages (Step 4)](#round-1--the-first-fine-tune-on-real-pages-step-4)):** a tuning sweep only runs if its
   minimum interesting effect exceeds the measured movement of the selection metric under the
   largest prior intervention (0.5 pp). The tuplet A/B clears this — the effect at stake is the
   ~9 pp `\tup3` recall drop, an order of magnitude larger.

### 5. Blind spots — the criteria must NOT be gamed on these

- **`\buyukFlat` has 0 real gold** on the exam; no real-page claim in either direction.
- **`\komaSharp` (n=14) and `\buyukSharp` (n=3) are low-n**, carry no per-class floor, stay inside
  the means, and are always printed with their n.
- **`\tup3` gold is thin everywhere** — 55 groups on the exam, 54 in the A/B slice — and is
  common-case k=1 material; dense contiguous-triplet instrumentals remain unmeasured.
- **The exam is a matched upper bound**, and its crops carry old-slicer defects the current slicer no
  longer produces, so it slightly over-measures robustness to retired defects.
- **Training-pool label noise** (~7% pitch, ~38% structural tie annotation) bounds how much of a
  residual miss is the model's fault.


## Round 3 — the worklist, item by item

*Was `docs/archive/rounds/worklist.md` (last updated 2026-09-01).*

> ⛔ **ARCHIVED 2026-10-08 — Round 3 closed on 2026-09-03.** Moved here from `docs/rung3/`. Every
> ⏭ / "next" / "owed" below is as of its own date and is NOT a current action: the exam was read
> once (51% against 75%), Round 4 is the live round ([../../rung3/round4.md](../rung3/round4.md)),
> and current state is [../../STATUS.md](../STATUS.md).

> **This file does NOT state what is next.** The ordered table and the current next action live in
> [../STATUS.md](../STATUS.md), which is the only file allowed to say either. This one holds the
> per-item detail so that file can stay a summary.

Split out of [../STATUS.md](../STATUS.md) on 2026-08-23 when it crossed the 400-line cap. The split
is the one [INDEX.md § Maintaining these docs](../INDEX.md#maintaining-these-docs) asks for: **STATUS keeps current state and the
next action; work goes in the track doc it belongs to.** Nothing was dropped in the move.

**B0. ✅ DONE 2026-08-31 — `examv3` IS FULLY LABELLED: 663 of 663 verdicted, all 64 pages
   PAGE-COMPLETE** (573 fix / 61 bad / 29 ok), on top of the 139 `examv3-full` rows read 2026-08-21.
   **It no longer blocks the read.** ⏭ What remains is mechanical: promote it
   (`--exam --strips-root data/real/strips_examv3`, not optional — the default root holds the same
   filenames with the RETIRED slicer's pixels), after which that manifest **replaces**
   `strips_exam_v2_clean` as the exam; and re-score `round2-stage2-best` on it, which is the baseline
   column of every floor pair and a **precondition of the read**. The original framing follows.

   **The job as it stood:** ✅ **166 rows are read**: all 139 of `examv3-full` and all 27 `gold_conflict`.
   ✅ **UNPAUSED 2026-08-23** — it sat at 62 of 663 only because a slicer change would force a re-cut,
   and the label-budget rail is now deferred to Round 4 ([../DECISIONS.md](../DECISIONS.md)), so the
   crops are stable and no row is spent twice. ⚠ A Round-4 re-cut will still cost something, but not
   everything: gold carries by measure span (**221 of 326** last rebuild, each a suggestion needing
   confirmation). **Label PAGE-COMPLETE** — the primary counts corrections per page, so a
   half-labelled page under-counts its own errors.
   ⚠ **Crops live in `data/real/strips_examv3`**, so `promote_labels.py` needs
   `--strips-root data/real/strips_examv3` — the default root holds the same filenames with the
   retired slicer's pixels. ⚠ **The ceiling is 64 pages**: 3 drop every candidate as `split_wide` /
   `over_budget`. ⚠ About **1 row in 9 is unwinnable at 59 ids** — the red OVER BUDGET line means
   `bad`, not a correction worth typing.
   ⏭ **Before the read**: re-score `round2-stage2-best` on the rebuilt exam, and settle what the 75%
   floor means on a harder instrument. [rung3/README.md](../rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3).

**B1. ✅ `batch3` IS CUT AND OPEN — 54 pages / 1,499 strips from the SCANNED tier** in `review_ui.py`
   (`batch3` tab, crop root `data/real/strips_v2`); 28 pages excluded over four rounds (11 handwritten,
   **17 stale = 24% of those checked**), 0 void. ⚠ **Training only** — the ranking selects the worst
   pages in its tier, so nothing cut here may become exam gold.
   [rung3/labeling.md](../rung3/labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3).

**B2. ⏭ THE OWNER HAND-CORRECTS REAL LABELS — and the probe is IN: `batch3` pays better than any queue
   before it.** 114 of 1,499 judged, **66 fix / 39 ok / 9 bad ≈ 58% fix rate**, against ~30% in the
   scanned nota pool and ~12% in `batch2`; bad rate 7.9% against `realval-hard`'s 33%, so no
   impact-score cap is needed. The case is unchanged — pitch is 40% of what a user corrects, so dirty
   pitch labels cap the metric Round 3 is graded on no matter what the renderer does.
   ⚠ **Attend to PITCH AND DURATION, not accidentals** — that axis has never been audited.
   ⚠ **B0 outranks this for a scarce evening** (above), and ⚠ **~1 in 5 of these fixes is deleting a
   false `\repstart`** — hand-payment for a hole the final render now closes, so expect the fix rate
   to fall once a model trained on that render reseeds the queue.
   ⚠ The 531 existing `fix` verdicts are **stranded on old crops**: they evidence bad auto-derived
   labels, they are not corrections we can bank ([METRICS-SLICER.md](../METRICS-SLICER.md#crop-roots--which-slicer-cut-which-pool-and-what-a-re-slice-costs)).
   ⚠ Only the **final** model consumes this work, so the arms never waited for it.
   ✅ **The promotion embargo is LIFTED (2026-08-20)** — both arms are read, so `promote_labels.py`
   and B8 are unblocked, and promoting *before* the final render is the point of B2.

**B3. ✅ ARM 1 — THE SCAN PROFILE: RAN, NULL, DECIDED — nothing to do.** **`scan_share` stays OFF**
   (owner, 2026-08-19), which is its default. [rounds.md § The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL](#the-scan-profile--round-3s-first-trained-arm-lever-7--null) · raw log
   [log/raw.md](../log/raw.md#round_3_scan_logs).

**B4. ⛔ ARM 2 — ONE MEASURE PER STRIP: DROPPED, not deferred.** Reasoning in "Now", decision row in
   [DECISIONS.md](../DECISIONS.md). ⚠ The **short-crop hole** is still the blocking item on the
   crop-geometry axis ([METRICS-INPUT.md](../METRICS-INPUT.md#crop-geometry--what-the-encoder-is-actually-given)).

**B5. ✅ ARM 2 — THE STACCATO DISTRACTOR: TRAINED, SCORED, IT PASSES, AND THE FLAG SHIPS** (see
   "Now"). Primary **72.7% → 0.0%** false dots, paired **60–0** (p = 1.7e-18); clause 2 passes, clause
   3 shows no price. **The first Round-3 arm to move its primary.**
   [rounds.md § The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES](#the-staccato-distractor--round-3s-arm-2-lever-6--passes) · [METRICS-INPUT.md](../METRICS-INPUT.md#diagnostics--the-symbols-the-model-has-never-been-shown).

**B6. ⏭ THE FINAL MODEL, then the exam, read ONCE. The render carries THREE flags and no more.**
   `--concave-tuplet` (a per-piece coin on print evidence, no recall claim), `--staccato-noise` (the
   passed arm) and `--usul-barline`, the **label-free dotted (usul) barline**.
   ✅ **All three are BUILT as of 2026-08-31** — `drawUsulBars` was the last one, ruling the usul's own
   beat groups inside the bar off `USUL_BEAM_GROUPS`, coined per PIECE. **Label-free and checked: 188
   strip labels over 4 scores byte-identical with the flag on and off.** Previews of all three:
   `data/synthetic/_flag_preview/`. ⚠ `verify-labels.ts` must be passed **the same three flags** or it
   gates a different picture. ⚠ `make_round3_colab_zip.sh` **refuses any corpus carrying
   `concaveTuplet`** and hardcodes the three RETIRED real pools; both need changing, and `:9` must
   become `:5` at the new pool size. ⛔ **Nothing else joins them** — in
   particular **not** a raised token budget (B9) and **not** the content work (B7).
   ⏭ **Before rendering**: how often does print actually draw a dotted barline? 7.8% is a statistic
   about the model's guesses — ⭐ cheapest honest method is to count them while labelling `examv3`.
   ⏭ **Give the barline its own paired scorer**, cloned from `staccato_falsedot_score.py` (false
   `\repstart` rate instead of false dots). Three flags in one render means a general movement is not
   attributable; the staccato arm survives that because it kept its own instrument, and this makes two
   of the three attributable instead of one.
   ⏭ **During training**: save **two** checkpoints, one under the current selector and one selected on
   a free-running real metric, and choose between them on `_realval_v2` **before** the exam
   ([BACKLOG.md](../BACKLOG.md) item 3).
   ⏭ **Before the read**: B0 must be done, and `round2-stage2-best` re-scored on the grown exam.
   ⏭ **At the read**: add one free column — split `\tup3` recall by first-in-strip vs later, which
   settles the tuplet position lead over the exam's 55 groups ([rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](#tuplets--why-tup3-recall-keeps-missing-its-floor)) —
   and report the primary **with its interval**.
   ⚠ Three flags means a general movement is not attributable to one of them. That was already true at
   ±12 points; the staccato claim survives it because that arm kept its own paired instrument.

**B6b. ⏭ TARGETED COLLECTION — two targets, not a wider funnel** (owner, 2026-08-20, narrowing the
   2026-08-17 collect-broadly call). **2,486 unlabelled page PNGs already sit on disk**, so volume
   relieves nothing. The two things volume cannot substitute for: pages drawing the **concave tuplet
   mark** (no labelled real strip carries it, so nothing we own can score it) and **tuplet-dense
   instrumentals** — sirto, longa, saz semaisi, the Avni Anıl page — which meet two known blind spots
   at once. ⚠ **Collecting the second does not fix it**: the same 59-id budget drops the new pages, so
   it is paired with B9 or it buys drops. Then re-run `build_tuplet_val.py`; today's pool is
   neyzen-heavy, 24 of 28 strips. Sources are listed once, in [DECISIONS.md](../DECISIONS.md). ⚠ Read
   each licence before redistributing ([THIRD-PARTY.md](../THIRD-PARTY.md)); keep refusing exam pieces.

**B9. ⏭ MEASURE THE 59-id DECODER BUDGET — a script, not a change.** ⚠ Read it beside the 2026-08-23
   finding that the 59 is the **emitter's training gate, not an inference cap**: `MAX_TOKENS` is 100
   and `hit_cap` fired on 0 of 202 misfilled strips, so the model stops on its own
   ([../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md)).

   `MAX_IDS = 59` exists because the base weights' `generation_config.max_length` is **60**: a setting,
   not an architectural limit. Run the real tokenizer over the existing drop lists and report how many
   fit at **90** and at **120** ids. It would pay three times — 78 dropped exam strips, the
   tuplet-dense repertoire (39.4% / 80.5% / 92.9% of 1-, 2- and 3-measure triplet windows blow it),
   and 2,108 over-budget training drops. ⛔ **The measurement is Round 3; raising the budget is Round
   4** — the cost side is unpriced (decode steps in the browser and on Cloud Run, training memory) and
   it would move every pool, every manifest and the shipped latency at once.
   [BACKLOG.md](../BACKLOG.md) item 7.

**B7. The content work in `select_pieces.py`** — the eighth/quarter-note mix and bar-line density
   (owner, 2026-07-27: these only; ties and accidentals stay out). **Not cancelled and not superseded
   — sequenced behind everything above**, because the note-value mix changes how wide a measure is and
   would move the geometry variable as a side effect. ⚠ Our strips are already **wider** than the real
   pools' and denser music widens them further, so the selection needs a **strip-width target**, not
   only a note-value histogram; verify on a 300-strip pilot with `domain_gap.py` **before** regenerating
   the list, and treat a drop in accidental counts as a stop sign.
   ⚠ The live list is `data/pieces_v4.json`, and a new selection needs its own filename **and its own
   split** — a piece outside `split_v4.json` is dropped from training in silence. ⚠ It also changes
   which real strips are val-side, so `_realval_v2` and `_tupletval` must be re-checked, not assumed.

**B8b. ✅ CLOSED 2026-08-31 — `b8-full` IS READ AND THE POOL IS READY.** 3,955 rows,
   **3,362 ok / 576 fix / 17 bad**; 1,016 read by hand, 2,939 standing as machine `agree` drafts,
   accepted by the owner on evidence: in the random 201-row audit **41 rows had `label == decode` and
   a human read all 41 as `ok` — 0 wrong**. ⛔ **`\sig` is the measured exception** — `unaccept_sig.py`
   reverted machine verdicts on signature-bearing rows and the owner then corrected **12, all 12
   carrying a `\sig` block** ([BACKLOG.md](../BACKLOG.md) item 9). ⭐ **The 1,442 human-fix carry
   turned out to be already done by hand**: of the 198 span-matched fixes disagreeing with b8's
   label, **122 the owner had fixed identically** (two independent reads agreeing 122 of 140 = 87%).
   ⏭ **`b8-review`'s 450 promotable old fixes go to ROUND 4** (owner). ✅ Promoted: **3,936 rows, 3
   rejects**, all three genuinely over the 59-id cap. ⛔ **Then 7 more rows came out the same day**:
   two pieces whose OTHER printed engraving the exam grades, so the pool is **3,929** (3,539
   train-side). The emitter had excluded exam pieces by IMAGE STEM while `train.py` guards on the
   SymbTr id; both now use the SymbTr id. `data/real/rung3/excluded_exam_pieces.txt` ·
   [../STATUS.md](../STATUS.md).
   [METRICS.md](../METRICS.md#metrics--the-b8-re-emit-and-the-human-fixes-it-did-not-carry).

**B8. ✅ THE RE-EMIT RAN (2026-08-21) — `data/real/rung3/strips_b8`.** 1,293 non-exam matched pieces,
   current crops (`strips_v2`), `round2-stage2-best` as hint AND gate, **37 minutes** on the laptop:
   1,704 page decodes were reused from the July re-slice, only 16 were fresh. **3,955 accepted strips
   against the old pools' 2,330 (+70%)**, 4,738 in review. The train/test mismatch it existed to close
   is closed — training was the last thing on retired crops.
   ⏭ **It is NOT training data yet — but only ONE thing now stands between:**
   ✅ **(a) `b8-audit` is READ — all 201 rows, 27 fix / 174 ok = 13.4% wrong.** Worth reading: the
   referee trained on these very labels, and v2 sampled 2 of 63 before a later read found 51% wrong.
   ⚠ Not a clean bill — repeat structure is the biggest class (10 of 26) and 2 signature errors are
   [BACKLOG.md](../BACKLOG.md) item 9 inside a training pool. [METRICS-CORPUS.md](../METRICS-CORPUS.md).
   ⭐ **(b) carry the 1,442 human `fix` labels across** — they do **not** come back by themselves. 951
   are recoverable (445 land on an accepted strip covering the same measures, 506 sit in `b8-review`);
   ⛔ carry them by **measure span**, never by filename — 248 match a new strip's *name* while holding
   different music. The old pools are untouched on disk.
   ⭐ **The drop table**: `split_wide` 10,226 + `over_budget` 4,012 = **14,238** against 7,446 for
   alignment — the **budget rail is now the binding limit**, which is why step 4 moved up. Numbers and
   the 98% self-consistency check: [METRICS-CORPUS.md](../METRICS-CORPUS.md) · [rung3/labeling.md](../rung3/labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3).
   ⛔ **The exam is not re-emitted** and keeps the neutral July decode ([DECISIONS.md](../DECISIONS.md)).

**B10. ⛔ RUN AND ANSWERED 2026-09-02 — IT BOUGHT NOTHING MEASURABLE.** Run B trained on
   `strips_b8` + `strips_oldhuman` at `:4` and lands **645 edits against `r3-final-stage2-last`'s 667**
   on 262 paired `_realval_v2` strips (CI [−0.218, +0.046], p = 0.736), and −0.042 against Run A
   (p = 0.860). ⚠ **A null, not a refutation**: ±0.13 edits/strip of CI half-width could hide a small
   gain. The inventory below stands as the record of what was added.
   [METRICS-EXAM.md § Metrics — Round 3's two follow-up runs (A and B)](../METRICS-EXAM.md#metrics--round-3s-two-follow-up-runs-a-and-b)

   **✅ BUILT 2026-09-01 — `strips_oldhuman`, the pool of EVERY hand-verified real strip** (owner,
   2026-09-01, lifting the 2026-08-31 ban for the next run only). ⭐ **The inventory, counting human
   `ok`+`fix` verdicts only** (machine `agree` drafts excluded; exam and real-val queues excluded by
   construction):

   | queue | crop root | ok | fix | usable | state |
   |---|---|---|---|---|---|
   | `strips_b8` | `strips_v2` (current) | 423 | 577 | **1,000** | already promoted, in Round 3 |
   | `strips_nota` | `strips` (RETIRED) | 129 | 706 | **835** | ⏭ needs promotion |
   | `strips_r1` | `strips` (RETIRED) | 68 | 360 | **428** | ⏭ needs promotion |
   | `strips_tup` | `strips` (RETIRED) | 94 | 78 | **172** | ⏭ needs promotion |
   | `batch3` | `strips_v2` | 39 | 66 | 105 | ⛔ mostly on emitter-DROPPED strips |
   | `reslice-all` | `strips_v2` | 164 | 50 | 214 | ⛔ all 50 fixes on dropped strips |
   | `batch1` + `batch2` | `strips_v2` | 62 | 9 | 71 | ⏭ no promotion path built |

   ⭐ **What the decision unlocks is the 1,435 retired-crop strips.** ⚠ The `batch*` / `reslice-all`
   rows are a **different** blocker and this decision does not touch them: they sit on strips the
   emitter dropped as `split_wide` / `over_budget` / `row_unaligned`, so making them usable IS the
   label-budget rail ([../BACKLOG.md](../BACKLOG.md) item 0). ⚠ `b8-review`'s 4,737 rows are
   unverdicted — out of scope until someone reads them.

   ⚠ **The overlap must be measured before the run, not after.** `carry_old_fixes.py` already located
   1,479 old fixes inside `strips_b8` by measure span, and the owner had re-fixed **122 of 140**
   span-matched disagreements identically. So a large share of the 1,435 is the same BARS as a b8 row
   at a different geometry. That is the owner's point — a second cut is variety — but the size of the
   overlap decides whether it reads as augmentation or as a 3× weighting of one subset of the music.
   ⭐ Cheapest honest method: run `carry_old_fixes.py`'s span key over the three retired manifests
   against b8's and report how many spans are shared.

   ⛔ **Keep the pools SEPARATELY NAMED on the `train.py` command line** (`--real-dir A --real-dir B`),
   never merged into one directory. The startup line prints one row per pool, and that line is the
   only place the mix is visible; merging them hides the very thing this run is testing.
   ⚠ **Re-check the `:N` repeat.** The recipe is "real ≈ 1/3 of stage-2 batches"; at 3,539 + ~1,435
   train-side strips `:5` would overshoot. Re-measure against the real manifests, as was done for
   Round 3 — do not carry `:5` over.
   ⚠ **The exam guard applies to every pool**: `emit_strip_labels.py`'s SymbTr-id filter (2026-08-31)
   must be re-run over the retired pools, or `promote_labels.py`'s backstop must catch them. The
   retired pools were hand-cleaned once, on 2026-07-26, by a procedure that did not fix the producer.
   [../DECISIONS.md](../DECISIONS.md) · [../METRICS-CORPUS.md](../METRICS-CORPUS.md).

⚠ **The musical-form lead is DEAD** (owner retest, 2026-08-17) and must not be re-derived
([log/superseded.md](../log/superseded.md)). ⚠ **A fourth realism arm does not follow from three near
misses** — the three nulls and the one pass are the reason ([rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first)).


## The levers Round 3 has not pulled — ranked, with what to measure first

*Was `docs/archive/rounds/levers.md`.*

measurement that decides each one
audience: agents and the owner working the model track, starting a session on Round 3

updated: 2026-10-04

> ⛔ **ARCHIVED 2026-10-08 — Round 3 closed on 2026-09-03.** Moved here from `docs/rung3/`. Every
> ⏭ / "next" / "owed" below is as of its own date and is NOT a current action: the exam was read
> once (51% against 75%), Round 4 is the live round ([../../rung3/round4.md](../rung3/round4.md)),
> and current state is [../../STATUS.md](../STATUS.md).

> Part of the real-page track — index: [README.md](../rung3/README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md) and
> [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md). Decisions:
> [../DECISIONS.md](../DECISIONS.md). Round 3's binding floors are
> [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) and **nothing here changes them**.

### Why this file exists

Round 3's four pre-render checks, plus the tuplet A/B, produced this run of results:

| change we investigated | outcome |
|---|---|
| staff geometry → note heights | claim not supported; the apparent win failed a holdout |
| beam/flag weight → note lengths | disproved — ours are at the engraving standard |
| render the odd crop shapes | cost confirmed, mechanism disproved, dropped |
| crop width, split at decode time | **worse** (+31.8% edits) |
| the `\tup3` mark redrawn to real print | **null** (p = 0.688) |
| `staff_jitter` + rasterizer drift + a fresh environment, together | **zero** movement |

Every one of those asked the same kind of question — *do we DRAW something wrong?* — and the answer
kept coming back no. Meanwhile the thing Round 3 exists to fix has not moved: pitch and duration are
**68% of what a user corrects** ([../METRICS-EXAM.md](../METRICS-EXAM.md)).

The reading this file takes: **the "make the synthetic pixels more realistic" axis is at diminishing
returns**, and the remaining levers are on four other axes — what the model is allowed to SEE, how it
is allowed to DECODE, what its real data is worth, and how its training run is selected. They are
listed below in the order their evidence-per-hour justifies, not in the order they are interesting.

### Lever 1 — crop geometry: ⛔ CLOSED 2026-08-17, and it is not to be re-proposed

The encoder's frame is fixed at 409×583, so a long strip is squashed to fit. Padding exam crops with
their own empty staff proved **causally** that squashing costs edits (+59%, replicated on a holdout).
The pilot then showed **we cannot buy the reverse**: that probe's own baseline was already the exam's
19.2 px, and beating it needs crops narrower than one measure — the half-measure target measured at
**+31.8% worse**. The pre-registered short-crop stop rule fired at **5.4×** the control.

**The full case, the numbers, the pre-registration as signed, and the two claims in it that turned out
to be wrong** → **[METRICS-INPUT.md § Crop geometry — what the encoder is actually GIVEN](../METRICS-INPUT.md#crop-geometry--what-the-encoder-is-actually-given)**.

⛔ **The one thing that survived — one measure per strip — is DROPPED too (owner, 2026-08-19).** The
slicer **already** splits over-wide real crops at gutters (`_split_wide`, ~25% of crops), and what
drops a strip is the **59-id label budget**, not width: 8.9% of *single*-measure windows blow it
alone, which no measure rail can fix. That left a *training* match on the 32% of synthetic strips
spanning 2+ measures, on the axis of three consecutive nulls. [../DECISIONS.md](../DECISIONS.md).
⚠ **The short-crop hole is now the blocking item on this axis**, promoted from side condition.

### Lever 1b — musical form: ⛔ DEAD 2026-08-17, and the premise itself is withdrawn

Proposed and retracted the same day, then killed outright when the **owner retested the app**:
classical pages read no worse than songs (*"it is not read it well but it cannot read the songs as
well"*). There is no form axis. The measured ranking that started it survives as a number in
[../METRICS-EXAM.md](../METRICS-EXAM.md); the full reasoning, the supply ceiling, and the process
lesson are in [../log/superseded.md](../log/superseded.md). ⚠ **The "it is really scan quality"
explanation is ALSO withdrawn (2026-08-18)** — it rested on `nd`, which is `lev(label, decode)/
len(label)`, not degradation, so it restated the finding instead of explaining it
([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). What killed the lead is the owner's retest, which
needs no mechanism.

⚠ **Do not re-propose collecting repertoire by form.** ⚠ The separate decision to collect real pages
**broadly** is unaffected and still stands ([../DECISIONS.md](../DECISIONS.md)).

### Lever 2 — decoding: we have never used anything but greedy

Every decode in this project is greedy — `eval_omr.py`, `onnx_greedy_decode`, the browser and the
server all take the argmax at each step. Three standard upgrades were listed here; **only the second
survives** (owner, 2026-10-04 dropped beam search, which took the third with it). It needs **no
training and no labels**, and costs nothing at decode time beyond a mask:

1. ~~**Beam search.**~~ ⛔ **DROPPED (owner, 2026-10-04)** — it lengthens every read, and a fast read
   is the app's point. Do not re-propose it; reasoning in [../log/superseded.md](../log/superseded.md).
2. **Grammar-constrained decoding** — mask tokens that cannot legally come next. Our label language
   is small and rigid: `\sig … \sigend`, `\tup3 … \tupend`, `\grace` precedes a note, two accidentals
   never adjoin, a pitch is followed by a duration. Illegal sequences the model already emits (a
   doubled `\volta2`, an unterminated block) become impossible rather than merely unlikely.
3. ⛔ **A bar-duration checksum over the beam — DROPPED with the beam (2026-10-04)**: re-ranking needs
   several candidates, and greedy makes one. The editor already *flags* a bar that does not fill its
   meter (`data-bar-fill="over|under"`, [../CODE_TOUR.md](../CODE_TOUR.md)); that stays.

⚠ This lever moves the shipped runtime, not the corpus, so it is scored against the same real-val
pool and carries the same rule as any other change: pre-register what counts as a win before
running it. ⚠ It also changes the browser/server decode path, so `gate:browser` and
`parity:server` are part of its cost.

### Lever 3 — real data: clean it before growing it

> ⏭ **RE-AIMED 2026-08-19 (owner): clean the SCANNED pages, not the born-digital ones.** The cleaning
> argument below is unchanged and is now the live work; what moved is *which tier* it runs in. Two
> measurements decided it ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)): **93% of exam pages are
> scans** (62 of 67), so `batch2` was cut from the tier supplying 7% of the graded medium; and its
> own verdicts read a **~12% fix rate** against **30%** in the scanned nota pool. A batch row is
> seeded with the decode, so an `ok` changes the training data by nothing — the yield of a batch is
> its *fix* rate. The plan is a `batch3` on the scanned tier, **not** unparking `batch1` (it is the
> most-damaged pages corpus-wide, so it concentrates the deferred handwriting, and 10 of its 52 pages
> are born-digital anyway). [../DECISIONS.md](../DECISIONS.md) ·
> [labeling.md § The labelling queues — reslice-all, the batches, b8 and examv3](../rung3/labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3).

> ⚠ **PARTLY OVERRULED 2026-08-17 (owner): collect broadly from more sources now**, beyond
> neyzen.com and notaarsivleri.com. The cleaning argument below is unchanged and still owed — what the
> owner rejected is the *sequencing*, i.e. "clean first, then grow". Both halves are on the record in
> [../DECISIONS.md](../DECISIONS.md), including the cost: 2,486 real page PNGs already sit on disk
> unlabelled, so a wider funnel does not relieve the bottleneck this section names. Two rules do not
> bend with it — read a new source's licence before redistributing anything, and any flow that feeds
> training must keep **refusing exam pieces**.
>
> ⏭ **NARROWED 2026-08-20 (owner), not reversed.** Broad collection stays permitted; what is
> *scheduled* is two targets volume cannot substitute for — pages drawing the **concave tuplet mark**
> (unscoreable today: no labelled real strip carries it) and **tuplet-dense instrumentals**
> (sirto/longa/saz semaisi, excluded from training *and* the exam by the 59-id budget, not by taste).
> ⚠ Collecting the second **does not fix it** — the same budget drops the new pages too, so it is
> paired with the ceiling measurement in [../BACKLOG.md](../BACKLOG.md) or it buys drops. Candidate
> sources are listed once, in [../DECISIONS.md](../DECISIONS.md), so they are not re-searched.

The owner has offered to label more real pages ([../STATUS.md](../STATUS.md)). The evidence says the
first move is not more rows:

- **Label noise is measured and it lands on the metric Round 3 targets.** The nota pool's audited
  pitch-level error rate, and the finding that ~78% of labels were wrong wherever label and decode
  disagreed, are in [../METRICS-CORPUS.md](../METRICS-CORPUS.md). Pitch is 40% of user corrections;
  training pitch against noisy pitch labels sets a ceiling no amount of new data raises.
- **Audit the axis we have never audited.** Every audit so far was aimed at accidentals, because the
  headline was accidentals. A pitch/duration-focused re-audit of a random sample is the missing one.
- **Then grow PAGES, not strips.** Round 3's primary number is a per-page rate and the exam is 46
  pages; see the power note below. More pages is the only thing that makes that number mean
  something.
- **Then nota over neyzen.** The scanned TRT-era prints run ~5× the SER of the neyzen scans
  ([../METRICS.md](../METRICS.md)) and dominate the hard tier. That is where a labelled row buys the
  most. ⚠ This line used to call neyzen "clean vector PDFs"; a 2026-08-18 census found **none** of
  them born-digital ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). The ranking is unchanged — it
  rests on the SER split, not on the file format. ⚠ **Nota is not one tier either**: 88 nota pieces
  ARE born-digital, and the owner's 2026-08-18 call is to label those first
  ([../DECISIONS.md](../DECISIONS.md)).
- **The raw material is already on disk** — 1,259 + 1,227 real page PNGs
  ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). Collection is not the bottleneck; labelling
  throughput is.
- **The fastest labelling tool we have is the app.** Correcting a decode in the editor is far
  cheaper per page than labelling from scratch, and it produces exactly the page-level gold the
  primary criterion is stated in. ⚠ Any such flow must refuse exam pieces, the way
  `build_tuplet_val.py` and the train-time guard already do.
- **Self-training on the unlabelled pages** is the standard next step in this literature, and the
  standing rule for it here is the one this project already learned the hard way: a decode-derived
  label measures self-consistency, not correctness (2026-07-23, the mid-tier inflation). If it is
  used, it goes in **training only, never into a metric pool**, and only where two independent
  reads agree.

### Lever 4 — renderer diversity: one engine, one font, one spacing

> ✅ **BUILT AND PILOTED 2026-08-18 — the second engraver works, the gate passes 312/312, and the
> domain gap did NOT move.** LilyPond 2.26 renders our own labels (`tools/render/render-ly.ts`),
> its `makam.ly` draws all eight AEU accidentals under the same comma→glyph convention we use, and
> a full corpus would cost ~76 min. Every number, and the two limits the null result carries — the
> measurement is blind to most of what an engraver changes, and the staff geometry was **pinned on
> purpose** — are in [METRICS-INPUT.md § Metrics — the second engraver (Round 3, Lever 4)](../METRICS-INPUT.md#metrics--the-second-engraver-round-3-lever-4).
> ⏭ **The decision this leaves open is whether a mixed corpus earns a trained arm.** Nothing below
> this line is evidence for it; the pilot bought feasibility and a gate, not an accuracy claim.
> ⚠ **The "one spacing" third of the premise is still untouched**: varying document scale per strip
> is engraver-neutral and one line in either renderer, and it is the part that actually addresses the
> SD-zero number. It is a separate change and it is not made.
> ⚠ **Four things are owed before this arm could stand beside `strips_v4`** rather than beside a
> control: slur distractors, repeat/volta/nav marks, lyrics and text, and the `every`-mode transposed
> share. Listed with the reasons in [METRICS-INPUT.md § Metrics — the second engraver (Round 3, Lever 4)](../METRICS-INPUT.md#metrics--the-second-engraver-round-3-lever-4).

> ⏭ **PROMOTED 2026-08-17 (owner): this runs AFTER Lever 1 and BEFORE the content work**, re-ordering
> the 2026-07-27 decision that made the note-value mix Round 3's content change. The content work is
> not cancelled — it moves behind a second engraver, because the *make-our-pixels-more-realistic* axis
> is at diminishing returns while the engraving itself has never been varied at all.
> [../DECISIONS.md](../DECISIONS.md).
>
> **A candidate arrived with it, from the owner's eye rather than a probe.** A real page sets the
> triplet "3" **between the curve and the noteheads** — inside the arc's concavity — which is neither
> shape we have drawn (legacy: continuous arc, digit outside above the apex; current: broken arc,
> digit in the gap). ⚠ That is a potential counterexample to *"16 of 16 marks break the arc, and not
> one continuous arc with a floating digit exists in the real pools"* ([rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](#tuplets--why-tup3-recall-keeps-missing-its-floor)) — a
> sample of 16 across ~11 editions is small enough for one to exist. **Measure it with
> `tuplet_mark_probe.py`; render nothing yet** (a third mark style inside the geometry render is a
> second variable). If it confirms, it enters as a **per-piece coin** like bracket-vs-curved, which
> makes it a diversity item rather than a correction. ⚠ Expect little from it on recall: the shape A/B
> was **null** (p = 0.688) and the surviving lead points away from the renderer.

Every one of the 40,826 strips is VexFlow + Bravura at a staff spacing whose raw standard deviation
is **zero** ([rounds.md § Round 3 — the notes themselves: where they sit and how long they are](#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are) §1). Current synthetic-data work in this field does the opposite
— randomising font family, document scale, margins, line width and system spacing, or compositing
real glyphs and paper — and reports the diversity itself as the thing that closes the synthetic→real
gap. We have varied the *degradation* of one engraving heavily (`augment.py`) and the engraving
itself not at all. ⚠ **"Heavily" needs one qualification, added 2026-08-19**: the degradation we vary
is aimed at the *deployment* distribution (screenshots and camera photos), and there is **no scan
profile at all** — see Lever 7.

The cheapest second domain is one we half-own: `packages/core/src/labels/lilypond.ts` already emits the label
language, so rendering the same pieces through real LilyPond would give a genuinely different
engraver at no labelling cost. ⚠ The hard rule that pixels and labels come from one code path
([../../CLAUDE.md](../../CLAUDE.md)) is the thing to design around here, and `verify-labels.ts` is
the gate any second renderer has to pass before a corpus built with it is trainable.

### Lever 5 — the training recipe: cheap, standard, none of it done

- **`best` is selected on teacher-forced val loss, and the weighting is now measured: 94.6%
  SYNTHETIC / 5.4% real** — 4,769 val strips against 271, blended by strip count every 500 steps
  ([../../ml/omr/train.py](../../ml/omr/train.py), numbers in
  [../METRICS-CORPUS.md](../METRICS-CORPUS.md)). Round 2 selected its final step and
  `best == last` while real-val loss had already turned — the selector cannot see the metric we
  care about. Selecting on a **free-running** real-val number (edits/page) is the fix.
- **No label smoothing, no weight EMA, one seed.** All three are standard for a seq2seq of this size
  and each is a one-line change.
- **Stage 2 overfits within ~1,000 steps** on 2,337 real strips, in both Round 1 and Round 2. The
  answer is not a shorter stage 2 chosen by hand (that is tuning on a pool with a measured gap to
  the exam) but EMA plus early stopping on the free-running metric, and a lower encoder LR.

### Lever 6 — the articulation hole: every dot we have ever drawn meant "longer"

> ✅ **BUILT, TRAINED AND PASSED — 2026-08-20.** Round 3's arm 2 did what it was built to do: the
> staccato-triggered false-dot rate goes **72.7% → 0.0%** (0 of 110 marked strips), paired **60–0**
> against its training control (p = 1.7e-18). Clause 2 **passes**, clause 3 shows **no price**.
> ⚠ Transfer to a *real printed* staccato is **unmeasured** — no labelled real strip carries one.
> ⏭ **Whether the flag rides the final render is OPEN and the owner's.**

**The model read a printed staccato as an augmentation dot and lengthened the note**, because
`ADDED_TOKENS` has no articulation token and the renderer drew none — 0 of 40,826 strips carried one,
so every dot the model had ever seen meant *longer*. The label language had no legal way to say
"dot, but not a duration dot".

⭐ **This is the one lever in this file that a trained arm has moved**, and the contrast is the
transferable part: the three nulls all asked the model to read something it **already knew** from
more realistic pixels; this one showed it a symbol it had **never seen**. A **hole** responds; a
**domain gap** does not.

**Moved out of this file 2026-08-20** — the hole, the draw and its three rejected placements, the
signed pre-registration, the result and the open disposition are in
**[rounds.md § The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES](#the-staccato-distractor--round-3s-arm-2-lever-6--passes)**, the way arm 1's live in
[rounds.md § The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL](#the-scan-profile--round-3s-first-trained-arm-lever-7--null). Numbers: [METRICS-INPUT.md § Diagnostics — the symbols the model has never been shown](../METRICS-INPUT.md#diagnostics--the-symbols-the-model-has-never-been-shown).

### Lever 7 — the medium hole: we have never simulated a SCAN

> ⛔ **BUILT, TRAINED AND NULL — 2026-08-19.** Round 3's arm 1 ran and moved nothing on the medium
> it was built for: **+0.071 edits/strip on scanned pages (`best`), +0.010 (`last`)**, both intervals
> spanning zero, over 197 paired strips. The no-regression clause on born-digital pages **passes**,
> with a point estimate that favours the arm and also spans zero. ⚠ The interval excludes anything
> better than a **~5% reduction**, so this is an informative null, not an underpowered one. The
> profile, the ops, the signed pre-registration and the disposition are in
> **[rounds.md § The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL](#the-scan-profile--round-3s-first-trained-arm-lever-7--null)**; the numbers in
> [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

`ml/omr/augment.py` had exactly two profiles — `screenshot` (0.65) and `photo` (0.35,
`PHOTO_SHARE`) — and **93% of the exam is scans** (62 of 67 pages,
[../METRICS-CORPUS.md](../METRICS-CORPUS.md)). A flatbed or office scan of a TRT-era print is
neither: **flat lighting and no perspective**, so the photo pipeline's most expensive ops model
nothing that is there, while it *does* have speckle and dust, broken thin lines, ink spread,
bleed-through, small skew and threshold damage — none of which either profile drew. ⚠ `augment.py`'s
own comment had been asking for this since July: *"Revisit against real usage at Rung 3."*

**Why it goes first among the trained arms.** No re-render, no new labels, no render slot, one
module — and its control is already on disk (`r3-tupnew-stage2-best`), so it costs **one** GPU run.
Every other item on this list costs a corpus render or human labelling.

⚠ **The trade, on the record before the arm ran.** `PHOTO_SHARE` came from the owner's report that
real uploads are mostly web screenshots, and the constant explicitly warns against pushing the mix
for "harder training". Aiming augmentation at scans optimises **the exam**, which may not be what
the app's users upload (n=2 — [METRICS.md § Metrics — who actually uses the deployed app](../METRICS.md#metrics--who-actually-uses-the-deployed-app)). The profile is added
**beside** the two, never substituted, and the no-regression clause on born-digital pages is that
trade made checkable.

⚠ **The signed instrument is the MEDIUM split, not the difficulty tier this file first drafted** —
the hard tier's gold is 110 rows seeded with a model decode and then confirmed, which flatters that
model's descendants, and it scores *better* than mid as a result. The reasoning and the numbers are
in [rounds.md § The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL](#the-scan-profile--round-3s-first-trained-arm-lever-7--null) and [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

### The ordering, and the content work

The content work in `select_pieces.py` — the eighth/quarter-note mix and bar-line density — remains
Round 3's stated content change (owner, 2026-07-27). Two things about how it interacts with Lever 1,
because they decide what to render first:

1. **It moves strip width as a side effect.** Denser note values and different bar-line spacing
   change how wide a measure is, and therefore how hard the encoder squashes it. Rendering the
   content change and the geometry change together would leave Round 3 unattributable for the third
   round running (Round 2 changed three things; the tuplet A/B was built specifically to avoid
   repeating that).
2. **Its direction may already be wrong on width.** Our strips are *wider* than the real pools'
   ([rounds.md § Round 3 — the notes themselves: where they sit and how long they are](#round-3--the-notes-themselves-where-they-sit-and-how-long-they-are) §4), and denser music widens a measure further. So the content selection
   should carry a **strip-width target**, measured on the 300-strip pilot, rather than being read
   only as a note-value histogram.

**Therefore:** the content work is not cancelled and nothing about it is superseded; it is sequenced
behind measurements that can change what it should render.

> ⏭ **The ordering as it actually stands, 2026-08-17.** The Lever-1 probe ran (causal), its follow-up
> pilot ran and was **stopped by the pre-registered rule**, and the owner then promoted **Lever 4
> ahead of the content work**. So "the next render is a geometry render" — true on 2026-08-15 — is
> **no longer the ordering**. Three render-side items are owed and **no two may be rendered together**:
> Lever 4's second engraver, Lever 1's surviving one-measure-per-strip corpus render, and Lever 6's
> staccato arm. Lever 4 is first by the owner's decision; the order of the other two is undecided and
> is a call to take deliberately. The content work stays behind all of them.
>
> ⏭ **Updated 2026-08-18: Lever 4's PILOT is done and it did not consume the render slot.** It
> rendered 312 strips into a pilot pool, not a corpus, and its result (null on the domain gap) is not
> a reason to render one. So **two render-side items remain owed** — the one-measure-per-strip corpus
> render and the staccato arm — and the choice between them is still a deliberate call, now with no
> third item competing.

#### ✅ The order as it ran — the arms are DONE (2026-08-20)

| # | Arm | Costs a render? | Scored on |
|---|---|---|---|
| 1 | **Lever 7** — the scan profile | no | ⛔ **RAN, NULL** — edits on `_realval_v2_scan`, paired ([rounds.md § The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL](#the-scan-profile--round-3s-first-trained-arm-lever-7--null)). `scan_share` stays **off** in the final model (owner, 2026-08-19) |
| 2 | ~~**Lever 1's survivor** — one measure per strip~~ | — | ⛔ **DROPPED 2026-08-19** — see below |
| 3 | **Lever 6** — the staccato arm | yes | ✅ **RAN, PASSES** — the paired false-dot pool, **72.7% → 0.0%** ([rounds.md § The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES](#the-staccato-distractor--round-3s-arm-2-lever-6--passes)). ⏭ Whether the flag rides the final render is **open, the owner's** |
| 4 | the final Round-3 model | — | ⏭ **next** — then **the exam, read once** |

⛔ **Arm 2 is dropped; the objection that killed it is under Lever 1 above.**

**No two together.** Round 3 has been unattributable twice already, and the tuplet A/B was built
specifically to stop it happening a third time.

⛔ **ARM 1 IS SPENT AND IT WAS A NULL (2026-08-19).** ⚠ **Read this before choosing what follows arms
2 and 3.** That is now **three** results on the "make the synthetic pixels look more like real pages"
axis and all three are null: the tuplet-mark A/B (p = 0.688), the second engraver's domain gap
(measured, null, no arm), and this scan profile (p = 0.105 / 0.488). This file's opening argument —
that the axis is at diminishing returns — was an inference from pre-render probes; it is now backed
by a **trained** arm. Arms 2 and 3 are not on that axis (one is what the model is *given*, the other
a symbol it has *never seen*), so they stand.
⭐ **AND ARM 3 THEN SETTLED IT (2026-08-20).** The staccato arm — the one off this axis — is the only
one of the four that **moved its primary**, 72.7% → 0.0%. The contrast is now measured rather than
argued: **a hole in what the model has been shown responds to being filled; a domain gap does not.**
That is the sentence to weigh a future arm against ([rounds.md § The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES](#the-staccato-distractor--round-3s-arm-2-lever-6--passes)). What should not happen is a fourth realism arm being
proposed because the first three "nearly" worked.

⚠ **One asymmetry worth knowing when the budget gets tight.** The staccato arm is the only one with
its **own** targeted instrument — the paired pool (`_staccato_falsedot_ctl` / `_staccato_falsedot_stac`)
measures the false-dot rate whatever else changed in the corpus. So folding it into another render
would leave the *staccato* claim intact and the general result unattributable. That is a real option
and it is **not** the plan; it is written here so the trade is visible rather than rediscovered.

⚠ **Arms 1–3 do not need the labelling to finish.** Only the final model consumes the corrected
scanned labels, so the human and compute tracks run in parallel.

⚠ **Lever 4 gets no arm.** A LilyPond corpus is not rendered: the pilot returned null on the domain
gap, and four recipe items are owed before that arm could stand beside `strips_v4` at all
([METRICS-INPUT.md § Metrics — the second engraver (Round 3, Lever 4)](../METRICS-INPUT.md#metrics--the-second-engraver-round-3-lever-4)).

### ⚠ A power note on the primary criterion — the owner's call, not an agent's

[rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) is signed and **is not re-opened here**. But the number it
is stated in deserves saying out loud before the read rather than after: the primary floor is a
per-page rate measured on **46 pages**, so its 95% interval is roughly **±12 points**. A model truly
at 72% can read 78%, and one truly at 78% can read 72%.

There are exactly two honest responses, and both have to be chosen **before** the exam is read:

1. Grow the exam (v3 is already owed — [README.md § The exam — freezing an honest test set (Steps 2 and 3)](../rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3)) so the gate can resolve what it is
   asking, keeping the one-shot rule intact by doing it before the read; or
2. Read it as signed and report the interval beside the result, accepting that a near-miss and a
   near-pass are not distinguishable at this n.

Choosing after seeing the number is the one option that is not available.

✅ **ANSWERED 2026-08-20 (owner): BOTH, and option 1 is bounded.** The exam grows to **67 pages** —
the 21 it already owns and has never labelled, free in training terms because their pieces are
already exam-only — and then stops; the interval is reported beside the result regardless. ⭐ **The
number that decided the bound is not the error bar but what it takes to DEMONSTRATE a pass**: against
a 75% floor a model must *measure* ~86% at 46 pages and still ~81% at 200, so no affordable exam
makes a near-boundary call crisp, and buying pages is the wrong purchase. Plan, cost and the binding
side condition (re-score the Round-2 baseline on the grown exam): [README.md § The exam — freezing an honest test set (Steps 2 and 3)](../rung3/README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3). Census, drop
table and sizing arithmetic: [METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument). Decision row:
[../DECISIONS.md](../DECISIONS.md).
⭐ **A second finding came with it and it is not about size at all**: the exam grades **326 of 608**
candidate strips on its own pages — 282 are dropped, and they are the **wide and dense** ones. So the
exam reads each page on its easier material, which is a further reason the ceiling measurement in
[../BACKLOG.md](../BACKLOG.md) pays here and not only on training data.

### Where the outside evidence comes from

Named here so the next session does not re-derive it. Nothing below is a measurement of ours.

- Beam search + grammar-constrained decoding as the standard inference setup for end-to-end OMR
  (Transcoda, 2026) — <https://arxiv.org/abs/2605.10835>.
- Synthetic-to-real for real scans: renderer diversity, replay while adapting, and a **small**
  authentic fine-tune carrying most of the gain — <https://arxiv.org/html/2606.09479v1>.
- Source-free domain adaptation for OMR (adapting on unlabelled target pages) —
  <https://link.springer.com/chapter/10.1007/978-3-031-70552-6_1>.
- Full-page end-to-end OMR with curriculum pretraining (SMT / SMT++) —
  <https://arxiv.org/abs/2402.07596>.
- Round 4's additions — LEGATO, the SMT encoding study (bekern), Transcoda's beam numbers, the
  authentic-fine-tune scan paper — are listed once in [round4.md](../rung3/round4.md).


## The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL

*Was `docs/archive/rounds/scan-profile.md` (last updated 2026-08-19).*

> ⛔ **ARCHIVED 2026-10-08 — Round 3 closed on 2026-09-03.** Moved here from `docs/rung3/`. Every
> ⏭ / "next" / "owed" below is as of its own date and is NOT a current action: the exam was read
> once (51% against 75%), Round 4 is the live round ([../../rung3/round4.md](../rung3/round4.md)),
> and current state is [../../STATUS.md](../STATUS.md).

> ⛔ **RESULT, 2026-08-19: the arm is a NULL on its primary and its no-regression clause passes.**
> On scanned pages, 197 paired strips: `best` **+0.071** edits/strip, 95% CI [−0.203, +0.335],
> p = 0.105; `last` **+0.010**, CI [−0.198, +0.208], p = 0.488. **Both checkpoints, same answer** —
> and the interval excludes anything better than a ~5% reduction, so this is an informative null
> rather than an underpowered one. Every number:
> [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md). The disposition is at the bottom of this
> file.
>
> Part of the real-page track — index: [README.md](../rung3/README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). The lever this serves is [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) Lever 7;
> Round 3's binding floors are [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) and **nothing here changes
> them**. Numbers: [../METRICS.md](../METRICS.md), [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

### The hole

[`ml/omr/augment.py`](../../ml/omr/augment.py) had exactly two profiles — `screenshot` and
`photo` — and **93% of the exam is scans** ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). A flatbed
or office scan of a TRT-era print is neither: **flat lighting and no perspective**, so the photo
pipeline's most expensive ops model nothing that is there, while it *does* have speckle and dust,
broken thin lines, ink spread on thick strokes, bleed-through from the reverse side, a small skew
and threshold/halftone damage — none of which either profile drew. The module's own comment had
been asking for this since July: *"Revisit against real usage at Rung 3."*

⚠ **The trade, stated before the arm ran and accepted knowingly.** `PHOTO_SHARE` was set from the
owner's report that real uploads are mostly web screenshots, and the constant carries an explicit
warning against pushing the mix for "harder training". Aiming augmentation at scans optimises **the
exam**, and we do not know that the exam's medium is what the app's users upload (n = 2 —
[METRICS.md § Metrics — who actually uses the deployed app](../METRICS.md#metrics--who-actually-uses-the-deployed-app)). So the scan profile is added **beside** the two, never
substituted, and the mix is pre-registered rather than tuned.

### What was built

`scan_share` (default **0.0 — OFF**) selects a third profile whose ops run in the order a scan
actually degrades, which is not the photo order:

| op | models | note |
|---|---|---|
| `bleed_through` | the reverse side ghosting through thin paper | mirrored, blurred, faded copy of the page's own ink |
| `paper_texture` at scan settings | near-neutral grey paper | flatter and cooler than the photo profile's beige |
| `ink_variation` | ink spread, or faded print | shared with the photo profile |
| `scan_skew` | the transport's residual skew | **±0.3°, not ±2°** — see the caveat below |
| `speckle_dust` | platen dust and sensor dropout | dark specks, light pinholes, a few larger motes |
| `line_dropout` | thin lines breaking into dashes | **thin ink only**, in runs — see below |
| `threshold_damage` | the scanner's own binarisation, drifting across the page | a soft sigmoid, never a hard 1-bit |
| `scanner` (albumentations) | fixed-focus blur, sensor noise, JPEG | milder than the camera pipeline |

Three design points that are load-bearing rather than incidental:

- **`line_dropout` erases THIN INK ONLY.** The mask is `dark − open(dark)` with a 3×3 element, so it
  contains staff lines, stems and flag edges and *cannot* contain a beam or a notehead — which is
  what keeps the op label-preserving. It erases in **runs of 3–10 px**, not single pixels: a
  per-pixel mask reads as noise on an intact line, while a real scan drops a few millimetres at a
  time. The gap is filled with the **local paper** (a dilation of the image), never with white.
- **±0.3° of skew, not the photo profile's ±2°.** Measured previously in this file's own history:
  over an 1,100 px strip one degree walks a staff line 19 px, and a ±1° rotation once pushed the
  share of synthetic strips too skewed for a staff-line detector from ~15% to 68%. The slicer also
  deskews a page before cutting, so only a small residual reaches strip level.
- **`threshold_damage` is soft.** A real 1-bit threshold destroys beam detail, and beam detail is
  duration. The op mixes a wandering sigmoid with the greyscale rather than replacing it.

⚠ **`--seed` does not make augmentation reproducible, and never did.** Measured while building this:
**albumentations 2.0.8 seeds its transforms at construction from OS entropy**, so the same module run
twice produces different pixels regardless of `random.seed` / `np.random.seed`. `--seed` fixes the
model init, the shuffling and this module's own generator — not the images. Two runs of one recipe
are the same *distribution*, never the same data. The scan transforms are therefore built **lazily**,
so a run that does not ask for scans constructs exactly what it constructed before; equivalence with
the previous revision was verified by replaying 400 draws (ink coverage and mean brightness agree,
KS p = 0.94).

### The pre-registration — signed 2026-08-19, before training

Full text, with the reasoning for the instrument, in [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) Lever 7. In brief:

| | |
|---|---|
| **Mix** | screenshot **0.55** / photo **0.20** / scan **0.25** (owner) |
| **Primary** | edits on `_realval_v2_scan` (202 rows / **197 unique strips** / 74 pages), paired against `r3-tupnew-stage2-best` |
| **No-regression** | `_realval_v2_borndigital` (65 strips / 13 pages) |
| **Reported, not gated** | the three tiers, the whole pool, per-class AEU F1, the mix used, `last` beside `best` |

**The control is already trained.** `data/checkpoints/r3-tupnew-stage2-best` used this corpus
(`strips_v5_tupnew`), this split, this recipe, these step counts and this seed — so the arm costs
**one** GPU run, not two, and the augmentation mix is the only difference.

⚠ **THE ONE THING THAT WOULD BREAK THE PAIRING: promoting labels into the real pools before the arm
is read.** The arm and the control share `strips_nota` / `strips_r1` / `strips_tup` *as they stand
today*. Labelling itself is safe — a `batch3` verdict lands in `reslice_all.csv` and nowhere else —
but `promote_labels.py` rewrites a pool's `manifest.jsonl`, and so would re-emitting the pools (B8).
Either between now and the read makes the arm differ from its control in **corpus and mix**, which is
exactly the unattributability Round 3 has already paid for twice. So the labelling (B2) and this run
are independent and may go in either order; **promotion waits for the read.**

⚠ **The instrument changed from the drafted one, on a measurement.** The draft said "hard tier,
which is where the scanned pages are". It is: 97 of its 110 strips are scan-sourced. But all 110 of
its rows are gold **seeded with a model decode and then confirmed by a person**, which flatters that
model's descendants — and it shows: the hard tier scores *better* than the mid tier. The medium
split has no such asymmetry, is twice the size, and separates the media by 4.5× in SER. Numbers:
[../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

### Running it

```bash
# 1. look at what the profile does, at a size a person can actually read
.venv-ml/bin/python ml/omr/augment.py --strips-dir data/synthetic/strips_v5_tupnew \
    --n 3 --profiles scan,scan,scan --stack --out data/synthetic/aug_preview_scan.png

# 2. the scoring pools (idempotent)
.venv-ml/bin/python ml/labels/split_realval_tiers.py --force

# 3. the Colab package — ships strips_v5_tupnew, NOT a scan-specific corpus
sh scripts/make_round3_colab_zip.sh scan       # -> data/colab/tnc_round3_scan_colab.zip (688 MB)

# 4. ml/notebooks/round3_scan_profile_colab.ipynb, run top to bottom (the owner drives this)
#    stage 1: 6000 steps @ lr 3e-5, batch 16, from BASE
#    stage 2: 2000 steps @ lr 1e-5, the three real pools at :9
#    both stages carry --photo-share 0.20 --scan-share 0.25

# 5. read it, arm and control, on the same pools
for p in _scan _borndigital _hard _mid _easy ""; do
  .venv-ml/bin/python ml/omr/eval_omr.py --checkpoint data/checkpoints/<ckpt> \
      --strips-dir data/real/rung3/_realval_v2$p --split none --show-errors 0
done
```

⚠ **The mix is the whole experiment and nothing downstream records it** — corpus, split and
checkpoint are identical between the arm and its control. `train.py` prints
`augment=on (screenshot 0.55 / photo 0.20 / scan 0.25)` in its startup line, and the notebook
asserts the numbers reaching the `Augmenter` before any long run. That log line is the only evidence
of which arm a checkpoint is.

⚠ **The scan profile is CPU work per sample.** Round-1's T4 run was already augmentation-CPU-bound;
if throughput reads low, raise `--num-workers` before suspecting anything else. Step counts and
batch size must match the control's.

### Reading the result

- Quote the **paired per-strip** difference as the headline; `edits/page` on these pools is edits per
  **page fragment** (2.7 and 5.0 strips a page), because the pools are not page-complete.
- Never quote `share_le5` from them: that number is defined on the 46-page exam.
- 202 and 65 strips resolve a large move and nothing subtle. Say so beside the number.
- **A null is reported as a null**, and the mix is not re-tuned to chase a win. That is what the
  pre-registration is for.
- ⚠ The exam is **not** read here. One shot, on Round 3's final model
  ([rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol)).

### ⛔ The disposition (2026-08-19)

**Both checkpoints agree, so the read does not turn on a selector we already distrust.** `best`
(step 500) and `last` (step 2,000) are separate models here — stage 2's mix loss peaked at step 500
while real-val loss kept falling — and both are null on scanned pages, with the under-trained one
slightly the worse. That closes the one methodological hole this arm had.

**Reported as a null, and the mix is not re-tuned.** That is what the pre-registration is for: the
share was chosen before the code was written precisely so that a disappointing result could not be
answered by moving it. ⚠ Do not propose a 0.35 or 0.15 scan share "to see if that works" — a number
tuned against this pool stops being evidence about anything.

**What the arm bought, honestly:** nothing measurable on the medium it was built for, and a
non-significant improvement on the medium it was not. It cost one GPU run and no render slot, which
is exactly why it went first.

✅ **SETTLED 2026-08-19 (owner): the profile does NOT stay on. `scan_share` is left at its 0.0
default, so the final Round-3 model trains without it.** The case for keeping it was only that it did
not hurt and that the born-digital point estimate favoured it — a choice made on two nulls. Against
that: every profile in the mix is a claim about what users upload, and `PHOTO_SHARE` came from the
owner's report that real uploads are mostly web screenshots. The flag is off by default, so **doing
nothing carries the decision** and no code moves. ⚠ The profile itself is **not** deleted: the module,
the preview command and this write-up stand, so a later round can turn it on with one flag rather
than rebuild it. [../DECISIONS.md](../DECISIONS.md)

⚠ **This is the second trained Round-3 arm to return a null** — the tuplet-mark A/B was p = 0.688,
this is p = 0.488 — and Lever 4's second engraver returned a third null on the domain gap without
being trained at all. Three attempts to make the synthetic pixels more like real pages have now
moved nothing measurable. [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) already argued that axis was at diminishing
returns; this is the first *trained* evidence for it rather than an inference, and it should weigh
on what gets built after arms 2 and 3.


## The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES

*Was `docs/archive/rounds/staccato-arm.md` (last updated 2026-08-20).*

> ⛔ **ARCHIVED 2026-10-08 — Round 3 closed on 2026-09-03.** Moved here from `docs/rung3/`. Every
> ⏭ / "next" / "owed" below is as of its own date and is NOT a current action: the exam was read
> once (51% against 75%), Round 4 is the live round ([../../rung3/round4.md](../rung3/round4.md)),
> and current state is [../../STATUS.md](../STATUS.md).

> ✅ **RESULT, 2026-08-20: the arm PASSES its primary and both other clauses.** The
> staccato-triggered false-dot rate goes **72.7% → 0.0%** (0 of 110 marked strips), paired **60–0**
> against its training control `r3-tupnew-stage2-best` (exact McNemar p = 1.7e-18) and **80–0**
> against the live model (p = 1.7e-24). Clause 2 **passes**: 65/71 real dots kept on easy+mid against
> the control's 66/71, one discordant strip, p = 1. Clause 3 shows **no price** — every AEU and F1
> cell level or slightly up. Every number:
> [METRICS-INPUT.md § Diagnostics — the symbols the model has never been shown](../METRICS-INPUT.md#diagnostics--the-symbols-the-model-has-never-been-shown); the training run itself:
> [../../ml/omr/MODEL_EVAL.md](../../ml/omr/MODEL_EVAL.md) and the raw console log
> [log/raw.md](../log/raw.md#round_3_staccato_logs). The disposition is at the bottom
> of this file.
>
> Part of the real-page track — index: [README.md](../rung3/README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). The lever this serves is [rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) Lever 6;
> Round 3's binding floors are [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) and **nothing here changes
> them**.

### Why this arm worked when three others did not

⭐ **The transferable finding, and it is worth more than the number.** Round 3's other three
realism experiments (the tuplet mark A/B, the second engraver, the scan profile) were all nulls, and
they share a shape: each asked the model to read something it **already knew** from pixels that
looked slightly more like real pages. This arm showed it a symbol it had **never seen once** — 0 of
40,826 strips carried a staccato, and the label language had no legal way to say "dot, but not a
duration dot".

**A hole is not a domain gap, and it does not respond to the same medicine.** That is the rule this
result establishes, and it is why the `\repstart`-for-dotted-barline finding
([METRICS-INPUT.md § Diagnostics — the symbols the model has never been shown](../METRICS-INPUT.md#diagnostics--the-symbols-the-model-has-never-been-shown)) is worth pursuing while a fourth realism arm is not.

### The hole, and what was drawn

**Owner-reported 2026-08-15, then measured.** The model reads a printed **staccato** as an
**augmentation dot** and lengthens the note. The cause is structural, not a tuning problem:

- **`ADDED_TOKENS` has no articulation token** — all 25 are accidentals, structure and navigation.
  The augmentation dot is not a token either; it is a suffix inside the duration (`8` vs `8.`). So
  the label language has **no legal way to say "dot, but not a duration dot."**
- **The renderer draws no staccato**, so 0 of 40,826 strips contain one. The same shape of hole as
  the signature-only crop, and as the bare phrase slur before it was fixed.

**Measured, with a paired control** ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)): on 110
pilot strips carrying a staccato whose gold has no dotted duration, the model decodes a dot it has
no gold for **72.7% of the time** — against **0.0% on the identical music without the marks**, which
it reads 110/110 exactly. That is as clean as a causal attribution gets here.

**Built 2026-08-15, off by default:** `--staccato-noise` (`render.ts`) → `drawStaccatoDot`
(`SheetView.tsx`), label-free dots on the notehead side, following `drawSlurArc` exactly. The two
arms' manifests are **byte-identical** and `verify-labels` passes 1215/1215 with the marks on.

**What it teaches is POSITIONAL, and that is the design.** An augmentation dot is a suffix beside
the notehead, on its line or space; a staccato sits above or below it. So the draw deliberately
seeks out **already-dotted notes** — a notehead carrying both marks at once isolates position from
everything else, and is the only example that can. ⚠ Three placement drafts were rejected by eye
before one worked; the trap is that VexFlow's `getNoteHeadBounds()` returns the notehead's **anchor**
(`notehead.getY()`), not its ink edges, so any clearance measured from it lands half a notehead too
close. Notes on a line also cannot take the adjacent space centre at all — the dot's radius overlaps
the notehead's ink there at *any* clearance — so they get the space beyond it.

**Pre-registration, signed before any training (owner: duration over pitch):**

1. **Primary — the staccato-triggered false-dot rate must fall** from the 72.7% baseline.
2. **No-regression on real dots, on EASY+MID tiers only.** Hard-tier dropped dots are scan
   degradation (7 of 12, `nd` up to 1.14) and are excluded **here, in advance** — not after seeing a
   result. Hard tier is reported, never gated on.
   > ⚠ **FLAGGED 2026-08-17, NOT CHANGED — this clause is signed, so altering it is the owner's
   > call.** The stated *reason* for the exclusion uses `nd` as a scan-quality measure, and it is
   > not one: `emit_strip_labels.py` defines `nd` as `lev(label_ids, decoded_ids)/len(label_ids)`, a
   > label-vs-decode disagreement, and there is only one `nd` in the repo. Read literally, the
   > justification says "exclude the strips where the model disagrees with the label most, because
   > the model disagrees with the label most there". The **exclusion itself may still be right** —
   > hard tier is defined independently of `nd` — but its written reason does not carry it. Decide
   > before the staccato arm is scored, not after.
   > ✅ **SETTLED 2026-08-19 (owner), before any training: the exclusion STANDS, the reason is
   > replaced.** Re-opening a signed pre-registration mid-round is what would make the round
   > meaningless, so the gate does not move a point. It survives on two reasons that hold: hard tier
   > carries **~12 real-dot instances in total**, too few to gate on in either direction, and its
   > gold is the least reliable pool we own. Hard tier stays reported, never gated on — as written.
   > [../DECISIONS.md](../DECISIONS.md).
   > ⚠ **CORRECTED 2026-08-20, after the arm was scored — the FIRST of those two reasons is wrong.**
   > `_realval_v2_hard` carries **64** gold dotted-duration instances, comparable to easy+mid's 71
   > combined ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)). The "~12" is the Round-2
   > **exam's** dropped-dot count (0/5/7 by tier) — a different pool and a different quantity. ⛔ The
   > exclusion is **not** reopened: it is signed, it survives on the second reason, and the gate
   > passed on easy+mid regardless — hard tier was reported, as written. Recorded because this
   > clause's rationale has now failed twice, in the same way both times.
3. **Reported, not gated:** pitch/AEU macro F1, so the price of clause 1 is on the record.

⚠ The slur distractor's cost is the thing to watch: it took `\tup3` precision 15.1% → 91.2% and
**recall 92.7% → 83.8%, below its own floor**. Clause 2 exists so that outcome is caught rather than
discovered. ⚠ `STACCATO_RATE` is **chosen, not measured** — nobody has counted staccato frequency in
real Turkish editions, and doing so is how to replace it. ⚠ The alternative not taken is a
`\staccato` token: possible, but `ADDED_TOKENS` is **append-only** so it goes at the END, and it
needs gold annotation and an engraver change.

### The result

Full tables — the primary, clause 2 and clause 3 — live in
[METRICS-INPUT.md § Diagnostics — the symbols the model has never been shown](../METRICS-INPUT.md#diagnostics--the-symbols-the-model-has-never-been-shown). The training run, its loss curves and the
`best == last` note are in [../../ml/omr/MODEL_EVAL.md](../../ml/omr/MODEL_EVAL.md)
("Round 3 — arm 2").

**The strongest line in it is not the 0.0%.** The arm reads the **marked** pool exactly as well as
the **unmarked** one — 99.1% exact and SER 0.0002 on both — and its single non-exact strip is the
*same file with the same* `\bakiyeSharp → \komaSharp` *confusion* in each. The marks did not become
tolerable; they stopped carrying information about duration at all. That is what the positional
lesson looks like when it lands, and it is why the draw sought out already-dotted noteheads.

⚠ **The metric had no committed scorer until now.** The 2026-08-15 baseline was measured ad hoc, so
`ml/labels/staccato_falsedot_score.py` was written from the definition and its **first job was to
reproduce that baseline** — which it does to the digit (80/110, exact 27.3%, SER 0.0578) before being
trusted on the arm. `staccato_realdot_score.py` reads clause 2. ⚠ Doing that exposed something the
published number hid: the **training control sits at 54.5%, not 72.7%**. The defect's severity is not
a constant across checkpoints, so quoting the baseline as the control would have understated the arm
by roughly a quarter of its effect.

### What the arm does NOT establish

⚠ **The primary is measured on our own rendered staccato.** It shows the model no longer maps *the
dot this renderer draws* onto a duration dot. It does **not** show it reads a real printed staccato,
because **no labelled real strip in any pool carries one**. This is the identical blind spot to the
concave tuplet mark ([METRICS-DIAGNOSTICS.md § Tuplets — the corpus scan, the printed mark, and what follows the…](../METRICS-DIAGNOSTICS.md#tuplets--the-corpus-scan-the-printed-mark-and-what-follows-the-notes)) and it has the identical fix:
collect real pages that use the mark. Until then the claim is about our renderer, not about the world.

⚠ **`STACCATO_RATE` is still chosen, not measured.** Nobody has counted staccato frequency in real
Turkish editions. Doing so is how to replace it, on the same pass as the tuplet-style count.

⚠ **The corpus's 15-strip yield drift is undiagnosed.** `strips_v6_stac` came out 40,841 against the
control's 40,826, and the dots are not the cause — the same piece re-rendered with the flag **off**
gives the same higher yield, so it is drift since the control's 2026-08-14 render. The manifest was
filtered to the control's exact row set before training, so **the arm is unaffected**, but the drift
is a live unknown in the renderer and it is not written down anywhere else.

### The disposition — OPEN, and it is the owner's

⏭ **Does `--staccato-noise` ride the final model's render?** The flag is **off by default**, so
**doing nothing leaves it out** — the same way `scan_share` was settled for arm 1.

**For:** it is the only Round-3 arm that moved its primary, and it did so at no measured cost on
either of the other two clauses.

**Against, and both halves are real:** the win is on **our own drawn mark**, with no real-strip
evidence behind it (above); and the final render **already** carries `--concave-tuplet`, so turning
both on makes that render a **two-variable change** whose parts cannot be told apart afterwards.
Round 3 has already been made unattributable twice, which is the whole reason the arms run one
variable at a time.

⛔ **Whatever is decided, it is decided BEFORE the render** — not after seeing the exam.
[../DECISIONS.md](../DECISIONS.md).


## Tuplets — why `\tup3` recall keeps missing its floor

*Was `docs/archive/rounds/tuplets.md` (last updated 2026-08-19).*

> ⛔ **ARCHIVED 2026-10-08 — Round 3 closed on 2026-09-03.** Moved here from `docs/rung3/`. Every
> ⏭ / "next" / "owed" below is as of its own date and is NOT a current action: the exam was read
> once (51% against 75%), Round 4 is the live round ([../../rung3/round4.md](../rung3/round4.md)),
> and current state is [../../STATUS.md](../STATUS.md).

> Part of the real-page track — index: [README.md](../rung3/README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md) and
> [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).
>
> Written 2026-08-11 after an owner report of two misread triplets on a real page. The collection
> side of tuplets is in [labeling.md § Labeling, Step 1 — collecting real pages and matching them to SymbTr](../rung3/labeling.md#labeling-step-1--collecting-real-pages-and-matching-them-to-symbtr) §1c; this file is the *reading* side.

### The finding

**The tuplet data work is finished. The remaining weakness is a precision/recall trade we made on
purpose and never rebalanced — and, underneath it, a mark we draw in a shape real print does not
use.**

`\tup3` recall was **92.7% before any of this round's work** and is **83.8% now**, against a ≥85%
floor it has missed twice. Precision went the other way, 15.1% → 91.2%, against a ≥70% floor. The
numbers and their history: [../METRICS.md](../METRICS.md).

The model does not invent triplets any more. It **misses about one in six**.

### What is NOT the problem (checked 2026-08-11)

**Not a data shortage.** The `strips_tup` queues are fully verdicted and the promote has run —
`manifest.jsonl` holds 169 strips / 205 groups, and the pool trains at `:8` oversampling
(`--real-dir data/real/rung3/strips_tup:8`, [round1_colab.ipynb](../../ml/ml/notebooks/round1_colab.ipynb)).
The exam extension also happened: tup3 gold went 4 → 55 groups at the v2.1 freeze.

⚠ [labeling.md § Labeling, Step 1 — collecting real pages and matching them to SymbTr](../rung3/labeling.md#labeling-step-1--collecting-real-pages-and-matching-them-to-symbtr) §1c described "78 accepted + a 147-row review queue" until this date.
That was the state on 2026-07-18 and it was read as current three weeks later. Corrected there.

**Not the 0/39 hallucination finding.** The tup3 image pass measured that every decode-proposed NEW
`\tup3` was a hallucination (0 of 39 real, near-always triggered by a printed slur). That was
measured on the **pre-tuplet-collection** model and does not describe `round2-stage2-best`. It is
kept as history in [labeling.md](../rung3/labeling.md), not as a current fact about the live model.

**Not the stitcher.** Unclosed `\tup3` is closed at the barline or row end, a stray `\tupend` is
ignored, and a mid-row `\sig` is dropped (`packages/core/src/labels/stitch.ts`). The page is already repaired.
⚠ But the exam scores **token ids, before the stitcher**, so no stitch-time repair can move it.

### The two failure shapes, from a real page (owner, 2026-08-11)

**A group with the wrong edges.** The model found the bracket and started it one note late:

```
model:  \natural f''16   \tup3 e''16 d''16 \tupend      ← 2 noteheads
right:  \tup3 \natural f''16 e''16 d''16 \tupend
```

**A group missed entirely.** `b''16 a''16 g''16` emitted as three plain notes, no markers.

The first is repairable from the tokens alone (below). The second is not — a missed triplet is
token-identical to three plain notes, and the model reads no time signature, so nothing sums.

### A triplet is NOT always three noteheads

The "3" counts **units of time, not noteheads**. Two units can be merged into one longer note, or
one unit split into two shorter ones. A 32nd + a 16th under one bracket is three units in two
noteheads, and it is normal music.

Measured across all four label pools — 20,259 groups — four have ≠3 noteheads, two of them
legitimate. Detail: [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

⚠ **"≠3 noteheads" is a review GATE, never an auto-repair.** [labeling.md](../rung3/labeling.md) records the
rule that such a group never auto-accepts — correct, because it sends the odd ones to a human. Wired
up as a *fixer* it would corrupt the legitimate two-notehead groups, which live in exactly the fast
32nd-note passages the model is already worst at.

**More than three noteheads is rare in Turkish notation** (owner, 2026-08-11), so the corpus holding
none of that shape is correct, not a gap.

### What the durations do determine

A group closes when its running sum of *sounding* durations lands on a plain power-of-two value.
That is already the rule `tupletGroupsIn` implements (`packages/core/src/labels/rhythm.ts`), and it handles
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

#### `\tupend` stays in the vocabulary

It carries no information the durations do not already carry, so removing it is *technically*
sound. It is not worth it: every label in every pool would be regenerated, including the frozen exam
gold, mid-round, for a saving of one token per group.

The same benefit is available without touching a label — **constrain decoding**: forbid `\tupend`
until the running sum is plain, force it when it is. A malformed group becomes unemittable, and
unlike a stitch-time repair it shows up in the exam score. Decision row:
[../DECISIONS.md](../DECISIONS.md).

### The root cause is CONFIRMED as a drawing defect (2026-08-12) — and the redraw is in

`ml/labels/tuplet_mark_probe.py` measured the mark on real editions the way `sharp_probe` measured
the sharps. **16 of 16 accepted marks, across ~11 editions, break the arc and set the "3" in the gap.**
Geometry, the caveats and what our two styles do instead:
[../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

> ⛔ **CORRECTED 2026-08-19 — the second half of that sentence was wrong, and it is struck.** It read
> *"Not one continuous arc with a floating digit exists in the real pools."* The owner produced two
> real scanned editions that draw exactly that: **a continuous arc with the italic "3" set INSIDE the
> concavity**, between the curve and the noteheads (Kemânî Sebuh / Sofyan, and Avni Anıl / Düyek —
> the second over dense contiguous triplet runs). The probe's own caveat had already said 16 across
> ~11 editions was small enough for one to exist; it was.
>
> ⚠ **It is a THIRD style, not our legacy one.** `drawTupletArcLegacy` floats the digit *above* the
> arc, touching the apex — one connected component, "a slur with a bump". These pages keep the digit
> clear of the curve on the notehead side. Neither of our two functions draws it.
>
> ⚠ **Why the probe could not have found it: no labelled real strip in any pool carries this style.**
> That is also why nothing we own can score it, and why collecting such pages is half the work — see
> the follow-ups below. **16/16 still describes the pools we sampled**; what is refuted is the claim
> about Turkish print in general. [../DECISIONS.md](../DECISIONS.md)

Three things came out of doing it that reading could not have given:

- **Our old mark was worse than "a digit above the arc".** The floating "3" *touched* the apex, so the
  whole mark was ONE connected component — a slur with a bump. That is what the model had to tell
  apart from a phrase slur.
- **The gap is sized to the digit, not the group** — 1.63 S whether the mark spans 4.5 S or 28 S.
- **Our own bracket style already breaks around its digit**, so only the curved style (then 70% of
  pieces, now 90%) ever carried the defect.

`drawTupletArc` now draws two segments with the digit in the gap, to those measurements, and the pilot
re-render lands on every one of them. ⚠ **Nothing about recall is claimed** — the A/B ran on
2026-08-15 and came back null (step 3 below), so what is established remains the SHAPE and nothing
more.

**The owner reviewed the sheet the same day and the mark changed twice more, both measured after the
fact.** The verdict was "right shape, too rigid": in real editions **the arms follow the notes, up or
down**, and the "3" is lighter than we drew it. So each arm's outer end now clears **its own** end
note (the mark tilts with the contour) and the digit is regular weight. ⚠ The one thing that did NOT
change is where the digit sits: a descending printed mark *looks* weighted toward its high side, but
measured it is at **0.49–0.50 of the span** — dead centre. Sliding the gap toward the high note was
tried first and degenerates into a stub arm whenever that note is an outer one. Numbers, with their
small n: [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

### Why the shape matters — the reasoning, as written 2026-08-11

**Real Turkish editions break the arc and put the "3" in the gap. We drew a continuous arc with the
digit floating above it** (owner, 2026-08-11, from a real page; measured and fixed the next day).

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
print at matched staff size — is the one that worked, and it was pointed at this mark on 2026-08-12
(see the section above; it held). Both sets of constants:
[../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

### What the surviving failures LOOK like (2026-08-15) — a lead, not a finding

Taken after the A/B, by reading the 10 groups either arm missed rather than by computing another
statistic. Both arms were decoded over `_tupletval` and every miss was printed beside its gold.

**The shape of the failure: the model marks the FIRST triplet of a passage and forgets the later
ones.** In 8 of the 10 problem groups the missed group is a later one in the same strip, and the
first group is read correctly — the notes come out right, only the `\tup3` (and often its `\tupend`)
is absent. Recall by position, both arms independently:

| | first group in the strip | a later group |
|---|---|---|
| NEW | 96% (27/28) | **81% (21/26)** |
| CTL | 93% (26/28) | **77% (20/26)** |

- **Same direction in both arms**, which is mild corroboration that it is a property of the task
  rather than of the mark.
- ⚠ **Adjacency is NOT the mechanism.** Restricting to groups whose `\tup3` follows the previous
  `\tupend` within 2 tokens gives **91% in both arms** — no effect. So it is not "the second of a
  directly abutting pair"; it is position in the strip.
- ⚠⚠ **One piece holds 19 of the 54 gold groups (35%) and 7 of the 8 problem strips**
  (`acemasiran--sarki--senginsemai--canan_okuyor`). The position split is therefore confounded with
  that piece, and rests on ~5 groups. **This is a lead to test, not a result to act on** — the
  ±2% pre-shrink is what acting on this class of evidence costs
  ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)).
- ⚠ One of the 10 is not a tuplet failure at all: both arms misread
  `…askin_ilahi…_p1_s03_w01` end to end, reading a different passage than the gold.

**How to settle it for free.** The exam carries **55 `\tup3` groups over 38 strips** across many more
pieces. When Round 3's one-shot read happens, split `\tup3` recall by first-group-in-strip vs later —
the decode already runs, so it costs nothing and is far less piece-concentrated than this pool. If it
holds there, the lever is decode-side (below), not the renderer.

**Why this matters for reading the A/B.** The model evidently *can* see the mark — it fires on the
first group. That is consistent with a redraw buying little, and it points the next effort away from
how the mark is drawn.

### The plan

Ordered, one change at a time, because Round 1 and Round 2 each moved several things and neither can
be attributed.

1. ✅ **DONE 2026-08-12 — redraw the mark**: break the arc, put the digit in the gap, raise the arc
   share above its current 70% (owner: arcs are more dominant than that) — now 90%. **Pixels only** —
   the `\tup3` token is identical either way, so no label moves and no re-labelling is needed.
   `TUPLET_MARK` + `drawTupletArc` in `apps/web/src/score/SheetView.tsx`. ⚠ That file is both the app's score
   view and the training-strip source, so this also fixes how the app draws triplets for a reader.
   Checks: `npm test`, `smoke:editor` and `verify-labels` on the pilot all pass unchanged (309/309
   exact), which is how we know the label path did not move.
2. ✅ **DONE 2026-08-12 — the owner looked at the shape** on
   `data/real/rung3/tuplet_probe/mark_comparison.png` (`ml/labels/tuplet_mark_sheet.py`: real
   edition / ours before / ours now, same piece and same strip, each also as the encoder sees it; ⚠
   local viewing only, the real row is a third-party edition —
   [../THIRD-PARTY.md](../THIRD-PARTY.md)). Two corrections came back — arms follow the notes, lighter
   digit — and both are in. **This is the gate the plan put here, and it is passed.**
3. ✅ **DONE 2026-08-15 — the A/B RAN and came back NULL. The shape stays; no recall claim is made.**
   Two arms, identical but for the mark: **88.9% vs 85.2%** `\tup3` recall on `_tupletval`, which is
   **+3.7 pp = 2 net groups**, paired 4-vs-2 discordant, **exact McNemar p = 0.688**. The
   pre-registered threshold was ~6 discordant groups one way, so this is a null by the rule written
   before the corpora were rendered — and the rule's null branch is what applies: **the redraw is
   kept**, because it stands on the print measurement (16/16 marks, ~11 editions) rather than on
   recall, and **nothing about recall is claimed in either direction**. Precision cleared its veto
   on both arms (98.0% / 95.8%); the `_realval_v2` guard passed (mean AEU F1 83.9% vs 83.3%).
   Numbers: [../METRICS.md](../METRICS.md); full read: [../../ml/omr/MODEL_EVAL.md](../../ml/omr/MODEL_EVAL.md).
   ⚠ **What this does NOT say**: that the shape does not help. 54 gold groups cannot resolve less
   than ~11 pp, and the effect hoped for was ~5. The experiment was run knowing that
   ([rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol)), which is why the number can be read honestly now.
   ⚠ **Do not quote the `_realval_v2` split (91.4% vs 80.0%) as a second result** — those 35 groups
   are a subset of these 54, so it is this same experiment re-sliced in the direction one would like.
4. **Ship the arithmetic repair** for the wrong-edge groups that survive, plus the decode
   constraint above.
5. **Only then** revisit the 35% slur-distractor rate. It may be fine once the two shapes genuinely
   differ; changing it at the same time as the shape would make the result unreadable.

**No new labelling appears in this list.** That work is done.

#### ⛔ The DRAWING thread is closed, and no trained arm belongs to tuplets (2026-08-19)

Confirmed with the owner while planning Round 3's arms. Steps 1–3 above ran and the A/B was **null**;
the shape is kept on the print measurement alone. **Nothing further about how we draw a triplet is
scheduled, and none of Round 3's four trained arms is a tuplet arm**
([rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) — the arms are the scan profile and staccato; one-measure-per-strip was
dropped 2026-08-19). ⚠ **The third mark style added that day is not an arm either**: it is a per-piece
coin in the final model's render, on print evidence, with no recall claim — the same footing the
2026-08-12 redraw was kept on after its A/B came back null.

Two items survive, and neither costs a render or a training run:

- **The position lead (step 4's real target).** The model marks the **first** triplet of a passage and
  loses the later ones — recall 96% → 81% by position, in *both* A/B arms, which points away from the
  renderer entirely. ⚠ Still a **lead, not a finding**: one piece supplied 35% of that pool and 7 of
  the 8 problem strips. **It is settled for free at Round 3's exam read** — split `\tup3` recall by
  first-in-strip vs later over the exam's 55 groups across many more pieces; the decode already runs,
  so this costs one extra column in the report. If it holds, the repair is decode-side (step 4), not
  a redraw.
- ✅ **The digit-inside-the-concavity probe is ANSWERED (2026-08-19) — it confirms, from two real
  pages the owner supplied.** So it enters as written: a **per-piece coin** like bracket-vs-curved,
  renderer diversity rather than a correction, with **no recall claim**. Two things it changes that
  the original one-liner did not anticipate — it lands in the FINAL model's render, never in an arm's
  (a third mark style inside an arm is a second variable), and it comes with a **collection** job,
  because no labelled real strip carries the style and an unscoreable shape is not worth teaching.

⚠ Also still owed and deliberately deferred: real print draws the arc **heavier** than we do, and that
must move jointly with `drawSlurArc` or it becomes a thickness cue real pages do not have.

### Non-claims

- **The SHAPE is measured; the RECALL story was TESTED and came back null (2026-08-15).** Real print
  breaks the arc and we did not (16/16, ~11 editions) — that part is solid **for the editions we
  sampled**, and 2026-08-19 found a real counterexample outside them (see the correction above), so
  it is a majority shape and not the only one. What the A/B adds is only
  that any recall gain is below what 54 gold groups can resolve (~11 pp); it is **not** evidence that
  the shape is irrelevant, and it is not evidence that it helps. The mechanism remains consistent
  with the precision/recall history and with the Bravura precedent, and that is still all it is.
- The missed-group failure (shape 2 above) is **not** addressed by any repair rule here. Bar-length
  comparison across a page could reach it — most bars agreeing sets the expected length without a
  time signature — but that is untested and unbuilt.
- Recall is measured on the exam's 55 tup3 groups. That is far better than the 4 it froze with, but
  it is still a small class; quote it with n.
- Two `strips_tup` labels do not sum to a whole number of units (`\bakiyeSharp g''8 a''8`, twice).
  Unresolved: a wrong label or a crop that cut a group. Two rows out of 20,259 groups.


## Follow-ups — the correction loop, parked ideas, watch-items, data layout

*Was `docs/archive/rounds/followups.md` (last updated 2026-07-20).*

> Part of the real-page track — index: [README.md](rounds/README.md). Current state and next action are NOT here: see [../STATUS.md](STATUS.md).
Numbers: [../METRICS.md](METRICS.md). Decisions: [../DECISIONS.md](DECISIONS.md).

### Step 5 — Hand-correction loop for the unmatched pieces (AFTER Round 1)

Deliberately scheduled after the retrain: today's model would need most strips repaired; the
Round-1 model has seen two real engraving styles, so correcting becomes verification. Already
wired (Rung-4 stage 8): `decode_page.py` → `stitch-cli.ts` → harness → fix in editor →
**⬇ Save JSON** → `data/real/rung3/corrected/<makam>/<stem>/`. Disciplines:

- **Triage:** decode ALL pages (~7 s each), rank by suspicion — stitch warnings, decodes
  hitting the 60-id cap without EOS, row/measure-count inconsistencies, min token logprob.
  Hand-correct from the worst end (active learning).
- **Auto-accept the clean end:** zero-warning, clean-EOS, high-confidence pages go straight to
  training; hand-audit a ~5% sample to measure the label-noise rate before trusting it.
- **Verify, don't edit:** the review act is a visual compare (strip image vs. re-engraved
  decode). Watch for anchoring — plausible-but-wrong accidentals waved through; the audit
  sample measures this too.
- Retrain, re-decode, repeat; stop when the marginal correction rate flattens. (This loop is
  inherently iterative — the "one big run" decision only removed the unnecessary
  neyzen-only intermediate round.)

### Logged for later — decode-repair heuristics + the acc_disagreement lesson (2026-07-16)

**acc_disagreement adjudication result (all 216 rows done):** in label-vs-decode accidental
disputes, the user's fix sided with the DECODE 187/214 (87%) vs the label 14 (7%); the
median fix equals the decode verbatim. Meaning: these are rows where the printed edition
genuinely differs from SymbTr on accidentals (courtesy naturals, editorial signs,
intonation choices) — and the page wins. Two standing conclusions: (1) the emitter's rule
that accidental disputes NEVER auto-accept is validated — auto-accepting would have poisoned
187 strips in the headline class; keep the rule for every future source. (2) The Round-0.5
labeler's accidental reading is trustworthy enough to be the *draft* side in these disputes
— the review UI's decode-based edit draft is the right default for acc_disagreement rows.

**Decode-repair heuristics (user idea, worth building at Round-2 tooling time):** the
model's residual errors include GRAMMAR violations repairable without seeing the image —
orphaned `\tupend` (a `\tup3` opener dropped: "two `\tupend`s after six notes = contiguous
triplets, first opener lost"), dangling `\sigend` without `\sig`, unpaired volta/repeat
marks. Candidate implementations, in increasing depth: (a) a lint-with-autofix suggestion
in the review UI's editor (safest — human confirms); (b) a post-decode repair pass in
`decode_page.py` before nd scoring (recovers review-queue rows whose only defect is a
dropped opener); (c) longer-term, grammar-constrained decoding in the product (the decoder
never emits ill-formed bracket structures at all); (d) **adaptive window re-split on cap-hit**
(added 2026-07-20, Round-2 tooling): when a window's decode hits the 60-id cap without EOS,
split the window at a gutter/barline and re-decode each half — converts the [labeling-collection.md](rounds/labeling-collection.md) §1c budget analysis
into product-side robustness for dense-triplet pages regardless of how training goes. Never
silently rewrite labels with these — they propose, a human (or the nd gate) disposes.

### Folder layout (under gitignored `data/real/`)

```
data/real/
  pdfs/<source>/<makam>/*.pdf     downloads (collect_notalar.py; source = neyzen, nota, …)
  images/<makam>/<stem>_pN.png    rasterized pages, 200 dpi
  strips/<page>/                  slicer + decode outputs (page_to_strips.py / decode_page.py)
  refs/                           ad-hoc reference uploads (incl. triplet_test.png)
  census.json, manifest.csv       collector catalog
  rung3/
    matches_review.csv            every pdf's best SymbTr candidate + score + tier
    matched/<makam>/<stem>/       SymbTr-matched ground truth (step 1)
    testset.json                  frozen exam pieces (step 2 — TODO)
    corrected/<makam>/<stem>/     editor-corrected docs (step 5)
```

### Watch-items

- **Slicer vs. TRT-style scans** (step 1b): the biggest unknown of the combined Round 1 —
  sample-check with `--debug` overlays before bulk download; timeboxed with a neyzen-only
  fallback. **Now measurable, not just eyeball-able (2026-07-19): the slicer hardening above
  ships with `ml/labels/score_slicer.py` — run it after any slicer change / on any new
  source's decode caches to get old-vs-new row-measure-count accuracy against SymbTr
  alignment (caveat: its truth is biased toward the CACHED slicer's counts).**
- **Alignment bugs poison labels silently** (step 3) — the round-trip + eyeball gate is
  mandatory per source before the first train. ✅ The gate already earned its keep: it caught
  the printed-signature convention and the written-vs-sounding bare-degree convention
  (both now handled — see the status block above).
- **Empty-`\sig` label bug** (`MODEL_EVAL.md` Rung 2.2b): DONE for real labels (the `--ranges`
  emitter skips empty signatures); the matching synthetic re-render stays a Round-1
  prerequisite — batch it with adopting carry-mode ("measure") rendering for synthetic pages
  so both conventions converge on real engraving. **Re-render mode mix (decided 2026-07-20):
  carry-mode DOMINANT, keep a minority `every`-mode share** — every-mode's glyph-teaching
  purpose stands, but carry is what real pages and ALL real labels use. Measured fact behind
  the init decision: strips_v2_2 = 17,133 every + 6,258 keysig + **0 carry** strips, so
  rung22-stemfix never saw a carry label — that is the format mismatch, and why Round 1
  trains from BASE.
- **Review-queue adjudication** — the review UI is BUILT (`ml/labels/review_ui.py`,
  stdlib HTTP server on :8377, 2026-07-12): queue tabs (sampled audit / full 84-strip audit /
  r1-review / exam-review), one-keystroke verdicts ok|fix|bad written atomically into the
  CSVs (`verdict` / `corrected_label` / `by` columns; `by` marks non-human verdicts, a human
  re-verdict clears it), solfège display (CSV stays letters), label-vs-decode token diff,
  Bravura-glyph token reference. **348-row r1 queue adjudication DONE (2026-07-14): 341 fix /
  4 bad / 3 ok** — nearly everything flagged needed fixing, vindicating the conservative
  accept gate; exam-review (443) is scheduled after the two-source freeze —
  see Step 2 "Grow the exam by adjudication" (accidental-bearing rows first, then re-take
  the baseline on the grown exam).
- **Promote script — BUILT + APPLIED (2026-07-14):** `ml/labels/promote_labels.py` folds
  the verdicts into `manifest.jsonl`: full_audit `fix` rows replace labels in place (`bad`
  would remove), review `ok`/`fix` rows are promoted as new manifest rows (SymbTr-stem piece
  metadata recovered from `matched/`; PNGs hardlinked; provenance columns
  `promoted`/`reason`/`verdict`). Human verdicts are ground truth — the gates only catch
  MECHANICAL defects: ≤59-id budget (training tokenizer) + round-trip via the new labels-cli
  `--check` batch mode (same checkLabel as `--ranges`, over raw hand-edited text). Atomic
  rewrite with `.bakN`; idempotent (keyed on image — re-run after further adjudication).
  **Result: manifest 84 → 418 strips** (65 emitter / 19 audit-fixed / 334 promoted); 10
  rejects in `promote_rejects.csv` = 7 over-budget (60–73 ids; MEASURES_PER_STRIP=2 re-slice
  recovers them) + 3 split-duration typos (`c'' 32` → `c''32`) pending hand-fix + re-run.
- **Audit verdicts — DONE, and the full audit earned its keep:** all 84 accepted strips
  eyeballed via the `full_audit.csv` sidecar queue: **65 ok / 19 fix / 0 bad (22.6% of
  auto-accepted labels needed correction)** — far above the 4-row sample's 1/4 hint. Known
  pattern: spurious `\repstart` in labels the edition doesn't print (SymbTr repeat, flattened);
  model-side: slurs systematically decode as false `\tie` (synthetic never drew slurs).
  **Hicaz signature misread (found + bulk-fixed 2026-07-13):** the model UNANIMOUSLY read
  hicaz-family signatures as `\sig \bakiyeFlat a \sigend` (flat one step low, do♯ missed), so
  the printed-sig majority-vote override propagated the error into labels WITHOUT tripping
  `sig_mismatch` (split votes were the only alarm). All 14 affected rows (hicaz +
  hicaz_humayun; incl. 1 manifest strip) converted to the printed convention
  `\sig \bakiyeFlat si \bakiyeSharp do \sigend`. Second variant same day: the 3-entry hicaz
  signature (♭+♯+♯) read as `\komaSharp do \bakiyeSharp fa \bakiyeSharp la` — converted to
  `\bakiyeFlat si \bakiyeSharp fa \bakiyeSharp do` + covered-accidental cleanup
  (sirma_sacli_yarimin_ney, 7 sig rows). Suspicious la♯-bearing sigs NOT yet adjudicated:
  saki_cekemem (evcara), ferahnak_asiran (ferahnakasiran), biz_heybelide (sultaniyegah),
  gel_ey_saki (mustear, exam) — confirm printed sigs per makam before converting.
  Lesson: unanimous-but-wrong sig reads are
  invisible to the vote — per-makam spot checks of the voted signature are part of every
  future source calibration (notaarsivleri), and hicaz signatures need synthetic coverage
  in the Round-1 re-render. **Applied to the nota run (2026-07-15): two clusters flagged —
  mahur voted with a spurious extra F entry ([F+1], 12 pieces) and a missing-B-1 cluster
  (voted sigs lacking the expected 1-comma-flat B). → ✅ ADJUDICATED (2026-07-16/17): the
  clusters were worked per-strip through the 105-row sig_mismatch review (the worksheet's
  markdown checkboxes were never ticked — the review rows superseded them), and the
  examv2-full audit (2026-07-17) confirmed the voted mahur + suzidilara sigs with ZERO
  signature corrections across their 34 exam rows.**
  Corrections APPLIED to `manifest.jsonl` by `promote_labels.py` (2026-07-14, see above).
- **Over-budget real strips** (233): a `MEASURES_PER_STRIP=2` re-slice would recover many.
- **⚠ SLICER w00 CROP BUG (logged 2026-07-16, user finding during review).** Many `_w00`
  (row-start) strips do NOT show the printed clef+signature: the crop starts too far right
  (e.g. `aman_cana p1_s00_w00` keeps the 10/8 time sig but cuts the clef;
  `hatirlar_misin p1_s00_w00` cuts mid-clef with junk from the row above;
  `canan_bilirim p1_s04_w00` is mid-staff garbage). Others DO include it — the population
  is mixed, so nothing mechanical can sort them; the user marks sig-cut w00 crops `bad`
  during review. Consequences: (a) lost sig-bearing training strips; (b) the printed-sig
  MAJORITY VOTE sees fewer/wronger row-start reads; (c) 191 review + 7 exam labels had
  their `\sig` blocks bulk-removed where the decode showed none — VALIDATED after the
  fact and KEPT: 23/24 user-verdicted overlap rows + 8/8 visually sampled affected strips
  confirm those images truly lack a visible sig (inspect list:
  `data/real/rung3/sigstrip_inspect.txt`). When the model DOES read a sig, the filter
  leaves the label alone, so decode-absence held up as a removal criterion here — but
  only verified-by-inspection after a false alarm from a mis-drawn sample; always sample
  from the actually-affected rows.
  **FIX WITH THE `MEASURES_PER_STRIP=2` RE-SLICE: anchor the w00 window at the row's true
  left edge (clef margin) in `page_to_strips.py` and eyeball ~20 w00 crops before the bulk
  re-emit.** Related edge defect (user, 2026-07-16): window boundaries sometimes BISECT a
  notehead — pad window x-edges a few px past the enclosing barlines at re-slice time.
  Review policy meanwhile: a cut note OUTSIDE the labeled measures = harmless edge
  fragment, verdict normally; a cut note INSIDE the labeled content = `bad` (the image
  can't prove the label; exam queues doubly so). Also revisit the triplet depletion then: 28% of matched pieces contain `\tup3`
  but only 1.3% of accepted strips do — triplet-dense windows die on the 59-id budget
  (35% of over_budget drops come from the 25% tup3 pieces); the 2-measure window is the
  same cure.
  **Second slicer defect (user, 2026-07-17): NOTE STEMS mistaken for barlines** — the
  detector cuts at a note, so the notehead survives but its stem/flag/beam is severed
  and the DURATION is misread. Re-slice must (a) discriminate barline vs stem better
  (a barline spans the full staff height with no notehead/beam attached at either end;
  a stem terminates at a notehead or beam), and (b) pad each cut a few px — TIGHT, so
  the margin never pulls in a neighboring note's head. The eyeball-20-crops gate before
  the bulk re-emit covers both.
  **→ ✅ SLICER FIXED (2026-07-19), all of the above in `page_to_strips.py`; strips on
  disk are UNCHANGED until the next re-slice.** What shipped:
  - *True root of the w00 bug found*: `staff.x0/x1` came from the horizontally-OPENED
    image — on a slightly skewed scan a staff line drifts across pixel rows, splitting
    each row into runs shorter than the w/4 opening kernel, so the opened image loses the
    line's left/right ends (measured: x0 pushed 70–490 px right; whole measures lost, not
    just the clef). X-extent now comes from RAW ink at the detected line rows
    (majority-of-lines vote, longest gap-tolerant run drops scan-border artifacts).
  - *Barline vs stem/clef* (`detect_barlines`): gate 2 (notehead-fat blob in the staff
    band, at the cluster CENTER) + new gate 3 = terminal-overshoot walk at the cluster's
    longest-run column over a ±2.5 sp extended band: a stroke extending >0.5 sp past BOTH
    outer lines is a clef/border artifact; past ONE line with a sustained-wide attachment
    (≥0.5 sp wide over ≥0.2 sp of consecutive rows, within 1.5 sp of the line) is a stem
    ending in a head/flag/beam. Thin one-sided overshoot of ANY length is kept — a hard
    length cap was tried and rejected real volta-tick barlines; slur/tie crossings and
    title-text collisions are also survived (the width run + nearness guards).
  - *End snapping*: a bar detected within 0.7 sp of the staff end SNAPS to the end
    (never a mid-clef measure 0 or sliver end measure); never-drop-first-window (a
    too-narrow w00 merges forward or emits, never vanishes).
  - *Clef+sig PREFIX span*: a leading span with NO notehead beyond the clef zone (repeat
    bar printed right after the signature) is excluded from measure indexing but kept in
    the w00 crop — it used to shift every strip's measure span by one (the +1 tail of the
    dn histogram). Trade-off: a row-start measure holding only RESTS is mis-trimmed the
    same way → dn recovery/review, never corrupted training labels.
  - *Cut padding*: crops pad 6 px past enclosing barlines (w00: 15 px left margin);
    `split_wide` gutter edges get no pad. Manifest schema unchanged (+ audit-only `pad`
    field; `row_x0/row_x1/width` now describe the padded crop).
  - *Tooling*: `--debug` overlay now color-codes REJECTED candidates (orange=fat blob,
    purple=clef-like, yellow=blob-past-line, gray=x-range); NEW
    `ml/labels/score_slicer.py` scores old-vs-new `row_measures` against the
    emitter's SymbTr row alignment using the existing decode caches (CPU-only, no model)
    and `--eyeball` writes contact sheets (docs' 3 bad w00 pages + worst regressions +
    random w00s) to `data/real/rung3/slicer_eyeball/index.html`.
  - *Measured (30-piece sample, 170 truth rows)*: exact row-measure-count rate 57.1% →
    68.2%; false-positive tail (+1/+2 dn) 55 → 34 rows; 27 rows improved, 4 "regressed"
    — 3 of them verified visually as the NEW slicer being right against alignment truth
    that is biased toward the old counts (assign_rows seeds n from old row_measures ±2),
    1 is a pathological typewriter page (title text fused to barlines) that goes to
    review either way. Full-corpus score in `data/real/rung3/score_slicer.csv`.
  - Caveats for the re-slice: staff-detection RECALL is untouched (e.g. keremkani p1
    still loses rows whose 5-line group isn't found); truth-bias means the scorer
    understates the improvement; the eyeball gate remains mandatory before the bulk
    re-emit.
  **Tuplet training gap (user, 2026-07-17, recurring):** the model reads `\tup3` poorly
  and real data can't fix it (depletion above) — the synthetic re-render must OVERSAMPLE
  tuplets aggressively (well above corpus rate, incl. contiguous-triplet runs — the
  two-`\tupend`s-in-a-row shape from the decode-repair note), alongside the
  rare-accidental and slur-distractor boosts. **→ REAL-DATA SIDE ADDRESSED same day, [labeling-collection.md](rounds/labeling-collection.md) §1c:**
  293 tuplet pieces collected from both sources; the budget analysis there shows the 2-measure
  re-slice can't recover triplets (80% still over budget) — 1-measure windows + the
  sub-measure fragment follow-up are the cure. Derived signatures used to come out
  in C..B letter order; real editions print flats B-E-A-D-G-C-F then sharps F-C-G-D-A-E-B.
  `deriveKeySignature` now sorts to the printed convention (packages/core/src/notation.ts),
  and ALL existing label files were batch-canonicalized 2026-07-16 (user-approved; ~404
  labels across nota review/manifest/audits, examv2 review, r1 manifest — `.bak-sigorder*`
  backups beside each file). Caveat: hicaz-family SHARP order is edition-dependent (both
  `si♭ fa♯ do♯` and `si♭ do♯ fa♯` print) — canonical puts fa♯ first; per-strip review
  catches the other edition via the decode diff. **Before any re-slice/re-emit: (1) run
  `promote_labels.py` first — a re-emit writes a FRESH review queue with new strip windows,
  and un-promoted hand verdicts in the old CSV do NOT carry over; (2) `matched/*/labels.json`
  still hold the old C..B order until labels-cli is re-run over `matched/` (harmless for
  alignment — content search strips `\sig` blocks — but re-run it with the re-emit so
  everything regenerates consistently).**
- **Folk vs. art music:** TSM sections only; THM's numbered bemol-2/3 signs have no tokens.
- **Handwritten scores** stay OUT of scope for v1 (product-side message, not a model fix).

## The tuplet review queues — finished and promoted (2026-08-11)

*Moved here from `docs/rung3/labeling.md` on 2026-11-20 — the work is finished.*

#### ✅ SUPERSEDED 2026-08-11 — the tuplet queues are FINISHED and PROMOTED

Everything above §1c describes is the state on **2026-07-18**, and it was still being read as
current three weeks later. It is not. Verified on disk 2026-08-11:

- **All three queues are fully verdicted**, no pending rows: `emit_review.csv` 113 rows
  (72 fix / 31 ok / 10 bad), `full_audit.csv` 70 (63 ok / 6 fix / 1 bad), `emit_audit.csv` 6 (all ok).
- **The promote has run**: `manifest.jsonl` = **169 strips / 205 `\tup3` groups** (was 78 / 114).
- **It trains**, at `:8` pool oversampling (`--real-dir data/real/rung3/strips_tup:8`).
- **The exam extension happened too** — tup3 gold 4 → 55 groups at the v2.1 freeze.

⚠ Two corrections to the 2026-07-18 text above, both found by re-reading the data rather than the
doc: the **"0 two-member groups" claim no longer holds** (the current manifest has four groups with
≠3 noteheads, two of them legitimate), and **a triplet is not always three noteheads** — the "3"
counts units of time. The member-count rule stays a review *gate* and must never become an
auto-repair. Why, and what the remaining tuplet weakness actually is: **[rounds.md § Tuplets — why `\tup3` recall keeps missing its floor](#tuplets--why-tup3-recall-keeps-missing-its-floor)**.

**Is this enough tuplet data? (assessed 2026-07-18)**

- **Training: YES for Round 1** — completing the queues yields ~78 accepted + ~90–110
  promotable review rows ≈ **~180 real tup3 strips / ~280 groups over 120 pieces, two
  engraving styles**, incl. 28 accepted strips with ≥2 groups (the contiguous-run shape).
  Combine with loader oversampling of these strips + the planned aggressive synthetic
  tup3 oversampling. (Reference point: Round-0.5's 33% tup3 recall came from ~14 rows.)
- **Exam: NOT automatically** — the frozen 311-strip exam still holds 4 tup3 gold, and
  promoting ALL strips_tup pieces into training would leave nothing to measure with
  (exam pieces never train). **Solution — tup3 exam extension via holdout:** hold ~10–12
  tuplet-rich pieces OUT of the promote, spread over sources/makams (candidates from the
  piece ranking: cok_yasa_ayse_ney, bu_son_sarkimda [mahur], Kurdilihicazkar_sirto,
  huzun_zaman_zaman + _ney, canan_okuyor [acemasiran], dil_seni_sevmeyeni_ney,
  ay_dalgalanirken, ben_guzele [mahur], gittin_biraktin_ney, dalinda_solarken [ussak],
  sana_dun_bir_tepeden_ney). Their adjudicated strips (~30–50 tup3 gold ≥ the ~20/class
  target) join the exam manifest instead of training (`promote_labels.py --exam` path,
  extend testset.json piece list = a v2.1 freeze), and the adjudication is the same
  review work — it does double duty as measurement. **Re-take the baseline including
  the extension BEFORE Round 1** so tup3 progress is apples-to-apples.
- **Blind spot that stays open:** the k=1 pool is biased toward measures sparse enough
  for the 59-id budget; dense contiguous-triplet instrumentals (the 90+-group
  sazsemaisi/longa pieces) still sit in the over_budget/split_wide drops — training AND
  exam under-represent that hardest case until the sub-measure fragment follow-up lands.
  Round-1 tup3 numbers speak for the common case only; say so in MODEL_EVAL.md when
  reporting.
3. **Sub-measure fragments = the designed follow-up** for the other 1,512 dense measures
   (3,102 groups; 88% would fit as TWO fragments ≤112 ids): the slicer's `_split_wide`
   gutter-cutting already produces clean fragment images — what's missing is fragment
   LABELS. Design: labels-cli learns atom-level ranges (the `docToStrips` atom machinery
   already exists TS-side), the emitter proposes the atom split by aligning each
   fragment's decode against the measure's atom sequence, and the nd gate + review queue
   dispose — the model proposes, never decides. Until then dense-measure fragments stay
   dropped (`split_wide`).
