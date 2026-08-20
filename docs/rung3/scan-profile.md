# The scan profile — Round 3's first trained arm (Lever 7): ⛔ NULL

purpose: the scan-augmentation arm in full — why it exists, what was built, the signed pre-registration, and the null it returned
audience: agents and the owner running or reading Round 3's arm 1

updated: 2026-08-19

> ⛔ **RESULT, 2026-08-19: the arm is a NULL on its primary and its no-regression clause passes.**
> On scanned pages, 197 paired strips: `best` **+0.071** edits/strip, 95% CI [−0.203, +0.335],
> p = 0.105; `last` **+0.010**, CI [−0.198, +0.208], p = 0.488. **Both checkpoints, same answer** —
> and the interval excludes anything better than a ~5% reduction, so this is an informative null
> rather than an underpowered one. Every number:
> [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md). The disposition is at the bottom of this
> file.
>
> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). The lever this serves is [levers.md](levers.md) Lever 7;
> Round 3's binding floors are [round3-criteria.md](round3-criteria.md) and **nothing here changes
> them**. Numbers: [../METRICS.md](../METRICS.md), [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

## The hole

[`src/vision/augment.py`](../../src/vision/augment.py) had exactly two profiles — `screenshot` and
`photo` — and **93% of the exam is scans** ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)). A flatbed
or office scan of a TRT-era print is neither: **flat lighting and no perspective**, so the photo
pipeline's most expensive ops model nothing that is there, while it *does* have speckle and dust,
broken thin lines, ink spread on thick strokes, bleed-through from the reverse side, a small skew
and threshold/halftone damage — none of which either profile drew. The module's own comment had
been asking for this since July: *"Revisit against real usage at Rung 3."*

⚠ **The trade, stated before the arm ran and accepted knowingly.** `PHOTO_SHARE` was set from the
owner's report that real uploads are mostly web screenshots, and the constant carries an explicit
warning against pushing the mix for "harder training". Aiming augmentation at scans optimises **the
exam**, and we do not know that the exam's medium is what the app's users upload (n = 2 —
[../METRICS-USAGE.md](../METRICS-USAGE.md)). So the scan profile is added **beside** the two, never
substituted, and the mix is pre-registered rather than tuned.

## What was built

`scan_share` (default **0.0 — OFF**) selects a third profile whose ops run in the order a scan
actually degrades, which is not the photo order:

| op | models | note |
|---|---|---|
| `bleed_through` | the reverse side ghosting through thin paper | mirrored, blurred, faded copy of the page's own ink |
| `paper_texture` at scan settings | near-neutral grey paper | flatter and cooler than the photo profile's beige |
| `ink_variation` | ink spread, or faded print | shared with the photo profile |
| `scan_skew` | the transport's residual skew | **±0.3°, not ±2°** — see the caveat below |
| `speckle_dust` | platen dust and sensor dropout | dark specks, light pinholes, a few larger motes |
| `line_dropout` | thin lines breaking into dashes | **thin ink only**, in runs — see below |
| `threshold_damage` | the scanner's own binarisation, drifting across the page | a soft sigmoid, never a hard 1-bit |
| `scanner` (albumentations) | fixed-focus blur, sensor noise, JPEG | milder than the camera pipeline |

Three design points that are load-bearing rather than incidental:

- **`line_dropout` erases THIN INK ONLY.** The mask is `dark − open(dark)` with a 3×3 element, so it
  contains staff lines, stems and flag edges and *cannot* contain a beam or a notehead — which is
  what keeps the op label-preserving. It erases in **runs of 3–10 px**, not single pixels: a
  per-pixel mask reads as noise on an intact line, while a real scan drops a few millimetres at a
  time. The gap is filled with the **local paper** (a dilation of the image), never with white.
- **±0.3° of skew, not the photo profile's ±2°.** Measured previously in this file's own history:
  over an 1,100 px strip one degree walks a staff line 19 px, and a ±1° rotation once pushed the
  share of synthetic strips too skewed for a staff-line detector from ~15% to 68%. The slicer also
  deskews a page before cutting, so only a small residual reaches strip level.
- **`threshold_damage` is soft.** A real 1-bit threshold destroys beam detail, and beam detail is
  duration. The op mixes a wandering sigmoid with the greyscale rather than replacing it.

⚠ **`--seed` does not make augmentation reproducible, and never did.** Measured while building this:
**albumentations 2.0.8 seeds its transforms at construction from OS entropy**, so the same module run
twice produces different pixels regardless of `random.seed` / `np.random.seed`. `--seed` fixes the
model init, the shuffling and this module's own generator — not the images. Two runs of one recipe
are the same *distribution*, never the same data. The scan transforms are therefore built **lazily**,
so a run that does not ask for scans constructs exactly what it constructed before; equivalence with
the previous revision was verified by replaying 400 draws (ink coverage and mean brightness agree,
KS p = 0.94).

## The pre-registration — signed 2026-08-19, before training

Full text, with the reasoning for the instrument, in [levers.md](levers.md) Lever 7. In brief:

| | |
|---|---|
| **Mix** | screenshot **0.55** / photo **0.20** / scan **0.25** (owner) |
| **Primary** | edits on `_realval_v2_scan` (202 rows / **197 unique strips** / 74 pages), paired against `r3-tupnew-stage2-best` |
| **No-regression** | `_realval_v2_borndigital` (65 strips / 13 pages) |
| **Reported, not gated** | the three tiers, the whole pool, per-class AEU F1, the mix used, `last` beside `best` |

