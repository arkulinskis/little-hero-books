from anvil import *

from ._anvil_designer import StoryCardTemplate


class StoryCard(StoryCardTemplate):
    """A story in the library, drawn with the chosen hero. item = {"story", "hero", "own", "edit"}.
    Read (or the cover) raises x-read; Add to shelf (only with your own hero) raises x-make; Edit (item["edit"]: a
    story you wrote) raises x-edit. Badges: "New story" (our own new ones), "Your story" (written by you), "Christmas"
    (a seasonal story)."""

    def __init__(self, **properties):
        super().__init__(**properties)
        s = self.item["story"]
        self.pages_badge.text = "%d pages" % s["pages"]
        self.minutes_badge.text = "%d min" % s["minutes"]
        self.kind_badge.text = "Your story" if s.get("custom") else ("New story" if s.get("original") else "")
        if s.get("season") == "christmas":
            self.kind_badge.text = "Christmas"
            self.kind_badge.role = ["badge", "badge-xmas"]
        self.kind_badge.visible = bool(self.kind_badge.text)
        self.ages_badge.visible = not s.get("custom")
        self.edit_button.visible = bool(self.item.get("edit"))

    @handle("cover", "click")
    def cover_click(self, **event_args):
        self.parent.raise_event("x-read", story=self.item["story"])

    @handle("read_button", "click")
    def read_button_click(self, **event_args):
        self.parent.raise_event("x-read", story=self.item["story"])

    @handle("edit_button", "click")
    def edit_button_click(self, **event_args):
        self.parent.raise_event("x-edit", story=self.item["story"])

    @handle("make_button", "click")
    def make_button_click(self, **event_args):
        self.parent.raise_event("x-make", story=self.item["story"])
