"""Stories people write themselves (#write): from a blank page or starting from any story in the library.

A written story is private to the person who wrote it. It has a title, a blurb, a cover colour and 1-16 pages; each
page has its text (with the same {name} {he} {his} ... tokens as the library) and borrows one picture from the library
("bears:3" = page 4 of The Three Bears, "bears:cover" = its cover). Its key starts with "u-", and books made from it
store that key in books.story like any other story, so the reader, PDF, recordings, painting and family links all work
the same way. Deleting a story deletes the books made from it.

Table user_stories: owner, key, title, blurb, color, cover, pages [{"text", "pic"}], base (the library story it
started from, or ""), created, updated.
"""
import re
import secrets

import anvil.server
from anvil.tables import app_tables
import anvil.tables as tables

from . import common as C
from . import Stories

MAX_STORIES = 50
MAX_PAGES = 16
MAX_TEXT = 700
COLORS = ["#ef5a36", "#ffc93c", "#3dbe8b", "#4ea8f5", "#8a6bd8", "#ff8fb8", "#f0a04b", "#59b45e", "#463e8c", "#2b2350"]


def row_of(key):
    if not Stories.is_user_key(key):
        return None
    try:
        return app_tables.user_stories.get(key=key)
    except Exception:  # until the owner accepts the Schema Mismatch, the live database has no user_stories table
        return None


def _plain(title):
    p = re.sub(r"\{name\}('s|’s)?\s*(and\s+)?", "", title).strip(" ,")
    p = Stories.fill(p) if p else ""
    return (p[:1].upper() + p[1:]) if p else "A story of my own"


def story_dict(r):
    """The same shape as a library story (Stories.STORIES), plus the pictures it borrows."""
    pages = [p for p in (r["pages"] or []) if isinstance(p, dict)]
    base = Stories.BY_KEY.get(r["base"] or "")
    return {"key": r["key"], "title": r["title"] or "{name}’s story", "plain": _plain(r["title"] or ""),
            "source": ("Written by you, starting from “%s”." % base["plain"]) if base else "Written by you.",
            "blurb": r["blurb"] or "", "color": r["color"] or COLORS[0],
            "pages": [p.get("text") or "" for p in pages], "pics": [p.get("pic") or "" for p in pages],
            "cover": r["cover"] or "", "base": r["base"] or "", "custom": True, "updated": C.iso(r["updated"])}


def story_of(key):
    r = row_of(key)
    return story_dict(r) if r is not None else None


def mine(me):
    """Your written stories, newest first, as library cards (no page text)."""
    if me is None:
        return []
    try:
        rows = app_tables.user_stories.search(tables.order_by("updated", ascending=False), owner=me)
        return [Stories.meta(story_dict(r)) for r in rows]
    except Exception:
        return []


def _pic(ref, fallback):
    """'bears:3' / 'bears:cover' if that picture exists, else the fallback."""
    if isinstance(ref, str) and ":" in ref:
        key, page = ref.split(":", 1)
        s = Stories.BY_KEY.get(key)
        if s is not None:
            if page == "cover":
                return key + ":cover"
            if page.isdigit() and int(page) < len(s["pages"]):
                return "%s:%d" % (key, int(page))
    return fallback


def _clean_text(value):
    """Page text: plain, length-capped, and only the tokens the reader knows ({name}, {he} ...)."""
    s = C.text(value, MAX_TEXT, multiline=True)
    return re.sub(r"\{(\w*)\}", lambda m: m.group(0) if m.group(1) in Stories.TOKENS else m.group(1), s)


@anvil.server.callable(require_user=True)
def my_stories():
    return C.ok(stories=mine(C.require_user()))


@anvil.server.callable(require_user=True)
def get_user_story(key):
    """One of your stories with its text, for the writing page."""
    me = C.require_user()
    r = row_of(key)
    if r is None or r["owner"] != me:
        return C.fail("That story isn't one of yours.")
    return C.ok(story=Stories.full(story_dict(r)), colors=COLORS, books=len(app_tables.books.search(owner=me, story=key)))


