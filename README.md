# KomaVision — Classical Turkish (makam) sheet music → editable, playable score

Upload a photo or screenshot of Turkish sheet music. The app reads the notes — **including the
microtonal accidentals** (koma, bakiye, küçük mücennep, …) — draws them as a score you can correct
by hand, and plays them back at exact **53-TET (Arel-Ezgi-Uzdilek)** pitches.

**Try it: <https://komavision.netlify.app>** — nothing to install; works on a phone or a desktop
browser, and can be added to a phone's home screen. The interface is in **Turkish**.

## Why it exists

Western OMR (optical music recognition) tools such as PlayScore generally fail on Turkish scores.
They do not know the microtonal accidentals the genre is built on, and they cannot play back in
53-TET. That leaves musicians and students of Classical Turkish Music without a working
photo → score → sound path.

## What you can do with it

- **Read a page.** Drag in (or paste) a single-page JPG/PNG. A page takes roughly half a minute to
  a minute; the reading itself runs on a small server, so your device does no heavy work (if the
  server cannot be reached, the app says so rather than reading on your device). Screenshots and
  clean scans read best; phone photos of paper work but are the hardest case.
- **Fix what it got wrong.** Edit mode: click a note to select it, drag up/down to change its
  pitch, ✕ to delete, and the left-hand palette to change a duration, add an accidental, insert a
  new note, mark a rest, or make a triplet. Undo/redo included. A measure that does not add up to
  its usul gets a warning mark in its corner.
- **Hear it in 53-TET.** Play/pause/stop, click a measure to start from there, set the tempo.
  Violin, clarinet and kanun play **real recordings** (downloaded the first time you pick one);
  the rest are synthesised.
- **Hear the usul.** The rhythmic cycle can click as a metronome or play its real düm-tek-ke
  strokes on a **darbuka** or **bendir**.
- **Choose how it is written and how it sounds.** Accidentals on every note / as a row-start key
  signature / standard per-measure; transpose, with a *keep the sheet, move the sound* option for
  transposing instruments (ney ahenks); pick a **makam** to bend the *sound only* — the engraved
  notes never move.
- **See it on an instrument.** The *Enstrüman üzerinde* view shows the piece on a **violin** neck
  (where the finger lands), a **kanun** (which mandals to set) or a **sol klarnet** (which holes, how
  tight the lip), moving as the piece plays, beside the bar being played.
- **Keep it.** The app remembers the pages your browser has read (the last 30, notes only — never
  the image). Save the score as a **PNG** picture or a **PDF**.

### Honest limits

- The reading is good, not finished. A typical page still needs a handful of corrections — most
  often a pitch one step off, a wrong note length, or a misread key signature — and the app **does
  not yet tell you which notes it is unsure about**. Dense pages with many short notes are the
  hardest.
- One page at a time. PDFs are not read directly — export or screenshot the page first.
- The app **ships no music of its own**: there are no built-in example scores, because the scores we
  hold come with licences that would restrict the whole app. You bring your own page.
- **Your uploads are not stored.** The decode server reads the image and drops it; it never writes
  one to disk. Any visit counting is anonymous — no IP address is kept:
  [privacy](https://komavision.netlify.app/privacy.html).

## How it works

```
page image
  → slice        find the staff lines and cut the page into short strips of 2–3 measures
  → read         a machine-learning model reads each strip and writes down its notes
  → stitch       the strips are joined back into one score, with exact 53-TET pitches
  → edit         the score is drawn as sheet music; every note can be corrected by hand
  → play         the browser plays it at exact 53-TET frequencies
```

Cutting the page happens in your browser. Reading the strips happens on a small server, so a phone
does not heat up. The model is a vision-to-text network (an image encoder and a text decoder, the
"Donut" design), first trained on Western scores and then taught Turkish notation — mostly with
strips the project draws itself from known scores, plus real printed pages checked by hand.

## Running it yourself

Needs **Node 20+** (developed on 22) and npm. Clone the repo, then:

```bash
npm install
npm run dev:cloud    # → http://localhost:5173 — reading happens on the server (keeps your machine cool)
npm run dev:web      # the same app, but the model runs in YOUR browser (downloads ~211 MB of weights)
```

Open the printed URL and drop a page in. Nothing else is required — no API key, no account, no
local model files.

Other useful commands:

```bash
npm run typecheck    # all workspaces
npm test             # core logic: stitcher, edits, usul strokes, voices, violin fingering
npm run build:app    # the deployable web build
```

The full command reference — including the ones with a failure mode that looks like success — is
[docs/COMMANDS.md](docs/COMMANDS.md).

### The Python side (training and data only — never shipped)

Model training, synthetic training data and the SymbTr converters live in Python and are not part
of the app:

```bash
python3 -m venv .venv-ml
source .venv-ml/bin/activate
pip install -r requirements.txt

# a SymbTr score straight to 53-TET audio, no machine learning involved
python3 scripts/symbtr_to_audio.py data/raw/<score>.txt -o data/processed/out.wav --info
# or to a note-model JSON the web app can open
python3 scripts/symbtr_to_json.py data/raw/<score>.txt -o out.json
```

Data: **SymbTr-2.0.0** (Karaosmanoğlu, 2012) — 2,200 machine-readable makam scores. Not
redistributed here; download it separately and point the scripts at the `.txt` files. Its `Koma53`
column gives each pitch as an absolute Holdrian comma, which maps straight to a 53-TET frequency.

## Repo map

```text
packages/core/   shared TypeScript: note model, 53-TET tuning, synthesis scheduling, edits
apps/web/        the React app — slicer, editor, playback, UI (all user-facing strings in ui/strings.ts)
apps/server/     the decode server (Node + onnxruntime-node, importing the web app's own decoder)
apps/android/    the Play Store app: a Trusted Web Activity shell around the live site (Bubblewrap)
netlify/         the anonymous visit counter (Netlify Functions)
tools/           synthetic-strip renderer, browser checks, parity harnesses
src/, scripts/   Python: OMR training, evaluation, SymbTr parsing, the real-page labeling loop
data/            scores, corpora, checkpoints (all gitignored)
docs/            the written record — start at docs/INDEX.md
```

## Where the project is

The app is live and used by real readers, and an Android app is going through Google Play's testing.
The model is improved in rounds: each round is trained, then graded once on a fixed set of real
pages it has never seen, so progress is measured rather than guessed. Most of the remaining errors
are in key signatures and in very dense passages, and that is where the current work goes.

## Feedback and contact

Found a page it reads badly, a sound that is wrong, or an idea? Please
**[open an issue](https://github.com/EmreDikimen/Turkish_note_to_solfeggio_converter/issues)** —
a screenshot of the page and what you expected is the most useful thing you can send.

## For developers

Code map and reading order: [docs/CODE_TOUR.md](docs/CODE_TOUR.md). Every command, including the
ones whose failure looks like success: [docs/COMMANDS.md](docs/COMMANDS.md).
