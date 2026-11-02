from anvil import *

from ._anvil_designer import PalButtonTemplate
from ... import state


class PalButton(PalButtonTemplate):
    """One example kid's face under the landing shelf. item = {"pal": {name, look}, "on": bool, "index": n}.
    Tapping it raises x-pick on the RepeatingPanel (the Landing page listens)."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.classes["on"] = bool(self.item.get("on"))
        state.set_attr(self, "aria-label", self.item["pal"]["name"])
        state.set_attr(self, "title", self.item["pal"]["name"])

    def pal_click(self, event):
        self.parent.raise_event("x-pick", index=self.item["index"])
