# The kanun — one take, thirty-six notes

purpose: how F1's kanun was made, and the four measurement traps it walked into
audience: whoever adds another instrument from a single recording, or re-runs this one
updated: 2026-08-14

The per-file source and licence list for all audio is [audio-sources.md](audio-sources.md); the rules
those files obey are [audio-policy.md](audio-policy.md). This file covers only the kanun, because it
is the one voice this project **made** rather than copied, and everything hard about it follows from
that.

One CC0 take ([Freesound 211133](https://freesound.org/s/211133/), 2:02 mono 160 kbps, CompMusic /
UPF, played and uploaded by Barış Bozkurt) → **36 wav files, F3–E6, 9.9 MB**. Downloaded by hand:
Freesound serves only to a logged-in account, so `prepare_voices.py` reads it from
`data/audio_src/kanun/` and **skips the instrument with a message if it is absent**, rather than
making the two VSCO voices depend on it.

⚠ **This is the project's first DERIVED audio, and the copy path's central guarantee does not
survive the trip.** A file cut out of a longer take is a new file, so there is nothing to compare a
sha256 against. What replaces it is the **source take's** hash, recorded on the dataset card, so the
derivation is reproducible. Two claims changed wording because of it, both in the same commit: the
Hub card and `/THIRD-PARTY.txt` now say *which* folders are untouched instead of implying all are.

**Coverage is the best of the three voices**: every semitone across 35 semitones, so the worst
stretch `pickSample` ever makes is **±0.7 semitones** against the clarinet's ±2.5.

### The split is trusted because the run is chromatic, not because it looked right

The source promises *"all chromatic tones within the range"*, and that promise is the control — the
same role the violin played for the clarinet's octave and the frame drum for the darbuka's numbered
hits. A splitter fails in a way that is invisible file by file: every note is in tune with itself,
every level is sane, and only the **relationship between neighbours** shows a missed onset (~200
cents) or one note cut in two (~0 cents). `--analyse` prints that line and a bad split cannot reach
the manifest. It also **selects**: the longest chromatic run is what gets kept, which is how the two
events at the head of the take are excluded.

⚠ **Filtering those two by level or by harmonicity was tried and is wrong.** They are quiet (5% of
the loudest note) and one is only 72% harmonic — but the genuine bottom note F3 is **61%** harmonic,
so any threshold that rejects the intruders also rejects a real note. Low notes are inharmonic;
membership in the sequence is the only criterion that separates them.

### Four things measuring caught, two of them only after the owner listened

1. ⚠ **An absolute onset threshold cannot split this take.** It found 22 of 38 notes: the recording
   swings **7:1** end to end (peak envelope 0.02 → 0.40 → 0.05 in 5-second buckets) because it is one
   player working down the range, not a levelled sampling session. Detecting the **rise** — each
   moment against its own recent past — is scale-free and finds all of them.
2. ⚠ **YIN read D6 as D4.** A period fits a subharmonic as well as the fundamental, so the first dip
   below threshold is sometimes 4× too long. The true dip scored **1.3×** the subharmonic's, while
   correct reads score **19–46×** — not a close call, so an octave check with a 2× tolerance fixes it
   with margin on both sides.
3. ⚠ **YIN reads a plucked string SHARP, and it was a whole koma.** Stiff strings stretch their
   partials, so a period-based estimate is pulled above the fundamental: **22–23 cents at F3/F♯3**,
   6 at F♯4/F♯5, 2 at E6 — the bias tracks string thickness exactly as inharmonicity predicts. At
   22.6 cents to the koma, that put microtonal accidentals on the wrong comma, which is what the
   owner heard as the F♯ "not sounding like a kanun". Fixed by letting **YIN choose the partial and
   the spectrum say where it is**. ⚠ Plucked only: the same refinement moved violin C7 by 22 cents,
   because `Arco Vib` swings ±30 and has no single peak to find. ⚠ And it must agree with itself
   across windows before it is believed — on D♯6 the fundamental is 6× quieter than its second
   partial, and hunting a weak peak returned 1220/1247/1247.
4. ⚠ **A pluck's attack is the RISE, not the first sound.** `attackS` was "first sample above 2% of
   peak", which is right for a file that begins when its note begins and wrong for one cut out of a
   take: `kanun_17_Cs5.wav` opens with **150 ms of something else** (162–180 Hz, 30% harmonic) before
   its pluck at 180 ms, so a 16th note played the junk and stopped as the kanun spoke. It now finds
   the pluck's peak and walks back to the last moment under 10% of it — no threshold on the junk
   itself, which matters because the junk here is 7% of peak. It moved 20 of 36 samples.

Both ear-found bugs now have guards that fail the run: `hz` must survive the spread test, and each
sample must reach **half its peak within 60 ms** of `attackS` (measured: 15–18 ms on every sample;
the broken C♯5 took 160). ⚠ That guard's own first version was wrong — time-to-*peak* failed four
correct samples, because a low pluck has a broad top (F3 sits at 72% from 170 ms and peaks at 230).

### Two decisions taken from measurements rather than taste

**The decay floor is −50 dB.** At −40 the tails were cut while the note still rang (A5's window
0.4 s against a real 1.6 s); at −60 it starts chasing the recording's hiss (E6 fills its whole
segment). The take's own noise floor is −62 dB, so −50 keeps 12 dB of margin.

**A sample must contain exactly one attack.** The player struck some strings twice, and with `endS`
past the second strike a held note re-articulates halfway through — a sound no player made. `endS`
now stops before it. ⚠ The first scan for this flagged 9 files and **8 were false**: fluctuations in
tails that had already decayed to nothing, which clear any ratio test because both sides are tiny.
Requiring the rise to land above 10% of the file's peak left the 2 real ones.
