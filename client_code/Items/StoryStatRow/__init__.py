from anvil import *

from ._anvil_designer import StoryStatRowTemplate


class StoryStatRow(StoryStatRowTemplate):
    """Admin → Library: one story with its words, books made and reads. item = a row from admin_library."""

    def __init__(self, **properties):
        super().__init__(**properties)
