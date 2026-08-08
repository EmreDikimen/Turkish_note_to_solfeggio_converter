# The copyright question, in plain words

purpose: the plain-English answer to "can I publish this app?", split out of OVERVIEW.md at the 400-line cap
audience: the project owner (basic English, same as OVERVIEW)
updated: 2026-08-08

> Split out of [OVERVIEW.md](OVERVIEW.md) on 2026-08-08. The technical version — every licence and
> the rule it imposes — is [THIRD-PARTY.md](THIRD-PARTY.md).

You asked whether publishing the app causes a copyright problem. It did. It is fixed now, but it is
not on the website yet.

One thing to be clear about first: the app **was already public**. It had been on the internet with
no password since 6 August. So this was not a question about the future — it was about something
already happening.

## What was wrong

**The example songs.** The app came with a few songs built in, so a visitor had something to listen
to straight away. Every one of them was made from a music database called **SymbTr**. SymbTr is free
to use, but with a rule attached: *nobody may ever make money from anything built with it.* For as
long as the app handed out one of those songs, that rule stuck to the app.

**Two of the songs had a second, separate problem.** Their composers are still in copyright. In
Turkey copyright lasts **70 years after the composer dies**:

| Song | Composer | Died | Free to use in |
|---|---|---|---|
| safalar getirdiniz | Avni Anıl | 2008 | about 2079 |
| delisin deli | Selahattin Pınar | 1960 | about 2031 |
| gamzedeyim deva | Tatyos Efendi | 1913 | already free |
| aldanma dünya | Zekai Dede | 1897 | already free |

Giving away a full, playable copy of a song that is still in copyright is not a small thing, and
crediting the composer would not have made it allowed.

**A photo of someone else's printed page** (`Meltem - 1. Hane.png`) had been saved into the public
code repository by accident.

## What we did

You chose to **take the examples out** rather than add a credits line. That was the better call: a
credits line would have fixed the politeness problem but left the "no money, ever" rule attached to
the app for good, and undoing that later means doing this work twice.

So the app now opens straight on "upload your sheet music". There is nothing built in to listen to
first. The example files still sit on your own computer for testing — they are simply never sent to
anybody.

We also put a guard in the build. It is easy to think "nothing in the app links to that file, so
nobody can see it" — but that is not true on a website. Anyone who guesses the file's name can open
it. So the build now **refuses to finish** if any song file is sitting in the published folder,
whether or not anything links to it. It was tested by deliberately putting one there: the build
stopped.

## Three smaller things, all done

- **A short footer.** It says your uploaded photos are not stored — which is true, the server never
  saves them — that the music you upload is your own responsibility, and where to complain if
  someone objects. Complaints go to the project's issue page, not your email address.
- **The free software list.** Every open-source piece the app uses is now listed with its licence,
  the way those licences ask.
- **The model page.** The model on Hugging Face now has a proper description. The model we started
  from is free to build on, but its licence asks to be credited, and it was not.

## What was already fine

Worth knowing, because it is the biggest reason none of this was serious:

- **The server never keeps your uploads.** It reads the photo and forgets it. There is no pile of
  other people's sheet music sitting on a computer somewhere.
- **The music font** was already shipped correctly, with its licence next to it.
- **Makam theory itself cannot be copyrighted** — the 53-koma system, the makam names, the usul
  names. Those are facts, and facts are free.

## Two things left for you to decide

Neither is mine to choose.

1. **The old files are still in the project's history.** They are gone from the current code, but
   the project keeps a record of every past version, and anybody can read it. Erasing that is
   possible, but it breaks every copy of the project anyone has already downloaded.
2. **The project has no licence file**, so legally it is "all rights reserved" — nobody may reuse
   your code. That is fine while you work alone. It needs an answer before anyone else joins.

⚠ **None of this is live yet.** The website still shows the old version, examples and all, until the
next deploy.
