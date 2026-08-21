# The levers Round 3 has not pulled — ranked, with what to measure first

purpose: the menu of remaining model-quality levers, why they are ordered this way, and the cheap
measurement that decides each one
audience: agents and the owner working the model track, starting a session on Round 3

updated: 2026-08-20

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md) and
> [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md). Decisions:
> [../DECISIONS.md](../DECISIONS.md). Round 3's binding floors are
> [round3-criteria.md](round3-criteria.md) and **nothing here changes them**.

## Why this file exists

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

## Lever 1 — crop geometry: ⛔ CLOSED 2026-08-17, and it is not to be re-proposed

The encoder's frame is fixed at 409×583, so a long strip is squashed to fit. Padding exam crops with
their own empty staff proved **causally** that squashing costs edits (+59%, replicated on a holdout).
The pilot then showed **we cannot buy the reverse**: that probe's own baseline was already the exam's
19.2 px, and beating it needs crops narrower than one measure — the half-measure target measured at
**+31.8% worse**. The pre-registered short-crop stop rule fired at **5.4×** the control.

**The full case, the numbers, the pre-registration as signed, and the two claims in it that turned out
to be wrong** → **[../METRICS-GEOMETRY.md](../METRICS-GEOMETRY.md)**.

⛔ **The one thing that survived — one measure per strip — is DROPPED too (owner, 2026-08-19).** The
slicer **already** splits over-wide real crops at gutters (`_split_wide`, ~25% of crops), and what
drops a strip is the **59-id label budget**, not width: 8.9% of *single*-measure windows blow it
alone, which no measure rail can fix. That left a *training* match on the 32% of synthetic strips
spanning 2+ measures, on the axis of three consecutive nulls. [../DECISIONS.md](../DECISIONS.md).
⚠ **The short-crop hole is now the blocking item on this axis**, promoted from side condition.

## Lever 1b — musical form: ⛔ DEAD 2026-08-17, and the premise itself is withdrawn

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

## Lever 2 — decoding: we have never used anything but greedy

Every decode in this project is greedy — `eval_omr.py`, `onnx_greedy_decode`, the browser and the
server all take the argmax at each step. Three standard upgrades sit on top of the model we already
have, need **no training and no labels**, and are measurable today on `_realval_v2`:

1. **Beam search.** The current comparison work in the field runs beam widths around 3–5 and reports
   the gain as material. Cost is linear in the beam.
2. **Grammar-constrained decoding** — mask tokens that cannot legally come next. Our label language
   is small and rigid: `\sig … \sigend`, `\tup3 … \tupend`, `\grace` precedes a note, two accidentals
   never adjoin, a pitch is followed by a duration. Illegal sequences the model already emits (a
   doubled `\volta2`, an unterminated block) become impossible rather than merely unlikely.
3. **A bar-duration checksum over the beam.** The editor already computes whether a bar's contents
   fill the derived meter (`data-bar-fill="over|under"`, [../CODE_TOUR.md](../CODE_TOUR.md)). Using
   it to re-rank candidate decodes aims straight at duration errors, the second-largest slice of the
   edit budget — and unlike everything else on this list, it is a *musical* constraint rather than a
   pixel one.

⚠ This lever moves the shipped runtime, not the corpus, so it is scored against the same real-val
pool and carries the same rule as any other change: pre-register what counts as a win before
running it. ⚠ It also changes the browser/server decode path, so `gate:browser` and
`parity:server` are part of its cost.

## Lever 3 — real data: clean it before growing it

> ⏭ **RE-AIMED 2026-08-19 (owner): clean the SCANNED pages, not the born-digital ones.** The cleaning
> argument below is unchanged and is now the live work; what moved is *which tier* it runs in. Two
> measurements decided it ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)): **93% of exam pages are
> scans** (62 of 67), so `batch2` was cut from the tier supplying 7% of the graded medium; and its
> own verdicts read a **~12% fix rate** against **30%** in the scanned nota pool. A batch row is
> seeded with the decode, so an `ok` changes the training data by nothing — the yield of a batch is
> its *fix* rate. The plan is a `batch3` on the scanned tier, **not** unparking `batch1` (it is the
> most-damaged pages corpus-wide, so it concentrates the deferred handwriting, and 10 of its 52 pages
> are born-digital anyway). [../DECISIONS.md](../DECISIONS.md) ·
> [labeling-queues.md](labeling-queues.md).

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

## Lever 4 — renderer diversity: one engine, one font, one spacing

