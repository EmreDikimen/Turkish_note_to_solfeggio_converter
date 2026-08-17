# The levers Round 3 has not pulled — ranked, with what to measure first

purpose: the menu of remaining model-quality levers, why they are ordered this way, and the cheap
measurement that decides each one
audience: agents and the owner working the model track, starting a session on Round 3

updated: 2026-08-17

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

## Lever 1 — crop geometry: the model sees a fifth of the page it is given

> ✅ **THE PROBE RAN 2026-08-15 AND THE PRE-REGISTERED READING IS THE CAUSAL BRANCH.** Padding the
> exam crops with their own empty staff raises edits/token **monotonically across all four doses**,
> the bootstrap CI excludes zero from ×1.50 on, and the real-val holdout replicates **steeper**. The
> unpadded arms reproduced both recorded baselines exactly. **Numbers and caveats:**
> [../METRICS-GEOMETRY.md](../METRICS-GEOMETRY.md), "The padding probe".
>
> ⛔ **AND STEP 2 THEN STOPPED THE LEVER (2026-08-17).** The caveat this box already carried — *the
> probe lowers resolution and does not prove raising it helps* — turned out to be the whole story:
> the probe's own ×1.00 baseline **was** the exam's 19.2 px, so there is nothing above it to reach
> without cutting inside measures. The measure rail is a no-op on the synthetic side at anything but
> 1, and on the real side the 1-measure arm trips the pre-registered short-crop stop rule at **5.4×**
> the control. **Result and what survives: the STEP 2 RESULT block below.** Both statements stand —
> squashing crops costs edits, and we cannot buy the reverse.

**The finding.** The encoder frame is a fixed **409×583**; a strip is rotated and fitted into it, so
the net scale is `min(583/W, 409/H)`. We cut strips at 3 measures / up to 1450 px, which means the
median strip arrives downscaled by half, with **61% of the frame spent on black padding**. A strip
narrower than **479 px** — roughly one measure — is the only shape this encoder does not throw
resolution away on. Measured, and re-measured with the two obvious confounds pinned:
[../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md), "The encoder's input box".

**Why it is ranked first.** It predicts three findings this project already owns and never
connected: crops >1200 px carrying a fifth of exam edits, synthetic beams reaching the encoder at
6.5 px, and the one-or-two-position pitch errors that §1 of [round3.md](round3.md) chased into a
dead end. It needs **no new labels and no architecture change** — only the strip-cutting rails.

⚠ **CORRECTED 2026-08-17: the renderer and the slicer do NOT share those constants**, and this file
said they did. They are parallel implementations cutting on different quantities, so the lever is two
edits rather than one:

| | slicer (real pages) | renderer (synthetic strips) |
|---|---|---|
| where | `src/vision/page_to_strips.py` → `apps/web/src/omr/slicer/windows.ts` | `STRIP_BUDGET` in `tools/render/lilypond.ts` → `apps/web/src/stripExport.ts` |
| measure rail | `MEASURES_PER_STRIP = 3` | `maxMeasures = 4` |
| second rail | `MAX_STRIP_W = 1450` **px** | `maxTokens = 56` **label tokens** |
| knob | `OMR_MEASURES_PER_STRIP`, `OMR_MAX_STRIP_W` | `--max-measures` on `render.ts` |

Two consequences that change what the pilot has to do. **The renderer has no pixel-width rail at
all** — a wide row is emitted at whatever width the engraving produced, which is *why* our strips run
wider than the real pools' (§4 of [round3.md](round3.md)) rather than an accident on top of it. And
the two sides already disagree by one measure, 4 against 3, which nothing had flagged.

**A second argument, free with it.** An accidental carries to the end of its measure, so a
one-measure crop is the natural unit of the carry convention. The carry-sig hallucination
characterized on 2026-07-24 — accidentals invented on bare noteheads in mid-row crops that discarded
their signature — is a bug about crops that straddle the context they need.

**What was run, and the plan as written** → [../METRICS-GEOMETRY.md](../METRICS-GEOMETRY.md). Steps 1
(the padding probe) and 2 (the three-arm pilot) executed; step 3 — full render plus a matching
re-slice — is dead with the lever. The verdict is below.

