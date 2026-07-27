# Round 2 — photo axis, the sharp fix, and what is still open

purpose: the current round: what was measured, what was fixed at source, what remains
audience: agents and the owner working the real-page track
updated: 2026-07-27

## Result — exam read once, 2026-07-27: SHIPPED as an improvement, not a pass

**Headline regressed, everything else improved.** On the identical 326-strip clean set with the
same re-audited gold: mean AEU F1 **78.0 → 73.9%**, while SER (0.059 → 0.052), exact-match
(50.0 → 52.1%) and 9 of the 11 pre-registered floors moved the right way. Numbers, floors table and
the print-position split: [../METRICS.md](../METRICS.md).

**The diagnosis was right; the correction was incomplete.**

- Removing the label noise did what it was supposed to: the one-directional küçük→koma fallback is
  **gone**, and küçük-in-signature recall went **50 → 72%**.
- Underneath it sits a **symmetric koma↔küçük confusion, entirely inside the key signature** —
  `\kucukSharp → \komaSharp` 8×, `\komaSharp → \kucukSharp` 7×, all 15 in the `\sig` block, net
  `\komaSharp` emission 0. That is a discrimination failure, not a bias.
- It destroys `\komaSharp` (F1 21.4%) because n=14, and a per-class mean over six classes carries
  that straight into the headline. `\kucukSharp`, with 33 gold, absorbs the same coin flip and still
  reads 69.7%.
- **The lead for Round 3:** every fidelity measurement so far — `sharp_probe`, bar weight, the küçük
  pitch widened to 0.65 S — was taken on INLINE glyphs. Signature glyphs are packed at
  `SIG_GLYPH_ADVANCE = 13 px` and have never been examined, and that is where 32 of the exam's 33
  küçük tokens are printed.

Attribution caveat, stated before the run and still binding: this round changed the glyph weight AND
removed the label noise AND added pieces, so no single one of them owns the movement.

### Post-read analysis (2026-07-27) — what Round 3 should actually target

Re-scoring and an edit-budget breakdown changed both the verdict and the direction. Full numbers in
[../METRICS.md](../METRICS.md); the short version:

- **Round 2 was never a regression.** Under low-n-robust headlines it is flat-to-better (micro recall
  83.9 → 84.8%, macro≥30 recall 81.4 → 84.8%). The −4pp was `\komaSharp` (n=14) inside a six-class
  mean. The not-shipped decision is overturned.
- **Accidentals are 13% of what a user fixes.** Pitch 40%, duration 28%. Two rounds went into the
  13%, because the old headline only measured accidentals.
- **12 strips carry 21% of all edits**, and the worst are a crop-shape gap: signature-only crops
  occur 0 times in 40,826 training strips but 4 times in 326 exam strips.
- **Gold octave errors are real but ~1% of edits**, and the training pools are clean — closed as a
  non-lever rather than left as a suspicion.

So Round 3 is a **pitch-and-duration** round, opening with the crop-shape fix (no training needed)
and a corpus-vs-real distribution measurement before anything is rendered. The signature-glyph
fidelity work stays owed but drops below both, being a 13%-of-edits problem.

### Ship (2026-07-27) — `round2-stage2-best` int8 is the live runtime

The re-scoring reopened the ship decision and the owner took it: same disposition as Round 1, an
**improvement ship, not a pass** — the macro floor is still failed, and that is written down rather
than rounded up ([../DECISIONS.md](../DECISIONS.md)).

Chain, all green: ONNX export → int8 (221 MB) → `onnx_parity.py` **14/14 fp32 + 14/14 int8** →
`make_browser_gate.py` → browser gate **27/28**, with the product (canvas) path a clean 14/14. The
gate list was rebuilt from `strips_v4` **val** pieces because the Colab checkpoint arrived without
one. Export details, the gate-strip method and the one failing strip: [../METRICS.md](../METRICS.md)
and `../../src/vision/MODEL_EVAL.md`.

**Carried forward, not fixed:** the browser miss is an ORT-web wasm int8 numerics wobble (Python-ORT
int8 reads the same strip exactly). It is now the second instance — Round 1's was a double dot, this
one drops a `\tup3` — so the open investigation gains a second case. Round 1's double-dot strip
passes on this model.

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

