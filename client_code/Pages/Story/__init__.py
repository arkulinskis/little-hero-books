from anvil import *

from ._anvil_designer import StoryTemplate
from ... import books, lh, router, state


class Story(StoryTemplate):
    """#story/<key>/<heroRef>: try any story with any hero (one of yours, the studio draft, an example, or 'blank' =
    the generic book). Switch heroes with the chips; add it to your shelf when the hero is yours."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.picks_panel.add_event_handler("x-pick", self._pick)
        self._key = args[0] if args else "bears"
        ref = args[1] if len(args) > 1 else None
        r = state.call("get_story", self._key)
        if not r:
            router.go("library")
            return
        self._story = r["story"]
        if self._story.get("custom"):
            self.edit_button.text = "Edit"
            state.set_attr(self.back_link, "href", "#write")
        self._lib = state.call("get_library")
        books.remember_stories(self._lib)
        self._choices = books.hero_choices(self._lib)
        self._show(ref)

    def _show(self, ref):
        self._choice = next((c for c in self._choices if c["ref"] == ref), self._choices[0])
        c, me = self._choice, state.me()
        hero = c["hero"]
        self.book = books.as_book(self._story, hero)
        self.title.text = lh.title(self._story, hero)
        if not hero:
            self.intro.text = "The blank book: every picture has a space where your hero goes."
        elif c["own"]:
            self.intro.text = "A preview with %s. Add it to your shelf to keep it." % hero["name"]
        elif c["ref"] == "draft":
            self.intro.text = "A preview with your studio draft."
        else:
            self.intro.text = "An example hero. Make your own in the studio!"
        self.picks_panel.items = [{"choice": x, "on": x["ref"] == c["ref"]} for x in self._choices]
        self.make_button.visible = c["own"]
        self.save_link.visible = c["ref"] == "draft"
        self.pdf_button.visible = bool(hero) and bool(me)
        self.pdf_button.text = "PDF" if c["own"] else "Download PDF"
        self.signup_link.visible = bool(hero) and not me
        self.cta.visible = not (me and self._lib["heroes"])
        self.cta.hero = hero
        self.reader.book = self.book

    def _pick(self, ref, **event_args):
        router.replace("story", self._key, ref)
        self._show(ref)

    @handle("make_button", "click")
    def make_button_click(self, **event_args):
        books.make_book(self._story, self._lib["heroes"], self._choice["ref"])

    @handle("edit_button", "click")
    def edit_button_click(self, **event_args):
        """Change this story: your own opens in the writing page, a library story starts a copy of it."""
        target = ("write", self._key) if self._story.get("custom") else ("write", "new", self._key)
        if not state.me():
            router.remember_after(router.href(*target))
            state.toast("Make a free account to write your own stories.")
            router.go("auth", "signup")
            return
        router.go(*target)

    @handle("pdf_button", "click")
    def pdf_button_click(self, **event_args):
        books.download_pdf(self.book)
