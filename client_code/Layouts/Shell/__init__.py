import datetime

from anvil import *
import anvil.js
from anvil.js import window

from ._anvil_designer import ShellTemplate
from ... import auth, router, state

NAV = ["home", "studio", "library"]
THEMES = ["auto", "light", "dark"]


class Shell(ShellTemplate):
    """The frame around every page: header (menu for members, Sign in / Get started for visitors), the account menu,
    the footer and the phone tab bar. Pages use it with <anvil-form layout="Little_Hero_Books.Layouts.Shell">."""

    def __init__(self, **properties):
        self._active, self._ready = "", False
        super().__init__(**properties)
        self._ready = True
        self.copyright_label.text = "© %d Little Hero Books" % datetime.date.today().year
        self._show_theme()
        self._paint_active()
        self._outside = anvil.js.report_exceptions(self._close_menu_outside)
        self._keys = anvil.js.report_exceptions(self._key)

    # ---- the page that is open (set by each page: <anvil-form layout="..." prop:active="home">)
    @property
    def active(self):
        return self._active

    @active.setter
    def active(self, value):
        self._active = value or ""
        if self._ready:
            self._paint_active()

    def refresh(self):
        """Redraw the parts that depend on who is signed in (router.show calls it after every page change)."""
        self._paint_active()

    def _paint_me(self):
        """Signed in or not. Anvil keeps one Shell while pages come and go (open_form swaps only the slot), so this
        runs every time a page opens, not just once."""
        me = state.me()
        self.classes.update({"signed-in": bool(me), "signed-out": not me})
        self.nav.visible = bool(me)
        self.tabbar.visible = bool(me)
        self.member_actions.visible = bool(me)
        self.menu.visible = False
        state.set_attr(self.brand, "href", "#home" if me else "#landing")
        if me:
            self.avatar_button.text = state.initials(me.get("name"))
            self.menu_name.text = me.get("name") or ""
            self.menu_email.text = me.get("email") or ""
            self.admin_link.visible = bool(me.get("is_admin"))

    def _paint_active(self):
        self._paint_me()
        for name in NAV:
            self.get_nav(name).classes["on"] = name == self._active
            self.get_tab(name).classes["on"] = name == self._active
        self.tab_profile.classes["on"] = self._active == "profile"
        self.guest_actions.visible = not state.me() and self._active != "auth"

    def get_nav(self, name):
        return {"home": self.nav_home, "studio": self.nav_studio, "library": self.nav_library}[name]

    def get_tab(self, name):
        return {"home": self.tab_home, "studio": self.tab_studio, "library": self.tab_library}[name]

    # ---- account menu
    @handle("avatar_button", "click")
    def avatar_button_click(self, **event_args):
        self.menu.visible = not self.menu.visible

    def _close_menu_outside(self, event):
        if self.menu.visible and not event.target.closest(".anvil-role-avatar, .ui-menu .ui-seg"):
            self.menu.visible = False

    def _key(self, event):
        # Chrome autofill fires "keydown" as a plain Event with no key
        if getattr(event, "key", None) == "Escape":
            self.menu.visible = False

    @handle("", "show")
    def form_show(self, **event_args):
        window.document.addEventListener("click", self._outside, True)
        window.document.addEventListener("keydown", self._keys)

    @handle("", "hide")
    def form_hide(self, **event_args):
        window.document.removeEventListener("click", self._outside, True)
        window.document.removeEventListener("keydown", self._keys)

    def theme_click(self, event):
        state.set_theme(event.currentTarget.getAttribute("data-theme-set"))
        self._show_theme()

    def _show_theme(self):
        t = state.theme()
        for name, el in zip(THEMES, [self.theme_auto, self.theme_light, self.theme_dark]):
            el.classes["on"] = name == t

    def feedback_click(self, event):
        self.menu.visible = False
        state.feedback()

    def sign_out_click(self, event):
        auth.sign_out()
        state.toast("Signed out. See you soon!")
        router.go("landing")
