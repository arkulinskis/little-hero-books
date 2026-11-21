import anvil.server
from anvil import *

from ._anvil_designer import ReadTemplate
from ... import books, lh, state


class Read(ReadTemplate):
    """#read/<shareKey>: a family link. Anyone with it can read and download that one book (no parent details), and
    hear the parent's recorded voice on the pages they recorded (Read to me).
    A wrapped book (Gift it, book["gift"]) shows the present first: locked with "Opens in N sleeps" before its day, "Tap
    the bow!" from then on. Unwrapping opens the reader at the cover (remembered in this browser as "opened:<key>", and
    the first unwrap is recorded with gift_opened); "Grown-up? Peek inside" opens the reader without unwrapping it, and
    "Wrap it again" plays the present once more."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self._key = args[0] if args else ""
        r = anvil.server.call("get_shared_book", self._key)
        self.found.visible = bool(r.get("ok"))
        self.broken.visible = not r.get("ok")
        if not r.get("ok"):
            self.broken_text.text = r.get("error") or ""
            return
        b, hero = r["book"], r["book"]["hero"]
        self._story, self._hero, self._gift, self._mounted = r["story"], hero, b.get("gift"), False
        self.book = books.as_book(r["story"], hero, dedication=b["dedication"], created=b["created"], voice=b.get("voice") or {},
                                  paint=b.get("paint") or {})
        self.cta.hero = hero
        self.gift_box.add_event_handler("unwrapped", self._unwrapped)
        if self._gift and not state.store_get("opened:" + self._key, False):
            self._show_gift()
        else:
            self._show_book(unwrapped=bool(self._gift))

    def _from(self):
        return (self._gift or {}).get("sender") or "your family"

    def _show_gift(self):
        g, name = self._gift or {}, self._hero["name"]
        self.gift_part.visible, self.book_part.visible = True, False
        self.title.text = "A present for %s" % name
        day = lh.gift_day(g.get("open_on"), True)
        waiting = bool(day) and lh.gift_sleeps(g.get("open_on")) > 0
        self.intro.text = "From %s, with love. %s" % (self._from(), ("It opens on %s." % day) if waiting
                                                       else "It’s ready: tap the bow to unwrap it!")
        self.gift_box.story = self._story
        self.gift_box.hero = self._hero
        self.gift_box.gift = g

    def _show_book(self, unwrapped=False, peek=False):
        hero = self._hero
        self.gift_part.visible, self.book_part.visible = False, True
        self.peek_note.visible = peek
        self.again_button.visible = unwrapped and not peek
        self.title.text = lh.title(self._story, hero)
        if peek:
            self.peek_text.text = ("Just a peek: the present stays wrapped for %s. Check the name and the pictures, "
                                   "then wrap it back up." % hero["name"])
        if self.book["voice"]:
            text = ("Someone who loves %s shared this book and recorded themselves reading it. "
                    "Press Read to me to hear their voice, page by page." % hero["name"])
        else:
            text = "Someone who loves %s shared this book with you. Read it together, or download it to print." % hero["name"]
        self.intro.text = ("A present from %s! " % self._from() + text) if unwrapped and not peek else text
        if not self._mounted:
            self._mounted = True
            self.reader.book = self.book
        else:
            self.reader.go(0)

    def _unwrapped(self, **event_args):
        state.store_set("opened:" + self._key, True)
        try:
            anvil.server.call_s("gift_opened", self._key)
        except Exception:
            pass  # the unwrap still counts on this device
        self._show_book(unwrapped=True)
        state.confetti()

    @handle("peek_button", "click")
    def peek_button_click(self, **event_args):
        self._show_book(peek=True)

    @handle("rewrap_button", "click")
    def rewrap_button_click(self, **event_args):
        self._show_gift()

    @handle("again_button", "click")
    def again_button_click(self, **event_args):
        state.store_set("opened:" + self._key, False)
        self._show_gift()

    @handle("pdf_button", "click")
    def pdf_button_click(self, **event_args):
        books.download_pdf(self.book)
