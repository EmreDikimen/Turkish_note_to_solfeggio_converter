# CLAUDE.md — read this first

Classical Turkish (makam) music **OMR**: photo/screenshot of sheet music → notes *including the
microtonal accidentals* → editable score → playback at exact 53-TET (Arel-Ezgi-Uzdilek) pitches.
Web app first; the phone is a first-class target. Decode runs on Cloud Run, and **only** there where
a server is configured — the in-browser `onnxruntime-web` path is no longer a fallback (Hard rules).

**TWO TRACKS RUN IN PARALLEL (owner, 2026-08-05).** The product track is building a decode server
(W9) for a release to **two friends** who will be asked about the **interface, not the model**; the
model track is **Round 4 (opened 2026-09-03; Round 3 read 51% against 75% and missed)** — it draws nothing new: it re-spells labels for the tokenizer, re-emits the dense half of every real page, fixes the model-voted signature and the checkpoint pick ([docs/rung3/round4.md](docs/rung3/round4.md)). Neither blocks the other. The public launch is gated on the exam result of the round in progress.
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
npm test              # stitcher + labels + edits + usul + makam intonation + voices + violin fingering
npm run check:fold    # repeat SIGNS vs sound? 1720 pages, 0 changed. Render flags: COMMANDS.md
npm run smoke:editor  # real app: select, drag, delete, undo/redo, palette, rests, tuplets, voices
npm run gate:browser  # in-browser ONNX gate, headless — expect 27/28
npm run smoke:phone   # the app at four PHONE sizes, MEASURED — a probe, not a gate; never exits nonzero
.venv-ml/bin/python scripts/check_docs.py   # doc structure + no-info-loss check
```

⚠ **Deploying is NOT how you get work off this machine — `npm run dev:cloud` is** (owner, 2026-08-11).
⚠ **`npm run deploy:app` publishes to the real site**; read the output for `Deploy is live!`, because
a successful build is not a deploy.

## Hard rules

- **The exam is one-shot.** `data/real/rung3/testset.json` pieces are never trained on, and the
  exam is read once per round on the final model. All iteration happens on real-val. ⚠ **It was read
  on 2026-09-01 for `r3-final-stage2-last`; runs A and B are the SAME round**, so a second read is not
  available without the owner re-opening it. ⛔ **Training on the exam was proposed 2026-09-01 and
  DECLINED**: +19% data against the retired pools' +41%, and irreversible — you cannot measure
  generalisation on data you trained on, and every past number becomes uncomparable.
- **Photos of exam pieces are EXAM-ONLY** — camera photos for training must come from other pieces.
- **NEVER SEED EXAM *GOLD* FROM THE DECODE OF A MODEL THAT WILL BE GRADED ON THAT EXAM** (owner,
  2026-08-21). It anchors the answer key toward that model: an error the reader lets past becomes
  "correct", and it is that model's own error. **The `label` column is gold — it is what an `ok`
  verdict promotes — so it stays derived, and `emit_strip_labels.py` is NOT re-run on the exam**,
  which is what keeps the model-voted `\sig` override off a graded model.
  ⚠ **THE *HINT* IS A DIFFERENT THING AND THE RULE WAS OVERTURNED FOR IT ON 2026-08-23** (owner):
  `examv3`'s edit-box `decoded` column comes from **`round2-stage2-best`** — a bad hint *causes*
  reader errors, so the old rule priced the model's bias and the human's at zero. Numbers and the
  `redecoded=1` double-report: [docs/DECISIONS.md](docs/DECISIONS.md). ⚠ **Re-decode with
  `scripts/rung3/redecode_strips.py`, NEVER `decode_page()`** — it slices before it decodes and would
  re-cut the frozen exam crops.
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
  duration, so bar arithmetic and the stitcher are untouched. Reason: **65–78% of every `\tie` in the
  review queues joined two DIFFERENT pitches**, which is a slur. ⚠ **It stays in `ADDED_TOKENS` at its
  current position** — ids are append-only — as a token nothing emits; `strips_exam_v2*` keeps its
  ties as the record of what Round 2 was graded on. ⛔ **A TIE-FREE MODEL FAILS `gate:browser`**: one
  gate gold still contains `\tie`, so 27/28 is unreachable ([docs/METRICS-ONNX.md](docs/METRICS-ONNX.md)),
  and it inflates any comparison against a pre-retirement model — **~15 of 17 points** on the exam.
  [docs/rung3/labeling.md](docs/rung3/labeling.md) · [docs/METRICS-CORPUS.md](docs/METRICS-CORPUS.md).
- **A TUPLET IS PICKED UP BY ITS DRAWN "3", NOT BY ITS NOTES; A REAL ONE SLIDES, A BROKEN ONE IS REPAIRED**
  (owner, 2026-08-30). The mark is the click target — in **Seçim as well as under ÜÇLEME** (`tupletPickable`),
  never with a note value or accidental armed; under ÜÇLEME its notes are `pointer-events: none`, and
  note-vs-mark selection is exclusive (each carries a ✕). ⚠ **EVERY drawn mark is holdable, including one over
  a SINGLE note** — `tupletGroupsIn` brackets runs that never sum plain, the model's misreads (`decoded.json`:
  five against two real triplets). The ✕ clears any (each member ×³⁄₂, notes kept); the handles **slide** a
  real triplet (three members always) but **repair** a broken one — grabbed end moves, other stays, only when
  the result CLOSES or has FEWER members, never merely broader. `tupletEdgeTo` owns both, `drawnTupletAt`
  finds a mark where `closedTupletAt` cannot, and its last check is a **simulation against `tupletGroupsIn`**,
  not a rule. ⛔ **Never widen a REAL triplet into a 4/5/7-tuplet**: the digit is hardcoded `"3"` and the token
  `\tup3`, so it would draw AND label a rhythm nobody wrote — needs new tokens, deferred. ⚠ **Two geometry
  traps, both already paid for.** (1) The target is measured off the mark's STROKES (`markBoxOf`), never its
  group's `getBBox()`: a `<text>` reports its FONT's em box (a bracket's "3" measured 12 × 160 px) and VexFlow
  leaves a zero-height `<rect>` at the SVG **origin**, so the group's box was a slab that swallowed note
  clicks (`noteBoxOf`'s `GraceNoteGroup` failure). (2) The mark overlay paints **after** the note targets so
  it wins where they overlap (a live note box swallowed the mark in Seçim); the bargain is `smoke:editor`'s
  **no note's CENTRE may fall inside a mark's box**. ⚠ The style is a per-piece hash and all six bundled
  scores draw the arc, so the VexFlow-**bracket** branch has **no automated coverage**.
  [editor-built.md](docs/mvp/editor-built.md).
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
- **A CHANGE THAT ADDS OR REMOVES A STAFF CANNOT BE PRICED BY THE ROW-LEVEL SCORERS AS THEY STAND** (2026-08-25). Both
  pair a row to its cached truth **by system index**, so an inserted staff shifts every later index and each row is
  scored against another row's answer — a large **false regression**, not an error, which is the dangerous kind. ⚠
  **`score_slicer.py` needs `--pair-by-position`** for any such change; it re-pairs by vertical position and counts
  added rows separately, because they **cannot be scored at all** — the truth is aligned from the OLD pipeline's
  decodes, which never saw them. ⛔ **`score_barlines.py` has the same coupling and NO fix**: its hand marks are keyed
  to detected rows, and across a staff change `bozukNihavendLonga` read **30 marked before and 3 after**. Never quote
  it across a staff-detection change. [docs/METRICS-SLICER.md](docs/METRICS-SLICER.md).
- **A WHOLE STAFF ROW GOES MISSING ON 14% OF PAGES, AND `STAFF_RESCUE` IS THE FIX — SHIPPING OFF** (2026-08-25).
  The horizontal opening's kernel is **one pixel tall**, so a wandering staff line is **erased, not weakened**; a lost
  row is **NO crop**, which is why no accuracy metric ever showed it. ⛔ **Do not "fix" it with a global knob** —
  every one was measured and rejected. ✅ What ships is a **second pass** re-detecting only in bands the page's own
  staff pitch says are empty; its **width** test is load-bearing (else a lyrics block is rescued as a staff).
  ⚠ **`STAFF_RESCUE` must move together in Python and `constants.ts`**, and turning it on bumps `GEOMETRY_REV`.
  [docs/METRICS-SLICER.md](docs/METRICS-SLICER.md).
- **THE APP HAS NO LABEL-BUDGET RAIL, AND ON DENSE PAGES THAT MEANS SILENTLY WRONG NOTES.** At
  inference an over-budget strip cannot be dropped, so the model emits `</s>` early and confidently;
  `hitCap` catches only 0.2%. **`?dense=<ids>` is an OPT-IN experiment**, not a default — parity
  unverified, no gold measurement, do not quote it. Removal points and every number:
  [docs/METRICS-SLICER-WINDOWS.md](docs/METRICS-SLICER-WINDOWS.md).
- **THE APP KEEPS THE PAGE AS WRITTEN, AND THE REPEAT IS TAKEN WHEN IT PLAYS** (owner, 2026-08-30). A decoded
  page is stitched with **`expand: false`**, so `‖: … :‖`, the 1./2. brackets and 𝄋 / ⊕ / "D.C." / "Son" stay as
  SIGNS and repeated bars are drawn **once**. The performance is derived: `stitch.ts` returns `structure`
  (`bars` + `playBars`), core's **`unfoldDoc`** expands it, `buildTimeline` runs on that — the audio side still
  gets a plain flat document. ⚠ **Never make the app expand again** to "fix" something downstream; unfold at
  that point instead. ⚠ **`buildTimeline` must never be given the WRITTEN doc** when a structure exists — it
  would play the repeat once with the cursor still right, the silent version of this bug. ⚠ The playhead follows
  a **play plan** (`PlayStep[]`: one step per sounding event, naming the WRITTEN note drawn for it) and SheetView
  indexes drawn positions **by event index**; breaking that link desynchronises picture from sound silently.
  ⭐ **THE FIRST 𝄋 MARKS A SECTION; EVERY LATER 𝄋 PLAYS IT AGAIN AND COMES BACK** (owner, 2026-08-30) — a saz
  semâîsi writes its **teslim once** and plays it after every **hâne**, so the first sign is a place-marker and
  each later one is a jump that **returns**; the last has nothing after it, so the piece ends at "Son".
  `expandSegnoJumps` owns it, and it needs no "D.C." (249 of the 258 multi-𝄋 pages have none). ⚠ **Where the
  section ends must come from the page**: a "Son", else the first `:‖` after the 𝄋 (plus a first ending's "2."
  bar); with neither, **nothing happens and a warning is written** — guessing an end replays arbitrary music,
  playing straight through is only incomplete. ⚠ The section is replayed **with its own repeat, every time**
  (owner's choice over the Western D.S. convention), by running the SAME `expandRepeats` over its bars. ⚠ **A
  jump fires at the END of its bar** whichever edge the glyph was read on, and a 𝄋 lands on the bar it is DRAWN
  on (`segnoAt`) — it used to be filed onto the previous bar, on 433 pages. ⚠ **A FIRST ENDING IS A RUN, NOT ONE
  BAR**: from the "1." to the `:‖`, skipped whole, capped at `MAX_FIRST_ENDING = 4` bars because a far "1." is a
  stray token and obeying one would delete real music. Resolved **once**, in `expandRepeats` →
  `ScoreStructure.firstEndings`; the drawn "1." reads that answer or the ink and the music drift apart (they did
  — 37.9% of real first endings). ⚠ **DECODED PAGES ONLY** — a SymbTr sample is flat in the data, so folding one
  means guessing from duplicate bars; `Tekrarlar` still only DRAWS there and the renderer path
  (`?repseed=`/`?navseed=`) is untouched, so the training corpus is byte-identical. ⚠ `Tekrarları açık yaz` is
  **view-only and closes edit mode**. Safety claim: `npm run check:fold` — unfolding reproduces the old
  flattened document over **1,720 pages, 0 changed**.
  ⭐ **THE SIGNS ARE EDITABLE SINCE 2026-09-03** (owner): arm one in the toolbox and click a bar; click a drawn sign in Seçim to delete it. ⚠ **`resolveStructure` in `stitch.ts` is the ONLY thing that says what a sign does** — the marks were split out of `MeasureRec` as `StructureMarks` so a hand edit runs the decoder's own `expandRepeats`/`expandSegnoJumps`/`expandDaCapo`; never write a second rulebook in the editor. ⚠ **A placement is refused by SIMULATION**: resolve it, reject it if it added a warning the page did not have, so a sign that would draw but not sound cannot be placed. ⭐ **THE REPEAT IS ONE TOOL AND TWO CLICKS, ON THE BARLINES** (owner, same day, revising a first version that had a `‖:` tool and a `:‖` tool): arm **Tekrar**, click the opening line, then the closing one, and `placeRepeat` writes both marks at once — the first click writes NOTHING, so the document can never hold half a repeat. Never split it back into two tools: an unmatched `‖:` is a sign `repeatSpansFromStructure` refuses to DRAW, so that click left no trace on the page. ⚠ The `WARN_UNMATCHED_REPSTART` exemption and its dashed overlay marker stay anyway — a DECODE can still read a stray `‖:`, and edit mode must show it to let it be deleted. ⚠ **Armed places, Seçim removes**, and a delete takes its whole object from EITHER end (the `‖:` or the `:‖` takes both plus the brackets). ⚠ Signs share the undo stack with the notes (`useDocHistory`'s `ScoreState`). `tools/render/structure-edit.ts` · `structure-edit-test.ts` · `smoke:editor`. [docs/DECISIONS.md](docs/DECISIONS.md) ·
  [docs/METRICS.md](docs/METRICS.md).
- **No Western rehearsal data** in fine-tuning (owner decision 2026-07-03). Coverage comes from
  self-rendered Turkish strips.
- **There IS a backend now, for decode only** (owner decision 2026-08-05, reversing "no backend,
  ever"): the browser slices and POSTs crops, a **Cloud Run** CPU server runs the model. Reason:
  protect the user's machine — a page burns ~19 s of multi-threaded CPU on the client. Plan:
  [docs/mvp/deploy.md](docs/mvp/deploy.md). **Everything else stays local** — audio, the editor, and
  the W4–W6 slicer port. **Do not delete the in-browser decode path**: `gate:browser`,
  `parity:armb`, `parity:arma`, `smoke:page` and the W3 browser-vs-gold result all rest on it, and
  it is the ONLY path in a build with no `VITE_DECODE_URL`.
  ⛔ **BUT IT IS NO LONGER A FALLBACK: NOTHING IS READ ON THE VISITOR'S MACHINE WHERE A SERVER IS
  CONFIGURED** (owner, 2026-09-04) — a dead or cold container raises `server-unavailable` instead,
  because the fallback's real cost is the **211 MB of graphs** it pulls, worst of all on mobile data.
  ⚠ One function decides (`localDecodeAllowed()`), opt-in via `localStorage.omrAllowLocalDecode` /
  `VITE_ALLOW_LOCAL_DECODE`, set by **no deploy**; `smoke:build` (opting in for its local arm) and
  `smoke:live` gained **refusal arms** asserting that no `data-where` appears, and `smoke:page` on a
  dead URL exercises nothing. ⚠ The Hub stays load-bearing (`model.json`, every path). ⚠ **Two timings
  the fallback used to absorb are now user-visible**, both raised 2026-09-04: `--max-instances` 3 →
  **10** (at concurrency 1 an over-capacity request QUEUES, erroring only past the client's 180 s) and
  `WARMUP_WAIT_MS` 40 s → **120 s**, after a cold start read **38.2 s**. [docs/DECISIONS.md](docs/DECISIONS.md).

- **The server is Node + `onnxruntime-node` importing `apps/web/src/omr/decode.ts`** — the browser's
  own module, so there is ONE decode implementation, not a third to hold in parity. Do not write a
  second decoder in any language. **Built AND DEPLOYED 2026-08-06** — live on Cloud Run (europe-west3, 1 vCPU); URL and numbers in [docs/STATUS.md](docs/STATUS.md). Two
  rules follow from how it was made to work: `decode.ts` may **not** import an ORT runtime (types
  come from `onnxruntime-common`, the `Tensor` constructor rides on `Sessions`), and **the client
  preprocesses** — the server receives finished 409×583 PNGs and applies only the rescale, so there
  is no second resampler to hold in parity either.

- **The deploy checks read DOM state, never the words on the page** (2026-08-07, the style pass).
  `apps/web/src/ui/status.ts` is the single producer of the contract — `#omr-status` carries `data-state`, `data-kind`, `data-where` and the counts; `#omr-error` carries `data-error-kind`; `#play` carries `data-play-state`; `#app` carries `data-ready`. The sheet adds `#follow-playhead[data-follow]` **and** `#sheet-surface[data-follow]` (the follow setting on the control AND on the thing that moves — a checked box only proves it was clicked).
  The editor adds `#edit-toggle[data-edit-mode]`, `#sheet-surface[data-edit-mode]` + `[data-selected-note]`, `[data-omr-note]` / `[data-selected]` per note, `#note-delete` / `#undo` / `#redo`, and the palette's `#edit-palette[data-armed]` + `[data-tool]` per tool, its transport `#edit-palette[data-play-from]` + `#palette-play[data-play-state]` / `#palette-stop`, its
  toolbox shell `#edit-palette[data-collapsed]` + `#palette-fold[data-collapsed]` (⚠ **a FLOATING, draggable, foldable toolbox since 2026-09-03** — `fixed`, rendered from `App` OUTSIDE
  `.kv-card`, taking no width from the score row; folding UNMOUNTS every tool, so unfold before arming one), the
  insert preview `[data-omr="insert-ghost"][data-insert-pitch]`, the tuplet tool's
  `#sheet-surface[data-tuplet-anchor]` + `[data-tuplet="start|member|anchor|end|blocked"]` per note,
  the SIGN tools `[data-tool="sign:repStart|repEnd|volta|segno|coda|dc|fine"]`, their delete targets `[data-omr="sign-hit"][data-bar][data-sign]`, the unfinished `‖:` `[data-omr="open-repeat"][data-bar]` and a refusal's `.kv-toolbox__hint[data-refused]`,
  the drawn mark's own target `[data-omr="tuplet-mark-hit"][data-tuplet-group][data-tuplet-mark="closed|broken"]`
  (⚠ **the SIGN selects a tuplet; its notes are `pointer-events: none`** — owner, 2026-08-30), a HELD
  mark's `#sheet-surface[data-tuplet-selected]` + `[data-tuplet-held]` per member +
  `[data-tuplet-landing="start|end|both"]` (plus `[data-tuplet-fix]` where the move would COMPLETE a
  broken mark) + `[data-omr="tuplet-handle"][data-edge]` + `[data-omr="tuplet-frame"]` + `#tuplet-remove`,
  and the off-meter mark `[data-omr="bar-warning"]` + `[data-bar]` + `[data-bar-fill="over|under"]`
  (⚠ **`data-edit-mode` is on FOUR elements — see the measure card below — and `data-play-state` on TWO** — `#play` and `#palette-play`; select the one you mean by id). The stored-page list adds `#recent[data-omr="recent"][data-count][data-open][data-current]` with one `[data-omr="recent-item"][data-page-id]` per row (`[data-omr="recent-open"]` / `"recent-remove"` inside), plus `#recent-toggle`, `#recent-clear`, the row's `[data-omr="recent-rename"]`, the heading's `#score-rename` + `[data-omr="score-name"]`, and the shared box `[data-omr="rename-input"][data-page-id]` — ⚠ **`data-count` is the load-bearing one**, it is the only proof a page was stored, `#recent` renders NOTHING when the store is empty so its absence is an assertion too, and **`data-page-name` / `data-page-makam` are what a rename and the makam are asserted on**: a page name is user DATA, not copy, so an attribute is the standing rule there rather than an exception to it. The instrument picker adds `#instrument[data-instrument][data-voice-state]` **plus `data-voice-sounding`** — ⚠ **the last one is the only proof of the 2026-09-04 bridge**: a voice switch made while a piece plays keeps the OLD recording sounding until the new one downloads, and from the DOM that is the same notes, the same playhead and the same picker, so `data-voice-sounding` disagreeing with `data-instrument` IS the evidence (the same blind spot `sampled`/`synth` exists for). Its toast is `#voice-notice[data-omr="voice-switch"][data-voice-to][data-voice-sounding][data-voice-state][data-voice-loaded][data-voice-total]` — ⚠ rendered from `App`, `position: fixed`, **click-through except its ✕**, and deliberately NOT inside `#omr-status`, because its counter ticks. The makam picker adds `[data-omr="makam-intonation"][data-makam][data-rules][data-notes]` plus one `[data-omr="makam-rule"][data-letter][data-alter][data-delta][data-notes]` per bent perde — ⚠ **`data-notes` is only worth anything RE-DERIVED**: it counts this score's matching notes, so a check that reads it back off the element proves nothing, and `smoke:editor` counts them off `window.__omrDoc` instead. ⚠ It renders NOTHING with no makam chosen, so its absence is an assertion too, and a rule matching no note reads **0** rather than vanishing. The transport adds `#bpm` and `#transport-pinned` — ⚠ **the ÇALMA row is pinned to the TOP of the page since 2026-09-05 (`position: sticky`) and the other two rows are not**, which takes TWO measurements to assert: `#transport-pinned`'s box sits at `top ≈ 0` after a scroll to the bottom, AND `#transport-pinned + .kv-transport` (Ritim + Perde) is gone off the top — a whole bar made sticky passes the first and fails the second. ⚠ There is ONE Çal button again: it replaced a corner-parked second pair (`#sticky-transport` / `#play-sticky` / `#stop-sticky`), which is DELETED, so a check presses `#play` itself from wherever it has scrolled to. The fingerboard tab (F3) adds `#fingerboard[data-omr="fingerboard"][data-tuning][data-strings][data-lines][data-zoom]`,
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
  because the fill is what carries `data-mandal-state`. ⚠ Its arithmetic is `tools/core/kanun-test.ts`. **The bar beside the instrument (2026-09-04) adds** `#measure-card[data-omr="measure-card"][data-measure][data-total][data-notes][data-follow][data-edit-mode]`, its own `#measure-surface` + `[data-omr="measure-svg"]`, and `#measure-prev` / `#measure-next` / `#measure-play` / `#measure-edit` / `#measure-follow`. ⚠ **`data-follow` is the load-bearing one** — a pinned card and a following card are otherwise the same DOM. ⚠ **`Ölçüyü çal` is asserted by TIME**, stopped again in seconds on a two-minute piece, because only the cut timeline makes that true. ⚠ **The card has NO editing markers of its own**: it mounts `SheetView`, so its notes, ✕, ghost, handles and playhead are the page's own `[data-omr-note]` / `#note-delete` / `[data-omr="playhead"]` — an edit made there is asserted on **`window.__omrDoc`** and then on the Nota page, because a card with its own overlay could pass "a note is selected" and still be a second document. ⚠ **`data-edit-mode` is on FOUR elements** (`#edit-toggle`, `#sheet-surface`, `#measure-surface`, `#measure-card`): name the one you mean. The playhead carries `[data-omr="playhead"]`, because an attribute naming a bar cannot
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
  the app to **NonCommercial forever**, and two were compositions still in copyright under FSEK 5846.
  So `SAMPLES` in `App.tsx` is **empty**, there is no Sample dropdown, and the app opens on the upload
  prompt. The files stay on disk **gitignored** because `npm test`, `smoke:editor` and the manual
  checks read them through **`?score=…`** — local use is not distribution, a `SAMPLES` entry is. ⚠ The enforcement is `prune-dist.mjs`, which **fails
  the build on any `.json` at the dist root**: everything under `public/` is served to whoever
  guesses the name, so "no UI links to it" proves nothing. An own-work score would go in a
  subdirectory. ⚠ **AUDIO IS THE ONE THING THAT MAY SHIP FROM `public/`** (2026-08-11): F2's two CC0
  drum kits, 660 KB, under `public/audio/`. `prune-dist.mjs` fails the build on any audio file
  outside `audio/` or over **1 MB total** — a **permanent guard on the drums**, a decision point and
  not a dial. Provenance per file is in `apps/web/src/audio/strokeKits.ts` and `/THIRD-PARTY.txt`;
  the wavs are **generated** by `scripts/prepare_strokes.py` — never hand-edit one.
  ⚠ **THE INSTRUMENT VOICES DO NOT SHIP AND THE DRUMS DO** (owner, 2026-08-12). F1's clarinet and
  violin are 20–35 MB each, live in a Hugging Face **dataset** repo, and are fetched from
  **`VITE_VOICES_URL`** — a *separate* variable from the drums' `VITE_AUDIO_URL`, which must stay
  **unset in every deploy**: `VITE_AUDIO_URL` is one base for the whole `audio/` tree, so pointing it
  at the voices repo takes the drum kits with it, 404s them, and drops percussion back to the
  synthesised strokes the owner rejected by ear — silently, because the fallback still makes a sound.
  Voice files are never committed, trimmed or re-encoded; `scripts/prepare_voices.py` copies them and
  checks sha256, and every number in `apps/web/src/audio/instruments.ts` is emitted by that script —
  **never read a pitch off a filename**, VSCO's clarinet labels are an octave low.
  ⚠ Consequence for browser checks: **`data-ready` never appears on a bare visit** —
  it means "a score is installed" and none is. Ask for `?score=` if you need one; wait on
  `#page-input` if you are uploading your own. ⚠ The footer (`#legal`) claims uploads are not stored — true only while `apps/server/src/index.ts` writes no image to disk; change both together. Full map: [docs/THIRD-PARTY.md](docs/THIRD-PARTY.md).
