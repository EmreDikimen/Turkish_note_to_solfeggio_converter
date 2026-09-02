#!/usr/bin/env python3
"""Doc-structure checker — keeps the 2026-07-26 layout from rotting back into one giant file.

WHY THIS EXISTS. Before the refactor the docs were ~392 KB across 12 files: ROADMAP §7 was a
680-line append-log ending in a single 16,000-character paragraph, docs/RUNG3.md was 1,407 lines
mixing plan/status/results/postmortems, and the same numbers were restated in 4-7 files. The
restating is what actually broke things: the pointer docs sat 18 days stale because nobody can
hand-sync seven copies of a fact. These checks encode the rules that replaced that mess.

WHAT IT CHECKS (all cheap, no network, no deps):
  1. header block   every docs/*.md starts with purpose:/audience:/updated: lines
  2. size cap       no doc over MAX_LINES (the rule that would have caught RUNG3.md at 1,407)
  3. paragraphs     no single paragraph over MAX_PARA_CHARS (the 16k-char footer, never again)
  4. links          every relative markdown link resolves
  5. code refs      every docs/... path cited in source code exists
  6. orphans        every doc is reachable from docs/INDEX.md (or is deliberately unlisted)
  7. --facts        every number/path in docs/archive/pre-refactor/ still appears somewhere in
                    the live tree (the no-information-loss check for the refactor itself)

USAGE
  .venv-ml/bin/python scripts/check_docs.py            # structure checks (exit 1 on failure)
  .venv-ml/bin/python scripts/check_docs.py --facts    # + the archive fact diff (slow-ish)
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs"
ARCHIVE = DOCS / "archive" / "pre-refactor"

MAX_LINES = 400          # soft cap; logs are allowed to be longer, see LONG_OK
MAX_PARA_CHARS = 2500    # a paragraph longer than this is unreadable and un-greppable
LONG_OK = {              # append-only records: size is inherent, structure is what matters
    "docs/log/status-log.md",
    "src/vision/MODEL_EVAL.md",
    # A verbatim training console log. Its length IS the artifact — trimming it would defeat the
    # reason it is kept (the tuplet A/B's equivalent was deleted and that entry has to say so).
    "round_3_scan_logs.md",
    "round_3_staccato_logs.md",
    "round3_final_logs.md",
    "round3_runa_logs.md",
    "round3_runb_logs.md",
}
# Docs that need no header block / index entry (archived verbatim copies, external READMEs).
# `hf/` is the model card uploaded verbatim to the Hugging Face Hub as the weights repo's README —
# a purpose:/audience:/updated: block would be published to strangers as if it were house style.
EXEMPT_PREFIXES = ("docs/archive/", "hf/")

HEADER_KEYS = ("purpose:", "audience:", "updated:")
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
# Doc paths cited from source comments, e.g. "docs/rung3/labeling.md" or "src/vision/MODEL_EVAL.md".
CODE_DOC_REF_RE = re.compile(r"\b((?:docs|src|tools|scripts)/[A-Za-z0-9_./-]+\.md)\b")
CODE_DIRS = ("src", "scripts", "tools", "apps", "notebooks")
CODE_SUFFIXES = (".py", ".ts", ".tsx", ".sh", ".ipynb")


def live_docs() -> list[Path]:
    """Every markdown file we own, excluding the verbatim archive and node_modules."""
    out = []
    for p in REPO.rglob("*.md"):
        rel = p.relative_to(REPO).as_posix()
        if "node_modules" in rel or rel.startswith(".venv") or rel.startswith("data/"):
            continue
        out.append(p)
    return sorted(out)


def rel(p: Path) -> str:
    return p.relative_to(REPO).as_posix()


def check_headers(docs: list[Path], fail) -> None:
    """Every doc must say what it is for and when it was last touched.

    Without this an agent has to read a whole file to learn whether it is a plan, a log, or dead.
    """
    for p in docs:
        r = rel(p)
        if r.startswith(EXEMPT_PREFIXES) or r in ("README.md", "CLAUDE.md"):
            continue
        head = "\n".join(p.read_text().split("\n")[:12])
        missing = [k for k in HEADER_KEYS if k not in head]
        if missing:
            fail(f"{r}: header block missing {', '.join(missing)} (first 12 lines)")


def check_sizes(docs: list[Path], fail) -> None:
    for p in docs:
        r = rel(p)
        if r.startswith(EXEMPT_PREFIXES) or r in LONG_OK:
            continue
        n = len(p.read_text().split("\n"))
        if n > MAX_LINES:
            fail(f"{r}: {n} lines > {MAX_LINES} — split it by phase/genre instead of appending")


def check_paragraphs(docs: list[Path], fail) -> None:
    """No wall-of-text paragraphs. A reader (human or model) needs anchors to jump to."""
    for p in docs:
        r = rel(p)
        if r.startswith(EXEMPT_PREFIXES):
            continue
        for i, para in enumerate(p.read_text().split("\n\n")):
            lines = [l for l in para.split("\n") if l.strip()]
            if not lines:
                continue
            # Lists, tables, quotes, code and their indented continuation lines carry their own
            # structure — only flag genuine walls of unbroken prose.
            structured = sum(bool(re.match(r"(\s*([-*>|#]|\d+\.|```)|\s{2,}\S)", l)) for l in lines)
            if structured >= max(1, len(lines) // 2):
                continue
            if len(para) > MAX_PARA_CHARS:
                fail(f"{r}: prose paragraph {i} is {len(para)} chars > {MAX_PARA_CHARS} — break it "
                     f"into entries with headings")


def check_links(docs: list[Path], fail) -> None:
    for p in docs:
        if rel(p).startswith(EXEMPT_PREFIXES):
            continue
        for target in LINK_RE.findall(p.read_text()):
            if target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            path = (p.parent / target.split("#")[0]).resolve()
            if not path.exists():
                fail(f"{rel(p)}: broken link -> {target}")


def check_code_refs(fail) -> None:
    """Source comments cite docs by path; a doc move must not leave a dangling citation."""
    for d in CODE_DIRS:
        for p in (REPO / d).rglob("*"):
            if p.suffix not in CODE_SUFFIXES or "node_modules" in p.as_posix():
                continue
            if p.resolve() == Path(__file__).resolve():
                continue  # this file names moved paths on purpose (moved_paths below)
            try:
                text = p.read_text()
            except UnicodeDecodeError:
                continue
            for ref in set(CODE_DOC_REF_RE.findall(text)):
                if not (REPO / ref).exists():
                    fail(f"{rel(p)}: cites missing doc {ref}")


def check_orphans(docs: list[Path], fail) -> None:
    """Every doc must be reachable from the index, or nobody will ever find it."""
    index = (DOCS / "INDEX.md").read_text()
    claude = (REPO / "CLAUDE.md").read_text()
    listed = set(LINK_RE.findall(index)) | set(LINK_RE.findall(claude))
    listed_names = {Path(t.split("#")[0]).name for t in listed}
    # Files reachable indirectly through a track index count as listed.
    for hub in (DOCS / "rung3" / "README.md", DOCS / "RUNG3.md", DOCS / "STATUS.md"):
        if hub.exists():
            listed_names |= {Path(t.split("#")[0]).name for t in LINK_RE.findall(hub.read_text())}
    for p in docs:
        r = rel(p)
        if r.startswith(EXEMPT_PREFIXES) or r in ("README.md", "CLAUDE.md", "ROADMAP.md"):
            continue
        if p.name not in listed_names:
            fail(f"{r}: not reachable from docs/INDEX.md, CLAUDE.md or a track index")


NUM_RE = re.compile(r"\b\d[\d,]*\.?\d*%?\b")
PATH_RE = re.compile(r"\b[A-Za-z0-9_/]+\.(?:py|ts|tsx|json|md|png|csv|sh|ipynb)\b")


def check_facts(fail) -> None:
    """No-information-loss check: facts in the pre-refactor archive must still exist somewhere.

    Deliberately crude — it compares the SET of numbers and file paths, not sentences. Its job is
    to catch a whole paragraph going missing in a rewrite, not to police wording.
    """
    if not ARCHIVE.exists():
        fail("docs/archive/pre-refactor/ missing — the refactor baseline is gone")
        return
    live = "\n".join(p.read_text() for p in live_docs()
                     if not rel(p).startswith(EXEMPT_PREFIXES))
    live_nums = set(NUM_RE.findall(live))
    live_paths = set(PATH_RE.findall(live))
    # Numbers that are pure noise (years, list indices, single digits) or intentionally dropped.
    ignore_num = {"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "2026", "12", "20", "60"}
    # Deliberate moves: the archive cites the pre-refactor path; the content still exists.
    # ⚠ Dropped ON PURPOSE, per docs/MAINTAINING.md: record the reason rather than the path.
    #   PianoRoll.tsx — DELETED 2026-08-29 (owner) when Keman and Kanun became one
    #   "Enstrüman üzerinde" tab; `PitchRangeNote` outlived it and is unrelated.
    moved_paths = {"docs/HISTORY.md", "docs/RUNG3.md", "apps/web/src/PianoRoll.tsx"}
    missing_nums: dict[str, set[str]] = {}
    missing_paths: dict[str, set[str]] = {}
    for a in sorted(ARCHIVE.glob("*.md")):
        text = a.read_text()
        nums = {n for n in NUM_RE.findall(text) if n not in ignore_num and len(n) > 2}
        paths = set(PATH_RE.findall(text))
        gone_n = {n for n in nums if n not in live_nums}
        gone_p = {p for p in paths
                  if p not in live_paths and not (REPO / p).exists() and p not in moved_paths}
        if gone_n:
            missing_nums[a.name] = gone_n
        if gone_p:
            missing_paths[a.name] = gone_p
    for name, vals in missing_nums.items():
        fail(f"facts: {len(vals)} numbers from archive/{name} appear nowhere live: "
             f"{', '.join(sorted(vals)[:12])}{' …' if len(vals) > 12 else ''}")
    for name, vals in missing_paths.items():
        fail(f"facts: {len(vals)} paths from archive/{name} appear nowhere live: "
             f"{', '.join(sorted(vals)[:8])}{' …' if len(vals) > 8 else ''}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--facts", action="store_true",
                    help="also diff numbers/paths against docs/archive/pre-refactor/")
    args = ap.parse_args()

    problems: list[str] = []
    fail = problems.append
    docs = live_docs()

    check_headers(docs, fail)
    check_sizes(docs, fail)
    check_paragraphs(docs, fail)
    check_links(docs, fail)
    check_code_refs(fail)
    check_orphans(docs, fail)
    if args.facts:
        check_facts(fail)

    if problems:
        print(f"✗ {len(problems)} problem(s):\n")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"✓ docs OK ({len(docs)} markdown files checked"
          f"{', including the archive fact diff' if args.facts else ''})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
