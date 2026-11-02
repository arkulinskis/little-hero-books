from anvil import *

from ._anvil_designer import NextStoryTemplate


class NextStory(NextStoryTemplate):
    """A story your first hero isn't in yet. item = {"story", "hero"}. Raises x-make on the RepeatingPanel."""

    def __init__(self, **properties):
        super().__init__(**properties)

    def make_click(self, event):
        self.parent.raise_event("x-make", story=self.item["story"])
