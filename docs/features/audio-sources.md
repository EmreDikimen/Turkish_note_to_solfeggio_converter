# Audio sources — the verified files, and what each one still needs

purpose: the per-file source + licence list for F1/F2 audio, verified on each source's own page
audience: whoever downloads, prepares or audits an audio asset
updated: 2026-08-13

The rules these files must obey (no bundling, a `source`+`license` per file, `/THIRD-PARTY.txt` as
each lands) are in [audio-policy.md](audio-policy.md#the-swap-discipline--required-whatever-is-chosen). This
file is the shortlist that search produced, checked on 2026-08-09.

Every licence below was read **on the source's own page**, not on an aggregator. Nothing has been
downloaded yet.

✅ **F2's files are IN as of 2026-08-11** — the darbuka and frame-drum rows below are downloaded,
prepared and shipping. What was taken from each, and the mapping problem that had to be solved
first, is the section immediately below.

✅ **ALL THREE OF F1's VOICES ARE IN — clarinet and violin 2026-08-13, KANUN 2026-08-14.** What was
taken, what the measurements found, and how to upload them is the section
[What F1 actually took](#what-f1-actually-took--2026-08-13) below; the kanun has its own section
after it, because it arrived by a different route and taught different lessons. Ney is still empty
under CC0 and needs the owner's own recording; oud and tanbur are Karplus–Strong and need no files
at all.

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

⚠ **Sizes, measured 2026-08-11 rather than guessed.** Clarinet `susLong` is **33 files averaging
~1.8 MB** (11 pitches × 3 velocities); taking one velocity is **~20 MB**, and the whole folder ~59 MB.
Solo Violin `Arco Vib` is comparable. So **three instruments are 40–60 MB uncompressed**, which is
why they go to a Hub repo rather than shipping with the app ([../DECISIONS.md](../DECISIONS.md)) —
the app's whole dist is capped at 60 MB and already uses 43.4. ⚠ These files are **7–10 second
sustained notes**, not the ~2 s a sampler usually wants. That is a feature here: they outlast any
notated note, so **nothing needs looping**.

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
| ~~`kanun_..._moreIsolated.mp3`~~ | ✅ done 2026-08-14 — split at the onsets, decoded once, never re-encoded; see the kanun section below |
| Clarinet / violin | Pick the sustain layer, **trim and loop**, convert to mono compressed. Raw folders are 66 MB and 235 MB of wav; what ships is a handful of notes |

⚠ **This "minor third apart, so ±1.5 semitones" figure was WRONG and is kept only to mark the
correction.** Measured 2026-08-13: the clarinet steps D–F–A#–D, and F→A# is a *perfect fourth*, so
its widest gap is **5 semitones** and the worst shift is **±2.5**. The violin's widest is 4.3
(C→E plus real intonation). Planning had also independently guessed ±2 by miscounting the same
interval. The real bound is now asserted in `tools/audio/voices-test.ts` rather than written in
prose. Resampling also changes *length* (~12% at ±2.5 semitones) — irrelevant for sustains that
outlast the note anyway, and percussion one-shots are never shifted at all.

⚠ **A violin is not a kemençe.** It is a good stand-in and it is free; it must not be *labelled*
kemençe in the UI. Same for clarinet, which is genuinely a Turkish-repertoire instrument and can be
called one.

## What F1 actually took — 2026-08-13

Produced by **`scripts/prepare_voices.py`** (`--analyse` to measure without writing, `--manifest` to
print the TypeScript block for `apps/web/src/audio/instruments.ts`). ⚠ Unlike the drums, these files
are **copied, not prepared**: no trim, no fade, no downmix, no resample, no re-level. `write()` is a
byte copy followed by a **sha256 comparison against the source**, and a mismatch is a hard failure —
that check is what replaces the drum script's trim/level stage and turns "as recorded" into an
assertion.

| Voice | Source folder | Layer | Files | Size | Widest gap |
|---|---|---|---|---|---|
| **Klarnet** | `Woodwinds/Clarinet/susLong` | `v2` (middle of three) | 11 | 20.2 MB | 5.0 semitones |
| **Keman** | `Strings/Solo Violin/Arco Vib` | `f` (of f/p) | 15 | 35.4 MB | 4.3 semitones |

Layer choice, for the record: the app has no dynamics, so a **middle** velocity is the honest single
sound — `v1` is a whisper the notes would bury and `v3` an accent on every note. The violin's `f` is
both the clearer tone and the smaller of its two layers.

### Three things measuring caught that reading the filenames would not

1. ⚠ **The clarinet's labels are an octave below its sounding pitch.** `DCClar_susLong_D2_…` sounds
   **D3** (146.7 Hz), and so on for all 11 files, within 1 cent. A clarinet cannot produce the D2 its
   name claims. Parsing the name would have transposed the whole instrument an octave — and it would
   have sounded like a plausible instrument, just the wrong one.
2. ✅ **The violin's labels need no offset**, which is the point of including it: it is the *control*
   that makes the clarinet's answer a measurement rather than a guess, exactly the role the
   self-describing frame drum played for VCSL's numbered darbuka hits.
3. ⚠ **`DCClar_susLong_F#5_v2_rr1_sum.wav` sounds F6, not F#6** — mislabelled by a semitone at
   source. 1397 Hz, confirmed independently against its own second partial at 2794 Hz. The file is in
   tune with itself and perfectly usable; it keeps its original name because the files ship untouched
   and the name is provenance. `hz` in the manifest is what plays.

### The playback window — 2026-08-13, revised twice by ear

The owner listened twice, and each pass corrected something the previous measurement got wrong.

**Round 1 — "just like breath" on 16th notes, and an annoying violin creak.** The tone does not
arrive immediately, and a 16th note at 120 BPM is 125 ms, so a short note played the attack transient
and stopped before the instrument spoke. Measured on a 125 ms window (fraction of energy on the
harmonic series, which separates a tone from breath or bow noise):

| sample | tonal at file start | tonal once settled | level change |
|---|---|---|---|
| clarinet D2 | **35.8%** | 96.9% | **13.4× louder** |
| clarinet D3 | 82.6% | 92.1% | 2.3× |
| violin G4 | 91.4% | 98.8% | 1.9× |

⚠ Short notes were not only breathy but **up to 13× quieter** than long ones, because they played
only the ramp-up. That is the part an ear notices first.

**Round 2 — "we can trim less from the beginning", and trim per note duration.** Both right.

The first fix used an **amplitude** threshold as a proxy for breathiness, and amplitude waits for
full *loudness*, which arrives well after the noise stops. It overshot in every file:

| sample | amplitude-based (wrong) | spectral (now) |
|---|---|---|
| clarinet D3 | 158 ms | **92 ms** |
| clarinet F4 | 765 ms | **275 ms** |
| clarinet D2 | 1178 ms | **404 ms** |
| violin G4 | 156 ms | **80 ms** |

So `toneS` is now the first moment the sound is within **10 harmonic-percentage-points of that
file's own settled tonality, and stays there**. ⚠ Relative, never absolute — a clarinet's sustain is
only ~94% harmonic, so an absolute bar is unreachable for some of its notes. ⚠ "And stays there"
matters: violin C7's bow-bite shows a momentary 89.6% blip at 50 ms and then falls back to 36%, so
first-crossing started the note immediately before the worst of the scrape.

**And the trim now depends on the note, not only the file.** Each sample carries `attackS` (first
sound), `toneS` (settled) and `endS` (before the release). A note starts at `attackS` — keeping the
instrument's real articulation — only when that swell is at most **25%** of the note; otherwise it
starts at `toneS`. ⚠ **A smooth blend was tried and measured wrong**: interpolating the start point
lands *inside* the transient for any file with a long one, so a quarter note on C7 began at 64%
harmonic and a half note at 33% — the creak reintroduced in the middle of the range while both ends
looked fine. All-or-nothing means no note ever begins halfway through a scrape.

Measured tonality at the start of each note length, after the fix:

| sample | 16th | quarter | half | whole |
|---|---|---|---|---|
| clarinet D3 (80 ms swell) | 94.3% | 83.9% | 83.9% | 83.9% |
| clarinet D2 (400 ms swell) | 92.8% | 92.8% | 92.8% | 36.7% |
| violin C7 (300 ms bite) | 92.3% | 92.3% | 92.3% | 51.3% |
| violin G4 (80 ms swell) | 98.4% | 91.4% | 91.4% | 91.4% |

Read it as: short notes always speak immediately; a note only inherits the recorded swell once it is
long enough to carry it. ⚠ **Cost: none** — one subtraction and one comparison per note at schedule
time. The alternative (shipping two trimmed copies of every sample) would have doubled the download.

⚠ All of this is applied **at playback, not to the wavs**, so the files stay byte-identical, the
sha256 table above stays valid, and re-tuning by ear costs no re-upload. That paid off immediately:
the round-1 numbers were replaced by the round-2 numbers for free.

### Do the samples keep the microtones? — measured 2026-08-13

**Yes, exactly.** A makam's comma deltas are added to `koma53` *before* a frequency exists
(`withKomaDeltas` → `buildTimeline` → `freqFromTuning`), so the sampled and synthesised paths consume
one and the same `freqHz`. The sampler then sets `playbackRate = freqHz / sample.hz`, which lands on
`freqHz` by construction. Swept over every koma in both instruments' ranges × the fractional deltas a
makam applies (−1.5, −1, +1, +1.5), **1,841 sampled pitches, worst error 9.9e-5 cents** — about
1/229,000 of a koma, after storing the ratio in the float32 AudioParam the browser actually uses.
Pinned by `tools/audio/voices-test.ts` so it cannot regress. Pitches outside a voice's range fall
back to the synth, which is exact by definition.

⚠ **But a violin note is not a steady pitch, and that is worth knowing for this app specifically.**
The layer is `Arco Vib` — vibrato — and its pitch swings **0.9–1.2 komas** peak to peak:

| sample | pitch swing | in komas |
|---|---|---|
| violin G4 | 28.0 cents | **1.24** |
| violin C5 | 19.6 cents | 0.86 |
| clarinet D4 | 3.6 cents | 0.16 |
| clarinet A#3 | 2.2 cents | 0.10 |

The *centre* is exactly right; the note moves around it by roughly one koma while sounding. So the
violin plays the makam correctly but **cannot be used to hear the difference between adjacent komas**
— for that the clarinet is the reference voice, being steady to a tenth of a koma. ⚠ VSCO's Solo
Violin has no non-vibrato arco articulation (only `Arco Vib`, `Pizz`, `Trem`, `spic`), so this is a
property of the source, not something a setting can fix. A straight-tone violin would need a
different recording.

### Levels

Measured peaks are low: **0.26** (clarinet) and **0.31** (violin) full scale. The manifest carries a
per-voice `gain` (3.775 and 3.156) applied in the note's envelope, clamped so `gain × peak ≤ 0.98`.
⚠ **The clarinet's layer spans 13 dB** between its quietest and loudest file — the same shape of
finding as VCSL's unusable `Hand` takes, though not as extreme. One global gain cannot fix a spread,
so its low register is the first thing to listen to (MANUAL_CHECKS check 24).

### Uploading them ✅ DONE 2026-08-13

Live at **<https://huggingface.co/datasets/Beyaban/omr-voices>** — 26 files, 55.6 MB, CC0. Verified
from outside the app: 200 after the LFS redirect with byte counts identical to the VSCO originals,
`access-control-allow-origin` echoed for `https://komavision.netlify.app`, and the `#` in `A#2`
resolving when percent-encoded. `npm run smoke:editor -- --voices-url <base>` against it reads 11/11
decoded, 11 sampled notes and 0 synthesised.

The recipe, for the next instrument:

```bash
.venv-ml/bin/python scripts/prepare_voices.py --analyse   # measure, print, write nothing
.venv-ml/bin/python scripts/prepare_voices.py             # stage data/audio_voices/ (55.6 MB)
.venv-ml/bin/python scripts/prepare_voices.py --manifest  # the TS block + the sha256 table

.venv-ml/bin/hf auth login                                 # already done for the weights
.venv-ml/bin/hf repo create omr-voices --repo-type dataset # public: do NOT pass --private
.venv-ml/bin/hf upload Beyaban/omr-voices data/audio_voices . --repo-type dataset
```

Then check it from outside, the way `mvp/hosting-setup.md` checks the weights — ⚠ a bare `curl` is
not enough, because the Hub reflects the caller's Origin behind `vary: Origin`:

```bash
BASE=https://huggingface.co/datasets/Beyaban/omr-voices/resolve/main
curl -sIL "$BASE/clarinet/DCClar_susLong_D3_v2_rr1_sum.wav" | head -20      # want 200
curl -s -o /dev/null -D - -H "Origin: https://komavision.netlify.app" \
  "$BASE/clarinet/DCClar_susLong_D3_v2_rr1_sum.wav" | grep -i access-control-allow-origin
```

The CORS header is load-bearing: the app is served under COEP `require-corp`, and a plain CORS
`fetch` is what satisfies that without the Hub sending CORP. ⚠ Note the **`/datasets/`** segment — a
dataset repo does not resolve like the weights' model repo, and getting it wrong gives 404s that look
like a failed upload. ⚠ And note that filenames contain `#`: it must arrive percent-encoded, which
`loadInstrument.ts` does per path segment. Pasting a path into a URL raw truncates it at the `#` and
404s — measured, it cost 3 of the clarinet's 11 samples before it was fixed.

Then `npm run smoke:editor -- --voices-url $BASE` to drive the real files, and check 24 by ear.

⚠ **Hear it BEFORE uploading, not after.** `npm run serve:voices` serves `data/audio_voices/` on
:8788 with the two headers COEP needs, and `npm run dev:voices:local` points the app at it — so a bad
split is caught on this machine instead of being published first. A plain static server will not do:
dev sends `Cross-Origin-Embedder-Policy: require-corp`, so a voice fetched without CORS headers is
blocked by the embedder policy while the file itself serves fine in a browser tab. Both of the kanun's
ear-found bugs were found this way.


## The kanun

One CC0 take → 36 files, F3-E6, 9.9 MB, and the project's first DERIVED audio. It took a second
acquisition path, and four measurement traps that a copy job never meets: [kanun.md](kanun.md).

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
   now a row in [audio-policy.md](audio-policy.md).
3. **No NC file is needed for anything being built first.** The 2026-08-09 decision hoped for that;
   it is now measured rather than hoped.
