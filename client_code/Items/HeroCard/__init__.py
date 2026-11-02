from anvil import *

from ._anvil_designer import HeroCardTemplate
from ... import state


class HeroCard(HeroCardTemplate):
    """One of your heroes on the shelf. item = hero dict + "colour" (the face's background).
    "Book" raises x-make-for on the RepeatingPanel; the Shelf page opens the library for that hero."""

    def __init__(self, **properties):
        super().__init__(**properties)
        h = self.item
        self.face_ring.style["--hb"] = h.get("colour") or "#ffc93c"
        n = h.get("books") or 0
        self.books_label.text = ("Stars in " + state.plural(n, "book")) if n else "No books yet"
        state.set_attr(self.edit_link, "href", "#studio/" + h["id"])

    @handle("book_button", "click")
    def book_button_click(self, **event_args):
        self.parent.raise_event("x-make-for", hero_id=self.item["id"])
