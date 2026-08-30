# CLAUDE.md — read this first

Classical Turkish (makam) music **OMR**: photo/screenshot of sheet music → notes *including the
microtonal accidentals* → editable score → playback at exact 53-TET (Arel-Ezgi-Uzdilek) pitches.
Web app first, mobile later. Inference runs in the browser via `onnxruntime-web` — though whether it
stays there is [reopened](docs/mvp/deploy.md).

**TWO TRACKS RUN IN PARALLEL (owner, 2026-08-05).** The product track is building a decode server
(W9) for a release to **two friends** who will be asked about the **interface, not the model**; the
model track is **Round 3, now UNPAUSED** — it no longer waits for feedback, because feature feedback
would not aim it. Neither blocks the other. The public launch is gated on Round 3's exam result.
Ladder and state: [docs/mvp/README.md](docs/mvp/README.md). Synthetic accuracy is solved (99.9%);
the remaining model work is about real printed pages.

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
- Use a plain analogy when a mechanism is being explained (the model as a student, the exam as a
  final test, the corpus as practice questions).
- **Keep the numbers.** Plain English means simple words, not vague claims. Every number still comes
  from [docs/METRICS.md](docs/METRICS.md) or its source log, and still gets its n.
- Say plainly when something is a guess, a lead, or unmeasured. Do not dress a feeling as a finding.
- This does **not** change the doc conventions below, and it does not license rewriting history —
  see [docs/MAINTAINING.md](docs/MAINTAINING.md). It is about the voice of the reply.
- If you are not sure about something, ask to user. If anything ambigous ask. Do not assume. Also if a heavy command that would heat the pc, ask to user with its estimated finish time.

## Where things are

| Need | File |
|---|---|
| **Any command, and the traps that make one fail silently** | **[docs/COMMANDS.md](docs/COMMANDS.md)** |
| **"Sync the docs" / update docs after work** | **[docs/MAINTAINING.md](docs/MAINTAINING.md) — read before editing any doc** |
| What ships today, what's next, open risks | [docs/STATUS.md](docs/STATUS.md) |
| Any headline number (accuracy, corpus size, yield) | [docs/METRICS.md](docs/METRICS.md) |
| Why something was decided (and what overturned it) | [docs/DECISIONS.md](docs/DECISIONS.md) |
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

**⚠ The FULL command reference, with the traps that matter, is [docs/COMMANDS.md](docs/COMMANDS.md)
— read it before running anything not in this box.** Python lives in `.venv-ml` (training/data only,
never shipped). Node workspaces at the root.

```bash
npm run dev:web       # harness → http://localhost:5173 — decode runs in YOUR browser, heats the Mac
npm run dev:cloud     # the same harness with decode on Cloud Run — ⚠ THIS is how you keep the Mac cool
npm run typecheck     # all workspaces
npm test              # stitcher + labels + edit primitives + usul strokes + voices + violin fingering
npm run check:fold    # does keeping the repeat SIGNS change the sound? expect 1720 pages, 0 changed
npm run smoke:editor  # real app: select, drag, delete, undo/redo, palette, rests, tuplets, voices
npm run gate:browser  # in-browser ONNX gate, headless — expect 27/28
.venv-ml/bin/python scripts/check_docs.py   # doc structure + no-info-loss check
```

⚠ **Deploying is NOT how you get work off this machine — `npm run dev:cloud` is** (owner, 2026-08-11).
⚠ **`npm run deploy:app` publishes to the real site**; read the output for `Deploy is live!`, because
a successful build is not a deploy. Both, and every other command, in
[docs/COMMANDS.md](docs/COMMANDS.md).

## Hard rules

- **The exam is one-shot.** `data/real/rung3/testset.json` pieces are never trained on, and the
  exam is read once per round on the final model. All iteration happens on real-val.
- **Photos of exam pieces are EXAM-ONLY.** Training on them leaks the exam. Camera photos for
  training must come from different pieces.
