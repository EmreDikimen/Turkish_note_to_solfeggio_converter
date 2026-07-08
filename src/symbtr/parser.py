"""Parser for SymbTr-2.0.0 ``.txt`` scores.

A SymbTr txt file is a tab-separated table with a header row. Each subsequent row
is one event. The columns are::

    Sira  Kod  Nota53  NotaAE  Koma53  KomaAE  Pay  Payda  Ms  LNS  Bas  Soz1  Offset

Meaning of the columns we care about for Phase 0:

* ``Kod``    -- event code. SymbTr uses MANY codes for real notes (1, 7, 9, 10, 11, 12, ...),
               so it is NOT a reliable note/meta flag. 51 = usul (meter) change. What actually
               distinguishes a sounding event is its *duration* (``Ms`` > 0); ``Ms == 0`` rows
               are grace/çarpma notes and control codes (see ``Event.kind``).
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
    GRACE = "grace"  # çarpma (Kod 8, Ms == 0): a drawn small note with no time of its own
    META = "meta"  # usul change, ornament markers, anything not a sounding note/rest


# The exact header SymbTr v2.0.0 uses, in order. We validate against this so the
# parser fails loudly if a future file has a different layout.
EXPECTED_COLUMNS = [
    "Sira", "Kod", "Nota53", "NotaAE", "Koma53", "KomaAE",
    "Pay", "Payda", "Ms", "LNS", "Bas", "Soz1", "Offset",
]

REST_KOMA = -1
USUL_CHANGE_CODE = 51  # Kod 51 = usul (meter) change; carries the new meter in Pay/Payda.
GRACE_CODE = 8  # Kod 8 = çarpma (grace note). Only the Ms == 0 rows are true graces; a few
# Kod-8 rows carry a real duration and are ordinary sounding notes (classified by Ms as usual).


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
    lyric: str          # Soz1 (syllable, stripped; "." = melisma/continuation hold)
    offset: float       # Offset (end time in beats)
    # True when this syllable ends a word. SymbTr marks a word-final syllable with a TRAILING
    # SPACE in Soz1 (e.g. "yim " vs the word-internal "Gam"); we capture it before stripping so
    # the sheet view can draw hyphens between a word's syllables but not across word boundaries.
    lyric_word_end: bool = False

    @property
    def kind(self) -> EventKind:
        """Classify this row as a NOTE, a REST, or META.

        What/why: every downstream stage (synth, JSON export, the editor) needs to
        know whether a row makes sound. Rather than scatter that decision everywhere,
        we compute it once here from the raw columns.
        How it works: **duration is what makes a row a sounding event, not its ``Kod``.**
        SymbTr uses many Kod values for real notes (1, 7, 9, 10, 11, 12, …), so keying on
        ``Kod == 9`` alone silently drops a big chunk of the melody and wrecks the timing.
        Instead: a usul-change row (``Kod 51``) is META; a pitched ``Kod 8`` row with no
        duration is a GRACE (çarpma — drawn as a small note, occupies no time; the rare
        Kod-8 rows WITH a duration are ordinary notes and fall through to the Ms rule);
        any other row with no duration (``Ms == 0`` — control codes like 53/54/55) is
        non-timed, so META; every remaining row occupies time and is a sounding event —
        a ``Koma53`` of -1 marks a rest (silence), anything else is a pitched note.
        Important: this is a *derived* property, not stored data — change the rule here
        and the whole pipeline follows.
        """
        if self.code == USUL_CHANGE_CODE:
            return EventKind.META
        if self.ms <= 0:
            if self.code == GRACE_CODE and self.koma_53 != REST_KOMA:
                return EventKind.GRACE
            return EventKind.META
        return EventKind.REST if self.koma_53 == REST_KOMA else EventKind.NOTE

    @property
    def duration_s(self) -> float:
        """Duration in seconds.

        What/why: the synthesizer thinks in seconds, but SymbTr stores milliseconds
        in the ``Ms`` column. This converts on demand so callers never juggle units.
        Important: we use the pre-computed ``Ms`` value (not Pay/Payda + tempo), which
        is why Phase 0 needs no usul/tempo math.
        """
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
        """Just the pitched notes, in order (rests and meta filtered out).

        What/why: convenient for anything that only cares about pitches — e.g. the
        ``--info`` printout, or computing the pitch range of a piece. It does NOT
        include rests, so don't use it for playback timing (use ``sounding_events``).
        """
        return [e for e in self.events if e.kind is EventKind.NOTE]

    @property
    def sounding_events(self) -> list[Event]:
        """Notes AND rests in order — everything the synthesizer needs.

        What/why: playback must keep rests, because a rest occupies time (silence) and
        shifts every following note later. Dropping rests would make the piece play too
        fast and out of sync with the lyrics. Meta rows are excluded — they make no sound.
        """
        return [e for e in self.events if e.kind in (EventKind.NOTE, EventKind.REST)]


def _to_int(value: str, default: int = 0) -> int:
    """Parse a column string to int, tolerantly (helper; leading ``_`` = private).

    Why: real-world data files are messy — a numeric cell might be blank, have stray
    spaces, or be written as "4.0" instead of "4". A bare ``int(value)`` would crash on
    all of those and kill the whole parse. We want the parser to survive one bad cell.
    How it works: strip spaces, try a plain int; if that fails, try via float (handles
    "4.0"); if that also fails, fall back to ``default`` instead of raising.
    """
    value = value.strip()
    try:
        return int(value)
    except ValueError:
        try:
            return int(float(value))
        except ValueError:
            return default


def _to_float(value: str, default: float = 0.0) -> float:
    """Parse a column string to float, tolerantly. Same rationale as ``_to_int``.

    Used for the ``Offset`` column (e.g. "0.250000"); falls back to ``default`` on junk.
    """
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
    """Parse a SymbTr ``.txt`` file into a :class:`Score`. **This is the entry point.**

    What it does: reads the file, validates it's really a SymbTr table, pulls metadata
    from the filename, and turns every data row into an :class:`Event`.
    Why it exists: it's the single front door to the dataset — every other module starts
    from the `Score` this returns, so they never touch raw text or tab-splitting.
    How it works, step by step:
      1. Read all lines (UTF-8, because makam/lyric text is Turkish).
      2. Validate the header against ``EXPECTED_COLUMNS`` — fail loudly if the format
         changed, instead of silently mis-reading columns.
      3. Derive makam/form/usul/title/composer from the filename.
      4. For each remaining line: skip blanks, split on tabs, pad short rows (a missing
         trailing lyric leaves fewer columns), and build one ``Event`` per row.
    Important: the per-cell parsing uses the tolerant ``_to_int``/``_to_float`` helpers,
    so a single malformed cell degrades to a default rather than crashing the whole parse.
    """
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
                # Word-final iff a real syllable carried a trailing space in the raw column.
                lyric_word_end=bool(cols[11].strip())
                and cols[11].strip() != "."
                and cols[11] != cols[11].rstrip(),
            )
        )

    return score
