"""Gift it: a book wrapped as a present (added 2026-11-20).

The owner of a book picks wrapping paper, who it is from (a fixed list, so no free text and no new personal data) and
the day it may be opened. The book's family link (#read/<key>) then shows a wrapped present with a "To <name>" tag and
"Opens in N sleeps" until that day (the viewer's device date: a surprise lock, not security), then the child taps the
bow to unwrap it. `opened` records the first unwrap (a time only, never who), so the owner sees "Unwrapped on 25 Dec".

One row per book in the table `gifts`. Everything here survives the table not existing yet (before the user accepts the
Schema Mismatch): gift_for() gives None, delete_for() does nothing, set_gift() says gifts arrive with the next update.
"""
import datetime as dt

import anvil.server
from anvil.tables import app_tables

from . import common as C
from . import Painting, Voice

WRAPS = {"christmas": "Christmas", "birthday": "Birthday", "stars": "Starry night", "crayons": "Crayons"}
SENDERS = ["Grandma", "Grandpa", "Grandma & Grandpa", "Mum", "Dad", "Mum & Dad", "Auntie", "Uncle", "Your family", "Santa"]
LATER = "Gift wrapping arrives with the next update of Little Hero Books. Your family link works as usual."


def _table():
    try:
        return app_tables.gifts
    except Exception:
        return None


def available():
    return _table() is not None


def _row(book):
    t = _table()
    if t is None or book is None:
        return None
    try:
        return t.get(book=book)
    except Exception:
        return None


def _day(v):
    if isinstance(v, dt.datetime):
        return v.date()
    return v if isinstance(v, dt.date) else None


def gift_dict(g):
    if g is None:
        return None
    day = _day(g["open_on"])
    return {"wrap": g["wrap"] if g["wrap"] in WRAPS else "christmas", "wrap_label": WRAPS.get(g["wrap"], "Christmas"),
            "sender": g["sender"] if g["sender"] in SENDERS else "Your family",
            "open_on": day.isoformat() if day else None, "opened": C.iso(g["opened"])}


def gift_for(book):
    """The book's gift as a plain dict, or None (no gift, or no gifts table yet)."""
    try:
        return gift_dict(_row(book))
    except Exception:
        return None


def delete_for(book):
    """Called before a book is deleted (book, hero, written story, demo data)."""
    try:
        g = _row(book)
        if g is not None:
            g.delete()
    except Exception:
        pass


def _parse_day(open_on):
    """'2026-12-25' -> date, None/'' -> None (any time). Raises ValueError for anything else or out of range."""
    if open_on in (None, ""):
        return None
    if not isinstance(open_on, str) or len(open_on) != 10:
        raise ValueError("bad date")
    day = dt.date.fromisoformat(open_on)
    today = C.now().date()
    if day < today - dt.timedelta(days=1) or day > today + dt.timedelta(days=400):
        raise ValueError("out of range")
    return day


def _own_book(book_id, me):
    r = C.row_by_id(app_tables.books, book_id)
    if r is None or r["owner"] != me or r["is_demo"]:
        return None
    return r


def put(book, wrap, sender, day):
    """Create or change a book's gift (also used for the demo gift). A new date wraps it up again."""
    t = _table()
    g = _row(book)
    if g is None:
        return t.add_row(book=book, wrap=wrap, sender=sender, open_on=day, opened=None, created=C.now(), updated=C.now())
    fresh = _day(g["open_on"]) != day
    g.update(wrap=wrap, sender=sender, open_on=day, updated=C.now())
    if fresh:
        g["opened"] = None
    return g


@anvil.server.callable(require_user=True)
def set_gift(book_id, wrap, sender, open_on=None):
    """Wrap one of your books as a present. Makes the family link first if the book has none.
    open_on: 'YYYY-MM-DD' (from yesterday to 400 days ahead) or None for "any time"."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only wrap your own books.")
    if not available():
        return dict(C.fail(LATER), later=True)
    if wrap not in WRAPS:
        return C.fail("Pick one of the wrapping papers.")
    if sender not in SENDERS:
        return C.fail("Pick who the present is from.")
    try:
        day = _parse_day(open_on)
    except (ValueError, TypeError):
        return C.fail("Pick a day between today and next year, or Any time.")
    if not r["share_key"]:
        r["share_key"] = C.link_key()
        Voice.new_keys(r)
        Painting.new_keys(r)
    put(r, wrap, sender, day)
    return C.ok(gift=gift_for(r), share_key=r["share_key"], shared=True)


@anvil.server.callable(require_user=True)
def remove_gift(book_id):
    """Take the wrapping off: the family link opens straight into the book again."""
    me = C.require_user()
    r = _own_book(book_id, me)
    if r is None:
        return C.fail("You can only change your own books.")
    delete_for(r)
    return C.ok(gift=None)


@anvil.server.callable
def gift_opened(key):
    """The family link's present was unwrapped (anyone with the link may call this). Records the first unwrap only, as a
    time; nothing about who. Quietly ignores bad keys, early dates (the server allows a day for time zones) and too many
    calls from one browser."""
    if not isinstance(key, str) or len(key) < 8 or len(key) > 40:
        return C.ok(opened=None)
    if C.rate_limited("gift_open", 20, 3600):
        return C.ok(opened=None)
    r = app_tables.books.get(share_key=key)
    g = _row(r) if r is not None else None
    if g is None:
        return C.ok(opened=None)
    if g["opened"] is None and not r["is_demo"]:
        day = _day(g["open_on"])
        if day is None or day <= C.now().date() + dt.timedelta(days=1):
            g["opened"] = C.now()
    return C.ok(opened=C.iso(g["opened"]))
