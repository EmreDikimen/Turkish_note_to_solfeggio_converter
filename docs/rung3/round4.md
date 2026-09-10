# Round 4 — read the dense half, fix the answer key, pick the checkpoint on corrections

purpose: what Round 4 targets, the evidence behind each lever, the owner's decisions of 2026-09-03, and the order of work
audience: agents and the owner working the real-page track
updated: 2026-09-10

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers live in [../METRICS.md](../METRICS.md),
> [../METRICS-EXAMSET.md](../METRICS-EXAMSET.md), [../METRICS-ROUND3-RUNS.md](../METRICS-ROUND3-RUNS.md)
> and [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md); decisions in [../DECISIONS.md](../DECISIONS.md).
> Plain-English version: [../OVERVIEW-ROUND4.md](../OVERVIEW-ROUND4.md).

## Why this round exists

Round 3 was built to fix **pixels** (three render flags) and the exam said the pixels were not the
problem: every class the flags targeted came out flat or slightly worse, and ~15 of the +17 points
was the retired `\tie` ([../METRICS-EXAMSET.md](../METRICS-EXAMSET.md)). Runs A and B were nulls on
real-val ([../METRICS-ROUND3-RUNS.md](../METRICS-ROUND3-RUNS.md)).

⚠ **The owner's hand test disagrees with the instruments, and for the ship call it outranks them**
(owner, 2026-09-03: *"exam ve evaluationlar o kadar fazla şey söylemiyor"*): Run A `best-real` reads
visibly better than both `r3-final-stage2-last` and Round 2 in the app. Both can be true. Real-val is
262 strips, so its CI half-width of ~±0.13 edits/strip hides any gain under ~5%; and the exam drops
**41%** of its candidates — the wide and dense strips — which is exactly what a whole page in the app
shows. The instruments still earned their keep: they caught the `\tie` illusion and three wrong
checkpoint picks. ⏭ **Recommended, not decided:** make the hand test repeatable — 10–15 fixed pages
outside the exam, every model on the same pages, corrections counted per page. That is the
page-level instrument this project has never had ([../BACKLOG.md](../BACKLOG.md) item 6 says why).

Round 4 therefore **draws nothing new**. It changes what the model is *allowed to learn from* (the
dense half of every real page), what it is *graded against* (the signature answer key), *how its
checkpoint is chosen*, and it checks whether a two-website corpus generalises.

## Root causes, and where each one's numbers live

| # | cause | evidence | home |
|---|---|---|---|
| 1 | **Training throws away the dense half.** A strip over the 59-id emitter gate is dropped. | b8 emit: 2,330 kept, **4,012 dropped**; 14.7% of real strips run over 59 ids; Round 3 improve:regress 4.5:1 on short strips, **1.25:1 (net worse) on ≥50-id strips**; note-missing is 37.5% of long-strip errors | [../METRICS-CORPUS.md](../METRICS-CORPUS.md) · [../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md) · [../METRICS.md](../METRICS.md) |
| 2 | **The signature is the largest error class and its gold is partly the model's own vote.** | signature 53 of 270 edits (17.5%); the vote overwrote 24/45 exam and 406/938 nota pieces; every human correction went koma→küçük, 10:0 | [../METRICS-CORPUS.md](../METRICS-CORPUS.md) · [../BACKLOG.md](../BACKLOG.md) item 9 |
| 3 | **The checkpoint selector picked wrong 3 of 3 times.** It blends a loss that is 92% synthetic, and loss does not predict corrections. | Run A: loss −6%, corrections 0 (15 better / 15 worse) | [../METRICS-ROUND3-RUNS.md](../METRICS-ROUND3-RUNS.md) · [../BACKLOG.md](../BACKLOG.md) item 3 |
| 4 | **Two websites, exam included.** | 1,055 neyzen + 1,000 notaarsivleri, nothing else | [../METRICS-CORPUS.md](../METRICS-CORPUS.md) · [../BACKLOG.md](../BACKLOG.md) item 10 |
| 5 | **Realism renders do nothing; holes respond.** | three realism arms null; staccato hole 72.7% → 0.0% | [levers.md](levers.md) |
| 6 | **Labels are noisy and the pitch/duration axis was never audited.** | b8 auto-accepts 12.9% wrong when read; signature rows worse | [../METRICS-CORPUS.md](../METRICS-CORPUS.md) |
| 7 | **The recipe has never used beam search, weight averaging (EMA) or label smoothing.** | — | [levers.md](levers.md) Levers 2 and 5 |

