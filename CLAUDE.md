# CLAUDE.md — read this first

Classical Turkish (makam) music **OMR**: photo/screenshot of sheet music → notes *including the
microtonal accidentals* → editable score → playback at exact 53-TET (Arel-Ezgi-Uzdilek) pitches.
Web app first; the phone is a first-class target. Synthetic accuracy is solved (99.9%); the remaining
model work is about real printed pages.

**TWO TRACKS RUN IN PARALLEL (owner, 2026-08-05)** and neither blocks the other. The **product track**
never trains; the **model track** never touches the app — it is **Round 4**, opened 2026-09-03 after
Round 3 read 51% against a 75% floor ([docs/rung3/round4.md](docs/rung3/round4.md)).

⚠ **THE APP IS PUBLIC** — the owner put the live link on LinkedIn on 2026-09-05, ahead of the exam
gate every plan here assumed. Strangers are reading pages on a server with **no fallback**, with
**Round 3 Run A `best-real`** (⛔ not Round 2 — this file said so and was wrong; the browser has read
nothing since 2026-09-04, so the live model is the one baked into the Cloud Run image). What that
changes: [docs/STATUS.md](docs/STATUS.md).

> **Current state + the next action → [docs/STATUS.md](docs/STATUS.md). Never answer "what's next"
> from this file or from ROADMAP.** Plain-English version for the project owner:
> [docs/OVERVIEW.md](docs/OVERVIEW.md).
>
> 📝 **Asked to "sync the docs", "update the docs", or writing anything down after a piece of
> work? READ [docs/MAINTAINING.md](docs/MAINTAINING.md) FIRST and follow it** — it says which file
> owns what, and the end-of-session checklist. Do not improvise doc updates.

## How to write to the owner (2026-08-20 — applies to EVERY reply, not just docs)

**Answer in plain, basic English — assume the reader is neither a musician nor a computer-vision
engineer.** The owner reads English as a second language and asked for this to be the default for
*all* responses, not only for documentation.

- Short sentences. One idea per sentence.
- Define every term the first time it appears in the reply — "tuplet", "token", "checkpoint",
  "augmentation" are all jargon. A one-clause gloss in brackets is enough.
- **Keep the numbers.** Plain English means simple words, not vague claims. Every number still comes
  from [docs/METRICS.md](docs/METRICS.md) or its source log, and still gets its n. If user asks the question in Turkish, answer in Turkish but do not translate the terms in Turkish, use original names.
- Say plainly when something is a guess, a lead, or unmeasured. Do not dress a feeling as a finding.
- This is about the VOICE of a reply — it changes no doc convention and licenses no rewriting of history.
- If you are not sure about something, ask to user. If anything ambigous ask. Do not assume. Also if a heavy command that would heat the pc, ask to user with its estimated finish time.

## Where things are

| Need | File |
|---|---|
| **Any command, and the traps that make one fail silently** | **[docs/COMMANDS.md](docs/COMMANDS.md)** |
| What ships today, what's next, open risks | [docs/STATUS.md](docs/STATUS.md) |
| Any headline number (accuracy, corpus size, yield) | [docs/METRICS.md](docs/METRICS.md) |
| Why something was decided (and what overturned it) | [docs/DECISIONS.md](docs/DECISIONS.md) |
| **Touching apps/web, tools/render or tools/core?** Playback, the editor, the DOM, the stylesheet | **[docs/APP-RULES.md](docs/APP-RULES.md)** |
| **What a browser check may assert on** — the DOM attributes, per feature | **[docs/DOM-CONTRACT.md](docs/DOM-CONTRACT.md)** |
| **What we may publish** — licences, attribution, why no score ships | **[docs/THIRD-PARTY.md](docs/THIRD-PARTY.md)** |
| The full doc map | [docs/INDEX.md](docs/INDEX.md) |
| **MVP track (in-browser pipeline → friends release)** | **[docs/mvp/README.md](docs/mvp/README.md)** |
| Real-page track (collect → label → exam → rounds) | [docs/rung3/](docs/rung3/) |
| Code map / reading order | [docs/CODE_TOUR.md](docs/CODE_TOUR.md) |
| Page → strips → decode → stitch design | [docs/PIPELINE.md](docs/PIPELINE.md) |
| See a feature with your own eyes | [docs/MANUAL_CHECKS.md](docs/MANUAL_CHECKS.md) |
| Training runs, raw results | [src/vision/MODEL_EVAL.md](src/vision/MODEL_EVAL.md) |
| Long-range plan (evergreen, no status) | [ROADMAP.md](ROADMAP.md) |

