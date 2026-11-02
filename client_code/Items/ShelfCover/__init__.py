from anvil import *

from ._anvil_designer import ShelfCoverTemplate


class ShelfCover(ShelfCoverTemplate):
    """A cover on the landing page's shelf. item = {"story": {key, title, color}, "hero": {...}}."""

    def __init__(self, **properties):
        super().__init__(**properties)
