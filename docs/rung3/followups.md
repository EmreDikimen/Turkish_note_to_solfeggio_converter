# Follow-ups — the correction loop, parked ideas, watch-items, data layout

purpose: work that is scheduled later or deliberately parked, plus standing hazards
audience: agents and the owner working the real-page track
updated: 2026-07-20

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

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
split the window at a gutter/barline and re-decode each half — converts the [labeling.md](labeling.md) §1c budget analysis
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
  rare-accidental and slur-distractor boosts. **→ REAL-DATA SIDE ADDRESSED same day, [labeling.md](labeling.md) §1c:**
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
