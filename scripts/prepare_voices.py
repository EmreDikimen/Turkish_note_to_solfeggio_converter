#!/usr/bin/env python3
"""
Fetch the CC0 instrument recordings F1 plays, and stage them for upload to the Hub.

Why this exists: W10's two friends asked for more instrument sounds and the owner named violin,
clarinet and kanun (docs/STATUS.md item 5b). Clarinet and violin are VSCO 2 Community Edition, CC0,
pullable from GitHub by URL with no account — so this slice is a download job. Kanun is deferred:
its source needs a Freesound account and onset-splitting a two-minute take.

⚠ **This script is a COPIER and a MEASURER, and that is the whole difference from
`prepare_strokes.py`.** The owner decided on 2026-08-11 that the voices ship uncompressed,
untrimmed, as recorded — full length, stereo, original bit depth — because size stopped being a
constraint once the files left the app (docs/DECISIONS.md). So nothing here trims, fades, downmixes,
resamples or re-levels. `write()` copies the byte stream and then compares sha256 against the
source; a mismatch is a hard failure. That check is what turns "as recorded" from a promise into an
assertion, and it stands in for the trim/level stage the drum script has.

⚠ **Trimming was asked for on 2026-08-13 and it did NOT change that.** The owner heard 16th notes
come out as breath (clarinet) and bow-creak (violin). The fix is a **playback window** per file —
`attackS` / `toneS` / `endS`, emitted into the manifest here and applied by `scheduleSampledNote` —
so the wavs stay byte-identical. Trimming in time rather than in the file keeps the provenance and
the sha256 table true, and costs no re-upload when the numbers need re-tuning by ear. That mattered
immediately: the first attempt trimmed too much and had to be redone the same day, for free.

⚠ **How much of the attack to keep depends on the NOTE, not just the file** (owner, 2026-08-13:
*"maybe we can trim differently for different duration of the notes"*). A short note starts at
`toneS` because it has no time to develop; a long note starts at `attackS` and keeps the real
articulation. The blend lives in `scheduleSampledNote` and costs nothing — it is arithmetic on
numbers this table already carries, with no extra buffers and no second decode.

⚠ **The naming problem, again, in a new form** — the reason this measures instead of parsing.
VSCO's clarinet and solo violin are different sub-libraries by different contributors and they do
NOT share an octave convention: the violin's lowest file is `G3`, which is a real violin's lowest
note, while the clarinet's is `D2`, an octave and a bit below anything a clarinet can sound. Reading
the pitch off the filename would put every clarinet note an octave out — and it would sound
plausible enough to ship. So each file's fundamental is MEASURED (YIN), the label offset is derived
per instrument as the median, and any file that then misses its own label by more than 50 cents is a
hard failure. The violin, whose labels are expected to need no offset, is the control that makes the
clarinet's answer trustworthy — exactly the role the self-describing frame drum played for the
darbuka's numbered files.

Usage:
    .venv-ml/bin/python scripts/prepare_voices.py --analyse    # measure, print, write nothing
    .venv-ml/bin/python scripts/prepare_voices.py              # stage data/audio_voices/
    .venv-ml/bin/python scripts/prepare_voices.py --manifest   # print the TS block for instruments.ts

Downloads are cached in a scratch dir, so re-running is cheap and Ctrl-C is safe.
"""

from __future__ import annotations

import argparse
import hashlib
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
CACHE = REPO / "data" / "audio_src"

# ⚠ NOT apps/web/public/. These files never enter the app's dist — they are staged here and uploaded
# to a Hugging Face dataset repo, served at runtime through VITE_VOICES_URL. `prune-dist.mjs` caps
# the app's own audio at 1 MB and that guard STAYS ON, protecting the drums, which do ship with the
# app (owner, 2026-08-12). Assertion 2 in main() enforces this directory choice structurally.
OUT_ROOT = REPO / "data" / "audio_voices"

VSCO_RAW = "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master"

