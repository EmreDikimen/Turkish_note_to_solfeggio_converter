# Third-source probe — does the model hold up on an engraving house it has never seen?

purpose: the design, the sources, what was collected, and the provenance traps found while collecting
audience: agents and the owner working Round 4 step 4
updated: 2026-09-06

> Part of the real-page track — index: [README.md](README.md). Current state and the next action are
> NOT here: [../STATUS.md](../STATUS.md). The plan this executes is [round4.md](round4.md) step 4;
> the reason it exists is [../BACKLOG.md](../BACKLOG.md) item 10.

## Why

Every page this project owns comes from **two websites** — 1,055 neyzen.com + 1,000
notaarsivleri.com — and so does the exam. So every accuracy number it has ever produced carries an
unstated limit: *on these two engraving houses*. A collapse on a third would be the most valuable
finding available; a pass retires the worry cheaply.

⛔ **A probe is not a corpus.** Everything lands under `data/real/rung3/_thirdsource/` and is
deliberately kept out of `data/real/manifest.csv` and `data/real/rung3/matched/`, both of which are
read by flows that build training pools and the exam. Changing either mid-round would make the
Round-3 read comparable to nothing.

## The sources, and why these three

Collected by [`collect_thirdsource.py`](../../scripts/rung3/collect_thirdsource.py) on 2026-09-06.
None of the three serves a `robots.txt`; the collector holds a 1.5 s floor between requests anyway.
Licence: [../THIRD-PARTY.md](../THIRD-PARTY.md) — read locally, never redistributed, exactly as the
two existing sources are.

| source | what it is | catalogue | why it earns a place |
|---|---|---|---|
| **sahaney.com** | born-digital **vector**, produced by **Mus2 2.1.2** | 2,213 PDFs behind a Ninja Tables endpoint carrying title / makam / form / usul / composer | Mus2 is a Turkish makam notation program **neither of our sources uses**, and the metadata means SymbTr matches on fields rather than on a filename |
| **erdincbal.com** | **scans** of TRT Müzik Dairesi editions **and** the site owner's own engravings, on Google Drive | 685 pieces over the four instrumental archives | its archives are indexed **by form** — sirto, longa, peşrev, saz semaisi — the tuplet-dense repertoire [../DECISIONS.md](../DECISIONS.md) (2026-08-20) names as a measured structural hole |
| **sarkilarnotalar.blogspot.com** | scans and photocopies of **old prints**, posted as JPGs | 2,574 posts | the owner asked for it by name (2026-09-06). The most degraded material in the probe — ⚠ **and the one with a provenance problem, below** |

⛔ **nota.trt.net.tr was dropped**: its note library redirects to a login. No account was created.
⛔ **divanmakam.com was dropped**: it is a forum, so its notes are user attachments of mixed and
unrecorded provenance — the opposite of a controlled third engraver.

**The engraving really is different, checked on the PDF producer** rather than assumed: sahaney is
`Mus2 2.1.2` via Qt, erdincbal's files pass through `PDFsam`/Sejda (a splitter — the engraving is
whatever it wrapped), while our own corpus is `Adobe Acrobat Image Conversion` (neyzen, i.e. scans)
and `GPL Ghostscript` / `doPDF` (notaarsivleri).

## What was collected

Selection is auditable — `select` writes `sample_<source>.csv` before `download` will run, and
`download` refuses to start without it.

| source | pieces | pages | staves | strips | est. ids > 59 | median est. ids |
|---|---|---|---|---|---|---|
| sahaney | 14 | 18 | 140 | 379 | 66 (17%) | 40.1 |
| erdincbal | 14 | 27 | 200 | 552 | 127 (23%) | 45.8 |
| blogspot | 8 | 8 | 64 | 177 | 41 (23%) | 47.1 |
| **total** | **36** | **53** | **404** | **1,108** | 234 | — |

⭐ **The slicer found staves on all 53 pages — zero failures**, including the photocopies. Nothing is
decoded yet.

**Two filters ran on the selection.** **27 exam pieces were refused** (13 sahaney, 14 blogspot) — a
probe sharing music with the graded set is not a neutral read. And every chosen piece is **unseen by
`strips_b8`**: a piece the model has already read in another engraving is the one case where a good
score could be the music rather than the printing.

**Free labels**, from SymbTr metadata matching (`collect_nota.score_row`, so `accept` means what it
means for notaarsivleri): sahaney **496 accepts** of 2,213 and erdincbal **75** of 685. ⛔ **The
blogspot gets none** — its titles are lyric incipits with no makam column, so the makam hard-filter
cannot run; searching every piece instead produced 2,012 `review` rows and **zero** accepts. Its
pages need hand labels or a page-level correction count.

## ⚠ Two provenance traps, both found by looking at the pages

**1. The blogspot re-hosts other archives, including one of this probe's own sources.** Its page for
*Gül açar bülbül öter yaz geçer* is watermarked **`www.erdincbal.com`** and is a TRT Müzik Dairesi
edition — the same publisher as the erdincbal column. So the blogspot is **not an independent third
source**; it is a mixed re-poster. Read of the 8 collected pages by eye:

