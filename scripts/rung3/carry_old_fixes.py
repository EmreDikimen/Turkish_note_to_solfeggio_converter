#!/usr/bin/env python3
"""Find the OLD pools' human `fix` labels again inside the B8 re-emit, and mark them.

The problem this exists for (docs/METRICS-CORPUS.md, docs/BACKLOG.md item 4): `strips_b8` re-cut
the three training pools onto the CURRENT crops, and the ~1,479 labels a human corrected by hand
in `strips_nota` / `strips_r1` / `strips_tup` DID NOT come with them. They are the most expensive
rows this project owns and they are sitting on retired crops.

⛔ THIS SCRIPT WRITES NO VERDICT AND NO LABEL. It adds three HINT columns to the b8 queues so the
reviewer can see, beside the picture, what a person once typed for the same music:

    oldfix       the corrected label the human wrote in the old pool
    oldfix_kind  span | name  — how confident the match is (read the next paragraph)
    oldfix_src   <pool>/<strip> the correction came from

A hint is not a verdict, for the same reason the exam's carried gold is not one: a label written
against a crop that cut a beamed group in half is a reading of a truncated picture. The reviewer
confirms it against the NEW crop or types something else.

THE KEY, AND WHY IT IS NOT THE FILENAME
---------------------------------------
A strip filename survives a re-slice and its pixels do not — 248 of these fixes name a b8 strip
that the emitter DROPPED, and the standing trap is a name matching different music. So the primary
key is the measure span the slicer itself recorded, read out of each crop root's per-page
`<page>_manifest.json`:

    (page, system, meas_from, meas_to)

⚠ Those measure indices are ROW-LOCAL (they restart at 0 on every staff row), so `system` is part
of the key and the key is only meaningful when both slicers found the SAME NUMBER OF ROWS on the
page. On 654 of 1,779 shared pages they did not — those pages are refused, not guessed.

⚠ The key is a proxy for "the same music", so it was validated against the one place a real SymbTr
measure span exists on both sides (rows accepted by both emitters, `manifest.jsonl` `from`/`to`):
where this key says SAME, the SymbTr span agrees on **1,002 of 1,026 (97.7%)**; where it says
DIFFERENT, 35 of 36 really are different. That is the number `oldfix_kind=span` is worth.

`oldfix_kind=name` is the weaker fallback: the filename exists in b8 but the span does not match,
or the page's row count changed so no span comparison is possible. Those are shown with a warning
in the review UI and must be read against the picture with extra care — this is exactly the
population the 248-row trap lives in.

Run:
    .venv-ml/bin/python scripts/rung3/carry_old_fixes.py            # report only, writes nothing
    .venv-ml/bin/python scripts/rung3/carry_old_fixes.py --apply    # + annotate the b8 queues
                                                                    # + write old_fix_carry.csv

`--apply` is idempotent and safe to run while the review UI is open on another queue: every
existing column, row and verdict is preserved byte-for-byte, a `.bak-oldfix` backup is written
beside each file, and the write is atomic (temp file + rename).
"""
from __future__ import annotations

import argparse
import collections
import csv
import json
import os
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

OLD_POOLS = ["strips_nota", "strips_r1", "strips_tup"]
# Where a human verdict can live in a pool. All three carry the same `verdict`/`corrected_label`
# columns; a strip may appear in more than one, and the first one seen wins (they agree).
VERDICT_FILES = ["full_audit.csv", "emit_review.csv", "emit_audit.csv"]

OLD_ROOT = "data/real/strips"        # the 2026-07-11..17 slicer — where the old pools were cut
NEW_ROOT = "data/real/strips_v2"     # the 2026-07-29 re-slice — where b8 was cut
B8 = "data/real/rung3/strips_b8"

HINT_COLS = ["oldfix", "oldfix_kind", "oldfix_src"]


def page_index(root: Path) -> dict[str, dict]:
    """page -> {strip: (system, meas_from, meas_to)}, plus the page's staff-row count.

    Read from the slicer's own per-page manifest, so nothing here re-derives geometry."""
    idx: dict[str, dict] = {}
    if not root.exists():
        raise SystemExit(f"ERROR: {root} missing")
    for pd in root.iterdir():
        mf = pd / f"{pd.name}_manifest.json"
        if not pd.is_dir() or not mf.exists():
            continue
        try:
            rows = json.load(mf.open())
        except (OSError, ValueError):
            continue
        idx[pd.name] = {
            "by": {r["strip"]: (r["system"], r["meas_from"], r["meas_to"])
                   for r in rows if "meas_from" in r and "strip" in r},
            "rows": 1 + max((r["system"] for r in rows if "system" in r), default=-1),
        }
    return idx


def old_fixes(repo: Path) -> dict[str, dict]:
    """Every hand-typed correction in the three retired pools, keyed by strip filename."""
    out: dict[str, dict] = {}
    for pool in OLD_POOLS:
        for name in VERDICT_FILES:
            p = repo / "data/real/rung3" / pool / name
            if not p.exists():
                continue
            with p.open() as f:
                for r in csv.DictReader(f):
                    if (r.get("verdict") or "").strip() != "fix":
                        continue
                    corrected = (r.get("corrected_label") or "").strip()
                    if not corrected or r.get("strip") in out:
                        continue
                    out[r["strip"]] = {"pool": pool, "page": r.get("page", ""),
                                       "strip": r["strip"], "corrected": corrected}
    return out


def atomic_write(path: Path, fields: list[str], rows: list[dict]) -> None:
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    with os.fdopen(fd, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, path)


