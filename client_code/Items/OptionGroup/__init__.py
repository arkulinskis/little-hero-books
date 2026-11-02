from anvil import *

from ._anvil_designer import OptionGroupTemplate
from ... import lh

ROLE = {"body": ["st-opts", "st-body"], "size": ["st-opts", "st-sizes"]}


class OptionGroup(OptionGroupTemplate):
    """One group of choices in the studio ("Hairstyle", "Skin tone" ...). item = {key, title, kind, look}.
    Thumbnails show your hero with each choice. Picks bubble up as x-opt(key, value) / x-tog(key) on the
    studio's RepeatingPanel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        kind = self.item["kind"]
        self.tiles_panel.visible = kind not in ("sw", "toggles")
        self.swatches_panel.visible = kind == "sw"
        self.toggles.visible = kind == "toggles"
        self.tiles_panel.role = ROLE.get(kind, ["st-opts"])
        self.tiles_panel.add_event_handler("x-opt", self._relay)
        self.swatches_panel.add_event_handler("x-opt", self._relay)
        self.show_look(self.item["look"])

    def show_look(self, look):
        """Draw (or redraw) the choices for this look."""
        key, kind = self.item["key"], self.item["kind"]
        if kind == "toggles":
            for btn, k in ((self.cheeks_button, "cheeks"), (self.freckles_button, "freckles")):
                on = bool(look.get(k))
                btn.role = ["btn", "btn-sm", "btn-on" if on else "btn-off", "ic-check" if on else "ic-plus"]
            return
        if kind == "sw":
            items = [{"key": key, "value": v, "colour": lh.colour_of(key, v), "on": look.get(key) == v,
                      "name": ("Skin tone %d" % (i + 1)) if key == "skin" else lh.colour_name(v)}
                     for i, v in enumerate(lh.options(key))]
            self._fill(self.swatches_panel, items)
            return
        items = []
        for value, label in lh.options(key):
            variant = dict(look)
            variant[key] = value
            if key == "hat" and value != "none" and variant.get("hair") == "none":
                variant["hair"] = "fuzz"
            opts = {} if kind == "body" else {"fit": "tallest"} if kind == "size" else {"crop": "hat" if kind == "hat" else "head"}
            items.append({"key": key, "value": value, "label": label, "look": variant, "opts": opts, "on": look.get(key) == value})
        self._fill(self.tiles_panel, items)

    def _fill(self, panel, items):
        tiles = panel.get_components()
        if len(tiles) == len(items):
            for t, i in zip(tiles, items):
                t.show(i)
        else:
            panel.items = items

    def _relay(self, key, value, **event_args):
        self.parent.raise_event("x-opt", key=key, value=value)

    @handle("cheeks_button", "click")
    def cheeks_button_click(self, **event_args):
        self.parent.raise_event("x-tog", key="cheeks")

    @handle("freckles_button", "click")
    def freckles_button_click(self, **event_args):
        self.parent.raise_event("x-tog", key="freckles")
