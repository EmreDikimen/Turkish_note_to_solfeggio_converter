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
 * ⚠ Unlike the drums, these files are **served unmodified** — full length, stereo, original bit
 * depth — from a Hugging Face dataset repo, not from the app (owner, 2026-08-11). The level is the
 * `gain` field here, applied in the note's envelope at playback; nothing is baked into a file.
 *
 * ⚠ **Trimming happens here too, in TIME rather than in the file** (`skipS` / `endS`, 2026-08-13).
 * The owner asked for the attacks and tails to be trimmed after hearing 16th notes come out as
 * breath and bow-creak; doing it as playback offsets rather than by re-cutting the wavs keeps the
 * files byte-identical to the library's — so the provenance, the sha256 table and the "served
 * unmodified" claim above all stay true — and it costs no re-upload to re-tune by ear.
 */

/** `sine` is the built-in synthesised tone: always available, needs no download. */
export type VoiceId = "sine" | "clarinet" | "violin";

export interface VoiceSample {
  /** Path under the voices base. The ORIGINAL library filename — these ship untouched. */
  rel: string;
  /** MEASURED fundamental in Hz. Never parsed from `rel`. */
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
