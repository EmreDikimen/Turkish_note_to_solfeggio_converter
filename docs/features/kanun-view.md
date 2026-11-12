# F3 — the kanun view

purpose: the design, the instrument data and the decisions behind the kanun half of the fingerboard tab
audience: agents and the owner working on the kanun view, before changing the courses, the mandals or the drawing
updated: 2026-11-12

> This is the kanun chapter of F3; the violin chapter is [fingerboard.md](fingerboard.md) and the
> track index is [README.md](README.md). ⚠ Since 2026-08-29 the two share **one tab**, *Enstrüman
> üzerinde*, with a dropdown that also sets the playback voice — see [README.md](README.md). Current state is in [../STATUS.md](../STATUS.md).
> ⚠ Not to be confused with [kanun.md](kanun.md), which is about F1's kanun **sound**.

Show which course is plucked, and where the mandals stand, as the piece plays.

## The scope decision (owner, 2026-08-29)

F3 shipped **violin only** on 2026-08-15, and that was a real decision with reasons
([fingerboard.md](fingerboard.md)). The owner reopened it two weeks later, after seeing the violin
view stood up: *"Şimdi biz kemanı ekledik çok hoş. Kanunu eklemeye başlayabiliriz."* The kanun is
the natural second instrument for the same reason the violin was the first — **it is already a
shipped F1 voice**, so it can be heard and seen at once.

## Why this is not the violin view with a different picture

This is the part that decides the whole design, so it is first.

**A violin position is a fact about one note.** The finger goes there, the note ends, the finger
leaves. Every note is an independent lookup, which is why `Fingerboard.tsx` can draw the current
frame from the current note and nothing else.

**A mandal is a fact about the whole piece.** It is a small lever under one course; raising it
shortens the strings by one mandal step (16.67 cents, not a koma — below), and it **stays where it is put** until somebody moves it. So the
picture of a kanun "right now" is not a function of the note being played — it is a function of
every mandal move made since the piece began. The view is a small **state machine**, not a lookup.

Two things follow that the violin has no version of at all:

1. **There is something to show before a note is played.** A kanun player sets the makam's mandals
   *before* starting, the way a violinist tunes. That opening setting is the picture this view
   starts on, and it is also listed in words above the instrument.
⭐ **The levers on a course are CONTIGUOUS, and they rise from the NUT side** (owner, 2026-11-11,
from Günalçin 2013: *"sol taraftaki altı adedi kalkık, diğer mandalların tamamı yatık"*). The first
`raised` levers are up and every later one is down; the **last one up** sets the pitch and carries
`data-mandal-active`. ⚠ This REVERSES the 2026-10-27 drawing (the active lever and everything to its
*right* up), which had been confirmed by word of mouth and could not describe a working instrument:
the raised lever nearest the bridge is the one that stops the string, so levers up on the bridge side
would always win.

2. **A mandal change is an EVENT.** Which lever is up is already readable from the picture, so red
   is spent on *something just moved* rather than on *this is the state*.

## How many mandals? It differs BY COURSE (2026-11-11, re-counted 2026-11-12)

⭐ **WHAT SHIPS SINCE 2026-11-12 IS THE OWNER'S COUNT ON A REAL INSTRUMENT, NOT THE PAPER'S TABLE**
— [kanun-mandal-count.md](kanun-mandal-count.md) has every course. It differs from the table below
in three places: **Sol is 9 (6 + 3) and La is 8 (6 + 2)**; the **top six courses** carry fewer
levers, falling to 2 on Tiz Muhayyer; and the **lowest course** carries 3. The total is **212**.
Everything else on this page — the 72-step grid, six up at the natural, the gap, the direction —
is the paper's and stands. ⚠ On the end courses only a TOTAL was counted; how it splits into up and
down is a guess from a photo, and three of the top six were not counted by the owner at all.
`MandalLayout.courses` holds those rows; a regular course is still looked up by its letter.


