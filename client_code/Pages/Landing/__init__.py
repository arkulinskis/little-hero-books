from anvil import *
from anvil.js import window

from ._anvil_designer import LandingTemplate
from ... import books, lh, state

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
           ("goats", "{name} and the Billy Goats Gruff", "#8cc04b"), ("tortoise", "{name} and the Great Race", "#e9a23b"),
           ("lion", "{name}, the Lion and the Mouse", "#f0a04b"), ("stonesoup", "{name} and the Stone Soup", "#8a6bd8"),
           ("mice", "{name}, the Town Mouse and the Country Mouse", "#4ea8f5"), ("star", "{name} and the Lost Little Star", "#463e8c"),
           ("puddles", "{name}’s Puddle Parade", "#3dbe8b"), ("dragon", "{name} and the Hiccupy Dragon", "#59b45e"),
           ("christmas", "{name}’s Night Before Christmas", "#c8372d")]
SEASON = {"christmas": "christmas"}  # story key -> season (books.SEASONS): it leads the shelf while in season
WORDS = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen "
         "eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five").split()


def number_word(n):
    return WORDS[n] if 0 <= n < len(WORDS) else str(n)


def studio_counts():
    """The hero studio's real choices, counted from the people engine (LH.OPTIONS), so the landing page never undersells it."""
    def n(key):
        return len(lh.options(key))
    return ("%d hairstyles, %d skin tones, %d face shapes, hijab, patka and kippah, %d kinds of glasses, capes and crowns. "
            "“Surprise me” for wild ideas." % (n("hair"), n("skin"), n("face"), n("glasses") - 1))


def shelf_stories():
    """Every tale for the shelf, the seasonal one first while it is in season."""
    items = [{"key": k, "title": t, "color": c, "season": SEASON.get(k, "")} for k, t, c in STORIES]
    return books.seasonal(items)
# The app's video on the Addanapp YouTube channel (APP_MAKER/youtube/manifest.json), shown in the Watch section.
YT_VIDEO = "GGIkFuY4_pc"
PAGE = ("{name} tried the big bowl. “Too hot!” Then the middle bowl. “Too cold!” Then the wee bowl. “Just right!” "
        "said {name}, and before {he} knew it, the little bowl was empty. Oops!")


class Landing(LandingTemplate):
    """The front page: the promise, an open book starring an example kid (they take turns), the Christmas gift strip (15 Nov
    to 26 Dec), every cover redrawn with whoever you tap, features (the studio's counts come from LH.OPTIONS), safety, FAQ."""

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
        self.dom_nodes["yt_cover"].addEventListener("click", self._play)
        n = len(STORIES)
        self.dom_nodes["count_lead"].textContent = number_word(n)
        self.dom_nodes["count_head"].textContent = number_word(n).capitalize()
        self.dom_nodes["count_feat"].textContent = str(n)
        self.dom_nodes["studio_feat"].textContent = studio_counts()
        self.gift_strip.visible = books.in_span(books.GIFT_SEASON)
        self._shelf = shelf_stories()
        self._show(0)

    def _play(self, event):
        """Swap the video's cover for YouTube's player (privacy-enhanced); nothing loads from YouTube before this click."""
        self.dom_nodes["yt_frame"].innerHTML = (
            '<iframe src="https://www.youtube-nocookie.com/embed/' + YT_VIDEO + '?autoplay=1&rel=0&playsinline=1" '
            'title="Little Hero Books video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen '
            'referrerpolicy="strict-origin-when-cross-origin"></iframe>')

    def _show(self, i):
        self._at = i % len(PALS)
        pal = PALS[self._at]
        self.art_scene.hero = pal
        self.art_face.look = pal["look"]
        self.art_name.text = pal["name"]
        self.dom_nodes["art_text"].innerHTML = window.LH.fillHtml(PAGE, pal)
        self.art_book.classes["lpx-fade"] = False
        window.requestAnimationFrame(lambda t: self.art_book.classes.add("lpx-fade"))
        self.shelf_panel.items = [{"story": s, "hero": pal} for s in self._shelf]
        if self.gift_strip.visible:
            self.dom_nodes["gift_art"].innerHTML = window.LH.giftSvg(pal, {"wrap": "christmas"})
        self.pals_panel.items = [{"pal": p, "on": n == self._at, "index": n} for n, p in enumerate(PALS)]

    def _pick(self, index, **event_args):
        self._paused = True
        self._show(index)

    @handle("pal_timer", "tick")
    def pal_timer_tick(self, **event_args):
        if not self._paused and not window.document.hidden:
            self._show(self._at + 1)
