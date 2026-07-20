# Rung 3 — teaching the model real pages (plan + status)

> The model is 99.9% on synthetic strips but has never trained on a real page. This rung fixes
> that **without weeks of hand labeling**. Collection round 1 is DONE (798 neyzen PDFs → 1,259
> page PNGs — `docs/PIPELINE.md` §3); this doc is the labeling + retraining plan, agreed
> 2026-07-11. Canonical status stays in `ROADMAP.md` §7.

## The plan in one paragraph

Pieces that also exist in SymbTr need no hand labeling — SymbTr already is the correct answer.
The neyzen corpus gave 85 such matches; **notaarsivleri.com (TRT-repertoire sheets, ~21k TSM
pieces with real catalog metadata) should give far more, in a second engraving style** — so we
collect its SymbTr matches too and do ONE big Round-1 fine-tune on both styles at once
(user decision 2026-07-11: don't split what can be one training run). **Amended 2026-07-13:**
a throwaway **Round-0.5 labeler fine-tune** is inserted before the notaarsivleri emit (§1a.5) —
the 348-row review queue + 22.6% audit fix rate showed how much labor a synthetic-only emitter
model costs; Round 1 itself stays ONE shipped run from base weights. Before training, ~15–25
matched pieces (from BOTH sources) are frozen as a never-trained-on **exam set** for honest
real-world accuracy. Only after Round 1 does hand work start: correcting the model's output on
the unmatched pieces — by then the model has seen real engraving and correcting is "glance and
confirm", not "repair everything".

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

## Step 4 — Round 1: fine-tune on everything matched + the first honest number

Colab, the proven Rung-2 kit: synthetic re-render + ALL matched real strips (both sources;
per-source + real oversampling are loader knobs — **never** "delete neyzen files"). Multi-pool
loader DONE (`train.py --real-dir DIR[:REPEAT]`, stable piece-hash real-val split consistent
across pools, `--oversample-tup`, real strips train un-augmented). **Split by piece across ALL
pools** (a piece's real and synthetic strips stay in one split; dedupe matched↔synthetic by
SymbTr file). Baseline v2.1 taken 2026-07-20 (64.1% AEU / SER 0.147; `MODEL_EVAL.md`) — the
number Round 1 must beat. Refinements decided 2026-07-20 (each fixes a plan weak point):

1. **Init = an EXPERIMENT, not a decree (the highest-leverage choice).** The pre-registered
   text said "from base, single-stage joint." But Round-0.5 (real-only fine-tune from a
   synthetic-trained checkpoint) moved real-val AEU **70 → 91.7%** — evidence that a dedicated
   real-specialization phase is worth a lot, which single-stage joint (fixed ~10:1
   synthetic:real throughout) dilutes. So run BOTH on Colab and pick on real-val:
   - **(A) two-stage from BASE** — Stage 1: carry-mode synthetic from base → carry-native
     synthetic checkpoint; Stage 2: real-inclusive fine-tune from Stage 1, fresh low-LR
     warmup, early-stopped on real-val. This is the Round-0.5 recipe with 5.6× the real data.
   - **(B) single-stage joint from BASE** — the control.
   - Init from `rung22-stemfix` is REJECTED: it was trained on NON-carry labels, so it starts
     with a format mismatch Round 1 would have to unlearn. Two-stage Stage 1 gives a
     carry-native synthetic checkpoint from base and sidesteps this cleanly.
2. **Checkpoint selection = free-running real-val AEU, NOT teacher-forced loss.** The tup3
   hallucination and accidental over-prediction are generation-time pathologies cross-entropy
   loss barely sees. Run `eval_omr.py` on the real-val pool at the eval checkpoints; select the
   best on real-val AEU (+ precision, see below). The loader's val-mix loss is a coarse guard
   only.
3. **Watch PRECISION, not just the recall headline.** The headline ("mean per-class AEU
   accuracy") is mean per-class RECALL — precision is excluded, so a hallucinating model scores
   well while degrading the product (a spurious koma is a real pitch error). Baseline already
   shows it: komaSharp precision **21%**, komaFlat **54%**. Report mean **F1** alongside;
   ship criteria carry precision floors.
4. **`--oversample-tup` is a precision risk, keep it MODEST.** The baseline tup3 problem is
   precision (15%, recall 93%): the model fires `\tup3` on ordinary beamed/tie'd groups. Raising
   the tup3-positive prior can worsen precision — the real fix is realistic synthetic triplet
   rendering (arc + "3", stem-fix already improved this) + the abundant non-triplet negatives we
   already have. Validate tup3 on real-val **precision**, not recall.
5. **nota is the ceiling.** nota = 79% of the real pool, harder domain (baseline 60% vs neyzen
   72%), AND ~7% pitch / ~38% structural label noise. Don't over-oversample the noisy pool;
   re-audit a fresh 5% nota sample after Round 1 (planned).
6. **Ordering (locked 2026-07-20, after an external plan review): re-slice STARTS FIRST, re-render
   runs in parallel.** The two were "large and independent, pick either" — but they are not
   symmetric: the re-slice ends in a human adjudication queue (the slowest resource in the whole
   project), while the re-render is machine-bound. Open the human tail as early as possible;
   the re-render, Colab kit, and photo-exam shoot all proceed alongside it.
7. **Re-slice scope = ADDITIVE ONLY.** New windows only where old ones were dropped
   (split_wide / over_budget rows; k=1 windows for tuplet pieces). Promoted strips are NEVER
   re-emitted — verdicts do not carry to shifted windows, so a wholesale re-emit would re-buy
   weeks of adjudication — and the **exam is NEVER touched**: the "27 exam over-budget
   recoveries" listed earlier are **DEFERRED to a post-Round-1 exam v3** (adding strips to the
   frozen exam after the baseline was taken would break the Step-4.0 pre-registration).
8. **A/B selection = ONE pre-registered number** (see the decision rule below): free-running
   real-val **mean AEU F1**, on the hand-verified subset of val strips where available;
   tie-break = the arc-triggered false-`\tup3` rate. "AEU and precision" was too vague to be
   binding — the likely outcome is A wins recall / B wins precision, and the formula must
   exist before that result is seen.
9. **Arc-metric code lands NOW, not at exam time** — see Step 4.0; the baseline cell is filled
   by re-running the spent rung22-stemfix exam read (zero leakage). Never debug measurement
   code on one-shot exam day.
10. **Training window mix stays MIXED.** Old k≈3 promoted strips + new k=2/k=1 recoveries +
    synthetic 2–4-measure strips. Do NOT re-cut old strips to k=2: the exam and the deployed
    slicer produce k≈3 windows, so k≈3 must stay in-distribution. (Reporting note: the exam's
    crops carry OLD-slicer defects — stem-cut barlines, bisected noteheads — that the hardened
    slicer no longer produces, so the exam slightly over-measures robustness to retired
    defects; say so in `MODEL_EVAL.md`.)

**Exam discipline (hard rule): exam = baseline + FINAL only; ALL iteration on real-val.** The
baseline read is spent; every further look at exam errors leaks. Take the Step-2 exam ONCE on
the experiment winner, report per-class × per-source (style-overfit check) + F1 + the
blind-spot caveats (below), against the pre-registered criteria. `PHOTO_SHARE` likely stands
(clean rasterizations = screenshot-profile). Ship through the scripted chain (ONNX export →
int8 parity → browser gate) before it becomes the runtime in `apps/web/public/models/`.

### Step 4.0 — PRE-REGISTERED ship criteria ✅ WRITTEN 2026-07-20 (before Stage 1 saw anything)

**Status: these are the criteria, fixed before any Round-1 training ran.** Every floor below is
stated next to its measured baseline (`rung22-stemfix-best` on the frozen 352-strip exam v2.1,
`data/checkpoints/rung22-stemfix-best/eval.jsonl` last row) so the demanded delta is explicit
and auditable. Round 1's exam read is a ONE-SHOT (see "Exam discipline" above) — a pass bar
written after seeing the result is not a bar, it is a description.

**Threshold stance: ambitious but defensible.** The anchor is Round-0.5, which moved real-val
AEU **70 → 91.7%** as a real-only fine-tune on 418 strips; Round 1 has ~5.6× that real data plus
the (re-rendered) synthetic pool. A bar Round 1 clears automatically would not discriminate a
good run from a mediocre one.

#### The floors

| Criterion | Baseline | Round-1 floor |
|---|---|---|
| Mean per-class AEU **recall** — the headline | **64.1%** | **≥ 85%** |
| Mean per-class AEU **F1** — new, reported alongside | **57.0%** | **≥ 80%** |
| Per-class **recall**, each class with ≥20 real gold | 22.6–87.5% | **≥ 75% each** |
| Per-class **precision**, same classes | 53.8–92.3% | **≥ 70% each** |
| `\tup3` **precision** | **15.1%** | **≥ 70%** |
| `\tup3` recall (may fall — precision is what we are buying) | 92.7% | **≥ 85%** |
| **Arc-triggered false `\tup3` rate** (defined below) | **77.6%** (66/85) | **≤ 10%** |
| SER | **0.147** | **≤ 0.06** |
| Exact-match | **17.3%** | **≥ 45%** |
| Per-source AEU gap (neyzen − nota) | **12.5 pp** | **≤ 12 pp** (must not widen) |
| Synthetic val mean AEU recall — no-regression clause | 99.9% | **≥ 99%** |

The five classes carrying the per-class floors (≥20 real gold on the exam) and what each must
move:

| Class | gold | recall | → floor | precision | → floor |
|---|---|---|---|---|---|
| `\bakiyeSharp` | 141 | 76.6% | ≥75% (holds) | 90.8% | ≥70% (holds) |
| `\kucukFlat` | 70 | 51.4% | **≥75% (+24pp)** | 92.3% | ≥70% (holds) |
| `\bakiyeFlat` | 66 | 60.6% | **≥75% (+14pp)** | 83.3% | ≥70% (holds) |
| `\komaFlat` | 48 | 87.5% | ≥75% (holds) | 53.8% | **≥70% (+16pp)** |
| `\kucukSharp` | 31 | 22.6% | **≥75% (+52pp)** | 77.8% | ≥70% (holds) |

`\kucukSharp` recall is the single hardest ask and the reason the re-render boosts komaSharp/
kucukSharp. Note the shape of the baseline: the flats miss notes they should catch (recall), the
komas invent notes that are not there (precision). Both are failures; only one is in the headline.

**Why mean F1 and not just the headline.** The headline is mean per-class **recall** — precision
is excluded, so a hallucinating model scores well while making the product worse (a spurious koma
is a real pitch error the user must hunt down). Baseline precision: `\komaSharp` **21.1%**,
`\komaFlat` **53.8%**. Mean F1 (57.0%) is the honest single number and must be reported next to
the headline every time. The F1 floor is set at 80%, slightly under the 85% recall floor, because
two LOW-N classes (`\komaSharp` 18 gold at 21% precision, `\buyukSharp` 3 gold) sit in the mean
and drag it; excluding them from the *mean* would be gaming, so the floor absorbs them instead.

#### Ties are NOT a ship criterion — the arc→`\tup3` confusion is (user decision, 2026-07-20)

A missed `\tie` is cheap: the note survives at the right pitch, the duration merge is visible in
the editor, and the **tie ground truth itself is unstable** (~38% tie/repeat structural label
noise in nota auto-accepts; hand adjudication applies `\tie` across different-pitch arcs
inconsistently — see the tup3 image-pass note in §1b: "printed-arc-vs-`\tie` is user judgment; no
textual rule works"). Gating a ship decision on that would measure the labels, not the model. So
`\tie` (baseline 66.2% recall / 61.1% precision) is **reported, never floored**.

The damaging failure is directional: **a printed slur/tie arc read as a triplet.** The tup3 image
pass is unambiguous — every decode-proposed new `\tup3` was a hallucination (**0/39 real**),
near-always triggered by a printed slur arc — and those insertions dominate the baseline SER
(I=919). That error silently rewrites the rhythm of a whole group (3 notes become ×2/3 of their
written value); unlike a dropped tie, nothing on screen looks wrong.

**Arc-triggered false `\tup3` rate** = of exam strips whose gold label contains `\tie` but **no**
`\tup3`, the fraction whose decode emits any `\tup3`. On exam v2.1 that denominator is **85
strips** (88 have `\tie`, 3 of those also have `\tup3`). **Floor: ≤ 10%.** Report it beside the
same rate over the **229 strips with neither** `\tie` nor `\tup3` — the split separates "learned
what a triplet looks like" from "stopped firing on arcs specifically."

**✅ SHIPPED 2026-07-20 (`eval_omr.py`, per item (0b) — code lands before any Round-1 training).**
The metric (per-strip presence of `\tie`/`\tup3` in gold vs `\tup3` in decode) + mean per-class
AEU **F1** now print on every eval and persist to `eval.jsonl` (`arc_tup3{}`, `headline_f1`, and a
per-class `f1`). **Baseline filled by re-running the spent rung22-stemfix exam read** (same frozen
model + frozen exam v2.1 = zero selection leakage): the measured denominators came out to **exactly
85 / 229**, confirming the hand-computed pre-registration, and mean F1 to **exactly 57.0%**.
**Arc-triggered false-`\tup3` baseline = 66/85 = 77.6%** (neither-token rate 82/229 = 35.8%) — the
model fires a spurious triplet on more than three-quarters of arc-bearing strips; the ≤10% floor is
what the re-render's slur distractors must buy. Measurement is now debugged, off the one-shot
exam-day path.

This is what the synthetic re-render's **slur distractors** are for: synthetic never drew slurs,
so the model has no negative examples for the arc shape. This metric is how we find out whether
that fix worked, and it is why `--oversample-tup` stays modest — more tup3 positives without arc
negatives makes precision *worse*. (The reporting addition lands in `eval_omr.py` **before any
Round-1 training** — not at exam time — and the baseline cell above is filled by re-running the
spent rung22-stemfix exam read: same frozen model, same frozen exam, zero selection leakage. The
metric is computable from the manifest labels + decodes with no new gold; building it now means
the measurement is debugged before the one-shot read it gates.)

#### Blind spots — the criteria must NOT be gamed on these

- **`\buyukFlat`: 0 real gold** on the exam. Synthetic-validated only (100%/100% at 34 gold,
  Rung 2.2). **No real-page claim may be made for it**, in either direction.
- **LOW-N classes: `\komaSharp` 18 gold, `\buyukSharp` 3 gold.** Below the ≥20 threshold, so they
  carry no per-class floor — they cannot honestly support a 75% bar. They stay **inside** the
  headline and F1 means (as at baseline, so the numbers stay comparable) and are always printed
  with the LOW-N marker. Never silently dropped to flatter the mean.
- **`\tup3` gold is common-case k=1 material.** Dense contiguous-triplet instrumentals
  (sazsemaisi/longa, 90+ groups) sit in the over_budget/split_wide drops and are **unmeasured**
  until the sub-measure fragment follow-up (§1c). Round-1 tup3 numbers speak for the common case
  only — say so in `MODEL_EVAL.md` when reporting.
- **The exam is an upper bound.** Matched, emit-alignable pages only (`caveat:
  matched-upper-bound` in the eval row): handwritten, faded, and slicer-defeating pages never
  entered it. Real-world accuracy is *below* whatever this exam says.
- **Training-pool label noise** (~7% pitch / ~38% tie-repeat structural in nota auto-accepts)
  bounds how much of a residual miss is the model's fault. The post-Round-1 fresh 5% nota
  re-audit runs **regardless of pass or fail**.
- **`\sigend` 73.5% recall / 65.9% precision** is partly the known empty-`\sig` label bug, which
  the re-render fixes; do not read Round-1 movement here as pure model improvement.

#### The decision rule (what makes this binding)

1. **Selection happens on real-val, never on the exam.** The A-vs-B init experiment is decided by
   free-running `eval_omr.py` real-val AEU **and precision** — not teacher-forced val loss, which
   cannot see generation pathologies like the tup3 hallucination.
   *Refined 2026-07-20, before any training ran: the selection statistic is ONE pre-registered
   number — **free-running real-val mean AEU F1**, computed on the hand-verified subset of val
   strips where available (so pool label noise doesn't pick the winner); tie-break = the
   arc-triggered false-`\tup3` rate. "AEU and precision" alone was too vague to be binding.*
2. **The exam is taken ONCE**, on that single winner.
3. **A miss is not re-rolled on the same exam.** If a criterion fails: diagnose on real-val, fix,
   and any further exam read is labelled in `MODEL_EVAL.md` as a **second look, with its leakage
   acknowledged**. Writing this down now, while it costs nothing, is the whole point of Step 4.0.
4. **Ship only on a clean pass** — through the scripted chain (ONNX export → int8 parity → browser
   gate) into `apps/web/public/models/`. A partial pass is written up as partial, never rounded up.

### Step 4.5 — Photo-exam axis (second, product-domain exam; zero labeling cost)

The v2.1 exam is clean PDF renders; the real product input is screenshots / **phone photos**.
The 25 exam-piece PDFs are staged + merged (`data/real/rung3/photo_exam_pdfs/`,
`00_ALL_25_MERGED.pdf`, 38 pp) to PRINT → PHOTOGRAPH → `data/real/photos_exam/` — reusing the
SAME frozen labels (same pieces), so it measures the actual deployment domain for free. Take it
once at the end alongside the PDF exam. Photo-shoot guidance in the "Photo-exam capture" note
below.

#### Photo-exam capture — how to shoot (the point is REALISM, not quality)

This exam only earns its keep if the photos look like what a real user snaps — the whole value
is the domain gap. So do NOT scan, do NOT flatten in software, do NOT shoot a perfect
overhead. Aim for the messy-but-legible middle of the real upload distribution.

- **Print first, then photograph.** A photo of a screen re-introduces moiré/backlight — a
  different (also real, but separate) domain. Print `00_ALL_25_MERGED.pdf` on plain white paper,
  one system-dense page at a time; laser or inkjet both fine.
- **Phone camera, handheld, auto everything.** The default camera app, HEIC/JPEG straight out —
  no "document scan" mode (that de-warps and binarizes, which is exactly the preprocessing we
  want to TEST, not pre-bake). Handheld, not a tripod.
- **Deliberately vary — one page ≠ one condition.** Across the 38 pages sweep: **angle** (flat
  down, plus ~15–30° oblique so staff lines converge), **lighting** (window daylight, warm indoor
  lamp, and one harsh overhead so a shadow/glare band crosses the staff), **distance** (whole page
  vs. tight on 2–3 systems), and let a couple go **slightly soft/motion-blurred** — real uploads
  are. A gentle page curl (don't press it flat) is a plus: staff curvature is a known weak link.
- **Keep it legible to a human.** The label is fixed; if YOU can't read the accidental in the
  photo, it's noise, not signal — reshoot that one. Blur/skew/shadow yes; illegible no.
- **Coverage is what matters, not count.** ~1 photo per page (≈38) is plenty; a few pages in two
  conditions is better than many identical shots. Spread the hard conditions across DIFFERENT
  pieces so no single makam/style is the only "hard" one.
- **Filenames must map to the piece.** Name each `<stem>_pNN_photo.jpg` (or keep a shot→page
  index) so the frozen labels line up — a photo we can't map to its label is unusable. Put them
  under `data/real/photos_exam/` (gitignored, like the rest of `data/real/`).
- Optional second axis if quick: a **screenshot** of a couple pages opened in a PDF viewer
  (the single most common REAL upload per `upload-distribution`) — but the printed-photo set is
  the priority tonight.

Then `page_to_strips.py` + `decode_page.py` run on these exactly like the PDF pages; the slicer's
behaviour on real perspective/curvature/shadow is itself a result worth logging (it's the
upstream weak link, and these photos are its first real stress test).

## Step 5 — Hand-correction loop for the unmatched pieces (AFTER Round 1)

Deliberately scheduled after the retrain: today's model would need most strips repaired; the
Round-1 model has seen two real engraving styles, so correcting becomes verification. Already
wired (Rung-4 stage 8): `decode_page.py` → `stitch-cli.ts` → harness → fix in editor →
**⬇ Save JSON** → `data/real/rung3/corrected/<makam>/<stem>/`. Disciplines:

- **Triage:** decode ALL pages (~7 s each), rank by suspicion — stitch warnings, decodes
  hitting the 60-id cap without EOS, row/measure-count inconsistencies, min token logprob.
  Hand-correct from the worst end (active learning).
- **Auto-accept the clean end:** zero-warning, clean-EOS, high-confidence pages go straight to
  training; hand-audit a ~5% sample to measure the label-noise rate before trusting it.
- **Verify, don't edit:** the review act is a visual compare (strip image vs. re-engraved
  decode). Watch for anchoring — plausible-but-wrong accidentals waved through; the audit
  sample measures this too.
- Retrain, re-decode, repeat; stop when the marginal correction rate flattens. (This loop is
  inherently iterative — the "one big run" decision only removed the unnecessary
  neyzen-only intermediate round.)

## Logged for later — decode-repair heuristics + the acc_disagreement lesson (2026-07-16)

**acc_disagreement adjudication result (all 216 rows done):** in label-vs-decode accidental
disputes, the user's fix sided with the DECODE 187/214 (87%) vs the label 14 (7%); the
median fix equals the decode verbatim. Meaning: these are rows where the printed edition
genuinely differs from SymbTr on accidentals (courtesy naturals, editorial signs,
intonation choices) — and the page wins. Two standing conclusions: (1) the emitter's rule
that accidental disputes NEVER auto-accept is validated — auto-accepting would have poisoned
187 strips in the headline class; keep the rule for every future source. (2) The Round-0.5
labeler's accidental reading is trustworthy enough to be the *draft* side in these disputes
— the review UI's decode-based edit draft is the right default for acc_disagreement rows.

**Decode-repair heuristics (user idea, worth building at Round-2 tooling time):** the
model's residual errors include GRAMMAR violations repairable without seeing the image —
orphaned `\tupend` (a `\tup3` opener dropped: "two `\tupend`s after six notes = contiguous
triplets, first opener lost"), dangling `\sigend` without `\sig`, unpaired volta/repeat
marks. Candidate implementations, in increasing depth: (a) a lint-with-autofix suggestion
in the review UI's editor (safest — human confirms); (b) a post-decode repair pass in
`decode_page.py` before nd scoring (recovers review-queue rows whose only defect is a
dropped opener); (c) longer-term, grammar-constrained decoding in the product (the decoder
never emits ill-formed bracket structures at all); (d) **adaptive window re-split on cap-hit**
(added 2026-07-20, Round-2 tooling): when a window's decode hits the 60-id cap without EOS,
split the window at a gutter/barline and re-decode each half — converts the §1c budget analysis
into product-side robustness for dense-triplet pages regardless of how training goes. Never
silently rewrite labels with these — they propose, a human (or the nd gate) disposes.

## Folder layout (under gitignored `data/real/`)

```
data/real/
  pdfs/<source>/<makam>/*.pdf     downloads (collect_notalar.py; source = neyzen, nota, …)
  images/<makam>/<stem>_pN.png    rasterized pages, 200 dpi
  strips/<page>/                  slicer + decode outputs (page_to_strips.py / decode_page.py)
  refs/                           ad-hoc reference uploads (incl. triplet_test.png)
  census.json, manifest.csv       collector catalog
  rung3/
    matches_review.csv            every pdf's best SymbTr candidate + score + tier
    matched/<makam>/<stem>/       SymbTr-matched ground truth (step 1)
    testset.json                  frozen exam pieces (step 2 — TODO)
    corrected/<makam>/<stem>/     editor-corrected docs (step 5)
```

## Watch-items

- **Slicer vs. TRT-style scans** (step 1b): the biggest unknown of the combined Round 1 —
  sample-check with `--debug` overlays before bulk download; timeboxed with a neyzen-only
  fallback. **Now measurable, not just eyeball-able (2026-07-19): the slicer hardening above
  ships with `scripts/rung3/score_slicer.py` — run it after any slicer change / on any new
  source's decode caches to get old-vs-new row-measure-count accuracy against SymbTr
  alignment (caveat: its truth is biased toward the CACHED slicer's counts).**
- **Alignment bugs poison labels silently** (step 3) — the round-trip + eyeball gate is
  mandatory per source before the first train. ✅ The gate already earned its keep: it caught
  the printed-signature convention and the written-vs-sounding bare-degree convention
  (both now handled — see the status block above).
- **Empty-`\sig` label bug** (`MODEL_EVAL.md` Rung 2.2b): DONE for real labels (the `--ranges`
  emitter skips empty signatures); the matching synthetic re-render stays a Round-1
  prerequisite — batch it with adopting carry-mode ("measure") rendering for synthetic pages
  so both conventions converge on real engraving. **Re-render mode mix (decided 2026-07-20):
  carry-mode DOMINANT, keep a minority `every`-mode share** — every-mode's glyph-teaching
  purpose stands, but carry is what real pages and ALL real labels use. Measured fact behind
  the init decision: strips_v2_2 = 17,133 every + 6,258 keysig + **0 carry** strips, so
  rung22-stemfix never saw a carry label — that is the format mismatch, and why Round 1
  trains from BASE.
- **Review-queue adjudication** — the review UI is BUILT (`scripts/rung3/review_ui.py`,
  stdlib HTTP server on :8377, 2026-07-12): queue tabs (sampled audit / full 84-strip audit /
  r1-review / exam-review), one-keystroke verdicts ok|fix|bad written atomically into the
  CSVs (`verdict` / `corrected_label` / `by` columns; `by` marks non-human verdicts, a human
  re-verdict clears it), solfège display (CSV stays letters), label-vs-decode token diff,
  Bravura-glyph token reference. **348-row r1 queue adjudication DONE (2026-07-14): 341 fix /
  4 bad / 3 ok** — nearly everything flagged needed fixing, vindicating the conservative
  accept gate; exam-review (443) is scheduled after the two-source freeze —
  see Step 2 "Grow the exam by adjudication" (accidental-bearing rows first, then re-take
  the baseline on the grown exam).
- **Promote script — BUILT + APPLIED (2026-07-14):** `scripts/rung3/promote_labels.py` folds
  the verdicts into `manifest.jsonl`: full_audit `fix` rows replace labels in place (`bad`
  would remove), review `ok`/`fix` rows are promoted as new manifest rows (SymbTr-stem piece
  metadata recovered from `matched/`; PNGs hardlinked; provenance columns
  `promoted`/`reason`/`verdict`). Human verdicts are ground truth — the gates only catch
  MECHANICAL defects: ≤59-id budget (training tokenizer) + round-trip via the new labels-cli
  `--check` batch mode (same checkLabel as `--ranges`, over raw hand-edited text). Atomic
  rewrite with `.bakN`; idempotent (keyed on image — re-run after further adjudication).
  **Result: manifest 84 → 418 strips** (65 emitter / 19 audit-fixed / 334 promoted); 10
  rejects in `promote_rejects.csv` = 7 over-budget (60–73 ids; MEASURES_PER_STRIP=2 re-slice
  recovers them) + 3 split-duration typos (`c'' 32` → `c''32`) pending hand-fix + re-run.
- **Audit verdicts — DONE, and the full audit earned its keep:** all 84 accepted strips
  eyeballed via the `full_audit.csv` sidecar queue: **65 ok / 19 fix / 0 bad (22.6% of
  auto-accepted labels needed correction)** — far above the 4-row sample's 1/4 hint. Known
  pattern: spurious `\repstart` in labels the edition doesn't print (SymbTr repeat, flattened);
  model-side: slurs systematically decode as false `\tie` (synthetic never drew slurs).
  **Hicaz signature misread (found + bulk-fixed 2026-07-13):** the model UNANIMOUSLY read
  hicaz-family signatures as `\sig \bakiyeFlat a \sigend` (flat one step low, do♯ missed), so
  the printed-sig majority-vote override propagated the error into labels WITHOUT tripping
  `sig_mismatch` (split votes were the only alarm). All 14 affected rows (hicaz +
  hicaz_humayun; incl. 1 manifest strip) converted to the printed convention
  `\sig \bakiyeFlat si \bakiyeSharp do \sigend`. Second variant same day: the 3-entry hicaz
  signature (♭+♯+♯) read as `\komaSharp do \bakiyeSharp fa \bakiyeSharp la` — converted to
  `\bakiyeFlat si \bakiyeSharp fa \bakiyeSharp do` + covered-accidental cleanup
  (sirma_sacli_yarimin_ney, 7 sig rows). Suspicious la♯-bearing sigs NOT yet adjudicated:
  saki_cekemem (evcara), ferahnak_asiran (ferahnakasiran), biz_heybelide (sultaniyegah),
  gel_ey_saki (mustear, exam) — confirm printed sigs per makam before converting.
  Lesson: unanimous-but-wrong sig reads are
  invisible to the vote — per-makam spot checks of the voted signature are part of every
  future source calibration (notaarsivleri), and hicaz signatures need synthetic coverage
  in the Round-1 re-render. **Applied to the nota run (2026-07-15): two clusters flagged —
  mahur voted with a spurious extra F entry ([F+1], 12 pieces) and a missing-B-1 cluster
  (voted sigs lacking the expected 1-comma-flat B). → ✅ ADJUDICATED (2026-07-16/17): the
  clusters were worked per-strip through the 105-row sig_mismatch review (the worksheet's
  markdown checkboxes were never ticked — the review rows superseded them), and the
  examv2-full audit (2026-07-17) confirmed the voted mahur + suzidilara sigs with ZERO
  signature corrections across their 34 exam rows.**
  Corrections APPLIED to `manifest.jsonl` by `promote_labels.py` (2026-07-14, see above).
- **Over-budget real strips** (233): a `MEASURES_PER_STRIP=2` re-slice would recover many.
- **⚠ SLICER w00 CROP BUG (logged 2026-07-16, user finding during review).** Many `_w00`
  (row-start) strips do NOT show the printed clef+signature: the crop starts too far right
  (e.g. `aman_cana p1_s00_w00` keeps the 10/8 time sig but cuts the clef;
  `hatirlar_misin p1_s00_w00` cuts mid-clef with junk from the row above;
  `canan_bilirim p1_s04_w00` is mid-staff garbage). Others DO include it — the population
  is mixed, so nothing mechanical can sort them; the user marks sig-cut w00 crops `bad`
  during review. Consequences: (a) lost sig-bearing training strips; (b) the printed-sig
  MAJORITY VOTE sees fewer/wronger row-start reads; (c) 191 review + 7 exam labels had
  their `\sig` blocks bulk-removed where the decode showed none — VALIDATED after the
  fact and KEPT: 23/24 user-verdicted overlap rows + 8/8 visually sampled affected strips
  confirm those images truly lack a visible sig (inspect list:
  `data/real/rung3/sigstrip_inspect.txt`). When the model DOES read a sig, the filter
  leaves the label alone, so decode-absence held up as a removal criterion here — but
  only verified-by-inspection after a false alarm from a mis-drawn sample; always sample
  from the actually-affected rows.
  **FIX WITH THE `MEASURES_PER_STRIP=2` RE-SLICE: anchor the w00 window at the row's true
  left edge (clef margin) in `page_to_strips.py` and eyeball ~20 w00 crops before the bulk
  re-emit.** Related edge defect (user, 2026-07-16): window boundaries sometimes BISECT a
  notehead — pad window x-edges a few px past the enclosing barlines at re-slice time.
  Review policy meanwhile: a cut note OUTSIDE the labeled measures = harmless edge
  fragment, verdict normally; a cut note INSIDE the labeled content = `bad` (the image
  can't prove the label; exam queues doubly so). Also revisit the triplet depletion then: 28% of matched pieces contain `\tup3`
  but only 1.3% of accepted strips do — triplet-dense windows die on the 59-id budget
  (35% of over_budget drops come from the 25% tup3 pieces); the 2-measure window is the
  same cure.
  **Second slicer defect (user, 2026-07-17): NOTE STEMS mistaken for barlines** — the
  detector cuts at a note, so the notehead survives but its stem/flag/beam is severed
  and the DURATION is misread. Re-slice must (a) discriminate barline vs stem better
  (a barline spans the full staff height with no notehead/beam attached at either end;
  a stem terminates at a notehead or beam), and (b) pad each cut a few px — TIGHT, so
  the margin never pulls in a neighboring note's head. The eyeball-20-crops gate before
  the bulk re-emit covers both.
  **→ ✅ SLICER FIXED (2026-07-19), all of the above in `page_to_strips.py`; strips on
  disk are UNCHANGED until the next re-slice.** What shipped:
  - *True root of the w00 bug found*: `staff.x0/x1` came from the horizontally-OPENED
    image — on a slightly skewed scan a staff line drifts across pixel rows, splitting
    each row into runs shorter than the w/4 opening kernel, so the opened image loses the
    line's left/right ends (measured: x0 pushed 70–490 px right; whole measures lost, not
    just the clef). X-extent now comes from RAW ink at the detected line rows
    (majority-of-lines vote, longest gap-tolerant run drops scan-border artifacts).
  - *Barline vs stem/clef* (`detect_barlines`): gate 2 (notehead-fat blob in the staff
    band, at the cluster CENTER) + new gate 3 = terminal-overshoot walk at the cluster's
    longest-run column over a ±2.5 sp extended band: a stroke extending >0.5 sp past BOTH
    outer lines is a clef/border artifact; past ONE line with a sustained-wide attachment
    (≥0.5 sp wide over ≥0.2 sp of consecutive rows, within 1.5 sp of the line) is a stem
    ending in a head/flag/beam. Thin one-sided overshoot of ANY length is kept — a hard
    length cap was tried and rejected real volta-tick barlines; slur/tie crossings and
    title-text collisions are also survived (the width run + nearness guards).
  - *End snapping*: a bar detected within 0.7 sp of the staff end SNAPS to the end
    (never a mid-clef measure 0 or sliver end measure); never-drop-first-window (a
    too-narrow w00 merges forward or emits, never vanishes).
  - *Clef+sig PREFIX span*: a leading span with NO notehead beyond the clef zone (repeat
    bar printed right after the signature) is excluded from measure indexing but kept in
    the w00 crop — it used to shift every strip's measure span by one (the +1 tail of the
    dn histogram). Trade-off: a row-start measure holding only RESTS is mis-trimmed the
    same way → dn recovery/review, never corrupted training labels.
  - *Cut padding*: crops pad 6 px past enclosing barlines (w00: 15 px left margin);
    `split_wide` gutter edges get no pad. Manifest schema unchanged (+ audit-only `pad`
    field; `row_x0/row_x1/width` now describe the padded crop).
  - *Tooling*: `--debug` overlay now color-codes REJECTED candidates (orange=fat blob,
    purple=clef-like, yellow=blob-past-line, gray=x-range); NEW
    `scripts/rung3/score_slicer.py` scores old-vs-new `row_measures` against the
    emitter's SymbTr row alignment using the existing decode caches (CPU-only, no model)
    and `--eyeball` writes contact sheets (docs' 3 bad w00 pages + worst regressions +
    random w00s) to `data/real/rung3/slicer_eyeball/index.html`.
  - *Measured (30-piece sample, 170 truth rows)*: exact row-measure-count rate 57.1% →
    68.2%; false-positive tail (+1/+2 dn) 55 → 34 rows; 27 rows improved, 4 "regressed"
    — 3 of them verified visually as the NEW slicer being right against alignment truth
    that is biased toward the old counts (assign_rows seeds n from old row_measures ±2),
    1 is a pathological typewriter page (title text fused to barlines) that goes to
    review either way. Full-corpus score in `data/real/rung3/score_slicer.csv`.
  - Caveats for the re-slice: staff-detection RECALL is untouched (e.g. keremkani p1
    still loses rows whose 5-line group isn't found); truth-bias means the scorer
    understates the improvement; the eyeball gate remains mandatory before the bulk
    re-emit.
  **Tuplet training gap (user, 2026-07-17, recurring):** the model reads `\tup3` poorly
  and real data can't fix it (depletion above) — the synthetic re-render must OVERSAMPLE
  tuplets aggressively (well above corpus rate, incl. contiguous-triplet runs — the
  two-`\tupend`s-in-a-row shape from the decode-repair note), alongside the
  rare-accidental and slur-distractor boosts. **→ REAL-DATA SIDE ADDRESSED same day, §1c:**
  293 tuplet pieces collected from both sources; the budget analysis there shows the 2-measure
  re-slice can't recover triplets (80% still over budget) — 1-measure windows + the
  sub-measure fragment follow-up are the cure. Derived signatures used to come out
  in C..B letter order; real editions print flats B-E-A-D-G-C-F then sharps F-C-G-D-A-E-B.
  `deriveKeySignature` now sorts to the printed convention (packages/core/src/notation.ts),
  and ALL existing label files were batch-canonicalized 2026-07-16 (user-approved; ~404
  labels across nota review/manifest/audits, examv2 review, r1 manifest — `.bak-sigorder*`
  backups beside each file). Caveat: hicaz-family SHARP order is edition-dependent (both
  `si♭ fa♯ do♯` and `si♭ do♯ fa♯` print) — canonical puts fa♯ first; per-strip review
  catches the other edition via the decode diff. **Before any re-slice/re-emit: (1) run
  `promote_labels.py` first — a re-emit writes a FRESH review queue with new strip windows,
  and un-promoted hand verdicts in the old CSV do NOT carry over; (2) `matched/*/labels.json`
  still hold the old C..B order until labels-cli is re-run over `matched/` (harmless for
  alignment — content search strips `\sig` blocks — but re-run it with the re-emit so
  everything regenerates consistently).**
- **Folk vs. art music:** TSM sections only; THM's numbered bemol-2/3 signs have no tokens.
- **Handwritten scores** stay OUT of scope for v1 (product-side message, not a model fix).
