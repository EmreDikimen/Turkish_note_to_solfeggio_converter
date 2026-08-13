/**
 * Voice manifest + sample-picking checks (Node-only) for `apps/web/src/audio/instruments.ts`.
 *
 * Two things are under test and they fail differently:
 *
 *  1. **The manifest is DATA produced by a script and pasted by hand**, so these are transcription
 *     checks — a mistyped digit in an `hz`, samples out of order, a duplicated path, a `gain` that
 *     would clip. `scripts/prepare_voices.py` asserts the same properties against the actual audio;
 *     this asserts them against what landed in the repo, which is the half that can rot.
 *  2. **`pickSample` is the 53-TET adapter.** A sampler for twelve pitches per octave is trivial; the
 *     whole reason this function exists is that the project has 53, so every note is a stretch of
 *     some recording. The bound on how far it stretches is pinned here rather than left in prose,
 *     because it was documented wrong twice — "a minor third apart, so ±1.5 semitones" (before
 *     anyone measured) and then ±2 (from miscounting F→A# as 4 semitones). It is a perfect fourth,
 *     so the clarinet's widest gap is 5 and the worst interior shift is ±2.5 semitones.
 *
 * What it cannot check: whether a stretched note SOUNDS right. That is MANUAL_CHECKS check 24.
 *
 * Run: npx --yes tsx tools/audio/voices-test.ts
 */

import {
  DEFAULT_VOICE,
  findVoice,
  MAX_EDGE_CENTS,
  pickSample,
  VOICES,
  type Voice,
} from "../../apps/web/src/audio/instruments.ts";

let failures = 0;

function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n    want: ${w}\n    got : ${g}`);
  }
}

function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? `\n    ${detail}` : ""}`);
  }
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);
const sampled = VOICES.filter((v) => v.samples.length > 0);

// ---------------------------------------------------------------------------------------------
console.log("\nmanifest shape");

ok("the default voice exists", findVoice(DEFAULT_VOICE) !== undefined);
ok(
  "the default voice needs no download",
  findVoice(DEFAULT_VOICE)!.samples.length === 0,
  "the default must be playable before any network call, or the app opens mute",
);
ok("there is more than one sampled voice", sampled.length >= 2);
check("ids are unique", new Set(VOICES.map((v) => v.id)).size, VOICES.length);

for (const v of VOICES) {
  ok(`${v.id}: has a source`, v.source.trim().length > 0);
  ok(`${v.id}: has a licence`, v.license.trim().length > 0);
}

// ⚠ Not decoration. Every audio file in this project must be traceable to a licence, and the table
// is the machine-readable half of that (public/THIRD-PARTY.txt is the human half).
for (const v of sampled) {
  ok(`${v.id}: CC0`, v.license === "CC0 1.0", `licence is "${v.license}"`);
  ok(`${v.id}: credits the library`, (v.credit ?? "").length > 0);
}

// ---------------------------------------------------------------------------------------------
console.log("\nsample tables");

