#!/usr/bin/env python3
"""Targeted tuplet collection (docs/RUNG3.md "Tuplet training gap", 2026-07-17).

The exam holds 4 \\tup3 gold tokens and the training manifest ~14 tup3 rows; real
triplet data is depleted. `find_tuplet_pieces.py` ranked all tuplet-bearing SymbTr
pieces and crossed them with the match state; this script COLLECTS the uncollected
ones from both sources:

  nota    the review-tier tuplet candidates in tuplet_pieces.csv are promoted to
          tier=accept in nota_matches.csv (documented promotion path; wrong matches
          only cost yield — emit content alignment rejects them, never poisons
          labels) and downloaded through collect_nota.do_download (resumable —
          existing accepts are skipped).
  neyzen  the ~7.6k census PDFs never downloaded (the 798-pdf round was
          makam-weighted, not exhaustive) are name-scored against the FULL SymbTr
          makam pool (so the margin guard sees real runner-ups); rows whose BEST
          match is a tuplet-bearing piece are downloaded at the chosen tier.

Subcommands (state under data/real/rung3/, all resumable):
  match      score undownloaded neyzen census rows -> tuplet_neyzen_matches.csv
  download   nota tier-flip + download both sources' new tuplet pieces (+rasterize)
  export     matched/<makam>/<stem>/{match.json,score.json,labels.json} for the
             NEW pieces only (does not touch the 964 existing exports)

Usage:
    python scripts/rung3/collect_tuplets.py match
    python scripts/rung3/collect_tuplets.py download [--neyzen-accept 0.85]
    python scripts/rung3/collect_tuplets.py export
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "scripts"))
sys.path.insert(0, str(REPO / "scripts" / "rung3"))
sys.path.insert(0, str(REPO / "src"))

from collect_notalar import _rasterizer, get, new_session  # noqa: E402
from match_symbtr import (  # noqa: E402
    MAKAM_ALIASES, SymbTrPiece, fold, score_candidate, tokens,
)

REAL = REPO / "data" / "real"
OUT = REAL / "rung3"
TUPLETS_P = OUT / "tuplet_pieces.csv"
NEY_MATCHES_P = OUT / "tuplet_neyzen_matches.csv"
MANIFEST_P = REAL / "manifest.csv"


def tuplet_rows() -> list[dict]:
    return list(csv.DictReader(TUPLETS_P.open()))


def nota_targets() -> list[dict]:
    """The review-tier nota candidates find_tuplet_pieces.py surfaced."""
    return [r for r in tuplet_rows()
            if r["nota_tier"] == "review" and not r["nota_downloaded"]]


def load_symbtr(symbtr_dir: Path) -> dict[str, list[SymbTrPiece]]:
    by_makam: dict[str, list[SymbTrPiece]] = {}
    for path in sorted(symbtr_dir.glob("*.txt")):
        p = SymbTrPiece.from_path(path)
        if p:
            by_makam.setdefault(p.makam, []).append(p)
    return by_makam


# ------------------------------------------------------------------------------- match
def do_match(args) -> None:
    tuplet_stems = {r["symbtr"] for r in tuplet_rows()}
    by_makam = load_symbtr(args.symbtr_dir)
    census = json.loads((REAL / "census.json").read_text())
    downloaded_urls = {r["url"] for r in csv.DictReader(MANIFEST_P.open())}

    out_rows: list[dict] = []
    tiers: dict[str, int] = {}
    for makam, entries in sorted(census.items()):
        makam_key = fold(makam).replace("_", "")
        pool = [p for k in MAKAM_ALIASES.get(makam_key, [makam_key])
                for p in by_makam.get(k, [])]
        if not pool:
            continue
        makam_toks = set(tokens(makam))
        for e in entries:
            if e.get("source") != "neyzen" or e["url"] in downloaded_urls:
                continue
            stem = Path(urlparse(e["url"]).path).stem
            ney_toks = [t for t in tokens(stem) if t not in makam_toks]
            scored = sorted((score_candidate(ney_toks, p) for p in pool),
                            key=lambda c: c.score, reverse=True)
            best, runner = scored[0], (scored[1] if len(scored) > 1 else None)
            if best.piece.path.stem not in tuplet_stems:
                continue  # only tuplet-bearing pieces are targets here
            margin = best.score - (runner.score if runner else 0.0)
            if best.score >= args.accept and margin >= args.margin:
                tier = "accept"
            elif best.score >= args.review:
                tier = "review"
            else:
                continue
            tiers[tier] = tiers.get(tier, 0) + 1
            out_rows.append({
                "neyzen": stem, "makam": makam, "tier": tier,
                "score": f"{best.score:.3f}", "symbtr": best.piece.path.stem,
                "detail": best.detail, "url": e["url"],
                "runner_up": f"{runner.piece.path.stem} ({runner.score:.3f})" if runner else "",
            })

    out_rows.sort(key=lambda r: (r["tier"], -float(r["score"])))
    with NEY_MATCHES_P.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows
                           else ["neyzen", "makam", "tier", "score", "symbtr",
                                 "detail", "url", "runner_up"])
        w.writeheader()
        w.writerows(out_rows)
    print(f"{NEY_MATCHES_P}: " + (", ".join(f"{k} {v}" for k, v in sorted(tiers.items()))
                                  or "no tuplet matches"))


# ---------------------------------------------------------------------------- download
def flip_nota_tiers(targets: list[dict]) -> None:
    """Promote the tuplet candidates to tier=accept in nota_matches.csv (the documented
    promotion path — collect_nota download/export run off tier=accept)."""
    matches_p = OUT / "nota_matches.csv"
    ids = {r["nota_id"] for r in targets}
    rows = list(csv.DictReader(matches_p.open()))
    flipped = 0
    for r in rows:
        if r["id"] in ids and r["tier"] != "accept":
            r["tier"] = "accept"
            r["detail"] += "; tuplet-promoted 2026-07-17"
            flipped += 1
    if flipped:
        shutil.copy2(matches_p, matches_p.with_suffix(".csv.bak-tuplets"))
        with matches_p.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    print(f"nota_matches.csv: {flipped} rows promoted to accept "
          f"({len(ids) - flipped} were already)")


def do_download(args) -> None:
    # --- nota: tier-flip, then the standard resumable downloader ----------------
    targets = nota_targets()
    print(f"nota: {len(targets)} tuplet candidates")
    flip_nota_tiers(targets)
    import collect_nota
    collect_nota.do_download(argparse.Namespace(delay=args.delay, max_total=0, dpi=args.dpi))

    # --- neyzen: download + rasterize accepts from the tuplet match CSV ---------
    if not NEY_MATCHES_P.exists():
        sys.exit("run `match` first (no tuplet_neyzen_matches.csv)")
    ney = [r for r in csv.DictReader(NEY_MATCHES_P.open())
           if r["tier"] == "accept" or float(r["score"]) >= args.neyzen_accept]
    print(f"neyzen: {len(ney)} tuplet matches at/above --neyzen-accept {args.neyzen_accept}")
    session = new_session()
    render, backend = _rasterizer(args.dpi)
    known_urls = {r["url"] for r in csv.DictReader(MANIFEST_P.open())}
    n_new = n_skip = n_fail = 0
    for r in ney:
        fname = Path(urlparse(r["url"]).path).name
        dest = REAL / "pdfs" / "neyzen" / r["makam"] / fname
        img_stem = REAL / "images" / r["makam"] / dest.stem
        if dest.exists() and list(img_stem.parent.glob(f"{dest.stem}_p*.png")):
            n_skip += 1
            continue
        if not dest.exists():
            blob = get(session, r["url"], delay=args.delay, binary=True)
            if not blob or not blob.startswith(b"%PDF"):
                print(f"  ⚠ bad/missing PDF: {r['url']}")
                n_fail += 1
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(blob)
        img_stem.parent.mkdir(parents=True, exist_ok=True)
        try:
            render(dest, img_stem)
        except Exception as e:  # noqa: BLE001 — one corrupt PDF must not kill the run
            print(f"  ⚠ rasterize failed for {dest.name}: {e}")
            n_fail += 1
            continue
        if r["url"] not in known_urls:
            with MANIFEST_P.open("a", newline="") as f:
                csv.writer(f).writerow(
                    [r["makam"], "neyzen", str(dest.relative_to(REPO)), r["url"]])
            known_urls.add(r["url"])
        n_new += 1
    print(f"neyzen download done: +{n_new} new, {n_skip} already, {n_fail} failed")


# ------------------------------------------------------------------------------ export
def do_export(args) -> None:
    from symbtr.parser import parse_file
    from symbtr.export_json import export_file

    by_stem = {p.path.stem: p
               for ps in load_symbtr(args.symbtr_dir).values() for p in ps}
    exported: list[Path] = []

    def export_piece(piece_dir: Path, source_key: str, source_meta: dict,
                     sym: SymbTrPiece, score: float, detail: str) -> None:
        piece_dir.mkdir(parents=True, exist_ok=True)
        score_json = piece_dir / "score.json"
        export_file(parse_file(sym.path), score_json)
        exported.append(score_json)
        (piece_dir / "match.json").write_text(json.dumps({
            source_key: source_meta,
            "symbtr": {"file": sym.path.name, "makam": sym.makam, "form": sym.form,
                       "usul": sym.usul, "title": sym.title, "composer": sym.composer},
            "score": score, "detail": detail,
        }, ensure_ascii=False, indent=1) + "\n")

    # --- nota pieces ------------------------------------------------------------
    downloads = json.loads((OUT / "nota_downloads.json").read_text())
    nota_by_id = {r["id"]: r for r in csv.DictReader((OUT / "nota_matches.csv").open())}
    n_missing = 0
    for t in nota_targets():
        dl = downloads.get(t["nota_id"])
        m = nota_by_id.get(t["nota_id"])
        sym = by_stem.get(t["symbtr"])
        if not dl or not m or not sym:
            n_missing += 1
            continue
        makam, stem = dl["makam"], dl["stem"]
        pages = sorted((REAL / "images" / makam).glob(f"{stem}_p*.png"))
        if not pages:
            n_missing += 1
            continue
        export_piece(
            OUT / "matched" / makam / stem, "nota",
            {"stem": stem, "makam": makam, "pdf": dl["pdf"], "url": m["url"],
             "pages": [str(p.relative_to(REPO)) for p in pages],
             "catalog": {k: m[k] for k in ("id", "title", "makam", "composer", "form", "usul")}},
            sym, float(m["score"]), m["detail"])
    print(f"nota: exported {len(exported)} pieces"
          + (f" ({n_missing} not downloaded)" if n_missing else ""))

    # --- neyzen pieces ----------------------------------------------------------
    n_nota = len(exported)
    if NEY_MATCHES_P.exists():
        for r in csv.DictReader(NEY_MATCHES_P.open()):
            fname = Path(urlparse(r["url"]).path)
            stem, makam = fname.stem, r["makam"]
            pdf = REAL / "pdfs" / "neyzen" / makam / fname.name
            pages = sorted((REAL / "images" / makam).glob(f"{stem}_p*.png"))
            sym = by_stem.get(r["symbtr"])
            if not pdf.exists() or not pages or not sym:
                continue  # not downloaded (review tier, failed, …)
            export_piece(
                OUT / "matched" / makam / stem, "neyzen",
                {"stem": stem, "makam": makam, "pdf": str(pdf.relative_to(REPO)),
                 "url": r["url"], "pages": [str(p.relative_to(REPO)) for p in pages]},
                sym, float(r["score"]), r["detail"])
    print(f"neyzen: exported {len(exported) - n_nota} pieces")

    CHUNK = 150
    for i in range(0, len(exported), CHUNK):
        chunk = exported[i: i + CHUNK]
        subprocess.run(["npx", "--yes", "tsx", "tools/render/labels-cli.ts", *map(str, chunk)],
                       cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        print(f"  labels {i + len(chunk)}/{len(exported)}")
    print(f"export done: {len(exported)} new matched/ pieces")


# -------------------------------------------------------------------------------- main
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    symbtr_default = Path.home() / "Downloads" / "SymbTr-2.0.0" / "txt"

    sp = sub.add_parser("match", help="score undownloaded neyzen census vs tuplet SymbTr")
    sp.add_argument("--symbtr-dir", type=Path, default=symbtr_default)
    sp.add_argument("--accept", type=float, default=0.85)
    sp.add_argument("--review", type=float, default=0.60)
    sp.add_argument("--margin", type=float, default=0.05)

    sp = sub.add_parser("download", help="download both sources' new tuplet pieces")
    sp.add_argument("--delay", type=float, default=1.2)
    sp.add_argument("--dpi", type=int, default=200)
    sp.add_argument("--neyzen-accept", type=float, default=0.85,
                    help="download neyzen rows at/above this score (accept tier always)")

    sp = sub.add_parser("export", help="write matched/ dirs for the new pieces")
    sp.add_argument("--symbtr-dir", type=Path, default=symbtr_default)

    args = ap.parse_args()
    {"match": do_match, "download": do_download, "export": do_export}[args.cmd](args)


if __name__ == "__main__":
    main()
