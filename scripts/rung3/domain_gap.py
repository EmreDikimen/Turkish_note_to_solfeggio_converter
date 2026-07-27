"""
Synthetic-vs-real domain gap: one number per property, so a renderer change can be judged.

WHY: Round-3 work is about making synthetic strips resemble real printed pages. Every claim of
the form "our strips don't look like theirs" has to survive a measurement, and every renderer
change has to be re-measured the same way afterwards. This script is that measurement — run it
before a change and after it, and diff the two reports.

WHAT it compares (synthetic pool vs each real pool):
  geometry   staff-line spacing / thickness / vertical placement, and their SPREAD — the spread
             matters more than the mean, because the slicer normalises the mean away
  ink        how much ink falls OUTSIDE the staff band (lyrics, headers, tempo words, the
             neighbouring system bleeding in) — real crops are full of it
  density    strip width, notes and tokens per strip, share of near-empty crops
  content    note-value mix, dotted rate, octave mix, per-100-note rates of the \\-tokens
  beams      the beam grouping our renderer WOULD produce, from VexFlow's rule (see beam_groups)

IMPORTANT — measure what the model actually sees. The strips on disk are clean; training applies
`src/vision/augment.py` on top. Blur, ink-bleed and JPEG all thicken strokes and add variance, so
a raw-vs-real comparison overstates the geometry gap. Pass --augment to compare the augmented
synthetic pool instead; that is the honest comparison for anything ink- or stroke-related.

Run:
    .venv-ml/bin/python scripts/rung3/domain_gap.py --out data/real/rung3/domain_gap/base
    .venv-ml/bin/python scripts/rung3/domain_gap.py --augment --out .../base_aug
    .venv-ml/bin/python scripts/rung3/domain_gap.py --synth data/synthetic/strips_v5 --out .../v5
    .venv-ml/bin/python scripts/rung3/domain_gap.py --diff .../base.json .../v5.json
"""

from __future__ import annotations

import argparse
import collections
import json
import random
import re
import statistics as st
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "vision"))

DEFAULT_REAL = [
    ROOT / "data/real/rung3/strips_exam_v2_clean",
    ROOT / "data/real/rung3/strips_nota",
    ROOT / "data/real/rung3/strips_r1",
]

NOTE = re.compile(r"(?:^|\s)([a-g])('*|,*)(1|2|4|8|16|32|64)(\.*)(?=\s|$)")
NOTE_TOK = re.compile(r"^([a-gr])('*|,*)(1|2|4|8|16|32|64)(\.*)$")
ACCIDENTALS = ["\\komaSharp", "\\bakiyeSharp", "\\kucukSharp", "\\buyukSharp",
               "\\komaFlat", "\\bakiyeFlat", "\\kucukFlat", "\\buyukFlat"]
RATE_TOKENS = ["\\tie", "\\grace", "\\tup3", "\\natural", "|", "\\sig",
               "\\volta1", "\\volta2", "\\repstart", "\\repend"]