**The control is already trained.** `data/checkpoints/r3-tupnew-stage2-best` used this corpus
(`strips_v5_tupnew`), this split, this recipe, these step counts and this seed — so the arm costs
**one** GPU run, not two, and the augmentation mix is the only difference.

⚠ **THE ONE THING THAT WOULD BREAK THE PAIRING: promoting labels into the real pools before the arm
is read.** The arm and the control share `strips_nota` / `strips_r1` / `strips_tup` *as they stand
today*. Labelling itself is safe — a `batch3` verdict lands in `reslice_all.csv` and nowhere else —
but `promote_labels.py` rewrites a pool's `manifest.jsonl`, and so would re-emitting the pools (B8).
Either between now and the read makes the arm differ from its control in **corpus and mix**, which is
exactly the unattributability Round 3 has already paid for twice. So the labelling (B2) and this run
are independent and may go in either order; **promotion waits for the read.**

⚠ **The instrument changed from the drafted one, on a measurement.** The draft said "hard tier,
which is where the scanned pages are". It is: 97 of its 110 strips are scan-sourced. But all 110 of
its rows are gold **seeded with a model decode and then confirmed by a person**, which flatters that
model's descendants — and it shows: the hard tier scores *better* than the mid tier. The medium
split has no such asymmetry, is twice the size, and separates the media by 4.5× in SER. Numbers:
[../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

## Running it

```bash
# 1. look at what the profile does, at a size a person can actually read
.venv-ml/bin/python src/vision/augment.py --strips-dir data/synthetic/strips_v5_tupnew \
    --n 3 --profiles scan,scan,scan --stack --out data/synthetic/aug_preview_scan.png

# 2. the scoring pools (idempotent)
.venv-ml/bin/python scripts/rung3/split_realval_tiers.py --force

# 3. the Colab package — ships strips_v5_tupnew, NOT a scan-specific corpus
sh scripts/make_round3_colab_zip.sh scan       # -> data/colab/tnc_round3_scan_colab.zip (688 MB)

# 4. notebooks/round3_scan_profile_colab.ipynb, run top to bottom (the owner drives this)
#    stage 1: 6000 steps @ lr 3e-5, batch 16, from BASE
#    stage 2: 2000 steps @ lr 1e-5, the three real pools at :9
#    both stages carry --photo-share 0.20 --scan-share 0.25

# 5. read it, arm and control, on the same pools
for p in _scan _borndigital _hard _mid _easy ""; do
  .venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/<ckpt> \
      --strips-dir data/real/rung3/_realval_v2$p --split none --show-errors 0
done
```

⚠ **The mix is the whole experiment and nothing downstream records it** — corpus, split and
checkpoint are identical between the arm and its control. `train.py` prints
`augment=on (screenshot 0.55 / photo 0.20 / scan 0.25)` in its startup line, and the notebook
asserts the numbers reaching the `Augmenter` before any long run. That log line is the only evidence
of which arm a checkpoint is.

⚠ **The scan profile is CPU work per sample.** Round-1's T4 run was already augmentation-CPU-bound;
if throughput reads low, raise `--num-workers` before suspecting anything else. Step counts and
batch size must match the control's.

## Reading the result

- Quote the **paired per-strip** difference as the headline; `edits/page` on these pools is edits per
  **page fragment** (2.7 and 5.0 strips a page), because the pools are not page-complete.
- Never quote `share_le5` from them: that number is defined on the 46-page exam.
- 202 and 65 strips resolve a large move and nothing subtle. Say so beside the number.
- **A null is reported as a null**, and the mix is not re-tuned to chase a win. That is what the
  pre-registration is for.
- ⚠ The exam is **not** read here. One shot, on Round 3's final model
  ([round3-criteria.md](round3-criteria.md)).

## ⛔ The disposition (2026-08-19)

**Both checkpoints agree, so the read does not turn on a selector we already distrust.** `best`
(step 500) and `last` (step 2,000) are separate models here — stage 2's mix loss peaked at step 500
while real-val loss kept falling — and both are null on scanned pages, with the under-trained one
slightly the worse. That closes the one methodological hole this arm had.

**Reported as a null, and the mix is not re-tuned.** That is what the pre-registration is for: the
share was chosen before the code was written precisely so that a disappointing result could not be
answered by moving it. ⚠ Do not propose a 0.35 or 0.15 scan share "to see if that works" — a number
tuned against this pool stops being evidence about anything.

**What the arm bought, honestly:** nothing measurable on the medium it was built for, and a
non-significant improvement on the medium it was not. It cost one GPU run and no render slot, which
is exactly why it went first.

✅ **SETTLED 2026-08-19 (owner): the profile does NOT stay on. `scan_share` is left at its 0.0
default, so the final Round-3 model trains without it.** The case for keeping it was only that it did
not hurt and that the born-digital point estimate favoured it — a choice made on two nulls. Against
that: every profile in the mix is a claim about what users upload, and `PHOTO_SHARE` came from the
owner's report that real uploads are mostly web screenshots. The flag is off by default, so **doing
nothing carries the decision** and no code moves. ⚠ The profile itself is **not** deleted: the module,
the preview command and this write-up stand, so a later round can turn it on with one flag rather
than rebuild it. [../DECISIONS.md](../DECISIONS.md)

⚠ **This is the second trained Round-3 arm to return a null** — the tuplet-mark A/B was p = 0.688,
this is p = 0.488 — and Lever 4's second engraver returned a third null on the domain gap without
being trained at all. Three attempts to make the synthetic pixels more like real pages have now
moved nothing measurable. [levers.md](levers.md) already argued that axis was at diminishing
returns; this is the first *trained* evidence for it rather than an inference, and it should weigh
on what gets built after arms 2 and 3.
