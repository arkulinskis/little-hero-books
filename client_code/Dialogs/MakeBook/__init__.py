from anvil import *

from ._anvil_designer import MakeBookTemplate
from ... import lh, state

IDEAS = ["For {name}, our sunshine. Love, Mum & Dad", "Happy birthday, {name}! Love from Grandma & Grandpa",
         "For {name}, the bravest little hero we know.", "Sweet dreams, {name}. We love you to the moon and back."]


class MakeBook(MakeBookTemplate):
    """"Make this book": pick one of your heroes, write a dedication (or tap an idea), make_book.
    Closes with {"id", "existed"} (books.make_book then opens the book), or None."""

    def __init__(self, story, heroes, hero_id=None, **properties):
        super().__init__(**properties)
        self.story, self.heroes = story, list(heroes)
        self.pick = next((h for h in self.heroes if h["id"] == hero_id), self.heroes[0])
        self.heroes_part.visible = len(self.heroes) > 1
        self.heroes_panel.add_event_handler("x-pick", self._pick)
        self.ideas_panel.add_event_handler("x-idea", self._idea)
        self._draw()

    def _draw(self):
        p = self.pick
        self.title.text = lh.title(self.story, p)
        self.cover.hero = p
        self.cover.story = self.story
        self.heroes_panel.items = [{"choice": {"ref": h["id"], "hero": h, "label": h["name"]}, "on": h["id"] == p["id"]}
                                   for h in self.heroes]
        self.dedication_box.placeholder = "For %s, the hero of this story, with all our love." % p["name"]
        self.ideas_panel.items = [{"text": lh.fill(t, p)} for t in IDEAS]

    def _pick(self, ref, **event_args):
        self.pick = next((h for h in self.heroes if h["id"] == ref), self.pick)
        self._draw()

    def _idea(self, text, **event_args):
        self.dedication_box.text = text

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)

    @handle("make_button", "click")
    def make_button_click(self, **event_args):
        self.make_button.enabled = False
        try:
            r = state.call("make_book", self.pick["id"], self.story["key"], self.dedication_box.text or "")
        finally:
            self.make_button.enabled = True
        if r:
            self.raise_event("x-close-alert", value={"id": r["book"]["id"], "existed": r.get("existed")})
