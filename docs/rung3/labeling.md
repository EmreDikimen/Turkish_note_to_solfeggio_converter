# Labeling — free labels from SymbTr matches (Step 1)

purpose: how real pages get ground-truth labels without hand transcription
audience: agents and the owner working the real-page track
updated: 2026-07-30

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

## The `realval-hard` queue (2026-07-28) — labelling the practice test's missing hard tier

**Why it exists.** Real-val reads ~96% where the exam reads 74%, and the cause is measured:
composition. The exam is 18% easy / 41% mid / **41% hard**; real-val is 59 / 41 / **0**. A practice
test with no hard questions cannot rank candidates, which is why every round so far has been a blind
one-shot. Rebuilding it is item 1 in [../STATUS.md](../STATUS.md).

**Why it cannot be done by filtering.** "Hard" means the emitter refused the strip for
`row_unaligned` or `nd_high` — those are **drops, not reviews**, so no label was ever written
(6,168 in the nota pool alone, 13,975 across all pools). The exam has 145 hard strips only because
they were recovered and hand-labelled one at a time. There is no pile to draw from.

**The queue.** `scripts/rung3/build_realval_v2.py --queue N` selects candidates that are on the
val side (`data.is_real_val_piece`, the same rule `train.py` uses) and never exam pieces, mirrors
the exam's own 107:38 `row_unaligned`:`nd_high` balance, caps 3 strips per piece so the tier is not
five bad scans repeated, and seeds each row with the **current** model's decode.

**The live queue is `realval-hard-v2`** (2026-07-29): 165 staged, 110 needed, built on the
2026-07-29 re-slice. The surplus absorbs unusable crops — the first round lost **43 of 130 (33%)**
that way. `realval-hard` (v1) is kept as the record of that round's verdicts (65 ok / 22 fix /
43 bad); **do not label there.** None of those verdicts transfer, because no crop survives a
re-slice unchanged.

**Rows are ordered WORST-FIRST** — least confident at the top (reversed 2026-07-29; it was
most-confident-first). The calibration is what decides this: on the exam's hard tier the same
model's decode is exactly right **80%** of the time at `min_logprob > -0.1`, and only **4%** below
−1.0 ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)). So the confident head is mostly the
reviewer confirming what is already right, while nearly every real correction sits in the tail.
Worst-first spends the human where the errors are.

**Stopping early is allowed — but on a measurement, not a feeling.** Work down from the top. As
rows get more confident the corrections dry up, and at some point reading on stops earning its
keep. Before accepting a remaining tail:

1. Draw **~20 rows at random** from what is left — random, not the next 20, or you have only
   measured the easiest slice of the remainder.
2. Read them properly, against the picture.
3. **Judge the shape of the errors, not just the count.** A few scattered misses are survivable:
   they add noise that handicaps every candidate model about equally. Errors that are all the
   *same kind* — say every one a koma/küçük confusion — are not, because they systematically
   punish precisely the model that fixes that weakness. Any clustering means keep reading, however
   good the count looks.
4. If the sample is clean and the misses are scattered, accept the rest and write those rows with
   **`by=tail-accept`** so they stay distinguishable forever. A later human verdict clears the
   marker automatically (`review_ui.save_verdict`).

Record the sample size and what it found. If real-val ever reads oddly, that note is how you check
whether the tail is the reason.

- ⚠ **An accepted row you did not read becomes gold.** If it is wrong, a Round-3 model that FIXES
  that error gets scored as a regression for fixing it. That is the only way this queue can do
  real harm — which is why the stop is gated on a sample rather than on the ordering alone.
- Seeding from the decode is deliberate and is only safe **because a person checks it against the
  picture**. `ok` must mean "I looked and it was right", never "the model sounded sure". Same
  contract as `photo-gold`.
- ⚠ **Queues are versioned per re-slice, and images resolve per queue.** Strip *filenames* are
  stable across a re-slice but the pixels are not: 59 of the v2 candidates reuse a v1 filename, and
  129 of the 165 also exist under the old `data/real/strips/`. `QUEUE_IMG_ROOTS` in `review_ui.py`
  binds each queue to the crops it was built from — without it the whole v2 queue would have
  rendered last week's pictures against this week's rows.

