# Backlog — closed items, archived

purpose: the BACKLOG.md items that are DONE or SPENT, kept verbatim so their reasoning survives; nothing here is an action
audience: anyone asking why an item left BACKLOG.md, or re-deriving one of these findings
updated: 2026-10-08

> ⛔ **Archived 2026-10-08 from [../BACKLOG.md](../BACKLOG.md).** Item numbers are the ones BACKLOG.md
> used; BACKLOG.md keeps a one-line stub under each number so old references still land. Every
> "owed" / "next" below is as of its own date.

## Item 3 — the history behind the selector fix (2026-08-20 → 2026-09-06)

   ⚠ **Deferred, not ignored, for one reason: changing the selector mid-round makes the arms
   incomparable.** `r3-tupnew-stage2-best` was selected under the current blend, so every arm scored
   against it must be too. This lands **after** the staccato arm is read, and it is a Round-4 recipe
   change, not a Round-3 patch.

   ⭐ **CONFIRMED BY THE ROUND-3 FINAL RUN, 2026-09-01 — this is no longer a prediction.** Stage 2's
   two val curves moved in **opposite directions** for 1,500 steps: synthetic 0.0106 → 0.0117 while
   **real fell 0.0301 → 0.0182 (−39%)**, still falling at the last step. The blend weighted them
   4,763 : 390 (**92.4% synthetic**), so the selector followed the synthetic curve and stamped `best`
   at **step 500**, where real val was **0.0234 — 22% worse than `last`** at step 1750–2000. The
   round's own mitigation (bring `last` home too, and compare on `_realval_v2`) is what saves the run;
   without it the graded checkpoint would have been the worse one on real pages, silently.
   Raw curve: [../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md), log `docs/log/raw/round3_final_logs.md`.

   ⛔ **CONFIRMED A SECOND TIME, AND WORSE, BY RUN A (2026-09-01).** At 4,000 stage-2 steps the blend
   stamped `best` at **step 250** — the first evaluation — and no later mix ever beat it, while real
   val went on improving to **step 2,500**. ⭐ The `best-real` checkpoint added the same day is the
   only reason that 1.7-hour run produced a usable model: `best` is barely specialised and `last` is
   past the minimum. **Two runs, two wrong picks, the second by 2,250 steps.** The cheap fix is now
   shipped (a third checkpoint); the real fix — re-weighting the blend, or selecting on a free-running
   metric — is still owed and is still a recipe change, not a patch.
   ⚠ It does **not** invalidate any paired arm result — an arm and its control share the selector.

   ⛔ **A THIRD TIME ON RUN B (2026-09-02), AND THE WRONG PICK WAS `best-real` ITSELF.** The blend put
   `best` at step 3,250 this time — a different place again — but the run's real-page winner was
   `last` (step 5,000), which beats its own `best-real` (step 1,250) **645 edits to 694** on
   `_realval_v2`. ⚠ **Why `best-real` failed here is the part to keep**: Run B trains on two real
   pools, so `train.py` held out ~10% of each and its real-val set is **560 strips, 170 of them
   retired-crop** — the checkpoint meant to track real pages was 30% steered by pictures the shipped
   slicer does not produce. ⭐ So the cheap fix has a boundary: **`best-real` is only as good as the
   pool it reads**, and adding a real pool silently changes that pool. Three runs, three wrong picks,
   in three different places (steps 500, 250, and `best-real` at 1,250).
   [METRICS-ROUND3-RUNS.md](../METRICS-ROUND3-RUNS.md).
   ✅ **BUILT 2026-09-06** — `train.py --select-dir` decodes a FIXED pool free-running at every eval
   and stamps `best-edits` on corrections, not loss; `--ema-decay` and `--label-smoothing` are in as
   off-by-default arms ([rung3/round4.md](../rung3/round4.md) step 2). ⚠ **Built, not measured**: no arm
   has trained with it, so "the selector now picks right" is a design claim, not a result.
   ⭐ The boundary this item kept hitting is now a hard guard — the selection pool may not share a
   piece with training, and the run REFUSES rather than warns. `_realval_v2` shares 40 of its 69
   pieces with `strips_b8`; all 40 are val-side at `--real-val-frac 0.10`, but 17 cross over at
   0.05.


## Item 4 — the b8 re-emit (done 2026-08-21)

