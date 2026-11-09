from anvil import *

from ._anvil_designer import PaintStyleTemplate
from ... import state


def preview_url(key):
    """The sample picture for a style (theme/assets/paint-<key>.jpg; "drawing" = the drawing they all started from).
    Painted on 2026-11-09 by the real studio from Juniper on the Three Bears cover, with the same instructions as books."""
    return "_/theme/paint-%s.jpg" % key


class PaintStyle(PaintStyleTemplate):
    """A painting style in the Paint dialog: its sample picture and name. item = {"key", "label", "on"}.
    Tapping it raises x-style(key) on the RepeatingPanel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        it = self.item
        self.label.text = it["label"]
        state.set_attr(self.thumb, "src", preview_url(it["key"]))
        self.classes["on"] = bool(it.get("on"))
        state.set_attr(self, "aria-pressed", "true" if it.get("on") else "false")
        state.set_attr(self, "data-style", it["key"])

    def card_click(self, event):
        self.parent.raise_event("x-style", key=self.item["key"])
