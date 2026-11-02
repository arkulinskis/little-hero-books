from anvil import *
import anvil.js

from ._anvil_designer import AvatarTemplate
from ... import lh


class Avatar(AvatarTemplate):
    """A hero's cartoon, drawn by the JavaScript people engine. Change any property and it redraws."""

    def __init__(self, **properties):
        self._look, self._crop, self._pose, self._mood, self._fit = None, "", "", "", ""
        self._ready = False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        opts = {}
        for key, value in (("crop", self._crop), ("pose", self._pose), ("mood", self._mood), ("fit", self._fit)):
            if value:
                opts[key] = value
        anvil.js.get_dom_node(self).innerHTML = lh.avatar_svg(self._look, **opts)

    @property
    def look(self):
        return self._look

    @look.setter
    def look(self, value):
        self._look = value
        self._draw()

    @property
    def crop(self):
        return self._crop

    @crop.setter
    def crop(self, value):
        self._crop = value or ""
        self._draw()

    @property
    def pose(self):
        return self._pose

    @pose.setter
    def pose(self, value):
        self._pose = value or ""
        self._draw()

    @property
    def mood(self):
        return self._mood

    @mood.setter
    def mood(self, value):
        self._mood = value or ""
        self._draw()

    @property
    def fit(self):
        return self._fit

    @fit.setter
    def fit(self, value):
        self._fit = value or ""
        self._draw()
