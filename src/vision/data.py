"""
Strip dataset + batch collation for fine-tuning the OMR model (Phase 2, Rung 1+).

WHAT: turns `data/synthetic/strips/` (PNG images + faithful LilyPond labels, produced by
`tools/render/render.ts`) into the `(pixel_values, labels)` tensors a VisionEncoderDecoder
model trains on.

WHY a module: the overfit-10 gate (`overfit10.py`) and the later scaled fine-tune share the
same data plumbing; only the sample count and schedule differ.

HOW the pieces map to training concepts:
  - `StripDataset`      — the (image, label-string) pairs; nothing tensor-y yet.
  - `ADDED_TOKENS`      — the new vocabulary this project teaches the model. MUST mirror
                          `tools/render/lilypond.ts` (the TS side is the source of truth,
                          because labels are generated there).
  - `check_token_drift` — scans real labels for `\\`-tokens missing from ADDED_TOKENS, so a
                          TS-side change can't silently produce untokenizable labels.
  - `collate`           — batches: images through the model's processor (resize/normalize to
                          the encoder's input frame), labels through the tokenizer, padded to
                          equal length with **-100** so cross-entropy ignores pad positions
                          (the transformers "labels" convention).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

# Mirrors ADDED_TOKENS in tools/render/lilypond.ts (8 AEU accidentals + natural + signature
# delimiters + 4 repeat-sign tokens + 4 navigation-mark tokens (segno/coda/D.C./Son — see
# tools/render/navmarks.ts) + barline + the digit `3`, which the base vocab lacks).
# Keep in sync by hand; `check_token_drift` catches a mismatch against the actual rendered labels.
ADDED_TOKENS: list[str] = [
    "\\komaSharp", "\\bakiyeSharp", "\\kucukSharp", "\\buyukSharp",
    "\\komaFlat", "\\bakiyeFlat", "\\kucukFlat", "\\buyukFlat",
    "\\natural", "\\sig", "\\sigend",
    "\\repstart", "\\repend", "\\volta1", "\\volta2",
    "\\segno", "\\coda", "\\dc", "\\fine",
    "|", "3",
]

# Digits included: \volta1 / \volta2 are single tokens — a letters-only pattern would extract
# them as a bogus "\volta" and fail the drift check against ADDED_TOKENS.
_BACKSLASH_TOKEN = re.compile(r"\\[A-Za-z0-9]+")


@dataclass
class Strip:
    """One training sample as listed in manifest.jsonl."""

    image_path: Path
    label: str
    mode: str  # "every" | "keysig"
    makam: str
    # Rung-2 manifest fields (defaulted so pre-Rung-2 manifests keep loading): `piece` is the
    # split-by-piece key — ALL of a piece's strips/transposes/variants stay in one split.
    piece: str = ""
    transpose: int = 0
    lyrics: bool = False


class StripDataset:
    """
    The (image, label) pairs from a strips directory.

    Reads `manifest.jsonl` (one JSON object per strip: image / label / mode / makam / piece /
    transpose / lyrics / from / to; the last five are Rung-2 additions with fallbacks).
    `__getitem__` opens the PNG lazily (RGB) so the dataset itself stays tiny — only paths and
    label strings live in memory.

    `pieces` filters to a piece set — how the train/val split is applied (see
    scripts/make_split.py): pass the split file's `train_pieces` or `val_pieces`.
    """

    def __init__(
        self,
        strips_dir: str | Path,
        mode: str | None = None,
        pieces: set[str] | None = None,
    ) -> None:
        self.dir = Path(strips_dir)
        manifest = self.dir / "manifest.jsonl"
        self.strips: list[Strip] = []
        for line in manifest.read_text().splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if mode is not None and row["mode"] != mode:
                continue
            # Fallback for old manifests: the filename prefix up to the first "_" is the piece.
            piece = row.get("piece") or row["image"].split("_")[0]
            if pieces is not None and piece not in pieces:
                continue
            self.strips.append(
                Strip(
                    image_path=self.dir / row["image"],
                    label=row["label"],
                    mode=row["mode"],
                    makam=row.get("makam", ""),
                    piece=piece,
                    transpose=int(row.get("transpose", 0)),
                    lyrics=bool(row.get("lyrics", False)),
                )
            )
        if not self.strips:
            raise FileNotFoundError(f"no strips found in {self.dir} (mode={mode!r}, pieces={'set' if pieces else None})")

    def __len__(self) -> int:
        return len(self.strips)

    def __getitem__(self, i: int):
        from PIL import Image

        s = self.strips[i]
        return Image.open(s.image_path).convert("RGB"), s.label


def check_token_drift(dataset: StripDataset) -> None:
    """
    Drift guard: every `\\token` appearing in a real label must be in ADDED_TOKENS.

    If the TS serializer (lilypond.ts) grows a new token and this list isn't updated, the
    tokenizer would shred it into characters and training would silently learn garbage —
    fail loudly here instead.
    """
    known = set(ADDED_TOKENS)
    seen: set[str] = set()
    for s in dataset.strips:
        seen.update(_BACKSLASH_TOKEN.findall(s.label))
    unknown = sorted(seen - known)
    if unknown:
        raise ValueError(
            f"labels contain tokens missing from ADDED_TOKENS (update src/vision/data.py "
            f"to match tools/render/lilypond.ts): {unknown}"
        )


def strip_special(ids, tokenizer) -> list[int]:
    """
    Reduce a token-id sequence to its content ids (drop BOS/EOS/PAD/decoder-start).

    WHY ids, not strings: this tokenizer's added-token matcher consumes the spaces around
    `\\`-tokens on encode and does not restore them on decode, so string round-trips are
    lossy (`\\sig \\komaFlat b` decodes as `\\sig\\komaFlatb`). The id sequence, however, is
    stable — re-encoding a decoded string yields the identical ids — so all exact-match
    comparisons happen in id space; decoded strings are for human display only.
    """
    # NOTE: <unk> is deliberately NOT dropped — a generated <unk> must count as a mismatch.
    drop = {tokenizer.bos_token_id, tokenizer.eos_token_id, tokenizer.pad_token_id}
    drop.discard(None)
    return [i for i in ids if i not in drop]


def collate(batch, processor, tokenizer, max_len: int = 100):
    """
    Batch of (PIL image, label string) → model inputs.

    - pixel_values: the processor resizes/normalizes each strip to the encoder's fixed input
      frame (583×409 for omr_transformer) and stacks them.
    - labels: tokenized, then **EOS appended manually** — this tokenizer adds NO special
      tokens even with add_special_tokens=True (verified), and without a trained EOS the
      model reproduces the sequence and then can't stop generating (observed in the first
      Rung-1 run: perfect prefix, then free-styled extra notes). Padded to the longest in
      the batch with -100 — the value cross-entropy ignores, so the model isn't trained to
      emit padding.
    """
    import torch

    images = [im for im, _ in batch]
    texts = [t for _, t in batch]
    pixel_values = processor(images=images, return_tensors="pt").pixel_values

    seqs = [
        tokenizer(t, truncation=True, max_length=max_len - 1).input_ids + [tokenizer.eos_token_id]
        for t in texts
    ]
    width = max(len(s) for s in seqs)
    labels = torch.full((len(seqs), width), -100, dtype=torch.long)
    for row, s in enumerate(seqs):
        labels[row, : len(s)] = torch.tensor(s, dtype=torch.long)
    return pixel_values, labels
