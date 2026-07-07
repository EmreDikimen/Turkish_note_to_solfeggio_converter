"""
Rung 2 — scaled fine-tune of `Flova/omr_transformer` on strips_v2_1 (Phase 2 → 3).

WHAT: full fine-tune from the ORIGINAL pretrained weights (the overfit-10 checkpoint was a
throwaway diagnostic) on the 18.6k-strip `data/synthetic/strips_v2_1` set (v2 + nav-mark
tokens + centered rests), with on-the-fly input-realism augmentation (`augment.py` —
screenshot-dominant, see its docstring), split BY PIECE from `data/split.json` (strips of one
piece are near-duplicates; a piece straddling both splits contaminates validation),
teacher-forced val loss, and checkpoint/resume so a killed Colab session costs minutes, not
the run.

HOW to judge it: this script only tracks val LOSS (cheap, every --eval-every steps). The
headline metric — per-class AEU accidental accuracy — needs generation and lives in
`eval_omr.py`; run it on `<out-dir>/best` after (or during) training.

Local smoke test (Mac, MPS — shake the wiring out BEFORE paying for Colab Pro):
    .venv-ml/bin/python src/vision/train.py --out-dir data/checkpoints/rung2-smoke \\
        --limit-train 24 --limit-val 8 --max-steps 6 --eval-every 3 --batch-size 4

Colab: step-by-step guide in docs/COLAB.md, ready-made notebook in
notebooks/rung2_colab.ipynb, upload package built by scripts/make_colab_zip.sh.
Data lives on the VM disk (NOT read from mounted Drive — Drive I/O is too slow for a
dataloader); checkpoints DO go to Drive so a killed session resumes with --resume.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from contextlib import nullcontext
from functools import partial
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data import StripDataset, check_token_drift, collate
from modeling import MODEL_ID, load_model_and_processor, save_model


class AugmentedStrips:
    """StripDataset + augmentation: PIL -> numpy -> Augmenter -> PIL (what collate expects)."""

    def __init__(self, ds: StripDataset, augment=None):
        self.ds = ds
        self.augment = augment

    def __len__(self) -> int:
        return len(self.ds)

    def __getitem__(self, i: int):
        from PIL import Image

        image, label = self.ds[i]
        if self.augment is not None:
            image = Image.fromarray(self.augment(np.asarray(image)))
        return image, label


def worker_init(worker_id: int) -> None:
    """
    Per-worker reseeding. Without this every DataLoader worker inherits an identical COPY of
    the parent's RNG state (albumentations' python `random`, numpy, and the Augmenter's own
    generator) and produces the same augmentation stream — the epoch would see each corruption
    num_workers times.
    """
    import torch

    seed = torch.initial_seed() % 2**32
    random.seed(seed)
    np.random.seed(seed)
    info = torch.utils.data.get_worker_info()
    if info is not None and getattr(info.dataset, "augment", None) is not None:
        info.dataset.augment.rng = np.random.default_rng(seed)


def lr_lambda(step: int, warmup: int, total: int) -> float:
    """Linear warmup to 1, then cosine decay to ~0 at `total` steps."""
    if step < warmup:
        return (step + 1) / max(1, warmup)
    t = (step - warmup) / max(1, total - warmup)
    return 0.5 * (1.0 + math.cos(math.pi * min(t, 1.0)))


def evaluate(model, loader, device, autocast_ctx) -> float:
    """Mean teacher-forced val loss (clean images — augmentation is train-only)."""
    import torch

    model.eval()
    total, n = 0.0, 0
    with torch.no_grad():
        for pixel_values, labels in loader:
            with autocast_ctx():
                loss = model(pixel_values=pixel_values.to(device), labels=labels.to(device)).loss
            total += loss.item() * len(labels)
            n += len(labels)
    model.train()
    return total / max(1, n)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strips-dir", default="data/synthetic/strips_v2_1")
    ap.add_argument("--split", default="data/split.json")
    ap.add_argument("--out-dir", required=True, help="checkpoints + metrics.jsonl (Drive on Colab)")
    ap.add_argument("--model", default=MODEL_ID, help="base weights (Rung 2 default: the ORIGINAL pretrained)")
    ap.add_argument("--resume", action="store_true", help="continue from <out-dir>/last")
    ap.add_argument("--max-steps", type=int, default=6000)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--grad-accum", type=int, default=1)
    ap.add_argument("--lr", type=float, default=3e-5, help="full fine-tune LR (plan: 1e-5..5e-5)")
    ap.add_argument("--warmup-steps", type=int, default=250)
    ap.add_argument("--weight-decay", type=float, default=0.01)
    ap.add_argument("--eval-every", type=int, default=500)
    ap.add_argument("--save-every", type=int, default=500, help="refresh <out-dir>/last")
    ap.add_argument("--log-every", type=int, default=25)
    ap.add_argument("--num-workers", type=int, default=0, help="0 on the Mac (spawn quirks); 2 on Colab")
    ap.add_argument("--no-augment", action="store_true")
    ap.add_argument("--photo-share", type=float, default=None, help="override augment.PHOTO_SHARE")
    ap.add_argument("--limit-train", type=int, default=None, help="smoke tests only")
    ap.add_argument("--limit-val", type=int, default=None)
    ap.add_argument("--device", default=None, help="cuda | mps | cpu (default: best available)")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    import torch
    from torch.utils.data import DataLoader

    device = args.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    np.random.seed(args.seed)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- data -------------------------------------------------------------------------------
    split = json.loads(Path(args.split).read_text())
    train_ds = StripDataset(args.strips_dir, pieces=set(split["train_pieces"]))
    val_ds = StripDataset(args.strips_dir, pieces=set(split["val_pieces"]))
    check_token_drift(train_ds)
    if args.limit_train:
        train_ds.strips = train_ds.strips[: args.limit_train]
    if args.limit_val:
        val_ds.strips = val_ds.strips[: args.limit_val]

    augment = None
    if not args.no_augment:
        from augment import Augmenter

        augment = Augmenter(seed=args.seed, **({"photo_share": args.photo_share} if args.photo_share is not None else {}))
    print(f"== data: {len(train_ds)} train / {len(val_ds)} val strips; augment={'on' if augment else 'OFF'}; device={device}")

    # ---- model (resume = reload our own last checkpoint, weights already extended) ------------
    source = str(out_dir / "last") if args.resume else args.model
    print(f"== loading {source} ...")
    model, processor, added = load_model_and_processor(source)
    tok = processor.tokenizer
    print(f"   vocab: +{added} tokens -> {len(tok)} ids")
    model.to(device).train()

    collate_fn = partial(collate, processor=processor, tokenizer=tok)
    train_loader = DataLoader(
        AugmentedStrips(train_ds, augment), batch_size=args.batch_size, shuffle=True,
        num_workers=args.num_workers, worker_init_fn=worker_init, collate_fn=collate_fn,
        drop_last=True, persistent_workers=args.num_workers > 0,
    )
    val_loader = DataLoader(
        AugmentedStrips(val_ds, None), batch_size=args.batch_size, shuffle=False,
        num_workers=0, collate_fn=collate_fn,
    )

    # ---- optimizer / schedule / AMP ----------------------------------------------------------
    optim = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    sched = torch.optim.lr_scheduler.LambdaLR(optim, partial(lr_lambda, warmup=args.warmup_steps, total=args.max_steps))
    # bf16 on modern GPUs (no scaler needed); fp16+scaler on T4; full fp32 on MPS/CPU
    use_cuda = device == "cuda"
    amp_dtype = torch.bfloat16 if use_cuda and torch.cuda.is_bf16_supported() else torch.float16
    scaler = torch.amp.GradScaler("cuda", enabled=use_cuda and amp_dtype == torch.float16)
    autocast_ctx = (lambda: torch.autocast("cuda", dtype=amp_dtype)) if use_cuda else nullcontext

    step, best_val = 0, float("inf")
    state_path = out_dir / "last" / "trainer_state.pt"
    if args.resume:
        state = torch.load(state_path, map_location="cpu", weights_only=False)
        optim.load_state_dict(state["optimizer"])
        sched.load_state_dict(state["scheduler"])
        scaler.load_state_dict(state["scaler"])
        step, best_val = state["step"], state["best_val"]
        print(f"== resumed at step {step} (best val {best_val:.4f})")

    metrics_path = out_dir / "metrics.jsonl"

    def log(row: dict) -> None:
        with metrics_path.open("a") as f:
            f.write(json.dumps(row) + "\n")

    def save(tag: str) -> None:
        d = out_dir / tag
        save_model(d, model, processor)
        torch.save(
            {"step": step, "best_val": best_val, "optimizer": optim.state_dict(),
             "scheduler": sched.state_dict(), "scaler": scaler.state_dict()},
            d / "trainer_state.pt",
        )

    # ---- train loop ---------------------------------------------------------------------------
    print(f"== training to step {args.max_steps} (batch {args.batch_size} x accum {args.grad_accum}, lr {args.lr})")
    t0 = time.time()
    data_iter = iter(train_loader)
    while step < args.max_steps:
        optim.zero_grad()
        loss_acc = 0.0
        for _ in range(args.grad_accum):
            try:
                pixel_values, labels = next(data_iter)
            except StopIteration:
                data_iter = iter(train_loader)
                pixel_values, labels = next(data_iter)
            with autocast_ctx():
                loss = model(pixel_values=pixel_values.to(device), labels=labels.to(device)).loss
            loss_acc += loss.item() / args.grad_accum
            scaler.scale(loss / args.grad_accum).backward()
        scaler.unscale_(optim)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(optim)
        scaler.update()
        sched.step()
        step += 1

        if step == 1 or step % args.log_every == 0:
            lr_now = sched.get_last_lr()[0]
            print(f"   step {step:5d}  loss {loss_acc:.4f}  lr {lr_now:.2e}  ({(time.time()-t0)/step:.2f}s/step)")
            log({"step": step, "loss": round(loss_acc, 5), "lr": lr_now})

        if step % args.eval_every == 0 or step == args.max_steps:
            val_loss = evaluate(model, val_loader, device, autocast_ctx)
            improved = val_loss < best_val
            best_val = min(best_val, val_loss)
            print(f"   step {step:5d}  VAL loss {val_loss:.4f}{'  (new best)' if improved else ''}")
            log({"step": step, "val_loss": round(val_loss, 5), "best": improved})
            if improved:
                save("best")

        if step % args.save_every == 0 or step == args.max_steps:
            save("last")

    print(f"\n== done: {step} steps, best val loss {best_val:.4f}")
    print(f"   checkpoints: {out_dir}/best (lowest val loss), {out_dir}/last (resume point)")
    print(f"   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint {out_dir}/best")
    return 0


if __name__ == "__main__":
    sys.exit(main())