| page | what the header says | verdict |
|---|---|---|
| gül açar bülbül öter | **www.erdincbal.com** + TRT Müzik Dairesi | ⛔ re-hosted from another probe source |
| hey onbeşli | TRT Müzik Dairesi, **THM** repertuar 1616 | ⛔ **folk (THM)** — a notation this project deliberately never touches (numbered bemol-2/3 signs, no tokens) |
| beğendim biçimini | clean typeset, no watermark | ✅ unknown publisher |
| bu yaz geçen günlerimiz | very dark photocopy, no watermark | ✅ unknown publisher |
| her şeydi benim için | a 2001 **fax** from TRT Müzik Dairesi, handwritten title | ✅ unknown publisher |
| nerelerde kaldın | calligraphic handwritten title | ✅ unknown publisher |
| sevdamı dilim anlatamaz | old typeset print, carries triplets | ✅ unknown publisher |
| yemeni bağlamış | typewriter title | ✅ unknown publisher |

**2. Two different pieces can share a page stem, and the second silently overwrote the first.**
erdincbal titles a piece by makam and form alone, so Rauf Yekta's and Gazi Giray's `MÂHUR PEŞREVİ`
produced one stem — and the download lost a piece with nothing on screen to say so. Fixed in the
producer (`_unique_stems` disambiguates on the composer and hard-fails if a collision survives),
which is where every other pool on disk keys by stem. It had already happened once when it was found.

⚠ **A third trap was caught by a guard rather than by eye**: the first blogspot run kept any image
whose filename matched `nota`, and every post's banner is called `notalar.jpg` — so all ten
"pages" were a 1020×250 banner. Selection is on **size** now, with a post-download minimum, so a
wrong pick cannot pass silently.

## The read (2026-09-06) — a NULL, and the probe is not powered to be more

Decoded with `round2-stage2-best` producing the labels and **Run A `r3a-stage2-best-real`** graded
on them, so the model that writes the answer key is not the model being scored
([`score_thirdsource.py`](../../scripts/rung3/score_thirdsource.py)).

### 1. Yield — label-free, and it holds

The emitter keeps a strip only when the model's decode aligns with the SymbTr-derived label. On a
source the model cannot read, alignment fails and the accepted share craters. It did not.

| pool | accepted / total | yield | rows that failed to align | pieces `ok` |
|---|---|---|---|---|
| `strips_b8` (our two sites) | 3,955 / 33,530 | 11.8% | 33.2% | 70.5% |
| `strips_nota` (one of them) | 1,262 / 16,152 | 7.8% | 36.9% | 46.9% |
| **the probe** (sahaney + erdincbal) | **74 / 931** | **7.9%** | **28.6%** | **82.1%** |

⭐ **Row alignment fails LESS often on the new engravers than on our own two sites**, and more of
their pieces come through whole. The pipeline does not jam on unfamiliar printing.

### 2. Edits per strip — the raw table says degradation, the length control says otherwise

Same agreement-selected kind of row in every column, so the selection bias is matched. ⚠ `b8` is Run
A's own training pool, so the **val-side** row is the only fair one — the train-side row is printed
only to show what memorisation looks like.

| pool | n | edits/strip | 95% CI | mean gold ids |
|---|---|---|---|---|
| `strips_b8` train-side (**memorised, not a comparison**) | 400 | 0.04 | — | 35.1 |
| **`strips_b8` val-side** — our two sites, held out from Run A | 390 | **0.13** | [0.08, 0.19] | 33.5 |
| **erdincbal** — TRT-edition scans | 46 | 0.37 | [0.11, 0.67] | 33.4 |
| **sahaney** — Mus2 vector | 28 | 0.86 | [0.36, 1.46] | **40.6** |

⛔ **Sahaney's 0.86 is mostly STRIP LENGTH, not the engraver.** Its strips carry 40.6 gold ids
against 33.4–33.5 everywhere else, and long strips are already measured to read worse
([../METRICS.md](../METRICS.md)). Restricted to strips under 40 gold ids:

| pool | n | edits/strip | 95% CI |
|---|---|---|---|
| `strips_b8` val-side | 265 | 0.08 | [0.04, 0.13] |
| erdincbal | 34 | 0.24 | [0.06, 0.47] |
| sahaney | **10** | 0.20 | [0.00, 0.50] |

⭐ **0.86 → 0.20 once length is controlled, and all three intervals overlap.** So the probe shows
**no separable degradation on a third engraving house** — and at n = 34 and n = 10 it could not have
shown one smaller than about 3×. **This is a null, not a pass.**

⭐ **One side finding that is not a null and matters to Round 4**: a different engraving house packs
**more music into a staff row** — sahaney's strips run 40.6 gold ids against our 33.5. That lands
directly on the label-budget rail ([../METRICS-SLICER-WINDOWS.md](../METRICS-SLICER-WINDOWS.md)):
the budget was chosen against our two engravers' density.

## What is NOT claimed

- ⛔ **The probe did not answer its question.** It is a **null**: no degradation was separable, and
  it is not powered to separate one under ~3×. It cost a day and it bought a bound, not an answer.
  Growing it is the only way to a verdict — the cheapest path is more erdincbal pages, which need
  no hand labelling (75 SymbTr accepts exist, 14 were used).
- **The edits/strip columns are a FLOOR, not an error rate.** Every row in them was accepted because
  a model already agreed with the label. The comparison across columns is fair because the bias is
  identical in each; the absolute levels are not the accuracy of anything.
- **36 pieces is a probe, not a corpus.** It cannot support a per-class accuracy table; it can
  answer "does this collapse".
- **The blogspot column is not a clean third source** (trap 1), and two of its eight pages should be
  dropped before any number is quoted from it.
- **`match_symbtr` accepts were not read by hand.** They are the same tier notaarsivleri's pool was
  built on, at the same thresholds — which is a known ~13% label-noise level, not gold
  ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)).
