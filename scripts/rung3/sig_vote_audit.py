r"""Round 4 step 3 (measurement half) — where does the model-voted key signature disagree with
`data/makam_signatures.json`?

The signature is the ONE part of a real-page label that is not derived from SymbTr: for each piece
`emit_strip_labels.py` takes a majority vote over the row-start decodes and, when the vote differs
from the derivation, **overwrites** it (docs/BACKLOG.md item 9). The voter is the weak
`rung3-labeler` / `round2-stage2-best`, its koma/kucuk confusion is systematic, so the vote is
unanimous and can be unanimously wrong, and the `nd` gate is blind to `\sig` blocks by design.

This script turns that one observation into a checkable list. No labelling, no GPU, no decode: it
reads what the emits already wrote.

  chosen   the voted signature that was written into the label  (emit_requests.json `signature`)
  derived  what SymbTr's content gave                            (matched/.../labels.json)
  table    the makam's majority printed variant                  (data/makam_signatures.json)

A disagreement is classified per LETTER, because the classes are not equally interesting:

  altered  same letter, different accidental  — the koma/kucuk confusion, the suspected error
  missing  the table has a letter the vote does not print
  extra    the vote prints a letter the table does not have
  match    identical to the table

⚠ The table is a GUIDE, not gold — mahur genuinely prints both ways (kucuk 35, koma 17). A row on
this list is a row for the owner to LOOK at, never an automatic correction.

    .venv-ml/bin/python scripts/rung3/sig_vote_audit.py
    .venv-ml/bin/python scripts/rung3/sig_vote_audit.py --pools strips_exam_v3_emit
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNG3 = ROOT / "data/real/rung3"
TABLE = ROOT / "data/makam_signatures.json"

# Same regex and mapping the emitter uses (scripts/rung3/emit_strip_labels.py) — kept in sync by
# eye, not by import, because that module loads torch on import.
SIG_ENTRY_RE = re.compile(r"(\\(?:koma|bakiye|kucuk|buyuk)(?:Sharp|Flat))\s*([a-g])")
ACC_COMMAS = {"\\komaSharp": 1, "\\bakiyeSharp": 4, "\\kucukSharp": 5, "\\buyukSharp": 8,
              "\\komaFlat": -1, "\\bakiyeFlat": -4, "\\kucukFlat": -5, "\\buyukFlat": -8}
COMMAS_ACC = {v: k for k, v in ACC_COMMAS.items()}

POOLS = ["strips_exam_v3_emit", "strips_b8", "strips_nota", "strips_tup", "strips_r1"]


def parse_sig_label(label: str | None) -> tuple[tuple[str, int], ...]:
    r"""A `\sig`-style string -> ((letter, commas), ...) in drawn order."""
    if not label:
        return ()
    return tuple((letter, ACC_COMMAS[acc]) for acc, letter in SIG_ENTRY_RE.findall(label))


def fmt(sig: tuple[tuple[str, int], ...]) -> str:
    return " ".join(f"{COMMAS_ACC[c][1:]}{letter}" for letter, c in sig) or "(empty)"


def load_table() -> dict[str, dict]:
    """makam name (every spelling) -> {'sig': majority variant, 'n': its count, 'key': table key,
    'source': real|theory, 'n_variants': how many variants the table lists}."""
    raw = json.loads(TABLE.read_text())
    out: dict[str, dict] = {}
    for key, entry in raw.items():
        best = max(entry["variants"], key=lambda v: (v.get("n", 0), v.get("weight", 0)))
        rec = {"key": key, "sig": parse_sig_label(best["sig"]), "n": best.get("n", 0),
               "source": entry.get("source", ""), "n_variants": len(entry["variants"]),
               "variants": [(parse_sig_label(v["sig"]), v.get("n", 0)) for v in entry["variants"]]}
        for name in [key, *entry.get("names", [])]:
            out[name.replace("_", "")] = rec
    return out


def classify(chosen: tuple[tuple[str, int], ...],
             table: tuple[tuple[str, int], ...]) -> tuple[str, str]:
    """-> (verdict, detail). Verdict is the worst class present, altered first."""
    c, t = dict(chosen), dict(table)
    altered = [(k, t[k], c[k]) for k in t if k in c and c[k] != t[k]]
    missing = [(k, t[k]) for k in t if k not in c]
    extra = [(k, c[k]) for k in c if k not in t]
    if not (altered or missing or extra):
        return "match", ""
    bits = []
    for k, tv, cv in altered:
        bits.append(f"altered {k}: table {COMMAS_ACC[tv][1:]} -> voted {COMMAS_ACC[cv][1:]}")
    for k, tv in missing:
        bits.append(f"missing {COMMAS_ACC[tv][1:]}{k}")
    for k, cv in extra:
        bits.append(f"extra {COMMAS_ACC[cv][1:]}{k}")
    verdict = "altered" if altered else ("missing" if missing else "extra")
    return verdict, "; ".join(bits)


def piece_dir_of(score_path: str) -> Path:
    return ROOT / Path(score_path).parent


def derived_sig(piece_dir: Path) -> tuple[tuple[str, int], ...] | None:
    lp = piece_dir / "labels.json"
    if not lp.exists():
        return None
    labels = json.loads(lp.read_text())
    sig = labels.get("signature", {})
    return parse_sig_label(sig.get("label")) if sig.get("entries") else ()


def makam_of(symbtr_stem: str, piece_dir: Path) -> str:
    """The matched/ folder is the makam the pipeline filed the piece under; the SymbTr stem's first
    field is the same name in SymbTr's spelling. Prefer the folder, fall back to the stem."""
    folder = piece_dir.parent.name
    return folder or symbtr_stem.split("--")[0]