for (const v of sampled) {
  const ascending = v.samples.every((s, i) => i === 0 || s.hz > v.samples[i - 1]!.hz);
  ok(`${v.id}: ascending by hz`, ascending, "pickSample reads the ends as the range");

  check(`${v.id}: paths unique`, new Set(v.samples.map((s) => s.rel)).size, v.samples.length);
  ok(
    `${v.id}: paths live under the voice's own folder`,
    v.samples.every((s) => s.rel.startsWith(`${v.id}/`)),
    "the upload staging folder and the manifest must agree on layout",
  );

  // Catches a mistyped digit: `midi` is a human-readable echo of `hz`, so a paste error shows up as
  // the two disagreeing. 50 cents is half a semitone — past that they are naming different notes.
  const offLabel = v.samples.filter(
    (s) => Math.abs(cents(s.hz, 440 * Math.pow(2, (s.midi - 69) / 12))) > 50,
  );
  check(`${v.id}: every hz agrees with its midi`, offLabel.map((s) => s.rel), []);

  // ⚠ These paths carry the library's own filenames, and an instrument's pitch names contain
  // sharps — `A#2`. `#` opens a URL fragment, so a consumer that pastes a path straight into a URL
  // silently requests `…/DCClar_susLong_A` and gets a 404 that looks like a missing upload. It cost
  // 3 of the clarinet's 11 samples before `loadInstrument.ts` escaped per segment. This check exists
  // to stop the other tempting fix: pre-escaping HERE, which would double-encode at fetch time.
  const risky = v.samples.filter((s) => /[#?%]/.test(s.rel));
  if (risky.length) {
    console.log(`  note  ${v.id}: ${risky.length} paths contain URL-significant characters`);
  }
  ok(
    `${v.id}: paths are unescaped, exactly as the library names them`,
    v.samples.every((s) => !/%[0-9A-Fa-f]{2}/.test(s.rel)),
    "escaping belongs at the fetch, not in the manifest — here it would be applied twice",
  );

  // The playback window. ⚠ These bounds exist because of two ear reports: 16th notes came out as
  // breath and bow-creak, and then the first fix trimmed too much. A short note starts at `toneS`,
  // a long note at `attackS`, and both must sit inside the recording in that order.
  ok(
    `${v.id}: attack ≤ tone < end on every sample`,
    v.samples.every((s) => s.attackS >= 0 && s.attackS <= s.toneS && s.toneS < s.endS),
    "out of order, a note would start after it is meant to have finished",
  );
  // A note is scheduled from `toneS` at worst, so the window has to cover the longest plausible
  // note. At the tempo box's floor a whole note runs several seconds — hence the bound, not 0.
  ok(
    `${v.id}: the shortest window still covers a long note`,
    Math.min(...v.samples.map((s) => s.endS - s.toneS)) >= 4,
    `shortest is ${Math.min(...v.samples.map((s) => s.endS - s.toneS)).toFixed(1)} s`,
  );
  // ⚠ Regression guard on the correction the owner asked for. The first attempt used an AMPLITUDE
  // threshold, which waits for full loudness rather than for the noise to stop, and overshot in
  // every file (158 ms where the tone settles at 92, 765 where it settles at 275). If a future
  // measurement drifts back toward that, this is what says so.
  const late = v.samples.filter((s) => s.toneS > 0.5);
  check(
    `${v.id}: no sample trims more than 500 ms off the front`,
    late.map((s) => `${s.rel} @ ${(s.toneS * 1000).toFixed(0)}ms`),
    [],
  );

  // The level rule, and the reason `peak` is in the manifest at all: a sampled note must never peak
  // above where the synthesised note peaked (1.0), because MASTER_GAIN and the limiter were tuned
  // around exactly that. F2's "patlamış" bug was this arithmetic going wrong in the other direction.
  ok(`${v.id}: gain is positive`, v.gain > 0);
  ok(
    `${v.id}: gain × peak cannot reach full scale`,
    v.gain * v.peak <= 1.0,
    `${v.gain} × ${v.peak} = ${(v.gain * v.peak).toFixed(3)} — it would clip before the limiter`,
  );
  ok(
    `${v.id}: and is not so quiet it is pointless`,
    v.gain * v.peak >= 0.5,
    `${(v.gain * v.peak).toFixed(3)} peak would be inaudible beside the drums`,
  );
}

// ---------------------------------------------------------------------------------------------
console.log("\nthe worst stretch inside each range");

for (const v of sampled) {
  let worst = 0;
  let where = "";
  for (let i = 1; i < v.samples.length; i++) {
    const gap = cents(v.samples[i]!.hz, v.samples[i - 1]!.hz);
    if (gap > worst) {
      worst = gap;
      where = `${v.samples[i - 1]!.midi}→${v.samples[i]!.midi}`;
    }
  }
  // Half the widest gap: a note exactly between two recordings is that far from both.
  const shift = worst / 2;
  console.log(`  note  ${v.id}: widest gap ${(worst / 100).toFixed(1)} semitones at ${where}`);
  ok(
    `${v.id}: worst interior shift ≤ 250 cents`,
    shift <= 250.5,
    `${shift.toFixed(0)} cents — add pitches rather than stretching further`,
  );
}

// ---------------------------------------------------------------------------------------------
console.log("\npickSample");

const clarinet = findVoice("clarinet")!;
const violin = findVoice("violin")!;

function nearest(v: Voice, hz: number) {
  return pickSample(v, hz)?.sample.rel;
}

// Exact hits: a recorded pitch must choose its own recording and play at rate 1.
for (const v of sampled) {
  const mid = v.samples[Math.floor(v.samples.length / 2)]!;
  const pick = pickSample(v, mid.hz);
  check(`${v.id}: an exact pitch picks its own file`, pick?.sample.rel, mid.rel);
  ok(`${v.id}: and plays at rate 1`, Math.abs((pick?.playbackRate ?? 0) - 1) < 1e-9);
  ok(`${v.id}: with no shift`, Math.abs(pick?.cents ?? 99) < 1e-9);
}

// Nearest by CENTS, not by Hz — and the two genuinely disagree. Between C6 (1039 Hz) and E6
// (1329 Hz), a note at 1180 Hz is 141 Hz above C6 and 149 Hz below E6, so nearest-by-Hz says C6;
// in pitch it is +221 cents from C6 and −205 from E6, so nearest-by-cents says E6. Hz distance is
// not pitch distance, and picking on it stretches the wrong recording — inaudibly in the bass,
// glaringly at the top of the range.
check("violin: 1180 Hz is nearest E6 by cents", nearest(violin, 1180), "violin/LLVln_ArcoVib_E6_f.wav");
ok(
  "…and that is NOT the answer nearest-by-Hz would give",
  Math.abs(1180 - 1039.12) < Math.abs(1180 - 1328.61),
  "the example itself is wrong if this stops being true",
);

// A 53-TET koma between two recordings still lands on one of them, and the rate lands exactly.
const koma = 1039.12 * Math.pow(2, 1 / 53);
const komaPick = pickSample(violin, koma)!;
ok("a one-koma sharp C6 still picks C6", komaPick.sample.rel === "violin/LLVln_ArcoVib_C6_f.wav");
ok(
  "…and the rate lands exactly on it",
  Math.abs(komaPick.sample.hz * komaPick.playbackRate - koma) < 1e-6,
  "playbackRate is what makes 53 pitches out of 15 recordings",
);

// Inside the range a note is NEVER refused, however wide the gap. A dropout would change timbre
// mid-phrase, which is worse than a stretched note.
for (const v of sampled) {
  const lo = v.samples[0]!.hz;
  const hi = v.samples[v.samples.length - 1]!.hz;
  let refused = 0;
  for (let i = 0; i <= 400; i++) {
    const hz = lo * Math.pow(hi / lo, i / 400);
    if (!pickSample(v, hz)) refused++;
  }
  check(`${v.id}: nothing inside the range is refused`, refused, 0);
}

// Outside it, the voice gives way to the synth rather than transposing absurdly.
ok(
  "an octave below the clarinet's lowest is refused",
  pickSample(clarinet, clarinet.samples[0]!.hz / 2) === null,
);
ok(
  "an octave above the violin's highest is refused",
  pickSample(violin, violin.samples[violin.samples.length - 1]!.hz * 2) === null,
);
ok(
  "but just past the edge still plays",
  pickSample(violin, violin.samples[0]!.hz * Math.pow(2, -(MAX_EDGE_CENTS - 20) / 1200)) !== null,
  "the boundary must be inclusive enough that a semitone below the range is still the instrument",
);

// Degenerate inputs. `buildTimeline` writes NaN into `freqHz` for a rest, and although the scheduler
// filters rests out, a voice must not answer with a garbage buffer if that ever changes.
ok("a rest's NaN is refused", pickSample(violin, Number.NaN) === null);
ok("zero is refused", pickSample(violin, 0) === null);
ok("the synthesised voice never picks a sample", pickSample(findVoice("sine")!, 440) === null);

// ---------------------------------------------------------------------------------------------
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
