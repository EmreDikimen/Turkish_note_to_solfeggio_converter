"""Parser for SymbTr-2.0.0 ``.txt`` scores.

A SymbTr txt file is a tab-separated table with a header row. Each subsequent row
is one event. The columns are::

    Sira  Kod  Nota53  NotaAE  Koma53  KomaAE  Pay  Payda  Ms  LNS  Bas  Soz1  Offset

Meaning of the columns we care about for Phase 0:

* ``Kod``    -- event code. 9 = a note or a rest. 51 = usul (meter) change.
               Other codes (8, 10, 11, 12, ...) are ornament/meta rows.
* ``Nota53`` -- note name in 53-TET Turkish solfege (e.g. ``Do5``). ``Es`` = rest.
* ``Koma53`` -- the pitch as an *absolute Holdrian comma* value (octave = 53 commas).
               This maps directly to a frequency (see ``audio.tuning``).
               ``-1`` marks a rest.
* ``Pay``/``Payda`` -- the note's duration as a fraction of a whole note (Pay/Payda).
* ``Ms``     -- the note's nominal duration in **milliseconds** (already computed for us).
* ``Soz1``   -- lyric syllable, if any.
* ``Offset`` -- end time of the event in beats.

For Phase 0 we only need notes and rests; meta rows are kept but ignored by the
synthesizer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class EventKind(str, Enum):
    NOTE = "note"
    REST = "rest"
    META = "meta"  # usul change, ornament markers, anything not a sounding note/rest


# The exact header SymbTr v2.0.0 uses, in order. We validate against this so the
# parser fails loudly if a future file has a different layout.
EXPECTED_COLUMNS = [
    "Sira", "Kod", "Nota53", "NotaAE", "Koma53", "KomaAE",
    "Pay", "Payda", "Ms", "LNS", "Bas", "Soz1", "Offset",
]

NOTE_CODE = 9
REST_KOMA = -1


@dataclass
class Event:
    """A single row of a SymbTr score."""

    index: int          # Sira (1-based row index from the file)
    code: int           # Kod
    note_53: str        # Nota53 (e.g. "Do5", or "Es" for a rest)
    note_ae: str        # NotaAE (Arel-Ezgi name, e.g. "C5")
    koma_53: int        # Koma53 (absolute Holdrian comma; -1 for a rest)
    koma_ae: int        # KomaAE
    num: int            # Pay   (duration numerator)
    den: int            # Payda (duration denominator)
    ms: int             # Ms    (nominal duration in milliseconds)
    lns: int            # LNS
    bas: int            # Bas
    lyric: str          # Soz1
    offset: float       # Offset (end time in beats)

    @property
    def kind(self) -> EventKind:
        if self.code == NOTE_CODE:
            return EventKind.REST if self.koma_53 == REST_KOMA else EventKind.NOTE
        return EventKind.META

    @property
    def duration_s(self) -> float:
        return self.ms / 1000.0


@dataclass
class Score:
    """A parsed SymbTr piece: metadata derived from the filename plus its events."""

    name: str                       # original filename stem
    makam: str = ""
    form: str = ""
    usul: str = ""
    title: str = ""
    composer: str = ""
    events: list[Event] = field(default_factory=list)

    @property
    def notes(self) -> list[Event]:
        return [e for e in self.events if e.kind is EventKind.NOTE]

    @property
    def sounding_events(self) -> list[Event]:
        """Notes and rests in order -- everything the synthesizer needs."""
        return [e for e in self.events if e.kind in (EventKind.NOTE, EventKind.REST)]


def _to_int(value: str, default: int = 0) -> int:
    value = value.strip()
    try:
        return int(value)
    except ValueError:
        try:
            return int(float(value))
        except ValueError:
            return default


def _to_float(value: str, default: float = 0.0) -> float:
    value = value.strip()
    try:
        return float(value)
    except ValueError:
        return default


def _parse_metadata_from_name(stem: str) -> dict[str, str]:
    """SymbTr filenames encode metadata: makam--form--usul--title--composer.

    Example: ``acem--ilahi--duyek--aldanma_dunya--zekai_dede``
    Fields may be missing (empty between the ``--`` separators).
    """
    parts = stem.split("--")
    parts += [""] * (5 - len(parts))  # pad so unpacking is safe
    makam, form, usul, title, composer = parts[:5]
    return {
        "makam": makam,
        "form": form,
        "usul": usul,
        "title": title.replace("_", " ").strip(),
        "composer": composer.replace("_", " ").strip(),
    }


def parse_file(path: str | Path) -> Score:
    """Parse a SymbTr ``.txt`` file into a :class:`Score`."""
    path = Path(path)
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines:
        raise ValueError(f"Empty SymbTr file: {path}")

    header = lines[0].split("\t")
    if header[: len(EXPECTED_COLUMNS)] != EXPECTED_COLUMNS:
        raise ValueError(
            f"Unexpected SymbTr columns in {path.name}.\n"
            f"  expected: {EXPECTED_COLUMNS}\n"
            f"  got:      {header}"
        )

    meta = _parse_metadata_from_name(path.stem)
    score = Score(name=path.stem, **meta)

    for line_no, raw in enumerate(lines[1:], start=2):
        if not raw.strip():
            continue
        cols = raw.split("\t")
        # Pad short rows so trailing empty columns (e.g. missing lyric) don't crash.
        if len(cols) < len(EXPECTED_COLUMNS):
            cols += [""] * (len(EXPECTED_COLUMNS) - len(cols))
        score.events.append(
            Event(
                index=_to_int(cols[0]),
                code=_to_int(cols[1]),
                note_53=cols[2].strip(),
                note_ae=cols[3].strip(),
                koma_53=_to_int(cols[4], default=REST_KOMA),
                koma_ae=_to_int(cols[5], default=REST_KOMA),
                num=_to_int(cols[6]),
                den=_to_int(cols[7], default=1),
                ms=_to_int(cols[8]),
                lns=_to_int(cols[9]),
                bas=_to_int(cols[10]),
                lyric=cols[11].strip(),
                offset=_to_float(cols[12]),
            )
        )

    return score