def annotate(path: Path, hints: dict[str, dict], apply: bool) -> tuple[int, int]:
    """Add the three hint columns to one queue CSV. Returns (rows marked, rows changed)."""
    with path.open() as f:
        rd = csv.DictReader(f)
        fields = list(rd.fieldnames or [])
        rows = list(rd)
    marked = changed = 0
    for r in rows:
        h = hints.get(r.get("strip", ""))
        want = {"oldfix": h["corrected"], "oldfix_kind": h["kind"], "oldfix_src": h["src"]} if h \
            else {c: "" for c in HINT_COLS}
        if h:
            marked += 1
        if any((r.get(c) or "") != want[c] for c in HINT_COLS):
            changed += 1
        r.update(want)
    if apply and (changed or any(c not in fields for c in HINT_COLS)):
        bak = path.with_suffix(path.suffix + ".bak-oldfix")
        if not bak.exists():
            bak.write_bytes(path.read_bytes())
        atomic_write(path, fields + [c for c in HINT_COLS if c not in fields], rows)
    return marked, changed


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="write the hint columns into the b8 queues (default: report only)")
    ap.add_argument("--repo", default=str(REPO))
    args = ap.parse_args()
    repo = Path(args.repo)

    old = page_index(repo / OLD_ROOT)
    new = page_index(repo / NEW_ROOT)
    shared = set(old) & set(new)
    same_rows = {p for p in shared if old[p]["rows"] == new[p]["rows"]}
    print(f"pages: {len(old)} old / {len(new)} new / {len(shared)} shared; "
          f"{len(same_rows)} agree on staff-row count (the rest cannot be span-matched)")

    # new-side lookup: (page, system, meas_from, meas_to) -> strips
    newkey: dict[tuple, list[str]] = collections.defaultdict(list)
    for pg, d in new.items():
        for s, k in d["by"].items():
            newkey[(pg,) + k].append(s)

    b8 = repo / B8
    accepted = {json.loads(l)["image"] for l in (b8 / "manifest.jsonl").open() if l.strip()}
    with (b8 / "emit_review.csv").open() as f:
        review = {r["strip"] for r in csv.DictReader(f)}
    dropped: dict[str, str] = {}
    with (b8 / "emit_drops.csv").open() as f:
        for r in csv.DictReader(f):
            dropped.setdefault(r["strip"], r.get("reason", "?"))

    fixes = old_fixes(repo)
    hints: dict[str, dict] = {}
    rows_out: list[dict] = []
    tab: collections.Counter = collections.Counter()
    collisions: list[tuple[str, str, str]] = []

    for strip, f in fixes.items():
        pg = f["page"]
        key = old.get(pg, {}).get("by", {}).get(strip)
        target, kind = None, "none"
        if pg in same_rows and key is not None:
            hits = newkey.get((pg,) + key, [])
            if strip in hits:            # same music AND the name happens to survive
                target, kind = strip, "span"
            elif hits:                   # same music under a different name — the re-slice moved it
                target, kind = hits[0], "span"
        if target is None and (strip in accepted or strip in review):
            target, kind = strip, "name"   # weak: name only, span says nothing or says no
        where = ("-" if target is None else
                 "b8-full" if target in accepted else
                 "b8-review" if target in review else "dropped")
        if target is not None and where in ("b8-full", "b8-review"):
            # Two old strips can land on one new one (the re-slice merged their measures). Keep the
            # stronger match rather than whichever was read last, and count the clash out loud.
            prev = hints.get(target)
            if prev is None or (prev["kind"] == "name" and kind == "span"):
                hints[target] = {"corrected": f["corrected"], "kind": kind,
                                 "src": f"{f['pool']}/{strip}"}
            else:
                collisions.append((target, prev["src"], f"{f['pool']}/{strip}"))
        tab[(where, kind)] += 1
        rows_out.append({"old_pool": f["pool"], "old_strip": strip, "page": pg,
                         "kind": kind, "lands_in": where, "new_strip": target or "",
                         "drop_reason": dropped.get(strip, "") if where == "-" else "",
                         "corrected_label": f["corrected"]})

    print(f"\nold human fixes found: {len(fixes)}")
    print(f"{'lands in':<12}{'span':>7}{'name':>7}{'none':>7}")
    for where in ["b8-full", "b8-review", "dropped", "-"]:
        cells = [tab[(where, k)] for k in ("span", "name", "none")]
        if any(cells):
            print(f"{where:<12}" + "".join(f"{c:>7}" for c in cells))
    if collisions:
        print(f"\n⚠ {len(collisions)} old fixes lost a tie for the same new strip "
              f"(the re-slice merged their measures); the stronger match was kept:")
        for tgt, kept, lost in collisions[:5]:
            print(f"    {tgt}  kept {kept}  dropped {lost}")
    print(f"\nhints attachable to a b8 row: {len(hints)} "
          f"({sum(1 for h in hints.values() if h['kind'] == 'span')} span / "
          f"{sum(1 for h in hints.values() if h['kind'] == 'name')} name)")

    marks = {}
    for name in ["full_audit.csv", "emit_review.csv"]:
        marks[name] = annotate(b8 / name, hints, args.apply)
    for name, (m, c) in marks.items():
        print(f"  {name:<16} {m:>5} rows carry a hint, {c:>5} would change"
              + ("" if args.apply else "  (report only)"))

    if args.apply:
        out = b8 / "old_fix_carry.csv"
        atomic_write(out, ["old_pool", "old_strip", "page", "kind", "lands_in",
                           "new_strip", "drop_reason", "corrected_label"], rows_out)
        print(f"\nwrote {out} ({len(rows_out)} rows) — the record of every old fix and where it went")
    else:
        print("\n(nothing written — re-run with --apply)")


if __name__ == "__main__":
    main()
