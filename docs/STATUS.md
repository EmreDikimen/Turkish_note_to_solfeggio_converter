# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-07-27

## Now

**Phase 3 (real pages).** Synthetic reading is solved; every open problem is about real printed
pages and photos of them.

- **Round 2 was read once on 2026-07-27 and is NOT shipped.** The headline regressed — mean AEU F1
  **78.0 → 73.9%** against `round1-best` on the identical 326 strips with identical gold — while SER,
  exact-match and 9 of 11 floors improved. A model whose headline moves backwards doesn't inherit
  Round 1's "improvement, not a pass" argument. Checkpoint kept at
  `data/checkpoints/round2-stage2-best/`.
- **Live model is still `round1-best` int8** (shipped 2026-07-23). Runtime in
  `apps/web/public/models/`; previous one backed up at `data/checkpoints/_public_models_backup_rung22/`.
- **The sharp diagnosis was right and incomplete.** The label-noise fix killed the one-directional
  küçük→koma fallback exactly as predicted, and küçük-in-signature went **50 → 72%**. What it exposed
  underneath is a **symmetric** koma↔küçük confusion — 8× one way, 7× the other, **all 15 inside the
  `\sig` block**, net `\komaSharp` emission 0. Not a bias any more: a discrimination failure. It
  wrecks `\komaSharp` (F1 21.4%) because n=14, and a six-class mean carries that into the headline.
- **The sharps are read in the KEY SIGNATURE, not on noteheads** (exam gold: 32 in-signature vs 1
  inline). `eval_omr.py` now reports recall split by print position — that split is the only reason
  the signature-only confinement was visible.
- **The photo domain is basically solved.** The wall was the slicer, not the model: a guarded photo
  front-end took yield from 28% to 97% of pages, and hand-labelled photo strips score within ~3–4pp
  of clean pages.
- **`strips_v4` is built and verified** — 40,826 strips / 202 pieces, thin sharps + the
  pixels-vs-labels fix + 23 küçük-bearing pieces − 5 exam pieces; `verify-labels.ts` clean, audit
  PASS. It is sound data; the corpus is not what failed.

Numbers for all of the above: [METRICS.md](METRICS.md). Why things were decided this way:
[DECISIONS.md](DECISIONS.md). Round 2 in full: [rung3/round2.md](rung3/round2.md).

## Next — in order

1. **Measure the SIGNATURE-packed sharp glyphs before rendering anything.** Every fidelity
   measurement we have (`sharp_probe`, the 0.300 S bar weight, küçük's pitch widened to 0.65 S) was
   taken on INLINE glyphs. Signature glyphs are packed at `SIG_GLYPH_ADVANCE = 13 px`, have never
   been examined, and hold **32 of the exam's 33 küçük tokens**. Widening küçük's bars may actively
   hurt where horizontal room is fixed. Measure real printed donanım against ours at matched staff
   size, the same way `sharp_probe` did for inline glyphs — then decide whether to re-render.
2. **Fix the headline's low-n fragility before the next exam.** `\komaSharp` at n=14 swung it 4pp
   this round; a 3-gold class swung it 11pp last round. Either weight the per-class mean or set a
   minimum-n floor, and pre-register it BEFORE Round 3 is read — not after seeing a number.
3. **Rebuild real-val to match exam composition.** Today's real-val is missing the hard tier
   entirely, which is why it read 95% while the exam read 66%. It does **not** need to be
   edition-disjoint (measured), but it must exclude decode-derived labels from the metric pool, and
   its hard tail must be hand-verified. Reuse `data.is_real_val_piece` — both consumers must share it.
4. **Exam v3.** Owed: the 27 over-budget strip recoveries deferred from v2.1, re-validation of
   disjointness whenever the exam grows, and dedupe on SymbTr piece id rather than image stem. Also
   more `\komaSharp` gold — at n=14 the class cannot carry the weight the headline gives it. The
   train-time disjointness guard is already shipped; give v3 a one-time `round1-best` bridge read as
   its baseline. (The low-n weighting it also owed is now item 2, since Round 3 needs it first.)
5. **Extend the train-time exam guard to the SYNTHETIC corpus.** It inspects only the `--real-dir`
   pools today, which is how 5 exam pieces sat in `strips_v3`. `select_pieces.py --exam` now blocks
   them at selection, but the training guard should refuse them too.

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 double-dot
investigation.

## Open risks and non-claims

- **Real-val orders candidates; it does not predict exam performance.** Measured gap: 28pp.
- **The AEU headline is a per-class mean and is fragile to low-n classes.** A 3-gold class swung it
  ~11pp in Round 1; a 14-gold class swung it 4pp in Round 2 and is the entire reason that round
  reads as a regression. Quote F1 and per-class numbers alongside it.
- **The carry-sig bug is unfixed:** under a signature the model re-states the alteration inline in
  the wrong koma family. It reproduces on synthetic, so it can be iterated on with perfect labels.
  Round 2 weakens the old guess that it explains the komaSharp↔kucukSharp confusion: that confusion
  is now symmetric and confined to the `\sig` block, which looks like a glyph-discrimination
  problem rather than a carry-resolution one.
- **Round 2's three changes are not separable.** Glyph weight, label noise and corpus size all moved
  together, so nothing in that read attributes to one of them.
- **Label noise in the training pools:** ~7% pitch-level content error in nota auto-accepts, ~38%
  structurally noisy tie annotation. A 5% re-audit after Round 1 is owed.
- **Signature-position vs note-position accuracy is UNMEASURED.** Every per-class number pools both,
  and for the microtonal sharps the gold is almost entirely in the signature. The scoring split that
  makes this answerable is owed.
- **Blind spots, stated as non-claims:** `\buyukFlat` has 0 real gold; `\komaSharp`/`\buyukSharp` are
  low-n on the exam; `\tup3` is measured on the common k=1 case only; the exam is a matched
  upper bound (its pieces exist in SymbTr).
- **There is no pre-registered pivot trigger.** Switching to a correction-loop strategy is a
  situational call after the Round-2 exam, not an automatic rule.
- **Browser gate is 19/20** on the live model — one double-dot token trips an ORT-web int8 numerics
  wobble (model-independent, not blocking).

## Where the detail is

| For | Read |
|---|---|
| Every number, with its date and source | [METRICS.md](METRICS.md) |
| Why a thing was decided, and what overturned it | [DECISIONS.md](DECISIONS.md) |
| The real-page track, step by step | [rung3/README.md](rung3/README.md) |
| Round 1 in full (criteria → A/B → exam → disposition) | [rung3/round1.md](rung3/round1.md) |
| Round 2 so far (photos, sharps, what's open) | [rung3/round2.md](rung3/round2.md) |
| Dated history of everything | [log/status-log.md](log/status-log.md) |
| Plans that were abandoned — do not act on them | [log/superseded.md](log/superseded.md) |
| Plain-English version of this page | [OVERVIEW.md](OVERVIEW.md) |
| How to update this file (and the others) | [MAINTAINING.md](MAINTAINING.md) |
