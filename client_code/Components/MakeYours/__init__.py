from anvil import *

from ._anvil_designer import MakeYoursTemplate


class MakeYours(MakeYoursTemplate):
    """The "Make one starring your child" card under books that aren't yours."""

    def __init__(self, **properties):
        self._hero, self._ready = None, False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if self._ready:
            look = (self._hero or {}).get("look")
            self.face.visible = bool(look)
            if look:
                self.face.look = look

    @property
    def hero(self):
        return self._hero

    @hero.setter
    def hero(self, value):
        self._hero = value
        self._draw()
