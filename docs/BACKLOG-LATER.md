# Backlog, further out — real, justified, and not this round

purpose: the deferred work that is NOT near-term — density levers, exam v3's owed items, the signature-packed sharp glyphs, and the rest; kept out of BACKLOG.md so that file holds only what could plausibly be picked up next
audience: agents with spare capacity, or anyone asking "why was this deferred and what would restart it"

updated: 2026-09-03

Split out of [BACKLOG.md](BACKLOG.md) on 2026-08-26 at the 400-line cap. Phase split: that file
holds **what could be picked up next**; this one holds **what is deferred past this round**. Nothing
was dropped in the move, and the same warning applies to both — ⚠ **this is not a queue to work
down.** Each item carries the reason it is deferred; read it before starting. Abandoned plans live in
[log/superseded.md](log/superseded.md) and must never be acted on.

### Further out (not next, not cancelled)

0. **THE DENSITY LEVERS — all deferred 2026-08-22, and all deliberately NOT in Round 3.** They came
   out of the "the app returns wrong notes on dense pieces" session
   ([METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md)). Splitting dense windows into single
   measures fixes **44.3%** of the failure class; these four are what the rest needs, and none of them
   is small:
   - **A per-notehead ink counter.** Today's `est_tokens` counts *stems*, and a stem does not carry
     the cost — `d''16` is 5 ids, `g'4` is 3. The two things that vary are **67% of the budget**
     (octave marks 37.6%, duration digits 29.8%) and both are visible ink: octave marks are the
     notehead's height against `top_y`, duration digits are the beam/flag count. A counter shaped
     `1 + octave_marks(y) + duration_digits(beams)` mirrors the tokenizer instead of approximating it.
     ⚠ Not needed for splitting — a false split is nearly free — so this is only worth it if a
     *gate* is ever wanted. Test set exists: 7,967 strips with exact id counts, minus the ~38% whose
     labels are physically impossible.
   - **Splitting INSIDE a measure.** `_split_wide` already cuts at zero-ink gutters, so the pixels are
     solved. The blocker is the emitter: it drops every `split_wide` strip unconditionally
     (`emit_strip_labels.py`) — **10,226 of b8's 24,837 drops, the single biggest reason** — because
     labels are derived by whole **measure spans** and half a measure has no span to match. Needs
     partial-measure alignment, which is a project.
   - **Note-spelling tokens — now specified and costed: [rung3/tokenization.md](rung3/tokenization.md)**
     (2026-08-27). The best long-term fix for density and the one with the largest measured headroom:
     at compact spelling the exam queue's over-budget rows fall **72 → 17 of 661** with the slicer
     untouched. ⭐ **Only 4 ids are missing** (`''`, `'''`, `16`, `32`) and they take a real label to
     **78%** of its length and rescue **2,410 of the 4,012 over-budget strips** (measured). ⚠ **A
     16-token variant that also fuses the 14 common letter+octave pitches rescues 3,508** — the
     4-vs-16 choice is open ([DECISIONS.md](DECISIONS.md), 2026-08-27). ⭐ **No label conversion is
     involved** — the text is unchanged, only the tokenizer's segmentation. Ids are append-only so it is *allowed*; it needs a retrain to be
     *used*. ⚠ **Do it in the same re-emit as the rail below**, not as its own round — both re-emit
     the pools. Round 4. ⏭ **PICKED UP 2026-09-03**: scheme H recommended (owner to confirm), no
     re-render this round, `\tupend` stays — [rung3/round4.md](rung3/round4.md).
   - **Raising the 59-id budget** — DROPPED for Round 3 (see [DECISIONS.md](DECISIONS.md)); the
     measured benefit is kept in item 7 below.
   - ⭐ **THE RAIL ITSELF, AS A PAIR — the Round-4 headline** (owner, 2026-08-23). Measured and
     decided: the rail at *inference alone* is a wash (15.7% → 16.6%, p = 0.57), because it was
     tested on a model that has never been trained under it. Its real payoff is that a split strip
     **fits the 59-id emitter gate and enters training** — today 4,012 over-budget strips are simply
     dropped. The experiment is three steps and none is a research question: **re-emit the pools
     with the rail at b=57 → train → measure with `measure_fill_score.py`**, which is built and
     calibrated (7.6% false-alarm floor on gold). ⚠ **b=57, not 50** — recovery is flat b=40..59, so
     the value rides on over-splitting cost alone, and 50 makes 162 needless cuts
     ([METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md)). ⚠ **Turn it on in the training emit
     and the shipping slicer TOGETHER**, or the train/test mismatch B8 existed to close comes back.
     ⚠ The thing to verify after the retrain is that **non-dense pages do not regress** — that is an
     assumption today, not a measurement. ⚠ Doing this re-cuts the exam, which is exactly why it was
     kept out of Round 3. ⏭ **Round 4, b = 57, in the same re-emit as the tokens; the exam stays
     `examv3` as the comparable column and the rescued dense strips form a SEPARATE column**
     ([rung3/round4.md](rung3/round4.md) steps 5 and 8).