def run_pool(pool: str, table: dict[str, dict], rows: list[dict]) -> dict:
    d = RUNG3 / pool
    report = json.loads((d / "emit_report.json").read_text())
    requests = json.loads((d / "emit_requests.json").read_text())
    by_piece = {Path(r["score"]).parent.name: r for r in requests}

    aligned = [p for p in report["pieces"] if "sig_override" in p]
    fired = [p for p in aligned if p["sig_override"]]
    counts = Counter()
    for p in fired:
        req = by_piece.get(p["piece"])
        if req is None or "signature" not in req:
            counts["no_request"] += 1          # piece kept no strip, so no label was written
            continue
        pdir = piece_dir_of(req["score"])
        chosen = tuple((e["letter"].lower(), e["alterCommas"]) for e in req["signature"])
        makam = makam_of(p.get("symbtr", ""), pdir)
        rec = table.get(makam.replace("_", ""))
        if rec is None:
            verdict, detail, tsig, tn, tsrc = "makam_not_in_table", "", (), "", ""
        else:
            verdict, detail = classify(chosen, rec["sig"])
            # A piece whose voted sig matches ANY listed variant is not a disagreement.
            if verdict != "match" and any(dict(v) == dict(chosen) for v, _ in rec["variants"]):
                verdict, detail = "match_other_variant", detail
            tsig, tn, tsrc = rec["sig"], rec["n"], rec["source"]
        counts[verdict] += 1
        der = derived_sig(pdir)
        # The emitter compares the vote to the derivation as an ORDERED tuple, so an override also
        # fires when the two carry the same accidentals in a different drawn order. That is a real
        # fix (the label is a sequence) but it changes no pitch — count it apart.
        order_only = "" if der is None else int(der != tuple(chosen) and dict(der) == dict(chosen))
        counts["order_only" if order_only else "content_change"] += 1
        rows.append({
            "pool": pool, "piece": p["piece"], "makam": makam, "verdict": verdict,
            "order_only": order_only,
            "voted": fmt(chosen), "table": fmt(tsig) if rec else "",
            "table_n": tn, "table_source": tsrc,
            "derived": "" if der is None else fmt(der),
            "voted_eq_derived": "" if der is None else int(dict(der) == dict(chosen)),
            "detail": detail, "split_vote": int(not p.get("sig_majority_ok", True)),
        })
    return {"aligned": len(aligned), "fired": len(fired),
            "split": sum(1 for p in aligned if not p.get("sig_majority_ok", True)),
            "counts": counts}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pools", nargs="*", default=POOLS)
    ap.add_argument("--out", default=str(RUNG3 / "sig_vote_audit.csv"))
    args = ap.parse_args()

    table = load_table()
    rows: list[dict] = []
    summary = {}
    for pool in args.pools:
        if not (RUNG3 / pool / "emit_report.json").exists():
            print(f"skip {pool}: no emit_report.json")
            continue
        summary[pool] = run_pool(pool, table, rows)

    out = Path(args.out)
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ["pool"])
        w.writeheader()
        w.writerows(rows)

    order = ["altered", "missing", "extra", "match", "match_other_variant",
             "makam_not_in_table", "no_request", "order_only", "content_change"]
    print(f"\n{'pool':22} {'aligned':>7} {'fired':>6} {'split':>6}  " +
          " ".join(f"{k[:9]:>10}" for k in order))
    tot = Counter()
    for pool, s in summary.items():
        tot.update(s["counts"])
        print(f"{pool:22} {s['aligned']:>7} {s['fired']:>6} {s['split']:>6}  " +
              " ".join(f"{s['counts'][k]:>10}" for k in order))
    print(f"{'ALL':22} {'':>7} {'':>6} {'':>6}  " + " ".join(f"{tot[k]:>10}" for k in order))

    dis = [r for r in rows if r["verdict"] in ("altered", "missing", "extra")]
    print(f"\n  of the disagreements, order-only overrides: "
          f"{sum(int(r['order_only'] or 0) for r in dis)}")
    print(f"\n{len(dis)} disagreements written to {out}")
    by_makam = Counter((r["makam"], r["verdict"]) for r in dis)
    print("\ntop disagreeing makams:")
    for (makam, verdict), n in by_makam.most_common(20):
        print(f"  {makam:18} {verdict:8} {n:>4}")
    arrows = Counter(b.split(": ", 1)[1] for r in dis for b in r["detail"].split("; ")
                     if b.startswith("altered "))
    print("\naltered-accidental directions (letter-level):")
    for k, n in arrows.most_common(20):
        print(f"  {k:34} {n:>4}")


if __name__ == "__main__":
    main()
