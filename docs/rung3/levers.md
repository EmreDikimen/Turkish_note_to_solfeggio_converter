# The levers Round 3 has not pulled — ranked, with what to measure first

purpose: the menu of remaining model-quality levers, why they are ordered this way, and the cheap
measurement that decides each one
audience: agents and the owner working the model track, starting a session on Round 3

updated: 2026-08-18

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

✅ **The one thing that survives**, separable and cheap: render the corpus at **one measure per strip**
so training stops reading at 16.0 px while the exam reads at 19.2. +12.9% strips, slicer untouched, so
no decode cost and none of the short-crop risk. Needs a trained arm to claim anything.
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

- **`best` is selected on teacher-forced val loss**, strip-weighted toward synthetic
  ([../../src/vision/train.py](../../src/vision/train.py)). Round 2 selected its final step and
  `best == last` while real-val loss had already turned — the selector cannot see the metric we
  care about. Selecting on a **free-running** real-val number (edits/page) is the fix.
- **No label smoothing, no weight EMA, one seed.** All three are standard for a seq2seq of this size
  and each is a one-line change.
- **Stage 2 overfits within ~1,000 steps** on 2,337 real strips, in both Round 1 and Round 2. The
  answer is not a shorter stage 2 chosen by hand (that is tuning on a pool with a measured gap to
  the exam) but EMA plus early stopping on the free-running metric, and a lower encoder LR.

## Lever 6 — the articulation hole: every dot we have ever drawn meant "longer"

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
3. **Reported, not gated:** pitch/AEU macro F1, so the price of clause 1 is on the record.

⚠ The slur distractor's cost is the thing to watch: it took `\tup3` precision 15.1% → 91.2% and
**recall 92.7% → 83.8%, below its own floor**. Clause 2 exists so that outcome is caught rather than
discovered. ⚠ `STACCATO_RATE` is **chosen, not measured** — nobody has counted staccato frequency in
real Turkish editions, and doing so is how to replace it. ⚠ The alternative not taken is a
`\staccato` token: possible, but `ADDED_TOKENS` is **append-only** so it goes at the END, and it
needs gold annotation and an engraver change.

## Lever 7 — the medium hole: we have never simulated a SCAN

**New 2026-08-19, and it is the next trained arm** ([../DECISIONS.md](../DECISIONS.md)).
[`src/vision/augment.py`](../../src/vision/augment.py) has exactly two profiles:

| profile | share | what it models |
|---|---|---|
| `screenshot` | 0.65 | resample softness, JPEG, mild brightness/contrast, light sensor noise |
| `photo` | 0.35 (`PHOTO_SHARE`) | paper tint/texture, uneven lighting, shadows, rotation/perspective, ink bleed, camera blur |

**There is no scan profile, and 93% of the exam is scans** (62 of 67 pages —
[../METRICS-CORPUS.md](../METRICS-CORPUS.md)). A flatbed or office scan of a TRT-era print is
neither of the two: it has **flat lighting and no perspective** (so the photo pipeline's most
expensive ops model nothing that is there) while it *does* have speckle and dust, broken or
half-missing thin lines, ink spread on thick strokes, bleed-through from the reverse side, small
skew, and threshold/halftone damage — none of which either profile draws.

⚠ **`augment.py`'s own comment has been asking for this since July**: *"Revisit against real usage at
Rung 3."* We are in Round 3 and it was never revisited.

**Why it goes first among the trained arms.** No re-render, no new labels, no render slot, one
module. Every other item on this list costs a corpus render or human labelling.

⚠ **The trade, stated before the arm runs.** `PHOTO_SHARE` was set from the owner's report that real
uploads are mostly web screenshots, and the constant carries an explicit warning against pushing the
mix for "harder training" — over-warped data trades the common case for the rare one. Aiming
augmentation at scans optimises **the exam**, and we do not know that the exam's medium is what the
app's users upload (n=2 — [../METRICS-USAGE.md](../METRICS-USAGE.md)). So the scan profile is added
**beside** the two, not substituted for them, and the mix is pre-registered rather than tuned.

**Pre-registration — to be signed before the arm is trained:**

1. **Primary: edits/page on `_realval_v2`, hard tier**, which is where the scanned pages are. A win
   is a fall against the same model trained with today's two-profile mix — same seed, same corpus,
   same steps, the profile mix the only difference.
2. **No-regression on easy tier**, which is the closest thing we have to the screenshot case. This
   clause is the trade above made checkable: if scan realism costs the clean case, that shows here.
3. **Reported, not gated:** the three-way mix actually used, and per-class accidental F1.

⚠ **What must be decided before running, not after:** the share the scan profile takes. It is a
`STACCATO_RATE`-shaped hazard — a chosen number with no measurement behind it. The honest version is
to set it from the **corpus** composition we intend to serve, not from what makes the arm win.
⚠ It changes training only, so nothing in the browser or the server moves and no gate is at risk.

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

### ⏭ The order as it now stands (owner, 2026-08-19) — four trained arms, one variable each

| # | Arm | Costs a render? | Scored on |
|---|---|---|---|
| 1 | **Lever 7** — the scan profile | no | edits/page on `_realval_v2` **hard tier** |
| 2 | **Lever 1's survivor** — one measure per strip | yes (+12.9% strips) | edits/page on `_realval_v2` |
| 3 | **Lever 6** — the staccato arm | yes | the **paired false-dot pool**, against 72.7% |
| 4 | the final Round-3 model | — | **the exam, read once** |

**No two together.** Round 3 has been unattributable twice already, and the tuplet A/B was built
specifically to stop it happening a third time.

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
