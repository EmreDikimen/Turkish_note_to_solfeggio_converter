# Round-3 criteria — the pre-registration, and the tuplet A/B protocol

purpose: what Round 3 must reach (and what opens the public launch), written before any training runs
audience: agents and the owner working the real-page track
updated: 2026-08-20

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md) and
> [../METRICS-EXAM.md](../METRICS-EXAM.md). Decisions: [../DECISIONS.md](../DECISIONS.md).
>
> Round 1's pre-registration is [ship-criteria.md](ship-criteria.md), kept verbatim; this file is the
> same instrument for Round 3 and follows its shape deliberately. Round 2 was read against Round 1's
> floors without re-registering them, which is why that comparison stayed honest — and why this file
> exists rather than a third set of numbers invented after a result.

## ✅ Status: SIGNED by the owner 2026-08-15 — these are the criteria

Written and dated **before** the Round-3 corpus was rendered and before any Round-3 training ran,
then taken as-is by the owner. **The numbers below are now binding**: they are not re-opened after
the exam is read, and a miss is written up as a miss. A bar chosen after seeing a result is not a
bar, it is a description — and this one carries more than usual, because §2 makes it the
public-launch gate as well.

⚠ The **tuplet A/B in §3 ran before this signature** (2026-08-15) and was not affected by it: its own
protocol was pre-registered here on 2026-08-14 and it selects nothing against the floors in §1.

## 1. The floors

Each floor sits beside its measured Round-2 baseline (`round2-stage2-best`, the 326-strip clean exam
v2.1 with re-audited gold, read 2026-07-27 — [../METRICS-EXAM.md](../METRICS-EXAM.md)), so the
demanded delta is explicit.

| Criterion | Round-2 baseline | Round-3 floor |
|---|---|---|
| **Pages needing ≤5 corrections — the PRIMARY number** | **57%** | **≥ 75%** |
| Micro AEU F1 | 84.8% | ≥ 84.8% (no regression) |
| Macro≥30 AEU F1 | 84.4% | ≥ 84.4% (no regression) |
| Mean per-class AEU F1 *(the historical headline — fragile, low-n)* | 73.9% | ≥ 73.9%, reported with its n |
| Mean per-class AEU recall | 74.2% | ≥ 74.2%, reported with its n |
| SER | 0.052 | ≤ 0.052 |
| Exact-match | 52.1% | ≥ 52.1% |
| `\tup3` recall | 83.8% | ≥ 85% (standing floor, missed twice) |
| `\tup3` precision | 91.2% | ≥ 70% (standing floor) |
| Arc-triggered false `\tup3` | 0.0% (0/81) | ≤ 10% (standing floor) |
| Per-source AEU gap (neyzen − nota) | 0.0 pp | ≤ 12 pp (must not widen) |
| Synthetic val mean AEU recall — no-regression clause | 99.9% (Rung 2.2) | ≥ 99% |

**Why the primary number is the product one, not the accidental headline.** Round 3 targets pitch
(40% of user edits) and duration (28%), which the AEU headline cannot see — accidentals are 13% of
what a user fixes ([../METRICS-EXAM.md](../METRICS-EXAM.md)). `eval_omr.py` already computes and
persists `edits_per_page.share_le5`, so this needs no new measurement code.

**Why ≥75% and not ≥90%.** ≥90% of pages at ≤5 corrections is the standing product goal
(ROADMAP §0) and remains the destination. As a one-round floor from 57% it would demand more than
any round so far has delivered, and a floor nobody can clear stops discriminating a good run from a
mediocre one — the failure mode Round 1's threshold stance names explicitly. 75% is roughly half the
remaining distance, and it is the number the launch gate below is keyed to.

**Why the accidental measures are no-regression clauses, not targets.** Two rounds were spent on the
13%. What Round 3 must not do is buy pitch and duration by giving back the microtonal reading — so
they are floored at their Round-2 values rather than pushed. The macro mean stays *inside* the
report (never silently dropped) but is not the pass/fail number: it swung ~11 pp on a 3-gold class
in Round 1 and −4 pp on a 14-gold class in Round 2, which is what micro and macro≥30 are quoted
beside it to absorb.

