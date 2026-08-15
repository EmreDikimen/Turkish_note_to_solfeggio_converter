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

  --make-padded  CAUSAL. Write a copy of a strips dir with each PNG extended on the RIGHT by
  BORDER_REPLICATE (which continues the staff lines and adds no symbol), leaving the manifest —
  and therefore the gold label — untouched. Padding lowers the effective resolution WITHOUT
  changing the content or the sequence length, so decoding the padded copies with `eval_omr.py`
  turns the correlation below into a dose-response curve. Pre-registered reading:

      edits/token rises monotonically with the pad factor  -> resolution is causal, act on it
      flat within noise                                    -> the correlation is a confound, drop it

  ⚠ Replication is not free of artifacts: it also stretches whatever the last column holds. Crops
  end ~6 px past a barline (PAD_PX), so that column is normally blank staff — inspect a few of the
  written PNGs before believing the curve.

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


def make_padded(strips_dir: Path, out_root: Path, factors: list[float]) -> None:
    """Widen every strip by BORDER_REPLICATE; labels and manifest unchanged."""
    import cv2

    for f in factors:
        out = out_root / f"pad{int(round(f * 100))}"
        (out).mkdir(parents=True, exist_ok=True)
        shutil.copy(strips_dir / "manifest.jsonl", out / "manifest.jsonl")
        n = 0
        for line in (strips_dir / "manifest.jsonl").read_text().splitlines():
            if not line.strip():
                continue
            name = json.loads(line)["image"]
            img = cv2.imread(str(strips_dir / name))
            add = int(round(img.shape[1] * (f - 1.0)))
            cv2.imwrite(str(out / name),
                        cv2.copyMakeBorder(img, 0, 0, 0, add, cv2.BORDER_REPLICATE))
            n += 1
        print(f"[written] {out}  ({n} strips, width x{f:.2f}, "
              f"median eff spacing {30.0 / f * min(BOX_H / 924, BOX_W / 336) * (924 / 924):.1f} px at W=924)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strips-dir", default="data/real/rung3/strips_exam_v2_clean")
    ap.add_argument("--errors", default="data/colab/round2-exam-errors.txt",
                    help="a spent `eval_omr.py --show-errors` dump for the same strips dir")
    ap.add_argument("--make-padded", metavar="OUTDIR", default=None,
                    help="causal mode: write width-padded copies instead of analysing")
    ap.add_argument("--factors", default="1.25,1.5,2.0")
    args = ap.parse_args()

    strips_dir = Path(args.strips_dir)
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