## What the owner decided on 2026-09-03

- **Round 3 is closed; Round 4 is open.** The Round-3 model on record stays `r3-final-stage2-last`;
  the owner's hand-test pick is Run A `best-real`.
- **`\tupend` stays.** *"tupend i şimdilik tutabiliriz, fena okumuyor aslında model şuanda tupletleri."*
  The retirement proposed in [tokenization.md](tokenization.md) is declined for this round; the
  stitcher already brackets an unclosed run, so the 51% unbalanced pairs cost the user nothing.
- **No new synthetic render.** *"sentetik tarafta yeni rendere ihtiyaç olduğunu düşünmüyorum."*
  `strips_v7_final` is reused unchanged. Labels never change; only the tokenizer's segmentation does.
- **Stage 2 stays at 4,000 steps** — Run A's recipe. More only if the pool grows enough to need it.
- **Beam search may not slow the user path unless it is measured to pay.** Where only our time is
  spent (the emitter), it is allowed.
- **The vocabulary question is answered: both kinds of token, by the ≥1,000-examples rule (scheme H).**
  ✅ **CONFIRMED by the owner 2026-09-06**, at **16 new ids / vocabulary 116** — the measurement that
  day removed `''` and `'''` from the set as dead tokens ([tokenization.md](tokenization.md)).
- ⛔ **No re-pack of the synthetic strips either (owner, 2026-09-06).** Proposed and approved that
  morning as the way to close the length gap H opens, then withdrawn the same session when the
  mechanism was measured: it fills the band by making crops wider, and wider is the direction that
  costs edits. The alternative that would work — tighter engraving — is named, uncosted, and not
  this round.

## The vocabulary: scheme H, and why "fused or compositional?" is answered with "both"

The measured case and the three schemes are in [tokenization.md](tokenization.md); nothing there is
restated except the choice. Vocabulary *size* is not the constraint — 16 tokens are 0.01% of the
model. **Examples per token** is.

- **Fuse the 14 pitches with ≥1,000 notes** (`a'` `a''` `b'` `b''` `c''` `c'''` `d'` `d''` `e'`
  `e''` `f'` `f''` `g'` `g''`). A notehead's height *is* letter+octave together, so one token matches
  the visual unit and the decoder takes one step fewer. The best-performing kern encoding in the
  literature (bekern) does the same: pitch one unit, duration separate.
- **Keep the 7 rare pitches compositional** (`a` `b` `g` `c'` `a'''` `d'''` `e'''`): `a'''` occurs
  **once**, `e'''` 23 times, `c'` 364, so each half has thousands of examples. ⚠ **Measured
  2026-09-06, and not the halves this line first predicted**: `d'''` comes out `d''` + `'`, not
  `d` + `'''` — the fused token wins the match. Consistent at every duration, which is what
  mattered.
- The rule is frozen once: a pitch rare today stays compositional forever, because ids are
  append-only.
- Also added: `'`, `16`, `32`; the dot stays its own token (owner, 2026-08-27).
  Vocabulary 100 → **116**. Warm-start the new rows from the old `'` and digit embeddings.
  ⛔ **`''` and `'''` are NOT added** — measured 2026-09-06 as used zero times over 450,456 notes,
  because the fused set covers all seven letters at `''`. Ids are append-only, so adding a dead
  token is permanent.
