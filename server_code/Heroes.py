"""Heroes: the cartoon look-alikes parents design for their children (name, pronouns, look).

A hero is private to the parent who made it. Demo heroes (is_demo) are examples everyone can read books
with and copy into the studio. The look is a small dict of choices drawn by LH.figure in
web/pages/_avatar.html; the server only checks its shape (known keys, short plain values).
"""
import re

import anvil.server
from anvil.tables import app_tables
import anvil.tables as tables

from . import common as C
from . import Painting, Voice

LOOK_KEYS = {"size", "skin", "face", "hair", "hairColor", "eyes", "eyeColor", "brows", "nose", "mouth", "cheeks",
             "freckles", "mark", "glasses", "outfit", "outfitColor", "hat"}
PRONOUNS = {"she", "he", "they"}
MAX_HEROES = 12


def clean_look(look):
    if not isinstance(look, dict):
        return None
    out = {}
    for k, v in look.items():
        if k not in LOOK_KEYS:
            continue
        if isinstance(v, bool):
            out[k] = v
        elif isinstance(v, str) and re.fullmatch(r"[a-z0-9#]{1,16}", v):
            out[k] = v
    return out


def hero_dict(r, books=None):
    return {"id": r.get_id(), "name": r["name"], "pronoun": r["pronoun"] or "they", "look": r["look"] or {},
            "created": C.iso(r["created"]), "updated": C.iso(r["updated"]), "demo": bool(r["is_demo"]),
            "books": books if books is not None else len(app_tables.books.search(hero=r))}


def mine(me):
    return [hero_dict(r) for r in app_tables.heroes.search(tables.order_by("created"), owner=me, is_demo=False)]


def examples():
    return [hero_dict(r) for r in app_tables.heroes.search(tables.order_by("created"), is_demo=True)]


def can_read(hero, me):
    """Books may star your own heroes or the example heroes."""
    return hero is not None and (hero["is_demo"] or (me is not None and hero["owner"] == me))


@anvil.server.callable
def get_hero(hero_id):
    """One hero for the studio: your own, or an example hero (to copy)."""
    me = C.me()
    r = C.row_by_id(app_tables.heroes, hero_id)
    if not can_read(r, me):
        return C.fail("That hero isn't on your shelf.")
    return C.ok(hero=hero_dict(r), mine=bool(me is not None and r["owner"] == me and not r["is_demo"]))


@anvil.server.callable(require_user=True)
def save_hero(hero_id, name, pronoun, look):
    me = C.require_user()
    name = C.text(name, 24)
    if len(name) < 1:
        return C.fail("Give your hero a name first.")
    if pronoun not in PRONOUNS:
        return C.fail("Pick she, he or they for the story.")
    look = clean_look(look)
    if not look:
        return C.fail("That look didn't come through. Please try again.")
    if hero_id:
        r = C.row_by_id(app_tables.heroes, hero_id)
        if r is None or r["owner"] != me or r["is_demo"]:
            return C.fail("You can only change your own heroes.")
        r.update(name=name, pronoun=pronoun, look=look, updated=C.now())
    else:
        if len(app_tables.heroes.search(owner=me)) >= MAX_HEROES:
            return C.fail("You have %d heroes already. Remove one to make room." % MAX_HEROES)
        if C.rate_limited("save_hero", 40, 3600):
            return C.fail("That's a lot of new heroes in one hour. Please try again later.")
        r = app_tables.heroes.add_row(owner=me, name=name, pronoun=pronoun, look=look, created=C.now(),
                                      updated=C.now(), is_demo=False)
    return C.ok(hero=hero_dict(r))


@anvil.server.callable(require_user=True)
def delete_hero(hero_id):
    """Removes the hero and every book starring them."""
    me = C.require_user()
    r = C.row_by_id(app_tables.heroes, hero_id)
    if r is None:
        return C.ok(removed_books=0)
    if r["owner"] != me or r["is_demo"]:
        return C.fail("You can only remove your own heroes.")
    books = list(app_tables.books.search(hero=r))
    for b in books:
        Voice.delete_for(b)
        Painting.delete_for(b)
        b.delete()
    r.delete()
    return C.ok(removed_books=len(books))
