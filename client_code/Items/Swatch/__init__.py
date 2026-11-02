from anvil import *

from ._anvil_designer import SwatchTemplate
from ... import state


class Swatch(SwatchTemplate):
    """A colour circle in the studio. item = {key, value, colour, name, on}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.show(self.item)

    def show(self, item):
        self.item = item
        self.style["background"] = item["colour"]
        self.classes["on"] = bool(item.get("on"))
        state.set_attr(self, "aria-label", item["name"])
        state.set_attr(self, "title", item["name"])

    def swatch_click(self, event):
        self.parent.raise_event("x-opt", key=self.item["key"], value=self.item["value"])