- ✅ **Trap verified with the real tokenizer, 2026-09-06** — it does not fire. All seven
  compositional pitches segment identically at every duration they appear with, and split evidence
  gets *better* than today's: 1.277% of notes take a minority id form now, 0.003% under H.
- ⚠ Two files carry `ADDED_TOKENS` by hand — `src/vision/data.py` and `tools/render/lilypond.ts` —
  and `check_token_drift` must pass. `audit_coverage.MAX_IDS` stays 59.

**What the change does NOT do.** The octave count below says pitch errors are one line or space
off, not an octave off; a fused token cannot fix a height misread. The case is **yield**: 3,508 of
the 4,012 dropped strips return, roughly tripling the real pool.

## The octave and merge count (2026-09-03)

Counted off the saved Round-3 decodes, no model run and no exam re-read; the table is in
[../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md). Three lines matter here: of 69 wrong pitched
notes on real-val exactly **1** is an octave jump and 14 are one staff step off; `'''` notes read about
**twice as badly** (3 of 21) — a lead, on 1.1% of notes that sit on ledger lines; and two notes read as
one happens **3 times in 262 strips**. The owner's "nadiren" is measured.

## The synthetic side under the new tokenizer — the one risk of not rendering

A synthetic strip was packed to fit 57 **old** ids; under scheme H it is ~33 ids. A real strip after
the re-emit fills up to 59 **new** ids. So the model would see long, dense labels **only in the real
pool** and never in synthetic. ⏭ Measure both id-length distributions with the scheme-H tokenizer
before training (no GPU, minutes). If the real tail is absent from synthetic, that is the only reason
to revisit the no-render decision; otherwise it stands.

## The order

1. ✅ **DONE 2026-09-06 — length distributions + rare-pitch segmentation under H.**
   `scripts/rung3/token_scheme_probe.py`, ~2 minutes, nothing re-decoded. Three results, all in
   [tokenization.md](tokenization.md): **H is 16 new ids and vocabulary 116** (`''` and `'''` are
   used zero times and are NOT added — ids are append-only, so that was worth catching before the
   freeze); the rare-pitch trap **does not fire** and split evidence gets *better* (1.277% of notes
   in a minority id form today → 0.003%); and the yield reproduces (**3,508 of 4,012** rescued, real
   pool 3,929 → **7,437**).
   ⛔ **The render question is answered "no render", and now for a measured reason.** The real length
   tail IS absent from synthetic under H (synthetic max 44 ids, real 59; 887 real strips — 11.9% —
   longer than anything synthetic). But re-packing synthetic to fill that band would make its crops
   ~2,580 px wide against the slicer's 1,450 px cap, which is the direction
   [../METRICS-GEOMETRY.md](../METRICS-GEOMETRY.md) measured as costing edits. ⏭ Replaced by
   **watching the band**: long-strip errors get their own column when the H arm is read.
2. ✅ **BUILT 2026-09-06 — the selector, EMA and label smoothing** (`src/vision/train.py`,
   smoke-tested end to end including resume; nothing trained yet).
   - `--select-dir` names a **fixed** pool (`_realval_v2`) and, at every eval, decodes it
     **free-running** and counts corrections with `eval_omr.align` — the same function
     `paired_arm_score.py` uses, so there is one definition of "an edit". It stamps a **new**
     `best-edits` tag; `best` and `best-real` keep their old meanings, the same rule the
     2026-09-01 `best-real` addition followed, so a run stays comparable with earlier ones.
   - ⛔ **It REFUSES to start if a selection piece is on the train side.** `best-real` reads whatever
     ~10% of each `--real-dir` the piece hash held out, which is why adding a pool silently broke it
     on Run B. Measured while building this: `_realval_v2` shares **40 of its 69 pieces** with
     `strips_b8`, and all 40 are val-side at the default `--real-val-frac 0.10` — but at **0.05
     seventeen cross over** and would be trained on with nothing to show it.
   - `--label-smoothing` (train loss only — `evaluate` stays unsmoothed, so `val_loss` keeps meaning
     what it meant) and `--ema-decay` (logs the average's own corrections, saves `ema-best` /
     `ema-last`). Both **off by default**: they are paired arms, not defaults.
   ⚠ **Built, not measured.** No arm has trained with it yet.