- **THE APP REMEMBERS THE PAGES IT HAS READ, AND IT STORES NOTES AND NEVER AN IMAGE** (owner, 2026-09-05). A decoded page and every later edit go to the reader's own **IndexedDB** (`apps/web/src/recentPages.ts`); **30 pages**, least recently opened dropped. ⛔ **No image, ever** — the footer's `privacy` line above has nothing to qualify only because of that choice: put one in this store and read that line again. ⚠ **IndexedDB, not `localStorage`, and size is not why** — the edited state is written on every edit (debounced 2 s) and `localStorage` is SYNCHRONOUS, so a ~100 KB write blocks the main thread mid-drag; its ~5 MB is also one budget shared with the three settings already kept there. ⚠ **ONE save path and no explicit save call** — a decode opens a record (`saved` in `App.tsx`), an effect writes the document back two seconds later; never add a second, and never write from a load path.
  ⚠ **ONLY A DECODE OPENS A RECORD**: `?score=`, a sample and a hand-loaded JSON all clear it, which is what keeps every check's own fixture out of a reader's list — and why **`smoke:app` is the only check that can see this feature at all**. ⚠ **Every store function swallows and returns a safe value**: storage does not merely come back empty in a private window, it THROWS, and a browser that cannot remember pages must still read them. ⚠ **`Date.now()` alone is not a clock** — two records written in the same millisecond sort by IndexedDB key order and eviction then drops the wrong page (measured); `stamp()` forces it to move. ⛔ It is a **cache, not a save**, and `TR.recent.note` says so on screen — never write copy or a doc line that promises otherwise. ⭐ **A PAGE IS RENAMEABLE, AND THE RENAME NEVER TOUCHES THE DOCUMENT** (owner, 2026-09-05): `doc.name` seeds the per-piece hash that picks a tuplet's bracket-or-arc, so renaming through the score would silently re-engrave its triplets — the record carries the label, the card's heading reads that label (`pageName`), and a score that is not a stored page gets no pencil at all. ⚠ **A rename must move `saved` too**, or the save effect writes the old name back two seconds after the next keystroke. ⚠ **The makam is a field beside the name, never inside it** (owner: *"makamı da isme dahil olsun"*) — re-read from the score on every save, so it survives a rename and follows a later makam change; in the name string it would go stale three ways. ⚠ **`.kv-recent__item` needs `min-width: 0`**: a grid item's `min-width` is `auto`, and without it the row pushed a 390 px phone to 623 px with no ellipsis — and `smoke:phone` cannot see it, because that probe loads `?score=` and never draws this list. [docs/features/recent-pages.md](docs/features/recent-pages.md).
