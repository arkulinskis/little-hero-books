# Little Hero Books

Personalised picture books for little ones. A parent designs a cartoon look-alike of their child (face, skin tone,
hair, eyes, clothes, hats, glasses, plus name and pronouns), then picks from twelve public-domain fairy tales retold short
(300-500 words) for ages 3-6. Every illustration has a space where the child goes; the app draws the child into it, and
the finished 12-page book can be read on screen (page turns, "Read to me", "Colour me in") or downloaded as a square
8 x 8 in PDF, a print-ready PDF with bleed for photo-book printers, or a colour-me-in outline book.
Theme: happy, joyous kindergarten ("Crayon Classroom"); the books themselves have a softer storybook finish. Built on [Anvil](https://anvil.works).

- **App repo:** github.com/arkulinskis/little-hero-books (branch `master`). Anvil pulls `master`.
- Built as native Anvil Forms (Python + HTML templates, a layout, custom components, RepeatingPanels) since
  2026-11-02, following Anvil's agent references.
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
- **Family links** (`#read/<key>`): a shared book anyone with the link can read and download. If the parent recorded
  their voice, "Read to me" plays it page by page (the speech voice reads the pages they didn't record).
- Sign-up with email and password or Google, a feedback form, and the Privacy & Terms page (footer link, `#legal`).

**For members:**
- **Bookshelf** (`#home`): your heroes (up to 12), your books on wooden shelves with reading stars, "Next adventures"
  (stories your first hero isn't in yet), and the example shelf.
- **Make a book:** pick a story and a hero, add a dedication (or tap a suggestion), and it lands on your shelf.
- **Reader** (`#book/<id>`): cover, "This book belongs to" page with the dedication, 9 illustrated story pages with the
  name highlighted, "The End" with credits. Arrows, swipe, keyboard, page dots, confetti at the end (counts a reading
  star), "Read to me" (your recorded voice where there is one, otherwise speech synthesis; turns pages by itself),
  "Colour me in". Soft storybook look: rounded white
  picture mats, blurred shadows, a softer plum ink, a painted-page wash and paper grain, Fredoka for the story text.
- **PDF download** ("Download a PDF" dialog, choices remembered): drawn in the browser and written by a small built-in
  PDF writer, nothing uploaded, no third-party library.
  - **Picture book** or **Colour-me-in book** (outline pictures, outlined title letters, plus a "Draw your favourite
    part of the story" page).
  - **Screen or home printer:** 8 x 8 in pages (1500 px JPEG), 12 pages (13 for the colouring book).
  - **Photo-book printer (print-ready):** 300 dpi, trim size 8 x 8 in, 8.5 x 8.5 in or 20 x 20 cm, plus a bleed of
    0.125 in, 3 mm or 5 mm on every side (backgrounds run into it), TrimBox/BleedBox set, an even number of inside
    pages after the cover (a drawing page is added when needed).
- **Record my voice** (a reader button, your own books only): read each page aloud and it is recorded in the browser
  (MediaRecorder: MP4/AAC where the browser can, else WebM/Opus; up to 3 minutes a page), with Play, Redo, Delete and
  Next page per page, and "Delete all recordings". Recordings are saved with the book (table `voice_pages`), marked on
  the page dots and in a "Your voice on N pages" badge, and played by "Read to me" here and on the family link. Turning
  the family link off (or making a new one) gives every recording a new address, so old audio links stop too. The
  microphone is only used while recording; music stops while it is on. Privacy & Terms describe it (2026-11-05).
- **Paint this book** (a reader button, your own books only; 2026-11-08): every picture of the book (cover,
  dedication portrait, each story picture, the waving hero on The End) is repainted by **Image Enhancer**, Arkvital's
  own image service (github.com/arkulinskis/image-enhancer: a queue in Anvil and a PC running FLUX.2 [klein] 4B in
  ComfyUI). Pick one of six styles (Storybook, Watercolour, 3D cartoon, Clay, Comic book, Fairy-tale painting); the
  browser draws each page's picture as a PNG and sends it (`paint_page`), with a progress bar and the studio's own
  estimate. A strip on the book page shows "n of N pages painted · ready in about X minutes" and new pictures appear
  as they arrive (checked every 15 s, or at once through the signed webhook `/paint-done`). The reader gets a
  **Painted** switch (remembered), the family link shows the painted pictures, and the PDF dialog offers "Use the
  painted pictures". Paint it again in another style (the old pictures stay until the new ones are back), send the
  missing pages again, or go back to the drawings. The words always stay text. Table `paintings`; Privacy & Terms
  describe it (2026-11-08).
- **Family link** per book (on/off), edit the dedication, remove a book (and its recordings and paintings), edit or
  remove a hero (removes their books).

**For admins** (`#admin`; arkulinskis@gmail.com becomes an admin on first sign-in):
- **Feedback inbox:** New / Read / Done, private notes.
- **Users:** search, make admin, disable an account.
- **Library:** the 12 stories with word counts, how many real books each became and how many reads.
- **Painting:** is the studio set up (the App Secrets), the Image Enhancer address (saved here, else the secret
  `image_enhancer_url`, else https://image-enhancer.anvil.app), "Check the connection" (key accepted, studio PC on,
  queue length) and how many books and pages were painted.
- **Demo data:** 3 example parents, 4 example heroes (Juniper, Kofi, Amara, Sasha) and 5 example books; remove or reload.

## Setting it up in Anvil (once)

1. In the Anvil editor: **Create app → Clone from GitHub**, and paste `https://github.com/arkulinskis/little-hero-books`.
2. **Users** service: email + password and "Continue with Google", sign-up allowed (already set in `anvil.yaml`; check it).
3. Open the app in the editor. If it shows a **Schema Mismatch** alert, choose **"The schema of the source code is correct"** so Anvil creates the tables.
4. **Run** it and sign up with **arkulinskis@gmail.com** straight away (that account becomes the admin).
5. **Publish** (Publish → public URL, or your own domain).
6. **Painting (optional):** in Image Enhancer's console make a key for Little Hero Books (Apps & keys). In this app's
   **App Secrets** add `image_enhancer_key` (the key) and `image_enhancer_webhook_secret` (the secret shown with it).
   If Image Enhancer doesn't live at image-enhancer.anvil.app, paste its address in Admin → Painting. "Check the
   connection" there confirms it. Without the key, "Paint this book" says the studio isn't open yet.

<!-- libraries:start -->
## Libraries and outside services

What this project uses besides its own code. Generated by `APP_MAKER/tools/libraries.py`; to change it, edit `APP_MAKER/libraries/catalog.py` and re-run the script.

| Name | How it gets in | Used here for |
|---|---|---|
| [Image Enhancer](https://github.com/arkulinskis/image-enhancer) | Outside web service | Paint this book: every page's picture repainted in a picture-book style (Painting.py) |
| [Arkvital music library (ArkMusic)](https://arkvital-media.web.app) | Outside web service | Background music: the user's licensed Audiio tracks, streamed from our own Firebase Hosting site by a small shared player. |
| [YouTube embeds](https://developers.google.com/youtube/player_parameters) | Outside web service | Plays a YouTube video inside the page (the privacy-friendlier youtube-nocookie address). |
| [Google Fonts](https://fonts.google.com) | Loaded from a CDN | Baloo 2, Fredoka, Nunito |
| [Anvil Uplink](https://anvil.works/docs/uplink) | Python package | only the test tools/testing/paint_e2e.py: adds a key to the local Image Enhancer |

**Built into the browser:** Canvas 2D, Speech synthesis, Web Audio API, Camera, microphone and screen, MediaRecorder, localStorage, Clipboard, File downloads (Blob).

**Anvil platform:** Anvil, Anvil Data Tables, Anvil JS bridge (anvil.js), Anvil Users, Anvil Google service, Anvil HTTP, Anvil Secrets.

**Build and test tools (not shipped):** Node.js, Headless Chrome (DevTools Protocol), PyYAML.

<!-- libraries:end -->

## Working on it

See `.claude/skills/littleherobooks/SKILL.md`. The folder is the Anvil app itself (no build step). In short:

```
python tools/check.py                            # Anvil's validator, JS syntax, asset hashes, server tests -> ALL CHECKS PASSED
python -I tools/ui_test.py                       # the real app in the Anvil App Server (Docker) driven by headless Chrome
python -I tools/ui_test.py --shots DIR           # + screenshots of every page (desktop/phone, light/dark, guest/member)
git push origin master                           # deploy (Anvil pulls master)
```

## Project layout

```
client_code/    startup.py, router.py, state.py, auth.py, books.py, lh.py (door to the JS engines), legal.py
                Layouts/Shell (frame), Pages/* (one Form per page), Components/* (Avatar, Cover, Scene, Reader, HeroPick,
                MakeYours), Items/* (RepeatingPanel item templates), Dialogs/* (MakeBook, FamilyLink, Dedication, Pdf, PdfProgress)
server_code/    common.py, Accounts.py, Feedback.py, Admin.py, DemoData.py, legal_server.py, Stories.py, Heroes.py, Books.py,
                Voice.py (recorded pages + the /_/api/voice/<key> audio endpoint with byte ranges)
theme/assets/   lh-kit.js + lh-avatar.js + lh-scenes.js + lh-book.js + ark-music.js (the drawing engines), app.css,
                icons.css (generated), icons, pictures
tools/          check.py, assets.py, build_icons.py, ui_test.py + ui/ (flow, phone, seed), live/drive.mjs, testing/
```
