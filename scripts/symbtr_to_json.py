#!/usr/bin/env python3
"""Export a SymbTr .txt score to note-model JSON (the contract for the TS core).

Usage:
    python scripts/symbtr_to_json.py path/to/score.txt [-o out.json]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC))

from symbtr.parser import EventKind, parse_file  # noqa: E402
from symbtr.export_json import export_file  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="Export a SymbTr score to note-model JSON.")
    ap.add_argument("input", type=Path, help="path to a SymbTr .txt file")
    ap.add_argument("-o", "--output", type=Path, help="output JSON path (default: <input>.json)")
    ap.add_argument("--ref-freq", type=float, default=440.0, help="reference frequency for A4 (Hz)")
    args = ap.parse_args()

    if not args.input.exists():
        ap.error(f"input not found: {args.input}")

    score = parse_file(args.input)
    out = args.output or args.input.with_suffix(".json")
    export_file(score, out, ref_freq=args.ref_freq)

    n_note = sum(1 for e in score.events if e.kind is EventKind.NOTE)
    n_rest = sum(1 for e in score.events if e.kind is EventKind.REST)
    n_grace = sum(1 for e in score.events if e.kind is EventKind.GRACE)
    n_meta = sum(1 for e in score.events if e.kind is EventKind.META)
    print(f"{score.title or score.name}: {len(score.events)} events "
          f"(notes {n_note}, rests {n_rest}, graces {n_grace}, meta {n_meta}) -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
