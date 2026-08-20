# The exam — freezing an honest test set (Steps 2 and 3)

purpose: how the never-trained-on exam is built, frozen, grown and audited
audience: agents and the owner working the real-page track
updated: 2026-08-20

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

## Steps 2+3 — BUILT + CALIBRATED (2026-07-12); provisional exam frozen, first real baseline taken

> Implementation status. The emitter (`scripts/rung3/emit_strip_labels.py`), the exam builder
> (`scripts/rung3/build_testset.py`), the carry-mode label serialization, and the honest eval
> are DONE and gated; the plans below remain the reference for the design. What the 85-piece
> calibration taught us (each finding is now baked into the pipeline):
>
> 1. **Real pages are jump-structured.** 64/85 pieces decode a printed segno/Son/D.C.; 40/85
>    carry the flattened D.S. signature in SymbTr itself (the tail duplicates an earlier run).
>    The emitter folds that tail (`detect_dc_tail`) as a fold-candidate next to the adjacent
>    repeats; strips touching the jump-mark measures (or decoding a nav token) go to review.
> 2. **Editions reorder/omit sections**, so a global cursor cannot assign rows — each row's
>    decoded id stream is content-searched against every printed window (monotonic, pruned,
>    margin-or-identical-content acceptance; `\sig` blocks stripped for position-finding).
> 3. **The printed signature is the makam's CONVENTIONAL one, not SymbTr's content-derived
>    one** (hicaz pages print ♭+♯+♯ where derivation gives 2 entries). The emitter
>    majority-votes the model's row-start signature reads and overrides the label signature
>    with the printed truth (33/85 pieces needed it); split votes -> `sig_mismatch` review.
> 4. **Written vs sounding, second layer:** SymbTr's 5-comma eviç under a koma-sharp-F
>    signature is printed BARE (the performer supplies the intonation). Real labels are
>    emitted `sigTolerant`: same-direction intonation refinements of the effective alteration
>    stay bare; explicit signs mark genuine chromatic deviations only. (Caught by the
>    stage-4 eyeball gate — the audit process worked.)
>
> **Final thresholds (calibrated):** strip accept `nd <= 0.10` AND no accidental-class token
> in the label/decode disagreement (`acc_disagreement` — rhythm noise is provably model-side,
> accidental disagreements are exactly what the headline metric can't tolerate, so they always
> get human review); review band `nd <= 0.35`; row search `nd <= 0.45`, margin `0.10`.
>
> **Yield (2026-07-12):** `strips_r1/` = **84 auto-accepted training strips** (23 pieces,
> high-trust: audit samples are exact/near-exact) + **348-strip review queue**
> (`emit_review.csv`: nd_review / acc_disagreement / sig_mismatch / nav / low_coverage — the
> recoverable pool for the planned review interface); `strips_exam/` = **33 exam strips** +
> 443 exam-review. Auto-accept is deliberately conservative: wrong labels are worse than few
> labels, and the review queue is where the volume lives. Also: 233 over-budget drops
> (real 3-measure windows exceed the 59-id cap — a `MEASURES_PER_STRIP=2` re-slice would
> recover many; follow-up).
>
> **Exam frozen (provisional):** `testset.json` — 20 pieces / 16 makams, all 6 reachable
> class floors met (büyük = 0 on real pages, unmeasurable; komaSharp/kucukSharp LOW-N),
> deterministic per seed, committable (`.gitignore` negation chain). Re-run over both sources
> when notaarsivleri lands, THEN commit = the freeze, before Round-1 training.
> **→ ✅ RE-FROZEN v2 over both sources (2026-07-15):** `testset.json` now **25 pieces /
> 16 makams (23 nota + 2 neyzen), every reachable class ≥44 gold accidentals, NO LOW-N
> classes** (bakiyeSharp 361, bakiyeFlat 148, komaFlat 105, kucukFlat 47, komaSharp 44,
> kucukSharp 44; büyük unreachable as before). v1 backed up as `testset.json.bak-v1`.
> Exam emit on the v2 pieces: **63 accepted exam strips + 287-row growth queue**
> (`strips_exam_v2/emit_review.csv` — supersedes the old 443-row `strips_exam` queue).
> Committing testset.json = the freeze.
>
> **First real baseline (`MODEL_EVAL.md` "Rung 3 — real-page exam BASELINE"):** the synthetic
> Rung-2.2b checkpoint scores **83.3% AEU / SER 0.018 / 78.8% exact** on the exam strips (vs
> 99.9% / 0.002 / 96.7% synthetic) — the synthetic→real gap is now a number for Round 1 to
> close.

