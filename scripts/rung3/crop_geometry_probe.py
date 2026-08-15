"""
Round-3 probe: does the ENCODER'S FIXED INPUT BOX cost us edits? (2026-08-15)

WHY THIS EXISTS. Every Round-3 pre-render check so far asked "do we DRAW something wrong"
(staff geometry, beam weight, crop shape, the tuplet mark) and four of five came back negative.
This one asks a different question: how much of the page does the model actually get to SEE?

The arithmetic nobody had written down. `preprocess.ts` (the ported DonutImageProcessor) rotates a
strip 90 degrees and fits it into a fixed **409x583** box:

    rotated w,h = H,W  ->  shortest edge to 409  ->  thumbnail into 409x583  ->  pad
    net scale = min(583 / W, 409 / H)                      (H = 336 for every strip we make)

So a median synthetic strip (1212x336) reaches the encoder at **scale 0.48**: its 30 px staff
spacing becomes **14.4 px**, one note position (line -> space) becomes **7.2 px**, and the content
occupies 161 of 409 columns — **61% of the encoder's input is black padding**. A strip narrower
than 583*336/409 = **479 px** is instead UPSCALED to 36.5 px spacing and fills the box.

TWO MODES.

  (default) OBSERVATIONAL. Re-align the stored Round-2 exam decode against gold, and bucket the
  strips by effective staff spacing, holding the two obvious confounds fixed one at a time.
  This is what produced the numbers in docs/METRICS-DIAGNOSTICS.md.

  --make-padded  CAUSAL. Write a copy of a strips dir with each PNG extended on the RIGHT by more
  EMPTY STAFF, leaving the manifest — and therefore the gold label — untouched. Padding lowers the
  effective resolution WITHOUT changing the content or the sequence length, so decoding the padded
  copies with `eval_omr.py` turns the correlation below into a dose-response curve. Pre-registered
  reading:

      edits/token rises monotonically with the pad factor  -> resolution is causal, act on it
      flat within noise                                    -> the correlation is a confound, drop it

  ⚠ **The obvious implementation is wrong and was measured before being used.** `BORDER_REPLICATE`
  extends the LAST column, and the last column of an exam crop is **36% ink at the median** — that
  is the 120 px staff span, i.e. the crop ends on a barline. Replicating it paints a solid black
  band across the padding, which is a far bigger change than the resolution it was meant to isolate.
  Instead the padding TILES the strip's own quietest run of columns (`_quiet_window`), so it is that
  strip's real empty staff at its real ink weight, and no pixel is invented. Measured on the 326
  exam crops: a genuinely blank column is **4.6%** ink and the tiled padding lands at **5.6%**, so
  what it adds really is staff and nothing else.

  ⚠ Still not artifact-free, in two ways worth watching. A tiled window repeats at a fixed period,
  which is a texture no real page has; and on the densest strips there is no quiet window at all, so
  their padding carries part of a symbol (the run prints how many exceed 10% ink). Look at a few
  written PNGs before believing the curve, and treat a SMALL rise as unproven — the reading above
  asks for a monotone one across factors.

USAGE
    .venv-ml/bin/python scripts/rung3/crop_geometry_probe.py
    .venv-ml/bin/python scripts/rung3/crop_geometry_probe.py \
        --make-padded data/real/rung3/_geometry_pad --factors 1.25,1.5,2.0
    # then, per factor:
    .venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/round2-stage2-best \
        --strips-dir data/real/rung3/_geometry_pad/pad150 --split none

⚠ NOT AN EXAM READ. The default mode re-reads a decode that was already spent (2026-07-27) and
re-aligns it; no model runs. The padded mode is a diagnostic on exam crops and, like every probe in
this directory, must be reported as a second look at a spent read — the Round-3 exam is still the
one-shot read on the final model (docs/rung3/round3-criteria.md).
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "vision"))

from data import ADDED_TOKENS  # noqa: E402

# The encoder's input frame — mirrors apps/web/src/omr/preprocess.ts and the checkpoint's
# preprocessor_config.json. If either moves, this probe's arithmetic moves with it.
BOX_W, BOX_H = 409, 583

_BACKSLASH = sorted([t for t in ADDED_TOKENS if t.startswith("\\")], key=len, reverse=True)


def tokenize(text: str) -> list[str]:
    """Split a printed label/decode into tokens.

    The tokenizer's added-token matcher eats the spaces around `\\`-tokens and never restores
    them, so a decode prints as `\\sigendd''4.` — a naive whitespace split undercounts. Peel known
    added tokens off the front of each whitespace chunk, longest first.
    """
    out: list[str] = []
    for chunk in text.split():
        while chunk:
            for tok in _BACKSLASH:
                if chunk.startswith(tok):
                    out.append(tok)
                    chunk = chunk[len(tok):]
                    break
            else:
                cut = chunk.find("\\", 1)
                out.append(chunk if cut == -1 else chunk[:cut])
                chunk = "" if cut == -1 else chunk[cut:]
    return out


def edit_distance(a: list[str], b: list[str]) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, y in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y))
        prev = cur
    return prev[-1]


def effective_spacing(w: int, h: int, target_spacing: float = 30.0) -> float:
    """Staff spacing in px AS THE ENCODER SEES IT, after rotate+resize+thumbnail."""
    return target_spacing * min(BOX_H / w, BOX_W / h)


def parse_error_dump(path: Path) -> dict[str, tuple[str, str]]:
    """`eval_omr.py --show-errors` output -> {image: (want, got)}. Only mismatching strips appear."""
    out: dict[str, tuple[str, str]] = {}
    cur, want = None, None
    for line in path.read_text(errors="replace").splitlines():
        m = re.search(r"([\w\-.]+\.png)\s*$", line.strip())
        if "✗" in line and m:
            cur, want = m.group(1), None
        elif cur and line.strip().startswith("want:"):
            want = line.split("want:", 1)[1].strip()
        elif cur and line.strip().startswith("got :") and want is not None:
            out[cur] = (want, line.split("got :", 1)[1].strip())
            cur, want = None, None
    return out


def load(strips_dir: Path, errors: dict[str, tuple[str, str]]) -> list[dict]:
    from PIL import Image

    rows = []
    for line in (strips_dir / "manifest.jsonl").read_text().splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        w, h = Image.open(strips_dir / r["image"]).size
        gold = tokenize(r["label"])
        want_got = errors.get(r["image"])
        rows.append({
            "image": r["image"], "w": w, "h": h, "n": len(gold),
            "edits": edit_distance(tokenize(want_got[0]), tokenize(want_got[1])) if want_got else 0,
            "eff": effective_spacing(w, h),
        })
    return rows


def bucket(rows: list[dict], title: str, key: str = "eff", k: int = 3) -> None:
    if len(rows) < 3 * k:
        print(f"\n{title}: only {len(rows)} strips — skipped")
        return
    rows = sorted(rows, key=lambda r: r[key])
    size = len(rows) // k
    print(f"\n{title}  (n={len(rows)})")
    print(f"{'eff sp px':>10} {'W med':>7} {'gold tok':>9} {'strips':>7} {'edits':>6} "
          f"{'ed/token':>9} {'perfect':>8}")
    for i in range(k):
        b = rows[i * size:(i + 1) * size if i < k - 1 else len(rows)]
        edits, gold = sum(r["edits"] for r in b), sum(r["n"] for r in b)
        print(f"{st.median([r['eff'] for r in b]):10.1f} {st.median([r['w'] for r in b]):7.0f} "
              f"{st.median([r['n'] for r in b]):9.0f} {len(b):7d} {edits:6d} "
              f"{edits / max(1, gold):9.3f} {100 * sum(1 for r in b if not r['edits']) / len(b):7.0f}%")


def _quiet_window(img, width: int = 12):
    """The strip's own emptiest run of `width` columns — its blank staff, at its own ink weight.

    Padding has to add staff and nothing else. Taking the LAST column (BORDER_REPLICATE) does the
    opposite: measured over the 326 exam crops, the last column is 36% ink at the median — the
    120 px staff span, i.e. the crop ends on a barline — so replicating it paints a black band.
    """
    import numpy as np

    grey = img[:, :, 0] if img.ndim == 3 else img
    ink = (grey < 128).sum(axis=0).astype(float)
    if len(ink) <= width:
        return img
    run = np.convolve(ink, np.ones(width), mode="valid")
    at = int(run.argmin())
    return img[:, at:at + width]


def make_padded(strips_dir: Path, out_root: Path, factors: list[float]) -> None:
    """Widen every strip with more of its own empty staff; labels and manifest unchanged."""
    import statistics

    import cv2
    import numpy as np

    for f in factors:
        out = out_root / f"pad{int(round(f * 100))}"
        out.mkdir(parents=True, exist_ok=True)
        shutil.copy(strips_dir / "manifest.jsonl", out / "manifest.jsonl")
        effs, pad_ink = [], []
        for line in (strips_dir / "manifest.jsonl").read_text().splitlines():
            if not line.strip():
                continue
            name = json.loads(line)["image"]
            img = cv2.imread(str(strips_dir / name))
            h, w = img.shape[:2]
            add = int(round(w * (f - 1.0)))
            if add > 0:
                tile = _quiet_window(img)
                reps = add // tile.shape[1] + 1
                # (1, reps, 1): tile along the WIDTH only — a bare (1, reps) also tiles the
                # colour channels and produces a 3*reps-deep array that will not hstack.
                pad = np.tile(tile, (1, reps, 1))[:, :add]
                pad_ink.append(float((pad[:, :, 0] < 128).mean()))
                img = np.hstack([img, pad])
            cv2.imwrite(str(out / name), img)
            effs.append(effective_spacing(w + add, h))
        # Reference points, MEASURED on the 326 exam crops rather than assumed: a genuinely blank
        # column is **4.6% ink** at the median (the five staff lines are thicker than they look),
        # and a barline column is **36%**. So padding near 5% is blank staff and needs no apology;
        # what matters is the tail, where a dense strip has no quiet window and its padding carries
        # part of a symbol. Count those rather than hiding behind a median — they are where this
        # probe is weakest. (A narrower window is barely cleaner — 4.8% at w=4 — and repeats at a
        # tighter period, so w=12 is kept.)
        dirty = sum(1 for x in pad_ink if x > 0.10)
        print(f"[written] {out}  ({len(effs)} strips, width x{f:.2f}, "
              f"median staff spacing AT THE ENCODER {statistics.median(effs):.1f} px)")
        print(f"           padding ink: median {statistics.median(pad_ink):.1%}, "
              f"max {max(pad_ink):.1%}, {dirty} strips over 10% "
              f"(blank staff is 4.6%, a barline column 36%)")


def _pad_ink_by_strip(src_dir: Path, pad_dir: Path) -> dict[str, float]:
    """Ink fraction of the padding each strip received — the sensitivity filter's input.

    ~25 of the 326 exam crops are too dense to HAVE a quiet window, so their padding tiles a slice
    carrying part of a symbol (a repeating comb, visible by eye). Those strips are the probe's
    weakest point, so the curve is reported with and without them rather than only pooled.
    """
    import cv2

    out: dict[str, float] = {}
    for line in (src_dir / "manifest.jsonl").read_text().splitlines():
        if not line.strip():
            continue
        name = json.loads(line)["image"]
        src, pad_img = cv2.imread(str(src_dir / name)), cv2.imread(str(pad_dir / name))
        if src is None or pad_img is None:
            continue
        w0 = src.shape[1]
        if pad_img.shape[1] <= w0:
            continue
        out[name] = float((pad_img[:, w0:, 0] < 128).mean())
    return out


def _edits_by_strip(dump: Path) -> dict[str, int]:
    """{strip -> edits} from one `eval_omr.py --show-errors N` dump. Absent from the dump = 0."""
    return {n: edit_distance(tokenize(w), tokenize(g))
            for n, (w, g) in parse_error_dump(dump).items()}


def compare(root: Path, src_dir: Path, reps: int = 10000, seed: int = 0) -> None:
    """Read the sweep's `eval_<tag>.txt` dumps and print the dose curve + a PAIRED bootstrap CI.

    WHY A BOOTSTRAP. The pre-registration (docs/rung3/levers.md) reads "monotone rise -> causal,
    flat within noise -> confound" but never says what the noise IS. Greedy decode is deterministic,
    so there is no run-to-run noise at all — the only sampling error is over WHICH strips are in the
    pool. Padding does not change a strip's filename, so every factor is measured on the same 326
    images and the comparison is naturally PAIRED: resample strip names, not strips-within-factor.

    ⚠ Absolute totals here are this file's own re-alignment (433 where eval_omr says 562 — different
    tokenizer, different aligner). The DELTA is what this function is for; quote eval_omr for totals.
    """
    import random
    import statistics as st

    dumps = sorted(root.glob("eval_pad*.txt"))
    if not dumps:
        print(f"no eval_pad*.txt in {root} — run the sweep first")
        return
    by_tag = {d.stem.replace("eval_", ""): _edits_by_strip(d) for d in dumps}
    base_tag = "pad100"
    if base_tag not in by_tag:
        print(f"no {base_tag} dump — the unpadded anchor is required")
        return
    names = sorted({n for line in (src_dir / "manifest.jsonl").read_text().splitlines()
                    if line.strip() for n in [json.loads(line)["image"]]})
    base = by_tag[base_tag]

    # Measured on the WIDEST factor, where the tiling repeats most and the artifact is worst; a
    # strip clean there is clean everywhere, so one pass names the tail for every factor.
    dirty: dict[str, float] = {}
    widest = max((root / d.stem.replace("eval_", "") for d in dumps
                  if (root / d.stem.replace("eval_", "")).is_dir()),
                 key=lambda p: int(p.name.replace("pad", "")), default=None)
    if widest is not None:
        dirty = {n: v for n, v in _pad_ink_by_strip(src_dir, widest).items() if v > 0.10}

    for label, pool in (("ALL STRIPS", names),
                        ("CLEAN PADDING ONLY (drops the no-quiet-window tail)",
                         [n for n in names if n not in dirty])):
        if label.startswith("CLEAN") and not dirty:
            continue
        print(f"\n== {label}  (n={len(pool)})")
        print(f"{'factor':>7} {'edits':>7} {'ed/token':>9} {'perfect':>8} "
              f"{'Δ vs pad100':>12} {'95% CI':>18}")
        gold = sum(len(tokenize(json.loads(line)["label"]))
                   for line in (src_dir / "manifest.jsonl").read_text().splitlines()
                   if line.strip() and json.loads(line)["image"] in set(pool))
        for tag in sorted(by_tag):
            cur = by_tag[tag]
            tot = sum(cur.get(n, 0) for n in pool)
            perfect = 100 * sum(1 for n in pool if not cur.get(n, 0)) / len(pool)
            if tag == base_tag:
                print(f"{tag:>7} {tot:7d} {tot / max(1, gold):9.4f} {perfect:7.0f}% "
                      f"{'—':>12} {'(anchor)':>18}")
                continue
            diffs = [cur.get(n, 0) - base.get(n, 0) for n in pool]
            rng = random.Random(seed)
            boot = sorted(st.fmean(rng.choices(diffs, k=len(diffs))) for _ in range(reps))
            lo, hi = boot[int(0.025 * reps)], boot[int(0.975 * reps)]
            print(f"{tag:>7} {tot:7d} {tot / max(1, gold):9.4f} {perfect:7.0f}% "
                  f"{st.fmean(diffs):+12.3f} {f'[{lo:+.3f}, {hi:+.3f}]':>18}")
    if dirty:
        print(f"\n⚠ {len(dirty)} strips had no quiet window and were padded with symbol fragments "
              f"(>10% ink). Both readings are printed above; they agree or the probe is weak.")
    print("\n⚠ totals are THIS FILE's re-alignment, not eval_omr's — use the deltas, quote eval_omr "
          "for absolutes")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strips-dir", default="data/real/rung3/strips_exam_v2_clean")
    ap.add_argument("--errors", default="data/colab/round2-exam-errors.txt",
                    help="a spent `eval_omr.py --show-errors` dump for the same strips dir")
    ap.add_argument("--make-padded", metavar="OUTDIR", default=None,
                    help="causal mode: write width-padded copies instead of analysing")
    ap.add_argument("--factors", default="1.25,1.5,2.0")
    ap.add_argument("--compare", metavar="PADROOT", default=None,
                    help="read PADROOT/eval_pad*.txt (the sweep's dumps) and print the dose curve "
                         "with a paired bootstrap CI per factor")
    args = ap.parse_args()

    strips_dir = Path(args.strips_dir)
    if args.compare:
        compare(Path(args.compare), strips_dir)
        return 0
    if args.make_padded:
        make_padded(strips_dir, Path(args.make_padded),
                    [float(x) for x in args.factors.split(",")])
        print("\nnext: eval_omr.py --strips-dir <each pad dir> --split none, and compare "
              "edits/token against the unpadded read")
        return 0

    rows = load(strips_dir, parse_error_dump(Path(args.errors)))
    print(f"== {len(rows)} strips from {strips_dir}, {sum(r['edits'] for r in rows)} edits "
          f"by this script's own re-alignment")
    print("   ⚠ this re-alignment is not eval_omr's: use the TREND, and quote eval_omr for totals")

    bucket([r for r in rows if r["n"] >= 10], "ALL, >=10 gold tokens (drops the short-crop hole)", k=4)
    bucket([r for r in rows if 10 <= r["n"] / r["w"] * 1000 <= 14 and r["n"] >= 8],
           "DENSITY HELD (10-14 gold tokens per 1000 px)")
    bucket([r for r in rows if 12 <= r["n"] <= 18], "LENGTH HELD (12-18 gold tokens)")
    bucket([r for r in rows if 900 <= r["w"] <= 1150], "WIDTH HELD (900-1150 px) — expect NO trend",
           key="n")
    bucket([r for r in rows if r["n"] < 10], "SHORT CROPS (<10 gold tokens) — the known hole", k=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
