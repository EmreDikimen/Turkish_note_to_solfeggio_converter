# August 2026, in plain words — the features that got built and put online

purpose: the plain-English account of the work finished in the first half of August, moved out of
OVERVIEW.md when that page hit its size limit
audience: the project owner (written in basic English, like its parent page)

updated: 2026-08-15

> Split out of [OVERVIEW.md](OVERVIEW.md) on 15 August 2026, the same way July's account was moved to
> [OVERVIEW-JULY.md](OVERVIEW-JULY.md). **Nothing was dropped in the move.** This page is *history* —
> what got built and why. For where the project is now and what happens next, go back to
> [OVERVIEW.md](OVERVIEW.md).

## 13 August 2026: the violin and the clarinet play, and they are LIVE

The thing your friends asked for is built and on the site. Pick **Çalgı sesi → Klarnet** or
**Keman** and the piece plays on a real recorded instrument instead of the plain computer tone.
The kanun is in too, since 2026-08-14. Its recording is one long take of every note, so it had to be
cut into 36 separate notes first — and the app had to learn that a plucked string is measured
differently from a blown or bowed one.

Three things are worth knowing in plain terms.

**The recordings are real, and they are not altered.** They are free-to-use recordings of a real
clarinet and a real violin. We do not cut or squash the files at all — they are downloaded exactly
as the people who recorded them made them, and the app decides which slice of each one to play. That
turned out to matter: you asked twice for the sound to be changed, and both times it cost nothing to
redo, because nothing had to be re-uploaded.

**Your microtones are exact.** This was the thing to get right, and it is measured: every koma, and
every makam that bends a note away from how it is written, comes out of the violin and the clarinet
at exactly the same pitch as the plain tone — to about one two-hundred-thousandth of a koma. ⚠ One
honest limit: the violin recording has *vibrato* (the player wobbling the pitch on purpose), and that
wobble is about **one koma wide**. The note's centre is right, but you cannot use the violin to hear
the difference between two neighbouring komas. **Use the clarinet for that** — it holds steady.

✅ **You listened, and it is finished.** Four times, and you were right every time: the short notes
were all breath; then the fix cut too much off the front; then the kanun was measurably out of tune
by one koma; then its notes started before the pluck. All four are fixed, measured and heard —
check 24 in [MANUAL_CHECKS.md](MANUAL_CHECKS.md) is closed. Worth noting how cheap that was: not one
of the four needed the files re-uploaded, because the app chooses which slice of a recording to play
rather than cutting the file. If you ever want the instruments **louder** — they are quieter than the
plain tone on purpose, so the sound can never crackle — that is still one number to change.

## 11 August 2026: you showed it to two friends, and they told you what to build next

You sent the link to two friends. **They liked it, and they said it would be good to add other
instrument sounds** — so the next piece of work was exactly that: playing a piece back on a
**violin, a clarinet and a kanun** instead of the plain tone. ✅ All three are **done and live**
(see the section above).

This is worth pausing on, because it is the thing the last three months of work were *for*. The plan
always said: get it into someone's hands, ask what to add, then build that. It has now happened, and
the answer was clear enough to act on.

**How good will they sound?** As good as the recordings are — you asked for full quality and nothing
gets squeezed. The catch is size: a single instrument is about **20 MB** of sound files, and all
three together are 40–60 MB. That is far too big to sit inside the app itself, so the files go to the
**same online storage the AI model already lives in**, and your browser fetches an instrument only
when you actually pick it. Nothing is downloaded for an instrument you never choose.

One nice accident came out of measuring this. The recordings are **7 to 10 seconds** of a single held
note — much longer than a sampler usually needs. Keeping them whole is the expensive-looking option,
but it is also the simpler one: no note in real music lasts that long, so the app never has to fake a
longer note by looping the sound, which is the usual way sampled instruments start sounding fake.

⚠ **Two honest limits.** It was **two people, and they are friends** — friendly reactions are not a
measurement, and they were asked *what to add* rather than *whether it is any good*. And the three
instruments are convenient: they happen to be the three we already have free, legal recordings for.
Ney, the one you play, has **no** free recording of usable quality anywhere — that one still needs an
evening of you and a quiet room.

