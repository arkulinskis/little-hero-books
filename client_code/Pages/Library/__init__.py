from anvil import *

from ._anvil_designer import LibraryTemplate
from ... import books, router, state


class Library(LibraryTemplate):
    """#library, #library/<heroRef>: the twelve stories. The "Starring" strip redraws every cover with the chosen
    hero: one of yours, your unsaved studio draft, an example hero, or nobody (the generic "your hero here" book).
    Read a story (#story/<key>/<heroRef>) or make it into a book on your shelf."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.picks_panel.add_event_handler("x-pick", self._pick)
        self.stories_panel.add_event_handler("x-read", self._read)
        self.stories_panel.add_event_handler("x-make", self._make)
        self.guest_text.visible = not state.me()
        self.member_text.visible = bool(state.me())
        if state.me():
            state.set_attr(self.new_hero_link, "href", "#studio/new")
        self._lib = state.call("get_library")
        books.remember_stories(self._lib)
        self._choices = books.hero_choices(self._lib)
        want = args[0] if args else state.store_get("libPick", None)
        self._pick_ref(want)

    def _pick_ref(self, ref):
        self._choice = next((c for c in self._choices if c["ref"] == ref), self._choices[0])
        self.picks_panel.items = [{"choice": c, "on": c["ref"] == self._choice["ref"]} for c in self._choices]
        hero, own = self._choice["hero"], self._choice["own"]
        self.stories_panel.items = [{"story": s, "hero": hero, "own": own} for s in self._lib["stories"]]

    def _pick(self, ref, **event_args):
        state.store_set("libPick", ref)
        self._pick_ref(ref)

    def _read(self, story, **event_args):
        router.go("story", story["key"], self._choice["ref"])

    def _make(self, story, **event_args):
        books.make_book(story, self._lib["heroes"], self._choice["ref"])
