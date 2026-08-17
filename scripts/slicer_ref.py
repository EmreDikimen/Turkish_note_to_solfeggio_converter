"""Python reference for the TypeScript slicer port (MVP W4-W6) — the control arm.

Why this exists, and why the manifests on disk are NOT enough.

`data/real/strips_v2/*/\\*_manifest.json` is what `page_to_strips.py` wrote during the re-slice, and
the port was first scored against it. That turned out to measure two things at once: the port's
fidelity, AND whether the manifest is still reproducible. It is not always — 1,578 of the 1,781
page dirs were sliced on Colab, and at least one page (`gozumden_gonlumden_hayali_gitmez_nota_p1`)
has a manifest saying 5 systems where the current local `page_to_strips.py` finds 7. The port
agreed with local Python line for line and was scored as a failure.

So this dumps what the CURRENT Python does, on the same pages, and that becomes the bar the port is
held to. The manifest stays in the report as a second, weaker reference — the same shape as the
arm-B ceiling for decoding: agreement with a stale artifact is not correctness.

The output file also DEFINES the sample: `slicer-parity.ts --ref <file>` runs exactly the pages in
it, so the two sides can never drift apart on which pages they ran.

Two passes per page, on purpose (~4.2 s each). `stage1()` re-derives the staff/row/barline geometry
so the reference carries it explicitly; `strips_ref()` then runs the REAL `page_to_strips` into a
temp dir for W6's strip entries, rather than re-implementing the driver's pad/trim block here — see
its docstring for why a second hand-written copy would be worse than the extra minute.

    .venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out /tmp/slicer_ref.json
    .venv-ml/bin/python scripts/slicer_ref.py --stems a_b_p1 c_d_p2 --out /tmp/one.json
"""
from __future__ import annotations

import argparse
import contextlib
import io
import json
import sys
import tempfile
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from vision.page_to_strips import (  # noqa: E402
    VPLACE_ADAPTIVE,
    binarize_page_ink,
    detect_barlines,
    detect_staves,
    load_gray,
    normalize_row,
    page_to_strips,
    prep_page,
)

ROOT = Path(__file__).resolve().parents[1]
STRIPS = ROOT / "data/real/strips_v2"
IMAGES = ROOT / "data/real/images"

# The slicer config the manifests and decode caches on disk were produced under.
REQUIRED = {
    "suffix": "_int8",
    "measures_per_strip": 3,
    "window_mode": "legacy",
    "edge_trim": True,
    "vplace": True,
}


def index_images() -> dict[str, Path]:
    idx: dict[str, Path] = {}
    for p in IMAGES.rglob("*"):
        if p.suffix.lower() in (".png", ".jpg", ".jpeg") and p.stem not in idx:
            idx[p.stem] = p
    return idx


def collect_jobs(images: dict[str, Path]) -> list[tuple[str, str, Path, list]]:
    """(stem, kind, image_path, manifest_rows) for every page dir we can score."""
    jobs = []
    for d in sorted(p for p in STRIPS.iterdir() if p.is_dir()):
        stem = d.name
        man = d / f"{stem}_manifest.json"
        if not man.exists() or stem not in images:
            continue
        rows = json.loads(man.read_text())
        if not rows:
            jobs.append((stem, "zero", images[stem], rows))
            continue
        dec = d / f"{stem}_decode.json"
        if not dec.exists():
            continue
        j = json.loads(dec.read_text())
        if not str(j.get("checkpoint", "")).endswith("round2-stage2-best"):
            continue
        if any(j.get(k) != v for k, v in REQUIRED.items()):
            continue
        jobs.append((stem, "eligible", images[stem], rows))
    return jobs


def sample(items: list, n: int) -> list:
    """Deterministic spread over the alphabetised corpus — matches slicer-parity.ts's own."""
    if n >= len(items):
        return items
    stride = len(items) / n
    return [items[int(i * stride)] for i in range(n)]