> ✅ **BUILT AND PILOTED 2026-08-18 — the second engraver works, the gate passes 312/312, and the
> domain gap did NOT move.** LilyPond 2.26 renders our own labels (`tools/render/render-ly.ts`),
> its `makam.ly` draws all eight AEU accidentals under the same comma→glyph convention we use, and
> a full corpus would cost ~76 min. Every number, and the two limits the null result carries — the
> measurement is blind to most of what an engraver changes, and the staff geometry was **pinned on
> purpose** — are in [../METRICS-ENGRAVER.md](../METRICS-ENGRAVER.md).
> ⏭ **The decision this leaves open is whether a mixed corpus earns a trained arm.** Nothing below
> this line is evidence for it; the pilot bought feasibility and a gate, not an accuracy claim.
> ⚠ **The "one spacing" third of the premise is still untouched**: varying document scale per strip
> is engraver-neutral and one line in either renderer, and it is the part that actually addresses the
> SD-zero number. It is a separate change and it is not made.
> ⚠ **Four things are owed before this arm could stand beside `strips_v4`** rather than beside a
> control: slur distractors, repeat/volta/nav marks, lyrics and text, and the `every`-mode transposed
> share. Listed with the reasons in [../METRICS-ENGRAVER.md](../METRICS-ENGRAVER.md).

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
> one continuous arc with a floating digit exists in the real pools"* ([tuplets.md](tuplets.md)) — a
> sample of 16 across ~11 editions is small enough for one to exist. **Measure it with
> `tuplet_mark_probe.py`; render nothing yet** (a third mark style inside the geometry render is a
> second variable). If it confirms, it enters as a **per-piece coin** like bracket-vs-curved, which
> makes it a diversity item rather than a correction. ⚠ Expect little from it on recall: the shape A/B
> was **null** (p = 0.688) and the surviving lead points away from the renderer.

Every one of the 40,826 strips is VexFlow + Bravura at a staff spacing whose raw standard deviation
is **zero** ([round3.md](round3.md) §1). Current synthetic-data work in this field does the opposite
— randomising font family, document scale, margins, line width and system spacing, or compositing
real glyphs and paper — and reports the diversity itself as the thing that closes the synthetic→real
gap. We have varied the *degradation* of one engraving heavily (`augment.py`) and the engraving
itself not at all. ⚠ **"Heavily" needs one qualification, added 2026-08-19**: the degradation we vary
is aimed at the *deployment* distribution (screenshots and camera photos), and there is **no scan
profile at all** — see Lever 7.

The cheapest second domain is one we half-own: `tools/render/lilypond.ts` already emits the label
language, so rendering the same pieces through real LilyPond would give a genuinely different
engraver at no labelling cost. ⚠ The hard rule that pixels and labels come from one code path
([../../CLAUDE.md](../../CLAUDE.md)) is the thing to design around here, and `verify-labels.ts` is
the gate any second renderer has to pass before a corpus built with it is trainable.

## Lever 5 — the training recipe: cheap, standard, none of it done

- **`best` is selected on teacher-forced val loss, and the weighting is now measured: 94.6%
  SYNTHETIC / 5.4% real** — 4,769 val strips against 271, blended by strip count every 500 steps
  ([../../src/vision/train.py](../../src/vision/train.py), numbers in
  [../METRICS-CORPUS.md](../METRICS-CORPUS.md)). Round 2 selected its final step and
  `best == last` while real-val loss had already turned — the selector cannot see the metric we
  care about. Selecting on a **free-running** real-val number (edits/page) is the fix.
- **No label smoothing, no weight EMA, one seed.** All three are standard for a seq2seq of this size
  and each is a one-line change.
- **Stage 2 overfits within ~1,000 steps** on 2,337 real strips, in both Round 1 and Round 2. The
  answer is not a shorter stage 2 chosen by hand (that is tuning on a pool with a measured gap to
  the exam) but EMA plus early stopping on the free-running metric, and a lower encoder LR.

## Lever 6 — the articulation hole: every dot we have ever drawn meant "longer"

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
**[staccato-arm.md](staccato-arm.md)**, the way arm 1's live in
[scan-profile.md](scan-profile.md). Numbers: [../METRICS-UNSEEN.md](../METRICS-UNSEEN.md).

## Lever 7 — the medium hole: we have never simulated a SCAN