3. 🔶 **The signature vote — MEASURED 2026-09-06, the rule change still owed.**
   `scripts/rung3/sig_vote_audit.py`, minutes, nothing re-decoded. Every number is in
   [../METRICS-SIGVOTE.md](../METRICS-SIGVOTE.md); three things change the plan:
   - **The vote overwrote the signature on 67% of `strips_b8`'s aligned pieces** (826 of 1,236) —
     higher than any pool counted before, and `strips_b8` is the real training pool.
   - **47% of overrides change nothing but the drawn ORDER.** The emitter compares vote to
     derivation as an ordered tuple, so it fires on a re-ordering that changes no pitch. Those 602
     pieces need no review at all, and no earlier count separated them.
   - ⭐ **The biggest content change is a DELETED entry, not a wrong one.** 410 overrides drop at
     least one accidental (463 entries), against 156 that alter one. Of the 131 letter-level
     entries missing against the makam table, **106 were in the SymbTr derivation and the vote
     deleted them** — the model did not see an accidental, and its silence overwrote a correct
     entry. The koma/küçük confusion is real (`\kucukSharp` → `\komaSharp` is the top direction at
     30) but it is the second story, not the first.
   ⏭ **Owner decision owed before the rule is written**: item 9 proposed sending a piece to review
   where the vote disagrees with the makam table (**145 pieces**, ~765 row-start strips). That rule
   cannot see the dropped-entry class, and 30 pieces have no table entry at all. The wider rule —
   review wherever the vote changes the derivation's CONTENT — is **690 pieces**, ~4,668 strips.
   Volumes and the middle options: [../METRICS-SIGVOTE.md](../METRICS-SIGVOTE.md).
4. 🔶 **The third-source probe — COLLECTED 2026-09-06, nothing decoded yet.**
   `scripts/rung3/collect_thirdsource.py`; the design, the sources and the traps are in
   **[third-source.md](third-source.md)**. **36 pieces / 53 pages / 1,108 strips** from three sites,
   all under `data/real/rung3/_thirdsource/` and deliberately outside `manifest.csv` and `matched/`.
   ⭐ **The slicer found staves on all 53 pages — zero failures.** 27 exam pieces were refused and
   every chosen piece is unseen by `strips_b8`. Free labels come from SymbTr metadata matching:
   sahaney 496 accepts of 2,213, erdincbal 75 of 685, **blogspot zero** (its titles are lyric
   incipits with no makam column). ⛔ **nota.trt.net.tr is out** — its library is behind a login;
   **divanmakam.com is out** — a forum, so mixed and unrecorded provenance.
   ⚠ **The blogspot column is not a clean third source**: one of its eight pages is watermarked
   `www.erdincbal.com`, i.e. re-hosted from another column of this same probe, and one is **THM
   folk notation**, which this project's tokens do not cover. Both should be dropped before any
   number is quoted from it.
   ✅ **READ THE SAME DAY, AND IT IS A NULL.** Labels from `round2-stage2-best`, graded on Run A
   `r3a-stage2-best-real` — the label writer is not the model scored. **Yield holds**: rows fail to
   align on 28.6% of the probe against 33.2% (`strips_b8`) and 36.9% (`strips_nota`), so the pipeline
   does not jam on unfamiliar printing. **Accuracy is unanswered**: raw edits/strip read 0.37
   (erdincbal) and 0.86 (sahaney) against our held-out 0.13, but sahaney's strips carry **40.6 gold
   ids against 33.5**, and restricted to strips under 40 ids it falls to 0.20 with every 95% interval
   overlapping. At n = 34 and n = 10 nothing under ~3× was separable. ⭐ **The one non-null finding**:
   a different engraving house packs more music into a staff row, which lands on this round's own
   label-budget rail. ⏭ Growing the probe is the only route to a verdict; more erdincbal pages cost
   no hand labelling (75 SymbTr accepts exist, 14 used).
