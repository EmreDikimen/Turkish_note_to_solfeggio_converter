# Round 4 — read the dense half, fix the answer key, pick the checkpoint on corrections

purpose: what Round 4 targets, the evidence behind each lever, the owner's decisions of 2026-09-03, and the order of work
audience: agents and the owner working the real-page track
updated: 2026-09-03

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
  ⚠ Recommended by the agent when asked; the owner has not confirmed the scheme itself.

## The vocabulary: scheme H, and why "fused or compositional?" is answered with "both"

The measured case and the three schemes are in [tokenization.md](tokenization.md); nothing there is
restated except the choice. Vocabulary *size* is not the constraint — 16 tokens are 0.01% of the
model. **Examples per token** is.

- **Fuse the 14 pitches with ≥1,000 notes** (`a'` `a''` `b'` `b''` `c''` `c'''` `d'` `d''` `e'`
  `e''` `f'` `f''` `g'` `g''`). A notehead's height *is* letter+octave together, so one token matches
  the visual unit and the decoder takes one step fewer. The best-performing kern encoding in the
  literature (bekern) does the same: pitch one unit, duration separate.
- **Keep the 7 rare pitches compositional** (`a` `b` `g` `c'` `a'''` `d'''` `e'''`): `a'''` occurs
  **once**, `e'''` 23 times, `c'` 364. Spelled `a` + `'''`, each half has thousands of examples.
- The rule is frozen once: a pitch rare today stays compositional forever, because ids are
  append-only.
- Also added: `'`, `''`, `'''`, `16`, `32`; the dot stays its own token (owner, 2026-08-27).
  Vocabulary 100 → 116. Warm-start the new rows from the old `'` and digit embeddings.
- ⚠ **Trap to verify with the real tokenizer before training**: how the 7 rare pitches segment.
  `a'''8` must come out the same way every time (`a` `'''` `8`, not sometimes `a''` `'` `8`).
  [tokenization.md](tokenization.md) verified this for scheme B only.
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

1. **Length distributions + rare-pitch segmentation under H** — no GPU. Decides whether the render
   question reopens.
2. **The selector** — select on free-running corrections on `_realval_v2` (or weight real val loss
   deliberately); keep `best` / `best-real` / `last`; add EMA and label smoothing, both unmeasured here
   and paired for that reason.
3. **The signature vote** — [../BACKLOG.md](../BACKLOG.md) item 9's script: where the vote disagrees
   with `data/makam_signatures.json`, send the rows to review instead of overwriting. The owner reads
   those rows.
4. **The third-source probe** — 20–40 pages from two new sites, ~200 hand-labelled strips, Run A
   scored on them. Candidate sites and the licence rule: [../DECISIONS.md](../DECISIONS.md)
   2026-08-20. Free labels only where `match_symbtr.py` finds the piece; sahaney.com filters by makam
   and form, which is how the tuplet-dense sirto/longa/saz semaisi pages come in — collect them
   **with** the vocabulary change or the same gate drops them.
5. **Re-emit the real pools** under scheme H + the label-budget rail at **b = 57** + a balanced
   packer ([../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md)). Needs a Colab decode: every
   cache is refused since `GEOMETRY_REV` 20260903. Then `verify-labels`, then the owner reads the
   audit sample and every `\sig` row — expect ~450 fixes in ~3,500 rescued strips at the measured
   12.9%.
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