## 11 August 2026: the usul now plays on a real drum, and it is LIVE

The app could already tap out the usul (the rhythm cycle), but the sound was **made by the computer**
— two tones pretending to be a drum. You listened and said it was not good enough, and you were
right. It now plays **real recordings of a real darbuka and a real bendir**, and you can switch
between them while the music plays. They are free-to-use recordings with no strings attached, so
nothing here can ever cost money or need removing later.

One problem was interesting enough to be worth knowing about. The recordings came in a set where the
five different hits are only **numbered** — nothing says which one is the deep centre hit (*düm*) and
which is the sharp rim hit (*tek*). Rather than guess, the computer **measured** them: a düm has its
energy low down and rings on, a tek is bright and over instantly. To check that this way of measuring
actually works, it was first tried on a second drum whose recordings *do* say what they are — and it
got them right. So the choices are not a guess.

Then you heard the drum sounding **"patlamış"** (blown out), and that was our mistake, not the
recordings'. The drum was simply set too loud: when a drum and a note sounded at the same moment they
added up to more than the loudspeaker can carry, and the tops of the waves got cut flat — which is
what that crunch is. The levels are lower now, and there is a safety device on the output so that
however far you push the drum volume slider, it can never do that again.

✅ **You listened, and all ten patterns passed** (*"they sound really nice"*, 11 August). That
included the **four we worked out ourselves** from the usul's beat grouping — Devr-i Hindî, Curcuna,
Aksak Semâi and Ağır Aksak — which no computer test could ever have judged. Nothing about the drums
is open now.

## 8–9 August 2026: the app no longer gives away other people's music, and that is now LIVE

You asked whether publishing the app causes a copyright problem. It did, and it is fixed — the full
plain-English answer is **[OVERVIEW-COPYRIGHT.md](OVERVIEW-COPYRIGHT.md)**. Short version: the
example songs built into the app came from a database whose licence says *nobody may ever make money
from anything built with it*, and two were by composers still in copyright. You chose to **remove the
examples** rather than credit them, so the app stays free of strings and now opens straight on
"upload your sheet music".

**Put online on 9 August.** Until that morning the website still handed out all five of those songs
to anyone who typed the file name — the fix existed only on this computer. Now every one of them
answers "not found", and the app was checked end to end afterwards and still reads a page both ways.

⚠ **Two copyright jobs are still open, and both are yours to decide.** The old files are still in
the **public code history** on GitHub (removing them means rewriting that history), and the project
still has **no LICENCE file** of its own. Detail: [THIRD-PARTY.md](THIRD-PARTY.md).

## 5 August 2026: the app now reads a whole page

**You can hand it a picture of a page and get music back.** Before that day the app could only read
small strips *after* someone else cut them up. Now you pick one image — a screenshot or a clean scan
— and the app cuts it, reads it, puts it back together, and shows a score you can play, edit and
save. On the test page: **7 lines of music → 16 strips → 344 notes**, and the browser and Python cut
it the same way, so the new cutter and the old one agree all the way through.

**The hard part was not the wiring, it was the waiting.** Checking a page for tilt froze the tab for
~35 seconds — no progress shown, and the browser offering to kill the page. Letting the check pause
between each of its 41 attempts fixed that with **no change to the answer** (identical on 20 pages).

✅ **Then the slowness itself was fixed: a page went from ~56 seconds to ~25.** The tilt check was
doing an expensive image operation 41 times, and that operation had an exact shortcut — not an
approximation, the *same answer* more cheaply — so it takes 7 milliseconds instead of 856. **Checked
as a shortcut, not an improvement:** both versions run side by side at every angle, **328
comparisons, zero disagreements**.

What is left of the 25 seconds is **the reading itself (~19 seconds)** — which is exactly the part
that moved to the server.

⚠ **One trap worth remembering:** for a while the first upload just hung, with the computer doing
nothing at all. It was not our code — the development tools were quietly reloading the page in the
middle of the job and throwing the upload away. One line of configuration fixed it.
