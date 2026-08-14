/**
 * The instrument voices F1 can play, and where every one of their files came from.
 *
 * ⚠ **This table IS the audio manifest**, for the same reasons `strokeKits.ts` is one: TypeScript
 * rather than a fetched `manifest.json`, so it is type-checked, costs no second round trip, and the
 * licence sits in the same diff as the file. Anything added here MUST arrive with its `source` and
 * `license`, and a matching line in `public/THIRD-PARTY.txt`.
 *
 * ⚠ **The numbers below are MEASURED, not typed.** `scripts/prepare_voices.py --manifest` prints
 * this block; paste it rather than editing a field by hand. `hz` in particular is the recording's
 * own fundamental, because the filenames' pitch labels cannot be trusted across libraries — VSCO's
 * clarinet labels sit an octave below sounding pitch while its violin labels do not, so a name like
 * `..._D2_...` is **provenance, not pitch**.
 *
 * ⚠ Unlike the drums, these files are served from a Hugging Face dataset repo, not from the app
 * (owner, 2026-08-11). The level is the `gain` field here, applied in the note's envelope at
 * playback; nothing is baked into a file.
 *
 * ⚠ **"Served unmodified" is a per-voice claim, not a claim about the folder.** The clarinet and the
 * violin are byte copies of VSCO 2 files, checked by sha256 against the source. The **kanun cannot
 * be**: its source is one two-minute recording of the whole range, so its notes are cut out of it
 * and are new files by construction. What stands in for the identity check there is the source
 * take's own sha256, recorded in `hf/omr-voices-README.md`, so the derivation stays reproducible.
 * `/THIRD-PARTY.txt` states the difference too — a derived file must not be mistaken for an
 * untouched original.
 *
 * ⚠ **Trimming happens here too, in TIME rather than in the file**
 * (`attackS` / `toneS` / `endS`, 2026-08-13).
 * The owner asked for the attacks and tails to be trimmed after hearing 16th notes come out as
 * breath and bow-creak; doing it as playback offsets rather than by re-cutting the wavs keeps the
 * files byte-identical to the library's — so the provenance, the sha256 table and the "served
 * unmodified" claim above all stay true — and it costs no re-upload to re-tune by ear.
 */

/** `sine` is the built-in synthesised tone: always available, needs no download. */
export type VoiceId = "sine" | "clarinet" | "violin" | "kanun";

export interface VoiceSample {
  /**
   * Path under the voices base. For the clarinet and violin this is the ORIGINAL library filename,
   * kept because it is provenance; for the kanun it is generated, because a note cut out of a longer
   * take never had a name of its own (its number is its position in that take).
   */
  rel: string;
  /**
   * MEASURED fundamental in Hz. Never parsed from `rel`.
   *
   * ⚠ **On a plucked voice this is measured spectrally, and the reason is audible.** A stiff string's
   * partials are stretched sharp, so a period-based estimator reads the note sharp — up to 22 cents
   * on the kanun's bottom courses, which is a whole koma, and it made microtonal accidentals down
   * there land on the wrong comma (owner heard it on F♯). `scripts/prepare_voices.py` therefore lets
   * YIN choose the partial and the spectrum say where it is. ⚠ For a BOWED voice the same refinement
   * is wrong and is not applied: `Arco Vib`'s ±30-cent swing has no single peak to find.
   */
  hz: number;
  /** Nearest MIDI number to `hz`. For reading the table; the maths uses `hz`. */
  midi: number;
  /**
   * Buffer seconds to where the recording first makes a sound. **A LONG note starts here**, so it
   * keeps the instrument's real articulation instead of sounding slurred.
   */
  attackS: number;
  /**
   * Buffer seconds to where the recording is settled into its tone. **A SHORT note starts here**,
   * because it has no time to develop and would otherwise be all breath or bow scrape.
   *
   * ⚠ **Both fields exist because of two ear reports, one after the other** (owner, 2026-08-13).
   * First: 16th notes came out as *"just like breath"* (clarinet) and an annoying *creak* (violin) —
   * a short note was playing the attack transient and finishing before the instrument spoke, at up
   * to 13× less volume than a long one. Then, after a first fix that skipped to the loudness plateau:
   * *"we can trim less from the beginning"*, which was right — an amplitude threshold overshoots the
   * breath by waiting for full volume, and cutting that far makes everything slurred for no reason.
   *
   * So `toneS` is measured SPECTRALLY (`scripts/prepare_voices.py`): the first moment the sound is
   * no more than 10 harmonic-percentage-points below that file's own settled tonality, and stays
   * there. That is 71–404 ms for the clarinet against 111–1178 ms for the amplitude version.
   *
   * ⚠ Per FILE, and the outliers are real rather than noise: violin C7 has a genuine 300 ms bow-bite
   * (51% → 99% harmonic) while its neighbours settle in 10–60 ms.
   */
  toneS: number;
  /**
   * Buffer seconds at which the recording's natural release begins — a note must be faded out by
   * here, or the listener hears the player stopping rather than the note ending.
   *
   * ⚠ For a plucked voice it means the end of the DECAY instead (a pluck runs out; nobody releases
   * it), and it is additionally pulled back before any second attack in the file. The player struck
   * a couple of strings twice, and without that a held note re-articulates halfway through — a sound
   * no player made.
   */
  endS: number;
}