- **NEVER SEED EXAM *GOLD* FROM THE DECODE OF A MODEL THAT WILL BE GRADED ON THAT EXAM** (owner,
  2026-08-21). It anchors the answer key toward that model: an error the reader lets past becomes
  "correct", and it is that model's own error. **The `label` column is gold — it is what an `ok`
  verdict promotes — so it stays derived, and `emit_strip_labels.py` is NOT re-run on the exam**,
  which is what keeps the model-voted `\sig` override off a graded model.
  ⚠ **THE *HINT* IS A DIFFERENT THING AND THE RULE WAS OVERTURNED FOR IT ON 2026-08-23** (owner):
  `examv3`'s edit-box `decoded` column now comes from **`round2-stage2-best`**, not `rung3-labeler`.
  The argument that won: a bad hint *causes reader errors*, which land in the gold just like an
  anchored one — the old rule priced the model's bias and priced the human's error at zero. Measured
  on the 214 already-verified rows: **223 → 150 token edits (−33%)**, **48% → 63% exact rows**.
  All 576 refreshed rows carry **`redecoded=1`** so the read reports the primary twice, with and
  without them. ⚠ **Re-decode with `scripts/rung3/redecode_strips.py`, NEVER `decode_page()`** —
  that slices before it decodes and would re-cut the frozen exam crops.
  `_realval_v2` keeps its `round2-stage2-best` seed because real-val **selects** and does not grade. ⚠ The training pools go
  the other way — one model, `round2-stage2-best`, for the whole re-emit: the gate model also aligns
  rows, and the weak referees threw away **10,695 strips** on alignment against 2,330 accepted, so
  yield dominates. A morning's plan to split "gate" and "hint" models was cancelled the same day.
- **THE KEY SIGNATURE IS THE ONE PART OF A LABEL THE MODEL DECIDES, NOT SymbTr** — `emit_strip_labels.py`
  takes a majority vote over the row-start decodes and **overwrites** the derivation with it, and the
  `nd` gate is blind to `\sig` blocks by design. It fired on 24 of 45 exam pieces and 43% of
  `strips_nota` pieces, and the weak voter's systematic koma/küçük confusion wins that vote
  unanimously. ⚠ **Treat any `\sig` block in a real-page label as unverified** until
  [docs/BACKLOG.md](docs/BACKLOG.md) item 9 is done. [docs/DECISIONS.md](docs/DECISIONS.md) ·
  [docs/METRICS-CORPUS.md](docs/METRICS-CORPUS.md).
- **`\tie` IS RETIRED — AN ARC IS LABEL-FREE INK, LIKE A SLUR** (owner, 2026-08-22). Never write it,
  never emit it: two tied notes are two plain notes (`la'2 la'8`), same pitches and same total
  duration, so bar arithmetic and the stitcher are untouched. It was retired because the token had
  three producers using it three ways — **65–78% of every `\tie` in the review queues joined two
  DIFFERENT pitches**, which is a slur, not a tie. ⚠ **`\tie` stays in `ADDED_TOKENS` at its current
  position** — ids are append-only, so removing it would break every checkpoint; it is simply a token
  nothing emits. ⚠ **The RENDER side landed 2026-08-22** — `measureAtoms` no longer
  writes the token, and the tie tail now **restrikes its accidental in `every`/`keysig` mode** on both
  the label and the drawing (a bare tail reads as *unaltered* with no carry and no token; carry mode is
  unchanged). `_realval_v2` still expects ties in 24% of rows, which no longer decides anything:
  `eval_omr.py` drops `\tie` from **both** the gold and the decode. `strips_exam_v2*` keeps its ties on purpose — it is
  the record of what Round 2 was graded on. [docs/rung3/labeling.md](docs/rung3/labeling.md).
