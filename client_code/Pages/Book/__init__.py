import anvil.server
from anvil import *

from ._anvil_designer import BookTemplate
from ... import books, lh, router, state


class Book(BookTemplate):
    """#book/<id>: a book on your shelf (or an example book) in the reader. Yours: PDF, family link, dedication,
    Record my voice (in the reader), Paint this book (Dialogs/Paint; a strip shows how the painting is going and
    paint_status is asked every 15 s until every page is back), remove. Someone else's example: PDF (signed in) and "Make one like this". Otherwise a friendly "private" page."""

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
                                  share_key=b.get("share_key"), shared=b.get("shared"), voice=b.get("voice") or {},
                                  paint=b.get("paint") or {})
        self._paint_state = b.get("paint_state")
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
        for c in (self.share_button, self.dedication_button, self.remove_button, self.paint_button):
            c.visible = mine
        self.copy_link.visible = not mine
        self.copy_link.url = router.href("studio", "copy", b["hero"]["id"])
        self._share_label()
        self.cta.visible = not mine
        self.cta.hero = b["hero"]
        self.reader.record = mine
        self.reader.book = self.book
        self._voice_badge()
        self._paint_draw()

    def _voice_badge(self):
        n = len(self.book.get("voice") or {})
        self.voice_badge.visible = n > 0
        self.voice_badge.text = "Your voice on " + state.plural(n, "page")

    # ---- painted edition
    def _paint_draw(self):
        st = self._paint_state if self._data["mine"] else None
        n = len(self.book.get("paint") or {})
        self.paint_badge.visible = n > 0
        self.paint_badge.text = ("Painted: %s" % st["style_label"]) if st and st.get("style_label") else "Painted"
        self.paint_button.text = "Painted edition" if st else "Paint this book"
        busy = bool(st) and st["status"] == "painting"
        self.paint_strip.visible = bool(st) and st["status"] != "done"
        self.paint_timer.interval = 15 if busy else 0
        if not st or st["status"] == "done":
            return
        pct = int(round(100.0 * st["done"] / max(1, st["total"])))
        self.paint_fill.style["transform"] = "scaleX(%.3f)" % (pct / 100.0)
        state.set_attr(self.paint_bar, "aria-valuenow", str(pct))
        self.paint_strip.classes["bad"] = not busy
        if busy:
            self.paint_head.text = "Painting your book in %s style" % st["style_label"]
            from ...Dialogs.Paint import minutes
            left = (" · ready in %s" % minutes(st["seconds_left"])) if st.get("seconds_left") is not None else ""
            self.paint_note.text = ("%d of %d pages painted%s. You can close the book: painting carries on, and new "
                                    "pictures appear here as they arrive." % (st["done"], st["total"], left))
        else:
            missing = st["failed"] + st["missing"]
            self.paint_head.text = "%s couldn't be painted" % state.plural(missing, "page")
            self.paint_note.text = "%d of %d pages are painted. Open Details to send the others again." % (st["done"], st["total"])

    def _paint_update(self, r):
        if not r or not r.get("ok"):
            return
        self._paint_state = r.get("state")
        if (r.get("paint") or {}) != (self.book.get("paint") or {}):
            self.reader.set_paint(r.get("paint") or {})
        self.book["paint"] = r.get("paint") or {}
        self._paint_draw()

    @handle("paint_timer", "tick")
    def paint_timer_tick(self, **event_args):
        self._paint_update(state.call_quiet("paint_status", self._data["id"]))

    @handle("paint_button", "click")
    def paint_button_click(self, **event_args):
        self._paint_open()

    @handle("paint_more", "click")
    def paint_more_click(self, **event_args):
        self._paint_open()

    def _paint_open(self):
        from ...Dialogs.Paint import Paint
        res = alert(Paint(book=self.book), buttons=[], large=True, role="lh-dialog")
        if not res:
            self._paint_update(state.call_quiet("paint_status", self._data["id"]))
            return
        if res.get("removed"):
            state.toast("Back to the drawings", "ok")
        elif res.get("failed"):
            state.toast("%s sent to the studio, %d couldn't be sent: %s" % (
                state.plural(res["sent"], "picture"), res["failed"], res.get("error") or ""))
        else:
            state.toast("Your book is on its way to the painting studio!", "ok")
        self._paint_update(state.call_quiet("paint_status", self._data["id"]))

    @handle("reader", "voice")
    def reader_voice(self, **event_args):
        self._voice_badge()

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
