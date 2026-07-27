# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-07-27

## Now

**Phase 3 (real pages).** Synthetic reading is solved; every open problem is about real printed
pages and photos of them.

- **The goal changed on 2026-07-27: ≥90% of pages need ≤5 corrections, and the app shows where they
  are** ([ROADMAP.md](../ROADMAP.md) §0). Model accuracy is now a diagnostic, not the target.
  Baseline: **57% of pages ≤5** (median 5, mean 12.2, 52% of strips already perfect). The second
  half — surfacing *where* the model is unsure — **is deferred by the owner (2026-07-27)**; the work
  is therefore on reducing errors, and the evidence for what to reduce is below.
- **Round 2 was read once on 2026-07-27. Its apparent regression was a METRIC ARTIFACT, and it
  SHIPPED the same day** as an improvement, not a pass. The macro headline fell 78.0 → 73.9% mean
  AEU F1, but that average gives a 14-gold class the same weight as a 145-gold one. Re-scored on the
  identical strips with low-n-robust measures: **micro recall 83.9 → 84.8%**, **macro≥30 recall
  81.4 → 84.8%**, micro F1 85.0 → 84.8% — flat-to-better, on top of SER 0.059 → 0.052, exact-match
  50.0 → 52.1% and 9 of 11 floors.
- **Live model is `round2-stage2-best` int8** (shipped 2026-07-27). Ship chain all green — parity
  14/14 fp32 + 14/14 int8, browser gate 27/28 with the product (canvas) path clean 14/14. Runtime in
  `apps/web/public/models/`; the Round-1 runtime is backed up at
  `data/checkpoints/_public_models_backup_round1/` (revert = re-stage it).
- **Every eval now reports MICRO and MACRO≥30 beside the macro mean**, and past runs can be
  back-filled with `scripts/rung3/rescore_headline.py` without re-running a model. The macro mean
  stays the pre-registered bar — micro was computed after the fact and flatters us, so promoting it
  now would be moving the goalposts ([DECISIONS.md](DECISIONS.md)).
- **Accidentals are only 13% of what a user has to fix.** Classifying all 562 exam edits: pitch 40%,
  duration 28%, rhythm signs 13%, **accidentals 13%**, structure 5%. Two rounds went into the 13%,
  because the old headline only measured accidentals. Pitch and duration have never been targeted by
  any synthetic work.
- **The worst failures are a crop-shape gap we created.** `stripExport` builds chunks from whole
  measures, so a "clef + donanım, no notes" image cannot occur in training — **0 of 40,826 strips** —
  but the slicer produces them from real pages (4 of 326 exam strips; 28% are short). On one the
  model hallucinated a whole measure: 19 edits against 8 gold tokens. 12 such strips carry **21% of
  all edits**.
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

**Round 3 is planned in [rung3/round3.md](rung3/round3.md)** — it targets note heights (40% of
corrections) and note lengths (28%), with four measurements to run before anything is rendered.
Items 1–3 below are those measurements.

1. **Render the crop shapes the slicer actually produces.** Signature-only crops, short fragments,
   row-start-only windows — currently 0 of 40,826 training strips, while the slicer emits them from
   real pages and the model hallucinates a measure when it meets one. A `stripExport` change, no
   training required, and 21% of all edits sit in the strips it would fix. Cheapest item here.
2. **Measure the corpus's PITCH and DURATION distribution against the real pools** — octave range,
   note-value mix, dotted/tied values, measure density — the same way print position was measured
   for accidentals. That method has overturned the plan twice, and both times the answer was a
   mismatch we had created. Do this BEFORE designing Round 3. Note that 55 note-level errors are
   whole notes inserted or deleted (the model losing count), which points at density and crop-width
   coverage rather than glyph quality.