# The peak a voice is normalised to at playback time, applied as a gain in the note's envelope
# rather than baked into the file (the files ship untouched).
#
# ⚠ The rule this number encodes: **a sampled note must not peak above where the synthesised note
# peaked.** A synth note is a normalised PeriodicWave at gain 1.0 into MASTER_GAIN 0.72, so holding
# the voice at 0.90 leaves it quieter than the tone it replaces at every point in the chain, and F1
# therefore adds NOTHING to the limiter's workload. That is what stops the F2 "patlamış" bug
# recurring from the other direction — there a 0.89 düm summed with a 1.0 note and hard-clipped.
#
# ⚠ It costs perceived loudness and that is expected, not a bug: a PeriodicWave has a ~4-5 dB crest
# factor and a bowed or blown sustain has 10-12 dB, so peak-matched, the voice sounds a few dB
# quieter in RMS than the beep. Loudness-matching would need a peak near 2.0, i.e. the clipping
# arithmetic again. If it is too quiet by ear (MANUAL_CHECKS check 24), raise this to the clamp and
# then add a `Çalgı sesi` slider — never MASTER_GAIN, which was tuned against the drums.
VOICE_PEAK = 0.90

# The hard ceiling `gain * true_peak` is clamped to.
#
# ⚠ Deliberately below 1.0 rather than at it. Clamping to exactly 1.0 makes the invariant
# `gain * peak <= 1` true only at full precision, and both numbers are ROUNDED to three decimals on
# their way into instruments.ts — which is enough to push the product to 1.0017 and fail the check
# in `voices-test.ts` that exists to guarantee it. 2% is 0.17 dB, inaudible, and it makes the
# guarantee survive being written down.
CLIP_CEILING = 0.98

# How far a file's measured pitch may sit from its own (offset-corrected) label before this is a
# naming problem rather than a tuning one.
LABEL_TOLERANCE_CENTS = 50.0

# The worst nearest-neighbour shift `pickSample` may ever have to make, over each instrument's own
# recorded range.
#
# ⚠ MEASURED, and both earlier figures were wrong. docs/features/audio-sources.md said the layers sit
# "a minor third apart", i.e. ±1.5 semitones; planning then said ±2 by counting F→A# as 4 semitones.
# It is a perfect fourth: the clarinet steps D–F–A#–D, so its widest gap is **5 semitones** and the
# worst shift is **±2.5**. The violin's widest is 4.3 (C→E, plus real intonation). Nothing downstream
# may quote ±1.5 again.
MAX_GAP_SEMITONES = 5

MAX_UPLOAD_MB = 80

PITCH_CLASSES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


@dataclass(frozen=True)
class Instrument:
    """One playable voice: where its files come from, and which single layer is taken."""

    voice_id: str
    label: str  # what the picker shows. ⚠ "Keman", never "Kemençe" — a violin is not a kemençe.
    folder: str  # URL path under VSCO_RAW, already percent-escaped
    source: str  # the audit answer, for instruments.ts and THIRD-PARTY.txt
    files: tuple[str, ...]


# 11 pitches, one velocity of three. v2 is the middle layer: the app has no dynamics, so a mid
# velocity is the honest single sound — v1 is a whisper the notes would bury and v3 is a fortissimo
# that would read as an accent on every note.
CLARINET_PITCHES = ("D2", "F2", "A#2", "D3", "F3", "A#3", "D4", "F4", "A#4", "D5", "F#5")

# 15 pitches, `f` of {f, p}. `f` is the clearer tone AND the smaller layer (35.4 MB against ~38).
VIOLIN_PITCHES = (
    "G3", "A3", "C4", "E4", "G4", "A4", "C5", "E5", "G5", "A5", "C6", "E6", "G6", "A6", "C7",
)

INSTRUMENTS = (
    Instrument(
        voice_id="clarinet",
        label="Klarnet",
        folder="Woodwinds/Clarinet/susLong",
        source="https://github.com/sgossner/VSCO-2-CE — Woodwinds/Clarinet/susLong (v2 layer)",
        files=tuple(f"DCClar_susLong_{p}_v2_rr1_sum.wav" for p in CLARINET_PITCHES),
    ),
    Instrument(
        voice_id="violin",
        label="Keman",
        folder="Strings/Solo%20Violin/Arco%20Vib",
        source="https://github.com/sgossner/VSCO-2-CE — Strings/Solo Violin/Arco Vib (f layer)",
        files=tuple(f"LLVln_ArcoVib_{p}_f.wav" for p in VIOLIN_PITCHES),
    ),
)


# ---------------------------------------------------------------------------- fetching


