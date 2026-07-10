# Inference pipeline — from a full uploaded image to editable notes

> The model is trained on **short strips** (2–4 measures, ~583×409 — see `docs/PHASE2.md` §3),
> but users upload **whole pages** (like the neyzen.com Uşşak şarkı sheet). This doc explains how
> the two meet: the page is sliced into the same kind of strips the model was trained on, each
> strip is decoded independently, and the token streams are stitched back together. It is the
> design for ROADMAP §2's `Preprocess → Staff isolation` stages and Phase 4 / Rung 4 wiring —
> the parts of the product that are **not yet built** (everything model-side already exists and
> passed its gates). Also covered: the Rung-3 real-photo collection plan.

## 0. The one-line answer to "how does a page become strips?"

Classical CV, not ML: staff lines and barlines are the two easiest structures on a music page to
detect geometrically. Staff lines give the **rows**, barlines give the **measure boundaries**,
and grouping 2–3 measures per window reproduces the training-strip shape. The `|` barline token
was kept in the labels for exactly this moment: each decoded barline re-anchors measure
reconstruction, so one bad strip corrupts one measure run, not the whole page.

## 1. Stage by stage

```
Upload (PNG/JPEG page)
  1 → [Input profile]        screenshot (majority) vs camera photo
  2 → [Preprocess]           grayscale, denoise; photos only: deskew/perspective from staff lines
  3 → [Staff detection]      horizontal ink projection → 5-line groups → row bands
  4 → [Scale normalization]  rescale each row so staff height matches the training engraving
  5 → [Barline detection]    vertical runs spanning the 5 lines → measure boxes
  6 → [Windowing]            2–3 measures per crop, training-like width; row starts keep clef+sig
  7 → [Per-strip decode]     Donut preprocess → ONNX encoder → JS greedy loop (Rung-1.5 machinery)
  8 → [Stitching]            concatenate per row; \sig resolution; expand repeats/voltas/D.C.
  9 → [Header metadata]      OCR makam/usul/tempo (separate; NOT the OMR model); user-editable
 10 → [Note model]           → editor → 53-TET playback (existing Phase-1 product)
```

**1. Input profile.** Real uploads are mostly **web screenshots** (clean geometry, flat white —
the reason `augment.py` trains screenshot-dominant at `PHOTO_SHARE = 0.35`). Screenshots skip most
of step 2; camera photos take the full correction path.

**2. Preprocess (OpenCV-in-JS / canvas).** Grayscale + light denoise. Photos additionally:
estimate skew/perspective from the staff lines themselves (fit lines to the long horizontal ink
runs; a homography from their intersections flattens the page), then binarize adaptively
(lighting gradients). Keep it conservative — the model was trained on augmented-but-intact
glyphs, not on aggressive binarization artifacts.

**3. Staff/system detection → row bands.** A horizontal ink-projection profile makes every staff
stand out as 5 sharp, evenly spaced peaks; group each cluster of 5 into one system (the Uşşak
example page yields 9). Extend each system into a vertical crop band with the training crop's
proportions: headroom above the top line (beams, voltas, segno/coda marks — the strip renderer
uses ~46px above the top line at engraving scale) and room below for stems + the lyric zone.
This is the step ROADMAP §5 flags as the weak link for curved/shadowed phone photos — for
screenshots it is near-trivial.

**4. Scale normalization — the step that silently decides accuracy.** Training strips are all
engraved at ONE VexFlow scale, then resized by the model's preprocessor. The model has never seen
a staff at any other relative size. So before slicing, rescale each row so its staff height
(top line → bottom line, known exactly from step 3) matches the training staff height. Getting
this wrong doesn't error — it just quietly halves accuracy.

**5. Barline detection → measure boxes.** Barlines = near-vertical dark runs that span exactly
the 5 staff lines (tolerances for thickness/repeat-dots). This substitutes for what training had
for free (SheetView's per-measure layout rectangles). On screenshots this is near-perfect; on
photos, work row-by-row after deskew.

**6. Windowing.** Group consecutive measures into windows whose *width* (post-normalization)
falls inside the training strips' width distribution — the inference-side analog of
`docToStrips`' token budget, which can't be computed before decoding. The first window of each
row includes the clef + key signature and becomes the `\sig … \sigend` carrier, exactly like the
keysig-mode training strips; later windows are the clef-less mid-row crops the faithful label
scheme was designed for. **Fallback** if barline detection proves unreliable on bad photos: a
sliding window with ~1 measure of overlap, deduplicating by aligning the overlapping decoded
tokens. Build the barline version first.

**7. Per-strip decode.** Exactly the proven Rung-1.5 stack: Donut preprocessing (JS port),
ONNX encoder + decoder-with-past via `onnxruntime-web`, hand-rolled greedy loop — ~1.5 s/strip
on the dev Mac, model weights from the HF Hub CDN, no server. A 9-row page ≈ 18–25 strips;
strips are independent → sequential with a progress bar, or parallel workers.

**8. Stitching → written skeleton.** Concatenate each row's strips in order, rows in order.
Apply the row's decoded `\sig` block (or the makam's per-degree defaults) to resolve **bare**
notes; explicit accidental/`\natural` tokens override — this is Phase 4's "written skeleton"
layer (ROADMAP Phase 4, two resolution layers). Then expand structure: `\repstart … \repend`
plays twice, voltas take ending 1 then 2, and the navigation marks (`\dc` `\segno` `\coda`
`\fine`) drive the da-capo expansion — D.C. jumps to the head, ⊕→⊕ takes the coda jump, "Son"
ends the form. Output is FLATTENED (sections written out, no signs) — what the editor and
playback want.