4. ✅ **DONE 2026-08-21 — the re-emit RAN** (`data/real/rung3/strips_b8`, 3,955 accepted against
   2,330; result and carry table in [METRICS-CORPUS.md](../METRICS-CORPUS.md), queues in
   [rung3/labeling-queues.md](../rung3/labeling-queues.md)). ✅ **The `b8-audit` guard is READ —
   all 201 rows, 13.4% wrong** ([METRICS-CORPUS.md](../METRICS-CORPUS.md)). ⏭ **One thing is still owed
   before it is training data**: the **1,442 human `fix` labels** in the old pools
   must be carried across **by measure span, never by filename**. The problem statement
   below is kept because it is what the run was justified by — and because the *selector* half of it
   is untouched: the real val strips inside the blend are still the old pools' crops until the carry
   is done.
   **NEW 2026-08-20 — the real TRAINING pools are old-slicer crops, and so is the real half of the
   selector.** `strips_nota` / `strips_r1` / `strips_tup` were cut **11–17 July**; the slicer was
   overhauled **25 July** and fixed four more times on **29 July**. On a 5-page re-slice sample **0 of
   30 crops were identical**. So 2,330 training strips, and the 271 val-side strips inside the
   checkpoint selector, are crops the shipped slicer no longer produces
   ([METRICS-CORPUS.md](../METRICS-CORPUS.md)).
   ⚠ **This is the concrete half of B8** ([STATUS.md](../STATUS.md)), which frames re-emitting as a
   decision about *training* data; the selector consequence is the part that had not been stated.
   ⚠ Do the re-emit with its own `--out` and look at what moved first — it rewrites the manifests the
   promoted verdicts hang off. And note the priority: fixing these crops without touching the blend
   above improves **5.4%** of the number that picks `best`.
   ⭐ **UPGRADED 2026-08-21 — this is no longer a tidiness item, it is a train/test mismatch.** The
   exam was rebuilt on the current slicer and `_realval_v2` was already built on it, so **training is
   now the only pool still on retired crops**: the model would learn from crops the shipped slicer
   does not produce and be selected *and* graded on crops it does. Round 3's own Lever 1 measured crop
   geometry as **causal** (+59% edits when resolution falls), so this is a domain gap of exactly the
   kind the round is trying to close.
   ⭐ **And it is cheap, measured 2026-08-21: 2,064 of the 2,330 labels (89%) carry** onto the new
   crops by measure span (`strips_r1` 404/421, `strips_nota` 1,554/1,740, `strips_tup` 106/169 — the
   tuplet pool is the weak one at 63%). 248 are lost, 18 ambiguous. **No new labelling** — the same
   carry rule the exam rebuild used ([rung3/exam.md](../rung3/exam.md)).
   ⏭ **Sequence it BEFORE the final render**, not after: a render is the one moment the training set
   is rebuilt anyway.
   ⭐ **WHICH MODEL, settled 2026-08-21 (owner): `round2-stage2-best` does the WHOLE job** — a
   morning's split into "gate" and "hint" models was proposed and **cancelled the same day**
   ([DECISIONS.md](../DECISIONS.md)). The number that settled it: the gate model also **aligns rows**, and
   an unalignable row discards every strip on it — the weak referees dropped **10,695 strips as
   `row_unaligned`** (4,467 nota / 5,540 tup / 688 r1) against **2,330 accepted**. Yield, not
   precision, is the referee's dominant effect. ⚠ **The audit sample must be READ.** `--audit-frac`
   measures the escaped-bad-label rate, which is the whole guard now that the referee has seen these
   labels; exam v2 sampled 2 of 63 and a later full read found **51%** wrong. ⛔ The exam is not
   re-emitted and keeps the neutral decode ([rung3/exam.md](../rung3/exam.md)).


## Item 5 — the dotted (usul) barline (promoted 2026-08-20; Round 3 drew it label-free)

