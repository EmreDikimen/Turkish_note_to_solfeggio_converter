# Makam selection — the performed intonation

purpose: the makam intonation table, its sources, and how a decoded page's makam is guessed
audience: anyone changing what playback sounds like, or adding a makam to the table
updated: 2026-09-05

Pipeline stage 9, the makam half. Design and the rest of the stage: [../PIPELINE.md](../PIPELINE.md).
State and next action: [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md).

## The problem

Playback used to sound every note exactly where the staff spells it. That is the **written
skeleton**, not what a performer plays. Arel-Ezgi-Uzdilek has four accidentals — koma (±1), bakiye
(±4), küçük (±5), büyük (±8) — and several perdes are performed away from all of them, because the
notation has no sign for where they really sit. Uşşak's segah is played below its written
koma-bemol; Sabâ's hicaz above its written bakiye-bemol; Hüzzam's hisar higher than written.

The page cannot tell you this. Only the makam can. So the app guesses the makam, asks the user to
confirm, and bends the **sounding** komas accordingly.

**The written staff never moves.** The deltas reach `buildTimeline` and nothing else — not the
engraving, not the saved document, not the training strips. Selecting a makam changes what you hear, never
what the OMR claims it read. `none` is the identity and the default.

## The intonation table

Lives in `MAKAM_INTONATION` (`packages/core/src/makam.ts`). A rule matches a note by its **written**
letter + written alteration, at every octave, and adds a signed comma delta to the sounding koma.
Deltas are fractional on purpose — the audio path is float, and the sources are not comma-integers.

| Makam(s) | Written perde | Delta | Sounds at | Why |
|---|---|---|---|---|
| ussak, beyati, bayati, isfahan, besteisfahan, bestenigar, karcigar, saba | segah — `B` at −1 | **−1.5** | −2.5 | Dügâh→segah collapses from AEU's 8 commas (181 c) to the 6–7 of practice, the *eksik büyük mücennep*; descent pulls it lower still. −1.5 is the midpoint, giving 6.5 commas ≈ 147 c |
| saba | hicaz — `D` at −4 | **+1.5** | −2.5 | Rauf Yektâ's 12/11 çargâh–hicaz puts 2.5 commas of flatness on the re-bemol, not 4 |
| huzzam | hisar — `E` at −4 | **+1** | −3 | The hüzzam pentachord's augmented second shrinks from 12 commas to ~10.5–11 |
| segah, huzzam | segah karar — `B` at −1 | **−1** | −2 | The Ottoman segah perde sits about a comma below the Arelian one |
| huseyni, muhayyer, tahir | — | **none** | — | Documented as **not** taking the uşşak lowering — hüseyni approaches segah higher, audible in its cadences |

Everything else is absent from the table: selectable in the dropdown, plays as written.

The last row is not padding. It is the reason detection has to work: hüseyni and uşşak print nearly
the same si koma-bemol and mean different perdes, so "same signature ⇒ same sound" is exactly the
inference that must not be made. Do not "complete" the table by symmetry.

**Deliberately not modelled.** Direction — the rules have no ascending/descending axis, though the
uşşak lowering is strongest in descent and karcığar's hicaz-on-nevâ is an *average* of the two.
Transposition — rules key on written spelling, which is right for canonical notation (each makam
written at its own perde) and wrong for a page written in another key; there is no degree-relative
resolution yet.

### Sources

