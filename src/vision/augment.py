"""
Input-realism augmentation for synthetic strips (Phase 2, Rung 2).

WHAT: turns a clean VexFlow-rendered strip (black ink on white, straight staff) into what the
app will actually receive. **Most real uploads are WEB SCREENSHOTS** (scores viewed in a
browser/PDF and screenshotted — clean geometry, flat white, only resampling/compression
damage); camera photos of printed pages are the minority. So this module has two profiles,
mixed at `photo_share` (default 0.35 — screenshot-dominant):

  - "screenshot": rescale softness (down-up resize), JPEG artifacts, tiny brightness/contrast
    jitter, a little sensor-ish noise. No geometry, no paper, no lighting — screenshots have
    none of that. Each op fires with p<1, so a slice comes through nearly clean (native
    screenshots often ARE clean PNGs).
  - "photo": the full document pipeline — paper tint/texture, uneven lighting, shadows, slight
    rotation/perspective/staff curvature, ink bleed or faded print, camera blur/noise, JPEG.

WHY on-the-fly (not baked into strips_v2): every epoch sees a fresh corruption of each strip,
so 18k images act like far more — and the labels stay untouched because every transform here is
label-preserving (nothing adds/removes/reorders symbols; geometry is kept mild enough that
beams/flags stay legible — the Step-1 tests showed durations flip (8th↔16th) once that detail
blurs, so amplitudes below are deliberately conservative).

HOW it splits: geometric + camera-photometric ops come from albumentations (battle-tested);
paper texture, lighting gradient, ink bleed/fade, staff curvature and rescale softness are
custom OpenCV — they model the *document/screen*, which albumentations has no primitives for.
Photo-profile order mirrors how a real photo degrades: page geometry → ink-on-paper appearance
→ scene lighting → camera optics/sensor → compression.

Preview (LOOK at this before spending GPU time):
    .venv-ml/bin/python src/vision/augment.py --n 6 --out data/synthetic/aug_preview.png
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

# Share of samples that get the full camera-photo pipeline; the rest get the screenshot
# profile. Real uploads are mostly screenshots (user, 2026-07-06) — do NOT push this toward
# 1.0 for "harder training": over-warped data would trade accuracy on the common case for
# the rare one. Revisit against real usage at Rung 3.
PHOTO_SHARE = 0.35


# ---------------------------------------------------------------------------------------------
# custom document/screen-level transforms (RGB uint8 in, RGB uint8 out)
# ---------------------------------------------------------------------------------------------

def rescale_softness(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Down-up resize: the softness of a screenshot taken at non-native zoom / a resaved image."""
    h, w = img.shape[:2]
    s = rng.uniform(0.55, 0.95)
    interp_down = cv2.INTER_AREA
    interp_up = rng.choice([cv2.INTER_LINEAR, cv2.INTER_CUBIC])
    small = cv2.resize(img, (max(1, int(w * s)), max(1, int(h * s))), interpolation=interp_down)
    return cv2.resize(small, (w, h), interpolation=int(interp_up))


