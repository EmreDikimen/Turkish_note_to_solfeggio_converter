# Slicer port parity — does the TypeScript reproduce the Python?

purpose: the single home for how the browser slicer port measures against `page_to_strips.py`, rung by rung
audience: agents working MVP rungs W4-W6, and anyone quoting a port-parity number
updated: 2026-08-04

Split out of [METRICS-SLICER.md](METRICS-SLICER.md) on 2026-08-04 when that file crossed the 400-line
cap. The split is by genre: that file keeps **what the Python page-cutter does**; this one keeps
**whether the port reproduces it**. Nothing is duplicated.

How to reproduce any number here — and ⚠ why the control is local Python rather than the manifests
on disk — is [mvp/slicer-port.md](mvp/slicer-port.md). Rung state: [mvp/README.md](mvp/README.md).

## Barlines reproduce too (2026-08-04, MVP W5)

Port vs **local Python** over the same **whole corpus — 1,781 pages / 12,123 rows / 51,019 bars**.

| check | full corpus | W5 bar |
|---|---|---|
| bar **count** exact per row | **12,121/12,123 rows (99.98%)** | ≥99.0% |
| bar x within 1 px | **51,018/51,019 (100.00%)** | ≥99.9% |
| bar x exact | **51,013/51,019 (99.99%)** | ≥95% |
| **rejected candidates identical, reason for reason** | **12,112/12,123 rows (99.91%)** | not gated |

**All 8 differing rows are the ±1 grayscale residue, and every one was reproduced inside Python.**
Feeding Python its own *other* grayscale path (`cvtColor` on `imread` colour instead of
`imread(IMREAD_GRAYSCALE)` — the two disagree by ±1 on 3.8–9.5% of these pages' pixels) makes Python
emit **exactly the port's answer**, bar list *and* reject list. The same sensitivity test W0 used to
settle grayscale in the first place:

- **2 rows differ in bar COUNT, one in each direction** — `birgunbanageleceksinyillardansonrapdf…_p1`
  s1 (the port rejects candidate 2532 as `gate3_blob`, Python keeps it) and
  `kurdilihicazkar_saz_semai_haydar_tatliyay_kemani_no2_p2` s2 (Python rejects 1537, the port keeps
  it). Both are `_terminal_overshoot` near-ties, and Python flips to the port's verdict — including
  the identical reject list — under the perturbation. **A port bug in that walk would flip one way
  consistently across many rows; these are 2 rows out of 12,123, symmetric.**
- **The single 2 px difference is W4's `x0` residue, not a barline problem.**
  `sayd_eyledi_bu_gonlumu_bir_gozleri_ahu_nota_p1` s5 is the page W4 already recorded as having `x0`
  off by 1 (157 vs 158). `detect_barlines` snaps the row's first bar to `int(staff.x0 * scale)`, and
  that row's scale is exactly 2.0 — so 1 page px becomes 2 row px. Nothing in the gates moved.
- **On all 6 rows where a bar POSITION moved, the reject lists are identical** — no gate disagreed
  on any of them; these are cluster-centre moves, 4 of the 6 with nothing rejected at all.

### The reject-list check found 9 more rows the bar list cannot see

Recording the rejected candidates was a free extra, and it earns its keep: **9 rows produce
identical bars while disagreeing about which candidates were thrown out**, on top of the 2 that
disagree on both. None is a new failure mode, and all three shapes are ±1 effects:

- **6 rows: a rejected candidate's x moves by 1** (e.g. `seddiaraban_saz_semai_cemil_bey_tanburi_p1`
  s1, `1147` vs `1148`) — same candidate, same reason.
- **2 rows: a candidate is generated on one side only** (`var_mi_cana_derd_i_askin_caresi_nota_p1`
  s5 loses `1872`), i.e. it fails gate 1 rather than being rejected later. Bars unaffected.
- **1 row: the same candidate is rejected for a different REASON** —
  `huseyni_saz_semai_rasid_efendi_neyzen_baba_p1` s7 col 956, `gate2_fat` in Python against
  `gate3_blob` in the port. Rejected either way, so the bar list never sees it. ⚠ This is the one
  worth remembering: a reason swap means two independent gates both sit near their thresholds on
  that column, and only this check can see it.

⚠ **Same scope note as W4: the corpus run used `--inject-skew`**, so it validates everything
downstream of the deskew estimator, not the estimator.

⚠ **Non-claim: `hasNotehead` is ported but NOT exercised by W5.** Its only caller is
`window_measures`, so nothing here measures it. W6 covers it.

**The manifests are the weaker reference here too, and again below the bar.** Current Python
reproduces only **11,689/12,099 (96.61%)** of the manifests' `row_bars`; the port reaches
**11,681/12,099 (96.55%)**, 8 rows below — the same 8 residue rows. A port scored against the
manifests would read 96.55% against a 99% bar and look like a failure.