**Per-class floors.** Round 1's five ≥20-gold classes keep their floors verbatim from
[ship-criteria.md](ship-criteria.md) (recall ≥75%, precision ≥70% each). They are reported, and a
miss is written up as a miss, but the pass/fail decision for Round 3 is made on the table above.

## 2. The public-launch gate

**The app opens beyond the two friends when Round 3's one-shot exam read clears the PRIMARY floor:
≥75% of pages needing ≤5 corrections.** Below it → Round 4, and the link stays with the friends.

One number, stated once, before the read. Three things follow from it:

- The gate is the **product** number, because what gates a launch is whether the app is worth using,
  not whether it reads a küçük mücennep.
- The exam is a **matched upper bound** (its pieces exist in SymbTr), so real uploads will be worse
  than whatever it says. That is a known, accepted bias in the gate, not a discovery to make later.
- A near-miss is a miss. The "improvement ship" disposition used in Rounds 1 and 2 is about what
  becomes the live *model*; it does not open the launch.

## 3. The tuplet A/B — pre-registered protocol

> ✅ **RUN 2026-08-15. Result: NULL** — 88.9% vs 85.2%, 2 net groups of 54, exact McNemar **p = 0.688**.
> The null branch below applied as written: the shape is kept, no recall claim is made. The protocol
> is left **unedited** so it stays auditable against the result. Numbers: [../METRICS.md](../METRICS.md);
> verdict and caveats: [tuplets.md](tuplets.md).

The first training under this file is not Round 3 itself but the `\tup3` shape A/B
([tuplets.md](tuplets.md) step 3). An A/B is training, so it is registered here before the render.

**The question.** Real Turkish print breaks the tuplet arc and sets the "3" in the gap (16/16 marks,
~11 editions); until 2026-08-12 we drew a continuous arc with the digit floating above it. Does
drawing it the printed way recover `\tup3` recall, which sits at 83.8% — under its ≥85% floor and
*below* its own pre-slur-distractor baseline of 92.7%?

**The arms.** Identical `data/pieces_v4.json` (⚠ *not* `data/pieces.json`, which is the stale
2026-07-08 selection), `data/split_v4.json`, recipe and seed; the ONLY difference is the mark:

| Arm | Corpus | Mark |
|---|---|---|
| `CTL` | `data/synthetic/strips_v5_tupctl` | continuous arc, digit floating above (pre-2026-08-12) |
| `NEW` | `data/synthetic/strips_v5_tupnew` | broken arc, digit in the gap (as measured) |

- The curved-arc **share stays at 90% in BOTH arms** (owner, 2026-08-13). Shape is what is under
  test; moving the share too would make the result unattributable, the same reason the slur
  distractors are held fixed.
- **Print realism (`printseed`) is OFF in both arms** (owner, 2026-08-13), so the corpora match the
  shipped `strips_v4` recipe apart from the mark. It carries `USUL_BEAM_GROUPS`, which is measured
  as unvalidated and quarantined ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)); a fresh
  render would otherwise have shipped it into ~40k strips as a side effect. It is opt-in from now on
  (`render.ts --print-noise`) and is its own later question.
- **Not in this A/B:** the 35% slur-distractor rate, the heavier arc stroke owed jointly with
  `drawSlurArc`, and the content work in `select_pieces.py`. One change at a time.

### Why `round2-stage2-best` is NOT the control (measured 2026-08-14)

The obvious saving is to train one arm and compare it to the live model, which was trained on the old
mark. It was checked and rejected: a Round-3 model differs from `round2-stage2-best` by **four**
things, not one.

