# Labeling — the conventions real-page labels must follow

purpose: the rules a real-page label obeys — what is a token, and what is label-free ink
audience: agents and the owner working the real-page track
updated: 2026-08-22

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

> The two review queues that were run through `review_ui.py` — **`realval-hard`** (2026-07-28) and
> **`reslice-all`** (2026-07-31) — moved to [labeling-queues.md](labeling-queues.md) on 2026-08-07.

## What we do NOT label — the arc (2026-08-22)

⛔ **`\tie` is RETIRED. Do not type it, and do not emit it.** An arc on the page — tie or slur — is
**label-free ink**, the same treatment `drawSlurArc` already gets. Two tied notes are written as two
plain notes: `la'2 \tie la'8` becomes `la'2 la'8`. Same pitches, same total length, one token fewer.

**Why this is safe.** A tie only ever exists in our labels for a mechanical reason: SymbTr stores a
long value like 5/8 as ONE event, and no single notehead draws 5/8, so `tieSplitBeats`
(`tools/render/rhythm.ts`) writes a pair. Both halves are the **same pitch** and they **sum to the
original duration**, so dropping the token loses no note, no pitch and no bar arithmetic. The only
loss is playback: the app re-strikes where the page holds. The owner accepted that — for learning
notes and fingering it is invisible.

**Why it was worth doing, measured over the 20 non-frozen queues.** The token had three producers and
they disagreed about what it meant. Classified by whether the notes either side share a pitch (a tie
can only join identical pitches):

| where the `\tie` came from | real (same pitch) | impossible (different pitch) |
|---|---|---|
| `label`, in the emitter-derived pools | **407 (100%)** | 0 |
| `label`, in decode-seeded queues (batch1/2/3, reslice-all, photo-gold, realval-hard) | 3,080 (29%) | **7,132 (68%)** |
| `decoded` (the model) | 4,192 (27%) | **10,943 (70%)** |
| `corrected_label` (saved human verdicts) | 176 (20%) | **681 (78%)** |

The derivation from SymbTr is exact; every wrong one came from a model decode. ⚠ **404 of the human
ones were the owner's own**, and they are not carelessness — a curve joining two *different* notes is
a **slur**, and the owner was labelling the ink on the page. That is the confusion the retirement
removes.

**What was removed.** 10,951 from `label`, 15,611 from `decoded`, 872 from saved verdicts across
11,801 rows; 652 from the five real manifests (`strips_nota` 563, `strips_r1` 57, `strips_b8` 24,
`strips_tup` 7, `strips_exam_v3` 1 — all same-pitch, i.e. all genuine). `.bak-notie` sits beside every
edited file.

⛔ **`strips_exam_v2/` and `strips_exam_v2_clean/` were NOT touched** (594 ties). They are the record
of what Round 2 was graded on; rewriting them makes that number unreproducible.

⚠ **`\tie` stays in `ADDED_TOKENS` at its existing position.** Ids are append-only — removing it
would shift every later token and break every checkpoint. It is a token nothing emits, which is also
what lets Round 4 bring it back.

✅ **THE RENDER SIDE LANDED 2026-08-22** — the deadline item is done, before the final render rather
than after it. `measureAtoms` (`tools/render/lilypond.ts`) no longer writes the token: the 1,246 ties
over 1,185 of `strips_v5_tupnew`'s 40,826 strips become plain note pairs at the next render. **The
picture does not change** — SheetView still draws the arc from `tieSplitBeats`, so an arc is now ink
with no token, exactly like a slur distractor.

⚠ **ONE THING HAD TO CHANGE WITH IT, AND IT WAS NOT PREDICTED: the tie tail now RESTRIKES its
accidental in `every` mode.** The tail used to be spelled bare on the rule "engraving never restrikes
a tied-to note", and the `\tie` token carried the pitch. With the token gone, a bare tail in a mode
that has no accidental carry reads as *unaltered* — a silent pitch error in the gold. It is not a
corner case: **9,979 of 40,826 strips (24.4%) are `every` mode** and **199 of the 1,246 ties sit on an
accidented note**. The stitcher round-trip caught it immediately (10 of 218 scores failed on pitch).
The fix is symmetric on both sides — the tail spells through `noteToLily` and SheetView calls
`applyAccidental` on it — so pixels still equal labels. In `measure` (carry) mode both sides are a
**no-op**: the head's alteration is already in effect, so the tail stays bare exactly as before.

