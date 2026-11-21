from anvil import *
from anvil.js import window

from ._anvil_designer import GiftBoxTemplate
from ... import lh

WIGGLE = [{"transform": "rotate(0deg)"}, {"transform": "rotate(-6deg)"}, {"transform": "rotate(5deg)"},
          {"transform": "rotate(-4deg)"}, {"transform": "rotate(3deg)"}, {"transform": "rotate(0deg)"}]


class GiftBox(GiftBoxTemplate):
    """The wrapped present on a family link (Pages/Read) and in the Gift dialog (preview=True).
    Locked before its day (the viewer's own date): a tap wiggles it and says how many sleeps are left. From its day:
    "Tap the bow!" plays the unwrap (a plain fade with reduced motion), then raises `unwrapped`."""

    def __init__(self, **properties):
        self._gift, self._hero, self._story, self._preview = None, None, None, False
        self._state, self._ready = "locked", False
        super().__init__(**properties)
        self._ready = True
        self.dom_nodes["mount"].addEventListener("click", self._click)
        self._draw()

    def _sleeps(self):
        return lh.gift_sleeps((self._gift or {}).get("open_on"))

    def _say(self, sleeps):
        if sleeps > 1:
            return "Opens in %d sleeps!" % sleeps
        if sleeps == 1:
            return "Opens tomorrow! Just one more sleep."
        return "Ready to unwrap on the day" if self._preview and (self._gift or {}).get("open_on") else (
            "Ready to unwrap any time" if self._preview else "Tap the bow!")

    def _draw(self):
        if not self._ready or self._gift is None:
            return
        sleeps = self._sleeps()
        self._state = "locked" if sleeps > 0 else "ready"
        self.dom_nodes["mount"].innerHTML = lh.gift_html(self._hero, self._gift, self._state, self._story)
        self.say.text = self._say(sleeps)
        if self._preview:
            box = self.dom_nodes["mount"].querySelector(".gf-hit")
            if box:
                box.setAttribute("tabindex", "-1")
                box.setAttribute("aria-hidden", "true")

    def _gf(self):
        return self.dom_nodes["mount"].querySelector(".gf")

    def _click(self, event):
        if self._preview or self._state in ("unwrapping", "open"):
            return
        if not event.target.closest(".gf-hit"):
            return
        if self._state == "locked":
            self.say.text = "Not yet! " + self._say(self._sleeps())
            hit = self.dom_nodes["mount"].querySelector(".gf-hit")
            if hit and not window.UI.reducedMotion():
                hit.animate(WIGGLE, {"duration": 520, "easing": "ease-in-out"})
            return
        self.unwrap()

    def unwrap(self):
        """Untie the bow and let the paper fall away; `unwrapped` follows when the cover has risen."""
        gf = self._gf()
        if gf is None:
            return
        self._state = "unwrapping"
        gf.setAttribute("data-state", "unwrapping")
        self.say.text = "Here it comes…"
        window.setTimeout(self._done, 450 if window.UI.reducedMotion() else 1650)

    def _done(self):
        gf = self._gf()
        if gf is not None:
            gf.setAttribute("data-state", "open")
        self._state = "open"
        self.raise_event("unwrapped")

    @property
    def gift(self):
        return self._gift

    @gift.setter
    def gift(self, value):
        self._gift = value
        self._draw()

    @property
    def hero(self):
        return self._hero

    @hero.setter
    def hero(self, value):
        self._hero = value
        self._draw()

    @property
    def story(self):
        return self._story

    @story.setter
    def story(self, value):
        self._story = value
        self._draw()

    @property
    def preview(self):
        return self._preview

    @preview.setter
    def preview(self, value):
        self._preview = bool(value)
        self._draw()
