# Status log — what happened, when

purpose: append-only dated record of completed work; the raw material behind STATUS.md
audience: agents reconstructing why the code looks the way it does
updated: 2026-07-29

**Newest first.** This file is history: it records what was true on a date, not what to do now.
Current state → [../STATUS.md](../STATUS.md). Abandoned plans → [superseded.md](superseded.md).
Phases 0–1 in full detail → [HISTORY.md](HISTORY.md). Run-level numbers →
[../METRICS.md](../METRICS.md) and [../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md).

## 2026-07-29 (latest) — the windowing retune: constants stay, two cap bugs fixed

**The retune from the entry below was run to a conclusion, and its premise did not survive.** The
sweep that pointed at `MEASURES_PER_STRIP = 1` had been scored on *usable yield* — does a decode fit
the 59-id budget — which improves monotonically as windows shrink, because it cannot charge for the
near-empty crops shrinking creates. Those crops carry 20.8% of exam corrections. Re-scored with that
cost included, 1 measure/window takes the healthy band **81.6% → 60.4%**. The constant stays at 3.

**Why measure count was the wrong control variable at all:** across 31,968 decoded strips, width
explains only R² 0.54 of a strip's token count (stems + inked columns explain 0.77), the budget is
simultaneously over-run (11.5%) and under-used (28.6% spend ≤25 of 59 ids), and **8.9% of single
measures blow the budget alone** — which no `MEASURES_PER_STRIP` can fix. So a budget-aware packer
was built, decoded head-to-head against legacy on 16 val-side pages, and came back a **wash**
(healthy band 75.8% vs 75.7/76.2%; bad-crop proxy 14.4% vs 14.5/14.0%). It buys +16 usable strips
for +1.6pp more near-empty crops, so it ships OFF behind `OMR_WINDOW_MODE=budget`, like
`drawThinSharps`.

**What was actually broken** — found by measuring the pool, not by reading the file (the rule that
cost two reverted patches last session). The measure cap was unenforced (13 of 3,168 strips) and the
width cap was violated 82 times by **three separate paths**: the `lead` clef prefix re-extending
window 0 after the check, `_split_wide`'s gutter-shifted cuts overrunning, and the driver's crop pad
being added post-check. Both fixed, verified 13 → 0 and 82 → 0 on the affected pages, with measure
coverage invariant across 458 rows — no music gained or lost, at a cost of +7.2% strips on those
pages. Also fixed: decode caches were keyed on `measures_per_strip` alone, so a packing change would
have silently reused crops from different code — the same confound that spoiled the earlier n_ids
read.

**Then the crops stopped overlapping.** The owner spotted that the 6 px left pad has no matching
right trim, so neighbouring strips share pixels and a note could be read twice. The overlap was
real — 74.8% of mid-row strips — but the double-count was not: a notehead is 22 px against a 6 px
band, and on decodes a note repeats across an overlapping boundary **1.3%** of the time against a
**6.85%** within-strip null. (Two geometric estimates on the way to that, 1.2% and 7.8%, were both
wrong — one test window was too wide, the other also fires on beams. The decode test settled it.)
Chasing the edges turned up the reason to make the change anyway: **no label ever names an edge
barline** (0 of 421 start or end with `|`), yet real crops ended on the barline centre and showed a
closing one **61%** of the time against **5%** for the synthetic strips the model trained on. The
trim closes that to 22.5% — the rest is row-final strips, which have no successor to hand the
margin to. Decoded A/B on 16 pages is a wash, so it is kept for structural consistency rather than
accuracy, behind `OMR_EDGE_TRIM`.