| difference | size |
|---|---|
| the tuplet mark | what we want to measure |
| **`staff_jitter`, a NEW augmentation** — `src/vision/augment.py`, added 2026-07-29, **two days after** `round2-stage2-best` trained | ±4% scale, ±2% vertical shift, on **80% of every training sample**, both profiles. Never A/B'd, and aimed at exactly the geometry axis a triplet lives on |
| sub-visual **pixel drift** across the corpus | **all 40,826** strips differ between `strips_v4` and today's render, not only tuplet ones: mean abs delta 0.3–4.8 grey levels, no integer shift, ink fraction equal to 4 decimals, indistinguishable by eye. It is a rasterizer/Chromium change since 2026-07-26, **not** a drawing change of ours — `--thin-sharps` was already in v4 and print realism is off in both arms |
| the training environment | July Colab vs today's, plus ordinary run-to-run variance |

The two arms share all three nuisance differences, so only the mark separates them. Against
`round2-stage2-best`, nothing would separate. ⚠ **Sub-visual is not the same as harmless** — the
22%-too-thick sharp bars were invisible too and collapsed a class, and the 2% pre-shrink faked a
15.5% exam gain that reversed off the exam.

⚠ **This also applies to Round 3's own exam read**, which is why it is written here: whatever the
round scores, it carries `staff_jitter` and the pixel drift alongside whatever the round changed
deliberately. Rounds 1 and 2 both ended with "the changes are not separable"; say so again rather
than attributing a movement to the corpus alone.

**The selection statistic — ONE number.** Free-running `\tup3` **recall** on the tuplet val slice
`data/real/rung3/_tupletval` (built by `scripts/rung3/build_tuplet_val.py`: every `\tup3`-bearing
val-side strip from `strips_tup` and `_realval_v2`, val side decided by
`src/vision/data.py::is_real_val_piece`, exam pieces refused).

**The pool's reference point, read before the arms exist.** `round2-stage2-best` — the live model,
held out from these strips by the same hash — reads **85.2% `\tup3` recall / 97.9% precision** on it
([../METRICS.md](../METRICS.md)). Two things follow: the pool is **not** flattering on the class it
exists to measure (85.2% here against 83.8% on the exam, where real-val normally reads far higher),
and the arms have a number to be sane against. It is context, not a selection — the A/B is decided
between the two arms, paired.

**Guards, which do not select but can veto:** `\tup3` precision ≥70% (it has ~20 pp of headroom
above its floor and may spend some), and mean AEU F1 on `_realval_v2` must not fall more than 1 pp
between arms.

**Power, stated before the result — and it is tight.** The slice as built holds **54 `\tup3` gold
groups over 28 strips, 11 pieces** (`strips_tup` 19 groups / 9 strips, `_realval_v2` 35 / 19; one
decode-derived row and 8 filename collisions with older-slicer pixels removed). So **one group is
worth 1.9 pp of recall**, and significance — an exact **McNemar** test on the paired per-group
hit/miss across the arms — needs about **6 discordant groups all pointing one way** (b=6, c=0 gives
p = 0.031; 5 and 0 gives 0.063). The **minimum resolvable effect is therefore ~11 pp**, not the 5 pp
the redraw is hoped to buy. The whole read is one command,
`scripts/rung3/tuplet_ab_score.py --new <ckpt> --ctl <ckpt>`, which decodes both arms over the pool,
pairs the outcomes by gold occurrence and prints the exact p. Two consequences, both accepted before the run rather than discovered after it:

- A win has to be **large** to be called a win. Anything smaller is reported as null, in the
  language of the null branch below.
- ⚠ The pool is **neyzen-heavy** (24 of 28 strips; `--pools` can add `strips_nota` for +4 groups,
  deliberately not in the default — 4 groups cannot decide anything and it would put a noisier
  auto-accept pool inside the selection metric).

**The decision rule, written before the result:**

1. `NEW` wins significantly → its corpus becomes Round 3's, and the tuplet work moves to
   [tuplets.md](tuplets.md) step 4 (the forced-arithmetic repair + the decode constraint).
2. **Null** → the redraw is **kept anyway** — it is measured against real print, and realism is its
   own justification — but **no recall claim is made anywhere**, and the next lever is the
   slur-distractor rate (step 5), never both at once.
