# Doc index — which file answers which question

purpose: route a reader to the one file that owns an answer, and say how to update the docs after a session
audience: everyone; start here if `CLAUDE.md` did not already answer it
updated: 2026-11-20

**Rule of the house:** every fact has ONE home. If two files state the same number, one of them is
wrong — fix by deleting, not by syncing.

The docs were consolidated on 2026-11-20 from 121 files to 43: topics that had been split only to
stay under the old 400-line cap were merged, and every closed phase and round was squashed into
two history files. Each merged file opens with a list of what it absorbed and where each part used
to live, so an old path can still be traced.

## Live docs

| File | What it answers |
|---|---|
| [../CLAUDE.md](../CLAUDE.md) | What is this project, how do I run it, what may I never do? |
| [STATUS.md](STATUS.md) | What ships today, and what is the next action? — the ONLY file that says so |
| [COMMANDS.md](COMMANDS.md) | Every command and its silent-failure traps: the app, the Python tools (slicer, emitter, queues, scorers, `OMR_*` knobs), training on Colab |
| [APP-RULES.md](APP-RULES.md) | The rules for touching the web app (playback, editor, DOM, stylesheet), and the DOM contract — what a browser check may assert on |
| [DECISIONS.md](DECISIONS.md) | Why we do X this way; what was overturned |
| [BACKLOG.md](BACKLOG.md) | Owed work that is not next (near-term, then deferred), and the standing risks and non-claims |
| [THIRD-PARTY.md](THIRD-PARTY.md) | What we may publish: every licence, the audio licence policy, the per-file audio sources |
| [CODE_TOUR.md](CODE_TOUR.md) | Where the code lives and the reading order; the page → strips → decode → stitch pipeline design |
| [MANUAL_CHECKS.md](MANUAL_CHECKS.md) | See it with your own eyes: the app, the editor, the render/corpus side |
| [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) | The checks that need ears or eyes: usul strokes, voices, the instrument views |
| [../ROADMAP.md](../ROADMAP.md) | Long-range plan and architecture (evergreen, no status) |

## Numbers — `METRICS*`

| File | What it measures |
|---|---|
| [METRICS.md](METRICS.md) | The headline table; live-app usage; the owner's 20-page hand test; the shipped int8/ONNX model's drift; the b8 re-emit |
| [METRICS-EXAM.md](METRICS-EXAM.md) | Every exam score by round; what the exam is made of; Round 3's follow-up runs A/B; Round 4's vocabulary A/B |
| [METRICS-CORPUS.md](METRICS-CORPUS.md) | Corpus sizes, pool make-up, label noise; what the model-voted key signature changed |
| [METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md) | Why the model fails and what was tried; label-vs-model error attribution; koma/küçük sharps; tuplets |
| [METRICS-INPUT.md](METRICS-INPUT.md) | What the model is shown: the 409×583 box and the geometry pilot; symbols the renderer never drew (staccato, dotted usul barline); the LilyPond engraver |
| [METRICS-SLICER.md](METRICS-SLICER.md) | Page → ink mask (binarization, opencv.js parity); crop roots and re-slice cost; the TypeScript port vs the Python |
| [METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md) | Finding staffs (fixes, the row rescue, rejected knobs); barline gates and hand-marked truth; the stem-vs-barline gate |
| [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) | The label budget and its rail; the windowing retune and crop frame; the opt-in `?dense=` experiment |
| [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md) | The raw log of every training run, gate and export |

## Tracks

