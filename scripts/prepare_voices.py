#!/usr/bin/env python3
"""
Fetch the CC0 instrument recordings F1 plays, and stage them for upload to the Hub.

Why this exists: W10's two friends asked for more instrument sounds and the owner named violin,
clarinet and kanun (docs/STATUS.md item 5b). Clarinet and violin are VSCO 2 Community Edition, CC0,
pullable from GitHub by URL with no account — so that slice is a download job.

⚠ **There are TWO acquisition paths now, and the kanun is the second one.** A VSCO instrument
arrives as one wav per pitch and is COPIED. The kanun arrives as a single two-minute mp3 —
[Freesound 211133](https://freesound.org/s/211133/), CC0, CompMusic/UPF — and is DERIVED: decoded
once, split at its onsets, written as wav. An `Instrument` declares which path it takes by carrying
`files` (copy) or `take` (split); everything after acquisition — measuring, levelling, the manifest —
is shared.

⚠ **On the copy path this script is a COPIER and a MEASURER, and that is the whole difference from
`prepare_strokes.py`.** The owner decided on 2026-08-11 that the voices ship uncompressed,
untrimmed, as recorded — full length, stereo, original bit depth — because size stopped being a
constraint once the files left the app (docs/DECISIONS.md). So nothing on that path trims, fades,
downmixes, resamples or re-levels. `stage()` copies the byte stream and then compares sha256 against
the source; a mismatch is a hard failure. That check is what turns "as recorded" from a promise into
an assertion, and it stands in for the trim/level stage the drum script has.

⚠ **The split path cannot make that promise and does not pretend to.** A file cut out of a longer
take is a new file, so byte-identity is meaningless for it. What replaces the assertion is the
**source take's** sha256, recorded beside the staged files' own, so the derivation is reproducible
and auditable. Two consequences that must not be lost: the mp3 is decoded EXACTLY ONCE and never
re-encoded (re-encoding lossy audio compounds the loss), and "served unmodified" is from here on a
per-folder claim, not a claim about the whole repo.

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

⚠ **The kanun has no filename to distrust, so it gets a different control, and it needs one.** Its
notes come out of a splitter, and a splitter can miss an onset or cut one note in two without
sounding obviously wrong. The take is described as *"all chromatic tones within the range of the
instrument"*, so the measured pitches must form a CHROMATIC RUN — and that is checkable. A ~200-cent
step between neighbours means an onset was missed and a ~0-cent step means one note was cut in two.
`--analyse` prints that line, and the run is also what SELECTS the notes: this take opens with two
events that are not part of it, and membership in the sequence is what excludes them (see
`select_chromatic_run` for why level and harmonicity both fail at that job).

⚠ **The run descends** — E6 down to F3, 36 notes — so the direction is read off the take rather than
assumed. ⚠ And its steps are 74-135 cents, not 100: a kanun's mandals are spaced in komas, so this
is a makam instrument in makam tuning, not a mistuned piano. Nothing may "correct" it; `hz` is
measured and the note names in the manifest are nearest-12-TET labels for reading the table.

Usage:
    .venv-ml/bin/python scripts/prepare_voices.py --analyse    # measure, print, write nothing
    .venv-ml/bin/python scripts/prepare_voices.py              # stage data/audio_voices/
    .venv-ml/bin/python scripts/prepare_voices.py --manifest   # print the TS block for instruments.ts

Then hear it before publishing it:

    npm run serve:voices        # data/audio_voices/ on :8788, with the headers COEP needs
    npm run dev:voices:local    # the app, pointed at that instead of the Hub

Copy-path downloads are cached in a scratch dir, so re-running is cheap and Ctrl-C is safe. A
split-path take is downloaded BY HAND (Freesound needs an account) into the same cache; an
instrument whose take is missing is skipped with a message rather than failing the run, so the two
VSCO voices never depend on it.

Needs `soundfile` for the split path only (`.venv-ml/bin/pip install soundfile`) — scipy cannot
decode mp3. It is already declared in requirements.txt.
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

# How nearly as good a dip at tau/2, tau/3 or tau/4 has to be before YIN prefers the shorter period.
# See the octave check in `yin_f0` for the measurement this is set from: the real answers score 1.3×
# the subharmonic's, the wrong ones 19-46×. Anywhere in between would do; 2.0 is the middle of the
# gap in log terms, not a number tuned until the output looked right.
OCTAVE_TOLERANCE = 2.0

# ---------------------------------------------------------------------------- the split path

# How far below its own peak a plucked note has decayed before it counts as over.
#
# ⚠ **−50 dB, and the two neighbouring choices were measured rather than argued about.** At −40 dB
# the tails were being cut while the note was still sounding — A5's window came out 0.4 s where the
# note actually rings for 1.6 s, and D5's 0.8 s against 1.8 s. At −60 dB it goes the other way and
# starts chasing the recording's own hiss: E6's "note" extends to fill its entire 2.3 s segment.
# −50 dB sits between them with 12 dB of margin over this take's measured noise floor (−62 dB).
#
# ⚠ This is what `end` MEANS for a pluck, and it is not what it means for a sustain. A bowed or blown
# note ends when the player stops, so `end` is measured backwards from the release; a plucked note
# ends when it runs out, so `end` is the decay reaching the floor. Same field, same use downstream
# (fade the note out by here), different physics reaching it.
PLUCK_FLOOR = 0.003

# Splitting the take, by RISE rather than by level.
#
# ⚠ **An absolute threshold cannot work on this material and the first attempt proved it.** A level
# set from the take's own peak found 22 of ~38 notes: the recording swings 7:1 from end to end (peak
# envelope 0.02 → 0.40 → 0.05 in 5-second buckets, measured), because it is one player working down
# the range rather than a levelled sampling session. Any single threshold is either deaf to the quiet
# half or triggers on the loud half's decay ripple. So what is detected is the RISE — each moment
# against its own recent past — which is scale-free by construction and survives the swing.
#
# A decay never rises, which is what makes this specific to attacks rather than to loudness.
ONSET_RISE_RATIO = 4.0  # louder than ONSET_LOOKBACK_S ago by this much = a new note began
ONSET_LOOKBACK_S = 0.150
ONSET_FLOOR = 0.04  # of the take's loudest window — under this it is room noise, not a pluck
MIN_ONSET_GAP_S = 1.20  # measured spacing in this take is 1.55-5.13 s, so this cannot merge notes
PREROLL_S = 0.020  # kept before each onset, so no note is cut into its own transient

# A second attack INSIDE one sample — the player striking the same string twice. `endS` is pulled
# back before it (see `_second_attack`), so the recording keeps it and playback never reaches it.
RE_ATTACK_RATIO = 3.0
RE_ATTACK_AFTER_S = 0.40  # no note re-articulates sooner than this; below it, that is still the pluck
RE_ATTACK_FLOOR = 0.10  # of the file's own peak — under this it is a decayed tail, not a new note

# Where a pluck's attack is taken to begin: the last moment before its peak that was still under this
# fraction of it. See the plucked branch of `measure_array` — it replaces "first audible sample",
# which on a note cut out of a longer take starts on whatever the take was doing beforehand.
PLUCK_ATTACK_FRACTION = 0.10

# The longest a plucked note may take to reach HALF its peak after `attack`. Measured: every sample
# in this take does it in 15-18 ms, and the mis-set attack that prompted the check took 160 ms. What
# it exists to catch is `attack` landing BEFORE the pluck, on whatever preceded it in the take — a
# 16th note at 120 BPM is 125 ms, which is the length that made it audible.
PLUCK_RISE_MAX_S = 0.060

# The chromatic control (see the module docstring). A step this far from a semitone means the split
# is wrong.
#
# ⚠ **Deliberately loose, because the kanun is not a 12-TET instrument and this is the evidence.**
# Measured across the take, its steps run from 74 to 135 cents rather than sitting on 100 — that is
# a makam instrument's mandal spacing, which is built from komas (22.6 cents) and gives bakiye and
# mücennep steps where a piano would give a semitone. It is not mistuning and it must not be
# "corrected": `hz` is measured, so the app plays the pitches the instrument actually made. The note
# names in the manifest are nearest-12-TET LABELS for reading the table, nothing more — the same
# distinction the clarinet's filenames taught, arriving from the other direction.
#
# So the tolerance has to cover a real 74-135 while still catching what it is for: a missed onset
# shows up near 200 cents and a note cut in two near 0, both far outside this.
CHROMATIC_TOLERANCE_CENTS = 50.0


@dataclass(frozen=True)
class Instrument:
    """One playable voice: where its files come from, and which single layer is taken.

    Two acquisition paths, and an instrument declares which by what it carries:
      * `folder` + `files` — one wav per pitch under VSCO_RAW, downloaded and COPIED byte for byte.
      * `take`             — one local recording under CACHE/<voice_id>/, split into notes here.
    """

    voice_id: str
    label: str  # what the picker shows. ⚠ "Keman", never "Kemençe" — a violin is not a kemençe.
    source: str  # the audit answer, for instruments.ts and THIRD-PARTY.txt
    license: str
    credit: str  # asked for by the source's readme, or the researcher who recorded it
    folder: str = ""  # copy path: URL path under VSCO_RAW, already percent-escaped
    files: tuple[str, ...] = ()
    take: str = ""  # split path: a file downloaded BY HAND into CACHE/<voice_id>/
    take_url: str = ""  # …and where to get it, for the error message when it is not there
    plucked: bool = False  # a pluck decays and dies; see PLUCK_FLOOR and `measure`
    fmin: float = 60.0  # YIN's floor — must sit below the instrument's lowest note


# 11 pitches, one velocity of three. v2 is the middle layer: the app has no dynamics, so a mid
# velocity is the honest single sound — v1 is a whisper the notes would bury and v3 is a fortissimo
# that would read as an accent on every note.
CLARINET_PITCHES = ("D2", "F2", "A#2", "D3", "F3", "A#3", "D4", "F4", "A#4", "D5", "F#5")

# 15 pitches, `f` of {f, p}. `f` is the clearer tone AND the smaller layer (35.4 MB against ~38).
VIOLIN_PITCHES = (
    "G3", "A3", "C4", "E4", "G4", "A4", "C5", "E5", "G5", "A5", "C6", "E6", "G6", "A6", "C7",
)

VSCO_CREDIT = "Versilian Studios LLC / Sam Gossner"

INSTRUMENTS = (
    Instrument(
        voice_id="clarinet",
        label="Klarnet",
        folder="Woodwinds/Clarinet/susLong",
        source="https://github.com/sgossner/VSCO-2-CE — Woodwinds/Clarinet/susLong (v2 layer)",
        license="CC0 1.0",
        credit=VSCO_CREDIT,
        files=tuple(f"DCClar_susLong_{p}_v2_rr1_sum.wav" for p in CLARINET_PITCHES),
    ),
    Instrument(
        voice_id="violin",
        label="Keman",
        folder="Strings/Solo%20Violin/Arco%20Vib",
        source="https://github.com/sgossner/VSCO-2-CE — Strings/Solo Violin/Arco Vib (f layer)",
        license="CC0 1.0",
        credit=VSCO_CREDIT,
        files=tuple(f"LLVln_ArcoVib_{p}_f.wav" for p in VIOLIN_PITCHES),
    ),
    # ⚠ The one instrument here that is genuinely Turkish, and the only one that is DERIVED. Its
    # source is a single take of the whole chromatic range, from the CompMusic project's makam
    # research — which is why a Freesound upload gets the benefit of the doubt on its CC0 claim
    # (docs/features/audio-sources.md). It is downloaded by hand: Freesound needs an account.
    #
    # ⚠ `fmin=40` is not a tidy-up. A kanun's bottom course is around G1/A1 (49-55 Hz), UNDER the
    # 60 Hz floor the two VSCO instruments were fine with, and YIN cannot report a pitch below its
    # own floor — it would return the octave above and the chromatic check would show a 1200-cent
    # step. The floor also sets the analysis frame, which has to hold two periods of it.
    Instrument(
        voice_id="kanun",
        label="Kanun",
        source=(
            "https://freesound.org/s/211133/ — 211133__barisbozkurt__kanun_moderate_chromatic_"
            "moreisolated.mp3, split at the onsets (CompMusic / Universitat Pompeu Fabra)"
        ),
        license="CC0 1.0",
        credit="Barış Bozkurt / CompMusic, Universitat Pompeu Fabra",
        # ⚠ Freesound's own download name, kept exactly: it carries the sound id and the uploader,
        # which is better provenance than the bare title and is what makes 211133 findable again.
        take="211133__barisbozkurt__kanun_moderate_chromatic_moreisolated.mp3",
        take_url="https://freesound.org/s/211133/",
        plucked=True,
        fmin=40.0,
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


def take_path(inst: Instrument) -> Path | None:
    """Where a hand-downloaded take must sit, or None if it is not there yet.

    ⚠ Deliberately NOT downloaded. Freesound serves the file only to a logged-in account, and the
    alternative — an OAuth flow inside a data-prep script — is a lot of machinery for a 2.3 MB file
    fetched once in the project's life.

    ⚠ A missing take SKIPS its instrument rather than killing the run. The two VSCO voices come off
    GitHub and have nothing to do with it; making them unstageable because a third instrument has not
    been downloaded yet would be the script inventing a dependency that does not exist.
    """
    path = CACHE / inst.voice_id / inst.take
    if not path.exists() or path.stat().st_size == 0:
        return None
    return path


def missing_take(inst: Instrument) -> str:
    return (
        f"{inst.voice_id}: the source take is not downloaded. Get it from {inst.take_url} "
        f"(a free account is needed) and save it as data/audio_src/{inst.voice_id}/{inst.take} — "
        f"the ORIGINAL file, not a conversion: this script decodes it once, and re-encoding lossy "
        f"audio compounds the loss."
    )


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


def decode_take(path: Path) -> tuple[np.ndarray, int]:
    """Decode the source take to float32 mono, ONCE.

    ⚠ `scipy.io.wavfile` cannot read mp3, which is why this is the one place `soundfile` is needed.
    It is imported here rather than at module scope so the copy path — the two VSCO instruments,
    which is what most runs do — still works in a venv that never installed it.

    ⚠ The decode happens exactly once and the result is what gets cut up and written. Nothing
    re-encodes: the source is already lossy, and a second pass through an encoder would add its own
    artefacts on top of the ones that are already baked in.
    """
    try:
        import soundfile as sf
    except ModuleNotFoundError:
        raise SystemExit(
            "\n✗ soundfile is needed to read the kanun take (scipy cannot decode mp3).\n"
            "  It is already declared in requirements.txt; this venv just does not have it:\n"
            "    .venv-ml/bin/pip install soundfile"
        )

    x, rate = sf.read(str(path), dtype="float32", always_2d=True)
    x = x.mean(axis=1)

    # ⚠ Scaled for the WHOLE take at once if it overshoots, never per note. An mp3 decode can exceed
    # full scale on material mastered right up to it, and clipping it would flatten exactly the
    # transients this instrument is made of. Doing it once keeps every note's level relative to every
    # other one, which is what the single per-voice `gain` downstream assumes.
    peak = float(np.abs(x).max())
    if peak > 1.0:
        print(f"  ⚠ the decode overshoots full scale ({peak:.3f}) — scaling the whole take by 1/{peak:.3f}")
        x = x / peak
    return x, int(rate)


def find_onsets(x: np.ndarray, rate: int) -> list[int]:
    """Sample indices where a new note begins, in a take of isolated notes.

    Detects the RISE, not the level: a point qualifies when the smoothed envelope is
    `ONSET_RISE_RATIO` times what it was `ONSET_LOOKBACK_S` earlier. See the constants for why an
    absolute threshold was tried first and does not work on a take with this much level swing.

    The only absolute term is `ONSET_FLOOR`, and it is doing a different job: room noise rises by
    large ratios all the time because it starts near zero, so something has to say "this is not a
    kanun". It is set low enough to admit the quietest note in the take with room to spare.
    """
    w = max(1, int(rate * 0.010))
    smooth = np.convolve(np.abs(x), np.ones(w) / w, mode="same")
    floor = float(smooth.max()) * ONSET_FLOOR

    look = int(ONSET_LOOKBACK_S * rate)
    gap = int(MIN_ONSET_GAP_S * rate)
    step = max(1, int(rate * 0.002))

    onsets: list[int] = []
    for i in range(look, len(smooth), step):
        if smooth[i] < floor or smooth[i] < smooth[i - look] * ONSET_RISE_RATIO:
            continue
        if onsets and i - onsets[-1] < gap:
            continue
        # ⚠ Back up to where the note actually starts. The trigger fires part-way up the attack by
        # construction — it needs to see the rise before it can call it one — and a pluck cut after
        # its transient is a different instrument. The quietest moment in the lookback window is the
        # silence the pluck broke, and taking the minimum rather than walking down the slope is what
        # makes this robust to a decay that ripples on its way down.
        back = i - look
        j = back + int(np.argmin(smooth[back : i + 1]))
        onsets.append(max(0, j - int(PREROLL_S * rate)))
    return onsets


def split_take(inst: Instrument, src: Path) -> list[tuple[np.ndarray, int]]:
    """Cut the take into one segment per note.

    Nothing is written here — `--analyse` has to be able to run the whole measurement without
    touching the disk, which is also what lets the chromatic check veto a bad split before it can
    produce files.
    """
    x, rate = decode_take(src)
    onsets = find_onsets(x, rate)
    print(f"  {len(x) / rate:.1f}s take at {rate} Hz → {len(onsets)} onsets")

    segments: list[tuple[np.ndarray, int]] = []
    for k, start in enumerate(onsets):
        # Up to the next onset: a segment must never carry the head of the note after it, or the
        # sample would re-articulate in the middle of a held note. The decay is trimmed later, by
        # `endS` at playback, rather than here — same discipline as the VSCO files.
        stop = onsets[k + 1] if k + 1 < len(onsets) else len(x)
        segments.append((x[start:stop].copy(), rate))
    return segments


def select_chromatic_run(
    inst: Instrument, rows: list[Measured], segments: list[tuple[np.ndarray, int]]
) -> tuple[list[Measured], list[tuple[np.ndarray, int]]]:
    """Keep the longest chromatic run among the candidate segments, and drop whatever is not in it.

    ⚠ **This is a structural filter, and the alternatives were tried and are worse.** A take of
    isolated notes is not only notes: this one opens with two quiet events before the run starts —
    at 132 Hz and at something with no stable pitch at all — which are not part of "all chromatic
    tones within the range" and would land in the manifest as two extra voices' worth of nonsense.

    Filtering them by LEVEL would be arbitrary. Filtering them by how harmonic they are looks
    principled and is wrong: measured over the whole take, the two intruders score 72% and 9%, but
    the genuine bottom note (F3) scores 61% — low notes are inharmonic, so any threshold that
    excludes the noise also excludes the real note it is quietest next to.

    What actually separates them is the thing the source promises: the notes form a chromatic run.
    Membership in that run is the criterion, so nothing is dropped for being quiet or unusual — only
    for not being part of the sequence the recording is of.
    """
    cents = [
        1200 * float(np.log2(b.hz / a.hz))
        if np.isfinite(a.hz) and np.isfinite(b.hz) and a.hz > 0 and b.hz > 0
        else float("nan")
        for a, b in zip(rows, rows[1:])
    ]

    def good(step: float, direction: int) -> bool:
        return abs(direction * step - 100.0) <= CHROMATIC_TOLERANCE_CENTS

    best = (0, 0)  # (start, length in notes)
    for direction in (-1, 1):
        start = 0
        for i in range(len(cents) + 1):
            if i == len(cents) or not good(cents[i], direction):
                if i + 1 - start > best[1]:
                    best = (start, i + 1 - start)
                start = i + 1
    start, length = best
    kept = rows[start : start + length]

    if length < len(rows):
        dropped = rows[:start] + rows[start + length :]
        print(
            f"  dropped {len(dropped)} segment(s) outside the run: "
            + ", ".join(f"{m.name.split('_')[1]} ({note_name_of(m.hz)}, peak {m.peak:.2f})" for m in dropped)
        )
    return kept, segments[start : start + length]


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

    # ⚠ **The octave check, and it is not theoretical** — it is why the kanun's D6 stopped being read
    # as D4. A period of 4·T fits a periodic signal just as well as T does, so YIN's first dip below
    # threshold is sometimes a SUBharmonic, and on a plucked note whose fundamental is weak against
    # its partials that is exactly what happens. Measured on the take: the true D6 dip (tau/4) scored
    # 0.1045 against the subharmonic's 0.0798 — only 1.3× worse, so "first below 0.1" took the wrong
    # one. On genuinely correct reads the divisor dips are 19-46× worse, so the two cases are not
    # close together and this factor has enormous margin on both sides.
    #
    # Divisors are checked SHORTEST FIRST because the error compounds: D6 also had a passable dip at
    # tau/2 (D5, 2.2× worse), and stopping there would have fixed one octave of a two-octave mistake.
    for d in (4, 3, 2):
        t = int(round(tau / d))
        if t >= tau_min and norm[t - 1] <= norm[tau - 1] * OCTAVE_TOLERANCE:
            tau = t
            break

    # Parabolic interpolation on the dip, so the answer is not quantised to whole samples — at
    # 44.1 kHz a whole-sample lag is already ~10 cents up in the violin's top octave.
    if 1 < tau < tau_max - 1:
        a, b, c = norm[tau - 2], norm[tau - 1], norm[tau]
        denom = a - 2 * b + c
        if abs(denom) > 1e-12:
            tau = tau + 0.5 * (a - c) / denom
    return float(rate / tau) if tau else None


# How far from YIN's answer the spectral refinement below may look. It is a REFINEMENT, not a second
# opinion: at half a semitone it can correct a stretched-partial bias but can never move the note to
# a different pitch, so YIN keeps sole responsibility for the octave.
REFINE_MAX_CENTS = 50.0

# How closely the refinement's several windows must agree before their answer replaces YIN's. Below a
# koma (22.6 cents), because a disagreement bigger than that is the size of the error being fixed.
REFINE_AGREEMENT_CENTS = 20.0

# When to look, in seconds after the attack. Past the transient (a pluck's first ~60 ms has no
# resolvable fundamental) and early enough to still be inside the shortest note in the set.
REFINE_AT = (0.10, 0.16, 0.24)


def refine_f0(x: np.ndarray, rate: int, start: int, f0: float) -> float:
    """Locate the fundamental precisely in the spectrum, given YIN's estimate of where it is.

    ⚠ **This exists because YIN reads a plucked string SHARP, and on this kanun it was a whole koma.**
    A real string is stiff, so its partials are stretched — `f_k > k·f0` — and a period-based
    estimator like YIN is pulled by the strong upper partials toward a period shorter than the true
    one. Measured across the take, YIN sat 22-23 cents above the actual fundamental on the bottom
    notes (F3, F#3), 6 cents at F#4/F#5 and 2 cents at E6: the bias tracks string thickness exactly
    as inharmonicity predicts. The owner heard it as the F# "missing the pitch" and not sounding like
    a kanun — a koma is 22.6 cents, so a microtonal accidental on those notes landed a whole comma
    out, which on this project is the difference between two different notes.

    The division of labour is the point: **YIN says which partial is the fundamental** (its
    normalised difference is what makes that robust, and a spectrum peak alone would happily pick the
    loudest partial instead), **and the spectrum says exactly where that partial is**. Neither is
    sound on its own here.
    """
    # Long enough to resolve the fundamental, short enough to stay inside a decaying note. Parabolic
    # interpolation on a Hann-windowed peak then gets well inside a koma, which is what this is for.
    n = min(16384, len(x) - start)
    if n < 4096 or not np.isfinite(f0) or f0 <= 0:
        return f0

    seg = x[start : start + n]
    spec = np.abs(np.fft.rfft(seg * np.hanning(n)))
    freqs = np.fft.rfftfreq(n, 1 / rate)

    span = 2 ** (REFINE_MAX_CENTS / 1200)
    lo = int(np.searchsorted(freqs, f0 / span))
    hi = int(np.searchsorted(freqs, f0 * span))
    if hi - lo < 3 or lo < 1 or hi >= len(spec) - 1:
        return f0

    pk = lo + int(np.argmax(spec[lo:hi]))
    a, b, c = spec[pk - 1], spec[pk], spec[pk + 1]
    denom = a - 2 * b + c
    offset = 0.5 * (a - c) / denom if abs(denom) > 1e-12 else 0.0
    return float((pk + offset) * rate / n)


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
    rise: float = 0.0  # plucked only: seconds from `attack` to the pluck's peak


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


def _second_attack(smooth: np.ndarray, rate: int, attack: float) -> float | None:
    """Time of a second, audible attack after `attack`, or None.

    Same rise test as `find_onsets`, with one addition that decides whether this is useful at all:
    the rise must land above `RE_ATTACK_FLOOR` of the file's peak. Without it, a decayed tail
    fluctuating near the noise floor clears any ratio test trivially.
    """
    look = int(ONSET_LOOKBACK_S * rate)
    floor = float(smooth.max()) * RE_ATTACK_FLOOR
    start = int((attack + RE_ATTACK_AFTER_S) * rate)
    for i in range(max(start, look), len(smooth), max(1, int(rate * 0.002))):
        if smooth[i] >= floor and smooth[i] > smooth[i - look] * RE_ATTACK_RATIO:
            return i / rate
    return None


def measure_array(
    x: np.ndarray, rate: int, name: str, label: str, *, plucked: bool = False, fmin: float = 60.0
) -> Measured:
    """Fundamental, level and the three time points of one note.

    Takes audio rather than a path because the kanun's notes never exist as files until after they
    have been measured — the chromatic check has to be able to veto a split before anything is
    written.
    """
    seconds = len(x) / rate
    rise = 0.0
    env = np.abs(x)

    w = max(1, int(rate * 0.010))
    smooth = np.convolve(env, np.ones(w) / w, mode="same")

    # The level everything else is relative to. ⚠ A sustained note has a body to take a median of; a
    # PLUCKED note does not — it is loudest at the start and decays from there, so the median of its
    # middle is just a point on the way down, and thresholds built on it would drift with the length
    # of the segment. Its own peak is the stable reference.
    ref = (
        float(smooth.max())
        if plucked
        else float(np.median(smooth[int(len(smooth) * 0.25) : int(len(smooth) * 0.75)]))
    ) or 1e-9

    audible = np.nonzero(smooth >= ref * ONSET_FRACTION)[0]
    attack = float(audible[0]) / rate if len(audible) else 0.0

    if plucked:
        # ⚠ **A pluck's attack is the RISE, not the first sound, and the difference was audible.**
        # "First sample above 2% of the peak" is right for a note that begins when the recording
        # begins; it is wrong for a note cut out of a longer take, where what comes first is whatever
        # was still going on. `kanun_17_Cs5.wav` opens with 70 ms of something else (reading 162-180
        # Hz, 30% harmonic), then a quiet pre-ring, and only plucks at 180 ms — so a 16th note
        # starting at the old 29 ms played the junk and stopped just as the kanun spoke. The owner
        # heard it as the note "sounding like nothing" (2026-08-14).
        #
        # So: find the pluck's peak, then walk back to the last moment it was still quiet. That is
        # scale-free and needs no threshold on the junk itself — which matters, because the junk is
        # 7% of the peak here and any fixed floor low enough to ignore it would clip real attacks.
        #
        # ⚠ The peak is searched only up to a SECOND attack, if there is one: where the player struck
        # twice, the later strike can be the louder, and walking back from that would skip the note
        # entirely.
        again = _second_attack(smooth, rate, attack)
        limit = int(again * rate) if again is not None else len(smooth)
        pk = int(np.argmax(smooth[:limit])) if limit > 1 else int(np.argmax(smooth))
        quiet = np.nonzero(smooth[: pk + 1] <= smooth[pk] * PLUCK_ATTACK_FRACTION)[0]
        attack = float(quiet[-1]) / rate if len(quiet) else attack
        ref = float(smooth[pk]) or 1e-9
        # How long after `attack` the note actually arrives — measured as reaching HALF the pluck's
        # peak, not the peak itself. ⚠ Time-to-peak was the first attempt and it measures the wrong
        # thing: a low note's pluck has a broad top (F3 sits at 72% from 170 ms and peaks at 230),
        # so it read 90 ms on notes whose attack was perfectly placed. Time-to-half is 15-18 ms on
        # every sample here, against 160 ms for the mis-set attack that started this — which is the
        # separation a guard needs.
        loud_at = np.nonzero(smooth[int(attack * rate) : pk + 1] >= smooth[pk] * 0.5)[0]
        rise = float(loud_at[0]) / rate if len(loud_at) else pk / rate - attack

    # The fundamental is a median over several windows, never one measurement — a violin's vibrato
    # swings ±30 cents on its own.
    window = 4096
    if plucked:
        # ⚠ Taken just AFTER the attack, not from the middle of the file. A pluck is loudest where it
        # starts and its pitch is most reliable there; the fixed fractions used for a sustain would
        # land in the decay, where a kanun's upper partials outlast the fundamental and YIN begins
        # voting for the octave above.
        base = int(attack * rate)
        starts = [base + int(rate * t) for t in (0.03, 0.06, 0.10, 0.15, 0.25)]
    else:
        starts = [int(len(x) * f) for f in (0.30, 0.40, 0.50, 0.60, 0.70)]
    heard = [
        (s, f0)
        for s in starts
        if s >= 0 and s + window <= len(x)
        for f0 in [yin_f0(x[s : s + window], rate, fmin=fmin)]
        if f0
    ]
    hz = float(np.median([f0 for _, f0 in heard])) if heard else float("nan")

    # ⚠ Two stages for a PLUCK, one for anything else, and the restriction is not caution — it was
    # measured. `refine_f0` corrects a stiff-string bias that only a plucked note has, and applying
    # it to the violin made things worse: `Arco Vib` swings ±30 cents, so a spectral peak is not a
    # well-defined thing to find, and C7 moved from +4 to +26 cents off its label — the refinement
    # locking onto one moment of the vibrato instead of its centre, which YIN's median over several
    # windows already gets right.
    if plucked and heard and np.isfinite(hz):
        # ⚠ Measured AFTER the transient, on its own offsets rather than YIN's. A pluck's first
        # 60 ms is a broadband smear with no resolvable fundamental — F3 read 168 and 171 Hz there
        # against a true 173.7 — and including those windows made the agreement test below reject a
        # refinement that was right. YIN is unbothered by them, so it keeps its own earlier windows.
        refined = [
            refine_f0(x, rate, int((attack + t) * rate), hz)
            for t in REFINE_AT
            if int((attack + t) * rate) + 4096 <= len(x)
        ]
        if len(refined) >= 2:
            med = float(np.median(refined))
            spread = max(abs(1200 * float(np.log2(v / med))) for v in refined)
            # ⚠ **The refinement must agree with itself before it is believed.** It reads the
            # FUNDAMENTAL, which on the kanun's top notes is weak — D#6's h1 is 6× quieter than its
            # second partial — and hunting a weak peak returns noise: its windows answered 1220,
            # 1247, 1247, whose median pulled the note 15 cents flat and showed up as a 68-cent step
            # on one side and 148 on the other. Where the fundamental IS strong the same windows
            # agree within a few cents (F#3: 183.7-184.1). So agreement is the evidence that there
            # was a peak to find at all; without it, YIN's period estimate stands.
            if spread <= REFINE_AGREEMENT_CENTS:
                hz = med

    if plucked:
        # `end` means something different for a pluck — see PLUCK_FLOOR. The note is over when it has
        # run out, not when a player releases it.
        ringing = np.nonzero(smooth >= ref * PLUCK_FLOOR)[0]
        end = float(ringing[-1]) / rate if len(ringing) else seconds
        end = min(end, seconds - RELEASE_MARGIN_S)

        # ⚠ **A sample must contain exactly ONE attack.** The player struck some strings twice, so a
        # couple of these segments have a second pluck inside them — and with `endS` past it, holding
        # a long note re-articulates halfway through, which is a sound no player made. Ending the
        # note before the second attack is the whole fix: the recording keeps it, the playback never
        # reaches it. ⚠ The floor matters as much as the ratio here — a first attempt without it
        # "found" a second attack in 9 files, but 8 were fluctuations in a tail that had already
        # decayed to nothing (their pitch at that moment measured as noise, not as the note).
        second = _second_attack(smooth, rate, attack)
        if second is not None:
            end = min(end, second - RELEASE_MARGIN_S)
        # ⚠ **A pluck's transient IS the instrument.** `_tone_onset` measures how long a sound takes
        # to BECOME tonal, which is a real question for a clarinet's breath and a violin's bow
        # scrape and a meaningless one here: skip a kanun's attack and what is left is an organ.
        # Setting `tone == attack` also makes `preTone` zero in `scheduleSampledNote`, so every
        # kanun note, of every length, starts at the pluck — no change needed on the app side.
        tone = attack
    else:
        loud = np.nonzero(smooth >= ref * 0.9)[0]
        end = float(loud[-1]) / rate - RELEASE_MARGIN_S if len(loud) else seconds
        tone = _tone_onset(x, rate, hz, attack, end, smooth, ref) if hz == hz else attack

    return Measured(
        name=name,
        label=label,
        hz=hz,
        attack=attack,
        tone=tone,
        end=end,
        rise=rise,
        peak=float(env.max()),
        # ⚠ Robust, not maximum: one bow-transient sample should not duck the whole instrument. The
        # true peak still governs the clip clamp below, so this can only ever make it louder within
        # a guarded ceiling.
        robust=float(np.percentile(env, 99.9)),
        seconds=seconds,
    )


def measure(path: Path, label: str, *, plucked: bool = False, fmin: float = 60.0) -> Measured:
    """`measure_array` for a file on disk — the copy path's entry point."""
    x, rate = read_mono(path)
    return measure_array(x, rate, path.name, label, plucked=plucked, fmin=fmin)


# ---------------------------------------------------------------------------- reporting


def check_window(inst: Instrument, m: Measured, problems: list[str]) -> None:
    """The two per-note sanity checks both acquisition paths share."""
    # ⚠ The floor depends on the physics, not on taste. A sustained note is expected to outlast any
    # notated note, so a short window means the measurement found a tone that is barely there. A
    # PLUCKED note cannot outlast anything — it decays and dies, which is the instrument working
    # correctly — so the only question for it is whether there is enough sound to be a note at all.
    floor = 0.8 if inst.plucked else 2.0
    if m.end - m.tone < floor:
        problems.append(
            f"{inst.voice_id}: {m.name} has only {m.end - m.tone:.1f}s of sound "
            f"(tone {m.tone * 1000:.0f} ms, end {m.end:.1f}s) — check it by ear"
        )
    if not (m.attack <= m.tone < m.end):
        problems.append(
            f"{inst.voice_id}: {m.name} time points are out of order "
            f"(attack {m.attack:.3f}, tone {m.tone:.3f}, end {m.end:.3f})"
        )
    # ⚠ The guard against the bug the owner heard on 2026-08-14: a note whose `attack` sits well
    # before its pluck plays whatever the take was doing beforehand, and a 16th note can be over
    # before the instrument speaks at all. `kanun_17_Cs5.wav` had 150 ms of that.
    if inst.plucked and m.rise > PLUCK_RISE_MAX_S:
        problems.append(
            f"{inst.voice_id}: {m.name} takes {m.rise * 1000:.0f} ms to reach its pluck from "
            f"`attack` — a short note would be over before the note arrives"
        )


def report_chromatic(inst: Instrument, rows: list[Measured]) -> list[str]:
    """The split path's control: the measured pitches must be an ascending chromatic run.

    ⚠ This is the whole reason a split can be trusted. A splitter that misses an onset, or fires
    twice inside one note, produces a table that looks perfectly reasonable file by file — every
    note is in tune with itself, every level is sane. Only the RELATIONSHIP between neighbours shows
    the mistake, and only because the source says what that relationship should be.
    """
    problems: list[str] = []
    print(f"  {'#':>3} {'note':>7} {'measured':>10} {'step':>7} {'peak':>6} {'sec':>6} {'window':>7}")

    steps = [
        1200 * float(np.log2(b.hz / a.hz)) if np.isfinite(a.hz) and np.isfinite(b.hz) else float("nan")
        for a, b in zip(rows, rows[1:])
    ]
    # ⚠ The direction is read off the take, not assumed. This one descends — E6 down to F3 — and a
    # check hard-coded to "ascending" would have called all 35 of its steps wrong.
    direction = -1 if np.nanmedian(steps) < 0 else 1

    bad = 0
    for i, m in enumerate(rows):
        step = steps[i - 1] if i else float("nan")
        # ⚠ A step that cannot be computed counts as bad, never as fine. A silent segment or a failed
        # pitch read would otherwise sail through on `nan` comparing false against every threshold.
        off = i > 0 and not (abs(direction * step - 100.0) <= CHROMATIC_TOLERANCE_CENTS)
        bad += 1 if off else 0
        print(
            f"  {int(m.name.split('_')[1]):>3} {note_name_of(m.hz):>7} {m.hz:9.1f}Hz "
            f"{'      —' if i == 0 else f'{step:+6.0f}c'} {m.peak:6.2f} {m.seconds:6.1f} "
            f"{m.end - m.tone:6.1f}s{' ✗' if off else ''}"
        )
        check_window(inst, m, problems)

    hzs = [m.hz for m in rows if np.isfinite(m.hz)]
    span = hz_to_midi(max(hzs)) - hz_to_midi(min(hzs)) if hzs else float("nan")
    print(
        f"  range: {note_name_of(min(hzs))} — {note_name_of(max(hzs))} "
        f"({len(rows)} notes {'descending' if direction < 0 else 'ascending'}, {span:.1f} semitones)"
    )
    print(
        f"  chromatic check: {len(rows)} notes, {bad} step(s) outside "
        f"100 ± {CHROMATIC_TOLERANCE_CENTS:.0f} cents"
    )
    if bad:
        problems.append(
            f"{inst.voice_id}: {bad} step(s) are not a semitone — the split is wrong, not the "
            f"instrument. A ~200c step means a missed onset, ~0c means one note cut in two, and a "
            f"negative step means the take is not the ascending chromatic run it claims to be."
        )
    return problems


def report(inst: Instrument, rows: list[Measured]) -> tuple[int, float, list[str]]:
    """Print the measurement table and return (label offset, gain, problems)."""
    problems: list[str] = []

    if inst.take:
        # No filenames to distrust on this path — the pitches came out of a measurement in the first
        # place. What needs checking is the SPLIT, so the control is the chromatic run.
        problems += report_chromatic(inst, rows)
        gain, found = levels(inst, rows)
        return 0, gain, problems + found

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
        check_window(inst, m, problems)
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

    gain, found = levels(inst, rows)
    return offset, gain, problems + found


def levels(inst: Instrument, rows: list[Measured]) -> tuple[float, list[str]]:
    """Playback gain and the coverage check — shared by both acquisition paths."""
    problems: list[str] = []

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
        # ⚠ On the split path it means something else and is expected to be larger: one take of a
        # whole range, played by hand, is not levelled the way a sampling session is. It is still
        # worth printing — the quiet end is still the end to listen to.
        print(f"  ⚠ peak spread across the layer is {spread_db:.0f} dB — check the quiet files by ear")

    # The gap that sets the worst playbackRate shift `pickSample` will ever make.
    midis = sorted(hz_to_midi(m.hz) for m in rows)
    gaps = [b - a for a, b in zip(midis, midis[1:])]
    worst = max(gaps) if gaps else 0.0
    print(f"  widest gap: {worst:.1f} semitones → worst shift ±{worst / 2:.1f} semitones")
    if worst > MAX_GAP_SEMITONES + 0.6:
        problems.append(f"{inst.voice_id}: a {worst:.1f}-semitone gap needs more pitches, not more stretch")

    return gain, problems


def midi_to_name(midi: int) -> str:
    names = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
    return f"{names[midi % 12]}{midi // 12 - 1}"


def note_name_of(hz: float) -> str:
    """`midi_to_name` for a measured frequency, surviving a failed measurement.

    YIN returns nothing when it cannot find a fundamental, and on the split path that is a real
    possibility — a segment might be silence between two notes rather than a note. Naming it
    "unknown" keeps the table readable and lets the chromatic check be the thing that fails.
    """
    if not np.isfinite(hz) or hz <= 0:
        return "unknown"
    return midi_to_name(int(round(hz_to_midi(hz))))


# ---------------------------------------------------------------------------- writing


def staged_name(inst: Instrument, index: int, hz: float) -> str:
    """The filename one SPLIT note ships under.

    ⚠ Generated, not provenance — the opposite of the copy path, and for a plain reason: the note
    did not exist as a file before this script cut it out, so there is no original name to preserve.
    The index keeps it traceable to its position in the take; the note name is MEASURED.

    ⚠ No `#`, deliberately. `A#2` cost the clarinet three of its eleven samples to a URL that
    truncated at the fragment marker, before `loadInstrument.ts` learned to escape per path segment.
    That name had to be kept because it was the library's. This one does not, so it spells the sharp
    `s` and the whole class of bug cannot come back on this path.
    """
    return f"{inst.voice_id}_{index:02d}_{note_name_of(hz).replace('#', 's')}.wav"


def write_note(dest: Path, x: np.ndarray, rate: int) -> None:
    """Write one split note as 16-bit mono PCM.

    ⚠ 16 bits and not 24. The source is a 160 kbps mp3, whose noise floor sits far above what 16 bits
    resolve — more bits would store the encoder's artefacts more precisely and nothing else, at twice
    the download. And PCM rather than any encoder at all: the decode happens once, and what ships is
    that decode (see the module docstring).
    """
    wavfile.write(dest, rate, (np.clip(x, -1.0, 1.0) * 32767.0).astype(np.int16))


def stage_split(
    inst: Instrument, rows: list[Measured], segments: list[tuple[np.ndarray, int]], src: Path
) -> tuple[int, list[str]]:
    """Write the split notes into the upload folder, and return (bytes, problems).

    ⚠ **The copy path's sha256 identity check has no meaning here and is not faked.** A file cut out
    of a longer take is a new file; comparing it to its source would compare a note to two minutes of
    music. What stands in its place is the SOURCE take's hash, printed with the manifest, so the
    derivation is reproducible: same take, same script, same notes.
    """
    out_dir = OUT_ROOT / inst.voice_id
    out_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    for m, (seg, rate) in zip(rows, segments):
        dest = out_dir / m.name
        write_note(dest, seg, rate)
        written += dest.stat().st_size
    print(f"  staged {len(rows)} files, {written / 1e6:.1f} MB → {out_dir.relative_to(REPO)}")
    print(f"  ⚠ DERIVED from {src.name} (sha256 {sha256(src)[:16]}…) — not byte copies")
    return written, []


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
        print(f'    license: "{inst.license}",')
        print(f'    credit: "{inst.credit}",')
        if inst.plucked:
            # Emitted so the app and the tests can tell a decaying voice from a sustaining one
            # without inferring it from the numbers. `voices-test.ts` uses it to pick which window
            # bound applies — a pluck cannot cover a long note and must not be asked to.
            print(f"    plucked: true,")
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
        take = take_path(inst) if inst.take else None
        if take is not None:
            # ⚠ The source hash comes FIRST on this path, because it is the one that makes the
            # derivation checkable. The per-file hashes below it identify what shipped; only this
            # one says what it was made from.
            print(f"# {inst.voice_id}: derived from {inst.take} — {inst.take_url}")
            print(f"#   source sha256: {sha256(take)}")
        for m in rows:
            path = (OUT_ROOT if inst.take else CACHE) / inst.voice_id / m.name
            if not path.exists():
                print(f"#   (not staged yet: {inst.voice_id}/{m.name} — run without --manifest first)")
                continue
            print(f"{sha256(path)}  {inst.voice_id}/{m.name}")


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
        rows: list[Measured] = []
        segments: list[tuple[np.ndarray, int]] | None = None
        src: Path | None = None

        if inst.take:
            src = take_path(inst)
            if src is None:
                print(f"\n{inst.voice_id} — SKIPPED: {inst.take} is not downloaded")
                problems.append(missing_take(inst))
                continue
            print(f"\n{inst.voice_id} — splitting {inst.take}")
            segments = split_take(inst, src)
            for i, (seg, rate) in enumerate(segments):
                m = measure_array(seg, rate, "", "", plucked=inst.plucked, fmin=inst.fmin)
                # Named only now: the name carries the measured pitch, so it cannot exist before the
                # measurement does. That ordering is the point — nothing on this path is ever read
                # back off a filename.
                m.name = staged_name(inst, i, m.hz)
                rows.append(m)
            # ⚠ Numbered by position in the TAKE, above, and only then filtered — so the surviving
            # names still say where in the recording each note came from, and a gap in the numbering
            # is a visible record of what was dropped rather than a silent renumbering.
            rows, segments = select_chromatic_run(inst, rows, segments)
        else:
            print(f"\n{inst.voice_id} — {len(inst.files)} files")
            for name in inst.files:
                path = fetch(inst, name)
                # The label the FILENAME claims, which is the thing under test. Both libraries happen
                # to put it in the third underscore-separated field.
                rows.append(measure(path, name.split("_")[2], plucked=inst.plucked, fmin=inst.fmin))

        offset, gain, found = report(inst, rows)
        problems += found
        built.append((inst, rows, offset, gain))

        if not (args.analyse or args.manifest):
            if segments is not None and src is not None:
                written, found = stage_split(inst, rows, segments, src)
            else:
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
