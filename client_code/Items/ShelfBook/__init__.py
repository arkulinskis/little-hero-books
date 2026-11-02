from anvil import *

from ._anvil_designer import ShelfBookTemplate
from ... import router, state


class ShelfBook(ShelfBookTemplate):
    """A book on a shelf: its cover, the date (or whose book it is, on the example shelf) and reading stars.
    item = book dict from get_shelf + "show_owner". The whole thing is a link to #book/<id>."""

    def __init__(self, **properties):
        super().__init__(**properties)
        b = self.item
        state.set_attr(self, "href", router.href("book", b["id"]))
        self.who.text = (b["hero"]["name"] + "’s book") if b.get("show_owner") else state.short_date(b.get("created"))
        n = min(5, b.get("times_read") or 0)
        self.stars.text = "★" * n if n else "new"
        self.stars.tooltip = "Read " + state.plural(b.get("times_read") or 0, "time")
        self.stars.role = "sh-stars" if n else ["sh-stars", "faint"]
