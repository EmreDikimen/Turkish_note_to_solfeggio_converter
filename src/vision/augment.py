"""
Input-realism augmentation for synthetic strips (Phase 2, Rung 2).

WHAT: turns a clean VexFlow-rendered strip (black ink on white, straight staff) into what the
app will actually receive. **Most real uploads are WEB SCREENSHOTS** (scores viewed in a
browser/PDF and screenshotted — clean geometry, flat white, only resampling/compression
damage); camera photos of printed pages are the minority. So this module has three profiles,
mixed at `photo_share` (default 0.35 — screenshot-dominant) and `scan_share` (default 0.0 — OFF,
because the scan profile is a pre-registered Round-3 arm rather than a general improvement):

  - "screenshot": rescale softness (down-up resize), JPEG artifacts, tiny brightness/contrast
    jitter, a little sensor-ish noise. No paper, no lighting — screenshots have none of that.
    Each op fires with p<1, so a slice comes through nearly clean (native screenshots often ARE
    clean PNGs). The one geometry it DOES get is the staff jitter below, which models the slicer
    rather than the camera and therefore applies whatever the capture was.
  - "photo": the full document pipeline — paper tint/texture, uneven lighting, shadows, slight
    rotation/perspective/staff curvature, ink bleed or faded print, camera blur/noise, JPEG.
  - "scan" (Round 3, Lever 7 — `scan_share`, **default 0.0 = off**): a flatbed or office scan of
    a printed page, which is NEITHER of the above. Flat lighting and no perspective, so the
    photo pipeline's most expensive ops model nothing that is there; what it does have is
    bleed-through from the reverse side, near-neutral paper, ink spread or fade, a small
    transport skew, dust speckle, thin lines breaking up, and threshold/halftone damage.
    ⚠ It exists because **93% of the exam is scans** and we had never simulated one — but the
    trade is real and pre-registered: `photo_share` was set from the *deployment* distribution
    (uploads are mostly screenshots), so aiming augmentation at scans optimises the exam and not
    necessarily the app's users. Hence a share that is chosen and written down in advance rather
    than tuned — docs/rung3/levers.md Lever 7.

WHY on-the-fly (not baked into strips_v2): every epoch sees a fresh corruption of each strip,
so 18k images act like far more — and the labels stay untouched because every transform here is
label-preserving (nothing adds/removes/reorders symbols; geometry is kept mild enough that
beams/flags stay legible — the Step-1 tests showed durations flip (8th↔16th) once that detail
blurs, so amplitudes below are deliberately conservative).

HOW it splits: geometric + camera-photometric ops come from albumentations (battle-tested);
paper texture, lighting gradient, ink bleed/fade, staff curvature and rescale softness are
custom OpenCV — they model the *document/screen*, which albumentations has no primitives for.
Photo-profile order mirrors how a real photo degrades: page geometry → ink-on-paper appearance
→ scene lighting → camera optics/sensor → compression. The scan profile has its OWN order, which
is not the same one: reverse-side show-through → paper → ink → transport skew → sensor speckle →
thin-line dropout → threshold → compression.

Preview (LOOK at this before spending GPU time — it is the human gate on augmentation strength,
and for the scan profile it is the only thing between a too-aggressive threshold and a wasted run):
    .venv-ml/bin/python src/vision/augment.py --n 6 --out data/synthetic/aug_preview.png
    .venv-ml/bin/python src/vision/augment.py --n 3 --profiles scan,scan,scan --stack \\
        --out data/synthetic/aug_preview_scan.png
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

# Share that gets the SCAN profile (Round 3, Lever 7). **Default 0.0 = OFF**, deliberately: the
# scan profile is a pre-registered training arm, not a general improvement, and a run that does not
# ask for it must draw exactly what it drew before — including the same number of RNG values, which
# is why the three-way choice below still costs a single `rng.random()`.
#
# ⚠ The share is a CHOSEN number, the same hazard as STACCATO_RATE. It is set from the corpus we
# intend to serve, not from what makes the arm win: the arm runs at
# **screenshot .55 / photo .20 / scan .25**, i.e. the scan share comes mostly out of PHOTO_SHARE,
# whose own 0.35 was a guess from "uploads are mostly screenshots". Pre-registration:
# docs/rung3/levers.md Lever 7.
#
# ⚠ MEASURED WHILE BUILDING THIS, and it applies to every run this project has made: with
# albumentations 2.0.8 the transforms seed themselves at construction from OS entropy, so
# `random.seed`/`np.random.seed` do NOT make an augmented image reproducible — the same module run
# twice produces different pixels. `--seed` therefore fixes the model init, the shuffling and this
# module's own generator, but not the augmentation. Two runs of one recipe are the same
# distribution, not the same data.
SCAN_SHARE = 0.0


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


def paper_texture(img: np.ndarray, rng: np.random.Generator,
                  depth_range: tuple[float, float] = (0.03, 0.12),
                  warmth_max: float = 1.0) -> np.ndarray:
    """Multiply by a warm paper tint + low-frequency grain, so white stops being RGB-255 flat.

    The two ranges are arguments only so the SCAN profile can ask for a flatter, cooler page than a
    camera photo of the same paper: a flatbed lights the sheet evenly and its sensor white-balances,
    so scan paper reads as near-neutral grey rather than beige. Defaults are the photo profile's
    original constants, so that profile is unchanged.
    """
    h, w = img.shape[:2]
    grain = rng.uniform(0, 1, (h // 24 + 2, w // 24 + 2)).astype(np.float32)
    grain = cv2.resize(grain, (w, h), interpolation=cv2.INTER_CUBIC)
    grain = cv2.GaussianBlur(grain, (0, 0), 3)
    depth = rng.uniform(*depth_range)
    tex = 1.0 - depth * grain                        # [1-depth, 1]
    warmth = rng.uniform(0.0, warmth_max)
    tint = np.array([1.0, 1.0 - 0.03 * warmth, 1.0 - 0.10 * warmth], np.float32)  # toward beige
    out = img.astype(np.float32) * tex[..., None] * tint[None, None, :]
    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------------------------
# the SCAN profile's own transforms (Round 3, Lever 7)
#
# A flatbed or office scan of a TRT-era print is neither of the two profiles above: it has FLAT
# LIGHTING and NO PERSPECTIVE — so the photo pipeline's most expensive ops model nothing that is
# there — while it does have speckle and dust, broken or half-missing thin lines, ink spread on
# thick strokes, bleed-through from the reverse side and threshold/halftone damage, none of which
# either profile draws. 93% of the exam is scans (docs/METRICS-CORPUS.md).
#
# ⚠ EVERY AMPLITUDE HERE IS BOUNDED BY ONE RULE: the transform must stay LABEL-PRESERVING. The
# Step-1 tests showed durations flip (8th<->16th) once beam detail blurs, and `line_dropout` and
# `threshold_damage` are the two ops in this file most able to erase a beam outright. That is why
# dropout is applied to a mask of THIN ink only (a beam is thick and cannot enter it) and why the
# threshold is a soft sigmoid rather than a hard binarisation.
# ---------------------------------------------------------------------------------------------

def bleed_through(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """The reverse side of the sheet, ghosting through thin paper under a bright scanner lamp.

    Modelled as a mirrored, blurred, heavily-faded copy of the page's own ink: the reverse side of
    a music sheet is more music, and mirroring is what the show-through of a real page looks like.
    """
    ghost = cv2.GaussianBlur(cv2.flip(img, 1), (0, 0), rng.uniform(1.5, 3.5)).astype(np.float32)
    alpha = rng.uniform(0.04, 0.15)
    out = img.astype(np.float32) - alpha * (255.0 - ghost)
    return np.clip(out, 0, 255).astype(np.uint8)


def speckle_dust(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Dust on the platen and sensor dropout: isolated dark specks and light pinholes."""
    h, w = img.shape[:2]
    out = img.copy()
    dark = rng.random((h, w)) < rng.uniform(0.0004, 0.0035)
    light = rng.random((h, w)) < rng.uniform(0.0004, 0.0035)
    out[dark] = rng.integers(0, 90)
    out[light] = rng.integers(200, 256)
    # a few larger dust motes — single pixels alone read as sensor noise, not as a dirty scanner
    for _ in range(int(rng.integers(0, 7))):
        y, x = int(rng.integers(0, h)), int(rng.integers(0, w))
        cv2.circle(out, (x, y), int(rng.integers(1, 3)), int(rng.integers(0, 110)), -1)
    return out


