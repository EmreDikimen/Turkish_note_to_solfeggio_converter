"""Rung 3 — slicer regression scorer: OLD vs NEW barline detection against SymbTr truth.

CPU-only, no model in the loop. Per-row ground truth (the printed measure count each staff
row actually holds) comes from the emitter's content alignment run over the CACHED
`<page>_decode.json` files — the decoded token streams are reused as-is, so nothing is
re-decoded. The OLD slicer's `row_measures` sits in the same cache; the NEW count is
computed by re-running only the classical-CV path (staff detect -> normalize -> barlines)
with the current code. Rows pair 1:1 by system index (staff grouping is unchanged).

CAVEAT: truth comes from aligning the OLD slicer's decodes, so rows the old pipeline left
`unaligned` have no truth here and are excluded — the blind spot is exactly the worst old
rows. The unbiased end-to-end confirmation is a fresh GPU decode + emitter --report-only
after the re-slice.

Run (fast iteration, then full):
    .venv-ml/bin/python scripts/rung3/score_slicer.py --sample 30
    .venv-ml/bin/python scripts/rung3/score_slicer.py
    .venv-ml/bin/python scripts/rung3/score_slicer.py --eyeball   # contact sheets + index.html
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO / "src" / "vision"))
sys.path.insert(0, str(REPO / "scripts" / "rung3"))

from emit_strip_labels import Aligner, choose_fold, load_piece, rows_of  # noqa: E402
from page_to_strips import (binarize_ink, detect_barlines, detect_staves,  # noqa: E402
                            load_gray, normalize_row, page_to_strips, window_measures)

# the three w00 crops documented as broken in docs/rung3/followups.md (slicer defects) — always eyeballed
DOC_BAD_PAGES = [
    "aman_cana_beni_sad_et_nota_p1",
    "hatirlar_misin_beni_bir_zamanlar_nota_p1",
    "canan_bilirim_sen_beni_nalan_edeceksin_nota_p1",
]


def cached_decodes(piece, strips_root: Path) -> list[dict] | None:
    """The emitter's per-page decode caches, or None when any page lacks a usable one."""
    out = []
    for page in piece.pages:
        stem = (REPO / page).stem
        dj = strips_root / stem / f"{stem}_decode.json"
        if not dj.exists():
            return None
        d = json.loads(dj.read_text())
        strips = d.get("strips", [])
        if not strips or strips[0].get("meas_from") is None:
            return None
        out.append(d)
    return out