- **A TUPLET IS PICKED UP BY ITS DRAWN "3", NOT BY ITS NOTES; A REAL ONE SLIDES, A BROKEN ONE IS
  REPAIRED** (owner, 2026-08-30). The engraved mark is the click target; its notes are
  `pointer-events: none`. ⚠ **EVERY drawn mark is holdable, including one over a SINGLE note** —
  `tupletGroupsIn` brackets runs that never sum plain (the model's misreads; `decoded.json` has five
  against two real triplets), and those most need fixing. The ✕ clears any of them (each member
  ×³⁄₂, notes kept); the handles **slide** a real triplet (always three members) but **repair** a
  broken one — grabbed end moves, other stays, allowed only when the result CLOSES or has FEWER
  members, so a broken mark can never be made merely broader. `tupletEdgeTo` owns both and
  `drawnTupletAt` finds a mark where `closedTupletAt` cannot.
  ⚠ **The target is measured off the mark's STROKES (`markBoxOf`), never off the wrapping group's
  `getBBox()`** — a `<text>` reports its FONT's em box (a bracket's "3" measured 12 × 160 px) and
  VexFlow leaves a zero-height `<rect>` at the SVG **origin**, so the group's box was a slab that
  swallowed note clicks (the `GraceNoteGroup` failure `noteBoxOf` documents, same origin rule).
  ⚠ The mark style is a per-piece hash and **all six bundled scores draw the arc**, so the
  VexFlow-**bracket** branch has **no automated coverage** — verified by hand on a renamed score.
  ⛔ **Do not "improve" a REAL triplet into a 4/5/7-note tuplet**: the digit is a hardcoded `"3"` and
  the token is `\tup3`, so a wider group would draw AND label a rhythm nobody wrote. A real n-tuplet
  needs a derived digit **and** new tokens (`\tup5` does not exist) — a corpus decision the owner
  deferred. ⚠ `tupletEdgeTo` sits beside the code that DRAWS the bracket and ends in a **simulation
  against `tupletGroupsIn`**, not a rule. Nothing is stored: a held mark is one event index.
  [docs/mvp/editor-built.md](docs/mvp/editor-built.md) · [docs/DECISIONS.md](docs/DECISIONS.md).
- **A DECODE CACHE IS ONLY VALID FOR THE CV CODE THAT CUT ITS CROPS** (2026-08-25). `window_signature()`
  stores `GEOMETRY_REV` plus the geometry knobs; a `<page>_decode.json` without that field is
  REFUSED, because nothing in it says which slicer produced the crops it describes — and a 31 July
  cache used to pass every check while the 24–25 August fixes had moved the crops. ⚠ **Bump
  `GEOMETRY_REV` whenever the classical-CV path (staff detection, ink mask, barline detection)
  changes in a way that can move a crop boundary**; that invalidates every cache on disk and the
  next emit re-decodes, which is the point. ⚠ `score_slicer.py` deliberately does NOT consult it —
  its `old_*` column IS the retired pipeline's cache. ⚠ And `score_slicer.py --sample` has no
  default: **the instrument is 6,440 rows**, every score quoted before 2026-08-25 evening is a
  124-row sample, and a full run reversed one call made on the sample.
  [docs/METRICS-SLICER-BARLINES.md](docs/METRICS-SLICER-BARLINES.md).
- **A CHANGE THAT ADDS OR REMOVES A STAFF CANNOT BE PRICED BY THE ROW-LEVEL SCORERS AS THEY STAND**
  (2026-08-25). Both pair a row to its cached truth **by system index**, so an inserted staff shifts
  every later index and each row is scored against another row's answer — a large **false
  regression**, not an error, which is the dangerous kind. ⚠ **`score_slicer.py` needs
  `--pair-by-position`** for any such change; it re-pairs by vertical position and counts added rows
  separately, because they **cannot be scored at all** — the truth is aligned from the OLD
  pipeline's decodes, which never saw them. ⛔ **`score_barlines.py` has the same coupling and NO
  fix**: its hand marks are keyed to detected rows, and across a staff change `bozukNihavendLonga`
  read **30 marked before and 3 after**. Never quote it across a staff-detection change.
  [docs/METRICS-SLICER.md](docs/METRICS-SLICER.md).