def line_dropout(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Thin lines breaking up — the failure a photocopier/scanner threshold makes first.

    ⚠ The mask is THIN INK ONLY: `dark - open(dark)` keeps what a 3x3 opening removes, i.e. strokes
    thinner than about three pixels — staff lines, stems, the edges of flags. Noteheads and beams
    are thicker than the structuring element and cannot enter the mask at all, which is what keeps
    this label-preserving. Erasing a random share of that mask breaks the lines into dashes.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    dark = 255 - gray
    thin = cv2.subtract(dark, cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)))
    # ⚠ Erase in RUNS, not in single pixels. A per-pixel mask reads as noise on top of an intact
    # line; what a failing scan actually does is drop a few millimetres of it at a time. The seeds
    # are sparse and each is widened horizontally, which is also why the run length is capped: long
    # enough to break a staff line, short enough that a stem cannot vanish entirely.
    seeds = (rng.random(gray.shape) < rng.uniform(0.008, 0.05)).astype(np.uint8)
    run = int(rng.integers(3, 10))
    hit = (cv2.dilate(seeds, np.ones((1, run), np.uint8)) > 0) & (thin > 40)
    if not hit.any():
        return img
    # Fill with the LOCAL PAPER, estimated by dilating the image (bright paper grows into dark ink),
    # not with white and not with a blur of the neighbourhood — a blur centred on a line is still
    # line-coloured, and a white slit through grey paper is a cue nothing real produces.
    paper = cv2.dilate(img, np.ones((7, 7), np.uint8))
    out = img.copy()
    out[hit] = paper[hit]
    return out


