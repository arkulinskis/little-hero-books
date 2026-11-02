from anvil import *

from ._anvil_designer import FaceBubbleTemplate


class FaceBubble(FaceBubbleTemplate):
    """A round face (the shelf's "make your first hero" card). item = {"hero": {name, look}}."""

    def __init__(self, **properties):
        super().__init__(**properties)
