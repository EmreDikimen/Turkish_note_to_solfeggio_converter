#!/usr/bin/env python3
"""Round 4 step 4 — the THIRD-SOURCE PROBE: does the model hold up on a third engraving house?

Every page this project owns comes from **two websites** — 1,055 neyzen.com + 1,000
notaarsivleri.com — and so does the exam (docs/BACKLOG.md item 10). So every accuracy number it
has ever produced carries an unstated limit: *on these two engraving houses*. This script collects
a small probe from three new sources, chosen because their engraving is measurably different:

  sahaney     www.sahaney.com          BORN-DIGITAL VECTOR, produced by **Mus2 2.1.2** — a Turkish
                                       makam notation program neither of our sources uses. 2,213
                                       PDFs behind a Ninja Tables endpoint carrying
                                       title/makam/form/usul/composer, so SymbTr can be matched on
                                       METADATA rather than on a filename.
  erdincbal   www.erdincbal.com        SCANS of TRT Müzik Dairesi publications, hosted on Google
                                       Drive, and — this is why it is here — its archives are
                                       indexed BY FORM: sirto, longa, pesrev, saz semaisi. Those
                                       are the tuplet-dense instrumentals docs/DECISIONS.md
                                       (2026-08-20) names as a measured structural hole.
  blogspot    sarkilarnotalar.blogspot HANDWRITTEN pages photographed/scanned to JPG (owner asked
                                       for this one by name, 2026-09-06). The hardest material in
                                       the probe and the furthest from anything we train on.

⛔ **THE PROBE IS NOT A CORPUS AND MUST NOT BECOME ONE.** Everything lands under
`data/real/rung3/_thirdsource/`. It is deliberately NOT written to `data/real/manifest.csv` and NOT
exported into `data/real/rung3/matched/`, because both are read by flows that build TRAINING pools
and the exam. A probe answers one question — does a third engraver break the model — and changing
the exam or the training mix mid-round would make the Round-3 read comparable to nothing.

⚠ **Licence.** Nothing here is redistributed; pages are read locally, exactly as neyzen.com and
notaarsivleri.com are (docs/THIRD-PARTY.md). erdincbal republishes TRT Müzik Dairesi editions, so
that material carries TRT's rights, not erdincbal's. None of these three serves a robots.txt
(checked 2026-09-06: TRT's own note library is behind a login and is therefore NOT collected).

Subcommands (each resumable; state under data/real/rung3/_thirdsource/):
  census    build the catalog for one source (or all) -> census_<source>.json
  match     score the census against SymbTr metadata  -> matches_<source>.csv
            (reuses collect_nota.score_row, so "accept" means what it means for notaarsivleri)
  download  fetch a chosen sample -> pdfs/<source>/<stem>.pdf|jpg, rasterize -> images/<stem>_pN.png

    python scripts/rung3/collect_thirdsource.py census --source all
    python scripts/rung3/collect_thirdsource.py match  --source all
    python scripts/rung3/collect_thirdsource.py download --source sahaney --max 14
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "scripts" / "rung3"))

from match_symbtr import MAKAM_ALIASES, SymbTrPiece, fold  # noqa: E402
from collect_nota import score_row  # noqa: E402


def makam_key(name: str) -> str:
    """SymbTr writes a makam as one word; these sites hyphenate and apostrophise it
    (`EVC-ÂRÂ`, `ACEM-KÜRDÎ`, `GÜL'İZÂR`). `fold` already handles the circumflexes; the
    separators have to go too or 216 of erdincbal's 685 rows never reach a candidate pool."""
    return re.sub(r"[^a-z0-9]", "", fold(name))

OUT = REPO / "data/real/rung3/_thirdsource"
UA = "Mozilla/5.0 (compatible; komavision-research/1.0; +mailto:dikimenemre@gmail.com)"
DELAY = 1.5           # polite: none of the three serves a robots.txt, so we set our own floor
SOURCES = ("sahaney", "erdincbal", "blogspot")