## Commands

**⚠ The FULL command reference, with the traps that matter, is in TWO files — read the right one
before running anything not in this box: [docs/COMMANDS.md](docs/COMMANDS.md) for the app, and
[docs/COMMANDS-PYTHON.md](docs/COMMANDS-PYTHON.md) for the slicer, the emitter, the queues and the
scorers.** Python lives in `.venv-ml` (training/data only,
never shipped). Node workspaces at the root.

```bash
npm run dev:web       # harness → http://localhost:5173 — decode runs in YOUR browser, heats the Mac
npm run dev:cloud     # the same harness with decode on Cloud Run — ⚠ THIS is how you keep the Mac cool
npm run typecheck     # all workspaces
npm test              # stitcher + labels + edits + usul + makam intonation + voices + violin fingering
npm run check:fold    # repeat SIGNS vs sound? 1720 pages, 0 changed. Render flags: COMMANDS.md
npm run smoke:editor  # real app: select, drag, delete, undo/redo, palette, rests, tuplets, voices
npm run gate:browser  # in-browser ONNX gate, headless — expect 27/28
npm run smoke:phone   # the app at four PHONE sizes, MEASURED — a probe, not a gate; never exits nonzero
npm run stats:ui      # the OWNER'S visit dashboard, dev server only — never built into dist/
.venv-ml/bin/python scripts/check_docs.py   # headers, size cap, links, code refs, orphans
```

⚠ **Deploying is NOT how you get work off this machine — `npm run dev:cloud` is** (owner, 2026-08-11).
⚠ **`npm run deploy:app` publishes to the real site**; read the output for `Deploy is live!`, because
a successful build is not a deploy.
⚠ **This Mac is a fanless M4.** Heavy compute goes to Colab (`docs/COLAB.md`), or locally with
`nice -19` and `OMR_ORT_THREADS=2`.
⚠ **Commits:** short lowercase subject, no co-author trailer.

# Hard rules

Three groups here. Each bullet is a lesson that was paid for once; the linked doc owns the numbers.
⚠ **The app's own rules — playback, the editor, the DOM, the stylesheet — are in
[docs/APP-RULES.md](docs/APP-RULES.md)**, split out at this file's 400-line cap on the
DOM-CONTRACT.md precedent. Group 4 below is the short list of what can be broken from anywhere.

## 1 · The exam, the labels, the tokens

- **The exam is one-shot.** `data/real/rung3/testset.json` pieces are never trained on, and the exam
  is read once per round on the final model. All iteration happens on real-val. ⚠ **It was read
  2026-09-01 for `r3-final-stage2-last`; runs A and B are the SAME round**, so a second read needs the
  owner to re-open it. ⛔ **Training on the exam was proposed 2026-09-01 and DECLINED**: +19% data
  against the retired pools' +41%, and irreversible — you cannot measure generalisation on data you
  trained on, and every past number becomes uncomparable.
- **Photos of exam pieces are EXAM-ONLY** — camera photos for training must come from other pieces.
- **NEVER SEED EXAM *GOLD* FROM THE DECODE OF A MODEL THAT WILL BE GRADED ON THAT EXAM** (owner,
  2026-08-21). It anchors the answer key toward that model: an error the reader lets past becomes
  "correct", and it is that model's own error. **The `label` column is gold — it is what an `ok`
  verdict promotes — so it stays derived, and `emit_strip_labels.py` is NOT re-run on the exam**,
  which keeps the model-voted `\sig` override off a graded model.
  ⚠ **THE *HINT* IS A DIFFERENT THING AND THE RULE WAS OVERTURNED FOR IT ON 2026-08-23** (owner):
  `examv3`'s edit-box `decoded` column comes from **`round2-stage2-best`** — a bad hint *causes*
  reader errors, so the old rule priced the model's bias and the human's at zero (`redecoded=1`
  double-report: [docs/DECISIONS.md](docs/DECISIONS.md)). ⚠ **Re-decode with
  `scripts/rung3/redecode_strips.py`, NEVER `decode_page()`** — it slices before it decodes and would
  re-cut the frozen exam crops. ⚠ `_realval_v2` keeps its `round2-stage2-best` seed because real-val
  **selects** and does not grade. ⚠ The training pools go the other way — one model,
  `round2-stage2-best`, for the whole re-emit: the gate model also aligns rows, and the weak referees
  threw away **10,695 strips** on alignment against 2,330 accepted, so yield dominates. A morning's
  plan to split "gate" and "hint" models was cancelled the same day.
