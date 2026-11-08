"""Books: a story from the library starring one of your heroes, with a dedication.

The shelf, the library and the reader load through here. A book is private to its maker unless they
turn on a family link (share_key): anyone with that link can read it (#read/<key>), nothing else.
The owner can record their voice reading it (Voice.py) and have its pictures painted (Painting.py); the family
link plays those recordings and shows the painted pictures.
The PDF is made in the browser (web/pages/_book.html), so nothing here sends files.
"""
import secrets

import anvil.server
from anvil.tables import app_tables
import anvil.tables as tables

from . import common as C
from . import DemoData, Heroes, Painting, Stories, Voice

MAX_BOOKS = 200


def book_dict(r, me=None, hero=None):
    s = Stories.BY_KEY.get(r["story"])
    mine = me is not None and r["owner"] == me and not r["is_demo"]
    return {"id": r.get_id(), "story": Stories.meta(s) if s else None,
            "hero": hero or Heroes.hero_dict(r["hero"], books=0),
            "dedication": r["dedication"] or "", "created": C.iso(r["created"]),
            "times_read": r["times_read"] or 0, "demo": bool(r["is_demo"]), "mine": mine,
            "shared": bool(mine and r["share_key"]), "share_key": r["share_key"] if mine else None}


def _books(rows, me):
    heroes = {}
    out = []
    for r in rows:
        h = r["hero"]
        if h is None or Stories.BY_KEY.get(r["story"]) is None:
            continue
        key = h.get_id()
        if key not in heroes:
            heroes[key] = Heroes.hero_dict(h, books=0)
        out.append(book_dict(r, me, heroes[key]))
    return out


@anvil.server.callable
def get_library():
    """Every story, plus the heroes you can put in them (yours if signed in, and the examples)."""
    DemoData.ensure_loaded()
    me = C.me()
    return {"stories": [Stories.meta(s) for s in Stories.STORIES],
            "heroes": Heroes.mine(me) if me else [], "examples": Heroes.examples()}


@anvil.server.callable(require_user=True)
def get_shelf():
    """The bookshelf: your heroes, your books, and the example shelf."""
    DemoData.ensure_loaded()
    me = C.require_user()
    books = _books(app_tables.books.search(tables.order_by("created", ascending=False), owner=me, is_demo=False), me)
    heroes = Heroes.mine(me)
    return {"heroes": heroes, "books": books,
            "examples": _books(app_tables.books.search(tables.order_by("created"), is_demo=True), me)[:8],
            "example_heroes": Heroes.examples(),
            "stats": {"books": len(books), "reads": sum(b["times_read"] for b in books), "heroes": len(heroes),
                      "stories": len(Stories.STORIES)}}


@anvil.server.callable
def get_book(book_id):
    """One book with its story text: yours, or an example book."""
    me = C.me()
    r = C.row_by_id(app_tables.books, book_id)
    if r is None or not (r["is_demo"] or (me is not None and r["owner"] == me)):
        return C.fail("That book isn't on your shelf.")
    s = Stories.BY_KEY.get(r["story"])
    if s is None or r["hero"] is None:
        return C.fail("That book can't be opened any more.")
    b = book_dict(r, me)
    b["voice"] = Voice.voice_for(r) if b["mine"] else {}
    rows = Painting._rows(r) if b["mine"] else []
    b["paint"] = Painting.paint_for(r, rows)
    b["paint_state"] = Painting.state_for(r, rows)
    return C.ok(book=b, story=Stories.full(s))


@anvil.server.callable(require_user=True)
def make_book(hero_id, story_key, dedication=""):
    me = C.require_user()
    hero = C.row_by_id(app_tables.heroes, hero_id)
    if hero is None or hero["owner"] != me or hero["is_demo"]:
        return C.fail("Pick one of your own heroes for the book.")
    if story_key not in Stories.BY_KEY:
        return C.fail("That story isn't in the library.")
    dedication = C.text(dedication, 160, multiline=True)
    have = app_tables.books.get(owner=me, hero=hero, story=story_key)
    if have is not None:
        if dedication:
            have["dedication"] = dedication
        return C.ok(book=book_dict(have, me), existed=True)
    if len(app_tables.books.search(owner=me)) >= MAX_BOOKS:
        return C.fail("Your shelf is full (%d books). Remove a few to make room." % MAX_BOOKS)
    r = app_tables.books.add_row(owner=me, hero=hero, story=story_key, dedication=dedication, created=C.now(),
                                 times_read=0, is_demo=False)
    return C.ok(book=book_dict(r, me), existed=False)


def _own_book(book_id, me):
    r = C.row_by_id(app_tables.books, book_id)
    if r is None or r["owner"] != me or r["is_demo"]:
        return None
    return r


@anvil.server.callable(require_user=True)
def update_book(book_id, dedication):
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only change your own books.")
    r["dedication"] = C.text(dedication, 160, multiline=True)
    return C.ok(book=book_dict(r, me))


@anvil.server.callable(require_user=True)
def delete_book(book_id):
    me = C.require_user()
    r = C.row_by_id(app_tables.books, book_id)
    if r is None:
        return C.ok()
    if r["owner"] != me or r["is_demo"]:
        return C.fail("You can only remove your own books.")
    Voice.delete_for(r)
    Painting.delete_for(r)
    r.delete()
    return C.ok()


@anvil.server.callable(require_user=True)
def share_book(book_id, on):
    """Turn the family link on (a fresh secret key) or off (the old link stops working)."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only share your own books.")
    r["share_key"] = secrets.token_urlsafe(9) if on else None
    Voice.new_keys(r)  # audio addresses someone kept from the old link stop working too
    Painting.new_keys(r)  # and so do painted-picture addresses
    return C.ok(book=book_dict(r, me))


@anvil.server.callable
def get_shared_book(key):
    """A book opened from a family link: the story, the hero, the dedication and the parent's recorded voice (if any).
    Nothing about the parent."""
    if not isinstance(key, str) or len(key) < 8 or len(key) > 40:
        return C.fail("This link doesn't work. Ask for a new one.")
    r = app_tables.books.get(share_key=key)
    if r is None or r["hero"] is None or Stories.BY_KEY.get(r["story"]) is None:
        return C.fail("This link doesn't work any more. Ask for a new one.")
    b = book_dict(r)
    b["hero"].pop("id", None)
    b["voice"] = Voice.voice_for(r)
    b["paint"] = Painting.paint_for(r)
    return C.ok(book=b, story=Stories.full(Stories.BY_KEY[r["story"]]))


@anvil.server.callable(require_user=True)
def book_read(book_id):
    """Counts a read to the last page (reading stars on the shelf)."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.ok(times_read=0)
    r.update(times_read=(r["times_read"] or 0) + 1, last_read=C.now())
    return C.ok(times_read=r["times_read"])