5. ✅ **PROMOTED OUT OF THIS FILE 2026-08-20 — the dotted (usul) barline goes into the FINAL
   RENDER, drawn LABEL-FREE.** The decision, its two halves and what is given up are in
   [DECISIONS.md](../DECISIONS.md); the work is tracked in [STATUS.md](../STATUS.md). The description below
   is kept because it is the diagnosis, and because the *token* half of it is still owed to Round 4.
   ⚠ **What changed:** this item was deferred behind the render-slot rule; the staccato arm's read
   has happened and the same-shape argument is now backed by a trained result. It is also the only
   deferred item the owner is paying for **by hand** — ~1 in 5 of `batch3`'s corrections so far is
   deleting a false `\repstart`.

   **The diagnosis, as written:** the DOTTED (usul) BARLINE has no token and is never drawn, so the
   model reads it as `\repstart`. Owner-found while labelling `batch3`, then measured: **117 of 1,499 rows
   (7.8%)** decode a `\repstart`, and of the 23 judged so far **13 had it removed as wrong**
   ([METRICS-UNSEEN.md](../METRICS-UNSEEN.md)). Turkish editions print a dotted barline to mark
   usul subdivisions inside a measure; `ADDED_TOKENS` has no spelling for one and the renderer draws
   only single and repeat barlines, so **0 of 40,826 strips** contain one and the nearest thing the
   model knows is a repeat sign — a line plus *dots*.
   ⭐ **This is the same structural hole as the staccato one** (Lever 6) — and as of 2026-08-20 that
   matters more than it did, because the staccato arm **ran and took its primary from 72.7% to 0.0%**
   while the three realism arms beside it were all nulls. **A hole responds to being filled; a domain
   gap does not** ([rounds/staccato-arm.md](rounds/staccato-arm.md)). Same shape as the signature-only
   crop and the bare phrase slur before it. The fix has the same two halves:
   draw it (a renderer change plus a per-piece coin) and give it a name — ⚠ and `ADDED_TOKENS` is
   **append-only**, so a `\dottedbar` token goes at the END and needs gold annotation before it can
   be scored.
   ⛔ **The deferral text that stood here is SPENT and is not to be acted on** — it said the item was
   held behind the render-slot rule and behind the staccato flag's open question. Both resolved on
   2026-08-20 and the item was promoted; see the head of this entry. ⚠ **What did NOT get promoted is
   the token half**: the `\dottedbar` spelling stays a Round-4 question, because naming the symbol
   would make every existing real gold label — none of which annotates one — silently wrong. Drawing
   it label-free is consistent with every pool on disk, which is the whole reason it costs no
   labelling ([DECISIONS.md](../DECISIONS.md)).
   ⚠ **Cheap first step, no render**: count dotted barlines across the real pools with a probe, the
   way the tuplet mark was counted. 7.8% of one batch is a decode statistic, not a print frequency.


## Item 7 — the 59-id decoder budget (resolved 2026-09-07: 80 under scheme H)

7. ✅ **RESOLVED 2026-09-07 — MEASURE THE 59-id DECODER BUDGET. It is a setting, not an architectural
   limit, and it is the only item on this list that pays THREE times.** `MAX_IDS = 59` in
   `src/vision/audit_coverage.py` exists because the base weights' `generation_config.max_length` is
   **60**; `src/vision/data.py` truncates training targets to it and every emitter drops a strip that
   exceeds it. The comment beside it — *"cannot be raised without breaking training"* — is true of
   **existing checkpoints**, which is not the same as true of a model trained from base, and the final
   render trains from base anyway. What raising it would buy, all three already measured:
   - **the exam**: on the REBUILT exam it drops **153** strips as over-budget (of 567 dropped in all),
     and **3 of the 67 pages produce nothing at all**, capping the exam at 64 pages
     ([METRICS-EXAMSET.md](../METRICS-EXAMSET.md)). The pre-rebuild figure was 78 of 282.
   - **the tuplet repertoire**: 39.4% of triplet-bearing *single* measures blow it, 80.5% of 2-measure
     and 92.9% of 3-measure windows — which is *why* sirto/longa/saz semaisi are unmeasured
     ([rung3/labeling-collection.md](../rung3/labeling-collection.md) §1c, [rounds/round3-criteria.md](rounds/round3-criteria.md) §5)
   - **training data**: 2,108 over-budget drops plus the `split_wide` pile
   ✅ **DONE 2026-09-07 — the measurement was run and the owner raised it to 80 under scheme H.**
   `scripts/rung3/budget_tail_probe.py` did exactly what this item asked (the real tokenizer over the
   existing drop lists, one script, no GPU): over b8's 15,758 serialized labels the over-gate count is
   **504 (3.20%) at 59 and 148 (0.94%) at 80**, and the longest label the owner has ever hand-typed
   is **67** ids. ⚠ **This item's premise needed one correction**: the ceiling is not 60 but **100** —
   `data.collate(max_len=100)` and `MAX_TOKENS` in `decode.ts` — so 59 was never the model's limit,
   only the emitter's gate. ⚠ The cost side this item flagged is still unpriced and still real:
   longer targets mean more decode steps per strip, in the browser and on Cloud Run. Nothing about
   the SHIPPED latency changed, because the budget gates the training pool and not the runtime.
   [METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md) · [DECISIONS.md](../DECISIONS.md).


## Item 9 — the model-voted key signature (rule D chosen and built 2026-09-06)