### ⛔ STEP 2 RESULT (2026-08-17) — the stop rule FIRED on the only arm that does anything

Numbers, both sides, in [../METRICS-GEOMETRY.md](../METRICS-GEOMETRY.md). Read against the
pre-registration below, which was signed before the arms ran and is **not** re-opened now.

1. **The measure rail is not the lever on the synthetic side** — the 56-**token** budget binds first,
   so the renderer was already emitting one measure per strip 87% of the time.
2. **It cannot raise resolution at all**, only close a *training* gap. The padding probe's ×1.00
   baseline **was** the exam's own spacing, and exceeding it needs crops narrower than one measure —
   the half-measure target already measured at **+31.8% worse**.
3. **Both costs this file carried were wrong**, and much lower than feared.
4. ⛔ **The stop rule fires**: short crops on the re-sliced real side reach **5.4×** the control
   against a **2×** threshold. Arm 1 is stopped; arm 2 survives and does nothing. A rough independent
   estimate agrees — the resolution gain and the short-crop cost are the same size, sign probably
   negative.

**So the lever as written is spent, and it is written up as spent rather than re-aimed.** Two things
survive it and neither is a version of "narrow the crops":

- **A real, cheap, separable change**: render the corpus at **one measure per strip** to remove the
  16.0-vs-19.2 px *training* gap, for +12.9% strips and no change to the slicer, therefore **no
  decode cost and no short-crop risk at all** — the stop rule is about the *real* side, which this
  does not touch. ⚠ Untested as an accuracy claim; it needs a trained arm like anything else.
- **The short-crop hole is now the blocking item on this axis, not a side condition.** It was dropped
  in July on a disproved *mechanism* (§3 of [round3.md](round3.md)) while its **cost** was confirmed,
  and it is what stops the only geometry arm that works. Any return to crop geometry goes through it
  first.

⚠ **One arm design error is recorded with the result**, because it produced numbers that looked
decisive and were not: pairing each arm with a lowered `MAX_STRIP_W` (800, 500 px) forced `_split_wide`
to cut **inside** measures — `split_wide` 25% → 76% → 94.7% — so the first run measured the
half-measure target by accident and "failed" the lever for the wrong reason. The cap must stay at 1450
and `split_wide` is the tell, not the widths.

### The pre-registration itself → [../METRICS-GEOMETRY.md](../METRICS-GEOMETRY.md)

The step-2 design and the stop rule **as signed**, kept verbatim so the result above can be checked
against what was promised rather than against a memory of it. Moved there 2026-08-17 at this file's
400-line cap: the lever is closed, so its pre-registration is history and belongs with its numbers.

## Lever 1b — FORM COVERAGE: the corpus is half şarkı, and the ornate vocal forms cost ~3×

**NEW 2026-08-17, owner-reported then measured.** Using the product, the owner found many mistakes
"especially in classical parts", **including on clean computer-generated PDFs**. Bucketing the spent
Round-2 exam dump by form: **non-şarkı 1.73× şarkı's edits/token, and beste/nakış ~2.9×**. Training is
**52.9% şarkı**, with beste at 3.8%, nakış 1.4% and kâr at **0%**. Numbers and every caveat:
[../METRICS-EXAM.md](../METRICS-EXAM.md).

**Why this is ranked here rather than lower.** It is the only lever on this page that came from a
person using the app, and this project's record on that is unusually good — the staccato hole, the
kanun's koma, the tuplet mark's shape and the pale staff lines were all owner observations that
survived measurement. It also needs **no new labels**: the piece list already has a `form` field.

**What it does NOT say.** "Classical is hard" is refuted by its own table: peşrev (0.039) and
yürüksemai (0.044) are the *cheapest* rows. What is expensive is the **dense ornate vocal** forms plus
marş. So the mechanism is not the genre label; the candidates are what those forms actually contain —
denser note values, longer usul cycles (therefore wider bars), and heavier ornamentation.

