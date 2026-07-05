#!/usr/bin/env python3
"""Batch-export the pieces selected by `scripts/select_pieces.py` to note-model JSON files under
`apps/web/public/scores/`, where the harness's `?score=/scores/<slug>.json` URL param (and thus the
batch renderer) can load them. Thin loop over the proven single-file exporter
(`src/symbtr/export_json.py:export_file`). Idempotent: existing outputs are skipped unless --force.

Usage:
    .venv-ml/bin/python scripts/export_scores.py [--pieces data/pieces.json] [--force]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC))

from symbtr.parser import parse_file  # noqa: E402
from symbtr.export_json import export_file  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pieces", default="data/pieces.json")
    ap.add_argument("--out-dir", default="apps/web/public/scores")
    ap.add_argument("--force", action="store_true", help="re-export even if the JSON exists")
    args = ap.parse_args()

    manifest = json.loads(Path(args.pieces).read_text(encoding="utf-8"))
    corpus = Path(manifest["corpus"])
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    n_done = n_skip = 0
    for entry in manifest["pieces"]:
        out = out_dir / f"{entry['slug']}.json"
        if out.exists() and not args.force:
            n_skip += 1
            continue
        score = parse_file(corpus / entry["txt"])
        export_file(score, out, indent=None)  # compact — these are fetch targets, not for reading
        n_done += 1
    print(f"exported {n_done} scores to {out_dir}/ ({n_skip} already present)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
