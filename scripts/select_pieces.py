#!/usr/bin/env python3
"""Rung-2 dataset piece selection: scan the SymbTr corpus and pick ~N (piece, transpose) render
jobs that maximize the WORST-covered AEU accidental class, writing the checked-in `data/pieces.json`
that drives batch export (`scripts/export_scores.py`) and the batch renderer (`tools/render/render.ts`).

Why selection is needed at all: the headline metric is PER-CLASS accuracy on the 8 AEU accidental
tokens, and the classes are wildly imbalanced in the repertoire (koma flats everywhere, büyük
mücennep sharps rare). Transposition re-spells every note (a piece full of `\\komaFlat b` becomes
`\\bakiyeFlat d/g/a` at −4), so choosing WHICH transposes to render is the main balancing lever.

Why the accidental counts here are EXACT, not heuristic: this ports the same spelling math the TS
renderer draws with — `komaToName` (smallest-alteration respell, packages/core/src/notation.ts)
and `toAeuAlter` (snap to the four AEU signs) — so a projected count is precisely what the labels
will contain in "every" mode.

It also projects each piece's MULTI-MEASURE strip share: dense measures (~4 real tokenizer ids per
note) cannot pair under the decoder's 60-id budget, so multi-measure/barline coverage comes from
selecting enough sparse pieces. The greedy loop tie-breaks toward them.

Usage:
    .venv-ml/bin/python scripts/select_pieces.py [--corpus ~/Downloads/SymbTr-2.0.0/txt]
        [--n 150] [--max-extra-transposes 2] [--out data/pieces.json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC))

from symbtr.parser import EventKind, parse_file  # noqa: E402

# ---------------------------------------------------------------------------
# Ports of packages/core/src/notation.ts (keep in sync — TS is the source of truth).

PC_COMMA = {"C": 0, "D": 9, "E": 18, "F": 22, "G": 31, "A": 40, "B": 49}
LETTERS = list(PC_COMMA)
AEU_MAGNITUDES = (1, 4, 5, 8)

# alter (AEU-snapped commas) → label token, mirroring lilypond.ts AEU_TOKEN.
AEU_TOKEN = {
    1: "\\komaSharp", -1: "\\komaFlat",
    4: "\\bakiyeSharp", -4: "\\bakiyeFlat",
    5: "\\kucukSharp", -5: "\\kucukFlat",
    8: "\\buyukSharp", -8: "\\buyukFlat",
}


SOLFEGE_RE = re.compile(r"^(Do|Re|Mi|Fa|Sol|So|La|Si)(-?\d+)(?:(#|b)(\d+))?$")
SOLFEGE_TO_LETTER = {"Do": "C", "Re": "D", "Mi": "E", "Fa": "F", "Sol": "G", "So": "G", "La": "A", "Si": "B"}


def parse_solfege(name: str) -> tuple[str, int, int] | None:
    """SymbTr note name ("Si4b5") → (letter, octave, alterCommas). Used for the UNtransposed
    case: at t=0 the renderer draws the score's own spelling verbatim (`transpose` only respells
    when commas ≠ 0), and SymbTr's spelling disagrees with the smallest-alteration respell on
    enharmonic ties (e.g. Si4b5 vs La4#4) for ~9% of notes — measured, not hypothetical."""
    m = SOLFEGE_RE.match(name.strip())
    if not m:
        return None
    letter = SOLFEGE_TO_LETTER[m.group(1)]
    octave = int(m.group(2))
    alter = int(m.group(4)) if m.group(4) else 0
    if m.group(3) == "b":
        alter = -alter
    return letter, octave, alter


def koma_to_spelling(koma: int) -> tuple[str, int, int] | None:
    """komaToName's core: absolute Holdrian comma → (letter, octave, alterCommas), choosing the
    smallest-|alter| enharmonic (exactly how the renderer respells transposed notes)."""
    block = koma // 53
    best: tuple[str, int, int] | None = None
    for o in range(block - 2, block + 2):
        for letter in LETTERS:
            natural = 53 * (o + 1) + PC_COMMA[letter]
            alter = koma - natural
            if abs(alter) > 8:
                continue
            if best is None or abs(alter) < abs(best[2]):
                best = (letter, o, alter)
    return best


def to_aeu_alter(commas: int) -> int:
    """toAeuAlter: snap a comma alteration to the nearest AEU sign magnitude (sign kept)."""
    if commas == 0:
        return 0
    mag = abs(commas)
    best = min(AEU_MAGNITUDES, key=lambda m: abs(m - mag))
    return -best if commas < 0 else best


# ---------------------------------------------------------------------------
# Port of the label token ESTIMATE (lilypond.ts noteToLily + lilyDuration): needed to project
# which adjacent measures can pair inside STRIP_BUDGET.maxTokens. Matches the real tokenizer to
# within a couple ids (verified: dense 9-note measure ≈ 38 estimated ≈ 38 real ids).

DUR = ((1, 1.0), (2, 0.5), (4, 0.25), (8, 0.125), (16, 0.0625), (32, 0.03125), (64, 0.015625))
MAX_TOKENS = 56  # STRIP_BUDGET.maxTokens (lilypond.ts)


def lily_duration_len(beats: float) -> int:
    for code, val in DUR:
        if abs(beats - val) < 1e-4:
            return len(str(code))
        if abs(beats - val * 1.5) < 1e-4:
            return len(str(code)) + 1
        if abs(beats - val * 1.75) < 1e-4:
            return len(str(code)) + 2
    best = min(DUR, key=lambda d: abs(d[1] - beats))
    return len(str(best[0]))


def note_token_estimate(koma: int, num: int, den: int, is_rest: bool, altered: bool) -> int:
    beats = num / den if den else 0.25
    dur_len = lily_duration_len(beats)
    if is_rest:
        return 1 + dur_len
    sp = koma_to_spelling(koma)
    oct_marks = abs((sp[1] if sp else 4) - 3)
    return (1 if altered else 0) + 1 + oct_marks + dur_len


# ---------------------------------------------------------------------------

# Transpose offsets worth considering (commas): small steps exercise respelling, ±9 the whole
# tone. 0 is always included for a selected piece.
TRANSPOSES = (0, -9, -5, -4, -1, 1, 4, 5, 9)
# Comfortable treble-staff window (absolute koma): ~G3..D6 — beyond it the transposed render
# drowns in ledger lines, which real Turkish scores avoid.
KOMA_MIN, KOMA_MAX = 243, 380


@dataclass
class Candidate:
    """One renderable (piece, transpose): its exact projected accidental counts + structure."""

    transpose: int
    acc: Counter = field(default_factory=Counter)  # AEU token → occurrences ("every" mode)
    pairable: float = 0.0  # share of adjacent measure pairs fitting one 56-token strip


@dataclass
class Piece:
    stem: str
    path: Path
    makam: str
    form: str
    usul: str
    has_lyrics: bool
    n_events: int
    n_measures: int
    candidates: dict[int, Candidate] = field(default_factory=dict)


def analyze(path: Path) -> Piece | None:
    """Parse one SymbTr file and project accidental counts + measure token costs per transpose."""
    try:
        score = parse_file(path)
    except Exception:
        return None
    sounding = score.sounding_events
    notes = [e for e in sounding if e.kind is EventKind.NOTE]
    if len(notes) < 50 or len(score.events) > 1000:
        return None
    komas = [e.koma_53 for e in notes]
    lo, hi = min(komas), max(komas)

    # Offset-based bar assignment (assignBars' primary path in packages/core/src/measures.ts).
    eps = 1e-3
    bars = [max(1, int(e.offset - eps) + 1) for e in sounding]
    if bars != sorted(bars):
        return None  # non-monotonic offsets — the fallback path is rare; skip such pieces

    piece = Piece(
        stem=path.stem, path=path, makam=score.makam, form=score.form, usul=score.usul,
        has_lyrics=any(e.lyric.strip() not in ("", ".") for e in sounding),
        n_events=len(score.events), n_measures=len(set(bars)),
    )

    for t in TRANSPOSES:
        if not (KOMA_MIN <= lo + t and hi + t <= KOMA_MAX):
            continue
        cand = Candidate(transpose=t)
        measure_cost: Counter = Counter()
        ok = True
        for e, bar in zip(sounding, bars):
            if e.kind is EventKind.NOTE:
                # t=0 keeps the score's own spelling (that's what the renderer draws); any other
                # transpose respells via komaToName, exactly like packages/core/src/transpose.ts.
                sp = parse_solfege(e.note_53) if t == 0 else None
                sp = sp or koma_to_spelling(e.koma_53 + t)
                if sp is None:
                    ok = False
                    break
                alter = to_aeu_alter(sp[2])
                if alter != 0:
                    cand.acc[AEU_TOKEN[alter]] += 1
                measure_cost[bar] += note_token_estimate(e.koma_53 + t, e.num, e.den, False, alter != 0)
            else:
                measure_cost[bar] += note_token_estimate(0, e.num, e.den, True, False)
        if not ok:
            continue
        costs = [measure_cost[b] for b in sorted(measure_cost)]
        pairs = [1 for a, b in zip(costs, costs[1:]) if a + 1 + b <= MAX_TOKENS]
        cand.pairable = len(pairs) / max(1, len(costs) - 1)
        piece.candidates[t] = cand

    return piece if 0 in piece.candidates else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--corpus", default=str(Path.home() / "Downloads/SymbTr-2.0.0/txt"))
    ap.add_argument("--n", type=int, default=150, help="number of pieces to select")
    ap.add_argument("--max-extra-transposes", type=int, default=2)
    ap.add_argument("--out", default="data/pieces.json")
    args = ap.parse_args()

    corpus = Path(args.corpus).expanduser()
    files = sorted(corpus.glob("*.txt"))
    print(f"scanning {len(files)} SymbTr files in {corpus} ...")
    pieces: list[Piece] = []
    for i, f in enumerate(files):
        p = analyze(f)
        if p:
            pieces.append(p)
        if (i + 1) % 400 == 0:
            print(f"  {i + 1}/{len(files)} scanned, {len(pieces)} usable")
    print(f"usable pieces: {len(pieces)}")

    classes = list(AEU_TOKEN.values())
    # Selection can only optimize what the repertoire can yield: the whole corpus holds ~47 notes
    # at ≥6 commas, and smallest-alteration respelling never exceeds ±5 (letter gaps are 4 or 9),
    # so the two büyük classes stay ~0 here no matter the picks. They get their coverage from the
    # seeded AEU-enharmonic respell at render time (tools/render/respell.ts); optimizing the
    # greedy min over them would just saturate the criterion at 0 and randomize the selection.
    reachable = [c for c in classes if "buyuk" not in c]
    totals: Counter = Counter({c: 0 for c in classes})
    picked: list[tuple[Piece, int]] = []  # (piece, transpose) render jobs
    picked_pieces: dict[str, Piece] = {}

    def gain_key(cand: Candidate, piece: Piece):
        """Sort key for greedy max-min coverage; larger is better."""
        after = totals.copy()
        after.update(cand.acc)
        worst = min(after[c] for c in reachable)
        second = sorted(after[c] for c in reachable)[1]
        new_makam = piece.makam not in {p.makam for p in picked_pieces.values()}
        new_usul = piece.usul not in {p.usul for p in picked_pieces.values()}
        return (worst, second, cand.pairable, new_makam, new_usul, piece.stem)

    # Phase A — pick N pieces by their t=0 candidate (t=0 always rendered for a selected piece).
    remaining = {p.stem: p for p in pieces}
    while len(picked_pieces) < args.n and remaining:
        best = max(remaining.values(), key=lambda p: gain_key(p.candidates[0], p))
        del remaining[best.stem]
        picked_pieces[best.stem] = best
        picked.append((best, 0))
        totals.update(best.candidates[0].acc)

    # Phase B — add extra transposes (≤ max per piece) that most lift the worst class.
    extras: list[tuple[Piece, int]] = [
        (p, t) for p in picked_pieces.values() for t in p.candidates if t != 0
    ]
    per_piece: Counter = Counter()
    budget = args.n * args.max_extra_transposes // 2  # ~1 extra transpose per piece on average
    while budget > 0 and extras:
        best_i = max(range(len(extras)), key=lambda i: gain_key(extras[i][0].candidates[extras[i][1]], extras[i][0]))
        piece, t = extras.pop(best_i)
        if per_piece[piece.stem] >= args.max_extra_transposes:
            continue
        per_piece[piece.stem] += 1
        picked.append((piece, t))
        totals.update(piece.candidates[t].acc)
        budget -= 1

    # Assemble pieces.json: one entry per piece, its transposes sorted, exact per-transpose counts.
    by_piece: dict[str, dict] = {}
    for piece, t in picked:
        entry = by_piece.setdefault(piece.stem, {
            "slug": piece.stem,
            "txt": piece.path.name,
            "file": f"/scores/{piece.stem}.json",
            "makam": piece.makam, "form": piece.form, "usul": piece.usul,
            "hasLyrics": piece.has_lyrics,
            "events": piece.n_events, "measures": piece.n_measures,
            "transposes": [], "accCounts": {}, "pairableShare": {},
        })
        entry["transposes"].append(t)
        entry["accCounts"][str(t)] = dict(piece.candidates[t].acc)
        entry["pairableShare"][str(t)] = round(piece.candidates[t].pairable, 3)
    for e in by_piece.values():
        e["transposes"].sort()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "generatedBy": "scripts/select_pieces.py",
        "corpus": str(corpus),
        "projectedTotals": {c: totals[c] for c in classes},
        "pieces": sorted(by_piece.values(), key=lambda e: e["slug"]),
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    n_jobs = len(picked)
    pair_avg = sum(p.candidates[t].pairable for p, t in picked) / max(1, n_jobs)
    print(f"\nselected {len(by_piece)} pieces / {n_jobs} (piece, transpose) render jobs -> {out}")
    print(f"mean pairable-measure share (multi-measure proxy): {pair_avg:.0%}\n")
    print("projected per-class accidental occurrences ('every' mode labels):")
    for c in classes:
        print(f"  {c:<14} {totals[c]:>6}")
    worst = min(totals[c] for c in reachable)
    print(f"\nworst REACHABLE class: {worst}  ({'OK' if worst >= 300 else 'LOW — consider more pieces/transposes'})")
    print("(büyük classes are covered by the render-time AEU-enharmonic respell, not selection)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
