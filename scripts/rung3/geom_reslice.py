"""
Re-slice a sample of REAL pages at several crop geometries, for Round-3 Lever 1 step 2.

WHY BOTH SIDES MOVE: the pools on disk were cut at MEASURES_PER_STRIP=3 / MAX_STRIP_W=1450, so
narrowing only the synthetic renderer would *invert* the width gap rather than close it — and
production slices real pages with this same slicer, so whatever geometry ships applies to both. This
script is the real half of the pilot's arms.

⚠ THE CONTROL ARM IS RE-SLICED TOO, NOT READ OFF DISK. The existing pools predate the pale-line
binarizer (docs/METRICS-SLICER.md), so comparing a fresh narrow re-slice against them would move two
variables at once — the mistake Round 2 and the tuplet A/B exist to stop repeating.

WHAT IT REPORTS per arm, with no model and no labels:
  strips/page          the decode-cost multiplier the owner prices the render against
  width + the encoder staff spacing that width produces
  measures per strip   is the measure rail even binding? (on the synthetic side it was NOT)
  SHORT CROPS          share under SHORT_CROP_TOKENS gold-ish tokens — the pre-registered stop rule
                       (docs/rung3/levers.md). ⚠ Real crops here have NO gold, so this is an
                       ESTIMATE from the slicer's own `est_tokens`, not the tokenizer's count. It is
                       labelled as such everywhere it is printed, and it is the reason the stop rule
                       must finally be read on a pool that has gold.

Geometry is set by env vars per arm (OMR_MEASURES_PER_STRIP, OMR_MAX_STRIP_W), so the slicer is
imported fresh in a SUBPROCESS per arm — module-level constants are read at import time, so setting
them in-process after the fact would silently do nothing.

Run:
    .venv-ml/bin/python scripts/rung3/geom_reslice.py --pages pages.txt --out-root data/real/rung3
    .venv-ml/bin/python scripts/rung3/geom_reslice.py --report data/real/rung3/_geom_reslice_m1 ...
"""

from __future__ import annotations

import argparse
import json
import os
import statistics as st
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# The encoder's fixed input box, and the strip height every crop is normalised to. Same arithmetic as
# crop_geometry_probe.effective_spacing — duplicated deliberately rather than imported, because that
# module loads a decode dump this script has no use for.
BOX_W, BOX_H = 409, 583
STRIP_H = 336
TARGET_SPACING = 30.0

# The short-crop threshold, in the units this script can actually see. crop_geometry_probe uses
# `< 10` gold tokens; the slicer's `est_tokens` is a fitted estimate of the same quantity, so the
# threshold carries across but the count does not. Never quote one as the other.
SHORT_CROP_TOKENS = 10

# ⚠ MAX_STRIP_W STAYS AT ITS SHIPPED 1450 IN EVERY ARM, AND THAT IS THE WHOLE DESIGN.
# Measured 2026-08-17, after getting it wrong: the first version of this script paired each arm with a
# lowered width cap (m2 -> 800, m1 -> 500). A real measure is ~1012 px, so those caps cannot be met by
# packing fewer measures — `_split_wide` has to cut INSIDE measures at zero-ink gutters to satisfy
# them, and it did: split_wide 25% (control) -> 76% -> 94.7%. That is not "narrower crops on
# barlines", it is the half-measure target `width_split_probe.py` already measured as +31.8% WORSE,
# and levers.md says in as many words: cut on barlines. It also blew the short-crop stop rule
# (0.8% -> 4.2% -> 19.8%) for a reason that had nothing to do with the lever under test.
#
# So the measure rail is the ONLY thing that varies here. The cap stays where it ships, high enough
# not to bind, and every crop keeps falling on a barline.
ARMS = [("m3", 3, 1450), ("m2", 2, 1450), ("m1", 1, 1450)]


def effective_spacing(w: int) -> float:
    return TARGET_SPACING * min(BOX_H / w, BOX_W / STRIP_H)


def slice_arm(pages: list[Path], out_dir: Path, measures: int, max_w: int) -> None:
    """Run the slicer over `pages` in a subprocess with this arm's geometry in the environment."""
    out_dir.mkdir(parents=True, exist_ok=True)
    code = (
        "import sys, json\n"
        "sys.path.insert(0, 'src')\n"
        "from vision.page_to_strips import page_to_strips, MEASURES_PER_STRIP, MAX_STRIP_W\n"
        "print(f'  slicer sees MEASURES_PER_STRIP={MEASURES_PER_STRIP} MAX_STRIP_W={MAX_STRIP_W}')\n"
        "pages = json.loads(sys.argv[1]); out = sys.argv[2]\n"
        "for i, p in enumerate(pages, 1):\n"
        "    try:\n"
        "        page_to_strips(p, out)\n"
        "    except Exception as exc:\n"
        "        print(f'  !! {p}: {exc}')\n"
        "    if i % 5 == 0: print(f'  {i}/{len(pages)}')\n"
    )
    env = {**os.environ, "OMR_MEASURES_PER_STRIP": str(measures), "OMR_MAX_STRIP_W": str(max_w)}
    subprocess.run([sys.executable, "-c", code, json.dumps([str(p) for p in pages]), str(out_dir)],
                   cwd=ROOT, env=env, check=True)


