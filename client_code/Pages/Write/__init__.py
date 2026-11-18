from anvil import *
import anvil.js

from ._anvil_designer import WriteTemplate
from ... import books, lh, router, state

MAX_PAGES = 16
TOKENS = {"tok_name": "{name}", "tok_he": "{he}", "tok_him": "{him}", "tok_his": "{his}"}
COLOR_NAMES = {"#ef5a36": "Tomato", "#ffc93c": "Sunshine", "#3dbe8b": "Grass", "#4ea8f5": "Sky", "#8a6bd8": "Plum",
               "#ff8fb8": "Pink", "#f0a04b": "Orange", "#59b45e": "Leaf", "#463e8c": "Night", "#2b2350": "Ink"}


class Write(WriteTemplate):
    """#write: your stories and where to start a new one (a blank page or any library story).
    #write/new/<storyKey|blank>: a new story (not saved until Save). #write/<u-key>: change one of yours.
    A page = its text (tokens {name} {he} {him} {his}) + one library picture ("bears:3"). Unsaved changes are kept in
    this browser (store "writeDraft") and offered back the next time the same story opens."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self._lib = state.call("get_library")
        books.remember_stories(self._lib)
        self._choices = books.hero_choices(self._lib)
        self._choice = self._choices[0]
        self.key, self.saved, self._focus, self._dirty = "", None, 0, False
        self.mine_panel.add_event_handler("x-read", self._read)
        self.mine_panel.add_event_handler("x-edit", self._edit)
        self.base_panel.add_event_handler("x-start", self._start)
        self.picks_panel.add_event_handler("x-pick", self._pick)
        self.colors_panel.add_event_handler("x-opt", self._color)
        for name, fn in [("x-pic", self._page_pic), ("x-move", self._page_move), ("x-remove", self._page_remove),
                         ("x-text", self._page_text), ("x-focus", self._page_focus)]:
            self.pages_panel.add_event_handler(name, fn)
        self.preview_part.visible = False
        if not args:
            self._hub()
        elif args[0] == "new":
            r = state.call("start_story", args[1] if len(args) > 1 and args[1] != "blank" else None)
            if r:
                self._open(r["story"], r["colors"], 0)
        else:
            r = state.call("get_user_story", args[0])
            if not r:
                router.go("write")
                return
            self._open(r["story"], r["colors"], r["books"])

    # ---------------------------------------------------------------- the hub (#write)
    def _hub(self):
        self.hub.visible, self.editor.visible = True, False
        hero = self._choice["hero"]
        mine = self._lib.get("mine") or []
        self.mine_part.visible = bool(mine)
        self.mine_panel.items = [{"story": s, "hero": hero, "own": False, "edit": True} for s in mine]
        self.base_panel.items = [{"story": s, "hero": hero} for s in self._lib["stories"]]

    def _read(self, story, **event_args):
        router.go("story", story["key"], self._choice["ref"])

    def _edit(self, story, **event_args):
        router.go("write", story["key"])

    def _start(self, key, **event_args):
        router.go("write", "new", key)

    @handle("new_button", "click")
    def new_button_click(self, **event_args):
        router.go("write", "new", "blank")

    # ---------------------------------------------------------------- the editor
    def _open(self, story, colors, books_n):
        self.hub.visible, self.editor.visible = False, True
        self.key, self.base, self.colors, self.books_n = story.get("key") or "", story.get("base") or "", colors, books_n
        self.saved = story if self.key else None
        self._load(story["title"], story.get("blurb") or "", story["color"], story.get("cover") or "",
                   [{"text": t, "pic": p} for t, p in zip(story["text"], story["pics"])])
        self._dirty = not self.key
        d = state.store_get("writeDraft", None)
        if d and (d.get("key") or "") == self.key and (self.key or (d.get("base") or "") == self.base) and d.get("pages"):
            if confirm("You changed this story earlier and didn't save it. Pick up where you left off?",
                       title="Unsaved changes", buttons=[("Start fresh", False), ("Yes, carry on", True)]):
                self._load(d.get("title") or "", d.get("blurb") or "", d.get("color") or self.color, d.get("cover") or self.cover,
                           [{"text": p.get("text") or "", "pic": p.get("pic") or "star:1"} for p in d["pages"]])
                self._dirty = True
            else:
                state.store_set("writeDraft", None)
        self._draw_head()
        self._draw_picks()
        self._status()

    def _load(self, title, blurb, color, cover, pages):
        self.title_box.text, self.blurb_box.text = title, blurb
        self.color = color if color in self.colors else self.colors[0]
        self.cover = cover or (pages[0]["pic"] if pages else "star:cover")
        self.pages = pages or [{"text": "", "pic": "star:1"}]
        self._draw_colors()
        self._draw_cover()
        self._draw_pages()

    def _hero(self):
        return self._choice["hero"]

    def _draw_head(self):
        base = next((s for s in self._lib["stories"] if s["key"] == self.base), None)
        self.head_title.text = "Your story" if self.key else "A new story"
        if base and not self.key:
            self.head_sub.text = "Starting from “%s”. Change anything you like: the library copy stays as it is." % base["plain"]
        else:
            self.head_sub.text = "Only you can see your stories. Make one a book to read it aloud, print it or share it with family."
        self.delete_button.visible = bool(self.key)

    def _draw_colors(self):
        self.colors_panel.items = [{"key": "color", "value": c, "colour": c, "name": COLOR_NAMES.get(c, c), "on": c == self.color}
                                   for c in self.colors]

    def _draw_cover(self):
        anvil.js.get_dom_node(self.cover_art).innerHTML = lh.pic_svg(self.cover, self._hero(), clip=lh.uid("wc"))

    def _draw_picks(self):
        self.picks_panel.items = [{"choice": x, "on": x["ref"] == self._choice["ref"]} for x in self._choices]

    def _draw_pages(self):
        n, hero = len(self.pages), self._hero()
        self.pages_panel.items = [{"i": i, "total": n, "text": p["text"], "pic": p["pic"], "hero": hero} for i, p in enumerate(self.pages)]
        self.add_button.enabled = n < MAX_PAGES
        self.count_label.text = "%d of %d pages" % (n, MAX_PAGES)

    def _status(self):
        self.status_label.text = "Not saved yet" if self._dirty else "All changes saved"
        self.status_label.role = ["wr-status", "warn"] if self._dirty else ["wr-status"]

    def _changed(self):
        self._dirty = True
        self._status()
        state.store_set("writeDraft", {"key": self.key, "base": self.base, "title": self.title_box.text or "",
                                       "blurb": self.blurb_box.text or "", "color": self.color, "cover": self.cover,
                                       "pages": [{"text": p["text"], "pic": p["pic"]} for p in self.pages]})

    # ---- pictures, colours, who stars
    def _pick_picture(self, current):
        from ...Dialogs.PickPicture import PickPicture
        return alert(PickPicture(stories=self._lib["stories"], hero=self._hero(), current=current), buttons=[], large=True,
                     role="lh-dialog")

    def cover_art_click(self, event):
        self.cover_button_click()

    @handle("cover_button", "click")
    def cover_button_click(self, **event_args):
        ref = self._pick_picture(self.cover)
        if ref:
            self.cover = ref
            self._draw_cover()
            self._changed()

    def _color(self, key, value, **event_args):
        self.color = value
        self._draw_colors()
        self._changed()

    def _pick(self, ref, **event_args):
        self._choice = next((c for c in self._choices if c["ref"] == ref), self._choice)
        self._draw_picks()
        self._draw_cover()
        self._draw_pages()
        if self.preview_part.visible:
            self.preview_button_click()

    # ---- pages
    def _page_text(self, i, text, **event_args):
        if 0 <= i < len(self.pages):
            self.pages[i]["text"] = text
            self._changed()

    def _page_focus(self, i, **event_args):
        self._focus = i

    def _page_pic(self, i, **event_args):
        ref = self._pick_picture(self.pages[i]["pic"])
        if ref:
            self.pages[i]["pic"] = ref
            self._draw_pages()
            self._changed()

    def _page_move(self, i, step, **event_args):
        j = i + step
        if 0 <= j < len(self.pages):
            self.pages[i], self.pages[j] = self.pages[j], self.pages[i]
            self._focus = j
            self._draw_pages()
            self._changed()

    def _page_remove(self, i, **event_args):
        if len(self.pages) <= 1:
            return
        if (self.pages[i]["text"] or "").strip() and not confirm("Remove page %d and its words?" % (i + 1), title="Remove this page?",
                                                                 buttons=[("Keep it", False), ("Remove", True)]):
            return
        del self.pages[i]
        self._focus = min(self._focus, len(self.pages) - 1)
        self._draw_pages()
        self._changed()

    @handle("add_button", "click")
    def add_button_click(self, **event_args):
        if len(self.pages) >= MAX_PAGES:
            return
        last = self.pages[-1]["pic"] if self.pages else "star:0"
        key, _, page = last.partition(":")
        story = next((s for s in self._lib["stories"] if s["key"] == key), None)
        nxt = int(page) + 1 if page.isdigit() else 0
        pic = "%s:%d" % (key, nxt) if story and nxt < story["pages"] else last
        self.pages.append({"text": "", "pic": pic})
        self._focus = len(self.pages) - 1
        self._draw_pages()
        self._changed()
        comps = self.pages_panel.get_components()
        if comps:
            node = anvil.js.get_dom_node(comps[-1])
            node.scrollIntoView({"behavior": "smooth", "block": "center"})
            getattr(comps[-1], "focus_text")()

    def _token(self, name):
        comps = self.pages_panel.get_components()
        if comps:
            getattr(comps[max(0, min(self._focus, len(comps) - 1))], "insert")(TOKENS[name])

    @handle("tok_name", "click")
    def tok_name_click(self, **event_args):
        self._token("tok_name")

    @handle("tok_he", "click")
    def tok_he_click(self, **event_args):
        self._token("tok_he")

    @handle("tok_him", "click")
    def tok_him_click(self, **event_args):
        self._token("tok_him")

    @handle("tok_his", "click")
    def tok_his_click(self, **event_args):
        self._token("tok_his")

    @handle("title_box", "change")
    def title_box_change(self, **event_args):
        self._changed()

    @handle("blurb_box", "change")
    def blurb_box_change(self, **event_args):
        self._changed()

    # ---- save, preview, make a book, delete
    def _save(self, quiet=False):
        pages = [{"text": p["text"], "pic": p["pic"]} for p in self.pages]
        self.save_button.enabled = False
        try:
            r = state.call("save_story", self.key, self.title_box.text or "", self.blurb_box.text or "", self.color,
                           self.cover, pages, self.base)
        finally:
            self.save_button.enabled = True
        if not r:
            return None
        s = r["story"]
        first = not self.key
        self.key, self.saved, self._dirty = s["key"], s, False
        state.store_set("writeDraft", None)
        if [p["text"] for p in self.pages] != list(s["text"]) or (self.title_box.text or "") != s["title"]:
            self._load(s["title"], s["blurb"], s["color"], s["cover"], [{"text": t, "pic": p} for t, p in zip(s["text"], s["pics"])])
        if first:
            router.replace("write", self.key)
            self._draw_head()
        self._status()
        if not quiet:
            state.toast("Your story is saved.", "ok")
        return s

    @handle("save_button", "click")
    def save_button_click(self, **event_args):
        self._save()

    def _draft(self):
        return {"key": self.key or "u-draft", "title": self.title_box.text or "{name}’s story", "plain": "",
                "blurb": self.blurb_box.text or "", "color": self.color, "source": "", "custom": True,
                "text": [p["text"] or " " for p in self.pages], "pics": [p["pic"] for p in self.pages], "cover": self.cover,
                "pages": len(self.pages)}

    @handle("preview_button", "click")
    def preview_button_click(self, **event_args):
        self.reader.book = books.as_book(self._draft(), self._hero())
        if not self.preview_part.visible:
            self.preview_part.visible = True
            anvil.js.get_dom_node(self.preview_part).scrollIntoView({"behavior": "smooth", "block": "start"})

    @handle("make_button", "click")
    def make_button_click(self, **event_args):
        story = self._save(quiet=True) if (self._dirty or not self.saved) else self.saved
        if story:
            books.make_book(story, self._lib["heroes"], self._choice["ref"] if self._choice["own"] else None)

    @handle("delete_button", "click")
    def delete_button_click(self, **event_args):
        extra = ""
        if self.books_n:
            extra = " The %s made from it will be removed too." % state.plural(self.books_n, "book")
        if not confirm("Delete “%s”?%s This can't be undone." % (lh.title(self._draft(), self._hero()), extra),
                       title="Delete this story?", buttons=[("Keep it", False), ("Delete", True)]):
            return
        r = state.call("delete_story", self.key)
        if r:
            state.store_set("writeDraft", None)
            state.toast("Story deleted.", "ok")
            router.go("write")
