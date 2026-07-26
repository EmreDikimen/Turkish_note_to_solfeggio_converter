# Maintaining these docs

purpose: how to update the docs after a work session, so the structure survives contact with real work
audience: whoever (human or agent) just finished a piece of work and has something to write down
updated: 2026-07-26

**This is the file to open when the owner says "sync the docs"** (or "update the docs", or you
finished work and need to write it down). Follow the table below rather than guessing.

Two rules cover 90% of it:

1. **Write the fact once, in the file that owns it.** Everything else links.
2. **Never append to a live file.** Live files (STATUS) get *rewritten*; history goes to `log/`.

Run `.venv-ml/bin/python scripts/check_docs.py` when you are done. It catches the mechanical
mistakes so review can be about content.

## I just did X — what do I update?

| What you did | Update | Do NOT touch |
|---|---|---|
| Anything at all, at end of session | [STATUS.md](STATUS.md) — rewrite "Now" and "Next" | ROADMAP, README |
| Measured something (accuracy, yield, corpus size) | [METRICS.md](METRICS.md) row + the raw log in [../src/vision/MODEL_EVAL.md](../src/vision/MODEL_EVAL.md) | any other file quoting numbers |
| Finished a chunk of work | one dated entry at the TOP of [log/status-log.md](log/status-log.md) | — |
| Decided something, or reversed a decision | [DECISIONS.md](DECISIONS.md) row (mark the old one OVERTURNED/SUPERSEDED, don't delete it) | — |
| Cancelled or abandoned a plan | move its reasoning to [log/superseded.md](log/superseded.md) | leaving it in a live file "for context" |
| Work inside the real-page track | the matching `rung3/*.md` file | STATUS (keep it a summary) |
| Started a genuinely new track | new `docs/<track>/README.md` + index row + a STATUS line | cramming it into rung3/ |
| Added/changed a script or module | [CODE_TOUR.md](CODE_TOUR.md) row | — |
| Changed a command, a hard rule, or where data lives | [../CLAUDE.md](../CLAUDE.md) | — |
| Anything the owner should understand in plain words | [OVERVIEW.md](OVERVIEW.md) | — |
| Renamed or moved a doc | leave a stub with a section map; update code comments citing it | — |

## End-of-session checklist

1. **STATUS.md** — is "Now" still true, and is "Next" the thing you'd actually do tomorrow?
   Anything that is no longer *next* moves out (to `log/status-log.md` or a track file).
2. **A number changed?** METRICS.md, and only METRICS.md (plus its raw log).
3. **A decision changed?** DECISIONS.md, with the date and what overturned it.
4. **Write the log entry** while you still remember *why*, not just *what*. The "why" is the part
   that is expensive to reconstruct six weeks later.
5. `.venv-ml/bin/python scripts/check_docs.py` → fix anything it reports.
6. Commit docs separately from code when you can; it keeps both diffs readable.

## The rules, and why they exist

- **One fact, one home.** Before the 2026-07-26 refactor the same numbers lived in 4–7 files, and
  the pointer docs sat **18 days stale** — nobody can hand-sync seven copies. If two files disagree,
  the fix is to *delete* one, not to sync them.
- **Live vs log.** A file that mixes "what we will do" with "what we did" eventually reads as
  instructions to do things that were abandoned. That is the single most expensive failure mode
  here: an agent acting on a superseded plan. Live = STATUS + track files; log = `log/`.
- **Superseded plans keep their reasoning.** Delete the plan, keep the argument — otherwise the same
  cancelled experiment gets proposed again next month.
- **≤400 lines per file.** RUNG3.md reached 1,407 lines mixing four genres. When a file crosses the
  cap, split by *genre or phase* (plan / criteria / results / postmortem), not by size.
- **No wall-of-text paragraphs.** ROADMAP's status footer became a single 16,000-character
  paragraph: impossible to skim, to grep to a section, or to edit safely. Use dated headings and
  bullets so a reader can jump.
- **Every doc says what it is.** The `purpose:` / `audience:` / `updated:` header means nobody has
  to read a file to find out whether it is live, historical, or dead.
- **Code comments cite exact doc paths.** They are checked, so a doc move can't quietly orphan them.

## Writing style

- Say the finding first, then the evidence. "Resolution was ruled out — recall doesn't fall with
  scale" beats three paragraphs building to it.
- Keep the **negative results and the caveats** — "this looked like the answer and wasn't" is often
  the most valuable line in a log entry, and it prevents a repeat.
- Mark uncertainty explicitly (non-claims, low-n, "estimate"). A number without its caveat gets
  quoted later as if it were solid — that already happened once with a 3-gold class swinging a
  headline ~11pp.
- [OVERVIEW.md](OVERVIEW.md) is the exception to the house style: plain English, short sentences,
  every term explained, and it may restate numbers so it reads standalone.

## What the checker enforces

`scripts/check_docs.py` (`--facts` adds the last one):

| Check | Fails when |
|---|---|
| header block | a doc lacks `purpose:` / `audience:` / `updated:` |
| size cap | a doc exceeds 400 lines (append-only logs are allow-listed in `LONG_OK`) |
| paragraphs | a prose paragraph exceeds 2,500 characters |
| links | a relative markdown link doesn't resolve |
| code refs | source code cites a doc path that doesn't exist |
| orphans | a doc isn't reachable from INDEX.md, CLAUDE.md, or a track index |
| `--facts` | a number or path in `archive/pre-refactor/` appears nowhere in the live docs |

The `--facts` check exists for one job: proving the 2026-07-26 rewrite lost nothing. It caught 10
dropped facts on its first run. Keep `archive/pre-refactor/` as it is — it is the baseline. If you
drop a fact **on purpose**, the check will flag it; add it to `ignore_num` / `moved_paths` in the
script with a comment saying why.

## Adding a new track

1. `docs/<track>/README.md` — the one-paragraph plan, a state table, and the file map.
2. Split by phase from the start (`plan.md`, `results.md`, …). Do not start one file and let it grow
   to 1,400 lines; that is how the last one happened.
3. Add a row to [INDEX.md](INDEX.md) and, if it becomes the live work, to [../CLAUDE.md](../CLAUDE.md).
4. Point STATUS.md at it. STATUS summarises; the track file carries the detail.
