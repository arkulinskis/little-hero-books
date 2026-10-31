"""Demo content, so the app never looks empty: four example heroes (made by fictional parents) and a book
each. Everyone, even signed-out visitors, can read the example books and copy an example hero into the
studio. Loaded automatically the first time anyone opens the app (ensure_loaded), removed or reloaded
from Admin -> Demo data. Removing it is remembered: it doesn't come back.

Demo users have is_demo=True and @example.com emails; they can't sign in (no password). Every demo row
is flagged is_demo=True, so remove() deletes exactly what load() added.
"""
import datetime as dt

from anvil.tables import app_tables

from . import common as C

DEMO_USERS = [
    ("Priya Shah", "priya.demo@example.com"),
    ("Tom Okafor", "tom.demo@example.com"),
    ("Lea Moreau", "lea.demo@example.com"),
]
# (parent, name, pronoun, look)
DEMO_HEROES = [
    (0, "Juniper", "she", {"size": "kid", "skin": "s2", "face": "round", "hair": "curly", "hairColor": "ginger",
                           "eyes": "sparkle", "eyeColor": "green", "brows": "soft", "nose": "button", "mouth": "grin",
                           "cheeks": True, "freckles": True, "glasses": "round", "outfit": "overalls",
                           "outfitColor": "sky", "hat": "none"}),
    (1, "Kofi", "he", {"size": "kid", "skin": "s7", "face": "oval", "hair": "crop", "hairColor": "black",
                       "eyes": "round", "eyeColor": "dark", "brows": "bold", "nose": "button", "mouth": "toothy",
                       "cheeks": True, "freckles": False, "glasses": "none", "outfit": "cape",
                       "outfitColor": "tomato", "hat": "none"}),
    (1, "Amara", "she", {"size": "toddler", "skin": "s6", "face": "chubby", "hair": "puffs", "hairColor": "black",
                         "eyes": "sparkle", "eyeColor": "brown", "brows": "soft", "nose": "dot", "mouth": "giggle",
                         "cheeks": True, "freckles": False, "glasses": "none", "outfit": "dress",
                         "outfitColor": "sun", "hat": "flower"}),
    (2, "Sasha", "they", {"size": "kid", "skin": "s3", "face": "heart", "hair": "swoop", "hairColor": "blonde",
                          "eyes": "almond", "eyeColor": "blue", "brows": "soft", "nose": "button", "mouth": "smile",
                          "cheeks": True, "freckles": False, "glasses": "none", "outfit": "stripes",
                          "outfitColor": "grass", "hat": "cap"}),
]
# (hero index, story, dedication, times read)
DEMO_BOOKS = [
    (0, "bears", "For Juniper, who always says sorry first. Love, Mum", 14),
    (1, "beanstalk", "To our brave climber Kofi. Reach for the clouds!", 9),
    (2, "porridge", "For Amara, our little chef. Love from Mama and Papa", 6),
    (3, "emperor", "For Sasha, who always tells it like it is.", 4),
    (0, "turnip", "", 3),
]
# Tables that hold demo rows (each has an is_demo column). Children before parents.
DEMO_TABLES = ["books", "heroes"]


def state():
    return C.get_setting("demo", "never")  # "never" | "loaded" | "removed"


def ensure_loaded():
    """Call from the app's main data callables: loads the demo once, unless an admin removed it."""
    if state() == "never":
        load()


def load():
    remove(remember=False)
    users = []
    for name, email in DEMO_USERS:
        u = app_tables.users.get(email=email) or app_tables.users.add_row(email=email, enabled=False)
        u.update(display_name=name, is_demo=True, signed_up=C.now() - dt.timedelta(days=30))
        users.append(u)
    heroes = []
    for i, (who, name, pronoun, look) in enumerate(DEMO_HEROES):
        when = C.now() - dt.timedelta(days=20 - i)
        heroes.append(app_tables.heroes.add_row(owner=users[who], name=name, pronoun=pronoun, look=dict(look),
                                                created=when, updated=when, is_demo=True))
    for i, (h, story, dedication, reads) in enumerate(DEMO_BOOKS):
        hero = heroes[h]
        app_tables.books.add_row(owner=hero["owner"], hero=hero, story=story, dedication=dedication,
                                 created=C.now() - dt.timedelta(days=15 - i), times_read=reads, is_demo=True)
    C.set_setting("demo", "loaded")
    return counts()


def remove(remember=True):
    for name in DEMO_TABLES:
        for r in getattr(app_tables, name).search(is_demo=True):
            r.delete()
    for u in app_tables.users.search(is_demo=True):
        u.delete()
    if remember:
        C.set_setting("demo", "removed")
    return counts()


def counts():
    out = {"users": len(app_tables.users.search(is_demo=True))}
    for name in DEMO_TABLES:
        out[name] = len(getattr(app_tables, name).search(is_demo=True))
    return out