def new_counts(page_path: Path, rejects: Counter,
               by_position: bool = False) -> tuple[dict[int, int], int]:
    """system index -> measure count under the CURRENT slicer CV path (no strip writing).

    Returns (counts, rows_gained). The index is the OLD pipeline's, which is what the cached truth
    is keyed by.

    ⚠ `by_position` exists because this scorer's docstring assumption — "staff grouping is
    unchanged" — is FALSE for any change to staff detection. The staff rescue inserts a row, and a
    plain `enumerate` then shifts every later index, so each row would be scored against another
    row's truth and the run would report a large regression that is purely an artifact. With this
    on, staves are re-paired to the pass-1 reading by vertical position, and rows the rescue ADDED
    are counted separately rather than scored: their truth comes from aligning the OLD pipeline's
    decodes, and the old pipeline never saw them, so no truth for them exists.
    """
    page = load_gray(page_path)
    ink = binarize_ink(page)
    out: dict[int, int] = {}
    gained = 0
    if by_position:
        base = detect_staves(ink, rescue=False)
        full = detect_staves(ink, rescue=True)
        tol = max(6, int(0.5 * (base[0].lines[-1] - base[0].lines[0]))) if base else 6
        used: set[int] = set()
        pairs: list[tuple[int, object]] = []
        for si, b in enumerate(base):
            hit = min(((j, f) for j, f in enumerate(full) if j not in used
                       and abs(f.lines[0] - b.lines[0]) <= tol),
                      key=lambda jf: abs(jf[1].lines[0] - b.lines[0]), default=None)
            if hit is not None:
                used.add(hit[0])
                pairs.append((si, hit[1]))
        gained = len(full) - len(used)
        staves_iter = pairs
    else:
        staves_iter = list(enumerate(detect_staves(ink)))
    for si, staff in staves_iter:
        row, scale, _ = normalize_row(page, staff)
        info: dict = {}
        bars = detect_barlines(row, staff, scale, debug_info=info)
        for _, why in info.get("rejects", []):
            rejects[why] += 1
        windows = window_measures(bars, row)  # same counting as the manifest (prefix trim etc.)
        out[si] = max(w.m_to for w in windows) + 1 if windows else 0
    return out, gained


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--matched", default="data/real/rung3/matched")
    ap.add_argument("--strips-root", default="data/real/strips")
    ap.add_argument("--checkpoint", default="data/checkpoints/rung22-stemfix-best",
                    help="tokenizer source only — no ONNX is loaded")
    ap.add_argument("--row-nd", type=float, default=0.45)
    ap.add_argument("--margin", type=float, default=0.10)
    ap.add_argument("--pair-by-position", action="store_true",
                    help="pair rows to the cached truth by vertical POSITION, not system index — "
                         "required for any change that adds or removes a staff (see new_counts)")
    ap.add_argument("--sample", type=int, help="score only N randomly chosen cached pieces")
    ap.add_argument("--seed", type=int, default=33)
    ap.add_argument("--csv", default="data/real/rung3/score_slicer.csv")
    ap.add_argument("--eyeball", action="store_true",
                    help="write sliced strips + debug overlays for the documented-bad pages, "
                         "the worst regressions and random w00s, plus an index.html")
    ap.add_argument("--eyeball-dir", default="data/real/rung3/slicer_eyeball")
    args = ap.parse_args()

    from transformers import AutoProcessor
    al = Aligner(AutoProcessor.from_pretrained(args.checkpoint).tokenizer)

    strips_root = REPO / args.strips_root
    piece_dirs = sorted(p.parent for p in (REPO / args.matched).rglob("match.json"))
    pieces = []
    skipped = 0
    for d in piece_dirs:
        p = load_piece(d)
        if p is None:
            continue
        dec = cached_decodes(p, strips_root)
        if dec is None:
            skipped += 1
            continue
        pieces.append((p, dec))
    if args.sample and args.sample < len(pieces):
        pieces = random.Random(args.seed).sample(pieces, args.sample)
    print(f"pieces: {len(pieces)} scored, {skipped} skipped (no/stale decode cache)")

    rejects: Counter = Counter()
    page_cache: dict[str, dict[int, int]] = {}
    rows_gained: dict[str, int] = {}   # pages where the rescue ADDED a staff, per --pair-by-position
    page_paths: dict[str, Path] = {}
    results: list[dict] = []          # one per truth-bearing row
    piece_counts = {"new_closer": 0, "old_closer": 0, "tied": 0}
    for pi, (piece, decodes) in enumerate(pieces):
        rows = rows_of(decodes)
        if not rows:
            continue
        folded, _ = choose_fold(piece, rows, al, args.row_nd, args.margin)
        if folded is None:
            continue
        _, printed, _, assigns, _, _, _ = folded
        p_old = p_new = 0
        for a in assigns:
            stem = a.row.page_stem
            if stem not in page_cache:
                pp = next((REPO / g for g in piece.pages if (REPO / g).stem == stem), None)
                page_paths[stem] = pp
                if pp and pp.exists():
                    page_cache[stem], g = new_counts(pp, rejects, args.pair_by_position)
                    rows_gained[stem] = g
                else:
                    page_cache[stem] = {}
            new_rm = page_cache[stem].get(a.row.system)
            p_old += a.row.row_measures
            p_new += new_rm if new_rm is not None else 0
            if a.status == "unaligned" or new_rm is None:
                continue
            results.append({
                "piece": piece.stem, "page": stem, "system": a.row.system,
                "truth_n": a.n, "old_rm": a.row.row_measures, "new_rm": new_rm,
                "old_dn": a.row.row_measures - a.n, "new_dn": new_rm - a.n,
                "status": a.status,
            })
        # decode-free secondary signal: whole-piece measure count vs the aligned fold's
        # printed length (edition repeats make it noisy — reported, never gated on)
        gap_old, gap_new = abs(p_old - len(printed)), abs(p_new - len(printed))
        piece_counts["tied" if gap_new == gap_old else
                     "new_closer" if gap_new < gap_old else "old_closer"] += 1
        if (pi + 1) % 25 == 0:
            print(f"  ... {pi + 1}/{len(pieces)} pieces")

    n = len(results)
    if n == 0:
        print("no truth-bearing rows — nothing to score")
        return 1
    old_ok = sum(r["old_dn"] == 0 for r in results)
    new_ok = sum(r["new_dn"] == 0 for r in results)
    improved = sum(abs(r["new_dn"]) < abs(r["old_dn"]) for r in results)
    regressed = [r for r in results if abs(r["new_dn"]) > abs(r["old_dn"])]

    def hist(key: str) -> str:
        c = Counter(min(3, max(-3, r[key])) for r in results)
        return "  ".join(f"{d:+d}:{c[d]}" for d in range(-3, 4) if c[d])

    print(f"\nrows with truth: {n}")
    print(f"exact rows   old {old_ok}/{n} ({old_ok / n:.1%})   new {new_ok}/{n} ({new_ok / n:.1%})")
    print(f"row deltas   improved {improved}   regressed {len(regressed)}")
    print(f"dn hist old  {hist('old_dn')}")
    print(f"dn hist new  {hist('new_dn')}")
    print(f"piece-count gap vs printed: {piece_counts}")
    print(f"gate rejects (new slicer): {dict(rejects)}")
    if args.pair_by_position:
        gained_pages = {k: v for k, v in rows_gained.items() if v}
        print(f"\nstaff ROWS GAINED by the rescue: {sum(gained_pages.values())} "
              f"on {len(gained_pages)} of {len(rows_gained)} pages")
        print("  ⚠ these rows are NOT in the numbers above and cannot be: the truth is aligned "
              "from the OLD pipeline's decodes, which never saw them.")
        for k, v in sorted(gained_pages.items(), key=lambda kv: -kv[1])[:10]:
            print(f"    +{v}  {k}")
    if regressed:
        print("\nworst regressions (|new_dn| desc):")
        for r in sorted(regressed, key=lambda r: -abs(r["new_dn"]))[:15]:
            print(f"  {r['page']} s{r['system']:02d}  n={r['truth_n']} "
                  f"old={r['old_rm']} new={r['new_rm']}")

    csv_path = REPO / args.csv
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        wr.writeheader()
        wr.writerows(sorted(results, key=lambda r: (-abs(r["new_dn"]), r["page"], r["system"])))
    print(f"per-row CSV -> {csv_path}")

    if args.eyeball:
        eyeball(args, results, regressed, page_paths)
    return 0


