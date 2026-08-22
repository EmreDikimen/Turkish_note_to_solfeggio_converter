"""Measure fill — a LABEL-FREE correctness proxy for a decoded strip.

Why this exists. The app's dense-page bug (docs/METRICS-SLICER-WINDOWS.md) is *silent*: when a
strip's true label needs more ids than the decoder can emit, the model writes `</s>` early and
*confidently*, so `hit_cap` catches 7 of 4,012 and `min_logprob` stays healthy. Judging whether
`?dense=` fixes it needs an accuracy signal, and there is no gold for the pages that matter.

The proxy. The slicer cuts a strip on BARLINES, so the manifest already knows how many measures a
crop holds. Music is metrical, so those measures each hold the same amount of time. A decode that
drops notes therefore comes up SHORT against a quantity nobody had to label:

    fill = (sounding beats the decode spells) / (n_measures x the page's meter)

An early `</s>` under-fills. Nothing else in the pipeline produces that signature at scale.

What it is NOT. It cannot see a wrong PITCH, a wrong accidental, or two errors that cancel (an 8th
read as two 16ths fills identically). It is a floor on the error rate, never the error rate — and
`--calibrate` measures how loose a floor by running the same scorer over hand-verified GOLD, where
every row is correct by construction and every failure is the proxy's own.

The meter is derived PER PAGE, from the page's own decodes (the modal beats-per-measure), so no
piece match, no usul table and no labelling is involved. A page whose decodes do not agree on a
meter is reported as unscorable rather than guessed at.

    .venv-ml/bin/python scripts/rung3/measure_fill_score.py --calibrate data/real/rung3/_realval_v2/manifest.jsonl
    .venv-ml/bin/python scripts/rung3/measure_fill_score.py --decode-root data/real/strips_v2
    .venv-ml/bin/python scripts/rung3/measure_fill_score.py --decode-root A --compare B
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path

# Token splitting is `rule_fix_notafull.py`'s, verbatim in intent: the decoded column glues a
# backslash token to its successor (`\sigendg''8`), so the names are split off longest-first.
_BACKSLASH = sorted(
    ["komaSharp", "bakiyeSharp", "kucukSharp", "buyukSharp",
     "komaFlat", "bakiyeFlat", "kucukFlat", "buyukFlat", "natural", "sigend", "sig",
     "repstart", "repend", "volta1", "volta2", "segno", "coda", "dc", "fine",
     "tup3", "tupend", "tie", "grace"], key=len, reverse=True)
_SPLIT_RE = re.compile(r"(\\(?:" + "|".join(_BACKSLASH) + r")|\|)")

NOTE = re.compile(r"^([a-g])([',]*)(1|2|4|8|16|32|64)(\.?)$")
REST = re.compile(r"^r(1|2|4|8|16|32|64)(\.?)$")


def toks(s: str) -> list[str]:
    return [t for t in _SPLIT_RE.sub(r" \1 ", s).split() if t]


def _written(t: str) -> Fraction | None:
    """The WRITTEN duration of one token, in whole notes. None for anything that is not a note."""
    m = NOTE.match(t) or REST.match(t)
    if not m:
        return None
    g = m.groups()
    base, dot = (g[2], g[3]) if len(g) == 4 else (g[0], g[1])
    f = Fraction(1, int(base))
    return f * Fraction(3, 2) if dot else f


def sounding_beats(label: str) -> Fraction | None:
    """Total SOUNDING duration of a label, in whole notes — or None if it cannot be read.

    Four things carry no measure time and are skipped, each for its own reason:
      * accidentals, repeat and navigation marks and `|` are not durations at all;
      * a `\\sig ... \\sigend` block is a key signature — its accidentals name pitches, not notes;
      * the note after `\\grace` is an ornament, which SymbTr gives no duration of its own;
      * `\\tie` is retired (2026-08-22) and only appears in labels written before that, where it
        JOINS two written notes whose durations already sum correctly — so it is skipped, not
        subtracted.
    Inside `\\tup3 ... \\tupend` the written values sound at 2/3, which is the whole reason this
    walks the tokens instead of summing them.
    """
    total = Fraction(0)
    in_sig = False
    in_tup = False
    grace_next = False
    for t in toks(label):
        if t == "\\sig":
            in_sig = True
            continue
        if t == "\\sigend":
            in_sig = False
            continue
        if in_sig:
            continue
        if t == "\\tup3":
            in_tup = True
            continue
        if t == "\\tupend":
            in_tup = False
            continue
        if t == "\\grace":
            grace_next = True
            continue
        d = _written(t)
        if d is None:
            continue  # accidental / repeat / nav / bar / \tie — no time
        if grace_next:
            grace_next = False
            continue  # the ornament itself
        total += d * Fraction(2, 3) if in_tup else d
    # An unclosed `\tup3` is a known hallucination of this model, and it would silently scale the
    # rest of the strip by 2/3 — refuse the row rather than report a fill it invented.
    return None if in_tup else total


def page_meter(rows: list[tuple[int, Fraction]]) -> Fraction | None:
    """The page's beats-per-measure, as the MODE of each strip's beats/measure.

    Derived rather than looked up, so no piece match or usul table is needed. A page has to agree
    with itself to be scored: the mode must be held by more than half the strips, otherwise the
    decodes disagree about the meter and any fill computed from one of them is circular.
    """
    per = Counter(Fraction(b, n) for n, b in rows if n > 0)
    if not per:
        return None
    meter, hits = per.most_common(1)[0]
    return meter if hits * 2 > sum(per.values()) else None


def score_rows(rows: list[dict], meter: Fraction | None = None) -> dict:
    """rows: {n_measures, beats, hit_cap, ...} already grouped into ONE page.

    `meter` overrides the derivation. It exists for the calibration set: `_realval_v2` samples 1-4
    strips from a page, and a mode over three numbers cannot establish anything — 65 of its 87
    pages were unscorable for that reason alone, which measures the SAMPLE, not the proxy. Passing
    the meter derived from the page's full decode restores the n without changing the test.
    """
    usable = [(r["n_measures"], r["beats"]) for r in rows if r["beats"] is not None]
    meter = meter if meter is not None else page_meter(usable)
    out = {"meter": meter, "strips": len(rows), "scored": 0,
           "exact": 0, "under": 0, "over": 0, "unreadable": 0, "detail": []}
    if meter is None:
        out["unreadable"] = len(rows)
        return out
    for r in rows:
        if r["beats"] is None or r["n_measures"] <= 0:
            out["unreadable"] += 1
            continue
        want = meter * r["n_measures"]
        fill = Fraction(r["beats"], 1) / want if want else None
        if fill is None:
            out["unreadable"] += 1
            continue
        out["scored"] += 1
        if fill == 1:
            out["exact"] += 1
        elif fill < 1:
            out["under"] += 1
        else:
            out["over"] += 1
        out["detail"].append({**r, "fill": float(fill)})
    return out


def load_decode_root(root: Path, stems: set[str] | None) -> dict[str, list[dict]]:
    """Every cached page decode under `root`, grouped by page stem.

    ⚠ `split_wide` strips are EXCLUDED, not counted as failures: they are fragments of one
    over-wide measure cut at a whitespace gutter, so no whole number of measures describes them
    and `n_measures` lies about their content by construction.
    """
    pages: dict[str, list[dict]] = {}
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        if stems is not None and d.name not in stems:
            continue
        f = d / f"{d.name}_decode.json"
        if not f.exists():
            continue
        j = json.loads(f.read_text())
        # `est_tokens` lives in the slicer manifest, not the decode cache — same directory, same
        # strip names, written by the same run, so this join is safe where a cross-root one is not.
        man = d / f"{d.name}_manifest.json"
        est: dict[str, float] = {}
        if man.exists():
            for m in json.loads(man.read_text()):
                if m.get("strip") is not None:
                    est[m["strip"]] = float(m.get("est_tokens", 0.0))
        rows = []
        for s in j.get("strips", []):
            if s.get("split_wide"):
                continue
            rows.append({
                "strip": s.get("strip"),
                "n_measures": int(s.get("n_measures", 0)),
                "beats": sounding_beats(s.get("tokens", "")),
                "n_ids": s.get("n_ids"),
                "hit_cap": bool(s.get("hit_cap")),
                "min_logprob": s.get("min_logprob"),
                "est_tokens": est.get(s.get("strip")),
            })
        if rows:
            pages[d.name] = rows
    return pages


def measure_counts(root: Path) -> dict[str, int]:
    """strip filename -> `n_measures`, from the slicer manifests under `root`.

    ⚠ Keyed on the FILENAME, which is only safe because the caller passes the root the labels were
    cut from — a strip name survives a re-slice and its pixels do not. `_realval_v2` was built on
    `strips_v2`, so that is its root and no other.
    """
    out: dict[str, int] = {}
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        f = d / f"{d.name}_manifest.json"
        if not f.exists():
            continue
        for r in json.loads(f.read_text()):
            if r.get("strip") and not r.get("split_wide"):
                out[r["strip"]] = int(r.get("n_measures", 0))
    return out


def load_gold(manifest: Path, spans: dict[str, int] | None = None) -> dict[str, list[dict]]:
    """A hand-verified manifest.jsonl, grouped by page — the CALIBRATION set.

    The measure count comes from the manifest, never from reading the label: `from`/`to` are
    inclusive measure indices where the row carries them, and `spans` (the slicer manifest, joined
    by strip filename) covers the rest. In `_realval_v2` only 47 of 267 rows carry the span, purely
    because they were written by a different promoter — scoring only those would measure the
    provenance of the file, not the proxy.
    """
    pages: dict[str, list[dict]] = defaultdict(list)
    for line in manifest.read_text().splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        if "from" in r and "to" in r:
            n = int(r["to"]) - int(r["from"]) + 1
        else:
            n = (spans or {}).get(r.get("image", ""), 0)
        pages[r.get("page", "?")].append({
            "strip": r.get("image"),
            "n_measures": n,
            "beats": sounding_beats(r.get("label", "")),
            "n_ids": None,
            "hit_cap": False,
            "min_logprob": r.get("min_logprob"),
        })
    return dict(pages)


def report(name: str, pages: dict[str, list[dict]],
           meters: dict[str, Fraction] | None = None) -> dict:
    tot = Counter()
    details: list[dict] = []
    no_meter = 0
    for stem, rows in pages.items():
        s = score_rows(rows, (meters or {}).get(stem))
        if s["meter"] is None:
            no_meter += 1
        for k in ("strips", "scored", "exact", "under", "over", "unreadable"):
            tot[k] += s[k]
        for d in s["detail"]:
            details.append({**d, "page": stem})
    n = max(1, tot["scored"])
    print(f"\n== {name}")
    print(f"  pages {len(pages)}   strips {tot['strips']}   scored {tot['scored']}"
          f"   unreadable {tot['unreadable']}   pages with no agreed meter {no_meter}")
    print(f"  fills exactly   {tot['exact']:>6}/{tot['scored']}  ({100 * tot['exact'] / n:.1f}%)")
    print(f"  UNDER-fills     {tot['under']:>6}/{tot['scored']}  ({100 * tot['under'] / n:.1f}%)"
          f"   <- the early-`</s>` signature")
    print(f"  over-fills      {tot['over']:>6}/{tot['scored']}  ({100 * tot['over'] / n:.1f}%)")
    # The two signals that were supposed to catch this, on the same strips.
    bad = [d for d in details if d["fill"] != 1.0]
    if bad and bad[0]["n_ids"] is not None:
        caps = sum(1 for d in bad if d["hit_cap"])
        lp = sum(1 for d in bad if (d["min_logprob"] or 0) < -1.0)
        print(f"  of the {len(bad)} misfilled: hit_cap fires on {caps} ({100 * caps / len(bad):.1f}%),"
              f" min_logprob < -1.0 on {lp} ({100 * lp / len(bad):.1f}%)")
    # Does the under-filling sit where the estimator says the label cannot fit? If it does not, the
    # proxy and the rail are aimed at different things and the rail cannot be expected to move it.
    withest = [d for d in details if d.get("est_tokens") is not None]
    if withest:
        for lo, hi, lab in ((0, 59, "est_tokens <= 59 (fits)"), (59, 1e9, "est_tokens >  59 (cannot fit)")):
            g = [d for d in withest if lo < d["est_tokens"] <= hi or (lo == 0 and d["est_tokens"] <= hi)]
            u = sum(1 for d in g if d["fill"] < 1.0)
            if g:
                print(f"  {lab:<30} under-fills {u:>5}/{len(g)}  ({100 * u / len(g):.1f}%)")
    return {"tot": tot, "details": details}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--decode-root", type=Path, help="a strips root holding *_decode.json caches")
    ap.add_argument("--compare", type=Path, help="a second decode root, scored on SHARED pages only")
    ap.add_argument("--calibrate", type=Path,
                    help="a hand-verified manifest.jsonl — measures the proxy's own false-alarm rate")
    ap.add_argument("--stems", type=Path, help="file of page stems, one per line, to restrict to")
    ap.add_argument("--meter-from", type=Path,
                    help="derive each page's meter from the FULL page decodes under this root "
                         "instead of from the rows being scored — for --calibrate, whose pages "
                         "hold too few sampled strips to establish one")
    ap.add_argument("--dump", type=Path, help="write the per-strip detail as JSON")
    args = ap.parse_args()

    stems = None
    if args.stems:
        stems = {l.strip() for l in args.stems.read_text().splitlines() if l.strip()}

    meters: dict[str, Fraction] = {}
    if args.meter_from:
        for stem, rows in load_decode_root(args.meter_from, stems).items():
            m = page_meter([(r["n_measures"], r["beats"]) for r in rows if r["beats"] is not None])
            if m is not None:
                meters[stem] = m
        print(f"meters derived from {args.meter_from}: {len(meters)} page(s)")

    out: dict = {}
    if args.calibrate:
        spans = measure_counts(args.meter_from) if args.meter_from else None
        out["calibrate"] = report(f"CALIBRATION — gold labels, {args.calibrate}",
                                  load_gold(args.calibrate, spans), meters)["details"]
        print("\n  ⚠ Every row above is hand-verified, so everything not filling exactly is the"
              "\n    PROXY's error, not the model's. Read the arms below against this floor.")
    if args.decode_root:
        a = load_decode_root(args.decode_root, stems)
        if args.compare:
            b = load_decode_root(args.compare, stems)
            shared = sorted(set(a) & set(b))
            print(f"\npaired on {len(shared)} shared pages ({len(a)} vs {len(b)} available)")
            a = {k: a[k] for k in shared}
            b = {k: b[k] for k in shared}
            ra = report(f"ARM A — {args.decode_root}", a)
            rb = report(f"ARM B — {args.compare}", b)
            da, db = ra["tot"], rb["tot"]
            ua = 100 * da["under"] / max(1, da["scored"])
            ub = 100 * db["under"] / max(1, db["scored"])
            print(f"\n== PAIRED: under-fill {ua:.1f}% -> {ub:.1f}%  ({ua - ub:+.1f} pp)")
            print("  ⚠ The two arms cut different crops, so the strips are NOT paired one to one —"
                  "\n    only the pages are. Read this as two rates on one page set.")
            out["a"], out["b"] = ra["details"], rb["details"]
        else:
            out["a"] = report(f"{args.decode_root}", a)["details"]
    if not out:
        ap.error("give --calibrate and/or --decode-root")
    if args.dump:
        args.dump.write_text(json.dumps(out, indent=1, default=str))
        print(f"\nwrote {args.dump}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