- **THE KEY SIGNATURE IS THE ONE PART OF A LABEL THE MODEL DECIDES, NOT SymbTr** —
  `emit_strip_labels.py` takes a majority vote over the row-start decodes and **overwrites** the
  derivation with it, and the `nd` gate is blind to `\sig` blocks by design. It fired on 24 of 45 exam
  pieces and 43% of `strips_nota` pieces, and the weak voter's systematic koma/küçük confusion wins
  that vote unanimously. ⚠ **Treat any `\sig` block in a real-page label as unverified** until
  [docs/BACKLOG.md](docs/BACKLOG.md) item 9 is done. [docs/METRICS-CORPUS.md](docs/METRICS-CORPUS.md).
- **`\tie` IS RETIRED — AN ARC IS LABEL-FREE INK, LIKE A SLUR** (owner, 2026-08-22). Never write it,
  never emit it: two tied notes are two plain notes (`la'2 la'8`), same pitches and same total
  duration, so bar arithmetic and the stitcher are untouched. Reason: **65–78% of every `\tie` in the
  review queues joined two DIFFERENT pitches**, which is a slur. ⚠ **It stays in `ADDED_TOKENS` at its
  current position** — ids are append-only — as a token nothing emits; `strips_exam_v2*` keeps its ties
  as the record of what Round 2 was graded on. ⛔ **A TIE-FREE MODEL FAILS `gate:browser`**: one gate
  gold still contains `\tie`, so 27/28 is unreachable
  ([docs/METRICS-ONNX.md](docs/METRICS-ONNX.md)), and it inflates any comparison against a
  pre-retirement model — **~15 of 17 points** on the exam.
  [docs/rung3/labeling.md](docs/rung3/labeling.md).
- **Token ids are append-only** — new tokens go at the END of `ADDED_TOKENS` so existing ids stay
  stable across checkpoints.
- **No Western rehearsal data** in fine-tuning (owner decision 2026-07-03). Coverage comes from
  self-rendered Turkish strips.
- **Pixels and labels must be produced by the same code path.** The renderer and the label serializer
  share `rhythm.ts` / `stripExport.ts` on purpose — never hand-write a label. Where a rule IS
  duplicated (the carry/`sigTolerant` decision lives in both `SheetView.tsx` and `lilypond.ts`), a
  corpus is not trainable until `tools/render/verify-labels.ts` passes on it: that duplication
  silently cost Round 1 (docs/METRICS.md). ⚠ `sigTolerant` is a **flag on both sides**, fed by
  `SIG_TOLERANT` in `App.tsx` — **on** for renderer-driven pages (a synthetic page imitates a real
  printed edition, which writes a same-direction refinement bare) and **off** for a human, because the
  app's staff must say what it plays (owner, 2026-08-09). It is ONE flag for the draw path and the
  label path, so pixels == labels either way; `?mode=` in the URL is what makes a page
  "renderer-driven". ⚠ **A SECOND ENGRAVER EXISTS AND OBEYS THE SAME RULE** (2026-08-18):
  `tools/render/ly-engrave.ts` renders real LilyPond from a label the shared serializer already wrote,
  re-deciding nothing — `\accidentalStyle "forget"` plus a forced `!` leaves LilyPond unable to add or
  drop an accidental. Its gate is **`verify-labels-ly.ts`**, not `verify-labels.ts` (different engine,
  different glyph identification), and a pool it produced is not trainable until that passes.
- Two deliberate duplications, both pinned by `npm test`: core's `SIG_TOKEN_BY_ALTER` mirrors
  `AEU_TOKEN` in `tools/render/lilypond.ts`, and `packages/core/src/makamSignatures.ts` is
  **GENERATED** from `data/makam_signatures.json` — never hand-edit it, and re-emit with `--from-json`
  so refreshing the TS copy cannot rewrite the JSON from whatever pools are on the machine.

## 2 · The slicer, the caches, the scorers

