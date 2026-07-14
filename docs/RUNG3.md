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

### 1b. notaarsivleri.com — SymbTr-first download (TO BUILD, before Round 1)

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
the 83.3% headline) — too thin to tell whether Round 1 improved or regressed. The 443-row
`strips_exam/emit_review.csv` queue is the growth pool, and exam strips never enter training,
so adjudicating them is pure measurement quality. Rules:

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

## Step 4 — Round 1: ONE fine-tune on everything matched + the first honest number

Colab, **from base weights** (NOT from the Round-0.5 labeler — that checkpoint is tooling
only), the proven Rung-2 kit: synthetic `strips_v2_2` + ALL matched real
strips (both sources, real oversampled; per-source sampling weights in the loader — source
balance is a loader knob, **never** "delete neyzen files"). **Split by piece across ALL pools**
(a piece's real and synthetic strips stay in one split; dedupe matched↔synthetic by SymbTr
file). Then take the Step-2 exam with `eval_omr.py` (headline: per-class AEU accidental
accuracy) — including the per-source breakdown, which is the style-overfit check. `PHOTO_SHARE`
likely stands (these pages are clean rasterizations — screenshot-profile territory). Ship
through the scripted chain (ONNX export → int8 parity → browser gate) before it becomes the
runtime in `apps/web/public/models/`.

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
  fallback.
- **Alignment bugs poison labels silently** (step 3) — the round-trip + eyeball gate is
  mandatory per source before the first train. ✅ The gate already earned its keep: it caught
  the printed-signature convention and the written-vs-sounding bare-degree convention
  (both now handled — see the status block above).
- **Empty-`\sig` label bug** (`MODEL_EVAL.md` Rung 2.2b): DONE for real labels (the `--ranges`
  emitter skips empty signatures); the matching synthetic re-render stays a Round-1
  prerequisite — batch it with adopting carry-mode ("measure") rendering for synthetic pages
  so both conventions converge on real engraving.
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
  in the Round-1 re-render.
  Corrections APPLIED to `manifest.jsonl` by `promote_labels.py` (2026-07-14, see above).
- **Over-budget real strips** (233): a `MEASURES_PER_STRIP=2` re-slice would recover many.
- **Folk vs. art music:** TSM sections only; THM's numbered bemol-2/3 signs have no tokens.
- **Handwritten scores** stay OUT of scope for v1 (product-side message, not a model fix).
