#!/usr/bin/env python3
r"""One page, SEVERAL models, ONE cut — decode it with each and write scores the app can open.

WHY (owner, 2026-09-19/20). Looking at a whole page in the app is the instrument the owner trusts
most (*"exam ve evaluationlar o kadar fazla şey söylemiyor"*), and it is the one thing the strip
scorers cannot do: they score a strip in isolation and never look at the joins, so a page-level
defect is invisible to every number this project has.

⭐ **THE PAGE IS SLICED EXACTLY ONCE** and every model reads the same crops. That is the whole point
— if each arm re-sliced, a difference between two pages could be the slicer rather than the model,
and [docs/METRICS-SLICER-ROOTS.md](../../docs/METRICS-SLICER-ROOTS.md) prices how often a re-cut
moves pixels (20 of 30 pages; 15% of labelled strips change bytes).

⚠ **NO GOLD, SO NO NUMBER COMES OUT OF THIS.** It writes pictures to look at. An accuracy claim
needs `paired_arm_score.py` on a labelled pool, with its interval.

⚠ **`--int8` reads the LIVE runtime.** Every accuracy number in this project is measured on the
PyTorch checkpoint while the app serves int8 ([docs/METRICS-ONNX.md](../../docs/METRICS-ONNX.md)),
and on `meltem1` the quantization alone moved 11 tokens over 7 of 23 strips — about as much as
replacing the model. Only checkpoints with an exported `-onnx` folder can be asked for.

⛔ **THE STITCH PATH APPLIES `canonical_label` TO EVERY ARM.** Scheme H's decoder glues units
(`b''32a''32`) and `stitch.ts` cannot split them, so an H page collapses to a few empty measures.
Re-spacing first is what makes the comparison about the MODEL rather than about that gap. Verified
on `meltem1`: for the old-vocabulary arms the re-spaced stitch is byte-identical to the raw one, so
this is one code path and not a favour done to H.

⛔ **SCORES GO TO `apps/web/public/scores/`, NEVER THE PUBLIC ROOT.** `prune-dist.mjs` fails any
build carrying a `.json` at the dist root, and these are decodes of someone else's engraving. That
directory is already gitignored AND already on the script's `DROP` list, so it cannot reach a build.
⚠ **The document `name` is left alone on purpose** — `doc.name` seeds the per-piece hash that picks
bracket-or-arc for a tuplet ([../../CLAUDE.md](../../CLAUDE.md)), so renaming the arms would
re-engrave their triplets and make the pages differ for a reason that is not the model.

    .venv-ml/bin/python scripts/rung3/decode_page_arms.py exam_pages/sutaniyegah-sirto.png \
        --prefix sirto --int8
    # then: npm run dev:web   ->   /?score=/scores/sirto_live.json

~0.25 s per strip per model on the M4's GPU, plus one slice (~2-20 s). ⛔ Never point it at the exam.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "src/vision"))

# same three columns as build_model_compare.py, so the app view and the strip view agree
ARMS = [
    ("live", "data/checkpoints/r3a-stage2-best-real"),
    ("r4ctl", "data/checkpoints/r4-ctl-stage2-last"),
    ("r4h", "data/checkpoints/r4-h-stage2-best-edits"),
]
SCORES = "apps/web/public/scores"


def exam_guard(page: Path) -> None:
    """Refuse a page belonging to a piece in the frozen exam. Cheap, and the rule is one-way."""
    ts = json.loads((REPO / "data/real/rung3/testset.json").read_text())
    blob = json.dumps(ts).lower()
    stem = page.stem.lower().replace("-", "_")
    for part in [p for p in stem.split("_") if len(p) > 4]:
        if part in blob:
            print(f"⚠ '{part}' also appears in testset.json — CHECK by hand that "
                  f"{page.name} is not an exam page before quoting anything from it")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page")
    ap.add_argument("--prefix", default=None, help="score filename prefix (default: the page stem)")
    ap.add_argument("--int8", action="store_true",
                    help="also read the LIVE model's int8 ONNX — the runtime a visitor gets")
    ap.add_argument("--strips-root", default="data/real/strips")
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--max-length", type=int, default=100)
    ap.add_argument("--device", default=None)
    ap.add_argument("--no-stitch", action="store_true", help="write decodes only")
    args = ap.parse_args()

    page = Path(args.page)
    if not page.is_absolute():
        page = REPO / page
    if not page.exists():
        raise SystemExit(f"⛔ {page} does not exist")
    exam_guard(page)
    prefix = args.prefix or page.stem.replace("-", "_")

    import torch
    from PIL import Image
    from data import canonical_label
    from modeling import load_model_and_processor
    import page_to_strips as pts
    from page_to_strips import page_to_strips

    # ---- slice ONCE ---------------------------------------------------------------------------
    strip_dir = REPO / args.strips_root / page.stem
    man = page_to_strips(page, strip_dir, debug=True)
    if not man:
        raise SystemExit(f"⛔ {page.name}: staff detection found nothing")
    (strip_dir / "_manifest_shared.json").write_text(json.dumps(man, indent=1))
    wide = sum(1 for r in man if r.get("split_wide"))
    print(f"\n{len(man)} strips over {len({r['system'] for r in man})} staff rows "
          f"({wide} split_wide — a crop cut INSIDE one printed measure)\n")

    dev = args.device or ("cuda" if torch.cuda.is_available()
                          else "mps" if torch.backends.mps.is_available() else "cpu")
    imgs = [Image.open(strip_dir / r["strip"]).convert("RGB") for r in man]
    geom = pts.window_signature()

    def write(tag: str, ckpt: str, strips: list[dict], secs: float) -> Path:
        res = {"page": str(page), "checkpoint": ckpt, "suffix": tag, **geom,
               "total_ms": round(secs * 1000, 1), "strips": strips}
        p = strip_dir / f"{page.stem}_decode_{tag}.json"
        p.write_text(json.dumps(res, indent=1))
        ids = sorted(s["n_ids"] for s in strips)
        print(f"  {tag:10s} {secs:5.1f}s   ids med {ids[len(ids) // 2]:3d} max {ids[-1]:3d}   "
              f"hit_cap {sum(1 for s in strips if s['hit_cap'])}   -> {p.name}")
        return p

    def row(r: dict, text: str, n_ids: int, cap: bool, lo, mean) -> dict:
        return {**{k: r.get(k) for k in ("strip", "system", "window", "is_row_start", "meas_from",
                                         "meas_to", "n_measures", "split_wide", "row_measures")},
                # ⚠ canonical_label here, not at stitch time — see the header
                "tokens": canonical_label(text), "n_ids": n_ids, "hit_cap": cap,
                "min_logprob": lo, "mean_logprob": mean}

    written: list[tuple[str, Path]] = []
    print("decoding (all arms read the SAME crops):")
    for tag, ckpt in ARMS:
        t0 = time.time()
        model, processor, added = load_model_and_processor(str(REPO / ckpt))
        if added:
            raise SystemExit(f"⛔ {ckpt} is missing {added} project tokens — that is the base model")
        tok = processor.tokenizer
        model.to(dev).eval()
        strips: list[dict] = []
        with torch.no_grad():
            for at in range(0, len(imgs), args.batch_size):
                chunk = imgs[at: at + args.batch_size]
                pv = processor(images=chunk, return_tensors="pt").pixel_values.to(dev)
                gen = model.generate(pv, max_length=args.max_length)
                for r, ids in zip(man[at: at + args.batch_size], gen.tolist()):
                    if ids and ids[0] == model.config.decoder_start_token_id:
                        ids = ids[1:]
                    keep = [t for t in ids if t not in (tok.pad_token_id, tok.eos_token_id)]
                    strips.append(row(r, tok.decode(keep, skip_special_tokens=True).strip(),
                                      len(keep),
                                      len(keep) >= args.max_length - 1 and ids[-1] != tok.eos_token_id,
                                      None, None))
        written.append((tag, write(tag, ckpt, strips, time.time() - t0)))
        del model

    if args.int8:
        from decode_page import load_runtime
        from onnx_parity import onnx_greedy_decode
        ck = REPO / "data/checkpoints/r3a-stage2-best-real"
        onx = REPO / "data/checkpoints/r3a-stage2-best-real-onnx"
        if not onx.exists():
            print(f"  ⚠ {onx.name} missing — skipping int8")
        else:
            t0 = time.time()
            rt = load_runtime(str(ck), str(onx), "_int8")
            strips = []
            for r, img in zip(man, imgs):
                pv = rt.processor(images=img, return_tensors="pt").pixel_values.numpy()
                ids, _, _, lp = onnx_greedy_decode(rt.sessions, pv, rt.start_id, rt.eos_id,
                                                   return_logprobs=True)
                strips.append(row(r, rt.tok.decode(ids, skip_special_tokens=True).strip(), len(ids),
                                  False, round(min(lp), 4) if lp else None,
                                  round(sum(lp) / len(lp), 4) if lp else None))
            written.append(("live_int8", write("live_int8", f"{ck.name} int8 (THE LIVE RUNTIME)",
                                               strips, time.time() - t0)))

    if args.no_stitch:
        return 0

    # ---- stitch each into a score the app can open ---------------------------------------------
    out_dir = REPO / SCORES
    out_dir.mkdir(parents=True, exist_ok=True)
    print("\nstitching (--no-expand: the WRITTEN score, which is what the app draws):")
    links = []
    for tag, dec in written:
        dst = out_dir / f"{prefix}_{tag}.json"
        r = subprocess.run(["npx", "--yes", "tsx", "tools/render/stitch-cli.ts", str(dec),
                            "--no-expand", "-o", str(dst)],
                           cwd=REPO, capture_output=True, text=True)
        line = next((l for l in r.stdout.splitlines() if l.startswith("stitched")), r.stderr[-200:])
        warn = sum(1 for l in r.stdout.splitlines() if l.strip().startswith("warn:"))
        print(f"  {tag:10s} {line}{f'   [{warn} stitcher warnings]' if warn else ''}")
        links.append(f"  {tag:10s} http://localhost:5173/?score=/scores/{dst.name}")

    print("\n⭐ open these with `npm run dev:web` running:")
    print("\n".join(links))
    print("\n⚠ no gold for this page — this is for the eye, never a number.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
