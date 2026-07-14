"""Rung 4, stages 1+7 — decode a full PAGE end-to-end: slice -> strips -> ONNX -> tokens.

Chains `page_to_strips` (classical-CV slicing) into the PROVEN Rung-1.5 ONNX greedy decode
(`onnx_parity.onnx_greedy_decode`), the same int8 graphs the browser runs. Each strip decodes to
a LilyPond-ish token stream; this prints them per strip and concatenated per staff row, and
writes `<page>_decode.json` next to the strips — the input of the stage-8 STITCHER
(`tools/render/stitch-cli.ts`), which turns it into an editor-loadable note model:

    npx --yes tsx tools/render/stitch-cli.ts data/real/strips/<page>/<page>_decode.json \
        -o apps/web/public/decoded.json

Per-strip records carry the slicer's measure geometry (meas_from/meas_to/row_measures — the
Rung-3 emitter's alignment input) and the decode confidence (min/mean token log-probability +
whether the decode hit the length cap without an EOS — the emitter's review columns and the
Step-5 triage signal).

Importable: `load_runtime()` once, then `decode_page()` per page — the Rung-3 emitter decodes
~hundreds of pages over ONE session load instead of a subprocess per page.

Run (int8 graphs = the browser runtime):
    .venv-ml/bin/python src/vision/decode_page.py data/real/images/hicaz/<page>.png \
        --checkpoint data/checkpoints/rung22-stemfix-best \
        --onnx-dir data/checkpoints/rung22-stemfix-best-onnx --suffix _int8
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from onnx_parity import MAX_TOKENS, onnx_greedy_decode
from page_to_strips import page_to_strips


@dataclass
class Runtime:
    """The loaded decode stack: ONNX sessions + processor/tokenizer + generation ids."""
    sessions: tuple
    processor: Any
    tok: Any
    start_id: int
    eos_id: int
    checkpoint: str
    suffix: str


def load_runtime(checkpoint: str, onnx_dir: str, suffix: str = "_int8") -> Runtime:
    """Load the processor + ONNX graphs once (the exact browser runtime)."""
    import onnxruntime as ort
    from transformers import AutoConfig, AutoProcessor

    processor = AutoProcessor.from_pretrained(checkpoint)
    tok = processor.tokenizer
    cfg = AutoConfig.from_pretrained(checkpoint)
    start_id = getattr(cfg, "decoder_start_token_id", None) or tok.bos_token_id
    eos_id = tok.eos_token_id
    d = Path(onnx_dir)
    sessions = tuple(
        ort.InferenceSession(str(d / f"{n}{suffix}.onnx"))
        for n in ("encoder_model", "decoder_model", "decoder_with_past_model")
    )
    return Runtime(sessions, processor, tok, start_id, eos_id, checkpoint, suffix)


def decode_page(
    page: str | Path,
    rt: Runtime,
    out_root: str | Path = "data/real/strips",
    debug: bool = True,
    verbose: bool = True,
) -> dict:
    """Slice one page and decode every strip; write and return the `<page>_decode.json` dict."""
    strip_dir = Path(out_root) / Path(page).stem
    manifest = page_to_strips(page, strip_dir, debug=debug)
    if not manifest:
        raise RuntimeError(f"{page}: no strips produced — staff detection found nothing.")

    decoded: list[dict] = []
    total_ms = 0.0
    for row in manifest:
        img = Image.open(strip_dir / row["strip"]).convert("RGB")
        pv = rt.processor(images=img, return_tensors="pt").pixel_values.numpy()
        ids, enc_ms, dec_ms, logprobs = onnx_greedy_decode(
            rt.sessions, pv, rt.start_id, rt.eos_id, return_logprobs=True
        )
        text = rt.tok.decode(ids, skip_special_tokens=True).strip()
        total_ms += enc_ms + dec_ms
        entry = {
            "strip": row["strip"], "system": row["system"], "window": row["window"],
            "is_row_start": row["is_row_start"], "tokens": text,
            # slicer measure geometry (Rung-3 emitter alignment input)
            "meas_from": row.get("meas_from"), "meas_to": row.get("meas_to"),
            "n_measures": row.get("n_measures"), "split_wide": row.get("split_wide"),
            "row_measures": row.get("row_measures"),
            # decode confidence (review columns + Step-5 triage)
            "n_ids": len(ids),
            "hit_cap": len(ids) >= MAX_TOKENS and (not ids or ids[-1] != rt.eos_id),
            "min_logprob": round(min(logprobs), 4) if logprobs else None,
            "mean_logprob": round(sum(logprobs) / len(logprobs), 4) if logprobs else None,
        }
        decoded.append(entry)
        if verbose:
            tag = "row-start" if row["is_row_start"] else "mid-row  "
            print(f"  s{row['system']:02d}w{row['window']:02d} [{tag}] "
                  f"({enc_ms + dec_ms:.0f} ms, {len(ids)} tok): {text}")

    stem = Path(page).stem
    result = {"page": str(page), "checkpoint": rt.checkpoint, "suffix": rt.suffix,
              "total_ms": round(total_ms, 1), "strips": decoded}
    (strip_dir / f"{stem}_decode.json").write_text(json.dumps(result, indent=1))
    return result


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page")
    ap.add_argument("--checkpoint", default="data/checkpoints/rung22-stemfix-best")
    ap.add_argument("--onnx-dir", default="data/checkpoints/rung22-stemfix-best-onnx")
    ap.add_argument("--suffix", default="_int8", help="_int8 (browser runtime) or '' for fp32")
    ap.add_argument("--out", default="data/real/strips")
    args = ap.parse_args()

    rt = load_runtime(args.checkpoint, args.onnx_dir, args.suffix)
    print(f"\nDecoding ({args.suffix or 'fp32'}) ...\n")
    result = decode_page(args.page, rt, args.out)

    # concatenate per staff row (stage-8 stitching resolves \sig + expands repeats — see below)
    by_row: dict[int, list[str]] = defaultdict(list)
    for s in result["strips"]:
        by_row[s["system"]].append(s["tokens"])
    print("\n" + "=" * 78 + "\nPER-ROW TOKEN STREAMS (concatenated; pre-stitch)\n" + "=" * 78)
    for r in sorted(by_row):
        print(f"\n[row {r}] " + "  ".join(by_row[r]))

    n = len(result["strips"])
    print(f"\n{n} strips, {result['total_ms'] / 1000:.1f}s ({result['total_ms'] / n:.0f} ms/strip average)")
    decode_json = Path(args.out) / Path(args.page).stem / f"{Path(args.page).stem}_decode.json"
    print(f"\nwrote {decode_json}\nstitch it into an editable note model with:\n"
          f"  npx --yes tsx tools/render/stitch-cli.ts {decode_json} -o apps/web/public/decoded.json")


if __name__ == "__main__":
    main()
