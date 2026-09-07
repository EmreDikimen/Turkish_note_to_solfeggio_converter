"""Round 4 step 5, Faz 2 — add the RAIL's newly split strips to a frozen-crop pool.

The rail (`emit_strip_labels.py --rail`) re-cuts only the windows whose label ran over the budget —
but it can only do that by re-slicing the whole PAGE, under today's CV. So its output pool holds
three kinds of row, and only one of them may be taken:

  * ✅ **a piece of a window the target pool DROPPED as `over_budget`.** This is the split half the
    rail exists to produce. It is music the pool does not have, nobody has read it, and its crop is
    new by necessity.
  * ⛔ **a re-cut of a span the pool already has.** Dropped. The pixels differ (the 2026-09-03 CV
    fixes moved boundaries on 20 of 30 sampled pages) and the pool's verdict on that span was given
    against the pixels already there.
  * ⛔ **any other re-grouping of the page's music.** Dropped, even where the span looks new: a
    different window over measures the pool already covers is a near-duplicate of existing training
    rows, cut by a different slicer, and nothing asked for it.

The key is the SLICER'S OWN `(page, system, meas_from, meas_to)`, read from each crop root's
`<page>_manifest.json` — never the filename, because a split RENUMBERS every later `_wNN` in its
row, and never the emit manifest's `from`/`to`, which `promote_labels.py` omits on the rows it
promotes. ⚠ A page whose two roots disagree on staff-row count is REFUSED, not guessed: `system` is
a row-local index, so a staff more or less on one side shifts every key after it
(`carry_old_fixes.py` learned this on 654 of 1,779 pages).

⚠ NAMING. Every added strip is renamed to its span — `<page>_s<NN>_m<from>-<to>.png` — in the rail
crop root AND in the pool, because the emitter's `_wNN` name collides with a DIFFERENT strip already
in the target. One name, one picture, everywhere: pool, crop root, and the review UI (which resolves
a row by `<img root>/<page>/<strip>`, not through the pool).

Writes into --pool: the hardlinked PNGs, appended manifest rows (`rail_split` / `rail_from` /
`rail_root` provenance), and `rail_added.csv` — an UNREAD queue over exactly the added rows.
⛔ It appends nothing to `full_audit.csv`: that file describes the frozen crop root, and these
crops come from another one.

Run:
    .venv-ml/bin/python scripts/rung3/merge_rail_strips.py \
        --rail-pool <rail emit out> --rail-root data/real/strips_v2_rail \
        --pool data/real/rung3/strips_h1 --pool-root data/real/strips_v2      # report only
    ... --apply
"""
from __future__ import annotations

import argparse
import csv
import json
import os
from collections import Counter, defaultdict
from pathlib import Path

QUEUE_COLS = ["piece", "page", "strip", "reason", "nd", "min_logprob", "label", "decoded",
              "verdict", "corrected_label", "by"]


def page_index(root: Path, page: str) -> dict | None:
    """strip -> (system, meas_from, meas_to) for one page, plus its staff-row count."""
    mf = root / page / f"{page}_manifest.json"
    if not mf.exists():
        return None
    entries = json.loads(mf.read_text())
    by = {e["strip"]: (e["system"], e["meas_from"], e["meas_to"]) for e in entries}
    return {"by": by, "rows": len({e["system"] for e in entries})}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rail-pool", required=True, help="the --rail emit's output dir")
    ap.add_argument("--rail-root", required=True, help="crop root that emit sliced into")
    ap.add_argument("--pool", required=True, help="the frozen-crop pool to add to")
    ap.add_argument("--pool-root", default="data/real/strips_v2", help="the pool's crop root")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    rail_pool, rail_root = Path(args.rail_pool), Path(args.rail_root)
    pool, pool_root = Path(args.pool), Path(args.pool_root)

    # the windows the pool DROPPED as over-budget: the only place a split half may come from
    over: dict[str, set] = defaultdict(set)
    with (pool / "emit_drops.csv").open() as f:
        for r in csv.DictReader(f):
            if r["reason"] == "over_budget":
                over[r["page"]].add(r["strip"])

    old_idx: dict[str, dict] = {}
    new_idx: dict[str, dict] = {}
    add, stats = [], Counter()
    decodes: dict[str, dict] = {}
    rail_rows = [json.loads(l) for l in (rail_pool / "manifest.jsonl").open()]

    for m in rail_rows:
        page, strip = m["page"], Path(m["image"]).name
        if page not in old_idx:
            old_idx[page] = page_index(pool_root, page) or {}
            new_idx[page] = page_index(rail_root, page) or {}
        o, n = old_idx[page], new_idx[page]
        if not o or not n:
            stats["no_manifest"] += 1
            continue
        if o["rows"] != n["rows"]:
            stats["refused_row_count_differs"] += 1
            continue
        key = n["by"].get(strip)
        if key is None:
            stats["no_key"] += 1
            continue
        sys_, mf, mt = key
        windows = [o["by"][s] for s in over.get(page, ()) if s in o["by"]]
        inside = [w for w in windows if w[0] == sys_ and w[1] <= mf and mt <= w[2]]
        if not inside:
            stats["not_from_an_over_budget_window"] += 1
            continue
        name = f"{page}_s{sys_:02d}_m{mf}-{mt}.png"
        if page not in decodes:
            dj = rail_root / page / f"{page}_decode.json"
            decodes[page] = ({s["strip"]: s["tokens"] for s in json.loads(dj.read_text())["strips"]}
                             if dj.exists() else {})
        add.append((m, name, key, decodes[page].get(strip, "")))
        stats["added"] += 1
        stats["added_%d_measures" % (mt - mf + 1)] += 1

    print(f"rail pool: {len(rail_rows)} accepted rows")
    for k, v in sorted(stats.items()):
        print(f"  {k:34s} {v}")
    print(f"  {'pages contributing':34s} {len({m['page'] for m, _, _, _ in add})}")
    if not args.apply:
        print("\n(report only — pass --apply to write)")
        return

    rows = []
    for m, name, key, decoded in add:
        src = rail_root / m["page"] / Path(m["image"]).name
        tgt = rail_root / m["page"] / name
        if src.exists() and not tgt.exists():
            src.rename(tgt)
        dst = pool / name
        if not dst.exists():
            os.link(tgt, dst)
        rows.append({"piece": m["piece"], "page": m["page"], "strip": name,
                     "reason": "rail_split", "nd": m.get("nd", ""),
                     "min_logprob": m.get("min_logprob", ""), "label": m["label"],
                     "decoded": decoded, "verdict": "", "corrected_label": "", "by": ""})
        m["rail_from"], m["image"] = Path(m["image"]).name, name
        m["rail_split"], m["rail_root"] = True, str(rail_root)
        m["system"], m["meas_from"], m["meas_to"] = key

    with (pool / "manifest.jsonl").open("a") as f:
        for m, _, _, _ in add:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")
    q = pool / "rail_added.csv"
    tmp = q.with_suffix(".csv.tmp")
    with tmp.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=QUEUE_COLS)
        w.writeheader()
        w.writerows(rows)
    tmp.replace(q)
    print(f"\nadded {len(rows)} strips to {pool}/manifest.jsonl and wrote {q}")


if __name__ == "__main__":
    main()
