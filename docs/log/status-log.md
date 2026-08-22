# Status log — what happened, when

purpose: append-only dated record of completed work; the raw material behind STATUS.md
audience: agents reconstructing why the code looks the way it does
updated: 2026-08-22

**Newest first.** This file is history: it records what was true on a date, not what to do now.
Current state → [../STATUS.md](../STATUS.md). Abandoned plans → [superseded.md](superseded.md).

## 2026-08-22 (latest) — the b8 guard is a quarter read, and it is holding up so far

Found during a doc sync: `strips_b8/emit_audit.csv` had been worked on the evening of 2026-08-21
(mtime 23:57, after the 21:59 emit) while every doc still said the audit was **unread**. **58 of 201
rows are judged: 49 ok, 9 fix — 15.5% wrong.**

⚠ **Interim, and the queue is live** — it moved from 58 to 88 judged over the day, so the rate in
[METRICS-CORPUS.md](../METRICS-CORPUS.md) is a snapshot and the tab badge is the truth. What makes it
worth writing down anyway is that the read is not skimmed: the audit sample is shuffled (not ordered
by piece, `nd` or logprob), and the judged rows' mean `nd` is **0.019** against **0.018** for those
still open. So the easy rows were not cherry-picked — this is a fair early look, not a best case.

**Where it sits.** Against exam v2's 51% and exam v3's 13.7% on the same kind of queue, ~13% is much
nearer the good end. That is the answer B8 was waiting on — the referee argument (one strong model
doing both emitter jobs) does not appear to have bought its +70% yield with a collapse in label
quality. ⚠ It does not close the question: 143 rows left, and the referee was trained on these very
labels at 9× oversampling, so its agreement is partly memory.

**What the first 9 fixes were**, because the mix matters more than the rate at this n: 3 pitch errors,
2 rhythm, 2 the known tie/rest convention (`g''2 \tie g''8` → `g''4. g''4`), 1 missing `\repstart`,
and 1 **spurious `\sig \komaFlat b \sigend`** — the model-voted key signature of
[BACKLOG.md](../BACKLOG.md) item 9 showing up again, in a fresh pool, as a whole signature block
invented over what should have been a rest. Two of the nine are therefore not new failures but two
already-open items appearing in b8.

## 2026-08-22 — the corpus is two websites, and that is now written down

The owner asked whether any strip comes from another sheet-music source — TRT, divanmakam, şarkı
notaları. **None does.** `data/real/manifest.csv` carries a source per PDF and it is 1,055
neyzen.com + 1,000 notaarsivleri.com, exactly 2,055, nothing else; `strips_b8` splits nota 2,565 /
neyzen 1,390; `testset.json` is 28 nota + 17 neyzen pieces. So the limit applies to the **exam** as
well as to training, which is the half that matters: every accuracy figure this project has published
means "on these two engraving houses".

Recorded as [BACKLOG.md](../BACKLOG.md) item 10 with the cheap version spelled out — a **probe**
(20–40 pages, a couple of hundred strips, score the live model) rather than a corpus, because it
changes no exam and no floor. Deferred for two stated reasons: labelling is the bottleneck (2,486
unlabelled pages already on disk), and the exam must not gain a third source mid-round after being
signed on 46 pages and rebuilt to 64. `divanmakam` was added to the candidate list, which did not
carry it.

⚠ Nothing was collected and no site was contacted — this entry records a finding and a deferral.

## 2026-08-21 — the training pools are re-emitted, and the human corrections did not come with them

**B8 ran.** `emit_strip_labels.py` over the 1,293 non-exam matched pieces, `--strips-root
data/real/strips_v2`, `round2-stage2-best` as hint AND gate, into `data/real/rung3/strips_b8`.
**37 minutes** on the fanless M4 at `OMR_ORT_THREADS=2 nice -19` — because the expensive half was
already bought: 1,704 page decodes were reused from the 2026-07-29 Colab re-slice (same checkpoint,
same `window_cache_ok` signature) and only **16 pages** were decoded fresh. The owner asked Colab or
laptop; the honest answer was laptop, and it is the check on the caches that made it so.

**Result: 3,955 accepted strips against the old pools' 2,330 (+70%)**, 4,738 in review, 24,837
dropped. The referee argument paid out. What was not expected is the shape of the drops: `split_wide`
10,226 + `over_budget` 4,012 = **14,238**, against 7,446 for row alignment — **the 59-id budget is now
the binding limit on real training volume**, which is why the budget measurement moved up the order.

**The finding that matters more than the yield.** Matching old rows to new by measure span:

- On the **844 rows no human ever edited**, 704 land on the same measures and **687 (98%) get an
  identical label** — the emitter has not drifted, which is what makes the next line readable.
- On the **1,442 human `fix` rows**, only 445 land on the same measures and the fresh machine label
  agrees with the human on **41** of them. The differences are the known tie/rest conventions. So the
  machine is most likely repeating the error the person corrected — ⚠ an **inference**, since the
  pre-correction labels were overwritten at promote time and cannot be diffed.
- **248 of those fixes match a new strip's FILENAME while covering different music.** The standing
  re-slice trap, now with a number. Carry by span, never by name.

So the re-emit is a better-cut pool that has **thrown the labelling work off its back**: 951 of the
1,442 corrections are recoverable (445 accepted + 506 in review), the rest need the width/budget rails
to move. It is not training data until `b8-audit` (201 rows) is read and the carry is done.

**Tooling, 2026-08-22.** Each of the two blocks now carries its own **✓ accept** / **✎ edit from it**
pair, drawn to the left of the text it acts on, alongside the unchanged bottom row. The reason is the
same one behind the 2026-08-21 bug: `ok` has always meant "the *label* is right", which is invisible
while you are reading the *decode*, and there was no one-click way to say "the decode is the right
one". Accepting the decode stores a `fix` carrying that text **verbatim** — deliberately not through
`baseText()`, whose `\tup3` guard sits on a checkbox inside the closed edit box, and an unseen
checkbox must never decide what gets written. Driven in a real browser against a throwaway data root:
both blocks' buttons render and sit left of their text, `edit from` drafts the right source, accepting
the decode writes `fix` + the exact decode, accepting the label writes `ok` + no corrected text, and
the decode-only / label-only rows show just their own pair.

**Tooling, 2026-08-21.** Three tabs added to `review_ui.py` — `b8-audit` / `b8-full` / `b8-review` — with
`QUEUE_IMG_ROOTS` pointed at `data/real/strips_v2`. One real defect fixed on the way: `build_full_audit`
had the strip root **hardcoded** to `data/real/strips`, so a b8 full-audit tab would have seeded its
edit box with a July `rung3-labeler` decode of a *different* crop, silently. `FULL_AUDITS` entries now
carry an optional strip root; the four older queues keep the old default. Verified end to end on a
scratch port: counts 201 / 3,955 / 4,738, an image byte-identical to the `strips_v2` crop and not the
retired one, every `b8-full` row carrying a `strips_v2` decode, and a verdict round-tripped and cleared.

## 2026-08-21 — the labelling tool was lying about what it saved, and the conflicts are cleared

**The owner stopped mid-queue with a bug report**: *"there is not any option model decode, just label.
When I click to ok, it saves something different then label. If I press edit, the edit box come with
something that is not in the label."* Three separate faults, all landing on the same 27
`gold_conflict` rows they had been told to read first.

1. **No decode.** `build_exam_v3_queue.py` wrote those rows with `"decoded": ""`. They are synthesised
   from strips the emitter **auto-accepted**, which therefore never passed through `emit_review` — but
   the decode was on disk all along, in each page's `_decode.json`. With the field empty, `diffHtml`
   falls back to its "no cached model decode" panel, which is exactly what the owner described.
2. **The suggestion was invisible.** `corrHtml` only rendered for rows that already had a verdict, so a
   **pending** row's carried gold was never drawn.
3. **`ok` saved that invisible text.** `verdict()` posted `corrected_label` regardless, so pressing `a`
   stored the suggestion instead of the label on screen — **12 rows**, two of them a different
   measure's music entirely.

**What was and was not damaged.** Checked before alarming anyone: `promote_labels.py` reads
`corrected_label` **only** when the verdict is `fix`, using `label` for `ok`. So the exam gold was
never at risk and those 12 `ok` verdicts would have promoted correctly; the stored strings were
misleading, not corrupting. The residual risk was real though — re-opening such a row would have
pre-filled the unseen text into the editor.

**Fixed**: the suggestion is drawn and diffed under a header saying `ok` will not take it; `ok` clears
it on a pending row (a human correction always arrives as `fix`, so re-confirming a real fix still
keeps it); the builder copies the decode. **Repaired in place**: 27 decodes backfilled, 12 stray
strings cleared, verdicts untouched, before-state kept as `emit_review.csv.bak-20260821`.

⚠ **The lesson worth keeping**: a field that is *authoritative* must be *visible*. `corrected_label`
drove two actions and was rendered by neither, which is why the bug survived the queue's own design
review — the docs describing the carried suggestion were written from the builder's side, never from
the screen's.

### And the 27 conflicts are now read: 14 `ok`, 13 `fix`

The fresh SymbTr derivation won more often than the frozen gold it disagreed with. The 13 fixes are
**9 repeat marks added** (`\repend` / `\volta1` / `\repstart`), **3 more of the signature bug**, 1
repeat removed, and 5 rhythm/grace corrections.

- ⭐ The koma→küçük signature correction is now **10, still 10–0 in one direction**, and no longer
  confined to one queue — `examv3-full` and `gold_conflict` were cut differently and both show it.
- ⭐ **Repeat structure is the second theme**: 22 repeat/volta marks over the 166 rows read so far.
  That is the same family as the dotted-barline finding — SymbTr and a printed edition disagree about
  repeats by convention, and the model has no token for the one the page actually prints.
- ⏭ **636 rows remain over 64 pages**, to be labelled page-complete.

## 2026-08-21 — the exam's own labels are read, and they expose a bug in how signatures are made

**Two things happened, and the second is worth more than the first.**

### 1. The model split was proposed and cancelled the same day

The morning's decision (entry below) split the emitter's checkpoint into a "gate" model and a "hint"
model. The owner pushed back — *"Cannot we basically use last model for everything?"* — and was right.
The number that settled it had not been looked at: **the gate model also aligns rows**, and a row it
cannot align throws away every strip on it. The weak referees dropped **10,695 strips as
`row_unaligned`** (4,467 `strips_nota` = 37% of rows, 5,540 `strips_tup` = 47%, 688 `strips_r1` = 47%)
against a real training set of **2,330 accepted strips**. The referee's dominant effect is **yield**,
not precision, and the split optimised the small side of the trade.

The memorisation objection also shrank under inspection. Reproducing the OLD label on a re-cut crop
mostly *raises* `nd` and sends the strip to review — a yield cost, not a wrong label. The genuinely
dangerous case is narrower than stated: a **truncated** crop whose old version held the full span,
where memory and label agree and nothing catches it. Guard kept: `--audit-frac`, which must be **read**
and not merely produced. The exam half of the morning's decision stands, on a different argument —
`round2-stage2-best` is the baseline being graded on that exam, so seeding its gold from that model's
decode is bias rather than noise.

**Process note worth keeping:** the argument was made twice before anyone counted the drops. Two
mechanisms were weighed against each other for a whole exchange while the deciding number sat in three
`emit_report.json` files.

### 2. `examv3-full` is read, and 7 of its 18 fixes turned out to be one bug

The owner read all 139 emitter-written exam labels: **120 ok, 18 fix, 1 bad = 13.7% wrong**, against
exam v2's **51%** on the identical queue. That confirms the re-slice finding from the entry below with
a complete n rather than a partial one.

Then the observation that mattered: *"the fixes mostly this: `\komaSharp` → `\kucukSharp`"*. All 7
sit **inside `\sig … \sigend`**, on the same note, in **2 pieces of one makam**. Chasing that:

- The key signature is the **only** part of a label not derived from SymbTr. `emit_strip_labels.py`
  takes a **majority vote over the model's own row-start reads** and, when it differs from the
  derivation, **overwrites** the derivation with it.
- The rule has a real justification, written in the code: real editions print the makam's conventional
  signature, which routinely differs from the content-derived one.
- But the voter is `rung3-labeler`, whose koma/küçük confusion is **systematic**. A systematic error
  wins a vote *unanimously*, so the override fires with full confidence and is wrong on every row-start
  of the piece. And the `nd` gate strips `\sig` blocks from both sides before comparing — by design,
  because signature reading is noisy — so the one check that catches wrong labels cannot see it.
- Reach: **24 of 45 exam pieces (53%)**, **406 of 938** `strips_nota` pieces, 98 of 293 `strips_tup`,
  26 of 65 `strips_r1`. Against our own `makam_signatures.json`, **8 of the 36 exam pieces** with a
  signature disagree with the table's majority variant — several *missing* an entry it calls
  near-universal (huseyni, nikriz, segah).
- ⭐ **There is a loop**: the misread becomes the label, the label trains the model, the model misreads
  harder. A plausible partial cause of the 9:1 `\komaSharp`:`\kucukSharp` imbalance, on the accidental
  class the exam headline is most fragile about.

⚠ **Not claimed**: n = 7 in one makam is a signal, not an error rate for the override; many overrides
are probably right; and the makam table is a guide, not truth — mahur genuinely prints both ways in our
sources (küçük 35, koma 17), so it *agrees with* the owner's reading rather than proving it.

**Recorded as**: [../METRICS-CORPUS.md](../METRICS-CORPUS.md) (mechanism + counts),
[../METRICS-EXAMSET.md](../METRICS-EXAMSET.md) (the audit),
[../RISKS.md](../RISKS.md) (standing caveat), [../BACKLOG.md](../BACKLOG.md) item 9 (the script and
the proposed rule change), [../DECISIONS.md](../DECISIONS.md) (two rows).
⚠ **Doc housekeeping**: `METRICS-EXAM.md` crossed its 400-line cap, so it was split by genre —
**[../METRICS-EXAMSET.md](../METRICS-EXAMSET.md)** now holds what the exam *is* (census, rebuild,
`examv3-full`, gold carry, sizing) and `METRICS-EXAM.md` keeps what models *scored*.

## 2026-08-21 — two models, two jobs: the emitter's hint is upgraded, its referee is not (⛔ the split was cancelled hours later, see above)

**The owner asked a good question while labelling `examv3`, and the answer split in two.** The
question: *"emitting them with a better model would make my correcting job easier"* — true, and the
tool is built to make it true. `review_ui`'s edit box is a **hybrid** (`baseText`, review_ui.py):
`\sig…\sigend` comes from the label, **everything after it from the decode**, because the model reads
notes well and signatures badly. So decode quality is paid in keystrokes, directly.

**But the emitter's checkpoint does two jobs and only one may be upgraded.** It **gates** — the `nd`
label-vs-decode check, which is the only *independent* test that a crop really holds the music its
label claims — and it **hints**. `round2-stage2-best`'s stage 2 oversampled `strips_nota` /
`strips_r1` / `strips_tup` **9×** (1,523 + 395 + 148 strips, MODEL_EVAL.md). Those are the pools B8
re-emits. A referee that memorised the answer key agrees with a label even when the new crop's span is
wrong — which is precisely the error class the exam rebuild proved was there. Memory is harmless in a
hint: a bad draft costs keystrokes and never becomes a label unless a human saves it.

**Decision (owner): training pools take the better hint with an independent gate; the exam is not
re-emitted at all.** The exam's reason is separate and stronger — `round2-stage2-best` is the
**baseline column** being re-scored on the rebuilt exam. Gold seeded from a graded model's decode is
anchored toward it: an error the reader lets past becomes part of the answer key, and it is that
model's own error. `rung3-labeler` is weaker but graded by nobody, and descends from
`rung22-stemfix-best` while `round2-stage2-best` trained from BASE — so its mistakes are **noise, not
bias**. Noise costs both models equally; a one-shot read survives noise and not bias. `_realval_v2`
keeps its good seed, because real-val **selects** and does not grade — the line the project had
already drawn in `build_realval_v2.py`, now stated as a rule.

⏭ **Not built.** `emit_strip_labels.py` takes one `--checkpoint` for both jobs. The split needs a
second option: the gate decode must cover whole pages (row alignment reads the full row's id stream),
the hint decode only the review crops. ⚠ **And the payoff is smaller than it looks** — 2,064 of 2,330
training labels (89%) carry across by measure span with no edit box at all, so the better hint pays on
roughly 266 rows plus new review rows, not on thousands.

**Also fixed:** CLAUDE.md's data-layout line still called `round1-best` "the live runtime". It is
`round2-stage2-best`, and has been since Round 2 shipped. The line now also warns that `rung3-labeler`
was never shipped — it is a July throwaway fine-tuned on 362 neyzen strips, which is what prompted the
owner's question in the first place.

## 2026-08-21 — a weakness review of Track B, and the order of work it produced

Asked after the exam rebuild: what is wrong with the Track B plan, before it harms the model. Six
things, each checked against the files rather than recalled. The owner accepted the analysis and asked
for it to be recorded; the resulting order of work is the table in [../STATUS.md](../STATUS.md).

**1. Training is the last pool still on the retired slicer — and the exam rebuild is what made that
dangerous.** Checked by inode: `strips_nota` / `strips_r1` / `strips_tup` (2,330 strips) hardlink from
`data/real/strips`, the 2026-07-15..17 slicer, while `_realval_v2` and now the exam are on the current
one. Yesterday everything was old, so it was symmetric; fixing the exam alone turned it into a
train/test mismatch, on the axis Lever 1 measured as **causal**. ⭐ Measured the price of fixing it:
**2,064 of 2,330 labels (89%) carry** onto the new crops by measure span, no new labelling. Re-framed
B8 from a volume question into this, and sequenced it **before** the final render.

**2. 96 exam gold labels no human has read.** The rebuild takes 139 strips straight from the emitter;
43 agree token-for-token with the frozen hand-made gold, 96 have no check at all. The comparable rate
is on record and is bad: of exam v2's 63 auto-accepted labels, a human later corrected **32 (51%)**.
A wrong gold label manufactures corrections on its page, which is exactly how the primary moves. So
`examv3-full` is read in full, first, and it is written into the criteria as a precondition (§3c).

**3. The floor's meaning changed with the instrument** (§3c) — recorded as the only open Round-3
criteria question, with both honest options written down and the reminder that choosing after the
number is the one move never available.

**4. The dotted barline still has no print-frequency measurement.** 7.8% is a statistic about the
model's guesses. Cheapest honest method, now recorded in B6: count them while labelling `examv3` —
~660 real crops are about to pass in front of a person anyway.

**5. Attribution.** Three flags, one read. Recorded in B6: clone `staccato_falsedot_score.py` into a
false-`\repstart` scorer, which makes two of the three flags attributable instead of one.

**6. A stopping rule for the labelling.** The primary counts corrections per page, so a half-labelled
page under-counts itself. Recorded in [labeling-queues.md](../rung3/labeling-queues.md): label
page-complete; stopping early costs whole pages, never half ones.

Also updated with the rebuild's numbers: BACKLOG item 7 (the budget now costs the exam **153 strips
and 3 whole pages**), [../RISKS.md](../RISKS.md) (three new standing caveats) and CLAUDE.md (the three
crop roots, which are never interchangeable).

## 2026-08-21 — the exam is rebuilt from scratch on the current slicer

The owner read yesterday's finding and made the call in one line: *"I can make it from scratch, it is
okey. Just exam need to be okey."* So the plan stopped being "grow the exam by 21 pages" and became
"re-cut the instrument".

**What ran.** All 45 exam pieces / 67 pages re-sliced and re-emitted into `data/real/strips_examv3`
(never into `data/real/strips`, which is hardlinked into the frozen exam). Result: **139 auto-labelled
strips, 663 rows needing a human over 64 of the 67 pages**, 567 dropped (`split_wide` 414,
`over_budget` 153).

**The part worth remembering: the page-level staleness number was the wrong unit.**
`check_crop_staleness.py` says 45 of 46 graded pages change, which reads as "the exam's labelling is
gone". But a label is attached to a crop, not a page, and it describes an exact measure span — so it
survives on any new crop holding that span. Carrying the 326 frozen gold labels that way:

| outcome | labels |
|---|---|
| agreed with the fresh SymbTr derivation (no human needed) | **43** |
| offered back as a pending suggestion | 151 |
| `gold_conflict` — hand correction vs fresh derivation disagree | 27 |
| lost (88 re-packed, 10 in dropped crops, 7 ambiguous) | **105** |

**221 of 326 came back.** The estimate given to the owner before this was "11 of 326 survive", from
the page-level check — honest at the time, and wrong by 20×. When a measurement's unit does not match
the thing being decided, re-derive it before quoting it.

**A suggestion is deliberately not a verdict.** Carried gold lands in `corrected_label` with the row
still pending, so `e` opens the editor with the text already there. Promoting it unseen would bake a
label written against a truncated crop into a one-shot instrument.

⚠ **What this changes, and it is not yet settled**: the rebuilt exam grades ~12 candidate strips a
page against the frozen exam's 7.1, so it is a **harder instrument** — the primary reads lower at
equal model quality. The comparison stays fair (the `round2-stage2-best` re-score runs on the same
new set) but the signed **75% floor was fixed against the easier exam**, and what it means now is the
owner's to settle before the read, not after.

`strips_exam_v2_clean/` is untouched: it remains the record of what Round 2's 74.2% was measured on.
The two superseded cuts are kept as `strips_exam_v3_oldgeom` and `strips_exam_v3_growthonly`.

## 2026-08-20 — the exam is re-sliced, because the owner opened one strip and looked at it

The queue cut earlier the same day (entry below) was **replaced within the hour**. What happened is
worth keeping, because the failure was not technical.

**The catch.** The owner opened `examv3`, looked at the first strip, and said the duration of the
leftmost note could not be seen. It was a **265 px crop holding one measure**: the notehead sliced by
the left edge, the beams outside the frame. He asked the right question — *"do our slicer have
problems like this, I thought we solved this problem"* — and the answer was: we did solve it, on
2026-07-25/29, and **never applied the fix to the exam**. 0 of the 67 exam pages exist under
`data/real/strips_v2`. [DECISIONS.md](../DECISIONS.md) 2026-07-28 states it outright, warning that
*"exam v3 needs the same treatment; until then the one-shot instrument measures a retired slicer"*.

**The failure mode is the one this project keeps paying for: a written warning that did not travel.**
The exam-v3 plan was written as "label 21 more pages"; the re-slice half of the same task was in a
decision row a month old and nobody carried it forward. The first cut then made it worse *on purpose*
— it pinned the retired geometry (`OMR_EDGE_TRIM=0 OMR_VPLACE=0`) to stay consistent with the 46
graded pages. Consistency with a broken instrument is not a virtue.

**The fix.** The 19 pieces were re-sliced and re-emitted with today's slicer into **their own crop
root**, `data/real/strips_examv3` — separate because the emitter slices in place and
`data/real/strips` is hardlinked into `strips_exam_v2_clean/`, so re-slicing there would have
rewritten the frozen exam's pixels.

| the 21 pages | first cut | re-sliced |
|---|---|---|
| rows needing a human | 297 | **214** |
| median crop width | 640 px | **1031 px** |
| crops under 400 px | 24% | **4%** |

**12 corrections had already been typed** against the first cut. They were carried onto the new crops
where a crop holds the same music — same system, same measure span — **as pending suggestions in
`corrected_label`, never as verdicts** (7 of 12 matched; the mapping is `carried_from_oldgeom.csv`).
A label typed against a truncated picture is a reading of a truncated picture, so it gets confirmed
against the better one rather than promoted into a one-shot instrument.

**What is now open, with its price measured.** The other 46 exam pages are still retired-slicer
output. `check_crop_staleness.py` over all of them: **45 of 46 would lose their labels; 11 of the 326
gold strips survive; 295 of the 326 were made by hand.** So making the whole exam sound means
re-labelling it almost from scratch. That is the owner's call and it is recorded as OPEN — the case
for it is that the shipped app slices with the current slicer, so those 46 pages measure a pipeline
no user gets. Numbers: [../METRICS-EXAM.md](../METRICS-EXAM.md).

## 2026-08-20 — the exam v3 queue is cut: `examv3`, 297 rows, and the exam's ceiling is 65 not 67

The session before this one decided to grow the exam by labelling the 21 pages we already own. This
one **built the queue** — `scripts/rung3/build_exam_v3_queue.py`, two emitter runs, and three new
tabs in `review_ui.py` (`examv3`, `examv3-full`, `examv3-audit`).

**What the work actually was, and why it was not one command.** The emitter re-slices a page whenever
its cached decode does not match the current windowing settings — and a re-slice rewrites the crops
under `data/real/strips/<page>/` **in place**, which are hardlinked into `strips_exam_v2_clean/`. So
the obvious "just run the emitter on those pieces" would have silently changed the pixels the
**frozen exam's gold describes**, on the 6 already-graded pages that share a piece with an ungraded
one. Every cache on disk reads as stale, because `edge_trim` / `vplace` post-date them and default to
off. The way through: the affected pieces split cleanly into two crop generations (9 pieces at 3
measures per strip, 9 at 1, none internally mixed), so each got its own run under
`OMR_MEASURES_PER_STRIP` with `OMR_EDGE_TRIM=0 OMR_VPLACE=0` — which validates the caches *and*
makes the one page that had no cache slice to the same geometry as the rest of the exam. Checked
after both runs: **all 1,026 crops on the graded pages are byte-identical** (size + mtime), and only
that one uncached page was sliced.

**Two things the emit taught us that the sizing note could not.**

1. **297 rows, not ~150.** The estimate scaled the graded pages' 7.1 strips/page, but 10 of the 21
   new pages are cut at one measure per strip and contribute 238 of the 297. No extra music — the
   same music in smaller pictures. ⚠ Mixed geometry is the exam's status quo, not a new defect:
   253 of the 326 already-graded strips are 1-measure crops.
2. **The exam tops out at 65 pages.** Two of the 21 produce *nothing*: every candidate drops as
   `split_wide` or `over_budget`. Both causes are the ones METRICS-EXAM already names, so the 59-id
   measurement (B9) would buy those two pages on top of the 78 dropped strips.

Also carried out of the emit: **33 strips the emitter labelled by itself**. Those enter exam gold
with no human in the loop — v2 sampled 2 of its 63 — so `examv3-full` puts every one of them in
front of a person. Numbers: [../METRICS-EXAM.md](../METRICS-EXAM.md). How to run it:
[../rung3/labeling-queues.md](../rung3/labeling-queues.md).

⚠ A `review_ui.py` left running from an earlier session does **not** see the new tabs; it reads
`QUEUES` at import.

## 2026-08-20 — a planning session: the final render is specified, and the exam grows before it is read

**No code ran and no model trained.** This was the owner asking, in one sitting, what path Track B
should take — and it closed every decision the final render was waiting on, plus two the project had
not noticed it was owed. The measurements below were taken *during* the conversation, off files
already on disk; none required a run.

**What was decided.**

1. **`--staccato-noise` rides the final render.** The open disposition from the passed arm is taken.
   The owner's framing was *"even if it decreases the model's overall success, the wrong false dot is
   the thing I really avoid, so I probably keep it"* — worth recording because the premise turned out
   not to apply: clause 3 had already measured **no cost**. The two-variable objection was answered on
   three grounds rather than waved away (no measured price, neither flag is an experiment, and the arm
   keeps its own paired instrument so its claim stays attributable).
2. **The dotted (usul) barline is promoted out of the backlog into the same render, drawn
   LABEL-FREE.** The label-free half is the part worth inheriting: naming the symbol would make every
   existing real gold label silently wrong, because no pool annotates one, whereas drawing it without a
   label agrees with every label on disk and costs **zero new labelling**. That is the same mechanism
   that made the staccato arm work, and it is why this could join a render instead of waiting a
   labelling cycle. ⚠ It also means the model will read the mark as *nothing* rather than reproduce
   it; a `\dottedbar` token is a Round-4 question.
3. **Exam v3 is bounded: label the 21 pages the exam already owns, then stop at 67.** Both of the
   power note's honest responses are taken — grow before the read *and* print the interval — and the
   growth is capped where it stops being free.
4. **The final run saves two checkpoints** (current selector, and one selected on a free-running real
   metric) and chooses between them on real-val before the exam. The deferral's reason — that changing
   the selector mid-round makes the arms incomparable — expired when the arms were read.
5. **Collection is narrowed, not broadened**: the concave tuplet mark and tuplet-dense instrumentals,
   because 2,486 unlabelled pages already sit on disk and volume relieves nothing.
6. **Plain English becomes the default for every reply**, not only for docs — written into
   `CLAUDE.md` as *How to write to the owner*.

**What was measured, and what it changed.**

- ⭐ **The exam owns 67 pages and grades 46.** 45 pieces, all 67 page PNGs on disk; only page 1 (268
  strips) and page 2 (58) ever produced graded strips. The 21 unused pages are free to label because
  their pieces are already exam-only. Nobody had counted this; `OVERVIEW-ROUND3.md` had been telling
  the owner the exam *was* 67 pages, conflating owned with graded, and that line is now corrected.
- ⭐ **The exam grades 326 of 608 candidate strips on those pages** — 282 dropped, `split_wide` 203 and
  `over_budget` 78. The drops are the wide and dense ones, so the exam reads each page on its easier
  material. `round3-criteria.md` §5 had said this about tuplets only; it is general, and it is now an
  addendum (§3b) rather than an edit to the signed text.
- ⭐ **The sizing arithmetic, which is what actually set the bound.** The useful number is not the
  error bar but the score needed to *demonstrate* a pass: ~86% at 46 pages, ~84% at 67, still ~81% at
  200. Precision goes as √n, so no affordable exam makes a near-boundary call crisp. That converted
  "grow the exam" from an open-ended job into a capped one.
- ⭐ **The 59-id budget is `generation_config.max_length = 60` inherited from the base weights** — a
  setting, not an architectural limit. The comment beside `MAX_IDS` (*"cannot be raised without
  breaking training"*) is true of existing checkpoints, not of a model trained from base. It gates
  three separate things already measured: 78 dropped exam strips, the tuplet-dense repertoire, and
  2,108 over-budget training drops. **Measuring it is Round 3; raising it is Round 4.**
- **`batch3` is at 114 of 1,499 judged: 66 fix / 39 ok / 9 bad — a ~58% fix rate**, against ~30% in
  the scanned nota pool and ~12% in `batch2`. The tier re-aim was right. ⚠ ~1 in 5 of those fixes is
  deleting a false `\repstart`, i.e. hand-payment for decision 2 above.

**The owner's own read of the situation was mostly right, and the record should say so plainly**,
because four "feelings" each mapped onto a number already in this repo: that real tuplet strips are
missing (39.4% / 80.5% / 92.9% of 1-, 2- and 3-measure triplet windows blow the budget), that the
slicer has problems (33% unusable crops, 13,975 drops, 24% stale pages — all from the *old* slicer,
which is why item 8 of the backlog now asks for 100 crops from the current one), that more exam is
needed, and that the training pools are stale. What the session added was not the leads but the
arithmetic that ranked them.

**What was argued down, and why it matters more than what was agreed.** The owner proposed rendering
more than 40,826 synthetic strips and collecting hundreds of new tuplet pages. Both were declined on
evidence rather than taste: synthetic val is already 99.9%, so more of the same practice questions
teach nothing, and new tuplet pages get dropped by the same budget that dropped the old ones. The
lever in both cases is the *vocabulary of things drawn* and the *token ceiling*, not volume. This is
the same shape as the three-nulls-one-pass result and is the reasoning to reuse.

**Files touched:** `CLAUDE.md` (the new *How to write to the owner* section), `docs/STATUS.md`
(rewritten "Now" + Track B, with a new B0 and B9), `docs/DECISIONS.md` (six rows),
`docs/METRICS-EXAM.md` (the census, the drop table, the sizing table), `docs/rung3/exam.md` (the
bounded v3 plan), `docs/rung3/round3-criteria.md` (§3b addendum, signed text untouched),
`docs/rung3/levers.md` (power note answered; collection narrowed), `docs/BACKLOG.md` (item 5 promoted,
items 7 and 8 added), `docs/rung3/labeling-queues.md` (the probe result),
`docs/rung3/README.md`, `docs/OVERVIEW-ROUND3.md` (the plain-English version, incl. the 46-vs-67
correction).

## 2026-08-20 — the staccato arm trained, and it is the first Round-3 arm that worked

**Round 3's arm 2 came back from Colab and passes on all three clauses.** The primary — the rate at
which a printed staccato makes the model lengthen the note — goes **72.7% → 0.0%**, 0 of 110 marked
strips, paired **60–0** against its training control and **80–0** against the live model. After three
consecutive nulls on the realism axis, an arm moved its number.

**Why this one and not the other three, stated plainly, because it is the transferable part.** The
nulls (tuplet mark p = 0.688, the second engraver, the scan profile) all asked the model to read
something it *already knew* from slightly more realistic pixels. This arm showed it a symbol it had
**never seen once** — 0 of 40,826 strips carried a staccato, and the label language had no legal way
to say "dot, but not a duration dot". A hole is not the same kind of problem as a domain gap, and it
does not respond to the same medicine. The `\repstart`-for-dotted-barline finding two entries above
is the same shape, and that is now the reason to expect something from it.

**The strongest single line in the result is not the 0.0%.** It is that the arm reads the MARKED pool
exactly as well as the UNMARKED one — 99.1% exact and SER 0.0002 on both, its one non-exact strip
being the *same file with the same* `\bakiyeSharp → \komaSharp` *confusion* in each. The marks did
not become tolerable; they stopped carrying information about duration at all. That is what a
positional lesson looks like when it lands, and it is why the draw deliberately sought out
already-dotted noteheads.

**The instrument had to be rebuilt before it could be trusted, and rebuilding it was worth it.** The
2026-08-15 baseline was measured ad hoc and never committed — so the first job of
`scripts/rung3/staccato_falsedot_score.py` was to reproduce it, which it does to the digit (80/110,
exact 27.3%, SER 0.0578) from a script written off the written definition. ⚠ It also exposed
something the published number hid: the **training control sits at 54.5%, not 72.7%**. The defect's
severity varies by checkpoint, so quoting the baseline as the control would have understated the
arm by a quarter of its effect. Running the real control is what made the claim attributable — the
same lesson the tuplet A/B's control taught, arriving again.

**Clause 2 did what it was written for.** The slur distractor's precedent was precision 15.1%→91.2%
bought at recall 92.7%→**83.8%, below its floor**, so the pre-registration demanded the opposite
direction be checked. It was: 65/71 real dots kept on easy+mid against the control's 66/71, one
discordant strip, p = 1. There is no trade here. Clause 3 says the same — every AEU and F1 cell level
or slightly up.

**A number in the signed rationale turned out to be wrong, and the gate still stands.** Clause 2
excludes hard tier, and the 2026-08-19 settlement justified that partly on "hard tier carries ~12
real-dot instances in total". Measured: `_realval_v2_hard` carries **64**, comparable to easy+mid's
71 combined. The "12" was the Round-2 **exam's** dropped-dot count — a different pool and a different
quantity. ⛔ The exclusion is **not** reopened: it is signed, it survives on its other stated reason,
and the gate passed on easy+mid regardless. Recorded because this is the **second** time this
clause's written reason has failed to carry what it claims, in the same way both times — a number
borrowed from a neighbouring table and restated as if it described this pool.

**What the arm does not license, kept next to what it does.** The pool is **our own rendered
staccato**. No labelled real strip in any pool carries one, so whether this transfers to a real
printed staccato is **unmeasured** — the identical blind spot as the concave tuplet mark, and the
identical fix (collect pages that use it). `STACCATO_RATE` is still chosen rather than counted.

**Two things about the run itself worth keeping.** `best` and `last` are the **same checkpoint** —
the mix loss bottomed at step 2,000, which is also the last step, so unlike arm 1 there was no
checkpoint choice to make and only one model to score. And the mix beat step 500's by 0.0001, i.e.
noise; what makes step 2,000 right is that real val agrees. Lever 5's selector problem (the entry
below) is untouched — it simply did not bite this time, which is luck and should not be recorded as
a fix.

⏭ **The disposition is the owner's and is deliberately left open**: `--staccato-noise` is off by
default, so doing nothing leaves it out of the final model, the same way `scan_share` was settled.
The argument against turning it on is not that the arm failed — it is that the final render already
carries `--concave-tuplet`, and two flags at once makes that render a two-variable change whose parts
cannot be separated afterwards. [../DECISIONS.md](../DECISIONS.md).

## 2026-08-20 — what the selector actually reads, and a hole the labelling found

**The owner asked what the every-500-steps evaluation is computed on, and whether it is out of date.**
It is, and measuring it turned up something bigger. `train.py` blends two val losses by strip count to
pick `best`; at the default `--real-val-frac 0.10` that is **4,769 synthetic val strips against 271
real ones — 94.6% / 5.4%**. So the checkpoint for a round graded on real pages is chosen almost
entirely on synthetic loss. Lever 5 has said "strip-weighted toward synthetic" since it was written;
nobody had put the number under it, and the number is what makes it actionable.

The staleness the question started from is real but secondary: `strips_nota`/`strips_r1`/`strips_tup`
were cut **11–17 July** against a slicer overhauled on the **25th** and fixed four more times on the
**29th** (0 of 30 crops identical on a re-slice sample). **The exam is old-slicer output too** — which
matters more, because it is the launch gate, and re-cutting it is a decision owed *before* the
one-shot read rather than after. ⚠ None of this invalidates a paired arm: an arm and its control share
the pools and the selector, so it cancels in the delta. Written up as three backlog items rather than
acted on, because changing the selector mid-round would make the arms incomparable.

**Separately, the labelling found a structural hole by eye that no probe had.** On one `batch3` strip
the owner noticed the model emitting `\repstart` where the page prints a **dotted barline** — the usul
subdivision mark Turkish editions set inside a measure. Measured from the queue: **117 of 1,499 rows
(7.8%) decode a `\repstart`**, and **13 of the 23 judged had it removed as wrong**. The cause is the
now-familiar one: `ADDED_TOKENS` has no spelling for a dotted barline, the renderer draws only single
and repeat barlines, so **0 of 40,826 strips** contain one and the nearest thing the model knows is a
repeat sign — a line plus *dots*. That is the fourth instance of one pattern (signature-only crop,
bare phrase slur, staccato, now this), and the second found by a person looking rather than by a
probe. ⚠ The 23 judged rows are not a random sample — the owner works in page order and was drawn to
the pattern — so 57% is not a rate; what it establishes is that the failure is systematic.

⚠ Worth noting beside it: `batch3` is running **56 fixes in 95 judged rows**, well above the ~30% the
scanned nota pool set as the reference and far above `batch2`'s ~12%. The re-aim to the scanned tier
is paying.

## 2026-08-19 — arm 2 dropped on the owner's objection, arm 3 rendering, and a third real tuplet mark

**The owner asked what was next in Track B, then rejected the answer, and was right to.** The plan
was arm 2 (one measure per strip). The objection: *"one strip is not seem so make many gains. Our
slicer already handles if anything is over the budget."* Checked against the code, and it holds —
`_split_wide` (`page_to_strips.py:907`) splits any span over `MAX_STRIP_W` at zero-ink gutters, ~25%
of real crops, and the thing that actually drops a strip is the **59-id label budget**: 8.9% of
*single*-measure windows blow it alone, so no measure rail can fix them (measured 2026-07-29, in a
comment nobody had connected to this lever). What was left for the arm was a *training* geometry
match on the 32% of synthetic strips spanning 2+ measures, on the axis that has returned three
consecutive nulls. **Dropped, not deferred.**

**Settled at the same time:** `scan_share` stays **off** in the final model. It is off by default, so
the decision costs nothing to carry out — but "keep it because it didn't hurt" would have been a
choice made on two nulls, and every profile in the mix is a claim about what users upload.

**Then the owner supplied three real pages, and two of them refute one of our own measurements.**
This project's docs said *"not one continuous arc with a floating digit exists in the real pools"*,
from a 16-of-16 probe. Two scanned editions (Kemânî Sebuh / Sofyan; Avni Anıl / Düyek) draw a
**continuous arc with the italic "3" inside the concavity**. The probe sampled two pools we own and
**no labelled real strip in either carries the style**, so it could not have found it. 16/16 still
describes those pools; the generalisation is withdrawn.

Three things came out of measuring it that reading could not have given:

- **A scanned page is ONE connected component.** Arc, digit, noteheads, beams and all five staff
  lines: a single blob 2,026 px wide. Component logic — the whole method of `tuplet_mark_probe.py` —
  can say nothing until the staff lines are erased. Hence `--destaff`.
- **The concave style sets its digit ON the top staff line**, so the probe's "reject anything
  touching a line" filter threw the mark away even after destaffing was possible.
- **Digit and arc never touch — 5 of 5.** That is the load-bearing number. Our *legacy* mark had the
  digit welded to the apex, one component, "a slur with a bump" — which is exactly what made it
  indistinguishable from a phrase slur. This style is a second cue, not a repaint of the old defect.

Built as an opt-in per-piece coin (`render.ts --concave-tuplet`), verified against the page by the
probe (arc clearance 1.00 S vs 0.91 real, digit at 0.50 vs 0.44, height 1.20 vs 1.22, never touching).
⛔ It goes in the **final model's** render, never an arm's.

**The arm's corpus rendered clean — and did not match its control, for a reason that is not the
arm.** 208/208 pieces, **40,841** strips against `strips_v5_tupnew`'s **40,826**. Every one of the
control's rows was present byte-identical and none were missing: the difference was purely additive,
15 extra strips (0.037%) filling gaps in the control's measure coverage, in 7 jobs across 5 pieces.
Re-rendering one affected piece with `--staccato-noise` **off** reproduced the higher yield exactly
(45 rows for the `t-5_every` job against the control's 40), so the dots are not the cause — something
between the control's 2026-08-14 render and today is, and it is **not diagnosed**. The manifest was
filtered down to the control's row set (sorted, the two now match exactly), with the removed rows and
the reasoning kept beside the corpus. 15 strips could not move a trained arm, but keeping them would
have made the corpus differ from its control in *two* ways, and that is the thing this round keeps
paying for. ⚠ The lesson for the next render: **a strip count is not a corpus identity check** —
diff the manifests.

**The arm is packed and waiting on a GPU.** `verify-labels` **PASS** — 40,826 strips checked, 40,826
exact, 0 mismatched, 0 label drift, no unknown glyphs. `make_round3_colab_zip.sh stac` built
`tnc_round3_stac_colab.zip` (704 MB, 43,193 files) with both guards firing on the way
(`staccatoNoise=True`, `concaveTuplet=False` — the second one exists so the new mark can never ride
into an arm). `notebooks/round3_staccato_colab.ipynb` passes **no mix flag at all**: the arm trains
at `train.py`'s defaults, which is what the control trained at, and the notebook asserts
`(photo_share, scan_share) == (0.35, 0.0)` before spending a GPU hour — the same shape of check the
scan arm used to prove its mix was ON, pointed the other way.

**⚠ The mistake of the session, recorded because it will recur.** The staccato render was already
running when the engraver was edited — and `render.ts` drives the **live dev server**, so Vite pushed
the new mark into a corpus mid-flight. 95 of 208 pieces were rendered against an unknown mix of two
engravers. Caught by reasoning about HMR rather than by any check, and the corpus was wiped and
re-rendered from clean. Two rules follow: **every engraver change is opt-in behind a flag** (which is
why the concave mark is), and **a render in progress means no engraver edits**. This is the same
shape as `--print-noise` riding along unconditionally into ~40k strips, and it is the second time.

## 2026-08-19 — arm 1 ran and it is a NULL, and that is now three nulls on one axis

The scan profile trained on Colab (L4, 12 vCPU, ~1.25 s/step at batch 16, ~2.6 h for both stages)
and **changed nothing on the medium it was built for**. Paired over 197 strips of
`_realval_v2_scan`: `best` +0.071 edits/strip (95% CI [−0.203, +0.335], p = 0.105), `last` +0.010
(CI [−0.198, +0.208], p = 0.488). The born-digital no-regression clause **passes**, with point
estimates that favour the arm (−0.092 / −0.169) and also span zero.

**Why this null is worth more than most.** The interval is ±0.2 edits/strip on a base of 3.66, so
anything better than about a **5% reduction in corrections would have shown**. The effect is absent,
not unresolved — which is a different and more useful statement than "we couldn't tell".

**Three things went right procedurally, and they are the reason the result is usable:**

- **The mix was signed before the code was written**, so a disappointing result could not be
  answered by moving the number. It is not moved.
- **Both checkpoints were read.** Stage 2 saved `best` at step 500 on a mix loss that peaked early
  while real-val loss kept falling to 1,500 — Lever 5's selector problem, live. Reading only `best`
  would have left the result hostage to a selector this project already distrusts; reading both
  showed they agree, with the under-trained one slightly the worse, as under-training predicts.
- **The paired instrument was built before the arm trained** (`paired_arm_score.py`, reusing
  `eval_omr.align` so an edit means the same thing in both places), so nothing about how it would be
  scored was chosen after seeing a number.

**The reading that outlives the arm.** This is the **third** null on "make the synthetic pixels look
more like real pages" — after the tuplet-mark A/B (p = 0.688) and the second engraver's domain gap —
and the first one from a *trained* model rather than a probe. `levers.md` opened by inferring that
axis was at diminishing returns; it is now measured. Arms 2 and 3 are not on it (what the encoder is
**given**, and a symbol it has **never seen**), so they stand. What should not happen is a fourth
realism arm on the grounds that these three nearly worked.

⏭ **One question is left open and it is the owner's**: whether `scan_share=0.25` stays on in the
final Round-3 model. It is off by default, so doing nothing leaves it out.

⚠ **Kept this time:** the full Colab console log ([../../round_3_scan_logs.md](../../round_3_scan_logs.md)).
The tuplet A/B's equivalent was deleted after its table was taken, and that entry has to say so.

## 2026-08-19 — `batch3` is cut and the scan profile is built; both arms of Track B are now waiting on a person

Two things that run in parallel, and neither blocked the other: the owner's labelling queue was cut,
and Round 3's arm 1 was built up to the one step an agent cannot do — the GPU run.

**`batch3` — 54 pages / 1,499 strips from the SCANNED tier, and the cut cost more than expected.**
`--scanned` (the exact inverse of `--clean` over the same born-digital set, so it stays a file-format
fact), `--exclude-pages` and `--stats` are now in `build_label_batch.py`; `batch2`'s 68 verdicts went
home first. **28 pages were excluded over four cut/check rounds** — dropping a page pulls the
next-ranked one in, and that one has to be triaged and staleness-checked too.

- **11 handwritten.** 56 page images read at contact-sheet scale, 20 of them again at native
  resolution. ⚠ The rule that emerged is **narrow, and it is the part worth keeping**: drop pages
  whose *note glyphs* are free-hand, KEEP the professionally hand-copied editions that were
  reproduced and published. Most of the Turkish nota corpus is hand-copied lithograph, and so is the
  exam — the wide rule would have emptied the tier and trained on a medium the exam does not have.
- **17 stale — 24% of the 71 pages checked.** Their crops no longer re-slice to the same music, so a
  verdict on them would not survive a re-slice. This file predicted the scanned tier would be staler
  than average; it is. Owner's call: exclude rather than label into them, because **B8 is still an
  open decision** so a re-slice is live. Cost accepted: evidence/page 46.3 → 43.0.
- `check_crop_staleness.py` grew `--out`, because its stdout list is truncated at 10 and re-running
  it costs ~12 minutes a batch — which is how an exclusion list ends up hand-copied and short.

**The scan profile (Lever 7) is built, pre-registered and packaged.** Six new ops in `augment.py`
behind `scan_share` (default **0.0 = off**), in the order a scan actually degrades — which is not the
photo order. Three design points are load-bearing: `line_dropout` masks **thin ink only**
(`dark − open(dark)`, so a beam cannot enter it) and erases in **runs**, not single pixels; the skew
is **±0.3°** because ±1° once pushed the too-skewed share to 68%; and `threshold_damage` is a soft
sigmoid, because a real 1-bit threshold destroys the beam detail that carries duration.

**Two things were found while building it, and both change what we may claim.**

- ⚠ **No augmented image in this project is reproducible from a seed** — albumentations 2.0.8 seeds
  its transforms at construction from OS entropy. The same module run twice gives different pixels.
  Every paired A/B on record still stands (they compare distributions), but "same seed, same data"
  is not a sentence this project may write. Recorded in `augment.py` and [../DECISIONS.md](../DECISIONS.md).
- ⚠ **The `hard` tier is not the hard one.** Building the scoring instrument
  (`split_realval_tiers.py`) and scoring the control on it: hard **SER 0.051** against mid's
  **0.145** — because all 110 hard rows are gold seeded with `round2-stage2-best`'s own decode and
  then confirmed, so its descendants are flattered. Lever 7's drafted primary was aimed at exactly
  that pool. It was moved, **before signing**, to the **medium split** — 202 scanned strips at 0.107
  SER against 65 born-digital at 0.024, a 4.5× separation on the axis the profile changes.

**What the arm is waiting on.** One Colab run: `tnc_round3_scan_colab.zip` (688 MB, ships
`strips_v5_tupnew` — the *same* corpus as the control) and `round3_scan_profile_colab.ipynb`. The
control is `r3-tupnew-stage2-best`, already on disk, so this costs one run and not two. Pre-GPU
evidence, which is a sanity check and not a result: `staff_detect_fail_%` **28.7 → 17.3** against
15.0/15.3 on the real pools, with spacing and placement spread all closer; stroke thickness moves
slightly further.

## 2026-08-19 — the exam is 93% scans, so the labelling turns around; and a lever nobody had noticed

**No model code ran today.** What changed is where the work points, and two measurements did it.

**The exam's medium, measured for the first time.** The 2026-08-18 born-digital census was run over
the *corpus*; run over `testset.json` it answers a sharper question. **4 of 45 exam pieces and 5 of 67
exam pages are born-digital — 93% of the exam is scans.** So `batch2`, cut with `--clean` the day
before, was drawn entirely from the tier supplying **7%** of the medium Round 3 is graded on. The
2026-08-18 entry already said a clean-page batch "cannot be expected to move the floor much"; this
turns that caveat into a number, and the number is bigger than the caveat sounded.

**The owner's own read said the same thing from the other end.** After labelling 68 rows of `batch2`
he reported the strips were mostly decoded correctly — and the verdicts bear it out: **59 ok / 8 fix /
1 bad, a ~12% fix rate**, against **30%** in the scanned nota pool. ⚠ n=68, so read it as 5–22%; it is
a direction, not a rate. The consequence is the part worth keeping: a batch row is **seeded with the
decode**, so an `ok` changes the training data by nothing. **The yield of a batch is its fix rate, not
its throughput** — seven or eight looks in ten were buying nothing.

**So the labelling turns around, but NOT by unparking `batch1`.** Measured while checking: `batch1` is
not the inverse of `batch2` — **10 of its 52 pages are born-digital**, 5 are neyzen, and it ranks the
most damaged pages *corpus-wide*, which is precisely why it filled with handwritten manuscript. The
plan is a `batch3` on the scanned tier behind a `--scanned` filter that **does not exist yet**, a
page-level handwriting triage before any strip work, and a **100-row probe** of fix-rate and bad-rate
before committing 1,500 — the scanned tail is where `realval-hard` lost 33% of its crops as unusable.
Handwriting stays deferred.

**A lever nobody had noticed, and it is the next trained arm.** `augment.py` has exactly two profiles,
`screenshot` (0.65) and `photo` (0.35). **There is no scan profile** — and a flatbed scan of a TRT-era
print is neither: flat lighting and no perspective, but speckle, broken thin lines, ink spread,
bleed-through and threshold damage. `levers.md` said the degradation axis had been "varied heavily",
which was true and misleading: it is varied for the **deployment** distribution, not the exam's
medium. `augment.py`'s own comment has read *"Revisit against real usage at Rung 3"* since July. It
goes first because it costs no render, no labels and no render slot. ⚠ The trade is recorded rather
than glossed: `PHOTO_SHARE` came from the owner's report that real uploads are screenshots, so aiming
at scans optimises the **exam**, not necessarily the app's users (n=2). The scan profile is added
**beside** the two, never substituted, and the mix is pre-registered.

**Lever 6 clause 2, settled before the arm rather than after it.** The `nd`-as-degradation
justification was void. The owner's call: **the exclusion stands, the reason is replaced** — hard tier
carries ~12 real-dot instances in total, too few to gate on, and its gold is the least reliable we
own. Re-opening a signed pre-registration mid-round is what would make the round meaningless, so the
gate does not move a point.

**The tuplet thread is closed.** Confirmed while ordering the arms: the A/B ran, it was null, the
shape stands on the print measurement, and **no trained arm belongs to tuplets**. Two items survive
and neither costs a render or a run — the position lead (first triplet marked, later ones forgotten;
96% → 81%) is settled **for free** at the exam read, and the digit-position probe is a person looking
at tiles.

**Round 3 now has an order: four arms, one variable each** — scan profile → one measure per strip →
staccato → the final model, then the exam once. Lever 4 gets no arm: the pilot was null and four
recipe items are owed before a LilyPond corpus could stand beside `strips_v4` at all.

⚠ **Doc structure changed too.** `STATUS.md` was rewritten (399 → 308 lines) and `OVERVIEW.md` was
**split by genre** rather than shaved: the model plan in plain words is now
[../OVERVIEW-ROUND3.md](../OVERVIEW-ROUND3.md), and the closed narratives (the triplet mark, the
classical-forms lead, the second printer's limits) moved to
[../OVERVIEW-MODEL.md](../OVERVIEW-MODEL.md). The first attempt at this was trimming to fit, which is
the thing [../MAINTAINING.md](../MAINTAINING.md) explicitly forbids; the owner caught it.

## 2026-08-18 — F3 deployed to the live site, ahead of its own manual gate

**What happened.** The owner asked for a deploy of the current product. `npm run deploy:app`
published HEAD to <https://komavision.netlify.app>, putting **F3 (the violin fingerboard tab) on the
live site for the first time**. Preflight: `npm run typecheck` clean across all three workspaces,
`npm test` ALL PASS. The build reported 24 files / 43.7 MB and "deployable (under 60 MB, no weights)";
5 files changed on the CDN.

**Why the ordering is worth recording.** STATUS item 3b said the deploy comes **after**
[MANUAL_CHECKS-FEATURES.md](../MANUAL_CHECKS-FEATURES.md) check 25 — a person looking at whether the
fingerboard dot lands where a violinist's finger would. That gate was **skipped on the owner's direct
instruction**, not overlooked. It is defensible because check 25 is a look at rendered UI and the
deployed bundle shows the same thing, so the check's substance survives the reordering; what was
given up is the option to fix a bad-looking fingerboard before two friends could open it. **The look
is still owed** and stays Track A's next action. Recorded rather than smoothed over, because a
skipped gate that leaves no trace reads later as a gate that passed.

**What was verified after.** `npm run smoke:live` **PASS on both paths** — server 47.8 s, Hub
fallback 67.6 s, both returning an identical 9 staves / 26 strips / 399 notes / 26 bars, both
cross-origin isolated, no page errors. Then the two things `smoke:live` structurally cannot see:
`/instruments/violin-vl100.png` → 200 (355 KB), and every drum stroke → 200.

**One trap found by walking into it.** A spot-check of `/audio/kudum/dum-rr1.wav` returned 404 — and
that was a **wrong guess, not a deploy gap**: the shipped kits are **bendir and darbuka**, the two CC0
sets, and there is no kudum kit. All six real files (dum/tek/ka × 2 kits) serve 200. Worth knowing
because a 404 on an audio path is exactly the silent failure `MAX_AUDIO_MB` and the `VITE_AUDIO_URL`
rule exist to prevent, so it looks alarming until the kit list is checked — read
`apps/web/public/audio/` before believing one.

## 2026-08-18 — Lever 4: a second engraver exists, its gate passes 312/312, and it bought no measurable realism

**What ran.** LilyPond 2.26.0 (Homebrew, training-side only) now renders our own strip labels:
`tools/render/ly-engrave.ts` (label → LilyPond source), `ly-svg.ts` (read back what was drawn),
`render-ly.ts` (the corpus arm) and `verify-labels-ly.ts` (this arm's pixels-vs-labels gate). A
312-strip pilot on the six `pieces_geom_pilot.json` pieces passed the gate **312/312, 501
accidentals, 0 bar-check failures**, at **112 ms/strip** — a whole corpus would be ~76 min. Numbers:
[../METRICS-ENGRAVER.md](../METRICS-ENGRAVER.md).

**Why it was buildable at all.** LilyPond ships `ly/makam.ly`, which maps ninth-tone alterations to
Emmentaler glyphs with the **same convention we use** — koma = mirrored flat / 1-stem-2-bar sharp,
bakiye = slashed flat / plain sharp, küçük = plain flat / 1-stem-3-bar, büyük = double-slashed flat /
2-stem-3-bar. That was checked glyph by glyph against Bravura before any code was written, because it
was the one thing that could have killed the lever in a morning.

**The design decision that makes pixels == labels provable.** The translator re-decides nothing. A
note the label marks is written at that alteration and forced with `!`; a note the label leaves bare
is written at the *drawn signature's* alteration; `\accidentalStyle "forget"` removes LilyPond's own
memory, so its print rule collapses to "differs from the key signature" and those two cases pin it
exactly. The written pitch is then what a *reader of the picture* would infer, which is all a training
image needs — a suppressed accidental cannot move a notehead.

**Two things the gate caught that reasoning had not.** (1) Emmentaler is an **optical-size family**:
a grace note's accidental is a different outline, so an outline table calibrated only at full size
reported "no accidentals drawn" on a strip that visibly had two. The calibration now renders every
sign twice. (2) The first domain-gap run compared against the wrong control — 48% of `_pilot_geom_m4`
is transposed `every`-mode strips, and a different signature seed moved the measured accidental rate
**3.6×**, which would have read as an engraver effect. Both were recipe faults, and both were invisible
until something compared drawn ink with label text.

**The result, stated as it came out: NULL.** Against the matched control (carry-mode strips only, same
signature variants, same six pieces) every column `domain_gap.py` can see is unchanged or slightly
further from real pages; beam spans get *longer* where real pages are shorter. **Two limits belong
with that number rather than after it.** The instrument is blind to most of what an engraver changes —
glyph shapes, spacing inside a measure, stem lengths, beam angles — which the 99-pair side-by-side
(`data/real/rung3/domain_gap/ly_vs_vexflow.png`) shows plainly while the table barely moves. And the
arm's **staff geometry was pinned to the corpus on purpose**, so the "spacing SD is zero" third of
Lever 4's premise was never tested: varying document scale per strip is a separate, engraver-neutral
change that neither renderer makes today.

**What this does NOT license.** Rendering a LilyPond corpus. 312 strips is a pilot pool; the claim a
mixed corpus would need is an accuracy claim and only a trained arm can make it. Four things are owed
first anyway — slur distractors (they took `\tup3` precision 15.1% → 91.2%, so an arm without them
teaches the opposite lesson), repeat/volta/nav marks, lyrics and text, and the `every`-mode transposed
share. Consequence for the ordering: the render slot Lever 4 was holding is **free**, and the choice
between the one-measure-per-strip render and the staccato arm is the owner's next call.

## 2026-08-18 — the stopped UI's RANKING got a cheap consumer: page-complete labelling batches, and a census that corrected "neyzen is vector PDFs"

**Later the same day as the entry below, and it partly supersedes it.** That entry ends "what is on
disk and works, **unconsumed**". It is consumed now — by the cheap half rather than the expensive one.
`scripts/rung3/build_label_batch.py` reuses `build_page_queue.py`'s scorer to cut a **page-complete
batch** out of `reslice_all.csv` and hands it to the *existing* strip UI as its own queue. No new UI
was built; the page-level tool stays stopped for the cost reasons in [../BACKLOG.md](../BACKLOG.md).

**Why a batch at all.** `reslice-all` sorts nothing and ships **worst-confidence-first** — the very
ordering measured at **0.44× lift** on this pool the day before. Taking its first 1,500 rows is close
to labelling 1,500 random strips, so the selection had to happen outside the UI, on the only signal
that survived measurement: per-page structural evidence (off-meter bars, stitch warnings, `hit_cap`,
flagged crops). ⚠ It is a heuristic over **visible damage**, not a validated predictor of edits/page —
and it cannot be validated here, because the only gold-bearing pages are the exam's and those are
refused. Everything it cuts is therefore **training only**; exam growth still needs a random sample.

**Batch 1 was cut, read at the top, and PARKED.** Over the whole corpus the ranking returned exactly
what it is built to return — the most damaged pages — which turned out to be old scans and **real
handwritten manuscript**, a category the owner deferred on 2026-08-17. Kept on disk as the record of
what the unfiltered ranking gives back. **Batch 2 is the live one**: 52 pages / 1,497 strips, all
nota, cut with `--clean` and ranked *inside* the born-digital tier (30.2 evidence units/page against
that tier's own median 16.0). Owner's call: teach the clean modern sheets first.

**The filter is a file-format fact, and that is the whole point.** Born-digital = page 1 embeds no
raster image and is drawn with vector operators; a scan is always one big embedded image, so the two
cannot be confused and no model, threshold or eyeball is involved. Every other difficulty signal this
project has is either circular (`nd`, below) or measured worse than random (decode confidence) — this
one is neither, which is why it was trusted to keep handwriting out.

**⚠ The census corrected a claim that had been repeated for weeks.** Over all 2,055 PDFs: **88 of
1,000 nota are born-digital, and 0 of 1,055 neyzen are.** Neyzen has been described in several docs as
"clean vector PDFs" and it is nothing of the kind — every neyzen page is a raster scan. Its ~5× lower
SER is real; the cause is that it is a *better scan*. Fixed in [../METRICS.md](../METRICS.md),
[../METRICS-CORPUS.md](../METRICS-CORPUS.md) and [../rung3/levers.md](../rung3/levers.md); no SER
number moved, only the label on the row — and "nota over neyzen" still holds, since it rests on the
SER split rather than on the file format.

**One thing was built because the corpus average could not answer the question asked.**
`check_crop_staleness.py --pages-from <batch>_pages.json` re-slices *exactly* a batch's pages instead
of 20 random ones. A batch is by construction the most damaged pages — the population most likely to
move under a re-slice — so the 100%-labels-kept figure for `strips_v2` does not speak for it. Crop
staleness has already cost this project three times; checking the actual work is cheaper than a
fourth. `--merge-back` closes the loop the other way: verdicts return to `reslice_all.csv`, and a
strip that already carries a *different* verdict there is reported as a conflict, never silently
overwritten.

## 2026-08-18 — a page-level review UI was designed, costed, and STOPPED; three measurements survive it

**The ask:** "review UI 2" — a page-level correction tool like the app (photo and rendered score side
by side, tokens visible, every editor mechanic, plus editable `\sig` blocks and a
selectable/deletable tuplet mark), so real pages could be corrected page by page instead of strip by
strip, with a queue aimed at the 150 pages that would most move the model.

**The outcome: the owner stopped it on the cost case, and that was the right call.** The win is
concentrated entirely in the ~1/3 of strips that need a fix (~45 s of typing a token string in
`review_ui.py` → ~3 s of dragging a notehead); checking speed barely moves, because you read every
note either way. Whole-queue estimate ~175 h → ~55 h — real, but not the order of magnitude that
justifies the build. Recorded with the full case in [../BACKLOG.md](../BACKLOG.md) so it is not
re-proposed from scratch.

**Two assumptions that would have justified it were measured FALSE**, which is most of why the
arithmetic came out where it did:

- **Window overlap is 1.15×, not ~3×.** 43,586 measure-instances across 33,804 crops against 38,026
  distinct measures. There is no "every bar is verdicted three times" redundancy for a page tool to
  collapse — the assumption was mine and it was wrong.
- **The off-meter bar mark flags 37.8% of interior bars corpus-wide** (1,670 pages), against the
  one-page 8/28 that [../mvp/editor.md](../mvp/editor.md) rests on — a file that told its readers not
  to over-read it, correctly. It narrows a duration hunt ~2.6×; it is not a spotlight, and it cannot
  see pitch.

**A third measurement killed the obvious queue design.** Ranking pages by model confidence captures
**4%** of known disagreements in its worst decile — **lift 0.44×, worse than random** — which agrees
with W8 being dropped for catching 26.3% at a 10% budget. ⚠ The first run of that test was ill-posed
(all 33,801 rows, of which 30,049 are seeded with their own decode and cannot disagree); it only
means anything on the 3,755 rows carrying an independent label. Both the result and the trap are in
[../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

**What is on disk and works, unconsumed:** `tools/vision/page-structure.ts` and
`scripts/rung3/build_page_queue.py`, plus a built 150-page queue. Kept rather than deleted because
this project's own rule is that a corpus claim needs a re-runnable script behind it, and the three
numbers above are now such claims.

**⚠ The finding with the longest reach came out of looking for a scan-quality filter: `nd` is not
scan degradation.** `emit_strip_labels.py` defines it as `lev(label_ids, decoded_ids)/len(label_ids)`
— a label-vs-decode disagreement — and there is exactly one `nd` in the repo. So any argument of the
form "these strips are harder, see their `nd`" is **circular**. It voided one half of the previous
day's classical-forms confound check (corrected in eight files, including the plain-English page and two LOCKED rows that were flagged rather than rewritten; the other half, that beste/nakış are
simpler on every countable property, is independent and stands — and the retraction never depended on
either, since the owner's retest is direct evidence). ⚠ **One signed pre-registration uses `nd` the
same way and was FLAGGED, not changed**: Lever 6 clause 2 excludes hard tier from the staccato arm's
no-regression floor on that basis. The exclusion may still be right — hard tier is defined
independently of `nd` — but its written reason does not carry it. Owner's call, owed before the
staccato arm is scored. [../METRICS-CORPUS.md](../METRICS-CORPUS.md).

## 2026-08-17 — the classical-forms lead is dead, killed by the owner retesting the app

**The shortest useful session in a while, and none of it was code.** The owner retested the deployed
app on classical pieces and withdrew the report that started the whole thread: classical pages read
**no worse than songs** — *"it is not read it well but it cannot read the songs as well."* The lead
was already half-dead on mechanism (measured hours earlier: beste/nakış are *simpler* than şarkı on
every countable property). ⚠ The scan-degradation half of that check was **circular** and is
corrected below. The retest kills the
premise itself, so there is no form axis left to salvage: no form-aimed collection, no exam growth by
form, and no request for the owner's failing pages.

**What was removed, and from where.** `rung3/levers.md` Lever 1b (84 lines) → a six-line tombstone,
with its reasoning moved to [superseded.md](superseded.md) as the doc rules require. STATUS items 1a
and 1a2 → one `1a.` tombstone. `DECISIONS.md`'s "collection aimed at classical forms" row → marked
**OVERTURNED** rather than deleted; the "publish for clean pages first" row keeps its argument but
loses "especially on classical forms", which was its only form-specific clause. `METRICS-EXAM.md`
keeps the table — the arithmetic on the spent Round-2 dump is correct — under a ⛔ header saying it is
not evidence of a form effect. `OVERVIEW.md`'s List B item, which was still carrying the *un*-retracted
version a day after the retraction, rewritten in plain English.

**Why the write-up is longer than the finding.** This lead reached four live files and STATUS's
"next action" slot inside one day, on n=26 with a category we already had a story for. It survived one
retraction and was still being read as the next thing to do until a person opened the app. The
process did not catch it; the owner did. That is the entry worth keeping.

⚠ **Not touched by any of this**: the separate 2026-08-17 decision to collect real pages **broadly**
from more sources stands on its own reasoning. And the exam-composition fact (68.9% şarkı against
training's 52.9%) survives as a *description* to know when exam v3 is composed — not as an argument
for weighting v3 by form.

**Consequence for what happens next.** With 1a gone, Track B's owner-side action is the label
correction already under way (STATUS 1h2), and the agent-side one is **Lever 4, the LilyPond second
engraver**, which Lever 1's closure unblocked. ⚠ Three render-side items are now owed at once — the
second engraver, the one-measure-per-strip geometry render, and the staccato arm — and no two may be
rendered together.

## 2026-08-17 — the pale-line binarizer is landed and re-measured, and Lever 1's plumbing is built

**Found rather than planned.** Picking up Track B's next action (Lever 1 step 2) turned up a **third**
uncommitted change in the tree beside F3 and the staccato distractor, which STATUS did not mention: a
pale-staff-line binarization fallback in the slicer, ported to both sides, with a new
`tools/vision/binarize-test.ts` already wired into `npm test` — and **no documentation anywhere**. It
had to be landed first, because the re-slice Lever 1 needs would otherwise have moved the binarizer
and the geometry in the same step, which is the mistake Round 2 and the tuplet A/B were built to stop
repeating.

**Its corpus claim lived in a code comment with no script behind it**, so it was made re-runnable:
`scripts/rung3/pale_line_probe.py`. That mattered more than expected — **the numbers do not say what
the comment said**. The comment reads "it fires on 93 … 37 pages recovered"; the sweep says the
fallback is **TRIED on 93 and BELIEVED on 37**. Both facts were right, one word covered both, and the
93 would have been quoted as a firing rate forever. Recovered 37, regressed 0 and 0-stave pages
144 → 107 all reproduce exactly. Full anatomy: [../METRICS-SLICER.md](../METRICS-SLICER.md).

**A new blind spot came out of writing the probe**: of the 107 pages still at 0 staves, **51 are
never offered to the fallback**. `PALE_LINE_MIN_ROWS` gates on clustered *line rows*, not on staves,
so a page with ≥4 rows of horizontal ink that `detect_staves` cannot group into 5-line systems fails
late and is never retried. Recorded, not acted on.

**Parity held.** `slicer_ref.py --pages 120` regenerated and `parity:slicer` re-run: **W4/W5/W6 all
PASS**, deskew angle identical 132/132 — which is the half the change actually touches, since the
skew sweep now takes the page's binarizer instead of re-deciding per rotation. Three pages show
manifest drift where local Python now finds staves the manifests record as zero; that is the
recovery, showing up exactly where it should.

**Then Lever 1's plumbing, which is two mechanisms and not one.** `levers.md` and `STATUS.md` both
said the renderer and the slicer share `MEASURES_PER_STRIP` / `MAX_STRIP_W`. They do not: the
renderer packs by measures and **label tokens** (`STRIP_BUDGET`, 4 / 56) and has **no pixel-width
rail at all** — which is *why* our strips run wider than the real pools' rather than an accident on
top of it — while the slicer cuts at 3 / 1450 px. The two also already disagreed by one measure, 4
against 3, which nothing had flagged. Built: `--max-measures` on `render.ts` (URL param → `App.tsx` →
`buildStrips`' budget override, asserted per job in `__omrConfig` the way the tuplet arm is), the same
flag mirrored in `verify-labels.ts` — **read from `render_config.json` so it cannot be forgotten**,
because a mismatched replay would report the whole corpus as "strip not published" rather than fail —
and `OMR_MAX_STRIP_W` on the slicer. ⚠ `window_signature()` recorded the measure rail but **not** the
width rail, so a decode cached at 1450 stayed "valid" after the cap moved; it is in the signature now,
defaulting to 1450 so every existing cache reads as the geometry it was made under.

**The pilot's design and stop rule are signed before any arm ran** — three arms (4/2/1 measures),
each with a matching re-slice so both sides move together, the control being a *fresh* re-slice
rather than the pools on disk, and an arm stopped if the real side's share of crops under 10 gold
tokens more than doubles. [../rung3/levers.md](../rung3/levers.md).

**Then it ran, and the stop rule fired — Lever 1 is spent.** Numbers:
[../METRICS-GEOMETRY.md](../METRICS-GEOMETRY.md), split out of METRICS-DIAGNOSTICS at the cap because
the input-geometry thread is now three sections and a genre of its own.

Four things came out of it, and only the last was the question we set out to answer:

- **Sweeping three arms is what earned the result.** `maxMeasures = 2` moved **one strip in 433**,
  because the renderer already emitted one measure per strip 87% of the time — the **56-token** budget
  binds before the measure rail ever does. Had we picked "2" on the reasoning in the docs, the pilot
  would have returned a null and read as a refuted lever.
- **The lever cannot do what it was named for.** It was framed as *raise the resolution the encoder
  sees*. The padding probe's ×1.00 baseline **was** the exam's own 19.2 px, so there is nothing above
  it to reach without crops under 479 px — narrower than one measure, which is the half-measure target
  already measured at **+31.8% worse**. The caveat the probe shipped with ("lowering costs edits is not
  the same as raising pays") turned out to be the whole story.
- **Both costs the lever carried were wrong, and wrong in our favour**: corpus **+12.9%**, decode
  **1.22×**, not ~3× either. The 3× came from reading the slicer's 3-measure rail onto the renderer,
  which does not have one.
- ⛔ **The stop rule fires on the only arm that does anything**: short crops **0.8% → 4.3%**, 5.4×
  against a 2× threshold. A rough independent estimate lands in the same place — the resolution gain
  (~−10% SER) and the short-crop cost (~+15%) are the same size, sign probably negative.

**What survives, and it is worth having:** the *training* corpus reads at **16.0 px** while the exam
reads at **19.2**, and rendering at one measure per strip closes exactly that, for +12.9% strips, with
the slicer untouched — so none of the decode cost or short-crop risk that stopped the lever applies.
And the **short-crop hole is promoted from side condition to the blocking item** on this axis: it was
dropped in July on a *mechanism* that was disproved while its **cost** stayed confirmed, and it is now
the thing standing in front of the only geometry change that works.

⚠ **An arm design error is recorded with the result, because its numbers looked decisive.** The first
run paired each arm with a lowered `MAX_STRIP_W` (800, 500 px). A real measure is ~1012 px, so those
caps cannot be met by packing fewer measures — `_split_wide` cut **inside** measures instead:
`split_wide` 25% → 76% → **94.7%**, widths down to 334 px, 3.06× strips/page, short crops 19.8%. Every
number read as a crushing verdict on the lever and none of it was about the lever; it was the
half-measure target, tested by accident. **The tell was `split_wide`, not the widths.** With the cap
held at its shipped 1450 it is flat at 118 strips in all three arms and every crop falls on a barline.

**Then the owner changed the strategy, and caught an error doing it.** Tired of synthetic experiments
(and of spending a week's usage budget on them), they offered to hand-correct real labels instead —
a few thousand this week. The evidence backs it: in the nota pool **531 checked labels needed fixing
against 167 that were fine**, and pitch is 40% of what a user corrects, so dirty pitch labels cap the
metric Round 3 is graded on however good the renderer gets. Seven synthetic ideas have now come back
"no"; this one is measured, large, and on the right axis.

**The recommendation given was wrong, and the owner spotted it.** Asked which queue to work, the
suggestion was "finish the nota pool — 556 rows left, finishable in a week". The owner's reply was to
guess those crops were cut by the **old** slicer. Measured with a new
`scripts/rung3/check_crop_staleness.py`, over 20 pages per root:

- `data/real/strips_v2` (what `reslice-all` reads): **100% of pages keep their labels** — 18
  byte-identical, 2 differing only in width with **the same measures in every crop**.
- `data/real/strips` (what `nota-*`, `exam-fix`, `r1-*`, `tup-*` read): **10%.** 16 of 20 pages come
  out with a different crop COUNT, 2 more with different measures.

So the recommended week would have been ~90% wasted, in exactly the way the 130 July verdicts were.
**Third time crop staleness has cost something**, which is why the check is now a committed script and
a standing instruction rather than a thing to remember. The grading order matters and is the reusable
part: different measures or crop count **voids** a label, a different width does **not**.

Two consequences: `reslice-all` is the queue (33,639 of 33,804 pending, worst-first), and the **531
existing `fix` verdicts are stranded** on crops the slicer no longer makes — evidence that the
auto-derived labels were bad, not corrections anyone can bank. Re-slicing those pools is a rebuild.

**Also corrected while here:** STATUS had claimed since 2026-08-16 that F3 and the staccato distractor
were uncommitted. Both were committed (`469c87e`/`64a6702`, `1c106b0`). A stale "uncommitted" warning
costs a session's planning and, worse, camouflaged the genuinely uncommitted binarizer above.

## 2026-08-16 — Track B: crop geometry is CAUSAL, and the staccato/augmentation-dot confusion is built and measured

**Two pieces of Track B, kept deliberately apart** — one is a measurement whose whole purpose is to
keep Round 3 attributable, the other a renderer change that trains nothing and stays off by default.

### The crop-geometry probe (item 1f) — the first pre-render check to come back positive

Five checks before it asked *do we DRAW something wrong?* and all five said no. This one asked how
much of the strip the encoder is **given**, and the answer is that resolution costs real edits.
`--make-padded` widens each crop with **its own quietest columns**, so content and gold are byte-
identical and only the encoder's effective resolution falls. Edits/token rose **monotonically across
all four doses (+59% at ×2.00)**, the paired bootstrap excluded zero from ×1.50 on, and the
**real-val holdout replicated steeper (+61%)**.

**Why the harness is believable here:** both unpadded arms reproduced their *recorded* baselines
exactly — the exam's to the individual edit (S=209 D=144 I=209 = 562, 52.1%, 57% of pages ≤5), the
holdout's to SER 0.079 / 62.9%. That is the same read that produced the Round-2 numbers, not a
re-derivation of them.

**The half-day estimate was wrong by an order of magnitude** — the whole 8-condition sweep took
minutes, because a 32-strip timing probe showed most of `eval_omr`'s wall clock is model loading.
Worth remembering before budgeting a day for the next one.

**What was NOT concluded, and this is the part that matters later:** the probe *lowers* resolution.
Showing that squashing hurts is not the same as showing that narrowing crops pays, and the two are
separated by the **short-crop hole** — 0 of 40,826 training strips are signature-only, and narrow
geometry makes short crops the common case. So the next action is a 300-strip pilot, not a render.
Also stated with the result rather than after it: ×2.00 extrapolates below the exam's natural width
range, and ~25 of 326 crops are too dense to have a quiet window so their padding tiles symbol
fragments. Dropping those 25 moves every delta by ≤0.01, which is why the artifact is not the story.

`--compare` was added to the probe for the *"flat within noise"* half of the pre-registered rule,
which never said what the noise was. Greedy decode is deterministic, so the only sampling error is
over which strips are in the pool — and since padding does not change a filename, every dose is the
same 326 images and the comparison is naturally **paired**.

### The staccato distractor (owner-found, 2026-08-15)

**The owner spotted it in real use**: the model reads printed staccato dots as augmentation dots and
lengthens notes. Checking rather than assuming turned it into a structural finding — `ADDED_TOKENS`
has **no articulation token at all**, and the augmentation dot is not a token either but a suffix
inside the duration, so the label language has no way to say *"dot, but not a duration dot."* The
renderer draws no staccato, so **0 of 40,826 strips carry one**: every dot the model has ever seen
meant longer.

**Measured with a paired control, which is what makes it more than a report.** Two 1,215-strip pilot
renders identical apart from the marks: on the 110 strips carrying a staccato whose gold has no
dotted duration, the model decodes a dot it has no gold for **72.7% of the time** — against **0.0%**
on the same music unmarked, which it reads **110/110 exactly**. The substitutions are literally
`d''4 → d''4.`, `g''8 → g''8.`.

**A concern was raised and overruled, and both halves belong in the record.** The exam shows
dot-**lost** outnumbering dot-**added** 12:4, and the slur distractor's precedent is precision
15.1%→91.2% bought at recall 92.7%→**83.8%, below its floor** — so a distractor risks pushing on the
larger error. The owner's answer: the dropped dots come from bad scans, and hallucinated length is
the costlier error. **Stratifying confirmed the premise** — 7 of the 12 dropped dots are hard-tier
and six carry `nd` up to 1.14, while the easy tier has **zero of either**. That is also why the
pre-registered no-regression clause is scoped to **easy+mid tiers only**, written down in advance
rather than chosen after a result, and why the exam cannot be this lever's instrument at all.

**Three placement drafts were rejected by eye before one worked**, and the reason is a trap worth
keeping: VexFlow's `getNoteHeadBounds()` returns `notehead.getY()` — the notehead's **anchor**, not
its ink edges — so on a single-notehead note `yTop === yBottom === the centre`, and every clearance
measured from it lands half a notehead too close. The dots came out fused to the noteheads twice
before that was found by reading the VexFlow source instead of tuning constants. A second, genuine
geometric limit: a note sitting **on a line** cannot take the adjacent space centre at all, because
the dot's radius overlaps the notehead's ink there at *any* clearance — those get the space beyond
it, which is looser than an engraver would set and the right trade when the mark's whole job is to
be unmistakably *not* beside the notehead.

The design point the build turns on: the lesson is **positional**, so the draw deliberately seeks out
**already-dotted notes** — a notehead carrying an augmentation dot beside it and a staccato above it
is the only example that isolates position from everything else.

Guards: manifests **byte-identical** between arms (`staccatoseed` is kept out of the manifest the way
`legacyTuplet` is, precisely so the two arms stay diffable), `verify-labels` **PASS 1215/1215** with
the marks on, `npm test` and `smoke:editor` green with the flag off. **Nothing is trained yet.**

## 2026-08-16 — F3 is BUILT: the violin fingerboard tab, and the photo told us where the strings are

**Track A's last designed-not-started feature is done.** A third view beside Nota and Piyano rulosu:
a violin neck with a dot that follows playback, and a tick at every position the loaded score uses on
each string. Built, checked on the production bundle, not yet seen by the owner or the friends.

**The two open questions were answered by the owner before any code was written.** Tuning: ship
**standard Sol–Re–La–Mi**, but hold the four frequencies in a data table so a Turkish scordatura is a
row rather than a rewrite. What it draws: the dot **plus ticks from the score's own pitches**, not a
fixed reference chart — which is what makes the microtonal spacing on screen the spacing of the music
in front of you, rather than a diagram.

**The calibration was measured, and measuring it is the part worth keeping.** Each string was tracked
down `violin-vl100.png` as a brightness peak and line-fitted with outlier rejection: residuals came
out **0.06–0.10 px over 348–432 rows**, far finer than the ~7 px a koma occupies near the nut. Nut and
bridge are the pale ridges in the luminance profile between the strings, at y **171.5** and **659.0**.

⚠ **Two independent sanity checks were run precisely because a self-consistent fit can still be
nonsense.** The nut→bridge run of 487.5 px scales to **328.1 mm** at the image's own px/mm — a 4/4
violin's vibrating length is 328 mm — and the string spread comes out **17.2 mm at the nut, 34.2 mm at
the bridge** against a real ~16.3 and ~33.5. Neither number was used to fit anything; they are what
says the photo is a real straight-on 4/4 and the lines are its actual strings.

**Three things the picture corrected, none of which were guessable from the licence page.**

1. **The neck is a 6:1 vertical sliver**, which is unreadable on a phone — and every human who has
   opened the deployed app so far was on one. It is rotated a quarter turn so the nut is on the left,
   guitar-tab fashion. ⚠ A true rotation, not a transpose, so the photo is never mirrored.
2. **A tuning peg sticks out sideways across image rows 172–176**, just past the nut, and rendered as
   a grey smudge floating under the Sol string. Found by looking at the render, not by reasoning. The
   photo is now masked to the fingerboard's **own tapered outline** instead of a rectangle, which
   removes it and gives the picture its real taper.
3. **A naive "darker than the belly" scan reads the fingerboard as 109 px wide** by the time it
   reaches the body, because the f-holes, the fingerboard's shadow and the dark body all pass it. Only
   rows near the neck are usable; the taper is straight, so the edges extrapolate from two clean rows.

**A test disagreed with the code and the code was right.** "A low melody stays in first position"
failed: the melody dips below the open Re, which forces a shift down to the Sol string, and the rule
then keeps the hand there for the note after. That is what a violinist does, so the assertion was
describing the wrong thing and was replaced by the two claims actually worth pinning — a melody that
fits under one hand never climbs, and a forced shift does not bounce back.

⚠ **Out-of-range notes are a normal case here, not an edge case.** Turkish notation transposes down a
fourth, so a written G3 sounds D3 ≈ 147 Hz, well under a standard violin's open Sol at 195.6. Those
notes draw **no dot** and say `data-finger-state="out-of-range"` rather than being clamped onto a
position they are not at. It is also the strongest practical argument for eventually adding a lower
Turkish tuning — which is exactly the seam the data table was built for.

⚠ **`openHz` is on this project's 53-TET grid, not twelve-tone equal temperament.** A fifth here is 31
commas = 701.89 cents, so the open Sol is 195.571 Hz rather than a tuner's 196.00. That ~4-cent
difference is a fifth of a koma — the scale of thing this view exists to show — and it is what makes
an open string land at ratio 0 *exactly* for the note that should be played open.

**What it cost:** `packages/core/src/fingering.ts` (the maths, portable),
`apps/web/src/ui/fingerboardGeometry.ts` (every pixel, in one place),
`apps/web/src/Fingerboard.tsx` (drawing and the clock), 38 assertions in
`tools/core/fingering-test.ts`, and a section in `smoke:editor`. `npm test`, `typecheck` and
`smoke:editor` all pass, and the built `dist/` was driven headlessly to prove the photo is served and
the marker tracks in the production bundle — dev mode cannot prove that.

⚠ **The tuning picker exists but is hidden** while `VIOLIN_TUNINGS` has one entry. The seam, the data
and the attribute are all real; a select with one option is dead UI, and inventing a second tuning to
fill it would be a repertoire claim this project has not made.

⚠ **Nothing here has been seen by a person yet.** Every check is a machine check. Whether the dot lands
where a violinist would put the finger, and whether the ticks read as informative or as clutter, is
check 25 in [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md) and it has not been run.

## 2026-08-15 — F3 is scoped to the violin, and its artwork rule was the thing in the way

**Track A had one feature left and it looked expensive for a reason that turned out to be a
misreading.** The owner confirmed F1 landed well (*"my friends loved the instrument sounds"*), dropped
the last editor item, and asked what the next feature is. The answer is F3, the fingerboard tab — and
the conversation that followed changed what F3 costs.

**The blocker was one bullet in `features/README.md`: "own artwork — draw the instrument as SVG, or
photograph your own."** The owner's objection was immediate and correct: *SVG artwork can be hard*.
Two things were wrong with that rule as written. It sounded like *draw a violin*, when F3 needs only a
**fingerboard** — a tapered shape with four lines, no artistic skill. And more importantly it banned
more than it meant to: what the 2026-08-08 copyright pass was defending against is **unknown
provenance**, not third-party pixels. A CC0 image whose chain has been read was never the risk. The
rule is amended rather than dropped ([../DECISIONS.md](../DECISIONS.md)).

**What that unlocked, and the check that made it trustworthy.** The owner showed a violin-tutorial
screenshot as the format they wanted — a neck with position markers on it — which is a good format
and an unusable file (someone's video frame, all rights reserved, plus a hand, a bow and **12-tone**
coloured tapes that contradict the whole feature). The usable file is
[`File:Violin VL100.png`](https://commons.wikimedia.org/wiki/File:Violin_VL100.png), CC0 1.0, now at
`apps/web/public/instruments/violin-vl100.png`. ⚠ **Its derivation was followed, not assumed** —
CC0 on a user-upload site is the uploader's claim, and a CC0 derivative of a restricted photo would be
worth nothing. Its source `File:Violin VL100.jpg` is the same author's own public-domain photograph,
so both links are clear.

**One prediction in this conversation was wrong and the file corrected it.** The advice given before
downloading was that the bridge would be out of frame on a neck crop, forcing a three-point
cross-ratio calibration to survive perspective. Opening the actual image showed a **straight-on front
view with the nut AND the bridge both in frame** — so it is the easy two-points-per-string case. The
real limit is elsewhere and is now written down: the nut→bridge run is ~580 px, which puts a koma at
about **7 px near the nut and less further up**, so the high positions are where this image runs out.
Worth keeping as the pattern rather than the fact: the asset was argued about for three exchanges and
answered in one look, the same way the audio measurements kept beating the filenames.

**Also settled: editor step 9 is dropped and `Save JSON` stays.** The 2026-08-07 decision to delete it
was never carried out, and the deletion has a real cost — `smoke:editor` reads the edited document by
clicking `#save-json`, so the button is the check's only view of what an edit did. The editor's list
is complete; there is no step 9. ⚠ The 2026-08-07 row's *reasoning* is not reinstated: the export is
still unused and the editor's honest justification is still that a friend with a wrong note should be
able to fix it.

**Left open on purpose:** the four open strings. `openStringFreq` feeds every marker position, and
standard G3–D4–A4–E5 vs a Turkish keman tuning is a repertoire question rather than a programming
one. Nothing else in F3 waits on it — the geometry, the calibration, the string-choice rule and the
overlay all take the open strings as data.

## 2026-08-15 — the encoder's input box, and a re-read of every negative result so far

**A review of the whole training history, asked for by the owner** ("model her ölçüde hata yapıyor,
kesinliği fazlasıyla artırmamız gerek"), reading MODEL_EVAL.md end to end, the training code, and the
current outside literature. It produced one new measurement and one reframing.

**The reframing first, because it is the reason the measurement was looked for.** Five investigations
in a row — staff geometry, beam weight, crop shape, decode-time width splitting, the tuplet mark —
plus `staff_jitter` and the rasterizer drift, have all come back negative or null. Every one of them
asked the same question: *do we DRAW something wrong?* The answer has been no for a month, while
pitch and duration have stayed at 68% of the edit budget. That is a signal about the axis, not a run
of bad luck: the "make the synthetic pixels more realistic" lever is at diminishing returns, and the
remaining levers are elsewhere — what the model is allowed to SEE, how it DECODES, what its real data
is worth, and how a run is selected. All five are written up ranked in
[../rung3/levers.md](../rung3/levers.md).

**The measurement.** Nobody had written down the arithmetic of the encoder's fixed 409×583 frame. A
strip is rotated and *fitted* into it, so the net scale is `min(583/W, 409/H)`: the median synthetic
strip arrives at **half size**, its 30 px staff spacing becomes 14.4 px, one note position becomes
~7 px, and **61% of the frame is black padding**. A strip narrower than **479 px** — about one
measure — is the only shape that is not downscaled at all. Re-aligning the spent Round-2 exam decode
and bucketing by effective spacing, with density pinned, the most-squashed third costs **2.4× the
edits per token**; with length pinned instead the effect survives, and with width pinned it
disappears — so it is resolution and not autoregressive drift. Numbers and every caveat:
[../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md). Probe:
`scripts/rung3/crop_geometry_probe.py`.

**Why this is written as a lead and not a finding.** It is observational, ~40 strips a bucket, on
crops the current slicer no longer produces; the probe's own re-alignment totals 433 edits where
`eval_omr` reports 562, so only the trend is usable. The causal test — widen a crop with more of its
own empty staff, which lowers resolution while leaving content and gold identical — is written
into the same script with its reading pre-registered, and **has not been run**. ⚠ Building it
produced a small measured surprise worth keeping: the **obvious** implementation (extend the last
column) is wrong, because the last column of an exam crop is **36% ink at the median** — the crop
ends on a *barline*, not on the blank staff the 6 px trim implies — so it would have padded with a
black band and measured that instead of resolution. Checked before it was used, not after. This
project has
already published one 15.5% exam gain that reversed on a holdout; the discipline that caught that is
what this entry is trying to keep.

**One old line is re-scoped rather than overturned.** METRICS-DIAGNOSTICS said "resolution was ruled
out". That test was per-class **accidental recall**, on glyphs that survive a shrink, and it holds.
It was never run against the **edit budget**, which is what Round 3 targets. Both are true; they
measure different things, and the file now says which is which.

**What it does to the plan.** The content work in `select_pieces.py` is **not cancelled and not
superseded** — it is sequenced behind the probe, because the note-value mix changes how wide a
measure is and therefore moves the geometry variable as a side effect. Rendering both at once would
make Round 3 unattributable for the third round running, which is the exact failure the tuplet A/B
was designed to avoid. A second, quieter point came out of it: our strips are already *wider* than
the real pools', and denser music widens them further, so the content selection needs a strip-width
target rather than only a note-value histogram.

**Also recorded, and owed to the owner before the exam is read:** the primary Round-3 floor is a
per-page rate over **46 pages**, so its 95% interval is about **±12 points**. The signed criteria are
untouched; the choice between growing the exam first and reporting the interval beside the result is
the owner's, and it has to be made before the read.

## 2026-08-15 — the tuplet A/B ran: NULL, and that is the useful outcome

**Both arms trained on Colab and the pre-registered read came back null.** `\tup3` recall **88.9%**
(the measured shape) vs **85.2%** (the pre-2026-08-12 continuous arc) on `_tupletval` — **2 net
groups out of 54**, paired **4 NEW-only vs 2 CTL-only**, **exact McNemar p = 0.688** against a
threshold of ~6 discordant groups one way. Precision cleared its veto on both arms (98.0% / 95.8%)
and the `_realval_v2` guard passed (mean AEU F1 83.9% vs 83.3%, everything else a wash). By the rule
written before the corpora were rendered: **the redraw is kept — it stands on the print measurement,
not on recall — and nothing about recall is claimed in either direction.**

**Why this counts as a good outcome rather than a wasted 5 h.** The power limit was computed and
written down *before* the render (one group = 1.9 pp; ~11 pp minimum resolvable; the hoped-for effect
~5 pp), so the result could be read the moment it appeared instead of argued about afterwards.
Compare Round 1, where a 15.5% exam gain was written up before anyone tried a holdout and then
reversed. The temptation was live here too: `_realval_v2` shows `\tup3` **91.4% vs 80.0%**, an 11 pp
gap in the flattering direction — and it is the **same experiment re-sliced**, since those 35 groups
are a subset of the 54. It is recorded as a non-result in three places for that reason.

**The control paid for itself in a way that could not have been predicted.** It scored **85.2% —
exactly `round2-stage2-best`'s score on the same pool** (46/54 both). So the three differences that
ruled out reusing the live model as a control — the `staff_jitter` augmentation added 2026-07-29, the
sub-visual rasterizer drift across all 40,826 strips, and a fresh training environment — moved this
class by **zero, together**. That is real information about Round 3's attribution, and the only way
to get it was to train the arm. ⚠ It does **not** retroactively make the control unnecessary: had the
answer gone the other way, a single-arm design would have credited the mark with someone else's
movement.

**Both runs were mechanically clean and symmetric.** Stage 1 to 6,000 steps in each (best synth val
0.0086 / 0.0093), stage 2 to 2,000 (best mix 0.0101 / 0.0106), and in **both** arms real-val loss was
still falling at the last step, so `best` == `last` on each side and no checkpoint choice was left to
make. ⚠ That is the Round-1/2 overfitting caveat **failing to reproduce** — worth noting, because the
recipe was held fixed precisely so a surprise like this would be visible.

**The acceptance bar was SIGNED the same day** (owner), unchanged from what was proposed on
2026-08-14: **≥75% of exam pages needing ≤5 corrections**, doubling as the public-launch gate, with
the accidental measures as no-regression clauses. It is the first round of the three to enter
training with a bar already fixed — Round 1 wrote one and missed five floors, Round 2 was judged
against Round 1's because no new one existed. ⚠ It is binding in the unpleasant direction too: it is
not re-opened after the read, and a near-miss keeps the app with the two friends. ⚠ The tuplet A/B
above ran *before* the signature and selects nothing against these floors, so the two are
independent.

**Disposition:** `strips_v5_tupnew` is the corpus Round 3 continues from; **neither arm ships** (the
exam is unread and neither is a Round-3 model, so `round2-stage2-best` remains the runtime); the next
lever is the 35% slur-distractor rate, alone. ⚠ **Do not re-run this A/B for a cleaner answer** — the
exam and every real pool together hold too few `\tup3` groups to resolve 5 pp. The way to answer it
is more tuplet gold, not another pair of runs.

## 2026-08-14 — the kanun ships, and four listens beat four green checks

**F1 is complete: Klarnet, Keman and Kanun, uploaded, deployed, heard.** 62 CC0 files / 65.9 MB at
`Beyaban/omr-voices`; `Deploy is live!` and `smoke:live` PASS on both paths, with the drums still
answering 200 from the app's own `/audio/` and `/THIRD-PARTY.txt` carrying the kanun's block.

**The kanun is the first audio this project MADE rather than copied.** One CC0 take
([Freesound 211133](https://freesound.org/s/211133/), CompMusic/UPF, 2:02 mono mp3, downloaded by
hand because Freesound needs an account) → 36 wav, F3-E6, 9.9 MB, every semitone. `prepare_voices.py`
grew a second acquisition path for it: decode once, split at the onsets, never re-encode. The sha256
identity check cannot apply to a file cut out of a longer one, so the **source take's** hash replaces
it, and both `/THIRD-PARTY.txt` and the Hub card were reworded to say *which* folders are untouched
rather than implying all of them are.

**The split is trusted because the run is chromatic.** The source promises all chromatic tones, so
the measured pitches must step by a semitone — a missed onset shows as ~200 cents, a note cut in two
as ~0. That check is also what *selects* the notes: the two events at the head of the take are
excluded by not belonging to the run. ⚠ Excluding them by level or by harmonicity was tried and is
wrong — the genuine bottom note F3 is 61% harmonic against the intruders' 72%.

**Four ear passes, four real defects, none of which any green check saw.** Breath on 16th notes; then
too deep a trim; then the kanun's pitch measured a **whole koma sharp** (stiff strings stretch their
partials, so a period-based estimator reads a pluck sharp — 22 cents at F3/F♯3, 2 at E6), which put
microtonal accidentals on the wrong comma; then `attackS` landing **150 ms before the pluck** on
`kanun_17_Cs5.wav`, so a 16th note was over before the kanun spoke. Both kanun fixes are
plucked-ONLY — the pitch refinement moved violin C7 by 22 cents, because `Arco Vib` has no peak to
find — and both now have guards that fail the run instead of the listener.

⚠ **Three fixes needed a second fix, and each is recorded where it was made.** The pitch refinement
had to prove it agreed with itself (on D♯6 the fundamental is 6× quieter than its second partial, and
hunting a weak peak returned 1220/1247/1247). The re-articulation scan flagged 9 files of which 8
were decayed-tail noise. And the attack guard's first version measured time-to-*peak*, failing four
correct samples because a low pluck has a broad top. The lesson each time was the same: a measurement
that looks principled can still be measuring the wrong quantity.

**Also landed:** `tools/audio/serve-voices.ts` (`npm run serve:voices` + `dev:voices:local`), so a
voice can be heard before it is published — a plain static server cannot do it, because dev serves
under COEP `require-corp`. Both kanun bugs were found this way, locally, before any upload.

**Then the owner asked for the strings to ring, and they now do.** A kanun has a course per note, so
plucking the next one does nothing to the last — notes are no longer cut at their written length, and
the duration only decides when the *next* one starts. Measured first, against the clipping rule: ~7
notes overlap at 16th-note speed but their peaks never stack, so a dense passage sums to 0.45 against
the limiter's 0.89. Two consequences shipped with it — re-plucking a string damps it (two copies of
one recording combs, which the instrument cannot do), and the natural end waits for the last tail
instead of chopping it, while an explicit Stop stays immediate. All three are `plucked`-gated, so the
clarinet and violin are untouched. Deployed and `smoke:live` PASS the same day.

Detail: [../features/kanun.md](../features/kanun.md). Deployed state: [../STATUS.md](../STATUS.md).

## 2026-08-14 — Round 3 gets its bar, and the tuplet A/B is built up to the Colab handoff

**The acceptance bar exists, and it is the launch gate.** [../rung3/round3-criteria.md](../rung3/round3-criteria.md)
is written before any Round-3 training: floors beside their Round-2 baselines, and one number that
decides both the round and whether the app opens beyond the two friends — **≥75% of exam pages
needing ≤5 corrections**, against 57% today. It is marked **PROPOSED**: the owner signs it off before
a run, because a gate chosen after seeing a result is a description, not a gate. Why the product
number and not the AEU headline: Round 3 targets pitch (40% of user edits) and duration (28%), and
the macro mean cannot see either. Why 75 and not the standing 90: from 57% in one round, 90 is a
floor nobody clears, and a floor nobody clears stops discriminating.

**The `\tup3` A/B is assembled and waiting on two Colab runs.** Both corpora are rendered —
`strips_v5_tupnew` (the mark as measured: arc broken, "3" in the gap) and `strips_v5_tupctl` (the
pre-2026-08-12 continuous arc with the digit above it), **40,841 strips each**. The control arm is a
frozen copy of the old drawing behind `render.ts --legacy-tuplet-mark`; the app itself never draws it.

**What the two corpora prove about each other, exactly:** their manifests are **byte-identical**, and
of 40,841 strips **1,691 differ in pixels** — 1,690 of them are the curved-style strips whose label
carries `\tup3`, and the 379 `\tup3` strips that are pixel-identical are **exactly** the 22
bracket-style pieces, which never call the changed function. The partition is perfect in both
directions. The one leftover is a strip with no `\tup3` in its label that differs by **20 pixels in a
4×7 box at x 0–3** — a neighbouring measure's mark bleeding over the crop edge.

**And against Round 2's corpus, nothing moved but the mark:** all **40,826** strips shared with
`strips_v4` carry **byte-identical labels**, and the new corpus's only extra rows are the same 15
`verify-labels` flags v4 excluded. ⚠ That also **retires a prediction**: [../DECISIONS.md](../DECISIONS.md)
recorded that the 2026-08-05 unclosed-`\tup3` fix would move synthetic labels on the next re-render
(5 measures in 1 piece). On this re-render **no label moved**, and the reason is not established.

**The selection pool had to be built, because the standing one cannot carry this measurement.**
`_realval_v2` holds 35 `\tup3` groups; `_tupletval` (`scripts/rung3/build_tuplet_val.py`) pools every
`\tup3`-bearing strip already on the val side and reaches **54 groups over 28 strips**. That is still
small, and the consequence is written into the pre-registration rather than discovered afterwards:
one group is 1.9 pp, exact McNemar needs ~6 discordant groups one way, so the **minimum resolvable
effect is ~11 pp** against a hoped-for ~5. A null is the likely outcome and the rule for it is
already written — keep the shape (it is measured against real print), claim nothing.

⚠ **`data/pieces.json` is stale, and it cost a full corpus render.** CLAUDE.md documented
`--pieces data/pieces.json`, but `strips_v4` **and** `data/split_v4.json` were both built from
`data/pieces_v4.json` — 208 pieces against the older file's 190. The first render finished before the
mismatch surfaced: 23 of Round 2's pieces missing and **528 strips in neither side of the split**,
silently dropped at train time. Nothing errors, nothing looks wrong; the only signal is a piece count.
The correct file is now beside the command in [../../CLAUDE.md](../../CLAUDE.md).

⚠ **A render aborts the whole chain on one Playwright timeout.** Piece 69/208 timed out on a
screenshot and took the run with it. Renders are resumable by design, so the fix was a retry loop
rather than a code change — but a 208-piece job that dies at 69 and has to be noticed by a human is
worth knowing about before starting one overnight.

**Also built, so the read is one command when the checkpoints come back:**
`scripts/rung3/tuplet_ab_score.py` decodes both arms over the pool, scores every gold `\tup3`
occurrence with `eval_omr.align`, and prints each arm's recall/precision with the exact McNemar p on
the discordant groups — paired, because at 54 groups an unpaired 4 pp can rest on a single group.
`scripts/make_round3_colab_zip.sh <arm>` and `notebooks/round3_tuplet_ab_colab.ipynb` complete the
handoff; both assert `render_config.json`, which is the **only** file that can tell the two corpora
apart.

**The control arm was challenged and survived the challenge on evidence** (owner: "round 2 already
has a model trained on the old notation — why train twice?"). It was the right question and the
answer is measured: a Round-3 model differs from `round2-stage2-best` by **four** things. The mark;
**`staff_jitter`**, an augmentation added to `augment.py` on 2026-07-29 — *two days after* Round 2
trained — which scales ±4% and shifts ±2% on **80% of every training sample** and has never been
A/B'd; a **sub-visual rasterizer drift** that moves **every one of the 40,826 strips** (mean 0.3–4.8
grey levels, no integer shift, ink fraction equal to four decimals, invisible side by side, and *not*
a renderer change of ours — `--thin-sharps` was already in v4); and the training environment. The two
arms share all three nuisances, so only the mark separates them; against the live model nothing
would. ⚠ The same four-way caveat now attaches to **Round 3's own exam read**, and is written into
[../rung3/round3-criteria.md](../rung3/round3-criteria.md) rather than left to be rediscovered.

**One reference number, measured before the arms exist:** `round2-stage2-best` reads **85.2% `\tup3`
recall / 97.9% precision** on `_tupletval` ([../METRICS.md](../METRICS.md)). The pool is therefore not
flattering on the class it exists to measure — 85.2% here against 83.8% on the exam, where real-val
normally reads far higher.

## 2026-08-13 — F1's instrument voices, and what measuring the files caught

**Clarinet and violin play, and every note is a recording resampled onto its exact koma.** The app
side is finished: a `Çalgı sesi` picker, per-note choice between a sample and the built-in tone,
Cache-Storage caching copied from `omr/session.ts`, and a fallback that keeps the piece playing when
the host is unreachable. Verified against a local stand-in for the Hub: **11/11 samples decoded, 11
sampled notes and 0 synthesised, 0 truncated**, with the drums still loading from the app in the same
run. Kanun was deferred — it needs a Freesound account and onset-splitting a two-minute take.

**The single most valuable hour was spent NOT trusting the filenames.** `prepare_voices.py` measures
every file's fundamental with YIN and derives the label offset per library, which is the method
`prepare_strokes.py` used on VCSL's numbered darbuka hits — applied here to files that *look*
self-describing. It caught: the clarinet's labels sitting **a whole octave** below sounding pitch
(`D2` sounds D3 — parsing would have transposed the instrument an octave and sounded plausible
enough to ship); the violin needing **no** offset, which is what turns the clarinet result from a
guess into a measurement; and `F#5` being **mislabelled by a semitone at source**, sounding F6,
confirmed independently against its own second partial. ⚠ It also corrected a number we had written
down twice: the widest pitch gap is **5 semitones**, not the "minor third" the docs said or the 4 the
planning assumed — D–F–A# is a minor third and then a *perfect fourth*. Worst stretch ±2.5 semitones.

**Two bugs were found by building a throwaway host rather than by reading.** A stand-in HTTP server
over the staged folder took twenty lines and immediately exposed what no amount of review had: the
third clarinet file is `A#2`, **`#` opens a URL fragment**, and the fetch silently truncated to
`…/DCClar_susLong_A` — a 404 that looks exactly like a missing upload, costing 3 of 11 samples. It
would have hit the Hub identically. The second was duller and would have been worse to debug later:
`gain` and `peak` are rounded to three decimals into the manifest, so a clamp set at *exactly* full
scale produced a stored pair whose product was 1.0017 and failed the very invariant it existed to
guarantee. The clamp moved to 0.98.

⚠ **The drums did not move, and that reverses what three files predicted.** The plan of record was
that F1 would fire the pre-registered `MAX_AUDIO_MB` trigger and point `VITE_AUDIO_URL` at a Hub;
`loadStrokeKit.ts` said so in a comment written the day before. The owner ruled otherwise —
percussion is essential to playback and must not depend on a second host — and the ruling turns out
to be load-bearing rather than conservative: `VITE_AUDIO_URL` is one base for the whole `audio/`
tree, so the merged version would have 404'd the drums into the synthesis rejected by ear on
2026-08-11, silently, with every existing check still green. The voices got `VITE_VOICES_URL` and
`smoke:editor` now asserts the drums survive whatever the voices do.

**Uploaded the same day** to `Beyaban/omr-voices` (26 files, 55.6 MB, CC0) and re-checked against the
real host rather than the stand-in: 11/11 decoded, byte counts identical to the VSCO originals, CORS
echoed for the deployed origin. ⚠ One behaviour only real latency showed: the first ~4 notes of a
playback are still **synthesised** while the download runs, and the piece switches to recordings
mid-phrase with no re-schedule. That is the per-note fallback working as designed — the local
stand-in was ready before the first note and could never have exercised it.

**Two listens, two fixes, and the second one corrected the first.** Round 2: *"we can hear some
breath sound in clarinet… but we can trim less from the beginning. Or maybe we can trim differently
for different duration of the notes"*. Both halves were right, and the reason is instructive — the
round-1 fix measured breathiness by **amplitude**, which is a proxy for the wrong thing: loudness
arrives well after the noise stops, so it overshot in every file (158 ms where the tone actually
settles at 92, 1178 where it settles at 404). Measuring **harmonic content** instead cut the trim
roughly in half everywhere. ⚠ Two traps inside that: the threshold has to be relative to each file's
own tonality (a clarinet's sustain is only ~94% harmonic, so an absolute bar is unreachable), and it
has to require the tone to *stay* settled — violin C7 shows a momentary 89.6% blip at 50 ms before
falling back to 36%, and first-crossing started the note immediately before the worst of the scrape.
⚠ And the duration idea needed one correction of its own: a smooth blend between "attack" and "tone"
lands *inside* the transient for any file with a long one, so a quarter note on C7 began at 64%
harmonic — the creak reintroduced in the middle of the range while both ends measured fine. It is a
threshold instead: a note inherits the recorded swell only when the swell is ≤25% of it, so no note
ever begins halfway through a scrape. Cost, since the owner asked: one subtraction and one comparison
per note.

**The first listen found a real defect and it was fixed the same day.** The owner: the clarinet is
*"just like breath"* on 16th notes, the violin's *creak* is annoying, and *"it is okey to have violin
and clarinet sounds like slurred"*. Measuring it explained the report better than the report did: the
tone does not arrive for **76–1178 ms** (per FILE — the clarinet's own onsets span that whole range),
a 16th note at 120 BPM is 125 ms, and on a 125 ms window the clarinet's D2 sample is **35.8% tonal
and 13.4× quieter** at the file start than 1.18 s in. So short notes were not merely breathy, they
were *much quieter than long notes* — which is the thing an ear notices first. Each sample now
carries `skipS`/`endS` and notes start inside the sustain. ⚠ **The trim is a playback window, not a
re-cut**: the wavs stay byte-identical, the sha256 table stays valid, nothing is re-uploaded, and
re-tuning by ear is free. That is the second time this session that keeping the files untouched paid
off in a way the original decision did not anticipate.

**What is NOT done, stated plainly:** it is **not deployed**; and **the fix above has not been heard
yet** — check 24 is still open. The voices are peak-matched to the synthesised note
they replace, which is what keeps F1 out of the limiter and also makes them a few dB quieter than the
beep — deliberate, and exactly the kind of trade that only survives contact with an ear
(MANUAL_CHECKS check 24). ⚠ The clarinet's layer also spans **13 dB** between its quietest and
loudest file, so its low register may need attention that one global gain cannot give it.

## 2026-08-12 — the triplet mark, measured against real print and redrawn

The owner's report from a real page was right, and the measurement is the point: **16 of 16 tuplet
marks read across ~11 real editions break the arc and set the "3" in the gap.** Not one continuous arc
with a floating digit exists in `strips_tup` or the exam pool. `drawTupletArc` now draws two segments
with the digit in the gap, on every measured quantity (gap 1.63 S, digit 0.77 × 1.20 S, digit centre
0.20 S inside the ends), and the curved-arc share went 70% → 90%.

**The method is the sharp-bar method, and it was kept deliberately dumb.** `tuplet_mark_probe.py`
locates *candidates* — digit-sized components with arc-like ink beside them — and writes tiles at
matched staff size plus the post-encoder (409×583) view; a human accepts or rejects each tile and only
then is the geometry taken, by scanning outward from the digit along its own row band. No mark
detector was built, on purpose: two detectors earlier in this round failed silently and were caught
only by contact sheets. The tiles it *did* surface as false positives — lyric syllables, the tempo
mark `♩=76—84`, a bar number with volta dashes — are the argument for that choice, and the pilot's own
"27" bar numbers fooled the table again on the last run.

**Three things came out of doing it that reading the docs could not have given.**

1. **Our old mark was worse than "a digit above the arc".** The floating "3" *touched* the apex, so
   mark and digit were ONE connected component — a slur with a bump on top. That is the shape the model
   was asked to tell apart from a phrase slur.
2. **The gap is sized to the digit, not the group** — 1.63 S whether the mark spans 4.5 S or 28 S,
   i.e. the digit's width plus ~0.43 S of air each side. "A fraction of the span" was the natural guess
   and it is wrong.
3. **Our own bracket style already breaks around its digit**, so only the curved style ever carried the
   defect — which is a small independent reason to expect the shape matters.

**The digit had to stop being bold italic Georgia, and that was forced by the measurement, not taste.**
Georgia's "3" is an old-style figure: at the size that matched real print's height it measured **1.10 S
wide against real 0.76**, leaving 0.26 S of clearance where print leaves 0.43 — the digit would have
fused with the arc ends after the encoder's shrink, which is the exact failure the sharp bars already
cost us once. Upright Times at 16 px measures 0.77 × 1.20 S and restores the clearance. Pre-registered
rule kept for later: if the digit ever fuses again, **widen the gap, never shrink the digit**.

**What was deliberately NOT changed.** Real print draws the arc *heavier* than we do (0.133–0.168 S vs
0.100). Thickening only the tuplet arc would hand the model a thickness cue separating it from a phrase
slur that real pages do not have — the trap `AEU_SHARP_STROKE` documents — so it is owed as a joint
change with `drawSlurArc`, after the shape has been A/B'd. The 35% slur-distractor rate was left alone
for the same attribution reason.

**Then the owner looked at the comparison sheet, and the mark changed twice more.** The verdict was
"right shape, too rigid": *"in real editions the tuplets' arms follow the notes, up or down"*, plus
"reduce the font weight of the 3". Both were measured before being believed, on one strip carrying
four descending triplets (`ben_guzele_…_p2_s01_w03.png`, 7 arms): an arm clears **its own** end note by
0.60–0.93 S, and the gap sits 1.43 S over the group's **highest** note. So the mark now tilts with the
contour instead of floating at one height, and the digit is regular weight.

⚠ **The correction that did NOT survive measurement was mine.** A descending printed mark looks
weighted toward its high side, so the first attempt slid the gap over the highest note — which turns
one arm into a stub whenever that note is an outer one. Measured, the digit sits at **0.49–0.50 of the
mark's span** on every group on that page, descending or not: the asymmetry a reader sees is entirely
in the arms' SLOPES. Two lessons, both cheap here and expensive later: the eye reads a tilted shape as
a shifted one, and a screenshot is not a measurement.

**Evidence it is pixels only:** `npm test`, `smoke:editor` (its triplet-mark count is style-blind, so
it saw the new shape without a change) and `verify-labels` on a 309-strip pilot — **309/309 exact, 0
label drift**, re-run after each revision. ⚠ **No recall claim.** The A/B has not run; what is
established is that our drawing differed from print, not what fixing it buys. Next is the corpus
re-render and the A/B — after Round 3's acceptance bar is written down, since an A/B is training.

## 2026-08-11 — F2 plays a real drum, and the measurement picked which one

The synthesised usul strokes were rejected by ear that morning; by the evening the usul plays CC0
recordings of a darbuka and a bendir. The seam held exactly as designed — the change is one branch
at the top of `scheduleStroke`, a loader, and a picker. Core is untouched, and `usul-test.ts` passes
**unchanged**, which is the evidence for that claim.

**The interesting problem was not code, it was which file is a düm.** VCSL names its darbuka takes
`Darbuka_<1..5>_hit_vl2_rr<1,2>.wav` and nothing anywhere says which of the five articulations is
the open centre stroke. Rather than guess, `scripts/prepare_strokes.py` measures each one — energy
below 200 Hz, spectral centroid, decay to −40 dB — and proposes the mapping from the physics: a düm
is the whole head moving (low, long), a tek is a fingertip on the rim (bright, over instantly).

**The frame drum was the control, and it is why the darbuka result is believable.** Its files *are*
self-describing (`Hit`, `Hand`, `HitMuted`), so the same measurement ran against a known answer and
agreed with it. Without that, the darbuka mapping would have been a plausible-sounding guess with
nothing behind it. Result: darbuka düm/tek/ka = hit types 1/2/3; bendir = large-drum hit, small-drum
muted hit, large-drum muted hit.

**Two things the measurement caught that listening-by-name would not have.**

1. **Both `Hand` articulations are unusable** — they peak at −57 dB (large drum) and −62 dB (small),
   40+ dB below the struck takes. That is VCSL's recording session, not a musical dynamic, and the
   obvious mapping (`Hand` → tek, since a tek is played with the hand) would have produced an
   inaudible tek. Lifting one to a usable level would have lifted its noise floor with it. They are
   excluded and the small drum's muted hit is the tek instead.
2. **Inheriting the source levels would have re-created the bug fixed that morning.** The plan said
   to normalise the kit by one common factor to "preserve the natural dynamics"; with articulations
   recorded 40 dB apart, "natural dynamics" means "whatever the session did". The three strokes are
   levelled to fixed targets — first cut 0.89 / 0.62 / 0.34, the ratios the owner had already tuned by ear
   on the synthesised version — with the round-robins of one stroke sharing a factor, since scaling
   each take to its own peak would turn the alternation into a volume wobble.

Tails are cut at 700 ms with a 25 ms fade. A darbuka düm rings for 1.25 s and the bendir's for 2 s,
nearly all of it underneath the notes it accompanies; the cap is what keeps two kits at **660 KB**.
The fade is not cosmetic — cutting a ringing drum at a non-zero sample is a click, which is exactly
the kind of artefact that gets reported as "the drum sounds wrong".

**Where the files live was the owner's question, and the answer changed the design.** Asked whether
Netlify or a Hub would be easier to maintain *given that more instruments are coming*. Netlify, for
660 KB — but F1's instruments are ~4 MB each and four of them would not fit under the build budget.
So the files ship locally **and** the loader reads `VITE_AUDIO_URL` with `/audio/` as its fallback,
mirroring `session.ts`. Five lines now; a change at every call site later. `MAX_AUDIO_MB = 1` in
`prune-dist.mjs` is what makes the trigger mechanical rather than a memory — the first instrument
set that trips it gets an error message telling it to set the env var, not to raise the number.
Decision row: [../DECISIONS.md](../DECISIONS.md).

**Two checks exist because nothing else could see the difference.** A sampled düm and a synthesised
one produce identical DOM, identical `data-*` and identical event counts — the swap could have
silently fallen back to synthesis on every playback with every existing check still green. So the
backend reports `percussionInfo()` (which kit decoded, how many strokes) the same way it reports
scheduler progress, and `smoke:editor` asserts on it. The migration path got the same treatment:
`smoke:editor` was run once with `VITE_AUDIO_URL` pointed at a cross-origin stand-in host, which
served all 12 files under COEP — otherwise the escape hatch would be untested code claiming to be a
migration plan.

**Then the owner listened and the drum was clipping** — *"darbukanın sesi biraz patlamış"* — and the
cause was arithmetic, not the recordings. The files were clean (no clipped samples, all starting at
zero); **the sum was not.** A note is a normalised `PeriodicWave` at gain **1.0** into the master, and
the düm had been normalised to **0.89** into the same master at 0.85, so a note and a düm together
came to **1.61** at a destination that hard-clips at 1.0 — **38% of the waveform flattened**, at the
*default* slider position. At `Vuruş sesi` 200% it was 58%.

⚠ **Why this did not show up with the synthesised strokes**, which peaked just as high: that düm was
a fast exponential blip with most of its energy under 200 Hz, so its overlap with the notes was
brief. A recorded drum has a body that sustains for hundreds of ms and overlaps constantly. **The
level that was safe for a synth is not the level that is safe for a sample** — worth knowing before
F1 puts recorded instruments through the same master.

Fixed in three places, deliberately not one: stroke peaks **0.89/0.62/0.34 → 0.50/0.35/0.19**
(ratios unchanged, so the balance the owner tuned survives), master **0.85 → 0.72**, and a
`DynamicsCompressorNode` **limiter** before the destination (−1 dBFS, hard knee, 20:1, attack 0).
The limiter is a safety net and the levels must not lean on it: it is mathematically inert on notes
alone (0.72), and exists because `Vuruş sesi` reaches 200%, so a user can always ask for more drum
than the range holds — the honest answer to that is to squash the peak, not to shatter it. Worst
case now lands at **0.92** with 3.9 dB of transient trim instead of hard clipping.

⚠ **Percussion has a 15–24 dB crest factor**, so dropping the peak ~5 dB costs much less loudness
than it reads like — what a listener hears tracks the RMS, which barely moved. Do not raise the
stroke peaks to make the drum louder; that is what the slider is for, and it now has room to work.

Green: `typecheck`, `npm test` (`usul-test.ts` unchanged), `smoke:editor` **ALL PASS** including the
four new percussion assertions, `build:app` (43.4 MB, up from 42.7), and both new guard conditions
proven to **fail** the build when tripped. ⏭ Still owed and not automatable: the ears check — whether
the four `[derived]` stroke tables are musically correct.

**And the stroke tables passed the ears check the same evening** — *"they sound really nice"*, all
ten accepted including the four `[derived]` (Devr-i Hindî, Curcuna, Aksak Semâi, Ağır Aksak). That
retires the last open item on F2 and the last thing gating Track A, so **the next action is W10**.
⚠ Worth stating plainly: the standard here is one musician's ear, which is the only standard that
exists for this and is **not** a cited source. If a pattern is ever disputed, re-open the `[derived]`
four and settle it with a citation rather than re-deriving it from the beat grouping — re-deriving
would just reproduce whatever the first derivation got wrong.

**W10 was released the same day, and it came back with an answer.** The owner sent the link; the two
friends used it, **liked it, and said adding other instrument sounds would be good**. The owner
named violin, clarinet and kanun, so **F1 is next and it is the friends' request rather than our
guess**.

⚠ **Worth recording carefully, because the first draft of this entry got it backwards.** It was
written up as "a feature picked before the friends answered", repeating a tension this project had
already named twice — F0 and F2 *were* built ahead of the question. The correction matters in both
directions: the tension was real, and it **resolved in the pleasant direction**, with the friends
independently pointing where the owner's own list already pointed. That is evidence the product
instinct was good; it is **not** evidence that asking is unnecessary, and F3 plus any instrument past
these three should still wait on what they say next.

⚠ **Non-claim:** n=2, they are friends, and they were asked *what to add* rather than *whether it is
good*. "They liked it" is not a usage measurement — `/decode` in the request log is
([../METRICS-USAGE.md](../METRICS-USAGE.md)), and reading it is now possible for the first time with
real users on the other end.

**F1's shape was settled the same evening, and measuring beat estimating twice.** The owner asked for
**no compression and high quality**, and for the files to live **in a repo**. Both answers came after
looking at the actual source: VSCO 2's clarinet `susLong` is **33 files averaging ~1.8 MB**, so one
velocity across 11 pitches is **~20 MB** and three instruments are **40–60 MB** — against a dist
capped at 60 MB that already uses 43.4. That makes "where do they live" arithmetic rather than
preference: a **Hugging Face Hub repo** behind `VITE_AUDIO_URL`, which is the trigger pre-registered
hours earlier firing exactly as designed. Not committed to git, since ~50 MB of binaries in a
**public** repo is permanent and this project already has files stuck in its history.

⚠ **A concern this log raised was withdrawn rather than solved, and the distinction matters.** F1's
"real obstacle" was recorded as compression — no `ffmpeg` on this machine, ~4 MB per instrument as
WAV. The owner removed the *premise* (size stopped being a constraint once the files left the app),
so the obstacle evaporated instead of being worked around. ⚠ Its one durable finding survives and is
worth more than the concern was: the samples are **7–10 second sustains**, longer than any notated
note, so **nothing needs looping** — trimming them to save space would have *introduced* that
problem. The expensive-looking option was the simpler one.

⚠ **And one comment written this morning is already wrong for F1.** `loadStrokeKit.ts` says Cache
Storage is not worth a second invalidation path, reasoning explicitly from 660 KB of drums. At 20 MB
an instrument that reverses: F1 should cache the way `omr/session.ts` does for the weights. Noted in
STATUS rather than pre-emptively edited, because the comment is still true for what it describes.

**So W10 is complete**, which retires the last rung of the W0–W10 ladder. The loop the ladder was
built for — ship a link, get a directed answer, build the answer — actually closed. Round 3 remains
the public-launch gate and lost nothing waiting, which is what the 2026-08-05 parallel re-scope was
for.

**Deployed the same day, and `deploy:app` was quietly broken.** ⚠ `netlify-cli` now detects the npm
workspaces and stops on an interactive *"select the project you want to work with"* prompt; the
documented one-command recipe therefore **built successfully and published nothing**, then died on an
unsettled top-level await. Adding `--filter @turkish-omr/web` fixes it and is now in the script. The
lesson is cheap and worth keeping: **a successful build is not a deploy** — the line to look for is
`Deploy is live!`, and had the tail of that output not been read, the site would have been reported
as updated while still serving the 2026-08-09 build.

`smoke:live` PASS on both paths (server 47.5 s, fallback 62.9 s, identical scores). Since `smoke:live`
does not know about audio, the twelve `/audio/*.wav` were spot-checked directly: **200**, correct
sizes, `audio/x-wav`. `/THIRD-PARTY.txt` serves the VCSL attribution and `sample.json` still answers
**404**, so the copyright guard survived the new deploy. Also fixed on the way past:
`data/audio_src/` — the untouched VCSL downloads — was **not** gitignored and would have committed
~3 MB of re-downloadable originals.

## 2026-08-11 — tuplets: the data work was already done, and the mark is drawn wrong

An owner report of two misread triplets on a real page turned into a session of reading data instead
of docs. Nothing was built; four beliefs changed. Full write-up: [../rung3/tuplets.md](../rung3/tuplets.md).

**The tuplet labelling has been finished for weeks and nobody noticed.** Across three exchanges the
recommendation "finish the 147-row `tup-review` queue" was given from [../rung3/labeling.md](../rung3/labeling.md),
which still described 2026-07-18. On disk: every queue fully verdicted, the promote run, manifest
**169 strips / 205 groups**, training at `:8`, exam extension done (tup3 gold 4 → 55). **The doc was
three weeks stale and was read as current three times in a row** — the cost of a `updated:` header
that says when the file was *touched*, not when its facts were *checked*. Corrected in place.

**The remaining weakness is a trade we made deliberately and never rebalanced.** `\tup3` precision
went 15.1% → 91.2% when the label-free slur distractors landed; recall went **92.7% → 83.8%**,
under its ≥85% floor, and below where it started. The model no longer invents triplets — it misses
about one in six, which is exactly the owner's second error (a whole group emitted as plain notes).

**The likely mechanism, from the owner reading a real page: we draw the mark in a shape real print
does not use.** Turkish editions break the arc and set the "3" in the gap; `drawTupletArc` draws one
unbroken quadratic with a 13 px digit floating above it. So in real print a triplet differs from a
phrase slur *structurally*; in our corpus it differs by a faint floating mark. We taught
discrimination on our own cue and paid for it in recall. **Same shape as the Bravura sharp-bar
defect** — and that precedent is why it is worth taking seriously, not why it is proven. Nothing has
been A/B'd; it is a hypothesis with a mechanism.

**A triplet is not always three noteheads.** The "3" counts units of time. Scanning all 20,259 groups
in the label pools found four with ≠3 noteheads, two of them legitimate (a 32nd + a 16th = three
units in two noteheads) and two that do not sum. **This retires the 2026-07-18 "0 two-member or
unclosed groups" claim**, and it kills the obvious repair rule: "make the nearest 3 notes a triplet"
would corrupt precisely the fast 32nd-note passages the model already reads worst. The correct rule
is arithmetic — close where the running sum lands on a plain value — and it acts only when one
neighbour exactly fits the deficit.

**Also settled: `\tupend` stays.** It is redundant (the durations determine closure), but removing it
would regenerate every label including the frozen exam gold, mid-round, for one token per group.
Constrained decoding gets the same guarantee for free and, unlike the stitcher's existing repairs,
shows up in a score that reads token ids.

**One correction worth keeping**, because it shaped two turns of bad advice: the "every
decode-proposed `\tup3` is a hallucination (0 of 39)" result was measured on the
*pre-tuplet-collection* model. Quoting it at `round2-stage2-best` argued against a repair the current
evidence supports. A finding about a checkpoint needs the checkpoint's name attached to it.

## 2026-08-11 — the owner listened to F2 and rejected the sound

*"I do not like it much. We need to use real sounds."* The synthesised düm/tek/ka shipped that
morning are out. No code was changed — this entry and the doc updates around it are the whole of it,
at the owner's instruction.

**The bar was met and the feature still failed, which is the part worth keeping.** The plan wrote
down an explicit test for the synthesised version — *"düm and tek must be unmistakable from each
other, that is the whole bar"* — and it passed twice over: the strokes are tellable apart, and after
the same day's ~400 Hz attack fix they are clearly audible on a laptop speaker. Neither made it a
drum. **A distinguishability bar was the wrong proxy for a musical one, and it was passed on the way
to failing.** Percussion is a timbre problem; two oscillators can be identifiable without being an
instrument. The "Level 0 first, find out whether more is wanted" argument — borrowed from F1's own
brief — turns out not to transfer from *pitched* timbres to *drums*, and F1 should not read this
entry as evidence against its own Level 0.

**What the bet bought, so nobody reads it as wasted.** Everything except the sound is correct and
survives untouched: `buildPercussionTrack` and the stroke tables in core, the separate percussion
toggle, the `Vuruş sesi` gain stage, `usul-test.ts`, and the two browser sections in `smoke:editor`.
The swap reaches **one method** (`scheduleStroke`) plus a loader — the seam this was deliberately
designed around is exactly where the change lands. F0 is what makes it possible at all: a decoded
`AudioBuffer` now survives a Stop, which it would not have on the old backend.

**Two second-order consequences, both now written into the plan.** (1) The stroke tables must be
verified **after** the samples land, not before — judging whether Curcuna's pattern is right through
a drum sound the owner dislikes conflates two questions, and the four `[derived]` patterns are the
ones most needing an unclouded ear. Step 6 of check 23 is on hold accordingly. (2) The **swap
discipline goes live with the first file** — nothing bundled, `source` + `license` per file, a
`/THIRD-PARTY.txt` line as each lands, a `dist/` guard mirroring `prune-dist.mjs`. None of it applied
while nothing was loaded, which is why F2 could ship without touching it at all.

One thing the synthesis work leaves behind as a **requirement on the recordings**: whatever is used
has to read on a laptop speaker, which rolls off below ~200 Hz. Prefer takes with a defined attack
over ones that are all low body, and audition on the built-in speaker rather than headphones.

## 2026-08-11 — the feature track opens: playback rebuilt, and the usul plays itself

The owner re-confirmed the two-track split (2026-08-10) and asked for the **other** track — features,
not the model — to start. It runs on `main`: the feature track touches `webAudioBackend.ts`,
`usul.ts`, `App.tsx` and `TransportBar.tsx`, Round 3 touches `src/vision/`, `data/` and `docs/rung3/`,
and a branch would have bought rebase ceremony for isolation that already existed. Scope chosen:
**F0 + F2 only** ([../features/README.md](../features/README.md)); F1 and F3 stay designed-not-started.

**F0 — the audio engine (landed 2026-08-10 evening).** `play()` used to build every note's
`OscillatorNode` in one pass and `stop()` used to `close()` the `AudioContext`, which is what
silenced them. Now there is ONE context, created lazily and never closed, and a 100 ms tick that
schedules the next ~1 s. `stop()` stops and disconnects the live source nodes and throws away the
master gain instead. Nothing user-visible changed; it exists so a *sample* can be played at all — a
decoded `AudioBuffer` belongs to the context that decoded it, so the old `stop()` would have thrown
the cache away after every playback, and mobile Safari caps how many contexts a page may create.

⚠ **The thing worth keeping from F0: the existing checks could not have caught it breaking.** The
playhead is driven by the AUDIO CLOCK, so it glides down the sheet at exactly the right speed even
if the scheduler died on its first tick and the page has gone completely silent — every assertion in
`smoke:editor` passed in that world. The backend now reports `scheduleProgress()` through
`window.__omrAudio`, and the check asserts two things off it: that a playback does **not** schedule
the whole piece up front (3 of 511 events in the first window) and that the count **grew** over 2 s.
That is the only signal available here that separates "playing" from "the clock is running".

**F2 — the usul plays its own strokes (landed just after midnight, 2026-08-11).** A usul is not a
list of beats, it is a sequence of named strokes, and `usul.ts`'s own header comment had named this
as future work since it was written. `Usul` gains an optional `strokes` array and core gains
`buildPercussionTrack` — deliberately a near-copy of `buildMetronomeTrack`, same bar walking, same
partial-bar rule, so the two cannot drift. The transport gains a checkbox **separate from the
metronome**, not a mode of it: one marks the beats, the other plays a rhythm, and wanting both at
once (learning a usul against a steady pulse) is normal.

The strokes are **synthesised**, not sampled — düm is a sine dropping 115→55 Hz, tek/ka a bandpassed
noise burst — so the feature works with no download, no licence question and nothing to keep out of
`dist/`. The CC0 files sourced on 2026-08-09 remain the plan and swap in behind `scheduleStroke`.

⚠ **The risk in F2 is data, and it is unresolved.** All 10 usuls have a drafted `strokes` table; six
are the standard simple forms, four are marked `[derived]` because they are our reduction of that
usul's beat grouping rather than a quoted pattern. The new `tools/core/usul-test.ts` checks they are
**well-formed** — inside the cycle, ascending, opening on a düm, and lining up to the millisecond
with the metronome wherever both name the same position. It cannot check they are musically right.
A wrong Düyek is obvious to anyone who knows the repertoire and invisible to every test we have.

**One real bug, found by the new check and worth the line:** `applyPlayback` sets each control's
React state, and the percussion setter was missing. The toggle looked dead — Playwright reported
"clicking the checkbox did not change its state" — because the controlled input reverted on the next
render. The lesson is small and repeatable: every argument that function takes needs its setter.

Green: `typecheck`, `npm test` (now three files — the stitcher round-trip, the edit primitives and
the new usul suite, ALL PASS on each), `smoke:editor` **ALL PASS** including the two new sections,
`smoke:app` PASS. Not run, and not needed: nothing here touches the decode path, the server or the
build.

## 2026-08-09 — the model's own tokens are visible in the app now

Owner request: a developer view showing **all** the tokens the model decoded for a photo. Something
like it existed and did not answer the question — `/slices.html` prints raw tokens for a page **it**
re-slices, and `Gelişmiş`'s strip panel prints labels **re-serialized from the score on screen**.
Neither is the model's output for the read you actually did: `stitchDecoded` takes the tokens and
returns a document, so nothing downstream kept them and the app threw them away.

`App` now keeps the last read's `rawDecode` and **ui/DecodePanel.tsx** (`#decode-panel`, inside
Gelişmiş) shows it: per strip, the detokenized line, then every token in vocabulary spelling with
its log-probability, the `hitCap` flag on strips that hit the token cap, and the **stitcher's
warnings** for the page — which is the part that answers "the model saw it, so why is it not on the
page" (`row 0: mid-row \sig ignored`, `row 6: \tie into a rest ignored`). Plus a JSON download of
the lot. Token spellings come from the model's own `id2token` (`getMeta`, ~12 KB, already fetched by
every decode path), so they are the vocabulary's, not a prettified version.

⚠ `</s>` is deliberately absent — `summarizeDecode` strips it before anything downstream sees it,
and a strip that never produced one is flagged as `hitCap`, which is the fact worth reading.

`smoke:app` now asserts it, on DOM state only (`#decode-panel[data-decode="ready"]`,
`data-decode-strips`, `data-decode-tokens`, `[data-token-count]`): **16/16 strips, 780 tokens, 39 on
strip 1**, alongside the checks it already ran. It costs nothing — that tool already decodes a page.
Walkthrough: check 22 in [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md).

## 2026-08-09 — the sheet was showing a koma bemol as a küçük bemol

Owner report, from using the app: a si carrying a **koma bemol** in `Her notada` lost its sign in
`Standart (ölçü boyunca)` and read as a **küçük bemol**, while the audio still played the koma.

Not a glyph bug and not the makam table — it was the **`sigTolerant`** printing rule (the 2026-07-26
row in [../DECISIONS.md](../DECISIONS.md)) doing exactly what it says: an alteration pointing the
**same way** as the one in effect is written bare under the donanım, whatever its size. Real editions
do that and leave the intonation to the performer, which is why the rule was put into `SheetView`
in the first place — to stop the corpus drawing signs its labels omitted. What nobody checked then
is what it does to a **person reading the app**: the staff and the sound disagree, silently. Scope,
counted over the bundled scores: **134 of 213** have at least one letter whose signature sign hides
a different same-direction alteration (e.g. `sevkefza…geldik_gidiyoruz`, si signature −5 over 31
koma flats; `suzinak…gunden_gune`, si signature −1 over 21 küçük flats).

The fix splits the two audiences instead of choosing between them. `sigTolerant` is now a flag on
both the draw path (`SheetView`) and the label path (`buildStrips`), fed by one constant —
`SIG_TOLERANT` in `App.tsx`, **true only when the URL carries `mode=`**, which is precisely what
makes a page a render job (`render.ts`'s `jobUrl`, and `verify-labels`' manifest replay, both always
set it; the tolerance only ever applies in measure mode). So the corpus keeps the printed-page
convention and a human gets a sign whenever the alteration differs at all.

Checked rather than assumed, because this rule has already cost one round:

- **the corpus does not move** — `?mode=measure` on `beyati-delisin` draws the same 40 glyphs
  (`komaFlat×20 komaSharp×5 bakiyeSharp×15`) before and after the change, compared against a stash
  of the pre-change tree;
- **the app's view does** — the same page, dropdown-switched, now draws 51: the 11 that were hidden
  are 5 küçük flats, 1 bakiye flat and 4 koma sharps;
- **pixels still equal labels on both settings** — verify-labels' own geometry (glyphs assigned to
  the strip rect they fall inside, multiset-compared to the label's accidental tokens), run live over
  five bundled scores: 192/192 strips match in the app setting, 193/193 in the render setting.

⚠ Two deliberate gaps remain, both the owner's: the **makam bends the sound only** (uşşak, hüzzam),
and a **±2/±3 alteration is drawn snapped** to the nearest AEU sign — 154 such notes sit in the
bundled scores, and art-music notation has no sign for them.

**Deployed the same day** (Netlify only — nothing under `apps/server/` or `apps/web/src/omr/` moved,
so no Cloud Run rebuild). Fresh `build:app` with both real URLs and zero `localhost:8080`, 11 files /
42.7 MB, `smoke:live` PASS on both paths (server 77.0 s, Hub fallback 99.5 s, identical scores). The
fix was then confirmed **on the deployed bundle rather than on the source**, which is the standing
rule from 2026-08-06: a score JSON loaded into the live site draws **51** accidentals on the human
path and **40** on `?mode=measure` — the renderer's convention still there, the reader's now honest.

## 2026-08-09 — the copyright pass is DEPLOYED, and a real cold start finally got measured

The redeploy STATUS had been pointing at since 2026-08-08. Netlify only — nothing under
`apps/server/` or `apps/web/src/omr/` had moved, so no Cloud Run rebuild and no re-upload of the
weights. `hf/README.md` went to the Hub as the model card in the same sitting, as planned.

**The live site was still serving all five SymbTr-derived scores that morning** — `sample.json`,
`beyati-delisin.json`, `gamzedeyim-deva.json`, `safalar-getirdiniz.json`, `meltem_notes.json` and
`decoded.json`, every one **200** to anyone typing the name. All **404** now, along with `/scores/`
and `/models/model.json`. That check is worth repeating on any future deploy: a Netlify deploy
publishes the manifest of `dist/`, so removal is real, but nothing says so out loud.

The shipped artifact was built fresh with both real env vars — the trap STATUS flagged is that
`smoke:build` leaves a `dist/` baked with `localhost:8080`, so the build that ships must be a second
one. Verified rather than assumed: the bundle contains both real URLs and **zero** `localhost:8080`
strings. 11 files, 42.7 MB, no `.json` at the dist root.

**Then the part worth writing down, which is a mistake and its correction.** `smoke:live` passed on
both paths, and the logs showed a real cold start at 10:11:41 — 11.29 s, 10,093 ms of it graph
loading, after ~3 h idle. That was written up as "the cold-start fix is proven on a genuinely idle
service", closing an open risk. **It was wrong, and only the wall clock supported it.** The request
log names the client: the cold start was caused by an **automated visitor** (`HeadlessChrome/131`,
referer the *unique deploy URL*) that arrives seconds after a Netlify deploy. `smoke:live` opened 33 s
later and got `/health` back in **2 ms** — warm, off the instance the crawler had just started. Its
server-path result is a warm result, like the two before it.

What survives is the **number**: ~11 s is now the honest cold-start cost on a genuinely idle service,
measured the way METRICS asked for — container `model ready` timestamps, not a wall-clock guess. What
does not survive is any claim about the *app* surviving a live cold start; the crawler only asked
`/health`, and no `/decode` followed it. The risk is back open in STATUS with the reason it is hard to
close: **a post-deploy `smoke:live` can never be the cold test, because the deploy summons the thing
that warms the service.** That is now the third warming mechanism found — a demo recording, this
crawler, and the owner's own use.

The session also produced a first look at **who is using the app**, since the on-open `/health` ping
makes Cloud Run's log a visit counter nobody built: **three page reads on 2026-08-08**, and otherwise
`/health` with no `/decode`. Whois places most of that tail on AWS, a datacenter and a ProtonVPN
exit, and one iPhone UA appears from four unrelated IPs across two days. `/decode` is the honest
count of humans; `/health` is an upper bound.

⚠ **Those three reads were first written up as three visitors. One was the owner's own phone** —
identified only by asking him, because nothing in the log distinguishes an owner from a stranger.
The remaining two both ran Chrome/151, six hours apart, from a home ADSL line and from the owner's
own network; a phone moving between the two is indistinguishable from a second phone, so the count is
**one stranger or two, and cannot be narrowed further**. What *is* certain is that at least one
exists: the owner's phone was on Chrome/150 at 13:14 and 16:38 while the 14:18 upload came from
Chrome/151, and browsers do not downgrade. **The build number is the only device discriminator this
log has**, because Chrome freezes the Android UA to `Android 10; K`.

The standing lesson is about the shape of the evidence, not the count: **server logs can say how many
devices, never how many people, and never who.** Closing that gap means asking (W10) or storing a
client id — tracking, and against the no-analytics stance. Two corrections in one session came from
the owner supplying what the logs could not: that nobody here runs Linux, and that one phone was his.

**All three humans were on Android phones** — which took one correction to see. The 20:32 upload was
first recorded here as "a Linux desktop", because its UA said `X11; Linux x86_64`. The owner pointed
out that neither he nor his friends run Linux, and the log then gave the mechanism: same IP, same
Chrome build, `/health` on the **Android mobile** UA at 20:29:57, `/health` on the **Linux desktop**
UA at 20:30:57, upload at 20:32. That is Chrome for Android's **"Request desktop site"**, not a
second machine. Worth remembering whenever this log is read for device mix — and worth noting that
the correction came from domain knowledge the logs could not supply.

That leaves a real tension with the plan, stated as a question rather than a finding: **the plan is
"web first, mobile later", and every human who has used the app so far arrived on a phone** — one of
them switching to desktop mode within 60 s. n=3, and the switch has no stated reason, so it is
something to **ask W10's two friends about**, not something to re-plan on.

Two further corrections came out of reading the logs properly, both the kind that would have become
folklore:

- **`uptimeS` from a single `/health` cannot tell a busy service from an idle one.** A curl fired
  during the owner's own upload came back `uptimeS` 11 — read at first as "the service scales to zero
  within minutes". Concurrency is 1, so that request simply got its own fresh container. The request
  log is what distinguishes the two; the health endpoint never can.
- **The `--cpu-boost` 25 s alarm was a fresh-push artifact.** Two post-deploy readings of ~25 s had
  been recorded against a 9,500 ms baseline, and the "two consistent readings" argument had been used
  to weaken the lazy-image-layer explanation. **Four later starts on the same revision `…00004-nc2`
  read 10,096 / 11,166 / 10,093 / 9,849 ms** — back at baseline. Holding the revision constant is
  what showed it; the earlier reading changed too many things at once.

## 2026-08-09 — the audio is sourced, and it is all CC0

The search the entry below asked for was run. **Every instrument the owner wants to start with is
covered by CC0, with no NC file anywhere**: bendir, darbuka, tef and zil, clarinet, violin — and
kanun, which was the surprise. Licences read on each source's own page, not on an aggregator.
Per-file list, contents and the prep each one needs: [../features/audio-sources.md](../features/audio-sources.md).

Where it came from: **VCSL** and **VSCO 2 Community Edition**, both CC0 1.0 on GitHub (Versilian
Studios), and two **CompMusic/UPF** Freesound uploads by Barış Bozkurt — bendir *düm* and *tek*
strokes played by Eren Ergen, and a kanun recording holding *all chromatic tones within the range of
the instrument*, isolated.

Three things this changed, and each is a correction rather than a confirmation:

- **CC BY was missing from the licence table** in the entry below. That was the real error. CC BY is
  not a milder NC — it is *cleared*: one line in `/THIRD-PARTY.txt` and it is safe commercially
  forever, no swap owed. It also happens to be exactly where the only free ney material lives (a
  32-second Huzzam scale on ney, CC BY 4.0, CompMusic). Added to the table.
- **Kanun no longer has to be Karplus–Strong.** The plan sent oud/tanbur/kanun to physical modelling
  because no files exist; for kanun that was simply false. K–S is still tried first — it costs no
  bytes and is natively microtonal — but there is now a real recording to A/B it against.
- **Ney's emptiness is measured, not assumed.** Freesound CC0 counts on the day: ney 11 hits and
  none usable, tanbur 1, zurna 0, oud 23, kanun 4, bendir 10, darbuka 43. The owner's own ney
  recording stays the plan.

⚠ Two traps worth keeping. **VSCO 2 CE contradicts itself** — a CC0 `LICENSE` beside a `Readme.txt`
asking for credit and for the samples not to be sold directly. CC0 governs (it is irrevocable), the
readme is a request; so credit anyway, and stay off the v1.1 Ivy Audio / legacy piano material where
provenance is mixed. And **CC0 on Freesound is the uploader's claim** — these two are trusted on
provenance (named research recordings, named performer, a university project), which is not a
courtesy extendable to a random upload of a commercial-sounding loop.

**Nothing is downloaded and no code moved.** What stands between these files and hearing them is
F0 (the look-ahead scheduler on one long-lived `AudioContext`), a hosting decision for the assets,
and per-file prep: splitting the two Freesound takes at their onsets, mapping VCSL's five darbuka
hit types to düm/tek/ka by ear, and trimming the clarinet and violin sustains.

## 2026-08-09 — where the feature track's audio may come from

Follow-up to the backlog below. Owner: *"I have no percussion instrument, no good mic, no friend who
plays. Can I use percussion audio from the internet until I record my own? I'll make it non-profit at
the beginning anyway."* Same question for ney and clarinet, which the owner plays at amateur level.

**Answer: yes, and it is legal.** But the first pass of advice put NC in a list beside unlicensed
audio, and the owner read that as *"NC is illegal"* — it is not. The correction is the useful part of
this entry, because it changes what to do:

- **CC0** — no conditions, ever, including commercial.
- **CC BY-NC** — **legal right now**, while the app is free. It only carries a bill if the app is
  monetised later.
- **Unknown licence** — the actual blocker, and what most search results are. Non-profit does not
  cure it.
- **"No redistribution" packs** — the non-obvious blocker, and it covers **paid** libraries.
  Distributing the sample *files* is forbidden by most of them; a web app serves the raw file and
  anyone can pull it out of the network tab. So paying for a good library does not solve this.

**What CC0 does and does not cover**, which decided the per-instrument plan: hand percussion and the
Western orchestra are well covered; **ney, oud, kanun, tanbur, kemençe, zurna are thin to
nonexistent** — the same gap that gives this app its niche. And "a recording exists" is not "a sample
set exists": a sampler needs matched tone, level and room, which one person's uploaded phrase is not.

So: **percussion + clarinet/violin from CC0** (equally easy to find as NC, so NC would buy a future
obligation for nothing), **oud from Karplus–Strong** (no files at all), **ney recorded by the owner**.
That plan needs no NC content anywhere. NC stays acceptable where CC0 is genuinely thin, rather than
stalling a feature.

**The point worth keeping about self-recording:** the owner's "I'm an amateur and my mic is bad" is
probably an overestimate of the bar. A sampler wants one steady ~2-second tone per pitch — no
phrasing, no tempo, retakeable twenty times. Holding one clean note is not the skill that playing a
phrase well is. And for sustained single notes the *room* matters more than the microphone. Ney is
simultaneously the instrument with no CC0 coverage and the one this app is most likely to be used
with, so the owner is plausibly its cheapest source.

Written into [../features/README.md](../features/README.md) as an "Audio assets" section governing
both F1 and F2, with the swap discipline that makes any of it reversible: no audio in the bundle,
`source` + `license` per file from the first one, `/THIRD-PARTY.txt` extended as files land. Decision
row in [../DECISIONS.md](../DECISIONS.md). ⚠ The failure mode being designed against is not a
lawsuit; it is *"I no longer know where four of these files came from"*, which makes the set
unauditable and the swap impossible.

## 2026-08-08 — a post-beta feature backlog, and STATUS split a second time

Owner, after the beta went live, asked for advice on four ideas and then to write them down as
TODO: a better model, real instrument sounds for playback (ney, oud, kemençe, clarinet), usul
percussion with darbuka/tef, and a new tab showing finger positions on an instrument while the piece
plays.

**Where they went.** "Better model" is not a feature and already has a home (Round 3). The other
three became **[../features/README.md](../features/README.md)** — a new track doc holding the design
work, not a ladder in progress. The one property that made them worth grouping: **none needs the
server, a GPU or any new ML.** They are client-side, they touch playback and the view layer only,
and they run alongside Round 3 without touching `apps/web/src/omr/`.

Three findings from the design pass worth keeping, because each one kills an obvious approach:

- **Off-the-shelf sound libraries cannot be used.** SoundFont/GM/commercial packs are built around 12
  pitches per octave; this project has 53. The fix is sampler practice — play the nearest recording
  back slightly faster or slower (`playbackRate`) to land on the exact `freqHz` the `Timeline`
  already carries. Karplus–Strong is the better answer for the plucked instruments: no samples, no
  licence, and natively microtonal.
- **The famous free orchestral sample sets are NonCommercial** (Philharmonia among them) — the
  *exact* bind that emptied `SAMPLES` the same day. CC0 or self-recorded only. Written into the
  feature doc next to the plan, not left as a thing to rediscover.
- **The fingerboard tab is a formula, not a table, for fretless instruments** —
  `length × (1 − openStringFreq / noteFreq)` accepts any frequency, so all 53 komas are exact. A
  12-tone app cannot draw a koma position; this is the one feature of the four that no general OMR
  app could copy.

**Why STATUS was split again.** Adding one backlog line pushed it to 402 lines, over the 400 cap —
and cramming it back down would have preserved exactly the problem the cap exists to catch. "Now"
had grown to ~190 lines of *what was built*: W9's deploy, the batching withdrawal, W0–W7, the makam
feature, the style pass, the editor's whole step list. That is settled context, not current state,
and most of it also lived in `mvp/rungs.md` and `mvp/editor-built.md`.

So the product track got the same treatment the model track got on 2026-08-07:
**[../mvp/standing.md](../mvp/standing.md)**, mirroring `rung3/standing.md`. STATUS went **402 → 198
lines** and now holds only "now" and "next". `check_docs.py --facts` passes, so nothing was dropped —
the facts moved, they did not evaporate.

⚠ **One real defect the split exposed:** STATUS named *two different* next actions — "redeploy,
carrying the copyright pass" at the top and in Track A, and "EDITOR STEP 9" in the middle. Resolved
in favour of the redeploy (the copyright pass is the newest commit and is not on the live site);
editor step 9 is now Track A item 1, the next *build* item.

## 2026-08-08 — the copyright pass: the app stops publishing other people's work

Owner's question, before telling anyone about the link: *"if I publish this app publicly, is there
any problem in copyrights."* There was. The site had been public and unauthenticated since
2026-08-06, so this was already past tense, not hypothetical.

**What was actually being published.** Four scores at the `public/` root, served by Netlify and
tracked in the **public** GitHub repo, plus a neyzen.com screenshot (`Meltem - 1. Hane.png`)
committed at the repo root — it had slipped past the `test_images/` and `data/real/*` rules that
catch everything else. The `.gitignore` already said "don't redistribute dataset content" over
`sample.json` and `scores/`, so the intent was there; `prune-dist.mjs` was deliberately keeping the
root four as the Sample dropdown, and that is where it leaked.

**The licence that decided it.** SymbTr is **CC BY-NC-SA 4.0**. Attribution and ShareAlike are
paperwork; **NonCommercial is not** — it binds the app for as long as a derived file is served. The
owner picked removal over attribution to keep the app unencumbered, which is why there is now no
Sample dropdown at all rather than a credits line.

**A second, independent problem the licence fix would have missed.** Two of the four were
compositions still in copyright under FSEK 5846 (life + 70): *safalar getirdiniz* (Avni Anıl,
d. 2008 → ~2079) and *delisin deli* (Selahattin Pınar, d. 1960 → ~2031). The other two are public
domain (Tatyos Efendi d. 1913, Zekai Dede d. 1897). So the dataset licence removed all four, but
composition copyright would have removed two of them anyway.

**What was checked and found clean**, worth recording because it is the biggest risk reducer here:
the decode server **never writes an uploaded image to disk** — `apps/server/src/index.ts` logs a
size and a count and nothing else. There is no library of other people's sheet music on a server.
Bravura already shipped with its `OFL.txt` beside it, which is the one thing that was correct from
the start. And the base model `Flova/omr_transformer` is **Apache-2.0**, so the fine-tune is
publishable — it just owes the attribution §4 requires, which is why `hf/README.md` now exists.

**The guard that matters is not the empty `SAMPLES` list.** Anything under `public/` is served to
whoever guesses its filename, so "no UI links to it" is not "not published". `prune-dist.mjs` now
**fails the build on any `.json` at the dist root** — chosen over a name list because a name list
cannot catch a *new* score. `fonts/glyphnames.json` is Bravura's own and sits a level down, so the
root-only rule needs no exception. Negative-tested by planting a file: exits 1.

**What it cost elsewhere.** Removing the auto-load broke an assumption four browser smokes shared:
they waited on `#app[data-ready="1"]` after a bare visit, which only worked because a sample loaded
itself. `data-ready` means "a score is installed" and that is now honestly false on first visit, so
the attribute was left alone — `editor-smoke` asks for `?score=` (its grace-note section already
did), and `app-smoke` / `page-smoke` / `coldstart-smoke`, which make their own score from an upload,
wait on `#page-input` instead. One live bug came with it: `UploadHero`'s `compact` prop read
`sampleFile === ""`, which meant "a user loaded this" only while a bundled sample existed — with
`SAMPLES` empty it is always true, and the app would have opened in the shrunken state with nothing
on screen. It reads `!!doc` now.

**Verified after the change:** `typecheck`; `npm test` 217/217 round-trip both modes; `smoke:editor`
ALL PASS including the grace-note geometry section, still reading its 427 boxes off the local
`beyati-delisin.json` through `?score=`; `smoke:page` PASS end to end from the empty state (7 staves
→ 16 strips → 344 notes, playback started); `build:app` 11 files / 42.7 MB with no score in `dist/`.

⚠ **Two things deliberately left for the owner.** The files are out of HEAD but remain in the repo's
**git history**, and the repo is public — clearing that needs `filter-repo` and a force-push that
breaks every clone. And there is still no LICENSE file, so the repo defaults to all rights reserved.

⏭ **Not deployed.** The live site still serves the old build.

## 2026-08-08 — the "one giant note" was a grace note's bounding box

Owner, from a real upload: in edit mode a huge tinted rectangle covered much of the page, and nothing
could be edited until it was deleted with the ✕. Not a decode problem and not a stray note — a
**geometry bug in the editor's click targets**, and the notes people deleted to escape it were real.

**Cause.** `SheetView`'s `noteBoxOf` trusted `StaveNote.getBoundingBox()`, which VexFlow computes by
**merging every modifier's box** into the note's. `GraceNoteGroup` never overrides
`Element.getBoundingBox()`, and that reads `this.x`/`this.y` — still **0**, because the group
positions its inner notes and never itself. Merging a box at the SVG origin stretches the note's box
from the top-left of the score all the way down to the note. So the bug fires on exactly one thing:
**a note carrying a grace note**, which is why no bundled sample showed it and no check caught it.

**Measured before fixing, on `beyati-delisin.json`** (the one bundled score with grace notes, 14 of
them): 14 boxes anchored at the origin, largest 949×1805 px, and **126 of 134 on-screen boxes had
their own centre stolen** by a giant box lying over them. That last number is the report restated —
almost every click in that region went to the wrong note. Numbers: [../METRICS.md](../METRICS.md).

**Fix.** A box that reaches the origin is rejected, and the note's own ink is used instead —
noteheads plus stem, from `getNoteHeadBounds()` / `getStemExtents()` / `getGlyphWidth()`, all of which
report real positioned geometry. ⚠ **The test has no tunable threshold in it, deliberately**: a drawn
note has a clef to its left and a title above it, so nothing legitimate can sit at x ≤ 0 or y ≤ 0 —
only an unpositioned modifier can. If VexFlow ever fixes `GraceNoteGroup`, the branch stops firing on
its own. Ordinary notes keep VexFlow's box, so their click targets are byte-identical (median 18×47
before and after).

**`smoke:editor` now covers it, on a score that HAS grace notes** — the default sample has none, which
is precisely why the bug shipped. Two assertions, neither tunable: no box may sit at the sheet's
origin, and clicking a box's centre must land on that box. Confirmed to fail without the fix
(126 violations) and pass with it, because a check that cannot fail proves nothing.

## 2026-08-08 — a cold server is now waited for, not abandoned

Owner, immediately after the redeploy found it: fix the cold-start fallback. Built, checked and
deployed the same day — Netlify `6a771a5cc56797b5dfe8e246`.

**Client-only, which is the part worth remembering.** The server's behaviour was already right: it
listens before loading so Cloud Run does not read a slow boot as a failed start, answers `/health`
with `ready: false`, and reserves 503 for a load that genuinely failed. The bug was entirely in
[`apps/web/src/omr/remote.ts`](../../apps/web/src/omr/remote.ts), which treated that honest 503 like a
dead server. So no image rebuild, no Cloud Run redeploy, no Hub upload — and `decode.ts` was not
touched, so nothing moved in parity.

Two halves, in the order they matter:

1. **The retry (the correctness half).** A `ready: false` 503 now raises a distinct
   `ServerWarmingError`; the router polls `/health` for up to **40 s** and re-POSTs once ready. The
   180 s budget already allowed this — the old code fell back rather than spend 9 s of it.
2. **The warm-up ping (the polish half).** `warmDecodeServer()` fires one `/health` when the app
   opens, so a container is usually ready before a file has been chosen. Fire-and-forget; it cannot
   delay first paint or fail visibly.

⚠ **The half that keeps it honest: only `ready: false` is waited on.** `model failed to load` and
every other failure — offline, CORS, 500, 413, 429, a malformed reply — still fall back immediately.
"Retry any 503" would strand a user behind a broken container for the full 40 s, which is a worse bug
than the one being fixed and would have looked like a hang.

**`npm run check:coldstart` is the new check, and it exists because nothing else could have caught
this**: every other check runs against an already-warm server, which is exactly why `smoke:live` — the
only one that talks to a service that scales to zero — was what found it. It puts a deliberately-cold
proxy in front of a real decode server so the cold window is a **parameter, not a race**: cold for
12 s and the page still finishes on the server (9/26/399/26); a failed load draws one `/decode` and
zero follow-up polls. That second run is the regression guard on the paragraph above.

Also corrected while in the strings file, owner-reported: the upload hint promised **"yaklaşık 20
saniye"**, which was never measured and undersold a page by half. It now says **35–55 sn**, the same
range the app's own `expectServer` already used — one number, two places, now agreeing. The
cold-start hint moved from "10–30 sn" to "10–15 sn", which is true now that the wait is real.

Green before shipping: `typecheck`, `npm test`, `check:coldstart`, `smoke:build` (both paths,
`9/26/399/26`), and `smoke:live` after the deploy (server 48.4 s, fallback 72.5 s, same score).
⚠ **Still owed: one live run against a genuinely idle container.** It was armed as a 21-minute wait
and cancelled — the owner wanted to record a demo video, and any use of the app warms the service and
voids the test. The mechanism is proven locally; this would only confirm it on the real one.

## 2026-08-08 — the redeploy: makam selection, the style pass and the editor go live

One build carrying everything since 2026-08-06: **makam selection**, **the style pass** and **the
editor, steps 1–8 + 10**. Netlify deploy `6a7713bc1830de6894e19afe` replaces
`6a74d71557de4c1a2264d10e`; the CDN moved **4 files**. <https://komavision.netlify.app>.

**Nothing server-side was touched, and that was checked rather than assumed.** `git diff
4fd91c9..HEAD` reaches nothing under `apps/server/` or `apps/web/src/omr/`, and `apps/server/` has no
dependency on `packages/core` (where the diff actually landed) — so no Cloud Run rebuild and no Hub
re-upload were needed. A frontend-only redeploy is two commands, and knowing *that* is what kept it
to two.

Pre-flight, in this order: `typecheck`, `npm test`, then `smoke:build` against a local `dev:server`
(the live server refuses a preview origin by design). It came out **9/26/399/26 on both paths —
identical to the 2026-08-06 run**, which is the reassurance STATUS asked for: the palette's follow-up
fixes and steps 5–8 changed nothing the built artifact reads. ⚠ The `dist/` that `smoke:build` leaves
behind is baked with `localhost:8080` and a throwaway weights port, so the shipping artifact is a
*second* build with both real URLs — verified by grepping the bundle for them, and for the absence of
`localhost`.

**The editor was driven on the deployed bundle, not just on dev.** `smoke:editor` uses Vite's
`createServer` and `smoke:live` only exercises decode, so steps 1–8 had never run in a production
build on the real host — the exact "what ships was never what was tested" shape that cost W9 a day.
A throwaway Playwright pass (scratchpad, nothing added to `package.json`, because `#save-json` is
about to be deleted) found it all working: 27 tools arming, glyphs inside their buttons against the
real Bravura, select/delete/undo, ghost-previewed insert, the palette's Çal and its playhead.

### ⛔ And it found a real one: a cold container does not delay the server path, it CANCELS it

`smoke:live`'s **first** run failed — `data-where=local-fallback` where `server` was wanted, with a
503 in the console. Not a deploy fault and not flakiness to retry past:

- Cloud Run routes traffic as soon as the container **listens**, which `apps/server/src/index.ts`
  does before loading its graphs (deliberate: `/health` then answers `ready: false`, and a 503 is
  reserved for a load that genuinely failed).
- So a `/decode` arriving in that ~9.5 s window gets `503 model still loading`.
- `remote.ts` treats **any** error as "fall back", with no retry — while holding a 180 s timeout
  budget it would happily have spent waiting 9 s.

Consequence: **a friend's first upload after any idle period is read on their own machine** and pulls
211 MB of weights, silently. At n=2 friends uploading occasionally, that is not the edge case — it is
close to the common case, and it undoes the one thing the server was built for (a cool laptop). The
docs said a cold start costs "about 10 seconds extra"; that was never measured and is wrong.

Corrected in [../METRICS.md](../METRICS.md), [../mvp/latency.md](../mvp/latency.md) (option 1 is now
a correctness fix, and needs a client that retries a `ready: false` 503) and
[../mvp/hosting-setup.md](../mvp/hosting-setup.md) (the owner will see "read on your machine" on a
first upload and should know nothing is broken). **Left unbuilt on purpose** — the current behaviour
is what `index.ts` and `remote.ts` were each deliberately designed to do, so changing the contract
between them is an owner call, not a tidy-up. Re-run warm, `smoke:live` passes on both paths.

## 2026-08-08 — gamzedeyim deva is the default sample; aldanma leaves the dropdown

Owner: the page should open on **gamzedeyim deva** (uşşak · sofyan), and **aldanma dünya** should
not be offered at all. The Sample dropdown is now two entries — gamzedeyim first, so it is what
loads on startup, then safalar getirdiniz.

⚠ **`apps/web/public/sample.json` (aldanma) is still on disk, deliberately.** It is out of the UI,
not out of the repo: `npm test`'s round-trip corpus reads it **by name**
(`tools/render/stitch-test.ts`), and the manual checks drive it through `?score=/sample.json`.
Deleting the file would break the test corpus for no gain — it is gitignored anyway (SymbTr-derived,
not redistributed).

⚠ **`smoke:editor` drives whatever loads first, so this changed what it tests** — from a 274-event
acem düyek score to a 541-event uşşak sofyan one. It passes unchanged, which is worth noting: every
target it picks (a note carrying an accidental, a note in the last system, three equal plain notes
in an interior bar, a gap between two noteheads) is *searched for* in the loaded document rather
than hardcoded, so swapping the sample exercised that and found nothing brittle.

## 2026-08-08 — three controls come up out of Gelişmiş, and the transposition list speaks komas

**Owner: transposition, *porte değişmesin* and the accidental mode do not belong in a drawer
labelled "geliştirici ayarları".** They are now in the **transport bar**, as a second cluster
beside the listening controls. The reasoning is the same one that put the style pass in front of
W10: a ney player transposing a score is using the app exactly as intended, and burying that under
a developer panel says the opposite. What stays in `Gelişmiş` is genuinely for the project —
sample/JSON loading, the strip exporter, the slice inspector, the repeat preview.

**Two renames, both to what the thing is actually called:** *Aktarım* → **Transpozisyon**, and
*Değiştirme işaretleri* → **Arıza işaretleri**.

**The transposition list is now in komas, named by scale degree where one lands.** It used to read
"−Dörtlü (−22)"; it now reads **"−4 ses (22 koma)"**. The unit is the koma because that is what the
app is about and what `transposeDoc` and `?transpose=` take; the degree goes first because a player
thinks "up a fourth". The comma counts are the çargâh scale in AEU — 9 + 9 + 4 + 9 + 9 + 9 + 4 = 53
— so 2 ses = 9, 3 ses = 18, 4 ses = 22, 5 ses = 31, 6 ses = 40, 7 ses = 49, 8 ses = 53. Below a
degree the label is plain commas (1, 4, 5, 8 — the four AEU accidental sizes), which is the step
size that actually gets used. Eleven magnitudes each way instead of seven, and regular rather than
curated.

Two small decisions while placing them, both visible in the screenshot and both reversals of a
first attempt:

- **A vertical rule between the two clusters was tried and removed.** The bar wraps, and a divider
  left dangling at the end of a line reads as a mistake. The reading three are wrapped in their own
  flex group instead, so they stay together and never interleave with the listening controls.
- **"Porte değişmesin" is NOT disabled at transposition 0**, though it does nothing there. A player
  ticks "keep the staff" and *then* picks the interval; a checkbox that only wakes up afterwards
  makes that order impossible.

Green: `typecheck`, `npm test`, `smoke:editor`, `smoke:app`, `smoke:page`. No check drove any of the
three controls, so nothing needed rewiring — which is the `data-*` contract paying off again.

## 2026-08-08 — rests and the numbered koma signs move into the palette

**Owner, straight after the modal was deleted: put rests and the other koma signs in the palette.**
Two of the four capabilities the deletion cost are therefore back the same day; only lyric editing
and exact koma/Hz entry are still gone ([../mvp/editor.md](../mvp/editor.md)).

**Rests are the SAME tool as a note value, with `rest: true`** — not a new kind. They insert and
re-value through exactly the same paths, so there is no second insert path to keep in step and
"arm a thing, click a target" stays true of the whole palette. An **Es** row of six rest glyphs sits
under the note values; arm one and click blank staff to insert a rest, or click a note to turn it
into one. Two new core primitives: `toRest`, which clears the **whole** pitch side (koma, both
names, `freqHz`, and the lyric — nothing sings on a rest), and `toNote`, its inverse.

⚠ **`toNote` needs a spelling handed to it, because a rest has none to keep** — so the editor takes
it from the **click's height**, the same mapping the insert ghost uses. That makes "the model read a
rest where a note belongs" a one-click fix instead of a delete-and-reinsert. The rest preview
deliberately does NOT follow the pointer up and down: a rest goes mid-staff, and a ghost that
tracked the pointer would promise a pitch the insert then ignores.

**All thirteen alterations are now in the accidental row**, not seven. The palette had been carrying
the AEU signs only, on the argument that the numbered ±2/±3 would need text labels and make the row
unreadable — **that argument did not survive checking**: every one of them has its own Bravura sign
(`accidental2CommaSharp` and friends), so they read as signs like the rest. ±8 (büyük mücennep) had
been missing from the palette too, which was simply a gap.

⚠ **A ±2/±3 is stored exactly and DRAWN SNAPPED.** `toAeuAlter` prints the nearest standard sign,
because that is what a Turkish edition prints — so those two tools move the sound exactly and the
printed sign only approximately. The tooltip names the comma count so the difference is visible
before you click, and `smoke:editor` asserts on the stored comma (+2) rather than on the glyph.

The palette is 27 armable tools now, and `smoke:editor` still arms **every one** and measures
**every glyph's ink** against the real font — the check that exists because a Bravura glyph paints
outside its em box and one tool's ink once stole its neighbour's clicks. Both passed first try with
the twenty new buttons, including the two widest signs in the set (the numbered sharps, ~45 units
wide against 23–34 for the others).

Green: `typecheck`, `npm test` (217/217 both modes + new `toRest`/`toNote` cases), `smoke:editor`,
`smoke:app`, `smoke:page`.

## 2026-08-08 — the per-measure modal is deleted

**Editor step 10, taken out of order at the owner's request** (step 9, `Save JSON`, is still owed).
`apps/web/src/MeasureEditModal.tsx` is gone, and `apps/web/src/AccidentalSelect.tsx` with it (both
deleted, not moved) — the modal was that dropdown's only caller, and the palette's accidentals come from `ui/accidentals.ts`. With nothing armed, a
click on blank staff now clears the selection; **no window can appear over the score any more.**
Also gone: `onSaveMeasure` and the `editing` state in `App`, `onMeasureClick` in `SheetView`, the
`measureModal` strings, and the modal-only CSS (`.kv-table`, `.kv-modal__panel--wide`).

**Four capabilities went with it, and none has a replacement**, which is worth saying plainly
because each existed this morning:

| Gone | Was |
|---|---|
| Adding a **rest**, or turning a note into one | the row-type dropdown. Deleting a rest still works; only creating one is gone |
| Editing a **lyric syllable** | the `Hece` column — the app's only lyric editor |
| Exact **koma / Hz** entry | the Gelişmiş tab's two numeric fields |
| The numbered **±2/±3/±8** alterations | `AccidentalSelect`'s dropdown; the palette carries the AEU signs only |

The judgement on each is in [../mvp/editor.md](../mvp/editor.md); the rest is the likeliest to come
back, as a tool in the palette's duration row.

⚠ **`isMeasureValid` (core) now has no consumer.** It was the modal's Save gate, and the editor's
off-meter mark deliberately does not use it — the length you would naturally hand it,
`Measure.lengthBeats`, is computed from the bar's own contents, so the answer is true by
construction. Kept, with that written into its docstring, because the predicate is sound with a
reference length from outside the bar.

⚠ **A flake in `smoke:editor` surfaced on this run and is now fixed properly.** "A bar-1 target
plays from the top of the sheet" read the playhead 300 ms after the FIRST Çal of the run — which is
also when the WebAudio context starts, and in headless Chromium that can take over a second. The
playhead is hidden until the clock returns a position, so the check read "hidden" and looked exactly
like a broken seek. It now polls for the playhead instead of sleeping. Not caused by the deletion,
but found by it.

Green after the deletion: `typecheck`, `npm test` (217/217 both modes), `smoke:editor`, `smoke:app`,
`smoke:page`.

## 2026-08-08 — the tuplet tool, and the bar that says it does not add up

**Editor steps 7 and 8 are built and green** ([../mvp/editor.md](../mvp/editor.md), build notes in
[../mvp/editor-built.md](../mvp/editor-built.md)). They shipped together on purpose: applying a
triplet turns 3 × 1/8 into 3 × 1/12, so it leaves a short bar **every single time**, and step 8 is
the only thing on screen that says so.

**Step 7 — one tool, both directions.** Arm ÜÇLEME, click a note and the note two along: the three
become a triplet. Click **any member** of an existing one and it comes apart again (owner's call —
a note already inside a triplet cannot mean "start a new run", so the removal needs no second
click). Dimming starts **the moment the tool is armed**, not after the first click: anything that
cannot begin a legal run is pale and `pointer-events: none`, so the page refuses it instead of
swallowing a click that does nothing.

**The rule that took the thinking: a member must be a PLAIN `1/2^k` value.** Not dotted, not a
tie-split, not already a tuplet. This is arithmetic, not fastidiousness — three equal members at ×⅔
sum to `2v`, and a group only closes when its sum lands on a plain value, so `2v` is plain exactly
when `v` is. Three dotted 8ths would sum to 9/16, never close, and draw the *incomplete-group*
bracket — which exists to flag a MODEL mistake. Letting the editor produce that mark by hand would
have quietly destroyed its meaning. The same reasoning is why only a **closed** three-member group
can be removed: `tupletGroupsIn` also yields the model's unclosed runs, and ×³⁄₂ on one of those
invents a rhythm nobody read.

**Where the code went, and why it is split in two.** "Which notes" lives in `tools/render/rhythm.ts`
(`plainTupletBase`, `tupletRunFrom`, `closedTupletAt`), beside the functions that draw the bracket
and write the `\tup3` label — a second copy in the app is exactly the pixels-vs-labels divergence
the one-code-path rule exists to prevent. The rewrite is one core primitive, `scaleDurations`. Both
existing rhythm functions are **untouched**: 217/217 label round-trips, both modes, so no strip and
no label moved.

⚠ **Nothing about a tuplet is stored**, so no attribute can prove one was made — `smoke:editor`
counts the marks the **engraver drew**. The first version counted only the curved arc's italic "3"
and read 0: the sample happened to draw VexFlow's bracket instead, and the style is a per-piece
coin. It now counts both.

**Step 8 — the off-meter mark.** A `+` / `−` badge at the bar's top-right in the edit overlay,
against the **derived meter** (never `Measure.lengthBeats`, which is computed from the bar's own
contents and is therefore true by construction). Three calls inside it: **edit mode only** (a friend
opening a decoded page should not meet eight warnings before touching anything), **the first and
last bar warn only when OVER** (a pickup and a closing bar are legitimately short), and **the
modal's Save is no longer gated on it** — over- and under-full bars are ordinary, reachable states
of the document now, so locking someone inside a modal over one would be wrong the same way a ✕ that
refuses to work is wrong.

⚠ That exemption is load-bearing for anyone writing a check, and it cost a debugging round here: a
triplet made in **bar 1** produces no mark, which reads exactly like a broken indicator. The smoke
check now picks its run from an **interior** bar.

Green: `typecheck`, `npm test` (217/217 + 90/90 + the new tuplet unit cases), `smoke:editor`,
`smoke:app`, `smoke:page`. The brief's step list is down to the two deletions — `Save JSON`, then
`MeasureEditModal`.

## 2026-08-08 — the interface is repainted İznik turquoise

**Owner, on seeing the style pass: it looks like Claude's website.** Fair — the W9.6 direction was
warm cream paper with a terracotta accent, which is a well-known house style and not ours. The
palette is now **İznik**: the white ground and turquoise of Turkish çini. Cool ivory surfaces
(`--paper #f6f8f7`, the score itself on pure white so nothing on the page is lighter than the
music), near-black ink carrying a trace of the accent's green, and one accent at `#0f766e`.

**Tokens only** — `apps/web/src/styles/tokens.css` plus one hardcoded modal backdrop that had been
missed in `app.css`. No layout, no component, no copy and no check moved; the accent was already
used exclusively through `var(--accent)`, which is what made this a ten-line change.

Two things the turquoise buys beyond not being terracotta: it belongs to the repertoire the app is
for, and **the editor's overlays were already teal** (selection, hover, the playhead, the insert
ghost), so the accent now agrees with them instead of arguing. Those overlays keep their brighter
`#14b8a6` on purpose: they are drawn over black notation and have to out-shout it, which a token
sized for buttons on paper cannot do.

⚠ **`--accent` may not be lightened.** The primary button is the one place this palette has to clear
a contrast bar (white on `#0f766e` ≈ 4.8:1), and it is the only reason that particular teal was
picked over a prettier lighter one.

⚠ **The engraved SVG is untouched**, as it must be: its `#222` ink is training-strip pixels, not
chrome.

## 2026-08-08 — the palette inserts, and the bar absorbs it

**Editor step 6 is built and green** ([../mvp/editor.md](../mvp/editor.md)). Arm a note value, click
blank staff, and a note lands there: **pitch from the click's height**, duration from the tool. That
completes the note-value row's meaning — until now arming 1/8 and clicking blank staff opened the
old measure modal, which is not what a palette promises.

**One new core primitive**, `insertInMeasure` — the mirror of `deleteEvent`: it splices into the
bar, stamps that bar's own number on the new event, renumbers, and **checks no total**. The bar comes
out over its length exactly as a delete leaves one short, because edits absorb and bar lines never
move. Its companion `insertIndexIn` exists for an unobvious reason: `renumber` rebuilds every event,
so the object just spliced in cannot be found again by identity, and the caller has to *ask* which
index it ended up with in order to select it.

**Three rules keep the splice honest**, and each was a way it could have gone quietly wrong:

- **The position is resolved inside the target measure only.** `groupMeasures` starts a new measure
  wherever the `bar` number CHANGES, so a note stamped bar 7 spliced outside bar 7's own run cuts one
  bar into two on the page — bar lines moving, the one thing the absorb rule exists to prevent.
- **A leading grace run belongs to the note that follows it**, so an insert before a note goes before
  its graces too — but never past the measure's first event. When the run reaches the bar's head the
  new note simply becomes the bar's first event.
- **A doc with no `bar` numbers is run through `assignBars` first.** `groupMeasures` derives bars on
  the fly and discards the copies, so stamping only the new event would leave one numbered event in
  an unnumbered array. The app assigns bars at load; this makes the primitive safe standalone.

**Two owner calls, taken before building.** A **ghost notehead** previews the insert (a teal oval,
moved by mutating the element like the playhead — never state, because a preview that re-rendered the
overlay per mouse-move is the cost that got the measure hover highlight removed in slice 1). And an
inserted note takes the **key signature's** alteration for its letter, so it is born koma-flat under
a koma-bemol signature and the engraver prints nothing on it; natural would have printed a ♮ nobody
asked for.

⚠ **A preview cannot check the mapping it shares.** The ghost and the insert come out of one
function, so "they agree" proves self-consistency and nothing else — an origin off by a line would
agree with itself while putting every note a third out. `smoke:editor` pins the origin against the
**playhead** instead: it spans the staff symmetrically, so its vertical centre is the middle staff
line, which in treble is **B4**. No constant of the test's own.

⚠ **Two false trails while writing that check, both the same shape: `elementFromPoint` answers null
off-screen**, which reads exactly like "the ghost is broken". The gap-finder now scrolls the sheet in
first and treats a null hit as off-screen rather than as blank staff — and the playhead check scrolls
to the **playhead**, not to the top of the sheet, because Çal starts at the last edited bar and the
earlier section had left that at bar 31.

Green: `typecheck`, `npm test` (18 new `insertInMeasure` checks), `smoke:editor`, `smoke:app`,
`smoke:page`.

## 2026-08-08 — Çal from the bar you just fixed

**Editor step 5 is built and green** ([../mvp/editor.md](../mvp/editor.md)). The palette has its own
Çal/Dur, and Çal plays from the **last edited bar**. The reason it is needed at all is easy to miss:
in edit mode a click on the sheet selects or inserts, so `SheetView` binds its click-to-seek handler
only when `!editMode` — entering edit mode silently removes the only way to hear one bar. This is
what replaces it.

**It cost almost nothing, because the pieces existed.** One core primitive (`measureOfEvent`, over
the same `groupMeasures` the sheet and the modal use), one number in `App` (`lastEditMeasure`), and
two buttons calling the existing `onSeekMs` / `onStop`. No new backend code and no second notion of
where a bar starts — `Measure.startMs` is what non-edit-mode click-to-seek already hands to
`onSeekMs`.

**Three decisions, all owner-approved before building:**

- **Çal always restarts from that bar**; pause/resume is not duplicated in the palette, because the
  transport bar is still on screen in edit mode.
- **An edit still stops playback.** editor.md's "rebuild the timeline and resume from the same
  millisecond" constraint is therefore **not built**, and now says so in the brief rather than
  reading as done. It is also self-consistent: Çal-from-last-edit exists *because* you stop, fix,
  and press Çal. Picking it up later means firing on gesture end, which the pitch drag (an edit per
  animation frame) does not currently signal.
- **Undo/redo do not move the remembered bar**, unlike the selection, which they clear. The bar you
  were working in is still the bar you want to hear.

**The remembered value is a measure number, not an event index** — a delete renumbers every event.
⚠ And it can outrun the score: deleting a bar's last note removes that measure, so the lookup falls
back to the top rather than throwing.

**The check that matters is on the playhead, not on the attribute.** `data-play-from` says which bar
Çal *aims* at; it cannot say the audio *began* there — a wrong `startMs` would leave it green. So
`smoke:editor` measures the playhead's position down `#sheet-surface`: aimed at bar 1 it sits 0.050
down, aimed at bar 31 of the sample it sits 0.946. This works even with a suspended AudioContext,
because `getPositionMs` is `startMs + elapsed`, and `startMs` is exactly the seek under test.

⚠ **One check had to move, and the reason is the undo decision above.** "Nothing edited yet → no bar
named" was written into the new section, where it failed: the sections above it had already edited
bar 1, and `rewindAll` undoes the document without moving the pointer — by design. The assertion
belongs at the one honest place for it, right after entering edit mode on a freshly loaded score,
and that is where it now lives. The failure was the check's assumption, not the code's behaviour.

Palette geometry is unchanged: still **136 px**, still **0 px** of sheet cut off at a 1280 px window,
so editor.md's measured cut-off table still holds. Verified: `typecheck`, `npm test`,
`smoke:editor` ALL PASS, `smoke:app`, `smoke:page`.

## 2026-08-08 — the armed palette, and the glyph that stole its neighbour's clicks

**Editor step 4 is built and green** ([../mvp/editor.md](../mvp/editor.md)). A column beside the
sheet holds six note values (Bravura glyphs) and the AEU accidentals; arm one, click a note, the
note takes it. `Esc` and **↖ Seçim** disarm, leaving edit mode disarms, and with nothing armed the
sheet behaves exactly as slice 1 left it. One new core primitive, `withAlter` — the mirror of
`nudgePitch`: the alteration moves and the staff position does not.

**A Bravura glyph paints outside its em box, and that broke clicking.** The 1/32 tool's ink overhung
the 1/8 tool above it, so `elementFromPoint` in the *centre* of the 1/8 button returned the 1/32 one
and a click there armed the wrong value. It was found because the new smoke assertions failed on the
armed id, and it reproduces by hand — this was a real UI bug, not a Playwright artifact. Fixed with
`overflow: hidden` on the button and `pointer-events: none` on the glyph span, so ink is clipped and
clicks resolve to the button that owns the pixel. Worth remembering for any future glyph button.

**A music glyph's ink is nowhere near its baseline, and that is why the notes broke out of their
buttons.** Measured off the shipped Bravura: a stemmed note draws **87–102 units up and ~14 down**
per 100 of font-size; an accidental is balanced (34/34). Centring the *line box* therefore pushed
the stems out through the top while the space under the notehead sat empty — the ink was never too
big (~30 px inside a 38 px button). `EditPalette` now carries the measured table and shifts each
glyph onto its own ink, and `smoke:editor` measures ink-vs-button against the real font so a font
swap cannot quietly undo it. ⚠ The first attempt at this — clipping with `overflow: hidden` — was
reverted: it cut off the stems and flags, which is the only thing the tools are read by.

**The palette also cost room the page did not have, found by looking at it.** `--page-max` was
sized so the 1020 px engraved sheet fits exactly, so a 164 px palette in the same row pushed the end
of every system off the paper. The **page** now grows by that footprint while editing; the sheet
cannot shrink, because its width is also the training-strip geometry. Edit mode therefore wants a
window ≥ ~1250 px (measured: 1090 → 160 px still cut, 1280 → 0, 1470 → 0), and the owner's call was
to keep the palette beside the sheet and widen the window rather than float it over the paper.

**An absolute edit is not transpose-safe the way a relative one is.** `onNudgePitch` never needed to
think about the transposed staff, because ±1 diatonic step means the same thing in both spaces. An
accidental does not: it is applied in DISPLAY space and the single event is mapped back with the
same `transposeDoc(…, -transpose)` round-trip `onSaveMeasure` already used.

**Deliberately not done, so the bar stays honest.** An edit still absorbs into its bar and bar lines
never move, so a re-valued note leaves its bar over or under length with **no warning yet** — that
is step 8, and it needs the derived meter rather than `Measure.lengthBeats` (which is computed from
the bar's own contents and so is true by construction). The measure modal, `Save JSON` and the piano
roll all still work; the modal is deleted last, at step 10.

⚠ **The editor smoke reads the document through `#save-json`.** Step 9 deletes that button, so it
has to grow another handle first — do not remove the download without moving the harness.

Green on: `typecheck`, `npm test` (incl. new `withAlter` cases), `smoke:editor`, `smoke:app`,
`smoke:page` (7 porte → 16 şerit → 344 nota), `gate:browser` 27/28.

## 2026-08-07 — the editor's first slice, and the bug the refactor found

**Steps 1–3 of [../mvp/editor.md](../mvp/editor.md) are built and green.** In edit mode a click on
a note selects it, an **✕** deletes it, **dragging it** moves its pitch, and **undo/redo**
works (buttons + Ctrl/⌘+Z). The measure modal, `Save JSON` and the piano roll all still work —
step 10 deletes the modal *last*, so there is always a working way to edit.

**The refactor was the load-bearing part, and it found a live bug.** The app had grown two disjoint
edit vocabularies over one document: the piano-roll patched `koma53` + `freqHz`, the modal rebuilt
events from an explicit `{letter, octave, alter}` spelling. Since the sheet reads its staff position
from `parseNoteName(ev.noteName)`, and `updateEvent` **never wrote `noteName`**, *dragging a note in
the roll moved the sound and left the notehead where it was.* Both paths now compose
`packages/core/src/edits.ts`, so a pitch edit cannot half-apply. Pinned by a unit test that asserts
`noteName` moves, and by `smoke:editor` in the real app.

**Two things were deliberately NOT fixed, and saying so is the point.** The roll's *duration* drag
still writes `durationMs` alone and leaves `durationBeats` (what the sheet engraves) stale — the
same bug shape, but fixing it means snapping a continuous drag to a note value, which is the
palette's job. And `noteAE` stays exact rather than AEU-snapped: the Python exporter snaps it (152
of 2,297 notes in the bundled scores), `stitch.ts` and the modal never did, and `withPitch` matches
the two TS producers. Nothing reads `noteAE` but a hover label.

**The brief said to push per-note rects through `onLayout`; that was wrong and they don't.**
`onLayout`'s payload is the contract `stripExport.ts` and `tools/render/render.ts` crop training
strips by, the only consumer of per-note geometry is the overlay in the same file, and `onLayout` is
an engrave dependency — a second non-stable callback prop would re-engrave forever. They are local
`NoteBox[]` state instead, filled in the walk that already records the playhead's positions.

**A trap worth keeping.** `data-edit-mode` ended up
on *two* elements (the toggle button and the sheet), so a check matching the attribute alone picks
the wrong one; the sheet got `id="sheet-surface"` for that reason, found by the smoke failing.

### Owner feedback, same day: DRAG, not the wheel — and no measure hover

**The brief said "scroll it up and down to change its pitch". It is now a DRAG** (owner). The wheel
version shipped first and was thrown away, and the reasons are worth keeping because they are why
a wheel is the wrong instrument here:

- **It fights the page.** The handler has to `preventDefault`, which means it cannot be a React
  `onWheel` prop at all (React registers wheel on the root as **passive**); it has to be a native
  listener attached by ref with `{passive: false}`.
- **It moves the note in jumps, not under your finger.** A mouse notch is one event of ±100–120,
  but a **trackpad swipe is dozens of events of ±2–10** — and every pitch step re-engraves the whole
  score. Acting per event gave **12 steps and 12 re-engraves for 12 synthetic trackpad deltas**, so
  a real swipe threw the note off the staff and stalled the tab on a fanless M4. Accumulating travel
  fixed the symptom, but only by adding a second thing to tune.
- **And the accumulator was fragile in two ways that each looked like "the wheel is dead":** a `let`
  inside the effect is wiped every re-attach (**~6 times during one swipe**), and a time-based
  "gesture gap" is exactly backwards on a slow machine — a step re-engraves, so every event arrives
  "late" and the accumulator resets each time.

**The drag has none of that.** `setPointerCapture` on pointerdown (the note leaves the pointer on
the first step, so without capture the gesture dies), steps measured from where the pointer went
down rather than from the previous event (no accumulated rounding drift), and
`DRAG_PX_PER_STEP = STAFF_SPACE / 2` so the notehead tracks the pointer exactly. Verified:
`Si4b2` dragged up 15 px becomes `Mi5b2` — **exactly three staff steps**, across the octave seam,
carrying its 2-comma flat, and **one undo reverses the whole drag**.

⚠ **A test bug wasted a round in the middle of this.** After `save()` clicks the header button,
Playwright scrolls it into view and pushes the sheet off-screen; the cached bounding box then
pointed outside the viewport, `mouse.move` put the cursor off-page, and **no pointer events were
delivered at all**. That reads identically to "the interaction is broken". `hoverNote` now scrolls
the note into view, re-reads the box, and **asserts the pointer is actually over the intended note**
before acting — so this failure can never masquerade as an app bug again.

**Measure hover is gone in edit mode** (owner): editing is whole-score, so framing a bar says the
wrong thing about what a click does. Note hover moved to CSS (`.kv-note-hit`) rather than React
state, so it costs no re-render — teal on hover, amber + ✕ when selected. Clicking empty space
still opens the measure modal, which is still the only way to insert a note until step 4.

Re-verified after the rework: `npm test` 217/217, `smoke:app`, `smoke:page`, `smoke:editor` all
pass, and the 302 strip PNGs are **still byte-identical** (the new CSS is scoped to overlay divs).

**Undo coalesces by gesture.** `apply(fn, {coalesce})` merges same-keyed edits inside 600 ms, so one
wheel gesture — or one piano-roll drag, which emits an edit per pointer-move — is one undo entry.

**The engraving did not move:** 2 pieces re-rendered before and after, **302 strip PNGs and every
label byte-identical** (only the `.done` marker's timestamp differs). `npm test` 217/217 unchanged,
`smoke:app` and `smoke:page` pass with the same counts (7 staves → 16 strips → 344 notes / 28
measures).

## 2026-08-07 (later) — the editor is specified, and five docs pulled back from the cap

**The modal is going, and the owner specified what replaces it:** press **Düzenle**, the sheet
zooms, a **palette appears beside it**, and you **arm a tool** — a note value, an accidental, the
tuplet sign — then click the score. Clicking a note selects it, shows an **✕** to delete, and the
**scroll wheel** moves its pitch, carrying its accidental. Inserting a note = arm a value and click
empty space, pitch from the click's height. **Playback stays live while editing.** Mus2's shape,
which the owner uses. Brief: [../mvp/editor.md](../mvp/editor.md).

**Reading the code settled three design questions, and two went against the first draft of the
brief.** The owner's instinct was that the sheet is rendered from the model's decoded tokens and
editing should just edit those and re-render — and the tokens *are* real (`\tup3`, `\tupend`,
`\repstart`, `\repend`, parsed in `stitch.ts`). But **`stitchStrips` consumes them**: tuplet members
come out as written × 2/3 durations, and `expandRepeats` **duplicates** the repeated measures into a
playing order ("Output is FLATTENED — what the editor and playback want"). So by the time the sheet
is engraved there are no tokens left. Token-editing was then **rejected on the owner's own
reasoning**: playback needs the flattened doc, and a repeated passage renders twice from one token,
so a click cannot be attributed to a pass.

That resolved the rest. **Repeats stay uneditable** — inserting a repeat barline into already
unfolded music would corrupt it — which also **dissolved the schema fork** an earlier draft raised.
**Tuplets stay editable**, because `\tup3` is arithmetic and not an object: `isTupletMember` is
literally "the duration's denominator is divisible by 3", so the tool multiplies each member by ⅔
and needs no schema change. Two rules the owner set: members must share a duration, and the run must
be contiguous.

**`Save JSON` is deleted, and that retires the rationale this page had been using.** Earlier drafts
justified the rework as "the editor is the Rung-3 labeling loop's tool, so seconds per correction is
labelling throughput". With the export gone that is false, and it was corrected rather than left to
rot. It is a defensible deletion — the labelling loop's primary path is `scripts/rung3/review_ui.py`,
not the web app — and the honest remaining reason is simply that a friend with a wrong note should
be able to fix it.

**The owner then closed three of the four open questions.** Tuplet selection is **first note, then
last note** — and the page must **refuse** any end note that would not make a valid tuplet rather
than erroring after the fact. Reading the draw code turned that into a hard rule: the tuplet digit
is **hardcoded `"3"`** (`SheetView.tsx:392`), so a six-member run — which *would* satisfy
`tupletGroupsIn`, since it also sums to a plain value — would draw a bracket that lies about the
rhythm. **Exactly three members** until that digit is derived from the group size. "Empty space"
means **anywhere** (between notes, before the first, after the last), editing is **whole-score and
never measure-scoped**, and **zoom is dropped** as unnecessary — which conveniently removes the
re-engrave trap it would have created, though the underlying rule stands: no transform on the score
container, because `render.ts` crops training strips from that SVG by rect and `onLayout`'s boxes
*are* those crop rects.

**And one addition solved a problem this page had flagged.** The palette carries its own **Çal/Dur**,
and **Çal starts from the last edited measure**. Edit mode necessarily consumes click-to-seek (a
click now selects or inserts), which would have removed "play from this bar" exactly when you are
hunting for a wrong note; playing from the last edit answers it directly — fix a note, press Çal,
hear the bar. It costs one tracked number.

**The last question closed the same day: the bar ABSORBS.** An insert over-fills its bar, a delete
leaves it short, **bar lines never move**, and a bar that is over *or* under its length **warns**
rather than blocking — rippling was rejected because on a decoded page the bar lines came from the
model's own `|` tokens, and re-flowing rewrites the structure a corrected page most wants to keep.

**Writing that warning up found a circularity, and then something better.** The obvious reference
length is `Measure.lengthBeats` — but it is computed **from the bar's own contents**
(`measures.ts:123`), so `isMeasureValid` is **true by construction** on any freshly loaded score and
can only ever mean "you have changed this bar". A first attempt to measure how often decoded pages
have bad bars returned a meaningless 0/28 for exactly that reason. The honest reference is the
**derived meter** (`deriveTimeSignature`) — and against that, interior bars off-meter run **0/32,
0/60 and 0/108 on three clean SymbTr scores** but **8/28 on a real decoded page**. So the warning is
silent on correct music and lights up where the model misread a duration: **error localisation, as a
side effect of a warning the editor needs anyway** — the half of the 2026-07-27 goal that W8 was
dropped without delivering. ⚠ n = 1 decoded page, the 8 are *candidates* rather than confirmed
errors, and a mid-piece usul change (`Kod` 51) is a known false-positive source. Verify before
promising it.

Also cheap, and worth knowing: **per-note rects are nearly free** — `attachTitles`
(`SheetView.tsx:285`) already walks every drawn note calling `getSVGElement()`, so the same walk
records a rect.

**Then the docs were refactored, not squeezed.** Four files sat at exactly **399** lines and one at
397, against a 400 cap — every one of them one line from failing `check_docs.py`, which is a trap
rather than a limit. Split by genre, each leaving a pointer behind:
`STATUS.md` **404 → 279** (its three "Previously" blocks were real-page-track context, now
[../rung3/standing.md](../rung3/standing.md)); `MANUAL_CHECKS.md` **399 → 225** (corpus/renderer
checks 1–8 out); `mvp/rungs.md` **397 → 192** (W0–W3 out); `mvp/deploy.md` **399 → 340** (the
commands out, so *why* and *how* stop sharing a page); `rung3/labeling.md` **399 → 304** (the two
review queues out). Nothing above 384 now. ⚠ The moves needed link-depth rewriting in both
directions — a `docs/`-relative link does not survive a move into `docs/rung3/` — and
`check_docs.py` caught every one.

## 2026-08-07 — the style pass: the harness became KomaVision

_The prerequisite W10 grew on 2026-08-06, now paid. The release exists to ask two friends about the
**interface**, and there were only two first impressions to spend — an unstyled page would have
bought back feedback we already had._

**The problem that had to be solved first, and it was not a visual one.** Five Playwright tools
drove this DOM by matching English prose: `text=Turkish OMR`, `/read a page:/`, `/read \d+ strips/`,
`/read on the server/`, `/(\d+) staves → (\d+) strips → …/`, and button names like `/Save JSON/`.
That made the user-facing copy load-bearing — a Turkish UI would have broken every one of them at
once, and translating the regexes would only have moved the coupling one step and broken again at
the next rewording. **Rewording is what a style pass IS.** So the facts were separated from the
sentence: `apps/web/src/ui/status.ts` now returns `{ text, state, kind, where, counts }`, and
`#omr-status` renders the non-text half as `data-*`. The checks assert on that; the copy is free.
This landed as **step 0, before anything was styled**, so the tools went green against the OLD UI
first — and from then on any red was unambiguously the redesign's fault. It also made the fallback
assertion *stricter*: `data-where="local-fallback"` proves the configured server was tried and
missed, where `/read on your machine/` also matched a build with no decode server at all.

**What the friend now sees.** Warm editorial paper — ivory, warm near-black ink, one terracotta
accent used only on the primary button, focus rings and the active toggle; hairline rules instead
of shadows, so the chrome sits *below* the engraved score in visual weight. The display serif is
the one `SheetView` already engraves its header in (Georgia), so page and notation read as one
object rather than two typefaces arguing. A webfont was never an option regardless: **COEP
`require-corp` blocks a font CDN outright**, which is worth remembering before anyone proposes one.

**The restructure is what actually stops it reading as a harness**, not the colour. Upload became
the hero and takes drag, drop or **paste** (the real gesture for someone screenshotting a PDF); the
transport kept only the six controls a musician touches; the other twelve folded into a collapsed
**Gelişmiş**. Three blocks of developer prose were deleted, including an empty state that told the
user to run a Python script. Progress is honest — a determinate bar only where a real count exists
(the 41-rotation deskew sweep, the browser's per-strip decode), a moving stripe and an elapsed clock
for the server's single batched request, never an invented percentage.

**Two traps worth writing down.** The elapsed clock must live OUTSIDE `#omr-status`, or
`page-smoke`'s "progress actually moved ≥3 distinct lines" passes for free (it reported 13, which is
real). And `#strips-input` now sits inside a collapsed `<details>`, whose subtree is hidden — so
`app-smoke` opens `#advanced` first, and the file inputs use the clip pattern, never `display:none`,
which would drop them from the accessibility tree as well as from Playwright's reach.

**Checked, on the built artifact, not just in dev:** `npm test` (217/217 round-trip, 90/90 signature
vocabulary), `gate:browser` 27/28 as expected, `smoke:app`, `smoke:page`, and `smoke:build` green on
**both** paths with identical scores. Not deployed yet — that one redeploy carries the style pass
and makam selection together.

## 2026-08-07 — makam selection: the app plays the makam, not the notation

_Owner request, taken before the style pass. Pipeline stage 9's makam half, designed in
`PIPELINE.md` since June and never built. The reason it jumped the queue: playback sounded every
note exactly where the staff spells it, and for a Turkish listener that is audibly wrong on the most
common makam there is — uşşak's segah is not where AEU writes it. A friend opening the link would
hear that before noticing anything about the interface._

**What the research settled.** AEU has four accidentals and several perdes are performed away from
all of them, because the notation has no sign for where they sit. Four deviations have numbers
behind them and made the table; everything else was left out rather than guessed. Uşşak's segah:
dügâh→segah is 6–7 commas in practice (the *eksik büyük mücennep*), not AEU's 8 — the owner chose
the **−1.5 comma** midpoint. Sabâ's hicaz: Rauf Yektâ's 12/11 puts **2.5** commas of flatness on the
re-bemol, not 4, so **+1.5**. Hüzzam's hisar: the pentachord's augmented second shrinks 12 → ~10.5–11
commas, so **+1**. Segah karar: the Ottoman perde sits about a comma below the Arelian, **−1**. And
the row that is not padding — **hüseyni and muhayyer explicitly do NOT take the uşşak lowering**,
which is written into the table as an empty rule list so nobody "completes" it by symmetry.
Sources are in [../mvp/makam.md](../mvp/makam.md); the literature disagrees on magnitudes and the
table takes midpoints, saying so.

**Three owner decisions, all narrowing.** Documented deviations only (every makam selectable, only
sourced ones bend anything). Sound only — no key-signature redraw, so the engraving, `Save JSON`
and `buildStrips` are untouched and the OMR never claims to have read something it did not.
`none` is the default.

**Detection, and the thing that made it hard.** A decoded page has no metadata, so the makam is
guessed from the score: derived signature (`deriveKeySignature` → the string
`data/makam_signatures.json` is keyed on) plus the **karar**, the note it ends on. The karar is not
garnish — `\komaFlat b \bakiyeFlat e \bakiyeSharp f` is printed by hüzzam, karcığar AND sûznâk,
three makams with three different intonations behind one signature.

**A measurement changed the design.** Scored over the 213 bundled scores, ranking by corpus weight
whenever the karar failed to narrow gave 7 audibly-wrong pieces. Declining outright when *some*
candidate declares a karar and the piece ends elsewhere traded **2 wrong bends for 2 pieces that
merely stay as written** — 5 wrong, 4 missed, **204/213 (95.8%) audibly correct**. That is the trade
the feature exists to make: a wrong makam detunes notes that should not move, `none` only declines
to help. ⚠ Measured on **clean SymbTr scores, not decoded pages**, so it is an upper bound; the
residual 5 are beyati-vs-hüseyni-shaped pairs that share both signature and karar and are separated
only by seyir, which nothing here reads.

**Two duplications were accepted on purpose, both pinned by tests.** `SIG_TOKEN_BY_ALTER` in core
mirrors `AEU_TOKEN` in `tools/render/lilypond.ts` (core must not depend on `tools/`, and the label
path is load-bearing) — `npm test` now round-trips all **90 signature variants** through both
vocabularies. And `packages/core/src/makamSignatures.ts` mirrors `data/makam_signatures.json`,
because the app ships without `data/` and without Python; one script writes both, and `--from-json`
re-emits the TS without rescanning the manifests, so refreshing the TS copy cannot silently rewrite
the JSON from whatever pools happen to be on the machine.

**The wiring trap.** The rules match a note by its **written** letter + accidental, but
`transposeDoc` respells every note from its koma — so reading the rules after a transpose finds
nothing. The deltas are computed from the base doc and applied **by event index, last**, immediately
before `buildTimeline`, which recomputes frequency from `koma53` and ignores the cached `freqHz`.
That also keeps the fractional komas (−1.5) away from every speller.

**And a trap in the checks.** The new prompt is a modal with a full-viewport backdrop, so
`app-smoke` and `page-smoke` would have failed at their first click after a decode with "element
intercepts pointer events" — a green-to-red that has nothing to do with the feature.
`tools/browser/makamPrompt.ts` is the shared dismissal; `build-smoke`/`live-smoke` read text only
and needed nothing. `smoke:app` passes end to end and reads its real page as **Uşşak**.

⚠ **Not deployed.** The live site plays as written until the next rebuild-and-redeploy, which the
style pass carries anyway. Still open: the **header OCR** half of stage 9, direction-dependent
intonation (the uşşak lowering is strongest in descent; karcığar's hicaz-on-nevâ is an *average* of
ascending and descending), and degree-relative rules for pages written away from a makam's own
perde.
Phases 0–1 in full detail → [HISTORY.md](HISTORY.md). Run-level numbers →
[../METRICS.md](../METRICS.md) and [../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md).

## 2026-08-06 (night) — W9 is finished: there is a link

**<https://komavision.netlify.app>** serves the app, `Beyaban/omr-weights` holds the 211 MB of
graphs, and `omr-decode-00003-jrl` on Cloud Run reads the music with the door now locked to that one
host. The owner made the two accounts; everything else was driven from here. Recipe and the two
traps: [../mvp/hosting-setup.md](../mvp/hosting-setup.md).

**Two things cost time, and neither was our code.**

*The Hub does not send `access-control-allow-origin: *` for `model.json`.* The three `.onnx` files
do — they are LFS, from a CDN — but the small file comes from the Hub app, which **reflects the
caller's origin** behind `vary: Origin`. A bare `curl` sends no Origin and shows `huggingface.co`,
which reads as broken. It is not, and `model.json` is fetched on **every** page load rather than only
on the fallback, so a wrong conclusion there would have been expensive. `build-smoke.ts` gained
`--weights-url` for exactly this: the local stand-in sends `*` and answers directly, the Hub reflects
and answers through a 307, and only the real thing exercises either.

*A brand-new Netlify site is private and does not say so.* Every path answered **401** with a login
redirect. Account and email were both fine — Netlify now defaults new sites to `sso_login: true`.
Also worth recording: the interactive CLI (`sites:create`, plain `deploy`) is unusable in this
monorepo because it stops to ask which workspace; the `netlify api` calls ask nothing.

**Measured on the way through.** The whole chain passes `smoke:build` on both paths with identical
scores. The fallback costs **69.9 s against 33.2 s** with local weights — a friend's first fallback
pays a **211 MB** download, once. And **`--cpu-boost` did not visibly help**: `loadMs` read
**25,857 ms against 9,500** without it. That is deliberately *not* written up as "cpu-boost is
worse" — n=1 against n=1, both on the first start of a freshly pushed image, and Cloud Run streams
image layers lazily, so a first read of the graphs is partly network. The flag was taken because it
was free on a redeploy and it still has no evidence behind it.

## 2026-08-06 (late) — the host was re-picked on a number, and the built app met the live server

Picking up "host the app and the weights", two things came out of it before either account existed.

**Cloudflare Pages cannot host this build, and the reason is one file.** Pages refuses any single
asset over **25 MiB** (checked against Cloudflare's own limits page, not from memory) and
`dist/ort/ort-wasm-simd-threaded.jsep.wasm` is **26,827,543 bytes = 25.58 MiB** — over by ~613 KB.
The app moved to **Netlify**, which reads the same `public/_headers`; **nothing in the repo changed**,
which is exactly what the 2026-08-02 decision bought by keeping the two hosts interchangeable
instead of picking one. Worth recording that the fix was available and was **not** taken: importing
`onnxruntime-web/wasm` selects the non-jsep binary at **12.86 MiB** and would take `dist/` from 43.3
to ~30 MB, losing nothing in use (`executionProviders: ["wasm"]` is all this app ever asks for) — but
it changes the runtime the fallback loads, so it owes `gate:browser` and `smoke:build`, and a
hosting deadline is the wrong reason to spend that.

**The built app was driven against the LIVE Cloud Run service for the first time** —
`smoke:build --decode-url <service>`, previously only ever run against `localhost:8080`. **PASS on
both paths**: same 26-strip page, **61.2 s reading on the server against 33.2 s in the local
fallback**, identical score (9 staves → 26 strips → 399 notes / 26 measures), `crossOriginIsolated`
true, no page errors. The first run of it that day *failed*, and that is worth keeping: no decode
server was running, so the server path fell back to the browser and the check reported a broken app.
It is doing its job — the header says it needs `dev:server` — but the failure it prints looks like a
product bug rather than a missing prerequisite.

Everything past this point needs accounts the owner has to create, so the session ended with the
walkthrough rather than a deploy: [../mvp/hosting-setup.md](../mvp/hosting-setup.md).

**Closing note, written after the deploy: the last check had to be built, because the lock broke the
existing one.** Setting `ALLOWED_ORIGINS` means a localhost preview is refused by the decode server,
so `smoke:build` — the check written specifically to run the artifact that ships — could no longer
reach the shipped configuration. `npm run smoke:live` (`tools/browser/live-smoke.ts`) drives the
deployed site instead, and it **passed on both paths**: server **49.8 s**, fallback **73.0 s** with
the weights coming from the Hub over the real network, same score, no page errors. The localhost dev
origins were then added back to `ALLOWED_ORIGINS` so `dev:web` still works, which is a convenience
and not a hole — a CORS origin is forgeable outside a browser, and the rate limit, payload caps and
`--max-instances 3` are what actually bound abuse.

**Then W10 grew a prerequisite.** The owner looked at the deployed site and stopped short of sending
the link: it is a working harness and looks like one. A style pass goes first, on the release's own
logic — W10 exists to ask two friends about the *interface*, and there are only two first
impressions to spend.

## 2026-08-06 (evening) — deployed, and two bugs of the same shape stood in the way

The decode server is live on Cloud Run: `omr-decode`, europe-west3, 1 vCPU / 2 GiB / concurrency 1 /
max-instances 3. Google Cloud was set up from nothing in the same sitting — the owner's previous
`gcloud` install turned out to be already deleted, leaving only credentials from a finished job in
`~/.config/gcloud`, which a reinstall would not have cleaned. Walkthrough:
[../mvp/gcloud-setup.md](../mvp/gcloud-setup.md).

**The measurements, which change the story deploy.md told.** A cloud vCPU costs **1.93 vCPU-s per
strip** against 0.55 on an M4 core — **3.5× slower**. So a page is ~40 vCPU-s, the free tier covers
**~4,450 pages/month** (a third of the laptop estimate, still far more than 50 users need), and
**the server is SLOWER than the owner's own browser: 250 s vs 166 s over 128 strips, plus a 10.6 s
cold start.** That is not a disappointment, it is the outcome deploy.md predicted in writing before
any of this was built, and the release was chosen on the thermal argument rather than a speed one.
The prediction holding is worth more than a good number would have been.

Quality survived the move intact: **120/128 strips (93.8%) identical to the browser — the same rate
as the local server** — with divergences on near-ties (median log-prob −0.87).

**Two bugs stood between "built" and "running", and they are the same bug twice: the artifact that
ships was never the artifact under test.**

1. The container exited before binding its port. Cloud Run said only "failed to start and listen on
   PORT"; the logs said `Dynamic require of "util" is not supported`. `pngjs` is CommonJS, the
   bundle is ESM, and esbuild's shim throws. `npm run dev:server` never saw it because `tsx`
   resolves CommonJS natively. Fixed with a `createRequire` banner; `npm run check:bundle` now boots
   the bundled artifact, which is the check that was missing.
2. `check:limits` failed one case against the live service: an oversized body returned **503, not
   413**. The server was destroying the request socket, which reaches a proxy as a backend failure —
   turning a client's mistake into an apparent outage, and sending the app into a slow local
   fallback instead of a clear error. It now answers first and closes after.

That is three for three today, counting the frozen fallback in the built web app this morning. The
pattern is worth naming: **every check in this project ran the convenient artifact — dev server, dev
bundle, `tsx` — and each time the shipped one differed, it differed in a way that was invisible
until something real ran it.**

⚠ Still owed: the $5 budget alert (owner's console), the 413 fix is committed but not redeployed, a
second cold start after genuine idle, and two-at-once uploads.

## 2026-08-06 (later) — the app can be deployed too, and building it found a frozen fallback

The server was only half of W9's title. The other half — hosting the app — turned out to carry the
session's most useful failure.

**What was built:** `npm run build:app` produces a 43.3 MB site (ORT's wasm 25.6, opencv.js 14.8)
out of a `public/` holding 332 MB of ONNX graphs and 220 render-corpus scores. It **fails** if the
output crosses 60 MB or contains an `.onnx`, because deleting a directory by hand is exactly the
step someone forgets. Weights move to `VITE_WEIGHTS_URL` — a Hugging Face Hub repo holding exactly
what `prepare-models.mjs` already emits, so the container, the Hub and a local checkout stay one
artifact set — cached in Cache Storage and fetched only if the fallback fires. `public/_headers`
carries COOP/COEP and is read by both Cloudflare Pages and Netlify, so the host choice stays open.

**Then `smoke:build` found that the built app's fallback hung forever.** Every
`InferenceSession.create` logged `document is not defined` and never resolved. The cause: the
bundler inlines `ort-wasm-simd-threaded.jsep.mjs`, which is *also* ORT's worker script, and a Worker
has no `document`. Fixed by copying ORT's runtime to `public/ort/` and setting
`wasmPaths = "/ort/"` — **in production only**, because dev has never had the bug and dev is the
configuration the browser gate passes at 27/28. A `?url` deep import was tried first and fails:
ORT's package `exports` does not expose `./dist/*.wasm`.

**Why this is the entry worth keeping.** Dev was green. `smoke:page` was green. The gate was 27/28.
Every check the project had said the app worked, while the thing a friend would actually open was
frozen on the path that exists precisely for when the server is cold. The only reason it was caught
is that the new check runs the BUILD, serves it with the real headers, and puts the weights on a
SECOND origin — each of which was a deliberate choice to make the rehearsal harder than the dev run
rather than more convenient.

Both paths now read one page to the same score, 9 staves → 26 strips → 399 notes / 26 measures:
server 8.3 s, cross-origin fallback 34.0 s.

⚠ A smaller lesson, twice: the console error for a failed fetch carries its URL in the message's
*location*, not its text. Both smokes filtered on text, so the error each one provokes on purpose
was being counted as a real failure. `page-smoke` had the same bug and it is fixed there too.

## 2026-08-06 — W9: the decode server is built, checked, and NOT deployed

The whole of `apps/server/` plus the client swap, in one session. Four things are worth keeping,
and two of them are results that went against the plan.

**The design that made it cheap: there is no second decoder.** The server imports
`apps/web/src/omr/decode.ts` — the browser's own module — so the greedy loop, the stopping rule and
the logprob scoring are the same lines on both sides. Paying for that meant getting ORT out from
under `decode.ts`: types now come from `onnxruntime-common` and the `Tensor` constructor travels on
`Sessions`, which is exactly the move `omr/types.ts` predicted for the mobile app. The browser gate
was re-run and is **27/28, unchanged**. Compare the alternative: the slicer port needed W4, W5, W6,
a Python control arm, a paired A/B and a McNemar test to prove a second implementation matched.

**The seam sits after preprocessing, not at the raw crop.** The client rotates/resizes/pads and
uploads a finished 409×583 PNG; the server does only the rescale (`omr/pixels.ts`). Reason: a
server-side resize would be a THIRD resampler — the canvas draw already is not PIL BILINEAR — and
another rung to prove it equal. PNG is lossless, so both runtimes see identical bytes.

**Result 1 — the quality question was answered with the right instrument.** Strip-level agreement
between server and browser is 93.8% (120/128), which is *not* the number that matters: agreement
cannot say which side is right, and it also moves with the batch size (batch 1 gives 93.8% too, but
a different 8 strips). So both arms were scored against the same 267 hand-verified `_realval_v2`
strips with the same scorer, **paired**, the way W6 settled arm A vs arm B: **no detectable
difference** — McNemar exact p = 0.727, total edits 780 vs 768, per-strip sign test p = 0.664. The
divergences sit at tokens the model was on average ~55% sure of.

**Result 2 — batching does not pay, and that withdrew a stated reason for having a server at all.**
`deploy.md` listed "no batching, ever" as a structural advantage over `onnxruntime-web`. Measured:
batch 8 is a few percent SLOWER than batch 1 at 1, 2 and 4 threads, and costs **2.9× the peak
memory** (2,778 MB vs 955 MB on a 38-strip page) — on Cloud Run, a 4 GiB container instead of 1 GiB.
One 409×583 Swin forward already fills the cores. `OMR_MAX_BATCH` defaults to 1 now; the batched
path stays behind the knob because this is one CPU architecture, but the *claim* is gone. The
"smaller upload" reason went the same way: the crops upload is a median 1.7× the page image, not
smaller. What survives as the second reason, and it is a big one: **native ORT is ~4× faster than
wasm on the same laptop** — 6.0 s a page against 24.5 s, with the tab's worst stall dropping
2,358 ms → 29 ms.

**What is NOT done, and why:** nobody has deployed it. `gcloud` is not installed and no project
exists, so cold start and a real cloud vCPU's speed are unmeasured — every number above is from the
dev M4 and is an upper bound on speed, a lower bound on cost. The container has never been built
either: the Docker CLI here comes from Rancher Desktop and its daemon was not running. It is
designed to build in Cloud Build anyway (the Dockerfile is not at the context root, and an Apple
Silicon `docker build` would produce arm64), but that means the first deploy is also the first
build. The **hard billing cap** stays owed — the one safety item that bounds the bill and the one
that cannot be asserted from the repo.

**A cached measurement was destroyed and restored.** `scripts/score_browser_gold.py` wrote its
result to one fixed path, so scoring the server arm overwrote W3's stored browser numbers. The
browser arm was re-run to restore them (it reproduced exactly: SER 0.0818, exact 60.2%), and the
script now takes `--score-out`. Worth recording as a near miss: nothing in the file said it was a
single-arm store, and a second arm was always going to arrive.

## 2026-08-05 (later) — the release is RE-SCOPED, and seven open questions are settled

The owner set the scope of the release, and it changed enough of the surrounding plan that most of
the MVP track's open questions closed at once. **The premise that moved everything: the friends
release tests the INTERFACE, not the model.**

> *"I will make the app in web first. Then I will think about phones. The first release to friends
> only for interface, not for the model. I want some feedback about what should I add as a feature,
> I will continue to upgrade model paralelly without asking to the friends. I just share it with two
> friends at the beginning, then I make round 3 and if result is good, release it to all people, if
> not, make round 4 etc."*

**What follows from it, and why each one is a consequence rather than a separate choice:**

- **Round 3 is UNPAUSED and runs in parallel.** The 2026-08-02 pause existed so Round 3 could be
  *aimed* by real feedback. Feature feedback will not aim it, so the reason for the pause evaporated
  with the scope. The two tracks are now independent: the product track never trains, the model
  track never touches the app.
- **The friends build swaps to a better model whenever one lands** (owner's choice over freezing).
  Cheap now that decode is server-side — a redeploy, no client download. ⚠ **Recorded because it is
  a real cost, not a free lunch:** a friend's decode-quality remark can no longer be attributed to a
  model version. Those remarks are anecdotes. The exam stays the only thing that judges a model.
- **Feedback comes back by talking to them.** No in-app reporting button. The earlier `deploy.md`
  argued one was "worth more to Round 3 than any speedup here" — true at scale, wrong at n=2, where
  a conversation returns feature ideas and a button returns bug reports.
- **Phones are out of scope**, which **removes the strongest argument on the deploy page**. The
  iOS-Safari cache-eviction case (~200 MB re-downloaded every week or two on cellular) was reason #1
  for moving decode off the client, and it does not apply to a web-first release. It is **parked,
  not refuted** — it returns intact when phones do. **So the server now rests on the thermal
  argument alone** — which the owner confirmed later the same day still holds at ~25 s (see the end
  of this entry), so resting on it is sound rather than a gap.
- **The public launch is gated on Round 3's exam result**, so the ladder no longer ends at W10.
  ⚠ That bar is **not written down yet** — `rung3/round3.md` owes it, on the user-effort metric,
  before training starts. It now decides two things (ship Round 3, and open the app), which is more
  weight than a number gets by default.

**W8 (confidence highlighting) is DROPPED.** The pre-registered bar — flag 10% of tokens, catch
≥60% of errors — was not met (best at that budget: 26.3%). A usable soft cut existed
(`min_logprob < -0.5`: 22.6% of strips, 57.1% of edits, 2.5× lift) and was not taken. **Two things
worth recording:** the bar was *not* moved to fit the result, which is the failure mode that has
already cost this project twice on exam headlines; and dropping it leaves half of the 2026-07-27
goal unbuilt, which is said out loud in STATUS, DECISIONS and OVERVIEW rather than quietly dropped.
Nothing is deleted — the measurement, `check:logprobs` and the per-token logprobs all stay.

**The server stack: Node + `onnxruntime-node` importing `apps/web/src/omr/decode.ts`, not Python.**
This is the decision with the most leverage per line of code. A Python service could run
`decode_page.py` nearly verbatim and Modal is built for exactly that — but it would create a **third**
decode implementation to hold in parity with the browser and with Python-ORT. Proving two
implementations agree cost this project an entire rung the last time: W4, W5, W6, a Python control
arm, a paired decode A/B and a McNemar test. Reusing the module that was already validated at W3
(SER 0.0818 vs 0.0821) makes "the server matches the browser" true by construction.
✅ **It also closes, without a change, the open question `CLAUDE.md` was carrying**: "Python is
training/data only and never ships" stands, and nothing under `src/vision/` becomes shippable.

**Hosting: Cloud Run free tier**, adopted with its weakness on the record. A ~1 GB container
cold-starts in 10–30 s and two-friend traffic is sparse, so nearly every upload is cold — **the same
sparse-traffic argument this project uses to reject GPU, which the deploy page had applied to only
one of the two options.** It is survivable because of the fallback below. Hetzner CX22 (~€4/month,
always on) is the named fallback and costs less than keeping Cloud Run warm (~$15–25/month).

**The client falls back to in-browser decode** on failure, timeout or cold start. Near-free (the
path exists and is under test) and it means a server outage never reads as "the app is broken" to a
friend who cannot debug it. **Two consequences that were nearly missed:** the browser must still be
able to *get* the weights, so the HF Hub delivery decision stays LOCKED — with weights fetched
lazily, only if the fallback fires; and **the COOP/COEP host requirement does NOT lapse**, because
the fallback wants wasm threads. Both `deploy.md` and the MVP README had written the opposite
("weights never reach the browser", "COOP/COEP mostly goes away"); both are corrected.

**Two things checked rather than assumed, before any of this was written down:**

1. ✅ **Batched server decode needs no model re-export.** `encoder_model.onnx` and
   `decoder_model.onnx` both carry a dynamic `batch_size` axis. Had it been pinned at 1, the entire
   batching argument would have dragged a re-export and a re-run of the parity chain behind it.
2. ⚠ **The server probably will not make a page faster**, and this is now written down as a
   non-claim in `deploy.md`. A shared cloud vCPU is slower per core than an M4 P-core, and the cold
   start adds 10–30 s. Warm, expect roughly today's ~25 s; cold, worse. **The purchase is a cool
   laptop, not a fast page** — without this stated, the first benchmark reads as a failure.

**Then the thermal question closed too, and the re-test was removed from the plan.** Owner: *"We do
not need to check whether mac still gets hot. We already know this."* The plan above had a
half-hour thermal re-test as the first step of Track A, on the grounds that the original complaint
was made when a page took ~56 s rather than ~25. That reasoning was sound when nobody had used the
app at the new speed; the owner has, and answered from direct experience. **Recorded as an
observation, not an instrumented number — and that is the right standard here**, because the claim
is "this laptop gets hot in normal use", which the person holding the laptop is the authority on.
The docs no longer ask for it, and W9 now starts at the endpoint.

**A doc conflict fixed while here:** `DECISIONS.md` carried two rows dated 2026-08-05 with opposite
status — "DECODE MOVES TO A SERVER … LOCKED" and "PROPOSED — NOT TAKEN … the owner will settle it
once the app is feature-complete". Whoever read it next had a coin flip. The proposal row is now
marked SUPERSEDED, keeping its GPU and ads reasoning, which still stands.

## 2026-08-05 — the backend decision is TAKEN: decode moves to a server

**Owner: "I am sure about deploy the app in a server to protect computers for now."** That settles
the question `docs/mvp/deploy.md` reopened the same day, and it reverses two things that were marked
LOCKED: the 2026-07-02 "No production backend" decision and the `CLAUDE.md` hard rule "No backend,
ever". Both are now marked OVERTURNED with this as the cause, per the rule that a reversed decision
keeps its reasoning rather than being deleted.

**The stated reason is thermal, not capability** — a page burns ~19 s of multi-threaded CPU on the
client, and every user pays that heat on their own machine. Worth recording because it is a
*product* argument, not a speed one: the app already reads a page in ~25 s.

**What does NOT change, and is easy to get wrong:** audio and the editor stay local; the W4–W6
slicer port stays client-side, because slicing is the cheap half and it is what keeps the upload to
~19 small crops instead of a full-resolution photo; and **the in-browser decode path is KEPT**.
`gate:browser`, `parity:armb`, `parity:arma`, `smoke:page` and the W3 browser-vs-gold quality result
all rest on it — and it becomes the reference the server must be shown to match, exactly as local
Python was the reference for the slicer port. Deleting it would silently retire most of the
validation this track has built.

**One implication that is NOT settled and must not be assumed:** a Python decode service would make
part of `src/` shippable for the first time, which cuts across "Python is training/data only". The
hard rule is now split — training stays Python-only-never-ships; the serving half is an open design
question.

⚠ **Adopted with two figures unmeasured, both of which shape the build rather than the decision:**
the thermal complaint has not been re-tested since page latency fell ~56 s → ~25 s (so the size of
the win is unknown, and it is one page of work to find out), and no server has been benchmarked, so
every cost number in deploy.md is an extrapolation from one M4. The build order in STATUS puts the
benchmark first for that reason — it also decides Cloud Run vs Hetzner.

## 2026-08-05 — doc sync: deploy.md was written against a page that no longer exists

**`docs/mvp/deploy.md` (the reopened backend question) was drafted BEFORE the deskew speedup landed
the same day, and three of its load-bearing facts had gone stale.** Corrected rather than deleted,
because the reasoning is still good and only the numbers moved:

- it said the client "still pays the ~35 s sweep" and that W7 made it non-blocking rather than
  cheap. True when written; the sweep is now ~1.1 s and the whole slicer 1.6 s/page.
- it recommended "fix the deskew before building any server", on the ground that prep stays on the
  client in both architectures. **That recommendation was taken** — and it needed none of the
  behaviour change it budgeted for, because the fix turned out to be an exact substitution.
- its priority table ranked the deskew fix above the server on the owner's own complaint. That
  comparison is spent; the table now shows where the remaining ~25 s sits (**~19 s decode, 1.6 s
  slice**), which makes decode the entire remaining case for a server.

**The consequence worth flagging: the thermal complaint that opened that doc was measured against a
~56 s page, and a page is now ~25 s with ~60% less CPU burned.** Whether it still bites is
unmeasured, so "re-test the thermals" was added as the first Open Question, blocking *whether this
doc is needed at all*.

**STATUS was rewritten, not appended to.** Its "Next" still listed the finished latency item and
described W9 as plumbing; W9 is now a decision (settle the hosting question first), W10 carries the
safety checklist, and the corpus-wide estimator validation is re-priced from ~18 h to under an hour.
The file crossed its 400-line cap in the process, so the W0–W3 rung bullets and the Round-3
pre-render section were condensed to summaries — both are owned in full by `mvp/rungs.md` and
`rung3/round3.md`.

## 2026-08-05 — a slur above the staff was shearing the beams below

**Owner report: an uploaded page came back with a crop whose bottom was cut, so "notes and their
times could not be read."** Reproduced on corpus pages via the new slice inspector, and the residual
4.4% bottom clipping turned out to be two unrelated problems.

**85% of it is not a placement bug at all.** Those rows' music genuinely exceeds the frame — short by
a **median 2.31 sp** against a total non-staff budget of 7.2 sp — and they are mostly degraded scans
where `row_music_extent` saturates near its own `6*sp` limit because the row's ink is connected to
lyrics or the next system. No redistribution of a fixed frame can supply 2.3 more line-spaces; only
a scale change could, and scale is the axis the model is most sensitive to (12–15% edits per 1%).

**The remaining 15% was a real bug with a real fix.** `place_band` let ink ABOVE the staff claim room
without limit, so a slur reaching 5.0 sp up pushed the staff down and the frame cut the beams below.
**First answer was wrong and was corrected under challenge.** Bottom-first was measured — bottom
clips 3.0% → 2.7%, top clips 2.7% → 3.1%, total ink lost +1.9% — and reported as "a trade, not a
fix". The owner pushed back on whether it had to be a trade, which was the right question: ink AREA
weighs a slur's apex the same as a beam, and that was already known to be the wrong scale.

**Capping what the top may CLAIM is strictly better than both**, at 3.5 sp — a notehead three ledger
lines up sits ~3.0 sp above, ~3.5 with its accidental, and beyond that the ink is slur/segno/ornament
(the renderer injects slurs as deliberately LABEL-FREE distractors). Over 120 pages / 901 rows:

| | ≤3.5 sp above (real notes) | >3.5 sp (decoration) | below (beams) |
|---|---|---|---|
| old, uncapped | 0 | 19,670 | 19,932 |
| bottom-first | **500** | 23,681 | 16,193 |
| capped (shipped) | **0** | 22,763 | **17,231 (−13.6%)** |

Bottom-first buys beams by destroying real ledger-note ink, which is the harm the rule exists to
prevent. The cap loses nothing the old rule kept, and by construction only moves rows ALREADY in
conflict. Verified by eye on the reproducing row: beams complete, lyrics visible, only the slur's
apex lost. Python and TS moved together, so parity still reads W4/W5/W6 PASS with deskew 20/20, and
`smoke:page` still reads 16 strips / 344 notes / 28 measures.

⚠ **Still an information argument, not a decode result** — at 2.6% of rows an accuracy A/B is
underpowered, the same wall adaptive placement hit. `OMR_VPLACE_TOP_CLAIM=99` restores the old rule
and the slice inspector toggles it, so the claim stays checkable on a real page.

## 2026-08-05 — the skew sweep is 126× cheaper and returns the same answers

**The page latency written up as a W7 problem is closed, and nothing about the estimator's
behaviour changed.** The sweep cost ~35 of the ~36 s a page took, and the plan named two ways out —
an early exit at 0°, or replacing the estimator with a standard one. **Neither was needed**, and
both would have been behaviour changes owing a fresh measurement.

**What it actually was.** Each of the 41 rotations ran `qualifyingLineRows`, whose expensive step is
a page-wide `morphologyEx(MORPH_OPEN)` with a `len`×1 kernel — plus two full-image Mat copies to get
in and out of opencv.js. Because that kernel is one row tall the opening is purely per-row, and a
1-D opening has a closed form: a pixel survives iff it belongs to a run of at least `len`
foreground pixels. `qualifyingLineRows` never uses the opened image — only its ROW SUMS — so the
whole morphology collapses to a run-length scan. **856 ms → 6.8 ms per call, 125.8×.**

**The trap, and why the check sweeps angles.** `morphologyEx` defaults to
`morphologyDefaultBorderValue()`, i.e. it erodes as if everything outside the frame were foreground.
So a run touching the left or right edge survives WHOLE however short it is, while an interior run
must reach `len`. Encode that wrong and the counts differ only on some pages at some angles — a
happy-path test would miss it. `npm run check:deskew` therefore runs both implementations on the
SAME rotated image at every angle the coarse pass evaluates, over real corpus pages: **0
disagreements in 328 evaluations across 8 pages**.

**End-to-end evidence, not just the micro-benchmark.** The parity harness re-run with the REAL
estimator (no `--inject-skew`): **deskew angle identical 20/20**, bars, windows and strip spans all
exact, W4/W5/W6 PASS — at **1.3 s/page against 36.6 s** before, which makes the browser slicer
FASTER than the Python it is a copy of (~1.9 s stage 1). In the app, `npm run smoke:page` reads the
same page to the same 16 strips / 344 notes / 28 measures, sliced in **1.6 s** instead of 36.4 s;
the whole upload is **~25 s**, and **decode is now the bottleneck** at ~1.2 s/strip.

**What this buys beyond speed:** the owed corpus-wide validation of the deskew estimator was priced
at ~18 h of browser time and is now well under an hour, so it stops being a reason to keep injecting
Python's angle.

## 2026-08-05 — a decoded \tup3 that cannot close no longer draws the wrong rhythm

**Reported symptom (owner): "the model emits `\repstart`, `\repend`, `\tup3` but they are not
seen in the rendered sheet."** Measured over the 1,704 decode caches on disk rather than guessed at,
and it split into two different stories.

**Repeats are NOT lost — they are consumed.** `buildDoc` uses the marks to compute a playing order
and then writes only notes: the note model has no field for a repeat, volta, segno or D.C., so the
sheet cannot draw one. What it does instead is UNFOLD, which is what the owner wants (confirmed
2026-08-05: no repeat barlines on the page, unfold with correct voltas, cursor forward only).
`expandRepeats` was traced by hand and is correct for well-formed tokens —
`A B [1.C] :‖ [2.D] E` → `A B C A B D E`. **1,165 of the 1,262 pages carrying a repeat mark unfold
(92.3%)**; the remaining **97 (7.7%)** carry a `\repstart` the model never closed. Left alone on
purpose: on a page-at-a-time flow the matching `:‖` may be on the next page, and guessing "repeat to
the end" would duplicate material that is not repeated.

**Triplets were genuinely broken, and are fixed.** `\tup3` survives stitching as a duration whose
denominator divides by 3, and `tupletGroupsIn` recovers it — but only if a run of such notes sums to
a plain power-of-two value. A run the model could not close (dropped member, stray `\tupend` — the
census counts 354 stray, 423 unclosed, 115 nested) yielded NO group, so every member fell through to
`vexDuration`'s snap-to-nearest: **the page drew a definitely-wrong rhythm with no mark saying so**.
That is **1,287 notes, and 22.9% of `\tup3`-bearing pages losing at least one**. An unclosed run now
keeps its bracket over the members it has → **1,287 → 0**. It is not a guess at the true rhythm; it
is refusing to overwrite what the model read, and it puts a visible "3" where a correction is needed.

**What it cost, stated rather than buried.** `tupletGroupsIn` is shared with the label serializer by
design (CLAUDE.md: pixels and labels from one code path), so both sides moved together — **5
measures in 1 of 190 training pieces**, and only on a future re-render; `strips_v4` on disk is
untouched. Checks: 217/217 round-trip in both modes, all stitcher unit tests, typecheck.
⚠ **`verify-labels.ts` is the wrong instrument here and reported `checked 0`** — it needs the dev
server running, and it inspects ACCIDENTAL glyphs only, so it could never have seen a rhythm change.
The real safety check was rendering the three worst real pages (26/24/21 incomplete groups) through
BOTH draw paths — the curved arc and VexFlow's bracket — with **0 dropped measures and 0 page
errors**, which is what rules out a 1-member group throwing inside `SheetView`'s per-measure `catch`
and silently deleting a whole bar.

## 2026-08-05 — W7: the app reads a whole page

**Upload an image, get a playable score.** `apps/web/src/omr/page.ts` joins the ported slicer to the
decode path — `decodeGray` → guarded skew → `sliceStage3` → crops as canvases → `decodeStripsToDoc`
— and `App.tsx` gained a "Read page" input beside "Read strips". `npm run smoke:page` drives the
real app end to end: **7 staves → 16 strips → 344 notes / 28 measures**, strip count matching local
Python **16 vs 16**, sheet rendering, playback starting, no page errors. Slice **36.4 s**, decode
**19.1 s**. W2's smoke reads Python's own crops of that page and gets the same 344 notes / 28
measures, which is a free (n=1) confirmation through the whole product path.

**The interesting half was the 35-second freeze, not the wiring.** The whole slice ran as one
synchronous block, and a tab that cannot answer JavaScript for 35 s is not shippable. The fix
changes no arithmetic: `estimate_skew` became a **generator** yielding after each of its 41
rotations, with `estimateSkew` (run to completion — the parity path) and `estimateSkewAsync` (step
and yield — the app) as its two drivers, plus `guardedAngle` holding `deskew`'s two guards so the
app's estimate-then-slice order decides identically. **An async copy was the obvious alternative
and was rejected**: two copies of a tuned search drift the first time a gate moves, which is the
duplication CLAUDE.md already names. Verified rather than argued — the parity harness re-run with
the REAL estimator (no `--inject-skew`) on 20 pages, 4 of them rotating, gives **deskew angle
identical 20/20** with W4/W5/W6 all still PASS. What still blocks is one **2.35 s** stretch (ink →
components → staves → rows → barlines → windows), under the 5 s bar and left alone.

**Two traps, both worth the entry.** Vite's dep optimizer discovers opencv.js at the *first upload*
(it is behind a lazy `import()`, invisible to the static scan), re-optimizes, and full-reloads the
tab mid-slice — which throws the upload away and presents as a hang at **0% CPU**, not as an error.
`optimizeDeps.include` makes it a startup cost, and the fix was re-verified against a **cold**
`.vite` cache. And the smoke's strip-count bar was first written against the page's
`_manifest.json`, which would have failed W7's wiring for a W4 reason; it scores against
`slicer_ref.py` now. Third time this project has relearned that agreement with an artifact is not
correctness.

⚠ **The latency is made bearable, not fixed** — a straight screenshot still pays all 41 rotations.
Both candidate fixes are behaviour changes owing their own measurement; see STATUS.

## 2026-08-04 — W6: the slicer port is finished, and the decode arm says the crops are the same

**The last stage is ported and the browser now cuts a page into strips the way Python does.**
`apps/web/src/omr/slicer/windows.ts` transliterates `_span_cap`, `_split_wide` and
`window_measures`; `sliceStage3` adds the driver's pad/trim block and returns crop **spans**, with
`cropStrip` cutting pixels only when a caller wants them. Over the whole corpus — 1,781 pages /
33,805 strips — window fields are exact on **33,783/33,783**, strip count per page on
**1,697/1,697**, `row_x0`/`row_x1` within 2 px on **99.99%**, invariants at Python's own **0**.
Numbers: [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

**The verdict that mattered was the decode arm, and it was worth building properly.**
`tools/vision/parity/arm-a.ts` slices a page with the port, decodes those crops, decodes Python's
crops for the same page, and compares **pairwise on (system, window)**: **12 A-only against 4 B-only
discordant pairs on 450 strips, McNemar exact p = 0.077**, arm A 87.78% vs arm B 86.00%, **0 strips
unmatched**. The pairing is what makes it readable — the level comparison the plan originally asked
for ("within 1 pp of 86.0%") has a ~1.6 pp standard error at n=450 and could not have resolved
anything. And the decisive detail fell out of the same data: **all 16 discordant strips have
identical crop widths**, so the slicer is ruled out as the cause rather than argued about.

**Two judgement calls, both worth remembering:**

- **The Python control runs the REAL driver.** `slicer_ref.py` calls `page_to_strips` into a temp
  dir rather than re-implementing its ~40-line pad/trim block. The port is transliterated from those
  same lines, so a second hand-written copy in the reference could encode one misreading **twice**
  and then agree with itself — the exact failure this control exists to prevent. Cost: a second
  stage-1 pass, ~4.2 s/page, ~2 h for the corpus. It also validated itself: on the 8-page smoke
  sample its strip entries matched the manifests 106/106.
- **A bar was restated, and both numbers are now printed.** The first corpus run read
  `window fields FAIL 33,799/33,805`. All 6 misses sat on the only two pages whose **bar count**
  differs — the `_terminal_overshoot` near-ties W5 already diagnosed as ±1 grayscale. Windows are
  computed *from* the bars, so a 100% window bar silently demands a 100% bar bar, which W5 itself
  set at 99.0%. The gate now scores rows whose bar list agrees (**33,783/33,783**) and prints the
  raw number beside it. This is the second time a criterion written before the ±1 residue was
  understood has failed a port that agrees with Python — W4's zero-staff bar was the first.

**Two paths that had never run are now measured.** `hasNotehead`, ported at W5 with nothing
exercising it, fires on **861 clef-prefix trims**, identical on both sides — W5's non-claim is
discharged. `_split_wide` cuts **10,246 strips** across 4,414 groups; its escalation loop (raise n
until every piece fits) fires **589 times**, while the `sorted(set(cuts))` collapse it is written to
survive **never happens in this corpus** — kept anyway, because one unbroken beam run would hit it.

**The one difference bigger than 2 px is a gutter, not a cut through ink.**
`benim_serv_i_hiramanim…_p1` s09 has identical bars, flags and pads, but Python cuts its over-wide
measure at 931 and the port at 939: the ±1 grayscale changes which columns read as zero-ink, moving
the chosen gutter **centre** 8 px **inside the same whitespace run**. The two crops differ by 8
columns of blank.

⚠ **Not done, deliberately:** the W0 cv-probe was scheduled for deletion at this rung and was kept —
it is the only thing that would catch an opencv.js version bump changing a primitive under the port.
⚠ **Still owed:** the deskew estimator is validated on 132 pages, not the corpus (every full run
injects Python's angle), and W7 inherits ~36 s/page of slicer latency, ~35 s of it that sweep.

## 2026-08-04 — W5: barlines ported; the trap list paid for itself, and a free check earned its keep

**The riskiest file in the slicer reproduces Python over the whole corpus, on the first run.**
`apps/web/src/omr/slicer/barlines.ts` transliterates `_longest_vertical_run`, `_is_thin_stroke`,
`_cluster_cols`, `_terminal_overshoot`, `detect_barlines` and `_has_notehead`; `sliceStage2` adds
them to the driver. Against local Python on **1,781 pages / 12,123 rows / 51,019 bars**: bar count
exact **12,121/12,123 (99.98%)**, positions within 1 px **51,018/51,019 (100.00%)**, exact
**51,013/51,019 (99.99%)** — all three W5 bars, on the corpus rather than a sample. Numbers:
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

**Why it passed first time is the interesting part, and it is not luck.** W4 left
[../mvp/slicer-port.md](../mvp/slicer-port.md) a named list of hazards in this specific file, and
they were transliterated as written instead of rediscovered: `_is_thin_stroke`'s staff-row
`continue` that does **not** reset the run, `_terminal_overshoot`'s four state variables with four
different reset rules, and the three per-ROW `binarize_ink` calls that must not be hoisted into one
Otsu. **Trap 1 was checked rather than trusted** — `30 * 0.35` and `30 * 0.75` really are exactly
10.5 and 22.5 in IEEE doubles, so `Math.round` returns 11 and 23 where Python's half-to-even returns
10 and 22. That is `tol` (gate 1's slack) and `fat_w` (gate 2's width): a naive port silently
retunes both gates and every measure boundary under them, and it would still have *looked* fine.

**Every difference was diagnosed rather than tolerated, and none is the port.** All 8 differing rows
reproduce inside Python under the ±1 grayscale residue: feed it `cvtColor` on the colour read
instead of `imread(IMREAD_GRAYSCALE)` — the two disagree on 3.8–9.5% of these pages' pixels — and
Python emits **the port's exact bar list and reject list**. Three shapes:

- **2 rows differ in bar COUNT, one in each direction.** Both are `_terminal_overshoot` near-ties
  (`birgunbana…_p1` s1, where the port rejects a candidate Python keeps; `kurdilihicazkar…_p2` s2,
  the reverse). The symmetry is the argument: a real bug in that walk would flip one way across many
  rows, not 2 rows out of 12,123 in opposite directions.
- **The one 2 px difference is inherited, not new.** `sayd_eyledi…_nota_p1` s5 is the page W4
  already recorded as having `x0` off by 1 (157 vs 158). `detect_barlines` snaps the first bar to
  `int(staff.x0 * scale)` and that row's scale is exactly 2.0, so 1 page px becomes 2 row px. No
  gate moved.
- **On all 6 rows where a position moved, the reject lists are identical.** No gate disagreed at all.

**The free extra check earned its keep, which is the transferable lesson.** Recording
`detect_barlines`' *rejected* candidates costs nothing — the gates run either way, `debug_info` only
decides whether their verdicts are kept — and it is strictly stronger than the bar list. It found
**9 further rows that produce identical bars while disagreeing about what was thrown out**: 6 where
a rejected candidate's x moves by 1, 2 where a candidate is generated on one side only (it fails
gate 1 rather than being rejected later), and **1 where the same column is rejected for a different
REASON** — `huseyni_saz_semai_rasid_efendi_neyzen_baba_p1` s7 col 956, `gate2_fat` in Python against
`gate3_blob` in the port. Rejected either way, so no output check could ever see it, but it means
two independent gates both sit near their thresholds on that column. Worth having on record before
W6 changes anything upstream.

**Two non-claims, stated rather than glossed.** The corpus run used `--inject-skew`, so like W4 it
validates everything downstream of the deskew estimator and not the estimator. And **`hasNotehead`
is ported but exercised by nothing measured here** — its only caller is `window_measures`, so W6
owns it.

**The manifests stayed the weaker reference and again sat below the bar.** Current Python reproduces
only **11,689/12,099 (96.61%)** of the manifests' `row_bars`; the port reaches 96.55%, 8 rows below,
and those are the same 8 residue rows. Scored against the manifests the port would have read 96.55%
against a 99% bar and looked like a failure — the same trap W4 fell into and documented.

Also: `scripts/slicer_ref.py` now records bars and rejects beside the staves and prints the
manifest-bar ceiling; `slicer-parity.ts` gates the three W5 bars, prints the reject-list agreement
and ranks the worst barline pages. Verification: `npm run typecheck`, `npm test` (217/217 both
modes) and `npm run gate:browser` (27/28, unchanged) all clean.

## 2026-08-04 — W4: the slicer's first half is ported, and two planning assumptions died

**The port reproduces Python's stage 1 exactly, over the whole corpus.** `apps/web/src/omr/slicer/`
now holds `constants.ts` (every constant with its Python line, plus `pyRound`), `cvOps.ts` (the only
opencv.js importer), `prepPage.ts`, `staves.ts`, `rows.ts` and `slicer.ts`. Against local Python on
**1,781 pages / 12,123 systems**: staff count 1,704/1,704, manifest-zero pages 77/77, `scale`
12,122/12,122 — all three W4 bars, on the corpus rather than a sample. Row width and the
outer-lines+median-spacing triple are both 12,123/12,123.

**Everything that differs anywhere is the ±1 grayscale residue, and none of it reaches a crop.**
Seven systems differ by 1 px — six an *interior* staff line's cluster centre, one an `x0` — and
`normalize_row` reads only the outer lines and the median spacing, which are identical on all
12,123 systems. W0 predicted this residue and its fixture was too clean to show it; this is the
first time it has been observed reaching any output. Numbers:
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

Two scope notes recorded rather than glossed. The corpus run used `--inject-skew` (Python's angle
fed in) to stay affordable, so the **estimator** is validated on 132 pages, 132/132, not the corpus.
And the "zero-staff pages yield zero staves" bar was **restated against the control**: those pages
are identified by an empty manifest, local Python now finds a staff on 1 of the 77, and the port
finds the same one — the original wording failed a port that agreed with Python exactly.

**The interesting part is what the plan had wrong.** Both errors were in the *plan*, both were
found by measuring, and neither was visible by reading the code:

**1. `prepPage` could not be a no-op.** [../mvp/slicer-port.md](../mvp/slicer-port.md) recorded that
every step of the camera path is inert on clean input, so the port started with a stub. It is true
of the perspective crop (0% of pages take one) and false of the deskew: **15.3% of corpus pages
(272/1,781) take a real rotation**, 17.4% on the first sample where the angles ran 0.3–1.1°. The first parity run read 86.7%, with three pages finding *zero*
staves where Python found 7–10; joining the failures against Python's own skew angles showed **22
of the 23 failures were exactly the 23 deskewed pages**. `estimate_skew`/`deskew` are now ported in
full, both guards intact, so an axis-aligned screenshot is still untouched. The lesson is the one
this project keeps re-learning: "documented no-op" was a claim about *code paths*, and the corpus
is what decides whether it holds.

⚠ It costs **~35 s of the ~36 s** a page takes in the browser — 41 rotations, each with a page-wide
`MORPH_OPEN` — against ~1.9 s for Python's whole stage 1. That is a **W7** problem (a screenshot
pays the whole sweep to learn it has no skew) and it is deliberately NOT optimised inside the port,
because a faster estimator is a behaviour change and needs its own measurement. `--inject-skew`
exists so full-corpus runs of everything downstream stay affordable.

**2. The manifests on disk cannot be the acceptance bar, and using them failed a correct port.**
W4's stated acceptance was "against the 1,781 manifests". One page the port failed —
`gozumden_gonlumden_hayali_gitmez_nota_p1`, 7 staves against the manifest's 5 — turned out to match
local Python **line for line**: every line y, x0, x1, spacing. Measured properly, the current
`page_to_strips.py` reproduces only **1,680/1,704 (98.59%)** of those manifests, already below W4's
own 99.5% bar; 1,578 of the 1,781 page dirs were sliced on Colab and the artifact has drifted from the code.

`scripts/slicer_ref.py` now dumps Python's stage 1 and is both the control arm and the *sample
definition* — `slicer-parity.ts --ref` runs exactly the pages in it, so the two sides cannot drift
apart on which pages they ran. Manifest agreement is still printed as the weaker second reference,
and the port reaches that ceiling exactly (1,680/1,704, the same pages as Python). This is the same
mistake W3 caught one rung earlier in a different costume: **agreement with an artifact is not
correctness**, whether the artifact is another decoder's tokens or a manifest on disk.

⚠ **Owed, small:** the deskew estimator is validated on 132 pages, not the corpus. Closing that
costs ~18 h of browser time, so it is only worth doing if W5/W6 turn up a skew-related difference.

## 2026-08-03 — W3: the browser is not worse than Python; the confidence bar is not met

**The release-gating question is answered.** W2 left open whether the ~14% browser-vs-Python
disagreement meant the browser reads *worse* or merely *differently* — agreement with another
decoder cannot tell those apart, and if it were "worse" then friends would get worse results than
every number in METRICS.md claims.

Both sides scored against the **same 261 hand-verified `_realval_v2` strips**, with the **same
scorer** (`eval_omr.align`), on identical strips: **SER 0.0821 → 0.0818, exact-match 60.2% both,
AEU macro recall 94.8% → 94.9%, micro 92.5% both.** Per class everything is within a point and the
two largest moves cancel (`\bakiyeSharp` −0.8 pp, `\komaFlat` +1.5 pp). The disagreement is two ORT
builds splitting near-ties at no quality cost. ⚠ It is a *paired* Δ on real-val: it establishes the
difference, not the absolute level.

**The confidence signal was measured against gold for the first time, and it does not clear its
bar.** Flagged strips genuinely are worse — **8.60 token edits per strip against 2.69** — so the
signal is real. But as an error *locator*:

| flag if min < | % strips | % of edits caught | lift |
|---|---|---|---|
| −1.0 | 3.8% | 11.3% | 3.0× |
| −0.7 | 9.2% | 26.3% | 2.9× |
| −0.5 | 22.6% | 57.1% | 2.5× |
| −0.3 | 33.0% | 64.2% | 1.9× |

The pre-registered rule — flag 10%, catch ≥60% of errors — is **NOT MET**; the ceiling at a 10%
budget is 26.3%. Worth stating plainly because the rule has sat in STATUS unexercised since
2026-07-27, and W8 was going to be built on the assumption it held. It does not. There is a usable
soft cut at −0.5, and W8 now has a real choice: ship it as a hint, pay for per-TOKEN localisation
(the logprobs exist; the cost is threading token identity through the stitcher's tie/tuplet/repeat
folding), or drop the feature. Note also the −1.0 line was validated as a **bad-crop proxy for the
labelling queue** — a different job from locating a user's errors, and W2 already found it does not
fire on a blank crop (those score ≈ −0.84).

**The planned 40-page ceiling sample was dropped, with reasons.** Its purpose was to tell a slicer
difference from a resampler difference; gold has now shown agreement is not a quality proxy at all,
so the ceiling is only a reference level. And its stated ±1 pp bar is not resolvable — SE is ~1.6 pp
at n=450 and ~1.2 pp even at 40 pages. **W6 should compare arm A and arm B pairwise on the same
strips** (a McNemar-style count of strips where exactly one arm matches Python), which is far more
sensitive and needs no extra pages.

## 2026-08-02 — W2: the app reads sheet music, and the resampler hypothesis dies

**"Read strips" works end to end in the real app.** Pick a page's `*_sNN_wNN.png` crops → the model
decodes them in the browser → the stitcher builds a score → the editor loads it, plays it, and
⬇ Save JSON writes a valid `schemaVersion: 1` document. Proven in the app itself rather than a
harness (`npm run smoke:app`): 16 crops → 344 notes / 28 measures, sheet renders, playback starts,
no uncaught errors. **~1.1 s/strip**, so a 20-strip page is 20–30 s — slow but fine behind a
progress line, and it means W7 needs no Web Worker.

Sessions load **sequentially**, unlike the gate's `Promise.all`: three `InferenceSession.create`
calls in flight means three sets of weights plus ORT's copies live at once, and on a phone the
failure mode is memory, not bandwidth.

**A measurement bug worth remembering.** The first arm-B run reported **10%** token agreement while
two of three pages produced *byte-identical scores* — an impossible pair, and the tell. Cause:
`decode_page.py` stores raw HF `decode()` output, which glues added tokens (`\sig\komaFlatb`), while
the browser's `detokenize` emits them spaced. Both streams pass through the stitcher's
`normalizeTokens` before becoming music, so comparing before it measures serialization, not reading.
Normalized: **10% → 96.7%** on that sample, **86.0% over 20 pages / 450 strips**.

**The pre-registered rule fired, and was deliberately not followed.** The plan said "if arm B lands
below ~90%, the resampler gap dominates — spend a day matching PIL's BILINEAR first". 86% is below
90%. But the rule's causal model is wrong, and the data says so plainly:

- strips Python flagged (`min_logprob < -1.0`, n=32): **21.9%** agreement
- strips Python was confident about (n=418): **90.9%** agreement
- crop width, which determines how hard a strip is downscaled and therefore how much a resampler
  difference could bite: **no trend** — 89.3% in the narrowest decile against 83.9% in the widest,
  with 75.0% and 92.9% deciles scattered between. Token count equally flat.

Disagreement tracks **model uncertainty**, not resampling severity: near-ties either ORT build can
tip, the same mechanism as the gate's 27/28 and its measured 69/31 coin-flip. `preprocess.ts` is
unchanged. This is the third time on this project that a plausible mechanism has failed to survive
its first measurement, and the second time the pre-registered response would have wasted a day.

**Unplanned benefit: the first real-data evidence that `min_logprob < -1.0` is a meaningful line.**
W1 had to file a non-claim because the 14 gate strips were all too confident to test the boundary.
Here 32 strips fall below it and behave completely differently from the other 418. It separates
exactly the strips where two runtimes disagree — encouraging for W8.

⚠ **Left open, and it gates the release: is the browser WORSE, or only different?** Agreement with
Python cannot tell those apart. The browser reads slightly *fewer* tokens on disagreeing strips (31
of 63 are −1 or −2 ids), which is suggestive and no more. The decisive test is browser decodes
scored against `_realval_v2`'s 267 hand-verified gold strips versus Python on the same strips —
moved to the front of W3, because it is the only finding so far that could change what ships.

Also measured, and relevant to W8: a blank / black / tiny / wrong-orientation image decodes to 4 ids
and 0 events **without throwing**, but scores `min_logprob ≈ -0.84` — *above* the −1.0 flag. The
confidence threshold does not catch an empty crop; the event count does.

## 2026-08-02 — W1: decode module extracted, and a pre-registered criterion that was wrong

`omrGate.ts` 309 → 164 lines; `greedyDecode` / `preprocessCanvas` / `detokenize` and friends now
live in `apps/web/src/omr/` with real exports. `omr-gate.html` is byte-identical and still reads
27/28 with the same failing strip and the same token stream. `preprocessCanvas` widened to any
`CanvasImageSource` (the slicer emits canvases, not `<img>`); `willReadFrequently` was deliberately
left off its context, since moving rasterization to software could perturb `drawImage` filtering
and the gate's canvas arm with it.

**The interesting part is the failure.** `argmaxLast` now also returns the chosen token's
log-probability, and the pre-registered acceptance was "≤1e-3 per token vs `onnx_parity.py`". It
failed at **8.6e-2**. The diagnosis is worth more than the number: ids agree on 13 of 14 strips, so
the decode is sound — the gap is the **ORT-web vs ORT-Python int8 numerics difference already
recorded under STATUS's open risks**, the same effect that tips `bunca_cevrinle`'s 69/31 near-tie
and drops a `\tup3` there. Feeding both sides bit-identical `.pixels.bin` tensors buys identical
*input*, not identical *logits*. So ≤1e-3 was never a claim about our arithmetic; it was an
untested assumption about two runtimes, and it should not have been written as an acceptance bar.

The check was re-aimed at the thing W8 actually depends on — **does the browser land on the same
side of the validated `min_logprob < -1.0` threshold as Python?** Over 576 token logprobs: 0 tokens
and 0 strips disagree. The raw runtime gap is now reported rather than gated, because it is a
property of the two ORT builds and not something this code can fix.

⚠ **Non-claim, recorded so it is not quoted as stronger than it is:** 0 of those 576 tokens came
within 0.1 of −1.0. All 14 gate strips are confident reads (every min above −0.15), so the fixture
cannot test the boundary — "0 crossings" is partly a property of the data. Owed at W3, on real-page
strips where min-logprob actually approaches the threshold.

## 2026-08-02 — the work switches to the product: MVP track opened, W0 passed

**Owner decision: freeze the model, finish the pipeline, release to friends, then train Round 3
against real feedback.** The argument, recorded because it will be tempting to re-open: Round 3
targets pitch (40%) and duration (28%) of user edits through a synthetic content-mix change — a
real lever, but two rounds have already shipped as "improvement, not pass", and a third would change
nothing a friend would notice. Meanwhile the *product* half of the 2026-07-27 goal (show the user
where the errors are) had never been built, and feedback is unobtainable without a pipeline. New
track: [../mvp/README.md](../mvp/README.md), a W0–W10 ladder with per-rung acceptance checks.

**The gap turned out to be one file, not a phase.** Exploration found decode, Donut preprocessing,
detokenization, stitching, the editor and playback all already browser-safe — `omrGate.ts` simply
never exported its helpers (and grabs DOM nodes at import time, which is what blocks reuse), and
`tools/render/stitch.ts` has no node imports and already typechecks under `apps/web`'s strict
config. The only genuinely missing piece is a TypeScript port of `page_to_strips.py`.

**W0 — opencv.js primitive parity: PASS.** Both sides are OpenCV 5.0.0 (checked, not assumed). The
probe runs two arms and the split is what makes it informative: fed *Python's own grayscale bytes*,
opencv.js is exact on all five primitives (Otsu threshold, ink count, the full 2,339-row MORPH_OPEN
projection, connectedComponents, INTER_AREA column sums). Fed the *browser's own PNG decode*, it
drifts — and that drift is unavoidable, because `cv2.imread(IMREAD_GRAYSCALE)` converts inside the
PNG decoder while a browser only ever sees RGBA afterwards.

**The grayscale question was settled by measurement rather than by picking a tolerance**, which is
worth recording because the first instinct was to write a tolerance. OpenCV's own two paths already
differ by ±1 on 7.4% of a colour page's pixels, and 18% of corpus pages are truly colour. So the
test became: re-run the *whole slicer* under that perturbation. All **119 strips across the 6 most
colour-shifted pages came out bit-identical** — same counts, `row_x0`/`row_x1`, `scale`, `row_bars`,
pads. Sub-quantization noise does not reach the output. Numbers:
[../METRICS-SLICER.md](../METRICS-SLICER.md).

**A side effect worth more than the probe: the browser OMR gate is now a command.**
`window.__gateResult` had been exposed since the gate was written and had never once been used —
the gate was checked by opening a browser and reading it. `tools/browser/run-page.ts` runs any
harness page headlessly. The wrinkle: the gate reports a single boolean, and that boolean has read
`FAIL` ever since the known ORT-web int8 `\tup3` wobble, so it cannot distinguish that from a real
regression. The runner therefore tallies the page's own ✓/✗ marks and the script pins
`--expect 27/28`. Baseline captured before any refactor: **27/28, canvas (product) path clean at
14/14**, sessions ready in 3.0 s, ~0.9 s encoder + ~0.2 s decode per strip.

## 2026-07-31 — the whole re-slice is browsable: the `reslice-all` queue

**One queue over all 33,804 crops / 1,704 pages of `data/real/strips_v2`** (30,049 decoded on
Colab), so the re-slice can be *looked at* rather than only sampled — before this, 165 hard-tier
rows were the only crops anyone had seen. `scripts/rung3/build_reslice_queue.py` builds it,
worst-first, seeding each row with the page cache's decode; the 392 val-side emitted labels are
used where they exist. Contract and warnings: [../rung3/labeling.md](../rung3/labeling.md).

**Two things were deliberately NOT done, and both are the same mistake in different clothes.**
Nothing from the older pools (`strips_nota`, `strips_r1`, `strips_tup`) is joined in, because they
were emitted from crops the old slicer cut: a strip filename survives a re-slice and its pixels do
not, so their labels would caption the new crop with the old crop's truth. And the queue is not
proposed as a labelling target — 33,804 hand checks is not a plan, so it ships as a browsing tool
with nothing consuming it. The 165 already-read `realval-hard-v2` verdicts are carried in, since
those *are* the same crops from the same slicer.

**`review_ui.py` had to learn lazy queues to hold it.** 33.8k rows is 16 MB of JSON and
`/api/state` is re-fetched every time the verdict log opens, so queues over `EAGER_MAX` now ship
counts only and their rows come from `/api/rows` on first open. Verified in a headless browser:
first paint 2.3 s, tab switches clean, images resolving from `strips_v2` (the same page also exists
under the old `data/real/strips`, so `QUEUE_IMG_ROOTS` is load-bearing here, not decorative).

## 2026-07-31 — real-val v2 is built; the practice test is finally harder than the exam

**`_realval_v2`: 267 strips at the exam's own difficulty mix (47 / 110 / 110 = 17.6 / 41.2 / 41.2%),
against the old pool's 59 / 41 / 0.** The owner read all 165 queue rows by hand — 111 ok / 44 fix /
10 bad, 155 usable. Numbers: [../METRICS.md](../METRICS.md).

**The worst-first ordering is settled, not just argued.** The worst half of the queue needed a fix
**46%** of the time, the best half **7%** — a 6.5x concentration. Under the old most-confident-first
ordering half the labelling effort would have gone to rows that needed nothing. The sampled
early-stop was available and went unused; the owner read every row anyway.

**The rebuild worked, and here is its measured size.** Both pools read with the same model on the
same day: SER **0.028 -> 0.079**, which now EXCEEDS the exam's 0.052 — the practice test is harder
per token than the test it predicts. Mean edits/page 3.5 -> 8.6 while the median stayed at 2, the
signature of a restored hard *tail* rather than a uniformly harder set. The headline gap to the
exam closed 16.3pp -> 10.1pp, about 38%.

⚠ **The residual gap is class composition, and no amount of hard-strip labelling fixes it.**
Real-val v2 still carries 6 of 8 accidental classes and zero `\komaSharp` in-signature gold, while
the exam headline is substantially a `\komaSharp` n=14 artifact inside a six-class mean. A per-class
mean cannot be matched by matching difficulty when the classes differ. The lever is more
`\komaSharp`/`\kucukSharp` gold in exam v3.

**Two things fell out of the read.** By source, nota (scanned TRT-era prints) runs **5x** the SER of
neyzen (clean vector PDFs), 0.105 vs 0.021, and the hard tier is nota-dominant — so "hard" here
largely means scan quality and engraving age, not musical density. And the first `--build` did not
carry `source`/`makam` onto the new rows, so `eval_omr.py` filed 110 hand-labelled REAL strips under
"synthetic" in its provenance table; fixed with `piece_provenance()`, headline unaffected.

**The 2% pre-shrink is now dead, and real-val v2 killed it on its first outing.** The result had one
defence left: real-val was the easy pool with no hard tier, so an effect confined to hard pages
could have hidden there. Re-run on `_realval_v2` — 41% hard, SER 0.079, harder per token than the
exam — the same frozen model gives **746 edits at the identity warp and MORE at every scale**:
+2.7% at 1%, +2.7% at 1.5%, +5.2% at 2.5%, +4.4% at 4%. On the exam those same rungs were -13.5%
to -15.5%. The effect does not merely vanish off the exam; it reverses. Four independent scale
values agreeing on the sign was the evidence the original claim rested on, and it now points the
other way. Recorded in [../DECISIONS.md](../DECISIONS.md) as DROPPED, measured twice.

**Consumers repointed.** `degrade_probe.py` and `empty_crop_probe.py` default to `_realval_v2`;
`staff_geometry_probe.py` gained `--strips-dir` (default still the frozen exam).
`make_realval_pool.py` is documented as producing the *base* `--build` extends, not the selection
set — pointing an eval at `_realval` silently restores the no-hard-tier pool and fails silently,
because the number still looks like a real-val number. It also stopped carrying a third verbatim
copy of the val-split hash and now calls `data.is_real_val_piece`; verified behaviour-preserving,
0 of 444 pieces change side.

## 2026-07-31 — the full re-slice landed, after a notebook design flaw cost a whole run

**`data/real/strips_v2` is now the complete new-slicer root: 1,781 page dirs / 1,704 decode caches
/ 35,586 crops**, verified so that every cache passes `window_cache_ok` and records
`round2-stage2-best` — the emitter reuses all 1,704 rather than discarding them. 67 pages (4.2%)
found no staves; about half are `_p2` continuation pages that carry lyrics rather than music, and
the rate matches the 4.6% measured on the val side, so it is the expected tail. The **67 exam page
images were deliberately excluded** — the exam is frozen and its gold describes crops under
`data/real/strips/`, so producing a second set mid-round is how a frozen exam ends up scored on
pictures its gold does not describe. Re-cutting them belongs to exam v3.

**The first full GPU pass was destroyed by the notebook, and the lesson is a general one.** The
unpack cell does `rmtree('/content/tnc')` before re-extracting the package, and the decode output
was written *inside* that tree at `/content/tnc/data/real/strips_v2`. Re-running the unpack cell
after an unrelated error — the documented recovery step — deleted a finished 1,506-page run and
restored the package over the top, leaving the page list present and the output gone, which read
as "nothing was ever written". **Expensive output must never live inside a directory whose stated
job is delete-and-re-extract.** The output now lives at `/content/out/strips_v2`, outside anything
the notebook can delete, and the unpack cell reports existing work instead of removing it, so
`--skip-existing` can genuinely resume across sessions.

Three smaller defects fell out of the same session, all the same shape — a path that depended on
the working directory, which a Colab reconnect silently resets:

- Cells that read the output used relative paths, so after a reconnect they failed with
  `FileNotFoundError` while the data sat intact one directory away. All cells now use absolute
  paths.
- `!cp` from Drive does not stop a notebook when it fails, so a missing or still-syncing zip
  surfaced three cells later as a broken package. The unpack cell is Python now, checks the file
  exists and is ~1.2 GB, and asserts the three paths later cells need.
- `make_decode_zip.sh` copied a custom page list over `decode_pages.txt`, destroying the record of
  the previous run's page set. Lists keep their own filename now, and the script takes an output
  zip name so two runs can coexist.

## 2026-07-29 — real-val rebuilt on the new slicer; the labelling queue reversed

**The re-slice ran and the hard-tier queue is staged and being labelled.** The val-side pool is
**146 pieces / 194 pages**, not the 158 STATUS carried — the ⚠ recount was right to distrust the
old figure, and it moved by far more than the ±1 the stem fix predicted (37 of the page stems had
never been sliced into `strips_v2` at all). `emit_strip_labels.py --val-side` now derives that list
through `data.is_real_val_piece` instead of a hand-made list, so the two consumers of the split
cannot drift apart. Emit: 98 ok / 39 low_coverage / 9 unusable; 392 accepted, 550 review, 2,581
dropped, of which **1,007 are the hard reasons** (row_unaligned 743, nd_high 264) — no shortage of
candidates against the 110 owed. It took ~20 min, not the 45–60 estimated: that estimate came from
adding STATUS's separate slicing and emitting budgets, which double-counts, because
`get_decodes` → `decode_page` slices and decodes in one pass.

**The queue is now ordered WORST-FIRST (owner's call), and may be stopped early on a sampled
check.** Reversing it is what the calibration already implied: the decode is exactly right 80% of
the time above `min_logprob` −0.1 and 4% below −1.0, so the confident head was mostly the reviewer
confirming correct rows. Early evidence agrees — **50% of the first 32 rows needed a fix**, against
~84% `ok` in v1's confident head. The stop is deliberately gated on ~20 rows drawn at random from
the remainder and judged on whether the errors *cluster by kind*: scattered label noise handicaps
every candidate model about equally, but one repeated confusion systematically punishes the model
that fixes it. Rows accepted unread carry `by=tail-accept` so they stay auditable.

**Two silent-staleness traps were found and closed before any labelling happened.** Both are the
same shape — a strip *filename* survives a re-slice but its pixels do not:

- `build_queue` wrote its PNG copies behind `if not dst.exists()`, and **59** of the new candidates
  reuse a v1 filename. Queues are now versioned per re-slice (`_realval_hard_v2/`), the PNG is
  always rewritten, and a queue refuses to overwrite an existing CSV — which also preserves v1's
  130 verdicts instead of destroying them.
- Worse: `review_ui` resolved `/img/` through one global root list with `data/real/strips` first,
  and **129 of the 165** new rows also exist there. The whole queue would have rendered last week's
  crops against this week's rows, with nothing to notice. Image lookup is now keyed by queue
  (`QUEUE_IMG_ROOTS`) and verified end-to-end: v2 serves `strips_v2`, v1 still serves the old root,
  and the two crops differ.

`build_realval_v2.py` also grew the `--build` half its docstring had always promised but never
implemented, and `--strip-root` / `--pools` are flags now rather than constants — pointing the
script at a stale root was a silent wrong answer, not an error.

**Still owed:** 1,578 non-exam pages remain on old-slicer crops (page list in
`data/colab/decode_pages_reslice.txt`). Until that Colab pass runs, Round-3 *training* data is cut
by a different slicer than the one the app ships — real-val is correct either way, since new crops
are what production produces.

## 2026-07-29 — the page-stem collision: one collision, one duplicate, opposite fixes

**Closed the "two source pages collide on one stem" item left open by the windowing session — and
the obvious fix was right for only one of the two.** The proposal was to rename both with a makam
suffix. Checking the bytes first changed the answer:

- `bir_nigah_et_ney` — hicaz and saba PDFs differ, and they match **different SymbTr pieces**:
  Şekerci Cemil Bey / ağıraksak against Zeki Arif Ataergin / aksak. Two unrelated songs whose titles
  slugify the same. A real collision; one page was being destroyed on every slice. → both stems
  qualified with the makam, both pages kept.
- `nesem_emelim_ney` — hicaz and uzzal are **byte-identical**, PDF *and* rendered PNG (same sha256),
  and both rows match the *same* SymbTr piece. neyzen.com serves one upload under two makam
  directories. The "silent overwrite" here was overwriting a file with itself; nothing was ever
  lost. → uzzal copy dropped.

**Why renaming the duplicate would have been actively wrong:** it converts a harmless duplicate into
two real copies of one page in the pool, and near-duplicate pages landing on opposite sides of a
piece-level split is the exact leakage the by-piece split rule exists to prevent. The distinction is
free to compute — same match target means duplicate, different match target means collision — so
`collect_tuplets.neyzen_stems()` now derives stems that way over the whole match CSV, and both the
download and export paths share it so they cannot disagree.

**Scope was measured, not assumed.** Hashing every page image on disk and re-scanning every row of
the match CSV each returned **exactly these two** stems, so the class is closed rather than the two
instances patched. `emit_strip_labels.py` now refuses to slice when two pages resolve to one stem —
the failure was silent for two weeks, which is the part worth preventing.

**Fallout, recorded because it costs something.** The `bir_nigah_et_ney_p1` crops in `strips/` and
`strips_v2/` were cut from an unrecoverable one of the two pages — both are 1653×2338, so geometry
cannot identify the source — and were deleted; the pending re-slice regenerates them. The 5
realval-hard verdicts on that stem (3 ok / 1 fix / 1 bad) are void, which the queue rebuild already
covered. `nesem_emelim_ney_p1` crops were **kept**: both sources are byte-identical, so those crops
are well-defined whichever page produced them. The Colab page lists turned out to have **both**
colliding pages queued into the same strip dir, confirming the bug was live in that job too; fixed.

## 2026-07-29 — the windowing retune: constants stay, two cap bugs fixed

**The retune from the entry below was run to a conclusion, and its premise did not survive.** The
sweep that pointed at `MEASURES_PER_STRIP = 1` had been scored on *usable yield* — does a decode fit
the 59-id budget — which improves monotonically as windows shrink, because it cannot charge for the
near-empty crops shrinking creates. Those crops carry 20.8% of exam corrections. Re-scored with that
cost included, 1 measure/window takes the healthy band **81.6% → 60.4%**. The constant stays at 3.

**Why measure count was the wrong control variable at all:** across 31,968 decoded strips, width
explains only R² 0.54 of a strip's token count (stems + inked columns explain 0.77), the budget is
simultaneously over-run (11.5%) and under-used (28.6% spend ≤25 of 59 ids), and **8.9% of single
measures blow the budget alone** — which no `MEASURES_PER_STRIP` can fix. So a budget-aware packer
was built, decoded head-to-head against legacy on 16 val-side pages, and came back a **wash**
(healthy band 75.8% vs 75.7/76.2%; bad-crop proxy 14.4% vs 14.5/14.0%). It buys +16 usable strips
for +1.6pp more near-empty crops, so it ships OFF behind `OMR_WINDOW_MODE=budget`, like
`drawThinSharps`.

**What was actually broken** — found by measuring the pool, not by reading the file (the rule that
cost two reverted patches last session). The measure cap was unenforced (13 of 3,168 strips) and the
width cap was violated 82 times by **three separate paths**: the `lead` clef prefix re-extending
window 0 after the check, `_split_wide`'s gutter-shifted cuts overrunning, and the driver's crop pad
being added post-check. Both fixed, verified 13 → 0 and 82 → 0 on the affected pages, with measure
coverage invariant across 458 rows — no music gained or lost, at a cost of +7.2% strips on those
pages. Also fixed: decode caches were keyed on `measures_per_strip` alone, so a packing change would
have silently reused crops from different code — the same confound that spoiled the earlier n_ids
read.

**Then the crops stopped overlapping.** The owner spotted that the 6 px left pad has no matching
right trim, so neighbouring strips share pixels and a note could be read twice. The overlap was
real — 74.8% of mid-row strips — but the double-count was not: a notehead is 22 px against a 6 px
band, and on decodes a note repeats across an overlapping boundary **1.3%** of the time against a
**6.85%** within-strip null. (Two geometric estimates on the way to that, 1.2% and 7.8%, were both
wrong — one test window was too wide, the other also fires on beams. The decode test settled it.)
Chasing the edges turned up the reason to make the change anyway: **no label ever names an edge
barline** (0 of 421 start or end with `|`), yet real crops ended on the barline centre and showed a
closing one **61%** of the time against **5%** for the synthetic strips the model trained on. The
trim closes that to 22.5% — the rest is row-final strips, which have no successor to hand the
margin to. Decoded A/B on 16 pages is a wash, so it is kept for structural consistency rather than
accuracy, behind `OMR_EDGE_TRIM`.

**And the frame stopped cutting beams off.** The owner noticed 32nd-note beams sliced by the bottom
edge of a crop. Measured: the 336 px frame allows 4.60 sp above the staff and only 2.60 below, while
real music reaches 2.68 sp below at p90 — **11.6% of real staff rows lost content**, against 1.4% at
the top. Border ink alone would have misled here: 48.6% of real strips have ink on the bottom border,
but only 5.0% of it is the row's own music; 43.5% is a neighbouring system bleeding in, which more
margin would make worse. So the fix redistributes the frame rather than enlarging it — height and
the 30 px spacing stay, only the staff's position inside them moves, per row. Bottom clipping
11.9% → 4.4%. ⚠ Two honest caveats: the decode A/B is neutral (bad-crop proxy 13.8% → 15.0/15.6% at
two doses, no dose-response, so noise at 326 strips), and the "vertical shift is free" result that
first motivated it was measured at ~3 px against the 39 px shift used here — it did not license the
change, which is why the A/B was run. Kept because a clipped beam is destroyed information that a
confidence proxy cannot see; **not** claimed as an accuracy win.

**Left open:** `data/real/strips_v2` was sliced before these fixes and needs re-slicing before the
emit. And two source pages collide on one stem (`bir_nigah_et_ney_p1`, `nesem_emelim_ney_p1` each
exist under two makams), so one page of each pair is silently overwritten — found incidentally,
unfixed. Numbers: [../METRICS-SLICER.md](../METRICS-SLICER.md).

## 2026-07-29 — re-sliced the val-side pages, then found the slicer's windowing is mistuned

**The re-slice happened** — 158 val-side non-exam pages into `data/real/strips_v2` (3,168 strips),
a new root so the existing manifests and the 130 labelled queue rows keep pointing at intact crops.
Decided after the owner labelled the whole first queue and **43 of 130 (33%) turned out to be
unusable crops**, leaving 87 against the 110 needed — a re-slice was required either way.

**Then the emitter probe on one re-sliced page came back `accepted=3 review=2 dropped=25` of 30**,
with `over_budget: 11`. That stopped the full run, and the investigation found something worth
knowing before anyone re-emits.

**The 2026-07-25 slicer fix was right, and its downstream constants were never retuned.** The old
staff-detection kernel lost the ends of staff lines, pushing `x0` 70–490 px right and cutting off
clefs and whole measures; `STAFF_HOR_FRAC = 0.11` stopped that, and slivers fell 10.4% → 1.2%. But
rows now carry more music while `MEASURES_PER_STRIP = 3` and `MAX_STRIP_W = 1450` still assume
truncated rows. Decoding both crop sets with the **same** model (the earlier comparison was
confounded — the two decode caches came from different models): crops over the 59-id label budget
went **20.9% → 31.9%**. The emitter drops those, so content is captured correctly and then thrown
away. Sweeping `MEASURES_PER_STRIP`: 1 → 107 usable strips, 2 → 90, 3 → 79. Monotonic, current value
worst. **Not a licence to set it to 1** — that objective counts budget fit only and ignores lost
context, more stitcher pieces, and a mismatch against a synthetic corpus built at 2–4 measures.

Also found: `MEASURES_PER_STRIP` is not enforced. The sliver-merge checks the width cap but not the
measure cap, so 13 of 3,168 strips carry 4–5 measures.

**The owner's labelling was the source of most of this.** Their read — "the model did a great job,
the old slicer did not, and the fixed strips still have some slicing issues" — is confirmed on every
count: model accuracy tracks the confidence calibration (84% `ok` in the top band against a
predicted 80%), 33% of old hard crops were unusable, and the moderate-quality band is unchanged by
the overhaul (~10% under both slicers).

Also settled: **low confidence predicts a BAD CROP**, 89% below `min_logprob = -1.0` (16 of 18).
This **corrects** an earlier claim in these docs, drawn from the first 7 verdicts, that confidence
could not detect a bad crop. High confidence still does not guarantee a good one (6% of the top
bucket were bad), so it is a screen, not a proof.

## 2026-07-28 — Round 3's checks were run BEFORE rendering. Three of four ideas died; the real win was not on the list

**Why this session mattered:** Round 3 was scoped as a full 40,826-strip re-render plus a paid
training run, aimed at four hypotheses. All four were testable against the already-shipped model for
the price of a decode, so they were tested first. That was worth doing — **three of the four
hypotheses are wrong**, and the change that actually pays is one nobody had proposed.

**The tool that made it all possible.** Decoding the whole exam once (326 strips) reproduces the
known 562-edit total exactly, so per-strip attribution became available for the first time. Every
number below comes off that one decode plus cheap variations of it.

**What died, and why it is worth having killed:**

- **"The model invents a bar when a crop has no notes."** It does not. Only 1 of the 8 note-free
  crops that exist in all our labelled pools invented anything (bar: ≥50%). It simply cannot *read*
  them — essentially every token wrong. The 19-edits-against-8-gold-tokens strip reproduced exactly;
  the page has a circled ④ in frame, so the trigger looks like unfamiliar page furniture, not
  emptiness. The *cost* is real and confirmed (≤3-note crops = 5.5% of strips, 20.8% of edits) but
  the shape is the **slicer's** deliberate trade-off, already halved by the current slicer, so
  teaching the renderer to imitate it is backwards.
- **"Cut the wide crops narrower."** Looked like the biggest single lever (>1200 px crops = 28.6% of
  edits at 2.5× the per-token rate). Splitting them at a zero-ink gutter against identical gold made
  it **worse, +31.8%**. And 19 of 45 have no internal bar-line, so a measure-aligned split is not
  even possible. Killed for the cost of one 45-strip run.
- **"Our beams are too heavy, like our sharps were."** The opposite: ours sit at the engraving
  standard 0.500 S, real print is 0.567–0.765 S. Thinning them would have moved us *away* from real
  print — a change that would have shipped into 40,826 strips on an untested analogy.

**The apparent win that wasn't — the most instructive part of the session.** Testing the
staff-geometry hypothesis showed the model getting *better* under perturbation. Decomposed, the
whole effect sat on **scale**: a ~2% shrink removed **15.5% of all exam corrections** (562 -> 475),
reproducible across four scale values with a clean optimum. It looked like the largest free lever
the project had found, and it was written into six documents as a headline result.

**Then it failed to replicate.** On the real-val holdout the same operation gives 247 -> 243, -1.6%.

**The mistake, stated plainly, because it is the reusable lesson:** ~15 variations were run against
the frozen exam and the best-scoring one was reported as a finding, before any holdout was tried.
That is selection on the test set. A holdout run costs two minutes; it should have come first. A new
process decision now says so ([../DECISIONS.md](../DECISIONS.md)).

No mechanism was ever found either, which in hindsight was the warning sign. Ruled out along the
way: staff-size matching (the exam benefit appears in *every* size bucket — undersized -33%,
already-correct -10%, oversized -16% — not just oversized strips), resampling (down-up 555), blur
(562), ink lighten (565), ink thin (589). Also worth recording: the "identity warp" control used to
rule out resampling was itself invalid — an exact identity matrix makes warpAffine copy pixels
rather than filter, so it never tested what it claimed to.

⚠ Not fully closed: real-val is the EASY pool (0.9 edits/strip against the exam's 1.7) and is
missing the hard tier entirely, so an effect confined to hard pages could hide there. That is one
more reason the real-val rebuild gates everything, and the re-test belongs after it.

**Three wrong diagnoses about one file.** All three were about `page_to_strips.py`; two became
patches and both were reverted.
The first added a forward-merge for leading slivers and was **dead code** — re-slicing 67 pages gave
byte-identical output. The second assumed `MAX_STRIP_W` was blocking the sliver merge; the slicer's
own manifests disproved it (0 of 18 narrow crops were `split_wide`). Both diagnoses were inferred
from reading the file instead of measured against its output. Two detectors inside the probes failed
the same way and were caught only by looking at contact sheets. **The rule that came out of it:
measure the estimator before touching the slicer** ([../DECISIONS.md](../DECISIONS.md)).

**Also learned:** synthetic staff spacing has sd **0.000** — every training strip is identical. The
plan said we shake "five times less than reality"; we shake *not at all* before augmentation. That
makes the uncommitted `staff_jitter` op better motivated than the doc claimed, but the ladder says
variance is not what costs edits today, so it stays **insurance, not a fix**.

**Real-val rebuild started, and labelling immediately taught us something.** The gap is
composition, measured: exam 18/41/41 easy/mid/hard against real-val 59/41/**0**. Hard means the
emitter *dropped* the strip (`row_unaligned` / `nd_high`), so no label was ever written — there is
no pile to filter, the strips have to be labelled. 110 are owed; 130 were staged, seeded with the
current model's decode and ordered by confidence.

The confidence ordering is calibrated, not guessed: on the exam's 145 hand-labelled hard strips the
same model is exactly right 80% of the time above `min_logprob = -0.1` and 4% below −1.0. The live
review agrees (84% `ok` in the top bucket). **But confidence cannot see a bad crop** — 3 of the
owner's 7 `bad` verdicts sit in the highest band, where the model confidently and correctly reads a
frame that is itself wrong.

**Which surfaced the real problem: everything we label and everything we examine on is old-slicer
output.** Strips date 2026-07-15..17; the slicer was overhauled 2026-07-25 and nothing was
re-sliced. Re-slicing 5 queue pages: 0 of 30 crops identical, 2 gone, old 207 px slivers now 1435 px
full rows. The owner's independent read from labelling says the same thing — the model reads well,
the bad crops are the old slicer's, and the current slicer's crops are good. The frozen exam carries
the same stale crops, so exam and real-val stay consistent with each other while both measure a
pipeline we no longer ship. Decision left open in [../DECISIONS.md](../DECISIONS.md); the
recommendation is to re-slice before spending the expensive remaining 61 rows.

Also settled, so nobody re-fixes it: **`f'' 32` is not a decode error.** It tokenises identically to
`f''32`; the tokenizer splits the octave marks from `32` either way. Holds for `32` only — `16` and
`8` genuinely differ.

New probes, each carrying its pre-registered bar and its result in the docstring:
`scripts/rung3/empty_crop_probe.py`, `width_split_probe.py`, `beam_weight_probe.py`,
`staff_geometry_probe.py`. Numbers: [../METRICS.md](../METRICS.md). Detail:
[../rung3/round3.md](../rung3/round3.md).

## 2026-07-27 — Round 2 SHIPPED: `round2-stage2-best` int8 is the live runtime

The re-scoring earlier the same day reopened the "not shipped" call and the owner took the ship. It
is the **same disposition as Round 1: an improvement, not a pass** — the pre-registered macro floor
(≥85%) is still failed at 74.2%, and that stays written down rather than rounded up
([../DECISIONS.md](../DECISIONS.md)). What justified it: micro recall 83.9 → 84.8%, macro≥30 recall
81.4 → 84.8%, micro F1 flat, SER 0.059 → 0.052, exact 50.0 → 52.1%, 9 of 11 floors.

**Ship chain, all green.** ONNX export → int8 (221 MB, same as every rung) → `onnx_parity.py`
**14/14 fp32 and 14/14 int8** → `make_browser_gate.py` → browser gate **27/28**. Details in
[../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md).

**The gate list had to be rebuilt** — the Colab checkpoint arrived without a `GATE_STRIPS.txt`, same
as Round 1. Built from `strips_v4` **val** pieces (held out from this model's training): 120
candidates decoded, 108 exact, greedy feature cover → 14 strips / 14 pieces / 11 makams covering
`\sig`, all six koma/küçük/bakiye families, `\tup3`, `\tie`, `\grace` and a double dot. *Why the
method matters:* the first attempt compared decoded **strings** and reported 0/120 exact — the
tokenizer eats the spaces around `\`-tokens, so comparisons must happen in id space
(`data.strip_special`). A string compare would have looked like a catastrophically broken model.

**One gate strip still fails, deliberately kept — and this time we measured why.** A
`kurdilihicazkar` strip drops its opening `\tup3` on the **reference** path only; the canvas path —
the actual product path — reads all 14 strips exactly, and Python-ORT int8 reads that strip exactly.
Feeding the browser's own reference tensor back through Python-ORT with per-token confidences shows
the flipped step is a **genuine near-tie**: `\tup3` p=0.689 vs `e` p=0.306, and it is the **only**
token in the strip under 0.99 (next lowest 0.938). So the runtime is not corrupting a confident
prediction — it is tipping a coin the model was already holding. Graph and JS preprocessing both
exonerated. Second instance of the ORT-web wasm int8 wobble (Round 1's was a dropped double dot,
which does **not** reproduce on this model). Not swapped out for a cleaner strip: swapping would
delete the evidence, and the precedent is now a decision.

**Revert path:** the Round-1 runtime is at `data/checkpoints/_public_models_backup_round1/`; the
Round-2 ONNX at `data/checkpoints/round2-stage2-best-onnx/`.

## 2026-07-27 (evening) — Real-pool label review: 30% of the nota pool had a wrong label

The owner worked the `nota-full` queue through every strip where the label and the model's decode
disagreed. Promoted with `promote_labels.py`: **54 corrected labels applied, 7 `bad` strips
removed**, nota pool 1,747 → 1,740, real pools 2,330 strips / 444 pieces, exam guard still clean.

**Hit rate by disagreement level** (checked strips, "wrong" = corrected or removed):

| nd > 0.06 | 0.03–0.06 | 0–0.03 | nd = 0 |
|---|---|---|---|
| 77% (228) | 79% (273) | 80% (112) | 26% (73) |

So ~78% of the labels on disagreeing strips were wrong — an extremely high return on review time,
and far better than labelling new strips from scratch. Combined with pitch being 40% of the model's
remaining errors, this is the same shape as the `sigTolerant` finding: noisy labels sitting in
exactly the class we are trying to improve.

**Two caveats recorded so the number is not over-read.** The 30% is over the REVIEWED population,
which was selected for being suspicious; the 556 strips still unverdicted are all `nd = 0` and were
never flagged, so their rate is unmeasured and probably lower. And **Round 2 already trained on the
earlier 467 corrections** — verified by reading the manifest back out of `tnc_round2_colab.zip`,
which is byte-identical to today's pre-promotion manifest. Only the 54 new ones are new.

**Consequence for Round 3:** its real pool is cleaner than Round 2's. That is one more difference
between the rounds on top of the corpus changes, so attribution gets harder again unless it is
chosen deliberately ([../rung3/round3.md](../rung3/round3.md)).

Also promoted-with-rejects: 24 rows rejected by the mechanical gates — 14 `over_budget` from the
review queue (the deferred recoveries) and 10 `not_in_manifest` (corrections against strips that are
not in the training pool; checked, none are the exam pieces removed earlier the same day).

## 2026-07-27 (end of day) — Round 3 planned: note heights and note lengths

Written up in [../rung3/round3.md](../rung3/round3.md). Two diagnostics shaped it, both from the
Round-2 exam read with no new decoding.

**Note heights (40% of corrections) are off by ONE or TWO positions in 74% of cases** — a
registration problem, not a reading problem. Measured staff geometry, synthetic vs real: mean line
spacing 30.6 vs 31.8 px (the slicer's normalisation works), but real strips vary about **twice** as
much (± 4.9 vs ± 2.7). One note position is ~15 px. Meanwhile `augment.py` shakes each picture by
only ±3% scale and ~3 px translate — roughly **five times narrower than the real variation**. Fix is
an augmenter setting, not a re-render. Flagged as a lead, not a fact: the staff detector used was a
row-darkness heuristic that lyrics and dense beaming can fool, so it needs re-measuring properly.

**Note lengths (28%) are lopsided:** `8→4` ×8 and `16→8` ×6 — the model reads a note as twice as
long, i.e. loses a flag or beam — plus 15 dot errors both ways. Same shape as the sharp-bar finding:
our font's strokes are heavier than real print and thin detail merges after the shrink. The
`sharp_probe` investigation has never been applied to beams, flags or dots.

Round 3 therefore opens with four measurements before anything is rendered (staff registration,
beam/flag/dot fidelity, crop shapes, strip density), and two things to settle before training: the
success number written down first, and a deliberate choice about changing one thing versus several
— Round 2 changed three and its movement still cannot be attributed.

## 2026-07-27 (later still) — Where the user's corrections actually go: accidentals are 13% of them

No training, no new exam read — just the Round-2 exam's 562 edits classified by what a person would
have to fix. Numbers in [../METRICS.md](../METRICS.md).

**pitch 40% · duration 28% · rhythm signs 13% · accidentals 13% · structure 5%.** Two rounds went
into the 13%. The old headline made accidentals look like the whole problem because it *only*
measured accidentals — the same failure mode as the inline-vs-signature mistake, one level up.

**Errors are concentrated AND pervasive.** 42 of 326 strips carry 63% of edits; 12 strips are >50%
wrong and carry 21%. But excluding those 12 barely moves the mix (pitch 36%, duration 29%), so
ordinary strips misread notes and note-values too. 55 of the note-level errors are whole notes
*inserted or deleted* — the model losing count rather than misreading a glyph.

**The catastrophic strips are a crop-shape gap we created.** The worst is a signature-only crop —
clef + donanım, no notes — where the model hallucinated a measure: 19 edits against 8 gold tokens.
`stripExport` builds chunks from whole measures, so that image **cannot occur in training**: 0 of
40,826 strips, while the exam has 4 of 326 and 28% of its strips are short. Third time in three
sessions that a "model problem" has turned out to be an upstream shape we never rendered.

**Negative result worth keeping — gold octave errors are real but NOT a lever.** All 5 octave-only
substitutions are cases where the GOLD leaps ≥4 steps from both neighbours while the model reads the
stepwise line (owner's hypothesis, and it was right). Consistent with the 187:14 adjudication
precedent of siding with the decode. But it is ~1% of edits and the pools are clean (0.1–0.2% of
strips carry an isolated octave spike), so it does not explain the pitch weakness. Theory closed
with a number rather than left open.

**Consequences for Round 3:** aim at pitch and duration, not accidentals; render the crop shapes the
slicer produces first (cheap, no training); and measure the corpus's pitch/duration distribution
against the real pools before designing anything — that method has overturned the plan twice.

The error-localisation UI is **deferred by the owner**. The measurement that would justify it is
still cheap and still owed, with a pre-registered rule: flagging 10% of tokens must catch ≥60% of
errors.

## 2026-07-27 (later) — The goal changed: user effort, not model accuracy

**New goal: ≥90% of pages need ≤5 corrections, and the app shows where they are.** "85% on the
per-class accidental mean" is demoted to a diagnostic. Reasoning in [../DECISIONS.md](../DECISIONS.md);
baseline in [../METRICS.md](../METRICS.md); the goal itself lives in [../../ROADMAP.md](../../ROADMAP.md) §0.

Three things pushed it. The old metric does not track usability — Round 2 got *better* for a user
(fewer edits, more perfect strips) while that metric got worse. We are already at **84.8%** on its
low-n-robust form, so the remaining headroom is two rare classes. And the untouched lever is bigger
than the remaining accuracy: a page is ~95% correct already, but the user must proofread all of it
to find the ~5 wrong marks, which is where the time saving goes.

`eval_omr.py` now reports an `EDITS/PAGE` block so the goal is measured, not aspirational
(`Strip` carries `page`; one edit = one substitution/deletion/insertion). Round-2 baseline over the
46 exam pages: **57% of pages ≤5**, median 5, mean 12.2, 52% of strips already perfect.

**The target was restated once, immediately, and the reason is worth keeping.** It was first written
as "a typical page needs ≤5" — reasoning from the mean (12.2) and assuming that was a ~2.4×
improvement. The baseline then came back with a **median of 5**: the distribution is heavily
right-skewed, so the target as first written was satisfied on the day it was set. Restated on the
*share of pages* (≥90% ≤5), which is where the actual pain is. A goal that is met the moment you
write it measures nothing.

Non-claims attached to it: the exam is a matched upper bound, so real uploads will be worse; and
whether error localisation genuinely saves a user time is unmeasured — that needs a person
correcting real pages with and without the highlights, not a model metric.

## 2026-07-27 — Round 2 read the exam once: headline down, everything else up, diagnosis half-right

Trained on `strips_v4` with Round 1's recipe held fixed (two-stage, `--real-dir …:9` to hold real at
34% of batches). Exam read once on the 326-strip clean set. Numbers: [../METRICS.md](../METRICS.md).

**The result is genuinely mixed, and the headline is the part that got worse.** Against `round1-best`
on the *identical* strips with the *same* re-audited gold: mean AEU F1 **78.0 → 73.9%**, but SER
0.059 → 0.052, exact 50.0 → 52.1%, and 9 of 11 floors improved (Round 2 clears `\komaFlat`
precision, which Round 1 missed). **Not shipped** — Round 1's "improvement, not a pass" argument
does not extend to a model whose headline moved backwards.

**What the fixes actually did.** Küçük-in-signature recall went **50 → 72%**, and küçük overall
58.1 → 69.7% — the label-noise fix worked in exactly the place it was aimed. Its precision fell
100 → 76.7%, the trade registered before the run.

**What they exposed.** The Round-1 error was one-directional: gold küçük decoded as koma, reverse
essentially never — the signature of a fallback bias, which is what 91% of drawn küçüks being
labelled as nothing would produce. That bias is gone. Underneath it is a **symmetric** confusion:
`\kucukSharp → \komaSharp` 8×, `\komaSharp → \kucukSharp` 7×, **all 15 inside the `\sig` block**,
net `\komaSharp` emission **0**. The model is no longer guessing the common class; it genuinely
cannot tell 2 bars from 3 at signature positions.

*(An earlier reading of this — "we flipped the bias" — was wrong, and the confusion counts
disconfirmed it. Net komaSharp emission of 0 is not a bias in either direction.)*

`\komaSharp` collapses to F1 21.4% because n=14: seven wrong swaps is half the class. `\kucukSharp`
takes the same coin flip across 33 gold and still reads 69.7%. A per-class mean over six classes
then carries koma's collapse straight into the headline — the low-n fragility METRICS has warned
about since Round 1, now costing 4pp.

**The lead this opens.** Every glyph-fidelity measurement we have — `sharp_probe`, the 0.300 S bar
weight, küçük's pitch widened to 0.65 S — was taken on **inline** glyphs. Signature glyphs are
packed at `SIG_GLYPH_ADVANCE = 13 px`, were never examined, and hold **32 of the exam's 33 küçük
tokens**. Widening küçük's bars may even hurt there, where horizontal room is fixed. That is Round
3's first measurement, and it should be measured before anything is re-rendered.

Instrumentation added the same day: `eval_omr.py` now reports recall split by print position, which
is how the signature-only confinement was visible at all.

**Then the metric itself was fixed — and it overturned the verdict above.** The headline is a mean
over classes, so a 14-gold class weighs the same as a 145-gold one. `eval_omr.py` now also reports
**MICRO** (pool tokens, not classes) and **MACRO≥30**, and `scripts/rung3/rescore_headline.py`
back-fills both for every past run straight from the stored `per_class` blocks — hits and false
positives are recoverable from gold/recall/precision, so **no model was re-run and no exam re-read**.

On the identical 326 strips:

| | Round 1 | Round 2 |
|---|---|---|
| macro recall (historical headline) | 78.5% | 74.2% |
| micro recall | 83.9% | **84.8%** |
| micro F1 | 85.0% | 84.8% |
| macro≥30 recall | 81.4% | **84.8%** |
| macro≥30 F1 | 83.9% | **84.4%** |

**Round 2 was never a regression** — flat-to-better on every low-n-robust measure, on top of SER,
exact-match and 9 of 11 floors. The "not shipped" decision is overturned and the ship question
reopened.

Two things deliberately NOT done. Micro was **not** promoted to the headline: it was computed after
the fact and happens to flatter us (~85% vs 74%), and swapping the bar to the number that makes the
result look good is how a benchmark stops meaning anything. Macro stays the pre-registered bar —
for a music app, a rare mark misread is still a wrong note — with micro/macro≥30 used to judge
*whether a change helped*. And the 85% target was **not** restated against micro; the real repair is
more `\komaSharp` gold in exam v3, so the strict metric becomes trustworthy instead of replaced.

Retrospective worth keeping: macro has been reporting 66–78% across this project while token-level
accidental accuracy sat at 83–85% for both models. Neither number is wrong; they answer different
questions, and only one of them was ever being quoted.

## 2026-07-26 (later) — The küçük deficit is a SIGNATURE-reading problem, and 5 exam pieces were in the corpus

Two findings while starting the Round-2 re-render, both of which changed what gets rendered.

**1. We had been aiming at the wrong print position.** The Round-1 follow-up said to balance
*inline* küçük frequency (1,887 koma vs 206 küçük strips) and to put the three sharps on
neighbouring notes. Splitting every gold label into `\sig … \sigend` tokens vs note tokens shows the
exam's küçük gold is **1 inline vs 32 in the signature** (photo gold: 3 vs 13), and the scorers
count both. So the whole class is effectively scored at the row start.

It cannot be otherwise, and the reason was already in our own code: `noteToLily`'s `sigTolerant`
branch (`tools/render/lilypond.ts`) prints a note **bare** when its alteration runs the same
direction as the signature's — SymbTr stores the SOUNDING value, so eviç is a 5-comma F♯ printed
bare under a koma-sharp-F signature, which is what real editions do. Confirmed end-to-end: a dry
render of two küçük-heavy pieces (mahur, nisaburek) under real non-küçük signature variants produced
**zero** inline `\kucukSharp` — the mechanism built to force them inline cannot work, by design.

In the context that scores, the corpus was never imbalanced: küçük sits in 1,210 signature strips
against koma's 1,422. The real gap is **diversity** — signature-position küçük comes from just 3
makams in 4 spellings, so "mahur ⇒ küçük-f donanım" is learnable without reading the glyph.

*Why this was missed:* the imbalance was counted with the signature block stripped out, and the
count was never checked against where the gold actually sits. Print position is now a first-class
split in METRICS, and the scorers owe the same split.

**2. `strips_v3` contained 5 exam pieces.** `hisarbuselik--vuslata_nail`, two `kurdilihicazkar`
şarkıs, `mahur--cihani_lal-i`, `nikriz--zeybek`. The train-time disjointness guard added after the
Round-1 contamination only inspects the `--real-dir` pools, so our own synthetic engraving of an
exam piece walked straight past it. `select_pieces.py` now refuses exam pieces by SymbTr id at
selection time.

**Shipped with this:** `select_pieces.py --keep/--boost-class/--per-makam-cap/--sig-table/--exam`
(extend a selection instead of re-rolling it — re-rolling would change the held-out set and
invalidate the split), `data/pieces_v4.json` = 208 pieces (185 kept − 5 exam + 23 küçük-bearing,
capped at 6 per makam and restricted to makams with a real printed signature).

**Dropped before use:** the enharmonic respell `\bakiyeFlat` → `\kucukSharp`. It works mechanically
and is the same trick that manufactures büyük examples, but it prints a spelling real editions
don't use, and küçük precision is already 100% — it could only fall.

**3. Then the dry render showed a strip drawing a sharp its label didn't mark — and it was in the
shipped corpus.** `sigTolerant` (print same-direction alterations bare) was implemented on the
LABEL side only; `SheetView` drew every deviation from the signature. Counted over `strips_v3`:
**18.8% of signature-bearing carry strips draw at least one accidental the label omits** (5,240 /
27,933; 8,485 accidentals, 137 pieces), and the worst-hit class is `\kucukSharp` — **2,369 drawn but
unlabelled against 234 correctly labelled inline, i.e. 91% of the küçük sharps drawn on a notehead
are labelled as nothing.** The model was trained to see the glyph and emit nothing, which is exactly
its measured behaviour: 48% recall at 100% precision.

Fixed in `SheetView` by giving the drawing the same rule (owner decision: fix the pixels, because
real editions print bare — the exam has 1 inline küçük in 352 strips). Verified pixels-only: over a
re-rendered piece all 20 labels are byte-identical, the previously spurious sharp is gone from the
image, and genuine deviations still print. `round1-best` trained on the un-fixed corpus, so its
sharp numbers carry label noise as well as Bravura's bar weight — the two are not separated by any
measurement taken so far.

**4. Built the check whose absence let all of this ship: `tools/render/verify-labels.ts`.** It
re-opens every job from the corpus manifest (which stores the full URL parameter set, so the job
reproduces exactly), reads every accidental glyph out of the live SVG — Bravura glyphs by SMuFL
codepoint, the redrawn AEU sharps by their unique stem/bar counts — assigns each to the crop rect it
falls inside, and compares against that strip's label, signature block included. Glyph identity
comes from the DOM, never from the code under test.

Validated with a POSITIVE CONTROL before being believed: with the `sigTolerant` fix temporarily
reverted it flagged 15 of 30 strips on three known-bad v3 jobs, every delta exactly `\kucukSharp`
drawn-but-unlabelled. A gate that has never been shown to fail proves nothing.

Full `strips_v4` pass: **40,826 of 40,841 exact, 0 label drift, no unrecognised glyphs.** The 15
flagged are crop-boundary bleed — measure boxes don't split exactly between glyphs, so a crop
occasionally clips its neighbour's accidental; they appear as ± pairs on adjacent strips, and the
image shows a cut-off notehead before the barline. Geometric, pre-existing, 0.037%. Excluded from
the manifest rather than trained on (`excluded_boundary_bleed.txt`), so the shipped corpus is 40,826
strips. `make_round2_colab_zip.sh` refuses to build if any flagged strip is still in the manifest.

**5. The Round-2 shakeout refused to start — and it was right to.** `train.py`'s exam-disjointness
guard found **4 real-pool pieces that are also exam pieces** (`huzzam--sevdim_yine`, two
`kurdilihicazkar` şarkıs, `saba--neydin_guzelim`). These are the 2026-07-22 contamination: the guard
was added then, but nobody removed the strips behind it, so they survived into Round 2 and this is
the first run that actually tripped over them. 14 strips dropped (11 nota, 3 tup); real pools are now
2,337 strips / 444 pieces with zero exam overlap. Originals kept as `manifest.jsonl.pre-examclean`.

The lesson is not "the guard works" but that a **guard without a cleanup leaves the bad data in
place** — it only converts a silent problem into a loud one at the next run, which in this case was
four months later. The same shape as finding 3: the check that would have caught it did not exist
where the data was produced.

**Not built: the signature-contrast drill set.** The plan was to generate donanım spellings the 3
real küçük makams don't cover. Dropped after checking the adjudicated real labels: across every
printed signature we have, `\kucukSharp` appears on **f and nowhere else** (104 occurrences), so a
drill would have to print accidental/letter pairs no edition prints — the same objection that killed
the respell. Signature coverage comes from the 23 added pieces instead.

## 2026-07-26 — Microtonal sharps: it was our renderer, fixed at source

Diagnosed in three steps, cheapest first ([../rung3/round2.md](../rung3/round2.md)):
- **Resolution ruled out.** `scripts/rung3/sharp_width_test.py` regroups already-scored strips by
  the encoder's effective scale (Donut thumbnails a 336×579–2472 strip into 409×583, scale
  1.22→0.24). Recall does not fall with scale on either dataset; `\bakiyeSharp` holds 84–94% in
  every bucket. The deficit follows the **symbol**, not the size — so the expensive narrow-strip
  rebuild was never the lever. *(Logged, not chased: ~⅔ of the encoder's input window is blank
  padding, because a 4:1 strip fits a 1.43:1 box.)*
- **One substitution, one direction.** Gold `\kucukSharp` → decoded `\komaSharp`, 11× clean exam /
  10× photos, top error in both; the reverse essentially never.
- **Root cause: Bravura's glyph weight.** The four AEU sharps are one systematic design (1–2 stems
  × 2–3 slanted bars), so reading them *is* counting bars. Measured against two real editions at
  matched staff size, Bravura's bar is too thick and küçük's three bars too tightly packed, leaving
  under half the real white gap (~1–2 px after the shrink) — the bars fuse into a block that IS a
  2-bar koma. Real print also draws küçük's outer bars stubby either side of a full-width middle
  bar; Bravura's three are near-equal, which kills the staircase a reader recognises.

**Shipped opt-in:** `drawThinSharps` (`apps/web/src/SheetView.tsx`) redraws all four AEU sharps as
SVG at real-print bar weight; `?thinsharps=1` / `--thin-sharps`, off by default. Verified in-browser
(every AEU sharp replaced, 0 left on Bravura). Artifacts: `data/real/rung3/sharp_probe/`.
**Still owed:** the frequency imbalance (see [../METRICS.md](../METRICS.md)).

Also this day: the docs were restructured for agents (this file, `CLAUDE.md`, `STATUS.md`,
`METRICS.md`, `DECISIONS.md`, `docs/rung3/*`), and the pointer docs — which had drifted 18 days
behind — were re-synced first.

## 2026-07-25 — Photo axis, and the exam's own answer key

- **Slicer photo front-end.** Raw `page_to_strips.py` yielded 0 strips on 72% of photo pages: its
  `w/4` staff-detection kernel cannot tolerate ~1.5° handheld skew (a skewed line never stays on one
  pixel row for a quarter of the page). Fixed with guarded auto-deskew + crop-to-quad/perspective
  de-warp + `STAFF_HOR_FRAC = 0.11`; all no-ops on clean scans, and the narrower kernel also stopped
  silently dropping faint/bottom systems on clean renders. **Yield 28% → 97%.**
- **Honest photo score.** First a fitting-alignment estimate against borrowed clean gold, then the
  owner hand-labelled **284 photo strips** directly (`build_photo_gold_queue.py` + review UI
  `photo-gold` tab) and `score_photo_gold.py` scored strictly per strip. Photo sits **3–4pp** behind
  clean pages → the photo domain is basically solved by the front-end, and the remaining weakness is
  a clean-domain reading problem.
- **`|` and `\tie` are fine** (90/94% F1) despite the initial impression; the weakness is the
  microtonal sharps.
- **Exam gold re-audited.** The frozen gold was already ~82% reviewed, so a full hand-audit found
  only 13 new label errors — and they ran one way: the human answer key **over-sized** sharps
  (buyuk/koma where the page prints bakiye). Re-scoring lifted the headline, but ~11 of the 12pp is
  a low-n artifact, not model improvement. **Two lessons:** the per-class-mean headline is fragile
  to low-n classes (exam v3 must floor or weight by n), and Round 1's "fail" was partly a label
  artifact — while the koma/küçük-sharp weakness is real.
- New scripts: `decode_photos_exam.py`, `score_photos_exam.py`, `score_clean_baseline.py`,
  `score_photo_gold.py`, `build_photo_gold_queue.py`, `build_exam_fix_queue.py`, `apply_exam_fix.py`,
  `photos_exam_report.py`, `sharp_adjudication_report.py`; `review_ui.py` gained the
  `photo-gold` / `exam-fix` queues and multi-root image serving.

## 2026-07-24 — Carry-sig bug characterized

The synthetic no-regression failure's error dump named a real defect: under a
`\sig \kucukFlat b \sigend` signature the model inserts a spurious inline `\komaFlat` on `b'` —
restating, in the wrong koma family, an alteration the signature already carries. **Carry-mode
accidental/signature interaction is not solidly learned**, it reproduces on synthetic (so it can be
iterated on with perfect labels), and it plausibly explains both the exam's `\komaFlat` precision
miss and the komaSharp↔kucukSharp confusion. Logged in `MODEL_EVAL.md` as "carry-bug".

## 2026-07-23 — Round 1 shipped as "an improvement, not a pass"

- **Disposition.** On the honest exam it missed 5 floors, but it beats the previous live model on
  everything tracked: rhythm-rewriting pathology 77.6% → 0%, SER 0.147 → 0.060, exact 17% → 49%,
  triplet precision 15% → 93%. Keeping the worse model live would hurt users, so it ships with the
  result recorded honestly.
- **Shipped:** `round1-best` int8 is the runtime in `apps/web/public/models/`. Parity 10/10 fp32 +
  10/10 int8. Browser gate **19/20** — one rare double-dot token (`a''2..` → `a''2.`) trips an
  ORT-web int8 numerics wobble that is model-independent (reference *and* canvas fail identically →
  not JS preprocessing; Python-ORT int8 is correct → not the graph) and was never exercised by the
  old gate. Logged as a Round-2 investigation item, not blocking. Previous runtime backed up at
  `data/checkpoints/_public_models_backup_rung22/` (revert = re-stage it).
- **Run-first diagnostics** (items 1–4 of the plan-review addenda; 5/7/9 kept as commitments, 6 & 8
  dropped by the owner):
  - *Item 1* — the 28pp real-val↔exam gap decomposed by difficulty tier: **composition dominates**
    (real-val lacks the 41% hard tier), edition familiarity is small, and a new
    **decode-self-agreement inflation** surfaced (real-val mid is ~45% `acc_disagreement` strips
    whose labels ARE the decode). Cheap residue of dropped item 6 kept: exclude decode-derived
    labels from the rebuilt real-val metric pool.
  - *Item 4* — degrade probe: hallucination is **not** ambiguity-driven (precision and emission rate
    flat clean→OOD), so Round 2 should not chase renderer accidental-rate deconfounding.
  - *Item 2* — train-time exam-disjointness guard shipped in `train.py`; flags exactly the 4 known
    contaminated pieces.
  - *Item 3* — canonical real-val split shipped as `data.is_real_val_piece` (byte-identical to
    Round 1); both Round-2 consumers must reuse it.
- **Plan-review addenda adopted** — see [../rung3/round1.md](../rung3/round1.md) for all nine, and
  [../DECISIONS.md](../DECISIONS.md) for the two that were dropped.

## 2026-07-22 — Round 1 trained, then examined: FAIL on five floors

- **Init A/B done.** Arm A (two-stage) wins on real-val. The triplet catastrophe is fixed — the slur
  distractors did their job. Margin is low-n driven; on ≥30-gold classes the arms tie. A pre-run fix
  is logged: stage 2 first had real at 5.9% (each real strip seen <1× in 2k steps), caught before
  running and corrected to `:8`, else Arm A was merely "Arm B with a warm start".
- **Every-share sweep cancelled** before any run, after first being amended the same day. Grounds
  were measured, not preferred: the largest available intervention moved the amended metric 0.5pp,
  the target pathology was already fixed by the re-render, and the amendment carried a
  stage-1-length confound. Full reasoning: [superseded.md](superseded.md).
- **Exam taken once → does not pass.** Read locally so exam strips never reached the training box;
  pre-flight re-confirmed the freeze from gold labels alone. Five floors missed, five cleared
  (numbers: [../METRICS.md](../METRICS.md)).
- **The lesson that outlived the run: real-val was wildly optimistic** (95.0% → 66.6%, ~28pp)
  despite both pools being piece-disjoint — real-val pieces sit inside editions the model trained
  on. Standing rule: real-val orders candidates, it does not predict the exam.
- **New Round-2 targets from the error dump:** `\komaSharp`↔`\kucukSharp` confusion in both
  directions within one piece, and `\tup3` → `\grace` substitution (the model stopped over-firing
  triplets and now under-reads real ones).
- **Contamination found in post-read verification:** 4 SymbTr pieces / 25 strips (7.1%) had their
  *other* engraving in the training pools. Root cause: the disjointness guard was emit-time only and
  nothing re-validated when the exam GREW. Corrected read on 327 clean strips barely moved the
  numbers, so the verdict stands; `strips_exam_v2_clean/` is the honest reference from here.
  Exam v3 owes a train-time assertion (shipped the next day), re-validation whenever the exam grows,
  and dedupe on SymbTr piece id rather than image stem.

## 2026-07-21 — Round-1 synthetic re-render: `strips_v3`

- **Ordering changed: Round 1 runs first, the additive-only re-slice moves to Round 2** (see
  [../DECISIONS.md](../DECISIONS.md)). Round-1 data scope frozen.
- **Design (locked):** carry mode (`measure`) replaces keysig and is dominant, at transpose 0 only
  so the conventional makam signature matches the notation, bulked via `CARRY_PASSES=4` seeded
  passes; `every` mode is the minority and carries the transpose augmentation. `stripExport.ts`
  gained a carry branch (`\sig` prefix on row-start only — matching how real carry strips are
  labelled).
- **Per-makam conventional printed signatures**: `data/makam_signatures.json` +
  `scripts/build_makam_signatures.py`, built from adjudication-confirmed `\sig` blocks in the
  promoted real labels (theory only as fallback), variants uncapped (hicaz 4, şehnaz 4,
  nisaburek 3), all 49 corpus makams — fed to both the drawn glyphs and the labels.
- **Slur distractors** (`drawSlurArc`): label-free arcs over ≥3 notes with no "3", on a seeded ~35%
  of non-tuplet runs — the fix for "any arc ⇒ `\tup3`". Verified pixels-only (15 drawn with seed vs
  0 without; labels byte-identical).
- **Accidental-distribution measurement:** carry matches real (0.36 vs 0.32 inline accidentals per
  strip) but `every` is 26.7% of strips and 81% of all inline accidentals — 4.4× the real effective
  rate. This produced the `--every-share` decision (and, later, its cancellation).

## 2026-07-20 — The exam baseline and the pre-registered bar

- **Exam v2.1 baseline taken** over the full 352 strips; supersedes the 33-strip 83.3% number as
  THE pre-Round-1 reference. The numbers Round 1 had to move: `\tup3` precision 15.1% (rampant
  hallucination, dominating SER), `\kucukSharp` recall 22.6%, `\tie` 66/61%.
- **Multi-pool loader** in `train.py`: repeatable `--real-dir DIR[:REPEAT]`, stable piece-hash
  real-val split consistent across pools, synth-val pieces forced to val, `--oversample-tup N`, real
  strips train un-augmented unless `--augment-real`, checkpoint selection on the strip-weighted
  synth+real val mix — the exam never consulted.
- **Step 4.0 ship criteria written** before any training and before the exam was seen again: every
  floor stated next to its measured baseline, ties deliberately unfloored, blind spots written down
  as non-claims, and a binding decision rule (real-val selection, exam once, no silent re-roll).
- **Arc-metric code landed first** and the baseline cell was filled by re-running the *spent*
  rung22-stemfix exam read (same frozen model + exam = zero leakage): denominators came out to
  exactly 85/229 and F1 to 57.0%, confirming the pre-registration. Never debug measurement code on
  one-shot exam day.

## 2026-07-19 — Exam v2.1 frozen; slicer hardened

- **tup3 review queue fully adjudicated** by hand (147 rows: 102 fix / 35 ok / 10 bad) plus the full
  78-strip audit (70 ok / 7 fix / 1 bad — 10% auto-accept error, the best pool yet).
- **nota-full quality tier**: +38 model-drafted verdicts. Two rules came out of it — the
  **meter-sum rule** (the label won all 15 duration-only disputes; decode durations break the
  measure meter every time) and the **sig superset/subset rule** (decode won 17 crop-cut cases, the
  label won 5 where the decode hallucinated an extra sig entry; superset sig reads are suspect,
  subset/empty reads are usually crop truth). Promotes applied: **strips_nota 1,742 → 1,758**
  (420 audit fixes in place, 27 promoted, 11 known-bad removed, 24 over-budget → the re-slice
  pool); 126 nota-full pitch/accidental disputes stayed pending as post-Round-1 re-audit work.
- **tup3 exam extension:** 10 holdout tuplet pieces (21 stems, all engraving copies) moved to the
  exam → exam manifest 311 → 352 strips, tup3 gold 4 → 55 groups; training keeps 172 tup3 strips.
  `testset.json` = **v2.1** (45 piece entries). Holdout stems poisoned in the nota queue too.
- `promote_labels.py` now rejects ambiguous source stems (2 title collisions, e.g.
  `bir_nigah_et_ney` = two different songs — their shared page dir is a latent re-slice hazard).
- **Slicer hardened** against real-corpus false positives (stems and G-clefs cut as barlines,
  skew-eaten staff extent, phantom clef+sig lead measure): a third TERMINATION gate walking the
  connected overshoot past the outer lines, raw-ink staff extent, notehead-gated prefix trim, padded
  crops, reject-reason debug overlay, and `scripts/rung3/score_slicer.py` as a regression scorer.

## 2026-07-17/18 — Exam hand-work finished; tuplet collection

- **examv2-full done** (the last exam hand task): all 63 auto-accepted exam strips verdicted —
  31 ok / 32 fix / 0 bad. Fixes were 22 tie-only, 4 volta/repeat, 4 pitch/duration (~6% content
  error), 1 sig-block removal, 1 accidental-class fix. **mahur (18) + suzidilara (16) sig-suspects:
  zero signature corrections** — the voted signatures were confirmed. 31 of 32 applied; the 32nd was
  60 ids (over the 59 cap) and removed as unwinnable. Exam manifest → 311 strips.
- **Targeted tuplet collection** (the response to the measured tuplet gap): SymbTr scanned for
  tuplet pieces (459 found, 267 already held), **293 new tuplet pieces downloaded** (36 nota
  review-promotes + 257 neyzen from the never-downloaded census tail; 60 brand-new SymbTr pieces +
  164 second-engraving copies of pieces already held). Budget analysis showed tup3
  needs 1-measure windows — `OMR_MEASURES_PER_STRIP` knob added; 2,325 tup3 measures / 3,384 groups
  fit at k=1, while 1,512 dense measures still await the sub-measure fragment design. The k=1 decode
  ran on Colab per the fanless-Mac rule.
- **strips_tup trimmed to tup3-only** (owner call): 78 accepted strips / 114 groups (every group
  verified as exactly 3 closed notes) + a 147-row review queue / 205 groups. Review-UI tabs
  `tup-full` / `tup-review` / `tup-audit` wired.

## 2026-07-16 — nota audit, adjudication at scale, exam grown 10×

- **69-strip nota audit** fully adjudicated (29 ok / 40 fix). Decomposition: 8 pure sig-order (now
  no-ops after canonicalization), 1 sig-block, 26 tie/repeat structural, **5 pitch-level = 7.2%
  content error** vs neyzen's 22.6% — the Round-0.5 labeler earned its keep.
- **All 231 sig_mismatch + all 216 acc_disagreement rows verdicted.** Training manifest
  1,262 → 1,435 → 1,742 across two promotes (combined real pool 1,853 after the first, 2,160 after
  the second, neyzen included).
- **The acc_disagreement lesson:** the owner's fixes sided with the decode 187:14 over SymbTr —
  printed editions win accidental disputes, the never-auto-accept rule avoided 187 headline-class
  poisonings, and the labeler's decode is the right *edit draft*.
- Sig-entry order canonicalized everywhere (serializer + ~404 existing labels); 198 sig-less w00
  labels validated and kept (crop-cut dominates, 96%).
- **examv2-review done** (287 rows: 249 promoted / 12 bad / 26 over-budget = unwinnable under the
  59-id cap): exam manifest 63 → 312 strips. `promote_labels.py --exam` added; exam and training
  pools are mutually guarded.
- **The exam measures triplets weakly** — `\tup3` gold was only 4 (budget depletion), which is what
  later forced the tup3 exam extension.
- Sharpness analysis: the review queue is systematically the blurry tail (accepted median 1672 vs
  ~900 Laplacian variance), except `acc_disagreement` rows (1703 — sharp *and* accidental-bearing =
  the best value left). Rare-class real gold is thin (komaSharp 26 / kucukSharp 31 tokens) →
  synthetic oversampling, not queue-grinding.
- **Photo-domain exam prep:** all 25 exam-piece PDFs staged and merged
  (`data/real/rung3/photo_exam_pdfs/`, 38 pp) for print-and-photograph.
- Three slicer defects logged for the re-slice: w00 crops cutting clef/sig, note stems mistaken for
  barlines, bisected noteheads. Review policies logged: a cut note or dangling accidental *inside*
  labeled content = bad, *outside* = ignore the fragment.

## 2026-07-15 — Round-0.5 labeler + the two-source stage

- **Round-0.5 labeler trained + exported** (throwaway, real-only, from `rung22-stemfix-best` on the
  418-strip promoted pool, exam pieces excluded from train AND val): real-val SER 0.086 → 0.021,
  AEU 70 → 91.7%, sig reads 100%; parity 8/8. Never shipped — it exists only to draft labels.
- **notaarsivleri two-source stage complete:** census 20,833 TSM pieces → 966 metadata accepts →
  964 downloaded; **1,227 pages GPU-decoded on Colab**; a fold-search 2ⁿ blow-up fixed
  (`SPAN_SUBSET_CAP=12` + hill-climb). Emit over 938 pieces (440 ok / 338 low_coverage /
  160 missing_pages) → **1,262 accepted nota strips + a 2,671-row review queue + a 69-strip audit
  sample**. Dominant drops: row_unaligned 4,467 / split_wide 3,757 / over_budget 2,108 — the
  `MEASURES_PER_STRIP=2` re-slice is the #1 yield lever.
- **Exam re-frozen as v2**: 25 pieces / 16 makams (23 nota + 2 neyzen), every reachable class ≥44
  gold, no LOW-N; exam emit 63 strips + a 287-row growth queue. Sig clusters flagged but not yet
  adjudicated (mahur, suzidilara).

## 2026-07-14 — Adjudication and the promote script

The 348-row neyzen review queue was hand-adjudicated (341 fix / 4 bad / 3 ok — the conservative gate
was right: nearly everything flagged needed fixing). `scripts/rung3/promote_labels.py` applied the
verdicts through the real gates (≤59-id budget with the training tokenizer + a labels-cli `--check`
round-trip over raw label text): **training pool 84 → 418 real strips**, provenance columns on every
row. 10 rejects: 7 over-budget (60–73 ids — re-slice territory) and 3 split-duration typos. The
script is idempotent, keyed on image.

## 2026-07-12 — The emitter, the first frozen exam, the first real number

- **Strip-label emitter built and calibrated** on the 85 matches (emitter-first order, owner
  decision): carry-mode label serialization + carry-aware decode, persisted slicer measure geometry
  (PNGs byte-identical), per-token logprobs in the ONNX decode, `labels-cli --ranges` batch mode, and
  `emit_strip_labels.py` — D.S./da-capo tail folding (64/85 pieces jump), content-driven monotonic
  row search (editions reorder sections; a cursor can't follow), printed-signature majority vote with
  label override (real pages print the makam's **conventional** signature, not SymbTr's derived
  one — 33/85 overridden), `sigTolerant` written-vs-sounding handling, and a triple gate
  (≤59-id budget, decodeLabel round-trip, decode-disagreement threshold with accidental-class
  disagreements always going to a human).
- **Yield:** 84 auto-accepted training strips + a 348-strip review queue + 33 exam strips.
- **First frozen exam** (`testset.json`, provisional): 20 pieces / 16 makams, all 6 reachable AEU
  floors met, seeded and deterministic. `eval_omr.py` gained per-source blocks and LOW-N markers.
- **First real baseline: the synthetic→real gap became a number.**
- **Review UI** (`review_ui.py`, stdlib server on :8377): queue tabs, one-keystroke ok/fix/bad
  verdicts written atomically into the emit CSVs, solfège display, label-vs-decode token diff,
  Bravura token reference. **Full audit of all 84 accepted strips: 65 ok / 19 fix / 0 bad = 22.6%
  needed correction** (spurious flattened-SymbTr `\repstart` the edition doesn't print; slurs
  decoding as false `\tie`).

## 2026-07-11 — Free labels from name matching

`scripts/rung3/match_symbtr.py` fuzzy-matches the 798 downloaded PDFs against SymbTr (makam alias
table, incipit/composer/form token scoring): **85 auto-accepted pairs**, 28 review-band, exported per
piece as `score.json` (ground-truth note model) + `labels.json` (per-measure tokens via the new
`tools/render/labels-cli.ts`). Written-vs-sounding verified: the `toAeuAlter` snap makes an uşşak
export print `\komaFlat b` like the page does.

## 2026-07-10 — Real corpus collected; the page pipeline works end to end

- **Corpus collected:** `scripts/collect_notalar.py` (census → makam-weighted download →
  PDF→PNG rasterize) pulled **798 engraved PDFs → 1,259 page PNGs at 200 dpi across all 89 makams**
  from neyzen.com's freely-published archive (robots-allowed paths, polite, resumable, seeded).
  Census = 8,442 pieces; downloads proportional to per-makam song count with a floor for variety.
- **Rung-4 stages 1–7 (slicer + page decode):** `page_to_strips.py` — staff systems via
  horizontal-open + row projection, each row scale-normalized to the training geometry, barlines by
  **continuity + thinness** (plain per-column darkness is not enough: stems pass it and real
  barlines fail it), ~3-measure windows, row-starts keeping clef+keysig, over-wide fallback splitting
  at whitespace gutters, `--debug` overlay. Five real-page bugs fixed during verification, including
  **volta brackets clustering as a 6th staff line** (fix: keep the most evenly-spaced 5-line window).
  `decode_page.py` chains the slicer into the int8 ONNX greedy decode. First real page (hicaz şarkı,
  7 rows → 21 strips): keysig read on every row-start, repeat/volta structure captured, accidentals
  decoded. Known rough edges at the time: spurious tuplet tokens on some 16th pairs, occasional
  `\sig` inconsistency — exactly the synthetic→real gap the labeling loop trains away.
- **Rung-4 stage 8 (stitcher + editor feed-in):** `tools/render/stitch.ts` turns decoded strip tokens
  into a schemaVersion-1 note model — joins strips/rows re-inserting the `|` the crop boundary ate,
  resolves bare notes from the row's `\sig` block (an empty block never clears an established
  signature), folds rhythm signs back, then expands structure (repeat/volta passes, D.C. al Fine with
  segno/coda jumps) and emits bar-unit offsets so `assignBars` reproduces the decoded barlines. Model
  noise is normalized and warned, never fatal. Verified: 13 structure unit tests + **194/194 bundled
  scores round-tripping exactly**. The loop closed: `decode_page.py` → `stitch-cli.ts` →
  `apps/web/public/decoded.json` → harness, with a **⬇ Save JSON** button exporting corrections.
  Live proof: the hicaz page gave 21 strips → 23 written / 28 expanded measures and 225 events that
  render and play (headless-verified); a second page (nihavend) gave 25 strips → 29 written / 37
  expanded measures, 288 notes.

## 2026-07-09 — Rung 2.2b: stem fix + triplet expansion

A real neyzen upload misread triplets as `16. 32`. Two fixes: a renderer bug (`new Beam(sub, true)`
forced tuplet stems down, so the "3" engraved below where real scores put it above) and 40
triplet-rich pieces added (150 → 190), rebuilding `strips_v2_2` with 1,487 triplet strips (was 413)
and 89 val triplet strips (was 9). The from-base retrain passed with no regression, and the ONNX
export passed the same day including a **real-strip proof**: the strip that triggered the round now
decodes `\tup3 g''8 f''8 \tupend`. One nav gate strip was fp32-exact but int8-borderline
(`\buyukSharp`→`\bakiyeFlat`) and was swapped for an int8-exact strip.

## 2026-07-08 — Rhythm signs (triplets, ties, grace notes)

Four faithful tokens `\tup3` `\tupend` `\tie` `\grace` (96 → 100 ids, appended at the end), all
**recovered from real SymbTr durations, never injected** (`tools/render/rhythm.ts` — pure per-measure
functions shared by SheetView and the serializer, so pixels == labels by construction). Delivered:
parser/exporter grace kind, core `EventKind "grace"`, triplet groups from reduced exact fractions,
tie pairs (accidental only on the first note; long rests split side-by-side with no tie), grace
glued to its host; tuplet groups / tie pairs / grace+host are unsplittable packing atoms; the
measure editor hides graces and re-attaches them on save. Drawing: triplets beam together with a
hand-drawn curved arc + italic "3" on the notehead side (~70% of pieces by name hash — the printed
Turkish shape, owner-verified) or VexFlow's bracket, `StaveTie` arcs, `GraceNoteGroup` slashed
noteheads. `strips_v2_2` rendered, audit PASS; non-regression: all 8,575 feature-free measures
serialize byte-identical to v2_1. Rung 2.2 retrain and its ONNX export both passed the same day.

## 2026-07-07 — Rung 2 passes; the no-server premise holds on a real model

- **Colab kit:** `docs/COLAB.md` + `notebooks/rung2_colab.ipynb` + `scripts/make_colab_zip.sh` (one
  self-contained 320 MB upload). Plan decision: **Colab Pro, not Pro+** — a full run ≈ 5–10 compute
  units, Pro's 100 covers the campaign.
- **Rung 2 PASSED first try** on `strips_v2_1` (batch 16, lr 3e-5, 6000 steps ≈ 110 min; best val
  loss 0.0045 at step 4000, flat after — no overfit). Nav marks ≥96% each, repeat signs 100%.
  Weakest token `\sig`/`\sigend` at 95.5% recall — largely the known **empty-signature ambiguity**
  (an every-mode row-start crop of a signature-less piece is pixel-identical to a keysig-mode one,
  but only the latter's label has `\sig \sigend`); benign downstream. **The CRNN+CTC fallback is
  retired for accuracy reasons too.**
- **Rung-2 ONNX export passed the same day**, with `src/vision/quantize_onnx.py` now committed.
  Gate strips come from held-out val pieces and carry real Turkish accidentals + repeat/nav tokens.

## 2026-07-06 — Training kit, navigation marks, `strips_v2_1`

- **Training kit:** `augment.py` (two profiles mixed at `PHOTO_SHARE = 0.35` — 65% screenshot,
  35% full camera-photo pipeline; the preview grid is the human gate), `modeling.py` (shared
  model/tokenizer wiring so train and eval can't drift), `train.py` (full fine-tune, AMP,
  warmup+cosine, split-by-piece loaders, per-worker RNG reseeding, checkpoint/resume for Colab),
  `eval_omr.py` (headline per-class AEU accuracy + SER + exact-match via id-space Levenshtein
  alignment). Verified on the Mac: train → resume → eval all run, val loss falling monotonically.
- **Navigation marks:** segno 𝄋 / coda ⊕ / "D.C." / "Son" as 4 faithful tokens — zero in SymbTr
  (like repeats) but routine on real sheets and required for the Phase-4 da-capo expansion. Seeded
  injection (4–6 marks on ~70% of renders, density set by simulating the audit floors *before*
  rendering, never stacked on repeat/volta measures), SheetView drawing, labels at the drawn measure
  edge, decoder round-trip, audit floors.
- **`strips_v2_1` re-rendered** (18,627 strips / 470 MB, all 150 pieces, zero render errors; nav
  floors cleared at train 220–392 / val 25–45 per token, 6.4% nav strips) with the nav tokens and
  the **centered-rest fix** (`alignRests` off —
  rests had been floating near the top line, unlike printed sheets). v2 stays on disk; v2_1
  supersedes it for training.
- **`docs/PIPELINE.md` written**: the full page-photo → strips → decode → stitch → note-model design.

## 2026-07-05 — Rung-2 dataset upgrades (`strips_v2`)

18,624 strips / 466 MB from 150 pieces (47 makams), selected from 2,030 usable corpus files by
`scripts/select_pieces.py` (greedy
max-min over the AEU classes with exact projected counts — the TS spelling math ported to Python).
Everything seeded and reproducible: any strip's manifest row reconstructs its harness URL. Delivered:
token cap 46 → 56 (over-budget single measures dropped as untrainable), 39.9% multi-measure /
40.7% `|` coverage, random repeat injection, transposes (−9…+9 commas), lyric and lyric-free
variants, in-SVG header/footer text noise, low-rate büyük enharmonic respell, split-by-piece
(125 train / 20 val, committed `data/split.json`), and the pass/fail gate `audit_coverage.py`
(per-class floors + a real-tokenizer ≤59-id check). The renderer is URL-param-driven, chunked and
resumable. OpenCV augmentation deliberately NOT baked in.

## 2026-07-02/03 — The de-risk ladder (Rungs 0–1.5)

- **Step-1 model gate:** `Flova/omr_transformer` reads its own sample staves, outputs a LilyPond
  token stream, and its vocab is extendable (`add_tokens` + `resize_token_embeddings` proven).
- **Label serializer + strip renderer** (`tools/render/`): `docToStrips` packs short strips; a
  Playwright script crops PNG+label pairs out of the harness's own live render.
- **Faithful + signature label scheme** implemented and round-trip verified on all sample scores.
- **Rung-1 overfit-10: GO** — 10/10 strips reproduced exactly on the Mac (MPS). The gate caught two
  decode-side wiring bugs (no-EOS labels; generation stopping on "." instead of `</s>`), both fixed
  and carried forward.
- **Repeat signs:** 4 faithful drawn-symbol tokens (the base vocab's structural `\repeat`/`volta` are
  unusable), placement by **duplicate-run detection** verified against a printed score. Also found:
  246/256 rendered strips were single-measure → Rung 2 had to guarantee multi-measure strips.
- **Rung-1.5 ONNX/browser gate: PASS** — the no-server premise proven end to end: `optimum-cli`
  export → int8 dynamic quantization → decoded in a real browser via `onnxruntime-web` with a
  hand-rolled JS greedy loop and a JS port of the Donut preprocessing; 3/3 gate strips reproduced
  their exact label ids. Python parity checked first.

## Phases 0 and 1 (2026-06-20 … 2026-06-28)

Symbolic → microtonal audio with no ML, then the shared TypeScript core + React web harness
(piano-roll, VexFlow sheet with AEU accidentals, transport, editing, usul-aware metronome,
transpose/ahenk, lyrics and header). Full detail: [HISTORY.md](HISTORY.md).
