"""Rung 3 — promote adjudicated labels into the training manifest (docs/RUNG3.md §1a.5 prereq).

Applies the review UI's human verdicts (scripts/rung3/review_ui.py) to <dir>/manifest.jsonl.
The verdicts are ground truth — nothing here re-judges the music; the gates below only catch
MECHANICAL defects hand-edited CSV text can carry (a glued "\\sig\\kucukFlatb", a 7-denominator
duration, an over-budget label the decoder literally cannot emit within max_length 60).

  full_audit.csv    verdicts over ALREADY-ACCEPTED strips. `fix` replaces the manifest row's
                    label with corrected_label; `bad` REMOVES the row; `ok` is a no-op.
  emit_review.csv   the review queue. `ok` / `fix` rows are PROMOTED into the manifest
                    (label / corrected_label respectively); `bad` rows are skipped for good;
                    unverdicted rows just wait for a later run. exam=1 rows never promote —
                    exam strips must not enter training.

Every incoming label re-passes the emitter's real gates (emit_strip_labels.py pass 2) first:

  budget      <= 59 token ids incl. EOS (audit_coverage.py's rule; decoder max_length is 60),
              counted with the real training tokenizer.
  round-trip  labels-cli --check: token-class audit + decodeLabel(carry) note/rest count match
              — the SAME check every --ranges label passes, now applied to human-edited text
              (which never went through --ranges).

Gate failures land in promote_rejects.csv (fix the typo there, re-run) and are NOT promoted.
An audit `fix` whose correction fails the gate still REMOVES the manifest row — the old label
is known-wrong, and a wrong label is worse than no label.

Promoted rows carry provenance (promoted=review|audit_fix, reason, verdict) on top of the
StripDataset fields (image/label/mode/piece=SymbTr stem/makam/source/page + nd/min_logprob
from the queue row; from/to are omitted — StripDataset never reads them). Piece metadata is
recovered from data/real/rung3/matched/ match.json files (the queue CSVs only carry the
source-side stem). PNGs are hardlinked from --strips-root exactly like the emitter.

manifest.jsonl is rewritten atomically with a fresh .bakN beside it. The script is idempotent:
promotion keys on the image name, so re-runs (including after further adjudication) update in
place and report already-applied rows instead of duplicating them.

Run:
    .venv-ml/bin/python scripts/rung3/promote_labels.py --dry-run   # report only
    .venv-ml/bin/python scripts/rung3/promote_labels.py             # apply
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent


def norm_label(text: str) -> str:
    """Collapse the whitespace a hand-edited CSV cell may carry — tokens stay untouched."""
    return " ".join(text.split())


def next_bak(path: Path) -> Path:
    for i in range(1, 100):
        bak = path.with_name(path.name + (".bak" if i == 1 else f".bak{i}"))
        if not bak.exists():
            return bak
    raise SystemExit(f"no free .bakN slot beside {path}")


def load_piece_meta(matched: Path) -> dict[str, dict]:
    """source-side stem -> {symbtr, makam, source} from every matched piece's match.json
    (the queue CSVs' `piece` column is the source stem; the manifest wants the SymbTr stem —
    the split-by-piece / dedupe key)."""
    meta: dict[str, dict] = {}
    for mp in sorted(matched.rglob("match.json")):
        match = json.loads(mp.read_text())
        source = next((k for k, v in match.items() if isinstance(v, dict) and "pages" in v), None)
        if source is None:
            continue
        stem = match[source]["stem"]
        makam = match[source].get("makam", "")
        if not makam:
            lp = mp.parent / "labels.json"
            if lp.exists():
                makam = json.loads(lp.read_text()).get("makam", "")
        m = {"symbtr": Path(match["symbtr"]["file"]).stem, "makam": makam, "source": source}
        if stem in meta and meta[stem] != m:
            raise SystemExit(f"ambiguous source stem {stem!r} under {matched} — cannot map piece metadata")
        meta[stem] = m
    return meta


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data/real/rung3/strips_r1",
                    help="emit output dir holding manifest.jsonl + the verdict CSVs")
    ap.add_argument("--matched", default="data/real/rung3/matched")
    ap.add_argument("--strips-root", default="data/real/strips")
    ap.add_argument("--checkpoint", default="data/checkpoints/rung22-stemfix-best",
                    help="tokenizer source for the id-budget gate (no model loaded)")
    ap.add_argument("--max-ids", type=int, default=59)
    ap.add_argument("--dry-run", action="store_true",
                    help="run every gate and print the report; write no manifest/PNGs/CSVs")
    args = ap.parse_args()

    out_dir = Path(args.dir)
    manifest_p = out_dir / "manifest.jsonl"
    if not manifest_p.exists():
        raise SystemExit(f"{manifest_p} not found")

    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(args.checkpoint)

    def n_ids(label: str) -> int:
        ids = tok(label).input_ids
        return len(ids) + (0 if ids and ids[-1] == tok.eos_token_id else 1)

    piece_meta = load_piece_meta(Path(args.matched))

    manifest = [json.loads(line) for line in manifest_p.read_text().splitlines() if line.strip()]
    by_image = {row["image"]: row for row in manifest}

    # ---- collect candidate actions ----------------------------------------------------------
    # action: (kind, image, label, queue_row)  kind in {audit_fix, audit_bad, review}
    actions: list[tuple[str, str, str, dict]] = []
    counts = Counter()

    for r in read_csv(out_dir / "full_audit.csv"):
        v = r.get("verdict", "").strip()
        if v == "fix":
            actions.append(("audit_fix", r["strip"], norm_label(r.get("corrected_label", "")), r))
        elif v == "bad":
            actions.append(("audit_bad", r["strip"], "", r))
        else:
            counts["audit_ok" if v == "ok" else "audit_unverdicted"] += 1

    for r in read_csv(out_dir / "emit_review.csv"):
        v = r.get("verdict", "").strip()
        if v not in ("ok", "fix"):
            counts["review_bad" if v == "bad" else "review_unverdicted"] += 1
            continue
        if r.get("exam", "0").strip() == "1":
            counts["review_exam_skipped"] += 1
            continue
        label = norm_label(r.get("corrected_label", "") if v == "fix" else r.get("label", ""))
        actions.append(("review", r["strip"], label, r))

    # ---- gates ------------------------------------------------------------------------------
    rejects: list[dict] = []

    def reject(kind: str, r: dict, reason: str, detail: str = ""):
        rejects.append({"kind": kind, "piece": r.get("piece", ""), "page": r.get("page", ""),
                        "strip": r["strip"], "reason": reason, "detail": detail})

    gated: list[tuple[str, str, str, dict]] = []   # survivors needing the round-trip check
    for kind, image, label, r in actions:
        if kind == "audit_bad":
            gated.append((kind, image, label, r))
            continue
        if not label:
            reject(kind, r, "empty_label")
            continue
        if kind == "review" and image not in by_image:
            src = Path(args.strips_root) / r["page"] / image
            if not src.exists():
                reject(kind, r, "png_missing", str(src))
                continue
        if kind == "audit_fix" and image not in by_image:
            reject(kind, r, "not_in_manifest")
            continue
        n = n_ids(label)
        if n > args.max_ids:
            reject(kind, r, "over_budget", f"{n} ids")
            continue
        gated.append((kind, image, label, r))

    to_check = [(image, label) for kind, image, label, _ in gated if kind != "audit_bad"]
    check_errors: dict[str, list[str]] = {}
    if to_check:
        req_p = out_dir / "promote_check_req.json"
        resp_p = out_dir / "promote_check_resp.json"
        req_p.write_text(json.dumps([{"id": i, "label": l} for i, l in to_check], indent=1))
        r = subprocess.run(["npx", "--yes", "tsx", "tools/render/labels-cli.ts",
                            "--check", str(req_p), "--out", str(resp_p)],
                           cwd=REPO, capture_output=True, text=True)
        if r.returncode not in (0, 1) or not resp_p.exists():  # 1 = "some labels errored"
            sys.exit(f"labels-cli --check failed:\n{r.stdout}\n{r.stderr}")
        for resp in json.loads(resp_p.read_text()):
            if resp["errors"]:
                check_errors[resp["id"]] = resp["errors"]

    # ---- apply ------------------------------------------------------------------------------
    removed_images: set[str] = set()
    link_jobs: list[tuple[Path, Path]] = []

    for kind, image, label, r in gated:
        if kind == "audit_bad":
            if image in by_image:
                removed_images.add(image)
                counts["audit_removed"] += 1
            continue
        if image in check_errors:
            reject(kind, r, "roundtrip_fail", "; ".join(check_errors[image]))
            if kind == "audit_fix":       # correction unusable, old label known-wrong -> out
                removed_images.add(image)
                counts["audit_removed_bad_fix"] += 1
            continue
        if kind == "audit_fix":
            row = by_image[image]
            if row["label"] == label and row.get("promoted") == "audit_fix":
                counts["audit_fix_already"] += 1
                continue
            row["label"] = label
            row["promoted"] = "audit_fix"
            row["verdict"] = "fix"
            counts["audit_fix_applied"] += 1
        else:  # review promotion
            existing = by_image.get(image)
            if existing is not None:
                if existing["label"] == label:
                    counts["review_already"] += 1
                else:
                    existing.update(label=label, promoted="review",
                                    reason=r.get("reason", ""), verdict=r["verdict"].strip())
                    counts["review_updated"] += 1
                continue
            meta = piece_meta.get(r["piece"])
            if meta is None:
                reject(kind, r, "no_piece_meta", r["piece"])
                continue
            row = {"image": image, "label": label, "mode": "measure",
                   "piece": meta["symbtr"], "makam": meta["makam"], "source": meta["source"],
                   "page": r["page"],
                   "nd": float(r["nd"]) if r.get("nd") else None,
                   "min_logprob": float(r["min_logprob"]) if r.get("min_logprob") else None,
                   "promoted": "review", "reason": r.get("reason", ""),
                   "verdict": r["verdict"].strip()}
            manifest.append(row)
            by_image[image] = row
            link_jobs.append((Path(args.strips_root) / r["page"] / image, out_dir / image))
            counts["review_promoted"] += 1

    if removed_images:
        manifest = [row for row in manifest if row["image"] not in removed_images]

    # ---- outputs ----------------------------------------------------------------------------
    report = {
        "params": {"dir": str(out_dir), "checkpoint": args.checkpoint,
                   "max_ids": args.max_ids, "dry_run": args.dry_run},
        "counts": dict(counts),
        "rejects": len(rejects),
        "reject_reasons": dict(Counter(x["reason"] for x in rejects)),
        "manifest_rows": len(manifest),
        "by_provenance": dict(Counter(row.get("promoted", "emitter") for row in manifest)),
    }

    if not args.dry_run:
        for src, dst in link_jobs:
            if not dst.exists():
                try:
                    os.link(src, dst)
                except OSError:
                    shutil.copy2(src, dst)
        changed = (counts["audit_fix_applied"] or counts["review_promoted"]
                   or counts["review_updated"] or removed_images)
        if changed:
            shutil.copy2(manifest_p, next_bak(manifest_p))
            tmp = manifest_p.with_suffix(".jsonl.tmp")
            with tmp.open("w") as f:
                for row in manifest:
                    f.write(json.dumps({k: v for k, v in row.items() if v is not None}) + "\n")
            tmp.replace(manifest_p)
        with (out_dir / "promote_rejects.csv").open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["kind", "piece", "page", "strip", "reason", "detail"])
            w.writeheader()
            w.writerows(rejects)
        (out_dir / "promote_report.json").write_text(json.dumps(report, indent=1))

    print(json.dumps(report, indent=1))
    if rejects:
        print(f"\nrejects ({len(rejects)}):")
        for x in rejects:
            print(f"  {x['kind']:9s} {x['strip']}: {x['reason']}  {x['detail'][:100]}")
    if args.dry_run:
        print("\nDRY-RUN: no manifest/PNGs/CSVs written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