**`f'' 32` is NOT an error — do not "fix" it.** The model emits the 32nd-note duration with a space
before it. Measured: `f''32` and `f'' 32` produce **identical token ids** (`[19, 1, 37, 95, 35]`),
because the tokenizer splits the octave marks from `32` either way — the glued form even *decodes
back* with the space. `eval_omr.py` scores in id space, so the two are the same thing.
⚠ **This holds for `32` only.** `f''16` vs `f'' 16` and `f''8` vs `f'' 8` DO differ in id space, so a
space before those would be a real disagreement. Every spaced occurrence in this queue is a `32`
(20 of them, all verified lossless). The written convention elsewhere is glued — 0 spaced labels
across the exam, nota and real-val pools — so `build_realval_v2.py --build` normalises them; the
reviewer does not need to.
- ⚠ **An unverdicted row must never enter the metric pool** — that would reintroduce exactly the
  flattery the rebuild exists to remove.

Run: `.venv-ml/bin/python scripts/rung3/review_ui.py` → queue **`realval-hard-v2`**. Images resolve
from `data/real/strips_v2/<page>/<strip>`. Progress and the target mix:
`build_realval_v2.py --report`.

## Step 1 — Free labels from SymbTr matches

### 1a. neyzen ✅ DONE (2026-07-11)

`scripts/rung3/match_symbtr.py` matches the 798 downloaded pdfs against the 2,186 SymbTr pieces
by name. Makam must agree (spelling-alias table: nihavend↔nihavent, suznak↔suzinak, family
fallbacks like hicaz_humayun→hicaz); songs match on the lyric-incipit title, instrumentals on
composer + form abbreviation (p/ss/longa/…). First run: **85 auto-accepts** (spot-checked
correct), 28 review-band rows, 665 rejects (genuinely not in SymbTr). Outputs, per piece, under
`data/real/rung3/matched/<makam>/<stem>/`:

```
match.json    the pairing (pdf/url/page PNGs ↔ SymbTr file, score)
score.json    SymbTr → note-model JSON — the ground truth (exact sounding komas kept)
labels.json   per-measure label tokens (tools/render/labels-cli.ts), every+keysig modes
              + the derived \sig … \sigend block
```

To promote a review-band row: check the pair, flip its `tier` to `accept` in
`data/real/rung3/matches_review.csv`, rerun with `--apply-csv`.

**Written vs. sounding pitch is already correct (user-raised, verified 2026-07-11).** SymbTr
stores the SOUNDING pitch (uşşak si = 2-comma flat) but the page PRINTS the conventional sign
(1-comma koma flat). The label serializer converts through `toAeuAlter` — the same call the
synthetic renderer uses — so labels carry the WRITTEN sign; verified on a matched uşşak piece
(`\sig \komaFlat b \sigend`). The exact koma stays in `score.json` for playback.

### 1a.5 — Round-0.5 labeler fine-tune (decided 2026-07-13; **DONE 2026-07-15 — see
MODEL_EVAL.md "Round-0.5"**: real-val SER 0.086→0.021, AEU 70→91.7%, sig reads 100%;
`data/checkpoints/rung3-labeler` + `-onnx` int8, parity 8/8; the 1b emit runs on it via
`--checkpoint data/checkpoints/rung3-labeler --onnx-dir data/checkpoints/rung3-labeler-onnx
--redecode`)

Why (new evidence since the 2026-07-11 "one big run" decision): the synthetic-only checkpoint
made the neyzen emit expensive — a **348-row review queue**, **22.6% of auto-accepts needing
fixes**, and the hicaz **unanimous-but-wrong signature vote** (silent label poisoning). The
model's weakness costs three distinct things in the emitter, and all three shrink if the
emitter decodes with a model that has seen real pages:

1. **Row alignment** (content search) — weak model → rows fail to align → strips *dropped*
   (lost yield, never wrong labels; SymbTr stays the ground truth).
2. **The nd gate** — weak model → more disagreement with correct labels → review-queue labor.
3. **The signature majority vote** — weak model → unanimous misreads the vote can't see
   (the hicaz case). The dangerous one; a second engraving style makes it MORE likely.