def fetch(inst: Instrument, name: str) -> Path:
    """Download one source wav into the scratch cache, or reuse it if it is already there."""
    dest = CACHE / inst.voice_id / name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{VSCO_RAW}/{inst.folder}/{urllib.parse.quote(name)}"
    print(f"  fetching {name}")
    # Same reason as prepare_strokes.py: this venv's Python has no CA bundle wired to the system
    # keychain, so point it at certifi's rather than at the unverified context the error suggests.
    ctx = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(url, timeout=120, context=ctx) as res, dest.open("wb") as fh:
        shutil.copyfileobj(res, fh)
    return dest


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------- reading + measuring


def read_mono(path: Path) -> tuple[np.ndarray, int]:
    """Read a wav as float32 mono in [-1, 1], whatever format it is stored in.

    For MEASUREMENT only — the file that ships is the untouched original, stereo included.
    """
    rate, data = wavfile.read(path)
    x = data.astype(np.float32)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if np.issubdtype(data.dtype, np.integer):
        x /= float(np.iinfo(data.dtype).max)
    return x, rate


def label_to_midi(label: str) -> int:
    """`A#2` → MIDI number, reading the label as scientific pitch (C4 = 60).

    Whether that reading is RIGHT for a given library is exactly what gets measured; this only says
    what the name claims.
    """
    step = PITCH_CLASSES[label[0].upper()]
    rest = label[1:]
    while rest and rest[0] in "#b":
        step += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + step


def hz_to_midi(hz: float) -> float:
    return 69.0 + 12.0 * float(np.log2(hz / 440.0))


def yin_f0(frame: np.ndarray, rate: int, fmin: float = 60.0, fmax: float = 2400.0) -> float | None:
    """
    Fundamental of one window by YIN's cumulative-mean-normalised difference.

    Plain autocorrelation is the obvious choice and it octave-errors on exactly these two timbres —
    a clarinet's fundamental is weak against its odd harmonics, and it would happily lock onto the
    third partial. YIN's normalisation is what makes the first dip the right one, and octave errors
    are the failure this whole script exists to prevent.
    """
    tau_min = max(2, int(rate / fmax))
    tau_max = min(int(rate / fmin), len(frame) - 2)
    if tau_max <= tau_min:
        return None

    x = frame.astype(np.float64)
    diff = np.empty(tau_max + 1)
    diff[0] = 0.0
    for tau in range(1, tau_max + 1):
        d = x[: len(x) - tau] - x[tau:]
        diff[tau] = float(np.dot(d, d))

    cum = np.cumsum(diff[1:])
    norm = diff[1:] * np.arange(1, tau_max + 1) / np.maximum(cum, 1e-12)

    tau = None
    for t in range(tau_min, tau_max):
        if norm[t - 1] < 0.1 and norm[t - 1] <= norm[t]:
            tau = t
            break
    if tau is None:
        tau = int(np.argmin(norm[tau_min - 1 :])) + tau_min

    # Parabolic interpolation on the dip, so the answer is not quantised to whole samples — at
    # 44.1 kHz a whole-sample lag is already ~10 cents up in the violin's top octave.
    if 1 < tau < tau_max - 1:
        a, b, c = norm[tau - 2], norm[tau - 1], norm[tau]
        denom = a - 2 * b + c
        if abs(denom) > 1e-12:
            tau = tau + 0.5 * (a - c) / denom
    return float(rate / tau) if tau else None