**Left open:** `data/real/strips_v2` was sliced before these fixes and needs re-slicing before the
emit. And two source pages collide on one stem (`bir_nigah_et_ney_p1`, `nesem_emelim_ney_p1` each
exist under two makams), so one page of each pair is silently overwritten — found incidentally,
unfixed. Numbers: [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

## 2026-07-29 — re-sliced the val-side pages, then found the slicer's windowing is mistuned

**The re-slice happened** — 158 val-side non-exam pages into `data/real/strips_v2` (3,168 strips),
a new root so the existing manifests and the 130 labelled queue rows keep pointing at intact crops.
Decided after the owner labelled the whole first queue and **43 of 130 (33%) turned out to be
unusable crops**, leaving 87 against the 110 needed — a re-slice was required either way.

**Then the emitter probe on one re-sliced page came back `accepted=3 review=2 dropped=25` of 30**,
with `over_budget: 11`. That stopped the full run, and the investigation found something worth
knowing before anyone re-emits.

**The 2026-07-25 slicer fix was right, and its downstream constants were never retuned.** The old
staff-detection kernel lost the ends of staff lines, pushing `x0` 70–490 px right and cutting off
clefs and whole measures; `STAFF_HOR_FRAC = 0.11` stopped that, and slivers fell 10.4% → 1.2%. But
rows now carry more music while `MEASURES_PER_STRIP = 3` and `MAX_STRIP_W = 1450` still assume
truncated rows. Decoding both crop sets with the **same** model (the earlier comparison was
confounded — the two decode caches came from different models): crops over the 59-id label budget
went **20.9% → 31.9%**. The emitter drops those, so content is captured correctly and then thrown
away. Sweeping `MEASURES_PER_STRIP`: 1 → 107 usable strips, 2 → 90, 3 → 79. Monotonic, current value
worst. **Not a licence to set it to 1** — that objective counts budget fit only and ignores lost
context, more stitcher pieces, and a mismatch against a synthetic corpus built at 2–4 measures.

Also found: `MEASURES_PER_STRIP` is not enforced. The sliver-merge checks the width cap but not the
measure cap, so 13 of 3,168 strips carry 4–5 measures.

**The owner's labelling was the source of most of this.** Their read — "the model did a great job,
the old slicer did not, and the fixed strips still have some slicing issues" — is confirmed on every
count: model accuracy tracks the confidence calibration (84% `ok` in the top band against a
predicted 80%), 33% of old hard crops were unusable, and the moderate-quality band is unchanged by
the overhaul (~10% under both slicers).

Also settled: **low confidence predicts a BAD CROP**, 89% below `min_logprob = -1.0` (16 of 18).
This **corrects** an earlier claim in these docs, drawn from the first 7 verdicts, that confidence
could not detect a bad crop. High confidence still does not guarantee a good one (6% of the top
bucket were bad), so it is a screen, not a proof.

## 2026-07-28 — Round 3's checks were run BEFORE rendering. Three of four ideas died; the real win was not on the list

**Why this session mattered:** Round 3 was scoped as a full 40,826-strip re-render plus a paid
training run, aimed at four hypotheses. All four were testable against the already-shipped model for
the price of a decode, so they were tested first. That was worth doing — **three of the four
hypotheses are wrong**, and the change that actually pays is one nobody had proposed.

**The tool that made it all possible.** Decoding the whole exam once (326 strips) reproduces the
known 562-edit total exactly, so per-strip attribution became available for the first time. Every
number below comes off that one decode plus cheap variations of it.

**What died, and why it is worth having killed:**

- **"The model invents a bar when a crop has no notes."** It does not. Only 1 of the 8 note-free
  crops that exist in all our labelled pools invented anything (bar: ≥50%). It simply cannot *read*
  them — essentially every token wrong. The 19-edits-against-8-gold-tokens strip reproduced exactly;
  the page has a circled ④ in frame, so the trigger looks like unfamiliar page furniture, not
  emptiness. The *cost* is real and confirmed (≤3-note crops = 5.5% of strips, 20.8% of edits) but
  the shape is the **slicer's** deliberate trade-off, already halved by the current slicer, so
  teaching the renderer to imitate it is backwards.
- **"Cut the wide crops narrower."** Looked like the biggest single lever (>1200 px crops = 28.6% of
  edits at 2.5× the per-token rate). Splitting them at a zero-ink gutter against identical gold made
  it **worse, +31.8%**. And 19 of 45 have no internal bar-line, so a measure-aligned split is not
  even possible. Killed for the cost of one 45-strip run.
- **"Our beams are too heavy, like our sharps were."** The opposite: ours sit at the engraving
  standard 0.500 S, real print is 0.567–0.765 S. Thinning them would have moved us *away* from real
  print — a change that would have shipped into 40,826 strips on an untested analogy.

**The apparent win that wasn't — the most instructive part of the session.** Testing the
staff-geometry hypothesis showed the model getting *better* under perturbation. Decomposed, the
whole effect sat on **scale**: a ~2% shrink removed **15.5% of all exam corrections** (562 -> 475),
reproducible across four scale values with a clean optimum. It looked like the largest free lever
the project had found, and it was written into six documents as a headline result.

**Then it failed to replicate.** On the real-val holdout the same operation gives 247 -> 243, -1.6%.

**The mistake, stated plainly, because it is the reusable lesson:** ~15 variations were run against
the frozen exam and the best-scoring one was reported as a finding, before any holdout was tried.
That is selection on the test set. A holdout run costs two minutes; it should have come first. A new
process decision now says so ([../DECISIONS.md](../DECISIONS.md)).

No mechanism was ever found either, which in hindsight was the warning sign. Ruled out along the
way: staff-size matching (the exam benefit appears in *every* size bucket — undersized -33%,
already-correct -10%, oversized -16% — not just oversized strips), resampling (down-up 555), blur
(562), ink lighten (565), ink thin (589). Also worth recording: the "identity warp" control used to
rule out resampling was itself invalid — an exact identity matrix makes warpAffine copy pixels
rather than filter, so it never tested what it claimed to.

⚠ Not fully closed: real-val is the EASY pool (0.9 edits/strip against the exam's 1.7) and is
missing the hard tier entirely, so an effect confined to hard pages could hide there. That is one
more reason the real-val rebuild gates everything, and the re-test belongs after it.

**Three wrong diagnoses about one file.** All three were about `page_to_strips.py`; two became
patches and both were reverted.
The first added a forward-merge for leading slivers and was **dead code** — re-slicing 67 pages gave
byte-identical output. The second assumed `MAX_STRIP_W` was blocking the sliver merge; the slicer's
own manifests disproved it (0 of 18 narrow crops were `split_wide`). Both diagnoses were inferred
from reading the file instead of measured against its output. Two detectors inside the probes failed
the same way and were caught only by looking at contact sheets. **The rule that came out of it:
measure the estimator before touching the slicer** ([../DECISIONS.md](../DECISIONS.md)).

**Also learned:** synthetic staff spacing has sd **0.000** — every training strip is identical. The
plan said we shake "five times less than reality"; we shake *not at all* before augmentation. That
makes the uncommitted `staff_jitter` op better motivated than the doc claimed, but the ladder says
variance is not what costs edits today, so it stays **insurance, not a fix**.

**Real-val rebuild started, and labelling immediately taught us something.** The gap is
composition, measured: exam 18/41/41 easy/mid/hard against real-val 59/41/**0**. Hard means the
emitter *dropped* the strip (`row_unaligned` / `nd_high`), so no label was ever written — there is
no pile to filter, the strips have to be labelled. 110 are owed; 130 were staged, seeded with the
current model's decode and ordered by confidence.

The confidence ordering is calibrated, not guessed: on the exam's 145 hand-labelled hard strips the
same model is exactly right 80% of the time above `min_logprob = -0.1` and 4% below −1.0. The live
review agrees (84% `ok` in the top bucket). **But confidence cannot see a bad crop** — 3 of the
owner's 7 `bad` verdicts sit in the highest band, where the model confidently and correctly reads a
frame that is itself wrong.

**Which surfaced the real problem: everything we label and everything we examine on is old-slicer
output.** Strips date 2026-07-15..17; the slicer was overhauled 2026-07-25 and nothing was
re-sliced. Re-slicing 5 queue pages: 0 of 30 crops identical, 2 gone, old 207 px slivers now 1435 px
full rows. The owner's independent read from labelling says the same thing — the model reads well,
the bad crops are the old slicer's, and the current slicer's crops are good. The frozen exam carries
the same stale crops, so exam and real-val stay consistent with each other while both measure a
pipeline we no longer ship. Decision left open in [../DECISIONS.md](../DECISIONS.md); the
recommendation is to re-slice before spending the expensive remaining 61 rows.

Also settled, so nobody re-fixes it: **`f'' 32` is not a decode error.** It tokenises identically to
`f''32`; the tokenizer splits the octave marks from `32` either way. Holds for `32` only — `16` and
`8` genuinely differ.

New probes, each carrying its pre-registered bar and its result in the docstring:
`scripts/rung3/empty_crop_probe.py`, `width_split_probe.py`, `beam_weight_probe.py`,
`staff_geometry_probe.py`. Numbers: [../METRICS.md](../METRICS.md). Detail:
[../rung3/round3.md](../rung3/round3.md).

## 2026-07-27 — Round 2 SHIPPED: `round2-stage2-best` int8 is the live runtime

The re-scoring earlier the same day reopened the "not shipped" call and the owner took the ship. It
is the **same disposition as Round 1: an improvement, not a pass** — the pre-registered macro floor
(≥85%) is still failed at 74.2%, and that stays written down rather than rounded up
([../DECISIONS.md](../DECISIONS.md)). What justified it: micro recall 83.9 → 84.8%, macro≥30 recall
81.4 → 84.8%, micro F1 flat, SER 0.059 → 0.052, exact 50.0 → 52.1%, 9 of 11 floors.

**Ship chain, all green.** ONNX export → int8 (221 MB, same as every rung) → `onnx_parity.py`
**14/14 fp32 and 14/14 int8** → `make_browser_gate.py` → browser gate **27/28**. Details in
[../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md).

**The gate list had to be rebuilt** — the Colab checkpoint arrived without a `GATE_STRIPS.txt`, same
as Round 1. Built from `strips_v4` **val** pieces (held out from this model's training): 120
candidates decoded, 108 exact, greedy feature cover → 14 strips / 14 pieces / 11 makams covering
`\sig`, all six koma/küçük/bakiye families, `\tup3`, `\tie`, `\grace` and a double dot. *Why the
method matters:* the first attempt compared decoded **strings** and reported 0/120 exact — the
tokenizer eats the spaces around `\`-tokens, so comparisons must happen in id space
(`data.strip_special`). A string compare would have looked like a catastrophically broken model.

**One gate strip still fails, deliberately kept — and this time we measured why.** A
`kurdilihicazkar` strip drops its opening `\tup3` on the **reference** path only; the canvas path —
the actual product path — reads all 14 strips exactly, and Python-ORT int8 reads that strip exactly.
Feeding the browser's own reference tensor back through Python-ORT with per-token confidences shows
the flipped step is a **genuine near-tie**: `\tup3` p=0.689 vs `e` p=0.306, and it is the **only**
token in the strip under 0.99 (next lowest 0.938). So the runtime is not corrupting a confident
prediction — it is tipping a coin the model was already holding. Graph and JS preprocessing both
exonerated. Second instance of the ORT-web wasm int8 wobble (Round 1's was a dropped double dot,
which does **not** reproduce on this model). Not swapped out for a cleaner strip: swapping would
delete the evidence, and the precedent is now a decision.

**Revert path:** the Round-1 runtime is at `data/checkpoints/_public_models_backup_round1/`; the
Round-2 ONNX at `data/checkpoints/round2-stage2-best-onnx/`.

## 2026-07-27 (evening) — Real-pool label review: 30% of the nota pool had a wrong label

The owner worked the `nota-full` queue through every strip where the label and the model's decode
disagreed. Promoted with `promote_labels.py`: **54 corrected labels applied, 7 `bad` strips
removed**, nota pool 1,747 → 1,740, real pools 2,330 strips / 444 pieces, exam guard still clean.

**Hit rate by disagreement level** (checked strips, "wrong" = corrected or removed):

| nd > 0.06 | 0.03–0.06 | 0–0.03 | nd = 0 |
|---|---|---|---|
| 77% (228) | 79% (273) | 80% (112) | 26% (73) |

So ~78% of the labels on disagreeing strips were wrong — an extremely high return on review time,
and far better than labelling new strips from scratch. Combined with pitch being 40% of the model's
remaining errors, this is the same shape as the `sigTolerant` finding: noisy labels sitting in
exactly the class we are trying to improve.

**Two caveats recorded so the number is not over-read.** The 30% is over the REVIEWED population,
which was selected for being suspicious; the 556 strips still unverdicted are all `nd = 0` and were
never flagged, so their rate is unmeasured and probably lower. And **Round 2 already trained on the
earlier 467 corrections** — verified by reading the manifest back out of `tnc_round2_colab.zip`,
which is byte-identical to today's pre-promotion manifest. Only the 54 new ones are new.

**Consequence for Round 3:** its real pool is cleaner than Round 2's. That is one more difference
between the rounds on top of the corpus changes, so attribution gets harder again unless it is
chosen deliberately ([../rung3/round3.md](../rung3/round3.md)).

Also promoted-with-rejects: 24 rows rejected by the mechanical gates — 14 `over_budget` from the
review queue (the deferred recoveries) and 10 `not_in_manifest` (corrections against strips that are
not in the training pool; checked, none are the exam pieces removed earlier the same day).

## 2026-07-27 (end of day) — Round 3 planned: note heights and note lengths

Written up in [../rung3/round3.md](../rung3/round3.md). Two diagnostics shaped it, both from the
Round-2 exam read with no new decoding.

**Note heights (40% of corrections) are off by ONE or TWO positions in 74% of cases** — a
registration problem, not a reading problem. Measured staff geometry, synthetic vs real: mean line
spacing 30.6 vs 31.8 px (the slicer's normalisation works), but real strips vary about **twice** as
much (± 4.9 vs ± 2.7). One note position is ~15 px. Meanwhile `augment.py` shakes each picture by
only ±3% scale and ~3 px translate — roughly **five times narrower than the real variation**. Fix is
an augmenter setting, not a re-render. Flagged as a lead, not a fact: the staff detector used was a
row-darkness heuristic that lyrics and dense beaming can fool, so it needs re-measuring properly.

**Note lengths (28%) are lopsided:** `8→4` ×8 and `16→8` ×6 — the model reads a note as twice as
long, i.e. loses a flag or beam — plus 15 dot errors both ways. Same shape as the sharp-bar finding:
our font's strokes are heavier than real print and thin detail merges after the shrink. The
`sharp_probe` investigation has never been applied to beams, flags or dots.

Round 3 therefore opens with four measurements before anything is rendered (staff registration,
beam/flag/dot fidelity, crop shapes, strip density), and two things to settle before training: the
success number written down first, and a deliberate choice about changing one thing versus several
— Round 2 changed three and its movement still cannot be attributed.

## 2026-07-27 (later still) — Where the user's corrections actually go: accidentals are 13% of them

No training, no new exam read — just the Round-2 exam's 562 edits classified by what a person would
have to fix. Numbers in [../METRICS.md](../METRICS.md).

**pitch 40% · duration 28% · rhythm signs 13% · accidentals 13% · structure 5%.** Two rounds went
into the 13%. The old headline made accidentals look like the whole problem because it *only*
measured accidentals — the same failure mode as the inline-vs-signature mistake, one level up.

**Errors are concentrated AND pervasive.** 42 of 326 strips carry 63% of edits; 12 strips are >50%
wrong and carry 21%. But excluding those 12 barely moves the mix (pitch 36%, duration 29%), so
ordinary strips misread notes and note-values too. 55 of the note-level errors are whole notes
*inserted or deleted* — the model losing count rather than misreading a glyph.

**The catastrophic strips are a crop-shape gap we created.** The worst is a signature-only crop —
clef + donanım, no notes — where the model hallucinated a measure: 19 edits against 8 gold tokens.
`stripExport` builds chunks from whole measures, so that image **cannot occur in training**: 0 of
40,826 strips, while the exam has 4 of 326 and 28% of its strips are short. Third time in three
sessions that a "model problem" has turned out to be an upstream shape we never rendered.

**Negative result worth keeping — gold octave errors are real but NOT a lever.** All 5 octave-only
substitutions are cases where the GOLD leaps ≥4 steps from both neighbours while the model reads the
stepwise line (owner's hypothesis, and it was right). Consistent with the 187:14 adjudication
precedent of siding with the decode. But it is ~1% of edits and the pools are clean (0.1–0.2% of
strips carry an isolated octave spike), so it does not explain the pitch weakness. Theory closed
with a number rather than left open.

**Consequences for Round 3:** aim at pitch and duration, not accidentals; render the crop shapes the
slicer produces first (cheap, no training); and measure the corpus's pitch/duration distribution
against the real pools before designing anything — that method has overturned the plan twice.

The error-localisation UI is **deferred by the owner**. The measurement that would justify it is
still cheap and still owed, with a pre-registered rule: flagging 10% of tokens must catch ≥60% of
errors.

## 2026-07-27 (later) — The goal changed: user effort, not model accuracy

**New goal: ≥90% of pages need ≤5 corrections, and the app shows where they are.** "85% on the
per-class accidental mean" is demoted to a diagnostic. Reasoning in [../DECISIONS.md](../DECISIONS.md);
baseline in [../METRICS.md](../METRICS.md); the goal itself lives in [../../ROADMAP.md](../../ROADMAP.md) §0.

Three things pushed it. The old metric does not track usability — Round 2 got *better* for a user
(fewer edits, more perfect strips) while that metric got worse. We are already at **84.8%** on its
low-n-robust form, so the remaining headroom is two rare classes. And the untouched lever is bigger
than the remaining accuracy: a page is ~95% correct already, but the user must proofread all of it
to find the ~5 wrong marks, which is where the time saving goes.

`eval_omr.py` now reports an `EDITS/PAGE` block so the goal is measured, not aspirational
(`Strip` carries `page`; one edit = one substitution/deletion/insertion). Round-2 baseline over the
46 exam pages: **57% of pages ≤5**, median 5, mean 12.2, 52% of strips already perfect.

**The target was restated once, immediately, and the reason is worth keeping.** It was first written
as "a typical page needs ≤5" — reasoning from the mean (12.2) and assuming that was a ~2.4×
improvement. The baseline then came back with a **median of 5**: the distribution is heavily
right-skewed, so the target as first written was satisfied on the day it was set. Restated on the
*share of pages* (≥90% ≤5), which is where the actual pain is. A goal that is met the moment you
write it measures nothing.

Non-claims attached to it: the exam is a matched upper bound, so real uploads will be worse; and
whether error localisation genuinely saves a user time is unmeasured — that needs a person
correcting real pages with and without the highlights, not a model metric.

## 2026-07-27 — Round 2 read the exam once: headline down, everything else up, diagnosis half-right

Trained on `strips_v4` with Round 1's recipe held fixed (two-stage, `--real-dir …:9` to hold real at
34% of batches). Exam read once on the 326-strip clean set. Numbers: [../METRICS.md](../METRICS.md).

**The result is genuinely mixed, and the headline is the part that got worse.** Against `round1-best`
on the *identical* strips with the *same* re-audited gold: mean AEU F1 **78.0 → 73.9%**, but SER
0.059 → 0.052, exact 50.0 → 52.1%, and 9 of 11 floors improved (Round 2 clears `\komaFlat`
precision, which Round 1 missed). **Not shipped** — Round 1's "improvement, not a pass" argument
does not extend to a model whose headline moved backwards.

**What the fixes actually did.** Küçük-in-signature recall went **50 → 72%**, and küçük overall
58.1 → 69.7% — the label-noise fix worked in exactly the place it was aimed. Its precision fell
100 → 76.7%, the trade registered before the run.

**What they exposed.** The Round-1 error was one-directional: gold küçük decoded as koma, reverse
essentially never — the signature of a fallback bias, which is what 91% of drawn küçüks being
labelled as nothing would produce. That bias is gone. Underneath it is a **symmetric** confusion:
`\kucukSharp → \komaSharp` 8×, `\komaSharp → \kucukSharp` 7×, **all 15 inside the `\sig` block**,
net `\komaSharp` emission **0**. The model is no longer guessing the common class; it genuinely
cannot tell 2 bars from 3 at signature positions.

*(An earlier reading of this — "we flipped the bias" — was wrong, and the confusion counts
disconfirmed it. Net komaSharp emission of 0 is not a bias in either direction.)*

`\komaSharp` collapses to F1 21.4% because n=14: seven wrong swaps is half the class. `\kucukSharp`
takes the same coin flip across 33 gold and still reads 69.7%. A per-class mean over six classes
then carries koma's collapse straight into the headline — the low-n fragility METRICS has warned
about since Round 1, now costing 4pp.

**The lead this opens.** Every glyph-fidelity measurement we have — `sharp_probe`, the 0.300 S bar
weight, küçük's pitch widened to 0.65 S — was taken on **inline** glyphs. Signature glyphs are
packed at `SIG_GLYPH_ADVANCE = 13 px`, were never examined, and hold **32 of the exam's 33 küçük
tokens**. Widening küçük's bars may even hurt there, where horizontal room is fixed. That is Round
3's first measurement, and it should be measured before anything is re-rendered.

Instrumentation added the same day: `eval_omr.py` now reports recall split by print position, which
is how the signature-only confinement was visible at all.

**Then the metric itself was fixed — and it overturned the verdict above.** The headline is a mean
over classes, so a 14-gold class weighs the same as a 145-gold one. `eval_omr.py` now also reports
**MICRO** (pool tokens, not classes) and **MACRO≥30**, and `scripts/rung3/rescore_headline.py`
back-fills both for every past run straight from the stored `per_class` blocks — hits and false
positives are recoverable from gold/recall/precision, so **no model was re-run and no exam re-read**.

On the identical 326 strips:

| | Round 1 | Round 2 |
|---|---|---|
| macro recall (historical headline) | 78.5% | 74.2% |
| micro recall | 83.9% | **84.8%** |
| micro F1 | 85.0% | 84.8% |
| macro≥30 recall | 81.4% | **84.8%** |
| macro≥30 F1 | 83.9% | **84.4%** |

**Round 2 was never a regression** — flat-to-better on every low-n-robust measure, on top of SER,
exact-match and 9 of 11 floors. The "not shipped" decision is overturned and the ship question
reopened.

Two things deliberately NOT done. Micro was **not** promoted to the headline: it was computed after
the fact and happens to flatter us (~85% vs 74%), and swapping the bar to the number that makes the
result look good is how a benchmark stops meaning anything. Macro stays the pre-registered bar —
for a music app, a rare mark misread is still a wrong note — with micro/macro≥30 used to judge
*whether a change helped*. And the 85% target was **not** restated against micro; the real repair is
more `\komaSharp` gold in exam v3, so the strict metric becomes trustworthy instead of replaced.

Retrospective worth keeping: macro has been reporting 66–78% across this project while token-level
accidental accuracy sat at 83–85% for both models. Neither number is wrong; they answer different
questions, and only one of them was ever being quoted.

## 2026-07-26 (later) — The küçük deficit is a SIGNATURE-reading problem, and 5 exam pieces were in the corpus

Two findings while starting the Round-2 re-render, both of which changed what gets rendered.

**1. We had been aiming at the wrong print position.** The Round-1 follow-up said to balance
*inline* küçük frequency (1,887 koma vs 206 küçük strips) and to put the three sharps on
neighbouring notes. Splitting every gold label into `\sig … \sigend` tokens vs note tokens shows the
exam's küçük gold is **1 inline vs 32 in the signature** (photo gold: 3 vs 13), and the scorers
count both. So the whole class is effectively scored at the row start.

It cannot be otherwise, and the reason was already in our own code: `noteToLily`'s `sigTolerant`
branch (`tools/render/lilypond.ts`) prints a note **bare** when its alteration runs the same
direction as the signature's — SymbTr stores the SOUNDING value, so eviç is a 5-comma F♯ printed
bare under a koma-sharp-F signature, which is what real editions do. Confirmed end-to-end: a dry
render of two küçük-heavy pieces (mahur, nisaburek) under real non-küçük signature variants produced
**zero** inline `\kucukSharp` — the mechanism built to force them inline cannot work, by design.

In the context that scores, the corpus was never imbalanced: küçük sits in 1,210 signature strips
against koma's 1,422. The real gap is **diversity** — signature-position küçük comes from just 3
makams in 4 spellings, so "mahur ⇒ küçük-f donanım" is learnable without reading the glyph.

*Why this was missed:* the imbalance was counted with the signature block stripped out, and the
count was never checked against where the gold actually sits. Print position is now a first-class
split in METRICS, and the scorers owe the same split.

**2. `strips_v3` contained 5 exam pieces.** `hisarbuselik--vuslata_nail`, two `kurdilihicazkar`
şarkıs, `mahur--cihani_lal-i`, `nikriz--zeybek`. The train-time disjointness guard added after the
Round-1 contamination only inspects the `--real-dir` pools, so our own synthetic engraving of an
exam piece walked straight past it. `select_pieces.py` now refuses exam pieces by SymbTr id at
selection time.

**Shipped with this:** `select_pieces.py --keep/--boost-class/--per-makam-cap/--sig-table/--exam`
(extend a selection instead of re-rolling it — re-rolling would change the held-out set and
invalidate the split), `data/pieces_v4.json` = 208 pieces (185 kept − 5 exam + 23 küçük-bearing,
capped at 6 per makam and restricted to makams with a real printed signature).

**Dropped before use:** the enharmonic respell `\bakiyeFlat` → `\kucukSharp`. It works mechanically
and is the same trick that manufactures büyük examples, but it prints a spelling real editions
don't use, and küçük precision is already 100% — it could only fall.

**3. Then the dry render showed a strip drawing a sharp its label didn't mark — and it was in the
shipped corpus.** `sigTolerant` (print same-direction alterations bare) was implemented on the
LABEL side only; `SheetView` drew every deviation from the signature. Counted over `strips_v3`:
**18.8% of signature-bearing carry strips draw at least one accidental the label omits** (5,240 /
27,933; 8,485 accidentals, 137 pieces), and the worst-hit class is `\kucukSharp` — **2,369 drawn but
unlabelled against 234 correctly labelled inline, i.e. 91% of the küçük sharps drawn on a notehead
are labelled as nothing.** The model was trained to see the glyph and emit nothing, which is exactly
its measured behaviour: 48% recall at 100% precision.

Fixed in `SheetView` by giving the drawing the same rule (owner decision: fix the pixels, because
real editions print bare — the exam has 1 inline küçük in 352 strips). Verified pixels-only: over a
re-rendered piece all 20 labels are byte-identical, the previously spurious sharp is gone from the
image, and genuine deviations still print. `round1-best` trained on the un-fixed corpus, so its
sharp numbers carry label noise as well as Bravura's bar weight — the two are not separated by any
measurement taken so far.

**4. Built the check whose absence let all of this ship: `tools/render/verify-labels.ts`.** It
re-opens every job from the corpus manifest (which stores the full URL parameter set, so the job
reproduces exactly), reads every accidental glyph out of the live SVG — Bravura glyphs by SMuFL
codepoint, the redrawn AEU sharps by their unique stem/bar counts — assigns each to the crop rect it
falls inside, and compares against that strip's label, signature block included. Glyph identity
comes from the DOM, never from the code under test.

Validated with a POSITIVE CONTROL before being believed: with the `sigTolerant` fix temporarily
reverted it flagged 15 of 30 strips on three known-bad v3 jobs, every delta exactly `\kucukSharp`
drawn-but-unlabelled. A gate that has never been shown to fail proves nothing.

Full `strips_v4` pass: **40,826 of 40,841 exact, 0 label drift, no unrecognised glyphs.** The 15
flagged are crop-boundary bleed — measure boxes don't split exactly between glyphs, so a crop
occasionally clips its neighbour's accidental; they appear as ± pairs on adjacent strips, and the
image shows a cut-off notehead before the barline. Geometric, pre-existing, 0.037%. Excluded from
the manifest rather than trained on (`excluded_boundary_bleed.txt`), so the shipped corpus is 40,826
strips. `make_round2_colab_zip.sh` refuses to build if any flagged strip is still in the manifest.

**5. The Round-2 shakeout refused to start — and it was right to.** `train.py`'s exam-disjointness
guard found **4 real-pool pieces that are also exam pieces** (`huzzam--sevdim_yine`, two
`kurdilihicazkar` şarkıs, `saba--neydin_guzelim`). These are the 2026-07-22 contamination: the guard
was added then, but nobody removed the strips behind it, so they survived into Round 2 and this is
the first run that actually tripped over them. 14 strips dropped (11 nota, 3 tup); real pools are now
2,337 strips / 444 pieces with zero exam overlap. Originals kept as `manifest.jsonl.pre-examclean`.

The lesson is not "the guard works" but that a **guard without a cleanup leaves the bad data in
place** — it only converts a silent problem into a loud one at the next run, which in this case was
four months later. The same shape as finding 3: the check that would have caught it did not exist
where the data was produced.

**Not built: the signature-contrast drill set.** The plan was to generate donanım spellings the 3
real küçük makams don't cover. Dropped after checking the adjudicated real labels: across every
printed signature we have, `\kucukSharp` appears on **f and nowhere else** (104 occurrences), so a
drill would have to print accidental/letter pairs no edition prints — the same objection that killed
the respell. Signature coverage comes from the 23 added pieces instead.

## 2026-07-26 — Microtonal sharps: it was our renderer, fixed at source

Diagnosed in three steps, cheapest first ([../rung3/round2.md](../rung3/round2.md)):
- **Resolution ruled out.** `scripts/rung3/sharp_width_test.py` regroups already-scored strips by
  the encoder's effective scale (Donut thumbnails a 336×579–2472 strip into 409×583, scale
  1.22→0.24). Recall does not fall with scale on either dataset; `\bakiyeSharp` holds 84–94% in
  every bucket. The deficit follows the **symbol**, not the size — so the expensive narrow-strip
  rebuild was never the lever. *(Logged, not chased: ~⅔ of the encoder's input window is blank
  padding, because a 4:1 strip fits a 1.43:1 box.)*
- **One substitution, one direction.** Gold `\kucukSharp` → decoded `\komaSharp`, 11× clean exam /
  10× photos, top error in both; the reverse essentially never.
- **Root cause: Bravura's glyph weight.** The four AEU sharps are one systematic design (1–2 stems
  × 2–3 slanted bars), so reading them *is* counting bars. Measured against two real editions at
  matched staff size, Bravura's bar is too thick and küçük's three bars too tightly packed, leaving
  under half the real white gap (~1–2 px after the shrink) — the bars fuse into a block that IS a
  2-bar koma. Real print also draws küçük's outer bars stubby either side of a full-width middle
  bar; Bravura's three are near-equal, which kills the staircase a reader recognises.

**Shipped opt-in:** `drawThinSharps` (`apps/web/src/SheetView.tsx`) redraws all four AEU sharps as
SVG at real-print bar weight; `?thinsharps=1` / `--thin-sharps`, off by default. Verified in-browser
(every AEU sharp replaced, 0 left on Bravura). Artifacts: `data/real/rung3/sharp_probe/`.
**Still owed:** the frequency imbalance (see [../METRICS.md](../METRICS.md)).

Also this day: the docs were restructured for agents (this file, `CLAUDE.md`, `STATUS.md`,
`METRICS.md`, `DECISIONS.md`, `docs/rung3/*`), and the pointer docs — which had drifted 18 days
behind — were re-synced first.

## 2026-07-25 — Photo axis, and the exam's own answer key

- **Slicer photo front-end.** Raw `page_to_strips.py` yielded 0 strips on 72% of photo pages: its
  `w/4` staff-detection kernel cannot tolerate ~1.5° handheld skew (a skewed line never stays on one
  pixel row for a quarter of the page). Fixed with guarded auto-deskew + crop-to-quad/perspective
  de-warp + `STAFF_HOR_FRAC = 0.11`; all no-ops on clean scans, and the narrower kernel also stopped
  silently dropping faint/bottom systems on clean renders. **Yield 28% → 97%.**
- **Honest photo score.** First a fitting-alignment estimate against borrowed clean gold, then the
  owner hand-labelled **284 photo strips** directly (`build_photo_gold_queue.py` + review UI
  `photo-gold` tab) and `score_photo_gold.py` scored strictly per strip. Photo sits **3–4pp** behind
  clean pages → the photo domain is basically solved by the front-end, and the remaining weakness is
  a clean-domain reading problem.
- **`|` and `\tie` are fine** (90/94% F1) despite the initial impression; the weakness is the
  microtonal sharps.
- **Exam gold re-audited.** The frozen gold was already ~82% reviewed, so a full hand-audit found
  only 13 new label errors — and they ran one way: the human answer key **over-sized** sharps
  (buyuk/koma where the page prints bakiye). Re-scoring lifted the headline, but ~11 of the 12pp is
  a low-n artifact, not model improvement. **Two lessons:** the per-class-mean headline is fragile
  to low-n classes (exam v3 must floor or weight by n), and Round 1's "fail" was partly a label
  artifact — while the koma/küçük-sharp weakness is real.
- New scripts: `decode_photos_exam.py`, `score_photos_exam.py`, `score_clean_baseline.py`,
  `score_photo_gold.py`, `build_photo_gold_queue.py`, `build_exam_fix_queue.py`, `apply_exam_fix.py`,
  `photos_exam_report.py`, `sharp_adjudication_report.py`; `review_ui.py` gained the
  `photo-gold` / `exam-fix` queues and multi-root image serving.

## 2026-07-24 — Carry-sig bug characterized

The synthetic no-regression failure's error dump named a real defect: under a
`\sig \kucukFlat b \sigend` signature the model inserts a spurious inline `\komaFlat` on `b'` —
restating, in the wrong koma family, an alteration the signature already carries. **Carry-mode
accidental/signature interaction is not solidly learned**, it reproduces on synthetic (so it can be
iterated on with perfect labels), and it plausibly explains both the exam's `\komaFlat` precision
miss and the komaSharp↔kucukSharp confusion. Logged in `MODEL_EVAL.md` as "carry-bug".

## 2026-07-23 — Round 1 shipped as "an improvement, not a pass"

- **Disposition.** On the honest exam it missed 5 floors, but it beats the previous live model on
  everything tracked: rhythm-rewriting pathology 77.6% → 0%, SER 0.147 → 0.060, exact 17% → 49%,
  triplet precision 15% → 93%. Keeping the worse model live would hurt users, so it ships with the
  result recorded honestly.
- **Shipped:** `round1-best` int8 is the runtime in `apps/web/public/models/`. Parity 10/10 fp32 +
  10/10 int8. Browser gate **19/20** — one rare double-dot token (`a''2..` → `a''2.`) trips an
  ORT-web int8 numerics wobble that is model-independent (reference *and* canvas fail identically →
  not JS preprocessing; Python-ORT int8 is correct → not the graph) and was never exercised by the
  old gate. Logged as a Round-2 investigation item, not blocking. Previous runtime backed up at
  `data/checkpoints/_public_models_backup_rung22/` (revert = re-stage it).
- **Run-first diagnostics** (items 1–4 of the plan-review addenda; 5/7/9 kept as commitments, 6 & 8
  dropped by the owner):
  - *Item 1* — the 28pp real-val↔exam gap decomposed by difficulty tier: **composition dominates**
    (real-val lacks the 41% hard tier), edition familiarity is small, and a new
    **decode-self-agreement inflation** surfaced (real-val mid is ~45% `acc_disagreement` strips
    whose labels ARE the decode). Cheap residue of dropped item 6 kept: exclude decode-derived
    labels from the rebuilt real-val metric pool.
  - *Item 4* — degrade probe: hallucination is **not** ambiguity-driven (precision and emission rate
    flat clean→OOD), so Round 2 should not chase renderer accidental-rate deconfounding.
  - *Item 2* — train-time exam-disjointness guard shipped in `train.py`; flags exactly the 4 known
    contaminated pieces.
  - *Item 3* — canonical real-val split shipped as `data.is_real_val_piece` (byte-identical to
    Round 1); both Round-2 consumers must reuse it.
- **Plan-review addenda adopted** — see [../rung3/round1.md](../rung3/round1.md) for all nine, and
  [../DECISIONS.md](../DECISIONS.md) for the two that were dropped.

## 2026-07-22 — Round 1 trained, then examined: FAIL on five floors

- **Init A/B done.** Arm A (two-stage) wins on real-val. The triplet catastrophe is fixed — the slur
  distractors did their job. Margin is low-n driven; on ≥30-gold classes the arms tie. A pre-run fix
  is logged: stage 2 first had real at 5.9% (each real strip seen <1× in 2k steps), caught before
  running and corrected to `:8`, else Arm A was merely "Arm B with a warm start".
- **Every-share sweep cancelled** before any run, after first being amended the same day. Grounds
  were measured, not preferred: the largest available intervention moved the amended metric 0.5pp,
  the target pathology was already fixed by the re-render, and the amendment carried a
  stage-1-length confound. Full reasoning: [superseded.md](superseded.md).
- **Exam taken once → does not pass.** Read locally so exam strips never reached the training box;
  pre-flight re-confirmed the freeze from gold labels alone. Five floors missed, five cleared
  (numbers: [../METRICS.md](../METRICS.md)).
- **The lesson that outlived the run: real-val was wildly optimistic** (95.0% → 66.6%, ~28pp)
  despite both pools being piece-disjoint — real-val pieces sit inside editions the model trained
  on. Standing rule: real-val orders candidates, it does not predict the exam.
- **New Round-2 targets from the error dump:** `\komaSharp`↔`\kucukSharp` confusion in both
  directions within one piece, and `\tup3` → `\grace` substitution (the model stopped over-firing
  triplets and now under-reads real ones).
- **Contamination found in post-read verification:** 4 SymbTr pieces / 25 strips (7.1%) had their
  *other* engraving in the training pools. Root cause: the disjointness guard was emit-time only and
  nothing re-validated when the exam GREW. Corrected read on 327 clean strips barely moved the
  numbers, so the verdict stands; `strips_exam_v2_clean/` is the honest reference from here.
  Exam v3 owes a train-time assertion (shipped the next day), re-validation whenever the exam grows,
  and dedupe on SymbTr piece id rather than image stem.

## 2026-07-21 — Round-1 synthetic re-render: `strips_v3`

- **Ordering changed: Round 1 runs first, the additive-only re-slice moves to Round 2** (see
  [../DECISIONS.md](../DECISIONS.md)). Round-1 data scope frozen.
- **Design (locked):** carry mode (`measure`) replaces keysig and is dominant, at transpose 0 only
  so the conventional makam signature matches the notation, bulked via `CARRY_PASSES=4` seeded
  passes; `every` mode is the minority and carries the transpose augmentation. `stripExport.ts`
  gained a carry branch (`\sig` prefix on row-start only — matching how real carry strips are
  labelled).
- **Per-makam conventional printed signatures**: `data/makam_signatures.json` +
  `scripts/build_makam_signatures.py`, built from adjudication-confirmed `\sig` blocks in the
  promoted real labels (theory only as fallback), variants uncapped (hicaz 4, şehnaz 4,
  nisaburek 3), all 49 corpus makams — fed to both the drawn glyphs and the labels.
- **Slur distractors** (`drawSlurArc`): label-free arcs over ≥3 notes with no "3", on a seeded ~35%
  of non-tuplet runs — the fix for "any arc ⇒ `\tup3`". Verified pixels-only (15 drawn with seed vs
  0 without; labels byte-identical).
- **Accidental-distribution measurement:** carry matches real (0.36 vs 0.32 inline accidentals per
  strip) but `every` is 26.7% of strips and 81% of all inline accidentals — 4.4× the real effective
  rate. This produced the `--every-share` decision (and, later, its cancellation).

## 2026-07-20 — The exam baseline and the pre-registered bar

- **Exam v2.1 baseline taken** over the full 352 strips; supersedes the 33-strip 83.3% number as
  THE pre-Round-1 reference. The numbers Round 1 had to move: `\tup3` precision 15.1% (rampant
  hallucination, dominating SER), `\kucukSharp` recall 22.6%, `\tie` 66/61%.
- **Multi-pool loader** in `train.py`: repeatable `--real-dir DIR[:REPEAT]`, stable piece-hash
  real-val split consistent across pools, synth-val pieces forced to val, `--oversample-tup N`, real
  strips train un-augmented unless `--augment-real`, checkpoint selection on the strip-weighted
  synth+real val mix — the exam never consulted.
- **Step 4.0 ship criteria written** before any training and before the exam was seen again: every
  floor stated next to its measured baseline, ties deliberately unfloored, blind spots written down
  as non-claims, and a binding decision rule (real-val selection, exam once, no silent re-roll).
- **Arc-metric code landed first** and the baseline cell was filled by re-running the *spent*
  rung22-stemfix exam read (same frozen model + exam = zero leakage): denominators came out to
  exactly 85/229 and F1 to 57.0%, confirming the pre-registration. Never debug measurement code on
  one-shot exam day.

## 2026-07-19 — Exam v2.1 frozen; slicer hardened

- **tup3 review queue fully adjudicated** by hand (147 rows: 102 fix / 35 ok / 10 bad) plus the full
  78-strip audit (70 ok / 7 fix / 1 bad — 10% auto-accept error, the best pool yet).
- **nota-full quality tier**: +38 model-drafted verdicts. Two rules came out of it — the
  **meter-sum rule** (the label won all 15 duration-only disputes; decode durations break the
  measure meter every time) and the **sig superset/subset rule** (decode won 17 crop-cut cases, the
  label won 5 where the decode hallucinated an extra sig entry; superset sig reads are suspect,
  subset/empty reads are usually crop truth). Promotes applied: **strips_nota 1,742 → 1,758**
  (420 audit fixes in place, 27 promoted, 11 known-bad removed, 24 over-budget → the re-slice
  pool); 126 nota-full pitch/accidental disputes stayed pending as post-Round-1 re-audit work.
- **tup3 exam extension:** 10 holdout tuplet pieces (21 stems, all engraving copies) moved to the
  exam → exam manifest 311 → 352 strips, tup3 gold 4 → 55 groups; training keeps 172 tup3 strips.
  `testset.json` = **v2.1** (45 piece entries). Holdout stems poisoned in the nota queue too.
- `promote_labels.py` now rejects ambiguous source stems (2 title collisions, e.g.
  `bir_nigah_et_ney` = two different songs — their shared page dir is a latent re-slice hazard).
- **Slicer hardened** against real-corpus false positives (stems and G-clefs cut as barlines,
  skew-eaten staff extent, phantom clef+sig lead measure): a third TERMINATION gate walking the
  connected overshoot past the outer lines, raw-ink staff extent, notehead-gated prefix trim, padded
  crops, reject-reason debug overlay, and `scripts/rung3/score_slicer.py` as a regression scorer.

## 2026-07-17/18 — Exam hand-work finished; tuplet collection

- **examv2-full done** (the last exam hand task): all 63 auto-accepted exam strips verdicted —
  31 ok / 32 fix / 0 bad. Fixes were 22 tie-only, 4 volta/repeat, 4 pitch/duration (~6% content
  error), 1 sig-block removal, 1 accidental-class fix. **mahur (18) + suzidilara (16) sig-suspects:
  zero signature corrections** — the voted signatures were confirmed. 31 of 32 applied; the 32nd was
  60 ids (over the 59 cap) and removed as unwinnable. Exam manifest → 311 strips.
- **Targeted tuplet collection** (the response to the measured tuplet gap): SymbTr scanned for
  tuplet pieces (459 found, 267 already held), **293 new tuplet pieces downloaded** (36 nota
  review-promotes + 257 neyzen from the never-downloaded census tail; 60 brand-new SymbTr pieces +
  164 second-engraving copies of pieces already held). Budget analysis showed tup3
  needs 1-measure windows — `OMR_MEASURES_PER_STRIP` knob added; 2,325 tup3 measures / 3,384 groups
  fit at k=1, while 1,512 dense measures still await the sub-measure fragment design. The k=1 decode
  ran on Colab per the fanless-Mac rule.
- **strips_tup trimmed to tup3-only** (owner call): 78 accepted strips / 114 groups (every group
  verified as exactly 3 closed notes) + a 147-row review queue / 205 groups. Review-UI tabs
  `tup-full` / `tup-review` / `tup-audit` wired.

## 2026-07-16 — nota audit, adjudication at scale, exam grown 10×

- **69-strip nota audit** fully adjudicated (29 ok / 40 fix). Decomposition: 8 pure sig-order (now
  no-ops after canonicalization), 1 sig-block, 26 tie/repeat structural, **5 pitch-level = 7.2%
  content error** vs neyzen's 22.6% — the Round-0.5 labeler earned its keep.
- **All 231 sig_mismatch + all 216 acc_disagreement rows verdicted.** Training manifest
  1,262 → 1,435 → 1,742 across two promotes (combined real pool 1,853 after the first, 2,160 after
  the second, neyzen included).
- **The acc_disagreement lesson:** the owner's fixes sided with the decode 187:14 over SymbTr —
  printed editions win accidental disputes, the never-auto-accept rule avoided 187 headline-class
  poisonings, and the labeler's decode is the right *edit draft*.
- Sig-entry order canonicalized everywhere (serializer + ~404 existing labels); 198 sig-less w00
  labels validated and kept (crop-cut dominates, 96%).
- **examv2-review done** (287 rows: 249 promoted / 12 bad / 26 over-budget = unwinnable under the
  59-id cap): exam manifest 63 → 312 strips. `promote_labels.py --exam` added; exam and training
  pools are mutually guarded.
- **The exam measures triplets weakly** — `\tup3` gold was only 4 (budget depletion), which is what
  later forced the tup3 exam extension.
- Sharpness analysis: the review queue is systematically the blurry tail (accepted median 1672 vs
  ~900 Laplacian variance), except `acc_disagreement` rows (1703 — sharp *and* accidental-bearing =
  the best value left). Rare-class real gold is thin (komaSharp 26 / kucukSharp 31 tokens) →
  synthetic oversampling, not queue-grinding.
- **Photo-domain exam prep:** all 25 exam-piece PDFs staged and merged
  (`data/real/rung3/photo_exam_pdfs/`, 38 pp) for print-and-photograph.
- Three slicer defects logged for the re-slice: w00 crops cutting clef/sig, note stems mistaken for
  barlines, bisected noteheads. Review policies logged: a cut note or dangling accidental *inside*
  labeled content = bad, *outside* = ignore the fragment.

## 2026-07-15 — Round-0.5 labeler + the two-source stage

- **Round-0.5 labeler trained + exported** (throwaway, real-only, from `rung22-stemfix-best` on the
  418-strip promoted pool, exam pieces excluded from train AND val): real-val SER 0.086 → 0.021,
  AEU 70 → 91.7%, sig reads 100%; parity 8/8. Never shipped — it exists only to draft labels.
- **notaarsivleri two-source stage complete:** census 20,833 TSM pieces → 966 metadata accepts →
  964 downloaded; **1,227 pages GPU-decoded on Colab**; a fold-search 2ⁿ blow-up fixed
  (`SPAN_SUBSET_CAP=12` + hill-climb). Emit over 938 pieces (440 ok / 338 low_coverage /
  160 missing_pages) → **1,262 accepted nota strips + a 2,671-row review queue + a 69-strip audit
  sample**. Dominant drops: row_unaligned 4,467 / split_wide 3,757 / over_budget 2,108 — the
  `MEASURES_PER_STRIP=2` re-slice is the #1 yield lever.
- **Exam re-frozen as v2**: 25 pieces / 16 makams (23 nota + 2 neyzen), every reachable class ≥44
  gold, no LOW-N; exam emit 63 strips + a 287-row growth queue. Sig clusters flagged but not yet
  adjudicated (mahur, suzidilara).

## 2026-07-14 — Adjudication and the promote script

The 348-row neyzen review queue was hand-adjudicated (341 fix / 4 bad / 3 ok — the conservative gate
was right: nearly everything flagged needed fixing). `scripts/rung3/promote_labels.py` applied the
verdicts through the real gates (≤59-id budget with the training tokenizer + a labels-cli `--check`
round-trip over raw label text): **training pool 84 → 418 real strips**, provenance columns on every
row. 10 rejects: 7 over-budget (60–73 ids — re-slice territory) and 3 split-duration typos. The
script is idempotent, keyed on image.

## 2026-07-12 — The emitter, the first frozen exam, the first real number

- **Strip-label emitter built and calibrated** on the 85 matches (emitter-first order, owner
  decision): carry-mode label serialization + carry-aware decode, persisted slicer measure geometry
  (PNGs byte-identical), per-token logprobs in the ONNX decode, `labels-cli --ranges` batch mode, and
  `emit_strip_labels.py` — D.S./da-capo tail folding (64/85 pieces jump), content-driven monotonic
  row search (editions reorder sections; a cursor can't follow), printed-signature majority vote with
  label override (real pages print the makam's **conventional** signature, not SymbTr's derived
  one — 33/85 overridden), `sigTolerant` written-vs-sounding handling, and a triple gate
  (≤59-id budget, decodeLabel round-trip, decode-disagreement threshold with accidental-class
  disagreements always going to a human).
- **Yield:** 84 auto-accepted training strips + a 348-strip review queue + 33 exam strips.
- **First frozen exam** (`testset.json`, provisional): 20 pieces / 16 makams, all 6 reachable AEU
  floors met, seeded and deterministic. `eval_omr.py` gained per-source blocks and LOW-N markers.
- **First real baseline: the synthetic→real gap became a number.**
- **Review UI** (`review_ui.py`, stdlib server on :8377): queue tabs, one-keystroke ok/fix/bad
  verdicts written atomically into the emit CSVs, solfège display, label-vs-decode token diff,
  Bravura token reference. **Full audit of all 84 accepted strips: 65 ok / 19 fix / 0 bad = 22.6%
  needed correction** (spurious flattened-SymbTr `\repstart` the edition doesn't print; slurs
  decoding as false `\tie`).

## 2026-07-11 — Free labels from name matching

`scripts/rung3/match_symbtr.py` fuzzy-matches the 798 downloaded PDFs against SymbTr (makam alias
table, incipit/composer/form token scoring): **85 auto-accepted pairs**, 28 review-band, exported per
piece as `score.json` (ground-truth note model) + `labels.json` (per-measure tokens via the new
`tools/render/labels-cli.ts`). Written-vs-sounding verified: the `toAeuAlter` snap makes an uşşak
export print `\komaFlat b` like the page does.

## 2026-07-10 — Real corpus collected; the page pipeline works end to end

- **Corpus collected:** `scripts/collect_notalar.py` (census → makam-weighted download →
  PDF→PNG rasterize) pulled **798 engraved PDFs → 1,259 page PNGs at 200 dpi across all 89 makams**
  from neyzen.com's freely-published archive (robots-allowed paths, polite, resumable, seeded).
  Census = 8,442 pieces; downloads proportional to per-makam song count with a floor for variety.
- **Rung-4 stages 1–7 (slicer + page decode):** `page_to_strips.py` — staff systems via
  horizontal-open + row projection, each row scale-normalized to the training geometry, barlines by
  **continuity + thinness** (plain per-column darkness is not enough: stems pass it and real
  barlines fail it), ~3-measure windows, row-starts keeping clef+keysig, over-wide fallback splitting
  at whitespace gutters, `--debug` overlay. Five real-page bugs fixed during verification, including
  **volta brackets clustering as a 6th staff line** (fix: keep the most evenly-spaced 5-line window).
  `decode_page.py` chains the slicer into the int8 ONNX greedy decode. First real page (hicaz şarkı,
  7 rows → 21 strips): keysig read on every row-start, repeat/volta structure captured, accidentals
  decoded. Known rough edges at the time: spurious tuplet tokens on some 16th pairs, occasional
  `\sig` inconsistency — exactly the synthetic→real gap the labeling loop trains away.
- **Rung-4 stage 8 (stitcher + editor feed-in):** `tools/render/stitch.ts` turns decoded strip tokens
  into a schemaVersion-1 note model — joins strips/rows re-inserting the `|` the crop boundary ate,
  resolves bare notes from the row's `\sig` block (an empty block never clears an established
  signature), folds rhythm signs back, then expands structure (repeat/volta passes, D.C. al Fine with
  segno/coda jumps) and emits bar-unit offsets so `assignBars` reproduces the decoded barlines. Model
  noise is normalized and warned, never fatal. Verified: 13 structure unit tests + **194/194 bundled
  scores round-tripping exactly**. The loop closed: `decode_page.py` → `stitch-cli.ts` →
  `apps/web/public/decoded.json` → harness, with a **⬇ Save JSON** button exporting corrections.
  Live proof: the hicaz page gave 21 strips → 23 written / 28 expanded measures and 225 events that
  render and play (headless-verified); a second page (nihavend) gave 25 strips → 29 written / 37
  expanded measures, 288 notes.

## 2026-07-09 — Rung 2.2b: stem fix + triplet expansion

A real neyzen upload misread triplets as `16. 32`. Two fixes: a renderer bug (`new Beam(sub, true)`
forced tuplet stems down, so the "3" engraved below where real scores put it above) and 40
triplet-rich pieces added (150 → 190), rebuilding `strips_v2_2` with 1,487 triplet strips (was 413)
and 89 val triplet strips (was 9). The from-base retrain passed with no regression, and the ONNX
export passed the same day including a **real-strip proof**: the strip that triggered the round now
decodes `\tup3 g''8 f''8 \tupend`. One nav gate strip was fp32-exact but int8-borderline
(`\buyukSharp`→`\bakiyeFlat`) and was swapped for an int8-exact strip.

## 2026-07-08 — Rhythm signs (triplets, ties, grace notes)

Four faithful tokens `\tup3` `\tupend` `\tie` `\grace` (96 → 100 ids, appended at the end), all
**recovered from real SymbTr durations, never injected** (`tools/render/rhythm.ts` — pure per-measure
functions shared by SheetView and the serializer, so pixels == labels by construction). Delivered:
parser/exporter grace kind, core `EventKind "grace"`, triplet groups from reduced exact fractions,
tie pairs (accidental only on the first note; long rests split side-by-side with no tie), grace
glued to its host; tuplet groups / tie pairs / grace+host are unsplittable packing atoms; the
measure editor hides graces and re-attaches them on save. Drawing: triplets beam together with a
hand-drawn curved arc + italic "3" on the notehead side (~70% of pieces by name hash — the printed
Turkish shape, owner-verified) or VexFlow's bracket, `StaveTie` arcs, `GraceNoteGroup` slashed
noteheads. `strips_v2_2` rendered, audit PASS; non-regression: all 8,575 feature-free measures
serialize byte-identical to v2_1. Rung 2.2 retrain and its ONNX export both passed the same day.

## 2026-07-07 — Rung 2 passes; the no-server premise holds on a real model

- **Colab kit:** `docs/COLAB.md` + `notebooks/rung2_colab.ipynb` + `scripts/make_colab_zip.sh` (one
  self-contained 320 MB upload). Plan decision: **Colab Pro, not Pro+** — a full run ≈ 5–10 compute
  units, Pro's 100 covers the campaign.
- **Rung 2 PASSED first try** on `strips_v2_1` (batch 16, lr 3e-5, 6000 steps ≈ 110 min; best val
  loss 0.0045 at step 4000, flat after — no overfit). Nav marks ≥96% each, repeat signs 100%.
  Weakest token `\sig`/`\sigend` at 95.5% recall — largely the known **empty-signature ambiguity**
  (an every-mode row-start crop of a signature-less piece is pixel-identical to a keysig-mode one,
  but only the latter's label has `\sig \sigend`); benign downstream. **The CRNN+CTC fallback is
  retired for accuracy reasons too.**
- **Rung-2 ONNX export passed the same day**, with `src/vision/quantize_onnx.py` now committed.
  Gate strips come from held-out val pieces and carry real Turkish accidentals + repeat/nav tokens.

## 2026-07-06 — Training kit, navigation marks, `strips_v2_1`

- **Training kit:** `augment.py` (two profiles mixed at `PHOTO_SHARE = 0.35` — 65% screenshot,
  35% full camera-photo pipeline; the preview grid is the human gate), `modeling.py` (shared
  model/tokenizer wiring so train and eval can't drift), `train.py` (full fine-tune, AMP,
  warmup+cosine, split-by-piece loaders, per-worker RNG reseeding, checkpoint/resume for Colab),
  `eval_omr.py` (headline per-class AEU accuracy + SER + exact-match via id-space Levenshtein
  alignment). Verified on the Mac: train → resume → eval all run, val loss falling monotonically.
- **Navigation marks:** segno 𝄋 / coda ⊕ / "D.C." / "Son" as 4 faithful tokens — zero in SymbTr
  (like repeats) but routine on real sheets and required for the Phase-4 da-capo expansion. Seeded
  injection (4–6 marks on ~70% of renders, density set by simulating the audit floors *before*
  rendering, never stacked on repeat/volta measures), SheetView drawing, labels at the drawn measure
  edge, decoder round-trip, audit floors.
- **`strips_v2_1` re-rendered** (18,627 strips / 470 MB, all 150 pieces, zero render errors; nav
  floors cleared at train 220–392 / val 25–45 per token, 6.4% nav strips) with the nav tokens and
  the **centered-rest fix** (`alignRests` off —
  rests had been floating near the top line, unlike printed sheets). v2 stays on disk; v2_1
  supersedes it for training.
- **`docs/PIPELINE.md` written**: the full page-photo → strips → decode → stitch → note-model design.

## 2026-07-05 — Rung-2 dataset upgrades (`strips_v2`)

18,624 strips / 466 MB from 150 pieces (47 makams), selected from 2,030 usable corpus files by
`scripts/select_pieces.py` (greedy
max-min over the AEU classes with exact projected counts — the TS spelling math ported to Python).
Everything seeded and reproducible: any strip's manifest row reconstructs its harness URL. Delivered:
token cap 46 → 56 (over-budget single measures dropped as untrainable), 39.9% multi-measure /
40.7% `|` coverage, random repeat injection, transposes (−9…+9 commas), lyric and lyric-free
variants, in-SVG header/footer text noise, low-rate büyük enharmonic respell, split-by-piece
(125 train / 20 val, committed `data/split.json`), and the pass/fail gate `audit_coverage.py`
(per-class floors + a real-tokenizer ≤59-id check). The renderer is URL-param-driven, chunked and
resumable. OpenCV augmentation deliberately NOT baked in.

## 2026-07-02/03 — The de-risk ladder (Rungs 0–1.5)

- **Step-1 model gate:** `Flova/omr_transformer` reads its own sample staves, outputs a LilyPond
  token stream, and its vocab is extendable (`add_tokens` + `resize_token_embeddings` proven).
- **Label serializer + strip renderer** (`tools/render/`): `docToStrips` packs short strips; a
  Playwright script crops PNG+label pairs out of the harness's own live render.
- **Faithful + signature label scheme** implemented and round-trip verified on all sample scores.
- **Rung-1 overfit-10: GO** — 10/10 strips reproduced exactly on the Mac (MPS). The gate caught two
  decode-side wiring bugs (no-EOS labels; generation stopping on "." instead of `</s>`), both fixed
  and carried forward.
- **Repeat signs:** 4 faithful drawn-symbol tokens (the base vocab's structural `\repeat`/`volta` are
  unusable), placement by **duplicate-run detection** verified against a printed score. Also found:
  246/256 rendered strips were single-measure → Rung 2 had to guarantee multi-measure strips.
- **Rung-1.5 ONNX/browser gate: PASS** — the no-server premise proven end to end: `optimum-cli`
  export → int8 dynamic quantization → decoded in a real browser via `onnxruntime-web` with a
  hand-rolled JS greedy loop and a JS port of the Donut preprocessing; 3/3 gate strips reproduced
  their exact label ids. Python parity checked first.

## Phases 0 and 1 (2026-06-20 … 2026-06-28)

Symbolic → microtonal audio with no ML, then the shared TypeScript core + React web harness
(piano-roll, VexFlow sheet with AEU accidentals, transport, editing, usul-aware metronome,
transpose/ahenk, lyrics and header). Full detail: [HISTORY.md](HISTORY.md).