## The TypeScript port reproduces stage 1 exactly (2026-08-04, MVP W4)

Port vs **local Python** over the **whole corpus — 1,781 pages / 12,123 systems**. Reference built
by `scripts/slicer_ref.py`, scored by `npm run parity:slicer`.

| check | full corpus | W4 bar |
|---|---|---|
| staff count exact | **1,704/1,704 pages (100%)** | ≥99.5% |
| manifest-zero pages match Python | **77/77 (100%)** | 100% |
| `scale` within 0.002 | **12,122/12,122 systems (100%)** | ≥99.5% |
| **outer lines + median spacing identical** | **12,123/12,123 (100%)** | not gated |
| normalized row width identical | 12,123/12,123 (100%) | not gated |
| staff x-extent identical | 12,122/12,123 (99.99%) | not gated |
| staff line y's identical | 12,117/12,123 (99.95%) | not gated |
| deskew angle identical | **132/132** (the un-injected 132-page run) | not gated |
| normalized-row pixel-sum drift | max 548 ppm | never 0, see below |

**Everything that differs is the ±1 grayscale residue, and this is the first time that residue has
been observed reaching an output at all.** Two shapes, both harmless and both diagnosed rather than
waved through:

- **7 systems, 1 px.** Six have one *interior* staff line's cluster centre off by 1 px (e.g.
  `sipihr_p_dilhayat_kalfa_p2` s3: `884` vs `883`) and one has `x0` off by 1
  (`sayd_eyledi_bu_gonlumu_bir_gozleri_ahu_nota_p1` s5: 158 vs 157). One page row of ink falls on
  the other side of Otsu.
- **None of them reaches a crop.** `normalize_row` reads only the **outer** lines and the **median**
  spacing, and that triple is identical on **all 12,123** systems — which is why the row width and
  `scale` are 100%. An interior line cannot move the median of four gaps. W5 inherits an identical
  normalized row.

The pixel-sum drift has the same cause and is reported rather than gated for the same reason: a
browser cannot reach `imread(IMREAD_GRAYSCALE)`'s bytes (see the section above).

⚠ **The deskew angle is NOT covered by the full-corpus run.** It used `--inject-skew` (Python's
angle fed in) to stay affordable, so its "1,781/1,781" is trivially true. The estimator's real
number is **132/132 from the 132-page un-injected run**, and that is the one to quote.

⚠ **The zero-staff bar was restated, on purpose.** It was written as "the zero-staff pages yield
zero staves — 100%", with those pages identified by an **empty manifest**. Local Python now finds a
staff on **1 of the 77** (`serapa_husn_u_ansin_dil_sitansin_nota_p1`), and the port finds the same
one with identical lines, x-extent, spacing and scale — so the original wording failed a port that
agreed with Python exactly. Held against the control like every other check (port must match
Python's staff count there) it is 77/77, and the tool prints the drift count beside it.

### The manifests on disk are NOT reproducible, so they cannot be the bar

The port was first scored against `data/real/strips_v2/*_manifest.json` and read **86.7%**. That
number measured two things at once. Running the **current** `page_to_strips.py` over the whole
corpus agrees with those manifests on only **1,680/1,704 (98.59%)** — already below W4's own bar.
1,578 of the 1,781 page dirs were sliced on Colab, and the artifact has drifted from the code.

One page makes the point: `gozumden_gonlumden_hayali_gitmez_nota_p1` has a manifest saying 5
systems; local Python finds **7**, and the port finds the same 7 with every line y, x0, x1 and
spacing identical. It was being scored as a port failure. **The port reaches the manifest ceiling
exactly — 1,680/1,704, the same pages as Python.**

Same shape as the arm-B decode ceiling ([mvp/README.md](mvp/README.md) W3): agreement with an
artifact is not correctness.

### Deskew is NOT a no-op on this corpus (2026-08-03)

**15.3% of pages (272/1,781) take a real rotation** from `estimate_skew` — 17.4% (23/132) on the
first sample, angles 0.3–1.1° — against **0%** that take a perspective crop. The plan had both down
as no-ops on clean input; only the crop is. Skipping the rotation cost whole systems
(`hengam_i_safadir_yine_sen_nus_i_mey_eyle_nota_p1` went 10 staves → **0**), and **22 of the 23**
pages failing the first parity run were exactly the 23 deskewed ones.

⚠ **Cost: 36.1 s/page in the browser**, ~35 s of it the 41-rotation sweep (each rotation re-runs a
page-wide `MORPH_OPEN`), against ~1.9 s for Python's whole stage 1 — ~19× slower. A W7 latency
problem: an axis-aligned screenshot pays the full sweep to learn it has no skew. It also puts a
full-corpus parity run at ~18 h, which is why `--inject-skew` exists (feed Python's angle in and
check everything downstream); with it the corpus run reads 0.4 s/page.