- **THE PHONE IS FIXED IN CSS ONLY, IN TWO MEDIA QUERIES AT THE END OF `app.css`** (owner, 2026-09-04;
  there was no width-based media query at all before it). ⚠ **They answer different questions, never
  merge them**: `(pointer: coarse)` owns sizes — **16px on every form field**, the threshold under
  which iOS Safari zooms the page in on focus and never back, plus `--control-h: 44px`; `(max-width:
  700px)` owns layout (measured: the transpose group cannot shrink below 433px). ⚠ **At the END so
  ORDER wins**; the only `!important` is the docked toolbox's insets, which beat an inline style. ⚠
  **That placement is what keeps every existing check valid** — they run at 1280×720 with a mouse. ⚠
  **No exemption from the `.kv-score` rule below**, "only on small screens" included. ⚠ Height caps
  use `dvh`. Look with **`npm run smoke:phone`**, and ⛔ **never give that probe `fullPage: true`** —
  it resizes the viewport without restoring touch emulation, so fixed things report as broken.
  [docs/DECISIONS.md](docs/DECISIONS.md).
- **The score's SVG is also the training-strip source, so CSS must not reach it.** No selector under
  `.kv-score` may set a font, and no `transform`/`zoom`/`scale` may touch that container —
  `tools/render/render.ts` screenshots the VexFlow SVG by rect to cut strips, and rects do not
  survive a transform. The design system is `apps/web/src/styles/` (`tokens.css` → `base.css` →
  `app.css`); classes are `.kv-*`. ⭐ **THE MEASURE CARD IS THIS SAME `SheetView`, MOUNTED A SECOND TIME WITH `onlyMeasure`** (owner, 2026-09-05: *"ikisi ayrı olmasın"*) — same component, same document, same callbacks, same undo stack, so the instrument tab edits its bar with the page's own editor and not a copy. ⚠ **`onlyMeasure` FILTERS the drawn bars and never renumbers them**: `repeatSpans` / `navMarks` / `signTargets` / `openRepeat` / `repeatAnchor` / the insert's `measureIndex` all stay bar-indexed and go in untouched — never hand it a one-bar document instead, that trades one filter for six mappings that must agree. ⚠ **Nothing scales**: the card resizes the ENGRAVING to its column (`contentWidth` + `justify`), which is what keeps the edit overlay 1:1 with the notes, so one hit-testing implementation serves both mountings. ⚠ It takes its own `surfaceId` / `svgMarker`; `#sheet-surface` and `sheet-svg` must keep meaning THE PAGE'S score, since `render.ts` and `verify-labels.ts` take the first match. ⚠ Every one of the six props defaults to the page's behaviour — a caller that passes none gets byte-identical output. [docs/features/measure-card.md](docs/features/measure-card.md). ⚠ **`.kv-score` keeps `overflow-y: clip`, load-bearing** (owner, 2026-09-03: ONE scrollbar, not two) — `overflow-x` alone computes the other axis to `auto`, and Bravura's font metrics gave the box 17 px of phantom height. ⚠ Consequence, and the follow below depends on it: the sheet scrolls SIDEWAYS in its own box, and up and down **not at all** — the page is the only vertical scroller. [docs/DECISIONS.md](docs/DECISIONS.md).
