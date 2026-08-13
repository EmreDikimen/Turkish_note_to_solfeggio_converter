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

**These are untouched VSCO 2 Community Edition files.** Nothing has been trimmed, compressed,
downmixed, resampled or re-levelled — full length, stereo, original bit depth, original filenames.
`scripts/prepare_voices.py` in the app's repo copies them and verifies sha256 against the source; the
hashes below are the check. Playback level is applied in the app, not baked into a file.

| Folder | Source | Files | Size |
|---|---|---|---|
| `clarinet/` | `Woodwinds/Clarinet/susLong`, v2 (middle) velocity layer | 11 | 20.2 MB |
| `violin/` | `Strings/Solo Violin/Arco Vib`, `f` layer | 15 | 35.4 MB |

## Licence

**CC0 1.0**, from <https://github.com/sgossner/VSCO-2-CE> (its `LICENSE` is the CC0 1.0 legalcode).

Credit is given although CC0 does not require it: VSCO 2 CE's readme asks for credit to **Versilian
Studios LLC / Sam Gossner**, which costs one line. Where that readme's "Terms" conflict with the CC0
file beside them, CC0 governs — it is irrevocable once applied. Only Versilian's own clarinet and
solo violin recordings are taken here, never the v1.1 "legacy" / Ivy Audio material, where the
provenance is mixed.

## Two things worth knowing before using these elsewhere

**The clarinet's pitch labels are an octave below its sounding pitch.** `DCClar_susLong_D2_…` sounds
D3 (146.7 Hz). Measured across all 11 files, consistently. The violin's labels are scientific pitch
and need no offset — it was the control. Do not read a pitch off a filename.

**`DCClar_susLong_F#5_v2_rr1_sum.wav` sounds F6, not F#6.** 1397 Hz, confirmed against its own second
partial at 2794 Hz — it is mislabelled by a semitone at source. The file is in tune with itself and
perfectly usable; it is kept under its original name because the name is provenance, and the app
carries measured frequencies rather than parsed ones.

## Checksums

```
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
