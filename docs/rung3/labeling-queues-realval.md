# The real-val labelling queues — realval-hard, and the 2026-09-09 repair

purpose: the review queues that build and repair `_realval_v2`, the pool that SELECTS a checkpoint
audience: agents and the owner working the real-page track
updated: 2026-09-09

> Split out of [labeling-queues.md](labeling-queues.md) on 2026-09-09 at the 400-line cap. That file
> keeps the queues feeding the **training pools and the exam** (`reslice-all`, the batches, `b8`,
> `examv3`); this one keeps the queues feeding **real-val**, which selects and does not grade.
> Current state and next action are NOT here: [../STATUS.md](../STATUS.md).

---

## The `realval-hard` queue (2026-07-28) — labelling the practice test's missing hard tier

**Why it exists.** Real-val reads ~96% where the exam reads 74%, and the cause is measured:
composition. The exam is 18% easy / 41% mid / **41% hard**; real-val is 59 / 41 / **0**. A practice
test with no hard questions cannot rank candidates, which is why every round so far has been a blind
one-shot. Rebuilding it is item 1 in [../STATUS.md](../STATUS.md).

**Why it cannot be done by filtering.** "Hard" means the emitter refused the strip for
`row_unaligned` or `nd_high` — those are **drops, not reviews**, so no label was ever written
(6,168 in the nota pool alone, 13,975 across all pools). The exam has 145 hard strips only because
they were recovered and hand-labelled one at a time. There is no pile to draw from.

**The queue.** `scripts/rung3/build_realval_v2.py --queue N` selects candidates that are on the
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

Run: `.venv-ml/bin/python scripts/rung3/review_ui.py` → queue **`realval-hard-v2`**. Images resolve
from `data/real/strips_v2/<page>/<strip>`. Progress and the target mix:
`build_realval_v2.py --report`.

### ⛔ The `realval-repair` queue (2026-09-09) — 10 rows whose label is about other music

**What went wrong.** `build_realval_v2.py --build` carries rows out of the previous `_realval` pool
and copies `strip_root`'s crop under them. That pool is entirely on the **retired** root (271 of
271 PNGs), so 157 carried rows got a `strips_v2` crop under a label read against a `strips` crop,
with no measure-span check between them. The 5 duplicate manifest rows in
[../BACKLOG.md](../BACKLOG.md) item 2 were the visible tip. Every number, and the control that
proves it: [../METRICS-SLICER-ROOTS.md](../METRICS-SLICER-ROOTS.md).

⚠ **This is the same trap the paragraph above warns about**, arriving through the builder rather
than through a queue — `QUEUE_IMG_ROOTS` binds a *reviewer's* pictures to the right root, and
nothing bound the *builder's*.

**The queue.** `scripts/rung3/repair_realval_v2.py --queue` writes the **10 rows** whose measure
span moved between the two roots — the ones no re-home could rescue. 243 rows keep their label,
5 duplicate twins are dropped, 3 are re-homed onto the `strips_v2` strip carrying the same span.

- ⛔ **Rows carry NO `label`, on purpose.** The carried label is the string under suspicion;
  showing it as gold would anchor the read to exactly what the repair exists to retire. The
  verdict is against the **picture**, like `realval-hard-v2` and `photo-gold`.
- `decoded` is the **current** root's `round2-stage2-best` decode with the retired `\tie` stripped
  (`merge_redecode_into_queue.drop_ties`). Seeding real-val from that model is its standing
  exception — real-val **selects** and does not grade ([../../CLAUDE.md](../../CLAUDE.md)).
- ⚠ **No tail-accept here.** Ten rows is the whole queue; `--build` refuses while any is unverdicted.

Run: `review_ui.py` → queue **`realval-repair`**, then
`repair_realval_v2.py --build` to assemble `_realval_v2r`. ⚠ `_realval_v2` is left **intact** —
every Round-3 number was measured on it.

