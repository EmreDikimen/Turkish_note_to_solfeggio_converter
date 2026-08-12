# Audio sources — the verified files, and what each one still needs

purpose: the per-file source + licence list for F1/F2 audio, verified on each source's own page
audience: whoever downloads, prepares or audits an audio asset
updated: 2026-08-11

The rules these files must obey (no bundling, a `source`+`license` per file, `/THIRD-PARTY.txt` as
each lands) are in [README.md](README.md#the-swap-discipline--required-whatever-is-chosen). This
file is the shortlist that search produced, checked on 2026-08-09.

Every licence below was read **on the source's own page**, not on an aggregator. Nothing has been
downloaded yet.

✅ **F2's files are IN as of 2026-08-11** — the darbuka and frame-drum rows below are downloaded,
prepared and shipping. What was taken from each, and the mapping problem that had to be solved
first, is the section immediately below. Everything else here is still a shortlist for F1.

⚠ **Neither Freesound file was needed after all.** The plan expected the CompMusic bendir take
(140291) to be F2's Turkish-stroke source and warned that its download is manual, needing a free
account. VCSL's frame drum covered it from GitHub with no account, so 140291 is **deferred, not
rejected** — it is a real bendir played by a named performer with Turkish strokes, which is a better
provenance than a general frame-drum library, and it is the obvious upgrade if the bendir kit ever
sounds wrong. 211133 (kanun) remains F1's.

## Cleared — CC0, usable commercially, forever

| For | Source | Licence | What is in it |
|---|---|---|---|
| **Darbuka** (F2) | VCSL `Membranophones/Struck Membranophones/Darbuka` | CC0 1.0 | 20 wav = **5 hit types × 2 velocities × 2 round-robins**, 2.5 MB |
| **Tef / bendir** (F2) | VCSL `Frame Drum` | CC0 1.0 | 18 wav — large + small drum × open hit / muted hit / hand |
| **Tef with jingles** (F2) | VCSL `Tambourine 1` | CC0 1.0 | hit ×2, shake ×2, roll ×3 |
| **Zil** (F2) | VCSL `Finger Cymbals` | CC0 1.0 | 1 wav |
| **Bendir, Turkish strokes** (F2) | [Freesound 140291](https://freesound.org/people/barisbozkurt/sounds/140291/) `bendir_basicStrokes.wav` | CC0 | 3.28 s wav 44.1 kHz — *"basic strokes on a bendir: düm and tek"*, played by Eren Ergen, collected under **CompMusic** (UPF) |
| **Clarinet** (F1) | VSCO 2 CE `Woodwinds/Clarinet` | CC0 1.0 | 97 wav — `susLong` = **11 pitches D2–F♯5** × 3 velocities, plus 64 staccato |
| **Violin** (F1) | VSCO 2 CE `Strings/Solo Violin` | CC0 1.0 | 292 wav — `Arco Vib` = **15 pitches A3–C7** × f/p; also Pizz 44, Trem 27, spic 60 |
| **Kanun** (F1) | [Freesound 211133](https://freesound.org/people/barisbozkurt/sounds/211133/) `kanun_moderate_Chromatic_moreIsolated.mp3` | CC0 | 2:02 mono mp3 160 kbps — *"all chromatic tones within the range of the instrument"*, isolated, CompMusic |

- **VCSL** — <https://github.com/sgossner/VCSL>, `LICENSE` is the CC0 1.0 legalcode; the README
  says *"you can do whatever you want with these sounds (even make commercial software), no
  royalties, no credit, no special terms"*, and contributions are CC0 too. The repo holds raw
  `.wav` (4,231 files), so a single folder can be pulled by URL — the 5 GB SFZ download is not
  needed.
- **VSCO 2 CE** — <https://github.com/sgossner/VSCO-2-CE>, `LICENSE` is CC0 1.0.

⚠ **VSCO 2 CE contradicts itself, and the resolution is recorded here so it is not re-litigated.**
Its `Readme.txt` "Terms" asks *"that you do not sell the samples directly"* and *"Please provide
credit to Versilian Studios/Sam Gossner, and/or Ivy Audio/Simon Dalzell where applicable"* — neither
is compatible with the CC0 file beside it. Read: **CC0 governs** (it is irrevocable once applied)
and the readme is a request. Practical response: take **clarinet and solo violin**, which are
Versilian's own VSCO 2 recordings; **credit anyway** in `/THIRD-PARTY.txt`, since it costs one line;
and **avoid the v1.1 "legacy" / Ivy Audio piano material**, where the provenance is mixed and the
"where applicable" is doing real work.

⚠ **On Freesound, CC0 is the uploader's claim.** These two are trusted because of who made them:
research recordings from the CompMusic project at Universitat Pompeu Fabra, by a Turkish makam
researcher, with the performer named. A random upload of a commercial-sounding loop tagged CC0 does
not get the same benefit. Downloading needs a free Freesound account — a manual step, not a script.

## What F2 actually took, and how the düm was identified ✅ 2026-08-11

Produced by **`scripts/prepare_strokes.py`** (`--analyse` to see the measurements without writing).
Never edit a file under `apps/web/public/audio/` by hand — re-run the script.

| Kit | düm | tek | ka |
|---|---|---|---|
| **darbuka** | `Darbuka_1_hit_vl2_rr{1,2}` | `Darbuka_2_hit_vl2_rr{1,2}` | `Darbuka_3_hit_vl2_rr{1,2}` |
| **bendir** | `HDrumL_Hit_v3_rr{1,2}` | `HDrumS_HitMuted_v3_rr{1,2}` | `HDrumL_HitMuted_v3_rr{1,2}` |

**The problem was that VCSL's darbuka files are numbered, not named** — nothing says which of the
five hit types is the open centre stroke. So each is *measured* (energy below 200 Hz, spectral
centroid, decay to −40 dB) and the mapping follows the physics: a düm is the whole head moving, so
it is low and rings; a tek is a fingertip on the rim, so it is bright and over instantly.

**The frame drum is the control that makes the darbuka result trustworthy.** Its files *are*
self-describing, so the same measurement ran against a known answer — and agreed. Without that the
darbuka mapping would be a plausible guess with nothing behind it. `--analyse` prints the agreement
line on every run; if it ever says DISAGREE, the metric has drifted and the darbuka mapping is no
longer supported.

Two findings that listening to the file names would have got wrong:

- ⚠ **Both `Hand` articulations are unusable** — they peak at −57 dB (large drum) and −62 dB (small),
  40+ dB under the struck takes. That is VCSL's session, not a dynamic. The natural-looking mapping
  (`Hand` → tek, since a tek is played with the hand) would have produced an inaudible tek, and
  lifting one to a usable level lifts its noise floor with it.
- ⚠ **The source levels are overridden, not preserved.** Inheriting them sounds respectful and is
  not, when articulations sit 40 dB apart. The three strokes are levelled to **0.50 / 0.35 / 0.19** —
  the *ratios* the owner tuned by ear on the synthesised version — with the round-robins of one
  stroke sharing a factor, since per-file normalisation would turn the alternation into a volume
  wobble.
- ⚠ **Those were 0.89 / 0.62 / 0.34 for a few hours and the drum audibly clipped** (owner:
  *"darbukanın sesi biraz patlamış"*). The files were never clipped; the **sum** was. A note is a
  normalised wave at gain 1.0 into the same master, so a note plus a 0.89 düm reached 1.61 at a
  destination that hard-clips at 1.0 — 38% of the waveform flattened at the *default* slider
  position. The level that was safe for a synthesised blip is **not** safe for a sample with a
  body that sustains. **Do not raise these to make the drum louder**; `Vuruş sesi` is for that, and
  a 15–24 dB crest factor means the peak drop cost far less loudness than it looks like.

Tails are cut at **700 ms** with a 25 ms fade (a darbuka düm rings 1.25 s, the bendir 2 s, nearly all
of it under the notes). Two kits come to **660 KB**; the fade prevents the click that cutting a
ringing drum at a non-zero sample would leave.

## Not licence work — what each file still needs before it plays

| File | Prep |
|---|---|
| ~~VCSL darbuka~~ | ✅ done — mapped by measurement, not by listening; see above |
| `bendir_basicStrokes.wav` | ⏸ deferred — **Split** the 3.28 s take into individual strokes at the onsets |
| `kanun_..._moreIsolated.mp3` | **Split** 2 minutes into per-note files at the onsets; it is **lossy mp3**, so re-encoding compounds — keep the decode once and trim |
| Clarinet / violin | Pick the sustain layer, **trim and loop**, convert to mono compressed. Raw folders are 66 MB and 235 MB of wav; what ships is a handful of notes |

Pitch coverage is fine for `playbackRate`: the clarinet sustains sit a **minor third** apart and the
violin's about the same, so the largest shift is **±1.5 semitones**. ⚠ Resampling also changes
*length* (~9% at that shift) — irrelevant for enveloped sustains, and percussion one-shots are never
shifted at all.

⚠ **A violin is not a kemençe.** It is a good stand-in and it is free; it must not be *labelled*
kemençe in the UI. Same for clarinet, which is genuinely a Turkish-repertoire instrument and can be
called one.

## The gaps, measured

Freesound CC0-filtered result counts, 2026-08-09:

| Instrument | CC0 hits | Verdict |
|---|---|---|
| darbuka | 43 | covered (VCSL is cleaner) |
| frame drum | 63 | covered |
| bendir | 10 | covered — 140291 is the good one |
| kanun | 4 | **solved** by 211133 |
| oud | 23 | `hammondman`'s `g2` / `a2` / `c3` single notes are CC0 by the filter (⚠ not verified on their own pages, quality unknown). Karplus–Strong stays the plan; this is the fallback |
| ney | 11 | **nothing usable** — phrases, unrelated recordings, and some outright junk |
| tanbur | 1 | one Uzbek field recording. Nothing |
| zurna | 0 | nothing |

**Ney is the gap the plan predicted, and it stands.** The owner's own recording remains the answer.
One free stopgap exists and it is **CC BY, not CC0**:
[Freesound 194637](https://freesound.org/people/ajaysm/sounds/194637/), *"Scale of Huzzam Makam"*
played on ney (32 s mp3, CompMusic / Galata Electroacoustic Orchestra, Genova 2013). A scale means
individual pitches can be cut out — enough for the "find one usable note" version F1 describes —
but it is one take, one makam, roughly an octave, and lossy. `xserra`'s `ney.wav` on Freesound is
also CC BY and is a phrase, not notes.

## What this changed in the plan

1. **Kanun no longer has to be Karplus–Strong.** [README.md](README.md) says oud/tanbur/kanun get
   K–S because no files exist; for kanun that is now false. K–S is still worth trying first — it is
   natively microtonal and costs no bytes — but there is a real recording of the real instrument to
   A/B it against, in an hour.
2. **CC BY was missing from the licence table** and that omission is exactly where ney lives. It is
   now a row in [README.md](README.md#four-categories--two-usable-two-not).
3. **No NC file is needed for anything being built first.** The 2026-08-09 decision hoped for that;
   it is now measured rather than hoped.
