# The staccato distractor — Round 3's arm 2 (Lever 6): ✅ PASSES

purpose: the staccato arm in full — the hole it targets, what was drawn, the signed pre-registration, and the result it returned
audience: agents and the owner reading or extending Round 3's arm 2

updated: 2026-08-20

> ✅ **RESULT, 2026-08-20: the arm PASSES its primary and both other clauses.** The
> staccato-triggered false-dot rate goes **72.7% → 0.0%** (0 of 110 marked strips), paired **60–0**
> against its training control `r3-tupnew-stage2-best` (exact McNemar p = 1.7e-18) and **80–0**
> against the live model (p = 1.7e-24). Clause 2 **passes**: 65/71 real dots kept on easy+mid against
> the control's 66/71, one discordant strip, p = 1. Clause 3 shows **no price** — every AEU and F1
> cell level or slightly up. Every number:
> [../METRICS-UNSEEN.md](../METRICS-UNSEEN.md); the training run itself:
> [../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md) and the raw console log
> [../../round_3_staccato_logs.md](../../round_3_staccato_logs.md). The disposition is at the bottom
> of this file.
>
> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md). The lever this serves is [levers.md](levers.md) Lever 6;
> Round 3's binding floors are [round3-criteria.md](round3-criteria.md) and **nothing here changes
> them**.

## Why this arm worked when three others did not

⭐ **The transferable finding, and it is worth more than the number.** Round 3's other three
realism experiments (the tuplet mark A/B, the second engraver, the scan profile) were all nulls, and
they share a shape: each asked the model to read something it **already knew** from pixels that
looked slightly more like real pages. This arm showed it a symbol it had **never seen once** — 0 of
40,826 strips carried a staccato, and the label language had no legal way to say "dot, but not a
duration dot".

**A hole is not a domain gap, and it does not respond to the same medicine.** That is the rule this
result establishes, and it is why the `\repstart`-for-dotted-barline finding
([../METRICS-UNSEEN.md](../METRICS-UNSEEN.md)) is worth pursuing while a fourth realism arm is not.

## The hole, and what was drawn

**Owner-reported 2026-08-15, then measured.** The model reads a printed **staccato** as an
**augmentation dot** and lengthens the note. The cause is structural, not a tuning problem:

- **`ADDED_TOKENS` has no articulation token** — all 25 are accidentals, structure and navigation.
  The augmentation dot is not a token either; it is a suffix inside the duration (`8` vs `8.`). So
  the label language has **no legal way to say "dot, but not a duration dot."**
- **The renderer draws no staccato**, so 0 of 40,826 strips contain one. The same shape of hole as
  the signature-only crop, and as the bare phrase slur before it was fixed.

**Measured, with a paired control** ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)): on 110
pilot strips carrying a staccato whose gold has no dotted duration, the model decodes a dot it has
no gold for **72.7% of the time** — against **0.0% on the identical music without the marks**, which
it reads 110/110 exactly. That is as clean as a causal attribution gets here.

**Built 2026-08-15, off by default:** `--staccato-noise` (`render.ts`) → `drawStaccatoDot`
(`SheetView.tsx`), label-free dots on the notehead side, following `drawSlurArc` exactly. The two
arms' manifests are **byte-identical** and `verify-labels` passes 1215/1215 with the marks on.

**What it teaches is POSITIONAL, and that is the design.** An augmentation dot is a suffix beside
the notehead, on its line or space; a staccato sits above or below it. So the draw deliberately
seeks out **already-dotted notes** — a notehead carrying both marks at once isolates position from
everything else, and is the only example that can. ⚠ Three placement drafts were rejected by eye
before one worked; the trap is that VexFlow's `getNoteHeadBounds()` returns the notehead's **anchor**
(`notehead.getY()`), not its ink edges, so any clearance measured from it lands half a notehead too
close. Notes on a line also cannot take the adjacent space centre at all — the dot's radius overlaps
the notehead's ink there at *any* clearance — so they get the space beyond it.

**Pre-registration, signed before any training (owner: duration over pitch):**