@anvil.server.callable(require_user=True)
def start_story(base_key):
    """A new draft (not saved yet): a copy of a library story to change, or a blank one (base_key None/'blank')."""
    C.require_user()
    base = Stories.BY_KEY.get(base_key) if isinstance(base_key, str) else None
    draft: dict
    if base is None:
        draft = {"key": "", "title": "{name} and the ", "blurb": "", "color": COLORS[3], "cover": "star:cover", "base": "",
                 "text": ["Once upon a time, {name} "], "pics": ["star:1"]}
    else:
        n = len(base["pages"])
        draft = {"key": "", "title": base["title"], "blurb": base["blurb"], "color": base["color"].lower(),
                 "cover": base["key"] + ":cover", "base": base["key"], "text": list(base["pages"]),
                 "pics": ["%s:%d" % (base["key"], i) for i in range(n)]}
    draft.update(plain="", source="", pages=len(draft["text"]), words=0, minutes=1, custom=True, original=False)
    return C.ok(story=draft, colors=COLORS)


@anvil.server.callable(require_user=True)
def save_story(key, title, blurb, color, cover, pages, base=""):
    """Create (key empty) or update one of your stories. pages = [{"text", "pic"}]. Returns the saved story."""
    me = C.require_user()
    title = C.text(title, 80)
    if not re.sub(r"\{\w+\}", "", title).strip() and "{name}" not in title:
        return C.fail("Give your story a title.")
    title = _clean_text(title).replace("\n", " ")
    if not isinstance(pages, list) or not pages:
        return C.fail("A story needs at least one page.")
    if len(pages) > MAX_PAGES:
        return C.fail("A story can have up to %d pages." % MAX_PAGES)
    clean = []
    for i, p in enumerate(pages):
        p = p if isinstance(p, dict) else {}
        text = _clean_text(p.get("text"))
        if not text:
            return C.fail("Page %d is empty. Write something, or remove the page." % (i + 1))
        clean.append({"text": text, "pic": _pic(p.get("pic"), "star:%d" % (i % 9))})
    color = color.lower() if isinstance(color, str) and color.lower() in COLORS else COLORS[0]
    base = base if isinstance(base, str) and base in Stories.BY_KEY else ""
    fields = {"title": title, "blurb": C.text(blurb, 140), "color": color, "cover": _pic(cover, clean[0]["pic"]),
              "pages": clean, "updated": C.now()}
    if key:
        r = row_of(key)
        if r is None or r["owner"] != me:
            return C.fail("You can only change your own stories.")
        r.update(**fields)
    else:
        if len(app_tables.user_stories.search(owner=me)) >= MAX_STORIES:
            return C.fail("You have %d stories already. Remove one to write another." % MAX_STORIES)
        if C.rate_limited("write_story", 20, 3600):
            return C.fail("That's a lot of new stories in one hour. Try again a little later.")
        r = app_tables.user_stories.add_row(owner=me, key="u-" + secrets.token_hex(6), base=base, created=C.now(), **fields)
    return C.ok(story=Stories.full(story_dict(r)))


@anvil.server.callable(require_user=True)
def delete_story(key):
    """Delete one of your stories and the books made from it (with their recordings and paintings)."""
    me = C.require_user()
    r = row_of(key)
    if r is None:
        return C.ok(books=0)
    if r["owner"] != me:
        return C.fail("You can only remove your own stories.")
    from . import Painting, Voice
    n = 0
    for b in app_tables.books.search(owner=me, story=key):
        Voice.delete_for(b)
        Painting.delete_for(b)
        b.delete()
        n += 1
    r.delete()
    return C.ok(books=n)


def count_all():
    try:
        return len(app_tables.user_stories.search())
    except Exception:
        return 0