- **A WHOLE STAFF ROW GOES MISSING ON 14% OF PAGES, AND `STAFF_RESCUE` IS THE FIX — SHIPPING OFF**
  (2026-08-25). The horizontal opening's kernel is **one pixel tall**, so a staff line that wanders
  across rows is **erased, not weakened**; a lost row is not a bad crop, it is **NO crop**, so no
  accuracy metric has ever shown it. ⛔ **Do not "fix" this with a global knob** — dilating before
  the opening takes one hand-ruled page 5 → 8 staves and takes `bozukNihavendLonga` **10 → 1**, and
  scaling the dilation to the measured line spacing does not escape the trade; a horizontal CLOSE is
  worse still, because it lifts `row_ink.max()` and so lifts the relative threshold. ✅ The shipped
  shape is a **second pass** that re-detects only in the bands the page's own staff pitch says are
  empty, so a page whose rows were all found cannot move. ⚠ Its **width** test is load-bearing:
  without it the underlined-lyrics block at the foot of a page is rescued as a staff. Full scale:
  all **6,440** scored rows identical, **+320 rows on 227 of 1,592 pages**; `parity:slicer` passes
  with the flag ON. ⚠ **`STAFF_RESCUE` must move together in Python and `constants.ts`** or the app
  cuts differently from the training data, and turning it on bumps `GEOMETRY_REV`.
  [docs/METRICS-SLICER.md](docs/METRICS-SLICER.md).
- **THE APP HAS NO LABEL-BUDGET RAIL, AND ON DENSE PAGES THAT MEANS SILENTLY WRONG NOTES.** The
  browser slicer packs by measures and width only; at inference an over-budget strip cannot be
  dropped, so the model emits `</s>` early and confidently. `hitCap` catches **7 of 4,012 (0.2%)**.
  **`?dense=<ids>` (try 50) is an OPT-IN experiment**, not a default — it adds the budget rail so a
  dense row is cut into strips the model can express. ⚠ Its browser-vs-Python parity is **unverified**
  and there is **no gold accuracy measurement**; do not quote it as a result. Delete it by removing
  the marked block in `apps/web/src/omr/slicer/windows.ts`, the `tokenBudget` option and the
  `?dense=` read in `App.tsx`. [docs/METRICS-SLICER-WINDOWS.md](docs/METRICS-SLICER-WINDOWS.md).
- **THE APP KEEPS THE PAGE AS WRITTEN, AND THE REPEAT IS TAKEN WHEN IT PLAYS** (owner, 2026-08-30).
  A decoded page is stitched with **`expand: false`**, so `‖: … :‖`, the 1./2. brackets and
  𝄋 / ⊕ / "D.C." / "Son" stay as SIGNS and the repeated bars are drawn **once**. The performance is
  derived: `stitch.ts` returns `structure` (`bars` + `playBars`), core's **`unfoldDoc`** expands it,
  and `buildTimeline` runs on that — so everything on the audio side still receives a plain flat
  document. ⚠ **Never make the app expand again** to "fix" something downstream; the fix is to unfold
  at that point instead. ⚠ **`buildTimeline` must never be given the WRITTEN doc** when a structure
  exists — it would play the repeat once and the cursor would still be right, which is the silent
  version of this bug. ⚠ The playhead follows a **play plan** (`PlayStep[]`: one step per sounding
  event, naming the WRITTEN note drawn for it) and SheetView indexes its drawn positions **by event
  index**; a change that breaks that link desynchronises picture from sound without failing anything.
  ⚠ **A FIRST ENDING IS A RUN, NOT ONE BAR** (owner, 2026-08-30): it goes from the "1." to the `:‖`
  and the second pass skips **all** of it, capped at `MAX_FIRST_ENDING = 4` bars because a "1." far
  from its `:‖` is a stray token, and obeying one would delete real music. It is resolved **once**,
  in `expandRepeats` → `ScoreStructure.firstEndings`; the drawn "1." reads that answer rather than
  re-deriving it, or the ink and the music drift apart (they did — 37.9% of real first endings).
  ⚠ **DECODED PAGES ONLY** — a SymbTr sample is flat in the data, so folding one means guessing from
  duplicate bars; `Tekrarlar` still only DRAWS there, and the renderer path (`?repseed=`/`?navseed=`)
  is untouched, so the training corpus is byte-identical. ⚠ `Tekrarları açık yaz` is **view-only and
  closes edit mode** (every repeated bar there is a copy). The safety claim is `npm run check:fold`:
  unfolding reproduces the old flattened document over **1,720 pages, 0 changed**.
  [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/METRICS.md](docs/METRICS.md).
- **No Western rehearsal data** in fine-tuning (owner decision 2026-07-03). Coverage comes from
  self-rendered Turkish strips.
