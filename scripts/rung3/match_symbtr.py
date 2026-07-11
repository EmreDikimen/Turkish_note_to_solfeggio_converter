#!/usr/bin/env python3
"""Match the downloaded neyzen corpus against SymbTr by name → free ground-truth labels.

Rung 3 step 1 (docs/RUNG3.md §2): for every downloaded real page whose piece also exists in
SymbTr, we already own a perfect symbolic transcription — no hand labeling needed. This script
fuzzy-matches the two catalogs by name and, for confident matches, exports the SymbTr piece as
a note-model JSON + per-measure LilyPond label tokens (via tools/render/labels-cli.ts).

Matching signals (both catalogs use ascii_ish lowercase underscore names):
  - hard filter: same makam (neyzen dir name vs. SymbTr filename field, underscores folded);
  - vocal pieces: the neyzen filename is usually the lyric incipit == SymbTr's title field
    (both truncated differently → token-level prefix-tolerant similarity);
  - instrumentals (SymbTr title is often empty): composer tokens + the form word/abbreviation
    (p = pesrev, ss = sazsemaisi, ...).

Outputs (under data/real/rung3/):
  matches_review.csv                       every pdf's best candidate + score + tier
  matched/<makam>/<neyzen_stem>/
      match.json                           the pairing (paths, page PNGs, scores)
      score.json                           SymbTr → note-model JSON (the ground truth)
      labels.json                          per-measure label tokens, every+keysig modes

Usage:
    python scripts/rung3/match_symbtr.py                # full run (export accepted matches)
    python scripts/rung3/match_symbtr.py --dry-run      # CSV only, no exports
    python scripts/rung3/match_symbtr.py --accept 0.85  # tune the accept threshold
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "src"))

from symbtr.parser import parse_file  # noqa: E402
from symbtr.export_json import export_file  # noqa: E402

REAL = REPO / "data" / "real"
OUT = REAL / "rung3"

# Turkish diacritics → ascii (filenames are mostly folded already; fold defensively).
TR_FOLD = str.maketrans("çğıöşüâîûÇĞİÖŞÜÂÎÛ", "cgiosuaiuCGIOSUAIU")

# neyzen filename tokens that carry no identity: instrument/arrangement suffixes + generic words.
NOISE_TOKENS = {
    "ney", "kanun", "keman", "ud", "tanbur", "tambur", "santur", "santuri", "gitar",
    "klarnet", "viyolonsel", "kemence", "nota", "notasi", "no",
}

# neyzen makam spelling → SymbTr makam key(s) (folded, underscores removed). Two kinds:
# pure spelling variants (nihavend/nihavent), and family fallbacks for subtypes SymbTr's
# catalog doesn't carry (hicaz_humayun → hicaz) — those still have to pass the title gate,
# and match.json records both names for review.
MAKAM_ALIASES: dict[str, list[str]] = {
    "nihavend": ["nihavent"],
    "suznak": ["suzinak"],
    "seddiaraban": ["sedaraban"],
    "evc": ["evic"],
    "evcbuselik": ["evicbuselik"],
    "evchuzi": ["evchuzi"],
    "bestesfahan": ["besteisfahan"],
    "beyatiaraban": ["araban", "beyati"],
    "hicazhumayun": ["hicaz"],
    "hicazzemzeme": ["hicaz"],
    "hicazzirgule": ["hicaz"],
    "uzzal": ["hicaz"],
}

# neyzen form abbreviations → the SymbTr form word (used when the SymbTr title is empty).
FORM_ABBREV = {
    "p": "pesrev", "pesrevi": "pesrev", "pesrev": "pesrev",
    "ss": "sazsemaisi", "sazsemaisi": "sazsemaisi", "sazsemai": "sazsemaisi",
    "semai": "sazsemaisi", "saz": "sazsemaisi",
    "longa": "longa", "lo": "longa", "sirto": "sirto", "medhal": "medhal", "m": "medhal",
    "oyunhavasi": "oyunhavasi", "zeybek": "zeybek", "mandira": "mandira",
}


def fold(s: str) -> str:
    return s.translate(TR_FOLD).lower()


def tokens(s: str) -> list[str]:
    out: list[str] = []
    cur: list[str] = []
    for ch in fold(s):
        if ch.isalnum():
            cur.append(ch)
        elif cur:
            out.append("".join(cur))
            cur = []
    if cur:
        out.append("".join(cur))
    return out


def tok_sim(a: str, b: str) -> float:
    """Similarity of two name tokens, tolerant of the truncation both catalogs apply."""
    if a == b:
        return 1.0
    if len(a) >= 3 and len(b) >= 3 and (a.startswith(b) or b.startswith(a)):
        return 0.9
    r = SequenceMatcher(None, a, b).ratio()
    return r if r >= 0.8 else 0.0


def set_score(want: list[str], have: list[str]) -> tuple[float, int]:
    """Mean best-match similarity of `want` tokens inside `have` (+ how many matched)."""
    if not want or not have:
        return 0.0, 0
    sims = [max(tok_sim(w, h) for h in have) for w in want]
    matched = sum(1 for s in sims if s > 0)
    return sum(sims) / len(want), matched


@dataclass
class SymbTrPiece:
    path: Path
    makam: str
    form: str
    usul: str
    title: str
    composer: str
    title_toks: list[str] = field(default_factory=list)
    composer_toks: list[str] = field(default_factory=list)

    @classmethod
    def from_path(cls, path: Path) -> "SymbTrPiece | None":
        parts = path.stem.split("--")
        if len(parts) != 5:
            return None
        makam, form, usul, title, composer = parts
        p = cls(path, fold(makam).replace("_", ""), fold(form), usul, title, composer)
        p.title_toks = tokens(title)
        p.composer_toks = tokens(composer)
        return p


@dataclass
class Candidate:
    piece: SymbTrPiece
    score: float
    detail: str


def score_candidate(neyzen_toks: list[str], piece: SymbTrPiece) -> Candidate:
    title_s, title_n = set_score(piece.title_toks, neyzen_toks)
    comp_s, comp_n = set_score(piece.composer_toks, neyzen_toks)

    if piece.title_toks:
        # Vocal piece: the incipit is the identity; composer is a tiebreaker.
        score = 0.85 * title_s + 0.15 * comp_s
        # A one-token title matching one short token is too weak to trust on its own.
        if title_n < 2 and len(piece.title_toks) >= 2:
            score *= 0.6
        detail = f"title {title_s:.2f} ({title_n}/{len(piece.title_toks)}), composer {comp_s:.2f}"
    else:
        # Instrumental: composer + form abbreviation carry the identity.
        form_hit = any(FORM_ABBREV.get(t) == fold(piece.form) for t in neyzen_toks)
        score = 0.7 * comp_s + (0.3 if form_hit else 0.0)
        if comp_n == 0:
            score = 0.0
        detail = f"composer {comp_s:.2f} ({comp_n}/{len(piece.composer_toks)}), form={'yes' if form_hit else 'no'}"
    return Candidate(piece, score, detail)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--symbtr-dir", type=Path, default=Path.home() / "Downloads" / "SymbTr-2.0.0" / "txt")
    ap.add_argument("--manifest", type=Path, default=REAL / "manifest.csv")
    ap.add_argument("--accept", type=float, default=0.85, help="auto-accept threshold")
    ap.add_argument("--review", type=float, default=0.60, help="lower bound of the review band")
    ap.add_argument("--margin", type=float, default=0.05,
                    help="min lead over the runner-up piece for auto-accept (ambiguity guard)")
    ap.add_argument("--dry-run", action="store_true", help="write the CSV only, export nothing")
    ap.add_argument("--limit", type=int, default=0, help="only process the first N manifest rows")
    ap.add_argument("--apply-csv", type=Path, metavar="CSV",
                    help="export the rows this (hand-reviewed) CSV marks tier=accept, instead of "
                         "re-scoring; lets you promote review-band rows by editing the tier column")
    args = ap.parse_args()

    pieces: list[SymbTrPiece] = []
    for path in sorted(args.symbtr_dir.glob("*.txt")):
        p = SymbTrPiece.from_path(path)
        if p:
            pieces.append(p)
    by_makam: dict[str, list[SymbTrPiece]] = {}
    for p in pieces:
        by_makam.setdefault(p.makam, []).append(p)
    print(f"SymbTr: {len(pieces)} pieces, {len(by_makam)} makams  ({args.symbtr_dir})")

    rows = list(csv.DictReader(open(args.manifest)))
    if args.limit:
        rows = rows[: args.limit]
    print(f"neyzen manifest: {len(rows)} pdfs")

    OUT.mkdir(parents=True, exist_ok=True)
    review_rows: list[dict] = []
    accepted: list[tuple[dict, Candidate]] = []
    makams_missing: set[str] = set()

    for row in rows:
        makam = row["makam"]
        stem = Path(row["pdf_path"]).stem
        makam_key = fold(makam).replace("_", "")
        pool_keys = MAKAM_ALIASES.get(makam_key, [makam_key])
        candidates_pool = [p for k in pool_keys for p in by_makam.get(k, [])] or None
        if candidates_pool is None:
            makams_missing.add(makam)
            review_rows.append({"neyzen": stem, "makam": makam, "tier": "no_symbtr_makam",
                                "score": "", "symbtr": "", "runner_up": "", "detail": ""})
            continue

        # Identity tokens = filename minus the makam's own words and noise suffixes.
        makam_toks = set(tokens(makam))
        neyzen_toks = [t for t in tokens(stem) if t not in makam_toks and t not in NOISE_TOKENS]

        scored = sorted((score_candidate(neyzen_toks, p) for p in candidates_pool),
                        key=lambda c: c.score, reverse=True)
        best = scored[0]
        runner = scored[1] if len(scored) > 1 else None
        margin = best.score - (runner.score if runner else 0.0)

        if best.score >= args.accept and margin >= args.margin:
            tier = "accept"
            accepted.append((row, best))
        elif best.score >= args.accept:
            tier = "review_ambiguous"
        elif best.score >= args.review:
            tier = "review"
        else:
            tier = "reject"

        review_rows.append({
            "neyzen": stem, "makam": makam, "tier": tier, "score": f"{best.score:.3f}",
            "symbtr": best.piece.path.stem, "detail": best.detail,
            "runner_up": f"{runner.piece.path.stem} ({runner.score:.3f})" if runner else "",
        })

    csv_path = OUT / "matches_review.csv"
    if args.apply_csv:
        # Trust the hand-reviewed CSV: export every row marked accept (however it got there).
        by_stem = {p.path.stem: p for p in pieces}
        by_key = {(Path(r["pdf_path"]).stem, r["makam"]): r for r in rows}
        accepted = []
        for r in csv.DictReader(open(args.apply_csv)):
            if r["tier"] != "accept":
                continue
            manifest_row = by_key.get((r["neyzen"], r["makam"]))
            piece = by_stem.get(r["symbtr"])
            if not manifest_row or not piece:
                print(f"  ⚠ skipping unresolvable CSV row: {r['neyzen']} -> {r['symbtr']}")
                continue
            accepted.append((manifest_row, Candidate(piece, float(r["score"] or 0), "from-csv")))
        print(f"apply-csv: {len(accepted)} accepted rows from {args.apply_csv}")
    else:
        with open(csv_path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["neyzen", "makam", "tier", "score", "symbtr", "detail", "runner_up"])
            w.writeheader()
            w.writerows(review_rows)

    if not args.apply_csv:
        tiers: dict[str, int] = {}
        for r in review_rows:
            tiers[r["tier"]] = tiers.get(r["tier"], 0) + 1
        print(f"\n{csv_path}: " + ", ".join(f"{k} {v}" for k, v in sorted(tiers.items())))
        if makams_missing:
            print(f"makams with no SymbTr counterpart: {', '.join(sorted(makams_missing))}")

    if args.dry_run:
        return 0

    # Export accepted matches: score.json (note model) + match.json; labels.json batched after.
    exported: list[Path] = []
    for row, cand in accepted:
        stem = Path(row["pdf_path"]).stem
        piece_dir = OUT / "matched" / row["makam"] / stem
        piece_dir.mkdir(parents=True, exist_ok=True)

        pages = sorted((REAL / "images" / row["makam"]).glob(f"{stem}_p*.png"))
        score = parse_file(cand.piece.path)
        score_json = piece_dir / "score.json"
        export_file(score, score_json)
        exported.append(score_json)

        match_meta = {
            "neyzen": {"stem": stem, "makam": row["makam"], "pdf": row["pdf_path"],
                       "url": row["url"], "pages": [str(p.relative_to(REPO)) for p in pages]},
            "symbtr": {"file": cand.piece.path.name, "makam": cand.piece.makam,
                       "form": cand.piece.form, "usul": cand.piece.usul,
                       "title": cand.piece.title, "composer": cand.piece.composer},
            "score": round(cand.score, 3),
            "detail": cand.detail,
        }
        (piece_dir / "match.json").write_text(json.dumps(match_meta, ensure_ascii=False, indent=1) + "\n")
        if not pages:
            print(f"  ⚠ no rasterized pages found for {stem} (pdf only)")

    print(f"exported {len(exported)} note models under {OUT / 'matched'}")

    # labels.json for every exported score, in chunked labels-cli calls (tsx startup is slow).
    CHUNK = 150
    for i in range(0, len(exported), CHUNK):
        chunk = exported[i : i + CHUNK]
        subprocess.run(["npx", "--yes", "tsx", "tools/render/labels-cli.ts", *map(str, chunk)],
                       cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        print(f"  labels {i + len(chunk)}/{len(exported)}")
    print("done — review tiers in matches_review.csv before trusting borderline pairs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