| File | What it covers |
|---|---|
| [app/README.md](app/README.md) | The shipped app's settled facts; the makam intonation table and how a page's makam is guessed |
| [app/server.md](app/server.md) | The decode server: the hosting plan, running/redeploying/reverting it (every hop of a model swap), latency options |
| [app/editor.md](app/editor.md) | The editor: the armed-tool palette brief, and what each build step found |
| [features/README.md](features/README.md) | The feature track (voices, usul, instrument views); stored pages (F5); the visit counter (F6) |
| [features/instruments.md](features/instruments.md) | The violin fingerboard, the sol klarnet view, the single-measure card |
| [features/kanun.md](features/kanun.md) | The kanun view and mandal state machine, how its voice was cut, the owner's real-instrument mandal count |
| [features/phone.md](features/phone.md) | The phone screen and every number behind it; the look (palette, dark mode, CSS layers, render pin) |
| [features/play-store.md](features/play-store.md) | The Android build, signing, release; closed-test feedback |
| [mobile/README.md](mobile/README.md) | The React Native app: plan, reuse map, milestones, open questions |
| [rung3/README.md](rung3/README.md) | The real-page (model) track: plan, settled findings, exam rules and audits |
| [rung3/labeling.md](rung3/labeling.md) | Label rules (token vs ink); how the corpus was collected and matched to SymbTr; every review queue incl. real-val |
| [rung3/round4.md](rung3/round4.md) | Round 4: targets, evidence, the owner's decisions, the order of work; the third-engraver probe |
| [rung3/tokenization.md](rung3/tokenization.md) | How a label is spelled, and what scheme H bought |
| [../tools/render/README.md](../tools/render/README.md) | The synthetic renderer and each corpus version |

## History — do not act on it

| File | What it holds |
|---|---|
| [log/status-log.md](log/status-log.md) | Dated entry for every session, newest first |
| [log/superseded.md](log/superseded.md) | Plans abandoned or reversed, with the reasoning — so they are not proposed again |
| [archive/phases.md](archive/phases.md) | Phases 0–2, the MVP rungs W0–W10, the slicer-port plan, closed backlog and risks, the finished cloud/hosting setup walkthroughs |
| [archive/rounds.md](archive/rounds.md) | Rounds 1–3: criteria, A/B runs, exam results, re-render, levers, tuplet mark, parked follow-ups |
| [log/raw.md](log/raw.md) | Verbatim training consoles and the owner's labelling notes |

## Maintaining these docs

**This is the section to open when the owner says "sync the docs"** (or "update the docs", or you
finished work and need to write it down). Follow the table below rather than guessing.

Two rules cover 90% of it:

1. **Write the fact once, in the file that owns it.** Everything else links.
2. **Never append to a live file.** Live files (STATUS) get *rewritten*; history goes to `log/`.

Run `.venv-ml/bin/python scripts/check_docs.py` when you are done. It catches the mechanical
mistakes so review can be about content.

### I just did X — what do I update?