SAHANEY_NOTALAR = "https://www.sahaney.com/notalar/"
SAHANEY_AJAX = "https://www.sahaney.com/wp-admin/admin-ajax.php"
ERDINCBAL_ARCHIVES = {   # form -> archive page (the four tuplet-dense instrumental forms first)
    "Sirto": "https://www.erdincbal.com/sirto-nota-arsivi",
    "Longa": "https://www.erdincbal.com/longa-nota-arsivi",
    "Peşrev": "https://www.erdincbal.com/pesrev-nota-arsivi",
    "Saz semaisi": "https://www.erdincbal.com/saz-semaisi-nota-arsivi",
}
BLOGSPOT_FEED = ("https://sarkilarnotalar.blogspot.com/feeds/posts/default"
                 "?alt=json&max-results=150&start-index={i}")


def session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = UA
    return s


def get(s: requests.Session, url: str, **kw) -> requests.Response | None:
    time.sleep(DELAY)
    try:
        r = s.get(url, timeout=45, **kw)
        r.raise_for_status()
        return r
    except Exception as e:
        print(f"  ! {url[:90]}: {e}")
        return None


def slug(text: str) -> str:
    """ascii_ish lowercase underscore, the convention every other pool on disk uses."""
    t = (text.replace("ı", "i").replace("İ", "i").replace("ş", "s").replace("Ş", "s")
             .replace("ğ", "g").replace("Ğ", "g").replace("ç", "c").replace("Ç", "c")
             .replace("ö", "o").replace("Ö", "o").replace("ü", "u").replace("Ü", "u"))
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", t)).strip("_")[:80]


def strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


# ------------------------------------------------------------------------------------- census
def census_sahaney(s: requests.Session) -> list[dict]:
    page = get(s, SAHANEY_NOTALAR)
    if page is None:
        return []
    m = re.search(r"admin-ajax\.php\?(action=wp_ajax_ninja_tables_public_action[^\"]*)", page.text)
    if not m:
        print("  ! the Ninja Tables endpoint is gone — the page was rebuilt; re-recon it")
        return []
    r = get(s, f"{SAHANEY_AJAX}?{m.group(1).replace('&amp;', '&')}",
            headers={"Referer": SAHANEY_NOTALAR})
    if r is None:
        return []
    rows = []
    for entry in r.json():
        v = entry.get("value", {})
        pdf = re.search(r'href="([^"]+\.pdf)"', v.get("esernotalar") or "")
        if not pdf:
            continue
        rows.append({
            "id": f"sahaney:{v.get('___id___')}", "source": "sahaney",
            "title": (v.get("eserad") or "").strip(), "makam": (v.get("makam") or "").strip(),
            "composer": (v.get("beste") or "").strip(), "form": (v.get("form") or "").strip(),
            "usul": (v.get("usl") or "").strip(),
            "engraver": (v.get("notayazar") or "").strip(),
            "url": html.unescape(pdf.group(1)), "kind": "pdf",
        })
    return rows


ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S)


def census_erdincbal(s: requests.Session) -> list[dict]:
    """Each archive page is one WP table: ESER ADI | NOTA | MAKAM | GÜFTE | BESTE | USÛLÜ | ..."""
    rows = []
    for form, url in ERDINCBAL_ARCHIVES.items():
        r = get(s, url)
        if r is None:
            continue
        n_before = len(rows)
        for tr in ROW_RE.findall(r.text):
            cells = CELL_RE.findall(tr)
            if len(cells) < 6:
                continue
            drive = re.search(r"drive\.google\.com/(?:open\?id=|file/d/)([\w-]+)", cells[1])
            if not drive:
                continue
            rows.append({
                "id": f"erdincbal:{drive.group(1)}", "source": "erdincbal",
                "title": strip_tags(cells[0]), "makam": strip_tags(cells[2]),
                "composer": strip_tags(cells[4]), "form": form,
                "usul": strip_tags(cells[5]), "engraver": strip_tags(cells[6]) if len(cells) > 6 else "",
                "url": f"https://drive.google.com/uc?export=download&id={drive.group(1)}",
                "kind": "pdf",
            })
        print(f"  {form}: {len(rows) - n_before} pieces")
    return rows


def census_blogspot(s: requests.Session) -> list[dict]:
    """Blogger's feed gives titles and post URLs; the note IMAGES live in the post body, so the
    image fetch is deferred to `download` — one request per piece we actually take."""
    rows, i = [], 1
    while True:
        r = get(s, BLOGSPOT_FEED.format(i=i))
        if r is None:
            break
        entries = r.json().get("feed", {}).get("entry", [])
        if not entries:
            break
        for e in entries:
            link = next((l["href"] for l in e.get("link", [])
                         if l.get("rel") == "alternate"), None)
            if not link:
                continue
            rows.append({
                "id": f"blogspot:{e['id']['$t'].rsplit('.', 1)[-1]}", "source": "blogspot",
                "title": e["title"]["$t"].strip(), "makam": "", "composer": "",
                "form": "", "usul": "", "engraver": "",
                "url": link, "kind": "post",
            })
        print(f"  fetched {len(rows)} posts ...")
        i += 150
    return rows


