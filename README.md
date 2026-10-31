# Little Hero Books

Personalised picture books for little ones. A parent designs a cartoon look-alike of their child (face, skin tone,
hair, eyes, clothes, hats, glasses, plus name and pronouns), then picks from eight public-domain fairy tales retold short
(300-500 words) for ages 3-6. Every illustration has a space where the child goes; the app draws the child into it, and
the finished 12-page book can be read on screen (page turns, "Read to me") or downloaded as a square 8 x 8 in PDF.
Theme: happy, joyous kindergarten ("Crayon Classroom"). Built on [Anvil](https://anvil.works).

- **App repo:** github.com/arkulinskis/little-hero-books (branch `master`). Anvil pulls `master`.
- **Live:** https://little-hero-books.anvil.app

## What it does

Keep this list current: it is the first thing read before every change.

**For everyone (no account needed):**
- **Landing page:** an open-book hero picture that cycles through five example kids, an 8-book shelf that changes star
  when you tap a face, how it works, features, safety, FAQ.
- **Hero studio** (`#studio`): 2 sizes (big kid, little one), 8 skin tones, 5 face shapes, cheeks and freckles, 3 noses,
  14 hairstyles x 11 hair colours, 5 eye shapes x 7 eye colours, 4 eyebrows, 5 smiles, 7 outfits x 10 colours, 7 hats,
  4 glasses. Live preview with poses (Hello, Wave, Hooray, Skip), "Surprise me", Undo, the child's name and pronouns
  (she / he / they), and "Try it in a story" (the current hero on a story cover). Guests keep a draft in the browser;
  pressing Save as a guest goes to sign-up and saves the hero automatically afterwards.
- **Story library** (`#library`): 8 tales (Three Bears, Enormous Turnip, Magic Porridge Pot, Emperor's New Clothes,
  Beanstalk, Little Red Hen, Elves and the Shoemaker, Princess and the Pea). A "Starring" strip redraws every cover with
  the chosen hero: yours, your studio draft, one of 4 example heroes, or the **blank book** (the generic version with a
  "your hero here" outline in every picture).
- **Story preview** (`#story/<key>/<hero>`): the reader with any hero.
- **Family links** (`#read/<key>`): a shared book anyone with the link can read and download.
- Sign-up with email and password, a feedback form, and the Privacy & Terms page (footer link, `#legal`).

**For members:**
- **Bookshelf** (`#home`): your heroes (up to 12), your books on wooden shelves with reading stars, "Next adventures"
  (stories your first hero isn't in yet), and the example shelf.
- **Make a book:** pick a story and a hero, add a dedication (or tap a suggestion), and it lands on your shelf.
- **Reader** (`#book/<id>`): cover, "This book belongs to" page with the dedication, 9 illustrated story pages with the
  name highlighted, "The End" with credits. Arrows, swipe, keyboard, page dots, confetti at the end (counts a reading
  star), "Read to me" (speech synthesis, turns pages by itself).
- **PDF download:** 12 square pages (8 x 8 in, 1500 px JPEG pages) drawn in the browser and written by a small built-in
  PDF writer: nothing uploaded, no third-party library.
- **Family link** per book (on/off), edit the dedication, remove a book, edit or remove a hero (removes their books).

**For admins** (`#admin`; arkulinskis@gmail.com becomes an admin on first sign-in):
- **Feedback inbox:** New / Read / Done, private notes.
- **Users:** search, make admin, disable an account.
- **Library:** the 8 stories with word counts, how many real books each became and how many reads.
- **Demo data:** 3 example parents, 4 example heroes (Juniper, Kofi, Amara, Sasha) and 5 example books; remove or reload.

## Setting it up in Anvil (once)

1. In the Anvil editor: **Create app → Clone from GitHub**, and paste `https://github.com/arkulinskis/little-hero-books`.
2. **Users** service: email + password, sign-up allowed (already set in `anvil.yaml`; check it).
3. Open the app in the editor. If it shows a **Schema Mismatch** alert, choose **"The schema of the source code is correct"** so Anvil creates the tables.
4. **Run** it and sign up with **arkulinskis@gmail.com** straight away (that account becomes the admin).
5. **Publish** (Publish → public URL, or your own domain).

## Working on it

See `.claude/skills/littleherobooks/SKILL.md`. In short:

```
python -I tools/check.py --ui                    # syntax, server tests, headless UI tests → ALL CHECKS PASSED
python -I tools/preview/devserver.py 8765        # the app on in-memory data: http://localhost:8765/  (?as=ana#home, ?as=admin#admin)
python tools/deploy.py                           # dry run (needs PyYAML, so no -I)
python tools/deploy.py --push "Message"          # deploy: commit + push to GitHub, Anvil pulls it
```

## Project layout

```
web/            the interface: core.js/core.css (shared engine + design tokens), app.js (header, footer), pages/*.html
                (_avatar = people engine, _scenes = the 80 illustrations, _book = reader + PDF, _make = make-a-book dialog)
client_code/    Main.py (the only Anvil form: bridge to the server, sign-in), legal.py
server_code/    common.py, Accounts.py, Feedback.py, Admin.py, DemoData.py, legal_server.py, Stories.py (the 8 tales), Heroes.py, Books.py
assets/         icon.svg + generated PNG icons, pictures (served at _/theme/<name>)
tools/          sync_to_anvil.py (settings + table schema), deploy.py, check.py, preview/ (dev server, UI tests, screenshots), testing/
```
