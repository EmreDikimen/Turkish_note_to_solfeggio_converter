# Metrics — the model-voted key signature, audited

purpose: the single home for what the signature vote actually changed in the real-page labels, pool by pool
audience: agents and the owner working Round 4 step 3
updated: 2026-09-06

The mechanism, how it was found, and why it is dangerous are in
[METRICS-CORPUS.md](METRICS-CORPUS.md); the proposed rule change is
[BACKLOG.md](BACKLOG.md) item 9 and [rung3/round4.md](rung3/round4.md) step 3. This file holds only
the measurement, taken 2026-09-06 by
[../scripts/rung3/sig_vote_audit.py](../scripts/rung3/sig_vote_audit.py) — no GPU, no decode, no
labelling. It reads each pool's `emit_report.json` (did the override fire?), its
`emit_requests.json` (what signature was written), the piece's own `labels.json` (what SymbTr
derived) and `data/makam_signatures.json` (what the makam usually prints).

⚠ **Read the caveats at the bottom before quoting any row.** The makam table is a guide, not gold.

## The finding

**Half of every override changes nothing but the drawn order, and most of the rest deletes an
accidental the derivation had.** Over the five pools, 1,380 pieces had their signature overwritten
by the vote and 1,292 of those wrote a label that can be compared:

| what the override did | pieces | share of 1,292 |
|---|---|---|
| **order only** — same accidentals, different drawn order | **602** | 47% |
| **drops** at least one entry (463 entries in all) | **410** | 32% |
| **adds** at least one entry (294) | 251 | 19% |
| **alters** the accidental on a letter both sides carry (160) | 156 | 12% |

The last three overlap — one override can drop one entry and alter another — so they do not sum to
690. The two clean facts are that **602 of 1,292 change no pitch at all**, and that **dropping an
entry is the single largest content change**, ahead of the koma/küçük confusion the defect was found
through.

## Per pool

`aligned` is pieces the emitter could align at all (the rest never reach the vote). `written` is
pieces whose override actually reached a label — 88 fired but kept no strip, so nothing was written.

| pool | pieces | aligned | override fired | split vote | written | order only | drops | adds | alters |
|---|---|---|---|---|---|---|---|---|---|
| exam v3 | 45 | 45 | **24 (53%)** | 12 | 22 | 5 | 5 | 7 | 9 |
| `strips_b8` | 1,293 | 1,236 | **826 (67%)** | 116 | 767 | 403 | 200 | 147 | 76 |
| `strips_nota` | 938 | 778 | **406 (52%)** | 224 | 390 | 194 | 139 | 54 | 45 |
| `strips_tup` | 293 | 277 | **98 (35%)** | 21 | 90 | 0 | 45 | 31 | 20 |
| `strips_r1` | 65 | 63 | **26 (41%)** | 23 | 23 | 0 | 21 | 12 | 6 |

⚠ **`strips_b8` is the pool that matters** — it is the real training pool, and two thirds of its
aligned pieces had their signature decided by the model.

