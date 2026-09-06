# Hand-test pages — the page-level instrument

purpose: the numbers for the owner's fixed hand-test set — what it is, what one decode of it measured, and what may not be claimed from it
audience: anyone comparing two models on whole pages, or reading a corrections-per-page number

updated: 2026-09-06

> Current state and next action are NOT here — see [STATUS.md](STATUS.md). The plan this serves is
> [rung3/round4.md](rung3/round4.md); the reason it exists is [BACKLOG.md](BACKLOG.md) item 6.

## What it is

**20 pages the owner supplied on 2026-09-06**, outside the frozen exam, decoded once and loaded into
`review_ui.py` as queue **`handtest`**. It is the page-level instrument this project has never had:
the exam scores strips and drops 41% of its candidates, real-val is 262 strips with a CI half-width
that hides any gain under ~5%, and the owner's judgement of the app has so far been on whatever page
happened to be open. Here every model reads **the same pages** and the number is **corrections per
page** — the unit a user actually experiences.

⚠ **The pictures are not in the repo.** `exam_pages/` is gitignored (2026-09-06): they are someone
else's engraving and this repo is public. The crops and decodes live under
`data/real/rung3/_handtest/`, also gitignored.

## What the verdicts mean

Different from every other queue — this is a correction count, not a label pass:

| verdict | meaning |
|---|---|
| `ok` | the model read this strip correctly — costs the user nothing |
| `fix` | the model got it wrong — type what the page actually says |
| `bad` | the crop is unusable — the slicer's fault, not the model's |

**Corrections per page = the rows that are not `ok`.**

⛔ **It is not gold and it is not the exam.** `label` is empty on every row, the client clears
`corrected_label` on `ok`, and the filename is neither `emit_review.csv` nor `full_audit.csv` — the
only two `promote_labels.py` reads. Those are the same two guarantees `r3-exam-errors` carries, and
they matter more here: the `decoded` column comes from `r3a-stage2-best-real`, the model serving the
live site, so promoting it would be the circularity [../CLAUDE.md](../CLAUDE.md) forbids.

## The first decode (2026-09-06, `r3a-stage2-best-real` int8)

The shipped runtime, `OMR_ORT_THREADS=2`, on the laptop.

| | |
|---|---|
| pages decoded | **20 of 20**, no failures |
| staff rows found | 182 |
| strips | **515** |
| wall clock | 211 s — **~10.5 s a page** |
| `hit_cap` (decode stopped at the length cap) | **0** |

### Structural tells — 62 of 515 rows

Computed without gold, so they say *where to look*, never *what is wrong*. Every row-start strip of
one page should read the **same** key signature; where they disagree at least one is misread, and a
`\sig` block in a mid-row crop is invented outright because that crop cannot see a signature.

| tell | rows |
|---|---|
| `sig-differs` — a row disagrees with its page's majority signature | **18** |
| `low-confidence` — min token log-prob < −1 | 18 |
| `near-empty` — 3 tokens or fewer | 15 |
| `midrow-sig` — a mid-row crop emitted a `\sig` block | 7 |
| `sig-unclosed` — opened a `\sig` that never closes | 4 |

⭐ **6 of the 20 pages have rows that disagree with each other about the key signature.** The worst
is a faded archive scan: **6 different signatures across its 9 rows**, plus 13 low-confidence strips.
That the signature is the largest error class is Round 4's root cause #2
([rung3/round4.md](rung3/round4.md)); this is that finding arriving from a third direction, on pages
from a source the corpus does not contain.

## What may NOT be claimed from this

- ⛔ **No accuracy number.** Nothing here has been read by a person yet, so there is no
  corrections-per-page figure for any model — only the decode and the tells above.
- ⛔ **Not comparable to `examv3`.** Different pages, different sources, no gold, and the exam's own
  numbers come from a strip-level scorer over a filtered candidate set.
- ⚠ **A verdict is given against pixels.** If the slicer changes, the crops move and the verdicts do
  not transfer; re-running `build_handtest_queue.py` carries them by strip name, which is only valid
  while the crops are the same. Bump nothing and re-read if `GEOMETRY_REV` moves.
- ⚠ **The set is not checked against the exam.** Three of the 20 titles were matched against
  `testset.json` and none is an exam piece; **17 are unchecked**. It matters only if these pages ever
  become training data — as a read-only hand test they are safe either way.
- ⚠ **n = 20 pages.** A difference of one or two corrections per page between two models is not a
  result at this size.
