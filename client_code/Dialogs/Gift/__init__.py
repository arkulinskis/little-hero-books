import datetime

import anvil.server
from anvil import *
from anvil.js import window

from ._anvil_designer import GiftTemplate
from ... import lh, state

WRAPS = ["christmas", "birthday", "stars", "crayons"]
SENDERS = ["Grandma", "Grandpa", "Grandma & Grandpa", "Mum", "Dad", "Mum & Dad", "Auntie", "Uncle", "Your family", "Santa"]
CHIP = ["btn", "btn-sm", "gf-chip"]


def _today():
    y, m, d = (int(x) for x in lh.today().split("-"))
    return datetime.date(y, m, d)


def _next(month, day):
    """The next 24/25 December (this year's, or next year's once it has passed)."""
    t = _today()
    d = datetime.date(t.year, month, day)
    return d if d >= t else datetime.date(t.year + 1, month, day)


class Gift(GiftTemplate):
    """"Gift it": wrap a book's family link as a present (Gifts.py). Pick the paper, who it is from (a fixed list) and the
    day it opens; the preview updates as you choose. Wrap it (set_gift makes the family link if there is none), then copy
    or share the link and save the printable gift card (LH.giftCard: PNG with a QR code). Updates book["gift"] and
    book["share_key"] in place. Without the gifts table yet (before the Schema Mismatch is accepted) it says gifts arrive
    with the next update."""

    def __init__(self, book, **properties):
        super().__init__(**properties)
        self.book = book
        hero = book.get("hero") or {}
        g = book.get("gift") or {}
        self._wrap = g.get("wrap") or "christmas"
        self._sender = g.get("sender") or "Grandma"
        self._day = g.get("open_on") if book.get("gift") else _next(12, 25).isoformat()
        self._pick = bool(self._day) and self._day not in (_next(12, 24).isoformat(), _next(12, 25).isoformat())
        self.intro.text = ("Wrap %s as a present. Until the day you pick, the family link shows a wrapped present with a "
                           "“To %s” tag and counts the sleeps; on the day, %s taps the bow and the paper falls away."
                           % (lh.title(book["story"], hero), hero.get("name") or "your hero", hero.get("name") or "your hero"))
        self.sender_box.items = SENDERS
        self.sender_box.selected_value = self._sender
        self.date_box.min_date = _today()
        self.date_box.max_date = _today() + datetime.timedelta(days=400)
        if self._pick and self._day:
            self.date_box.date = datetime.date(*(int(x) for x in self._day.split("-")))
        ready = book.get("gifts_ready", True) is not False
        self.later_part.visible = not ready
        self.later_text.text = ("Gift wrapping arrives with the next update of Little Hero Books. "
                                "Until then, the family link works as usual.")
        for c in (self.form_part, self.save_button):
            c.visible = ready
        self.preview.story = book["story"]
        self.preview.hero = hero
        self._draw()

    # ---- what the person picked
    def _gift(self):
        return {"wrap": self._wrap, "sender": self._sender, "open_on": self._day or None}

    def _draw(self):
        for w in WRAPS:
            b = getattr(self, "wrap_" + w)
            b.role = CHIP + (["gf-on"] if w == self._wrap else [])
            state.set_attr(b, "aria-pressed", "true" if w == self._wrap else "false")
        eve, xmas = _next(12, 24).isoformat(), _next(12, 25).isoformat()
        picks = {"day_eve": not self._pick and self._day == eve, "day_xmas": not self._pick and self._day == xmas,
                 "day_any": not self._day, "day_pick": self._pick}
        for name, on in picks.items():
            b = getattr(self, name)
            b.role = CHIP + (["ic-calendar"] if name == "day_pick" else []) + (["gf-on"] if on else [])
            state.set_attr(b, "aria-pressed", "true" if on else "false")
        self.date_part.visible = self._pick
        self.preview.gift = self._gift()
        g = self.book.get("gift")
        self.link_part.visible = bool(g and self.book.get("share_key"))
        self.remove_button.visible = bool(g)
        self.save_button.text = "Save changes" if g else "Wrap it"
        if self.link_part.visible:
            self.url_box.text = self._url()
            day = lh.gift_day(g.get("open_on"), True)
            self.done_text.text = ("Wrapped! Send this link. It opens on %s." % day) if g.get("open_on") else "Wrapped! Send this link. It can be opened straight away."
            if g.get("opened"):
                self.done_text.text = "Unwrapped on %s. Send the link again any time." % lh.gift_day(g["opened"][:10])

    def _url(self):
        return window.location.href.split("#")[0] + "#read/" + (self.book.get("share_key") or "")

    def _set_wrap(self, w):
        self._wrap = w
        self._draw()

    @handle("wrap_christmas", "click")
    def wrap_christmas_click(self, **event_args):
        self._set_wrap("christmas")

    @handle("wrap_birthday", "click")
    def wrap_birthday_click(self, **event_args):
        self._set_wrap("birthday")

    @handle("wrap_stars", "click")
    def wrap_stars_click(self, **event_args):
        self._set_wrap("stars")

    @handle("wrap_crayons", "click")
    def wrap_crayons_click(self, **event_args):
        self._set_wrap("crayons")

    @handle("sender_box", "change")
    def sender_box_change(self, **event_args):
        self._sender = self.sender_box.selected_value or "Your family"
        self._draw()

    def _set_day(self, day, pick=False):
        self._day, self._pick = day, pick
        self._draw()

    @handle("day_eve", "click")
    def day_eve_click(self, **event_args):
        self._set_day(_next(12, 24).isoformat())

    @handle("day_xmas", "click")
    def day_xmas_click(self, **event_args):
        self._set_day(_next(12, 25).isoformat())

    @handle("day_any", "click")
    def day_any_click(self, **event_args):
        self._set_day(None)

    @handle("day_pick", "click")
    def day_pick_click(self, **event_args):
        d = self.date_box.date
        self._set_day(d.isoformat() if d else (self._day or _next(12, 25).isoformat()), pick=True)

    @handle("date_box", "change")
    def date_box_change(self, **event_args):
        d = self.date_box.date
        if d:
            self._set_day(d.isoformat(), pick=True)

    # ---- wrap, share, card
    @handle("save_button", "click")
    def save_button_click(self, **event_args):
        g = self._gift()
        try:
            r = anvil.server.call("set_gift", self.book["id"], g["wrap"], g["sender"], g["open_on"])
        except Exception:
            r = {"ok": False, "error": "That didn’t work. Check your connection and try again."}
        if not r.get("ok"):
            if r.get("later"):
                self.later_part.visible = True
                self.later_text.text = r.get("error") or ""
            else:
                state.toast(r.get("error") or "That didn’t work.")
            return
        self.book["gift"] = r["gift"]
        self.book["share_key"] = r["share_key"]
        self.book["shared"] = True
        self._draw()
        state.toast("Wrapped! Copy the link or save the gift card.", "ok")

    @handle("copy_button", "click")
    def copy_button_click(self, **event_args):
        self.url_box.select()
        try:
            window.navigator.clipboard.writeText(self.url_box.text)
        except Exception:
            window.document.execCommand("copy")
        state.toast("Copied!", "ok")

    @handle("share_button", "click")
    def share_button_click(self, **event_args):
        hero = self.book.get("hero") or {}
        res = lh.share_link(self._url(), lh.title(self.book["story"], hero),
                            "A present for %s from %s" % (hero.get("name") or "you", (self.book.get("gift") or {}).get("sender") or "us"))
        if res == "none":
            self.copy_button_click()

    @handle("card_button", "click")
    def card_button_click(self, **event_args):
        hero = self.book.get("hero") or {}
        self.card_button.enabled = False
        self.card_button.text = "Making the card…"
        try:
            blob = lh.gift_card(self.book, self.book.get("gift") or self._gift(), self._url())
            res = lh.share_or_save(blob, "%s gift card.png" % (hero.get("name") or "Little Hero"), lh.title(self.book["story"], hero))
            if res == "saved":
                state.toast("The gift card is in your downloads. Print it and put it under the tree!", "ok")
        except Exception as e:
            state.toast("The card couldn’t be made: %s" % e)
        finally:
            self.card_button.enabled = True
            self.card_button.text = "Save the gift card"

    @handle("remove_button", "click")
    def remove_button_click(self, **event_args):
        r = state.call("remove_gift", self.book["id"])  # no "are you sure": wrapping it again takes one press
        if r:
            self.book["gift"] = None
            self._draw()
            state.toast("The wrapping is off. The family link opens the book.", "ok")

    @handle("close_button", "click")
    def close_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=self.book.get("gift"))