def staff_curvature(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Gentle sinusoidal vertical warp — pages bow, books don't lie flat."""
    h, w = img.shape[:2]
    amp = rng.uniform(1.0, 4.0)                      # px; staff lines are ~10 px apart
    cycles = rng.uniform(0.4, 1.2)                   # under ~1 wave across the strip
    phase = rng.uniform(0, 2 * np.pi)
    xs = np.arange(w, dtype=np.float32)
    shift = amp * np.sin(2 * np.pi * cycles * xs / w + phase)
    map_x = np.tile(xs, (h, 1))
    map_y = np.arange(h, dtype=np.float32)[:, None] + shift[None, :]
    return cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def ink_variation(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Print-quality jitter: ink bleed (strokes thicken) or faded print (ink lightens)."""
    if rng.random() < 0.5:
        # bleed: min-filter thickens dark strokes; blend keeps it subtle
        bled = cv2.erode(img, np.ones((2, 2), np.uint8))
        a = rng.uniform(0.4, 1.0)
        return cv2.addWeighted(bled, a, img, 1 - a, 0)
    # fade: scale ink depth toward the paper
    depth = rng.uniform(0.55, 0.85)
    return (255 - (255 - img.astype(np.float32)) * depth).astype(np.uint8)


def paper_texture(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Multiply by a warm paper tint + low-frequency grain, so white stops being RGB-255 flat."""
    h, w = img.shape[:2]
    grain = rng.uniform(0, 1, (h // 24 + 2, w // 24 + 2)).astype(np.float32)
    grain = cv2.resize(grain, (w, h), interpolation=cv2.INTER_CUBIC)
    grain = cv2.GaussianBlur(grain, (0, 0), 3)
    depth = rng.uniform(0.03, 0.12)
    tex = 1.0 - depth * grain                        # [1-depth, 1]
    warmth = rng.uniform(0.0, 1.0)
    tint = np.array([1.0, 1.0 - 0.03 * warmth, 1.0 - 0.10 * warmth], np.float32)  # toward beige
    out = img.astype(np.float32) * tex[..., None] * tint[None, None, :]
    return np.clip(out, 0, 255).astype(np.uint8)


def soft_shadow(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """
    A soft-edged shadow band falling across the page. Custom because albumentations'
    RandomShadow draws hard-edged polygons — unrealistic, and harsh enough to swallow symbols
    (seen in the first preview grid).
    """
    h, w = img.shape[:2]
    pts = rng.uniform([-0.3, -0.3], [1.3, 1.3], (int(rng.integers(3, 6)), 2))
    pts = (pts * [w, h]).astype(np.int32)
    mask = np.zeros((h, w), np.float32)
    cv2.fillConvexPoly(mask, cv2.convexHull(pts), 1.0)
    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=max(h, w) / 8)
    intensity = rng.uniform(0.12, 0.32)
    out = img.astype(np.float32) * (1.0 - intensity * mask)[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


def lighting_gradient(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Linear brightness falloff across a random direction — one side of the photo is darker."""
    h, w = img.shape[:2]
    theta = rng.uniform(0, 2 * np.pi)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    proj = xs * np.cos(theta) + ys * np.sin(theta)
    proj = (proj - proj.min()) / max(np.ptp(proj), 1e-6)
    lo = rng.uniform(0.72, 0.95)
    hi = rng.uniform(0.98, 1.05)
    factor = lo + (hi - lo) * proj
    out = img.astype(np.float32) * factor[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------------------------
# the composed pipeline
# ---------------------------------------------------------------------------------------------

class Augmenter:
    """
    Callable: RGB uint8 array -> RGB uint8 array. Picks a profile per call ("screenshot" with
    probability 1-photo_share, else "photo"); pass `profile=` to force one. Build ONE per
    process (the albumentations pipelines are constructed in __init__); in a DataLoader, seed
    each worker via `random.seed` / `np.random.seed` in worker_init_fn (see train.py) so
    workers don't produce identical streams.
    """

    # photo-profile op probabilities
    P_GEOMETRY = 0.85
    P_CURVATURE = 0.35
    P_INK = 0.5
    P_PAPER = 0.85
    P_SHADOW = 0.3
    P_LIGHTING = 0.7
    # screenshot-profile op probabilities
    P_RESCALE = 0.7

    def __init__(self, seed: int | None = None, photo_share: float = PHOTO_SHARE):
        import albumentations as A

        self.rng = np.random.default_rng(seed)
        self.photo_share = photo_share
        # fill=255: geometry runs FIRST, so uncovered borders are clean white — paper texture
        # then colors them like the rest of the page (no fake black frame for the model to key on)
        self.geometry = A.Compose([
            A.Affine(rotate=(-2, 2), shear=(-2, 2), scale=(0.97, 1.03),
                     translate_percent=(0, 0.01), fill=255, p=1.0),
            A.Perspective(scale=(0.01, 0.04), fill=255, p=0.7),
        ])
        self.camera = A.Compose([
            A.RandomBrightnessContrast(brightness_limit=0.12, contrast_limit=0.15, p=0.7),
            A.OneOf([
                A.GaussianBlur(blur_limit=(3, 5)),
                A.MotionBlur(blur_limit=5),
            ], p=0.5),
            A.GaussNoise(std_range=(0.01, 0.05), p=0.5),
            A.ImageCompression(quality_range=(35, 85), p=0.7),
        ])
        self.screen = A.Compose([
            A.RandomBrightnessContrast(brightness_limit=0.06, contrast_limit=0.08, p=0.4),
            A.GaussNoise(std_range=(0.005, 0.02), p=0.2),
            A.ImageCompression(quality_range=(55, 92), p=0.7),
        ])

    def __call__(self, img: np.ndarray, profile: str | None = None) -> np.ndarray:
        rng = self.rng
        if profile is None:
            profile = "photo" if rng.random() < self.photo_share else "screenshot"

        if profile == "screenshot":
            if rng.random() < self.P_RESCALE:
                img = rescale_softness(img, rng)
            return self.screen(image=img)["image"]

        if rng.random() < self.P_GEOMETRY:
            img = self.geometry(image=img)["image"]
        if rng.random() < self.P_CURVATURE:
            img = staff_curvature(img, rng)
        if rng.random() < self.P_INK:
            img = ink_variation(img, rng)
        if rng.random() < self.P_PAPER:
            img = paper_texture(img, rng)
        if rng.random() < self.P_SHADOW:
            img = soft_shadow(img, rng)
        if rng.random() < self.P_LIGHTING:
            img = lighting_gradient(img, rng)
        return self.camera(image=img)["image"]


# ---------------------------------------------------------------------------------------------
# preview grid — the human gate on augmentation strength
# ---------------------------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strips-dir", default="data/synthetic/strips_v2")
    ap.add_argument("--n", type=int, default=6, help="strips (rows)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default="data/synthetic/aug_preview.png")
    args = ap.parse_args()

    from data import StripDataset

    random.seed(args.seed)          # albumentations draws from python's random
    np.random.seed(args.seed)
    ds = StripDataset(args.strips_dir)
    aug = Augmenter(seed=args.seed)

    # columns: original | screenshot profile | photo profile x2 (photo varies more per draw)
    picks = random.Random(args.seed).sample(range(len(ds)), args.n)
    rows = []
    for i in picks:
        image, _ = ds[i]
        img = np.asarray(image)
        rows.append([
            img,
            aug(img.copy(), profile="screenshot"),
            aug(img.copy(), profile="photo"),
            aug(img.copy(), profile="photo"),
        ])

    # grid on dark gray so the paper edges of each cell are visible
    cell_w = max(im.shape[1] for r in rows for im in r) + 8
    cell_h = max(im.shape[0] for r in rows for im in r) + 8
    grid = np.full((cell_h * len(rows), cell_w * 4, 3), 40, np.uint8)
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            y, x = r * cell_h + 4, c * cell_w + 4
            grid[y:y + im.shape[0], x:x + im.shape[1]] = im
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), cv2.cvtColor(grid, cv2.COLOR_RGB2BGR))
    print(f"[saved] {out}  ({len(rows)} strips x [original | screenshot | photo | photo])")
    return 0


if __name__ == "__main__":
    sys.exit(main())