5. 🔶 **Re-emit the real pools — THE CODE IS COMPLETE (2026-09-07), the re-emit is NOT run.**
   Under scheme H, **re-cutting only the strips still over the gate under H** — and ⭐ **that gate is
   80 ids, not 59** (owner, 2026-09-07), which takes the re-cut from 504 windows to **148** and lets
   356 dense strips train whole ([../DECISIONS.md](../DECISIONS.md)). ⛔ **NOT the whole pool with a balanced packer, as this step
   first said**: that moves crop boundaries, which
   [../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md) says stales every labelled pool —
   and it is unnecessary, because **3,508 of the 4,012 over-budget strips fall under the gate on
   the tokenizer change alone**, keeping their crops. Only **504** need a new one.
   ⭐ H changes the tokenization and not the label TEXT, so an accepted strip's label is
   character-identical and its human verdict stays valid; the pool is `3,929 kept + 3,508 rescued +
   the split of 504`.

   **What is built:**
   - **The vocabulary.** `SCHEME_H_TOKENS` (17 entries, **16 new ids**, 100 → 116) beside the
     frozen 25 of `ADDED_TOKENS`, mirrored in `src/vision/data.py` and `tools/render/lilypond.ts`,
     with `data.vocabulary(scheme)` composing them and `train.py --vocab {old,h}` selecting one.
     ⛔ **H is a SEPARATE list on purpose** — folding it into `ADDED_TOKENS` was tried and reverted
     the same hour: every checkpoint was trained at vocabulary 100, so `load_model_and_processor`
     reported 17 new tokens for each and `paired_arm_score` refused them all as "the base model",
     `r3a-stage2-best-real` (the live model) included. Step 6 is an A/B of old against H, so both
     must load side by side. Verified: **0 existing ids move** under H.
   - **The rail.** `window_measures(..., oversize=...)` — a CALLBACK, because only the emitter
     knows a measure range's true id count (`est_tokens` has a residual sd of ~30). It splits
     **only** the failing window, at a **balanced** point inside it rather than at the midpoint
     (halving produced a 266 px runt beside a 1,080 px strip on the first real page). Neighbours
     keep their exact x-spans, so their crops stay byte-identical. Verified on a real page:
     `oversize=None` reproduces **21 of 21 crops byte-for-byte** and an identical manifest, so
     **no `GEOMETRY_REV` bump is owed** — the change is inert until the emitter supplies it.
     ⚠ A split **renumbers** every later `_wNN` in its row, so the manifest records `split_from`;
     pools are joined by measure span (`carry_old_fixes.py`), never by filename.

   - **The emitter's half (2026-09-07).** `emit_strip_labels.py` gained two flags, and they are
     deliberately **two runs, not one**: the rail is a FILE the owner can read before any crop
     moves.
     - `--vocab {old,h}` picks the tokenizer the 59-id gate counts with — **the budget gate only**.
       ⛔ Alignment keeps the decode model's own tokenizer: adding H's ids to it would re-segment
       the DECODED text too, and every `nd` number in the script lives in that model's id space.
       `MAX_IDS` (59) is a property of the trained model and does not move with the vocabulary.
     - `--rail-plan` prices **every candidate sub-range** of every over-budget window with a second
       `labels-cli --ranges` batch and writes `emit_rail.json` (`pages → system → "m_from:m_to" →
       ids`). It cuts nothing and re-decodes nothing.
     - `--rail <plan>` replays those measured counts as the slicer's `oversize` callback. A range
       the plan never priced answers **False** — an unknown range is "leave it alone", never a
       guess, which is what keeps the split confined to the windows that failed. It refuses a plan
       priced under a different `--vocab`, and every page the plan names is **re-decoded** (its
       crops are about to move); a cache carrying `split_from` is refused by a run with no plan for
       it, the same rule `GEOMETRY_REV` enforces for the CV path. ⛔ It also **refuses `--exam`**:
       that mode slices the frozen exam pages, whose crops the gold describes.
   - ✅ **Verified on a real page, 2026-09-07** (`nikriz_sirto_refik_fersan`, 3 pages, no pool
     touched — numbers in [../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md)): the gate
     is vocabulary-sensitive (18 over-budget windows under `old`, **0** under H, accepted strips
     28 → 40 on one piece), the rail clears the rest (over-budget 18 → 0, accepted → 54), and the
     owner's rule holds — of the 19 measure spans a railed page shares with its unrailed cut,
     **19 are byte-identical**, while 8 of them carry a different `_wNN` name.
   ✅ **RUN 2026-09-07 — and it took ROUTE C+, which needed no GPU at all.** The Colab decode this
   step assumed was avoided by measuring what it would cost first: on 30 pages re-cut with today's
   slicer, **20 cut differently and 15.3% of the strips carrying a LABEL changed pixels**. A verdict
   is given against pixels, so a full re-cut meant ~600 re-reads. The owner's call — *"o stripler
   hala kullanılabilir halde, atmayalım"* — and the way out was that the yield comes from the
   TOKENIZER, not from a new cut: `--frozen-crops` re-uses the crops and the 1,720 legacy caches and
   slices nothing ([../DECISIONS.md](../DECISIONS.md), [../../CLAUDE.md](../../CLAUDE.md)).

   **What came out: `data/real/rung3/strips_h1`, 4,460 rows** (4,425 frozen + 35 from the rail),
   against b8's 3,929. The full table is in
   [../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md); three findings change this plan:

   - ⛔ **"3,508 rescued → a pool of 7,437" WAS WRONG, and the reason is a second gate.** The budget
     class collapsed exactly as forecast (`over_budget` 4,012 → **141**), but of the ~3,871 strips
     that came back only **+588 reached training**: ~1,739 went to review and ~1,648 dropped as
     `nd_high`. An over-budget strip is a DENSE strip, and `nd` asks the referee to read exactly the
     material this round opened *because the model reads it badly*. **The binding gate is no longer
     the budget; it is the referee.**
     ⚠ **THE SECOND HALF OF THAT SENTENCE WAS CORRECTED 2026-09-09.** `nd_high` is measurably not
     "the model could not read it": exam mode reviews those strips instead of dropping them, and on
     the 75 a human read the owner's answer sits a median of **20** label-token edits from the label
     and **0** from the decode — the model read them, the LABEL named other music. They are also not
     denser than accepted strips (37 ids against 37). ⭐ The one subset that IS dense is the
     **1,678** the budget returned (median **49**), and none has been read; `build_ndhigh_queue.py`
     stages 40 at random as queue `ndhigh`.
     [../METRICS-ATTRIBUTION.md](../METRICS-ATTRIBUTION.md).
   - ⛔ **A better referee does not fix that** — pilot on 12 pieces / 597 strips with
     `r3a-stage2-best-real` (fair here: those strips were never trained on): it read **38.2%** of
     them differently and moved acceptance **33 → 32**. Saved a ~1,720-page inference pass.
   - ⚠ **The rail's own yield is +35 strips (+0.8%)**, not the ~282 its 141 windows allowed: 282 of
     its 356 accepted rows were re-groupings of music the pool already had, and 39 were refused
     because the two crop roots disagree on the page's staff-row count. Merged by
     `merge_rail_strips.py` under one rule — a row may only come from **inside a window the pool
     dropped as `over_budget`**.

   ⭐ **The gain is aimed where it was meant to be**: the 588 new accepted strips carry a median of
   **18 label tokens against 11** for the rows b8 already had, and the rail's 35 carry 20.
   ⏭ **Still owed**: the owner reads the seeded 100-row sample of the 571 unread rescued strips
   (queue `h1-full`, filter `new_dense_sample`) — b8's escaped-bad rate was 12.9% and nothing
   measures it for this material yet.

