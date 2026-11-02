import anvil.server
from anvil import *

from ._anvil_designer import BookTemplate
from ... import books, lh, router, state


class Book(BookTemplate):
    """#book/<id>: a book on your shelf (or an example book) in the reader. Yours: PDF, family link, dedication,
    remove. Someone else's example: PDF (signed in) and "Make one like this". Otherwise a friendly "private" page."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        me = state.me()
        r = anvil.server.call("get_book", args[0] if args else "")
        self.found.visible = bool(r.get("ok"))
        self.private.visible = not r.get("ok")
        if not r.get("ok"):
            self.private_text.text = (r.get("error") or "") + " Books can only be opened by the family who made them" + \
                ("." if me else ", so try signing in.")
            self.private_home.visible = bool(me)
            self.private_signin.visible = not me
            self.private_library.visible = not me
            return
        b = r["book"]
        self._data = b
        self.book = books.as_book(r["story"], b["hero"], id=b["id"], dedication=b["dedication"], created=b["created"],
                                  share_key=b.get("share_key"), shared=b.get("shared"))
        mine = b["mine"]
        self.back_shelf.visible = bool(me)
        self.back_library.visible = not me
        state.set_attr(self.back_link, "href", "#home" if me else "#library")
        self.title.text = lh.title(r["story"], b["hero"])
        self.read_badge.text = "Example book" if b["demo"] else "★ Read " + state.plural(b["times_read"], "time")
        self.read_badge.role = ["badge"] if b["demo"] else ["badge", "badge-brand"]
        self.pages_badge.text = "%d story pages" % r["story"]["pages"]
        self.pdf_button.visible = mine or bool(me)
        self.signup_link.visible = not mine and not me
        for c in (self.share_button, self.dedication_button, self.remove_button):
            c.visible = mine
        self.copy_link.visible = not mine
        self.copy_link.url = router.href("studio", "copy", b["hero"]["id"])
        self._share_label()
        self.cta.visible = not mine
        self.cta.hero = b["hero"]
        self.reader.book = self.book

    def _share_label(self):
        self.share_button.text = "Family link: on" if self.book.get("share_key") else "Family link"

    @handle("reader", "finish")
    def reader_finish(self, **event_args):
        if self._data["mine"]:
            state.call_quiet("book_read", self._data["id"])

    @handle("pdf_button", "click")
    def pdf_button_click(self, **event_args):
        books.download_pdf(self.book)

    @handle("share_button", "click")
    def share_button_click(self, **event_args):
        from ...Dialogs.FamilyLink import FamilyLink
        alert(FamilyLink(book=self.book), buttons=[], role="lh-dialog")
        self._share_label()

    @handle("dedication_button", "click")
    def dedication_button_click(self, **event_args):
        from ...Dialogs.Dedication import Dedication
        text = alert(Dedication(book=self.book), buttons=[], role="lh-dialog")
        if text is not None:
            self.book["dedication"] = text
            self.reader.book = self.book
            self.reader.go(1)

    @handle("remove_button", "click")
    def remove_button_click(self, **event_args):
        if confirm("You can make it again any time from the library.", title="Remove this book from your shelf?",
                   buttons=[("Cancel", False), ("Remove", True)], role="lh-dialog"):
            if state.call("delete_book", self.book["id"]):
                state.toast("Removed", "ok")
                router.go("home")
