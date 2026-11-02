from anvil import *
from anvil.js import window

from ._anvil_designer import LandingTemplate
from ... import lh, state

# The five example kids who take turns starring on the landing page (looks use the people engine's keys).
PALS = [
    {"name": "Juniper", "pronoun": "she", "look": {"size": "kid", "skin": "s2", "face": "round", "hair": "curly", "hairColor": "ginger", "eyes": "sparkle", "eyeColor": "green", "mouth": "grin", "cheeks": True, "freckles": True, "glasses": "round", "outfit": "overalls", "outfitColor": "sky"}},
    {"name": "Kofi", "pronoun": "he", "look": {"size": "kid", "skin": "s7", "face": "oval", "hair": "crop", "hairColor": "black", "eyes": "round", "eyeColor": "dark", "brows": "bold", "mouth": "toothy", "outfit": "cape", "outfitColor": "tomato"}},
    {"name": "Amara", "pronoun": "she", "look": {"size": "toddler", "skin": "s6", "face": "chubby", "hair": "puffs", "hairColor": "black", "eyes": "sparkle", "mouth": "giggle", "outfit": "dress", "outfitColor": "sun", "hat": "flower"}},
    {"name": "Sasha", "pronoun": "they", "look": {"size": "kid", "skin": "s3", "face": "heart", "hair": "swoop", "hairColor": "blonde", "eyes": "almond", "eyeColor": "blue", "outfit": "stripes", "outfitColor": "grass", "hat": "cap"}},
    {"name": "Leo", "pronoun": "he", "look": {"size": "toddler", "skin": "s4", "face": "chubby", "hair": "fuzz", "hairColor": "brown", "mouth": "giggle", "outfit": "pyjamas", "outfitColor": "plum"}},
]
# The shelf shows every tale; only key, title and colour are needed for a cover (no server call on the landing page).
STORIES = [("bears", "{name} and the Three Bears", "#ef5a36"), ("beanstalk", "{name} and the Beanstalk", "#4ea8f5"),
           ("turnip", "{name} and the Enormous Turnip", "#3dbe8b"), ("porridge", "{name} and the Magic Porridge Pot", "#ffc93c"),
           ("emperor", "{name} and the Emperor’s New Clothes", "#8a6bd8"), ("hen", "{name} and the Little Red Hen", "#ff8fb8"),
           ("elves", "{name} and the Elves", "#2fa39b"), ("pea", "{name} and the Pea", "#5b8def"),
           ("gingerbread", "{name} and the Gingerbread Man", "#d9823b"), ("duckling", "{name} and the Ugly Duckling", "#5fb8e0"),
           ("goats", "{name} and the Billy Goats Gruff", "#8cc04b"), ("tortoise", "{name} and the Great Race", "#e9a23b")]
PAGE = ("{name} tried the big bowl. “Too hot!” Then the middle bowl. “Too cold!” Then the wee bowl. “Just right!” "
        "said {name}, and before {he} knew it, the little bowl was empty. Oops!")


class Landing(LandingTemplate):
    """The front page: the promise, an open book starring an example kid (they take turns), the twelve covers
    redrawn with whoever you tap, features, safety, FAQ."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        me = state.me()
        self.guest_cta.visible = not me
        self.signup_note.visible = not me
        self.member_cta.visible = bool(me)
        if me:
            state.set_attr(self.band_link, "href", "#studio/new")
        self._at = 0
        self._paused = False
        self.pals_panel.add_event_handler("x-pick", self._pick)
        if window.UI.reducedMotion():
            self.pal_timer.interval = 0
        self._show(0)

    def _show(self, i):
        self._at = i % len(PALS)
        pal = PALS[self._at]
        self.art_scene.hero = pal
        self.art_face.look = pal["look"]
        self.art_name.text = pal["name"]
        self.dom_nodes["art_text"].innerHTML = window.LH.fillHtml(PAGE, pal)
        self.art_book.classes["lpx-fade"] = False
        window.requestAnimationFrame(lambda t: self.art_book.classes.add("lpx-fade"))
        self.shelf_panel.items = [{"story": {"key": k, "title": t, "color": c}, "hero": pal} for k, t, c in STORIES]
        self.pals_panel.items = [{"pal": p, "on": n == self._at, "index": n} for n, p in enumerate(PALS)]

    def _pick(self, index, **event_args):
        self._paused = True
        self._show(index)

    @handle("pal_timer", "tick")
    def pal_timer_tick(self, **event_args):
        if not self._paused and not window.document.hidden:
            self._show(self._at + 1)
