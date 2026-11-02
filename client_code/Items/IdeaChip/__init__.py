from anvil import *

from ._anvil_designer import IdeaChipTemplate


class IdeaChip(IdeaChipTemplate):
    """A dedication idea under the text box. item = {"text"}. Tapping it raises x-idea(text) on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)

    def idea_click(self, event):
        self.parent.raise_event("x-idea", text=self.item["text"])