6. **Two arms from base, one variable**: old vocabulary (control) vs scheme H, same pools, same
   steps, stage 2 at 4,000. ~3.5 h each on an L4. Everything else in this round changes together and
   is unattributable; the vocabulary gets its own paired answer.
   ✅ **"SAME POOLS" IS ACHIEVABLE AFTER ALL — the real pool costs 4 rows, not 769** (measured
   2026-09-07 on `strips_h1`'s promoted labels, where the earlier 769 was an estimate over a
   15,610-strip pool that the `nd` gate never let exist). Of 4,425 labels, **4 cost more than 99 ids
   under the old vocabulary** — `collate`'s truncation cliff — so the owner's call (drop them from
   BOTH arms) makes the pair clean at negligible cost. ⚠ Longest H label is **51 ids**, so the 80
   budget binds nothing in this pool; the growth is the **549** labels costing more than b8's 59.
   ⚠ **Run at `--real-val-frac 0.10`, the default**: `_realval_v2` shares **44 pieces** with the
   training pool and at 0.10 all 44 sit val-side, but at 0.05 **17 cross into training** and the
   selector reads pieces it trained on — the Run-B defect, now checked before the run.
7. **Beam search, offline, on the current model first** — paired on `_realval_v2`. The decoder is
   20–25% of a strip's time (encoder 74–81%), so beam 3 costs roughly +40–60% page time, not ×3;
   Transcoda's gain at beam 3 was small. Ships to the user path only if it pays; otherwise the emitter
   keeps it.
