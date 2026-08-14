---
license: cc0-1.0
tags:
  - audio
  - music
  - samples
pretty_name: KomaVision instrument voices
---

# KomaVision instrument voices

The sampled instruments [KomaVision](https://komavision.netlify.app) plays scores with. Fetched by
the app at runtime, only when someone picks that instrument.

Everything here is **CC0 1.0**. Playback level is applied in the app, not baked into a file.

| Folder | Source | Files | Size | Prepared how |
|---|---|---|---|---|
| `clarinet/` | VSCO 2 CE, `Woodwinds/Clarinet/susLong`, v2 (middle) velocity layer | 11 | 20.2 MB | **untouched copy** |
| `violin/` | VSCO 2 CE, `Strings/Solo Violin/Arco Vib`, `f` layer | 15 | 35.4 MB | **untouched copy** |
| `kanun/` | [Freesound 211133](https://freesound.org/s/211133/), one take of the whole range | 36 | 9.9 MB | **derived** — see below |

⚠ **The two VSCO folders are untouched files; the kanun folder is not, and the difference matters if
you reuse these.** Nothing in `clarinet/` or `violin/` has been trimmed, compressed, downmixed,
resampled or re-levelled — full length, stereo, original bit depth, original filenames — and
`scripts/prepare_voices.py` in the app's repo verifies each one's sha256 against the source it was
copied from.

The kanun **cannot** carry that guarantee, because its source is a single two-minute recording of the
instrument's whole chromatic range rather than one file per note. Its 36 files were cut out of that
take at the onsets and written as 16-bit mono PCM. Nothing was re-encoded — the mp3 is decoded once
and that decode is what you are downloading — and the take was scaled only if its decode exceeded
full scale, uniformly, so the notes keep their relative levels. What replaces the byte-identity check
is the **source take's own sha256**, recorded with the checksums below, so the derivation can be
reproduced from the original file.

Filenames follow from that: `clarinet/` and `violin/` keep the library's names because those names
are provenance, while a kanun note never had a name of its own, so `kanun_17_Cs5.wav` is generated —
`17` is its position in the take, and the note name is measured, not assumed.

## Licence

**CC0 1.0** for all three folders.

- **Clarinet and violin** — <https://github.com/sgossner/VSCO-2-CE>, whose `LICENSE` is the CC0 1.0
  legalcode. Credit is given although CC0 does not require it: VSCO 2 CE's readme asks for credit to
  **Versilian Studios LLC / Sam Gossner**, which costs one line. Where that readme's "Terms" conflict
  with the CC0 file beside them, CC0 governs — it is irrevocable once applied. Only Versilian's own
  clarinet and solo violin recordings are taken here, never the v1.1 "legacy" / Ivy Audio material,
  where the provenance is mixed.
- **Kanun** — <https://freesound.org/s/211133/>, uploaded under CC0 by **Barış Bozkurt**, recorded
  for the **CompMusic** project at Universitat Pompeu Fabra. ⚠ On Freesound, CC0 is the uploader's
  own declaration rather than a platform guarantee; this one is trusted on provenance — a named
  researcher publishing named research recordings.

## Things worth knowing before using these elsewhere

**The clarinet's pitch labels are an octave below its sounding pitch.** `DCClar_susLong_D2_…` sounds
D3 (146.7 Hz). Measured across all 11 files, consistently. The violin's labels are scientific pitch
and need no offset — it was the control. Do not read a pitch off a filename.

**`DCClar_susLong_F#5_v2_rr1_sum.wav` sounds F6, not F#6.** 1397 Hz, confirmed against its own second
partial at 2794 Hz — it is mislabelled by a semitone at source. The file is in tune with itself and
perfectly usable; it is kept under its original name because the name is provenance, and the app
carries measured frequencies rather than parsed ones.

**The kanun is not in equal temperament, and it is not supposed to be.** Its steps run from 62 to
137 cents rather than sitting on 100: a kanun's mandals are spaced in Holdrian commas (22.6 cents),
so a "chromatic" run on one gives the bakiye and mücennep intervals of Turkish makam music where a
piano would give semitones. The note names in the filenames are **nearest-12-TET labels for reading
the list**; the pitch that matters is the one you measure. Anything that snaps these to 12-TET is
throwing away the reason to use a kanun.

**Measure a plucked string's pitch from its spectrum, not from its period.** A stiff string's
partials are stretched sharp, so a period-based estimator (YIN and friends) reads the note sharp —
here by 22 cents on the bottom courses, which is a whole comma, falling to ~2 cents at the top. It is
enough to put a microtonal accidental on the wrong note.

**Each file has silence and often another sound before its pluck.** The cut is deliberately loose at
the front so no attack is clipped; the app starts playback at the pluck itself, which it finds by
walking back from the peak. If you drop these into a sampler that triggers at sample zero, short
notes will play the lead-in instead of the note.

## Checksums

The kanun's rows are the hashes of the DERIVED files; the take they were cut from is:

```
kanun: derived from 211133__barisbozkurt__kanun_moderate_chromatic_moreisolated.mp3 — https://freesound.org/s/211133/
source sha256: 6f7a71bd4b117b26de79d6f9fe59004c90318d2fc0c66c358fe529563b0cf426
```

```
49ff4e52b72a5ac3c83df8ea32ef01967bd54f8283967b16b391b07a66123e09  kanun/kanun_02_E6.wav
1a2dab0b2af9db5496f0e73332dbbc0b6d01364c062f279621843c41be9ed464  kanun/kanun_03_Ds6.wav
e98c4c5ce6b0578a368cb1d9b39827978a90c713bf62e30eab19ad81460c43c4  kanun/kanun_04_D6.wav
094e4b112dcb346bc91845d7eb3d5e198a394c2bb0c06e94254ea4e3c35207fb  kanun/kanun_05_Cs6.wav
e766d42b53fc78621407ea5f27b813ccf4ebe4a4b31edfa71aeae1b18d947cc8  kanun/kanun_06_C6.wav
8563b5d5883b891cac96b049b350b403ef94acb3ccd69ce1fc1e58c63e56207e  kanun/kanun_07_B5.wav
f554c553483bbdb89e5deb835de47eea565b82b5e563eed217403707110e4ec3  kanun/kanun_08_As5.wav
5ef8ce13af6fa6047d70320f55b24f99ca4ec662bbb7efd4bf3ccb97abc19a41  kanun/kanun_09_A5.wav
d8e85ed57a3e5441e1df13d5f8eb0fd2eee1e4d35ad4199d94646bc66e8766da  kanun/kanun_10_Gs5.wav
b6342cc5cbaa052506c8d723a96745548a9638a61cf02270942d015867cdb720  kanun/kanun_11_G5.wav
747b91c4d6d4e043ef186220faa93c4e66db2e509b3f587345277e882bfd95c7  kanun/kanun_12_Fs5.wav
7a5fcf2910d77a5e1f7ed355f3ecb6aafa13530d46705814c54ecc17a2160e61  kanun/kanun_13_F5.wav
2721c1419a4b31aeb6259e5fe79d352e5150f7561db93d8f9b57e01f196b2697  kanun/kanun_14_E5.wav
a731a196bc2c1af77b785e1fb321e437012569b8011d99fdfc9ea9ad4d1a427e  kanun/kanun_15_Ds5.wav
51b27511e18c8edd66a26e5c1985bdd17bfb7d71d5bcb4bfe0d20eead4b7cd36  kanun/kanun_16_D5.wav
7d92ad074d6c9b0b157584751d7a937a660eb14a50eb9e17ee8798b3cd6fdca6  kanun/kanun_17_Cs5.wav
251d88c54a1ec16e40e89fbed551856222b8b8ddc5201bdc7471f726296ac068  kanun/kanun_18_C5.wav
109c4fa3dd5a961105e41f8297365b043456b535a5f5d3aed3eee2c198e58e8f  kanun/kanun_19_B4.wav
046836f89732f24764d4022bfba208f2763e908b9d224169c2f0d28e9de394cf  kanun/kanun_20_As4.wav
cfa6549932a94b3f375b7fa41c7b31e26e5d6c68da99868a33d0ee9ebce77dd5  kanun/kanun_21_A4.wav
87f7410af175a7bf2477d13d84970883e8591800bdd4a2d57ca4ce9f1b06fa2c  kanun/kanun_22_Gs4.wav
bfe769fbc03630166fc7bbe354bcd3abca0bbc8fde2b3400982b6eb1de8171be  kanun/kanun_23_G4.wav
9344670e4093716b1778ed84587f9475f6c0b1cc355eb4841deb92694d569105  kanun/kanun_24_Fs4.wav
91b6b4c85e0c93831b3781207673ef788617644470e4c97de0ad068df13de055  kanun/kanun_25_F4.wav
fc166eac8b579a414cb17672c8c865b2fe1b09f3cbf2c263ef08200431c47c67  kanun/kanun_26_E4.wav
7838dfdacc21f643d698d76a9d23553a986c0dc6df0d1110d41ef5d12490bb13  kanun/kanun_27_Ds4.wav
8a38acbf700041ec12686d64b732baccde78dc9b313c8908d9cb64162e6c04ac  kanun/kanun_28_D4.wav
9a49ad99de0d40a888195c0aabc6cb75fd8234a84215ba6e4a74614a09e51d5d  kanun/kanun_29_Cs4.wav
58752f1eb7dc995c49478b757b2f5dcc7763cf5fedf19d6c1f48ee66a7742ce6  kanun/kanun_30_C4.wav
b8419ad02a6dca33adf2647b06b4dde592e195eef0a8b0ffb1ab14b1c2bdeb52  kanun/kanun_31_B3.wav
9ff24592d87ad3b0f76e584f69246db8249e8818dd02c6c06ff632e085a62eed  kanun/kanun_32_As3.wav
aefa827475acd51585149c04e177e75622b894f982230c016d86c647d7eab74c  kanun/kanun_33_A3.wav
5e7ef275c60b4d159ab6ca0e4f482b093e8474ce4521f0355ab74eb235ed5a79  kanun/kanun_34_Gs3.wav
348d96cfa5eb5ddb48d52ab96324694e0a98337cb490d6ee9a738d2a3e7e1151  kanun/kanun_35_G3.wav
9a92beb5be8cbcb00bf2c05dcab8d320c1a56551861fbb5e612428af9baa704f  kanun/kanun_36_Fs3.wav
b7346127535348fce30239a04bcbaae607217bcd560b9c52a61087df8a114228  kanun/kanun_37_F3.wav
82be872b7915c833e06910846e3398b55591f69bfe6474c39dd4051742db2700  clarinet/DCClar_susLong_A#2_v2_rr1_sum.wav
779e2cad84f6f5103272f17cb4637a94d8e9c533a5811233595960cad61b391f  clarinet/DCClar_susLong_A#3_v2_rr1_sum.wav
569e902693e7d04ecd20507f0a3dd0be92a7a3cdf14ab685d89aefacff2a34cb  clarinet/DCClar_susLong_A#4_v2_rr1_sum.wav
b1a793ff45d8f068dd83b591924b1a29bbece98e6e8177b31fc003f2f426fe00  clarinet/DCClar_susLong_D2_v2_rr1_sum.wav
30e686ffc58caa48bbfae309a06f1c27c75b192fb653729ffdf8586cbd9b8405  clarinet/DCClar_susLong_D3_v2_rr1_sum.wav
4bdc53f3ef917cc9146e10cec5eb33744524e8b510c4a39c080dc5c774b3c956  clarinet/DCClar_susLong_D4_v2_rr1_sum.wav
4cedd1d7bd779fe357529e34ff398bc0e80c5088fc3908944962d65fcdc94823  clarinet/DCClar_susLong_D5_v2_rr1_sum.wav
2f024789f1b2ecc25f0e07dcff06084e4c2def83ff74e693c098c28fbec319fc  clarinet/DCClar_susLong_F#5_v2_rr1_sum.wav
36348e1fd1a1e53485c7f48983cfd758ced036f6af1a832671bf5ef1f8b00448  clarinet/DCClar_susLong_F2_v2_rr1_sum.wav
3c9a237651cd049cacdf4052ef85ff406da1d9e5d4f59439c20f45a7578ff431  clarinet/DCClar_susLong_F3_v2_rr1_sum.wav
9988142d8fd2856af4217e3983316a42ef1d91b6381afd9fa138072d91122c2e  clarinet/DCClar_susLong_F4_v2_rr1_sum.wav
76934f3a85e4ba3b6518132c2fe6effa340c33fbb02f94e88c60b00073dc722f  violin/LLVln_ArcoVib_A3_f.wav
19e5374658351508a9e2c929e871a43caff41e62d5e3363ead6f88428a9ab863  violin/LLVln_ArcoVib_A4_f.wav
0558d79d23db55c710e664e6283b62619f5a582ce261a5c082700a0d01536627  violin/LLVln_ArcoVib_A5_f.wav
37f6cc2f12b1b443a77d3ee370178da4a002a2ac3b6529663cc7ee002728ddcf  violin/LLVln_ArcoVib_A6_f.wav
4169605b51a72454f11bc2c34efc66c1d9993fd2b7d5f097a025ef9d3a2dbdfa  violin/LLVln_ArcoVib_C4_f.wav
af72f852ef2892233699851dacf5f8d97d446822d8eb4ce9e0ec27d5a721b118  violin/LLVln_ArcoVib_C5_f.wav
7ec8e0c2dde75282a4aaacccc713c84faa3e84daa9cf43df45ffc0e209964d46  violin/LLVln_ArcoVib_C6_f.wav
f8223aed62911ef3f6937111bf3cdcc36fc25a636d4f99480b97029c4d28f393  violin/LLVln_ArcoVib_C7_f.wav
418512905f3294a23cf999f0587bf8e04d60192fe317ea8c80c150a85670eda2  violin/LLVln_ArcoVib_E4_f.wav
5c278e263fd59650190fc58294945cd291906eb1abd8293f728a96a878d1d478  violin/LLVln_ArcoVib_E5_f.wav
8d1712f5659274a83aa90807132084559633e4817027c8a5b5f40826b3d9bc84  violin/LLVln_ArcoVib_E6_f.wav
80bae3776b0ccd3d4774f47429e829c7764f5fe6061ff844a8affc6ac68b7899  violin/LLVln_ArcoVib_G3_f.wav
14e3ea3d5172722d4d2686bae5da3d603800a7a474fa295d98275a9410913822  violin/LLVln_ArcoVib_G4_f.wav
b5bb27541d6187e6eeb20baf50625ca35fc9d44c7f113936a9369bc7ce490a68  violin/LLVln_ArcoVib_G5_f.wav
68c49e55565810ea822866e3d39e51c1a5ad53cfa1a67bc25836ca7feac3fe0c  violin/LLVln_ArcoVib_G6_f.wav
```
