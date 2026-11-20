# Third-party rights: what we use, what we may publish

purpose: the licence of every third-party thing this project touches, the rule each imposes on publishing, and the per-file audio sources
audience: whoever is about to ship, deploy, push weights, or add a file to `apps/web/public/`
updated: 2026-11-20

This file owns the **licensing facts**. Nothing else should restate them — link here.

The short version: **the deployed app now publishes none of it.** No score, no page image, no
dataset row. It ships code, a font, and a pointer to weights on the Hub. Everything third-party
stays on the developer's disk, where local use is not distribution.

## The rule, in one line each

| Thing | Licence | What that lets us do |
|---|---|---|
| **SymbTr** (score corpus) | **CC BY-NC-SA 4.0** | Train and test locally. **Publish nothing derived from it** — see below |
| neyzen.com / notaarsivleri.com page images | all rights reserved | Read locally. Never redistribute, never commit |
| **sahaney.com / erdincbal.com / sarkilarnotalar.blogspot.com page images** (the 2026-09-06 third-source probe) | all rights reserved; ⚠ **erdincbal republishes TRT Müzik Dairesi Başkanlığı editions**, so that material carries TRT's rights and not erdincbal's | Same rule as the two above: read locally, never redistribute, never commit. ⛔ The probe lands under `data/real/rung3/_thirdsource/`, is gitignored, and is deliberately kept out of `data/real/manifest.csv` and `matched/` so no training or exam flow can pick it up |
| `Flova/omr_transformer` (base model) | Apache-2.0 | Fine-tune and publish the result **with attribution + licence** |
| Bravura (font) | SIL OFL 1.1 | Ship it, with `OFL.txt` beside it — which we do. ⚠ Since 2026-10-17 its outlines ALSO ship as JSON (`public/fonts/glyph-outlines/`, for saving scores): font data in another format is a modified version under the OFL, so it sits beside the same `OFL.txt` and is **not named "Bravura"** (the Reserved Font Name) |
| React, VexFlow, ONNX Runtime | MIT | Ship, with the copyright notice |
| Base UI (`@base-ui/react`), Tailwind CSS (build tool; only its generated CSS ships) | MIT | Ship, with the copyright notice |
| **Inter** and **EB Garamond** (fonts, via `@fontsource`, bundled into `dist/assets/`) | SIL OFL 1.1 | Ship them, with the notice — the Tezhip restyle, 2026-09-30 ([features/phone.md](features/phone.md#the-look--tezhip-palette-the-stylesheets-layers-and-the-render-pin)) |
| `@techstark/opencv-js` | Apache-2.0 | Ship, with the notice |
| Turkish makam theory, AEU, 53-TET, usul names | not copyrightable | Free — facts and systems, not expression |
| **VCSL** and **VSCO 2 Community Edition** (sample libraries) | **CC0 1.0** | Serve the sample files, commercially, forever. No duty at all — a credit line is courtesy |
| **Freesound 140291** (bendir strokes) and **211133** (kanun chromatic notes), both CompMusic/UPF | **CC0** | Same. ⚠ CC0 on Freesound is the *uploader's* claim; these two are trusted on provenance |
| **Freesound 194637** (ney, Huzzam scale) — only if used | **CC BY 4.0** | Serve it, commercially, **with attribution in `/THIRD-PARTY.txt`** |
| **`Violin VL100.png`** (Wikimedia Commons — F3's fingerboard artwork) | **CC0 1.0** | Ship it, crop it, overlay it, commercially, forever. No duty at all — the credit line is courtesy |
| **`Yamaha Clarinet YCL-457II-22.png`** (Wikimedia Commons — F3's clarinet photo) | **CC BY-SA 4.0** | Ship it, crop it, overlay it, commercially — **with attribution**, and our cropped copy stays CC BY-SA. ⚠ The duty is on the IMAGE, never on the app around it |

Shipped notices live in [`apps/web/public/THIRD-PARTY.txt`](../apps/web/public/THIRD-PARTY.txt),
served at `/THIRD-PARTY.txt` and linked from the app footer.

## Why the app bundles no scores

Every score this project ever had is a SymbTr export (`ml/prep/symbtr_to_json.py`). SymbTr is
**CC BY-NC-SA 4.0**, which attaches three duties to *publishing* one:

- **BY** — attribute the dataset.
- **SA** — licence the derived file under the same terms.
- **NC** — no commercial use, **by anyone, forever**.

NC is the one that decided it. Serving a single SymbTr-derived sample would bind the whole app to
NonCommercial for as long as it is there, and unwinding it later means re-doing this pass. The owner
chose removal over attribution on 2026-08-08 ([DECISIONS.md](DECISIONS.md)).

Two of them were **also** compositions still in copyright under FSEK 5846 (life + 70), which is a
separate problem that attribution would not have fixed:

| File | Composer | Died | Protected until |
|---|---|---|---|
| `safalar-getirdiniz.json` | Avni Anıl | 2008 | ~2079 |
| `beyati-delisin.json` | Selahattin Pınar | 1960 | ~2031 |
| `gamzedeyim-deva.json` | Tatyos Efendi | 1913 | public domain |
| `sample.json` (aldanma dünya) | Zekai Dede | 1897 | public domain |

`meltem_notes.json` and `Meltem - 1. Hane.png` are a neyzen.com engraving and its transcription —
someone else's typesetting, never ours to publish.

### How that is enforced

Three independent places, because one of them is a person remembering:

1. **`SAMPLES` is empty** in [`apps/web/src/App.tsx`](../apps/web/src/App.tsx) — nothing links to a
   score, and the app opens on the upload prompt.
2. **`.gitignore`** — the files cannot be committed. They were `git rm --cached`'d out of HEAD on
   2026-08-08.
3. **`prune-dist.mjs`** deletes them from `dist/` and then **fails the build on any `.json` at the
   dist root**. That last part is the real guard: "no UI links to it" is not "not published", since
   anything under `public/` is served to whoever guesses the name. A name list would miss a *new*
   score; the root-`.json` rule does not. Own-work scores, if there ever are any, go in a
   subdirectory.

⚠ The files stay on disk on purpose. `npm test`'s round-trip corpus, `smoke:editor`'s grace-note
geometry section and [MANUAL_CHECKS.md](MANUAL_CHECKS.md#manual-checks--the-synthetic-corpus-and-the-renderer) all read them through
`?score=…`, which still works against a dev server. Regenerate them with
`ml/prep/export_scores.py` if a fresh checkout needs them.

## Audio assets — chosen, not yet shipped

✅ **The audio has landed, in two batches, and the "never bundled" rule bent once on purpose.**
F2's two CC0 drum kits (VCSL, 660 KB) **do ship with the app** from `public/audio/` — small enough
that a second host was not worth it, and since 2026-08-12 they stay there permanently because
percussion is essential to playback. F1's three voices (65.5 MB) do **not**: they are served from a
Hugging Face dataset repo through `VITE_VOICES_URL`. ⚠ Two variables, deliberately: `VITE_AUDIO_URL`
must stay unset in a deploy, or the drums follow the voices off the app and 404. Each file arrived
with the three things this rule asks for — a manifest row carrying `source` and `license`
(`strokeKits.ts`, `instruments.ts`), a line in `apps/web/public/THIRD-PARTY.txt`, and its licence
read on the source's own page. Still unlanded: **the ney row only** — the kanun landed 2026-08-14.

⚠ **"Byte-identical to the originals" is now a per-voice claim, not a blanket one.** The clarinet and
violin are copies checked by sha256 against VSCO 2 CE. The **kanun cannot be**: its source is one
two-minute take of the whole range, so its 36 notes are cut out of it and are new files by
construction. What replaces the identity check is the source take's own sha256, recorded on the
dataset card; `/THIRD-PARTY.txt` states plainly that those files are derived, so they are not
mistaken for untouched originals. Nothing is re-encoded — the mp3 is decoded once.

The per-file list, with each licence read on its own source page
and the traps found there — including a **CC0-vs-readme contradiction in VSCO 2 CE** — is
[THIRD-PARTY.md](#audio-sources--the-verified-files-and-what-each-one-still-needs).

⚠ **The one to watch is not a licence, it is a category.** Most commercial sample libraries, *paid
ones included*, forbid redistributing the sample files themselves. A web app serves the raw file and
anyone can lift it out of the network tab, so those libraries are unusable here no matter what is
paid for them. Reasoning: [THIRD-PARTY.md](#audio-policy--what-may-be-used-and-the-rules-every-file-obeys).

## Images — F3's violin, and the rule it sets

**One image has landed** (2026-08-15), for the fingerboard tab: `apps/web/public/instruments/
violin-vl100.png`, 700×951, 356 KB, **CC0 1.0**. It is
[`File:Violin VL100.png`](https://commons.wikimedia.org/wiki/File:Violin_VL100.png) on Wikimedia
Commons by the user *Just plain Bill*, a front-and-side view of a standard modern trade violin on a
transparent background.

⚠ **The derivation chain was checked, not assumed**, because CC0 on a user-upload site is the
uploader's claim and a CC0 derivative of a restricted photo would be worthless. The PNG's own page
names its source as `File:Violin VL100.jpg`, which is **the same author's own work, released public
domain** — so both links in the chain are clear and neither is somebody else's photograph.

This is the first third-party **image** the app ships, and it amends a rule rather than following
one: [features/README.md](features/README.md) said F3's artwork must be **own** artwork — drawn as
SVG or photographed by the owner. What that rule was protecting is *provenance*, after the
2026-08-08 copyright pass found instrument and score images with none. A CC0 file whose chain has
been read satisfies it; "found on the internet" still does not. Owner decision, 2026-08-15
([DECISIONS.md](DECISIONS.md)).

### The clarinet photo — the second image, and the FIRST with a duty (2026-08-29)

`apps/web/public/instruments/clarinet-ycl457-oehler.png`, 244×1560, 453 KB, **CC BY-SA 4.0**. It is
a crop of [`File:Yamaha Clarinet YCL-457II-22.png`](https://commons.wikimedia.org/wiki/File:Yamaha_Clarinet_YCL-457II-22.png)
on Wikimedia Commons — a Yamaha YCL-457II-22, **German system (Original Oehler)**, background
removed by the user *Habitator terrae*.

⭐ **It amends the image rule a second time, from "CC0 or public domain" to "attribution licences
are allowed too"** (owner, 2026-08-29). The reason it had to: **there is no CC0 photograph of a
German-system clarinet.** Every one on Commons is CC BY-SA — checked across Yamaha, Leitner+Kraus,
Rosewood Albert and Yamaha's full-Oehler. The only duty-free option was a 1910 Selmer catalogue
scan, and the owner chose the photograph that looks like the owner's own instrument over the one that costs
nothing. [features/instruments.md](features/instruments.md#f3--the-clarinet-view).

⚠ **What the duty actually is, since this is the first time the project has carried one.** Credit
the author (done, in both THIRD-PARTY files); and because our copy is **cropped and scaled**, that
copy is itself CC BY-SA 4.0 and anyone may reuse it on the same terms. ⚠ **The duty is on the image
and does not reach the app's code** — this is not the SymbTr situation, where a NonCommercial score
would have bound the whole product forever.

⚠ **The chain was followed to the root, and at first glance it looks like exactly the thing this
rule exists to stop**: the file's metadata says `Artist: Yamaha` with no permission statement, which
reads as a user re-licensing a manufacturer's photograph. It is not. The root
[`.tiff`](https://commons.wikimedia.org/wiki/File:Yamaha_Clarinet_YCL-457II-22.tiff) carries a
**VRT permission ticket, 2017012510009331**, from Yamaha Music Europe. ⛔ Two other candidates were
checked the same way: Leitner+Kraus also has a ticket (2019102110004312); the Rosewood Albert is a
person's own photograph. Never take a manufacturer-authored file on Commons without finding the
ticket.

⛔ **A drawing was tried first and rejected** (owner: *"çizim pek olmamış"*), after a CC0 third-party
schematic turned out to be Boehm keywork. Both are recorded in the feature doc so neither is
attempted again.

⛔ **No structural guard covers images**, unlike scores and audio. `prune-dist.mjs` fails a build on
any `.json` at the dist root and on audio outside `audio/` or over `MAX_AUDIO_MB`; there is **no
equivalent test for a picture**, so an unlicensed image would ship silently under the 60 MB total.
The only thing standing there is this file and a manifest row. ⚠ **The second image has now landed,
and it carries a duty**, which was the stated trigger for closing that asymmetry — it is open work
now, not a note to repeat a third time. A guard here would also have to check that an
attribution-licensed file still has its credit in `THIRD-PARTY.txt`.

### The Istanbul backdrop — two paintings, public domain (2026-10-01)

`apps/web/public/backdrop/{day,night}{,-soft}.webp`, made by `ml/prep/prepare_backdrop.py` from two
**Ivan Aivazovsky** paintings on Wikimedia Commons — the Bosphorus in morning light (1856) and the
Bosphorus with Hagia Sophia and the Maiden's Tower by moonlight. The painter died in 1900, so both
are **public domain**, with no duty; they are credited in `THIRD-PARTY.txt` anyway, like the violin.
⛔ His Golden Horn by moonlight was the first night picture and was swapped the same day (owner: its
yellow moonlight "felt like a day picture"). ⚠ Never hand-edit an output: change the script and re-run it.

## The weights

`Beyaban/omr-weights` on the Hub is fine-tuned from `Flova/omr_transformer`, which is
**Apache-2.0**. §4 of that licence requires the licence and attribution to travel with a derivative
work, so the Hub repo needs a model card — [`hf/README.md`](../hf/README.md) is the file to upload:

```bash
huggingface-cli upload Beyaban/omr-weights hf/README.md README.md
```

⚠ **Open question, deliberately left open.** The weights were trained partly on SymbTr renders.
Whether trained weights are "adapted material" under ShareAlike is unsettled law and nobody can
give a clean answer. It does not block anything today — the app is free, so NC is not engaged, and
BY is satisfied by naming SymbTr in the model card. It **would** need a real answer before charging
for anything. The cheap insurance, if that day comes, is a retrain whose training set is
self-rendered strips only.

## User uploads

The app processes a photo the user chose and **stores nothing**:
[`apps/server/src/index.ts`](../apps/server/src/index.ts) never writes an image to disk — it logs a
size and a count. That is the single biggest reason this is low-risk: there is no library of other
people's sheet music sitting on a server.

The footer says so, says the user is responsible for what they upload, and links the repo's issue
tracker as the takedown route (no personal address published — owner's choice, 2026-08-08).

⚠ **If the server ever starts persisting an upload, the footer becomes false.** Change
`apps/web/src/ui/strings.ts` in the same commit.

## Still open

- **Git history.** `git rm --cached` took the samples and the neyzen screenshot out of HEAD, but
  they remain in the repo's history and the repo is public. Clearing them needs a
  `git filter-repo` rewrite and a force-push, which breaks every existing clone. The owner's call,
  not a default.
✅ **CLOSED 2026-09-04: the repo is Apache-2.0** (owner). `LICENSE` is the canonical text with the
copyright line filled in; `NOTICE` carries the scope — the licence covers **this project's own
work** and nothing else, and names what it does not cover: SymbTr, the neyzen.com screenshot, the
`Flova/omr_transformer` base model, and the bundled audio, fonts and libraries. ⚠ The scope note is
load-bearing, not politeness: a bare permissive licence at the root of a repo whose history holds
CC BY-NC-SA scores would purport to grant rights the owner does not hold. Reasoning:
[DECISIONS.md](DECISIONS.md).

**Merged into this file on 2026-11-20:**

- [Audio policy — what may be used, and the rules every file obeys](#audio-policy--what-may-be-used-and-the-rules-every-file-obeys) — was `docs/THIRD-PARTY.md`
- [Audio sources — the verified files, and what each one still needs](#audio-sources--the-verified-files-and-what-each-one-still-needs) — was `docs/THIRD-PARTY.md`


## Audio policy — what may be used, and the rules every file obeys

*Was `docs/THIRD-PARTY.md` (last updated 2026-08-11).*

Split out of [README.md](features/README.md) on 2026-08-11 at its 400-line cap, by genre: that file carries
the feature briefs, this one the rules. **Nothing here changed in the move.** The per-file shopping
list — which recording, from where, under what licence — is [THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](#audio-sources--the-verified-files-and-what-each-one-still-needs).


F1 and F2 both need sound files, and the owner asked (2026-08-08) whether audio can be taken from the
internet while the app is free, and replaced with own recordings if it is ever monetised. **Yes —
that plan is legal and it works.** But "non-profit" is not what makes an asset safe, and the rule
that actually rules things out is a different one.

#### Five categories — three usable, two not

| Category | Usable now? | The condition |
|---|---|---|
| **CC0 / public domain** | Yes | **None.** Any use, forever, including commercial |
| **CC BY** (attribution) | Yes | **One line in `/THIRD-PARTY.txt`**, and it is then safe commercially forever — no future swap owed |
| **CC BY-NC** | **Yes**, while the app is free | Must be removed before charging for anything |
| **Unknown licence** ("found on the internet") | **No** | There is no permission to rely on, free app or not |
| **"No redistribution" packs** (most commercial libraries, paid included) | **No** | See below |

⚠ **CC BY was missing from the first version of this table** (added 2026-08-09) and the omission
mattered: it is not a lesser NC, it is a *cleared* category that costs an attribution line, and it
is where the only free ney material lives. ⚠ **CC BY-SA is a different thing** — ShareAlike raises
the same open question as the SymbTr weights ([../THIRD-PARTY.md](THIRD-PARTY.md)); treat it as
unresolved, not as CC BY.

NC is the *safe* one of the restricted options — it simply carries a bill if the app is ever
monetised. The two that block outright are the last two.

⚠ **The non-obvious one: "no redistribution".** Most sample packs — **including ones you pay for** —
permit using the sounds *inside a musical work* but forbid distributing the sample files themselves
("…in any form where they can be extracted"). A web app serves the raw file to every visitor, who
can save it straight out of the network tab. **That is precisely the forbidden act**, so a normal
commercial library cannot be used here even after paying for it. Buying a better library is not the
escape hatch it looks like.

#### What CC0 actually covers — and where it runs out

**Well covered:** hand percussion, and the Western orchestra/band via community CC0 libraries
(Versilian's VCSL and VSCO 2 Community Edition are the usual starting points — verify the licence on
the project's own page, licences change).

**Thin to nonexistent:** ney, oud, tanbur, kemençe, zurna. Nobody has built a free public-domain
Turkish instrument library, which is the same gap that gives this app a reason to exist.

**Measured on 2026-08-09** rather than assumed — the per-file shortlist, with every licence read on
its own source page, is **[THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](#audio-sources--the-verified-files-and-what-each-one-still-needs)**. Two corrections came out of it:
**kanun is covered after all** (a CC0 chromatic set of isolated notes exists, from the CompMusic
project), and **ney is confirmed empty** under CC0, with one CC BY scale recording as a stopgap.

⚠ **"A recording exists" is not "a sample set exists."** A sampler needs notes at matched tone,
level and room, with clean starts. What turns up on upload sites is usually one person's phrase in
one room — unusable as an instrument even when the licence is perfect. And CC0 means free of
conditions, **not good**; quality ranges from excellent to unusable.

#### The plan this leads to

| Instrument | Source | Cost |
|---|---|---|
| Darbuka, tef, bendir, zil | **CC0** — VCSL, plus a CompMusic düm/tek take | ~1 hour |
| Clarinet, violin | **CC0** — VSCO 2 Community Edition | ~1 hour |
| **Kanun** | **CC0** — a chromatic isolated-note recording (found 2026-08-09); A/B it against Karplus–Strong | ~1 hour |
| **Oud, tanbur** | **Karplus–Strong — no files at all** | code, not hunting |
| **Ney** | **Own recording** (one CC BY scale exists as a stopgap) | one evening |

Which file, from where, and what each still needs before it plays:
**[THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](#audio-sources--the-verified-files-and-what-each-one-still-needs)**.

This needs **no NC content anywhere**, which is why it is the recommended path: for percussion and
clarinet, CC0 is no harder to find than NC, so taking NC would buy a future obligation for nothing.
Where CC0 is genuinely thin (ney above all), **taking an NC file is a reasonable trade** rather than
stalling the feature — under the swap discipline below.

⚠ Note what NC would partly undo. On 2026-08-08 the owner chose **removal over attribution** for the
scores specifically to keep the app commercially unencumbered ([../DECISIONS.md](DECISIONS.md),
[../THIRD-PARTY.md](THIRD-PARTY.md)). NC audio re-introduces that bind in a different corner of
the same app. That is a defensible call to make differently for audio than for scores — but it
should be made on purpose, not by accident.

#### Recording your own is more viable than it sounds

The owner plays ney and clarinet, is self-described amateur, and has no good microphone. For a
**sampler** that mostly does not matter:

- A sampler needs **one steady sustained note per pitch, ~2 seconds**. No phrasing, no tempo, no
  expression. Sounding good across a phrase is a performing skill; holding one clean tone is not the
  same skill, and the bar is far lower. Every note can be retaken twenty times.
- For single held notes **the room matters more than the microphone**. A phone at arm's length in a
  quiet room at night is adequate; steady background hum is the enemy, and steady hum against a
  steady note is the easy case to clean up.
- Ney is the instrument with no CC0 coverage *and* the one this app is most likely to be used with,
  so the owner is plausibly the cheapest available source of ney samples. Worth one evening before
  concluding otherwise.

#### The swap discipline — required whatever is chosen

These three rules are what keep "replace it later" a one-evening job instead of impossible. They
apply to CC0 files too, because the audit question is asked of every file, not just the restricted
ones.

1. **Never bundle audio into the app.** Every sample stays a separate file loaded by URL — the way
   weights come from `VITE_WEIGHTS_URL` and never from `dist/`.
   ⚠ **AMENDED 2026-08-11** ([../DECISIONS.md](DECISIONS.md)): audio may ship from the app's own
   `public/audio/` **while it stays under 1 MB**, which F2's two kits do at 660 KB. The rule was
   written against 211 MB of weights and did not carry at that size. What it was protecting is kept
   by the two rules below plus the loader's `VITE_AUDIO_URL` indirection, which is already in place
   and already tested against an off-app host — so the move is an upload and an env var, never a
   code change. `MAX_AUDIO_MB` in `prune-dist.mjs` fails the build when the limit is crossed and its
   message says to make that move. **Do not raise the number instead.**
2. **A manifest with `source` and `license` on every file, from the first one.** This is the rule
   that matters. These things do not fail as lawsuits; they fail as *"I no longer know where four of
   these came from"*, which makes the set unauditable and the swap impossible.
3. **Add each file to the third-party notices as it lands**, extending the existing
   `/THIRD-PARTY.txt`, never starting a second system.

⚠ Two cautions when downloading: verify the licence **on the source's own page**, not on a blog or an
aggregator that says "free" (free-to-download is not a licence); and on user-upload sites **CC0 is a
claim by the uploader**, who cannot grant rights they never held — an obviously ripped commercial
recording tagged CC0 is still unusable.

---


## Audio sources — the verified files, and what each one still needs

*Was `docs/THIRD-PARTY.md` (last updated 2026-08-13).*

The rules these files must obey (no bundling, a `source`+`license` per file, `/THIRD-PARTY.txt` as
each lands) are in [THIRD-PARTY.md § The swap discipline — required whatever is chosen](#the-swap-discipline--required-whatever-is-chosen). This
file is the shortlist that search produced, checked on 2026-08-09.

Every licence below was read **on the source's own page**, not on an aggregator. Nothing has been
downloaded yet.

✅ **F2's files are IN as of 2026-08-11** — the darbuka and frame-drum rows below are downloaded,
prepared and shipping. What was taken from each, and the mapping problem that had to be solved
first, is the section immediately below.

✅ **ALL THREE OF F1's VOICES ARE IN — clarinet and violin 2026-08-13, KANUN 2026-08-14.** What was
taken, what the measurements found, and how to upload them is the section
[What F1 actually took](#what-f1-actually-took--2026-08-13) below; the kanun has its own section
after it, because it arrived by a different route and taught different lessons. Ney is still empty
under CC0 and needs the owner's own recording; oud and tanbur are Karplus–Strong and need no files
at all.

⚠ **Neither Freesound file was needed after all.** The plan expected the CompMusic bendir take
(140291) to be F2's Turkish-stroke source and warned that its download is manual, needing a free
account. VCSL's frame drum covered it from GitHub with no account, so 140291 is **deferred, not
rejected** — it is a real bendir played by a named performer with Turkish strokes, which is a better
provenance than a general frame-drum library, and it is the obvious upgrade if the bendir kit ever
sounds wrong. 211133 (kanun) remains F1's.

### Cleared — CC0, usable commercially, forever

| For | Source | Licence | What is in it |
|---|---|---|---|
| **Darbuka** (F2) | VCSL `Membranophones/Struck Membranophones/Darbuka` | CC0 1.0 | 20 wav = **5 hit types × 2 velocities × 2 round-robins**, 2.5 MB |
| **Tef / bendir** (F2) | VCSL `Frame Drum` | CC0 1.0 | 18 wav — large + small drum × open hit / muted hit / hand |
| **Tef with jingles** (F2) | VCSL `Tambourine 1` | CC0 1.0 | hit ×2, shake ×2, roll ×3 |
| **Zil** (F2) | VCSL `Finger Cymbals` | CC0 1.0 | 1 wav |
| **Bendir, Turkish strokes** (F2) | [Freesound 140291](https://freesound.org/people/barisbozkurt/sounds/140291/) `bendir_basicStrokes.wav` | CC0 | 3.28 s wav 44.1 kHz — *"basic strokes on a bendir: düm and tek"*, played by Eren Ergen, collected under **CompMusic** (UPF) |
| **Clarinet** (F1) | VSCO 2 CE `Woodwinds/Clarinet` | CC0 1.0 | 97 wav — `susLong` = **11 pitches D2–F♯5** × 3 velocities, plus 64 staccato |
| **Violin** (F1) | VSCO 2 CE `Strings/Solo Violin` | CC0 1.0 | 292 wav — `Arco Vib` = **15 pitches A3–C7** × f/p; also Pizz 44, Trem 27, spic 60 |
| **Kanun** (F1) | [Freesound 211133](https://freesound.org/people/barisbozkurt/sounds/211133/) `kanun_moderate_Chromatic_moreIsolated.mp3` | CC0 | 2:02 mono mp3 160 kbps — *"all chromatic tones within the range of the instrument"*, isolated, CompMusic |

- **VCSL** — <https://github.com/sgossner/VCSL>, `LICENSE` is the CC0 1.0 legalcode; the README
  says *"you can do whatever you want with these sounds (even make commercial software), no
  royalties, no credit, no special terms"*, and contributions are CC0 too. The repo holds raw
  `.wav` (4,231 files), so a single folder can be pulled by URL — the 5 GB SFZ download is not
  needed.
- **VSCO 2 CE** — <https://github.com/sgossner/VSCO-2-CE>, `LICENSE` is CC0 1.0.

⚠ **Sizes, measured 2026-08-11 rather than guessed.** Clarinet `susLong` is **33 files averaging
~1.8 MB** (11 pitches × 3 velocities); taking one velocity is **~20 MB**, and the whole folder ~59 MB.
Solo Violin `Arco Vib` is comparable. So **three instruments are 40–60 MB uncompressed**, which is
why they go to a Hub repo rather than shipping with the app ([../DECISIONS.md](DECISIONS.md)) —
the app's whole dist is capped at 60 MB and already uses 43.4. ⚠ These files are **7–10 second
sustained notes**, not the ~2 s a sampler usually wants. That is a feature here: they outlast any
notated note, so **nothing needs looping**.

⚠ **VSCO 2 CE contradicts itself, and the resolution is recorded here so it is not re-litigated.**
Its `Readme.txt` "Terms" asks *"that you do not sell the samples directly"* and *"Please provide
credit to Versilian Studios/Sam Gossner, and/or Ivy Audio/Simon Dalzell where applicable"* — neither
is compatible with the CC0 file beside it. Read: **CC0 governs** (it is irrevocable once applied)
and the readme is a request. Practical response: take **clarinet and solo violin**, which are
Versilian's own VSCO 2 recordings; **credit anyway** in `/THIRD-PARTY.txt`, since it costs one line;
and **avoid the v1.1 "legacy" / Ivy Audio piano material**, where the provenance is mixed and the
"where applicable" is doing real work.

⚠ **On Freesound, CC0 is the uploader's claim.** These two are trusted because of who made them:
research recordings from the CompMusic project at Universitat Pompeu Fabra, by a Turkish makam
researcher, with the performer named. A random upload of a commercial-sounding loop tagged CC0 does
not get the same benefit. Downloading needs a free Freesound account — a manual step, not a script.

### What F2 actually took, and how the düm was identified ✅ 2026-08-11

Produced by **`ml/prep/prepare_strokes.py`** (`--analyse` to see the measurements without writing).
Never edit a file under `apps/web/public/audio/` by hand — re-run the script.

| Kit | düm | tek | ka |
|---|---|---|---|
| **darbuka** | `Darbuka_1_hit_vl2_rr{1,2}` | `Darbuka_2_hit_vl2_rr{1,2}` | `Darbuka_3_hit_vl2_rr{1,2}` |
| **bendir** | `HDrumL_Hit_v3_rr{1,2}` | `HDrumS_HitMuted_v3_rr{1,2}` | `HDrumL_HitMuted_v3_rr{1,2}` |

**The problem was that VCSL's darbuka files are numbered, not named** — nothing says which of the
five hit types is the open centre stroke. So each is *measured* (energy below 200 Hz, spectral
centroid, decay to −40 dB) and the mapping follows the physics: a düm is the whole head moving, so
it is low and rings; a tek is a fingertip on the rim, so it is bright and over instantly.

**The frame drum is the control that makes the darbuka result trustworthy.** Its files *are*
self-describing, so the same measurement ran against a known answer — and agreed. Without that the
darbuka mapping would be a plausible guess with nothing behind it. `--analyse` prints the agreement
line on every run; if it ever says DISAGREE, the metric has drifted and the darbuka mapping is no
longer supported.

Two findings that listening to the file names would have got wrong:

- ⚠ **Both `Hand` articulations are unusable** — they peak at −57 dB (large drum) and −62 dB (small),
  40+ dB under the struck takes. That is VCSL's session, not a dynamic. The natural-looking mapping
  (`Hand` → tek, since a tek is played with the hand) would have produced an inaudible tek, and
  lifting one to a usable level lifts its noise floor with it.
- ⚠ **The source levels are overridden, not preserved.** Inheriting them sounds respectful and is
  not, when articulations sit 40 dB apart. The three strokes are levelled to **0.50 / 0.35 / 0.19** —
  the *ratios* the owner tuned by ear on the synthesised version — with the round-robins of one
  stroke sharing a factor, since per-file normalisation would turn the alternation into a volume
  wobble.
- ⚠ **Those were 0.89 / 0.62 / 0.34 for a few hours and the drum audibly clipped** (owner:
  *"darbukanın sesi biraz patlamış"*). The files were never clipped; the **sum** was. A note is a
  normalised wave at gain 1.0 into the same master, so a note plus a 0.89 düm reached 1.61 at a
  destination that hard-clips at 1.0 — 38% of the waveform flattened at the *default* slider
  position. The level that was safe for a synthesised blip is **not** safe for a sample with a
  body that sustains. **Do not raise these to make the drum louder**; `Vuruş sesi` is for that, and
  a 15–24 dB crest factor means the peak drop cost far less loudness than it looks like.

Tails are cut at **700 ms** with a 25 ms fade (a darbuka düm rings 1.25 s, the bendir 2 s, nearly all
of it under the notes). Two kits come to **660 KB**; the fade prevents the click that cutting a
ringing drum at a non-zero sample would leave.

### Not licence work — what each file still needs before it plays

| File | Prep |
|---|---|
| ~~VCSL darbuka~~ | ✅ done — mapped by measurement, not by listening; see above |
| `bendir_basicStrokes.wav` | ⏸ deferred — **Split** the 3.28 s take into individual strokes at the onsets |
| ~~`kanun_..._moreIsolated.mp3`~~ | ✅ done 2026-08-14 — split at the onsets, decoded once, never re-encoded; see the kanun section below |
| Clarinet / violin | Pick the sustain layer, **trim and loop**, convert to mono compressed. Raw folders are 66 MB and 235 MB of wav; what ships is a handful of notes |

⚠ **This "minor third apart, so ±1.5 semitones" figure was WRONG and is kept only to mark the
correction.** Measured 2026-08-13: the clarinet steps D–F–A#–D, and F→A# is a *perfect fourth*, so
its widest gap is **5 semitones** and the worst shift is **±2.5**. The violin's widest is 4.3
(C→E plus real intonation). Planning had also independently guessed ±2 by miscounting the same
interval. The real bound is now asserted in `tools/tests/voices-test.ts` rather than written in
prose. Resampling also changes *length* (~12% at ±2.5 semitones) — irrelevant for sustains that
outlast the note anyway, and percussion one-shots are never shifted at all.

⚠ **A violin is not a kemençe.** It is a good stand-in and it is free; it must not be *labelled*
kemençe in the UI. Same for clarinet, which is genuinely a Turkish-repertoire instrument and can be
called one.

### What F1 actually took — 2026-08-13

Produced by **`ml/prep/prepare_voices.py`** (`--analyse` to measure without writing, `--manifest` to
print the TypeScript block for `apps/web/src/audio/instruments.ts`). ⚠ Unlike the drums, these files
are **copied, not prepared**: no trim, no fade, no downmix, no resample, no re-level. `write()` is a
byte copy followed by a **sha256 comparison against the source**, and a mismatch is a hard failure —
that check is what replaces the drum script's trim/level stage and turns "as recorded" into an
assertion.

| Voice | Source folder | Layer | Files | Size | Widest gap |
|---|---|---|---|---|---|
| **Klarnet** | `Woodwinds/Clarinet/susLong` | `v2` (middle of three) | 11 | 20.2 MB | 5.0 semitones |
| **Keman** | `Strings/Solo Violin/Arco Vib` | `f` (of f/p) | 15 | 35.4 MB | 4.3 semitones |

Layer choice, for the record: the app has no dynamics, so a **middle** velocity is the honest single
sound — `v1` is a whisper the notes would bury and `v3` an accent on every note. The violin's `f` is
both the clearer tone and the smaller of its two layers.

#### Three things measuring caught that reading the filenames would not

1. ⚠ **The clarinet's labels are an octave below its sounding pitch.** `DCClar_susLong_D2_…` sounds
   **D3** (146.7 Hz), and so on for all 11 files, within 1 cent. A clarinet cannot produce the D2 its
   name claims. Parsing the name would have transposed the whole instrument an octave — and it would
   have sounded like a plausible instrument, just the wrong one.
2. ✅ **The violin's labels need no offset**, which is the point of including it: it is the *control*
   that makes the clarinet's answer a measurement rather than a guess, exactly the role the
   self-describing frame drum played for VCSL's numbered darbuka hits.
3. ⚠ **`DCClar_susLong_F#5_v2_rr1_sum.wav` sounds F6, not F#6** — mislabelled by a semitone at
   source. 1397 Hz, confirmed independently against its own second partial at 2794 Hz. The file is in
   tune with itself and perfectly usable; it keeps its original name because the files ship untouched
   and the name is provenance. `hz` in the manifest is what plays.

#### The playback window — 2026-08-13, revised twice by ear

The owner listened twice, and each pass corrected something the previous measurement got wrong.

**Round 1 — "just like breath" on 16th notes, and an annoying violin creak.** The tone does not
arrive immediately, and a 16th note at 120 BPM is 125 ms, so a short note played the attack transient
and stopped before the instrument spoke. Measured on a 125 ms window (fraction of energy on the
harmonic series, which separates a tone from breath or bow noise):

| sample | tonal at file start | tonal once settled | level change |
|---|---|---|---|
| clarinet D2 | **35.8%** | 96.9% | **13.4× louder** |
| clarinet D3 | 82.6% | 92.1% | 2.3× |
| violin G4 | 91.4% | 98.8% | 1.9× |

⚠ Short notes were not only breathy but **up to 13× quieter** than long ones, because they played
only the ramp-up. That is the part an ear notices first.

**Round 2 — "we can trim less from the beginning", and trim per note duration.** Both right.

The first fix used an **amplitude** threshold as a proxy for breathiness, and amplitude waits for
full *loudness*, which arrives well after the noise stops. It overshot in every file:

| sample | amplitude-based (wrong) | spectral (now) |
|---|---|---|
| clarinet D3 | 158 ms | **92 ms** |
| clarinet F4 | 765 ms | **275 ms** |
| clarinet D2 | 1178 ms | **404 ms** |
| violin G4 | 156 ms | **80 ms** |

So `toneS` is now the first moment the sound is within **10 harmonic-percentage-points of that
file's own settled tonality, and stays there**. ⚠ Relative, never absolute — a clarinet's sustain is
only ~94% harmonic, so an absolute bar is unreachable for some of its notes. ⚠ "And stays there"
matters: violin C7's bow-bite shows a momentary 89.6% blip at 50 ms and then falls back to 36%, so
first-crossing started the note immediately before the worst of the scrape.

**And the trim now depends on the note, not only the file.** Each sample carries `attackS` (first
sound), `toneS` (settled) and `endS` (before the release). A note starts at `attackS` — keeping the
instrument's real articulation — only when that swell is at most **25%** of the note; otherwise it
starts at `toneS`. ⚠ **A smooth blend was tried and measured wrong**: interpolating the start point
lands *inside* the transient for any file with a long one, so a quarter note on C7 began at 64%
harmonic and a half note at 33% — the creak reintroduced in the middle of the range while both ends
looked fine. All-or-nothing means no note ever begins halfway through a scrape.

Measured tonality at the start of each note length, after the fix:

| sample | 16th | quarter | half | whole |
|---|---|---|---|---|
| clarinet D3 (80 ms swell) | 94.3% | 83.9% | 83.9% | 83.9% |
| clarinet D2 (400 ms swell) | 92.8% | 92.8% | 92.8% | 36.7% |
| violin C7 (300 ms bite) | 92.3% | 92.3% | 92.3% | 51.3% |
| violin G4 (80 ms swell) | 98.4% | 91.4% | 91.4% | 91.4% |

Read it as: short notes always speak immediately; a note only inherits the recorded swell once it is
long enough to carry it. ⚠ **Cost: none** — one subtraction and one comparison per note at schedule
time. The alternative (shipping two trimmed copies of every sample) would have doubled the download.

⚠ All of this is applied **at playback, not to the wavs**, so the files stay byte-identical, the
sha256 table above stays valid, and re-tuning by ear costs no re-upload. That paid off immediately:
the round-1 numbers were replaced by the round-2 numbers for free.

#### Do the samples keep the microtones? — measured 2026-08-13

**Yes, exactly.** A makam's comma deltas are added to `koma53` *before* a frequency exists
(`withKomaDeltas` → `buildTimeline` → `freqFromTuning`), so the sampled and synthesised paths consume
one and the same `freqHz`. The sampler then sets `playbackRate = freqHz / sample.hz`, which lands on
`freqHz` by construction. Swept over every koma in both instruments' ranges × the fractional deltas a
makam applies (−1.5, −1, +1, +1.5), **1,841 sampled pitches, worst error 9.9e-5 cents** — about
1/229,000 of a koma, after storing the ratio in the float32 AudioParam the browser actually uses.
Pinned by `tools/tests/voices-test.ts` so it cannot regress. Pitches outside a voice's range fall
back to the synth, which is exact by definition.

⚠ **But a violin note is not a steady pitch, and that is worth knowing for this app specifically.**
The layer is `Arco Vib` — vibrato — and its pitch swings **0.9–1.2 komas** peak to peak:

| sample | pitch swing | in komas |
|---|---|---|
| violin G4 | 28.0 cents | **1.24** |
| violin C5 | 19.6 cents | 0.86 |
| clarinet D4 | 3.6 cents | 0.16 |
| clarinet A#3 | 2.2 cents | 0.10 |

The *centre* is exactly right; the note moves around it by roughly one koma while sounding. So the
violin plays the makam correctly but **cannot be used to hear the difference between adjacent komas**
— for that the clarinet is the reference voice, being steady to a tenth of a koma. ⚠ VSCO's Solo
Violin has no non-vibrato arco articulation (only `Arco Vib`, `Pizz`, `Trem`, `spic`), so this is a
property of the source, not something a setting can fix. A straight-tone violin would need a
different recording.

#### Levels

Measured peaks are low: **0.26** (clarinet) and **0.31** (violin) full scale. The manifest carries a
per-voice `gain` (3.775 and 3.156) applied in the note's envelope, clamped so `gain × peak ≤ 0.98`.
⚠ **The clarinet's layer spans 13 dB** between its quietest and loudest file — the same shape of
finding as VCSL's unusable `Hand` takes, though not as extreme. One global gain cannot fix a spread,
so its low register is the first thing to listen to (MANUAL_CHECKS check 24).

#### Uploading them ✅ DONE 2026-08-13

Live at **<https://huggingface.co/datasets/Beyaban/omr-voices>** — 26 files, 55.6 MB, CC0. Verified
from outside the app: 200 after the LFS redirect with byte counts identical to the VSCO originals,
`access-control-allow-origin` echoed for `https://komavision.netlify.app`, and the `#` in `A#2`
resolving when percent-encoded. `npm run smoke:editor -- --voices-url <base>` against it reads 11/11
decoded, 11 sampled notes and 0 synthesised.

The recipe, for the next instrument:

```bash
.venv-ml/bin/python ml/prep/prepare_voices.py --analyse   # measure, print, write nothing
.venv-ml/bin/python ml/prep/prepare_voices.py             # stage data/audio_voices/ (55.6 MB)
.venv-ml/bin/python ml/prep/prepare_voices.py --manifest  # the TS block + the sha256 table

.venv-ml/bin/hf auth login                                 # already done for the weights
.venv-ml/bin/hf repo create omr-voices --repo-type dataset # public: do NOT pass --private
.venv-ml/bin/hf upload Beyaban/omr-voices data/audio_voices . --repo-type dataset
```

Then check it from outside, the way `mvp/hosting-setup.md` checks the weights — ⚠ a bare `curl` is
not enough, because the Hub reflects the caller's Origin behind `vary: Origin`:

```bash
BASE=https://huggingface.co/datasets/Beyaban/omr-voices/resolve/main
curl -sIL "$BASE/clarinet/DCClar_susLong_D3_v2_rr1_sum.wav" | head -20      # want 200
curl -s -o /dev/null -D - -H "Origin: https://komavision.netlify.app" \
  "$BASE/clarinet/DCClar_susLong_D3_v2_rr1_sum.wav" | grep -i access-control-allow-origin
```

The CORS header is load-bearing: the app is served under COEP `require-corp`, and a plain CORS
`fetch` is what satisfies that without the Hub sending CORP. ⚠ Note the **`/datasets/`** segment — a
dataset repo does not resolve like the weights' model repo, and getting it wrong gives 404s that look
like a failed upload. ⚠ And note that filenames contain `#`: it must arrive percent-encoded, which
`loadInstrument.ts` does per path segment. Pasting a path into a URL raw truncates it at the `#` and
404s — measured, it cost 3 of the clarinet's 11 samples before it was fixed.

Then `npm run smoke:editor -- --voices-url $BASE` to drive the real files, and check 24 by ear.

⚠ **Hear it BEFORE uploading, not after.** `npm run serve:voices` serves `data/audio_voices/` on
:8788 with the two headers COEP needs, and `npm run dev:voices:local` points the app at it — so a bad
split is caught on this machine instead of being published first. A plain static server will not do:
dev sends `Cross-Origin-Embedder-Policy: require-corp`, so a voice fetched without CORS headers is
blocked by the embedder policy while the file itself serves fine in a browser tab. Both of the kanun's
ear-found bugs were found this way.


### The kanun

One CC0 take → 36 files, F3-E6, 9.9 MB, and the project's first DERIVED audio. It took a second
acquisition path, and four measurement traps that a copy job never meets: [kanun.md](features/kanun.md#the-kanun--one-take-thirty-six-notes).

### The gaps, measured

Freesound CC0-filtered result counts, 2026-08-09:

| Instrument | CC0 hits | Verdict |
|---|---|---|
| darbuka | 43 | covered (VCSL is cleaner) |
| frame drum | 63 | covered |
| bendir | 10 | covered — 140291 is the good one |
| kanun | 4 | **solved** by 211133 |
| oud | 23 | `hammondman`'s `g2` / `a2` / `c3` single notes are CC0 by the filter (⚠ not verified on their own pages, quality unknown). Karplus–Strong stays the plan; this is the fallback |
| ney | 11 | **nothing usable** — phrases, unrelated recordings, and some outright junk |
| tanbur | 1 | one Uzbek field recording. Nothing |
| zurna | 0 | nothing |

**Ney is the gap the plan predicted, and it stands.** The owner's own recording remains the answer.
One free stopgap exists and it is **CC BY, not CC0**:
[Freesound 194637](https://freesound.org/people/ajaysm/sounds/194637/), *"Scale of Huzzam Makam"*
played on ney (32 s mp3, CompMusic / Galata Electroacoustic Orchestra, Genova 2013). A scale means
individual pitches can be cut out — enough for the "find one usable note" version F1 describes —
but it is one take, one makam, roughly an octave, and lossy. `xserra`'s `ney.wav` on Freesound is
also CC BY and is a phrase, not notes.

### What this changed in the plan

1. **Kanun no longer has to be Karplus–Strong.** [README.md](features/README.md) says oud/tanbur/kanun get
   K–S because no files exist; for kanun that is now false. K–S is still worth trying first — it is
   natively microtonal and costs no bytes — but there is a real recording of the real instrument to
   A/B it against, in an hour.
2. **CC BY was missing from the licence table** and that omission is exactly where ney lives. It is
   now a row in [THIRD-PARTY.md § Audio policy — what may be used, and the rules every file obeys](#audio-policy--what-may-be-used-and-the-rules-every-file-obeys).
3. **No NC file is needed for anything being built first.** The 2026-08-09 decision hoped for that;
   it is now measured rather than hoped.