> ⛔ **BUILT, TRAINED AND NULL — 2026-08-19.** Round 3's arm 1 ran and moved nothing on the medium
> it was built for: **+0.071 edits/strip on scanned pages (`best`), +0.010 (`last`)**, both intervals
> spanning zero, over 197 paired strips. The no-regression clause on born-digital pages **passes**,
> with a point estimate that favours the arm and also spans zero. ⚠ The interval excludes anything
> better than a **~5% reduction**, so this is an informative null, not an underpowered one. The
> profile, the ops, the signed pre-registration and the disposition are in
> **[scan-profile.md](scan-profile.md)**; the numbers in
> [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

`src/vision/augment.py` had exactly two profiles — `screenshot` (0.65) and `photo` (0.35,
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
the app's users upload (n=2 — [../METRICS-USAGE.md](../METRICS-USAGE.md)). The profile is added
**beside** the two, never substituted, and the no-regression clause on born-digital pages is that
trade made checkable.

⚠ **The signed instrument is the MEDIUM split, not the difficulty tier this file first drafted** —
the hard tier's gold is 110 rows seeded with a model decode and then confirmed, which flatters that
model's descendants, and it scores *better* than mid as a result. The reasoning and the numbers are
in [scan-profile.md](scan-profile.md) and [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

## The ordering, and the content work

The content work in `select_pieces.py` — the eighth/quarter-note mix and bar-line density — remains
Round 3's stated content change (owner, 2026-07-27). Two things about how it interacts with Lever 1,
because they decide what to render first:

1. **It moves strip width as a side effect.** Denser note values and different bar-line spacing
   change how wide a measure is, and therefore how hard the encoder squashes it. Rendering the
   content change and the geometry change together would leave Round 3 unattributable for the third
   round running (Round 2 changed three things; the tuplet A/B was built specifically to avoid
   repeating that).
2. **Its direction may already be wrong on width.** Our strips are *wider* than the real pools'
   ([round3.md](round3.md) §4), and denser music widens a measure further. So the content selection
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

### ✅ The order as it ran — the arms are DONE (2026-08-20)

| # | Arm | Costs a render? | Scored on |
|---|---|---|---|
| 1 | **Lever 7** — the scan profile | no | ⛔ **RAN, NULL** — edits on `_realval_v2_scan`, paired ([scan-profile.md](scan-profile.md)). `scan_share` stays **off** in the final model (owner, 2026-08-19) |
| 2 | ~~**Lever 1's survivor** — one measure per strip~~ | — | ⛔ **DROPPED 2026-08-19** — see below |
| 3 | **Lever 6** — the staccato arm | yes | ✅ **RAN, PASSES** — the paired false-dot pool, **72.7% → 0.0%** ([staccato-arm.md](staccato-arm.md)). ⏭ Whether the flag rides the final render is **open, the owner's** |
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
That is the sentence to weigh a future arm against ([staccato-arm.md](staccato-arm.md)). What should not happen is a fourth realism arm being
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
([../METRICS-ENGRAVER.md](../METRICS-ENGRAVER.md)).

## ⚠ A power note on the primary criterion — the owner's call, not an agent's

[round3-criteria.md](round3-criteria.md) is signed and **is not re-opened here**. But the number it
is stated in deserves saying out loud before the read rather than after: the primary floor is a
per-page rate measured on **46 pages**, so its 95% interval is roughly **±12 points**. A model truly
at 72% can read 78%, and one truly at 78% can read 72%.

There are exactly two honest responses, and both have to be chosen **before** the exam is read:

1. Grow the exam (v3 is already owed — [exam.md](exam.md)) so the gate can resolve what it is
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
side condition (re-score the Round-2 baseline on the grown exam): [exam.md](exam.md). Census, drop
table and sizing arithmetic: [../METRICS-EXAMSET.md](../METRICS-EXAMSET.md). Decision row:
[../DECISIONS.md](../DECISIONS.md).
⭐ **A second finding came with it and it is not about size at all**: the exam grades **326 of 608**
candidate strips on its own pages — 282 are dropped, and they are the **wide and dense** ones. So the
exam reads each page on its easier material, which is a further reason the ceiling measurement in
[../BACKLOG.md](../BACKLOG.md) pays here and not only on training data.

## Where the outside evidence comes from

Named here so the next session does not re-derive it. Nothing below is a measurement of ours.

- Beam search + grammar-constrained decoding as the standard inference setup for end-to-end OMR
  (Transcoda, 2026) — <https://arxiv.org/abs/2605.10835>.
- Synthetic-to-real for real scans: renderer diversity, replay while adapting, and a **small**
  authentic fine-tune carrying most of the gain — <https://arxiv.org/html/2606.09479v1>.
- Source-free domain adaptation for OMR (adapting on unlabelled target pages) —
  <https://link.springer.com/chapter/10.1007/978-3-031-70552-6_1>.
- Full-page end-to-end OMR with curriculum pretraining (SMT / SMT++) —
  <https://arxiv.org/abs/2402.07596>.
