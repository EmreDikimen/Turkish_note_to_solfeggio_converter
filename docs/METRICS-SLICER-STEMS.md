# A stem taken for a barline — the both-ends gate

purpose: the 2026-09-03 stem-vs-barline gate (`END_BLOBS`, "gate 2b"): the failure it fixes, why the three older gates cannot see it, the variant that was tried and dropped, and what the fix costs
audience: anyone about to change `detect_barlines`, or explain why a row was cut at a note
updated: 2026-09-03

Split out of [METRICS-SLICER-BARLINES.md](METRICS-SLICER-BARLINES.md), which sits at the 400-line
cap. That file keeps gates 1–3 and the hand-marked ground truth; this one keeps the fourth gate.
Nothing is duplicated. Plain words for the owner: a *stem* is the thin vertical line on a note; a
*barline* is the thin vertical line between two measures. Both cross the staff, so the slicer has to
tell them apart, and where it gets that wrong it cuts a strip through the music.

⭐ **Priced on the full 6,440-row run (2026-09-03, owner-approved, two passes): 3,762 → 4,068
exact rows for the gate (+306), then → 4,133 with the stroke-width refinement (+65 more, +371 in
all), paired BETTER 502 / WORSE 122 against the baseline.** The largest single gate gain this
project has measured — the whole 24–25 August session was +446. Both passes are below; the second
is what ships.

## The failure (owner-reported, 2026-09-03)

`nihavendLongaDuzgun.png`, a clean screenshot: **the last row was cut at a note stem**, between a
sharp and the note it belongs to. The sharp landed at the end of one strip and its note at the
start of the next, so neither strip can read the pitch right.

The stroke at row x=1462 is the stem of a 16th note whose **head sits on the top staff line** and
whose **second beam ends on the bottom staff line**. Every gate read it as a barline:

| gate | what it asks | what it saw at x=1462 |
|---|---|---|
| 1 continuity | one unbroken run from the top line to the bottom line | run rows 11..133 of the 140-row band — identical to the four real barlines on the row |
| 2 thinness | ≥ 15 consecutive rows of ink ≥ 0.75 sp wide through the column (staff-line rows skipped) | **8**: the head attaches at the stem's middle, so only its lower half is at the column, its lowest 3 rows narrow below 0.75 sp, and the 6 rows ON the top line are skipped |
| 3 termination | wide ink connected PAST an outer staff line | nothing — the head ends where the line is, and so does the beam (`ov_top` 0, `ov_bot` 3, `wide_beyond` False) |

So the gates were not wrong about what they measured; the stem simply spans the staff exactly and
keeps both of its wide parts *on* the outer lines, where the line-row skip hides them.

The same page has the same stroke four more times — rows 1, 5, 6 and 8 (three of them the stem
after a sharp in the repeated phrase, one mid-group with its beam on the bottom line) — each
manufacturing a spurious measure.

## The variant that was tried first and dropped: counting the line rows in gate 2

The first idea was to stop skipping the staff-line rows in gate 2 and instead read them on a
*de-lined* view (a pixel counts on a line row when its column's ink run is taller than the line
itself). Measured, and dropped, for two reasons:

- **It still misses the target.** With the 6 line rows counted the head reaches **14 fat rows
  against the 15 gate 2 needs** — the head's lowest rows narrow below 0.75 sp, so half a head is
  simply not a whole one.
- **It costs real barlines.** On the 93-mark hand-marked truth: recall 48.4 → **45.2%** (3 real
  barlines lost) for precision 81.8 → 89.4%. The reason is structural: a barline that a head merely
  *touches* at the top line is, at that column, **the same picture** as this stem's head end. Gate 2
  looks at one end and cannot tell them apart, however it counts.

What separates the two is the **far end**: a barline's is bare; a stem's is inside a beam.

## The gate that ships: wide ink at BOTH ends of the stroke is a stem (`END_BLOBS`)

Within `END_SPAN_SP` = 1.5 line-spaces of **each** end of the stroke's run, look for
`END_RUN_SP` = 0.3 line-spaces (9 rows) of consecutive fat rows (ink ≥ 0.75 sp wide connected
through the column, the same "fat" gate 2 uses). Reject only when **both** ends carry one. Staff-line
rows are read on the de-lined view (`_line_row_blobs`, margin 3 rows over the line block's own
thickness) so a head or beam straddling a line keeps its height, and a line row that fills the whole
±1 sp window stays neutral (that is a beam or an under-read line, never a head). 1.5 sp is where a
16th's second beam ends (beam, gap, beam ≈ 1.25 sp); 1.0 sp was tried and left the target's second
beam half outside the window, rejecting it by 11 rows to 9 only through the bottom line's blur.

