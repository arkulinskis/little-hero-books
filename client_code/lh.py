"""Python face of the drawing engines (theme/assets/lh-*.js, window.LH).

The cartoon people, the 108 story pictures, the page-turning reader and the PDF writer stay JavaScript: they build
thousands of SVG strings and canvas pixels, which the browser does fast and Skulpt (Anvil's client Python) does slowly.
Forms never touch window.LH directly; they call these functions (or use the Components.* that wrap them).
Python dicts and lists become JavaScript objects automatically on the way in.
"""
from anvil.js import window

LH = window.LH
STORY_KEYS = ["bears", "beanstalk", "turnip", "porridge", "emperor", "hen", "elves", "pea", "gingerbread", "duckling",
              "goats", "tortoise"]
GENERIC = {"name": "Little Hero", "pronoun": "they", "look": None, "generic": True}
PRONOUN_LABELS = {"she": "she / her", "he": "he / him", "they": "they / them"}


def avatar_svg(look, **opts):
    """The cartoon (look=None draws the dashed 'your hero here' outline). opts: pose, mood, crop ('head'/'hat'), fit."""
    return LH.avatarSvg(look, opts)


def scene_svg(story_key, page, hero, **opts):
    """One story picture: page 0..8 or 'cover'. opts: clip (unique id), outline, grain."""
    return LH.sceneSvg(story_key, page, hero, opts)


def cover_html(story, hero, sub=None, outline=False):
    return LH.coverHtml(story, hero, {"sub": sub, "outline": outline})


def title(story, hero):
    """'{name} and the Three Bears' with the hero's name (or 'Little Hero')."""
    return LH.title(story, hero)


def fill(text, hero):
    """Swap {name} {he} {his} ... for the hero's name and pronouns."""
    return LH.fill(text, hero or GENERIC)


def dedication(book):
    return LH.dedication(book)


def uid(prefix="lh"):
    return LH.uid(prefix)


def normal(look):
    """A look with every key filled in (new options get their defaults)."""
    return dict(LH.normal(look))


def random_look(keep=None):
    return dict(LH.normal(LH.randomLook(keep)))


def default_look():
    return dict(LH.normal(LH.DEFAULT_LOOK))


def options(key):
    """The choices for one look key: [[value, label], ...] (colour keys are plain values)."""
    return list(LH.OPTIONS[key])


def colour_of(key, value):
    table = {"skin": "skin", "hairColor": "hair", "eyeColor": "eye"}.get(key, "cloth")
    return LH.COL[table][value]


def colour_name(value):
    return LH.COLOR_NAMES[value] or value


def pdf_pages(book, opts):
    return LH.pdfPages(book, opts).length


def print_sizes():
    return [dict(s) for s in LH.PRINT_SIZES]


def bleeds():
    return [dict(b) for b in LH.BLEEDS]


def file_name(book, opts):
    return LH.fileName(book, opts)


def make_pdf(book, progress, opts):
    """Draw every page and write the PDF (a JavaScript Blob). Waits until it is done; progress(i, total) is called
    after each page."""
    return LH.makePdf(book, progress, opts)


def reader(node, book, opts):
    """Mount the page-turning reader into a DOM node. Returns its controller (go, destroy)."""
    return LH.reader(node, book, opts)


def paint_picture(book, index):
    """One page's picture as a PNG (a JavaScript Blob) for the painting studio. Waits until it is drawn."""
    return LH.paintPicture(book, index)


def has_paint(book):
    return bool(LH.hasPaint(book))