⚠ **It adds ink to 160 strips (0.39%), and ink moves crops.** A restruck accidental widens the
measure, which can push a later glyph past a strip's rect edge. Measured on the worst piece in the
corpus (`rast--sarki--curcuna--icime_hep`, 29 accidented ties): the control render verified
**265/265 exact**, the new one **261/263** — 2 strips where an accidental landed in the neighbouring
crop. This is the **existing** flagged-strip class (`strips_v5_tupnew` carries 15 of them), and the
existing remedy applies unchanged: `verify-labels.ts` flags them and `make_round3_colab_zip.sh`
refuses to ship any flagged strip that is still in the manifest.

✅ **THE REAL SIDE IS DONE TOO (2026-08-22)** — the selection gold is tie-free: **771 tokens over 576
rows in 12 manifests**, with a `.bak-notie` beside each. `_realval_v2`, its five derived pools
(`_easy`, `_mid`, `_hard`, `_scan`, `_borndigital`), the five `_realval_degraded` levels, and the v1
`_realval`. No verdict moved by itself — `eval_omr.py` drops `\tie` from **both** the gold and the
decode — but the gold now reads honestly.

**What the tokens actually joined**, over all 12 manifests:

| what the pair was | count |
|---|---|
| **different pitch — a SLUR, not a tie** | **576 (78% of the 741 resolvable)** |
| same pitch — a real tie | 165 |
| head in the previous strip | 18 |
| tail in the next strip | 12 |

So this gold carried the same three-producer confusion the retirement removes, at the same rate as
the review queues (65–78%).

⚠ **REMOVE IT AS A SUBSTRING, NEVER BY `label.split()`.** These manifests carry **two spellings** of
the same label — `a'4. \tie a'8` and the compact `a'4. \tiea'8` — and the added-token tokenizer splits
on the substring, so both mean the same thing to the model. A whitespace-token filter misses every
compact one **and still reports success**: on `_realval_v2_hard` it would have cleaned 7 rows while
reporting 25. Delete the substring, then collapse the space it leaves.

✅ **NO ACCIDENTAL RESTRIKE WAS NEEDED HERE**, unlike the render side. All 576 rows are `measure`
(carry) mode, where the restrike is a no-op, and **zero** ties crossed a barline — so no tail could
land where the carry had reset. Verified after the edit: 2,427 rows, **0 label mismatches** against a
re-tokenised backup and **0 changes to any other field**.

⚠ **ONE METRIC GOES QUIET ON REAL-VAL.** `eval_omr.py` selects its arc-triggered false-`\tup3` bucket
by `\tie` **in the gold**, so on these pools it now prints `n/a` instead of a rate. The Round-3 floor
for that metric (≤10%) is read on the **exam**, which keeps its ties, so **no criterion moved** —
only the selection-side diagnostic did. Recoverable two ways: from the `.bak-notie` files, or offline
from `piece`/`from`/`to` via `needsTieSplit`, as the note in `eval_omr.py` describes.

⚠ **`_realval` (v1) was included on purpose** though it is not a v2 pool: `build_realval_v2.py` reads
it as a **source**, so leaving its ties in would let any future rebuild put them back.
⚠ **`_realval_tier_easy` (40/160) and `_realval_tier_mid` (24/111) were left alone** — v1 tiers,
superseded by `_realval_v2_*` and read by no code. `strips_exam_v2*` keeps its 594 for the same
freeze reason.

⚠ **A PRE-EXISTING FAILURE THIS SURFACED, NOT CAUSED**: `check_token_drift` rejects `_realval_v2`,
`_hard`, `_scan` and `_borndigital` because its `\\[A-Za-z0-9]+` pattern reads the compact spelling
`\sigendd''4` as a token `\sigendd`. 45 such phantoms remain in `_realval_v2`; the count went **down**
from 51 with this edit and **zero** were added. Not fixed here — it is a guard bug, not a gold bug.
[../DECISIONS.md](../DECISIONS.md) · [../STATUS.md](../STATUS.md).
## Step 1 — collecting the pages and matching them to SymbTr → [labeling-collection.md](labeling-collection.md)

Moved out on 2026-08-22, when this file crossed the 400-line cap. Nothing was dropped; the section
map is unchanged:

| § | What it covers |
|---|---|
| §1a | neyzen.com — the SymbTr name match (`match_symbtr.py`), 85 auto-accepts |
| §1a.5 | the Round-0.5 labeler fine-tune that seeds the emitter |
| §1b | notaarsivleri.com — the SymbTr-first download, full run |
| §1c | targeted TUPLET collection, and the 59-id budget blind spot it exposed |
| — | the 2026-08-11 SUPERSEDED note: the tuplet queues are finished and promoted |
