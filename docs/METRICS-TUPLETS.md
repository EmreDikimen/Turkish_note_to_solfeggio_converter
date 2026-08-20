# Tuplets — the corpus scan, the printed mark, and what follows the notes

purpose: the single home for the tuplet measurements — how triplets appear in our corpora and in real print, and the geometry behind the mark we draw
audience: agents and the owner working the `\\tup3` thread

updated: 2026-08-19

Split out of [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) on 2026-08-19 when that file crossed
the 400-line cap. The split is by genre: that file keeps **how the model fails**, this one keeps
**what a triplet looks like** — in our labels, in our renderer, and on a real page. Nothing is
duplicated. The thread these serve is [rung3/tuplets.md](rung3/tuplets.md); the A/B they informed
ran and was **null** (p = 0.688).

### Tuplets — the corpus scan and the renderer constants (2026-08-11)

Taken while diagnosing why `\tup3` recall misses its floor. Reading:
[rung3/tuplets.md](rung3/tuplets.md). Scores themselves: [METRICS.md](METRICS.md).

**Noteheads per `\tup3` group**, over every label pool we own — `strips_tup`, `strips_nota`,
`strips_exam_v2`, `strips_v4`:

| noteheads | groups | note |
|---|---|---|
| 3 | **20,244** | 99.98% |
| 2 | **4** | all in `strips_tup`; 2 legitimate, 2 do not sum |
| >3 | **0** | the shape is rare in Turkish notation (owner) — absence is correct, not a gap |

The two legitimate ones are a 32nd + a 16th (`c''32 b'16`, `c''32 \natural b'16`) — three units of
time in two noteheads, which the closing arithmetic accepts. The two that do not sum are
`\bakiyeSharp g''8 a''8` (twice): 2 units where 3 are needed. Unresolved — a wrong label or a crop
that cut a group.

⚠ **This retires "all groups are exactly 3 closed notes"** ([rung3/labeling.md](rung3/labeling.md),
2026-07-18). It was true of the 114-group manifest and is not true of the 205-group one.

**What the renderer draws**, as of this date (`apps/web/src/SheetView.tsx`):

| constant | value | where |
|---|---|---|
| curved-arc style share | 70% of pieces, by name hash → **90% from 2026-08-12** | `tupletCurved` |
| slur distractors | fire on **35%** of eligible ≥3-note runs | `slurRng() < 0.35` |
| the "3" | 13 px bold italic serif, placed **above** the arc apex → **redrawn 2026-08-12** | `drawTupletArc` |
| arc stroke | 1.1 px, one unbroken quadratic → **two segments 2026-08-12**, same weight | `drawTupletArc` |

⚠ **Real Turkish print breaks the arc and sets the "3" inside the gap** (owner, 2026-08-11, from a
real page). The renderer's continuous-arc-plus-floating-digit is not the printed shape, and it is
the leading hypothesis for the recall deficit.

### The printed triplet mark, MEASURED (2026-08-12) — the owner's report holds, 16/16

`scripts/rung3/tuplet_mark_probe.py`. The script locates digit-like components that have arc-like ink
beside them and writes matched-staff-size tiles (a 4× zoom with a one-staff-space ruler, and the same
window after the 409×583 Donut resize); **a human accepts or rejects each tile** and the geometry is
then taken by scanning outward from the digit along its own row band. It deliberately builds no mark
detector — the false positives it does surface (lyric syllables, the tempo mark `♩=76—84`) are exactly
why. 20 tiles read on `strips_tup` → 12 accepted; 8 read on `strips_exam_v2_clean` → 5 accepted.

**Every one of the 16 accepted marks is BROKEN with the "3" in the gap**, across ~11 editions.

> ⛔ **CORRECTED 2026-08-19 — this measurement stands, the generalisation drawn from it does not.**
> The line that followed read *"Not one continuous arc with a floating digit, across ~11 editions."*
> Two real scanned editions supplied by the owner draw a **continuous arc with the italic "3" set
> inside the concavity** — Kemânî Sebuh / Sofyan, and Avni Anıl / Düyek (the latter over dense
> contiguous triplet runs). The sample was 16 tiles from **two pools we already own**, and the style
> is absent from both, so the probe could not have found it. 16/16 describes those pools; Turkish
> print at large has at least two shapes. Geometry for the third style is measured separately, on
> those pages, before it is drawn ([rung3/tuplets.md](rung3/tuplets.md), [DECISIONS.md](DECISIONS.md)).

| quantity, in staff spaces | real print (n=16) | ours, curved style | ours, bracket style |
|---|---|---|---|
| gap between the arc's inner ends | **1.63** (range 1.55–1.69) | — (continuous) | 1.27 |
| clearance each side of the digit | **0.43** | — | — |
| digit height | **1.20** | 0.97 | 0.97 |
| digit width | **0.76** | 0.87 | 0.70 |
| digit centre vs the arc's inner ends | **+0.20** (just inside, toward the staff) | +1.27 (fully outside) | in the gap |
| one segment's rise, outer end → gap | **~0.95** | 1.00 (whole arc's depth) | — |
| arc stroke | 0.133–0.168 | 0.100 | — |

**The gap is sized to the digit, not to the group.** It is 1.63 S whether the mark spans 4.5 S or 28 S
— i.e. the digit's own width plus ~0.43 S of air each side. A fraction-of-span rule would have been
the natural guess and it is wrong.

**Our own bracket style is structurally closer to real print than our arc is** — it already breaks
around the digit. Only the curved style (70% of pieces then, 90% now) ever carried the defect.

**The redraw lands on the measurements**, checked with `--dir` on the pilot render: gap **1.63**,
digit **0.70 × 1.20**, clearance **0.43 / 0.50**, digit centre **0.20** inside the ends.

