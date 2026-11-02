from anvil import *

from ._anvil_designer import ShelfRowTemplate


class ShelfRow(ShelfRowTemplate):
    """One wooden shelf of books. item = {"books": [book dicts], "demo": bool (the example shelf)}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.books_panel.items = [dict(b, show_owner=self.item["demo"]) for b in self.item["books"]]
