from anvil import *
from anvil.js import window

from ._anvil_designer import FamilyLinkTemplate
from ... import lh, state


class FamilyLink(FamilyLinkTemplate):
    """Make, copy or turn off a book's family link (#read/<key>). Updates book["share_key"] in place."""

    def __init__(self, book, **properties):
        super().__init__(**properties)
        self.book = book
        self.intro.text = ("Send grandparents, aunts and uncles a link to %s. They can read it and download the PDF "
                           "without an account. They see %s’s name and cartoon, never your email."
                           % (lh.title(book["story"], book["hero"]), book["hero"]["name"]))
        self._draw()

    def _draw(self):
        key = self.book.get("share_key")
        self.on_part.visible = bool(key)
        self.off_part.visible = not key
        if key:
            self.url_box.text = window.location.href.split("#")[0] + "#read/" + key

    def _share(self, on):
        r = state.call("share_book", self.book["id"], on)
        if r:
            self.book["share_key"] = r["book"]["share_key"]
            self.book["shared"] = r["book"]["shared"]
            self._draw()
            state.toast("Link made. Copy it and send it to the family!" if on
                        else "The link is off. The old link no longer works.", "ok")

    @handle("on_button", "click")
    def on_button_click(self, **event_args):
        self._share(True)

    @handle("off_button", "click")
    def off_button_click(self, **event_args):
        self._share(False)

    @handle("copy_button", "click")
    def copy_button_click(self, **event_args):
        self.url_box.select()
        try:
            window.navigator.clipboard.writeText(self.url_box.text)
        except Exception:
            window.document.execCommand("copy")
        state.toast("Copied!", "ok")

    @handle("later_button", "click")
    def later_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)

    @handle("done_button", "click")
    def done_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