8. **Read**: the owner's hand-test pages, real-val paired, then `examv3` once as the comparable
   column. A dense extension (the strips H rescues on exam pages) and the third-source set are
   **separate columns**, never merged into `examv3`. Decide before the read that the primary reads
   lower on denser material.

## Not this round

- A longer stage 2 as a question (answered: zero edits), and stage-1 length (untested lead).
- Training on the exam, or re-reading it for an A/B.
- Any realism arm, and the render-side holes — signature-only strips, segno at a bar's end
  ([../BACKLOG.md](../BACKLOG.md) item 11) — they wait for a round that renders.
- ~~Raising the 59-id budget~~ — ⭐ **DECIDED THE OTHER WAY 2026-09-07 (owner): the budget is 80
  under scheme H.** 59 was never a model limit, only the emitter's gate; the ceiling is 100 and a
  longer label is TRUNCATED at 99 in training. At 80 the rail re-cuts **148** windows instead of
  504 and **356 dense strips train whole**. [../DECISIONS.md](../DECISIONS.md) ·
  [../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md).
- Retiring `\tupend`; a `\dottedbar` token (every real gold label would become silently wrong).

## Outside evidence, named so it is not re-searched

- Transcoda (2026): beam 3 moved OMR-NED 18.71% → 18.46% and CER 4.38% → 2.72%; target
  normalisation mattered far more than decoding constraints —
  <https://arxiv.org/html/2605.10835>.
- The SMT encoding study: bekern (pitch one unit, duration separate) and ekern both beat raw kern —
  <https://arxiv.org/abs/2402.07596>.
- LEGATO (2025): 238k synthetic pairs from two renderers, zero real fine-tuning, beam 10 with a 1.1
  repetition penalty — <https://arxiv.org/abs/2506.19065>.
- Synthetic-to-real for real scans: 59 authentic training systems bought ~7–8 SER points; replay
  mixing while adapting — <https://arxiv.org/html/2606.09479v1>.
