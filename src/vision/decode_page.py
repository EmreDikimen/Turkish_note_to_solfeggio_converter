"""Rung 4, stages 1+7 — decode a full PAGE end-to-end: slice -> strips -> ONNX -> tokens.

Chains `page_to_strips` (classical-CV slicing) into the PROVEN Rung-1.5 ONNX greedy decode
(`onnx_parity.onnx_greedy_decode`), the same int8 graphs the browser runs. Each strip decodes to
a LilyPond-ish token stream; this prints them per strip and concatenated per staff row, and
writes `<page>_decode.json` next to the strips — the input of the stage-8 STITCHER
(`tools/render/stitch-cli.ts`), which turns it into an editor-loadable note model:

    npx --yes tsx tools/render/stitch-cli.ts data/real/strips/<page>/<page>_decode.json \
        -o apps/web/public/decoded.json

Run (int8 graphs = the browser runtime):
    .venv-ml/bin/python src/vision/decode_page.py data/real/images/hicaz/<page>.png \
        --checkpoint data/checkpoints/rung22-stemfix-best \
        --onnx-dir data/checkpoints/rung22-stemfix-best-onnx --suffix _int8
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from onnx_parity import onnx_greedy_decode
from page_to_strips import page_to_strips


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page")
    ap.add_argument("--checkpoint", default="data/checkpoints/rung22-stemfix-best")
    ap.add_argument("--onnx-dir", default="data/checkpoints/rung22-stemfix-best-onnx")
    ap.add_argument("--suffix", default="_int8", help="_int8 (browser runtime) or '' for fp32")
    ap.add_argument("--out", default="data/real/strips")
    args = ap.parse_args()

    import onnxruntime as ort
    from transformers import AutoConfig, AutoProcessor

    # 1) slice the page into training-shaped strips
    strip_dir = Path(args.out) / Path(args.page).stem
    manifest = page_to_strips(args.page, strip_dir, debug=True)
    if not manifest:
        sys.exit("No strips produced — staff detection found nothing.")

    # 2) load the processor + ONNX graphs (the exact browser runtime)
    processor = AutoProcessor.from_pretrained(args.checkpoint)
    tok = processor.tokenizer
    cfg = AutoConfig.from_pretrained(args.checkpoint)
    start_id = getattr(cfg, "decoder_start_token_id", None) or tok.bos_token_id
    eos_id = tok.eos_token_id
    onnx_dir = Path(args.onnx_dir)
    sessions = tuple(
        ort.InferenceSession(str(onnx_dir / f"{n}{args.suffix}.onnx"))
        for n in ("encoder_model", "decoder_model", "decoder_with_past_model")
    )

    # 3) decode each strip
    print(f"\nDecoding {len(manifest)} strips ({args.suffix or 'fp32'}) ...\n")
    by_row: dict[int, list[str]] = defaultdict(list)
    decoded: list[dict] = []
    total_ms = 0.0
    for row in manifest:
        img = Image.open(strip_dir / row["strip"]).convert("RGB")
        pv = processor(images=img, return_tensors="pt").pixel_values.numpy()
        ids, enc_ms, dec_ms = onnx_greedy_decode(sessions, pv, start_id, eos_id)
        text = tok.decode(ids, skip_special_tokens=True).strip()
        total_ms += enc_ms + dec_ms
        by_row[row["system"]].append(text)
        decoded.append({"strip": row["strip"], "system": row["system"], "window": row["window"],
                        "is_row_start": row["is_row_start"], "tokens": text})
        tag = "row-start" if row["is_row_start"] else "mid-row  "
        print(f"  s{row['system']:02d}w{row['window']:02d} [{tag}] "
              f"({enc_ms + dec_ms:.0f} ms, {len(ids)} tok): {text}")

    # 4) concatenate per staff row (stage-8 stitching resolves \sig + expands repeats — see below)
    print("\n" + "=" * 78 + "\nPER-ROW TOKEN STREAMS (concatenated; pre-stitch)\n" + "=" * 78)
    for s in sorted(by_row):
        print(f"\n[row {s}] " + "  ".join(by_row[s]))
    print(f"\n{len(manifest)} strips, {total_ms / 1000:.1f}s "
          f"({total_ms / len(manifest):.0f} ms/strip average)")

    # 5) the stitcher's input: per-strip token streams, in page order
    import json
    stem = Path(args.page).stem
    decode_json = strip_dir / f"{stem}_decode.json"
    decode_json.write_text(json.dumps({"page": str(args.page), "checkpoint": args.checkpoint,
                                       "suffix": args.suffix, "strips": decoded}, indent=1))
    print(f"\nwrote {decode_json}\nstitch it into an editable note model with:\n"
          f"  npx --yes tsx tools/render/stitch-cli.ts {decode_json} -o apps/web/public/decoded.json")


if __name__ == "__main__":
    main()
