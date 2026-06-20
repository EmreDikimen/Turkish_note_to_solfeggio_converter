"""53-TET (Arel-Ezgi-Uzdilek) tuning: convert SymbTr comma values to frequencies.

SymbTr's ``Koma53`` column gives each pitch as an **absolute Holdrian comma**
number. The octave is divided into 53 equal commas, so two pitches whose comma
values differ by 53 are exactly one octave (2x frequency) apart::

    frequency(C) = REF_FREQ * 2 ** ((C - REF_KOMA) / 53)

We anchor the system at A4 = 440 Hz. In SymbTr's comma numbering, A4 sits at comma
305 (derived from the natural-scale spacing: C5=318, and A is 13 commas below C5:
B->C and E->F are 4-comma limmas, all other natural steps are 9-comma whole tones,
summing to 53 per octave). Both the reference frequency and reference comma are
parameters, so the absolute pitch height can be re-anchored later (e.g. for a
specific *ahenk*/transposition) without touching the relative microtonal intervals,
which come straight from the data.
"""

from __future__ import annotations

COMMAS_PER_OCTAVE = 53

# Anchor: comma 305 sounds at 440 Hz (A4).
DEFAULT_REF_KOMA = 305
DEFAULT_REF_FREQ = 440.0


def koma53_to_freq(
    koma: int,
    ref_freq: float = DEFAULT_REF_FREQ,
    ref_koma: int = DEFAULT_REF_KOMA,
) -> float:
    """Convert an absolute Holdrian comma value to a frequency in Hz.

    Args:
        koma: the ``Koma53`` value of the note.
        ref_freq: frequency of the reference comma (default A4 = 440 Hz).
        ref_koma: comma value that sounds at ``ref_freq`` (default 305).

    Returns:
        Frequency in Hz.
    """
    return ref_freq * 2.0 ** ((koma - ref_koma) / COMMAS_PER_OCTAVE)


def cents_above_ref(koma: int, ref_koma: int = DEFAULT_REF_KOMA) -> float:
    """Interval from the reference to ``koma``, in cents (1200 cents = 1 octave)."""
    return (koma - ref_koma) / COMMAS_PER_OCTAVE * 1200.0
