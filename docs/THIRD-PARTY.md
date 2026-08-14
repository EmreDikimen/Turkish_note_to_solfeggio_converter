# Third-party rights: what we use, what we may publish

purpose: the licence of every third-party thing this project touches, and the rule each one imposes on publishing
audience: whoever is about to ship, deploy, push weights, or add a file to `apps/web/public/`
updated: 2026-08-09

This file owns the **licensing facts**. Nothing else should restate them — link here.

The short version: **the deployed app now publishes none of it.** No score, no page image, no
dataset row. It ships code, a font, and a pointer to weights on the Hub. Everything third-party
stays on the developer's disk, where local use is not distribution.

## The rule, in one line each

| Thing | Licence | What that lets us do |
|---|---|---|
| **SymbTr** (score corpus) | **CC BY-NC-SA 4.0** | Train and test locally. **Publish nothing derived from it** — see below |
| neyzen.com / notaarsivleri.com page images | all rights reserved | Read locally. Never redistribute, never commit |
| `Flova/omr_transformer` (base model) | Apache-2.0 | Fine-tune and publish the result **with attribution + licence** |
| Bravura (font) | SIL OFL 1.1 | Ship it, with `OFL.txt` beside it — which we do |
| React, VexFlow, ONNX Runtime | MIT | Ship, with the copyright notice |
| `@techstark/opencv-js` | Apache-2.0 | Ship, with the notice |
| Turkish makam theory, AEU, 53-TET, usul names | not copyrightable | Free — facts and systems, not expression |
| **VCSL** and **VSCO 2 Community Edition** (sample libraries) | **CC0 1.0** | Serve the sample files, commercially, forever. No duty at all — a credit line is courtesy |
| **Freesound 140291** (bendir strokes) and **211133** (kanun chromatic notes), both CompMusic/UPF | **CC0** | Same. ⚠ CC0 on Freesound is the *uploader's* claim; these two are trusted on provenance |
| **Freesound 194637** (ney, Huzzam scale) — only if used | **CC BY 4.0** | Serve it, commercially, **with attribution in `/THIRD-PARTY.txt`** |

Shipped notices live in [`apps/web/public/THIRD-PARTY.txt`](../apps/web/public/THIRD-PARTY.txt),
served at `/THIRD-PARTY.txt` and linked from the app footer.

## Why the app bundles no scores

Every score this project ever had is a SymbTr export (`scripts/symbtr_to_json.py`). SymbTr is
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
geometry section and [MANUAL_CHECKS-CORPUS.md](MANUAL_CHECKS-CORPUS.md) all read them through
`?score=…`, which still works against a dev server. Regenerate them with
`scripts/export_scores.py` if a fresh checkout needs them.

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
[features/audio-sources.md](features/audio-sources.md).

⚠ **The one to watch is not a licence, it is a category.** Most commercial sample libraries, *paid
ones included*, forbid redistributing the sample files themselves. A web app serves the raw file and
anyone can lift it out of the network tab, so those libraries are unusable here no matter what is
paid for them. Reasoning: [features/audio-policy.md](features/audio-policy.md).

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
- **No LICENSE file** — the repo defaults to all rights reserved. Fine while it is one person's
  project; it needs a decision before anyone else can contribute.