Until 2026-11-11 every course carried 12 mandals of one koma each. The owner said that was wrong and
asked for a search. One paper answers it with measurements: **Günalçin, *Kanunda Ses Sistemi
Sorunları Üzerine Bir Araştırma*, Rast Müzikoloji Dergisi I/2 (2013), s. 75–106**
([PDF](https://dergipark.org.tr/tr/download/article-file/115256)), which counted the levers on the
instruments of **nine Turkish makers** (Tablo 1; the text says ten, the table has nine rows).

| Course (every octave) | Up at the natural | Down at the natural | Total | Kind |
|---|---|---|---|---|
| Do, Fa | 6 | 6 | **12** | *bitişik* — no gap |
| Sol | 6 | 4 | **10** | *ayrık* — a gap |
| Re, La | 6 | 3 | **9** | *ayrık* |
| Mi, Si | 6 | 2 | **8** | *ayrık* |

- **The "up" half is 6 on all nine instruments, on every course.** Lowering them one at a time
  flattens the course a step at a time; all six down is the open string.
- **Do and Fa are 6 + 6 on all nine.** Sol is 6 + 4 on all nine. The other four vary by **one**
  lever between makers; the row above is the majority, and it is the one the paper itself adopts
  for its own sums (*"Neva ve Dügâh için üç, Hüseynî Aşîran ve Bûselik için iki, Rast için dört"*).
- ⭐ **On an *ayrık* course the extra levers are the TOP of the sharp semitone**, behind a gap
  (Şekil 1). Tablo 7 confirms it by pitch: Yegâh's two sharps measure **83.34** and **100** cents,
  which are steps 5 and 6, not 1 and 2. So Re has no lever at 1–3 steps sharp at all.

### A mandal is 16.67 cents, not a koma

*"Altı mandal 100 cent'lik bir aralık bandında 16,66 centlik aralıklarla yerleştirilmektedir… kanunun
72 eşit aralıklı tampere sisteme sahip bir çalgı olduğunu ortaya koymaktadır."* A second source says
the same from the bench — the maker Ümit Bolu: *"16,66 cent'e geliyor benim 1 mandal büyüklüğüm"*
([kanun yapımcılığı derlemesi](https://dergipark.org.tr/en/download/article-file/927049)).

So the instrument counts in 72nds of an octave under a notation that counts in 53rds:

| Written | Wants (steps) | Played on | Error (paper, Tablo 7) |
|---|---|---|---|
| 1 koma (fazla) | 1.36 | mandal **1** | 6.8 cents |
| 4 komas (bakiye) | 5.43 | mandal **5** | 6.9 cents |
| 5 komas (küçük mücenneb) | 6.79 | mandal **6**, the full semitone | 13.7 cents |

`MANDAL_STEP_KOMA` (53/72) is that conversion and `MANDAL_LAYOUTS` holds the table above, both in
`packages/core/src/kanun.ts`. Another maker's instrument is another row; nothing counts levers on
its own.

⚠ **Three things the paper does not settle, stated rather than guessed:**
- **The highest courses.** It says the values differ *"mandal tahtasının daraldığı tiz bölge"* (Tiz
  Nevâ – Tiz Muhayyer) and gives no numbers. ✅ Counted on the owner's instrument 2026-11-12.
- **Whether the owner's own kanun matches.** ✅ Checked 2026-11-12: it matches on Do, Re, Mi, Fa, Si
  and differs on Sol and La by one lever each — against the paper's *"Sol is 6 + 4 on all nine"*.
- **Older sources quoting "one mandal = one koma"** (the earlier research here) are describing the
  *use* — one koma is one lever — not the spacing.

⚠ **A note can now be unplayable in the MIDDLE of the range.** One koma sharp on Re wants 1.36
steps and Re's next lever is at 4, and no neighbour reaches either. `place` returns `null` and the
view says `out-of-range` — it does not round onto the natural. The limit is `REACH_STEPS` = one
step, read off the instrument: half a step would refuse the 5-koma flat every kanun plays.

## The courses: 26 perde, and two checks that were run

`KANUN_COURSES` runs **Kaba Yegâh (written D3) → Tiz Muhayyer (written A6)**, one natural note per
course. Two independent things say that span is right, and neither was assumed:

1. **The count falls out of it.** The natural notes from D3 to A6 inclusive number **exactly 26** —
   the professional kanun's perde count. Nothing was padded to make that true.
2. **The top matches F1's recording.** Tiz Muhayyer sounds **1319.9 Hz** on this project's grid; the
   top note of the CC0 kanun take is **1325.3 Hz** (`kanun_02_E6.wav`,
   [audio-sources.md](audio-sources.md)). That is **0.31 of a koma** apart. ⚠ The *bottom* does not
   match — the take starts well above Kaba Yegâh — and that is not evidence of anything: a recording
   may stop early where an instrument may not. Only the top is a check.

⚠ **The names are WRITTEN pitches, and the fourth is already inside the tuning anchor.** Comma 327
is written D5 and **sounds** 440 Hz (`tuning.ts`), so `naturalKoma` on a written name gives a comma
that `koma53ToFreq` turns into real concert Hz. Do not correct for the fourth a second time.

## The plan: an opening setting, then the changes

`planMandals` walks the piece in two passes, because a kanun player does:

1. **Place every note.** The written spelling names the course.
2. **Read the opening setting off pass 1, then walk it.** Each course opens at the mandal it uses
   **most** across the piece; an unused course opens natural. Every later disagreement is a change,
   recorded at the note that forced it.

⚠ **The majority, not the first note.** A piece in uşşak that happens to open on a natural Si must
still *set* the flat before playing — otherwise one passing accidental at bar 1 becomes the piece's
makam and every later note reads as a change. This is pinned by a test.

⭐ **The ambiguity the violin had to solve does not exist here, because the notation already answered
it.** A player reading a Si♭ lowers the **Si** course; they do not play it on the La course raised,
even at 5 komas where the raised La is arithmetically *nearer* its own natural. So there is no
search, no cost function and no thrashing to guard against — the trap that cost the violin's
string-choice rule a rewrite ([fingerboard.md](fingerboard.md)) cannot arise. The only search left
is the fallback for a note the written course genuinely cannot reach.

Measured over the four scores on disk with the 2026-11-11 layout — and **unchanged under the
2026-11-12 one** (same four rows, re-run) — on the written events (no makam
deltas, repeats not unfolded):

| piece | notes | unreachable | respelled | courses used | mandal changes |
|---|---|---|---|---|---|
| `meltem_notes` | 83 | 0 | 0 | 12 | 1 |
| `beyati-delisin` | 429 | 0 | 0 | 12 | 39 |
| `safalar-getirdiniz` | 824 | 0 | 0 | 11 | 32 |
| `gamzedeyim-deva` | 539 | 0 | 0 | 10 | 40 |

⚠ **Zero unreachable and zero respelled across 1,875 notes** says two things: the written-course
rule still answers every time, and the gaps on the *ayrık* courses cost this repertoire nothing —
which is presumably why makers leave them. ⚠ Four pieces is a small sample; a makam that writes a
small sharp on Re, Mi, La or Si would show it. ⚠ And **10–12 courses of 26** is what makes the
close-up worth building: more than half the instrument is idle in any one piece.

## What a kanun cannot play exactly

Almost nothing but a natural lands exactly, because of the 72-against-53 mismatch above. The
nearest lever is taken and the leftover is reported as `residual` (in komas) rather than hidden —
the largest on the four scores is **0.58 of a koma**, the 5-koma flat on the full semitone.

⚠ **An exact tie between two levers leans towards the NATURAL.** `Math.round` breaks a tie towards
+∞, so the same interval would lean one way written as a flat and the other way written as a sharp.
Found by a test, not by eye. (Until 2026-11-11 this mattered for uşşak's −1.5 komas; on the 72 grid
that is −2.04 steps and no longer a tie, but the rule stays.)

## ⭐ The view is more precise than the page it came from

The mandals are read from the event's **`koma53`**, and the spelling gives only the letter and
octave. The two genuinely disagree in the shipped scores, and it is not a bug in either:
`ui/accidentals.ts` stores ±2 and ±3 comma alterations **exactly** while the engraver prints the
**nearest standard AEU sign**, because that is what a Turkish edition prints. `beyati-delisin` has
**36 notes drawn with a koma-bemol and stored two komas flat**; `gamzedeyim-deva` has 54.

A mandal makes a *sound*, so this view follows the stored comma: two komas flat want 2.72 steps, and
it shows `Segâh −3` (three mandals down) where the staff shows a one-koma sign. **More precise than the page, not
inconsistent with it** — and worth knowing before someone "fixes" it.

## The drawing (owner, 2026-08-29: SVG, not a photograph)

The violin is a licensed photo and its geometry file is a *calibration*. The kanun is **drawn**, so
`ui/kanunGeometry.ts` is generated and there is nothing to measure. Three reasons that is the better
choice here, none of them about effort:

- **The mandals are the whole point and are unreadable in any photograph of a whole kanun.** They
  are barely visible in the reference image the owner supplied.
- **No licence chain to follow** — the one real cost the violin's artwork carried.
- A drawing can fit 26 courses on a phone; a photograph cannot.

⚠ **The shape is schematic and says so.** Real string lengths do not follow 1/frequency — three and
a half octaves would need an **11:1** trapezoid, and no kanun is anywhere near that, because the
maker compensates with string gauge instead. The taper is therefore a chosen ratio (~2.3:1). ⛔ Do
not "fix" it by deriving it from the tuning: that would be both wrong and ugly. Everything that
carries *meaning* — which course, which mandal, what is lit — **is** derived.

Drawing decisions worth keeping — the last four are the owner's, from seeing the first version:

- **Course 0 is the lowest and is drawn at the BOTTOM.** A kanun sits the other way round under the
  player's hands; matching the app's own up-is-higher (sheet, piano roll) is worth more than
  matching the posture.
- **A perde is THREE STRINGS, not one** (owner, 2026-08-29). The first version drew one line per
  course and called it an honest summary; it was a summary that lost the instrument. The three
  share one lever, because the mandal stops the whole course, and they light together, because a
  player plucks a course and never one of its strings. ⚠ The spacing was set by **looking**: at 2.4
  units the three strokes merged into one grey band at full zoom, which is the one thing drawing
  three of them was meant to avoid.
- **The body's left edge hugs the levers, and the perde names sit OUTSIDE it** (owner, 2026-08-29:
  *"sol tarafın eğimi perdelerin kısalmasıyla aynı olsun, perde isimleri dışta kalsın"*). Every
  course's lever block is the same width, so a constant margin makes the edge exactly parallel to
  the diagonal the courses shorten along. ⚠ **`bodyOutline` must extrapolate that diagonal, not join
  the two end courses' own x positions** — the body reaches past the top and bottom courses, and on
  a slanted edge those strips move the edge sideways too. The first attempt joined the corners and
  the result was visible: the top courses' names landed **on the wood** and the bottom courses'
  levers **stuck out past the body**.
- **A lever is drawn where its PITCH is, so a course with a gap shows the gap** (2026-11-11). Every
  course's block is 12 positions wide; Re fills positions 1–6 and 10–12. That keeps the left edge's
  slope and is what the instrument looks like (Günalçin, Şekil 1).
- **Several levers are up at once and the last one up is the active one.** ⚠ **None up is a real
  setting** — the open string, a semitone flat — so a course can have NO active lever; the row's
  `data-raised` is the state.
- ⚠ **TWO COLOURS, NOT FILLED-VERSUS-EMPTY** (owner, 2026-08-29: *"açık mandallar bir renkte,
  kapalı mandallar farklı bir renkte olsun... birbirinden ayrı ayırabilelim"*). The first version
  drew a raised lever filled and a lowered one as a faint outline. An empty box reads as **absence**
  rather than as a state, and on brown wood a faint outline is nearly invisible at the size these
  are drawn. Both are now solid and sit on **opposite sides of the wood's lightness** — ivory raised,
  near-black lowered — so they are told apart at a glance and at any zoom. The natural's position is
  an **amber dashed stroke**, chosen to show on both fills and not to be confused with red.

### The close-up, and the trap that made it necessary

26 courses carry **212 levers**; at full width each is about **four screen pixels** on a
phone — a texture, not something you can read. **Mandallara yaklaş** (`#kanun-zoom`) crops both ways
— the long string tails go, and so do the courses the piece never plays.

⚠ **`fitAspect` is load-bearing and is not polish.** An `<svg>` fits its viewBox inside the box CSS
gives it and pads the leftover dimension, so a crop of a different *shape* gets letterboxed: half
the frame goes empty and the rows at the top and bottom of the crop are **cut through the middle**.
Growing the window to the full view's shape makes the close-up a pure magnification. ⚠ For the same
reason the height cap in `app.css` is written as a **max-width** — capping the height would leave
the width where it was and reintroduce the letterbox.

## What red means (owner, 2026-08-29)

Two readings were put to the owner and the **event** one was chosen: *"sadece o an değişen mandal
kırmızı, sonra söner"*.

- **The sounding course** is a red line, for as long as it sounds.
- **A mandal that has just moved** flashes — ⚠ **as a red FRAME, never a red fill** (owner,
  2026-08-29: *"sadece değişenlerin frame i kırmızı olsun"*). This is not styling: the **fill is
  carrying the up/down state**, so a red fill would black out exactly the information the flash is
  drawing attention to. The lever that came up gets a solid frame, the one that went down a dashed
  one, so the move reads as a move rather than as two unrelated marks. It is lit for as long as the
  note that forced it sounds, but never less than **700 ms** — a mandal moving on a sixteenth note is
  still a mandal moving, and a 90 ms flash is one the eye does not catch.

⚠ The state is deliberately *not* carried by colour: which lever is up is readable from the fill, so
red stays reserved for the event. The rejected alternative — everything away from the opening
setting stays red — is written down here because it is a reasonable design and may come back if the
flash turns out to be missable in use.

## The opening list (owner, 2026-08-29)

Above the instrument, in words: *Çalmadan önce kurulacak mandallar: Segâh −3*. ⚠ The number is
**mandals from the natural setting** — how many to lower or raise — not komas and not steps: on Re,
`+2` is two more levers up and five steps sharp. The planner produces
it anyway, and it is the one part of this view that is useful **without playing anything** — it is
the mandal plan for the piece, which is a thing a kanun student would want on its own.

## Known limits, stated rather than discovered later

- ⚠ **Nobody has looked at this with an eye yet.** It has passed the unit tests, the browser checks
  and screenshots taken during the build; that is not the same as a musician judging it. Check 26 in
  [../MANUAL_CHECKS-FEATURES.md](../MANUAL_CHECKS-FEATURES.md).
- ⚠ **A change is drawn at the note that needs it.** A real player moves the lever slightly *before*
  that note, with the free hand. Nothing here models the anticipation.
- ⚠ **The layout is the majority of nine makers, not any one instrument**, and the highest courses
  are unmeasured (above). There is no picker because there is only one row.
- ⚠ **On a phone the full view is still a texture.** The close-up is the answer and it is one click
  away, but it is off by default. If the owner finds himself always turning it on, the default
  should flip.

## What the checks assert

- `tools/core/kanun-test.ts` (in `npm test`) — the arithmetic: the course table re-derived from its
  own perde names, the span against the recording, **the lever count per course and the gap**, the
  koma → mandal table, **the written spelling beating the nearer course**, a note the gap makes
  unplayable, the tie, and the plan's opening/changes behaviour.
- `tools/browser/editor-smoke.ts` — the DOM: 212 levers **and all 26 per-course counts by value**,
  **78 strings** (26 courses of three — a total, because the failure worth catching is the view
  going back to one line each), **every row consistent with its own `data-raised` at every sample
  taken across a whole playback** (the state machine's invariant), the opening setting **by
  value**, the close-up as geometry, a course lighting and moving, and a change flashing **on the
  right course at the right mandal**. ⚠ It also asserts the opening setting **differs between two
  pieces** — the deliberate opposite of the violin's check that its chart does *not* move.
