#!/usr/bin/env python3
"""Phase 0 entry point: SymbTr .txt -> microtonal audio (WAV).

Usage:
    python scripts/symbtr_to_audio.py path/to/score.txt [-o out.wav] [--info]

This proves the back half of the pipeline (symbolic notes -> correct 53-TET
frequencies -> playback) with no machine learning involved.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make ``src/`` importable when running this script directly.
SRC = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC))

from symbtr.parser import EventKind, parse_file  # noqa: E402
from audio.synth import render_score, write_wav  # noqa: E402
from audio.tuning import koma53_to_freq  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="Convert a SymbTr score to microtonal audio.")
    ap.add_argument("input", type=Path, help="path to a SymbTr .txt file")
    ap.add_argument("-o", "--output", type=Path, help="output WAV path (default: <input>.wav)")
    ap.add_argument("--ref-freq", type=float, default=440.0, help="reference frequency for A4 (Hz)")
    ap.add_argument("--info", action="store_true", help="print score summary and first notes")
    args = ap.parse_args()

    if not args.input.exists():
        ap.error(f"input not found: {args.input}")

    score = parse_file(args.input)
    notes = score.notes

    print(f"Piece   : {score.title or score.name}")
    print(f"Makam   : {score.makam}   Form: {score.form}   Usul: {score.usul}")
    print(f"Composer: {score.composer or '-'}")
    print(f"Events  : {len(score.events)}  (notes: {len(notes)}, "
          f"rests: {sum(1 for e in score.events if e.kind is EventKind.REST)}, "
          f"meta: {sum(1 for e in score.events if e.kind is EventKind.META)})")

    if args.info:
        print("\nFirst 10 notes (name  koma53  ->  Hz  duration):")
        for ev in notes[:10]:
            freq = koma53_to_freq(ev.koma_53, ref_freq=args.ref_freq)
            print(f"  {ev.note_53:<6} {ev.koma_53:>4}  ->  {freq:7.2f} Hz   {ev.duration_s:.3f}s")

    audio = render_score(score, ref_freq=args.ref_freq)
    out = args.output or args.input.with_suffix(".wav")
    write_wav(out, audio)
    print(f"\nWrote {len(audio) / 44_100:.1f}s of audio -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