9. **NEW 2026-08-21 — THE MODEL-VOTED KEY SIGNATURE: measure it, then change the rule.** Found by the
   owner reading `examv3-full` ([METRICS-CORPUS.md](../METRICS-CORPUS.md) has the mechanism and the
   counts). The signature is the only part of a label not derived from SymbTr: the model reads it off
   each row-start strip and the majority read **overwrites** the derivation. The voter is the weak
   `rung3-labeler`, its koma/küçük confusion is systematic so the vote is unanimous and wrong, and the
   `nd` gate cannot see signatures at all. It fired on **24 of 45 exam pieces**, **406 of 938**
   `strips_nota` pieces, 98 of 293 `strips_tup`, 26 of 65 `strips_r1`.
   ⏭ **The measurement is a script — no labelling, no GPU.** For every piece where the override fired,
   compare the chosen signature against `data/makam_signatures.json`'s majority variant for that
   makam and list the disagreements. On the exam that already gives **8 of 36 pieces**, several of
   them *missing* entries the table calls near-universal (huseyni, nikriz, segah). That turns one
   owner observation into a checkable list across all four pools.
   ⏭ **The proposed rule change**: a model may not silently overwrite the table. Where the vote
   disagrees with the makam's majority variant, send the row-start strips to **review** instead of
   overriding — the same treatment a split vote already gets.
   ⚠ **Re-emitting with `round2-stage2-best` does NOT fix this** (item 4): that model trained on these
   labels, so it inherits the koma bias. A better voter is still the wrong kind of authority.
   ⭐ **That prediction is now OBSERVED, not argued** (2026-08-22): the 201-row `b8-audit` — labels the
   *re-emit* wrote with `round2-stage2-best` voting — contains **2 more `\komaSharp`→`\kucukSharp`
   corrections inside `\sig`**, both in the same direction as the exam's ten. ⚠ n=2, so it confirms
   the mechanism survived the re-emit; it does not size it.
   ⚠ **Not yet an error rate.** n=7 corrections in 1 makam; many overrides are probably right, and the
   table is a guide — mahur genuinely prints both ways (küçük 35, koma 17).
   ✅ **THE MEASUREMENT IS DONE (2026-09-06)** — `scripts/rung3/sig_vote_audit.py`, all five pools,
   in [METRICS-SIGVOTE.md](../METRICS-SIGVOTE.md). It confirmed the mechanism and moved the target: the
   **largest** content change is not a wrong accidental but a **deleted** one (410 overrides drop an
   entry against 156 that alter one; 106 of the missing entries were in the derivation), and **47%
   of overrides change only the drawn order**, which no earlier count separated. ⏭ **Still owed: the
   rule**, and it now needs an owner decision, because a table-disagreement trigger (145 pieces)
   cannot see the dropped-entry class while a content-change trigger (690) can
   ([rung3/round4.md](../rung3/round4.md) step 3).


## The segah `b2` question (closed 2026-09-05)

### ✅ CLOSED the day it was opened — a segah spelled `b2` is a SymbTr artefact, not a page (owner, 2026-09-05)

Kept because the wrong version of this is easy to re-derive from the fixtures. `MAKAM_INTONATION`
matches a note by its **exact** written alteration, and the staff draws the **nearest** AEU sign
(`toAeuAlter`) — so on the bundled SymbTr exports a `Si4b2` and a `Si4b1` are the same koma-bemol on
screen and only the second is bent. `gamzedeyim-deva` is **22 `b1` against 54 `b2`**;
`beyati-delisin` is **0 against 40**, so choosing Beyâtî there changes nothing at all. That looks
like a hole in the table and is not one.

⛔ **A real page cannot spell a `b2`.** The model's vocabulary is the **8 AEU accidentals** plus a
natural (`ADDED_TOKENS`, `src/vision/data.py`) — there is no 2- or 3-koma token, so a decode only
ever produces ±1 / ±4 / ±5 / ±8, and printed Turkish editions only ever print those four signs
either way (owner: *"beyati delisini zaten biz SymbTr'den aldık, orada b2 b3 var ama normal
fotoğraflarda yok öyle bir şey"*). `decoded.json`, the one bundled score that came from a photograph,
reads **2 `b1` / 0 `b2`**. The product path — photo → decode → play — is therefore already exact.

⚠ **Two residues, both small and both worth knowing.** (1) The **editor** offers ±2/±3 on purpose
(`ACCIDENTAL_VALUES`), so a hand-placed 2-koma si draws as a koma-bemol and takes no bend; that is
one user, one note, and snapping the match would make the editor's exact alterations stop meaning
what they say. (2) On a SymbTr fixture the picker's count reads low by design — 22 where a reader
counts 76 drawn koma-bemols on `gamzedeyim-deva`. Do not debug that as a counting bug.

