from anvil import *
import anvil.js

from ._anvil_designer import PicTileTemplate
from ... import lh, state


class PicTile(PicTileTemplate):
    """A picture to choose in the Pick a picture dialog. item = {"ref" ("bears:3"), "label", "hero", "on"}.
    Tapping it raises x-pic(ref) on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        it = self.item
        anvil.js.get_dom_node(self.art).innerHTML = lh.pic_svg(it["ref"], it["hero"], clip=lh.uid("pt"))
        self.label.text = it["label"]
        self.classes["on"] = bool(it.get("on"))
        state.set_attr(self, "aria-pressed", "true" if it.get("on") else "false")

    def tile_click(self, event):
        self.parent.raise_event("x-pic", ref=self.item["ref"])
