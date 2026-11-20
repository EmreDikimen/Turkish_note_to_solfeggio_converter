# Labeling — the conventions real-page labels must follow

purpose: the rules a real-page label obeys, how the corpus was collected, and every review queue
audience: agents and the owner working the real-page track
updated: 2026-11-20

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

> The two review queues that were run through `review_ui.py` — **`realval-hard`** (2026-07-28) and
> **`reslice-all`** (2026-07-31) — moved to [labeling.md § The labelling queues — reslice-all, the batches, b8 and examv3](#the-labelling-queues--reslice-all-the-batches-b8-and-examv3) on 2026-08-07.

## What we do NOT label — the arc (2026-08-22)

⛔ **`\tie` is RETIRED. Do not type it, and do not emit it.** An arc on the page — tie or slur — is
**label-free ink**, the same treatment `drawSlurArc` already gets. Two tied notes are written as two
plain notes: `la'2 \tie la'8` becomes `la'2 la'8`. Same pitches, same total length, one token fewer.

**Why this is safe.** A tie only ever exists in our labels for a mechanical reason: SymbTr stores a
long value like 5/8 as ONE event, and no single notehead draws 5/8, so `tieSplitBeats`
(`packages/core/src/labels/rhythm.ts`) writes a pair. Both halves are the **same pitch** and they **sum to the
original duration**, so dropping the token loses no note, no pitch and no bar arithmetic. The only
loss is playback: the app re-strikes where the page holds. The owner accepted that — for learning
notes and fingering it is invisible.

**Why it was worth doing, measured over the 20 non-frozen queues.** The token had three producers and
they disagreed about what it meant. Classified by whether the notes either side share a pitch (a tie
can only join identical pitches):

| where the `\tie` came from | real (same pitch) | impossible (different pitch) |
|---|---|---|
| `label`, in the emitter-derived pools | **407 (100%)** | 0 |
| `label`, in decode-seeded queues (batch1/2/3, reslice-all, photo-gold, realval-hard) | 3,080 (29%) | **7,132 (68%)** |
| `decoded` (the model) | 4,192 (27%) | **10,943 (70%)** |
| `corrected_label` (saved human verdicts) | 176 (20%) | **681 (78%)** |

The derivation from SymbTr is exact; every wrong one came from a model decode. ⚠ **404 of the human
ones were the owner's own**, and they are not carelessness — a curve joining two *different* notes is
a **slur**, and the owner was labelling the ink on the page. That is the confusion the retirement
removes.

**What was removed.** 10,951 from `label`, 15,611 from `decoded`, 872 from saved verdicts across
11,801 rows; 652 from the five real manifests (`strips_nota` 563, `strips_r1` 57, `strips_b8` 24,
`strips_tup` 7, `strips_exam_v3` 1 — all same-pitch, i.e. all genuine). `.bak-notie` sits beside every
edited file.

⛔ **`strips_exam_v2/` and `strips_exam_v2_clean/` were NOT touched** (594 ties). They are the record
of what Round 2 was graded on; rewriting them makes that number unreproducible.

⚠ **`\tie` stays in `ADDED_TOKENS` at its existing position.** Ids are append-only — removing it
would shift every later token and break every checkpoint. It is a token nothing emits, which is also
what lets Round 4 bring it back.

✅ **THE RENDER SIDE LANDED 2026-08-22** — the deadline item is done, before the final render rather
than after it. `measureAtoms` (`packages/core/src/labels/lilypond.ts`) no longer writes the token: the 1,246 ties
over 1,185 of `strips_v5_tupnew`'s 40,826 strips become plain note pairs at the next render. **The
picture does not change** — SheetView still draws the arc from `tieSplitBeats`, so an arc is now ink
with no token, exactly like a slur distractor.

⚠ **ONE THING HAD TO CHANGE WITH IT, AND IT WAS NOT PREDICTED: the tie tail now RESTRIKES its
accidental in `every` mode.** The tail used to be spelled bare on the rule "engraving never restrikes
a tied-to note", and the `\tie` token carried the pitch. With the token gone, a bare tail in a mode
that has no accidental carry reads as *unaltered* — a silent pitch error in the gold. It is not a
corner case: **9,979 of 40,826 strips (24.4%) are `every` mode** and **199 of the 1,246 ties sit on an
accidented note**. The stitcher round-trip caught it immediately (10 of 218 scores failed on pitch).
The fix is symmetric on both sides — the tail spells through `noteToLily` and SheetView calls
`applyAccidental` on it — so pixels still equal labels. In `measure` (carry) mode both sides are a
**no-op**: the head's alteration is already in effect, so the tail stays bare exactly as before.

⚠ **It adds ink to 160 strips (0.39%), and ink moves crops.** A restruck accidental widens the
measure, which can push a later glyph past a strip's rect edge. Measured on the worst piece in the
corpus (`rast--sarki--curcuna--icime_hep`, 29 accidented ties): the control render verified
**265/265 exact**, the new one **261/263** — 2 strips where an accidental landed in the neighbouring
crop. This is the **existing** flagged-strip class (`strips_v5_tupnew` carries 15 of them), and the
existing remedy applies unchanged: `verify-labels.ts` flags them and `make_round3_colab_zip.sh`
refuses to ship any flagged strip that is still in the manifest.

✅ **THE REAL SIDE IS DONE TOO (2026-08-22)** — the selection gold is tie-free: **771 tokens over 576
rows in 12 manifests**, with a `.bak-notie` beside each. `_realval_v2`, its five derived pools
(`_easy`, `_mid`, `_hard`, `_scan`, `_borndigital`), the five `_realval_degraded` levels, and the v1
`_realval`. No verdict moved by itself — `eval_omr.py` drops `\tie` from **both** the gold and the
decode — but the gold now reads honestly.

**What the tokens actually joined**, over all 12 manifests:

| what the pair was | count |
|---|---|
| **different pitch — a SLUR, not a tie** | **576 (78% of the 741 resolvable)** |
| same pitch — a real tie | 165 |
| head in the previous strip | 18 |
| tail in the next strip | 12 |

So this gold carried the same three-producer confusion the retirement removes, at the same rate as
the review queues (65–78%).

⚠ **REMOVE IT AS A SUBSTRING, NEVER BY `label.split()`.** These manifests carry **two spellings** of
the same label — `a'4. \tie a'8` and the compact `a'4. \tiea'8` — and the added-token tokenizer splits
on the substring, so both mean the same thing to the model. A whitespace-token filter misses every
compact one **and still reports success**: on `_realval_v2_hard` it would have cleaned 7 rows while
reporting 25. Delete the substring, then collapse the space it leaves.

✅ **NO ACCIDENTAL RESTRIKE WAS NEEDED HERE**, unlike the render side. All 576 rows are `measure`
(carry) mode, where the restrike is a no-op, and **zero** ties crossed a barline — so no tail could
land where the carry had reset. Verified after the edit: 2,427 rows, **0 label mismatches** against a
re-tokenised backup and **0 changes to any other field**.

⚠ **ONE METRIC GOES QUIET ON REAL-VAL.** `eval_omr.py` selects its arc-triggered false-`\tup3` bucket
by `\tie` **in the gold**, so on these pools it now prints `n/a` instead of a rate. The Round-3 floor
for that metric (≤10%) is read on the **exam**, which keeps its ties, so **no criterion moved** —
only the selection-side diagnostic did. Recoverable two ways: from the `.bak-notie` files, or offline
from `piece`/`from`/`to` via `needsTieSplit`, as the note in `eval_omr.py` describes.

⚠ **`_realval` (v1) was included on purpose** though it is not a v2 pool: `build_realval_v2.py` reads
it as a **source**, so leaving its ties in would let any future rebuild put them back.
⚠ **`_realval_tier_easy` (40/160) and `_realval_tier_mid` (24/111) were left alone** — v1 tiers,
superseded by `_realval_v2_*` and read by no code. `strips_exam_v2*` keeps its 594 for the same
freeze reason.

⚠ **A PRE-EXISTING FAILURE THIS SURFACED, NOT CAUSED**: `check_token_drift` rejects `_realval_v2`,
`_hard`, `_scan` and `_borndigital` because its `\\[A-Za-z0-9]+` pattern reads the compact spelling
`\sigendd''4` as a token `\sigendd`. 45 such phantoms remain in `_realval_v2`; the count went **down**
from 51 with this edit and **zero** were added. Not fixed here — it is a guard bug, not a gold bug.
[../DECISIONS.md](../DECISIONS.md) · [../STATUS.md](../STATUS.md).
## ⏭ `\tupend` may follow `\tie` into retirement — proposed, not decided (owner, 2026-08-27)

A triplet's boundary is already implied by its members' durations, `\tup3`/`\tupend` is mismatched
in **51% of tuplet-bearing decodes**, and the token is only 0.20% of all ids — so this is a
reliability change, not a budget one. The measurement, the one genuine two-event group that stops
"always three" from being a safe rule, and what it would touch:
[tokenization.md](tokenization.md). ⛔ Until it is decided, **keep emitting `\tupend`**.

## Step 1 — collecting the pages and matching them to SymbTr → [labeling.md § Labeling, Step 1 — collecting real pages and matching them to SymbTr](#labeling-step-1--collecting-real-pages-and-matching-them-to-symbtr)

Moved out on 2026-08-22, when this file crossed the 400-line cap. Nothing was dropped; the section
map is unchanged:

| § | What it covers |
|---|---|
| §1a | neyzen.com — the SymbTr name match (`match_symbtr.py`), 85 auto-accepts |
| §1a.5 | the Round-0.5 labeler fine-tune that seeds the emitter |
| §1b | notaarsivleri.com — the SymbTr-first download, full run |
| §1c | targeted TUPLET collection, and the 59-id budget blind spot it exposed |
| — | the 2026-08-11 SUPERSEDED note: the tuplet queues are finished and promoted |

**Merged into this file on 2026-11-20:**

- [Labeling, Step 1 — collecting real pages and matching them to SymbTr](#labeling-step-1--collecting-real-pages-and-matching-them-to-symbtr) — was `docs/rung3/labeling.md`
- [The labelling queues — reslice-all, the batches, b8 and examv3](#the-labelling-queues--reslice-all-the-batches-b8-and-examv3) — was `docs/rung3/labeling.md`
- [The real-val labelling queues — realval-hard, and the 2026-09-09 repair](#the-real-val-labelling-queues--realval-hard-and-the-2026-09-09-repair) — was `docs/rung3/labeling.md`


## Labeling, Step 1 — collecting real pages and matching them to SymbTr

*Was `docs/rung3/labeling.md` (last updated 2026-08-22).*

> Split out of [labeling.md](labeling.md) on 2026-08-22, which kept the live labelling *conventions*
> and crossed the 400-line cap. This file is the collection **history and method**: §1a neyzen,
> §1a.5 the Round-0.5 labeler fine-tune, §1b notaarsivleri.com, §1c targeted tuplet collection.
> Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
> Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).
> The review queues live in [labeling.md § The labelling queues — reslice-all, the batches, b8 and examv3](#the-labelling-queues--reslice-all-the-batches-b8-and-examv3).

### Step 1 — Free labels from SymbTr matches

#### 1a. neyzen ✅ DONE (2026-07-11)

`ml/labels/match_symbtr.py` matches the 798 downloaded pdfs against the 2,186 SymbTr pieces
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

#### 1a.5 — Round-0.5 labeler fine-tune (decided 2026-07-13; **DONE 2026-07-15 — see
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
  (`ml/omr/quantize_onnx.py`) + parity (`onnx_parity.py`).
- **Prerequisite: the promote script** (train only on corrected labels). Natural batch-mate:
  the `MEASURES_PER_STRIP=2` re-slice (~233 recoverable strips = more labeler training data).
- **Round 1 is unchanged**: ONE from-base run on synthetic + all matched real. The 2026-07-11
  decision applied to shipped training rounds; this checkpoint is tooling.

**Run kit — BUILT 2026-07-14, wiring smoke-tested locally (2 steps, mps):**
`data/real/rung3/strips_r1/split.json` (make_split.py: 40 train / 8 val pieces, 56/418
strips, AEU-coverage-aware), `ml/labels/make_labeler_zip.sh` (10 MB upload:
ml/omr + strips_r1; start weights come from Drive `tnc/rung22-stemfix/best`, left there
by the 2.2b run), `ml/notebooks/rung3_labeler_colab.ipynb` (baseline-eval cell → shakeout →
train `--lr 1e-5 --max-steps 1200 --warmup-steps 50`, T4 ~30–40 min → post-eval; after-notes
cover the ONNX-int8-only export + pointing emit_strip_labels.py at the labeler).
Re-run promote → make_split → make_labeler_zip after any new adjudication (the 3 typo fixes).

#### 1b. notaarsivleri.com — SymbTr-first download (✅ FULL RUN DONE 2026-07-15)

> **Full run (2026-07-15), after the calibration probe below:** all **964** matched pieces
> downloaded (`nota_downloads.json`; 966 accepts minus 2 dead links), **1,227 pages
> GPU-decoded on Colab** (`ml/labels/decode_pages_gpu.py` + `make_decode_zip.sh` +
> `ml/notebooks/rung3_decode_colab.ipynb` — the labeler decode offloaded per the fanless-Mac
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
> nota-full rows (79 fix / 46 ok), `ml/labels/rule_fix_notafull.py` learned the
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

> **Status:** `ml/labels/collect_nota.py` (census / match / download / export, all
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

#### 1c. Targeted TUPLET collection (2026-07-17 — the tuplet-training-gap response)

The exam froze with 4 `\tup3` gold and the manifest holds ~14 tup3 rows; the user called for
collecting tuplet repertoire directly. Two new scripts:

- **`ml/labels/find_tuplet_pieces.py`** — scans all 2,200 SymbTr txts for tuplet events
  (same rule as `packages/core/src/labels/rhythm.ts`: sounding event whose reduced Pay/Payda denominator
  is divisible by 3) and crosses them with both sources' match state →
  `data/real/rung3/tuplet_pieces.csv`. **459 tuplet-bearing pieces; 267 already collected**
  (the 28% figure), 36 nota review-tier candidates uncollected, and — the big find — the
  neyzen census still held ~7.6k never-downloaded PDFs (the 798-pdf round was makam-weighted,
  not exhaustive).
- **`ml/labels/collect_tuplets.py`** (match / download / export) — promotes the 36 nota
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

## The labelling queues — reslice-all, the batches, b8 and examv3

*Was `docs/rung3/labeling.md` (last updated 2026-09-29).*

> Split out of [labeling.md](labeling.md) on 2026-08-07 at the 400-line cap. That page is the
> standing procedure (free labels from SymbTr matches); this one is the **queues that were run
> through the review UI** for the TRAINING pools and the exam — real-val's own queues are in
> [labeling.md § The real-val labelling queues — realval-hard, and the 2026-09-09…](#the-real-val-labelling-queues--realval-hard-and-the-2026-09-09-repair). Current state and next action are NOT here: [../STATUS.md](../STATUS.md).

---

### The real-val queues live next door

`realval-hard` (2026-07-28) and `realval-repair` (2026-09-09) build and repair `_realval_v2`, the
pool that SELECTS a checkpoint rather than grading one. They moved to
[labeling.md § The real-val labelling queues — realval-hard, and the 2026-09-09…](#the-real-val-labelling-queues--realval-hard-and-the-2026-09-09-repair) on 2026-09-09 at the 400-line cap.

---

### The `reslice-all` queue (2026-07-31) — every strip the re-slice decoded, in one place

**What it is.** One queue over **all 33,804 crops / 1,704 pages** in `data/real/strips_v2` (30,049
decoded on Colab), so any strip in the re-slice can be pulled up instead of only the 165-row
hard-tier sample. `ml/labels/build_reslice_queue.py` builds it **worst-first** (`--order page`
groups by page instead); re-running merges the verdicts already there and carries the 165 hand-read
`realval-hard-v2` rows across — same crops, same slicer.

**What a row means.** 392 rows carry a real emitted label from the val-side emit (`strips_v2emit`);
the other 33,412 are seeded with the page cache's decode, so `ok` means "I looked at the picture
and the decode is right" — the `photo-gold` contract. `reason` carries the emit's own verdict where
there is one (`accepted`, `row_unaligned`, `split_wide`, …) and is the filter to narrow with.

⚠ **Nothing but `strips_v2emit` is joined in** — every other pool was emitted from the OLD crops
under `data/real/strips`, and a filename survives a re-slice while its pixels do not. ⚠ **It is a
browsing tool, not a labelling target** — 33,804 hand checks is not a plan, nothing consumes it
yet, and promoting from it needs the same rules as any other queue.

Run: `review_ui.py` → queue **`reslice-all`** (the default tab); its rows load on first open, too
big (16 MB) to ship with every `/api/state`.

### The `ndhigh` queue (2026-09-09) — 40 dense strips the referee threw away

**What it settles.** Round 4's re-emit brought the over-budget strips back and then lost most of
them to the SECOND gate, `nd` — the emitter's disagreement check against `round2-stage2-best`'s
reading. The strips that made both journeys (`over_budget` in `strips_b8`, `nd_high` in
`strips_h1`) are **1,678 rows** and they are genuinely dense: median **49** ids of music in the
crop against **37** for an accepted strip. Nobody has ever read one.

⚠ **`nd` cannot say WHY it is high** — "the model misread a dense strip" and "the label is the
wrong measures" look identical to it, which is why the emitter drops rather than guesses. On EXAM
pieces, where `nd_high` goes to review instead, 75 hand-read rows say it is overwhelmingly the
label. ⛔ But the general `nd_high` population is **not** dense, so that reading does not transfer
to this subset ([METRICS-DIAGNOSTICS.md § Where an error comes from — the label, or the model?](../METRICS-DIAGNOSTICS.md#where-an-error-comes-from--the-label-or-the-model)).

**What a verdict means.** The `realval-hard-v2` contract: no trustworthy SymbTr label, so the row is
seeded with the model's decode and the verdict is against the **picture**. `ok` = "I looked and the
decode is right", `fix` = type what the page says, `bad` = the crop is unusable.

- ⚠ **RANDOM, not worst-first.** Every other queue here is ordered worst-first to spend the human
  where the errors are; that is right for harvesting labels and wrong here, because this queue is
  read for a **rate**. 40 rows gives roughly ±15 pp at a 50% split.
- ⭐ **`label` is EMPTY** — a dropped strip has no stored label, and re-deriving one means running
  the emitter again. So the edit box is seeded with the decode alone, which leaves exactly **one**
  anchor instead of the usual label-sig + decode-content hybrid.
- **How to read the result:** a high `fix` rate means the model really is weak on dense material and
  these strips are worth hand-labelling; a low one means the high `nd` came from the label side.
- ⛔ **Not gold.** The filename is neither `emit_review.csv` nor `full_audit.csv`. Verified clean
  against the 45-piece frozen exam by SymbTr id *and* by page stem.

Run: `review_ui.py` → queue **`ndhigh`**. Built by `ml/labels/build_ndhigh_queue.py`.

### `r4-ctl-errors` / `r4-live-errors` (2026-09-29) — the strips behind the Round-4 taxonomy

Owner: *"signature için 46 hata olduğunu nereden biliyoruz … goldu ve token çıktısını gösteren bir
queue"*. Every `_realval_v2r` strip a model got wrong, gold on top and the decode below, both in
**label tokens** (`c''8`, `\sig`), re-spaced so the diff on screen is the diff that was counted.
`r4-ctl-errors` is `r4-ctl-stage2-best-edits`, the checkpoint behind the taxonomy in
[METRICS-EXAM.md § Round 4's vocabulary A/B — how it is scored, and what the kit…](../METRICS-EXAM.md#round-4s-vocabulary-ab--how-it-is-scored-and-what-the-kit-measured-before-any-gpu-ran); `r4-live-errors` is `r4-ctl-stage2-last`, the
site's model since 2026-09-28. Counts are in the script's printout, not here.

- ⚠ **A category count is TOKENS, not strips.** `signature` 46 reproduces exactly on the Mac, and
  it sits on **20** strips — one wrong `\sig` block raises one count per wrong token inside it.
- ⚠ The Mac's MPS decode is not bit-identical to Colab's CUDA decode: 189 exact strips here against
  the published 192, so the other categories move by 1–2.
- ⛔ **Diagnostic, never promotable** — `corrected_label` empty, a file name `promote_labels.py`
  never reads. Triage as in `r3-exam-errors`: `ok` = gold wrong, `fix` = model wrong, `bad` = crop.
- Filter `reason` = `<short+mid|long> | <main category>`; the badge beside it lists every category.
  Crops are the pool's own flat PNGs (`QUEUE_FLAT_ROOTS`) — 6 of the 260 exist nowhere else.

Run: `ml/labels/build_exam_error_queue.py --pool data/real/rung3/_realval_v2r --out
data/real/rung3/_errors --out-name r4_ctl_errors.csv --checkpoint <ckpt>`, ~75 s per model on the M4.

### The labelling BATCHES (2026-08-18) — a page-complete cut of `reslice-all`

**Why they exist.** `reslice-all` is a browsing tool, not a labelling target: 33,804 hand checks is
not a plan, and the UI sorts nothing. Worse, the queue ships **worst-confidence-first**, an ordering
since measured at **0.44× lift** on this very pool ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)),
so taking its first 1,500 rows is close to labelling 1,500 random strips. A batch is therefore cut
outside the UI by `ml/labels/build_label_batch.py` and handed to it as its own queue.

**What it ranks on, and what it refuses to rank on.** Per-page **structural evidence** — off-meter
bars, stitch warnings, truncated (`hit_cap`) strips, slicer-flagged crops — reusing
`build_page_queue.py`'s scorer, so there is one ranking implementation. The two obvious alternatives
are ruled out by measurements already on record: **decode confidence** (0.44× lift, and W8 was
dropped for it) and **label/decode disagreement** (~78% of disagreements are the *label* being wrong,
and `nd` is empty for all 33,804 reslice rows anyway).
⚠ It is a heuristic over **visible damage**, not a validated predictor of edits/page — and it cannot
be validated, because the only pages carrying gold are the exam's and those are (correctly) refused.
Read the order as "where the damage is", which is what it measures.

**Page-complete, in reading order** (`s00_w00`, `s00_w01`, `s01_w00`, …): the strip-level order is
worthless, reading a page once beats reading it 20 times, and a page is the unit Round 3's primary
floor is stated in.

⚠ **A batch is TRAINING data and nothing else.** Exam pieces are refused twice over (here, and by
the re-slice that produced the decodes), but the deeper reason is the ranking: it selects *the worst
pages in its tier*, so an exam drawn from it would not be comparable to exam v2.1's baseline or to
the signed floor. Exam growth is a separate job needing a random/stratified sample ([rounds.md § The levers Round 3 has not pulled — ranked, with what to measure first](../archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first)).

| Batch | Cut | Pages / strips | Sources | Evidence | State |
|---|---|---|---|---|---|
| `batch1` | whole corpus | 52 / 1,500 | nota 47, neyzen 5 | 48.6 units/page | ⛔ **PARKED — and not the answer, see below** |
| `batch2` | `--clean` (born-digital only) | 52 / 1,497 | nota 52 | 30.2 units/page, from 115 ranked pages | ⛔ **STOOD DOWN 2026-08-19** at 68 verdicts |
| `batch3` | `--scanned` (the inverse filter) | **54 / 1,499** | nota 46, neyzen 8 | 43.0 units/page, from 1,504 ranked pages (corpus median 12.0) | ✅ **CUT 2026-08-19 — THE LIVE ONE** |

**Why batch 1 is parked.** Unfiltered, the ranking selected exactly what it is built to select — the
most damaged pages — and those turn out to be old scans and **real handwritten manuscript**.
Handwriting is a **deferred category** ([../DECISIONS.md](../DECISIONS.md), owner 2026-08-17) and must
not enter a printed-page pool. The file is kept on disk as the record of what the unfiltered ranking
returns; it carries 4 verdicts from a look at the top rows and no more.

**Why batch 2 was the live one.** `--clean` restricts the ranking to **born-digital** pages — a
file-format fact, not a heuristic, so no scan and no handwriting can enter
([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). The owner's call on 2026-08-18 was to teach the clean
modern sheets first. ⚠ **Know what it aimed at**: the still-open *"publish for clean pages first"*
question, **not** the signed Round-3 floor — that exam is 41 nota / 26 neyzen pages and only 18% of
it is the easy tier, so a clean-page batch cannot be expected to move it much.

### ⛔ Why batch 2 was stood down after 68 rows (2026-08-19) — and what replaces it

The caveat above turned out to be understated, and two measurements say so
([../METRICS-CORPUS.md](../METRICS-CORPUS.md)):

- **93% of exam pages are scans** — 62 of 67; only 4 of 45 exam pieces are born-digital. So `batch2`
  was cut entirely from the tier that supplies **7%** of the medium Round 3 is graded on.
- **Its own fix rate is ~12%** (59 ok / 8 fix / 1 bad, n=68), against **30%** in the scanned nota
  pool. Since a row is seeded with the decode, an `ok` changes the training data by **nothing** — so
  the yield of a batch is its *fix* rate, and ~88% of those looks bought nothing.

The owner's goal changed with it: the model must be **good enough on scans too**
([../DECISIONS.md](../DECISIONS.md)).

⚠ **`batch1` is NOT the inverse and unparking it is the wrong move.** It ranks the most damaged pages
*corpus-wide*, which is why it surfaced handwritten manuscript in the first place — and 10 of its 52
pages are born-digital anyway. Handwriting stays **deferred**.

### ✅ `batch3` — cut 2026-08-19, and what the cut cost

All five steps ran. `--scanned` and `--exclude-pages` are now in `build_label_batch.py`;
`--stats --batch N` reads the yield while labelling.

**The batch: 54 pages / 1,499 strips**, nota 46 + neyzen 8, 43.0 evidence units a page against the
scanned tier's median of 12.0. Two rows arrive already judged, carried in from the master queue.

**28 pages were excluded, and it took four cut/check rounds to converge** — dropping a page pulls
the next-ranked one in, and that one has to be triaged and checked too. The list, with a reason per
page, is `data/real/rung3/_pagequeue/handwritten_pages.json`; the crop verdicts are
`batch3_staleness.json`.

| Excluded | n | Why |
|---|---|---|
| handwritten | 11 | free-hand pen manuscript — a **deferred category**, and the scanned tier is the first tier that can contain it |
| stale crops | 17 | the page no longer re-slices to the same crops, so a verdict on it would not survive a re-slice |

⚠ **The handwriting rule is narrow, deliberately.** A page is dropped when its **note glyphs** are
drawn free-hand — irregular noteheads, wobbly stems, hand-drawn staff extensions, visible
corrections. The professionally **hand-copied editions** that were reproduced and published are
KEPT, even where the lyrics are hand-lettered: most of the Turkish nota corpus is exactly that, and
so is the exam, so the wide rule would empty the scanned tier and train on a medium the exam does
not have. 56 pages were read by eye at contact-sheet scale and 20 of them again at native
resolution, before and after each re-cut.

⚠ **24% of the pages the ranking offered are stale** (17 of 71 checked) — the scanned tier really is
staler than the corpus average, as this file predicted. Every page in the final batch is verified:
40 identical, 11 size-only, 3 pixels-only, **0 void**. The owner's call was to exclude rather than
label into them, because B8 (re-emitting the pools from the new crops) is still an open decision, so
a re-slice is a real possibility rather than a hypothetical one. The cost is real too: the excluded
pages were the highest-evidence ones in the tier.

✅ **THE PROBE IS IN AND `batch3` IS THE BEST-PAYING QUEUE THIS PROJECT HAS RUN (read 2026-08-20,
114 of 1,499 judged: 66 fix / 39 ok / 9 bad).** That is a **~58% fix rate** — against ~30% in the
scanned nota pool and **~12%** in `batch2` — so the tier re-aim was right and the queue is worth
finishing. The bad rate is **7.9%**, far under `realval-hard`'s 33%, so no impact-score cap is
needed. ⚠ **~1 in 5 of those fixes is deleting a false `\repstart`**, i.e. hand-payment for the
dotted-barline hole, which is now going into the final render label-free
([../DECISIONS.md](../DECISIONS.md)) — expect the fix rate to fall once a model trained on that
render replaces the seeding decode. ⚠ **Priority note (2026-08-20): exam v3 outranks this queue for
a scarce evening** — 297 rows that decide whether the one-shot read can be interpreted, against
~1,385 rows here that improve training ([README.md § The exam — freezing an honest test set (Steps 2 and 3)](README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3), and the `examv3` section below).

⏭ **The original instruction, kept for the record: probe 100 rows before committing to all 1,499**,
then `--stats --batch 3` for the fix rate AND the bad rate. Reference points: **~30%** fix in the scanned
nota pool (why this tier), **~12%** in `batch2` (why that one was stood down), **33%** crops lost in
`realval-hard` (the bad-rate warning). If the bad rate is high, cap the impact score rather than
reading on. ⚠ Attend to **pitch and duration, not accidentals** — every audit so far chased
accidentals because the old headline measured them, and that axis has never been audited.

**The loop**, and the two steps that are easy to skip:

```bash
npx tsx tools/dev/page-structure.ts                                    # 1. stitch stats (once)
.venv-ml/bin/python ml/labels/build_label_batch.py --merge-back --batch 2   # 2. LAST batch home
.venv-ml/bin/python ml/labels/build_label_batch.py --scanned --batch 3 \
    --exclude-pages data/real/rung3/_pagequeue/handwritten_pages.json     # 3. cut it
.venv-ml/bin/python ml/labels/check_crop_staleness.py --root data/real/strips_v2 \
    --pages-from data/real/rung3/_pagequeue/batch3_pages.json \
    --out data/real/rung3/_pagequeue/batch3_staleness.json                # 4. will the work survive?
#    -> add every `wouldLoseLabels` page to the exclude list, re-cut, re-check the NEWCOMERS
.venv-ml/bin/python ml/labels/review_ui.py                            # 5. label the `batch3` tab
.venv-ml/bin/python ml/labels/build_label_batch.py --stats --batch 3  # 6. what is it yielding?
.venv-ml/bin/python ml/labels/build_label_batch.py --merge-back --batch 3   # 7. verdicts home
```

- ⚠ **Step 2 is not optional.** A verdict is only worth what its crop is worth, and a strip filename
  survives a re-slice while its pixels do not — `--pages-from` checks *exactly this batch's* pages
  rather than a random sample, which is the difference between "the corpus is mostly current" and
  "the work I am about to do will survive".
- **Step 5 keeps `reslice_all.csv` the record**, so no verdict lives only in a batch file. A strip
  that already carries a *different* verdict in the master queue is a real conflict: the merge
  reports it and leaves it alone rather than picking silently. Cutting over an existing batch CSV
  refuses unless `--force`, because that file may hold verdicts.
- The batches share `reslice-all`'s row schema and its crop root (`data/real/strips_v2`, bound per
  queue in `QUEUE_IMG_ROOTS`), so verdicts carried in from the master queue show up already judged.
- `--makam-cap` (default 0.15 of the strip budget) stops one makam taking the batch — Lever 4's whole
  argument is that the corpus is already too uniform.

---

### The `b8` queues (2026-08-21) — the re-emit, put in front of a human

`data/real/rung3/strips_b8/`, wired into `review_ui.py` as three tabs. Images resolve under
**`data/real/strips_v2`** (`QUEUE_IMG_ROOTS`), because the accepted PNGs are hardlinked out of that
root and stored flat. Yield and carry numbers: [../METRICS-CORPUS.md](../METRICS-CORPUS.md).

| tab | rows | what a verdict means |
|---|---|---|
| **`b8-audit`** | **201** (✅ all read) | the emitter's seeded 5% sample of ACCEPTED labels — the escaped-bad-label rate |
| **`b8-full`** | **3,955** (✅ **READ AND CLOSED 2026-08-31**) | every accepted label. **3,362 ok / 576 fix / 17 bad**; 1,016 read by hand, 2,939 machine `agree` drafts accepted by the owner |
| `b8-review` | 4,738 | the unsure ones; a `fix` here promotes a strip into training. ⏭ **DEFERRED TO ROUND 4** (owner, 2026-08-31), including the **450** rows carrying an old human fix |

- ⭐ **`⭐ old human fix` — a filter over the retired pools' corrections** (`carry_old_fixes.py`,
  2026-08-31). It marks each row with `oldfix` / `oldfix_kind` / `oldfix_src` and lists them
  **worth-first**: fixes that DISAGREE with b8's label before the ones the re-emit reproduced by
  itself, `span` before `name`. ⚠ `span` means the same BARS, **never the same pixels** — 0 of 1,215
  crops are byte-identical — so it is a suggestion with its own ✓ accept button and plain `ok` never
  stores it. ⛔ `name`-only rows are drawn with a red warning: that is where the 248-row trap lives.
  Numbers: [METRICS.md § Metrics — the B8 re-emit and the human fixes it did not carry](../METRICS.md#metrics--the-b8-re-emit-and-the-human-fixes-it-did-not-carry).

- ✅ **THE GUARD IS READ — all 201 rows, by hand, 2026-08-22: 27 `fix` / 174 `ok` = 13.4% wrong.**
  It was worth reading: the referee saw these very labels in stage-2 training at 9× oversampling, so
  its agreement is partly memory rather than judgement, and the precedent is exam v2 — 2 of 63
  sampled, a later full read found **51%** wrong. That did not repeat here. Rate, error mix and the
  caveats: [../METRICS-CORPUS.md](../METRICS-CORPUS.md). ⚠ **13% wrong is the pool as it stands**, not
  a clean bill: the biggest class is repeat structure (`\repstart` / `\volta`), not pitch.
- ⭐ **`b8-full` IS AUTO-ACCEPTED WHERE THE LABEL AND THE DECODE AGREE (2026-08-27).**
  `ml/labels/auto_accept_agree.py` drafts `ok` with `by=agree` on every pending row whose label
  and model decode are the same token-for-token — **2,896 rows**, leaving **842** disagreements for
  a human, and it first carries the 201 hand-read `b8-audit` verdicts across (the build-time
  carry-over predated them). The evidence for the rule and its two caveats are in
  [../METRICS-CORPUS.md](../METRICS-CORPUS.md); the short version is that agreement was right on
  **94%** of the rows a human has read and disagreement on **45%**.
  ⚠ **A draft is not a read.** The review UI's **🤖 auto-accepted (agree)** filter lists them
  **least-confident first** (by `min_logprob`) so the riskiest machine `ok` is on top; any human
  verdict clears the 🤖 marker. A `.csv.bak-agree` backup sits beside the queue.
- ⚠ **Promoting is not a re-run of the old promotes.** `strips_nota` / `strips_r1` / `strips_tup` are
  untouched on disk, and **1,442 human `fix` labels do not carry themselves**. 951 are recoverable
  (445 land on an accepted strip covering the same measures, 506 sit in `b8-review`).
- ⛔ **CARRY BY MEASURE SPAN (`page`, `from`, `to`) — NEVER BY FILENAME.** 248 of those fixes match a
  new strip's *name* while covering different music. This is the standing re-slice trap, now with a
  number on it.
- ⚠ **`b8-full`'s `decoded` column needed a code change to be honest.** `build_full_audit` had the
  strip root hardcoded to `data/real/strips` — the retired slicer, whose caches also hold a July
  `rung3-labeler` decode. For a b8 tab that would have seeded the edit box from another model's read
  of a *different* crop, silently. `FULL_AUDITS` entries now take an optional third field, the strip
  root; the four older full-audit queues keep the old default unchanged.
- ⚠ **TRAINING ONLY.** Nothing here may become exam gold — these pieces are the training side by
  construction (the 45 exam pieces were excluded by `--testset`).

### ⏭ `examv3` — the exam, re-cut whole (2026-08-21)

**Why it exists.** It is the labelling that **blocks the Round-3 read**. It began as a growth queue
over the 21 exam pages we own but never graded; it became a **rebuild of the entire exam** when the
first strip the owner opened showed that no exam page had ever been re-sliced ([README.md § The exam — freezing an honest test set (Steps 2 and 3)](README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3)).

**What is in it.** **663 rows over 64 of the 67 pages**, plus `examv3-full` with the **139** strips
the emitter labelled by itself. **185 rows arrive with text already in the edit box** — the frozen
exam's own gold, moved onto the crop holding the same music, or a correction typed against the
superseded first cut. Composition, the gold-carry table and the harder-instrument caveat:
[METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument).

⭐ **It reads its OWN crop root, `data/real/strips_examv3`.** A separate root is what made the
re-slice safe: the emitter slices in place, and the crops under `data/real/strips` are hardlinked
into `strips_exam_v2_clean/`, so re-slicing there would have rewritten the pixels the **frozen
exam's** gold describes. Verified after every run: all 1,026 crops on the graded pages byte-identical.

⛔ **Two superseded cuts are kept and must not be labelled**: `strips_exam_v3_oldgeom` (the first cut,
on retired-slicer crops — 24% of its rows under 400 px against 4% now) and `strips_exam_v3_growthonly`
(the 214-row growth queue, before the owner chose a rebuild).

```bash
.venv-ml/bin/python ml/labels/build_exam_v3_queue.py --plan      # prints the emit command
#   … run it: re-slices + decodes all 67 pages into data/real/strips_examv3 …
.venv-ml/bin/python ml/labels/build_exam_v3_queue.py --rebuild   # -> the examv3 queue
.venv-ml/bin/python ml/labels/review_ui.py                       # label the `examv3` tab
.venv-ml/bin/python ml/labels/promote_labels.py \
    --dir data/real/rung3/strips_exam_v3 --exam \
    --strips-root data/real/strips_examv3                            # verdicts -> exam gold
```

⏭ **The order to label it in, and the stopping rule** (reviewed 2026-08-21, owner accepted):

1. ✅ **`examv3-full` — DONE 2026-08-21, all 139 read.** 120 `ok`, 18 `fix`, 1 `bad` = **13.7%
   wrong**, against exam v2's **51%** on the identical queue. ⭐ **7 of the 18 fixes were one bug**,
   not seven: `\komaSharp` → `\kucukSharp` inside `\sig … \sigend`, all in one makam — the
   model-voted signature override ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). The rest is 12
   repeat/tie marks and 3 durations.
2. ✅ **The 27 `gold_conflict` rows — DONE 2026-08-21: 14 `ok`, 13 `fix`.** The fresh derivation won
   more often than the carried gold, and 3 more signature bugs fell out of the 13 fixes
   ([METRICS-EXAM.md § Metrics — the exam as an INSTRUMENT](../METRICS-EXAM.md#metrics--the-exam-as-an-instrument)).
3. ✅ **DONE 2026-08-31 — all 663 verdicted, all 64 pages PAGE-COMPLETE** (573 fix / 61 bad /
   29 ok). Read page-complete throughout, which is what the per-page primary requires. ⏭ What is left
   is the promote command below and the `round2-stage2-best` re-score.

- ⚠ **`--strips-root data/real/strips_examv3` on the promote step is not optional.** The default root
  holds the same filenames with the retired slicer's pixels, so the default links the wrong pictures.
- ⚠ **A SUGGESTION IS NOT A VERDICT.** The carried gold sits in `corrected_label` with the row still
  pending, so `e` opens the editor with it already typed. It is confirmed against the new picture,
  never promoted unseen — a label written against a crop that cut a beamed group in half is a reading
  of a truncated picture.
- ⛔ **THE VIEWER USED TO HIDE THAT SUGGESTION AND SAVE IT ANYWAY — fixed 2026-08-21** after the owner
  reported it (*"when I click to ok, it saves something different than label"*). Three faults, all
  landing on the `gold_conflict` rows: the queue builder wrote them with an **empty `decoded`** though
  the page's `_decode.json` had it, so the viewer fell back to a label-only panel with no decode to
  compare; a **pending** suggestion was never drawn, because `corrHtml` only rendered for verdicted
  rows; and **`ok` posted `corrected_label`**, storing text that had never been on screen — on 12 rows,
  two of them a different measure's music. Now the suggestion is drawn and diffed under a header
  saying `ok` will not take it, `ok` clears it (a human correction always arrives as `fix`), and the
  builder copies the decode. ⚠ Exam gold was never at risk: `promote_labels.py` reads `corrected_label`
  **only** when the verdict is `fix`. The 12 strings were cleared and the 27 decodes backfilled;
  `emit_review.csv.bak-20260821` is the before-state.
- ⚠ **`gold_conflict` (27 rows) is where a hand correction and a fresh SymbTr derivation disagree**
  on the same music. Read those first; the first one examined is a `\tie` the gold has and the new
  label does not, with the arc plainly drawn in the crop.
- ⚠ **EXAM GOLD, NOT TRAINING.** Every row carries `exam=1`, which `promote_labels.py` refuses to
  promote into a training manifest.
- ⚠ **Attend to the picture.** 329 of the 663 rows are `row_unaligned` and carry no label at all —
  the edit box starts from the model's decode, and `ok` must mean "I looked and it was right".
- ⭐ **WATCH THE `w00` STRIPS — that is where the signature bug lives.** The key signature is the one
  part of a label the model decides rather than SymbTr, and it overwrote the derivation on **24 of the
  45 exam pieces**. A signature is identical on every row of a piece, so **checking one `w00` strip per
  piece settles all of them** — 36 pieces carry a signature, not 663 rows. Start with the 8 that
  disagree with our makam table ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)): huseyni, nikriz,
  segah, three mahur pieces, muhayyerkurdi, sehnaz.
- ⛔ ~~**THAT DECODE STAYS ON `rung3-labeler`, AND IT IS NOT UPGRADED** (owner, 2026-08-21)~~ **OVERTURNED 2026-08-23 (owner): the hint IS upgraded to `round2-stage2-best`; the LABEL is not.** Only the `decoded` column moved — `emit_strip_labels.py` was not re-run, so the derived `label` and its model-voted `\sig` are still the July model's, not a graded model's. Why the reversal: a bad hint *causes reader errors* that land in the gold too, which the reasoning below never priced. Measured on the 214 rows already verified here — **223 → 150 token edits (−33%)**, **48% → 63% exact rows** — and that test is biased toward the labeler, since those rows were read with its hint on screen. All 576 refreshed rows carry `redecoded=1` so the read can report the primary with and without them ([../DECISIONS.md](../DECISIONS.md)). Original reasoning kept, because the LABEL half still rests on it: A better
  hint would save keystrokes here — `round2-stage2-best` reads far better — but it is the **baseline
  column** re-scored on this exam, so seeding gold from its decode anchors the answer key toward it:
  an error you do not catch becomes "correct", and it is that model's error. The July model's errors
  are uncorrelated with either graded model, so they are **noise, not bias**, and a one-shot read
  survives noise. The training pools take the better hint instead ([../STATUS.md](../STATUS.md) B8);
  real-val already has it, because real-val selects and does not grade.
- ⚠ **Preconditions of the read**: finish before the model takes it, and **re-score
  `round2-stage2-best` on the rebuilt exam** — now doubly binding, since the instrument changed
  ([README.md § The exam — freezing an honest test set (Steps 2 and 3)](README.md#the-exam--freezing-an-honest-test-set-steps-2-and-3), [rounds.md § Round-3 criteria — the pre-registration, and the tuplet A/B protocol](../archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol) §3b).
- ⏭ Promotion grows `strips_exam_v3/manifest.jsonl`. That manifest **replaces** `strips_exam_v2_clean`
  as the exam; the old one stays on disk as the record of what Round 2 was measured on.


## The real-val labelling queues — realval-hard, and the 2026-09-09 repair

*Was `docs/rung3/labeling.md` (last updated 2026-09-09).*

> Split out of [labeling.md § The labelling queues — reslice-all, the batches, b8 and examv3](#the-labelling-queues--reslice-all-the-batches-b8-and-examv3) on 2026-09-09 at the 400-line cap. That file
> keeps the queues feeding the **training pools and the exam** (`reslice-all`, the batches, `b8`,
> `examv3`); this one keeps the queues feeding **real-val**, which selects and does not grade.
> Current state and next action are NOT here: [../STATUS.md](../STATUS.md).

---

### The `realval-hard` queue (2026-07-28) — labelling the practice test's missing hard tier

**Why it exists.** Real-val reads ~96% where the exam reads 74%, and the cause is measured:
composition. The exam is 18% easy / 41% mid / **41% hard**; real-val is 59 / 41 / **0**. A practice
test with no hard questions cannot rank candidates, which is why every round so far has been a blind
one-shot. Rebuilding it is item 1 in [../STATUS.md](../STATUS.md).

**Why it cannot be done by filtering.** "Hard" means the emitter refused the strip for
`row_unaligned` or `nd_high` — those are **drops, not reviews**, so no label was ever written
(6,168 in the nota pool alone, 13,975 across all pools). The exam has 145 hard strips only because
they were recovered and hand-labelled one at a time. There is no pile to draw from.

**The queue.** `ml/labels/build_realval_v2.py --queue N` selects candidates that are on the
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

Run: `.venv-ml/bin/python ml/labels/review_ui.py` → queue **`realval-hard-v2`**. Images resolve
from `data/real/strips_v2/<page>/<strip>`. Progress and the target mix:
`build_realval_v2.py --report`.

#### ⛔ The `realval-repair` queue (2026-09-09) — 10 rows whose label is about other music

**What went wrong.** `build_realval_v2.py --build` carries rows out of the previous `_realval` pool
and copies `strip_root`'s crop under them. That pool is entirely on the **retired** root (271 of
271 PNGs), so 157 carried rows got a `strips_v2` crop under a label read against a `strips` crop,
with no measure-span check between them. The 5 duplicate manifest rows in
[../BACKLOG.md](../BACKLOG.md) item 2 were the visible tip. Every number, and the control that
proves it: [METRICS-SLICER.md § Crop roots — which slicer cut which pool, and what a re-slice costs](../METRICS-SLICER.md#crop-roots--which-slicer-cut-which-pool-and-what-a-re-slice-costs).

⚠ **This is the same trap the paragraph above warns about**, arriving through the builder rather
than through a queue — `QUEUE_IMG_ROOTS` binds a *reviewer's* pictures to the right root, and
nothing bound the *builder's*.

**The queue.** `ml/labels/repair_realval_v2.py --queue` writes the **10 rows** whose measure
span moved between the two roots — the ones no re-home could rescue. 243 rows keep their label,
5 duplicate twins are dropped, 3 are re-homed onto the `strips_v2` strip carrying the same span.

- ⛔ **Rows carry NO `label`, on purpose.** The carried label is the string under suspicion;
  showing it as gold would anchor the read to exactly what the repair exists to retire. The
  verdict is against the **picture**, like `realval-hard-v2` and `photo-gold`.
- `decoded` is the **current** root's `round2-stage2-best` decode with the retired `\tie` stripped
  (`merge_redecode_into_queue.drop_ties`). Seeding real-val from that model is its standing
  exception — real-val **selects** and does not grade ([../../CLAUDE.md](../../CLAUDE.md)).
- ⚠ **No tail-accept here.** Ten rows is the whole queue; `--build` refuses while any is unverdicted.

✅ **READ AND BUILT 2026-09-16** — 2 `bad`, 8 `fix`, and no answer matched its old label;
`_realval_v2r` holds 260 strips ([METRICS-SLICER.md § Crop roots — which slicer cut which pool, and what a re-slice costs](../METRICS-SLICER.md#crop-roots--which-slicer-cut-which-pool-and-what-a-re-slice-costs)).

Run: `review_ui.py` → queue **`realval-repair`**, then
`repair_realval_v2.py --build` to assemble `_realval_v2r`. ⚠ `_realval_v2` is left **intact** —
every Round-3 number was measured on it.