⚠ **Each pool was voted by a DIFFERENT checkpoint**, so the pools are not one measurement:
`rung3-labeler` for exam v3 / `strips_nota` / `strips_tup`, `round2-stage2-best` for `strips_b8`,
`rung22-stemfix-best` for `strips_r1` (each pool's `emit_report.json` `params.checkpoint`).

## The dropped entries — the class nobody was looking for

Of the 131 letter-level cases where the written signature is missing an entry the makam table calls
majority, **106 are entries the SymbTr derivation also had and the vote deleted**; 25 are entries
neither side had. So the common shape is not "the model chose the wrong accidental" but **"the model
did not see an accidental, and its silence overwrote a correct entry"** — and the `nd` gate is blind
to `\sig` blocks, so nothing downstream could catch it.

## The altered accidentals — vote against derivation

160 letters where both sides print an accidental and they disagree, all five pools:

| derived → voted | n |
|---|---|
| `\kucukSharp` → `\komaSharp` | 30 |
| `\komaFlat` → `\kucukFlat` | 29 |
| `\kucukFlat` → `\bakiyeFlat` | 26 |
| `\komaFlat` → `\bakiyeFlat` | 18 |
| `\kucukFlat` → `\komaFlat` | 14 |
| `\kucukSharp` → `\bakiyeSharp` | 8 |
| `\bakiyeSharp` → `\komaSharp` | 8 |
| `\bakiyeFlat` → `\kucukFlat` | 8 |
| `\bakiyeFlat` → `\komaFlat` | 7 |
| `\bakiyeSharp` → `\kucukSharp` | 5 |
| the remaining 4 directions | 7 |

⭐ **`\kucukSharp` → `\komaSharp` is the biggest single direction (30)** — the exact direction the
owner corrected **10 times out of 10** by hand on the exam and the `gold_conflict` queue
([METRICS-CORPUS.md](METRICS-CORPUS.md)). ⚠ It is not one-way overall: `\komaFlat` → `\kucukFlat`
runs 29 the other way on the flat side. The vote is noisy in both directions, not simply koma-biased.

## Against the makam table

Verdicts for the 1,292 written overrides, comparing the written signature with
`data/makam_signatures.json`'s majority variant for the piece's makam:

| verdict | n | meaning |
|---|---|---|
| `match` | 965 | identical to the table's majority variant |
| `match_other_variant` | 152 | not the majority, but a variant the table does list |
| `missing` | 91 | the table has a letter the written signature does not |
| `altered` | 51 | same letter, different accidental |
| `extra` | 3 | the written signature prints a letter the table does not have |
| `makam_not_in_table` | 30 | the makam is absent from the table — unjudgeable |

**145 pieces disagree** (`altered` + `missing` + `extra`); the list is
`data/real/rung3/sig_vote_audit.csv` (gitignored). The makams with the most disagreements are
buselik (10 missing), hicazkar (9), karcigar (9 + 3 altered), kurdilihicazkar (8), suzinak (8) and
sedaraban (7 altered).

⚠ **30 pieces cannot be judged at all**: 14 makam names in the corpus have no table entry —
`arazbar_buselik`, `askefza`, `dilkeshaveran`, `evc_huzi`, `gulizar`, `hicazasiran`,
`huseyniasiran`, `huzi`, `mustear`, `nevruz`, `nuhuft`, `rehavi`, `seddiaraban`, `tahirbuselik`.
(`seddiaraban` and `sedaraban` are the same makam spelled two ways — a name-alias gap, not a missing
makam.)

### The exam's three disagreements

All 45 exam pieces aligned; 24 overrides fired, 22 wrote a label, and 3 disagree with the table:

| makam | voted | table majority | derived | what changed |
|---|---|---|---|---|
| mahur | `\bakiyeSharp f` | `\kucukSharp f` (n=35) | `\kucukSharp f` | altered f |
| muhayyerkurdi | `\komaFlat b \bakiyeSharp f` | `\kucukFlat b` (n=35) | `\kucukFlat b` | altered b, plus an extra `\bakiyeSharp f` |
| şehnaz | `\bakiyeFlat b \komaSharp f \bakiyeSharp c` | `\bakiyeFlat b \bakiyeSharp c` (n=9) | (empty) | extra `\komaSharp f` |

⚠ **A separate, earlier count over a WIDER denominator, moved here from
[METRICS-CORPUS.md](METRICS-CORPUS.md) 2026-09-06 so it keeps one home**: of the **36 exam pieces
whose label carries a signature at all** (overridden or not), **8 (22%) disagree with the table's
majority variant**, several of them *missing* an entry the table calls near-universal:

| makam | the label says | the table's majority | weight |
|---|---|---|---|
| huseyni | `\komaFlat b` | `\komaFlat b \bakiyeSharp f` | 100% |
| nikriz | `\bakiyeFlat b` | `\bakiyeFlat b \bakiyeSharp f \bakiyeSharp c` | 94% |
| segah | `\komaFlat e \bakiyeSharp f` | `\komaFlat b \komaFlat e \bakiyeSharp f` | 93% |
| mahur | `\komaSharp f` | `\kucukSharp f` | 67% |

⚠ **The 3 above and this 8 are different denominators, not a changed number**. The 3 counts only the **24 pieces where the
override fired**, and does not count a signature matching a non-majority variant the table lists (6
more here). Both are correct about what they measure.

## How much would go to review

Row-start strip counts are the aligned rows of each affected piece — an upper bound, since the
signature is a **piece-level** question and one crop per piece is enough to answer it.

| rule | pieces | row-start strips | `strips_b8` alone |
|---|---|---|---|
| A — send only where the vote disagrees with the makam table | 145 | ~765 | 61 pieces / ~375 strips |
| B — send wherever the vote changes the derivation's CONTENT | 690 | ~4,668 | 364 pieces / ~2,629 strips |

Rule A is [BACKLOG.md](BACKLOG.md) item 9's proposal. Rule B needs no makam table, so it also covers
the 30 unjudgeable pieces, and it is the only one that reaches the 410 dropped-entry cases.

## ⭐ What the owner chose — rule D, on the MAJORITY spelling (2026-09-06)

Neither A nor B. A piece goes to review when the vote **deletes or changes** an accidental **and**
the result is not the makam table's **majority** spelling (or the makam is not in the table at all).
A vote that only **adds** or only **re-orders** still applies. **224 pieces / ~1,198 row-start
strips; 84 pieces in `strips_b8`.**

⚠ **"Majority", not "any listed variant", and the difference is the whole point.** The first form of
the rule accepted any spelling the table lists. That lets **395** drop/alter overrides through — 313
onto the makam's majority spelling, which is fine, but **82 onto a minority listed variant**:

| makam | pieces |
|---|---|
| mahur | **31** |
| rast | 9 |
| suzinak | 9 |
| segah | 8 |
| huzzam | 7 |
| nisaburek | 6 |
| the remaining 6 makams | 12 |

⛔ **Mahur is 31 of the 82, and mahur is where the defect was found.** The table lists both spellings
(küçük n=35, koma n=17), so the looser rule vouches for a vote that reads küçük as koma — the exact
direction the owner corrected **10 times out of 10** by hand. Tightening to the majority spelling
costs 82 more pieces of reading and closes it.

Built in `emit_strip_labels.py` the same day (`sig_needs_review`, reason `sig_table_conflict`);
`review_ui.py` needed no change, since it builds its reason filter from the rows. Unit-tested, **no
pool re-emitted yet**. [DECISIONS.md](DECISIONS.md).

## Caveats — what this does NOT claim

- **The table is a guide, not gold.** Mahur genuinely prints both ways in our own sources (küçük
  n=35, koma n=17). A disagreement is a row to look at, never an automatic correction.
- **No error rate is claimed.** Nothing here was read by a human. The only hand-read signature
  numbers remain the exam's 10 corrections and `b8-audit`'s 2 ([METRICS-CORPUS.md](METRICS-CORPUS.md)).
- **The derivation is not gold either.** The override exists because SymbTr's content-derived
  signature is genuinely not what a real edition prints — that is why "drops an entry" is
  *suspicious*, not *wrong*.
- **These are the emits as they stand**, dated July 2026 for `strips_nota` / `strips_tup` /
  `strips_r1` and August for `strips_b8` / exam v3. Round 4's re-emit redoes them, so these are the
  labels that were **trained on**, not the ones that will exist.
- **The makam comes from the `matched/` folder name**, which is how the pipeline filed the piece.

## A correction to an earlier count

[METRICS-CORPUS.md](METRICS-CORPUS.md)'s split-vote column read 384 / 37 / 25 for `strips_nota` /
`strips_tup` / `strips_r1`. Those counted every piece whose report row lacks a `sig_majority_ok`
key — pieces the emitter **never aligned**, which never reached a vote — together with real split
votes. The genuine counts are **224 / 21 / 23**. The exam's 12 was right because all 45 of its
pieces aligned. Nothing else in that table changes.
