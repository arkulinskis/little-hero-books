from anvil import *

from ._anvil_designer import DedicationTemplate
from ... import lh, state


class Dedication(DedicationTemplate):
    """Edit a book's dedication (printed on the first page). Closes with the new text, or None."""

    def __init__(self, book, **properties):
        super().__init__(**properties)
        self.book = book
        self.intro.text = "Printed on the first page, under %s’s portrait." % book["hero"]["name"]
        blank = dict(book)
        blank["dedication"] = ""
        self.text_box.placeholder = lh.dedication(blank)
        self.text_box.text = book.get("dedication") or ""

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)

    @handle("save_button", "click")
    def save_button_click(self, **event_args):
        self.save_button.enabled = False
        try:
            r = state.call("update_book", self.book["id"], self.text_box.text or "")
        finally:
            self.save_button.enabled = True
        if r:
            state.toast("Saved", "ok")
            self.raise_event("x-close-alert", value=r["book"]["dedication"])
