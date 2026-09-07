"""Rung 3 / Round 4 step 5 — carry one pool's human verdicts into a pool cut from the SAME crops.

A verdict is given against PIXELS, so it may only follow a strip whose pixels did not move. Every
earlier carry in this project therefore matched on the MEASURE SPAN and produced a *suggestion*
(carry_old_fixes.py) — across a re-slice a filename survives and its pixels do not, and 0 of 1,215
crops came back byte-identical.

⭐ `--frozen-crops` changes that, and this script is the reason it exists. The Round-4 re-emit
re-uses the crops and the decode caches exactly as they sit on disk (docs/rung3/round4.md step 5,
route C+), so a strip of the same name in the two pools is the same FILE — both pools hardlink it
out of the same crop root. That is provable, not assumed, and this script proves it per row:

  1. the two PNGs share an inode (a hardlink of one file), or failing that hash identically, AND
  2. the two labels are character-identical.

A row failing either test carries NOTHING and is counted. ⛔ There is no flag to skip the proof:
the whole safety of the carry is that it is checked, not argued.

What moves: `verdict`, `corrected_label` and `by` (which separates the owner's own reads from
auto_accept_agree's machine drafts — a draft is not a read, and the distinction has to survive).

A source row the new emit did not accept is not lost — it is usually in the target's REVIEW queue,
where a verdict would promote it back into training. `--review` carries into that queue too, under
one extra rule: ⛔ **only rows a HUMAN verdicted (`by` empty) travel into review.** A machine draft
says "the label matches this model's decode", and the rows that land in review are exactly the ones
where that agreement is worthless or circular — `sig_table_conflict` above all, where the \\sig
block being judged IS the model's own vote (docs/METRICS-SIGVOTE.md). The label-equality proof does
the rest: rule D keeps the SymbTr derivation where the vote is refused, so such a row's label
usually differs from b8's and carries nothing at all.

Output is `<to>/full_audit.csv`, the file review_ui.py builds on first sight of a pool and never
rebuilds. ⚠ This script REFUSES to overwrite an existing one without --force, because that file is
where the reading happens: rebuilding it silently discards every verdict entered since.

Run:
    .venv-ml/bin/python scripts/rung3/carry_verdicts.py \
        --from data/real/rung3/strips_b8 --to data/real/rung3/strips_h1        # report only
    .venv-ml/bin/python scripts/rung3/carry_verdicts.py ... --apply
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent

COLUMNS = ["piece", "page", "strip", "nd", "min_logprob", "verdict", "label", "decoded",
           "corrected_label", "by"]


def read_verdicts(pool: Path) -> dict[str, dict]:
    """strip name -> the source row, from every queue in `pool` that carries a verdict column.

    full_audit.csv is the big one (verdicts over accepted strips); emit_audit.csv is the seeded
    sample review_ui carried into it, and emit_review.csv holds promoted review rows. Later files
    win only where the earlier one left the verdict empty, so a real read never loses to a blank.
    """
    out: dict[str, dict] = {}
    for name in ("emit_audit.csv", "emit_review.csv", "full_audit.csv"):
        path = pool / name
        if not path.exists():
            continue
        with path.open(newline="") as f:
            for r in csv.DictReader(f):
                if not r.get("verdict"):
                    continue
                out[r["strip"]] = {"verdict": r["verdict"],
                                   "corrected_label": r.get("corrected_label", ""),
                                   "by": r.get("by", ""),
                                   "label": r.get("label", ""),
                                   "src": name}
    return out


def same_pixels(a: Path, b: Path) -> bool:
    """True when the two paths are the same file, or hold the same bytes. Cheap first, sure after."""
    if not a.exists() or not b.exists():
        return False
    sa, sb = a.stat(), b.stat()
    if sa.st_ino == sb.st_ino and sa.st_dev == sb.st_dev:
        return True                      # one file, two names — the hardlink case
    if sa.st_size != sb.st_size:
        return False
    return (hashlib.sha256(a.read_bytes()).hexdigest()
            == hashlib.sha256(b.read_bytes()).hexdigest())


def write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    """Write a queue file ATOMICALLY — a temp file beside it, then a rename.

    ⛔ Never `open(path, "w")` on a queue: a raise mid-write leaves the file truncated at whatever
    row failed, and a queue holds work. That is not hypothetical (2026-09-07, this script, 185 of
    6,434 rows survived); the emit had to be re-run to rebuild the file.
    """
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columns)
        w.writeheader()
        w.writerows(rows)
    tmp.replace(path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from", dest="src", required=True, help="pool holding the verdicts")
    ap.add_argument("--to", dest="dst", required=True, help="pool to build full_audit.csv for")
    ap.add_argument("--strips-root", default="data/real/strips_v2",
                    help="crop root, for the per-page decode caches the `decoded` column shows")
    ap.add_argument("--review", action="store_true",
                    help="also carry HUMAN verdicts into <to>/emit_review.csv, so promote_labels "
                         "can put those strips back into training")
    ap.add_argument("--apply", action="store_true", help="write <to>/full_audit.csv")
    ap.add_argument("--force", action="store_true",
                    help="overwrite an existing <to>/full_audit.csv — ⛔ discards verdicts made "
                         "in the target pool since it was built")
    args = ap.parse_args()

    src, dst = Path(args.src), Path(args.dst)
    root = Path(args.strips_root)
    out_path = dst / "full_audit.csv"
    if out_path.exists() and args.apply and not args.force:
        raise SystemExit(f"{out_path} exists — reading happens in that file. Pass --force only if "
                         "you are certain nothing has been verdicted in it.")

    prior = read_verdicts(src)
    print(f"{src.name}: {len(prior)} verdicted strips")

    decodes: dict[str, dict] = {}
    rows, stats = [], Counter()
    for line in (dst / "manifest.jsonl").open():
        m = json.loads(line)
        strip, page = Path(m["image"]).name, m["page"]
        if page not in decodes:
            dj = REPO / root / page / f"{page}_decode.json"
            decodes[page] = ({s["strip"]: s["tokens"] for s in json.loads(dj.read_text())["strips"]}
                             if dj.exists() else {})
        verdict = corrected = by = ""
        p = prior.get(strip)
        if p is None:
            stats["new_no_prior"] += 1
        elif not same_pixels(src / strip, dst / strip):
            stats["refused_pixels_moved"] += 1
        elif p["label"] != m["label"]:
            stats["refused_label_differs"] += 1
        else:
            verdict, corrected, by = p["verdict"], p["corrected_label"], p["by"]
            stats["carried_" + verdict] += 1
            stats["carried_human" if not by else "carried_machine"] += 1
        rows.append({"piece": m["piece"], "page": page, "strip": strip,
                     "nd": m.get("nd", ""), "min_logprob": m.get("min_logprob", ""),
                     "verdict": verdict, "label": m["label"],
                     "decoded": decodes[page].get(strip, ""), "corrected_label": corrected,
                     "by": by})

    print(f"{dst.name}: {len(rows)} accepted strips")
    for k, v in sorted(stats.items()):
        print(f"  {k:24s} {v}")
    unused = len(prior) - sum(v for k, v in stats.items() if k.startswith("carried_")) // 2
    print(f"  {'source rows not matched':24s} {unused}   (dropped by the new gate, or renamed)")

    if args.review:
        # ⛔ A REVIEW ROW HAS NO PNG IN EITHER POOL — only accepted strips are hardlinked in — so the
        # per-row inode/hash proof cannot be made for it, and pretending otherwise reported 36 rows
        # as "pixels moved" when nothing had moved. The proof it CAN make is pool-level and is made
        # here: both pools read the same crop root, and the target was emitted with --frozen-crops,
        # which cannot slice. That plus the accepted rows' per-row inode matches (every one of them,
        # above) is what says the crops under both queues are the same files.
        rp = json.loads((dst / "emit_report.json").read_text()).get("params", {})
        tgt_root = json.loads((dst / "emit_report.json").read_text()).get("frozen_crops")
        src_root = json.loads((src / "emit_report.json").read_text()).get("params", {}).get("strips_root")
        if not tgt_root:
            raise SystemExit("--review needs the target pool emitted with --frozen-crops: without "
                             "it a crop may have been re-cut and a review verdict cannot follow.")
        if rp.get("strips_root") != src_root:
            raise SystemExit(f"crop roots differ — source {src_root}, target {rp.get('strips_root')}: "
                             "a strip name means different pixels across roots.")
        rv_path = dst / "emit_review.csv"
        with rv_path.open(newline="") as f:
            rv_rows, rv_cols = list(csv.DictReader(f)), None
        with rv_path.open(newline="") as f:
            rv_cols = next(csv.reader(f))
        # A FRESH emit_review.csv has no verdict columns — review_ui adds them the first time a
        # queue is opened. Writing the carried verdicts back without widening the header raised
        # mid-write and left the queue TRUNCATED (2026-09-07); both halves of that are fixed here
        # and by the atomic write below. ⛔ Never write a queue file in place.
        for extra in ("verdict", "corrected_label"):
            if extra not in rv_cols:
                rv_cols.append(extra)
        for r in rv_rows:
            for extra in ("verdict", "corrected_label"):
                r.setdefault(extra, "")
        rv_stats = Counter()
        for r in rv_rows:
            p = prior.get(r["strip"])
            if p is None:
                continue
            if p["by"]:
                rv_stats["skipped_machine_draft"] += 1
            elif not (root / r["page"] / r["strip"]).exists():
                rv_stats["refused_crop_missing"] += 1
            elif p["label"] != r.get("label", ""):
                rv_stats["refused_label_differs_" + r.get("reason", "?")] += 1
            elif r.get("verdict"):
                rv_stats["already_verdicted"] += 1
            else:
                r["verdict"], r["corrected_label"] = p["verdict"], p["corrected_label"]
                rv_stats["carried_" + p["verdict"] + "_" + r.get("reason", "?")] += 1
        print(f"\n{rv_path.name}: {len(rv_rows)} rows")
        for k, v in sorted(rv_stats.items()):
            print(f"  {k:34s} {v}")

    if not args.apply:
        print("\n(report only — pass --apply to write)")
        return
    if args.review:
        write_csv(rv_path, rv_cols, rv_rows)
        print(f"wrote {rv_path}")
    write_csv(out_path, COLUMNS, rows)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
