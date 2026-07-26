# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-07-26

## Now

**Phase 3 (real pages).** Synthetic reading is solved; every open problem is about real printed
pages and photos of them.

- **Live model: `round1-best` int8**, shipped 2026-07-23 as *"an improvement, not a pass"* — it
  missed 5 of its pre-registered floors but strictly beats the previous model on everything tracked.
  Runtime lives in `apps/web/public/models/`; the previous one is backed up at
  `data/checkpoints/_public_models_backup_rung22/`.
- **The photo domain is basically solved.** The wall was the slicer, not the model: a guarded photo
  front-end (deskew + crop/de-warp + a narrower staff kernel) took yield from 28% to 97% of pages,
  and hand-labelled photo strips score within ~3–4pp of clean pages.
- **The real weakness is the microtonal sharps** — and as of 2026-07-26 we know why: **our own
  renderer**. Bravura draws the sharp bars too thick and packs küçük's three bars too close, so after
  the encoder's shrink they fuse into a block that *is* a 2-bar koma. Fixed at source with
  `drawThinSharps`, shipped **opt-in** (`?thinsharps=1` / `--thin-sharps`) so an A/B against
  `strips_v3` stays possible.
- **The exam's own answer key was re-audited** (13 errors, all over-sizing sharps). The headline rose
  ~12pp, but ~11pp of that is a low-n scoring artifact, not the model improving.

Numbers for all of the above: [METRICS.md](METRICS.md). Why things were decided this way:
[DECISIONS.md](DECISIONS.md).

## Next — in order

1. **Re-render the synthetic corpus for sharp discrimination.** This is the one open model lever.
   It needs three things at once:
   - `--thin-sharps` **on** (real-print bar weight);
   - **balanced frequency** — `strips_v3` has `\komaSharp` inline in 1,887 strips vs `\kucukSharp` in
     206, so the model rarely sees the rare one;
   - **contrast in one image** — no strip currently holds both, so put koma / küçük / bakiye on
     neighbouring notes and force the model to compare rather than guess the common class.
   Then audit coverage, Mac train smoke, and a Colab run.
2. **Rebuild real-val to match exam composition.** Today's real-val is missing the hard tier
   entirely, which is why it read 95% while the exam read 66%. It does **not** need to be
   edition-disjoint (measured), but it must exclude decode-derived labels from the metric pool, and
   its hard tail must be hand-verified. Reuse `data.is_real_val_piece` — both consumers must share it.
3. **Exam v3.** Owed: a low-n floor or weighting on the per-class mean (one 3-gold class swung the
   headline ~11pp), the 27 over-budget strip recoveries deferred from v2.1, re-validation of
   disjointness whenever the exam grows, and dedupe on SymbTr piece id rather than image stem. The
   train-time disjointness guard is already shipped; give v3 a one-time `round1-best` bridge read as
   its baseline.
4. **Round 2 training** on the above, then the exam **once**, then the ship chain
   (ONNX → int8 parity → browser gate).

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 double-dot
investigation.

## Open risks and non-claims

- **Real-val orders candidates; it does not predict exam performance.** Measured gap: 28pp.
- **The AEU headline is a per-class mean and is fragile to low-n classes.** A 3-gold class has
  swung it ~11pp. Quote F1 and per-class numbers alongside it.
- **The carry-sig bug is unfixed:** under a signature the model re-states the alteration inline in
  the wrong koma family. It reproduces on synthetic, so it can be iterated on with perfect labels —
  it plausibly explains both the `\komaFlat` precision miss and the komaSharp↔kucukSharp confusion.
- **Label noise in the training pools:** ~7% pitch-level content error in nota auto-accepts, ~38%
  structurally noisy tie annotation. A 5% re-audit after Round 1 is owed.
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