- **A DECODE CACHE IS ONLY VALID FOR THE CV CODE THAT CUT ITS CROPS** (2026-08-25).
  `window_signature()` stores `GEOMETRY_REV` plus the geometry knobs; a `<page>_decode.json` without
  that field is REFUSED, because nothing in it says which slicer produced the crops it describes — and
  a 31 July cache used to pass every check while the 24–25 August fixes had moved the crops. ⚠ **Bump
  `GEOMETRY_REV` whenever the classical-CV path (staff detection, ink mask, barline detection) changes
  in a way that can move a crop boundary**; that invalidates every cache on disk and the next emit
  re-decodes, which is the point. ⚠ `score_slicer.py` deliberately does NOT consult it — its `old_*`
  column IS the retired pipeline's cache. ⚠ And `score_slicer.py --sample` has no default: **the
  instrument is 6,440 rows**, every score quoted before 2026-08-25 evening is a 124-row sample, and a
  full run reversed one call made on the sample.
  [docs/METRICS-SLICER-BARLINES.md](docs/METRICS-SLICER-BARLINES.md).
- **A CHANGE THAT ADDS OR REMOVES A STAFF CANNOT BE PRICED BY THE ROW-LEVEL SCORERS AS THEY STAND**
  (2026-08-25). Both pair a row to its cached truth **by system index**, so an inserted staff shifts
  every later index and each row is scored against another row's answer — a large **false regression**,
  not an error, which is the dangerous kind. ⚠ **`score_slicer.py` needs `--pair-by-position`** for any
  such change; it re-pairs by vertical position and counts added rows separately, because they **cannot
  be scored at all** — the truth is aligned from the OLD pipeline's decodes, which never saw them.
  ⛔ **`score_barlines.py` has the same coupling and NO fix**: its hand marks are keyed to detected
  rows, and across a staff change `bozukNihavendLonga` read **30 marked before and 3 after**. Never
  quote it across a staff-detection change. [docs/METRICS-SLICER.md](docs/METRICS-SLICER.md).
- **A WHOLE STAFF ROW GOES MISSING ON 14% OF PAGES, AND `STAFF_RESCUE` IS THE FIX — SHIPPING OFF**
  (2026-08-25). The horizontal opening's kernel is **one pixel tall**, so a wandering staff line is
  **erased, not weakened**; a lost row is **NO crop**, which is why no accuracy metric ever showed it.
  ⛔ **Do not "fix" it with a global knob** — every one was measured and rejected. ✅ What ships is a
  **second pass** re-detecting only in bands the page's own staff pitch says are empty; its **width**
  test is load-bearing (else a lyrics block is rescued as a staff). ⚠ **`STAFF_RESCUE` must move
  together in Python and `constants.ts`**, and turning it on bumps `GEOMETRY_REV`.
  [docs/METRICS-SLICER.md](docs/METRICS-SLICER.md).
- **THE APP HAS NO LABEL-BUDGET RAIL, AND ON DENSE PAGES THAT MEANS SILENTLY WRONG NOTES.** At
  inference an over-budget strip cannot be dropped, so the model emits `</s>` early and confidently;
  `hitCap` catches only 0.2%. **`?dense=<ids>` is an OPT-IN experiment**, not a default — parity
  unverified, no gold measurement, do not quote it.
  [docs/METRICS-DENSE.md](docs/METRICS-DENSE.md); the training-side budget, and why its gate is
  **80 ids under scheme H** where every pool before 2026-09-07 used 59, is in
  [docs/METRICS-SLICER-WINDOWS.md](docs/METRICS-SLICER-WINDOWS.md).
- **NOTHING under `src/vision/` ever becomes shippable** — the Python-decode-service question was
  closed 2026-08-05 by the Node stack in group 5.

## 3 · What ships, and what may never ship

