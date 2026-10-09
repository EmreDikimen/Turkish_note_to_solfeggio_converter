# Open risks and non-claims

purpose: the standing caveats — what is measured but fragile, what is NOT claimed, and the traps that survive the work that found them
audience: anyone about to quote a number, believe a green check, or act on a result

updated: 2026-10-08

Split out of [STATUS.md](STATUS.md) on 2026-08-17 when that file crossed the 400-line cap. The split
is by genre: STATUS holds **current state and the next action** and nothing else; this file holds
**standing caveats**, which are neither. Nothing here is a next action, and nothing here is
history — for history see [log/status-log.md](log/status-log.md).

Rule that produced most of this file: a number without its caveat gets quoted later as if it were
solid. That has already happened once, when a 3-gold class swung a headline ~11 points.

Resolved caveats are archived verbatim in [archive/risks-closed.md](archive/risks-closed.md) (2026-10-08).

- **NEW (2026-09-19): AN EDIT COUNT IS ONLY COMPARABLE INSIDE ONE VOCABULARY, AND INSIDE ONE POOL.**
  Scheme H spells a note in fewer ids, so in its own ids the same mistake costs an H model ~1.1 fewer
  edits per strip — the training logs read 280 for H against 396 for the control on the same strips
  where a shared ruler shows no difference. ⛔ Never set two vocabularies' `EDITS` side by side;
  `paired_arm_score.py --score-vocab old` is the only comparison, and `eval_omr.py` has no such mode
  yet. ⚠ **And absolute rates travel no better between pools**: 0.16–0.41 edits/strip on
  `_denseval_h1*` against 1.45–1.57 on `_realval_v2r` is label provenance and the `nd` acceptance
  gate, not difficulty. Only paired differences within one pool mean anything.
  [METRICS-ROUND4-AB.md](METRICS-ROUND4-AB.md).
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
  ([METRICS-HANDTEST.md](METRICS-HANDTEST.md) · [rung3/round4.md](rung3/round4.md)).
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
  counts as a pass BEFORE the read ([METRICS-EXAMSET.md](METRICS-EXAMSET.md)).
- **NEW (2026-08-21, narrowed 2026-09-06): `\sig` blocks in the EXAM and in every pool before
  `strips_h1` are UNVERIFIED.** The key signature is the only part of a label not derived from SymbTr:
  the model reads it off each row-start strip and, before rule D, the **majority read overwrote the
  derivation**. The voter's koma/küçük confusion is *systematic*, so the vote came out unanimous
  **and** wrong, and the `nd` gate strips `\sig` blocks before comparing. It fired on **24 of 45 exam
  pieces (53%)** and **406 of 938** `strips_nota` pieces (43%). ✅ Rule D now routes a vote that
  deletes or changes an accidental off the makam table's majority spelling to review — applied in the
  `strips_h1` emit; ⚠ **the exam was not re-emitted**, so part of the exam's signature error class
  (17.5% of Round 3's edits) may be bad gold rather than bad decoding. ⚠ Not an error rate
  ([METRICS-SIGVOTE.md](METRICS-SIGVOTE.md) · [METRICS-CORPUS.md](METRICS-CORPUS.md)).
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
  `STATS_SALT` is set ([features/visit-stats.md](features/visit-stats.md)); before it, the request log
  saw two strangers, both on phones (n = 2, [METRICS-USAGE.md](METRICS-USAGE.md)). The phone became
  the main screen on 2026-09-19 on the owner's own use, not on this number.
- **Browser gate is 26/28** on the live model (`r4-ctl-stage2-last`, since 2026-10-08) — one strip,
  `kurdilihicazkar…bunca_cevrinle`, drops its `\tup3` on both the reference and the canvas path: an
  unbalanced tuplet, the class the owner accepted on 2026-09-03 because the stitcher brackets an
  unclosed run. ⚠ `gate.json` is gitignored and `make_browser_gate.py` regenerates it, so the
  tie-free fix of 2026-10-08 must be re-applied after any re-staging ([METRICS-ONNX.md](METRICS-ONNX.md)).
  ⚠ The 14 gate strips are SYNTHETIC; on real strips int8 disagrees with its own fp32 weights on
  ~1 in 10, and no accuracy number in this project is measured on int8.
