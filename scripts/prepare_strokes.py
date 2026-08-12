#!/usr/bin/env python3
"""
Fetch the CC0 percussion recordings F2 plays, and prepare them for the web app.

Why this exists: `webAudioBackend.scheduleStroke` used to SYNTHESISE the usul's düm/tek/ke, and the
owner rejected that sound by ear on 2026-08-11 ("we need to use real sounds"). The licences were
already cleared — docs/features/audio-sources.md — so this is a download-and-prepare job.

Python is correct here for the same reason as everything else under `scripts/`: it is data
preparation, run once, and **nothing it touches ships as code**. Its OUTPUT ships (six small wavs per
kit under `apps/web/public/audio/`), which is why the trimming and the level decisions below are
written down rather than done by hand in an editor.

⚠ The naming problem this solves. VCSL's darbuka files are `Darbuka_<1..5>_hit_vl<1,2>_rr<1,2>.wav`
and nothing anywhere says which of the five hit types is the open centre stroke (düm) and which are
the rim (tek/ke). Rather than guess, `--analyse` MEASURES each one — how much of its energy is below
200 Hz, where its spectral centre of mass sits, how long it takes to decay — and proposes the
mapping from that. The frame drum is the control: its files ARE self-describing (`Hit`, `Hand`,
`HitMuted`), so if the measurements disagree with those names, the measurements are what is wrong.
The proposal is still confirmed by ear in the app (docs/MANUAL_CHECKS.md check 23).

Usage:
    .venv-ml/bin/python scripts/prepare_strokes.py --analyse   # measure, propose, write nothing
    .venv-ml/bin/python scripts/prepare_strokes.py             # write apps/web/public/audio/

Downloads are cached in a scratch dir, so re-running is cheap and Ctrl-C is safe.
"""

from __future__ import annotations

import argparse
import shutil
import ssl
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import certifi
import numpy as np
from scipy.io import wavfile

REPO = Path(__file__).resolve().parents[1]
OUT_ROOT = REPO / "apps" / "web" / "public" / "audio"
CACHE = REPO / "data" / "audio_src"

VCSL_RAW = "https://raw.githubusercontent.com/sgossner/VCSL/master"
VCSL_DIR = "Membranophones/Struck%20Membranophones"

# The three strokes `packages/core/src/usul.ts` defines. There is no fourth, so a kit is six files
# (three strokes x two round-robins) and no more.
STROKES = ("dum", "tek", "ka")

# Two round-robins per stroke: a usul repeats the same stroke every cycle, and one buffer played
# forty times in a row reads as a drum machine rather than a hand. `scheduleStroke` alternates them.
ROUND_ROBINS = 2


@dataclass(frozen=True)
class Kit:
    """One playable drum: where its files come from, and which candidates to measure."""

    kit_id: str
    folder: str
    # Candidate source files. For the darbuka these are the five unnamed hit types; for the frame
    # drum they are already named, and serve as the control on the measurements.
    candidates: dict[str, list[str]]
    # Set when the source names already say what the stroke is, so no guessing is needed.
    known: dict[str, str] | None = None


KITS = (
    Kit(
        kit_id="darbuka",
        folder="Darbuka",
        # vl2 is the harder velocity: a usul stroke is a deliberate hit, not a ghost note, and the
        # harder take has the attack that survives a laptop speaker (the 2026-08-11 lesson).
        candidates={
            f"hit{n}": [f"Darbuka_{n}_hit_vl2_rr{rr}.wav" for rr in (1, 2)] for n in range(1, 6)
        },
    ),
    Kit(
        kit_id="bendir",
        folder="Frame%20Drum",
        # HDrumL is the large frame drum (the bendir-like one), HDrumS the small one. v3 is the
        # harder of the two velocities. The bright stroke comes from the SMALL drum because a frame
        # drum's tek is an edge hit, and the small drum's muted hit is the nearest thing VCSL has.
        #
        # ⚠ Both `Hand` articulations are excluded on measurement, not on taste: they peak at -57 dB
        # (large) and -62 dB (small), i.e. 40+ dB below the struck takes. That is a property of
        # VCSL's recording session rather than a musical dynamic, and lifting one to a usable level
        # would lift its noise floor with it.
        candidates={
            "hit": [f"HDrumL_Hit_v3_rr{rr}_Sum.wav" for rr in (1, 2)],
            "smallmuted": [f"HDrumS_HitMuted_v3_rr{rr}_Sum.wav" for rr in (1, 2)],
            "largemuted": [f"HDrumL_HitMuted_v3_rr{rr}_Sum.wav" for rr in (1, 2)],
        },
        known={"dum": "hit", "tek": "smallmuted", "ka": "largemuted"},
    ),
)

