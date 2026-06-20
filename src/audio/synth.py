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
    """Short linear attack + release to avoid clicks at note boundaries."""
    env = np.ones(n_samples, dtype=np.float32)
    edge = min(int(0.010 * sr), n_samples // 2)  # 10 ms, clamped for very short notes
    if edge > 0:
        env[:edge] = np.linspace(0.0, 1.0, edge, dtype=np.float32)
        env[-edge:] = np.linspace(1.0, 0.0, edge, dtype=np.float32)
    return env


def _render_tone(freq: float, duration_s: float, sr: int = SAMPLE_RATE) -> np.ndarray:
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
    """Render a Score to a mono float32 waveform in [-1, 1]."""
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
    """Write a mono float32 waveform to a 16-bit PCM WAV file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(audio, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
