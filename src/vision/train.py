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
import json
import math
import random
import sys
import time
from contextlib import contextmanager, nullcontext
from functools import partial
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data import StripDataset, check_token_drift, collate, is_real_val_piece, strip_special
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


class Ema:
    """Exponential moving average of the weights — free smoothing over the last ~1/(1-decay) steps.

    ⚠ **UNMEASURED IN THIS PROJECT** ([rung3/levers.md](../../docs/rung3/levers.md) Lever 5). It is
    OFF unless `--ema-decay` is given, and it must be read as a paired arm against a run without it —
    switching it on mid-round makes the arms incomparable, which is exactly what
    [BACKLOG.md](../../docs/BACKLOG.md) item 3 says about the selector.

    Costs one extra fp32 copy of the weights (~570 MB for this model) plus one more while swapped in.
    """

    def __init__(self, model, decay: float) -> None:
        self.decay = decay
        self.shadow = {k: v.detach().clone().float()
                       for k, v in model.state_dict().items() if v.is_floating_point()}

    def update(self, model) -> None:
        d = self.decay
        for k, v in model.state_dict().items():
            sh = self.shadow.get(k)
            if sh is not None:
                sh.mul_(d).add_(v.detach().float(), alpha=1.0 - d)

    @contextmanager
    def applied(self, model):
        """Swap the averaged weights in for the block, then put the live ones back."""
        msd = model.state_dict()
        backup = {k: msd[k].detach().clone() for k in self.shadow}
        for k, sh in self.shadow.items():
            msd[k].copy_(sh.to(msd[k].dtype))
        try:
            yield
        finally:
            for k, v in backup.items():
                msd[k].copy_(v)