# Peak level each stroke is normalised to. The RATIOS mirror what the synthesised strokes used
# (dum 0.95 / tek 0.7 / ka 0.36), which the owner tuned by ear on 2026-08-11; the absolute level is
# set by what the mix can take.
#
# ⚠ Why the source levels are overridden rather than preserved. Inheriting VCSL's relative levels
# looks like the respectful choice and is not: they vary by 40+ dB between articulations recorded in
# different passes, so "natural dynamics" here means "whatever the session did". Imposing the ratios
# instead is what stops the ka disappearing — the same failure the düm's missing attack caused, from
# a different cause. `ka` staying clearly under `tek` is what makes düyek's "te-ke" one gesture.
#
# ⚠ **These were 0.89 / 0.62 / 0.34 for a few hours and the drum audibly CLIPPED** (owner:
# *"darbukanın sesi biraz patlamış"*, 2026-08-11). The files were never clipped — the SUM was. A note
# is a normalised `PeriodicWave` at gain 1.0 into the same master gain, so a note plus a 0.89 düm is
# 1.89 before master's 0.85, i.e. 1.61 at a destination that hard-clips at 1.0. Lowering these is
# half the fix; the limiter in `webAudioBackend.ts` is the other half. **Do not raise them to make
# the drum louder** — that is what `Vuruş sesi` is for, and it now has room to work.
#
# Percussion has a 15–24 dB crest factor, so dropping the PEAK 5 dB costs far less loudness than it
# looks like: what a listener hears is much closer to the RMS, which barely moves.
STROKE_PEAK = {"dum": 0.50, "tek": 0.35, "ka": 0.19}


# ---------------------------------------------------------------------------- fetching


def fetch(kit: Kit, name: str) -> Path:
    """Download one source wav into the scratch cache, or reuse it if it is already there."""
    dest = CACHE / kit.kit_id / name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{VCSL_RAW}/{VCSL_DIR}/{kit.folder}/{urllib.parse.quote(name)}"
    print(f"  fetching {name}")
    # This venv's Python has no CA bundle wired to the system keychain, so point it at certifi's
    # explicitly rather than at the unverified context the error message tempts you towards.
    ctx = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(url, timeout=60, context=ctx) as res, dest.open("wb") as fh:
        shutil.copyfileobj(res, fh)
    return dest


# ---------------------------------------------------------------------------- reading + measuring


def read_mono(path: Path) -> tuple[np.ndarray, int]:
    """Read a wav as float32 mono in [-1, 1], whatever integer format it is stored in."""
    rate, data = wavfile.read(path)
    x = data.astype(np.float32)
    if x.ndim > 1:
        x = x.mean(axis=1)
    # scipy hands back the raw integer range, which differs per bit depth.
    if np.issubdtype(data.dtype, np.integer):
        x /= float(np.iinfo(data.dtype).max)
    return x, rate


@dataclass
class Measured:
    name: str
    low_frac: float  # energy below 200 Hz, as a fraction of the total
    centroid: float  # spectral centre of mass, Hz
    decay_ms: float  # time from the peak down to -40 dB
    peak: float


def measure(x: np.ndarray, rate: int, name: str) -> Measured:
    """
    Three numbers that separate a drum's open centre hit from its rim.

    A düm is the drumhead's whole area moving: most of its energy is low, and it rings. A tek is the
    rim under a fingertip: little low energy, a high centre of mass, and over almost immediately.
    """
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    freqs = np.fft.rfftfreq(len(x), 1 / rate)
    power = spec**2
    total = power.sum() or 1.0
    low_frac = float(power[freqs < 200].sum() / total)
    centroid = float((freqs * power).sum() / total)

    # Decay measured on the amplitude envelope, from its peak down to -40 dB of it.
    env = np.abs(x)
    win = max(1, int(rate * 0.005))
    env = np.convolve(env, np.ones(win) / win, mode="same")
    peak_i = int(np.argmax(env))
    peak = float(env[peak_i]) or 1e-9
    below = np.nonzero(env[peak_i:] < peak * 0.01)[0]
    decay_ms = float(below[0] / rate * 1000) if len(below) else len(x) / rate * 1000
    return Measured(name, low_frac, centroid, decay_ms, float(np.abs(x).max()))


def propose(rows: list[Measured]) -> dict[str, str]:
    """
    Turn the measurements into a düm/tek/ka mapping.

    ⚠ This is a proposal, not a verdict — the ear decides (MANUAL_CHECKS check 23). The ordering
    rules are the ones the physics gives:
      düm — the most low-frequency energy of the set, breaking ties by the longest ring.
      tek — of what is left, the brightest: the sharp rim hit.
      ka  — the weak hand playing the same rim, so it is the remaining one, quieter or damped.
    """
    pool = list(rows)
    dum = max(pool, key=lambda m: (m.low_frac, m.decay_ms))
    pool.remove(dum)
    tek = max(pool, key=lambda m: m.centroid)
    pool.remove(tek)
    # Prefer a `ka` that is genuinely weaker than the tek; otherwise take the next brightest so the
    # two rim strokes at least belong to the same family.
    quieter = [m for m in pool if m.peak < tek.peak]
    ka = max(quieter or pool, key=lambda m: m.centroid)
    return {"dum": dum.name, "tek": tek.name, "ka": ka.name}


# ---------------------------------------------------------------------------- preparing


