"""
Rung 2 — scaled fine-tune of `Flova/omr_transformer` on strips_v2_2 (Phase 2 → 3).

WHAT: full fine-tune from the ORIGINAL pretrained weights (the overfit-10 checkpoint was a
throwaway diagnostic) on the 18.6k-strip `data/synthetic/strips_v2_2` set (v2 + nav-mark
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
import hashlib
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
    """(strip, augment?) items -> (PIL image, label) pairs (what collate expects).

    The per-item flag is the Round-1 multi-pool rule: synthetic strips get the full input-
    realism Augmenter, real strips are ALREADY in the input domain and train clean unless
    --augment-real (double-degrading a blurry nota scan buries its signal)."""

    def __init__(self, items: list, augment=None):
        self.items = items  # list[(Strip, bool)]
        self.augment = augment

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        from PIL import Image

        strip, aug = self.items[i]
        image = Image.open(strip.image_path).convert("RGB")
        if aug and self.augment is not None:
            image = Image.fromarray(self.augment(np.asarray(image)))
        return image, strip.label


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
    ap.add_argument("--strips-dir", default="data/synthetic/strips_v2_2")
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
    ap.add_argument("--real-dir", action="append", default=[], metavar="DIR[:REPEAT]",
                    help="real-strip pool (dir with manifest.jsonl, e.g. data/real/rung3/strips_nota); "
                         "':N' repeats the pool's train strips N times (pool-level oversampling); "
                         "repeatable. Pools are split by PIECE via a stable hash so the same piece "
                         "lands on the same side in every pool")
    ap.add_argument("--real-val-frac", type=float, default=0.10,
                    help="fraction of each real pool's pieces held out as real-val")
    ap.add_argument("--every-share", type=float, default=0.15,
                    help="target sampling share of SYNTHETIC 'every'-mode strips (Round-1 "
                         "pre-registered sweep: 0.267 = as-rendered, 0.15 default, 0.05). "
                         "Re-weights every-vs-carry WITHIN the synthetic pool via a per-epoch "
                         "WeightedRandomSampler, holding the synthetic:real ratio fixed. "
                         "Rationale: 'every' mode carries 4.22 inline accidentals/strip vs real's "
                         "0.32, so at its as-rendered 26.7% it supplies ~81%% of all inline "
                         "accidentals (4.4x the real rate) — a suspected driver of the "
                         "komaSharp/komaFlat hallucination. Negative value = OFF (corpus as-is).")
    ap.add_argument("--oversample-tup", type=int, default=1,
                    help="extra repeat factor for train strips whose label contains \\tup3 "
                         "(applies to every pool, synthetic included)")
    ap.add_argument("--augment-real", action="store_true",
                    help="run the Augmenter on real strips too (default: real strips train clean)")
    ap.add_argument("--no-augment", action="store_true")
    ap.add_argument("--photo-share", type=float, default=None, help="override augment.PHOTO_SHARE")
    ap.add_argument("--limit-train", type=int, default=None, help="smoke tests only")
    ap.add_argument("--limit-val", type=int, default=None)
    ap.add_argument("--device", default=None, help="cuda | mps | cpu (default: best available)")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    import torch
    from torch.utils.data import DataLoader, WeightedRandomSampler

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

    train_items = [(s, True) for s in train_ds.strips]
    val_items = [(s, False) for s in val_ds.strips]
    real_val_items: list = []
    synth_val_pieces = set(split["val_pieces"])
    for spec in args.real_dir:
        path, _, rep = spec.partition(":")
        rep = int(rep) if rep else 1
        rds = StripDataset(path)
        check_token_drift(rds)
        # split by piece with a STABLE hash: the same piece hashes to the same side in every
        # pool (pieces recur across pools/engravings — a piece must never be train in one
        # pool and val in another). Synthetic-val pieces are also forced to the val side.
        def is_val(piece: str) -> bool:
            if piece in synth_val_pieces:
                return True
            h = int(hashlib.md5(piece.encode()).hexdigest(), 16)
            return (h % 1000) < args.real_val_frac * 1000
        tr = [s for s in rds.strips if not is_val(s.piece)]
        va = [s for s in rds.strips if is_val(s.piece)]
        train_items += [(s, args.augment_real) for s in tr] * rep
        real_val_items += [(s, False) for s in va]
        print(f"   real pool {path}: {len(tr)} train x{rep} / {len(va)} val strips")
    if args.oversample_tup > 1:
        extra = [it for it in train_items if "\\tup3" in it[0].label]
        train_items += extra * (args.oversample_tup - 1)
        print(f"   tup3 oversample x{args.oversample_tup}: +{len(extra) * (args.oversample_tup - 1)} strips")

    # ---- every-share re-weighting (Round-1 pre-registered sweep) ------------------------------
    # 'every'-mode synthetic strips mark EVERY accidental inline (4.22/strip) while carry-mode and
    # real strips sit at ~0.32-0.36 — the real-page rate. Left as rendered, 'every' is 26.7% of the
    # synthetic corpus but supplies ~81% of all inline accidentals, inflating the model's
    # "emit an accidental" prior. This re-weights every-vs-carry WITHIN the synthetic pool to the
    # target share, holding the synthetic:real mass ratio fixed, via a per-epoch sampler (so no
    # strip is discarded — only its draw frequency changes).
    train_sampler = None
    if args.every_share >= 0:
        synth_ids = {id(s) for s in train_ds.strips}
        is_synth = [id(s) in synth_ids for s, _ in train_items]
        is_every = [sy and s.mode == "every" for (s, _), sy in zip(train_items, is_synth)]
        n_e = sum(is_every)
        n_c = sum(1 for sy, ev in zip(is_synth, is_every) if sy and not ev)
        n_r = len(train_items) - n_e - n_c
        if n_e == 0 or n_c == 0:
            print(f"   every-share: SKIPPED (every={n_e}, carry={n_c} — need both)")
        else:
            s_target, synth_total = args.every_share, n_e + n_c
            w_e = s_target * synth_total / n_e
            w_c = (1.0 - s_target) * synth_total / n_c
            weights = [
                (w_e if ev else w_c) if sy else 1.0
                for sy, ev in zip(is_synth, is_every)
            ]
            train_sampler = WeightedRandomSampler(weights, num_samples=len(train_items), replacement=True)
            drawn = s_target * synth_total / len(train_items)
            print(f"   every-share -> {s_target:.3f} of synthetic (was {n_e / synth_total:.3f}); "
                  f"pool: every={n_e} carry={n_c} real={n_r}; "
                  f"expected per-epoch mix: every {drawn:.1%} of all draws")

    augment = None
    if not args.no_augment:
        from augment import Augmenter

        augment = Augmenter(seed=args.seed, **({"photo_share": args.photo_share} if args.photo_share is not None else {}))
    print(f"== data: {len(train_items)} train / {len(val_items)} synth-val / {len(real_val_items)} real-val strips; "
          f"augment={'on' if augment else 'OFF'}; device={device}")

    # ---- model (resume = reload our own last checkpoint, weights already extended) ------------
    source = str(out_dir / "last") if args.resume else args.model
    print(f"== loading {source} ...")
    model, processor, added = load_model_and_processor(source)
    tok = processor.tokenizer
    print(f"   vocab: +{added} tokens -> {len(tok)} ids")
    model.to(device).train()

    collate_fn = partial(collate, processor=processor, tokenizer=tok)
    train_loader = DataLoader(
        AugmentedStrips(train_items, augment), batch_size=args.batch_size,
        shuffle=(train_sampler is None), sampler=train_sampler,
        num_workers=args.num_workers, worker_init_fn=worker_init, collate_fn=collate_fn,
        drop_last=True, persistent_workers=args.num_workers > 0,
    )
    val_loader = DataLoader(
        AugmentedStrips(val_items, None), batch_size=args.batch_size, shuffle=False,
        num_workers=0, collate_fn=collate_fn,
    )
    real_val_loader = DataLoader(
        AugmentedStrips(real_val_items, None), batch_size=args.batch_size, shuffle=False,
        num_workers=0, collate_fn=collate_fn,
    ) if real_val_items else None

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
            row = {"step": step, "val_loss": round(val_loss, 5)}
            select = val_loss
            if real_val_loader is not None:
                real_val = evaluate(model, real_val_loader, device, autocast_ctx)
                row["val_real"] = round(real_val, 5)
                # checkpoint selection = strip-count-weighted mean of both val pools (still
                # "val only" — the exam is never consulted)
                n_s, n_r = len(val_items), len(real_val_items)
                select = (val_loss * n_s + real_val * n_r) / (n_s + n_r)
                row["val_mix"] = round(select, 5)
            improved = select < best_val
            best_val = min(best_val, select)
            row["best"] = improved
            extra = f"  real {row['val_real']:.4f}  mix {row['val_mix']:.4f}" if "val_real" in row else ""
            print(f"   step {step:5d}  VAL loss {val_loss:.4f}{extra}{'  (new best)' if improved else ''}")
            log(row)
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
