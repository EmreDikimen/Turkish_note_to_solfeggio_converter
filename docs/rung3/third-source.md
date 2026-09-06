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

## What is NOT claimed

- **Nothing is measured yet.** No page has been decoded. This file records collection only.
- **36 pieces is a probe, not a corpus.** It cannot support a per-class accuracy table; it can
  answer "does this collapse".
- **The blogspot column is not a clean third source** (trap 1), and two of its eight pages should be
  dropped before any number is quoted from it.
- **`match_symbtr` accepts were not read by hand.** They are the same tier notaarsivleri's pool was
  built on, at the same thresholds — which is a known ~13% label-noise level, not gold
  ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)).
