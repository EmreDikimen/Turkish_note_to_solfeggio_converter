# Backlog — owed, not next, not cancelled

purpose: work that is real and justified but is not the next action; kept out of STATUS so that file can hold only current state and the next move
audience: agents picking up the project with spare capacity, or looking for what was deferred and why

updated: 2026-10-08

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
   in [BACKLOG-LATER.md](BACKLOG-LATER.md) item 0 and still described the Round-3-era plan).
   At inference an over-long strip cannot be dropped, so the model emits `</s>` early and confidently;
   `hitCap` catches ~0.2%. **5.91%** of real candidate strips exceed the decoder's 99-id ceiling in
   the old vocabulary, against **0.30%** under scheme H ([METRICS-ROUND4-AB.md](METRICS-ROUND4-AB.md)).
   Two candidate fixes, **neither measured on pages**: (a) **an app-side rail** — cut a dense crop
   smaller in the browser slicer (`?dense=<ids>` exists as an opt-in experiment; alone, at inference
   on an untrained model, it was a wash — [METRICS-DENSE.md](METRICS-DENSE.md)); (b) **scheme H**,
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
   [METRICS-SLICER-ROOTS.md](METRICS-SLICER-ROOTS.md). ✅ **The POOL is repaired (2026-09-16)**:
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
   [archive/rounds/levers.md](archive/rounds/levers.md) Lever 5 named this without a number; the number is what makes
   it actionable. Three fixes, cheapest first: weight the blend deliberately instead of by strip
   count; raise `--real-val-frac` so the real pool is not 271 strips; or select on a **free-running**
   real metric (edits/strip) rather than teacher-forced loss, which is Lever 5's own preferred answer
   and the only one that measures what the round is graded on.
   ✅ **BUILT AND USED IN ROUND 4 (`train.py --select-dir`, 2026-09-06; ran 2026-09-16/17).** It
   decodes a FIXED pool free-running at every eval and stamps `best-edits`. ⚠ **What it bought is not
   yet visible**: in both arms `best-edits` and `last` are a tie (control 396 against 410 corrections
   on the selection pool, H 280 against 282), and on `_realval_v2r` the picked copy read **15 edits
   better than `last` — which was pick-luck, not quality**: against the live model the bias-free
   `last` fell back to a null ([METRICS-ROUND4-AB.md](METRICS-ROUND4-AB.md)). ⏭ Still owed: a run
   where the three tags disagree enough to price the selector itself.
   ⭐ The boundary this item kept hitting is now a hard guard — the selection pool may not share a
   piece with training, and the run REFUSES rather than warns. The three wrong picks that built the
   case (Round 3 final, Run A, Run B) are archived in
   [archive/backlog-closed.md](archive/backlog-closed.md).

4. ✅ **CLOSED — the b8 re-emit ran on 2026-08-21, and Round 4's `strips_h1` superseded its pool.** Archived verbatim in [archive/backlog-closed.md](archive/backlog-closed.md).

5. ✅ **CLOSED — the dotted (usul) barline was drawn label-free in Round 3's render; the `\dottedbar` token is declined for Round 4.** Archived verbatim in [archive/backlog-closed.md](archive/backlog-closed.md).

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
   independently useful if page gold is ever wanted: `tools/vision/page-structure.ts` (per-page stitch
   stats, reusing the shipped stitcher and core so the meter rule is not duplicated) and
   `scripts/rung3/build_page_queue.py` (ranks pages by structural error evidence, refuses exam
   pieces, caps per makam). A 150-page queue is built at
   `data/real/rung3/_pagequeue/page_queue.json`.
   ✅ **Update, same day: the ranking IS consumed now** — `build_label_batch.py` reuses its scorer to
   cut page-complete labelling batches for the *existing* strip UI, and `batch2` is live
   ([rung3/labeling-queues.md](rung3/labeling-queues.md)). What stays deferred is only the **page-level
   UI**, i.e. the expensive half the cost case stopped. The ranking earning its keep in a cheaper
   consumer is the reason it was kept rather than deleted.
   ⚠ The strongest remaining argument for ever building it is **not** throughput: nothing this project
   owns produces **page-level gold**, which is the unit Round 3's signed floor is stated in, measured
   on 63 graded pages at about ±12 points ([METRICS-EXAMSET.md](METRICS-EXAMSET.md)). ~150 corrected
   pages would more than double the exam. If it returns, it returns for that reason.

7. ✅ **CLOSED — the 59-id budget was measured and the owner raised it to 80 under scheme H (2026-09-07).** Archived verbatim in [archive/backlog-closed.md](archive/backlog-closed.md).

8. **NEW 2026-08-20 — audit 100 crops from the CURRENT slicer before pouring more hours into
   labelling.** The evidence that the slicer's throw-away rate is the bottleneck is scattered across
   four files and has never been put in one place or re-measured on today's code: **33% of crops
   unusable** in the first `realval-hard` queue (43 of 130), **13,975** strips dropped corpus-wide for
   `row_unaligned`/`nd_high`, **2,108** over-budget, and `batch3`'s own cut excluded **24%** of the
   pages it checked as stale. ⚠ Every one of those numbers is from the OLD slicer or from a queue
   build, so none of them says what today's code does. ⏭ Draw 100 random crops from a current
   re-slice, look at them, and report the unusable rate. If it is still ~1 in 3, the slicer outranks
   labelling and this file's item 4 stops being a cleanup and becomes the main line.

9. ✅ **CLOSED — rule D (2026-09-06) sends a vote that deletes or changes an accidental off the makam table's majority spelling to review; applied in the `strips_h1` emit. What is still unverified (the exam's and the older pools' `\sig` blocks) is a standing caveat in [RISKS.md](RISKS.md).** Archived verbatim in [archive/backlog-closed.md](archive/backlog-closed.md).

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
   ([rung3/third-source.md](rung3/third-source.md)). ⛔ nota.trt.net.tr (login) and divanmakam
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
([METRICS-SLICER-BARLINES.md](METRICS-SLICER-BARLINES.md)).

⏭ **In order:** (1) **the label question, the blocker** — a strip that cannot map to whole SymbTr
measures is DROPPED today (`split_wide`), so bad cuts produce no training data at all, and something
must say what gold for a half-measure strip IS; (2) **size class (b)** via *cuts inside a beamed
group*, **15.5% of 754, unvalidated**; (3) only then an arm, priced against Lever 6's **a hole
responds to being filled, a domain gap does not** ([METRICS-UNSEEN.md](METRICS-UNSEEN.md)).

⚠ **Not "the slicer is good enough, stop".** The 2026-08-26 fixes were about a third thing — rows
lost ENTIRELY, which is neither class.

### Further out, deferred past this round → [BACKLOG-LATER.md](BACKLOG-LATER.md)

The density levers, exam v3's owed items, the error-localisation UI, the signature-packed sharp
glyphs, the synthetic-corpus exam guard and the rest moved there on 2026-08-26 at the 400-line cap.
