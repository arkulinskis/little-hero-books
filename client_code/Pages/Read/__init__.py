import anvil.server
from anvil import *

from ._anvil_designer import ReadTemplate
from ... import books, lh


class Read(ReadTemplate):
    """#read/<shareKey>: a family link. Anyone with it can read and download that one book (no parent details), and
    hear the parent's recorded voice on the pages they recorded (Read to me)."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        r = anvil.server.call("get_shared_book", args[0] if args else "")
        self.found.visible = bool(r.get("ok"))
        self.broken.visible = not r.get("ok")
        if not r.get("ok"):
            self.broken_text.text = r.get("error") or ""
            return
        b, hero = r["book"], r["book"]["hero"]
        self.book = books.as_book(r["story"], hero, dedication=b["dedication"], created=b["created"], voice=b.get("voice") or {},
                                  paint=b.get("paint") or {})
        self.eyebrow.text = "A book made for " + hero["name"]
        self.title.text = lh.title(r["story"], hero)
        if self.book["voice"]:
            self.intro.text = ("Someone who loves %s shared this book with you and recorded themselves reading it. "
                               "Press Read to me to hear their voice, page by page." % hero["name"])
        else:
            self.intro.text = "Someone who loves %s shared this book with you. Read it together, or download it to print." % hero["name"]
        self.cta.hero = hero
        self.reader.book = self.book

    @handle("pdf_button", "click")
    def pdf_button_click(self, **event_args):
        books.download_pdf(self.book)