1. **DONE (2026-07-31): every consumer reads `_realval_v2`** — pointing an eval at
   `make_realval_pool.py`'s `_realval` output silently restores the no-hard-tier pool. ⚠ The owner's
   130 v1 verdicts (65 ok / 22 fix / 43 bad) did **not** transfer; what they bought is the confidence
   calibration and the 33% crop-failure rate that sized the v2 queue ([log/status-log.md](log/status-log.md)).

2. **The error-localisation UI — deferred 2026-07-27, then DROPPED as W8 on 2026-08-05.** The
   measurement is done and it is the reason it was dropped: flagging 10% of tokens catches 26.3% of
   errors against a ≥60% bar. Per-token logprobs already come out of
   `onnx_greedy_decode(return_logprobs=True)`; `decode_page.py` still throws all but min/mean away.
   If it is ever picked up again, per-TOKEN localisation is the version worth building.
3. **Measure the SIGNATURE-packed sharp glyphs.** Every fidelity measurement we have (`sharp_probe`,
   the 0.300 S bar weight, küçük's pitch widened to 0.65 S) was taken on INLINE glyphs. Signature
   glyphs are packed at `SIG_GLYPH_ADVANCE = 13 px`, have never been examined, and hold 32 of the
   exam's 33 küçük tokens — widening küçük's bars may actively hurt where horizontal room is fixed.
   Now a 13%-of-edits problem, so it sits below the pitch/duration work.
4. **Exam v3.** Owed: the 27 over-budget strip recoveries deferred from v2.1, re-validation of
   disjointness whenever the exam grows, and dedupe on SymbTr piece id rather than image stem. Also
   more `\komaSharp` gold — at n=14 the class cannot carry the weight the headline gives it. The
   train-time disjointness guard is already shipped; give v3 a one-time `round1-best` bridge read as
   its baseline. (The low-n weighting it also owed was done on 2026-07-27.)
   ⚠ **ADDED 2026-08-20 — the exam's crops are OLD-SLICER output too** (`strips_exam_v2_clean`, cut
   **17 July**, against the 25/29 July overhaul), so **the launch gate is measured on crops the
   shipped slicer no longer produces** ([METRICS-CORPUS.md](METRICS-CORPUS.md)). That is a decision to
   take **before** the one-shot read, not after — re-cutting the exam afterwards would either waste
   the shot or invite re-reading it, and the one-shot rule is what makes the number mean anything.
   ⚠ It cuts both ways and neither direction is measured: the exam carries retired defects the
   current slicer has fixed (flattering), while crops over 1200 px went **13.8% → 27.8%** on the same
   67 pages under the new slicer, so production sits further into the bad end than the exam shows
   ([METRICS-GEOMETRY.md](METRICS-GEOMETRY.md)). ⚠ Growing the exam and re-cutting it are the same
   job — do them in one pass or the disjointness re-validation runs twice.
5. **Extend the train-time exam guard to the SYNTHETIC corpus.** It inspects only the `--real-dir`
   pools today, which is how 5 exam pieces sat in `strips_v3`. `select_pieces.py --exam` now blocks
   them at selection, but the training guard should refuse them too.

6. **⬆ THE FEATURE TRACK LEFT THIS SECTION on 2026-08-15**, and finished on 2026-08-16 — F0, F2, F1
   and F3 are all built. This line stays only to say where it went: [features/README.md](features/README.md).
   ⚠ One caveat from here still holds and is recorded there: F3 was supposed to be aimed by what the
   friends say next, and it was built on the owner's own call instead — they were asked once (W10),
   said "more instrument sounds", and F1 delivered that. **The audio is settled** (2026-08-09): drums,
   clarinet, violin and kanun all shipped under **CC0**, licences read per file, no NC anywhere;
   **ney alone** still needs the owner's own recording, and oud and tanbur stay Karplus–Strong.
   Files: [features/audio-sources.md](features/audio-sources.md).

**NEW 2026-08-25 — THE LISTENING MIRROR: a live microtonal tuner on the fingerboard. Explicitly
NOT audio-to-score.** The owner asked whether the app could take a TSM recording, transcribe the
notes, identify the instruments and say how to play it. The answer splits in two, and **only the
small half is queued here**; the other half is written down below so it is not re-proposed.

