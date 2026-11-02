"""Page addresses: #name/arg1/arg2 -> a page Form (open_form), with sign-in rules.

The addresses are the same as in the JavaScript version (#home, #book/<id>, #read/<shareKey> ...), so family links
people already sent keep working. Links in templates are plain <a href="#library">; code calls router.go("book", id).

    PAGES[name] = (who may open it, title)     who: None = anyone, "guest" = signed out only, "user", "admin"
"""
import anvil
import anvil.js
from anvil.js import window

from . import state

PAGES = {
    "landing": (None, "Welcome"),
    "auth": ("guest", "Sign in"),
    "home": ("user", "Your bookshelf"),
    "studio": (None, "Hero studio"),
    "library": (None, "Story library"),
    "book": (None, "Book"),
    "story": (None, "Story"),
    "read": (None, "A book for you"),
    "profile": ("user", "Your profile"),
    "admin": ("admin", "Admin"),
}
APP_NAME = "Little Hero Books"
_r: dict = {"after": "", "listening": False}


def _form(name):
    """The page's Form class (imported when first needed, so start-up stays quick)."""
    if name == "landing":
        from .Pages.Landing import Landing
        return Landing
    if name == "auth":
        from .Pages.Auth import Auth
        return Auth
    if name == "home":
        from .Pages.Shelf import Shelf
        return Shelf
    if name == "studio":
        from .Pages.Studio import Studio
        return Studio
    if name == "library":
        from .Pages.Library import Library
        return Library
    if name == "book":
        from .Pages.Book import Book
        return Book
    if name == "story":
        from .Pages.Story import Story
        return Story
    if name == "read":
        from .Pages.Read import Read
        return Read
    if name == "profile":
        from .Pages.Profile import Profile
        return Profile
    from .Pages.Admin import Admin
    return Admin


def parse(hash_text):
    h = (hash_text or "").lstrip("#").lstrip("!").lstrip("/").split("?")[0]
    parts = [window.decodeURIComponent(p) for p in h.split("/") if p]
    return (parts[0] if parts else ""), parts[1:]


def href(name, *args):
    return "#" + "/".join([name] + [window.encodeURIComponent(str(a)) for a in args if a not in (None, "")])


def home_page():
    return "home" if state.me() else "landing"


def show():
    """Open the page for the current address."""
    name, args = parse(window.location.hash)
    if name not in PAGES:
        name, args = home_page(), []
    who = PAGES[name][0]
    if who == "guest" and state.me():
        name, args = "home", []
    elif who in ("user", "admin") and not state.me():
        _r["after"] = window.location.hash
        name, args = "auth", []
    elif who == "admin" and not state.is_admin():
        state.toast("That page is for admins only.", "error")
        name, args = "home", []
    window.document.title = PAGES[name][1] + " · " + APP_NAME
    window.UI_READY = False
    page = _form(name)(args=args)
    anvil.open_form(page)
    shell = getattr(page, "layout", None)
    if shell is not None and hasattr(shell, "refresh"):
        shell.refresh()  # Anvil reuses the layout between pages, so tell it who is signed in now
    window.scrollTo(0, 0)
    window.UI_READY = True


def go(name, *args):
    """Go to a page. Same address again = reload the page."""
    target = href(name, *args)
    if window.location.hash == target:
        show()
    else:
        window.location.hash = target


def replace(name, *args):
    """Change the address without opening anything (a page that switches its own view, like Sign in / Create account)."""
    window.history.replaceState(None, "", href(name, *args))


def after_sign_in():
    """Where to go once someone signs in: the page they were heading for, or their shelf."""
    target = _r["after"]
    _r["after"] = ""
    if target and target != window.location.hash:
        window.location.hash = target
    else:
        go("home")


def remember_after(target):
    _r["after"] = target


def _on_hash(event):
    show()


def start():
    if not _r["listening"]:
        window.addEventListener("hashchange", anvil.js.report_exceptions(_on_hash))
        _r["listening"] = True
    show()
