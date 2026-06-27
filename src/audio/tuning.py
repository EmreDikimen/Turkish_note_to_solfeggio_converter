"""53-TET (Arel-Ezgi-Uzdilek) tuning: convert SymbTr comma values to frequencies.

SymbTr's ``Koma53`` column gives each pitch as an **absolute Holdrian comma**
number. The octave is divided into 53 equal commas, so two pitches whose comma
values differ by 53 are exactly one octave (2x frequency) apart::

    frequency(C) = REF_FREQ * 2 ** ((C - REF_KOMA) / 53)

Concert anchor: comma 327 sounds at 440 Hz. Turkish notation is TRANSPOSING — a written
pitch sounds a perfect fourth (22 commas) BELOW its piano-literal letter — so written A4
(comma 305) actually sounds at 330 Hz (concert E4), not 440. We bake that fourth into the
anchor (refKoma 305 + 22 = 327) so default playback matches real Turkish concert pitch.
Both the reference frequency and reference comma are parameters, so the absolute pitch
height can be re-anchored later (e.g. for a specific *ahenk*/transposition) without touching
the relative microtonal intervals, which come straight from the data.
"""

from __future__ import annotations

COMMAS_PER_OCTAVE = 53

# Concert anchor: comma 327 (written D5) sounds at 440 Hz, i.e. written pitch sounds a perfect
# fourth (22 commas) below concert — Turkish notation's transposing convention.
DEFAULT_REF_KOMA = 327
DEFAULT_REF_FREQ = 440.0


def koma53_to_freq(
    koma: int,
    ref_freq: float = DEFAULT_REF_FREQ,
    ref_koma: int = DEFAULT_REF_KOMA,
) -> float:
    """Convert an absolute Holdrian comma value to a frequency in Hz.

    What this does / why it exists: this is *the* function that makes Turkish microtonal
    music audible. SymbTr stores each pitch as a comma number (e.g. 318), not a frequency.
    Speakers need a frequency in Hz. This bridges the two — it is the single source of
    truth for tuning, called by both the Python synth and (re-implemented identically) the
    TypeScript core.

    How it works: pitch perception is *logarithmic* — going up one octave always means
    *doubling* the frequency, no matter where you start. In this system an octave is 53
    commas. So the frequency is the reference frequency multiplied by 2 raised to the
    power (how many commas above the reference) / 53::

        freq = ref_freq * 2 ** ((koma - ref_koma) / 53)

    Example: koma=318 (written C5) with the defaults → 440 * 2**((318-327)/53) ≈ 391.1 Hz
    (sounds a fourth below, ~G4 — the transposing convention).

    What's important:
      * ``ref_freq``/``ref_koma`` are the *anchor* — they set absolute pitch height but
        NOT the microtonal intervals (those come purely from the comma differences, which
        are exact in the data). So re-anchoring for a transposition (*ahenk*) only shifts
        everything up/down together; it never distorts the makam.
      * No DSP/pitch-shifting is involved — we compute the exact target frequency directly.

    Args:
        koma: the ``Koma53`` value of the note.
        ref_freq: frequency of the reference comma (default A4 = 440 Hz).
        ref_koma: comma value that sounds at ``ref_freq`` (default 327 — concert anchor).

    Returns:
        Frequency in Hz.
    """
    return ref_freq * 2.0 ** ((koma - ref_koma) / COMMAS_PER_OCTAVE)


def cents_above_ref(koma: int, ref_koma: int = DEFAULT_REF_KOMA) -> float:
    """Interval from the reference to ``koma``, measured in cents (1200 cents = 1 octave).

    What/why: "cents" is the standard musical unit for comparing pitches (a 12-TET
    semitone = 100 cents). Commas are specific to this system; cents are universal, so this
    is handy for sanity-checking intervals or labeling the UI in a familiar unit.
    How it works: a comma is 1/53 of an octave, and an octave is 1200 cents, so each comma
    is 1200/53 ≈ 22.6 cents; multiply by how many commas above the reference we are.
    """
    return (koma - ref_koma) / COMMAS_PER_OCTAVE * 1200.0
