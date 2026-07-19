"""Draft-verdict the mechanical tail of the nota-full queue from the user's hand fixes.

Policy derived from the first 125 human verdicts of strips_nota/full_audit.csv
(79 fix / 46 ok, 2026-07-17): where label and decode disagree, the human sided with
the DECODE on ties, duration respells (e.g. `e''4 r8` vs `e''4.` — same pitches, same
total duration) and repeat/volta marks, and with the LABEL or a third reading on
pitch, signature, tuplet and grace disputes. Measured on those 125 rows:

  dur_respell(+tie)  8/8 rows exact
  tie_only + repeat  84% exact at min_logprob >= -0.3, ~70% unthresholded
  sig / tuplet / grace / pitch / other -> NEVER auto-adopt (image judgment;
                                          decode also hallucinates unclosed \tup3)

A row gets a draft fix only if EVERY diff span is in the adopt set; otherwise it stays
unverdicted for the human. Verdicts are DRAFTS for human review, written with
by="rule" (confident: dur-only rows, or min_logprob >= -0.3) or by="rule-lowconf"
(check harder) so the review UI and trust accounting can tell them apart — a human
re-verdict clears the marker. The CSV is re-read immediately before the atomic write
and only still-unverdicted rows are filled, so a concurrent review-UI session can't
be clobbered. A one-time .bak-rulefix backup is kept beside the queue.
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import shutil
import sys
import tempfile
from collections import Counter
from difflib import SequenceMatcher
from fractions import Fraction
from pathlib import Path

CSV_PATH = Path("data/real/rung3/strips_nota/full_audit.csv")
LP_MIN = -0.3

# longest-first so \sigend splits before \sig etc.
_BACKSLASH = sorted(
    ["komaSharp", "bakiyeSharp", "kucukSharp", "buyukSharp",
     "komaFlat", "bakiyeFlat", "kucukFlat", "buyukFlat", "natural", "sigend", "sig",
     "repstart", "repend", "volta1", "volta2", "segno", "coda", "dc", "fine",
     "tup3", "tupend", "tie", "grace"], key=len, reverse=True)
# the decoded column stores tokens glued to their successor (`\tieg''16`, `|g'2`)
_SPLIT_RE = re.compile(r"(\\(?:" + "|".join(_BACKSLASH) + r")|\|)")

NOTE = re.compile(r"^([a-g])([',]*)(1|2|4|8|16|32|64)(\.?)$")
REST = re.compile(r"^r(1|2|4|8|16|32|64)(\.?)$")
REPS = {"\\repstart", "\\repend", "\\volta1", "\\volta2",
        "\\segno", "\\coda", "\\dc", "\\fine"}
ADOPT = {"tie_only", "repeat_marks", "dur_respell", "dur_respell_tie"}
DUR_CATS = {"dur_respell", "dur_respell_tie"}


def toks(s: str) -> list[str]:
    return [t for t in _SPLIT_RE.sub(r" \1 ", s).split() if t]


def dur_of(t: str) -> Fraction | None:
    m = NOTE.match(t)
    if m:
        base, dot = m.group(3), m.group(4)
    else:
        m = REST.match(t)
        if not m:
            return None
        base, dot = m.group(1), m.group(2)
    f = Fraction(1, int(base))
    return f * Fraction(3, 2) if dot else f


def span_dur(ts: list[str]) -> Fraction | None:
    tot = Fraction(0)
    for t in ts:
        if t in ("\\tie", "|"):
            continue
        d = dur_of(t)
        if d is None:
            return None
        tot += d
    return tot


def pitch_seq(ts: list[str]) -> list[str] | None:
    out = []
    for t in ts:
        m = NOTE.match(t)
        if m:
            out.append(m.group(1) + m.group(2))
        elif REST.match(t) or t in ("\\tie", "|"):
            continue
        else:
            return None
    return out


def classify(ls: list[str], ds: list[str]) -> str:
    both = ls + ds
    if any(t in ("\\tup3", "\\tupend") for t in both):
        return "tuplet"
    if "\\grace" in both:
        return "grace"
    if any(t in ("\\sig", "\\sigend") for t in both):
        return "sig"
    if [t for t in ls if t != "\\tie"] == [t for t in ds if t != "\\tie"]:
        return "tie_only"
    if [t for t in ls if t not in REPS] == [t for t in ds if t not in REPS]:
        return "repeat_marks"
    lp, dp = pitch_seq(ls), pitch_seq(ds)
    ld, dd = span_dur(ls), span_dur(ds)
    if None not in (lp, dp, ld, dd) and ld == dd and lp == dp:
        return "dur_respell_tie" if ("\\tie" in ls or "\\tie" in ds) else "dur_respell"
    return "other"


def propose(label: str, decoded: str) -> tuple[str | None, set[str]]:
    """Return (corrected_label, categories), corrected_label=None when abstaining."""
    L, D = toks(label), toks(decoded)
    pieces, pos, cats = [], 0, set()
    for tag, i1, i2, j1, j2 in SequenceMatcher(a=L, b=D, autojunk=False).get_opcodes():
        if tag == "equal":
            continue
        cats.add(classify(L[i1:i2], D[j1:j2]))
        pieces.append(L[pos:i1])
        pieces.append(D[j1:j2])
        pos = i2
    pieces.append(L[pos:])
    if not cats or not (cats <= ADOPT):
        return None, cats
    return " ".join(t for p in pieces for t in p), cats


def draft(r: dict) -> tuple[str, str, set[str]] | None:
    """(corrected_label, by-tag, categories) for an unverdicted coverable row."""
    if r["verdict"]:
        return None
    fixed, cats = propose(r["label"], r["decoded"])
    if fixed is None:
        return None
    if cats <= DUR_CATS:
        return fixed, "rule", cats
    try:
        lp = float(r["min_logprob"])
    except ValueError:
        lp = None
    return fixed, "rule" if lp is not None and lp >= LP_MIN else "rule-lowconf", cats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", type=Path, default=CSV_PATH)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(args.csv, newline="") as f:
        rows = list(csv.DictReader(f))
    stats = Counter()
    for r in rows:
        got = draft(r)
        if got is None:
            continue
        _, by, cats = got
        stats[by] += 1
        stats["cat:" + "+".join(sorted(cats))] += 1
    print(f"draft verdicts for {stats['rule'] + stats['rule-lowconf']} of {len(rows)} rows "
          f"({stats['rule']} rule / {stats['rule-lowconf']} rule-lowconf):")
    for k, v in stats.most_common():
        if k.startswith("cat:"):
            print(f"  {k[4:]:40s} {v}")
    if args.dry_run:
        return

    bak = args.csv.with_suffix(".csv.bak-rulefix")
    if not bak.exists():
        shutil.copy2(args.csv, bak)

    # re-read just before writing: a review-UI verdict may have landed since; the
    # draft is recomputed off the fresh row and only still-unverdicted rows filled.
    with open(args.csv, newline="") as f:
        rd = csv.DictReader(f)
        fields, rows = rd.fieldnames, list(rd)
    applied = 0
    for r in rows:
        got = draft(r)
        if got is None:
            continue
        r["verdict"] = "fix"
        r["corrected_label"], r["by"], _ = got
        applied += 1
    fd, tmp = tempfile.mkstemp(dir=args.csv.parent, suffix=".csv.tmp")
    try:
        with os.fdopen(fd, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        os.replace(tmp, args.csv)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    print(f"applied {applied} draft verdicts; backup at {bak}")


if __name__ == "__main__":
    sys.exit(main())
