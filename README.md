# Little Hero Books

Personalised picture books for little ones. A parent designs a cartoon look-alike of their child (face, skin tone,
hair, eyes, clothes, hats, glasses, plus name and pronouns), then picks from twelve public-domain fairy tales retold short
(300-500 words) for ages 3-6. Every illustration has a space where the child goes; the app draws the child into it, and
the finished 12-page book can be read on screen (page turns, "Read to me", "Colour me in") or downloaded as a square
8 x 8 in PDF, a print-ready PDF with bleed for photo-book printers, or a colour-me-in outline book.
Theme: happy, joyous kindergarten ("Crayon Classroom"); the books themselves have a softer storybook finish. Built on [Anvil](https://anvil.works).

- **App repo:** github.com/arkulinskis/little-hero-books (branch `master`). Anvil pulls `master`.
- **Live:** https://little-hero-books.anvil.app

## What it does

Keep this list current: it is the first thing read before every change.

**For everyone (no account needed):**
- **Landing page:** an open-book hero picture that cycles through five example kids, a 12-book shelf that changes star
  when you tap a face, how it works, features, safety, FAQ.
- **Hero studio** (`#studio`): ages 1 to 12 (the body grows), 20 skin tones, 16 face shapes, 15 noses, cheeks and
  freckles, 12 face paints and little marks (dimples, beauty spot, birthmark, plaster, stars, whiskers...), 30 hairstyles
  (incl. locs, cornrows, Bantu knots, space buns) x 23 hair colours, 17 eye shapes x 18 eye colours, 17 eyebrows,
  17 mouths (gap tooth, braces, bunny teeth...), 20 outfits (tutu, dino suit, astronaut, school blazer...) x 23 colours,
  21 hats and head coverings (incl. hijab, patka, kippah; a story's crown sits on top of them), 16 glasses. Live preview with poses (Hello, Wave, Hooray, Skip), "Surprise me", Undo, the child's name and pronouns
  (she / he / they), and "Try it in a story" (the current hero on a story cover). Guests keep a draft in the browser;
  pressing Save as a guest goes to sign-up and saves the hero automatically afterwards.
- **Story library** (`#library`): 12 tales (Three Bears, Enormous Turnip, Magic Porridge Pot, Emperor's New Clothes,
  Beanstalk, Little Red Hen, Elves and the Shoemaker, Princess and the Pea, Gingerbread Man, Ugly Duckling, Three Billy
  Goats Gruff, Tortoise and the Hare = "the Great Race"). A "Starring" strip redraws every cover with
  the chosen hero: yours, your studio draft, one of 4 example heroes, or the **blank book** (the generic version with a
  "your hero here" outline in every picture).
- **Story preview** (`#story/<key>/<hero>`): the reader with any hero.
- **Colour me in** (a reader button): every picture turns into an outline drawing; pick one of 14 crayons (or the
  rubber) and tap shapes to colour them. Colours stay while you turn pages (not saved).
- **Family links** (`#read/<key>`): a shared book anyone with the link can read and download.
- Sign-up with email and password, a feedback form, and the Privacy & Terms page (footer link, `#legal`).

**For members:**
- **Bookshelf** (`#home`): your heroes (up to 12), your books on wooden shelves with reading stars, "Next adventures"
  (stories your first hero isn't in yet), and the example shelf.
- **Make a book:** pick a story and a hero, add a dedication (or tap a suggestion), and it lands on your shelf.
- **Reader** (`#book/<id>`): cover, "This book belongs to" page with the dedication, 9 illustrated story pages with the
  name highlighted, "The End" with credits. Arrows, swipe, keyboard, page dots, confetti at the end (counts a reading
  star), "Read to me" (speech synthesis, turns pages by itself), "Colour me in". Soft storybook look: rounded white
  picture mats, blurred shadows, a softer plum ink, a painted-page wash and paper grain, Fredoka for the story text.
- **PDF download** ("Download a PDF" dialog, choices remembered): drawn in the browser and written by a small built-in
  PDF writer, nothing uploaded, no third-party library.
  - **Picture book** or **Colour-me-in book** (outline pictures, outlined title letters, plus a "Draw your favourite
    part of the story" page).
  - **Screen or home printer:** 8 x 8 in pages (1500 px JPEG), 12 pages (13 for the colouring book).
  - **Photo-book printer (print-ready):** 300 dpi, trim size 8 x 8 in, 8.5 x 8.5 in or 20 x 20 cm, plus a bleed of
    0.125 in, 3 mm or 5 mm on every side (backgrounds run into it), TrimBox/BleedBox set, an even number of inside
    pages after the cover (a drawing page is added when needed).
- **Family link** per book (on/off), edit the dedication, remove a book, edit or remove a hero (removes their books).

**For admins** (`#admin`; arkulinskis@gmail.com becomes an admin on first sign-in):
- **Feedback inbox:** New / Read / Done, private notes.
- **Users:** search, make admin, disable an account.
- **Library:** the 12 stories with word counts, how many real books each became and how many reads.
- **Demo data:** 3 example parents, 4 example heroes (Juniper, Kofi, Amara, Sasha) and 5 example books; remove or reload.

## Setting it up in Anvil (once)

1. In the Anvil editor: **Create app → Clone from GitHub**, and paste `https://github.com/arkulinskis/little-hero-books`.
2. **Users** service: email + password, sign-up allowed (already set in `anvil.yaml`; check it).
3. Open the app in the editor. If it shows a **Schema Mismatch** alert, choose **"The schema of the source code is correct"** so Anvil creates the tables.
4. **Run** it and sign up with **arkulinskis@gmail.com** straight away (that account becomes the admin).
5. **Publish** (Publish → public URL, or your own domain).

<!-- libraries:start -->
## Libraries and outside services

What this project uses besides its own code. Generated by `APP_MAKER/tools/libraries.py`; to change it, edit `APP_MAKER/libraries/catalog.py` and re-run the script.

| Name | How it gets in | Used here for |
|---|---|---|
| [Google Fonts](https://fonts.google.com) | Loaded from a CDN | Baloo 2, Fredoka, Nunito |

**Built into the browser:** Canvas 2D, Speech synthesis, localStorage, Clipboard, File downloads (Blob).

**Anvil platform:** Anvil, Anvil Data Tables, Anvil JS bridge (anvil.js), Anvil Users.

**Build and test tools (not shipped):** Node.js, PyYAML, Headless Chrome (DevTools Protocol).

<!-- libraries:end -->

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
