# Audio policy — what may be used, and the rules every file obeys

purpose: which audio licences are usable here, the discipline every sample must follow, and what recording your own would cost
audience: whoever is about to download, commission or record audio for F1/F2/F3
updated: 2026-08-11

Split out of [README.md](README.md) on 2026-08-11 at its 400-line cap, by genre: that file carries
the feature briefs, this one the rules. **Nothing here changed in the move.** The per-file shopping
list — which recording, from where, under what licence — is [audio-sources.md](audio-sources.md).


F1 and F2 both need sound files, and the owner asked (2026-08-08) whether audio can be taken from the
internet while the app is free, and replaced with own recordings if it is ever monetised. **Yes —
that plan is legal and it works.** But "non-profit" is not what makes an asset safe, and the rule
that actually rules things out is a different one.

### Five categories — three usable, two not

| Category | Usable now? | The condition |
|---|---|---|
| **CC0 / public domain** | Yes | **None.** Any use, forever, including commercial |
| **CC BY** (attribution) | Yes | **One line in `/THIRD-PARTY.txt`**, and it is then safe commercially forever — no future swap owed |
| **CC BY-NC** | **Yes**, while the app is free | Must be removed before charging for anything |
| **Unknown licence** ("found on the internet") | **No** | There is no permission to rely on, free app or not |
| **"No redistribution" packs** (most commercial libraries, paid included) | **No** | See below |

⚠ **CC BY was missing from the first version of this table** (added 2026-08-09) and the omission
mattered: it is not a lesser NC, it is a *cleared* category that costs an attribution line, and it
is where the only free ney material lives. ⚠ **CC BY-SA is a different thing** — ShareAlike raises
the same open question as the SymbTr weights ([../THIRD-PARTY.md](../THIRD-PARTY.md)); treat it as
unresolved, not as CC BY.

NC is the *safe* one of the restricted options — it simply carries a bill if the app is ever
monetised. The two that block outright are the last two.

⚠ **The non-obvious one: "no redistribution".** Most sample packs — **including ones you pay for** —
permit using the sounds *inside a musical work* but forbid distributing the sample files themselves
("…in any form where they can be extracted"). A web app serves the raw file to every visitor, who
can save it straight out of the network tab. **That is precisely the forbidden act**, so a normal
commercial library cannot be used here even after paying for it. Buying a better library is not the
escape hatch it looks like.

### What CC0 actually covers — and where it runs out

**Well covered:** hand percussion, and the Western orchestra/band via community CC0 libraries
(Versilian's VCSL and VSCO 2 Community Edition are the usual starting points — verify the licence on
the project's own page, licences change).

**Thin to nonexistent:** ney, oud, tanbur, kemençe, zurna. Nobody has built a free public-domain
Turkish instrument library, which is the same gap that gives this app a reason to exist.

**Measured on 2026-08-09** rather than assumed — the per-file shortlist, with every licence read on
its own source page, is **[audio-sources.md](audio-sources.md)**. Two corrections came out of it:
**kanun is covered after all** (a CC0 chromatic set of isolated notes exists, from the CompMusic
project), and **ney is confirmed empty** under CC0, with one CC BY scale recording as a stopgap.

⚠ **"A recording exists" is not "a sample set exists."** A sampler needs notes at matched tone,
level and room, with clean starts. What turns up on upload sites is usually one person's phrase in
one room — unusable as an instrument even when the licence is perfect. And CC0 means free of
conditions, **not good**; quality ranges from excellent to unusable.

### The plan this leads to

| Instrument | Source | Cost |
|---|---|---|
| Darbuka, tef, bendir, zil | **CC0** — VCSL, plus a CompMusic düm/tek take | ~1 hour |
| Clarinet, violin | **CC0** — VSCO 2 Community Edition | ~1 hour |
| **Kanun** | **CC0** — a chromatic isolated-note recording (found 2026-08-09); A/B it against Karplus–Strong | ~1 hour |
| **Oud, tanbur** | **Karplus–Strong — no files at all** | code, not hunting |
| **Ney** | **Own recording** (one CC BY scale exists as a stopgap) | one evening |

Which file, from where, and what each still needs before it plays:
**[audio-sources.md](audio-sources.md)**.

This needs **no NC content anywhere**, which is why it is the recommended path: for percussion and
clarinet, CC0 is no harder to find than NC, so taking NC would buy a future obligation for nothing.
Where CC0 is genuinely thin (ney above all), **taking an NC file is a reasonable trade** rather than
stalling the feature — under the swap discipline below.

⚠ Note what NC would partly undo. On 2026-08-08 the owner chose **removal over attribution** for the
scores specifically to keep the app commercially unencumbered ([../DECISIONS.md](../DECISIONS.md),
[../THIRD-PARTY.md](../THIRD-PARTY.md)). NC audio re-introduces that bind in a different corner of
the same app. That is a defensible call to make differently for audio than for scores — but it
should be made on purpose, not by accident.

### Recording your own is more viable than it sounds

The owner plays ney and clarinet, is self-described amateur, and has no good microphone. For a
**sampler** that mostly does not matter:

- A sampler needs **one steady sustained note per pitch, ~2 seconds**. No phrasing, no tempo, no
  expression. Sounding good across a phrase is a performing skill; holding one clean tone is not the
  same skill, and the bar is far lower. Every note can be retaken twenty times.
- For single held notes **the room matters more than the microphone**. A phone at arm's length in a
  quiet room at night is adequate; steady background hum is the enemy, and steady hum against a
  steady note is the easy case to clean up.
- Ney is the instrument with no CC0 coverage *and* the one this app is most likely to be used with,
  so the owner is plausibly the cheapest available source of ney samples. Worth one evening before
  concluding otherwise.

### The swap discipline — required whatever is chosen

These three rules are what keep "replace it later" a one-evening job instead of impossible. They
apply to CC0 files too, because the audit question is asked of every file, not just the restricted
ones.

1. **Never bundle audio into the app.** Every sample stays a separate file loaded by URL — the way
   weights come from `VITE_WEIGHTS_URL` and never from `dist/`.
   ⚠ **AMENDED 2026-08-11** ([../DECISIONS.md](../DECISIONS.md)): audio may ship from the app's own
   `public/audio/` **while it stays under 1 MB**, which F2's two kits do at 660 KB. The rule was
   written against 211 MB of weights and did not carry at that size. What it was protecting is kept
   by the two rules below plus the loader's `VITE_AUDIO_URL` indirection, which is already in place
   and already tested against an off-app host — so the move is an upload and an env var, never a
   code change. `MAX_AUDIO_MB` in `prune-dist.mjs` fails the build when the limit is crossed and its
   message says to make that move. **Do not raise the number instead.**
2. **A manifest with `source` and `license` on every file, from the first one.** This is the rule
   that matters. These things do not fail as lawsuits; they fail as *"I no longer know where four of
   these came from"*, which makes the set unauditable and the swap impossible.
3. **Add each file to the third-party notices as it lands**, extending the existing
   `/THIRD-PARTY.txt`, never starting a second system.

⚠ Two cautions when downloading: verify the licence **on the source's own page**, not on a blog or an
aggregator that says "free" (free-to-download is not a licence); and on user-upload sites **CC0 is a
claim by the uploader**, who cannot grant rights they never held — an obviously ripped commercial
recording tagged CC0 is still unusable.

---