def eyeball(args, results, regressed, page_paths: dict[str, Path]) -> None:
    """Slice the eyeball pages with the CURRENT code (debug overlays on) into --eyeball-dir
    and write an index.html: the docs' 3 bad-w00 pages + worst regressions + random w00s."""
    rng = random.Random(args.seed)
    chosen: list[str] = [s for s in DOC_BAD_PAGES]
    chosen += [r["page"] for r in sorted(regressed, key=lambda r: -abs(r["new_dn"]))[:7]]
    rest = [r["page"] for r in results if r["page"] not in chosen]
    chosen += rng.sample(rest, min(10, len(rest))) if rest else []
    # resolve documented pages that were outside the scored set
    for stem in chosen:
        if stem not in page_paths or page_paths[stem] is None:
            hit = next((REPO / "data/real/images").rglob(f"{stem}.png"), None)
            page_paths[stem] = hit

    out_root = REPO / args.eyeball_dir
    out_root.mkdir(parents=True, exist_ok=True)
    sections: list[str] = []
    seen: set[str] = set()
    for stem in chosen:
        if stem in seen or page_paths.get(stem) is None:
            continue
        seen.add(stem)
        page_dir = out_root / stem
        manifest = page_to_strips(page_paths[stem], page_dir, debug=True)
        imgs = "\n".join(
            f'<figure><img src="{stem}/{e["strip"]}"><figcaption>{e["strip"]}'
            f' m{e["meas_from"]}-{e["meas_to"]}</figcaption></figure>' for e in manifest)
        sections.append(
            f'<h2>{stem}</h2>\n<img class="debug" src="{stem}/{stem}_debug.png">\n{imgs}')
    (out_root / "index.html").write_text(
        "<!doctype html><meta charset=utf-8><title>slicer eyeball</title>"
        "<style>img{max-width:100%;border:1px solid #999;margin:4px 0}"
        "figure{margin:6px 0}figcaption{font:12px monospace}</style>\n"
        + "\n".join(sections))
    print(f"eyeball sheets ({len(seen)} pages) -> {out_root}/index.html")


if __name__ == "__main__":
    raise SystemExit(main())