- TDV İslâm Ansiklopedisi: [Uşşak](https://islamansiklopedisi.org.tr/ussak) ·
  [Hüzzam](https://islamansiklopedisi.org.tr/huzzam) · [Sabâ](https://islamansiklopedisi.org.tr/saba)
- [Türk musikisinde "sabâ" perdesinin nazariye ve icra analizi](https://dergipark.org.tr/en/download/article-file/3479433) (DergiPark)
- Hazım Gökçen, [Uşşak](https://www.hazimgokcen.net/turk-sanat-muzigi/ussak-makami/) /
  [Hüseyni](https://www.hazimgokcen.net/turk-sanat-muzigi/huseyni-makami-2/) /
  [Hüzzam](https://www.hazimgokcen.net/turk-sanat-muzigi/huzzam-makami/) — the uşşak/hüseyni contrast
- Yarman & Karaosmanoğlu, [Yarman-36 makam tone-system](https://www.ozanyarman.com/files/Yarman36.pdf)
  — the general AEU-vs-praxis mismatch
- Akkoç, [Experiments on the relationship between perde and seyir](https://sethares.engr.wisc.edu/paperspdf/MP3204_02_Akkoc.pdf)

The literature disagrees on the magnitudes (uşşak's lowering is variously 1–2 or 2–3 commas). The
table takes the midpoint where sources conflict and records the reasoning in each rule's `why`
string, which is what the UI shows. Changing a number is a one-line edit; **update this table too.**

## What the picker says (2026-09-05)

The dropdown marks a deviating makam with a **♪**, which says that *something* moves without saying
what. `apps/web/src/ui/MakamIntonation.tsx` is the rest of the answer, beside the picker and again
inside the post-decode prompt — one component in both places, so the two cannot describe one makam
two ways. Per rule it shows the **written perde** (Si with its koma-bemol drawn as the real Bravura
sign), **how far the note is really played from it** ("1,5 koma pes"), and **how many notes of this
score** the rule reaches; `neden?` unfolds the rule's own `why`.

Three things it does deliberately:

- **The count is the score's, not the table's.** A rule is a claim about a perde, not about the page
  in front of you. `makamRuleUsage` walks the same matcher `makamKomaDeltas` walks, so the number
  on screen and the pitches playback bends cannot drift apart.
- **Zero is shown, not hidden.** Hüzzam's hisar matches nothing on `gamzedeyim-deva`, and the line
  says *bu eserde yok* rather than promising a bend nobody will hear.
- **A makam that bends nothing gets one sentence** — *"Bu makam yazıldığı gibi çalınıyor."* — for
  every reason it might bend nothing (owner, 2026-09-05, cutting a first version that split "the
  sources report no deviation" from "not in our table"). ⚠ The difference is real and it lives
  **here and in the table**: hüseyni's `[]` is a finding, an unlisted makam is silence, and the
  empty arrays must never be deleted as clutter. It is just not a difference the transport bar owes
  a reader who is asking whether the piece will sound as it looks.

Contract for the checks: `[data-omr="makam-intonation"]` carries `data-makam` / `data-rules` /
`data-notes`, and each `[data-omr="makam-rule"]` carries `data-letter` / `data-alter` / `data-delta`
/ `data-notes` — so a check reads which perde bends and by how much without matching Turkish copy.
`npm run smoke:editor` re-derives the count from `window.__omrDoc` and asserts it.

### ⛔ The trap: the deltas are keyed by the WRITTEN document

`makamKomaDeltas` returns a map keyed by `NoteEvent.index` **of the written score**. A transpose
keeps those indices; **`unfoldDoc` does not** — it renumbers every event to a fresh 1..N. Applying
the written map to a performance therefore bends whatever note now holds that number, and **nothing
throws**, because every index still exists. The page just plays out of tune.

Two things renumber, and the second is the one that surprises: a repeated bar (one written note,
several sounding ones) — and, on a page with **no repeat at all**, the `meta` events the unfolder
drops (`groupMeasures` skips them, shifting every later index down).

It shipped that way from 2026-08-30 to 2026-09-05 and was found **by ear**, not by a check: on
`gamzedeyim-deva` under uşşak, **19 of the 22 bent notes were the wrong ones** — a Re, a La, a Do
and a 2-koma si taking the segah's lowering, while three landed right by luck. The fix is
`remapKomaDeltas(deltas, played.srcOf)`, and `tools/core/makam-test.ts` pins it.

⚠ **Re-key, do not bend before unfolding.** `perf.doc` is what the instrument views read, and a
kanun course is looked up by an exact **written** koma — a fractional one misses it. The bend
belongs to the timeline and to nothing else.

⚠ **A segah spelled `b2` is not matched, and that is correct — it is a SymbTr artefact** (owner,
2026-09-05). The rules key on the exact written alteration while the staff draws the nearest AEU
sign, so on the bundled SymbTr exports a `Si4b2` and a `Si4b1` are one koma-bemol on screen and only
the second bends: `gamzedeyim-deva` **22 against 54**, `beyati-delisin` **0 against 40**. ⛔ **A real
page cannot spell one.** The model's vocabulary is the 8 AEU accidentals plus a natural
(`ADDED_TOKENS`), and a printed edition prints only those four signs, so a decode yields ±1/±4/±5/±8
— `decoded.json`, the one bundled score that came from a photograph, reads 2 `b1` / 0 `b2`. Do not
"fix" the matcher by snapping: it would make the editor's deliberate ±2/±3 stop meaning what they
say, for one hand-placed note. Full reasoning and the two residues: [../BACKLOG.md](../BACKLOG.md).

## Guessing the makam from a decoded page

A decoded page has no metadata — `tools/render/stitch.ts` writes `makam: ""` — so `detectMakam`
reads it out of the notes:

1. **Signature.** `deriveKeySignature(doc)` → `signatureKey` → the exact string
   `data/makam_signatures.json` is keyed on (`"\komaFlat b \bakiyeSharp f"`). No match at all →
   `none`, and playback stays as written.
2. **Karar.** The last sounding note, as written. Required, not garnish:
   `\komaFlat b \bakiyeFlat e \bakiyeSharp f` is printed by **hüzzam** (karar segah),
   **karcığar** (dügâh) and **sûznâk** (rast) — three makams, three different intonations, one
   signature. `MAKAM_KARAR` covers only the makams where the karar disambiguates or is certain;
   guessing the rest would add wrong labels for no gain.
3. **Contradiction ⇒ decline.** If some candidate declares a karar and the piece ends somewhere
   else, return `none` rather than rank. A wrong makam detunes notes that should not move; `none`
   only declines to help.
4. **Otherwise rank by corpus weight** — how many adjudication-confirmed real strips showed that
   makam printing that signature.

The user is then asked (`apps/web/src/MakamModal.tsx`), and the prompt shows its own evidence — the
signature it matched, the karar it used, the makams that share the signature — because "Hüzzam"
with nothing behind it is not something anyone can sanity-check.

Accuracy, and the caveat that it is measured on clean scores rather than decoded pages:
[../METRICS.md](../METRICS.md).

## Where the code is

| Piece | File |
|---|---|
| Table, karar, detection, deltas | `packages/core/src/makam.ts` |
| Signature table (GENERATED — do not hand-edit) | `packages/core/src/makamSignatures.ts` |
| Its generator (`--ts-out` / `--from-json`) | `scripts/build_makam_signatures.py` |
| The prompt | `apps/web/src/MakamModal.tsx` |
| The line beside the picker, shared with the prompt | `apps/web/src/ui/MakamIntonation.tsx` |
| The rules, the deltas, the re-key and the picker's counts | `tools/core/makam-test.ts` (in `npm test`) |
| Dropdown + the audio wiring (`makamDeltas` / `makamUsage` → `timeline`) | `apps/web/src/App.tsx` |
| Smoke-check dismissal helper | `tools/browser/makamPrompt.ts` |

Two duplications are deliberate and both are pinned by tests:

- `SIG_TOKEN_BY_ALTER` in core mirrors `AEU_TOKEN` in `tools/render/lilypond.ts` — core must not
  depend on `tools/`, and the label path is load-bearing enough not to move. `npm test` round-trips
  every signature in the generated table through both vocabularies.
- `packages/core/src/makamSignatures.ts` mirrors `data/makam_signatures.json` — the app ships
  without `data/` and without Python. One script writes both; re-emit with
  `--from-json data/makam_signatures.json --ts-out packages/core/src/makamSignatures.ts` so a
  refresh of the TS copy cannot silently rewrite the JSON from whatever pools are on the machine.

## Adding a makam to the table

1. Find its signature in `data/makam_signatures.json`. If it is missing, the makam is not in the
   corpus and detection will never propose it — add a `THEORY` row in the builder first.
2. Add a `MAKAM_KARAR` entry **only if you are sure**, and a `MAKAM_INTONATION` entry **only with a
   source**. An empty array is a real answer and belongs in the table when a source says so.
3. Add the row to the table above, with the citation. The rule's `why` is what the picker prints,
   so write it in plain Turkish for a reader, not as a note to yourself.
4. `npm test` (signature vocabulary), `npm run typecheck`, `npm run smoke:editor` (the picker's
   line), then check 14 in [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md) — the only check that uses
   your ears.
