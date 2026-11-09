import anvil.js
import anvil.server
from anvil import *

from ._anvil_designer import BookTemplate
from ... import books, lh, router, state


class Book(BookTemplate):
    """#book/<id>: a book on your shelf (or an example book) in the reader. Yours: PDF, family link, dedication,
    Record my voice (in the reader), Paint this book (Dialogs/Paint; a strip shows how the painting is going and
    paint_status is asked every 15 s until every page is back), Repaint this page (the page open in the reader, a new
    seed), remove. Each painted picture that arrives gets the skin check here (lh.skin_check -> paint_verdict): the
    server repaints it by itself if the child's skin came out wrong, and flags it after two tries. Someone else's example: PDF (signed in) and "Make one like this". Otherwise a friendly "private" page."""

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
        self._page, self._checking = 0, False
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
        unchecked = bool(self._unchecked())
        self.paint_timer.interval = 15 if busy else (2 if unchecked else 0)
        self._page_tools()
        flagged = (st or {}).get("flagged") or []
        if st and st["status"] == "done" and flagged:
            self.paint_strip.visible = True
            self.paint_strip.classes["bad"] = True
            self.paint_fill.style["transform"] = "scaleX(1)"
            self.paint_head.text = "%s may not look like %s" % (state.plural(len(flagged), "picture"), self._hero_name())
            self.paint_note.text = ("The child's skin colour came out different from the drawing, even after painting it "
                                    "again. Open the page (marked below the book) and press Repaint this page.")
            return
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
            again = (" %s being painted again because the child didn't look like the drawing." % state.plural(
                st["rechecking"], "page is", "pages are")) if st.get("rechecking") else ""
            self.paint_note.text = ("%d of %d pages painted%s. You can close the book: painting carries on, and new "
                                    "pictures appear here as they arrive.%s" % (st["done"], st["total"], left, again))
        else:
            missing = st["failed"] + st["missing"]
            self.paint_head.text = "%s couldn't be painted" % state.plural(missing, "page")
            self.paint_note.text = "%d of %d pages are painted. Open Details to send the others again." % (st["done"], st["total"])

    def _hero_name(self):
        return (self.book.get("hero") or {}).get("name") or "your hero"

    def _unchecked(self):
        """Painted pages whose newest picture hasn't had the skin check yet (the owner's own books only)."""
        if not self._data["mine"]:
            return []
        return sorted(int(k) for k, v in (self.book.get("paint") or {}).items() if v.get("done") and not v.get("checked"))

    def _check_skin(self):
        """Run the skin check on each new picture and tell the server (it repaints a page by itself if needed)."""
        if self._checking:
            return
        self._checking = True
        try:
            for idx in self._unchecked():
                entry = (self.book.get("paint") or {}).get(str(idx)) or {}
                try:
                    res = lh.skin_check(self.book, idx, self.book["paintBase"] + entry["key"])
                except Exception:
                    res = '{"skipped": "the picture could not be read"}'
                r = state.call_quiet("paint_verdict", self._data["id"], idx, res)
                if r and r.get("ok"):
                    self._paint_update(r, check=False)
                    if r.get("retry"):
                        state.toast("Page %d didn't look like %s, so it's being painted again." % (idx + 1, self._hero_name()))
        finally:
            self._checking = False
        self._paint_draw()

    def _page_tools(self):
        """Repaint this page, and the warning, for the page open in the reader."""
        st = self._paint_state if self._data["mine"] else None
        entry = (self.book.get("paint") or {}).get(str(self._page))
        status = ((st or {}).get("page_status") or {}).get(str(self._page))
        self.repaint_button.visible = bool(st) and (entry is not None or status is not None)
        self.repaint_button.enabled = status != "queued" and status != "working" and status != "sending"
        self.repaint_button.text = "Repainting…" if not self.repaint_button.enabled else "Repaint this page"
        flagged = bool(entry and entry.get("flag"))
        self.paint_flag.visible = flagged
        if flagged:
            self.paint_flag_text.text = ("This picture may not look like %s: the skin colour came out different from the "
                                         "drawing. Press Repaint this page, or switch Painted off to show the drawing."
                                         % self._hero_name())

    @handle("reader", "page")
    def reader_page(self, index, **event_args):
        self._page = int(index)
        self._page_tools()

    @handle("repaint_button", "click")
    def repaint_button_click(self, **event_args):
        st = self._paint_state or {}
        entry = (self.book.get("paint") or {}).get(str(self._page)) or {}
        style = entry.get("style") or st.get("style")
        if not style:
            return
        self.repaint_button.enabled = False
        self.repaint_button.text = "Repainting…"
        try:
            blob = lh.paint_picture(self.book, self._page)
            r = state.call("paint_page", self._data["id"], self._page, style, anvil.js.to_media(blob), True)
        except Exception:
            r = None
            state.toast("That page couldn't be sent. Check your connection and try again.")
        if r:
            state.toast("Painting page %d again. The new picture appears here in a minute or two." % (self._page + 1), "ok")
        self._paint_update(state.call_quiet("paint_status", self._data["id"]))

    def _paint_update(self, r, check=True):
        if not r or not r.get("ok"):
            return
        self._paint_state = r.get("state")
        if (r.get("paint") or {}) != (self.book.get("paint") or {}):
            self.reader.set_paint(r.get("paint") or {})
        self.book["paint"] = r.get("paint") or {}
        self._paint_draw()
        if check and self._unchecked():
            self._check_skin()

    @handle("paint_timer", "tick")
    def paint_timer_tick(self, **event_args):
        st = self._paint_state or {}
        if st.get("status") == "painting":
            self._paint_update(state.call_quiet("paint_status", self._data["id"]))
        elif self._unchecked():
            self._check_skin()
        else:
            self.paint_timer.interval = 0

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
            state.toast("Back to the drawings. The painted pictures stay saved.", "ok")
        elif res.get("reused") and not res.get("sent") and not res.get("failed"):
            state.toast("Switched to the saved %s pictures: no waiting!" % res.get("style"), "ok")
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