- **THE PAGE GOES TO THE PLAYHEAD ONCE PER ROW, AND ONLY WHEN THE ROW IS OFF THE SCREEN** (owner, 2026-09-03). `followPlayhead` scrolls the page to the cursor while a piece plays — **the reader's setting, ON by default**, remembered in `localStorage` behind try/catch, `?follow=0|1` overrides without being written back. ⚠ **Two axes, two scrollers**: down the PAGE (`window`) and sideways in the sheet's own box (found by MEASUREMENT in `sideScrollerOf` — and the box that reports hidden width is not always the box that scrolls, so its computed `overflow-x` is part of the test; the sheet's own wrapper overflows with `overflow: visible` and killed this axis until the check caught it).
  ⚠ **THE TRIGGER IS THE ROW CHANGING, NOT THE CLOCK** (owner's revision, same day: *"sadece row değiştiğinde tetiklensin"*) — inside a row the page never moves, so nothing shifts under a pointer mid-bar and a reader who scrolls away is left alone until the music turns the corner; the row's `top` is remembered in a ref and reset on every fresh playback, so Çal follows its own first row. It also removes the timer and the cooldown a per-frame check needed. ⚠ Consequence: the sideways axis fires only at a row change too. ⚠ `FOLLOW_SIDE_MIN` stops the sideways axis firing on a box that only overruns by its own padding (~2 px on a wide window), which would twitch the music mid-playback for nothing. ⚠ **It moves the page, so a check that measures a point and then clicks it must own the scroll**: `smoke:editor`'s B4 insert-mapping read turns following OFF for that block.
  ⚠ It obeys `prefers-reduced-motion`; the rAF loop reads the cursor's box AFTER writing its transform and touches only refs. `smoke:editor` covers both axes, both settings and a reload — the OFF arm is the load-bearing one, since a follow that ignored the setting passes every ON assertion. [docs/DECISIONS.md](docs/DECISIONS.md).
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
- **NOTHING under `src/vision/` ever becomes shippable** — the Python-decode-service question was
  closed 2026-08-05 by the Node stack above.
- **The makam bends the SOUND ONLY** (owner decision 2026-08-06, shipped 2026-08-07). Selecting a makam adds comma deltas to the sounding koma on the way into `buildTimeline` — the engraving, `Save JSON` and `buildStrips` never move, and no key signature is redrawn. The table carries **documented deviations only**; `none` is the default. Table, sources and the signature+karar guess: [docs/mvp/makam.md](docs/mvp/makam.md).
  ⛔ **THE DELTAS ARE KEYED BY THE WRITTEN DOCUMENT AND `unfoldDoc` RENUMBERS — RE-KEY THEM WITH `remapKomaDeltas` OR THE BEND LANDS ON THE WRONG NOTE** (fixed 2026-09-05, shipped broken since the unfold landed on 2026-08-30). Nothing throws, because every index still exists: the page simply plays out of tune, which is how it was found — by ear, not by a check (owner: *"bazen la farklı çalıyor, bazen re, bazen mi… ama bazen de doğru"*). ⚠ **It is not only a repeat that moves them**: the unfolder drops `meta` events, so an ordinary page with no repeat at all is already misaligned — `gamzedeyim-deva` under uşşak bent **19 wrong notes out of 22**. ⚠ **Re-key; do NOT bend before unfolding** — `perf.doc` is the instrument views' document and the kanun looks a course up by an exact WRITTEN koma, which a fractional one misses. `tools/core/makam-test.ts` pins both halves.
  ⭐ **AND THE PICKER NOW SAYS WHAT IT BENDS** (owner, 2026-09-05): beside the dropdown, the WRITTEN perde, the shift in commas, and **how many notes of THIS score** the rule reaches. ⚠ **That count is derived from the document by the same matcher the deltas use** (`makamRuleUsage` / `eachRuleMatch`) — a hint quoting a constant passes every attribute check and is still a lie, so `smoke:editor` re-derives it from `window.__omrDoc`. ⚠ **A rule matching nothing shows 0.** ⚠ **A makam that bends nothing gets ONE sentence** (owner, 2026-09-05, cutting a first version that wrote two): hüseyni's `[]` is a finding and an unlisted makam is silence, but that difference belongs to `MAKAM_INTONATION` and the doc — the bar answers the one question a reader is asking, whether the piece will sound as it looks. ⛔ The empty arrays still must not be deleted as clutter; they are what stops someone completing the table by symmetry. ⚠ The prompt renders the SAME component — never write a second one.
  Two deliberate duplications live here and are both pinned by `npm test`: core's `SIG_TOKEN_BY_ALTER` mirrors `AEU_TOKEN` in `tools/render/lilypond.ts`, and `packages/core/src/makamSignatures.ts` is **GENERATED** from `data/makam_signatures.json` — never hand-edit it, and re-emit with `--from-json` so refreshing the TS copy cannot rewrite the JSON from whatever pools are on the machine.
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
data/synthetic/       rendered strips — ROUND 3 TRAINED ON strips_v7_final (3 flags, 0 \tie) and ROUND 4 REUSES IT UNCHANGED (no render, owner 2026-09-03); older sets kept
data/checkpoints/     round2-stage2-best (+ -onnx int8, THE LIVE RUNTIME — round1-best is the
                      superseded one), the r3-* Round-3 arms, and rung3-labeler: a July tooling
                      checkpoint, NEVER shipped, that only feeds the emitter and decode_page.py
data/split.json       piece-level train/val split (strips_v4 uses data/split_v4.json, v3 split_v3)
                      — ALWAYS split by piece, never by strip: strips of one piece are near-duplicates
```