CENSUS = {"sahaney": census_sahaney, "erdincbal": census_erdincbal, "blogspot": census_blogspot}


def do_census(args) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    s = session()
    for src in args.sources:
        p = OUT / f"census_{src}.json"
        if p.exists() and not args.refresh:
            print(f"{src}: {len(json.loads(p.read_text()))} rows (cached; --refresh to redo)")
            continue
        print(f"{src}: censusing ...")
        rows = CENSUS[src](s)
        p.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
        print(f"{src}: {len(rows)} rows -> {p}")


# -------------------------------------------------------------------------------------- match
def load_symbtr(symbtr_dir: Path) -> dict[str, list[SymbTrPiece]]:
    by_makam: dict[str, list[SymbTrPiece]] = {}
    for path in sorted(symbtr_dir.glob("*.txt")):
        p = SymbTrPiece.from_path(path)
        if p:
            by_makam.setdefault(p.makam, []).append(p)
    return by_makam


def do_match(args) -> None:
    by_makam = load_symbtr(args.symbtr_dir)
    print(f"SymbTr: {sum(len(v) for v in by_makam.values())} pieces, {len(by_makam)} makams")
    for src in args.sources:
        rows = json.loads((OUT / f"census_{src}.json").read_text())
        out, tiers = [], {}
        all_pieces = [p for v in by_makam.values() for p in v]
        for row in rows:
            key = makam_key(row["makam"])
            pool = [p for k in MAKAM_ALIASES.get(key, [key]) for p in by_makam.get(k, [])]
            # A source that publishes no makam column (the blogspot: its title is the lyric
            # incipit, which is what SymbTr's own title field holds) still has an identity —
            # it just costs the makam hard-filter. Search every piece instead, and demand the
            # HIGHER accept threshold below, because the filter is what usually kills a
            # coincidental token overlap.
            wide = not row["makam"] and row["title"]
            if wide:
                pool = all_pieces
            if not pool:
                tier, best, score, detail, runner = "no_symbtr_makam", None, 0.0, "", None
            else:
                scored = sorted(((*score_row(row, p), p) for p in pool),
                                key=lambda t: t[0], reverse=True)
                score, detail, best = scored[0]
                runner = scored[1] if len(scored) > 1 else None
                margin = score - (runner[0] if runner else 0.0)
                acc = args.accept + (args.wide_penalty if wide else 0.0)
                tier = ("accept" if score >= acc and margin >= args.margin else
                        "review_ambiguous" if score >= acc else
                        "review" if score >= args.review else "reject")
            tiers[tier] = tiers.get(tier, 0) + 1
            out.append({**{k: row[k] for k in
                           ("id", "source", "title", "makam", "composer", "form", "usul",
                            "engraver", "url", "kind")},
                        "tier": tier, "score": f"{score:.3f}",
                        "symbtr": best.path.stem if best else "", "detail": detail})
        p = OUT / f"matches_{src}.csv"
        with p.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(out[0]))
            w.writeheader()
            w.writerows(out)
        print(f"{src}: " + ", ".join(f"{k} {v}" for k, v in sorted(tiers.items())) + f"  -> {p}")


# ------------------------------------------------------------------------------------- select
def exam_symbtr_ids() -> set[str]:
    """The frozen exam's SymbTr ids. A probe page of an exam PIECE is not a neutral read — the
    graded set would then share music with the thing measuring generalisation — so they are
    refused here the way every training flow refuses them (CLAUDE.md)."""
    ts = json.loads((REPO / "data/real/rung3/testset.json").read_text())
    return {Path(p["symbtr_file"]).stem for p in ts["pieces"]}


def trained_symbtr_ids() -> set[str]:
    """SymbTr ids the real training pool already contains. Not a refusal — a preference. The
    probe asks whether a THIRD ENGRAVER breaks the model, and a piece the model has already read
    in another engraving is the one case where a good score could be the music rather than the
    printing."""
    man = REPO / "data/real/rung3/strips_b8/manifest.jsonl"
    if not man.exists():
        return set()
    return {json.loads(l)["piece"] for l in man.read_text().splitlines() if l.strip()}