export interface Voice {
  id: VoiceId;
  /** Shown in the picker. Real instrument names, so they are not translated. */
  label: string;
  /** Where the recordings came from — the answer to an audit question. */
  source: string;
  license: string;
  /** Asked for by the library's readme even though its licence does not require it. */
  credit?: string;
  /**
   * True for an instrument whose notes decay and die — a pluck, not a bow or a breath.
   *
   * ⚠ It exists because the invariants differ, not for display. A sustained voice's recording must
   * outlast the longest notated note, so `voices-test.ts` demands a window of at least 4 seconds; a
   * plucked one **cannot** meet that and must not be asked to, because a kanun note ending before
   * its written length is the instrument behaving correctly. Nothing in playback reads this: a pluck
   * needs no special case there, since its `toneS === attackS` already makes `preTone` zero in
   * `scheduleSampledNote`, so every note of every length starts at the transient.
   */
  plucked?: boolean;
  /**
   * Peak-normalisation factor applied in the note's gain envelope.
   *
   * ⚠ Set so a sampled note never peaks above where the synthesised note peaked (which is 1.0 into
   * `MASTER_GAIN`), so F1 adds nothing to the limiter's workload. A recorded sustain has a much
   * higher crest factor than a `PeriodicWave`, so peak-matched it will sound a few dB quieter — that
   * is the trade, and the fix if it is too quiet is this number, then a slider, never `MASTER_GAIN`.
   */
  gain: number;
  /**
   * The loudest sample value measured anywhere in the layer, as shipped.
   *
   * Carried so the no-clipping rule is a CHECKED invariant (`gain * peak <= 1`) rather than a claim
   * in a comment — `voices-test.ts` asserts it in the repo, where a hand-edited `gain` would be
   * caught, instead of only in the script, which measures audio the app never sees.
   */
  peak: number;
  /** Ascending by `hz`. Empty for the synthesised voice. */
  samples: VoiceSample[];
}

/**
 * How far OUTSIDE its recorded range a voice may be stretched before the synth takes the note.
 *
 * ⚠ This deliberately bounds only the edges, and does not double as a general shift ceiling. The
 * clarinet's layer steps D–F–A#–D, and F→A# is a perfect fourth, so its widest interior gap is
 * **5 semitones** and a note in the middle of one is ±250 cents from both neighbours — measured, and
 * larger than the ±1.5 semitones the docs claimed before anyone looked. A single cents ceiling would
 * have to exceed 250 to cover that, which would then also license stretching a violin a major third
 * below its lowest string. So: inside the range, always play the nearest recording; outside it,
 * allow this much and then hand the note back to the synth.
 */
export const MAX_EDGE_CENTS = 200;