def read_manifests(out_dir: Path) -> list[dict]:
    """Every strip row the slicer wrote under `out_dir`, from its per-page manifests."""
    rows: list[dict] = []
    for m in sorted(out_dir.rglob("*_manifest.json")):
        data = json.loads(m.read_text())
        strips = data.get("strips", data) if isinstance(data, dict) else data
        for s in strips:
            s = dict(s)
            s["_page"] = m.stem.replace("_manifest", "")
            rows.append(s)
    return rows


def report(name: str, rows: list[dict], n_pages: int) -> str:
    if not rows:
        return f"{name}: no strips"
    ws = sorted(int(r["width"]) for r in rows)
    eff = [effective_spacing(w) for w in ws]
    meas = [int(r.get("n_measures", 0)) for r in rows if r.get("n_measures")]
    est = [float(r["est_tokens"]) for r in rows if r.get("est_tokens") is not None]
    pages = {r["_page"] for r in rows}
    out = [
        f"{name}:  {len(rows)} strips over {len(pages)} pages (of {n_pages} given)"
        f"   = {len(rows) / max(1, len(pages)):.2f} strips/page",
        f"    width      median {st.median(ws):6.0f}  mean {st.mean(ws):6.0f}"
        f"  p10 {ws[len(ws) // 10]:5d}  p90 {ws[9 * len(ws) // 10]:5d}",
        f"    encoder    staff spacing median {st.median(eff):5.1f} px"
        f"   <=479 px: {sum(1 for w in ws if w <= 479) / len(ws):5.1%}",
    ]
    if meas:
        import collections
        out.append(f"    measures/strip {dict(sorted(collections.Counter(meas).items()))}")
    if est:
        short = sum(1 for e in est if e < SHORT_CROP_TOKENS) / len(est)
        out.append(f"    est_tokens median {st.median(est):5.1f}"
                   f"   SHORT (<{SHORT_CROP_TOKENS}, ESTIMATE not gold): {short:5.1%}")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", help="file with one page PNG path per line")
    ap.add_argument("--out-root", default=str(ROOT / "data/real/rung3"))
    ap.add_argument("--report", nargs="*", help="report saved arm dirs, slice nothing")
    args = ap.parse_args()

    if args.report:
        for d in args.report:
            p = Path(d)
            print(report(p.name, read_manifests(p), 0))
            print()
        return 0

    pages = [Path(l.strip()) for l in Path(args.pages).read_text().splitlines() if l.strip()]
    missing = [p for p in pages if not p.exists()]
    if missing:
        print(f"{len(missing)} page(s) missing, first: {missing[0]}")
        return 1
    print(f"{len(pages)} pages, {len(ARMS)} arms\n")

    results = []
    for name, measures, max_w in ARMS:
        out_dir = Path(args.out_root) / f"_geom_reslice_{name}"
        print(f"== arm {name}: MEASURES_PER_STRIP={measures} MAX_STRIP_W={max_w} -> {out_dir}")
        slice_arm(pages, out_dir, measures, max_w)
        results.append((name, read_manifests(out_dir), len(pages)))
        print()

    print("=" * 78)
    for name, rows, n in results:
        print(report(f"arm {name}", rows, n))
        print()
    # The stop rule is a RATIO against the control, so compute it rather than leaving it to the eye.
    base = next((r for n, r, _ in results if n == "m3"), None)
    if base:
        b = [float(x["est_tokens"]) for x in base if x.get("est_tokens") is not None]
        if b:
            b_short = sum(1 for e in b if e < SHORT_CROP_TOKENS) / len(b)
            print(f"STOP RULE (docs/rung3/levers.md): an arm is stopped if its short-crop share more "
                  f"than DOUBLES the control's {b_short:.1%} -> threshold {2 * b_short:.1%}")
            for name, rows, _ in results:
                e = [float(x["est_tokens"]) for x in rows if x.get("est_tokens") is not None]
                if not e or name == "m3":
                    continue
                s = sum(1 for x in e if x < SHORT_CROP_TOKENS) / len(e)
                verdict = "STOPPED" if s > 2 * b_short else "survives"
                print(f"  arm {name}: {s:.1%}  -> {verdict}")
            print("⚠ ON ESTIMATED TOKENS, NOT GOLD — see the module docstring.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