**9. Header metadata — never through the OMR model.** Makam/usul/tempo/title come from a
separate OCR pass over the header text (plus signature+note-distribution heuristics as
fallback), feed the makam intonation table (written accidental → sounding koma, e.g. Uşşak's
koma-flat si sounding as 2-koma), and stay **user-editable** with `none` = play-as-written.

**10. Note model → editor → playback.** The existing Phase-1 product. The editor is the safety
net for every residual OMR error — and (see §3) the labeling tool for Rung 3.

## 2. What each training-set feature buys at inference

| Training feature (strips_v2 / v2.1 / v2.2) | Inference stage it serves |
|---|---|
| 8 AEU accidental tokens + `\natural` | the product's whole point (stage 8) |
| `\sig … \sigend` on row-start strips | makam-independent signature reading (stages 6, 8) |
| `\|` kept in labels | measure re-anchoring during stitching (stage 8) |
| `\repstart` `\repend` `\volta1` `\volta2` | repeat/volta expansion (stage 8) |
| `\segno` `\coda` `\dc` `\fine` (v2.1) | da-capo/coda navigation expansion (stage 8) |
| `\tup3 … \tupend`, `\tie`, `\grace` (v2.2) | correct rhythms; stage 8 merges `x \tie x` into one event and attaches graces to their host note |
| header/footer text noise in crops | model ignores titles, "SAZ", "Aranağme", lyrics… (stage 7) |
| screenshot-dominant augmentation | robustness to the real upload distribution (stages 1–2) |
| transposes −9…+9 commas | pitch/position invariance across real keys (stage 7) |

The rhythm-sign tokens now reach inference: the **Rung-2.2 retrain shipped** (ONNX export PASS
2026-07-08), and the **Rung-2.2b stem-fix + triplet-expansion retrain** (ONNX export PASS
2026-07-09) fixed the real-image triplet misread — `rung22-stemfix-best` is the runtime in
`apps/web/public/models/` (`src/vision/MODEL_EVAL.md`). Known NOT covered yet (graceful
failures — the editor catches them): **slurs** (melisma arcs; distinct from ties, still
unlabeled), **two stacked verse lines** (training lyrics are single-verse), tuplets other
than 3.

## 3. Rung 3 — collecting and labeling real photos

> **Status (2026-07-10): collection AUTOMATED + DONE for the engraved-PDF majority.**
> `scripts/collect_notalar.py` replaced hand-screenshotting: it crawls neyzen.com's freely-published
> archive (census of **8,442 pieces**), downloads PDFs **weighted by per-makam song count** (popular
> makams heavier, floor for variety), and rasterizes them to PNG pages. First pull: **798 PDFs →
> 1,259 page images across all 89 makams** in `data/real/`. These printed/engraved pages are the
> clean end of the screenshot-dominant distribution — camera photos remain a later, smaller
> validation set. `--nota` adds notaarsivleri.com (opt-in, best-effort). What follows (labeling) is
> unchanged; only the collecting got cheaper.

**Manual collection, model-assisted labeling.** "Manual" applied to *collecting* the images; that is
now scripted for the archive majority (above). *Labeling* them is mostly the model's job:

1. **Collect a few hundred images matching the upload distribution** (mostly screenshots, some
   phone photos): neyzen.com and similar archives viewed/screenshotted at various zoom levels and
   window sizes, plus phone photos of printed collections under honest conditions (desk lamp,
   slight tilt — not studio shots). Aim for spread over makams/signatures/engraving styles, not
   volume; ~200–400 images is the plan's scale, and **variety beats count**.
2. **Model-assisted labeling loop** (the reason Rung 2 comes first): run the fine-tuned model on
   each image through this very pipeline → the predicted notes land in the **editor** → correct
   the mistakes by hand (drag pitch/duration, fix accidentals) → save. The corrected note model
   serializes back to strip labels via the SAME serializer that made the synthetic labels
   (`tools/render/lilypond.ts`), so real and synthetic samples are format-identical. Correcting
   a mostly-right prediction is ~5–10× faster than transcribing from scratch, and every
   correction is exactly a case the model got wrong — the highest-value training signal.
3. **Fine-tune on the mix** (synthetic + real, real oversampled), still split **by piece**. Per
   the plan: this small real set matters more than any hyperparameter.
4. Images whose pieces exist in SymbTr are even cheaper: load the SymbTr score in the editor,
   align/verify against the photo, done — no note entry at all.

Where labeling effort goes first: images the model does WORST on (sort by its own uncertainty /
edit count). That's active learning with no extra infrastructure.

**Consent/copyright note:** collected images are training data for a local model, not
redistributed content; still, prefer public-archive scans (neyzen.com publishes freely) and your
own photos.

## 4. Build order (Rung 4, after Rung-2/3 training)

1. Barline + staff detection on **screenshots** (the easy 65%) → strips → decode → stitch:
   the end-to-end demo on a clean page like the Uşşak example.
2. The editor feed-in (decoded note model → editor), which simultaneously unlocks the Rung-3
   labeling loop (§3.2).
3. Photo preprocessing (deskew/perspective/curvature) — only then does the hard 35% matter.
4. Header OCR + makam table lookup (until then: user picks the makam, `none` default).