- **There IS a backend now, for decode only** (owner decision 2026-08-05, reversing "no backend,
  ever"): the browser slices and POSTs crops, a **Cloud Run** CPU server runs the model. Reason:
  protect the user's machine — a page burns ~19 s of multi-threaded CPU on the client. Plan:
  [docs/mvp/deploy.md](docs/mvp/deploy.md). **Everything else stays local** — audio, the editor, and
  the W4–W6 slicer port. **Do not delete the in-browser decode path**: `gate:browser`,
  `parity:armb`, `parity:arma`, `smoke:page` and the W3 browser-vs-gold result all rest on it, and
  it is also the **live fallback** when the server is cold or down.

- **The server is Node + `onnxruntime-node` importing `apps/web/src/omr/decode.ts`** — the browser's
  own module, so there is ONE decode implementation, not a third to hold in parity. Do not write a
  second decoder in any language. **Built AND DEPLOYED 2026-08-06** — live on Cloud Run (europe-west3, 1 vCPU); URL and numbers in [docs/STATUS.md](docs/STATUS.md). Two
  rules follow from how it was made to work: `decode.ts` may **not** import an ORT runtime (types
  come from `onnxruntime-common`, the `Tensor` constructor rides on `Sessions`), and **the client
  preprocesses** — the server receives finished 409×583 PNGs and applies only the rescale, so there
  is no second resampler to hold in parity either.

- **The deploy checks read DOM state, never the words on the page** (2026-08-07, the style pass).
  `apps/web/src/ui/status.ts` is the single producer of the contract — `#omr-status` carries
  `data-state`, `data-kind`, `data-where` and the counts; `#omr-error` carries `data-error-kind`;
  `#play` carries `data-play-state`; `#app` carries `data-ready`. The editor adds
  `#edit-toggle[data-edit-mode]`, `#sheet-surface[data-edit-mode]` + `[data-selected-note]`,
  `[data-omr-note]` / `[data-selected]` per note, `#note-delete` / `#undo` / `#redo`, and the
  palette's `#edit-palette[data-armed]` + `[data-tool]` per tool, its transport
  `#edit-palette[data-play-from]` + `#palette-play[data-play-state]` / `#palette-stop`, the
  insert preview `[data-omr="insert-ghost"][data-insert-pitch]`, the tuplet tool's
  `#sheet-surface[data-tuplet-anchor]` + `[data-tuplet="start|member|anchor|end|blocked"]` per note,
  the drawn mark's own target `[data-omr="tuplet-mark-hit"][data-tuplet-group][data-tuplet-mark="closed|broken"]`
  (⚠ **the SIGN selects a tuplet; its notes are `pointer-events: none`** — owner, 2026-08-30), a HELD
  mark's `#sheet-surface[data-tuplet-selected]` + `[data-tuplet-held]` per member +
  `[data-tuplet-landing="start|end|both"]` (plus `[data-tuplet-fix]` where the move would COMPLETE a
  broken mark) + `[data-omr="tuplet-handle"][data-edge]` + `[data-omr="tuplet-frame"]` + `#tuplet-remove`,
  and the off-meter mark `[data-omr="bar-warning"]` + `[data-bar]` + `[data-bar-fill="over|under"]`
  (⚠ **`data-edit-mode` AND `data-play-state` are each on two elements** — select the one you mean
  by id). The fingerboard tab (F3) adds `#fingerboard[data-omr="fingerboard"][data-tuning][data-strings][data-lines][data-zoom]`,
  `[data-omr="finger-marker"]` carrying `data-string` / `data-ratio` / `data-finger-state="idle|open|stopped|rest|out-of-range"`,
  and `[data-omr="fingerboard-tick"]` per line of the position chart, carrying `data-commas` /
  `data-ratio` / `data-finger` — so a check reads WHERE the finger is, never a label. ⚠ The tick is a
  line ACROSS the neck, not a notch on one string, and the chart is **fixed** (the seven standard
  first-position notes, identical on every score) — assert it by comparing the whole chart across two
  pieces, never by counting. `#fingerboard-lines` hides them: assert the marks AND `data-lines`,
  because the checkbox alone can be unchecked while the lines are still drawn.
  ⚠ Same for `#fingerboard-zoom`: the **viewBox** is the zoom, so read that — `data-zoom` alone would
  pass on a control wired to nothing. ⚠ Its arithmetic is **not** a browser concern: `tools/core/fingering-test.ts` owns the
  position formula and the string-choice rule. **The kanun tab (F3's second instrument) adds**
  `#kanun[data-omr="kanun"][data-courses][data-mandals][data-zoom="full|mandal"][data-note-state="idle|playing|rest|out-of-range"]`,
  312 `[data-omr="kanun-mandal"]` carrying `data-course` / `data-mandal` / `data-offset` /
  `data-mandal-state="up|down"` / `data-changed="to|from"`, 26 `[data-omr="kanun-course"]` **groups** carrying
  `data-perde` / `data-course-state="idle|playing"`, each holding **three `<line>`s** because a perde
  is three strings sharing one lever (78 in total, and `smoke:editor` asserts the total — 26 would
  still pass if the view went back to one line each), and one `[data-omr="kanun-opening-item"]` per
  course the makam sets before playing. ⚠ **`data-mandal-state` is the load-bearing one: exactly ONE
  lever per course is `up` at every moment**, and `smoke:editor` asserts that at every sample across
  a whole playback — a mandal is a lever that STAYS WHERE IT IS PUT, so a leak in the replay shows up
  there and nowhere else. ⚠ `data-changed` **fades**: it marks an event, not a state, so never assert
  it without driving the clock to a change — and it is drawn as a red **frame**, never a fill,
  because the fill is what carries `data-mandal-state`. ⚠ Its arithmetic is `tools/core/kanun-test.ts`. The playhead carries `[data-omr="playhead"]`, because an attribute naming a bar cannot
  prove playback began there. A tuplet is **not stored** anywhere, so no attribute can prove one was
  made: `smoke:editor` counts the marks the engraver drew, in **both** styles (`.vf-tuplet` and the
  curved arc's italic "3" — the style is a per-piece coin). ⚠ **There is no `#save-json` any more** (owner, 2026-08-30): a check that needs the
  note model reads **`window.__omrDoc`**, and `window.__omrStructure` carries a decoded page's signs
  and playing order — both beside the older `__omrStrips` / `__omrMeta` / `__omrConfig` hooks. The six
  `tools/browser/*-smoke.ts`
  assert on those, so **all user-facing copy is free to change** — that is what let the UI become
  Turkish. Never reintroduce a text/regex matcher for a status message or a button label. Every
  user-visible string lives in `apps/web/src/ui/strings.ts`. ⚠ Two traps: nothing that ticks on a
  timer may render inside `#omr-status` (`page-smoke` counts distinct texts to prove progress
  moved), and `#strips-input` lives inside the collapsed `<details id="advanced">`, so `app-smoke`
  opens it first and the file inputs use the clip pattern, never `display:none`.
- **THE APP PUBLISHES NO SCORE, AND NOTHING MAY PUT ONE BACK** (owner decision 2026-08-08). Every
  score this project has is a SymbTr export, and SymbTr is **CC BY-NC-SA 4.0** — serving one binds
  the app to **NonCommercial forever**, and two of them were compositions still in copyright under
  FSEK 5846. So `SAMPLES` in `App.tsx` is **empty**, there is no Sample dropdown, and the app opens
  on the upload prompt. The files stay on disk **gitignored** because `npm test`, `smoke:editor` and
  the manual checks read them through **`?score=…`** against a dev server — local use is not
  distribution, adding a `SAMPLES` entry is. ⚠ The enforcement is `prune-dist.mjs`, which **fails
  the build on any `.json` at the dist root**: everything under `public/` is served to whoever
  guesses the name, so "no UI links to it" proves nothing. An own-work score would go in a
  subdirectory. ⚠ **AUDIO IS THE ONE THING THAT MAY SHIP FROM `public/`** (2026-08-11): F2's two CC0
  drum kits, 660 KB, under `public/audio/`. `prune-dist.mjs` fails the build on any audio file
  outside `audio/` or over **1 MB total** — and that 1 MB is a decision point, not a dial. ⚠ It was
  written as a trigger that F1 would fire; **F1 came and went without moving it** (2026-08-13), so it
  is now a **permanent guard on the drums**. A future kit that trips it is a decision to make, not a
  number to raise. Provenance per file lives in `apps/web/src/audio/strokeKits.ts` and `/THIRD-PARTY.txt`,
  and the wavs are **generated** by `scripts/prepare_strokes.py` — never hand-edit one.
  ⚠ **THE INSTRUMENT VOICES DO NOT SHIP AND THE DRUMS DO** (owner, 2026-08-12). F1's clarinet and
  violin are 20–35 MB each, live in a Hugging Face **dataset** repo, and are fetched at runtime from
  **`VITE_VOICES_URL`** — a *separate* variable from the drums' `VITE_AUDIO_URL`, which must stay
  **unset in every deploy**. The reason is not tidiness: `VITE_AUDIO_URL` is one base for the whole
  `audio/` tree, so pointing it at the voices repo takes the two drum kits with it, 404s them, and
  drops percussion back to the synthesised strokes the owner rejected by ear — silently, because the
  fallback still makes a sound. `MAX_AUDIO_MB` is therefore a **permanent guard on the drums**, not
  a trigger that has now fired. Voice files are never committed, never trimmed and never
  re-encoded; `scripts/prepare_voices.py` copies them and checks sha256, and every number in
  `apps/web/src/audio/instruments.ts` is emitted by that script — **never read a pitch off a
  filename**, VSCO's clarinet labels are an octave low.
  ⚠ Consequence for browser checks: **`data-ready` never appears on a bare visit** —
  it means "a score is installed" and none is. Ask for `?score=` if you need one; wait on
  `#page-input` if you are uploading your own. ⚠ The footer (`#legal`) claims uploads are not
  stored — true only while `apps/server/src/index.ts` writes no image to disk; change both together.
  Full map: [docs/THIRD-PARTY.md](docs/THIRD-PARTY.md).
- **The score's SVG is also the training-strip source, so CSS must not reach it.** No selector under
  `.kv-score` may set a font, and no `transform`/`zoom`/`scale` may touch that container —
  `tools/render/render.ts` screenshots the VexFlow SVG by rect to cut strips, and rects do not
  survive a transform. The design system is `apps/web/src/styles/` (`tokens.css` → `base.css` →
  `app.css`); classes are `.kv-*`.
- **`StaveNote.getBoundingBox()` is a merge over the note's MODIFIERS, so it is not safe on its own**
  (2026-08-08, a live bug). `GraceNoteGroup` never positions itself, so it reports its box at the SVG
  **origin**, and merging that stretched a graced note's click box from the top-left of the score to
  the note — 949×1805 px, stealing 126 of 134 clicks on the page. `noteBoxOf` in `SheetView.tsx`
  therefore rejects any box reaching x ≤ 0 or y ≤ 0 and falls back to the note's own ink
  (`getNoteHeadBounds` / `getStemExtents` / `getGlyphWidth`, all real positioned geometry). Two things
  follow: **the default sample has no grace notes, so `smoke:editor` loads `beyati-delisin.json` for
  its geometry section** — keep it that way, a check on a graceless score cannot see this class of
  bug; and if you ever add a modifier, verify it positions itself before trusting a merged box.
- **A production build is not the dev server, and only `smoke:build` knows the difference.** ORT's
  wasm runtime must be served as real files (`/ort/`, via `copy-ort.mjs`) or the bundler inlines its
  worker glue and every session creation hangs — dev, `smoke:page` and the 27/28 gate stayed green
  while the built app's fallback was frozen. Weights ship from `VITE_WEIGHTS_URL`, never from
  `dist/`; `build:app` fails if they leak in.
- **Python is training/data only, and NOTHING ships.** The rule stands unchanged: the open question
  about a Python decode service was **closed on 2026-08-05** by choosing the Node stack above.
  Nothing under `src/vision/` becomes shippable.
- **The makam bends the SOUND ONLY** (owner decision 2026-08-06, shipped 2026-08-07). Selecting a
  makam adds comma deltas to the sounding koma on the way into `buildTimeline` — the engraving,
  `Save JSON` and `buildStrips` never move, and no key signature is redrawn. The table carries
  **documented deviations only**; `none` is the default. Table, sources and the signature+karar
  guess: [docs/mvp/makam.md](docs/mvp/makam.md). Two deliberate duplications live here and are both
  pinned by `npm test`: core's `SIG_TOKEN_BY_ALTER` mirrors `AEU_TOKEN` in `tools/render/
  lilypond.ts`, and `packages/core/src/makamSignatures.ts` is **GENERATED** from
  `data/makam_signatures.json` — never hand-edit it, and re-emit with `--from-json` so refreshing
  the TS copy cannot rewrite the JSON from whatever pools are on the machine.
- **Token ids are append-only** — new tokens go at the END of `ADDED_TOKENS` so existing ids stay
  stable across checkpoints.
- **This Mac is a fanless M4.** Heavy compute goes to Colab (`docs/COLAB.md`), or locally with
  `nice -19` and `OMR_ORT_THREADS=2`.
- **Pixels and labels must be produced by the same code path.** The renderer and the label
  serializer share `rhythm.ts` / `stripExport.ts` on purpose — never hand-write a label. Where a
  rule IS duplicated (the carry/`sigTolerant` decision lives in both `SheetView.tsx` and
  `lilypond.ts`), a corpus is not trainable until `tools/render/verify-labels.ts` passes on it:
  that duplication silently cost Round 1 (docs/METRICS.md). ⚠ `sigTolerant` is now a **flag on both
  sides**, fed by `SIG_TOLERANT` in `App.tsx` — **on** for renderer-driven pages (a synthetic page
  imitates a real printed edition, which writes a same-direction refinement bare) and **off** for a
  human, because the app's staff must say what it plays (owner, 2026-08-09; docs/DECISIONS.md). It
  is ONE flag for the draw path and the label path, so pixels == labels either way — never set them
  apart, and note that `?mode=` in the URL is what makes a page "renderer-driven".
  ⚠ **A SECOND ENGRAVER EXISTS AND IT OBEYS THE SAME RULE** (2026-08-18): `tools/render/ly-engrave.ts`
  renders real LilyPond from a label the shared serializer already wrote, re-deciding nothing —
  `\accidentalStyle "forget"` plus a forced `!` leaves LilyPond unable to add or drop an accidental.
  Its gate is **`verify-labels-ly.ts`**, not `verify-labels.ts` (different engine, different glyph
  identification), and a pool it produced is not trainable until that passes.
- **Commits:** short lowercase subject, no co-author trailer.

## Doc conventions (keep them or the docs rot)

The short version is below; the full procedure — what to update after a session, and why each rule
exists — is [docs/MAINTAINING.md](docs/MAINTAINING.md).

Full guide — what to update after a session, and why each rule exists:
[docs/MAINTAINING.md](docs/MAINTAINING.md).

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
data/real/rung3/      the label POOLS: strips_nota / strips_r1 / strips_tup (11-17 Jul crops, and the
                      1,442 human fixes) + strips_b8 (2026-08-21, the SAME pools re-emitted onto the
                      current crops). Not interchangeable and not yet merged — see METRICS-CORPUS.md
                      crop roots, NEVER interchangeable — a strip filename survives a re-slice and
                      its pixels do not: strips/ (2026-07-15..17, the retired slicer; the frozen exam
                      and the real TRAINING pools hardlink from here), strips_v2/ (2026-07-29
                      re-slice; real-val), strips_examv3/ (2026-08-21, the REBUILT exam)
data/synthetic/       rendered strips — strips_v4 is current, older sets kept (v3 = the A/B control)
data/checkpoints/     round2-stage2-best (+ -onnx int8, THE LIVE RUNTIME — round1-best is the
                      superseded one), the r3-* Round-3 arms, and rung3-labeler: a July tooling
                      checkpoint, NEVER shipped, that only feeds the emitter and decode_page.py
data/split.json       piece-level train/val split (strips_v4 uses data/split_v4.json, v3 split_v3)
                      — ALWAYS split by piece, never by strip: strips of one piece are near-duplicates
```