It runs after gate 2 and before gate 3, on the cluster's `test_col`, and it is **strictly a
tightening** — it can only remove candidates. `OMR_END_BLOBS=0` restores the 2026-09-02 behaviour.
The reject shows **amber** in the debug overlays (`gate2_ends`). Both sides carry it: Python
`page_to_strips.py` and the browser's `barlines.ts` / `constants.ts`.

### What it does on the reported page

| row | before | after |
|---|---|---|
| 1, 8 | `[188, 1217, 1709, 2136, 2435, 2785]` | 1709 gone — the stem after the sharp |
| 5 | `[215, 520, 1079, 1565, 2087, 2218, 2785]` | 2218 gone — a mid-group stem, beam on the bottom line |
| 6 | `[188, 1037, 1446, 1650, 2227, 2784]` | 1446 gone — head on the top line, two beams ending on the bottom line |
| 9 | `[188, 1068, 1462, 1741, 2328, 2629, 2664]` | 1462 gone — the reported cut; the row is 4 measures, cut at real barlines |

⚠ Row 9 also loses **2629**, the thin stroke of the closing `:‖`: a decorative bracket touches it
at both ends (the segno's tail above, a curly bracket below). Harmless here — the thick stroke stays
and the row end snaps onto it — but it is the gate's known shape: **a real barline touched at both
ends is rejected**. 27 → 28 strips on the page, no strip narrower than 342 px.

### The hand-marked truth (93 marks, 4 pages — the worst pages we own)

| | recall | precision | false barlines |
|---|---|---|---|
| 2026-09-02 code (`OMR_END_BLOBS=0`) | 45/93 (48.4%) | 45/55 (81.8%) | 10 |
| **`END_BLOBS`, 1.5 sp** | **44/93 (47.3%)** | **44/51 (86.3%)** | **7** |

Three false barlines gone (`aman_saki` s5 x=1126, `gafil` s1 x=1345 and s3 x=780), **one real
barline lost** (`gafil` s6 x=1088): a dark photocopy where merged ink touches the barline above
*and* below — exactly the both-ends shape, and the gate cannot tell it from a stem. Two misses on
`bozukNihavendLonga` s4 change label only (`gate3_blob` → `gate2_ends`; they were already missed).

### `score_slicer.py --sample 25` (124 rows — a smoke read, not the instrument)

| | exact rows | improved | regressed | `dn` +1 / +2 |
|---|---|---|---|---|
| 2026-09-02 code | 81/124 (65.3%) | 39 | 12 | 22 / 7 |
| **`END_BLOBS`** | **86/124 (69.4%)** | **42** | **13** | **16 / 4** |

+5 exact rows; the two new regressions are `bir_melek_p1` s02 (3 measures printed, 1 found) and
`cayir_ince_p1` s00 (3 printed, 2 found) — rows that lose a real barline. In that sample the gate
fired **117** times, 63 of them on candidates gate 3 would have rejected anyway (`gate3_blob`
118 → 55) and 12 that `gate3_clef` would have (142 → 130). ⚠ At 124 rows a 3–4 row difference is
noise; **read the full run before quoting a direction.**

### The full run (6,440 rows, 1,159 pieces; `OMR_END_BLOBS=0` against the default, same code)

| | exact rows | `dn` −1 / 0 / +1 / +2 | gate rejects |
|---|---|---|---|
| gate off (today's baseline; +12 over the 26 Aug 3,750 from the tail-span trim) | 3,762 (58.4%) | 773 / 3,762 / 1,255 / 288 | `gate3_blob` 4,825 · `gate3_clef` 5,265 |
| **gate on** | **4,068 (63.2%)** | 958 / **4,068** / 835 / 172 | `gate3_blob` 2,324 · `gate3_clef` 5,052 · **`gate2_ends` 5,432** |

Paired row by row: **789 rows change on 488 pages, BETTER 547, WORSE 242.** The moves:

| move (`dn` off → on) | rows | what it is |
|---|---|---|
| +1 → 0 | **418** | a stem stops being a barline — the target class |
| 0 → −1 | 163 | a barline lost, OR a stem that was masking a barline the slicer never found (see below) |
| +2 → 0 | 64 | two stems on one row |
| +1 → −1 | 49 | a stem removed on a row that also misses a real barline |
| +2 → +1 | 44 | one of two stems |
| −1 → −2, −2 → −3 | 53 | a further real barline lost on a row already short |

The gate fired **5,432** times; about 2,500 of those were candidates `gate3_blob` rejected before
(it runs first now), the rest are new rejections.

**What the WORSE rows are** — two shapes, from the rows looked at by eye:

- **A stem that was masking a missed barline.** `bestenigar…ney_p2` s00: both rejected strokes are
  real stems (head on a line, beam on the other line), but the row also has a real barline gate 1
  never proposed. Before, +1 spurious and −1 missed summed to an "exact" row; now the count reads
  −1. The gate is right and the instrument cannot see that. This is the same blind spot
  [METRICS-SLICER-BARLINES.md](METRICS-SLICER-BARLINES.md) records for `never_a_candidate`.
- **A repeat barline with curved "wings".** `cok_yasa_ayse_ney_p1` s01: two real `‖:` / `:‖`
  strokes, drawn with a thin curved bracket touching the thick bar at both ends — bar plus wing read
  as "wide ink at both ends". A real loss, and the one shape the rule cannot separate from a stem by
  ends alone. The refinement below targets it.

### 200 random corpus pages, geometry only (`arms.py --env OMR_END_BLOBS`)

| count | off | on | delta | pages + | pages − |
|---|---|---|---|---|---|
| staves | 1,530 | 1,530 | 0 | 0 | 0 |
| bars | 3,292 | 2,817 | **−475** | 0 | 136 |
| measures | 4,702 | 4,270 | −432 | 0 | 128 |
| strips | 4,204 | 4,201 | −3 | 20 | 19 |

64 pages (32%) byte-identical; no page gains a bar, as a tightening must. Worst single page
`yalandir_dogustan_sarhos_oldugum_nota_p1` 45 → 35. Raw: `arms_end_blobs.json` in the session
scratchpad (not kept).

### Parity of the browser port

`slicer_ref.py --pages 20 --zero-pages 2` + `parity:slicer`: **W4 / W5 / W6 all PASS** — bar x
exact 576/576, **rejected candidates identical reason-for-reason on 154/154 rows**, strips
419/419 exact. The gate fired **56** times inside that sample, so the port was exercised, not just
compiled. ⚠ The three eligible hand-marked pages are not in `strips_v2`, so a `--stems` reference
on them is empty ("no pages to run") — that is the reference's page pool, not a failure.

## The refinement for winged repeat bars: width BEYOND the stroke (ships, priced +65)

"Wide" was the whole connected run through the column, so a repeat sign's thick stroke (~0.5 sp
by itself) plus a thin wing read as fat. The refinement measures the attachment **beyond the
stroke's own thickness** — `_stroke_width`, the median width through the run's middle third, where
nothing is attached — and a 2 px stem loses nothing by it. Same in `barlines.ts` (`strokeWidth`).

What it does on the cheap instruments:

| | before the refinement | with it |
|---|---|---|
| `cok_yasa_ayse_ney_p1` s01 | both winged `‖:` lost | **both kept** |
| `bestenigar…ney_p2` s00 stems | rejected | still rejected |
| the reported page | 5 stems gone; the thin stroke of the decorated closing `:‖` gone too | 5 stems gone; **closing stroke kept** |
| hand-marked truth (93 marks) | recall 47.3%, precision 86.3%, 7 false | recall 47.3%, precision **83.0%**, 9 false |

The two false barlines that come back are both on `gafil…`, the dark photocopy: its strokes are
thick merged ink, so subtracting a large stroke width defeats the test there. So the refinement
trades winged repeat bars (real, kept) against dense-photocopy strokes (false, back), and the
93 marks could not say which side outnumbers the other. **The full run could (second pass, same
day, owner-approved):**

| arm (6,440 rows) | exact rows | vs baseline BETTER / WORSE | vs the plain gate |
|---|---|---|---|
| gate off (baseline) | 3,762 | — | — |
| plain gate | 4,068 | 547 / 242 | — |
| **gate + stroke-width** | **4,133 (64.2%)** | **502 / 122** | 152 better / 75 worse on 227 rows |

The refinement's own moves against the plain gate: **−1 → 0 on 124 rows** (a real barline
recovered — the winged repeats) against **0 → +1 on 58** (a thick false stroke back). Against the
baseline the real-barline losses (`0 → −1`) fall from 163 rows to **70**, while the target class
(`+1 → 0`) keeps 389 of its 418. On 200 random pages: bars **3,292 → 2,904 (−388 on 122 pages,
none gain)**, staves and x-extent untouched, 78 pages byte-identical. `parity:slicer` on a fresh
20-page sample: bar x exact 584/584, rejects identical 154/154 rows, strips 420/420, with the
refined gate firing 31 times. `data/real/rung3/score_slicer.csv` holds this arm's per-row result.

## What is owed

1. Nothing on the gate itself — both passes are priced and both ship. The remaining WORSE rows
   (122 against the baseline) are the two known shapes above: a stem that masked a never-found
   barline, and dense photocopies. Neither is a rule this file should sharpen from 93 marks.
2. The decode caches: `GEOMETRY_REV` stays **20260903** (no cache on disk carried it when this
   landed) and the `end_blobs` key in `window_signature()["geometry"]` is what tells the two
   same-day geometries apart. Nothing is owed today; the next pool build re-decodes regardless.