## ⭐ Exam v3 — the bounded growth, decided 2026-08-20

**Decision: label the 21 exam pages we already own and stop there. 46 → 67 graded pages.** Owner,
2026-08-20, after asking how much more exam labelling was worth doing. This is
[levers.md](levers.md)'s power-note **option 1** (grow the exam before the read, which keeps the
one-shot rule intact) taken in a bounded form, with **option 2 applied on top of it** (report the
interval beside the result). The census, the drop table and the sizing arithmetic are in
[../METRICS-EXAM.md](../METRICS-EXAM.md) and are not restated here.

**Why these 21 pages and no others.** They belong to pieces that are *already* exam-only, so
labelling them takes nothing away from training. Every page beyond 67 costs a piece removed from the
model's training data **and** hand labelling, to buy a precision improvement that goes as the square
root of the work.

**Why we stop rather than push to 113 or 200.** With a 75% floor, the score a model must *measure*
before its interval clears the floor is ~86% at 46 pages and still ~81% at 200. No affordable exam
size makes a near-boundary call crisp, so the honest instrument is the interval, not a bigger n.

**Cost.** ~7.1 strips a page ⇒ **~150 strips**, of which (scaling the v2 emit's 63-accepted /
329-review split) roughly **120–130 need a human**. For scale: `batch3` has ~1,385 rows still open,
so exam v3 is about **a tenth** of the labelling already committed — and unlike `batch3` it decides
whether the one-shot read can be interpreted at all. ⏭ **It outranks `batch3` for a scarce evening.**

**The three rules it must not break.**

1. **Grow BEFORE the read, never after.** Choosing the instrument after seeing the number is the one
   option that is not available ([round3-criteria.md](round3-criteria.md) §4).
2. ⚠ **Re-score `round2-stage2-best` on the grown exam.** The signed floors in
   [round3-criteria.md](round3-criteria.md) §1 were measured on the 46-page / 326-strip exam; if the
   exam grows and the baseline column does not, the comparison stops being apples-to-apples. It is
   one CPU decode run, not a retrain — and it is the same rule this file already applied when the
   exam grew for Round 1 (Step 2 below, *"Re-take the baseline"*).
3. **The floors themselves are not re-opened.** Growing the exam changes the *precision* of the
   measurement, not the bar.

⚠ **Not part of this growth: chasing the low-n accidental classes.** `buyukFlat` has 0 real gold and
`buyukSharp` 3; those glyphs are rare in real print and more pages barely move them. They are
no-regression clauses in Round 3, not targets, and stay low-n with their n printed.

⏭ **A second, free growth may follow and needs no new page.** 282 candidate strips on the exam pages
are dropped, 78 of them purely for exceeding the 59-id decoder budget. That budget is
`generation_config.max_length = 60` inherited from the base weights — a setting, not an
architectural limit — so measuring what fits at 90 or 120 ids may return those strips to the exam
without labelling a single new page. Costed in [../BACKLOG.md](../BACKLOG.md).

## Step 2 — Set the exam aside (before any training on real data)