# The manifest keys W6 compares. `est_tokens`/`budget_risk` are deliberately absent: they are the
# Rung-3 emitter's bookkeeping and are not ported (docs/mvp/slicer-port.md), and `strip`/`row_bars`
# are covered elsewhere.
STRIP_KEYS = ("system", "window", "row_x0", "row_x1", "width", "pad", "scale",
              "is_row_start", "split_wide", "meas_from", "meas_to", "n_measures", "row_measures")


def strips_ref(image: Path) -> list[dict]:
    """W6's control: the REAL driver's manifest for this page, via `page_to_strips` into a temp dir.

    Not a re-implementation of the driver's ~40-line pad/trim block, on purpose. The TypeScript port
    is transliterated from those same lines, so a second hand-written copy here could encode the
    same misreading twice and then agree with itself — the exact failure mode this whole file exists
    to avoid. Running the shipped function costs a second stage-1 pass (~1.9 s/page) and some
    throwaway PNGs, and buys a control that IS the code under test.
    """
    with tempfile.TemporaryDirectory() as td:
        with contextlib.redirect_stdout(io.StringIO()):   # one progress line per page, not ours
            rows = page_to_strips(image, td)
    return [{k: r[k] for k in STRIP_KEYS} for r in rows]


def stage1(image: Path) -> dict:
    """Everything page_to_strips() does before window_measures (L962-982)."""
    gray = load_gray(image)
    page, cropped, skew = prep_page(gray)
    ink = binarize_page_ink(page)   # PAGE level, like page_to_strips (pale-line fallback)
    lab = (
        cv2.connectedComponents((ink > 0).astype(np.uint8), connectivity=8)[1]
        if VPLACE_ADAPTIVE
        else None
    )
    staves = detect_staves(ink)
    out = []
    for si, st in enumerate(staves):
        row, scale, top_y = normalize_row(page, st, lab)
        # W5's bar: detect_barlines' own output, with the rejected candidates the `_debug.png`
        # overlay colour-codes. `debug_info` is collected here but costs nothing extra — the gates
        # run either way, it only decides whether their verdicts are recorded.
        dbg: dict = {}
        bars = detect_barlines(row, st, scale, debug_info=dbg, top_y=top_y)
        out.append(
            {
                "system": si,
                "bars": [int(b) for b in bars],
                "rejects": [[int(x), str(r)] for x, r in dbg.get("rejects", [])],
                "lines": [int(y) for y in st.lines],
                "x0": int(st.x0),
                "x1": int(st.x1),
                "spacing": float(st.spacing),
                "scale": float(scale),
                "top_line_y": int(top_y),
                "row_w": int(row.shape[1]),
                "row_h": int(row.shape[0]),
                # a whole-row pixel sum: a single number that changes if ANY step of the
                # normalize path diverges. Not exact across runtimes (the browser's grayscale
                # differs by +-1), so it is reported as drift, never gated.
                "row_sum": int(row.sum()),
            }
        )
    return {
        "page_w": int(page.shape[1]),
        "page_h": int(page.shape[0]),
        "cropped": bool(cropped),
        "skew_deg": float(skew),
        "n_staves": len(staves),
        "staves": out,
        "strips": strips_ref(image),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", type=int, default=120, help="eligible pages to sample")
    ap.add_argument("--zero-pages", type=int, default=12, help="zero-staff pages to sample")
    ap.add_argument("--all", action="store_true", help="every page (slow: ~2 s each)")
    ap.add_argument("--stems", nargs="*", help="specific page stems instead of a sample")
    ap.add_argument("--out", required=True, help="reference JSON; also defines the sample")
    args = ap.parse_args()

    images = index_images()
    jobs = collect_jobs(images)
    if args.stems:
        want = set(args.stems)
        jobs = [j for j in jobs if j[0] in want]
    elif not args.all:
        el = sample([j for j in jobs if j[1] == "eligible"], args.pages)
        ze = sample([j for j in jobs if j[1] == "zero"], args.zero_pages)
        jobs = el + ze

    out: dict[str, dict] = {}
    # Resumable: re-running after a Ctrl-C skips pages already in the file.
    outp = Path(args.out)
    if outp.exists():
        out = json.loads(outp.read_text())
        print(f"resuming — {len(out)} page(s) already in {outp}")

    t0 = time.time()
    todo = [j for j in jobs if j[0] not in out]
    for i, (stem, kind, image, rows) in enumerate(todo, 1):
        rec = stage1(image)
        rec["kind"] = kind
        rec["manifest_n_staves"] = (max(r["system"] for r in rows) + 1) if rows else 0
        rec["manifest_scales"] = {
            str(r["system"]): r["scale"] for r in sorted(rows, key=lambda r: r["system"])
        }
        # `row_bars` rides on each row's w00 entry only. The weaker second reference for W5, same
        # standing as `manifest_scales`: it is what the re-slice wrote, not what this code does.
        # W6's second reference, same standing as `manifest_scales`: the strip entries the re-slice
        # wrote. Old manifests can predate a key, so missing ones are skipped rather than defaulted.
        rec["manifest_strips"] = [
            {k: r[k] for k in STRIP_KEYS if k in r}
            for r in sorted(rows, key=lambda r: (r["system"], r["window"]))
        ]
        rec["manifest_bars"] = {
            str(r["system"]): [int(b) for b in r["row_bars"]]
            for r in rows
            if r.get("window") == 0 and "row_bars" in r
        }
        out[stem] = rec
        if i % 10 == 0 or i == len(todo):
            outp.write_text(json.dumps(out, indent=1))
            print(f"  {i}/{len(todo)}  {time.time() - t0:.0f}s", flush=True)
    outp.write_text(json.dumps(out, indent=1))

    el = [r for r in out.values() if r["kind"] == "eligible"]
    agree = sum(1 for r in el if r["n_staves"] == r["manifest_n_staves"])
    print(f"\nwrote {outp} ({len(out)} pages)")
    print(
        f"python-vs-MANIFEST staff count: {agree}/{len(el)} "
        f"({100 * agree / max(1, len(el)):.2f}%) — this is the port's ceiling, not 100%"
    )
    deskewed = sum(1 for r in out.values() if r["skew_deg"] != 0.0)
    print(f"pages deskewed: {deskewed}/{len(out)} ({100 * deskewed / max(1, len(out)):.1f}%)")

    # the same ceiling disclosure for W5's bar lists: how far the manifests have drifted from what
    # this code now produces. Only rows the manifest actually records a `row_bars` for are counted.
    rows_n = rows_same = 0
    for r in out.values():
        for st in r["staves"]:
            man = r.get("manifest_bars", {}).get(str(st["system"]))
            if man is None:
                continue
            rows_n += 1
            rows_same += man == st["bars"]
    if rows_n:
        print(
            f"python-vs-MANIFEST bar list: {rows_same}/{rows_n} rows identical "
            f"({100 * rows_same / rows_n:.2f}%) — the port's ceiling against the manifest, not 100%"
        )

    # ... and for W6's strip entries. This one also cross-checks `strips_ref` itself: it runs the
    # real driver, so a page whose stage 1 reproduces should reproduce its manifest strips too.
    pages_n = pages_same = strips_n = strips_same = 0
    for r in out.values():
        man = r.get("manifest_strips")
        if man is None:
            continue
        pages_n += 1
        pages_same += man == r["strips"]
        for a, b in zip(man, r["strips"]):
            strips_n += 1
            strips_same += a == b
    if pages_n:
        print(
            f"python-vs-MANIFEST strips: {pages_same}/{pages_n} pages identical "
            f"({100 * pages_same / pages_n:.2f}%), {strips_same}/{strips_n} entries "
            f"({100 * strips_same / max(1, strips_n):.2f}%) — W6's ceiling against the manifest"
        )


if __name__ == "__main__":
    main()