def do_select(args) -> None:
    exam, trained = exam_symbtr_ids(), trained_symbtr_ids()
    for src in args.sources:
        rows = list(csv.DictReader((OUT / f"matches_{src}.csv").open()))
        tiers = set(args.tier or (["accept"] if src != "blogspot" else ["review"]))
        pool = [r for r in rows if r["tier"] in tiers]
        n_exam = sum(r["symbtr"] in exam for r in pool)
        pool = [r for r in pool if r["symbtr"] not in exam]
        if args.form:
            want = {fold(f) for f in args.form}
            pool = [r for r in pool if fold(r["form"]) in want]
        # Rank: unseen music first, then the highest match score, and spread across makams so a
        # probe of 14 pages is not 14 nihavends (the corpus's most common makam by far).
        pool.sort(key=lambda r: (r["symbtr"] in trained, -float(r["score"])))
        seen: dict[str, int] = {}
        chosen = []
        for r in pool:
            k = makam_key(r["makam"]) or "?"
            if seen.get(k, 0) >= args.per_makam:
                continue
            seen[k] = seen.get(k, 0) + 1
            chosen.append({**r, "unseen": int(r["symbtr"] not in trained)})
            if len(chosen) >= args.max:
                break
        p = OUT / f"sample_{src}.csv"
        with p.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(chosen[0]))
            w.writeheader()
            w.writerows(chosen)
        print(f"{src}: pool {len(pool)} (refused {n_exam} exam pieces) -> chose {len(chosen)}"
              f", {sum(c['unseen'] for c in chosen)} unseen by training, "
              f"{len(seen)} makams  -> {p}")


# ----------------------------------------------------------------------------------- download
MIN_PAGE_PX = 800   # a page of music; the blog banner is 1020x250 and its /sNNNN/ is small
IMG_RE = re.compile(r'https://blogger\.googleusercontent\.com/img/[^"\')]+')


def blogspot_images(s: requests.Session, post_url: str) -> list[str]:
    """The score pages of one post, largest variant first.

    Blogger serves each asset at several widths; the `/sNNNN/` form carries the original's long
    edge in the path, so the size is known WITHOUT downloading. Two filters, and the first one is
    the load-bearing one:

    ⚠ **Select on SIZE, not on the filename.** The first version kept any image whose name matched
    `nota`, and every post's banner is called `notalar.jpg` — so all ten downloaded pages were a
    1020x250 banner, and nothing on screen said so. A page of music is big; a banner is not.
    """
    r = get(s, post_url)
    if r is None:
        return []
    best: dict[str, tuple[int, str]] = {}
    for u in IMG_RE.findall(r.text):
        m = re.search(r"/s(\d+)/([^/\"']+)$", u)
        if not m:
            continue
        size, name = int(m.group(1)), m.group(2)
        if size < MIN_PAGE_PX:
            continue
        if name not in best or size > best[name][0]:
            best[name] = (size, u)
    return [best[k][1] for k in sorted(best)]


def do_download(args) -> None:
    s = session()
    for src in args.sources:
        sample = OUT / f"sample_{src}.csv"
        if not sample.exists():
            raise SystemExit(f"{sample} missing — run `select` first, so the choice is auditable")
        rows = list(csv.DictReader(sample.open()))
        pdf_dir, img_dir = OUT / "pdfs" / src, OUT / "images" / src
        pdf_dir.mkdir(parents=True, exist_ok=True)
        img_dir.mkdir(parents=True, exist_ok=True)
        state_p = OUT / f"downloads_{src}.json"
        state = json.loads(state_p.read_text()) if state_p.exists() else {}
        print(f"{src}: {len(rows)} selected")
        stems = _unique_stems(rows, src)
        for row in rows:
            if row["id"] in state:
                continue
            stem = stems[row["id"]]
            pages = (_dl_pdf(s, row, pdf_dir, img_dir, stem) if row["kind"] == "pdf"
                     else _dl_post(s, row, pdf_dir, img_dir, stem))
            if not pages:
                continue
            state[row["id"]] = {"stem": stem, "pages": pages, **{k: row[k] for k in
                                ("title", "makam", "composer", "form", "usul", "engraver",
                                 "symbtr", "tier", "score", "url")}}
            state_p.write_text(json.dumps(state, ensure_ascii=False, indent=1))
            print(f"  {stem}: {len(pages)} page(s)")
        print(f"{src}: {len(state)} pieces on disk -> {state_p}")