3. `CTL` wins significantly → revert the redraw and re-open the diagnosis in
   [tuplets.md](tuplets.md).

**The exam is not read for this A/B.** It is read once, later, on Round 3's final model, against §1.

## 3b. ADDENDUM 2026-08-20 — the exam grows before the read, and the floors do NOT move

Added after signing, and it is written here rather than inside §1 so the signed text stays auditable
as signed. **Nothing in §1 or §2 is edited, re-opened or re-numbered by this section.**

**What changed.** The exam grows from **46 to 67 graded pages** before the one-shot read — the 21
pages it already owns and has never labelled ([exam.md](exam.md)). This is the power note's option 1
([levers.md](levers.md)), which exists precisely so that growing *before* a read is legal; §4's rules
are unaffected because the exam is still read **once**, on the final model.

**Why this is not moving the goalposts.** Three things keep it honest, and all three were fixed
before any Round-3 number was seen:

1. **The floors are unchanged.** ≥75% of pages at ≤5 corrections is still the primary and still the
   launch gate. A bigger exam changes the *precision* of the estimate, not the bar it is compared to.
2. ⚠ **The Round-2 baseline column is re-measured on the grown exam.** `round2-stage2-best` is
   re-scored over the 67 pages, so every "Round-2 baseline / Round-3 floor" pair in §1 refers to the
   same instrument. Without this the table would silently compare two different exams. One CPU decode
   run; it is a **precondition of the read**, not a follow-up to it.
3. **The interval is reported beside the result**, which is the power note's option 2 taken as well.
   At 67 pages the 95% half-width is ~±10.4 pp, so a near-miss and a near-pass remain
   indistinguishable — that is stated *before* the number exists, and it does not soften §2's "a
   near-miss is a miss".

⚠ **A blind spot in §5 is now sized, and it is bigger than §5 implies.** §5 says dense
contiguous-triplet instrumentals are unmeasured. The census behind this addendum shows the exam grades
**326 of 608** candidate strips on its own pages — the other 282 are dropped as `split_wide` (203) or
`over_budget` (78), i.e. the **wide and the dense** ones ([../METRICS-EXAM.md](../METRICS-EXAM.md)).
So the exam reads each page on its easier material. This does **not** change the floors either: the
bias runs in the same direction as the already-declared "matched upper bound" optimism, which §2
accepts on the record. It is stated so the result is quoted with it.

## 4. What makes this binding

1. **Selection happens on real-val, never on the exam.** Real-val orders candidates; it does not
   predict exam performance (measured gap 28 pp historically, 10.1 pp same-model on `_realval_v2`).
2. **The exam is taken ONCE**, on the final Round-3 model.
3. **A miss is not re-rolled on the same exam.** Diagnose on real-val; any further exam read is
   labelled in `MODEL_EVAL.md` as a second look with its leakage acknowledged.
4. **A partial pass is written up as partial**, never rounded up — and it does not open the launch.
5. **Power criterion (standing, from [round1.md](round1.md)):** a tuning sweep only runs if its
   minimum interesting effect exceeds the measured movement of the selection metric under the
   largest prior intervention (0.5 pp). The tuplet A/B clears this — the effect at stake is the
   ~9 pp `\tup3` recall drop, an order of magnitude larger.

## 5. Blind spots — the criteria must NOT be gamed on these

- **`\buyukFlat` has 0 real gold** on the exam; no real-page claim in either direction.
- **`\komaSharp` (n=14) and `\buyukSharp` (n=3) are low-n**, carry no per-class floor, stay inside
  the means, and are always printed with their n.
- **`\tup3` gold is thin everywhere** — 55 groups on the exam, 54 in the A/B slice — and is
  common-case k=1 material; dense contiguous-triplet instrumentals remain unmeasured.
- **The exam is a matched upper bound**, and its crops carry old-slicer defects the current slicer no
  longer produces, so it slightly over-measures robustness to retired defects.
- **Training-pool label noise** (~7% pitch, ~38% structural tie annotation) bounds how much of a
  residual miss is the model's fault.
