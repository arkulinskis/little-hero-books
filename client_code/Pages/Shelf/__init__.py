from anvil import *
from anvil.js import window

from ._anvil_designer import ShelfTemplate
from ... import books, router, state

CARD_COLOURS = ["#ffc93c", "#bde5ff", "#ffd6e4", "#c9f0d8", "#e3d9ff"]


def per_row():
    w = window.innerWidth
    return 2 if w < 720 else 4 if w < 1000 else 5


def rows_of(items, n):
    return [items[i:i + n] for i in range(0, len(items), n)]


class Shelf(ShelfTemplate):
    """#home, the bookshelf: your heroes, your books on wooden shelves (reading stars), the next stories to make for
    your first hero, and the example shelf. One server call: get_shelf."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.heroes_panel.add_event_handler("x-make-for", self._make_for)
        self.next_panel.add_event_handler("x-make", self._make)
        d = state.call("get_shelf")
        self._data = d
        me = state.me() or {}
        self.hello.text = "Hello, %s! Story time?" % ((me.get("name") or "").split(" ")[0] or "there")
        st = d["stats"]
        self.n_books.text, self.l_books.text = str(st["books"]), "book" if st["books"] == 1 else "books"
        self.n_reads.text = str(st["reads"])
        self.n_heroes.text, self.l_heroes.text = str(st["heroes"]), "hero" if st["heroes"] == 1 else "heroes"
        self.n_stories.text = str(st["stories"])

        heroes, mine = d["heroes"], d["books"]
        self.hello_card.visible = not heroes
        self.pals_panel.items = [{"hero": h} for h in d["example_heroes"][:4]]
        self.heroes_panel.items = [dict(h, colour=CARD_COLOURS[i % len(CARD_COLOURS)]) for i, h in enumerate(heroes)]

        n = per_row()
        self.rows_panel.items = [{"books": row, "demo": False} for row in rows_of(mine, n)]
        self.no_books.visible = not mine
        self.stars_note.visible = bool(mine)
        self.no_books_text.text = ("Pick a story from the library and %s becomes the hero." % heroes[0]["name"]) if heroes \
            else "Make a hero first, then pick a story."

        lead = heroes[0] if heroes else None
        made = set((b["hero"]["id"], b["story"]["key"]) for b in mine)
        stories = books.stories()
        nxt = [s for s in stories if lead and (lead["id"], s["key"]) not in made][:4]
        self.next_part.visible = bool(nxt)
        if lead:
            self.next_title.text = "Next adventures for %s" % lead["name"]
        self.next_panel.items = [{"story": s, "hero": lead} for s in nxt]

        examples = d["examples"][:n]
        self.examples_part.visible = bool(examples)
        self.examples_panel.items = [{"books": examples, "demo": True}] if examples else []

    def _make_for(self, hero_id, **event_args):
        router.go("library", hero_id)

    def _make(self, story, **event_args):
        heroes = self._data["heroes"]
        books.make_book(story, heroes, heroes[0]["id"] if heroes else None)