export const VOICES: Voice[] = [
  {
    id: "sine",
    // Deliberately offered in the picker, unlike the drums' synthesised fallback: it is instant and
    // offline, which is the only thing that is true before a ~20 MB download finishes.
    label: "Varsayılan ses",
    source: "synthesised in the browser (webAudioBackend.ts)",
    license: "—",
    gain: 1,
    peak: 1,
    samples: [],
  },
  {
    id: "clarinet",
    label: "Klarnet",
    source: "https://github.com/sgossner/VSCO-2-CE — Woodwinds/Clarinet/susLong (v2 layer)",
    license: "CC0 1.0",
    credit: "Versilian Studios LLC / Sam Gossner",
    gain: 3.775,
    peak: 0.26,
    // ⚠ The filenames' pitch labels sit ONE OCTAVE below the sounding pitch — measured, and the
    // reason nothing here parses a name. ⚠ `F#5` is also mislabelled by a semitone at source: it
    // sounds F6 (1397 Hz, confirmed against its own second partial at 2794 Hz). Both are harmless
    // because `hz` is what plays; neither is fixable by renaming a file we ship untouched.
    samples: [
      { rel: "clarinet/DCClar_susLong_D2_v2_rr1_sum.wav", hz: 146.74, midi: 50, attackS: 0.004, toneS: 0.404, endS: 7.221 }, // D3
      { rel: "clarinet/DCClar_susLong_F2_v2_rr1_sum.wav", hz: 174.53, midi: 53, attackS: 0.000, toneS: 0.120, endS: 6.956 }, // F3
      { rel: "clarinet/DCClar_susLong_A#2_v2_rr1_sum.wav", hz: 232.94, midi: 58, attackS: 0.005, toneS: 0.125, endS: 9.431 }, // A#3
      { rel: "clarinet/DCClar_susLong_D3_v2_rr1_sum.wav", hz: 293.53, midi: 62, attackS: 0.012, toneS: 0.092, endS: 9.577 }, // D4
      { rel: "clarinet/DCClar_susLong_F3_v2_rr1_sum.wav", hz: 349.05, midi: 65, attackS: 0.052, toneS: 0.132, endS: 9.323 }, // F4
      { rel: "clarinet/DCClar_susLong_A#3_v2_rr1_sum.wav", hz: 466.05, midi: 70, attackS: 0.006, toneS: 0.146, endS: 9.014 }, // A#4
      { rel: "clarinet/DCClar_susLong_D4_v2_rr1_sum.wav", hz: 587.0, midi: 74, attackS: 0.011, toneS: 0.071, endS: 7.296 }, // D5
      { rel: "clarinet/DCClar_susLong_F4_v2_rr1_sum.wav", hz: 698.22, midi: 77, attackS: 0.005, toneS: 0.275, endS: 10.749 }, // F5
      { rel: "clarinet/DCClar_susLong_A#4_v2_rr1_sum.wav", hz: 931.94, midi: 82, attackS: 0.008, toneS: 0.088, endS: 8.451 }, // A#5
      { rel: "clarinet/DCClar_susLong_D5_v2_rr1_sum.wav", hz: 1174.19, midi: 86, attackS: 0.063, toneS: 0.113, endS: 9.210 }, // D6
      { rel: "clarinet/DCClar_susLong_F#5_v2_rr1_sum.wav", hz: 1397.41, midi: 89, attackS: 0.034, toneS: 0.074, endS: 5.638 }, // F6
    ],
  },
  {
    id: "violin",
    label: "Keman", // ⚠ A violin is not a kemençe. It is a good free stand-in; it must not claim to
    // be the Turkish instrument, which is a different instrument with a different sound.
    source: "https://github.com/sgossner/VSCO-2-CE — Strings/Solo Violin/Arco Vib (f layer)",
    license: "CC0 1.0",
    credit: "Versilian Studios LLC / Sam Gossner",
    gain: 3.156,
    peak: 0.311,
    samples: [
      { rel: "violin/LLVln_ArcoVib_G3_f.wav", hz: 195.85, midi: 55, attackS: 0.000, toneS: 0.020, endS: 14.461 }, // G3
      { rel: "violin/LLVln_ArcoVib_A3_f.wav", hz: 219.9, midi: 57, attackS: 0.000, toneS: 0.250, endS: 14.278 }, // A3
      { rel: "violin/LLVln_ArcoVib_C4_f.wav", hz: 263.08, midi: 60, attackS: 0.000, toneS: 0.040, endS: 12.211 }, // C4
      { rel: "violin/LLVln_ArcoVib_E4_f.wav", hz: 328.77, midi: 64, attackS: 0.000, toneS: 0.020, endS: 12.123 }, // E4
      { rel: "violin/LLVln_ArcoVib_G4_f.wav", hz: 394.06, midi: 67, attackS: 0.000, toneS: 0.080, endS: 12.394 }, // G4
      { rel: "violin/LLVln_ArcoVib_A4_f.wav", hz: 443.03, midi: 69, attackS: 0.002, toneS: 0.042, endS: 12.332 }, // A4
      { rel: "violin/LLVln_ArcoVib_C5_f.wav", hz: 527.6, midi: 72, attackS: 0.000, toneS: 0.050, endS: 13.373 }, // C5
      { rel: "violin/LLVln_ArcoVib_E5_f.wav", hz: 664.05, midi: 76, attackS: 0.000, toneS: 0.020, endS: 12.427 }, // E5
      { rel: "violin/LLVln_ArcoVib_G5_f.wav", hz: 786.38, midi: 79, attackS: 0.000, toneS: 0.030, endS: 11.968 }, // G5
      { rel: "violin/LLVln_ArcoVib_A5_f.wav", hz: 886.79, midi: 81, attackS: 0.000, toneS: 0.030, endS: 9.910 }, // A5
      { rel: "violin/LLVln_ArcoVib_C6_f.wav", hz: 1039.12, midi: 84, attackS: 0.000, toneS: 0.060, endS: 11.643 }, // C6
      { rel: "violin/LLVln_ArcoVib_E6_f.wav", hz: 1328.61, midi: 88, attackS: 0.000, toneS: 0.050, endS: 12.783 }, // E6
      { rel: "violin/LLVln_ArcoVib_G6_f.wav", hz: 1577.52, midi: 91, attackS: 0.000, toneS: 0.010, endS: 11.658 }, // G6
      { rel: "violin/LLVln_ArcoVib_A6_f.wav", hz: 1779.2, midi: 93, attackS: 0.000, toneS: 0.010, endS: 10.819 }, // A6
      { rel: "violin/LLVln_ArcoVib_C7_f.wav", hz: 2097.51, midi: 96, attackS: 0.000, toneS: 0.300, endS: 11.814 }, // C7
    ],
  },
  {
    id: "kanun",
    label: "Kanun",
    source:
      "https://freesound.org/s/211133/ — 211133__barisbozkurt__kanun_moderate_chromatic_moreisolated.mp3, " +
      "split at the onsets (CompMusic / Universitat Pompeu Fabra)",
    license: "CC0 1.0",
    credit: "Barış Bozkurt / CompMusic, Universitat Pompeu Fabra",
    // ⚠ The one DERIVED voice — cut from a single two-minute take, not copied. See the file header.
    plucked: true,
    gain: 1.313,
    peak: 0.746,
    // ⚠ **The best-covered voice here, and by a distance**: every semitone from F3 to E6, so the
    // worst stretch `pickSample` ever makes is ±0.7 semitones against the clarinet's ±2.5.
    //
    // ⚠ **The steps are 74-135 cents, not 100, and that is the instrument rather than an error.** A
    // kanun's mandals are spaced in komas, so a "chromatic" run on one gives bakiye and mücennep
    // steps where a piano gives a semitone. `hz` is measured, so the app plays what was recorded;
    // the note names below are nearest-12-TET LABELS for reading the table and nothing more. Do not
    // "correct" them toward equal temperament — on this project of all projects.
    //
    // ⚠ `attackS === toneS` on every row, deliberately. A pluck's transient IS the instrument, so
    // there is nothing to skip past the way a clarinet's breath or a violin's bow scrape must be.
    // It also makes `preTone` zero in `scheduleSampledNote`, so a 16th note and a whole note both
    // start at the pluck. The numbering is the note's position in the source take — 02-37, because
    // 00 and 01 are two events before the run starts and are not part of it.
    samples: [
      { rel: "kanun/kanun_37_F3.wav", hz: 173.8, midi: 53, attackS: 0.14, toneS: 0.14, endS: 1.911 }, // F3
      { rel: "kanun/kanun_36_Fs3.wav", hz: 183.88, midi: 54, attackS: 0.153, toneS: 0.153, endS: 5.012 }, // F#3
      { rel: "kanun/kanun_35_G3.wav", hz: 194.96, midi: 55, attackS: 0.157, toneS: 0.157, endS: 4.374 }, // G3
      { rel: "kanun/kanun_34_Gs3.wav", hz: 206.79, midi: 56, attackS: 0.054, toneS: 0.054, endS: 3.866 }, // G#3
      { rel: "kanun/kanun_33_A3.wav", hz: 219.95, midi: 57, attackS: 0.137, toneS: 0.137, endS: 4.962 }, // A3
      { rel: "kanun/kanun_32_As3.wav", hz: 235.48, midi: 58, attackS: 0.079, toneS: 0.079, endS: 1.762 }, // A#3
      { rel: "kanun/kanun_31_B3.wav", hz: 249.25, midi: 59, attackS: 0.112, toneS: 0.112, endS: 4.646 }, // B3
      { rel: "kanun/kanun_30_C4.wav", hz: 258.62, midi: 60, attackS: 0.136, toneS: 0.136, endS: 3.952 }, // C4
      { rel: "kanun/kanun_29_Cs4.wav", hz: 277.22, midi: 61, attackS: 0.044, toneS: 0.044, endS: 4.165 }, // C#4
      { rel: "kanun/kanun_28_D4.wav", hz: 293.04, midi: 62, attackS: 0.089, toneS: 0.089, endS: 5.119 }, // D4
      { rel: "kanun/kanun_27_Ds4.wav", hz: 310.26, midi: 63, attackS: 0.09, toneS: 0.09, endS: 2.055 }, // D#4
      { rel: "kanun/kanun_26_E4.wav", hz: 330.05, midi: 64, attackS: 0.142, toneS: 0.142, endS: 4.84 }, // E4
      { rel: "kanun/kanun_25_F4.wav", hz: 348.37, midi: 65, attackS: 0.12, toneS: 0.12, endS: 1.806 }, // F4
      { rel: "kanun/kanun_24_Fs4.wav", hz: 369.95, midi: 66, attackS: 0.119, toneS: 0.119, endS: 3.816 }, // F#4
      { rel: "kanun/kanun_23_G4.wav", hz: 390.9, midi: 67, attackS: 0.063, toneS: 0.063, endS: 3.291 }, // G4
      { rel: "kanun/kanun_22_Gs4.wav", hz: 412.12, midi: 68, attackS: 0.027, toneS: 0.027, endS: 1.547 }, // G#4
      { rel: "kanun/kanun_21_A4.wav", hz: 438.89, midi: 69, attackS: 0.133, toneS: 0.133, endS: 4.097 }, // A4
      { rel: "kanun/kanun_20_As4.wav", hz: 466.16, midi: 70, attackS: 0.137, toneS: 0.137, endS: 1.485 }, // A#4
      { rel: "kanun/kanun_19_B4.wav", hz: 496.71, midi: 71, attackS: 0.078, toneS: 0.078, endS: 3.012 }, // B4
      { rel: "kanun/kanun_18_C5.wav", hz: 520.15, midi: 72, attackS: 0.121, toneS: 0.121, endS: 1.831 }, // C5
      { rel: "kanun/kanun_17_Cs5.wav", hz: 546.96, midi: 73, attackS: 0.163, toneS: 0.163, endS: 1.952 }, // C#5
      { rel: "kanun/kanun_16_D5.wav", hz: 583.32, midi: 74, attackS: 0.062, toneS: 0.062, endS: 1.896 }, // D5
      { rel: "kanun/kanun_15_Ds5.wav", hz: 617.95, midi: 75, attackS: 0.049, toneS: 0.049, endS: 1.841 }, // D#5
      { rel: "kanun/kanun_14_E5.wav", hz: 659.39, midi: 76, attackS: 0.083, toneS: 0.083, endS: 2.783 }, // E5
      { rel: "kanun/kanun_13_F5.wav", hz: 695.35, midi: 77, attackS: 0.044, toneS: 0.044, endS: 1.426 }, // F5
      { rel: "kanun/kanun_12_Fs5.wav", hz: 748.61, midi: 78, attackS: 0.047, toneS: 0.047, endS: 2.567 }, // F#5
      { rel: "kanun/kanun_11_G5.wav", hz: 782.28, midi: 79, attackS: 0.12, toneS: 0.12, endS: 1.231 }, // G5
      { rel: "kanun/kanun_10_Gs5.wav", hz: 839.08, midi: 80, attackS: 0.06, toneS: 0.06, endS: 1.454 }, // G#5
      { rel: "kanun/kanun_09_A5.wav", hz: 884.08, midi: 81, attackS: 0.143, toneS: 0.143, endS: 1.781 }, // A5
      { rel: "kanun/kanun_08_As5.wav", hz: 928.48, midi: 82, attackS: 0.048, toneS: 0.048, endS: 1.155 }, // A#5
      { rel: "kanun/kanun_07_B5.wav", hz: 1003.54, midi: 83, attackS: 0.137, toneS: 0.137, endS: 2.013 }, // B5
      { rel: "kanun/kanun_06_C6.wav", hz: 1044.56, midi: 84, attackS: 0.166, toneS: 0.166, endS: 1.131 }, // C6
      { rel: "kanun/kanun_05_Cs6.wav", hz: 1111.97, midi: 85, attackS: 0.134, toneS: 0.134, endS: 1.08 }, // C#6
      { rel: "kanun/kanun_04_D6.wav", hz: 1173.06, midi: 86, attackS: 0.104, toneS: 0.104, endS: 1.114 }, // D6
      { rel: "kanun/kanun_03_Ds6.wav", hz: 1227.88, midi: 87, attackS: 0.11, toneS: 0.11, endS: 0.968 }, // D#6
      { rel: "kanun/kanun_02_E6.wav", hz: 1325.27, midi: 88, attackS: 0.085, toneS: 0.085, endS: 0.941 }, // E6
    ],
  },
];