⚠ **This partly rescues the content work** (the section at the bottom of this file), which is exactly
"more eighth notes, denser bars" — but it gives it a **target** it never had. The 2026-07-27 version
was a histogram exercise with no failing population to aim at; this names one.

**What to measure first, cheaply and with no training:**

1. **Confirm the mechanism before selecting on it.** Compare beste/nakış against şarkı on the things we
   can already count from labels: notes per bar, share of 16th/32nd values, grace notes per 100 notes,
   `\tup3` per 100 notes, bar width in px. `domain_gap.py` computes every one of those — run it with
   the pools split by form instead of by source. If the ornate forms differ on *density*, the content
   work is the lever; if they differ only on *ornament count*, it is a different fix.
2. **Then grow the exam on those forms.** ⚠ The exam is **68.9% şarkı** — *more* song-weighted than the
   training data — so it is nearly blind to this. Growing it on beste/nakış is the only way the signed
   floor can ever register the defect, and it must happen **before** the next exam read.
3. Only then re-select pieces. ⚠ A new list needs its own filename **and its own split**
   (`scripts/make_split.py`), and it changes which real strips are val-side.

⚠ **The low-n caveat is load-bearing**: ağırsemai is 2 strips, kâr 5, peşrev 6. Only şarkı (194) and
yürüksemai (43) carry weight. The owner's report is what makes this worth acting on; the table is
consistent with it, not proof of it.

⛔ **AND THIS CANNOT BE FIXED BY LABELLING HARDER — the music is not on disk.** Measured 2026-08-17
over the nota pool's 1,740 strips: **86.0% şarkı**, and the expensive forms total **118 strips** —
beste 52, nakış 34, ağırsemai 22, kâr 10. Labelling every one of them perfectly would still not teach
these forms. **So collection is a PREREQUISITE here, not an alternative** — which is what promotes the
owner's 2026-08-17 broad-collection decision from "worth doing" to "the thing in front".

**Sizing, so the ask is concrete rather than "more data".** At ~19 crops per page from the slicer,
**~25–30 pages of beste/nakış/kâr yields ~500 strips**, taking those forms from ~5% of the real
fine-tune set to ~20%. That is a fivefold coverage change for a few dozen pages — a much smaller ask
than the "few thousand strips" the owner offered, and aimed where the errors are.

⚠ **Growing the exam on the same forms is the other half and it is not optional**, because a training
change nothing can measure is worth nothing. The exam is 68.9% şarkı; the signed floor would barely
register a beste/nakış improvement. Exam growth must happen **before** the next read
([exam.md](exam.md), and the power note at the bottom of this file).

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
- **Then nota over neyzen.** The scanned TRT-era prints run ~5× the SER of the clean vector PDFs
  ([../METRICS.md](../METRICS.md)) and dominate the hard tier. That is where a labelled row buys the
  most.
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
itself not at all.

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
3. **Reported, not gated:** pitch/AEU macro F1, so the price of clause 1 is on the record.

⚠ The slur distractor's cost is the thing to watch: it took `\tup3` precision 15.1% → 91.2% and
**recall 92.7% → 83.8%, below its own floor**. Clause 2 exists so that outcome is caught rather than
discovered. ⚠ `STACCATO_RATE` is **chosen, not measured** — nobody has counted staccato frequency in
real Turkish editions, and doing so is how to replace it. ⚠ The alternative not taken is a
`\staccato` token: possible, but `ADDED_TOKENS` is **append-only** so it goes at the END, and it
needs gold annotation and an engraver change.

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

**Therefore:** run the Lever-1 probe first — it is half a day, needs no GPU, and its answer decides
whether the next render is a geometry render or a content render. The content work is not cancelled
and nothing about it is superseded; it is sequenced behind a measurement that can change what it
should render.

> ✅ **That probe has now run (2026-08-15) and came back causal**, so the question it was sequencing
> is answered: **the next render is a geometry render**, and the content work stays behind it. What
> is still unanswered is the half the probe cannot reach — it lowered resolution and showed the cost,
> which is not the same as showing that raising it pays. Step 2's 300-strip `domain_gap.py` pilot is
> where that gets tested, and the **short-crop hole** is what it has to watch.

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