## Entry plan (decided 2026-07-23, after the Round-1 disposition in [round1.md](round1.md))

**Round 2 starts with two cheap checks that could change our whole direction — so we do them first:**

1. **Photo test (free, could change everything).** Real users take phone photos (shadows, angles,
   blur), but every score so far is from clean PDF pages. Print the merged exam pages
   (`00_ALL_25_MERGED.pdf`), photograph them (see the photo-exam section below), and run the model. If the photo score is
   far below 66%, the real bottleneck is handling messy photos — not reading the note-marks — and our
   current plan is aimed at the wrong problem.
2. **Rebuild our everyday score (the quick check we call "real-val").** It said 95%, but the real exam
   said 66% — the everyday score was lying, because it only used easy pages while the exam has ~41%
   hard ones. This is just a re-split of pages, not new labeling. Until it's fixed, every Round-2
   choice rests on a number that lies. Rule from now on: the everyday score can *rank* two models
   against each other, but it does NOT predict the real exam score.

> **Added 2026-07-23 (details in [round1.md](round1.md), plan-review addenda):** before those two checks, a few free tasks run first —
> split the 66-vs-95 gap by page difficulty (to learn whether the rebuilt everyday score also needs
> different *editions* of pieces, not just harder pages); add a safety check that refuses to train if
> an exam piece leaks into training; write the rule for how shared hard pages get split; and run the
> "blur test" on the current everyday score. The photo test also reports two separate numbers: how
> many strips it could even line up, and the accuracy on those.

**Then, once those checks land, the training work** (all still open, and clearer after the checks):
- ⛔ **The "invented mark" bug — DROPPED as a Round-2 priority (user decision, 2026-07-25).** It was
  listed here as "the fastest model fix": the model adds flat-family marks that aren't printed (worst
  on 'si'), and it reproduces on synthetic data. Dropped because the evidence moved: on the
  hand-labelled photo gold and the corrected clean gold the **flat family is now healthy**
  (`\kucukFlat` F1 92%, `\bakiyeFlat` 89%, `\natural` 89%), and the degrade probe ([round1.md](round1.md), addenda item 4)
  showed the hallucination is not ambiguity-driven, so a renderer fix was never the lever. The whole
  remaining accidental weakness sits in the **microtonal SHARPS**. Kept only as a logged synthetic
  defect (`MODEL_EVAL.md` "carry-bug"), not scheduled work.