def selection_edits(model, processor, tok, ds, device, batch_size: int, max_length: int) -> tuple[int, int]:
    """Free-running corrections on a FIXED pool — `(edits, exact)`.

    ⭐ WHY GENERATION AND NOT VAL LOSS. The checkpoint selector picked the wrong copy **three times
    out of three** in Round 3, and each time loss moved one way while corrections moved the other
    ([BACKLOG.md](../../docs/BACKLOG.md) item 3): `best` landed at step 500 and step 250 while real
    val kept falling, and on Run B the wrong pick was `best-real` itself. Teacher-forced loss cannot
    see an early `</s>`, which is the failure this round is about. This counts what a user would
    actually have to fix.

    ⚠ Deliberately IDENTICAL to `scripts/rung3/paired_arm_score.py`'s `decode_pool` — same
    `align`, same `strip_special`, same no-`\tie`-filter convention — because that is the tool the
    arms are judged with. Two implementations of "how many edits" would drift.
    """
    import torch

    from eval_omr import align

    model.eval()
    edits = exact = 0
    with torch.no_grad():
        for at in range(0, len(ds), batch_size):
            batch = [ds[i] for i in range(at, min(at + batch_size, len(ds)))]
            pv = processor(images=[im for im, _ in batch], return_tensors="pt").pixel_values
            gen = model.generate(pv.to(device), max_length=max_length)
            for (_, label), got in zip(batch, gen.tolist()):
                if got and got[0] == model.config.decoder_start_token_id:
                    got = got[1:]
                hyp = strip_special(got, tok)
                ref = strip_special(tok(label, add_special_tokens=True).input_ids, tok)
                edits += sum(1 for op, _, _ in align(ref, hyp) if op != "match")
                exact += hyp == ref
    model.train()
    return edits, exact


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
    ap.add_argument("--testset", default="data/real/rung3/testset.json",
                    help="frozen exam pieces; training REFUSES to start if any --real-dir pool "
                         "shares a SymbTr piece with the exam (matched on symbtr_file, never image "
                         "stem — the Round-1 contamination was the other engraving of an exam piece). "
                         "Set '' to disable (e.g. pure-synthetic runs).")
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
    ap.add_argument("--scan-share", type=float, default=None,
                    help="override augment.SCAN_SHARE (default 0.0 = no scan profile). The Round-3 "
                         "Lever-7 arm is --photo-share 0.20 --scan-share 0.25; leaving both unset "
                         "reproduces the control's augmentation exactly")
    ap.add_argument("--select-dir", action="append", default=[], metavar="DIR",
                    help="FIXED pool(s) used to pick the checkpoint by free-running CORRECTIONS "
                         "instead of val loss — e.g. data/real/rung3/_realval_v2. Repeatable. "
                         "Adds a `best-edits` checkpoint; leaves `best` and `best-real` untouched so "
                         "every earlier run stays comparable. ⚠ REFUSES to start if any of its "
                         "pieces is on the TRAIN side: at --real-val-frac 0.05 seventeen of "
                         "_realval_v2's 69 pieces would be trained on (measured 2026-09-06), which "
                         "would contaminate the selector silently.")
    ap.add_argument("--select-batch", type=int, default=None,
                    help="batch size for the free-running selection pass (default: --batch-size)")
    ap.add_argument("--select-max-length", type=int, default=60,
                    help="decoder budget for the selection pass; matches eval_omr's default")
    ap.add_argument("--label-smoothing", type=float, default=0.0,
                    help="cross-entropy label smoothing on the TRAIN loss only (val loss stays "
                         "unsmoothed, so its numbers keep meaning the same thing). UNMEASURED here "
                         "— run it as a paired arm, never as a mid-round switch.")
    ap.add_argument("--ema-decay", type=float, default=0.0,
                    help="keep an exponential moving average of the weights (0 = off, typical "
                         "0.999). Logs the EMA's own corrections and saves `ema-best` / `ema-last`. "
                         "UNMEASURED here — a paired arm, like --label-smoothing.")
    ap.add_argument("--limit-train", type=int, default=None, help="smoke tests only")
    ap.add_argument("--limit-val", type=int, default=None)
    ap.add_argument("--limit-select", type=int, default=None,
                    help="smoke tests only — the selection pass generates, so a full pool is slow on a Mac")
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
    real_pool_pieces: set = set()
    for spec in args.real_dir:
        path, _, rep = spec.partition(":")
        rep = int(rep) if rep else 1
        rds = StripDataset(path)
        check_token_drift(rds)
        real_pool_pieces |= {s.piece for s in rds.strips}
        # split by piece with a STABLE hash: the same piece hashes to the same side in every
        # pool (pieces recur across pools/engravings — a piece must never be train in one pool
        # and val in another). `is_real_val_piece` (data.py) is THE canonical assignment; the
        # Round-2 hard-tail recovery + real-val rebuild reuse it so recovered strips land on one
        # side by construction (docs/archive/rounds/round1.md, addenda item 3).
        def is_val(piece: str) -> bool:
            return is_real_val_piece(piece, synth_val_pieces, args.real_val_frac)
        tr = [s for s in rds.strips if not is_val(s.piece)]
        va = [s for s in rds.strips if is_val(s.piece)]
        train_items += [(s, args.augment_real) for s in tr] * rep
        real_val_items += [(s, False) for s in va]
        print(f"   real pool {path}: {len(tr)} train x{rep} / {len(va)} val strips")

    # ---- exam-disjointness guard (Round-1 contamination fix, docs/archive/rounds/round1.md, addenda item 2) -----
    # The exam is honest only if NO training piece is also an exam piece. The Round-1 exam leaked
    # 4 pieces because their OTHER engraving sat in a real pool (same SymbTr score, different image
    # stem) and the emit-time filter never re-ran after the pools grew. This is the fail-closed
    # backstop: match on the SymbTr piece id (== testset symbtr_file minus '.txt' == manifest
    # `piece`), never the image stem, and REFUSE to start on any overlap.
    if args.testset and real_pool_pieces:
        ts = json.loads(Path(args.testset).read_text())
        exam_pieces = {
            (p["symbtr_file"][:-4] if p.get("symbtr_file", "").endswith(".txt") else p.get("symbtr_file", ""))
            for p in ts["pieces"]
        }
        leaked = sorted(real_pool_pieces & exam_pieces)
        if leaked:
            raise SystemExit(
                f"EXAM CONTAMINATION — {len(leaked)} training piece(s) are also exam pieces "
                f"(matched on SymbTr id; a different engraving still leaks the score):\n  "
                + "\n  ".join(leaked)
                + "\n  Remove them from the --real-dir pools (or the exam) before training. "
                  "Pass --testset '' only if you intend to train without the guard."
            )
        print(f"   exam-disjointness OK: {len(real_pool_pieces)} real pieces, 0 in the {len(exam_pieces)}-piece exam")
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
    mix = ""
    if not args.no_augment:
        from augment import Augmenter

        kw = {}
        if args.photo_share is not None:
            kw["photo_share"] = args.photo_share
        if args.scan_share is not None:
            kw["scan_share"] = args.scan_share
        augment = Augmenter(seed=args.seed, **kw)
        # The augmentation MIX is the whole variable of the Lever-7 arm, and nothing downstream
        # records it — the corpus, the split and the checkpoint are identical between that arm and
        # its control. Printing it here is what makes a finished run say which arm it was.
        mix = (f" (screenshot {1 - augment.photo_share - augment.scan_share:.2f} / "
               f"photo {augment.photo_share:.2f} / scan {augment.scan_share:.2f})")
    # ---- the selection pool: what picks the checkpoint (Round 4, docs/rung3/round4.md step 2) --
    # ⭐ This is a FIXED pool, not a slice of the training pools. `best-real` reads whatever ~10% of
    # each --real-dir the piece hash held out, so ADDING a real pool silently changes what it means:
    # on Round-3 Run B that set was 560 strips, 170 of them retired-crop, and `best-real` was the
    # WRONG pick (docs/BACKLOG.md item 3). A named pool cannot drift like that.
    select_ds = None
    if args.select_dir:
        train_pieces = {s_.piece or s_.image_path.name.split("_")[0] for s_, _ in train_items}
        select_strips = []
        for d in args.select_dir:
            # ⚠ NO `check_token_drift` here, deliberately. It is a regex guard for pools the TS
            # serializer writes; a hand-corrected val pool spells 19.1% of its rows with no space
            # after a token (`\repstarte''8`), and the tokenizer's added-token matcher reads those
            # IDENTICALLY to the spaced form — measured 2026-09-06 on all 51 such rows in
            # `_realval_v2` (docs/METRICS-UNSEEN.md). Running it here fails a pool that is fine.
            select_strips += StripDataset(d).strips
        leaked = sorted({s_.piece for s_ in select_strips if s_.piece in train_pieces})
        if leaked:
            # ⛔ Not a warning. A selector scored on pieces the model trained on picks the most
            # over-fitted checkpoint, and nothing downstream would ever show it.
            raise SystemExit(
                f"⛔ {len(leaked)} selection piece(s) are in TRAINING — the selector would be "
                f"contaminated: {leaked[:5]}{' ...' if len(leaked) > 5 else ''}\n"
                f"   `_realval_v2` is built from val-side pieces at --real-val-frac 0.10; at 0.05 "
                f"seventeen of its 69 pieces cross over. Raise --real-val-frac or drop the pool."
            )
        select_ds = StripDataset(args.select_dir[0])
        select_ds.strips = select_strips[: args.limit_select] if args.limit_select else select_strips

    sel_note = f" / {len(select_ds.strips)} SELECTION (free-running edits)" if select_ds else ""
    print(f"== data: {len(train_items)} train / {len(val_items)} synth-val / {len(real_val_items)} real-val strips"
          f"{sel_note}; augment={'on' + mix if augment else 'OFF'}; device={device}")

    # ---- model (resume = reload our own last checkpoint, weights already extended) ------------
    source = str(out_dir / "last") if args.resume else args.model
    print(f"== loading {source} ...")
    model, processor, added = load_model_and_processor(source)
    tok = processor.tokenizer
    print(f"   vocab: +{added} tokens -> {len(tok)} ids")
    model.to(device).train()

    # Both OFF by default and both unmeasured in this project — they are paired arms, not defaults.
    ema = Ema(model, args.ema_decay) if args.ema_decay > 0 else None
    # Label smoothing rides on our own criterion because the model's built-in loss is plain CE.
    # ⚠ TRAIN ONLY: `evaluate` keeps the unsmoothed loss, so `val_loss` keeps meaning what it has
    # meant in every earlier run and `best` stays comparable.
    smooth_ce = (torch.nn.CrossEntropyLoss(ignore_index=-100, label_smoothing=args.label_smoothing)
                 if args.label_smoothing > 0 else None)
    if ema or smooth_ce:
        print(f"   arms: ema_decay={args.ema_decay or 'off'}  label_smoothing={args.label_smoothing or 'off'}")

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
    # ⭐ A THIRD CHECKPOINT, SELECTED ON THE REAL VAL LOSS ALONE (2026-09-01). `best` blends the two
    # val pools BY STRIP COUNT, so at the default --real-val-frac the synthetic side carries ~92% of
    # the vote in a round graded on real pages. Measured on the Round-3 final run: `best` landed at
    # step 500 while real val kept falling to step 1750, and the step-1750 model needed 22% fewer
    # corrections on _realval_v2 (docs/BACKLOG.md item 3, docs/METRICS.md).
    # ⚠ THIS DOES NOT CHANGE HOW `best` IS CHOSEN — the blend is untouched, so runs stay comparable
    # with every earlier one. It only ADDS `best-real`, so a long run cannot silently discard its
    # best real-page checkpoint between two evals. Costs one extra checkpoint write per improvement.
    best_real = float("inf")
    # ⭐ ROUND 4: the criterion the round is actually graded on — corrections on a FIXED pool, read
    # by generating, not by teacher-forced loss. Adds `best-edits`; `best` and `best-real` keep
    # their old meanings so this run is still comparable with every earlier one, which is the same
    # rule the 2026-09-01 `best-real` addition followed.
    best_edits = best_ema_edits = 1 << 30
    state_path = out_dir / "last" / "trainer_state.pt"
    if args.resume:
        state = torch.load(state_path, map_location="cpu", weights_only=False)
        optim.load_state_dict(state["optimizer"])
        sched.load_state_dict(state["scheduler"])
        scaler.load_state_dict(state["scaler"])
        step, best_val = state["step"], state["best_val"]
        best_real = state.get("best_real", float("inf"))
        best_edits = state.get("best_edits", 1 << 30)
        best_ema_edits = state.get("best_ema_edits", 1 << 30)
        if ema is not None and state.get("ema"):
            ema.shadow = {k: v.to(ema.shadow[k].device) for k, v in state["ema"].items() if k in ema.shadow}
        elif ema is not None:
            print("   ⚠ resumed WITHOUT an EMA in the state — the average restarts from here")
        print(f"== resumed at step {step} (best val {best_val:.4f})")

    metrics_path = out_dir / "metrics.jsonl"

    def log(row: dict) -> None:
        with metrics_path.open("a") as f:
            f.write(json.dumps(row) + "\n")

    def save(tag: str, use_ema: bool = False) -> None:
        d = out_dir / tag
        if use_ema and ema is not None:
            with ema.applied(model):
                save_model(d, model, processor)
        else:
            save_model(d, model, processor)
        state = {"step": step, "best_val": best_val, "best_real": best_real,
                 "best_edits": best_edits, "best_ema_edits": best_ema_edits,
                 "optimizer": optim.state_dict(),
                 "scheduler": sched.state_dict(), "scaler": scaler.state_dict()}
        # The EMA shadow is another full copy of the weights, so it rides ONLY on the resume point.
        # Every other tag is a model to read, not a run to continue.
        if ema is not None and tag == "last":
            state["ema"] = {k: v.cpu() for k, v in ema.shadow.items()}
        torch.save(state, d / "trainer_state.pt")

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
            pv, lb = pixel_values.to(device), labels.to(device)
            with autocast_ctx():
                out = model(pixel_values=pv, labels=lb)
                loss = out.loss if smooth_ce is None else smooth_ce(
                    out.logits.reshape(-1, out.logits.size(-1)).float(), lb.reshape(-1))
            loss_acc += loss.item() / args.grad_accum
            scaler.scale(loss / args.grad_accum).backward()
        scaler.unscale_(optim)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(optim)
        scaler.update()
        sched.step()
        if ema is not None:
            ema.update(model)
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
            real_improved = real_val_loader is not None and row["val_real"] < best_real
            if real_improved:
                best_real = row["val_real"]
                row["best_real"] = True
            # ⭐ The Round-4 criterion. Loss is kept and logged — it is what `best` has always
            # meant — but what stamps `best-edits` is how many corrections a user would make.
            edits_improved = ema_improved = False
            if select_ds is not None:
                sel_bs = args.select_batch or args.batch_size
                ed, ex = selection_edits(model, processor, tok, select_ds, device,
                                         sel_bs, args.select_max_length)
                row["edits"], row["edits_exact"] = ed, ex
                edits_improved = ed < best_edits
                if edits_improved:
                    best_edits = ed
                    row["best_edits"] = True
                if ema is not None:
                    with ema.applied(model):
                        ed_e, ex_e = selection_edits(model, processor, tok, select_ds, device,
                                                     sel_bs, args.select_max_length)
                    row["edits_ema"], row["edits_ema_exact"] = ed_e, ex_e
                    ema_improved = ed_e < best_ema_edits
                    if ema_improved:
                        best_ema_edits = ed_e
                        row["best_ema"] = True

            extra = f"  real {row['val_real']:.4f}  mix {row['val_mix']:.4f}" if "val_real" in row else ""
            if "edits" in row:
                extra += f"  EDITS {row['edits']}/{len(select_ds.strips)} strips (exact {row['edits_exact']})"
                if "edits_ema" in row:
                    extra += f"  ema {row['edits_ema']}"
            tags = (("  (new best)" if improved else "") + ("  (new best-real)" if real_improved else "")
                    + ("  (new best-edits)" if edits_improved else "") + ("  (new ema-best)" if ema_improved else ""))
            print(f"   step {step:5d}  VAL loss {val_loss:.4f}{extra}{tags}")
            log(row)
            if improved:
                save("best")
            if real_improved:
                save("best-real")
            if edits_improved:
                save("best-edits")
            if ema_improved:
                save("ema-best", use_ema=True)

        if step % args.save_every == 0 or step == args.max_steps:
            save("last")

    if ema is not None:
        save("ema-last", use_ema=True)
    print(f"\n== done: {step} steps, best val loss {best_val:.4f}, best REAL val {best_real:.4f}"
          + (f", fewest EDITS {best_edits}" if select_ds is not None else ""))
    print(f"   checkpoints: {out_dir}/best (lowest blended val loss — ~92% synthetic), "
          f"{out_dir}/best-real (lowest REAL val loss), {out_dir}/last (resume point)")
    if select_ds is not None:
        print(f"   {out_dir}/best-edits — fewest free-running corrections on "
              f"{len(select_ds.strips)} fixed strips. ⭐ This is the Round-4 pick; the two loss "
              f"tags above are kept only so the run stays comparable with earlier ones.")
    if ema is not None:
        print(f"   {out_dir}/ema-best, {out_dir}/ema-last — the weight average (decay {args.ema_decay})")
    print("   ⚠ Choose between them on _realval_v2 with paired_arm_score.py — never on these losses.")
    print(f"   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint {out_dir}/best")
    return 0


if __name__ == "__main__":
    sys.exit(main())
