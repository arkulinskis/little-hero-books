from anvil import *

from ._anvil_designer import StartTileTemplate


class StartTile(StartTileTemplate):
    """A library story to start writing from (#write). item = {"story", "hero"}. Raises x-start(key) on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)

    @handle("cover", "click")
    def cover_click(self, **event_args):
        self.parent.raise_event("x-start", key=self.item["story"]["key"])

    @handle("start_button", "click")
    def start_button_click(self, **event_args):
        self.parent.raise_event("x-start", key=self.item["story"]["key"])
