from anvil import *

from ._anvil_designer import HeroPickTemplate


class HeroPick(HeroPickTemplate):
    """A round-faced chip for choosing who stars in a story (library, story preview). A choice without a hero shows
    a "?" face (the blank book). In lists, Items.PickChip wraps it for a RepeatingPanel."""

    def __init__(self, **properties):
        self._choice, self._selected = None, False
        self._ready = False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready or not self._choice:
            return
        c = self._choice
        hero = c.get("hero")
        self.face_box.visible = bool(hero)
        self.ghost.visible = not hero
        if hero:
            self.face.look = hero.get("look")
        self.label.text = c.get("label") or ""
        self.note.text = c.get("note") or ""
        self.note.visible = bool(c.get("note"))
        self.classes["on"] = self._selected

    def chip_click(self, event):
        if self._choice:
            self.raise_event("pick", ref=self._choice["ref"])

    @property
    def choice(self):
        return self._choice

    @choice.setter
    def choice(self, value):
        self._choice = value
        self._draw()

    @property
    def selected(self):
        return self._selected

    @selected.setter
    def selected(self, value):
        self._selected = bool(value)
        self._draw()
