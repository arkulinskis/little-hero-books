import json

from anvil import *

from ._anvil_designer import StudioTemplate
from ... import books, lh, router, state

TABS = ["face", "hair", "eyes", "clothes", "extras"]
# Each tab's option groups: (look key, heading, kind). Kinds: sw = colour swatches, toggles = on/off buttons,
# head/hat = face thumbnails, body = whole-body thumbnails, size = ages side by side.
GROUPS = {
    "face": [("size", "How old?", "size"), ("skin", "Skin tone", "sw"), ("face", "Face shape", "head"), ("nose", "Nose", "head"),
             ("marks", "Cheeks & freckles", "toggles"), ("mark", "Face paint & little marks", "head")],
    "hair": [("hair", "Hairstyle", "head"), ("hairColor", "Hair colour", "sw")],
    "eyes": [("eyes", "Eyes", "head"), ("eyeColor", "Eye colour", "sw"), ("brows", "Eyebrows", "head"), ("mouth", "Smile", "head")],
    "clothes": [("outfit", "Outfit", "body"), ("outfitColor", "Favourite colour", "sw")],
    "extras": [("hat", "On their head", "hat"), ("glasses", "Glasses", "head")],
}
POSES = ["stand", "wave", "cheer", "walk"]
STORY_TITLES = {"bears": "{name} and the Three Bears", "beanstalk": "{name} and the Beanstalk", "turnip": "{name} and the Enormous Turnip",
                "porridge": "{name} and the Magic Porridge Pot", "emperor": "{name} and the Emperor’s New Clothes",
                "hen": "{name} and the Little Red Hen", "elves": "{name} and the Elves", "pea": "{name} and the Pea",
                "gingerbread": "{name} and the Gingerbread Man", "duckling": "{name} and the Ugly Duckling",
                "goats": "{name} and the Billy Goats Gruff", "tortoise": "{name} and the Great Race"}


