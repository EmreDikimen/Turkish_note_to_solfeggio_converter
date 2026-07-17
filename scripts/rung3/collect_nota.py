#!/usr/bin/env python3
"""notaarsivleri.com — SymbTr-FIRST collection (Rung 3 step 1b, docs/RUNG3.md §1b).

Inverts the neyzen order: census the TSM CATALOG (real title/makam/composer/form/usul
columns) → match against SymbTr on METADATA → download ONLY the matched pieces. Every
downloaded page then arrives pre-labeled, in a second engraving style.

Site shape (recon 2026-07-15): the TSM catalog is plain paginated HTML —
/turk-sanat-muzigi-N.html, ~100 rows/page, ~211 pages (~21k pieces), columns
Eser Adı / Makamı / Bestekarı / Söz Yazarı / Formu / Usulü, each row linking
/turk-sanat-muzigi/<id>.html whose page carries one direct NotaMuzik/<slug>.pdf link.
Pages are ISO-8859-9; robots.txt is absent (302 → error page; checked 2026-07-11 + today).
THM/folk is a separate section we never touch (numbered bemol-2/3 signs, no tokens).

Subcommands (each resumable, all state under data/real/rung3/):
  census    crawl the catalog listing -> nota_census.json  (~211 polite requests, NO piece
            pages fetched)
  match     score census rows against SymbTr metadata -> nota_matches.csv
            (tiers accept / review_ambiguous / review / reject; same thresholds as
            match_symbtr.py; hand-promote review rows by flipping tier, like neyzen)
  download  tier=accept rows (optionally --max-total, accept-score order): piece page ->
            PDF -> data/real/pdfs/nota/<makam>/<slug>_nota.pdf, rasterize ->
            data/real/images/<makam>/<slug>_nota_pN.png, append data/real/manifest.csv
  export    matched/<makam>/<stem>_nota/{match.json("nota" source),score.json,labels.json}
            for downloaded accepts — the exact shape emit_strip_labels.py consumes

Run the slicer spot-check BEFORE the mass download (the 2026-07-13 timebox decision):
    python scripts/rung3/collect_nota.py census
    python scripts/rung3/collect_nota.py match
    python scripts/rung3/collect_nota.py download --max-total 12   # spot-check batch
    .venv-ml/bin/python src/vision/page_to_strips.py data/real/images/<makam>/<page>.png --debug
    python scripts/rung3/collect_nota.py download                  # the rest
    python scripts/rung3/collect_nota.py export
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "scripts"))          # collect_notalar helpers
sys.path.insert(0, str(REPO / "scripts" / "rung3"))  # match_symbtr scoring
sys.path.insert(0, str(REPO / "src"))

from collect_notalar import get, new_session, slugify, _rasterizer  # noqa: E402
from match_symbtr import (  # noqa: E402
    MAKAM_ALIASES, SymbTrPiece, fold, set_score, tokens,
)

BASE = "https://www.notaarsivleri.com"
REAL = REPO / "data" / "real"
OUT = REAL / "rung3"
CENSUS_P = OUT / "nota_census.json"
MATCHES_P = OUT / "nota_matches.csv"
DOWNLOADS_P = OUT / "nota_downloads.json"   # census id -> {stem, makam, pdf, pdf_url}

PAGE_MAX_RE = re.compile(r"turk-sanat-muzigi-(\d+)\.html")
ROW_RE = re.compile(
    r"href='/turk-sanat-muzigi/(\d+)\.html'.*?"
    r'<div class="tablo_500">([^<]*)</div>\s*'
    r'<div class="tablo_200">([^<]*)</div>\s*'
    r'<div class="tablo_200">([^<]*)</div>\s*'
    r'<div class="tablo_250">([^<]*)</div>\s*'
    r'<div class="tablo_200">([^<]*)</div>\s*'
    r'<div class="tablo_200">([^<]*)</div>',
    re.S,
)
NOTA_PDF_RE = re.compile(r'href="([^"]*NotaMuzik/[^"]+\.pdf)"', re.IGNORECASE)


def fetch_html(session, url: str, delay: float) -> str | None:
    """The site serves ISO-8859-9 with unreliable headers — decode from bytes ourselves."""
    raw = get(session, url, delay=delay, binary=True)
    return raw.decode("iso-8859-9", errors="replace") if raw else None


# ------------------------------------------------------------------------------ census
def do_census(args) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    state = json.loads(CENSUS_P.read_text()) if CENSUS_P.exists() else {"pages_done": [], "rows": {}}
    done = set(state["pages_done"])
    session = new_session()

    first = fetch_html(session, f"{BASE}/turk-sanat-muzigi.html", args.delay)
    if not first:
        sys.exit("cannot fetch the TSM catalog index")
    last_page = max((int(n) for n in PAGE_MAX_RE.findall(first)), default=0)
    if not last_page:
        sys.exit("no pagination found on the catalog index — site layout changed?")
    print(f"catalog: {last_page} pages (~{last_page * 100} pieces); "
          f"{len(done)} pages already censused")

    for n in range(1, last_page + 1):
        if n in done:
            continue
        html = first if n == 1 else fetch_html(session, f"{BASE}/turk-sanat-muzigi-{n}.html", args.delay)
        if not html:
            print(f"  page {n}: fetch failed, will retry on next run", file=sys.stderr)
            continue
        rows = ROW_RE.findall(html)
        if not rows:
            print(f"  page {n}: 0 rows parsed — check layout", file=sys.stderr)
            continue
        for pid, title, makam, composer, lyricist, form, usul in rows:
            state["rows"][pid] = {
                "id": int(pid), "url": f"{BASE}/turk-sanat-muzigi/{pid}.html",
                "title": title.strip(), "makam": makam.strip(), "composer": composer.strip(),
                "lyricist": lyricist.strip(), "form": form.strip(), "usul": usul.strip(),
            }
        state["pages_done"].append(n)
        if n % 10 == 0 or n == last_page:
            CENSUS_P.write_text(json.dumps(state, ensure_ascii=False))
            print(f"  page {n}/{last_page}  ({len(state['rows'])} pieces)")
    CENSUS_P.write_text(json.dumps(state, ensure_ascii=False))
    print(f"census: {len(state['rows'])} pieces -> {CENSUS_P}")


# ------------------------------------------------------------------------------- match
def score_row(row: dict, piece: SymbTrPiece) -> tuple[float, str]:
    """Metadata-vs-metadata score (far cleaner than neyzen's filename fuzzing): title is
    the identity, composer confirms, form/usul are cheap corroboration bonuses."""
    cat_title = tokens(row["title"])
    cat_comp = tokens(row["composer"])
    title_s, title_n = set_score(piece.title_toks, cat_title)
    comp_s, comp_n = set_score(piece.composer_toks, cat_comp)
    form_hit = fold(row["form"]).replace(" ", "") == fold(piece.form).replace("_", "")
    usul_hit = fold(row["usul"]).replace(" ", "") == fold(piece.usul).replace("_", "")

    if piece.title_toks:
        score = 0.70 * title_s + 0.20 * comp_s + 0.05 * form_hit + 0.05 * usul_hit
        if title_n < 2 and len(piece.title_toks) >= 2:
            score *= 0.6
        detail = (f"title {title_s:.2f} ({title_n}/{len(piece.title_toks)}), "
                  f"composer {comp_s:.2f}, form={'y' if form_hit else 'n'}, "
                  f"usul={'y' if usul_hit else 'n'}")
    else:
        # Instrumental (SymbTr title empty): composer + form + usul carry the identity.
        score = 0.60 * comp_s + 0.25 * form_hit + 0.15 * usul_hit
        if comp_n == 0:
            score = 0.0
        detail = (f"composer {comp_s:.2f} ({comp_n}/{len(piece.composer_toks)}), "
                  f"form={'y' if form_hit else 'n'}, usul={'y' if usul_hit else 'n'}")
    return score, detail


def do_match(args) -> None:
    state = json.loads(CENSUS_P.read_text())
    rows = sorted(state["rows"].values(), key=lambda r: r["id"])
    print(f"census: {len(rows)} pieces")

    pieces: list[SymbTrPiece] = []
    for path in sorted(args.symbtr_dir.glob("*.txt")):
        p = SymbTrPiece.from_path(path)
        if p:
            pieces.append(p)
    by_makam: dict[str, list[SymbTrPiece]] = {}
    for p in pieces:
        by_makam.setdefault(p.makam, []).append(p)
    print(f"SymbTr: {len(pieces)} pieces, {len(by_makam)} makams")

    out_rows: list[dict] = []
    tiers: dict[str, int] = {}
    for row in rows:
        makam_key = fold(row["makam"]).replace("_", "").replace(" ", "")
        pool_keys = MAKAM_ALIASES.get(makam_key, [makam_key])
        pool = [p for k in pool_keys for p in by_makam.get(k, [])]
        if not pool:
            tier, best, runner, score, detail = "no_symbtr_makam", None, None, 0.0, ""
        else:
            scored = sorted(((*score_row(row, p), p) for p in pool),
                            key=lambda t: t[0], reverse=True)
            score, detail, best = scored[0]
            runner = scored[1] if len(scored) > 1 else None
            margin = score - (runner[0] if runner else 0.0)
            if score >= args.accept and margin >= args.margin:
                tier = "accept"
            elif score >= args.accept:
                tier = "review_ambiguous"
            elif score >= args.review:
                tier = "review"
            else:
                tier = "reject"
        tiers[tier] = tiers.get(tier, 0) + 1
        out_rows.append({
            "id": row["id"], "tier": tier, "score": f"{score:.3f}",
            "title": row["title"], "makam": row["makam"], "composer": row["composer"],
            "form": row["form"], "usul": row["usul"],
            "symbtr": best.path.stem if best else "",
            "runner_up": f"{runner[2].path.stem} ({runner[0]:.3f})" if runner else "",
            "detail": detail, "url": row["url"],
        })

    with MATCHES_P.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader()
        w.writerows(out_rows)
    print(f"{MATCHES_P}: " + ", ".join(f"{k} {v}" for k, v in sorted(tiers.items())))


# ---------------------------------------------------------------------------- download
def accepted_rows() -> list[dict]:
    rows = [r for r in csv.DictReader(MATCHES_P.open()) if r["tier"] == "accept"]
    rows.sort(key=lambda r: (-float(r["score"]), int(r["id"])))
    return rows


def stem_of(pdf_url: str) -> str:
    return slugify(Path(pdf_url).stem) + "_nota"


def do_download(args) -> None:
    rows = accepted_rows()
    if args.max_total:
        rows = rows[: args.max_total]
    print(f"downloading {len(rows)} accepted pieces (score-desc)")
    session = new_session()
    render, backend = _rasterizer(args.dpi)
    print(f"rasterizer: {backend} @ {args.dpi} dpi")

    downloads = json.loads(DOWNLOADS_P.read_text()) if DOWNLOADS_P.exists() else {}
    manifest_p = REAL / "manifest.csv"
    known_urls = {r["url"] for r in csv.DictReader(manifest_p.open())} if manifest_p.exists() else set()
    n_new = n_skip = n_fail = 0

    for i, r in enumerate(rows, 1):
        makam = slugify(r["makam"])
        # resumable: the downloads map records finished pieces (pdf + rasterized pages)
        prev = downloads.get(str(r["id"]))
        if prev and (REPO / prev["pdf"]).exists() \
                and list((REAL / "images" / prev["makam"]).glob(f"{prev['stem']}_p*.png")):
            n_skip += 1
            continue
        html = fetch_html(session, r["url"], args.delay)
        if not html:
            n_fail += 1
            continue
        m = NOTA_PDF_RE.search(html)
        if not m:
            print(f"  ⚠ no PDF link on {r['url']}")
            n_fail += 1
            continue
        pdf_url = m.group(1)
        if not pdf_url.startswith("http"):
            pdf_url = BASE + "/" + pdf_url.lstrip("/")
        stem = stem_of(pdf_url)
        pdf_path = REAL / "pdfs" / "nota" / makam / f"{stem}.pdf"
        img_stem = REAL / "images" / makam / stem
        if not pdf_path.exists():
            blob = get(session, pdf_url, delay=args.delay, binary=True)
            if not blob or not blob.startswith(b"%PDF"):
                print(f"  ⚠ bad/missing PDF: {pdf_url}")
                n_fail += 1
                continue
            pdf_path.parent.mkdir(parents=True, exist_ok=True)
            pdf_path.write_bytes(blob)
        img_stem.parent.mkdir(parents=True, exist_ok=True)
        try:
            render(pdf_path, img_stem)
        except Exception as e:  # noqa: BLE001 — a corrupt PDF must not kill the crawl
            print(f"  ⚠ rasterize failed for {pdf_path.name}: {e}")
            n_fail += 1
            continue
        downloads[str(r["id"])] = {"stem": stem, "makam": makam,
                                   "pdf": str(pdf_path.relative_to(REPO)), "pdf_url": pdf_url}
        DOWNLOADS_P.write_text(json.dumps(downloads, ensure_ascii=False, indent=1))
        if pdf_url not in known_urls:
            with manifest_p.open("a", newline="") as f:
                w = csv.DictWriter(f, fieldnames=["makam", "source", "pdf_path", "url"])
                w.writerow({"makam": makam, "source": "nota",
                            "pdf_path": str(pdf_path.relative_to(REPO)), "url": pdf_url})
            known_urls.add(pdf_url)
        n_new += 1
        if i % 10 == 0:
            print(f"  {i}/{len(rows)}  (+{n_new} new, {n_skip} already, {n_fail} failed)")
    print(f"download done: +{n_new} new, {n_skip} already present, {n_fail} failed")


# ------------------------------------------------------------------------------ export
def do_export(args) -> None:
    from symbtr.parser import parse_file
    from symbtr.export_json import export_file

    by_stem = {p.stem: p for p in sorted(args.symbtr_dir.glob("*.txt"))}
    downloads = json.loads(DOWNLOADS_P.read_text()) if DOWNLOADS_P.exists() else {}
    exported: list[Path] = []
    missing = 0
    for r in accepted_rows():
        sym = by_stem.get(r["symbtr"])
        if sym is None:
            print(f"  ⚠ SymbTr file gone: {r['symbtr']}")
            continue
        dl = downloads.get(str(r["id"]))
        if dl is None:
            missing += 1
            continue
        makam, stem = dl["makam"], dl["stem"]
        pdf_path = REPO / dl["pdf"]
        pages = sorted((REAL / "images" / makam).glob(f"{stem}_p*.png"))
        if not pages:
            missing += 1
            continue
        piece_dir = OUT / "matched" / makam / stem
        piece_dir.mkdir(parents=True, exist_ok=True)
        score_json = piece_dir / "score.json"
        export_file(parse_file(sym), score_json)
        exported.append(score_json)
        sp = SymbTrPiece.from_path(sym)
        (piece_dir / "match.json").write_text(json.dumps({
            "nota": {"stem": stem, "makam": makam, "pdf": str(pdf_path.relative_to(REPO)),
                     "url": r["url"], "pages": [str(p.relative_to(REPO)) for p in pages],
                     "catalog": {k: r[k] for k in ("id", "title", "makam", "composer", "form", "usul")}},
            "symbtr": {"file": sym.name, "makam": sp.makam, "form": sp.form, "usul": sp.usul,
                       "title": sp.title, "composer": sp.composer},
            "score": float(r["score"]), "detail": r["detail"],
        }, ensure_ascii=False, indent=1) + "\n")

    print(f"exported {len(exported)} note models under {OUT / 'matched'}"
          + (f"  ({missing} accepts not downloaded yet)" if missing else ""))
    CHUNK = 150
    for i in range(0, len(exported), CHUNK):
        chunk = exported[i: i + CHUNK]
        subprocess.run(["npx", "--yes", "tsx", "tools/render/labels-cli.ts", *map(str, chunk)],
                       cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        print(f"  labels {i + len(chunk)}/{len(exported)}")


# -------------------------------------------------------------------------------- main
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add_common(sp):
        sp.add_argument("--delay", type=float, default=1.2, help="politeness delay (s)")

    sp = sub.add_parser("census", help="crawl the TSM catalog listing")
    add_common(sp)
    sp = sub.add_parser("match", help="score census rows against SymbTr")
    sp.add_argument("--symbtr-dir", type=Path,
                    default=Path.home() / "Downloads" / "SymbTr-2.0.0" / "txt")
    sp.add_argument("--accept", type=float, default=0.85)
    sp.add_argument("--review", type=float, default=0.60)
    sp.add_argument("--margin", type=float, default=0.05)
    sp = sub.add_parser("download", help="download + rasterize tier=accept pieces")
    add_common(sp)
    sp.add_argument("--max-total", type=int, default=0, help="0 = all accepts")
    sp.add_argument("--dpi", type=int, default=200)
    sp = sub.add_parser("export", help="write matched/<makam>/<stem>/ for downloaded accepts")
    sp.add_argument("--symbtr-dir", type=Path,
                    default=Path.home() / "Downloads" / "SymbTr-2.0.0" / "txt")

    args = ap.parse_args()
    {"census": do_census, "match": do_match, "download": do_download, "export": do_export}[args.cmd](args)


if __name__ == "__main__":
    main()
