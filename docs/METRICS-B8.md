# Metrics — the B8 re-emit and the human fixes it did not carry

purpose: what re-emitting the three training pools onto the CURRENT crops yielded, and what it cost
audience: agents working the real-page track who need the b8 pool's numbers and its traps
updated: 2026-08-31

> Split out of [METRICS-CORPUS.md](METRICS-CORPUS.md) on 2026-08-31 at the 400-line cap, by phase:
> that file holds the standing corpus census, this one holds the re-emit. Current state and next
> action are NOT here: see [STATUS.md](STATUS.md). Queues: [rung3/labeling-queues.md](rung3/labeling-queues.md).

## The re-emit: what it yielded, and what it does NOT carry (2026-08-21)

`emit_strip_labels.py` over the **1,293 non-exam matched pieces**, `--strips-root
data/real/strips_v2`, `round2-stage2-best` doing both emitter jobs, into `data/real/rung3/strips_b8`.
**37 minutes** on the M4 at `OMR_ORT_THREADS=2 nice -19`: 1,704 page decodes were reused from the
2026-07-29 re-slice (same checkpoint, same `window_cache_ok` signature) and only **16 pages** were
decoded fresh, so the GPU half of the job had already been paid for.

| | |
|---|---|
| pieces | 912 ok / 324 low_coverage / 57 missing_pages |
| rows | 3,440 ok + 950 `recovered_dc` + 3,616 `recovered_dn`, **3,984 unaligned (33%)** |
| strips | **accepted 3,955** · review 4,738 · dropped 24,837 · audit sample 201 |
| drops | **split_wide 10,226** · row_unaligned 7,446 · **over_budget 4,012** · nd_high 3,053 · empty_range 43 |

**Yield: 3,955 against the old pools' 2,330 (+70%)**, which is the referee argument paying out —
the weak referees dropped 10,695 strips on row alignment alone. ⭐ **Width and budget now dominate**:
`split_wide` + `over_budget` = **14,238 strips**, nearly twice what alignment loses, so the 59-id
budget measurement ([BACKLOG.md](BACKLOG.md) item 7) is now the biggest single lever on real training
volume, not a tidiness item.

### ⚠ The 1,442 human corrections do not come back by themselves

Matching old rows to new by **measure span** (`page`, `from`, `to`), which is the only sound key:

| old row | n | where it landed now |
|---|---|---|
| never touched by a human | 844 | 704 on the same measures — and **687 (98%) got an identical label** |
| **human `fix`** | **1,442** | 445 same measures · 506 → `b8-review` · 248 same FILENAME only · 223 dropped · 20 not produced |
| human `ok` | 44 | 16 same filename only · 10 review · 10 not produced · 8 dropped |

⭐ **The 98% row is what makes the rest readable.** On rows no one edited, the emitter reproduces its
own July output almost exactly, so it has not drifted. Which means the disagreement on the corrected
rows — of the 445 human fixes that land on the same measures, the fresh machine label matches the
human on only **41** — is most likely the machine repeating the error the person fixed. ⚠ **That is an
inference, not a measurement**: the pre-correction labels were overwritten at promote time, so the two
cannot be diffed directly. The observed differences are the known tie/rest conventions
(`g''4. g''4` vs `g''2 \tie g''8`; `e''4 r8` vs `e''4.`).

### ⭐ Carried, measured, and largely redundant — the 2026-08-31 read

`scripts/rung3/carry_old_fixes.py` located every retired-pool correction again and marked it in the
b8 queues. The key is the measure span **the slicer itself recorded** —
`(page, system, meas_from, meas_to)` out of each crop root's `<page>_manifest.json` — never the
filename. ⚠ Those indices are ROW-LOCAL, so `system` is part of the key and a page whose two slicers
disagree on staff-row count is **refused, not guessed** (654 of 1,779 shared pages).

⚠ **The key was validated before it was trusted**, against the one place a real SymbTr span exists on
both sides: where it says SAME, the SymbTr span agrees on **1,002 of 1,026 (97.7%)**; where it says
DIFFERENT, **35 of 36** really are different.

| old human fix (n = **1,479** distinct) | span-matched | filename only |
|---|---|---|
| lands in `b8-full` (already accepted) | 588 | 103 |
| lands in `b8-review` | 460 | 64 |
| lands on a strip the emitter DROPPED | 113 | — |
| not produced at all | — | 151 |

⭐ **The owner had already redone most of it by hand.** Of the **198** span-matched fixes that
disagree with b8's own label inside `b8-full`: **122 he had fixed identically**, 18 differently, 22 he
read as `ok`, 33 were still machine drafts, 3 bad. So two independent human reads of the same music,
on different crops months apart, agree **122 of 140 = 87%** — the strongest quality signal either
label set has. ⛔ **A span match is the same BARS, never the same pixels**: of the 1,215 crops
carrying a hint, **0 are byte-identical** and **77.7% changed size** (median +9 px wide; height
unchanged on every one). That is why the hint is a suggestion with its own accept button and plain
`ok` never stores it.

⏭ **`b8-review`'s 450 promotable old fixes are deferred to Round 4** (owner, 2026-08-31): +11% volume
on a pool that had already grown +70%, spread over 206 pages of which 43 are new. ⚠ 197 of the 460
carry a `\sig` block, which is unverified by standing rule.

⚠ **Carry by measure span, NEVER by filename.** 248 of the 1,442 fixes match a new strip's *name*
while covering different music — the standing re-slice trap, and here it is quantified.
**951 of 1,442 (66%) are recoverable now** (445 accepted + 506 in review); the remaining 243 need the
width/budget rails to move.

⚠ **`\sig` blocks in this pool are unverified like every other real-page pool** — 1,622 of them, voted
by a model rather than derived ([below](#the-key-signature-is-decided-by-the-model-not-by-symbtr-found-2026-08-21)). The voter here is
`round2-stage2-best` rather than the weak labeler, which should help and has not been measured.