QUARTER = 4096
TICKS = {"1": 4 * QUARTER, "2": 2 * QUARTER, "4": QUARTER,
         "8": QUARTER // 2, "16": QUARTER // 4, "32": QUARTER // 8, "64": QUARTER // 16}


# -------------------------------------------------------------------------------------------
# pixel measurements
# -------------------------------------------------------------------------------------------

def staff_geometry(bw: np.ndarray):
    """(line ys, mean spacing, mean thickness) from the horizontal projection, or None.

    A staff line is a row inked across most of the width. Bands of such rows are grouped; the
    five thickest bands are the staff. Returns None when the strip is too degraded or skewed for
    five clean bands to exist — that failure rate is itself reported, since it is a property of
    the domain (real scans fail far more often than synthetic renders).
    """
    rows = np.where(bw.mean(axis=1) >= 0.55)[0]
    if len(rows) < 5:
        return None
    bands, cur = [], [rows[0]]
    for r in rows[1:]:
        if r - cur[-1] <= 2:
            cur.append(r)
        else:
            bands.append(cur)
            cur = [r]
    bands.append(cur)
    if len(bands) < 5:
        return None
    bands.sort(key=len, reverse=True)
    sel = sorted(bands[:5], key=lambda b: b[0])
    ys = [float(np.mean(b)) for b in sel]
    gaps = np.diff(ys)
    if gaps.min() <= 5 or gaps.max() / gaps.min() > 1.7:
        return None
    return ys, float(np.mean(gaps)), float(np.mean([len(b) for b in sel]))


def pixel_stats(img: np.ndarray, acc: dict) -> None:
    bw = img < 128
    h, w = bw.shape
    acc["width"].append(w)
    acc["ink"].append(float(bw.mean()))
    geo = staff_geometry(bw)
    if geo is None:
        acc["staff_fail"].append(1)
        return
    acc["staff_fail"].append(0)
    ys, sp, thick = geo
    acc["spacing"].append(sp)
    acc["thickness"].append(thick)
    acc["thickness_rel"].append(thick / sp)          # scale-free: how fat vs the staff
    acc["staff_top"].append(ys[0])
    # Ink outside the staff band = lyrics / headers / tempo text / the next system bleeding in.
    # The band keeps 2.2 staff spaces of headroom for noteheads, stems and beams.
    top, bot = int(ys[0] - 2.2 * sp), int(ys[4] + 2.2 * sp)
    outside = bw[: max(top, 0)].sum() + bw[min(bot, h):].sum()
    frac = outside / max(bw.sum(), 1)
    acc["outside_frac"].append(float(frac))
    acc["has_foreign_ink"].append(float(frac > 0.03))


# -------------------------------------------------------------------------------------------
# label measurements
# -------------------------------------------------------------------------------------------

def ticks_of(dur: str, dots: str) -> int:
    return int(TICKS[dur] * (2 - 0.5 ** len(dots)))


def beam_groups(label: str) -> list[int]:
    """Beam-group sizes VexFlow's DEFAULT rule yields for this label.

    Mirrors node_modules/vexflow/build/esm/src/beam.js: SheetView calls generateBeams(run) with
    no config, so groups default to [2/8] = one quarter note, the clock restarts at the first
    note of each measure, rests and >=quarter notes split a group, and a group of 1 prints a
    FLAG instead of a beam. Applying the rule to REAL labels answers "what would we have drawn
    for this content", which is the comparison that matters.
    """
    out: list[int] = []
    for chunk in re.split(r"\s\|\s|\\tup3|\\tupend", label):
        run = []
        for t in chunk.split():
            m = NOTE_TOK.match(t)
            if m:
                head, _, dur, dots = m.groups()
                tk = ticks_of(dur, dots)
                run.append((head == "r", tk, tk < QUARTER))
        groups, cur, carry = [], [], 0
        for note in run:
            cur.append(note)
            total = sum(n[1] for n in cur) + carry
            if total > QUARTER:
                nxt = []
                if note[1] < QUARTER:      # beamable notes move to the next group; longer ones stay
                    cur.pop()
                    nxt = [note]
                groups.append(cur)
                carry = total - QUARTER
                while carry >= QUARTER:
                    carry -= QUARTER
                cur = nxt
            elif total == QUARTER:
                groups.append(cur)
                carry = 0
                cur = []
        if cur:
            groups.append(cur)
        for g in groups:                   # rests / long notes split what survives as a beam
            temp = []
            for is_rest, tk, beamable in g:
                if is_rest or not beamable:
                    if temp:
                        out.append(len(temp))
                    temp = []
                else:
                    temp.append(1)
            if temp:
                out.append(len(temp))
    return out


def label_stats(label: str, acc: dict) -> None:
    toks = label.split()
    notes = NOTE.findall(label)
    acc["n_notes"].append(len(notes))
    acc["n_tokens"].append(len(toks))
    acc["few_notes"].append(float(len(notes) <= 3))
    acc["no_notes"].append(float(len(notes) == 0))
    for _, oct_, dur, dot in notes:
        acc["_dur"][dur + dot] += 1
        acc["_oct"][len(oct_)] += 1
        acc["_notes_total"][0] += 1
    acc["_tok"]["rest"] += sum(1 for t in toks if t.startswith("r") and NOTE_TOK.match(t))
    acc["_tok"]["acc"] += sum(toks.count(a) for a in ACCIDENTALS)
    for t in RATE_TOKENS:
        acc["_tok"][t] += toks.count(t)
    for g in beam_groups(label):
        acc["_beam"][min(g, 6)] += 1
        acc["_beam_total"][0] += 1


# -------------------------------------------------------------------------------------------
# pool driver
# -------------------------------------------------------------------------------------------

def measure_pool(d: Path, n: int, seed: int, augment, name: str) -> dict:
    rows = [json.loads(l) for l in (d / "manifest.jsonl").read_text().splitlines() if l.strip()]
    rng = random.Random(seed)
    sample = rng.sample(rows, min(n, len(rows)))
    acc = collections.defaultdict(list)
    acc["_dur"] = collections.Counter()
    acc["_oct"] = collections.Counter()
    acc["_tok"] = collections.Counter()
    acc["_beam"] = collections.Counter()
    acc["_notes_total"] = [0]
    acc["_beam_total"] = [0]
    used = 0
    for r in sample:
        p = d / r["image"]
        if not p.exists():
            continue
        img = Image.open(p).convert("RGB")
        arr = np.asarray(img)
        if augment is not None:
            arr = augment(arr.copy())
        pixel_stats(np.asarray(Image.fromarray(arr).convert("L")), acc)
        label_stats(r["label"], acc)
        used += 1
    return summarise(acc, used, name, len(rows))


def summarise(acc: dict, used: int, name: str, pool_size: int) -> dict:
    tot = max(acc["_notes_total"][0], 1)
    bt = max(acc["_beam_total"][0], 1)

    def m(k, f=np.mean):
        v = acc[k]
        return round(float(f(v)), 4) if len(v) else None

    def spread(k):
        v = acc[k]
        if not v:
            return None
        return round(float(np.percentile(v, 95) - np.percentile(v, 5)), 3)

    out = {
        "name": name, "pool_size": pool_size, "measured": used,
        "geometry": {
            "staff_detect_fail_%": m("staff_fail", lambda v: 100 * np.mean(v)),
            "spacing_px_mean": m("spacing"), "spacing_px_sd": m("spacing", np.std),
            "spacing_px_p5_p95_spread": spread("spacing"),
            "thickness_px_mean": m("thickness"), "thickness_px_sd": m("thickness", np.std),
            "thickness_rel_to_spacing": m("thickness_rel"),
            "staff_top_y_sd": m("staff_top", np.std),
            "staff_top_y_p5_p95_spread": spread("staff_top"),
        },
        "ink": {
            "ink_fraction": m("ink"),
            "outside_band_%_of_ink": m("outside_frac", lambda v: 100 * np.mean(v)),
            "strips_with_foreign_ink_%": m("has_foreign_ink", lambda v: 100 * np.mean(v)),
        },
        "density": {
            "strip_width_px_mean": m("width"), "strip_width_px_median": m("width", np.median),
            "notes_per_strip": m("n_notes"), "tokens_per_strip": m("n_tokens"),
            "strips_<=3_notes_%": m("few_notes", lambda v: 100 * np.mean(v)),
            "strips_0_notes_%": m("no_notes", lambda v: 100 * np.mean(v)),
        },
        "content_%_of_notes": {
            **{f"dur_{k}": round(100 * acc["_dur"][k] / tot, 2)
               for k in ["1", "2", "2.", "4", "4.", "8", "8.", "16", "16.", "32"]},
            "dotted_any": round(100 * sum(v for k, v in acc["_dur"].items() if "." in k) / tot, 2),
            **{f"octave_{k}": round(100 * acc["_oct"][k] / tot, 2) for k in sorted(acc["_oct"])},
        },
        "per_100_notes": {k: round(100 * acc["_tok"][k] / tot, 2)
                          for k in ["rest", "acc"] + RATE_TOKENS},
        "beam_groups_%": {
            **{f"size_{k}": round(100 * acc["_beam"][k] / bt, 1) for k in range(1, 6)},
            "size_6+": round(100 * acc["_beam"][6] / bt, 1),
        },
    }
    return out


# -------------------------------------------------------------------------------------------
# reporting
# -------------------------------------------------------------------------------------------

def flatten(rep: dict) -> dict:
    flat = {}
    for section, vals in rep.items():
        if isinstance(vals, dict):
            for k, v in vals.items():
                flat[f"{section}.{k}"] = v
    return flat


def render_table(reports: list[dict]) -> str:
    cols = [r["name"] for r in reports]
    flats = [flatten(r) for r in reports]
    keys = list(flats[0])
    w = max(len(k) for k in keys) + 2
    lines = [" " * w + "".join(f"{c:>13}" for c in cols),
             " " * w + "".join(f"{'-' * 11:>13}" for _ in cols)]
    section = None
    for k in keys:
        s = k.split(".")[0]
        if s != section:
            section = s
            lines.append(f"-- {s} " + "-" * (w + 13 * len(cols) - len(s) - 4))
        cells = []
        for f in flats:
            v = f.get(k)
            cells.append(f"{v:>13}" if v is not None else f"{'-':>13}")
        lines.append(f"{k.split('.', 1)[1]:<{w}}" + "".join(cells))
    return "\n".join(lines)


def render_diff(before: dict, after: dict) -> str:
    """Before/after for the SYNTHETIC pool, with the real pools' values as the target."""
    b_syn, a_syn = before["reports"][0], after["reports"][0]
    reals = after["reports"][1:]
    fb, fa = flatten(b_syn), flatten(a_syn)
    freals = [flatten(r) for r in reals]
    keys = list(fb)
    w = max(len(k) for k in keys) + 2
    head = (" " * w + f"{'BEFORE':>11}{'AFTER':>11}{'move':>9}   " +
            "".join(f"{r['name']:>13}" for r in reals) + "   verdict")
    lines = [head, "-" * len(head)]
    section = None
    for k in keys:
        s = k.split(".")[0]
        if s != section:
            section = s
            lines.append(f"-- {s} " + "-" * 40)
        vb, va = fb.get(k), fa.get(k)
        if not isinstance(vb, (int, float)) or not isinstance(va, (int, float)):
            continue
        targets = [f.get(k) for f in freals if isinstance(f.get(k), (int, float))]
        cells = "".join(f"{t:>13}" for t in targets)
        verdict = ""
        if targets:
            tgt = float(np.mean(targets))
            gap_b, gap_a = abs(vb - tgt), abs(va - tgt)
            if abs(gap_a - gap_b) < 1e-9:
                verdict = "="
            elif gap_a < gap_b:
                verdict = f"CLOSER  ({gap_b:.3g} -> {gap_a:.3g})"
            else:
                verdict = f"further ({gap_b:.3g} -> {gap_a:.3g})"
        lines.append(f"{k.split('.', 1)[1]:<{w}}{vb:>11}{va:>11}{va - vb:>+9.3g}   {cells}   {verdict}")
    return "\n".join(lines)


def contact_sheet(pools: list[tuple[str, Path]], out: Path, per_pool: int, seed: int, augment) -> None:
    """One PNG per pool, same scale, so synthetic and real can be eyeballed side by side."""
    out.mkdir(parents=True, exist_ok=True)
    for name, d in pools:
        rows = [json.loads(l) for l in (d / "manifest.jsonl").read_text().splitlines() if l.strip()]
        sel = random.Random(seed).sample(rows, min(per_pool, len(rows)))
        ims = []
        for r in sel:
            p = d / r["image"]
            if not p.exists():
                continue
            im = Image.open(p).convert("RGB")
            if augment is not None and "synth" in name.lower():
                im = Image.fromarray(augment(np.asarray(im).copy()))
            ims.append(im.convert("L"))
        if not ims:
            continue
        W = 1200
        ims = [i.resize((W, max(1, int(i.height * W / i.width))), Image.LANCZOS) for i in ims]
        canvas = Image.new("L", (W, sum(i.height + 10 for i in ims)), 190)
        y = 0
        for i in ims:
            canvas.paste(i, (0, y))
            y += i.height + 10
        canvas.save(out / f"sheet_{name.replace(' ', '_')}.png")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--synth", default=str(ROOT / "data/synthetic/strips_v4"))
    ap.add_argument("--real", nargs="*", default=[str(p) for p in DEFAULT_REAL])
    ap.add_argument("--n", type=int, default=300, help="strips sampled per pool")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--augment", action="store_true",
                    help="apply src/vision/augment.py to the synthetic pool — what the model sees")
    ap.add_argument("--sheets", type=int, default=6, help="strips per contact sheet (0 = skip)")
    ap.add_argument("--out", default=None, help="write <out>.json / <out>.txt / <out>_sheets/")
    ap.add_argument("--diff", nargs=2, metavar=("BEFORE.json", "AFTER.json"),
                    help="print a before/after table from two saved reports and exit")
    args = ap.parse_args()

    if args.diff:
        before = json.loads(Path(args.diff[0]).read_text())
        after = json.loads(Path(args.diff[1]).read_text())
        print(render_diff(before, after))
        return 0

    augment = None
    if args.augment:
        import numpy as _np
        from augment import Augmenter
        random.seed(args.seed)
        _np.random.seed(args.seed)
        augment = Augmenter(seed=args.seed)

    pools = [(f"SYNTH{'+aug' if args.augment else ''}", Path(args.synth))]
    pools += [(Path(p).name.replace("strips_", "").replace("_v2_clean", ""), Path(p)) for p in args.real]
    pools = [(n, d) for n, d in pools if (d / "manifest.jsonl").exists()]

    reports = []
    for name, d in pools:
        print(f"[measuring] {name}  ({d})", file=sys.stderr)
        reports.append(measure_pool(d, args.n, args.seed, augment if name.startswith("SYNTH") else None, name))

    table = render_table(reports)
    print(table)
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.with_suffix(".json").write_text(json.dumps(
            {"synth": args.synth, "augment": args.augment, "n": args.n, "reports": reports}, indent=1))
        out.with_suffix(".txt").write_text(table + "\n")
        if args.sheets:
            contact_sheet(pools, Path(str(out) + "_sheets"), args.sheets, args.seed, augment)
        print(f"\n[saved] {out}.json / {out}.txt" + (f" / {out}_sheets/" if args.sheets else ""),
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
