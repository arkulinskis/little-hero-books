"""Book logic shared by several pages: who can star in a story, the studio draft, and the "make this book" and
"download a PDF" flows (each opens a dialog Form)."""
from anvil import alert, confirm
import anvil.server

from . import router, state

_cache = {"stories": None}


def load_draft():
    """The hero being designed in the studio (kept in this browser, so guests can play before signing up)."""
    d = state.store_get("draft", None)
    return dict(d) if d else None


def save_draft(draft):
    state.store_set("draft", draft)


def stories():
    """The library's story list (no page text), loaded once per visit."""
    if _cache["stories"] is None:
        _cache["stories"] = state.call("get_library")["stories"]
    return _cache["stories"]


def remember_stories(lib):
    _cache["stories"] = lib["stories"]


def hero_choices(lib):
    """Heroes you can read with: yours, your unsaved studio draft, the examples, and the blank book.
    Each choice is {ref, hero, label, note, own}; ref = a hero id, 'draft' or 'blank'."""
    out = [{"ref": h["id"], "hero": h, "label": h["name"], "note": "", "own": True} for h in lib.get("heroes") or []]
    d = load_draft()
    if d and d.get("look") and not d.get("id"):
        name = (d.get("name") or "").strip()
        out.append({"ref": "draft", "hero": {"name": name or "Your hero", "pronoun": d.get("pronoun") or "they", "look": d["look"]},
                    "label": name or "Your draft", "note": "not saved", "own": False})
    for h in lib.get("examples") or []:
        out.append({"ref": h["id"], "hero": h, "label": h["name"], "note": "example", "own": False})
    out.append({"ref": "blank", "hero": None, "label": "Blank book", "note": "no hero", "own": False})
    return out


def make_book(story, heroes, hero_id=None):
    """"Make this book": needs an account and one of your own heroes. Opens the MakeBook dialog; on success opens the book."""
    if not state.me():
        router.remember_after("#library")
        state.toast("Make a free account to keep books on your shelf.")
        router.go("auth", "signup")
        return
    if not heroes:
        if confirm("Design a cartoon look-alike of your child in the studio. It takes about a minute.",
                   title="First, make your hero", buttons=[("Not now", False), ("Open the studio", True)]):
            router.go("studio", "new")
        return
    from .Dialogs.MakeBook import MakeBook
    made = alert(MakeBook(story=story, heroes=heroes, hero_id=hero_id), buttons=[], large=False, role="lh-dialog")
    if made:
        state.toast("That book was already on your shelf. Here it is!" if made["existed"] else "Your book is ready!", "ok")
        router.go("book", made["id"])


def download_pdf(book):
    """"Download a PDF": choose the kind and size (Dialogs.Pdf), then draw and save it (Dialogs.PdfProgress)."""
    from .Dialogs.Pdf import Pdf
    opts = alert(Pdf(book=book), buttons=[], large=True, role="lh-dialog")
    if not opts:
        return
    from .Dialogs.PdfProgress import PdfProgress
    alert(PdfProgress(book=book, opts=opts), buttons=[], dismissible=False, role="lh-dialog")


def api_base(name):
    """<app>/_/api/<name>/ (get_api_origin() already ends in /_/api): where recordings and paintings are served."""
    origin = anvil.server.get_api_origin().rstrip("/")
    if origin.endswith("/_/api"):
        origin = origin[:-len("/_/api")]
    return origin + "/_/api/" + name + "/"


def as_book(story, hero, **extra):
    """The book shape the reader and PDF writer want. paint = {"<page>": {key, style}} (painted pictures)."""
    book = {"story": story, "hero": hero, "dedication": "", "created": None, "paint": {}, "paintBase": api_base("painting")}
    book.update(extra)
    if book.get("paint") is None:
        book["paint"] = {}
    return book