# Each sample gets THREE time points, not one, because how much of the attack to keep depends on how
# long the note is (owner, 2026-08-13).
#
#   attack — where the recording starts sounding at all. A LONG note starts here, so it keeps the
#            instrument's real articulation and does not sound slurred.
#   tone   — where the recording is as tonal as it ever gets. A SHORT note starts here, because it
#            has no time to develop and would otherwise be all breath.
#   end    — where the natural release begins. Every note must be faded out by here.
#
# ⚠ **`tone` is measured SPECTRALLY, and that is the correction from the first attempt.** Breath and
# bow noise are broadband; a sounding tone concentrates its energy on the harmonic series. The first
# version used an AMPLITUDE threshold as a proxy and **overshot in every single file** — 158 ms
# against a real breath-free point of 92 ms, 765 ms against 275, 1178 ms against 604 — because it was
# waiting for the note to reach full LOUDNESS, which happens well after it stops being breathy. That
# is what made the result more slurred than it needed to be, and it is why the owner's read ("we can
# trim less from the beginning") was right.
#
# ⚠ The threshold is **relative to each file's own steady tonality**, never absolute: a clarinet is
# inherently breathy — D3's sustain is only 94.4% harmonic — so an absolute bar is unreachable for
# some notes and trivial for others.
# ⚠ An ABSOLUTE drop below the file's own steady tonality, not a fraction of it — and the difference
# is not academic. A fraction (0.98 of steady) read violin A3's slow *swell* as a one-second breath,
# because its harmonic fraction climbs gently from 79% to 88% with no noise burst anywhere; meanwhile
# it correctly caught C7's real 300 ms bow-bite (51% → 99%). Asking "is this markedly less tonal than
# this note's own norm" separates the two: a swell never drops 10 points below its own steady value,
# a scrape does.
TONE_DROP = 0.10  # harmonic-fraction points below steady that count as noisy
ONSET_FRACTION = 0.02  # of the file's own steady-state level — where sound begins
RELEASE_MARGIN_S = 0.050  # before the natural diminuendo, so a long note never rides the decay
HARMONICS = 12
TONE_WINDOW_S = 0.125  # a 16th note at 120 BPM — the case that failed by ear


@dataclass
class Measured:
    name: str
    label: str
    hz: float
    peak: float  # true maximum, what the clip guard is computed against
    robust: float  # 99.9th percentile of |x|, what the level is set from
    seconds: float
    attack: float  # buffer seconds to the first sound — where a LONG note starts
    tone: float  # buffer seconds to the breath-free tone — where a SHORT note starts
    end: float  # buffer seconds to the start of the release — where a note must be over


def _harmonic_fraction(seg: np.ndarray, rate: int, f0: float) -> float:
    """How much of a window's energy sits on the harmonic series of `f0`.

    This is the breath detector. A blown or bowed onset is broadband noise, so it scores low; a
    sounding tone concentrates its energy into narrow bands at f0, 2·f0, 3·f0 …
    """
    if len(seg) < 256 or not np.isfinite(f0) or f0 <= 0:
        return 0.0
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    freqs = np.fft.rfftfreq(len(seg), 1 / rate)
    total = spec.sum() or 1.0
    harm = sum(spec[(freqs > f0 * k * 0.97) & (freqs < f0 * k * 1.03)].sum() for k in range(1, HARMONICS + 1))
    return float(harm / total)


def _tone_onset(
    x: np.ndarray, rate: int, f0: float, attack: float, end: float, smooth: np.ndarray, body: float
) -> float:
    """First moment a `TONE_WINDOW_S` window is as tonal as this file's own sustain.

    ⚠ Relative to the file's own steady state, never to an absolute bar: a clarinet's sustain is only
    ~94% harmonic, so an absolute 95% threshold is unreachable for some of its notes and trivially
    met by others. Falls back to the amplitude estimate if nothing qualifies, which keeps a file with
    an unusual spectrum playable rather than silent.
    """
    span = np.arange(len(x) * 0.35, len(x) * 0.60, rate * 0.05, dtype=int)
    steady = float(
        np.median([_harmonic_fraction(x[i : i + int(TONE_WINDOW_S * rate)], rate, f0) for i in span])
    )
    target = steady - TONE_DROP

    step = int(rate * 0.010)
    win = int(TONE_WINDOW_S * rate)
    # ⚠ It must STAY tonal, not merely cross the line once. Violin C7's bow-bite produces a
    # momentary 89.6% blip at 50 ms and then falls back to 36% at 100 ms — "first crossing" picked
    # the blip and started the note immediately before the noisiest part of the scrape. Checking
    # ~150 ms forward is what tells a settled tone from a flicker inside a transient.
    ahead = [0, int(rate * 0.05), int(rate * 0.10), int(rate * 0.15)]
    for i in range(int(attack * rate), int(min(attack + 2.5, end) * rate), step):
        # Both conditions matter: tonal AND actually up to level, or the quiet tail of a breath can
        # look spectrally clean while being inaudible under the rest of the mix.
        if smooth[i] < body * 0.5:
            continue
        if all(_harmonic_fraction(x[i + a : i + a + win], rate, f0) >= target for a in ahead):
            return i / rate
    loud = np.nonzero(smooth >= body * 0.9)[0]
    return float(loud[0]) / rate if len(loud) else attack


