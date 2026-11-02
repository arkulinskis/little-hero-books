from anvil import *
import anvil.js

from ._anvil_designer import CoverTemplate
from ... import lh


class Cover(CoverTemplate):
    """A small book cover (shelf, library, dialogs): the cover picture with the hero, and the title."""

    def __init__(self, **properties):
        self._story, self._hero, self._sub, self._outline = None, None, "", False
        self._ready = False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if self._ready and self._story:
            anvil.js.get_dom_node(self).innerHTML = lh.cover_html(self._story, self._hero, self._sub or None, self._outline)

    def cover_click(self, event):
        self.raise_event("click")

    @property
    def story(self):
        return self._story

    @story.setter
    def story(self, value):
        self._story = value
        self._draw()

    @property
    def hero(self):
        return self._hero

    @hero.setter
    def hero(self, value):
        self._hero = value
        self._draw()

    @property
    def sub(self):
        return self._sub

    @sub.setter
    def sub(self, value):
        self._sub = value or ""
        self._draw()

    @property
    def outline(self):
        return self._outline

    @outline.setter
    def outline(self, value):
        self._outline = bool(value)
        self._draw()