class Studio(StudioTemplate):
    """#studio (the draft or a fresh hero), #studio/new, #studio/<heroId> (edit yours), #studio/copy/<exampleId>.
    Anyone can play: guests keep a draft in this browser; saving needs an account (save_hero). The draft is also
    what #story/<key>/draft shows, so "Try it in a story" works before saving."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.groups_panel.add_event_handler("x-opt", self._opt)
        self.groups_panel.add_event_handler("x-tog", self._tog)
        self.hero_id, self.name, self.pronoun = None, "", "she"
        self.look = lh.default_look()
        self.tab, self.pose, self.story_at = "face", "wave", 0
        self._undo = []
        self._start(list(args))
        self._draw_frame()
        self._refresh()
        if state.me() and state.store_get("saveAfterSignup", False) and self.name.strip():
            state.store_set("saveAfterSignup", False)
            self.save_button_click()

    # ---------------------------------------------------------------- start
    def _start(self, a):
        if a[:1] == ["copy"] and len(a) > 1:
            r = state.call("get_hero", a[1])
            if r:
                self.look, self.pronoun = lh.normal(r["hero"]["look"]), r["hero"]["pronoun"]
                state.toast("Starting from %s. Make it yours!" % r["hero"]["name"])
            return
        if a and a[0] != "new":
            r = state.call("get_hero", a[0])
            if r:
                self.hero_id = r["hero"]["id"] if r["mine"] else None
                self.name = r["hero"]["name"] if r["mine"] else ""
                self.pronoun, self.look = r["hero"]["pronoun"], lh.normal(r["hero"]["look"])
            return
        d = None if a[:1] == ["new"] else books.load_draft()
        if d and d.get("look") and not d.get("id"):
            self.name, self.pronoun, self.look = d.get("name") or "", d.get("pronoun") or "she", lh.normal(d["look"])
        else:
            self.look = lh.random_look()
            self.look["outfitColor"] = "tomato"

    def _draw_frame(self):
        """The parts that only depend on who is editing what."""
        mine = True
        self.title.text = ("Edit " + (self.name or "your hero")) if self.hero_id else "Make a hero who looks like your child"
        self.name_box.text = self.name
        self.save_button.visible = mine
        self.save_button.text = "Save changes" if self.hero_id else "Save my hero"
        editing = bool(self.hero_id)
        self.make_link.visible = editing
        self.spacer.visible = editing
        self.remove_button.visible = editing
        self.guest_note.visible = not state.me()

    # ---------------------------------------------------------------- redraw
    def _hero(self):
        return {"name": self.name.strip() or "Your hero", "pronoun": self.pronoun, "look": self.look}

    def _refresh(self, groups=True):
        look = self.look
        self.preview.mood = "laugh" if self.pose == "cheer" else "happy"
        self.preview.pose = self.pose
        self.preview.look = look
        self.name_out.text = self.name.strip() or "Your hero"
        size = next((o[1] for o in lh.options("size") if o[0] == look.get("size")), "Age 6")
        self.sub_out.text = size + " · " + lh.PRONOUN_LABELS.get(self.pronoun, "")
        for p, el in zip(POSES, [self.pose_stand, self.pose_wave, self.pose_cheer, self.pose_walk]):
            el.classes["on"] = p == self.pose
        for p, el in zip(["she", "he", "they"], [self.pro_she, self.pro_he, self.pro_they]):
            el.classes["on"] = p == self.pronoun
        for t, el in zip(TABS, [self.tab_face, self.tab_hair, self.tab_eyes, self.tab_clothes, self.tab_extras]):
            el.classes["on"] = t == self.tab
        self.undo_button.enabled = bool(self._undo)
        key = lh.STORY_KEYS[self.story_at]
        hero = self._hero()
        self.try_scene.story_key = key
        self.try_scene.hero = hero
        state.set_attr(self.try_link, "href", "#story/%s/draft" % key)
        state.set_attr(self.try_link, "title", 'Read "%s" with this hero' % lh.fill(STORY_TITLES[key], hero))
        if groups:
            self._groups()
        books.save_draft({"id": self.hero_id, "name": self.name, "pronoun": self.pronoun, "look": look})

    def _groups(self):
        items = [{"key": k, "title": t, "kind": kind, "look": self.look} for k, t, kind in GROUPS[self.tab]]
        existing: list = self.groups_panel.get_components()
        if len(existing) == len(items) and all(g.item["key"] == i["key"] for g, i in zip(existing, items)):
            for g in existing:
                g.show_look(self.look)  # same tab: redraw the thumbnails in place (quicker than new forms)
        else:
            self.groups_panel.items = items

    def _change(self, fn):
        self._undo.append(json.dumps(self.look))
        self._undo = self._undo[-40:]
        fn()
        self._refresh()

    # ---------------------------------------------------------------- events
    def _opt(self, key, value, **event_args):
        def set_it():
            self.look[key] = value
        self._change(set_it)

    def _tog(self, key, **event_args):
        def flip():
            self.look[key] = not self.look.get(key)
        self._change(flip)

    def tab_click(self, event):
        self.tab = event.currentTarget.getAttribute("data-tab")
        self._refresh()

    def pose_click(self, event):
        self.pose = event.currentTarget.getAttribute("data-pose")
        self._refresh(groups=False)

    def pronoun_click(self, event):
        self.pronoun = event.currentTarget.getAttribute("data-pronoun")
        self._refresh(groups=False)

    @handle("name_box", "change")
    def name_box_change(self, **event_args):
        self.name = self.name_box.text or ""
        self.name_out.text = self.name.strip() or "Your hero"
        books.save_draft({"id": self.hero_id, "name": self.name, "pronoun": self.pronoun, "look": self.look})

    @handle("name_box", "lost_focus")
    def name_box_lost_focus(self, **event_args):
        self.name = self.name_box.text or ""
        self._refresh(groups=False)

    @handle("random_button", "click")
    def random_button_click(self, **event_args):
        def surprise():
            self.look = lh.random_look(self.look)
        self.pose = "cheer"
        self._change(surprise)

    @handle("undo_button", "click")
    def undo_button_click(self, **event_args):
        if self._undo:
            self.look = json.loads(self._undo.pop())
            self._refresh()

    @handle("prev_story", "click")
    def prev_story_click(self, **event_args):
        self.story_at = (self.story_at - 1) % len(lh.STORY_KEYS)
        self._refresh(groups=False)

    @handle("next_story", "click")
    def next_story_click(self, **event_args):
        self.story_at = (self.story_at + 1) % len(lh.STORY_KEYS)
        self._refresh(groups=False)

    @handle("save_button", "click")
    def save_button_click(self, **event_args):
        self.name = self.name_box.text or self.name
        name = self.name.strip()
        if not name:
            state.toast("Type your child’s name first, so the stories can use it.", "error")
            self.name_box.focus()
            return
        if not state.me():
            books.save_draft({"id": None, "name": self.name, "pronoun": self.pronoun, "look": self.look})
            state.store_set("saveAfterSignup", True)
            router.remember_after("#studio")
            state.toast("Make a free account and %s is saved to your shelf." % name)
            router.go("auth", "signup")
            return
        self.save_button.enabled = False
        try:
            r = state.call("save_hero", self.hero_id, name, self.pronoun, self.look)
        finally:
            self.save_button.enabled = True
        if r:
            state.store_set("draft", None)
            state.store_set("saveAfterSignup", False)
            state.confetti()
            state.toast(r["hero"]["name"] + (" is updated!" if self.hero_id else " is ready for adventures!"), "ok")
            router.go("home")

    @handle("remove_button", "click")
    def remove_button_click(self, **event_args):
        who = self.name or "this hero"
        if not confirm("Their books are removed from your shelf too. PDFs you already downloaded stay yours.",
                       title="Remove %s?" % who, buttons=[("Cancel", False), ("Remove", True)], role="lh-dialog"):
            return
        r = state.call("delete_hero", self.hero_id)
        if r:
            state.store_set("draft", None)
            n = r.get("removed_books") or 0
            state.toast("Removed" + (", with " + state.plural(n, "book") if n else ""), "ok")
            router.go("home")