1. **Primary — the staccato-triggered false-dot rate must fall** from the 72.7% baseline.
2. **No-regression on real dots, on EASY+MID tiers only.** Hard-tier dropped dots are scan
   degradation (7 of 12, `nd` up to 1.14) and are excluded **here, in advance** — not after seeing a
   result. Hard tier is reported, never gated on.
   > ⚠ **FLAGGED 2026-08-17, NOT CHANGED — this clause is signed, so altering it is the owner's
   > call.** The stated *reason* for the exclusion uses `nd` as a scan-quality measure, and it is
   > not one: `emit_strip_labels.py` defines `nd` as `lev(label_ids, decoded_ids)/len(label_ids)`, a
   > label-vs-decode disagreement, and there is only one `nd` in the repo. Read literally, the
   > justification says "exclude the strips where the model disagrees with the label most, because
   > the model disagrees with the label most there". The **exclusion itself may still be right** —
   > hard tier is defined independently of `nd` — but its written reason does not carry it. Decide
   > before the staccato arm is scored, not after.
   > ✅ **SETTLED 2026-08-19 (owner), before any training: the exclusion STANDS, the reason is
   > replaced.** Re-opening a signed pre-registration mid-round is what would make the round
   > meaningless, so the gate does not move a point. It survives on two reasons that hold: hard tier
   > carries **~12 real-dot instances in total**, too few to gate on in either direction, and its
   > gold is the least reliable pool we own. Hard tier stays reported, never gated on — as written.
   > [../DECISIONS.md](../DECISIONS.md).
   > ⚠ **CORRECTED 2026-08-20, after the arm was scored — the FIRST of those two reasons is wrong.**
   > `_realval_v2_hard` carries **64** gold dotted-duration instances, comparable to easy+mid's 71
   > combined ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)). The "~12" is the Round-2
   > **exam's** dropped-dot count (0/5/7 by tier) — a different pool and a different quantity. ⛔ The
   > exclusion is **not** reopened: it is signed, it survives on the second reason, and the gate
   > passed on easy+mid regardless — hard tier was reported, as written. Recorded because this
   > clause's rationale has now failed twice, in the same way both times.
3. **Reported, not gated:** pitch/AEU macro F1, so the price of clause 1 is on the record.

⚠ The slur distractor's cost is the thing to watch: it took `\tup3` precision 15.1% → 91.2% and
**recall 92.7% → 83.8%, below its own floor**. Clause 2 exists so that outcome is caught rather than
discovered. ⚠ `STACCATO_RATE` is **chosen, not measured** — nobody has counted staccato frequency in
real Turkish editions, and doing so is how to replace it. ⚠ The alternative not taken is a
`\staccato` token: possible, but `ADDED_TOKENS` is **append-only** so it goes at the END, and it
needs gold annotation and an engraver change.

## The result

Full tables — the primary, clause 2 and clause 3 — live in
[../METRICS-UNSEEN.md](../METRICS-UNSEEN.md). The training run, its loss curves and the
`best == last` note are in [../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md)
("Round 3 — arm 2").

**The strongest line in it is not the 0.0%.** The arm reads the **marked** pool exactly as well as
the **unmarked** one — 99.1% exact and SER 0.0002 on both — and its single non-exact strip is the
*same file with the same* `\bakiyeSharp → \komaSharp` *confusion* in each. The marks did not become
tolerable; they stopped carrying information about duration at all. That is what the positional
lesson looks like when it lands, and it is why the draw sought out already-dotted noteheads.

⚠ **The metric had no committed scorer until now.** The 2026-08-15 baseline was measured ad hoc, so
`scripts/rung3/staccato_falsedot_score.py` was written from the definition and its **first job was to
reproduce that baseline** — which it does to the digit (80/110, exact 27.3%, SER 0.0578) before being
trusted on the arm. `staccato_realdot_score.py` reads clause 2. ⚠ Doing that exposed something the
published number hid: the **training control sits at 54.5%, not 72.7%**. The defect's severity is not
a constant across checkpoints, so quoting the baseline as the control would have understated the arm
by roughly a quarter of its effect.

## What the arm does NOT establish

⚠ **The primary is measured on our own rendered staccato.** It shows the model no longer maps *the
dot this renderer draws* onto a duration dot. It does **not** show it reads a real printed staccato,
because **no labelled real strip in any pool carries one**. This is the identical blind spot to the
concave tuplet mark ([../METRICS-TUPLETS.md](../METRICS-TUPLETS.md)) and it has the identical fix:
collect real pages that use the mark. Until then the claim is about our renderer, not about the world.

⚠ **`STACCATO_RATE` is still chosen, not measured.** Nobody has counted staccato frequency in real
Turkish editions. Doing so is how to replace it, on the same pass as the tuplet-style count.

⚠ **The corpus's 15-strip yield drift is undiagnosed.** `strips_v6_stac` came out 40,841 against the
control's 40,826, and the dots are not the cause — the same piece re-rendered with the flag **off**
gives the same higher yield, so it is drift since the control's 2026-08-14 render. The manifest was
filtered to the control's exact row set before training, so **the arm is unaffected**, but the drift
is a live unknown in the renderer and it is not written down anywhere else.

## The disposition — OPEN, and it is the owner's

⏭ **Does `--staccato-noise` ride the final model's render?** The flag is **off by default**, so
**doing nothing leaves it out** — the same way `scan_share` was settled for arm 1.

**For:** it is the only Round-3 arm that moved its primary, and it did so at no measured cost on
either of the other two clauses.

**Against, and both halves are real:** the win is on **our own drawn mark**, with no real-strip
evidence behind it (above); and the final render **already** carries `--concave-tuplet`, so turning
both on makes that render a **two-variable change** whose parts cannot be told apart afterwards.
Round 3 has already been made unattributable twice, which is the whole reason the arms run one
variable at a time.

⛔ **Whatever is decided, it is decided BEFORE the render** — not after seeing the exam.
[../DECISIONS.md](../DECISIONS.md).
