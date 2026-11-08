from anvil import *

from ._anvil_designer import PaintStyleTemplate
from ... import state


class PaintStyle(PaintStyleTemplate):
    """A painting style in the Paint dialog. item = {"key", "label", "note", "on"}. The swatch shows three colours
    typical of the style (CSS .pt-sw-<key>). Tapping it raises x-style(key) on the RepeatingPanel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        it = self.item
        self.label.text = it["label"]
        self.note.text = it["note"]
        self.swatch.classes["pt-sw-" + it["key"]] = True
        self.classes["on"] = bool(it.get("on"))
        state.set_attr(self, "aria-pressed", "true" if it.get("on") else "false")
        state.set_attr(self, "data-style", it["key"])

    def card_click(self, event):
        self.parent.raise_event("x-style", key=self.item["key"])
