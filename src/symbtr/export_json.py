"""Export a parsed SymbTr :class:`Score` to the note-model JSON the TS core consumes.

This JSON is the **data contract** between the Python (training/data) side and the
shared TypeScript `core`. It mirrors the parsed `Event` fields and carries the tuning
parameters so the core can recompute frequencies itself (the per-note ``freqHz`` is a
convenience/validation value; the core is the source of truth).

Schema (``schemaVersion`` 1)::

    {
      "schemaVersion": 1,
      "name": "acem--ilahi--...",
      "makam": "acem", "form": "ilahi", "usul": "duyek",
      "title": "...", "composer": "...",
      "tuning": {"system": "53tet", "refFreqHz": 440.0, "refKoma": 327, "commasPerOctave": 53},
      "events": [
        {"index": 1, "kind": "note", "koma53": 318, "noteName": "Do5", "noteAE": "C5",
         "durationMs": 714, "durationBeats": {"num": 1, "den": 4},
         "freqHz": 391.14, "lyric": "Al", "offset": 0.25},
        {"index": 34, "kind": "rest", "koma53": -1, ... "freqHz": null, ...},
        {"index": 99, "kind": "meta", "code": 51, ...}
      ]
    }

All events (notes, rests, and meta rows) are exported with a ``kind`` tag so consumers
can filter; the web editor ignores ``meta`` for now.
"""

from __future__ import annotations

import json
from pathlib import Path

from symbtr.parser import EventKind, Score
from audio.tuning import (
    COMMAS_PER_OCTAVE,
    DEFAULT_REF_FREQ,
    DEFAULT_REF_KOMA,
    koma53_to_freq,
)

SCHEMA_VERSION = 1


def score_to_dict(
    score: Score,
    ref_freq: float = DEFAULT_REF_FREQ,
    ref_koma: int = DEFAULT_REF_KOMA,
) -> dict:
    """Convert a :class:`Score` into a plain dict matching the note-model JSON contract.

    What/why: this is the **bridge between the two languages**. Python parses SymbTr, but
    the app is TypeScript — they can't share objects, so they share a file. This flattens
    the `Score` into JSON-friendly types (dicts, lists, numbers, strings) that the TS
    `core` reads back into its `NoteModelDocument` type. Keep this in sync with
    `packages/core/src/types.ts`; they describe the same shape on two sides of the wire.
    How it works:
      * Walk *all* events (notes, rests, AND meta) and tag each with its ``kind`` so the
        consumer can filter — unlike the synth, the editor may want to show more than sound.
      * For notes, precompute ``freqHz`` as a convenience/validation value; rests/meta get
        ``null``. (The TS core can recompute it from ``koma53`` + tuning — the precomputed
        value is just a cross-check, which is how we verified Python/TS parity.)
      * Attach the ``tuning`` block so the frequency anchor travels *with* the data; the
        consumer never has to guess or hardcode it.
    Why a dict and not a file: separating "build the data" from "write the file" keeps this
    function pure (easy to test) — ``export_file`` does the I/O.
    """
    events: list[dict] = []
    for ev in score.events:
        kind = ev.kind
        entry: dict = {
            "index": ev.index,
            "kind": kind.value,
            "koma53": ev.koma_53,
            "noteName": ev.note_53,
            "noteAE": ev.note_ae,
            "durationMs": ev.ms,
            "durationBeats": {"num": ev.num, "den": ev.den},
            "freqHz": (
                round(koma53_to_freq(ev.koma_53, ref_freq, ref_koma), 4)
                if kind is EventKind.NOTE
                else None
            ),
            "lyric": ev.lyric,
            "offset": ev.offset,
        }
        if ev.lyric_word_end:
            entry["lyricWordEnd"] = True  # syllable ends a word (drives hyphenation in the sheet)
        if kind is EventKind.META:
            entry["code"] = ev.code  # keep the raw Kod for meta rows (e.g. 51 = usul change)
        events.append(entry)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "name": score.name,
        "makam": score.makam,
        "form": score.form,
        "usul": score.usul,
        "title": score.title,
        "composer": score.composer,
        "tuning": {
            "system": "53tet",
            "refFreqHz": ref_freq,
            "refKoma": ref_koma,
            "commasPerOctave": COMMAS_PER_OCTAVE,
        },
        "events": events,
    }


def export_file(
    score: Score,
    path: str | Path,
    ref_freq: float = DEFAULT_REF_FREQ,
    ref_koma: int = DEFAULT_REF_KOMA,
    indent: int | None = 2,
) -> None:
    """Write a Score's note-model JSON to disk. The file the web app actually loads.

    What/why: thin I/O wrapper over ``score_to_dict`` — it builds the data then writes it.
    How it works / what's important:
      * ``ensure_ascii=False`` keeps Turkish characters (ç, ğ, ü, makam names, lyrics)
        readable instead of escaped to ``\\uXXXX`` — the file is UTF-8.
      * ``indent=2`` pretty-prints it so it's human-readable while learning (pass
        ``indent=None`` later for compact files).
      * Creates the parent folder if missing, so callers don't have to.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = score_to_dict(score, ref_freq=ref_freq, ref_koma=ref_koma)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=indent),
        encoding="utf-8",
    )
