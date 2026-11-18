from anvil import *

from ._anvil_designer import PickPictureTemplate


class PickPicture(PickPictureTemplate):
    """"Pick a picture" for a page (or the cover) of a story someone is writing: a story menu, then its cover and every
    page as tiles drawn with the chosen hero. Closes with the reference ("bears:3", "bears:cover") or None."""

    def __init__(self, stories, hero, current="", **properties):
        super().__init__(**properties)
        self.stories, self.hero, self.current = stories, hero, current or ""
        self.story_drop.items = [(s["plain"], s["key"]) for s in stories]
        key = self.current.partition(":")[0]
        self.story_drop.selected_value = key if any(s["key"] == key for s in stories) else stories[0]["key"]
        self.tiles_panel.add_event_handler("x-pic", self._pick)
        self._draw()

    def _draw(self):
        s = next(x for x in self.stories if x["key"] == self.story_drop.selected_value)
        refs = [(s["key"] + ":cover", "Cover")] + [("%s:%d" % (s["key"], i), "Page %d" % (i + 1)) for i in range(s["pages"])]
        self.tiles_panel.items = [{"ref": r, "label": label, "hero": self.hero, "on": r == self.current} for r, label in refs]

    @handle("story_drop", "change")
    def story_drop_change(self, **event_args):
        self._draw()

    def _pick(self, ref, **event_args):
        self.raise_event("x-close-alert", value=ref)

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
