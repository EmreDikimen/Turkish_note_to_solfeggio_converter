# Open risks and non-claims

purpose: the standing caveats — what is measured but fragile, what is NOT claimed, and the traps that survive the work that found them
audience: anyone about to quote a number, believe a green check, or act on a result

updated: 2026-08-30

Split out of [STATUS.md](STATUS.md) on 2026-08-17 when that file crossed the 400-line cap. The split
is by genre: STATUS holds **current state and the next action** and nothing else; this file holds
**standing caveats**, which are neither. Nothing here is a next action, and nothing here is
history — for history see [log/status-log.md](log/status-log.md).

Rule that produced most of this file: a number without its caveat gets quoted later as if it were
solid. That has already happened once, when a 3-gold class swung a headline ~11 points.


- **NEW (2026-08-21): every `\sig` block in a real-page label is UNVERIFIED.** The key signature is
  the only part of a label not derived from SymbTr — the model reads it off each row-start strip and
  the **majority read overwrites the derivation**. The voter is the weak `rung3-labeler`, whose
  koma/küçük confusion is *systematic*, so the vote comes out unanimous **and** wrong; and the `nd`
  gate strips `\sig` blocks from both sides before comparing, so nothing catches it. It fired on
  **24 of 45 exam pieces (53%)**, **406 of 938** `strips_nota` pieces (43%), 98 of 293 `strips_tup`,
  26 of 65 `strips_r1`; **8 of the 36 exam pieces** with a signature disagree with our own makam
  table, several by *missing* an entry it calls near-universal. ⚠ Do not quote a per-class accidental
  number as if signatures were clean, and do not read the 9:1 `\komaSharp`:`\kucukSharp` imbalance as
  pure renderer defect — part of it may be this loop feeding itself. ⚠ **Not an error rate**: n = 7
  corrections in one makam, and many overrides are probably correct
  ([METRICS-CORPUS.md](METRICS-CORPUS.md) · [BACKLOG.md](BACKLOG.md) item 9).

- **NEW (2026-08-21): the training pools are the last thing still on the RETIRED slicer.** The exam
  was rebuilt on the current one and `_realval_v2` was already on it; `strips_nota` / `strips_r1` /
  `strips_tup` — **2,330 real training strips** — were not. Until they are re-emitted, a Round-3 model
  learns real-page appearance from crops the shipped slicer no longer produces, then is selected and
  graded on crops it does. Round 3's own Lever 1 measured crop geometry as **causal**, so this is a
  domain gap of the kind the round exists to close. Cost of fixing it is measured and low: **89% of
  the labels carry** onto the new crops by measure span, with no new labelling
  ([BACKLOG.md](BACKLOG.md) item 4).

- **NEW (2026-08-21): 96 labels enter the rebuilt exam's gold without any human having read them.**
  139 strips come straight from the emitter; 43 agree token-for-token with the frozen exam's hand-made
  gold, the other 96 have no such check. The reference point is exam v2's own audit: of its 63
  auto-accepted labels a human later corrected **32 (51%)**. They are the `examv3-full` tab, and
  reading them is a precondition of the read
  ([rung3/round3-criteria.md](rung3/round3-criteria.md) §3c).

- **NEW (2026-08-21): the rebuilt exam is a harder instrument than the floors were signed against.**
  ~12 candidate strips a page against 7.1, so the primary reads lower at equal model quality. The
  baseline re-score keeps the comparison fair; what the absolute 75% *means* is an open owner
  decision, and it must be settled before the read (§3c).

- **NEW (2026-08-15): the primary Round-3 floor is measured on 46 pages, so its 95% interval is
  roughly ±12 points.** ⚠ Superseded in its numbers by the rebuild — the exam is now 64 pages —
  but not in its point. A model truly at 72% can read 78% and vice versa. The criteria are signed and
  are **not re-opened**; what is still open, and is the owner's call **before** the read, is whether
  to grow the exam first (v3 is already owed) or to read it as signed and report the interval beside
  the result. Choosing after seeing the number is the one option that is not available.
  Reasoning: [rung3/levers.md](rung3/levers.md).
- **NEW (2026-08-15): the crop-geometry finding is observational.** ~40 strips a bucket, on crops cut
  by the retired slicer, and no causal test has run yet. Nothing renders on it until the padding
  probe reads. ⚠ The same file also records the trap in acting on it: narrow crops make the
  **short-crop hole** the common case, and short crops are the worst thing this model reads.
- **STILL OPEN: the cold-start fix is proven on a FAKED cold window, not on a genuinely idle
  service.** `check:coldstart` controls the window deliberately, which is the better test of the
  mechanism — but the real thing has still only been seen warm since the fix.
  ⚠ **It was briefly written up as closed on 2026-08-09 and that was wrong**, which is worth keeping
  because of *how* it was wrong. The redeploy's `smoke:live` did follow a real ~3 h idle and a real
  11.3 s cold start — but an **automated visitor** (`HeadlessChrome/131`, referer the unique deploy
  URL) hit the site seconds after the deploy went live and absorbed that cold start; `smoke:live`
  opened 33 s later and got `/health` in **2 ms**. A warm run was read as a cold one because only the
  wall clock was checked. **The bot is the standing obstacle**: it arrives right after every deploy,
  so a post-deploy `smoke:live` can never be the cold test. Measure it on an untouched service, and
  confirm from the request log which client caused the container start.
- **Three things now warm this service behind your back** — a demo recording (2026-08-08), a
  post-deploy crawler and the owner's own use. Any cold-start claim has to name the client that
  caused the `model ready` line, not just the elapsed time.
- **A busy instance is indistinguishable from a cold one at `/health`.** Concurrency is 1, so a
  second request during a decode gets a **fresh container** — `uptimeS` a handful of seconds, exactly
  what scale-to-zero looks like. Never read cold-start behaviour off a single `/health`; read the
  request log and the `model ready` lines together.
- **The in-browser fallback hides its own reasons.** Whenever the server is missed the page is still
  read correctly, so nothing looks broken — the only evidence is `data-where` and a warm laptop. That
  is what let the cold-start bug live from 2026-08-06 to 2026-08-08 in a fully "passing" deployment.
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
- **NEW (2026-08-14): a Round-3 model will differ from `round2-stage2-best` by four things, not one** —
  the corpus change, the **`staff_jitter` augmentation added 2026-07-29** (two days after Round 2
  trained; ±4% scale on 80% of samples, never A/B'd), a sub-visual **rasterizer drift** that moves
  every one of the 40,826 strips, and the training environment. This is why the tuplet A/B trains its
  own control instead of reusing the live model, and it is a caveat on Round 3's exam read too.
  Measurements: [METRICS-CORPUS.md](METRICS-CORPUS.md); reasoning:
  [rung3/round3-criteria.md](rung3/round3-criteria.md).
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
- **Every human who has used the deployed app was on a phone, and n is still 2.** That is **a
  question, not a finding** about "web first, mobile later" — two people cannot tell you what the
  next hundred will do. Moved here from STATUS on 2026-08-30: it is a standing non-claim, not a
  current state. [METRICS-USAGE.md](METRICS-USAGE.md).
- **Browser gate is 27/28** on the live model — one strip's *reference*-path decode drops a `\tup3`
  under an ORT-web int8 numerics wobble (the canvas/product path reads all 14 strips exactly, and
  Python-ORT int8 reads that strip exactly). Measured: the flipped token is a real 69/31 near-tie,
  the only sub-0.99 token in that strip, so the runtime tips a coin rather than corrupting a
  confident read. Not blocking; the strip stays in the gate list so the wobble stays measured.