def measure(path: Path, label: str) -> Measured:
    """Fundamental, level and duration of one recording.

    The fundamental is the median over several windows taken from the middle of the note: the attack
    is transient and the tail is where a bowed note's pitch drifts, while the middle is the part a
    sustained sample actually plays. A violin's vibrato swings ±30 cents or so, which is why this is
    a median over windows rather than one measurement.
    """
    x, rate = read_mono(path)
    seconds = len(x) / rate

    window = 4096
    starts = [int(len(x) * f) for f in (0.30, 0.40, 0.50, 0.60, 0.70)]
    votes = [
        f0
        for s in starts
        if s + window <= len(x)
        for f0 in [yin_f0(x[s : s + window], rate)]
        if f0
    ]
    hz = float(np.median(votes)) if votes else float("nan")

    env = np.abs(x)

    # The three time points. See the constants above for why `tone` is spectral and `attack` is not.
    w = max(1, int(rate * 0.010))
    smooth = np.convolve(env, np.ones(w) / w, mode="same")
    body = float(np.median(smooth[int(len(smooth) * 0.25) : int(len(smooth) * 0.75)]))

    audible = np.nonzero(smooth >= body * ONSET_FRACTION)[0]
    attack = float(audible[0]) / rate if len(audible) else 0.0

    loud = np.nonzero(smooth >= body * 0.9)[0]
    end = float(loud[-1]) / rate - RELEASE_MARGIN_S if len(loud) else seconds

    tone = _tone_onset(x, rate, hz, attack, end, smooth, body) if hz == hz else attack

    return Measured(
        name=path.name,
        label=label,
        hz=hz,
        attack=attack,
        tone=tone,
        end=end,
        peak=float(env.max()),
        # ⚠ Robust, not maximum: one bow-transient sample should not duck the whole instrument. The
        # true peak still governs the clip clamp below, so this can only ever make it louder within
        # a guarded ceiling.
        robust=float(np.percentile(env, 99.9)),
        seconds=seconds,
    )


# ---------------------------------------------------------------------------- reporting