def _unique_stems(rows: list[dict], src: str) -> dict[str, str]:
    """One stem per row, guaranteed distinct.

    ⚠ **A page stem is an identity, not a label.** erdincbal titles a piece by its makam and form
    alone, so two different `MÂHUR PEŞREVİ` (Rauf Yekta's and Gazi Giray's) collide — and the
    second download silently OVERWRITES the first's pages, losing a piece with nothing on screen
    to say so. It happened on the first run of this script. Every downstream pool is keyed by
    stem, so the fix belongs here, in the producer.
    """
    base: dict[str, str] = {}
    for r in rows:
        base[r["id"]] = f"{slug(r['makam'] or 'x')}_{slug(r['title'])}_{src}"
    counts: dict[str, int] = {}
    for v in base.values():
        counts[v] = counts.get(v, 0) + 1
    out: dict[str, str] = {}
    for r in rows:
        stem = base[r["id"]]
        if counts[stem] > 1:
            # the composer is what actually distinguishes them; the row id is the backstop
            extra = slug(r.get("composer") or "") or r["id"].split(":")[-1][:8]
            stem = f"{stem}_{extra}"
        if stem in out.values():
            stem = f"{stem}_{r['id'].split(':')[-1][:8]}"
        out[r["id"]] = stem
    if len(set(out.values())) != len(out):
        raise SystemExit("stem collision survived disambiguation — refusing to overwrite pages")
    return out


def _rasterize(pdf: Path, img_dir: Path, stem: str) -> list[str]:
    import fitz
    doc = fitz.open(pdf)
    out = []
    for i, page in enumerate(doc, 1):
        # 200 dpi: the corpus's own rasterisation setting, so staff pitch lands where the
        # slicer's geometry knobs expect it (src/vision/page_to_strips.py).
        p = img_dir / f"{stem}_p{i}.png"
        page.get_pixmap(dpi=200).save(p)
        out.append(str(p.relative_to(REPO)))
    return out


def _dl_pdf(s, row, pdf_dir, img_dir, stem) -> list[str]:
    r = get(s, row["url"])
    if r is None or not r.content.startswith(b"%PDF"):
        print(f"  ! {stem}: not a pdf ({len(r.content) if r else 0} bytes)")
        return []
    p = pdf_dir / f"{stem}.pdf"
    p.write_bytes(r.content)
    return _rasterize(p, img_dir, stem)


def _dl_post(s, row, pdf_dir, img_dir, stem) -> list[str]:
    urls = blogspot_images(s, row["url"])
    out = []
    for i, u in enumerate(urls, 1):
        r = get(s, u)
        if r is None:
            continue
        p = img_dir / f"{stem}_p{i}.png"
        from io import BytesIO
        from PIL import Image
        im = Image.open(BytesIO(r.content))
        if min(im.size) < 500:
            print(f"  ! {stem} p{i}: {im.size} is too small to be a page — skipped")
            continue
        im.convert("L").save(p)
        out.append(str(p.relative_to(REPO)))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["census", "match", "select", "download"])
    ap.add_argument("--source", default="all")
    ap.add_argument("--symbtr-dir", type=Path,
                    default=Path.home() / "Downloads" / "SymbTr-2.0.0" / "txt")
    ap.add_argument("--accept", type=float, default=0.85)
    ap.add_argument("--review", type=float, default=0.60)
    ap.add_argument("--margin", type=float, default=0.05)
    ap.add_argument("--wide-penalty", type=float, default=0.05,
                    help="added to --accept when a row has no makam and every piece is searched")
    ap.add_argument("--tier", nargs="*", default=None)
    ap.add_argument("--form", nargs="*", default=None)
    ap.add_argument("--max", type=int, default=14)
    ap.add_argument("--per-makam", type=int, default=2)
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    args.sources = list(SOURCES) if args.source == "all" else [args.source]
    {"census": do_census, "match": do_match, "select": do_select,
     "download": do_download}[args.cmd](args)


if __name__ == "__main__":
    main()