- **What is deferred here.** Microphone in → per-frame f0 (fundamental frequency — the pitch being
  sounded) from a classic autocorrelation tracker (YIN/pYIN) in an `AudioWorklet` → cents against a
  chosen karar (tonic) → koma → the F3 marker draws where that finger is. Optionally scored against
  a loaded piece: *you played N komas above segah*. The player-facing pitch of it is that komas are
  the hardest thing to hit by ear and the one thing a learner cannot see.
- **Why this half is cheap: the downstream half is already built.** `positionOnString(openHz,
  noteHz)` in [../packages/core/src/fingering.ts](../packages/core/src/fingering.ts) already takes
  **Hz**, so a measured frequency feeds the existing fingerboard with no new arithmetic;
  `centsAboveRef` / `koma53ToFreq` in [../packages/core/src/tuning.ts](../packages/core/src/tuning.ts)
  own the 53-TET side and only need inverting. New code is **one audio-analysis module**, not a
  pipeline.
- ⭐ **It keeps the feature track's defining property** (see [features/README.md](features/README.md)):
  no ML, no GPU, no server, no training data — **and no gold labels**, which is the real saving. A
  tuner has no answer key to build: it reports the frequency it hears. Every expensive thing about
  the OMR track is the answer key.
- ⚠ **The one question that decides whether it is honest, and it is UNMEASURED**: a koma is
  **22.6 cents** (1200/53), and ney/violin vibrato can swing wider than that. So the first thing to
  do if this is picked up is check whether a browser YIN holds a koma steady on a real tone — not
  write the UI. If it cannot, the display needs smoothing and the claim needs weakening.
- ⚠ **The arithmetic stays out of the browser**, same house rule as F3: position formula and
  string choice live in `packages/core` and are pinned by
  [../tools/core/fingering-test.ts](../tools/core/fingering-test.ts).
- ⛔ **NOT THIS ITEM — blind transcription of an ensemble recording (AMT).** Four reasons, none of
  them small: TSM ensemble texture is **heterophonic** (everyone plays the same line at once with
  different ornaments), which is the worst case for onset and multi-f0 detection; ornaments —
  çarpma, glissando, vibrato — read as spurious notes; free-rhythm taksim and elastic ağır usuls
  defeat beat tracking; and every off-the-shelf transcriber emits **MIDI on a 12-semitone grid**,
  which quantises away the komas this project exists for. The training data would also be
  copyrighted recordings — the same licence family as SymbTr's NC clause
  ([THIRD-PARTY.md](THIRD-PARTY.md)). ⚠ **Unverified, from memory, check before quoting**: the
  CompMusic/MTG makam work — the circle SymbTr came out of — appears to have gone mostly to
  audio-**score alignment** rather than blind transcription, which would be evidence in the same
  direction.
- ⛔ **NOT THIS ITEM — instrument detection.** It is the weakest part of the original idea. Pretrained
  instrument taggers are Western-trained and carry little or no ney / kanun / ud / tanbur / kemençe
  vocabulary, so it needs its **own labelled audio corpus** — a second labelling loop of the kind
  that has cost this project the most. And it buys nothing a picker does not: the player knows which
  instrument they are holding, and F3 already has the picker.
- ⏭ **Sequenced by the owner (2026-08-25): after the public launch, once the shipped app is working
  well.** It touches no training data, no exam and no round, so it can never be the thing that
  delays one. Effort is **a guess, not an estimate** — nothing here is measured.

**TWO SMALL UI ITEMS, MOVED OFF THE README on 2026-08-25**, when it was rewritten as a user-facing
front page. Left unnumbered on purpose: item 0 above already points at "item 7", meaning the 59-id
budget item in the section above this one. This file was their only home, so they are kept here:

- **The rest of the settings modal.** The sheet view's **Accidentals** selector already covers the
  display-mode half of the idea (every note / row-start key signature / standard per-measure). Still
  missing: one settings surface holding the view choice (sheet vs instrument) and a **dark/light
  theme** switch.
- **The sheet view scrolls twice** — an inner scroll inside the score card, on top of the page
  scroll. The owner asked for the inner one to go.

Also queued, cheap: the additive-only re-slice (deferred here from Round 1 — see
[log/superseded.md](log/superseded.md) for its constraints), and the ORT-web int8 numerics
investigation — now two instances, a dropped double dot (Round 1) and a dropped `\tup3` (Round 2),
both reference-path only and both fine under Python-ORT int8.

