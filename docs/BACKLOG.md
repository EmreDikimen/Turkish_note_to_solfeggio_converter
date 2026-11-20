# Backlog — owed, not next, not cancelled

purpose: work that is real but not next (near-term and deferred), and the standing risks and caveats
audience: agents picking up the project with spare capacity, or looking for what was deferred and why

updated: 2026-11-20

Split out of [STATUS.md](STATUS.md) on 2026-08-17 when that file crossed the 400-line cap. Genre
split: STATUS states **current state and the next action**; this file holds **everything owed that is
neither**. Nothing here was dropped in the move.

⚠ **This is not a queue to work down.** Each item carries the reason it is deferred, and several are
deferred because acting on them would confound a measurement in flight. Read the reason before
starting. Abandoned plans are a different thing again and live in
[log/superseded.md](log/superseded.md) — never act on anything found there.

### ⭐ The open item the model track turns on

0. **THE SHIPPED APP HAS NO LABEL-BUDGET RAIL, SO A DENSE PAGE CAN COME BACK SILENTLY WRONG**
   (re-homed here 2026-10-08 — seven docs pointed at "BACKLOG item 0", which until then lived only
   in [BACKLOG.md](#backlog-further-out--real-justified-and-not-this-round) item 0 and still described the Round-3-era plan).
   At inference an over-long strip cannot be dropped, so the model emits `</s>` early and confidently;
   `hitCap` catches ~0.2%. **5.91%** of real candidate strips exceed the decoder's 99-id ceiling in
   the old vocabulary, against **0.30%** under scheme H ([METRICS-EXAM.md](METRICS-EXAM.md#round-4s-vocabulary-ab--how-it-is-scored-and-what-the-kit-measured-before-any-gpu-ran)).
   Two candidate fixes, **neither measured on pages**: (a) **an app-side rail** — cut a dense crop
   smaller in the browser slicer (`?dense=<ids>` exists as an opt-in experiment; alone, at inference
   on an untrained model, it was a wash — [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md#the-dense-experiment--the-apps-missing-label-rail-measured)); (b) **scheme H**,
   whose strip-level A/B was a null. ✅ The TRAINING half of the rail ran in Round 4 (`strips_h1`,
   the rail's +35 rows). ⏭ **What settles it is a page-level test** — dense pages, read by H and by
   the control-plus-app-rail, corrections counted per page — and whether to run it is the owner's
   open decision (b) in [STATUS.md](STATUS.md). ⚠ Turning the rail on in the shipping slicer moves
   crops on dense pages; `examv3` stays the comparable column either way.

### Cheap, owed, and independent of both

1. **The deskew *estimator* is validated on 132 pages, not the corpus** — every full run injects
   Python's angle. It used to cost ~18 h of browser time; at 1.3 s/page a full un-injected corpus
   run is now well under an hour, so this is worth simply doing.
2. **NEW 2026-08-16 — `_realval_v2` has 5 duplicate manifest rows, 4 with CONTRADICTORY labels.**
   267 rows over 262 distinct images; four PNGs are scored against two unrelated gold strings, so at
   least one of each pair is wrong. Found while checking pad-directory integrity, not by looking for
   it. **Scope is that pool only** — the exam, `_tupletval` and `strips_nota` are clean. It is ~1.9%
   of the pool and it sits inside every recorded `_realval_v2` absolute, including the tuplet A/B's
   guard number. ⚠ It does **not** threaten a paired result (the duplicates are identical in every
   arm and cancel in a delta), which is why the geometry probe's holdout stands. Owed: de-duplicate,
   re-derive, and check whether any other pool built by the same path shares it.
   [METRICS-CORPUS.md](METRICS-CORPUS.md).
   ⭐ **DIAGNOSED 2026-09-09 — the duplicates were the SYMPTOM.** `build_realval_v2.py --build`
   carries rows out of the old `_realval` pool, which is entirely on the retired crop root, and
   copies the `strips_v2` crop under them with no measure-span check: **10 of 262 distinct images
   carry a label about music that is not in their picture**. Evidence, control and volumes:
   [METRICS-SLICER.md](METRICS-SLICER.md#crop-roots--which-slicer-cut-which-pool-and-what-a-re-slice-costs). ✅ **The POOL is repaired (2026-09-16)**:
   `_realval_v2r`, 260 strips, after the owner read the 10-row `realval-repair` queue
   ([DECISIONS.md](DECISIONS.md) records the choice of the full repair).
   ⏭ **STILL OWED — THE BUILDER.** `build_realval_v2.py --build` repeats this the next time it
   runs: it must refuse a carried row whose measure span does not match on the root it is about to
   copy from. ⛔ Do not run a `--build` until it does.
   ⏭ **Also unchecked:** whether `_tupletval` came through the same carry-and-copy path. "Clean of
   duplicates" (2026-08-16, above) is a different question from "labels and pixels from one root".

3. **NEW 2026-08-20 — `best` is chosen 94.6% on SYNTHETIC val loss. Re-weight the selector, or
   select on a real metric.** Raised by the owner asking what the every-500-steps evaluation actually
   reads. `train.py` blends the two val losses by strip count, so at the default `--real-val-frac
   0.10` the synthetic val pool (4,769 strips) outvotes the real one (271) nineteen to one — in a
   round whose acceptance bar is a **real-page** number ([METRICS-CORPUS.md](METRICS-CORPUS.md)).
   [archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) Lever 5 named this without a number; the number is what makes
   it actionable. Three fixes, cheapest first: weight the blend deliberately instead of by strip
   count; raise `--real-val-frac` so the real pool is not 271 strips; or select on a **free-running**
   real metric (edits/strip) rather than teacher-forced loss, which is Lever 5's own preferred answer
   and the only one that measures what the round is graded on.
   ✅ **BUILT AND USED IN ROUND 4 (`train.py --select-dir`, 2026-09-06; ran 2026-09-16/17).** It
   decodes a FIXED pool free-running at every eval and stamps `best-edits`. ⚠ **What it bought is not
   yet visible**: in both arms `best-edits` and `last` are a tie (control 396 against 410 corrections
   on the selection pool, H 280 against 282), and on `_realval_v2r` the picked copy read **15 edits
   better than `last` — which was pick-luck, not quality**: against the live model the bias-free
   `last` fell back to a null ([METRICS-EXAM.md](METRICS-EXAM.md#round-4s-vocabulary-ab--how-it-is-scored-and-what-the-kit-measured-before-any-gpu-ran)). ⏭ Still owed: a run
   where the three tags disagree enough to price the selector itself.
   ⭐ The boundary this item kept hitting is now a hard guard — the selection pool may not share a
   piece with training, and the run REFUSES rather than warns. The three wrong picks that built the
   case (Round 3 final, Run A, Run B) are archived in
   [archive/phases.md](archive/phases.md#backlog--closed-items-archived).

4. ✅ **CLOSED — the b8 re-emit ran on 2026-08-21, and Round 4's `strips_h1` superseded its pool.** Archived verbatim in [archive/phases.md](archive/phases.md#backlog--closed-items-archived).

5. ✅ **CLOSED — the dotted (usul) barline was drawn label-free in Round 3's render; the `\dottedbar` token is declined for Round 4.** Archived verbatim in [archive/phases.md](archive/phases.md#backlog--closed-items-archived).

6. **NEW 2026-08-18 — "REVIEW UI 2": a PAGE-level correction UI. Designed, costed, and STOPPED by the
   owner on the arithmetic, with the queue half already BUILT and working.** The ask was a tool like
   the app — photo and rendered score side by side, tokens visible, all editor mechanics, plus
   editable `\sig` blocks and a selectable/deletable tuplet mark — to correct real pages page by page
   instead of strip by strip.
   ⛔ **Do not restart it without re-reading the cost case**, which is the reason it stopped:
   the win is concentrated **entirely in the ~1/3 of strips that need a fix** (~45 s of typing a token
   string in `review_ui.py` → ~3 s of dragging a notehead). Checking speed barely moves, because you
   read every note either way. Whole-queue estimate **~175 h → ~55 h**: real, but not the order of
   magnitude that would justify the build.
   ⚠ **Two assumptions that would have justified it were measured FALSE**, and this is the part worth
   inheriting: window **overlap is only 1.15×** (43,586 measure-instances over 38,026 distinct
   measures — there is no "each bar is verdicted three times" redundancy to collapse), and the
   editor's off-meter mark flags **37.8%** of interior bars corpus-wide, so it narrows the duration
   hunt ~2.6× rather than lighting up the errors ([METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md)).
   ✅ **What survives and is on disk, documented and re-runnable** — the ranking half, which is
   independently useful if page gold is ever wanted: `tools/dev/page-structure.ts` (per-page stitch
   stats, reusing the shipped stitcher and core so the meter rule is not duplicated) and
   `scripts/rung3/build_page_queue.py` (ranks pages by structural error evidence, refuses exam
   pieces, caps per makam). A 150-page queue is built at
   `data/real/rung3/_pagequeue/page_queue.json`.
   ✅ **Update, same day: the ranking IS consumed now** — `build_label_batch.py` reuses its scorer to
   cut page-complete labelling batches for the *existing* strip UI, and `batch2` is live
   ([rung3/labeling.md](rung3/labeling.md#the-labelling-queues--reslice-all-the-batches-b8-and-examv3)). What stays deferred is only the **page-level
   UI**, i.e. the expensive half the cost case stopped. The ranking earning its keep in a cheaper
   consumer is the reason it was kept rather than deleted.
   ⚠ The strongest remaining argument for ever building it is **not** throughput: nothing this project
   owns produces **page-level gold**, which is the unit Round 3's signed floor is stated in, measured
   on 63 graded pages at about ±12 points ([METRICS-EXAM.md](METRICS-EXAM.md#metrics--the-exam-as-an-instrument)). ~150 corrected
   pages would more than double the exam. If it returns, it returns for that reason.

7. ✅ **CLOSED — the 59-id budget was measured and the owner raised it to 80 under scheme H (2026-09-07).** Archived verbatim in [archive/phases.md](archive/phases.md#backlog--closed-items-archived).

8. **NEW 2026-08-20 — audit 100 crops from the CURRENT slicer before pouring more hours into
   labelling.** The evidence that the slicer's throw-away rate is the bottleneck is scattered across
   four files and has never been put in one place or re-measured on today's code: **33% of crops
   unusable** in the first `realval-hard` queue (43 of 130), **13,975** strips dropped corpus-wide for
   `row_unaligned`/`nd_high`, **2,108** over-budget, and `batch3`'s own cut excluded **24%** of the
   pages it checked as stale. ⚠ Every one of those numbers is from the OLD slicer or from a queue
   build, so none of them says what today's code does. ⏭ Draw 100 random crops from a current
   re-slice, look at them, and report the unusable rate. If it is still ~1 in 3, the slicer outranks
   labelling and this file's item 4 stops being a cleanup and becomes the main line.

9. ✅ **CLOSED — rule D (2026-09-06) sends a vote that deletes or changes an accidental off the makam table's majority spelling to review; applied in the `strips_h1` emit. What is still unverified (the exam's and the older pools' `\sig` blocks) is a standing caveat in [BACKLOG.md](#open-risks-and-non-claims).** Archived verbatim in [archive/phases.md](archive/phases.md#backlog--closed-items-archived).

10. **NEW 2026-08-22 — EVERY PAGE THIS PROJECT OWNS COMES FROM TWO WEBSITES, AND SO DOES THE EXAM.**
   Raised by the owner (*"is there any strip from other note sheet resources like trt, divanmakam,
   şarkı notaları"*) and measured: `data/real/manifest.csv` is **1,055 neyzen.com + 1,000
   notaarsivleri.com and nothing else**; `strips_b8` is nota 2,565 strips / 416 pieces and neyzen
   1,390 / 159; `testset.json` is **28 nota + 17 neyzen pieces over 67 pages**. So every accuracy
   number this project has ever produced carries an unstated limit: *on these two engraving houses*.
   ⏭ **The cheap version is a PROBE, not a corpus** — 20–40 pages from two or three new sites, a
   couple of hundred strips hand-labelled, `round2-stage2-best` scored on them. It changes no exam and
   no floor, and it answers the question that matters before the final render: does the model hold up
   on a third engraver, or fall apart? A collapse would be the most valuable finding available; a
   pass would retire the worry cheaply.
   ⚠ **Deferred, and here is the honest reason**: labelling is the bottleneck (2,486 unlabelled pages
   are already on disk), and ⛔ **the exam must not gain a third source mid-round** — a change to the
   instrument makes a round's read comparable to nothing; a third source is always a SEPARATE column.
   ⏭ **Candidate sources**: the 2026-08-20 list in [DECISIONS.md](DECISIONS.md) — nota.trt.net.tr,
   sahaney.com, erdincbal.com, neyzenim.com, devletkorosu.com, sarkilarnotalar.blogspot.com,
   baglamaci.com — **plus `divanmakam`, which the owner named on 2026-08-22 and that list does not
   carry**. ⚠ Free labels depend on `match_symbtr.py` finding the piece by name, so a site's naming
   convention decides whether its pages cost nothing or cost hand-labelling. ⚠ Read each licence
   first: neyzen and notaarsivleri are recorded **all rights reserved / read locally, never
   redistribute** ([THIRD-PARTY.md](THIRD-PARTY.md)), and TRT is a state broadcaster — its own read.
   ✅ **THE PROBE RAN in Round 4 (2026-09-06) and is a NULL**: 36 pieces / 53 pages / 1,108 strips
   from sahaney, erdincbal and a blogspot; the slicer found staves on all 53 pages and the pipeline
   did not jam, but at n = 34 and n = 10 nothing under ~3× was separable — accuracy is unanswered
   ([rung3/round4.md](rung3/round4.md#third-source-probe--does-the-model-hold-up-on-an-engraving-house-it-has-never-seen)). ⛔ nota.trt.net.tr (login) and divanmakam
   (forum, mixed provenance) are out. ⏭ **The only route to a verdict is more erdincbal pages**,
   which need no hand labelling (75 SymbTr accepts exist, 14 used).

11. **NEW 2026-08-30 — THE SYNTHETIC CORPUS HAS NEVER DRAWN A 𝄋 AT A BAR'S END, AND 433 REAL PAGES
   CARRY ONE.** `navmarks.ts` places every injected segno at a measure's **start** (`at: "start"`),
   because that is where the jump TARGET is printed. The returning sign of a hâne is printed at the
   bar's **right barline**, and the model reads those anyway — **433 of 1,720 decoded pages** carry a
   𝄋 the stitcher now files as an end-edge mark ([METRICS.md](METRICS.md)). So the ink the 𝄋 → 𝄋 rule
   depends on is read out of distribution. ⏭ Cheap: let `injectNavMarks` place a segno at either edge
   (the coda pair already does), which costs one line and one re-emit; the label is unchanged, so
   nothing about the token vocabulary moves. ⚠ **Not for this round's pools** — it changes a share of
   every rendered piece, which is exactly the `--print-noise` failure mode, and Round 3's render is
   already specified. ⏸ **Not in Round 4 either — no render this round (owner, 2026-09-03)**; it
   waits for a round that renders ([rung3/round4.md](rung3/round4.md) "Not this round").

13. **NEW 2026-09-10 — WARM-START A NEW TOKEN'S EMBEDDING INSTEAD OF DRAWING IT AT RANDOM** (owner's
    question: *"eğer bunlar zaten base modelin vocabinde varsa ... hazırda olanları kullanmamız daha
    iyi olmaz mı"*). ⭐ **The premise is half right and the useful half is unimplemented.** Measured
    2026-09-10: the base model's alphabet is **75 tokens** and it does contain `'\repeat '` and
    `'volta '` as whole words — but `\segno`, `\coda`, `\fine`, `\bar` are absent, `{` and `}` are
    absent (so `\repeat volta 2 { … }` cannot be spelled at all), and the digits `3`, `5`, `7` are
    missing. Reusing those ids is therefore impossible *and* pointless: an id is an index, and a
    strip is a fragment whose repeat usually opens on another strip, which is why the drawn-symbol
    tokens exist ([rung3/tokenization.md](rung3/tokenization.md)).
    ⏭ **What IS worth doing is the embedding.** `modeling.py` calls `resize_token_embeddings` and
    nothing else, so on transformers 4.57.6 every new token starts from a multivariate normal
    matching the old embeddings' mean and covariance — statistically plausible, musically empty.
    [rung3/tokenization.md](rung3/tokenization.md) step 3 already prescribes warm-starting and it
    was never built: `\repstart`/`\repend` from the base's own `\repeat `, `\volta1`/`\volta2`
    from `volta `, H's `16`/`32` from the digit rows, H's fused pitches from their parts.
    ⚠ **A PAIRED ARM, not a default** — it changes training, so folding it into the H arm would
    make that A/B two variables. Unmeasured; the gain is a question, not a claim.
    ⚠ The base model's knowledge of what a repeat barline *looks like* lives in the ENCODER and is
    kept by fine-tuning either way; this is only about what the decoder writes.
    ⭐ **NEW EVIDENCE, 2026-09-19 — a random start is measurably slower.** Scheme H's stage 1 began
    from 42 random rows and read **2.5× Round 3's val loss at step 1,000** (.0676 against .0269),
    against the ~1.75× its shorter labels explain; by step 2,000 it had closed to ~1.4×. ⚠ A LEAD:
    the two runs differ in vocabulary as well, so the gap is not cleanly attributable, and the H arm
    ended level on accuracy anyway ([../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md)).

### ⏭ `carry_labels()` should carry a verdict when the crop is BYTE-IDENTICAL (owner, 2026-08-26)

It offers every prior label as a pending **suggestion**, never a verdict, without asking whether the
picture changed. On a re-cut of `examv3`, **25 of 67 pages are byte-identical** and carry **168
verdicts** — the human looked at exactly that picture, so re-asking is waste. The other **287** are on
pages that really changed and must be re-checked; that half of the caution is right. ⏭ Compare crop
bytes and promote to a real verdict only on an exact match. ⚠ Pays off only at the next exam re-cut,
which is **not** happening now ([DECISIONS.md](DECISIONS.md)) — but it is ~495 rows against ~663.

### ⏭ Are bad CUTS a training signal rather than a defect? (owner, 2026-08-26 — NOT ANSWERED)

The owner's framing: *"if note cutted by a stem and we can see its duration, model should also
recognize it right?"* — stop chasing a perfect slicer and let imperfect cuts be variation.

⭐ **Two classes, opposite remedies, and that IS the question.** (a) The cut lands mid-measure but no
notehead loses its beam or flag — learnable, and **29.8% of real strips are already width-split**.
(b) The cut severs a notehead from the ink carrying its DURATION — **not** a domain gap, and training
cannot fix it: the information is not in the picture. ⚠ Worked example: the exam strip that read as a
quarter had its **notehead intact, beam in the previous strip**
([METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md#barlines--where-the-cut-goes)).

⏭ **In order:** (1) **the label question, the blocker** — a strip that cannot map to whole SymbTr
measures is DROPPED today (`split_wide`), so bad cuts produce no training data at all, and something
must say what gold for a half-measure strip IS; (2) **size class (b)** via *cuts inside a beamed
group*, **15.5% of 754, unvalidated**; (3) only then an arm, priced against Lever 6's **a hole
responds to being filled, a domain gap does not** ([METRICS-INPUT.md](METRICS-INPUT.md#diagnostics--the-symbols-the-model-has-never-been-shown)).

⚠ **Not "the slicer is good enough, stop".** The 2026-08-26 fixes were about a third thing — rows
lost ENTIRELY, which is neither class.

### Further out, deferred past this round → [BACKLOG.md](#backlog-further-out--real-justified-and-not-this-round)

The density levers, exam v3's owed items, the error-localisation UI, the signature-packed sharp
glyphs, the synthetic-corpus exam guard and the rest moved there on 2026-08-26 at the 400-line cap.

**Merged into this file on 2026-11-20:**

- [Backlog, further out — real, justified, and not this round](#backlog-further-out--real-justified-and-not-this-round) — was `docs/BACKLOG.md`
- [Open risks and non-claims](#open-risks-and-non-claims) — was `docs/BACKLOG.md`


## Backlog, further out — real, justified, and not this round

*Was `docs/BACKLOG.md` (last updated 2026-10-08).*

Split out of [BACKLOG.md](BACKLOG.md) on 2026-08-26 at the 400-line cap. Phase split: that file
holds **what could be picked up next**; this one holds **what is deferred past this round**. Nothing
was dropped in the move, and the same warning applies to both — ⚠ **this is not a queue to work
down.** Each item carries the reason it is deferred; read it before starting. Abandoned plans live in
[log/superseded.md](log/superseded.md) and must never be acted on.

#### Further out (not next, not cancelled)

0. ⚠ **UPDATED 2026-10-08: two of the five levers below were spent in Round 4** — note-spelling
   tokens (scheme H: built, trained, a NULL on strips) and the rail's TRAINING half (`strips_h1`,
   +35 rows). What is still open from this list is the rail in the SHIPPED slicer, and it now lives
   as [BACKLOG.md](BACKLOG.md) item 0. The bullets below are as written on 2026-08-22..09-03.
   **THE DENSITY LEVERS — all deferred 2026-08-22, and all deliberately NOT in Round 3.** They came
   out of the "the app returns wrong notes on dense pieces" session
   ([METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md)). Splitting dense windows into single
   measures fixes **44.3%** of the failure class; these four are what the rest needs, and none of them
   is small:
   - **A per-notehead ink counter.** Today's `est_tokens` counts *stems*, and a stem does not carry
     the cost — `d''16` is 5 ids, `g'4` is 3. The two things that vary are **67% of the budget**
     (octave marks 37.6%, duration digits 29.8%) and both are visible ink: octave marks are the
     notehead's height against `top_y`, duration digits are the beam/flag count. A counter shaped
     `1 + octave_marks(y) + duration_digits(beams)` mirrors the tokenizer instead of approximating it.
     ⚠ Not needed for splitting — a false split is nearly free — so this is only worth it if a
     *gate* is ever wanted. Test set exists: 7,967 strips with exact id counts, minus the ~38% whose
     labels are physically impossible.
   - **Splitting INSIDE a measure.** `_split_wide` already cuts at zero-ink gutters, so the pixels are
     solved. The blocker is the emitter: it drops every `split_wide` strip unconditionally
     (`emit_strip_labels.py`) — **10,226 of b8's 24,837 drops, the single biggest reason** — because
     labels are derived by whole **measure spans** and half a measure has no span to match. Needs
     partial-measure alignment, which is a project.
   - **Note-spelling tokens — now specified and costed: [rung3/tokenization.md](rung3/tokenization.md)**
     (2026-08-27). The best long-term fix for density and the one with the largest measured headroom:
     at compact spelling the exam queue's over-budget rows fall **72 → 17 of 661** with the slicer
     untouched. ⭐ **Only 4 ids are missing** (`''`, `'''`, `16`, `32`) and they take a real label to
     **78%** of its length and rescue **2,410 of the 4,012 over-budget strips** (measured). ⚠ **A
     16-token variant that also fuses the 14 common letter+octave pitches rescues 3,508** — the
     4-vs-16 choice is open ([DECISIONS.md](DECISIONS.md), 2026-08-27). ⭐ **No label conversion is
     involved** — the text is unchanged, only the tokenizer's segmentation. Ids are append-only so it is *allowed*; it needs a retrain to be
     *used*. ⚠ **Do it in the same re-emit as the rail below**, not as its own round — both re-emit
     the pools. Round 4. ⏭ **PICKED UP 2026-09-03**: scheme H recommended (owner to confirm), no
     re-render this round, `\tupend` stays — [rung3/round4.md](rung3/round4.md).
   - **Raising the 59-id budget** — DROPPED for Round 3, then RAISED to 80 under scheme H for Round 4
     (2026-09-07; [DECISIONS.md](DECISIONS.md), [archive/phases.md](archive/phases.md#backlog--closed-items-archived) item 7).
   - ⭐ **THE RAIL ITSELF, AS A PAIR — the Round-4 headline** (owner, 2026-08-23). Measured and
     decided: the rail at *inference alone* is a wash (15.7% → 16.6%, p = 0.57), because it was
     tested on a model that has never been trained under it. Its real payoff is that a split strip
     **fits the 59-id emitter gate and enters training** — today 4,012 over-budget strips are simply
     dropped. The experiment is three steps and none is a research question: **re-emit the pools
     with the rail at b=57 → train → measure with `measure_fill_score.py`**, which is built and
     calibrated (7.6% false-alarm floor on gold). ⚠ **b=57, not 50** — recovery is flat b=40..59, so
     the value rides on over-splitting cost alone, and 50 makes 162 needless cuts
     ([METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md)). ⚠ **Turn it on in the training emit
     and the shipping slicer TOGETHER**, or the train/test mismatch B8 existed to close comes back.
     ⚠ The thing to verify after the retrain is that **non-dense pages do not regress** — that is an
     assumption today, not a measurement. ⚠ Doing this re-cuts the exam, which is exactly why it was
     kept out of Round 3. ⏭ **Round 4, b = 57, in the same re-emit as the tokens; the exam stays
     `examv3` as the comparable column and the rescued dense strips form a SEPARATE column**
     ([rung3/round4.md](rung3/round4.md) steps 5 and 8).

1. **DONE (2026-07-31): every consumer reads `_realval_v2`** — pointing an eval at
   `make_realval_pool.py`'s `_realval` output silently restores the no-hard-tier pool. ⚠ The owner's
   130 v1 verdicts (65 ok / 22 fix / 43 bad) did **not** transfer; what they bought is the confidence
   calibration and the 33% crop-failure rate that sized the v2 queue ([log/status-log.md](log/status-log.md)).

2. **The error-localisation UI — deferred 2026-07-27, then DROPPED as W8 on 2026-08-05.** The
   measurement is done and it is the reason it was dropped: flagging 10% of tokens catches 26.3% of
   errors against a ≥60% bar. Per-token logprobs already come out of
   `onnx_greedy_decode(return_logprobs=True)`; `decode_page.py` still throws all but min/mean away.
   If it is ever picked up again, per-TOKEN localisation is the version worth building.
3. **Measure the SIGNATURE-packed sharp glyphs.** Every fidelity measurement we have (`sharp_probe`,
   the 0.300 S bar weight, küçük's pitch widened to 0.65 S) was taken on INLINE glyphs. Signature
   glyphs are packed at `SIG_GLYPH_ADVANCE = 13 px`, have never been examined, and hold 32 of the
   exam's 33 küçük tokens — widening küçük's bars may actively hurt where horizontal room is fixed.
   Now a 13%-of-edits problem, so it sits below the pitch/duration work.
4. **Exam v3.** Owed: the 27 over-budget strip recoveries deferred from v2.1, re-validation of
   disjointness whenever the exam grows, and dedupe on SymbTr piece id rather than image stem. Also
   more `\komaSharp` gold — at n=14 the class cannot carry the weight the headline gives it. The
   train-time disjointness guard is already shipped; give v3 a one-time `round1-best` bridge read as
   its baseline. (The low-n weighting it also owed was done on 2026-07-27.)
   ⚠ **ADDED 2026-08-20 — the exam's crops are OLD-SLICER output too** (`strips_exam_v2_clean`, cut
   **17 July**, against the 25/29 July overhaul), so **the launch gate is measured on crops the
   shipped slicer no longer produces** ([METRICS-CORPUS.md](METRICS-CORPUS.md)). That is a decision to
   take **before** the one-shot read, not after — re-cutting the exam afterwards would either waste
   the shot or invite re-reading it, and the one-shot rule is what makes the number mean anything.
   ⚠ It cuts both ways and neither direction is measured: the exam carries retired defects the
   current slicer has fixed (flattering), while crops over 1200 px went **13.8% → 27.8%** on the same
   67 pages under the new slicer, so production sits further into the bad end than the exam shows
   ([METRICS-INPUT.md](METRICS-INPUT.md#crop-geometry--what-the-encoder-is-actually-given)). ⚠ Growing the exam and re-cutting it are the same
   job — do them in one pass or the disjointness re-validation runs twice.
5. **Extend the train-time exam guard to the SYNTHETIC corpus.** It inspects only the `--real-dir`
   pools today, which is how 5 exam pieces sat in `strips_v3`. `select_pieces.py --exam` now blocks
   them at selection, but the training guard should refuse them too.

6. **⬆ THE FEATURE TRACK LEFT THIS SECTION on 2026-08-15**, and finished on 2026-08-16 — F0, F2, F1
   and F3 are all built. This line stays only to say where it went: [features/README.md](features/README.md).
   ⚠ One caveat from here still holds and is recorded there: F3 was supposed to be aimed by what the
   friends say next, and it was built on the owner's own call instead — they were asked once (W10),
   said "more instrument sounds", and F1 delivered that. **The audio is settled** (2026-08-09): drums,
   clarinet, violin and kanun all shipped under **CC0**, licences read per file, no NC anywhere;
   **ney alone** still needs the owner's own recording, and oud and tanbur stay Karplus–Strong.
   Files: [THIRD-PARTY.md](THIRD-PARTY.md#audio-sources--the-verified-files-and-what-each-one-still-needs).

**NEW 2026-08-25 — THE LISTENING MIRROR: a live microtonal tuner on the fingerboard. Explicitly
NOT audio-to-score.** The owner asked whether the app could take a TSM recording, transcribe the
notes, identify the instruments and say how to play it. The answer splits in two, and **only the
small half is queued here**; the other half is written down below so it is not re-proposed.

- **What is deferred here.** Microphone in → per-frame f0 (fundamental frequency — the pitch being
  sounded) from a classic autocorrelation tracker (YIN/pYIN) in an `AudioWorklet` → cents against a
  chosen karar (tonic) → koma → the F3 marker draws where that finger is. Optionally scored against
  a loaded piece: *you played N komas above segah*. The player-facing pitch of it is that komas are
  the hardest thing to hit by ear and the one thing a learner cannot see.
- **Why this half is cheap: the downstream half is already built.** `positionOnString(openHz,
  noteHz)` in [../packages/core/src/fingering.ts](../packages/core/src/fingering.ts) already takes
  **Hz**, so a measured frequency feeds the existing fingerboard with no new arithmetic;
  `centsAboveRef` / `koma53ToFreq` in [../packages/core/src/tuning.ts](../packages/core/src/tuning.ts)
  own the 53-TET side and only need inverting. New code is **one audio-analysis module**, not a
  pipeline.
- ⭐ **It keeps the feature track's defining property** (see [features/README.md](features/README.md)):
  no ML, no GPU, no server, no training data — **and no gold labels**, which is the real saving. A
  tuner has no answer key to build: it reports the frequency it hears. Every expensive thing about
  the OMR track is the answer key.
- ⚠ **The one question that decides whether it is honest, and it is UNMEASURED**: a koma is
  **22.6 cents** (1200/53), and ney/violin vibrato can swing wider than that. So the first thing to
  do if this is picked up is check whether a browser YIN holds a koma steady on a real tone — not
  write the UI. If it cannot, the display needs smoothing and the claim needs weakening.
- ⚠ **The arithmetic stays out of the browser**, same house rule as F3: position formula and
  string choice live in `packages/core` and are pinned by
  [../tools/tests/fingering-test.ts](../tools/tests/fingering-test.ts).
- ⛔ **NOT THIS ITEM — blind transcription of an ensemble recording (AMT).** Four reasons, none of
  them small: TSM ensemble texture is **heterophonic** (everyone plays the same line at once with
  different ornaments), which is the worst case for onset and multi-f0 detection; ornaments —
  çarpma, glissando, vibrato — read as spurious notes; free-rhythm taksim and elastic ağır usuls
  defeat beat tracking; and every off-the-shelf transcriber emits **MIDI on a 12-semitone grid**,
  which quantises away the komas this project exists for. The training data would also be
  copyrighted recordings — the same licence family as SymbTr's NC clause
  ([THIRD-PARTY.md](THIRD-PARTY.md)). ⚠ **Unverified, from memory, check before quoting**: the
  CompMusic/MTG makam work — the circle SymbTr came out of — appears to have gone mostly to
  audio-**score alignment** rather than blind transcription, which would be evidence in the same
  direction.
- ⛔ **NOT THIS ITEM — instrument detection.** It is the weakest part of the original idea. Pretrained
  instrument taggers are Western-trained and carry little or no ney / kanun / ud / tanbur / kemençe
  vocabulary, so it needs its **own labelled audio corpus** — a second labelling loop of the kind
  that has cost this project the most. And it buys nothing a picker does not: the player knows which
  instrument they are holding, and F3 already has the picker.
- ⏭ **Sequenced by the owner (2026-08-25): after the public launch, once the shipped app is working
  well.** It touches no training data, no exam and no round, so it can never be the thing that
  delays one. Effort is **a guess, not an estimate** — nothing here is measured.

**TWO SMALL UI ITEMS, MOVED OFF THE README on 2026-08-25**, when it was rewritten as a user-facing
front page. Left unnumbered on purpose: item 0 above already points at "item 7", meaning the 59-id
budget item in the section above this one. This file was their only home, so they are kept here:

- **The rest of the settings modal.** The sheet view's **Accidentals** selector already covers the
  display-mode half of the idea (every note / row-start key signature / standard per-measure). Still
  missing: one settings surface holding the view choice (sheet vs instrument) and a **dark/light
  theme** switch.
- **The sheet view scrolls twice** — an inner scroll inside the score card, on top of the page
  scroll. The owner asked for the inner one to go.

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 numerics
investigation — now two instances, a dropped double dot (Round 1) and a dropped `\tup3` (Round 2),
both reference-path only and both fine under Python-ORT int8.

#### Retiring the dead tokens (moved here from [BACKLOG.md](BACKLOG.md) 2026-09-10 at the 400-line cap — its own title says *in a later round*, which is this file's genre)

**NEW 2026-09-07 — RETIRE THE DEAD TOKENS, IN A LATER ROUND (owner: *"bir sonrakinde
   tutarız"*).** Raised by the owner asking the sharp version of the question: *"eski tokenları neden
   silmedik — bu training'i direkt Flova OMR'ı base alarak yapmıyor muyuz?"* The premise is right —
   `train.py --model` defaults to `Flova/omr_transformer` and [rung3/round4.md](rung3/round4.md)
   step 6 is explicitly "from base", so a new model's ids are assigned fresh from `ADDED_TOKENS`
   and the old vocabulary is not inherited.
   ⭐ **What the measurement showed, and it corrects the code comment**: deleting a dead token does
   **NOT** break an existing checkpoint. A checkpoint carries its own saved tokenizer, and
   `ADDED_TOKENS` only *adds* what is missing — loading `r3a-stage2-best-real` or
   `round2-stage2-best` with a `\tie`-free list gives **added = 0** and `\tie` keeps id 98. From
   the base, deleting `\tie` shifts exactly **one** id (`\grace` 99 → 98). The append-only rule's
   real target is insertion in the MIDDLE, not deletion.
   ⏭ **Deferred for two reasons that are not id stability.** (a) Round 4 step 6's control arm is
   *defined* as "the old vocabulary"; deleting tokens in the same round makes the A/B two variables
   where the round's whole point is that the vocabulary gets its own paired answer. (b) One of the
   14 `gate:browser` strips carries `\tie` in its gold
   (`rast--sarki--curcuna--icime_hep`), and `gate.json` bakes its own id map — a model that cannot
   represent `\tie` can never match that strip. ⚠ **Not verified by running the gate**, only by
   reading its gold.
   ⚠ **The gain is near zero** — one row of 116 in the embedding, against the 0.01%-of-the-model
   price [rung3/round4.md](rung3/round4.md) already puts on 16 tokens. This is tidiness, not
   performance, which is why it waits for a round that is not measuring a vocabulary.


## Open risks and non-claims

*Was `docs/BACKLOG.md` (last updated 2026-10-08).*

Split out of [STATUS.md](STATUS.md) on 2026-08-17 when that file crossed the 400-line cap. The split
is by genre: STATUS holds **current state and the next action** and nothing else; this file holds
**standing caveats**, which are neither. Nothing here is a next action, and nothing here is
history — for history see [log/status-log.md](log/status-log.md).

Rule that produced most of this file: a number without its caveat gets quoted later as if it were
solid. That has already happened once, when a 3-gold class swung a headline ~11 points.

Resolved caveats are archived verbatim in [archive/phases.md](archive/phases.md#risks--closed-caveats-archived) (2026-10-08).

- **NEW (2026-09-19): AN EDIT COUNT IS ONLY COMPARABLE INSIDE ONE VOCABULARY, AND INSIDE ONE POOL.**
  Scheme H spells a note in fewer ids, so in its own ids the same mistake costs an H model ~1.1 fewer
  edits per strip — the training logs read 280 for H against 396 for the control on the same strips
  where a shared ruler shows no difference. ⛔ Never set two vocabularies' `EDITS` side by side;
  `paired_arm_score.py --score-vocab old` is the only comparison, and `eval_omr.py` has no such mode
  yet. ⚠ **And absolute rates travel no better between pools**: 0.16–0.41 edits/strip on
  `_denseval_h1*` against 1.45–1.57 on `_realval_v2r` is label provenance and the `nd` acceptance
  gate, not difficulty. Only paired differences within one pool mean anything.
  [METRICS-EXAM.md](METRICS-EXAM.md#round-4s-vocabulary-ab--how-it-is-scored-and-what-the-kit-measured-before-any-gpu-ran).
- **NEW (2026-09-19): "scheme H is a null" is measured on strips, and H's own case is about PAGES.**
  H did not help on any pool, dense ones included. What is not measured is the class no gold pool
  contains: **5.91%** of all real candidate strips exceed the decoder's 99-id ceiling under the old
  vocabulary against **0.30%** under H, and on those the app stops early and shows wrong notes
  silently. ⚠ Do not quote the null as "H buys nothing", and do not quote the 5.91% as an accuracy
  gain — it is a length distribution, and the app-side rail is a competing fix
  ([BACKLOG.md](BACKLOG.md) item 0).
- **NEW (2026-09-03): the owner's hand test and the paired reads DISAGREE, and neither is wrong.**
  The owner read Run A `best-real` as visibly better in the app while `_realval_v2` called it a null;
  `r4-ctl-stage2-last` then went live (2026-09-28) on a dense-strip LEAD, not a proven win. Real-val's
  CI half-width is ~±0.13 edits/strip, so a gain under ~5% hides, and the exam drops 41% of its
  candidates — the dense strips a whole page shows. ⚠ Do not quote "the live model is better" as
  measured, and do not quote a null as "no better". ⚠ **The page-level instrument EXISTS and is
  unread** — 20 owner-supplied pages, queue `handtest`, 457 of 515 rows still to read
  ([METRICS.md](METRICS.md#hand-test-pages--the-page-level-instrument) · [rung3/round4.md](rung3/round4.md)).
- **NEW (2026-09-03, MEASURED 2026-09-06 and WIDER since 2026-09-07): under the Round-4 tokenizer,
  synthetic labels are SHORT and real ones are not.** No render this round (owner), so synthetic
  labels stop at **44** H ids while real ones were to reach 59 — 887 real strips (11.9%) already
  longer than anything synthetic. ⚠ **The budget then moved to 80** (owner, 2026-09-07), so the band
  that exists only in the real pool is now roughly twice as wide. Long, dense labels are the material
  this round is FOR, and they will be trained on with no synthetic company at all. ⛔ Re-packing
  synthetic to fill the band was measured and rejected — it widens crops, which costs edits. What
  replaces it is watching: long-strip errors get their own column when the H arm is read.
- **The exam's primary is measured on 63 graded pages, so its 95% interval is roughly ±12 points.**
  Round 3 read 51% ±12 against the signed 75%. Any Round-4 read inherits the same width: a model
  truly at 72% can read 78% and vice versa. Report the interval beside the number, and decide what
  counts as a pass BEFORE the read ([METRICS-EXAM.md](METRICS-EXAM.md#metrics--the-exam-as-an-instrument)).
- **NEW (2026-08-21, narrowed 2026-09-06): `\sig` blocks in the EXAM and in every pool before
  `strips_h1` are UNVERIFIED.** The key signature is the only part of a label not derived from SymbTr:
  the model reads it off each row-start strip and, before rule D, the **majority read overwrote the
  derivation**. The voter's koma/küçük confusion is *systematic*, so the vote came out unanimous
  **and** wrong, and the `nd` gate strips `\sig` blocks before comparing. It fired on **24 of 45 exam
  pieces (53%)** and **406 of 938** `strips_nota` pieces (43%). ✅ Rule D now routes a vote that
  deletes or changes an accidental off the makam table's majority spelling to review — applied in the
  `strips_h1` emit; ⚠ **the exam was not re-emitted**, so part of the exam's signature error class
  (17.5% of Round 3's edits) may be bad gold rather than bad decoding. ⚠ Not an error rate
  ([METRICS-CORPUS.md](METRICS-CORPUS.md#metrics--the-model-voted-key-signature-audited) · [METRICS-CORPUS.md](METRICS-CORPUS.md)).
- **STILL OPEN: a cold start on a genuinely idle service has only been watched, never asserted.**
  `check:coldstart` fakes the cold window, which is the better test of the mechanism. ⚠ Since
  2026-09-04 there is **no browser fallback**: a cold start that outlasts `WARMUP_WAIT_MS` (**120 s**)
  shows the visitor `server-unavailable`; one cold start read **38.2 s** that day. ⚠ **The bot is the
  standing obstacle to measuring it**: an automated visitor (`HeadlessChrome/131`, referer the deploy
  URL) arrives seconds after every Netlify deploy and absorbs the cold start, so a post-deploy
  `smoke:live` is never the cold test — this was mis-written up as closed on 2026-08-09 for exactly
  that reason. Measure on an untouched service, and attribute the container start from the request
  log.
- **Three things now warm this service behind your back** — a demo recording (2026-08-08), a
  post-deploy crawler and the owner's own use. Any cold-start claim has to name the client that
  caused the `model ready` line, not just the elapsed time.
- **A busy instance is indistinguishable from a cold one at `/health`.** Concurrency is 1, so a
  second request during a decode gets a **fresh container** — `uptimeS` a handful of seconds, exactly
  what scale-to-zero looks like. Never read cold-start behaviour off a single `/health`; read the
  request log and the `model ready` lines together.
- **Real-val orders candidates; it does not predict exam performance.** Measured gap: 28pp.
- **The AEU headline is a per-class mean and is fragile to low-n classes.** A 3-gold class swung it
  ~11pp in Round 1; a 14-gold class swung it 4pp in Round 2 and was the entire reason that round
  read as a regression. MICRO and MACRO≥30 are now reported beside it and are the numbers to compare
  models on — but macro remains the pre-registered bar, so quote all of them.
- **The carry-sig bug is unfixed:** under a signature the model re-states the alteration inline in
  the wrong koma family. It reproduces on synthetic, so it can be iterated on with perfect labels.
  Round 2 weakens the old guess that it explains the komaSharp↔kucukSharp confusion: that confusion
  is now symmetric and confined to the `\sig` block, which looks like a glyph-discrimination
  problem rather than a carry-resolution one.
- **Round 2's three changes are not separable.** Glyph weight, label noise and corpus size all moved
  together, so nothing in that read attributes to one of them.
- **Label noise in the training pools:** ~7% pitch-level content error in nota auto-accepts, ~38%
  structurally noisy tie annotation. A 5% re-audit after Round 1 is owed.
- **Signature-position vs note-position accuracy is now MEASURED** (2026-07-27) and the sharps live
  in the signature: exam gold 32 in-signature vs 1 inline for `\kucukSharp`. Any claim about the
  microtonal sharps has to say which position it is about.
- **Blind spots, stated as non-claims:** `\buyukFlat` has 0 real gold; `\komaSharp`/`\buyukSharp` are
  low-n on the exam; `\tup3` is measured on the common k=1 case only; the exam is a matched
  upper bound (its pieces exist in SymbTr).
- **Who uses the public app is UNKNOWN.** The anonymous counter is built but records nothing until
  `STATS_SALT` is set ([features/README.md](features/README.md#f6--the-visit-counter-and-the-owners-private-dashboard)); before it, the request log
  saw two strangers, both on phones (n = 2, [METRICS.md](METRICS.md#metrics--who-actually-uses-the-deployed-app)). The phone became
  the main screen on 2026-09-19 on the owner's own use, not on this number.
- **Browser gate is 26/28** on the live model (`r4-ctl-stage2-last`, since 2026-10-08) — one strip,
  `kurdilihicazkar…bunca_cevrinle`, drops its `\tup3` on both the reference and the canvas path: an
  unbalanced tuplet, the class the owner accepted on 2026-09-03 because the stitcher brackets an
  unclosed run. ⚠ `gate.json` is gitignored and `make_browser_gate.py` regenerates it, so the
  tie-free fix of 2026-10-08 must be re-applied after any re-staging ([METRICS.md](METRICS.md#metrics--the-exported-runtime-onnx-export-int8-quantization-parity)).
  ⚠ The 14 gate strips are SYNTHETIC; on real strips int8 disagrees with its own fp32 weights on
  ~1 in 10, and no accuracy number in this project is measured on int8.