def threshold_damage(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """A scanner's own binarisation, with the level drifting slowly across the page.

    Soft on purpose: a real 1-bit threshold destroys beam detail (and with it the durations), so
    this is a sigmoid whose midpoint wanders — regions on the dark side gain ink, regions on the
    light side lose it, which is the halftone/threshold damage a photocopied print carries.
    """
    h, w = img.shape[:2]
    drift = rng.uniform(0, 1, (h // 32 + 2, w // 32 + 2)).astype(np.float32)
    drift = cv2.GaussianBlur(cv2.resize(drift, (w, h), interpolation=cv2.INTER_CUBIC), (0, 0), 12)
    drift = (drift - drift.min()) / max(np.ptp(drift), 1e-6)
    level = rng.uniform(120, 175) + rng.uniform(10, 45) * (drift - 0.5)
    soft = rng.uniform(14.0, 34.0)                   # >0; smaller = harder threshold
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    hard = 255.0 / (1.0 + np.exp(-(gray - level) / soft))
    mix = rng.uniform(0.45, 0.9)                     # never fully replace the greyscale
    out = gray * (1 - mix) + hard * mix
    return np.clip(out, 0, 255).astype(np.uint8)[..., None].repeat(3, axis=2)


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
    # BOTH profiles: the staff-placement jitter (see self.staff_jitter). Not a camera effect —
    # it models the SLICER, which normalises every strip to a nominal staff size and misses by a
    # few percent whatever the capture method was. Applied to screenshots too, and that is the
    # point: before Round 3 geometry only ran inside the photo profile (0.35 * 0.85 = 30% of
    # samples), so the corpus the model saw had a staff-spacing SD of 0.48 px against 0.65-1.12 px
    # in the real pools, and a p5-p95 vertical-placement spread of 2.3 px against 2.5-20.9 px.
    P_STAFF_JITTER = 0.8
    # scan-profile op probabilities (Lever 7)
    P_SCAN_BLEED = 0.35
    P_SCAN_PAPER = 0.8
    P_SCAN_INK = 0.55
    P_SCAN_SKEW = 0.4
    P_SCAN_SPECKLE = 0.7
    P_SCAN_DROPOUT = 0.45
    P_SCAN_THRESH = 0.5

    def __init__(self, seed: int | None = None, photo_share: float = PHOTO_SHARE,
                 scan_share: float = SCAN_SHARE):
        import albumentations as A

        self.rng = np.random.default_rng(seed)
        self.photo_share = photo_share
        self.scan_share = scan_share
        if photo_share + scan_share > 1.0:
            raise ValueError(f"photo_share + scan_share = {photo_share + scan_share} > 1")
        # fill=255: geometry runs FIRST, so uncovered borders are clean white — paper texture
        # then colors them like the rest of the page (no fake black frame for the model to key on)
        self.geometry = A.Compose([
            A.Affine(rotate=(-2, 2), shear=(-2, 2), scale=(0.97, 1.03),
                     translate_percent=(0, 0.01), fill=255, p=1.0),
            A.Perspective(scale=(0.01, 0.04), fill=255, p=0.7),
        ])
        # Staff-placement jitter, sized from the real pools (scripts/rung3/domain_gap.py):
        # scale +-4% reproduces their staff-spacing SD of ~0.7 px on a 30 px space, and a +-2%
        # vertical shift reproduces the p5-p95 placement spread of ~10 px on a 336 px strip.
        # Kept mild on purpose — the Step-1 tests showed 8th<->16th flips once beams blur, and
        # shrinking the image is one more way to blur them. Deliberately NOT matched to the exam
        # pool's outlier spread (20.9 px): that pool is the hardest scans we own, and training on
        # its tail would cost accuracy on the common clean case.
        #
        # NO rotation here. The slicer deskews before it cuts, so real strips arrive near
        # horizontal — measured, the share of strips too skewed for a staff-line detector to find
        # five lines is 14-19% across the real pools. An earlier version of this op rotated by
        # +-1 deg and pushed the synthetic figure to 68%: over a 1100 px strip one degree walks a
        # staff line 19 px, which is more skew than reality has. The photo profile keeps its own
        # rotate(-2, 2) — that one is about the camera, and only 35% of samples see it.
        self.staff_jitter = A.Affine(scale=(0.96, 1.04),
                                     translate_percent={"x": (-0.005, 0.005), "y": (-0.02, 0.02)},
                                     fill=255, p=1.0)
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
        # The scan profile's albumentations transforms are built LAZILY, in `_scan_ops()` below, so
        # a run that does not ask for scans constructs exactly what it constructed before.
        self._scan = None

    def _scan_ops(self):
        """The scan profile's albumentations transforms, built on first use (see `self._scan`).

        `scanner` is deliberately milder than `self.camera`: a flatbed holds the page against the
        glass at a fixed focus, so its blur is small and constant rather than a hand-held camera's.
        JPEG is in it because a scanned PDF page almost always IS a JPEG, often a hard one.

        ⚠ `scan_skew` is ±0.3°, NOT the photo profile's ±2°, and the reason is measured: over an
        1,100 px strip one degree walks a staff line 19 px, and an earlier ±1° rotation in this file
        pushed the share of synthetic strips too skewed for a staff-line detector from ~15% to 68%.
        The slicer also deskews a page before it cuts, so what reaches strip level is a small
        residual — which is what this models, and no more.
        """
        if self._scan is None:
            import albumentations as A
            self._scan = {
                "scanner": A.Compose([
                    A.RandomBrightnessContrast(brightness_limit=0.10, contrast_limit=0.18, p=0.7),
                    A.GaussianBlur(blur_limit=(3, 3), p=0.35),
                    A.GaussNoise(std_range=(0.005, 0.03), p=0.5),
                    A.ImageCompression(quality_range=(40, 90), p=0.8),
                ]),
                "skew": A.Affine(rotate=(-0.3, 0.3), fill=255, p=1.0),
            }
        return self._scan

    def __call__(self, img: np.ndarray, profile: str | None = None) -> np.ndarray:
        rng = self.rng
        if profile is None:
            # ONE draw, three outcomes. Written this way rather than as two comparisons so that at
            # the default scan_share=0.0 this consumes exactly the draws the two-profile Augmenter
            # consumed, and chooses the same profile from them — which is what lets an
            # already-trained checkpoint stand as the control for the Lever-7 arm.
            # ⚠ That is a claim about the DISTRIBUTION, not about bytes: albumentations 2.x seeds
            # its transforms at construction from OS entropy, so no augmented image in this project
            # is reproducible from `random.seed`/`np.random.seed` at all (measured — the same module
            # run twice gives different pixels). Verified instead by replaying 400 draws against the
            # previous revision of this file: ink coverage and mean brightness agree, KS p = 0.94.
            r = rng.random()
            profile = ("photo" if r < self.photo_share
                       else "scan" if r < self.photo_share + self.scan_share
                       else "screenshot")

        # Slicer-residual staff jitter, both profiles, before anything else: it stands in for the
        # crop the strip was cut with, so every later effect sees the staff where it really landed.
        if rng.random() < self.P_STAFF_JITTER:
            img = self.staff_jitter(image=img)["image"]

        if profile == "screenshot":
            if rng.random() < self.P_RESCALE:
                img = rescale_softness(img, rng)
            return self.screen(image=img)["image"]

        if profile == "scan":
            # Order mirrors how a scan degrades, and it is NOT the photo order: the reverse side is
            # already in the paper before anything is scanned, ink sits on that paper, the transport
            # adds a small skew, and only then does the sensor speckle, drop thin lines and
            # threshold. No perspective, no shadow, no lighting gradient — a flatbed has none.
            ops = self._scan_ops()
            if rng.random() < self.P_SCAN_BLEED:
                img = bleed_through(img, rng)
            if rng.random() < self.P_SCAN_PAPER:
                img = paper_texture(img, rng, depth_range=(0.02, 0.07), warmth_max=0.35)
            if rng.random() < self.P_SCAN_INK:
                img = ink_variation(img, rng)
            if rng.random() < self.P_SCAN_SKEW:
                img = ops["skew"](image=img)["image"]
            if rng.random() < self.P_SCAN_SPECKLE:
                img = speckle_dust(img, rng)
            if rng.random() < self.P_SCAN_DROPOUT:
                img = line_dropout(img, rng)
            if rng.random() < self.P_SCAN_THRESH:
                img = threshold_damage(img, rng)
            return ops["scanner"](image=img)["image"]

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
    ap.add_argument("--strips-dir", default="data/synthetic/strips_v2_2")
    ap.add_argument("--n", type=int, default=6, help="strips (rows)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default="data/synthetic/aug_preview.png")
    ap.add_argument("--profiles", default="screenshot,photo,scan,scan",
                    help="comma-separated profile per column, after the original")
    ap.add_argument("--stack", action="store_true",
                    help="one strip per row instead of a grid — a 4-column grid of 1,200 px strips "
                         "is ~7,500 px wide, which is not a thing a person can actually look at, "
                         "and looking at it is the whole point of this preview")
    args = ap.parse_args()

    from data import StripDataset

    random.seed(args.seed)          # albumentations draws from python's random
    np.random.seed(args.seed)
    ds = StripDataset(args.strips_dir)
    aug = Augmenter(seed=args.seed)

    # columns: original | screenshot | photo | scan x2 (the scan profile varies most per draw, and
    # it is the one whose amplitude a human has to sign off on — see the module docstring)
    picks = random.Random(args.seed).sample(range(len(ds)), args.n)
    cols = [c.strip() for c in args.profiles.split(",")]
    rows = []
    for i in picks:
        image, _ = ds[i]
        img = np.asarray(image)
        rows.append([img] + [aug(img.copy(), profile=p) for p in cols])

    # grid on dark gray so the paper edges of each cell are visible
    if args.stack:
        rows = [[im] for row in rows for im in row]     # every cell becomes its own row
    ncol = max(len(r) for r in rows)
    cell_w = max(im.shape[1] for r in rows for im in r) + 8
    cell_h = max(im.shape[0] for r in rows for im in r) + 8
    grid = np.full((cell_h * len(rows), cell_w * ncol, 3), 40, np.uint8)
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            y, x = r * cell_h + 4, c * cell_w + 4
            grid[y:y + im.shape[0], x:x + im.shape[1]] = im
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), cv2.cvtColor(grid, cv2.COLOR_RGB2BGR))
    print(f"[saved] {out}  ({len(rows)} strips x [original | " + " | ".join(cols) + "])")
    return 0


if __name__ == "__main__":
    sys.exit(main())