3. **Round 3, aimed at pitch and duration** (68% of edits), not accidentals (13%).
4. **Deferred by the owner (2026-07-27): the error-localisation UI.** The measurement that would
   justify it is cheap and still owed — per-token logprobs already come out of
   `onnx_greedy_decode(return_logprobs=True)` and `decode_page.py` throws all but min/mean away.
   Pre-registered rule if it is ever picked up: flagging 10% of tokens must catch ≥60% of errors.
5. **Measure the SIGNATURE-packed sharp glyphs.** Every fidelity measurement we have (`sharp_probe`,
   the 0.300 S bar weight, küçük's pitch widened to 0.65 S) was taken on INLINE glyphs. Signature
   glyphs are packed at `SIG_GLYPH_ADVANCE = 13 px`, have never been examined, and hold 32 of the
   exam's 33 küçük tokens — widening küçük's bars may actively hurt where horizontal room is fixed.
   Now a 13%-of-edits problem, so it sits below the pitch/duration work.
6. **Rebuild real-val to match exam composition.** Today's real-val is missing the hard tier
   entirely, which is why it read 95% while the exam read 66%. It does **not** need to be
   edition-disjoint (measured), but it must exclude decode-derived labels from the metric pool, and
   its hard tail must be hand-verified. Reuse `data.is_real_val_piece` — both consumers must share it.
7. **Exam v3.** Owed: the 27 over-budget strip recoveries deferred from v2.1, re-validation of
   disjointness whenever the exam grows, and dedupe on SymbTr piece id rather than image stem. Also
   more `\komaSharp` gold — at n=14 the class cannot carry the weight the headline gives it. The
   train-time disjointness guard is already shipped; give v3 a one-time `round1-best` bridge read as
   its baseline. (The low-n weighting it also owed was done on 2026-07-27.)
8. **Extend the train-time exam guard to the SYNTHETIC corpus.** It inspects only the `--real-dir`
   pools today, which is how 5 exam pieces sat in `strips_v3`. `select_pieces.py --exam` now blocks
   them at selection, but the training guard should refuse them too.

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 numerics
investigation — now two instances, a dropped double dot (Round 1) and a dropped `\tup3` (Round 2),
both reference-path only and both fine under Python-ORT int8.

## Open risks and non-claims

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
- **The correction-loop strategy is now the plan, not a fallback** (goal change 2026-07-27). What is
  still unmeasured is whether error localisation actually saves a user time — that needs a person
  correcting real pages with and without the highlights, not a model metric.
- **Superseded:** there is no pre-registered pivot trigger. Switching to a correction-loop strategy is a
  situational call after the Round-2 exam, not an automatic rule.
- **Browser gate is 27/28** on the live model — one strip's *reference*-path decode drops a `\tup3`
  under an ORT-web int8 numerics wobble (the canvas/product path reads all 14 strips exactly, and
  Python-ORT int8 reads that strip exactly). Measured: the flipped token is a real 69/31 near-tie,
  the only sub-0.99 token in that strip, so the runtime tips a coin rather than corrupting a
  confident read. Not blocking; the strip stays in the gate list so the wobble stays measured.

## Where the detail is

| For | Read |
|---|---|
| Every number, with its date and source | [METRICS.md](METRICS.md) |
| Why a thing was decided, and what overturned it | [DECISIONS.md](DECISIONS.md) |
| The real-page track, step by step | [rung3/README.md](rung3/README.md) |
| Round 1 in full (criteria → A/B → exam → disposition) | [rung3/round1.md](rung3/round1.md) |
| Round 2 so far (photos, sharps, what's open) | [rung3/round2.md](rung3/round2.md) |
| Round 3: what it targets and the checks to run first | [rung3/round3.md](rung3/round3.md) |
| Dated history of everything | [log/status-log.md](log/status-log.md) |
| Plans that were abandoned — do not act on them | [log/superseded.md](log/superseded.md) |
| Plain-English version of this page | [OVERVIEW.md](OVERVIEW.md) |
| How to update this file (and the others) | [MAINTAINING.md](MAINTAINING.md) |