export const DEFAULT_VOICE: VoiceId = "sine";

export function findVoice(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}

export interface SamplePick {
  sample: VoiceSample;
  /** What to set on `AudioBufferSourceNode.playbackRate` to land exactly on the wanted pitch. */
  playbackRate: number;
  /** Signed distance from the recording to the wanted pitch, for diagnostics. */
  cents: number;
}

/**
 * Nearest recorded pitch to `freqHz`, and the rate that lands exactly on it.
 *
 * Pitch is chosen by CENTS, not by Hz: nearest-in-Hz is the wrong answer almost everywhere, because
 * a semitone is 12 Hz wide down at the violin's G string and 120 Hz wide at the top of its range.
 *
 * Inside the recorded range this ALWAYS answers — a note is never dropped back to the synth just
 * because it fell in a wide gap, which would change timbre mid-phrase. Outside the range it answers
 * for `MAX_EDGE_CENTS` and then returns `null`, and the caller synthesises that note.
 *
 * Deliberately pure — no Web Audio, no `import.meta.env` — so `npm test` exercises it outside a
 * browser. The scan is linear over 11–15 entries and runs once per note; a binary search would be
 * faster and less obvious.
 */
export function pickSample(voice: Voice, freqHz: number): SamplePick | null {
  if (!voice.samples.length || !Number.isFinite(freqHz) || freqHz <= 0) return null;

  let best = voice.samples[0]!;
  let bestCents = 1200 * Math.log2(freqHz / best.hz);
  for (const s of voice.samples) {
    const cents = 1200 * Math.log2(freqHz / s.hz);
    if (Math.abs(cents) < Math.abs(bestCents)) {
      best = s;
      bestCents = cents;
    }
  }

  // `samples` is ascending by hz, so the ends are the range. Only a note beyond one of them can be
  // refused, and only once it is more than MAX_EDGE_CENTS past it.
  const low = voice.samples[0]!.hz;
  const high = voice.samples[voice.samples.length - 1]!.hz;
  const outside = freqHz < low || freqHz > high;
  if (outside && Math.abs(bestCents) > MAX_EDGE_CENTS) return null;

  // The rate IS the frequency ratio: resampling by 2× puts the recording an octave up (and, as a
  // side effect, halves its length — irrelevant for a sustain that already outlasts the note).
  return { sample: best, playbackRate: freqHz / best.hz, cents: bestCents };
}