| What you did | Update | Do NOT touch |
|---|---|---|
| Anything at all, at end of session | [STATUS.md](STATUS.md) — rewrite "Now" and "Next" | ROADMAP, README |
| Deployed, or staged a new model | STATUS + the `updated:` header of every doc whose "deployed / not deployed" line just changed — and for a model, `CACHE_NAME` in `apps/web/src/omr/session.ts` ([app/server.md](app/server.md#running-and-deploying-the-decode-server--the-commands)) | — |
| Measured something (accuracy, yield, corpus size) | the matching `METRICS*.md` (table above) + the raw log in [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md) | any other file quoting numbers |
| Finished a chunk of work | one dated entry at the TOP of [log/status-log.md](log/status-log.md) | — |
| Decided something, or reversed a decision | [DECISIONS.md](DECISIONS.md) row (mark the old one OVERTURNED/SUPERSEDED, don't delete it) | — |
| Cancelled or abandoned a plan | move its reasoning to [log/superseded.md](log/superseded.md) | leaving it in a live file "for context" |
| Work inside the real-page track | the matching `rung3/*.md` file | STATUS (keep it a summary) |
| Started a genuinely new track | new `docs/<track>/README.md` + index row + a STATUS line | cramming it into rung3/ |
| Added/changed a script or module | [CODE_TOUR.md](CODE_TOUR.md) row | — |
| Changed a command, a hard rule, or where data lives | [../CLAUDE.md](../CLAUDE.md) | — |
| A track or a round finished | move its sections to the END of [archive/phases.md](archive/phases.md) (product/infra) or [archive/rounds.md](archive/rounds.md) (a training round), add it to that file's list at the top | leaving "⏭ next" lines in a live file; creating a new archive file |
| Kept a raw training console or a labelling note verbatim | a new `##` section in [log/raw.md](log/raw.md) | the repo root |
| Moved a section to another doc | fix its links and the code comments citing it (`check_docs.py` finds them) | — |

### End-of-session checklist

1. **STATUS.md** — is "Now" still true, and is "Next" the thing you'd actually do tomorrow?
   Anything that is no longer *next* moves out (to `log/status-log.md` or a track file).
2. **A number changed?** The matching METRICS file, and only that file (plus its raw log).
3. **A decision changed?** DECISIONS.md, with the date and what overturned it.
4. **Write the log entry** while you still remember *why*, not just *what*. The "why" is the part
   that is expensive to reconstruct six weeks later.
5. `.venv-ml/bin/python scripts/check_docs.py` → fix anything it reports.
6. Commit docs separately from code when you can; it keeps both diffs readable.

### The rules, and why they exist

- **One fact, one home.** Before the 2026-07-26 refactor the same numbers lived in 4–7 files, and
  the pointer docs sat **18 days stale** — nobody can hand-sync seven copies. If two files disagree,
  the fix is to *delete* one, not to sync them.
- **Live vs log.** A file that mixes "what we will do" with "what we did" eventually reads as
  instructions to do things that were abandoned. That is the single most expensive failure mode
  here: an agent acting on a superseded plan. Live = STATUS + track files; log = `log/` + `archive/`.
- **Superseded plans keep their reasoning.** Delete the plan, keep the argument — otherwise the same
  cancelled experiment gets proposed again next month.
- **Fewer files, ≤1,000 lines each (owner, 2026-11-20).** The old 400-line cap split one topic
  across up to nine files (121 in all). Grow a file by topic; only when it crosses 1,000 lines, split
  it by *genre or phase* (plan / results / postmortem), never just by size. Do not create a new file
  for something an existing file's topic covers.
- **No wall-of-text paragraphs.** ROADMAP's status footer became a single 16,000-character
  paragraph: impossible to skim, to grep to a section, or to edit safely. Use dated headings and
  bullets so a reader can jump.
- **Every doc says what it is.** The `purpose:` / `audience:` / `updated:` header means nobody has
  to read a file to find out whether it is live, historical, or dead.
- **Code comments cite exact doc paths.** They are checked, so a doc move can't quietly orphan them.

### Writing style

- Say the finding first, then the evidence. "Resolution was ruled out — recall doesn't fall with
  scale" beats three paragraphs building to it.
- Keep the **negative results and the caveats** — "this looked like the answer and wasn't" is often
  the most valuable line in a log entry, and it prevents a repeat.
- Mark uncertainty explicitly (non-claims, low-n, "estimate"). A number without its caveat gets
  quoted later as if it were solid — that already happened once with a 3-gold class swinging a
  headline ~11pp.
- ⛔ **There is no plain-English doc set any more.** The `OVERVIEW*.md` files restated numbers on
  purpose and went stale faster than anything else; the owner deleted them on 2026-10-08. Plain
  English belongs in the REPLY to the owner ([../CLAUDE.md](../CLAUDE.md)), not in a second copy.

### What the checker enforces

`scripts/check_docs.py`:

| Check | Fails when |
|---|---|
| header block | a doc lacks `purpose:` / `audience:` / `updated:` |
| size cap | a doc exceeds 1,000 lines (history files are allow-listed in `LONG_OK`) |
| paragraphs | a prose paragraph exceeds 2,500 characters |
| links | a relative markdown link doesn't resolve |
| code refs | source code cites a doc path that doesn't exist |
| orphans | a doc isn't reachable from INDEX.md, CLAUDE.md, or a track index |

⚠ **There was a 7th check, `--facts`, and it is GONE (owner, 2026-09-06).** It needed a baseline
copy of the docs to diff against, and the owner deleted that baseline. **Do not re-add the flag
without re-creating one**: a fact check with nothing to compare against passes silently. For a big
edit, do the diff by hand — extract the identifiers before and after and `comm` the two sets.

### Adding a new track

1. `docs/<track>/README.md` — the one-paragraph plan, a state table, and the file map.
2. Keep it in that one file until it nears 1,000 lines; then split by phase (`plan.md`, `results.md`).
3. Add a row to the Tracks table above and, if it becomes the live work, to [../CLAUDE.md](../CLAUDE.md).
4. Point STATUS.md at it. STATUS summarises; the track file carries the detail.
