from anvil import *

from ._anvil_designer import OptionTileTemplate


class OptionTile(OptionTileTemplate):
    """A thumbnail choice in the studio. item = {key, value, label, look (your hero with this choice), opts, on}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.show(self.item)

    def show(self, item):
        self.item = item
        opts = item.get("opts") or {}
        self.thumb.crop = opts.get("crop", "")
        self.thumb.fit = opts.get("fit", "")
        self.thumb.look = item["look"]
        self.label.text = item["label"]
        self.classes["on"] = bool(item.get("on"))

    def tile_click(self, event):
        self.parent.raise_event("x-opt", key=self.item["key"], value=self.item["value"])
