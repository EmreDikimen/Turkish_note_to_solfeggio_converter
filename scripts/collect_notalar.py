#!/usr/bin/env python3
"""collect_notalar.py — download & rasterize Turkish sheet-music PDFs for Rung-3.

Real Rung-3 inputs are whole pages of PRINTED (engraved) notation. The big public
archives serve exactly that as makam-organised PDFs, which are cleaner than screenshots
(vector -> rasterise to any DPI) and match the model's engraved training domain.

Sources
  neyzen   neyzen.com classical archive — RELIABLE primary. 89 makam index pages, each
           linking direct .pdf files under /nota_arsivi/. robots.txt allows /makamlar/
           and /nota_arsivi/ (only /Sablonlar/ is denied, which we never touch — the
           makam list below was enumerated once, by hand, from the public menu).
  nota     notaarsivleri.com — OPT-IN, best-effort. Its search is JS/form-driven and its
           sitemap is thin, so this adapter samples piece pages and parses the makam +
           PDF link from each. Polite + tolerant; adds source variety, not exhaustive.

Weighting (the requirement: "more songs in a makam -> more weight")
  `census` counts how many pieces each makam has. `download` then allocates the download
  budget PROPORTIONALLY to those counts (largest-remainder rounding), with a floor so
  rare makams still appear (variety) and an optional cap. With no --max-total it just
  downloads everything, whose distribution is already proportional to song count.

Pipeline:  census  ->  download (weighted, polite, resumable)  ->  rasterize (PDF->PNG)

Examples
  python scripts/collect_notalar.py census
  python scripts/collect_notalar.py download --max-total 800 --min-per-makam 3
  python scripts/collect_notalar.py rasterize --dpi 200
  python scripts/collect_notalar.py all --max-total 800          # census+download+raster
  python scripts/collect_notalar.py all --nota --nota-limit 300  # add notaarsivleri too
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install requests")

# ----------------------------------------------------------------------------- config
REPO = Path(__file__).resolve().parent.parent
PDF_DIR = REPO / "data" / "real" / "pdfs"      # <source>/<makam>/<file>.pdf
IMG_DIR = REPO / "data" / "real" / "images"    # <makam>/<file>_pN.png
META_DIR = REPO / "data" / "real"
CENSUS_JSON = META_DIR / "census.json"
MANIFEST_CSV = META_DIR / "manifest.csv"

UA = "Mozilla/5.0 (compatible; tnc-rung3-collector/1.0; personal ML research; +local)"
NEYZEN_BASE = "https://neyzen.com/"

# 89 makam index pages, enumerated once from neyzen.com's public makam menu.
NEYZEN_MAKAM_PAGES = [
    "acem", "acem_asiran", "acem_buselik", "acem_kurdi", "arazbar", "arazbar_buselik",
    "askefza", "beste_isfahan", "bestenigar", "beyati", "beyati_araban",
    "beyati_araban_buselik", "beyati_buselik", "buselik", "buselik_asiran", "buzurk",
    "cargah", "dilkeshaveran", "dilkeside", "dugah", "evc", "evc_buselik", "evc_huzi",
    "evc_maye", "evcara", "ferahfeza", "ferahnak", "ferahnak_asiran", "gerdaniye",
    "gerdaniye_buselik", "gerdaniye_kurdi", "gulizar", "hicaz", "hicaz_asiran",
    "hicaz_buselik", "hicaz_humayun", "hicaz_zemzeme", "hicaz_zirgule", "hicazkar",
    "hisar", "hisar_buselik", "huseyni", "huseyni_asiran", "huseyni_zemzeme", "huzi",
    "huzzam", "irak", "isfahan", "karcigar", "kurdi", "kurdilihicazkar", "mahur",
    "mahur_buselik", "muhayyer", "muhayyer_buselik", "muhayyer_sunbule", "muhayyerkurdi",
    "mustear", "neva", "neva_buselik", "neva_kurdi", "neveser", "nihavend", "nikriz",
    "nisaburek", "nuhuft", "pencgah", "rast", "saba", "saba_buselik", "saba_zemzeme",
    "sazkar", "seddiaraban", "segah", "sehnaz", "sehnaz_buselik", "sevkefza", "sipihr",
    "sultaniyegah", "suzidil", "suzidilara", "suznak", "tahir", "tahir_buselik", "ussak",
    "uzzal", "yegah", "zavil", "zirguleli_suznak",
]

NOTA_SITEMAP = "https://www.notaarsivleri.com/sitemap.xml"
SEED = 1234  # reproducible sampling, matching the project's seeded-everything ethos


# --------------------------------------------------------------------------- utilities
def slugify(name: str) -> str:
    """ASCII-safe folder slug for a makam name (handles Turkish chars)."""
    name = name.strip().lower()
    name = (name.replace("ç", "c").replace("ğ", "g").replace("ı", "i")
                .replace("ö", "o").replace("ş", "s").replace("ü", "u").replace("â", "a"))
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = re.sub(r"[^a-z0-9]+", "_", name).strip("_")
    return name or "unknown"


def new_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    return s


def get(session: requests.Session, url: str, *, delay: float, binary: bool = False,
        tries: int = 3):
    """Polite GET: sleep(delay ± jitter) before each request, retry with backoff."""
    for attempt in range(tries):
        time.sleep(delay * (0.6 + random.random() * 0.8))
        try:
            r = session.get(url, timeout=30)
            if r.status_code == 200:
                return r.content if binary else r.text
            if r.status_code in (403, 429, 503):
                time.sleep(delay * (attempt + 2) * 2)  # back off harder
                continue
            return None
        except requests.RequestException:
            time.sleep(delay * (attempt + 1))
    return None


PDF_HREF_RE = re.compile(r'href="([^"]+\.pdf)"', re.IGNORECASE)


# ---------------------------------------------------------------------------- adapters
def census_neyzen(session, delay: float) -> dict[str, list[str]]:
    """makam-slug -> list of absolute PDF urls, by crawling the 89 makam pages."""
    out: dict[str, list[str]] = {}
    seen: set[str] = set()
    for i, page in enumerate(NEYZEN_MAKAM_PAGES, 1):
        url = urljoin(NEYZEN_BASE, f"makamlar/{page}.html")
        html = get(session, url, delay=delay)
        makam = slugify(page)
        pdfs = []
        if html:
            for href in PDF_HREF_RE.findall(html):
                absu = urljoin(url, href)
                if "neyzen.com" in absu and absu not in seen:
                    seen.add(absu)
                    pdfs.append(absu)
        out.setdefault(makam, []).extend(pdfs)
        print(f"  [neyzen {i:>2}/89] {makam:<22} {len(pdfs):>3} pdfs", file=sys.stderr)
    return {k: v for k, v in out.items() if v}


NOTA_MAKAM_RE = re.compile(r"[Mm]akam[^A-Za-zÇĞİÖŞÜçğıöşü]{0,12}"
                           r"([A-Za-zÇĞİÖŞÜçğıöşü][\wÇĞİÖŞÜçğıöşü \-]{2,30})")
NOTA_PDF_RE = re.compile(r'href="([^"]*NotaMuzik/[^"]+\.pdf)"', re.IGNORECASE)
NOTA_PIECE_RE = re.compile(r"turk-sanat-muzigi/\d+\.html", re.IGNORECASE)


def census_nota(session, delay: float, limit: int) -> dict[str, list[str]]:
    """Best-effort sample of notaarsivleri: sitemap -> piece pages -> (makam, pdf)."""
    sm = get(session, NOTA_SITEMAP, delay=delay)
    pieces = []
    if sm:
        pieces = sorted(set(re.findall(NOTA_PIECE_RE, sm)))
    if not pieces:
        print("  [nota] no piece URLs discoverable from sitemap; skipping", file=sys.stderr)
        return {}
    random.Random(SEED).shuffle(pieces)
    out: dict[str, list[str]] = {}
    n = 0
    for rel in pieces:
        if n >= limit:
            break
        url = urljoin("https://www.notaarsivleri.com/", rel)
        html = get(session, url, delay=delay)
        if not html:
            continue
        pdfm = NOTA_PDF_RE.search(html)
        makm = NOTA_MAKAM_RE.search(html)
        if not pdfm or not makm:
            continue
        makam = slugify(makm.group(1))
        out.setdefault(makam, []).append(urljoin(url, pdfm.group(1)))
        n += 1
        if n % 20 == 0:
            print(f"  [nota] sampled {n}/{limit} pieces", file=sys.stderr)
    return {k: v for k, v in out.items() if v}


# --------------------------------------------------------------------------- weighting
def build_plan(census: dict, sources: dict, max_total, min_per: int, cap) -> dict:
    """Allocate download counts per makam PROPORTIONAL to available song count.

    Returns {makam: n_to_download}. Uses largest-remainder rounding so the totals
    add up exactly. min_per gives rare makams a floor (variety); cap limits any one.
    """
    avail = {m: len(urls) for m, urls in census.items()}
    cap_m = lambda m: min(avail[m], cap) if cap else avail[m]   # per-makam hard ceiling
    if max_total is None:                         # download everything (up to cap)
        return {m: cap_m(m) for m in avail}

    total_avail = sum(cap_m(m) for m in avail)
    budget = min(max_total, total_avail)
    # 1) variety floor first (a rare makam can't exceed its own ceiling)
    floor = {m: min(min_per, cap_m(m)) for m in avail}
    base = sum(floor.values())
    if base >= budget:                            # floors already fill the budget
        return floor                              # variety wins; budget softly exceeded
    # 2) split the REMAINDER proportionally to song count (headroom-limited)
    extra = budget - base
    headroom = {m: cap_m(m) - floor[m] for m in avail}
    tw = sum(avail.values())
    ideal_extra = {m: extra * avail[m] / tw for m in avail}
    alloc = {m: floor[m] + min(int(ideal_extra[m]), headroom[m]) for m in avail}
    # 3) largest-remainder to hit the budget exactly
    remaining = budget - sum(alloc.values())
    order = sorted(avail, key=lambda m: ideal_extra[m] - int(ideal_extra[m]), reverse=True)
    i = 0
    while remaining > 0 and any(alloc[m] < cap_m(m) for m in avail):
        m = order[i % len(order)]
        if alloc[m] < cap_m(m):
            alloc[m] += 1
            remaining -= 1
        i += 1
    return alloc


def print_plan(census: dict, plan: dict) -> None:
    rows = sorted(plan.items(), key=lambda kv: -len(census[kv[0]]))
    total_a = sum(len(v) for v in census.values())
    total_s = sum(plan.values())
    print(f"\n{'makam':<24}{'available':>10}{'selected':>10}{'weight%':>9}")
    print("-" * 53)
    for m, sel in rows:
        av = len(census[m])
        print(f"{m:<24}{av:>10}{sel:>10}{100*sel/max(total_s,1):>8.1f}%")
    print("-" * 53)
    print(f"{'TOTAL':<24}{total_a:>10}{total_s:>10}{'':>9}  ({len(rows)} makams)\n")


# ----------------------------------------------------------------------------- actions
def do_census(args) -> dict:
    session = new_session()
    print("Census: crawling neyzen.com makam pages ...", file=sys.stderr)
    census: dict[str, list[str]] = {}
    for m, urls in census_neyzen(session, args.delay).items():
        census.setdefault(m, [])
        census[m] += [{"url": u, "source": "neyzen"} for u in urls]
    if args.nota:
        print("Census: sampling notaarsivleri.com ...", file=sys.stderr)
        for m, urls in census_nota(session, args.delay, args.nota_limit).items():
            census.setdefault(m, [])
            census[m] += [{"url": u, "source": "nota"} for u in urls]
    META_DIR.mkdir(parents=True, exist_ok=True)
    CENSUS_JSON.write_text(json.dumps(census, ensure_ascii=False, indent=1))
    total = sum(len(v) for v in census.values())
    print(f"\nCensus written: {CENSUS_JSON}  ({total} pieces, {len(census)} makams)")
    top = sorted(census.items(), key=lambda kv: -len(kv[1]))[:12]
    print("Top makams by piece count:")
    for m, v in top:
        print(f"  {m:<24}{len(v):>4}")
    return census


def load_census() -> dict:
    if not CENSUS_JSON.exists():
        sys.exit(f"No census at {CENSUS_JSON} — run `census` first.")
    return json.loads(CENSUS_JSON.read_text())


def do_download(args) -> None:
    census = load_census()
    plan = build_plan(census, {}, args.max_total, args.min_per_makam, args.cap_per_makam)
    print_plan(census, plan)
    if args.plan_only:
        return
    session = new_session()
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    manifest_new = not MANIFEST_CSV.exists()
    mf = open(MANIFEST_CSV, "a", newline="")
    w = csv.writer(mf)
    if manifest_new:
        w.writerow(["makam", "source", "pdf_path", "url"])
    got = skipped = failed = 0
    for makam, nsel in plan.items():
        entries = list(census[makam])
        rng.shuffle(entries)
        for e in entries[:nsel]:
            url, source = e["url"], e["source"]
            fname = Path(urlparse(url).path).name
            dest = PDF_DIR / source / makam / fname
            if dest.exists() and dest.stat().st_size > 0:
                skipped += 1
                continue
            data = get(session, url, delay=args.delay, binary=True)
            if not data or not data[:4] == b"%PDF":
                failed += 1
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            w.writerow([makam, source, str(dest.relative_to(REPO)), url])
            mf.flush()
            got += 1
            if got % 25 == 0:
                print(f"  downloaded {got} (skip {skipped}, fail {failed})", file=sys.stderr)
    mf.close()
    print(f"\nDownload done: {got} new, {skipped} already present, {failed} failed.")
    print(f"PDFs under {PDF_DIR}, manifest {MANIFEST_CSV}")


def _rasterizer(dpi: int):
    """Return a fn(pdf_path, out_stem)->n_pages using the first backend available."""
    try:
        import fitz  # PyMuPDF — self-contained, no system poppler needed

        def render(pdf: Path, stem: Path) -> int:
            doc = fitz.open(pdf)
            m = fitz.Matrix(dpi / 72, dpi / 72)
            for i, page in enumerate(doc, 1):
                out = stem.with_name(f"{stem.name}_p{i}.png")
                if not out.exists():
                    page.get_pixmap(matrix=m).save(out)
            n = doc.page_count
            doc.close()
            return n
        return render, "PyMuPDF"
    except ImportError:
        pass
    import shutil
    if shutil.which("pdftoppm"):
        import subprocess

        def render(pdf: Path, stem: Path) -> int:
            subprocess.run(["pdftoppm", "-png", "-r", str(dpi), str(pdf),
                            str(stem.with_name(stem.name + "_p"))], check=True)
            return len(list(stem.parent.glob(stem.name + "_p*.png")))
        return render, "pdftoppm"
    sys.exit("No PDF rasteriser found. Install one:  pip install pymupdf")


def do_rasterize(args) -> None:
    render, backend = _rasterizer(args.dpi)
    print(f"Rasterising with {backend} @ {args.dpi} dpi ...", file=sys.stderr)
    pdfs = sorted(PDF_DIR.rglob("*.pdf"))
    if not pdfs:
        sys.exit(f"No PDFs under {PDF_DIR} — run `download` first.")
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    pages = 0
    for i, pdf in enumerate(pdfs, 1):
        makam = pdf.parent.name
        stem = IMG_DIR / makam / pdf.stem
        stem.parent.mkdir(parents=True, exist_ok=True)
        try:
            pages += render(pdf, stem)
        except Exception as exc:  # tolerate the odd corrupt PDF
            print(f"  ! {pdf.name}: {exc}", file=sys.stderr)
        if i % 50 == 0:
            print(f"  {i}/{len(pdfs)} pdfs -> {pages} pages", file=sys.stderr)
    print(f"\nRasterise done: {len(pdfs)} pdfs -> {pages} page images under {IMG_DIR}")


def do_all(args) -> None:
    do_census(args)
    do_download(args)
    do_rasterize(args)


# -------------------------------------------------------------------------------- main
def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_common(sp):
        sp.add_argument("--delay", type=float, default=1.0,
                        help="polite base delay (s) between requests (default 1.0)")
        sp.add_argument("--nota", action="store_true",
                        help="also sample notaarsivleri.com (best-effort, slower)")
        sp.add_argument("--nota-limit", type=int, default=300,
                        help="max notaarsivleri piece pages to sample (default 300)")

    sp = sub.add_parser("census", help="count pieces per makam -> census.json")
    add_common(sp)
    sp.set_defaults(func=do_census)

    def add_weight(sp):
        sp.add_argument("--max-total", type=int, default=None,
                        help="download budget; split proportionally to song count "
                             "(omit = download everything)")
        sp.add_argument("--min-per-makam", type=int, default=0,
                        help="floor per makam so rare ones still appear (variety)")
        sp.add_argument("--cap-per-makam", type=int, default=None,
                        help="optional cap per makam")
        sp.add_argument("--plan-only", action="store_true",
                        help="print the weighted plan and exit (no downloads)")

    sp = sub.add_parser("download", help="weighted, polite, resumable PDF download")
    add_common(sp); add_weight(sp)
    sp.set_defaults(func=do_download)

    sp = sub.add_parser("rasterize", help="PDF -> PNG page images")
    sp.add_argument("--dpi", type=int, default=200, help="render DPI (default 200)")
    sp.set_defaults(func=do_rasterize)

    sp = sub.add_parser("all", help="census -> download -> rasterize")
    add_common(sp); add_weight(sp)
    sp.add_argument("--dpi", type=int, default=200, help="render DPI (default 200)")
    sp.set_defaults(func=do_all)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