- **✅ Sharp-size discrimination DIAGNOSED + FIXED AT SOURCE (2026-07-26) — it was a RENDERER
  FIDELITY bug, not resolution and not teaching volume.** `\komaSharp` F1 ~50% and `\kucukSharp`
  recall 48% at **100% precision** — the model UNDER-fires the small sharps, so it was failing to
  *see* the difference, not failing to be careful. Diagnosis, in order:
  - **Resolution RULED OUT.** `scripts/rung3/sharp_width_test.py` regroups the already-scored strips
    by the encoder's effective scale (DonutImageProcessor `align_long_axis → thumbnail → pad` into
    409×583; strips are 336px tall and 579–2472 wide, so the scale runs 1.22 → 0.24). If shrinking
    were the cause, recall would fall with scale. It does not, on EITHER dataset: clean-exam
    koma/kucuk are 62/67% at scale 0.45–0.60 vs 50/53% at 0.60+, and photo gold has the same shape.
    `\bakiyeSharp` sits at 84–94% in **every** bucket — the deficit follows the SYMBOL, not the size.
    So narrowing strips (the expensive lever) would not have helped. *(Logged, not chased: ~⅔ of the
    encoder's input window is blank padding, because a 4:1 strip fits a 1.43:1 box.)*
  - **The error is ONE substitution, one-directional:** gold `\kucukSharp` decoded as `\komaSharp`
    **11× on the clean exam and 10× on the photo strips** — the single most common error in both, and
    koma→kucuk essentially never happens. That matches the 100%-precision signature exactly: when
    unsure, fall back to the class seen 9× more often.
  - **Root cause = Bravura's glyph weight.** The AEU sharps are ONE systematic design — 1–2 vertical
    stems crossed by 2–3 slanted bars — so reading them IS counting bars. Measured against two real
    printed editions at matched staff size (`data/real/rung3/sharp_probe/`): real print draws a
    **0.300 S** bar, Bravura **0.367 S**, and Bravura also packs küçük's three bars **0.483 S** apart
    where real print leaves **0.550 S**. Compounded, Bravura leaves küçük a **0.116 S** white gap vs
    the real **0.250 S** — ~1–2px after the encoder shrink, so the three bars fuse into a block and
    the glyph *is* a 2-bar koma. koma/bakiye were never at risk (0.58–0.66 S gaps). Real print also
    draws küçük's top/bottom bars stubby (0.73 S) either side of a full-width middle bar, where
    Bravura's three are near-equal — which is what kills the staircase a reader recognises.
  - **FIX SHIPPED (opt-in): `drawThinSharps` in `SheetView.tsx`** redraws all four AEU sharps as SVG
    at real-print bar weight (0.300 S), keeping each glyph's Bravura proportions so the shapes stay
    familiar. Applied to all four, not just the broken one, so **bar COUNT stays the only
    difference** — thinning küçük alone would hand the model a thickness cue real pages lack.
    küçük's pitch is set to **0.65 S**, deliberately wider than the real 0.550 S (domain-expert call
    off `sharp_probe/kucuk_pitch_options.png`) to clear the shrink with margin while staying far from
    koma's 0.94 S. Wired as `?thinsharps=1` (App.tsx) and `--thin-sharps` (render.ts), **off by
    default so an A/B against `strips_v3` stays possible.** Flats untouched (89–92%, healthy).
    Verified in-browser: every AEU sharp replaced, 0 left on Bravura. Residual: büyük keeps a 0.21 S
    gap (its 0.51 S pitch is Bravura's) — n=3 in the exam, revisit only if it shows up.
  - **⛔ The "FREQUENCY imbalance" follow-up was aimed at the wrong context — corrected 2026-07-26.**
    It read: inline, `strips_v3` has `\komaSharp` in 1,887 strips vs `\kucukSharp` in 206, zero
    strips carry both, so balance the counts and put the three sharps on neighbouring notes. All
    true, and all about a context the exam barely contains. Splitting every gold label by print
    position (numbers in [../METRICS.md](../METRICS.md)) shows küçük is scored **32:1 inside the
    row-start key signature**, and the carry serializer's `sigTolerant` rule explains why: a note
    whose alteration runs the same direction as the signature's is printed **bare**, because SymbTr
    stores the sounding value (eviç = a 5-comma F♯ printed bare under a koma-sharp-F signature).
    Confirmed by dry render — two küçük-heavy pieces under non-küçük signature variants produced
    **zero** inline `\kucukSharp`. In the signature context the corpus is already balanced (küçük
    1,210 strips vs koma 1,422).
  - **✅ AND A SECOND CAUSE, found the same day: the carry pages drew accidentals their labels did
    not mark.** `sigTolerant` lived on the label side only, so `SheetView` marked every deviation
    from the signature while the serializer wrote the note bare. **18.8% of v3's signature-bearing
    carry strips** are affected, worst of all `\kucukSharp`: **2,369 drawn-but-unlabelled against 234
    labelled correctly — 91% of the küçük sharps drawn on a notehead were labelled as nothing.**
    Training on that teaches exactly the observed behaviour (48% recall at 100% precision). Fixed by
    giving the drawing the same rule — owner decision, because real editions print bare. Counts in
    [../METRICS.md](../METRICS.md). `round1-best` trained on the un-fixed corpus, so its sharp
    numbers carry label noise as well as glyph weight, and nothing measured so far separates them.
  - **What replaces it:** the corpus gap is **diversity, not count** — signature-position küçük
    comes from only 3 makams (mahur, nisaburek, süzidilara) in 4 spellings, so the model can learn
    "this makam ⇒ this donanım" instead of reading the glyph. Round 2 therefore re-renders with
    `--thin-sharps` (the glyph fix helps both print positions), adds küçük-bearing pieces, and
    adds küçük-bearing pieces. The Round-1-era "boost komaSharp share" item stays overturned; the
    enharmonic-respell idea was dropped before use (see [../DECISIONS.md](../DECISIONS.md)).
    A generated signature-drill set was also **dropped**: across every adjudicated real signature we
    hold, `\kucukSharp` appears on **f and nowhere else** (104 occurrences), so a drill would have to
    print accidental/letter pairs no edition prints.
  - **✅ `strips_v4` BUILT (2026-07-26)** — 40,841 strips / 202 pieces, thin sharps + the pixels-vs-
    labels fix + 23 küçük-bearing pieces − 5 exam pieces; audit PASS, Mac train smoke PASS; val is
    `split_v3`'s verbatim so the v3 A/B stays matched. Sizes in [../METRICS.md](../METRICS.md).
  - **✅ Scorers now split recall by print position** (`score_photo_gold.py`,
    `score_clean_baseline.py` via `score_photos_exam.tally`): on the photo gold küçük reads **50% in
    the signature** (22 gold) where `\bakiyeSharp` reads 83% in the same position — the deficit
    follows the glyph, not the position. Headline unchanged (73.7% / 75.9%), so the split is
    additive.
- **Recover the hard pages we had to drop** — many real strips were dropped earlier because the old
  reading model couldn't line them up. The Round-1 model reads better, so it can recover them into
  training. This is our biggest source of new data. It needs human checking, our slowest step, so
  start it early.
- **A refreshed exam ("v3")** — with the safety check built in and better coverage of the rarest
  marks, built from the cleaned exam pages.

**Safety fixes the new exam owes** (because Round 1's exam accidentally shared 4 pieces with
training): (a) make training refuse to start if any training piece is also an exam piece; (b) re-check
this every time the exam or the page collection grows; (c) match pieces by their music ID, not the
image file name.

**Other paths we considered but did NOT pick as the main plan** (kept as backups if the checks or
Round 2 stall): collect many more pages from new sources; pivot the product toward "model drafts, a
human quickly fixes" (66% plus a fast editor may beat chasing 85% fully automatic); or reconsider the
whole model approach (only if another round barely moves the number).

### Step 4.5 — Photo-exam axis (second, product-domain exam; zero labeling cost)

> **DONE 2026-07-24..25 (results).** 39 photos shot. **The slicer, not the model, was the wall:** raw
> `page_to_strips.py` yielded 0 strips on 72% of photos — its `w/4` staff-detection kernel can't
> tolerate ~1.5° handheld skew. Fixed with a guarded photo front-end (all no-ops on clean scans):
> **auto-deskew + crop-to-quad/perspective de-warp + a narrower `STAFF_HOR_FRAC=0.11` detection kernel**
> (the old `w/4` had been silently dropping faint/bottom systems on clean renders too). **Yield 28% →
> 97% of pages / 106 → 690 strips.** Photo AEU ≈ **61% recall / 75% F1** (`scripts/rung3/
> decode_photos_exam.py` + `score_photos_exam.py`; 690 strips decoded on the M4 in ~6 min — Colab
> unneeded), first scored by fitting the curated gold onto the photo decode (an estimate). **Then the
> expert HAND-LABELLED 284 photo strips directly** (review_ui `photo-gold`; stopped there — enough to
> measure + many photos unreadable even to a human, 4% marked bad) and `score_photo_gold.py` scored
> the model against those verified labels, strict per-strip: **photo AEU recall 73.7% / F1 75.9%** (272
> scorable) — the definitive number, HIGHER than the fitting estimate (which under-counted recall).
> **Photo vs corrected-clean (~77%) gap ≈ 3–4pp → photo domain basically solved by the front-end.** The
> real weakness is MICROTONAL SHARPS (komaSharp F1 50%, kucukSharp rec 48%/prec 100% — under-fires,
> reads them as bakiye/koma), a CLEAN-domain reading issue; `|`/`\tie` are fine (90/94% F1, NOT the
> problem). → next model lever = synthetic re-render weighted toward koma/kucuk/bakiye sharp
> discrimination, not more photo labels. Aside: ~15% of TSM measures are single-but-dense >59 tokens
> (same on clean+photo — inherent density, not over-wide slicing; model reads them, 0 truncated).

> **The 284 hand-labelled photo strips stay EXAM-ONLY (settled 2026-07-25).** They are shots of the
> printed exam pieces, so training on them contaminates the exam (the train-time guard would refuse
> to start). Frozen as the photo half of exam v3. Camera-photo TRAINING data must be shot fresh from
> NON-exam pieces.

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
