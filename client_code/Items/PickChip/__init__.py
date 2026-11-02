from anvil import *

from ._anvil_designer import PickChipTemplate


class PickChip(PickChipTemplate):
    """A HeroPick chip in a RepeatingPanel. item = {"choice": {...}, "on": bool}. Raises x-pick(ref) on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)

    @handle("chip", "pick")
    def chip_pick(self, ref, **event_args):
        self.parent.raise_event("x-pick", ref=ref)