MAX_MS = 700
FADE_MS = 25


def trim(x: np.ndarray, rate: int) -> np.ndarray:
    """
    Cut the silence before the hit and the surplus ring after it.

    The leading trim is what keeps the strokes IN TIME: `scheduleStroke` starts a buffer at an exact
    AudioContext time, so any silence baked into the front of the file is latency added to that
    stroke, and the usul would drag by however long it is.

    The tail is capped at `MAX_MS` with a short fade rather than being let run to -60 dB. A darbuka
    düm rings for 1.25 s and the bendir's for 2 s, nearly all of it under the notes it accompanies —
    inaudible in context, and it would put two kits over the 1 MB the build guard allows. The fade
    matters: cutting a ringing drum at a non-zero sample is a click, which is exactly the kind of
    artefact that reads as "the drum sounds wrong".
    """
    env = np.abs(x)
    thresh = env.max() * 0.02
    loud = np.nonzero(env > thresh)[0]
    if not len(loud):
        return x
    # A couple of ms of run-up, so the attack transient is not clipped into a click.
    start = max(0, int(loud[0]) - int(rate * 0.002))
    # -60 dB of the peak is below audibility once a note is playing over it.
    tail = np.nonzero(env > env.max() * 0.001)[0]
    end = min(len(x), int(tail[-1]) + int(rate * 0.01), start + int(rate * MAX_MS / 1000))
    out = x[start:end].copy()

    fade = min(int(rate * FADE_MS / 1000), len(out))
    if fade:
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return out


def write_kit(kit: Kit, mapping: dict[str, str], prepared: dict[str, list[np.ndarray]], rate: int) -> int:
    """Write the six files, normalised together, and return the bytes written."""
    out_dir = OUT_ROOT / kit.kit_id
    out_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    for stroke in STROKES:
        takes = prepared[mapping[stroke]]
        # ONE factor per stroke, shared by its round-robins — scaling each take to its own peak
        # would turn the alternation into an audible volume wobble, which is the opposite of what
        # round-robins are for.
        loudest = max(float(np.abs(a).max()) for a in takes) or 1.0
        scale = STROKE_PEAK[stroke] / loudest
        for rr in range(ROUND_ROBINS):
            # A kit may have fewer takes than round-robin slots; repeat rather than teach the player
            # about uneven kits.
            a = np.clip(takes[rr % len(takes)] * scale, -1.0, 1.0)
            path = out_dir / f"{stroke}-rr{rr + 1}.wav"
            wavfile.write(path, rate, (a * 32767).astype(np.int16))
            written += path.stat().st_size
            print(f"  wrote {path.relative_to(REPO)}  {path.stat().st_size / 1024:.0f} KB")
    return written


# ---------------------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--analyse",
        action="store_true",
        help="measure and propose the mapping, but write nothing",
    )
    args = ap.parse_args()

    total = 0
    for kit in KITS:
        print(f"\n{kit.kit_id}")
        rows: list[Measured] = []
        loaded: dict[str, list[np.ndarray]] = {}
        rate = 0
        for cand, names in kit.candidates.items():
            takes = []
            for name in names:
                x, r = read_mono(fetch(kit, name))
                rate = rate or r
                if r != rate:
                    print(f"  ✗ {name} is {r} Hz, expected {rate}", file=sys.stderr)
                    return 1
                takes.append(trim(x, r))
            loaded[cand] = takes
            rows.append(measure(takes[0], rate, cand))

        print(f"  {'candidate':<10} {'low<200Hz':>10} {'centroid':>10} {'decay':>9} {'peak':>7}")
        for m in sorted(rows, key=lambda m: -m.low_frac):
            print(
                f"  {m.name:<10} {m.low_frac * 100:9.1f}% {m.centroid:9.0f}Hz "
                f"{m.decay_ms:8.0f}ms {m.peak:7.2f}"
            )

        guess = propose(rows)
        print(f"  proposed: " + ", ".join(f"{s}={guess[s]}" for s in STROKES))
        if kit.known:
            agree = guess == kit.known
            print(f"  named:    " + ", ".join(f"{s}={kit.known[s]}" for s in STROKES))
            # The frame drum is the control: it is the one kit where the truth is on the label, so a
            # disagreement here is evidence about the MEASUREMENTS, which are what the darbuka's
            # unnamed files depend on.
            print(f"  → the measurements {'AGREE with' if agree else 'DISAGREE with'} the names")

        # Where the source names say what a stroke is, believe them over the measurement.
        mapping = dict(kit.known) if kit.known else guess

        if not args.analyse:
            total += write_kit(kit, mapping, loaded, rate)

    if not args.analyse:
        print(f"\ntotal {total / 1024:.0f} KB in {OUT_ROOT.relative_to(REPO)}")
        # Mirrors MAX_AUDIO_MB in apps/web/tools/prune-dist.mjs, so this fails here — where the fix
        # is obvious — rather than at build time.
        if total > 1024 * 1024:
            print("✗ over the 1 MB the build guard allows; trim harder", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
