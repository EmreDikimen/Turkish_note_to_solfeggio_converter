"""A minimal additive synthesizer: turn a parsed SymbTr Score into audio.

This is deliberately simple (a few harmonics + an ADSR-ish envelope, written to a
WAV with the standard library). It exists to prove the back half of the pipeline:
symbolic notes -> correct 53-TET frequencies -> audible playback. Instrument
samples (Ney, clarinet, ...) come in a later phase.
"""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

from symbtr.parser import EventKind, Score
from audio.tuning import koma53_to_freq

SAMPLE_RATE = 44_100

# Relative amplitudes of harmonics 1..N. A gently decaying spectrum sounds less
# harsh than a pure sine while staying cheap to compute.
HARMONICS = (1.0, 0.45, 0.25, 0.12, 0.06)


def _envelope(n_samples: int, sr: int = SAMPLE_RATE) -> np.ndarray:
    """Build a volume curve (an "envelope") that fades each note in and out.

    What/why: if a note's waveform jumps from 0 to full volume instantly, the speaker cone
    snaps and you hear a "click"/"pop" at every note boundary. Real instruments ramp up and
    down. This returns a multiplier array (one value per audio sample) that rises from 0→1
    at the start (attack) and falls 1→0 at the end (release); multiplying the tone by it
    removes the clicks.
    How it works: start with all 1.0s, then overwrite the first ``edge`` samples with a
    line from 0→1 and the last ``edge`` with a line from 1→0. ``edge`` is ~10 ms, but
    clamped to half the note so very short notes still get a (shorter) fade.
    """
    env = np.ones(n_samples, dtype=np.float32)
    edge = min(int(0.010 * sr), n_samples // 2)  # 10 ms, clamped for very short notes
    if edge > 0:
        env[:edge] = np.linspace(0.0, 1.0, edge, dtype=np.float32)
        env[-edge:] = np.linspace(1.0, 0.0, edge, dtype=np.float32)
    return env


def _render_tone(freq: float, duration_s: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    """Generate the actual sound samples for ONE note of a given frequency and length.

    What/why: this is where a number (frequency) becomes sound. Digital audio is just a
    long list of numbers ("samples") describing the speaker position 44,100 times per
    second; this builds that list for a single note.
    How it works:
      * ``n`` = how many samples we need = duration × sample rate.
      * ``t`` = the time (in seconds) of each sample: 0, 1/sr, 2/sr, ...
      * A pure tone is sin(2π·freq·t). Real instruments also have *harmonics* (quieter
        tones at 2×, 3×, ... the frequency), which is what makes them sound richer than a
        plain sine. We add a few harmonics with decreasing amplitude (``HARMONICS``).
      * Divide by the sum of harmonic amplitudes to keep the volume in range, then apply
        the fade-in/out envelope.
    Important: ``freq`` here already encodes the microtone — this function doesn't know or
    care about commas; the tuning math happened before it was called.
    """
    n = max(1, int(duration_s * sr))
    t = np.arange(n, dtype=np.float32) / sr
    wave_out = np.zeros(n, dtype=np.float32)
    for k, amp in enumerate(HARMONICS, start=1):
        wave_out += amp * np.sin(2.0 * np.pi * freq * k * t)
    wave_out /= sum(HARMONICS)
    return wave_out * _envelope(n, sr)


def render_score(
    score: Score,
    sr: int = SAMPLE_RATE,
    ref_freq: float = 440.0,
    gain: float = 0.85,
) -> np.ndarray:
    """Render a whole Score into one continuous audio waveform. **Main synth entry point.**

    What/why: ties the pieces together — walk the piece in order and stitch each note/rest
    into one long audio buffer that can be written to a WAV and played.
    How it works:
      1. Loop over ``sounding_events`` (notes + rests, in order — see why in parser.py).
      2. A rest becomes a block of zeros (silence) of the right length; a note becomes the
         output of ``_render_tone`` at its computed 53-TET frequency.
      3. ``np.concatenate`` joins all segments end-to-end (this is what makes timing work).
      4. *Normalize*: divide by the loudest sample so nothing clips/distorts, then scale by
         ``gain`` to leave a little headroom.
    Returns a float32 array in [-1, 1] — the conventional range for audio samples.
    """
    segments: list[np.ndarray] = []
    for ev in score.sounding_events:
        if ev.kind is EventKind.REST:
            segments.append(np.zeros(max(1, int(ev.duration_s * sr)), dtype=np.float32))
        else:
            freq = koma53_to_freq(ev.koma_53, ref_freq=ref_freq)
            segments.append(_render_tone(freq, ev.duration_s, sr))

    if not segments:
        return np.zeros(0, dtype=np.float32)

    audio = np.concatenate(segments)
    peak = float(np.max(np.abs(audio))) or 1.0
    return (audio / peak * gain).astype(np.float32)


def write_wav(path: str | Path, audio: np.ndarray, sr: int = SAMPLE_RATE) -> None:
    """Save the waveform to a ``.wav`` file you can open in any audio player.

    What/why: ``render_score`` produces floating-point samples in memory; to actually hear
    them you need a standard file. WAV is the simplest uncompressed format and the stdlib
    ``wave`` module writes it, so we avoid an extra audio dependency.
    How it works: WAV commonly stores samples as 16-bit integers, so we
      * ``clip`` to [-1, 1] (safety against any stray out-of-range value),
      * scale by 32767 (the max value of a signed 16-bit int) and cast to little-endian
        int16 ("<i2"),
      * write a mono (1-channel), 2-byte-per-sample stream at the given sample rate.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(audio, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
