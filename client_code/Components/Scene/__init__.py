from anvil import *
import anvil.js

from ._anvil_designer import SceneTemplate
from ... import lh


class Scene(SceneTemplate):
    """One story picture with the hero drawn in (the studio's "Try it in a story", the landing page)."""

    def __init__(self, **properties):
        self._key, self._page, self._hero, self._align = "bears", "cover", None, ""
        self._clip = lh.uid("sc")
        self._ready = False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        page = self._page if self._page == "cover" else int(self._page)
        svg = lh.scene_svg(self._key, page, self._hero, clip=self._clip)
        if self._align == "right":
            svg = svg.replace("xMidYMid slice", "xMaxYMid slice")
        anvil.js.get_dom_node(self).innerHTML = svg

    def scene_click(self, event):
        self.raise_event("click")

    @property
    def story_key(self):
        return self._key

    @story_key.setter
    def story_key(self, value):
        self._key = value or "bears"
        self._draw()

    @property
    def page(self):
        return self._page

    @page.setter
    def page(self, value):
        self._page = "cover" if value in (None, "", "cover") else str(value)
        self._draw()

    @property
    def hero(self):
        return self._hero

    @hero.setter
    def hero(self, value):
        self._hero = value
        self._draw()

    @property
    def align(self):
        return self._align

    @align.setter
    def align(self, value):
        self._align = value or ""
        self._draw()
