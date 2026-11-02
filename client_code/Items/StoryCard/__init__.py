from anvil import *

from ._anvil_designer import StoryCardTemplate


class StoryCard(StoryCardTemplate):
    """A story in the library, drawn with the chosen hero. item = {"story", "hero", "own"}.
    Read (or the cover) raises x-read; Add to shelf (only with your own hero) raises x-make."""

    def __init__(self, **properties):
        super().__init__(**properties)
        s = self.item["story"]
        self.pages_badge.text = "%d pages" % s["pages"]
        self.minutes_badge.text = "%d min" % s["minutes"]

    @handle("cover", "click")
    def cover_click(self, **event_args):
        self.parent.raise_event("x-read", story=self.item["story"])

    @handle("read_button", "click")
    def read_button_click(self, **event_args):
        self.parent.raise_event("x-read", story=self.item["story"])

    @handle("make_button", "click")
    def make_button_click(self, **event_args):
        self.parent.raise_event("x-make", story=self.item["story"])