### The THIRD style measured (2026-08-19) — continuous arc, "3" inside the concavity

`tuplet_mark_probe.py --images data/real/tuplet_marks --accept …`, on the two real editions the
owner supplied. The probe needed three additions to read them at all, and each is a fact about
scanned pages rather than about tuplets:

- **A scanned page is ONE connected component.** On the Kemânî Sebuh page the arc, the digit, every
  notehead, both beams and all five staff lines form a single blob 2,026 px wide — component logic,
  which is this file's whole method, can say nothing until the staff lines are erased (`--destaff`).
- **A full-width row rarely reaches the 0.6 ink fraction** that defines a staff line here: 0.57 and
  0.61 maxima on the two scans, against 0.95 born-digital. `--staff-thresh` exists for that and
  **the pools keep 0.6**.
- **The concave style sets its digit ON the top staff line**, so the candidate filter's "reject
  anything touching a line" rule threw it away. Dropped only when the lines have been erased.

**n = 5 marks, one page.** The second page (Avni Anıl) confirms the style by eye but its staff
detection reads 12.6–14.8 px across thresholds — unstable, so it is **not** measured. Sub-staff-space
geometry off a 548 px two-system scan would not be worth quoting.

| quantity, in staff spaces | real, concave (n=5) | ours, as rendered | ours, broken style |
|---|---|---|---|
| clearance, arc underside → digit top | **0.91** (0.57–1.00, n=3 clean) | 1.00 | — (digit is in the gap) |
| **digit and arc are ONE component** | **no, 0 of 5** | no, 0 of 6 | no |
| digit centre along the span | **0.44** (0.40–0.56) | 0.50 | in the gap, 0.49–0.50 |
| digit height | **1.22** (1.13–1.26) | 1.20 | 1.20 |
| digit width | **0.83** (0.83–0.91) | 0.77 | 0.76 real / 0.70 ours |
| whole mark's span | 6.74 (5.87–7.26) | 7.20 | — |
| arc depth | 1.65–2.39 | 1.60 | — |
| arc stroke | 0.174–0.217 | **0.100** | 0.100 |

**The load-bearing row is the second one.** Our *legacy* mark had the digit touching the apex, so arc
and digit were one component — a slur with a bump, and that is what made it indistinguishable from a
phrase slur. Real print in this style keeps them apart, which is why the shape is worth drawing at
all rather than being a repaint of the mark we already abandoned.

⚠ **The arc stroke is again left at the slur's weight**, and again deliberately: real print draws
this arc heavier still (0.174–0.217 S against our 0.100), but thickening only the tuplet arc invents
a thickness cue against phrase slurs. Owed jointly with `drawSlurArc`, exactly as for the broken mark.

⚠ **How often either style is used is NOT measured.** Two pages are an existence proof, not a
frequency, so `TUPLET_MARK_CONCAVE.share` is chosen. Replace it by counting marks across editions
with the probe.

### The mark FOLLOWS THE NOTES — measured 2026-08-12 after the owner's review

The owner's verdict on the first redraw: right shape, wrong rigidity — *"in real editions the tuplets'
arms follow the notes, up or down"* — plus "reduce the font weight of the 3". Both were then measured
on `strips_tup/ben_guzele_…_p2_s01_w03.png`, one strip carrying **four descending triplets** (7 arms):

| quantity, in staff spaces | real print | ours now |
|---|---|---|
| an arm's outer end clears **its own** end note | 0.86–0.93 (left arms), 0.60–0.73 (right arms) | 0.85 both |
| the gap's height over the group's **highest** note | 1.40–1.43 (n=3) | 1.43 |
| the digit's position along the mark's span | **0.49–0.50** — the middle | 0.50 |

**The digit stays centred, and that is the non-obvious part.** A descending printed mark *looks*
weighted toward its high side, so the first attempt slid the gap over the highest note — which
degenerates into a stub arm whenever that note is an outer one. The measurement says the asymmetry
comes entirely from the arms' **slopes**: ends follow the notes, digit stays at mid-span.

- The printed digit is **regular weight**, not bold (owner, against real pages). At the same 16 px it
  measures 0.70 S wide against print's 0.76 — narrower, which only widens the clearance, so the
  shrink rule is satisfied with more margin.
- ⚠ **n is small and one-page for the arm numbers** (7 arms, 3 gap heights, one edition), against 16
  marks / ~11 editions for the gap-and-digit table above. Quote them with that.

- **Caveat on the `span`, `seg w` and `rise` columns:** where a segment merges with a staff line or a
  long slur, its component inflates those three (4 of 17 rows). `gap`, `digit_h` and `digit_w` are
  band-scanned locally and unaffected. One exam row (`askin_o_sihirli…`) reports `gap 0.77 / gapL
  0.00` because a staff line crosses the digit's row band; its tile shows a normal gap.
- **Deliberately NOT changed:** real print's arc stroke is *heavier* than ours (0.133–0.168 vs 0.100).
  Thickening only the tuplet arc would hand the model a thickness cue separating it from a phrase
  slur that real pages do not have — the same trap `AEU_SHARP_STROKE` documents. It is owed as a
  joint change with `drawSlurArc` — still owed, and still joint, now that the shape A/B has run and
  come back null (2026-08-15, [rung3/tuplets.md](rung3/tuplets.md)).
- **The digit's FONT changed, and the gap is why.** Bold italic Georgia (an old-style figure) measured
  **1.10 S wide** at real print's height, leaving 0.26 S of clearance instead of 0.43 — it would have
  fused with the arc ends after the shrink. Upright Times at 16 px measures 0.77 × 1.20 S. The slant
  itself stays unmeasured; the width was not optional. Pre-registered: if the digit fuses again,
  **widen the gap, never shrink the digit**.