def report(inst: Instrument, rows: list[Measured]) -> tuple[int, float, list[str]]:
    """Print the measurement table and return (label offset, gain, problems)."""
    problems: list[str] = []

    # The label offset, derived rather than assumed: the median of what each file's measured pitch
    # says its label is off by. A library's convention is a property of the library, so one number
    # per instrument — and it must be a whole number of octaves, which is itself a check.
    diffs = [hz_to_midi(m.hz) - label_to_midi(m.label) for m in rows]
    offset = int(round(float(np.median(diffs)) / 12.0) * 12)

    print(
        f"  {'file':<40} {'label':>6} {'measured':>10} {'as':>6} {'off':>8} "
        f"{'peak':>6} {'sec':>6} {'attack':>7} {'tone':>7} {'window':>7}"
    )
    for m in rows:
        target = label_to_midi(m.label) + offset
        cents = (hz_to_midi(m.hz) - target) * 100.0
        named = midi_to_name(target)
        sounds = midi_to_name(int(round(hz_to_midi(m.hz))))
        # ⚠ Two different conditions hide behind one deviation, and only one of them is fatal.
        # A deviation that lands on a whole semitone means the recording is in tune with ITSELF and
        # merely misnamed — harmless here, because `hz` is measured and the name is never read as a
        # pitch. A deviation that lands BETWEEN semitones means either the file is genuinely out of
        # tune or the measurement is unreliable, and both of those poison the manifest.
        semitone_off = cents / 100.0
        misnamed = abs(cents) > LABEL_TOLERANCE_CENTS and (
            abs(semitone_off - round(semitone_off)) * 100 <= LABEL_TOLERANCE_CENTS
        )
        fatal = abs(cents) > LABEL_TOLERANCE_CENTS and not misnamed
        flag = " ✗" if fatal else (" ⚠" if misnamed else "")
        print(
            f"  {m.name:<40} {m.label:>6} {m.hz:9.1f}Hz {named:>6} "
            f"{cents:+7.0f}c {m.peak:6.2f} {m.seconds:6.1f} "
            f"{m.attack * 1000:5.0f}ms {m.tone * 1000:5.0f}ms {m.end - m.tone:6.1f}s{flag}"
        )
        # A window shorter than this means the measurement found a tone that is barely there, and a
        # note would run off the end of it constantly.
        if m.end - m.tone < 2.0:
            problems.append(
                f"{inst.voice_id}: {m.name} has only {m.end - m.tone:.1f}s of steady tone "
                f"(tone {m.tone * 1000:.0f} ms, end {m.end:.1f}s) — check it by ear"
            )
        if not (m.attack <= m.tone < m.end):
            problems.append(
                f"{inst.voice_id}: {m.name} time points are out of order "
                f"(attack {m.attack:.3f}, tone {m.tone:.3f}, end {m.end:.3f})"
            )
        if misnamed:
            print(
                f"    ⚠ mislabelled at source by {round(semitone_off):+d} semitone(s): "
                f"it sounds {sounds}. Playback is unaffected — `hz` is measured, not parsed."
            )
        if fatal:
            problems.append(
                f"{inst.voice_id}: {m.name} measures {m.hz:.1f} Hz, "
                f"{cents:+.0f} cents from {named} — neither the label offset nor a whole "
                f"semitone explains it, so it is out of tune or mismeasured"
            )

    print(
        f"  label offset: {offset:+d} semitones "
        f"({'labels are scientific pitch' if offset == 0 else 'labels sit ' + str(-offset // 12) + ' octave(s) below sounding pitch'})"
    )

    # Level: robust-peak normalisation, clamped so the true peak can never reach full scale.
    robust = max(m.robust for m in rows)
    loudest = max(m.peak for m in rows)
    gain = VOICE_PEAK / robust if robust else 1.0
    if gain * loudest > CLIP_CEILING:
        print(f"  gain clamped {gain:.3f} → {CLIP_CEILING / loudest:.3f} (true peak {loudest:.2f})")
        gain = CLIP_CEILING / loudest
    print(f"  gain: {gain:.3f}  (robust peak {robust:.2f}, true peak {loudest:.2f})")

    spread_db = 20 * np.log10(max(m.peak for m in rows) / max(1e-9, min(m.peak for m in rows)))
    if spread_db > 12:
        # Not fatal, but it is the VCSL `Hand` lesson: a big spread inside one layer means the
        # recording session, not a musical dynamic, and the quiet end may be unusable.
        print(f"  ⚠ peak spread across the layer is {spread_db:.0f} dB — check the quiet files by ear")

    # The gap that sets the worst playbackRate shift `pickSample` will ever make.
    midis = sorted(hz_to_midi(m.hz) for m in rows)
    gaps = [b - a for a, b in zip(midis, midis[1:])]
    worst = max(gaps) if gaps else 0.0
    print(f"  widest gap: {worst:.1f} semitones → worst shift ±{worst / 2:.1f} semitones")
    if worst > MAX_GAP_SEMITONES + 0.6:
        problems.append(f"{inst.voice_id}: a {worst:.1f}-semitone gap needs more pitches, not more stretch")

    return offset, gain, problems


def midi_to_name(midi: int) -> str:
    names = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
    return f"{names[midi % 12]}{midi // 12 - 1}"


# ---------------------------------------------------------------------------- writing


def stage(inst: Instrument, rows: list[Measured]) -> tuple[int, list[str]]:
    """Copy the originals into the upload folder, byte-identical, and return (bytes, problems)."""
    out_dir = OUT_ROOT / inst.voice_id
    out_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    problems: list[str] = []
    for m in rows:
        src = CACHE / inst.voice_id / m.name
        dest = out_dir / m.name  # the ORIGINAL name: these ship untouched, so the name is provenance
        shutil.copyfile(src, dest)
        # The assertion that "uncompressed, untrimmed, as recorded" actually happened. It replaces
        # the trim/level stage prepare_strokes.py has, and it is why no encoder appears anywhere.
        if sha256(src) != sha256(dest):
            problems.append(f"{inst.voice_id}: {m.name} changed in the copy")
        written += dest.stat().st_size
    print(f"  staged {len(rows)} files, {written / 1e6:.1f} MB → {out_dir.relative_to(REPO)}")
    return written, problems


