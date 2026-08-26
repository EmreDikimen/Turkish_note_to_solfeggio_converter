# KomaVision — Classical Turkish (makam) sheet music → editable, playable score

Upload a photo or screenshot of Turkish sheet music. The app reads the notes — **including the
microtonal accidentals** (koma, bakiye, küçük mücennep, …) — draws them as a score you can correct
by hand, and plays them back at exact **53-TET (Arel-Ezgi-Uzdilek)** pitches.

**Try it: <https://komavision.netlify.app>** — nothing to install, works in a desktop browser.
The interface is in **Turkish**.

## Why it exists

Western OMR (optical music recognition) tools such as PlayScore generally fail on Turkish scores.
They do not know the microtonal accidentals the genre is built on, and they cannot play back in
53-TET. That leaves musicians and students of Classical Turkish Music without a working
photo → score → sound path.

## What you can do with it

- **Read a page.** Drag in (or paste) a single-page JPG/PNG. A page takes roughly half a minute to
  a minute; the reading itself runs on a small server, and falls back to your own browser if that
  server is unreachable. Screenshots and clean scans read best; phone photos of paper work but are
  the hardest case.
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
- **Other views.** Piano roll (vertical axis is the 53 komas), lyrics under the notes, and a
  **violin fingerboard** tab showing where the finger lands as the piece plays.
- **Take it with you.** ⬇ JSON downloads the corrected piece as a note-model file; the **Gelişmiş**
  (Advanced) section loads one back in.

### Honest limits

- The reading is good, not finished. A typical page still needs a handful of corrections, and the
  app **does not yet tell you which notes it is unsure about** — that feature was tried, measured,
  and dropped rather than shipped weak. Current accuracy: [docs/METRICS.md](docs/METRICS.md);
  the plain-English account: [docs/OVERVIEW.md](docs/OVERVIEW.md).
- One page at a time. PDFs are not read directly — export or screenshot the page first.
- The app **ships no music of its own**: there are no built-in example scores, by choice — every
  score we hold is licensed so that publishing it would bind the app to NonCommercial terms
  ([docs/THIRD-PARTY.md](docs/THIRD-PARTY.md)). You bring your own page.
- **Your uploads are not stored.** The decode server reads the image and drops it; it never writes
  one to disk.

## How it works

```
page image
  → slice        find the staves, cut the page into 2–3 measure strips
  → read         a fine-tuned OMR model turns each strip into a token sequence
  → stitch       tokens → notes {53-TET pitch, duration, …} → one score
  → edit         VexFlow engraving; every note correctable by hand
  → play         Web Audio at exact 53-TET frequencies
```

The slicing runs in your browser. The model runs on a small CPU server (Cloud Run), with the same
model in-browser as the fallback — one decode implementation, shared by both.
Design: [docs/PIPELINE.md](docs/PIPELINE.md).

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
tools/           synthetic-strip renderer, browser checks, parity harnesses
src/, scripts/   Python: OMR training, evaluation, SymbTr parsing, the real-page labeling loop
data/            scores, corpora, checkpoints (all gitignored)
docs/            the written record — start at docs/INDEX.md
```

## Project state and further reading

The web app is live and in use; the model keeps improving in measured rounds against a frozen exam.
**Current state and next action: [docs/STATUS.md](docs/STATUS.md)** — the only file that states it.

| | |
|---|---|
| Plain-English summary, no jargon | [docs/OVERVIEW.md](docs/OVERVIEW.md) |
| Every headline number | [docs/METRICS.md](docs/METRICS.md) |
| Why something was decided | [docs/DECISIONS.md](docs/DECISIONS.md) |
| Licences and what we may publish | [docs/THIRD-PARTY.md](docs/THIRD-PARTY.md) |
| Long-range plan (incl. the mobile app) | [ROADMAP.md](ROADMAP.md) |
| Working on the code? Start here | [CLAUDE.md](CLAUDE.md) · [docs/CODE_TOUR.md](docs/CODE_TOUR.md) |
