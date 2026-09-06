# Round 4 — read the dense half, fix the answer key, pick the checkpoint on corrections

purpose: what Round 4 targets, the evidence behind each lever, the owner's decisions of 2026-09-03, and the order of work
audience: agents and the owner working the real-page track
updated: 2026-09-06

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
4. **The third-source probe** — 20–40 pages from two new sites, ~200 hand-labelled strips, Run A
   scored on them. Candidate sites and the licence rule: [../DECISIONS.md](../DECISIONS.md)
   2026-08-20. Free labels only where `match_symbtr.py` finds the piece; sahaney.com filters by makam
   and form, which is how the tuplet-dense sirto/longa/saz semaisi pages come in — collect them
   **with** the vocabulary change or the same gate drops them.
5. **Re-emit the real pools** under scheme H, **re-cutting only the 504 strips that are still over
   the 59-id gate under H** (owner, 2026-09-06 — [../DECISIONS.md](../DECISIONS.md)). ⛔ **NOT the
   whole pool with a balanced packer, as this step first said**: that moves crop boundaries, which
   [../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md) says stales every labelled pool —
   and it is unnecessary, because **3,508 of the 4,012 over-budget strips fall under the gate on the
   tokenizer change alone**, keeping their crops ([tokenization.md](tokenization.md)). The rail at
   b = 57 and the balanced packer apply **where a crop is being cut anyway**, i.e. on those 504.
   ⭐ H changes the tokenization and not the label TEXT, so an accepted strip's label is
   character-identical and its human verdict stays valid; the pool is `3,929 kept + 3,508 rescued +
   the split of 504`. Needs a Colab decode: every cache is refused since `GEOMETRY_REV` 20260903 —
   ⚠ those 2026-09-03 slicer fixes move some crops regardless, on an **unmeasured** number of pages.
   Then `verify-labels`, then the owner reads the audit sample and every `\sig` row — expect ~450
   fixes in ~3,500 rescued strips at the measured 12.9%.
6. **Two arms from base, one variable**: old vocabulary (control) vs scheme H, same pools, same
   steps, stage 2 at 4,000. ~3.5 h each on an L4. Everything else in this round changes together and
   is unattributable; the vocabulary gets its own paired answer.
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
- Raising the 59-id budget: the decoder's real ceiling is 100 and 0.03% of strips reach it.
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