- **There IS a backend now, for decode only** (owner decision 2026-08-05, reversing "no backend,
  ever"): the browser slices and POSTs crops, a **Cloud Run** CPU server runs the model. Reason:
  protect the user's machine — a page burns ~19 s of multi-threaded CPU on the client. **Everything
  else stays local** — audio, the editor, and the W4–W6 slicer port. **Do not delete the in-browser
  decode path**: `gate:browser`, `parity:armb`, `parity:arma`, `smoke:page` and the W3 browser-vs-gold
  result all rest on it, and it is the ONLY path in a build with no `VITE_DECODE_URL`.
  [docs/mvp/deploy.md](docs/mvp/deploy.md).
  ⛔ **BUT IT IS NO LONGER A FALLBACK: NOTHING IS READ ON THE VISITOR'S MACHINE WHERE A SERVER IS
  CONFIGURED** (owner, 2026-09-04) — a dead or cold container raises `server-unavailable` instead,
  because the `onnxruntime-web` fallback's real cost is the **211 MB of graphs** it pulls, worst of all
  on mobile data. ⚠ One function decides (`localDecodeAllowed()`), opt-in via
  `localStorage.omrAllowLocalDecode` / `VITE_ALLOW_LOCAL_DECODE`, set by **no deploy**; `smoke:build`
  and `smoke:live` gained **refusal arms** asserting that no `data-where` appears. ⚠ The Hub stays
  load-bearing (`model.json`, every path). ⚠ **Two timings the fallback used to absorb are now
  user-visible**, both raised 2026-09-04: `--max-instances` 3 → **10** (at concurrency 1 an
  over-capacity request QUEUES, erroring only past the client's 180 s) and `WARMUP_WAIT_MS` 40 s →
  **120 s**, after a cold start read **38.2 s**.
- **The server is Node + `onnxruntime-node` importing `apps/web/src/omr/decode.ts`** — the browser's
  own module, so there is ONE decode implementation, not a third to hold in parity. Do not write a
  second decoder in any language. Live on Cloud Run (europe-west3, 1 vCPU) since 2026-08-06. Two rules
  follow from how it was made to work: `decode.ts` may **not** import an ORT runtime (types come from
  `onnxruntime-common`, the `Tensor` constructor rides on `Sessions`), and **the client preprocesses**
  — the server receives finished 409×583 PNGs and applies only the rescale, so there is no second
  resampler to hold in parity either.
- **A production build is not the dev server, and only `smoke:build` knows the difference.** ORT's
  wasm runtime must be served as real files (`/ort/`, via `copy-ort.mjs`) or the bundler inlines its
  worker glue and every session creation hangs — dev, `smoke:page` and the 27/28 gate stayed green
  while the built app's fallback was frozen. Weights ship from `VITE_WEIGHTS_URL`, never from `dist/`;
  `build:app` fails if they leak in.
- **THE APP PUBLISHES NO SCORE, AND NOTHING MAY PUT ONE BACK** (owner decision 2026-08-08). Every score
  this project has is a SymbTr export, and SymbTr is **CC BY-NC-SA 4.0** — serving one binds the app to
  **NonCommercial forever**, and two were compositions still in copyright under FSEK 5846. So `SAMPLES`
  in `App.tsx` is **empty**, there is no Sample dropdown, and the app opens on the upload prompt. The
  files stay on disk **gitignored** because `npm test`, `smoke:editor` and the manual checks read them
  through **`?score=…`** — local use is not distribution, a `SAMPLES` entry is. ⚠ The enforcement is
  `prune-dist.mjs`, which **fails the build on any `.json` at the dist root**: everything under
  `public/` is served to whoever guesses the name, so "no UI links to it" proves nothing. An own-work
  score would go in a subdirectory. ⚠ If you need a score in a check, ask for `?score=`; wait on
  `#page-input` if you are uploading your own.
- ⚠ **AUDIO IS THE ONE THING THAT MAY SHIP FROM `public/`** (2026-08-11): F2's two CC0 drum kits,
  660 KB, under `public/audio/`. `prune-dist.mjs` fails the build on any audio file outside `audio/` or
  over **1 MB total** — a **permanent guard on the drums**, a decision point and not a dial. Provenance
  is in `apps/web/src/audio/strokeKits.ts` and `/THIRD-PARTY.txt`; the wavs are **generated** by
  `scripts/prepare_strokes.py` — never hand-edit one.
  ⚠ **THE INSTRUMENT VOICES DO NOT SHIP AND THE DRUMS DO** (owner, 2026-08-12). F1's clarinet and
  violin are 20–35 MB each, live in a Hugging Face **dataset** repo, and are fetched from
  **`VITE_VOICES_URL`** — a *separate* variable from the drums' `VITE_AUDIO_URL`, which must stay
  **unset in every deploy**: `VITE_AUDIO_URL` is one base for the whole `audio/` tree, so pointing it
  at the voices repo takes the drum kits with it, 404s them, and drops percussion back to the
  synthesised strokes the owner rejected by ear — silently, because the fallback still makes a sound.
  Voice files are never committed, trimmed or re-encoded; `scripts/prepare_voices.py` copies them and
  checks sha256, and every number in `apps/web/src/audio/instruments.ts` is emitted by that script —
  **never read a pitch off a filename**, VSCO's clarinet labels are an octave low.
  Full map: [docs/THIRD-PARTY.md](docs/THIRD-PARTY.md).
- ⚠ The footer (`#legal`) claims uploads are not stored — true only while `apps/server/src/index.ts`
  writes no image to disk; change both together.
- **THE SITE COUNTS ITS VISITS, ANONYMOUSLY, AND THE DASHBOARD IS NEVER PUBLISHED** (owner, 2026-09-05,
  reversing *no tracker*). ⛔ **NO NAMES** — invite links, a login and storing the raw IP were each
  offered and DECLINED. ⚠ **THE IP IS NEVER WRITTEN DOWN**: `visit.mts` hashes it with a secret **and
  the date**, so a device's id expires nightly. ⛔ **No salt, no counting** — an unset `STATS_SALT`
  records NOTHING rather than falling back to a permanent id; never "fix" that with a constant.
  ⚠ **Quote `read` (a decoded page), not `open`** — robots load pages constantly.
  ⚠ **`navigator.webdriver` is skipped, LOAD-BEARING**: `smoke:live` and `smoke:build` drive the real
  site and would otherwise be most of the traffic; the owner's devices opt out with `?nostats=1`.
  ⚠ **TWO INDEPENDENT LOCKS**: `apps/web/admin-stats.html` is not a vite entry so it never reaches
  `dist/` (⛔ never add it to `rollupOptions.input`), AND `stats.mts` demands a bearer token wherever it
  is asked, answering **503 not 200** when none is configured. ⚠ `deploy:app` carries
  `--functions netlify/functions` — without it the counter is simply absent.
  [docs/features/visit-stats.md](docs/features/visit-stats.md).
- **THE APP REMEMBERS THE PAGES IT HAS READ, AND IT STORES NOTES AND NEVER AN IMAGE** (owner,
  2026-09-05). A decoded page and every later edit go to the reader's own **IndexedDB**
  (`apps/web/src/recentPages.ts`); **30 pages**, least recently opened dropped. ⛔ **No image, ever** —
  the footer's `privacy` line has nothing to qualify only because of that choice. ⚠ **IndexedDB, not
  `localStorage`** — the edited state is written on every edit (debounced 2 s) and `localStorage` is
  SYNCHRONOUS, so a ~100 KB write blocks the main thread mid-drag. ⚠ **ONE save path and no explicit
  save call** — a decode opens a record (`saved` in `App.tsx`), an effect writes the document back two
  seconds later; never add a second, and never write from a load path. ⚠ **ONLY A DECODE OPENS A
  RECORD**: `?score=`, a sample and a hand-loaded JSON all clear it, which keeps every check's own
  fixture out of a reader's list — and why **`smoke:app` is the only check that can see this feature at
  all**. ⚠ **Every store function swallows and returns a safe value**: storage does not merely come back
  empty in a private window, it THROWS. ⛔ It is a **cache, not a save**, and `TR.recent.note` says so
  on screen — never write copy or a doc line that promises otherwise. ⚠ **A rename never touches the
  document**: `doc.name` seeds the per-piece hash that picks a tuplet's bracket-or-arc, so renaming
  through the score would silently re-engrave its triplets — the record carries the label (`pageName`),
  and the makam is a field **beside** the name, never inside it (owner: *"makamı da isme dahil
  olsun"*). [docs/features/recent-pages.md](docs/features/recent-pages.md).

## 4 · The six app rules that can be broken from anywhere

Full statements, with the bug each one cost, in **[docs/APP-RULES.md](docs/APP-RULES.md)**.

- **Nothing that must line up with a clock may be built from `doc`.** The written page is what a
  person reads and edits; the performance comes from `unfoldDoc`. ⚠ **Never make the app expand
  again**, and **never give `buildTimeline` the WRITTEN doc** — the makam deltas and the usul both
  shipped broken this way and neither threw. No browser check can reach this class of bug.
- **Hit-testing geometry is measured off real ink, never off a group's `getBBox()`.** Three live bugs
  came from this one mistake, the worst stealing 126 of 134 clicks on the page. It will recur with any
  new modifier or overlay.
- **`resolveStructure` in `stitch.ts` is the ONLY thing that says what a repeat or a 𝄋 does.** Never
  write a second rulebook in the editor.
- **No selector under `.kv-score` may set a font, and no `transform`/`zoom`/`scale` may touch that
  container** — that SVG is the training-strip source, and `render.ts` screenshots it by rect. This
  binds every CSS change, the phone's media queries included.
- **Never reintroduce a text or regex matcher** in a browser check. Checks read DOM attributes, which
  is what leaves all user-facing copy free to change; every string lives in `strings.ts`.
- **Token ids are append-only, and pixels and labels come from one code path** — see group 1; the app
  is one of the two producers.

## Doc conventions — full procedure in [docs/MAINTAINING.md](docs/MAINTAINING.md)

1. `docs/STATUS.md` is the **only** file that states current state or next action. Everything else
   links to it — never restate status.
2. **A number lives in one place**: `docs/METRICS.md` (or its source log). Prose may name a metric,
   not restate its value.
3. `docs/log/` is **append-only history**. `docs/log/superseded.md` holds abandoned plans — never
   act on anything found there.
4. New work goes in the track doc it belongs to (`docs/rung3/*`), not into STATUS.
5. Keep any doc under ~400 lines; split it instead of appending forever.
6. Run `.venv-ml/bin/python scripts/check_docs.py` after doc edits.

## Data layout (all gitignored)

```
data/real/            real pages: pdfs/ images/ rung3/ (matched, strips, photos_exam, testset.json)
data/real/rung3/      the label POOLS. strips_b8 (3,929) is the real training pool. ⚠ The ban on the
                      retired pools was LIFTED for run B on 2026-09-01: strips_oldhuman (1,408) holds
                      every HAND-VERIFIED strip from strips_nota/_r1/_tup. ⛔ MEASURED 2026-09-02 AND
                      IT BOUGHT NOTHING: run B is a NULL (645 vs 667 edits, p = 0.736) —
                      docs/METRICS-ROUND3-RUNS.md. ⛔ Never pass the raw old pools: 922 of
                      strips_nota's rows are machine-verdicted. b8-review is out (METRICS-B8.md)
                      crop roots, NEVER interchangeable — a strip filename survives a re-slice and
                      its pixels do not: strips/ (2026-07-15..17, the retired slicer; the frozen exam
                      and the real TRAINING pools hardlink from here), strips_v2/ (2026-07-29
                      re-slice; real-val), strips_examv3/ (2026-08-21, the REBUILT exam)
data/real/rung3/_handtest/  the OWNER'S 20 HAND-TEST PAGES, decoded (2026-09-06). ⛔ NOT gold, NOT the
                      exam: review_ui queue `handtest` counts CORRECTIONS per page, `label` is empty on
                      every row and promote_labels.py cannot read the file — its `decoded` hint is the
                      LIVE model's own output. The pictures live in /exam_pages/, gitignored (someone
                      else's engraving; this repo is public). docs/METRICS-HANDTEST.md
data/synthetic/       rendered strips — ROUND 3 TRAINED ON strips_v7_final (3 flags, 0 \tie) and ROUND 4 REUSES IT
                      UNCHANGED (no render, owner 2026-09-03). ⚠ IT IS NOW THE ONLY FULL SET ON DISK: the nine
                      superseded ones (v2..v6) were DELETED 2026-09-06 for space — re-render from
                      data/pieces_v4.json with the arm's flags if a comparison ever needs one
data/checkpoints/     r3a-stage2-best-real (+ -onnx int8, THE LIVE RUNTIME since 2026-09-03 —
                      published on the owner's HAND TEST, not an exam pass; round2-stage2-best and
                      r3-final-stage2-last are the superseded ones), the r3-* Round-3 arms, and
                      rung3-labeler: a July tooling checkpoint, NEVER shipped, that only feeds the
                      emitter and decode_page.py. ⚠ SPACE SWEEP 2026-09-06 — a checkpoint folder is
                      now THINNER than it was: every trainer_state.pt is gone (resume-only, and
                      every notebook already rsync'd --exclude'd it), the four staged-runtime backup
                      folders are gone (byte-identical to the int8 beside them), and outside
                      r3a-stage2-best-real-onnx the *-onnx folders keep ONLY *_int8.onnx.
                      ⚠ To revert the live site to a predecessor, stage its *_int8.onnx from
                      data/checkpoints/<name>-onnx/ — that is what _round2_backup/ and
                      _r3final_backup/ held. Re-export fp32 with optimum-cli from model.safetensors.
data/split.json       piece-level train/val split (strips_v4 uses data/split_v4.json, v3 split_v3)
                      — ALWAYS split by piece, never by strip: strips of one piece are near-duplicates
```