def print_manifest(built: list[tuple[Instrument, list[Measured], int, float]]) -> None:
    """Print the TypeScript literal to paste into apps/web/src/audio/instruments.ts."""
    print("\n" + "=" * 78)
    print("// paste into apps/web/src/audio/instruments.ts — measured, not hand-typed")
    print("=" * 78)
    for inst, rows, offset, gain in built:
        print(f"  {{")
        print(f'    id: "{inst.voice_id}",')
        print(f'    label: "{inst.label}",')
        print(f'    source: "{inst.source}",')
        print(f'    license: "CC0 1.0",')
        print(f'    credit: "Versilian Studios LLC / Sam Gossner",')
        print(f"    gain: {gain:.3f},")
        # Emitted so the no-clipping rule is CHECKABLE in the repo (tools/audio/voices-test.ts)
        # rather than only here, where it is checked against audio the app never sees.
        print(f"    peak: {max(m.peak for m in rows):.3f},")
        if offset:
            print(
                f"    // ⚠ The filenames' pitch labels sit {-offset // 12} octave(s) below the sounding"
                f" pitch;\n    //   `hz` is MEASURED (scripts/prepare_voices.py), the name is provenance only."
            )
        print(f"    samples: [")
        for m in sorted(rows, key=lambda r: r.hz):
            midi = int(round(hz_to_midi(m.hz)))
            print(
                f'      {{ rel: "{inst.voice_id}/{m.name}", hz: {m.hz:.2f}, midi: {midi},'
                f" attackS: {m.attack:.3f}, toneS: {m.tone:.3f}, endS: {m.end:.3f} }},"
                f"  // {midi_to_name(midi)}"
            )
        print(f"    ],")
        print(f"  }},")

    print("\n" + "=" * 78)
    print("# sha256, for hf/omr-voices-README.md")
    print("=" * 78)
    for inst, rows, _, _ in built:
        for m in rows:
            print(f"{sha256(CACHE / inst.voice_id / m.name)}  {inst.voice_id}/{m.name}")


# ---------------------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--analyse", action="store_true", help="measure and print, but write nothing")
    ap.add_argument("--manifest", action="store_true", help="print the TS block and the sha256 table")
    args = ap.parse_args()

    problems: list[str] = []
    built: list[tuple[Instrument, list[Measured], int, float]] = []
    total = 0

    for inst in INSTRUMENTS:
        print(f"\n{inst.voice_id} — {len(inst.files)} files")
        rows: list[Measured] = []
        for name in inst.files:
            path = fetch(inst, name)
            # The label the FILENAME claims, which is the thing under test. Both libraries happen to
            # put it in the third underscore-separated field.
            rows.append(measure(path, name.split("_")[2]))

        offset, gain, found = report(inst, rows)
        problems += found
        built.append((inst, rows, offset, gain))

        if not (args.analyse or args.manifest):
            written, found = stage(inst, rows)
            problems += found
            total += written

    if not (args.analyse or args.manifest):
        # Structural, not a size check: staging into the app's public dir is what would put ~55 MB
        # in front of prune-dist.mjs's 1 MB audio budget — the guard that protects the DRUMS, which
        # do ship with the app. The voices are served from the Hub instead (owner, 2026-08-12).
        if (REPO / "apps" / "web" / "public") in OUT_ROOT.parents:
            problems.append("OUT_ROOT is inside apps/web/public — the voices must not ship with the app")
        # The dataset card rides along, so the upload is one directory and the licence cannot be
        # left behind. It is committed (hf/), unlike the audio.
        card = REPO / "hf" / "omr-voices-README.md"
        if card.exists():
            shutil.copyfile(card, OUT_ROOT / "README.md")
            print(f"  staged README.md from {card.relative_to(REPO)}")
        else:
            problems.append("hf/omr-voices-README.md is missing — the upload would carry no licence")

        print(f"\ntotal {total / 1e6:.1f} MB in {OUT_ROOT.relative_to(REPO)}")
        if total > MAX_UPLOAD_MB * 1e6:
            problems.append(f"{total / 1e6:.1f} MB is over the {MAX_UPLOAD_MB} MB this expects")

    if args.manifest:
        print_manifest(built)

    if problems:
        print("\n✗ not usable as staged:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