Freeze ~15–25 matched pieces in `data/real/rung3/testset.json` — **drawn from every source in
the round** (neyzen + notaarsivleri), because a one-style exam can't detect style overfit.
Rules: exclude pieces that are also among the 190 synthetic training pieces (dedupe by SymbTr
file — the exam must measure real-image generalization, not memorized melodies); spread over
makams / signatures / density. Matched pieces are the ideal exam: their labels are perfect.
After every round, `eval_omr.py` on these pages = the real-world accuracy number.

**Grow the exam by adjudication (decided 2026-07-13).** The provisional exam is statistically
thin: 33 auto-accepted strips, 4/8 AEU classes present, ALL LOW-N (~11 gold accidentals behind
the 83.3% headline) — too thin to tell whether Round 1 improved or regressed. The growth pool is the exam-review
queue (**now the 287-row `strips_exam_v2/emit_review.csv`** after the v2 re-freeze; the old
443-row `strips_exam` queue is superseded), and exam strips never enter training, so
adjudicating them is pure measurement quality. Rules:

- **Timing: AFTER the two-source freeze** (step 1b re-run may change the piece list — don't
  polish strips that may drop out), and **BEFORE Round 1's exam-taking**.
- **Priority: accidental-bearing rows first** — they add exactly the gold the headline
  per-class metric lacks. Stop when per-class gold N is respectable (target ~20+ per
  reachable class), not when all 443 are cleared.
- **Re-take the baseline** (`rung22-stemfix-best`) on the grown exam before Round 1, so the
  Round-1 comparison is apples-to-apples — the 83.3% number is only valid on the 33-strip exam.

## Step 3 — Strip-label emitter (NEXT BUILD ITEM, source-agnostic)

A training sample is (real strip PNG → tokens). Strip images come from the slicer
(`page_to_strips.py`); tokens come from SymbTr — copied for exactly the measures inside each
strip. Not `docToStrips` (its token-budget windows differ from the slicer's width-based crops).
Per page:

1. Slice + decode (`decode_page.py`) → strips, measure boxes, decoded tokens.
2. Align SymbTr measures to page measures. The wrinkle is repeats: the page draws a repeat sign
   once, SymbTr writes the passage twice. The decode reads repeat/volta/nav tokens reliably
   (Rung 2: 100%/≥96%), and `detectRepeats` (`tools/render/repeats.ts`) already finds SymbTr's
   duplicate runs — fold them together. Where counts still disagree, token-level Levenshtein on
   `labels.json` `full.keysig` recovers the offset (the id-space alignment `eval_omr.py`
   implements).
3. Emit each strip's label from the SymbTr measures it covers: keysig-mode bodies joined with
   `|`, `\sig` prefix on row-start strips, repeat/volta/nav tokens where the page draws them.
4. **Drop any strip whose alignment is uncertain** — a wrong label is worse than no label.
   The emitter also enforces the decoder budget automatically (real-tokenizer ≤59-id check,
   over-budget strips dropped as untrainable — same rule as the synthetic export); token
   counting is never a human job. Gate before training: round-trip every emitted label
   through `decode.ts` + eyeball ~20 renders per source.
5. **Piece-level human screen (user decision 2026-07-11):** before a matched piece's strips
   enter training, a quick by-hand pass over its pages rejects wrong matches, handwritten /
   hand-lettered pages, incomplete or multi-piece PDFs, and layouts the slicer will mangle
   (stacked verse lines, ossia staves). Rejected-for-handwriting pages are PARKED in
   `data/real/rung3/handwritten/` (with their SymbTr match) — out of scope for v1, but the
   free seed dataset if a later version takes on handwriting. A dedicated review interface
   (strip image vs. re-engraved label, one-keystroke accept/flag) is planned to speed this
   and the Step-5 loop up.

This trusts the model almost nowhere: strip→measure mapping is geometry (barline detection),
content is SymbTr. Expected yield: ~1,500–2,000 strips from neyzen's 85 alone; notaarsivleri
multiplies that.