Bonus: the adjudicated false-`\tie` fixes train slur robustness directly (synthetic never
drew slurs — the model's most systematic real-page error).

**Constraints (what keeps it cheap and honest):**

- **Throwaway labeler, never shipped** — used only by `decode_page.py` / the emitter. No
  browser gate, never copied to `apps/web/public/models/`.
- **Fine-tune FROM `rung22-stemfix-best`** (not base), **real strips only** (the promoted
  pool). Forgetting synthetic doesn't matter: the labeler only ever decodes real pages. This
  skips both the multi-pool loader and the synthetic re-render — those stay Round-1
  prerequisites, not Round-0.5 ones.
- **Exam pieces excluded from train AND val** — val is a piece-held-out slice of the real
  strips; selecting a checkpoint on the exam would leak it.
- Short run, small LR; export only what the emitter needs: ONNX int8
  (`src/vision/quantize_onnx.py`) + parity (`onnx_parity.py`).
- **Prerequisite: the promote script** (train only on corrected labels). Natural batch-mate:
  the `MEASURES_PER_STRIP=2` re-slice (~233 recoverable strips = more labeler training data).
- **Round 1 is unchanged**: ONE from-base run on synthetic + all matched real. The 2026-07-11
  decision applied to shipped training rounds; this checkpoint is tooling.

**Run kit — BUILT 2026-07-14, wiring smoke-tested locally (2 steps, mps):**
`data/real/rung3/strips_r1/split.json` (make_split.py: 40 train / 8 val pieces, 56/418
strips, AEU-coverage-aware), `scripts/rung3/make_labeler_zip.sh` (10 MB upload:
src/vision + strips_r1; start weights come from Drive `tnc/rung22-stemfix/best`, left there
by the 2.2b run), `notebooks/rung3_labeler_colab.ipynb` (baseline-eval cell → shakeout →
train `--lr 1e-5 --max-steps 1200 --warmup-steps 50`, T4 ~30–40 min → post-eval; after-notes
cover the ONNX-int8-only export + pointing emit_strip_labels.py at the labeler).
Re-run promote → make_split → make_labeler_zip after any new adjudication (the 3 typo fixes).

### 1b. notaarsivleri.com — SymbTr-first download (✅ FULL RUN DONE 2026-07-15)

> **Full run (2026-07-15), after the calibration probe below:** all **964** matched pieces
> downloaded (`nota_downloads.json`; 966 accepts minus 2 dead links), **1,227 pages
> GPU-decoded on Colab** (`scripts/rung3/decode_pages_gpu.py` + `make_decode_zip.sh` +
> `notebooks/rung3_decode_colab.ipynb` — the labeler decode offloaded per the fanless-Mac
> rule; page-cached, resumable, results rsynced back into `data/real/strips/`). Fold-search
> 2^n blow-up on many-repeat pieces fixed (`SPAN_SUBSET_CAP=12` + hill-climb fallback in
> `emit_strip_labels.py`). **Emit over 938 pieces: 440 ok / 338 low_coverage / 160
> missing_pages** → **1,262 accepted training strips + 2,671-row review queue**
> (`strips_nota/`; reasons: nd_review 989, low_coverage 959, sig_mismatch 231,
> acc_disagreement 216, nav 276) + a **69-strip audit sample** (`emit_audit.csv`). Drops
> confirm the probe's diagnosis at scale: row_unaligned 4,467 / split_wide 3,757 /
> over_budget 2,108 — the `MEASURES_PER_STRIP=2` re-slice stays the #1 yield lever.
> **Flagged sig clusters for per-makam adjudication (the hicaz lesson applied): mahur
> voted [F+1]×12 pieces + a missing-B-1 cluster** — adjudicate BEFORE promoting review rows.
> Exam side: see Step 2 (re-frozen v2 + 287-row growth queue, `strips_exam_v2/`).
>
> **Audit + first promote (2026-07-16):** the 69-strip sample fully adjudicated — 29 ok /
> 40 fix, decomposing to 8 sig-order no-ops + 1 sig + 26 tie/repeat structural + **5 pitch =
> 7.2% content-error rate** (neyzen round was 22.6%: the Round-0.5 labeler paid for itself).
> 180 review rows verdicted (incl. the 105-row sig_mismatch cluster work);
> `promote_labels.py` applied: **manifest 1,262 → 1,435** (47 audit fixes + 173 promotions;
> 6 rejects: 4 over_budget for the re-slice, 2 typos pending). Sharpness analysis
> (Laplacian-var medians): accepted 1672 vs remaining low_coverage/sig_mismatch ~900 — the
> queue IS the blurry tail by design; **acc_disagreement rows are the exception (1703,
> sharp + accidental-bearing = best remaining value)**. Label-noise budget accepted for
> Round 1: ~7% pitch / ~38% tie-repeat structural; re-audit a fresh 5% sample after Round 1.
> Remaining queue plan: acc_disagreement (~208) + sig_mismatch (~124) get fixed, the
> blurry/misassembled rest (low_coverage, nav, bulk nd_review) is deliberately parked —
> unverdicted rows never train.
>
> **Update 2026-07-17:** sig_mismatch + acc_disagreement DONE (see "Logged for later" for
> the decode-beats-SymbTr finding) → second promote: **training manifest 1,742** (+ 418
> neyzen = 2,160 real strips). examv2-review DONE → **exam manifest 63 → 312 strips**
> (`promote_labels.py --exam`; 26 over-budget exam labels correctly excluded as unwinnable;
> ⚠ \tup3 gold in the exam = 4 → triplet progress must be read off synthetic val + manual
> checks until a re-sliced exam version). Pending promote rejects: 3 label typos
> (ben_seni_sevdim p1_s03_w01, gonlum_heves p1_s04_w00, yikildi p1_s01_w00) + 14 training
> over-budget. **examv2-full DONE (later 2026-07-17, the LAST exam hand task): all 63 rows
> verdicted — 31 ok / 32 fix / 0 bad.** Fix decomposition: 22 tie-only (the known
> SymbTr-vs-edition structural conventions), 4 volta/repeat, **4 pitch/duration-level =
> ~6% content-error rate** (consistent with the nota audit's 7.2%), 1 sig-block removal
> (w00 crop-cut), 1 accidental-class sig fix (zahiri p1_s04_w00 \komaSharp f →
> \kucukSharp f). **The mahur (18 rows) and suzidilara (16 rows) sig-suspects produced
> ZERO signature corrections — the voted sigs are confirmed; the flagged clusters are
> cleared.** Fixes APPLIED via `promote_labels.py --exam`: 31 of 32 in place; the 32nd
> (neydin_guzelim p1_s03_w00, correction = 60 ids) went over budget → row REMOVED as
> unwinnable (promote_labels now removes gate-failed audit fixes, as its docstring always
> promised — previously only round-trip failures were removed). **Exam manifest 312 → 311
> strips**; gold (sig-inclusive): bakiyeSharp 117, bakiyeFlat 59, kucukFlat 53, natural 48,
> komaFlat 38, kucukSharp 29, komaSharp 18, tie 127, \tup3 still 4. FREEZE COMMITTED
> (37ee690). **nota-full rule drafts (same day):** after the user hand-verdicted 125
> nota-full rows (79 fix / 46 ok), `scripts/rung3/rule_fix_notafull.py` learned the
> adjudication pattern (human sides with the DECODE on ties / duration respells /
> repeat marks; with the LABEL or a third reading on pitch, sig, tuplet, grace) and
> DRAFT-verdicted the mechanical tail: **325 rows filled** (by=rule 174 at
> min_logprob ≥ −0.3 ≈ 84% exact-match vs held-out human fixes, by=rule-lowconf 151 —
> skim harder; human re-verdict clears the marker). Never auto-adopted: sig / tuplet /
> grace / pitch disputes (244 abstained rows need eyes; decode hallucinates unclosed
> `\tup3`, and tie-vs-slur is image judgment — spot-check found a printed second arc
> the decode missed on benyururum p1_s02_w01). Remaining queue: 812 pending = 568
> no-diff (skim/skip) + 244 abstained; user reviews the 325 drafts in the UI, then
> `promote_labels.py --dir strips_nota`. **tup3 image pass (same day, user-requested):**
> all 53 tup3-bearing rows adjudicated against the PNGs — every label-side `\tup3` is a
> real printed "3" (13 rows, none lost), every decode-proposed NEW `\tup3` was a
> hallucination (0/39 real, near-always triggered by a printed slur arc → add
> "reject/flag unclosed or arc-adjacent `\tup3` inserts" to the decode-repair list).
> 22 ok + 6 fix written `by=claude` (incl. gelse_o_suh s02_w00 rast sig → `\komaFlat b
> \bakiyeSharp f`, the user's own s03_w00 precedent); 10 tie-disputed rows deliberately
> left pending — printed-arc-vs-\tie is user judgment (the user writes `\tie` across
> different-pitch arcs sometimes and not others; no textual rule works).
> **tup3 image pass, part 2 — nota-REVIEW queue (same day, user-requested, label-side rows
> only):** all 38 label-tup3 review rows adjudicated against PNGs → **9 ok + 11 fix
> (`by=claude`) = 20 new promotable rows carrying ~34 real `\tup3` tokens** (vs 14 rows in
> the whole accepted manifest — this more than doubles real triplet training data once
> promoted); 9 bad (5 misaligned/shifted windows incl. a coda-region crop, 2 edition-prints-
> quarters-not-triplets, 2 label content cut off at window edge — re-slice fodder); 9 left
> pending on tie-calls/edge-checks. New findings: the "d"-shaped curl glyph = komaFlat
> (reversed flat) — SymbTr wrote `\natural` where the page prints komaFlat on 3
> ay_dalgalanirken rows (decode read it right, the acc-lesson again); one row's printed
> THREE `a'4` vs SymbTr's two (10/8 usul sums confirm the page).

Calibration probe (2026-07-15, superseded by the full run above):

> **Status:** `scripts/rung3/collect_nota.py` (census / match / download / export, all
> resumable). Census: **20,833 TSM pieces** off the paginated catalog (211 requests, title/
> makam/composer/lyricist/form/usul per row; ISO-8859-9; robots.txt absent — 302 to an error
> page, checked again today). Metadata match vs SymbTr: **966 accept** / 1,939 review /
> 656 no_symbtr_makam / 16k reject (same 0.85+margin thresholds; hicaz 96, nihavend 92,
> rast 74 — 63 makams). 12-piece probe through the LABELER emit (`strips_nota_probe`,
> report-only): **7/12 ok** (coverage 0.36–0.70, sig majority OK on all 7 — the labeler
> reads the second engraving style's sigs), 5/12 self-excluded (2 handwritten →
> missing_pages, faded scan + old heavy print → low_coverage ≤0.2) — **the archive mixes
> modern volunteer re-engravings (slice perfectly), old TRT prints (noisy barlines), faded
> scans (slicer misses staves — yield loss only), and HANDWRITTEN copies (out of scope;
> content alignment rejects them, never poisons labels)**. No slicer surgery needed — the
> timebox held. Dominant strip drops: over_budget 48 + split_wide 42 of 216 (nota rows are
> DENSER than neyzen → 3-measure strips blow the 59-id budget): the MEASURES_PER_STRIP=2
> re-slice is the yield lever here. Extrapolation: ~2–3 accepted strips/piece → ~2k+ strips
> from 966 pieces before the re-slice.

Original research (2026-07-11), kept for context:

Researched 2026-07-11: ~21,000 TSM pieces, sheets from the **TRT repertoire — the same
repertoire SymbTr transcribes**, so the overlap should be large; catalogued with
title/makam/composer/form/usul columns, so matching runs on REAL metadata instead of filename
fuzzing (near-certain accepts). Separate THM section = easy folk exclusion (folk notation uses
numbered bemol-2/3 signs the model has no tokens for — never collect THM/Çoksesli).

**Invert the neyzen order: census the catalog → match against SymbTr → download ONLY the
matched pieces.** Every downloaded page then arrives pre-labeled, in a second engraving style.
Extend `collect_notalar.py` (`--nota` is the wired starting point) + `match_symbtr.py`
(catalog-metadata mode). Gate before it enters training: the slicer was tuned on neyzen's clean
vector PDFs — run `page_to_strips.py --debug` on ~10 sample pages first (TRT scans are older:
skew, bleed, hand-lettered titles) and fix what breaks. **Timebox: if this source needs major
slicer work, Round 1 ships neyzen-only rather than stalling.**

Other sources (later rounds, same SymbTr-first recipe): **nota.trt.net.tr** (official TRT
archive, ~9,500 items, explicit `musicType=Türk Sanat Müziği` filter, keyword-searchable per
SymbTr title), **sahaney.com/en/notalar/** (makam/form/composer-filterable PDFs, a third
engraver), then small ney-community mirrors (devletkorosu.com, erdincbal.com, neyzenim.com).
None publishes a restrictive robots.txt (checked 2026-07-11); crawl politely (rate-limited,
resumable, census-first) like `collect_notalar.py`; everything stays under gitignored
`data/real/` (training data, never redistributed).

### 1c. Targeted TUPLET collection (2026-07-17 — the tuplet-training-gap response)

The exam froze with 4 `\tup3` gold and the manifest holds ~14 tup3 rows; the user called for
collecting tuplet repertoire directly. Two new scripts:

- **`scripts/rung3/find_tuplet_pieces.py`** — scans all 2,200 SymbTr txts for tuplet events
  (same rule as `tools/render/rhythm.ts`: sounding event whose reduced Pay/Payda denominator
  is divisible by 3) and crosses them with both sources' match state →
  `data/real/rung3/tuplet_pieces.csv`. **459 tuplet-bearing pieces; 267 already collected**
  (the 28% figure), 36 nota review-tier candidates uncollected, and — the big find — the
  neyzen census still held ~7.6k never-downloaded PDFs (the 798-pdf round was makam-weighted,
  not exhaustive).
- **`scripts/rung3/collect_tuplets.py`** (match / download / export) — promotes the 36 nota
  review rows to accept in `nota_matches.csv` (wrong matches cost yield only — emit content
  alignment rejects them, never poisons labels), and name-scores the undownloaded neyzen
  census against the FULL SymbTr makam pools, keeping rows whose best match is
  tuplet-bearing (`tuplet_neyzen_matches.csv`: 252 accepts ≥0.85+margin, 96 review).
  **Downloaded 2026-07-17: +39 nota + 257 neyzen = 293 new matched pieces (437 pages)**,
  exported under `matched/` (60 brand-new SymbTr pieces / 860 tuplet groups; 164 pieces
  now covered in a SECOND engraving style / 1,779 groups; 36 nota candidates / 452 groups).

**The budget analysis that changed the plan (measured with the real tokenizer over all
matched tuplet pieces):** 39.4% of tup3-bearing SINGLE measures exceed the 59-id budget
alone (worst: 269 ids); 80.5% of 2-measure and 92.9% of 3-measure tup3 windows are over
budget. So the planned `MEASURES_PER_STRIP=2` re-slice can NOT recover triplets — dense
tuplet runs need 1-measure windows at most, and often less. Consequences:

1. **`OMR_MEASURES_PER_STRIP` env knob** added to `page_to_strips.py` (default 3,
   unchanged); the decode JSON now records `measures_per_strip` and the emitter's cache
   check keys on it (old caches without the field read as 3).
2. **Tuplet emit runs at `OMR_MEASURES_PER_STRIP=1`** into `strips_tup/` (labeler
   checkpoint, `--pieces` = the 293 new stems only — strips_nota/exam untouched, no
   un-promoted verdicts disturbed). k=1 makes 2,325 tup3 measures (3,384 `\tup3` groups,
   1,317 measures in the new pieces) budget-eligible. **Decode OFFLOADED TO COLAB**
   (user request, fanless-Mac rule): 35/437 pages decoded locally, the remaining 402 in
   `data/colab/decode_pages_tup.txt` → `make_decode_zip.sh` (now takes an optional pages
   file) rebuilt the 225 MB zip; `decode_pages_gpu.py` gained `--measures-per-strip`
   (recorded in the JSONs; `--skip-existing` checks it) and the notebook cells carry the
   flag. After the strips zip returns, re-run the same emit command — it reuses the
   caches and finishes locally in minutes.
   **EMIT DONE (2026-07-18, off 383 Colab k=1 caches):** 184/293 pieces ok, 1,310
   accepted strips. Per the user's call, `strips_tup/` was then TRIMMED TO TUP3 ONLY
   (non-tuplet volume is already sufficient; `.bak-full` backups beside each file):
   **manifest = 78 tup3 strips / 114 `\tup3` groups** (pre-existing manifest total was
   14 rows), **review queue = 147 tup3 rows / 205 groups** (nd_review 69, low_coverage
   43, acc_disagreement 16, nav 16, sig_mismatch 3), audit sample 6. **Member-count
   gate checked: all 114 accepted groups are properly closed `\tup3 …3 notes… \tupend`**
   (0 two-member or unclosed groups; rule: a group with ≠3 note members never
   auto-accepts — re-check on any future tuplet emit). Remaining levers in yield order:
   row_unaligned 5,540 (k=1 strips are short → content search weaker; a k=2-with-budget-
   fallback hybrid could recover), split_wide 1,546 + over_budget 906 (the dense tail =
   the sub-measure fragment follow-up above). Promote path: adjudicate
   `strips_tup/emit_review.csv` (+6-row audit), then `promote_labels.py --dir strips_tup`.
   Review UI: `tup-full` (78) / `tup-review` (147) / `tup-audit` (6) tabs wired 2026-07-18.
   UI same day: decode-draft `\tup3` strip is a checkbox (default OFF in tup-* queues, ON
   elsewhere); lint shows real id cost (char-level tokenizer: note ≈ 1 id/char, `d''16`=5,
   `\cmd`/`|`=1, +EOS) and warns OVER BUDGET >59 — over-budget corrections are unwinnable,
   verdict `bad`.

**Is this enough tuplet data? (assessed 2026-07-18)**

- **Training: YES for Round 1** — completing the queues yields ~78 accepted + ~90–110
  promotable review rows ≈ **~180 real tup3 strips / ~280 groups over 120 pieces, two
  engraving styles**, incl. 28 accepted strips with ≥2 groups (the contiguous-run shape).
  Combine with loader oversampling of these strips + the planned aggressive synthetic
  tup3 oversampling. (Reference point: Round-0.5's 33% tup3 recall came from ~14 rows.)
- **Exam: NOT automatically** — the frozen 311-strip exam still holds 4 tup3 gold, and
  promoting ALL strips_tup pieces into training would leave nothing to measure with
  (exam pieces never train). **Solution — tup3 exam extension via holdout:** hold ~10–12
  tuplet-rich pieces OUT of the promote, spread over sources/makams (candidates from the
  piece ranking: cok_yasa_ayse_ney, bu_son_sarkimda [mahur], Kurdilihicazkar_sirto,
  huzun_zaman_zaman + _ney, canan_okuyor [acemasiran], dil_seni_sevmeyeni_ney,
  ay_dalgalanirken, ben_guzele [mahur], gittin_biraktin_ney, dalinda_solarken [ussak],
  sana_dun_bir_tepeden_ney). Their adjudicated strips (~30–50 tup3 gold ≥ the ~20/class
  target) join the exam manifest instead of training (`promote_labels.py --exam` path,
  extend testset.json piece list = a v2.1 freeze), and the adjudication is the same
  review work — it does double duty as measurement. **Re-take the baseline including
  the extension BEFORE Round 1** so tup3 progress is apples-to-apples.
- **Blind spot that stays open:** the k=1 pool is biased toward measures sparse enough
  for the 59-id budget; dense contiguous-triplet instrumentals (the 90+-group
  sazsemaisi/longa pieces) still sit in the over_budget/split_wide drops — training AND
  exam under-represent that hardest case until the sub-measure fragment follow-up lands.
  Round-1 tup3 numbers speak for the common case only; say so in MODEL_EVAL.md when
  reporting.
3. **Sub-measure fragments = the designed follow-up** for the other 1,512 dense measures
   (3,102 groups; 88% would fit as TWO fragments ≤112 ids): the slicer's `_split_wide`
   gutter-cutting already produces clean fragment images — what's missing is fragment
   LABELS. Design: labels-cli learns atom-level ranges (the `docToStrips` atom machinery
   already exists TS-side), the emitter proposes the atom split by aligning each
   fragment's decode against the measure's atom sequence, and the nd gate + review queue
   dispose — the model proposes, never decides. Until then dense-measure fragments stay
   dropped (`split_wide`).
